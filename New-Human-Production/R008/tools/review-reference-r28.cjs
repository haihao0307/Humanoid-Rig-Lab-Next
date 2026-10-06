const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa/face-reference-r28');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1800,height:1200}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:8879/?view=face-data&version=reference-r28',{waitUntil:'commit'});await page.waitForFunction(()=>window.HumanLoading?.finished,null,{timeout:180000});assert(!await page.evaluate(()=>window.failure));
 const session=JSON.parse(fs.readFileSync(path.join(root,'face-reference.json'),'utf8'));
 const report=await page.evaluate(async reference=>{HumanFace.identity.set({...HumanFace.identity.export(),parameters:{}});HumanFace.identity.setReference(reference);document.getElementById('identityMarkers').checked=false;document.getElementById('identityMarkers').dispatchEvent(new Event('change'));const baseline=HumanFace.identity.report;const fit=await HumanFace.identity.fit();return {baseline,fit,report:HumanFace.identity.report,measurements:HumanGame.subject.identity.measure(reference)};},session.reference);
 await page.screenshot({path:path.join(out,'fitted.png')});
 await page.click('#faceLeft');await page.screenshot({path:path.join(out,'side.png')});await page.click('#faceFront');
 assert(report.fit.actualAfter<report.fit.before);assert.equal(report.fit.depthFitted,false);assert(report.report.minJacobian>.42);assert.equal(errors.length,0);
 const hashes=Object.fromEntries(['FaceIdentityModel.mjs','FaceIdentityBinding.mjs','FaceLandmarks.mjs','FaceMeasurements.mjs','FaceReferenceFit.mjs','FaceIdentityWorkbench.mjs'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
 fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({...report,errors,hashes,date:new Date().toISOString()},null,2));
 session.recipe=report.report.parameters;session.fit=report.fit;session.measurements=report.measurements;session.status='first-pass-fitted';session.sourceHashes=hashes;fs.writeFileSync(path.join(root,'face-reference.json'),JSON.stringify(session,null,2)+'\n');
 console.log(JSON.stringify({before:report.fit.before,after:report.fit.actualAfter,points:report.fit.points,safeScale:report.report.safeScale,minJacobian:report.report.minJacobian,parameters:report.report.parameters.parameters,errors,out},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
