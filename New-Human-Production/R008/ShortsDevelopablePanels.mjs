// Explicit INVERSE pattern construction, before cloth assembly, following
// https://igl.ethz.ch/projects/computational-patternmaking/
// A narrow strip has no interior vertices: its triangle dual is a tree and
// can be unfolded exactly. Its boundaries become declared physical seams.
// This is not a four-panel pattern and never modifies an existing paper rest.
const dist=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>a.map(v=>v/Math.hypot(...a));
export function developShortsStrips(reference){
 const xyz=[],uv=[],tri=[],ranges=[],copies=new Map(),pieces=[];
 for(const p of reference.pieces){const parent=reference.ranges.find(r=>r.pieceId===p.id),n=p.grid.columns,rows=p.grid.rows;
  for(let col=0;col<n;col++){
   const id=p.id+'-strip-'+col,sourceIDs=Array.from({length:2*(rows+1)},(_,i)=>parent.offset+Math.floor(i/2)*(n+1)+col+i%2),localMap=new Map(sourceIDs.map((i,j)=>[i,j])),face=Array.from({length:reference.triangles.length/3},(_,i)=>Array.from(reference.triangles.slice(i*3,i*3+3))).filter(t=>t.every(i=>localMap.has(i))).map(t=>t.map(i=>localMap.get(i))),positions=sourceIDs.map(i=>Array.from(reference.positions.slice(i*3,i*3+3))),paper=Array(sourceIDs.length).fill(null);
   const first=face[0],[a,b,c]=first,ab=dist(positions[a],positions[b]),ac=dist(positions[a],positions[c]),bc=dist(positions[b],positions[c]),x=(ac*ac+ab*ab-bc*bc)/(2*ab),y=Math.sqrt(Math.max(0,ac*ac-x*x));paper[a]=[0,0];paper[b]=[ab,0];paper[c]=[x,y];const done=new Set([0]),hinges=[];
   while(done.size<face.length){let progress=false;for(let f=0;f<face.length;f++){if(done.has(f))continue;const t=face[f],known=t.filter(i=>paper[i]);if(known.length!==2)continue;const[a,b]=known,c=t.find(i=>!paper[i]),A=paper[a],B=paper[b],ab=dist(A,B),ac=dist(positions[a],positions[c]),bc=dist(positions[b],positions[c]),x=(ac*ac+ab*ab-bc*bc)/(2*ab),h=Math.sqrt(Math.max(0,ac*ac-x*x)),dx=(B[0]-A[0])/ab,dy=(B[1]-A[1])/ab,prior=face.find((q,j)=>done.has(j)&&q.includes(a)&&q.includes(b)),other=prior.find(i=>i!==a&&i!==b),side=Math.sign((B[0]-A[0])*(paper[other][1]-A[1])-(B[1]-A[1])*(paper[other][0]-A[0]));paper[c]=[A[0]+x*dx+side*h*dy,A[1]+x*dy-side*h*dx];
    const edge=unit(sub(positions[b],positions[a])),oldVector=sub(positions[other],positions[a]),newVector=sub(positions[c],positions[a]),flatDirection=unit(oldVector.map((v,k)=>-(v-edge[k]*dot(oldVector,edge)))),foldDirection=unit(newVector.map((v,k)=>v-edge[k]*dot(newVector,edge))),angle=Math.atan2(dot(edge,cross(flatDirection,foldDirection)),dot(flatDirection,foldDirection));hinges.push({edge:[a,b],previous:other,vertex:c,angleRadians:angle});done.add(f);progress=true;}if(!progress)throw Error('Strip triangulation does not admit tree unfolding');}
   // Rotate the source grain approximately along its long direction. No scale.
   const top=paper[0],bottom=paper[paper.length-2],angle=Math.atan2(bottom[1]-top[1],bottom[0]-top[0])-Math.PI/2,cs=Math.cos(angle),sn=Math.sin(angle),flat=paper.map(([x,y])=>[cs*(x-top[0])+sn*(y-top[1]),-sn*(x-top[0])+cs*(y-top[1])]),begin=uv.length/2;
   for(let i=0;i<sourceIDs.length;i++){const old=sourceIDs[i];if(!copies.has(old))copies.set(old,[]);copies.get(old).push(begin+i);xyz.push(...positions[i]);uv.push(...flat[i]);}
   tri.push(...face.flatMap(t=>t.map(i=>i+begin)));ranges.push({pieceId:id,offset:begin,count:sourceIDs.length});pieces.push({id,kind:'developed-strip',parentPanel:p.id,materialCoordinates:flat,triangles:face,referenceSourceIDs:sourceIDs,foldBlueprint:{firstTriangle:first,firstPlacement:first.map(i=>positions[i]),hinges,authority:'temporary manufacturing curvature instructions derived before cutting; NOT cloth bending rest angles'},sourceMethod:'triangle-tree exact unfolding before cutting; XYZ lengths are design inputs, not a changed forward-simulation rest'});
  }
 }
 const seams=[];for(const p of reference.pieces)for(let col=1;col<p.grid.columns;col++){const a=ranges.find(r=>r.pieceId===p.id+'-strip-'+(col-1)),b=ranges.find(r=>r.pieceId===p.id+'-strip-'+col);seams.push({id:p.id+'-strip-seam-'+col,pairs:Array.from({length:p.grid.rows+1},(_,r)=>({a:a.offset+2*r+1,b:b.offset+2*r}))});}
 for(const s of reference.seams)seams.push({...s,pairs:s.pairs.map(p=>({a:copies.get(p.a)[0],b:copies.get(p.b)[0]}))});
 const waist=reference.waistIndices.flatMap(i=>copies.get(i));
 let maximumUnfoldingEdgeErrorM=0,maximumSeamFeedMismatchM=0;for(let t=0;t<tri.length;t+=3)for(let k=0;k<3;k++){const a=tri[t+k],b=tri[t+(k+1)%3];maximumUnfoldingEdgeErrorM=Math.max(maximumUnfoldingEdgeErrorM,Math.abs(dist(uv.slice(a*2,a*2+2),uv.slice(b*2,b*2+2))-dist(xyz.slice(a*3,a*3+3),xyz.slice(b*3,b*3+3))));}
 for(const seam of seams)for(let i=1;i<seam.pairs.length;i++){const a=seam.pairs[i-1],b=seam.pairs[i],length=(x,y)=>dist(uv.slice(x*2,x*2+2),uv.slice(y*2,y*2+2));maximumSeamFeedMismatchM=Math.max(maximumSeamFeedMismatchM,Math.abs(length(a.a,b.a)-length(a.b,b.b)));}
 const draft={...reference,positions:Float64Array.from(xyz),sourceUV:Float64Array.from(uv),uvs:Float64Array.from(uv),triangles:Uint32Array.from(tri),ranges,pieces,seams,waistIndices:waist,receipt:{...reference.receipt,method:'inverse computational pattern construction with additional real seams',paperAuthority:'new independently unfolded flat strip panels BEFORE assembly; no original-pattern preservation claim',stripPanels:pieces.length,maximumUnfoldingEdgeErrorM,maximumSeamFeedMismatchM,referenceShapeIsDesignInput:true,flatToDressedSimulationValidated:false,productionReady:false}};
 const folded=foldShortsPanels(draft,1);draft.receipt.maximumIndependentFoldReconstructionErrorM=Math.max(...Array.from({length:xyz.length/3},(_,i)=>dist(xyz.slice(i*3,i*3+3),Array.from(folded.slice(i*3,i*3+3)))));draft.positions=folded;draft.receipt.flatToCurvedKinematicConstructionValidated=draft.receipt.maximumIndependentFoldReconstructionErrorM<1e-9;return draft;
}

