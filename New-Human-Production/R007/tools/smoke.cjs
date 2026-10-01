const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const qa=path.resolve(__dirname,'../qa'),errors=[],requests=[];
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1200},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('request',r=>requests.push(r.url()));
  await page.goto('http://127.0.0.1:8877/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.HumanR007||window.failure,{timeout:90000});
  const result=await page.evaluate(()=>{
   if(window.failure)throw Error(window.failure);
   const h=window.HumanR007,s=h.subject;s.setPaused(true);s.play('rest');
   let maxWeightError=0;for(let i=0;i<s.surface.skinWeight.length;i+=8){let sum=0;for(let k=0;k<8;k++)sum+=s.surface.skinWeight[i+k];maxWeightError=Math.max(maxWeightError,Math.abs(1-sum));}
   return {packageBytes:h.data.packageBytes,bones:s.skeleton.bones.length,clips:s.clips.map(c=>c.name),surface:s.surface.report,maxWeightError,finitePositions:s.surface.positions.every(Number.isFinite)};
  });
  await page.screenshot({path:path.join(qa,'final-current.png')});
  await page.locator('#bones').check();await page.screenshot({path:path.join(qa,'final-bones.png')});await page.locator('#bones').uncheck();
  result.actions=[];for(const clip of result.clips){await page.selectOption('#action',clip);result.actions.push(await page.evaluate(()=>{const s=HumanR007.subject;s.mixer.update(.35);s.step(0);return {phase:s.phase,finiteMatrices:s.skeleton.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))}}));}
  await page.selectOption('#action','rest');await page.locator('#height').fill('1.95');await page.locator('#height').dispatchEvent('input');result.heightScale=await page.evaluate(()=>HumanR007.subject.root.scale.x);
  await page.locator('#regions').check();await page.locator('#regions').uncheck();
  result.rawPaths=[];for(const p of ['/qa/capture.json','/qa/source-intake/source.fbx','/tools/intake.html']){const response=await page.request.get('http://127.0.0.1:8877'+p);result.rawPaths.push({path:p,status:response.status()});}
  result.requests=requests;result.errors=errors;result.sourceAssetRequests=requests.filter(u=>/\.(fbx|usdz|zip|jpe?g|png)(\?|$)/i.test(u));
  fs.writeFileSync(path.join(qa,'final-browser-report.json'),JSON.stringify(result,null,2));
  if(errors.length||!result.finitePositions||result.maxWeightError>1e-5||result.bones!==61||result.clips.length!==4||result.sourceAssetRequests.length||result.rawPaths.some(p=>p.status!==404))throw Error('Smoke validation failed');
  console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
