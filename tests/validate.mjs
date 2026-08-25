import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  ACTIVE_VERSIONS,
  BUILD_ID,
  BUILD_VERSION,
  MODULE_BASE_REVISIONS,
  SCHEMA_VERSION,
  createDefaultState,
} from '../src/default-state.js';
import { normalizeProjectState } from '../src/state-schema.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const moduleFiles = [
  'src/modules/proportion/index.js',
  'src/modules/skin/index.js',
  'src/modules/pose/index.js',
  'src/modules/animation/index.js',
  'src/modules/integration/index.js',
];
const legacyFiles = [
  'legacy/v8/index.html',
  'legacy/v8/src/main.js',
  'legacy/v8/src/three-view.js',
  'legacy/v8/src/skeleton-presets.js',
  'legacy/v8/src/skeleton-model.js',
  'legacy/v8/src/body-profile.js',
  'legacy/v8/src/smpl-skin.js',
  'legacy/v8/assets/smpl/smpl-male-surface.glb',
  'legacy/v8/assets/smpl/smpl-male-surface-skinned.glb',
  'legacy/v8/assets/smpl/SKIN_BINDING_METADATA.json',
  'legacy/v8/sample-standard-humanoid-a.json',
];
const required = [
  'index.html', 'studio.html', 'face.html', 'character.html', 'character-studio.html',
  'styles.css', 'face.css', 'server.mjs',
  'start.bat', 'START_HERE.cmd', 'launcher.ps1', 'server-windows.ps1', 'DIAGNOSE_STARTUP.bat',
  'src/default-state.js', 'src/state-schema.js', 'src/module-registry.js', 'src/workspace-common.js',
  'src/project-hub.js', 'src/humanoid-preview.js', 'src/dashboard.js', 'src/studio.js', 'src/face-editor-page.js',
  'src/modules/human-core-v5/core-utils.js',
  'src/modules/human-core-v5/body-dna-v5.js',
  'src/modules/human-core-v5/joint-semantic-profile-v5.js',
  'src/modules/human-core-v5/human-rig-core-v5.js',
  'src/modules/human-core-v5/human-core-state-v5.js',
  'src/modules/human-core-v5/mass-distribution-model-v5.js',
  'src/modules/human-core-v5/muscle-semantic-profile-v5.js',
  'src/modules/human-core-v5/human-balance-state-v5.js',
  'src/modules/human-core-v5/anatomy-deformation-signal-v5.js',
  'src/modules/human-core-v5/human-anatomy-state-v5.js',
  'src/modules/human-core-v5/anatomy-pose-evaluator-v5.js',
  'src/modules/human-core-v5/human-anatomy-runtime-v5.js',
  'src/modules/human-core-v5/v4-adapter.js',
  'src/modules/human-core-v5/human-core-runtime.js',
  'src/modules/human-core-v5/index.js',
  ...moduleFiles,
  'workers/project-hub.shared.js',
  ...legacyFiles,
  '.github/workflows/validate.yml', '.github/workflows/pages.yml',
  '.github/workflows/procedural-deform-browser-qa.yml',
  'control/project-state.json', 'docs/MODULE_BOUNDARIES.md',
  'packages/character-core/index.js', 'packages/character-core/index.ts',
  'packages/character-core/character-profile.ts', 'packages/character-core/character-state.ts',
  'packages/character-core/character-version.ts', 'packages/character-core/character-manager.ts',
  'schemas/character-profile.schema.json', 'tests/character-core.mjs',
  'packages/body-shape/index.js', 'packages/body-shape/index.ts',
  'packages/body-shape/body-shape-profile.ts', 'packages/body-shape/body-shape-runtime.ts',
  'packages/body-shape/body-shape-editor.ts', 'schemas/body-shape-profile.schema.json',
  'tests/body-shape.mjs',
  'packages/face-system/index.js', 'packages/face-system/index.ts',
  'packages/face-system/face-profile.ts', 'packages/face-system/face-runtime.ts',
  'packages/face-system/face-editor.ts', 'schemas/face-profile.schema.json',
  'packages/face-system/face-expression.js', 'packages/face-system/face-expression.ts',
  'packages/face-system/face-runtime-descriptor.js', 'packages/face-system/face-runtime-descriptor.ts',
  'packages/face-system/face-analysis-adapter.js', 'packages/face-system/face-analysis-adapter.ts',
  'packages/face-system/face-animation-layer.js', 'packages/face-system/face-animation-layer.ts',
  'schemas/face-expression.schema.json', 'tests/face-system.mjs', 'tests/face-expression.mjs',
  'apps/character-studio/index.js', 'apps/character-studio/character-studio.css',
  'packages/clothing-system/index.js', 'packages/clothing-system/index.ts',
  'packages/clothing-system/clothing-profile.ts', 'packages/clothing-system/clothing-asset.ts',
  'packages/clothing-system/clothing-runtime.ts', 'packages/clothing-system/clothing-manager.ts',
  'schemas/clothing-profile.schema.json', 'src/modules/clothing/index.js',
  'legacy/v8/src/clothing-layer.js', 'tests/clothing-system.mjs',
  'packages/appearance-system/index.js', 'packages/appearance-system/index.ts',
  'packages/appearance-system/hair-profile.ts', 'packages/appearance-system/accessory-profile.ts',
  'packages/appearance-system/appearance-runtime.ts',
  'schemas/hair-profile.schema.json', 'schemas/accessory-profile.schema.json',
  'tests/appearance-system.mjs',
  'apps/character-generator/image-analysis.js', 'apps/character-generator/character-generator.js',
  'apps/character-generator/index.js', 'apps/character-generator/page.js',
  'apps/character-generator/character-generator.css',
  'schemas/character-generator-session.schema.json', 'tests/character-generator.mjs',
  'apps/character-studio/character-studio-session.js',
  'apps/character-studio/character-studio-persistence.js',
  'apps/character-studio/character-profile-export.js',
  'apps/character-studio/character-studio-controller.js',
  'apps/character-studio/character-studio.css',
  'apps/character-studio/components/character-studio-sidebar.js',
  'apps/character-studio/components/panel-component.js',
  'apps/character-studio/panels/index.js',
  'apps/character-studio/panels/identity-panel.js',
  'apps/character-studio/panels/body-shape-panel.js',
  'apps/character-studio/panels/face-panel.js',
  'apps/character-studio/panels/clothing-panel.js',
  'apps/character-studio/panels/hair-panel.js',
  'apps/character-studio/panels/accessory-panel.js',
  'apps/character-studio/panels/proportion-panel.js',
  'apps/character-studio/panels/pose-panel.js',
  'apps/character-studio/panels/animation-panel.js',
  'apps/character-studio/index.js',
  'schemas/character-profile-export.schema.json',
  'tests/helpers/character-studio-test-hub.mjs',
  'tests/character-studio-panels.mjs',
  'tests/integration/character-studio-state.mjs',
  'tests/integration/character-studio-v1.mjs',
  'tests/multi-window/character-studio-sync.mjs',
  'docs/CHARACTER_STUDIO_STATE_FLOW.md',
  'docs/CHARACTER_STUDIO_V1_MERGE_REPORT_2026-08-21.md',
  'docs/FOUR_MODULE_COLLABORATION.md', 'docs/CHAT_WINDOW_START_PROMPTS.md',
  'docs/GITHUB_BRANCH_WORKFLOW.md', 'control/handoffs/HANDOFF_TEMPLATE.md',
  'PREPARE_BRANCHES.cmd', 'scripts/prepare-module-branches.ps1', '.github/PULL_REQUEST_TEMPLATE.md',
  'UPGRADE_NOTES_V0.5.0.md', 'BUILD_MANIFEST.json', 'THIRD_PARTY_NOTICES.md',
  'tests/integration-v002.mjs',
  'schemas/body-dna-v5.schema.json', 'schemas/joint-semantic-profile-v5.schema.json',
  'schemas/human-rig-core-v5.schema.json', 'schemas/human-core-state-v5.schema.json',
  'schemas/mass-distribution-model-v5.schema.json', 'schemas/muscle-semantic-profile-v5.schema.json',
  'schemas/human-balance-state-v5.schema.json', 'schemas/anatomy-deformation-signal-v5.schema.json',
  'schemas/human-anatomy-state-v5.schema.json',
  'tests/human-core-v5-bodydna-intelligent-rig.mjs', 'tests/human-core-v5-anatomy-runtime.mjs',
  'docs/HUMAN_CORE_V5_BODYDNA_DESIGN.md', 'docs/HUMAN_CORE_V5_ANATOMY_RUNTIME.md',
  'src/modules/human-core-v5/procedural-deform/anatomical-field-primitives-v5.js',
  'src/modules/human-core-v5/procedural-deform/anatomical-field-composition-v5.js',
  'src/modules/human-core-v5/procedural-deform/body-field-definition-v5.js',
  'src/modules/human-core-v5/procedural-deform/body-field-compiler-v5.js',
  'src/modules/human-core-v5/procedural-deform/canonical-surface-fairing-v5.js',
  'src/modules/human-core-v5/procedural-deform/deformed-surface-normals-v5.js',
  'src/modules/human-core-v5/procedural-deform/joint-corrective-fields-v5.js',
  'src/modules/human-core-v5/procedural-deform/orient-procedural-surface-v5.js',
  'src/modules/human-core-v5/procedural-deform/procedural-surface-deformation-quality-v5.js',
  'src/modules/human-core-v5/procedural-deform/static-validation-pose-compiler-v5.js',
  'src/modules/human-core-v5/procedural-deform/surface-region-binding-v5.js',
  'src/modules/human-core-v5/procedural-deform/surface-extractor-v5.js',
  'src/modules/human-core-v5/procedural-deform/region-deformation-driver-v5.js',
  'src/modules/human-core-v5/procedural-deform/procedural-deform-policy-v5.js',
  'src/modules/human-core-v5/procedural-deform/procedural-deform-frame-v5.js',
  'src/modules/human-core-v5/procedural-deform/procedural-deform-runtime-v5.js',
  'src/modules/human-core-v5/procedural-deform/procedural-surface-worker-client-v5.js',
  'src/modules/human-core-v5/procedural-deform/procedural-deform-validation-poses-v5.js',
  'src/modules/human-core-v5/procedural-deform/procedural-simulation-rig-fk-v5.js',
  'src/modules/human-core-v5/procedural-deform/index.js',
  'src/renderers/three/three-procedural-human-adapter-v5.js',
  'workers/procedural-surface.worker.js',
  'schemas/body-field-definition-v5.schema.json',
  'schemas/procedural-surface-cache-metadata-v5.schema.json',
  'schemas/region-deformation-driver-frame-v5.schema.json',
  'schemas/procedural-deform-frame-v5.schema.json',
  'schemas/renderer-adapter-input-v5.schema.json',
  'human-core-v5-procedural-deform.html',
  'apps/human-core-v5-procedural-deform/index.js',
  'apps/human-core-v5-procedural-deform/styles.css',
  'tests/human-core-v5-procedural-deform-contract.mjs',
  'tests/human-core-v5-procedural-surface.mjs',
  'tests/human-core-v5-procedural-surface-orientation.mjs',
  'tests/human-core-v5-procedural-self-intersection.mjs',
  'tests/human-core-v5-procedural-joint-quality.mjs',
  'tests/human-core-v5-static-validation-poses.mjs',
  'tests/human-core-v5-procedural-renderer-adapter.mjs',
  'tests/human-core-v5-procedural-deform-validation.mjs',
  'tests/human-core-v5-procedural-deform-stress.mjs',
  'tests/integration/human-core-v5-procedural-deform-page.mjs',
  'tests/browser/human-core-v5-procedural-deform.browser.mjs',
  'scripts/run-procedural-deform-browser-qa.mjs',
  'scripts/build-procedural-deform-qa-gallery.mjs',
  'scripts/run-human-core-v5-visual-qa.ps1',
  'RUN_HUMAN_CORE_V5_VISUAL_QA.bat',
  'docs/HUMAN_CORE_V5_PROCEDURAL_DEFORM.md',
  'docs/HUMAN_CORE_V5_PROCEDURAL_DEFORM_VISUAL_ACCEPTANCE.md',
  'docs/HUMAN_CORE_V5_PROCEDURAL_DEFORM_QA_REPORT.md',
  'docs/HUMAN_CORE_V5_PROCEDURAL_DEFORM_RESEARCH_DECISION.md',
  'docs/HUMAN_CORE_V5_PROCEDURAL_DEFORM_VISUAL_FAILURE_ANALYSIS.md',
  'control/module-scopes/proportion.json', 'control/module-scopes/skin.json',
  'control/module-scopes/pose.json', 'control/module-scopes/animation.json',
];
for (const file of required) await access(join(root, file));

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
assert.equal(packageJson.version, '0.5.0');
assert.equal(packageJson.dependencies.three, '0.185.1');
assert.equal(packageJson.devDependencies.playwright, '1.62.1');
assert.match(packageJson.scripts.test, /module-patches/);
assert.match(packageJson.scripts.test, /character-core/);
assert.match(packageJson.scripts.test, /body-shape/);
assert.match(packageJson.scripts.test, /face-system/);
assert.match(packageJson.scripts.test, /clothing-system/);
assert.match(packageJson.scripts.test, /appearance-system/);
assert.match(packageJson.scripts.test, /character-generator/);
assert.match(packageJson.scripts.test, /test:character-studio/);
assert.match(packageJson.scripts.test, /test:human-core-v5/);
assert.match(packageJson.scripts.test, /test:human-core-v5-anatomy/);
assert.match(packageJson.scripts['test:human-core-v5-anatomy'], /human-core-v5-anatomy-runtime/);
assert.match(packageJson.scripts.test, /test:human-core-v5-procedural-deform/);
assert.match(packageJson.scripts['test:human-core-v5-procedural-deform'], /human-core-v5-procedural-deform-contract/);
assert.match(packageJson.scripts['test:human-core-v5-procedural-deform'], /human-core-v5-procedural-surface/);
assert.match(packageJson.scripts['test:human-core-v5-procedural-deform'], /human-core-v5-procedural-deform-validation/);
assert.match(packageJson.scripts['test:human-core-v5-procedural-deform'], /human-core-v5-procedural-deform-stress/);
assert.match(packageJson.scripts['test:human-core-v5-procedural-deform'], /human-core-v5-procedural-deform-page/);
assert.match(packageJson.scripts['test:human-core-v5-procedural-deform-browser'], /tests\/browser\/human-core-v5-procedural-deform\.browser/);
assert.match(packageJson.scripts['test:human-core-v5-procedural-deform-qa'], /--verify-artifacts/);
assert.match(packageJson.scripts['build:human-core-v5-procedural-deform-gallery'], /build-procedural-deform-qa-gallery/);
assert.match(packageJson.scripts['qa:human-core-v5-visual'], /--all-backends/);
assert.match(packageJson.scripts['test:character-studio'], /character-studio-v1/);
assert.match(packageJson.scripts.test, /integration-v002/);
assert.match(packageJson.scripts.test, /test:animation/);
assert.match(packageJson.scripts.test, /legacy\/v8/);

