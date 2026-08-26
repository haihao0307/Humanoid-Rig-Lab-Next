import { createBodyDNA, assertBodyDNAV5, bodyDNAFingerprint } from '../body-dna-v5.js';
import { assertHumanRigCoreV5, cloneHumanRigCoreV5 } from '../human-rig-core-v5.js';
import { adaptHumanRigCoreToExistingRig } from '../v4-adapter.js';
import { stableFingerprint } from '../core-utils.js';
import {
  createEllipsoidPrimitive,
  createSuperellipsoidPrimitive,
  createTaperedEllipticalCapsulePrimitive,
} from './anatomical-field-primitives-v5.js';
import { ANATOMICAL_JUNCTION_POLICIES_V5 } from './anatomical-field-composition-v5.js';

export const BODY_FIELD_DEFINITION_V5_SCHEMA = 'humanoid_rig/body_field_definition@5.0';
export const BODY_FIELD_GENERATOR_VERSION_V5 = 'canonical-anatomical-field-v5.4.0';
export const BODY_FIELD_REGION_IDS_V5 = Object.freeze([
  'head', 'neck', 'upperTorso', 'lowerTorso', 'pelvis',
  'leftUpperArm', 'rightUpperArm', 'leftForearm', 'rightForearm', 'leftPalm', 'rightPalm',
  'leftThigh', 'rightThigh', 'leftCalf', 'rightCalf', 'leftFoot', 'rightFoot',
]);

export function createBodyFieldDefinitionV5({ bodyDNA = {}, rigCore, fieldOptions = {} } = {}) {
  const dna = createBodyDNA(bodyDNA);
  assertBodyDNAV5(dna);
  const core = cloneHumanRigCoreV5(rigCore);
  assertHumanRigCoreV5(core);
  const layout = createCanonicalLayout(dna, core);
  const regions = createRegions(dna, layout);
  const deformHelpers = createShoulderDeformHelpers(dna, layout);
  const subtractions = createAnatomicalSubtractions(dna, layout);
  const margin = Math.max(0.08, dna.proportion.height * 0.045);
  const bounds = {
    min: [-layout.halfSpanX - margin, -margin, -layout.maxBack - margin],
    max: [layout.halfSpanX + margin, dna.proportion.height + margin, layout.maxFront + margin],
  };
  const definition = {
    schema: BODY_FIELD_DEFINITION_V5_SCHEMA,
    schemaVersion: 5,
    type: 'BodyFieldDefinition',
    fieldId: `body-field-${dna.identity.humanId}`,
    generatorVersion: BODY_FIELD_GENERATOR_VERSION_V5,
    humanId: dna.identity.humanId,
    bodyDNAId: dna.bodyDNAId,
    bodyDNAFingerprint: bodyDNAFingerprint(dna),
    rigId: core.rigId,
    rigTopologyFingerprint: core.topology.fingerprint,
    proportionRevision: dna.proportionRevision,
    coordinateSystem: 'right-handed,+Y-up,+Z-forward,+X-right',
    bounds,
    regions,
    deformHelpers,
    subtractions,
    junctions: {
      shoulder: scaledJunction(ANATOMICAL_JUNCTION_POLICIES_V5.ShoulderFieldJunctionV5, dna.proportion.shoulderWidth),
      hip: scaledJunction(ANATOMICAL_JUNCTION_POLICIES_V5.HipFieldJunctionV5, dna.proportion.hipWidth * 2),
      neckTorso: scaledJunction(ANATOMICAL_JUNCTION_POLICIES_V5.NeckTorsoFieldJunctionV5, layout.headHeight),
      wristPalm: scaledJunction(ANATOMICAL_JUNCTION_POLICIES_V5.WristPalmFieldJunctionV5, dna.proportion.limbLengths.handControl),
      ankleFoot: scaledJunction(ANATOMICAL_JUNCTION_POLICIES_V5.AnkleFootFieldJunctionV5, layout.footLength),
    },
    compositionPolicy: {
      mode: 'anatomical-smooth-union-with-local-junction-policies',
      defaultBlendRadius: dna.proportion.height * 0.027,
      subtractionEnabled: true,
      deterministicOrdering: BODY_FIELD_REGION_IDS_V5,
    },
    surfacePolicy: {
      representation: 'canonical-implicit-field-stable-indexed-surface',
      isoLevel: 0,
      extraction: 'deterministic-marching-tetrahedra',
      regenerateOn: ['bodyDNAFingerprint', 'rigTopologyFingerprint', 'generatorVersion', 'resolution'],
      perFrameTopologyGeneration: false,
    },
    capabilities: {
      rendererIndependent: true,
      glbRequired: false,
      workerGeneration: true,
      stableTopology: true,
      authoredAsymmetry: true,
      deformOnlyHelperFields: true,
    },
    binding: {
      mode: 'field-contribution-regions',
      maximumInfluences: 4,
      createsRig: false,
      modifiesHierarchy: false,
    },
    canonicalLayout: layout,
    fingerprint: '',
  };
  definition.fingerprint = stableFingerprint(definitionWithoutFingerprint(definition));
  assertBodyFieldDefinitionV5(definition);
  return definition;
}

