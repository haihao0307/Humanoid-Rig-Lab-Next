import assert from 'node:assert/strict';
import * as T from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// Independent tests for the visible/structural failures measured in the published
// R12. Only the generated positions, indices and ray intersections decide success.
// Metadata identifies section rings and stitch periods; it is not a pass oracle.
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const at = (g, i) => V().fromBufferAttribute(g.attributes.position, i);
const rayMaterial = new T.MeshBasicMaterial({ side: T.DoubleSide });
const getPart = (model, id) => {
  const p = model.parts.find(p => p.id === id);
  assert.ok(p, `missing physical part ${id}`); return p;
};
const metadata = p => ({ ...p, ...p.geometry.userData });
const pointKey = p => p.toArray().map(x => Math.round(x / 1e-4)).join(',');

export function stitchRings(p) {
  const g = p.geometry, uv = g.attributes.uv, meta = metadata(p), P = g.attributes.position;
  let R = meta.ringSize;
  if (!R && uv) { R = 1; while (R < P.count && Math.abs(uv.getX(R) - uv.getX(0)) < 1e-8) R++; }
  assert.ok(Number.isInteger(R) && R >= 5 && R <= 32 && P.count % R === 0, `${p.id}: cannot identify actual uniform section rings`);
  const N = P.count / R, arc = meta.ringArcMm;
  const rings = [];
  for (let i = 0; i < N; i++) {
    const vertices = Array.from({ length: R - 1 }, (_, j) => at(g, i * R + j));
    assert.ok(vertices[0].distanceTo(at(g, i * R + R - 1)) < .0001, `${p.id}: section UV seam is geometrically open`);
    const centre = vertices.reduce((sum, p) => sum.add(p), V()).divideScalar(vertices.length);
    const across = vertices[0].clone().sub(centre).normalize();
    const up = vertices[1].clone().sub(vertices.at(-1)).normalize();
    const radii = vertices.map(p => p.distanceTo(centre));
    let n = meta.supportNormals?.[i];
    if (n && !n.isVector3) n = Array.isArray(n) ? V(...n) : V(n.x, n.y, n.z);
    rings.push({ vertices, centre, across, up, radii, supportNormal: n?.clone().normalize(), arcMm: arc?.[i] ?? (p.lengthMm * i / (N - 1)) });
  }
  assert.ok(rings.every(r => Number.isFinite(r.arcMm)), `${p.id}: physical stitch arc positions missing`);
  for (let i = 1; i < rings.length; i++) assert.ok(rings[i].arcMm >= rings[i - 1].arcMm, `${p.id}: stitch arc reverses`);
  return rings;
}

export function checkSeamFrames(model) {
  const seams = model.parts.filter(p => p.kind === 'seam');
  assert.ok(seams.length >= 4, 'missing generated seam paths');
  let testedRings = 0, minimumAxisDot = 1, minimumNeckRatio = 1;
  for (const p of seams) {
    const rings = stitchRings(p); testedRings += rings.length;
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i], diameter = 2 * Math.max(...r.radii);
      assert.ok(diameter >= .08 && diameter <= .8, `${p.id}: actual thread diameter ${diameter} mm is outside the bounded thread scale`);
      if (!i) continue;
      const previous = rings[i - 1], axisDot = Math.min(previous.across.dot(r.across), previous.up.dot(r.up));
      minimumAxisDot = Math.min(minimumAxisDot, axisDot);
      assert.ok(axisDot > .5, `${p.id}: adjacent section ${i - 1}/${i} turns over 60 degrees (axis dot ${axisDot}) at ${r.centre.toArray()}`);
      for (let j = 0; j < r.vertices.length; j++) {
        const before = previous.vertices[j].clone().sub(previous.centre), after = r.vertices[j].clone().sub(r.centre);
        const nominal = (before.length() + after.length()) / 2;
        const neckRatio = before.add(after).multiplyScalar(.5).length() / nominal;
        minimumNeckRatio = Math.min(minimumNeckRatio, neckRatio);
        assert.ok(neckRatio > .5, `${p.id}: actual joining strip collapses between rings ${i - 1}/${i}, remaining radius ratio ${neckRatio}`);
      }
    }
  }
  return { seams: seams.length, testedRings, minimumAxisDot, minimumNeckRatio, method: 'actual ring vertices and interpolated connecting sections; configured width alone is not used' };
}

