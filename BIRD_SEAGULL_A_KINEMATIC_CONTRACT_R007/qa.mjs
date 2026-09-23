import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(process.env.BIRD_R007_QA_ROOT||'artifacts/bird-r007');
await fs.mkdir(root,{recursive:true});
const url=process.env.BIRD_R007_QA_URL||'http://127.0.0.1:4177/?qa=1';
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const pageErrors=[],failedRequests=[],consoleEntries=[];

async function waitForReady(page,label){
  let last=null;
  for(let attempt=1;attempt<=12;attempt++){
    try{
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
      assert.equal(response?.status(),200,`${label}: HTTP status`);
      await page.waitForFunction(()=>window.__BIRD_QA?.ready===true||window.__BIRD_QA?.ready===false,null,{timeout:30000});
      await page.waitForFunction(()=>window.__BIRD_R007_CONTRACT_QA?.ready===true||window.__BIRD_R007_CONTRACT_QA?.ready===false,null,{timeout:30000});
      await page.waitForTimeout(1200);
      const state=await page.evaluate(()=>({qa:window.__BIRD_QA,contract:window.__BIRD_R007_CONTRACT_QA,status:document.getElementById('status')?.textContent||'',contractStatus:document.getElementById('contractStatus')?.textContent||''}));
      if(state.qa?.ready===true&&state.contract?.ready===true)return{response,state};
      last=new Error(`${label}: ready=false ${JSON.stringify(state)}`);
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
    return{visible,samples:out,canvas:{width:c.width,height:c.height,clientWidth:c.clientWidth,clientHeight:c.clientHeight}};
  });
}
function sampleDifference(a,b){
  let changed=0,total=0;
  for(let i=0;i<Math.min(a.length,b.length);i++){
    const d=Math.abs(a[i][0]-b[i][0])+Math.abs(a[i][1]-b[i][1])+Math.abs(a[i][2]-b[i][2]);
    total+=d;if(d>16)changed++;
  }
  return{changed,total};
}
async function setFrame(page,frameZero){
  await page.evaluate(value=>window.__BIRD_R007_API.setFrame(value),frameZero);
  await page.waitForTimeout(400);
}
async function graphEvidence(page){
  return await page.evaluate(()=>{
    const ids=['motionGraph','phaseContractGraph','velocityGraph','angleGraph','chainCanvas'];
    const result={};
    for(const id of ids){
      const c=document.getElementById(id),ctx=c?.getContext('2d');
      if(!c||!ctx){result[id]=null;continue}
      const data=ctx.getImageData(0,0,c.width,c.height).data;let changed=0;
      for(let i=0;i<data.length;i+=64){if(data[i]+data[i+1]+data[i+2]>35)changed++}
      result[id]={width:c.width,height:c.height,changed};
    }
    return result;
  });
}
async function domClick(page,selector){
  const ok=await page.evaluate(sel=>{const el=document.querySelector(sel);if(!(el instanceof HTMLElement))return false;el.click();return true},selector);
  assert(ok,`missing clickable ${selector}`);
  await page.waitForTimeout(250);
}

async function audit(label,contextOptions){
  const context=await browser.newContext(contextOptions);const page=await context.newPage();
  page.on('pageerror',e=>pageErrors.push({label,message:e.message,stack:e.stack||''}));
  page.on('requestfailed',r=>failedRequests.push({label,url:r.url(),failure:r.failure()?.errorText||''}));
  page.on('console',m=>consoleEntries.push({label,type:m.type(),text:m.text()}));
  const {response,state}=await waitForReady(page,label);
  assert.equal(state.qa.version,'R0.07');assert.equal(state.qa.vertexCount,4416);assert.equal(state.qa.triangleCount,5624);assert.equal(state.qa.frameCount,50);assert.equal(state.qa.contractReady,true);
  assert.equal(state.contract.contractVersion,'R0.07');assert.equal(state.contract.phaseCount,5);assert.equal(state.contract.eventCount,8);assert.equal(state.contract.segmentAuditCount,6);
  assert.match(state.status,/源拍翼运动合同已载入/);assert.match(state.contractStatus,/运动合同层已载入/);
  const events=await page.locator('#keyFrames button').count();assert.equal(events,7,`${label}: visible event anchor count`);
  const risks=await page.locator('#riskList .risk').count();assert.equal(risks,4,`${label}: risk count`);
  const transfers=await page.locator('#transferList .transfer').count();assert.equal(transfers,8,`${label}: transfer boundary count`);
  const segments=await page.locator('#segmentAudit > div').count();assert.equal(segments,6,`${label}: segment audit count`);

  await setFrame(page,9);const frame10=await sampleCanvas(page);assert(frame10&&frame10.visible>20,`${label}: frame 10 bird not visible`);
  assert.match(await page.locator('#contractPhase').textContent(),/下止点/);
  await page.screenshot({path:path.join(root,`${label}-frame-10.png`),fullPage:true});
  await setFrame(page,40);const frame41=await sampleCanvas(page);assert(frame41&&frame41.visible>20,`${label}: frame 41 bird not visible`);
  assert.match(await page.locator('#contractPhase').textContent(),/上止点/);
  const motion=sampleDifference(frame10.samples,frame41.samples);assert(motion.changed>12&&motion.total>500,`${label}: reversal poses did not visibly differ ${JSON.stringify(motion)}`);
  await page.screenshot({path:path.join(root,`${label}-frame-41.png`),fullPage:true});
  const graphs=await graphEvidence(page);for(const [id,g] of Object.entries(graphs)){assert(g&&g.width>100&&g.height>80&&g.changed>30,`${label}: blank graph ${id} ${JSON.stringify(g)}`)}

  if(label==='mobile'){
    await page.locator('#leftMenu').click();await page.waitForTimeout(300);
    const box=await page.locator('#controls').boundingBox();assert(box&&box.x>=-1&&box.x+box.width<=391,`${label}: controls outside viewport`);
    await domClick(page,'button[data-event="maximum_asymmetry"]');assert.match(await page.locator('#frameText').textContent(),/47 \/ 50/);
    await domClick(page,'button[data-view="top"]');await domClick(page,'#wire');
    await page.screenshot({path:path.join(root,'mobile-controls-frame47-top-wire.png'),fullPage:true});
    await page.locator('#rightMenu').click();await page.waitForTimeout(300);
    const rbox=await page.locator('#analysis').boundingBox();assert(rbox&&rbox.x>=-1&&rbox.x+rbox.width<=391,`${label}: contract panel outside viewport`);
    await page.screenshot({path:path.join(root,'mobile-contract-panel.png'),fullPage:true});
  }else{
    await domClick(page,'button[data-event="maximum_asymmetry"]');assert.match(await page.locator('#frameText').textContent(),/47 \/ 50/);
    await domClick(page,'button[data-view="top"]');await domClick(page,'#wire');
    await page.screenshot({path:path.join(root,'desktop-frame47-top-wire.png'),fullPage:true});
  }
  await context.close();
  return{label,responseStatus:response.status(),state,frame10:{visible:frame10.visible,canvas:frame10.canvas},frame41:{visible:frame41.visible,canvas:frame41.canvas},motion,graphs};
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
