// Read-only visual diagnosis of the actual workbench. Shader overrides live
// only in this disposable browser; production shaders and recipes are unchanged.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require(process.env.HUMAN_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'');
if(!process.argv[2]||out===root||out.startsWith(root+path.sep))throw Error('Choose a QA directory outside the repository');
fs.mkdirSync(out,{recursive:true});
// Reuse a prior case's actual camera for shape A/B. Automatic face framing
// otherwise changes the target when the generated facial bounds move.
const cameraReference=process.env.HUMAN_FACE_CAMERA_REFERENCE?JSON.parse(fs.readFileSync(process.env.HUMAN_FACE_CAMERA_REFERENCE,'utf8')):null;
const referenceCameras=new Map((cameraReference?.samples||[]).map(s=>[s.name,s.camera]));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const hashes=Object.fromEntries(['index.html','body/FaceAnatomy.js','body/BrowAnatomy.js','body/BeardAnatomy.js','body/PerioralSurface.js','body/EyeAnatomy.js','body/SkinSurface.js','body/TissueShaders.js','body/SkinTransport.js','body/CompactWorkbench.js','body/FaceIdentity.js','body/HeadSculpt.js','body/FaceControls.js','body/CompactHairRenderer.js','control/NPCPopulation.js','body/FaceAppearance.js','body/CharacterPresets.js','body/NPCDefinitions.js','reconstruction/surface-kernel.mjs','reconstruction/mesher.mjs','source/runtime.template.js'].map(p=>[p,hash(p)]));
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(p,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.html')?'text/html':/\.m?js$/.test(p)?'text/javascript':'application/octet-stream');res.end(b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.HUMAN_CHROME,headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:1500,height:1080},deviceScaleFactor:1}),errors=[],samples=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/index.html?review=face&qa=1`);
let frame;for(let i=0;i<180;i++){frame=page.frames().find(f=>f.name()==='bodyFrame');if(frame){const s=await frame.evaluate(()=>window.__humanStartup).catch(()=>null);if(s?.status==='failed')throw Error(s.error||s.message);if(s?.status==='ready')break;}await page.waitForTimeout(1000);}
if(!frame||await frame.evaluate(()=>window.__humanStartup?.status)!=='ready')throw Error('Startup not ready');console.log('READY');
const baseline=await frame.evaluate(()=>{const l=window.HumanLab;l.setAuto(false);l.settings.close();return l.skin.export();});
const identityBaseline=await frame.evaluate(()=>window.HumanLab.appearance.export());
const originalCharacterSeed=await frame.evaluate(()=>window.HumanLab.character.export().seed);
const cases=[
 {name:'current',yaw:.4}, {name:'front',yaw:0}, {name:'clay',yaw:.4,view:'clay'},
 {name:'clay-profile',yaw:1.48,view:'clay'},
 {name:'diffuse-only',yaw:.4,debug:'diffuse'}, {name:'albedo-only',yaw:.4,debug:'albedo'},
 {name:'eyes-half',camera:'eyes',yaw:.4,blink:.5}, {name:'eyes-closed-clay',camera:'eyes',yaw:.4,blink:1,view:'clay'}, {name:'eyes',camera:'eyes',yaw:0}, {name:'eyes-closed',camera:'eyes',yaw:.4,blink:1},
 {name:'eyes-profile',camera:'eyes',yaw:1.1,worldLight:true}, {name:'eyes-profile-closed',camera:'eyes',yaw:1.1,worldLight:true,blink:1},
 {name:'nose-front',camera:'nose',yaw:0,worldLight:true,distance:.20}, {name:'nose-angle',camera:'nose',yaw:.5,worldLight:true,distance:.20},
 {name:'eyes-contact-off',camera:'eyes',yaw:.4,blink:1,view:'clay',eyeDiagnostic:'contact-off'},
 {name:'eyes-contact-soft',camera:'eyes',yaw:.4,blink:1,view:'clay',eyeDiagnostic:'contact-soft'},
 {name:'eyes-no-section',camera:'eyes',yaw:.4,blink:1,view:'clay',eyeDiagnostic:'no-section'},
 {name:'eyes-cornea-mask',camera:'eyes',yaw:0,debug:'cornea-mask'},
 {name:'eyes-cornea-nocull',camera:'eyes',yaw:0,debug:'cornea-nocull'},
 {name:'eyes-cornea-normal',camera:'eyes',yaw:0,debug:'cornea-normal'},
 {name:'mouth',camera:'lips',yaw:.35}, {name:'mouth-open',camera:'lips',yaw:.35,jaw:.45}, {name:'mouth-max',camera:'lips',yaw:.35,jaw:1,distance:.26},
 {name:'nose-under',camera:'lips',yaw:.25,pitch:-.32,distance:.24},
 {name:'nose-lit-below',camera:'lips',yaw:.25,pitch:-.32,distance:.24,worldLight:true,key:[-.3,-.8,.5]},
 {name:'raking-shadow',yaw:.4,lighting:'raking',shadow:true},
 {name:'world-front',yaw:0,worldLight:true}, {name:'world-angle',yaw:.4,worldLight:true},
 {name:'world-profile',yaw:1.48,worldLight:true}, {name:'world-key-right',yaw:.4,worldLight:true,key:[.8,.5,.6]},
 {name:'portrait-front',yaw:0,worldLight:true,hair:true,groom:'swept'}, {name:'portrait-angle',yaw:.4,worldLight:true,hair:true,groom:'swept'},
 {name:'npc-4101',yaw:.4,worldLight:true,seed:4101}, {name:'npc-8202',yaw:.4,worldLight:true,seed:8202},
 {name:'npc-16404',yaw:.4,worldLight:true,seed:16404}, {name:'npc-32808',yaw:.4,worldLight:true,seed:32808},
 {name:'npc-4101-clay',yaw:.4,worldLight:true,seed:4101,view:'clay'}, {name:'npc-8202-clay',yaw:.4,worldLight:true,seed:8202,view:'clay'}
 ,{name:'skin-no-oil',yaw:.4,worldLight:true,skin:{oil:0}}, {name:'skin-no-variation',yaw:.4,worldLight:true,skin:{variation:0}},
 {name:'skin-no-scatter',yaw:.4,worldLight:true,skin:{scatter:0}}, {name:'skin-deep',yaw:.4,worldLight:true,skin:{baseColor:'#624230'}},
 {name:'npc-wide-hair',yaw:.4,worldLight:true,seed:4101,hair:true,shape:{headWidth:.85,headHeight:-.55,headDepth:.3,eyeSpacing:.65}}, {name:'npc-long-hair',yaw:.4,worldLight:true,seed:8202,hair:true,shape:{headWidth:-.65,headHeight:.75,headDepth:-.2,eyeSpacing:-.6}},
 {name:'smile',yaw:.4,worldLight:true,smile:.55,jaw:.18}, {name:'skin-close',yaw:.4,worldLight:true,distance:.20}, {name:'skin-mid',yaw:.4,worldLight:true,distance:.55}
].filter(c=>!process.argv[3]||process.argv[3].split(',').includes(c.name));
if(!cases.length)throw Error('No matching diagnostic cases');
for(const c of cases){const fixedCamera=referenceCameras.get(c.name)||null;const state=await frame.evaluate(async({c,baseline,identityBaseline,fixedCamera})=>{const l=window.HumanLab,r=l.renderer,g=r.gl,s=l.human.bodyMetrics.statureScale;
 if(!window.__diagnosticSources){const sources={};for(const sh of g.getAttachedShaders(l.compact.main.p)){sources[g.getShaderParameter(sh,g.SHADER_TYPE)===g.VERTEX_SHADER?'vertex':'fragment']=g.getShaderSource(sh);}window.__diagnosticSources=sources;}
 let f=window.__diagnosticSources.fragment,v=window.__diagnosticSources.vertex;
 if(c.eyeDiagnostic){
  if(c.eyeDiagnostic==='contact-off')v=v.replace('depth+(supported-depth)*','depth+0.*(supported-depth)*');
  if(c.eyeDiagnostic==='contact-soft'){
   const start=v.indexOf('vec3 compactLidPatchLocal('),end=v.indexOf('vec3 compactLidLocalPoint(',start);
   if(start<0||end<start)throw Error('Eye patch bounds missing');
   v=v.slice(0,start)+v.slice(start,end).replaceAll('.00008','.0016')+v.slice(end);
  }
  if(c.eyeDiagnostic==='no-section')v=v.replace('sectionFraction=uintBitsToFloat(axillaCorrective.x)','sectionFraction=0.');
  if(v===window.__diagnosticSources.vertex)throw Error('Eye diagnostic anchor missing');
 }
 if(c.debug==='diffuse'){const marker='return distribution*geometryV*geometryL*fresnel*nl/max(4.*nv*nl,.0001);';if(!f.includes(marker))throw Error('GGX diagnostic anchor missing');f=f.replace(marker,'return 0.;');}
 if(c.debug==='albedo'){const marker='frag=vec4(skinOutputSRGB(c),alpha);';if(!f.includes(marker))throw Error('Output diagnostic anchor missing');f=f.replace(marker,'frag=vec4(skinOutputSRGB(color),alpha);');}
 if(c.debug==='cornea-mask'){const marker='c*=compactCavityVisibility;';if(!f.includes(marker))throw Error('Cornea diagnostic anchor missing');f=f.replace(marker,'if(compactFeature>.5&&compactFeature<1.5){c=vec3(0.,1.,1.);alpha=1.;}'+marker);}
 if(c.debug==='cornea-nocull'||c.debug==='cornea-normal'){
  f=f.replace('if(!gl_FrontFacing)discard;','');
  f=f.replace('c*=compactCavityVisibility;','if(compactFeature>.5&&compactFeature<1.5){c='+(c.debug==='cornea-normal'?'normalize(N)*.5+.5':'vec3(1.,0.,1.)')+';alpha=1.;}c*=compactCavityVisibility;');
 }
 const p=g.createProgram();for(const [type,source] of [[g.VERTEX_SHADER,v],[g.FRAGMENT_SHADER,f]]){const sh=g.createShader(type);g.shaderSource(sh,source);g.compileShader(sh);if(!g.getShaderParameter(sh,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(sh));g.attachShader(p,sh);g.deleteShader(sh);}g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));
 const old=l.compact.main;l.compact.main={p,u:Object.fromEntries(Object.keys(old.u).map(k=>[k,g.getUniformLocation(p,k)]))};g.deleteProgram(old.p);
 if(c.seed!==undefined)await l.appearance.apply(l.appearance.sample(c.seed));
 else{l.skin.apply(baseline);l.face.apply({identity:identityBaseline.identity});}
 if(c.shape){const look=l.appearance.export();look.identity.shape={...look.identity.shape,...c.shape};await l.appearance.apply(look);}
 if(c.hair&&(!l.compact.hair||c.groom)){await l.hair.apply({...l.hair.export(),preset:c.groom||'crop',quality:c.groom?'closeup':'economy'});}
 l.hair.enabled=!!c.hair;
 if(c.skin)l.skin.apply({...l.skin.export(),...c.skin});
 l.face.clearExpression();l.face.closeup(c.camera==='lips'?'lips':'front');l.tissue.setView(c.view||'skin');
 r.setInspectionLighting(c.worldLight?{key:c.key||[-.65,.65,1],fill:[.8,.1,.6]}:null);
 if(c.camera==='eyes'){r.target[1]+=.032*s;r.distance=.19*s;}else if(c.camera==='nose'){r.target[1]+=.012*s;r.distance=.20*s;}else if(!c.camera)r.distance=.34*s;
 if(c.distance)r.distance=c.distance*s;r.yaw=l.agent.yaw+c.yaw;r.pitch=c.pitch||0;
 if(fixedCamera){r.target=[...fixedCamera.target];r.distance=fixedCamera.distance;r.yaw=fixedCamera.yaw;r.pitch=fixedCamera.pitch;}
 if(c.smile){l.face.setWeight('mouthSmileLeft',c.smile);l.face.setWeight('mouthSmileRight',c.smile);}
 if(c.blink){l.face.setWeight('eyeBlinkLeft',c.blink);l.face.setWeight('eyeBlinkRight',c.blink);}if(c.jaw){l.face.setWeight('jawOpen',c.jaw);l.face.setWeight('lipPart',.3);}
 r.studioLighting=c.lighting||'studio';r.skinTransportDisabled=c.debug==='albedo';r.setQuality(c.shadow?'shadow':'fast');l.render();
 if(l.compact.view!==(c.view||'skin'))throw Error('Requested material view was overwritten');
 return {camera:{target:r.target,distance:r.distance,yaw:r.yaw,pitch:r.pitch,projection:r.projection},lighting:{space:r.inspectionLighting?'world':'camera',key:[...r.studioKey],fill:[...r.studioFill]},appearance:l.appearance.export(),expression:l.face.expression(),triangles:l.compact.report.triangles,sourceQuality:l.compact.quality,sourceGroups:l.compact.report.groups.map(q=>({name:q.name,triangles:q.triangles,refinementBudget:q.refinementBudget,earFeatureRefinementBudget:q.earFeatureRefinementBudget})),view:l.compact.view,debug:c.debug||null,transport:r.skinTransport?.report(),hair:c.hair?l.hair.report():null,faceAnatomy:l.compact.report.faceAnatomy,eyes:l.compact.report.eyeAnatomy,eyeFrames:l.compact.eyeFrames,glError:g.getError()};
 },{c,baseline,identityBaseline,fixedCamera});await page.waitForTimeout(120);const view=frame.locator('#view'),box=await view.boundingBox();if(!box)throw Error('Face diagnostic view bounds missing');const x=Math.max(0,box.x),y=Math.max(0,box.y),clip={x,y,width:Math.max(1,Math.min(box.width,1500-x)),height:Math.max(1,Math.min(box.height,1080-y)),scale:1};const cdp=await page.context().newCDPSession(page);const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false,clip});await cdp.detach();if(!shot.data||shot.data.length<4096)throw Error('Face diagnostic screenshot was empty');fs.writeFileSync(path.join(out,c.name+'.png'),Buffer.from(shot.data,'base64'));samples.push({name:c.name,requested:c,cameraReference:fixedCamera?process.env.HUMAN_FACE_CAMERA_REFERENCE:null,...state});console.log(c.name);}
 const identityChecks=await frame.evaluate(async ({original,originalCharacterSeed})=>{const l=window.HumanLab;
  if(l.character.export().seed!==originalCharacterSeed)throw Error('Appearance changed the character seed');
  await l.appearance.apply(original);if(JSON.stringify(l.appearance.export())!==JSON.stringify(original))throw Error('Appearance restore mismatch');
  const before=JSON.stringify(l.appearance.export());l.face.setWeight('mouthSmileLeft',.6);l.face.setWeight('jawOpen',.25);
  if(JSON.stringify(l.appearance.export())!==before)throw Error('Expression changed identity');l.face.clearExpression();
  const sampled=l.character.sample(4101);if(!Object.keys(sampled.appearance.face.identity.shape).length)throw Error('NPC sampler omitted face identity');
  l.renderer.setInspectionLighting({key:[-.65,.65,1],fill:[.8,.1,.6]});l.render();const key=[...l.renderer.studioKey];l.renderer.yaw+=.5;l.render();
  if(JSON.stringify(key)!==JSON.stringify(l.renderer.studioKey))throw Error('World-fixed key followed camera');
  return {characterSeedPreserved:true,appearanceRoundTrip:true,expressionIndependent:true,characterSamplerOwnsShape:true,worldLightFixed:true};
 },{original:identityBaseline,originalCharacterSeed});
 const currentHashes=Object.fromEntries(Object.keys(hashes).map(p=>[p,hash(p)]));if(JSON.stringify(hashes)!==JSON.stringify(currentHashes))throw Error('Source changed during diagnosis');
 fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify({time:new Date().toISOString(),hashes,errors,samples,identityChecks,productionModified:false},null,2));if(errors.length||samples.some(s=>s.glError))throw Error('Runtime errors: '+JSON.stringify({errors,samples:samples.filter(s=>s.glError)}));console.log('CAPTURED '+out);
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
