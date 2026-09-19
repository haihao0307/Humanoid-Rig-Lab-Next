import {readFileSync,writeFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const write=(path,content)=>writeFileSync(path,content,'utf8');
const replaceOnce=(source,needle,replacement,label)=>{
  const first=source.indexOf(needle);
  if(first<0)throw Error('R25B patch anchor missing: '+label);
  if(source.indexOf(needle,first+needle.length)>=0)throw Error('R25B patch anchor not unique: '+label);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
};
const replaceBetween=(source,start,end,replacement,label)=>{
  const first=source.indexOf(start);
  if(first<0)throw Error('R25B section start missing: '+label);
  const last=source.indexOf(end,first+start.length);
  if(last<0)throw Error('R25B section end missing: '+label);
  return source.slice(0,first)+replacement+source.slice(last);
};
const D='$';

const eyePath='body/EyeAnatomy.js';
let eye=read(eyePath);
if(!eye.includes("revision:'r25b-canthus-owned-aperture-family'")){
  eye=replaceOnce(eye,
    "revision:'r24-span-aware-lid-return'",
    "revision:'r25b-canthus-owned-aperture-family',baselineRevision:'r24-span-aware-lid-return'",
    'eye revision');
  eye=replaceOnce(eye,
    "  fissure:{halfWidth:.0133,upperHeight:.00405,lowerHeight:.00425,lateralCanthusLift:.00070,upperTemporalBias:-.10,lowerTemporalBias:-.07,verticalRoundness:.22,canthusAttachmentStart:.38,upperFoldM:.00020,lowerSulcusM:.00007},\n  outerBand:",
    "  fissure:{halfWidth:.0133,upperHeight:.00405,lowerHeight:.00425,lateralCanthusLift:.00070,upperTemporalBias:-.10,lowerTemporalBias:-.07,verticalRoundness:.22,canthusAttachmentStart:.38,upperFoldM:.00020,lowerSulcusM:.00007},\n  closure:{centreY:-.00240,envelopePower:2},\n  outerBand:",
    'closure controls');

  const oldFissure=`function compactEyeNeutralFissure(angle,side){
  const p=COMPACT_EYE_ANATOMY.fissure,c=Math.cos(angle),s=Math.sin(angle),vertical=Math.abs(s),lateral=c*(side==='left'?1:-1),canthus=vertical*vertical;
  const height=s>=0?p.upperHeight*(1+p.upperTemporalBias*lateral):p.lowerHeight*(1-p.lowerTemporalBias*lateral);
  const y=(s>=0?1:-1)*height*vertical*(1-p.verticalRoundness+p.verticalRoundness*vertical)+p.lateralCanthusLift*lateral*(1-canthus);
  return [p.halfWidth*c,y];
}`;
  const newFissure=`function compactEyeSmooth01(value){const t=clamp(value,0,1);return t*t*(3-2*t);}
function compactEyeRestApertureY(angle,side,state=[0,0,0]){
  const p=COMPACT_EYE_ANATOMY.fissure,c=Math.cos(angle),s=Math.sin(angle),vertical=Math.abs(s),sideSign=side==='left'?1:-1,lateral=c*sideSign,canthus=vertical*vertical;
  const height=s>=0?p.upperHeight*(1+p.upperTemporalBias*lateral):p.lowerHeight*(1-p.lowerTemporalBias*lateral);
  const neutral=(s>=0?1:-1)*height*vertical*(1-p.verticalRoundness+p.verticalRoundness*vertical)+p.lateralCanthusLift*lateral*(1-canthus);
  const narrow=state[0]||0,wide=state[1]||0;
  return neutral+((s>=0?-.0022:.0014)*narrow+(s>=0?.0019:-.0004)*wide)*canthus;
}
function compactEyeClosedApertureY(angle,side){
  const p=COMPACT_EYE_ANATOMY.fissure,c=Math.cos(angle),sideSign=side==='left'?1:-1,lateral=c*sideSign;
  const envelope=Math.pow(Math.max(0,1-c*c),COMPACT_EYE_ANATOMY.closure.envelopePower);
  return p.lateralCanthusLift*lateral+COMPACT_EYE_ANATOMY.closure.centreY*envelope;
}
// One aperture family owns both open and closed free margins. The canthi are
// invariant endpoints; blink only moves the interior of the shared curve.
function compactEyeAperturePoint(angle,side,state=[0,0,0]){
  const p=COMPACT_EYE_ANATOMY.fissure,c=Math.cos(angle),restY=compactEyeRestApertureY(angle,side,state),closedY=compactEyeClosedApertureY(angle,side),closing=compactEyeSmooth01(state[2]||0);
  return [p.halfWidth*c,restY+(closedY-restY)*closing];
}
function compactEyeNeutralFissure(angle,side){return compactEyeAperturePoint(angle,side,[0,0,0]);}`;
  eye=replaceOnce(eye,oldFissure,newFissure,'neutral aperture functions');

  const cpuStart="  const c=Math.cos(angle),s=Math.sin(angle),canthus=s*s,lateral=c*(side==='left'?1:-1),neutral=compactEyeNeutralFissure(angle,side);\n";
  const cpuEnd="  const x=ex+(outer[0]-ex)*t,y=ey+(outer[1]-ey)*t,dx=outer[0]-ex,dyRadial=outer[1]-ey;\n";
  const cpuReplacement=`  const c=Math.cos(angle),s=Math.sin(angle),neutral=compactEyeNeutralFissure(angle,side),aperture=compactEyeAperturePoint(angle,side,state);
  const restY=neutral[1],rim=compactEyeRimSection(angle,state[2]),rimDirection=compactEyeRimDirection(angle),ex=aperture[0]+rimDirection[0]*rim.width;
  // The free margin and the closed seam now come from the same canthus-owned
  // curve family. Source-skin slopes remain depth attachments only.
  const closureU=(c+1)*.5,ey=aperture[1]+rimDirection[1]*rim.width;
`;
  eye=replaceBetween(eye,cpuStart,cpuEnd,cpuReplacement,'CPU aperture selection');

  const glslHelperMarker="}\nfloat compactLidSectionDepth(float t,float z0,float z1,float m0,float m1,float knot,float knotZ,float knotSlope){";
  const glslHelpers=`}
float compactLidSmooth01(float value){float t=clamp(value,0.,1.);return t*t*(3.-2.*t);}
float compactLidRestApertureY(float angle,float sideSign,float narrow,float wide){
  float c=cos(angle),s=sin(angle),vertical=abs(s),lateral=c*sideSign,canthus=s*s;
  float height=s>=0.?${D}{COMPACT_EYE_ANATOMY.fissure.upperHeight.toFixed(6)}*(1.+(${D}{COMPACT_EYE_ANATOMY.fissure.upperTemporalBias.toFixed(6)})*lateral):${D}{COMPACT_EYE_ANATOMY.fissure.lowerHeight.toFixed(6)}*(1.-(${D}{COMPACT_EYE_ANATOMY.fissure.lowerTemporalBias.toFixed(6)})*lateral);
  float neutral=(s>=0.?1.:-1.)*height*vertical*(${D}{(1-COMPACT_EYE_ANATOMY.fissure.verticalRoundness).toFixed(6)}+${D}{COMPACT_EYE_ANATOMY.fissure.verticalRoundness.toFixed(6)}*vertical)+${D}{COMPACT_EYE_ANATOMY.fissure.lateralCanthusLift.toFixed(6)}*lateral*(1.-canthus);
  return neutral+((s>=0.?-.0022:.0014)*narrow+(s>=0.?.0019:-.0004)*wide)*canthus;
}
float compactLidClosedApertureY(float angle,float sideSign){
  float c=cos(angle),lateral=c*sideSign,envelope=pow(max(0.,1.-c*c),${D}{COMPACT_EYE_ANATOMY.closure.envelopePower.toFixed(1)});
  return ${D}{COMPACT_EYE_ANATOMY.fissure.lateralCanthusLift.toFixed(6)}*lateral+(${D}{COMPACT_EYE_ANATOMY.closure.centreY.toFixed(6)})*envelope;
}
vec2 compactLidAperture(float angle,float sideSign,float narrow,float wide,float blink){
  float restY=compactLidRestApertureY(angle,sideSign,narrow,wide),closedY=compactLidClosedApertureY(angle,sideSign),closing=compactLidSmooth01(blink);
  return vec2(${D}{COMPACT_EYE_ANATOMY.fissure.halfWidth.toFixed(6)}*cos(angle),mix(restY,closedY,closing));
}
float compactLidSectionDepth(float t,float z0,float z1,float m0,float m1,float knot,float knotZ,float knotSlope){`;
  eye=replaceOnce(eye,glslHelperMarker,glslHelpers,'GLSL aperture helpers');

  const glslStart="  float c=cos(angle),s=sin(angle),vertical=abs(s),canthus=vertical*vertical,lateral=c*(compactEyeSide<.5?1.:-1.);\n";
  const glslEnd="  float x=mix(ex,outer.x,t),y=mix(ey,outer.y,t),dx=outer.x-ex,dyRadial=outer.y-ey;\n";
  const glslReplacement=`  float c=cos(angle),s=sin(angle),canthus=s*s;
  float closing=blink*blink*(3.-2.*blink),rimWidth=(s>=0.?${D}{COMPACT_EYE_ANATOMY.rim.upperWidthM}:${D}{COMPACT_EYE_ANATOMY.rim.lowerWidthM})*canthus*(1.-closing),rimLift=(s>=0.?${D}{COMPACT_EYE_ANATOMY.rim.upperLiftM}:${D}{COMPACT_EYE_ANATOMY.rim.lowerLiftM})*canthus*(1.-closing);
  float rimDX=c*(s>=0.?${D}{COMPACT_EYE_ANATOMY.fissure.upperHeight}:${D}{COMPACT_EYE_ANATOMY.fissure.lowerHeight}),rimDY=s*${D}{COMPACT_EYE_ANATOMY.fissure.halfWidth},rimLength=sqrt(rimDX*rimDX+rimDY*rimDY);
  float sideSign=compactEyeSide<.5?1.:-1.;
  vec2 restAperture=compactLidAperture(angle,sideSign,narrow,wide,0.),aperture=compactLidAperture(angle,sideSign,narrow,wide,blink);
  float restY=restAperture.y,ex=aperture.x+rimDX/rimLength*rimWidth,closureU=(c+1.)*.5;
  float ey=aperture.y+rimDY/rimLength*rimWidth;
`;
  eye=replaceBetween(eye,glslStart,glslEnd,glslReplacement,'GLSL aperture selection');
  write(eyePath,eye);
}

const sourceCheckPath='tools/check-eye-anatomy.mjs';
let sourceCheck=read(sourceCheckPath);
sourceCheck=replaceOnce(sourceCheck,
  `check(source.includes("revision:'r24-span-aware-lid-return'")&&source.includes('function compactEyeNeutralFissure')&&source.includes('lateralCanthusLift:.00070'),'neutral fissure has an explicit versioned canthus-aware model');`,
  `check(source.includes("revision:'r25b-canthus-owned-aperture-family'")&&source.includes("baselineRevision:'r24-span-aware-lid-return'")&&source.includes('function compactEyeAperturePoint')&&source.includes('function compactEyeClosedApertureY')&&source.includes('vec2 compactLidAperture'),'neutral, half-closed and closed margins share an explicit canthus-owned CPU/GLSL family');`,
  'eye source revision check');
write(sourceCheckPath,sourceCheck);

const baselinePath='tools/check-face-r25-baseline.mjs';
let baseline=read(baselinePath);
baseline=replaceOnce(baseline,
  `assert.match(eye,/revision:'r24-span-aware-lid-return'/,'R25A must start from the recorded R24 eye surface');`,
  `assert.match(eye,/revision:'r25b-canthus-owned-aperture-family'/,'R25B eye aperture family is not active');\nassert.match(eye,/baselineRevision:'r24-span-aware-lid-return'/,'R25B lost the recorded R24 eye baseline');\nassert.match(eye,/function compactEyeAperturePoint/,'R25B shared aperture owner is missing');`,
  'R25 baseline eye revision');
write(baselinePath,baseline);

const testPath='tools/test-eye-aperture-family.mjs';
if(!readFileSync(testPath,{encoding:'utf8',flag:'a+'}).includes('r25b-canthus-owned-aperture-family')){
  write(testPath,`import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../body/EyeAnatomy.js',import.meta.url),'utf8');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>mul(a,1/(Math.hypot(...a)||1));
const context=vm.createContext({Math,clamp,add,sub,mul,dot,cross,norm,COMPACT_INFLUENCES:8});
new vm.Script(source+'\\n;globalThis.eyeApertureAPI={anatomy:COMPACT_EYE_ANATOMY,neutral:compactEyeNeutralFissure,aperture:compactEyeAperturePoint,restY:compactEyeRestApertureY,closedY:compactEyeClosedApertureY,shader:COMPACT_EYE_LID_GLSL};').runInContext(context,{timeout:1000});
const api=context.eyeApertureAPI;
assert.equal(api.anatomy.revision,'r25b-canthus-owned-aperture-family');
assert.equal(api.anatomy.baselineRevision,'r24-span-aware-lid-return');

let checks=0;
const check=(value,message)=>{assert(value,message);checks++;};
for(const side of ['left','right']){
  const temporal=side==='left'?0:Math.PI,medial=side==='left'?Math.PI:0;
  for(const angle of [temporal,medial]){
    const neutral=api.aperture(angle,side,[0,0,0]);
    for(const blink of [.25,.5,.75,1]){
      const posed=api.aperture(angle,side,[0,0,blink]);
      check(Math.hypot(posed[0]-neutral[0],posed[1]-neutral[1])<1e-12,'blink moved an owned canthus endpoint');
    }
  }
  for(const c of [-.8,-.4,0,.4,.8]){
    const upperAngle=Math.acos(c),lowerAngle=2*Math.PI-upperAngle;
    let previous=Infinity;
    for(const blink of [0,.25,.5,.75,1]){
      const upper=api.aperture(upperAngle,side,[0,0,blink]),lower=api.aperture(lowerAngle,side,[0,0,blink]),gap=upper[1]-lower[1];
      check(gap<=previous+1e-12,'eyelid gap is not monotone during closure');
      check(gap>=-1e-12,'upper and lower margins crossed during closure');
      if(blink<1)check(gap>1e-5,'eye closed before the requested full blink');
      else check(Math.abs(gap)<1e-12,'full blink did not share one closure seam');
      previous=gap;
    }
  }
  for(let i=0;i<=128;i++){
    const angle=i/128*2*Math.PI;
    check(Math.hypot(...api.neutral(angle,side).map((v,k)=>v-api.aperture(angle,side,[0,0,0])[k]))<1e-12,'neutral wrapper diverged from the shared aperture family');
  }
}
const leftTemporal=api.aperture(0,'left',[0,0,1]),rightTemporal=api.aperture(Math.PI,'right',[0,0,1]);
const leftMedial=api.aperture(Math.PI,'left',[0,0,1]),rightMedial=api.aperture(0,'right',[0,0,1]);
check(Math.abs(leftTemporal[1]-rightTemporal[1])<1e-12&&Math.abs(leftMedial[1]-rightMedial[1])<1e-12,'paired canthus ownership is not mirrored');
check(api.shader.includes('compactLidAperture')&&api.shader.includes('mix(restY,closedY,closing)'),'GLSL path does not use the shared aperture family');
check(source.includes('Source-skin slopes remain depth attachments only'),'source-skin slopes still appear to own the free-margin outline');
console.log(JSON.stringify({checks,revision:api.anatomy.revision,canthiInvariant:true,closureMonotone:true,fullBlinkSharedSeam:true,cpuAndGlslFamilyDeclared:true,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
`);
}

const readmePath='README.md';
let readme=read(readmePath);
if(!readme.includes('面部特征 R25B')){
  readme=replaceOnce(readme,'# 重建人物 R2 · 行为与人物模块修整 R11\n\n',`# 重建人物 R2 · 行为与人物模块修整 R11\n\n2026-09-19 **面部特征 R25B：内外眦统一眼裂开合族**：中性、半闭和全闭眼的自由睑缘改由同一对内外眦端点和同一连续曲线族生成；源面皮斜率只负责三维深度附着，不再决定闭眼轮廓。新增 CPU/GLSL 对应函数及端点不动、间隙单调、全闭共缝检查。当前仅完成源码和参数检查，尚未宣称视觉验收。见 [R25B 眼裂开合族](docs/face-knowledge/R25B_EYE_APERTURE_FAMILY_20260919.md)。\n\n`,'README R25B entry');
  write(readmePath,readme);
}

const docPath='docs/face-knowledge/R25B_EYE_APERTURE_FAMILY_20260919.md';
write(docPath,`# R25B：内外眦统一眼裂开合族

日期：2026-09-19  
分支：\`feature/face-features-r25-20260919\`  
前置阶段：R25A 19 项身份控制与鼻唇冻结门禁

状态：源码候选。已经修改真实眼睑生产源码；未进行公网浏览器、目标 GPU 或用户视觉验收，不宣称闭眼盖片问题已经完成解决。

## 根因边界

R24 的中性眼裂由 \`compactEyeNeutralFissure\` 生成，闭眼线则在 \`compactEyePatchPoint\` 和 GLSL 中另行使用外接源面皮斜率重建。两者虽然共享端点位置，但自由睑缘与闭眼轮廓并非同一所有者。外接皮肤的局部斜率因此既参与深度附着，也间接决定闭眼线，容易把源网格的局部坡度带入眼裂轮廓。

本轮不把“闭眼盖片”简化为单一接触碰撞问题。R22 已证明关闭接触、放宽接触和增加局部隆起都不足以解决整体观感。R25B 先收回曲线所有权，再继续处理板层与眶部基底。

## 生产修改

- 眼部版本升级为 \`r25b-canthus-owned-aperture-family\`，保留 \`baselineRevision: r24-span-aware-lid-return\`；
- 新增 \`compactEyeRestApertureY\`、\`compactEyeClosedApertureY\` 和 \`compactEyeAperturePoint\`；
- 中性、半闭和全闭眼共享同一对内外眦端点；
- 眨眼使用平滑的 0→1 闭合权重，闭合过程中上下睑间隙单调收敛；
- 全闭状态的上下睑使用同一条缝线，不再分别求两条闭眼轮廓；
- 外接源面皮斜率继续参与深度、切线和眶部回接，但不再拥有自由睑缘的二维轮廓；
- CPU 与 GLSL 各自实现同名的开合族，避免生成态与运行时眨眼使用不同模型；
- H 鼻形、鼻孔参数、7.30/9.00 mm 唇高和现有动作/任务协议保持冻结。

## 自动检查

\`tools/test-eye-aperture-family.mjs\` 覆盖：

1. 眨眼过程中内外眦端点不移动；
2. 多个横向截面上的上下睑间隙单调减小；
3. 全闭时上下睑汇合到同一条缝；
4. 左右眼眦点关系保持镜像；
5. 中性包装函数与共享开合族完全一致；
6. GLSL 路径声明并使用相同的开合函数。

\`check-eye-anatomy --parameter-fixtures\`、R25 基线检查、身份编译、共享身份变形和 NPC uniform 检查继续作为回归门禁。数值通过不能替代真实画面判断。

## 下一步

R25B 下一子阶段继续处理上睑板、下睑板、回折段和眶部外接面的三维截面。重点检查中性、半闭、全闭三个状态是否仍出现独立圆盖、硬沟或局部凸台；结构通过后再接入真正的眼裂宽度和眼角倾斜身份参数。

## 真实三维门禁

- [x] 没有用生成图片代替真实三维实现；
- [x] 已实际修改生产源码；
- [ ] 用户看到的是可交互三维工作台：尚未发布本轮公网入口；
- [x] 人物几何、骨骼和动作仍来自统一运行时；
- [ ] 镜头、选择、动作和新眨眼曲面已由真实浏览器操作：尚未完成；
- [ ] 公网固定链接和目标浏览器已验证：尚未完成；
- [x] 如果只有截图而没有工作台，本轮判定失败：当前只声明为源码候选，没有用截图冒充成品。
`);

const workflowPath='.github/workflows/face-r25-source-check.yml';
let workflow=read(workflowPath);
if(!workflow.includes('Check R25B eye aperture family')){
  workflow+=`\n      - name: Check eye source and parameter fixtures\n        run: node tools/check-eye-anatomy.mjs --parameter-fixtures\n\n      - name: Check R25B eye aperture family\n        run: node tools/test-eye-aperture-family.mjs\n`;
  write(workflowPath,workflow);
}

console.log(JSON.stringify({applied:true,eyeRevision:'r25b-canthus-owned-aperture-family',created:[testPath,docPath],updated:[eyePath,sourceCheckPath,baselinePath,readmePath,workflowPath]}));
