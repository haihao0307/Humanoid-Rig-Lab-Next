import * as THREE from 'three';

export const JOINT_LIMIT_VISUALIZATION_V1_SCHEMA = 'humanoid_rig/joint_limit_visualization@1.0';

const LIMIT_COLORS = Object.freeze({
  normal: 0x55dfa2,
  approaching: 0xffc857,
  clamped: 0xff7d52,
  illegal: 0xff3f72,
  undefined: 0x74869a,
});

export function createJointLimitVisualizationV1({ coreLayer, visible = false } = {}) {
  if (coreLayer?.type !== 'CoreRigLayerV1') throw new Error('Joint limit visualization requires CoreRigLayerV1.');
  const group = new THREE.Group();
  group.name = 'joint-limit-visualization-v1';
  group.visible = visible;
  const records = [];
  const missingJointLimitIds = [];
  for (const [jointId, transform] of Object.entries(coreLayer.jointTransforms)) {
    const semantic = coreLayer.rigCore.joints.find((joint) => joint.jointId === jointId);
    if (!semantic || !isFormalAngularLimit(semantic)) {
      missingJointLimitIds.push(jointId);
      const undefinedMarker = createUndefinedLimitMarker(transform, jointId);
      undefinedMarker.userData.rigElement = {
        id: `${jointId}:limit-undefined`,
        layer: 'Limit Geometry',
        source: semantic?.source?.limitLabel || 'no-formal-limit-source',
        parent: jointId,
        worldPosition: [...transform.worldPosition],
        worldQuaternion: [...transform.worldQuaternion],
        boneLength: coreLayer.contract.boneLengths[jointId],
        axes: semantic?.axisReference ?? null,
        limits: null,
        capabilities: ['diagnostic', 'LIMIT UNDEFINED'],
        status: 'LIMIT UNDEFINED',
      };
      group.add(undefinedMarker);
      records.push({ jointId, status: 'undefined', label: 'LIMIT UNDEFINED', limitSource: semantic?.source?.limitLabel || null });
      continue;
    }
    const state = classifyLimitState(transform.worldQuaternion, semantic.limitProfile);
    const visual = semantic.motionRole.includes('hinge')
      ? createHingeArc(transform, semantic, state)
      : createSwingCone(transform, semantic, state);
    const rigElement = {
      id: `${jointId}:limit`,
      layer: 'Limit Geometry',
      source: semantic.source.limitLabel || 'JointSemanticProfileV5',
      parent: jointId,
      worldPosition: [...transform.worldPosition],
      worldQuaternion: [...transform.worldQuaternion],
      boneLength: coreLayer.contract.boneLengths[jointId],
      axes: semantic.axisReference,
      limits: semantic.limitProfile,
      capabilities: ['diagnostic', semantic.motionRole.includes('hinge') ? 'hinge-arc' : 'swing-cone', 'twist-range'],
      status: state.status,
    };
    visual.traverse((child) => { if (child.isMesh || child.isLine) child.userData.rigElement = rigElement; });
    group.add(visual);
    records.push({
      jointId,
      status: state.status,
      currentRotationDegrees: state.currentRotationDegrees,
      softLimitDegrees: state.softLimitDegrees,
      hardLimitDegrees: state.hardLimitDegrees,
      limitSource: semantic.source.limitLabel || 'JointSemanticProfileV5',
      visualization: semantic.motionRole.includes('hinge') ? 'hinge-arc+twist-range' : 'swing-cone+twist-range',
    });
  }
  return {
    schema: JOINT_LIMIT_VISUALIZATION_V1_SCHEMA,
    group,
    records,
    missingJointLimitIds,
    metrics: {
      definedJointLimitCount: records.length - missingJointLimitIds.length,
      missingJointLimitCount: missingJointLimitIds.length,
      missingJointLimitIds,
      approachingLimitCount: records.filter((record) => record.status === 'approaching').length,
      clampedLimitCount: records.filter((record) => record.status === 'clamped').length,
      illegalLimitCount: records.filter((record) => record.status === 'illegal').length,
    },
  };
}

