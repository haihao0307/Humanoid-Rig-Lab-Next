const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
fs.mkdirSync('evidence',{recursive:true});
const report={sha:process.env.CANDIDATE_SHA,publicVerified:false,checks:[],errors:[],consoleErrors:[],device:'GitHub runner Chromium, SwiftShader; single-frame QA, not a performance benchmark',mobileScope:'390x844 viewport, not physical phone',visualAcceptance:false};
const save=()=>fs.writeFileSync('evidence/report.json',JSON.stringify(report,null,2));
(async()=>{
 const root=path.resolve(__dirname);
 const server=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]),file=path.resolve(root,'.'+(rel==='/'?'/index.html':rel));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(b)});}).listen(8765,'127.0.0.1');
 const bin=['/usr/bin/google-chrome','/usr/bin/chromium-browser','/usr/bin/chromium'].find(p=>fs.existsSync(p));
 const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1060,height:840},deviceScaleFactor:1});
 // Suppress the continuous app loop for deterministic screenshots. The app's
 // explicit initial render and each test render still execute real WebGL.
 await page.addInitScript(()=>{window.__nativeRAF=window.requestAnimationFrame;window.requestAnimationFrame=()=>0;});
 page.on('pageerror',e=>{report.errors.push(String(e));save()});
 page.on('console',m=>{if(m.type()==='error'){report.consoleErrors.push(m.text());save()}});
 const url=`https://raw.githack.com/haihao0307/Humanoid-Rig-Lab-Next/${process.env.CANDIDATE_SHA}/studies/skin-atelier-r1/index.html`;
 report.url=url;save();
 try{let r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});report.httpStatus=r?.status();save();await page.waitForFunction(()=>window.__atelier?.ready||window.__atelierErrors?.length,{polling:500,timeout:120000});report.publicVerified=!!r?.ok()&&await page.evaluate(()=>!!window.__atelier?.ready);}
 catch(e){report.publicFailure=String(e);save();await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:30000});await page.waitForFunction(()=>window.__atelier?.ready||window.__atelierErrors?.length,{polling:500,timeout:120000});}
 report.runtime=await page.evaluate(()=>({ready:window.__atelier?.ready,stats:window.__atelier?.stats,errors:window.__atelierErrors,status:document.querySelector('#status')?.textContent,gl:window.__atelier?.renderer.getContext().getParameter(window.__atelier.renderer.getContext().RENDERER)}));save();
 if(!report.runtime.ready)throw Error('Renderer did not become ready');
 async function capture(name,render=true){const data=await page.evaluate(render=>{const a=window.__atelier;if(render)a.renderer.render(a.scene,a.camera);a.renderer.getContext().finish();return a.renderer.domElement.toDataURL('image/png')},render);fs.writeFileSync(`evidence/${name}.png`,Buffer.from(data.split(',')[1],'base64'));report.checks.push({name,state:await page.evaluate(()=>window.__atelier.getState())});save();}
 await capture('01-portrait',false);
 for(const [i,name] of ['eyes','skin','profile','eye'].entries()){await page.evaluate(n=>document.querySelector(`[data-view="${n}"]`).click(),name);await capture(`0${i+2}-${name}`);}
 await page.evaluate(()=>{document.querySelector('[data-view="portrait"]').click();const e=document.querySelector('#hairToggle');e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}));});await capture('06-without-hair');
 await page.evaluate(()=>{const e=document.querySelector('#hairToggle');e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));const p=document.querySelector('#pore');p.value='1.3';p.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-light="rake"]').click();});
 report.poreAfterInput=await page.evaluate(()=>window.__atelier.globals.pore.value);await capture('07-raking-light');
 try{await page.screenshot({path:'evidence/08-desktop-ui.png',timeout:15000});}catch(e){report.uiScreenshotFailure=String(e);save();}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{window.dispatchEvent(new Event('resize'));document.querySelector('#home').click();document.querySelector('#mobileControls').click();});
 report.mobilePanel=await page.evaluate(()=>document.querySelector('#panel').classList.contains('open'));await capture('09-mobile-canvas');
 try{await page.screenshot({path:'evidence/10-mobile-ui.png',timeout:15000});}catch(e){report.mobileUiFailure=String(e)}
 report.shaderErrors=report.consoleErrors.filter(s=>/Shader Error|VALIDATE_STATUS|not compiled|ERROR: 0:|WebGLProgram|CONTEXT_LOST/.test(s));report.renderChecksPassed=!report.errors.length&&!report.runtime.errors.length&&!report.shaderErrors.length;save();console.log(JSON.stringify(report,null,2));await browser.close();server.close();if(!report.renderChecksPassed)process.exitCode=1;
})().catch(e=>{report.fatal=String(e.stack||e);save();fs.writeFileSync('evidence/fatal.txt',report.fatal);console.error(e);process.exit(1)});
