const fs=require('fs'),path=require('path'),cp=require('child_process');const {chromium}=require('playwright');
const dir=path.resolve(__dirname,'..'),root=path.resolve(dir,'../..'),out='/tmp/et03-diagnostics';fs.mkdirSync(out,{recursive:true});
let app=fs.readFileSync(dir+'/app.js','utf8');app=app.replace('window.__EYES__={','window.__ET03_DEBUG__={eyesRig,renderer,scene,skin,mesh,fuzz};window.__EYES__={');fs.writeFileSync(dir+'/app.js',app);
let browser,server;const errors=[];
(async()=>{
 server=cp.spawn('python3',['-m','http.server','8124','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});await new Promise(r=>setTimeout(r,800));
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});const page=await browser.newPage({viewport:{width:1440,height:1040}});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(90000);
 await page.goto('http://127.0.0.1:8124/skin-quality-lab/emily-transfer/index.html',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.__SKIN_LAB__?.state.ready,{},{timeout:240000});
 await page.evaluate(()=>{window.__EYE_QA_FREEZE__=true;__EYES__.set({autoBlink:false,autoPupil:false,pupilMM:3.4});__SKIN_LAB__.setCamera('iris');__EYES__.step(0,true)});
 async function shot(name){await page.evaluate(()=>__SKIN_LAB__.render());await page.screenshot({path:out+'/'+name+'.png'});}
 await shot('01-current');
 await page.evaluate(()=>{for(const e of __ET03_DEBUG__.eyesRig.eyes)e.lid.inside.visible=false;});await shot('02-no-inner');
 await page.evaluate(()=>{for(const e of __ET03_DEBUG__.eyesRig.eyes)e.lid.inside.visible=true;__ET03_DEBUG__.renderer.shadowMap.enabled=false;__ET03_DEBUG__.scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});});await shot('03-no-shadows');
 await page.evaluate(()=>{__ET03_DEBUG__.renderer.shadowMap.enabled=true;__ET03_DEBUG__.renderer.shadowMap.needsUpdate=true;__ET03_DEBUG__.scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});__SKIN_LAB__.set({detail:0,meso:0,micro:0,relief:0,pores:0});});await shot('04-no-normal-relief');
 await page.evaluate(()=>{__EYES__.set({enabled:false});});await shot('05-original-head');
 const metrics=await page.evaluate(()=>__ET03_DEBUG__.eyesRig.eyes.map(e=>{const g=e.lid.inside.geometry,p=g.attributes.position,n=g.attributes.normal;let positive=0,negative=0;for(let i=0;i<n.count;i++){if(n.getZ(i)>0)positive++;else negative++;}return {name:e.c.name,vertices:p.count,normalPositiveZ:positive,normalNegativeZ:negative,contact:e.contactReport};}));
 fs.writeFileSync(out+'/report.json',JSON.stringify({errors,metrics,sourceCommit:process.env.GITHUB_SHA},null,2));console.log('LAYER_DIAGNOSTICS',JSON.stringify(metrics));
})().catch(e=>{console.error(e);fs.writeFileSync(out+'/failure.txt',e.stack);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server?.kill();});
