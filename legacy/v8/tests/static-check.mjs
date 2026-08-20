import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applyPosePayload,
  buildExportPayload,
  buildPosePayload,
  calculateRigHeight,
  canonicalDefinition,
  computeRestWorldPositions,
  getBoneLength,
} from '../src/skeleton-model.js';
import { createStandardHumanoidPreset, normalizeSkeletonDefinition } from '../src/skeleton-presets.js';
import { PhysicsRig } from '../src/physics-rig.js';

const root = new URL('../', import.meta.url);
const [
  html,
  main,
  svgView,
  threeView,
  skinSource,
  bodyProfileSource,
  glbSource,
  physicsSource,
  biomechanicsSource,
  launcher,
  installer,
  runtimeInstaller,
  packageText,
  nodeServer,
  powershellServer,
  attribution,
] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('src/main.js', root), 'utf8'),
  readFile(new URL('src/svg-view.js', root), 'utf8'),
  readFile(new URL('src/three-view.js', root), 'utf8'),
  readFile(new URL('src/smpl-skin.js', root), 'utf8'),
  readFile(new URL('src/body-profile.js', root), 'utf8'),
  readFile(new URL('src/glb-geometry.js', root), 'utf8'),
  readFile(new URL('src/physics-rig.js', root), 'utf8'),
  readFile(new URL('src/biomechanics.js', root), 'utf8'),
  readFile(new URL('打开编辑器.bat', root), 'utf8'),
  readFile(new URL('安装本地三维库并打开.bat', root), 'utf8'),
  readFile(new URL('install-three-runtime.ps1', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8'),
  readFile(new URL('server.mjs', root), 'utf8'),
  readFile(new URL('server-windows.ps1', root), 'utf8'),
  readFile(new URL('assets/smpl/ATTRIBUTION.md', root), 'utf8'),
]);

assert.match(html, /SMPL 24 标准/);
assert.match(html, /Meshcapade 公开的 CC BY 4\.0/);
assert.match(html, /id="import-input"/);
assert.match(html, /导入姿势 JSON/);
assert.match(html, /绑定数据 · 只读/);
assert.match(html, /人体关节限制 · 强制开启/);
assert.match(html, /id="skin-toggle"/);
assert.match(html, /id="skeleton-xray-toggle"/);
assert.match(html, /id="skin-opacity"/);
assert.match(html, /id="skin-mode"/);
assert.match(html, /id="surface-source"/);
assert.match(html, /不再创建黄色程序化人体代理/);
assert.match(html, /唯一精细人体网格/);
assert.match(html, /data-display-mode="skin"/);
assert.match(html, /data-display-mode="skeleton"/);
assert.match(html, /data-display-mode="both"/);
assert.match(html, /人体表皮交互层/);
assert.match(html, /id="surface-retry-button"/);
assert.match(html, /<option value="solid" selected>/);
assert.match(html, /id="joint-limit-error"/);
assert.match(html, /id="selected-standard-index"/);
assert.match(html, /id="selected-joint-type"/);
assert.match(html, /id="selected-joint-range"/);
assert.match(html, /id="selected-joint-angle"/);
assert.match(html, /id="selected-limit-state"/);
assert.match(html, /id="solver-select"/);
assert.match(html, /<option value="64" selected>/);
assert.match(html, /id="bind-local-x" type="number" readonly/);
assert.match(html, /<strong id="selected-bone-length">/);
assert.doesNotMatch(html, /<input[^>]+id="selected-bone-length"/);
assert.match(html, /window\.location\.protocol !== 'file:'/);
assert.doesNotMatch(html, /type="importmap"/);

