import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(process.env.BIRD_R008_QA_ROOT||'artifacts/bird-r008-live');
await fs.mkdir(root,{recursive:true});
const url=process.env.BIRD_R008_QA_URL||'http://127.0.0.1:4173/?qa=1';
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const pageErrors=[],failedRequests=[],consoleEntries=[];

async function waitReady(page,label){
  let last=null;
  for(let attempt=1;attempt<=12;attempt++){
    try{
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
      assert.equal(response?.status(),200,`${label}: HTTP status`);
      await page.waitForFunction(()=>window.__BIRD_QA?.ready===true&&window.__BIRD_R007_CONTRACT_QA?.ready===true&&window.__BIRD_R008_QA?.ready===true,null,{timeout:30000});
      await page.waitForTimeout(900);
      return response;
    }catch(error){last=error;await page.waitForTimeout(10000)}
  }
  throw last||new Error(`${label}: R0.08 never became ready`);
}
async function setFrame(page,frame){
  await page.evaluate(value=>window.__BIRD_R007_API.setFrame(value),frame);
  await page.waitForTimeout(300);
}
async function canvasSample(page,id){
  return await page.evaluate(canvasId=>{
    const c=document.getElementById(canvasId);if(!(c instanceof HTMLCanvasElement))return null;
    const ctx=c.getContext('2d');if(!ctx)return null;
    const data=ctx.getImageData(0,0,c.width,c.height).data;
    const step=Math.max(4,Math.floor(Math.sqrt((c.width*c.height)/2500)));
    let visible=0,sum=0,count=0;
    for(let y=0;y<c.height;y+=step)for(let x=0;x<c.width;x+=step){
      const i=(y*c.width+x)*4,r=data[i],g=data[i+1],b=data[i+2];
      sum+=r+g+b;count++;
      if(Math.abs(r-7)+Math.abs(g-21)+Math.abs(b-28)>30)visible++;
    }
    return{visible,mean:sum/(count*3),width:c.width,height:c.height};
  },id);
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
  let changed=0,total=0;for(let i=0;i<Math.min(a.length,b.length);i++){const d=Math.abs(a[i][0]-b[i][0])+Math.abs(a[i][1]-b[i][1])+Math.abs(a[i][2]-b[i][2]);total+=d;if(d>20)changed++}return{changed,total};
}
async function audit(label,contextOptions){
  const context=await browser.newContext(contextOptions),page=await context.newPage();
  page.on('pageerror',e=>pageErrors.push({label,message:e.message,stack:e.stack||''}));
  page.on('requestfailed',r=>failedRequests.push({label,url:r.url(),failure:r.failure()?.errorText||''}));
  page.on('console',m=>consoleEntries.push({label,type:m.type(),text:m.text()}));
  await waitReady(page,label);
  const state=await page.evaluate(()=>({qa:window.__BIRD_QA,r7:window.__BIRD_R007_CONTRACT_QA,r8:window.__BIRD_R008_QA,title:document.title,status:document.getElementById('r008Status')?.textContent||''}));
  assert.equal(state.r8.ready,true);assert.equal(state.r8.version,'R0.08');assert.equal(state.r8.anchorCount,8);assert.equal(state.r8.channelCount,9);assert.equal(state.r8.sourceSamples,450);assert.equal(state.r8.controllerSamples,72);assert(Math.abs(state.r8.compression-.84)<1e-9);assert.equal(state.r8.anchorExact,true);assert.equal(state.r8.externalRuntimeDependencies,0);assert.match(state.title,/R0\.08/);assert.match(state.status,/8 锚点迁移控制器已载入/);
  for(const key of ['tipRmse','spanRmse','angleRmse','bodyRmse','tipMaxError'])assert(Number.isFinite(state.r8[key]),`${label}: ${key} not finite`);

  if(label==='mobile'){
    await page.locator('#leftMenu').click();await page.waitForTimeout(250);
    const lbox=await page.locator('#controls').boundingBox();assert(lbox&&lbox.x>=-1&&lbox.x+lbox.width<=391,`${label}: left panel outside viewport`);
  }
  await page.evaluate(()=>document.getElementById('play')?.click());
  await setFrame(page,9);const f10=await canvasPixels(page,'r008ChainCanvas');const chain10=await canvasSample(page,'r008ChainCanvas');const replay10=await canvasSample(page,'r008ReplayCanvas');
  assert(chain10&&chain10.visible>30,`${label}: controller chain not visible`);assert(replay10&&replay10.visible>30,`${label}: replay graph not visible`);
  await page.screenshot({path:path.join(root,`${label}-r008-frame-10.png`),fullPage:true});
  await setFrame(page,40);const f41=await canvasPixels(page,'r008ChainCanvas');const motion=pixelDiff(f10,f41);assert(motion.changed>20&&motion.total>1000,`${label}: controller twin did not change across reversal anchors ${JSON.stringify(motion)}`);
  await page.screenshot({path:path.join(root,`${label}-r008-frame-41.png`),fullPage:true});

  await setFrame(page,46);
  const sourceGain=await canvasPixels(page,'r008ChainCanvas');
  await page.evaluate(()=>{const s=document.getElementById('r008Asymmetry');s.value='0';s.dispatchEvent(new Event('input',{bubbles:true}))});await page.waitForTimeout(250);
  const mirrorGain=await canvasPixels(page,'r008ChainCanvas');const gainDiff=pixelDiff(sourceGain,mirrorGain);assert(gainDiff.changed>0&&gainDiff.total>0,`${label}: asymmetry control produced no canvas change`);
  const gainState=await page.evaluate(()=>window.__BIRD_R008_QA.asymmetryGain);assert.equal(gainState,0);
  await page.evaluate(()=>{const s=document.getElementById('r008Asymmetry');s.value='100';s.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('button[data-interp="linear"]')?.click()});await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>window.__BIRD_R008_QA.interpolation),'linear');
  await page.evaluate(()=>document.querySelector('button[data-interp="smoothstep"]')?.click());await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>window.__BIRD_R008_QA.interpolation),'smoothstep');

  if(label==='mobile'){
    await page.locator('#rightMenu').click();await page.waitForTimeout(300);
    const rbox=await page.locator('#analysis').boundingBox();assert(rbox&&rbox.x>=-1&&rbox.x+rbox.width<=391,`${label}: right panel outside viewport`);
    await page.screenshot({path:path.join(root,'mobile-r008-analysis.png'),fullPage:true});
  }else{
    await page.screenshot({path:path.join(root,'desktop-r008-controller.png'),fullPage:true});
  }
  await context.close();return{label,state,chain10,replay10,motion,gainDiff};
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
await fs.writeFile(path.join(root,'qa-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.error)throw new Error(report.error);
