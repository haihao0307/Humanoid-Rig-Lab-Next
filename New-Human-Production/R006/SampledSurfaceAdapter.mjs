import * as THREE from 'three';
import {
  buildCompactBinding,
  bindCompactArrays,
  COMPACT_INFLUENCES,
  COMPACT_WEIGHT_SCALE
} from '../../reconstruction/binding.mjs';

export const NEW_HUMAN_SOURCE = Object.freeze({
  filename: 'human+figure+3d+model (1).usdz',
  bytes: 36915776,
  sha256: 'b0435f3f30e0d63b6d4527000b7995b16fa91ca0ba8cb16b811be285e4fe7567'
});

export const COORDINATE_CONTRACT = Object.freeze({
  handedness: 'right',
  upAxis: 'Y',
  forwardAxis: 'Z',
  characterLeftAxis: '-X',
  units: 'metre'
});

export const R2_REGION = Object.freeze({
  HEAD_FACE_EARS: 1,
  SHOULDER_NECK: 2,
  TORSO: 4,
  PELVIS: 8,
  LEFT_ARM: 16,
  RIGHT_ARM: 32,
  LEFT_LEG: 64,
  RIGHT_LEG: 128,
  LEFT_HAND: 256,
  RIGHT_HAND: 512,
  LEFT_FOOT: 1024,
  RIGHT_FOOT: 2048
});

const EPS = 1e-9;
const v3 = a => new THREE.Vector3(a[0], a[1], a[2]);
const a3 = v => [v.x, v.y, v.z];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const distanceToSegment = (p, a, b) => {
  const ab = b.clone().sub(a);
  const t = clamp(p.clone().sub(a).dot(ab) / Math.max(EPS, ab.lengthSq()), 0, 1);
  return { distance: p.distanceTo(a.clone().addScaledVector(ab, t)), t };
};

function boneFrame(position, target) {
  const y = target.clone().sub(position).normalize().multiplyScalar(-1);
  let x = new THREE.Vector3(1, 0, 0);
  if (Math.abs(x.dot(y)) > 0.92) x.set(0, 0, 1);
  x.addScaledVector(y, -x.dot(y)).normalize();
  const z = x.clone().cross(y).normalize();
  x = y.clone().cross(z).normalize();
  const matrix = new THREE.Matrix4().makeBasis(x, y, z);
  return { p: a3(position), q: new THREE.Quaternion().setFromRotationMatrix(matrix).toArray() };
}

function buildR2Frames(nodes) {
  const frames = new Map();
  const pos = id => v3(nodes[id].positionM);
  for (const [id, node] of Object.entries(nodes)) {
    const target = node.target ? pos(node.target) : node.tipM ? v3(node.tipM) : pos(id).clone().add(new THREE.Vector3(0, -0.03, 0));
    frames.set(id, boneFrame(pos(id), target));
  }

  // Preserve ReconstructionRig.r2SourceFrames: anatomical leg frames use the
  // pelvis lateral axis; arm frames use the measured bend plane.
  for (const side of ['left', 'right']) {
    for (const [kind, a, b, c] of [
      ['arm', 'upperArm', 'forearm', 'hand'],
      ['leg', 'femur', 'tibia', 'foot']
    ]) {
      const A = frames.get(`${side}_${a}`);
      const B = frames.get(`${side}_${b}`);
      const C = frames.get(`${side}_${c}`);
      const Ap = v3(A.p), Bp = v3(B.p), Cp = v3(C.p);
      const U = Bp.clone().sub(Ap).normalize();
      const W = Cp.clone().sub(Bp).normalize();
      if (kind === 'leg') {
        const lateral = pos('right_femur').sub(pos('left_femur')).normalize();
        const anatomical = direction => {
          const Y = direction.clone().multiplyScalar(-1);
          const X = lateral.clone().addScaledVector(Y, -lateral.dot(Y)).normalize();
          const Z = X.clone().cross(Y).normalize();
          return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)).toArray();
        };
        A.q = anatomical(U);
        B.q = anatomical(W);
      } else {
        let X = U.clone().cross(W);
        if (X.lengthSq() < 1e-10) X = U.clone().cross(new THREE.Vector3(0, 0, 1));
        X.normalize().multiplyScalar(-1);
        const Y = U.clone().multiplyScalar(-1);
        const Z = X.clone().cross(Y).normalize();
        A.q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)).toArray();
        const bend = Math.acos(clamp(U.dot(W), -1, 1));
        B.q = new THREE.Quaternion().fromArray(A.q)
          .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -bend))
          .normalize().toArray();
      }
      if (kind === 'arm' && frames.has(`${side}_radiusRotation`)) frames.get(`${side}_radiusRotation`).q = [...B.q];
    }
  }
  return frames;
}

