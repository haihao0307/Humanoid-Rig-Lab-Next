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
try{
  await page.goto('http://127.0.0.1:8793/shorts.html?shorts=1&shortsSteps=0&shortsStage=r2.3-left',{waitUntil:'domcontentloaded',timeout:600000});
  await page.waitForFunction(()=>window.__startupError||['left-tube-ready','left-tube-checkpoint-failed'].includes(window.HumanLab?.compact?.skirt?.assemblyState),null,{timeout:600000});
  const startup=await page.evaluate(()=>({error:window.__startupError||null,status:window.__humanStartup||null}));
  if(startup.error)throw Error(startup.error);
  const report=await page.evaluate(()=>window.HumanLab.garment.report());
  const tube=report.leftTube;
  if(report.assemblyState!=='left-tube-ready')throw Error('R2.3 did not reach left-tube-ready: '+report.assemblyState);
  if(tube?.valid!==true||tube.leftTubeFormed!==true)throw Error('R2.3 left tube numerical gate did not pass');
  if(tube.bodyContactValidated!==true)throw Error('R2.3 left tube body-contact gate did not pass');
  if(report.assemblyReady!==false||tube.visualAcceptance!==false||tube.productionReady!==false)throw Error('A staged checkpoint was incorrectly promoted to a wearable result');
  const seams=new Map(report.simulation.seams.map(seam=>[seam.id,seam]));
  for(const id of ['outseam-left','inseam-left'])if(seams.get(id)?.progress!==1)throw Error(id+' is not closed');
  for(const seam of report.simulation.seams)if(!['outseam-left','inseam-left'].includes(seam.id)&&seam.startedPairCount!==0)throw Error('Future seam started early: '+seam.id);
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
  fs.writeFileSync(path.join(output,'review-status.json'),JSON.stringify({
    stage:'R2.3 left leg tube checkpoint',actualBrowser:true,assemblyState:report.assemblyState,
    leftTubeValid:true,closedSeamIds:tube.closedSeamIds,cuff:tube.cuff,
    maximumPrincipalStrain:tube.materialAtCheckpoint.maxAbsPrincipalStrain,
    relaxationSteps:tube.relaxationSteps,bodyContactValidated:true,
    rightPanelsUntouched:tube.rightPanelsUntouched,gussetUntouched:tube.gussetUntouched,
    waistbandsUntouched:tube.waistbandsUntouched,assemblyValidated:false,
    visualAcceptance:false,motionValidated:false,productionReady:false,errors
  },null,2));
  console.log(JSON.stringify({stage:'R2.3',leftTubeValid:true,strain:tube.materialAtCheckpoint.maxAbsPrincipalStrain,cuffArea:tube.cuff.projectedAreaM2,relaxationSteps:tube.relaxationSteps,errors}));
}catch(error){
  await page.screenshot({path:path.join(output,'browser-failure.png')}).catch(()=>{});
  fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack||error));throw error;
}finally{await browser.close();}
