import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root=process.cwd();
const evidenceDir=path.join(root,'evidence','r100');
const qaPath=path.join(root,'qa','CHICKEN_R100_BROWSER_QA.json');
const url=process.env.CHICKEN_R100_URL||'http://127.0.0.1:8765/CHICKEN_V46_R10_0_SINGLE_AGENT.html';
const executablePath=process.env.CHROME_PATH;
if(!executablePath)throw new Error('CHROME_PATH is required');
fs.mkdirSync(evidenceDir,{recursive:true});
fs.mkdirSync(path.dirname(qaPath),{recursive:true});

const browser=await chromium.launch({
 headless:true,
 executablePath,
 args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']
});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const diagnostics={consoleErrors:[],pageErrors:[],failedRequests:[],actionFailures:[],captures:[]};
page.on('console',message=>{if(message.type()==='error')diagnostics.consoleErrors.push(message.text())});
page.on('pageerror',error=>diagnostics.pageErrors.push(String(error?.stack||error)));
page.on('requestfailed',request=>diagnostics.failedRequests.push({url:request.url(),error:request.failure()?.errorText||'unknown'}));
let fatal=null;

async function click(selector,settle=180){
 const item=page.locator(selector);
 await item.waitFor({state:'visible',timeout:60000});
 await item.click();
 await page.waitForTimeout(settle);
}

async function captureAction(name,file,options={}){
 try{
  const result=await page.evaluate(({name,options})=>{
   const api=window.__CHICKEN_PHASE1_MOTION__;
   if(!api?.diagnostics()?.manualStepAvailable)throw new Error('manual stepping API is unavailable');
   let pose;
   if(name==='stop'){
    api.runAction('run',{frames:18,dt:1/60,resetFirst:true});
    pose=api.runAction('stop',{frames:1,dt:1/60,resetFirst:false});
   }else if(name==='wing'){
    api.runAction('run',{frames:18,dt:1/60,resetFirst:true});
    pose=api.runAction('wing',{frames:2,dt:1/60,resetFirst:false});
   }else{
    pose=api.runAction(name,{frames:options.frames??1,dt:options.dt??1/60,resetFirst:true});
   }
   const diagnostics=api.diagnostics();
   return{
    requested:name,
    state:pose?.state||null,
    speed:pose?.root?.speed??null,
    contacts:pose?.contacts||null,
    wings:pose?.wings||null,
    observedStates:diagnostics.observedStates||[],
    invariantPassed:diagnostics.skin?.lastInvariantReport?.passed===true
   };
  },{name,options});
  await page.waitForTimeout(options.settleMs??240);
  await page.screenshot({path:path.join(evidenceDir,file),fullPage:false,animations:'disabled'});
  diagnostics.captures.push({...result,file});
  return result;
 }catch(error){
  diagnostics.actionFailures.push({name,file,error:String(error?.stack||error)});
  return null;
 }
}

try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForSelector('canvas',{timeout:60000});
 await page.waitForFunction(()=>{
  const api=window.__CHICKEN_PHASE1_MOTION__;
  return Boolean(window.__CHICKEN_R100_PATCH__&&window.__CHICKEN_R100_MANUAL_STEP__&&api?.ready&&api.diagnostics()?.manualStepAvailable);
 },{timeout:120000});
 await page.evaluate(()=>{
  const api=window.__CHICKEN_PHASE1_MOTION__;
  api.setAuto(false);
  api.pauseRealtime(true);
  api.reset({clearObserved:true});
 });

 await click('button[data-layout="solo"]');
 await click('button[data-focus="whole"]');
 await click('button[data-view="threeQuarter"]');
 await click('button[data-mat="procedural"]');

 await captureAction('idle','R100_IDLE.png',{frames:1,settleMs:260});
 await captureAction('look','R100_LOOK.png',{frames:12,settleMs:260});
 await captureAction('peck','R100_PECK.png',{frames:28,settleMs:260});
 await captureAction('walk','R100_WALK.png',{frames:18,settleMs:260});
 await captureAction('turn','R100_TURN.png',{frames:2,settleMs:220});
 await captureAction('run','R100_RUN.png',{frames:18,settleMs:260});
 await captureAction('stop','R100_STOP.png',{settleMs:220});
 await captureAction('wing','R100_WING_BALANCE.png',{settleMs:240});
}catch(error){
 fatal=String(error?.stack||error);
}