function outerSupport(parts) {
  const meshes = [], samples = [];
  for (const p of parts) {
    const source = p.geometry, group = source.groups[0];
    assert.ok(group?.count, `${p.id}: no identifiable exterior sheet`);
    const ids = Array.from(source.index.array.slice(group.start, group.start + group.count));
    const g = new T.BufferGeometry();
    g.setAttribute('position', source.attributes.position);
    g.setAttribute('normal', source.attributes.normal);
    g.setIndex(ids);
    const mesh = new T.Mesh(g, rayMaterial); mesh.name = p.id; mesh.updateMatrixWorld(); meshes.push(mesh);
    for (const i of new Set(ids)) samples.push({ point: at(source, i), normal: V().fromBufferAttribute(source.attributes.normal, i).normalize() });
  }
  return {
    meshes,
    // Legacy R12 has no support-direction metadata. Finding the nearest actual
    // exterior vertex supplies only a ray direction, never the test outcome.
    nearestNormal(point) {
      let closest, best = Infinity;
      for (const sample of samples) { const d = sample.point.distanceToSquared(point); if (d < best) { best = d; closest = sample; } }
      assert.ok(closest, 'empty support surface'); return closest.normal.clone();
    },
    dispose() { meshes.forEach(m => m.geometry.dispose()); }
  };
}

export function measureSupportedStitch(p, supportParts, { cycles = true } = {}) {
  const support = outerSupport(supportParts), rings = stitchRings(p), ray = new T.Raycaster();
  const pitch = metadata(p).pitchMm;
  assert.ok(pitch >= 1 && pitch <= 6, `${p.id}: stitch pitch absent or not a bounded shoe-stitch design`);
  const observations = [], missing = [];
  const shoot = (point, n) => {
    ray.set(point.clone().addScaledVector(n, 3), n.clone().negate()); ray.near = 0; ray.far = 6;
    return ray.intersectObjects(support.meshes, false)[0];
  };
  try {
    for (const [i, r] of rings.entries()) {
      const n = r.supportNormal ?? support.nearestNormal(r.centre), hit = shoot(r.centre, n);
      if (!hit) { missing.push(i); continue; }
      const clearance = r.vertices.map(v => v.clone().sub(hit.point).dot(n));
      observations.push({ ...r, i, n, minimum: Math.min(...clearance), maximum: Math.max(...clearance) });
    }
    assert.equal(missing.length, 0, `${p.id}: ${missing.length}/${rings.length} actual ring centres have no support-sheet projection; first ring ${missing[0]}`);
    const exact = r => {
      if (r.exact) return r.exact;
      const values = r.vertices.map(v => { const hit = shoot(v, r.n); return hit ? v.clone().sub(hit.point).dot(r.n) : null; });
      if (values.some(v => v == null)) return r.exact = { supported: false };
      return r.exact = { supported: true, minimum: Math.min(...values), maximum: Math.max(...values) };
    };
    const periodCount = Math.floor(rings.at(-1).arcMm / pitch), periods = [];
    if (cycles) {
      assert.ok(periodCount >= 2, `${p.id}: insufficient physical stitch periods`);
      for (let k = 0; k < periodCount; k++) {
        const window = observations.filter(r => r.arcMm >= k * pitch && r.arcMm < (k + 1) * pitch);
        // The coarse tangent-plane estimate is only a candidate selector. All
        // six actual vertices of each accepted ring receive their own ray.
        const hidden = window.find(r => r.maximum < -.01 && exact(r).supported && exact(r).maximum < -.01);
        const visible = window.find(r => r.minimum > .005 && exact(r).supported && exact(r).minimum > .005);
        assert.ok(hidden, `${p.id}: stitch period ${k} has no genuinely fully buried section against actual exterior triangles`);
        assert.ok(visible, `${p.id}: stitch period ${k} has no genuinely exposed supported section`);
        periods.push({ period: k, hiddenRing: hidden.i, hiddenMaximumMm: hidden.exact.maximum, visibleRing: visible.i, visibleMinimumMm: visible.exact.minimum });
      }
    } else {
      // The U-seam support check covers every ring centre and regularly sampled
      // complete sections; it does not infer closure from a semantic part name.
      for (let i = 0; i < observations.length; i += 8) assert.ok(exact(observations[i]).supported, `${p.id}: section ${i} extends off its support sheet`);
    }
    return { id: p.id, supportIds: supportParts.map(p => p.id), rings: rings.length, unsupportedCentres: missing.length, verifiedCompletePeriods: periods.length,
      minimumVisibleClearanceMm: periods.length ? Math.min(...periods.map(p => p.visibleMinimumMm)) : null,
      maximumHiddenClearanceMm: periods.length ? Math.max(...periods.map(p => p.hiddenMaximumMm)) : null,
      method: cycles
        ? 'ray cast against actual exterior mesh; complete visible/hidden sections tested vertex by vertex in every full pitch period'
        : 'ray cast every centre and each eighth full section against the actual panel union; no per-period penetration claim' };
  } finally { support.dispose(); }
}

