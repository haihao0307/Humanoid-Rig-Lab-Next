import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(process.env.BIRD_R011_QA_ROOT||'artifacts/bird-r011-live');
await fs.mkdir(root,{recursive:true});
const url=process.env.BIRD_R011_QA_URL||'http://127.0.0.1:4173/?qa=1';
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const pageErrors=[],failedRequests=[],consoleEntries=[];

async function waitReady(page,label){
 let last;
 for(let i=0;i<10;i++){
  try{
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
   assert.equal(response?.status(),200,`${label}: HTTP`);
   await page.waitForFunction(()=>window.__BIRD_QA?.ready===true&&window.__BIRD_R010_QA?.ready===true&&window.__BIRD_R011_QA?.ready===true&&window.__BIRD_R011_API,null,{timeout:50000});
   await page.waitForTimeout(900);return;
  }catch(error){last=error;await page.waitForTimeout(5000)}
 }
 throw last||new Error(`${label}: not ready`);
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
  const api=window.__BIRD_R011_API;
  const audits=api.auditAll(10000);
  const grids=audits.map(a=>api.runGridCycles(a.rateHz));
  const a=api.createClock({rateHz:30});api.stepClock(a,137);const saved=api.serializeClock(a),b=api.restoreClock(saved);api.stepClock(a,77);api.stepClock(b,77);
  const switchClock=api.createClock({rateHz:30});api.stepClock(switchClock,17);const before=switchClock.phaseTicks;api.setRate(switchClock,90);
  return{qa:window.__BIRD_R011_QA,title:document.title,audits,grids,restore:{a,b,saved},rateSwitch:{before,after:switchClock.phaseTicks,rateHz:switchClock.rateHz},r010:window.__BIRD_R010_QA};
 });
 assert.match(result.title,/R0\.11/);
 assert.equal(resu["qa"].version,'R0.11');
 assert.deepEqual(result.qa.supportedRates,[24,30,60,90,120]);
 assert.equal(result.qa.phaseTicksPerCycle,17640);
 assert.equal(result.qa.externalRuntimeDependencies,0);
 assert.equal(resu["qa"].controllerAffectsSourceMesh,false);
 assert.equal(result.audits.length,5);
 for(const a of result.audits){
  assert.equal(a.canonicalDriftSourceFrames,0);
  if([24,120].includes(a.rateHz)){assert.equal(a.integerSamplesPerCycle,true);assert(Math.abs(a.naiveDriftSourceFrames)<1e-12)}
  else{assert.equal(a.integerSamplesPerCycle,false);assert(Math.abs(a.naiveDriftSourceFrames)>1)}
 }
 for(const g of result.grids){
  assert.equal(g.clock.phaseTicks,0,`${g.audit.rateHz}: phase grid closure`);
  assert.equal(g.clock.cycleIndex,g.audit.gridCycles,`${g.audit.rateHz}: cycle count`);
  assert.equal(g.boundaryCount,g.audit.gridCycles,`${g.audit.rateHz}: boundary events`);
  assert.equal(g.entryCount,g.audit.gridCycles,`${g.audit.rateHz}: entry events`);
 }
 assert.equal(result.restore.a.phaseTicks,result.restore.b.phaseTicks);
 assert.equal(result.restore.a.cycleIndex,result.restore.b.cycleIndex);
 assert.equal(result.restore.a.eventSerial,result.restore.b.eventSerial);
 assert.equal(result.restore.a.lastEvent,result.restore.b.lastEvent);
 assert.equal(result.rateSwitch.before,result.rateSwitch.after);
 assert.equal(result.rateSwitch.rateHz,90);
 assert.equal(result.r010.postClampViolations,0);
 const before=await page.evaluate(()=>window.__BIRD_R011_API.getClock().phaseTicks);
 await page.locator('#r011Rates button[data-rate="90"]').click();
 await page.locator('#r011Step').click();await page.waitForTimeout(200);
 const after=await page.evaluate(()=>window.__BIRD_R011_API.getClock());
 assert.equal(after.rateHz,90);assert.notEqual(after.phaseTicks,before);
 const visible=await sourceVisible(page);assert(visible>5,`${label}: source bird not visible`);
 if(label==='mobile'){
  await page.locator('#leftMenu').click();await page.waitForTimeout(250);const l=await page.locator('#controls').boundingBox();assert(l&&l.x>=-1&&l.x+l.width<=391);
  await page.locator('#rightMenu').click();await page.waitForTimeout(250);const r=await page.locator('#analysis').boundingBox();assert(r&&r.x>=-1&&r.x+r.width<=391);
 }
 await page.screenshot({path:path.join(root,`${label}-r011.png`),fullPage:true});
 await context.close();return{label,result,visible,after};
}

let report;
try{
 const desktop=await audit('desktop',{viewport:{width:1600,height:1000}});
 const mobile=await audit('mobile',{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 assert.equal(pageErrors.length,0,JSON.stringify(pageErrors));assert.equal(failedRequests.length,0,JSON.stringify(failedRequests));
 assert.equal(consoleEntries.filter(x=>x.type==='error').length,0,JSON.stringify(consoleEntries));
 report={url,desktop,mobile,pageErrors,failedRequests,consoleEntries,error:null};
}catch(error){report={url,pageErrors,failedRequests,consoleEntries,error:error.stack||error.message}}
finally{await browser.close()}
await fs.writeFile(path.join(root,'qa-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.error)throw new Error(report.error);
