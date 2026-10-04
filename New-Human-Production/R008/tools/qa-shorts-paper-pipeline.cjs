'use strict';
// Headless actual UI/math integration; no mouse, cloth step or full new wear QA.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'G:/Three.js/Human/Human-Fabric-Workbench/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa/shorts-paper-pipeline-20261003');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-gpu-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8883/qa/shorts-two-versions-20261002/index.html',{waitUntil:'load',timeout:180000});
  await page.waitForFunction(()=>document.getElementById('workbench')?.contentWindow?.ShortStaticTest?.ready,{},{timeout:180000});
  await page.locator('[data-version="lowrise"]').click();
  await page.waitForFunction(()=>{const h=document.getElementById('workbench')?.contentWindow?.HumanShorts;return h?.fitResult||h?.fitFailure;},{},{timeout:180000});
  const frame=page.frames().find(f=>f!==page.mainFrame());assert(frame);
  const data=await frame.evaluate(()=>{
   const h=HumanShorts;if(h.fitFailure)throw Error(h.fitFailure);const result=h.inspectPaperPipeline();
   return {version:h.version,pipeline:result,fitStatus:h.fitStatus,simulationCertified:h.simulationCertified,time:h.fitPreview.time,steps:h.fitPreview.steps,renderVertices:h.fitPreview.mesh.geometry.attributes.position.count,renderTriangles:h.fitPreview.mesh.geometry.index.count/3,stage:document.getElementById('shorts-stage').textContent,disabled:document.getElementById('shorts-physics-probe').disabled};
  });
  assert.equal(data.pipeline.gate.status,'HOLD');assert.equal(data.pipeline.gate.blockedAt,'surface-metric');assert(data.pipeline.surface.maximumPrincipalStrain>.05);assert.equal(data.disabled,true);assert.equal(data.simulationCertified,false);assert.equal(data.time,0);assert.equal(data.steps,0);assert.equal(data.renderVertices,7273);assert.equal(data.renderTriangles,13568);assert.equal(errors.length,0);
  await frame.evaluate(()=>HumanShorts.setView('front'));await page.screenshot({path:path.join(out,'actual-pipeline-front.png')});
  await page.locator('[data-version="original"]').click();await page.waitForFunction(()=>document.getElementById('workbench')?.contentWindow?.ShortStaticTest?.ready,{},{timeout:180000});
  const original=await page.evaluate(()=>ShortVersion.versions.find(v=>v.id==='original').htmlSHA256);assert.equal(original,'2b9158f76cd75aef5605be86bd7092c406d333467ce116eca130f166580635da');
  const artifact=path.join(root,'qa/shorts-two-versions-20261002/index.html');
  const report={passed:true,scope:'actual headless interactive A/B/A and production source-metric HOLD UI; no full garment acceptance, contact rerun, cloth or native motion step',data,errors,originalSHA256:original,originalRetained:true,artifactSHA256:crypto.createHash('sha256').update(fs.readFileSync(artifact)).digest('hex'),productionReady:false};
  fs.writeFileSync(path.join(out,'QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
