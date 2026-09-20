// Real-browser R2.5 evidence. This captures the original independent gusset
// after both leg tubes and centre rises are closed. Waistbands and the left
// dressing opening remain unsewn, so this is not whole-garment acceptance.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire('/tmp/shorts-browser/package.json');
const {chromium}=require('playwright');
const output=process.env.SHORTS_R25_OUTPUT||'/tmp/shorts-r25-gusset';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
page.setDefaultTimeout(900000);
const errors=[];page.on('pageerror',error=>errors.push(String(error.stack||error)));
let report=null;
try{
  await page.goto('http://127.0.0.1:8793/shorts.html?shorts=1&shortsSteps=0&shortsStage=r2.5-gusset',{waitUntil:'domcontentloaded',timeout:900000});
  await page.waitForFunction(()=>window.__startupError||['gusset-ready','gusset-checkpoint-failed'].includes(window.HumanLab?.compact?.skirt?.assemblyState),null,{timeout:900000});
  const startup=await page.evaluate(()=>({error:window.__startupError||null,status:window.__humanStartup||null}));if(startup.error)throw Error(startup.error);
  report=await page.evaluate(()=>window.HumanLab.garment.report());const gusset=report.gusset;
  fs.writeFileSync(path.join(output,'gusset-report.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(output,'gusset-snapshot.json'),JSON.stringify(await page.evaluate(()=>window.HumanLab.compact.skirt.simulation.snapshot()),null,2));
  fs.writeFileSync(path.join(output,'browser-errors.json'),JSON.stringify(errors,null,2));
  const view=async(name,yaw,pitch=.035,distance=1.18,targetOffset=[0,-.11,0])=>{
    await page.evaluate(({yaw,pitch,distance,targetOffset})=>{const l=window.HumanLab,r=l.renderer,h=l.human,s=h.bodyMetrics.statureScale,hip=h.world('hips').p;l.setAuto(false);l.setCameraFollow(false);r.target=[hip[0]+targetOffset[0]*s,hip[1]+targetOffset[1]*s,hip[2]+targetOffset[2]*s];r.distance=distance*s;r.yaw=l.agent.yaw+yaw;r.pitch=pitch;r.projection='perspective';l.render();},{yaw,pitch,distance,targetOffset});
    await page.screenshot({path:path.join(output,name+'.png')});
  };
  await view('01-angle',.48,.055,1.18,[0,-.105,0]);
  await view('02-front',0,.018,1.00,[0,-.105,0]);
  await view('03-back',Math.PI,.018,1.00,[0,-.105,0]);
  await view('04-left-side',-Math.PI/2,.018,.98,[0,-.105,0]);
  await view('05-right-side',Math.PI/2,.018,.98,[0,-.105,0]);
  await view('06-front-gusset-close',0,-.20,.66,[0,-.15,.025]);
  await view('07-back-gusset-close',Math.PI,-.20,.66,[0,-.15,-.025]);
  await view('08-crotch-below',0,-.72,.76,[0,-.19,0]);
  await view('09-gusset-underside',Math.PI/4,-1.02,.62,[0,-.19,0]);
  await page.setViewportSize({width:390,height:844});await view('10-mobile-front',0,.02,1.28,[0,-.105,0]);
  const completed=new Set(['outseam-left','inseam-left','outseam-right','inseam-right','center-front','center-back','gusset-FL','gusset-FR','gusset-BL','gusset-BR']);
  const futureStarted=report.simulation.seams.filter(seam=>!completed.has(seam.id)&&seam.startedPairCount!==0).map(seam=>seam.id),failureReasons=[];
  if(report.assemblyState!=='gusset-ready')failureReasons.push('assemblyState='+report.assemblyState);
  if(gusset?.valid!==true||gusset?.topologyGate!==true)failureReasons.push('R2.5 numerical/topology gate');
  if(gusset?.gussetConnected!==true||gusset?.gussetSeamsClosed!==true)failureReasons.push('gusset source seams not closed');
  if(gusset?.centerRisesRemainClosed!==true)failureReasons.push('centre rises reopened');
  if(gusset?.cuffsValid!==true)failureReasons.push('two cuff loops did not survive');
  if(gusset?.gussetOrientationValid!==true||gusset?.junctionsValid!==true)failureReasons.push('gusset orientation/junction gate');
  if(gusset?.expectedClosedDofs!==true)failureReasons.push('unexpected stitch DOF');
  if(gusset?.strictUnexpectedIntersectionFree!==true)failureReasons.push('strict active-cloth intersection');
  if(gusset?.bodyContactValidated!==true)failureReasons.push('body-contact gate');
  if(gusset?.selfContactValidated!==true)failureReasons.push('cloth self-contact gate');
  if(gusset?.materialWithinCheckpoint!==true)failureReasons.push('material strain gate');
  if(report.assemblyReady!==false||gusset?.visualAcceptance!==false||gusset?.productionReady!==false)failureReasons.push('staged checkpoint promoted incorrectly');
  for(const item of gusset?.closedSeams??[])if(!(item.maximumGapM<=(gusset.stitchJoinToleranceM??1e-4)))failureReasons.push(item.id+' spatial gap exceeds tolerance');
  if(futureStarted.length)failureReasons.push('future seams started: '+futureStarted.join(','));
  if(gusset?.waistbandConnected!==false||gusset?.sideOpeningClosed!==false)failureReasons.push('future garment assembly changed');
  if(errors.length)failureReasons.push('browser page errors');
  const status={stage:'R2.5 independent gusset checkpoint',actualBrowser:true,assemblyState:report.assemblyState,gussetValid:gusset?.valid===true,topologyGate:gusset?.topologyGate===true,
    closedSeamIds:gusset?.closedSeamIds??[],gussetSeams:gusset?.gussetSeams??[],gussetConnected:gusset?.gussetConnected===true,centerRisesRemainClosed:gusset?.centerRisesRemainClosed===true,
    cuffs:gusset?.cuffs??null,cuffsValid:gusset?.cuffsValid===true,gussetGeometry:gusset?.gussetGeometry??null,gussetOrientationValid:gusset?.gussetOrientationValid===true,
    junctions:gusset?.junctions??[],junctionsValid:gusset?.junctionsValid===true,expectedClosedDofs:gusset?.expectedClosedDofs===true,
    strictUnexpectedIntersectionFree:gusset?.strictUnexpectedIntersectionFree===true,strictUnexpectedIntersections:gusset?.strictUnexpectedIntersections??null,
    maximumPrincipalStrain:gusset?.materialAtCheckpoint?.maxAbsPrincipalStrain??null,materialSafetyMargin:gusset?.materialSafetyMargin??null,relaxationSteps:gusset?.relaxationSteps??null,
    bodyContactValidated:gusset?.bodyContactValidated===true,selfContactValidated:gusset?.selfContactValidated===true,materialWithinCheckpoint:gusset?.materialWithinCheckpoint===true,
    waistbandsUntouched:gusset?.waistbandsUntouched===true,sideOpeningUntouched:gusset?.sideOpeningUntouched===true,failureReasons,
    assemblyValidated:false,visualAcceptance:false,motionValidated:false,productionReady:false,errors};
  fs.writeFileSync(path.join(output,'review-status.json'),JSON.stringify(status,null,2));console.log(JSON.stringify(status));if(failureReasons.length)throw Error('R2.5 review gate failed: '+failureReasons.join('; '));
}catch(error){if(report)fs.writeFileSync(path.join(output,'gusset-report.json'),JSON.stringify(report,null,2));await page.screenshot({path:path.join(output,'browser-failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack||error));throw error;}finally{await browser.close();}