const startBatch = await readFile(join(root, 'start.bat'), 'utf8');
assert.match(startBatch, /launcher\.ps1/i);
assert.doesNotMatch(startBatch, /打开审查平台/);
assert.ok([...startBatch].every((character) => character.charCodeAt(0) < 128), 'start.bat must stay ASCII-only');

const launcherScript = await readFile(join(root, 'launcher.ps1'), 'utf8');
assert.match(launcherScript, /server-windows\.ps1/);
assert.match(launcherScript, /node\.exe/);
assert.match(launcherScript, /startup-diagnostics\.txt/);
assert.match(launcherScript, /install --no-audit --no-fund/);
assert.match(launcherScript, /three\.webgpu\.js/);
assert.match(launcherScript, /BUILD_MANIFEST\.json/);
assert.match(launcherScript, new RegExp(BUILD_ID));

const buildManifest = JSON.parse(await readFile(join(root, 'BUILD_MANIFEST.json'), 'utf8'));
assert.equal(buildManifest.characterStudio.version, 'character-studio@1.0.0');
assert.equal(buildManifest.characterStudio.page, 'character-studio.html');
assert.equal(buildManifest.characterStudio.stateCenter, 'ProjectState via one ProjectHubClient');
assert.equal(buildManifest.characterStudio.viewportSource, 'simulationRig');
assert.equal(buildManifest.characterStudio.sessionSchema, 'humanoid_rig/character_studio_session@1.0');
assert.equal(buildManifest.characterStudio.exportSchema, 'humanoid_rig/character_profile_export@1.0');
assert.equal(buildManifest.characterStudio.persistence.structuredData, 'IndexedDB');
assert.equal(buildManifest.characterStudio.persistence.largeResources, 'OPFS');
assert.deepEqual(buildManifest.characterStudio.windowRoles, [
  'character-studio', 'main-editor', 'animation-editor', 'data-inspector',
]);
assert.equal(buildManifest.humanCoreV5ProceduralDeform.runtime, 'procedural-deform-runtime-v5@1');
assert.equal(buildManifest.humanCoreV5ProceduralDeform.schema, 'humanoid_rig/procedural_deform_frame@5.0');
assert.equal(buildManifest.humanCoreV5ProceduralDeform.poseAuthority, 'finalPose.localRotations');
assert.equal(buildManifest.humanCoreV5ProceduralDeform.rendererIndependence, true);
assert.equal(buildManifest.humanCoreV5ProceduralDeform.glbRequired, false);
assert.equal(buildManifest.humanCoreV5ProceduralDeform.workerGeneration, true);
assert.equal(buildManifest.humanCoreV5ProceduralDeform.implementationStatus, 'complete');
assert.equal(buildManifest.humanCoreV5ProceduralDeform.browserAutomation, 'complete');
assert.match(buildManifest.humanCoreV5ProceduralDeform.ciBrowserContract, /pending-github-actions|pass/);
assert.match(buildManifest.humanCoreV5ProceduralDeform.ciWebGL2, /pending-github-actions|pass/);
assert.match(buildManifest.humanCoreV5ProceduralDeform.ciWebGPU, /pending-measurement|webgpu-ci-/);
assert.equal(buildManifest.humanCoreV5ProceduralDeform.localBrowserPackage, 'ready');
assert.equal(buildManifest.humanCoreV5ProceduralDeform.browserQA, 'automated-contract-ready');
assert.equal(buildManifest.humanCoreV5ProceduralDeform.codexVisualReview, 'not-run-by-user-rule');
assert.equal(buildManifest.humanCoreV5ProceduralDeform.userVisualAcceptance, 'pending');
assert.equal(buildManifest.humanCoreV5ProceduralDeform.visualAcceptance, false);
assert.equal(buildManifest.humanCoreV5ProceduralDeform.productionReady, false);

