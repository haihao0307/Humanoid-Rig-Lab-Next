'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const K=require('./noise-kernel.js'),N=require('./natural-yarn.js'),C=require('./core.js'),B=require('./runtime-budget.js');
const oldN=require('../r10/natural-yarn.js'),oldC=require('../r10/core.js');
const report={passed:false,legalClearance:false};let sum=0,sq=0,boundary=0,oldHashEqual=0;
for(let y=-128;y<128;y++)for(let x=-128;x<128;x++){
 const n=K.sample(x+.3125,y+.6875);A.ok(n>=0&&n<1);A.equal(n,K.sample(x+.3125,y+.6875));sum+=n;sq+=n*n;
 boundary=Math.max(boundary,Math.abs(K.sample(x-1e-7,y+.375)-K.sample(x+1e-7,y+.375)));
 const z=(x+128)+(y+128)*256;A.equal(N.H(z-32768),oldN.H(z-32768));oldHashEqual++;
 const t=((z-32768)^0x9e3779b9)>>>0;A.equal(N.H(z-32768),K.fmix32(t^(t>>>16))/4294967296);
}
report.samples=65536;report.mean=sum/65536;report.variance=sq/65536-report.mean**2;report.boundaryMaxDifference=boundary;report.unchangedParentHashSamples=oldHashEqual;
A.ok(Math.abs(report.mean-.5)<.015);A.ok(report.variance>.02&&report.variance<.06);A.ok(boundary<1e-10);
A.throws(()=>K.sample(Infinity,0));A.throws(()=>K.sample(8388608,0));
for(const f of ['distance-lod.js','dynamics.js','runtime-budget.js','stitches.js','structure.js','fiber-optics.js'])A.deepEqual(fs.readFileSync(path.join(__dirname,f)),fs.readFileSync(path.join(__dirname,'../r10',f)),f);
report.preservedGeometry=[];
for(const damage of [0,4]){
 const options={slub:.55,cotton:.78};const g=C.compile(options),o=oldC.compile(options);
 A.deepEqual(g,o);const p=B.packFibers(N.generate(C,g,damage).fibers),q=B.packFibers(oldN.generate(oldC,o,damage).fibers);
 for(const k of ['data','meta','bounds'])A.deepEqual(p[k],q[k]);
 const h=crypto.createHash('sha256').update(Buffer.from(p.data.buffer)).digest('hex');report.preservedGeometry.push({damage,pointDataSha256:h,byteIdentical:true});
}
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');A.ok(!/\bhash2\s*\(|\bn2\s*\(/.test(app));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');const b64=html.match(/atob\("([A-Za-z0-9+/=]+)"\)/)[1];const packed=zlib.gunzipSync(Buffer.from(b64,'base64')).toString();
A.ok(!/43758\.54|vec2\(127\.1,311\.7\)|\bhash2\s*\(|\bn2\s*\(/.test(packed),'Legacy sine helper survived inside executable bundle');
A.ok(packed.includes('KAOPUDenimNoise'));A.ok(html.includes('Copyright (c) 2026 Haihao'));A.ok(html.includes('Austin Appleby'));A.ok(html.includes('Krzysztof Narkowicz'));
report.executableLegacySignaturesAbsent=true;report.licenseNoticesIncluded=true;report.samePhysicsAndLOD=true;report.passed=true;
fs.writeFileSync(path.join(__dirname,'helper-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
