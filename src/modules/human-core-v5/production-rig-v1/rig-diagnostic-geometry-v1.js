import * as THREE from 'three';
import { createJointLimitVisualizationV1 } from './joint-limit-visualization-v1.js';

export const RIG_DIAGNOSTIC_GEOMETRY_V1_SCHEMA = 'humanoid_rig/rig_diagnostic_geometry@1.0';
export const RIG_DIAGNOSTIC_MODES_V1 = Object.freeze(['lite', 'rig', 'interaction', 'deform']);

const COLORS = Object.freeze({
  core: 0xd8efff,
  coreJoint: 0xffffff,
  performance: 0xf190ff,
  interaction: 0xffce58,
  twist: 0xff4b55,
  bend: 0x42df82,
  side: 0x4598ff,
  selection: 0xffffff,
});

export function createRigDiagnosticGeometryV1({
  scene,
  coreLayer,
  performanceLayer,
  interactionLayer,
  mode = 'rig',
  showAxes = true,
  showLimits = false,
} = {}) {
  if (!scene?.isScene) throw new Error('Rig diagnostic geometry requires a Three.js Scene.');
  if (!RIG_DIAGNOSTIC_MODES_V1.includes(mode)) throw new Error(`Unknown rig diagnostic mode ${mode}.`);
  const root = new THREE.Group();
  root.name = 'production-rig-diagnostic-v1';
  const groups = {
    lite: new THREE.Group(),
    rig: new THREE.Group(),
    interaction: new THREE.Group(),
    deform: new THREE.Group(),
    axes: new THREE.Group(),
  };
  Object.entries(groups).forEach(([name, group]) => { group.name = `${name}-diagnostics`; root.add(group); });
  const pickables = [];
  buildLite(groups.lite, coreLayer, pickables);
  const segmentMetrics = buildRig(groups.rig, groups.axes, coreLayer, pickables);
  buildInteraction(groups.interaction, interactionLayer, coreLayer, pickables);
  buildDeform(groups.deform, performanceLayer, coreLayer, pickables);
  const limits = createJointLimitVisualizationV1({ coreLayer, visible: showLimits });
  root.add(limits.group);
  collectPickables(limits.group, pickables);
  scene.add(root);
  applyMode(groups, limits.group, mode, showAxes, showLimits);
  return {
    schema: RIG_DIAGNOSTIC_GEOMETRY_V1_SCHEMA,
    root,
    groups,
    limits,
    pickables,
    segmentMetrics,
    setMode(nextMode) {
      if (!RIG_DIAGNOSTIC_MODES_V1.includes(nextMode)) return;
      mode = nextMode;
      applyMode(groups, limits.group, mode, groups.axes.visible, limits.group.visible);
    },
    setAxes(visible) { groups.axes.visible = Boolean(visible) && mode !== 'lite'; },
    setLimits(visible) { limits.group.visible = Boolean(visible) && mode !== 'lite'; },
    dispose() { scene.remove(root); disposeObject(root); },
  };
}

function buildLite(group, coreLayer, pickables) {
  const positions = [];
  for (const segment of coreLayer.boneSegments) positions.push(...segment.start, ...segment.end);
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)),
    new THREE.LineBasicMaterial({ color: COLORS.core, transparent: true, opacity: 0.92 }),
  );
  lines.userData.rigElement = summaryElement('Core Rig', 'HumanRigCore', 'core-skeleton-lines', null, [0, 0, 0], [0, 0, 0, 1], null, null, null, ['lite-skeleton'], 'read-only');
  group.add(lines);
  pickables.push(lines);
}

