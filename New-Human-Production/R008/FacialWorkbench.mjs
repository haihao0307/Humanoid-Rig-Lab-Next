import * as THREE from 'three';
import {FACE_REGIONS,faceMask} from './FacialBinding.mjs';
export function createFacialWorkbench({getSubject,actor,camera,scene,frameView,enter,exit}){
 const $=id=>document.getElementById(id);let active=false,angle=0,markers=null,lastPull=null,lastFocus=null;
 for(const r of FACE_REGIONS){const o=document.createElement('option');o.value=r.id;o.textContent=r.label;$('faceRegion').append(o);}
 const color=new THREE.Color(),palette=FACE_REGIONS.map((r,i)=>new THREE.Color().setHSL((i*.618034)%1,.73,.46)),indexById=new Map(FACE_REGIONS.map((r,i)=>[r.id,i]));
 function clearMarkers(){if(markers){actor.remove(markers);markers.geometry.dispose();markers.material.dispose();markers=null;}}
 function updateMarkers(){clearMarkers();if(!active||!$('faceLandmarks').checked)return;const selected=$('faceRegion').value,regions=selected==='all'?FACE_REGIONS:FACE_REGIONS.filter(r=>r.id===selected),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(regions.flatMap(r=>r.centre),3));markers=new THREE.Points(g,new THREE.PointsMaterial({color:'#fcf6cf',size:.0035,sizeAttenuation:true,depthTest:false}));markers.renderOrder=30;actor.add(markers);}
 function display(){
  const s=getSubject();if(!s)return;const a=s.mesh.geometry.attributes.faceInspection,rows=s.face.rows,selected=indexById.get($('faceRegion').value),mode=$('faceView').value;
  a.array.fill(0);if(active&&mode!=='skin')for(let k=0;k<rows.vertices.length;k++){
   let max=0,winner=-1,chosen=0;for(let q=rows.offsets[k];q<rows.offsets[k+1];q++){const w=rows.weights[q],id=rows.ids[q];if(w>max){max=w;winner=id;}if(id===selected)chosen=w;}
   if(selected===undefined){if(winner<0)color.setRGB(.026,.045,.062);else color.copy(palette[winner]);}else{const w=Math.min(1,chosen);color.setRGB(.016,.031,.056);if(w>0)color.setHSL((1-w)*.64,.86,.24+.3*Math.sqrt(w));}
   const i=rows.vertices[k];a.setXYZW(i,color.r,color.g,color.b,.68*faceMask(Array.from(s.surface.positions.subarray(i*3,i*3+3))));
  }a.needsUpdate=true;updateMarkers();
 }
 function updateDescription(){const s=getSubject(),r=FACE_REGIONS.find(r=>r.id===$('faceRegion').value),t=s?.face.report.channels.find(c=>c.id===r?.id),allowed=!!r&&r.kind==='skin';$('facePull').disabled=!active||!allowed;$('facePull').value=0;$('facePullValue').textContent='0%';if(active)s?.face.reset();lastPull=null;
  $('faceDescription').textContent=r?`${r.actions.join(' / ')} · 权重 > 1% 的采样点 ${t.samples.toLocaleString()} · 峰值 ${t.peak.toFixed(3)}。${allowed?'可做最多 1.5 mm 的区域牵拉验证。':r.kind==='jaw'?'下颌控制预留；口腔内部结构尚未分离。':'此区已采样；独立眼球和眼睑已接入，动作请使用表情面板测试。'}`:'46 个连续影响区，左右独立、区域重叠。颜色显示当前最大权重；单选可查看该区完整衰减场。';display();
 }
 function focus(force=false){if(!active||(!force&&lastFocus===angle))return;const scale=actor.scale.y,target=new THREE.Vector3(0,1.655,.055).multiplyScalar(scale).add(actor.position),distance=.64*scale,position=target.clone().add(new THREE.Vector3(Math.sin(angle)*distance,.035*scale,Math.cos(angle)*distance));if(frameView)frameView(target,position);else{camera.position.copy(position);camera.lookAt(target);}camera.updateMatrixWorld(true);lastFocus=angle;}
 function setActive(v){if(active===v)return;active=v;lastFocus=null;document.querySelector('aside').classList.toggle('face-inspecting',v);document.querySelector('h1').textContent=v?'面部 · 权重检查':'人物 · 自由移动';if(v){enter();$('facePanel').open=true;$('faceEnter').textContent='退出面部检查';$('faceControls').hidden=false;$('hint').textContent='面部权重检查 · 左右以人物自身为准 · 退出后恢复 WASD 控制';focus();}else{getSubject()?.face.reset();exit();$('faceEnter').textContent='检查面部权重';$('faceControls').hidden=true;clearMarkers();$('hint').textContent='WASD 移动 · Shift 奔跑 · 空格跳跃 · 拖动旋转 · 滚轮缩放';}updateDescription();}
 $('faceEnter').onclick=()=>setActive(!active);$('faceRegion').onchange=updateDescription;$('faceView').onchange=display;$('faceLandmarks').onchange=updateMarkers;
 $('facePull').oninput=()=>{const s=getSubject(),amount=Number($('facePull').value);lastPull=s.face.deform($('faceRegion').value,amount);$('facePullValue').textContent=Math.round(amount*100)+'%';};
 $('faceNeutral').onclick=()=>{getSubject()?.face.reset();$('facePull').value=0;$('facePullValue').textContent='0%';lastPull=null;};
 $('faceFront').onclick=()=>{angle=0;focus(true)};$('faceLeft').onclick=()=>{angle=.55;focus(true)};$('faceRight').onclick=()=>{angle=-.55;focus(true)};
 function refresh(){const s=getSubject();$('faceCount').textContent=`${s.face.report.regions} 区域 · ${s.face.report.sampledVertices.toLocaleString()} 表面点 · 函数重新采样`;updateDescription();}
 refresh();return {setActive,focus,refresh,display,get active(){return active},get lastPull(){return lastPull},dispose(){setActive(false);clearMarkers()}};
}
