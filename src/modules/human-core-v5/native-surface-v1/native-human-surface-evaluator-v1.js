import { createBodyDNA } from '../body-dna-v5.js';
import { assertHumanRigCoreV5 } from '../human-rig-core-v5.js';
import { adaptHumanRigCoreToExistingRig } from '../v4-adapter.js';
import { stableFingerprint } from '../core-utils.js';
import {
  NATIVE_HUMAN_SURFACE_REFERENCE_HEIGHT,
  assertNativeHumanSurfaceTopologyV1,
  createNativeHumanSurfaceTopologyV1,
} from './native-human-surface-topology-v1.js';

export const NATIVE_HUMAN_SURFACE_EVALUATOR_V1_SCHEMA = 'humanoid_rig/native_human_surface_evaluator@1.0';
export const NATIVE_HUMAN_SURFACE_PRESET_IDS_V1 = Object.freeze([
  'reference', 'lean', 'muscular', 'heavy', 'tall', 'short', 'asymmetric',
]);

export const NATIVE_HUMAN_SURFACE_BODY_DNA_PRESETS_V1 = deepFreeze({
  reference: {},
  lean: {
    bodyType: { category: 'ectomorph', morphology: 'lean' },
    mass: { weightKg: 58 },
    fitnessProfile: { muscle: 0.35, fat: 0.16, distribution: { upperBody: 0.40, lowerBody: 0.42 } },
    proportion: { bodyThickness: { chest: 0.19, waist: 0.15, hip: 0.19 } },
  },
  muscular: {
    bodyType: { category: 'mesomorph', morphology: 'muscular' },
    mass: { weightKg: 92 },
    fitnessProfile: { muscle: 0.88, fat: 0.16, distribution: { upperBody: 0.82, lowerBody: 0.75 } },
    proportion: { shoulderWidth: 0.49, bodyThickness: { chest: 0.31, waist: 0.22, hip: 0.27 } },
  },
  heavy: {
    bodyType: { category: 'endomorph', morphology: 'heavy' },
    mass: { weightKg: 112 },
    fitnessProfile: { muscle: 0.42, fat: 0.84, distribution: { upperBody: 0.52, lowerBody: 0.62 } },
    proportion: { hipWidth: 0.25, bodyThickness: { chest: 0.35, waist: 0.34, hip: 0.38 } },
  },
  tall: {
    proportion: {
      height: 2.02, shoulderWidth: 0.46, hipWidth: 0.21, headToBodyRatio: 8.1,
      limbLengths: { upperArm: 0.34, forearm: 0.30, handControl: 0.085, thigh: 0.52, lowerLeg: 0.49 },
    },
  },
  short: {
    proportion: {
      height: 1.55, shoulderWidth: 0.36, hipWidth: 0.19, headToBodyRatio: 6.8,
      limbLengths: { upperArm: 0.24, forearm: 0.21, handControl: 0.065, thigh: 0.36, lowerLeg: 0.34 },
    },
  },
  asymmetric: {
    asymmetry: {
      mode: 'authored',
      leftRightScale: { shoulder: 1.10, arm: 1.08, hand: 1.05, hip: 1.06, leg: 1.08, foot: 1.04 },
    },
  },
});

export const NATIVE_HUMAN_SURFACE_BODY_DNA_MAPPING_V1 = deepFreeze({
  height: 'piecewise longitudinal cage anchors and exact headTop/ground extent',
  shoulderWidth: 'upper-torso breadth, clavicle slope, shoulder junction placement',
  chestWidth: 'upper-torso lateral radius derived from shoulderWidth and fitness',
  chestDepth: 'proportion.bodyThickness.chest front/back depth',
  waistWidth: 'lower-torso breadth derived from bodyThickness.waist and fat',
  waistDepth: 'proportion.bodyThickness.waist front/back depth',
  pelvisWidth: 'hip centers plus pelvis shell radius from hipWidth',
  pelvisDepth: 'proportion.bodyThickness.hip front/back depth',
  upperArmLength: 'T-pose shoulder-to-elbow anchor span',
  forearmLength: 'T-pose elbow-to-wrist anchor span',
  handLength: 'wrist-to-palm anchor plus handControl extension',
  thighLength: 'hip-to-knee longitudinal anchors',
  calfLength: 'knee-to-ankle longitudinal anchors',
  footLength: 'front toe and rear heel depth from handControl-independent foot profile',
  armVolume: 'muscle, fat, upperBody fitness distribution and mass',
  legVolume: 'muscle, fat, lowerBody fitness distribution and mass',
  muscle: 'deltoid, upper-arm, forearm, thigh and calf radial accents',
  fat: 'torso, abdomen, pelvis and limb soft-volume expansion',
  leftRightAsymmetry: 'authored BodyDNA side scales only; symmetric mode remains mirrored',
});

