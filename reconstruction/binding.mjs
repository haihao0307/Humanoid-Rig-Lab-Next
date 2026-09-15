import {createAnatomyRules} from './anatomy-rules.mjs';
// Pure R2 binding functions shared by the worker and file assembly.
// Local math keeps the exact original workbench interpolation conventions.
function createCompactBindingTools(){
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,s)=>a.map(x=>x*s);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(...a);
const norm=a=>mul(a,1/(len(a)||1));
const dist=(a,b)=>len(sub(a,b));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const inv=q=>[-q[0],-q[1],-q[2],q[3]];
function rotate(q,v){const t=mul(cross(q.slice(0,3),v),2);return add(v,add(mul(t,q[3]),cross(q.slice(0,3),t)))}
const r2Smooth=(a,b,x)=>smooth((x-a)/Math.max(b-a,1e-9));
function r2Segment(p,a,b){const d=sub(b,a),t=clamp(dot(sub(p,a),d)/Math.max(dot(d,d),1e-12),0,1);return {t,distance:dist(p,mix(a,b,t))};}
function compactInfluences(p,rig,mask,ownership,shoulderTransition=null){
 const result=[],append=(values,scale=1)=>{for(const [id,w]of values)if(w*scale>1e-9)result.push([id,w*scale]);};
 const blend=(a,b,t)=>[[a,1-t],[b,t]],pos=id=>rig.frames.get(id).p;
 const axial=()=>{const rows=rig.spine,y=p[1];if(y>=rows.at(-1)[1])return [['head',1]];
  let i=0;while(i<rows.length-2&&y>rows[i+1][1])i++;return blend(rows[i][0],rows[i+1][0],r2Smooth(rows[i][1],rows[i+1][1],y));};
 const digits=(side,kind)=>{
  const limb=rig.segments.get(side),rays=kind==='finger'?limb.fingers:limb.toes,candidates=[];
  for(const ray of rays)for(let k=0;k<ray.ids.length;k++){
   if(ownership&&!ownership.allowed.has(ray.ids[k]))continue;
   const a=ray.points[k],b=ray.points[k+1],d=r2Segment(p,a,b);
   // Continuous inverse-distance field around source bone segments. A small
   // segment-relative core prevents a singular influence on its centreline.
   const core=dist(a,b)*.18,score=1/(d.distance*d.distance+core*core+1e-10)**2;
   candidates.push([ray.ids[k],score]);
  }
  candidates.sort((a,b)=>b[1]-a[1]);const selected=candidates.slice(0,4),sum=selected.reduce((n,a)=>n+a[1],0);
  return selected.map(([id,w])=>[id,w/sum]);
 };
 const palm=(side)=>{
  const d=rig.segments.get(side),root=d.fingers[2].points[1],axis=norm(sub(root,d.wrist)),L=dist(root,d.wrist);
  const fraction=r2Smooth(L*.18,L*.85,dot(sub(p,d.wrist),axis));
  return [[side+'_hand',1-fraction],...digits(side,'finger').map(([id,w])=>[id,w*fraction])];
 };
 const arm=(side)=>{
  const d=rig.segments.get(side),prefix=side+'_',u=norm(sub(d.elbow,d.shoulder)),w=norm(sub(d.wrist,d.elbow));
  const shoulder=r2Smooth(-d.shoulderRadius*2,d.shoulderRadius*2,dot(sub(p,d.shoulder),u));
  const elbow=r2Smooth(-d.shoulderRadius*1.6,d.shoulderRadius*1.6,dot(sub(p,d.elbow),norm(add(u,w))));
  const width=dist(d.elbow,d.wrist)*.08,hand=r2Smooth(-width,width,dot(sub(p,d.wrist),w));
  const twist=clamp(r2Segment(p,d.elbow,d.wrist).t,0,1),forearm=elbow*(1-hand);
  return [[prefix+'AC',1-shoulder],[prefix+'upperArm',shoulder*(1-elbow)],
   [prefix+'forearm',shoulder*forearm*(1-twist)],[prefix+'radiusRotation',shoulder*forearm*twist],
   ...palm(side).map(([id,v])=>[id,v*shoulder*elbow*hand])];
 };
 const foot=side=>{
  const d=rig.segments.get(side),base=pos(side+'_midfoot'),front=d.toes[2].points[1],axis=norm(sub(front,d.ankle));
  const mid=r2Smooth(0,dist(d.ankle,base),dot(sub(p,d.ankle),axis));
  const toe=r2Smooth(dist(d.ankle,base),dist(d.ankle,front),dot(sub(p,d.ankle),axis));
  return [[side+'_foot',1-mid],[side+'_midfoot',mid*(1-toe)],...digits(side,'toe').map(([id,w])=>[id,w*mid*toe])];
 };
 const leg=(side,pelvicDomain=false)=>{
  const d=rig.segments.get(side),u=norm(sub(d.knee,d.hip)),w=norm(sub(d.ankle,d.knee));
  let hip=r2Smooth(-d.hipRadius,d.hipRadius*5,dot(sub(p,d.hip),u));
  if(pelvicDomain){
   // The pelvic midline (including the pubic surface) belongs to the pelvis.
   // It must not be pulled apart by averaging opposite femoral rotations.
   // Blend into the ipsilateral hip only outside the medial pelvic core.
   const centre=(rig.segments.get('left').hip[0]+rig.segments.get('right').hip[0])*.5;
   const half=Math.abs(d.hip[0]-centre),lateral=Math.abs(p[0]-centre);
   hip*=r2Smooth(half*.45,half*1.15,lateral);
  }
  const knee=r2Smooth(-d.hipRadius*2,d.hipRadius*2,dot(sub(p,d.knee),norm(add(u,w))));
  const ankle=r2Smooth(-d.hipRadius*2,d.hipRadius,dot(sub(p,d.ankle),w));
  return [['hips',1-hip],[side+'_femur',hip*(1-knee)],[side+'_tibia',hip*knee*(1-ankle)],...foot(side).map(([id,v])=>[id,v*hip*knee*ankle])];
 };
 if(mask&1)append(axial());
 if(mask&4)append(axial());
 if(mask&2){
  const side=p[0]<0?'left':'right',d=rig.segments.get(side),outer=r2Smooth(Math.abs(pos(side+'_SC')[0]),Math.abs(d.shoulder[0]),Math.abs(p[0]));
  const below=1-r2Smooth(d.shoulder[1]+d.shoulderRadius,d.shoulder[1]+d.shoulderRadius*4,p[1]);
  const weight=outer*below;append(axial(),1-weight);append(arm(side),weight);
 }
 if(mask&8)append(leg(p[0]<pos('hips')[0]?'left':'right',true));
 for(const [side,armBit,handBit,legBit,footBit]of [['left',16,256,64,1024],['right',32,512,128,2048]]){
  if(mask&(armBit|handBit))append(arm(side));
  if(mask&(legBit|footBit))append(leg(side,!!(mask&8)));
 }
 if(!result.length)throw Error('Unassigned R2 anatomical region '+mask);
 if(shoulderTransition){
  const {side,distance,sign,bandMetres,fadeStartMetres}=shoulderTransition;
  const normalize=values=>{const total=values.reduce((sum,[,w])=>sum+w,0);return total>0?values.map(([id,w])=>[id,w/total]):[];};
  // The old rows have already different total mass for single and mixed masks.
  // Normalize their legal weights before fading to the common shoulder field.
  const previous=normalize(result.filter(([id])=>ownership.allowed.has(id)&&shoulderJoint(id,side)).map(([id,w])=>[id,w*ownership.caps.get(id)]));
  let axialRow=normalize(axial().filter(([id])=>/^[CTL]\d+$/.test(id)));
  if(!axialRow.length){const id=rig.spine.filter(([id])=>/^[CTL]\d+$/.test(id)).sort((a,b)=>Math.abs(a[1]-p[1])-Math.abs(b[1]-p[1]))[0]?.[0];if(!id)throw Error('Missing shoulder axial support');axialRow=[[id,1]];}
  const armRow=normalize(arm(side).filter(([id])=>shoulderJoint(id,side))),weight=r2Smooth(-bandMetres,bandMetres,sign*distance);
  const strength=1-r2Smooth(fadeStartMetres,bandMetres,distance),continuous=[...axialRow.map(([id,w])=>[id,w*(1-weight)]),...armRow.map(([id,w])=>[id,w*weight])];
  return [...previous.map(([id,w])=>[id,w*(1-strength)]),...continuous.map(([id,w])=>[id,w*strength])].filter(([,w])=>w>1e-9);
 }
 return result;
}
function shoulderJoint(id,side){return /^[CTL]\d+$/.test(id)||['SC','AC','upperArm','forearm','radiusRotation'].some(name=>id===side+'_'+name);}
// The superior lateral deltoid wraps over the humeral head. An along-bone
// threshold alone assigned almost all of this cap to the fixed clavicle and
// chest, leaving a trough when the lower, arm-bound surface rotated upward.
// This authored envelope changes weights only; neutral geometry is unchanged.
function shoulderCapPrior(p,rig,mask){
 const side=p[0]<0?'left':'right',bit=side==='left'?16:32;
 if((mask&~(2|4|bit))||!(mask&(2|4|bit)))return null;
 const d=rig.segments.get(side),ac=rig.frames.get(side+'_AC').p,r=d.shoulderRadius,y=p[1]-d.shoulder[1];
 const weight=.6*r2Smooth(-3*r,0,y)*(1-r2Smooth(3*r,6*r,y))*r2Smooth(Math.abs(ac[0]),Math.abs(d.shoulder[0])+4*r,Math.abs(p[0]));
 return weight>1e-9?{joint:side+'_upperArm',weight}:null;
}
// Whole-surface binding is built before uploading any draw chunk. Geometry IDs
// preserve coincident points; binding roots additionally pair the two sides of
// each thin source interface, without moving either side's source position.
const COMPACT_INFLUENCES=8,COMPACT_WEIGHT_SCALE=65535;
function buildCompactBinding(data,rig,progress=()=>{}){
 const rayTips=new Map([...rig.segments.values()].flatMap(limb=>[...limb.fingers,...limb.toes].map(ray=>[ray.ids.at(-1),ray.points.at(-1)])));
 const anatomy=createAnatomyRules(id=>rig.frames.get(id)?.p,(side,kind)=>rig.segments.get(side)[kind==='humerus'?'shoulderRadius':'hipRadius'],id=>rayTips.get(id));
 progress({group:"binding",phase:"graph",domain:0,total:1});
 const roots=data.bindingRoots;
 if(!(roots instanceof Uint32Array))throw Error('Missing canonical binding roots');
 const vertexNodes=new Int32Array(roots.length).fill(-1),canonical=new Float32Array(roots.length*3),rootNodes=new Map();
 const positions=[],masks=[],members=[],skin=[];let duplicateOccurrences=0;
 for(const mesh of data.meshes){
  if(!(mesh.positions instanceof Float32Array)||!(mesh.vertexIds instanceof Uint32Array)||!(mesh.regionMasks instanceof Uint16Array)||mesh.vertexIds.length!==mesh.vertices||mesh.regionMasks.length!==mesh.vertices)throw Error('Canonical source membership was lost');
  for(let i=0;i<mesh.vertices;i++){
   const id=mesh.vertexIds[i],mask=mesh.regionMasks[i];
   if(id>=roots.length||roots[id]>=roots.length||roots[roots[id]]!==roots[id])throw Error('Invalid canonical binding root');
   if(vertexNodes[id]>=0){
    for(let k=0;k<3;k++)if(!Object.is(canonical[id*3+k],mesh.positions[i*3+k]))throw Error('A shared vertex has different draw coordinates');
    duplicateOccurrences++;continue;
   }
   const root=roots[id];let node=rootNodes.get(root);
   if(node===undefined){node=rootNodes.size;rootNodes.set(root,node);positions.push(0,0,0);masks.push(0);members.push(0);skin.push(mesh.name==='skin');}
   if(skin[node]!== (mesh.name==='skin'))throw Error('Skin and feature binding identities overlap');
   vertexNodes[id]=node;masks[node]|=mask;members[node]++;
   for(let k=0;k<3;k++){const value=mesh.positions[i*3+k];if(!Number.isFinite(value))throw Error('Invalid canonical coordinate');canonical[id*3+k]=value;positions[node*3+k]+=value;}
  }
 }
 const count=rootNodes.size,jointCount=rig.jointIds.size;
 for(let i=0;i<count;i++)for(let k=0;k<3;k++)positions[i*3+k]/=members[i];
 const degrees=new Uint32Array(count),eachEdge=callback=>{
  for(const mesh of data.meshes){if(mesh.name!=='skin')continue;
   for(let k=0;k<mesh.indices.length;k+=3){
    const a=vertexNodes[mesh.vertexIds[mesh.indices[k]]],b=vertexNodes[mesh.vertexIds[mesh.indices[k+1]]],c=vertexNodes[mesh.vertexIds[mesh.indices[k+2]]];
    for(const [u,v]of [[a,b],[b,c],[c,a]])if(u!==v){callback(u,v);callback(v,u);}
   }
  }
 };
 // Positive surface-edge graph. Duplicate incidences retain triangle weighting;
 // there is no Euclidean neighbourhood linking opposite arms or fingers.
 eachEdge(a=>degrees[a]++);
 const offsets=new Uint32Array(count+1);for(let i=0;i<count;i++)offsets[i+1]=offsets[i]+degrees[i];
 const neighbors=new Uint32Array(offsets[count]),edgeLength=new Float32Array(neighbors.length),edgeWeight=new Float32Array(neighbors.length),cursor=offsets.slice();
 eachEdge((a,b)=>{const at=cursor[a]++,length=Math.hypot(...[0,1,2].map(k=>positions[a*3+k]-positions[b*3+k]));neighbors[at]=b;edgeLength[at]=length;edgeWeight[at]=1/Math.max(.001,length);});
 const seamDistance=new Float64Array(count).fill(Infinity),heap=[],bandM=.06;
 const push=(node,d)=>{let i=heap.length;heap.push([node,d]);while(i){const p=(i-1)>>>1;if(heap[p][1]<=d)break;heap[i]=heap[p];i=p;}heap[i]=[node,d];};
 const pop=()=>{const result=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[i]=heap[c];i=c;}heap[i]=last;}return result;};
 let seamNodes=0;
 for(let i=0;i<count;i++)if(skin[i]){
  let seam=members[i]>1;for(let at=offsets[i];!seam&&at<offsets[i+1];at++)seam=masks[i]!==masks[neighbors[at]];
  if(seam){seamDistance[i]=0;push(i,0);seamNodes++;}
 }
 while(heap.length){const [a,d]=pop();if(d!==seamDistance[a])continue;
  for(let at=offsets[a];at<offsets[a+1];at++){const b=neighbors[at],next=d+edgeLength[at];if(next<bandM&&next<seamDistance[b]){seamDistance[b]=next;push(b,next);}}
 }
 // A separate distance field follows existing shoulder surface edges only.
 // Coincident but disconnected skin cannot receive a shoulder transition.
 const shoulderBandM=.10,shoulderFadeWidthM=.02,shoulderSide=new Int8Array(count).fill(-1),shoulderDistance=new Float64Array(count).fill(Infinity),shoulderSign=new Int8Array(count),shoulderSeeds=[0,0],shoulderNodes=[0,0];
 // The superior deltoid needs a wider rotation transition; keep the inferior
 // axilla narrow so an elevated arm cannot drag the lower lateral chest.
 const shoulderBandAt=(side,y)=>.06+.04*r2Smooth(rig.segments.get(side).shoulder[1]-.10,rig.segments.get(side).shoulder[1]-.03,y);
 const shoulderSides=['left','right'],centreX=rig.frames.get('hips').p[0];
 for(let sideIndex=0;sideIndex<2;sideIndex++){
  const armBit=sideIndex===0?16:32,classes=new Int8Array(count),distances=new Float64Array(count).fill(Infinity);
  for(let i=0;i<count;i++){
   const mask=masks[i],x=-positions[i*3];
   if(!skin[i]||(mask&~(2|4|armBit))||!(mask&(2|4|armBit))||(sideIndex===0?x>=centreX:x<centreX))continue;
   classes[i]=mask&armBit?(mask&(2|4)?2:1):-1;
  }
  const seed=(i,d)=>{if(d<distances[i]){if(!Number.isFinite(distances[i]))shoulderSeeds[sideIndex]++;distances[i]=d;push(i,d);}};
  for(let i=0;i<count;i++)if(classes[i]){
   if(classes[i]===2)seed(i,0);
   else for(let at=offsets[i];at<offsets[i+1];at++){
    const j=neighbors[at];if(classes[j]&&classes[j]!==2&&classes[j]!==classes[i])seed(i,edgeLength[at]*.5);
   }
  }
  while(heap.length){const [i,d]=pop();if(d!==distances[i])continue;
   for(let at=offsets[i];at<offsets[i+1];at++){const j=neighbors[at],next=d+edgeLength[at];if(classes[j]&&next<shoulderBandM&&next<distances[j]){distances[j]=next;push(j,next);}}
  }
  for(let i=0;i<count;i++)if(distances[i]<shoulderBandAt(shoulderSides[sideIndex],positions[i*3+1])&&distances[i]<shoulderDistance[i]){
   shoulderSide[i]=sideIndex;shoulderDistance[i]=distances[i];shoulderSign[i]=classes[i]===2?0:classes[i];shoulderNodes[sideIndex]++;
  }
 }
 progress({group:"binding",phase:"priors",domain:0,total:count});
 const size=count*COMPACT_INFLUENCES,priorIds=new Uint16Array(size),priorWeights=new Float32Array(size),pinned=new Uint8Array(count),active=[];
 const supportWords=Math.ceil(jointCount/32),anatomicalSupport=new Uint32Array(count*supportWords);
 const scratch=new Float64Array(jointCount),touched=[],hipX=rig.frames.get('hips').p[0],hipHalf=Math.abs(rig.segments.get('left').hip[0]-rig.segments.get('right').hip[0])*.5;
 let maximumPrunedMass=0,rejectedInfluenceMass=0,ownershipFallbacks=0,stableNodes=0;
 const accumulate=(id,w)=>{if(w<=0)return;if(scratch[id]===0)touched.push(id);scratch[id]+=w;};
 function storeRow(node,ids,weights,ownership=null){
  const start=node*COMPACT_INFLUENCES;
  // Re-project EVERY step onto the full anatomical support, including legal
  // shoulder/axial neighbors whose initial prior happened to be zero.
  for(const id of touched){
   let permitted=false;
   if(ownership){const name=rig.jointNames[id];permitted=ownership.allowed.has(name);if(permitted)scratch[id]*=ownership.caps.get(name);}
   else permitted=!!(anatomicalSupport[node*supportWords+(id>>>5)]&(1<<(id&31)));
   if(!permitted){rejectedInfluenceMass+=scratch[id];scratch[id]=0;}
  }
  if(ownership&&!touched.some(id=>scratch[id]>0)){
   const p=[-positions[node*3],positions[node*3+1],positions[node*3+2]];
   const name=[...ownership.allowed].sort((a,b)=>dist(p,rig.frames.get(a).p)-dist(p,rig.frames.get(b).p))[0];
   const id=rig.jointIds.get(name);if(id===undefined)throw Error('Unknown anatomical joint '+name);
   // The scratch slot may already occur with zero weight after rejection.
   if(!touched.includes(id))touched.push(id);scratch[id]=1;ownershipFallbacks++;
  }
  touched.sort((a,b)=>scratch[b]-scratch[a]||a-b);let total=0,kept=0;for(let i=0;i<touched.length;i++){total+=scratch[touched[i]];if(i<COMPACT_INFLUENCES)kept+=scratch[touched[i]];}
  if(!(kept>0))throw Error('Empty surface binding field');maximumPrunedMass=Math.max(maximumPrunedMass,(total-kept)/total);
  for(let k=0;k<COMPACT_INFLUENCES;k++){const id=touched[k];ids[start+k]=id??0;weights[start+k]=id===undefined?0:scratch[id]/kept;}
  for(const id of touched)scratch[id]=0;touched.length=0;
 }
 for(let i=0;i<count;i++){
  const p=[-positions[i*3],positions[i*3+1],positions[i*3+2]],mask=anatomy.effectiveMask(masks[i],p);
  pinned[i]=!skin[i]||!!(mask&8)&&Math.abs(p[0]-hipX)<hipHalf*.45;
  let ownership=!skin[i]?{allowed:new Set(['head']),caps:new Map([['head',1]])}:pinned[i]?{allowed:new Set(['hips']),caps:new Map([['hips',1]])}:anatomy.resolve(p,mask);
  const shoulderWidth=shoulderSide[i]<0?0:shoulderBandAt(shoulderSides[shoulderSide[i]],p[1]);
  const shoulder=shoulderSide[i]<0?null:{side:shoulderSides[shoulderSide[i]],distance:shoulderDistance[i],sign:shoulderSign[i],bandMetres:shoulderWidth,fadeStartMetres:shoulderWidth-shoulderFadeWidthM};
  let influence=!skin[i]?[['head',1]]:pinned[i]?[['hips',1]]:compactInfluences(p,rig,mask,ownership,shoulder);
  if(shoulder){
   const allowed=new Set([...ownership.allowed].filter(id=>shoulderJoint(id,shoulder.side)));
   for(const [id,w]of influence)if(w>0){if(!shoulderJoint(id,shoulder.side))throw Error('Invalid shoulder prior support '+id);allowed.add(id);}
   for(const name of ['SC','AC','upperArm'])allowed.add(shoulder.side+'_'+name);
   // Let the two local axial rows meet across their height boundary, without
   // admitting a distant spine level, the head, the other arm or any digit.
   for(const id of [...allowed])if(/^[CTL]\d+$/.test(id)){
    const at=rig.spine.findIndex(row=>row[0]===id);
    for(const k of [at-1,at+1]){const name=rig.spine[k]?.[0];if(name&&/^[CTL]\d+$/.test(name))allowed.add(name);}
   }
   ownership={...ownership,allowed,caps:new Map([...allowed].map(id=>[id,1])),mode:'shoulder-surface-transition'};
  }
  if(skin[i]&&!pinned[i]&&(mask&(1|2|4))){
   const cranial=anatomy.cranialWeight(p);
   if(cranial>0){
    const total=influence.reduce((sum,[,w])=>sum+w,0);
    influence=cranial===1?[['head',1]]:[...influence.map(([id,w])=>[id,w*(1-cranial)/total]),['head',cranial]];
    const allowed=cranial===1?new Set(['head']):new Set([...ownership.allowed,'head']);
    const caps=cranial===1?new Map([['head',1]]):new Map([...ownership.caps,['head',1]]);
    ownership={...ownership,allowed,caps,mode:cranial===1?'segment-stable':'cranial-cervical-transition'};
   }
  }
  for(const name of ownership.allowed){const id=rig.jointIds.get(name);if(id===undefined)throw Error('Unknown anatomical support '+name);anatomicalSupport[i*supportWords+(id>>>5)]|=1<<(id&31);}
  for(const [name,w]of influence){const id=rig.jointIds.get(name);if(id===undefined)throw Error('Unknown surface joint '+name);accumulate(id,w);}
  storeRow(i,priorIds,priorWeights,ownership);
  if(ownership.allowed.size===1){pinned[i]=1;stableNodes++;}
  if(i%16384===0)progress({group:"binding",phase:"priors",domain:i,total:count});
  if(!pinned[i]&&(seamDistance[i]<bandM||shoulder)&&degrees[i])active.push(i);
 }
 let ids=priorIds.slice(),weights=priorWeights.slice(),nextIds=ids.slice(),nextWeights=weights.slice(),iterations=0,maximumChange=0;
 const tolerance=2e-5,maximumIterations=48;
 // Screened positive Jacobi diffusion, sparse top-eight projection per step.
 // This is an approximate weight field, NOT a bounded-biharmonic solver.
 for(;iterations<maximumIterations&&active.length;){maximumChange=0;
  progress({group:"binding",phase:"diffusion",domain:iterations,total:maximumIterations,activeNodes:active.length});
  for(const i of active){
   const start=i*COMPACT_INFLUENCES,fidelity=.18+.82*r2Smooth(0,bandM,seamDistance[i]);let sum=0;
   for(let at=offsets[i];at<offsets[i+1];at++)sum+=edgeWeight[at];
   for(let k=0;k<COMPACT_INFLUENCES;k++){accumulate(priorIds[start+k],fidelity*priorWeights[start+k]);accumulate(ids[start+k],.5*(1-fidelity)*weights[start+k]);}
   for(let at=offsets[i];at<offsets[i+1];at++){const offset=neighbors[at]*COMPACT_INFLUENCES,factor=.5*(1-fidelity)*edgeWeight[at]/sum;
    for(let k=0;k<COMPACT_INFLUENCES;k++)accumulate(ids[offset+k],factor*weights[offset+k]);
   }
   storeRow(i,nextIds,nextWeights);
   for(let k=0;k<COMPACT_INFLUENCES;k++){const id=ids[start+k];scratch[id]+=weights[start+k];}
   for(let k=0;k<COMPACT_INFLUENCES;k++){const id=nextIds[start+k];scratch[id]-=nextWeights[start+k];}
   for(let k=0;k<COMPACT_INFLUENCES;k++)for(const id of [ids[start+k],nextIds[start+k]]){maximumChange=Math.max(maximumChange,Math.abs(scratch[id]));scratch[id]=0;}
  }
  [ids,nextIds]=[nextIds,ids];[weights,nextWeights]=[nextWeights,weights];iterations++;
  if(maximumChange<tolerance)break;
 }
 progress({group:"binding",phase:"encode",domain:0,total:count});
 // Apply once to the final shared-root row, then use the same anatomical
 // support projection and top-eight encoding as the diffusion field. Doing
 // this per draw chunk would reopen coincident interface seams.
 let shoulderCapNodes=0,maximumShoulderCapTransfer=0;
 for(let i=0;i<count;i++)if(skin[i]){
  const p=[-positions[i*3],positions[i*3+1],positions[i*3+2]],cap=shoulderCapPrior(p,rig,anatomy.effectiveMask(masks[i],p));
  if(!cap)continue;const arm=rig.jointIds.get(cap.joint);
  if(!(anatomicalSupport[i*supportWords+(arm>>>5)]&(1<<(arm&31))))continue;
  const at=i*COMPACT_INFLUENCES;
  for(let k=0;k<COMPACT_INFLUENCES;k++)accumulate(ids[at+k],weights[at+k]*(1-cap.weight));
  accumulate(arm,cap.weight);storeRow(i,ids,weights);
  shoulderCapNodes++;maximumShoulderCapTransfer=Math.max(maximumShoulderCapTransfer,cap.weight);
 }
 const quantized=new Uint16Array(size);let maximumWeightError=0,maximumQuantizationError=0;
 for(let i=0;i<count;i++){
  const start=i*COMPACT_INFLUENCES,row=Array.from(weights.subarray(start,start+COMPACT_INFLUENCES)),sum=row.reduce((a,b)=>a+b,0);
  const raw=row.map(w=>w/sum*COMPACT_WEIGHT_SCALE),quant=raw.map(Math.floor),left=COMPACT_WEIGHT_SCALE-quant.reduce((a,b)=>a+b,0);
  const order=raw.map((x,k)=>[k,x-quant[k]]).sort((a,b)=>b[1]-a[1]||a[0]-b[0]);for(let k=0;k<left;k++)quant[order[k][0]]++;
  quantized.set(quant,start);maximumWeightError=Math.max(maximumWeightError,Math.abs(quant.reduce((a,b)=>a+b,0)/COMPACT_WEIGHT_SCALE-1));
  for(let k=0;k<COMPACT_INFLUENCES;k++)maximumQuantizationError=Math.max(maximumQuantizationError,Math.abs(quant[k]/COMPACT_WEIGHT_SCALE-row[k]/sum));
 }
 return {vertexNodes,ids,weights:quantized,report:{method:'anatomically-constrained-interface-diffusion/v2',influences:COMPACT_INFLUENCES,
  anatomyRules:anatomy.version,rejectedInfluenceMass,ownershipFallbacks,stableNodes,perIterationOwnershipProjection:true,selfCollisionImplemented:false,
  fieldNodes:count,sharedInterfaceNodes:members.filter(n=>n>1).length,duplicateOccurrences,sharedCoordinateMismatches:0,seamNodes,activeNodes:active.length,
  bandMetres:bandM,iterations,maximumIterations,tolerance,maximumChange,converged:!active.length||maximumChange<tolerance,maximumPrunedMass,
  shoulderPrior:{method:'signed-surface-distance',bandMetres:shoulderBandM,inferiorBandMetres:.06,fadeWidthMetres:shoulderFadeWidthM,seeds:shoulderSeeds,transitionNodes:shoulderNodes},
  shoulderCapPrior:{method:'source-landmark-superior-lateral-cap',nodes:shoulderCapNodes,maximumTransfer:maximumShoulderCapTransfer,anatomicalCalibration:false},
  cranialPrior:{method:'continuous-cranial-cervical-mandibular-shell/v2',source:'anatomy-rules.mjs / cranialWeight',sharedAcrossHeadNeckTorso:true,rigidSkullPins:true,anteriorMandiblePins:true,anatomicallyCalibrated:false},
  maximumWeightError,maximumQuantizationError,weightEncoding:'unorm16x8',sameBindingRootUsesOneEncodedRow:true,
  anatomicalCalibration:false,applicationExecuted:true,visualAcceptance:false}};
}
function bindCompactArrays(mesh,rig,field){
 const count=mesh.vertices,ids=new Uint16Array(count*COMPACT_INFLUENCES),weights=new Uint16Array(ids.length),colors=new Uint8Array(count*3),groupCounts={};
 for(let i=0;i<count;i++){
  const node=field.vertexNodes[mesh.vertexIds[i]],mask=mesh.regionMasks[i];if(node<0)throw Error('Missing shared surface binding');groupCounts[mask]=(groupCounts[mask]||0)+1;
  const start=node*COMPACT_INFLUENCES;ids.set(field.ids.subarray(start,start+COMPACT_INFLUENCES),i*COMPACT_INFLUENCES);weights.set(field.weights.subarray(start,start+COMPACT_INFLUENCES),i*COMPACT_INFLUENCES);
  const dominant=ids[i*COMPACT_INFLUENCES];for(let k=0;k<3;k++)colors[i*3+k]=65+(Math.imul(dominant+1,[71,137,193][k])>>>0)%175;
 }
 return {ids,weights,colors,maximumWeightError:field.report.maximumWeightError,groupCounts};
}
function collectCompactSupport(mesh,binding,rig,candidates){
 if(mesh.name!=='skin')return;
 const directions=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)directions.push([x,y,z]);
 for(let v=0;v<mesh.vertices;v++){
  const dominant=binding.ids[v*COMPACT_INFLUENCES],source=rig.frames.get(rig.jointNames[dominant]);
  const p=Array.from(mesh.positions.subarray(v*3,v*3+3));p[0]=-p[0];
  const local=rotate(inv(source.q),sub(p,source.p));let probe=null;
  directions.forEach((direction,k)=>{const key=dominant+'/'+k,score=dot(local,direction),old=candidates.get(key);
   if(!old||score>old.score){probe??={p,influences:Array.from({length:COMPACT_INFLUENCES},(_,i)=>[binding.ids[v*COMPACT_INFLUENCES+i],binding.weights[v*COMPACT_INFLUENCES+i]/COMPACT_WEIGHT_SCALE]).filter(x=>x[1]>0)};candidates.set(key,{score,probe});}});
 }
}
return {COMPACT_INFLUENCES,COMPACT_WEIGHT_SCALE,buildCompactBinding,bindCompactArrays,collectCompactSupport};
}
const {COMPACT_INFLUENCES,COMPACT_WEIGHT_SCALE,buildCompactBinding,bindCompactArrays,collectCompactSupport}=createCompactBindingTools();
export {COMPACT_INFLUENCES,COMPACT_WEIGHT_SCALE,buildCompactBinding,bindCompactArrays,collectCompactSupport};
