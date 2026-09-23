import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(process.env.BIRD_R006_QA_ROOT||'artifacts/bird-r006');
await fs.mkdir(root,{recursive:true});
const url=process.env.BIRD_R006_QA_URL||'http://127.0.0.1:4173/?qa=1';
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const pageErrors=[],failedRequests=[],consoleEntries=[];

async function waitForReady(page,label){
  let last=null;
  for(let attempt=1;attempt<=12;attempt++){
    try{
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
      assert.equal(response?.status(),200,`${label}: HTTP status`);
      await page.waitForFunction(()=>window.__BIRD_QA?.ready===true||window.__BIRD_QA?.ready===false,null,{timeout:30000});
      await page.waitForTimeout(1200);
      const qa=await page.evaluate(()=>window.__BIRD_QA);
      if(qa?.ready===true)return response;
      last=new Error(`${label}: ready=false ${JSON.stringify(qa)}`);
    }catch(error){last=error}
    await page.waitForTimeout(10000);
  }
  throw last||new Error(`${label}: page never became ready`);
}

async function sampleCanvas(page){
  return await page.evaluate(()=>{
    const c=document.getElementById('glcanvas');
    const gl=c?.getContext('webgl2');
    if(!c||!gl)return null;
    const out=[];const px=new Uint8Array(4);let visible=0;
    for(let yi=1;yi<31;yi++)for(let xi=1;xi<49;xi++){
      const x=Math.min(c.width-1,Math.floor(xi/49*c.width));
      const y=Math.min(c.height-1,Math.floor(yi/31*c.height));
      gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
      const rgb=[px[0],px[1],px[2]];out.push(rgb);
      if(Math.abs(rgb[0]-8)+Math.abs(rgb[1]-14)+Math.abs(rgb[2]-18)>28)visible++;
    }
    return {visible,samples:out,canvas:{width:c.width,height:c.height,clientWidth:c.clientWidth,clientHeight:c.clientHeight}};
  });
}

function sampleDifference(a,b){
  let changed=0,total=0;
  for(let i=0;i<Math.min(a.length,b.length);i++){
    total+=Math.abs(a[i][0]-b[i][0])+Math.abs(a[i][1]-b[i][1])+Math.abs(a[i][2]-b[i][2]);
    if(Math.abs(a[i][0]-b[i][0])+Math.abs(a[i][1]-b[i][1])+Math.abs(a[i][2]-b[i][2])>16)changed++;
  }
  return {changed,total};
}

async function setFrame(page,frame){
  await page.evaluate(value=>{
    const slider=document.getElementById('frameSlider');
    slider.value=String(value);
    slider.dispatchEvent(new Event('input',{bubbles:true}));
  },frame);
  await page.waitForTimeout(350);
}

async function audit(label,contextOptions){
  const context=await browser.newContext(contextOptions);const page=await context.newPage();
  page.on('pageerror',e=>pageErrors.push({label,message:e.message,stack:e.stack||''}));
  page.on('requestfailed',r=>failedRequests.push({label,url:r.url(),failure:r.failure()?.errorText||''}));
  page.on('console',m=>consoleEntries.push({label,type:m.type(),text:m.text()}));
  await waitForReady(page,label);
  const state=await page.evaluate(()=>({qa:window.__BIRD_QA,status:document.getElementById('status')?.textContent||'',frame:document.getElementById('frameText')?.textContent||''}));
  assert.equal(state.qa?.ready,true);assert.equal(state.qa.vertexCount,4416);assert.equal(state.qa.triangleCount,5624);assert.equal(state.qa.frameCount,50);assert.equal(state.qa.geometryPayloadChars,39900);assert.equal(state.qa.animationPayloadChars,30392);assert.match(state.status,/源拍翼循环已载入/);

  if(label==='mobile'){
    await page.locator('#leftMenu').click();
    await page.waitForFunction(()=>document.getElementById('controls')?.classList.contains('open'));
    await page.waitForTimeout(300);
  }

  await page.locator('#play').click();
  await setFrame(page,0);const frame01=await sampleCanvas(page);assert(frame01&&frame01.visible>20,`${label}: frame 01 bird not visibly rendered`);
  await page.screenshot({path:path.join(root,`${label}-frame-01.png`),fullPage:true});
  await setFrame(page,42);const frame43=await sampleCanvas(page);assert(frame43&&frame43.visible>20,`${label}: frame 43 bird not visibly rendered`);
  const motion=sampleDifference(frame01.samples,frame43.samples);assert(motion.changed>12&&motion.total>500,`${label}: source cycle did not create visible pose change ${JSON.stringify(motion)}`);
  assert.match(await page.locator('#frameText').textContent(),/43 \/ 50/);
  await page.screenshot({path:path.join(root,`${label}-frame-43.png`),fullPage:true});

  if(label==='mobile'){
    const box=await page.locator('#controls').boundingBox();assert(box&&box.x>=-1&&box.x+box.width<=391,`${label}: controls outside viewport`);
    await page.locator('button[data-view="top"]').click();await page.locator('#wire').click();await page.waitForTimeout(250);
    await page.screenshot({path:path.join(root,'mobile-controls-top-wire.png'),fullPage:true});
    await page.locator('#leftMenu').click();
    await page.waitForFunction(()=>!document.getElementById('controls')?.classList.contains('open'));
    await page.locator('#rightMenu').click();
    await page.waitForFunction(()=>document.getElementById('analysis')?.classList.contains('open'));
    await page.waitForTimeout(300);
    const rbox=await page.locator('#analysis').boundingBox();assert(rbox&&rbox.x>=-1&&rbox.x+rbox.width<=391,`${label}: analysis outside viewport`);
    await page.screenshot({path:path.join(root,'mobile-analysis.png'),fullPage:true});
  }else{
    await page.locator('button[data-view="top"]').click();await page.locator('#wire').click();await page.waitForTimeout(250);
    await page.screenshot({path:path.join(root,'desktop-top-wire.png'),fullPage:true});
  }
  await context.close();return{label,state,frame01:{visible:frame01.visible,canvas:frame01.canvas},frame43:{visible:frame43.visible,canvas:frame43.canvas},motion};
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
