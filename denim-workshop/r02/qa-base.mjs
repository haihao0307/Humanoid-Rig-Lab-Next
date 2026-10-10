import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const out=process.env.QA_DIR||'denim-r02-evidence';fs.mkdirSync(out,{recursive:true});
const local=pathToFileURL(path.resolve('denim-workshop/r02/index.html')).href;
const browser=await chromium.launch({headless:false,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
async function test(url,label,full){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,acceptDownloads:true});const page=await ctx.newPage();const errors=[],requests=[];let result={url,label,passed:false};
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.location().url?.endsWith('/favicon.ico'))errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
 try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.__DENIM_WORKBENCH__?.ready===true,null,{timeout:120000});await page.waitForTimeout(500);
  const info=await page.evaluate(()=>({version:__DENIM_WORKBENCH__.version,audit:__DENIM_WORKBENCH__.audit(),frame:__DENIM_WORKBENCH__.lastFrame,glError:__DENIM_WORKBENCH__.getGLError()}));assert.equal(info.version,'R02.0');assert.equal(info.audit.yarns,350);assert.equal(info.audit.wrongCrossingOrder,0);assert.equal(info.glError,0);assert.ok(info.frame.frame>0);
  await page.screenshot({path:`${out}/${label}-desktop.png`});const before=digest(await page.locator('#view').screenshot());
  await page.locator('[data-preset="vintage"]').click();await page.waitForTimeout(600);const washed=digest(await page.locator('#view').screenshot());assert.notEqual(before,washed);assert.equal(await page.evaluate(()=>__DENIM_WORKBENCH__.profile().finish.recipe),'vintage');
  await page.locator('#back').click();await page.waitForTimeout(300);const back=digest(await page.locator('#view').screenshot());assert.notEqual(washed,back);await page.screenshot({path:`${out}/${label}-back.png`});
  await page.locator('#shape').selectOption('2');await page.locator('#angle').click();await page.waitForTimeout(300);await page.screenshot({path:`${out}/${label}-rolled-edge.png`});
  let gpuCrossings,aliasing;
  if(full){
   gpuCrossings=await page.evaluate(()=>__DENIM_WORKBENCH__.auditGPU());assert.equal(gpuCrossings.checked,26656);assert.equal(gpuCrossings.wrong,0);
   for(const v of ['1','2','3','0']){await page.locator('#weave').selectOption(v);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>__DENIM_WORKBENCH__.getGLError()),0);}
   await page.evaluate(()=>__DENIM_WORKBENCH__.setState({shape:0,zoom:.4,yaw:0,pitch:0,seam:false,fuzz:0,animate:false}));
   const aliasValues={};for(const disabled of [true,false]){let prior=null,sum=0,count=0;for(let k=0;k<8;k++){await page.evaluate(v=>__DENIM_WORKBENCH__.setState(v),{qaDisableFilter:disabled,qaPanX:k*.125*250/938});await page.waitForTimeout(60);const rgba=await page.evaluate(()=>{__DENIM_WORKBENCH__.renderNow();return __DENIM_WORKBENCH__.samplePatch();});if(prior){for(let j=0;j<rgba.length;j++){if(j%4===3)continue;sum+=Math.abs(rgba[j]-prior[j]);count++;}}prior=rgba;}aliasValues[disabled?'nearestLevel0':'filtered']=sum/count;}
   aliasing={...aliasValues,relativeReduction:1-aliasValues.filtered/aliasValues.nearestLevel0,scope:'eight 0.125px phases, flat swatch, fixed light, 160px interior; relative to own nearest level-0 baseline, not universal no-flicker proof'};assert.ok(aliasValues.filtered<aliasValues.nearestLevel0);await page.evaluate(()=>__DENIM_WORKBENCH__.setState({qaDisableFilter:false,qaPanX:0}));
   await page.locator('#thickness').evaluate(e=>{e.value='.94';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>__DENIM_WORKBENCH__.profile().graph.thickness),.94);
   const download=page.waitForEvent('download');await page.locator('#save').click();const f=await download;await f.saveAs(`${out}/profile.json`);const profile=JSON.parse(fs.readFileSync(`${out}/profile.json`));assert.equal(profile.schema,'kaopu.denim_material_profile@2.0');assert.equal(profile.limits.clothSolver,false);
   await page.evaluate(()=>__DENIM_WORKBENCH__.setState({zoom:2.7,yaw:0,pitch:0,shape:1}));await page.waitForTimeout(400);assert.ok((await page.evaluate(()=>__DENIM_WORKBENCH__.lastFrame.nearWeight))>.9);await page.screenshot({path:`${out}/${label}-real-yarns-internal-only.png`});
   await page.evaluate(()=>__DENIM_WORKBENCH__.setState({zoom:.40}));await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>__DENIM_WORKBENCH__.lastFrame.nearWeight),0);
  }
  await page.waitForTimeout(500);const idle0=await page.evaluate(()=>__DENIM_WORKBENCH__.lastFrame.frame);await page.waitForTimeout(500);const idle1=await page.evaluate(()=>__DENIM_WORKBENCH__.lastFrame.frame);assert.equal(idle0,idle1);
  assert.equal(await page.evaluate(()=>__DENIM_WORKBENCH__.getGLError()),0);assert.deepEqual(errors,[]);if(url.startsWith('file:'))assert.equal(requests.filter(u=>u.startsWith('http')).length,0);
  result={...result,passed:true,info,gpuCrossings,aliasing,canvasHashes:{before,washed,back},idleFrames:[idle0,idle1],errors,requests};console.log(JSON.stringify(result));
 }catch(e){result.error=String(e);await page.screenshot({path:`${out}/${label}-failure.png`}).catch(()=>{});throw e;}finally{fs.writeFileSync(`${out}/${label}.json`,JSON.stringify(result,null,2));await ctx.close();}
}
async function mobile(url){const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e)));await p.goto(url,{waitUntil:'domcontentloaded',timeout:90000});await p.waitForFunction(()=>window.__DENIM_WORKBENCH__?.ready===true,null,{timeout:120000});await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>__DENIM_WORKBENCH__.getGLError()),0);const bounds=await p.locator('#view').boundingBox();assert.ok(bounds.width>300&&bounds.height>300);await p.screenshot({path:`${out}/mobile-390x844-viewport-not-device.png`,fullPage:true});assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/mobile.json`,JSON.stringify({viewport:[390,844],actualPhone:false,errors,bounds,frame:await p.evaluate(()=>__DENIM_WORKBENCH__.lastFrame)},null,2));await ctx.close();}
try{await test(local,'local-file',true);if(!process.env.PUBLIC_URL)throw Error('PUBLIC_URL required for delivery');await test(process.env.PUBLIC_URL,'public-fixed',false);await mobile(process.env.PUBLIC_URL);console.log('DENIM_R02_QA_PASSED');}finally{await browser.close();}
