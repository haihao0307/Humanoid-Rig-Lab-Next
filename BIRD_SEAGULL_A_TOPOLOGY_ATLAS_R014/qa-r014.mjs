import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(process.env.BIRD_R014_QA_ROOT||'artifacts/bird-r014-live');
await fs.mkdir(root,{recursive:true});
const url=process.env.BIRD_R014_QA_URL||'http://127.0.0.1:4173/?qa=1';
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const pageErrors=[],failedRequests=[],consoleEntries=[];

async function waitReady(page,label){
 let last;
 for(let i=0;i<10;i++){
  try{
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
   assert.equal(response?.status(),200,`${label}: HTTP`);
   await page.waitForFunction(()=>window.__BIRD_QA?.ready===true&&window.__BIRD_R013_QA?.ready===true&&window.__BIRD_R014_QA?.ready===true&&window.__BIRD_R014_API,null,{timeout:70000});
   await page.waitForTimeout(900);return;
  }catch(error){last=error;await page.waitForTimeout(5000)}
 }
 throw last||new Error(`${label}: R0.14 not ready`);
}
async function visiblePixels(page,id){return await page.evaluate(canvasId=>{const c=document.getElementById(canvasId),g=c?.getContext('webgl2');if(!c||!g)return 0;const p=new Uint8Array(4);let n=0;for(let y=2;y<22;y++)for(let x=2;x<34;x++){g.readPixels(Math.floor(x/34*c.width),Math.floor(y/22*c.height),1,1,g.RGBA,g.UNSIGNED_BYTE,p);if(p[0]+p[1]+p[2]>35)n++}return n},id)}
async function atlasCanvasSignature(page){return await page.evaluate(()=>{const c=document.getElementById('r014Canvas'),g=c?.getContext('webgl2');if(!c||!g)return null;const p=new Uint8Array(4),out=[];for(let y=3;y<24;y+=2)for(let x=3;x<36;x+=2){g.readPixels(Math.floor(x/36*c.width),Math.floor(y/24*c.height),1,1,g.RGBA,g.UNSIGNED_BYTE,p);out.push([p[0],p[1],p[2]])}return out})}
function signatureDiff(a,b){let changed=0,total=0;for(let i=0;i<Math.min(a.length,b.length);i++){const d=Math.abs(a[i][0]-b[i][0])+Math.abs(a[i][1]-b[i][1])+Math.abs(a[i][2]-b[i][2]);total+=d;if(d>15)changed++}return{changed,total}}
async function audit(label,options){
 const context=await browser.newContext(options),page=await context.newPage();
 page.on('pageerror',e=>pageErrors.push({label,message:e.message,stack:e.stack||''}));
 page.on('requestfailed',r=>failedRequests.push({label,url:r.url(),error:r.failure()?.errorText||''}));
 page.on('console',m=>consoleEntries.push({label,type:m.type(),text:m.text()}));
 await waitReady(page,label);
 const result=await page.evaluate(()=>{
  const q=window.__BIRD_R014_QA,api=window.__BIRD_R014_API,components=api.components;
  const reciprocal=components.filter(c=>c.mirrorComponentId!=null).every(c=>components[c.mirrorComponentId]?.mirrorComponentId===c.id&&components[c.mirrorComponentId]?.mirrorPairId===c.mirrorPairId);
  const states=components.reduce((o,c)=>(o[c.adoptionState]=(o[c.adoptionState]||0)+1,o),{});
  const broad=c=>c.classification.startsWith('wing_')?'wing':c.classification.startsWith('tail_')?'tail':c.classification.startsWith('leg_')?'leg':c.classification.includes('unresolved')?'unresolved':'body';
  const regions=components.reduce((o,c)=>(o[broad(c)]=(o[broad(c)]||0)+1,o),{});
  return{title:document.title,q,componentCount:components.length,reciprocal,states,regions,firstMust:components.find(c=>c.adoptionState==='must_rebuild'&&c.mirrorComponentId!=null),body:components[4],sourceQa:window.__BIRD_QA,r013:window.__BIRD_R013_QA};
 });
 assert.match(result.title,/R0\.14/);
 assert.equal(result.q.version,'R0.14');
 assert.equal(result.q.componentCount,147);
 assert.equal(result.q.mirrorPairCount,70);
 assert.equal(result.q.centerComponentCount,7);
 assert.equal(result.q.mustRebuildCount,129);
 assert.equal(result.q.learnOnlyCount,13);
 assert.equal(result.q.unresolvedCount,5);
 assert.equal(result.q.validationFailures.length,0);
 assert.equal(result.q.externalRuntimeDependencies,0);
 assert.equal(result.q.controllerAffectsSourceMesh,false);
 assert.equal(result.componentCount,147);
 assert.equal(result.reciprocal,true);
 assert.deepEqual(result.states,{learn_only:13,unresolved:5,must_rebuild:129});
 assert.deepEqual(result.regions,{wing:107,body:3,unresolved:5,leg:5,tail:27});
 assert.equal(result.r013.passCount,40);
 const sourcePixels=await visiblePixels(page,'glcanvas');assert(sourcePixels>5,`${label}: source bird not visible`);
 const before=await atlasCanvasSignature(page);assert(before&&before.length>20);
 await page.evaluate(id=>window.__BIRD_R014_API.selectComponent(id),result.firstMust.id);await page.waitForTimeout(250);
 const selected=await page.evaluate(()=>({qa:window.__BIRD_R014_QA,current:window.__BIRD_R014_API.getSelected(),detail:document.getElementById('r014Detail')?.textContent||''}));
 assert.equal(selected.current.id,result.firstMust.id);
 assert.equal(selected.current.adoptionState,'must_rebuild');
 assert.equal(selected.qa.selectedComponentId,result.firstMust.id);
 assert.equal(selected.qa.selectedMirrorComponentId,result.firstMust.mirrorComponentId);
 assert.match(selected.detail,/必须重建/);
 const after=await atlasCanvasSignature(page),change=signatureDiff(before,after);assert(change.changed>3&&change.total>100,`${label}: component inspector did not change ${JSON.stringify(change)}`);
 const inspectorPixels=await visiblePixels(page,'r014Canvas');assert(inspectorPixels>3,`${label}: component inspector blank`);
 await page.evaluate(()=>document.querySelector('#r014Region button[data-v="wing"]')?.click());await page.waitForTimeout(100);assert.equal(await page.locator('#r014List .r014-row').count(),107);
 await page.evaluate(()=>document.querySelector('#r014Region button[data-v="all"]')?.click());
 await page.evaluate(()=>document.querySelector('#r014State button[data-v="must_rebuild"]')?.click());await page.waitForTimeout(100);assert.equal(await page.locator('#r014List .r014-row').count(),129);
 if(label==='mobile'){
  await page.locator('#leftMenu').click();await page.waitForTimeout(200);const left=await page.evaluate(()=>{const e=document.getElementById('controls'),r=e?.getBoundingClientRect();return{open:!!e?.classList.contains('open'),left:r?.left??null,right:r?.right??null}});assert(left.open&&left.right>100&&left.left<20,JSON.stringify(left));
  await page.locator('#leftMenu').click();await page.waitForTimeout(100);await page.locator('#rightMenu').click();await page.waitForTimeout(200);const right=await page.evaluate(()=>{const e=document.getElementById('analysis'),r=e?.getBoundingClientRect();return{open:!!e?.classList.contains('open'),left:r?.left??null,right:r?.right??null}});assert(right.open&&right.left<390&&right.right>300,JSON.stringify(right));
 }
 await page.screenshot({path:path.join(root,`${label}-r014.png`),fullPage:true});
 await context.close();return{label,result,sourcePixels,inspectorPixels,change,selected};
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
