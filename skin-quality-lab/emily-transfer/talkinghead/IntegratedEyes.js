import * as THREE from 'three';
import {ResearchEyes} from '../research/ResearchEyes.js';
import {BehaviorController,DEFAULT_BEHAVIOR} from './BehaviorController.js';
export const EYE_VERSION='eyes/6.0.0';
const clamp=THREE.MathUtils.clamp;
const V=()=>new THREE.Vector3();
/** Single final-pose writer. Targets use world metres; contact uses head space.
 * No replacement head, duplicate canvas, second Three instance, audio or RAF.
 */
export class IntegratedEyes extends ResearchEyes {
 constructor(options){
  super(options);this.behavior=null;this.finalFrame=null;this.updateCount=0;this.lidUpdateCount=0;this.disposed=false;
  this.ready=this.ready.then(()=>{
   this.behavior=new BehaviorController();
   this.headRoot=new THREE.Group();this.headRoot.name='ET04-neck-pivot';this.headRoot.position.set(-.004,.004,.006);this.scene.add(this.headRoot);
   this.headContent=new THREE.Group();this.headContent.name='ET04-original-head-space';this.headContent.position.copy(this.headRoot.position).negate();this.headRoot.add(this.headContent);
   this.headContent.add(this.mesh,this.group);if(options.fuzz)this.headContent.add(options.fuzz);
   this.fuzzObject=options.fuzz;
   this._localTarget=V();this._light=V();this._worldCenter=V();this._targetCenter=V();this._right=V();this._up=V();this._forward=V();this._cameraWorld=V();this._fillDirection=V();this._temp=V();
   this._headQuaternion=new THREE.Quaternion();this._eyeWorldQuaternion=new THREE.Quaternion();this._inverseEye=new THREE.Quaternion();this._headEuler=new THREE.Euler(0,0,0,'YXZ');this._eyeRotationMatrix=new THREE.Matrix4();
   this._closed=[0,0];this._squint=[0,0];this._open=[1,1];
   this.state.version=EYE_VERSION;this.state.driver='TalkingHead 1.7.0 / extracted behavior';this.update(0,true);this.requestRender();return this;
  });
 }
 setBehavior(value){if(!this.behavior)return;this.behavior.configure(value);if(!this.behavior.settings.enabled){this.headRoot.quaternion.identity();this.headRoot.updateMatrixWorld(true);}this.update(0,true);this.requestRender();}
 resetBehavior(){this.behavior?.reset();this.finalFrame=null;this.update(0,true);this.requestRender();}
 blink(kind='single'){
  if(!this.behavior||!this.behavior.settings.enabled)return super.blink();
  this.config.manualBlink=-1;this.behavior.blink(kind);this.requestRender();
 }
 gesture(kind){if(!this.behavior?.settings.enabled)return;this.behavior.gesture(kind);this.requestRender();}
 update(dt,instant=false){
  if(!this.behavior||!this._localTarget)return super.update(dt,instant);
  if(this.disposed)return false;
  const h=this.behavior.settings,c=this.config;
  if(!h.enabled){this.headRoot.quaternion.identity();this.headRoot.updateMatrixWorld(true);this.finalFrame=null;this.state.driver='ET03 legacy';return super.update(dt,instant);}
  if(!Number.isFinite(dt)||dt<0)throw Error('Eye update requires a finite nonnegative delta');
  dt=clamp(dt,0,.1);this.updateCount++;
  this.cut.value=c.enabled?1:0;this.group.visible=c.enabled;
  if(!c.enabled)return false;
  this.time+=dt;
  this.finalFrame=this.behavior.advance(dt,c.autoBlink);const f=this.finalFrame;
  this.scene.updateMatrixWorld(true);this.camera.getWorldPosition(this._cameraWorld);
  this._worldCenter.set(-.004,.069,.065);this.group.localToWorld(this._worldCenter);
  // Resolve only the selected target producer. Locked data is never overwritten.
  if(c.mode==='fixed')this.target.copy(this.lockedTarget);
  else if(c.mode==='pointer'){
   if(this.pointerActive){
    this._forward.copy(this._cameraWorld).sub(this._worldCenter).normalize();
    this._targetCenter.copy(this._worldCenter).addScaledVector(this._forward,.50);
    this._right.setFromMatrixColumn(this.camera.matrixWorld,0);this._up.setFromMatrixColumn(this.camera.matrixWorld,1);
    this.pointerTarget.copy(this._targetCenter).addScaledVector(this._right,this.pointer.x*.22).addScaledVector(this._up,this.pointer.y*.15);
   }
   this.target.copy(this.pointerTarget);
  }else if(c.mode==='relaxed'&&!f.eyeContact){
   this.target.set(-.004+Math.tan(f.yaw*.60)*.62,.069-Math.tan(f.pitch*.60)*.62,.68);
  }else this.target.copy(this._cameraWorld);
  // Head follows slowly; eyes solve residual against the same WORLD target.
  const dx=this.target.x+.004,dy=this.target.y-.069,dz=this.target.z-.065;
  const followYaw=clamp(Math.atan2(dx,Math.max(.08,dz)),-.5,.5)*.55;
  const followPitch=clamp(-Math.atan2(dy,Math.hypot(dx,dz)),-.35,.35)*.35;
  const amount=h.headMotion?h.headAmount:0;
  const pitch=clamp(h.manualPitch+amount*(followPitch+f.head[0]*.7),-.24,.24);
  const yaw=clamp(h.manualYaw+amount*(followYaw+f.head[1]*.6),-.38,.38);
  const roll=clamp(amount*f.head[2]*.5,-.10,.10);
  this._headEuler.set(pitch,yaw,roll,'YXZ');this._headQuaternion.setFromEuler(this._headEuler);
  const headDiff=this.headRoot.quaternion.angleTo(this._headQuaternion);
  this.headRoot.quaternion.slerp(this._headQuaternion,instant?1:1-Math.exp(-dt*5));this.headRoot.updateMatrixWorld(true);
  this._localTarget.copy(this.target);this.group.worldToLocal(this._localTarget);
  this._light.copy(this.key.position).sub(this.key.target.position).normalize();
  this._fillDirection.copy(this.fill.position).sub(this._worldCenter).normalize();
  let changed=headDiff>.00003||instant,lightAmount=0,clampedAny=false;
  for(let i=0;i<this.eyes.length;i++){
   const e=this.eyes[i],v=e.localTarget.copy(this._localTarget).sub(e.pivot.position);
   const trueYaw=Math.atan2(v.x,v.z),truePitch=-Math.atan2(v.y,Math.hypot(v.x,v.z));
   const cy=clamp(trueYaw,-.46,.46),cp=clamp(truePitch,-.28,.30);
   clampedAny=clampedAny||Math.abs(trueYaw-cy)>.001||Math.abs(truePitch-cp)>.001;
   e.rotation.set(cp,cy,0,'YXZ');e.desired.setFromEuler(e.rotation);
   const angle=e.pivot.quaternion.angleTo(e.desired);
   e.pivot.quaternion.slerp(e.desired,instant?1:1-Math.exp(-dt*24));e.pivot.updateMatrixWorld(true);
   e.c.gazePitch=cp;e.c.gazeYaw=cy;
   const closure=c.manualBlink>=0?clamp(c.manualBlink,0,1):f.blink[i];
   const squint=clamp(Math.max(c.squint||0,f.squint[i]*.65),0,1);
   const opening=clamp(c.opening*(1+f.wide[i]*.10),.56,1.15);
   const lidChanged=instant||angle>.00003||Math.abs(closure-this._closed[i])>.00001||Math.abs(squint-this._squint[i])>.00001||Math.abs(opening-this._open[i])>.00001;
   this._closed[i]=closure;this._squint[i]=squint;this._open[i]=opening;
   if(lidChanged){this.updateLid(e,closure);changed=true;}
   e.lid.mesh.material.roughness=this.skin.roughness;e.lid.mesh.material.clearcoat=this.skin.clearcoat;e.lid.mesh.material.clearcoatRoughness=this.skin.clearcoatRoughness;e.lid.mesh.material.envMapIntensity=this.skin.envMapIntensity;
   e.pivot.getWorldQuaternion(this._eyeWorldQuaternion);e.direction.set(0,0,1).applyQuaternion(this._eyeWorldQuaternion);
   e.pivot.getWorldPosition(this._temp);this._temp.subVectors(this.target,this._temp).normalize();
   this.state.lockErrorDegrees[i]=THREE.MathUtils.radToDeg(e.direction.angleTo(this._temp));
   this._inverseEye.copy(this._eyeWorldQuaternion).invert();
   e.uniforms.uEyeCamera.value.copy(this._cameraWorld);e.pivot.worldToLocal(e.uniforms.uEyeCamera.value);
   e.uniforms.uEyeKey.value.copy(this._light).applyQuaternion(this._inverseEye);
   e.uniforms.uEyeFill.value.copy(this._fillDirection).applyQuaternion(this._inverseEye);
   e.uniforms.uIrisDepth.value=c.irisDepth;e.ball.material.clearcoat=c.wetness;e.ball.material.clearcoatRoughness=THREE.MathUtils.lerp(.18,.065,c.wetness);e.ball.material.envMapRotation.copy(this.scene.environmentRotation);
   if(e.contact){e.contact.uEyeToHead.value.setFromMatrix4(this._eyeRotationMatrix.makeRotationFromQuaternion(e.pivot.quaternion));e.contact.uBlink.value=closure;e.contact.uOpening.value=opening;}
   lightAmount=Math.max(lightAmount,Math.max(0,e.direction.dot(this._light))*this.key.intensity+this.fill.intensity*.5);
  }
  const targetPupil=c.autoPupil?clamp(.00285-.00048*lightAmount,.00125,.00285):clamp(c.pupilMM/2000,.001,.0038),pd=targetPupil-this.pupil;
  this.pupil+=pd*(instant?1:1-Math.exp(-dt*(pd<0?9:2.5)));changed=changed||Math.abs(pd)>.0000005;
  for(const e of this.eyes)e.uniforms.uPupil.value=this.pupil/e.c.radius;
  Object.assign(this.state,{mode:c.mode,target:this.target.toArray(),t:this.time,blink:Math.max(...this._closed),blinkRight:this._closed[0],blinkLeft:this._closed[1],pupilMM:this.pupil*2000,clamped:clampedAny,contact:this.eyes.map(e=>e.contactReport),headQuaternion:this.headRoot.quaternion.toArray(),driver:'TalkingHead 1.7.0 / extracted behavior'});
  if(changed)this.requestRender();return changed;
 }
 updateLid(e,blink){
  if(!this.behavior?.settings.enabled||!this.finalFrame)return super.updateLid(e,blink);
  const i=this.eyes.indexOf(e),c=this.config,save=[c.manualBlink,c.squint,c.opening];
  try{c.manualBlink=this._closed[i];c.squint=this._squint[i];c.opening=this._open[i];super.updateLid(e,blink);this.lidUpdateCount++;}
  finally{[c.manualBlink,c.squint,c.opening]=save;}
 }
 snapshot(){return {...super.snapshot(),behavior:{schema:'kaopu/talkinghead-behavior@1',...(this.behavior?.settings||DEFAULT_BEHAVIOR)}};}
 restore(o){
  if(!o)return;
  if(o.schema!=='kaopu/eye-rig@1')throw Error('Unsupported eye recipe');
  if(o.mode&&!['camera','pointer','fixed','relaxed'].includes(o.mode))throw Error('Unsupported gaze mode');
  if(o.fixedTarget&&(!Array.isArray(o.fixedTarget)||o.fixedTarget.length!==3||!o.fixedTarget.every(x=>Number.isFinite(x)&&Math.abs(x)<1000)))throw Error('Invalid world target');
  if(o.behavior){if(o.behavior.schema!=='kaopu/talkinghead-behavior@1')throw Error('Unsupported TalkingHead recipe');if(this.behavior)this.behavior.configure(o.behavior);}
  super.restore(o);this.update(0,true);
 }
 diagnostics(){return {...this.behavior?.diagnostics(),integrationVersion:EYE_VERSION,updateCount:this.updateCount,lidUpdates:this.lidUpdateCount,legacySchedulerActive:!this.behavior?.settings.enabled,finalWriter:'IntegratedEyes',targetSpace:'world / metres',geometrySpace:'original head / metres',controls:{gazeOwner:this.config.mode,blinkOwner:this.config.manualBlink>=0?'manual':'TalkingHead',pupilOwner:this.config.autoPupil?'ET03-light':'manual'},headQuaternion:this.headRoot?.quaternion.toArray(),target:this.target.toArray(),lockErrorDegrees:[...this.state.lockErrorDegrees]};}
 info(){return {...super.info(),integration:this.diagnostics()};}
 dispose(){
  if(this.disposed)return;this.disposed=true;
  if(this.headRoot){this.headRoot.quaternion.identity();this.headRoot.updateMatrixWorld(true);this.scene.attach(this.mesh);if(this.fuzzObject)this.scene.attach(this.fuzzObject);this.scene.attach(this.group);this.headRoot.removeFromParent();}
  if(this.behavior)this.behavior.kernel.animQueue.length=0;super.dispose();
 }
}
