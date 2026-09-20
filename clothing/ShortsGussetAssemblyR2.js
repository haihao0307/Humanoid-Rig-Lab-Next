/* R2.5 staged authoring state: install the original independent gusset only
 * after the actual R2.4 centre-rise checkpoint has relaxed and passed. The
 * eight original gusset boundary vertices use the four directed source seams;
 * the ninth original centre vertex is fitted by a bounded minimax search over
 * the full original triangle principal-stretch metric. No source UV, triangle, mass, body,
 * Human rig, waistband or left dressing opening is changed. */
const SHORTS_GUSSET_R25_VERSION='shorts-r2.5-gusset-authoring-2';

function createShortsGussetStateR25(pattern,body,human,options={}){
  const fail=message=>{throw Error('shorts-r2.5-gusset: '+message);};
  if(!pattern||!body||!human)fail('pattern, measured body and final Human rig are required');
  const riseState=createShortsRiseStateR24(pattern,body,human,options.riseOptions||{});
  if(riseState.report.sourceUnchanged!==true)fail('R2.4 source contract must pass first');
  const pieces=new Map(pattern.pieces.map(piece=>[piece.id,piece])),gusset=pieces.get('G');
  if(!gusset||gusset.materialCoordinates?.length!==9||gusset.triangles?.length!==8)fail('the original nine-vertex gusset is required');
  const gussetSeamIds=['gusset-FL','gusset-FR','gusset-BL','gusset-BR'];
  for(const id of gussetSeamIds){const seam=pattern.seams.find(item=>item.id===id);if(!seam?.pairs?.length||seam.b?.pieceId!=='G')fail('missing directed source seam '+id);}
  const sourceIdentity=JSON.stringify(pattern.pieces.map(piece=>({id:piece.id,uv:piece.materialCoordinates,triangles:piece.triangles,boundaries:piece.boundaries})));
  const report={version:SHORTS_GUSSET_R25_VERSION,stage:'R2.5 independent gusset installation after accepted R2.4 relaxation',sourceUnchanged:true,sourceIdentity,
    panelIds:['FL','FR','BR','BL','G'],priorClosedSeamIds:[...riseState.report.closedSeamIds],gussetSeamIds,
    closedSeamIds:[...riseState.report.closedSeamIds,...gussetSeamIds],pendingSeamGroups:['side-opening-left','waist-four-edges','waistband-ring'],
    bodyFrame:riseState.report.bodyFrame,riseInputVersion:riseState.report.version,waistbandsUntouched:true,sideOpeningUntouched:true,
    requiresAcceptedRiseCheckpoint:true,persistentShapeTarget:false,legSkinning:false,visualAcceptance:false,assemblyValidated:false,motionValidated:false,productionReady:false};
  return {riseState,report};
}

