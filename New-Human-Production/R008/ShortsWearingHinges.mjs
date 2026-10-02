import * as THREE from 'three';
import {projectManufacturingPaper} from './ShortsManufacturingMetric.mjs';
import {scSolveBending} from './ShortsBending.mjs';

// Finite, temporary material-coordinate authoring. Never called by native
// fixedStep. All source metric/mass/hinge rests and the eleven real sewn seams
// retain their production ownership. Contact and dressing-path QA are separate.
export const WEARING_MAIN_SEAM_IDS=Object.freeze(['center-front','center-back','gusset-FL','gusset-FR','gusset-BL','gusset-BR','inseam-left','inseam-right','outseam-right','outseam-left','side-opening-left']);
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k])),mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
const sourceIdentity=d=>JSON.stringify({uv:Array.from(d.sourceUV),mass:Array.from(d.masses),triangles:Array.from(d.triangles),seams:d.seams});
function actorFrame(cloth){
 if(!cloth.actor?.getWorldPosition||!cloth.actor?.getWorldQuaternion)throw Error('The source garment actor frame is required');
 const p=new THREE.Vector3(),q=new THREE.Quaternion();cloth.actor.getWorldPosition(p);cloth.actor.getWorldQuaternion(q);
 const matrix=new THREE.Matrix4().compose(p,q,new THREE.Vector3(1,1,1));
 return {matrix,localToWorld:a=>new THREE.Vector3(...a).applyMatrix4(matrix).toArray(),authority:'actor translation and quaternion rotation only; actual character scale already retained by source actor-local metre measurements'};
}
function guard(cloth,d){
 if(cloth.steps!==0||cloth.time!==0||cloth.positions.length!==491||cloth.activeSeams.length!==11||WEARING_MAIN_SEAM_IDS.some(id=>!cloth.activeSeams.some(s=>s.id===id)))throw Error('A genuine material-accepted eleven-source-seam 491-DOF parent at native time zero is required');
 if(!cloth.audit(false).manufacturingMaterialValid||!cloth.invMass.every(v=>Number.isFinite(v)&&v>0))throw Error('The current source parent must pass its unchanged five-percent metric with all DOFs free');
 if(sourceIdentity(cloth.draft)!==sourceIdentity(d))throw Error('Parent and guide draft must have exactly the same source paper, masses and nineteen pairs');
}

// Any source edge chain is an exact upper bound on the distance its ends can
// attain when every source triangle stays within five-percent principal strain.
// This certificate is sufficient to prove impossible targets when violated;
// absence of a violation is explicitly NOT an isometric-embedding proof.
export function auditWearingSourcePathBounds(cloth,boundaryTargets,{endpointSlackM=.008}={}){
 const adjacency=cloth.positions.map(()=>[]);for(const e of cloth.edges){adjacency[e.a].push([e.b,e.rest]);adjacency[e.b].push([e.a,e.rest]);}
 const unique=new Map();for(const t of boundaryTargets.targets){const q=cloth.quotient[t.sourceIndex],old=unique.get(q);if(old&&distance(old.point,t.point)>1e-9)throw Error('Actual stitched boundary target disagrees with itself');unique.set(q,{...t,q});}
 const rows=[...unique.values()],violations=[];let maximumRequiredRatio=0,worst=null;
 for(let a=0;a<rows.length;a++){
  const lengths=new Float64Array(adjacency.length).fill(Infinity),parents=new Int32Array(adjacency.length).fill(-1),done=new Uint8Array(adjacency.length);lengths[rows[a].q]=0;
  for(let sweep=0;sweep<adjacency.length;sweep++){let u=-1,best=Infinity;for(let i=0;i<lengths.length;i++)if(!done[i]&&lengths[i]<best){best=lengths[i];u=i;}if(u<0)break;done[u]=1;for(const[v,l]of adjacency[u])if(lengths[v]>best+l){lengths[v]=best+l;parents[v]=u;}}
  for(let b=a+1;b<rows.length;b++){const length=lengths[rows[b].q];if(!Number.isFinite(length))continue;const actual=distance(rows[a].point,rows[b].point),necessary=Math.max(0,actual-2*endpointSlackM),ratio=necessary/length,record={a:rows[a],b:rows[b],targetDistanceM:actual,sourceEdgePathLengthM:length,endpointSlackM,requiredPathStretchLowerBound:ratio,permittedPathLengthM:1.05*length+2*endpointSlackM};if(ratio>maximumRequiredRatio){maximumRequiredRatio=ratio;worst=record;}if(ratio>1.05+1e-9){const path=[];let u=rows[b].q;while(u!==-1){path.push(u);if(u===rows[a].q)break;u=parents[u];}violations.push({...record,actualSourceQuotientPath:path.toReversed()});}}
 }
 return {authority:'actual eleven-seam quotient graph and original source2D edge lengths; Euclidean desired endpoint distance minus two 8mm endpoint tolerances',boundaryDofs:rows.length,maximumRequiredRatio,worst,violations,contradictionProven:violations.length>0,absenceOfContradictionProvesExistence:false};
}