const branchLauncher = await readFile(join(root, 'PREPARE_BRANCHES.cmd'), 'utf8');
assert.match(branchLauncher, /prepare-module-branches\.ps1/i);
assert.ok([...branchLauncher].every((character) => character.charCodeAt(0) < 128), 'PREPARE_BRANCHES.cmd must stay ASCII-only');
const branchScript = await readFile(join(root, 'scripts/prepare-module-branches.ps1'), 'utf8');
for (const branch of ['integration', 'work/proportion', 'work/skin', 'work/pose', 'work/animation']) {
  assert.match(branchScript, new RegExp(branch.replace('/', '\\/')));
}

const windowsServer = await readFile(join(root, 'server-windows.ps1'), 'utf8');
assert.match(windowsServer, /model\/gltf-binary/);
assert.match(windowsServer, /text\/javascript/);
assert.match(windowsServer, /Cross-Origin-Opener-Policy/);

const state = createDefaultState();
assert.equal(SCHEMA_VERSION, 11);
assert.equal(state.schemaVersion, 11);
assert.equal(state.build.version, BUILD_VERSION);
assert.equal(state.build.id, BUILD_ID);
assert.equal(BUILD_VERSION, '0.5.0');
assert.deepEqual(state.activeVersions, ACTIVE_VERSIONS);
assert.deepEqual(state.moduleRevisions, MODULE_BASE_REVISIONS);
assert.equal(Object.keys(state.modules).length, 5);
assert.equal(Object.keys(state.moduleRevisions).length, 6);
assert.equal(state.character.bodyProfile.preset, 'smpl-male-surface-fit-1796-v3');
assert.equal(state.character.bodyProfile.viewportMode, 'skeleton');
assert.equal(state.character.bodyProfile.requiresRebind, false);
assert.equal(state.character.rigRules.lockBoneIds, true);
assert.equal(state.character.rigRules.lockBindPoseAfterPublish, true);
assert.equal(state.character.rigRules.mirrorEditing, true);
assert.ok(state.character.bodyProfile.upperArmLength > state.character.bodyProfile.forearmLength);
assert.ok(state.character.bodyProfile.handControlLength < 0.08);
assert.ok(state.character.bodyProfile.lowerLegLength < state.character.bodyProfile.thighLength);
assert.equal(state.character.display.mode, 'both');
assert.equal(state.character.skin.source, 'detail');
assert.equal(state.character.skin.singleLayer, true);
assert.equal(state.character.skin.detailAsset, 'legacy/v8/assets/smpl/smpl-male-surface-skinned.glb');
assert.equal(state.character.skin.pickingSource, 'detailed-smpl-skinned-mesh');
assert.equal(state.character.skin.deformation, 'native-three-skinned-mesh');
assert.equal(state.character.pose.pinned.length, 2);
assert.equal(state.character.pose.poseSnapshot, null);
assert.equal(state.character.pose.v8Payload, null);
assert.equal(state.character.animation.keyframes.length, 0);
assert.equal(state.characterCore.schema, 'humanoid_rig/character_state@1.0');
assert.equal(state.characterCore.active_character_id, 'character_001');
assert.equal(state.characterCore.profiles.character_001.version, 1);
assert.equal(state.characterCore.profiles.character_001.proportion_revision, MODULE_BASE_REVISIONS.proportion);
assert.equal(state.characterCore.profiles.character_001.body_shape_revision, 1);
assert.equal(state.characterCore.profiles.character_001.animation_revision, MODULE_BASE_REVISIONS.animation);
assert.equal(state.bodyShape.schema, 'humanoid_rig/body_shape_state@1.0');
assert.equal(state.bodyShape.profiles.body_shape_001.muscle, 0.5);
assert.equal(state.bodyShape.skin_response.target, 'skin.vertex_positions');
assert.equal(state.faceSystem.schema, 'humanoid_rig/face_state@1.0');
assert.equal(state.faceSystem.active_face_id, 'face_001');
assert.equal(state.faceSystem.profiles.face_001.version, 1);
assert.equal(state.characterCore.profiles.character_001.face_identity.face_id, 'face_001');
assert.equal(state.characterCore.profiles.character_001.face_revision, 1);
assert.equal(state.clothingSystem.schema, 'humanoid_rig/clothing_state@1.0');
assert.equal(state.clothingSystem.profiles.clothing_profile_001.assets.length, 0);
assert.deepEqual(state.characterCore.profiles.character_001.clothing_attachments, []);
assert.equal(state.characterCore.profiles.character_001.clothing_revision, 1);
assert.equal(state.appearanceSystem.schema, 'humanoid_rig/appearance_state@1.0');
assert.equal(state.appearanceSystem.active_hair_id, null);
assert.deepEqual(state.characterCore.profiles.character_001.hair, { hair_id: null, revision: 0 });
assert.deepEqual(state.characterCore.profiles.character_001.accessory_attachments, []);
assert.equal(state.characterCore.profiles.character_001.accessory_revision, 1);
assert.equal(state.characterGenerator.schema, 'humanoid_rig/character_generator_state@1.0');
assert.equal(state.characterGenerator.active_session_id, null);
assert.deepEqual(state.characterGenerator.sessions, {});
assert.deepEqual(state.operationEvents, []);