assert.match(main, /humanoid-skeleton-editor:v8\.4-3d-proportion/);
assert.match(main, /HOST_PROTOCOL = 'humanoid-rig-lab-next:viewport'/);
assert.match(main, /HRL_EMBED_READY/);
assert.match(main, /HRL_HOST_STATE/);
assert.match(main, /HRL_ANIMATION_FRAME/);
assert.match(main, /function applyAnimationFrame/);
assert.match(main, /project:\s*!animationFrame/);
assert.match(main, /HRL_POSE_COMMIT/);
assert.match(main, /HRL_PREVIEW_BODY_PROFILE/);
assert.match(main, /HRL_PROFILE_STATUS/);
assert.match(main, /applyHostBodyProfile/);
assert.match(main, /bodyProfileKey/);
assert.match(main, /embed-mode/);
assert.match(main, /currentSurfaceSource/);
assert.match(main, /setSkinSource/);
assert.match(main, /function setDisplayMode/);
assert.match(main, /currentDisplayMode/);
assert.match(main, /applyPosePayload\(definition, parsed\)/);
assert.match(main, /new PhysicsRig/);
assert.match(main, /getMaxJointLimitViolation/);
assert.match(main, /getJointLimitInfo/);
assert.match(main, /renderer.*=== '2d'/);
assert.match(main, /\/node_modules\/three\/build\/three\.webgpu\.js/);
assert.match(main, /\/vendor\/three\.webgpu\.js/);
assert.match(main, /three@\$\{THREE_VERSION\}/);
assert.match(main, /安装本地三维库并打开\.bat/);
assert.match(main, /candidate\.timeoutMs/);
assert.doesNotMatch(main, /joint\.localPosition\s*=/);

assert.match(svgView, /visualBone === false/);
assert.match(svgView, /visualJoint === false/);
assert.match(svgView, /'data-kind': 'bone'/);
assert.match(threeView, /new THREE\.WebGPURenderer/);
assert.match(threeView, /createSmplSkinLayer/);
assert.match(threeView, /reloadSkinLayer/);
assert.match(threeView, /getSurfaceDiagnostics/);
assert.match(threeView, /setSkinSource/);
assert.match(threeView, /visualBone === false/);
assert.match(threeView, /visualJoint !== false/);
assert.match(threeView, /startFreeDrag/);
assert.match(threeView, /getPickTargets/);
assert.match(threeView, /resolvePick/);

assert.match(skinSource, /from '\.\/glb-geometry\.js'/);
assert.doesNotMatch(skinSource, /new this\.THREE\.SkinnedMesh/);
assert.match(skinSource, /new this\.THREE\.Mesh/);
assert.match(skinSource, /CPU region-isolated adjacency-smoothed four-influence DQS/);
assert.match(skinSource, /SingleSmplHumanSurfaceLayer/);
assert.doesNotMatch(skinSource, /AnatomicalBodyLayer/);
assert.doesNotMatch(skinSource, /GuaranteedAnatomicalHumanSurface/);
assert.match(skinSource, /getPickTargets/);
assert.match(skinSource, /resolvePick/);
assert.match(skinSource, /deformSurfaceDqs/);
assert.match(skinSource, /smoothSkinWeights/);
assert.match(skinSource, /lowerBodyBoundaryAtHeight/);
assert.match(skinSource, /skinIndices/);
assert.match(skinSource, /skinWeights/);
assert.match(skinSource, /SMPL_JOINT_IDS/);
assert.match(skinSource, /分区四关节权重/);
assert.match(skinSource, /singleVisibleSurface/);
assert.match(skinSource, /single-smpl-human-surface/);
assert.doesNotMatch(skinSource, /baseLayer/);
assert.doesNotMatch(skinSource, /selected.*material/i);
assert.match(skinSource, /proceduralSurfacePresent: false/);
assert.match(skinSource, /pickSource: 'detailed-smpl-mesh'/);
assert.doesNotMatch(skinSource, /GLTFLoader/);
assert.doesNotMatch(skinSource, /three\/addons/);

assert.match(bodyProfileSource, /REFERENCE_BODY_PROFILE/);
assert.match(bodyProfileSource, /applyBodyProfileToDefinition/);
assert.match(bodyProfileSource, /measureBodyProfile/);
assert.match(bodyProfileSource, /applyShoulderWidth/);
assert.match(bodyProfileSource, /applyHipWidth/);
assert.match(bodyProfileSource, /fitCentralHeight/);
assert.match(bodyProfileSource, /requiresSkinRebind/);

assert.match(glbSource, /parseGlbMesh/);
assert.match(glbSource, /GLB 2\.0/);
assert.match(glbSource, /POSITION/);
assert.match(glbSource, /COLOR_0/);
assert.match(glbSource, /byteStride/);

