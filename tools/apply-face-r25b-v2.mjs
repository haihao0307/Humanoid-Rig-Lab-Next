import {readFileSync,writeFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const write=(path,content)=>writeFileSync(path,content,'utf8');
const replaceOnce=(source,needle,replacement,label)=>{
  const first=source.indexOf(needle);
  if(first<0)throw Error('R25B-v2 anchor missing: '+label);
  if(source.indexOf(needle,first+needle.length)>=0)throw Error('R25B-v2 anchor not unique: '+label);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
};
const D='$';

const eyePath='body/EyeAnatomy.js';
let eye=read(eyePath);
if(!eye.includes('canthus endpoint tangents and depth attachments')){
  const oldCPU=`function compactEyeClosedApertureY(angle,side){
  const p=COMPACT_EYE_ANATOMY.fissure,c=Math.cos(angle),sideSign=side==='left'?1:-1,lateral=c*sideSign;
  const envelope=Math.pow(Math.max(0,1-c*c),COMPACT_EYE_ANATOMY.closure.envelopePower);
  return p.lateralCanthusLift*lateral+COMPACT_EYE_ANATOMY.closure.centreY*envelope;
}
// One aperture family owns both open and closed free margins. The canthi are
// invariant endpoints; blink only moves the interior of the shared curve.
function compactEyeAperturePoint(angle,side,state=[0,0,0]){
  const p=COMPACT_EYE_ANATOMY.fissure,c=Math.cos(angle),restY=compactEyeRestApertureY(angle,side,state),closedY=compactEyeClosedApertureY(angle,side),closing=compactEyeSmooth01(state[2]||0);
  return [p.halfWidth*c,restY+(closedY-restY)*closing];
}`;
  const newCPU=`function compactEyeClosedApertureY(angle,side,canthusSlopes=[0,0]){
  const p=COMPACT_EYE_ANATOMY.fissure,c=Math.cos(angle),u=(c+1)*.5,u2=u*u,u3=u2*u,sideSign=side==='left'?1:-1;
  const left=-p.lateralCanthusLift*sideSign,right=p.lateralCanthusLift*sideSign,m0=(canthusSlopes[0]||0)*2*p.halfWidth,m1=(canthusSlopes[1]||0)*2*p.halfWidth;
  const base=(2*u3-3*u2+1)*left+(u3-2*u2+u)*m0+(-2*u3+3*u2)*right+(u3-u2)*m1;
  // Endpoint slopes are boundary conditions only. The quartic envelope has
  // zero value and derivative at both canthi and restores the authored centre.
  const centreFromTangents=(m0-m1)*.125,envelope=Math.pow(Math.max(0,1-c*c),COMPACT_EYE_ANATOMY.closure.envelopePower);
  return base+(COMPACT_EYE_ANATOMY.closure.centreY-centreFromTangents)*envelope;
}
// One aperture family owns both open and closed free margins. The canthi are
// invariant endpoints and keep the fitted attachment tangent; blink moves only
// the interior of the shared curve.
function compactEyeAperturePoint(angle,side,state=[0,0,0],canthusSlopes=[0,0]){
  const p=COMPACT_EYE_ANATOMY.fissure,c=Math.cos(angle),restY=compactEyeRestApertureY(angle,side,state),closedY=compactEyeClosedApertureY(angle,side,canthusSlopes),closing=compactEyeSmooth01(state[2]||0);
  return [p.halfWidth*c,restY+(closedY-restY)*closing];
}`;
  eye=replaceOnce(eye,oldCPU,newCPU,'CPU canthal tangent family');
  eye=replaceOnce(eye,
    `neutral=compactEyeNeutralFissure(angle,side),aperture=compactEyeAperturePoint(angle,side,state);`,
    `neutral=compactEyeNeutralFissure(angle,side),aperture=compactEyeAperturePoint(angle,side,state,corners.slopes||[0,0]);`,
    'CPU posed aperture slopes');
  eye=replaceOnce(eye,
    `Source-skin slopes remain depth attachments only.`,
    `Source-skin slopes are confined to canthus endpoint tangents and depth attachments.`,
    'CPU ownership comment');

  const oldGLSL=`float compactLidClosedApertureY(float angle,float sideSign){
  float c=cos(angle),lateral=c*sideSign,envelope=pow(max(0.,1.-c*c),${D}{COMPACT_EYE_ANATOMY.closure.envelopePower.toFixed(1)});
  return ${D}{COMPACT_EYE_ANATOMY.fissure.lateralCanthusLift.toFixed(6)}*lateral+(${D}{COMPACT_EYE_ANATOMY.closure.centreY.toFixed(6)})*envelope;
}
vec2 compactLidAperture(float angle,float sideSign,float narrow,float wide,float blink){
  float restY=compactLidRestApertureY(angle,sideSign,narrow,wide),closedY=compactLidClosedApertureY(angle,sideSign),closing=compactLidSmooth01(blink);
  return vec2(${D}{COMPACT_EYE_ANATOMY.fissure.halfWidth.toFixed(6)}*cos(angle),mix(restY,closedY,closing));
}`;
  const newGLSL=`float compactLidClosedApertureY(float angle,float sideSign,vec2 canthusSlopes){
  float c=cos(angle),u=(c+1.)*.5,u2=u*u,u3=u2*u,left=-${D}{COMPACT_EYE_ANATOMY.fissure.lateralCanthusLift.toFixed(6)}*sideSign,right=${D}{COMPACT_EYE_ANATOMY.fissure.lateralCanthusLift.toFixed(6)}*sideSign;
  float m0=canthusSlopes.x*2.*${D}{COMPACT_EYE_ANATOMY.fissure.halfWidth.toFixed(6)},m1=canthusSlopes.y*2.*${D}{COMPACT_EYE_ANATOMY.fissure.halfWidth.toFixed(6)};
  float base=(2.*u3-3.*u2+1.)*left+(u3-2.*u2+u)*m0+(-2.*u3+3.*u2)*right+(u3-u2)*m1;
  float centreFromTangents=(m0-m1)*.125,envelope=pow(max(0.,1.-c*c),${D}{COMPACT_EYE_ANATOMY.closure.envelopePower.toFixed(1)});
  return base+((${D}{COMPACT_EYE_ANATOMY.closure.centreY.toFixed(6)})-centreFromTangents)*envelope;
}
vec2 compactLidAperture(float angle,float sideSign,float narrow,float wide,float blink,vec2 canthusSlopes){
  float restY=compactLidRestApertureY(angle,sideSign,narrow,wide),closedY=compactLidClosedApertureY(angle,sideSign,canthusSlopes),closing=compactLidSmooth01(blink);
  return vec2(${D}{COMPACT_EYE_ANATOMY.fissure.halfWidth.toFixed(6)}*cos(angle),mix(restY,closedY,closing));
}`;
  eye=replaceOnce(eye,oldGLSL,newGLSL,'GLSL canthal tangent family');
  eye=replaceOnce(eye,
    `vec2 restAperture=compactLidAperture(angle,sideSign,narrow,wide,0.),aperture=compactLidAperture(angle,sideSign,narrow,wide,blink);`,
    `vec2 restAperture=compactLidAperture(angle,sideSign,narrow,wide,0.,compactCanthusSlope),aperture=compactLidAperture(angle,sideSign,narrow,wide,blink,compactCanthusSlope);`,
    'GLSL posed aperture slopes');
  write(eyePath,eye);
}

const testPath='tools/test-eye-aperture-family.mjs';
let test=read(testPath);
test=replaceOnce(test,
  `check(source.includes('Source-skin slopes remain depth attachments only'),'source-skin slopes still appear to own the free-margin outline');`,
  `check(source.includes('Source-skin slopes are confined to canthus endpoint tangents and depth attachments'),'source-skin slopes are not confined to the owned canthus boundary condition');`,
  'test ownership wording');
if(!test.includes('canthalTangentsPreserved')){
  test=replaceOnce(test,
    `check(api.shader.includes('compactLidAperture')&&api.shader.includes('mix(restY,closedY,closing)'),'GLSL path does not use the shared aperture family');`,
    `const slopes=[.18,-.11],epsilon=.000001;\nfor(const side of ['left','right']){\n  const left0=api.aperture(Math.PI,side,[0,0,1],slopes),left1=api.aperture(Math.acos(-1+epsilon),side,[0,0,1],slopes);\n  const right0=api.aperture(0,side,[0,0,1],slopes),right1=api.aperture(Math.acos(1-epsilon),side,[0,0,1],slopes);\n  check(Math.abs((left1[1]-left0[1])/(left1[0]-left0[0])-slopes[0])<2e-4,'left canthus attachment tangent changed');\n  check(Math.abs((right1[1]-right0[1])/(right1[0]-right0[0])-slopes[1])<2e-4,'right canthus attachment tangent changed');\n}\ncheck(api.shader.includes('compactLidAperture')&&api.shader.includes('mix(restY,closedY,closing)')&&api.shader.includes('compactCanthusSlope'),'GLSL path does not use the shared slope-aware aperture family');`,
    'test canthal tangent assertions');
  test=replaceOnce(test,
    `cpuAndGlslFamilyDeclared:true,browserExecuted:false`,
    `cpuAndGlslFamilyDeclared:true,canthalTangentsPreserved:true,browserExecuted:false`,
    'test report');
}
write(testPath,test);

const docPath='docs/face-knowledge/R25B_EYE_APERTURE_FAMILY_20260919.md';
let doc=read(docPath);
doc=doc.replace('源面皮斜率只负责三维深度附着，不再决定闭眼轮廓。','源面皮斜率仅作为内外眦端点切线与三维深度附着条件，不再独立生成整条闭眼轮廓。');
doc=doc.replace('外接源面皮斜率继续参与深度、切线和眶部回接，但不再拥有自由睑缘的二维轮廓；','外接源面皮斜率继续提供眦点端点切线、深度和眶部回接；端点切线是边界条件，中段自由睑缘由统一曲线族所有；');
write(docPath,doc);

const readmePath='README.md';
let readme=read(readmePath);
readme=readme.replace('源面皮斜率只负责三维深度附着，不再决定闭眼轮廓。','源面皮斜率仅保留为眦点端点切线和三维深度附着条件，不再独立决定整条闭眼轮廓。');
write(readmePath,readme);

console.log(JSON.stringify({applied:true,revision:'r25b-canthus-owned-aperture-family',canthalTangentsPreserved:true}));
