import {PRODUCT_UNIFORMS,PRODUCT_GLSL} from '../src/product-lighting.js';
import {materialize} from './materialize.mjs';
import {adaptTurntable} from './adapt-turntable.mjs';
materialize();
import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';import {esbuild,playwright} from './dependencies.mjs';const {build}=esbuild();
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),safe=x=>JSON.stringify(x).replace(/</g,'\\u003c');
const native=await build({entryPoints:[path.join(root,'src/native.js')],bundle:true,format:'iife',minify:true,write:false,target:'es2022',alias:{three:path.join(root,'vendor/three.module.js')},legalComments:'inline'});
const beachBundle=await build({entryPoints:[path.join(root,'src/beach-runtime.js')],bundle:true,format:'iife',minify:true,write:false,target:'es2022',legalComments:'inline'});
const turntableBundle=await build({entryPoints:[path.join(root,'src/turntable.js')],bundle:true,format:'iife',minify:true,write:false,target:'es2022',legalComments:'inline'});const turntableScript=turntableBundle.outputFiles[0].text;
const beachScript='/* '+read('vendor/tidewater/LICENSE')+' */\n'+beachBundle.outputFiles[0].text;
const nativeHtml='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>html,body{margin:0;overflow:hidden;width:100%;height:100%}canvas{width:100%;height:100%;display:block}</style></head><body><canvas></canvas><script>/* '+read('vendor/tidewater/LICENSE')+' */\n'+native.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script></body></html>';
fs.writeFileSync(path.join(root,'assets/native.html'),nativeHtml);
const imported=await build({entryPoints:[path.join(root,'src/imported.js')],bundle:true,format:'iife',minify:true,write:false,target:'es2022',alias:{three:path.join(root,'vendor/three.module.js')},legalComments:'inline'});
const importedHtml='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>html,body{margin:0;overflow:hidden;width:100%;height:100%}canvas{display:block}</style></head><body><script>/* '+read('vendor/tidewater/LICENSE')+' */\n'+imported.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script></body></html>';fs.writeFileSync(path.join(root,'assets/imported.html'),importedHtml);

