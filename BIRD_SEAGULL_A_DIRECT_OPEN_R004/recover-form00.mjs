import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';

const sourcePath = path.resolve('BIRD_SEAGULL_A_DIRECT_OPEN_R003/data/form-00.js');
const reportPath = path.resolve('artifacts/bird-seagull-a-r004-browser-qa/form-00-recovery.json');
const expectedSha256 = '043fd8fdd7e058527d70ece00996e62ee9adafcdb91b9a6c6837f207bbfa1053';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

await fs.mkdir(path.dirname(reportPath), { recursive: true });
const source = await fs.readFile(sourcePath);
const actualSha256 = crypto.createHash('sha256').update(source).digest('hex');
const prefix = Buffer.from("window.__BIRD_FORM=(window.__BIRD_FORM||'')+'");
const suffix = Buffer.from("';\n");

if (!source.subarray(0, prefix.length).equals(prefix)) {
  throw new Error('form-00.js 前缀不符合预期，停止自动恢复');
}
if (!source.subarray(source.length - suffix.length).equals(suffix)) {
  throw new Error('form-00.js 后缀不符合预期，停止自动恢复');
}

const payloadStart = prefix.length;
const payloadEnd = source.length - suffix.length;
const payloadLength = payloadEnd - payloadStart;
const expectedFileBytes = 8048;
const report = {
  sourcePath,
  sourceBytes: source.length,
  expectedFileBytes,
  payloadLength,
  expectedPayloadLength: 8000,
  actualSha256,
  expectedSha256,
  recovered: false,
  positionInFile: null,
  positionInPayload: null,
  insertedCharacter: null
};

if (actualSha256 === expectedSha256) {
  report.recovered = true;
  report.note = '源文件已经与权威清单一致，无需恢复。';
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

if (source.length !== expectedFileBytes - 1 || payloadLength !== 7999) {
  report.note = '源文件并非恰好缺少一个字节，自动单字符恢复不适用。';
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

const likelyPositions = [payloadEnd, payloadStart, payloadEnd - 1];
const remainingPositions = [];
for (let position = payloadStart; position <= payloadEnd; position++) {
  if (!likelyPositions.includes(position)) remainingPositions.push(position);
}
const positions = [...likelyPositions, ...remainingPositions];

for (const position of positions) {
  const candidate = Buffer.allocUnsafe(source.length + 1);
  source.copy(candidate, 0, 0, position);
  source.copy(candidate, position + 1, position);
  for (const character of alphabet) {
    candidate[position] = character.charCodeAt(0);
    const digest = crypto.createHash('sha256').update(candidate).digest('hex');
    if (digest === expectedSha256) {
      await fs.writeFile(sourcePath, candidate);
      report.recovered = true;
      report.positionInFile = position;
      report.positionInPayload = position - payloadStart;
      report.insertedCharacter = character;
      report.repairedSha256 = digest;
      report.repairedBytes = candidate.length;
      report.note = '已按权威 SHA-256 精确恢复缺失的一个 Base64 字符，并写回 Actions 临时检出目录。';
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    }
  }
}

report.note = '在标准 Base64 字符集中没有找到能匹配权威 SHA-256 的单字符插入。';
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(1);
