// Inlined after the animal runtime. Primary drags operate on its actual camera.
globalThis.AtlasStudioAdapter=function(context,range,check,select){
 const S=AtlasTurntable,T=S.T,kind=context.adapter,clamp=v=>Math.max(-1.48,Math.min(1.48,v));
 let stage,rotate=()=>{},render=()=>{},resetView=()=>{},zoom;
 const sceneInstall=(n,roots,options)=>{n.renderer.shadowMap.enabled=true;return S.installScene(n.T||window.__ATLAS_THREE||T,n.scene,n.renderer,n.camera,roots,options);};
 function turnCamera(camera,target,yaw,elevation){
  stage?.restoreCamera?.(camera);
  const q=new T.Quaternion().setFromUnitVectors(camera.up.clone().normalize(),new T.Vector3(0,1,0));
  const spherical=new T.Spherical().setFromVector3(camera.position.clone().sub(target).applyQuaternion(q));
  spherical.theta+=yaw;spherical.phi=Math.max(.06,Math.min(Math.PI-.06,spherical.phi-elevation));
  camera.position.setFromSpherical(spherical).applyQuaternion(q.invert()).add(target);camera.lookAt(target);camera.updateMatrixWorld(true);
 }
 if(kind==='native'||kind==='imported'){
  const n=kind==='native'?__ATLAS_NATIVE:__ATLAS_IMPORTED;stage=sceneInstall(n,()=>n.meshes());
  rotate=(yaw,elevation=0)=>n.orbit(yaw,elevation);render=()=>n.renderer.render(n.scene,n.camera);
 }else if(kind==='life'){
  const n=__LIFE_VISUAL;stage=sceneInstall(n,()=>[n.animal.root]);render=()=>n.render();
  rotate=(yaw,elevation=0)=>{
   if(context.life==='shark'){
    const lab=SHARK_LAB;if(!['free','follow'].includes(lab.director.mode))lab.director.select('free',false);
    turnCamera(lab.camera,lab.controls.target,yaw,elevation);lab.controls.update();
   }else if(context.life==='bird'){
    const c=__birdLab.cameraState();__birdLab.setView({theta:c.theta+yaw,phi:Math.max(.06,Math.min(Math.PI-.06,c.phi-elevation))});
   }else{const c=window.__LIFE_VISUAL_SOURCE?.camera?.();if(c&&typeof c.yaw==='number'){c.yaw+=yaw;c.pitch=clamp(c.pitch+elevation);}}
  };
 }else if(kind==='palau'){
  const n=birdWorkbench.getStages().find(n=>n.id===context.key);stage=sceneInstall(n,()=>[n.rig.group],{zUp:true});
  let yaw=0,elevation=0,distance=1;const before=n.scene.onBeforeRender;
  // cameraAt() resets this camera each draw; apply persistent offsets afterwards.
  n.scene.onBeforeRender=function(r,s,c,...args){before.call(this,r,s,c,...args);if(yaw||elevation||distance!==1){
   const center=new T.Box3().setFromObject(n.rig.group).getCenter(new T.Vector3()),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(0,1,0));
   const spherical=new T.Spherical().setFromVector3(c.position.clone().sub(center).applyQuaternion(q));
   spherical.theta+=yaw;spherical.phi=Math.max(.06,Math.min(Math.PI-.06,spherical.phi-elevation));spherical.radius*=distance;
   c.position.setFromSpherical(spherical).applyQuaternion(q.invert()).add(center);c.lookAt(center);c.updateMatrixWorld(true);
  }};
  rotate=(a,b=0)=>{yaw+=a;elevation=clamp(elevation+b);};zoom=delta=>distance=Math.max(.35,Math.min(3,distance*Math.exp(delta*.001)));
  resetView=()=>{yaw=elevation=0;distance=1;};render=()=>birdWorkbench.setTime(birdWorkbench.getState().time);
 }else if(kind==='crab'){
  const n=__CRAB_QA__,index=context.key==='coconut'?1:0;
  for(const [i,scene]of n.scenes.entries())sceneInstall({scene,renderer:n.renderer,camera:n.cameras[i]},()=>[n.meshes[i]]);
  stage=sceneInstall({scene:n.beach.scene,renderer:n.renderer,camera:n.beachCamera},()=>[n.meshes[index]]);if(S.isActive())n.stage('lab');
  rotate=(yaw,elevation=0)=>{n.state.yaw+=yaw;n.state.pitch=clamp(n.state.pitch+elevation);};
  render=()=>n.renderer.render(n.state.stage==='beach'?n.beach.scene:n.scenes[index],n.state.stage==='beach'?n.beachCamera:n.cameras[index]);
 }else if(kind==='chicken'){
  const n=__ATLAS_CHICKEN_STAGE,center=()=>{const box=new T.Box3();for(const root of __ATLAS_CHICKEN_MESHES())box.union(new T.Box3().setFromObject(root));return box.getCenter(new T.Vector3());};
  stage=sceneInstall(n,()=>__ATLAS_CHICKEN_MESHES());rotate=(yaw,elevation=0)=>turnCamera(n.camera,center(),yaw,elevation);
  zoom=delta=>{stage.restoreCamera?.(n.camera);const target=center();n.camera.position.sub(target).multiplyScalar(Math.exp(Math.max(-200,Math.min(200,delta))*.001)).add(target);n.camera.updateMatrixWorld(true);};
  render=()=>n.renderer.render(n.scene,n.camera);
 }else if(kind==='fish')rotate=(yaw,elevation=0)=>{const c=__KAOPU_R13__.renderer.camera;c.yaw+=yaw;c.pitch=clamp(c.pitch+elevation);c.upMode='Y';};
 else if(kind==='cat')rotate=(yaw,elevation=0)=>__ATLAS_CAT_ORBIT(yaw,elevation);
 else if(kind==='eagle'){rotate=(yaw,elevation=0)=>{eagle.yaw+=yaw;eagle.pitch=clamp(eagle.pitch+elevation);eagle.dirty=true;};render=()=>eagle.render();}

 let interactingUntil=0,drag=null,moves=0,suppressClickUntil=0,forwarding=false;
 const isCanvas=e=>e.target instanceof HTMLCanvasElement&&e.target.clientWidth>1&&e.target.clientHeight>1;
 const hold=()=>interactingUntil=performance.now()+1600;
 addEventListener('pointerdown',e=>{
  if(forwarding||!isCanvas(e))return;hold();if(e.button!==0||e.shiftKey||e.ctrlKey||e.altKey||!e.isPrimary)return;
  drag={id:e.pointerId,canvas:e.target,x:e.clientX,y:e.clientY,moved:false};e.target.setPointerCapture(e.pointerId);
  e.preventDefault();e.stopImmediatePropagation();e.target.style.cursor='grabbing';
 },{capture:true,passive:false});
 addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;hold();const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
  if(dx||dy){drag.moved=true;moves++;rotate(-dx*.006,dy*.006);render();}
  e.preventDefault();e.stopImmediatePropagation();
 },{capture:true,passive:false});
 function release(e){if(!drag||e.pointerId!==drag.id)return;hold();if(drag.moved)suppressClickUntil=performance.now()+300;
  const canvas=drag.canvas,wasMoved=drag.moved;drag=null;canvas.style.cursor='grab';
  // Preserve the source's click/pick action without allowing its drag handler to compete.
  if(!wasMoved&&e.type==='pointerup'){forwarding=true;try{for(const type of ['pointerdown','pointerup'])canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:e.clientX,clientY:e.clientY,pointerId:e.pointerId,pointerType:e.pointerType,isPrimary:true,button:0,buttons:type==='pointerdown'?1:0}));}finally{forwarding=false;}}
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);e.preventDefault();e.stopImmediatePropagation();}
 addEventListener('pointerup',release,{capture:true,passive:false});addEventListener('pointercancel',release,{capture:true,passive:false});
 addEventListener('lostpointercapture',e=>{if(drag&&e.pointerId===drag.id){drag.canvas.style.cursor='grab';drag=null;hold();}},{capture:true});
 addEventListener('blur',()=>{if(drag)drag.canvas.style.cursor='grab';drag=null;hold();});
 addEventListener('click',e=>{if(isCanvas(e)&&performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 addEventListener('wheel',e=>{if(!isCanvas(e))return;hold();if(zoom){zoom(e.deltaY);render();e.preventDefault();e.stopImmediatePropagation();}},{capture:true,passive:false});
 for(const canvas of document.querySelectorAll('canvas'))if(canvas.clientWidth>1){canvas.style.touchAction='none';canvas.style.cursor='grab';}
 function tick(){const delta=S.rotationDelta();if(delta&&!drag&&performance.now()>interactingUntil){rotate(delta);render();}requestAnimationFrame(tick);}requestAnimationFrame(tick);
 window.__ATLAS_STUDIO_INPUT={snapshot:()=>({dragging:!!drag,moves,autoHeld:!!drag||performance.now()<interactingUntil})};
 const controls=AtlasParameterSchema.presentationControls(S.state);
 return{controls,resetView,set(key,value){S.set(key,value);if(key==='displayStage'&&kind==='crab')__CRAB_QA__.stage(value==='turntable'?'lab':'beach');if(kind==='eagle')eagle.dirty=true;render();},info:()=>S.info(),stage};
};