function transformReferenceRig(reference, profile) {
  if (!reference?.nodes || !Number.isFinite(reference.sourceHeightM)) throw new Error('R2 rig reference is invalid');
  const scale = profile.heightM / reference.sourceHeightM;
  const xScale = scale * (profile.shoulderScale ?? 1);
  const zScale = scale * (profile.depthScale ?? 1);
  const floor = reference.sourceFloorM;
  const nodes = {};
  for (const [id, node] of Object.entries(reference.nodes)) {
    const mapPoint = p => [p[0] * xScale, (p[1] - floor) * scale, p[2] * zScale + (profile.forwardOffsetM ?? 0)];
    nodes[id] = { ...node, positionM: mapPoint(node.positionM), ...(node.tipM ? { tipM: mapPoint(node.tipM) } : {}) };
  }
  return {
    ...reference,
    sourceFloorM: 0,
    sourceHeightM: profile.heightM,
    nodes,
    subjectProfile: { ...profile },
    derivation: 'R2 reference topology fitted through ProportionProfile; no pose-time bone scale'
  };
}

function profileShape(profile) {
  return { statureScale: 1, shoulderWidth: profile?.shoulderScale ?? 1, torsoDepth: profile?.depthScale ?? 1 };
}

function buildSegments(reference, frames) {
  const position = id => v3(frames.get(id).p);
  const jointIds = new Map(Object.keys(reference.nodes).map((id, i) => [id, i]));
  const segments = new Map();
  const radius = (a, b, fraction) => position(a).distanceTo(position(b)) * fraction;
  for (const side of ['left', 'right']) {
    const rays = kind => Array.from({ length: 5 }, (_, f) => {
      const stem = kind === 'finger' ? 'metacarpal' : 'metatarsal';
      const count = f === 0 ? 2 : 3;
      const ids = [`${side}_${stem}_${f + 1}`, ...Array.from({ length: count }, (_, k) => `${side}_${kind}_${f + 1}_${k + 1}`)]
        .filter(id => reference.nodes[id]);
      const points = ids.map(position);
      const last = ids.at(-1);
      if (last) points.push(reference.nodes[last].tipM ? v3(reference.nodes[last].tipM) : position(last));
      return { ids, points: points.map(a3) };
    });
    segments.set(side, {
      shoulder: a3(position(`${side}_upperArm`)), elbow: a3(position(`${side}_forearm`)), wrist: a3(position(`${side}_hand`)),
      hip: a3(position(`${side}_femur`)), knee: a3(position(`${side}_tibia`)), ankle: a3(position(`${side}_foot`)),
      fingers: rays('finger'), toes: rays('toe'),
      shoulderRadius: radius(`${side}_upperArm`, `${side}_forearm`, 0.115),
      hipRadius: radius(`${side}_femur`, `${side}_tibia`, 0.090)
    });
  }
  const spine = [
    ['hips', position('hips').y],
    ...Object.entries(reference.nodes).filter(([, n]) => n.region).map(([id]) => [id, position(id).y]),
    ['head', position('head').y]
  ].sort((a, b) => a[1] - b[1]);
  return {
    frames, personalFrames: frames,
    shapeReference: { nodes: reference.nodes, sourceFloorM: 0, sourceHeightM: reference.sourceHeightM },
    segments, jointIds, jointNames: [...jointIds.keys()], spine,
    shape: profileShape(reference.subjectProfile), coordinateSpace: 'subject-r2-bind-metres'
  };
}

function chooseMask(point, rig) {
  // R2-compatible membership from proximity to the inherited anatomical chains,
  // not from a separately invented height-band skeleton.
  const p = point;
  const position = id => v3(rig.frames.get(id).p);
  const hips = position('hips'), head = position('head'), c7 = position('C7');
  const bodyHeight = rig.shapeReference.sourceHeightM;
  const side = p.x < hips.x ? 'left' : 'right';
  const armBit = side === 'left' ? R2_REGION.LEFT_ARM : R2_REGION.RIGHT_ARM;
  const handBit = side === 'left' ? R2_REGION.LEFT_HAND : R2_REGION.RIGHT_HAND;
  const legBit = side === 'left' ? R2_REGION.LEFT_LEG : R2_REGION.RIGHT_LEG;
  const footBit = side === 'left' ? R2_REGION.LEFT_FOOT : R2_REGION.RIGHT_FOOT;
  const s = rig.segments.get(side);
  const shoulder = v3(s.shoulder), elbow = v3(s.elbow), wrist = v3(s.wrist);
  const hip = v3(s.hip), knee = v3(s.knee), ankle = v3(s.ankle);
  const armA = distanceToSegment(p, shoulder, elbow), armB = distanceToSegment(p, elbow, wrist);
  const legA = distanceToSegment(p, hip, knee), legB = distanceToSegment(p, knee, ankle);
  const handDistance = p.distanceTo(wrist), footDistance = p.distanceTo(ankle);
  const armRadius = Math.max(s.shoulderRadius * 1.55, bodyHeight * 0.035);
  const legRadius = Math.max(s.hipRadius * 1.75, bodyHeight * 0.050);

  if (p.y > c7.y + (head.y - c7.y) * 0.22) return R2_REGION.HEAD_FACE_EARS;
  if (handDistance < bodyHeight * 0.095 && armB.t > 0.72) return armBit | handBit;
  if (Math.min(armA.distance, armB.distance) < armRadius) {
    const shoulderMix = p.distanceTo(shoulder) < s.shoulderRadius * 3.8;
    return armBit | (shoulderMix ? R2_REGION.SHOULDER_NECK | R2_REGION.TORSO : 0);
  }
  if (footDistance < bodyHeight * 0.105 && legB.t > 0.70) return legBit | footBit;
  if (Math.min(legA.distance, legB.distance) < legRadius) {
    const hipMix = p.distanceTo(hip) < s.hipRadius * 4.2;
    return legBit | (hipMix ? R2_REGION.PELVIS : 0);
  }
  if (p.y < hips.y + bodyHeight * 0.08) return R2_REGION.PELVIS;
  if (p.y > c7.y - bodyHeight * 0.10) return R2_REGION.SHOULDER_NECK | R2_REGION.TORSO;
  return R2_REGION.TORSO;
}

