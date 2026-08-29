import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const app=resolve(root,'apps/human-core-v5-layered-articulated-field-atlas-v1');
const asset=resolve(root,'assets/human/layered-articulated-field-atlas-v1');
const qa=resolve(root,'artifacts/qa/task18a-r2-layered-field-atlas-v1');
const review=resolve(root,'artifacts/review/task18a-r2-layered-field-atlas-v1');
await mkdir(review,{recursive:true});
const[css,js,atlasText,posesText,reportText,binary]=await Promise.all([
  readFile(resolve(app,'styles.css'),'utf8'),readFile(resolve(app,'index.js'),'utf8'),
  readFile(resolve(asset,'LAYERED_ARTICULATED_FIELD_ATLAS_V1.json'),'utf8'),readFile(resolve(asset,'TASK18A_R2_POSES_V1.json'),'utf8'),
  readFile(resolve(qa,'layered-field-round-2-report.json'),'utf8'),readFile(resolve(asset,'layered-articulated-field-atlas-v1.bin')),
]);
const boot={atlas:JSON.parse(atlasText),poseStates:JSON.parse(posesText),roundReport:JSON.parse(reportText),binaryBase64:binary.toString('base64')};
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';"><title>HRL Layered Articulated Field Atlas V1</title><style>${css}</style></head><body><main class="shell"><aside class="panel"><h1>Layered Articulated Human Field Atlas V1</h1><p>17 local SDF charts · 17 explicit junction fields · multi-sheet contact. <span class="warning">Visual acceptance pending.</span></p><div class="control"><label for="pose">Pose</label><select id="pose"></select></div><div class="control"><label for="mode">Mode</label><select id="mode"></select></div><div id="metrics" class="metrics"></div></aside><section class="stage"><canvas></canvas><div class="badge"><span class="ok">WebGL2 local-field renderer</span> · no human mesh · no global inverse warp</div></section></main><script>window.__HRL_LAYERED_ATLAS_BOOTSTRAP__=${JSON.stringify(boot)};</script><script>${js}</script></body></html>`;
await Promise.all([
  writeFile(resolve(root,'human-core-v5-layered-articulated-field-atlas-v1.html'),html,'utf8'),
  writeFile(resolve(review,'layered-articulated-field-atlas-review-standalone.html'),html,'utf8'),
  writeFile(resolve(review,'OPEN_LAYERED_FIELD_ATLAS_REVIEW.cmd'),'@echo off\r\nstart "" "%~dp0layered-articulated-field-atlas-review-standalone.html"\r\n','utf8'),
  writeFile(resolve(review,'README_请先打开.txt'),'请双击 OPEN_LAYERED_FIELD_ATLAS_REVIEW.cmd。\r\n视觉验收由用户执行；当前所有 acceptance 标志保持 false/pending。\r\n','utf8'),
]);
process.stdout.write(`${JSON.stringify({rootPage:'human-core-v5-layered-articulated-field-atlas-v1.html',standalone:'artifacts/review/task18a-r2-layered-field-atlas-v1/layered-articulated-field-atlas-review-standalone.html',bytes:Buffer.byteLength(html)},null,2)}\n`);