const manifest={scenes:{turntable:JSON.parse(read('references/pandanus-display/PROVENANCE.json')),fish:JSON.parse(read('references/fish-scene/PROVENANCE.json')),beach:JSON.parse(read('references/tidewater/PROVENANCE.json'))},schema:'animal-atlas/source-manifest@1',builtAt:new Date().toISOString(),version:'1.2.0',sources:[]},sourceNames={fish:'Fish-Workbench/local-r13 · complete sampled surface, KFE1 eyes and interactive school',eagle:'Eagle-Workbench · R07 connected surface and life runtime',crab:'Crab-Life-R06/public/index.html · R11',palau:'Palau-Bird-Workbench · R04 full surface and anatomical rig',chicken:'haihao0307/Humanoid-Rig-Lab-Next@codex/chicken-r984-natural-head · CHICKEN_V46_R9_8_4_NATURAL_FACE.html','cat-v440':'Cat-V440-Repo · Cat Kaopu V4.40',native:'haihao0307/guilin-dem-pipeline@748f8793ea7ca84c30a2c441b6a63ce5c95ce13a · K5 mammals and K4 quadrupeds'};
const sourceAliases=JSON.parse(read('docs/LEGACY_SOURCES.json'));
let payloads='',assets={};const frameStyle=`html,body{width:100%!important;height:100%!important;margin:0!important;overflow:hidden!important}body{background:#17343c!important}header,aside,footer,.topbar,.controls,.footer,.panel-label,.toolbar,.observer,.composer,.life-visual-ui,.life-visual-settings,.life-visual-panel,#lifeUnifiedMark,.labels,.scene-badge,.scene-nav,.hint,.playbar,#badge,#status,#viewStrip,#identity,#dock,#restoreUI,#offscreen,#lifeEcologyRecorder,#lifeEcologyDock,#lifeEcologyPanel,.life-ecology-panel,.life-ecology-dock,#story,#teacherLabel,#activeLabel,#stats,#statusBox,.overlay,.world-title,.actor-label,.world-label{display:none!important}#stage,#viewport,.stage,.viewer{position:fixed!important;inset:0!important;display:block!important;width:100vw!important;height:100vh!important;min-height:0!important;margin:0!important;border:0!important;overflow:hidden!important}.app,.shell,.layout,.main,main{display:block!important;grid-template-columns:1fr!important;grid-template-rows:1fr!important;height:100vh!important;width:100vw!important;padding:0!important;margin:0!important}#stage>canvas,#viewport>canvas,.stage>canvas{display:block!important;width:100%!important;height:100%!important}#cards{position:fixed!important;inset:0!important;display:block!important;margin:0!important;padding:0!important}#cards article{margin:0!important;padding:0!important;border:0!important;border-radius:0!important;height:100vh!important;width:100vw!important;background:transparent!important}#cards article h2,#cards article p,body>p,body>details,.transport{display:none!important}#cards article canvas{display:block!important;width:100%!important;height:100%!important}#loading.hidden,#loader.done{display:none!important}`;
for(const filename of fs.readdirSync(path.join(root,'assets')).filter(p=>p.endsWith('.html')&&!p.includes('r91'))){const key=path.basename(filename,'.html'),source=fs.readFileSync(path.join(root,'assets',filename)),sourceSha=hash(source);let html=source.toString('utf8');html=html.replace(/<head[^>]*>/i,m=>m+'<script>'+turntableScript.replaceAll('</script','<\\/script')+'</script>');
 if(key==='fish'){
 html=html.replace('dt=Math.min(.08,elapsed)','dt=Math.max(0,Math.min(.08,elapsed))');
 html=html.replace('projection:mat4Ortho(-halfW,halfW,-halfH,halfH,.01,20)',"projection:globalThis.AtlasFishHabitat.projection(halfW,halfH,this.distance,.01,250)");
 html=html.replace("return{origin:eye.map((v,k)=>v+right[k]*nx*halfW+up[k]*ny*halfH),direction};","return{origin:eye,direction:normalize3(direction.map((v,k)=>v+right[k]*nx*halfW/this.camera.distance+up[k]*ny*halfH/this.camera.distance))};");
 html=html.replace('uniform int uMode,uWeightChannel;','uniform int uMode,uWeightChannel;uniform float uAtlasDensity;uniform bool uAtlasEnvironment;');
 html=html.replace('outColor=vec4(toSRGB(clamp(lit,0.,1.)),1);',`if(uAtlasEnvironment&&uMode==0){float distanceM=length(vViewPos);float haze=1.-exp(-distanceM*uAtlasDensity*.13);lit*=vec3(.78,.96,1.);lit=mix(lit,vec3(.028,.21,.25),haze*.55);}outColor=vec4(toSRGB(clamp(lit,0.,1.)),1);`);
 html=html.replace("gl.uniform1i(u('uSchool'),this.state.school?1:0);","gl.uniform1i(u('uSchool'),this.state.school?1:0);gl.uniform1i(u('uAtlasEnvironment'),this.state.environment===false?0:1);gl.uniform1f(u('uAtlasDensity'),this.state.waterDensity??1);");
 html=html.replace('const m=this.camera.mvp(w/h);this.applyMesh','const m=this.camera.mvp(w/h);globalThis.AtlasFishHabitat?.draw(gl,m,this.state);this.applyMesh').replace('gl.clearColor(.035,.055,.072,1)','gl.clearColor(.028,.14,.19,1)').replace('const renderer=new Renderer(canvas,h,gl,textures);','window.__ATLAS_FISH_TEXTURE_BYTES__=h.textures.base;await AtlasFishHabitat.prepare(canvas,gl);const renderer=new Renderer(canvas,h,gl,textures);');
 html=html.replace('<script>\'use strict\';',()=>'<script>'+read('src/reference-water-runtime.js').replaceAll('</script','<\\/script')+'</script><script>\'use strict\';');
 if(!html.includes('AtlasFishHabitat?.draw')||!html.includes('await AtlasFishHabitat.prepare'))throw Error('Fish habitat hook failed');
 }
 if(key.startsWith('life-')){html=html.replaceAll('engine.render();','globalThis.__ATLAS_READY_CHECK__?.();engine.render();').replace('window.__LIFE_VISUAL = engine;','engine.animal=animal;window.__ATLAS_THREE=T;window.__LIFE_VISUAL = engine;').replace('const raw=Math.min(.05,(now-lastTime)/1000||0);','const raw=window.__ATLAS_PAUSED?0:Math.min(.05,(now-lastTime)/1000||0)*(globalThis.__ATLAS_DEMO?.activity??1);').replace('function tick(dt){\n simTime+=dt;','function tick(dt){if(window.__ATLAS_PAUSED)return;\n simTime+=dt;').replace('function tick(dt){lifeVisualClock+=dt;','function tick(dt){if(window.__ATLAS_PAUSED)return;lifeVisualClock+=dt;');}
 // Each source clock differs. Fail the build if a registered animal's exact entry disappears.
 const hook=(from,to)=>{if(html.split(from).length!==2)throw Error('Animal clock hook must match exactly once: '+key+' / '+from);html=html.replace(from,to);};
 if(['life-pig','life-cat'].includes(key)&&!html.includes('const raw=window.__ATLAS_PAUSED?0:'))throw Error('Life raw clock hook failed '+key);
 if(key==='life-bruce')hook('function tick(dt){if(window.__ATLAS_PAUSED)return;\n simTime+=dt;','function tick(dt){if(window.__ATLAS_PAUSED)return;dt*=globalThis.__ATLAS_DEMO?.activity??1;\n simTime+=dt;');
 if(key==='life-bird')hook('function tick(dt){if(window.__ATLAS_PAUSED)return;lifeVisualClock+=dt;','function tick(dt){if(window.__ATLAS_PAUSED)return;dt*=globalThis.__ATLAS_DEMO?.activity??1;lifeVisualClock+=dt;');
 if(key==='life-shark')hook('function step(dt){behavior.begin();if(state.paused)return;updateFish(dt);','function step(dt){behavior.begin();if(state.paused)return;dt*=globalThis.__ATLAS_DEMO?.activity??1;updateFish(dt);');
 if(key.startsWith('life-')){
  // Life's HDR pass clears the background before scene.onBeforeRender, and
  // shark's post pass otherwise applies underwater haze to the whole screen.
  hook('const state = sync(); post.render(drawScene, drawCamera, nativeRender, settings,',"const state = sync(); if(AtlasTurntable.isActive()){scene.background.set(AtlasTurntable.state.studioBackground);scene.fog=null;if(kind==='shark')api.ocean.setMode('neutral');}post.render(drawScene, drawCamera, nativeRender, settings, AtlasTurntable.isActive()?0:");
 }
 if(key==='eagle')hook('let dt=Math.min((now-this.last)/1000,.25);','let dt=Math.min((now-this.last)/1000,.25)*(globalThis.__ATLAS_DEMO?.activity??1);');
 if(key==='crab')html=html.replace('a.time+=T*a.speed','a.time+=T*a.speed*(globalThis.__ATLAS_DEMO?.activity??1)');
 if(key==='cat-v440'){html=html.replaceAll('performance.now()/1000','(globalThis.__ATLAS_DEMO?.clock()??performance.now()/1000)');html=html.replace('window.__CAT_V440_STATS__=','window.__ATLAS_CAT_MESH__=()=>m;window.__CAT_V440_STATS__=');}
 if(key==='cat-v440'){
 html=html.replace('const vs=`#version 300 es','const vs=`#version 300 es');
 html=html.replace('far=Math.max(4,dist+radius*5);return mul(perspective(CAMERA_FOV,canvas.width/canvas.height,near,far),lookAt(eye,target,up))','far=1800;const projection=perspective(CAMERA_FOV,canvas.width/canvas.height,near,far),view=lookAt(eye,target,up);window.__ATLAS_CAT_CAMERA_MATRICES__={projection,view,near,far};return mul(projection,view)');
 html=html.replace('gl.useProgram(pr);gl.bindVertexArray(meshVao);gl.uniformMatrix4fv(U.pv','AtlasBeach.drawRaw(gl,window.__ATLAS_CAT_CAMERA_MATRICES__);gl.useProgram(pr);gl.bindVertexArray(meshVao);gl.uniformMatrix4fv(U.pv');
 html=html.replace('gl.drawArrays(gl.LINES,0,grid.length/3);','if(!AtlasTurntable.isActive()&&!window.__ATLAS_BEACH?.group.visible)gl.drawArrays(gl.LINES,0,grid.length/3);');
 if(!html.includes('__ATLAS_CAT_CAMERA_MATRICES__'))throw Error('Cat beach camera hook missing');
 }
 if(key==='chicken'){html=html.replace('window.__CHICKEN_V46_API__=','window.__ATLAS_CHICKEN_MESHES=()=>candidateMeshes;window.__CHICKEN_V46_API__=');}
 if(key==='chicken')html=html.replace('window.__ATLAS_CHICKEN_MESHES=',"renderer.setAnimationLoop(()=>renderer.render(scene,camera));window.__ATLAS_CHICKEN_MESHES=");
 if(key==='palau'){
  const start=html.indexOf('sources='),end=html.indexOf(',surfaces=',start);if(start<0||end<0)throw Error('Palau module map missing');
  const modules=JSON.parse(html.slice(start+8,end)),anchor='for(const [id,name,scientific]of info){';
  if(!modules.app.includes(anchor))throw Error('Palau selected-stage hook missing');
  const unpack='export function unpack(r){const b=Uint8Array.from(atob(r.b64),c=>c.charCodeAt(0));';
  if(!modules.surface.includes(unpack))throw Error('Palau unpack hook missing');
  modules.surface=modules.surface.replace(unpack,"export function unpack(r){let b;if(Uint8Array.fromBase64)b=Uint8Array.fromBase64(r.b64);else{const text=atob(r.b64);b=new Uint8Array(text.length);for(let i=0;i<text.length;i++)b[i]=text.charCodeAt(i);}");
  modules.surface=modules.surface.replace('const cache=new Map();','const cache=new Map(),basisSamples=new Map();').replace('function basis(t,n){','function basis(t,n){let samples=basisSamples.get(n);if(!samples){samples=new Map();basisSamples.set(n,samples);}if(samples.has(t))return samples.get(t);const sampleKey=t;').replace('return{start:span-3,b};','const result={start:span-3,b};if(samples.size<4096)samples.set(sampleKey,result);return result;');
  modules.surface=modules.surface.replace('for(let i=0;i<score.vertices;i++){','const accumulator=new Float64Array(9);for(let i=0;i<score.vertices;i++){').replace('out=new Float64Array(9);','out=accumulator;out.fill(0);').replace('return mesh;','basisSamples.clear();return mesh;');
  modules.app=modules.app.replace('time+=dt*speed;draw()', 'time+=dt*speed*(globalThis.__ATLAS_DEMO?.activity??1);draw()');
  modules.app=modules.app.replace('window.ready=true;draw();','window.ready=true;globalThis.__ATLAS_READY_CHECK__?.();draw();').replace(anchor,"for(const [id,name,scientific]of info.filter(x=>!window.__ATLAS_CONTEXT?.key||x[0]===window.__ATLAS_CONTEXT.key)){");
  html=html.slice(0,start+8)+JSON.stringify(modules)+html.slice(end);
  const decodeLoop='for(const id of Object.keys(surfaces))';if(!html.includes(decodeLoop))throw Error('Palau selected-decode hook missing');
  html=html.replace(decodeLoop,"for(const id of Object.keys(surfaces).filter(id=>!window.__ATLAS_CONTEXT?.key||id===window.__ATLAS_CONTEXT.key))");
 }
 html=adaptTurntable(html,key);
 html=html.replaceAll('<script>'+beachScript.replaceAll('</script','<\\/script')+'</script>','').replaceAll('<script>'+read('src/reference-water-runtime.js').replaceAll('</script','<\\/script')+'</script>','');
 html=html.replace('AtlasBeach.prepareRaw(canvas,gl);','').replace('await AtlasFishHabitat.prepare(canvas,gl);','').replace('globalThis.AtlasFishHabitat.projection','AtlasTurntable.projection');
 if(key==='cat-v440')html=html.replace('))AtlasBeach.drawRaw(gl,window.__ATLAS_CAT_CAMERA_MATRICES__);', '));');
 if(key==='fish')html=html.replace('))globalThis.AtlasFishHabitat?.draw(gl,m,this.state);', '));');
 if(key==='chicken'){
  const lightUniforms=PRODUCT_UNIFORMS+PRODUCT_GLSL;
  html=html.replaceAll('vec3 shade(vec3 base,vec3 N,vec3 V,float rough,float f0,float occlusion){',lightUniforms+'vec3 shade(vec3 base,vec3 N,vec3 V,float rough,float f0,float occlusion){').replaceAll('vec3 L=normalize(vec3(3.,5.,4.)),L2=normalize(vec3(-3.,2.,-3.))','vec3 L=normalize(uAtlasLightDirection),L2=normalize(uAtlasFillDirection)').replaceAll('return base*(amb*occlusion+1.10*nl+.23*max(dot(N,L2),0.))+spec*nl*1.9;','return base*atlasDiffuse(N)*occlusion+atlasReflection(N,V,rough)+spec*nl*1.2*uAtlasKey*uAtlasKeyColor;').replaceAll('uniforms:{uKind:{value:kind},','uniforms:{uAtlasLightDirection:{value:new T.Vector3(-0.62,0.76,0.32)},uAtlasFillDirection:{value:new T.Vector3(0.65,0.3,0.7)},uAtlasEdgeDirection:{value:new T.Vector3(0.25,0.58,-0.78)},uAtlasKeyColor:{value:new T.Vector3(1,0.91,0.8)},uAtlasFillColor:{value:new T.Vector3(0.78,0.87,1)},uAtlasEdgeColor:{value:new T.Vector3(0.8,0.9,1)},uAtlasKey:{value:1},uAtlasAmbient:{value:1},uAtlasRim:{value:1},uKind:{value:kind},');
 }

 html=html.replace(/<head[^>]*>/i,m=>m+'<script>'+read('src/demo-head.js').replaceAll('</script','<\\/script')+'</script>');
 const sourceLabel=sourceNames[key]||(key.startsWith('life-')?'Life Ecosystem V3.x · original procedural source snapshot':'Original project');
 const emit=(id,text,data=text,baseAsset)=>{const compressed=zlib.gzipSync(Buffer.from(data),{level:9});assets[id]={source:sourceLabel,sha256:sourceSha,adaptedSha256:hash(Buffer.from(text)),bytes:source.length,compressedBytes:compressed.length,...(baseAsset?{baseAsset}: {}),...(sourceAliases[id]?{compatibleSourceSha256:sourceAliases[id]}:{})};manifest.sources.push({id,...assets[id]});payloads+='<script type="application/octet-stream" id="payload-'+id+'">'+compressed.toString('base64')+'</script>\n';};
 if(key==='palau'){
  const surfaceStart=html.indexOf(',surfaces='),bindingStart=html.indexOf(',bindings=',surfaceStart),motionStart=html.indexOf(',motion=',bindingStart);
  if(surfaceStart<0||bindingStart<0||motionStart<0)throw Error('Palau data directory missing');
  const surfaces=JSON.parse(html.slice(surfaceStart+10,bindingStart)),bindings=JSON.parse(html.slice(bindingStart+10,motionStart));
  // Select package before outer decompression and JS parsing. No extra surface copy.
  const template=html.slice(0,surfaceStart+10)+'{},bindings={}'+html.slice(motionStart);emit('palau',template);
  for(const id of Object.keys(surfaces)){const data={surfaces:{[id]:surfaces[id]},bindings:{[id]:bindings[id]}},text=template.replace(',surfaces={},bindings={}',()=>',surfaces='+JSON.stringify(data.surfaces)+',bindings='+JSON.stringify(data.bindings));emit('palau-'+id.replace('_','-'),text,JSON.stringify(data),'palau');}
 }else emit(key,html);
}
const stageBundle=await build({entryPoints:[path.join(root,'src/rehearsal-viewer.js')],bundle:true,format:'iife',minify:true,write:false,target:'es2022',alias:{three:path.join(root,'vendor/three.module.js')},legalComments:'inline'});
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
const app=await build({entryPoints:[path.join(root,'src/app.js')],bundle:true,format:'iife',minify:true,write:false,target:'es2022',alias:{three:path.join(root,'vendor/three.module.js')},legalComments:'inline'}),thumbs=fs.existsSync(path.join(root,'qa/thumbnails.json'))?JSON.parse(read('qa/thumbnails.json')):{};
const parameterBundle=await build({entryPoints:[path.join(root,'src/parameter-runtime.js')],bundle:true,format:'iife',minify:true,write:false,target:'es2022'});
const sharedBridge=parameterBundle.outputFiles[0].text+'\n'+read('src/demo-runtime.js')+'\n'+read('src/studio-bridge.js')+'\n'+read('src/bridge.js');
const exampleScore=(await import('../vendor/quad/src/scores.js')).SCORE_LIBRARY.tortoise.score;
const boot='window.ATLAS_EXAMPLE_NOTATION='+safe(exampleScore)+';window.ATLAS_ASSETS='+safe(assets)+';window.ATLAS_BRIDGE='+'window.ATLAS_LIVE_SUPPORT.bridge'+';window.ATLAS_FRAME_STYLE='+safe(frameStyle)+';window.ATLAS_THUMBS='+safe(thumbs)+';';
const legacy=JSON.parse(read('docs/LEGACY_MODULES.json'));
const support={modules:Object.fromEntries(Object.entries(assets).map(([k,a])=>[k,{sha256:a.adaptedSha256,legacy:legacy[k]||[]}])),legacyModules:legacy,bridge:sharedBridge,style:frameStyle};
fs.writeFileSync(path.join(root,'dist/kaopu-stage-runtime.js'),'window.ATLAS_LIVE_SUPPORT='+safe(support)+';'+stageBundle.outputFiles[0].text);
const html=read('src/index.html').replace('/*STYLE*/',()=>read('src/style.css')+'\n'+read('src/rehearsal.css')).replace('<!--REHEARSAL-->',()=>read('src/rehearsal.html')).replace('<!--PAYLOADS-->',()=>payloads).replace('/*APP*/',()=>'window.ATLAS_LIVE_SUPPORT='+safe(support)+';'+boot+'window.ATLAS_REHEARSAL_RUNTIME='+safe(stageBundle.outputFiles[0].text)+';'+app.outputFiles[0].text.replaceAll('</script','<\\/script'));
const output=path.join(root,'打开动物集成工作台.html');fs.writeFileSync(output,html);manifest.output={file:path.basename(output),bytes:Buffer.byteLength(html),sha256:hash(Buffer.from(html)),coreNetworkDependencies:0,independentHtml:true};fs.writeFileSync(path.join(root,'SOURCE_MANIFEST.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest.output));
