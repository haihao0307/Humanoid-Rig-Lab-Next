function bindConnectedTissueSurface(tissue){
  const g=buildConnectedHumanSurface(tissue),count=g.p.length/3;
  applyProceduralBodyShape(tissue,g);
  applySkinLayerShape(tissue,g);
  bindShoulderSoftLayer(tissue,g);
  colorHandSurface(tissue,g);
  fitBroadMusclesToSkin(tissue,g);
  fitAxialMuscleSheets(tissue);
  g.tissueIds=new Float32Array(count*2);g.tissueData=new Float32Array(count*4);
  for(let v=0;v<count;v++){
    tissue.maxWeightError=Math.max(tissue.maxWeightError,Math.abs(g.skinWeights.subarray(v*4,v*4+4).reduce((a,b)=>a+b,0)-1));
    const p=Array.from(g.p.subarray(v*3,v*3+3)),influences=[];
    // Topology owns skinning. Muscles supply bounded secondary surface offsets only.
    const handRegion=[0,1,2,3].some(k=>g.skinWeights[v*4+k]>.15&&/_(hand|finger_|metacarpal_)/.test(tissue.human.joints[g.skinJoints[v*4+k]].id));
    for(let id=0;id<tissue.muscles.length&&!handRegion;id++){
      const influence=muscleSurfaceInfluence(tissue,tissue.muscles[id],p);
      if(influence&&influence.weight>.015&&influence.t>.03&&influence.t<.97)influences.push({id,...influence});
    }
    influences.sort((a,b)=>b.weight-a.weight);const best=influences.slice(0,2),total=Math.max(1,best.reduce((a,b)=>a+b.weight,0));
    best.forEach((m,k)=>{g.tissueIds[v*2+k]=m.id;g.tissueData[v*4+k]=m.weight/total;g.tissueData[v*4+k+2]=m.t;});
  }
  prepareWholeBodySurface(tissue,g);
  tissue.geometryHash=hashFloats(g.p)+':'+hashFloats(g.skinWeights);
  tissue.surfaceInfo={vertices:count,triangles:g.i.length/3,voxelM:null,fieldCount:0,loftCount:0,
    generator:'analytic cross-sections with connected Catmull-Clark surface',normalSource:'area-weighted final triangles',
    topology:g.surfaceTopology,muscleEnvelopeFit:tissue.envelopeFit,importedMesh:false,sourcePart:"procedural/connected-human@1"};
  tissue.contactSamples=connectedContactSamples(g);
  return {id:'continuous_skin',g,materialKind:1,color:tissue.skinColor,visible:true};
}
function connectedContactSamples(g){
  const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])directions.push([x,y,z]);
  const extrema=new Map();
  for(let v=0;v<g.p.length/3;v++){
    let slot=0;for(let k=1;k<4;k++)if(g.skinWeights[v*4+k]>g.skinWeights[v*4+slot])slot=k;
    const owner=g.skinJoints[v*4+slot],p=[g.p[v*3],g.p[v*3+1],g.p[v*3+2]];
    for(let k=0;k<directions.length;k++){
      const key=owner+':'+k,value=dot(p,directions[k]),old=extrema.get(key);
      if(!old||value>old.value)extrema.set(key,{v,value});
    }
  }
  return [...new Set([...extrema.values()].map(s=>s.v))].map(v=>({
    p:Array.from(g.p.subarray(v*3,v*3+3)),joints:Array.from(g.skinJoints.subarray(v*4,v*4+4)),weights:Array.from(g.skinWeights.subarray(v*4,v*4+4)),
    structureAnchor:g.structureAnchor?Array.from(g.structureAnchor.subarray(v*4,v*4+4)):null,
    structureData:g.structureData?Array.from((g.surfaceCache?.support||g.structureData).subarray(v*4,v*4+4)):null
  }));
}
function connectedSurfaceSupport(tissue){
  if(!tissue.contactSamples?.length)return {y:Infinity,boneId:'skin:not-built'};
  const transforms=new Map();
  const transform=id=>{
    if(!transforms.has(id)){
      const j=tissue.human.joints[id],b=tissue.bind.get(j.id),q=qnorm(qm(j.world.q,inv(b.q))),t=sub(j.world.p,rotate(q,b.p));
      transforms.set(id,{q,d:mul(qm([...t,0],q),.5)});
    }return transforms.get(id);
  };
  let y=Infinity,owner=0;
  for(const sample of tissue.contactSamples){
    const reference=transform(sample.joints[0]).q,qr=[0,0,0,0],qd=[0,0,0,0];
    for(let k=0;k<4;k++)if(sample.weights[k]>0){const f=transform(sample.joints[k]),w=sample.weights[k]*(dot(reference,f.q)<0?-1:1);
      for(let j=0;j<4;j++){qr[j]+=w*f.q[j];qd[j]+=w*f.d[j];}}
    const length=Math.max(1e-8,Math.hypot(...qr));for(let j=0;j<4;j++){qr[j]/=length;qd[j]/=length;}
    const projection=dot(qr,qd);for(let j=0;j<4;j++)qd[j]-=qr[j]*projection;
    const translation=mul(add(sub(mul(qd.slice(0,3),qr[3]),mul(qr.slice(0,3),qd[3])),cross(qr.slice(0,3),qd.slice(0,3))),2);
    const candidate=add(rotate(qr,sample.p),translation),p=shoulderSupportSample(tissue,sample,candidate,transform),lower=p[1]-.0008;
    if(lower<y){y=lower;owner=sample.joints[0];}
  }
  return {y,boneId:'skin_sample:'+tissue.human.joints[owner].id};
}

// Generated anatomy, in metres. This module is assembled into the generated entrypoint.
// Original parameter fields; no scanned vertices, image maps or animation clips.
// Human.pose remains the only authority that writes joint transforms.
const TISSUE_SPEC = Object.freeze({
  version: '1.11.1', voxelM: null, surfaceNormalStepM: null, bindArmAbductionRad: ADULT_STANCE.bindArmAbductionDeg*Math.PI/180,
  activationTimeS: .035, relaxationTimeS: .09, maxSurfaceOffsetM: .003,
  skinThicknessM: .0016, subcutaneousThicknessM: .006,
  muscleModel: 'attachment-driven fusiform groups and anatomical contour volumes; geometric contraction approximation',
  skinning: 'hemisphere-corrected dual quaternion, four normalized influences',
  individualAnatomyValidated: false, fullForceDynamics: false
});
const SKIN_CONTACT_PALM = Object.freeze(ADULT_SPEC.hand.palmContactM);
const SKIN_SOLE_HEIGHT = ADULT_STANCE.ankleHeightM;
