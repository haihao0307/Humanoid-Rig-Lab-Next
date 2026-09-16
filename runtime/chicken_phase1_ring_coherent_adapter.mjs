import {
  CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER,
  createChickenPhase1PeckAdapter
} from './chicken_phase1_peck_adapter.mjs';
import { summarizeVertexKinds } from './chicken_phase1_articulated_skin.mjs';

const EPSILON=1e-8;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const sat=value=>clamp(value,0,1);
const smooth=(a,b,value)=>{
  const t=sat((value-a)/(b-a||1));
  return t*t*(3-2*t);
};

const CARRIER_STATIONS=Object.freeze([
  Object.freeze({x:-.36,boneId:'pelvis'}),
  Object.freeze({x:.060,boneId:'chest'}),
  Object.freeze({x:.120,boneId:'neck_base'}),
  Object.freeze({x:.180,boneId:'neck_c0'}),
  Object.freeze({x:.240,boneId:'neck_c1'}),
  Object.freeze({x:.300,boneId:'neck_c2'}),
  Object.freeze({x:.350,boneId:'neck_c3'}),
  Object.freeze({x:.382,boneId:'head_base'}),
  Object.freeze({x:.420,boneId:'head'})
]);

export function computeChickenPhase1CarrierStationBlend(x){
  if(!Number.isFinite(x))throw new TypeError('carrier station x must be finite');
  const first=CARRIER_STATIONS[0];
  const last=CARRIER_STATIONS[CARRIER_STATIONS.length-1];
  if(x<=first.x)return Object.freeze([{boneId:first.boneId,weight:1}]);
  if(x>=last.x)return Object.freeze([{boneId:last.boneId,weight:1}]);
  for(let index=0;index<CARRIER_STATIONS.length-1;index++){
    const a=CARRIER_STATIONS[index];
    const b=CARRIER_STATIONS[index+1];
    if(x>b.x)continue;
    const t=smooth(a.x,b.x,x);
    const blend=[];
    if(1-t>EPSILON)blend.push(Object.freeze({boneId:a.boneId,weight:1-t}));
    if(t>EPSILON)blend.push(Object.freeze({boneId:b.boneId,weight:t}));
    return Object.freeze(blend);
  }
  return Object.freeze([{boneId:last.boneId,weight:1}]);
}

function packStationBlend(x,boneIndex){
  const blend=computeChickenPhase1CarrierStationBlend(x);
  const indices=[0,0,0,0];
  const weights=[0,0,0,0];
  for(let slot=0;slot<blend.length;slot++){
    const index=boneIndex[blend[slot].boneId];
    if(!Number.isInteger(index))throw new Error(`missing carrier bone ${blend[slot].boneId}`);
    indices[slot]=index;
    weights[slot]=blend[slot].weight;
  }
  return{indices,weights};
}

function computeCoatRootStations(positions,seedValues,uvValues){
  const count=positions.length/3;
  const rootX=new Float32Array(count);
  if(!seedValues||seedValues.length!==count){
    for(let index=0;index<count;index++)rootX[index]=positions[index*3];
    return rootX;
  }
  let start=0;
  while(start<count){
    const seed=seedValues[start];
    let end=start+1;
    while(end<count&&seedValues[end]===seed)end++;
    let minimumStation=Infinity;
    let sum=0;
    let samples=0;
    for(let index=start;index<end;index++){
      const station=uvValues?uvValues[index*2]:index-start;
      if(station<minimumStation-1e-6){
        minimumStation=station;
        sum=positions[index*3];
        samples=1;
      }else if(Math.abs(station-minimumStation)<=1e-6){
        sum+=positions[index*3];
        samples++;
      }
    }
    rootX.fill(samples?sum/samples:positions[start*3],start,end);
    start=end;
  }
  return rootX;
}

function summarizePrimaryCounts(counts){
  const result={};
  for(let index=0;index<counts.length;index++){
    if(counts[index])result[CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER[index]]=counts[index];
  }
  return Object.freeze(result);
}

