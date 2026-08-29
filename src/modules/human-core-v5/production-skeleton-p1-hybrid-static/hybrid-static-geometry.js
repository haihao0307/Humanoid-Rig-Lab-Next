import { createP0RigSnapshot } from '../production-rig-visual-prototypes-p0/rig-prototype-data.js';

const TAU = Math.PI * 2;

export const HYBRID_STATIC_SCHEMA = 'humanoid_rig/hybrid_production_skeleton_static@1';

export const HYBRID_STATIC_MATERIALS = Object.freeze([
  material('bonePrimary', [0.18, 0.43, 0.50, 1], 0.08, 0.72),
  material('boneSecondary', [0.28, 0.63, 0.61, 1], 0.06, 0.68),
  material('structureWarm', [0.93, 0.61, 0.22, 1], 0.04, 0.64),
  material('jointIvory', [0.88, 0.94, 0.91, 1], 0.03, 0.58),
  material('directionCyan', [0.29, 0.76, 0.86, 1], 0.02, 0.55),
  material('backStructure', [0.22, 0.32, 0.38, 1], 0.08, 0.78),
]);

export function createHybridStaticAssetSource() {
  const snapshot = createP0RigSnapshot();
  const joint = new Map(snapshot.joints.map((item) => [item.id, item.worldPosition]));
  const modules = [
    createHeadModule(joint),
    createNeckModule(joint),
    createThoraxModule(joint),
    createPelvisModule(joint),
    ...createShoulderModules(joint, 'left'),
    ...createShoulderModules(joint, 'right'),
    ...createArmModules(joint, 'left'),
    ...createArmModules(joint, 'right'),
    ...createLegModules(joint, 'left'),
    ...createLegModules(joint, 'right'),
  ].map(finalizeModule);

  return {
    schema: HYBRID_STATIC_SCHEMA,
    assetId: 'HRL_HYBRID_PRODUCTION_SKELETON_STATIC_V1',
    displayName: 'HRL Hybrid Production Skeleton Static V1',
    sourceCommit: snapshot.source.baselineCommit,
    p0SelectionCommit: 'c81a458d8526c6df9129b0c201abd46db1fccdda',
    candidateSelection: 'HYBRID_PRODUCTION',
    pose: snapshot.source.referencePose,
    coreRigFingerprint: snapshot.source.coreRigFingerprint,
    staticOnly: true,
    authoritativeForPose: false,
    connectsDynamicFinalPose: false,
    projectOwnedGeometry: true,
    body: snapshot.body,
    joints: snapshot.joints,
    segments: snapshot.segments,
    modules,
  };
}

function createHeadModule(joint) {
  const module = createModule('head', ['neck', 'head']);
  const shell = part(module, 'bonePrimary');
  appendEllipsoid(shell, [0, 1.69, 0.055], [0.108, 0.132, 0.098], 14, 8);
  appendFrustum(shell, [0, 1.585, 0.044], [0.085, 0.055, 0.078], [0.058, 0.050, 0.060]);
  const frame = part(module, 'directionCyan');
  const z = -0.072;
  appendCylinderBetween(frame, [-0.072, 1.625, z], [0.072, 1.625, z], 0.0055, 6);
  appendCylinderBetween(frame, [0.072, 1.625, z], [0.072, 1.705, z], 0.0055, 6);
  appendCylinderBetween(frame, [0.072, 1.705, z], [-0.072, 1.705, z], 0.0055, 6);
  appendCylinderBetween(frame, [-0.072, 1.705, z], [-0.072, 1.625, z], 0.0055, 6);
  appendCylinderBetween(frame, [0, 1.665, z], [0, 1.665, -0.135], 0.006, 6);
  appendCone(frame, [0, 1.665, -0.135], [0, 1.665, -0.170], 0.020, 7);
  const connector = part(module, 'structureWarm');
  appendCylinderBetween(connector, joint.get('head'), [0, 1.585, 0.044], 0.033, 8);
  return module;
}

