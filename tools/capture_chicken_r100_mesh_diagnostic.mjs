import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root=process.cwd();
const evidenceDir=path.join(root,'evidence','r100');
const url=process.env.CHICKEN_R100_URL||'http://127.0.0.1:8765/CHICKEN_V46_R10_0_SINGLE_AGENT.html';
const executablePath=process.env.CHROME_PATH;
if(!executablePath)throw new Error('CHROME_PATH is required');
fs.mkdirSync(evidenceDir,{recursive:true});

const browser=await chromium.launch({
 headless:true,
 executablePath,
 args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']
});
const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
page.setDefaultTimeout(30000);
await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
await page.waitForSelector('canvas',{timeout:60000});
await page.waitForFunction(()=>{
 const api=window.__CHICKEN_PHASE1_MOTION__;
 return Boolean(api?.ready&&api.diagnostics()?.manualStepAvailable&&api.diagnostics()?.skin?.peckKinematicsRevision==='six-link-volume-preserving-s-curve-v2');
},null,{timeout:120000});
await page.evaluate(()=>{
 const api=window.__CHICKEN_PHASE1_MOTION__;
 api.setAuto(false);api.pauseRealtime(true);api.reset({clearObserved:true});
 api.runAction('peck',{frames:28,dt:1/60,resetFirst:true});
});
for(const selector of ['button[data-layout="solo"]','button[data-focus="whole"]','button[data-view="left"]','button[data-mat="procedural"]']){
 await page.locator(selector).click();await page.waitForTimeout(100);
}

const inventory=await page.evaluate(()=>__phase1Runtime.skin.meshes.map((mesh,index)=>({
 index,kind:mesh.userData?.materialKind||'unknown',vertices:mesh.geometry?.attributes?.position?.count||0
})));
fs.writeFileSync(path.join(evidenceDir,'R100_PECK_MESH_INVENTORY.json'),JSON.stringify(inventory,null,2)+'\n');

async function capture(name,visible){
 await page.evaluate((indices)=>{
  const set=new Set(indices);
  __phase1Runtime.skin.meshes.forEach((mesh,index)=>{mesh.visible=set.has(index);});
  requestRender();
 },visible);
 await page.waitForTimeout(120);
 await page.screenshot({path:path.join(evidenceDir,name),fullPage:false,animations:'allow',caret:'hide',timeout:30000});
}

const all=inventory.map(item=>item.index);
await capture('R100_PECK_ISO_BODY.png',[0]);
await capture('R100_PECK_ISO_COAT.png',[15]);
await capture('R100_PECK_NO_BODY.png',all.filter(index=>index!==0));
await capture('R100_PECK_NO_COAT.png',all.filter(index=>index!==15));
await capture('R100_PECK_BODY_AND_COAT.png',[0,15]);
await capture('R100_PECK_ALL_RESTORED.png',all);
await browser.close();
console.log(JSON.stringify({inventory,captures:6},null,2));
