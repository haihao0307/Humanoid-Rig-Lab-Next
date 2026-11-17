import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadCmuClip } from '/atlas-source/cmu-retarget.js';
import { loadMesh2MotionClip } from '/atlas-source/mesh2motion-retarget.js';

// This is the original atlas mannequin, independent of the function body.
// Its timeline is driven only by the body preview's displayed position.
export class SourceDemo {
 constructor(canvas, status) { this.canvas=canvas;this.status=status;this.clips=new Map();this.generation=0;this.last=null; }
 async init() {
  this.renderer=new THREE.WebGPURenderer({canvas:this.canvas,antialias:true,forceWebGL:true});
  await this.renderer.init();
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x1c2023);
  this.scene.add(new THREE.HemisphereLight(0xcadce7,0x24252a,1.9));
  const key=new THREE.DirectionalLight(0xffd9ad,3.2);key.position.set(-3.5,5,4.5);this.scene.add(key);
  const fill=new THREE.DirectionalLight(0x8fbfff,1.65);fill.position.set(3,2,-2.5);this.scene.add(fill);
  const gltf=await new GLTFLoader().loadAsync('/atlas-source/assets/model.glb');this.model=gltf.scene;
  this.model.traverse(o=>{if(o.isMesh){const mats=Array.isArray(o.material)?o.material:[o.material];const styled=mats.map(original=>{const m=original.clone();m.side=THREE.FrontSide;m.color.set(original.name==='M_Joints'?0x353e43:0xd7ab72);m.roughness=original.name==='M_Joints'?.72:.4;m.metalness=.12;return m;});o.material=Array.isArray(o.material)?styled:styled[0];}});
  this.scene.add(this.model);this.model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(this.model);this.model.position.y+=Math.max(0,-bounds.min.y);
  this.mixer=new THREE.AnimationMixer(this.model);this.camera=new THREE.PerspectiveCamera(32,1,.05,100);this.camera.position.set(1.9,1.4,3.0);this.camera.lookAt(0,.92,0);
  this.rest=await (await fetch('/atlas-source/assets/rest-state.json')).json();this.ready=true;this.render();this.status.textContent='等待动作';
 }
 async select(id,frameDomain){
  const version=++this.generation;this.status.textContent='准备动作';
  try {
   await this.initialized;
   let clip=this.clips.get(id);
   if(!clip){
    const response=await fetch('/api/atlas-source-info?id='+encodeURIComponent(id));const data=await response.json();if(!response.ok)throw Error(data.error||'示范动作读取失败');
    const info=data.info;
    if(info.provider==='cmu')clip=await loadCmuClip(info,this.rest,{inPlace:!data.rootMotion,frameDomain});
    else if(info.provider==='mesh2motion')clip=await loadMesh2MotionClip(info,this.rest,{rootMotion:data.rootMotion,inPlace:!data.rootMotion});
    else {const url=data.rootMotion&&info.rootMotionUrl?info.rootMotionUrl:info.url;const r=await fetch(new URL(url,location.origin+'/atlas-source/'));if(!r.ok)throw Error('示范动作数据读取失败');clip=THREE.AnimationClip.parse(await r.json());}
    this.clips.set(id,clip);while(this.clips.size>6)this.clips.delete(this.clips.keys().next().value);
   }
   if(version!==this.generation)return;
   this.pending={id,clip};this.status.textContent='等待身体';
   if(this.last?.id===id)this.frame(id,this.last.position);
  }catch(e){if(version===this.generation){if(this.action)this.action.stop();this.current=null;this.pending=null;this.render();this.status.textContent='原示范不可用';this.error=e.message;console.warn('原动作示范不可用',e);}}
 }
 unavailable(){this.generation++;if(this.action)this.action.stop();this.current=null;this.pending=null;this.status.textContent='原示范不可用';if(this.ready)this.render();}
 frame(id,position){this.last={id,position};if(!this.ready)return;
  if(this.pending?.id===id){if(this.action)this.action.stop();this.action=this.mixer.clipAction(this.pending.clip);this.action.reset();this.action.setLoop(THREE.LoopOnce,1);this.action.clampWhenFinished=true;this.action.play();this.current=id;this.pending=null;this.status.textContent='同步';}
  if(this.current!==id||!this.action)return;this.action.paused=false;this.action.enabled=true;this.mixer.setTime(Math.max(0,Math.min(this.action.getClip().duration,position)));
  this.model.updateMatrixWorld(true);const pelvis=this.model.getObjectByName('pelvis');if(pelvis){const hip=pelvis.getWorldPosition(new THREE.Vector3());this.camera.position.set(hip.x+1.9,1.4,hip.z+3);this.camera.lookAt(hip.x,.92,hip.z);}this.render();
 }
 render(){if(!this.ready)return;const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.render(this.scene,this.camera);}
 report(){return {ready:!!this.ready,id:this.current,position:this.last&&this.last.id===this.current?this.last.position:null,error:this.error||null};}
}
