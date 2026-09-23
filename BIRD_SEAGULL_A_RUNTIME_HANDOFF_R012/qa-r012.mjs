import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(process.env.BIRD_R012_QA_ROOT||'artifacts/bird-r012-live');
await fs.mkdir(root,{recursive:true});
const url=process.env.BIRD_R012_QA_URL||'http://127.0.0.1:4173/?qa=1';
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const pageErrors=[],failedRequests=[],consoleEntries=[];

async function waitReady(page,label){
 let last;
 for(let i=0;i<10;i++){
  try{
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
   assert.equal(response?.status(),200,`${label}: HTTP`);
   await page.waitForFunction(()=>window.__BIRD_QA?.ready===true&&window.__BIRD_R011_QA?.ready===true&&window.__BIRD_R012_QA?.ready===true&&window.__BIRD_R012_API,null,{timeout:60000});
   await page.waitForTimeout(900);return;
  }catch(error){last=error;await page.waitForTimeout(5000)}
 }
 throw last||new Error(`${label}: R0.12 not ready`);
}
async function sourceVisible(page){
 return await page.evaluate(()=>{const c=document.getElementById('glcanvas'),gl=c?.getContext('webgl2');if(!c||!gl)return 0;const p=new Uint8Array(4);let n=0;for(let y=2;y<20;y++)for(let x=2;x<34;x++){gl.readPixels(Math.floor(x/34*c.width),Math.floor(y/20*c.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);if(p[0]+p[1]+p[2]>35)n++}return n});
}
async function audit(label,options){
 const context=await browser.newContext(options),page=await context.newPage();
 page.on('pageerror',e=>pageErrors.push({label,message:e.message}));
 page.on('requestfailed',r=>failedRequests.push({label,url:r.url(),error:r.failure()?.errorText||''}));
 page.on('console',m=>consoleEntries.push({label,type:m.type(),text:m.text()}));
 await waitReady(page,label);
 const result=await page.evaluate(()=>{
  const api=window.__BIRD_R012_API,clockApi=window.__BIRD_R011_API;
  const controls={rootDrive:.81234,elbowFold:.61234,bodyCoupling:.42345,asymmetryResidual:.73456,periodicClosure:.31415,interpolation:'linear'};
  const clock=clockApi.createClock({rateHz:90,phaseTicks:16560,cycleIndex:1234,eventSerial:5678,lastEvent:'MAX_SPAN_ASYMMETRY',paused:true});
  clock.lastEvents=[{id:'MAX_SPAN_ASYMMETRY'}];
  const first=api.encodeSnapshot({clock,controls,eventMask:32}),second=api.encodeSnapshot({clock,controls,eventMask:32});
  const decoded=api.decodePacket(first.bytes),reencoded=api.reencodeDecoded(decoded);
  const reject=(fn)=>{try{fn();return null}catch(error){return error.message}};
  const corrupted=api.corrupt(first.bytes,40,1);
  const checksumReject=reject(()=>api.decodePacket(corrupted));
  const forged=new Uint8Array(first.bytes);forged[34]^=1;new DataView(forged.buffer).setUint32(62,api.fnv1a(forged),true);const contractReject=reject(()=>api.decodePacket(forged));
  const badRate=new Uint8Array(first.bytes);new DataView(badRate.buffer).setUint16(18,25,true);new DataView(badRate.buffer).setUint32(62,api.fnv1a(badRate),true);const rateReject=reject(()=>api.decodePacket(badRate));
  const badFlags=new Uint8Array(first.bytes);new DataView(badFlags.buffer).setUint16(10,new DataView(badFlags.buffer).getUint16(10,true)|0x8000,true);new DataView(badFlags.buffer).setUint32(62,api.fnv1a(badFlags),true);const flagReject=reject(()=>api.decodePacket(badFlags));
  const eventChecks=api.contract.eventBits?Object.entries(api.contract.eventBits).map(([id,bit])=>{
   const def=window.__BIRD_R011_CLOCK.events.find(e=>e.id===id);
   const boundary=def.phaseTicks===window.__BIRD_R011_CLOCK.clock.phaseTicksPerCycle;
   const c=clockApi.createClock({rateHz:60,phaseTicks:boundary?0:def.phaseTicks,cycleIndex:boundary?1:0,eventSerial:bit,lastEvent:id,paused:false});c.lastEvents=[{id}];
   const e=api.encodeSnapshot({clock:c,controls,eventMask:bit}),d=api.decodePacket(e.bytes);
   return{id,bit,phaseTicks:d.clock.phaseTicks,cycleIndex:d.clock.cycleIndex,eventMask:d.eventMask,roundtrip:api.reencodeDecoded(d).hex===e.hex};
  }):[];
  const before=clockApi.getClock();const restored=api.restoreSnapshot(decoded),after=clockApi.getClock();
  return{qa:window.__BIRD_R012_QA,title:document.title,first:{hex:first.hex,bytes:first.bytes.length,checksum:first.checksum},deterministic:first.hex===second.hex,decoded:{clock:decoded.clock,controls:decoded.controls,eventMask:decoded.eventMask,maxNormalizedError:decoded.maxNormalizedError},roundtrip:reencoded.hex===first.hex,checksumReject,contractReject,rateReject,flagReject,eventChecks,before,restored,after,r011:window.__BIRD_R011_QA,r010:window.__BIRD_R010_QA};
 });
 assert.match(result.title,/R0\.12/);
 assert.equal(result.qa.version,'R0.12');
 assert.equal(result.qa.packetBytes,66);
 assert.equal(result.qa.deterministic,true);
 assert.equal(result.qa.roundtrip,true);
 assert.equal(result.qa.externalRuntimeDependencies,0);
 assert.equal(result.qa.controllerAffectsSourceMesh,false);
 assert.equal(result.first.bytes,66);
 assert.equal(result.first.hex.length,132);
 assert.equal(result.deterministic,true);
 assert.equal(result.roundtrip,true);
 assert(result.decoded.maxNormalizedError<=1/131070+1e-12,`quantization error ${result.decoded.maxNormalizedError}`);
 assert.match(result.checksumReject,/checksum/);
 assert.match(result.contractReject,/channel contract/);
 assert.match(result.rateReject,/rateHz/);
 assert.match(result.flagReject,/flags/);
 assert.equal(result.eventChecks.length,8);
 for(const e of result.eventChecks){assert.equal(e.eventMask,e.bit,`${e.id}: event mask`);assert.equal(e.roundtrip,true,`${e.id}: roundtrip`)}
 assert.equal(result.after.phaseTicks,result.decoded.clock.phaseTicks);
 assert.equal(result.after.cycleIndex,result.decoded.clock.cycleIndex);
 assert.equal(result.after.rateHz,resu[XÛÙY˜ÛØÚËœ˜]RŠNÂˆ\ÜÙ\™\]X[
™\Ý[œŒLœÜÝÛ[\š[Û][ÛœË
NÂˆ\ÜÙ\™\]X[
™\Ý[œŒLKœ\ÙUXÚÜÔ\ÞXÛKMÍ
NÂˆ]ØZ]YÙK™]˜[X]J

OOžÂˆØÝ[Y[™Ù][[Y[žRY
	ÜŒL‘[˜ÛÙIÊOË˜ÛXÚÊ
NÂˆØÝ[Y[™Ù][[Y[žRY
	ÜŒL‘XÛÙIÊOË˜ÛXÚÊ
NÂˆØÝ[Y[™Ù][[Y[žRY
	ÜŒLÛÜœ\	ÊOË˜ÛXÚÊ
NÂˆJNÂˆ]ØZ]YÙKØZ]›Ü•[Y[Ý]
Œ
NÂˆÛÛœÝZOX]ØZ]YÙK™]˜[X]J

OOŠÜÝ]\Î™ØÝ[Y[™Ù][[Y[žRY
	ÜŒL”Ý]\ÉÊOË^ÛÛ[	ÉË^[™ÝŠØÝ[Y[™Ù][[Y[žRY
	ÜŒL’^	ÊOË˜[Y_	ÉÊK›[™ÝJJNÂˆ\ÜÙ\›X]Ú
ZKœÝ]\ËæŸååŒ…å·²æ‹’ç»/);assert.equal(ui.hexLength,132);
 const visible=await sourceVisible(page);assert(visible>5,`${label}: source bird not visible`);
 if(label==='mobile'){
  await page.locator('#leftMenu').click();await page.waitForTimeout(250);const l=await page.locator('#controls').boundingBox();assert(l&&l.x>=-1&&l.x+l.width<=391);
  await page.locator('#rightMenu').click();await page.waitForTimeout(250);const r=await page.locator('#analysis').boundingBox();assert(r&&r.x>=-1&&r.x+r.width<=391);
 }
 await page.screenshot({path:path.join(root,`${label}-r012.png`),fullPage:true});
 await context.close();return{label,result,ui,visible};
}

let report;
try{
 const desktop=await audit('desktop',{viewport:{width:1600,height:1000}});
 const mobile=await audit('mobile',{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 assert.equal(pageErrors.length,0,JSON.stringify(pageErrors));
 assert.equal(failedRequests.length,0,JSON.stringify(failedRequests));
 assert.equal(consoleEntries.filter(x=>x.type==='error').length,0,JSON.stringify(consoleEntries));
 report={url,desktop,mobile,pageErrors,failedRequests,consoleEntries,error:null};
}catch(error){report={url,pageErrors,failedRequests,consoleEntries,error:error.stack||error.message}}
finally{await browser.close()}
await fs.writeFile(path.join(root,'qa-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.error)throw new Error(report.error);
