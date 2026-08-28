import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reviewDirectory = resolve(root, 'artifacts/review/task16a-r2b-production-surface-v1');
const qaDirectory = resolve(root, 'artifacts/qa/task16a-r2b-production-surface-v1');
const standalonePath = resolve(reviewDirectory, 'production-surface-review-standalone.html');
const rootEntryPath = resolve(root, 'human-core-v5-production-surface-v1.html');
const runtimePath = resolve(root, 'apps/human-core-v5-production-surface-v1/runtime.js');
const cameraSafetyPath = resolve(root, 'apps/human-core-v5-production-surface-v1/camera-safety-controller-v1.js');
const stylesPath = resolve(root, 'apps/human-core-v5-production-surface-v1/styles.css');
const productionPath = resolve(root, 'assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface');
const referencePath = resolve(root, 'assets/human/canonical-reference-v1/makehuman-reference-neutral-static-v1.glb');

const [standalone, rootEntry, cameraSafety, runtime, styles, production, reference, manifestText] = await Promise.all([
  readFile(standalonePath, 'utf8'),
  readFile(rootEntryPath, 'utf8'),
  readFile(cameraSafetyPath, 'utf8'),
  readFile(runtimePath, 'utf8'),
  readFile(stylesPath, 'utf8'),
  readFile(productionPath),
  readFile(referencePath),
  readFile(resolve(reviewDirectory, 'portable-review-manifest.json'), 'utf8'),
]);
const manifest = JSON.parse(manifestText);
const embeddedMatch = standalone.match(/__HRL_EMBEDDED_ASSETS__=\{production:("[A-Za-z0-9+/=]+"),reference:("[A-Za-z0-9+/=]+")\}/);
if (!embeddedMatch) throw new Error('Embedded HRLSurface and reference payloads were not found.');
const embeddedProduction = Buffer.from(JSON.parse(embeddedMatch[1]), 'base64');
const embeddedReference = Buffer.from(JSON.parse(embeddedMatch[2]), 'base64');
const externalExecutableReferences = [
  ...standalone.matchAll(/<(?:script|link|img)\b[^>]+(?:src|href)\s*=\s*["'](?!data:|#)([^"']+)/gi),
].map((match) => match[1]);
const rootExternalExecutableReferences = [
  ...rootEntry.matchAll(/<(?:script|link|img)\b[^>]+(?:src|href)\s*=\s*["'](?!data:|#)([^"']+)/gi),
].map((match) => match[1]);
const runtimeContext = {};
vm.runInNewContext(cameraSafety, runtimeContext, { filename: cameraSafetyPath });
vm.runInNewContext(runtime, runtimeContext, { filename: runtimePath });
const runtimeComputedProductionSha256 = runtimeContext.HRLProductionSurfaceApp.sha256Hex(production);
const implementation = `${cameraSafety}\n${runtime}`;

const checks = {
  htmlHasDoctype: /^<!doctype html>/i.test(standalone),
  noModuleScript: !/<script\b[^>]*\btype\s*=\s*["']module["']/i.test(standalone),
  noDynamicImport: !/\bimport\s*\(/.test(standalone),
  noFetchApi: !/\bfetch\s*\(/.test(standalone),
  noExternalExecutableReferences: externalExecutableReferences.length === 0,
  rootEntryNoExternalExecutableReferences: rootExternalExecutableReferences.length === 0,
  rootAndStandaloneByteIdentical: rootEntry === standalone && manifest.rootAndStandaloneByteIdentical === true,
  cspDisablesConnect: /connect-src 'none'/.test(standalone),
  embeddedProductionHashMatches: sha256(embeddedProduction) === sha256(production),
  embeddedReferenceHashMatches: sha256(embeddedReference) === sha256(reference),
  manifestStandaloneHashMatches: manifest.standaloneSha256 === sha256(Buffer.from(standalone, 'utf8')),
  visibleErrorPanelImplemented: /class="error-panel"/.test(standalone) && /errorCode:/.test(standalone) && /assetHashVerified:/.test(standalone),
  fileProtocolUsesEmbeddedAssets: /embedded:humanoid-rig-production-neutral-v1\.hrlsurface/.test(standalone),
  publicReviewStateImplemented: /__HRL_SURFACE_V1_REVIEW__/.test(standalone) && /__HRL_FULL_BILATERAL_SURFACE_V1__/.test(standalone),
  fullBilateralModesImplemented: ['production-full','production-wireframe','centerline','symmetry-map','symmetric-edit-test','asymmetric-edit-test','reference-compare','failed-mirror-compare'].every((mode) => standalone.includes(`value="${mode}"`)),
  noRuntimeGeometryReflection: !/(?:reflectX|scale\.x\s*=\s*-|scale\.set\s*\(\s*-|makeScale\s*\(\s*-)/.test(runtime),
  startupErrorCodesImplemented: ['WEBGL_CONTEXT_UNAVAILABLE','WEBGL_SHADER_COMPILE_FAILED','EMBEDDED_ASSET_DECODE_FAILED','EMBEDDED_ASSET_HASH_MISMATCH','SURFACE_TOPOLOGY_INVALID','CANVAS_RENDER_FAILED','UNKNOWN_STARTUP_FAILURE'].every((code) => standalone.includes(code)),
  noXmlHttpRequest: !/\bXMLHttpRequest\b/.test(standalone),
  noWorkerConstruction: !/\bnew\s+(?:Shared)?Worker\s*\(/.test(standalone),
  runtimeSha256MatchesProduction: runtimeComputedProductionSha256 === sha256(production),
  chineseOfflineInstructionsPresent: /完整双侧人体离线验收/.test(standalone) && /无需网络/.test(standalone),
  frontSideMaterialsOnlyInRuntime: !/new THREE\.[A-Za-z]+Material\([^)]*side:\s*THREE\.DoubleSide/.test(standalone),
  responsiveViewportObserverImplemented: /new ResizeObserver/.test(cameraSafety) && /resizeObserver\.observe\(this\.viewport\)/.test(cameraSafety),
  actualViewportRendererSizingImplemented: /renderer\.setSize\(width, height, false\)/.test(implementation) && /camera\.aspect\s*=\s*width\s*\/\s*height/.test(implementation),
  horizontalAndVerticalFovFitImplemented: /horizontalFov\s*=\s*2\s*\*\s*Math\.atan/.test(cameraSafety) && /verticalFov/.test(cameraSafety),
  responsivePanelModesImplemented: ['docked-right', 'overlay-right', 'drawer-bottom'].every((mode) => runtime.includes(mode)) && /min-width:\s*1280px/.test(styles) && /max-width:\s*799px/.test(styles),
  focusFullscreenAndHotkeysImplemented: ['data-focus', 'data-enter-fullscreen', 'data-exit-fullscreen', "=== 'f'", "=== 'h'", "=== 'r'", "=== 'Escape'"].every((token) => runtime.includes(token)),
  requiredLayoutMetricsImplemented: ['viewportWidth', 'viewportHeight', 'devicePixelRatio', 'panelMode', 'panelOpen', 'focusMode', 'fullscreen', 'cameraAspect', 'modelScreenBounds', 'headVisible', 'leftHandVisible', 'rightHandVisible', 'leftFootVisible', 'rightFootVisible', 'fullBodyFramed', 'safeMarginPassed'].every((token) => runtime.includes(token)),
  cameraSafetyControllerEmbedded: standalone.includes('CameraSafetyControllerV1') && standalone.includes('cameraSafetyMetrics'),
  cameraDistanceLimitsImplemented: /radius \* 1\.08/.test(cameraSafety) && /height \* 0\.48/.test(cameraSafety) && /radius \* 8/.test(cameraSafety),
  dynamicCameraClippingImplemented: /cameraDistanceToTarget - bodyRadius \* 1\.3/.test(cameraSafety) && /bodyRadius \* 12/.test(cameraSafety),
  cameraVisibilityRecoveryImplemented: /lastValidCameraState/.test(cameraSafety) && /相机状态已恢复/.test(cameraSafety),
  frontSidePreserved: !/THREE\.DoubleSide/.test(cameraSafety) && !/THREE\.DoubleSide/.test(runtime),
};
const report = {
  schema: 'humanoid_rig/task16a_r2b_portable_static_audit@1.0',
  standalonePath: 'artifacts/review/task16a-r2b-production-surface-v1/production-surface-review-standalone.html',
  standaloneSha256: sha256(Buffer.from(standalone, 'utf8')),
  standaloneBytes: Buffer.byteLength(standalone),
  rootEntryPath: 'human-core-v5-production-surface-v1.html',
  rootEntrySha256: sha256(Buffer.from(rootEntry, 'utf8')),
  rootEntryBytes: Buffer.byteLength(rootEntry),
  embeddedProductionSha256: sha256(embeddedProduction),
  embeddedReferenceSha256: sha256(embeddedReference),
  externalExecutableReferences,
  rootExternalExecutableReferences,
  runtimeComputedProductionSha256,
  checks,
  passed: Object.values(checks).every(Boolean),
  browserExecution: 'not executed in this reconstruction pass; repository instruction assigns computer interaction and visual inspection to the user',
  portableReviewPassed: false,
  rootFileEntryPassed: false,
  modelVisibleToUser: false,
  visualEvidenceComplete: false,
  note: 'This static file audit does not claim rendered visual acceptance or observed browser console/network results. Those gates remain inconclusive.',
};
await writeFile(resolve(qaDirectory, 'portable-review-static-audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (!report.passed) throw new Error(`Portable static audit failed: ${JSON.stringify(checks)}`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
