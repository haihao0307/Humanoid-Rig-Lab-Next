const POSE_SNAPSHOT_SCHEMA = 'humanoid_rig/pose_snapshot@1.0';
const LEGACY_PIN_ALIASES = Object.freeze({
  leftAnkle: 'leftFoot',
  rightAnkle: 'rightFoot',
});

export function canonicalPinId(value) {
  const id = String(value ?? '').trim();
  return LEGACY_PIN_ALIASES[id] ?? id;
}

export function normalizePinnedJointIds(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(canonicalPinId)
    .filter(Boolean))];
}

export function isCanonicalPoseSnapshot(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && value.type === 'PoseSnapshot'
    && value.schema === POSE_SNAPSHOT_SCHEMA,
  );
}

export function validatePoseSnapshot(value) {
  const errors = [];
  if (!isCanonicalPoseSnapshot(value)) {
    errors.push(`schema 必须为 ${POSE_SNAPSHOT_SCHEMA}，type 必须为 PoseSnapshot。`);
    return { valid: false, errors };
  }
  if (!String(value.compatibleRig ?? '').trim()) {
    errors.push('缺少 compatibleRig。');
  }
  validateVector(value.rootTranslation, 3, 'rootTranslation', errors);
  validateQuaternion(value.rootRotation, 'rootRotation', errors);
  if (!value.localRotations || typeof value.localRotations !== 'object' || Array.isArray(value.localRotations)) {
    errors.push('localRotations 必须是以稳定关节 ID 为键的对象。');
  } else {
    for (const [jointId, quaternion] of Object.entries(value.localRotations)) {
      if (!jointId) errors.push('localRotations 包含空关节 ID。');
      validateQuaternion(quaternion, `localRotations.${jointId}`, errors);
    }
  }
  if (containsBindData(value)) {
    errors.push('PoseSnapshot 中检测到绑定尺寸字段。');
  }
  return { valid: errors.length === 0, errors };
}

export function inspectPoseContract(state) {
  const pose = state?.character?.pose ?? {};
  const payload = pose.v8Payload;
  const secondarySnapshot = pose.poseSnapshot;
  const payloadValidation = validatePoseSnapshot(payload);
  const secondaryValidation = validatePoseSnapshot(secondarySnapshot);
  const hasLegacyPayload = payload?.type === 'humanoid-pose' && Array.isArray(payload.joints);
  const secondarySynchronized = secondaryValidation.valid
    && isSnapshotSynchronizedWithLegacy(secondarySnapshot, payload);
  const canonicalSnapshot = payloadValidation.valid
    ? payload
    : secondarySynchronized
      ? secondarySnapshot
      : null;
  const validation = canonicalSnapshot === payload ? payloadValidation : secondaryValidation;

  if (canonicalSnapshot) {
    const twistDetail = canonicalSnapshot.diagnostics?.twistDataAvailable === false
      ? '，轴向扭转使用零扭转重建，动画和 GLB 仍需关节轴适配'
      : '';
    return {
      status: 'canonical',
      statusLabel: hasLegacyPayload ? '局部四元数快照与三维桥接已连接' : '局部四元数快照已连接',
      detail: `${Object.keys(canonicalSnapshot.localRotations ?? {}).length} 个局部旋转，兼容 ${canonicalSnapshot.compatibleRig}${hasLegacyPayload ? '，当前视口通过同步世界坐标桥接显示' : ''}${twistDetail}`,
      validation,
      canonicalSnapshot,
      legacyWorldPose: hasLegacyPayload ? payload : null,
      bridgeMode: hasLegacyPayload ? 'canonical-plus-legacy-view-bridge' : 'canonical-direct',
      warningCodes: Array.isArray(canonicalSnapshot.diagnostics?.warningCodes)
        ? [...canonicalSnapshot.diagnostics.warningCodes]
        : [],
    };
  }
  if (hasLegacyPayload) {
    const staleDetail = secondaryValidation.valid && !secondarySynchronized
      ? '，同时检测到已经过期的局部四元数快照，已避免将其当作当前动作'
      : '';
    return {
      status: 'legacy-world-position',
      statusLabel: '三维世界坐标兼容模式',
      detail: `${payload.joints.length} 个世界坐标关节，主平台桥接仍需切换到局部四元数快照${staleDetail}`,
      validation: secondaryValidation.valid ? secondaryValidation : payloadValidation,
      canonicalSnapshot: null,
      legacyWorldPose: payload,
      bridgeMode: 'legacy-only',
    };
  }
  return {
    status: 'preview-only',
    statusLabel: '二维预览模式',
    detail: '尚未收到 V8.5 三维姿势数据',
    validation: secondaryValidation.valid ? secondaryValidation : payloadValidation,
    canonicalSnapshot: secondaryValidation.valid ? secondarySnapshot : null,
    legacyWorldPose: null,
    bridgeMode: 'preview-only',
  };
}