function rebindCarrierMesh(THREE,mesh,meshIndex,boneIndex,skeleton){
  const geometry=mesh.geometry;
  const positions=geometry.attributes.position.array;
  const kind=mesh.userData?.materialKind||'body';
  const count=positions.length/3;
  const seedValues=geometry.attributes.seed?.array||null;
  const uvValues=geometry.attributes.uv?.array||null;
  const carrierUV=geometry.attributes.carrierUV?.array||null;
  const vertexKinds=geometry.attributes.kind?.array||null;
  const localCoords=geometry.attributes.localCoord?.array||null;
  const stationByVertex=kind==='coat'
    ?computeCoatRootStations(positions,seedValues,uvValues)
    :null;
  const indices=new Uint16Array(count*4);
  const weights=new Float32Array(count*4);
  const primaryCounts=new Uint32Array(CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER.length);
  let maximumInfluences=0;
  for(let vertex=0;vertex<count;vertex++){
    const packed=packStationBlend(stationByVertex?stationByVertex[vertex]:positions[vertex*3],boneIndex);
    maximumInfluences=Math.max(maximumInfluences,packed.weights.filter(weight=>weight>EPSILON).length);
    const offset=vertex*4;
    for(let slot=0;slot<4;slot++){
      indices[offset+slot]=packed.indices[slot];
      weights[offset+slot]=packed.weights[slot];
    }
    primaryCounts[packed.indices[0]]++;
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  mesh.bind(skeleton);
  mesh.normalizeSkinWeights();
  return Object.freeze({
    meshIndex,
    materialKind:kind,
    vertexCount:count,
    hasVertexKind:Boolean(vertexKinds),
    hasLocalCoord:Boolean(localCoords),
    hasCarrierUV:Boolean(carrierUV),
    generatedFootMesh:false,
    ringCoherentCarrier:kind==='body',
    rootRigidCoat:kind==='coat',
    maximumCarrierInfluences:maximumInfluences,
    vertexKindHistogram:summarizeVertexKinds(vertexKinds),
    primaryBoneCounts:summarizePrimaryCounts(primaryCounts)
  });
}

export function createChickenPhase1RingCoherentAdapter(THREE,baseSkin,options={}){
  if(!THREE?.Uint16BufferAttribute||!THREE?.Float32BufferAttribute){
    throw new Error('THREE buffer attribute constructors are required');
  }
  if(baseSkin?.diagnostics?.().peckKinematicsRevision==='six-link-ring-coherent-s-curve-v3'){
    return baseSkin;
  }
  const peckSkin=createChickenPhase1PeckAdapter(THREE,baseSkin,options);
  const sourceDiagnostics=peckSkin.diagnostics();
  if(sourceDiagnostics.boneCount!==CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER.length){
    throw new Error('six-link peck skeleton was not installed before carrier refit');
  }
  const boneIndex=Object.fromEntries(
    CHICKEN_PHASE1_VOLUME_NECK_BONE_ORDER.map((boneId,index)=>[boneId,index])
  );
  const sourceAudits=new Map((sourceDiagnostics.meshAudits||[]).map(audit=>[audit.meshIndex,audit]));
  const meshAudits=[];
  for(let meshIndex=0;meshIndex<peckSkin.meshes.length;meshIndex++){
    const mesh=peckSkin.meshes[meshIndex];
    const kind=mesh?.userData?.materialKind||'body';
    if(mesh?.isSkinnedMesh&&mesh.geometry?.attributes?.position&&(kind==='body'||kind==='coat')){
      meshAudits.push(rebindCarrierMesh(THREE,mesh,meshIndex,boneIndex,peckSkin.skeleton));
    }else if(sourceAudits.has(meshIndex)){
      meshAudits.push(sourceAudits.get(meshIndex));
    }
  }
  const diagnostics=()=>{
    const source=peckSkin.diagnostics();
    return{
      ...source,
      schema:'life_ecosystem/chicken_phase1_articulated_skin_diagnostics@2.1',
      weightingRevision:'ring-coherent-carrier-and-root-rigid-coat-v5',
      peckKinematicsRevision:'six-link-ring-coherent-s-curve-v3',
      sourceWeightingRevision:source.weightingRevision||null,
      meshAudits
    };
  };
  return Object.freeze({
    bones:peckSkin.bones,
    skeleton:peckSkin.skeleton,
    meshes:peckSkin.meshes,
    applyPose:pose=>peckSkin.applyPose(pose),
    verifyInvariants:()=>peckSkin.verifyInvariants(),
    detach:()=>peckSkin.detach(),
    diagnostics,
    rootOrigin:peckSkin.rootOrigin
  });
}
