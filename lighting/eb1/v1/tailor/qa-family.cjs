const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const family=process.env.QA_FAMILY||'knit',sets={knit:['K04','K01','K02','K03'],leather:['L04','L01','L02','L03'],denim:['D01','D02','D03','D04']},ids=sets[family];assert(ids);
const root=__dirname,out=path.join(root,(process.env.QA_PUBLIC?'public-':'local-')+family),url=process.env.QA_URL||'http://127.0.0.1:8000/runtime/';fs.mkdirSync(out,{recursive:true});
const report={passed:false,family,entry:url,source:process.env.GITHUB_SHA,rows:[],errors:[],physicalDeviceTested:false,visualAccepted:false};const save=()=>fs.writeFileSync(path.join(out,'BROWSER_REPORT.json'),JSON.stringify(report,null,2));save();
(async()=>{const b=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}),p=await b.newPage({viewport:{width:1440,height:1000}});p.setDefaultTimeout(240000);p.on('pageerror',e=>{report.errors.push(e.message);save();});p.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());save();}});
const audit=()=>p.evaluate(()=>window.__MP04__.audit());
const ready=async id=>{await p.waitForFunction(()=>{const a=window.__MP04__?.audit();return a&&!a.pending&&(a.selected||a.error);},{},{timeout:420000});const a=await audit();report.rows.push({case:id,audit:a});save();assert.equal(a.error,null);assert.equal(a.selected.id,id);assert.equal(a.glError,0);assert.equal(a.bodyVertexCount,25417);assert(a.rows.every(r=>r.layers===1&&r.opaqueBackingSheets===0));assert.equal(report.errors.length,0,report.errors.join('\n'));return a;};
const shot=async name=>{const clip=await p.locator('#stage').boundingBox();await p.screenshot({path:path.join(out,name+'.png'),clip,timeout:240000});console.log('SHOT',name);save();};
try{const r=await p.goto(url+'?look='+ids[0],{waitUntil:'domcontentloaded',timeout:120000});assert.equal(r.status(),200);
for(let i=0;i<ids.length;i++){const id=ids[i];if(i)assert(await p.evaluate(id=>window.__MP04__.select(id),id));const a=await ready(id);await p.evaluate(()=>window.__MP04__.frame('whole','three'));await shot(id+'-whole');
 if(i===0){await p.evaluate(()=>window.__MP04__.macro('top'));await shot(id+'-native-macro');
  if(family==='knit'){
   const thumbs=await p.evaluate(async()=>{const a=[...document.querySelectorAll('#looks img')];await Promise.all(a.map(i=>{i.loading='eager';return i.decode();}));return a.map(i=>i.naturalWidth);});assert.equal(thumbs.length,12);assert(thumbs.every(n=>n>0));report.rows.push({case:'twelve-original-thumbnails',widths:thumbs});
   await p.evaluate(()=>{window.__MP04__.frame('whole','rear');window.__MP04__.macro('top');});await shot('K04-back-exterior');
   await p.evaluate(()=>{window.__MP04__.frame('whole','three');window.__MP04__.macro('top');});
   const camera=await p.evaluate(()=>window.__MP04__.debug().viewer.camera.position.toArray());for(const angle of [30,160]){const a=await p.evaluate(x=>window.__MP04__.orbitLight(x),angle);assert.equal(a.activeLights,1);assert.equal(a.environmentLighting,false);report.rows.push({case:'single-lamp-'+angle,audit:a});await shot('single-light-'+angle);assert.deepEqual(await p.evaluate(()=>window.__MP04__.debug().viewer.camera.position.toArray()),camera);}
   await p.evaluate(()=>window.__MP04__.studioLight());
  }
  if(process.env.QA_MOTION==='1')for(const[motion,frame]of[['raise',90],['twist',60],['step',30]]){
   await p.evaluate(()=>window.__MP04__.debug().physics.reset());await p.evaluate(()=>window.__MP04__.frame('whole','three'));
   const before=await p.evaluate(()=>Array.from(window.__MP04__.debug().model.positions));await p.evaluate(id=>window.__MP04__.playMotion(id),motion);await p.evaluate(()=>window.__MP04__.pause());await p.evaluate(i=>window.__MP04__.seekMotionFrame(i),frame);
   const a=await audit(),after=await p.evaluate(()=>Array.from(window.__MP04__.debug().model.positions));assert(before.some((v,i)=>Math.abs(v-after[i])>.001));assert(a.motionAndContact.cachedPhysicalReplay);assert(a.motionAndContact.clipProof.passed);assert(a.motionAndContact.nativeRig.maxBoneLengthErrorMM<.001);await shot(id+'-'+motion+'-physical');report.rows.push({case:'native-motion-'+motion,audit:a});
  }
  await p.evaluate(()=>window.__MP04__.debug().physics.reset());
 }
}
await p.setViewportSize({width:390,height:844});await p.evaluate(()=>window.__MP04__.frame('whole','three'));await p.screenshot({path:path.join(out,'mobile-viewport.png'),timeout:240000});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(report.errors.length,0);report.passed=true;
}catch(e){report.errors.push(e.stack||String(e));console.error(e);await p.screenshot({path:path.join(out,'failure.png'),timeout:30000}).catch(()=>{});process.exitCode=1;}finally{save();await b.close();}})().catch(e=>{report.errors.push(e.stack||String(e));save();console.error(e);process.exitCode=1;});
