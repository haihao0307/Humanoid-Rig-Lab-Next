import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import * as T from 'three';

// Independent R14 increment: measure final geometry, not claimed attachment data.
// node tests/construction-flex.mjs [--root ../r13] [--output evidence/CONSTRUCTION_FLEX.json]
// A failing baseline still exits 1 and its complete report is written first.
const here = path.dirname(fileURLToPath(import.meta.url));
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const root = path.resolve(arg('--root') || path.join(here, '..'));
const output = arg('--output');
const requestedLane = (arg('--lane') || 'ALL').toUpperCase();
if (!['ALL', 'A', 'B', 'C'].includes(requestedLane)) throw Error('Unknown lane selection.');
const baselineRoot = path.resolve(root, '../r13');
const hash = b => createHash('sha256').update(b).digest('hex');
const sourceFiles = fs.readdirSync(path.join(root, 'src')).filter(p => p.endsWith('.mjs')).sort().map(p => 'src/' + p);
const beforeFiles = new Map(sourceFiles.map(p => [p, fs.readFileSync(path.join(root, p))]));
const producerHashes = Object.fromEntries([...beforeFiles].map(([p, bytes]) => [p, hash(bytes)]));
const baselineFiles = fs.readdirSync(path.join(baselineRoot, 'src')).filter(p => p.endsWith('.mjs')).sort().map(p => 'src/' + p);
const beforeBaseline = new Map(baselineFiles.map(p => [p, fs.readFileSync(path.join(baselineRoot, p))]));
const baselineHashes = Object.fromEntries([...beforeBaseline].map(([p, bytes]) => [p, hash(bytes)]));
const testBytes = fs.readFileSync(fileURLToPath(import.meta.url));
// Snapshot both candidate and actual R13 baseline before importing executable
// geometry; later checks reject any source or test mutation during the run.
const { buildStyle } = await import(pathToFileURL(path.join(root, 'src/model.mjs')));
const { buildStyle: buildBaselineStyle } = await import(pathToFileURL(path.join(baselineRoot, 'src/model.mjs')));
const { bootSurface: baselineBootSurface } = await import(pathToFileURL(path.join(baselineRoot, 'src/penny-chelsea.mjs')));
const arrayHash = a => hash(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const pos = (g, i) => V().fromBufferAttribute(g.attributes.position, i);
const nor = (g, i) => V().fromBufferAttribute(g.attributes.normal, i).normalize();
const radians = Math.PI / 180;
const degreeError = (a, b) => Math.acos(T.MathUtils.clamp(a.clone().normalize().dot(b.clone().normalize()), -1, 1)) / radians;
const part = (m, id) => { const p = m.parts.find(p => p.id === id); if (!p) throw Error('Missing actual part: ' + id); return p; };
const dispose = m => m.parts.forEach(p => p.geometry.dispose());
const criteria = Object.freeze({
  metalDistanceErrorMm: .01,
  attachmentPositionErrorMm: .01,
  normalTransportErrorDeg: .02,
  minimumFlangeOverlapMm: .10,
  minimumBoreClothClearanceMm: .10,
  maximumLaceEndpointCentreRadialMm: .03,
  minimumLaceBoreClearanceMm: .05,
  boreProbeRadiusMm: 1.65,
  expectedInnerLipDiameterMm: 4.3,
  monkSupportGapRangeMm: [0, .25],
  monkPinExitBelowInnerRingMm: .05,
  monkPinRimClearanceMm: .05,
  monkMountFrameContactMm: .01,
  meshEdgeEndpointToleranceMm: 1e-5,
  meshPlaneContactToleranceMm: 2e-5,
  thicknessesMm: [.9, 1.35, 2.1],
  bendDegrees: [0, 15, 30],
  comment: 'Engineering geometry tolerances, not manufactured dimensions or material calibration. .01 mm rigidity is checked against repeat construction and Float32 rigid round trips.'
});
const checks = [], cases = [];
let generatedModels = 0;
function check(name, fn) {
  const failures = [];
  const expect = (ok, message) => { if (!ok) failures.push(message); };
  let detail;
  try { detail = fn(expect); }
  catch (error) { failures.push(error.stack || error.message); }
  const lane = name.startsWith('canvas/') || name.startsWith('static Float32') ? 'A' : name.startsWith('chelsea/') ? 'B' : name.startsWith('monk/') ? 'C' : null;
  const r = { name, lane, passed: failures.length === 0, failures, ...(detail === undefined ? {} : { detail }) };
  checks.push(r); return r;
}
const build = (id, params) => { generatedModels++; return buildStyle(id, params); };

function ring(g, row) {
  // Verify the actual vertex count/index before using the preserved 7 x 25
  // revolved profile. The duplicated closure sample is deliberately excluded.
  if (g.attributes.position.count !== 175 || !g.index || g.index.count !== 1008) throw Error('Eyelet profile topology changed; independently re-identify actual rim samples before testing.');
  const ids = Array.from({ length: 24 }, (_, i) => row * 25 + i);
  const c = ids.reduce((c, i) => c.add(pos(g, i)), V()).divideScalar(24);
  const x = pos(g, ids[0]).sub(c).normalize();
  const y = pos(g, ids[6]).sub(c); y.addScaledVector(x, -y.dot(x)).normalize();
  const z = x.clone().cross(y).normalize();
  const radii = ids.map(i => pos(g, i).sub(c).length());
  const chords = ids.slice(0, 12).map(i => pos(g, i).distanceTo(pos(g, i + 12)));
  return { ids, c, x, y, z, radii, chords };
}
function frame(g) {
  const upper = ring(g, 0), lower = ring(g, 6), flange = ring(g, 2);
  // The centre of the real upper lip is +.30 mm above the attachment plane.
  const c = upper.c.clone().addScaledVector(upper.z, -.30);
  return { ...upper, c, upper, lower, flange };
}
const local = (p, f) => { const d = p.clone().sub(f.c); return V(d.dot(f.x), d.dot(f.y), d.dot(f.z)); };
const localNormal = (n, f) => V(n.dot(f.x), n.dot(f.y), n.dot(f.z));
const move = (p, f0, f1) => { const q = local(p, f0); return f1.c.clone().addScaledVector(f1.x, q.x).addScaledVector(f1.y, q.y).addScaledVector(f1.z, q.z); };
function actualRigidity(a, b) {
  if (a.attributes.position.count !== b.attributes.position.count || arrayHash(a.index.array) !== arrayHash(b.index.array)) throw Error('Rigid hardware correspondence changed.');
  const anchors = [0, 6, 12, 156];
  let maximumDistanceChangeMm = 0, maximumRelativeChange = 0, worst = null;
  for (let i = 0; i < a.attributes.position.count; i++) for (const j of anchors) {
    if (i === j) continue;
    const before = pos(a, i).distanceTo(pos(a, j));
    if (before < .001) continue;
    const after = pos(b, i).distanceTo(pos(b, j)), error = Math.abs(after - before);
    if (error > maximumDistanceChangeMm) { maximumDistanceChangeMm = error; worst = { indices: [i, j], beforeMm: before, afterMm: after }; }
    maximumRelativeChange = Math.max(maximumRelativeChange, error / before);
  }
  return { maximumDistanceChangeMm, maximumRelativeChange, worst };
}

// Independent mathematical oracle for the original map retained outside the
// flex band. A2 deliberately changes its interior; the A1 rejection is archived.
// Never call production bendGeometry to generate expected positions or normals.
function globalBend(p, last, angleDeg) {
  const axis = last.L * .13, band = last.L * .09, base = last.soleTop(.63);
  const u = T.MathUtils.clamp((p.z - axis + band) / (2 * band), 0, 1);
  const phi = angleDeg * radians * u * u * (3 - 2 * u), dphi = angleDeg * radians * 6 * u * (1 - u) / (2 * band);
  const c = Math.cos(phi), s = Math.sin(phi), y = p.y - base, z = p.z - axis;
  const Y = y * c + z * s, Z = z * c - y * s;
  return { point: V(p.x, base + Y, axis + Z), c, s, B: s + dphi * Z, D: c - dphi * Y, det: 1 - dphi * y, u };
}
function exteriorLoops(g, groupIndex = 0) {
  const group = g.groups[groupIndex]; if (!group) throw Error('No actual render surface group.');
  const I = g.index.array, edges = new Map(), adjacent = new Map();
  for (let i = group.start; i < group.start + group.count; i += 3) for (let j = 0; j < 3; j++) {
    const a = I[i + j], b = I[i + (j + 1) % 3], key = Math.min(a, b) + ',' + Math.max(a, b);
    edges.set(key, (edges.get(key) || 0) + 1);
  }
  for (const [key, count] of edges) {
    if (count > 2) throw Error('Non-manifold sheet edge.');
    if (count !== 1) continue;
    const [a, b] = key.split(',').map(Number);
    for (const [q, r] of [[a, b], [b, a]]) { if (!adjacent.has(q)) adjacent.set(q, []); adjacent.get(q).push(r); }
  }
  for (const n of adjacent.values()) if (n.length !== 2) throw Error('Real aperture boundary branches or ends.');
  const seen = new Set(), loops = [];
  for (const start of adjacent.keys()) {
    if (seen.has(start)) continue;
    const todo = [start], ids = [];
    while (todo.length) { const i = todo.pop(); if (seen.has(i)) continue; seen.add(i); ids.push(i); todo.push(...adjacent.get(i)); }
    loops.push(ids);
  }
  return loops;
}
const centroid = (g, ids) => ids.reduce((c, i) => c.add(pos(g, i)), V()).divideScalar(ids.length);
function nearestHole(g, loops, f) {
  const candidates = loops.map(ids => ({ ids, distance: centroid(g, ids).distanceTo(f.c) })).sort((a, b) => a.distance - b.distance);
  if (!candidates[0] || candidates[0].distance > 4) throw Error('No actual cloth-hole boundary around this metal eyelet.');
  return candidates[0].ids;
}
const rayMaterial = new T.MeshBasicMaterial({ side: T.DoubleSide });
const rayMeshes = parts => parts.map(p => { const m = new T.Mesh(p.geometry, rayMaterial); m.name = p.id; return m; });
function hitsAt(origin, direction, meshes, far = 10) {
  return new T.Raycaster(origin, direction.clone().normalize(), 0, far).intersectObjects(meshes, false);
}
function endpointSpecs() {
  const out = [ ['canvas-lace-front-bar', 0, -1, 4], ['canvas-lace-front-bar', 1, 1, 4] ];
  for (let i = 0; i < 4; i++) out.push(
    ['canvas-lace-cross-a-' + i, 0, -1, i], ['canvas-lace-cross-a-' + i, 1, 1, i + 1],
    ['canvas-lace-cross-b-' + i, 0, 1, i], ['canvas-lace-cross-b-' + i, 1, -1, i + 1]);
  for (const side of [-1, 1]) out.push(['canvas-lace-tucked-end-' + side, 0, side, 0]);
  return out;
}
function endpointIds(g, end) {
  if (g.attributes.position.count % 9 !== 0) throw Error('Lace section topology changed; identify endpoint rings independently.');
  const start = end ? g.attributes.position.count - 9 : 0;
  return Array.from({ length: 8 }, (_, i) => start + i);
}

// Reconstruct the A2 contract from final rest vertices, not attachment metadata
// or production deformation functions. The independent mesh-boundary walker
// above finds both cloth surfaces. Lace end sections were identified separately.
function independentCanvasMap(rest, angleDeg, eyes) {
  const axis = rest.last.L * .13, band = rest.last.L * .09, base = rest.last.soleTop(.63), angle = angleDeg * radians;
  const stations = eyes.map(eye => {
    const f = frame(eye.geometry), side = Number(eye.id.match(/^canvas-eyelet-(-?1)-/)[1]);
    const bounds = new T.Box3().setFromBufferAttribute(eye.geometry.attributes.position);
    let clothBoundaryVertices = 0, laceEndVertices = 0;
    for (const id of [`canvas-quarter-${side}`, `canvas-perforated-facing-${side}`]) {
      const g = part(rest, id).geometry;
      for (const group of [0, 1]) for (const i of nearestHole(g, exteriorLoops(g, group), f)) { bounds.expandByPoint(pos(g, i)); clothBoundaryVertices++; }
    }
    for (const [id, end, s, row] of endpointSpecs()) {
      if (`canvas-eyelet-${s}-${row}` !== eye.id) continue;
      const g = part(rest, id).geometry;
      for (const i of endpointIds(g, end)) { bounds.expandByPoint(pos(g, i)); laceEndVertices++; }
    }
    bounds.expandByScalar(.05);
    const u = T.MathUtils.clamp((f.c.z - axis + band) / (2 * band), 0, 1);
    return { id: eye.id, side, bounds, centre: f.c, value: angle * (3 * u * u - 2 * u * u * u), clothBoundaryVertices, laceEndVertices };
  });
  const originalAngle = z => {
    const u = T.MathUtils.clamp((z - axis + band) / (2 * band), 0, 1);
    return angle * (3 * u * u - 2 * u * u * u);
  };
  const profile = side => {
    const own = stations.filter(s => s.side === side).sort((a, b) => a.bounds.min.z - b.bounds.min.z);
    const active = own.filter(s => s.value > 1e-12 && s.value < angle - 1e-12);
    if (!active.length) return { knots: [], at: originalAngle };
    const start = Math.max(axis - band, ...own.filter(s => s.value === 0).map(s => s.bounds.max.z));
    const finish = Math.min(axis + band, ...own.filter(s => Math.abs(s.value - angle) < 1e-12).map(s => s.bounds.min.z));
    const knots = [[start, 0], ...active.flatMap(s => [[s.bounds.min.z, s.value], [s.bounds.max.z, s.value]]), [finish, angle]];
    for (let i = 1; i < knots.length; i++) if (!(knots[i][0] > knots[i - 1][0])) throw Error('Actual attachment unions leave no positive longitudinal transition.');
    const at = z => {
      if (z <= knots[0][0]) return knots[0][1];
      for (let i = 1; i < knots.length; i++) if (z <= knots[i][0]) {
        const [lo, a] = knots[i - 1], [hi, b] = knots[i], t = (z - lo) / (hi - lo);
        // Hermite interpolation with zero endpoint tangents, including constant
        // intervals through the entire measured rigid attachment union.
        return a * (2 * t ** 3 - 3 * t ** 2 + 1) + b * (-2 * t ** 3 + 3 * t ** 2);
      }
      return knots.at(-1)[1];
    };
    return { knots, at };
  };
  const left = profile(-1), right = profile(1);
  const xLeft = Math.max(...stations.filter(s => s.side === -1).map(s => s.bounds.max.x));
  const xRight = Math.min(...stations.filter(s => s.side === 1).map(s => s.bounds.min.x));
  if (!(xRight > xLeft)) throw Error('Actual attachment unions overlap across the throat.');
  const theta = (x, z) => {
    const t = T.MathUtils.clamp((x - xLeft) / (xRight - xLeft), 0, 1), w = 3 * t * t - 2 * t * t * t;
    return left.at(z) * (1 - w) + right.at(z) * w;
  };
  const point = p => {
    const q = theta(p.x, p.z), c = Math.cos(q), s = Math.sin(q), y = p.y - base, z = p.z - axis;
    return V(p.x, base + y * c + z * s, axis + z * c - y * s);
  };
  const differential = p => {
    // Central differences of independently reconstructed positions test the
    // production analytic inverse transpose, including the transverse term.
    const h = .001, derivatives = ['x', 'y', 'z'].map(key => {
      const a = p.clone(), b = p.clone(); a[key] += h; b[key] -= h;
      return point(a).sub(point(b)).multiplyScalar(.5 / h);
    });
    const [a, b, c] = derivatives;
    return new T.Matrix3().set(a.x, b.x, c.x, a.y, b.y, c.y, a.z, b.z, c.z);
  };
  const determinantAt = p => 1 - (p.y - base) * (theta(p.x, p.z + .001) - theta(p.x, p.z - .001)) / .002;
  return { point, differential, determinantAt, axis, band, xLeft, xRight,
    contract: { bounds: 'independent union of actual metal, both actual cloth surfaces and real lace endpoint rings + 0.05 mm', leftKnots: left.knots, rightKnots: right.knots, transverseMm: [xLeft, xRight], stations: stations.map(s => ({ id: s.id, centreMm: s.centre.toArray(), boundsMm: { min: s.bounds.min.toArray(), max: s.bounds.max.toArray() }, angleRadians: s.value, clothBoundaryVertices: s.clothBoundaryVertices, laceEndVertices: s.laceEndVertices })) } };
}
function triangleFacing(g, triangle) {
  const ids = Array.from(g.index.array.slice(triangle * 3, triangle * 3 + 3));
  const a = pos(g, ids[0]), cross = pos(g, ids[1]).sub(a).cross(pos(g, ids[2]).sub(a));
  const normal = ids.reduce((n, i) => n.add(nor(g, i)), V()).normalize();
  return { areaMm2: cross.length() / 2, alignment: cross.normalize().dot(normal) };
}

function inspectCanvas(rest, bent, thickness, bend) {
  const label = `canvas/t=${thickness}/bend=${bend}`;
  const eyes = rest.parts.filter(p => /^canvas-eyelet-(-?1)-[0-4]$/.test(p.id));
  if (eyes.length !== 10) throw Error('Ten actual eyelet meshes are required.');
  const eyeFrames = new Map(eyes.map(p => [p.id, { before: frame(p.geometry), after: frame(part(bent, p.id).geometry) }]));
  check(label + '/metal rigid distances and actual bore rims', expect => {
    const rows = eyes.map(p => {
      const q = part(bent, p.id), f = eyeFrames.get(p.id), rigid = actualRigidity(p.geometry, q.geometry);
      const before = [...ring(p.geometry, 0).chords, ...ring(p.geometry, 6).chords], after = [...ring(q.geometry, 0).chords, ...ring(q.geometry, 6).chords];
      const maxChordChange = Math.max(...before.map((v, i) => Math.abs(v - after[i])));
      let maxRigidNormalError = 0;
      for (let i = 0; i < p.geometry.attributes.normal.count; i++) maxRigidNormalError = Math.max(maxRigidNormalError,
        degreeError(localNormal(nor(p.geometry, i), f.before), localNormal(nor(q.geometry, i), f.after)));
      expect(rigid.maximumDistanceChangeMm <= criteria.metalDistanceErrorMm, `${p.id}: rigid distance changed ${rigid.maximumDistanceChangeMm} mm`);
      expect(maxChordChange <= criteria.metalDistanceErrorMm, `${p.id}: bore-rim chord changed ${maxChordChange} mm`);
      expect(maxRigidNormalError <= criteria.normalTransportErrorDeg, `${p.id}: metal normals fail its actual rigid frame (${maxRigidNormalError} deg)`);
      expect(before.every(v => Math.abs(v - criteria.expectedInnerLipDiameterMm) < .01), `${p.id}: static actual inner lip is no longer 4.3 design mm`);
      const expectedCentre = globalBend(f.before.c, rest.last, bend).point;
      const centreError = f.after.c.distanceTo(expectedCentre);
      expect(centreError <= criteria.attachmentPositionErrorMm, `${p.id}: rigid attachment centre misses deformed cloth location by ${centreError} mm`);
      const expectedMove = f.before.c.distanceTo(expectedCentre), actualMove = f.before.c.distanceTo(f.after.c);
      if (expectedMove > .01) expect(actualMove > .01, `${p.id}: metal was frozen at its original world position`);
      if (bend && Number(p.id.at(-1)) < 4) expect(arrayHash(p.geometry.attributes.position.array) === arrayHash(q.geometry.attributes.position.array), `${p.id}: previously unaffected hardware positions changed`);
      return { partId: p.id, ...rigid, maxBoreChordChangeMm: maxChordChange, maximumRigidNormalErrorDeg: maxRigidNormalError, beforeChordRangeMm: [Math.min(...before), Math.max(...before)], afterChordRangeMm: [Math.min(...after), Math.max(...after)], centreErrorMm: centreError, actualCentreMovementMm: actualMove };
    }); return { eyelets: rows };
  });
  check(label + '/two cloth layers and sleeve flange seating', expect => {
    const rows = [], cache = new Map();
    for (const side of [-1, 1]) for (const name of [`canvas-quarter-${side}`, `canvas-perforated-facing-${side}`]) {
      const a = part(rest, name), b = part(bent, name);
      const groups = [0, 1].map(group => ({ group, before: exteriorLoops(a.geometry, group), after: exteriorLoops(b.geometry, group) }));
      for (const g of groups) expect(g.before.length === 6 && g.after.length === 6, `${name}/${g.group}: actual sheet must contain five holes and its outer boundary`);
      cache.set(name, { a, b, groups });
    }
    for (const p of eyes) {
      const [, side, row] = p.id.match(/^canvas-eyelet-(-?1)-([0-4])$/), f = eyeFrames.get(p.id);
      const cloth = [`canvas-quarter-${side}`, `canvas-perforated-facing-${side}`].map(id => cache.get(id));
      const realMeshes = rayMeshes([part(bent, p.id), ...cloth.map(x => x.b)]);
      for (const sheet of cloth) for (const group of sheet.groups) {
        const ids = nearestHole(sheet.a.geometry, group.before, f.before);
        const sameAfterLoop = group.after.some(loop => loop.length === ids.length && ids.every(i => loop.includes(i)));
        expect(sameAfterLoop, `${sheet.a.id}/${group.group}/${row}: hole boundary correspondence changed`);
        let maxMotionError = 0, maxNormalError = 0, minRadius = Infinity, maxRadius = 0, minDepth = Infinity, maxDepth = -Infinity;
        for (const i of ids) {
          const a = pos(sheet.a.geometry, i), b = pos(sheet.b.geometry, i), q = local(b, f.after);
          maxMotionError = Math.max(maxMotionError, b.distanceTo(move(a, f.before, f.after)));
          maxNormalError = Math.max(maxNormalError, degreeError(localNormal(nor(sheet.a.geometry, i), f.before), localNormal(nor(sheet.b.geometry, i), f.after)));
          const r = Math.hypot(q.x, q.y); minRadius = Math.min(minRadius, r); maxRadius = Math.max(maxRadius, r); minDepth = Math.min(minDepth, q.z); maxDepth = Math.max(maxDepth, q.z);
        }
        expect(maxMotionError <= criteria.attachmentPositionErrorMm, `${sheet.a.id}/${group.group}/${row}: actual hole edge misses the moving metal frame by ${maxMotionError} mm`);
        expect(maxNormalError <= criteria.normalTransportErrorDeg, `${sheet.a.id}/${group.group}/${row}: core cloth-hole normals do not follow rigid attachment (${maxNormalError} deg)`);
        const innerRadius = Math.min(...f.after.upper.radii), flangeRadius = Math.max(...f.after.flange.radii);
        expect(minRadius >= innerRadius + criteria.minimumBoreClothClearanceMm, `${sheet.a.id}/${group.group}/${row}: cloth edge intrudes into the clear metal bore`);
        expect(maxRadius <= flangeRadius - criteria.minimumFlangeOverlapMm, `${sheet.a.id}/${group.group}/${row}: flange no longer overlaps the actual cloth aperture`);
        // The shell's cut-wall vertices are separate copies. Checking only the
        // exterior and interior loops could miss stale walls left in world space.
        const walls = sheet.a.geometry.groups[2];
        if (!walls) throw Error('No actual aperture cut-wall render group.');
        const wallIds = new Set(sheet.a.geometry.index.array.slice(walls.start, walls.start + walls.count));
        const positionKeys = new Set(ids.map(i => pos(sheet.a.geometry, i).toArray().map(v => Math.round(v * 1e4)).join(',')));
        let measuredWallCopies = 0, maxWallMotionError = 0;
        for (const i of wallIds) {
          const a = pos(sheet.a.geometry, i), key = a.toArray().map(v => Math.round(v * 1e4)).join(',');
          if (!positionKeys.has(key)) continue;
          maxWallMotionError = Math.max(maxWallMotionError, pos(sheet.b.geometry, i).distanceTo(move(a, f.before, f.after))); measuredWallCopies++;
        }
        expect(measuredWallCopies >= ids.length, `${sheet.a.id}/${group.group}/${row}: actual cut walls do not follow all aperture edge vertices`);
        expect(maxWallMotionError <= criteria.attachmentPositionErrorMm, `${sheet.a.id}/${group.group}/${row}: duplicated cut-wall geometry loses attachment by ${maxWallMotionError} mm`);
        rows.push({ eyelet: p.id, clothPart: sheet.a.id, surfaceGroup: group.group, boundaryVertices: ids.length, measuredCutWallCopies: measuredWallCopies, maximumCutWallAttachmentErrorMm: maxWallMotionError, maximumAttachmentErrorMm: maxMotionError, maximumCoreNormalErrorDeg: maxNormalError, radialRangeMm: [minRadius, maxRadius], axialRangeMm: [minDepth, maxDepth], flangeOverlapMm: flangeRadius - maxRadius });
      }
      // Apertures are checked through the two real fabric shells and metal.
      // Laces and the separate tongue are intentionally not substituted for a
      // missing cloth wall or treated as an allegedly blocked metal bore.
      for (const [x, y] of [[0, 0], [criteria.boreProbeRadiusMm, 0], [-criteria.boreProbeRadiusMm, 0], [0, criteria.boreProbeRadiusMm], [0, -criteria.boreProbeRadiusMm]]) {
        const origin = f.after.c.clone().addScaledVector(f.after.x, x).addScaledVector(f.after.y, y).addScaledVector(f.after.z, 4);
        const hits = hitsAt(origin, f.after.z.clone().negate(), realMeshes, 10);
        expect(hits.length === 0, `${p.id}: actual bore ray (${x},${y}) blocked by ${hits.map(h => h.object.name).join(',')}`);
      }
      // Positive ray control: real metal flange must be present around the hole.
      for (let k = 0; k < 4; k++) {
        const r = 3.05, theta = k * Math.PI / 2;
        const origin = f.after.c.clone().addScaledVector(f.after.x, r * Math.cos(theta)).addScaledVector(f.after.y, r * Math.sin(theta)).addScaledVector(f.after.z, 4);
        const hit = hitsAt(origin, f.after.z.clone().negate(), realMeshes, 10)[0];
        expect(hit?.object.name === p.id, `${p.id}: metal flange does not cover the expected seating ring`);
      }
    }
    return { clothBoundaryMeasurements: rows, throughBoreRays: eyes.length * 5, positiveFlangeRays: eyes.length * 4 };
  });
  check(label + '/real lace endpoint rings follow their eyelets', expect => {
    const rows = endpointSpecs().map(([id, end, side, row]) => {
      const a = part(rest, id).geometry, b = part(bent, id).geometry, ids = endpointIds(a, end), f = eyeFrames.get(`canvas-eyelet-${side}-${row}`);
      if (a.attributes.position.count !== b.attributes.position.count) throw Error('Lace endpoint correspondence changed.');
      let maxMotionError = 0, maxRadius = 0;
      for (const i of ids) { const q = local(pos(b, i), f.after); maxRadius = Math.max(maxRadius, Math.hypot(q.x, q.y)); maxMotionError = Math.max(maxMotionError, pos(b, i).distanceTo(move(pos(a, i), f.before, f.after))); }
      const c = local(centroid(b, ids), f.after), bottom = local(f.after.lower.c, f.after).z;
      expect(maxMotionError <= criteria.attachmentPositionErrorMm, `${id}/${end}: lace endpoint loses attachment by ${maxMotionError} mm`);
      expect(Math.hypot(c.x, c.y) <= criteria.maximumLaceEndpointCentreRadialMm, `${id}/${end}: lace centre misses its actual bore`);
      expect(maxRadius <= Math.min(...f.after.upper.radii) - criteria.minimumLaceBoreClearanceMm, `${id}/${end}: endpoint cross-section clips the metal bore`);
      expect(c.z >= bottom - .01 && c.z < -.1, `${id}/${end}: endpoint does not enter the actual sleeve depth`);
      return { partId: id, end, eyelet: `canvas-eyelet-${side}-${row}`, maximumAttachmentErrorMm: maxMotionError, endpointCentreLocalMm: c.toArray(), maximumRadialExtentMm: maxRadius, sleeveBottomLocalMm: bottom };
    }); return { endpoints: rows };
  });
  check(label + '/independent shared field positions and differential normals', expect => {
    const field = independentCanvasMap(rest, bend, eyes), rows = [];
    let minimumJacobianDeterminant = Infinity, maximumPositionErrorMm = 0, maximumNormalErrorDeg = 0, measuredVertices = 0, measuredNormals = 0, measuredCentralBlendNormals = 0, measuredTransitionNormals = 0;
    for (const p of rest.parts.filter(p => !eyes.includes(p))) {
      const a = p.geometry, b = part(bent, p.id).geometry, count = a.attributes.position.count;
      expect(count === b.attributes.position.count && arrayHash(a.index.array) === arrayHash(b.index.array), `${p.id}: flexible geometry correspondence changed`);
      let minDet = Infinity, maxPositionError = 0, maxNormalError = 0, maxOutsideOriginalError = 0, maxInsideOriginalChange = 0, outsideVertices = 0, normals = 0, worstNormal = null;
      const sampled = new Set(Array.from({ length: Math.min(128, count) }, (_, k) => Math.floor(k * (count - 1) / Math.max(1, Math.min(128, count) - 1))));
      // Supplement the uniform index sample with real transition-band vertices,
      // where a rigid rotation of normals would miss the map's derivative.
      const transition = [];
      for (let i = 0; i < count; i++) { const z = a.attributes.position.getZ(i); if (z > field.axis - field.band && z < field.axis + field.band) transition.push(i); }
      for (let k = 0; k < Math.min(128, transition.length); k++) sampled.add(transition[Math.floor(k * transition.length / Math.min(128, transition.length))]);
      for (let i = 0; i < count; i++) {
        const P = pos(a, i), final = pos(b, i), expected = field.point(P), determinant = field.determinantAt(P);
        maxPositionError = Math.max(maxPositionError, expected.distanceTo(final)); minDet = Math.min(minDet, determinant);
        const old = globalBend(P, rest.last, bend), outside = P.z <= field.axis - field.band || P.z >= field.axis + field.band;
        if (outside) { maxOutsideOriginalError = Math.max(maxOutsideOriginalError, old.point.distanceTo(final)); outsideVertices++; }
        else maxInsideOriginalChange = Math.max(maxInsideOriginalChange, old.point.distanceTo(final));
        if (!sampled.has(i)) continue;
        const J = field.differential(P);
        if (!(J.determinant() > 0)) { expect(false, `${p.id}/${i}: independently differentiated map has nonpositive determinant`); continue; }
        const expectedNormal = nor(a, i).applyMatrix3(J.invert().transpose()).normalize(), error = degreeError(expectedNormal, nor(b, i));
        if (error > maxNormalError) { maxNormalError = error; worstNormal = { vertex: i, restMm: P.toArray(), errorDeg: error, expectedNormal: expectedNormal.toArray(), actualNormal: nor(b, i).toArray() }; }
        if (P.x > field.xLeft && P.x < field.xRight) measuredCentralBlendNormals++;
        if (!outside) measuredTransitionNormals++;
        normals++;
      }
      expect(minDet > 0, `${p.id}: nonpositive Jacobian at actual rest vertices (${minDet})`);
      expect(maxPositionError <= criteria.attachmentPositionErrorMm, `${p.id}: actual positions miss independently reconstructed shared field by ${maxPositionError} mm`);
      expect(maxNormalError <= criteria.normalTransportErrorDeg, `${p.id}: actual normals miss full-field numerical differential by ${maxNormalError} deg`);
      expect(maxOutsideOriginalError <= criteria.attachmentPositionErrorMm, `${p.id}: original bend changed outside the original band by ${maxOutsideOriginalError} mm`);
      expect(normals >= Math.min(64, count), `${p.id}: insufficient independent normal samples`);
      rows.push({ partId: p.id, actualVertices: count, sampledNormals: normals, minimumJacobianDeterminant: minDet, maximumPositionErrorMm: maxPositionError, maximumNormalErrorDeg: maxNormalError, outsideBandVertices: outsideVertices, maximumOutsideOriginalErrorMm: maxOutsideOriginalError, maximumInsideOriginalChangeMm: maxInsideOriginalChange, worstNormal });
      minimumJacobianDeterminant = Math.min(minimumJacobianDeterminant, minDet); maximumPositionErrorMm = Math.max(maximumPositionErrorMm, maxPositionError); maximumNormalErrorDeg = Math.max(maximumNormalErrorDeg, maxNormalError); measuredVertices += count; measuredNormals += normals;
    }
    expect(measuredCentralBlendNormals >= 30 && measuredTransitionNormals >= 30, 'Normal sample does not cover both transverse and longitudinal transition regions.');
    return { measuredVertices, measuredNormals, measuredCentralBlendNormals, measuredTransitionNormals, minimumJacobianDeterminant, maximumPositionErrorMm, maximumNormalErrorDeg, contract: field.contract, parts: rows,
      method: 'Every actual flexible vertex follows an independently reconstructed shared angle map; sampled normals use a 0.001 mm central finite difference of positions and an independent matrix inverse transpose. This tests sampled local orientation, not a continuum proof of global injectivity or collision-free motion.' };
  });
  check(label + '/cloth deformation does not introduce folded triangles', expect => {
    const rows = [];
    for (const side of [-1, 1]) for (const id of [`canvas-quarter-${side}`, `canvas-perforated-facing-${side}`]) {
      const a = part(rest, id).geometry, b = part(bent, id).geometry;
      expect(arrayHash(a.index.array) === arrayHash(b.index.array), `${id}: topology changes with prescribed bend`);
      let triangles = 0, minimumAreaMm2 = Infinity, minimumAlignment = Infinity;
      const existingNonpositiveTriangles = [], newFoldedTriangles = [];
      for (const group of a.groups.slice(0, 2)) for (let k = group.start; k < group.start + group.count; k += 3) {
        const before = triangleFacing(a, k / 3), after = triangleFacing(b, k / 3);
        if (before.alignment <= 0) existingNonpositiveTriangles.push(k / 3);
        if (after.areaMm2 <= 1e-9 || (before.alignment > 0 && after.alignment <= 0)) newFoldedTriangles.push({ triangle: k / 3, before, after });
        minimumAreaMm2 = Math.min(minimumAreaMm2, after.areaMm2); minimumAlignment = Math.min(minimumAlignment, after.alignment); triangles++;
      }
      expect(newFoldedTriangles.length === 0, `${id}: ${newFoldedTriangles.length} newly degenerate or reversed actual surface triangles`);
      rows.push({ partId: id, triangles, minimumAreaMm2, minimumAlignment, existingNonpositiveTriangles, newFoldedTriangles });
    }
    return { surfaces: rows, method: 'Actual triangle orientation versus independently transported stored normals, compared with the same rest triangles. Local self contact beyond this orientation gate also needs targeted browser/section review.' };
  });
  cases.push({ style: 'canvas', params: { ...rest.last.params, bend }, actualParts: bent.parts.length });
}

function inspectChelsea(params, name) {
  generatedModels++;
  const before = buildBaselineStyle('chelsea', params), after = build('chelsea', params);
  const a = part(before, 'chelsea-whole-vamp').geometry, b = part(after, 'chelsea-whole-vamp').geometry;
  check(`chelsea/${name}/actual front-meridian curvature improves`, expect => {
    expect(a.attributes.position.count === b.attributes.position.count && arrayHash(a.index.array) === arrayHash(b.index.array), 'Chelsea exterior correspondence changed; re-identify the actual curve before comparing.');
    // Only the frozen R13 surface locates a material vertex in the old mesh.
    // The candidate's analytic point/normal functions are not consulted here.
    const reference = baselineBootSurface(before.last), group = a.groups[0];
    const actualIds = [...new Set(a.index.array.slice(group.start, group.start + group.count))];
    const rows = [...Array.from({ length: 31 }, (_, j) => .33 * j / 30), ...Array.from({ length: 24 }, (_, j) => .33 + (j + 1) * .15 / 24), ...Array.from({ length: 48 }, (_, j) => .48 + (j + 1) * .52 / 48)];
    let maximumLocatorErrorMm = 0;
    const curve = rows.map(v => {
      const q = reference.point(0, v); let best = Infinity, id = null;
      for (const i of actualIds) { const d = pos(a, i).distanceToSquared(q); if (d < best) { best = d; id = i; } }
      maximumLocatorErrorMm = Math.max(maximumLocatorErrorMm, Math.sqrt(best));
      return { v, vertex: id, before: pos(a, id), after: pos(b, id) };
    });
    expect(maximumLocatorErrorMm <= .001, 'Frozen reference could not locate real baseline meridian vertices.');
    expect(new Set(curve.map(p => p.vertex)).size === rows.length, 'Meridian samples alias fewer actual vertices.');
    const metric = key => {
      let maximum = { curvaturePerMm: 0 }, minimumVerticalStepMm = Infinity;
      for (let i = 1; i < curve.length - 1; i++) {
        if (curve[i].v < .36125 || curve[i].v > .6425) continue;
        const A = curve[i - 1][key], B = curve[i][key], C = curve[i + 1][key];
        const ab = B.clone().sub(A), bc = C.clone().sub(B), ac = C.clone().sub(A);
        const k = 2 * ab.clone().cross(ac).length() / (ab.length() * bc.length() * ac.length());
        if (k > maximum.curvaturePerMm) maximum = { curvaturePerMm: k, v: curve[i].v, actualVertex: curve[i].vertex, positionMm: B.toArray() };
        minimumVerticalStepMm = Math.min(minimumVerticalStepMm, B.y - A.y, C.y - B.y);
      }
      return { maximum, minimumVerticalStepMm };
    };
    const oldMetric = metric('before'), newMetric = metric('after');
    expect(newMetric.maximum.curvaturePerMm <= .5 * oldMetric.maximum.curvaturePerMm, 'Actual local shoulder curvature peak has not decreased by at least half.');
    expect(newMetric.minimumVerticalStepMm > 0, 'The actual transition meridian folds down.');
    let maximumOutsideDisplacementMm = 0;
    for (const p of curve) if (p.v <= .36125 || p.v >= .6425) maximumOutsideDisplacementMm = Math.max(maximumOutsideDisplacementMm, p.before.distanceTo(p.after));
    expect(maximumOutsideDisplacementMm === 0, 'Candidate changes the protected meridian outside the local bridge.');
    return { actualRows: rows.length, maximumLocatorErrorMm, before: oldMetric, after: newMetric, peakRatio: newMetric.maximum.curvaturePerMm / oldMetric.maximum.curvaturePerMm, maximumOutsideDisplacementMm, scope: 'Actual mesh curvature is a geometry-change gate, not visual approval or an anatomical radius.' };
  });
  check(`chelsea/${name}/protected actual parts remain`, expect => {
    const protectedParts = ['chelsea-top-binding', 'chelsea-pull-loop', 'outsole', 'insole', 'stacked-heel', 'heel-toplift', 'welt--1', 'welt-1'];
    const rows = protectedParts.map(id => {
      const g = part(before, id).geometry, h = part(after, id).geometry;
      const positionsUnchanged = arrayHash(g.attributes.position.array) === arrayHash(h.attributes.position.array);
      const indicesUnchanged = arrayHash(g.index.array) === arrayHash(h.index.array);
      expect(positionsUnchanged && indicesUnchanged, `${id}: protected actual geometry changed`);
      return { partId: id, positionsUnchanged, indicesUnchanged };
    });
    // Boundary and stitch-ray regressions remain separate in the complete
    // geometry gate; this increment does not claim to have rerun them here.
    return { protectedParts: rows, seamAndGoreRegression: 'The unchanged review-regressions/geometry gate separately checks actual cut boundaries, side-ray first hits and every complete exposed/embedded stitch cycle.' };
  });
  cases.push({ style: 'chelsea', parameterPreset: name, params: { ...after.last.params }, actualParts: after.parts.length });
  dispose(before); dispose(after);
}

// Small construction openings are identified from real mesh boundary topology.
// No `apertures`, selected-hole metadata, seat centres or claimed connection
// graphs are used as geometric evidence below.
function smallHoles(g, group, expected) {
  const holes = exteriorLoops(g, group).map(ids => ({ ids, c: centroid(g, ids) })).filter(h => Math.max(...h.ids.map(i => pos(g, i).distanceTo(h.c))) < 4);
  if (holes.length !== expected) throw Error(`Expected ${expected} actual small holes in render surface ${group}; found ${holes.length}.`);
  return holes;
}
function polygonFrame(g, hole, N) {
  const x = pos(g, hole.ids[0]).sub(hole.c); x.addScaledVector(N, -x.dot(N)).normalize();
  const y = N.clone().cross(x).normalize();
  const project = p => { const d = p.clone().sub(hole.c); return new T.Vector2(d.dot(x), d.dot(y)); };
  const points = hole.ids.map(i => project(pos(g, i))).sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
  const clearance = p => {
    const q = project(p); let inside = false, distance = Infinity;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[j], b = points[i], edge = b.clone().sub(a), t = T.MathUtils.clamp(q.clone().sub(a).dot(edge) / edge.lengthSq(), 0, 1);
      distance = Math.min(distance, q.distanceTo(a.clone().addScaledVector(edge, t)));
      if ((a.y > q.y) !== (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside ? distance : -distance;
  };
  return { x, y, clearance };
}
// THREE only iterates render groups when a material array is supplied. Tubes
// and mounting posts have no groups and therefore require a single material;
// otherwise their actual triangles would silently vanish from reverse rays.
const groupedMesh = p => new T.Mesh(p.geometry, p.geometry.groups.length ? Array.from({ length: Math.max(...p.geometry.groups.map(g => g.materialIndex + 1)) }, () => rayMaterial) : rayMaterial);
function uniqueHits(origin, direction, target, far = 100) {
  const result = [];
  for (const hit of hitsAt(origin, direction, [target], far)) if (!result.some(h => Math.abs(h.distance - hit.distance) < 1e-6)) result.push(hit);
  return result;
}
function supportGap(top, support, P, N) {
  const origin = P.clone().addScaledVector(N, 25), direction = N.clone().negate();
  const inner = hitsAt(origin, direction, [groupedMesh(top)], 50).find(h => h.face.materialIndex === 1);
  const outer = hitsAt(origin, direction, [groupedMesh(support)], 50).find(h => h.face.materialIndex === 0);
  return { actualTopInnerHit: !!inner, actualSupportOuterHit: !!outer, gapMm: inner && outer ? outer.distance - inner.distance : null, innerMm: inner?.point.toArray(), supportMm: outer?.point.toArray() };
}
function nearestTriangleDistance(g, p) {
  let distance = Infinity, triangle = null;
  for (let k = 0; k < g.index.count; k += 3) {
    const t = new T.Triangle(...Array.from(g.index.array.slice(k, k + 3), i => pos(g, i)));
    const d = t.closestPointToPoint(p, V()).distanceTo(p);
    if (d < distance) { distance = d; triangle = k / 3; }
  }
  return { distanceMm: distance, triangle };
}
const rayPositiveControls = new Map();
function actualRayPositiveControl(p) {
  if (rayPositiveControls.has(p.geometry)) return rayPositiveControls.get(p.geometry);
  const g = p.geometry;
  for (let k = 0; k < g.index.count; k += 3) {
    const triangle = new T.Triangle(...Array.from(g.index.array.slice(k, k + 3), i => pos(g, i)));
    if (triangle.getArea() < 1e-9) continue;
    const C = triangle.getMidpoint(V()), N = triangle.getNormal(V()), hits = hitsAt(C.clone().addScaledVector(N, .1), N.clone().negate(), [groupedMesh(p)], .2);
    const error = hits.length ? Math.min(...hits.map(h => h.point.distanceTo(C))) : Infinity;
    if (error > 1e-5) throw Error(`${p.id}: actual target triangle failed its positive ray control (${error} mm).`);
    const result = { partId: p.id, triangle: k / 3, targetCentroidErrorMm: error }; rayPositiveControls.set(g, result); return result;
  }
  throw Error(`${p.id}: no nondegenerate actual target triangle for a positive ray control.`);
}
function clippedPlaneContact(P, Q, triangle) {
  // The source edge may extend tens of millimetres beyond a tiny contact face.
  // Compare plane separation only where its orthogonal projection lies within
  // the actual target triangle. Barycentric coordinates are affine along it.
  const a = triangle.getBarycoord(P, V()).toArray(), b = triangle.getBarycoord(Q, V()).toArray();
  let lo = 0, hi = 1;
  for (let k = 0; k < 3; k++) {
    const slope = b[k] - a[k];
    if (Math.abs(slope) < 1e-14) { if (a[k] < -1e-10) return null; continue; }
    const cross = -a[k] / slope;
    if (slope > 0) lo = Math.max(lo, cross); else hi = Math.min(hi, cross);
  }
  if (hi < lo - 1e-10) return null;
  const plane = new T.Plane().setFromCoplanarPoints(triangle.a, triangle.b, triangle.c), p = plane.distanceToPoint(P), q = plane.distanceToPoint(Q);
  return { interval: [lo, hi], maximumContactFootprintDeviationMm: Math.max(Math.abs(p + lo * (q - p)), Math.abs(p + hi * (q - p))), unclippedEndpointDeviationMm: Math.max(Math.abs(p), Math.abs(q)) };
}
const actualEdgeNeighbours = new Map();
const vertexKey = p => p.toArray().join(',');
const edgeKey = (a, b) => { const p = vertexKey(a), q = vertexKey(b); return p < q ? p + '/' + q : q + '/' + p; };
function neighbourContact(g, hit, P, Q, triangle) {
  let edges = actualEdgeNeighbours.get(g);
  if (!edges) {
    edges = new Map();
    for (let k = 0; k < g.index.count; k += 3) {
      const vertices = Array.from(g.index.array.slice(k, k + 3), i => pos(g, i));
      for (let j = 0; j < 3; j++) { const key = edgeKey(vertices[j], vertices[(j + 1) % 3]); if (!edges.has(key)) edges.set(key, []); edges.get(key).push(k / 3); }
    }
    actualEdgeNeighbours.set(g, edges);
  }
  const vertices = [triangle.a, triangle.b, triangle.c];
  for (let j = 0; j < 3; j++) {
    const a = vertices[j], b = vertices[(j + 1) % 3], distance = new T.Line3(a, b).closestPointToPoint(hit.point, true, V()).distanceTo(hit.point);
    if (distance > criteria.meshPlaneContactToleranceMm) continue;
    for (const face of edges.get(edgeKey(a, b)) || []) {
      if (face === hit.faceIndex) continue;
      const adjacent = new T.Triangle(...Array.from(g.index.array.slice(face * 3, face * 3 + 3), i => pos(g, i))), contact = clippedPlaneContact(P, Q, adjacent);
      if (contact && contact.maximumContactFootprintDeviationMm <= criteria.meshPlaneContactToleranceMm) {
        const length = P.distanceTo(Q), hitT = P.distanceTo(hit.point) / length, localT = T.MathUtils.clamp(hitT, contact.interval[0], contact.interval[1]);
        const hitDistanceFromFootprintMm = Math.abs(localT - hitT) * length;
        // A nearby plane somewhere else on the extended edge is insufficient:
        // its clipped footprint must include this very intersection locally.
        if (hitDistanceFromFootprintMm <= criteria.meshPlaneContactToleranceMm) return { ...contact, adjacentActualTriangle: face, contactDistanceFromSharedEdgeMm: distance, hitDistanceFromFootprintMm };
      }
    }
  }
  return null;
}
function meshCrossings(a, b) {
  const edges = new Set(), g = a.geometry, h = b.geometry, target = groupedMesh(b);
  const targetRayPositiveControl = actualRayPositiveControl(b);
  for (let k = 0; k < g.index.count; k += 3) for (let j = 0; j < 3; j++) {
    const i = g.index.array[k + j], n = g.index.array[k + (j + 1) % 3]; edges.add(Math.min(i, n) + ',' + Math.max(i, n));
  }
  let rawIntersections = 0, planeContacts = 0, adjacentFaceContacts = 0, maximumPlaneContactDeviationMm = 0, maximumUnclippedEndpointDeviationMm = 0;
  const transverseExamples = [], adjacentContactExamples = [];
  for (const edge of edges) {
    const [i, j] = edge.split(',').map(Number), P = pos(g, i), Q = pos(g, j), length = P.distanceTo(Q);
    if (length <= 2 * criteria.meshEdgeEndpointToleranceMm) continue;
    const ray = new T.Raycaster(P, Q.clone().sub(P).divideScalar(length), criteria.meshEdgeEndpointToleranceMm, length - criteria.meshEdgeEndpointToleranceMm);
    for (const hit of ray.intersectObject(target, false)) {
      rawIntersections++;
      const triangle = new T.Triangle(pos(h, hit.face.a), pos(h, hit.face.b), pos(h, hit.face.c));
      let contact = clippedPlaneContact(P, Q, triangle);
      if (!contact || contact.maximumContactFootprintDeviationMm > criteria.meshPlaneContactToleranceMm) {
        // A genuine contact along a solid's sharp edge also hits the adjoining
        // side triangle. It is contact only when the actual shared edge is near
        // this hit and its actual neighbouring face satisfies the same local
        // plane tolerance. No part-name exception or increased tolerance.
        const adjacent = neighbourContact(h, hit, P, Q, triangle);
        if (adjacent) { contact = adjacent; adjacentFaceContacts++; if (adjacentContactExamples.length < 4) adjacentContactExamples.push({ edge: [i, j], targetTriangle: hit.faceIndex, pointMm: hit.point.toArray(), contact: adjacent }); }
      }
      if (contact && contact.maximumContactFootprintDeviationMm <= criteria.meshPlaneContactToleranceMm) {
        planeContacts++; maximumPlaneContactDeviationMm = Math.max(maximumPlaneContactDeviationMm, contact.maximumContactFootprintDeviationMm); maximumUnclippedEndpointDeviationMm = Math.max(maximumUnclippedEndpointDeviationMm, contact.unclippedEndpointDeviationMm);
      } else if (transverseExamples.length < 8) transverseExamples.push({ edge: [i, j], targetTriangle: hit.faceIndex, pointMm: hit.point.toArray(), projectedFootprint: contact });
    }
  }
  return { testedEdges: edges.size, targetRayPositiveControl, rawIntersections, planeContacts, adjacentFaceContacts, transverseIntersections: rawIntersections - planeContacts, maximumPlaneContactDeviationMm, maximumUnclippedEndpointDeviationMm, adjacentContactExamples, transverseExamples };
}
function inspectIntersectionControls() {
  check('monk/independent actual mesh ray and penetration controls', expect => {
    const source = { id: 'synthetic-control-source-no-groups', geometry: new T.BoxGeometry(1, 1, 1) }; source.geometry.clearGroups();
    const results = [];
    for (const [name, position, mustPenetrate] of [['deep penetration', [.25, .21, .17], true], ['0.001 mm penetration', [.15, .999, .20], true], ['Float32-scale 0.000001 mm contact', [.15, .999999, .20], false]]) {
      const target = { id: 'synthetic-control-' + name, geometry: new T.BoxGeometry(1, 1, 1) }; target.geometry.clearGroups(); target.geometry.translate(...position);
      const forward = meshCrossings(source, target), reverse = meshCrossings(target, source), crossings = forward.transverseIntersections + reverse.transverseIntersections;
      expect(mustPenetrate ? crossings > 0 : crossings === 0, `${name}: independent contact classifier ${mustPenetrate ? 'missed real penetration' : 'mistook Float32 contact for a transverse crossing'}`);
      expect(forward.rawIntersections + reverse.rawIntersections > 0, `${name}: ray test silently skipped group-free actual target triangles`);
      results.push({ name, mustPenetrate, forward, reverse }); target.geometry.dispose();
    }
    source.geometry.dispose(); return { results, method: 'Synthetic closed indexed meshes exercise actual ray casting and contact classification; real shoe acceptance still uses final shoe triangles.' };
  });
}
function inspectMonk(thickness) {
  const model = build('monk', { thickness, bend: 0 }), last = model.last, label = `monk/t=${thickness}/static`;
  check(label + '/pin enters the actual selected strap hole', expect => {
    const rows = [];
    for (const i of [0, 1]) {
      const strap = part(model, `monk-perforated-strap-${i}`), pin = part(model, `monk-buckle-prong-${i}`), framePart = part(model, `monk-buckle-frame-${i}`), g = strap.geometry, pg = pin.geometry;
      const outer = smallHoles(g, 0, 4).sort((a, b) => b.c.y - a.c.y), inner = smallHoles(g, 1, 4);
      const hole = outer[0], below = inner.slice().sort((a, b) => a.c.distanceTo(hole.c) - b.c.distanceTo(hole.c))[0];
      const frameCentre = new T.Box3().setFromBufferAttribute(framePart.geometry.attributes.position).getCenter(V());
      expect(outer.slice().sort((a, b) => a.c.distanceTo(frameCentre) - b.c.distanceTo(frameCentre))[0] === hole, `buckle ${i}: the first actual hole is not the one under the frame`);
      const N = hole.c.clone().sub(below.c).normalize(), outerPolygon = polygonFrame(g, hole, N), innerPolygon = polygonFrame(g, below, N);
      expect(pg.attributes.position.count % 7 === 0 && pg.index.count === (pg.attributes.position.count / 7 - 1) * 36, `buckle ${i}: identify changed actual pin sections before accepting engagement`);
      const tipIds = Array.from({ length: 6 }, (_, k) => pg.attributes.position.count - 7 + k), rootIds = [0, 1, 2, 3, 4, 5];
      const tip = centroid(pg, tipIds), pinRoot = centroid(pg, rootIds);
      const innerDepth = below.c.clone().sub(hole.c).dot(N), tipDepth = tip.clone().sub(hole.c).dot(N);
      const tipAboveInner = Math.max(...tipIds.map(k => pos(pg, k).sub(below.c).dot(N)));
      let maximumAboveOuterMm = -Infinity;
      for (let k = 0; k < pg.attributes.position.count; k++) maximumAboveOuterMm = Math.max(maximumAboveOuterMm, pos(pg, k).sub(hole.c).dot(N));
      const minimumTipRimClearanceMm = Math.min(...tipIds.flatMap(k => [outerPolygon.clearance(pos(pg, k)), innerPolygon.clearance(pos(pg, k))]));
      expect(maximumAboveOuterMm > .10 && tipAboveInner <= -criteria.monkPinExitBelowInnerRingMm, `buckle ${i}: actual pin does not extend from above the outer hole through its actual inner ring (tip relative to inner ${tipAboveInner} mm)`);
      expect(minimumTipRimClearanceMm >= criteria.monkPinRimClearanceMm, `buckle ${i}: actual terminal pin section clips the projected physical hole rims (${minimumTipRimClearanceMm} mm)`);
      const frameHits = uniqueHits(pinRoot, V(.917, .271, .288).normalize(), groupedMesh(framePart));
      expect(frameHits.length % 2 === 1, `buckle ${i}: pin root has no solid attachment in the actual frame`);
      let clearBoreRays = 0;
      for (const [x, y] of [[0, 0], [.55, 0], [-.55, 0], [0, .55], [0, -.55]]) {
        const origin = hole.c.clone().addScaledVector(outerPolygon.x, x).addScaledVector(outerPolygon.y, y).addScaledVector(N, 4);
        const hit = hitsAt(origin, N.clone().negate(), [groupedMesh(strap)], 10);
        expect(hit.length === 0, `buckle ${i}: selected real strap hole has no clear bore at (${x}, ${y})`); if (!hit.length) clearBoreRays++;
      }
      rows.push({ buckle: i, actualOuterHoleVertices: hole.ids.length, actualInnerHoleVertices: below.ids.length, outerCentreMm: hole.c.toArray(), innerCentreMm: below.c.toArray(), innerRingDepthMm: innerDepth, pinTipDepthMm: tipDepth, maximumPinTipAboveInnerRingMm: tipAboveInner, maximumAboveOuterMm, minimumTipRimClearanceMm, pinRootFrameRayIntersections: frameHits.length, clearBoreRays });
    }
    return { buckles: rows, method: 'Actual outer/inner boundary loops identify the selected opening. Pin end sections must fit both projected rims and exit below the inner ring; the separate full-mesh intersection gate checks the intervening shell.' };
  });
  check(label + '/actual layer support clearances', expect => {
    const rows = [];
    for (const [i, station] of [.351, .447].entries()) {
      const strap = part(model, `monk-perforated-strap-${i}`), anchor = part(model, `monk-buckle-anchor-${i}`), flap = part(model, 'monk-overlap-flap'), quarter = part(model, 'monk-open-quarters');
      const samples = [];
      // Last coordinates aim the ray; acceptance uses real rendered inner/outer
      // triangle hits. The u=0 perimeter itself is excluded as a boundary ray.
      for (const u of [.05, .12]) for (const v of [.2, .5, .8]) {
        const theta = .27 + 1.16 * u, s = station + .009 * (theta - 1) + (v - .5) * 15 / last.L;
        samples.push({ relationship: 'strap inner / overlap flap outer', u, v, ...supportGap(strap, flap, last.at(s, theta), last.normal(s, theta)) });
      }
      for (const theta of [1.31, 1.40, 1.47]) for (const v of [.2, .5, .8]) {
        const s = station + (v - .5) * 11 / last.L;
        samples.push({ relationship: 'buckle seat inner / quarter outer', theta, v, ...supportGap(anchor, quarter, last.at(s, theta), last.normal(s, theta)) });
      }
      for (const s of samples) {
        expect(s.actualTopInnerHit && s.actualSupportOuterHit, `buckle ${i}/${s.relationship}: missing an actual support-surface ray hit`);
        expect(s.gapMm !== null && s.gapMm >= criteria.monkSupportGapRangeMm[0] && s.gapMm <= criteria.monkSupportGapRangeMm[1], `buckle ${i}/${s.relationship}: actual static gap ${s.gapMm} mm is outside [0, .25] mm`);
      }
      rows.push({ buckle: i, samples });
    }
    return { buckles: rows, scope: 'Static display geometry support interval, not a manufacturing clearance or a stitched/load-bearing joint simulation.' };
  });
  check(label + '/actual pierced seats and static mounting posts', expect => {
    generatedModels++; const baseline = buildBaselineStyle('monk', { thickness, bend: 0 }), rows = [];
    try {
      for (const i of [0, 1]) {
        const anchor = part(model, `monk-buckle-anchor-${i}`), framePart = part(model, `monk-buckle-frame-${i}`), oldFrame = part(baseline, framePart.id);
        expect(arrayHash(framePart.geometry.attributes.position.array) === arrayHash(oldFrame.geometry.attributes.position.array) && arrayHash(framePart.geometry.index.array) === arrayHash(oldFrame.geometry.index.array), `buckle ${i}: protected original metal frame geometry changed`);
        const posts = [0, 1].map(k => model.parts.find(p => p.id === `monk-buckle-mount-${i}-${k}`));
        expect(posts.every(Boolean), `buckle ${i}: two real project-designed mounting-post meshes are missing`);
        if (!posts.every(Boolean)) { rows.push({ buckle: i, actualPosts: posts.filter(Boolean).length, status: 'missing actual static connection' }); continue; }
        const outer = smallHoles(anchor.geometry, 0, 2), inner = smallHoles(anchor.geometry, 1, 2), usedHoles = new Set();
        for (const post of posts) {
          const g = post.geometry;
          expect(g.attributes.position.count === 98 && g.index.count === 576, `${post.id}: re-identify the changed real post rings before testing`);
          const ringIds = r => Array.from({ length: 12 }, (_, k) => r * 12 + k), ringCentre = r => centroid(g, ringIds(r));
          const N = ringCentre(3).sub(ringCentre(2)).normalize(), C = ringCentre(3).addScaledVector(N, -.015);
          const hole = outer.slice().sort((a, b) => a.c.distanceTo(C) - b.c.distanceTo(C))[0], below = inner.slice().sort((a, b) => a.c.distanceTo(C) - b.c.distanceTo(C))[0];
          usedHoles.add(hole);
          const radial = p => { const d = p.clone().sub(C); return d.addScaledVector(N, -d.dot(N)).length(); };
          const radialRange = [...hole.ids, ...below.ids].map(k => radial(pos(anchor.geometry, k)));
          const bodyRadius = Math.max(...[...ringIds(2), ...ringIds(3)].map(k => radial(pos(g, k))));
          const flangeRadius = Math.min(...[...ringIds(0), ...ringIds(4)].map(k => radial(pos(g, k))));
          expect(Math.min(...radialRange) >= bodyRadius + .02, `${post.id}: real pierced seat clips the mount body`);
          expect(Math.max(...radialRange) <= flangeRadius - .03, `${post.id}: real flanges do not cover both physical seat openings`);
          const topSamples = [...ringIds(7), 97].map(k => ({ vertex: k, ...nearestTriangleDistance(framePart.geometry, pos(g, k)) }));
          const maximumFrameContactErrorMm = Math.max(...topSamples.map(s => s.distanceMm));
          expect(maximumFrameContactErrorMm <= criteria.monkMountFrameContactMm, `${post.id}: actual top separates from the unchanged frame by ${maximumFrameContactErrorMm} mm`);
          const X = pos(g, 0).sub(ringCentre(0)).normalize(), Y = N.clone().cross(X).normalize(), seatingRays = [];
          for (let k = 0; k < 4; k++) {
            const theta = k * Math.PI / 2, origin = C.clone().addScaledVector(X, .55 * Math.cos(theta)).addScaledVector(Y, .55 * Math.sin(theta)).addScaledVector(N, 1);
            const clothHits = hitsAt(origin, N.clone().negate(), [groupedMesh(anchor)], 6), topHit = clothHits.find(h => h.face.materialIndex === 0), innerHit = clothHits.find(h => h.face.materialIndex === 1);
            const metalHits = uniqueHits(origin, N.clone().negate(), groupedMesh(post), 6);
            const upper = topHit && metalHits.filter(h => h.distance <= topHit.distance + 1e-6).at(-1), lower = innerHit && metalHits.find(h => h.distance >= innerHit.distance - 1e-6);
            const upperGap = topHit && upper ? topHit.distance - upper.distance : null, lowerGap = innerHit && lower ? lower.distance - innerHit.distance : null;
            expect(upperGap !== null && lowerGap !== null && upperGap >= -1e-5 && lowerGap >= -1e-5 && upperGap <= .10 && lowerGap <= .10, `${post.id}: real retaining flanges fail to bracket the actual seat at radial sample ${k} (gaps ${upperGap}, ${lowerGap} mm)`);
            seatingRays.push({ sample: k, upperGapMm: upperGap, lowerGapMm: lowerGap });
          }
          rows.push({ buckle: i, partId: post.id, actualSeatOuterVertices: hole.ids.length, actualSeatInnerVertices: below.ids.length, actualHoleRadialRangeMm: [Math.min(...radialRange), Math.max(...radialRange)], actualBodyRadiusMm: bodyRadius, actualMinimumFlangeRadiusMm: flangeRadius, maximumFrameContactErrorMm, topSamples, seatingRays });
        }
        expect(usedHoles.size === 2, `buckle ${i}: two posts were assigned to the same actual seat opening`);
      }
    } finally { dispose(baseline); }
    return { mounts: rows, design: 'This workbench\'s generic static mounting geometry; no inferred commercial hidden construction or opening mechanism.' };
  });
  check(label + '/actual static closure has no transverse interference', expect => {
    const rows = [];
    for (const i of [0, 1]) {
      const pin = part(model, `monk-buckle-prong-${i}`), strap = part(model, `monk-perforated-strap-${i}`), framePart = part(model, `monk-buckle-frame-${i}`), anchor = part(model, `monk-buckle-anchor-${i}`), quarter = part(model, 'monk-open-quarters'), vamp = part(model, 'monk-integral-vamp-tongue');
      const pairs = [[pin, strap], [pin, vamp], [framePart, strap]];
      for (const k of [0, 1]) {
        const post = model.parts.find(p => p.id === `monk-buckle-mount-${i}-${k}`);
        expect(!!post, `buckle ${i}/${k}: missing post prevents a complete connection collision check`);
        if (post) for (const target of [strap, anchor, quarter, framePart]) pairs.push([post, target]);
      }
      for (const [a, b] of pairs) {
        const forward = meshCrossings(a, b), reverse = meshCrossings(b, a);
        expect(forward.transverseIntersections === 0 && reverse.transverseIntersections === 0, `${a.id} / ${b.id}: actual indexed meshes intersect transversely (${forward.transverseIntersections}, ${reverse.transverseIntersections})`);
        rows.push({ a: a.id, b: b.id, forward, reverse });
      }
    }
    return { pairs: rows, method: 'Bidirectional indexed-mesh edge/triangle intersections with a positive ray control for each actual target. Endpoint contacts within 1e-5 mm are excluded. Source edges are projected and clipped to the actual target triangle footprint before the unchanged 2e-5 mm plane tolerance. Sharp-edge contacts additionally require a hit within 2e-5 mm of a real shared edge and the same local plane tolerance in an actual adjacent face. Raw crossings, adjacency evidence and unclipped endpoint deviations remain explicit; no part pair is exempted. Synthetic penetrations must still fail. Finite-mesh static contact check, not force, opening or wear simulation.' };
  });
  cases.push({ style: 'monk', params: { ...last.params }, actualParts: model.parts.length }); dispose(model);
}

for (const thickness of ['ALL', 'A'].includes(requestedLane) ? criteria.thicknessesMm : []) {
  const rest = build('canvas', { thickness, bend: 0 });
  if (thickness === 1.35) {
    const repeat = build('canvas', { thickness, bend: 0 });
    check('static Float32 calibration before .01 mm rigidity gate', expect => {
      let repeatMax = 0, roundTripMax = 0, ringDeviation = 0;
      const R = new T.Matrix4().makeRotationFromEuler(new T.Euler(.43, -.21, .17)); R.setPosition(31, -19, 42);
      const inverse = R.clone().invert();
      for (const p of rest.parts.filter(p => p.kind === 'eyelet')) {
        const other = part(repeat, p.id).geometry;
        expect(arrayHash(p.geometry.attributes.position.array) === arrayHash(other.attributes.position.array), `${p.id}: repeated static construction changed actual positions`);
        const test = p.geometry.clone(); test.applyMatrix4(R); test.applyMatrix4(inverse);
        repeatMax = Math.max(repeatMax, actualRigidity(p.geometry, other).maximumDistanceChangeMm);
        roundTripMax = Math.max(roundTripMax, actualRigidity(p.geometry, test).maximumDistanceChangeMm);
        ringDeviation = Math.max(ringDeviation, ...ring(p.geometry, 0).chords.map(d => Math.abs(d - 4.3)));
        test.dispose();
      }
      expect(Math.max(repeatMax, roundTripMax, ringDeviation) < criteria.metalDistanceErrorMm / 10, '.01 mm gate has insufficient margin above observed Float32 static noise');
      return { repeatedStaticDistanceErrorMm: repeatMax, rigidFloat32RoundTripDistanceErrorMm: roundTripMax, staticBoreChordDeviationMm: ringDeviation, gateMm: criteria.metalDistanceErrorMm };
    }); dispose(repeat);
  }
  for (const bend of criteria.bendDegrees) {
    const bent = bend ? build('canvas', { thickness, bend }) : rest;
    try { inspectCanvas(rest, bent, thickness, bend); }
    catch (error) { check(`canvas/t=${thickness}/bend=${bend}/case setup`, expect => { expect(false, error.stack || error.message); }); }
    if (bent !== rest) dispose(bent);
  }
  dispose(rest);
}
if (['ALL', 'B'].includes(requestedLane)) for (const [name, params] of [['default', {}], ['all-low', { length: .9, width: .88, instep: -5, thickness: .9 }], ['all-high', { length: 1.1, width: 1.15, instep: 8, thickness: 2.1 }]]) inspectChelsea(params, name);
if (['ALL', 'C'].includes(requestedLane)) { inspectIntersectionControls(); for (const thickness of criteria.thicknessesMm) inspectMonk(thickness); }
const laneContracts = {
  A: { style: 'canvas', expectedCheckCount: 46, expectedCases: criteria.thicknessesMm.flatMap(t => criteria.bendDegrees.map(b => `thickness=${t}/bend=${b}`)), caseKey: c => `thickness=${c.params.thickness}/bend=${c.params.bend}` },
  B: { style: 'chelsea', expectedCheckCount: 6, expectedCases: ['default', 'all-low', 'all-high'], caseKey: c => c.parameterPreset },
  C: { style: 'monk', expectedCheckCount: 13, expectedCases: criteria.thicknessesMm.map(t => `thickness=${t}/bend=0`), caseKey: c => `thickness=${c.params.thickness}/bend=${c.params.bend}` }
};
const laneResults = Object.fromEntries(Object.entries(laneContracts).map(([lane, contract]) => {
  const requested = requestedLane === 'ALL' || requestedLane === lane, laneChecks = checks.filter(c => c.lane === lane), actualCases = cases.filter(c => c.style === contract.style).map(contract.caseKey).sort(), expectedCases = [...contract.expectedCases].sort();
  const complete = requested && JSON.stringify(actualCases) === JSON.stringify(expectedCases) && laneChecks.length === contract.expectedCheckCount && laneChecks.every(c => c.passed);
  return [lane, { implemented: true, requested, expectedCases, actualCases, expectedCheckCount: contract.expectedCheckCount, checkCount: laneChecks.length, passedChecks: laneChecks.filter(c => c.passed).length, failedChecks: laneChecks.filter(c => !c.passed).length, complete }];
}));
check('required lanes produced the requested case and check matrix', expect => {
  for (const [lane, result] of Object.entries(laneResults)) if (result.requested) expect(result.complete, `Lane ${lane} is incomplete or failed; a requestedLane label alone cannot accept the increment.`);
  return { laneResults };
});
check('producer source stayed unchanged during independent increment', expect => {
  const after = Object.fromEntries(sourceFiles.map(p => [p, hash(fs.readFileSync(path.join(root, p)))]));
  for (const p of sourceFiles) expect(beforeFiles.get(p).equals(fs.readFileSync(path.join(root, p))), `${p} changed during this run; freeze production before accepting evidence`);
  for (const p of baselineFiles) expect(beforeBaseline.get(p).equals(fs.readFileSync(path.join(baselineRoot, p))), `R13 baseline ${p} changed during this run; its negative evidence is invalid`);
  expect(testBytes.equals(fs.readFileSync(fileURLToPath(import.meta.url))), 'Independent test file changed during execution; bind one unchanged test version.');
  return { before: producerHashes, after, r13BaselineHashes: baselineHashes, testSha256: hash(testBytes) };
});
rayMaterial.dispose();
const report = {
  schemaVersion: 2, task: 'SHOE-R14-CONSTRUCTION-FLEX', generatedAtUtc: new Date().toISOString(),
  candidateRoot: root, sourceCommit: process.env.GITHUB_SHA || process.env.SOURCE_COMMIT || 'LOCAL_UNCOMMITTED',
  runtime: { node: process.version, v8: process.versions.v8 },
  requestedLane, producerHashes, r13BaselineHashes: baselineHashes, testSha256: hash(testBytes), criteria,
  generatedModels, cases, laneResults, checks,
  summary: { passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed).length, checks: checks.length },
  scope: { independentIncrement: true, measuredFinalGeometry: true, rendered: false, visualAccepted: false, physicalSolver: false, manufacturingValidated: false, wearerFitValidated: false, humanApproval: false, userApproval: false },
  limits: ['This increment covers the requested Canvas attachment field, Chelsea actual-mesh shoulder, and project-designed static Monk connection. Numeric acceptance remains separate from SOURCE/PUBLIC visual review.', 'Actual Canvas bore rays cover two canvas shells and metal; laces and the independent tongue are separate actual meshes, not a claim of empty space through the entire shoe.', 'The prescribed bend and static connection checks do not solve forces, opening mechanics, manufacturing tolerances or wearer fit.']
};
if (output) { const p = path.resolve(output); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify(output ? { sourceCommit: report.sourceCommit, requestedLane, output: path.resolve(output), summary: report.summary, failures: checks.filter(c => !c.passed).map(c => ({ name: c.name, failures: c.failures.slice(0, 2), totalFailures: c.failures.length })) } : report, null, 2));
if (report.summary.failed) process.exitCode = 1;
