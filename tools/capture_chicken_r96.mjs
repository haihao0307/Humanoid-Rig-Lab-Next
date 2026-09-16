import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = process.cwd();
const evidenceDir = path.join(root, 'evidence', 'r96');
const qaPath = path.join(root, 'qa', 'CHICKEN_R96_BROWSER_QA.json');
const candidateUrl = process.env.CHICKEN_R96_URL || 'http://127.0.0.1:8765/CHICKEN_V46_R9_6_HEAD_REFINEMENT.html';
const baselineUrl = process.env.CHICKEN_R91_URL || 'http://127.0.0.1:8765/CHICKEN_V46_R9_1.html';
const executablePath = process.env.CHROME_PATH;
if (!executablePath) throw new Error('CHROME_PATH is required');
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(path.dirname(qaPath), { recursive: true });
const browser = await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const diagnostics={consoleErrors:[],pageErrors:[],failedRequests:[]};
function diag(page,prefix){page.on('console',m=>{if(m.type()==='error')diagnostics.consoleErrors.push(`${prefix}: ${m.text()}`)});page.on('pageerror',e=>diagnostics.pageErrors.push(`${prefix}: ${String(e?.stack||e)}`));page.on('requestfailed',r=>diagnostics.failedRequests.push({page:prefix,url:r.url(),error:r.failure()?.errorText||'unknown'}));}
async function click(page,selector,settle=900){const item=page.locator(selector);await item.waitFor({state:'visible',timeout:60000});await item.click();await page.waitForTimeout(settle);}
async function capture(page,name){await page.screenshot({path:path.join(evidenceDir,name),fullPage:false,animations:'disabled'});}
async function openWorkbench(url,patchName=null){const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});diag(page,patchName||'R91');await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForSelector('canvas',{timeout:60000});await page.waitForFunction(({patchName})=>{const status=document.querySelector('#status');return(!patchName||Boolean(window[patchName]))&&status&&status.textContent.trim().length>0;},{patchName},{timeout:120000});await page.waitForTimeout(5000);return page;}
async function setNeutralHead(page){await click(page,'button[data-mat="neutral"]');await click(page,'button[data-layout="solo"]');await click(page,'button[data-focus="head"]');}
let runtime=null,fatal=null;
try{
 const candidate=await openWorkbench(candidateUrl,'__CHICKEN_R96_PATCH__');
 runtime=await candidate.evaluate(()=>{const canvas=document.querySelector('canvas'),error=document.querySelector('#error');return{patch:window.__CHICKEN_R96_PATCH__||null,headAudit:window.__CHICKEN_R96_LAST_HEAD_AUDIT__||null,profileAudit:window.__CHICKEN_R96_PROFILE_AUDIT__||null,title:document.title,statusText:document.querySelector('#status')?.textContent?.trim()||'',canvas:canvas?{width:canvas.width,height:canvas.height}:null,errorOverlay:error?{display:getComputedStyle(error).display,text:error.textContent.trim()}:null};});
 await setNeutralHead(candidate);
 for(const [view,name] of [['left','R96_HEAD_NEUTRAL_LEFT.png'],['right','R96_HEAD_NEUTRAL_RIGHT.png'],['front','R96_HEAD_NEUTRAL_FRONT.png'],['top','R96_HEAD_NEUTRAL_TOP.png'],['threeQuarter','R96_HEAD_NEUTRAL_THREE_QUARTER.png']]){await click(candidate,`button[data-view="${view}"]`);await capture(candidate,name);}
 await click(candidate,'button[data-view="left"]');await click(candidate,'button[data-mat="wire"]');await capture(candidate,'R96_HEAD_WIRE_LEFT.png');
 await click(candidate,'button[data-mat="neutral"]');await click(candidate,'button[data-focus="whole"]');await click(candidate,'button[data-view="threeQuarter"]');await capture(candidate,'R96_WHOLE_NEUTRAL_THREE_QUARTER.png');
 await click(candidate,'button[data-mat="procedural"]');await capture(candidate,'R96_WHOLE_PROCEDURAL_THREE_QUARTER.png');await candidate.close();
 const baseline=await openWorkbench(baselineUrl,null);await setNeutralHead(baseline);await click(baseline,'button[data-view="left"]');await capture(baseline,'R91_BASELINE_HEAD_NEUTRAL_LEFT.png');await click(baseline,'button[data-view="threeQuarter"]');await capture(baseline,'R91_BASELINE_HEAD_NEUTRAL_THREE_QUARTER.png');await baseline.close();
}catch(error){fatal=String(error?.stack||error)}finally{await browser.close()}
const expectedCaptures=['R96_HEAD_NEUTRAL_LEFT.png','R96_HEAD_NEUTRAL_RIGHT.png','R96_HEAD_NEUTRAL_FRONT.png','R96_HEAD_NEUTRAL_TOP.png','R96_HEAD_NEUTRAL_THREE_QUARTER.png','R96_HEAD_WIRE_LEFT.png','R96_WHOLE_NEUTRAL_THREE_QUARTER.png','R96_WHOLE_PROCEDURAL_THREE_QUARTER.png','R91_BASELINE_HEAD_NEUTRAL_LEFT.png','R91_BASELINE_HEAD_NEUTRAL_THREE_QUARTER.png'];
const audit=runtime?.headAudit,profile=runtime?.profileAudit;
const checks={
 noFatalException:fatal===null,
 patchLoaded:runtime?.patch?.version==='V4.6_R9.6_CONNECTED_HEAD_REFINEMENT_CANDIDATE',
 correctTitle:runtime?.title?.includes('R9.6')===true,
 statusProduced:(runtime?.statusText?.length||0)>0,
 canvasAllocated:(runtime?.canvas?.width||0)>0&&(runtime?.canvas?.height||0)>0,
 errorOverlayHidden:runtime?.errorOverlay?.display==='none',
 headAuditProduced:audit!==null&&audit!==undefined,
 profileAuditProduced:profile!==null&&profile!==undefined,
 shapeFinite:audit?.nonFinite===0,
 lowerNeckGuardHeld:audit?.nonHeadMoved===0,
 stationXMonotonic:audit?.stationXMonotonic===true,
 boundedDisplacement:typeof audit?.maxDisplacement==='number'&&audit.maxDisplacement>0&&audit.maxDisplacement<.24,
 crownBounded:typeof profile?.crownTop==='number'&&profile.crownTop>.99&&profile.crownTop<1.02,
 headWidthBounded:typeof profile?.posteriorWidth==='number'&&profile.posteriorWidth>.13&&profile.posteriorWidth<.16,
 cheekWidthBounded:typeof profile?.cheekWidth==='number'&&profile.cheekWidth>.12&&profile.cheekWidth<.15,
 shortenedBill:typeof profile?.mappedBillTip==='number'&&profile.mappedBillTip>.48&&profile.mappedBillTip<.50,
 noPageErrors:diagnostics.pageErrors.length===0,noConsoleErrors:diagnostics.consoleErrors.length===0,noFailedRequests:diagnostics.failedRequests.length===0,
 expectedCapturesWritten:expectedCaptures.every(name=>fs.existsSync(path.join(evidenceDir,name)))
};
const report={schema:'life_ecosystem/chicken_r96_browser_qa@1.0',version:'V4.6_R9.6_CONNECTED_HEAD_REFINEMENT_CANDIDATE',environment:{browser:'Chrome headless via Playwright Core',executablePath,candidateUrl,baselineUrl,viewport:[1440,1000],rendererRequest:'SwiftShader/ANGLE correctness path'},checks,passed:Object.values(checks).every(Boolean),runtime,fatal,...diagnostics,expectedCaptures,truthBoundary:{manualVisualAcceptance:false,visualGatePassed:false,anatomicalTruthClaimed:false,rigAuthorized:false,motionAuthorized:false}};
fs.writeFileSync(qaPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exit(1);
