const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
fs.mkdirSync('evidence',{recursive:true});
const report={sha:process.env.CANDIDATE_SHA,publicVerified:false,checks:[],errors:[],consoleErrors:[],device:'Playwright 1.55 Chromium / SwiftShader single-frame QA, not a performance benchmark',mobileScope:'not tested in this first-frame pass',visualAcceptance:false};
const save=()=>fs.writeFileSync('evidence/report.json',JSON.stringify(report,null,2));
const stage=s=>{report.stage=s;save();console.log('STAGE',s)};
const watch=setTimeout(()=>{report.fatal='180-second watchdog at '+report.stage;save();console.error(report.fatal);process.exit(1)},180000);
(async()=>{
 const root=path.resolve(__dirname);
 const server=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]),file=path.resolve(root,'.'+(rel==='/'?'/index.html':rel));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(b)});}).listen(8765,'127.0.0.1');
 stage('launch');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1024,height:800},deviceScaleFactor:1});
 await page.addInitScript(()=>{window.__nativeRAF=window.requestAnimationFrame;window.requestAnimationFrame=()=>0;});
 page.on('pageerror',e=>{report.errors.push(String(e));save()});page.on('console',m=>{if(m.type()==='error'){report.consoleErrors.push(m.text());save()}});
 const url=`https://raw.githack.com/haihao0307/Humanoid-Rig-Lab-Next/${process.env.CANDIDATE_SHA}/studies/skin-atelier-r1/index.html`;report.url=url;
 stage('public navigation');
 try{let r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});report.httpStatus=r?.status();stage('public ready wait');await page.waitForFunction(()=>window.__atelier?.ready||window.__atelierErrors?.length,{polling:500,timeout:45000});report.publicVerified=!!r?.ok()&&await page.evaluate(()=>!!window.__atelier?.ready);}
 catch(e){report.publicFailure=String(e);stage('local navigation');await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:30000});await page.waitForFunction(()=>window.__atelier?.ready||window.__atelierErrors?.length,{polling:500,timeout:45000});}
 stage('read runtime');report.runtime=await page.evaluate(()=>({ready:window.__atelier?.ready,stats:window.__atelier?.stats,errors:window.__atelierErrors,status:document.querySelector('#status')?.textContent,gl:window.__atelier?.renderer.getContext().getParameter(window.__atelier.renderer.getContext().RENDERER)}));save();if(!report.runtime.ready)throw Error('Renderer not ready');
 async function capture(name,render=true){stage('capture '+name);const data=await page.evaluate(render=>{const a=window.__atelier;if(render)a.renderer.render(a.scene,a.camera);return a.renderer.domElement.toDataURL('image/png')},render);fs.writeFileSync(`evidence/${name}.png`,Buffer.from(data.split(',')[1],'base64'));report.checks.push({name,state:await page.evaluate(()=>window.__atelier.getState())});save();}
 await capture('01-portrait',false);
 await page.evaluate(()=>document.querySelector('[data-view="eyes"]').click());await capture('02-eyes');
 await page.evaluate(()=>document.querySelector('[data-view="eye"]').click());await capture('03-eye');
 await page.evaluate(()=>{document.querySelector('[data-view="portrait"]').click();const e=document.querySelector('#hairToggle');e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}));});await capture('04-without-hair');
 stage('UI screenshot');try{await page.screenshot({path:'evidence/05-ui.png',timeout:10000})}catch(e){report.uiScreenshotFailure=String(e)}
 report.shaderErrors=report.consoleErrors.filter(s=>/Shader Error|VALIDATE_STATUS|not compiled|ERROR: 0:|WebGLProgram|CONTEXT_LOST/.test(s));report.renderChecksPassed=!report.errors.length&&!report.runtime.errors.length&&!report.shaderErrors.length;stage('complete');console.log(JSON.stringify(report,null,2));clearTimeout(watch);await browser.close();server.close();if(!report.renderChecksPassed)process.exitCode=1;
})().catch(e=>{report.fatal=String(e.stack||e);save();console.error(e);process.exit(1)});