export function checkWeltStitches(model) {
  return [-1, 1].map(side => measureSupportedStitch(getPart(model, 'welt-stitch-' + side), [getPart(model, 'welt-' + side)]));
}
export function checkGoreStitches(model) {
  const leather = ['chelsea-whole-vamp', 'chelsea-back-quarter'].map(id => getPart(model, id));
  const seams = model.parts.filter(p => p.id.startsWith('gore-seam-'));
  assert.equal(seams.length, 4, 'Chelsea must retain four physical elastic-edge seam paths');
  return seams.map(p => measureSupportedStitch(p, leather));
}

function renderMeshes(parts) {
  return parts.map(p => { const m = new T.Mesh(p.geometry, p.geometry.groups.length ? [rayMaterial, rayMaterial, rayMaterial] : rayMaterial); m.name = p.id; m.updateMatrixWorld(); return m; });
}
export function checkChelseaSideSurface(model, bootSurface) {
  const surface = bootSurface(model.last), parts = ['chelsea-whole-vamp', 'chelsea-back-quarter', 'chelsea-gore--1', 'chelsea-gore-1'].map(id => getPart(model, id));
  const targets = renderMeshes(parts), ray = new T.Raycaster(), samples = [];
  // Boundary neighbourhoods locate the region; rays use fixed WORLD +/-X,
  // never the possibly reversed analytical surface normal. Fine R12 failures
  // are included explicitly in addition to the coarser surrounding grid.
  const sampleSpecs = [];
  for (let j = 0; j <= 120; j += 6) for (const boundarySign of [-1, 1]) for (const i of [-5, -2, 0, 2, 5]) sampleSpecs.push({ v: .315 + j / 120 * .19, boundarySign, delta: i * .0008 });
  sampleSpecs.push(...[
    { u: 1.3752337602506597, v: .4765 },
    { u: 1.371316749959088, v: .4780833333333333 },
    { u: 1.372916749959088, v: .4780833333333333 },
    { u: 1.679432979127808, v: .41475 },
    { u: 1.6761083638403513, v: .41633333333333333 }
  ]);
  const smooth01 = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const oldBoundaryWidth = v => v <= .33 ? 0 : .60 * Math.pow(smooth01((v - .33) / (.91 - .33)), .61);
  for (const side of [-1, 1]) for (const spec of sampleSpecs) {
    // The old interface is used solely to freeze the sampled neighbourhood;
    // current mesh hits, not a repeated boundary formula, decide acceptance.
    const positiveU = spec.u ?? Math.PI / 2 + spec.boundarySign * oldBoundaryWidth(spec.v) + spec.delta;
    const u = side > 0 ? positiveU : -positiveU, p = surface.point(u, spec.v);
    ray.set(V(side * 200, p.y, p.z), V(-side, 0, 0)); ray.near = 0; ray.far = 400;
    const hit = ray.intersectObjects(targets, false)[0];
    assert.ok(hit, `Chelsea side ${side}: visible shell gap at u=${u}, v=${spec.v}, world y/z=${p.y}/${p.z}`);
    assert.notEqual(hit.face.materialIndex, 1, `Chelsea side ${side}: first visible hit is ${hit.object.name} INNER surface at u=${u}, v=${spec.v}, world y/z=${p.y}/${p.z}`);
    samples.push({ side, part: hit.object.name, layer: hit.face.materialIndex });
  }
  return { rays: samples.length, directions: ['world +X', 'world -X'], innerFirstHits: 0, misses: 0, explicitR12FailureSamplesPerSide: 5 };
}

