import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(process.env.BIRD_R009_QA_ROOT||'artifacts/bird-r009-live');
await fs.mkdir(root,{recursive:true});
const url=process.env.BIRD_R009_QA_URL||'http://127.0.0.1:4173/?qa=1';
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const pageErrors=[],failedRequests=[],consoleEntries=[];

async function waitReady(page,label){
 let last=null;
 for(let attempt=1;attempt<=12;attempt++){
  try{
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
   assert.equal(response?.status(),200,`${label}: HTTP status`);
   await page.waitForFunction(()=>window.__BIRD_QA?.ready===true&&window.__BIRD_R008_QA?.ready===true&&window.__BIRD_R009_QA?.ready===true,null,{timeout:40000});
   await page.waitForTimeout(900);
   return response;
  }catch(error){last=error;await page.waitForTimeout(10000)}
 }
 throw last||new Error(`${label}: R0.09 never became ready`);
}
async function setFrame(page,frame){
 await page.evaluate(value=>window.__BIRD_R007_API.setFrame(value),frame);
 await page.waitForTimeout(300);
}
async function canvasPixels(page,id){
 return await page.evaluate(canvasId=>{
  const c=document.getElementById(canvasId),ctx=c?.getContext('2d');if(!c||!ctx)return null;
  const d=ctx.getImageData(0,0,c.width,c.height).data,out=[];
  const sx=Math.max(1,Math.floor(c.width/56)),sy=Math.max(1,Math.floor(c.height/36));
  for(let y=0;y<c.height;y+=sy)for(let x=0;x<c.width;x+=sx){const i=(y*c.width+x)*4;out.push([d[i],d[i+1],d[i+2]])}
  return out;
 },id);
}
function pixelDiff(a,b){
 let changed=0,total=0;
 for(let i=0;i<Math.min(a.length,b.length);i++){const d=Math.abs(a[i][0]-b[i][0])+Math.abs(a[i][1]-b[i][1])+Math.abs(a[i][2]-b[i][2]);total+=d;if(d>18)changed++}
 return{changed,total};
}
async function sampleWebGL(page){
 return await page.evaluate(()=>{
  const c=document.getElementById('glcanvas');if(!c)return null;
  const gl=c.getContext('webgl2')||c.getContext('webgl');if(!gl)return null;
  const px=new Uint8Array(4);let bright=0,samples=0,max=0,min=765;
  for(let yi=1;yi<34;yi++)for(let xi=1;xi<54;xi++){
   const x=Math.min(c.width-1,Math.floor(xi/54*c.width)),y=Math.min(c.height-1,Math.floor(yi/34*c.height));
   gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);const sum=px[0]+px[1]+px[2];max=Math.max(max,sum);min=Math.min(min,sum);if(sum>80)bright++;samples++;
  }
  return{bright,samples,max,min,canvas:{width:c.width,height:c.height,clientWidth:c.clientWidth,clientHeight:c.clientHeight}};
 });
}

