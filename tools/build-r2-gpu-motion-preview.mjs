import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { assemble } from './build-pure.mjs';

const outDir = 'experiments/r2-gpu-motion-preview-20261117';
const templatePath = join(outDir, 'template.html');
const { index: assembledIndex, body: assembledBody } = assemble();
const normalizedBody = assembledBody.replace(/\r\n/g, '\n');
const populationBranch = [
  " installNPCPopulation(window.HumanLab);",
  " await startupStage('population','正在从同一母体生成第二个人物');",
  " try{await window.HumanLab.population.installMotherPair();}catch(error){logMessage('母体复制体未生成：'+error.message);}",
  " await window.HumanLab.population.installReviewCast();"
].join('\n');
if (normalizedBody.split(populationBranch).length !== 2) {
  throw new Error('Formal R2 population startup anchor changed; refusing to build a six-character preview.');
}
const previewBody = normalizedBody.replace(populationBranch, [
  " installNPCPopulation(window.HumanLab);",
  " window.HumanLab.review={mode:'motion-preview',singleActor:true,populationSkipped:true,hairSkipped:false};",
  " logMessage('动作预览模式：保留正式 R2 当前人物与头发，跳过额外母体复制体和四个对照 NPC。');"
].join('\n'));
const bodyPayloadMatches = assembledIndex.match(/const BODY_PAYLOAD='[^']+';/g) || [];
if (bodyPayloadMatches.length !== 1) throw new Error('Expected exactly one formal R2 body payload in the entrypoint.');
const previewBodyPayload = gzipSync(Buffer.from(previewBody, 'utf8'), { level: 9, mtime: 0 }).toString('base64');
const appHtml = assembledIndex.replace(/const BODY_PAYLOAD='[^']+';/, `const BODY_PAYLOAD='${previewBodyPayload}';`);
if (!appHtml.includes('BODY_PAYLOAD') || !appHtml.includes('JarvisEmbodimentLab')) {
  throw new Error('The formal R2 application entrypoint is not the expected generated build.');
}
const sha256 = value => createHash('sha256').update(value).digest('hex');
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

