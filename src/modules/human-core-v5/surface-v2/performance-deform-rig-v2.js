import { PERFORMANCE_DEFORM_RIG_V2_SCHEMA } from './surface-carrier-v2-contract.js';

const CORE_TO_GAME_ENGINE = Object.freeze({
  hips: 'pelvis',
  spine: 'spine_01',
  chest: 'spine_02',
  upperChest: 'spine_03',
  neck: 'neck_01',
  head: 'head',
  leftShoulder: 'clavicle_l',
  rightShoulder: 'clavicle_r',
  leftUpperArm: 'upperarm_l',
  rightUpperArm: 'upperarm_r',
  leftLowerArm: 'lowerarm_l',
  rightLowerArm: 'lowerarm_r',
  leftHand: 'hand_l',
  rightHand: 'hand_r',
  leftHandEnd: 'middle_01_l',
  rightHandEnd: 'middle_01_r',
  leftUpperLeg: 'thigh_l',
  rightUpperLeg: 'thigh_r',
  leftLowerLeg: 'calf_l',
  rightLowerLeg: 'calf_r',
  leftFoot: 'foot_l',
  rightFoot: 'foot_r',
  leftToes: 'ball_l',
  rightToes: 'ball_r',
});

const CAPABILITIES = Object.freeze({
  clavicle: Object.freeze({ status: 'supported', bones: ['clavicle_l', 'clavicle_r'] }),
  scapula: Object.freeze({ status: 'unsupported', reason: 'Official game_engine rig has no weighted scapula bones.' }),
  upperArmTwist: Object.freeze({ status: 'unsupported', reason: 'Official game_engine rig has no upper-arm twist bones.' }),
  forearmTwist: Object.freeze({ status: 'unsupported', reason: 'Official game_engine rig has no forearm twist bones.' }),
  thighTwist: Object.freeze({ status: 'unsupported', reason: 'Official game_engine rig has no thigh twist bones.' }),
  calfTwist: Object.freeze({ status: 'unsupported', reason: 'Official game_engine rig has no calf twist bones.' }),
  fingers: Object.freeze({ status: 'supported', bones: 'official weighted thumb/index/middle/ring/pinky chains' }),
  correctives: Object.freeze({ status: 'unsupported', reason: 'Task 15A does not create pose-space correctives.' }),
});

export class PerformanceDeformRigV2 {
  constructor({ THREE, skeleton, carrierGroup, rigCore, sourceReferenceFrame } = {}) {
    if (!THREE || !skeleton || !carrierGroup || !Array.isArray(rigCore?.joints) || !sourceReferenceFrame?.joints) {
      throw new Error('PerformanceDeformRigV2 requires THREE, a loaded skeleton, carrier group, rigCore, and source reference frame.');
    }
    this.THREE = THREE;
    this.skeleton = skeleton;
    this.carrierGroup = carrierGroup;
    this.rigCore = rigCore;
    this.sourceReferenceFrame = sourceReferenceFrame;
    this.boneByName = new Map(skeleton.bones.map((bone) => [bone.name, bone]));
    this.jointMap = new Map();
    for (const [jointId, boneName] of Object.entries(CORE_TO_GAME_ENGINE)) {
      const bone = this.boneByName.get(boneName);
      if (!bone) throw new Error(`Candidate A is missing required target bone ${boneName} for ${jointId}.`);
      this.jointMap.set(jointId, bone);
    }
    this.original = captureBoneTransforms(this.jointMap);
    this.capabilities = CAPABILITIES;
    this.referenceTransforms = null;
    this.fullBasis = null;
    this.rootCarrierOffset = null;
  }

  getSchema() { return PERFORMANCE_DEFORM_RIG_V2_SCHEMA; }
  getJointMap() { return new Map(this.jointMap); }
  getCapabilities() { return structuredClone(this.capabilities); }
  getUnsupportedCapabilities() {
    return Object.entries(this.capabilities).filter(([, value]) => value.status === 'unsupported').map(([id, value]) => ({ capability: id, ...value }));
  }
  registerCalibration(calibrator) {
    this.referenceTransforms = calibrator.reference;
    this.fullBasis = calibrator.fullBasis;
    this.rootCarrierOffset = calibrator.referenceCarrierOffset.toArray();
  }
  describe() {
    return {
      schema: PERFORMANCE_DEFORM_RIG_V2_SCHEMA,
      authority: 'HumanRigCore finalPose read-only',
      coreJointMapping: Object.fromEntries([...this.jointMap].map(([jointId, bone]) => [jointId, bone.name])),
      parentRelationships: Object.fromEntries([...this.jointMap].map(([jointId, bone]) => [jointId, bone.parent?.name ?? null])),
      targetOriginalBindTransforms: Object.fromEntries([...this.original].map(([jointId, transform]) => [jointId, serializeTransform(transform)])),
      targetHumanCoreReferenceRegistered: Boolean(this.referenceTransforms),
      fullBasisCorrectionRegistered: Boolean(this.fullBasis),
      rootCarrierOffset: this.rootCarrierOffset,
      capabilities: structuredClone(this.capabilities),
      boneScaling: false,
      poseSpecificOffsets: false,
    };
  }
}

export function getCandidateAGameEngineJointMapping() { return { ...CORE_TO_GAME_ENGINE }; }

function captureBoneTransforms(jointMap) {
  return new Map([...jointMap].map(([jointId, bone]) => [jointId, {
    position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone(), matrixWorld: bone.matrixWorld.clone(),
  }]));
}
function serializeTransform(value) {
  return { position: value.position.toArray(), quaternion: value.quaternion.toArray(), scale: value.scale.toArray(), matrixWorld: value.matrixWorld.toArray() };
}
