import {segmentTriangle} from './rf37-contact-probe.mjs';
const point=(p,i)=>Array.from(p.subarray(i*3,i*3+3));
function candidates(surface,t){
 const lo=[0,1,2].map(k=>Math.min(...t.map(p=>p[k]))-1e-10),hi=[0,1,2].map(k=>Math.max(...t.map(p=>p[k]))+1e-10),stack=[0],out=[];
 while(stack.length){const n=surface.nodes[stack.pop()],b=n.box;if([0,1,2].some(k=>b[k]>hi[k]||b[k+3]<lo[k]))continue;
 if(n.left>=0)stack.push(n.left,n.right);else for(let i=n.lo;i<n.hi;i++)out.push(surface.tri[i]);}return out;
}
/** A necessary condition only. No source position/cache/policy writes. */
export function fixedBoundary(guard,nodes){
 if(!Array.isArray(nodes)||!nodes.length||!guard?.surface)throw Error('INVALID_MOBILE_SET');
 const set=new Set(nodes),F=guard.s.faces,p=guard.s.p,surface=guard.surface;
 if(set.size!==nodes.length||nodes.some(i=>!Number.isInteger(i)||i<0||i>=guard.s.count||guard.s.w[i]<=0))throw Error('INVALID_MOBILE_SET');
 const faces=[...new Set(nodes.flatMap(i=>guard.incident[i]))].sort((a,b)=>a-b),seen=new Set(),witnesses=[];let pairTests=0;
 for(const f of faces){const ids=Array.from(F.subarray(f,f+3)),t=ids.map(i=>point(p,i));
  for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);
   if(set.has(a)||set.has(b)||seen.has(key))continue;seen.add(key);
   for(const bf of candidates(surface,t)){pairTests++;const bt=Array.from(surface.faces.subarray(bf,bf+3),i=>point(surface.p,i)),hit=segmentTriangle(t[k],t[(k+1)%3],bt);
    if(hit)witnesses.push({edge:[a,b],clothFaceOffset:f,bodyFaceOffset:bf,point:hit.point,segmentFraction:hit.segmentFraction,barycentric:hit.barycentric});
   }
  }
 }
 return {nodes:[...nodes].sort((a,b)=>a-b),faceCount:faces.length,faces,witnesses,pairTests,status:witnesses.length?'FIXED_EDGE_OBSTRUCTION':'NECESSARY_CONDITION_ONLY',sufficientForSolution:false};
}
export function planScopes(guard,central,oneRing,policy){
 if(!policy||!Number.isInteger(policy.maxNodes)||policy.maxNodes<1||policy.maxNodes>24||!Number.isInteger(policy.maxFaces)||policy.maxFaces<1||policy.maxFaces>128)throw Error('INVALID_SCOPE_BUDGET');
 const started=performance.now(),entries=[],eligible=[],seen=new Set();let pairTests=0;
 function check(nodes,label){
  const key=[...nodes].sort((a,b)=>a-b).join(',');
  if(seen.has(key))return null;seen.add(key);
  if(nodes.length>policy.maxNodes){const r={label,nodes:[...nodes],status:'NODE_BUDGET',witnesses:[],sufficientForSolution:false};entries.push(r);return r;}
  const r={label,...fixedBoundary(guard,nodes)};pairTests+=r.pairTests;
  if(r.faceCount>policy.maxFaces)r.status='FACE_BUDGET';
  entries.push(r);if(r.status==='NECESSARY_CONDITION_ONLY')eligible.push(r.nodes);return r;
 }
 check(central,'central');
 let nodes=[...oneRing].sort((a,b)=>a-b),r=check(nodes,'ring1');
 while(r?.status==='FIXED_EDGE_OBSTRUCTION'){
  if(nodes.length>=policy.maxNodes){r.stopReason='NODE_BUDGET';break;}
  const score=new Map(),present=new Set(nodes);
  for(const w of r.witnesses)for(const id of w.edge)if(!present.has(id)&&guard.s.w[id]>0)score.set(id,(score.get(id)||0)+1);
  const id=[...score].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]?.[0];
  if(id===undefined){r.stopReason='IMMUTABLE_WEIGHT_BOUNDARY';break;}
  r.addedNode=id;nodes=[...nodes,id].sort((a,b)=>a-b);r=check(nodes,'adaptive');
 }
 return {entries,eligible,pairTests,preflightMS:performance.now()-started,sourceWritten:false,searchAllowed:eligible.length>0,collisionCertified:false};
}
