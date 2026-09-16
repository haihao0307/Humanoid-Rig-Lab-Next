import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root=process.cwd();
const evidenceDir=path.join(root,'evidence','r100');
const qaPath=path.join(root,'qa','CHICKEN_R100_BROWSER_QA.json');
const url=process.env.CHICKEN_R100_URL||'http://127.0.0.1:8765/CHICKEN_V46_R10_0_SINGLE_AGENT.html';
const executablePath=process.env.CHROME_PATH;
if(!executablePath)throw new Error('CHROME_PATH is required');
fs.mkdirSync(evidenceDir,{recursive:true});fs.mkdirSync(path.dirname(qaPath),{recursive:true});
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const diagnostics={consoleErrors:[],pageErrors:[],failedRequests:[],actionFailures:[]};
page.on('console',message=>{if(message.type()==='error')diagnostics.consoleErrors.push(message.text())});
page.on('pageerror',error=>diagnostics.pageErrors.push(String(error?.stack||error)));
page.on('requestfailed',request=>diagnostics.failedRequests.push({url:request.url(),error:request.failure()?.errorText||'unknown'}));
let fatal=null;

async function click(selector,settle=500){
 const item=page.locator(selector);
 await item.waitFor({state:'visible',timeout:60000});
 await item.click();
 await page.waitForTimeout(settle);
}

async function setAction(name){
 await page.evaluate(actionName=>window.__CHICKEN_PHASE1_MOTION__.setAction(actionName),name);
}

async function waitForState(states,{timeout=10000,maxSpeed=null}={}){
 const allowed=Array.isArray(states)?states:[states];
 await page.waitForFunction(
  ({allowed,maxSpeed})=>{
   const d=window.__CHICKEN_PHASE1_MOTION__?.diagnostics();
   if(!d||!allowed.includes(d.controllerState))return false;
   if(maxSpeed!==null&&(d.pose?.root?.speed??Infinity)>maxSpeed)return false;
   return true;
  },
  {allowed,maxSpeed},
  {timeout}
 );
}

async function waitForSpeed(maxSpeed,{timeout=10000}={}){
 await page.waitForFunction(
  limit=>(window.__CHICKEN_PHASE1_MOTION__?.diagnostics()?.pose?.root?.speed??Infinity)<=limit,
  maxSpeed,
  {timeout}
 );
}

async function capture(file,settle=120){
 await page.waitForTimeout(settle);
 await page.screenshot({path:path.join(evidenceDir,file),fullPage:false,animations:'disabled'});
}

async function captureAction({name,states,file,settle=180,maxSpeed=null,precondition=null}){
 try{
  if(precondition)await precondition();
  await setAction(name);
  await waitForState(states,{maxSpeed});
  await capture(file,settle);
  return true;
 }catch(error){
  diagnostics.actionFailures.push({name,states:Array.isArray(states)?states:[states],error:String(error?.stack||error)});
  try{await capture(file,60);}catch(captureError){diagnostics.actionFailures.push({name:`${name}:capture`,error:String(captureError?.stack||captureError)});}
  return false;
 }
}

async function settleToIdle(){
 await setAction('idle');
 await waitForSpeed(.02,{timeout:12000});
 await waitForState('idle_stand',{timeout:12000,maxSpeed:.02});
}

