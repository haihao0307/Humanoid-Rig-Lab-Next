import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(process.env.BIRD_R012_QA_ROOT||'artifacts/bird-r012-live');
await fs.mkdir(root,{recursive:true});
const url=process.env.BIRD_R012_QA_URL||'http://127.0.0.1:4173/?qa=1';
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],failed=[],consoleEntries=[];

async function ready(page,label){
 let last;
 for(let i=0;i<10;i++)try{
  const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});assert.equal(r?.status(),200);
  await page.waitForFunction(()=>window.__BIRD_QA?.ready===true&&window.__BIRD_R011_QA?.ready===true&&window.__BIRD_R012_QA?.ready===true&&window.__BIRD_R012_API,null,{timeout:60000});
  await page.waitForTimeout(700);return;
 }catch(e){last=e;await page.waitForTimeout(5000)}
 throw last||new Error(label+' not ready');
}
async function visible(page){return await page.evaluate(()=>{const c=document.getElementById('glcanvas'),g=c?.getContext('webgl2');if(!c||!g)return 0;const p=new Uint8Array(4);let n=0;for(let y=2;y<18;y++)for(let x=2;x<30;x++){g.readPixels(x/30*c.width|0,y/18*c.height|0,1,1,g.RGBA,g.UNSIGNED_BYTE,p);if(p[0]+p[1]+p[2]>35)n++}return n})}
async function audit(label,options){
 const context=await browser.newContext(options),page=await context.newPage();
 page.on('pageerror',e=>errors.push({label,message:e.message}));page.on('requestfailed',r=>failed.push({label,url:r.url(),error:r.failure()?.errorText||''}));page.on('console',m=>consoleEntries.push({label,type:m.type(),text:m.text()}));
 await ready(page,label);
 const result=await page.evaluate(()=>{
  const api=window.__BIRD_R012_API,clockApi=window.__BIRD_R011_API;
  const controls={rootDrive:.81234,elbowFold:.61234,bodyCoupling:.42345,asymmetryResidual:.73456,periodicClosure:.31415,interpolation:'linear'};
  const clock=clockApi.createClock({rateHz:90,phaseTicks:16560,cycleIndex:1234,eventSerial:5678,lastEvent:'MAX_SPAN_ASYMMETRY',paused:true});clock.lastEvents=[{id:'MAX_SPAN_ASYMMETRY'}];
  const first=api.encodeSnapshot({clock,controls,eventMask:32}),second=api.encodeSnapshot({clock,controls,eventMask:32}),decoded=api.decodePacket(first.bytes),reencoded=api.reencodeDecoded(decoded);
  const reject=fn=>{try{fn();return null}catch(e){return e.message}};
  const badChecksum=api.corrupt(first.bytes,40,1),checksumReject=reject(()=>api.decodePacket(badChecksum));
  const forged=new Uint8Array(first.bytes);forged[34]^=1;new DataView(forged.buffer).setUint32(62,api.fnv1a(forged),true);const contractReject=reject(()=>api.decodePacket(forged));
  const badRate=new Uint8Array(first.bytes);new DataView(badRate.buffer).setUint16(18,25,true);new DataView(badRate.buffer).setUint32(62,api.fnv1a(badRate),true);const rateReject=reject(()=>api.decodePacket(badRate));
  const badFlags=new Uint8Array(first.bytes);const fdv=new DataView(badFlags.buffer);fdv.setUint16(10,fdv.getUint16(10,true)|0x8000,true);fdv.setUint32(62,api.fnv1a(badFlags),true);const flagReject=reject(()=>api.decodePacket(badFlags));
  const events=Object.entries(api.contract.eventBits).map(([id,bit])=>{const def=window.__BIRD_R011_CLOCK.events.find(e=>e.id===id),boundary=def.phaseTicks===17640,c=clockApi.createClock({rateHz:60,phaseTicks:boundary?0:def.phaseTicks,cycleIndex:boundary?1:0,eventSerial:bit,lastEvent:id});c.lastEvents=[{id}];const e=api.encodeSnapshot({clock:c,controls,eventMask:bit}),d=api.decodePacket(e.bytes);return{id,bit,mask:d.eventMask,exact:api.reencodeDecoded(d).hex===e.hex}});
  const restored=api.restoreSnapshot(decoded),after=clockApi.getClock();
  return{title:document.title,qa:window.__BIRD_R012_QA,first:{bytes:first.bytes.length,hex:first.hex,checksum:first.checksum},deterministic:first.hex===second.hex,roundtrip:reencoded.hex===first.hex,decoded:{clock:decoded.clock,maxError:decoded.maxNormalizedError},checksumReject,contractReject,rateReject,flagReject,events,restored,after,r010:window.__BIRD_R010_QA,r011:window.__BIRD_R011_QA};
 });
 assert.match(result.title,/R0\.12/);assert.equal(result.qa.version,'R0.12');assert.equal(result.qa.packetBytes,66);assert.equal(result.qa.deterministic,true);assert.equal(result.qa.roundtrip,true);assert.equal(result.qa.externalRuntimeDependencies,0);assert.equal(result.qa.controllerAffectsSourceMesh,false);
 assert.equal(result.first.bytes,66);assert.equal(result.first.hex.length,132);assert.equal(result.deterministic,true);assert.equal(result.roundtrip,true);assert(result.decoded.maxError<=1/131070+1e-12);
 assert.match(result.checksumReject,/checksum/);assert.match(result.contractReject,/channel contract/);assert.match(result.rateReject,/rateHz/);assert.match(result.flagReject,/flags/);
 assert.equal(result.events.length,8);for(const e of result.events){assert.equal(e.mask,e.bit,e.id);assert.equal(e.exact,true,e.id)}
 assert.equal(result.after.phaseTicks,result.decoded.clock.phaseTicks);assert.equal(result.after.cycleIndex,result.decoded.clock.cycleIndex);assert.equal(result.after.rateHz,result.decoded.clock.rateHz);assert.equal(result.r010.postClampViolations,0);assert.equal(result.r011.phaseTicksPerCycle,17640);
 await page.evaluate(()=>{document.getElementById('r012Encode')?.click();document.getElementById('r012Decode')?.click();document.getElementById('r012Corrupt')?.click()});await page.waitForTimeout(150);
 const ui=await page.evaluate(()=>({status:document.getElementById('r012Status')?.textContent||'',hex:(document.getElementById('r012Hex')?.value||'').length}));assert.match(ui.status,/损坏包已拒绝/);assert.equal(ui.hex,132);
 const pixels=await visible(page);assert(pixels>5,label+' bird not visible');
 if(label==='mobile'){await page.locator('#leftMenu').click();await page.waitForTimeout(200);const l=await page.locator('#controls').boundingBox();assert(l&&l.x>=-1&&l.x+l.width<=391);await page.locator('#rightMenu').click();await page.waitForTimeout(200);const r=await page.locator('#analysis').boundingBox();assert(r&&r.x>=-1&&r.x+r.width<=391)}
 await page.screenshot({path:path.join(root,`${label}-r012.png`),fullPage:true});await context.close();return{label,result,ui,pixels};
}

let report;
try{const desktop=await audit('desktop',{viewport:{width:1600,height:1000}}),mobile=await audit('mobile',{viewport:{width:390,height:844},isMobile:true,hasTouch:true});assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failed.length,0,JSON.stringify(failed));assert.equal(consoleEntries.filter(x=>x.type==='error').length,0,JSON.stringify(consoleEntries));report={url,desktop,mobile,errors,failed,consoleEntries,error:null}}catch(e){report={url,errors,failed,consoleEntries,error:e.stack||e.message}}finally{await browser.close()}
await fs.writeFile(path.join(root,'qa-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.error)throw new Error(report.error);