function createNeckModule(joint) {
  const module = createModule('neck', ['upperChest', 'neck', 'head']);
  const primary = part(module, 'boneSecondary');
  appendWaistedBone(primary, joint.get('upperChest'), joint.get('neck'), [0.041, 0.033, 0.037], 8);
  appendWaistedBone(primary, joint.get('neck'), joint.get('head'), [0.037, 0.029, 0.034], 8);
  const root = part(module, 'structureWarm');
  appendEllipsoid(root, joint.get('neck'), [0.050, 0.028, 0.045], 10, 5);
  return module;
}

function createThoraxModule(joint) {
  const module = createModule('thorax', ['spine', 'chest', 'upperChest', 'leftShoulder', 'rightShoulder']);
  const rings = part(module, 'bonePrimary');
  appendTubePath(rings, ellipsePath([0, 1.345, 0.012], 0.205, 0.105, 24), 0.012, 6, true);
  appendTubePath(rings, ellipsePath([0, 1.205, 0.020], 0.165, 0.082, 24), 0.011, 6, true);
  const front = part(module, 'structureWarm');
  appendCylinderBetween(front, [0, 1.19, -0.070], [0, 1.365, -0.094], 0.012, 7);
  appendCylinderBetween(front, [-0.055, 1.365, -0.085], [0.055, 1.365, -0.085], 0.009, 6);
  const back = part(module, 'backStructure');
  appendCylinderBetween(back, [0, 1.19, 0.082], [0, 1.365, 0.108], 0.014, 7);
  const sockets = part(module, 'jointIvory');
  appendEllipsoid(sockets, joint.get('leftShoulder'), [0.033, 0.033, 0.033], 10, 5);
  appendEllipsoid(sockets, joint.get('rightShoulder'), [0.033, 0.033, 0.033], 10, 5);
  return module;
}

function createPelvisModule(joint) {
  const module = createModule('pelvis', ['hips', 'leftUpperLeg', 'rightUpperLeg']);
  const wings = part(module, 'bonePrimary');
  appendWing(wings, -1);
  appendWing(wings, 1);
  const sacrum = part(module, 'backStructure');
  appendFrustum(sacrum, [0, 0.925, 0.075], [0.065, 0.105, 0.045], [0.045, 0.065, 0.035]);
  appendCylinderBetween(sacrum, [-0.115, 0.945, 0.060], [0.115, 0.945, 0.060], 0.018, 8);
  const sockets = part(module, 'jointIvory');
  appendEllipsoid(sockets, joint.get('leftUpperLeg'), [0.041, 0.041, 0.041], 10, 5);
  appendEllipsoid(sockets, joint.get('rightUpperLeg'), [0.041, 0.041, 0.041], 10, 5);
  const direction = part(module, 'directionCyan');
  appendCone(direction, [0, 0.915, -0.090], [0, 0.915, -0.160], 0.030, 7);
  return module;
}

function createShoulderModules(joint, side) {
  const sign = side === 'left' ? -1 : 1;
  const shoulder = joint.get(`${side}Shoulder`);
  const upperArm = joint.get(`${side}UpperArm`);
  const clavicle = createModule(`${side}Clavicle`, ['upperChest', `${side}Shoulder`]);
  appendTubePath(part(clavicle, 'structureWarm'), [
    [sign * 0.035, 1.355, -0.020], [sign * 0.085, 1.390, -0.018], [sign * 0.140, 1.410, -0.004], shoulder,
  ], 0.014, 7, false);
  appendEllipsoid(part(clavicle, 'jointIvory'), shoulder, [0.034, 0.034, 0.034], 10, 5);

  const scapula = createModule(`${side}Scapula`, ['upperChest', `${side}Shoulder`]);
  appendExtrudedPlate(part(scapula, 'backStructure'), [
    [sign * 0.070, 1.365, 0.094], [sign * 0.195, 1.392, 0.075], [sign * 0.170, 1.275, 0.088], [sign * 0.085, 1.255, 0.102],
  ], 0.016);
  appendCylinderBetween(part(scapula, 'boneSecondary'), shoulder, upperArm, 0.027, 8);
  return [clavicle, scapula];
}

