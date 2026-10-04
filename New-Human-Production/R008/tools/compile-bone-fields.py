#!/usr/bin/env python3
"""Compile an offline anatomical mesh teacher to cosine implicit-function weights.

Only this compiler reads source OBJ triangles. No source triangles, sampled field
values, or reconstructed vertices are persisted in the deliverable. Each runtime
surface is the zero set of an explicit tensor-product cosine polynomial. Source
and reconstructed geometry exist only in memory / an optional external QA cache.

Requires Python 3, numpy, scipy and VTK 9.3+ (official packages). See the generated
anatomy-data/README.md for the precise decoder contract and evidence limitations.
"""
from __future__ import annotations
import argparse
import concurrent.futures
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import time
import zipfile

import numpy as np
from scipy.fft import dctn, idctn
import vtk
from vtk.util.numpy_support import numpy_to_vtk, numpy_to_vtkIdTypeArray, vtk_to_numpy

VERSION = 'bp3d-cosine-sdf-r27-1'
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path('/tmp/anatomy-source-research')
ATTRIBUTION = ('BodyParts3D, © The Database Center for Life Science licensed '
               'under CC Attribution 4.0 International')
LICENSE_URL = 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html'
DOWNLOAD_URL = 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html'
vtk.vtkLogger.SetStderrVerbosity(vtk.vtkLogger.VERBOSITY_WARNING)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def clean_float(x):
    if isinstance(x, np.ndarray):
        return [clean_float(v) for v in x.tolist()]
    if isinstance(x, (list, tuple)):
        return [clean_float(v) for v in x]
    if isinstance(x, dict):
        return {k: clean_float(v) for k, v in x.items()}
    if isinstance(x, (float, np.floating)):
        return round(float(x), 9)
    if isinstance(x, np.integer):
        return int(x)
    return x


def json_write(path, value):
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(clean_float(value), ensure_ascii=False,
                               indent=2, allow_nan=False) + '\n')
    temp.replace(path)


def read_obj(archive, entry):
    raw = archive.read(entry['archiveMember'])
    expected = entry.get('sha256')
    if expected and sha256(raw) != expected:
        raise ValueError(f"Source hash mismatch: {entry['sourceMeshId']}")
    vertices, triangles = [], []
    for line in raw.decode('utf-8').splitlines():
        if line.startswith('v '):
            vertices.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('f '):
            ids = [int(x.split('/')[0]) for x in line.split()[1:]]
            ids = [i-1 if i > 0 else len(vertices)+i for i in ids]
            triangles.extend([[ids[0], ids[i], ids[i+1]]
                              for i in range(1, len(ids)-1)])
    return (np.asarray(vertices, dtype=np.float64),
            np.asarray(triangles, dtype=np.int64), raw)


def make_poly(vertices, faces, orient=True):
    p = vtk.vtkPolyData()
    pts = vtk.vtkPoints()
    pts.SetData(numpy_to_vtk(np.ascontiguousarray(vertices), deep=True))
    p.SetPoints(pts)
    packed = np.hstack((np.full((len(faces), 1), 3, dtype=np.int64), faces))
    cells = vtk.vtkCellArray()
    cells.SetCells(len(faces), numpy_to_vtkIdTypeArray(packed.ravel(), deep=True))
    p.SetPolys(cells)
    clean = vtk.vtkCleanPolyData()
    clean.SetInputData(p)
    clean.Update()
    p = clean.GetOutput()
    if orient:
        normals = vtk.vtkPolyDataNormals()
        normals.SetInputData(p)
        normals.ConsistencyOn()
        normals.AutoOrientNormalsOn()
        normals.SplittingOff()
        normals.Update()
        p = normals.GetOutput()
    result = vtk.vtkPolyData()
    result.DeepCopy(p)
    return result


def arrays(poly):
    vertices = vtk_to_numpy(poly.GetPoints().GetData()).astype(np.float64)
    faces = vtk_to_numpy(poly.GetPolys().GetData()).reshape(-1, 4)[:, 1:]
    return vertices, faces


