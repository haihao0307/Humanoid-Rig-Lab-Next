// Real workbench captures: fixed camera/lighting, no desktop input or image synthesis.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require(process.env.HUMAN_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'');
if(!process.argv[2]||out===root||out.startsWith(root+path.sep))throw Error('Choose a QA directory outside the repository');
fs.mkdirSync(out,{recursive:true});
const files=['index.html','body/SkinSurface.js','body/TissueShaders.js','body/SkinAppearance.js','body/CompactWorkbench.js','source/runtime.template.js','body/SkinTransport.js'];
const hashes=Object.fromEntries(files.filter(p=>fs.existsSync(path.join(root,p))).map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')]));
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(p,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.html')?'text/html':/\.m?js$/.test(p)?'text/javascript':'application/octet-stream');res.end(b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.HUMAN_CHROME,headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:1500,height:1080},deviceScaleFactor:1}),errors=[],samples=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?review=face&faceView=front&qa=1`);
let frame;for(let i=0;i<180;i++){frame=page.frames().find(f=>f.name()==='bodyFrame');if(frame){const s=await frame.evaluate(()=>window.__humanStartup).catch(()=>null);if(s?.status==='failed')throw Error(s.error||s.message);if(s?.status==='ready')break;}await page.waitForTimeout(1000);}
if(!frame||await frame.evaluate(()=>window.__humanStartup?.status)!=='ready')throw Error('Startup did not become ready');
console.log('READY');const baseline=await frame.evaluate(()=>{const l=window.HumanLab;l.setAuto(false);l.settings.close();l.face.clearExpression();return l.skin.export();});
const configurations=[
 {name:'portrait-front',yaw:0},{name:'portrait-angle',yaw:.4},{name:'portrait-raking',yaw:.4,lighting:'raking'},
 {name:'cheek',macro:true},{name:'cheek-flat',macro:true,patch:{pores:0}},
 {name:'cheek-raking',macro:true,lighting:'raking'},
 {name:'cheek-raking-flat',macro:true,lighting:'raking',patch:{pores:0}},
 {name:'scatter-off',yaw:.4,lighting:'raking',transport:false},
 {name:'deep-skin',yaw:.4,patch:{baseColor:'#875b43'}},
 {name:'dry-skin',yaw:.4,patch:{oil:0}},{name:'oily-skin',yaw:.4,patch:{oil:.65}},
 {name:'face-shadow',yaw:.4,lighting:'raking',shadow:true},
 {name:'medium',distance:.95,yaw:.3},
 {name:'face-profile',yaw:1.2},
 {name:'smile',yaw:.4,expression:{mouthSmileLeft:.65,mouthSmileRight:.65}},
 {name:'blink',yaw:.4,expression:{eyeBlinkLeft:1,eyeBlinkRight:1}},
 {name:'portrait-supersampled',yaw:.4,sampling:2}
];
for(const c of configurations){const state=await frame.evaluate(({c,baseline})=>{const l=window.HumanLab,r=l.renderer,s=l.human.bodyMetrics.statureScale;
 l.skin.apply(baseline);if(c.patch)l.skin.set(c.patch);l.face.clearExpression();if(c.expression)for(const [id,value] of Object.entries(c.expression))l.face.setWeight(id,value);l.face.closeup(c.macro?'lips':'front');
 l.review.setSampling(c.sampling||1);
 r.yaw=l.agent.yaw+(c.yaw??.3);r.distance=(c.distance??.34)*s;
 if(c.macro){r.target[0]+=.035*s;r.target[1]+=.030*s;r.target[2]-=.015*s;r.projection='orthographic';r.orthoHeight=.060*s;r.distance=.30*s;r.yaw=l.agent.yaw+.32;}
 r.studioLighting=c.lighting||'studio';r.skinTransportDisabled=c.transport===false;r.setQuality(c.shadow?'shadow':'fast');l.render();
 return {camera:{target:r.target,distance:r.distance,yaw:r.yaw,projection:r.projection,orthoHeight:r.orthoHeight},skin:l.skin.export(),sampling:c.sampling||1,expression:c.expression||{},transport:r.skinTransport?.report(),glError:r.gl.getError()};
},{c,baseline});await page.waitForTimeout(400);await frame.locator('#view').screenshot({path:path.join(out,c.name+'.png')});samples.push({name:c.name,...state});console.log(c.name);}
await frame.evaluate(baseline=>{const l=window.HumanLab;l.skin.apply(baseline);l.face.clearExpression();l.review.setSampling(1);l.renderer.skinTransportDisabled=false;l.face.closeup('front');l.render();},baseline);
fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify({time:new Date().toISOString(),hashes,errors,samples,state:await frame.evaluate(()=>({startup:window.__humanStartup,skin:window.HumanLab.skin.report(),transport:window.HumanLab.renderer.skinTransport?.report()}))},null,2));
if(errors.length||samples.some(s=>s.glError))throw Error('Runtime errors: '+JSON.stringify({errors,gl:samples.filter(s=>s.glError)}));console.log('CAPTURED '+out);
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
