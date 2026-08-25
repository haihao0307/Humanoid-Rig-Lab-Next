import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../human-core-v5-procedural-deform.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../../apps/human-core-v5-procedural-deform/index.js', import.meta.url), 'utf8');
const fixtures = await readFile(new URL('../../src/modules/human-core-v5/procedural-deform/procedural-deform-validation-poses-v5.js', import.meta.url), 'utf8');
const simulationRig = await readFile(new URL('../../src/modules/human-core-v5/procedural-deform/procedural-simulation-rig-fk-v5.js', import.meta.url), 'utf8');
const adapter = await readFile(new URL('../../src/renderers/three/three-procedural-human-adapter-v5.js', import.meta.url), 'utf8');
const workerClient = await readFile(new URL('../../src/modules/human-core-v5/procedural-deform/procedural-surface-worker-client-v5.js', import.meta.url), 'utf8');
const browserRunner = await readFile(new URL('../../scripts/run-procedural-deform-browser-qa.mjs', import.meta.url), 'utf8');
const combined = `${html}\n${app}\n${fixtures}`;

assert.match(html, /apps\/human-core-v5-procedural-deform\/index\.js/);
for (const label of [
  'Reference', 'Lean', 'Muscular', 'Heavy', 'Tall', 'Short', 'Asymmetric',
  'Procedural Surface', 'Region Ownership', 'Field Primitives',
  'a-pose', 't-pose', 'arm-raise-90-left', 'arm-raise-150-left', 'forearm-twist-180-left',
  'elbow-bend-140-left', 'hip-flex-left', 'knee-bend-left', 'squat', 'lunge-left',
  'Front', 'Back', 'Perspective', 'Fit',
]) assert.match(combined, new RegExp(label.replace(/[+]/g, '\\+')));
assert.doesNotMatch(`${html}\n${app}`, /GLTFLoader|smpl-male-surface|(?:src|href)=["'][^"']+\.glb/i, 'Procedural page must not request a human GLB.');
assert.doesNotMatch(app, /(?:import|fetch)\s*\([^)]*\.glb/i, 'Procedural app must not import or fetch a human GLB.');
assert.match(app, /WebGPURenderer/);
assert.match(app, /requestAdapter/);
assert.doesNotMatch(app, /requestDevice/, 'Only Three.js WebGPURenderer may create the production GPUDevice.');
assert.match(app, /renderer-owned-pass/);
assert.match(app, /ChunkedProceduralHumanAdapterV5/);
assert.match(app, /measureSteadyStatePerformance/);
assert.match(app, /AUXILIARY_PREVIEW_CAPACITIES/);
assert.match(app, /createDynamicPositionPreview/);
assert.match(app, /updateDynamicPositionPreview/);
assert.match(app, /primitivePreviewPool/);
assert.match(app, /THREE\.DynamicDrawUsage/);
assert.match(app, /clearUpdateRanges/);
assert.match(app, /addUpdateRange/);
assert.match(app, /setDrawRange/);
assert.match(app, /runtimeGeometryDisposeCount:\s*0/);
assert.match(app, /semantic-fixed-capacity-no-runtime-reallocation/);
assert.doesNotMatch(app, /software-safe limit|AUXILIARY_PREVIEW_BUFFER_BYTE_LIMIT/, 'A device-loss error must not be reinterpreted as an arbitrary auxiliary-buffer size limit.');
assert.doesNotMatch(app, /disposeGroupChildren|\.geometry\?\.dispose\(\)|\.setFromPoints\(/, 'Live auxiliary previews must update stable renderer resources instead of disposing or replacing geometry.');
assert.match(app, /navigatorGPU:\s*Boolean\(navigator\.gpu\)/);
assert.match(app, /'navigator\.gpu':\s*rendererState\.navigatorGPU/);
assert.match(app, /getContext\('webgl2'/);
assert.match(app, /forceWebGL/);
assert.match(app, /createProceduralDeformValidationPoseV5/);
assert.match(app, /createProceduralSimulationRigFrameV5/);
assert.match(app, /resolveProceduralSimulationRigJointV5/);
assert.match(app, /compareProceduralRigSurfaceAnchorsV5/);
assert.match(app, /window\.__HRL_PROCEDURAL_DEFORM_QA__/);
assert.match(app, /data-qa-kind/);
for (const action of ['run-full-qa', 'capture-current-view', 'mark-pass', 'mark-fail', 'export-qa-json']) assert.match(html, new RegExp(`data-qa-action="${action}"`));
assert.match(html, /独立 SimulationRig FK/);
assert.match(html, /Procedural Region Anchor/);
assert.doesNotMatch(app, /function poseFixture|function axisAngle|q\(\s*\[\s*[01-]/, 'UI must not author hard-coded joint-axis quaternions.');
assert.match(fixtures, /twistAxisLocal/);
assert.match(fixtures, /bendAxisLocal/);
assert.match(fixtures, /sideAxisLocal/);
assert.match(fixtures, /wholeBodySolverV5:\s*false/);
assert.match(simulationRig, /V4Adapter\(T Pose RigDefinition\) forward kinematics/);
assert.doesNotMatch(simulationRig.split('export function compareProceduralRigSurfaceAnchorsV5')[0], /posedAnchor/, 'Independent SimulationRig FK cannot read procedural posed anchors.');
assert.match(app, /data-dna-path/);
assert.doesNotMatch(app, /input disabled/);
assert.match(adapter, /BufferGeometry/);
assert.match(adapter, /THREE\.FrontSide/);
assert.match(adapter, /THREE\.DynamicDrawUsage/);
assert.match(adapter, /addUpdateRange/);
assert.match(adapter, /ChunkedProceduralHumanAdapterV5/);
assert.doesNotMatch(adapter, /createBodyDNA|HumanCoreState|createPoseFrame/);
assert.match(adapter, /setAttribute\('color'/);
assert.match(workerClient, /\.\.\/\.\.\/\.\.\/\.\.\/workers\/procedural-surface\.worker\.js/);
assert.match(browserRunner, /from 'playwright'/);
assert.match(browserRunner, /page\.goto/);
assert.match(browserRunner, /page\.on\('console'/);
assert.match(browserRunner, /page\.on\('pageerror'/);
assert.match(browserRunner, /page\.on\('requestfailed'/);
assert.match(browserRunner, /page\.on\('response'/);
assert.match(browserRunner, /locator\('canvas'\)\.screenshot/);
assert.match(browserRunner, /foregroundPixelRatio/);
assert.match(browserRunner, /foregroundBoundingBoxAreaRatio/);
assert.match(browserRunner, /silhouetteFingerprint/);
assert.match(browserRunner, /perceptualHash/);
assert.match(browserRunner, /silhouetteIoU/);
assert.match(browserRunner, /0\.97/);
assert.match(browserRunner, /visual-review-gallery\.html/);
assert.match(browserRunner, /qa-manifest\.json/);
assert.match(browserRunner, /spawn\(process\.execPath, \['server\.mjs'\]/);
assert.match(browserRunner, /chromium\.launchServer/);
assert.match(browserRunner, /browserServer\.kill/);
assert.match(browserRunner, /withTimeout/);
assert.match(browserRunner, /Browser QA evidence summary/);
assert.match(browserRunner, /const pinnedChromium = \['chromium', 'Playwright Chromium', chromium\.executablePath\(\)\]/);
assert.match(browserRunner, /return \[pinnedChromium, \.\.\.\(process\.platform === 'win32' \? windows : unix\)\]/,
  'The pinned Playwright Chromium must precede a same-channel system Chromium candidate.');
for (const webgpuArgument of [
  '--enable-unsafe-webgpu',
  '--enable-unsafe-swiftshader',
  '--use-webgpu-adapter=swiftshader',
  '--use-gpu-in-tests',
  '--enable-dawn-features=allow_unsafe_apis',
  '--disable-dawn-features=use_dxc',
  '--enable-webgpu-developer-features',
]) assert.match(browserRunner, new RegExp(webgpuArgument.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(browserRunner, /launchArguments:\s*\[\.\.\.run\.launchArguments\]/);
assert.match(browserRunner, /consoleErrors/);
assert.match(browserRunner, /glbRequests/);
assert.doesNotMatch(browserRunner, /globalThis\.WebSocket|new WebSocket|class CDPClient/);
console.log('Human Core V5 Procedural Deform page contract: shared anatomical-axis fixtures, independent FK overlay, explicit WebGPU/WebGL2 diagnostics, QA actions, and pinned Playwright browser evidence automation passed file inspection.');
