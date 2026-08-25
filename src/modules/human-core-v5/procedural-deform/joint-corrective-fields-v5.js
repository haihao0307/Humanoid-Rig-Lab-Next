const EPSILON = 1e-9;

export const JOINT_CORRECTIVE_FIELD_IDS_V5 = Object.freeze({
  elbow: 'ElbowBendCorrectiveFieldV5',
  hip: 'HipFlexCorrectiveFieldV5',
  knee: 'KneeBendCorrectiveFieldV5',
});

/**
 * Builds deform-only corrective state from the existing joint drivers. These
 * fields never create joints and never write PoseFrame data. Elbow and knee
 * continue to use the region-local compression/volume correction in the main
 * runtime; this frame adds the missing proximal-thigh extension correction.
 */
export function createJointCorrectiveFieldFrameV5({
  surface,
  fieldDefinition,
  driverFrame,
  pelvisRotation = [0, 0, 0, 1],
} = {}) {
  const layout = fieldDefinition?.canonicalLayout;
  if (!surface || !layout || !driverFrame?.regions) return emptyFrame();
  const hipFields = ['left', 'right'].map((side) => {
    const driver = driverFrame.regions[`${side}Hip`] ?? {};
    const extensionRadians = Math.max(0, Number(driver.bend) || 0);
    return {
      fieldId: JOINT_CORRECTIVE_FIELD_IDS_V5.hip,
      side,
      regionIndex: surface.regionNames.indexOf(`${side}Thigh`),
      extensionRadians,
      displacementMeters: Math.min(0.075, extensionRadians * 0.15),
    };
  }).filter((field) => field.regionIndex >= 0 && field.displacementMeters > EPSILON);
  return {
    schema: 'humanoid_rig/joint_corrective_field_frame@5.0',
    deformOnly: true,
    createsJoints: false,
    writesPoseFrame: false,
    fieldIds: Object.values(JOINT_CORRECTIVE_FIELD_IDS_V5),
    layout,
    pelvisRotation: normalizeQuaternion(pelvisRotation),
    hipFields,
  };
}

export function applyJointCorrectiveFieldsV5({
  deformedPosition,
  canonicalPositions,
  surface,
  vertex,
  correctiveFrame,
} = {}) {
  if (!correctiveFrame?.hipFields?.length) return deformedPosition;
  const offset = vertex * 3;
  const bind = [
    canonicalPositions[offset],
    canonicalPositions[offset + 1],
    canonicalPositions[offset + 2],
  ];
  let result = [...deformedPosition];
  for (const field of correctiveFrame.hipFields) {
    if ((field.side === 'left' && bind[0] >= 0) || (field.side === 'right' && bind[0] <= 0)) continue;
    const regionWeight = influenceWeight(surface, vertex, field.regionIndex);
    if (regionWeight <= EPSILON) continue;
    const medial = 1 - smoothstep(0.035, 0.12, Math.abs(bind[0]));
    const proximal = smoothstep(0.64, 0.76, bind[1]) * (1 - smoothstep(0.84, 0.93, bind[1]));
    const posterior = 1 - smoothstep(-0.13, 0.03, bind[2]);
    const displacement = field.displacementMeters
      * regionWeight * regionWeight
      * medial * proximal * posterior;
    if (displacement <= EPSILON) continue;
    const correction = rotateVector(correctiveFrame.pelvisRotation, [0, 0, displacement]);
    result = result.map((value, axis) => value + correction[axis]);
  }
  return result;
}

function influenceWeight(surface, vertex, regionIndex) {
  let weight = 0;
  for (let influence = 0; influence < 4; influence += 1) {
    const offset = vertex * 4 + influence;
    if (surface.regionIds[offset] === regionIndex) weight += surface.regionBlendWeights[offset];
  }
  return weight;
}

function emptyFrame() {
  return {
    schema: 'humanoid_rig/joint_corrective_field_frame@5.0',
    deformOnly: true,
    createsJoints: false,
    writesPoseFrame: false,
    fieldIds: Object.values(JOINT_CORRECTIVE_FIELD_IDS_V5),
    layout: null,
    pelvisRotation: [0, 0, 0, 1],
    hipFields: [],
  };
}

function smoothstep(edge0, edge1, value) {
  if (!(edge1 > edge0)) return value >= edge1 ? 1 : 0;
  const unit = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return unit * unit * (3 - 2 * unit);
}

function normalizeQuaternion(value) {
  const q = Array.from(value ?? [0, 0, 0, 1], Number);
  const length = Math.hypot(...q) || 1;
  return q.map((entry) => entry / length);
}

function rotateVector(q, value) {
  const [qx, qy, qz, qw] = q;
  const [vx, vy, vz] = value;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + qy * tz - qz * ty,
    vy + qw * ty + qz * tx - qx * tz,
    vz + qw * tz + qx * ty - qy * tx,
  ];
}
