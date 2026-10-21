import {MeshContact} from './mesh-contact.mjs';
import {triangleCrossing} from './rf37-contact-probe.mjs';
export const TOLERANCE_M=1e-7;
const point=(p,i)=>[p[i*3],p[i*3+1],p[i*3+2]];
const tri=(p,F,f)=>[point(p,F[f]),point(p,F[f+1]),point(p,F[f+2])];
const norm=v=>Math.hypot(...v);
export function jointDecision(before,after,margin,actedId){
 if(!Number.isFinite(margin)||margin<=0)throw Error('INVALID_MARGIN');
 if(before.samples.length!==after.samples.length)throw Error('SAMPLE_SET_CHANGED');
 const reasons=[];
 for(let i=0;i<before.samples.length;i++){
  const a=before.samples[i],b=after.samples[i];
  if(a.id!==b.id||!Number.isFinite(a.distanceM)||!Number.isFinite(b.distanceM))throw Error('INVALID_SAMPLE');
  const floor=Math.min(a.distanceM,margin);
  if(b.distanceM<floor-TOLERANCE_M)reasons.push({type:'sample_worsened',id:a.id,beforeM:a.distanceM,afterM:b.distanceM,requiredM:floor});
 }
 const oldPairs=new Set(before.crossingPairs),newPairs=after.crossingPairs.filter(k=>!oldPairs.has(k));
 if(newPairs.length)reasons.push({type:'new_strict_intersection_pairs',count:newPairs.length,examples:newPairs.slice(0,8)});
 const a=before.samples.find(s=>s.id===actedId),b=after.samples.find(s=>s.id===actedId);
 if(!a||!b)throw Error('ACTED_CENTROID_MISSING');
 if(b.distanceM<=a.distanceM+TOLERANCE_M)reasons.push({type:'no_centroid_progress',beforeM:a.distanceM,afterM:b.distanceM});
 return {allowed:reasons.length===0,reasons,remainingBelowMargin:after.samples.filter(s=>s.distanceM<margin-TOLERANCE_M).length,remainingNegative:after.samples.filter(s=>s.distanceM<0).length,remainingCrossingPairs:after.crossingPairs.length};
}
function intersectingBodyFaces(surface,triangle){
 const bounds=[0,1,2].map(k=>Math.min(...triangle.map(p=>p[k]))-1e-10).concat([0,1,2].map(k=>Math.max(...triangle.map(p=>p[k]))+1e-10));
 const stack=[0],out=[];
 while(stack.length){const n=surface.nodes[stack.pop()],b=n.box;if([0,1,2].some(k=>b[k]>bounds[k+3]||b[k+3]<bounds[k]))continue;
  if(n.left>=0){stack.push(n.left,n.right);}else for(let i=n.lo;i<n.hi;i++)out.push(surface.tri[i]);
 }
 return out;
}
export class JointMoveGuard{
 constructor(contact,mode){
  if(!['baseline','guarded'].includes(mode))throw Error('GUARD_MODE');
  this.contact=contact;this.mode=mode;this.s=contact.model.source;this.scratch=new Float64Array(this.s.p.length);this.incident=Array.from({length:this.s.count},()=>[]);
  for(let f=0;f<this.s.faces.length;f+=3)for(let k=0;k<3;k++)this.incident[this.s.faces[f+k]].push(f);
  this.surface=null;this.clock=null;this.events=[];this.eventLimit=120;this.exactRegression=null;this.frames=[];this.step=0;this.reset();
 }
 reset(){this.stats={calls:0,guideAccepted:0,normalAccepted:0,blocked:0,queryCount:0,trianglePairs:0,guardWallMS:0,observerMS:0,maxProposalM:0,maxCommittedM:0,acceptedWithResidual:0,rejectionReasons:{}};}
 begin(step){this.step=step;this.reset();}
 syncBody(){const c=this.contact;
  if(!this.surface){this.surface=new MeshContact(c.world.actor.positions.slice(),c.world.body.faces);this.clock=c.bodyMotionClock;}
  else if(this.clock!==c.bodyMotionClock){this.surface.refit(c.world.actor.positions.slice());this.clock=c.bodyMotionClock;}
 }
 patch(p,moved,faces,includeGeometry){
  const surface=this.surface,F=this.s.faces,q=new Float64Array(4),samples=[],crossingPairs=[],bodyFaces=new Set();
  const sample=(id,position)=>{const f=surface.nearest(...position,Infinity);if(f<0)throw Error('BODY_QUERY_FAILED');surface.evaluate(f,...position,q);this.stats.queryCount++;samples.push({id,distanceM:q[0],point:position,bodyFaceOffset:f});if(includeGeometry)bodyFaces.add(f);};
  for(const i of moved)sample('v'+i,point(p,i));
  for(const f of faces){const t=tri(p,F,f);sample('c'+f,[0,1,2].map(k=>(t[0][k]+t[1][k]+t[2][k])/3));
   for(const bf of intersectingBodyFaces(surface,t)){this.stats.trianglePairs++;if(triangleCrossing(t,tri(surface.p,surface.faces,bf))){crossingPairs.push(f+':'+bf);if(includeGeometry)bodyFaces.add(bf);}}
  }
  const data={samples,crossingPairs};
  if(includeGeometry)data.geometry={cloth:faces.map(f=>({faceOffset:f,nodeIds:Array.from(F.subarray(f,f+3)),triangle:tri(p,F,f)})),body:Array.from(bodyFaces).map(f=>({faceOffset:f,triangle:tri(surface.p,surface.faces,f)}))};
  return data;
 }
 choose({faceOffset,ids,movable,scale,guide,normal,margin,pass}){
  const exact=this.step===30&&pass===31&&faceOffset===2598;
  // Reference variant observes only the already identified regression operation.
  if(this.mode==='baseline'&&!exact)return guide;
  const start=performance.now();this.stats.calls++;
  try{
   if(![...guide,...normal,scale].every(Number.isFinite)||scale<=0||movable.length<1)throw Error('INVALID_PROPOSAL');
   this.syncBody();const p=this.s.p,faces=Array.from(new Set(movable.flatMap(i=>this.incident[i]))).sort((a,b)=>a-b);
   this.scratch.set(p);const before=this.patch(p,movable,faces,exact),choices=[];
   for(const [kind,correction]of [['guide',guide],['normal',normal]]){
    for(const i of movable)for(let k=0;k<3;k++)this.scratch[i*3+k]=p[i*3+k]+scale*correction[k];
    const after=this.patch(this.scratch,movable,faces,exact),decision=jointDecision(before,after,margin,'c'+faceOffset);
    choices.push({kind,correctionM:Array.from(correction),lengthM:norm(correction),decision,after:exact?after:{minimumM:Math.min(...after.samples.map(s=>s.distanceM)),negativeSamples:after.samples.filter(s=>s.distanceM<0).length,crossingPairs:after.crossingPairs.length}});
    // Every choice previews from the unchanged real state, not from previous trial.
    for(const i of movable)for(let k=0;k<3;k++)this.scratch[i*3+k]=p[i*3+k];
   }
   const chosen=choices.find(x=>x.decision.allowed)||null;
   const record={step:this.step,pass,faceOffset,ids:Array.from(ids),movable:Array.from(movable),incidentFaces:faces.length,marginM:margin,before:exact?before:{minimumM:Math.min(...before.samples.map(s=>s.distanceM)),negativeSamples:before.samples.filter(s=>s.distanceM<0).length,crossingPairs:before.crossingPairs.length},choices,selected:chosen?.kind||'blocked',applied:this.mode==='guarded',target448BeforeM:before.samples.find(s=>s.id==='v448')?.distanceM??null};
   if(exact)this.exactRegression=record;
   if(this.events.length<this.eventLimit&&((this.step>=25&&this.step<=30)||(!chosen&&this.events.length<20)))this.events.push(record);
   this.stats.maxProposalM=Math.max(this.stats.maxProposalM,norm(guide));
   if(chosen){this.stats[chosen.kind==='guide'?'guideAccepted':'normalAccepted']++;this.stats.maxCommittedM=Math.max(this.stats.maxCommittedM,chosen.lengthM);if(chosen.decision.remainingBelowMargin||chosen.decision.remainingCrossingPairs)this.stats.acceptedWithResidual++;}
   else this.stats.blocked++;
   for(const choice of choices)for(const reason of choice.decision.reasons)this.stats.rejectionReasons[reason.type]=(this.stats.rejectionReasons[reason.type]||0)+1;
   return this.mode==='baseline'?guide:chosen?chosen.correctionM:null;
  }finally{const elapsed=performance.now()-start;if(this.mode==='baseline')this.stats.observerMS+=elapsed;else this.stats.guardWallMS+=elapsed;}
 }
 end(){const result={step:this.step,...JSON.parse(JSON.stringify(this.stats))};this.frames.push(result);return result;}
 report(){return {mode:this.mode,frames:this.frames,events:this.events,eventLimit:this.eventLimit,eventsAreBoundedExamples:true,exactRegression:this.exactRegression,scope:'terminal guided centroid moves only; affected movable vertices and incident centroids; strict endpoint triangle/body intersection pairs via full-body BVH; ordinary operations unchanged',continuousCollision:false,coplanarCertified:false,fitCertified:false,productionChanged:false};}
}