assert.match(physicsSource, /BiomechanicsSolver/);
assert.match(physicsSource, /getMaxJointLimitViolation/);
assert.match(physicsSource, /getRigidPelvisError/);
assert.match(physicsSource, /syncControlNodes/);
assert.match(physicsSource, /physicalBone === false/);
assert.doesNotMatch(physicsSource, /localPosition\s*=/);
assert.match(biomechanicsSource, /type: 'hinge'/);
assert.match(biomechanicsSource, /type: 'limbRoot'/);
assert.match(biomechanicsSource, /type: 'wrist'/);
assert.match(biomechanicsSource, /type: 'foot'/);
assert.match(biomechanicsSource, /addRigidPair\('leftUpperLeg', 'rightUpperLeg'/);

assert.match(launcher, /node server\.mjs/);
assert.doesNotMatch(launcher, /npm install/);
assert.match(installer, /three\\build\\three\.webgpu\.js/i);
assert.match(installer, /npm install/i);
assert.match(installer, /install-three-runtime\.ps1/i);
assert.match(installer, /vendor\\three\.webgpu\.js/i);
assert.match(installer, /0\.185\.1/);
assert.match(runtimeInstaller, /cdn\.jsdelivr\.net/);
assert.match(runtimeInstaller, /unpkg\.com/);
assert.match(runtimeInstaller, /three\.webgpu\.js/);
assert.match(runtimeInstaller, /three\.core\.js/);
assert.match(packageText, /"version": "0\.8\.4"/);
assert.match(packageText, /"three": "0\.185\.1"/);
assert.match(nodeServer, /'\.glb', 'model\/gltf-binary'/);
assert.match(powershellServer, /'\.glb'\s*=\s*'model\/gltf-binary'/);
assert.match(attribution, /CC BY 4\.0/);
assert.match(attribution, /does not include the licensed full SMPL parametric body model/);

const definition = normalizeSkeletonDefinition(createStandardHumanoidPreset('A'));
assert.ok(Math.abs(calculateRigHeight(definition) - 1.795672) < 1e-9);
const bindCanonical = JSON.stringify(definition.joints.map((joint) => [
  joint.id,
  joint.parentId,
  joint.localPosition,
  joint.jointRadius,
  joint.boneRadius,
  joint.visualBone,
  joint.physicalBone,
  joint.jointType,
  joint.standard,
]));

const rig = new PhysicsRig(definition, { solverIterations: 64, gravityEnabled: false });
const hand = rig.getPoint('leftHand');
rig.moveJointTo('leftHand', { x: hand.x - 0.2, y: hand.y + 0.15, z: hand.z + 0.08 });
assert.ok(rig.getMaxBoneError() < 1e-5);
assert.ok(rig.getMaxJointLimitViolation() < 0.05);
assert.ok(rig.getRigidPelvisError() < 1e-4);
assert.equal(JSON.stringify(definition.joints.map((joint) => [
  joint.id,
  joint.parentId,
  joint.localPosition,
  joint.jointRadius,
  joint.boneRadius,
  joint.visualBone,
  joint.physicalBone,
  joint.jointType,
  joint.standard,
])), bindCanonical);

const exported = buildExportPayload(definition);
assert.equal(exported.schemaVersion, 6);
assert.equal(exported.standard.jointLayout, 'SMPL 24');
assert.equal(exported.surface.asset, 'assets/smpl/smpl-male-surface.glb');
assert.equal(exported.joints.filter((joint) => joint.standard?.family === 'SMPL').length, 24);

const exportedPose = buildPosePayload(definition);
const newDefinition = normalizeSkeletonDefinition(createStandardHumanoidPreset('A'));
const restBefore = computeRestWorldPositions(newDefinition);
applyPosePayload(newDefinition, exportedPose);
const restAfter = computeRestWorldPositions(newDefinition);
for (const joint of newDefinition.joints) {
  assert.deepEqual(restAfter.get(joint.id), restBefore.get(joint.id));
  assert.ok(getBoneLength(newDefinition, joint.id) >= 0);
}
assert.notEqual(canonicalDefinition(newDefinition), canonicalDefinition(createStandardHumanoidPreset('A')));

console.log('V8.4 single detailed surface, anatomical fit, host bridge, direct body picking, launchers, and integration checks passed.');