function createShoulderDeformHelpers(dna, layout) {
  const p = dna.proportion;
  const height = p.height;
  const helpers = [];
  const add = (helperType, side, bindingRegionId, primitive, blendRadius) => helpers.push({
    helperType,
    side,
    bindingRegionId,
    primitive,
    blendRadius,
    deformOnly: true,
    createsJoint: false,
    entersPoseFrame: false,
  });
  for (const [side, sign] of [['left', -1], ['right', 1]]) {
    const shoulder = layout.rigLandmarks[side].shoulder;
    const shoulderCenter = [sign * layout.shoulderX * 1.01, shoulder[1] - height * 0.010, shoulder[2] - height * 0.002];
    add('DeltoidCapFieldV5', side, `${side}UpperArm`, createEllipsoidPrimitive({
      id: `${side}-deltoid-cap-field`, region: `${side}ShoulderDeform`, sourceJointId: `${side}UpperArm`, side,
      center: shoulderCenter,
      radii: [height * 0.047, height * 0.050, height * 0.048],
    }), height * 0.018);
    add('ClavicleShelfFieldV5', side, 'upperTorso', createTaperedEllipticalCapsulePrimitive({
      id: `${side}-clavicle-shelf-field`, region: `${side}ShoulderDeform`, sourceJointId: 'upperChest', side,
      start: [sign * layout.shoulderX * 0.20, layout.shoulderY + height * 0.010, -height * 0.006],
      end: [sign * layout.shoulderX * 0.92, layout.shoulderY - height * 0.006, -height * 0.004],
      startRadii: [height * 0.026, height * 0.024, height * 0.030],
      endRadii: [height * 0.032, height * 0.030, height * 0.037],
    }), height * 0.015);
    add('AxillaryBridgeFieldV5', side, `${side}UpperArm`, createTaperedEllipticalCapsulePrimitive({
      id: `${side}-axillary-bridge-field`, region: `${side}ShoulderDeform`, sourceJointId: `${side}UpperArm`, side,
      start: [sign * layout.shoulderX * 0.62, layout.shoulderY - height * 0.060, -height * 0.002],
      end: [sign * layout.shoulderX * 1.01, layout.shoulderY - height * 0.026, 0],
      startRadii: [height * 0.034, height * 0.033, height * 0.036],
      endRadii: [height * 0.035, height * 0.036, height * 0.038],
    }), height * 0.017);
    add('ScapularBackPlaneFieldV5', side, 'upperTorso', createSuperellipsoidPrimitive({
      id: `${side}-scapular-back-plane-field`, region: `${side}ShoulderDeform`, sourceJointId: 'upperChest', side,
      center: [sign * layout.shoulderX * 0.55, layout.shoulderY - height * 0.055, -p.bodyThickness.chest * 0.42],
      radii: [height * 0.076, height * 0.080, height * 0.025],
      exponent: 3.2,
    }), height * 0.012);
  }
  return helpers;
}