def area_frame(vertices, faces):
    """Area-weighted PCA, independent of teacher's nonuniform tessellation."""
    tri = vertices[faces]
    area = np.linalg.norm(np.cross(tri[:, 1]-tri[:, 0],
                                   tri[:, 2]-tri[:, 0]), axis=1) / 2
    total = float(area.sum())
    centers = tri.mean(axis=1)
    origin = np.sum(centers * area[:, None], axis=0) / total
    delta = tri-origin
    summed = delta.sum(axis=1)
    second = (np.einsum('tvi,tvj->tij', delta, delta)
              + np.einsum('ti,tj->tij', summed, summed)) / 12
    covariance = np.sum(second * area[:, None, None], axis=0) / total
    eigenvalues, basis = np.linalg.eigh(covariance)
    order = np.argsort(eigenvalues)[::-1]
    basis = basis[:, order]
    for axis in range(2):
        if basis[np.argmax(np.abs(basis[:, axis])), axis] < 0:
            basis[:, axis] *= -1
    basis[:, 2] = np.cross(basis[:, 0], basis[:, 1])
    return origin, basis, eigenvalues[order], total


def topology(poly):
    if not poly.GetNumberOfPoints():
        return {'components': 0, 'vertices': 0, 'triangles': 0,
                'boundaryEdges': 0, 'nonManifoldEdges': 0, 'euler': 0,
                'closedOrientableGenusSum': 0}
    v, faces = arrays(poly)
    unique = np.unique(faces)
    edges = np.sort(np.vstack((faces[:, [0, 1]], faces[:, [1, 2]],
                                faces[:, [2, 0]])), axis=1)
    edges, counts = np.unique(edges, axis=0, return_counts=True)
    conn = vtk.vtkPolyDataConnectivityFilter()
    conn.SetInputData(poly)
    conn.SetExtractionModeToAllRegions()
    conn.Update()
    c = conn.GetNumberOfExtractedRegions()
    euler = len(unique)-len(edges)+len(faces)
    boundary = int(np.sum(counts == 1))
    nonmanifold = int(np.sum(counts > 2))
    genus = (2*c-euler)/2 if boundary == 0 and nonmanifold == 0 else None
    return {'components': c, 'vertices': len(v), 'triangles': len(faces),
            'boundaryEdges': boundary, 'nonManifoldEdges': nonmanifold,
            'euler': euler, 'closedOrientableGenusSum': genus}


def implicit(poly):
    result = vtk.vtkImplicitPolyDataDistance()
    result.SetInput(poly)
    return result


def distances(poly, points, absolute=True):
    if not len(points):
        return np.zeros(0)
    d = implicit(poly)
    out = vtk.vtkDoubleArray()
    d.EvaluateFunction(numpy_to_vtk(np.ascontiguousarray(points), deep=True), out)
    values = vtk_to_numpy(out)
    return np.abs(values) if absolute else values


def sample_field(poly, lo, hi, grid, force_parity=False):
    spacing = (hi-lo)/grid
    sampler = vtk.vtkSampleFunction()
    sampler.SetImplicitFunction(implicit(poly))
    sampler.SetModelBounds(*np.column_stack((lo+spacing/2,
                                            hi-spacing/2)).ravel())
    sampler.SetSampleDimensions(*[int(x) for x in grid])
    sampler.ComputeNormalsOff()
    sampler.SetOutputScalarTypeToDouble()
    sampler.Update()
    values = vtk_to_numpy(sampler.GetOutput().GetPointData().GetScalars()).reshape(
        tuple(grid), order='F').copy()
    sign_method = 'angle-weighted-pseudonormal'
    if force_parity or boundary_min(values) <= 0:
        # Multi-component source normals can disagree even after VTK normal
        # orientation. Correct inside/outside using closed-surface scanline
        # parity, preserving the true triangle-distance magnitude. This is
        # NOT an artificial bounding-box clip or a dilation of the bone.
        stencil = vtk.vtkPolyDataToImageStencil()
        stencil.SetInputData(poly)
        stencil.SetOutputOrigin(*(lo+spacing/2))
        stencil.SetOutputSpacing(*spacing)
        stencil.SetOutputWholeExtent(0, int(grid[0])-1, 0,
                                     int(grid[1])-1, 0, int(grid[2])-1)
        stencil.SetTolerance(0.)
        stencil.Update()
        mask = vtk.vtkImageStencilToImage()
        mask.SetInputConnection(stencil.GetOutputPort())
        mask.SetInsideValue(1)
        mask.SetOutsideValue(0)
        mask.SetOutputScalarTypeToUnsignedChar()
        mask.Update()
        inside = vtk_to_numpy(mask.GetOutput().GetPointData().GetScalars()).reshape(
            tuple(grid), order='F').astype(bool)
        values = np.where(inside, -np.abs(values), np.abs(values))
        sign_method = 'closed-surface-scanline-parity'
    return values, sign_method


