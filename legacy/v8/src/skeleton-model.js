import { cloneValue } from './skeleton-presets.js';

const EPSILON = 1e-9;

export function buildJointMap(definition) {
  return new Map(definition.joints.map((joint) => [joint.id, joint]));
}

/** Bind/rest world positions. localPosition is immutable while posing. */
export function computeWorldPositions(definition) {
  return computeRestWorldPositions(definition);
}

export function computeRestWorldPositions(definition) {
  const jointById = buildJointMap(definition);
  const result = new Map();
  const visiting = new Set();

  const resolve = (jointId) => {
    if (result.has(jointId)) {
      return result.get(jointId);
    }
    const joint = jointById.get(jointId);
    if (!joint) {
      throw new Error(`关节 ${jointId} 不存在。`);
    }
    if (visiting.has(jointId)) {
      throw new Error(`检测到骨骼层级循环：${jointId}`);
    }

    visiting.add(jointId);
    const local = arrayToVector(joint.localPosition);
    const world = joint.parentId
      ? addVectors(resolve(joint.parentId), local)
      : local;
    visiting.delete(jointId);
    result.set(jointId, world);
    return world;
  };

  for (const joint of definition.joints) {
    resolve(joint.id);
  }
  return result;
}

/** Current physics/pose positions. Falls back to the bind pose. */
export function computePoseWorldPositions(definition) {
  const rest = computeRestWorldPositions(definition);
  const result = new Map();
  for (const joint of definition.joints) {
    const fallback = rest.get(joint.id);
    const raw = joint.poseWorldPosition;
    const point = normalizeVector(raw, fallback);
    result.set(joint.id, point);
  }
  return result;
}

export function calculateBounds(definition, usePose = true) {
  const worldPositions = usePose
    ? computePoseWorldPositions(definition)
    : computeRestWorldPositions(definition);
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };

  for (const joint of definition.joints) {
    const point = worldPositions.get(joint.id);
    const radius = Math.max(0, Number(joint.jointRadius) || 0);
    min.x = Math.min(min.x, point.x - radius);
    min.y = Math.min(min.y, point.y - radius);
    min.z = Math.min(min.z, point.z - radius);
    max.x = Math.max(max.x, point.x + radius);
    max.y = Math.max(max.y, point.y + radius);
    max.z = Math.max(max.z, point.z + radius);
  }

  if (!Number.isFinite(min.x)) {
    return {
      min: { x: -0.5, y: 0, z: -0.5 },
      max: { x: 0.5, y: 1, z: 0.5 },
      center: { x: 0, y: 0.5, z: 0 },
      size: { x: 1, y: 1, z: 1 },
    };
  }

  return {
    min,
    max,
    center: {
      x: (min.x + max.x) / 2,
      y: (min.y + max.y) / 2,
      z: (min.z + max.z) / 2,
    },
    size: {
      x: Math.max(EPSILON, max.x - min.x),
      y: Math.max(EPSILON, max.y - min.y),
      z: Math.max(EPSILON, max.z - min.z),
    },
  };
}

export function calculateRigHeight(definition) {
  return heightFromMap(computeRestWorldPositions(definition));
}

export function calculatePoseHeight(definition) {
  return heightFromMap(computePoseWorldPositions(definition));
}

export function calculateHeight(definition) {
  return calculateRigHeight(definition);
}

export function getBoneLength(definition, jointId) {
  const joint = buildJointMap(definition).get(jointId);
  if (!joint?.parentId || joint.physicalBone === false) {
    return 0;
  }
  const local = arrayToVector(joint.localPosition);
  return Math.hypot(local.x, local.y, local.z);
}

export function getCurrentBoneLength(definition, jointId) {
  const joint = buildJointMap(definition).get(jointId);
  if (!joint?.parentId || joint.physicalBone === false) {
    return 0;
  }
  const pose = computePoseWorldPositions(definition);
  return vectorDistance(pose.get(joint.parentId), pose.get(jointId));
}