export function validateBodyFieldDefinitionV5(value) {
  const errors = [];
  if (!value || value.schema !== BODY_FIELD_DEFINITION_V5_SCHEMA || value.type !== 'BodyFieldDefinition') {
    return { valid: false, errors: [`schema must be ${BODY_FIELD_DEFINITION_V5_SCHEMA}.`] };
  }
  for (const key of ['fieldId', 'generatorVersion', 'humanId', 'bodyDNAId', 'bodyDNAFingerprint', 'rigId', 'rigTopologyFingerprint']) {
    if (!String(value[key] ?? '').trim()) errors.push(`${key} is required.`);
  }
  if (!Array.isArray(value.regions) || value.regions.length !== BODY_FIELD_REGION_IDS_V5.length) errors.push('All canonical body regions are required.');
  if (value.capabilities?.rendererIndependent !== true || value.capabilities?.glbRequired !== false) errors.push('BodyFieldDefinition must remain renderer independent and GLB optional.');
  for (const forbidden of ['positions', 'vertices', 'indices', 'normals', 'skinWeights', 'texture', 'mesh']) {
    if (containsKey(value, forbidden)) errors.push(`BodyFieldDefinition cannot store ${forbidden}.`);
  }
  const expected = stableFingerprint(definitionWithoutFingerprint(value));
  if (value.fingerprint !== expected) errors.push('fingerprint does not match definition content.');
  return { valid: errors.length === 0, errors };
}

export function assertBodyFieldDefinitionV5(value) {
  const result = validateBodyFieldDefinitionV5(value);
  if (!result.valid) throw new Error(`Invalid BodyFieldDefinition V5: ${result.errors.join(' ')}`);
  return value;
}

function createCanonicalLayout(dna, rigCore) {
  const p = dna.proportion;
  const limbs = p.limbLengths;
  const height = p.height;
  const adapted = adaptHumanRigCoreToExistingRig(rigCore, { bodyDNA: dna, pose: 'T' });
  const bindWorld = new Map(adapted.definition.joints.map((joint) => [joint.id, finiteVector3(joint.poseWorldPosition)]));
  const headHeight = height / p.headToBodyRatio;
  const footHeight = height * 0.035;
  const leftLandmarks = createSideLandmarks(bindWorld, 'left');
  const rightLandmarks = createSideLandmarks(bindWorld, 'right');
  const ankleY = average(leftLandmarks.ankle[1], rightLandmarks.ankle[1]);
  const kneeY = average(leftLandmarks.knee[1], rightLandmarks.knee[1]);
  const hipY = average(leftLandmarks.hip[1], rightLandmarks.hip[1]);
  const shoulderY = average(leftLandmarks.shoulder[1], rightLandmarks.shoulder[1]);
  const rigRootPosition = bindWorld.get('hips') ?? [0, hipY, 0];
  const pelvisCenterY = rigRootPosition[1];
  const torsoLength = Math.max(height * 0.30, shoulderY - pelvisCenterY);
  const wristY = average(leftLandmarks.wrist[1], rightLandmarks.wrist[1]);
  const shoulderX = average(Math.abs(leftLandmarks.shoulder[0]), Math.abs(rightLandmarks.shoulder[0]));
  const hipX = average(Math.abs(leftLandmarks.hip[0]), Math.abs(rightLandmarks.hip[0]));
  const handLength = Math.max(limbs.handControl * 2.1, height * 0.085);
  const footLength = height * 0.145;
  const leftScale = sideScales(dna, 'left');
  const rightScale = sideScales(dna, 'right');
  const sideSpan = (scale) => shoulderX * scale.shoulder + (limbs.upperArm + limbs.forearm) * scale.arm + handLength * scale.hand;
  const maximumFootScale = Math.max(leftScale.foot, rightScale.foot);
  return {
    height, headHeight, footHeight, footLength, ankleY, kneeY, hipY, pelvisCenterY,
    rigRootPosition,
    upperArmLength: limbs.upperArm, forearmLength: limbs.forearm,
    handControlLength: limbs.handControl, thighLength: limbs.thigh, lowerLegLength: limbs.lowerLeg,
    shoulderY, torsoLength, wristY, shoulderX, hipX, handLength,
    rigLandmarks: { left: leftLandmarks, right: rightLandmarks },
    halfSpanX: Math.max(sideSpan(leftScale), sideSpan(rightScale)),
    maxFront: Math.max(p.bodyThickness.chest, p.bodyThickness.hip) / 2 + footLength * 0.72 * maximumFootScale,
    maxBack: Math.max(p.bodyThickness.chest, p.bodyThickness.hip) / 2 + footLength * 0.28,
  };
}

