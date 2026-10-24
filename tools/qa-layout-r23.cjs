'use strict';
const fs=require('fs'),crypto=require('crypto'),{chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const build=JSON.parse(fs.readFileSync('BUILD-SOURCE-R23.json')),q={artifactSHA256:build.sha256,startedUTC:new Date().toISOString(),errors:[],sourceFidelityAccepted:false};let browser;
(async()=>{try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>q.errors.push(e.message));
 await page.goto('http://127.0.0.1:8914/?v=R23-'+build.sha256.slice(0,8),{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.bodySourceAtlasR23?.report().precision.ready,{timeout:180000});
 q.layout=await page.evaluate(()=>{const c=document.querySelector('#body-view'),r=c.getBoundingClientRect();return{viewport:[innerWidth,innerHeight],documentWidth:document.documentElement.scrollWidth,canvas:[r.x,r.y,r.width,r.height],title:document.title,inputs:[...document.querySelectorAll('input[type=range]')].map(x=>({id:x.id,visible:x.getBoundingClientRect().width>0})),report:bodySourceAtlasR23.report()};});
 fs.mkdirSync('qa/fidelity-r23/offline',{recursive:true});await page.screenshot({path:'qa/fidelity-r23/offline/layout-check.png',fullPage:true});
 q.artifactStable=crypto.createHash('sha256').update(fs.readFileSync(build.file)).digest('hex')===build.sha256;
 q.passed=q.errors.length===0&&q.artifactStable&&q.layout.documentWidth<=1440&&q.layout.canvas[2]>500&&q.layout.canvas[3]>500&&q.layout.inputs.length>=4&&q.layout.inputs.every(x=>x.visible);
 if(!q.passed)throw Error('Layout check failed');
}catch(e){q.failure=e.stack;q.passed=false;process.exitCode=1;console.error(e);}finally{await browser?.close();q.finishedUTC=new Date().toISOString();fs.writeFileSync('qa/fidelity-r23/layout-browser.json',JSON.stringify(q,null,2));console.log(JSON.stringify({passed:q.passed,layout:q.layout?.canvas,failure:q.failure}));}})();