function completeShortsGussetR25(simulation,state,riseReport,options={}){
  const fail=message=>{throw Error('shorts-r2.5-gusset: '+message);};
  if(!simulation?.ranges||!state?.report||!state?.riseState)fail('R2.5 state and simulation are required');
  const requireAcceptedRise=options.requireAcceptedRise!==false;
  if(requireAcceptedRise&&riseReport?.valid!==true)fail('an accepted actual R2.4 checkpoint is required before installing the gusset');
  const activePieces=new Set(state.report.panelIds),gussetPiece=simulation.pattern.pieces.find(piece=>piece.id==='G'),gussetRange=simulation.ranges.get('G');
  if(!gussetPiece||!gussetRange||gussetRange.count!==9)fail('original gusset particle range is missing');
  const sourceBefore=JSON.stringify(simulation.particles.map(p=>({uv:p.uv,mass:p.mass,pieceId:p.pieceId}))),massBefore=simulation.particles.reduce((sum,p)=>sum+p.mass,0);
  const boundaryTargets=new Map(),contributors=new Map();
  for(const id of state.report.gussetSeamIds){
    const seam=simulation.seams.find(item=>item.id===id);if(!seam)fail('missing source seam '+id);
    for(const pair of seam.pairs){const local=pair.b-gussetRange.offset;if(!Number.isInteger(local)||local<0||local>=8)fail(id+' must target one original gusset boundary vertex');
      const point=simulation.particles[pair.a].pos;if(!sr25Finite3(point))fail(id+' has a nonfinite accepted rise endpoint');
      if(!boundaryTargets.has(local)){boundaryTargets.set(local,[0,0,0]);contributors.set(local,[]);}const sum=boundaryTargets.get(local);for(let k=0;k<3;k++)sum[k]+=point[k];contributors.get(local).push({seamId:id,index:pair.a,pieceId:simulation.particles[pair.a].pieceId,point:[...point]});}
  }
  if(boundaryTargets.size!==8)fail('all eight original gusset boundary vertices need accepted rise targets');
  const junctionToleranceM=options.junctionToleranceM??simulation.options.stitchJoinToleranceM;
  if(!Number.isFinite(junctionToleranceM)||junctionToleranceM<0||junctionToleranceM>simulation.options.stitchJoinToleranceM)fail('invalid gusset junction tolerance');
  const gussetPositions=Array.from({length:9},()=>[0,0,0]),junctionReports=[];
  for(let local=0;local<8;local++){
    const list=contributors.get(local);if(!list?.length)fail('missing accepted rise target for gusset vertex '+local);
    const average=boundaryTargets.get(local).map(value=>value/list.length),maximumContributorGapM=Math.max(0,...list.map(item=>sr25Distance(item.point,average)));
    if(maximumContributorGapM>junctionToleranceM)fail('accepted rise junction disagrees at gusset vertex '+local+': '+maximumContributorGapM);
    gussetPositions[local]=average;junctionReports.push({gussetIndex:local,contributorCount:list.length,maximumContributorGapM,contributors:list.map(({point,...item})=>item)});
  }
  const frame=state.report.bodyFrame;if(!frame||![frame.origin,frame.right,frame.up,frame.forward].every(sr25Finite3))fail('R2.4 body frame is unavailable');
  const boundaryCentroid=[0,1,2].map(k=>gussetPositions.slice(0,8).reduce((sum,point)=>sum+point[k],0)/8),sagM=options.gussetSagM??.004;
  if(!Number.isFinite(sagM)||sagM<0||sagM>.02)fail('invalid gusset centre sag');
  const anchor=boundaryCentroid.map((value,k)=>value-frame.up[k]*sagM);
  const centreFit=sr25FitCentrePrincipalMinimax(anchor,gussetPiece,gussetPositions.slice(0,8),{iterations:options.centreFitIterations??320,initialStepM:options.centreFitStepM});
  gussetPositions[8]=centreFit.point;
  const geometryAtPlacement=sr25GussetGeometry(gussetPiece,gussetPositions,frame),placementRadialLimit=options.placementRadialLimit??.08,placementMaterialLimit=options.placementMaterialLimit??.05;
  if(!Number.isFinite(placementMaterialLimit)||placementMaterialLimit<=0||placementMaterialLimit>.05)fail('invalid gusset placement material limit');
  if(!geometryAtPlacement.landmarkOrderValid||!geometryAtPlacement.boundarySelfIntersectionFree||geometryAtPlacement.minimumTriangleAreaM2<=1e-8||geometryAtPlacement.maximumBoundaryEdgeStrain>.05||geometryAtPlacement.maximumRadialStrain>placementRadialLimit||centreFit.maximumPrincipalStrain>placementMaterialLimit)
    fail('accepted R2.4 opening cannot receive the source gusset without an invalid fold or excessive material error');

  // R2.4 is an accepted quasi-static checkpoint. Reset only stage-transition
  // velocities and swept origins, then add the new physical source piece.
  for(const p of simulation.particles){if(activePieces.has(p.pieceId)){p.previous=[...p.pos];p.velocity=[0,0,0];p.invMass=p.freeInvMass;}else{p.invMass=0;p.velocity=[0,0,0];}}
  for(let local=0;local<gussetRange.count;local++){const p=simulation.particles[gussetRange.offset+local];p.pos=[...gussetPositions[local]];p.previous=[...p.pos];p.velocity=[0,0,0];p.invMass=p.freeInvMass;}

  // Rebuild only the spatial equality graph at this accepted stage boundary.
  // Original particles, masses, UVs and material constraints stay untouched.
  simulation.dofs=createShortsStitchDofs(simulation.particles,{joinTolerance:simulation.options.stitchJoinToleranceM});
  const closed=[];
  for(const seam of simulation.seams){const selected=state.report.closedSeamIds.includes(seam.id);if(!selected){seam.start=Infinity;seam.progress=0;seam.needleIndex=0;seam.needleStart=null;for(const pair of seam.pairs){pair.started=false;pair.initialGap=null;pair.lambda=0;}continue;}
    let maximumGapM=0;for(const pair of seam.pairs){const a=simulation.particles[pair.a],b=simulation.particles[pair.b],gap=sr25Distance(a.pos,b.pos);maximumGapM=Math.max(maximumGapM,gap);if(gap>simulation.options.stitchJoinToleranceM)fail(seam.id+' checkpoint endpoints are not coincident: '+gap);pair.started=true;pair.initialGap=gap;pair.lambda=0;a.previous=[...a.pos];b.previous=[...b.pos];if(!simulation.dofs.same(pair.a,pair.b)&&!simulation.dofs.join(pair.a,pair.b,{started:true,closureProgress:1,requirePreviousClosure:true}))fail(seam.id+' source stitch could not join at the accepted checkpoint');}
    seam.progress=1;seam.start=0;seam.needleIndex=seam.pairs.length;seam.needleStart=null;closed.push({id:seam.id,pairCount:seam.pairs.length,maximumGapM});
  }
  const activeTriangleRecords=simulation.triangleRecords.filter(record=>activePieces.has(record.pieceId)),activeEdges=simulation.edges.filter(edge=>activePieces.has(simulation.particles[edge.a].pieceId)&&activePieces.has(simulation.particles[edge.b].pieceId)),activeParticleIndices=[];
  for(let i=0;i<simulation.particles.length;i++)if(activePieces.has(simulation.particles[i].pieceId))activeParticleIndices.push(i);
  if(!activeTriangleRecords.length||!activeEdges.length||!activeParticleIndices.length)fail('active gusset contact domain is missing');
  simulation.contactTriangleRecords=activeTriangleRecords;simulation.contactEdges=activeEdges;simulation.contactParticleIndices=activeParticleIndices;
  simulation.continuousContact=simulation.options.selfContact?createShortsContinuousContact(simulation.particles,activeTriangleRecords,activeEdges,{thickness:simulation.options.thickness,maxCandidates:simulation.options.maxSelfCandidates,dofs:simulation.dofs,motionLimit:true}):null;
  simulation.surfaceContact=simulation.body?new ShortsSurfaceContact(simulation.particles,activeTriangleRecords,simulation.body,{clearanceM:simulation.options.thickness,toleranceM:.001,dofs:simulation.dofs,includeOnlyIncidentVertices:true}):null;
  simulation.triangleBodyContact=simulation.options.triangleBodyContact?new ShortsTriangleBodyContact(simulation.particles,activeTriangleRecords,simulation.body,{clearanceM:simulation.options.thickness,toleranceM:.001,dofs:simulation.dofs,maxCandidates:simulation.options.triangleBodyMaxCandidates,maxWitnessQueries:simulation.options.triangleBodyMaxWitnessQueries}):null;
  for(const support of simulation.temporarySupports){const pieceId=simulation.particles[support.index].pieceId;support.start=[...simulation.particles[support.index].pos];support.targetHeight=support.start[1];support.lambda=[0,0,0];if(!activePieces.has(pieceId)||pieceId==='G'){support.active=false;if(pieceId==='G')support.releasedForNeedle=true;}}
  const materialAtTransition=scMetricReport(simulation.metrics,simulation.particles);simulation.peakPrincipalStrain=materialAtTransition.maxAbsPrincipalStrain;simulation.peakEdgeStrain=Math.max(...simulation.edges.map(edge=>Math.abs(sr25Distance(simulation.particles[edge.a].pos,simulation.particles[edge.b].pos)/edge.rest-1)));
  simulation.continuousHistory={detectedCrossingCount:0,uncertainCount:0,budgetExceeded:false};simulation.iterationStats={substepCount:0,totalIterations:0,maximumUsed:0,hitMaximumCount:0,unconvergedAtMaximumCount:0,lastIterations:0,lastPrincipalStrain:materialAtTransition.maxAbsPrincipalStrain};simulation._sync();
  const base={...state.report,sourceBefore,massBefore,closedSeams:closed,junctionReports,centreFit,geometryAtPlacement,placementRadialLimit,placementMaterialLimit,stageTransitionInputRiseValid:riseReport?.valid===true,
    stageTransitionReset:'accepted_quasi_static_checkpoint_velocity_and_swept_origin_only',authoringLockedParticleCount:simulation.particles.filter(p=>!activePieces.has(p.pieceId)).length,authoringLocksRemovable:true,
    bodyContactPieces:[...activePieces],inactiveBodyContactPieces:['WFL','WFR','WBR','WBL'],bodyContactTriangleCount:activeTriangleRecords.length,
    clothContactPieces:[...activePieces],clothContactTriangleCount:activeTriangleRecords.length,clothContactEdgeCount:activeEdges.length,clothContactParticleCount:activeParticleIndices.length};
  const report=auditShortsGussetR25(simulation,state,base);
  simulation.events.push({type:'r2.5_independent_gusset_checkpoint',stepIndex:simulation.stepIndex,closedSeams:closed.map(item=>item.id),gussetAreaM2:report.gussetGeometry.surfaceAreaM2,valid:report.valid});
  return report;
}

