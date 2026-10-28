'use strict';
// R34 keeps the previous body and routes supported A-rig poses through the
// existing skin-colour preview instead of the older grey-only pose display.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const source = file => fs.readFileSync(file, 'utf8');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const save = (file, data) => { fs.writeFileSync(file + '.building', data); fs.renameSync(file + '.building', file); };
const write = (file, data) => save(file, JSON.stringify(data, null, 2) + '\n');
const replaceOnce = (text, from, to) => {
  const parts = text.split(from);
  if (parts.length !== 2) throw Error('R34 build anchor missing or repeated: ' + from.slice(0, 100));
  return parts[0] + to + parts[1];
};
const escapeWorker = text => JSON.stringify(text).replace(/<\/script/gi, '<\\/script').slice(1, -1);
const previous = read('BUILD-R33.json');
const fixedBody = read('BUILD-SOURCE-R33.json');
const oldWorker = source('src/BodyImplicitWorkerR31.js');
const newWorker = source('src/BodyImplicitWorkerR34.js');
let html = source(previous.file);
html = replaceOnce(html, escapeWorker(oldWorker), escapeWorker(newWorker));
html = replaceOnce(html, "kind==='dynamic-body-p1'?(precisionState?.lastError?'身体更新失败，上一人物已保留。':'身体、四肢与颈口已联动。'):kind==='pose-functions'?'身体动作已联动。'", "kind==='dynamic-body-p1'?(precisionState?.lastError?'身体更新失败，上一人物已保留。':'身体和姿势已更新；目前为肤色预览，完整皮肤调节及动态阴影尚未接入。'):kind==='pose-functions'?'当前为姿势结构观察，皮肤效果尚未接入。'");
html = replaceOnce(html, "sourceMaterialMode:childType==='dynamic-body-p1'&&appearance.diagnostic==='source-light'?'source-environment-no-shadow':childType==='pose-functions'||childType==='dynamic-body-p1'?'structure-light'", "sourceMaterialMode:childType==='dynamic-body-p1'&&appearance.diagnostic==='source-light'?'source-environment-no-shadow':childType==='dynamic-body-p1'&&!['geometry','normals'].includes(appearance.diagnostic)?'source-skin-inspection':childType==='pose-functions'||childType==='dynamic-body-p1'?'structure-light'");
html = replaceOnce(html, '<h2>动作观察</h2>', '<h2>动作观察</h2><p class="small">下方按钮切换静态姿势，连续播放动作尚未接入；骨架 B 的可用动作目前有限。</p>');
html = replaceOnce(html, '<p class="note">修改数值后统一应用，保留局部与动作的完整调整能力。</p>', '<p class="note">修改后统一应用。当前可连续调整六项常用体型和已接入的局部参数；性别、年龄及部分组合尚未接入，尝试时会保留当前人物。</p>');
html = replaceOnce(html, '这十组状态保留原形体和细节。下方连续体型与组合动作仍待完整校准；头颈边界是否同步会单独提示。', '部分预设状态可直接显示；其他体型和动作组合的支持仍在完善，头颈边界是否同步会单独提示。');
html = replaceOnce(html, "catalog.filter(isBody).length+' 项身体控制'", "catalog.filter(isBody).length+' 项身体参数记录（部分组合尚未接入）'");
html = html.replace('<title>人物身体 R33', '<title>人物身体 R34').replace('BODY STUDY / R33', 'BODY STUDY / R34');
const file = 'delivery/人物身体_R34_动作肤色预览.html';
save(file, html);
const addedNames = ['tools/build-r34.cjs', 'src/BodyImplicitWorkerR34.js', 'tools/build.cjs', 'tools/preview-body.cjs'];
const sources = previous.sources.filter(s => !addedNames.includes(s.file)).concat(addedNames.map(file => ({ file, sha256: hash(fs.readFileSync(file)) })));
const wb = { ...previous, file, version: 'R34', sha256: hash(Buffer.from(html)), bytes: Buffer.byteLength(html), builtUTC: new Date().toISOString(), stage: 'supported A-rig pose preview retains skin colour; capability limits shown in the workbench', sources, previousWorkbench: { file: previous.file, sha256: previous.sha256 }, posePreview: { supportedARigUsesSkinInspection: true, fixedStatesKeepOriginalMaterial: true, fullOriginalOptics: false, dynamicOriginalShadows: false, continuousAnimation: false } };
write('BUILD-R34.json', wb);
write('BUILD.json', { ...fixedBody, selectedVersion: 'R34', companionBuild: 'BUILD-R34.json', companionWorkbench: 'BUILD-R34.json', researchBuild: 'BUILD-POSE-R32.json', selection: 'R34 retains the R33 fixed body and routes compatible A-rig poses to the skin-colour preview; complete dynamic skin and animation remain unfinished.' });
save('delivery/index.html', '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=' + path.basename(file) + '"><title>身体三维工作页 R34</title><p><a href="' + path.basename(file) + '">打开身体三维工作页</a></p></html>\n');
console.log(JSON.stringify({ version: wb.version, file, sha256: wb.sha256, bytes: wb.bytes }));
