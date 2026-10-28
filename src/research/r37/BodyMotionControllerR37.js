/* Interactive body-only motion preview. A clip contains evaluated function
 * states; the intermediate surface and display normals are interpolated.
 * Saving is enabled again after the exact paused pose has been evaluated. */
(()=>{'use strict';
const panel=document.querySelector('#body-motion-player'),play=panel.querySelector('#body-motion-play'),pause=panel.querySelector('#body-motion-pause'),kind=panel.querySelector('#body-motion-kind'),speed=panel.querySelector('#body-motion-speed'),status=panel.querySelector('#body-motion-status'),captureStart=panel.querySelector('#body-motion-start'),captureEnd=panel.querySelector('#body-motion-end');
let mode='idle',cancelRequested=false,child=null,clip=null,buffers=null,original=null,controls=null,starts=null,ends=null,raf=0,lastAmount=0,frames=0,firstFrame=0,lastFrame=0,lastFrameMS=0,totalInterpolationMS=0,totalRenderMS=0,failure=null;
let customMotion=null;
const specifications={
 anny:{bend:{'pose.A.upperleg01.L.0':-50,'pose.A.upperleg01.R.0':-50,'pose.A.lowerleg01.L.0':65,'pose.A.lowerleg01.R.0':65,'pose.A.spine03.0':12},reach:{'pose.A.upperarm01.L.1':-60,'pose.A.upperarm01.R.1':60},arms:{'pose.A.lowerarm01.L.0':-65,'pose.A.lowerarm01.R.0':-65},twist:{'pose.A.spine03.2':22,'pose.A.spine01.2':10},trunk:{'pose.A.root.0':2.125,'pose.A.root.1':-1.375,'pose.A.root.2':4.625,'pose.A.spine05.0':7.875,'pose.A.spine05.1':3.625,'pose.A.spine05.2':-2.125,'pose.A.spine03.0':-11.375,'pose.A.spine03.1':7.125,'pose.A.spine03.2':4.875,'pose.A.spine01.0':5.625,'pose.A.spine01.1':-3.875,'pose.A.spine01.2':1.125}},
 mhr:{bend:{'pose.B.52':-.7,'pose.B.61':-.7,'pose.B.53':1.1,'pose.B.62':1.1,'pose.B.11':.25},reach:{'pose.B.35':.85,'pose.B.45':.85},arms:{'pose.B.36':1.05,'pose.B.46':1.05},twist:{'pose.B.7':.22,'pose.B.13':.28},trunk:{'pose.B.7':.22,'pose.B.13':.28,'pose.B.11':.25}}
};
// Both hands use the same existing body joints and stay within each rig's
// supported range. This is a gesture preview, not the legacy hand envelope.
specifications.anny.hands=Object.fromEntries(['L','R'].flatMap(side=>[1,2,3,4,5].flatMap(digit=>[1,2,3].map(j=>['pose.A.finger'+digit+'-'+j+'.'+side+'.0',digit===1?[20,30,20][j-1]:[50,55,35][j-1]]))));
specifications.mhr.hands=Object.fromEntries([72,73,74,79,80,81,82,83,84,85,86,87,88,89,90,99,100,101,106,107,108,109,110,111,112,113,114,115,116,117].map((i,j)=>['pose.B.'+i,j%3===0?.55:j%3===1?.8:.6]));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function ready(){const started=performance.now();for(;;){const r=window.bodyImplicitR02?.report();if(r?.ready&&!r.busy){if(r.lastError)throw Error(r.lastError);return r;}if(performance.now()-started>180000)throw Error('身体更新超时，原人物已保留');await wait(50);}}
async function rendererReady(renderer){const started=performance.now();while(!renderer.report().ready){if(performance.now()-started>30000)throw Error('三维画面尚未恢复，播放前的人物数据仍保留');await wait(100);}}
function atPath(o,path){return path.reduce((v,k)=>v?.[k],o);}
function setPath(o,path,value){for(let i=0;i<path.length-1;i++){const k=path[i],next=path[i+1];if(o[k]===undefined)o[k]=typeof next==='number'?[0,0,0]:{};o=o[k];}o[path.at(-1)]=value;}
function lock(value){document.body.classList.toggle('body-motion-active-r37',value);window.__BODY_ANIMATION_ACTIVE_R37__=value;kind.disabled=value;speed.disabled=value;play.disabled=value;captureStart.disabled=value;captureEnd.disabled=value;pause.disabled=!value;}
function values(amount){return Object.fromEntries(Object.keys(starts).map(k=>[k,starts[k]+(ends[k]-starts[k])*amount]));}
function stateAt(amount){const state=structuredClone(original.person.state),set=values(amount);for(const [id,v]of Object.entries(set))setPath(state,controls[id].path,v);return state;}
function capture(which){if(mode!=='idle'||window.bodyImplicitR02?.report().busy||!window.bodyImplicitR02?.report().ready)throw Error('请等待身体更新完成');const state=window.bodyImplicitR02.state(),rig=state.owners.rig,entries=window.bodyControlR17.describe().controls.filter(c=>rig==='anny'?c.group==='anny.pose'||c.group==='anny.translations':c.group==='mhr.pose'),pose={};for(const c of entries){const v=atPath(state,c.path)??0;if(typeof v!=='number'||!Number.isFinite(v))throw Error('人物姿势数据无效');if(v!==0)pose[c.id]=v;}if(!customMotion||customMotion.schema!=='body-motion-clip-r37/1')customMotion={schema:'body-motion-clip-r37/1',start:null,end:null};customMotion[which]={rig,values:pose};kind.value='custom';status.textContent='已记录'+(which==='start'?'起始':'结束')+'姿势（'+(rig==='anny'?'A':'B')+' 骨架）；'+(customMotion.start&&customMotion.end?'可选择自定义动作播放。':'请调整姿势后记录另一端。');}
function customSpecification(rig){if(customMotion?.schema!=='body-motion-clip-r37/1'||!customMotion.start||!customMotion.end)throw Error('请先记录起始和结束姿势');if(customMotion.start.rig!==rig||customMotion.end.rig!==rig)throw Error('起始和结束姿势须与当前骨架一致');const a=customMotion.start.values,b=customMotion.end.values;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)||Array.isArray(b))throw Error('自定义姿势数据无效');const keys=new Set([...Object.keys(a),...Object.keys(b)]);if(keys.size>700)throw Error('自定义姿势数据过多');starts={};ends={};for(const id of keys){const c=controls[id],x=a[id]??0,y=b[id]??0,validGroup=rig==='anny'?c?.group==='anny.pose'||c?.group==='anny.translations':c?.group==='mhr.pose';if(!validGroup||![x,y].every(v=>typeof v==='number'&&Number.isFinite(v)&&(!c.bounds||v>=c.bounds[0]&&v<=c.bounds[1])))throw Error('自定义姿势含有不支持的身体控制：'+id);if(Math.abs(x-y)>1e-9){starts[id]=x;ends[id]=y;}}if(!Object.keys(starts).length)throw Error('起始和结束姿势相同，请重新记录');}
function report(){return{mode,frames,firstFrame,lastFrame,lastFrameMS,averageInterpolationMS:frames?totalInterpolationMS/frames:0,averageRenderMS:frames?totalRenderMS/frames:0,elapsedMS:Math.max(0,lastFrame-firstFrame),measuredFPS:lastFrame>firstFrame?(frames-1)*1000/(lastFrame-firstFrame):0,amount:lastAmount,samples:clip?.frames.length||0,interpolatedPreview:mode==='playing',exactPoseAfterPause:mode==='idle',error:failure};}
function reset(message){mode='idle';lock(false);clip=null;buffers=null;child=null;original=null;controls=starts=ends=null;cancelRequested=false;status.textContent=message||'选择动作后播放；暂停会保留当前姿势并更新细节。';}
async function playMotion(){
 if(mode!=='idle')throw Error('当前动作仍在处理');failure=null;frames=0;firstFrame=lastFrame=lastFrameMS=lastAmount=totalInterpolationMS=totalRenderMS=0;cancelRequested=false;mode='preparing';
 try{
  const initial=await ready();if(initial.renderer.activeSurface==='continuous')throw Error('当前人物状态暂不支持动作播放，人物未改变');original=window.bodyImplicitR02.archive();const state=original.person.state,spec=specifications[state.owners.rig]?.[kind.value];if(kind.value!=='custom'&&!spec)throw Error('当前骨架暂不支持这个动作');
  controls=Object.fromEntries(window.bodyControlR17.describe().controls.map(c=>[c.id,c]));if(kind.value==='custom')customSpecification(state.owners.rig);else{starts={};ends={};for(const[id,target]of Object.entries(spec)){const c=controls[id],v=c?(atPath(state,c.path)??0):NaN;if(!c||!Number.isFinite(v))throw Error('动作控制不可用：'+id);starts[id]=v;ends[id]=Math.max(c.bounds?.[0]??-Infinity,Math.min(c.bounds?.[1]??Infinity,target));}
  if(Object.keys(starts).every(k=>Math.abs(starts[k]-ends[k])<1e-9))for(const k of Object.keys(ends))ends[k]=0;}
  lock(true);status.textContent='正在准备当前人物的连续动作…';
  if(initial.renderer.activeSurface!=='dynamic-body-p1'){window.bodyImplicitR02.prepareDynamic();await ready();}if(cancelRequested){reset('动作准备已取消，人物未改变。');return;}
  const frame=document.querySelector('#body-dynamic-embedded-p1'),w=frame?.contentWindow;child=w?.torsoStudyP1;if(!child||!w.BodyAnimationClipR37)throw Error('当前身体的动作功能不可用');
  const states=Array.from({length:9},(_,i)=>stateAt(i/8)),prepared=await child.prepareMotion(states,(done,total)=>{status.textContent='正在准备连续动作 '+done+'/'+total+'…';});
  if(cancelRequested){reset('动作准备已取消，人物未改变。');return;}
  clip=prepared.clip;buffers=[w.BodyAnimationClipR37.makeBuffers(clip,prepared.sourceMaterial),w.BodyAnimationClipR37.makeBuffers(clip,prepared.sourceMaterial)];mode='playing';status.textContent='播放中为轻量预览；暂停后保留当前姿势并更新完整细节和阴影。';let start=performance.now();
  function draw(now){if(mode!=='playing')return;try{const t=performance.now(),duration=Number(speed.value)*1000,amount=(1-Math.cos(2*Math.PI*(now-start)/duration))/2,out=buffers[frames%2];w.BodyAnimationClipR37.update(clip,amount,out);const t1=performance.now();child.renderer.setMotionFrameR37(out);child.setPreviewAttachment(out.bindingSupport);window.__BODY_ATTACHMENT_CHANGED_R37__?.();const t2=performance.now();totalInterpolationMS+=t1-t;totalRenderMS+=t2-t1;lastAmount=amount;frames++;if(!firstFrame)firstFrame=now;lastFrame=now;lastFrameMS=t2-t;raf=requestAnimationFrame(draw);}catch(e){failure=e.message;stopMotion().catch(()=>{});}}
  raf=requestAnimationFrame(draw);
 }catch(e){if(e.cancelled||cancelRequested){reset('动作准备已取消，人物未改变。');return;}failure=e.message;reset('动作未能播放：'+e.message);}
}
async function stopMotion(){
 if(mode==='idle'||mode==='finishing')return;if(mode==='preparing'){cancelRequested=true;status.textContent='正在取消动作准备…';child?.cancelMotion();return;}
 mode='finishing';cancelAnimationFrame(raf);child?.renderer.endMotionPreviewR37();window.__BODY_ANIMATION_ACTIVE_R37__=false;pause.disabled=true;status.textContent='正在保留当前姿势并更新细节…';
 try{await rendererReady(child.renderer);const operation=window.bodyControlR17.apply({set:values(lastAmount),label:'暂停连续动作'});if(!operation.changed)window.bodyImplicitR02.prepareDynamic();await ready();reset(failure?'播放已停止：'+failure:'已暂停，当前姿势和完整人物可保存。');}
 catch(e){failure=e.message;try{await ready();window.bodyImplicitR02.restore(original);await ready();reset('动作更新失败，已恢复播放前人物。');}catch{reset('动作更新失败，请使用保存的原人物档案恢复。');}}
}
play.addEventListener('click',()=>playMotion().catch(e=>{failure=e.message;reset('动作未能播放：'+e.message);}));pause.addEventListener('click',()=>stopMotion().catch(e=>{failure=e.message;reset(e.message);}));
for(const [button,which] of [[captureStart,'start'],[captureEnd,'end']])button.addEventListener('click',()=>{try{capture(which);}catch(e){status.textContent=e.message;}});
setInterval(()=>{if(mode==='idle'){const r=window.bodyImplicitR02?.report(),disabled=!r?.ready||r.busy;play.disabled=disabled;captureStart.disabled=disabled;captureEnd.disabled=disabled;}},300);
window.bodyMotionR37={play:playMotion,pause:stopMotion,report,capture,serialize:()=>structuredClone(customMotion),restore(value){customMotion=value==null?null:structuredClone(value);}};
})();