export function getMaxBoneLengthError(definition) {
  let maximum = 0;
  for (const joint of definition.joints) {
    if (!joint.parentId || joint.physicalBone === false) {
      continue;
    }
    maximum = Math.max(
      maximum,
      Math.abs(getCurrentBoneLength(definition, joint.id) - getBoneLength(definition, joint.id)),
    );
  }
  return maximum;
}

export function setJointPoseWorldPosition(definition, jointId, nextPosition) {
  const joint = findJoint(definition, jointId);
  const fallback = computePoseWorldPositions(definition).get(jointId);
  const point = normalizeVector(nextPosition, fallback);
  joint.poseWorldPosition = [point.x, point.y, point.z];
  touchPose(definition);
  return joint;
}

export function setPosePositions(definition, positions) {
  const map = positions instanceof Map ? positions : null;
  for (const joint of definition.joints) {
    const raw = map ? map.get(joint.id) : positions?.[joint.id];
    if (raw == null) {
      continue;
    }
    const current = normalizeVector(joint.poseWorldPosition, { x: 0, y: 0, z: 0 });
    const point = normalizeVector(raw, current);
    joint.poseWorldPosition = [point.x, point.y, point.z];
  }
  touchPose(definition);
}

export function resetPoseToBind(definition) {
  const rest = computeRestWorldPositions(definition);
  for (const joint of definition.joints) {
    const point = rest.get(joint.id);
    joint.poseWorldPosition = [point.x, point.y, point.z];
    joint.pinned = false;
  }
  definition.pose = definition.bindPose || 'BIND';
  touchPose(definition);
}

export function buildExportPayload(definition) {
  const restWorld = computeRestWorldPositions(definition);
  const poseWorld = computePoseWorldPositions(definition);
  const payload = cloneValue(definition);
  payload.schemaVersion = Number(definition.schemaVersion || 6);
  payload.dimensionsLocked = true;
  payload.updatedAt = new Date().toISOString();
  payload.joints = definition.joints.map((joint) => {
    const rest = restWorld.get(joint.id);
    const pose = poseWorld.get(joint.id);
    return {
      id: joint.id,
      label: joint.label,
      parentId: joint.parentId,
      side: joint.side,
      category: joint.category,
      localPosition: {
        x: roundNumber(joint.localPosition[0]),
        y: roundNumber(joint.localPosition[1]),
        z: roundNumber(joint.localPosition[2]),
      },
      bindWorldPosition: {
        x: roundNumber(rest.x),
        y: roundNumber(rest.y),
        z: roundNumber(rest.z),
      },
      poseWorldPosition: {
        x: roundNumber(pose.x),
        y: roundNumber(pose.y),
        z: roundNumber(pose.z),
      },
      boneLength: roundNumber(getBoneLength(definition, joint.id)),
      lengthLocked: Boolean(joint.parentId && joint.physicalBone !== false),
      physicalBone: joint.physicalBone !== false,
      visualBone: joint.visualBone !== false,
      visualJoint: joint.visualJoint !== false,
      isControl: Boolean(joint.isControl),
      followJointId: joint.followJointId ?? null,
      controlOffset: joint.controlOffset == null
        ? null
        : {
          x: roundNumber(joint.controlOffset[0]),
          y: roundNumber(joint.controlOffset[1]),
          z: roundNumber(joint.controlOffset[2]),
        },
      jointType: joint.jointType ?? 'free',
      limitLabel: joint.limitLabel ?? '自由关节',
      standard: joint.standard ? cloneValue(joint.standard) : null,
      pinned: Boolean(joint.pinned),
      jointRadius: roundNumber(joint.jointRadius),
      boneRadius: roundNumber(joint.boneRadius),
    };
  });
  return payload;
}