export function createNativeHumanSurfaceBodyDNAPresetV1(presetId = 'reference') {
  const id = String(presetId).toLowerCase();
  const preset = NATIVE_HUMAN_SURFACE_BODY_DNA_PRESETS_V1[id];
  if (!preset) throw new Error(`Unknown Native Human Surface V1 preset ${presetId}.`);
  return createBodyDNA({
    ...structuredClone(preset),
    bodyDNAId: `native-surface-v1-${id}`,
    identity: { humanId: `native-surface-v1-${id}`, label: `Native Surface V1 ${id}` },
    proportionRevision: 16,
  });
}

export class NativeHumanSurfaceEvaluatorV1 {
  constructor({ topology = createNativeHumanSurfaceTopologyV1() } = {}) {
    assertNativeHumanSurfaceTopologyV1(topology);
    this.topology = structuredClone(topology);
    this.schema = NATIVE_HUMAN_SURFACE_EVALUATOR_V1_SCHEMA;
    this.type = 'NativeHumanSurfaceEvaluatorV1';
  }

  evaluate({ bodyDNA, rigCore }) {
    const dna = createBodyDNA(bodyDNA);
    assertHumanRigCoreV5(rigCore);
    const adapted = adaptHumanRigCoreToExistingRig(rigCore, { bodyDNA: dna, pose: 'T' });
    const joints = new Map(adapted.definition.joints.map((joint) => [joint.id, joint.poseWorldPosition]));
    const positions = new Float64Array(this.topology.vertexCount * 3);
    for (const vertex of this.topology.vertices) {
      const [u, v, shellCoordinate] = vertex.controlCoordinate;
      const point = evaluateControlCoordinate({
        u, v, shellCoordinate, regionId: vertex.regionId, side: vertex.leftRightSide, dna, joints,
      });
      positions.set(point, vertex.vertexId * 3);
    }
    enforceSymmetryPolicy(positions, this.topology, dna);
    const normals = computeIndexedVertexNormals(positions, this.topology.indices);
    return {
      schema: NATIVE_HUMAN_SURFACE_EVALUATOR_V1_SCHEMA,
      schemaVersion: 1,
      type: 'NativeHumanSurfaceEvaluationV1',
      geometryId: `native-surface-v1-${dna.bodyDNAId}`,
      bodyDNAId: dna.bodyDNAId,
      bodyDNAFingerprint: stableFingerprint(dna),
      rigId: rigCore.rigId,
      rigTopologyFingerprint: rigCore.topology.fingerprint,
      topologyFingerprint: this.topology.topologyFingerprint,
      indexHash: this.topology.indexHash,
      vertexCount: this.topology.vertexCount,
      triangleCount: this.topology.triangleCount,
      positions,
      normals,
      indices: new Uint32Array(this.topology.indices),
      bodyDNAMapping: structuredClone(NATIVE_HUMAN_SURFACE_BODY_DNA_MAPPING_V1),
      authority: {
        topology: 'NativeHumanSurfaceTopologyV1',
        proportions: 'BodyDNA',
        anatomicalAnchors: 'HumanRigCore through read-only V4Adapter T-pose projection',
        mutatesBodyDNA: false,
        mutatesHumanRigCore: false,
        createsSecondRig: false,
        usesBoneScaling: false,
        externalHumanMeshUsed: false,
      },
    };
  }
}