function createRegions(dna, layout) {
  const p = dna.proportion;
  const fit = dna.fitnessProfile;
  const massScale = Math.pow(dna.mass.weightKg / 75, 0.22);
  const muscle = 0.86 + fit.muscle * 0.28;
  const fat = 0.90 + fit.fat * 0.26;
  const armRadius = p.height * 0.036 * massScale * muscle;
  const forearmRadius = armRadius * 0.82;
  const thighRadius = p.height * 0.058 * massScale * (0.86 + fit.distribution.lowerBody * fit.muscle * 0.22);
  const calfRadius = thighRadius * 0.70;
  const torsoScale = massScale * (0.92 + fit.fat * 0.18);
  const left = sideScales(dna, 'left');
  const right = sideScales(dna, 'right');
  const regions = [];
  const add = (regionId, sourceJointId, side, primitive) => regions.push({ regionId, sourceJointId, side, primitive });
  add('head', 'head', 'center', createEllipsoidPrimitive({
    id: 'head-field', region: 'head', sourceJointId: 'head',
    center: [0, p.height - layout.headHeight * 0.50, 0],
    radii: [layout.headHeight * 0.34, layout.headHeight * 0.49, layout.headHeight * 0.39],
  }));
  add('neck', 'neck', 'center', createTaperedEllipticalCapsulePrimitive({
    id: 'neck-field', region: 'neck', sourceJointId: 'neck',
    start: [0, layout.shoulderY - p.height * 0.012, 0], end: [0, p.height - layout.headHeight * 0.92, 0],
    startRadii: [p.shoulderWidth * 0.14, p.height * 0.025, p.bodyThickness.chest * 0.28],
    endRadii: [layout.headHeight * 0.23, p.height * 0.025, layout.headHeight * 0.23],
  }));
  add('upperTorso', 'chest', 'center', createSuperellipsoidPrimitive({
    id: 'upper-torso-field', region: 'upperTorso', sourceJointId: 'chest',
    center: [0, layout.shoulderY - layout.torsoLength * 0.25, 0],
    radii: [p.shoulderWidth * 0.46, layout.torsoLength * 0.33, p.bodyThickness.chest * 0.52 * torsoScale], exponent: 2.7,
  }));
  add('lowerTorso', 'spine', 'center', createTaperedEllipticalCapsulePrimitive({
    id: 'lower-torso-field', region: 'lowerTorso', sourceJointId: 'spine',
    start: [0, layout.pelvisCenterY + layout.torsoLength * 0.03, 0], end: [0, layout.shoulderY - layout.torsoLength * 0.40, 0],
    startRadii: [p.hipWidth * 0.58, layout.torsoLength * 0.14, p.bodyThickness.waist * 0.52 * fat],
    endRadii: [p.shoulderWidth * 0.44, layout.torsoLength * 0.14, p.bodyThickness.chest * 0.47 * torsoScale],
    sweep: p.height * 0.008,
  }));
  add('pelvis', 'hips', 'center', createSuperellipsoidPrimitive({
    id: 'pelvis-field', region: 'pelvis', sourceJointId: 'hips', center: [0, layout.pelvisCenterY, 0],
    radii: [p.hipWidth * 0.465, p.height * 0.095, p.bodyThickness.hip * 0.54 * torsoScale], exponent: 2.55,
  }));
  for (const [side, sign, scaleSet] of [['left', -1, left], ['right', 1, right]]) {
    const landmarks = layout.rigLandmarks[side];
    const shoulder = [sign * Math.abs(landmarks.shoulder[0]) * 1.035 * scaleSet.shoulder, landmarks.shoulder[1], landmarks.shoulder[2]];
    const elbow = addScaledSegment(shoulder, landmarks.shoulder, landmarks.elbow, scaleSet.arm);
    const wrist = addScaledSegment(elbow, landmarks.elbow, landmarks.wrist, scaleSet.arm);
    add(`${side}UpperArm`, `${side}UpperArm`, side, createTaperedEllipticalCapsulePrimitive({
      id: `${side}-upper-arm-field`, region: `${side}UpperArm`, sourceJointId: `${side}UpperArm`, side,
      start: shoulder, end: elbow,
      startRadii: [armRadius * 1.08 * scaleSet.arm, armRadius * 1.12 * scaleSet.arm, armRadius * 1.15 * scaleSet.arm],
      endRadii: [armRadius * 0.83 * scaleSet.arm, armRadius * 0.88 * scaleSet.arm, armRadius * 0.90 * scaleSet.arm],
    }));
    add(`${side}Forearm`, `${side}LowerArm`, side, createTaperedEllipticalCapsulePrimitive({
      id: `${side}-forearm-field`, region: `${side}Forearm`, sourceJointId: `${side}LowerArm`, side,
      start: elbow, end: wrist,
      startRadii: [forearmRadius * scaleSet.arm, forearmRadius * 1.02 * scaleSet.arm, forearmRadius * 1.04 * scaleSet.arm],
      endRadii: [Math.max(forearmRadius * 0.72, p.height * 0.030) * scaleSet.arm, Math.max(forearmRadius * 0.76, p.height * 0.032) * scaleSet.arm, Math.max(forearmRadius * 0.78, p.height * 0.034) * scaleSet.arm],
    }));
    const palmRadii = [layout.handLength * 0.56 * scaleSet.hand, p.height * 0.036 * scaleSet.hand, p.height * 0.050 * scaleSet.hand];
    const palm = [wrist[0] + sign * palmRadii[0], wrist[1], wrist[2] + layout.footLength * 0.025];
    add(`${side}Palm`, `${side}Hand`, side, createSuperellipsoidPrimitive({
      id: `${side}-palm-field`, region: `${side}Palm`, sourceJointId: `${side}Hand`, side, center: palm,
      radii: palmRadii, exponent: 3.2,
    }));
    const hip = [sign * Math.abs(landmarks.hip[0]) * scaleSet.hip, landmarks.hip[1], landmarks.hip[2]];
    const knee = addScaledSegment(hip, landmarks.hip, landmarks.knee, scaleSet.leg);
    const ankle = addScaledSegment(knee, landmarks.knee, landmarks.ankle, scaleSet.leg);
    const foot = [sign * Math.abs(ankle[0]) * scaleSet.foot, layout.footHeight, ankle[2] + layout.footLength * 0.30];
    add(`${side}Thigh`, `${side}UpperLeg`, side, createTaperedEllipticalCapsulePrimitive({
      id: `${side}-thigh-field`, region: `${side}Thigh`, sourceJointId: `${side}UpperLeg`, side,
      start: hip, end: knee,
      startRadii: [thighRadius * 1.15 * scaleSet.leg, thighRadius * scaleSet.leg, thighRadius * 1.18 * scaleSet.leg],
      endRadii: [thighRadius * 0.78 * scaleSet.leg, thighRadius * 0.78 * scaleSet.leg, thighRadius * 0.85 * scaleSet.leg],
    }));
    add(`${side}Calf`, `${side}LowerLeg`, side, createTaperedEllipticalCapsulePrimitive({
      id: `${side}-calf-field`, region: `${side}Calf`, sourceJointId: `${side}LowerLeg`, side,
      start: knee, end: ankle,
      startRadii: [calfRadius * 0.94 * scaleSet.leg, calfRadius * scaleSet.leg, calfRadius * scaleSet.leg],
      endRadii: [calfRadius * 0.55 * scaleSet.leg, calfRadius * 0.55 * scaleSet.leg, calfRadius * 0.58 * scaleSet.leg],
      sweep: p.height * 0.006,
    }));
    add(`${side}Foot`, `${side}Foot`, side, createSuperellipsoidPrimitive({
      id: `${side}-foot-field`, region: `${side}Foot`, sourceJointId: `${side}Foot`, side, center: foot,
      radii: [p.height * 0.045 * scaleSet.foot, layout.footHeight, layout.footLength * 0.52 * scaleSet.foot], exponent: 3.1,
    }));
  }
  return regions.sort((a, b) => BODY_FIELD_REGION_IDS_V5.indexOf(a.regionId) - BODY_FIELD_REGION_IDS_V5.indexOf(b.regionId));
}

