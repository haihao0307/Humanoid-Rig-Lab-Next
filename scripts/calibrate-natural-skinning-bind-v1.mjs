import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { HRLReferencePoseCalibrationV1 } from '../src/modules/human-core-v5/natural-skinning-v1/reference-pose-calibration-v1.js';
import { HRLPerformanceDeformRigV1, createHRLSkinBindProfileV1 } from '../src/modules/human-core-v5/natural-skinning-v1/performance-deform-rig-v1.js';
import { loadAuthorityV1, naturalAssetDirectory, qaDirectory, shaJson, json, surfaceRelativePath } from './natural-skinning-v1-io.mjs';

const { surface, rigCore, adapted } = await loadAuthorityV1();
const calibration = new HRLReferencePoseCalibrationV1({
  positions: surface.chunks.basePositions,
  definition: adapted.definition,
  surfaceTopologyFingerprint: surface.header.topology.topologyFingerprint,
}).calibrate();
if (!calibration.passed) throw new Error('BIND_CALIBRATION_FAILED: landmark calibration thresholds did not pass.');

const performanceRig = new HRLPerformanceDeformRigV1({ calibration, rigCore }).build();
const bindPoseHash = shaJson({ referencePose: 'natural-a-pose', bonePaletteOrder: performanceRig.bonePaletteOrder, bindLocalMatrices: performanceRig.bindLocalMatrices, bindWorldMatrices: performanceRig.bindWorldMatrices });
const inverseBindMatrixHash = shaJson(performanceRig.inverseBindMatrices);
const bindProfile = createHRLSkinBindProfileV1(performanceRig, { bindPoseHash, inverseBindMatrixHash });
const finiteInverseBindMatrices = performanceRig.inverseBindMatrices.flat().every(Number.isFinite);
if (!finiteInverseBindMatrices) throw new Error('BIND_CALIBRATION_FAILED: inverse bind matrices contain non-finite values.');

const report = {
  schema: 'humanoid_rig/task16b_bind_calibration_audit@1.0',
  authority: { surface: 'HRLFullBilateralSurfaceV1', humanRigCore: rigCore.rigId, pose: 'natural-a-pose', surfacePath: surfaceRelativePath },
  calibrationMetrics: {
    maximumJointSurfaceAlignmentError: calibration.maximumJointSurfaceAlignmentError,
    meanJointSurfaceAlignmentError: calibration.meanJointSurfaceAlignmentError,
    shoulderAlignmentError: calibration.shoulderAlignmentError,
    elbowAlignmentError: calibration.elbowAlignmentError,
    wristAlignmentError: calibration.wristAlignmentError,
    hipAlignmentError: calibration.hipAlignmentError,
    kneeAlignmentError: calibration.kneeAlignmentError,
    ankleAlignmentError: calibration.ankleAlignmentError,
    maximumBoneLengthError: calibration.maximumBoneLengthError,
  },
  bindPoseHash,
  inverseBindMatrixHash,
  paletteBoneCount: performanceRig.bonePaletteOrder.length,
  twistBoneIds: performanceRig.twistBoneIds,
  finiteInverseBindMatrices,
  externalInverseBindMatricesUsed: false,
  sourceSurfacePositionsModified: false,
  boneScaleApplied: false,
  passed: calibration.passed && finiteInverseBindMatrices,
  conclusion: calibration.passed && finiteInverseBindMatrices ? 'BIND_CALIBRATION_PREREQUISITES_PASSED' : 'BIND_CALIBRATION_FAILED',
};

await Promise.all([mkdir(naturalAssetDirectory,{recursive:true}),mkdir(qaDirectory,{recursive:true})]);
await Promise.all([
  writeFile(resolve(naturalAssetDirectory,'REFERENCE_POSE_CALIBRATION_V1.json'),json(calibration),'utf8'),
  writeFile(resolve(naturalAssetDirectory,'PERFORMANCE_DEFORM_RIG_V1.json'),json({ ...performanceRig, bindPoseHash, inverseBindMatrixHash }),'utf8'),
  writeFile(resolve(naturalAssetDirectory,'SKIN_BIND_PROFILE_V1.json'),json(bindProfile),'utf8'),
  writeFile(resolve(qaDirectory,'bind-calibration-audit.json'),json(report),'utf8'),
]);
process.stdout.write(json(report));
