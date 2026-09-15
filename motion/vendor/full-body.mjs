import { WALK_DATA } from './walk-data.mjs';
import { add, sub, mul, dot, length, normalize, mix, rotateY, clamp } from './math.mjs';
const identity = [0, 0, 0, 1];
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const qmul = (a,b) => [...add(add(mul(b.slice(0,3),a[3]),mul(a.slice(0,3),b[3])),cross(a,b)),a[3]*b[3]-dot(a.slice(0,3),b.slice(0,3))];
const qblend = (a,b,t) => normalize(mix(a,dot(a,b)<0?mul(b,-1):b,t),identity);
const rotate = (v,q) => add(v,add(mul(cross(q,v),2*q[3]),mul(cross(q,cross(q,v)),2)));
function between(a,b) {
  a=normalize(a); b=normalize(b); const d=dot(a,b);
  if(d<-.99999)return [...normalize(cross(a,Math.abs(a[0])<.8?[1,0,0]:[0,0,1])),0];
  return normalize([...cross(a,b),1+d],identity);
}
function relaxedHandRotation(nodes,side,forearmDirection,inward) {
  const p=id=>nodes[side+'_'+id].positionM;
  // Anatomical palm frame, not merely the elbow-to-wrist direction. A single
  // direction cannot determine forearm twist. Left/right handedness matters:
  // index-to-little across the palm and wrist-to-middle define its normal.
  const sourceLong=normalize(sub(p('finger_3_1'),p('hand')));
  const across=sub(p('finger_2_1'),p('finger_5_1'));
  const sourcePalm=mul(normalize(cross(sourceLong,across)),side==='left'?-1:1);
  const targetLong=normalize(forearmDirection);
  const alignment=between(sourceLong,targetLong);
  const alignedPalm=rotate(sourcePalm,alignment);
  const projected=sub(inward,mul(targetLong,dot(inward,targetLong)));
  // Preserve the aligned orientation near the singularity (forearm pointing
  // at the torso). Normal walking is far from this configuration.
  const targetPalm=normalize(projected,alignedPalm);
  const twist=Math.atan2(dot(targetLong,cross(alignedPalm,targetPalm)),dot(alignedPalm,targetPalm));
  const half=twist/2;
  return qmul([...mul(targetLong,Math.sin(half)),Math.cos(half)],alignment);
}
const rows=WALK_DATA.clip.sampleBlocks.flat();
export const MOTION_SOURCE={trial:WALK_DATA.clip.sourceTrial,frames:[WALK_DATA.clip.sourceFrameStart,WALK_DATA.clip.sourceFrameEnd],hz:WALK_DATA.clip.sourceSampleRateHz,source:WALK_DATA.source,derivedFileSHA256:WALK_DATA.sourceFileSHA256};
function blend(a,b,t){const out={};for(const [key,v]of Object.entries(b)){
  if(typeof v==='number')out[key]=(a[key]??v)+(v-(a[key]??v))*t;
  else if(key.endsWith('Q'))out[key]=qblend(a[key]||v,v,t);
  else out[key]=key==='rootOffset'?mix(a[key]||v,v,t):normalize(mix(a[key]||v,v,t));
}return out;}
function sample(phase){
  const t=((phase%1)+1)%1;let lo=0,hi=rows.length-1;
  while(hi-lo>1){const mid=(hi+lo)>>1;if(rows[mid].t<=t)lo=mid;else hi=mid;}
  let r=blend(rows[lo],rows[hi],clamp((t-rows[lo].t)/(rows[hi].t-rows[lo].t),0,1));
  // Selected cycle is not perfectly periodic; small end crossfade is explicitly
  // an adaptation. Full start/stop/turn clips have not been installed.
  if(t>.95)r=blend(r,rows[0],(t-.95)/.05);return r;
}
export class FullBodyMotion {
  constructor(nodes){
    this.nodes=nodes;this.peaks={};
    for(const side of ['left','right'])this.peaks[side]=rows.reduce((a,b)=>b[side+'AnkleHeightRatio']>a[side+'AnkleHeightRatio']?b:a).t;
    this.neutral=sample(0);
    for(const key of Object.keys(this.neutral))if(key.endsWith('Q'))this.neutral[key]=identity;
    this.neutral.rootOffset=[0,0,0];this.neutral.rootHeightRatio=1;
    for(const side of ['left','right'])for(const [key,a,b]of [['UpperArm','upperArm','forearm'],['Forearm','forearm','hand'],['Thigh','femur','tibia'],['Shank','tibia','foot']])this.neutral[side+key]=normalize(sub(nodes[side+'_'+b].positionM,nodes[side+'_'+a].positionM));
  }
  advance(s,dt){
    const m=s.motion;
    // Match the upper-body source phase to the ACTUAL scheduled swing foot.
    // No free-running sine wave on the arms, and no render-frame time source.
    if(s.swing)m.phase=this.peaks[s.swing.side]+(s.swing.elapsed/s.swing.duration-.5)*.42;
    const target=(s.speed>.02||s.swing)?1:0;
    m.weight+=(target-m.weight)*(1-Math.exp(-dt/ .18));
    m.frame=blend(m.frame||this.neutral,sample(m.phase),1-Math.exp(-dt/.065));
  }
  applyControlledLegs(positions,s){
    // Update the entire descendant hierarchy, not a name-filtered subset.
    // Patella follows the shank here (a diagnostic attachment approximation);
    // subtalar/midfoot/metatarsal/toe nodes share the controlled foot frame.
    for(const side of ['left','right']){
      const leg=s.pose.legs[side],foot=s.feet[side],prefix=side+'_';
      const p=name=>this.nodes[prefix+name].positionM;
      const upperQ=between(sub(p('tibia'),p('femur')),sub(leg.knee,leg.root));
      const lowerQ=between(sub(p('foot'),p('tibia')),sub(leg.end,leg.knee));
      const transforms=new Map([
        [prefix+'femur',v=>rotate(v,upperQ)],
        [prefix+'tibia',v=>rotate(v,lowerQ)],
        [prefix+'foot',v=>rotateY(v,foot.yaw)]
      ]);
      const anchors=new Map([[prefix+'femur',leg.root],[prefix+'tibia',leg.knee],[prefix+'foot',leg.end]]);
      for(const [id,n]of Object.entries(this.nodes)){
        if(anchors.has(id)){positions.set(id,[...anchors.get(id)]);continue;}
        const transform=transforms.get(n.parent);
        if(!transform)continue;
        positions.set(id,add(positions.get(n.parent),transform(sub(n.positionM,this.nodes[n.parent].positionM))));
        transforms.set(id,transform);
      }
    }
    return positions;
  }
  positions(s,reference=false){
    const frame=reference?sample(s.motion.phase):blend(this.neutral,s.motion.frame||this.neutral,s.motion.weight);
    const positions=new Map(),rotations=new Map();
    const regionCount={};for(const n of Object.values(this.nodes))if(n.region)regionCount[n.region]=(regionCount[n.region]||0)+1;
    const bodyRoot=[...s.root];
    // Whole source preview includes its height variation. Controlled mode keeps
    // the locomotion solver's pelvis height; measured pelvis rotation remains.
    if(reference)bodyRoot[1]+=(frame.rootHeightRatio-1)*s.root[1];
    for(const [id,n]of Object.entries(this.nodes)){
      if(!n.parent){positions.set(id,bodyRoot);rotations.set(id,frame.rootQ);continue;}
      const parent=this.nodes[n.parent],p=positions.get(n.parent),pq=rotations.get(n.parent)||identity;
      if(!p)throw Error('Unordered skeleton parent: '+id);
      let q=pq,offset=sub(n.positionM,parent.positionM);
      const side=id.startsWith('left_')?'left':id.startsWith('right_')?'right':null;
      const segment=id.split('_').slice(1).join('_');
      if(n.region)q=qmul(pq,qblend(identity,frame[{L:'lumbarQ',T:'thoraxQ',C:'cervicalQ'}[n.region]],1/regionCount[n.region]));
      if(id==='head')q=qmul(pq,frame.headQ);
      if(side&&segment==='SC')q=qmul(pq,frame[side+'ClavicleQ']);
      // Source limb direction tracks are in source-global coordinates, so they
      // are NOT multiplied by the torso rotation a second time.
      const direction=side&&({forearm:'UpperArm',hand:'Forearm',tibia:'Thigh',foot:'Shank'})[segment];
      if(direction){offset=mul(frame[side+direction],length(offset));q=between(sub(n.positionM,parent.positionM),frame[side+direction]);}
      if(side&&(segment==='radiusRotation'||segment==='hand')) {
        // Neutral pronation/supination for relaxed walking, with the palm
        // facing medially and the wrist aligned to the moving forearm.
        // This is an explicit retargeting correction, not captured wrist data.
        const inward=rotate([side==='left'?1:-1,0,0],frame.rootQ);
        q=relaxedHandRotation(this.nodes,side,frame[side+'Forearm'],inward);
      }
      positions.set(id,add(p,rotateY(direction?offset:rotate(offset,pq),s.yaw)));rotations.set(id,q);
    }
    return positions;
  }
}