function createAnatomicalSubtractions(dna, layout) {
  const height = dna.proportion.height;
  const cuts = [];
  for (const [side, sign] of [['left', -1], ['right', 1]]) {
    cuts.push({
      subtractionId: `${side}-axilla-relief`,
      side,
      targetJunction: 'shoulder',
      blendRadius: height * 0.006,
      primitive: createEllipsoidPrimitive({
        id: `${side}-axilla-relief-field`,
        region: `${side}AxillaRelief`,
        sourceJointId: `${side}UpperArm`,
        side,
        center: [sign * layout.shoulderX * 0.96, layout.shoulderY - height * 0.058, -height * 0.028],
        radii: [height * 0.018, height * 0.025, height * 0.022],
      }),
    });
    cuts.push({
      subtractionId: `${side}-groin-relief`,
      side,
      targetJunction: 'hip',
      blendRadius: height * 0.009,
      primitive: createEllipsoidPrimitive({
        id: `${side}-groin-relief-field`,
        region: `${side}GroinRelief`,
        sourceJointId: `${side}UpperLeg`,
        side,
        center: [sign * layout.hipX * 0.44, layout.hipY - height * 0.025, -height * 0.012],
        radii: [height * 0.026, height * 0.044, height * 0.034],
      }),
    });
  }
  cuts.push({
    subtractionId: 'central-groin-separator',
    side: 'center',
    targetJunction: 'hip',
    blendRadius: height * 0.004,
    primitive: createTaperedEllipticalCapsulePrimitive({
      id: 'central-groin-separator-field',
      region: 'CentralGroinSeparator',
      sourceJointId: 'hips',
      side: 'center',
      // Keep the medial separator open to the exterior below both knees. A
      // cutter that terminates above the shorter asymmetric knee can become a
      // sealed internal cavity, which is reported as a second surface shell.
      start: [0, layout.kneeY - height * 0.10, 0],
      end: [0, layout.hipY - height * 0.045, 0],
      startRadii: [height * 0.016, height * 0.018, height * 0.072],
      endRadii: [height * 0.013, height * 0.014, height * 0.045],
    }),
  });
  return cuts;
}

