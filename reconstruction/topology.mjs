/** Canonical display topology, generated in memory from surface functions.
 * Coincident points, edge subdivisions and interface binding identities are
 * shared BEFORE draw chunks or attribute encoding exist. No mesh is stored.
 */
import {createAnatomyRules} from './anatomy-rules.mjs';
const STRIDE=16777216,CELL=1e-7,WELD=1e-9;
// Last-resort allocation guards, independent of adaptive display budgets.
// These are element limits, not a measurement or promise of process RAM.
const MAX_VERTICES=350000,MAX_TRIANGLES=600000,MAX_SPLITS=250000,MAX_BOUNDARIES=700000;
const edgeKey=(a,b)=>Math.min(a,b)*STRIDE+Math.max(a,b);
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const lerp=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
const dot=(a,b)=>a.reduce((n,v,k)=>n+v*b[k],0);
const sub=(a,b)=>a.map((v,k)=>v-b[k]);
function distinctTimes(values){
 const out=[];for(const t of values.sort((a,b)=>a-b))if(!out.length||t-out.at(-1)>1e-11)out.push(t);
 return out;
}

/** Propagate orientation across two-sided skin edges. Non-manifold edges are
 * not guessed across, and positions/boundaries are never moved or filled. */
export function orientSkinFaces(meshes,positions,normals,incidence){
 const skin=meshes.filter(m=>m.name==='skin'),size=skin.reduce((s,m)=>s+m.indices.length,0),count=size/3;
 const triangles=new Uint32Array(size);let offset=0;for(const m of skin){triangles.set(m.indices,offset);offset+=m.indices.length;}
 const neighbours=new Int32Array(size).fill(-1),parity=new Uint8Array(size),first=new Map();
 for(let i=0;i<size;i++){const face=Math.floor(i/3),a=triangles[i],b=triangles[face*3+(i%3+1)%3],key=edgeKey(a,b);
  if((incidence.get(key)&255)!==2)continue;
  const previous=first.get(key),direction=a<b?1:-1;
  if(previous===undefined){first.set(key,direction*(i+1));continue;}
  const slot=Math.abs(previous)-1,other=Math.floor(slot/3),same=(previous>0?1:-1)===direction;
  neighbours[i]=other;neighbours[slot]=face;parity[i]=parity[slot]=same?1:0;first.delete(key);
 }
 const flips=new Int8Array(count).fill(-1),queue=new Uint32Array(count);let flipped=0,conflicts=0,components=0;
 for(let seed=0;seed<count;seed++){if(flips[seed]!==-1)continue;components++;let head=0,tail=1,vote=0;queue[0]=seed;flips[seed]=0;
  while(head<tail){const face=queue[head++],at=face*3,[a,b,c]=triangles.subarray(at,at+3),A=a*3,B=b*3,C=c*3;
   const ux=positions[B]-positions[A],uy=positions[B+1]-positions[A+1],uz=positions[B+2]-positions[A+2],vx=positions[C]-positions[A],vy=positions[C+1]-positions[A+1],vz=positions[C+2]-positions[A+2];
   const orientation=(uy*vz-uz*vy)*(normals[A]+normals[B]+normals[C])+(uz*vx-ux*vz)*(normals[A+1]+normals[B+1]+normals[C+1])+(ux*vy-uy*vx)*(normals[A+2]+normals[B+2]+normals[C+2]);
   vote+=(flips[face]?-1:1)*orientation;
   for(let k=0;k<3;k++){const next=neighbours[at+k];if(next<0)continue;const required=flips[face]^parity[at+k];
    if(flips[next]===-1){flips[next]=required;queue[tail++]=next;}else if(flips[next]!==required)conflicts++;}
  }
  const reverse=vote<0?1:0;for(let i=0;i<tail;i++){const face=queue[i];if(flips[face]^reverse){const at=face*3+1;[triangles[at],triangles[at+1]]=[triangles[at+1],triangles[at]];flipped++;}}
 }
 offset=0;for(const m of skin){m.indices.set(triangles.subarray(offset,offset+m.indices.length));offset+=m.indices.length;}
 return {reorientedSkinTriangles:flipped,orientationComponents:components,orientationConstraintConflicts:conflicts/2};
}

