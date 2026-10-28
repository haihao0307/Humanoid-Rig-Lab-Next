'use strict';
// Measure whole-page pose changes in an isolated headless browser.
const {chromium}=require(process.env.BODY_PLAYWRIGHT_PATH||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.BODY_BASE||'http://127.0.0.1:8914',viewer=process.env.BODY_BENCH_PATH||'/人物身体_R36_连续体型与骨架.html';
const ready=p=>p.waitForFunction(()=>{const r=window.bodyImplicitR02?.report();return r?.ready&&!r.busy;},null,{timeout:300000});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.BODY_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-gpu','--enable-unsafe-swiftshader']}),checks=[],errors=[];
try{const page=await browser.newPage({viewport:{width:1200,height:800}});page.on('pageerror',e=>errors.push(e.message));await page.goto(base+viewer,{waitUntil:'domcontentloaded'});await ready(page);
await page.evaluate(()=>bodyControlR17.apply({set:{'shape.weight':.43},label:'测量身体动作更新'}));await ready(page);
const device=await page.evaluate(()=>{const f=document.querySelector('#body-dynamic-embedded-p1').contentWindow,c=f.document.querySelector('#body-view'),gl=c.getContext('webgl2'),d=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):null,canvas:[c.width,c.height]};});
for(const angle of [-5,-10,-15,-20,-25,-30]){const started=Date.now();await page.evaluate(v=>bodyControlR17.apply({set:{'pose.A.upperarm01.L.1':v},label:'身体动作速度测量'}),angle);await ready(page);const report=await page.evaluate(()=>{const app=document.querySelector('#body-dynamic-embedded-p1').contentWindow.torsoStudyP1;return{buildMS:app.report().buildMS,profile:app.report().profile,renderer:app.renderer.report()};});checks.push({angle,elapsedMS:Date.now()-started,buildMS:report.buildMS,profile:report.profile,shadowMS:report.renderer.dynamicShadow?.lastMS,shadowUpdates:report.renderer.dynamicShadow?.updates,error:report.renderer.webglError});}
console.log(JSON.stringify({passed:!errors.length&&checks.length===6&&checks.every(c=>c.error===0),device,checks,errors}));
}catch(e){errors.push(e.stack);console.log(JSON.stringify({passed:false,checks,errors}));process.exitCode=1;}finally{await browser.close();}})();