function meshTopology(parts, exteriorOnly) {
  const pointMap = new Map(), positions = [], triangles = [], adjacent = new Map(), edgeUse = new Map();
  for (const p of parts) {
    const g = p.geometry, group = exteriorOnly ? g.groups[0] : { start: 0, count: g.index.count };
    assert.ok(group?.count, `${p.id}: empty topology input`);
    const remap = new Map();
    const add = i => { if (remap.has(i)) return remap.get(i); const point = at(g, i), key = pointKey(point); if (!pointMap.has(key)) { pointMap.set(key, positions.length); positions.push(point); } const mapped = pointMap.get(key); remap.set(i, mapped); return mapped; };
    for (let i = group.start; i < group.start + group.count; i += 3) {
      const tri = [add(g.index.getX(i)), add(g.index.getX(i + 1)), add(g.index.getX(i + 2))];
      if (new Set(tri).size < 3) continue;
      triangles.push(tri);
      for (let k = 0; k < 3; k++) {
        const a = tri[k], b = tri[(k + 1) % 3], key = Math.min(a, b) + ',' + Math.max(a, b);
        edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
        for (const [x, y] of [[a, b], [b, a]]) { if (!adjacent.has(x)) adjacent.set(x, new Set()); adjacent.get(x).add(y); }
      }
    }
  }
  const componentsOf = graph => { const seen = new Set(), components = []; for (const start of graph.keys()) { if (seen.has(start)) continue; const todo = [start], c = []; while (todo.length) { const x = todo.pop(); if (seen.has(x)) continue; seen.add(x); c.push(x); todo.push(...graph.get(x)); } components.push(c); } return components; };
  const boundary = new Map(); let nonManifoldEdges = 0;
  for (const [key, count] of edgeUse) {
    if (count > 2) nonManifoldEdges++;
    if (count !== 1) continue;
    const [a, b] = key.split(',').map(Number);
    for (const [x, y] of [[a, b], [b, a]]) { if (!boundary.has(x)) boundary.set(x, new Set()); boundary.get(x).add(y); }
  }
  return { components: componentsOf(adjacent), boundaryLoops: componentsOf(boundary), boundaryEdges: [...edgeUse].filter(([, count]) => count === 1).map(([key]) => key.split(',').map(Number)), boundaryBranches: [...boundary.values()].filter(v => v.size !== 2).length, nonManifoldEdges, positions, triangles: triangles.length };
}