export class CanonicalTopology {
 constructor(reference=null){
  this.anatomy=reference?createAnatomyRules(id=>reference.nodes[id]?.positionM,(side,kind)=>reference.sphereFits[side+'_'+kind].radiusM,id=>reference.nodes[id]?.tipM):null;
  this.bindingMasks=[];
  this.positions=[];this.normals=[];this.hasNormal=[];this.masks=[];this.parents=[];this.cells=new Map();
  this.splits=new Map();this.boundaries=new Set();this.interfaceEdges=[];
  this.rawTriangles=0;this.finalTriangles=0;
  this.stats={anatomyRules:this.anatomy?.version||null,rejectedAnatomicalWelds:0,rejectedAnatomicalInterfaces:0,rejectedInterfaceIds:[],canonicalVertices:0,weldedOccurrences:0,maximumWeldDistanceM:0,edgeSplits:0,
   conformitySplits:0,duplicateFacesRemoved:0,degenerateFacesRemoved:0,bindingPairs:0,maximumInterfaceWidthM:0,inheritedBoundaryNormals:0};
 }
 point(id){return this.positions.slice(id*3,id*3+3);}
 anatomyPoint(p){return [-p[0],p[1],p[2]];}
 canShare(a,b,p,q=p){return !this.anatomy||this.anatomy.canShare(a,b,this.anatomyPoint(p),this.anatomyPoint(q));}
 vertex(name,value){
  const p=value.p,n=value.n||[0,0,1],mask=value.regionMask;
  if(!mask||!p.every(Number.isFinite))throw Error('Invalid canonical surface point');
  const space=name==='skin'?'skin':name+'/'+n.map(v=>v>=0?1:0).join('');
  const grid=p.map(v=>Math.floor(v/CELL));
  const offsets=p.map((v,k)=>{const r=v-grid[k]*CELL;return r<=WELD?[0,-1]:CELL-r<=WELD?[0,1]:[0];});
  for(const x of offsets[0])for(const y of offsets[1])for(const z of offsets[2]){
   const bucket=this.cells.get(space+'/'+[grid[0]+x,grid[1]+y,grid[2]+z]);if(bucket===undefined)continue;
   for(const id of typeof bucket==='number'?[bucket]:bucket){const q=this.point(id),error=distance(p,q);
    if(error<=WELD){
     if(name==='skin'&&!this.canShare(this.masks[id],mask,p,q)){this.stats.rejectedAnatomicalWelds++;continue;}
     this.masks[id]|=mask;this.bindingMasks[this.root(id)]|=mask;
     if(value.n&&!this.hasNormal[id]){this.normals.splice(id*3,3,...n);this.hasNormal[id]=true;}this.stats.weldedOccurrences++;this.stats.maximumWeldDistanceM=Math.max(this.stats.maximumWeldDistanceM,error);return id;}
   }
  }
  const id=this.masks.length;if(id>=MAX_VERTICES)throw Error('重建达到顶点内存保护上限（350000），已停止生成');
  const key=space+'/'+grid,previous=this.cells.get(key);
  if(previous===undefined)this.cells.set(key,id);
  else if(typeof previous==='number')this.cells.set(key,[previous,id]);
  else previous.push(id);
  this.positions.push(...p);this.normals.push(...n);this.hasNormal.push(!!value.n);this.masks.push(mask);this.bindingMasks.push(mask);this.parents.push(id);return id;
 }
 claimTriangle(final=false){const key=final?'finalTriangles':'rawTriangles';if(this[key]>=MAX_TRIANGLES)throw Error('重建达到三角形内存保护上限（600000），已停止生成');this[key]++;}
 markBoundary(a,b){if(a!==b){const key=edgeKey(a,b);if(!this.boundaries.has(key)&&this.boundaries.size>=MAX_BOUNDARIES)throw Error('重建达到边界内存保护上限');this.boundaries.add(key);const split=this.splits.get(key);if(split){this.markBoundary(a,split.id);this.markBoundary(split.id,b);}}}
 boundaryChain(name,points,mask){
  const ids=points.map(p=>this.vertex(name,{p:p.slice(0,3),regionMask:mask}));
  for(let i=1;i<ids.length;i++)this.markBoundary(ids[i-1],ids[i]);return ids;
 }
 split(a,b,id,t=.5,depth=0){
  if(a===b||id===a||id===b||t<=1e-12||t>=1-1e-12)return;
  if(depth>64)throw Error('Inconsistent surface edge subdivision');
  // Interface knots are added after the owning charts have been sampled.
  // Inherit the source edge's shading direction, never the placeholder +Z
  // normal: it would select the wrong side of the normal field at the neck.
  if(!this.hasNormal[id]&&this.hasNormal[a]&&this.hasNormal[b]){
   const normal=lerp(this.normals.slice(a*3,a*3+3),this.normals.slice(b*3,b*3+3),t),length=Math.hypot(...normal);
   if(length>1e-12){this.normals.splice(id*3,3,...normal.map(v=>v/length));this.hasNormal[id]=true;this.stats.inheritedBoundaryNormals++;}
  }
  if(a>b){[a,b]=[b,a];t=1-t;}
  const key=edgeKey(a,b),old=this.splits.get(key);
  if(old){
   if(id===old.id)return;
   if(Math.abs(t-old.t)<1e-11)throw Error('Different surface points share one edge parameter');
   if(t<old.t)this.split(a,old.id,id,t/old.t,depth+1);
   else this.split(old.id,b,id,(t-old.t)/(1-old.t),depth+1);
   return;
  }
  if(this.splits.size>=MAX_SPLITS)throw Error('重建达到边细分内存保护上限（250000），已停止生成');
  this.splits.set(key,{id,t});this.stats.edgeSplits++;
  if(this.boundaries.has(key)){this.markBoundary(a,id);this.markBoundary(id,b);}
 }
 requirePoints(a,b,points){
  const sorted=points.filter(p=>p.t>1e-12&&p.t<1-1e-12).sort((x,y)=>x.t-y.t);
  const visit=(lo,hi)=>{if(lo>=hi)return;const mid=(lo+hi)>>>1,p=sorted[mid];this.split(a,b,p.id,p.t);visit(lo,mid);visit(mid+1,hi);};visit(0,sorted.length);
 }
 edgePoints(a,b){
  const out=[{id:a,t:0}],stack=[{a,b,lo:0,hi:1}];
  while(stack.length){const e=stack.pop(),split=this.splits.get(edgeKey(e.a,e.b));
   if(!split){out.push({id:e.b,t:e.hi});continue;}
   const u=e.a<e.b?split.t:1-split.t,t=e.lo+(e.hi-e.lo)*u;
   stack.push({a:split.id,b:e.b,lo:t,hi:e.hi},{a:e.a,b:split.id,lo:e.lo,hi:t});
  }return out;
 }
 midpoint(name,a,b,evaluate,inverse,cache=null){
  const ai=a.id??=this.vertex(name,a),bi=b.id??=this.vertex(name,b),key=edgeKey(ai,bi),split=this.splits.get(key);
  const boundary=this.boundaries.has(key),previous=cache?.get(key);
  // A later face can split an edge after it was probed. Never reuse a cached
  // midpoint against a changed canonical split or boundary classification.
  if(previous&&previous.split===split&&previous.boundary===boundary){
   const v=previous.value;return previous.from===ai?v:{...v,edgeFraction:1-(v.edgeFraction??.5)};
  }
  let value;
  if(split){const p=this.point(split.id),v=evaluate(inverse(p));value={...v,p,id:split.id,edgeFraction:ai<bi?split.t:1-split.t};}
  else if(boundary){const p=lerp(this.point(ai),this.point(bi),.5),v=evaluate(inverse(p));value={...v,p};}
  else value=evaluate(lerp(a.uv,b.uv,.5));
  if(cache){if(cache.size>=32768)cache.clear();cache.set(key,{split,boundary,from:ai,value});}
  return value;
 }
 root(id){let r=id;while(this.parents[r]!==r)r=this.parents[r];while(this.parents[id]!==id){const next=this.parents[id];this.parents[id]=r;id=next;}return r;}
 shareBinding(a,b){
  const x=this.root(a),y=this.root(b);
  if(x!==y&&!this.canShare(this.bindingMasks[x],this.bindingMasks[y],this.point(a),this.point(b)))throw Error('Rejected transitive anatomical interface');
  if(x!==y){this.bindingMasks[Math.min(x,y)]=this.bindingMasks[x]|this.bindingMasks[y];this.parents[Math.max(x,y)]=Math.min(x,y);this.stats.bindingPairs++;}
  this.stats.maximumInterfaceWidthM=Math.max(this.stats.maximumInterfaceWidthM,distance(this.point(a),this.point(b)));
 }
 addInterfaceEdge(a,b){if(a!==b)this.interfaceEdges.push([a,b]);}
 finalize(rawMeshes){
  const incidence=new Map(),faces=new Set(),meshes=[];let conformityVisits=0;
  const degenerate=(a,b,c)=>{
   if(a===b||b===c||c===a)return true;
   const pa=this.point(a),u=sub(this.point(b),pa),v=sub(this.point(c),pa),edge=sub(v,u);
   const area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);
   // At the canonical weld resolution, nearly collinear faces can cycle
   // through different edge splits. Reject BEFORE walking that split forest.
   return area<=Math.max(1e-20,2*WELD*Math.max(Math.hypot(...u),Math.hypot(...v),Math.hypot(...edge)));
  };
  for(const mesh of rawMeshes){
   const indices=[],stack=[];
   const accept=(a,b,c)=>{
    if(a===b||b===c||c===a){this.stats.degenerateFacesRemoved++;return;}
    const pa=this.point(a),u=sub(this.point(b),pa),v=sub(this.point(c),pa);
    if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-20){this.stats.degenerateFacesRemoved++;return;}
    const key=[a,b,c].sort((x,y)=>x-y).join(',');if(faces.has(key)){this.stats.duplicateFacesRemoved++;return;}this.claimTriangle(true);faces.add(key);
    indices.push(a,b,c);
    if(mesh.name==='skin')for(const [x,y]of [[a,b],[b,c],[c,a]]){const edge=edgeKey(x,y),previous=incidence.get(edge)||0;
     if((previous&255)===255)throw Error('Excessive coincident surface faces');
     incidence.set(edge,previous+1+(x<y?256:-256));
    }
   };
   for(let i=0;i<mesh.indices.length;i+=3){
    stack.push([mesh.indices[i],mesh.indices[i+1],mesh.indices[i+2]]);
    while(stack.length){const tri=stack.pop();let divided=false;
     if(++conformityVisits>MAX_TRIANGLES*8)throw Error('曲面共享边细分超过工作保护上限，已停止生成');
     if(degenerate(...tri)){this.stats.degenerateFacesRemoved++;continue;}
     for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],c=tri[(k+2)%3],split=this.splits.get(edgeKey(a,b));
      if(split){stack.push([split.id,b,c],[a,split.id,c]);this.stats.conformitySplits++;divided=true;break;}
     }
     if(!divided)accept(...tri);
    }
   }
   if(indices.length)meshes.push({...mesh,indices:Uint32Array.from(indices)});
   mesh.indices=null;
  }
  Object.assign(this.stats,orientSkinFaces(meshes,this.positions,this.normals,incidence));
  incidence.clear();for(const mesh of meshes)if(mesh.name==='skin')for(let i=0;i<mesh.indices.length;i+=3)for(let k=0;k<3;k++){
   const a=mesh.indices[i+k],b=mesh.indices[i+(k+1)%3],key=edgeKey(a,b);incidence.set(key,(incidence.get(key)||0)+1+(a<b?256:-256));}
  let openSkinEdges=0,nonManifoldSkinEdges=0,inconsistentWindingEdges=0;
  for(const value of incidence.values()){const count=value&255;if(count===1)openSkinEdges++;if(count>2)nonManifoldSkinEdges++;if(count===2&&(value>>8)!==0)inconsistentWindingEdges++;}
  const declaredEdges=new Set();for(const [a,b]of this.interfaceEdges){const chain=this.edgePoints(a,b);for(let k=1;k<chain.length;k++)declaredEdges.add(edgeKey(chain[k-1].id,chain[k].id));}
  const unpairedInterfaceEdges=[...declaredEdges].filter(key=>(incidence.get(key)&255)!==2).length;
  const missingNormals=new Set();for(const mesh of meshes)for(const id of mesh.indices)if(!this.hasNormal[id])missingNormals.add(id);
  this.stats={...this.stats,canonicalVertices:this.masks.length,openSkinEdges,nonManifoldSkinEdges,inconsistentWindingEdges,
   declaredInterfaceEdges:declaredEdges.size,unpairedInterfaceEdges,sharedEdgeSubdivision:true,missingSourceNormals:missingNormals.size,
   closedEdgeIncidence:openSkinEdges===0&&nonManifoldSkinEdges===0&&inconsistentWindingEdges===0,
   fullClosedManifold:false,vertexLinkCheck:false,selfIntersectionCheck:false,
   weldToleranceM:WELD,applicationExecuted:true,visualAcceptance:false};
  const roots=Uint32Array.from(this.parents,(_,id)=>this.root(id));
  this.cells.clear();this.splits.clear();this.boundaries.clear();this.interfaceEdges=[];
  return {meshes,roots,report:{...this.stats}};
 }
 materialize(mesh){
  const map=new Map();for(const id of mesh.indices)if(!map.has(id))map.set(id,map.size);
  const count=map.size,positions=new Float32Array(count*3),normals=new Float32Array(count*3),regionMasks=new Uint16Array(count),vertexIds=new Uint32Array(count),indices=new Uint32Array(mesh.indices.length);let maximumFloat32ErrorM=0;
  for(const [id,local]of map){const p=this.point(id),encoded=p.map(Math.fround);
   maximumFloat32ErrorM=Math.max(maximumFloat32ErrorM,distance(p,encoded));positions.set(encoded,local*3);normals.set(this.normals.slice(id*3,id*3+3),local*3);regionMasks[local]=this.masks[id];vertexIds[local]=id;
  }
  for(let i=0;i<indices.length;i++)indices[i]=map.get(mesh.indices[i]);
  return {name:mesh.name,sourceGroup:mesh.sourceGroup,positions,normals,regionMasks,vertexIds,indices,maximumFloat32ErrorM};
 }
 releaseGeometry(){this.positions.length=0;this.normals.length=0;this.hasNormal.length=0;this.masks.length=0;this.parents.length=0;this.bindingMasks.length=0;}
}

