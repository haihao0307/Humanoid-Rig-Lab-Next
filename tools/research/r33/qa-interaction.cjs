'use strict';
// Real pointer drags in a headless browser. No desktop pointer or image gallery.
const fs=require('fs'),crypto=require('crypto');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const checks=[],errors=[];
function check(name,ok,detail){checks.push({name,passed:!!ok,detail});if(!ok)throw Error(name);}
const ready=page=>page.waitForFunction(()=>{if(window.__BODY_IMPLICIT_R02_ERROR__)throw Error(window.__BODY_IMPLICIT_R02_ERROR__);const r=window.bodyImplicitR02?.report();return r?.ready&&!r.busy;},null,{timeout:180000});
async function dragAndCompare(page,id,api,dx,label){
 const canvas=page.frameLocator('#'+id).locator('#body-view'),box=await canvas.boundingBox();
 const startX=box.x+box.width*.52,startY=box.y+box.height*.54;
 await page.mouse.move(startX,startY);await page.mouse.down();
 const frameTimes=[];for(let i=1;i<=8;i++){const t=Date.now();await page.mouse.move(startX+dx*i/8,startY+5*Math.sin(i*.25));await canvas.evaluate(c=>c.getContext('webgl2').finish());frameTimes.push(Date.now()-t);}
 const before=await canvas.evaluate((c,api)=>{const g=c.getContext('webgl2');g.finish();const pixels=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,pixels);window.__MOTION_CHECK__=pixels;const r=window[api].renderer.report();return{width:c.width,height:c.height,aa:r.edgeAntialiasing,quality:r.originalActiveSkin?.motionShading||null,webglError:g.getError()};},api);
 await page.mouse.up();
 await page.waitForFunction(({id,api})=>{const f=document.querySelector('#'+id)?.contentWindow,r=f?.[api]?.renderer,p=api==='bodySourceAtlasR21'?f?.bodySourceAtlasR21?.report().precision:r?.precisionReport();if(p?.lastError)throw Error(p.lastError);return p?.ready;},{id,api},{timeout:240000});
 const comparison=await canvas.evaluate(c=>{const g=c.getContext('webgl2');g.finish();const p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);const before=window.__MOTION_CHECK__;let changed=0,isolatedBefore=0,isolatedAfter=0;const w=c.width,h=c.height,mask=(a,i)=>a[i]>a[i+1]+8&&a[i]>a[i+2]+8;for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=(y*w+x)*4;if(Math.max(Math.abs(p[i]-before[i]),Math.abs(p[i+1]-before[i+1]),Math.abs(p[i+2]-before[i+2]))>8)changed++;for(const [a,which]of [[before,0],[p,1]]){if(!mask(a,i))continue;let n=0;for(const d of [-4,4,-4*w,4*w])if(mask(a,i+d))n++;if(n<=1){if(which)isolatedAfter++;else isolatedBefore++;}}}delete window.__MOTION_CHECK__;return{changed,isolatedBefore,isolatedAfter,pixels:w*h,webglError:g.getError()};});
 const sorted=frameTimes.slice(2).sort((a,b)=>a-b),detail={before,comparison,frameTimesMS:frameTimes,medianMS:sorted[Math.floor(sorted.length/2)]};
 check(label+' draws smooth edges during actual drag',before.aa?.frames>0&&before.webglError===0&&(api!=='bodySourceAtlasR21'||before.quality==='boundary-consistent'),detail);
 check(label+' stays consistent after settling',comparison.webglError===0&&comparison.changed<Math.max(200,comparison.pixels*.0005)&&comparison.isolatedBefore<=comparison.isolatedAfter+20,comparison);
}
(async()=>{const startedUTC=new Date().toISOString(),browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-gpu','--enable-unsafe-swiftshader']}),viewport={width:Number(process.env.BODY_QA_WIDTH||1440),height:Number(process.env.BODY_QA_HEIGHT||900)},deviceScaleFactor=Number(process.env.BODY_QA_DPR||1);try{
 const page=await browser.newPage({viewport,deviceScaleFactor});page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8914/workbench',{waitUntil:'domcontentloaded'});await ready(page);
 const original=await page.evaluate(()=>bodyImplicitR02.archive());
 check('initial body uses current display',await page.evaluate(()=>bodyImplicitR02.report().renderer.activeSurface==='source'));
 await dragAndCompare(page,'body-source-embedded-r25','bodySourceAtlasR21',125,'oblique drag');
 await dragAndCompare(page,'body-source-embedded-r25','bodySourceAtlasR21',230,'back-side drag');
 await page.evaluate(()=>bodyControlR17.apply({set:{'shape.weight':.43,'shape.muscle':.69,'local.measure-shoulder-dist-incr':.24,'pose.A.lowerarm01.L.0':30},label:'调整体型后的转动检查'}));await ready(page);
 const adjusted=await page.evaluate(()=>({state:bodyImplicitR02.state(),surface:bodyImplicitR02.report().renderer.activeSurface,archive:bodyImplicitR02.archive()}));
 check('body parameters and pose still work',adjusted.surface==='dynamic-body-p1'&&adjusted.state.anny.phenotypes.weight===.43&&adjusted.state.anny.phenotypes.muscle===.69&&adjusted.state.anny.localChanges['measure-shoulder-dist-incr']===.24&&adjusted.state.anny.pose['lowerarm01.L'][0]===30&&JSON.stringify(adjusted.archive.person.headMorphology)===JSON.stringify(original.person.headMorphology),{surface:adjusted.surface});
 await dragAndCompare(page,'body-dynamic-embedded-p1','torsoStudyP1',110,'adjusted-body drag');
 await page.evaluate(a=>bodyImplicitR02.restore(a),original);await ready(page);
 check('whole person and archive restore',await page.evaluate(a=>JSON.stringify(bodyImplicitR02.state())===JSON.stringify(a.person.state)&&bodyImplicitR02.report().renderer.characterTriangleFaces===0,original));
 check('no page errors',errors.length===0,errors);
}catch(e){errors.push(e.stack);process.exitCode=1;}finally{await browser.close();const build=JSON.parse(fs.readFileSync('BUILD-R33.json','utf8')),actual=crypto.createHash('sha256').update(fs.readFileSync(build.file)).digest('hex');const report={startedUTC,finishedUTC:new Date().toISOString(),artifactSHA256:build.sha256,viewport,deviceScaleFactor,scope:'actual headless pointer drags, immediate and settled appearance, adjusted body and archive',checks,errors,passed:actual===build.sha256&&checks.length>0&&checks.every(x=>x.passed)&&errors.length===0,newDeliveredImageFiles:0};fs.mkdirSync('qa/edges-r33',{recursive:true});fs.writeFileSync('qa/edges-r33/'+(process.env.BODY_QA_LABEL||'interactive')+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}})();
