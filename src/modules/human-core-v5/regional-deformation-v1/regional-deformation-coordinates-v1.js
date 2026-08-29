import { LATTICE_CIRCUMFERENCE_DIRECTIONS_V1, REGIONAL_DEFORMATION_REGION_IDS_V1, SPINE_LATTICE_RING_DEFINITIONS_V1, PELVIS_HIP_GROIN_LATTICE_SECTIONS_V1 } from './regional-deformation-profile-v1.js';

export const HRL_REGIONAL_DEFORMATION_COORDINATES_V1_SCHEMA = 'humanoid_rig/regional_deformation_coordinates@1.0';

export function buildRegionalDeformationCoordinatesV1({ positions, surface, performanceRig }) {
  const vertexCount = positions.length / 3; const regionId = new Uint8Array(vertexCount); const latticeCellId = new Uint16Array(vertexCount);
  const localCoordinates = new Float32Array(vertexCount * 3); const blendWeight = new Float32Array(vertexCount); const distanceToJoint = new Float32Array(vertexCount);
  const distanceToCompressionSide = new Float32Array(vertexCount); const distanceToExtensionSide = new Float32Array(vertexCount); const centerlineRole = new Uint8Array(vertexCount);
  const symmetryPartner = new Uint32Array(surface.chunks.symmetryPartner); const joints = new Map(performanceRig.joints.map((joint) => [joint.id, joint]));
  const regionNames = surface.header.deformationRegions.map((definition) => definition.id); const primaryNames = Array.from({ length: vertexCount }, (_, vertex) => regionNames[surface.chunks.primaryRegionIds[vertex]] || 'unassigned');
  const groups = { spineTorso: [], pelvisHipGroin: [], leftElbow: [], rightElbow: [], leftKnee: [], rightKnee: [] };
  const spineYs = SPINE_LATTICE_RING_DEFINITIONS_V1.map((definition) => joints.get(definition.boneId).bindWorldPosition[1]);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const point = read3(positions, vertex); const name = primaryNames[vertex]; const absX = Math.abs(point[0]);
    const centerline = absX <= 1e-7; centerlineRole[vertex] = centerline ? 2 : absX < 0.015 ? 1 : 0;
    let assignment = null;
    if (isPelvisHipGroin(point, name)) assignment = regionalAssignment('pelvisHipGroin', REGIONAL_DEFORMATION_REGION_IDS_V1.pelvisHipGroin, pelvisBlend(point, name));
    else if (isElbow(point, name, -1, joints)) assignment = regionalAssignment('leftElbow', REGIONAL_DEFORMATION_REGION_IDS_V1.leftElbow, jointBlend(point, joints.get('leftLowerArm').bindWorldPosition, 0.14));
    else if (isElbow(point, name, 1, joints)) assignment = regionalAssignment('rightElbow', REGIONAL_DEFORMATION_REGION_IDS_V1.rightElbow, jointBlend(point, joints.get('rightLowerArm').bindWorldPosition, 0.14));
    else if (isKnee(point, name, -1, joints)) assignment = regionalAssignment('leftKnee', REGIONAL_DEFORMATION_REGION_IDS_V1.leftKnee, jointBlend(point, joints.get('leftLowerLeg').bindWorldPosition, 0.18));
    else if (isKnee(point, name, 1, joints)) assignment = regionalAssignment('rightKnee', REGIONAL_DEFORMATION_REGION_IDS_V1.rightKnee, jointBlend(point, joints.get('rightLowerLeg').bindWorldPosition, 0.18));
    else if (isSpineTorso(point, name)) assignment = regionalAssignment('spineTorso', REGIONAL_DEFORMATION_REGION_IDS_V1.spineTorso, spineBlend(point));
    if (!assignment || assignment.weight <= 1e-6) continue;
    regionId[vertex] = assignment.id; blendWeight[vertex] = assignment.weight; groups[assignment.group].push(vertex);
    if (assignment.group === 'spineTorso') {
      const segment = locateSegment(spineYs, point[1]); latticeCellId[vertex] = segment.index; write3(localCoordinates, vertex, [segment.t, circumferenceCoordinate(point), radialCoordinate(point)]);
      distanceToJoint[vertex] = Math.min(...SPINE_LATTICE_RING_DEFINITIONS_V1.map((definition) => distance(point, joints.get(definition.boneId).bindWorldPosition)));
    } else if (assignment.group === 'pelvisHipGroin') {
      const side = point[0] < -0.012 ? -1 : point[0] > 0.012 ? 1 : 0; const y = normalize(point[1], -0.24, 0.2); const radial = Math.min(1, Math.hypot(point[0], point[2] - 0.08) / 0.28);
      latticeCellId[vertex] = pelvisCellId(point, name); write3(localCoordinates, vertex, [(side + 1) * 0.5, y, radial]);
      distanceToJoint[vertex] = distance(point, joints.get(side < 0 ? 'leftUpperLeg' : side > 0 ? 'rightUpperLeg' : 'pelvis').bindWorldPosition);
    } else {
      const jointId = assignment.group === 'leftElbow' ? 'leftLowerArm' : assignment.group === 'rightElbow' ? 'rightLowerArm' : assignment.group === 'leftKnee' ? 'leftLowerLeg' : 'rightLowerLeg';
      const center = joints.get(jointId).bindWorldPosition; const delta = point.map((value, axis) => value - center[axis]); write3(localCoordinates, vertex, delta); distanceToJoint[vertex] = Math.hypot(...delta);
    }
    distanceToCompressionSide[vertex] = Math.max(0, point[2] - 0.02); distanceToExtensionSide[vertex] = Math.max(0, 0.02 - point[2]);
  }
  const spineLattice = buildSpineTorsoLatticeV1(positions, joints); const pelvisLattice = buildPelvisHipGroinLatticeV1(positions, joints);
  return { schema: HRL_REGIONAL_DEFORMATION_COORDINATES_V1_SCHEMA, vertexCount, regionId, latticeCellId, localCoordinates, blendWeight, distanceToJoint, distanceToCompressionSide, distanceToExtensionSide, symmetryPartner, centerlineRole, groups, spineLattice, pelvisLattice, everyAffectedVertexHasCoordinates: Object.values(groups).flat().every((vertex) => Number.isFinite(localCoordinates[vertex * 3]) && blendWeight[vertex] > 0), perFrameNearestTriangleSearch: false, topologyRegeneratedPerFrame: false };
}