export function createShortsWearingHingeGuides(cloth,draft,boundaryTargets){
 guard(cloth,draft);if(!boundaryTargets?.valid)throw Error('Corrected continuous source-arc boundary target audit must pass first');
 // A closed source arc omits its final endpoint to avoid duplicate targets.
 // Resolve that endpoint through ONLY its already-sewn source quotient owner.
 const frame=actorFrame(cloth),targetByQuotient=new Map(boundaryTargets.targets.map(t=>[cloth.quotient[t.sourceIndex],frame.localToWorld(t.point)])),field=new Array(553).fill(null),ranges=new Map(draft.ranges.map(r=>[r.pieceId,r])),controls=[],sourceContradictions=[];
 const hipRow=draft.receipt.design.hipRow,columns=draft.receipt.design.columns,rows=draft.receipt.design.rows;
 if(columns!==7||rows!==13||hipRow!==5)throw Error('This single wearing increment requires its audited structured original seven-column paper');
 for(const piece of draft.pieces.filter(p=>p.kind==='leg-panel')){
  const offset=ranges.get(piece.id).offset,n=columns+1;for(let c=0;c<=columns;c++){
   const controlRows=[0,hipRow,rows],sourceIndices=controlRows.map(r=>offset+r*n+c),points=[targetByQuotient.get(cloth.quotient[sourceIndices[0]]),frame.localToWorld(Array.from(draft.positions.subarray(sourceIndices[1]*3,sourceIndices[1]*3+3))),targetByQuotient.get(cloth.quotient[sourceIndices[2]])];
   if(points.some(p=>!p||p.some(v=>!Number.isFinite(v))))throw Error('Actual corrected waist/hem and measured hip control required');
   // The hip section comes from the actual source-envelope drafting sample,
   // before its old row7..9 rigid-G displacement. It is a soft guide only.
   controls.push({pieceId:piece.id,column:c,sourceIndices,controlRows,points,authority:'actual source waist and corrected loose hem continuous arcs, plus actual measured original hip row; not a paper rest reference'});
   for(let r=0;r<=rows;r++){const low=r<=hipRow?0:hipRow,high=r<=hipRow?hipRow:rows,which=r<=hipRow?0:1,v=piece.materialCoordinates[r*n+c][1],v0=piece.materialCoordinates[low*n+c][1],v1=piece.materialCoordinates[high*n+c][1],t=(v-v0)/(v1-v0);if(!(Number.isFinite(t)&&t>=-1e-10&&t<=1+1e-10))throw Error('Source waist/hip/hem depth chart must stay monotonic');field[offset+r*n+c]=mix(points[which],points[which+1],Math.max(0,Math.min(1,t)));}
  }
 }
 // Shared source endpoints have a single guide owned by their actual quotient.
 // No extra unions, discontinuous piece teleport or fabricated G cut targets.
 const guides=[];for(let q=0;q<cloth.members.length;q++){
  const source=cloth.members[q].filter(i=>field[i]);if(!source.length)continue;let weight=0;const goal=[0,0,0];for(const i of source){const w=draft.masses[i];weight+=w;for(let k=0;k<3;k++)goal[k]+=w*field[i][k];}goal.forEach((v,k)=>goal[k]=v/weight);const disagreement=Math.max(...source.map(i=>distance(field[i],goal)));if(disagreement>1e-8)sourceContradictions.push({q,sourceIndices:source,maximumUnaggregatedTargetMismatchM:disagreement});guides.push({q,sourceIndices:source,goal,start:cloth.positions[q].slice(),lambda:[0,0,0]});
 }
 // G centre remains an independent mobile DOF. Its finite guide references the
 // actual witnessed crotch, while all eight G boundary points follow ONLY
 // existing main/G source equivalences. No abdomen-extremum G tip loft.
 const g=draft.pieces.find(p=>p.kind==='gusset'),gRange=ranges.get('G'),center=gRange.offset+8,q=cloth.quotient[center],anchor=draft.receipt.gussetInitialAssembly.origin;
 if(!anchor||!g||cloth.members[q].length!==1)throw Error('Actual mobile source G centre and witnessed crotch rigid-frame origin required');
 guides.push({q,sourceIndices:[center],goal:frame.localToWorld(anchor),start:cloth.positions[q].slice(),lambda:[0,0,0],authority:'finite actual crotch-centre guide only; source G tips are not prescribed'});
 const guideMap=new Map(guides.map(g=>[g.q,g.goal]));
 const continuousTriangles=cloth.triangles.filter(t=>t.original.some(i=>field[i])).map(t=>({sourceIndices:t.original.slice(),sourceUV:t.uv.map(u=>u.slice()),quotientIndices:t.q.slice(),guideCorners:t.q.map(q=>guideMap.get(q)?.slice()??null),interpolation:'same sewn quotient corner values; affine barycentric over each actual source material triangle'}));
 return {version:'r008-actual-source-continuous-wearing-hinges@1',coordinateFrame:{authority:frame.authority,actorLocalToWorldMatrix:frame.matrix.toArray(),guidesAndRuntimePositions:'world metres',sourceDraftAndBoundaryTargets:'actor-local metres, actual character scale retained'},guides,controls,continuousTriangles,sourceContradictions,sharedGuideOriginalTargetsAllSatisfied:sourceContradictions.length===0,sharedGuideAggregationAuthority:'mass-weighted single quotient temporary guide; averaging does not satisfy disagreeing original per-piece goals',sourceCoordinateFieldCoversAllFourMainPieces:true,gBoundaryAuthority:'actual four sewn cut boundaries, unconstrained beyond their existing main quotient guide',hingeRestAuthority:'native source flat-paper dihedral rest zero, not formed geometry',permanentGuides:0};
}