/** Restore boundary knots omitted by polygon triangulation. The points already
 * belong to the source trim; this adds connectivity, never a new surface fit. */
export function conformTrimFaces(uv,faces){
 const order=uv.map((p,id)=>({u:p[0],id})).sort((a,b)=>a.u-b.u),cache=new Map(),out=[];
 // Stop malformed or overlapping input before temporary faces can exhaust
 // the Worker heap; this guard runs before any final mesh allocation guard.
 const visitLimit=8*(faces.length+uv.length+1);let visits=0;
 const lower=value=>{let a=0,b=order.length;while(a<b){const mid=(a+b)>>>1;if(order[mid].u<value)a=mid+1;else b=mid;}return a;};
 function points(a,b){const key=Math.min(a,b)+','+Math.max(a,b);if(cache.has(key))return cache.get(key);
  const A=uv[a],B=uv[b],d=sub(B,A),length2=dot(d,d),found=[];
  if(length2>1e-24)for(let at=lower(Math.min(A[0],B[0])-1e-12);at<order.length&&order[at].u<=Math.max(A[0],B[0])+1e-12;at++){
   const id=order[at].id;if(id===a||id===b)continue;const p=uv[id],delta=sub(p,A),t=dot(delta,d)/length2;
   if(t>1e-10&&t<1-1e-10&&Math.hypot(...sub(delta,d.map(v=>v*t)))<=1e-12)found.push({id,t});
  }
  found.sort((x,y)=>x.t-y.t);const ids=found.map(p=>p.id);cache.set(key,ids);return ids;
 }
 for(const face of faces){const stack=[face];while(stack.length){const tri=stack.pop();let split=false;
  if(++visits>visitLimit)throw Error('Compact trim conformity work limit exceeded');
  const [a,b,c]=tri;if(a===b||b===c||c===a)continue;
  const ab=sub(uv[b],uv[a]),ac=sub(uv[c],uv[a]),bc=sub(uv[c],uv[b]);
  const area2=Math.abs(ab[0]*ac[1]-ab[1]*ac[0]),longest=Math.max(Math.hypot(...ab),Math.hypot(...ac),Math.hypot(...bc));
  // Use the same 1 pm line tolerance as points(). Otherwise an almost
  // collinear opposite vertex can be selected as an edge knot, producing
  // overlapping degenerate children exponentially (source chart body/293).
  if(area2<=longest*1e-12)continue;
  for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],c=tri[(k+2)%3],chain=points(a,b).filter(id=>id!==c);if(chain.length){const m=chain[chain.length>>>1];stack.push([m,b,c],[a,m,c]);split=true;break;}}
  if(!split)out.push(tri);
 }}return out;
}

