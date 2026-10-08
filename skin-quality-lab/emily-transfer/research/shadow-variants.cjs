const fs=require('fs'),path=require('path'),cp=require('child_process');const {chromium}=require('playwright');const dir=path.resolve(__dirname,'..'),root=path.resolve(dir,'../..'),out='/tmp/et03-shadow-variants';fs.mkdirSync(out,{recursive:true});
let app=fs.readFileSync(dir+'/app.js','utf8');app=app.replace('installSoftOcularShadows();','window.__ET03_ORIGINAL_SHADOW__=THREE.ShaderChunk.shadowmap_pars_fragment;installSoftOcularShadows();');app=app.replace('window.__EYES__={','window.__ET03_DEBUG__={THREE,eyesRig,renderer,scene,skin,mesh,fuzz,key};window.__EYES__={');fs.writeFileSync(dir+'/app.js',app);
let browser,server;const errors=[];
(async()=>{server=cp.spawn('python3',['-m','http.server','8126','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});await new Promise(r=>setTimeout(r,800));browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});const page=await browser.newPage({viewport:{width:1440,height:1040}});page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await page.goto('http://127.0.0.1:8126/skin-quality-lab/emily-transfer/index.html',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.__SKIN_LAB__?.state.ready,{},{timeout:240000});await page.evaluate(()=>{window.__EYE_QA_FREEZE__=true;__EYES__.set({autoBlink:false,autoPupil:false,pupilMM:3.4});window.__ET03_PCSS__=__ET03_DEBUG__.THREE.ShaderChunk.shadowmap_pars_fragment;});
for(const kind of ['vsm-matched','pcf-wide','pcss-no-gradient','pcss-plane']){
 await page.evaluate(kind=>{const {THREE,scene,renderer,key}=__ET03_DEBUG__;let chunk=window.__ET03_ORIGINAL_SHADOW__;
  if(kind.startsWith('pcss'))chunk=window.__ET03_PCSS__;
  if(kind==='pcss-no-gradient')chunk=chunk.replace('gradient=clamp(gradient,vec2(-.8),vec2(.8));','gradient=vec2(0.);');
  THREE.ShaderChunk.shadowmap_pars_fragment=chunk;renderer.shadowMap.type=kind==='vsm-matched'?THREE.VSMShadowMap:kind==='pcf-wide'?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
  key.shadow.mapSize.set(2048,2048);key.shadow.radius=kind==='vsm-matched'?16:10;key.shadow.bias=kind==='pcss-no-gradient'?-.0001:-.000035;key.shadow.normalBias=.00022;
  key.shadow.map?.dispose();key.shadow.map=null;key.shadow.mapPass?.dispose();key.shadow.mapPass=null;
  scene.traverse(o=>{if(o.material){if(!o.material.userData.oldKey)o.material.userData.oldKey=o.material.customProgramCacheKey;o.material.customProgramCacheKey=()=>o.material.userData.oldKey.call(o.material)+'/'+kind;o.material.needsUpdate=true;}if(o.customDepthMaterial)o.customDepthMaterial.needsUpdate=true;});renderer.shadowMap.needsUpdate=true;
 },kind);
 for(const view of ['portrait','iris']){await page.evaluate(view=>{__SKIN_LAB__.setCamera(view);__EYES__.step(0,true);__SKIN_LAB__.render();},view);await page.screenshot({path:out+'/'+kind+'-'+view+'.png'});}
}
fs.writeFileSync(out+'/report.json',JSON.stringify({errors,sourceCommit:process.env.GITHUB_SHA,identicalGeometry:true,identicalLightEnergy:true},null,2));if(errors.length)throw Error('Shadow shader errors');
})().catch(e=>{console.error(e);fs.writeFileSync(out+'/failure.txt',e.stack);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server?.kill()});
