// Actual browser review; generated meshes and evidence remain outside Git.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire('/tmp/shorts-browser/package.json');
const {chromium}=require('playwright');
const output=process.env.SHORTS_REVIEW_OUTPUT||'/tmp/shorts-repair-artifact/browser';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
page.setDefaultTimeout(600000);
const errors=[];
page.on('pageerror',e=>{errors.push(String(e.stack||e));console.log('Page error:',String(e));});
await page.addInitScript(()=>{
 const NativeWorker=window.Worker;
 window.Worker=class extends NativeWorker{
  constructor(...args){super(...args);this.addEventListener('message',e=>{
   if(e.data?.type==='complete'&&e.data.meshes)window.__shortsReviewSource=e.data;
  });}
 };
});
try{
 await page.goto('http://127.0.0.1:8793/shorts.html?shorts=1&shortsSteps=0',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.HumanLab?.garment||window.__startupError);
 const data=await page.evaluate(()=>{
  const lab=window.HumanLab;if(!lab?.garment)throw Error(window.__startupError||'Missing garment');
  const h=lab.human,g=lab.compact.skirt;lab.setAuto(false);lab.garment.focus('front');
  const fixture={sourceBind:[...h.sourceBind],joints:h.joints.map(j=>({id:j.id,world:j.world})),shape:h.characterPreset?.shape||{},statureScale:lab.compact.statureScale,meshes:window.__shortsReviewSource.meshes.filter(m=>m.name==='skin')};
  return JSON.stringify({fixture,pattern:g.pattern,snapshot:g.simulation.snapshot(),bodyReport:g.body.report()},(k,v)=>ArrayBuffer.isView(v)?Array.from(v):v);
 });
 const parsed=JSON.parse(data);
 for(const [name,value]of Object.entries(parsed))fs.writeFileSync(path.join(output,name+'.json'),JSON.stringify(value));
 await page.screenshot({path:path.join(output,'actual-flat-front.png')});
 console.log(JSON.stringify({browserEvidence:true,output,steps:parsed.snapshot.stepIndex}));
}catch(e){
 await page.screenshot({path:path.join(output,'browser-failure.png')}).catch(()=>{});
 fs.writeFileSync(path.join(output,'failure.txt'),String(e.stack||e));throw e;
}finally{
 fs.writeFileSync(path.join(output,'browser-errors.json'),JSON.stringify(errors,null,2));
 await browser.close();
}
