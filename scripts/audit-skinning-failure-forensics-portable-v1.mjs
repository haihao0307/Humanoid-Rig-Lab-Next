import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reviewDirectory = resolve(root, 'artifacts/review/task16b-skinning-forensics-v1');
const qaDirectory = resolve(root, 'artifacts/qa/task16b-skinning-forensics-v1');
const screenshotDirectory = resolve(qaDirectory, 'screenshots');
const standalonePath = resolve(reviewDirectory, 'skinning-failure-forensics-standalone.html');
const rootEntryPath = resolve(root, 'human-core-v5-skinning-failure-forensics-v1.html');
const runtimePath = resolve(root, 'apps/human-core-v5-skinning-failure-forensics-v1/runtime.js');
const stylesPath = resolve(root, 'apps/human-core-v5-skinning-failure-forensics-v1/styles.css');
const cameraPath = resolve(root, 'apps/human-core-v5-production-surface-v1/camera-safety-controller-v1.js');
const [standalone, rootEntry, runtime, styles, camera, manifestText, screenshotText, screenshotFiles] = await Promise.all([
  readFile(standalonePath, 'utf8'), readFile(rootEntryPath, 'utf8'), readFile(runtimePath, 'utf8'), readFile(stylesPath, 'utf8'), readFile(cameraPath, 'utf8'),
  readFile(resolve(reviewDirectory, 'portable-review-manifest.json'), 'utf8'), readFile(resolve(screenshotDirectory, 'screenshot-manifest.json'), 'utf8'), readdir(screenshotDirectory),
]);
const manifest = JSON.parse(manifestText); const screenshotManifest = JSON.parse(screenshotText);
const externalReferences = [...standalone.matchAll(/<(?:script|link|img)\b[^>]+(?:src|href)\s*=\s*["'](?!data:|#)([^"']+)/gi)].map((match) => match[1]);
const runtimeContext = {}; vm.runInNewContext(camera, runtimeContext, { filename: cameraPath }); vm.runInNewContext(runtime, runtimeContext, { filename: runtimePath });
const requiredModes = ['skeleton-only', 'rig-axes', 'dominant-rigid', 'lbs4', 'lbs8', 'dqs8', 'hybrid', 'true-flip-map', 'legacy-flip-map', 'intersection-map', 'strain-map', 'weight-map', 'topology-wireframe'];
const requiredPoses = ['reference_a_pose', 'reference_t_pose', 'shoulder_abduction_30', 'elbow_flexion_90', 'hip_flexion_30', 'knee_flexion_90', 'spine_twist_30'];
const pngFiles = screenshotFiles.filter((name) => name.toLowerCase().endsWith('.png'));
const checks = {
  htmlHasDoctype: /^<!doctype html>/i.test(standalone),
  rootAndStandaloneByteIdentical: standalone === rootEntry && manifest.rootAndStandaloneByteIdentical === true,
  noModuleScript: !/<script\b[^>]*\btype\s*=\s*["']module["']/i.test(standalone),
  noDynamicImport: !/\bimport\s*\(/.test(standalone),
  noFetchApi: !/\bfetch\s*\(/.test(standalone),
  noXmlHttpRequest: !/\bXMLHttpRequest\b/.test(standalone),
  noWorkerConstruction: !/\bnew\s+(?:Shared)?Worker\s*\(/.test(standalone),
  noExternalExecutableReferences: externalReferences.length === 0,
  cspDisablesConnect: /connect-src 'none'/.test(standalone),
  manifestStandaloneHashMatches: manifest.standaloneSha256 === sha256(Buffer.from(standalone, 'utf8')),
  ordinaryRuntimeApiLoads: Boolean(runtimeContext.HRLSkinningFailureForensicsAppV1?.start),
  cameraSafetyApiLoads: Boolean(runtimeContext.HRLCameraSafetyControllerV1?.CameraSafetyControllerV1),
  allRequiredModesPresent: requiredModes.every((mode) => runtime.includes(`['${mode}',`)),
  allRequiredPosesPresent: requiredPoses.every((pose) => runtime.includes(`['${pose}',`)),
  triangleAndIntersectionSelectorsPresent: ['data-triangle', 'data-intersection'].every((token) => standalone.includes(token)),
  skeletonAndAxesImplemented: /buildSkeleton/.test(runtime) && /RigAxes/.test(runtime),
  topologyCrossSectionsImplemented: /rebuildTopology/.test(runtime) && /TopologyCrossSections/.test(runtime),
  sixModeComparisonBoardImplemented: /SixModeComparisonBoard/.test(runtime) && /rebuildComparisonBoard/.test(runtime) && /data-comparison-table/.test(runtime),
  cameraResizeObserverImplemented: /new ResizeObserver/.test(camera) && /resizeObserver\.observe\(this\.viewport\)/.test(camera),
  actualViewportSizingImplemented: /renderer\.setSize\(width, height, false\)/.test(camera) && /camera\.aspect\s*=\s*width\s*\/\s*height/.test(camera),
  frontSideOnly: /side:\s*THREE\.FrontSide/.test(runtime) && !/THREE\.DoubleSide/.test(runtime),
  frozenInputsDeclaredUnmodified: /\"inputsModified\":false/.test(standalone),
  screenshotManifestPending: screenshotManifest.status === 'pending-user-capture' && screenshotManifest.generatedScreenshotCount === 0,
  noFabricatedPngFiles: pngFiles.length === 0,
  visualGatesRemainClosed: /visualAcceptance:\s*false/.test(runtime) && /productionReady:\s*false/.test(runtime) && /userVisualAcceptance:\s*'pending'/.test(runtime),
};
const report = {
  schema: 'humanoid_rig/task16b_r2a_portable_static_audit@1.0',
  standalonePath: manifest.standalonePath, standaloneSha256: sha256(Buffer.from(standalone, 'utf8')), standaloneBytes: Buffer.byteLength(standalone),
  rootEntryPath: manifest.rootEntryPath, rootEntrySha256: sha256(Buffer.from(rootEntry, 'utf8')), rootEntryBytes: Buffer.byteLength(rootEntry),
  externalReferences, screenshotDirectoryFiles: screenshotFiles, generatedPngFiles: pngFiles, checks,
  passed: Object.values(checks).every(Boolean),
  browserExecution: 'not executed; repository instruction assigns computer interaction and visual inspection to the user',
  browserEvidenceStatus: 'pending-user-file-protocol-review', visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending',
  note: 'Static file audit only. It does not claim rendered model visibility, browser console cleanliness, or screenshot acceptance.',
};
await writeFile(resolve(qaDirectory, 'portable-forensics-static-audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (!report.passed) throw new Error(`Portable forensics static audit failed: ${JSON.stringify(checks)}`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
