import * as THREE from 'three';
import {inspectShortsTriangleCrossings} from './ShortsCoverageIntersection.mjs';
// Explicit geometric coverage authoring only. This function neither integrates
// cloth nor redefines the source material to accept a deformed preview.
const CLEARANCE_M=.006,MAXIMUM_PLACEMENTS=12,MAXIMUM_CONTACT_MOVE_M=.020;
const dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
const frozenState=c=>JSON.stringify({previous:c.previous,velocity:c.velocity,initial:c.initial,history:c.history,time:c.time,steps:c.steps,accumulator:c.accumulator,enabled:c.enabled,cpu:c.cpu,edgeLambda:c.edges.map(e=>e.lambda),bendLambda:c.bends.map(e=>e.lambda),elasticLambda:c.elastic.map(e=>e.lambda),options:c.options});
function principalAudit(cloth){
 let maximum=0,worst=null;const byPiece={};
 for(const t of cloth.triangles){const [p,a,b]=t.q.map(i=>cloth.positions[i]),[u,v,w]=t.original.map(i=>Array.from(cloth.draft.sourceUV.slice(i*2,i*2+2))),du1=v[0]-u[0],dv1=v[1]-u[1],du2=w[0]-u[0],dv2=w[1]-u[1],det=du1*dv2-du2*dv1;
  if(!Number.isFinite(det)||Math.abs(det)<=1e-14)throw Error('Coverage requires nondegenerate unchanged source paper');
  const ab=a.map((x,k)=>x-p[k]),ac=b.map((x,k)=>x-p[k]),Fu=ab.map((x,k)=>(x*dv2-ac[k]*dv1)/det),Fv=ab.map((x,k)=>(ac[k]*du1-x*du2)/det),A=dot(Fu,Fu),B=dot(Fu,Fv),D=dot(Fv,Fv),disc=Math.hypot(A-D,2*B),minimumStretch=Math.sqrt(Math.max(0,(A+D-disc)/2)),maximumStretch=Math.sqrt(Math.max(0,(A+D+disc)/2)),strain=Math.max(Math.abs(minimumStretch-1),Math.abs(maximumStretch-1)),pieceId=cloth.draft.ranges.find(r=>t.original[0]>=r.offset&&t.original[0]<r.offset+r.count)?.pieceId;
  byPiece[pieceId]=Math.max(byPiece[pieceId]??0,strain);if(strain>maximum){maximum=strain;worst={pieceId,sourceIndices:t.original.slice(),actualQuotient:t.q.slice(),minimumStretch,maximumStretch,principalStrain:strain};}
 }
 return {sourceAuthority:'independent current sourceUV/actual quotient XYZ triangle metric; source rest unchanged',maximumPrincipalStrain:maximum,byPiece,worst,originalFivePercentGatePassed:maximum<=.05};
}
export function placeShortsCoverage(cloth,barePelvis){
 if(!cloth?.materialIdentity||!cloth?.syncRender||!barePelvis?.queryAPI?.closestPoint||barePelvis.report?.closedSolidTopologyCertified!==true)throw Error('Actual cloth and explicitly closed generated bare-skin query required');
 const contactSnapshot=cloth.body?.snapshot?.(),signedDistanceAuthority='current-native-part-world-aabb-outside-proof-plus-closed-bare-inside-priority';
 if(contactSnapshot?.schema!=='r008-shorts-visible-skin-contact/v2'||contactSnapshot.signedDistanceAuthority!==signedDistanceAuthority||contactSnapshot.fullSolidUnionCertified!==false||![9,10,19].every(id=>contactSnapshot.contactExcludedParts?.includes(id)))throw Error('HOLD: actual visible-skin contact requires current-part WORLD bounds sign proof and closed-bare inside priority; old open native signs are not authorized');
 if(cloth.positions.length!==451||cloth.quotient.length!==553||cloth.triangles.length!==848||cloth.activeSeams.length!==19)throw Error('Coverage operates on the real complete nineteen-seam 451-DOF garment');
 if(!cloth.invMass.every(x=>Number.isFinite(x)&&x>0)||!cloth.positions.every(p=>p.every(Number.isFinite)))throw Error('All actual material DOFs must remain free and finite');
 const materialIdentity=cloth.materialIdentity(),stateIdentity=frozenState(cloth),original=cloth.positions.map(p=>p.slice()),originalMaterial=principalAudit(cloth),protectedY=new Map(),protectedRoles=new Map(),samples=[],edges=new Map();
 const recipe=cloth.draft.receipt,localHeights={upper:recipe?.upperY,lower:recipe?.lowerY,middle:recipe?.middleY,hem:recipe?.hem?.y};
 if(!Object.values(localHeights).every(Number.isFinite)||!(localHeights.upper>localHeights.middle&&localHeights.middle>localHeights.lower&&localHeights.lower>localHeights.hem))throw Error('HOLD: actual measured draft waist/casing/hem target heights required');
 // The draft is actor-local metres, with actual subject scale already retained.
 // Cloth particles are WORLD metres. A scalar WORLD-Y guard is valid only for
 // an upright actor; yaw and translation preserve its horizontal sections.
 if(!cloth.actor?.matrixWorld)throw Error('HOLD: actual actor WORLD frame required for measured height placement');
 cloth.actor.updateMatrixWorld?.(true);const actorPosition=new THREE.Vector3(),actorRotation=new THREE.Quaternion(),actorScale=new THREE.Vector3();cloth.actor.matrixWorld.decompose(actorPosition,actorRotation,actorScale);
 if(new THREE.Vector3(0,1,0).applyQuaternion(actorRotation).distanceTo(new THREE.Vector3(0,1,0))>1e-10)throw Error('HOLD: measured scalar-Y coverage placement requires an upright actor');
 const targetHeights=Object.fromEntries(Object.entries(localHeights).map(([role,y])=>[role,y+actorPosition.y]));
 const protect=(source,y,role)=>{const q=cloth.quotient[source];if(!Number.isInteger(q)||q<0||q>=cloth.positions.length)throw Error('Actual source boundary DOF required');if(protectedY.has(q)&&Math.abs(protectedY.get(q)-y)>1e-10)throw Error('HOLD: shared source DOF has conflicting measured boundary heights');if(!protectedY.has(q))protectedY.set(q,y);if(!protectedRoles.has(q))protectedRoles.set(q,new Set());protectedRoles.get(q).add(role);};
 for(const piece of cloth.draft.pieces){
  const range=cloth.draft.ranges.find(r=>r.pieceId===piece.id);if(!range)throw Error('Original piece range required');
  if(piece.kind==='waistband'){
   for(const boundary of ['upper','lower'])for(const i of piece.boundaries[boundary])protect(range.offset+i,targetHeights[boundary],'waistband-'+boundary);
   if(piece.grid?.rows!==2||!Number.isInteger(piece.grid?.columns))throw Error('HOLD: measured casing middle requires original two-row structured paper');
   for(let c=0;c<=piece.grid.columns;c++)protect(range.offset+piece.grid.columns+1+c,targetHeights.middle,'waistband-middle');
  }
  if(piece.kind==='leg-panel')for(const boundary of ['waist','hem'])for(const i of piece.boundaries[boundary])protect(range.offset+i,targetHeights[boundary==='waist'?'lower':'hem'],'main-'+boundary);
 }
 let maximumInitialBoundaryShiftM=0;for(const [id,y] of protectedY){maximumInitialBoundaryShiftM=Math.max(maximumInitialBoundaryShiftM,Math.abs(original[id][1]-y));cloth.positions[id][1]=y;}
 for(let i=0;i<cloth.positions.length;i++)samples.push({kind:'vertex',ids:[i],weights:[1]});
 for(const t of cloth.triangles)for(let i=0;i<3;i++){const a=t.q[i],b=t.q[(i+1)%3];if(a!==b){const key=a<b?a+':'+b:b+':'+a;if(!edges.has(key))edges.set(key,{kind:'unique-source-quotient-edge-midpoint',ids:[Math.min(a,b),Math.max(a,b)],weights:[.5,.5]});}}
 samples.push(...edges.values());for(const [triangleId,t] of cloth.triangles.entries())samples.push({kind:'source-triangle-centroid',triangleId,ids:t.q.slice(),weights:[1/3,1/3,1/3]});
 const point=s=>new THREE.Vector3(...[0,1,2].map(k=>s.ids.reduce((sum,id,i)=>sum+cloth.positions[id][k]*s.weights[i],0))),query=s=>{const p=point(s),h=cloth.body.closestPoint(p);if(!h||![h.distance,h.signedDistance,h.point?.x,h.point?.y,h.point?.z,h.normal?.x,h.normal?.y,h.normal?.z].every(Number.isFinite))throw Error('Coverage query returned nonfinite actual visible-skin data');if(h.guard?.schema!=='visible-skin-contact-sign-selection@1'||h.guard.fullSolidUnionCertified!==false)throw Error('HOLD: each actual visible-skin hit must retain its signed-distance selection proof');if(h.guard.nativeOutsideActualPartAABBProof&&h.part!=='authored-bare-pelvis'&&h.signedDistance<0)throw Error('HOLD: negative native hit contradicts actual part WORLD bounds outside proof');if(h.guard.bareInsidePriority&&(h.part!=='authored-bare-pelvis'||!(h.signedDistance<0)))throw Error('HOLD: closed-bare inside priority selected an inconsistent source surface');return {p,h};};
 const inspect=()=>{let minimum=Infinity,remaining=0,inside=0,ambiguous=0,worst=null;const witnesses=[];for(const [sampleId,s] of samples.entries()){const {p,h}=query(s);if(h.signAmbiguous)ambiguous++;if(h.signedDistance<0)inside++;if(h.signedDistance<CLEARANCE_M)remaining++;if(h.signedDistance<minimum){minimum=h.signedDistance;worst={sampleId,kind:s.kind,triangleId:s.triangleId??null,actualDofs:s.ids.slice(),position:p.toArray(),signedDistanceM:h.signedDistance,bodyPart:h.part,bodyTriangleId:h.triangleId,bodyFeature:typeof h.feature==='string'?h.feature:h.feature?.type,bodyPoint:h.point.toArray(),signedSelectionGuard:h.guard,signAmbiguous:!!h.signAmbiguous};}if(h.signedDistance<CLEARANCE_M||h.signAmbiguous)witnesses.push({sampleId,kind:s.kind,actualDofs:s.ids.slice(),signedDistanceM:h.signedDistance,bodyPart:h.part,bodyTriangleId:h.triangleId,signedSelectionGuard:h.guard,signAmbiguous:!!h.signAmbiguous});}return {minimumSignedDistanceM:minimum,remainingBelowSixMillimetres:remaining,insideSamples:inside,ambiguousSamples:ambiguous,worst,failedWitnesses:witnesses,coveragePassed:remaining===0&&ambiguous===0};};
 const inspectTriangles=()=>inspectShortsTriangleCrossings(cloth,cloth.body,barePelvis);
 cloth.body.refitExact?.();const initial=inspect(),initialTriangles=inspectTriangles(),initialMaterial=principalAudit(cloth),trace=[],blocked=new Map();let final=initial,finalTriangles=initialTriangles;
 if(!initial.coveragePassed||initialTriangles.crossingCount!==0)for(let placement=1;placement<=MAXIMUM_PLACEMENTS;placement++){
  let moved=0,movedCrossingFaces=0,maximumDisplacementM=0;
  for(const [sampleId,s] of samples.entries()){
   const {p,h}=query(s);if(h.signAmbiguous){blocked.set(sampleId,{sampleId,reason:'ambiguous actual visible-skin feature'});continue;}const depth=CLEARANCE_M-h.signedDistance;if(!(depth>0))continue;
   // Exact local signed-distance direction; remove Y only for actual waist or
   // hem DOFs. This temporary tangent projection does not retain any locks.
   const normal=h.distance>1e-12?p.clone().sub(h.point).multiplyScalar((h.signedDistance<0?-1:1)/h.distance):h.normal.clone();
   const combined=new Map();s.ids.forEach((id,j)=>combined.set(id,(combined.get(id)??0)+s.weights[j]));let denominator=0;const directions=[];
   for(const [id,weight] of combined){const direction=[normal.x,protectedY.has(id)?0:normal.y,normal.z];denominator+=cloth.invMass[id]*weight*weight*dot(direction,direction);directions.push({id,weight,direction});}
   if(!(denominator>1e-16)){blocked.set(sampleId,{sampleId,reason:'actual boundary Y guard removes the entire contact direction',actualDofs:s.ids.slice(),signedDistanceM:h.signedDistance,normal:normal.toArray()});continue;}
   const roundoffBufferM=64*Number.EPSILON*Math.max(1,p.length()),deltas=directions.map(({id,weight,direction})=>({id,delta:direction.map(x=>cloth.invMass[id]*weight*(depth+roundoffBufferM)*x/denominator)})),largest=Math.max(...deltas.map(x=>Math.hypot(...x.delta))),scale=Math.min(1,MAXIMUM_CONTACT_MOVE_M/largest);
   // A bounded geometric trust region prevents nearly vertical boundary
   // normals from producing unbounded sideways moves under the Y guard.
   for(const {id,delta} of deltas){for(let k=0;k<3;k++)cloth.positions[id][k]+=delta[k]*scale;if(protectedY.has(id))cloth.positions[id][1]=protectedY.get(id);maximumDisplacementM=Math.max(maximumDisplacementM,Math.hypot(...delta)*scale);}moved++;
  }
  // Interior edge/face intersections can escape all point samples. Only an
  // actual oriented triangle of the certified closed authored skin supplies
  // an outward separation plane; native open surfaces supply no such oracle.
  const afterSampleTriangles=inspectTriangles();
  for(const hit of afterSampleTriangles.exactcrossings){
   if(hit.surface!=='bare'||hit.part!=='authored-bare-pelvis'){blocked.set('native-crossing:'+hit.clothTriangle+':'+hit.bodyTriangle,{reason:'HOLD: crossing native open surface has no certified outward separation direction',clothTriangle:hit.clothTriangle,bodyTriangle:hit.bodyTriangle,part:hit.part});continue;}
   const bodyPoints=hit.bodyWorldXYZ.map(p=>new THREE.Vector3(...p)),normal=bodyPoints[1].clone().sub(bodyPoints[0]).cross(bodyPoints[2].clone().sub(bodyPoints[0])),area2=normal.length();
   if(!(area2>1e-20)){blocked.set('bare-plane:'+hit.bodyTriangle,{reason:'HOLD: zero-area actual bare crossing triangle',bodyTriangle:hit.bodyTriangle});continue;}normal.divideScalar(area2);
   const actual=cloth.triangles[hit.clothTriangle];if(!actual||JSON.stringify(actual.q)!==JSON.stringify(hit.clothDOFs))throw Error('Actual crossing witness no longer matches source quotient triangle');
   const ids=[...new Set(actual.q)],beforeMinimum=Math.min(...ids.map(id=>new THREE.Vector3(...cloth.positions[id]).sub(bodyPoints[0]).dot(normal)));let faceMoved=false;
   if(beforeMinimum>=CLEARANCE_M)continue;
   for(const id of ids){
    const position=new THREE.Vector3(...cloth.positions[id]),projection=position.clone().sub(bodyPoints[0]).dot(normal),depth=CLEARANCE_M-projection;if(!(depth>0))continue;
    const direction=normal.clone();if(protectedY.has(id))direction.y=0;const denominator=direction.dot(normal);
    if(!(denominator>1e-16)){blocked.set('crossing-height:'+hit.clothTriangle+':'+id,{reason:'HOLD: measured Y guard removes actual outward crossing plane direction',clothTriangle:hit.clothTriangle,bodyTriangle:hit.bodyTriangle,actualDof:id,normal:normal.toArray(),planeProjectionM:projection});continue;}
    const buffer=64*Number.EPSILON*Math.max(1,position.length()),delta=direction.multiplyScalar((depth+buffer)/denominator),length=delta.length();delta.multiplyScalar(Math.min(1,MAXIMUM_CONTACT_MOVE_M/length));
    for(let k=0;k<3;k++)cloth.positions[id][k]+=delta.getComponent(k);if(protectedY.has(id))cloth.positions[id][1]=protectedY.get(id);maximumDisplacementM=Math.max(maximumDisplacementM,delta.length());faceMoved=true;
   }
   if(faceMoved)movedCrossingFaces++;
  }
  final=inspect();finalTriangles=inspectTriangles();trace.push({placement,movedSamples:moved,movedCrossingFaces,maximumDisplacementM,minimumSignedDistanceM:final.minimumSignedDistanceM,remainingBelowSixMillimetres:final.remainingBelowSixMillimetres,insideSamples:final.insideSamples,ambiguousSamples:final.ambiguousSamples,crossingCountBeforePlaneRepair:afterSampleTriangles.crossingCount,crossingCount:finalTriangles.crossingCount,triangleZeroAreas:finalTriangles.counts.skippedZeroAreas,principalStrain:principalAudit(cloth).maximumPrincipalStrain});if(final.coveragePassed&&finalTriangles.crossingCount===0||!moved&&!movedCrossingFaces)break;
 }
 let maximumProtectedYErrorM=0,maximumPositionChangeM=0;for(const [id,y] of protectedY)maximumProtectedYErrorM=Math.max(maximumProtectedYErrorM,Math.abs(cloth.positions[id][1]-y));for(let i=0;i<cloth.positions.length;i++)maximumPositionChangeM=Math.max(maximumPositionChangeM,Math.hypot(...cloth.positions[i].map((x,k)=>x-original[i][k])));
 if(materialIdentity!==cloth.materialIdentity()||stateIdentity!==frozenState(cloth)||maximumProtectedYErrorM!==0)throw Error('Coverage changed source material, native history/state or protected measured boundary Y');
 if(!cloth.positions.every(p=>p.every(Number.isFinite)))throw Error('Coverage generated nonfinite placement');cloth.syncRender();
 const staticCrossingsPassed=finalTriangles.crossingCount===0,zeroAreas=finalTriangles.counts.skippedZeroAreas,staticZeroAreaEvidencePassed=Object.values(zeroAreas).every(n=>n===0),sampledCoveragePassed=final.coveragePassed&&staticCrossingsPassed;
 const finalMaterial=principalAudit(cloth),receipt={version:'r008-measured-geometric-coverage-placement@4',scope:'bounded temporary geometry initialization at measured waist/casing/hem heights; actual visible-skin point samples plus whole-triangle crossings and closed-bare outward-plane separation; no cloth integration',signedDistanceAuthority,contactSchema:contactSnapshot.schema,fullSolidUnionCertified:false,status:!sampledCoveragePassed?'HOLD_GEOMETRIC_COVERAGE':!staticZeroAreaEvidencePassed?'HOLD_STATIC_ZERO_AREA_EVIDENCE_SCOPE':'COVERAGE_SAMPLES_AND_STATIC_CROSSINGS_PASSED',sampledCoveragePassed,pointSamplesPassed:final.coveragePassed,staticCrossingsPassed,staticZeroAreaEvidencePassed,zeroAreaEvidence:{status:staticZeroAreaEvidencePassed?'NO_ZERO_AREAS_OBSERVED':'HOLD',counts:zeroAreas,scope:'zero-area source triangles skipped by the static intersection predicate; retained as separate unresolved evidence, never labelled crossings'},clearanceM:CLEARANCE_M,maximumPlacements:MAXIMUM_PLACEMENTS,maximumPerContactMoveM:MAXIMUM_CONTACT_MOVE_M,placements:trace.length,counts:{vertices:cloth.positions.length,uniqueEdgeMidpoints:edges.size,triangleCentroids:cloth.triangles.length,totalSamples:samples.length,sourceSeams:cloth.activeSeams.length},measuredHeightPlacement:{source:'fresh draft receipt; original seed heights are not target authority',localHeights,worldHeights:targetHeights,actorWorldTranslation:actorPosition.toArray(),actorWorldQuaternion:actorRotation.toArray(),subjectScaleAlreadyInMeasurements:true,uprightActorRequired:true},maximumInitialBoundaryShiftM,originalMaterial,initial,final,initialTriangles,finalTriangles,trace,blockedDirections:[...blocked.values()],protectedY:[...protectedY].map(([id,y])=>({actualDof:id,y,sourceRoles:[...protectedRoles.get(id)]})),maximumProtectedYErrorM,maximumPositionChangeM,initialMaterial,finalMaterial,sourceUVRestMassUnchanged:true,nativeTimeStepsPreviousVelocityHistoryUnchanged:true,allMaterialDofsRemainFree:true,physicalLocksAdded:0,materialFivePercentGatePassed:finalMaterial.originalFivePercentGatePassed,physicalWearingPassed:false,nativeMotionValidated:false,wholeSurfaceCoverageCertified:false,productionReady:false};
 receipt.staticSurfaceCrossingFree=staticCrossingsPassed;
 return receipt;
}
