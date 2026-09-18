// Actual browser review. Generated meshes, snapshots and screenshots stay in artifacts.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire('/tmp/shorts-browser/package.json');
const {chromium}=require('playwright');
const output=process.env.SHORTS_REVIEW_OUTPUT||'/tmp/shorts-repair-artifact/browser';
const maxSteps=Number(process.env.SHORTS_REVIEW_STEPS||420);
if(!Number.isInteger(maxSteps)||maxSteps<0||maxSteps>1600)throw Error('Invalid bounded review steps');
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
page.setDefaultTimeout(600000);
const errors=[];page.on('pageerror',e=>{errors.push(String(e.stack||e));console.log('Page error:',String(e));});
await page.addInitScript(()=>{
 const NativeWorker=window.Worker,raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=fn=>window.__reviewPauseRendering?0:raf(fn);
 window.Worker=class extends NativeWorker{
  constructor(...args){super(...args);this.addEventListener('message',e=>{
   if(e.data?.type==='complete'&&e.data.meshes)window.__shortsReviewSource=e.data;
  });}
 };
});
const save=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value));
try{
 await page.goto('http://127.0.0.1:8793/shorts.html?shorts=1&shortsSteps=0',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.HumanLab?.garment||window.__startupError);
 const data=await page.evaluate(()=>{
  const lab=window.HumanLab;if(!lab?.garment)throw Error(window.__startupError||'Missing garment');
  const h=lab.human,g=lab.compact.skirt;lab.setAuto(false);window.__reviewPauseRendering=true;
  const fixture={sourceBind:[...h.sourceBind],joints:h.joints.map(j=>({id:j.id,world:j.world})),shape:h.characterPreset?.shape||{},statureScale:lab.compact.statureScale,meshes:window.__shortsReviewSource.meshes.filter(m=>m.name==='skin')};
  return JSON.stringify({fixture,pattern:g.pattern,snapshot:g.simulation.snapshot(),bodyReport:g.body.report()},(k,v)=>ArrayBuffer.isView(v)?Array.from(v):v);
 });
 for(const [name,value]of Object.entries(JSON.parse(data)))save(name+'.json',value);
 console.log('Captured authoritative body and original flat paper');
 let total=0;
 while(total<maxSteps){
  const count=Math.min(30,maxSteps-total);
  const snapshot=await page.evaluate(async count=>{
   const g=window.HumanLab.compact.skirt;await g.assemble(count);return g.simulation.snapshot();
  },count);
  save('step-'+String(snapshot.stepIndex).padStart(4,'0')+'.json',snapshot);
  const r=snapshot.report;
  console.log(JSON.stringify({step:snapshot.stepIndex,sewn:r.sewn,strain:r.material.maxAbsPrincipalStrain,peak:r.peakPrincipalStrain,clothCrossings:r.selfContact.swept.currentTriangleCrossingCount,bodyCrossings:r.triangleBodyContact.strictCrossingTrianglePairs,engineeringCriteriaMet:r.engineeringCriteriaMet}));
  if(snapshot.stepIndex<=total)break;total=snapshot.stepIndex;
  if(r.engineeringCriteriaMet||r.material.valid===false)break;
 }
 const final=await page.evaluate(()=>{
  const lab=window.HumanLab,g=lab.compact.skirt,r=g.simulation.report();
  const status=document.querySelector('#shorts-controls [data-status]');
  if(status)status.textContent=g.assemblyReady?'已缝合 · 待试穿检查':r.sewn?'接缝已闭合 · 物理检查未通过':'尚未通过完整缝制检查';
  return g.simulation.snapshot();
 });save('final.json',final);
 for(const view of ['front','back','side','cloth']){
  await page.evaluate(view=>{window.HumanLab.garment.focus(view);window.HumanLab.render();},view);
  await page.screenshot({path:path.join(output,'actual-'+view+'.png')});
 }
 await page.evaluate(()=>{const l=window.HumanLab;l.garment.focus('cloth');l.renderer.pitch=-.35;l.renderer.yaw=0;l.render();});
 await page.screenshot({path:path.join(output,'actual-crotch-below.png')});
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{const l=window.HumanLab;l.garment.focus('front');l.render();});
 await page.screenshot({path:path.join(output,'actual-mobile.png')});
 save('review-status.json',{actualBrowser:true,steps:final.stepIndex,errors,engineeringCriteriaMet:final.report.engineeringCriteriaMet,visualAcceptance:false,motionTested:false});
}catch(e){
 await page.screenshot({path:path.join(output,'browser-failure.png')}).catch(()=>{});
 fs.writeFileSync(path.join(output,'failure.txt'),String(e.stack||e));throw e;
}finally{
 save('browser-errors.json',errors);await browser.close();
}
