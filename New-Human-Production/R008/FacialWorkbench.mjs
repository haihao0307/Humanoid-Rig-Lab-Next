import * as THREE from 'three';
import {FACE_REGIONS,faceMask} from './FacialBinding.mjs';
import {SHAPE_REGIONS} from './FacePartition.mjs';
import {createFacePartitionWorkbench} from './FacePartitionWorkbench.mjs';
import {createFaceIdentityWorkbench} from './FaceIdentityWorkbench.mjs';
export function createFacialWorkbench({getSubject,actor,camera,scene,frameView,lockView,enter,exit}){
 const $=id=>document.getElementById(id);let active=false,angle=0,markers=null,lastPull=null,lastFocus=null,shapeEditor,identityEditor,savedFov=camera.fov;
 const frontLabel=document.createElement('label');frontLabel.innerHTML='<input id="faceFrontLock" type="checkbox" checked> 固定正面比较（锁定镜头）';$('faceControls').prepend(frontLabel);
 const layer=document.createElement('label');layer.innerHTML='面部工作模式<select id="faceLayer"><option value="identity">五官数据 · 身份与比例</option><option value="shape" selected>局部脸型 · 57 区</option><option value="expression">表情影响 · 46 区</option></select>';$('faceControls').prepend(layer);
 const shapeMode=()=>$('faceLayer').value==='shape',identityMode=()=>$('faceLayer').value==='identity',regions=()=>identityMode()?[]:shapeMode()?SHAPE_REGIONS:FACE_REGIONS;
 function populate(){const sel=$('faceRegion');sel.replaceChildren();const all=document.createElement('option');all.value='all';all.textContent='全部区域 · 最大权重分区';sel.append(all);for(const r of regions()){const o=document.createElement('option');o.value=r.id;o.textContent=r.label;sel.append(o);}}populate();
 const color=new THREE.Color(),palette=Array.from({length:SHAPE_REGIONS.length},(_,i)=>new THREE.Color().setHSL((i*.618034)%1,.73,.46));
 function clearMarkers(){if(markers){actor.remove(markers);markers.geometry.dispose();markers.material.dispose();markers=null;}}
 function updateMarkers(){clearMarkers();if(!active||!$('faceLandmarks').checked)return;const selected=$('faceRegion').value,chosen=selected==='all'?regions():regions().filter(r=>r.id===selected),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(chosen.flatMap(r=>getSubject()?.identity?getSubject().identity.transform(r.centre):r.centre),3));markers=new THREE.Points(g,new THREE.PointsMaterial({color:'#fcf6cf',size:.0035,sizeAttenuation:true,depthTest:false}));markers.renderOrder=30;actor.add(markers);}
 function display(){
  const s=getSubject();if(!s)return;const a=s.mesh.geometry.attributes.faceInspection,rows=s.face.rows,selectedIndex=regions().findIndex(r=>r.id===$('faceRegion').value),selected=selectedIndex<0?undefined:selectedIndex,mode=$('faceView').value;
  a.array.fill(0);if(active&&!identityMode()&&mode!=='skin')for(let k=0;k<rows.vertices.length;k++){
   let max=0,winner=-1,chosen=0;const row=shapeMode()?s.face.partition.rows[k]:Array.from({length:rows.offsets[k+1]-rows.offsets[k]},(_,j)=>{const q=rows.offsets[k]+j;return [rows.ids[q],rows.weights[q]];});
   for(const [id,w]of row){if(w>max){max=w;winner=id;}if(id===selected)chosen=w;}
   if(selected===undefined){if(winner<0)color.setRGB(.026,.045,.062);else color.copy(palette[winner]);}else{const w=Math.min(1,chosen);color.setRGB(.016,.031,.056);if(w>0)color.setHSL((1-w)*.64,.86,.24+.3*Math.sqrt(w));}
   const i=rows.vertices[k];a.setXYZW(i,color.r,color.g,color.b,.88*faceMask(Array.from(s.surface.positions.subarray(i*3,i*3+3))));
  }a.needsUpdate=true;updateMarkers();
 }
 function updateDescription(){if(active)document.querySelector('h1').textContent=identityMode()?'面部 · 数据与复刻':'面部 · 分区与数值';const s=getSubject(),r=regions().find(r=>r.id===$('faceRegion').value),t=(shapeMode()?s?.face.partition.stats:s?.face.report.channels)?.find(c=>c.id===r?.id),allowed=!shapeMode()&&!!r&&r.kind==='skin';$('facePull').disabled=!active||!allowed;$('facePull').value=0;$('facePullValue').textContent='0%';if(active)s?.face.reset();lastPull=null;
  for(const id of ['faceRegion','faceView','faceLandmarks'])$(id).parentElement.hidden=identityMode();identityEditor?.setVisible(active&&identityMode());
  if(shapeEditor){$('faceShapeEditor').hidden=!shapeMode();shapeEditor.setVisible(active&&shapeMode());shapeEditor.selection(shapeMode()?$('faceRegion').value:'all');}
  $('facePull').parentElement.hidden=$('faceNeutral').hidden=shapeMode()||identityMode();if($('faceExpressionNote'))$('faceExpressionNote').hidden=shapeMode()||identityMode();
  if(identityMode()){document.querySelector('h1').textContent=active?'面部 · 数据与复刻':'人物 · 自由移动';$('faceDescription').textContent='固定正面 · 五官与轮廓数据可调整；参考图通过可见标志点和比例拟合。';display();return;}
  if(shapeMode()){$('faceDescription').textContent=r?`权重 0–1 · 峰值 ${t.peak.toFixed(3)} · 全面采样均值 ${t.mean.toFixed(4)} · 覆盖 ${t.samples.toLocaleString()} 点${r.locked?' · 眼周结构保护':''}`:'57 个脸型区域。颜色表示最大权重归属；单区显示蓝→红的权重衰减，蓝色接近 0，红色接近 1。原脸位移初值为 0 mm。';display();return;}
  $('faceDescription').textContent=r?`${r.actions.join(' / ')} · 权重 > 1% 的采样点 ${t.samples.toLocaleString()} · 峰值 ${t.peak.toFixed(3)}。${allowed?'可做最多 1.5 mm 的区域牵拉验证。':r.kind==='jaw'?'下颌控制预留；口腔内部结构尚未分离。':'此区已采样；独立眼球和眼睑已接入，动作请使用表情面板测试。'}`:'46 个连续影响区，左右独立、区域重叠。颜色显示当前最大权重；单选可查看该区完整衰减场。';display();
 }
 function focus(force=false){if(!active||(!force&&lastFocus===angle))return;const locked=$('faceFrontLock').checked;camera.fov=locked?22:savedFov;camera.updateProjectionMatrix();const scale=actor.scale.y,target=new THREE.Vector3(0,1.645,.055).multiplyScalar(scale).add(actor.position),distance=(locked?.95:.50)*scale,position=target.clone().add(new THREE.Vector3(locked?0:Math.sin(angle)*distance,locked?0:.035*scale,locked?distance:Math.cos(angle)*distance));if(frameView)frameView(target,position);else{camera.position.copy(position);camera.lookAt(target);}camera.updateMatrixWorld(true);lastFocus=angle;}
 function setActive(v){if(active===v)return;active=v;lastFocus=null;document.querySelector('aside').classList.toggle('face-inspecting',v);document.querySelector('h1').textContent=v?'面部 · 分区与数值':'人物 · 自由移动';if(v){savedFov=camera.fov;enter();lockView?.($('faceFrontLock').checked);$('facePanel').open=true;$('faceEnter').textContent='退出面部检查';$('faceControls').hidden=false;$('hint').textContent=$('faceFrontLock').checked?'固定正面 · 画面左＝人物右 / 画面右＝人物左':'面部分区 · 拖动旋转 / 滚轮缩放';focus();}else{lockView?.(false);camera.fov=savedFov;camera.updateProjectionMatrix();getSubject()?.face.reset();exit();$('faceEnter').textContent='检查面部权重';$('faceControls').hidden=true;clearMarkers();$('hint').textContent='WASD 移动 · Shift 奔跑 · 空格跳跃 · 拖动旋转 · 滚轮缩放';}updateDescription();}
 shapeEditor=createFacePartitionWorkbench({getSubject,display,selectRegion(id){if(!active)setActive(true);$('faceLayer').value='shape';populate();$('faceRegion').value=id;$('faceView').value='weights';updateDescription();}});
 $('faceLayer').onchange=()=>{populate();updateDescription();};$('faceEnter').onclick=()=>setActive(!active);$('faceRegion').onchange=updateDescription;$('faceView').onchange=display;$('faceLandmarks').onchange=updateMarkers;
 $('facePull').oninput=()=>{const s=getSubject(),amount=Number($('facePull').value);lastPull=s.face.deform($('faceRegion').value,amount);$('facePullValue').textContent=Math.round(amount*100)+'%';};
 $('faceNeutral').onclick=()=>{getSubject()?.face.reset();$('facePull').value=0;$('facePullValue').textContent='0%';lastPull=null;};
 function frontLock(v){$('faceFrontLock').checked=v;lockView?.(active&&v);if(v)angle=0;lastFocus=null;focus(true);$('hint').textContent=v?'固定正面 · 画面左＝人物右 / 画面右＝人物左 · FOV 22°':'自由观察 · 拖动旋转 / 滚轮缩放';}
 $('faceFrontLock').onchange=()=>frontLock($('faceFrontLock').checked);$('faceFront').onclick=()=>frontLock(true);$('faceLeft').onclick=()=>{frontLock(false);angle=.75;focus(true)};$('faceRight').onclick=()=>{frontLock(false);angle=-.75;focus(true)};
 function openIdentity(){if(!active)setActive(true);$('faceLayer').value='identity';populate();$('faceView').value='skin';frontLock(true);updateDescription();}
 identityEditor=createFaceIdentityWorkbench({getSubject,actor,ensureFront:openIdentity});
 function refresh(){shapeEditor?.refresh();identityEditor?.refresh();const s=getSubject();$('faceCount').textContent=`身份参数 / 57 局部脸型区 / ${s.face.report.regions} 表情区 · ${s.face.report.sampledVertices.toLocaleString()} 面部点`;updateDescription();}
 refresh();return {identity:identityEditor,openIdentity,shape:shapeEditor,setActive,focus,refresh,display,get frontLocked(){return active&&$('faceFrontLock').checked},get active(){return active},get lastPull(){return lastPull},dispose(){setActive(false);clearMarkers();identityEditor?.dispose()}};
}