export function checkPennyU(model) {
  const seams = model.parts.filter(p => p.kind === 'seam' && p.id.includes('apron'));
  assert.ok(seams.length, 'Penny has no physical apron stitch geometry');
  const topology = meshTopology(seams, false);
  assert.equal(topology.components.length, 1, `Penny U seam consists of ${topology.components.length} disconnected actual mesh components`);
  assert.equal(topology.boundaryBranches, 0, 'Penny U seam has a branching/open section boundary');
  assert.equal(topology.boundaryLoops.length, 2, 'Penny U seam must be one continuous open-ended tube, with two ends under the saddle');
  const endCentres = topology.boundaryLoops.map(loop => loop.reduce((s, i) => s.add(topology.positions[i]), V()).divideScalar(loop.length));
  assert.ok(endCentres.every(c => c.z < model.last.L * .12), `Penny U seam leaves exposed ends near the toe: ${endCentres.map(c => c.toArray())}`);
  const apron = getPart(model, 'penny-apron'), rings = seams.flatMap(stitchRings), apronBounds = new T.Box3().setFromBufferAttribute(apron.geometry.attributes.position);
  const seamMaxZ = Math.max(...rings.map(r => r.centre.z));
  assert.ok(apronBounds.max.z - seamMaxZ < 3, `Penny U seam stops ${apronBounds.max.z - seamMaxZ} mm before its actual front panel`);
  assert.ok(Math.min(...rings.map(r => r.centre.x)) < -10 && Math.max(...rings.map(r => r.centre.x)) > 10, 'Penny U path does not span both apron sides');
  const boundary = meshTopology([apron], true), closest = V();
  let maximumBoundaryDistanceMm = 0;
  for (const ring of rings) {
    let distance = Infinity;
    for (const [a, b] of boundary.boundaryEdges) {
      new T.Line3(boundary.positions[a], boundary.positions[b]).closestPointToPoint(ring.centre, true, closest);
      distance = Math.min(distance, closest.distanceTo(ring.centre));
    }
    maximumBoundaryDistanceMm = Math.max(maximumBoundaryDistanceMm, distance);
    assert.ok(distance < .65, `Penny U line leaves its actual apron cut boundary by ${distance} mm at ${ring.centre.toArray()}`);
  }
  // This is a real join between two panels. A section may span both sides of
  // the shared edge; requiring every vertex to land on one panel is incorrect.
  const support = seams.map(p => measureSupportedStitch(p, [apron, getPart(model, 'penny-galosh')], { cycles: false }));
  return { connectedComponents: topology.components.length, physicalOpenEnds: topology.boundaryLoops.length, endCentresMm: endCentres.map(c => c.toArray()), frontInsetMm: apronBounds.max.z - seamMaxZ, maximumBoundaryDistanceMm, support };
}

export function measureRearCollarCover(model) {
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/r13-collar-gap-before.json', import.meta.url), 'utf8'));
  const view = fixture.views[model.style.id];
  assert.ok(view, 'rear opening fixture missing for ' + model.style.id);
  const rearPartId = { penny: 'penny-galosh', monk: 'monk-open-quarters' }[model.style.id];
  const upper = getPart(model, rearPartId), bindingIds = model.style.id === 'penny'
    ? ['collar-bound-edge'] : ['monk-collar-binding--1', 'monk-collar-binding-1'];
  const bindingPoints = [];
  for (const id of bindingIds) {
    const binding = getPart(model, id).geometry;
    const outer = binding.groups.find(group => group.materialIndex === 0) ?? { start: 0, count: binding.index.count };
    assert.ok(outer.count, `${model.style.id} rear opening has no actual binding exterior`);
    for (const i of new Set(binding.index.array.slice(outer.start, outer.start + outer.count))) bindingPoints.push(at(binding, i));
  }
  const minimumZ = Math.min(...bindingPoints.map(p => p.z));
  const rearVertices = bindingPoints.filter(p => p.z <= minimumZ + .00001);
  const rear = rearVertices.reduce((sum, p) => sum.add(p), V()).divideScalar(rearVertices.length);
  const target = renderMeshes([upper])[0], ray = new T.Raycaster(), worldSamples = [];
  // The actual binding locates the small rear neighbourhood. Only the leather
  // mesh may close it: a wider binding, thread or a distant inner wall cannot
  // conceal a missing patch. The ray direction is fixed WORLD +Z.
  for (const dx of fixture.worldSamples.lateralOffsetsMm) for (const down of fixture.worldSamples.belowActualBindingRearMm) {
    ray.set(rear.clone().add(V(dx, -down, -fixture.worldSamples.originBehindMm)), V(0, 0, 1));
    ray.near = 0; ray.far = 700;
    const hit = ray.intersectObject(target, false)[0];
    const passed = !!hit && hit.face.materialIndex !== 1 && hit.distance < fixture.worldSamples.maxAcceptedDistanceMm;
    worldSamples.push({ lateralMm: dx, belowBindingMm: down, passed, firstLayer: hit?.face.materialIndex ?? null,
      firstDistanceMm: hit?.distance ?? null, firstPointMm: hit?.point.toArray() ?? null });
  }
  const fixedCameraSamples = [], p = model.last.params;
  if (p.length === 1 && p.width === 1 && p.instep === 0 && p.thickness === 1.35 && p.bend === 0) {
    const c = view.camera, camera = new T.PerspectiveCamera(c.fov, c.aspect, c.near, c.far);
    camera.position.fromArray(c.position); camera.quaternion.fromArray(c.quaternion);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    target.scale.setScalar(.001); target.updateMatrixWorld(true);
    const [width, height] = view.image.size;
    for (const [x, y] of view.pixels) {
      ray.setFromCamera(new T.Vector2((x + .5) / width * 2 - 1, 1 - (y + .5) / height * 2), camera);
      ray.near = 0; ray.far = 15;
      const hit = ray.intersectObject(target, false)[0];
      fixedCameraSamples.push({ pixel: [x, y], passed: !!hit && hit.face.materialIndex !== 1 && hit.point.z < 0,
        firstLayer: hit?.face.materialIndex ?? null, firstFace: hit?.faceIndex ?? null,
        firstPointMm: hit?.point.clone().multiplyScalar(1000).toArray() ?? null });
    }
  }
  return { rearPartId, actualBindingRearMm: rear.toArray(), worldRays: worldSamples.length, fixedCameraRays: fixedCameraSamples.length,
    worldSamples, fixedCameraSamples, failures: [...worldSamples, ...fixedCameraSamples].filter(s => !s.passed),
    method: 'actual rear upper first hits below actual binding vertices, plus exact failing CI camera pixels for the default; no coverage inferred from a design formula' };
}

