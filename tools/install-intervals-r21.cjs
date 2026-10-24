'use strict';const fs=require('fs');let s=fs.readFileSync('src/BodyRayR21.js','utf8');
function replace(a,b){if(!s.includes(a))throw Error('Interval marker missing: '+a.slice(0,80));s=s.replace(a,b);}
replace('void main(){vec2 uv=','/*BODY_INTERVAL_R21*/\nvoid main(){vec2 uv=');
const start=s.indexOf('float t=max(interval.x,0.)+.0001,'),end=s.indexOf('if(!hit){outputColour',start);if(start<0||end<0)throw Error('March loop missing');
fs.writeFileSync('qa/fidelity-r21/offline/previous-march.glsl',s.slice(start,end));
s=s.slice(0,start)+'float t=0.;bool hit=intervalTrace(uEye,rd,interval,t);'+s.slice(end);
replace('const normalTexture=gl.createTexture(),','const intervalTexture=gl.createTexture(),normalTexture=gl.createTexture(),');
replace('function field(value){current=value;','function field(value){current=value;const cache=value.intervalCache;gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_3D,intervalTexture);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage3D(gl.TEXTURE_3D,0,gl.R8UI,...cache.dimensions,0,gl.RED_INTEGER,gl.UNSIGNED_BYTE,cache.active);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);');
replace('gl.uniform1i(locations.uField,0);','gl.uniform1i(locations.uField,0);gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_3D,intervalTexture);gl.uniform1i(gl.getUniformLocation(program,"uIntervalActive"),6);gl.uniform3fv(gl.getUniformLocation(program,"uIntervalGrid"),current.intervalCache.dimensions);');
replace('rayIterationBudget:512','rayIterationBudget:2048,intersectionMethod:"conservative sign-range cell traversal and ordered interval root isolation",positiveEpsilonSurface:false,firstHitGloballyCertified:false');
fs.writeFileSync('src/BodyRayR21.js',s);
let w=fs.readFileSync('src/BodyImplicitWorkerR21.js','utf8');
if(!w.includes('const stats={sourceFidelity'))throw Error('Worker stats missing');
w=w.replace('const stats={sourceFidelity','const intervalCache=BodyFieldIntervalsR21.create(main,locals);const stats={intervalCache:{dimensions:intervalCache.dimensions,activeCells:intervalCache.activeCells,cells:intervalCache.cells,bytes:intervalCache.bytes},sourceFidelity');
w=w.replace('return{field:main.field,normalField:main.normalField,','return{intervalCache,field:main.field,normalField:main.normalField,');
w=w.replaceAll('[result.field.buffer,result.normalField.buffer,','[result.intervalCache.active.buffer,result.field.buffer,result.normalField.buffer,');
fs.writeFileSync('src/BodyImplicitWorkerR21.js',w);
