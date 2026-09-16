import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root=process.cwd();
const evidenceDir=path.join(root,'evidence','r984');
const qaPath=path.join(root,'qa','CHICKEN_R984_BROWSER_QA.json');
const candidateUrl=process.env.CHICKEN_R984_URL||'http://127.0.0.1:8765/CHICKEN_V46_R9_8_4_NATURAL_FACE.html';
const predecessorUrl=process.env.CHICKEN_R983_URL||'http://127.0.0.1:8765/CHICKEN_V46_R9_8_3_CLEAN_FACE.html';
const executablePath=process.env.CHROME_PATH;
if(!executablePath)throw new Error('CHROME_PATH is required');
fs.mkdirSync(evidenceDir,{recursive:true});
fs.mkdirSync(path.dirname(qaPath),{recursive:true});

const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const diagnostics={consoleErrors:[],pageErrors:[],failedRequests:[]};
function diag(page,prefix){page.on('console',m=>{if(m.type()==='error')diagnostics.consoleErrors.push(`${prefix}: ${m.text()}`)});page.on('pageerror',e=>diagnostics.pageErrors.push(`${prefix}: ${String(e?.stack||e)}`));page.on('requestfailed',r=>diagnostics.failedRequests.push({page:prefix,url:r.url(),error:r.failure()?.errorText||'unknown'}));}
async function click(page,selector,settle=850){const item=page.locator(selector);await item.waitFor({state:'visible',timeout:60000});await item.click();await page.waitForTimeout(settle);}
async function capture(page,name){await page.screenshot({path:path.join(evidenceDir,name),fullPage:false,animations:'disabled'});}
async function openWorkbench(url,patchName=null,prefix='candidate'){
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});diag(page,prefix);
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForSelector('canvas',{timeout:60000});
 await page.waitForFunction(({patchName})=>{const s=document.querySelector('#status');return(!patchName||Boolean(window[patchName]))&&s&&s.textContent.trim().length>0;},{patchName},{timeout:120000});
 await page.waitForTimeout(5000);return page;
}
async function setNeutralHead(page){await click(page,'button[data-mat="neutral"]');await click(page,'button[data-layout="solo"]');await click(page,'button[data-focus="head"]');}

let runtime=null,fatal=null;
try{
 const candidate=await openWorkbench(candidateUrl,'__CHICKEN_R984_PATCH__','R984');
 runtime=await candidate.evaluate(()=>{const canvas=document.querySelector('canvas'),error=document.querySelector('#error');return{
  patch:window.__CHICKEN_R984_PATCH__||null,
  headAudit:window.__CHICKEN_R984_LAST_HEAD_AUDIT__||null,
  profileAudit:window.__CHICKEN_R984_PROFILE_AUDIT__||null,
  billAudit:window.__CHICKEN_R984_BILL_AUDIT__||null,
  eyeAudit:window.__CHICKEN_R984_EYE_AUDIT__||null,
  wattleAudit:window.__CHICKEN_R984_WATTLE_AUDIT__||null,
  partAudit:window.__CHICKEN_R984_PART_AUDIT__||window.__CHICKEN_R983_PART_AUDIT__||null,
  title:document.title,statusText:document.querySelector('#status')?.textContent?.trim()||'',
  canvas:canvas?{width:canvas.width,height:canvas.height}:null,
  errorOverlay:error?{display:getComputedStyle(error).display,text:error.textContent.trim()}:null
 }});
 await setNeutralHead(candidate);
 for(const[view,name]of[['left','R984_HEAD_NEUTRAL_LEFT.png'],['right','R984_HEAD_NEUTRAL_RIGHT.png'],['front','R984_HEAD_NEUTRAL_FRONT.png'],['top','R984_HEAD_NEUTRAL_TOP.png'],['threeQuarter','R984_HEAD_NEUTRAL_THREE_QUARTER.png']]){await click(candidate,`button[data-view="${view}"]`);await capture(candidate,name);}
 await click(candidate,'button[data-view="left"]');await click(candidate,'button[data-mat="wire"]');await capture(candidate,'R984_HEAD_WIRE_LEFT.png');
 await click(candidate,'button[data-mat="neutral"]');await click(candidate,'button[data-focus="whole"]');await click(candidate,'button[data-view="threeQuarter"]');await capture(candidate,'R984_WHOLE_NEUTRAL_THREE_QUARTER.png');
 await click(candidate,'button[data-mat="procedural"]');await capture(candidate,'R984_WHOLE_PROCEDURAL_THREE_QUARTER.png');
 await candidate.close();

 const predecessor=await openWorkbench(predecessorUrl,'__CHICKEN_R983_PATCH__','R983');
 await setNeutralHead(predecessor);await click(predecessor,'button[data-view="left"]');await capture(predecessor,'R983_BASELINE_HEAD_NEUTRAL_LEFT.png');await click(predecessor,'button[data-view="threeQuarter"]');await capture(predecessor,'R983_BASELINE_HEAD_NEUTRAL_THREE_QUARTER.png');await predecessor.close();
}catch(error){fatal=String(error?.stack||error);}finally{await browser.close();}