const staleRebindFlag = normalizeProjectState({
  ...structuredClone(state),
  character: {
    ...structuredClone(state.character),
    bodyProfile: {
      ...structuredClone(state.character.bodyProfile),
      height: 2.1,
      requiresRebind: false,
    },
  },
});
assert.equal(staleRebindFlag.character.bodyProfile.requiresRebind, true);

for (const module of Object.values(state.modules)) {
  assert.ok(module.version.includes('@'));
  assert.ok(module.progress >= 0 && module.progress <= 100);
  assert.ok(module.currentTask.length > 3);
}

const migrated = normalizeProjectState({
  ...state,
  schemaVersion: 1,
  build: { version: '0.5.0', id: 'old-build' },
  activeVersions: {
    rig: 'rig@0.4.0', skin: 'skin@0.4.0', pose: 'pose@0.3.1', animation: 'anim@0.2.0', character: 'character@0.5.0',
  },
  moduleRevisions: { proportion: 1, skin: 1, pose: 1, animation: 1, integration: 1 },
  character: {
    ...state.character,
    bodyProfile: { ...state.character.bodyProfile, viewportMode: 'invalid', height: 99 },
    rigRules: undefined,
    skin: { source: 'base', fallbackAsset: 'old-procedural-surface' },
  },
});
assert.equal(migrated.schemaVersion, 11);
assert.equal(migrated.character.bodyProfile.height, 2.15);
assert.equal(migrated.character.bodyProfile.viewportMode, 'skeleton');
assert.equal(migrated.character.rigRules.lockBoneIds, true);
assert.equal(migrated.character.skin.source, 'detail');
assert.equal(migrated.character.skin.singleLayer, true);
assert.equal(migrated.character.skin.detailAsset, state.character.skin.detailAsset);
assert.equal(migrated.build.id, BUILD_ID);
assert.deepEqual(migrated.activeVersions, ACTIVE_VERSIONS);
assert.deepEqual(migrated.moduleRevisions, MODULE_BASE_REVISIONS);
assert.equal('fallbackAsset' in migrated.character.skin, false);

