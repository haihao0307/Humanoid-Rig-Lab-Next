// Disposable runtime fields, derived from the existing rig and eight weights.
// No sampled anatomy, vertices or new model asset is persisted.
export function tissueRegion(name){
 if(/^(hand_|thumb_|index_|middle_|ring_|pinky_|foot_|ball_)/.test(name))return [0,0,0,1];
 if(/^(upperarm_|lowerarm_)/.test(name))return [0,1,0,0];
 if(/^(thigh_|calf_)/.test(name))return [0,0,1,0];
 if(/^clavicle_/.test(name))return [.4,.6,0,0];
 if(/^(pelvis$|spine_)/.test(name))return [1,0,0,0];
 return [0,0,0,0];
}
export function nearestSegment(p,a,b){const d=b.map((v,k)=>v-a[k]),length=d.reduce((s,v)=>s+v*v,0),t=length>1e-12?Math.max(0,Math.min(1,d.reduce((s,v,k)=>s+(p[k]-a[k])*v,0)/length)):0;return a.map((v,k)=>v+d[k]*t);}
export function createTissueFields({position,skinIndex,skinWeight,bones,inverses,analysis}){
 const byName=new Map(bones.map((b,i)=>[b.name,i])),points=inverses.map(m=>{const e=m.clone().invert().elements;return [e[12],e[13],e[14]];}),regions=bones.map(b=>tissueRegion(b.name));
 const segments=bones.map((b,i)=>{const name=b.name,side=name.endsWith('_l')?'_l':'_r';let next;
  if(name.startsWith('upperarm_'))next='lowerarm'+side;else if(name.startsWith('lowerarm_'))next='hand'+side;
  else if(name.startsWith('thigh_'))next='calf'+side;else if(name.startsWith('calf_'))next='foot'+side;
  else if(name.startsWith('hand_'))next='middle_01'+side;else if(name.startsWith('foot_'))next='ball'+side;
  else next=b.children.find(c=>c.isBone)?.name;
  const start=/_twist_/.test(name)?points[byName.get(name.replace(/_twist_01/,''))]:points[i];
  const end=byName.has(next)?points[byName.get(next)]:name.startsWith('ball_')?[start[0],start[1],start[2]+.04]:start;
  return [start,end];
 });
 if(analysis){if(!analysis.canDeform)throw Error('Anatomy requires review before body deformation');for(let i=0;i<bones.length;i++){regions[i]=analysis.segments[i].region;segments[i]=[analysis.segments[i].start,analysis.segments[i].end];}}
 const count=position.length/3,region=new Float32Array(count*4),anchor=new Float32Array(count*3),coverage={torso:0,arm:0,leg:0,hand:0,foot:0,head:0};
 for(let i=0;i<count;i++){const p=Array.from(position.subarray(i*3,i*3+3)),a=[0,0,0];let total=0;
  for(let k=0;k<8;k++){const w=skinWeight[i*8+k];if(!w)continue;const id=skinIndex[i*8+k],r=regions[id],limb=r[1]+r[2]+r[3];for(let j=0;j<4;j++)region[i*4+j]+=w*r[j];if(limb){const q=nearestSegment(p,...segments[id]);for(let j=0;j<3;j++)a[j]+=q[j]*w*limb;total+=w*limb;}}
  for(let j=0;j<3;j++)anchor[i*3+j]=total?a[j]/total:p[j];
  const r=region.subarray(i*4,i*4+4);if(r[0]>.1)coverage.torso++;if(r[1]>.1)coverage.arm++;if(r[2]>.1)coverage.leg++;if(r[3]>.1)coverage[p[1]<.3?'foot':'hand']++;if(r.reduce((s,v)=>s+v,0)<.1)coverage.head++;
 }
 return {region,anchor,coverage,context:index=>({region:Array.from(region.subarray(index*4,index*4+4)),anchor:Array.from(anchor.subarray(index*3,index*3+3))}),bytes:region.byteLength+anchor.byteLength};
}