export function checkRearCollar(model) {
  // Curvature is evaluated in millimetres on the actual shared collar curve,
  // then checked against nearby generated upper/binding geometry. A fractional
  // cusp keeps sharpening as the neighbourhood shrinks; a round end converges.
  const curve = model.last.ring;
  assert.equal(typeof curve, 'function', 'shared collar curve missing');
  const centre = curve(Math.PI), samples = [];
  for (const step of [.04, .02, .01]) {
    const a = curve(Math.PI - step), c = curve(Math.PI + step);
    const A = V(a.x - centre.x, 0, a.z - centre.z), C = V(c.x - centre.x, 0, c.z - centre.z);
    const denom = A.length() * C.length() * A.distanceTo(C), cross = Math.abs(A.x * C.z - A.z * C.x);
    const radiusMm = denom / (2 * cross);
    assert.ok(Number.isFinite(radiusMm) && radiusMm > .5, `rear collar curvature is degenerate at angular step ${step}`);
    samples.push({ step, radiusMm, points: [a, centre, c] });
  }
  const radii = samples.map(s => s.radiusMm), convergence = Math.min(...radii) / Math.max(...radii);
  assert.ok(convergence > .95, `rear collar keeps sharpening toward its join: radius range ${Math.min(...radii)}–${Math.max(...radii)} mm, convergence ${convergence}`);
  const candidates = model.parts.filter(p => p.kind !== 'seam' && !['rubber', 'heel', 'welt', 'insole'].includes(p.role));
  let closest = Infinity;
  for (const p of candidates) {
    const g = p.geometry;
    for (let i = 0; i < g.attributes.position.count; i++) closest = Math.min(closest, at(g, i).distanceTo(centre));
  }
  assert.ok(closest < 2.5, `shared rear collar curve is detached from generated upper geometry (${closest} mm)`);
  // A regular collar did not prevent a tall, needle-like rear galosh ridge in
  // the actual top render. Inspect the physical rear-most outer shell as well.
  // Five millimetres is a deliberately loose closure allowance, not an assert
  // of the generator's 1.2 mm cap target or a manufacturing measurement.
  const rearPartIds = { penny: ['penny-galosh'], monk: ['monk-open-quarters'], canvas: ['canvas-quarter--1', 'canvas-quarter-1'] }[model.style.id];
  const rearVertices = [];
  for (const id of rearPartIds) {
    const g = getPart(model, id).geometry, outer = g.groups.find(group => group.materialIndex === 0);
    assert.ok(outer?.count, `${id}: actual rear exterior missing`);
    for (const i of new Set(g.index.array.slice(outer.start, outer.start + outer.count))) rearVertices.push(at(g, i));
  }
  const actualRearZ = Math.min(...rearVertices.map(p => p.z)), capVertices = rearVertices.filter(p => p.z <= actualRearZ + .15);
  const sole = getPart(model, 'outsole').geometry, solePositions = sole.attributes.position;
  let soleRearZ = Infinity, actualRearSoleTop = -Infinity;
  for (let i = 0; i < solePositions.count; i++) soleRearZ = Math.min(soleRearZ, solePositions.getZ(i));
  for (let i = 0; i < solePositions.count; i++) if (solePositions.getZ(i) <= soleRearZ + .05) actualRearSoleTop = Math.max(actualRearSoleTop, solePositions.getY(i));
  const actualRearCapRiseMm = Math.max(...capVertices.map(p => p.y)) - actualRearSoleTop;
  assert.ok(capVertices.length >= 3 && Number.isFinite(actualRearCapRiseMm), 'rear outer cap has insufficient measurable geometry');
  assert.ok(actualRearCapRiseMm < 5, `actual rear outer shell leaves a tall narrow ridge ${actualRearCapRiseMm} mm above its sole at z=${actualRearZ}`);
  const rearOpeningCover = ['penny', 'monk'].includes(model.style.id) ? measureRearCollarCover(model) : null;
  if (rearOpeningCover) assert.equal(rearOpeningCover.failures.length, 0,
    `${model.style.id} rear collar has ${rearOpeningCover.failures.length} rays through missing leather or onto inner surfaces: ${JSON.stringify(rearOpeningCover.failures[0])}`);
  return { rearPointMm: centre.toArray(), radiusSamplesMm: samples.map(({ step, radiusMm }) => ({ step, radiusMm })), convergence, closestGeneratedVertexMm: closest,
    actualRearCapRiseMm, actualRearCapZMm: actualRearZ, actualRearCapVertices: capVertices.length,
    rearOpeningCover,
    scope: 'shared curve regularity, generated geometry linkage, actual rear outer-cap height and Penny/Monk rear opening coverage; rendered outline still requires visual review' };
}

