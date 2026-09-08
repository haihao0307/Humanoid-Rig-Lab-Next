import {compileGarment,createMaterialDNA,createStandardCrewShirtDNA,encodeGarmentPayload,normalizeBodyProfile} from '../../packages/procedural-clothing/index.js';
import { createRenderer } from './renderer.js';

const $=(selector)=>document.querySelector(selector);
const controls=Object.fromEntries(['height','shoulder','chest','waist','length','sleeve','fit','material'].map((id)=>[id,$(`#${id}`)]));
const outputs=Object.fromEntries(['height','shoulder','chest','waist','length','sleeve'].map((id)=>[id,$(`#${id}Out`)]));
const stats=Object.fromEntries(['revision','vertex','triangle','seam','binary','topology','hash'].map((id)=>[id,$(`#${id}Stat`)]));
const state={payload:null,garmentDNA:null,materialDNA:null,bodyProfile:null,binary:null};
let revision=1,timer;

function labels(){outputs.height.value=`${Number(controls.height.value).toFixed(2)} m`;outputs.shoulder.value=`${Number(controls.shoulder.value).toFixed(3)} m`;outputs.chest.value=`${Number(controls.chest.value).toFixed(2)} m`;outputs.waist.value=`${Number(controls.waist.value).toFixed(2)} m`;outputs.length.value=Number(controls.length.value).toFixed(3);outputs.sleeve.value=Number(controls.sleeve.value).toFixed(3);}
function compile(){labels();$('#statusText').textContent='函数编译中';const height=Number(controls.height.value),chest=Number(controls.chest.value),waist=Number(controls.waist.value),shoulder=Number(controls.shoulder.value);
  state.materialDNA=createMaterialDNA(controls.material.value);
  state.garmentDNA=createStandardCrewShirtDNA({fitMode:controls.fit.value,bodyLengthRatio:Number(controls.length.value),sleeveLengthRatio:Number(controls.sleeve.value),materialDNA:state.materialDNA});
  state.bodyProfile=normalizeBodyProfile({subject_id:'preview_person',proportion_revision:revision,measurements:{body_height:height,shoulder_width:shoulder,chest_circumference:chest,waist_circumference:waist,hip_circumference:Math.max(waist*1.14,chest*.92),neck_circumference:height*.21,upper_arm_circumference:chest*.31,torso_length:height*.29,arm_length:height*.34,chest_depth:chest*.235,waist_depth:waist*.238}});
  state.payload=compileGarment(state.garmentDNA,state.bodyProfile);state.binary=encodeGarmentPayload(state.payload);
  stats.revision.textContent=revision;stats.vertex.textContent=state.payload.topology.vertexCount.toLocaleString();stats.triangle.textContent=state.payload.topology.triangleCount.toLocaleString();stats.seam.textContent=state.payload.topology.seamPairCount.toLocaleString();stats.binary.textContent=`${(state.binary.byteLength/1024).toFixed(1)} KB`;stats.topology.textContent=state.payload.topologySignature.slice(8);stats.hash.textContent=state.payload.contentHash.slice(8);$('#statusText').textContent='编译完成，确定性可重建';revision+=1;}
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
Object.values(controls).forEach((control)=>control.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(compile,40);}));
const renderer=createRenderer($('#canvas'),()=>state);
document.querySelectorAll('[data-view]').forEach((button)=>button.onclick=()=>{renderer.setView(button.dataset.view);$('#rotate').textContent='开始旋转';});
$('#rotate').onclick=(event)=>{event.currentTarget.textContent=renderer.toggleRotation()?'停止旋转':'开始旋转';};
$('#wire').onclick=(event)=>{event.currentTarget.textContent=renderer.toggleWireframe()?'隐藏线框':'显示线框';};
$('#downloadBinary').onclick=()=>download(`${state.garmentDNA.garmentId}_${state.bodyProfile.proportionRevision}.hrlg`,state.binary,'application/octet-stream');
$('#downloadDNA').onclick=()=>download(`${state.garmentDNA.garmentId}.json`,JSON.stringify(state.garmentDNA,null,2),'application/json');
compile();renderer.start();
