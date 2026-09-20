// Real-browser R2.4 evidence. This captures the two leg tubes after the
// original centre-front and centre-back rise seams are joined. The independent
// gusset, left side closure and all waistbands remain open and untouched.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire('/tmp/shorts-browser/package.json');
const {chromium}=require('playwright');
const output=process.env.SHORTS_R24_OUTPUT||'/tmp/shorts-r24-rise';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
page.setDefaultTimeout(600000);
const errors=[];page.on('pageerror',error=>errors.push(String(error.stack||error)));
let report=null;
try{
  await page.goto('http://127.0.0.1:8793/shorts.html?shorts=1&shortsSteps=0&shortsStage=r2.4-rise',{waitUntil:'domcontentloaded',timeout:600000});
  await page.waitForFunction(()=>window.__startupError||['rise-ready','rise-checkpoint-failed'].includes(window.HumanLab?.compact?.skirt?.assemblyState),null,{timeout:600000});
  const startup=await page.evaluate(()=>({error:window.__startupError||null,status:window.__humanStartup||null}));if(startup.error)throw Error(startup.error);
  report=await page.evaluate(()=>window.HumanLab.garment.report());const rise=report.rise;
  fs.writeFileSync(path.join(output,'rise-report.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(output,'browser-errors.json'),JSON.stringify(errors,null,2));
  const view=async(name,yaw,pitch=.035,distance=1.18,targetOffset=[0,-.11,0])=>{
    await page.evaluate(({yaw,pitch,distance,targetOffset})=>{const l=window.HumanLab,r=l.renderer,h=l.human,s=h.bodyMetrics.statureScale,hip=h.world('hips').p;l.setAuto(false);l.setCameraFollow(false);r.target=[hip[0]+targetOffset[0]*s,hip[1]+targetOffset[1]*s,hip[2]+targetOffset[2]*s];r.distance=distance*s;r.yaw=l.agent.yaw+yaw;r.pitch=pitch;r.projection='perspective';l.render();},{yaw,pitch,distance,targetOffset});
    await page.screenshot({path:path.join(output,name+'.png')});
  };
  await view('01-angle',.48,.055,1.22,[0,-.10,0]);
  await view('02-front',0,.018,1.04,[0,-.10,0]);
  await view('03-back',Math.PI,.018,1.04,[0,-.10,0]);
  await view('04-left-side',-Math.PI/2,.018,1.02,[0,-.10,0]);
  await view('05-right-side',Math.PI/2,.018,1.02,[0,-.10,0]);
  await view('06-front-rise-close',0,-.12,.74,[0,-.11,.02]);
  await view('07-back-rise-close',Math.PI,-.12,.74,[0,-.11,-.02]);
  await view('08-crotch-below',0,-.66,.88,[0,-.16,0]);
  await page.setViewportSize({width:390,height:844});await view('09-mobile-front',0,.02,1.30,[0,-.10,0]);
  const completed=new Set(['outseam-left','inseam-left','outseam-right','inseam-right','center-front','center-back']);
  const futureStarted=report.simulation.seams.filter(seam=>!completed.has(seam.id)&&seam.startedPairCount!==0).map(seam=>seam.id),failureReasons=[];
  if(report.assemblyState!=='rise-ready')failureReasons.push('assemblyState='+report.assemblyState);
  if(rise?.valid!==true||rise?.topologyGate!==true)failureReasons.push('R2.4 numerical/topology gate');
  if(rise?.centerFrontConnected!==true||rise?.centerBackConnected!==true)failureReasons.push('centre rise seam not closed');
  if(rise?.centerlineBounded!==true||rise?.frontBackOrientation!==true)failureReasons.push('centre rise direction/position gate');
  if(rise?.cuffsValid!==true)failureReasons.push('two cuff loops did not survive');
  if(rise?.expectedCrossSideDofs!==true)failureReasons.push('unexpected cross-side stitch DOF');
  if(rise?.strictUnexpectedIntersectionFree!==true)failureReasons.push('strict unexpected active-panel intersection');
  if(rise?.bodyContactValidated!==true)failureReasons.push('body-contact gate');
  if(rise?.selfContactValidated!==true)failureReasons.push('cloth self-contact gate');
  if(rise?.materialWithinCheckpoint!==true)failureReasons.push('material strain gate');
  if(report.assemblyReady!==false||rise?.visualAcceptance!==false||rise?.productionReady!==false)failureReasons.push('staged checkpoint promoted incorrectly');
  for(const item of rise?.closedSeams??[])if(!(item.maximumGapM<=(rise.stitchJoinToleranceM??1e-4)))failureReasons.push(item.id+' spatial gap exceeds tolerance');
  if(futureStarted.length)failureReasons.push('future seams started: '+futureStarted.join(','));
  if(rise?.gussetConnected!==false||rise?.waistbandConnected!==false||rise?.sideOpeningClosed!==false)failureReasons.push('future garment assembly changed');
  const status={stage:'R2.4 centre-front and centre-back rise checkpoint',actualBrowser:true,assemblyState:report.assemblyState,riseValid:rise?.valid===true,topologyGate:rise?.topologyGate===true,
    closedSeamIds:rise?.closedSeamIds??[],centerFront:rise?.centerFront??null,centerBack:rise?.centerBack??null,centerFrontConnected:rise?.centerFrontConnected===true,centerBackConnected:rise?.centerBackConnected===true,
    centerlineBounded:rise?.centerlineBounded===true,frontBackOrientation:rise?.frontBackOrientation===true,cuffs:rise?.cuffs??null,cuffsValid:rise?.cuffsValid===true,
    expectedCrossSideDofs:rise?.expectedCrossSideDofs===true,strictUnexpectedIntersectionFree:rise?.strictUnexpectedIntersectionFree===true,strictUnexpectedIntersections:rise?.strictUnexpectedIntersections??null,
    maximumPrincipalStrain:rise?.materialAtCheckpoint?.maxAbsPrincipalStrain??null,relaxationSteps:rise?.relaxationSteps??null,bodyContactValidated:rise?.bodyContactValidated===true,selfContactValidated:rise?.selfContactValidated===true,
    materialWithinCheckpoint:rise?.materialWithinCheckpoint===true,gussetUntouched:rise?.gussetUntouched===true,waistbandsUntouched:rise?.waistbandsUntouched===true,sideOpeningUntouched:rise?.sideOpeningUntouched===true,
    failureReasons,assemblyValidated:false,visualAcceptance:false,motionValidated:false,productionReady:false,errors};
  fs.writeFileSync(path.join(output,'review-status.json'),JSON.stringify(status,null,2));console.log(JSON.stringify(status));if(failureReasons.length)throw Error('R2.4 review gate failed: '+failureReasons.join('; '));
}catch(error){if(report)fs.writeFileSync(path.join(output,'rise-report.json'),JSON.stringify(report,null,2));await page.screenshot({path:path.join(output,'browser-failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack||error));throw error;}finally{await browser.close();}
