import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root=process.cwd();
const evidenceDir=path.join(root,'evidence','r991');
const qaPath=path.join(root,'qa','CHICKEN_R991_BROWSER_QA.json');
const candidateUrl=process.env.CHICKEN_R991_URL||'http://127.0.0.1:8765/CHICKEN_V46_R9_9_1_GAMEPLAY_HEAD.html';
const baselineUrl=process.env.CHICKEN_R91_URL||'http://127.0.0.1:8765/CHICKEN_V46_R9_1.html';
const executablePath=process.env.CHROME_PATH;
if(!executablePath)throw new Error('CHROME_PATH is required');
fs.mkdirSync(evidenceDir,{recursive:true});fs.mkdirSync(path.dirname(qaPath),{recursive:true});
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const diagnostics={consoleErrors:[],pageErrors:[],failedRequests:[]};
function diag(page,prefix){page.on('console',m=>{if(m.type()==='error')diagnostics.consoleErrors.push(`${prefix}: ${m.text()}`)});page.on('pageerror',e=>diagnostics.pageErrors.push(`${prefix}: ${String(e?.stack||e)}`));page.on('requestfailed',r=>diagnostics.failedRequests.push({page:prefix,url:r.url(),error:r.failure()?.errorText||'unknown'}));}
async function click(page,selector,settle=700){const item=page.locator(selector);await item.waitFor({state:'visible',timeout:60000});await item.click();await page.waitForTimeout(settle);}
async function capture(page,name){await page.screenshot({path:path.join(evidenceDir,name),fullPage:false,animations:'disabled'});}
async function openWorkbench(url,patchName=null){const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});diag(page,patchName||'R91');await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForSelector('canvas',{timeout:60000});await page.waitForFunction(({patchName})=>{const s=document.querySelector('#status');return(!patchName||Boolean(window[patchName]))&&s&&s.textContent.trim().length>0},{patchName},{timeout:120000});await page.waitForTimeout(4000);return page;}
async function setNeutralHead(page){await click(page,'button[data-mat="neutral"]');await click(page,'button[data-layout="solo"]');await click(page,'button[data-focus="head"]');}
let runtime=null,fatal=null;
try{
 const candidate=await openWorkbench(candidateUrl,'__CHICKEN_R991_PATCH__');
 runtime=await candidate.evaluate(()=>{const canvas=document.querySelector('canvas'),error=document.querySelector('#error');return{patch:window.__CHICKEN_R991_PATCH__||null,headAudit:window.__CHICKEN_R991_HEAD_AUDIT__||null,eyeAudit:window.__CHICKEN_R991_EYE_AUDIT__||null,nostrilAudit:window.__CHICKEN_R991_NOSTRIL_AUDIT__||null,wattleAudit:window.__CHICKEN_R991_WATTLE_AUDIT__||null,partAudit:window.__CHICKEN_R991_PART_AUDIT__||null,title:document.title,statusText:document.querySelector('#status')?.textContent?.trim()||'',canvas:canvas?{width:canvas.width,height:canvas.height}:null,errorOverlay:error?{display:getComputedStyle(error).display,text:error.textContent.trim()}:null};});
 await setNeutralHead(candidate);
 for(const[view,name]of[['left','R991_HEAD_NEUTRAL_LEFT.png'],['right','R991_HEAD_NEUTRAL_RIGHT.png'],['front','R991_HEAD_NEUTRAL_FRONT.png'],['top','R991_HEAD_NEUTRAL_TOP.png'],['threeQuarter','R991_HEAD_NEUTRAL_THREE_QUARTER.png']]){await click(candidate,`button[data-view="${view}"]`);await capture(candidate,name);}
 await click(candidate,'button[data-view="left"]');await click(candidate,'button[data-mat="wire"]');await capture(candidate,'R991_HEAD_WIRE_LEFT.png');
 await click(candidate,'button[data-mat="neutral"]');await click(candidate,'button[data-focus="whole"]');await click(candidate,'button[data-view="threeQuarter"]');await capture(candidate,'R991_WHOLE_NEUTRAL_THREE_QUARTER.png');
 await click(candidate,'button[data-mat="procedural"]');await capture(candidate,'R991_WHOLE_PROCEDURAL_THREE_QUARTER.png');await candidate.close();
 const baseline=await openWorkbench(baselineUrl,null);await setNeutralHead(baseline);await click(baseline,'button[data-view="left"]');await capture(baseline,'R91_BASELINE_HEAD_NEUTRAL_LEFT.png');await click(baseline,'button[data-view="threeQuarter"]');await capture(baseline,'R91_BASELINE_HEAD_NEUTRAL_THREE_QUARTER.png');await baseline.close();
}catch(error){fatal=String(error?.stack||error);}finally{await browser.close();}
const expectedCaptures=['R991_HEAD_NEUTRAL_LEFT.png','R991_HEAD_NEUTRAL_RIGHT.png','R991_HEAD_NEUTRAL_FRONT.png','R991_HEAD_NEUTRAL_TOP.png','R991_HEAD_NEUTRAL_THREE_QUARTER.png','R991_HEAD_WIRE_LEFT.png','R991_WHOLE_NEUTRAL_THREE_QUARTER.png','R991_WHOLE_PROCEDURAL_THREE_QUARTER.png','R91_BASELINE_HEAD_NEUTRAL_LEFT.png','R91_BASELINE_HEAD_NEUTRAL_THREE_QUARTER.png'];
const h=runtime?.headAudit,e=runtime?.eyeAudit,n=runtime?.nostrilAudit,w=runtime?.wattleAudit,p=runtime?.partAudit;
const checks={noFatalException:fatal===null,patchLoaded:runtime?.patch?.version==='V4.6_R9.9.1_CONTINUOUS_RING_REFIT_CANDIDATE',correctTitle:runtime?.title?.includes('R9.9.1')===true,statusProduced:(runtime?.statusText?.length||0)>0,canvasAllocated:(runtime?.canvas?.width||0)>0&&(runtime?.canvas?.height||0)>0,errorOverlayHidden:runtime?.errorOverlay?.display==='none',headAuditProduced:h!=null,connectedCarrier:h?.connectedCarrier===true,separateBillMeshAbsent:h?.separateBillMesh===false,billTipCompressed:Math.abs((h?.targetTip??0)-.486)<1e-9,stationXMonotonic:h?.stationXMonotonic===true,shapeFinite:h?.nonFinite===0,boundedDisplacement:typeof h?.maxDisplacement==='number'&&h.maxDisplacement>0&&h.maxDisplacement<.34,lowerNeckProtected:(h?.nonHeadMoved??999)<=2,continuousRingRefit:h?.ringRefit===true,eyePatches:e?.patches===4,nostrilPatches:n?.patches===2,wattlePatches:w?.patches===2,legacyEarLobesExcluded:p?.legacyEarLobesExcluded===true,noPageErrors:diagnostics.pageErrors.length===0,noConsoleErrors:diagnostics.consoleErrors.length===0,noFailedRequests:diagnostics.failedRequests.length===0,expectedCapturesWritten:expectedCaptures.every(name=>fs.existsSync(path.join(evidenceDir,name)))};
const report={schema:'life_ecosystem/chicken_r991_browser_qa@1.0',version:'V4.6_R9.9.1_CONTINUOUS_RING_REFIT_CANDIDATE',environment:{browser:'Chrome headless via Playwright Core',candidateUrl,baselineUrl,viewport:[1440,1000]},checks,passed:Object.values(checks).every(Boolean),runtime,fatal,...diagnostics,expectedCaptures,truthBoundary:{technicalGateOnly:true,manualVisualAcceptance:false,wholeVisualGatePassed:false,rigAuthorized:false,motionAuthorized:false}};
fs.writeFileSync(qaPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exit(1);
