// Integrated in the existing skin application's module scope.
function initializeEyes(){
 eyesRig=new EyeSystem({mesh,skin,scene,camera,canvas:renderer.domElement,pass:U.uPass,layer:U.uLayer,key,fill,rim,requestRender:()=>{dirty=true;entryDirty=true;if(renderer)renderer.shadowMap.needsUpdate=true;}});
 eyesRig.installDepth(entryMaterial,fuzz);
 window.__EYES__={version:EYE_VERSION,info:()=>eyesRig.info(),setMode:mode=>{eyesRig.setMode(mode);syncEyeUI();},setTarget:v=>{eyesRig.setTarget(v);syncEyeUI();},blink:()=>eyesRig.blink(),step:(dt,instant=false)=>{eyesRig.update(dt,instant);dirty=true;},set:v=>{eyesRig.restore({...eyesRig.snapshot(),...v,schema:'kaopu/eye-rig@1'});syncEyeUI();dirty=true;entryDirty=true;renderer.shadowMap.needsUpdate=true;},snapshot:()=>eyesRig.snapshot(),restore:v=>{eyesRig.restore(v);syncEyeUI();},sourceGeometry:()=>({uuid:mesh.geometry.uuid,vertices:mesh.geometry.attributes.position.count,triangles:mesh.geometry.index.count/3})};
 syncEyeUI();
}
function syncEyeUI(){if(!eyesRig)return;const c=eyesRig.config;$('eyeMode').value=c.mode;$('eyeIris').value=c.iris;
 for(let id of ['enabled','autoBlink','autoPupil'])$('eye-'+id).checked=c[id];
 for(let id of ['pupilMM','wetness','opening','irisDepth']){$('eye-'+id).value=c[id];$('eye-'+id+'Out').textContent=id==='pupilMM'?c[id].toFixed(1)+' mm':c[id].toFixed(2);}
 $('eye-pupilMM').disabled=c.autoPupil;$('eyeModeStatus').textContent={camera:'双眼注视镜头',pointer:'双眼跟随指针',fixed:'空间目标已锁定',relaxed:'轻微自主观察'}[c.mode];
 document.querySelectorAll('[data-eye-mode]').forEach(b=>b.classList.toggle('active',b.dataset.eyeMode===c.mode));
}
function restoreEyes(recipe){if(eyesRig&&recipe){eyesRig.restore(recipe);syncEyeUI();}}
for(const b of document.querySelectorAll('[data-eye-mode]'))b.onclick=()=>{if(eyesRig){eyesRig.setMode(b.dataset.eyeMode);syncEyeUI();}};
$('eyeMode').onchange=()=>{if(eyesRig){eyesRig.setMode($('eyeMode').value);syncEyeUI();}};
$('eyeIris').onchange=()=>{if(eyesRig)eyesRig.setPalette($('eyeIris').value);};
$('blinkEye').onclick=()=>eyesRig?.blink();
$('lockEye').onclick=()=>{if(eyesRig){eyesRig.lock();syncEyeUI();toast('双眼已锁定同一个空间目标');}};
for(let id of ['enabled','autoBlink','autoPupil'])$('eye-'+id).onchange=()=>{if(!eyesRig)return;eyesRig.config[id]=$('eye-'+id).checked;eyesRig.update(0,true);syncEyeUI();entryDirty=true;renderer.shadowMap.needsUpdate=true;dirty=true;};
for(let id of ['pupilMM','wetness','opening','irisDepth'])$('eye-'+id).oninput=()=>{if(!eyesRig)return;const el=$('eye-'+id);eyesRig.config[id]=Math.max(+el.min,Math.min(+el.max,+el.value));eyesRig.update(0,true);syncEyeUI();dirty=true;renderer.shadowMap.needsUpdate=true;};
const resetBeforeEyes=$('reset').onclick;$('reset').onclick=()=>{resetBeforeEyes();if(eyesRig){eyesRig.restore({schema:'kaopu/eye-rig@1',enabled:true,mode:'camera',autoBlink:true,autoPupil:true,pupilMM:3.4,iris:'blue',wetness:.82,irisDepth:.83,opening:.94,fixedTarget:[0,.069,.65]});syncEyeUI();}};