export function evaluateNativeHumanSurfaceV1(options) {
  return new NativeHumanSurfaceEvaluatorV1({ topology: options?.topology }).evaluate(options);
}

export function computeIndexedVertexNormals(positions, indices) {
  const normals = new Float64Array(positions.length);
  for (let cursor = 0; cursor < indices.length; cursor += 3) {
    const ia = indices[cursor] * 3;
    const ib = indices[cursor + 1] * 3;
    const ic = indices[cursor + 2] * 3;
    const abx = positions[ib] - positions[ia];
    const aby = positions[ib + 1] - positions[ia + 1];
    const abz = positions[ib + 2] - positions[ia + 2];
    const acx = positions[ic] - positions[ia];
    const acy = positions[ic + 1] - positions[ia + 1];
    const acz = positions[ic + 2] - positions[ia + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const offset of [ia, ib, ic]) {
      normals[offset] += nx;
      normals[offset + 1] += ny;
      normals[offset + 2] += nz;
    }
  }
  for (let cursor = 0; cursor < normals.length; cursor += 3) {
    const length = Math.hypot(normals[cursor], normals[cursor + 1], normals[cursor + 2]);
    if (length <= 1e-14) throw new Error(`Native surface normal is undefined at vertex ${cursor / 3}.`);
    normals[cursor] /= length;
    normals[cursor + 1] /= length;
    normals[cursor + 2] /= length;
  }
  return normals;
}

function evaluateControlCoordinate({ u, v, shellCoordinate, regionId, side, dna, joints }) {
  const sideName = side === 'center' ? (u < 0 ? 'left' : 'right') : side;
  const y = mapLongitudinalCoordinate(u, v, regionId, sideName, dna, joints);
  const x = mapLateralCoordinate(u, v, regionId, sideName, dna, joints);
  const depth = mapDepthCoordinate(u, v, shellCoordinate, regionId, sideName, dna);
  return [x, y, depth];
}

function mapLongitudinalCoordinate(u, v, regionId, side, dna, joints) {
  const anchors = [
    [0.000, 0.000],
    [0.105, averageSideJoint(joints, 'Foot', 1)],
    [0.490, averageSideJoint(joints, 'LowerLeg', 1)],
    [0.925, joint(joints, 'hips')[1]],
    [1.055, joint(joints, 'spine')[1]],
    [1.190, joint(joints, 'chest')[1]],
    [1.335, joint(joints, 'upperChest')[1]],
    [1.570, joint(joints, 'neck')[1]],
    [1.690, joint(joints, 'head')[1]],
    [NATIVE_HUMAN_SURFACE_REFERENCE_HEIGHT, dna.proportion.height],
  ];
  return piecewiseMap(v, anchors);
}

function mapLateralCoordinate(u, v, regionId, side, dna, joints) {
  if (Math.abs(u) < 1e-12) return 0;
  const sign = u < 0 ? -1 : 1;
  const absoluteX = Math.abs(u);
  const canonicalWidth = canonicalTorsoHalfWidth(v);
  const targetWidth = torsoHalfWidthAtV(dna, side, v);
  const torsoMapped = (absoluteX / Math.max(1e-6, canonicalWidth)) * targetWidth;

  const shoulder = Math.abs(joint(joints, `${side}UpperArm`)[0]);
  const elbow = Math.abs(joint(joints, `${side}LowerArm`)[0]);
  const wrist = Math.abs(joint(joints, `${side}Hand`)[0]);
  const palm = Math.abs(joint(joints, `${side}HandEnd`)[0]);
  const armShell = 0.057 * (0.82 + 0.25 * dna.fitnessProfile.muscle + 0.14 * dna.fitnessProfile.fat);
  const handExtension = dna.proportion.limbLengths.handControl * 0.92;
  const armMapped = piecewiseMap(absoluteX, [
    [0.000, 0.000],
    [0.225, shoulder + armShell * 0.35],
    [0.520, elbow],
    [0.850, wrist],
    [1.027, palm + handExtension],
  ]);
  const armWeight = smoothstep(1.350, 1.415, v) * (1 - smoothstep(1.555, 1.625, v));

  const canonicalLeg = canonicalLegInterval(v);
  const legCenter = sideLegCenter(joints, side, v);
  const legRadiusValue = legRadiusAtV(dna, side, v);
  const legMapped = legCenter + (absoluteX - canonicalLeg.center) / Math.max(1e-6, canonicalLeg.radius) * legRadiusValue;
  const legWeight = 1 - smoothstep(0.760, 0.840, v);
  const upperMapped = torsoMapped + (armMapped - torsoMapped) * armWeight;
  return sign * (upperMapped + (legMapped - upperMapped) * legWeight);
}

