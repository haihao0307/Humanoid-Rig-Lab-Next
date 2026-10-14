'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=__dirname, R=path.join(P,'../r15'),checks=[];
const protectedFiles=['bend-cloth.js','bend-fast.js','bend-kernel.c','bend-kernel.wasm','dynamics.js','natural-yarn.js','cotton-surface.js','fiber-optics.js','structure.js','stitches.js','runtime-budget.js','frame-metrics.js','distance-lod.js'];
for(const f of protectedFiles)A.deepEqual(fs.readFileSync(path.join(P,f)),fs.readFileSync(path.join(R,f)),f);
checks.push('13 protected solver, yarn, material, LOD and timing modules are byte-identical');
let seed=7;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const W=73,H=59,image=Float64Array.from({length:W*H},()=>random()*32);
const tex=(x,y)=>image[Math.max(0,Math.min(H-1,y))*W+Math.max(0,Math.min(W-1,x))];
function bilinear(x,y){x-=.5;y-=.5;let i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j;return (1-v)*((1-u)*tex(i,j)+u*tex(i+1,j))+v*((1-u)*tex(i,j+1)+u*tex(i+1,j+1));}
let error=0;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 let old=0,paired=0;
 for(let j=0;j<4;j++)for(let i=0;i<4;i++)old+=bilinear(x+.5+(i+.5-2)/4,y+.5+(j+.5-2)/4)/16;
 for(const j of [-.25,.25])for(const i of [-.25,.25])paired+=bilinear(x+.5+i,y+.5+j)/4;
 error=Math.max(error,Math.abs(old-paired));
}
A.ok(error<1e-10,error);checks.push('Native 4-tap equals 16-tap linear footprint including clamped borders and HDR values');
const app=fs.readFileSync(path.join(P,'app.js'),'utf8');const f=app.match(/function r16VisualKey\(\)\{[^\n]+\}/)[0];
const c={state:{fold:0,gripEnabled:true,friction:.35,shape:1,quality:'efficient',zoom:1,thickness:.7}};vm.createContext(c);vm.runInContext(f,c);let key=vm.runInContext('r16VisualKey()',c);
for(const k of ['fold','gripEnabled','friction','windSpeed','selfCollision']){c.state[k]=.9;A.equal(vm.runInContext('r16VisualKey()',c),key,k);}
for(const k of ['zoom','quality','shape','thickness','r16Reference']){let prev=c.state[k];c.state[k]='changed';A.notEqual(vm.runInContext('r16VisualKey()',c),key,k);c.state[k]=prev;}
checks.push('Physics controls preserve frozen offscreen frame; geometry, camera, quality and reference changes invalidate');
const report={passed:true,checks,protectedFiles,nativeFilterMaxError:error,limits:['Algebraic equivalence is not a GPU pixel or performance test','No consumer-device 60FPS claim']};fs.writeFileSync(path.join(P,'RENDER_UNIT_QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
