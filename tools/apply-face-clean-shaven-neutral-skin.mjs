import {readFileSync,writeFileSync} from 'node:fs';

const replaceOnce=(source,needle,replacement,label)=>{
  const at=source.indexOf(needle);
  if(at<0)throw Error('R25C anchor missing: '+label);
  if(source.indexOf(needle,at+needle.length)>=0)throw Error('R25C anchor not unique: '+label);
  return source.slice(0,at)+replacement+source.slice(at+needle.length);
};

const facePath='body/FaceAnatomy.js';
let face=readFileSync(facePath,'utf8');
const oldFace=`  const brows=compactCreateBrows(surface),beard=compactBeardGeometry(surface,{lipOutline:compactLipOutline,halfWidth:p.lips.halfWidth,centreX:p.lips.centreX});
  output.push(compactFaceGeneratedMesh('faceBrow',brows.positions,brows.normals,brows.indices,head,scale));
  output.push(compactFaceGeneratedMesh('faceBeard',beard.positions,beard.normals,beard.indices,head,scale));`;
const newFace=`  // R25C keeps the procedural beard generator available for later character
  // options, but the current face mother is explicitly clean-shaven.
  const brows=compactCreateBrows(surface),beard=compactBeardGeometry(surface,{lipOutline:compactLipOutline,halfWidth:p.lips.halfWidth,centreX:p.lips.centreX,density:0});
  output.push(compactFaceGeneratedMesh('faceBrow',brows.positions,brows.normals,brows.indices,head,scale));
  if(beard.report.strands)output.push(compactFaceGeneratedMesh('faceBeard',beard.positions,beard.normals,beard.indices,head,scale));`;
if(!face.includes("current face mother is explicitly clean-shaven")){
  face=replaceOnce(face,oldFace,newFace,'face beard output');
  writeFileSync(facePath,face,'utf8');
}

const characterPath='body/CharacterPresets.js';
let character=readFileSync(characterPath,'utf8');
if(!character.includes("redness:0}")){
  character=replaceOnce(character,
    "skin:{baseColor:'#c7a18d',roughness:.60,oil:.15,redness:.16}",
    "skin:{baseColor:'#c7a18d',roughness:.60,oil:.15,redness:0}",
    'initial character redness');
  writeFileSync(characterPath,character,'utf8');
}

const skinPath='body/SkinAppearance.js';
let skin=readFileSync(skinPath,'utf8');
if(!skin.includes("const SKIN_DEFAULT=Object.freeze({schema:SKIN_SCHEMA,baseColor:'#d0ac91',undertone:.02,redness:0")){
  skin=replaceOnce(skin,
    "const SKIN_DEFAULT=Object.freeze({schema:SKIN_SCHEMA,baseColor:'#d0ac91',undertone:.02,redness:.13",
    "const SKIN_DEFAULT=Object.freeze({schema:SKIN_SCHEMA,baseColor:'#d0ac91',undertone:.02,redness:0",
    'skin default redness');
  const start=skin.indexOf('const EAST_ASIAN_SKIN_PRESETS=Object.freeze(['),end=skin.indexOf(']);',start);
  if(start<0||end<start)throw Error('R25C skin palette block missing');
  const block=skin.slice(start,end).replace(/redness:\s*\.\d+/g,'redness:0');
  skin=skin.slice(0,start)+block+skin.slice(end);
  skin=replaceOnce(skin,'redness:p.redness??.15','redness:p.redness??0','skin preset redness fallback');
  const rednessLine=/ const redness=palette==='east-asian'\?blend\('redness'\)\+\(random\(\)-\.5\)\*\.07:\.05\+random\(\)\*\.25;/;
  if(!rednessLine.test(skin))throw Error('R25C seeded redness anchor missing');
  skin=skin.replace(rednessLine,' const redness=0;');
  skin=replaceOnce(skin,'undertone:0,redness:.15,sunExposure:0','undertone:0,redness:0,sunExposure:0','legacy redness fallback');
  writeFileSync(skinPath,skin,'utf8');
}

const beardTestPath='tools/test-beard-anatomy.mjs';
let beardTest=readFileSync(beardTestPath,'utf8');
const oldProduction=`  const face=api.create(source,{jointIds:new Map([['head',7]])},1),beard=face.meshes.find(m=>m.name==='faceBeard');
  assert(beard,'production face must include its procedural beard');
  inspect('production-neutral', {...beard,positions:beard.canonicalPositions},face.report.beard);`;
