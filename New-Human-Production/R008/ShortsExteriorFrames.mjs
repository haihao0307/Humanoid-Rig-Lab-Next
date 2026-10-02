/* Independent exterior manufacturing seed. Nine source sheets are positioned
 * rigidly outside the actual generated clothed subject. Nothing is sewn,
 * draped, skinned to bones, or accepted as a worn garment by this helper. */
const VERSION='r008-exterior-rigid-source-piece-seed@1';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 unit=v=>{const n=Math.hypot(...v);if(!(n>1e-12))throw Error('Nondegenerate source chart direction required');return v.map(x=>x/n);};
function charts(piece){
 if(piece.kind==='gusset')return {eWidth:[1,0],eGrain:[0,1],anchor:[0,0]};
 const uv=piece.materialCoordinates;
 if(piece.kind==='leg-panel'){
  const a=uv[piece.landmarks.centerWaist],b=uv[piece.landmarks.sideWaist],eWidth=unit(b.map((v,k)=>v-a[k])),eGrain=[-eWidth[1],eWidth[0]];
  if(dot(eGrain,piece.grainDirection)<0)eGrain.forEach((v,k)=>eGrain[k]=-v);
  return {eWidth,eGrain,anchor:a.slice()};
 }
 if(piece.kind==='waistband'){
  const a=uv[piece.boundaries.lower[0]],b=uv[piece.boundaries.lower.at(-1)],eWidth=unit(b.map((v,k)=>v-a[k])),eGrain=[-eWidth[1],eWidth[0]],
   low=piece.boundaries.lower[Math.floor(piece.boundaries.lower.length/2)],up=piece.boundaries.upper[Math.floor(piece.boundaries.upper.length/2)];
  if(dot(eGrain,uv[up].map((v,k)=>v-uv[low][k]))<0)eGrain.forEach((v,k)=>eGrain[k]=-v);
  return {eWidth,eGrain,anchor:a.map((v,k)=>(v+b[k])/2)};
 }
 throw Error('Original source material role required');
}
export function createShortsExteriorFrames(existingDraft,body,{clearanceM=existingDraft?.material?.bodyClearanceM}={}){
 const d=existingDraft;
 if(d?.pieces?.length!==9||d.positions?.length!==1659||d.sourceUV?.length!==1106||d.triangles?.length!==2544||d.seams?.length!==19)throw Error('Exterior seed requires the actual nine-piece 553/848/19 source paper');
 if(!(Number.isFinite(clearanceM)&&clearanceM>0)||clearanceM<d.material.bodyClearanceM)throw Error('Exterior body clearance must retain the source declared clearance');
 const m=body?.measurements,state=body?.snapshot?.(),local=body?.localPositions;
 if(!m||!state||m.pose!==state.phase||state.phase!=='rest'||(state.time!==null&&state.time!==0))throw Error('Exterior seed requires fresh neutral actual full-surface measurements; no animated cached intake');
 if(!local||local.length!==m.source.generated.vertices*3||!local.every(Number.isFinite))throw Error('Current actual full generated actor-local metre vertices required');
 const envelope=m.lowWaist?.envelope?.points??m.lowWaist?.contours?.[0]?.points;
 if(!Array.isArray(envelope)||envelope.length<4||m.lowWaist.valid===false)throw Error('Actual measured lower-waist envelope required for source side orientation');
 const center=[m.lowWaist.centerX,0,m.lowWaist.centerZ];
 if(!Number.isFinite(center[0])||!Number.isFinite(center[2]))throw Error('Actual body reference center required');
 const pieces=structuredClone(d.pieces),ranges=structuredClone(d.ranges),positions=new Float64Array(1659),frames=[],parentFrames=new Map(),
  sourceUV=Float64Array.from(d.sourceUV),triangles=Uint32Array.from(d.triangles),masses=Float64Array.from(d.masses),seams=structuredClone(d.seams);
 if(!masses.every(v=>Number.isFinite(v)&&v>0))throw Error('Original source masses must remain positive');
 function exactSupport(normal){let maximum=-Infinity,witness=-1;for(let i=0;i<local.length/3;i++){const p=local.subarray(i*3,i*3+3),value=dot(normal,p);if(value>maximum){maximum=value;witness=i;}}
  return {maximumM:maximum,sourceVertex:witness,actualPoint:Array.from(local.subarray(witness*3,witness*3+3)),authority:'maximum linear projection of every actual neutral generated eight-influence vertex; not cached source bounds or an invented body mesh'};
 }
 for(const piece of pieces){
  const range=ranges.find(r=>r.pieceId===piece.id);if(!range||range.count!==piece.materialCoordinates.length)throw Error('Source range changed');
  const chart=charts(piece);let normal,EWidth,EGrain,anchorY,handlingGapM=0,sideSign=0,frontSign=0;
  if(piece.kind==='gusset'){
   normal=[0,-1,0];EWidth=[1,0,0];EGrain=[0,0,-1];anchorY=null;
  }else{
   const parent=piece.kind==='leg-panel'?piece:pieces.find(p=>p.id===piece.parentPanel),sx=parent.side==='left'?-1:1,sz=parent.bodySide==='front'?1:-1;
   sideSign=sx;frontSign=sz;
   if(piece.kind==='leg-panel'){
    const quadrant=envelope.filter(p=>sx*(p[0]-center[0])>0&&sz*(p[2]-center[2])>0);if(quadrant.length<3)throw Error('Actual declared body quadrant missing');
    const mean=quadrant.reduce((a,p)=>a.map((v,k)=>v+p[k]/quadrant.length),[0,0,0]);normal=unit([mean[0]-center[0],0,mean[2]-center[2]]);
    if(sx*normal[0]<=0||sz*normal[2]<=0)throw Error('Actual body quadrant orientation inconsistent');
    const tangent=unit([1-normal[0]*normal[0],0,-normal[0]*normal[2]]);EWidth=tangent.map(v=>v*sx);EGrain=[0,-1,0];anchorY=d.receipt.lowerY;
   }else{
    const parentFrame=parentFrames.get(parent.id);if(!parentFrame)throw Error('Parent source frame unavailable');normal=parentFrame.normal.slice();
    const sourceSeam=seams.find(s=>s.id==='waist-'+parent.id),first=sourceSeam.pairs[0],last=sourceSeam.pairs.at(-1),parentRange=ranges.find(r=>r.pieceId===parent.id),
     uvA=parent.materialCoordinates[first.a-parentRange.offset],uvB=parent.materialCoordinates[last.a-parentRange.offset],delta=uvB.map((v,k)=>v-uvA[k]);
    EWidth=unit(parentFrame.basisU.map((v,k)=>v*delta[0]+parentFrame.basisV[k]*delta[1]));EGrain=[0,1,0];anchorY=d.receipt.lowerY;
    handlingGapM=piece.placement?.handlingGapM;
    if(!(Number.isFinite(handlingGapM)&&handlingGapM>0))throw Error('Original independent waistband handling gap required');
   }
  }
  const basisU=EWidth.map((v,k)=>v*chart.eWidth[0]+EGrain[k]*chart.eGrain[0]),basisV=EWidth.map((v,k)=>v*chart.eWidth[1]+EGrain[k]*chart.eGrain[1]),basisN=cross(basisU,basisV),
   support=exactSupport(normal),baseSupportM=support.maximumM+clearanceM+handlingGapM,
   reference=piece.kind==='gusset'?[center[0],-baseSupportM,center[2]]:[...center],
   baseAnchor=piece.kind==='gusset'?reference:reference.map((v,k)=>v+normal[k]*(baseSupportM-dot(normal,reference)));
  if(anchorY!==null)baseAnchor[1]=anchorY;
  let origin=baseAnchor.map((v,k)=>v-basisU[k]*chart.anchor[0]-basisV[k]*chart.anchor[1]),additionalExteriorShiftM=0;
  const map=uv=>origin.map((v,k)=>v+basisU[k]*uv[0]+basisV[k]*uv[1]);
  if(sideSign){
   let minimumSide=Infinity,minimumFront=Infinity;for(const uv of piece.materialCoordinates){const p=map(uv);minimumSide=Math.min(minimumSide,sideSign*(p[0]-center[0]));minimumFront=Math.min(minimumFront,frontSign*(p[2]-center[2]));}
   // Whole-sheet translation only. If a source cut extends across the center
   // axes, move the independent sheet farther along the actual outward normal;
   // this staging distance is derived from the complete source cut, not guessed.
   additionalExteriorShiftM=Math.max(0,(clearanceM-minimumSide)/Math.abs(normal[0]),(clearanceM-minimumFront)/Math.abs(normal[2]));
   origin=origin.map((v,k)=>v+normal[k]*additionalExteriorShiftM);
  }
  const gram=[dot(basisU,basisU),dot(basisU,basisV),dot(basisV,basisV)],determinant=dot(basisU,cross(basisV,basisN));
  if(Math.abs(gram[0]-1)>1e-10||Math.abs(gram[1])>1e-10||Math.abs(gram[2]-1)>1e-10||Math.abs(determinant-1)>1e-10)throw Error('Exterior chart requires a proper orthonormal rigid frame');
  let minimumPlaneClearanceM=Infinity;
  piece.materialCoordinates.forEach((uv,i)=>{
   const id=range.offset+i;if(uv[0]!==sourceUV[id*2]||uv[1]!==sourceUV[id*2+1])throw Error('Source UV modified before exterior seed');
   const p=map(uv);positions.set(p,id*3);minimumPlaneClearanceM=Math.min(minimumPlaneClearanceM,dot(normal,p)-support.maximumM);
  });
  if(minimumPlaneClearanceM<clearanceM-1e-10)throw Error('Whole material plane must be outside the actual generated body extent');
  const frame={pieceId:piece.id,origin,basisU,basisV,basisN,normal,sourceChart:chart,gram,determinant,support,bodyClearanceM:clearanceM,sourceHandlingGapM:handlingGapM,additionalWholeSheetExteriorShiftM:additionalExteriorShiftM,minimumPlaneClearanceM,sourceSideSign:sideSign,sourceFrontSign:frontSign,authority:piece.kind==='gusset'?'independent rigid source G below actual whole-body extent; not placed in the crotch':'proper source transverse/grain chart on the actual declared exterior quadrant support plane'};
  frames.push(frame);if(piece.kind==='leg-panel')parentFrames.set(piece.id,frame);
 }
 const independentGroups=Array.from({length:553},(_,i)=>[i]),independentQuotient=Uint32Array.from({length:553},(_,i)=>i),
  receipt={version:VERSION,authority:'nine independent source-paper sheets on actual neutral generated-body exterior supporting planes',sourceCounts:{pieces:9,particles:553,triangles:848,finalSourceSeams:19,activeSourceSeams:0,independentDofs:553},actualBody:{source:m.source,revision:state.revision,pose:state.phase,supportVertices:local.length/3,closestDomainVertices:state.vertices,closestDomainTriangles:state.triangles,sourceSurfaceScope:'actual R008 source clothing and skin; covered bare skin remains unknown'},frames,sourceUVRestAreaMassChanged:false,sourceAreaM2:d.receipt.areaM2,massKg:d.receipt.massKg,wholeTriangleExteriorHalfspaceProven:true,bodyClosestChecksPending:true,sourceGClosed:false,waistbandAttached:false,wearingValidated:false,selfContactValidated:false,motionValidated:false,productionReady:false};
 return {...d,version:VERSION,positions,pieces,ranges,sourceUV,uvs:sourceUV,triangles,masses,mass:masses,seams,seamGroups:independentGroups,quotientMap:independentQuotient,targetSourceSeamGroups:structuredClone(d.seamGroups),targetSourceQuotientMap:Uint32Array.from(d.quotientMap),activeSeamIDs:[],activeElasticEdgeIndices:[],exteriorFrames:frames,exteriorReceipt:receipt,receipt:{...structuredClone(d.receipt),placement:receipt.authority,exterior:receipt,bodyFitValidated:false,motionValidated:false,visualAcceptance:false,productionReady:false}};
}
