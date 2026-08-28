import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { HRLNaturalSkinningRuntimeV1, SKINNING_MODES_V1 } from '../src/modules/human-core-v5/natural-skinning-v1/skinning-runtime-v1.js';
import { auditRestIdentityV1 } from '../src/modules/human-core-v5/natural-skinning-v1/skinning-qa-v1.js';
import { createNaturalSkinningPoseFixturesV1, PROGRESSIVE_SWEEPS_V1 } from '../src/modules/human-core-v5/natural-skinning-v1/pose-fixtures-v1.js';
import { loadGeneratedV1, naturalAssetDirectory, qaDirectory, json } from './natural-skinning-v1-io.mjs';

const { surface, rigCore, performanceRig, weights } = await loadGeneratedV1();
const runtime = new HRLNaturalSkinningRuntimeV1({ performanceRig, weights });
const frame = runtime.createFrame({ localRotations:{}, rootTranslation:[0,0,0] });
const modeResults = {};
for (const mode of SKINNING_MODES_V1) {
  const skinned = runtime.skin({ positions:surface.chunks.basePositions, normals:surface.chunks.baseNormals, frame, mode });
  modeResults[mode] = auditRestIdentityV1({ canonicalPositions:surface.chunks.basePositions, canonicalNormals:surface.chunks.baseNormals, posedPositions:skinned.positions, posedNormals:skinned.normals, indices:surface.chunks.indices, centerVertexIndices:surface.chunks.centerVertexIndices });
}
const passed = Object.values(modeResults).every((metrics)=>metrics.passed) && frame.maximumBoneLengthError <= 1e-8;
const report = {
  schema:'humanoid_rig/task16b_rest_identity_audit@1.0',
  bindPose:'natural-a-pose',
  defaultMode:'hybrid',
  modes:modeResults,
  restIdentityMetrics:modeResults.hybrid,
  maximumBoneLengthError:frame.maximumBoneLengthError,
  sourceVertexCount:surface.header.topology.vertexCount,
  sourceTriangleCount:surface.header.topology.triangleCount,
  centerlineVertexCount:surface.chunks.centerVertexIndices.length,
  canonicalPositionMutation:false,
  topologyMutation:false,
  passed,
  conclusion:passed?'REST_IDENTITY_PASSED':'BIND_CALIBRATION_FAILED',
};
await Promise.all([mkdir(naturalAssetDirectory,{recursive:true}),mkdir(qaDirectory,{recursive:true})]);
const fixtures=createNaturalSkinningPoseFixturesV1(rigCore);
await Promise.all([
  writeFile(resolve(qaDirectory,'rest-identity-audit.json'),json(report),'utf8'),
  writeFile(resolve(naturalAssetDirectory,'POSE_FIXTURES_V1.json'),json({ ...fixtures, progressiveSweeps:PROGRESSIVE_SWEEPS_V1 }),'utf8'),
]);
process.stdout.write(json(report));
if(!passed)process.exitCode=1;
