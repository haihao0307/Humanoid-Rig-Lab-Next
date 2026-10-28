'use strict';
const fs=require('fs'),{chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const r32=require('../r32/render-integration.cjs'),r33=require('./motion-skin.cjs');
const modes=process.argv.slice(2);if(!modes.length)modes.push('baseline','selective');
async function run(browser,mode){
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.setDefaultTimeout(180000);
 if(mode==='selective')await page.route(url=>decodeURIComponent(url.pathname)==='/身体_R32_平滑轮廓.html',async route=>{const response=await route.fetch();let html=await response.text(),s=r32.skin(fs.readFileSync('src/BodyOriginalSkinR26.js','utf8')),r=r32.source(fs.readFileSync('src/BodyAtlasRayR26.js','utf8'));html=r32.replace(html,s,r33.skin(s));html=r32.replace(html,r,r33.source(r));await route.fulfill({response,body:html});});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8914/人物身体_R32_平滑轮廓.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.bodyImplicitR02?.report().ready&&!bodyImplicitR02.report().busy,null,{timeout:180000});
 const canvas=page.frameLocator('#body-source-embedded-r25').locator('#body-view'),box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();
 const times=[];for(let i=0;i<14;i++){const t=Date.now();await page.mouse.move(box.x+box.width*.5+i*7,box.y+box.height*.5+Math.sin(i*.25)*9);await canvas.evaluate(c=>c.getContext('webgl2').finish());times.push(Date.now()-t);}
 await page.mouse.up();const report=await page.evaluate(()=>{const r=bodyImplicitR02.report().renderer;return{camera:r.camera,size:r.canvasSize,error:r.webglError,frames:r.edgeAntialiasing.frames};});await page.close();
 const measured=times.slice(4).sort((a,b)=>a-b);return{mode,rawMS:times,medianMS:measured[Math.floor(measured.length/2)],p95MS:measured[Math.ceil(measured.length*.95)-1],report,errors};
}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-gpu','--enable-unsafe-swiftshader']});try{for(const mode of modes)console.log(JSON.stringify(await run(browser,mode)));}finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