const runtime=await page.evaluate(()=>({
 patch:window.__CHICKEN_R100_PATCH__||null,
 manualPatch:window.__CHICKEN_R100_MANUAL_STEP__||null,
 motion:window.__CHICKEN_PHASE1_MOTION__?.diagnostics()||null,
 errorOverlay:(()=>{const node=document.querySelector('#error');return node?{display:getComputedStyle(node).display,text:node.textContent.trim()}:null})(),
 canvas:(()=>{const node=document.querySelector('canvas');return node?{width:node.width,height:node.height}:null})()
})).catch(error=>({evaluationError:String(error)}));
await browser.close();

const expectedFiles=['R100_IDLE.png','R100_LOOK.png','R100_PECK.png','R100_WALK.png','R100_TURN.png','R100_RUN.png','R100_WING_BALANCE.png','R100_STOP.png'];
const observed=new Set(runtime.motion?.observedStates||[]);
const requiredStates=['idle_stand','look','peck','walk','stop','turn','short_run'];
const byRequest=Object.fromEntries(diagnostics.captures.map(item=>[item.requested,item]));
const checks={
 noFatalException:fatal===null,
 patchLoaded:runtime.patch?.version==='V4.6_R10.0_SINGLE_AGENT_BEHAVIOR_FOUNDATION',
 manualStepLoaded:runtime.motion?.manualStepAvailable===true&&runtime.manualPatch?.version==='1.1',
 realtimePaused:runtime.motion?.realtimePaused===true,
 motionReady:runtime.motion?.ready===true,
 boneCount:runtime.motion?.skin?.boneCount===17,
 skinnedMeshes:(runtime.motion?.skin?.skinnedMeshCount||0)>0,
 poseApplied:(runtime.motion?.skin?.applyCount||0)>80,
 rigInvariants:runtime.motion?.skin?.lastInvariantReport?.passed===true,
 controllerErrors:(runtime.motion?.errors||[]).length===0,
 actionSequenceCompleted:diagnostics.actionFailures.length===0&&diagnostics.captures.length===expectedFiles.length,
 requiredStatesObserved:requiredStates.every(state=>observed.has(state)),
 requestedStateMapping:
  byRequest.idle?.state==='idle_stand'&&
  byRequest.look?.state==='look'&&
  byRequest.peck?.state==='peck'&&
  byRequest.walk?.state==='walk'&&
  byRequest.turn?.state==='turn'&&
  byRequest.run?.state==='short_run'&&
  byRequest.stop?.state==='stop',
 wingBalanceObserved:byRequest.wing?.state==='wing_balance'||Math.max(byRequest.wing?.wings?.leftOpen||0,byRequest.wing?.wings?.rightOpen||0)>.35,
 contactSignalsCaptured:diagnostics.captures.every(item=>typeof item.contacts?.leftFoot==='boolean'&&typeof item.contacts?.rightFoot==='boolean'),
 groupTestStillClosed:runtime.patch?.groupTestAuthorized===false,
 errorOverlayHidden:runtime.errorOverlay?.display==='none',
 canvasAllocated:(runtime.canvas?.width||0)>0&&(runtime.canvas?.height||0)>0,
 noPageErrors:diagnostics.pageErrors.length===0,
 noConsoleErrors:diagnostics.consoleErrors.length===0,
 noFailedRequests:diagnostics.failedRequests.length===0,
 expectedCapturesWritten:expectedFiles.every(file=>fs.existsSync(path.join(evidenceDir,file)))
};
const report={
 schema:'life_ecosystem/chicken_r100_browser_qa@1.0',
 version:'V4.6_R10.0_SINGLE_AGENT_BEHAVIOR_FOUNDATION',
 environment:{browser:'Chrome headless via Playwright Core',url,viewport:[1440,1000],captureMode:'deterministic manual stepping'},
 checks,
 passed:Object.values(checks).every(Boolean),
 runtime,
 fatal,
 ...diagnostics,
 expectedFiles,
 truthBoundary:{technicalMotionGateOnly:true,manualMotionNaturalnessAcceptance:false,manualVisualAcceptance:false,singleAgentGroundingComplete:false,collisionComplete:false,groupTestAuthorized:false,productionReady:false}
};
fs.writeFileSync(qaPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exit(1);
