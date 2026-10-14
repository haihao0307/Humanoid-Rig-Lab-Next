/* KAOPU EB1 / 1.0.0 — owned lighting profile, studio radiance and engine adapters.
 * Method reference: lo-th/head@21462e471d53ba8c413a96989016510ca4495a34.
 * No reference application, model, texture or HDR pixels are included.
 * Neutral view-transform equations: Khronos PBR Neutral, Apache-2.0 (see NOTICE).
 */
(function(global){'use strict';
const VERSION='EB1-1.1.0', SCHEMA='kaopu.eb1/1', KEY='kaopu:lighting:eb1:v1:user-20261013-r1';
const DEFAULT=Object.freeze({schema:SCHEMA,preset:'custom',exposure:.7,key:1.6,rim:3.5,environment:.9,keyAzimuth:-154,keyElevation:8,rimAzimuth:71,rimElevation:11.309932,environmentRotation:-69,keyColor:'#ffffff',rimColor:'#efa37e',background:.85,shadowSize:2048});
const RANGE={exposure:[.1,4],key:[0,8],rim:[0,8],environment:[0,2.5],keyAzimuth:[-180,180],keyElevation:[-80,89],rimAzimuth:[-180,180],rimElevation:[-80,89],environmentRotation:[-180,180],background:[0,1],shadowSize:[512,2048]};
const PRESETS={custom:{},reference:{exposure:1,key:3,rim:3.5,environment:.8,keyAzimuth:45,keyElevation:41.472934,rimAzimuth:180,rimElevation:11.309932,environmentRotation:100,keyColor:'#ffffff',rimColor:'#efa37e',background:.05,shadowSize:2048},neutral:{key:2.4,rim:.8,environment:.65,keyColor:'#ffffff',rimColor:'#ffffff'},rake:{key:3.2,rim:.45,environment:.22,keyAzimuth:-75,keyElevation:12,rimColor:'#ffffff'}};
const clone=x=>JSON.parse(JSON.stringify(x)), radians=x=>x*Math.PI/180;
function validate(input,base=DEFAULT){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('EB1 配方必须为对象');
 const p={...base};
 for(const [k,v] of Object.entries(input)){
  if(!Object.hasOwn(DEFAULT,k))throw Error('EB1 未知字段: '+k);
  if(k==='schema'){if(v!==SCHEMA)throw Error('EB1 配方版本不匹配');}
  else if(k==='preset'){if(typeof v!=='string'||v.length>48)throw Error('EB1 预设名称无效');}
  else if(k.endsWith('Color')){if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw Error('EB1 灯色无效');}
  else {const [a,b]=RANGE[k];if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)throw Error('EB1 参数越界: '+k);if(k==='shadowSize'&&![512,1024,2048].includes(v))throw Error('EB1 阴影分辨率无效');}
  p[k]=v;
 }
 return Object.freeze(p);
}
function direction(a,e){a=radians(a);e=radians(e);return [Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)];}
function linearColor(s){return [1,3,5].map(i=>{const v=parseInt(s.slice(i,i+2),16)/255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);});}
function fingerprint(p){let h=2166136261;for(const c of JSON.stringify(p)){h=Math.imul(h^c.charCodeAt(0),16777619);}return (h>>>0).toString(16).padStart(8,'0');}
function radiance(x,y,z){
 // Analytic softboxes on a neutral cyclorama. Coordinates and amplitudes are authored.
 const lobe=(dx,dy,dz,k,p)=>p*Math.exp(k*(x*dx+y*dy+z*dz-1));
 const a=lobe(-.650,.550,.5244,22,7)+lobe(.765,.280,.5804,32,4)+lobe(0,.820,-.5724,18,5.5);
 const b=.035+.12*Math.max(0,y)+.025*Math.max(0,-y);
 return [b+a,b+a,b+a];
}
function studioField(width=256,height=128){
 const data=new Float32Array(width*height*4),bins=Array.from({length:8},()=>({direction:[0,0,0],color:[0,0,0],weight:0}));
 for(let j=0;j<height;j++){const theta=Math.PI*(j+.5)/height,y=-Math.cos(theta),r=Math.sin(theta),dw=(Math.PI/height)*(2*Math.PI/width)*r;
  for(let i=0;i<width;i++){const phi=2*Math.PI*((i+.5)/width-.5),x=r*Math.cos(phi),z=r*Math.sin(phi),c=radiance(x,y,z),n=(j*width+i)*4;data.set([...c,1],n);const b=bins[(x>=0?1:0)|(y>=0?2:0)|(z>=0?4:0)],w=(c[0]+c[1]+c[2])/3*dw;b.weight+=w;for(let k=0;k<3;k++){b.direction[k]+=[x,y,z][k]*w;b.color[k]+=c[k]*dw/Math.PI;}}
 }
 for(const b of bins){const l=Math.hypot(...b.direction)||1;b.direction=b.direction.map(x=>x/l);}
 return {width,height,data,bins};
}
let field;
function getField(){return field||(field=studioField());}
function sampleProfile(profile){const p=validate(profile),a=-radians(p.environmentRotation),c=Math.cos(a),s=Math.sin(a);
 return {keyDirection:direction(p.keyAzimuth,p.keyElevation),rimDirection:direction(p.rimAzimuth,p.rimElevation),keyColor:linearColor(p.keyColor).map(x=>x*p.key),rimColor:linearColor(p.rimColor).map(x=>x*p.rim),environment:getField().bins.map(b=>({direction:[c*b.direction[0]-s*b.direction[2],b.direction[1],s*b.direction[0]+c*b.direction[2]],color:b.color.map(x=>x*p.environment)}))};
}
function createStore({persist=true,broadcast=true}={}){
 let value=DEFAULT,revision=0,closed=false,storageOK=true;const listeners=new Set(),warnings=[];let channel=null;
 if(persist)try{const text=global.localStorage?.getItem(KEY);if(text)value=validate(JSON.parse(text));}catch(e){warnings.push('保存的 EB1 配方未采用: '+e.message);storageOK=false;}
 function update(p,{remote=false,replace=false}={}){if(closed)throw Error('EB1 已释放');value=validate(p,replace?DEFAULT:value);revision++;if(persist)try{global.localStorage?.setItem(KEY,JSON.stringify(value));}catch(e){storageOK=false;}for(const fn of listeners)fn(value);if(!remote)channel?.postMessage({schema:SCHEMA,profile:value});return value;}
 if(broadcast&&typeof global.BroadcastChannel==='function'){channel=new global.BroadcastChannel(KEY);channel.onmessage=e=>{try{if(e.data?.schema===SCHEMA)update(e.data.profile,{remote:true,replace:true});}catch(x){warnings.push(x.message);}};}
 const api={get:()=>value,patch:p=>update(p),import:p=>update(p,{replace:true}),preset:name=>{if(!Object.hasOwn(PRESETS,name))throw Error('未知 EB1 预设');return update({...DEFAULT,...PRESETS[name],preset:name},{replace:true});},subscribe:fn=>{listeners.add(fn);return ()=>listeners.delete(fn);},audit:()=>({version:VERSION,schema:SCHEMA,revision,profile:clone(value),fingerprint:fingerprint(value),storageOK,warnings:clone(warnings)}),dispose:()=>{closed=true;listeners.clear();channel?.close();}};return api;
}
function attachThree(T,{renderer,scene,store=createStore(),center=[0,0,0],radius=1,requestRender=()=>{},shadows=true,ui=true,secondaryScenes=[]}={}){
 if(!renderer||!scene||T.NeutralToneMapping===undefined)throw Error('EB1 需要支持 NeutralToneMapping 的 Three.js 渲染器');
 const old={environment:scene.environment,background:scene.background,tone:renderer.toneMapping,exposure:renderer.toneMappingExposure},oldLights=[];
 scene.traverse(o=>{if(o.isLight&&!o.userData.eb1Diagnostic)oldLights.push([o,o.visible]);});for(const [o]of oldLights)o.visible=false;
 const group=new T.Group();group.name='KAOPU_EB1_LIGHTING';scene.add(group);
 const key=new T.DirectionalLight(),rim=new T.DirectionalLight();key.name='EB1_KEY';rim.name='EB1_RIM';group.add(key,key.target,rim,rim.target);
 for(const light of[key,rim]){light.castShadow=shadows;light.shadow.bias=-.000025;light.shadow.normalBias=radius*.00035;light.shadow.radius=4;}
 const f=getField(),texture=new T.DataTexture(f.data,f.width,f.height,T.RGBAFormat,T.FloatType);texture.mapping=T.EquirectangularReflectionMapping;texture.colorSpace=T.LinearSRGBColorSpace;texture.needsUpdate=true;
 const pmrem=new T.PMREMGenerator(renderer);let environment=pmrem.fromEquirectangular(texture);pmrem.dispose();
 let disposed=false,applied=0,rebuilds=1;const point=new T.Vector3(...center);let rad=Math.max(1e-6,radius);
 const secondary=secondaryScenes.map(sc=>{const olds=[];sc.traverse(o=>{if(o.isLight){olds.push([o,o.visible]);o.visible=false;}});const k=new T.DirectionalLight(),r=new T.DirectionalLight();sc.add(k,r,k.target,r.target);return {scene:sc,key:k,rim:r,old:olds};});
 function apply(){if(disposed)return;const p=store.get(),v=sampleProfile(p);for(const [o]of oldLights)o.visible=false;renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=p.exposure;
  scene.environment=environment.texture;scene.environmentIntensity=p.environment;scene.environmentRotation?.set(0,radians(p.environmentRotation),0);
  // A separate blurred background cannot alter illumination or material parameters.
  scene.background=texture;scene.backgroundBlurriness=.5;scene.backgroundIntensity=p.background;scene.backgroundRotation?.set(0,radians(p.environmentRotation),0);
  for(const [light,dir,col]of[[key,v.keyDirection,p.keyColor],[rim,v.rimDirection,p.rimColor]]){light.color.set(col);light.position.set(...dir).multiplyScalar(rad*3.5).add(point);light.target.position.copy(point);light.target.updateMatrixWorld(true);if(light.shadow.mapSize.x!==p.shadowSize){light.shadow.map?.dispose();light.shadow.map=null;light.shadow.mapSize.set(p.shadowSize,p.shadowSize);}Object.assign(light.shadow.camera,{left:-rad*1.5,right:rad*1.5,top:rad*1.5,bottom:-rad*1.5,near:rad*.02,far:rad*8});light.shadow.camera.updateProjectionMatrix();}
  key.intensity=p.key;rim.intensity=p.rim;
  for(const s of secondary){for(const [o]of s.old)o.visible=false;s.scene.environment=environment.texture;s.scene.environmentIntensity=p.environment;s.scene.environmentRotation?.set(0,radians(p.environmentRotation),0);s.key.color.copy(key.color);s.key.intensity=p.key;s.key.position.copy(key.position);s.rim.color.copy(rim.color);s.rim.intensity=p.rim;s.rim.position.copy(rim.position);s.key.target.position.copy(point);s.rim.target.position.copy(point);}
  renderer.shadowMap.needsUpdate=true;applied++;requestRender();
 }
 const unsubscribe=store.subscribe(apply);
 function restore(){environment.dispose();const gen=new T.PMREMGenerator(renderer);environment=gen.fromEquirectangular(texture);gen.dispose();rebuilds++;apply();}
 renderer.domElement.addEventListener('webglcontextrestored',restore);
 const controller={store,key,rim,group,apply,ensure(){const p=store.get();if(renderer.toneMapping!==T.NeutralToneMapping||renderer.toneMappingExposure!==p.exposure||scene.environment!==environment.texture||scene.environmentIntensity!==p.environment||scene.backgroundIntensity!==p.background||oldLights.some(([o])=>o.visible))apply();},setBounds(c,r){if(!Array.isArray(c)||c.length!==3||!c.every(Number.isFinite)||!Number.isFinite(r)||r<=0)throw Error('EB1 bounds');point.set(...c);rad=r;for(const l of[key,rim])l.shadow.normalBias=rad*.00035;apply();},audit:()=>({...store.audit(),engine:'Three.js '+T.REVISION,applied,lights:2,legacyLightsDisabled:oldLights.every(([o])=>!o.visible),environment:'owned-analytic-studio-PMREM-256',environmentRebuilds:rebuilds,shadows:shadows?2:0,nonLightingMutation:false}),dispose(){if(disposed)return;disposed=true;unsubscribe();renderer.domElement.removeEventListener('webglcontextrestored',restore);for(const l of[key,rim])l.shadow.map?.dispose();group.removeFromParent();for(const s of secondary){s.key.removeFromParent();s.rim.removeFromParent();s.key.target.removeFromParent();s.rim.target.removeFromParent();for(const [o,v]of s.old)o.visible=v;}environment.dispose();texture.dispose();for(const [o,v]of oldLights)o.visible=v;scene.environment=old.environment;scene.background=old.background;renderer.toneMapping=old.tone;renderer.toneMappingExposure=old.exposure;}};
 apply();if(ui)mountUI(store);global.__EB1__=controller;return controller;
}
function mountUI(store){
 if(typeof document==='undefined')return;document.getElementById('eb1-panel')?.remove();
 const box=document.createElement('details');box.id='eb1-panel';box.style.cssText='position:fixed;z-index:2147483000;right:14px;top:64px;width:270px;max-width:calc(100vw - 28px);max-height:calc(100vh - 90px);overflow:auto;background:#171c22f5;color:#f2f4f5;border:1px solid #75818d;border-radius:8px;font:13px/1.5 system-ui;box-shadow:0 5px 24px #0005';
 const controls=[['exposure','曝光',.1,4,.05],['key','主光',0,8,.05],['rim','轮廓光',0,8,.05],['environment','环境光',0,2.5,.05],['keyAzimuth','主光方向',-180,180,1],['keyElevation','主光高度',-80,89,1],['rimAzimuth','轮廓方向',-180,180,1],['environmentRotation','环境旋转',-180,180,1],['background','背景亮度',0,1,.01]];
 box.innerHTML='<summary style="cursor:pointer;padding:9px 13px;font-weight:650">EB1 · 统一布光 <small style="font-weight:400">调整</small></summary><div style="padding:2px 13px 13px"><div style="display:flex;gap:4px;margin:5px 0 10px"><button data-preset="custom">当前统一配方</button><button data-preset="neutral">中性</button><button data-preset="rake">掠射</button></div>'+controls.map(([k,l,a,b,s])=>`<label style="display:block;margin:6px 0">${l} <output data-value="${k}" style="float:right"></output><input aria-label="EB1 ${l}" data-key="${k}" type="range" min="${a}" max="${b}" step="${s}" style="width:100%;accent-color:#b5cce0"></label>`).join('')+'<label>主光颜色 <input data-key="keyColor" type="color"></label> <label>轮廓颜色 <input data-key="rimColor" type="color"></label><p style="font-size:11px;color:#bac4cd">自动保存；同源 EB1 页面同步。只改变照明，不更换材料与物理。</p><div style="display:flex;gap:5px"><button data-copy>复制配方</button><button data-import>导入配方</button></div><textarea aria-label="EB1 配方 JSON" style="display:none;width:100%;height:75px;margin-top:8px" spellcheck="false"></textarea><p data-status style="font-size:11px;margin-bottom:0"></p></div>';
 for(const b of box.querySelectorAll('button'))b.style.cssText='background:#303b46;color:inherit;border:1px solid #667585;border-radius:4px;padding:4px 7px;cursor:pointer';
 function refresh(){const p=store.get();for(const el of box.querySelectorAll('[data-key]')){el.value=p[el.dataset.key];const o=box.querySelector('[data-value="'+el.dataset.key+'"]');if(o)o.value=typeof p[el.dataset.key]==='number'?Number(p[el.dataset.key].toFixed(2)):p[el.dataset.key];}box.querySelector('[data-status]').textContent=VERSION+' / '+fingerprint(p);}
 for(const el of box.querySelectorAll('[data-key]'))el.addEventListener('input',()=>{try{store.patch({[el.dataset.key]:el.type==='color'?el.value:Number(el.value),preset:'custom'});}catch(e){box.querySelector('[data-status]').textContent=e.message;}});
 for(const b of box.querySelectorAll('[data-preset]'))b.onclick=()=>store.preset(b.dataset.preset);
 const area=box.querySelector('textarea');box.querySelector('[data-copy]').onclick=async()=>{area.style.display='block';area.value=JSON.stringify(store.get(),null,2);area.select();try{await navigator.clipboard.writeText(area.value);}catch(e){/* selected text remains available without a clipboard grant */}};
 box.querySelector('[data-import]').onclick=()=>{if(area.style.display==='none'){area.style.display='block';area.value='';area.placeholder='粘贴 EB1 JSON 后再点导入';area.focus();return;}try{store.import(JSON.parse(area.value));area.style.display='none';}catch(e){box.querySelector('[data-status]').textContent=e.message;}};
 document.body.append(box);store.subscribe(refresh);refresh();return box;
}
// Khronos PBR Neutral equations, evaluated only once on linear radiance at display output.
const neutralGLSL=`vec3 eb1Neutral(vec3 v){v=max(v,vec3(0));float lo=min(v.r,min(v.g,v.b));v-=lo<.08?lo-6.25*lo*lo:.04;float hi=max(v.r,max(v.g,v.b));if(hi<.76)return v;float compressed=1.-.0576/(hi-.52);v*=compressed/hi;return mix(v,vec3(compressed),1.-1./(1.+.15*(hi-compressed)));}`;
global.KAOPU_EB1=Object.freeze({VERSION,SCHEMA,DEFAULT,PRESETS,validate,direction,linearColor,fingerprint,radiance,studioField,sampleProfile,createStore,attachThree,mountUI,neutralGLSL});
})(globalThis);
