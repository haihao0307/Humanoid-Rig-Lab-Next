'use strict';
// Observe real playback on the same machine with no GPU timer instrumentation.
// Alternate pages to make warm-up and background effects visible.
const fs=require('fs');
const {chromium}=require(process.env.BODY_PLAYWRIGHT_PATH||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ready=p=>p.waitForFunction(()=>bodyImplicitR02?.report().ready&&!bodyImplicitR02.report().busy,null,{timeout:300000});
const pages={R39:'http://127.0.0.1:8914/人物身体_R39_动作与连续变形.html',R40:'http://127.0.0.1:8917/workbench'};
const bend={'pose.A.upperleg01.L.0':-50,'pose.A.upperleg01.R.0':-50,'pose.A.lowerleg01.L.0':65,'pose.A.lowerleg01.R.0':65,'pose.A.spine03.0':12};
const reach={'pose.A.upperarm01.L.1':-60,'pose.A.upperarm01.R.1':60,'pose.A.spine03.2':20};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BODY_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-gpu','--enable-unsafe-swiftshader']});
 const runs=[],errors=[];
 try{
  for(const version of ['R39','R40','R40','R39']){
   const page=await browser.newPage({viewport:{width:1200,height:800}});
   page.on('pageerror',e=>errors.push(version+': '+e.message));
   try{
    await page.goto(pages[version],{waitUntil:'domcontentloaded'});await ready(page);
    await page.evaluate(()=>bodyControlR17.apply({set:{'shape.weight':1,'shape.muscle':.12,'shape.age':.55,'shape.sex':.4},label:'动作性能对照'}));await ready(page);
    await page.evaluate(({bend,reach})=>bodyMotionLibraryR38.importDocument({schema:'body-motion-action-r38/1',action:{id:'benchmark',name:'动作性能对照',rig:'anny',duration:4,mode:'loop',easing:'smooth',frames:[{time:0,values:{}},{time:.3,values:bend},{time:.65,values:reach},{time:1,values:{}}]}}),{bend,reach});
    const start=Date.now();await page.evaluate(()=>{bodyMotionR37.play();});
    await page.waitForFunction(()=>bodyMotionR37.report().mode==='playing'||!!bodyMotionR37.report().error,null,{timeout:300000});
    const err=await page.evaluate(()=>bodyMotionR37.report().error);if(err)throw Error(err);
    const preparationMS=Date.now()-start;
    await wait(5000);
    const first=await page.evaluate(()=>bodyMotionR37.report());await wait(15000);
    const sample=await page.evaluate(()=>{const f=document.querySelector('#body-dynamic-embedded-p1').contentWindow,r=f.torsoStudyP1.renderer.report(),c=f.document.querySelector('#body-view'),gl=c.getContext('webgl2'),d=gl.getExtension('WEBGL_debug_renderer_info');return{motion:bodyMotionR37.report(),canvas:[c.width,c.height],renderer:d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):null,skin:r.originalActiveSkin,shadow:r.dynamicShadow,error:gl.getError()};});
    const elapsed=sample.motion.lastFrame-first.lastFrame,frames=sample.motion.frames-first.frames;
    const measuredFPS=frames*1000/elapsed,progressRatio=(sample.motion.phase-first.phase)*4000/elapsed;
    const ok=first.mode==='playing'&&sample.motion.mode==='playing'&&elapsed>=12000&&frames>0&&progressRatio>.9&&progressRatio<1.1&&sample.error===0&&sample.shadow?.unknownPixels===0&&!sample.skin?.skinMRTEnabled&&(version!=='R40'||sample.shadow.validationReadbacks===1);
    runs.push({version,preparationMS,measuredFPS,frames,elapsedMS:elapsed,progressRatio,canvas:sample.canvas,renderer:sample.renderer,materialPassCount:sample.skin?.materialPassCount??3,shadowUnknown:sample.shadow?.unknownPixels,validationReadbacks:sample.shadow?.validationReadbacks??null,averageInterpolationMS:sample.motion.averageInterpolationMS,averageRenderMS:sample.motion.averageRenderMS,ok});
    process.stderr.write(JSON.stringify(runs.at(-1))+'\n');
   }finally{await page.close();}
  }
 }catch(e){errors.push(e.stack);}finally{await browser.close();}
 const passed=errors.length===0&&runs.length===4&&runs.every(x=>x.ok),out={passed,runs,errors,note:'One device, headless Chrome, alternating order; native playback without GPU query instrumentation. FPS and preparation time are not guarantees.'};
 fs.mkdirSync('qa/skin-r40',{recursive:true});fs.writeFileSync('qa/skin-r40/playback-abba.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));if(!passed)process.exitCode=1;
})();