const html = await readFile(join(root, 'index.html'), 'utf8');
assert.match(html, /四个板块并行开发/);
assert.match(html, /dashboardPreview/);
assert.match(html, /character\.html/);
const characterHtml = await readFile(join(root, 'character.html'), 'utf8');
assert.match(characterHtml, /characterImageInput/);
assert.match(characterHtml, /analyzeCharacterButton/);
assert.match(characterHtml, /generateCharacterButton/);
assert.match(characterHtml, /saveCharacterVersionButton/);
assert.match(html, /openAllButton/);
assert.match(html, /V0\.5\.0|0\.5\.0/);
assert.match(html, /V8\.5/);
assert.match(html, /face\.html/);

const facePage = await readFile(join(root, 'face.html'), 'utf8');
assert.match(facePage, /faceParameterForm/);
assert.match(facePage, /Face Runtime Descriptor/);
assert.match(facePage, /FLAME/);

const studio = await readFile(join(root, 'studio.html'), 'utf8');
assert.match(studio, /moduleControls/);
assert.match(studio, /legacyFrame/);
assert.match(studio, /id="standardStage"[^>]*hidden/);
assert.match(studio, /publishDialog/);
assert.match(studio, /importModuleInput/);
assert.match(studio, /V8\.5/);

const styles = await readFile(join(root, 'styles.css'), 'utf8');
assert.match(styles, /\.standard-stage\[hidden\][\s\S]*display:\s*none\s*!important/);
assert.match(styles, /\.legacy-stage\[hidden\][\s\S]*display:\s*none\s*!important/);

const studioSource = await readFile(join(root, 'src/studio.js'), 'utf8');
assert.match(studioSource, /loadWorkspaceModule/);
assert.match(studioSource, /HumanoidRigModuleBundle/);
assert.match(studioSource, /HRL_HOST_STATE/);
assert.match(studioSource, /HRL_PREVIEW_BODY_PROFILE/);
assert.match(studioSource, /HRL_PROFILE_STATUS/);
assert.match(studioSource, /HRL_RENDERER_STATUS/);
assert.match(studioSource, /bodyProfile:\s*structuredClone/);
assert.match(studioSource, /elements\.standardStage\.hidden = true/);
assert.match(studioSource, /elements\.legacyStage\.hidden = false/);
assert.match(studioSource, /url\.searchParams\.set\('build', BUILD_ID\)/);
assert.match(studioSource, /skinBuild/);
assert.match(studioSource, /poseSnapshot: state\.character\.pose\.poseSnapshot/);
assert.ok(studioSource.split('\n').length < 500, 'Shared studio controller has grown back into a monolith.');

const proportionWorkspace = await readFile(join(root, 'src/modules/proportion/index.js'), 'utf8');
assert.match(proportionWorkspace, /三维比例预览/);
assert.match(proportionWorkspace, /三维骨架/);
assert.match(proportionWorkspace, /previewBodyProfile/);
assert.match(proportionWorkspace, /生成新绑定草案/);
assert.match(proportionWorkspace, /lockBoneIds/);
assert.match(proportionWorkspace, /lockBindPoseAfterPublish/);
assert.match(proportionWorkspace, /mirrorEditing/);
assert.match(proportionWorkspace, /thighLength/);
assert.match(proportionWorkspace, /lowerLegLength/);

const registrySource = await readFile(join(root, 'src/module-registry.js'), 'utf8');
for (const module of ['proportion', 'skin', 'pose', 'animation', 'clothing', 'integration']) {
  assert.match(registrySource, new RegExp(`modules/${module}/index\\.js`));
}

const hubSource = await readFile(join(root, 'src/project-hub.js'), 'utf8');
const workerSource = await readFile(join(root, 'workers/project-hub.shared.js'), 'utf8');
assert.match(hubSource, /project-state:v11/);
assert.match(hubSource, /project-state:v10/);
assert.match(hubSource, /project-state:v9/);
assert.match(hubSource, /project-state:v8/);
assert.match(hubSource, /project-state:v7/);
assert.match(hubSource, /project-state:v6/);
assert.match(hubSource, /project-hub:v11/);
assert.match(hubSource, /project-hub-v11/);
assert.match(hubSource, /saveCharacter/);
assert.match(hubSource, /updateCharacterReferences/);
assert.match(hubSource, /saveBodyShapeVersion/);
assert.match(hubSource, /restoreBodyShapeVersion/);
assert.match(hubSource, /createFaceIdentity/);
assert.match(hubSource, /saveFaceVersion/);
assert.match(hubSource, /restoreFaceVersion/);
assert.match(hubSource, /addClothingAsset/);
assert.match(hubSource, /removeClothingAsset/);
assert.match(hubSource, /saveClothingVersion/);
assert.match(hubSource, /restoreClothingVersion/);
assert.match(hubSource, /addHair/);
assert.match(hubSource, /switchHair/);
assert.match(hubSource, /addAccessory/);
assert.match(hubSource, /saveAppearanceVersion/);
assert.match(hubSource, /restoreAppearanceVersion/);
assert.match(hubSource, /changedModules/);
assert.match(hubSource, /rigRules/);
assert.match(hubSource, /MODULE_PATCH/);
assert.match(hubSource, /publishTransient/);
assert.match(hubSource, /humanoid_rig\/transient_bus@1\.0/);
assert.match(workerSource, /applyModulePatch/);
assert.match(workerSource, /MODULE_PATCH/);
assert.match(workerSource, /message\.type === 'TRANSIENT'/);

