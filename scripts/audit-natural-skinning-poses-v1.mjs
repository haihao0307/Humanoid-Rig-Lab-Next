import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { countSelfIntersectionsV1 } from '../src/modules/human-core-v5/production-surface-v1/hrlsurface-self-intersection-v1.js';
import { HRLNaturalSkinningRuntimeV1 } from '../src/modules/human-core-v5/natural-skinning-v1/skinning-runtime-v1.js';
import { createNaturalSkinningPoseFixturesV1, createSweepPoseV1, PROGRESSIVE_SWEEPS_V1 } from '../src/modules/human-core-v5/natural-skinning-v1/pose-fixtures-v1.js';
import { auditRestIdentityV1, auditSkinnedPoseV1, buildRegionVertexSetsV1 } from '../src/modules/human-core-v5/natural-skinning-v1/skinning-qa-v1.js';
import { loadGeneratedV1, qaDirectory, sha256, json } from './natural-skinning-v1-io.mjs';

const { surface, rigCore, performanceRig, weights } = await loadGeneratedV1();
const runtime = new HRLNaturalSkinningRuntimeV1({ performanceRig, weights });
const fixtures = createNaturalSkinningPoseFixturesV1(rigCore);
const regionVertexSets = buildRegionVertexSetsV1(surface);
const indices = surface.chunks.indices;
const indexBytes = Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength);
const indexHash = sha256(indexBytes);
const topologyFingerprint = surface.header.topology.topologyFingerprint;
const canonicalPositions = surface.chunks.basePositions;
const canonicalNormals = surface.chunks.baseNormals;

const measure = (pose) => {
  const frame = runtime.createFrame({ localRotations:pose.localRotations, rootTranslation:pose.rootTranslation });
  const output = runtime.skin({ positions:canonicalPositions, normals:canonicalNormals, frame, mode:'hybrid' });
  const intersections = countSelfIntersectionsV1(output.positions, indices, { cellSize:0.025, evidenceLimit:16 });
  const restFrame = runtime.createFrame({ localRotations:{}, rootTranslation:[0,0,0] });
  const restored = runtime.skin({ positions:canonicalPositions, normals:canonicalNormals, frame:restFrame, mode:'hybrid' });
  const restMetrics = auditRestIdentityV1({ canonicalPositions, canonicalNormals, posedPositions:restored.positions, posedNormals:restored.normals, indices, centerVertexIndices:surface.chunks.centerVertexIndices });
  return auditSkinnedPoseV1({
    poseId:pose.poseId, canonicalPositions, canonicalNormals, posedPositions:output.positions, posedNormals:output.normals, indices,
    topologyFingerprint, expectedTopologyFingerprint:topologyFingerprint, indexHash, expectedIndexHash:indexHash, connectedComponentCount:1,
    maximumBoneLengthError:frame.maximumBoneLengthError, returnToRestError:restMetrics.maximumRestPositionError,
    intentionalContact:pose.intentionalContact, regionVertexSets,
    criticalSelfIntersectionCount:intersections.selfIntersectionCount, criticalSelfIntersectionEvidence:intersections.evidence,
    boneSurfaceClearance:measureBoneSurfaceClearance(output.positions,frame,performanceRig),
  });
};

const standardPoseResults=[];
for(const fixture of fixtures.fixtures){const metrics=measure(fixture);standardPoseResults.push({fixtureId:fixture.fixtureId,poseId:fixture.poseId,authoredChannels:fixture.authoredChannels,intentionalContact:fixture.intentionalContact,metrics});process.stdout.write(`pose ${fixture.fixtureId}/33 ${fixture.poseId} ${metrics.passed?'PASS':'FAIL'}\n`);}
const sweepResults=[];
for(const sweep of PROGRESSIVE_SWEEPS_V1){const samples=[];for(const degrees of sweep.degrees){const pose=createSweepPoseV1(rigCore,sweep,degrees);const metrics=measure(pose);samples.push({degrees,metrics});process.stdout.write(`sweep ${sweep.sweepId} ${degrees} ${metrics.passed?'PASS':'FAIL'}\n`);}sweepResults.push({sweepId:sweep.sweepId,jointIds:sweep.jointIds,channel:sweep.channel,samples,passed:samples.every((sample)=>sample.metrics.passed)});}
const catastrophicFailureCount=standardPoseResults.filter((entry)=>entry.metrics.catastrophicFailure).length;
const volumeFailureCount=standardPoseResults.filter((entry)=>!entry.metrics.volumePass).length;
const maximumReturnToRestError=Math.max(0,...standardPoseResults.map((entry)=>entry.metrics.maximumReturnToRestError),...sweepResults.flatMap((sweep)=>sweep.samples.map((sample)=>sample.metrics.maximumReturnToRestError)));
const criticalSelfIntersectionCount=standardPoseResults.filter((entry)=>!entry.intentionalContact).reduce((sum,entry)=>sum+entry.metrics.criticalSelfIntersectionCount,0);
const report={
  schema:'humanoid_rig/task16b_pose_audit@1.0', mode:'hybrid', poseFixtureCount:fixtures.fixtureCount, standardPoseResults,
  progressiveSweepCount:sweepResults.length, sweepResults, catastrophicFailureCount, volumeFailureCount, maximumReturnToRestError,
  criticalSelfIntersectionCount, intentionalContactPoseIds:standardPoseResults.filter((entry)=>entry.intentionalContact).map((entry)=>entry.poseId),
  standardPosesPassed:standardPoseResults.every((entry)=>entry.metrics.passed), sweepsPassed:sweepResults.every((entry)=>entry.passed),
};
report.passed=report.standardPosesPassed&&report.sweepsPassed&&catastrophicFailureCount===0&&maximumReturnToRestError<=1e-6;
report.conclusion=report.passed?'NATURAL_SKINNING_NUMERIC_POSE_GATES_PASSED':'SKINNING_CATASTROPHIC_STABILITY_FAILED';
await mkdir(qaDirectory,{recursive:true});
await writeFile(resolve(qaDirectory,'standard-pose-and-sweep-audit.json'),json(report),'utf8');
process.stdout.write(`${JSON.stringify({poseFixtureCount:report.poseFixtureCount,progressiveSweepCount:report.progressiveSweepCount,catastrophicFailureCount,volumeFailureCount,maximumReturnToRestError,criticalSelfIntersectionCount,standardPosesPassed:report.standardPosesPassed,sweepsPassed:report.sweepsPassed,passed:report.passed,conclusion:report.conclusion},null,2)}\n`);
if(!report.passed)process.exitCode=1;

function measureBoneSurfaceClearance(positions,frame,rig){let minimum=Infinity;const ids=['pelvis','leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg','leftFoot','rightFoot'];for(const id of ids){const center=frame.frames.get(id)?.worldPosition;if(!center)continue;for(let offset=0;offset<positions.length;offset+=3){minimum=Math.min(minimum,Math.hypot(positions[offset]-center[0],positions[offset+1]-center[1],positions[offset+2]-center[2]));}}return Number.isFinite(minimum)?minimum:null;}