export function checkFoxingLoop(model) {
  const strips = model.parts.filter(p => /^foxing-(?:ring|-?1)$/.test(p.id));
  const beads = model.parts.filter(p => p.id.startsWith('foxing-bead-'));
  assert.ok(strips.length && beads.length, 'Canvas physical foxing or top bead missing');
  const strip = meshTopology(strips, true), bead = meshTopology(beads, false);
  assert.equal(strip.components.length, 1, `Canvas foxing outer sheet has ${strip.components.length} disconnected components`);
  assert.equal(strip.nonManifoldEdges, 0, 'Canvas foxing outer sheet is non-manifold');
  assert.equal(strip.boundaryBranches, 0, 'Canvas foxing rim branches or ends');
  assert.equal(strip.boundaryLoops.length, 2, `Canvas foxing must have only its upper/lower closed rims; found ${strip.boundaryLoops.length}`);
  assert.equal(bead.components.length, 1, `Canvas top bead has ${bead.components.length} disconnected components`);
  assert.equal(bead.boundaryLoops.length, 0, `Canvas top bead leaves ${bead.boundaryLoops.length} open physical tube ends`);
  assert.equal(bead.nonManifoldEdges, 0, 'Canvas top bead is non-manifold');
  // A closed strip can still expose another part through its front/back seam.
  // The real R13 preflight showed the slab's narrow flat cap ahead of an
  // otherwise closed rounded band. Cast through both actual end assemblies.
  const upperParts = ['canvas-quarter--1', 'canvas-quarter-1', 'canvas-rounded-vamp'].map(id => getPart(model, id));
  const targets = renderMeshes([...strips, ...beads, getPart(model, 'outsole'), getPart(model, 'insole'), ...upperParts]);
  const coverIds = new Set([...strips, ...beads].map(p => p.id)), ray = new T.Raycaster();
  let endFaceRays = 0, minimumCoverClearanceMm = Infinity;
  for (const [end, s, direction] of [['toe', 1, 1], ['heel', 0, -1]]) {
    const z = model.last.L * (s - .5), centreX = model.last.center(s), baseY = model.last.soleTop(s);
    for (const dx of [-.3, -.15, 0, .15, .3]) for (const dy of [-8, -4, -1, 1]) {
      ray.set(V(centreX + dx, baseY + dy, z + direction * 20), V(0, 0, -direction)); ray.near = 0; ray.far = 40;
      const hits = ray.intersectObjects(targets, false), first = hits[0]; endFaceRays++;
      assert.ok(first && coverIds.has(first.object.name) && first.face.materialIndex === 0,
        `Canvas ${end} cap exposes ${first?.object.name ?? 'a gap'}/${first?.face.materialIndex ?? 'none'} at lateral ${dx} mm, height ${dy} mm`);
      const slab = hits.find(h => h.object.name === 'outsole' || h.object.name === 'insole');
      assert.ok(slab, `Canvas ${end} ray did not sample the intended sole/insole overlap`);
      const coveredPart = hits.find(h => !coverIds.has(h.object.name));
      const clearance = coveredPart.distance - first.distance; minimumCoverClearanceMm = Math.min(minimumCoverClearanceMm, clearance);
      assert.ok(clearance > .02, `Canvas ${end} outer band is coplanar with or behind the slab (${clearance} mm cover clearance)`);
    }
  }
  return { outerStripComponents: strip.components.length, closedRimLoops: strip.boundaryLoops.length, beadComponents: bead.components.length, openBeadEnds: bead.boundaryLoops.length,
    method: 'actual indexed triangles welded only within 0.0001 mm to account for UV duplicates', endFaceRays, minimumCoverClearanceMm,
    endFaceScope: 'actual exterior first hits at toe and heel, including upper panels, outsole and insole; real bead may provide cover' };
}

