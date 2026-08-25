export const PROCEDURAL_DEFORM_POLICY_V5 = Object.freeze({
  schema: 'humanoid_rig/procedural_deform_policy@5.0',
  policyId: 'region-hybrid-dqs-implicit@5.0',
  poseAuthority: 'finalPose.localRotations',
  limbBase: 'dual-quaternion-skinning',
  torsoBase: 'stable-region-transform-blend',
  localCorrectives: ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'],
  topologyPolicy: 'canonical-once-per-cache-key',
  accumulatedVertexOffsets: false,
  writesBodyDNA: false,
  writesRig: false,
  writesPose: false,
  writesSkinWeights: false,
});
