// Actual headless workbench QA. Does not control the desktop mouse.
// Requires Playwright and Chromium; optional HUMAN_PLAYWRIGHT_MODULE / HUMAN_CHROME.
const crypto=require('crypto');const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require(process.env.HUMAN_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
if(!process.argv[2])throw Error('Usage: node tools/capture-face-review.cjs <absolute QA directory outside repository>');
const out=path.resolve(process.argv[2]);if(out===root||out.startsWith(root+path.sep))throw Error('Keep screenshots outside the source repository');fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.gz':'application/octet-stream','.css':'text/css'};
const server=http.createServer((req,res)=>{let p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(path.resolve(root)+path.sep)){res.writeHead(403);return res.end();}fs.readFile(p,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');res.end(b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.HUMAN_CHROME||undefined,headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(root+'/'+p)).digest('hex'),entrySHA256=hash('index.html'),sourceSHA256=Object.fromEntries(['body/SkinAppearance.js','body/SkinSurface.js','body/FaceAnatomy.js','body/PerioralSurface.js','body/EyeAnatomy.js','body/CompactWorkbench.js','body/TissueShaders.js','reconstruction/mesher.mjs','reconstruction/surface-kernel.mjs','source/runtime.template.js'].map(p=>[p,hash(p)]));const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR '+e.message)});await page.goto(`http://127.0.0.1:${server.address().port}/index.html?review=face&faceView=lips&qa=1`);let frame;
for(let i=0;i<120;i++){frame=page.frames().find(f=>f.name()==='bodyFrame');if(frame){const state=await frame.evaluate(()=>({ready:window.__humanStartup?.status,stage:window.__humanStartup?.stage,error:window.__humanStartup?.error,message:window.__humanStartup?.message,compact:!!window.HumanLab?.compact})).catch(()=>null);if(i%5===0)console.log(JSON.stringify(state));if(state?.ready==='failed')throw Error(state.error||state.message);if(state?.ready==='ready'&&state.compact)break;}await new Promise(r=>setTimeout(r,1500));}
if(!frame)throw Error('No body frame');console.log(await frame.evaluate(()=>({startup:window.__humanStartup,review:window.HumanLab?.review})));
await frame.evaluate(()=>{const l=window.HumanLab;if(!l?.compact)throw Error('Surface not ready');l.setAuto(false);l.settings.close();l.face.closeup('lips');l.render();});await page.waitForTimeout(1500);
await page.screenshot({path:out+'/workbench.png'});
await frame.locator('#view').screenshot({path:out+'/lips-front.png'});
await frame.evaluate(()=>{const l=window.HumanLab;l.face.closeup('lips');l.renderer.yaw+=.48;l.render();});await page.waitForTimeout(600);await frame.locator('#view').screenshot({path:out+'/lips-angle.png'});
await frame.evaluate(()=>{const l=window.HumanLab;l.face.closeup('front');l.render();});await page.waitForTimeout(600);await frame.locator('#view').screenshot({path:out+'/face-front.png'});
for(const [name,weights] of [['smile', {mouthSmileLeft:.6,mouthSmileRight:.6}],['jaw-open',{jawOpen:.45,lipPart:.3}]]){
await frame.evaluate(weights=>{const l=window.HumanLab;l.face.clearExpression();for(const [id,value] of Object.entries(weights))l.face.setWeight(id,value);l.face.closeup('lips');l.render();},weights);await page.waitForTimeout(600);await frame.locator('#view').screenshot({path:out+'/'+name+'.png'});
}
for(const [name,yaw,clay] of [['lips-clay',0,true],['lips-clay-angle',.70,true],['lips-soft',0,false]]){
await frame.evaluate(({yaw,clay})=>{const l=window.HumanLab;l.face.clearExpression();l.face.closeup('lips');l.renderer.yaw+=yaw;l.tissue.setView(clay?'clay':'skin');l.renderer.setQuality('fast');l.render();},{yaw,clay});await page.waitForTimeout(450);await frame.locator('#view').screenshot({path:out+'/'+name+'.png'});
}
for(const [name,yaw,pitch,clay,eyes,blink] of [['face-studio',.0,0,false,false,false],['face-threequarter',.65,0,false,false,false],['face-profile',1.48,0,true,false,false],['face-clay',.5,0,true,false,false],['eyes-front',0,0,false,true,false],['eyes-angle',.48,0,false,true,false],['eyes-half-blink',0,0,false,true,.5],['eyes-blink',0,0,false,true,true]]){
await frame.evaluate(({yaw,pitch,clay,eyes,blink})=>{const l=window.HumanLab;l.face.clearExpression();if(blink){l.face.setWeight('eyeBlinkLeft',blink===true?1:blink);l.face.setWeight('eyeBlinkRight',blink===true?1:blink);}l.face.closeup('front');if(eyes){l.renderer.target[1]+=.032*l.human.bodyMetrics.statureScale;l.renderer.distance=.19*l.human.bodyMetrics.statureScale;}l.renderer.yaw=l.agent.yaw+yaw;l.renderer.pitch=pitch;l.tissue.setView(clay?'clay':'skin');l.review.presentation='studio';l.renderer.setQuality('fast');l.render();},{yaw,pitch,clay,eyes,blink});await page.waitForTimeout(350);await frame.locator('#view').screenshot({path:out+'/'+name+'.png'});
}
await frame.evaluate(()=>{const l=window.HumanLab;l.face.clearExpression();l.face.closeup('front');l.renderer.target[1]+=.032*l.human.bodyMetrics.statureScale;l.renderer.distance=.19*l.human.bodyMetrics.statureScale;l.review.setSampling(2);l.render();});await page.waitForTimeout(450);
const supersampledBuffer=await frame.evaluate(()=>{const gl=window.HumanLab.renderer.gl;return {drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],samples:gl.getParameter(gl.SAMPLES)};});
await frame.locator('#view').screenshot({path:out+'/eyes-supersampled.png'});
await frame.evaluate(()=>window.HumanLab.review.setSampling(1));
const skinBaseline=await frame.evaluate(()=>window.HumanLab.skin.export());
if(!process.argv.includes('--geometry-only')){
for(const [name,patch,distance] of [['skin-cheek',{},.14],['skin-cheek-no-relief',{pores:0},.14],['skin-cheek-high-relief',{pores:.75},.14],['skin-cheek-deeper',{baseColor:'#875b43',pores:skinBaseline.pores},.14]]){
 await frame.evaluate(({patch,distance,skinBaseline})=>{const l=window.HumanLab;l.face.clearExpression();l.skin.apply(skinBaseline);l.skin.set(patch);l.face.closeup('lips');const scale=l.human.bodyMetrics.statureScale;l.renderer.target[0]+=.030*scale;l.renderer.target[1]+=.036*scale;l.renderer.distance=distance*scale;l.renderer.yaw=l.agent.yaw+.32;l.renderer.setQuality('fast');l.render();},{patch,distance,skinBaseline});
 await page.waitForTimeout(450);await frame.locator('#view').screenshot({path:out+'/'+name+'.png'});
}
await frame.evaluate(skinBaseline=>{const l=window.HumanLab;l.skin.apply(skinBaseline);l.review.setLighting('raking');l.render();},skinBaseline);
await page.waitForTimeout(450);await frame.locator('#view').screenshot({path:out+'/skin-cheek-raking.png'});
await frame.evaluate(()=>{window.HumanLab.review.setLighting('studio');});
await frame.evaluate(skinBaseline=>{const l=window.HumanLab;l.skin.apply(skinBaseline);l.face.clearExpression();l.face.closeup('front');l.renderer.distance=.95*l.human.bodyMetrics.statureScale;l.render();},skinBaseline);
await page.waitForTimeout(450);await frame.locator('#view').screenshot({path:out+'/face-medium-distance.png'});
}
fs.writeFileSync(out+'/capture.json',JSON.stringify({time:new Date().toISOString(),entrySHA256,sourceSHA256,supersampledBuffer,baselineCommit:'3c3e9a4b7b250f4c8db20c15e2e5fab4ca9ce568',workingCandidate:'authored-procedural-face-skin',errors,state:await frame.evaluate(()=>({startup:window.__humanStartup,renderSampling:{antialias:window.HumanLab.renderer.gl.getContextAttributes().antialias,samples:window.HumanLab.renderer.gl.getParameter(window.HumanLab.renderer.gl.SAMPLES),drawingBuffer:[window.HumanLab.renderer.gl.drawingBufferWidth,window.HumanLab.renderer.gl.drawingBufferHeight]},skin:window.HumanLab.skin.report(),face:window.HumanLab.face.export(),eyes:window.HumanLab.compact.report.eyeAnatomy,triangles:window.HumanLab.compact.report.triangles}))},null,2));console.log('CAPTURED '+out);
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
