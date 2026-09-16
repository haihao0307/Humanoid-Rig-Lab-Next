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
const diagnostics={consoleErrors:[],pageErrors:[],failedRequests:[]};
page.on('console',message=>{if(message.type()==='error')diagnostics.consoleErrors.push(message.text())});
page.on('pageerror',error=>diagnostics.pageErrors.push(String(error?.stack||error)));
page.on('requestfailed',request=>diagnostics.failedRequests.push({url:request.url(),error:request.failure()?.errorText||'unknown'}));
let fatal=null;
async function click(selector,settle=500){const item=page.locator(selector);await item.waitFor({state:'visible',timeout:60000});await item.click();await page.waitForTimeout(settle);}
async function action(name,expectedState,file,waitMs=500){
 await page.evaluate(actionName=>window.__CHICKEN_PHASE1_MOTION__.setAction(actionName),name);
 if(expectedState)await page.waitForFunction(state=>window.__CHICKEN_PHASE1_MOTION__.diagnostics().observedStates.includes(state),expectedState,{timeout:10000});
 await page.waitForTimeout(waitMs);await page.screenshot({path:path.join(evidenceDir,file),fullPage:false,animations:'disabled'});
}
try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForSelector('canvas',{timeout:60000});
 await page.waitForFunction(()=>window.__CHICKEN_R100_PATCH__&&window.__CHICKEN_PHASE1_MOTION__?.ready===true,{timeout:120000});
 await page.evaluate(()=>window.__CHICKEN_PHASE1_MOTION__.setAuto(false));
 await click('button[data-layout="solo"]');await click('button[data-focus="whole"]');await click('button[data-view="threeQuarter"]');await click('button[data-mat="procedural"]');
 await action('idle','idle_stand','R100_IDLE.png',550);
 await action('look','look','R100_LOOK.png',650);
 await action('peck','peck','R100_PECK.png',480);
 await action('walk','walk','R100_WALK.png',650);
 await action('turn','turn','R100_TURN.png',450);
 await action('run','short_run','R100_RUN.png',650);
 await page.evaluate(()=>window.__CHICKEN_PHASE1_MOTION__.setAction('wing'));
 await page.waitForFunction(()=>{const d=window.__CHICKEN_PHASE1_MOTION__.diagnostics();return d.observedStates.includes('wing_balance')||Math.max(d.pose?.wings?.leftOpen||0,d.pose?.wings?.rightOpen||0)>.35},{timeout:10000});
 await page.waitForTimeout(240);await page.screenshot({path:path.join(evidenceDir,'R100_WING_BALANCE.png'),fullPage:false,animations:'disabled'});
 await action('stop','stop','R100_STOP.png',320);
}catch(error){fatal=String(error?.stack||error);}finally{await page.waitForTimeout(250);}
const runtime=await page.evaluate(()=>({patch:window.__CHICKEN_R100_PATCH__||null,motion:window.__CHICKEN_PHASE1_MOTION__?.diagnostics()||null,errorOverlay:(()=>{const node=document.querySelector('#error');return node?{display:getComputedStyle(node).display,text:node.textContent.trim()}:null})(),canvas:(()=>{const node=document.querySelector('canvas');return node?{width:node.width,height:node.height}:null})()})).catch(error=>({evaluationError:String(error)}));
await browser.close();
const expectedFiles=['R100_IDLE.png','R100_LOOK.png','R100_PECK.png','R100_WALK.png','R100_TURN.png','R100_RUN.png','R100_WING_BALANCE.png','R100_STOP.png'];
const observed=new Set(runtime.motion?.observedStates||[]),requiredStates=['idle_stand','look','peck','walk','stop','turn','short_run'];
const checks={noFatalException:fatal===null,patchLoaded:runtime.patch?.version==='V4.6_R10.0_SINGLE_AGENT_BEHAVIOR_FOUNDATION',motionReady:runtime.motion?.ready===true,boneCount:runtime.motion?.skin?.boneCount===17,skinnedMeshes:(runtime.motion?.skin?.skinnedMeshCount||0)>0,poseApplied:(runtime.motion?.skin?.applyCount||0)>30,rigInvariants:runtime.motion?.skin?.lastInvariantReport?.passed===true,controllerErrors:(runtime.motion?.errors||[]).length===0,requiredStatesObserved:requiredStates.every(state=>observed.has(state)),wingBalanceObserved:observed.has('wing_balance')||Math.max(runtime.motion?.pose?.wings?.leftOpen||0,runtime.motion?.pose?.wings?.rightOpen||0)>.25,leftAndRightContactsBoolean:typeof runtime.motion?.pose?.contacts?.leftFoot==='boolean'&&typeof runtime.motion?.pose?.contacts?.rightFoot==='boolean',groupTestStillClosed:runtime.patch?.groupTestAuthorized===false,errorOverlayHidden:runtime.errorOverlay?.display==='none',canvasAllocated:(runtime.canvas?.width||0)>0&&(runtime.canvas?.height||0)>0,noPageErrors:diagnostics.pageErrors.length===0,noConsoleErrors:diagnostics.consoleErrors.length===0,noFailedRequests:diagnostics.failedRequests.length===0,expectedCapturesWritten:expectedFiles.every(file=>fs.existsSync(path.join(evidenceDir,file)))};
const report={schema:'life_ecosystem/chicken_r100_browser_qa@1.0',version:'V4.6_R10.0_SINGLE_AGENT_BEHAVIOR_FOUNDATION',environment:{browser:'Chrome headless via Playwright Core',url,viewport:[1440,1000]},checks,passed:Object.values(checks).every(Boolean),runtime,fatal,...diagnostics,expectedFiles,truthBoundary:{technicalMotionGateOnly:true,manualMotionNaturalnessAcceptance:false,manualVisualAcceptance:false,singleAgentGroundingComplete:false,collisionComplete:false,groupTestAuthorized:false,productionReady:false}};
fs.writeFileSync(qaPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exit(1);
