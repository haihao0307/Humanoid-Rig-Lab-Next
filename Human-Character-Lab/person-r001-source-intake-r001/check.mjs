import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = name => fs.readFileSync(path.join(root, name));
const text = name => read(name).toString('utf8');
const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const manifest = JSON.parse(text('human-r001-reference-manifest.json'));

for (const [name, expected] of Object.entries(manifest.payloadSha256)) {
  assert.equal(sha256(read(name)), expected, `payload byte identity changed: ${name}`);
}

assert.equal(text('data-start.js'), "window.HUMAN_R001_PAYLOAD_B64='';\n");
let payloadBase64 = '';
for (let index = 0; index < 14; index++) {
  const name = `data-${String(index).padStart(2, '0')}.js`;
  const match = text(name).match(/^window\.HUMAN_R001_PAYLOAD_B64\+='([A-Za-z0-9+/=]+)';\n$/);
  assert(match, `invalid payload segment syntax: ${name}`);
  payloadBase64 += match[1];
}

const payload = JSON.parse(zlib.gunzipSync(Buffer.from(payloadBase64, 'base64')).toString('utf8'));
assert.equal(payload.schema, 'kaopu/human-reference-browser-payload@0.1');
assert.equal(payload.sourceSha256, manifest.source.sha256);
assert.equal(payload.sourceTriangles, 977244);
assert.equal(payload.parts.length, 31);
assert.deepEqual(payload.parts.map(part => part.id), Array.from({ length: 31 }, (_, i) => i));
assert.equal(payload.parts.reduce((sum, part) => sum + part.sourceTriangles, 0), 977244);
assert.equal(payload.parts.reduce((sum, part) => sum + part.triangles, 0), 8606);
assert.deepEqual(payload.parts.filter(part => part.shorts).map(part => part.id), [1, 2, 9]);
assert.deepEqual(payload.parts.filter(part => part.shorts).map(part => part.role), [
  'shorts-left',
  'shorts-right',
  'shorts-waist'
]);
assert.deepEqual(manifest.shortsRemoval.identifiedParts.map(part => part.role), [
  'shorts-left',
  'shorts-right',
  'shorts-waist'
]);

for (const part of payload.parts) {
  assert(Number.isInteger(part.vertices) && part.vertices > 0, `invalid vertex count: ${part.id}`);
  assert(Number.isInteger(part.triangles) && part.triangles > 0, `invalid triangle count: ${part.id}`);
  assert.equal(part.min.length, 3);
  assert.equal(part.max.length, 3);
  const raw = zlib.gunzipSync(Buffer.from(part.data, 'base64'));
  const expectedBytes = part.vertices * 3 * 2 + part.vertices * 3 + part.triangles * 3 * 2;
  assert.equal(raw.length, expectedBytes, `decoded byte count changed: part_${part.id}`);
}

const app = text('app.js');
const index = text('index.html');
assert(app.includes("shortsGroup.visible=mode==='original'"), 'shorts must stay disabled outside comparison mode');
assert(app.includes("applyMode('clean')"), 'shorts-removed view must be the default');
assert(app.includes('function createPatch()'), 'programmatic body gap patch is missing');
assert(app.includes("role:'procedural-neutral-pelvis-and-proximal-thigh'"), 'patch role contract is missing');
assert(index.includes('data-13.js'), 'last payload segment is not loaded');
assert(index.includes('短裤已去除'), 'shorts removal control is missing');
assert(index.includes('缺口诊断'), 'gap diagnosis control is missing');

assert.equal(manifest.shortsRemoval.sourceBodyUnderShortsComplete, false);
assert.equal(manifest.proceduralPatch.externalMeshCopiedIntoPatch, false);
assert.equal(manifest.status.fullProgrammaticCharacterReconstruction, false);
assert.equal(manifest.status.productionReady, false);

console.log(JSON.stringify({
  ok: true,
  sourceSha256: manifest.source.sha256,
  sourceParts: payload.parts.length,
  sourceTriangles: payload.sourceTriangles,
  browserTriangles: payload.parts.reduce((sum, part) => sum + part.triangles, 0),
  shortsParts: payload.parts.filter(part => part.shorts).map(part => part.id),
  proceduralPatch: true
}, null, 2));