const legacyMainSource = await readFile(join(root, 'legacy/v8/src/main.js'), 'utf8');
const bodyProfileSource = await readFile(join(root, 'legacy/v8/src/body-profile.js'), 'utf8');
const presetSource = await readFile(join(root, 'legacy/v8/src/skeleton-presets.js'), 'utf8');
assert.match(legacyMainSource, /humanoid-skeleton-editor:v8\.5-performance-rig/);
assert.match(legacyMainSource, /HRL_PREVIEW_BODY_PROFILE/);
assert.match(legacyMainSource, /HRL_PROFILE_STATUS/);
assert.match(legacyMainSource, /applyHostBodyProfile/);
assert.match(legacyMainSource, /physicsRig\.applyPoseSnapshot/);
assert.match(legacyMainSource, /physicsRig\.buildPoseSnapshot/);
assert.match(legacyMainSource, /bodyProfileKey/);
assert.match(bodyProfileSource, /applyBodyProfileToDefinition/);
assert.match(bodyProfileSource, /measureBodyProfile/);
assert.match(bodyProfileSource, /fitCentralHeight/);
assert.match(bodyProfileSource, /requiresSkinRebind/);
assert.match(presetSource, /schemaVersion:\s*7/);
assert.match(presetSource, /performance89@1/);
assert.match(presetSource, /createPerformanceExtensionJoints/);
assert.match(presetSource, /左锁骨控制点/);
assert.match(presetSource, /visualJoint:\s*false/);
assert.match(presetSource, /左肩关节/);

const bodyDnaSchema = JSON.parse(await readFile(join(root, 'schemas/body-dna-v5.schema.json'), 'utf8'));
const jointSemanticSchema = JSON.parse(await readFile(join(root, 'schemas/joint-semantic-profile-v5.schema.json'), 'utf8'));
const humanRigCoreSchema = JSON.parse(await readFile(join(root, 'schemas/human-rig-core-v5.schema.json'), 'utf8'));
const humanCoreStateSchema = JSON.parse(await readFile(join(root, 'schemas/human-core-state-v5.schema.json'), 'utf8'));
const massDistributionSchema = JSON.parse(await readFile(join(root, 'schemas/mass-distribution-model-v5.schema.json'), 'utf8'));
const muscleSemanticSchema = JSON.parse(await readFile(join(root, 'schemas/muscle-semantic-profile-v5.schema.json'), 'utf8'));
const humanBalanceSchema = JSON.parse(await readFile(join(root, 'schemas/human-balance-state-v5.schema.json'), 'utf8'));
const anatomySignalSchema = JSON.parse(await readFile(join(root, 'schemas/anatomy-deformation-signal-v5.schema.json'), 'utf8'));
const humanAnatomySchema = JSON.parse(await readFile(join(root, 'schemas/human-anatomy-state-v5.schema.json'), 'utf8'));
const bodyFieldDefinitionSchema = JSON.parse(await readFile(join(root, 'schemas/body-field-definition-v5.schema.json'), 'utf8'));
const proceduralSurfaceCacheSchema = JSON.parse(await readFile(join(root, 'schemas/procedural-surface-cache-metadata-v5.schema.json'), 'utf8'));
const regionDriverSchema = JSON.parse(await readFile(join(root, 'schemas/region-deformation-driver-frame-v5.schema.json'), 'utf8'));
const proceduralDeformFrameSchema = JSON.parse(await readFile(join(root, 'schemas/procedural-deform-frame-v5.schema.json'), 'utf8'));
const rendererAdapterInputSchema = JSON.parse(await readFile(join(root, 'schemas/renderer-adapter-input-v5.schema.json'), 'utf8'));
const humanCoreIndexSource = await readFile(join(root, 'src/modules/human-core-v5/index.js'), 'utf8');
assert.equal(bodyDnaSchema.$id, 'humanoid_rig/body_dna@5.0');
assert.equal(jointSemanticSchema.$id, 'humanoid_rig/joint_semantic_profile@5.0');
assert.equal(humanRigCoreSchema.$id, 'humanoid_rig/human_rig_core@5.0');
assert.equal(humanCoreStateSchema.$id, 'humanoid_rig/human_core_state@5.0');
assert.equal(massDistributionSchema.$id, 'humanoid_rig/mass_distribution_model@5.0');
assert.equal(muscleSemanticSchema.$id, 'humanoid_rig/muscle_semantic_profile@5.0');
assert.equal(humanBalanceSchema.$id, 'humanoid_rig/human_balance_state@5.0');
assert.equal(anatomySignalSchema.$id, 'humanoid_rig/anatomy_deformation_signal@5.0');
assert.equal(humanAnatomySchema.$id, 'humanoid_rig/human_anatomy_state@5.0');
assert.equal(bodyFieldDefinitionSchema.$id, 'humanoid_rig/body_field_definition@5.0');
assert.equal(proceduralSurfaceCacheSchema.$id, 'humanoid_rig/procedural_surface_cache_metadata@5.0');
assert.equal(regionDriverSchema.$id, 'humanoid_rig/region_deformation_driver_frame@5.0');
assert.equal(proceduralDeformFrameSchema.$id, 'humanoid_rig/procedural_deform_frame@5.0');
assert.equal(rendererAdapterInputSchema.$id, 'humanoid_rig/renderer_adapter_input@5.0');
assert.ok(humanCoreStateSchema.required.includes('anatomyState'));
assert.match(humanCoreIndexSource, /HumanCoreRuntime/);
assert.match(humanCoreIndexSource, /V4Adapter/);
assert.match(humanCoreIndexSource, /createBodyDNA/);
assert.match(humanCoreIndexSource, /HumanAnatomyRuntimeV5/);
assert.match(humanCoreIndexSource, /createMassDistributionModelV5/);
assert.match(humanCoreIndexSource, /AnatomyPoseEvaluatorV5/);
assert.match(humanCoreIndexSource, /procedural-deform/);

