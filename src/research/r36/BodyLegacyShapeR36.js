/* Opt-in R18-R20 body volume and joint corrections on direct-intersection domains.
 * Legacy hand/foot implicit-field functions are tracked separately. */
(()=>{'use strict';const M=BodyMathR01;
function create(p,support){
 if(p?.schema!=='body-legacy-domain-influences-r36/1'||!p.sourceDerived||p.characterVertexArrays!==false||p.characterFaces!==false||p.offsets.length!==p.domainCount*3+1)throw Error('旧档身体函数数据不完整');
 function prepare(state,aState,pose,moved,bFrame){
  const c=state.bodyCalibration;if(!c?.enabled)return null;
  if(!BodySourceScopeP1.valid(state))throw Error('旧档身体改形超出当前支持范围');
  const neutral=support.original(aState,{}),names=neutral.rig.labels,rest=neutral.poseMatrices,heads=Float64Array.from(rest.flatMap(x=>[x[3],x[7],x[11]]));
  function pos(name){const i=names.indexOf(name);if(i<0)throw Error('旧档身体支撑点缺失：'+name);return Array.from(heads.subarray(i*3,i*3+3));}
  const l=pos('upperleg01.L'),r=pos('upperleg01.R'),neck=pos('neck01'),shoulder=pos('upperarm01.L');
  const torsoFrame={origin:l.map((v,k)=>(v+r[k])/2),height:neck[2]-(l[2]+r[2])/2,halfWidth:Math.abs(shoulder[0])};
  if(!(torsoFrame.height>0&&torsoFrame.halfWidth>0))throw Error('旧档身体支撑范围无效');
  const skin=bFrame?bFrame.skin:moved.poseMatrices.map((x,j)=>M.mul(x,M.uniformInverse(rest[j]))),rig=bFrame?{names:bFrame.names,restMatrices:bFrame.binding.bind,posedMatrices:bFrame.posed,skinMatrices:skin}:{names,restMatrices:rest,posedMatrices:moved.poseMatrices,skinMatrices:skin};
  const driver={anny:{boneLabels:names,forward:()=>({boneHeads:heads})}},result={calibration:{torsoFrame},owners:{rig:state.owners.rig},rig};
  const anatomyFrame=c.anatomyVersion===20?BodyAnatomyR20.frame(driver,state,result):null,articulationGain=anatomyFrame?(c.articulation??1):0,parts=articulationGain?skin.map(BodyArticulationR20.dual):null;
  function delta(point){let q=point.slice(),d=BodyTorsoR18.displacement(q,torsoFrame,state.anny.phenotypes,c.torso??1);q=q.map((v,k)=>Math.fround(v+d[k]));if(c.structureVersion===19){d=BodyStructureR19.displacement(q,torsoFrame,state.anny.phenotypes,c.structureGain??1);q=q.map((v,k)=>Math.fround(v+d[k]));}if(anatomyFrame){d=BodyAnatomyR20.displacement(q,anatomyFrame,state.anny.phenotypes,c.anatomyGain??1);q=q.map((v,k)=>Math.fround(v+d[k]));}return q.map((v,k)=>v-point[k]);}
  function transport(domain,corner,d){const i=domain*3+corner,out=[0,0,0];for(let k=p.offsets[i];k<p.offsets[i+1];k++){const q=M.vector(skin[p.joints[k]],d),w=p.weights[k];for(let c=0;c<3;c++)out[c]+=w*q[c];}return out;}
  function articulation(domain,corner,point){if(!parts)return[0,0,0];const slot=domain*3+corner,ids=[],weights=[];if(bFrame){const list=bFrame.influences(domain,corner);ids.push(...list.ids);weights.push(...list.weights);}else for(let k=p.offsets[slot];k<p.offsets[slot+1];k++){ids.push(p.joints[k]);weights.push(p.weights[k]);}const largest=Math.max(...weights),neckMask=1-BodyStructureR19.smooth(.92,1.02,(point[2]-torsoFrame.origin[2])/torsoFrame.height),beta=.70*articulationGain*BodyStructureR19.smooth(.025,.30,1-largest)*neckMask;if(!beta)return[0,0,0];const correction=bFrame?bFrame.articulationRest(domain,corner):[0,0,0],q=point.map((v,k)=>v+correction[k]),selected=ids.map(i=>parts[i]),blended=BodyArticulationR20.blend(selected,weights),old=[0,0,0];for(let i=0;i<ids.length;i++){const v=BodyStructureR19.map3(selected[i].r,q);for(let k=0;k<3;k++)old[k]+=weights[i]*(v[k]+selected[i].t[k]);}const moved=M.rotateQuaternion(blended.q,q).map((v,k)=>v+blended.t[k]);return moved.map((v,k)=>(v-old[k])*beta);}
  return{delta,transport,articulation,neutralTransforms:neutral.transforms};
 }
 return{prepare};
}
globalThis.BodyLegacyShapeR36={create};
})();