function createArmModules(joint, side) {
  const sign = side === 'left' ? -1 : 1;
  const shoulder = joint.get(`${side}Shoulder`);
  const upper = joint.get(`${side}UpperArm`);
  const lower = joint.get(`${side}LowerArm`);
  const hand = joint.get(`${side}Hand`);

  const upperArm = createModule(`${side}UpperArm`, [`${side}Shoulder`, `${side}UpperArm`, `${side}LowerArm`]);
  appendWaistedBone(part(upperArm, 'bonePrimary'), upper, lower, [0.058, 0.034, 0.050], 9);
  appendCylinderBetween(part(upperArm, 'boneSecondary'), shoulder, upper, 0.032, 8);

  const railOffsets = armRailOffsets();
  const radius = createModule(`${side}ForearmRadius`, [`${side}LowerArm`, `${side}Hand`]);
  appendWaistedBone(part(radius, 'boneSecondary'), add(lower, railOffsets.radius), add(hand, scale(railOffsets.radius, 0.60)), [0.024, 0.015, 0.019], 7);
  const ulna = createModule(`${side}ForearmUlna`, [`${side}LowerArm`, `${side}Hand`]);
  appendWaistedBone(part(ulna, 'bonePrimary'), add(lower, railOffsets.ulna), add(hand, scale(railOffsets.ulna, 0.60)), [0.022, 0.014, 0.018], 7);

  const handModule = createModule(`${side}Hand`, [`${side}LowerArm`, `${side}Hand`]);
  const wrist = part(handModule, 'jointIvory');
  appendCylinderBetween(wrist, add(hand, [sign * -0.010, 0, 0]), add(hand, [sign * 0.020, 0, 0]), 0.034, 8);
  const palm = part(handModule, 'bonePrimary');
  appendFrustum(palm, add(hand, [sign * 0.065, 0, 0]), [0.060, 0.040, 0.018], [0.045, 0.034, 0.014], side === 'left' ? 'x-' : 'x+');
  const thumb = part(handModule, 'structureWarm');
  appendCone(thumb, add(hand, [sign * 0.045, -0.022, -0.010]), add(hand, [sign * 0.095, -0.056, -0.018]), 0.014, 7);
  const grasp = part(handModule, 'directionCyan');
  appendEllipsoid(grasp, add(hand, [sign * 0.065, 0, -0.010]), [0.014, 0.014, 0.014], 8, 4);
  appendCylinderBetween(grasp, add(hand, [sign * 0.065, 0, -0.020]), add(hand, [sign * 0.065, 0, -0.075]), 0.005, 6);
  appendCone(grasp, add(hand, [sign * 0.065, 0, -0.075]), add(hand, [sign * 0.065, 0, -0.105]), 0.014, 7);
  return [upperArm, radius, ulna, handModule];
}

function createLegModules(joint, side) {
  const sign = side === 'left' ? -1 : 1;
  const upper = joint.get(`${side}UpperLeg`);
  const lower = joint.get(`${side}LowerLeg`);
  const foot = joint.get(`${side}Foot`);

  const thigh = createModule(`${side}Thigh`, [`${side}UpperLeg`, `${side}LowerLeg`]);
  appendWaistedBone(part(thigh, 'bonePrimary'), upper, lower, [0.078, 0.043, 0.064], 10);

  const tibiaOffset = [sign * -0.014, 0, -0.016];
  const fibulaOffset = [sign * 0.027, 0, 0.019];
  const tibia = createModule(`${side}Tibia`, [`${side}LowerLeg`, `${side}Foot`]);
  appendWaistedBone(part(tibia, 'bonePrimary'), add(lower, tibiaOffset), add(foot, scale(tibiaOffset, 0.55)), [0.030, 0.019, 0.026], 8);
  const fibula = createModule(`${side}Fibula`, [`${side}LowerLeg`, `${side}Foot`]);
  appendWaistedBone(part(fibula, 'boneSecondary'), add(lower, fibulaOffset), add(foot, scale(fibulaOffset, 0.55)), [0.022, 0.014, 0.018], 7);

  const footModule = createModule(`${side}Foot`, [`${side}LowerLeg`, `${side}Foot`]);
  const sole = part(footModule, 'backStructure');
  appendBox(sole, [foot[0], 0.055, -0.080], [0.110, 0.018, 0.285]);
  const heel = part(footModule, 'bonePrimary');
  appendFrustum(heel, [foot[0], 0.086, 0.030], [0.055, 0.060, 0.070], [0.048, 0.045, 0.055]);
  const arch = part(footModule, 'boneSecondary');
  appendTubePath(arch, [[foot[0], 0.090, 0.000], [foot[0], 0.110, -0.080], [foot[0], 0.082, -0.155]], 0.016, 7, false);
  const forefoot = part(footModule, 'bonePrimary');
  appendFrustum(forefoot, [foot[0], 0.078, -0.175], [0.066, 0.042, 0.075], [0.058, 0.030, 0.062]);
  const toe = part(footModule, 'structureWarm');
  appendFrustum(toe, [foot[0], 0.070, -0.245], [0.058, 0.025, 0.055], [0.045, 0.018, 0.038]);
  const direction = part(footModule, 'directionCyan');
  appendCylinderBetween(direction, [foot[0], 0.060, -0.205], [foot[0], 0.060, -0.285], 0.0055, 6);
  appendCone(direction, [foot[0], 0.060, -0.285], [foot[0], 0.060, -0.320], 0.016, 7);
  return [thigh, tibia, fibula, footModule];
}

