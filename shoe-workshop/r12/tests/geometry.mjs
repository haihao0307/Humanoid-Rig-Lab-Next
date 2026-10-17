import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { buildStyle, STYLES } from '../src/model.mjs';

// Independent CPU geometry checks against TASK_ANCHOR. This does not render,
// simulate material forces, certify fit, or turn design millimetres into measurements.
// Build first: node tools/build.mjs && node tests/geometry.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(root, '../..');
const anchor = JSON.parse(fs.readFileSync(path.join(root, 'TASK_ANCHOR.json'), 'utf8'));
const manifestPath = path.join(root, 'BUILD_MANIFEST.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
const sourceCommit = process.env.GITHUB_SHA || process.env.SOURCE_COMMIT || manifest?.sourceCommit || 'local-r12';
const results = [], caseMetrics = [], rayMaterial = new T.MeshBasicMaterial({ side: T.DoubleSide });
let generatedCases = 0;
const upperIds = {
  penny: 'penny-galosh', chelsea: 'chelsea-whole-vamp',
  monk: 'monk-integral-vamp-tongue', canvas: 'canvas-rounded-vamp'
};
const requiredParts = {
  penny: ['penny-galosh', 'penny-apron', 'penny-saddle', 'collar-bound-edge', 'outsole', 'insole', 'stacked-heel'],
  chelsea: ['chelsea-whole-vamp', 'chelsea-back-quarter', 'chelsea-gore--1', 'chelsea-gore-1', 'chelsea-top-binding', 'chelsea-pull-loop', 'outsole', 'stacked-heel'],
  monk: ['monk-integral-vamp-tongue', 'monk-open-quarters', 'monk-overlap-flap', 'monk-perforated-strap-0', 'monk-perforated-strap-1', 'monk-buckle-frame-0', 'monk-buckle-frame-1', 'monk-buckle-prong-0', 'monk-buckle-prong-1', 'monk-buckle-anchor-0', 'monk-buckle-anchor-1', 'monk-toe-cap', 'outsole', 'stacked-heel'],
  canvas: ['canvas-quarter--1', 'canvas-quarter-1', 'canvas-perforated-facing--1', 'canvas-perforated-facing-1', 'canvas-rounded-vamp', 'canvas-independent-tongue', 'foxing--1', 'foxing-1', 'outsole', 'insole']
};

function check(name, fn) {
  try { const detail = fn(); results.push({ name, passed: true, ...(detail ? { detail } : {}) }); return detail; }
  catch (error) { results.push({ name, passed: false, error: error.message }); return null; }
}
const close = (a, b, tolerance, label) => assert.ok(Math.abs(a - b) <= tolerance, `${label}: ${a} vs ${b}, tolerance ${tolerance}`);
const vertex = (g, i) => new T.Vector3().fromBufferAttribute(g.attributes.position, i);
const normal = (g, i) => new T.Vector3().fromBufferAttribute(g.attributes.normal, i).normalize();
const part = (model, id) => { const p = model.parts.find(p => p.id === id); assert.ok(p, `missing actual part ${id}`); return p; };
const boundsOf = g => new T.Box3().setFromBufferAttribute(g.attributes.position);
const sizeOf = g => boundsOf(g).getSize(new T.Vector3()).toArray();

function inspectGeometry(model) {
  const ids = new Set(), actualBounds = new T.Box3(); let triangles = 0;
  for (const p of model.parts) {
    assert.ok(!ids.has(p.id), `duplicate part ${p.id}`); ids.add(p.id);
    const g = p.geometry, positions = g.attributes.position, indices = g.index;
    assert.ok(positions?.count >= 3 && indices?.count >= 3, `${p.id}: empty geometry`);
    assert.equal(indices.count % 3, 0, `${p.id}: incomplete triangles`);
    for (const [name, a] of Object.entries(g.attributes)) {
      assert.equal(a.count, positions.count, `${p.id}/${name}: attribute cardinality`);
      assert.ok(a.array.every(Number.isFinite), `${p.id}/${name}: NaN or infinity`);
    }
    assert.ok(indices.array.every(i => Number.isInteger(i) && i >= 0 && i < positions.count), `${p.id}: invalid vertex reference`);
    const used = new Set(indices.array), normals = g.attributes.normal;
    assert.ok(normals, `${p.id}: missing normals`);
    for (const i of used) {
      const n2 = normals.getX(i) ** 2 + normals.getY(i) ** 2 + normals.getZ(i) ** 2;
      assert.ok(n2 > .5 && n2 < 1.5, `${p.id}: zero/invalid used normal at vertex ${i}, squared length ${n2}`);
    }
    const P = positions.array, I = indices.array; let signedVolume = 0;
    for (let i = 0; i < I.length; i += 3) {
      const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const twiceArea = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      assert.ok(twiceArea > 2e-10, `${p.id}: zero-area triangle ${i / 3}`);
      signedVolume += (P[a] * (uy * vz - uz * vy) + P[a + 1] * (uz * vx - ux * vz) + P[a + 2] * (ux * vy - uy * vx)) / 6;
    }
    if (p.kind === 'sole') {
      assert.ok(signedVolume > 1, `${p.id}: solid has inward winding / negative volume ${signedVolume} mm^3`);
      const incidence = new Map();
      for (let i = 0; i < I.length; i += 3) for (let j = 0; j < 3; j++) {
        const a = I[i + j], b = I[i + (j + 1) % 3], key = Math.min(a, b) + ',' + Math.max(a, b);
        incidence.set(key, (incidence.get(key) ?? 0) + 1);
      }
      assert.ok([...incidence.values()].every(count => count === 2), `${p.id}: solid is not a closed manifold`);
    }
    actualBounds.union(boundsOf(g)); triangles += indices.count / 3;
  }
  requiredParts[model.style.id].forEach(id => part(model, id));
  const dimensions = actualBounds.getSize(new T.Vector3()).toArray();
  assert.ok(dimensions[0] > 65 && dimensions[0] < 180, `implausible generated width ${dimensions[0]} mm`);
  assert.ok(dimensions[1] > 35 && dimensions[1] < 250, `implausible generated height ${dimensions[1]} mm`);
  assert.ok(dimensions[2] > 220 && dimensions[2] < 350, `implausible generated length ${dimensions[2]} mm`);
  model.report.measuredBoundsMm.forEach((v, i) => close(v, dimensions[i], 2e-4, 'reported versus actual geometry bounds'));
  assert.equal(model.report.triangles, triangles, 'reported versus actual triangle count');
  assert.equal(model.report.externalMeshImport, false);
  for (const flag of ['materialCalibrated', 'manufacturingValidated', 'wearerFitValidated', 'forceSolved']) assert.equal(model.report[flag], false, `${flag}: unsupported certification`);
  // Actual exterior sole length, not the configured number or the report alone.
  const soleSize = sizeOf(part(model, 'outsole').geometry);
  if (!model.last.params.bend) close(soleSize[2], model.style.length * model.last.params.length, .003, 'physical outsole length in mm');
  return { id: model.style.id, dimensions, triangles, parts: model.parts.length, soleSize };
}

function measureShellThickness(p) {
  const g = p.geometry, outer = g.groups[0], inner = g.groups[1];
  assert.ok(outer && inner && g.groups[2]?.count > 0, `${p.id}: no separate outer/inner/cut-wall surfaces`);
  const I = g.index.array, offset = I[inner.start] - I[outer.start];
  assert.ok(offset > 0, `${p.id}: inner surface aliases exterior`);
  const used = new Set(I.slice(outer.start, outer.start + outer.count));
  let sum = 0, min = Infinity, max = -Infinity;
  for (const i of used) {
    assert.ok(i + offset < g.attributes.position.count, `${p.id}: inner counterpart missing`);
    const d = vertex(g, i).distanceTo(vertex(g, i + offset));
    min = Math.min(min, d); max = Math.max(max, d); sum += d;
  }
  close(min, p.thicknessMm, .003, `${p.id}: minimum material thickness`);
  close(max, p.thicknessMm, .003, `${p.id}: maximum material thickness`);
  return sum / used.size;
}

// Count loops of the actual exterior sheet. A claimed "hole" that is covered by
// triangles fails this check, even if realHoleCount/realOpening metadata says true.
function exteriorLoops(g) {
  const group = g.groups[0]; assert.ok(group, 'sheet has no identifiable exterior group');
  const I = g.index.array, edges = new Map();
  for (let i = group.start; i < group.start + group.count; i += 3) {
    for (let k = 0; k < 3; k++) {
      const a = I[i + k], b = I[i + (k + 1) % 3], key = Math.min(a, b) + ',' + Math.max(a, b);
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  const adjacent = new Map();
  for (const [key, count] of edges) {
    assert.ok(count <= 2, 'non-manifold exterior edge');
    if (count !== 1) continue;
    const [a, b] = key.split(',').map(Number);
    for (const [from, to] of [[a, b], [b, a]]) { if (!adjacent.has(from)) adjacent.set(from, []); adjacent.get(from).push(to); }
  }
  for (const neighbours of adjacent.values()) assert.equal(neighbours.length, 2, 'aperture boundary branches or ends');
  const seen = new Set(), loops = [];
  for (const start of adjacent.keys()) {
    if (seen.has(start)) continue;
    const todo = [start], vertices = [];
    while (todo.length) { const i = todo.pop(); if (seen.has(i)) continue; seen.add(i); vertices.push(i); todo.push(...adjacent.get(i)); }
    loops.push(vertices);
  }
  return loops;
}

function meshes(parts) { return parts.map(p => { const m = new T.Mesh(p.geometry, rayMaterial); m.name = p.id; return m; }); }
function localRayHits(center, axis, parts, reach = 7) {
  const C = center.clone(), N = axis.clone().normalize();
  return new T.Raycaster(C.addScaledVector(N, reach), N.negate(), 0, reach * 2).intersectObjects(meshes(parts), false);
}
function provePanelExists(p) {
  const g = p.geometry, I = g.index.array;
  const C = vertex(g, I[0]).add(vertex(g, I[1])).add(vertex(g, I[2])).multiplyScalar(1 / 3);
  assert.ok(localRayHits(C, normal(g, I[0]), [p]).length > 0, `${p.id}: positive ray control cannot detect material`);
}
function proveOpenings(p, count, extraParts = []) {
  const loops = exteriorLoops(p.geometry);
  assert.equal(loops.length, count + 1, `${p.id}: expected ${count} real holes plus outside boundary`);
  const apertures = p.geometry.userData.apertures;
  assert.equal(apertures?.length, count, `${p.id}: aperture locations missing`);
  provePanelExists(p);
  for (const [i, a] of apertures.entries()) {
    const hits = localRayHits(new T.Vector3(...a.centre), new T.Vector3(...a.axis), [p, ...extraParts]);
    assert.equal(hits.length, 0, `${p.id}: hole ${i} blocked by ${hits.map(h => h.object.name).join(', ')}`);
  }
}

function checkStructures(model) {
  const id = model.style.id;
  if (id === 'penny') {
    const saddle = part(model, 'penny-saddle'), loops = exteriorLoops(saddle.geometry);
    assert.equal(loops.length, 2, 'penny saddle must have a cutout and an outside boundary');
    const inner = loops.slice().sort((a, b) => a.length - b.length)[0], C = new T.Vector3(), N = new T.Vector3(), holeBounds = new T.Box3();
    for (const i of inner) { const v = vertex(saddle.geometry, i); C.add(v); N.add(normal(saddle.geometry, i)); holeBounds.expandByPoint(v); }
    C.multiplyScalar(1 / inner.length); N.normalize();
    const size = holeBounds.getSize(new T.Vector3());
    assert.ok(size.x > 8 && size.z > 2, 'penny slot has collapsed to a decorative pinhole');
    assert.equal(localRayHits(C, N, [saddle]).length, 0, 'penny saddle slot is capped'); provePanelExists(saddle);
  }
  if (id === 'chelsea') {
    const leather = [part(model, 'chelsea-whole-vamp'), part(model, 'chelsea-back-quarter')];
    assert.ok(model.parts.filter(p => p.role === 'elastic').length === 2, 'Chelsea requires two separate elastic pieces');
    let sampleCount = 0;
    for (const side of [-1, 1]) {
      const gore = part(model, 'chelsea-gore-' + side), g = gore.geometry, b = boundsOf(g), I = g.index.array;
      assert.equal(gore.role, 'elastic'); provePanelExists(gore);
      const h = b.max.y - b.min.y, depth = b.max.z - b.min.z, centerZ = (b.min.z + b.max.z) / 2;
      let tested = 0;
      for (let j = g.groups[0].start; j < g.groups[0].start + g.groups[0].count && tested < 8; j += 99) {
        const C = vertex(g, I[j]), N = normal(g, I[j]);
        if (C.y < b.min.y + .30 * h || C.y > b.min.y + .75 * h || Math.abs(C.z - centerZ) > .15 * depth) continue;
        assert.ok(N.x * side > .5, `${gore.id}: normal does not face outside the shoe`);
        const hits = localRayHits(C, N, leather, 6);
        assert.equal(hits.length, 0, `${gore.id}: elastic area backed by leather at ${C.toArray()}`);
        tested++;
      }
      assert.ok(tested >= 4, `${gore.id}: insufficient independent interior probes`); sampleCount += tested;
    }
    const aperture = part(model, 'chelsea-top-binding').geometry.boundingBox;
    assert.ok(aperture.max.y > 150, 'Chelsea shaft not actually taller than the low shoes');
    return { interiorElasticProbes: sampleCount };
  }
  if (id === 'monk') {
    for (const i of [0, 1]) {
      const strap = part(model, 'monk-perforated-strap-' + i); proveOpenings(strap, 4);
      const frame = part(model, 'monk-buckle-frame-' + i), C = boundsOf(frame.geometry).getCenter(new T.Vector3());
      const N = normal(frame.geometry, frame.geometry.index.array[0]);
      assert.equal(localRayHits(C, N, [frame]).length, 0, `monk buckle ${i}: frame opening is capped`);
      provePanelExists(frame);
    }
  }
  if (id === 'canvas') {
    assert.ok(!model.parts.some(p => p.id === 'stacked-heel' || p.id === 'heel-toplift'), 'canvas shoe incorrectly inherits a separate leather heel');
    const eyes = model.parts.filter(p => p.kind === 'eyelet'); assert.equal(eyes.length, 10, 'canvas must have ten actual eyelets');
    for (const side of [-1, 1]) {
      const facing = part(model, 'canvas-perforated-facing-' + side), quarter = part(model, 'canvas-quarter-' + side);
      proveOpenings(facing, 5, [quarter]);
      assert.equal(exteriorLoops(quarter.geometry).length, 6, `canvas quarter ${side}: hidden layer holes absent`);
    }
    for (const eye of eyes) {
      const C = new T.Vector3(...eye.apertureCenter), N = new T.Vector3(...eye.apertureAxis);
      assert.equal(localRayHits(C, N, [eye]).length, 0, `${eye.id}: metal bore is capped`); provePanelExists(eye);
    }
  }
  return { tested: true };
}

check('anchor and catalogue contract', () => {
  assert.equal(anchor.baseSha, 'cafab0889b612ed6cbf461683dfe2851909df3be');
  assert.equal(anchor.archetypes.length, 4);
  assert.deepEqual(STYLES.map(s => s.id).sort(), ['canvas', 'chelsea', 'monk', 'penny']);
  assert.equal(anchor.acceptedBaseline.path, 'shoe-workshop/r10');
  assert.ok(fs.readFileSync(path.join(root, 'RESEARCH.md'), 'utf8').includes('未对商业参考实物测量'));
});

const ranges = { length: [.90, 1.10], width: [.88, 1.15], instep: [-5, 8], thickness: [.9, 2.1] };
const scenarios = [{ name: 'default', params: {}, structure: true }];
for (let bits = 0; bits < 16; bits++) scenarios.push({
  name: 'extreme-corner-' + bits,
  params: Object.fromEntries(Object.entries(ranges).map(([key, values], i) => [key, values[(bits >> i) & 1]])), structure: true
});
for (const [key, values] of Object.entries(ranges)) for (const [i, value] of values.entries()) scenarios.push({ name: key + (i ? '-high' : '-low'), params: { [key]: value }, structure: false });

for (const { id } of STYLES) {
  const measurements = new Map();
  for (const scenario of scenarios) {
    let model;
    check(id + '/' + scenario.name, () => {
      model = buildStyle(id, scenario.params);
      generatedCases++;
      const metric = inspectGeometry(model), upper = part(model, upperIds[id]);
      metric.thickness = measureShellThickness(upper);
      for (const p of model.parts.filter(p => p.thicknessMm != null)) measureShellThickness(p);
      if (scenario.structure) checkStructures(model);
      measurements.set(scenario.name, { ...metric, outerY: scenario.name.startsWith('instep-') ? Float32Array.from({ length: upper.geometry.userData.surfaceVertices }, (_, i) => upper.geometry.attributes.position.getY(i)) : null });
      caseMetrics.push({ style: id, case: scenario.name, parts: metric.parts, triangles: metric.triangles, dimensionsMm: metric.dimensions });
    });
    if (model) for (const p of model.parts) p.geometry.dispose();
  }
  check(id + '/measured parameter response', () => {
    const get = key => { const value = measurements.get(key); assert.ok(value, 'prerequisite case failed: ' + key); return value; };
    const lengthChange = get('length-high').soleSize[2] - get('length-low').soleSize[2];
    const widthChange = get('width-high').soleSize[0] - get('width-low').soleSize[0];
    assert.ok(lengthChange > 50, `${id}: length control does not change generated size`);
    assert.ok(widthChange > 20, `${id}: width control does not change generated size`);
    const lo = get('instep-low').outerY, hi = get('instep-high').outerY;
    assert.equal(lo.length, hi.length, 'instep response correspondence changed');
    let maxRaise = -Infinity; for (let i = 0; i < lo.length; i++) maxRaise = Math.max(maxRaise, hi[i] - lo[i]);
    assert.ok(maxRaise > 2.5, `${id}: instep control does not lift actual upper vertices`);
    const thicknessRatio = get('thickness-high').thickness / get('thickness-low').thickness;
    close(thicknessRatio, 2.1 / .9, .01, `${id}: measured shell thickness response`);
    return { lengthChangeMm: lengthChange, widthChangeMm: widthChange, upperInstepRaiseMm: maxRaise, thicknessRatio };
  });
  check(id + '/bounded geometric bend', () => {
    const model = buildStyle(id, { bend: 30 });
    generatedCases++;
    try { inspectGeometry(model); assert.equal(model.report.forceSolved, false); return { mode: 'geometry only; material forces and fit not validated' }; }
    finally { model.parts.forEach(p => p.geometry.dispose()); }
  });
}

check('R10 files unchanged against fixed Git baseline', () => {
  // Frozen from actual `git ls-tree -r cafab0889b612ed6cbf461683dfe2851909df3be
  // -- shoe-workshop/r10` on 2026-10-17. No child process or remote history is
  // required at test time; the known baseline object hashes are the oracle.
  const entries = [
    ['221d309d3d164952adb84f3d2b7e361a6e97a4da', 'BUILD_MANIFEST.json'],
    ['41d7ae9dc4b14ce894a700c2a3508fcb2232af72', 'HOST_COMPATIBILITY.json'],
    ['404ad0c0226ec4c12a815b3063d38eebbb9d0daf', 'PROMOTION_RECEIPT.json'],
    ['a06df6e3382464089c0b9cc86d43d2b9856b54d2', 'evidence/GENERATION.json'],
    ['39db84fd9ed873a3a521f72410d66733ffcb0cd0', 'evidence/UNIT.json'],
    ['5a1c4dca7cc31e583b100225d879ae5e5214fd60', 'evidence/browser/QA.json'],
    ['5b9f36809348e9a71ab93f82352c2518247f5f36', 'index.html'],
    ['90cd93fbc5657ab0dcfd9d27da700cb7c21b577d', 'public-lite.html'],
    ['caac919a86ebe778a2fd0d5a6204b6e01f9ede52', 'src/Binding.mjs'],
    ['418ea6a826029c7651db54d3addffa207e9a6512', 'src/FitCage.mjs'],
    ['d8eac5fae685fcbea16d018e5f5cbad5ab1643ba', 'src/Materials.mjs'],
    ['313075255b703f975b14bb0bae2609f92c34718a', 'src/Pack.mjs'],
    ['ea2ecfa049c0f99aa33757664fb3e0c8859bcade', 'src/Presets.mjs'],
    ['229fbeca5c6a502a60ee04ddce8be682f14b0981', 'src/RendererRealm.mjs'],
    ['2bb23f09c7642b3ed1a42e5a3ebcf61f13ff3966', 'src/Shape.mjs'],
    ['5041953688e26adeb981979e0ad14ebe28fc5e22', 'src/Wear.mjs'],
    ['15809769d1d05bd790032068ac386e2a220d6b37', 'src/main.mjs'],
    ['b6f11a932c5af078e3fd7b351c69cef7e691e97b', 'style.css'],
    ['05365b61d719a6f402dcb38bc0de1d563ecfb574', 'tests/browser.mjs'],
    ['33e565af373084fa51f290b2dc283bd23b9125e8', 'tests/unit.mjs'],
    ['6a7398c6c60413542163409e4913adfb4f5e9ba2', 'tools/build.mjs'],
    ['4853aaf7ad24c5bec17943c7eee39a48f2f00567', 'tools/generate.mjs']
  ];
  for (const [expected, relative] of entries) {
    const name = 'shoe-workshop/r10/' + relative, data = fs.readFileSync(path.join(repo, name));
    const actual = createHash('sha1').update(Buffer.from('blob ' + data.length + '\0')).update(data).digest('hex');
    assert.equal(actual, expected, 'R10 file changed: ' + name);
  }
  return { fileCount: entries.length, baseline: anchor.baseSha, method: 'exact Git blob bytes, not geometry similarity' };
});

check('R12 retains exact original R10 shoe and scan payloads', () => {
  const baseline = fs.readFileSync(path.join(repo, 'shoe-workshop/r10/public-lite.html'), 'utf8');
  const builtPath = path.join(root, 'public-lite.html');
  assert.ok(fs.existsSync(builtPath), 'build prerequisite missing: run node tools/build.mjs before this suite');
  const built = fs.readFileSync(builtPath, 'utf8'), hashes = {};
  for (const id of ['shoe-data', 'scan-data']) {
    const pattern = new RegExp('<div hidden id="' + id + '">([A-Za-z0-9+/=]+)</div>');
    const before = baseline.match(pattern)?.[1], after = built.match(pattern)?.[1];
    assert.ok(before && after, 'missing retained payload ' + id); assert.equal(after, before, 'original payload changed: ' + id);
    const bytes = Buffer.from(after, 'base64'); hashes[id] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  return { method: 'exact embedded payload equality against unchanged R10', payloads: hashes };
});

check('build and geometry evidence identify the same source', () => {
  assert.ok(manifest, 'build manifest missing');
  assert.equal(manifest.sourceCommit, sourceCommit, 'build/sourceCommit mismatch');
  return { sourceCommit, baseline: anchor.baseSha };
});

rayMaterial.dispose();
const failures = results.filter(r => !r.passed);
const report = {
  suite: 'SHOE-R12-INDEPENDENT-GEOMETRY', taskId: anchor.taskId,
  sourceCommit, success: failures.length === 0,
  passed: results.length - failures.length, failed: failures.length,
  generatedCases, validatedParameterCases: caseMetrics.length, extremeCornersPerStyle: 16,
  baseline: anchor.baseSha, failures,
  measuredResponses: results.filter(r => r.name.includes('parameter response')),
  preservation: results.filter(r => r.name.startsWith('R10 ') || r.name.startsWith('R12 retains')),
  defaults: caseMetrics.filter(m => m.case === 'default'),
  testedSourceFiles: ['src/kernel.mjs', 'src/penny-chelsea.mjs', 'src/monk-canvas.mjs', 'src/soles.mjs', 'src/model.mjs', 'tests/geometry.mjs'].map(relative => ({ path: relative, sha256: createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex') })),
  scope: { numericGeometry: true, rendered: false, visualApproved: false, wearerFit: false, physicalSolver: false, manufacturing: false, publicLinkVerified: false }
};
fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
fs.writeFileSync(path.join(root, 'evidence/GEOMETRY.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