export function buildSpineTorsoLatticeV1(positions, joints) {
  const rings = SPINE_LATTICE_RING_DEFINITIONS_V1.map((definition) => {
    const joint = joints.get(definition.boneId); const y = joint.bindWorldPosition[1]; const sample = nearbyTorsoPoints(positions, y, 0.052);
    const centerZ = sample.length ? average(sample.map((point) => point[2])) : joint.bindWorldPosition[2]; const radiusX = Math.max(0.07, percentile(sample.map((point) => Math.abs(point[0])), 0.9));
    const frontRadius = Math.max(0.055, percentile(sample.map((point) => Math.max(0, point[2] - centerZ)), 0.9)); const backRadius = Math.max(0.045, percentile(sample.map((point) => Math.max(0, centerZ - point[2])), 0.9));
    const controls = LATTICE_CIRCUMFERENCE_DIRECTIONS_V1.map((direction) => { const cosine = Math.cos(direction.angle); const sine = Math.sin(direction.angle); const zRadius = sine >= 0 ? frontRadius : backRadius; return { id: direction.id, restPosition: [cosine * radiusX, y, centerZ + sine * zRadius] }; });
    return { id: definition.id, boneId: definition.boneId, center: [0, y, centerZ], radiusX, frontRadius, backRadius, controls };
  });
  return { schema: 'humanoid_rig/spine_torso_lattice@1.0', latticeId: 'SpineTorsoLatticeV1', hidden: true, visibleMesh: false, ringCount: rings.length, controlsPerRing: 8, rings };
}

export function buildPelvisHipGroinLatticeV1(positions, joints) {
  const pelvis = joints.get('pelvis').bindWorldPosition; const leftHip = joints.get('leftUpperLeg').bindWorldPosition; const rightHip = joints.get('rightUpperLeg').bindWorldPosition;
  const definitions = {
    'pelvis-upper-ring': [0, 0.17, 0.10], 'pelvis-lower-ring': [0, 0.055, 0.085],
    'left-hip-root-ring': [leftHip[0], 0.085, leftHip[2]], 'right-hip-root-ring': [rightHip[0], 0.085, rightHip[2]],
    'left-upper-thigh-proximal-ring': [leftHip[0], -0.055, leftHip[2]], 'right-upper-thigh-proximal-ring': [rightHip[0], -0.055, rightHip[2]],
    'groin-front-bridge': [0, 0.035, 0.145], 'groin-back-bridge': [0, 0.025, 0.02],
    'left-gluteal-control-band': [-0.09, 0.065, 0.005], 'right-gluteal-control-band': [0.09, 0.065, 0.005],
  };
  const sections = PELVIS_HIP_GROIN_LATTICE_SECTIONS_V1.map((section) => ({ ...section, restCenter: definitions[section.id] || pelvis, controls: controlBand(definitions[section.id] || pelvis, section.id.includes('bridge') ? [0.07, 0.035, 0.04] : [0.09, 0.045, 0.065]) }));
  return { schema: 'humanoid_rig/pelvis_hip_groin_lattice@1.0', latticeId: 'PelvisHipGroinLatticeV1', hidden: true, visibleMesh: false, sectionCount: sections.length, sections };
}

