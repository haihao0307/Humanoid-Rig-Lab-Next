/* Analytic schematic organ volumes and major vessel/nerve paths.
 * These landmarks are authored, not sampled from a mesh or imaging study. */
function wholeBodyNormals(p,i){
 const n=new Float32Array(p.length);
 for(let t=0;t<i.length;t+=3){const a=i[t]*3,b=i[t+1]*3,c=i[t+2]*3;
  const x=p[b]-p[a],y=p[b+1]-p[a+1],z=p[b+2]-p[a+2],X=p[c]-p[a],Y=p[c+1]-p[a+1],Z=p[c+2]-p[a+2];
  const nx=y*Z-z*Y,ny=z*X-x*Z,nz=x*Y-y*X;
  for(const k of [a,b,c]){n[k]+=nx;n[k+1]+=ny;n[k+2]+=nz;}
 }
 for(let k=0;k<n.length;k+=3){const l=Math.hypot(n[k],n[k+1],n[k+2])||1;n[k]/=l;n[k+1]/=l;n[k+2]/=l;}return n;
}

function anatomyMuscleItems(tissue){return tissue.muscles.map(m=>m.sheet||m.item);}
function buildProceduralSystems(tissue){
 const h=tissue.human,items=[],colors={organs:[.48,.18,.15],arteries:[.64,.055,.04],veins:[.12,.21,.46],nerves:[.80,.68,.33]};
 const item=(id,label,joint,g,group='organs')=>items.push({id:'procedural_'+id,label,joint:h.byId.get(joint),g,sourceGroup:group,materialKind:0,color:colors[group],visible:false});
 const organ=(id,label,joint,p,r)=>item(id,label,joint,ellipsoid(p,r,24,18));
 organ('brain','脑（示意）','head',[0,.07,-.004],[.068,.066,.077]);
 organ('heart','心脏（示意）','T7',[-.026,-.025,.055],[.043,.065,.038]);
 organ('liver','肝（示意）','T12',[.046,-.026,.041],[.09,.035,.05]);
 organ('stomach','胃（示意）','L1',[-.054,.014,.05],[.046,.065,.035]);
 organ('bladder','膀胱（示意）','hips',[0,-.01,.06],[.033,.034,.027]);
 for(const side of ['left','right']){const sign=side==='left'?-1:1;
  organ(side+'_lung',side==='left'?'左肺（示意）':'右肺（示意）','T6',[sign*.073,.005,.035],[.045,.104,.045]);
  organ(side+'_kidney',side==='left'?'左肾（示意）':'右肾（示意）','L1',[sign*.05,-.01,-.008],[.026,.05,.022]);
 }
 const path=(id,label,joint,a,b,r,group)=>item(id,label,joint,sweep(t=>mix(a,b,t),r,16,8),group);
 // Paths are local to their bone; each limb segment follows its owning joint.
 for(const group of ['arteries','veins','nerves']){
  const z=group==='nerves'?-.018:.02,r=group==='nerves'?.002:.003;
  for(const side of ['left','right'])for(const [part,next]of [['upperArm','forearm'],['forearm','hand'],['femur','tibia'],['tibia','foot']]){
   const id=side+'_'+part,bind=tissue.bind.get(id),end=rotate(inv(bind.q),sub(tissue.bind.get(side+'_'+next).p,bind.p));
   const offset=[group==='veins'?.008:0,0,z];path(group+'_'+id,group+' '+id+'（示意）',id,offset,add(end,offset),r,group);
  }
  for(const joint of h.joints.filter(j=>/^(L[1-5]|T\d+|C[1-7])$/.test(j.id))){const child=h.joints.find(j=>j.parent===joint&&/^(L|T|C)/.test(j.id));if(child)path(group+'_'+joint.id,group+' '+joint.id+'（示意）',joint.id,[0,0,z],add(child.bind,[0,0,z]),r,group);}
 }
 return items;
}
function proceduralSystemsReport(tissue){return {source:'analytic functions and authored parameters',externalMeshes:0,imageMaps:0,schematicOrgans:true,generatedParts:(tissue.referenceExtra||[]).length,anatomicalValidation:false,visualAcceptance:false};}
async function selectWholeBodyLayer(lab,mode){
 for(const key of ['lowerLimb','headNeck','torso','shoulders','hands'])if(lab[key]?.active)lab[key].leave();
 lab.human.tissue.setView(mode);lab.isolate('all');lab.focus('body');lab.render();
}
function installWholeBodyControls(lab){
 const control=document.createElement('div');control.id='whole-body-controls';
 control.style.cssText='position:fixed;left:12px;bottom:12px;z-index:40;background:#10232eeb;color:#e1eaee;border:1px solid #48606b;border-radius:8px;padding:9px 12px;font:12px system-ui;max-width:270px';
 control.innerHTML='<label>全身图层 <select id="whole-body-layer" style="padding:5px;margin-left:6px"><option value="skin">皮肤外表</option><option value="clay">外形白模</option><option value="dermis">真皮外界</option><option value="hypodermis">皮下组织外界</option><option value="subcutaneousBase">皮下组织内界（估计）</option><option value="skinThickness">皮肤厚度图</option><option value="muscle">骨骼与肌肉</option><option value="skeleton">骨骼</option><option value="support">连接组织</option><option value="organs">器官</option><option value="vessels">血管</option><option value="nerves">神经</option></select></label><div id="whole-body-status" style="margin-top:5px;color:#aebfc7">函数生成 · 器官与路径为示意</div>';
 document.body.append(control);
 control.querySelector('select').onchange=e=>selectWholeBodyLayer(lab,e.target.value).catch(console.error);
 lab.wholeBody={setLayer:mode=>selectWholeBodyLayer(lab,mode),report:()=>proceduralSystemsReport(lab.human.tissue)};
 lab.skinLayers=installSkinLayerControls(lab);
}
