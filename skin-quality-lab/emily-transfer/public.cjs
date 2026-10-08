const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),{execFileSync}=require('child_process'),assert=require('assert/strict'),crypto=require('crypto'),vm=require('vm'),{PNG}=require('pngjs');
const dir=__dirname,out='/tmp/skin-evidence',sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const relative='skin-quality-lab/emily-transfer/preview.html',raw='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+sha+'/'+relative;
// htmlpreview is the existing one-click entry. Do not accept a githack interstitial as delivery.
const url='https://htmlpreview.github.io/?'+raw;
const report={version:'ET01',packagingVersion:'1.0.1',publishedCommit:sha,url,networkInterception:false,localServer:false,physicalMobileDevice:false,device:'Chromium / SwiftShader',errors:[],consoleErrors:[],failedRequests:[],requests:[],checks:{},differences:{},passed:false};
let browser,page;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function pixelStats(buf){const p=PNG.sync.read(buf),bins=new Set();let skin=0;for(let i=0;i<p.data.length;i+=4){let r=p.data[i],g=p.data[i+1],b=p.data[i+2];bins.add((r>>3)*1024+(g>>3)*32+(b>>3));if(r>65&&r>g*1.08&&r>b*1.15)skin++;}return {width:p.width,height:p.height,skinFraction:skin/(p.width*p.height),colorBins:bins.size};}
function diff(a,b){a=PNG.sync.read(a);b=PNG.sync.read(b);assert.equal(a.width,b.width);assert.equal(a.height,b.height);let sum=0,changed=0;for(let i=0;i<a.data.length;i+=4){let d=Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1])+Math.abs(a.data[i+2]-b.data[i+2]);sum+=d;if(d>3)changed++;}return {meanAbsolute:sum/(a.width*a.height*3),changedFraction:changed/(a.width*a.height)};}
async function canvas(){await page.evaluate(()=>__SKIN_LAB__.render());const s=await page.evaluate(()=>document.querySelector('#viewport canvas').toDataURL('image/png'));return Buffer.from(s.split(',')[1],'base64');}
async function shot(name){await canvas();await page.screenshot({path:out+'/'+name+'.png',timeout:90000});}
function checkpoint(name){console.log('PUBLIC_CHECKPOINT',name,new Date().toISOString());}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1440,height:1040},deviceScaleFactor:1,serviceWorkers:'block'});
  page=await context.newPage();page.setDefaultTimeout(45000);
  let rejectScript;const scriptFailure=new Promise((resolve,reject)=>{rejectScript=reject});scriptFailure.catch(()=>{});
  page.on('pageerror',e=>{report.errors.push(e.message);rejectScript(e)});
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
  page.on('requestfailed',r=>report.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
  page.on('request',r=>report.requests.push(r.url()));
  const response=await context.request.get(raw,{timeout:90000});assert.equal(response.status(),200);
  const remote=await response.body(),local=fs.readFileSync(dir+'/preview.html');assert.equal(hash(remote),hash(local),'Published HTML differs from tested candidate');
  const scripts=[...remote.toString().matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];assert.equal(scripts.length,1);new vm.Script(scripts[0][1]);
  report.checks.transport={status:200,bytes:remote.length,sha256:hash(remote),exactCandidateMatch:true,finalInlineSyntax:true};checkpoint('published HTML identity');
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
  await Promise.race([page.waitForFunction(()=>window.__SKIN_LAB__?.state.ready,{},{timeout:180000}),scriptFailure]);
  assert.equal(await page.evaluate(()=>__SKIN_LAB__.state.version),'emily-transfer/1.0.0');
  const initial=await canvas();report.checks.desktop=pixelStats(initial);assert(report.checks.desktop.skinFraction>.05&&report.checks.desktop.colorBins>250,'Public canvas has no rendered head');
  await shot('public-desktop');fs.writeFileSync(out+'/public-canvas.png',initial);checkpoint('desktop rendered');
  const invariant=await page.evaluate(()=>__EMILY_TRANSFER__.invariants());
  await page.selectOption('#transferMode','base');const base=await canvas();report.differences.referenceVsBase=diff(initial,base);assert(report.differences.referenceVsBase.meanAbsolute>.05);assert.deepEqual(await page.evaluate(()=>__EMILY_TRANSFER__.invariants()),invariant);
  await page.selectOption('#transferMode','full');await page.click('[data-method="enhanced"]');const enhanced=await canvas();report.differences.enhancedVsReference=diff(enhanced,initial);assert(report.differences.enhancedVsReference.meanAbsolute>.01);await shot('public-enhanced');
  await page.selectOption('#transferMode','split');const split=await canvas();await page.locator('#wipe').evaluate(el=>{el.value='72';el.dispatchEvent(new Event('input',{bubbles:true}))});const moved=await canvas();report.differences.wipe=diff(split,moved);assert(report.differences.wipe.changedFraction>.0001);await shot('public-live-comparison');checkpoint('live split and shader methods');
  await page.selectOption('#transferMode','full');
  const beforeCamera=await page.evaluate(()=>__SKIN_LAB__.camera());await page.mouse.move(610,480);await page.mouse.down();await page.mouse.move(720,500,{steps:5});await page.mouse.up();await page.waitForTimeout(800);const afterCamera=await page.evaluate(()=>__SKIN_LAB__.camera());assert.notDeepEqual(beforeCamera.position,afterCamera.position);report.checks.mouseOrbit=true;
  await page.click('[data-camera="cheek"]');await page.waitForTimeout(600);await shot('public-cheek');const detail=await canvas();await page.uncheck('#feature-detail');report.differences.microDetail=diff(detail,await canvas());assert(report.differences.microDetail.meanAbsolute>.01);await page.check('#feature-detail');
  await page.click('[data-camera="ear"]');await page.selectOption('#lightPreset','back');await shot('public-ear');
  await page.click('#reset');await page.selectOption('#quality','medium');await page.setViewportSize({width:390,height:844});await page.waitForTimeout(600);await page.click('[data-camera="portrait"]');await shot('public-mobile-viewport');
  await page.click('#mobileToggle');assert(await page.locator('.side').isVisible());await page.click('[data-method="enhanced"]');await page.selectOption('#transferMode','split');await canvas();await shot('public-mobile-controls');await page.selectOption('#transferMode','full');await page.click('#mobileToggle');assert(!await page.locator('.side').isVisible());
  report.checks.mobile={width:390,height:844,rendered:true,panelOpenedClosed:true,methodSwitch:true,comparison:true,physicalDevice:false};
  report.checks.noEmilyAssetRequests=!report.requests.some(u=>u.includes('alteredqualia.com'));assert(report.checks.noEmilyAssetRequests);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);report.runtime=await page.evaluate(()=>__SKIN_LAB__.state);assert.deepEqual(report.runtime.errors,[]);
  report.passed=true;report.testedAt=new Date().toISOString();
  fs.writeFileSync(out+'/public-report.json',JSON.stringify(report,null,2));fs.writeFileSync(dir+'/public-report.json',JSON.stringify(report,null,2));fs.writeFileSync(out+'/OPEN_WEBSITE.txt',url);
  fs.mkdirSync(dir+'/evidence/public',{recursive:true});for(const f of fs.readdirSync(out).filter(n=>n.startsWith('public-')&&n.endsWith('.png')))fs.copyFileSync(out+'/'+f,dir+'/evidence/public/'+f);
  console.log('PUBLIC_DELIVERY_PASS',JSON.stringify({url,publishedCommit:sha,checks:report.checks,differences:report.differences,errors:report.errors}));
})().catch(async e=>{report.failure=e.stack;console.error(e);fs.writeFileSync(out+'/public-report.json',JSON.stringify(report,null,2));if(page){fs.writeFileSync(out+'/failed-page.html',await page.content().catch(()=>''));await page.screenshot({path:out+'/public-failure.png',timeout:45000}).catch(()=>{});}process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
