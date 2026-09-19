import {readFileSync,writeFileSync} from 'node:fs';

const replaceOnce=(source,needle,replacement,label)=>{
  const first=source.indexOf(needle);
  if(first<0)throw Error('R25B fragment fix anchor missing: '+label);
  if(source.indexOf(needle,first+needle.length)>=0)throw Error('R25B fragment fix anchor not unique: '+label);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
};

const eyePath='body/EyeAnatomy.js';
let eye=readFileSync(eyePath,'utf8');
const oldHeader=`function compactEyeOcclusionShader(){
  const shader=COMPACT_EYE_LID_GLSL,contactStart=shader.indexOf('float compactLidContact('),contactEnd=shader.indexOf('\\n}',contactStart)+2;
  const rimStart=shader.indexOf('vec3 compactLidRimSurface('),rimEnd=shader.indexOf('\\n}',rimStart)+2;
  const patchStart=shader.indexOf('vec3 compactLidPatchLocal('),bodyStart=shader.indexOf('{',patchStart)+1,bodyEnd=shader.indexOf('  float eps=.0001,slope=',bodyStart);
  if(contactStart<0||contactEnd<2||patchStart<0||bodyEnd<bodyStart)throw Error('眼部遮蔽缺少共享睑缘定义');`;
const newHeader=`function compactEyeOcclusionShader(){
  const shader=COMPACT_EYE_LID_GLSL,contactStart=shader.indexOf('float compactLidContact('),contactEnd=shader.indexOf('\\n}',contactStart)+2;
  const apertureStart=shader.indexOf('float compactLidSmooth01('),apertureEnd=shader.indexOf('\\nfloat compactLidSectionDepth(',apertureStart);
  const rimStart=shader.indexOf('vec3 compactLidRimSurface('),rimEnd=shader.indexOf('\\n}',rimStart)+2;
  const patchStart=shader.indexOf('vec3 compactLidPatchLocal('),bodyStart=shader.indexOf('{',patchStart)+1,bodyEnd=shader.indexOf('  float eps=.0001,slope=',bodyStart);
  if(contactStart<0||contactEnd<2||apertureStart<0||apertureEnd<=apertureStart||patchStart<0||bodyEnd<bodyStart)throw Error('眼部遮蔽缺少共享睑缘定义');`;
if(!eye.includes('const apertureStart=shader.indexOf')){
  eye=replaceOnce(eye,oldHeader,newHeader,'occlusion extraction header');
  eye=replaceOnce(eye,
    '${shader.slice(contactStart,contactEnd)}\n${shader.slice(rimStart,rimEnd)}',
    '${shader.slice(contactStart,contactEnd)}\n${shader.slice(apertureStart,apertureEnd)}\n${shader.slice(rimStart,rimEnd)}',
    'occlusion helper insertion');
  writeFileSync(eyePath,eye,'utf8');
}

const checkPath='tools/check-eye-anatomy.mjs';
let check=readFileSync(checkPath,'utf8');
const oldCheck=`check(source.includes('function compactEyeOcclusionShader')&&source.includes('shader.slice(bodyStart,bodyEnd)')&&source.includes('compactEyeMarginDistance'),'eye contact visibility uses the actual deformer free-margin definition rather than a second static ellipse');`;
const newCheck=`check(source.includes('function compactEyeOcclusionShader')&&source.includes('apertureStart=shader.indexOf')&&source.includes('shader.slice(apertureStart,apertureEnd)')&&source.includes('shader.slice(bodyStart,bodyEnd)')&&source.includes('compactEyeMarginDistance'),'fragment contact visibility carries the same aperture helpers and posed free-margin definition as the vertex deformer');`;
if(!check.includes("fragment contact visibility carries the same aperture helpers")){
  check=replaceOnce(check,oldCheck,newCheck,'source dependency assertion');
  writeFileSync(checkPath,check,'utf8');
}

const docPath='docs/face-knowledge/R25B_EYE_APERTURE_FAMILY_20260919.md';
let doc=readFileSync(docPath,'utf8');
if(!doc.includes('真实浏览器首次编译发现')){
  doc=doc.replace('## 下一步\n',`## 真实浏览器编译修复\n\n真实浏览器首次编译发现，眼部遮蔽片元层复用了 \`compactLidPatchLocal\` 的函数体，却没有同步携带 R25B 新增的开合辅助函数，因此 WebGL 报告找不到 \`compactLidRestApertureY\`、\`compactLidClosedApertureY\` 和 \`compactLidSmooth01\`。这不是眼裂数学失败，而是共享着色器依赖遗漏。\n\n修复后，\`compactEyeOcclusionShader\` 会从同一 \`COMPACT_EYE_LID_GLSL\` 字符串中一并提取开合辅助函数，再提取自由睑缘函数体；顶点位置、片元接触遮蔽与诊断视图因此使用同一套眼裂开合定义。真实浏览器仍需重新运行后才能升级运行状态。\n\n## 下一步\n`);
  writeFileSync(docPath,doc,'utf8');
}

console.log(JSON.stringify({applied:true,fragmentApertureDependenciesIncluded:true}));
