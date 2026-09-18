// Explicit user-authorized browser evidence; generated geometry stays outside Git.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('/tmp/shorts-browser/package.json');
const { chromium } = require('playwright');
const output = process.env.SHORTS_REVIEW_OUTPUT || '/tmp/shorts-repair-artifact/browser';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1440,height:1080}, deviceScaleFactor:1 });
const errors=[]; page.on('pageerror', error=>errors.push(String(error.stack||error)));
await page.addInitScript(()=>{
  const NativeWorker=window.Worker;
  window.Worker=class extends NativeWorker {
    constructor(...args){super(...args);this.addEventListener('message',event=>{
      if(event.data?.type==='complete'&&event.data.meshes)window.__shortsReviewSource=event.data;
    });}
  };
});
try {
  await page.goto('http://127.0.0.1:8793/shorts.html?shorts=1&shortsSteps=0', {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction('window.HumanLab?.garment || window.__startupError', {timeout:180000});
  const startupError=await page.evaluate('window.__startupError||null');
  if(startupError)throw Error(startupError);
  const data=await page.evaluate(()=>{
    const lab=window.HumanLab,h=lab.human,g=lab.compact.skirt;
    lab.setAuto(false);lab.garment.focus('front');
    const fixture={sourceBind:[...h.sourceBind],joints:h.joints.map(j=>({id:j.id,world:j.world})),shape:h.characterPreset?.shape||{},statureScale:lab.compact.statureScale,meshes:window.__shortsReviewSource.meshes.filter(m=>m.name==='skin')};
    return JSON.stringify({fixture,pattern:g.pattern,snapshot:g.simulation.snapshot(),bodyReport:g.body.report()},(key,value)=>ArrayBuffer.isView(value)?Array.from(value):value);
  });
  const parsed=JSON.parse(data);
  for(const [name,value]of Object.entries(parsed))fs.writeFileSync(path.join(output,name+'.json'),JSON.stringify(value));
  await page.screenshot({path:path.join(output,'actual-flat-front.png')});
  fs.writeFileSync(path.join(output,'browser-errors.json'),JSON.stringify(errors,null,2));
  console.log(JSON.stringify({browserEvidence:true,source:'actual-current-runtime',output,errors,steps:parsed.snapshot.stepIndex,bodyTriangles:parsed.bodyReport.triangles}));
} catch(error){
  await page.screenshot({path:path.join(output,'browser-failure.png')}).catch(()=>{});
  fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack||error));throw error;
} finally { await browser.close(); }