export function boundaryTrack(topology,polyline,range,mask){
 const nodes=polyline.map(p=>({u:p[3],p:p.slice(0,3)})),ids=topology.boundaryChain('skin',polyline,mask);
 const segment=u=>{let a=0,b=nodes.length-2;while(a<b){const mid=(a+b)>>>1;if(u>nodes[mid+1].u)a=mid+1;else b=mid;}return a;};
 const point=t=>{const u=range[0]+t*(range[1]-range[0]),k=segment(u),a=nodes[k],b=nodes[k+1],ratio=Math.max(0,Math.min(1,(u-a.u)/(b.u-a.u)));
  const p=lerp(a.p,b.p,ratio),id=topology.vertex('skin',{p,regionMask:mask});return {id,t,k,ratio};};
 function ensure(times){const groups=new Map();for(const t of times){const q=point(t);if(!groups.has(q.k))groups.set(q.k,[]);groups.get(q.k).push({id:q.id,t:q.ratio});}
  for(const [k,points]of groups)topology.requirePoints(ids[k],ids[k+1],points);
 }
 function samples(){const out=[];
  for(let k=0;k<nodes.length-1;k++){
   if(nodes[k+1].u<Math.min(...range)-1e-12||nodes[k].u>Math.max(...range)+1e-12)continue;
   for(const q of topology.edgePoints(ids[k],ids[k+1])){const u=nodes[k].u+(nodes[k+1].u-nodes[k].u)*q.t,t=(u-range[0])/(range[1]-range[0]);
    if(t>=-1e-11&&t<=1+1e-11)out.push({id:q.id,t:Math.max(0,Math.min(1,t))});
   }
  }
  out.sort((a,b)=>a.t-b.t);return out.filter((q,i)=>!i||q.t-out[i-1].t>1e-11);
 }
 ensure([0,1]);return {ensure,samples,point,mask};
}

