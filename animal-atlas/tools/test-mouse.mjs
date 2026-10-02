import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {playwright} from './dependencies.mjs';
const browser=await playwright().chromium.launch({headless:true,args:['--enable-webgl','--use-angle=d3d11']}),context=await browser.newContext({viewport:{width:1680,height:1000},acceptDownloads:true}),page=await context.newPage(),entries=[],checks=[],errors=[],report={startedAt:new Date().toISOString()};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const ready=id=>page.waitForFunction(id=>window.__ATLAS__?.ready&&(!id||__ATLAS__.current===id)&&document.querySelector('#loading').hidden,id,{timeout:120000});
async function frame(){return page.frames().find(f=>f.url()==='about:srcdoc');}
async function settle(){await (await frame()).evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function camera(){return (await frame()).evaluate(()=>{
 const c=__ATLAS_CONTEXT;
 if(c.adapter==='fish'){const r=__KAOPU_R13__.renderer;return Array.from(r.camera.mvp(r.canvas.width/r.canvas.height).view);}
 if(c.adapter==='cat')return Array.from(__ATLAS_CAT_CAMERA_MATRICES__.view);
 if(c.adapter==='eagle')return Array.from(eagle.camera().view);
 const n=c.adapter==='native'?__ATLAS_NATIVE:c.adapter==='imported'?__ATLAS_IMPORTED:c.adapter==='life'?__LIFE_VISUAL:c.adapter==='chicken'?__ATLAS_CHICKEN_STAGE:c.adapter==='palau'?birdWorkbench.getStages().find(s=>s.id===c.key):null;
 const cam=n?.camera||(c.adapter==='crab'?(__CRAB_QA__.state.stage==='beach'?__CRAB_QA__.beachCamera:__CRAB_QA__.cameras[c.key==='coconut'?1:0]):null);
 return cam.matrixWorld.toArray();
});}
async function drag(dx,dy){const box=await page.locator('#stage').boundingBox(),x=box.x+box.width*.56,y=box.y+box.height*.46;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up();await settle();}
async function check(id,mode='turntable'){
 await page.evaluate(async mode=>{if(__ATLAS__.actions.length)await __ATLAS__.set('playing',false);await __ATLAS__.set('studioRotate',false);await __ATLAS__.set('displayStage',mode);await __ATLAS__.set('view','three');},mode);await settle();
 const before=(await page.evaluate(()=>__ATLAS__.request('capture'))).image,a=await camera();await drag(105,0);const b=await camera(),after=(await page.evaluate(()=>__ATLAS__.request('capture'))).image;assert.notDeepEqual(a,b,id+' '+mode+' horizontal camera');assert.ok(before!==after,id+' '+mode+' horizontal pixels');
 await drag(0,60);const d=await camera();assert.notDeepEqual(b,d,id+' '+mode+' vertical camera');const input=await (await frame()).evaluate(()=>__ATLAS_STUDIO_INPUT.snapshot());assert.equal(input.dragging,false);assert.ok(input.moves>=16);entries.push({id,mode,horizontalCameraChanged:true,verticalCameraChanged:true,pixelsChanged:true});console.log('MOUSE',id,mode);
}
try{
 await page.goto(pathToFileURL(process.cwd()+'/打开动物集成工作台.html').href,{timeout:120000});await ready();
 const catalog=await page.evaluate(()=>__ATLAS__.catalog),ids=process.argv.slice(2).length?process.argv.slice(2):catalog.map(a=>a.id);
 for(const id of ids){await page.evaluate(id=>__ATLAS_BOOT__.select(id),id);await ready(id);await check(id);await check(id,'habitat');}
 checks.push('actual horizontal and vertical mouse drag verified in turntable and original environment');
 if(!process.argv.slice(2).length){
  const panel=await page.locator('#inspector').boundingBox(),stage=await page.locator('#stage').boundingBox();assert.ok(stage.x+stage.width<=panel.x+1);checks.push('parameter panel sits at the far right of the stage');
  for(const fixture of ['examples/k4.kaopu.json','qa/exports/cat.glb']){await page.locator('#import-animal').click();await page.locator('#import-file').setInputFiles(fixture);await page.waitForFunction(()=>/验证通过/.test(document.querySelector('#import-status').textContent),null,{timeout:120000});const previousId=await page.evaluate(()=>__ATLAS__.current);await page.locator('#import-commit').click();await page.waitForFunction(id=>__ATLAS__?.current!==id&&document.querySelector('#loading').hidden,previousId,{timeout:120000});await ready();const id=await page.evaluate(()=>__ATLAS__.current);await check(id);}
  await page.evaluate(()=>__ATLAS_BOOT__.select('starling'));await ready('starling');await page.evaluate(async()=>{await __ATLAS__.set('playing',false);await __ATLAS__.set('studioRotate',true);await __ATLAS__.set('displayStage','turntable');});
  const box=await page.locator('#stage').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+80,box.y+box.height*.45,{steps:8});await settle();const held=await camera();await page.waitForTimeout(200);assert.deepEqual(await camera(),held);await page.mouse.up();await page.waitForTimeout(1800);const resumed=await camera();await page.waitForTimeout(300);assert.notDeepEqual(await camera(),resumed);checks.push('drag holds automatic rotation and release resumes it');
  await page.evaluate(()=>__ATLAS__.set('studioRotate',false));await drag(0,-40);await page.locator('[data-view="three"]').click();await settle();await page.screenshot({path:'qa/FINAL_MOUSE_LEFT_PANEL.png'});
  await page.locator('#studio-panel-tab').click();await page.screenshot({path:'qa/FINAL_MOUSE_LIGHTS.png'});await page.setViewportSize({width:390,height:844});await page.locator('#panel-toggle').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'qa/FINAL_MOUSE_MOBILE.png'});checks.push('fresh desktop and right mobile drawer screenshots captured');
 }
 assert.deepEqual(errors,[]);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;console.log('FAILED',e.stack);await page.screenshot({path:'qa/MOUSE_FAILURE.png'}).catch(()=>{});}finally{report.completedAt=new Date().toISOString();fs.writeFileSync('qa/MOUSE_REPORT.json',JSON.stringify({...report,entries,checks,errors},null,2));await browser.close();}if(!report.passed)process.exitCode=1;