const javascriptFiles = [
  'server.mjs',
  'src/default-state.js', 'src/state-schema.js', 'src/module-registry.js', 'src/workspace-common.js',
  'src/project-hub.js', 'src/humanoid-preview.js', 'src/dashboard.js', 'src/studio.js',
  'src/modules/human-core-v5/core-utils.js',
  'src/modules/human-core-v5/body-dna-v5.js',
  'src/modules/human-core-v5/joint-semantic-profile-v5.js',
  'src/modules/human-core-v5/human-rig-core-v5.js',
  'src/modules/human-core-v5/human-core-state-v5.js',
  'src/modules/human-core-v5/mass-distribution-model-v5.js',
  'src/modules/human-core-v5/muscle-semantic-profile-v5.js',
  'src/modules/human-core-v5/human-balance-state-v5.js',
  'src/modules/human-core-v5/anatomy-deformation-signal-v5.js',
  'src/modules/human-core-v5/human-anatomy-state-v5.js',
  'src/modules/human-core-v5/anatomy-pose-evaluator-v5.js',
  'src/modules/human-core-v5/human-anatomy-runtime-v5.js',
  'src/modules/human-core-v5/v4-adapter.js',
  'src/modules/human-core-v5/human-core-runtime.js',
  'src/modules/human-core-v5/index.js',
  'src/modules/human-core-v5/procedural-deform/anatomical-field-primitives-v5.js',
  'src/modules/human-core-v5/procedural-deform/anatomical-field-composition-v5.js',
  'src/modules/human-core-v5/procedural-deform/body-field-definition-v5.js',
  'src/modules/human-core-v5/procedural-deform/body-field-compiler-v5.js',
  'src/modules/human-core-v5/procedural-deform/surface-region-binding-v5.js',
  'src/modules/human-core-v5/procedural-deform/surface-extractor-v5.js',
  'src/modules/human-core-v5/procedural-deform/region-deformation-driver-v5.js',
  'src/modules/human-core-v5/procedural-deform/procedural-deform-policy-v5.js',
  'src/modules/human-core-v5/procedural-deform/procedural-deform-frame-v5.js',
  'src/modules/human-core-v5/procedural-deform/procedural-deform-runtime-v5.js',
  'src/modules/human-core-v5/procedural-deform/procedural-surface-worker-client-v5.js',
  'src/modules/human-core-v5/procedural-deform/procedural-deform-validation-poses-v5.js',
  'src/modules/human-core-v5/procedural-deform/procedural-simulation-rig-fk-v5.js',
  'src/modules/human-core-v5/procedural-deform/index.js',
  'src/renderers/three/three-procedural-human-adapter-v5.js',
  'workers/procedural-surface.worker.js',
  'apps/human-core-v5-procedural-deform/index.js',
  'scripts/run-procedural-deform-browser-qa.mjs',
  'scripts/build-procedural-deform-qa-gallery.mjs',
  'tests/browser/human-core-v5-procedural-deform.browser.mjs',
  'packages/character-core/character-profile.js', 'packages/character-core/character-state.js',
  'packages/character-core/character-version.js', 'packages/character-core/character-manager.js',
  'packages/character-core/index.js',
  'packages/body-shape/body-shape-profile.js', 'packages/body-shape/body-shape-runtime.js',
  'packages/body-shape/body-shape-editor.js', 'packages/body-shape/index.js',
  'packages/face-system/face-profile.js', 'packages/face-system/face-runtime.js',
  'packages/face-system/face-editor.js', 'packages/face-system/face-expression.js',
  'packages/face-system/face-runtime-descriptor.js', 'packages/face-system/face-analysis-adapter.js',
  'packages/face-system/face-animation-layer.js',
  'packages/face-system/index.js',
  'packages/clothing-system/clothing-profile.js', 'packages/clothing-system/clothing-asset.js',
  'packages/clothing-system/clothing-runtime.js', 'packages/clothing-system/clothing-manager.js',
  'packages/clothing-system/index.js', 'src/modules/clothing/index.js',
  'packages/appearance-system/hair-profile.js', 'packages/appearance-system/accessory-profile.js',
  'packages/appearance-system/appearance-runtime.js', 'packages/appearance-system/index.js',
  'apps/character-generator/image-analysis.js', 'apps/character-generator/character-generator.js',
  'apps/character-generator/index.js', 'apps/character-generator/page.js',
  'src/face-editor-page.js',
  'apps/character-studio/index.js',
  ...moduleFiles,
  'workers/project-hub.shared.js',
  'legacy/v8/src/main.js', 'legacy/v8/src/body-profile.js', 'legacy/v8/src/skeleton-model.js',
  'legacy/v8/src/clothing-layer.js',
  'legacy/v8/src/skeleton-presets.js', 'legacy/v8/src/three-view.js', 'legacy/v8/src/svg-view.js',
];
for (const file of javascriptFiles) {
  const result = spawnSync(process.execPath, ['--check', join(root, file)], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${file} syntax failed: ${result.stderr}`);
}

const glbStats = await stat(join(root, 'legacy/v8/assets/smpl/smpl-male-surface.glb'));
const skinnedGlbStats = await stat(join(root, 'legacy/v8/assets/smpl/smpl-male-surface-skinned.glb'));
assert.ok(glbStats.size > 1_000_000, 'SMPL sample GLB is unexpectedly small');
assert.ok(skinnedGlbStats.size > 2_000_000, 'Pre-bound SMPL sample GLB is unexpectedly small');

const projectState = JSON.parse(await readFile(join(root, 'control/project-state.json'), 'utf8'));
assert.equal(projectState.schemaVersion, 11);
assert.equal(projectState.projectId, 'humanoid-rig-lab-next');
assert.equal(projectState.build.version, '0.5.0');
assert.equal(projectState.build.id, BUILD_ID);
assert.deepEqual(projectState.activeVersions, ACTIVE_VERSIONS);
assert.deepEqual(projectState.moduleRevisions, MODULE_BASE_REVISIONS);
assert.equal(projectState.character.bodyProfile.viewportMode, 'skeleton');
assert.equal(projectState.character.rigRules.lockBoneIds, true);
assert.equal(projectState.character.skin.source, 'detail');
assert.equal(projectState.character.skin.detailAsset, state.character.skin.detailAsset);
assert.equal(projectState.character.animation.schema, 'humanoid_rig/animation_session@0.4');
assert.equal(projectState.character.animation.clips.length, 7);
assert.equal(projectState.characterCore.active_character_id, 'character_001');
assert.equal(projectState.characterCore.profiles.character_001.body_shape_revision, 1);
assert.equal(projectState.characterCore.profiles.character_001.animation_revision, MODULE_BASE_REVISIONS.animation);
assert.equal(projectState.bodyShape.profiles.body_shape_001.waist_volume, 0.5);
assert.equal(projectState.bodyShape.skin_response.target, 'skin.vertex_positions');
assert.equal(projectState.faceSystem.active_face_id, 'face_001');
assert.equal(projectState.faceSystem.profiles.face_001.age, 30);
assert.equal(projectState.characterCore.profiles.character_001.face_identity.face_id, 'face_001');
assert.equal(projectState.characterCore.profiles.character_001.face_revision, 1);
assert.equal(projectState.clothingSystem.profiles.clothing_profile_001.assets.length, 0);
assert.deepEqual(projectState.characterCore.profiles.character_001.clothing_attachments, []);
assert.equal(projectState.characterCore.profiles.character_001.clothing_revision, 1);
assert.equal(projectState.appearanceSystem.schema, 'humanoid_rig/appearance_state@1.0');
assert.equal(projectState.appearanceSystem.active_hair_id, null);
assert.deepEqual(projectState.characterCore.profiles.character_001.hair, { hair_id: null, revision: 0 });
assert.deepEqual(projectState.characterCore.profiles.character_001.accessory_attachments, []);
assert.equal(projectState.characterCore.profiles.character_001.accessory_revision, 1);
assert.equal(projectState.characterGenerator.schema, 'humanoid_rig/character_generator_state@1.0');
assert.equal(projectState.characterGenerator.active_session_id, null);
assert.deepEqual(projectState.characterGenerator.sessions, {});
assert.deepEqual(projectState.operationEvents, []);

const workflow = await readFile(join(root, '.github/workflows/pages.yml'), 'utf8');
assert.match(workflow, /deploy-pages/);
assert.match(workflow, /upload-pages-artifact/);

const proceduralBrowserWorkflow = await readFile(join(root, '.github/workflows/procedural-deform-browser-qa.yml'), 'utf8');
assert.match(proceduralBrowserWorkflow, /node-version:\s*'22'/);
assert.match(proceduralBrowserWorkflow, /npm ci/);
assert.match(proceduralBrowserWorkflow, /playwright install chromium --with-deps/);
assert.match(proceduralBrowserWorkflow, /--backend webgl2 --headless --browser-channel chromium/);
assert.match(proceduralBrowserWorkflow, /--backend webgpu --headless --browser-channel chromium/);
assert.doesNotMatch(proceduralBrowserWorkflow, /continue-on-error:\s*true|--continue-on-webgpu-failure/);
assert.match(proceduralBrowserWorkflow, /actions:\s*read/);
assert.match(proceduralBrowserWorkflow, /9555667580/);
assert.match(proceduralBrowserWorkflow, /dbc8226ec33a56277bd766665e7f53abf756ecd9599783c924ce64ed1b7aefcd/);
assert.match(proceduralBrowserWorkflow, /if:\s*always\(\)/);
assert.doesNotMatch(proceduralBrowserWorkflow, /deploy-pages|gh-pages|contents:\s*write/);

const visualQABatch = await readFile(join(root, 'RUN_HUMAN_CORE_V5_VISUAL_QA.bat'), 'utf8');
assert.match(visualQABatch, /run-human-core-v5-visual-qa\.ps1/i);
assert.match(visualQABatch, /-Headed/);
assert.match(visualQABatch, /-KeepServer/);
assert.ok([...visualQABatch].every((character) => character.charCodeAt(0) < 128), 'RUN_HUMAN_CORE_V5_VISUAL_QA.bat must stay ASCII-only');

const visualQAPowerShell = await readFile(join(root, 'scripts/run-human-core-v5-visual-qa.ps1'), 'utf8');
for (const parameter of ['SkipInstall', 'BrowserChannel', 'Headed', 'OutputDirectory', 'KeepServer']) assert.match(visualQAPowerShell, new RegExp(`\\$${parameter}`));
assert.match(visualQAPowerShell, /Node 22 or newer/);
assert.match(visualQAPowerShell, /--all-backends/);
assert.match(visualQAPowerShell, /visual-review-gallery\.html/);

const entries = await readdir(root);
assert.ok(entries.includes('legacy'));

console.log(`PASS Humanoid Rig Lab Next ${BUILD_VERSION} build ${BUILD_ID}`);
console.log(`PASS ${required.length} required files`);
console.log('PASS schema v11, Character Core, BodyShape, Face Identity, Clothing, Appearance, Character Generator, Character Studio, Human Core V5 contracts, module state, and migration contract');
console.log('PASS primary 3D proportion stage and explicit 2D fallback separation');
console.log('PASS live body-profile bridge and exact 3D dimension feedback contract');
console.log('PASS module-scoped synchronization and rig-rule exchange contract');
console.log('PASS hidden clavicle controls and visible shoulder-joint semantics');
console.log('PASS JavaScript syntax checks');
console.log(`PASS SMPL reference GLB ${glbStats.size} bytes`);
console.log(`PASS pre-bound single-surface GLB ${skinnedGlbStats.size} bytes`);
console.log('PASS GitHub Pages workflow contract');