function buildRig(group, axesGroup, coreLayer, pickables) {
  let maximumSegmentLengthError = 0;
  let maximumSegmentAxisErrorDegrees = 0;
  for (const segment of coreLayer.boneSegments) {
    if (segment.length <= 1e-8) continue;
    const radius = Math.min(segment.radius, segment.length * 0.24);
    const middleHeight = Math.max(1e-6, segment.length - radius * 2);
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, middleHeight, 4, 8, 1),
      new THREE.MeshBasicMaterial({ color: COLORS.core, transparent: true, opacity: 0.24, depthWrite: false }),
    );
    mesh.position.fromArray(segment.worldTransform.position);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...segment.direction));
    mesh.name = segment.segmentId;
    mesh.userData.rigElement = summaryElement(
      'Core Bone', 'HumanRigCore+finalPose FK', segment.segmentId, segment.parentJointId,
      segment.worldTransform.position, mesh.quaternion.toArray(), segment.length, null, null,
      ['diagnostic-capsule', 'future-collision-interface'], 'read-only',
    );
    group.add(mesh);
    pickables.push(mesh);
    maximumSegmentLengthError = Math.max(maximumSegmentLengthError, segment.lengthError);
    maximumSegmentAxisErrorDegrees = Math.max(maximumSegmentAxisErrorDegrees, segment.alignmentError);
  }
  const coreIds = new Set(coreLayer.rigCore.coreJointIds);
  for (const [jointId, transform] of Object.entries(coreLayer.jointTransforms)) {
    if (!coreIds.has(jointId)) continue;
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 14, 10),
      new THREE.MeshBasicMaterial({ color: COLORS.coreJoint }),
    );
    sphere.position.fromArray(transform.worldPosition);
    sphere.name = jointId;
    sphere.userData.rigElement = summaryElement(
      'Core Joint', 'HumanRigCore+finalPose', jointId, transform.parentId,
      transform.worldPosition, transform.worldQuaternion, coreLayer.contract.boneLengths[jointId],
      transform.basis, transform.limits, ['joint-transform', 'basis', 'limits'], 'read-only',
      { rawJointProfile: coreLayer.rigCore.joints.find((joint) => joint.jointId === jointId), rawFinalPose: coreLayer.finalPose },
    );
    group.add(sphere);
    pickables.push(sphere);
    if (transform.basis) axesGroup.add(createAxes(transform));
    group.add(createLabelSprite(jointId, transform.worldPosition));
  }
  for (const jointId of ['hips', 'upperChest', 'head']) {
    const transform = coreLayer.jointTransforms[jointId];
    if (!transform) continue;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(jointId === 'hips' ? 0.22 : 0.16, 0.09, 0.12),
      new THREE.MeshBasicMaterial({ color: jointId === 'hips' ? 0x5ec9ff : jointId === 'upperChest' ? 0x66e0b0 : 0xffda72, wireframe: true }),
    );
    box.position.fromArray(transform.worldPosition);
    box.quaternion.fromArray(transform.worldQuaternion);
    box.userData.rigElement = summaryElement('Core Joint', 'finalPose frame', `${jointId}:orientation-frame`, jointId, transform.worldPosition, transform.worldQuaternion, null, transform.basis, transform.limits, ['orientation-frame'], 'diagnostic');
    group.add(box);
    pickables.push(box);
  }
  return { maximumSegmentLengthError, maximumSegmentAxisErrorDegrees };
}

function buildInteraction(group, interactionLayer, coreLayer, pickables) {
  for (const anchor of interactionLayer.anchors) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(anchor.anchorId.includes('Center') ? 0.025 : 0.018, 12, 8),
      new THREE.MeshBasicMaterial({ color: COLORS.interaction }),
    );
    marker.position.fromArray(anchor.worldPosition);
    marker.name = anchor.anchorId;
    marker.userData.rigElement = summaryElement(
      'Interaction Anchor', anchor.sourceFrame, anchor.anchorId, anchor.sourceJointId,
      anchor.worldPosition, coreLayer.jointTransforms[anchor.sourceJointId]?.worldQuaternion ?? [0, 0, 0, 1],
      null, null, null, anchor.capabilities, anchor.supported ? 'supported' : 'unsupported',
      { rawAnchorDefinition: anchor },
    );
    group.add(marker);
    pickables.push(marker);
    if (anchor.worldDirection) {
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(...anchor.worldDirection), new THREE.Vector3(...anchor.worldPosition),
        /GazeTarget/.test(anchor.anchorId) ? 0.35 : 0.13, COLORS.interaction, 0.035, 0.018,
      );
      arrow.userData.rigElement = marker.userData.rigElement;
      group.add(arrow);
      collectPickables(arrow, pickables);
    }
  }
  for (const side of ['left', 'right']) {
    const center = interactionLayer.anchorsById[`${side}PalmCenter`];
    const hand = coreLayer.jointTransforms[`${side}Hand`];
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.11, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xffb84c, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false }),
    );
    plane.position.fromArray(center.worldPosition);
    plane.quaternion.fromArray(hand.worldQuaternion);
    plane.userData.rigElement = summaryElement('Interaction Anchor', 'hand-frame', `${side}PalmPlane`, `${side}Hand`, center.worldPosition, hand.worldQuaternion, null, null, null, ['palm-plane', 'salute', 'grasp'], 'diagnostic');
    group.add(plane);
    pickables.push(plane);
  }
  const hips = coreLayer.jointTransforms.hips.worldPosition;
  const chest = coreLayer.jointTransforms.chest.worldPosition;
  const com = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 9), new THREE.MeshBasicMaterial({ color: 0x54ff9e }));
  com.position.set((hips[0] + chest[0]) / 2, (hips[1] + chest[1]) / 2, (hips[2] + chest[2]) / 2);
  com.userData.rigElement = summaryElement('Interaction Anchor', 'HumanBalanceStateV5 semantic COM', 'centerOfMass', 'hips', com.position.toArray(), [0, 0, 0, 1], null, null, null, ['balance-measurement'], 'measurement-only');
  group.add(com); pickables.push(com);
  const supportPoints = ['leftHeelContact', 'leftToeContact', 'rightToeContact', 'rightHeelContact']
    .map((anchorId) => interactionLayer.anchorsById[anchorId].worldPosition);
  const support = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(supportPoints.map((point) => new THREE.Vector3(...point))),
    new THREE.LineBasicMaterial({ color: 0x54ff9e }),
  );
  support.userData.rigElement = summaryElement('Interaction Anchor', 'foot contact anchors', 'supportArea', null, [0, 0, 0], [0, 0, 0, 1], null, null, null, ['support-area'], 'measurement-only');
  group.add(support); pickables.push(support);
  for (const target of coreLayer.finalPose.ikTargets ?? []) {
    const targetMarker = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), new THREE.MeshBasicMaterial({ color: 0xff5d82 }));
    targetMarker.position.fromArray(target.position ?? [0, 0, 0]);
    targetMarker.userData.rigElement = summaryElement('Interaction Anchor', target.source ?? 'finalPose.ikTargets', target.targetId, target.jointId, target.position, [0, 0, 0, 1], null, null, null, ['ik-target'], 'pose-goal-read-only');
    group.add(targetMarker); pickables.push(targetMarker);
  }
}