export function buildPosePayload(definition) {
  const pose = computePoseWorldPositions(definition);
  return {
    schemaVersion: 1,
    type: 'humanoid-pose',
    rigName: definition.name,
    pose: definition.pose,
    unit: 'meter',
    updatedAt: new Date().toISOString(),
    joints: definition.joints.map((joint) => {
      const point = pose.get(joint.id);
      return {
        id: joint.id,
        poseWorldPosition: {
          x: roundNumber(point.x),
          y: roundNumber(point.y),
          z: roundNumber(point.z),
        },
        pinned: Boolean(joint.pinned),
      };
    }),
  };
}

export function applyPosePayload(definition, input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.joints)) {
    throw new Error('姿势 JSON 中没有 joints 数组。');
  }
  const byId = buildJointMap(definition);
  let applied = 0;
  for (const item of input.joints) {
    const id = String(item?.id ?? '');
    const joint = byId.get(id);
    if (!joint) {
      continue;
    }
    const raw = item.poseWorldPosition ?? item.worldPosition;
    if (raw == null) {
      continue;
    }
    const current = normalizeVector(joint.poseWorldPosition, { x: 0, y: 0, z: 0 });
    const point = normalizeVector(raw, current);
    joint.poseWorldPosition = [point.x, point.y, point.z];
    if ('pinned' in item) {
      joint.pinned = Boolean(item.pinned);
    }
    applied += 1;
  }
  if (applied === 0) {
    throw new Error('姿势 JSON 没有匹配到当前骨架的关节。');
  }
  definition.pose = String(input.pose ?? 'CUSTOM').toUpperCase();
  touchPose(definition);
  return applied;
}

export function topologyKey(definition) {
  return definition.joints
    .map((joint) => `${joint.id}>${joint.parentId ?? ''}`)
    .join('|');
}

export function canonicalDefinition(definition) {
  const clone = cloneValue(definition);
  delete clone.updatedAt;
  return JSON.stringify(clone);
}

export function getJointDepths(definition) {
  const jointById = buildJointMap(definition);
  const cache = new Map();
  const resolve = (jointId) => {
    if (cache.has(jointId)) {
      return cache.get(jointId);
    }
    const joint = jointById.get(jointId);
    const depth = joint?.parentId ? resolve(joint.parentId) + 1 : 0;
    cache.set(jointId, depth);
    return depth;
  };
  for (const joint of definition.joints) {
    resolve(joint.id);
  }
  return cache;
}

export function vectorDistance(a, b) {
  if (!a || !b) {
    return 0;
  }
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function roundNumber(value, digits = 6) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  const factor = 10 ** digits;
  return Math.round((numeric + Number.EPSILON) * factor) / factor;
}

export function formatNumber(value, digits = 4) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '0';
  }
  return numeric.toFixed(digits).replace(/\.?0+$/, '');
}

export function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

export function normalizeVector(value, fallback = { x: 0, y: 0, z: 0 }) {
  if (Array.isArray(value)) {
    return {
      x: finiteOr(value[0], fallback.x),
      y: finiteOr(value[1], fallback.y),
      z: finiteOr(value[2], fallback.z),
    };
  }
  return {
    x: finiteOr(value?.x, fallback.x),
    y: finiteOr(value?.y, fallback.y),
    z: finiteOr(value?.z, fallback.z),
  };
}

export function markPoseModified(definition, poseName = 'CUSTOM') {
  definition.pose = poseName;
  touchPose(definition);
}

function heightFromMap(worldPositions) {
  const ys = [...worldPositions.values()].map((point) => point.y);
  if (!ys.length) {
    return 0;
  }
  return Math.max(...ys) - Math.min(...ys);
}

function findJoint(definition, jointId) {
  const joint = definition.joints.find((item) => item.id === jointId);
  if (!joint) {
    throw new Error(`关节 ${jointId} 不存在。`);
  }
  return joint;
}

function touchPose(definition) {
  definition.updatedAt = new Date().toISOString();
}

function arrayToVector(value) {
  return {
    x: Number(value?.[0]) || 0,
    y: Number(value?.[1]) || 0,
    z: Number(value?.[2]) || 0,
  };
}

function addVectors(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function finiteOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number(fallback) || 0;
}
