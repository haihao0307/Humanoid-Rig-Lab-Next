/* Independent material pieces before sewing. The measured source paper is
 * retained exactly; rigid positioning is not a fitted or accepted garment. */
const VERSION='r008-source-paper-manufacturing-draft@1';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const dist=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{const length=Math.hypot(...v);if(!(length>1e-12))throw Error('Nondegenerate source manufacturing direction required');return v.map(x=>x/length);};
const STAGE_IDS=[
 ['main-rise',['center-front','center-back']],
 ['gusset',['gusset-FL','gusset-FR','gusset-BL','gusset-BR']],
 ['leg-sides-and-left-closure',['inseam-left','inseam-right','outseam-right','outseam-left','side-opening-left']],
 ['waistband',['waist-FL','waist-FR','waist-BR','waist-BL','waistband-FL-FR','waistband-FR-BR','waistband-BR-BL','waistband-BL-FL']]
];
function sourceQuotient(count,seams,activeIds){
 const parent=Array.from({length:count},(_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
 for(const seam of seams)if(activeIds.has(seam.id))for(const {a,b} of seam.pairs)parent[find(b)]=find(a);
 const groups=new Map();for(let i=0;i<count;i++){const r=find(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}
 const seamGroups=[...groups.values()],quotientMap=new Uint32Array(count);seamGroups.forEach((g,id)=>g.forEach(i=>quotientMap[i]=id));
 return {seamGroups,quotientMap};
}
function inspectMetric(pieces,ranges,positions){
 const byPiece={};let maximum=0,degenerateTriangles=0;
 for(const piece of pieces){const off=ranges.find(r=>r.pieceId===piece.id).offset;let strain=0;
  for(const ids of piece.triangles){
   const [u,a,b]=ids.map(i=>piece.materialCoordinates[i]),[p,q,r]=ids.map(i=>Array.from(positions.subarray((off+i)*3,(off+i)*3+3))),
    du1=a[0]-u[0],dv1=a[1]-u[1],du2=b[0]-u[0],dv2=b[1]-u[1],det=du1*dv2-du2*dv1;
   if(!Number.isFinite(det)||Math.abs(det)<=1e-14)throw Error('Manufacturing source triangle is degenerate');
   const ab=q.map((v,k)=>v-p[k]),ac=r.map((v,k)=>v-p[k]),fu=ab.map((v,k)=>(v*dv2-ac[k]*dv1)/det),fv=ab.map((v,k)=>(ac[k]*du1-v*du2)/det),
    x=dot(fu,fu),y=dot(fu,fv),z=dot(fv,fv),d=Math.hypot(x-z,2*y),smin=Math.sqrt(Math.max(0,(x+z-d)/2)),smax=Math.sqrt(Math.max(0,(x+z+d)/2));
   if(smin<1e-8)degenerateTriangles++;strain=Math.max(strain,Math.abs(smin-1),Math.abs(smax-1));
  }
  byPiece[piece.id]={maxAbsPrincipalStrain:strain};maximum=Math.max(maximum,strain);
 }
 return {authority:'source2D versus separate rigid source pieces; before any source-seam closure',byPiece,maxAbsPrincipalStrain:maximum,degenerateTriangles,nearZeroMetric:maximum<1e-9,stitchedGarmentValidated:false};
}
export function createShortsManufacturingDraft(existingDraft){
 const d=existingDraft;
 if(!d||d.pieces?.length!==9||d.positions?.length!==1659||d.sourceUV?.length!==1106||d.triangles?.length!==2544||d.seams?.length!==19)throw Error('Manufacturing requires the actual measured 9/553/848/19 source draft');
 const count=553,pieces=structuredClone(d.pieces),ranges=structuredClone(d.ranges),seams=structuredClone(d.seams),positions=new Float64Array(count*3),sourceUV=Float64Array.from(d.sourceUV),triangles=Uint32Array.from(d.triangles),masses=Float64Array.from(d.masses);
 if(!sourceUV.every(Number.isFinite)||!masses.every(m=>Number.isFinite(m)&&m>0))throw Error('Manufacturing requires finite source UV and positive original material masses');
 const suppliedIds=seams.map(s=>s.id),expectedIds=STAGE_IDS.flatMap(([,ids])=>ids);
 if(new Set(suppliedIds).size!==19||expectedIds.some(id=>!suppliedIds.includes(id)))throw Error('Manufacturing stage IDs must match the actual nineteen canonical source seams');
 // The previous source-flat front/back pairs were in a strict common plane.
 // A distance solve cannot leave that invariant subspace by itself. Give
 // each main piece one rigid manufacturing fold about its actual G cut
 // edge: source edge -> source G edge, waistward -> world up plus its own
 // outward lateral direction. The fixed 45-degree holding pose is a seed,
 // not a fitted fold or a changed rest angle. No angle search is performed.
 const frames=new Map(),gPiece=pieces.find(p=>p.id==='G'),gRange=ranges.find(r=>r.pieceId==='G'),
  gPlacement=Array.isArray(d.receipt?.gussetInitialAssembly?.origin)?{origin:d.receipt.gussetInitialAssembly.origin.slice(),basisU:[1,0,0],basisV:[0,0,-1],method:'rigid source paper below witnessed actual crotch'}:structuredClone(gPiece.placement),
  gap=d.material?.fullThicknessM;
 if(!(Number.isFinite(gap)&&gap>0))throw Error('Source cloth full thickness required for the temporary manufacturing layer gap');
 for(const piece of pieces){const {origin,basisU,basisV}=piece.placement??{};
  if([origin,basisU,basisV].some(a=>!Array.isArray(a)||a.length!==3||a.some(v=>!Number.isFinite(v))))throw Error('Actual source rigid placement required for '+piece.id);
  if(Math.abs(dot(basisU,basisU)-1)>1e-10||Math.abs(dot(basisV,basisV)-1)>1e-10||Math.abs(dot(basisU,basisV))>1e-10)throw Error('Source placement must be isometric, not scaled, for '+piece.id);
 }
 frames.set('G',gPlacement);
 const worldG=i=>gPlacement.origin.map((v,k)=>v+gPlacement.basisU[k]*gPiece.materialCoordinates[i][0]+gPlacement.basisV[k]*gPiece.materialCoordinates[i][1]);
 const mainFoldFrames=[];
 for(const piece of pieces.filter(p=>p.kind==='leg-panel')){
  const range=ranges.find(r=>r.pieceId===piece.id),seam=seams.find(s=>s.id==='gusset-'+piece.id);
  if(seam.a.pieceId!==piece.id||seam.b.pieceId!=='G')throw Error('Expected actual source G cut pairing');
  const first=seam.pairs[0],last=seam.pairs.at(-1),ai=first.a-range.offset,bi=last.a-range.offset,ga=first.b-gRange.offset,gb=last.b-gRange.offset,
   a=piece.materialCoordinates[ai],b=piece.materialCoordinates[bi],sourceT=unit(b.map((v,k)=>v-a[k])),sourceQ=[-sourceT[1],sourceT[0]],
   waist=piece.materialCoordinates[piece.landmarks.centerWaist],towardWaist=waist.map((v,k)=>v-a[k]),A=worldG(ga),B=worldG(gb),targetT=unit(B.map((v,k)=>v-A[k]));
  if(dot(sourceQ,towardWaist)<0)sourceQ.forEach((v,k)=>sourceQ[k]=-v);
  if(Math.abs(dist(a,b)-dist(A,B))>1e-10)throw Error('Source main and G edge lengths must match before the rigid fold');
  const outward=[piece.side==='left'?-1:1,0,0],lateral=unit(outward.map((v,k)=>v-dot(outward,targetT)*targetT[k])),
   targetQ=unit(lateral.map((v,k)=>v+(k===1?1:0))),
   basisU=targetT.map((v,k)=>v*sourceT[0]+targetQ[k]*sourceQ[0]),basisV=targetT.map((v,k)=>v*sourceT[1]+targetQ[k]*sourceQ[1]),
   origin=A.map((v,k)=>v+targetQ[k]*gap-basisU[k]*a[0]-basisV[k]*a[1]),
   frame={origin,basisU,basisV,method:'one rigid 45-degree waistward/outward holding fold around the actual source G cut edge'};
  frames.set(piece.id,frame);mainFoldFrames.push({pieceId:piece.id,sourceSeamID:seam.id,sourceEndpointIndices:[ai,bi],sourceGEndpointIndices:[ga,gb],sourceEdgeLengthM:dist(a,b),targetEdgeLengthM:dist(A,B),materialLayerGapM:gap,sourceWaistward:sourceQ,targetWaistward:targetQ,normal:cross(basisU,basisV),foldHoldingAngleRadians:Math.PI/4});
 }
 for(const piece of pieces.filter(p=>p.kind==='waistband')){
  const main=pieces.find(p=>p.id===piece.parentPanel),old=main.placement,next=frames.get(main.id),oldN=cross(old.basisU,old.basisV),nextN=cross(next.basisU,next.basisV),
   rotate=v=>[0,1,2].map(k=>next.basisU[k]*dot(v,old.basisU)+next.basisV[k]*dot(v,old.basisV)+nextN[k]*dot(v,oldN)),
   delta=rotate(piece.placement.origin.map((v,k)=>v-old.origin[k]));
  frames.set(piece.id,{origin:next.origin.map((v,k)=>v+delta[k]),basisU:rotate(piece.placement.basisU),basisV:rotate(piece.placement.basisV),method:'same rigid transform as its actual parent; original flat waistband handling gap retained'});
 }
 const nonCoplanarity=['F','B'].map(prefix=>{
  const left=mainFoldFrames.find(f=>f.pieceId===prefix+'L'),right=mainFoldFrames.find(f=>f.pieceId===prefix+'R'),normalCrossLength=Math.hypot(...cross(left.normal,right.normal));
  if(normalCrossLength<.01)throw Error('Manufacturing centre pair must have a genuine three-dimensional fold seed');
  return {sourceCenterSeamID:prefix==='F'?'center-front':'center-back',normalCrossLength,coplanar:false};
 });
 const placements=[];
 for(const piece of pieces){
  const range=ranges.find(r=>r.pieceId===piece.id);if(!range||range.count!==piece.materialCoordinates.length)throw Error('Source piece range mismatch');
  const placement=frames.get(piece.id);
  const {origin,basisU,basisV}=placement??{};
  if([origin,basisU,basisV].some(a=>!Array.isArray(a)||a.length!==3||a.some(v=>!Number.isFinite(v))))throw Error('Actual source rigid placement required for '+piece.id);
  if(Math.abs(dot(basisU,basisU)-1)>1e-10||Math.abs(dot(basisV,basisV)-1)>1e-10||Math.abs(dot(basisU,basisV))>1e-10)throw Error('Source placement must be isometric, not scaled, for '+piece.id);
  piece.materialCoordinates.forEach((uv,i)=>{
   const global=range.offset+i;
   if(uv[0]!==sourceUV[global*2]||uv[1]!==sourceUV[global*2+1])throw Error('Source paper UV mismatch before manufacturing');
   positions.set(origin.map((v,k)=>v+basisU[k]*uv[0]+basisV[k]*uv[1]),global*3);
  });
  placements.push({pieceId:piece.id,origin:origin.slice(),basisU:basisU.slice(),basisV:basisV.slice(),authority:placement.method??'original source rigid flat-piece placement'});
 }
 const initial=sourceQuotient(count,seams,new Set()),target=sourceQuotient(count,seams,new Set(suppliedIds));
 let cumulative=[];const stages=STAGE_IDS.map(([id,ids],index)=>{
  cumulative=[...cumulative,...ids];const q=sourceQuotient(count,seams,new Set(cumulative));
  return {id,index,sourceSeamIDs:ids.slice(),cumulativeSourceSeamIDs:cumulative.slice(),sourceQuotientDofs:q.seamGroups.length,materialValidationRequiredAfterClosure:true,bodyContactEnabled:false,elasticActivationPermitted:index===STAGE_IDS.length-1};
 });
 const metric=inspectMetric(pieces,ranges,positions);if(!metric.nearZeroMetric||metric.degenerateTriangles)throw Error('Manufacturing initial material must be near-zero strain for all nine pieces');
 const elasticEdges=d.elasticEdges.map(edge=>({...edge,currentLengthM:dist(Array.from(positions.subarray(edge.a*3,edge.a*3+3)),Array.from(positions.subarray(edge.b*3,edge.b*3+3)))}));
 const receipt={version:VERSION,authority:'fresh measured source2D paper before seams or body-contour fitting',sourceCounts:{pieces:9,particles:553,triangles:848,sourceSeams:19,initialIndependentDofs:553,fullySewnSourceDofs:target.seamGroups.length},sourcePaperCommit:d.receipt.paperSource.commit,sourcePaperSHA256:d.receipt.paperSource.sha256,sourceUVRestAreaMassChanged:false,sourceAreaM2:d.receipt.areaM2,massKg:d.receipt.massKg,sourceBodyMeasurementAuthority:d.receipt.authority,rigidPlacements:placements,initialMaterial:metric,activeSourceSeamIDs:[],stagePlan:stages,allMaterialDofsIntendedFree:true,activeElasticEdges:0,bodyContactEnabled:false,bodyFitValidated:false,motionValidated:false,visualAcceptance:false,productionReady:false,threeDimensionalSeed:{authority:'source cut edge rigid correspondence; predetermined waistward/outward manufacturing holding pose',mainFoldFrames,nonCoplanarity,materialLayerGapM:gap,angleScans:0,selfContactValidated:false,requiresGradualSourceSewing:true}};
 return {...d,version:VERSION,positions,sourceUV,uvs:sourceUV,triangles,pieces,ranges,seams,masses,mass:masses,pattern:{...structuredClone(d.pattern),pieces,seams:structuredClone(d.pattern.seams),authoringPlacement:{kind:'nine_independent_rigid_source_papers',sourceRestChangedFrom3D:false,bodyFitValidated:false}},seamGroups:initial.seamGroups,quotientMap:initial.quotientMap,targetSourceSeamGroups:target.seamGroups,targetSourceQuotientMap:target.quotientMap,activeSeamIDs:[],sewingStages:stages,elasticEdges,activeElasticEdgeIndices:[],manufacturingReceipt:receipt,receipt:{...structuredClone(d.receipt),placement:'nine independent rigid source papers before progressive sewing',manufacturing:receipt,bodyFitValidated:false,motionValidated:false,visualAcceptance:false,productionReady:false}};
}
