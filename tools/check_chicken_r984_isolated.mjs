import fs from 'node:fs';
import { chromium } from 'playwright-core';

const executablePath=process.env.CHROME_PATH;
const url=process.env.CHICKEN_R984_URL||'http://127.0.0.1:8765/CHICKEN_V46_R9_8_4_NATURAL_FACE.html';
const output='qa/CHICKEN_R984_ISOLATED_HEAD_QA.json';
if(!executablePath)throw new Error('CHROME_PATH is required');

const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const pageErrors=[];const consoleErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
let runtime=null,fatal=null;
try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForSelector('canvas',{timeout:60000});
 await page.waitForFunction(()=>Boolean(window.__CHICKEN_R984_INDEPENDENT_HEAD_AUDIT__&&window.__CHICKEN_R984_CULL_AUDIT__),null,{timeout:120000});
 await page.waitForTimeout(3000);
 runtime=await page.evaluate(()=>({
  head:window.__CHICKEN_R984_INDEPENDENT_HEAD_AUDIT__||null,
  cull:window.__CHICKEN_R984_CULL_AUDIT__||null,
  carrier:window.__CHICKEN_R984_LAST_HEAD_AUDIT__||null,
  profile:window.__CHICKEN_R984_PROFILE_AUDIT__||null,
  patch:window.__CHICKEN_R984_PATCH__||null,
  status:document.querySelector('#status')?.textContent?.trim()||''
 }));
}catch(error){fatal=String(error?.stack||error);}finally{await browser.close();}
const checks={
 noFatalException:fatal===null,
 independentHeadProduced:runtime?.head!=null,
 independentHeadFinite:runtime?.head?.finite===true,
 independentHeadNoDegenerateTriangles:runtime?.head?.degenerateTriangles===0,
 independentHeadDenseEnough:(runtime?.head?.vertices||0)>5000,
 legacyBodyHeadTrianglesRemoved:(runtime?.cull?.removedBodyTriangles||0)>0,
 legacyCoatHeadTrianglesRemoved:(runtime?.cull?.removedCoatTriangles||0)>0,
 lowerNeckGuardHeld:(runtime?.carrier?.nonHeadMoved??999)<=2,
 carrierStationOrderHeld:runtime?.carrier?.stationXMonotonic===true,
 correctVersion:runtime?.patch?.version==='V4.6_R9.8_4_NATURAL_HEAD_FACE_CANDIDATE',
 statusProduced:(runtime?.status?.length||0)>0,
 noPageErrors:pageErrors.length===0,
 noConsoleErrors:consoleErrors.length===0
};
const report={schema:'life_ecosystem/chicken_r984_isolated_head_qa@1.0',version:'V4.6_R9.8_4_NATURAL_HEAD_FACE_CANDIDATE',checks,passed:Object.values(checks).every(Boolean),runtime,fatal,pageErrors,consoleErrors,truthBoundary:{manualVisualAcceptance:false,visualGatePassed:false,rigAuthorized:false,motionAuthorized:false}};
fs.mkdirSync('qa',{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exit(1);