const moduleSources = Object.create(null);
const visiting = new Set();
const visited = new Set();
function resolveImport(from, specifier) {
  const resolved = posix.normalize(posix.join(posix.dirname(from), specifier));
  if (!resolved.startsWith('reconstruction/')) throw new Error('Worker import escapes reconstruction/: ' + from + ' -> ' + specifier);
  return resolved;
}
function importSpecifiers(source) {
  const found = [];
  const pattern = /\bfrom\s*(['"])(\.{1,2}\/[^'"]+)\1|\bimport\s*(['"])(\.{1,2}\/[^'"]+)\3/g;
  for (const match of source.matchAll(pattern)) found.push(match[2] || match[4]);
  return found;
}
function visitModule(path) {
  if (visited.has(path)) return;
  if (visiting.has(path)) throw new Error('Circular worker module dependency: ' + path);
  visiting.add(path);
  const source = readFileSync(path, 'utf8');
  moduleSources[path] = source;
  for (const specifier of importSpecifiers(source)) visitModule(resolveImport(path, specifier));
  visiting.delete(path);
  visited.add(path);
}
visitModule('reconstruction/worker.mjs');

const workerPath = 'reconstruction/worker.mjs';
const workerSource = moduleSources[workerPath];
const fetchAnchor = "const url=new URL(file,import.meta.url);url.searchParams.set('v',data.revision||'1');";
const embeddedLoad = "const embedded=data.embeddedAssets?.[file];if(embedded){const bytes=embedded instanceof ArrayBuffer?embedded.slice(0):embedded.buffer.slice(embedded.byteOffset,embedded.byteOffset+embedded.byteLength);downloadedBytes+=bytes.byteLength;progress({group:'parameters',file,domain:1,total:1,downloadedBytes});return bytes;}const url=new URL(file,import.meta.url);url.searchParams.set('v',data.revision||'1');";
if (workerSource.split(fetchAnchor).length !== 2) throw new Error('Worker asset-loader anchor changed; refusing to build an incomplete standalone page.');
moduleSources[workerPath] = workerSource.replace(fetchAnchor, embeddedLoad);

const parameters = JSON.parse(readFileSync('reconstruction/parameters.json', 'utf8'));
const bodyNames = [
  'binding-schema.json', 'rig-reference.json', 'interfaces.chf.gz', 'normal-field.chf.gz',
  'body.chf.gz', 'left.chf.gz', 'detail.chf.gz', 'features.chf.gz', 'collar.chf.gz'
];
const hairNames = [
  'appearance.json', 'hair-rules-r2.json', 'hair-scalp-radius-r2.json',
  'hair-domains-r2.json', 'hair-presets.json', 'detail.chf.gz'
];
const allNames = [...new Set([...bodyNames, ...hairNames])];
const filePayload = Object.create(null);
const assetManifest = {};
for (const name of allNames) {
  const bytes = readFileSync(join('reconstruction', name));
  filePayload[name] = bytes.toString('base64');
  assetManifest[name] = { bytes: bytes.byteLength, sha256: sha256(bytes) };
}
for (const group of parameters.groups) {
  const actual = assetManifest[group.file];
  if (!actual || actual.bytes !== group.bytes || actual.sha256 !== group.sha256) {
    throw new Error('R2 parameter payload does not match parameters.json: ' + group.file);
  }
}
const rig = JSON.parse(readFileSync('reconstruction/rig-reference.json', 'utf8'));
const binding = JSON.parse(readFileSync('reconstruction/binding-schema.json', 'utf8'));
const jointCount = Object.keys(rig.nodes || {}).length;
if (jointCount !== 128) throw new Error('Expected the formal 128-joint R2 rig; found ' + jointCount + '.');
if (!binding.weightMethod?.includes('eight uint16 weights')) throw new Error('R2 eight-influence binding contract changed.');
const compactSource = readFileSync('body/CompactWorkbench.js', 'utf8');
if (!compactSource.includes('skinJointsExtra') || !compactSource.includes('COMPACT_INFLUENCES')) {
  throw new Error('Formal GPU skinning source is missing the second four-weight lane.');
}
if (!compactSource.includes('qr=vec4(0.),qd=vec4(0.)')) {
  throw new Error('Formal dual-quaternion skinning shader anchor changed.');
}

const modulesJson = JSON.stringify(moduleSources);
const assetsJson = JSON.stringify({ files: filePayload, body: bodyNames, hair: hairNames });
const appGzip = gzipSync(Buffer.from(appHtml, 'utf8'), { level: 9, mtime: 0 }).toString('base64');
const modulesGzip = gzipSync(Buffer.from(modulesJson, 'utf8'), { level: 9, mtime: 0 }).toString('base64');
const assetsGzip = gzipSync(Buffer.from(assetsJson, 'utf8'), { level: 9, mtime: 0 }).toString('base64');
const manifest = {
  schema: 'kaopu/r2-gpu-motion-preview-build@1',
  sourceCommit,
  rootIndexSHA256: sha256(Buffer.from(appHtml, 'utf8')),\n  baseSourceIndexSHA256: sha256(Buffer.from(assembledIndex, 'utf8')),\n  previewBodyRuntimeSHA256: sha256(Buffer.from(previewBody, 'utf8')),\n  previewMode: 'single actor; retain hair; skip mother-pair and four comparison NPCs',\n  populationActors: 1,
  jointCount,
  influenceCount: 8,
  skinning: 'GPU dual-quaternion skinning (DQS), two vec4 joint/weight lanes',
  actionRuntime: 'formal R2 MotionLab / JarvisEmbodimentLab command interface',
  actionExamples: ['walk', 'sit', 'lie', 'stand', 'wave', 'salute'],
  workerModules: Object.fromEntries(Object.entries(moduleSources).map(([path, source]) => [path, sha256(Buffer.from(source, 'utf8'))])),
  assets: assetManifest,
  assetPayloadBytes: Object.values(assetManifest).reduce((sum, item) => sum + item.bytes, 0),
  parameterOnlyGeometry: parameters.containsDisplayVertices === false && parameters.containsTriangleIndices === false,
  externalNetworkRequiredForBody: false,
  visualAcceptance: false,\n  browserSmokeRequired: true,
  knownBlocker: 'R7 shoulder/axilla posed-surface folding remains open; this preview does not certify production skin acceptance.',
  grayAtlasRetarget: 'Not included in this first preview. The 104-joint gray research candidate is not surface-bound to the 128-joint R2 rig.'
};
const manifestJson = JSON.stringify(manifest, null, 2);
const template = readFileSync(templatePath, 'utf8');
const replacements = {
  '__APP_GZIP_B64__': appGzip,
  '__MODULES_GZIP_B64__': modulesGzip,
  '__ASSETS_GZIP_B64__': assetsGzip,
  '__BUILD_MANIFEST_JSON__': JSON.stringify(manifest).replace(/</g, '\\u003c'),
  '__BUILD_LABEL__': sourceCommit.slice(0, 12)
};
let html = template;
for (const [token, value] of Object.entries(replacements)) {
  if (html.split(token).length !== 2) throw new Error('Standalone HTML template placeholder missing or duplicated: ' + token);
  html = html.replace(token, value);
}
if (Object.keys(replacements).some(token => html.includes(token))) throw new Error('Unexpanded standalone payload placeholder.');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), html);
writeFileSync(join(outDir, 'BUILD_MANIFEST.json'), manifestJson + '\n');
console.log(JSON.stringify({
  output: join(outDir, 'index.html'),
  outputBytes: Buffer.byteLength(html, 'utf8'),\n  previewBodyBytes: Buffer.byteLength(previewBody, 'utf8'),
  sourceCommit,
  workerModuleCount: Object.keys(moduleSources).length,
  jointCount,
  influenceCount: 8,
  parameterBytes: manifest.assetPayloadBytes,
  rootIndexSHA256: manifest.rootIndexSHA256,
  visualAcceptance: false
}, null, 2));
