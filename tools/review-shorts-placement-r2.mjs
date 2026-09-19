// Real-browser R2.2 evidence. This captures rigid source-panel placement only;
// it never advances sewing or claims wearable/visual acceptance.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire('/tmp/shorts-browser/package.json');
const {chromium}=require('playwright');
const output=process.env.SHORTS_R2_OUTPUT||'/tmp/shorts-r2-placement';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
page.setDefaultTimeout(600000);
const errors=[];page.on('pageerror',error=>errors.push(String(error.stack||error)));
try{
  await page.goto('http://127.0.0.1:8793/shorts.html?shorts=1&shortsSteps=0&shortsPlacement=r2.2',{waitUntil:'domcontentloaded',timeout:600000});
  await page.waitForFunction(()=>window.HumanLab?.garment||window.__startupError,null,{timeout:600000});
  const startup=await page.evaluate(()=>({error:window.__startupError||null,status:window.__humanStartup||null}));
  if(startup.error)throw Error(startup.error);
  const report=await page.evaluate(()=>window.HumanLab.garment.report());
  if(report.placement?.valid!==true)throw Error('R2.2 source-panel placement report did not pass');
  if(report.assembly?.assemblySteps!==0||report.placement.sewingActivated!==false)throw Error('Placement review unexpectedly advanced sewing');
  fs.writeFileSync(path.join(output,'placement-report.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(output,'browser-errors.json'),JSON.stringify(errors,null,2));
  const view=async(name,yaw,pitch=.035,distance=1.20)=>{
    await page.evaluate(({yaw,pitch,distance})=>{const l=window.HumanLab,r=l.renderer,h=l.human,s=h.bodyMetrics.statureScale,hip=h.world('hips').p;l.setAuto(false);l.setCameraFollow(false);r.target=[hip[0],hip[1]-.11*s,hip[2]];r.distance=distance*s;r.yaw=l.agent.yaw+yaw;r.pitch=pitch;r.projection='perspective';l.render();},{yaw,pitch,distance});
    await page.screenshot({path:path.join(output,name+'.png')});
  };
  await view('01-angle',.48,.055,1.38);
  await view('02-front',0,.02,1.18);
  await view('03-back',Math.PI,.02,1.18);
  await view('04-right-side',Math.PI/2,.02,1.18);
  await view('05-left-side',-Math.PI/2,.02,1.18);
  await view('06-crotch-below',0,-.72,1.02);
  await page.setViewportSize({width:390,height:844});
  await view('07-mobile-front',0,.02,1.35);
  fs.writeFileSync(path.join(output,'review-status.json'),JSON.stringify({
    stage:'R2.2 rigid source-panel placement',actualBrowser:true,placementValid:true,sewingSteps:0,
    sourceUnchanged:report.placement.sourceUnchanged,gussetOrderCorrect:report.placement.gussetOrderCorrect,
    pieceOwnershipCorrect:report.placement.pieces.every(piece=>piece.ownershipCorrect),
    visualAcceptance:false,motionValidated:false,errors
  },null,2));
  console.log(JSON.stringify({stage:'R2.2',placementValid:true,pieces:report.placement.pieces.length,gussetOrderCorrect:report.placement.gussetOrderCorrect,errors}));
}catch(error){
  await page.screenshot({path:path.join(output,'browser-failure.png')}).catch(()=>{});
  fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack||error));throw error;
}finally{await browser.close();}