function sideScales(dna, side) {
  if (dna.asymmetry.mode !== 'authored') return Object.fromEntries(Object.keys(dna.asymmetry.leftRightScale).map((key) => [key, 1]));
  const source = dna.asymmetry.leftRightScale;
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, side === 'left' ? value : 2 - value]));
}

function scaledJunction(base, scale) {
  return { ...base, blendRadius: Math.max(0.012, base.blendRadius * Math.max(0.5, scale / 0.42)) };
}

function createSideLandmarks(bindWorld, side) {
  const sign = side === 'left' ? -1 : 1;
  return {
    shoulder: bindWorld.get(`${side}UpperArm`) ?? [sign * 0.21, 1.33, 0],
    elbow: bindWorld.get(`${side}LowerArm`) ?? [sign * 0.49, 1.33, 0],
    wrist: bindWorld.get(`${side}Hand`) ?? [sign * 0.73, 1.33, 0],
    hip: bindWorld.get(`${side}UpperLeg`) ?? [sign * 0.10, 0.93, 0],
    knee: bindWorld.get(`${side}LowerLeg`) ?? [sign * 0.10, 0.50, 0],
    ankle: bindWorld.get(`${side}Foot`) ?? [sign * 0.10, 0.10, 0],
  };
}

function addScaledSegment(origin, sourceStart, sourceEnd, scale) {
  return origin.map((value, axis) => value + (sourceEnd[axis] - sourceStart[axis]) * scale);
}

function finiteVector3(value) {
  return Array.from({ length: 3 }, (_, axis) => Number.isFinite(Number(value?.[axis])) ? Number(value[axis]) : 0);
}

function average(a, b) { return (Number(a) + Number(b)) * 0.5; }

function definitionWithoutFingerprint(value) {
  const clone = structuredClone(value);
  delete clone.fingerprint;
  return clone;
}

function containsKey(value, target) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => key === target || containsKey(child, target));
}