export function buildStandalonePoseExport(state, schemaVersion) {
  const contract = inspectPoseContract(state);
  const pose = state?.character?.pose ?? {};
  const physics = state?.character?.physics ?? {};
  const canonicalSnapshot = contract.canonicalSnapshot ? structuredClone(contract.canonicalSnapshot) : null;
  const legacyWorldPose = contract.legacyWorldPose ? structuredClone(contract.legacyWorldPose) : null;
  return {
    type: 'PoseModuleExport',
    schemaVersion,
    module: 'pose',
    compatibleRig: state?.activeVersions?.rig ?? null,
    poseVersion: state?.activeVersions?.pose ?? null,
    generatedAt: new Date().toISOString(),
    contract: {
      targetSchema: POSE_SNAPSHOT_SCHEMA,
      status: contract.status,
      statusLabel: contract.statusLabel,
      bridgeMode: contract.bridgeMode,
      canonicalReady: Boolean(canonicalSnapshot),
      legacyViewBridgeReady: Boolean(legacyWorldPose),
      validationErrors: contract.validation.errors,
      warningCodes: contract.warningCodes ?? [],
    },
    poseSnapshot: canonicalSnapshot,
    legacyWorldPose,
    imagePoseAssetId: pose.imagePoseAssetId ?? null,
    preview2D: {
      name: String(pose.name ?? 'Custom Pose'),
      joints: structuredClone(pose.joints ?? {}),
    },
    pinnedJointIds: normalizePinnedJointIds(pose.pinned),
    constraints: normalizePhysicsSettings(physics),
  };
}

export function buildPoseModuleData(state) {
  const pose = structuredClone(state.character.pose);
  pose.pinned = normalizePinnedJointIds(pose.pinned);
  return {
    pose,
    physics: normalizePhysicsSettings(state.character.physics),
    imagePose: structuredClone(state.modules?.pose?.imagePose ?? null),
    contract: inspectPoseContract(state),
  };
}

export function updateLegacyPin(payload, jointId, pinned) {
  if (payload?.type !== 'humanoid-pose' || !Array.isArray(payload.joints)) {
    return payload;
  }
  const canonicalId = canonicalPinId(jointId);
  const next = structuredClone(payload);
  let matched = false;
  for (const joint of next.joints) {
    if (canonicalPinId(joint.id) !== canonicalId) continue;
    joint.pinned = Boolean(pinned);
    matched = true;
  }
  if (matched) next.updatedAt = new Date().toISOString();
  return next;
}

export function updatePoseSnapshotPin(snapshot, jointId, pinned, legacyPayload = null) {
  if (!isCanonicalPoseSnapshot(snapshot)) return snapshot;
  const canonicalId = canonicalPinId(jointId);
  const next = structuredClone(snapshot);
  next.pinnedJoints = next.pinnedJoints && typeof next.pinnedJoints === 'object' && !Array.isArray(next.pinnedJoints)
    ? next.pinnedJoints
    : {};
  if (pinned) {
    const existing = next.pinnedJoints[canonicalId];
    const legacyJoint = legacyPayload?.type === 'humanoid-pose' && Array.isArray(legacyPayload.joints)
      ? legacyPayload.joints.find((joint) => canonicalPinId(joint.id) === canonicalId)
      : null;
    const world = normalizeWorldTarget(existing?.targetWorld)
      ?? normalizeWorldTarget(legacyJoint?.poseWorldPosition);
    if (world) {
      next.pinnedJoints[canonicalId] = {
        jointId: canonicalId,
        targetWorld: world,
        mode: 'world',
        weight: 1,
      };
    }
  } else {
    delete next.pinnedJoints[canonicalId];
  }
  const timestamp = legacyPayload?.updatedAt || new Date().toISOString();
  next.updatedAt = timestamp;
  if (legacyPayload?.type === 'humanoid-pose') next.sourceLegacyUpdatedAt = timestamp;
  return next;
}

function isSnapshotSynchronizedWithLegacy(snapshot, legacyPayload) {
  if (legacyPayload?.type !== 'humanoid-pose' || !Array.isArray(legacyPayload.joints)) return true;
  const snapshotStamp = String(snapshot?.sourceLegacyUpdatedAt ?? '');
  const legacyStamp = String(legacyPayload?.updatedAt ?? '');
  return Boolean(snapshotStamp && legacyStamp && snapshotStamp === legacyStamp);
}

function normalizeWorldTarget(value) {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => Number.isFinite(Number(item)))) {
    return value.map(Number);
  }
  if (value && typeof value === 'object' && [value.x, value.y, value.z].every((item) => Number.isFinite(Number(item)))) {
    return [Number(value.x), Number(value.y), Number(value.z)];
  }
  return null;
}

function normalizePhysicsSettings(value) {
  return {
    bodyCoupling: clampFinite(value?.bodyCoupling, 0, 1, 0.8),
    damping: clampFinite(value?.damping, 0, 1, 0.92),
    jointLimits: value?.jointLimits !== false,
    groundEnabled: value?.groundEnabled !== false,
  };
}

function validateVector(value, length, path, errors) {
  if (!Array.isArray(value) || value.length !== length || value.some((item) => !Number.isFinite(Number(item)))) {
    errors.push(`${path} 必须包含 ${length} 个有限数值。`);
  }
}

function validateQuaternion(value, path, errors) {
  validateVector(value, 4, path, errors);
  if (!Array.isArray(value) || value.length !== 4) return;
  const length = Math.hypot(...value.map(Number));
  if (!Number.isFinite(length) || Math.abs(length - 1) > 1e-5) {
    errors.push(`${path} 必须是归一化四元数。`);
  }
}

function containsBindData(value) {
  const forbidden = new Set(['boneLength', 'boneLengths', 'bindLocalPosition', 'bind_local_position', 'localPosition']);
  const visit = (item) => {
    if (!item || typeof item !== 'object') return false;
    if (Array.isArray(item)) return item.some(visit);
    for (const [key, child] of Object.entries(item)) {
      if (forbidden.has(key)) return true;
      if (visit(child)) return true;
    }
    return false;
  };
  return visit(value);
}

function clampFinite(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export { POSE_SNAPSHOT_SCHEMA };
