import assert from 'node:assert/strict';
import {
  HumanCoreRuntime,
  ProceduralDeformRuntimeV5,
  createBodyDNA,
  createProceduralDeformValidationPoseV5,
  createProceduralSimulationRigFrameV5,
  resolveProceduralSimulationRigJointV5,
} from '../../src/modules/human-core-v5/index.js';
import {
  PROCEDURAL_CAMERA_DIRECTIONS_V5,
  frameDeformedBoundsV5,
  selectJointLocalDeformedPositionsV5,
} from '../../apps/human-core-v5-procedural-deform/procedural-camera-fit-v5.js';

const bodyDNA = createBodyDNA({
  bodyDNAId: 'procedural-camera-fit-integration',
  identity: { humanId: 'procedural-camera-fit-integration' },
  proportionRevision: 14,
});
const human = new HumanCoreRuntime();
human.createHuman(bodyDNA);
const rigCore = human.getRigCore();
const runtime = new ProceduralDeformRuntimeV5();
runtime.compileHuman({ bodyDNA, rigCore });
await runtime.generateCanonicalSurface({ resolution: 28, worker: false });

const fixtures = Object.freeze([
  ['arm-raise-150-left', 'leftShoulder'],
  ['forearm-twist-180-left', 'leftLowerArm'],
  ['elbow-bend-140-left', 'leftLowerArm'],
  ['hip-flex-left', 'leftHip'],
  ['knee-bend-left', 'leftKnee'],
]);
const results = {};
for (const [poseId, focusJointId] of fixtures) {
  const pose = createProceduralDeformValidationPoseV5({ poseId, rigCore, bodyDNA, timestamp: 1 });
  human.updatePose(pose);
  const frame = runtime.update({ finalPose: pose, anatomyState: human.getAnatomyState(), timestamp: 1 });
  const simulationRig = createProceduralSimulationRigFrameV5({ finalPose: pose, rigCore, bodyDNA });
  const full = frameDeformedBoundsV5({
    positions: frame.deformedPositions,
    direction: PROCEDURAL_CAMERA_DIRECTIONS_V5.Perspective,
    fovDegrees: 38,
    aspect: 1600 / 1200,
    margin: 0.10,
  });
  const fullAudit = auditClipSpace(frame.deformedPositions, full, 38, 1600 / 1200);
  assert.equal(fullAudit.unsafeVertexCount, 0, `${poseId} left ${fullAudit.unsafeVertexCount} deformed vertices outside the 10% safe frame.`);
  assert.equal(fullAudit.nearFarClippedCount, 0, `${poseId} clipped ${fullAudit.nearFarClippedCount} deformed vertices at near/far planes.`);

  const resolved = resolveProceduralSimulationRigJointV5(simulationRig, focusJointId);
  assert.ok(resolved, `${poseId} could not resolve ${focusJointId} from independent SimulationRig FK.`);
  const localPositions = selectJointLocalDeformedPositionsV5({
    positions: frame.deformedPositions,
    regionIds: frame.regionIds,
    regionNames: runtime.surface.regionNames,
    jointId: focusJointId,
    jointPosition: resolved.joint.worldPosition,
    radius: Math.max(0.16, bodyDNA.proportion.height * 0.16),
  });
  const closeup = frameDeformedBoundsV5({
    positions: localPositions,
    direction: PROCEDURAL_CAMERA_DIRECTIONS_V5.Perspective,
    fovDegrees: 38,
    aspect: 1600 / 1200,
    margin: 0.10,
    target: resolved.joint.worldPosition,
  });
  const targetNDC = projectPoint(resolved.joint.worldPosition, closeup, 38, 1600 / 1200);
  assert.ok(Math.abs(targetNDC[0]) <= 0.6 && Math.abs(targetNDC[1]) <= 0.6, `${poseId}/${focusJointId} closeup target left the central 60%.`);
  results[poseId] = {
    fullBody: fullAudit,
    closeup: { focusJointId, selectedVertexCount: localPositions.length / 3, targetNDC },
  };
}

console.log(JSON.stringify(results));
console.log('Human Core V5 procedural camera fit: posed full-body safe framing and joint-local closeup centering passed.');

function auditClipSpace(positions, cameraFrame, fovDegrees, aspect) {
  let unsafeVertexCount = 0;
  let nearFarClippedCount = 0;
  let maximumAbsoluteX = 0;
  let maximumAbsoluteY = 0;
  for (let offset = 0; offset < positions.length; offset += 3) {
    const projected = projectPoint([positions[offset], positions[offset + 1], positions[offset + 2]], cameraFrame, fovDegrees, aspect);
    maximumAbsoluteX = Math.max(maximumAbsoluteX, Math.abs(projected[0]));
    maximumAbsoluteY = Math.max(maximumAbsoluteY, Math.abs(projected[1]));
    if (Math.abs(projected[0]) > 0.900001 || Math.abs(projected[1]) > 0.900001) unsafeVertexCount += 1;
    if (projected[2] < cameraFrame.near || projected[2] > cameraFrame.far) nearFarClippedCount += 1;
  }
  return { unsafeVertexCount, nearFarClippedCount, maximumAbsoluteX, maximumAbsoluteY, near: cameraFrame.near, far: cameraFrame.far };
}
function projectPoint(point, frame, fovDegrees, aspect) {
  const relative = point.map((value, axis) => value - frame.target[axis]);
  const depth = frame.distance - dot(relative, frame.direction);
  const tangentVertical = Math.tan(fovDegrees * Math.PI / 360);
  return [dot(relative, frame.right) / (depth * tangentVertical * aspect), dot(relative, frame.up) / (depth * tangentVertical), depth];
}
function dot(a, b) { return a.reduce((sum, value, axis) => sum + value * b[axis], 0); }
