// Real-browser R2.3 evidence. This captures one completed left-leg tube while
// the right panels, gusset and waistbands remain unassembled. It is progress
// evidence, never whole-garment, visual or motion acceptance.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire('/tmp/shorts-browser/package.json');
const {chromium}=require('playwright');
const output=process.env.SHORTS_R23_OUTPUT||'/tmp/shorts-r23-left-tube';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
page.setDefaultTimeout(600000);
const errors=[];page.on('pageerror',error=>errors.push(String(error.stack||error)));
let report=null;
try{
  await page.goto('http://127.0.0.1:8793/shorts.html?shorts=1&shortsSteps=0&shortsStage=r2.3-left',{waitUntil:'domcontentloaded',timeout:600000});
  await page.waitForFunction(()=>window.__startupError||['left-tube-ready','left-tube-checkpoint-failed'].includes(window.HumanLab?.compact?.skirt?.assemblyState),null,{timeout:600000});
  const startup=await page.evaluate(()=>({error:window.__startupError||null,status:window.__humanStartup||null}));
  if(startup.error)throw Error(startup.error);
  report=await page.evaluate(()=>window.HumanLab.garment.report());
  const tube=report.leftTube;
  fs.writeFileSync(path.join(output,'left-tube-report.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(output,'browser-errors.json'),JSON.stringify(errors,null,2));
  const view=async(name,yaw,pitch=.035,distance=1.18,targetOffset=[0,-.11,0])=>{
    await page.evaluate(({yaw,pitch,distance,targetOffset})=>{const l=window.HumanLab,r=l.renderer,h=l.human,s=h.bodyMetrics.statureScale,hip=h.world('hips').p;l.setAuto(false);l.setCameraFollow(false);r.target=[hip[0]+targetOffset[0]*s,hip[1]+targetOffset[1]*s,hip[2]+targetOffset[2]*s];r.distance=distance*s;r.yaw=l.agent.yaw+yaw;r.pitch=pitch;r.projection='perspective';l.render();},{yaw,pitch,distance,targetOffset});
    await page.screenshot({path:path.join(output,name+'.png')});
  };
  await view('01-angle',.48,.055,1.30,[-.025,-.12,0]);
  await view('02-front',0,.02,1.12,[-.025,-.12,0]);
  await view('03-back',Math.PI,.02,1.12,[-.025,-.12,0]);
  await view('04-left-side',-Math.PI/2,.02,1.05,[-.045,-.12,0]);
  await view('05-right-side',Math.PI/2,.02,1.15,[-.020,-.12,0]);
  await view('06-cuff-below',0,-.82,.88,[-.050,-.23,0]);
  await view('07-crotch-below',0,-.62,.98,[-.025,-.12,0]);
  await page.setViewportSize({width:390,height:844});
  await view('08-mobile-front',0,.02,1.36,[-.025,-.12,0]);
  const seams=new Map(report.simulation.seams.map(seam=>[seam.id,seam]));
  const futureStarted=report.simulation.seams.filter(seam=>!['outseam-left','inseam-left'].includes(seam.id)&&seam.startedPairCount!==0).map(seam=>seam.id);
  const failureReasons=[];
  if(report.assemblyState!=='left-tube-ready')failureReasons.push('assemblyState='+report.assemblyState);
  if(tube?.valid!==true||tube.leftTubeFormed!==true)failureReasons.push('left-tube numerical gate');
  if(tube?.bodyContactValidated!==true)failureReasons.push('body-contact gate');
  if(report.assemblyReady!==false||tube?.visualAcceptance!==false||tube?.productionReady!==false)failureReasons.push('staged checkpoint promoted incorrectly');
  for(const id of ['outseam-left','inseam-left'])if(seams.get(id)?.progress!==1)failureReasons.push(id+' not closed');
  if(futureStarted.length)failureReasons.push('future seams started: '+futureStarted.join(','));
  const status={stage:'R2.3 left leg tube checkpoint',actualBrowser:true,assemblyState:report.assemblyState,
    leftTubeValid:tube?.valid===true,closedSeamIds:tube?.closedSeamIds??[],cuff:tube?.cuff??null,
    maximumPrincipalStrain:tube?.materialAtCheckpoint?.maxAbsPrincipalStrain??null,
    relaxationSteps:tube?.relaxationSteps??null,bodyContactValidated:tube?.bodyContactValidated===true,
    bodyRequirementMet:tube?.bodyRequirementMet===true,materialWithinCheckpoint:tube?.materialWithinCheckpoint===true,
    rightPanelsUntouched:tube?.rightPanelsUntouched??[],gussetUntouched:tube?.gussetUntouched===true,
    waistbandsUntouched:tube?.waistbandsUntouched===true,failureReasons,
    assemblyValidated:false,visualAcceptance:false,motionValidated:false,productionReady:false,errors};
  fs.writeFileSync(path.join(output,'review-status.json'),JSON.stringify(status,null,2));
  console.log(JSON.stringify(status));
  if(failureReasons.length)throw Error('R2.3 review gate failed: '+failureReasons.join('; '));
}catch(error){
  if(report)fs.writeFileSync(path.join(output,'left-tube-report.json'),JSON.stringify(report,null,2));
  await page.screenshot({path:path.join(output,'browser-failure.png')}).catch(()=>{});
  fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack||error));throw error;
}finally{await browser.close();}