export function foldShortsPanels(draft,progress=1){
 if(!Number.isFinite(progress)||progress<0||progress>1)throw Error('Finite folding fraction 0..1 required');const result=new Float64Array(draft.sourceUV.length/2*3);
 for(const piece of draft.pieces){const r=draft.ranges.find(r=>r.pieceId===piece.id),uv=piece.materialCoordinates,B=piece.foldBlueprint,positions=Array(uv.length).fill(null),[a,b,c]=B.firstTriangle,[A,E,F]=B.firstPlacement,axis=unit(sub(E,A)),raw=sub(F,A),vertical=unit(raw.map((v,k)=>v-axis[k]*dot(raw,axis))),ua=uv[a],ub=uv[b],flatAxis=unit(sub(ub,ua)),flatVertical=[-flatAxis[1],flatAxis[0]],sign=Math.sign(dot(sub(uv[c],ua),flatVertical));
  for(const i of B.firstTriangle){const u=sub(uv[i],ua),x=dot(u,flatAxis),y=dot(u,flatVertical)*sign;positions[i]=A.map((v,k)=>v+x*axis[k]+y*vertical[k]);}
  for(const hinge of B.hinges){const[a,b]=hinge.edge,c=hinge.vertex,O=positions[hinge.previous],A=positions[a],E=positions[b],axis=unit(sub(E,A)),length=dist(uv[a],uv[b]),ac=dist(uv[a],uv[c]),bc=dist(uv[b],uv[c]),x=(ac*ac+length*length-bc*bc)/(2*length),height=Math.sqrt(Math.max(0,ac*ac-x*x)),prior=sub(O,A),direction=unit(prior.map((v,k)=>-(v-axis[k]*dot(prior,axis)))),angle=progress*hinge.angleRadians,rotated=direction.map((v,k)=>v*Math.cos(angle)+cross(axis,direction)[k]*Math.sin(angle)+axis[k]*dot(axis,direction)*(1-Math.cos(angle)));positions[c]=A.map((v,k)=>v+axis[k]*x+rotated[k]*height);}
  for(let i=0;i<positions.length;i++)result.set(positions[i],(r.offset+i)*3);
 }
 return result;
}

export function flatShortsStrips(draft){
 const positions=new Float64Array(draft.positions.length);
 for(const [n,r]of draft.ranges.entries())for(let i=r.offset;i<r.offset+r.count;i++){positions[i*3]=draft.sourceUV[i*2]+(n%10)*.10;positions[i*3+1]=.40-draft.sourceUV[i*2+1]-Math.floor(n/10)*.48;positions[i*3+2]=0;}
 return{positions:Array.from({length:positions.length/3},(_,i)=>Array.from(positions.slice(i*3,i*3+3))),triangles:Array.from({length:draft.triangles.length/3},(_,i)=>({q:Array.from(draft.triangles.slice(i*3,i*3+3))}))};
}
