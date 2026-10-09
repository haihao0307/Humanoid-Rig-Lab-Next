const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{PNG}=require('pngjs');
const repo=path.resolve(__dirname,'../../..'),out=process.env.EVIDENCE_DIR||'/tmp/et05-anatomy';fs.mkdirSync(out,{recursive:true});
const report={version:'ET05',sourceCommit:process.env.GITHUB_SHA||null,backend:'Chromium / SwiftShader',physicalMobileDevice:false,errors:[],consoleErrors:[],failedRequests:[],checks:{}};let browser,page,server;
function diff(a,b){a=PNG.sync.read(a);b=PNG.sync.read(b);assert.equal(a.width,b.width);assert.equal(a.height,b.height);let sum=0,changed=0;for(let i=0;i<a.data.length;i+=4){let d=0;for(let c=0;c<3;c++)d+=Math.abs(a.data[i+c]-b.data[i+c]);sum+=d;if(d>5)changed++;}return {meanRGB:sum/(a.width*a.height*3),changedFraction:changed/(a.width*a.height)};}
(async()=>{
 server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),f=path.resolve(repo,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(repo+path.sep))return res.writeHead(403).end();const type={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary'}[path.extname(f)]||'application/octet-stream';res.setHeader('Content-Type',type);const st=fs.createReadStream(f);st.on('error',()=>{if(!res.headersSent)res.writeHead(404);res.end();});st.pipe(res);}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port+'/skin-quality-lab/emily-transfer/index.html';report.url=url;
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});page=await browser.newPage({viewport:{width:1440,height:1040},deviceScaleFactor:1});page.setDefaultTimeout(60000);
 await page.addInitScript(()=>{window.__EYE_QA_FREEZE__=true;});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});page.on('requestfailed',r=>report.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.__SKIN_LAB__?.state.ready&&window.__EYES__&&window.__TALKINGHEAD__,{},{timeout:180000});
 assert.equal(await page.evaluate(()=>__SKIN_LAB__.state.version),'emily-transfer/5.0.0');assert.equal(await page.evaluate(()=>__EYES__.version),'eyes/5.0.0');assert.equal(await page.locator('canvas').count(),1);
 async function pixels(){await page.evaluate(()=>__SKIN_LAB__.render());return Buffer.from((await page.evaluate(()=>document.querySelector('#viewport canvas').toDataURL('image/png'))).split(',')[1],'base64');}
 async function shot(name){const b=await pixels();fs.writeFileSync(out+'/'+name+'-canvas.png',b);await page.screenshot({path:out+'/'+name+'.png'});return b;}
 await page.click('[data-camera="eyes"]');await page.evaluate(()=>{__TALKINGHEAD__.set({headMotion:false,paused:true,manualYaw:0,manualPitch:0});__EYES__.setMode('camera');__EYES__.set({autoBlink:false,autoPupil:false,pupilMM:3.4,manualBlink:0,squint:0,opening:.92});__EYES__.step(0,true);});
 const open=await shot('01-eyes-open');const info=await page.evaluate(()=>__EYES__.info());assert.equal(info.contact.length,2);
 for(const c of info.contact){
  assert.equal(c.penetratingTestVertices,0,'Open state penetrates sampled globe surface');assert.equal(c.innerShell,true);assert.equal(c.freeMarginMesh,true);
  assert(c.horizontalApertureMM>=21.7&&c.horizontalApertureMM<=22.6,'Horizontal fissure outside ET05 target: '+c.horizontalApertureMM);
  assert(c.verticalApertureMM>=5.8&&c.verticalApertureMM<=7.4,'Vertical fissure outside ET05 target: '+c.verticalApertureMM);
  assert(c.upperMarginThicknessMM>=.32&&c.upperMarginThicknessMM<=.52,'Upper margin lacks anatomical thickness: '+c.upperMarginThicknessMM);
  assert(c.lowerMarginThicknessMM>=.20&&c.lowerMarginThicknessMM<=.36,'Lower margin thickness outside target: '+c.lowerMarginThicknessMM);
  assert(c.upperMarginThicknessMM>c.lowerMarginThicknessMM+.08,'Upper margin is not distinctly thicker than lower margin');
  assert(c.posteriorTearGapMM>=.04&&c.posteriorTearGapMM<=.06,'Posterior gap outside target');
  assert(c.medialGapAt90MM>0&&c.medialGapAt90MM<1.8,'Medial canthus fails progressive closure: '+c.medialGapAt90MM);
  assert(c.lateralGapAt90MM>0&&c.lateralGapAt90MM<2.2,'Lateral canthus fails progressive closure: '+c.lateralGapAt90MM);
 }
 report.checks.restingAnatomy=info.contact;
 await page.evaluate(()=>{__EYES__.set({manualBlink:.5});__EYES__.step(0,true);});const half=await shot('02-half-closure');const halfInfo=await page.evaluate(()=>__EYES__.info());assert(halfInfo.contact.every(c=>c.penetratingTestVertices===0));report.checks.halfClosure=halfInfo.contact;
 await page.evaluate(()=>{__EYES__.set({manualBlink:1});__EYES__.step(0,true);});const closed=await shot('03-full-closure');const closedInfo=await page.evaluate(()=>__EYES__.info());assert(closedInfo.contact.every(c=>c.penetratingTestVertices===0));report.checks.fullClosure=closedInfo.contact;
 report.checks.openToHalf=diff(open,half);report.checks.halfToClosed=diff(half,closed);assert(report.checks.openToHalf.meanRGB>.05&&report.checks.halfToClosed.meanRGB>.03,'Closure does not visibly change rendered lids');
 await page.evaluate(()=>{__EYES__.set({manualBlink:0});__EYES__.setTarget([-.18,.10,.65]);__EYES__.step(0,true);});await shot('04-gaze-left-up');let moved=await page.evaluate(()=>__EYES__.info());assert(moved.contact.every(c=>c.penetratingTestVertices===0));
 await page.evaluate(()=>{__EYES__.setTarget([.18,.04,.65]);__EYES__.step(0,true);});await shot('05-gaze-right-down');moved=await page.evaluate(()=>__EYES__.info());assert(moved.contact.every(c=>c.penetratingTestVertices===0));report.checks.gazeContact=moved.contact;
 await page.evaluate(()=>{__EYES__.setMode('camera');__EYES__.set({opening:.65,manualBlink:0});__EYES__.step(0,true);});const narrow=await page.evaluate(()=>__EYES__.info().contact.map(x=>x.verticalApertureMM));await shot('06-narrow-rest');
 await page.evaluate(()=>{__EYES__.set({opening:1.08});__EYES__.step(0,true);});const wide=await page.evaluate(()=>__EYES__.info().contact.map(x=>x.verticalApertureMM));assert(wide.every((v,i)=>v>narrow[i]+1.5));report.checks.openingControl={narrow,wide};
 await page.evaluate(()=>{__EYES__.set({opening:.92,manualBlink:0});__EYES__.step(0,true);});await page.click('[data-camera="portrait"]');await shot('07-portrait');
 await page.setViewportSize({width:390,height:844});await page.click('[data-camera="eyes"]');await page.evaluate(()=>__EYES__.step(0,true));await shot('08-mobile-eyes');await page.click('#mobileToggle');assert(await page.locator('.side').isVisible());report.checks.mobileViewport={size:[390,844],panel:true,physicalDevice:false};
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.failedRequests,[]);report.passed=true;fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log('ET05_ANATOMY_PASS',JSON.stringify({resting:report.checks.restingAnatomy,closure:{openToHalf:report.checks.openToHalf,halfToClosed:report.checks.halfToClosed},errors:report.errors}));
})().catch(async e=>{report.passed=false;report.failure=e.stack||String(e);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.error(e);if(page)await page.screenshot({path:out+'/failure.png',timeout:30000}).catch(()=>{});process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.close();});