function auditShortsGussetR25(simulation,state,baseReport={...state.report},options={}){
  const frame=state.report.bodyFrame;if(!frame)throw Error('shorts-r2.5-gusset: body frame is unavailable');
  const simulationReport=simulation.report(),material=simulationReport.material,sourceAfter=JSON.stringify(simulation.particles.map(p=>({uv:p.uv,mass:p.mass,pieceId:p.pieceId}))),massAfter=simulation.particles.reduce((sum,p)=>sum+p.mass,0),dof=simulation.dofs.report();
  const closed=(baseReport.closedSeams||state.report.closedSeamIds.map(id=>{const seam=simulation.seams.find(item=>item.id===id);return {id,pairCount:seam.pairs.length,maximumGapM:Math.max(0,...seam.pairs.map(pair=>sr25Distance(simulation.particles[pair.a].pos,simulation.particles[pair.b].pos)))};}));
  const sourceIdentityPreserved=baseReport.sourceBefore?baseReport.sourceBefore===sourceAfter:true,totalMassPreserved=baseReport.massBefore===undefined||Math.abs(baseReport.massBefore-massAfter)<1e-12,seamPairCount=closed.reduce((sum,item)=>sum+item.pairCount,0);
  const seamsClosed=closed.every(item=>item.maximumGapM<=simulation.options.stitchJoinToleranceM)&&state.report.closedSeamIds.every(id=>simulation.seams.find(item=>item.id===id)?.pairs.every(pair=>simulation.dofs.same(pair.a,pair.b)));
  const centerFront=sr24SeamReport(simulation,frame,'center-front'),centerBack=sr24SeamReport(simulation,frame,'center-back'),cuffs={left:sd23CuffReport(simulation,frame,'FL','BL'),right:sd23CuffReport(simulation,frame,'FR','BR')};
  const cuffsValid=[cuffs.left,cuffs.right].every(cuff=>cuff.projectedAreaM2>1e-4&&cuff.closureGapM<=simulation.options.stitchJoinToleranceM&&cuff.positiveArea);
  const gussetSeams=state.report.gussetSeamIds.map(id=>sr25SimulationSeamReport(simulation,id)),gussetSeamsClosed=gussetSeams.every(item=>item.maximumGapM<=simulation.options.stitchJoinToleranceM&&item.allPairsJoined);
  const gussetGeometry=sr25GussetGeometryFromSimulation(simulation,frame),gussetGeometryValid=gussetGeometry.landmarkOrderValid&&gussetGeometry.boundarySelfIntersectionFree&&gussetGeometry.minimumTriangleAreaM2>1e-8&&gussetGeometry.maximumBoundaryEdgeStrain<=.05&&gussetGeometry.maximumRadialStrain<=.08;
  const junctions=sr25JunctionReports(simulation),junctionsValid=junctions.every(item=>item.allMembersJoined&&item.memberCount===3&&item.extraWeld===false);
  const expectedDofs=sr25ExpectedClosedDofs(simulation,state.report.closedSeamIds),expectedJoinCount=sr25ExpectedJoinCount(simulation,state.report.closedSeamIds),strict=sr25UnexpectedIntersections(simulation),strictUnexpectedIntersectionFree=strict.detected===0;
  const futureStarted=simulation.seams.filter(seam=>!state.report.closedSeamIds.includes(seam.id)&&seam.pairs.some(pair=>pair.started)),materialLimit=options.materialLimit??.05,materialWithinCheckpoint=material.valid&&material.maxAbsPrincipalStrain<=materialLimit;
  const bodyContactValidated=!!simulation.body&&simulationReport.surfaceContact?.passed===true&&simulationReport.triangleBodyContact?.passed===true&&simulationReport.bodyPenetrationM<=.001;
  const swept=simulationReport.selfContact?.swept,selfContactValidated=simulationReport.selfContact?.enabled===true&&!simulationReport.selfContact.budgetExceeded&&simulationReport.selfContact.unresolvedCount===0&&(!swept||(!swept.budgetExceeded&&swept.uncertainCount===0&&swept.unresolvedCount===0));
  const bodyRequirementMet=options.requireBody?bodyContactValidated:true,selfContactRequirementMet=options.requireSelfContact?selfContactValidated:true,centerRisesRemainClosed=centerFront.maximumGapM<=simulation.options.stitchJoinToleranceM&&centerBack.maximumGapM<=simulation.options.stitchJoinToleranceM;
  const topologyGate=state.report.sourceUnchanged&&sourceIdentityPreserved&&totalMassPreserved&&seamsClosed&&centerRisesRemainClosed&&gussetSeamsClosed&&gussetGeometryValid&&junctionsValid&&cuffsValid&&expectedDofs.valid&&strictUnexpectedIntersectionFree&&futureStarted.length===0&&dof.joinedStitchCount===expectedJoinCount;
  const valid=topologyGate&&materialWithinCheckpoint&&bodyRequirementMet&&selfContactRequirementMet;
  return {...baseReport,bodyFrame:frame,stitchJoinToleranceM:simulation.options.stitchJoinToleranceM,valid,topologyGate,sourceIdentityPreserved,totalMassPreserved,closedSeams:closed,
    centerFront,centerBack,centerRisesRemainClosed,cuffs,cuffsValid,gussetSeams,gussetSeamsClosed,gussetGeometry,gussetGeometryValid,gussetOrientationValid:gussetGeometryValid,junctions,junctionsValid,
    expectedClosedDofs:expectedDofs.valid,expectedDofs,strictUnexpectedIntersectionFree,strictUnexpectedIntersections:strict,futureSeamsStarted:futureStarted.map(seam=>seam.id),declaredClosedStitchPairCount:seamPairCount,expectedJoinedStitchCount:expectedJoinCount,joinedStitchCount:dof.joinedStitchCount,
    materialAtCheckpoint:material,materialCheckpointLimit:materialLimit,materialSafetyMargin:materialLimit-material.maxAbsPrincipalStrain,materialWithinCheckpoint,
    bodyContactValidated,bodyRequirementMet,selfContactValidated,selfContactRequirementMet,relaxationSteps:simulation.stepIndex,
    gussetConnected:gussetSeamsClosed&&junctionsValid&&gussetGeometryValid,waistbandConnected:false,sideOpeningClosed:false,visualAcceptance:false,assemblyValidated:false,motionValidated:false,productionReady:false};
}

