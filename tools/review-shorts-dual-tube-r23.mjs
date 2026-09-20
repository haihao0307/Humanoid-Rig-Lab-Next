// Real-browser R2.3b evidence. This captures two independently sewn leg tubes
// while centre rises, gusset, left side closure and waistbands remain open.
// It is an assembly checkpoint, never whole-garment or motion acceptance.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire('/tmp/shorts-browser/package.json');
const {chromium}=require('playwright');
const output=process.env.SHORTS_R23_DUAL_OUTPUT||'/tmp/shorts-r23-dual-tube';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
page.setDefaultTimeout(600000);
const errors=[];page.on('pageerror',error=>errors.push(String(error.stack||error)));
let report=null;
try{
  await page.goto('http://127.0.0.1:8793/shorts.html?shorts=1&shortsSteps=0&shortsStage=r2.3-dual',{waitUntil:'domcontentloaded',timeout:600000});
  await page.waitForFunction(()=>window.__startupError||['dual-tube-ready','dual-tube-checkpoint-failed'].includes(window.HumanLab?.compact?.skirt?.assemblyState),null,{timeout:600000});
  const startup=await page.evaluate(()=>({error:window.__startupError||null,status:window.__humanStartup||null}));
  if(startup.error)throw Error(startup.error);
  report=await page.evaluate(()=>window.HumanLab.garment.report());
  const tube=report.dualTube;
  fs.writeFileSync(path.join(output,'dual-tube-report.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(output,'browser-errors.json'),JSON.stringify(errors,null,2));
  const view=async(name,yaw,pitch=.035,distance=1.18,targetOffset=[0,-.11,0])=>{
    await page.evaluate(({yaw,pitch,distance,targetOffset})=>{const l=window.HumanLab,r=l.renderer,h=l.human,s=h.bodyMetrics.statureScale,hip=h.world('hips').p;l.setAuto(false);l.setCameraFollow(false);r.target=[hip[0]+targetOffset[0]*s,hip[1]+targetOffset[1]*s,hip[2]+targetOffset[2]*s];r.distance=distance*s;r.yaw=l.agent.yaw+yaw;r.pitch=pitch;r.projection='perspective';l.render();},{yaw,pitch,distance,targetOffset});
    await page.screenshot({path:path.join(output,name+'.png')});
  };
  await view('01-angle',.48,.055,1.28,[0,-.12,0]);
  await view('02-front',0,.02,1.10,[0,-.12,0]);
  await view('03-back',Math.PI,.02,1.10,[0,-.12,0]);
  await view('04-left-side',-Math.PI/2,.02,1.08,[0,-.12,0]);
  await view('05-right-side',Math.PI/2,.02,1.08,[0,-.12,0]);
  await view('06-both-cuffs-below',0,-.82,.86,[0,-.23,0]);
  await view('07-crotch-below',0,-.62,.96,[0,-.12,0]);
  await page.setViewportSize({width:390,height:844});
  await view('08-mobile-front',0,.02,1.34,[0,-.12,0]);
  const completed=new Set(['outseam-left','inseam-left','outseam-right','inseam-right']);
  const futureStarted=report.simulation.seams.filter(seam=>!completed.has(seam.id)&&seam.startedPairCount!==0).map(seam=>seam.id);
  const failureReasons=[];
  if(report.assemblyState!=='dual-tube-ready')failureReasons.push('assemblyState='+report.assemblyState);
  if(tube?.valid!==true||tube.dualTubeGate!==true||tube.leftTubeFormed!==true||tube.rightTubeFormed!==true)failureReasons.push('dual-tube numerical gate');
  if(tube?.bodyContactValidated!==true)failureReasons.push('body-contact gate');
  if(tube?.cuffsValid!==true||tube?.leftRightOwnership!==true||tube?.independentLegDofs!==true)failureReasons.push('cuff ownership gate');
  if(tube?.strictCrossTubeIntersectionFree!==true)failureReasons.push('strict cross-leg triangle intersection');
  if(report.assemblyReady!==false||tube?.visualAcceptance!==false||tube?.productionReady!==false)failureReasons.push('staged checkpoint promoted incorrectly');
  for(const item of tube?.closedSeams??[])if(!(item.maximumGapM<=(tube.stitchJoinToleranceM??1e-4)))failureReasons.push(item.id+' spatial gap exceeds tolerance');
  if(futureStarted.length)failureReasons.push('future seams started: '+futureStarted.join(','));
  const status={stage:'R2.3b dual leg tube checkpoint',actualBrowser:true,assemblyState:report.assemblyState,
    dualTubeValid:tube?.valid===true,closedSeamIds:tube?.closedSeamIds??[],cuffs:tube?.cuffs??null,cuffsValid:tube?.cuffsValid===true,
    leftRightOwnership:tube?.leftRightOwnership===true,independentLegDofs:tube?.independentLegDofs===true,
    strictCrossTubeIntersectionFree:tube?.strictCrossTubeIntersectionFree===true,strictCrossTube:tube?.strictCrossTube??null,
    maximumPrincipalStrain:tube?.materialAtCheckpoint?.maxAbsPrincipalStrain??null,relaxationSteps:tube?.relaxationSteps??null,
    bodyContactValidated:tube?.bodyContactValidated===true,bodyRequirementMet:tube?.bodyRequirementMet===true,materialWithinCheckpoint:tube?.materialWithinCheckpoint===true,
    gussetUntouched:tube?.gussetUntouched===true,waistbandsUntouched:tube?.waistbandsUntouched===true,sideOpeningUntouched:tube?.sideOpeningUntouched===true,
    failureReasons,assemblyValidated:false,visualAcceptance:false,motionValidated:false,productionReady:false,errors};
  fs.writeFileSync(path.join(output,'review-status.json'),JSON.stringify(status,null,2));
  console.log(JSON.stringify(status));
  if(failureReasons.length)throw Error('R2.3b review gate failed: '+failureReasons.join('; '));
}catch(error){
  if(report)fs.writeFileSync(path.join(output,'dual-tube-report.json'),JSON.stringify(report,null,2));
  await page.screenshot({path:path.join(output,'browser-failure.png')}).catch(()=>{});
  fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack||error));throw error;
}finally{await browser.close();}
