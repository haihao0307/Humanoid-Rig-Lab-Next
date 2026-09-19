import {readFileSync,writeFileSync} from 'node:fs';

const path='tools/check-eye-anatomy.mjs';
let source=readFileSync(path,'utf8');
const old=`        check(Math.hypot(...sub(cpu,shader))<2e-10,'CPU and shader agree for each posed meridian');`;
const replacement=`        const cpuShaderError=Math.hypot(...sub(cpu,shader));\n        check(cpuShaderError<2e-10,'CPU and shader agree for each posed meridian; '+JSON.stringify({side,state,angle,t,cpu,shader,error:cpuShaderError,outer:o,gradient:g,section,corners}));`;
if(source.includes(old)){
  source=source.replace(old,replacement);
  writeFileSync(path,source,'utf8');
}else if(!source.includes('const cpuShaderError=Math.hypot'))throw Error('R25B-v7 mismatch diagnostic anchor missing');
console.log(JSON.stringify({applied:true,cpuShaderMismatchDiagnostic:true}));