function mapDepthCoordinate(u, v, shellCoordinate, regionId, side, dna) {
  const muscle = dna.fitnessProfile.muscle;
  const fat = dna.fitnessProfile.fat;
  const sideFactor = asymmetryScale(dna, side, regionId);
  let base = baseDepth(dna, regionId, v) * sideFactor;
  const x = Math.abs(u);
  let frontFactor = 1;
  let backFactor = 1;
  if (regionId === 'upper-torso') {
    frontFactor += 0.12 * gaussian(v, 1.365, 0.12) * (0.55 + muscle * 0.45);
    backFactor += 0.08 * gaussian(v, 1.410, 0.11);
  }
  if (regionId === 'lower-torso') frontFactor += 0.20 * fat * gaussian(v, 1.115, 0.12);
  if (regionId === 'pelvis' || regionId === 'hip-junction') {
    frontFactor += 0.06 * fat;
    backFactor += 0.18 * (0.45 + fat * 0.55) * gaussian(v, 0.940, 0.13);
  }
  if (regionId === 'shoulder-junction') {
    const axilla = gaussian(v, 1.410, 0.035) * gaussian(x, 0.245, 0.055);
    base *= 1 - 0.18 * axilla;
    frontFactor += 0.10 * muscle;
    backFactor += 0.08 * muscle;
  }
  if (regionId === 'elbow-junction') {
    frontFactor -= 0.08 * gaussian(v, 1.425, 0.035);
    backFactor += 0.12 * gaussian(v, 1.530, 0.045);
  }
  if (regionId === 'knee-junction') {
    frontFactor += 0.22 * gaussian(v, 0.490, 0.045);
    backFactor -= 0.13 * gaussian(v, 0.490, 0.050);
  }
  if (regionId === 'calf') {
    frontFactor += 0.04 * gaussian(v, 0.300, 0.13);
    backFactor += 0.20 * (0.45 + muscle * 0.55) * gaussian(v, 0.315, 0.11);
  }
  if (regionId === 'foot') {
    const footLength = 0.145 + (dna.proportion.height / NATIVE_HUMAN_SURFACE_REFERENCE_HEIGHT - 1) * 0.035;
    const front = base + footLength * (0.58 + 0.18 * gaussian(v, 0.045, 0.04));
    const back = base + footLength * 0.40;
    return shellCoordinate >= 0 ? shellCoordinate * front : shellCoordinate * back;
  }
  const depth = shellCoordinate >= 0 ? base * frontFactor : base * backFactor;
  return shellCoordinate * depth;
}

