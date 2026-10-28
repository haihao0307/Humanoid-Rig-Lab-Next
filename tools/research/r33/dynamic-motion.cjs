'use strict';
// Check the adjustable-body renderer during and after the same camera move.
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-gpu','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1100,height:760},deviceScaleFactor:1});page.setDefaultTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const start=Date.now();
try{
 await page.goto('http://127.0.0.1:8914/workbench',{waitUntil:'domcontentloaded'});
 const ready=()=>page.waitForFunction(()=>window.bodyImplicitR02?.report().ready&&!bodyImplicitR02.report().busy,null,{timeout:180000});await ready();
 await page.evaluate(()=>bodyControlR17.apply({set:{'shape.weight':.43,'shape.muscle':.69,'local.measure-shoulder-dist-incr':.24},label:'调整体型后旋转检查'}));await ready();
 const immediate=await page.evaluate(()=>{
  const f=document.querySelector('#body-dynamic-embedded-p1').contentWindow,c=f.document.querySelector('#body-view'),r=f.torsoStudyP1.renderer;
  bodyImplicitR02.setCamera({yaw:.96,pitch:.04,distance:1.6,target:[0,-.16,0]});const field=r.probeFrame('field');f.__MOTION_FIELDS__=field.pixels;const gl=c.getContext('webgl2');gl.finish();const p=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);f.__MOTION_IMAGE__=p;
  return{surface:bodyImplicitR02.report().renderer.activeSurface,size:[c.width,c.height],precision:r.precisionReport(),aa:r.report().edgeAntialiasing};
 });
 console.log(JSON.stringify({phase:'motion',elapsedMS:Date.now()-start,...immediate}));
 await page.waitForFunction(()=>{const f=document.querySelector('#body-dynamic-embedded-p1')?.contentWindow,p=f?.torsoStudyP1?.renderer.precisionReport();if(p?.lastError)throw Error(p.lastError);return p?.ready;},null,{timeout:300000});
 const idle=await page.evaluate(()=>{
  const f=document.querySelector('#body-dynamic-embedded-p1').contentWindow,c=f.document.querySelector('#body-view'),r=f.torsoStudyP1.renderer,gl=c.getContext('webgl2');gl.finish();const p=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);let changed=0;for(let i=0;i<p.length;i+=4)if(Math.max(Math.abs(p[i]-f.__MOTION_IMAGE__[i]),Math.abs(p[i+1]-f.__MOTION_IMAGE__[i+1]),Math.abs(p[i+2]-f.__MOTION_IMAGE__[i+2]))>8)changed++;
  const fields=r.probeFrame('field').pixels,before=f.__MOTION_FIELDS__;let miss=0,extra=0,different=0;for(let i=0;i<fields.length;i+=4){let a=before[i]||before[i+1]||before[i+2],b=fields[i]||fields[i+1]||fields[i+2];if(a&&!b)extra++;if(!a&&b)miss++;if(a&&b&&(before[i]!==fields[i]||before[i+1]!==fields[i+1]||before[i+2]!==fields[i+2]))different++;}
  return{precision:r.precisionReport(),changed,rayMiss:miss,rayExtra:extra,fieldDifferent:different,webglError:r.report().webglError};
 });
 console.log(JSON.stringify({phase:'idle',elapsedMS:Date.now()-start,...idle,errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
