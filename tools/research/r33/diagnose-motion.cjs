'use strict';
// A single off-screen camera motion and idle comparison; no user pointer input.
const fs=require('fs');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-gpu','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.setDefaultTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.BODY_MOTION_PARITY==='1'||process.env.BODY_MOTION_SELECTIVE)await page.route(url=>decodeURIComponent(url.pathname)==='/身体_R32_平滑轮廓.html',async route=>{const response=await route.fetch();let html=await response.text();if(process.env.BODY_MOTION_SELECTIVE){const r32=require('../r32/render-integration.cjs'),r33=require('./motion-skin.cjs'),originalSkin=r32.skin(fs.readFileSync('src/BodyOriginalSkinR26.js','utf8')),originalSource=r32.source(fs.readFileSync('src/BodyAtlasRayR26.js','utf8'));html=r32.replace(html,originalSkin,r33.skin(originalSkin,process.env.BODY_MOTION_SELECTIVE));html=r32.replace(html,originalSource,r33.source(originalSource));}else{const needle='own.render({textures:surfaceTextures,flip:0},camera,false)';if(html.split(needle).length!==2)throw Error('preview skin mode anchor missing');html=html.replace(needle,'own.render({textures:surfaceTextures,flip:0},camera,true)');}await route.fulfill({response,body:html});});
 const started=Date.now();
 try{
  const path=(process.env.BODY_MOTION_PARITY||process.env.BODY_MOTION_SELECTIVE||process.env.BODY_BASELINE_R32)?'/人物身体_R32_平滑轮廓.html':'/workbench';
  await page.goto('http://127.0.0.1:8914'+path,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.bodyImplicitR02?.report().ready&&!bodyImplicitR02.report().busy,null,{timeout:180000});
  const immediate=await page.evaluate(({yaw,distance,wantImage})=>{
   const f=document.querySelector('#body-source-embedded-r25').contentWindow,c=f.document.querySelector('#body-view');
   const t=performance.now();bodyImplicitR02.setCamera({yaw,pitch:.04,distance,target:[0,-.16,0]});
   const depth=f.bodySourceAtlasR21.renderer.probeFrame('depth');f.__MOTION_DEPTH__=depth.pixels;
   const gl=c.getContext('webgl2');gl.finish();const p=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);f.__MOTION_REFERENCE__=p;
   return {width:c.width,height:c.height,drawAndProbeMS:performance.now()-t,camera:bodyImplicitR02.camera(),aa:f.bodySourceAtlasR21.report().originalActiveSkin?.edgeAntialiasing,precision:f.bodySourceAtlasR21.report().precision,shot:wantImage?c.toDataURL('image/png'):null};
  },{yaw:Number(process.env.BODY_YAW||.96),distance:Number(process.env.BODY_DISTANCE||1.60),wantImage:!!process.argv[2]});
  if(process.argv[2])fs.writeFileSync(process.argv[2]+'-motion.png',Buffer.from(immediate.shot.split(',')[1],'base64'));delete immediate.shot;
  console.log(JSON.stringify({phase:'immediate',elapsedMS:Date.now()-started,...immediate}));
  await page.waitForFunction(()=>{const f=document.querySelector('#body-source-embedded-r25')?.contentWindow;const p=f?.bodySourceAtlasR21?.report().precision;if(p?.lastError)throw Error(p.lastError);return p?.ready;},null,{timeout:240000});
  const idle=await page.evaluate(wantImage=>{
   const f=document.querySelector('#body-source-embedded-r25').contentWindow,c=f.document.querySelector('#body-view'),gl=c.getContext('webgl2');gl.finish();const p=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);
   const old=f.__MOTION_REFERENCE__,w=c.width,h=c.height;let changed=0,coverage=0,isolatedMotion=0,isolatedIdle=0,rayMiss=0,rayExtra=0;
   const exact=f.bodySourceAtlasR21.renderer.precisionPixels().mask,fast=f.__MOTION_DEPTH__;
   for(let i=0;i<fast.length;i+=4){const a=fast[i]!==0||fast[i+1]!==0||fast[i+2]!==0,b=exact[i]>127;if(a&&!b)rayExtra++;if(!a&&b)rayMiss++;}
   const mask=(a,i)=>a[i]>a[i+1]+8&&a[i]>a[i+2]+8;
   for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=4*(x+y*w);let d=0;for(let k=0;k<3;k++)d=Math.max(d,Math.abs(old[i+k]-p[i+k]));if(d>8)changed++;if(mask(old,i)!==mask(p,i))coverage++;for(const [a,flag] of [[old,0],[p,1]]){if(!mask(a,i))continue;let n=0;for(const q of [-4,4,-4*w,4*w])if(mask(a,i+q))n++;if(n<=1){if(flag)isolatedIdle++;else isolatedMotion++;}}}
   return{precision:f.bodySourceAtlasR21.report().precision,changed,coverage,isolatedMotion,isolatedIdle,rayMiss,rayExtra,shot:wantImage?c.toDataURL('image/png'):null};
  },!!process.argv[2]);
  if(process.argv[2])fs.writeFileSync(process.argv[2]+'-idle.png',Buffer.from(idle.shot.split(',')[1],'base64'));delete idle.shot;
  console.log(JSON.stringify({phase:'idle',elapsedMS:Date.now()-started,...idle,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