function createModule(moduleId, anchorJointIds) { return { moduleId, anchorJointIds, parts: [] }; }
function part(module, materialId) { const value = { materialId, positions: [], indices: [], normals: [] }; module.parts.push(value); return value; }

function finalizeModule(module) {
  for (const geometry of module.parts) geometry.normals = calculateNormals(geometry.positions, geometry.indices);
  return module;
}

function appendWaistedBone(target, start, end, radii, sides) {
  const stations = [[0, radii[0]], [0.16, radii[0]], [0.50, radii[1]], [0.84, radii[2]], [1, radii[2]]];
  appendSectionTube(target, stations.map(([t, radius]) => ({ center: lerp(start, end, t), radius })), sides, true);
}

function appendCylinderBetween(target, start, end, radius, sides) {
  appendSectionTube(target, [{ center: start, radius }, { center: end, radius }], sides, true);
}

function appendCone(target, base, tip, radius, sides) {
  const { side, binormal } = basis(base, tip);
  const baseIndex = target.positions.length;
  for (let i = 0; i < sides; i += 1) {
    const angle = i / sides * TAU;
    target.positions.push(add(base, add(scale(side, Math.cos(angle) * radius), scale(binormal, Math.sin(angle) * radius))));
  }
  const tipIndex = target.positions.push([...tip]) - 1;
  const centerIndex = target.positions.push([...base]) - 1;
  for (let i = 0; i < sides; i += 1) {
    const next = (i + 1) % sides;
    target.indices.push([baseIndex + i, baseIndex + next, tipIndex], [centerIndex, baseIndex + next, baseIndex + i]);
  }
}

function appendSectionTube(target, sections, sides, capped) {
  const baseIndex = target.positions.length;
  const first = sections[0].center;
  const last = sections.at(-1).center;
  const frame = basis(first, last);
  for (const section of sections) {
    for (let i = 0; i < sides; i += 1) {
      const angle = i / sides * TAU;
      target.positions.push(add(section.center, add(scale(frame.side, Math.cos(angle) * section.radius), scale(frame.binormal, Math.sin(angle) * section.radius))));
    }
  }
  for (let s = 0; s < sections.length - 1; s += 1) {
    for (let i = 0; i < sides; i += 1) {
      const next = (i + 1) % sides;
      const a = baseIndex + s * sides + i;
      const b = baseIndex + s * sides + next;
      const c = baseIndex + (s + 1) * sides + next;
      const d = baseIndex + (s + 1) * sides + i;
      target.indices.push([a, b, c], [a, c, d]);
    }
  }
  if (capped) {
    const startCenter = target.positions.push([...first]) - 1;
    const endCenter = target.positions.push([...last]) - 1;
    const endBase = baseIndex + (sections.length - 1) * sides;
    for (let i = 0; i < sides; i += 1) {
      const next = (i + 1) % sides;
      target.indices.push([startCenter, baseIndex + next, baseIndex + i], [endCenter, endBase + i, endBase + next]);
    }
  }
}

