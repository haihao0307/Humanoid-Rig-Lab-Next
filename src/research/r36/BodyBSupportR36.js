/* B body joint influences and source-derived corrective scalar functions.
 * The packet has no character point table or face connectivity. */
(()=>{'use strict';
const M=BodyMathR01;
function create(p,support){
 if(p?.schema!=='body-b-domain-support-r36/1'||p.characterVertexArrays!==false||p.characterFaces!==false||!p.sourceDerived||p.skinOffsets.length!==p.domainCount*3+1||p.mapFunctions.length!==p.domainCount*27||p.mapInfluenceOffsets.length!==p.domainCount*9+1)throw Error('B 骨架函数数据不完整');
 const bindInverse=p.sourceBind.map(M.uniformInverse),allowed=new Set(p.allowedPoseIndices);
 function prepare(state,aState){
  const m=state.mhr;if(!m||!Array.isArray(m.pose)||m.pose.length!==204||typeof m.correctives!=='boolean')throw Error('B 骨架姿态数据不完整');
  for(let i=0;i<m.pose.length;i++)if(!Number.isFinite(m.pose[i])||m.pose[i]<p.poseLimits[i][0]||m.pose[i]>p.poseLimits[i][1]||(!allowed.has(i)&&m.pose[i]!==0))throw Error('B 骨架参数不在当前支持范围：'+i);
  const a=support.original(aState,{}),heads=Float64Array.from(a.poseMatrices.flatMap(x=>[x[3],x[7],x[11]])),binding=buildBodyTargetBindingR01({sourceBind:p.sourceBind,jointNames:p.names,parents:p.parents,annyBoneNames:a.rig.labels,annyRestHeads:heads});
  const rig={kind:'mhr-no-correctives',labels:p.names,parents:p.parents,bind:binding.bind,local:binding.local,scales:binding.scales,poseLimits:p.poseLimits,transform_ptr:p.transform_ptr,transform_idx:p.transform_idx,transform_val:p.transform_val,prerotation:p.prerotation};
  const skin=BodyPoseFunctionsR29.matrices({rig,allowedPoseIndices:p.allowedPoseIndices},m.pose),posed=skin.originalPoseMatrices,parameters=skin.jointParameters,zero=m.pose.every(x=>x===0),sourceToTarget=posed.map((x,j)=>M.mul(x,bindInverse[j])),restToTarget=binding.bind.map((x,j)=>M.mul(x,bindInverse[j]));
  let hidden=null,cache=null;
  if(m.correctives&&!zero){
   const features=new Float32Array((p.names.length-2)*6);
   for(let j=2;j<p.names.length;j++){const k=j*7,[x,y,z]=[parameters[k+3],parameters[k+4],parameters[k+5]],cx=Math.cos(x),cy=Math.cos(y),cz=Math.cos(z),sx=Math.sin(x),sy=Math.sin(y),sz=Math.sin(z);features.set([cy*cz-1,cy*sz,-sy,-cx*sz+sx*sy*cz,cx*cz+sx*sy*sz-1,sx*cy],(j-2)*6);}
   hidden=new Float32Array(p.mlp0_ptr.length-1);for(let r=0;r<hidden.length;r++){let v=0;for(let k=p.mlp0_ptr[r];k<p.mlp0_ptr[r+1];k++)v+=p.mlp0_val[k]*features[p.mlp0_idx[k]];hidden[r]=Math.max(0,Math.fround(v));}
   cache=new Float32Array(p.responseOffsets.length-1);cache.fill(NaN);
  }
  function response(id){let v=cache[id];if(!Number.isNaN(v))return v;v=0;for(let k=p.responseOffsets[id];k<p.responseOffsets[id+1];k++)v+=p.responseValues[k]*hidden[p.responseIndices[k]];return cache[id]=Math.fround(v);}
  function influences(domain,corner){const slot=domain*3+corner,ids=[],weights=[];for(let k=p.skinOffsets[slot];k<p.skinOffsets[slot+1];k++){ids.push(p.skinJoints[k]);weights.push(p.skinWeights[k]);}return{ids,weights};}
  function articulationRest(domain,corner){if(!hidden)return[0,0,0];const slot=domain*3+corner,existing=new Set(influences(domain,corner).ids),out=[0,0,0];for(let sample=0;sample<3;sample++){const mi=slot*3+sample,fi=mi*3,d=[response(p.mapFunctions[fi])/100,-response(p.mapFunctions[fi+2])/100,response(p.mapFunctions[fi+1])/100];for(let k=p.mapInfluenceOffsets[mi];k<p.mapInfluenceOffsets[mi+1];k++){const j=p.mapInfluenceJoints[k];if(!existing.has(j))continue;const v=M.vector(restToTarget[j],d),w=p.mapBary[mi]*p.mapInfluenceWeights[k]*binding.scales[j];for(let c=0;c<3;c++)out[c]+=w*v[c];}}return out;}
  function point(domain,corner,rest){
   const slot=domain*3+corner,out=zero?rest.slice():[0,0,0];
   if(!zero)for(let k=p.skinOffsets[slot];k<p.skinOffsets[slot+1];k++){const q=M.point(skin[p.skinJoints[k]],rest),w=p.skinWeights[k];for(let c=0;c<3;c++)out[c]+=w*q[c];}
   if(hidden){const delta=new Float32Array(3);for(let sample=0;sample<3;sample++){const mi=slot*3+sample,fi=mi*3,d=[response(p.mapFunctions[fi])/100,-response(p.mapFunctions[fi+2])/100,response(p.mapFunctions[fi+1])/100],displaced=[0,0,0];for(let k=p.mapInfluenceOffsets[mi];k<p.mapInfluenceOffsets[mi+1];k++){const j=p.mapInfluenceJoints[k],v=M.vector(sourceToTarget[j],d),w=p.mapInfluenceWeights[k]*binding.scales[j];for(let c=0;c<3;c++)displaced[c]+=w*v[c];}for(let c=0;c<3;c++)delta[c]+=p.mapBary[mi]*displaced[c];}for(let c=0;c<3;c++)out[c]+=delta[c];}
   return out.map(Math.fround);
  }
  return{point,influences,articulationRest,skin,posed,names:p.names,binding,correctivesApplied:!!hidden};
 }
 return{prepare};
}
globalThis.BodyBSupportR36={create};
})();
