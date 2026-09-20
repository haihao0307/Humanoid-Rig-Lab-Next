import {readFileSync,writeFileSync} from 'node:fs';

const replaceOnce=(source,from,to,label)=>{
  const at=source.indexOf(from);
  if(at<0)throw Error('R25C role-scope anchor missing: '+label);
  if(source.indexOf(from,at+from.length)>=0)throw Error('R25C role-scope anchor not unique: '+label);
  return source.slice(0,at)+to+source.slice(at+from.length);
};

const skinPath='body/SkinAppearance.js';
let skin=readFileSync(skinPath,'utf8');
const replacements=[
 ["redness:0,roughness:.52","redness:.13,roughness:.52",'scene default redness'],
 ["baseColor:'#e2c4b6',undertone:-.10,redness:0","baseColor:'#e2c4b6',undertone:-.10,redness:.16",'light cool'],
 ["baseColor:'#e2c3aa',undertone:.02,redness:0","baseColor:'#e2c3aa',undertone:.02,redness:.13",'light neutral'],
 ["baseColor:'#e1be9a',undertone:.12,redness:0","baseColor:'#e1be9a',undertone:.12,redness:.12",'light golden'],
 ["baseColor:'#d6bea5',undertone:-.01,redness:0","baseColor:'#d6bea5',undertone:-.01,redness:.10",'light olive'],
 ["baseColor:'#cfaa96',undertone:-.10,redness:0","baseColor:'#cfaa96',undertone:-.10,redness:.16",'medium cool'],
 ["baseColor:'#d0ac91',undertone:.02,redness:0","baseColor:'#d0ac91',undertone:.02,redness:.13",'medium neutral'],
 ["baseColor:'#d0a57f',undertone:.12,redness:0","baseColor:'#d0a57f',undertone:.12,redness:.12",'medium golden'],
 ["baseColor:'#c3a88c',undertone:-.01,redness:0","baseColor:'#c3a88c',undertone:-.01,redness:.09",'medium olive'],
 ["baseColor:'#b78c76',undertone:-.08,redness:0","baseColor:'#b78c76',undertone:-.08,redness:.15",'deeper cool'],
 ["baseColor:'#b58e70',undertone:.03,redness:0","baseColor:'#b58e70',undertone:.03,redness:.13",'deeper neutral'],
 ["baseColor:'#b58a65',undertone:.10,redness:0","baseColor:'#b58a65',undertone:.10,redness:.11",'deeper golden'],
 ["baseColor:'#aa8b6b',undertone:0,redness:0","baseColor:'#aa8b6b',undertone:0,redness:.09",'deeper olive'],
 ["redness:p.redness??0,seed","redness:p.redness??.15,seed",'preset fallback'],
 ["const redness=0;","const redness=palette==='east-asian'?blend('redness')+(random()-.5)*.07:.05+random()*.25;",'seeded skin redness'],
 ["undertone:0,redness:0,sunExposure:0","undertone:0,redness:.15,sunExposure:0",'legacy skin fallback']
];
for(const [from,to,label] of replacements){
  if(skin.includes(from))skin=replaceOnce(skin,from,to,label);
  else if(!skin.includes(to))throw Error('R25C role-scope replacement unresolved: '+label);
}
writeFileSync(skinPath,skin,'utf8');

const checkPath='tools/check-skin-appearance.mjs';
let check=readFileSync(checkPath,'utf8');
const oldNeutralCheck="check(defaults.redness===0&&eastAsian.every(p=>p.redness===0)&&/const redness=0;/.test(skin),'default and generated faces are neutral without authored cheek blush');";
const scopedNeutralCheck="check(defaults.redness>0&&eastAsian.every(p=>p.redness>0)&&/const redness=palette==='east-asian'/.test(skin),'reusable skin palettes retain bounded redness variation');\n check(/function initialCharacterPreset\\(\\).*redness:0/.test(character),'current face mother disables redness in its own character recipe');";
if(check.includes(oldNeutralCheck))check=replaceOnce(check,oldNeutralCheck,scopedNeutralCheck,'skin source contract');
else if(!check.includes('current face mother disables redness'))throw Error('R25C skin source contract unresolved');
const oldLegacy="/baseColor:skinLinearToHex\\(appearance\\.skinColor\\),undertone:0,redness:0/.test(skin)";
const restoredLegacy="/baseColor:skinLinearToHex\\(appearance\\.skinColor\\),undertone:0,redness:\\.15/.test(skin)";
if(check.includes(oldLegacy))check=replaceOnce(check,oldLegacy,restoredLegacy,'legacy tint contract');
else if(!check.includes(restoredLegacy))throw Error('R25C legacy tint contract unresolved');
writeFileSync(checkPath,check,'utf8');

const docPath='docs/face-knowledge/R25C_CLEAN_SHAVEN_NEUTRAL_SKIN_20260920.md';
writeFileSync(docPath,`# R25C：当前角色无胡须与中性面部肤色

日期：2026-09-20  
分支：\`feature/face-features-r25-20260919\`

## 实施

- 当前面部母体不再把 \`faceBeard\` 网格加入生成结果；胡须生成函数仍保留，后续可作为明确角色选项重新接入。
- 当前默认角色的皮肤配方明确写入 \`redness: 0\`，去掉该角色面颊和耳部的作者设定红晕。
- 通用皮肤默认、东亚场景肤色预设、按种子生成的其他角色仍保留有界的 \`redness\` 变化；本轮没有删除皮肤系统的红润能力。
- 鼻形、唇高、眼部 R25B 曲面族、骨架、动作与任务接口未修改。

## 边界

这次修改针对当前角色，不把“无红晕”错误扩展成所有人物都没有血色变化。正常受光明暗、散射和基础肤色仍由皮肤材质负责；不会通过改底色掩盖面部几何问题。

## 验收

- 当前生产面部报告的胡须 strands 必须为 0；当前生成网格列表不得包含 \`faceBeard\`。
- 当前默认角色配方的 \`redness\` 必须为 0。
- 其他皮肤预设仍可保存和生成非零 \`redness\`，证明角色数据与通用材质能力没有混在一起。
- 文件、生成器数值检查和真实浏览器 WebGL 检查分别记录；截图只作为运行证据，不等于整脸达到 3A。

## 真实三维门禁

- [x] 没有用生成图片代替真实三维实现；
- [x] 已实际修改生产源码；
- [ ] 用户看到的是可交互三维工作台：等待本轮浏览器构建与截图复查；
- [x] 人物几何、骨骼和动作仍来自真实运行时；
- [ ] 镜头与参数控制已在本轮新构建中操作：等待浏览器复查；
- [ ] 公网固定链接已验证：本轮未建立；
- [x] 只有截图而没有工作台判定失败：截图仅来自真实工作台 QA。
`,'utf8');

console.log(JSON.stringify({applied:true,currentCharacter:{beardDensity:0,redness:0},globalSkinPalettePreserved:true}));
