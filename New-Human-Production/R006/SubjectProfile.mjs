import * as THREE from 'three';

// Reviewed landmarks for this source subject, in its upright, floor-aligned
// source space. They are editable estimates, not internal anatomy measurements.
// One profile fits the inherited hierarchy before binding; no pose-time scale.
export const SOURCE_PROFILE=Object.freeze({heightM:1.8,sourceHeight:.9785441160202026,
  shoulder:[.113,.766,-.026],elbow:[.145,.618,-.026],wrist:[.177,.486,.015],
  hip:[.055,.506,.003],knee:[.074,.287,-.004],ankle:[.094,.048,-.027],
  pelvisY:.506,c7Y:.805,headY:.904,handPolicy:'rigid-source-hand-first-gate'});

export function fitSubjectReference(original,profile=SOURCE_PROFILE){
  const ref=structuredClone(original),s=profile.heightM/profile.sourceHeight;
  const originalPoint=id=>new THREE.Vector3(...original.nodes[id].positionM);
  const originalNormal=p=>[(p[0]/original.sourceHeightM),((p[1]-original.sourceFloorM)/original.sourceHeightM),p[2]/original.sourceHeightM];
  const origHip=originalNormal(original.nodes.hips.positionM)[1],origC7=originalNormal(original.nodes.C7.positionM)[1],origHead=originalNormal(original.nodes.head.positionM)[1];
  const yMap=y=>{
    const rows=[[0,0],[origHip,profile.pelvisY],[origC7,profile.c7Y],[origHead,profile.headY],[1,profile.sourceHeight]];
    let i=0;while(i<rows.length-2&&y>rows[i+1][0])i++;
    const [a,A]=rows[i],[b,B]=rows[i+1];return (A+(B-A)*(y-a)/(b-a))*s;
  };
  for(const n of Object.values(ref.nodes)){
    for(const key of ['positionM','tipM'])if(n[key]){const p=originalNormal(n[key]);n[key]=[p[0]*profile.heightM,yMap(p[1]),p[2]*profile.heightM-.04];}
  }
  ref.nodes.hips.positionM=[0,profile.pelvisY*s,.003*s];
  for(const side of ['left','right']){
    const sign=side==='left'?-1:1;
    const at=name=>[sign*profile[name][0]*s,profile[name][1]*s,profile[name][2]*s];
    for(const [id,name]of [['upperArm','shoulder'],['forearm','elbow'],['hand','wrist'],['femur','hip'],['tibia','knee'],['foot','ankle']])ref.nodes[side+'_'+id].positionM=at(name);
    ref.nodes[side+'_radiusRotation'].positionM=at('elbow');
    const oldWrist=originalPoint(side+'_hand'),newWrist=new THREE.Vector3(...at('wrist'));
    const middle=originalPoint(side+'_finger_3_3').sub(oldWrist),target=new THREE.Vector3(sign*.007,-.091,-.001).multiplyScalar(s);
    const rotation=new THREE.Quaternion().setFromUnitVectors(middle.clone().normalize(),target.clone().normalize());
    const handScale=target.length()/middle.length();
    const mapHand=p=>new THREE.Vector3(...p).sub(oldWrist).applyQuaternion(rotation).multiplyScalar(handScale).add(newWrist).toArray();
    for(const [id,n]of Object.entries(ref.nodes))if(id.startsWith(side+'_')&&/_(metacarpal_|finger_)/.test(id)){
      n.positionM=mapHand(original.nodes[id].positionM);if(n.tipM)n.tipM=mapHand(original.nodes[id].tipM);
    }
    const oldFoot=originalPoint(side+'_foot'),newFoot=new THREE.Vector3(...at('ankle'));
    const footScale=.14*s/(original.sourceHeightM*.14);
    for(const [id,n]of Object.entries(ref.nodes))if(id.startsWith(side+'_')&&/_(midfoot|metatarsal_|toe_)/.test(id)){
      const map=p=>new THREE.Vector3(...p).sub(oldFoot).multiplyScalar(footScale).add(newFoot).toArray();
      n.positionM=map(original.nodes[id].positionM);if(n.tipM)n.tipM=map(original.nodes[id].tipM);
    }
    const armY=profile.shoulder[1]*s;
    ref.nodes[side+'_SC'].positionM=[sign*.018*s,armY+.018*s,-.018*s];
    ref.nodes[side+'_AC'].positionM=[sign*.102*s,armY+.008*s,-.026*s];
    const patella=ref.nodes[side+'_patella'];if(patella)patella.positionM=[...at('knee')].map((v,k)=>v+(k===2?.020*s:0));
  }
  ref.sourceFloorM=0;ref.sourceHeightM=profile.heightM;
  ref.subjectProfile={...profile,method:'reviewed-landmarks/template-hierarchy-fit',measuredInternalAnatomy:false};
  for(const [name,fit]of Object.entries(ref.sphereFits))fit.radiusM*=profile.heightM/original.sourceHeightM;
  ref.functionalCalibration=false;ref.subjectSpecificMotionAvailable=false;
  return ref;
}