function baseDepth(dna, regionId, v) {
  const heightScale = dna.proportion.height / NATIVE_HUMAN_SURFACE_REFERENCE_HEIGHT;
  const muscle = dna.fitnessProfile.muscle;
  const fat = dna.fitnessProfile.fat;
  const massScale = Math.max(0.85, Math.min(1.18, Math.cbrt(dna.mass.weightKg / 75)));
  const values = {
    head: 0.105 * heightScale,
    neck: 0.067 * heightScale,
    'upper-torso': dna.proportion.bodyThickness.chest * 0.50,
    'lower-torso': dna.proportion.bodyThickness.waist * 0.50,
    pelvis: dna.proportion.bodyThickness.hip * 0.50,
    'shoulder-junction': 0.068 * (0.78 + 0.32 * muscle + 0.16 * fat),
    'upper-arm': 0.060 * (0.74 + 0.40 * muscle + 0.18 * fat),
    'elbow-junction': 0.052 * (0.88 + 0.12 * muscle + 0.10 * fat),
    forearm: 0.049 * (0.82 + 0.28 * muscle + 0.12 * fat),
    hand: 0.035 * (0.94 + 0.10 * massScale),
    'hip-junction': dna.proportion.bodyThickness.hip * 0.43,
    thigh: 0.083 * (0.76 + 0.34 * muscle + 0.25 * fat),
    'knee-junction': 0.057 * (0.90 + 0.10 * muscle + 0.12 * fat),
    calf: 0.061 * (0.75 + 0.34 * muscle + 0.17 * fat),
    ankle: 0.043 * massScale,
    foot: 0.050 * massScale,
  };
  return values[regionId] ?? 0.08;
}

function torsoHalfWidthAtV(dna, side, v) {
  const muscle = dna.fitnessProfile.muscle;
  const fat = dna.fitnessProfile.fat;
  const heightScale = (dna.proportion.height / NATIVE_HUMAN_SURFACE_REFERENCE_HEIGHT) ** 0.35;
  const pelvis = dna.proportion.hipWidth * 0.50 + 0.090 + 0.020 * fat;
  const waist = 0.095 + dna.proportion.bodyThickness.waist * 0.30 + 0.025 * fat;
  const chest = dna.proportion.shoulderWidth * 0.47 + 0.012 * muscle + 0.010 * fat;
  const shoulder = dna.proportion.shoulderWidth * 0.50 + 0.012 * muscle;
  const neck = 0.095 * (0.88 + 0.16 * muscle + 0.08 * fat);
  const head = 0.108 * heightScale;
  const regionScale = v < 1.25 ? asymmetryScale(dna, side, v < 0.82 ? 'hip-junction' : 'pelvis')
    : asymmetryScale(dna, side, 'upper-torso');
  return piecewiseMap(v, [
    [0.790, pelvis * 0.62],
    [0.925, pelvis],
    [1.015, pelvis],
    [1.115, waist],
    [1.245, waist * 1.08],
    [1.365, chest],
    [1.500, shoulder],
    [1.570, neck * 1.22],
    [1.612, neck],
    [1.718, head],
    [NATIVE_HUMAN_SURFACE_REFERENCE_HEIGHT, head * 0.48],
  ]) * regionScale;
}

function canonicalTorsoHalfWidth(v) {
  return piecewiseMap(v, [
    [0.790, 0.060], [0.925, 0.193], [1.015, 0.196], [1.115, 0.164],
    [1.245, 0.177], [1.365, 0.218], [1.570, 0.178], [1.612, 0.103],
    [1.718, 0.112], [NATIVE_HUMAN_SURFACE_REFERENCE_HEIGHT, 0.052],
  ]);
}

function canonicalLegInterval(v) {
  const inner = piecewiseMap(v, [[0, 0.052], [0.105, 0.043], [0.300, 0.047], [0.485, 0.052], [0.700, 0.060], [0.790, 0.052]]);
  const outer = piecewiseMap(v, [[0, 0.128], [0.105, 0.119], [0.335, 0.151], [0.500, 0.134], [0.755, 0.174], [0.790, 0.180]]);
  return { center: (inner + outer) * 0.5, radius: (outer - inner) * 0.5 };
}

function sideLegCenter(joints, side, v) {
  return piecewiseMap(v, [
    [0.000, Math.abs(joint(joints, `${side}Foot`)[0])],
    [0.105, Math.abs(joint(joints, `${side}Foot`)[0])],
    [0.490, Math.abs(joint(joints, `${side}LowerLeg`)[0])],
    [0.790, Math.abs(joint(joints, `${side}UpperLeg`)[0])],
  ]);
}

