import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  assertCanonicalReferenceStaticStructureV1,
  compareCanonicalReferenceFidelityV1,
  extractCanonicalReferenceStaticDataV1,
  findCanonicalReferenceBodyV1,
  measureCanonicalReferenceGeometryV1,
  parseCanonicalReferenceGlbV1,
} from '../src/modules/human-core-v5/canonical-reference-v1/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRelative = 'assets/human/production-surface-v2/candidate-a/neutral-body-candidate-a.glb';
const canonicalRelative = 'assets/human/canonical-reference-v1/makehuman-reference-neutral-static-v1.glb';
const artifactDirectory = resolve(root, 'artifacts/qa/task16a-r2a-canonical-reference-v1');
const sourceBytes = await readFile(resolve(root, sourceRelative));
const canonicalBytes = await readFile(resolve(root, canonicalRelative));
const sourceParsed = parseCanonicalReferenceGlbV1(sourceBytes, { assetPath: sourceRelative });
const canonicalParsed = parseCanonicalReferenceGlbV1(canonicalBytes, { assetPath: canonicalRelative });
assertCanonicalReferenceStaticStructureV1(canonicalParsed.gltf);
const sourceData = await extractCanonicalReferenceStaticDataV1(sourceParsed, findCanonicalReferenceBodyV1(sourceParsed));
const canonicalData = await extractCanonicalReferenceStaticDataV1(canonicalParsed, findCanonicalReferenceBodyV1(canonicalParsed));
const fidelity = compareCanonicalReferenceFidelityV1(sourceData, canonicalData);
const report = {
  ...fidelity,
  sourceAssetPath: sourceRelative,
  sourceAssetSha256: sha256(sourceBytes),
  canonicalAssetPath: canonicalRelative,
  canonicalAssetSha256: sha256(canonicalBytes),
  conclusion: fidelity.passed ? 'EXACT_STATIC_COPY' : 'REFERENCE_GEOMETRY_COPY_MISMATCH',
};
await writeJson(resolve(artifactDirectory, 'source-geometry-metrics.json'), measureCanonicalReferenceGeometryV1(sourceData));
await writeJson(resolve(artifactDirectory, 'canonical-geometry-metrics.json'), measureCanonicalReferenceGeometryV1(canonicalData));
await writeJson(resolve(artifactDirectory, 'geometry-fidelity.json'), report);
await writeJson(resolve(root, 'assets/human/canonical-reference-v1/REFERENCE_GEOMETRY_FIDELITY.json'), report);
let browserReport = null;
let sourceVisualReview = null;
try { browserReport = JSON.parse(await readFile(resolve(artifactDirectory, 'browser-report.json'), 'utf8')); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
try { sourceVisualReview = JSON.parse(await readFile(resolve(artifactDirectory, 'source-visual-review.json'), 'utf8')); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
if (browserReport) {
  await writeJson(resolve(artifactDirectory, 'metrics.json'), {
    schema: 'humanoid_rig/task16a_r2a_metrics@1.0',
    sourceIntegrityPath: 'artifacts/qa/task16a-r2a-canonical-reference-v1/source-integrity.json',
    sourceGeometryMetricsPath: 'artifacts/qa/task16a-r2a-canonical-reference-v1/source-geometry-metrics.json',
    canonicalGeometryMetricsPath: 'artifacts/qa/task16a-r2a-canonical-reference-v1/canonical-geometry-metrics.json',
    geometryFidelityPath: 'artifacts/qa/task16a-r2a-canonical-reference-v1/geometry-fidelity.json',
    browserReportPath: 'artifacts/qa/task16a-r2a-canonical-reference-v1/browser-report.json',
    sourceVisualReview,
    geometryFidelity: report,
    diagnostic: {
      sourceGeometryNormal: browserReport.sourceGeometryNormal,
      canonicalCopyNormal: browserReport.canonicalCopyNormal,
      boundRuntimeDistorted: browserReport.boundRuntimeDistorted,
      evidence: browserReport.boundRuntimeDistortionEvidence,
    },
    browserGate: {
      consoleErrors: browserReport.consoleErrors,
      pageErrors: browserReport.pageErrors,
      failedRequests: browserReport.failedRequests,
      externalHumanAssetRequests: browserReport.externalHumanAssetRequests,
      loadedHumanAssetPaths: browserReport.loadedHumanAssetPaths,
    },
    visualAcceptance: false,
    productionReady: false,
    userVisualAcceptance: 'pending',
    finalConclusion: report.passed && browserReport.finalConclusion === 'REFERENCE_MESH_EVIDENCE_READY_FOR_USER_REVIEW'
      ? 'REFERENCE_MESH_EVIDENCE_READY_FOR_USER_REVIEW'
      : 'BROWSER_EVIDENCE_INCONCLUSIVE',
  });
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!fidelity.passed) throw new Error('REFERENCE_GEOMETRY_COPY_MISMATCH');

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
async function writeJson(path, value) { await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