export function regressionChecks(model, { bootSurface } = {}) {
  const checks = [{ name: 'stitch sections remain continuous without neck collapse', run: () => checkSeamFrames(model) }];
  if (model.style.id !== 'canvas') checks.push({ name: 'welt stitches stay supported and penetrate every period', run: () => checkWeltStitches(model) });
  if (model.style.id === 'chelsea') checks.push(
    { name: 'side rays encounter exterior without inner surfaces or gaps', run: () => checkChelseaSideSurface(model, bootSurface) },
    { name: 'gore stitches penetrate actual leather', run: () => checkGoreStitches(model) }
  );
  else checks.push({ name: 'rear collar curvature converges to a round join', run: () => checkRearCollar(model) });
  if (model.style.id === 'penny') checks.push({ name: 'apron U seam is continuous and has real panel support', run: () => checkPennyU(model) });
  if (model.style.id === 'canvas') checks.push({ name: 'foxing and upper bead form physical closed loops', run: () => checkFoxingLoop(model) });
  return checks;
}

// Explicit before runner, separate from the R13 acceptance suite. It imports the
// retained R12 source without building it or touching its historic evidence.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const requested = process.argv[2];
  assert.equal(requested, '--r12-before', 'usage: node tests/review-regressions.mjs --r12-before');
  const thisRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), beforeRoot = path.resolve(thisRoot, '../r12');
  const { buildStyle } = await import(pathToFileURL(path.join(beforeRoot, 'src/model.mjs')));
  const { bootSurface } = await import(pathToFileURL(path.join(beforeRoot, 'src/penny-chelsea.mjs')));
  const results = [];
  for (const id of ['penny', 'chelsea', 'monk', 'canvas']) {
    const model = buildStyle(id);
    try {
      for (const { name, run } of regressionChecks(model, { bootSurface })) {
        try { results.push({ style: id, name, passed: true, detail: run() }); }
        catch (error) { results.push({ style: id, name, passed: false, error: error.message }); }
      }
    } finally { model.parts.forEach(p => p.geometry.dispose()); }
  }
  const files = ['src/kernel.mjs', 'src/penny-chelsea.mjs', 'src/monk-canvas.mjs', 'src/soles.mjs', 'src/model.mjs'];
  console.log(JSON.stringify({ suite: 'R13-REGRESSIONS-ON-RETAINED-R12-BEFORE', sourceCommit: '7fd5527f475908d615db4f1fd36357f47e68ce46', parameterScope: 'four defaults only', testModuleSha256: createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
    testedSourceFiles: files.map(relative => ({ path: relative, sha256: createHash('sha256').update(fs.readFileSync(path.join(beforeRoot, relative))).digest('hex') })),
    passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results,
    scope: { readOnly: true, rendered: false, humanReview: false, wearerFit: false, physicalSolver: false, manufacturing: false }
  }, null, 2));
}