function buildVertexRoots(meshRows, epsilonM) {
  const keyScale = 1 / epsilonM, map = new Map(), roots = [];
  let nextId = 0;
  for (const row of meshRows) {
    row.vertexIds = new Uint32Array(row.vertices);
    for (let i = 0; i < row.vertices; i++) {
      const x = row.positions[i * 3], y = row.positions[i * 3 + 1], z = row.positions[i * 3 + 2];
      const key = `${Math.round(x * keyScale)},${Math.round(y * keyScale)},${Math.round(z * keyScale)}`;
      let id = map.get(key);
      if (id === undefined) { id = nextId++; map.set(key, id); roots[id] = id; }
      row.vertexIds[i] = id;
    }
  }
  return Uint32Array.from(roots);
}

export function sampleUSDZSurface(root, sourceToCanonical, rig, { weldEpsilonM = 1e-5 } = {}) {
  if (!root?.isObject3D) throw new Error('USDZ root Object3D is required');
  if (!(sourceToCanonical instanceof THREE.Matrix4)) throw new Error('A verified source-to-canonical matrix is required');
  root.updateMatrixWorld(true);
  const rootInverse = root.matrixWorld.clone().invert(), meshRows = [], renderRows = [];
  root.traverse(object => {
    const sourcePosition = object.geometry?.getAttribute?.('position');
    if (!object.isMesh || !sourcePosition) return;
    const transform = sourceToCanonical.clone().multiply(rootInverse.clone().multiply(object.matrixWorld));
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(transform);
    const p = geometry.getAttribute('position'), positions = new Float32Array(p.count * 3), regionMasks = new Uint16Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const point = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
      positions.set(a3(point), i * 3);
      const anatomicalPoint = point.clone(); anatomicalPoint.x *= -1;
      regionMasks[i] = chooseMask(anatomicalPoint, rig);
    }
    const indices = geometry.index ? Uint32Array.from(geometry.index.array) : Uint32Array.from({ length: p.count }, (_, i) => i);
    meshRows.push({ name: 'skin', sourceName: object.name || `surface_${meshRows.length}`, positions, indices, regionMasks, vertices: p.count });
    renderRows.push({ object, geometry, material: object.material });
  });
  if (!meshRows.length) throw new Error('The USDZ contains no readable mesh surface');
  return { bindingData: { meshes: meshRows, bindingRoots: buildVertexRoots(meshRows, weldEpsilonM) }, renderRows };
}

export async function buildInheritedBinding({ root, sourceToCanonical, rigReference, proportionProfile, progress = () => {} }) {
  const personalReference = transformReferenceRig(rigReference, proportionProfile);
  const frames = buildR2Frames(personalReference.nodes);
  const rig = buildSegments(personalReference, frames);
  const sampled = sampleUSDZSurface(root, sourceToCanonical, rig);
  const field = buildCompactBinding(sampled.bindingData, rig, progress);
  const bindings = sampled.bindingData.meshes.map(mesh => bindCompactArrays(mesh, rig, field));
  return {
    schema: 'humanoid_rig/sampled_surface_adapter@1.0',
    source: NEW_HUMAN_SOURCE,
    coordinateSystem: COORDINATE_CONTRACT,
    reference: personalReference, rig, sampled, field, bindings,
    influenceCount: COMPACT_INFLUENCES, weightScale: COMPACT_WEIGHT_SCALE,
    authority: 'existing R2 Human Core / simulationRig', visualAcceptance: false
  };
}