export function auditWearingGuideIntrinsic(cloth,construction){
 const targets=new Map(construction.guides.map(g=>[g.q,g.goal])),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),byPiece={};let worst=null,maxAbsPrincipalStrain=0;
 for(const t of cloth.triangles){const xyz=t.q.map(q=>targets.get(q));if(xyz.some(v=>!v))continue;const [a,b,c]=xyz,ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]),fu=ab.map((v,k)=>v*t.inv[0]+ac[k]*t.inv[2]),fv=ab.map((v,k)=>v*t.inv[1]+ac[k]*t.inv[3]),x=dot(fu,fu),y=dot(fu,fv),z=dot(fv,fv),disc=Math.hypot(x-z,2*y),stretches=[Math.sqrt(Math.max(0,(x+z-disc)/2)),Math.sqrt(Math.max(0,(x+z+disc)/2))],strain=Math.max(...stretches.map(v=>Math.abs(v-1))),pieceId=cloth.draft.ranges.find(r=>t.original[0]>=r.offset&&t.original[0]<r.offset+r.count).pieceId;byPiece[pieceId]=Math.max(byPiece[pieceId]||0,strain);if(strain>maxAbsPrincipalStrain){maxAbsPrincipalStrain=strain;worst={pieceId,sourceIndices:t.original.slice(),quotientIndices:t.q.slice(),sourceUV:t.uv.map(v=>v.slice()),targetPositions:xyz.map(v=>v.slice()),principalStretches:stretches};}}
 return {authority:'read-only exact source2D triangle metric of the temporary guide field, not of paper rest or accepted cloth',maxAbsPrincipalStrain,byPiece,worst,guideFieldItselfIsWithinFivePercent:maxAbsPrincipalStrain<=.05,failedGuideFieldProvesPaperBodyIncompatible:false};
}