function sr25FitCentrePrincipalMinimax(anchor,piece,boundary,options={}){
  const iterations=options.iterations??320,uv=piece?.materialCoordinates,triangles=piece?.triangles,meanRest=uv?.slice(0,8).reduce((sum,p)=>sum+Math.hypot(p[0],p[1]),0)/8,step=options.initialStepM??Math.max(.004,meanRest*.45);
  if(!sr25Finite3(anchor)||!Array.isArray(boundary)||boundary.length!==8||boundary.some(point=>!sr25Finite3(point))||!Array.isArray(uv)||uv.length!==9||!Array.isArray(triangles)||triangles.length!==8||!Number.isInteger(iterations)||iterations<16||iterations>1200||!(step>0))throw Error('shorts-r2.5-gusset: invalid principal centre-fit inputs');
  const evaluateTriangle=(point,triangle)=>{
    const positions=[...boundary,point],[i0,i1,i2]=triangle,a=uv[i0],b=uv[i1],c=uv[i2],x=b[0]-a[0],y=b[1]-a[1],u=c[0]-a[0],v=c[1]-a[1],det=x*v-y*u;
    if(!Number.isFinite(det)||Math.abs(det)<1e-16)throw Error('shorts-r2.5-gusset: degenerate source triangle in centre fit');
    const gu=[(y-v)/det,v/det,-y/det],gv=[(u-x)/det,-u/det,x/det],origin=positions[i0],fu=[0,0,0],fv=[0,0,0];
    for(let j=1;j<3;j++){const index=j===1?i1:i2,p=positions[index],dx=p[0]-origin[0],dy=p[1]-origin[1],dz=p[2]-origin[2],gU=gu[j],gV=gv[j];fu[0]+=gU*dx;fu[1]+=gU*dy;fu[2]+=gU*dz;fv[0]+=gV*dx;fv[1]+=gV*dy;fv[2]+=gV*dz;}
    const aa=sr25Dot(fu,fu),bb=sr25Dot(fu,fv),dd=sr25Dot(fv,fv),disc=Math.hypot(aa-dd,2*bb),maxEigen=(aa+dd+disc)/2,cross=sr25Cross(fu,fv),areaSquared=sr25Dot(cross,cross),maximum=Math.sqrt(Math.max(0,maxEigen)),minimum=maximum>0?Math.sqrt(Math.max(0,areaSquared/maxEigen)):0,strain=Math.max(Math.abs(minimum-1),Math.abs(maximum-1));
    return {minimumStretch:minimum,maximumStretch:maximum,maxAbsPrincipalStrain:strain,areaRatio:Math.sqrt(Math.max(0,areaSquared))};
  };
  const objective=point=>{const triangleMetrics=triangles.map(triangle=>evaluateTriangle(point,triangle)),maximum=Math.max(...triangleMetrics.map(metric=>metric.maxAbsPrincipalStrain)),radialStrains=boundary.map((target,i)=>Math.abs(sr25Distance(point,target)/Math.hypot(uv[i][0],uv[i][1])-1)),maximumRadialStrain=Math.max(...radialStrains),anchorPenalty=1e-6*(sr25Distance(point,anchor)/meanRest)**2,radialTieBreak=1e-8*maximumRadialStrain;return {value:maximum+anchorPenalty+radialTieBreak,maximum,maximumRadialStrain,radialStrains,triangleMetrics};};
  let simplex=[[...anchor],[anchor[0]+step,anchor[1],anchor[2]],[anchor[0],anchor[1]+step,anchor[2]],[anchor[0],anchor[1],anchor[2]+step]].map(point=>({point,score:objective(point)}));
  for(let iteration=0;iteration<iterations;iteration++){
    simplex.sort((a,b)=>a.score.value-b.score.value);const best=simplex[0],second=simplex[1],third=simplex[2],worst=simplex[3],centroid=[0,1,2].map(k=>(best.point[k]+second.point[k]+third.point[k])/3),reflected=centroid.map((value,k)=>value+(value-worst.point[k])),r={point:reflected,score:objective(reflected)};
    if(r.score.value<best.score.value){const expanded=centroid.map((value,k)=>value+2*(r.point[k]-value)),e={point:expanded,score:objective(expanded)};simplex[3]=e.score.value<r.score.value?e:r;}
    else if(r.score.value<third.score.value)simplex[3]=r;
    else{const outside=r.score.value<worst.score.value,contracted=outside?centroid.map((value,k)=>value+.5*(r.point[k]-value)):centroid.map((value,k)=>value+.5*(worst.point[k]-value)),c={point:contracted,score:objective(contracted)};
      if(c.score.value<(outside?r.score.value:worst.score.value))simplex[3]=c;else for(let i=1;i<4;i++){simplex[i].point=best.point.map((value,k)=>value+.5*(simplex[i].point[k]-value));simplex[i].score=objective(simplex[i].point);}}
    simplex.sort((a,b)=>a.score.value-b.score.value);const diameter=Math.max(...simplex.slice(1).map(item=>sr25Distance(item.point,simplex[0].point)));if(diameter<1e-10)break;
  }
  simplex.sort((a,b)=>a.score.value-b.score.value);const result=simplex[0];return {method:'deterministic_nelder_mead_minimax_original_triangle_principal_strain',point:[...result.point],maximumPrincipalStrain:result.score.maximum,maximumRadialStrain:result.score.maximumRadialStrain,radialStrains:[...result.score.radialStrains],triangleMetrics:result.score.triangleMetrics.map(metric=>({...metric})),anchor:[...anchor],iterations};
}
function sr25Finite3(value){return Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);}
function sr25Distance(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);}
function sr25Sub(a,b){return a.map((value,k)=>value-b[k]);}
function sr25Dot(a,b){return a.reduce((sum,value,k)=>sum+value*b[k],0);}
function sr25Cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function sr25SimulationSeamReport(simulation,id){const seam=simulation.seams.find(item=>item.id===id);if(!seam)throw Error('shorts-r2.5-gusset: missing simulation seam '+id);return {id,pairCount:seam.pairs.length,maximumGapM:Math.max(0,...seam.pairs.map(pair=>sr25Distance(simulation.particles[pair.a].pos,simulation.particles[pair.b].pos))),allPairsJoined:seam.pairs.every(pair=>simulation.dofs.same(pair.a,pair.b))};}
function sr25GussetGeometryFromSimulation(simulation,frame){const piece=simulation.pattern.pieces.find(item=>item.id==='G'),range=simulation.ranges.get('G'),positions=simulation.particles.slice(range.offset,range.offset+range.count).map(p=>p.pos);return sr25GussetGeometry(piece,positions,frame);}
function sr25GussetGeometry(piece,positions,frame){
  if(!piece||!positions||positions.length!==piece.materialCoordinates.length)throw Error('shorts-r2.5-gusset: invalid gusset geometry input');
  const local=point=>{const d=sr25Sub(point,frame.origin);return [sr25Dot(d,frame.right),sr25Dot(d,frame.up),sr25Dot(d,frame.forward)];},landmarks=Object.fromEntries(Object.entries(piece.landmarks).map(([name,index])=>[name,local(positions[index])]));
  const landmarkOrderValid=landmarks.right[0]-landmarks.left[0]>.001&&landmarks.front[2]-landmarks.back[2]>.02,centre=positions[8];
  let surfaceAreaM2=0,minimumTriangleAreaM2=Infinity,areaVector=[0,0,0],minimumAdjacentNormalDot=1;const normals=[];
  for(const triangle of piece.triangles){const a=positions[triangle[0]],b=positions[triangle[1]],c=positions[triangle[2]],cross=sr25Cross(sr25Sub(b,a),sr25Sub(c,a)),length=Math.hypot(...cross),area=length/2;surfaceAreaM2+=area;minimumTriangleAreaM2=Math.min(minimumTriangleAreaM2,area);for(let k=0;k<3;k++)areaVector[k]+=cross[k];normals.push(length>1e-15?cross.map(value=>value/length):[0,0,0]);}
  for(let i=0;i<normals.length;i++)minimumAdjacentNormalDot=Math.min(minimumAdjacentNormalDot,sr25Dot(normals[i],normals[(i+1)%normals.length]));
  const areaLength=Math.hypot(...areaVector),orientationDotUp=areaLength>0?sr25Dot(areaVector,frame.up)/areaLength:0;
  let maximumRadialStrain=0;for(let i=0;i<8;i++){const rest=Math.hypot(...piece.materialCoordinates[i]);maximumRadialStrain=Math.max(maximumRadialStrain,Math.abs(sr25Distance(centre,positions[i])/rest-1));}
  let maximumBoundaryEdgeStrain=0,minimumNonAdjacentBoundaryDistanceM=Infinity,boundarySelfIntersectionFree=true;
  for(let i=0;i<8;i++){const j=(i+1)%8,rest=sr25Distance([...piece.materialCoordinates[i],0],[...piece.materialCoordinates[j],0]);maximumBoundaryEdgeStrain=Math.max(maximumBoundaryEdgeStrain,Math.abs(sr25Distance(positions[i],positions[j])/rest-1));}
  for(let i=0;i<8;i++)for(let j=i+1;j<8;j++){if(j===i+1||(i===0&&j===7))continue;const closest=sr25ClosestSegments(positions[i],positions[(i+1)%8],positions[j],positions[(j+1)%8]);minimumNonAdjacentBoundaryDistanceM=Math.min(minimumNonAdjacentBoundaryDistanceM,closest.distance);if(closest.distance<1e-7)boundarySelfIntersectionFree=false;}
  return {landmarks,landmarkOrderValid,surfaceAreaM2,minimumTriangleAreaM2:Number.isFinite(minimumTriangleAreaM2)?minimumTriangleAreaM2:0,orientationDotUp,minimumAdjacentNormalDot,
    maximumRadialStrain,maximumBoundaryEdgeStrain,boundarySelfIntersectionFree,minimumNonAdjacentBoundaryDistanceM:Number.isFinite(minimumNonAdjacentBoundaryDistanceM)?minimumNonAdjacentBoundaryDistanceM:null,centreLocal:local(centre)};
}
function sr25ClosestSegments(p,q,a,b){const u=sr25Sub(q,p),v=sr25Sub(b,a),w=sr25Sub(p,a),uu=sr25Dot(u,u),vv=sr25Dot(v,v),uv=sr25Dot(u,v),uw=sr25Dot(u,w),vw=sr25Dot(v,w);let s=0,t=0;if(uu<1e-20&&vv<1e-20){}else if(uu<1e-20)t=Math.max(0,Math.min(1,vw/vv));else if(vv<1e-20)s=Math.max(0,Math.min(1,-uw/uu));else{const denominator=uu*vv-uv*uv;s=denominator>1e-24?Math.max(0,Math.min(1,(uv*vw-uw*vv)/denominator)):0;t=(uv*s+vw)/vv;if(t<0){t=0;s=Math.max(0,Math.min(1,-uw/uu));}else if(t>1){t=1;s=Math.max(0,Math.min(1,(uv-uw)/uu));}}const x=p.map((value,k)=>value+s*u[k]),y=a.map((value,k)=>value+t*v[k]);return {s,t,distance:sr25Distance(x,y)};}
function sr25JunctionReports(simulation){return simulation.pattern.junctions.map(junction=>{const indices=junction.members.map(member=>simulation.ranges.get(member.pieceId).offset+member.index),allMembersJoined=indices.every(index=>simulation.dofs.same(indices[0],index));return {id:junction.id,memberCount:indices.length,memberPieceIds:junction.members.map(member=>member.pieceId),indices,allMembersJoined,extraWeld:junction.extraWeld};});}
function sr25ExpectedJoinCount(simulation,closedSeamIds){const parent=new Map(),find=x=>{if(!parent.has(x))parent.set(x,x);let p=parent.get(x);while(p!==parent.get(p))p=parent.get(p);let n=x;while(parent.get(n)!==p){const next=parent.get(n);parent.set(n,p);n=next;}return p;},join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent.set(b,a);};const vertices=new Set();for(const id of closedSeamIds){const seam=simulation.seams.find(item=>item.id===id);if(!seam)throw Error('shorts-r2.5-gusset: missing expected closed seam '+id);for(const pair of seam.pairs){vertices.add(pair.a);vertices.add(pair.b);join(pair.a,pair.b);}}const components=new Set([...vertices].map(find));return vertices.size-components.size;}
function sr25ExpectedClosedDofs(simulation,closedSeamIds){const parent=new Map(),find=x=>{if(!parent.has(x))parent.set(x,x);let p=parent.get(x);while(p!==parent.get(p))p=parent.get(p);let n=x;while(parent.get(n)!==p){const next=parent.get(n);parent.set(n,p);n=next;}return p;},join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent.set(b,a);};for(const id of closedSeamIds){const seam=simulation.seams.find(item=>item.id===id);if(!seam)throw Error('shorts-r2.5-gusset: missing expected closed seam '+id);for(const pair of seam.pairs)join(pair.a,pair.b);}for(let a=0;a<simulation.particles.length;a++)for(let b=a+1;b<simulation.particles.length;b++)if(simulation.dofs.same(a,b)&&find(a)!==find(b))return {valid:false,unexpectedPair:[a,b],aPieceId:simulation.particles[a].pieceId,bPieceId:simulation.particles[b].pieceId};return {valid:true,unexpectedPair:null};}
function sr25UnexpectedIntersections(simulation){const active=new Set(['FL','FR','BR','BL','G']),triangles=simulation.triangleRecords.filter(t=>active.has(t.pieceId));let checkedCandidatePairs=0,skippedTopologicalPairs=0;for(let i=0;i<triangles.length;i++){const a=triangles[i],ap=a.indices.map(index=>simulation.particles[index].pos),ab=sd23Bounds(ap);for(let j=i+1;j<triangles.length;j++){const b=triangles[j];if(a.indices.some(x=>b.indices.some(y=>x===y||simulation.dofs.same(x,y)))){skippedTopologicalPairs++;continue;}const bp=b.indices.map(index=>simulation.particles[index].pos),bb=sd23Bounds(bp);if(!sd23BoundsOverlap(ab,bb,1e-9))continue;checkedCandidatePairs++;if(sd23TrianglesIntersect(ap,bp,1e-9))return {method:'main-panels-and-gusset-strict-triangle-test-excluding-shared-stitch-dofs',detected:1,checkedCandidatePairs,skippedTopologicalPairs,firstPair:{aPieceId:a.pieceId,bPieceId:b.pieceId,aIndices:[...a.indices],bIndices:[...b.indices]}};}}return {method:'main-panels-and-gusset-strict-triangle-test-excluding-shared-stitch-dofs',detected:0,checkedCandidatePairs,skippedTopologicalPairs,firstPair:null};}
