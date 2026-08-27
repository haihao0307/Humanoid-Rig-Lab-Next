export const SURFACE_CARRIER_V2_SCHEMA = 'humanoid_rig/surface_carrier@2.0';
export const PERFORMANCE_DEFORM_RIG_V2_SCHEMA = 'humanoid_rig/performance_deform_rig@2.0';

export const SURFACE_CARRIER_V2_METHODS = Object.freeze([
  'load',
  'getAssetReceipt',
  'getMesh',
  'getSkeleton',
  'getJointMap',
  'getRestGeometry',
  'getDeformedGeometry',
  'applyFinalPose',
  'sampleDeformedPositions',
  'restoreAssetBind',
  'restoreReferencePose',
  'getGeometryMetrics',
  'getRuntimeMetrics',
  'dispose',
]);

export function assertFinalPoseReadOnly(finalPose) {
  if (!finalPose || typeof finalPose !== 'object') throw new TypeError('SurfaceCarrierV2 requires a finalPose object.');
  if (!finalPose.localRotations || !Array.isArray(finalPose.rootPosition)) {
    throw new TypeError('SurfaceCarrierV2 requires PoseFrame localRotations and rootPosition.');
  }
  return finalPose;
}

export function assertSurfaceAssetDescriptor(descriptor) {
  if ((!descriptor?.url && !descriptor?.arrayBuffer) || (!descriptor?.receiptUrl && !descriptor?.receipt)) {
    throw new TypeError('Surface asset descriptor requires url/arrayBuffer and receiptUrl/receipt.');
  }
  return descriptor;
}

export function assertSurfaceCarrierV2(value) {
  for (const method of SURFACE_CARRIER_V2_METHODS) {
    if (typeof value?.[method] !== 'function') throw new TypeError(`SurfaceCarrierV2 is missing ${method}().`);
  }
  return value;
}
