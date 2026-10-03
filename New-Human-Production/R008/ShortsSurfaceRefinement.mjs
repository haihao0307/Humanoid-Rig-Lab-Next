import * as THREE from 'three';

// Refine the cut domains, not just the rendered mesh. Each new material point
// retains its barycentric source-paper provenance. Geometry is evaluated by
// the continuous fitted surface; rest UV, area and mass never come from XYZ.
export function refineShortsSurfaceDraft(draft, coarseCloth, levels=2){
 if(!Number.isInteger(levels)||levels<0||levels>2)throw Error('Surface refinement supports zero to two exact paper subdivisions');
 if(typeof coarseCloth.surfaceEvaluator!=='function')throw Error('Continuous source-domain surface evaluator required');
 const pieces=structuredClone(draft.pieces),oldRanges=new Map(draft.ranges.map(r=>[r.pieceId,r])),states=new Map();
 for(const piece of pieces){
  const weights=piece.materialCoordinates.map((_,i)=>new Map([[i,1]])),edges=new Map();
  const mid=(a,b)=>{
   const key=[Math.min(a,b),Math.max(a,b)].join(':');if(edges.has(key))return edges.get(key);
   const i=piece.materialCoordinates.length,u=piece.materialCoordinates[a],v=piece.materialCoordinates[b],w=new Map();
   piece.materialCoordinates.push([(u[0]+v[0])/2,(u[1]+v[1])/2]);
   for(const id of [a,b])for(const[k,x]of weights[id])w.set(k,(w.get(k)||0)+x/2);
   weights.push(w);edges.set(key,i);return i;
  };
  let tris=piece.triangles.map(t=>t.slice());
  for(let level=0;level<levels;level++){
   const next=[];for(const[a,b,c]of tris){const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);next.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]);}tris=next;
  }
  const refineChain=chain=>{let out=chain.slice();for(let k=0;k<levels;k++){const next=[];for(let i=0;i<out.length-1;i++){next.push(out[i]);const id=edges.get([Math.min(out[i],out[i+1]),Math.max(out[i],out[i+1])].join(':'));if(id===undefined)throw Error('Material boundary is not a triangle edge in '+piece.id);next.push(id);}next.push(out.at(-1));out=next;}return out;};
  for(const[key,chain]of Object.entries(piece.boundaries||{}))piece.boundaries[key]=refineChain(chain);
  piece.triangles=tris;piece.surfaceRefinement={levels,originalGrid:structuredClone(piece.grid),originalParticleCount:weights.filter(w=>w.size===1).length,restAuthority:'exact subdivision of original independent 2D cut domain'};
  states.set(piece.id,{weights,edges,refineChain});
 }
 const ranges=[];let count=0;for(const p of pieces){ranges.push({pieceId:p.id,offset:count,count:p.materialCoordinates.length});count+=p.materialCoordinates.length;}
 const byId=new Map(ranges.map(r=>[r.pieceId,r])),positions=new Float64Array(count*3),sourceUV=new Float64Array(count*2),masses=new Float64Array(count),indices=[],actorPosition=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
 coarseCloth.actor.matrixWorld.decompose(actorPosition,rotation,scale);const inverseFrame=new THREE.Matrix4().compose(actorPosition,rotation,new THREE.Vector3(1,1,1)).invert();
 let sourceAreaM2=0;
 for(const piece of pieces){
  const range=byId.get(piece.id),weights=states.get(piece.id).weights;
  piece.materialCoordinates.forEach((uv,i)=>{
   sourceUV.set(uv,(range.offset+i)*2);const provenance=[...weights[i]];while(provenance.length<3)provenance.push([provenance[0][0],0]);const world=coarseCloth.surfaceEvaluator(piece.id,{sourceIndices:provenance.map(e=>e[0]),weights:provenance.map(e=>e[1])});
   if(!world||world.length!==3||world.some(v=>!Number.isFinite(v)))throw Error('Invalid evaluated surface '+piece.id+'/'+i);
   new THREE.Vector3().fromArray(world).applyMatrix4(inverseFrame).toArray(positions,(range.offset+i)*3);
  });
  for(const tri of piece.triangles){const[a,b,c]=tri.map(i=>piece.materialCoordinates[i]),area=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;if(!(area>1e-14))throw Error('Refined source paper is degenerate');sourceAreaM2+=area;for(const i of tri){indices.push(range.offset+i);masses[range.offset+i]+=area*draft.densityKgM2/3;}}
 }
 const seams=draft.seams.map(seam=>{
  const aId=seam.a.pieceId,bId=seam.b.pieceId,oldA=oldRanges.get(aId),oldB=oldRanges.get(bId),a=states.get(aId).refineChain(seam.pairs.map(p=>p.a-oldA.offset)),b=states.get(bId).refineChain(seam.pairs.map(p=>p.b-oldB.offset));
  if(a.length!==b.length)throw Error('Refined paired material boundaries differ');
  const pairs=a.map((id,i)=>({a:byId.get(aId).offset+id,b:byId.get(bId).offset+b[i],t:i/(a.length-1)}));
  return {...structuredClone(seam),a:{...seam.a,indices:a},b:{...seam.b,indices:b},pairs};
 });
 const parent=Array.from({length:count},(_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));for(const s of seams)for(const p of s.pairs)parent[find(p.b)]=find(p.a);
 const groups=new Map();for(let i=0;i<count;i++){const q=find(i);if(!groups.has(q))groups.set(q,[]);groups.get(q).push(i);}const seamGroups=[...groups.values()],quotientMap=new Uint32Array(count);
 let maximumRawSeamGapM=0;for(const group of seamGroups){const first=new THREE.Vector3().fromArray(positions,group[0]*3);for(const i of group)maximumRawSeamGapM=Math.max(maximumRawSeamGapM,first.distanceTo(new THREE.Vector3().fromArray(positions,i*3)));}
 if(maximumRawSeamGapM>1e-7)throw Error('Continuous surface boundaries do not match: '+maximumRawSeamGapM+'m');
 seamGroups.forEach((g,q)=>g.forEach(i=>quotientMap[i]=q));
 const band=pieces.filter(p=>p.kind==='waistband'),waistIndices=band.flatMap(p=>p.boundaries.upper.slice(0,-1).map(i=>byId.get(p.id).offset+i));
 const middleChains=band.map(p=>{const original=draft.pieces.find(o=>o.id===p.id),n=original.grid.columns,chain=Array.from({length:n+1},(_,c)=>n+1+c);return states.get(p.id).refineChain(chain).slice(0,-1).map(i=>byId.get(p.id).offset+i);}),middleIndices=middleChains.flat(),subdivisions=2**levels;
 const elasticEdges=middleIndices.map((a,i)=>{const sourceEdge=draft.elasticEdges[Math.floor(i/subdivisions)];if(!sourceEdge)throw Error('Independent elastic source segment missing');const restLengthM=sourceEdge.restLengthM/subdivisions;return {...sourceEdge,a,b:middleIndices[(i+1)%middleIndices.length],restLengthM,restLength:restLengthM,compliance:sourceEdge.compliance/subdivisions,currentLengthM:Math.hypot(...Array.from(positions.subarray(a*3,a*3+3)).map((v,k)=>v-positions[middleIndices[(i+1)%middleIndices.length]*3+k]))};});
 const casingStitchPaths=['lower','upper'].map(edge=>({edge,indices:band.flatMap(p=>p.boundaries[edge].slice(0,-1).map(i=>byId.get(p.id).offset+i)),closed:true}));
 const areaErrorM2=Math.abs(sourceAreaM2-draft.receipt.areaM2),massKg=masses.reduce((s,m)=>s+m,0);if(areaErrorM2>1e-9||Math.abs(massKg-draft.receipt.massKg)>1e-9)throw Error('Refinement changed original material area or mass');
 return {...draft,version:'r008-continuous-source-surface-refinement@1',positions,sourceUV,uvs:sourceUV,triangles:Uint32Array.from(indices),masses,mass:masses,pieces,ranges,seams,seamGroups,quotientMap,waistIndices:Uint32Array.from(waistIndices),elasticEdges,casingStitchPaths,casing:{...draft.casing,stitchPaths:casingStitchPaths,middleIndices:Uint32Array.from(middleIndices)},pattern:{...draft.pattern,pieces},receipt:{...draft.receipt,surfaceRefinement:{levels,triangles:indices.length/3,sourceParticles:count,quotientDofs:seamGroups.length,sourceAreaM2,areaErrorM2,massKg,maximumRawSeamGapM,renderAndAuditUseSameMesh:true,restFromXYZ:false,elasticChannelRetained:true,physicalWearingCertified:false}}};
}
