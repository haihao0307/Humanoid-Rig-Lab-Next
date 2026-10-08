const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),vm=require('vm'),{execFileSync}=require('child_process');
const {chromium}=require('playwright'),{PNG}=require('pngjs');
const D=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'evidence');
const sha=process.env.PUBLISHED_COMMIT||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert(/^[0-9a-f]{40}$/.test(sha));fs.mkdirSync(OUT,{recursive:true});
const raw='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+sha+'/skin-quality-lab/emily-transfer/preview.html',url='https://htmlpreview.github.io/?'+raw;
const report={version:'ET02.0',publishedCommit:sha,url,networkInterception:false,localServer:false,mobilePhysicalDevice:false,errors:[],consoleErrors:[],failedRequests:[],checks:{}};
let browser,page;
async function settle(){await page.evaluate(()=>{window.__EYES__.step(0);window.__SKIN_LAB__.render();});}
async function shot(name){await settle();await page.screenshot({path:OUT+'/'+name+'.png',timeout:90000});console.log('PUBLIC_SCREENSHOT',name);}
(async()=>{
 let r;for(let i=0;i<4;i++){r=await fetch(raw);if(r.ok)break;await new Promise(resolve=>setTimeout(resolve,4000));}assert(r.ok,'Immutable preview unavailable');
 const html=await r.text();report.htmlBytes=Buffer.byteLength(html);report.htmlSHA256=crypto.createHash('sha256').update(html).digest('hex');
 assert.equal(report.htmlSHA256,JSON.parse(fs.readFileSync(D+'/EYES_BUILD_MANIFEST.json')).previewSHA256);
 const m=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(m.length,1);new vm.Script(m[0][1]);
 browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:1440,height:1040},deviceScaleFactor:1});page.setDefaultTimeout(60000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 page.on('requestfailed',r=>report.failedRequests.push({url:r.url(),failure:r.failure()?.errorText}));
 let originalRequests=0;page.on('request',r=>{if(r.url().includes('alteredqualia.com'))originalRequests++;});
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
 // The preview service loads the actual HTML asynchronously. Do not reference
 // an undeclared global in this readiness probe before its script has executed.
 await page.waitForFunction(()=>window.__SKIN_LAB__?.state?.ready===true,null,{timeout:240000});
 await settle();assert.equal(await page.evaluate(()=>window.__SKIN_LAB__.state.version),'emily-transfer/2.0.0');
 const data=await page.evaluate(()=>document.querySelector('#viewport canvas').toDataURL());
 const png=PNG.sync.read(Buffer.from(data.split(',')[1],'base64'));let warm=0;const colors=new Set();
 for(let i=0;i<png.data.length;i+=4){const r=png.data[i],g=png.data[i+1],b=png.data[i+2];if(r>65&&r>g*1.08&&r>b*1.15)warm++;colors.add((r>>3)*1024+(g>>3)*32+(b>>3));}
 report.checks.canvas={width:png.width,height:png.height,colorBins:colors.size,skinFraction:warm/(png.width*png.height)};
 assert(colors.size>250&&report.checks.canvas.skinFraction>.05,'Public canvas is empty');
 await shot('public-et02-desktop');report.checks.initial=await page.evaluate(()=>window.__EYES__.pose());
 assert(report.checks.initial.eyes.every(e=>e.targetErrorDegrees<.02));
 await page.click('[data-gaze="pointer"]');await page.mouse.move(710,470);await settle();
 await page.click('[data-gaze="locked"]');const target=await page.evaluate(()=>window.__EYES__.pose().target);
 await page.locator('#eye-headYaw').evaluate(el=>{el.value='12';el.dispatchEvent(new Event('input',{bubbles:true}));});await settle();
 const locked=await page.evaluate(()=>window.__EYES__.pose());assert.deepEqual(locked.target,target);assert(locked.eyes.every(e=>e.targetErrorDegrees<.02));
 report.checks.lock=locked;await shot('public-et02-locked');
 // Exercise actual temporal smoothing, not only a forced static pose solve.
 const temporal=await page.evaluate(()=>{window.__EYES__.set({headYaw:0,autoBlink:false});window.__EYES__.setTarget([-.10,.085,.6]);for(let i=0;i<60;i++)window.__EYES__.advance(1/60);return window.__EYES__.pose();});
 assert(temporal.eyes.every(e=>e.targetErrorDegrees<.05));report.checks.temporalConvergence=temporal;
 await page.click('#eye-reset');await page.click('[data-camera="eye"]');await shot('public-et02-eye-macro');
 await page.click('[data-camera="portrait"]');await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>window.__SKIN_LAB__.setCamera('portrait'));await shot('public-et02-mobile');
 await page.click('#mobileToggle');assert(await page.locator('.side').isVisible());await page.click('[data-gaze="pointer"]');await page.click('#mobileToggle');
 report.checks.mobile={width:390,height:844,panel:true,gazeSwitch:true,realDevice:false};
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.failedRequests,[]);assert.equal(originalRequests,0);
 report.checks.noOriginalEyeAssets=true;report.passed=true;report.verifiedAt=new Date().toISOString();
 fs.writeFileSync(OUT+'/eyes-public.json',JSON.stringify(report,null,2));console.log('ET02_PUBLIC_PASS',JSON.stringify(report));
})().catch(async e=>{report.passed=false;report.failure=e.stack;fs.writeFileSync(OUT+'/eyes-public.json',JSON.stringify(report,null,2));console.error(e);if(page)await page.screenshot({path:OUT+'/public-failure.png',timeout:60000}).catch(()=>{});process.exitCode=1;}).finally(async()=>await browser?.close());