function isFormalAngularLimit(semantic) {
  return semantic.limitProfile?.unit === 'degrees'
    && !['optional-deform', 'control', 'structural'].includes(semantic.motionRole)
    && Object.values(semantic.limitProfile.ranges ?? {}).some((range) => Array.isArray(range) && range.length === 2);
}

function classifyLimitState(quaternion, limitProfile) {
  const angle = 2 * Math.acos(Math.min(1, Math.abs(Number(quaternion?.[3] ?? 1)))) * 180 / Math.PI;
  const values = Object.values(limitProfile.ranges ?? {}).flatMap((range) => Array.isArray(range) ? range.map(Number) : []);
  const hardLimitDegrees = Math.max(1, ...values.filter(Number.isFinite).map(Math.abs));
  const softLimitDegrees = hardLimitDegrees * 0.85;
  const status = !Number.isFinite(angle) ? 'illegal'
    : angle > hardLimitDegrees + 1e-6 ? 'illegal'
      : angle >= hardLimitDegrees - 1e-6 ? 'clamped'
        : angle >= softLimitDegrees ? 'approaching' : 'normal';
  return { status, currentRotationDegrees: angle, softLimitDegrees, hardLimitDegrees };
}

function createHingeArc(transform, semantic, state) {
  const radius = 0.11;
  const start = -state.hardLimitDegrees * Math.PI / 180;
  const end = state.hardLimitDegrees * Math.PI / 180;
  const object = new THREE.Group();
  object.add(createArc(radius, start, end, new THREE.LineBasicMaterial({ color: LIMIT_COLORS[state.status] })));
  const soft = createArc(radius * 0.82, start * 0.85, end * 0.85, new THREE.LineDashedMaterial({ color: 0xffd978, dashSize: 0.012, gapSize: 0.008 }));
  soft.computeLineDistances();
  object.add(soft, createTwistRing(0.052));
  object.position.fromArray(transform.worldPosition);
  object.quaternion.fromArray(transform.worldQuaternion);
  object.name = `${semantic.jointId}:hinge-soft-hard-twist-limit`;
  return object;
}

function createSwingCone(transform, semantic, state) {
  const radius = 0.075;
  const height = 0.16;
  const object = new THREE.Group();
  const hard = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: LIMIT_COLORS[state.status], transparent: true, opacity: 0.18, wireframe: true, depthWrite: false }),
  );
  const soft = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.85, height * 0.85, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd978, transparent: true, opacity: 0.12, wireframe: true, depthWrite: false }),
  );
  soft.position.y = height * 0.075;
  object.add(hard, soft, createTwistRing(0.052));
  object.position.fromArray(transform.worldPosition);
  object.quaternion.fromArray(transform.worldQuaternion);
  object.name = `${semantic.jointId}:swing-soft-hard-twist-limit`;
  return object;
}

function createArc(radius, start, end, material) {
  const points = Array.from({ length: 33 }, (_, index) => {
    const angle = start + (end - start) * index / 32;
    return new THREE.Vector3(0, Math.cos(angle) * radius, Math.sin(angle) * radius);
  });
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
}

function createTwistRing(radius) {
  const points = Array.from({ length: 49 }, (_, index) => {
    const angle = Math.PI * 2 * index / 48;
    return new THREE.Vector3(0, Math.cos(angle) * radius, Math.sin(angle) * radius);
  });
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xff5b64, transparent: true, opacity: 0.75 }));
}

function createUndefinedLimitMarker(transform, jointId) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.041, 10, 7),
    new THREE.MeshBasicMaterial({ color: LIMIT_COLORS.undefined, wireframe: true, transparent: true, opacity: 0.7 }),
  );
  marker.position.fromArray(transform.worldPosition);
  marker.name = `${jointId}:LIMIT UNDEFINED`;
  return marker;
}