try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForSelector('canvas',{timeout:60000});
 await page.waitForFunction(()=>window.__CHICKEN_R100_PATCH__&&window.__CHICKEN_PHASE1_MOTION__?.ready===true,{timeout:120000});
 await page.evaluate(()=>window.__CHICKEN_PHASE1_MOTION__.setAuto(false));
 await click('button[data-layout="solo"]');
 await click('button[data-focus="whole"]');
 await click('button[data-view="threeQuarter"]');
 await click('button[data-mat="procedural"]');

 await captureAction({name:'idle',states:'idle_stand',file:'R100_IDLE.png',maxSpeed:.02,settle:360,precondition:settleToIdle});
 await captureAction({name:'look',states:'look',file:'R100_LOOK.png',settle:420});
 await captureAction({name:'peck',states:'peck',file:'R100_PECK.png',settle:330,precondition:settleToIdle});
 await captureAction({name:'walk',states:'walk',file:'R100_WALK.png',settle:360,precondition:settleToIdle});

 // A step turn is only meaningful from a settled stance. Without this reset,
 // residual walking speed legitimately promotes the controller to wing_balance.
 await captureAction({name:'turn',states:'turn',file:'R100_TURN.png',settle:160,precondition:settleToIdle});
 await captureAction({name:'run',states:'short_run',file:'R100_RUN.png',settle:300,precondition:settleToIdle});

 // Capture the braking phase before it decays all the way back to idle.
 try{
  await setAction('stop');
  await waitForState('stop',{timeout:10000});
  await capture('R100_STOP.png',100);
 }catch(error){
  diagnostics.actionFailures.push({name:'stop',states:['stop'],error:String(error?.stack||error)});
  try{await capture('R100_STOP.png',60);}catch(captureError){diagnostics.actionFailures.push({name:'stop:capture',error:String(captureError?.stack||captureError)});}
 }

 // Wing balance is an emergency response rather than a normal locomotion loop.
 // The UI action also opens both wings briefly so the pose remains inspectable.
 try{
  await settleToIdle();
  await setAction('wing');
  await page.waitForFunction(()=>{
   const d=window.__CHICKEN_PHASE1_MOTION__?.diagnostics();
   return d?.controllerState==='wing_balance'||Math.max(d?.pose?.wings?.leftOpen||0,d?.pose?.wings?.rightOpen||0)>.35;
  },null,{timeout:10000});
  await capture('R100_WING_BALANCE.png',120);
 }catch(error){
  diagnostics.actionFailures.push({name:'wing',states:['wing_balance'],error:String(error?.stack||error)});
  try{await capture('R100_WING_BALANCE.png',60);}catch(captureError){diagnostics.actionFailures.push({name:'wing:capture',error:String(captureError?.stack||captureError)});}
 }
}catch(error){
 fatal=String(error?.stack||error);
}finally{
 await page.waitForTimeout(250);
}

const runtime=await page.evaluate(()=>({
 patch:window.__CHICKEN_R100_PATCH__||null,
 motion:window.__CHICKEN_PHASE1_MOTION__?.diagnostics()||null,
 errorOverlay:(()=>{const node=document.querySelector('#error');return node?{display:getComputedStyle(node).display,text:node.textContent.trim()}:null})(),
 canvas:(()=>{const node=document.querySelector('canvas');return node?{width:node.width,height:node.height}:null})()
})).catch(error=>({evaluationError:String(error)}));
await browser.close();

const expectedFiles=['R100_IDLE.png','R100_LOOK.png','R100_PECK.png','R100_WALK.png','R100_TURN.png','R100_RUN.png','R100_WING_BALANCE.png','R100_STOP.png'];
const observed=new Set(runtime.motion?.observedStates||[]);
const requiredStates=['idle_stand','look','peck','walk','stop','turn','short_run'];
const checks={
 noFatalException:fatal===null,
 patchLoaded:runtime.patch?.version==='V4.6_R10.0_SINGLE_AGENT_BEHAVIOR_FOUNDATION',
 motionReady:runtime.motion?.ready===true,
 boneCount:runtime.motion?.skin?.boneCount===17,
 skinnedMeshes:(runtime.motion?.skin?.skinnedMeshCount||0)>0,
 poseApplied:(runtime.motion?.skin?.applyCount||0)>30,
 rigInvariants:runtime.motion?.skin?.lastInvariantReport?.passed===true,
 controllerErrors:(runtime.motion?.errors||[]).length===0,
 actionSequenceCompleted:diagnostics.actionFailures.length===0,
 requiredStatesObserved:requiredStates.every(state=>observed.has(state)),
 wingBalanceObserved:observed.has('wing_balance')||Math.max(runtime.motion?.pose?.wings?.leftOpen||0,runtime.motion?.pose?.wings?.rightOpen||0)>.25,
 leftAndRightContactsBoolean:typeof runtime.motion?.pose?.contacts?.leftFoot==='boolean'&&typeof runtime.motion?.pose?.contacts?.rightFoot==='boolean',
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
 environment:{browser:'Chrome headless via Playwright Core',url,viewport:[1440,1000]},
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
