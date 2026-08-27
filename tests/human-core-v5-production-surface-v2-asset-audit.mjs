import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getCandidateAGameEngineJointMapping } from '../src/modules/human-core-v5/surface-v2/performance-deform-rig-v2.js';

const root = path.resolve('.');
const assetDir = path.join(root, 'assets/human/production-surface-v2/candidate-a');
const qaDir = path.join(root, 'artifacts/qa/task15a-production-surface-v2');
const glbPath = path.join(assetDir, 'neutral-body-candidate-a.glb');
const receipt = readJson(path.join(assetDir, 'ASSET_RECEIPT.json'));
const sourceLock = readJson(path.join(assetDir, 'SOURCE_LOCK.json'));
const conversion = readJson(path.join(qaDir, 'conversion-report.json'));
const validation = readJson(path.join(qaDir, 'asset-validation.json'));
const glbBytes = fs.readFileSync(glbPath);
const { json, binary } = parseGlb(glbBytes);
const primitive = json.meshes[0].primitives[0];
const weights = readAccessor(json, binary, primitive.attributes.WEIGHTS_0);
const joints = readAccessor(json, binary, primitive.attributes.JOINTS_0);
const inverseBind = readAccessor(json, binary, json.skins[0].inverseBindMatrices);
const boneNames = json.skins[0].joints.map((nodeIndex) => json.nodes[nodeIndex].name);
const mapping = getCandidateAGameEngineJointMapping();
const missingMappedBones = Object.values(mapping).filter((boneName) => !boneNames.includes(boneName));
let maximumWeightSumError = 0; let zeroWeightVertices = 0; let maximumStoredInfluences = 0;
for (let vertex = 0; vertex < weights.length / 4; vertex += 1) {
  let sum = 0; let count = 0;
  for (let slot = 0; slot < 4; slot += 1) {
    const value = weights[vertex * 4 + slot]; sum += value; if (value > 0) count += 1;
    if (joints[vertex * 4 + slot] >= boneNames.length) throw new Error(`JOINTS_0 out of range at vertex ${vertex}.`);
  }
  maximumWeightSumError = Math.max(maximumWeightSumError, Math.abs(sum - 1));
  maximumStoredInfluences = Math.max(maximumStoredInfluences, count);
  if (sum === 0) zeroWeightVertices += 1;
}
const assertions = {
  sourceCommitLocked: sourceLock.sourceCommit === '437dd513888a92399d1d3200d2e80859fae55abc',
  licenseCC0: receipt.license === 'CC0-1.0',
  convertedHashMatches: sha256(glbBytes) === receipt.convertedHash,
  convertedSizeMatches: glbBytes.byteLength === receipt.convertedSize,
  validatorPassed: validation.passed === true && validation.errors === 0,
  hasRealSkin: json.skins.length === 1 && json.skins[0].joints.length === 53,
  hasJointAndWeightAttributes: Number.isInteger(primitive.attributes.JOINTS_0) && Number.isInteger(primitive.attributes.WEIGHTS_0),
  hasInverseBindMatrices: inverseBind.length === 53 * 16,
  allCoreMappingsResolved: missingMappedBones.length === 0,
  noZeroWeightVertices: zeroWeightVertices === 0,
  normalizedWeights: maximumWeightSumError <= 1e-5,
  maximumFourStoredInfluences: maximumStoredInfluences <= 4,
  truncationWithinLimit: conversion.maximumDiscardedWeight <= 0.08 && conversion.meanDiscardedWeight <= 0.01,
  noAutomaticWeights: conversion.automaticWeightsUsed === false,
  helperGeometryRemoved: conversion.helperGeometryRemoved === true,
};
const passed = Object.values(assertions).every(Boolean);
const weightAudit = {
  schema: 'humanoid_rig/task15a_weight_audit@1.0',
  officialWeightFile: 'src/mpfb/data/rigs/standard/weights.game_engine.json',
  officialWeightHash: receipt.originalHashes.weights,
  sourceMaximumInfluences: conversion.maximumInfluencesBeforeTruncation,
  verticesAboveFourInfluences: conversion.verticesAboveFourInfluences,
  storedMaximumInfluences: maximumStoredInfluences,
  maximumDiscardedWeight: conversion.maximumDiscardedWeight,
  meanDiscardedWeight: conversion.meanDiscardedWeight,
  maximumWeightSumError,
  zeroWeightVertices,
  automaticWeightsUsed: false,
  passed: assertions.noZeroWeightVertices && assertions.normalizedWeights && assertions.maximumFourStoredInfluences && assertions.truncationWithinLimit,
};
const rigMapping = {
  schema: 'humanoid_rig/task15a_rig_mapping@1.0',
  officialRigFile: 'src/mpfb/data/rigs/standard/rig.game_engine.json',
  officialRigHash: receipt.originalHashes.rig,
  jointCount: boneNames.length,
  bones: boneNames,
  coreJointMapping: mapping,
  missingMappedBones,
  capabilities: {
    clavicle: { status: 'supported', bones: ['clavicle_l', 'clavicle_r'] },
    fingers: { status: 'supported', detail: 'Five official weighted three-segment finger chains per hand.' },
    scapula: { status: 'unsupported' },
    upperArmTwist: { status: 'unsupported' },
    forearmTwist: { status: 'unsupported' },
    thighTwist: { status: 'unsupported' },
    calfTwist: { status: 'unsupported' },
    correctives: { status: 'unsupported' },
  },
  boneScaling: false,
  poseSpecificOffsets: false,
  finalPoseReadOnly: true,
  passed: missingMappedBones.length === 0,
};
writeJson(path.join(qaDir, 'weight-audit.json'), weightAudit);
writeJson(path.join(qaDir, 'rig-mapping.json'), rigMapping);
console.log(JSON.stringify({ passed, assertions, weightAudit, rigMapping }, null, 2));
if (!passed) process.exitCode = 1;

function parseGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) throw new Error('Invalid GLB header.');
  const jsonLength = bytes.readUInt32LE(12); const jsonType = bytes.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a) throw new Error('GLB JSON chunk is missing.');
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').trim());
  const binHeader = 20 + jsonLength; const binLength = bytes.readUInt32LE(binHeader); const binType = bytes.readUInt32LE(binHeader + 4);
  if (binType !== 0x004e4942) throw new Error('GLB BIN chunk is missing.');
  return { json, binary: bytes.subarray(binHeader + 8, binHeader + 8 + binLength) };
}
function readAccessor(json, binary, accessorIndex) {
  const accessor = json.accessors[accessorIndex]; const view = json.bufferViews[accessor.bufferView];
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[accessor.type];
  const constructors = { 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const Constructor = constructors[accessor.componentType];
  return new Constructor(binary.buffer, binary.byteOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), accessor.count * components);
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex').toUpperCase(); }
function readJson(filename) { return JSON.parse(fs.readFileSync(filename, 'utf8')); }
function writeJson(filename, value) { fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`); }
