/** R09 finite-thickness surface contact. SI units.
 * Original JS implementation: swept point/triangle + edge/edge candidates,
 * conservative advancement and explicit sewn-neighbour topology.
 * Contact forces are solved jointly with nonlinear elasticity in implicit.mjs.
 * The geometric CCD ideas are from C-IPC (2021); this is NOT the IPC optimizer.
 * All contact stats describe the simulation mesh, not a fine-mesh guarantee.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const at=(x,id)=>[x[id*3],x[id*3+1],x[id*3+2]];
const len=a=>Math.hypot(a[0],a[1],a[2]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function finish(ids,w,x,fallback){const p=[0,0,0];for(let k=0;k<ids.length;k++)for(let j=0;j<3;j++)p[j]+=w[k]*x[3*ids[k]+j];const d=len(p);return{ids,w,d,n:d>1e-13?p.map(v=>v/d):fallback};}
export function closestPT(x,ids){
 const p=at(x,ids[0]),a=at(x,ids[1]),b=at(x,ids[2]),c=at(x,ids[3]),ab=sub(b,a),ac=sub(c,a),ap=sub(p,a);
 const d1=dot(ab,ap),d2=dot(ac,ap),bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp),cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);
 let s=0,t=0,vc=d1*d4-d3*d2,vb=d5*d2-d1*d6,va=d3*d6-d5*d4;
 if(d1<=0&&d2<=0){}
 else if(d3>=0&&d4<=d3)s=1;
 else if(vc<=0&&d1>=0&&d3<=0)s=d1/(d1-d3);
 else if(d6>=0&&d5<=d6)t=1;
 else if(vb<=0&&d2>=0&&d6<=0)t=d2/(d2-d6);
 else if(va<=0&&d4-d3>=0&&d5-d6>=0){t=(d4-d3)/((d4-d3)+(d5-d6));s=1-t;}
 else{const den=va+vb+vc;if(Math.abs(den)<1e-28){let best=null;for(const pair of[[1,2],[2,3],[3,1]]){const A=at(x,ids[pair[0]]),B=at(x,ids[pair[1]]),D=sub(B,A),f=clamp(dot(sub(p,A),D)/Math.max(1e-28,dot(D,D)),0,1),w=[1,0,0,0];w[pair[0]]=f-1;w[pair[1]]=-f;const r=finish(ids,w,x,[0,1,0]);if(!best||r.d<best.d)best=r;}return best;}s=vb/den;t=vc/den;}
 const n=cross(ab,ac),L=len(n);return finish(ids,[1,s+t-1,-s,-t],x,L>1e-16?n.map(v=>v/L):[0,1,0]);
}
export function closestEE(x,ids){
 const p=at(x,ids[0]),q=at(x,ids[2]),d1=sub(at(x,ids[1]),p),d2=sub(at(x,ids[3]),q),r=sub(p,q),a=dot(d1,d1),e=dot(d2,d2),f=dot(d2,r);let s=0,t=0;
 if(a<1e-24&&e<1e-24){}
 else if(a<1e-24)t=clamp(f/e,0,1);
 else{const c=dot(d1,r);if(e<1e-24)s=clamp(-c/a,0,1);else{const b=dot(d1,d2),den=a*e-b*b;s=den>1e-24?clamp((b*f-c*e)/den,0,1):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a,0,1);}else if(t>1){t=1;s=clamp((b-c)/a,0,1);}}}
 const n=cross(d1,d2),L=len(n);return finish(ids,[1-s,s,t-1,-t],x,L>1e-16?n.map(v=>v/L):[0,1,0]);
}
function evalAt(x0,x1,ids,t,fn){const local=new Float64Array(12);for(let k=0;k<4;k++)for(let j=0;j<3;j++){const i=ids[k]*3+j;local[k*3+j]=x0[i]+t*(x1[i]-x0[i]);}const q=fn(local,[0,1,2,3]);q.ids=ids;return q;}
function separated(x0,x1,ids,n,gap,pt){
 for(const a of(pt?[0]:[0,1]))for(const b of(pt?[1,2,3]:[2,3]))for(const x of[x0,x1]){let d=0;for(let j=0;j<3;j++)d+=(x[3*ids[a]+j]-x[3*ids[b]+j])*n[j];if(d<gap+1e-10)return false;}return true;
}
/** Returns a contact before touching gap. Never treats an iteration cap as free. */
export function sweptContact(x0,x1,ids,gap,pt=true){
 const fn=pt?referencePT:referenceEE,q0=fn(x0,ids),q1=fn(x1,ids);
 if(separated(x0,x1,ids,q0.n,gap,pt)||separated(x0,x1,ids,q1.n,gap,pt))return null;
 let bound=0;for(const a of(pt?[0]:[0,1]))for(const b of(pt?[1,2,3]:[2,3])){let sq=0;for(let j=0;j<3;j++){const A=ids[a]*3+j,B=ids[b]*3+j,d=(x1[A]-x0[A])-(x1[B]-x0[B]);sq+=d*d;}bound=Math.max(bound,Math.sqrt(sq));}
 if(bound<1e-13)return q0.d<gap?{...q0,t:0,initial:true}:null;
 let t=0,q=q0;
 for(let i=0;i<96;i++){
  if(q.d<=gap+1e-9)return{...q,t,initial:t===0,conservative:true};
  const step=.9*(q.d-gap)/bound;if(t+step>=1)return null;
  if(step<1e-10)return{...q,t,conservative:true};t+=step;q=evalAt(x0,x1,ids,t,fn);
 }
 return{...q,t,conservative:true,iterationLimit:true};
}
// Numerically equivalent freestanding WASM narrow phase. The JS reference
// remains exported for differential tests. No contact pair or iteration is
// skipped for performance; the full 64-bit conservative search moves to WASM.
const referencePT=closestPT,referenceEE=closestEE;
export const ContactReference={closestPT,closestEE,sweptContact};
const native=new WebAssembly.Instance(new WebAssembly.Module(Uint8Array.from(atob(CONTACT_NARROW_WASM),c=>c.charCodeAt(0))),{math:{log:Math.log,atan2:Math.atan2}}).exports;
const input=new Float64Array(native.memory.buffer,native.inptr(),24),output=new Float64Array(native.memory.buffer,native.outptr(),16);
function nativeResult(ids,sweep=false){const q={ids,d:output[0],w:Array.from(output.subarray(1,5)),n:Array.from(output.subarray(5,8))};if(sweep){q.t=output[8];q.conservative=true;q.initial=q.t===0;if(output[9])q.iterationLimit=true;}return q;}
function nativeClosest(x,ids,pt){for(let i=0;i<4;i++)for(let j=0;j<3;j++)input[3*i+j]=x[3*ids[i]+j];native.closest(pt?1:0);return nativeResult(ids);}
closestPT=(x,ids)=>nativeClosest(x,ids,true);closestEE=(x,ids)=>nativeClosest(x,ids,false);
sweptContact=(a,b,ids,gap,pt=true)=>{for(let i=0;i<4;i++)for(let j=0;j<3;j++){input[3*i+j]=a[3*ids[i]+j];input[12+3*i+j]=b[3*ids[i]+j];}return native.swept(gap,pt?1:0)?nativeResult(ids,true):null;};
const hash=(a,b,c)=>((a*73856093)^(b*19349663)^(c*83492791))|0;
function bounds(x0,x1,ids,pad){const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const id of ids)for(let k=0;k<3;k++){b[k]=Math.min(b[k],x0[3*id+k],x1[3*id+k]);b[k+3]=Math.max(b[k+3],x0[3*id+k],x1[3*id+k]);}for(let k=0;k<3;k++){b[k]-=pad;b[k+3]+=pad;}return b;}
const overlap=(a,b)=>a[0]<=b[3]&&a[3]>=b[0]&&a[1]<=b[4]&&a[4]>=b[1]&&a[2]<=b[5]&&a[5]>=b[2];
function cells(b,size,fn){const L=b.slice(0,3).map(v=>Math.floor(v/size)),H=b.slice(3).map(v=>Math.floor(v/size));if((H[0]-L[0]+1)*(H[1]-L[1]+1)*(H[2]-L[2]+1)>500000)throw Error('Contact broadphase domain invalid; no pose accepted');for(let i=L[0];i<=H[0];i++)for(let j=L[1];j<=H[1];j++)for(let k=L[2];k<=H[2];k++)fn(hash(i,j,k));}
export class SurfaceContact{
 constructor(shell,data={}){
  this.shell=shell;this.faces=shell.tri.map(t=>({ids:t.ids,h:t.t/2}));const edges=new Map();for(const f of this.faces)for(let k=0;k<3;k++){const a=f.ids[k],b=f.ids[(k+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);if(!edges.has(key))edges.set(key,{ids:[a,b],h:f.h});else edges.get(key).h=Math.max(edges.get(key).h,f.h);}this.edges=[...edges.values()];
  this.adj=shell.adj;this.nodeParts=data.nodeParts||[];this.seamGroups=new Map();
  for(const q of data.collisionSeams||[]){const key=Math.min(q.a,q.b)+':'+Math.max(q.a,q.b);if(!this.seamGroups.has(key))this.seamGroups.set(key,[]);this.seamGroups.get(key).push(q.a<q.b?q:{...q,a:q.b,b:q.a,pointA:q.pointB,pointB:q.pointA});}this.maxHalf=Math.max(...shell.contactThickness);this.cell=Math.max(.012,Math.min(.045,Math.sqrt(shell.tri.reduce((s,f)=>s+f.area,0)/Math.max(1,this.faces.length))*1.6));
  this.seamCache=new Map();this.friction=shell.cfg.friction??.38;this.stats={method:'finite-thickness variational barriers; swept point-triangle / edge-edge; lagged friction',contactPairs:0,ccdEvents:0,ptEvents:0,eeEvents:0,frictionEvents:0,normalForceN:0,maxPenetrationMM:0,safeStep:1,limitedSteps:0,initialOverlaps:0,initialMinGapMM:null};
  this.last=[];this.initialAudit=this.audit(shell.rest,true);this.stats.initialOverlaps=this.initialAudit.penetrating;this.stats.initialMinGapMM=this.initialAudit.minClearanceMM;
 }
 skipPT(v,f){return f.some(i=>i===v||(this.nodeParts[v]===this.nodeParts[f[0]]&&this.adj[v].has(i)));}
 skipEE(a,b){return a.some(i=>b.some(j=>i===j||(this.nodeParts[a[0]]===this.nodeParts[b[0]]&&this.adj[i].has(j))));}
 candidates(x0,x1,pad=0){
  const fb=this.faces.map(f=>bounds(x0,x1,f.ids,f.h+this.maxHalf+pad)),grid=new Map(),out=[];
  for(let i=0;i<fb.length;i++)cells(fb[i],this.cell,k=>{if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);});
  for(let v=0;v<x0.length/3;v++){const b=bounds(x0,x1,[v],pad),seen=new Set();cells(b,this.cell,k=>{for(const j of grid.get(k)||[]){if(seen.has(j))continue;seen.add(j);const f=this.faces[j];if(overlap(b,fb[j])&&!this.skipPT(v,f.ids))out.push({ids:[v,...f.ids],gap:this.shell.contactThickness[v]+f.h,pt:true,key:'p'+v+':'+j});}});}
  const eb=this.edges.map(e=>bounds(x0,x1,e.ids,e.h+this.maxHalf+pad));grid.clear();
  for(let i=0;i<eb.length;i++){const a=this.edges[i],seen=new Set();cells(eb[i],this.cell,k=>{for(const j of grid.get(k)||[]){if(seen.has(j))continue;seen.add(j);const b=this.edges[j];if(overlap(eb[i],eb[j])&&!this.skipEE(a.ids,b.ids))out.push({ids:[...a.ids,...b.ids],gap:a.h+b.h,pt:false,key:'e'+j+':'+i});}});cells(eb[i],this.cell,k=>{if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);});}
  return out;
 }
 sewnNeighbour(p,q){if(this.seamCache.has(p.key))return this.seamCache.get(p.key);const yes=this.computeSewnNeighbour(p,(p.pt?closestPT:closestEE)(this.shell.rest,p.ids));this.seamCache.set(p.key,yes);return yes;}
 computeSewnNeighbour(p,q){
  const a=this.nodeParts[p.ids[0]],b=this.nodeParts[p.ids[p.pt?1:2]];if(a===undefined||b===undefined||a===b)return false;const group=this.seamGroups.get(Math.min(a,b)+':'+Math.max(a,b));if(!group)return false;
  const rest=this.shell.rest,A=[0,0,0],B=[0,0,0];for(let i=0;i<4;i++)for(let j=0;j<3;j++)(i<(p.pt?1:2)?A:B)[j]+=Math.abs(q.w[i])*rest[p.ids[i]*3+j];
  const L=a<b?A:B,R=a<b?B:A;
  const distance=(x,a,b)=>{const d=sub(b,a),v=sub(x,a),t=clamp(dot(v,d)/Math.max(1e-20,dot(d,d)),0,1);return Math.hypot(...v.map((x,j)=>x-t*d[j]));};
  for(let i=0;i<group.length;i++){const u=group[i],v=group[Math.min(i+1,group.length-1)];if(distance(L,u.pointA,v.pointA)<u.allowance&&distance(R,u.pointB,v.pointB)<u.allowance)return true;}return false;
 }
 audit(x,initial=false){let min=Infinity,penetrating=0,intersection=0,worst=[];for(const p of this.candidates(x,x)){const q=(p.pt?closestPT:closestEE)(x,p.ids);if(this.sewnNeighbour(p,q))continue;const clearance=q.d-p.gap;min=Math.min(min,clearance);if(clearance<-.00003){penetrating++;if(q.d<1e-8)intersection++;if(worst.length<16)worst.push({key:p.key,gapMM:p.gap*1000,distanceMM:q.d*1000,ids:p.ids});}}return{scope:'topologically non-neighbour simulation primitives',minClearanceMM:Number.isFinite(min)?min*1000:null,penetrating,intersection,worst};}
 report(){return{...this.stats,initialAudit:this.initialAudit,collisionSurface:'material-chart simulation triangles; displayed microtexture and rigid fittings not separately CCD-certified',guarantee:'tested cases only; not the C-IPC nonlinear optimizer'};}
}
