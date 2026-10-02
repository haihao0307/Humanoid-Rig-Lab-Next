import earcut from './vendor/earcut.js';
export function createSeamSynchronizer(surface,geometry){
 const membership=new Map();for(const row of surface.seamGroups)for(const id of row)membership.set(id,row);
 return changedIds=>{const affected=new Map();for(const id of changedIds){const row=membership.get(id);if(!row)continue;if(!affected.has(row))affected.set(row,[]);affected.get(row).push(id);}
  const p=geometry.attributes.position,n=geometry.attributes.normal;for(const [row,drivers]of affected){const point=[0,0,0],normal=[0,0,0];for(const id of drivers)for(let k=0;k<3;k++){point[k]+=p.array[id*3+k]/drivers.length;normal[k]+=n.array[id*3+k]/drivers.length;}const sameNormal=drivers.every(id=>[0,1,2].every(k=>n.array[id*3+k]===n.array[drivers[0]*3+k])),length=Math.hypot(...normal)||1,resultNormal=sameNormal?Array.from(n.array.subarray(drivers[0]*3,drivers[0]*3+3)):normal.map(x=>x/length);for(const id of row){p.setXYZ(id,...point);n.setXYZ(id,...resultNormal);p.addUpdateRange(id*3,3);n.addUpdateRange(id*3,3);}}
  if(affected.size){p.needsUpdate=true;n.needsUpdate=true;}
 };
}
export function compileField(f){
 const {channels:k,unit}=f;
 const layers=f.layers.map(l=>{const a=new Map();for(let i=0;i<l.ids.length;i++)a.set(l.ids[i],i*k);return {n:l.n,a,c:l.c};});
 return (u,v)=>{const out=f.mean.slice();for(const {n,a,c:coefficients} of layers){const x=Math.max(0,Math.min(n-1e-8,u*n)),y=Math.max(0,Math.min(n-1e-8,v*n)),i=Math.floor(x),j=Math.floor(y),s=x-i,t=y-j;const ids=[i*(n+1)+j,(i+1)*(n+1)+j,i*(n+1)+j+1,(i+1)*(n+1)+j+1],b=[(1-s)*(1-t),s*(1-t),(1-s)*t,s*t];for(let q=0;q<4;q++){const at=a.get(ids[q]);if(at!==undefined)for(let ch=0;ch<k;ch++)out[ch]+=coefficients[at+ch]*unit*b[q];}}if(f.knots)for(const [a,b,r,c] of f.knots){const t=Math.hypot((u-a)*f.metric[0],(v-b)*f.metric[1])/r;if(t<1)out[0]+=c*unit*(1-t)**4*(4*t+1);}return out;};
}
export function chartFunctions(c){
 const shape=compileField(c.shape),weights=compileField(c.weights),normals=compileField(c.normals);
 const point=([u,v])=>{const r=shape(u,v);return [0,1,2].map(k=>c.linear[k]+c.linear[3+k]*u+c.linear[6+k]*v+r[k]);};
 return {c,point,weights,appearance:()=>[1,1,1,1,1],normals};
}
const area=uv=>uv.reduce((s,p,i)=>{const q=uv[(i+1)%uv.length];return s+p[0]*q[1]-p[1]*q[0]},0)/2;
const inside=(p,loop)=>{let yes=false;for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[i],b=loop[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
function closeGeneratedGaps(arrays,funcs){
 const {pos,parameters,colors,normalValues,materialValues,indices,groups,boneIds,boneWeights,chartIds}=arrays;
 const points=new Map(),ids=[],representatives=[],rows=[],edges=new Map(),byChart=new Map(funcs.map(f=>[f.c.id,f]));
 for(let i=0;i<pos.length/3;i++){const key=[0,1,2].map(k=>Math.round(pos[i*3+k]*1e6)).join(',');if(!points.has(key)){points.set(key,points.size);representatives.push(i);rows.push([]);}const id=points.get(key);ids.push(id);rows[id].push(i);}
 // Snap only already coincident samples, and copy one complete weight vector.
 // Tiny floating-point/order differences must not become a crack in a pose.
 for(const row of rows)if(row.length>1){const a=row[0];for(const b of row)for(let k=0;k<3;k++)pos[b*3+k]=pos[a*3+k];for(const b of row)for(let k=0;k<8;k++){boneIds[b*8+k]=boneIds[a*8+k];boneWeights[b*8+k]=boneWeights[a*8+k];}}
 // Welding can reverse very narrow fitted triangles. Keep their facing aligned
 // with the authored outward normal field, preventing dark back-face flecks.
 let reorientedTriangles=0;for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3),u=[0,1,2].map(k=>pos[b*3+k]-pos[a*3+k]),v=[0,1,2].map(k=>pos[c*3+k]-pos[a*3+k]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],dot=cross.reduce((sum,x,k)=>sum+x*(normalValues[a*3+k]+normalValues[b*3+k]+normalValues[c*3+k]),0);if(dot<0){indices[i+1]=c;indices[i+2]=b;reorientedTriangles++;}}
 const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
 for(let i=0;i<indices.length;i+=3)for(let e=0;e<3;e++){const a=ids[indices[i+e]],b=ids[indices[i+(e+1)%3]];if(a===b)continue;const key=edgeKey(a,b);if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});}
 // Odd incidence also catches borders adjacent to overlapping source faces.
 // Deleting those source faces would create fresh gaps in narrow chart folds.
 const open=new Map([...edges].filter(([,e])=>e.count%2===1)),adj=new Map();for(const [key,{a,b}]of open)for(const [x,y]of [[a,b],[b,a]]){if(!adj.has(x))adj.set(x,[]);adj.get(x).push({id:y,key});}
 const pending=new Set(open.keys()),cycles=[];let unresolved=0;
 // Extract individual cycles at junctions instead of filling a large body
 // contour. Only compact residual holes left by unmatched border sampling.
 while(pending.size){const start=open.get(pending.values().next().value).a,path=[start],walk=[],at=new Map([[start,0]]);let id=start,cycle=null;
  while(true){const next=(adj.get(id)||[]).find(e=>pending.has(e.key)&&!walk.includes(e.key));if(!next)break;walk.push(next.key);id=next.id;if(at.has(id)){const from=at.get(id);cycle=path.slice(from);for(const key of walk.slice(from))pending.delete(key);break;}at.set(id,path.length);path.push(id);}
  if(cycle&&cycle.length>=3)cycles.push(cycle);else {for(const key of walk)pending.delete(key);if(!walk.length)pending.delete(pending.values().next().value);unresolved+=walk.length||1;}
 }
 const distance=(a,b)=>Math.hypot(...[0,1,2].map(k=>pos[a*3+k]-pos[b*3+k]));
 let patches=0,addedTriangles=0,maxSpan=0,maxArea=0;
 for(const cycle of cycles){const verts=cycle.map(id=>representatives[id]);let span=0;for(const a of verts)for(const b of verts)span=Math.max(span,distance(a,b));if(span>.12||verts.length>100){unresolved+=cycle.length;continue;}
  const normal=[0,0,0];for(const id of verts)for(let k=0;k<3;k++)normal[k]+=normalValues[id*3+k];const drop=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),axes=[0,1,2].filter(k=>k!==drop),uv=verts.map(id=>axes.map(k=>pos[id*3+k])),flat=uv.flat();let faces=earcut(flat,[],2);
  // Preserve every boundary edge, including collinear samples Earcut removes.
  const used=new Set(faces);for(let id=0;id<verts.length;id++)if(!used.has(id)){const p=uv[id];for(let at=0;at<faces.length;at+=3){let done=false;for(let e=0;e<3;e++){const a=faces[at+e],b=faces[at+(e+1)%3],c=faces[at+(e+2)%3],u=uv[a],v=uv[b],dx=v[0]-u[0],dy=v[1]-u[1],l=dx*dx+dy*dy,t=((p[0]-u[0])*dx+(p[1]-u[1])*dy)/l;if(t>0&&t<1&&Math.abs(dx*(p[1]-u[1])-dy*(p[0]-u[0]))<1e-10){faces.splice(at,3,a,id,c,id,b,c);done=true;break;}}if(done)break;}}
  if(faces.length!==3*(verts.length-2)){
   // Nearly collapsed slits can overlap in a 2D projection. A minimum-area
   // 3D triangulation preserves their full border without a broad fan cap.
   const n=verts.length,cost=Array.from({length:n},()=>Array(n).fill(Infinity)),split=Array.from({length:n},()=>Array(n).fill(-1));for(let i=0;i<n-1;i++)cost[i][i+1]=0;
   const triangleArea=(a,b,c)=>{const p=pos.slice(a*3,a*3+3),u=pos.slice(b*3,b*3+3).map((x,k)=>x-p[k]),v=pos.slice(c*3,c*3+3).map((x,k)=>x-p[k]);return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;};
   for(let size=2;size<n;size++)for(let a=0;a+size<n;a++){const b=a+size;for(let c=a+1;c<b;c++){const value=cost[a][c]+cost[c][b]+triangleArea(verts[a],verts[c],verts[b])+1e-6*distance(verts[a],verts[b])**2;if(value<cost[a][b]){cost[a][b]=value;split[a][b]=c;}}}
   if(cost[0][n-1]>.0002){unresolved+=cycle.length;continue;}faces=[];const emit=(a,b)=>{if(b-a<2)return;const c=split[a][b];faces.push(a,c,b);emit(a,c);emit(c,b);};emit(0,n-1);
  }
  const counts=new Map();for(const id of verts){const c=chartIds[id];counts.set(c,(counts.get(c)||0)+1);}const f=byChart.get([...counts].sort((a,b)=>b[1]-a[1])[0][0]),base=pos.length/3,start=indices.length;
  // Keep existing UVs on the donor part. Across a material border, interpolate
  // the donor border itself; inverting a tiny chart can sample unrelated skin.
  const donor=verts.filter(id=>byChart.get(chartIds[id]).c.part===f.c.part);
  function patchUV(id){if(byChart.get(chartIds[id]).c.part===f.c.part)return parameters.slice(id*2,id*2+2);let best=Infinity,result=parameters.slice(donor[0]*2,donor[0]*2+2);for(let j=0;j<verts.length;j++){const a=verts[j],b=verts[(j+1)%verts.length];if(!donor.includes(a)||!donor.includes(b))continue;const ab=[0,1,2].map(k=>pos[b*3+k]-pos[a*3+k]),ap=[0,1,2].map(k=>pos[id*3+k]-pos[a*3+k]),length=ab.reduce((s,x)=>s+x*x,0),t=Math.max(0,Math.min(1,ab.reduce((s,x,k)=>s+x*ap[k],0)/(length||1))),d=Math.hypot(...ab.map((x,k)=>ap[k]-x*t));if(d<best){best=d;result=[0,1].map(k=>parameters[a*2+k]+(parameters[b*2+k]-parameters[a*2+k])*t);}}if(!Number.isFinite(best)){const near=donor.reduce((a,b)=>distance(id,a)<distance(id,b)?a:b);result=parameters.slice(near*2,near*2+2);}return result;}
  let patchArea=0;for(let i=0;i<faces.length;i+=3){const [a,b,c]=faces.slice(i,i+3).map(j=>verts[j]),p=pos.slice(a*3,a*3+3),u=pos.slice(b*3,b*3+3).map((x,k)=>x-p[k]),v=pos.slice(c*3,c*3+3).map((x,k)=>x-p[k]);patchArea+=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;}if(patchArea>.0002){unresolved+=cycle.length;continue;}
  for(let i=0;i<verts.length;i++){const id=verts[i],p=pos.slice(id*3,id*3+3);rows[cycle[i]].push(base+i);pos.push(...p);parameters.push(...patchUV(id));colors.push(...colors.slice(id*3,id*3+3));normalValues.push(...normalValues.slice(id*3,id*3+3));materialValues.push(...materialValues.slice(id*2,id*2+2));boneIds.push(...boneIds.slice(id*8,id*8+8));boneWeights.push(...boneWeights.slice(id*8,id*8+8));chartIds.push(f.c.id);}
  for(let i=0;i<faces.length;i+=3){let [a,b,c]=faces.slice(i,i+3),p=pos.slice((base+a)*3,(base+a)*3+3),u=pos.slice((base+b)*3,(base+b)*3+3).map((x,k)=>x-p[k]),v=pos.slice((base+c)*3,(base+c)*3+3).map((x,k)=>x-p[k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(n.reduce((s,x,k)=>s+x*normal[k],0)<0)[b,c]=[c,b];indices.push(base+a,base+b,base+c);addedTriangles++;}
  groups.push({start,count:indices.length-start,materialIndex:f.c.part});patches++;maxSpan=Math.max(maxSpan,span);maxArea=Math.max(maxArea,patchArea);
 }
 return {seamGroups:rows.filter(row=>row.length>1),report:{patches,addedTriangles,reorientedTriangles,maxPatchSpanMetres:maxSpan,maxPatchAreaSquareMetres:maxArea,unresolvedBoundaryEdges:unresolved}};
}
export function generateSurface(data,{edgeMetres=.012,muscle=0}={}){
 const funcs=data.charts.map(chartFunctions),owners=new Map(),seamEdges=new Map(),originalOwners=new Map(),originalEdges=new Map();
 const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
 for(const f of funcs)for(const loop of f.c.trim){const uv=loop.seams.map((_,i)=>[loop.uv[i*2]/1e6,loop.uv[i*2+1]/1e6]);for(let i=0;i<uv.length;i++){const id=loop.seams[i];if(!originalOwners.has(id))originalOwners.set(id,[]);originalOwners.get(id).push({f,uv:uv[i]});const key=edgeKey(id,loop.seams[(i+1)%uv.length]);originalEdges.set(key,(originalEdges.get(key)||0)+1);}}
 // Independently fitted material blocks have distinct border IDs. Match only
 // open source borders across parts, with one sample per part in each cluster.
 // This is a generated relation, not a stored mesh or a body-wide vertex weld.
 const border=new Set();for(const [key,n]of originalEdges)if(n===1)for(const id of key.split(':').map(Number))border.add(id);
 const parent=new Map(),parts=new Map(),bins=new Map(),rows=new Map(),cell=.004;
 const find=id=>{let root=id;while(parent.get(root)!==root)root=parent.get(root);while(parent.get(id)!==id){const next=parent.get(id);parent.set(id,root);id=next;}return root;};
 for(const id of originalOwners.keys()){parent.set(id,id);parts.set(id,new Set(originalOwners.get(id).map(s=>s.f.c.part)));}
 for(const id of border){const sources=originalOwners.get(id),p=[0,0,0];for(const s of sources){const q=s.f.point(s.uv);for(let k=0;k<3;k++)p[k]+=q[k]/sources.length;}const row={id,p,part:sources[0].f.c.part},key=p.map(v=>Math.floor(v/cell)).join(',');rows.set(id,row);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(row);}
 const candidates=[];for(const row of rows.values()){const bin=row.p.map(v=>Math.floor(v/cell));let best=null,distance=cell;for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const q of bins.get([bin[0]+x,bin[1]+y,bin[2]+z].join(','))||[]){if(q.part===row.part)continue;const d=Math.hypot(...row.p.map((v,k)=>v-q.p[k]));if(d<distance){distance=d;best=q;}}if(best)candidates.push({a:row.id,b:best.id,distance});}
 let matched=0,maxCorrection=0;for(const {a,b,distance}of candidates.sort((a,b)=>a.distance-b.distance)){const x=find(a),y=find(b);if(x===y||[...parts.get(x)].some(p=>parts.get(y).has(p)))continue;parent.set(y,x);for(const p of parts.get(y))parts.get(x).add(p);matched++;maxCorrection=Math.max(maxCorrection,distance/2);}
 const canonical=id=>find(id);
 for(const [id,sources]of originalOwners){const key=canonical(id);if(!owners.has(key))owners.set(key,[]);owners.get(key).push(...sources);}
 for(const f of funcs)for(const loop of f.c.trim){const uv=loop.seams.map((_,i)=>[loop.uv[i*2]/1e6,loop.uv[i*2+1]/1e6]);for(let i=0;i<uv.length;i++){const j=(i+1)%uv.length,a=canonical(loop.seams[i]),b=canonical(loop.seams[j]),key=edgeKey(a,b);if(!seamEdges.has(key))seamEdges.set(key,[]);seamEdges.get(key).push({f,a,b,uv0:uv[i],uv1:uv[j]});}}
 function evaluate(f,uv,seam){
  let sources=[{f,uv}];if(seam?.id!==undefined)sources=owners.get(seam.id)||sources;
  else if(seam?.a!==undefined){const key=seam.a<seam.b?`${seam.a}:${seam.b}`:`${seam.b}:${seam.a}`;sources=(seamEdges.get(key)||[]).map(s=>{const t=s.a===seam.a?seam.t:1-seam.t;return {f:s.f,uv:s.uv0.map((v,k)=>v+(s.uv1[k]-v)*t)}});if(!sources.length)sources=[{f,uv}];}
  const p=[0,0,0],w=new Float64Array(data.boneOrder.length);for(const s of sources){const q=s.f.point(s.uv),bw=s.f.weights(...s.uv);for(let k=0;k<3;k++)p[k]+=q[k]/sources.length;for(let k=0;k<bw.length;k++)w[s.f.c.bones[k]]+=Math.max(0,bw[k])/sources.length;}
  const weights=Array.from(w,(v,i)=>[v,i]).filter(x=>x[0]>1e-6).sort((a,b)=>b[0]-a[0]),sum=weights.slice(0,8).reduce((a,b)=>a+b[0],0)||1,ids=Array(8).fill(0),ws=Array(8).fill(0);for(let k=0;k<Math.min(8,weights.length);k++){ids[k]=weights[k][1];ws[k]=weights[k][0]/sum;}
  const color=f.appearance(...uv);if(muscle){const boost=1+muscle*.03;const group=f.c.anatomy;if(group==='torso'||group.startsWith('upperarm')||group.startsWith('thigh')){p[0]*=boost;p[2]*=boost;}}
  return {p,ids,ws,color,normal:f.normals?.(...uv)};
 }
 const pos=[],parameters=[],colors=[],normalValues=[],materialValues=[],indices=[],groups=[],boneIds=[],boneWeights=[],chartIds=[],emptyDomainIds=[];let triangles=0,trimLoops=0,unclosed=0;
 for(const f of funcs){
  const groupStart=indices.length;
  const loops=f.c.trim.map(loop=>({uv:loop.seams.map((_,i)=>[loop.uv[i*2]/1e6,loop.uv[i*2+1]/1e6]),seams:loop.seams.map(canonical)})).filter(l=>l.uv.length>=3);trimLoops+=loops.length;
  const nests=loops.map((l,i)=>{let parent=-1,best=Infinity;const size=Math.abs(area(l.uv));for(let j=0;j<loops.length;j++)if(i!==j&&Math.abs(area(loops[j].uv))>size+1e-12&&inside(l.uv[0],loops[j].uv)){const a=Math.abs(area(loops[j].uv));if(a<best){best=a;parent=j;}}return parent;});
  function depth(i){let n=0;for(let j=nests[i],guard=0;j>=0&&guard<loops.length;j=nests[j],guard++)n++;return n;}
  for(let outer=0;outer<loops.length;outer++){
   if(depth(outer)%2)continue;
   const selected=[outer,...loops.map((_,i)=>i).filter(i=>nests[i]===outer&&depth(i)%2)];let vertices=[],holes=[],uvData=[],boundaryMap=new Map(),rings=[];
   for(const loopId of selected){const loop=loops[loopId];if(loopId!==outer)holes.push(vertices.length);let first=vertices.length;
    // Canonical seam edge sampling is identical for every owner, so chart
    // borders join after regeneration even when display density changes.
    for(let i=0;i<loop.uv.length;i++){const j=(i+1)%loop.uv.length,a=loop.seams[i],b=loop.seams[j],key=a<b?`${a}:${b}`:`${b}:${a}`,sources=seamEdges.get(key)||[],len=Math.max(...sources.map(s=>{const p=s.f.point(s.uv0),q=s.f.point(s.uv1);return Math.hypot(...p.map((v,k)=>v-q[k]))}),0),steps=Math.max(1,Math.ceil(len/edgeMetres));
     for(let step=0;step<steps;step++){const t=step/steps,uv=loop.uv[i].map((v,k)=>v+(loop.uv[j][k]-v)*t),seam=step?{a,b,t}:{id:a};vertices.push({uv,seam});uvData.push(...uv);}
    }
    const end=vertices.length;rings.push({first,end});for(let i=first;i<end;i++){const j=i+1===end?first:i+1;boundaryMap.set(i<j?`${i}:${j}`:`${j}:${i}`,true);}
   }
   let faces=earcut(uvData,holes,2);if(!faces.length){unclosed++;emptyDomainIds.push(f.c.id);continue;}
   // Earcut may discard collinear border samples. Restore them before any
   // interior refinement; otherwise an edge spanning skipped samples becomes
   // an independently fitted interior edge and reopens the shared boundary.
   const used=new Set(faces),omitted=[];for(const ring of rings)for(let id=ring.first;id<ring.end;id++)if(!used.has(id))omitted.push(id);
   for(const id of omitted){const p=vertices[id].uv;let inserted=false;for(let at=0;at<faces.length&&!inserted;at+=3)for(let e=0;e<3;e++){const a=faces[at+e],b=faces[at+(e+1)%3],c=faces[at+(e+2)%3],u=vertices[a].uv,v=vertices[b].uv,dx=v[0]-u[0],dy=v[1]-u[1],l=dx*dx+dy*dy,t=((p[0]-u[0])*dx+(p[1]-u[1])*dy)/l;if(t<=1e-10||t>=1-1e-10||Math.abs(dx*(p[1]-u[1])-dy*(p[0]-u[0]))>1e-12*Math.sqrt(l))continue;faces.splice(at,3,a,id,c,id,b,c);inserted=true;break;}}
   // Conforming edge refinement: every incident face consumes the same split.
   for(let pass=0;pass<12;pass++){
    const splits=new Map();
    for(let i=0;i<faces.length;i+=3){const corner=faces.slice(i,i+3),points=corner.map(id=>vertices[id].point||(vertices[id].point=f.point(vertices[id].uv))),centerUV=[0,0].map((_,k)=>corner.reduce((s,id)=>s+vertices[id].uv[k],0)/3),center=f.point(centerUV),linearCenter=[0,0,0].map((_,k)=>points.reduce((s,p)=>s+p[k],0)/3),centerError=Math.hypot(...center.map((v,k)=>v-linearCenter[k]));let longest=-1,longestLength=-1;for(let e=0;e<3;e++){const len=Math.hypot(...points[e].map((v,k)=>v-points[(e+1)%3][k]));if(len>longestLength){longest=e;longestLength=len;}}
     for(let e=0;e<3;e++){const a=corner[e],b=corner[(e+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;if(splits.has(key)||boundaryMap.has(key))continue;const p=points[e],q=points[(e+1)%3],uv=vertices[a].uv.map((v,k)=>(v+vertices[b].uv[k])/2),mid=f.point(uv),curveError=Math.hypot(...mid.map((v,k)=>v-(p[k]+q[k])/2));if(Math.hypot(...p.map((v,k)=>v-q[k]))>edgeMetres||curveError>.0005||(e===longest&&centerError>.0005)){splits.set(key,vertices.length);vertices.push({uv,point:mid});}}
    }
    if(!splits.size)break;const next=[];const mid=(a,b)=>splits.get(a<b?`${a}:${b}`:`${b}:${a}`);
    for(let i=0;i<faces.length;i+=3){const a=faces[i],b=faces[i+1],c=faces[i+2],ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);const n=[ab,bc,ca].filter(x=>x!==undefined).length;
     if(n===0)next.push(a,b,c);else if(n===3)next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
     else if(n===1){if(ab!==undefined)next.push(a,ab,c,ab,b,c);else if(bc!==undefined)next.push(b,bc,a,bc,c,a);else next.push(c,ca,b,ca,a,b);}
     else if(ab===undefined)next.push(c,ca,bc,ca,a,b,ca,b,bc);else if(bc===undefined)next.push(a,ab,ca,ab,b,c,ab,c,ca);else next.push(b,bc,ab,bc,c,a,bc,a,ab);
    }faces=next;if(vertices.length>30000)break;
   }
   const base=pos.length/3;for(const vertex of vertices){const v=evaluate(f,vertex.uv,vertex.seam);pos.push(...v.p);parameters.push(f.c.textureLinear[0]+f.c.textureLinear[2]*vertex.uv[0]+f.c.textureLinear[4]*vertex.uv[1],f.c.textureLinear[1]+f.c.textureLinear[3]*vertex.uv[0]+f.c.textureLinear[5]*vertex.uv[1]);boneIds.push(...v.ids);boneWeights.push(...v.ws);if(v.normal){const len=Math.hypot(...v.normal)||1;normalValues.push(...v.normal.map(x=>x/len));}materialValues.push(Math.max(.05,Math.min(1,v.color[3])),Math.max(0,Math.min(1,v.color[4])));colors.push(...v.color.slice(0,3).map(x=>{x=Math.max(0,Math.min(1,x));return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)}));chartIds.push(f.c.id);}
   for(let i=0;i<faces.length;i+=3){const a=faces[i],b=faces[i+1],c=faces[i+2],qa=vertices[a].uv,qb=vertices[b].uv,qc=vertices[c].uv,orientation=(qb[0]-qa[0])*(qc[1]-qa[1])-(qb[1]-qa[1])*(qc[0]-qa[0]);const correct=orientation*f.c.uvSign>0;indices.push(base+a,base+(correct?b:c),base+(correct?c:b));triangles++;}
  }
  groups.push({start:groupStart,count:indices.length-groupStart,materialIndex:f.c.part});
 }
 const repair=closeGeneratedGaps({pos,parameters,colors,normalValues,materialValues,indices,groups,boneIds,boneWeights,chartIds},funcs);triangles+=repair.report.addedTriangles;
 return {groups,seamGroups:repair.seamGroups,positions:new Float32Array(pos),parameters:new Float32Array(parameters),colors:new Float32Array(colors),normals:new Float32Array(normalValues),material:new Float32Array(materialValues),indices:new Uint32Array(indices),skinIndex:new Uint16Array(boneIds),skinWeight:new Float32Array(boneWeights),influences:8,chartIds,functions:funcs,report:{vertices:pos.length/3,triangles,charts:funcs.length,trimLoops,emptyDomains:unclosed,emptyDomainIds,seams:{matchedBorderSamples:matched,maxCorrectionMetres:maxCorrection,unmatchedBorderSamples:[...border].filter(id=>parts.get(canonical(id)).size===1).length,...repair.report}}};
}
