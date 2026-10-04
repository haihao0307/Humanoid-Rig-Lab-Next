# BodyParts3D anatomical bone function fields (R27)

This directory contains **implicit generating functions and their coefficients**,
not an anatomical mesh bundle. The original BodyParts3D OBJ files are an offline
teacher only. Runtime triangles are newly generated from the cosine fields.

## Files and provenance

- `bone-fields.json`: source identities, reversible PCA frames, cosine-basis
  dimensions and offsets, source hashes, license, omitted parts and fit evidence
- `bone-fields.i16.gz`: gzip-compressed signed 16-bit **function amplitudes**
- `fit-report.json`: aggregate offline numeric validation and explicit warnings
- `SOURCE-LICENSE.md`: attribution, license and the meaning of this derivative
- `../tools/compile-bone-fields.py`: reproducible offline compiler and verifier

The teacher is the official BodyParts3D 4.0 PART-OF OBJ 99 archive, selected through
IS-A `FMA5018` (bone organ), plus three sternum parts. The downloaded source
selection has 202 labeled elements and 201 unique surfaces after the identical
hyoid surfaces `FJ2772` / `FJ3201` are deduplicated. Those counts are **not an
assertion that this asset contains 206 anatomical bones**. The full JSON records
four foot sesamoid elements absent from the PART-OF archive, lack of explicitly
labeled ear ossicles or coccyx, and the three-piece sternum.

BodyParts3D is an anatomical reference atlas. It is not a validated canonical
person and it does not reveal the actual hidden anatomy of an external character.
Deforming these functions into a surface-derived skeleton remains an estimated
atlas fit. Cartilage, ligaments, measured joint centers and subject-specific
medical anatomy are not provided. Source inaccuracies are inherited.

## Runtime decoding contract

All field distances and source coordinates are in **millimeters**. A bone contains:

- `originMm`: area-weighted source surface centroid in the original atlas frame
- `basisAxes`: three orthonormal local axes, each a vector in the source frame
- `domainMinMm`, `domainMaxMm`: finite domain in that local frame
- `grid` and `modes`: `[nx, ny, nz]`, all powers of two in the released full fit
- `coefficientOffset`, `coefficientCount`: offset and length in the **decoded
  int16 element array**, not byte offsets
- `quantScaleMm`: amplitude represented by one signed integer
- `isoMm`: zero for this release; inside means `f < isoMm`

Decompress gzip and read little-endian signed int16. The frequency index is:

```text
index(kx, ky, kz) = coefficientOffset + (kz * ny + ky) * nx + kx
local[j] = dot(sourceMm - originMm, basisAxes[j])
t[j] = (local[j] - domainMinMm[j]) / (domainMaxMm[j] - domainMinMm[j])
f(local) = sum(q[kx,ky,kz] * quantScaleMm
             * cos(pi*kx*t[0]) * cos(pi*ky*t[1]) * cos(pi*kz*t[2]))
```

These are **direct cosine amplitudes**, not unmodified orthonormal DCT outputs.
The compiler uses SciPy forward-normalized DCT-II and multiplies by two for each
nonzero frequency axis. To use SciPy `idctn(..., norm='forward')`, divide amplitudes
by two on each nonzero frequency axis first. A separable FFT implementation must
use the equivalent normalization. No sampled SDF values are stored.

Full-fit samples lie at cell centers: `t = (i + 0.5) / N`. The physical sample
spacing is `(domainMaxMm-domainMinMm)/N`, and its first sample is `domainMinMm +
spacing/2`. Using endpoint-centered samples or dividing by `N-1` changes the field
and invalidates the measured residuals. Polygonize `f=0` between samples.

Convert generated local coordinates reversibly to the source:

```text
sourceMm = originMm + sum(local[j] * basisAxes[j])
threeMeters = [sourceMm.x, sourceMm.z, -sourceMm.y] * 0.001
```

Source axes are +X left, +Y posterior, +Z superior. Runtime fitting into the
external character is a separate transform owned by the inverse-anatomy system.

A lower-resolution LOD truncates high-frequency coefficients and evaluates the
remaining **unchanged amplitudes** at that LOD's own cell centers. Each bone's
`lods` has measured errors and topology for half and quarter grids, a half grid
that retains the thinnest local axis, and a grid that halves only the longest
local axis. Duplicate grids are omitted. `recommendedPreviewGrid` chooses the
smallest measured contour that matches the source component count and Euler
characteristic, has no boundary/nonmanifold edges, area p95 ≤0.65 mm, at least
99.5% sampled area within 2 mm, vertex p95 ≤1.5 mm, and volume ratio 0.9–1.1. If
none qualifies, it retains the full grid; full source-topology differences
remain disclosed rather than being hidden by that fallback. Do not assume
that the same downsampling factor is safe for every bone: thin scapulae and skull
plates can lose coverage or develop holes. Full modes remain available for
inspection. A low geometric residual alone does not prove exact topology.

## Compilation and validation

Use official packages `numpy`, `scipy`, `vtk` (tested with VTK 9.3.1). Source
archives and resumable cache stay outside the repository.

```sh
python New-Human-Production/R008/tools/compile-bone-fields.py \
  --archive /path/to/partof_BP3D_4.0_obj_99.zip \
  --manifest /path/to/skeleton_202_manifest.json --jobs 3
python New-Human-Production/R008/tools/compile-bone-fields.py --verify
```

`--verify` needs no source mesh. It checks payload hashes, int16 offsets/counts,
power-of-two grids, orthonormal right-handed frames, finite fields, nonempty
interiors and positive outer sample boundaries. Full compilation checks source
hashes before parsing.

The compiler cleans duplicate points and consistently orients source triangles,
constructs an area-weighted PCA frame, samples VTK triangle distance, fits a
tensor cosine polynomial and quantizes its amplitudes. Single-component sources
use angle-weighted-pseudonormal sign. Multi-component sources, or a sign that
is negative on the exterior domain boundary, use closed-surface scanline parity
for inside/outside while retaining the exact triangle-distance magnitude.
It adaptively increases inadequate field resolution within a declared cap.
No artificial shell offset or positive isovalue thickening is applied.

An initial nearest-normal-only method was rejected by the exterior-boundary
check: the multi-component sternum and several phalanges produced spurious
outside sheets. Closed-surface scanline sign resolves that failure. Merely
increasing sampling density or clipping those sheets at the domain boundary
would not have fixed the underlying inside/outside error.

Residuals are distances to **triangle surfaces**, not nearest source vertices.
Checks include every source vertex, every contour vertex, and deterministic
area-uniform samples in both directions. Reported maximum distances are sampled
values, not mathematically proven Hausdorff bounds. Source and output topology
(component count, boundary/nonmanifold edges, Euler characteristic and total genus
when applicable) are recorded separately. Very fine features can merge or vanish;
those differences remain explicit warnings, not claims of equivalence.

These checks establish offline agreement with this atlas only. They do not
validate runtime deformation, character-specific biological accuracy, animation
or appearance. Runtime and publication checks belong to the parent workbench
verification, and must use the actual current source.

## Real 3D delivery gate

- [x] No generated images replace a real 3D implementation
- [x] Production function-compiler code and parameter data have been added
- [ ] User-facing interactive 3D workbench integration verified separately
- [ ] Anatomy, character geometry and motion verified in the actual runtime
- [ ] Camera, selection, animation and parameter controls verified separately
- [ ] Public fixed link and actual browser verified separately
- [x] Screenshots alone do not satisfy the delivery requirement
