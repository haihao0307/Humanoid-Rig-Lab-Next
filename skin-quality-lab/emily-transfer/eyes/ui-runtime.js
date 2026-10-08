// Same workbench; eye controls are added without replacing skin controls.
function initEyes(){
 eyes=new EyeRig({scene,mesh,skin,fuzz,pass:U.uPass,camera,controls,viewport,key,fill,rim,depthMaterial:entryMaterial,onDirty:()=>dirty=true,onPose:()=>{entryDirty=true;renderer.shadowMap.needsUpdate=true;}});
 U.uHeadToWorld.value=eyes.root.matrixWorld;
 window.__EYES__={config:eyes.config,pose:()=>eyes.poseInfo(),set:o=>{eyes.set(o);eyeUI();},setTarget:p=>{eyes.setTarget(p);eyeUI();},lock:()=>{eyes.lock();eyeUI();},advance:dt=>{eyes.update(dt);dirty=true;},step:dt=>{eyes.update(dt,true);dirty=true;},blink:()=>eyes.blink(),fit:FIT,version:EYE_VERSION};
 const renderOriginal=window.__SKIN_LAB__?.render;
 for(const b of document.querySelectorAll('[data-gaze]'))b.onclick=()=>{if(b.dataset.gaze==='locked')eyes.lock();else eyes.set({mode:b.dataset.gaze});eyeUI();};
 for(const id of ['autoBlink','autoPupil','headFollow'])document.getElementById('eye-'+id).onchange=e=>{eyes.set({[id]:e.target.checked});eyeUI();};
 for(const id of ['headYaw','headPitch','pupil','wet','refraction','caustic','openness'])document.getElementById('eye-'+id).oninput=e=>{eyes.set({[id]:+e.target.value});eyeUI();};
 $('eye-iris').onchange=e=>eyes.set({iris:e.target.value});$('eye-blink').onclick=()=>eyes.blink();
 $('eye-original').onchange=e=>eyes.set({enabled:!e.target.checked});
 $('eye-reset').onclick=()=>{eyes.set({enabled:true,mode:'camera',autoBlink:false,autoPupil:true,headFollow:false,headYaw:0,headPitch:0,iris:'blue',pupil:.32,wet:.92,refraction:1,caustic:.7,openness:1});eyes.pointer.set(0,0);eyeUI();setCamera('portrait');};
 eyeUI();
}
function eyeUI(){if(!eyes)return;for(const b of document.querySelectorAll('[data-gaze]')){b.classList.toggle('active',b.dataset.gaze===eyes.config.mode);b.setAttribute('aria-pressed',String(b.dataset.gaze===eyes.config.mode));}
 for(const id of ['autoBlink','autoPupil','headFollow'])$('eye-'+id).checked=eyes.config[id];
 for(const id of ['headYaw','headPitch','pupil','wet','refraction','caustic','openness']){const el=$('eye-'+id);el.value=eyes.config[id];$('eye-'+id+'Out').textContent=id.includes('head')?Number(eyes.config[id]).toFixed(0)+'°':Number(eyes.config[id]).toFixed(2);}
 $('eye-original').checked=!eyes.config.enabled;$('eye-iris').value=eyes.config.iris;
 $('eye-pupil').disabled=eyes.config.autoPupil;$('eyeStatus').textContent={camera:'双眼看向镜头',pointer:'双眼跟随鼠标',locked:'锁定世界空间目标'}[eyes.config.mode];
}