const expectedCaptures=['R984_HEAD_NEUTRAL_LEFT.png','R984_HEAD_NEUTRAL_RIGHT.png','R984_HEAD_NEUTRAL_FRONT.png','R984_HEAD_NEUTRAL_TOP.png','R984_HEAD_NEUTRAL_THREE_QUARTER.png','R984_HEAD_WIRE_LEFT.png','R984_WHOLE_NEUTRAL_THREE_QUARTER.png','R984_WHOLE_PROCEDURAL_THREE_QUARTER.png','R983_BASELINE_HEAD_NEUTRAL_LEFT.png','R983_BASELINE_HEAD_NEUTRAL_THREE_QUARTER.png'];
const audit=runtime?.headAudit,profile=runtime?.profileAudit,bill=runtime?.billAudit,eye=runtime?.eyeAudit,wattle=runtime?.wattleAudit,parts=runtime?.partAudit;
const checks={
 noFatalException:fatal===null,
 patchLoaded:runtime?.patch?.version==='V4.6_R9.8_4_NATURAL_HEAD_FACE_CANDIDATE',
 correctTitle:runtime?.title?.includes('R9.8.4')===true,
 statusProduced:(runtime?.statusText?.length||0)>0,
 canvasAllocated:(runtime?.canvas?.width||0)>0&&(runtime?.canvas?.height||0)>0,
 errorOverlayHidden:runtime?.errorOverlay?.display==='none',
 headAuditProduced:audit!=null,profileAuditProduced:profile!=null,billAuditProduced:bill!=null,eyeAuditProduced:eye!=null,wattleAuditProduced:wattle!=null,partAuditProduced:parts!=null,
 shapeFinite:audit?.nonFinite===0,
 lowerNeckGuardHeld:(audit?.nonHeadMoved??999)<=2,
 stationXMonotonic:audit?.stationXMonotonic===true,
 boundedDisplacement:typeof audit?.maxDisplacement==='number'&&audit.maxDisplacement>0&&audit.maxDisplacement<.18,
 crownBounded:typeof profile?.crownTop==='number'&&profile.crownTop>.97&&profile.crownTop<1.03,
 posteriorWidthBounded:typeof profile?.posteriorWidth==='number'&&profile.posteriorWidth>.11&&profile.posteriorWidth<.16,
 cheekWidthBounded:typeof profile?.cheekWidth==='number'&&profile.cheekWidth>.09&&profile.cheekWidth<.15,
 jawBottomBounded:typeof profile?.jawBottom==='number'&&profile.jawBottom>.84&&profile.jawBottom<.91,
 billFinite:bill?.finite===true,billNoDegenerateTriangles:bill?.degenerateTriangles===0,billRootEmbedded:bill?.rootEmbedded===true,billCompact:bill?.rootX<=.410&&bill?.tipX<=.470,
 eyesSurfaceAttached:eye?.patches===4&&eye?.domes===2&&eye?.geometry==='surface_attached_dome_plus_continuous_lid',
 wattlesAttached:wattle?.patches===2&&wattle?.attached===true,
 legacyPartsExcluded:parts?.legacyEyePartsExcluded===true&&parts?.legacyEarLobesExcluded===true,
 noPageErrors:diagnostics.pageErrors.length===0,noConsoleErrors:diagnostics.consoleErrors.length===0,noFailedRequests:diagnostics.failedRequests.length===0,
 expectedCapturesWritten:expectedCaptures.every(name=>fs.existsSync(path.join(evidenceDir,name)))
};
const report={schema:'life_ecosystem/chicken_r984_browser_qa@1.0',version:'V4.6_R9.8_4_NATURAL_HEAD_FACE_CANDIDATE',environment:{browser:'Chrome headless via Playwright Core',executablePath,candidateUrl,predecessorUrl,viewport:[1440,1000],rendererRequest:'SwiftShader/ANGLE correctness path'},checks,passed:Object.values(checks).every(Boolean),runtime,fatal,...diagnostics,expectedCaptures,truthBoundary:{manualVisualAcceptance:false,visualGatePassed:false,anatomicalTruthClaimed:false,rigAuthorized:false,motionAuthorized:false}};
fs.writeFileSync(qaPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exit(1);