const newProduction=`  const face=api.create(source,{jointIds:new Map([['head',7]])},1),beard=face.meshes.find(m=>m.name==='faceBeard');
  assert.equal(beard,undefined,'clean-shaven production face must omit the beard draw mesh');
  assert.equal(face.report.beard.strands,0,'clean-shaven production face must report zero beard strands');
  reports.push({label:'production-neutral-clean-shaven',...face.report.beard});`;
if(!beardTest.includes('production-neutral-clean-shaven')){
  beardTest=replaceOnce(beardTest,oldProduction,newProduction,'production beard test');
  writeFileSync(beardTestPath,beardTest,'utf8');
}

const skinCheckPath='tools/check-skin-appearance.mjs';
let skinCheck=readFileSync(skinCheckPath,'utf8');
if(!skinCheck.includes('default and generated faces are neutral without authored cheek blush')){
  skinCheck=replaceOnce(skinCheck,
    "check(defaults.baseColor===eastAsian[5].baseColor&&defaults.undertone===eastAsian[5].undertone&&defaults.redness===eastAsian[5].redness,'scene default matches the medium neutral swatch');",
    "check(defaults.baseColor===eastAsian[5].baseColor&&defaults.undertone===eastAsian[5].undertone&&defaults.redness===eastAsian[5].redness,'scene default matches the medium neutral swatch');\n check(defaults.redness===0&&eastAsian.every(p=>p.redness===0)&&/const redness=0;/.test(skin),'default and generated faces are neutral without authored cheek blush');",
    'skin source neutral-redness check');
  skinCheck=replaceOnce(skinCheck,
    "/baseColor:skinLinearToHex\\(appearance\\.skinColor\\),undertone:0,redness:\\.15/.test(skin)",
    "/baseColor:skinLinearToHex\\(appearance\\.skinColor\\),undertone:0,redness:0/.test(skin)",
    'legacy redness source expectation');
  writeFileSync(skinCheckPath,skinCheck,'utf8');
}

const docPath='docs/face-knowledge/R25C_CLEAN_SHAVEN_NEUTRAL_SKIN_20260920.md';
if(!readFileSync(new URL('../AGENTS.md',import.meta.url),'utf8').length)throw Error('AGENTS unavailable');
writeFileSync(docPath,`# R25C：无胡须与中性面部肤色\n\n日期：2026-09-20  \n分支：\`feature/face-features-r25-20260919\`\n\n## 实施\n\n- 当前人物母体不再把 \`faceBeard\` 网格加入生成结果；胡须生成函数仍保留，后续可作为明确角色选项重新接入。\n- 默认人物、东亚场景肤色预设与按种子生成的皮肤配方，其 \`redness\` 默认均为 0。\n- 红润控制仍保留为显式编辑参数，只有用户主动调高或导入非零配方时才恢复。\n- 鼻形、唇高、眼部 R25B 曲面族、骨架、动作与任务接口未修改。\n\n## 边界\n\n这次修改去除的是程序化胡须网格和作者设定的面颊红润参数，不会把正常受光明暗误当作红晕，也不会通过改底色去掩盖面部几何问题。\n\n## 验收\n\n- 生产面部报告的胡须 strands 必须为 0；生成网格列表不得包含 \`faceBeard\`。\n- 初始皮肤与场景采样皮肤的 \`redness\` 必须为 0。\n- 文件、生成器数值检查和真实浏览器 WebGL 检查分别记录；截图只作为运行证据，不等于整脸达到 3A。\n\n## 真实三维门禁\n\n- [x] 没有用生成图片代替真实三维实现；\n- [x] 已实际修改生产源码；\n- [ ] 用户看到的是可交互三维工作台：等待本轮浏览器构建与截图复查；\n- [x] 人物几何、骨骼和动作仍来自真实运行时；\n- [ ] 镜头与参数控制已在本轮新构建中操作：等待浏览器复查；\n- [ ] 公网固定链接已验证：本轮未建立；\n- [x] 只有截图而没有工作台判定失败：截图仅来自真实工作台 QA。\n`,'utf8');

console.log(JSON.stringify({applied:true,cleanShaven:true,defaultRedness:0,beardGeneratorRetained:true}));