function legRadiusAtV(dna, side, v) {
  const muscle = dna.fitnessProfile.muscle;
  const fat = dna.fitnessProfile.fat;
  const massScale = Math.max(0.85, Math.min(1.18, Math.cbrt(dna.mass.weightKg / 75)));
  const foot = 0.057 * massScale * asymmetryScale(dna, side, 'foot');
  const ankle = 0.035 * massScale * asymmetryScale(dna, side, 'ankle');
  const calf = 0.055 * (0.75 + 0.34 * muscle + 0.17 * fat) * asymmetryScale(dna, side, 'calf');
  const knee = 0.049 * (0.90 + 0.10 * muscle + 0.12 * fat) * asymmetryScale(dna, side, 'knee-junction');
  const thigh = 0.085 * (0.76 + 0.34 * muscle + 0.25 * fat) * asymmetryScale(dna, side, 'thigh');
  return piecewiseMap(v, [[0, foot], [0.105, ankle], [0.315, calf], [0.490, knee], [0.700, thigh], [0.790, thigh * 1.04]]);
}

function asymmetryScale(dna, side, regionId) {
  if (dna.asymmetry.mode !== 'authored' || !['left', 'right'].includes(side)) return 1;
  const key = isArmRegion(regionId)
    ? regionId === 'hand' ? 'hand' : regionId === 'shoulder-junction' ? 'shoulder' : 'arm'
    : isLegRegion(regionId)
      ? regionId === 'foot' ? 'foot' : regionId === 'hip-junction' ? 'hip' : 'leg'
      : regionId === 'pelvis' ? 'hip' : regionId === 'upper-torso' ? 'shoulder' : null;
  if (!key) return 1;
  const authored = dna.asymmetry.leftRightScale[key];
  return side === 'left' ? authored : 2 - authored;
}

function enforceSymmetryPolicy(positions, topology, dna) {
  if (dna.asymmetry.mode === 'authored') return;
  for (const vertex of topology.vertices) {
    const partner = vertex.symmetryPartner;
    if (partner < vertex.vertexId) continue;
    const left = vertex.vertexId * 3;
    const right = partner * 3;
    if (partner === vertex.vertexId) {
      positions[left] = 0;
      continue;
    }
    const magnitude = (Math.abs(positions[left]) + Math.abs(positions[right])) * 0.5;
    const leftSign = vertex.controlCoordinate[0] < 0 ? -1 : 1;
    positions[left] = leftSign * magnitude;
    positions[right] = -leftSign * magnitude;
    positions[right + 1] = positions[left + 1] = (positions[left + 1] + positions[right + 1]) * 0.5;
    positions[right + 2] = positions[left + 2] = (positions[left + 2] + positions[right + 2]) * 0.5;
  }
}

function piecewiseMap(value, anchors) {
  if (value <= anchors[0][0]) return anchors[0][1];
  if (value >= anchors.at(-1)[0]) return anchors.at(-1)[1];
  for (let index = 1; index < anchors.length; index += 1) {
    const left = anchors[index - 1];
    const right = anchors[index];
    if (value <= right[0]) {
      const t = (value - left[0]) / Math.max(1e-12, right[0] - left[0]);
      return left[1] + (right[1] - left[1]) * t;
    }
  }
  return anchors.at(-1)[1];
}

function averageSideJoint(joints, suffix, component) {
  return (joint(joints, `left${suffix}`)[component] + joint(joints, `right${suffix}`)[component]) * 0.5;
}

function joint(joints, id) {
  const value = joints.get(id);
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`Native evaluator requires T-pose joint ${id}.`);
  return value;
}

function gaussian(value, center, radius) {
  const normalized = (value - center) / Math.max(1e-6, radius);
  return Math.exp(-normalized * normalized);
}

function smoothstep(minimum, maximum, value) {
  const t = Math.max(0, Math.min(1, (value - minimum) / Math.max(1e-12, maximum - minimum)));
  return t * t * (3 - 2 * t);
}

function isArmRegion(regionId) {
  return ['shoulder-junction', 'upper-arm', 'elbow-junction', 'forearm', 'hand'].includes(regionId);
}

function isLegRegion(regionId) {
  return ['hip-junction', 'thigh', 'knee-junction', 'calf', 'ankle', 'foot'].includes(regionId);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