export function connectInterfaces(topology,strips,tracks){
 const pairs=strips.map(s=>{const a=tracks.get(s.id+'/a'),b=tracks.get(s.id+'/b');if(!a||!b)throw Error('Missing source interface '+s.id);return {id:s.id,a,b};});
 let stable=false,passes=0;
 for(;passes<8;passes++){const before=topology.stats.edgeSplits;
  for(const p of pairs){const ts=distinctTimes([...p.a.samples().map(x=>x.t),...p.b.samples().map(x=>x.t)]);p.a.ensure(ts);p.b.ensure(ts);}
  if(topology.stats.edgeSplits===before){stable=true;break;}
 }
 if(!stable)throw Error('Source interface knot propagation did not converge');
 const indices=[];
 for(const p of pairs){const ts=distinctTimes([...p.a.samples().map(x=>x.t),...p.b.samples().map(x=>x.t)]),a=ts.map(t=>p.a.point(t).id),b=ts.map(t=>p.b.point(t).id);
  // Reject the whole strip before creating faces or shared deformation roots.
  if(a.some((id,k)=>!topology.canShare(p.a.mask,p.b.mask,topology.point(id),topology.point(b[k])))){
   topology.stats.rejectedAnatomicalInterfaces++;topology.stats.rejectedInterfaceIds.push(p.id);continue;
  }
  for(let k=0;k<ts.length;k++){
   // Distinct source positions retain their shape. They share ONE deformation
   // field, so a thin joining strip cannot inflate into an independently moving flap.
   topology.shareBinding(a[k],b[k]);
   if(k+1<ts.length){topology.claimTriangle();topology.claimTriangle();indices.push(a[k],a[k+1],b[k],a[k+1],b[k+1],b[k]);topology.addInterfaceEdge(a[k],a[k+1]);topology.addInterfaceEdge(b[k],b[k+1]);}
  }
 }
 return {mesh:{name:'skin',sourceGroup:'bridges',indices:Uint32Array.from(indices)},passes:passes+1};
}

/** Insert radial chart boundary samples into their canonical piecewise-linear
 * trim segments. This is required because angular and linear parameters differ. */
export function registerRadialBoundary(topology,chains,points,mask){
 const groups=new Map();
 for(const p of points){let best=null;
  for(const ids of chains)for(let i=1;i<ids.length;i++){
   const a=ids[i-1],b=ids[i],A=topology.point(a),d=sub(topology.point(b),A),length2=dot(d,d);if(length2<1e-24)continue;
   const t=Math.max(0,Math.min(1,dot(sub(p,A),d)/length2)),error=distance(p,lerp(A,topology.point(b),t));
   if(!best||error<best.error)best={a,b,t,error};
  }
  if(!best||best.error>WELD*2)throw Error('Radial boundary does not match its source trim');
  const key=edgeKey(best.a,best.b),id=topology.vertex('skin',{p,regionMask:mask});
  if(!groups.has(key))groups.set(key,{a:best.a,b:best.b,points:[]});const group=groups.get(key);group.points.push({id,t:best.a===group.a?best.t:1-best.t});
 }
 for(const {a,b,points:required}of groups.values())topology.requirePoints(a,b,required);
}
