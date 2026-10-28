'use strict';
// Off-screen checks against the actual working page. No screenshot gallery.
const fs=require('fs');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const checks=[],errors=[];
function check(name,passed,detail){checks.push({name,passed:!!passed,detail});if(!passed)throw Error(name);}
const ready=page=>page.waitForFunction(()=>{if(window.__BODY_IMPLICIT_R02_ERROR__)throw Error(window.__BODY_IMPLICIT_R02_ERROR__);const r=window.bodyImplicitR02?.report();return r?.ready&&!r.busy;},null,{timeout:180000});
async function compare(page,id,api){
  const frame=page.frameLocator('#'+id);
  return frame.locator('#body-view').evaluate((canvas,api)=>{
    const gl=canvas.getContext('webgl2'),renderer=window[api].renderer,w=canvas.width,h=canvas.height;
    function sample(disabled){
      window.__BODY_EDGE_AA_DISABLED__=disabled;
      const start=performance.now();renderer.draw();gl.finish();const ms=performance.now()-start;
      const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return{pixels,ms};
    }
    const before=sample(true),after=sample(false);let changed=0,largest=0,total=0;
    for(let i=0;i<before.pixels.length;i+=4){let d=0;for(let c=0;c<4;c++)d=Math.max(d,Math.abs(before.pixels[i+c]-after.pixels[i+c]));if(d>1){changed++;total+=d;largest=Math.max(largest,d);}}
    return {width:w,height:h,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,pixels:w*h,changed,largest,meanChanged:changed?total/changed:0,drawMS:{unfiltered:before.ms,filtered:after.ms},webglError:gl.getError(),aa:renderer.report().edgeAntialiasing};
  },api);
}
(async()=>{
 let browser;const startedUTC=new Date().toISOString();
 try{
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-gpu','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.setDefaultTimeout(180000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8914/workbench',{waitUntil:'domcontentloaded'});await ready(page);
  let state=await page.evaluate(()=>({surface:bodyImplicitR02.report().renderer.activeSurface,state:bodyImplicitR02.state(),archive:bodyImplicitR02.archive()}));
  check('default body opens',state.surface==='source',state.surface);
  const fixed=await compare(page,'body-source-embedded-r25','bodySourceAtlasR21');
  check('default silhouette receives bounded high-resolution edge filtering',fixed.aa?.frames>0&&fixed.changed>100&&fixed.changed<fixed.pixels*.3&&fixed.width>fixed.cssWidth&&fixed.pixels<=1502500&&fixed.webglError===0,fixed);
  const original=state.archive;original.person.r32ArchiveProbe={preserved:['head',3]};
  await page.evaluate(a=>bodyImplicitR02.restore(a),original);await ready(page);
  await page.evaluate(()=>bodyControlR17.apply({set:{'shape.weight':.43,'shape.muscle':.69,'local.measure-shoulder-dist-incr':.24,'pose.A.lowerarm01.L.0':30},label:'身体轮廓与参数检查'}));await ready(page);
  state=await page.evaluate(()=>({surface:bodyImplicitR02.report().renderer.activeSurface,state:bodyImplicitR02.state(),archive:bodyImplicitR02.archive()}));
  check('body shape, local control and joint continue to work',state.surface==='dynamic-body-p1'&&state.state.anny.phenotypes.weight===.43&&state.state.anny.phenotypes.muscle===.69&&state.state.anny.localChanges['measure-shoulder-dist-incr']===.24&&state.state.anny.pose['lowerarm01.L'][0]===30,{surface:state.surface});
  check('complete archive keeps unknown fields and head state',JSON.stringify(state.archive.person.r32ArchiveProbe)===JSON.stringify(original.person.r32ArchiveProbe)&&JSON.stringify(state.archive.person.headMorphology)===JSON.stringify(original.person.headMorphology));
  const dynamic=await compare(page,'body-dynamic-embedded-p1','torsoStudyP1');
  check('adjusted body receives the same edge filtering',dynamic.aa?.frames>0&&dynamic.changed>100&&dynamic.changed<dynamic.pixels*.3&&dynamic.pixels<=1502500&&dynamic.webglError===0,dynamic);
  for(const view of ['front','side','back','half']){
    await page.evaluate(v=>bodyImplicitR02.view(v),view);
    const r=await page.evaluate(()=>bodyImplicitR02.report().renderer);
    check(view+' view renders with edge filtering',r.activeSurface==='dynamic-body-p1'&&r.edgeAntialiasing.frames>0&&r.webglError===0,{camera:r.camera,frames:r.edgeAntialiasing.frames});
  }
  if(process.argv[2])await page.frameLocator('#body-dynamic-embedded-p1').locator('#body-view').screenshot({path:process.argv[2]});
  await page.evaluate(a=>bodyImplicitR02.restore(a),original);await ready(page);
  state=await page.evaluate(()=>({state:bodyImplicitR02.state(),archive:bodyImplicitR02.archive(),renderer:bodyImplicitR02.report().renderer}));
  check('complete person restores after adjustments',JSON.stringify(state.state)===JSON.stringify(original.person.state)&&JSON.stringify(state.archive.person.r32ArchiveProbe)===JSON.stringify(original.person.r32ArchiveProbe)&&state.renderer.characterTriangleFaces===0);
  await page.evaluate(()=>bodyControlR17.apply({set:{'pose.A.lowerarm01.L.0':-43.375,'pose.A.wrist.R.1':8.125},label:'连续动作与轮廓检查'}));await ready(page);
  state=await page.evaluate(()=>({surface:bodyImplicitR02.report().renderer.activeSurface,state:bodyImplicitR02.state()}));
  check('existing continuous joint mode remains available',state.surface==='pose-functions'&&state.state.anny.pose['lowerarm01.L'][0]===-43.375,state.surface);
  const pose=await compare(page,'body-pose-embedded-r29','bodyPoseFunctionsR29');
  check('continuous joint view receives edge filtering',pose.aa?.frames>0&&pose.changed>100&&pose.changed<pose.pixels*.3&&pose.webglError===0,pose);
  await page.evaluate(a=>bodyImplicitR02.restore(a),original);await ready(page);
  await page.setViewportSize({width:1100,height:760});
  await page.waitForTimeout(250);
  const resized=await page.evaluate(()=>{const f=document.querySelector('iframe[id^="body-"]'),c=f.contentDocument.querySelector('#body-view'),r=bodyImplicitR02.report().renderer;return{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight,aa:r.edgeAntialiasing,error:r.webglError};});
  check('resizing keeps a sharp working canvas and active filter',resized.width>0&&resized.height>0&&resized.width*resized.height<=1502500&&resized.aa?.frames>0&&resized.error===0,resized);
  await page.selectOption('#surface-mode-r25','continuous');await ready(page);
  await page.waitForFunction(()=>bodyImplicitR02.report().renderer.activeSurface==='continuous',null,{timeout:180000});
  const continuous=await page.evaluate(()=>bodyImplicitR02.report().renderer);
  check('continuous research display keeps edge filtering',continuous.activeSurface==='continuous'&&continuous.edgeAntialiasing?.frames>0&&continuous.characterTriangleFaces===0&&continuous.webglError===0,{aa:continuous.edgeAntialiasing,error:continuous.webglError});
  await page.close();
  const hi=await browser.newPage({viewport:{width:1100,height:760},deviceScaleFactor:2});hi.setDefaultTimeout(180000);hi.on('pageerror',e=>errors.push(e.message));
  await hi.goto('http://127.0.0.1:8914/workbench',{waitUntil:'domcontentloaded'});await ready(hi);
  const highDpi=await hi.evaluate(()=>{const f=document.querySelector('iframe[id^="body-"]'),c=f.contentDocument.querySelector('#body-view'),r=bodyImplicitR02.report().renderer;return{dpr:devicePixelRatio,width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight,aa:r.edgeAntialiasing,error:r.webglError};});
  check('high-density display keeps bounded sampling and filtering',highDpi.dpr===2&&highDpi.width>highDpi.cssWidth&&highDpi.width*highDpi.height<=1502500&&highDpi.aa?.frames>0&&highDpi.error===0,highDpi);
  await hi.close();
  check('no page errors',errors.length===0,errors);
 }catch(error){errors.push(error.stack);process.exitCode=1;}finally{
  await browser?.close();
  const build=JSON.parse(fs.readFileSync('BUILD-R32.json','utf8'));
  const result={startedUTC,finishedUTC:new Date().toISOString(),artifactSHA256:build.sha256,scope:'actual off-screen body workbench; displayed edge filtering, view and parameter/archive interactions',checks,errors,passed:checks.length>0&&checks.every(c=>c.passed)&&errors.length===0,newDeliveredImageFiles:0};
  fs.mkdirSync('qa/edges-r32',{recursive:true});fs.writeFileSync('qa/edges-r32/workbench.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }
})();
