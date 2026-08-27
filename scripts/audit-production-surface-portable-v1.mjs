import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reviewDirectory = resolve(root, 'artifacts/review/task16a-r2b-production-surface-v1');
const qaDirectory = resolve(root, 'artifacts/qa/task16a-r2b-production-surface-v1');
const standalonePath = resolve(reviewDirectory, 'production-surface-review-standalone.html');
const productionPath = resolve(root, 'assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface');
const referencePath = resolve(root, 'assets/human/canonical-reference-v1/makehuman-reference-neutral-static-v1.glb');

const [standalone, production, reference, manifestText] = await Promise.all([
  readFile(standalonePath, 'utf8'),
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

const checks = {
  htmlHasDoctype: /^<!doctype html>/i.test(standalone),
  noModuleScript: !/<script\b[^>]*\btype\s*=\s*["']module["']/i.test(standalone),
  noDynamicImport: !/\bimport\s*\(/.test(standalone),
  noExternalExecutableReferences: externalExecutableReferences.length === 0,
  cspDisablesConnect: /connect-src 'none'/.test(standalone),
  embeddedProductionHashMatches: sha256(embeddedProduction) === sha256(production),
  embeddedReferenceHashMatches: sha256(embeddedReference) === sha256(reference),
  manifestStandaloneHashMatches: manifest.standaloneSha256 === sha256(Buffer.from(standalone, 'utf8')),
  visibleErrorPanelImplemented: /class="error-panel"/.test(standalone) && /Load failed:/.test(standalone),
  fileProtocolUsesEmbeddedAssets: /embedded:humanoid-rig-production-neutral-v1\.hrlsurface/.test(standalone),
  frontSideMaterialsOnlyInRuntime: !/new THREE\.[A-Za-z]+Material\([^)]*side:\s*THREE\.DoubleSide/.test(standalone),
};
const report = {
  schema: 'humanoid_rig/task16a_r2b_portable_static_audit@1.0',
  standalonePath: 'artifacts/review/task16a-r2b-production-surface-v1/production-surface-review-standalone.html',
  standaloneSha256: sha256(Buffer.from(standalone, 'utf8')),
  standaloneBytes: Buffer.byteLength(standalone),
  embeddedProductionSha256: sha256(embeddedProduction),
  embeddedReferenceSha256: sha256(embeddedReference),
  externalExecutableReferences,
  checks,
  passed: Object.values(checks).every(Boolean),
  browserExecution: 'not-executed-by-agent',
  note: 'This static file audit does not claim rendered visual acceptance or observed browser console/network results.',
};
await writeFile(resolve(qaDirectory, 'portable-review-static-audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (!report.passed) throw new Error(`Portable static audit failed: ${JSON.stringify(checks)}`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
