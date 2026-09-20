import {readFileSync,writeFileSync} from 'node:fs';

const replaceOnce=(source,needle,replacement,label)=>{
  const first=source.indexOf(needle);
  if(first<0)throw Error('R25D anchor missing: '+label);
  if(source.indexOf(needle,first+needle.length)>=0)throw Error('R25D anchor not unique: '+label);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
};

const identityPath='body/FaceIdentity.js';
let identity=readFileSync(identityPath,'utf8');
const sculpted="const FACE_SCULPTED_MALE_SHAPE=Object.freeze({headWidth:.16,headHeight:-.40,headDepth:.10,eyeSpacing:-.72,cranialWidth:-.12,faceHeight:-.20,cheekboneWidth:.48,cheekProjection:.18,jawWidth:.68,lowerFaceFullness:-.50,chinLength:-.10,chinProjection:.52,noseWidth:-.18,noseLength:-.20,noseProjection:.08,mouthWidth:.36,lipFullness:-.10});";
const young="const FACE_YOUNG_SLENDER_MALE_SHAPE=Object.freeze({headWidth:-.05,headHeight:-.34,headDepth:.06,eyeSpacing:-.68,cranialWidth:-.22,faceHeight:-.18,cheekboneWidth:.22,cheekProjection:.10,jawWidth:.25,lowerFaceFullness:-.62,chinLength:-.18,chinProjection:.26,noseWidth:-.20,noseLength:-.24,noseProjection:.04,mouthWidth:.30,lipFullness:.02});";
if(!identity.includes('const FACE_YOUNG_SLENDER_MALE_SHAPE=')){
  identity=replaceOnce(identity,sculpted,sculpted+'\n// R25D current-role recipe: narrower lateral mass and softer lower face.\n// It is a reversible authored identity, not an age estimator or population rule.\n'+young,'young slender identity insertion');
  writeFileSync(identityPath,identity,'utf8');
}

const characterPath='body/CharacterPresets.js';
let character=readFileSync(characterPath,'utf8');
const oldInitial="function initialCharacterPreset(){return validateCharacterPreset(window.__NPC_DEFINITION__?.character||window.__CHARACTER_PRESET__||{label:'立体男性参考',appearance:{face:{identity:{shape:FACE_SCULPTED_MALE_SHAPE}},skin:{baseColor:'#c7a18d',roughness:.60,oil:.15,redness:0}}});}";
const newInitial="function initialCharacterPreset(){return validateCharacterPreset(window.__NPC_DEFINITION__?.character||window.__CHARACTER_PRESET__||{label:'年轻清瘦男性参考',appearance:{face:{identity:{shape:FACE_YOUNG_SLENDER_MALE_SHAPE}},skin:{baseColor:'#ad7d66',undertone:-.02,redness:0,roughness:.54,oil:.18,scatter:.36,variation:.18,pores:.20,sunExposure:.20,weathering:.05}}});}";
if(character.includes(oldInitial)){
  character=replaceOnce(character,oldInitial,newInitial,'initial character role');
  writeFileSync(characterPath,character,'utf8');
}else if(!character.includes("label:'年轻清瘦男性参考'"))throw Error('R25D initial character contract missing');

const docPath='docs/face-knowledge/R25D_YOUNG_SLENDER_DARKER_ROLE_20260920.md';
if(!readFileSync('package.json','utf8'))throw Error('repository root unavailable');
const doc=`# R25D：当前角色年轻、清瘦与较深肤色\n\n日期：2026-09-20  \n分支：\`feature/face-features-r25-20260919\`\n\n## 实施\n\n- 新增 \`FACE_YOUNG_SLENDER_MALE_SHAPE\`，只供当前默认角色使用；原 \`FACE_SCULPTED_MALE_SHAPE\` 与其他 NPC 配方不变。\n- 缩小整体头宽、颞额宽、颧部宽度和下颌宽度，降低下脸饱满度，并减弱下巴前突。\n- 轻微缩短鼻部、增加少量唇部饱满度，使当前角色从厚重成熟脸转向较年轻、较轻的脸型。\n- 当前角色肤色从 \`#c7a18d\` 调整为 \`#ad7d66\`；同时降低粗糙、毛孔、色差和户外风化，保持 \`redness: 0\` 与无胡须。\n- 鼻形生产模块、R25B 眼睑曲面、唇高、骨架、动作和任务接口未修改。\n\n## 参数边界\n\n“年轻”没有被伪装成一个可靠年龄推断器；本轮只是对当前角色的作者设定：更窄、更柔和、表面风化更低。皮肤依然保留毛孔、粗糙度、散射和亮度差异，不能通过完全抹平表面来冒充年轻。\n\n## 验收\n\n- 当前角色必须引用 \`FACE_YOUNG_SLENDER_MALE_SHAPE\`。\n- 头宽、颞额宽、颧宽和下颌宽必须低于上一角色；下巴前突必须减弱。\n- 当前角色皮肤必须为 \`#ad7d66\`，红润为 0，胡须 strands 为 0。\n- 正面、斜面和皮肤近景由真实浏览器重新截取；截图只证明实际运行，不等于整脸已达到 3A。\n`;
try{readFileSync(docPath,'utf8');}catch{writeFileSync(docPath,doc,'utf8');}

console.log(JSON.stringify({applied:true,role:'young-slender-darker',globalFacePresetPreserved:true,redness:0,beardExpected:false}));
