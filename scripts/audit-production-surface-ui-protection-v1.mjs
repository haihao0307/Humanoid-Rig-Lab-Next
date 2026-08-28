import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetPath = resolve(root, 'assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface');
const outputPath = resolve(root, 'artifacts/qa/task16a-r2b-production-surface-v1/responsive-ui-protected-content-audit.json');
const bytes = await readFile(assetPath);
if (bytes.subarray(0, 8).toString('utf8') !== 'HRLSURF1') throw new Error('Unexpected HRLSurface magic.');
const jsonLength = bytes.readUInt32LE(8); const dataOffset = bytes.readUInt32LE(12);
const header = JSON.parse(bytes.subarray(16, 16 + jsonLength).toString('utf8'));
const chunkHash = (name) => {
  const descriptor = header.chunks[name];
  return sha256(bytes.subarray(dataOffset + descriptor.byteOffset, dataOffset + descriptor.byteOffset + descriptor.byteLength));
};
const actual = {
  assetSha256: sha256(bytes),
  positionSha256: chunkHash('basePositions'), normalSha256: chunkHash('baseNormals'), indexSha256: chunkHash('indices'),
  symmetryPartnerSha256: chunkHash('symmetryPartner'), parameterBasisSha256: chunkHash('parameterBasis'),
  topologyFingerprint: header.topology.topologyFingerprint,
  leftVertexCount: header.chunks.leftVertexIndices.count, rightVertexCount: header.chunks.rightVertexIndices.count, centerVertexCount: header.chunks.centerVertexIndices.count,
  runtimeMirrorOperationCount: header.topology.runtimeMirrorOperationCount, negativeScaleNodeCount: header.topology.negativeScaleNodeCount, mirroredHalfMeshCount: header.topology.mirroredHalfMeshCount,
};
const expected = {
  assetSha256: 'DBB6D59E7D0D3F15C5350905C86340B9DA0D07D32880752CD3C3A8DF79B3BA68',
  positionSha256: '37085BB773E58C8CF040DB11FF7B07E0D8228D11E6DC34C18B65AB8A089FD3DA',
  normalSha256: 'B8D6906CCFDB9F89173111505B35C7578B77AC5752778E8A3C15003A6F786A40',
  indexSha256: '9DF6A9E20CEEF14A97697F53E7D691FF236FC25681F85A0E35A7F4B2B0CC8AF8',
  symmetryPartnerSha256: 'D2EF592655C657397186142F478418C86481105A90A7F6663AD75F186B9C0D07',
  parameterBasisSha256: 'D322592B76B01DEDEC8A083545F72E0EB6152470876109C7B64CBDDE3AA8B7F5',
  topologyFingerprint: '9DF6A9E20CEEF14A97697F53E7D691FF236FC25681F85A0E35A7F4B2B0CC8AF8',
  leftVertexCount: 8098, rightVertexCount: 8098, centerVertexCount: 188,
  runtimeMirrorOperationCount: 0, negativeScaleNodeCount: 0, mirroredHalfMeshCount: 0,
};
const checks = Object.fromEntries(Object.keys(expected).map((key) => [`${key}Unchanged`, actual[key] === expected[key]]));
const report = {
  schema: 'humanoid_rig/task16a_r2b_responsive_ui_protected_content_audit@1.0',
  method: 'read-only SHA-256 and container metadata comparison against the pre-responsive-UI baseline',
  assetPath: 'assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface',
  actual, expected, checks,
  allProtectedContentUnchanged: Object.values(checks).every(Boolean),
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (!report.allProtectedContentUnchanged) throw new Error(`Protected content changed: ${JSON.stringify(checks)}`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

function sha256(value) { return createHash('sha256').update(value).digest('hex').toUpperCase(); }