function appendTubePath(target, path, radius, sides, closed) {
  const baseIndex = target.positions.length;
  const count = path.length;
  const frames = path.map((point, index) => {
    const previous = path[(index - 1 + count) % count];
    const next = path[(index + 1) % count];
    const tangent = normalize(sub(closed ? next : index === count - 1 ? point : next, closed ? previous : index === 0 ? point : previous));
    const helper = Math.abs(dot(tangent, [0, 1, 0])) > 0.9 ? [0, 0, 1] : [0, 1, 0];
    const side = normalize(cross(tangent, helper));
    return { side, binormal: normalize(cross(tangent, side)) };
  });
  for (let p = 0; p < count; p += 1) {
    for (let i = 0; i < sides; i += 1) {
      const angle = i / sides * TAU;
      target.positions.push(add(path[p], add(scale(frames[p].side, Math.cos(angle) * radius), scale(frames[p].binormal, Math.sin(angle) * radius))));
    }
  }
  const pathSegments = closed ? count : count - 1;
  for (let p = 0; p < pathSegments; p += 1) {
    const nextPath = (p + 1) % count;
    for (let i = 0; i < sides; i += 1) {
      const next = (i + 1) % sides;
      const a = baseIndex + p * sides + i;
      const b = baseIndex + p * sides + next;
      const c = baseIndex + nextPath * sides + next;
      const d = baseIndex + nextPath * sides + i;
      target.indices.push([a, b, c], [a, c, d]);
    }
  }
  if (!closed) {
    const startCenter = target.positions.push([...path[0]]) - 1;
    const endCenter = target.positions.push([...path.at(-1)]) - 1;
    const endBase = baseIndex + (count - 1) * sides;
    for (let i = 0; i < sides; i += 1) {
      const next = (i + 1) % sides;
      target.indices.push([startCenter, baseIndex + next, baseIndex + i], [endCenter, endBase + i, endBase + next]);
    }
  }
}

function appendEllipsoid(target, center, radii, longitudeSegments, latitudeSegments) {
  const base = target.positions.length;
  target.positions.push([center[0], center[1] + radii[1], center[2]]);
  for (let lat = 1; lat < latitudeSegments; lat += 1) {
    const phi = lat / latitudeSegments * Math.PI;
    for (let lon = 0; lon < longitudeSegments; lon += 1) {
      const theta = lon / longitudeSegments * TAU;
      target.positions.push([center[0] + radii[0] * Math.sin(phi) * Math.cos(theta), center[1] + radii[1] * Math.cos(phi), center[2] + radii[2] * Math.sin(phi) * Math.sin(theta)]);
    }
  }
  const bottom = target.positions.push([center[0], center[1] - radii[1], center[2]]) - 1;
  for (let lon = 0; lon < longitudeSegments; lon += 1) {
    const next = (lon + 1) % longitudeSegments;
    target.indices.push([base, base + 1 + lon, base + 1 + next]);
  }
  for (let lat = 0; lat < latitudeSegments - 2; lat += 1) {
    const ringA = base + 1 + lat * longitudeSegments;
    const ringB = ringA + longitudeSegments;
    for (let lon = 0; lon < longitudeSegments; lon += 1) {
      const next = (lon + 1) % longitudeSegments;
      target.indices.push([ringA + lon, ringB + lon, ringB + next], [ringA + lon, ringB + next, ringA + next]);
    }
  }
  const finalRing = base + 1 + (latitudeSegments - 2) * longitudeSegments;
  for (let lon = 0; lon < longitudeSegments; lon += 1) {
    const next = (lon + 1) % longitudeSegments;
    target.indices.push([bottom, finalRing + next, finalRing + lon]);
  }
}

function appendBox(target, center, size) {
  appendFrustum(target, center, size.map((value) => value * 0.5), size.map((value) => value * 0.5));
}

