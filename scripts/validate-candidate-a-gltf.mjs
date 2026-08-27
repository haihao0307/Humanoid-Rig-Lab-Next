import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const runtimeDir = path.resolve(process.argv[2] ?? 'G:/Three.js/NEW/task15a-validator-runtime');
const glbPath = path.resolve(process.argv[3] ?? 'assets/human/production-surface-v2/candidate-a/neutral-body-candidate-a.glb');
const outputPath = path.resolve(process.argv[4] ?? 'artifacts/qa/task15a-production-surface-v2/asset-validation.json');
const receiptPath = path.resolve('assets/human/production-surface-v2/candidate-a/ASSET_RECEIPT.json');
const requireFromRuntime = createRequire(path.join(runtimeDir, 'package.json'));
const validator = requireFromRuntime('gltf-validator');
const bytes = new Uint8Array(fs.readFileSync(glbPath));
const report = await validator.validateBytes(bytes, {
  uri: path.basename(glbPath),
  format: 'glb',
  maxIssues: 1000,
});
const result = {
  schema: 'humanoid_rig/task15a_asset_validation@1.0',
  validator: 'KhronosGroup/glTF-Validator npm',
  validatorVersion: validator.version?.() ?? '2.0.0-dev.3.10',
  glbPath: 'assets/human/production-surface-v2/candidate-a/neutral-body-candidate-a.glb',
  byteLength: bytes.byteLength,
  errors: report.issues.numErrors,
  warnings: report.issues.numWarnings,
  infos: report.issues.numInfos,
  hints: report.issues.numHints,
  messages: report.issues.messages,
  stats: report.info,
  passed: report.issues.numErrors === 0,
};
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
receipt.validatorResult = {
  status: result.passed ? 'PASS' : 'FAIL',
  validator: result.validator,
  version: result.validatorVersion,
  errors: result.errors,
  warnings: result.warnings,
  report: 'artifacts/qa/task15a-production-surface-v2/asset-validation.json',
};
fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