def cosine_weights(field):
    # scipy's forward DCT-II has 1/N normalization. Each nonzero frequency
    # receives a factor 2, so stored weights directly multiply cos(pi*k*t).
    coeff = dctn(field, norm='forward')
    coeff[1:, :, :] *= 2
    coeff[:, 1:, :] *= 2
    coeff[:, :, 1:] *= 2
    scale = float(np.max(np.abs(coeff)) / 32760)
    quantized = np.rint(coeff/scale).astype('<i2')
    return quantized, scale


def decode(quantized, scale, target_grid=None):
    coeff = quantized.astype(np.float64)*scale
    if target_grid is not None:
        shape = tuple(int(x) for x in target_grid)
        projected = np.zeros(shape)
        cut = tuple(slice(0, min(a, b)) for a, b in zip(shape, coeff.shape))
        projected[cut] = coeff[cut]
        coeff = projected
    coeff[1:, :, :] /= 2
    coeff[:, 1:, :] /= 2
    coeff[:, :, 1:] /= 2
    return idctn(coeff, norm='forward')


def contour(field, lo, hi, iso=0):
    image = vtk.vtkImageData()
    shape = np.asarray(field.shape)
    spacing = (hi-lo)/shape
    image.SetDimensions(*[int(x) for x in shape])
    image.SetOrigin(*(lo+spacing/2))
    image.SetSpacing(*spacing)
    image.GetPointData().SetScalars(numpy_to_vtk(
        np.ascontiguousarray(field.ravel(order='F')), deep=True))
    contours = vtk.vtkFlyingEdges3D()
    contours.SetInputData(image)
    contours.SetValue(0, iso)
    contours.ComputeNormalsOff()
    contours.ComputeGradientsOff()
    contours.Update()
    result = vtk.vtkPolyData()
    result.DeepCopy(contours.GetOutput())
    return result


def summary(values):
    values = np.asarray(values)
    if not len(values):
        return {'count': 0, 'rms': None, 'mean': None, 'p50': None,
                'p95': None, 'p99': None, 'max': None}
    return {'count': len(values), 'rms': float(np.sqrt(np.mean(values**2))),
            'mean': float(np.mean(values)), 'p50': float(np.quantile(values, .5)),
            'p95': float(np.quantile(values, .95)),
            'p99': float(np.quantile(values, .99)), 'max': float(np.max(values))}


def area_samples(vertices, faces, n, seed):
    rng = np.random.default_rng(seed)
    tri = vertices[faces]
    areas = np.linalg.norm(np.cross(tri[:, 1]-tri[:, 0],
                                    tri[:, 2]-tri[:, 0]), axis=1)
    selected = rng.choice(len(tri), n, p=areas/areas.sum())
    a, b = rng.random((2, n))
    a = np.sqrt(a)
    w = np.stack((1-a, a*(1-b), a*b), axis=1)
    return np.einsum('tvi,tv->ti', tri[selected], w)


def residuals(source, reconstructed, sample_count=4096):
    if not reconstructed.GetNumberOfPoints():
        raise ValueError('Implicit function has no zero set')
    sv, sf = arrays(source)
    rv, rf = arrays(reconstructed)
    # All teacher vertices and deterministic area samples are checked against
    # actual output triangles; this is not a nearest-vertex distance metric.
    sv_error = distances(reconstructed, sv)
    source_area_error = distances(reconstructed,
                                 area_samples(sv, sf, sample_count, 113))
    rv_error = distances(source, rv)
    output_area_error = distances(source,
                                 area_samples(rv, rf, sample_count, 227))
    source_mass = vtk.vtkMassProperties()
    source_mass.SetInputData(source)
    output_mass = vtk.vtkMassProperties()
    output_mass.SetInputData(reconstructed)
    source_volume = source_mass.GetVolume()
    output_volume = output_mass.GetVolume()
    return {'distanceUnit': 'mm',
            'sourceVerticesToContour': summary(sv_error),
            'sourceAreaToContour': summary(source_area_error),
            'contourVerticesToSource': summary(rv_error),
            'contourAreaToSource': summary(output_area_error),
            'sampledSymmetricMaxMm': float(max(sv_error.max(),
                     source_area_error.max(), rv_error.max(), output_area_error.max())),
            'sourceAreaWithin1MmFraction': float(np.mean(source_area_error <= 1)),
            'sourceAreaWithin2MmFraction': float(np.mean(source_area_error <= 2)),
            'sourceVolumeMm3': source_volume, 'contourVolumeMm3': output_volume,
            'volumeRatio': output_volume/source_volume if source_volume else None}



