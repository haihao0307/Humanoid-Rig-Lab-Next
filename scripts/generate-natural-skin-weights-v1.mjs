import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { HRLSkinWeightGeneratorV1, encodeSkinWeightsV1 } from '../src/modules/human-core-v5/natural-skinning-v1/skin-weight-generator-v1.js';
import { loadAuthorityV1, naturalAssetDirectory, qaDirectory, readJson, sha256, json } from './natural-skinning-v1-io.mjs';

const { surface } = await loadAuthorityV1();
const performanceRig = await readJson(resolve(naturalAssetDirectory, 'PERFORMANCE_DEFORM_RIG_V1.json')).catch((error) => {
  if (error?.code === 'ENOENT') throw new Error('Run scripts/calibrate-natural-skinning-bind-v1.mjs first.');
  throw error;
});
const generated = new HRLSkinWeightGeneratorV1({
  positions: surface.chunks.basePositions,
  indices: surface.chunks.indices,
  vertexSide: surface.chunks.vertexSide,
  symmetryPartner: surface.chunks.symmetryPartner,
  primaryRegionIds: surface.chunks.primaryRegionIds,
  deformationRegions: surface.header.deformationRegions,
  performanceRig,
}).generate({ diffusionIterations: 10 });
const binary = encodeSkinWeightsV1(generated);
const metrics = generated.metrics;
const passed = metrics.zeroWeightVertexCount === 0 && metrics.negativeWeightCount === 0 && metrics.NaNWeightCount === 0 && metrics.InfWeightCount === 0
  && metrics.maximumWeightSumError <= 1e-6 && metrics.meanWeightSumError <= 1e-8 && metrics.maximumInfluenceCount <= 8
  && metrics.orphanBoneCount === 0 && metrics.unknownBoneIndexCount === 0 && metrics.leftRightWeightLeakCount === 0
  && metrics.maximumBilateralWeightError <= 1e-6 && metrics.centerlineBalanceError <= 1e-5 && metrics.maximumDiscardedWeight <= 0.005;
if (!passed) throw new Error(`WEIGHT_FIELD_FAILED: ${JSON.stringify(metrics)}`);

const profile = {
  schema: generated.schema,
  profileId: generated.profileId,
  vertexCount: generated.vertexCount,
  influenceLimit: generated.influenceLimit,
  bonePaletteOrder: generated.bonePaletteOrder,
  method: generated.method,
  diffusionIterations: generated.diffusionIterations,
  attributeLayout: { JOINTS_0:'uint16x4', WEIGHTS_0:'float32x4', JOINTS_1:'uint16x4', WEIGHTS_1:'float32x4', hybridBlend:'float32' },
  binaryPath: 'assets/human/natural-skinning-v1/skin-weights-v1.bin',
  binarySha256: sha256(binary),
  binaryBytes: binary.byteLength,
  metrics,
  criticalRegions: ['shoulder','axilla','elbow','wrist','hip','groin','knee','ankle','hand','fingers','foot','toes'],
  externalSkinWeightAssetRequests: 0,
  externalRigAssetRequests: 0,
  externalSkinnedMeshUsed: false,
  weightTransferUsed: false,
  passed,
};
const modeProfile = {
  schema: 'humanoid_rig/hrl_skinning_mode_profile@1.0',
  defaultMode: 'hybrid',
  modes: {
    lbs4: { influenceCount: 4, purpose: 'compatibility diagnostic' },
    lbs8: { influenceCount: 8, purpose: 'full project-authored linear blend reference' },
    dqs8: { influenceCount: 8, purpose: 'volume-preserving twist diagnostic' },
    hybrid: { influenceCount: 8, purpose: 'region-mask blend of LBS8 and DQS8', blendAttribute: 'hybridBlend' },
  },
  regionPolicy: { twistLimbs:'prefer-dqs', faceFingerTipsAndToes:'prefer-lbs', shoulderAxillaHipGroin:'adjustable-hybrid' },
  gpuPerFrameSkinning: true,
  cpuReferenceSkinningOnlyForQA: true,
  perFrameTopologyGeneration: false,
  perFrameWeightGeneration: false,
  canonicalPositionMutation: false,
};
const report = { schema:'humanoid_rig/task16b_weight_generation_audit@1.0', metrics, binarySha256:profile.binarySha256, binaryBytes:binary.byteLength, gatesPassed:passed, conclusion:passed?'PROJECT_AUTHORED_WEIGHT_FIELD_PASSED':'WEIGHT_FIELD_FAILED' };
await Promise.all([mkdir(naturalAssetDirectory,{recursive:true}),mkdir(qaDirectory,{recursive:true})]);
await Promise.all([
  writeFile(resolve(naturalAssetDirectory,'skin-weights-v1.bin'),binary),
  writeFile(resolve(naturalAssetDirectory,'SKIN_WEIGHT_PROFILE_V1.json'),json(profile),'utf8'),
  writeFile(resolve(naturalAssetDirectory,'SKINNING_MODE_PROFILE_V1.json'),json(modeProfile),'utf8'),
  writeFile(resolve(qaDirectory,'weight-generation-audit.json'),json(report),'utf8'),
]);
process.stdout.write(json(report));
