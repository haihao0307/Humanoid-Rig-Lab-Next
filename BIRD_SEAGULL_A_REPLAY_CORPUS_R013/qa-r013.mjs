import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(process.env.BIRD_R013_QA_ROOT||'artifacts/bird-r013-live');
await fs.mkdir(root,{recursive:true});
const url=process.env.BIRD_R013_QA_URL||'http://127.0.0.1:4173/?qa=1';
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const pageErrors=[],failedRequests=[],consoleEntries=[];

async function waitReady(page,label){
 let last;
 for(let i=0;i<10;i++){
  try{
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
   assert.equal(response?.status(),200,`${label}: HTTP`);
   await page.waitForFunction(()=>window.__BIRD_QA?.ready===true&&window.__BIRD_R012_QA?.ready===true&&window.__BIRD_R013_QA?.ready===true&&window.__BIRD_R013_API,null,{timeout:60000});
   await page.waitForTimeout(800);return;
  }catch(error){last=error;await page.waitForTimeout(5000)}
 }
 throw last||new Error(`${label}: R0.13 not ready`);
}
async function sourceVisible(page){
 return await page.evaluate(()=>{const c=document.getElementById('glcanvas'),gl=c?.getContext('webgl2');if(!c||!gl)return 0;const p=new Uint8Array(4);let n=0;for(let y=2;y<18;y++)for(let x=2;x<30;x++){gl.readPixels(Math.floor(x/30*c.width),Math.floor(y/18*c.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);if(p[0]+p[1]+p[2]>35)n++}return n});
}
async function audit(label,options){
 const context=await browser.newContext(options),page=await context.newPage();
 page.on('pageerror',e=>pageErrors.push({label,message:e.message}));
 page.on('requestfailed',r=>failedRequests.push({label,url:r.url(),error:r.failure()?.errorText||''}));
 page.on('console',m=>consoleEntries.push({label,type:m.type(),text:m.text()}));
 await waitReady(page,label);
 const result=await page.evaluate(()=>{
  const api=window.__BIRD_R013_API,q=window.__BIRD_R013_QA,corpus=api.corpus;
  const audit=api.verifyAll(),first=corpus.cases[0],last=corpus.cases.at(-1);
  const direct=api.consumer.consume(first.packetHex),decoded=window.__BIRD_R012_API.decodePacket(first.packetHex);
  const bad=api.consumer.fromHex(first.packetHex);bad[40]^=1;
  const reject=fn=>{try{fn();return null}catch(e){return e.message}};
  const r12Reject=reject(()=>window.__BIRD_R012_API.decodePacket(bad)),consumerReject=reject(()=>api.consumer.consume(bad));
  const restored=api.restoreCase(last.id),clock=window.__BIRD_R011_API.getClock(),controls=window.__BIRD_R010_API.getState();
  return{title:document.title,q,audit:{passCount:audit.passCount,corruptionRejectCount:audit.corruptionRejectCount,groupPassCount:audit.groupPassCount,groups:audit.groups},first,last,direct,decoded:{phaseTicks:decoded.clock.phaseTicks,rateHz:decoded.clock.rateHz,eventMask:decoded.eventMask},r12Reject,consumerReject,restored:{id:last.id,clock,controls}};
 });
 assert.match(result.title,/R0\.13/);
 assert.equal(result.q.version,'R0.13');
 assert.equal(result.q.caseCount,40);
 assert.equal(result.q.passCount,40);
 assert.equal(result.q.corruptionRejectCount,80);
 assert.equal(result.q.crossRateGroupCount,8);
 assert.equal(result.q.crossRateGroupPassCount,8);
 assert.equal(result.q.corpusSha256,'4a89b13c4b61cad871c7c1511c43b5d6648e30f375083366d3b8ce9b0c200a6a');
 assert.equal(result.q.packetBytes,66);
 assert.equal(result.q.externalRuntimeDependencies,0);
 assert.equal(result.q.controllerAffectsSourceMesh,false);
 assert.equal(result.audit.passCount,40);
 assert.equal(result.audit.corruptionRejectCount,80);
 assert.equal(result.audit.groupPassCount,8);
 assert.equal(result.direct.hex,result.first.packetHex);
 assert.equal(result.direct.phaseTicks,result.first.phaseTicks);
 assert.equal(result.direct.rateHz,result.first.rateHz);
 assert.equal(result.decoded.phaseTicks,result.first.phaseTicks);
 assert.equal(result.decoded.eventMask,result.first.eventBit);
 assert.match(result.r12Reject,/checksum/);
 assert.match(result.consumerReject,/checksum/);
 assert.equal(result.restored.clock.phaseTicks,result.last.phaseTicks);
 assert.equal(result.restored.clock.cycleIndex,result.last.cycleIndex);
 assert.equal(result.restored.clock.rateHz,result.last.rateHz);
 await page.evaluate(()=>document.querySelector('#r013Rates button[data-rate="90"]')?.click());
 await page.waitForTimeout(120);
 const filtered=await page.locator('#r013List .r013-row').count();
 assert.equal(filtered,8);
 await page.evaluate(()=>document.querySelector('#r013List .r013-row')?.click());
 const hexLength=await page.evaluate(()=>(document.getElementById('r013Hex')?.textContent||'').length);
 assert.equal(hexLength,132);
 const visible=await sourceVisible(page);assert(visible>5,`${label}: source bird not visible`);
 if(label==='mobile'){
  await page.locator('#leftMenu').click();await page.waitForTimeout(200);
  const left=await page.evaluate(()=>{const e=document.getElementById('controls'),r=e?.getBoundingClientRect();return{open:!!e?.classList.contains('open'),left:r?.left??null,right:r?.right??null}});
  assert(left.open&&left.right>100&&left.left<20,JSON.stringify(left));
  await page.locator('#leftMenu').click();await page.waitForTimeout(100);
  await page.locator('#rightMenu').click();await page.waitForTimeout(200);
  const right=await page.evaluate(()=>{const e=document.getElementById('analysis'),r=e?.getBoundingClientRect();return{open:!!e?.classList.contains('open'),left:r?.left??null,right:r?.right??null}});
  assert(right.open&&right.left<390&&right.right>300,JSON.stringify(right));
 }
 await page.screenshot({path:path.join(root,`${label}-r013.png`),fullPage:true});
 await context.close();return{label,result,filtered,hexLength,visible};
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