function appendFrustum(target, center, halfA, halfB, axis = 'y') {
  const base = target.positions.length;
  const [x, y, z] = center;
  if (axis === 'x-' || axis === 'x+') {
    const sign = axis === 'x-' ? -1 : 1;
    target.positions.push(
      [x - sign * halfA[0], y - halfA[1], z - halfA[2]], [x - sign * halfA[0], y + halfA[1], z - halfA[2]], [x - sign * halfA[0], y + halfA[1], z + halfA[2]], [x - sign * halfA[0], y - halfA[1], z + halfA[2]],
      [x + sign * halfB[0], y - halfB[1], z - halfB[2]], [x + sign * halfB[0], y + halfB[1], z - halfB[2]], [x + sign * halfB[0], y + halfB[1], z + halfB[2]], [x + sign * halfB[0], y - halfB[1], z + halfB[2]],
    );
  } else {
    target.positions.push(
      [x - halfA[0], y - halfA[1], z - halfA[2]], [x + halfA[0], y - halfA[1], z - halfA[2]], [x + halfA[0], y - halfA[1], z + halfA[2]], [x - halfA[0], y - halfA[1], z + halfA[2]],
      [x - halfB[0], y + halfB[1], z - halfB[2]], [x + halfB[0], y + halfB[1], z - halfB[2]], [x + halfB[0], y + halfB[1], z + halfB[2]], [x - halfB[0], y + halfB[1], z + halfB[2]],
    );
  }
  const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  target.indices.push(...faces.map((face) => face.map((index) => base + index)));
}

function appendExtrudedPlate(target, polygon, depth) {
  const base = target.positions.length;
  const count = polygon.length;
  for (const point of polygon) target.positions.push([point[0], point[1], point[2] - depth * 0.5]);
  for (const point of polygon) target.positions.push([point[0], point[1], point[2] + depth * 0.5]);
  for (let i = 1; i < count - 1; i += 1) target.indices.push([base, base + i + 1, base + i], [base + count, base + count + i, base + count + i + 1]);
  for (let i = 0; i < count; i += 1) {
    const next = (i + 1) % count;
    target.indices.push([base + i, base + next, base + count + next], [base + i, base + count + next, base + count + i]);
  }
}

function appendWing(target, sign) {
  appendExtrudedPlate(target, [
    [sign * 0.035, 1.015, 0.025], [sign * 0.175, 1.015, 0.030], [sign * 0.205, 0.945, 0.020], [sign * 0.145, 0.865, 0.005], [sign * 0.050, 0.885, 0.030],
  ], 0.065);
}

function ellipsePath(center, radiusX, radiusZ, segments) {
  return Array.from({ length: segments }, (_, index) => {
    const angle = index / segments * TAU;
    return [center[0] + Math.cos(angle) * radiusX, center[1], center[2] + Math.sin(angle) * radiusZ];
  });
}

function armRailOffsets() { return { radius: [0, 0.016, -0.020], ulna: [0, -0.016, 0.020] }; }

function calculateNormals(positions, indices) {
  const normals = positions.map(() => [0, 0, 0]);
  for (const [a, b, c] of indices) {
    const normal = cross(sub(positions[b], positions[a]), sub(positions[c], positions[a]));
    normals[a] = add(normals[a], normal); normals[b] = add(normals[b], normal); normals[c] = add(normals[c], normal);
  }
  return normals.map((normal) => normalize(normal));
}

function material(materialId, baseColorFactor, metallicFactor, roughnessFactor) { return Object.freeze({ materialId, baseColorFactor: Object.freeze(baseColorFactor), metallicFactor, roughnessFactor, doubleSided: true }); }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a, value) { return [a[0] * value, a[1] * value, a[2] * value]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function length(a) { return Math.hypot(a[0], a[1], a[2]); }
function normalize(a) { const value = length(a); return value > 1e-15 ? scale(a, 1 / value) : [0, 1, 0]; }
function lerp(a, b, t) { return add(a, scale(sub(b, a), t)); }
function basis(start, end) { const axis = normalize(sub(end, start)); const helper = Math.abs(dot(axis, [0, 0, 1])) > 0.88 ? [0, 1, 0] : [0, 0, 1]; const side = normalize(cross(axis, helper)); return { axis, side, binormal: normalize(cross(axis, side)) }; }
