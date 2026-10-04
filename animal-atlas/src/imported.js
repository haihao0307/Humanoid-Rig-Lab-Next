import * as T from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';

const config=window.__ATLAS_CONTEXT;
async function start(){
 const data=JSON.parse(document.querySelector('#instrument-data').textContent),bytes=Uint8Array.from(atob(data.glb),c=>c.charCodeAt(0));
 const manager=new T.LoadingManager();manager.setURLModifier(url=>{if(/^(data:|blob:)/.test(url))return url;throw Error('外部资源未内嵌：'+url);});
 const gltf=await new GLTFLoader(manager).parseAsync(bytes.buffer,'');
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
 const scene=new T.Scene(),beach={group:new T.Group(),update(){}},camera=new T.PerspectiveCamera(37,1,.015,1800),placement=new T.Group(),model=gltf.scene;placement.add(model);scene.add(placement);
 let meshes=0;model.traverse(o=>{if(o.isMesh){meshes++;o.castShadow=o.receiveShadow=true;}});const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),extent=Math.max(...size.toArray());if(!meshes||!Number.isFinite(extent)||extent<=0)throw Error('模型没有可展示的有效动物网格');
 // Keep source node transforms and bone bindings intact; put normalization on a separate parent.
 const factor=2/extent;model.position.sub(new T.Vector3(center.x,bounds.min.y,center.z));placement.scale.setScalar(factor);
 const materials=new Map();model.traverse(o=>{for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m&&!materials.has(m))materials.set(m,{color:m.color?.clone(),roughness:m.roughness});});
 const clips=gltf.animations,mixer=new T.AnimationMixer(model);let clipAction,time=0,previous=performance.now(),yaw=.65,pitch=.22,distance=5,target=new T.Vector3(0,size.y*factor*.5,0),frames=0;
 const state={scale:1,tint:'#ffffff',roughness:1,speed:1,playing:true,environment:true,wire:false};
 function cameraUpdate(){camera.position.set(target.x+distance*Math.cos(pitch)*Math.sin(yaw),target.y+distance*Math.sin(pitch),target.z+distance*Math.cos(pitch)*Math.cos(yaw));camera.lookAt(target);}
 function resize(){camera.aspect=innerWidth/Math.max(1,innerHeight);camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false);distance=2.1/Math.sin(Math.atan(Math.tan(T.MathUtils.degToRad(camera.fov/2))*Math.min(1,camera.aspect)));cameraUpdate();}addEventListener('resize',resize);resize();
 let drag;const canvas=renderer.domElement;canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,pan:e.button===2||e.shiftKey};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.pan){target.x-=dx*.002*distance;target.y+=dy*.002*distance;}else{yaw-=dx*.006;pitch=Math.max(-.1,Math.min(1.5,pitch+dy*.006));}drag={...drag,x:e.clientX,y:e.clientY};cameraUpdate();};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;canvas.oncontextmenu=e=>e.preventDefault();canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(.2,Math.min(60,distance*Math.exp(e.deltaY*.001)));cameraUpdate();},{passive:false});
 function set(key,value){state[key]=value;if(key==='scale')placement.scale.setScalar(factor*value);else if(key==='tint'){for(const [m,original]of materials)if(m.color&&original.color)m.color.copy(original.color).multiply(new T.Color(value));}else if(key==='roughness'){for(const [m,original]of materials)if(original.roughness!==undefined)m.roughness=Math.min(1,original.roughness*value);}else if(key==='wire'){for(const [m]of materials)m.wireframe=value;}else if(key==='environment')beach.group.visible=value;else if(key==='action'){const clip=clips[Number(value)];if(!clip)throw Error('GLB 不包含这个动作片段');mixer.stopAllAction();clipAction=mixer.clipAction(clip);clipAction.reset().play();state.playing=true;}}
 const actions=clips.map((clip,i)=>({id:String(i),label:clip.name||'动作片段 '+(i+1)}));if(actions.length){set('action','0');}
 window.__ATLAS_IMPORTED={ready:true,T,renderer,scene,camera,state,actions,orbit(delta,elevation=0){yaw+=delta;pitch=Math.max(-1.48,Math.min(1.48,pitch+elevation));cameraUpdate();},meshes:()=>[placement],set,view(name){[yaw,pitch]=({three:[.65,.22],front:[0,.12],side:[Math.PI/2,.15],top:[0,1.45]})[name]||[.65,.22];cameraUpdate();},info:()=>({meshes,animations:clips.length,sourceBounds:size.toArray(),normalization:factor,frames,time,mixerTime:mixer.time})};
 renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-previous)/1000);previous=now;frames++;if(state.playing){time+=dt; mixer.update(dt*state.speed*(globalThis.__ATLAS_DEMO?.activity??1));}cameraUpdate();beach.update(time,camera);renderer.render(scene,camera);});renderer.render(scene,camera);
}
const boot=()=>start().catch(e=>{window.__ATLAS_IMPORT_ERROR=e.message;});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
