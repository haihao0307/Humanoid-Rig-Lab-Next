import {JointMoveGuard,jointDecision,TOLERANCE_M} from './rf311-joint-guard.mjs';
import {segmentTriangle} from './rf37-contact-probe.mjs';
// Bounded local experiment, not a replacement cloth solver or CCD.
export const POLICY=Object.freeze({outerIterations:12,dualSweeps:160,maxNodes:24,maxFaces:128,maxMoveM:.02,edgeRatioMin:.75,edgeRatioMax:1.25,linearToleranceM:1e-7});
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),norm=a=>Math.hypot(...a),point=(p,i)=>Array.from(p.subarray(i*3,i*3+3));
const triangle=(p,F,f)=>[point(p,F[f]),point(p,F[f+1]),point(p,F[f+2])];
const mix=(p,ids,w)=>[0,1,2].map(k=>ids.reduce((s,id,i)=>s+p[id*3+k]*w[i],0));
// Dual coordinate ascent for min 1/2||x||² subject to A*x >= b.
// A cap returns a measured residual, never an unproved feasibility stamp.
export function minimumNormHalfspaces(rows,n,sweeps=POLICY.dualSweeps){
 if(!Number.isInteger(n)||n<1||n>72||!Number.isInteger(sweeps)||sweeps<1||sweeps>10000)throw Error('INVALID_DOF_OR_BUDGET');
 const x=new Float64Array(n),lambda=new Float64Array(rows.length),norms=[];
 for(const r of rows){if(r.a.length!==n||!r.a.every(Number.isFinite)||!Number.isFinite(r.b))throw Error('INVALID_LINEAR_CONSTRAINT');norms.push(dot(r.a,r.a));}
 let residual=Infinity,iteration=0;
 for(;iteration<sweeps;iteration++){
  for(let j=0;j<rows.length;j++){const r=rows[j],den=norms[j];if(den<1e-24)continue;const next=Math.max(0,lambda[j]+(r.b-dot(r.a,x))/den),delta=next-lambda[j];lambda[j]=next;for(let k=0;k<n;k++)x[k]+=delta*r.a[k];}
  residual=Math.max(0,...rows.map(r=>r.b-dot(r.a,x)));if(residual<=POLICY.linearToleranceM)break;
 }
 return {delta:Array.from(x),residualM:residual,iterations:Math.min(iteration+1,sweeps),feasible:residual<=POLICY.linearToleranceM};
}
function bodyCandidates(surface,t){
 const bounds=[0,1,2].map(k=>Math.min(...t.map(p=>p[k]))-1e-10).concat([0,1,2].map(k=>Math.max(...t.map(p=>p[k]))+1e-10)),out=[],stack=[0];
 while(stack.length){const n=surface.nodes[stack.pop()],b=n.box;if([0,1,2].some(k=>b[k]>bounds[k+3]||b[k+3]<bounds[k]))continue;if(n.left>=0)stack.push(n.left,n.right);else for(let i=n.lo;i<n.hi;i++)out.push(surface.tri[i]);}return out;
}
function witnesses(a,b){
 const out=[];
 for(let i=0;i<3;i++){
  let r=segmentTriangle(a[i],a[(i+1)%3],b);if(r){const w=[0,0,0];w[i]=1-r.segmentFraction;w[(i+1)%3]=r.segmentFraction;out.push(w);}
  r=segmentTriangle(b[i],b[(i+1)%3],a);if(r)out.push(r.barycentric);
 }
 if(out.length>1)out.push([0,1,2].map(k=>out.reduce((s,w)=>s+w[k],0)/out.length));
 return out;
}
export function edgeIntegrity(original,candidate,F,faces){
 const seen=new Set();let minimum=Infinity,maximum=0;
 for(const f of faces)for(let j=0;j<3;j++){const a=F[f+j],b=F[f+(j+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);if(seen.has(key))continue;seen.add(key);const old=norm(point(original,a).map((v,k)=>v-original[b*3+k])),now=norm(point(candidate,a).map((v,k)=>v-candidate[b*3+k]));if(old<1e-12)continue;minimum=Math.min(minimum,now/old);maximum=Math.max(maximum,now/old);}
 return {minimumRatio:minimum,maximumRatio:maximum,edges:seen.size,passed:minimum>=POLICY.edgeRatioMin&&maximum<=POLICY.edgeRatioMax};
}
export class LocalContactSolver extends JointMoveGuard{
 constructor(contact,mode){super(contact,'guarded');if(!['reference','local'].includes(mode))throw Error('LOCAL_MODE');this.localMode=mode;this.attempts=[];this.attemptLimit=32;this.localExact=null;this.policy=POLICY;}
 reset(){super.reset();Object.assign(this.stats,{localAttempts:0,localAccepted:0,localRejected:0,localMS:0,localObserverMS:0,linearQueries:0});}
 sample(p,ids,w){const position=mix(p,ids,w),q=new Float64Array(4);this.surface.sample(...position,q);this.stats.linearQueries++;return {position,distanceM:q[0],normal:Array.from(q.subarray(1,4))};}
 collect(p,nodes,faces,initial,margin){
  const rows=[],F=this.s.faces,set=new Set(nodes);let crossing=0;
  const add=(id,ids,w,target=margin)=>{if(!ids.some((n,i)=>set.has(n)&&w[i]>1e-12))return;const s=this.sample(p,ids,w);rows.push({id,ids,w,target,...s});};
  for(const i of nodes)add('v'+i,[i],[1]);
  const edges=new Set();for(const f of faces){const ids=Array.from(F.subarray(f,f+3));add('c'+f,ids,[1/3,1/3,1/3]);
   for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);if(!edges.has(key)){edges.add(key);add('e'+key,[a,b],[.5,.5]);}}
   const t=triangle(p,F,f);
   for(const bf of bodyCandidates(this.surface,t)){const bt=triangle(this.surface.p,this.surface.faces,bf),ws=witnesses(t,bt);if(ws.length){crossing++;for(let k=0;k<ws.length;k++)add('x'+f+':'+bf+':'+k,ids,ws[k]);}}
  }
  let sum=0,maximum=0;for(const r of rows){const residual=Math.max(0,r.target-r.distanceM);sum+=residual*residual;maximum=Math.max(maximum,residual);}
  return {rows,merit:sum,maximumResidualM:maximum,crossing};
 }
 solve(args){
  this.syncBody();const start=performance.now(),p=this.s.p,F=this.s.faces,entry=p.slice(),budget=Math.min(POLICY.maxMoveM,Math.max(args.margin,norm(args.guide)*args.scale));
  const central=Array.from(new Set(args.movable)),oneRing=new Set(central);for(const n of central)for(const f of this.incident[n])for(let j=0;j<3;j++)if(this.s.w[F[f+j]]>0)oneRing.add(F[f+j]);
  const scopes=[central,Array.from(oneRing).sort((a,b)=>a-b)].filter((v,i,a)=>i===0||v.length!==a[0].length);
  const exact=this.step===30&&args.faceOffset===2598,record={step:this.step,faceOffset:args.faceOffset,marginM:args.margin,budgetM:budget,mode:this.localMode,scopes:[],accepted:false,continuousCollision:false};
  let solution=null;
  for(const {nodes,seed} of scopes.flatMap(nodes=>['zero','guide','normal'].map(seed=>({nodes,seed})))){
   const faces=Array.from(new Set(nodes.flatMap(n=>this.incident[n]))).sort((a,b)=>a-b),srec={nodes,seed,faces:faces.length,iterations:[],status:'SEARCH_EXHAUSTED'};record.scopes.push(srec);
   if(nodes.length>POLICY.maxNodes||faces.length>POLICY.maxFaces){srec.status='SCOPE_BUDGET';continue;}
   const index=new Map(nodes.map((n,i)=>[n,i])),n=nodes.length*3,current=entry.slice(),before=this.patch(entry,nodes,faces,exact),initial=this.collect(entry,nodes,faces,null,args.margin);
   if(seed!=='zero'){const v=seed==='guide'?args.guide:args.normal;for(const id of nodes)for(let k=0;k<3;k++)current[id*3+k]+=v[k]*args.scale;}
   if(exact)srec.before=before;
   for(let iter=0;iter<POLICY.outerIterations;iter++){
    const samples=this.collect(current,nodes,faces,initial,args.margin),rows=[];
    for(const s of samples.rows){const a=Array(n).fill(0);for(let j=0;j<s.ids.length;j++){const i=index.get(s.ids[j]);if(i!==undefined)for(let k=0;k<3;k++)a[i*3+k]+=s.w[j]*s.normal[k];}rows.push({a,b:s.target-s.distanceM,id:s.id});}
    const box=budget/Math.sqrt(3);for(let i=0;i<n;i++){const id=nodes[Math.floor(i/3)]*3+i%3,used=current[id]-entry[id],a=Array(n).fill(0);a[i]=1;rows.push({a,b:-box-used});rows.push({a:a.map(v=>-v),b:used-box});}
    const q=minimumNormHalfspaces(rows,n),step={iteration:iter,rows:rows.length,linearResidualM:q.residualM,linearFeasible:q.feasible,beforeMerit:samples.merit,beforeCrossing:samples.crossing,acceptedScale:null};
    let best=null;
    for(const scale of [1,.5,.25,.125]){const candidate=current.slice();for(let i=0;i<n;i++)candidate[nodes[Math.floor(i/3)]*3+i%3]+=q.delta[i]*scale;
     const metrics=this.collect(candidate,nodes,faces,initial,args.margin),edge=edgeIntegrity(entry,candidate,F,faces),shift=Math.max(...nodes.map(id=>norm(point(candidate,id).map((v,k)=>v-entry[id*3+k]))));
     if(!edge.passed||shift>budget+TOLERANCE_M)continue;
     const after=this.patch(candidate,nodes,faces,false),decision=jointDecision(before,after,args.margin,'c'+args.faceOffset),target=after.samples.find(s=>s.id==='c'+args.faceOffset);
     if(decision.allowed&&after.crossingPairs.length===0&&target.distanceM>=args.margin-TOLERANCE_M&&metrics.maximumResidualM<=TOLERANCE_M){
      solution={nodeMoves:nodes.map(id=>({id,delta:point(candidate,id).map((v,k)=>v-entry[id*3+k])})),maximumMoveM:shift};record.accepted=true;srec.status='LOCAL_FEASIBLE';srec.decision=decision;srec.edgeIntegrity=edge;srec.after=exact?this.patch(candidate,nodes,faces,true):after;step.acceptedScale=scale;best={candidate,metrics};break;
     }
     if(metrics.merit<samples.merit-1e-16&&(!best||metrics.merit<best.metrics.merit))best={candidate,metrics,scale};
    }
    if(best){current.set(best.candidate);step.acceptedScale=step.acceptedScale??best.scale;step.afterMerit=best.metrics.merit;step.afterCrossing=best.metrics.crossing;}
    srec.iterations.push(step);if(solution)break;if(!best){srec.status='NO_DESCENT_WITHIN_BUDGET';break;}
   }
   if(!solution){const after=this.patch(current,nodes,faces,exact);srec.decision=jointDecision(before,after,args.margin,'c'+args.faceOffset);srec.residualCrossingPairs=after.crossingPairs.length;srec.after=exact?after:{minimumM:Math.min(...after.samples.map(s=>s.distanceM)),crossingPairs:after.crossingPairs.length};srec.sourceCommitted=false;}
   if(solution)break;
  }
  if(!entry.every((v,i)=>Object.is(v,p[i])))throw Error('LOCAL_PREVIEW_MUTATED_NATIVE');
  record.elapsedMS=performance.now()-start;record.status=solution?'LOCAL_FEASIBLE':'BLOCKED_NO_CERTIFIED_LOCAL_MOVE';if(exact)this.localExact=record;if(this.attempts.length<this.attemptLimit)this.attempts.push(record);
  return {solution,record};
 }
 choose(args){
  const prior=super.choose(args);if(prior!==null)return prior;
  if(this.localMode==='reference'&&!(this.step===30&&args.faceOffset===2598))return null;
  const t=performance.now(),{solution}=this.solve(args),elapsed=performance.now()-t;
  if(this.localMode==='reference'){this.stats.localObserverMS+=elapsed;return null;}
  this.stats.localAttempts++;this.stats.localMS+=elapsed;this.stats.guardWallMS+=elapsed;
  if(solution){this.stats.blocked--;this.stats.localAccepted++;return solution;}
  this.stats.localRejected++;return null;
 }
 report(){return {...super.report(),localMode:this.localMode,localAttempts:this.attempts,localExact:this.localExact,policy:POLICY,localScope:'three mobile corners, then one-ring mobile nodes; full affected incident faces; independent body queries; endpoint-only certification',fitCertified:false,productionChanged:false};}
}
