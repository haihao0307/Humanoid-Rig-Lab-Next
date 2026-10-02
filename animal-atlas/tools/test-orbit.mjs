import fs from 'node:fs';import {playwright} from './dependencies.mjs';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const browser=await playwright().chromium.launch({headless:true,args:['--enable-webgl','--use-angle=d3d11']}),checks=[],report={startedAt:new Date().toISOString()};
try{
 const page=await browser.newPage({viewport:{width:1680,height:1000}});await page.goto(pathToFileURL(process.cwd()+'/打开动物集成工作台.html').href);await page.waitForFunction(()=>window.__ATLAS__?.ready);
 const ids=process.argv.slice(2).length?process.argv.slice(2):['fish','shark','pig','dog','lihua','cat','neutral-dog','dove','eagle','starling','chicken','crab'];
 for(const id of ids){
  await page.evaluate(id=>__ATLAS_BOOT__.select(id),id);await page.waitForFunction(id=>__ATLAS__?.current===id&&document.querySelector('#loading').hidden,id,{timeout:120000});
  await page.evaluate(async()=>{if(__ATLAS__.actions.length)await __ATLAS__.set('playing',false);await __ATLAS__.set('studioRotate',true);});
  const frame=page.frames()[1],positionBefore=await frame.evaluate(()=>window.__LIFE_VISUAL?.camera.position.toArray()),before=await page.evaluate(async()=>(await __ATLAS__.request('capture')).image);await page.waitForTimeout(600);
  const positionAfter=await frame.evaluate(()=>window.__LIFE_VISUAL?.camera.position.toArray()),after=await page.evaluate(async()=>(await __ATLAS__.request('capture')).image);
  // Avoid embedding image data in assertion diagnostics.
  assert.ok(before!==after,'Automatic orbit must change rendered pixels: '+id);if(positionBefore)assert.notDeepEqual(positionBefore,positionAfter,'Automatic orbit must change the actual life camera: '+id);
  checks.push({id,renderChanged:true,lifeCameraChanged:positionBefore?true:undefined});console.log('ORBIT',id);
 }
 report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;console.log('FAILED',e.stack);}finally{report.completedAt=new Date().toISOString();fs.writeFileSync('qa/ORBIT_REPORT.json',JSON.stringify({...report,checks},null,2));await browser.close();}if(!report.passed)process.exitCode=1;
