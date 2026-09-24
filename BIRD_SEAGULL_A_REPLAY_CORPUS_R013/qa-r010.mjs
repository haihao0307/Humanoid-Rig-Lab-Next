import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(process.env.BIRD_R010_QA_ROOT||'artifacts/bird-r010-live');
await fs.mkdir(root,{recursive:true});
const url=process.env.BIRD_R010_QA_URL||'http://127.0.0.1:4173/?qa=1';
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const pageErrors=[],failedRequests=[],consoleEntries=[];

async function audit(label,options){
 const context=await browser.newContext(options),page=await context.newPage();
 page.on('pageerror',e=>pageErrors.push({label,message:e.message}));
 page.on('requestfailed',r=>failedRequests.push({label,url:r.url(),error:r.failure()?.errorText||''}));
 page.on('console',m=>consoleEntries.push({label,type:m.type(),text:m.text()}));
 let last;
 for(let i=0;i<10;i++){
  try{
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
   assert.equal(response?.status(),200);
   await page.waitForFunction(()=>window.__BIRD_QA?.ready===true&&window.__BIRD_R009_QA?.ready===true&&window.__BIRD_R010_QA?.ready===true,null,{timeout:40000});
   last=null;break;
  }catch(error){last=error;await page.waitForTimeout(5000)}
 }
 if(last)throw last;
 await page.waitForTimeout(900);
 const state=await page.evaluate(()=>({title:document.title,qa:window.__BIRD_R010_QA,bird:window.__BIRD_QA,body:{...document.body.dataset}}));
 assert.match(state.title,/R0\.10/);
 assert.equal(state.qa.version,'R0.10');
 assert.equal(state.qa.activeChannelCount,11);
 assert.equal(state.qa.lockedChannelCount,2);
 assert.equal(state.qa.controlGroupCount,5);
 assert.equal(state.qa.postClampViolations,0);
 assert.equal(state.qa.externalRuntimeDependencies,0);
 assert.equal(state.qa.controllerAffectsSourceMesh,false);
 const probes=await page.evaluate(()=>{
  const api=window.__BIRD_R010_API;
  return{
   normal:api.evaluateAtPhase(.4,{rootDrive:1,elbowFold:1,bodyCoupling:1,asymmetryResidual:1,periodicClosure:0}),
   rootZero:api.evaluateAtPhase(.4,{rootDrive:0,elbowFold:1,bodyCoupling:1,asymmetryResidual:1,periodicClosure:0}),
   bad:api.evaluatePacket({phase01:NaN,rootDrive:Infinity,elbowFold:-2,bodyCoupling:3,interpolation:'bad-mode',leftWristFoldDeg:99})
  }
 });
 assert.equal(probes.normal.ok,true);assert.equal(probes.rootZero.ok,true);assert.equal(probes.bad.ok,true);
 assert.notEqual(probes.normal.values.leftRootElevationDeg,probes.rootZero.values.leftRootElevationDeg);
 assert(probes.bad.diagnostics.clippedFields.length>=2);
 assert(probes.bad.diagnostics.fallbackFields.length>=2);
 assert.equal(probes.bad.diagnostics.lockedWriteRejects.length,1);
 assert.equal(probes.bad.diagnostics.postClampViolations,0);
 const visible=await page.evaluate(()=>{const c=document.getElementById('glcanvas'),gl=c?.getContext('webgl2');if(!c||!gl)return 0;const p=new Uint8Array(4);let n=0;for(let y=2;y<18;y++)for(let x=2;x<30;x++){gl.readPixels(Math.floor(x/30*c.width),Math.floor(y/18*c.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);if(p[0]+p[1]+p[2]>35)n++}return n});
 assert(visible>5,`${label}: source bird canvas not visibly rendered`);
 if(label==='mobile'){
  await page.locator('#leftMenu').click();await page.waitForTimeout(250);
  const l=await page.locator('#controls').boundingBox();assert(l&&l.x>=-1&&l.x+l.width<=391);
  await page.locator('#rightMenu').click();await page.waitForTimeout(250);
  const r=await page.locator('#analysis').boundingBox();assert(r&&r.x>=-1&&r.x+r.width<=391);
 }
 await page.screenshot({path:path.join(root,`${label}-r010.png`),fullPage:true});
 await context.close();return{label,state,probes,visible};
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