async function audit(label,contextOptions){
 const context=await browser.newContext(contextOptions),page=await context.newPage();
 page.on('pageerror',e=>pageErrors.push({label,message:e.message,stack:e.stack||''}));
 page.on('requestfailed',r=>failedRequests.push({label,url:r.url(),failure:r.failure()?.errorText||''}));
 page.on('console',m=>consoleEntries.push({label,type:m.type(),text:m.text()}));
 await waitReady(page,label);
 const state=await page.evaluate(()=>({qa:window.__BIRD_QA,r8:window.__BIRD_R008_QA,r9:window.__BIRD_R009_QA,title:document.title,status:document.getElementById('r009Status')?.textContent||'',bodyReady:document.body.dataset.r009Ready||''}));
 assert.equal(state.r9.ready,true);assert.equal(state.r9.version,'R0.09');assert.equal(state.r9.groupCount,4);assert.equal(state.r9.activeChannelCount,12);assert.equal(state.r9.lockedChannelCount,2);assert.equal(state.r9.limitRowCount,12);
 assert.equal(state.r9.sourceLimitExceedances,0);assert.equal(state.r9.replayLimitExceedances,0);assert.equal(state.r9.controllerAnchorCount,8);assert.equal(state.r9.externalRuntimeDependencies,0);
 assert.equal(state.bodyReady,'true');assert.match(state.title,/R0\.09/);assert.match(state.status,/R0\.09 已载入/);
 assert.equal(await page.locator('#r009LimitRows .r009-limit').count(),12);

 if(label==='mobile'){
  await page.evaluate(()=>document.getElementById('leftMenu')?.click());await page.waitForTimeout(300);
  const lbox=await page.locator('#controls').boundingBox();assert(lbox&&lbox.x>=-1&&lbox.x+lbox.width<=391,`${label}: left panel outside viewport`);
 }
 await page.evaluate(()=>{const b=document.getElementById('play');if(b?.textContent?.includes('暂停'))b.click()});
 await setFrame(page,9);
 const webgl10=await sampleWebGL(page);assert(webgl10&&webgl10.bright>20,`${label}: source bird not visibly rendered ${JSON.stringify(webgl10)}`);
 const all10=await canvasPixels(page,'r009ChannelCanvas');assert(all10,`${label}: R0.09 canvas missing`);
 await page.screenshot({path:path.join(root,`${label}-r009-frame-10.png`),fullPage:true});

 await page.evaluate(()=>window.__BIRD_R009_API.setGroup('wing_root_drive'));await page.waitForTimeout(250);
 const rootPixels=await canvasPixels(page,'r009ChannelCanvas');
 await page.evaluate(()=>window.__BIRD_R009_API.setGroup('body_coupling'));await page.waitForTimeout(250);
 const bodyPixels=await canvasPixels(page,'r009ChannelCanvas');
 const groupDiff=pixelDiff(rootPixels,bodyPixels);assert(groupDiff.changed>20&&groupDiff.total>1000,`${label}: group isolation did not change canvas ${JSON.stringify(groupDiff)}`);

 await setFrame(page,40);
 const webgl41=await sampleWebGL(page);assert(webgl41&&webgl41.bright>20,`${label}: source bird missing at F41`);
 const frame41=await canvasPixels(page,'r009ChannelCanvas');const frameDiff=pixelDiff(all10,frame41);assert(frameDiff.changed>5&&frameDiff.total>100,`${label}: current-frame marker did not move`);
 await page.screenshot({path:path.join(root,`${label}-r009-frame-41.png`),fullPage:true});

 await page.evaluate(()=>window.__BIRD_R009_API.setAsymmetryGain(0));await page.waitForTimeout(250);
 let q=await page.evaluate(()=>window.__BIRD_R009_QA);assert.equal(q.asymmetryGain,0);assert.equal(q.anchorExact,false);
 await page.evaluate(()=>window.__BIRD_R009_API.setInterpolation('linear'));await page.waitForTimeout(250);
 q=await page.evaluate(()=>window.__BIRD_R009_QA);assert.equal(q.interpolation,'linear');assert.equal(q.replayLimitExceedances,0);
 await page.evaluate(()=>{window.__BIRD_R009_API.setAsymmetryGain(1);window.__BIRD_R009_API.setInterpolation('smoothstep');window.__BIRD_R009_API.setGroup('explicit_asymmetry')});await page.waitForTimeout(300);
 q=await page.evaluate(()=>window.__BIRD_R009_QA);assert.equal(q.asymmetryGain,1);assert.equal(q.interpolation,'smoothstep');assert.equal(q.activeGroup,'explicit_asymmetry');assert.equal(q.anchorExact,true);
 await page.screenshot({path:path.join(root,`${label}-r009-asymmetry.png`),fullPage:true});

 if(label==='mobile'){
  await page.evaluate(()=>document.getElementById('rightMenu')?.click());await page.waitForTimeout(300);
  const rbox=await page.locator('#analysis').boundingBox();assert(rbox&&rbox.x>=-1&&rbox.x+rbox.width<=391,`${label}: right panel outside viewport`);
  await page.screenshot({path:path.join(root,'mobile-r009-limits.png'),fullPage:true});
 }else{
  await page.evaluate(()=>window.__BIRD_R009_API.setGroup('wing_elbow_fold'));await page.waitForTimeout(200);
  await page.screenshot({path:path.join(root,'desktop-r009-elbow.png'),fullPage:true});
 }
 const final=await page.evaluate(()=>window.__BIRD_R009_QA);
 await context.close();
 return{label,state,final,webgl10,webgl41,groupDiff,frameDiff};
}

let report;
try{
 const desktop=await audit('desktop',{viewport:{width:1600,height:1000},deviceScaleFactor:1});
 const mobile=await audit('mobile',{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 assert.equal(pageErrors.length,0,JSON.stringify(pageErrors));assert.equal(failedRequests.length,0,JSON.stringify(failedRequests));
 const errors=consoleEntries.filter(x=>x.type==='error');assert.equal(errors.length,0,JSON.stringify(errors));
 report={url,desktop,mobile,pageErrors,failedRequests,consoleEntries,error:null};
}catch(error){report={url,pageErrors,failedRequests,consoleEntries,error:error.stack||error.message}}
finally{await browser.close()}
await fs.writeFile(path.join(root,'qa-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.error)throw new Error(report.error);