export async function arrangeShortsWearingHinges(cloth,draft,boundaryTargets,exteriorDraft,onProgress=()=>{}){
 guard(cloth,draft);if(sourceIdentity(exteriorDraft)!==sourceIdentity(draft))throw Error('Independent exterior W seed must retain this exact paper');
 const frame=actorFrame(cloth),identity=cloth.materialIdentity(),before=cloth.audit(false),pathBounds=auditWearingSourcePathBounds(cloth,boundaryTargets),frames=exteriorDraft.exteriorFrames;
 if(!frames||frames.length!==9)throw Error('Audited proper exterior source frames required');
 const raw=()=>cloth.positions.map(p=>p.slice()),phases=[{phase:'legal-eleven-seam-parent',positions:raw(),material:before}];
 if(pathBounds.contradictionProven)return {status:'HOLD_SOURCE_BOUNDARY_INCOMPATIBILITY',before,pathBounds,phases,sourceIdentityUnchanged:true,constructionPerformed:false,productionReady:false};
 // Only the four unattached independent W sheets may change their entire rigid
 // initial placement. MAIN+G stay continuously connected throughout this lane.
 for(const range of draft.ranges.filter(r=>r.pieceId.startsWith('W')))for(let i=range.offset;i<range.offset+range.count;i++){const q=cloth.quotient[i];if(cloth.members[q].length!==1)throw Error('Waistband must remain wholly independent before its final source seam stage');cloth.positions[q].splice(0,3,...frame.localToWorld(Array.from(exteriorDraft.positions.subarray(i*3,i*3+3))));}
 const construction=createShortsWearingHingeGuides(cloth,draft,boundaryTargets),guideIntrinsic=auditWearingGuideIntrinsic(cloth,construction),seedAudit=cloth.audit(false),trace=[],h=cloth.options.fixedDt;
 if(!seedAudit.manufacturingMaterialValid)throw Error('Rigid independent waistband relocation may not invalidate source metric');phases.push({phase:'independent-W-exterior-seed',positions:raw(),material:seedAudit});
 // The first bounded diagnostic established this particular linear field is
 // inadmissible. Future cold inputs must disclose it before another solver run.
 // This concerns the chosen guide field, not existence of a wearable paper.
 if(construction.sourceContradictions.length||!guideIntrinsic.guideFieldItselfIsWithinFivePercent){
  if(identity!==cloth.materialIdentity())throw Error('Guide preflight changed source rest or mass');
  return {status:construction.sourceContradictions.length?'HOLD_SHARED_GUIDE_INCONSISTENCY':'HOLD_TARGET_FIELD_SOURCE_METRIC',scope:'cold source-guide preflight; no wearing solver',before,seedAudit,after:seedAudit,pathBounds,construction,guideIntrinsic,phases,trace:[],constructionPerformed:false,solverPasses:0,permanentGuideCount:0,sourceIdentityUnchanged:true,allSourceDofsFree:cloth.invMass.every(w=>w>0),sourceSeams:11,sourceDofs:491,bodyProjectionEnabled:false,finalWaistSeamStagePerformed:false,activeElasticEdges:0,actualMotionSteps:cloth.steps,actualNativeTime:cloth.time,failedGuideFieldProvesPaperBodyIncompatible:false,motionValidated:false,productionReady:false};
 }
 const boundaryGap=()=>Math.max(...boundaryTargets.targets.map(t=>distance(cloth.positions[cloth.quotient[t.sourceIndex]],frame.localToWorld(t.point)))),guideRMS=()=>Math.sqrt(construction.guides.reduce((s,g)=>s+distance(cloth.positions[g.q],g.goal)**2,0)/construction.guides.length),start=performance.now();
 const boundaryBeforeM=boundaryGap(),fieldBeforeM=guideRMS(),complianceMPerN=.01;
 for(let pass=1;pass<=200;pass++){
  const guided=pass<=160,progress=Math.min(1,pass/80);for(const e of cloth.edges)e.lambda=0;for(const e of cloth.bends)e.lambda=0;for(const g of construction.guides)g.lambda.fill(0);
  for(let sweep=0;sweep<8;sweep++){
   if(guided)for(const g of construction.guides){const goal=mix(g.start,g.goal,progress),p=cloth.positions[g.q],alpha=complianceMPerN/(h*h),w=cloth.invMass[g.q];for(let k=0;k<3;k++){const dl=(-(p[k]-goal[k])-alpha*g.lambda[k])/(w+alpha);g.lambda[k]+=dl;p[k]+=w*dl;}}
   for(const e of cloth.bends)scSolveBending(e,cloth.bendParticles,h,cloth.options.bendCompliance);
   for(const e of cloth.edges)cloth.solveDistance(e,h);
   for(const t of cloth.triangles)projectManufacturingPaper(cloth,t);
  }
  if(pass%10===0){const a=cloth.audit(false);trace.push({pass,temporaryGuideCount:guided?construction.guides.length:0,guideProgress:guided?progress:null,principalStrain:a.mainStrain,sourceBoundaryGapM:boundaryGap(),wholeFieldRMSM:guideRMS(),maximumAbsoluteHingeLambda:Math.max(0,...cloth.bends.map(b=>Math.abs(b.lambda))),finite:a.finite});onProgress(trace.at(-1));await new Promise(resolve=>setTimeout(resolve,0));if(!a.finite)break;}
  if([80,160,200].includes(pass))phases.push({phase:pass===80?'continuous-guide-arrived':pass===160?'continuous-guide-released':'forty-pass-free-hinge-material-relaxation',positions:raw(),material:cloth.audit(false),hinges:cloth.bends.map(b=>({indices:b.indices.slice(),restAngle:b.restAngle,lambda:b.lambda})),allSourceDofsFree:cloth.invMass.every(w=>w>0)});
 }
 if(identity!==cloth.materialIdentity())throw Error('Temporary wearing construction changed source material/rest/mass');const after=cloth.audit(false),targetGap=boundaryGap();
 return {status:after.manufacturingMaterialValid&&targetGap<=.008?'SOURCE_METRIC_AND_BOUNDARY_LOCAL_PASS_CONTACT_PENDING':'HOLD_LOCAL_WEARING_CONSTRUCTION',scope:'one bounded continuous material-coordinate source authoring field plus flat-paper hinge relaxation; not a native physics, contact, or dressing-path acceptance',before,seedAudit,after,pathBounds,construction,guideIntrinsic,trace,phases,elapsedMs:performance.now()-start,boundaryBeforeM,sourceBoundaryGapM:targetGap,boundaryGapImprovementM:boundaryBeforeM-targetGap,wholeFieldBeforeM:fieldBeforeM,wholeFieldFinalM:guideRMS(),temporaryGuideComplianceMPerN:complianceMPerN,progressiveGuidePasses:80,holdingEndPass:160,freeReleasePasses:40,permanentGuideCount:0,hingeRestAnglesChanged:false,sourceIdentityUnchanged:true,allSourceDofsFree:cloth.invMass.every(w=>w>0),bodyProjectionEnabled:false,selfProjectionEnabled:false,sourceSeams:11,sourceDofs:491,finalWaistSeamStagePerformed:false,activeElasticEdges:0,actualMotionSteps:cloth.steps,actualNativeTime:cloth.time,positionsBakedAsRest:false,contactValidated:false,completeDressingPathValidated:false,motionValidated:false,productionReady:false};
}
