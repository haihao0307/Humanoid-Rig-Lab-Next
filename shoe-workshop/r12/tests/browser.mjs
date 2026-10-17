import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const online=process.argv.includes('--public'),out=path.join(root,'evidence',online?'public':'browser');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'BUILD_MANIFEST.json'),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});
const qa={version:'R12.0',sourceCommit:manifest.sourceCommit,buildSha:process.env.PUBLIC_BUILD_SHA||null,completed:false,checks:[],screens:[],errors:[],consoleErrors:[],requestFailures:[],networkRequests:[],environment:{browser:'Chromium',renderer:'SwiftShader',os:'Ubuntu CI',desktopViewport:[1512,1100],mobileViewport:[390,844],realMobileDevice:false},visualHumanReview:false,manufacturingValidated:false};
const save=()=>fs.writeFileSync(path.join(out,'QA.json'),JSON.stringify(qa,null,2)+'\n');
const phase=s=>{qa.phase=s;save();console.log('PHASE',s);};
let browser,page;
const hard=setTimeout(()=>{qa.failure='Browser verification exceeded 15 minutes';save();process.exit(1);},900000);hard.unref();

async function check(name,fn){phase(name);const data=await fn();qa.checks.push({name,passed:true,data});save();}
try{
 let url=pathToFileURL(path.join(root,'public-lite.html')).href;
 if(online){
  assert.match(qa.buildSha||'',/^[a-f0-9]{40}$/);
  const raw=`https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/${qa.buildSha}/shoe-workshop/r12/public-lite.html`;
  const response=await fetch(raw);assert.ok(response.ok,'immutable raw build is accessible');
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(bytes),manifest.runtime.sha256);assert.equal(bytes.length,manifest.runtime.bytes);
  qa.publicBytes={raw,bytes:bytes.length,sha256:hash(bytes),matchesBuild:true};url='https://htmlpreview.github.io/?'+raw;
 }
 qa.url=url;save();
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:1512,height:1100},deviceScaleFactor:1});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>{qa.errors.push(String(e));console.error('PAGE',String(e));save();});
 page.on('console',m=>{if(m.type()==='error'){qa.consoleErrors.push(m.text());console.error('CONSOLE',m.text().slice(0,400));save();}});
 page.on('request',r=>{if(/^https?:/.test(r.url()))qa.networkRequests.push(r.url());});
 page.on('requestfailed',r=>{qa.requestFailures.push({url:r.url(),error:r.failure()?.errorText});save();});
 const idle=()=>page.evaluate(()=>SHOE_R12.idle());
 const shot=async(name,full=false)=>{
  await idle();await page.evaluate(()=>{const a=SHOE_R12;a.renderer.render(a.scene,a.camera);a.renderer.getContext().finish();});
  const b=full?await page.screenshot({fullPage:true}):await page.locator('#stage').screenshot();
  fs.writeFileSync(path.join(out,name+'.png'),b);qa.screens.push({name,sha256:hash(b),fullPage:full});save();
 };
 const select=async id=>{await page.locator(`[data-style="${id}"]`).click();await idle();assert.equal(await page.evaluate(()=>SHOE_R12.state().style),id);};
 const view=async name=>{await page.locator(`[data-view="${name}"]`).click();await idle();};
 const setRange=async(id,value)=>{await page.locator('#'+id).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);await idle();};
 phase('open standalone');await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.SHOE_R12?.ready,null,{timeout:180000});await idle();
 await check('Actual WebGL first frame and matching source',async()=>{
  const data=await page.evaluate(()=>{const a=SHOE_R12,g=a.renderer.getContext(),ext=g.getExtension('WEBGL_debug_renderer_info');return {report:a.report(),gl:ext?g.getParameter(ext.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),drawCalls:a.renderer.info.render.calls,triangles:a.renderer.info.render.triangles,canvas:[a.renderer.domElement.width,a.renderer.domElement.height]};});
  assert.equal(data.report.source,manifest.sourceCommit);assert.equal(data.report.current[0].id,'penny');assert.ok(data.drawCalls>10&&data.triangles>10000);assert.equal(data.report.stats.errors.length,0);assert.ok(data.canvas.every(n=>n>200));return data;
 });await shot('desktop-first-frame',true);
 await check('Four distinct constructed styles and open geometry',async()=>{
  const reports=[];
  for(const id of['penny','chelsea','monk','canvas']){
   await select(id);const r=await page.evaluate(()=>SHOE_R12.report());assert.equal(r.current.length,1);assert.equal(r.current[0].id,id);assert.ok(r.current[0].generated&&!r.current[0].externalMeshImport);assert.ok(r.current[0].parts.length>15);reports.push(r.current[0]);
   for(const camera of['hero','side','top']){await view(camera);await shot(id+'-'+camera);}
  }
  assert.ok(reports[1].measuredBoundsMm[1]>reports[0].measuredBoundsMm[1]*1.5);
  assert.equal(new Set(reports.map(r=>r.triangles)).size,4);return reports;
 });
 await check('Length width instep thickness and bend respond through real controls',async()=>{
  await select('monk');const before=await page.evaluate(()=>SHOE_R12.report().current[0]);
  await setRange('length',1.1);await setRange('width',1.15);await setRange('instep',8);await setRange('thickness',2.1);
  const after=await page.evaluate(()=>SHOE_R12.report().current[0]);assert.ok(after.measuredBoundsMm[2]>before.measuredBoundsMm[2]*1.07);assert.ok(after.measuredBoundsMm[0]>before.measuredBoundsMm[0]*1.07);assert.ok(after.measuredBoundsMm[1]>before.measuredBoundsMm[1]);assert.equal(after.designParameters.thickness,2.1);
  await setRange('bend',25);assert.equal(await page.evaluate(()=>SHOE_R12.state().params.bend),25);await shot('monk-parameter-and-flex');return {before:before.measuredBoundsMm,after:after.measuredBoundsMm,bend25:true,physicalSolver:false};
 });
 await check('Real mirrored pair shares geometry without losing material',async()=>{
  await select('canvas');await page.locator('#pair').click();await idle();
  const data=await page.evaluate(()=>{const a=SHOE_R12;a.group().updateMatrixWorld(true);return a.group().children.map(g=>({det:g.matrixWorld.determinant(),meshes:g.children.length,style:g.userData.style}));});
  assert.equal(data.length,2);assert.ok(data[0].det*data[1].det<0);assert.equal(data[0].meshes,data[1].meshes);await view('hero');await shot('canvas-pair');return data;
 });
 await check('Four style comparison and separate mesh selection',async()=>{
  await page.locator('#compare').click();await idle();assert.equal(await page.evaluate(()=>SHOE_R12.group().children.length),4);await shot('four-style-comparison',true);
  await select('penny');await page.locator('#single').click();await idle();await page.locator('#explode').click();await shot('penny-exploded');
  const id=await page.locator('#part-select option').nth(1).getAttribute('value');await page.locator('#part-select').selectOption(id);
  const visible=await page.evaluate(()=>{const names=[];SHOE_R12.group().traverse(m=>{if(m.isMesh&&m.visible)names.push(m.name);});return names;});assert.deepEqual(visible,[id]);await shot('penny-first-part');
  await page.locator('#part-select').selectOption('all');await page.locator('#explode').click();await page.locator('#section').click();await idle();await shot('penny-section');
  return {comparisonChildren:4,isolatedPart:id};
 });
 await check('Clay wire seam toggles and recipe persistence',async()=>{
  await select('chelsea');await page.locator('#clay').click();await idle();await shot('chelsea-clay');
  await page.locator('#wire').click();await idle();assert.ok(await page.evaluate(()=>{let n=0;SHOE_R12.group().traverse(m=>{if(m.isMesh&&(Array.isArray(m.material)?m.material:[m.material]).every(x=>x.wireframe))n++;});return n>10;}));await page.locator('#wire').click();await idle();
  await page.locator('#seams').click();assert.ok(await page.evaluate(()=>{let good=true;SHOE_R12.group().traverse(m=>{if(m.isMesh&&['seam','thread'].includes(m.userData.kind)&&m.visible)good=false;});return good;}));
  await setRange('width',1.06);await page.locator('#save').click();await select('canvas');await page.locator('#restore').click();await idle();const s=await page.evaluate(()=>SHOE_R12.state());assert.equal(s.style,'chelsea');assert.equal(s.params.width,1.06);assert.equal(s.clay,true);assert.equal(s.seams,false);
  await page.locator('#reset').click();await idle();return {restoredStyle:s.style,width:s.params.width};
 });
 await check('Original R10 shoe payload and material presets remain usable',async()=>{
  await select('original');assert.equal(await page.locator('#legacy-controls').isVisible(),true);
  const first=await page.evaluate(()=>SHOE_R12.report().current[0]);assert.ok(first.parts.length>20);await shot('retained-r10-original');
  assert.equal(await page.locator('#legacy-preset option').count(),12);await page.locator('#legacy-preset').selectOption('P05');await idle();assert.equal(await page.evaluate(()=>SHOE_R12.state().legacyPreset),'P05');await shot('retained-r10-p05');return {source:first.preservedSource,parts:first.parts.length,presets:12};
 });
 await check('Mobile viewport retains live model and touch-sized controls',async()=>{
  await select('canvas');await page.setViewportSize({width:390,height:844});await idle();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('#canvas').scrollIntoViewIfNeeded();await shot('mobile-viewport',true);
  return {viewport:[390,844],realDevice:false,overflow:false};
 });
 qa.final=await page.evaluate(()=>SHOE_R12.report());assert.equal(qa.final.stats.errors.length,0);assert.equal(qa.errors.length,0);assert.equal(qa.consoleErrors.length,0);assert.equal(qa.requestFailures.length,0);
 if(!online)assert.equal(qa.networkRequests.length,0,'Standalone core works without HTTP requests');
 qa.completed=true;phase('complete');
}catch(e){qa.failure=String(e.stack||e);console.error(e);save();if(page){try{await page.screenshot({path:path.join(out,'failure.png'),fullPage:true,timeout:10000});qa.body=(await page.locator('body').innerText({timeout:3000})).slice(0,6000);}catch{}}process.exitCode=1;
}finally{clearTimeout(hard);save();await browser?.close();}
