const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const url=process.env.QA_URL||'http://127.0.0.1:8765/skin-quality-lab/r02/index.html',out=process.env.QA_OUT||'/tmp/skin-three-evidence';fs.mkdirSync(out,{recursive:true});
const report={url,scope:'Chromium headless desktop and mobile viewport; not a physical phone',identities:[],checks:[],pageErrors:[],consoleErrors:[],failedRequests:[]};let browser;
function check(name,condition){report.checks.push({name,pass:!!condition});assert.ok(condition,name);}
function hash(buffer){return crypto.createHash('sha256').update(buffer).digest('hex');}
(async()=>{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:1040},deviceScaleFactor:1}),page=await context.newPage();
 page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});page.on('requestfailed',r=>report.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__SKIN_LAB__?.state.ready,null,{timeout:150000});
 check('correct version',await page.evaluate(()=>window.__SKIN_LAB__.state.version==='skin-quality-lab/r02.3-skin-hair'));
 const select=async id=>{await page.locator('.identity-quick [data-identity="'+id+'"]').click();await page.waitForFunction(id=>window.__SKIN_LAB__.state.identity===id&&!window.__SKIN_LAB__.state.identityLoading,id,{timeout:120000});await page.waitForTimeout(300);};
 const pixels=[];
 for(const id of ['porcelain','umber','weathered','original']){
  await select(id);const state=await page.evaluate(()=>structuredClone(window.__SKIN_LAB__.state));
  await page.evaluate(()=>{window.__SKIN_LAB__.setCamera('portrait');window.__SKIN_LAB__.render();});await page.waitForTimeout(300);const shot=await page.screenshot({path:path.join(out,id+'.png')});
  for(const view of id==='original'?[]:['front','ear','cheek']){await page.evaluate(view=>{window.__SKIN_LAB__.setCamera(view);window.__SKIN_LAB__.render();},view);await page.waitForTimeout(350);await page.screenshot({path:path.join(out,id+'-'+view+'.png')});}
  await page.evaluate(()=>{window.__SKIN_LAB__.setCamera('portrait');window.__SKIN_LAB__.render();});
  if(id!=='original'){const diagnostics=await page.evaluate(()=>window.__SKIN_LAB__.identity.diagnostics());report.fiberDiagnostics=report.fiberDiagnostics||{};report.fiberDiagnostics[id]=diagnostics;check(id+' real scene-lit reused fiber material',diagnostics.materials.every(m=>m.lightingSource==='scene directional lights; independent per-light visibility'));check(id+' original 14000 fuzz preserved',state.fuzzStrands===14000);}pixels.push(hash(shot));report.identities.push({id,state,screenshotSHA256:hash(shot)});
  check(id+' ready',state.ready&&state.identity===id);if(id!=='original'){check(id+' 4 independent maps',state.identityMaps.length===4&&state.identityMaps.every(m=>m.width===2048));check(id+' mesh-rooted eyebrows',state.identityHair.brow>1000);}
  if(id==='porcelain')check('clean-shaven identity has no beard fibres',state.identityHair.beard===0);
  if(id==='umber'||id==='weathered')check(id+' mesh-rooted beard',state.identityHair.beard>9000);
 }
 check('all identities have distinct rendered output',new Set(pixels).size===4);
 await select('weathered');
 await page.evaluate(()=>{const e=document.getElementById('beardLength');e.value=1.6;e.dispatchEvent(new Event('input',{bubbles:true}));window.__SKIN_LAB__.render();});
 const longHair=hash(await page.locator('#viewport canvas').screenshot());
 await page.evaluate(()=>{const e=document.getElementById('beardDensity');e.value=0;e.dispatchEvent(new Event('input',{bubbles:true}));window.__SKIN_LAB__.render();});
 const noHair=hash(await page.locator('#viewport canvas').screenshot());check('beard controls change actual pixels',longHair!==noHair);
 await page.evaluate(()=>{document.getElementById('beardDensity').value=.65;document.getElementById('beardDensity').dispatchEvent(new Event('input'));});
 await page.locator('#save').click();await select('porcelain');await page.locator('#restore').click();await page.waitForFunction(()=>window.__SKIN_LAB__.identity.current()==='weathered'&&!window.__SKIN_LAB__.state.identityLoading);
 const restored=await page.evaluate(()=>window.__SKIN_LAB__.identity.report());check('save restore identity and fibres',restored.id==='weathered'&&restored.hair.beardDensity===.65&&restored.hair.beardLength===1.6);
 await page.locator('#identityMaps').click();await page.waitForFunction(()=>[...document.querySelectorAll('#mapGallery img')].length===4&&[...document.querySelectorAll('#mapGallery img')].every(im=>im.complete&&im.naturalWidth===2048));check('actual UV map viewer',await page.locator('#mapsDialog').evaluate(e=>e.open));await page.screenshot({path:path.join(out,'maps.png')});await page.locator('#mapsClose').click();
 await page.locator('#layer').selectOption('normal');await page.waitForTimeout(200);await page.screenshot({path:path.join(out,'normal-layer.png')});await page.locator('#layer').selectOption('roughness');await page.waitForTimeout(200);await page.screenshot({path:path.join(out,'roughness-layer.png')});await page.locator('#layer').selectOption('beauty');
 await page.locator('#lightPreset').selectOption('raking');await page.evaluate(()=>window.__SKIN_LAB__.setCamera('cheek'));await page.waitForTimeout(200);await page.screenshot({path:path.join(out,'weathered-macro.png')});
 await page.locator('#lightPreset').selectOption('studio');await page.evaluate(()=>window.__SKIN_LAB__.setCamera('portrait'));
 const box=await page.locator('#compare').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();check('baseline press active',await page.evaluate(()=>window.__SKIN_LAB__.state.baseline));await page.mouse.up();check('baseline release restored',await page.evaluate(()=>!window.__SKIN_LAB__.state.baseline));
 await page.evaluate(()=>Promise.all([window.__SKIN_LAB__.identity.set('porcelain'),window.__SKIN_LAB__.identity.set('umber'),window.__SKIN_LAB__.identity.set('weathered')]));check('rapid switching preserves last request',await page.evaluate(()=>window.__SKIN_LAB__.identity.current()==='weathered'));
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__SKIN_LAB__.setCamera('portrait'));await select('porcelain');await page.screenshot({path:path.join(out,'mobile-viewport.png')});await page.locator('#mobileToggle').click();check('mobile parameter panel accessible',await page.locator('.side').isVisible());await page.screenshot({path:path.join(out,'mobile-panel.png')});await page.locator('#mobileToggle').click();
 check('no JavaScript exceptions',report.pageErrors.length===0);check('no renderer or shader errors',report.consoleErrors.length===0);check('no failed asset loads',report.failedRequests.length===0);check('runtime has no recorded errors',await page.evaluate(()=>window.__SKIN_LAB__.state.errors.length===0));
 report.success=true;report.visualAcceptance='manual review required; automated assertions are not artistic acceptance';console.log(JSON.stringify({success:true,checks:report.checks,identities:report.identities.map(x=>({id:x.id,hair:x.state.identityHair}))},null,2));
})().catch(e=>{report.success=false;report.failure=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));if(browser)await browser.close();});