def measure_lods(q, scale, source, lo, hi, existing=None):
    grid = np.asarray(q.shape)
    thin_axis = int(np.argmin(hi-lo))
    half = np.maximum(8, grid//2)
    quarter = np.maximum(8, grid//4)
    thin_half = half.copy()
    thin_half[thin_axis] = grid[thin_axis]
    long_half = grid.copy()
    long_half[int(np.argmax(hi-lo))] //= 2
    long_half = np.maximum(8, long_half)
    result = list(existing or [])
    done = {tuple(lod['grid']) for lod in result}
    for kind, lod_grid in [('uniform-half', half), ('uniform-quarter', quarter),
                           ('retain-thin-axis', thin_half),
                           ('halve-long-axis', long_half)]:
        if tuple(lod_grid) in done or np.array_equal(lod_grid, grid):
            continue
        done.add(tuple(lod_grid))
        lod_contour = contour(decode(q, scale, lod_grid), lo, hi)
        if not lod_contour.GetNumberOfPoints():
            result.append({'kind': kind, 'grid': lod_grid.tolist(), 'empty': True})
            continue
        result.append({'kind': kind, 'grid': lod_grid.tolist(), 'empty': False,
                       'metrics': residuals(source, lod_contour, sample_count=2048),
                       'topology': topology(lod_contour)})
    return result


def preview_grid(meta):
    source = meta['sourceTopology']
    chosen = {'grid': meta['grid'], 'topology': meta['contourTopology']}
    for lod in meta['lods']:
        if lod.get('empty'):
            continue
        topo, metrics = lod['topology'], lod['metrics']
        if (topo['components'] == source['components']
            and topo['euler'] == source['euler']
            and topo['boundaryEdges'] == 0 and topo['nonManifoldEdges'] == 0
            and metrics['sourceAreaToContour']['p95'] <= .65
            and metrics['sourceAreaWithin2MmFraction'] >= .995
            and metrics['sourceVerticesToContour']['p95'] <= 1.5
            and .9 <= metrics['volumeRatio'] <= 1.1
            and topo['triangles'] < chosen['topology']['triangles']):
            chosen = lod
    return chosen['grid'], chosen['topology']['triangles']


def initial_grid(entry, extents, quality):
    name, region = entry['name'], entry['region']
    longest = float(np.max(extents))
    # These are shared atlas-level approximation tolerances, not per-character
    # bone anatomy dimensions. The source domain remains reversible and exact.
    if region == 'skull_neck':
        target = 128 if longest > 60 else 64
    elif 'scapula' in name or region == 'pelvis':
        target = 128
    elif region == 'spine':
        target = 128 if name in ('sacrum', 'atlas', 'axis') else 64
    elif 'rib' in name:
        target = 128
    elif region in ('lower_limb', 'upper_limb'):
        target = 128 if longest > 130 else 64
    else:
        target = 64
    target = max(16, int(target*quality))
    target = int(2**round(math.log2(target)))
    ratios = (extents + 6*longest/target) / (longest + 6*longest/target)
    return np.maximum(16, 2**np.rint(np.log2(target*ratios)).astype(int))


def boundary_min(field):
    return float(min(np.min(field[0]), np.min(field[-1]),
                     np.min(field[:, 0]), np.min(field[:, -1]),
                     np.min(field[:, :, 0]), np.min(field[:, :, -1])))


def compile_one(job):
    entry, archive_path, cache_path, quality, max_axis, force = job
    id = entry['sourceMeshId']
    cache = Path(cache_path)
    cache.mkdir(parents=True, exist_ok=True)
    meta_path, coeff_path = cache/(id+'.json'), cache/(id+'.npy')
    key = f'{VERSION}:{entry["sha256"]}:{quality}:{max_axis}'
    if meta_path.exists() and coeff_path.exists() and not force:
        meta = json.loads(meta_path.read_text())
        if (meta.get('compilerCacheKey') == key and meta.get('boundaryMinimumMm', -1) > 0
                and (meta.get('sourceTopology', {}).get('components', 1) == 1
                     or meta.get('signedDistanceSignMethod') == 'closed-surface-scanline-parity')):
            if meta.get('lodPolicy') != 'anisotropic-thin-axis-1':
                with zipfile.ZipFile(archive_path) as archive:
                    v, f, _ = read_obj(archive, entry)
                local = (v-np.asarray(meta['originMm']))@np.asarray(meta['basisAxes']).T
                source = make_poly(local, f)
                q = np.load(coeff_path, allow_pickle=False)
                meta['lods'] = measure_lods(q, meta['quantScaleMm'], source,
                    np.asarray(meta['domainMinMm']), np.asarray(meta['domainMaxMm']),
                    existing=meta['lods'])
                meta['lodPolicy'] = 'anisotropic-thin-axis-1'
                meta['recommendedPreviewGrid'], meta['previewContourTriangles'] = preview_grid(meta)
                json_write(meta_path, meta)
            return meta, str(coeff_path), True
    started = time.time()
    with zipfile.ZipFile(archive_path) as archive:
        v, f, raw = read_obj(archive, entry)
    global_poly = make_poly(v, f)
    v, f = arrays(global_poly)
    origin, basis, eigenvalues, surface_area = area_frame(v, f)
    local_vertices = (v-origin)@basis
    source = make_poly(local_vertices, f)
    source_topology = topology(source)
    extents = np.ptp(local_vertices, axis=0)
    grid = initial_grid(entry, extents, quality)
    # Fixed domain through adaptive refinements, so every frequency retains
    # exactly the same coordinate definition.
    padding = np.maximum(2., 3*extents/grid)
    lo = local_vertices.min(axis=0)-padding
    hi = local_vertices.max(axis=0)+padding
    rounds, warnings = [], []
    accepted = None
    for iteration in range(3):
        if np.max(grid) > max_axis:
            break
        raw_field, sign_method = sample_field(source, lo, hi, grid,
                                                     force_parity=source_topology['components'] > 1)
        q, scale = cosine_weights(raw_field)
        field = decode(q, scale)
        reconstruction = contour(field, lo, hi)
        if not reconstruction.GetNumberOfPoints():
            grid *= 2
            continue
        metrics = residuals(source, reconstruction)
        fitted_topology = topology(reconstruction)
        rms_field = float(np.sqrt(np.mean((field-raw_field)**2)))
        this = {'grid': grid.tolist(), 'metrics': metrics,
                'topology': fitted_topology, 'quantizationRmsMm': rms_field,
                'boundaryMinimumMm': boundary_min(field), 'signMethod': sign_method}
        rounds.append(this)
        accepted = (q, scale, field, reconstruction, this)
        # A field is an approximation of this teacher, not a medically exact
        # anatomy. A tight surface-coverage test catches disappearing plates.
        area = metrics['sourceAreaToContour']
        target_p95 = .45 if entry['region'] in ('hand', 'foot') else .7
        critical_holes = entry['region'] in ('pelvis', 'spine') or any(
            label in entry['name'] for label in ('sphenoid', 'temporal', 'occipital'))
        major_hole_lost = critical_holes and (source_topology['closedOrientableGenusSum'] or 0) > 0 \
                         and (fitted_topology['closedOrientableGenusSum'] or 0) == 0
        quality_ok = (area['p95'] <= target_p95
                      and metrics['sourceAreaWithin2MmFraction'] >= .998
                      and metrics['contourAreaToSource']['p95'] <= .7
                      and this['boundaryMinimumMm'] > 0 and not major_hole_lost)
        if quality_ok:
            break
        # Refine all axes while bounded, or improve the coarsest physical axes
        # when the longest already reached the declared cap.
        spacing = (hi-lo)/grid
        candidate = grid.copy()
        candidates = np.where(grid < max_axis)[0]
        if not len(candidates):
            break
        cutoff = .7*np.max(spacing[candidates])
        candidate[candidates[spacing[candidates] >= cutoff]] *= 2
        if np.array_equal(candidate, grid):
            break
        grid = candidate
    if accepted is None:
        raise ValueError(f'No nonempty function for {id}')
    q, scale, field, reconstruction, result = accepted
    grid = np.asarray(q.shape)
    if source_topology['boundaryEdges'] or source_topology['nonManifoldEdges']:
        warnings.append('Source is not a closed two-manifold; pseudo-normal signed distance has an ambiguity.')
    if source_topology['closedOrientableGenusSum'] != result['topology']['closedOrientableGenusSum']:
        warnings.append('Small-feature topology differs from source at this finite field resolution; do not claim exact topology preservation.')
    if source_topology['components'] != result['topology']['components']:
        warnings.append('Connected-component count differs from source; fine disconnected source details may merge or disappear.')
    if result['metrics']['sourceAreaWithin2MmFraction'] < .998:
        warnings.append('More than 0.2% of sampled source area is over 2 mm from the fitted contour.')
    lods = measure_lods(q, scale, source, lo, hi)
    metadata = {
        'id': id, 'sourceMeshId': id, 'fmaId': entry['fmaId'],
        'name': entry['name'], 'region': entry['region'], 'side': entry['side'],
        'sourceSha256': sha256(raw), 'sourceGeometrySha256': entry.get('geometrySha256'),
        'sourceArchiveMember': entry['archiveMember'], 'sourceBytes': len(raw),
        'sourceVertices': int(entry['sourceVertices']),
        'sourceFaces': int(entry['sourceFaces']),
        'sourceBBoxMm': [v.min(axis=0).tolist(), v.max(axis=0).tolist()],
        'sourceCentroidMm': origin.tolist(),
        'sourceSurfaceAreaMm2': surface_area, 'sourceTopology': source_topology,
        'originMm': origin.tolist(), 'basisAxes': basis.T.tolist(),
        'pcaEigenvaluesMm2': eigenvalues.tolist(),
        'domainMinMm': lo.tolist(), 'domainMaxMm': hi.tolist(),
        'modes': grid.tolist(), 'grid': grid.tolist(), 'isoMm': 0,
        'quantScaleMm': scale, 'coefficientCount': int(q.size),
        'nonzeroCoefficientCount': int(np.count_nonzero(q)),
        'metrics': result['metrics'], 'contourTopology': result['topology'],
        'quantizationRmsMm': result['quantizationRmsMm'],
        'signedDistanceSignMethod': result['signMethod'],
        'boundaryMinimumMm': result['boundaryMinimumMm'],
        'lods': lods, 'lodPolicy': 'anisotropic-thin-axis-1', 'warnings': warnings,
        'fitAttempts': [{k: r[k] for k in ('grid', 'quantizationRmsMm',
                       'boundaryMinimumMm')} | {'sourceAreaP95Mm':
                       r['metrics']['sourceAreaToContour']['p95']} for r in rounds],
        'compilerCacheKey': key,
        'compilationSeconds': time.time()-started,
    }
    metadata['recommendedPreviewGrid'], metadata['previewContourTriangles'] = preview_grid(metadata)
    np.save(coeff_path, q)
    json_write(meta_path, metadata)
    return metadata, str(coeff_path), False


def write_deliverable(output, manifest, results, archive_path, manifest_path, started):
    output.mkdir(parents=True, exist_ok=True)
    blob = bytearray()
    bones = []
    for meta, path, cached in results:
        meta = dict(meta)
        q = np.load(path, allow_pickle=False)
        meta['coefficientOffset'] = len(blob)//2
        # Fortran flatten on [x,y,z] gives x-fast runtime indexing.
        blob.extend(q.astype('<i2').tobytes(order='F'))
        meta.pop('compilerCacheKey', None)
        meta.setdefault('signedDistanceSignMethod', 'angle-weighted-pseudonormal')
        bones.append(meta)
    compressed = gzip.compress(bytes(blob), compresslevel=9, mtime=0)
    coefficient_path = output/'bone-fields.i16.gz'
    coefficient_path.write_bytes(compressed)
    duplicate_entries = [m for m in manifest['meshes'] if m.get('duplicateOf')]
    atlas = {
        'schema': VERSION, 'representation': 'tensor-cosine-implicit-surface',
        'coefficientEncoding': 'gzip little-endian signed int16; x-frequency fastest',
        'coefficientFile': coefficient_path.name,
        'coefficientCount': len(blob)//2, 'coefficientBytes': len(blob),
        'coefficientGzipBytes': len(compressed),
        'coefficientSha256': sha256(bytes(blob)),
        'coefficientGzipSha256': sha256(compressed),
        'units': 'mm', 'fieldUnit': 'mm', 'isoConvention': 'inside: f < isoMm',
        'sampleConvention': 'cell-center: t=(i+0.5)/N',
        'function': 'f(p)=sum(q[kx,ky,kz]*quantScaleMm*cos(pi*kx*tx)*cos(pi*ky*ty)*cos(pi*kz*tz))',
        'coordinateTransform': 'local_j=dot(sourceMm-originMm,basisAxes[j]); t_j=(local_j-domainMinMm[j])/(domainMaxMm[j]-domainMinMm[j])',
        'globalTransform': 'sourceMm=originMm+sum(local_j*basisAxes[j]); threeMeter=[sourceX,sourceZ,-sourceY]*0.001',
        'sourceAxes': manifest['axes'],
        'dataset': manifest['dataset'], 'license': 'CC-BY-4.0',
        'licenseUrl': LICENSE_URL, 'licenseVerifiedDate': '2026-10-04',
        'licenseUpdatedDate': '2025-02-27', 'attribution': ATTRIBUTION,
        'sourceUrl': DOWNLOAD_URL,
        'sourceArchiveName': Path(archive_path).name,
        'sourceArchiveSha256': sha256(Path(archive_path).read_bytes()),
        'sourceSelectionManifestSha256': sha256(Path(manifest_path).read_bytes()),
        'modifications': ['Deduplicated identical hyoid source surfaces',
                         'Area-weighted PCA domains with reversible source coordinates',
                         'Offline signed-distance fitting with DCT-II function coefficients',
                         'Int16 amplitude quantization and finite-resolution contour reconstruction'],
        'sourceSelectedElements': manifest.get('selectedSourceMeshCount'),
        'uniqueSurfaceCount': len(bones),
        'duplicateSourceElements': duplicate_entries,
        'missingSourceElements': manifest.get('missingMeshes', []),
        'limitations': manifest.get('limitations', []) + [
            'An atlas fitted to an external character is an estimated internal anatomy, not that character\'s measured bone anatomy.',
            'No cartilage, ligaments, measured joint centers, muscles, or subject-specific medical data are provided.',
            'Cosine truncation, quantization and finite contour sampling introduce measured geometric error and may alter very fine topology.',
            'Fit errors measure agreement with the source atlas, not biological or clinical accuracy.',
            'Sampled symmetric maximum is a tested finite-sample distance, not a proven continuous Hausdorff bound.',
            'Skull and ethmoid source surfaces contain separate fragments and extremely thin details; topology differences are individually disclosed.',
            'No source triangles, source OBJ vertex arrays, signed-distance sample arrays or generated contour vertices are shipped.'],
        'compiler': {'path': 'tools/compile-bone-fields.py', 'version': VERSION,
                     'sha256': sha256(Path(__file__).read_bytes()),
                     'numpy': np.__version__, 'vtk': vtk.vtkVersion.GetVTKVersion(),
                     'seconds': time.time()-started},
        'bones': bones,
    }
    json_write(output/'bone-fields.json', atlas)
    areas = [b['metrics']['sourceAreaToContour']['p95'] for b in bones]
    report = {'schema': VERSION, 'sourceElements': manifest.get('selectedSourceMeshCount'),
              'uniqueFittedSurfaces': len(bones), 'sourceArchiveSha256': atlas['sourceArchiveSha256'],
              'coefficientGzipSha256': atlas['coefficientGzipSha256'],
              'compilerSha256': atlas['compiler']['sha256'],
              'coefficientGzipBytes': len(compressed), 'coefficientDecodedBytes': len(blob),
              'sourceGeometryPersisted': False, 'sampleFieldsPersisted': False,
              'generatedVerticesPersisted': False,
              'totalFullResolutionContourTriangles': sum(b['contourTopology']['triangles'] for b in bones),
              'totalRecommendedPreviewContourTriangles': sum(b['previewContourTriangles'] for b in bones),
              'previewRule': 'source component count and Euler match; zero boundary/nonmanifold; area p95<=0.65mm; area within2mm>=0.995; vertex p95<=1.5mm; volume ratio0.9..1.1; otherwise full grid',
              'perBoneSourceAreaP95Mm': summary(areas),
              'worstSampledSymmetricMaxMm': max(b['metrics']['sampledSymmetricMaxMm'] for b in bones),
              'warnings': [{'id': b['id'], 'name': b['name'], 'warnings': b['warnings']} for b in bones if b['warnings']],
              'measures': 'Triangle-surface distances: every source and reconstruction vertex plus seeded area-uniform surface samples; topology from triangle incidence.',
              'evidenceBoundary': 'Offline numeric validation only; no claim of medical validity, runtime visual acceptance, or subject-specific exactness.'}
    json_write(output/'fit-report.json', report)
    print(json.dumps(clean_float(report), ensure_ascii=False, indent=2), flush=True)


def verify(output):
    atlas = json.loads((output/'bone-fields.json').read_text())
    compressed = (output/atlas['coefficientFile']).read_bytes()
    raw = gzip.decompress(compressed)
    assert sha256(compressed) == atlas['coefficientGzipSha256']
    assert sha256(raw) == atlas['coefficientSha256']
    assert len(raw) == atlas['coefficientBytes']
    packed = np.frombuffer(raw, dtype='<i2')
    offset = 0
    for bone in atlas['bones']:
        assert bone['coefficientOffset'] == offset
        count = bone['coefficientCount']
        grid = np.asarray(bone['grid'])
        assert np.all((grid & (grid-1)) == 0), bone['id']
        assert np.prod(bone['modes']) == count
        q = packed[offset:offset+count].reshape(tuple(bone['modes']), order='F')
        assert np.count_nonzero(q) == bone['nonzeroCoefficientCount']
        axes = np.asarray(bone['basisAxes'])
        assert np.max(abs(axes@axes.T-np.eye(3))) < 1e-6
        assert np.linalg.det(axes) > .999999
        field = decode(q, bone['quantScaleMm'])
        assert np.isfinite(field).all()
        assert field.min() < 0 < field.max(), bone['id']
        assert boundary_min(field) > 0, bone['id']
        offset += count
    assert offset == len(packed)
    print(json.dumps({'verified': True, 'surfaces': len(atlas['bones']),
                      'coefficients': offset, 'gzipBytes': len(compressed),
                      'hash': atlas['coefficientGzipSha256']}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, default=DEFAULT_SOURCE/'partof_BP3D_4.0_obj_99.zip')
    parser.add_argument('--manifest', type=Path, default=DEFAULT_SOURCE/'skeleton_202_manifest.json')
    parser.add_argument('--output', type=Path, default=ROOT/'anatomy-data')
    parser.add_argument('--cache', type=Path, default=Path('/tmp/bp3d-cosine-field-cache'))
    parser.add_argument('--only', nargs='*', help='Optional source mesh IDs for development')
    parser.add_argument('--jobs', type=int, default=2)
    parser.add_argument('--quality', type=float, default=1.)
    parser.add_argument('--max-axis', type=int, default=256)
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--verify', action='store_true', help='Check shipped data without source meshes')
    args = parser.parse_args()
    if args.verify:
        verify(args.output)
        return
    manifest = json.loads(args.manifest.read_text())
    entries = [e for e in manifest['meshes'] if not e.get('duplicateOf')
               and (not args.only or e['sourceMeshId'] in args.only)]
    jobs = [(e, str(args.archive), str(args.cache), args.quality,
             args.max_axis, args.force) for e in entries]
    started = time.time()
    results = {}
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.jobs) as pool:
        futures = {pool.submit(compile_one, j): j[0] for j in jobs}
        for future in concurrent.futures.as_completed(futures):
            entry = futures[future]
            try:
                result = future.result()
            except Exception as error:
                print(f"ERROR {entry['sourceMeshId']} {entry['name']}: {error}", file=sys.stderr, flush=True)
                raise
            results[entry['sourceMeshId']] = result
            meta, path, cached = result
            print(f"{len(results):3d}/{len(jobs)} {meta['id']} {meta['name']}: "
                  f"{meta['grid']} p95={meta['metrics']['sourceAreaToContour']['p95']:.3f} mm "
                  f"tri={meta['contourTopology']['triangles']} cached={cached}", flush=True)
    ordered = [results[e['sourceMeshId']] for e in entries]
    write_deliverable(args.output, manifest, ordered, args.archive, args.manifest, started)
    verify(args.output)


if __name__ == '__main__':
    main()