function controlBand(center, radius) { return LATTICE_CIRCUMFERENCE_DIRECTIONS_V1.map((direction) => ({ id: direction.id, restPosition: [center[0] + Math.cos(direction.angle) * radius[0], center[1], center[2] + Math.sin(direction.angle) * radius[2]] })); }
function nearbyTorsoPoints(positions, y, band) { const points = []; for (let vertex = 0; vertex < positions.length / 3; vertex += 1) { const point = read3(positions, vertex); if (Math.abs(point[1] - y) <= band && Math.abs(point[0]) < 0.24) points.push(point); } return points; }
function regionalAssignment(group, id, weight) { return { group, id, weight: Math.max(0, Math.min(1, weight)) }; }
function isSpineTorso(point, name) { return point[1] >= 0.09 && point[1] <= 0.67 && Math.abs(point[0]) <= 0.235 && !/arm|elbow|forearm|wrist|palm|finger|eye|mouth|jaw|ear|hair/.test(name); }
function isPelvisHipGroin(point, name) { return point[1] >= -0.24 && point[1] <= 0.205 && Math.abs(point[0]) <= 0.255 && (/pelvis|gluteal|groin|hip_root|thigh_twist/.test(name) || point[1] < 0.17); }
function isElbow(point, name, sign, joints) { const center = joints.get(sign < 0 ? 'leftLowerArm' : 'rightLowerArm').bindWorldPosition; return sign * point[0] > 0.20 && (/elbow|forearm|upper_arm/.test(name) || distance(point, center) < 0.14) && distance(point, center) < 0.17; }
function isKnee(point, name, sign, joints) { const center = joints.get(sign < 0 ? 'leftLowerLeg' : 'rightLowerLeg').bindWorldPosition; return sign * point[0] > 0.035 && (/knee|patella|popliteal|calf|thigh_twist/.test(name) || distance(point, center) < 0.18) && distance(point, center) < 0.21; }
function spineBlend(point) { return smoothstep(normalize(point[1], 0.09, 0.16)) * smoothstep(normalize(0.67 - point[1], 0, 0.08)) * smoothstep(normalize(0.235 - Math.abs(point[0]), 0, 0.055)); }
function pelvisBlend(point, name) { const spatial = smoothstep(normalize(point[1], -0.24, -0.16)) * smoothstep(normalize(0.205 - point[1], 0, 0.055)) * smoothstep(normalize(0.255 - Math.abs(point[0]), 0, 0.05)); return spatial * (/pelvis|gluteal|groin|hip_root|thigh_twist/.test(name) ? 1 : 0.55); }
function jointBlend(point, center, radius) { return smoothstep(1 - distance(point, center) / radius); }
function locateSegment(values, value) { if (value <= values[0]) return { index: 0, t: 0 }; for (let index = 1; index < values.length; index += 1) if (value <= values[index]) return { index: index - 1, t: normalize(value, values[index - 1], values[index]) }; return { index: values.length - 2, t: 1 }; }
function circumferenceCoordinate(point) { return (Math.atan2(point[2] - 0.09, point[0]) + Math.PI) / (Math.PI * 2); }
function radialCoordinate(point) { return Math.min(1, Math.hypot(point[0], point[2] - 0.09) / 0.25); }
function pelvisCellId(point, name) { if (/front_groin/.test(name)) return 6; if (/back_groin/.test(name)) return 7; if (/gluteal/.test(name)) return point[0] < 0 ? 8 : 9; if (point[1] > 0.12) return 0; if (Math.abs(point[0]) < 0.05) return 1; if (point[1] > 0) return point[0] < 0 ? 2 : 3; return point[0] < 0 ? 4 : 5; }
function normalize(value, minimum, maximum) { return Math.max(0, Math.min(1, (value - minimum) / Math.max(1e-9, maximum - minimum))); }
function smoothstep(value) { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); }
function percentile(values, p) { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]; }
function average(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function read3(values, vertex) { const offset = vertex * 3; return [values[offset], values[offset + 1], values[offset + 2]]; }
function write3(values, vertex, point) { const offset = vertex * 3; values[offset] = point[0]; values[offset + 1] = point[1]; values[offset + 2] = point[2]; }