function buildDeform(group, performanceLayer, coreLayer, pickables) {
  const positions = [];
  for (const node of performanceLayer.nodes) {
    const marker = new THREE.Mesh(
      node.derivedRole === 'twist-distribution' ? new THREE.OctahedronGeometry(0.027) : new THREE.SphereGeometry(0.03, 12, 8),
      new THREE.MeshBasicMaterial({ color: COLORS.performance, wireframe: node.derivedRole === 'scapula-derived' }),
    );
    marker.position.fromArray(node.worldPosition);
    marker.quaternion.fromArray(node.worldQuaternion);
    marker.name = node.nodeId;
    marker.userData.rigElement = summaryElement(
      'Performance Node', node.derivedRole, node.nodeId, node.coreJointSource,
      node.worldPosition, node.worldQuaternion, null,
      coreLayer.jointTransforms[node.coreJointSource]?.basis ?? null,
      null, [node.deformRole, node.interactionRole, ...node.status], 'skin-weight-pending',
      { rawJointProfile: node },
    );
    group.add(marker); pickables.push(marker);
    const source = coreLayer.jointTransforms[node.coreJointSource];
    if (source) positions.push(...source.worldPosition, ...node.worldPosition);
  }
  const mapping = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)),
    new THREE.LineDashedMaterial({ color: 0xf190ff, dashSize: 0.025, gapSize: 0.015, transparent: true, opacity: 0.7 }),
  );
  mapping.computeLineDistances();
  group.add(mapping);
  buildLite(group, coreLayer, pickables);
}

function createAxes(transform) {
  const group = new THREE.Group();
  group.name = `${transform.jointId}:axes`;
  const origin = new THREE.Vector3(...transform.worldPosition);
  const q = new THREE.Quaternion(...transform.worldQuaternion);
  const specs = [
    ['twistAxisLocal', COLORS.twist, 'Twist'],
    ['bendAxisLocal', COLORS.bend, 'Bend'],
    ['sideAxisLocal', COLORS.side, 'Side'],
  ];
  for (const [key, color, label] of specs) {
    const direction = new THREE.Vector3(...transform.basis[key]).applyQuaternion(q).normalize();
    const arrow = new THREE.ArrowHelper(direction, origin, 0.105, color, 0.025, 0.014);
    arrow.userData.rigElement = summaryElement('Core Joint', 'JointSemanticProfileV5', `${transform.jointId}:${label}`, transform.jointId, transform.worldPosition, transform.worldQuaternion, null, transform.basis, transform.limits, ['local-axis', label.toLowerCase()], 'read-only');
    group.add(arrow);
  }
  return group;
}

function applyMode(groups, limitGroup, mode, axes, limits) {
  groups.lite.visible = mode === 'lite';
  groups.rig.visible = mode === 'rig';
  groups.interaction.visible = mode === 'interaction';
  groups.deform.visible = mode === 'deform';
  groups.axes.visible = Boolean(axes) && mode !== 'lite';
  limitGroup.visible = Boolean(limits) && mode !== 'lite';
}

function createLabelSprite(text, position) {
  if (typeof document === 'undefined') return new THREE.Group();
  const canvas = document.createElement('canvas');
  canvas.width = 320; canvas.height = 64;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(3, 10, 18, .82)'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#e6f5ff'; context.font = '28px Segoe UI'; context.fillText(text, 12, 41);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
  sprite.position.set(position[0], position[1] + 0.055, position[2]);
  sprite.scale.set(0.32, 0.064, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function summaryElement(layer, source, id, parent, worldPosition, worldQuaternion, boneLength, axes, limits, capabilities, status, raw = {}) {
  return { id, layer, source, parent, worldPosition: [...(worldPosition ?? [0, 0, 0])], worldQuaternion: [...(worldQuaternion ?? [0, 0, 0, 1])], boneLength, axes, limits, capabilities, status, ...raw };
}

function collectPickables(object, pickables) {
  object.traverse((child) => { if (child.userData.rigElement && (child.isMesh || child.isLine || child.isPoints)) pickables.push(child); });
}

function disposeObject(root) {
  root.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
    object.material?.map?.dispose?.();
  });
}
