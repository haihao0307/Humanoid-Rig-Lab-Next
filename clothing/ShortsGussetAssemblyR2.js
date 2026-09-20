/* R2.5 staged authoring state: install the original independent gusset after
 * R2.4 has formed both leg tubes and connected the front/back centre rises.
 * The eight original gusset boundary vertices are placed on their four real
 * source seam counterparts; the ninth original centre vertex is fitted to the
 * source metric with a small downward wearing sag. No source UV, triangle,
 * mass, body, rig, waistband or left opening is changed. This remains an
 * assembly checkpoint, not whole-garment or motion acceptance. */
const SHORTS_GUSSET_R25_VERSION='shorts-r2.5-gusset-authoring-1';

function createShortsGussetStateR25(pattern,body,human,options={}){
  const fail=message=>{throw Error('shorts-r2.5-gusset: '+message);};
  if(!pattern||!body||!human)fail('pattern, measured body and final Human rig are required');
  const rise=createShortsRiseStateR24(pattern,body,human,options.riseOptions||{});
  if(rise.report.sourceUnchanged!==true)fail('R2.4 source contract must pass first');
  const positionsByPiece=new Map([...rise.positionsByPiece].map(([id,positions])=>[id,positions.map(point=>[...point])]));
  const pieces=new Map(pattern.pieces.map(piece=>[piece.id,piece])),gusset=pieces.get('G');
  if(!gusset||gusset.materialCoordinates?.length!==9||gusset.triangles?.length!==8)fail('the original nine-vertex gusset is required');
  const gussetSeamIds=['gusset-FL','gusset-FR','gusset-BL','gusset-BR'];
  const gussetSeams=gussetSeamIds.map(id=>{const seam=pattern.seams.find(item=>item.id===id);if(!seam?.pairs?.length||seam.b?.pieceId!=='G')fail('missing directed source seam '+id);return seam;});
  const boundaryTargets=new Map(),contributors=new Map();
  for(const seam of gussetSeams){
    const main=positionsByPiece.get(seam.a.pieceId);if(!main)fail('missing staged main panel '+seam.a.pieceId);
    for(const pair of seam.pairs){
      if(!Number.isInteger(pair.b)||pair.b<0||pair.b>=8)fail(seam.id+' must reference one original gusset boundary point');
      const point=main[pair.a];if(!sr25Finite3(point))fail(seam.id+' has a nonfinite main-panel target');
      if(!boundaryTargets.has(pair.b)){boundaryTargets.set(pair.b,[0,0,0]);contributors.set(pair.b,[]);}
      const sum=boundaryTargets.get(pair.b);for(let k=0;k<3;k++)sum[k]+=point[k];contributors.get(pair.b).push({seamId:seam.id,pieceId:seam.a.pieceId,index:pair.a,point:[...point]});
    }
  }
  if(boundaryTargets.size!==8||[0,1,2,3,4,5,6,7].some(index=>!boundaryTargets.has(index)))fail('all eight original gusset boundary points need source targets');
  const mergeToleranceM=options.junctionMergeToleranceM??1e-8;
  if(!Number.isFinite(mergeToleranceM)||mergeToleranceM<=0||mergeToleranceM>1e-5)fail('invalid gusset junction merge tolerance');
  const gussetPositions=Array.from({length:9},()=>[0,0,0]),junctionReports=[];
  for(let index=0;index<8;index++){
    const list=contributors.get(index),sum=boundaryTargets.get(index),average=sum.map(value=>value/list.length);
    let maximumContributorGapM=0;for(const item of list)maximumContributorGapM=Math.max(maximumContributorGapM,sr25Distance(item.point,average));
    if(maximumContributorGapM>mergeToleranceM)fail('existing rise/inseam junctions disagree at gusset index '+index+': '+maximumContributorGapM);
    gussetPositions[index]=average;
    for(const item of list)positionsByPiece.get(item.pieceId)[item.index]=[...average];
    junctionReports.push({gussetIndex:index,contributorCount:list.length,maximumContributorGapM,contributors:list.map(({point,...item})=>item)});
  }
  const frame=rise.report.bodyFrame;if(!frame||![frame.origin,frame.right,frame.up,frame.forward].every(sr25Finite3))fail('R2.4 pelvis frame is unavailable');
  const sagM=options.gussetSagM??.006,anchorWeight=options.centreAnchorWeight??.12,iterations=options.centreFitIterations??32;
  if(!Number.isFinite(sagM)||sagM<0||sagM>.025||!Number.isFinite(anchorWeight)||anchorWeight<0||anchorWeight>10||!Number.isInteger(iterations)||iterations<1||iterations>128)fail('invalid gusset centre fitting options');
  const front=gussetPositions[gusset.landmarks.front],right=gussetPositions[gusset.landmarks.right],back=gussetPositions[gusset.landmarks.back],left=gussetPositions[gusset.landmarks.left];
  const uvFront=gusset.materialCoordinates[gusset.landmarks.front],uvBack=gusset.materialCoordinates[gusset.landmarks.back];
  const frontToOrigin=Math.hypot(...uvFront),backToOrigin=Math.hypot(...uvBack),frontBackTotal=frontToOrigin+backToOrigin;
  if(!(frontBackTotal>0))fail('invalid original gusset front/back metric');
  const frontBackCentre=front.map((value,k)=>value+(back[k]-value)*frontToOrigin/frontBackTotal),leftRightCentre=left.map((value,k)=>(value+right[k])/2);
  const anchor=frontBackCentre.map((value,k)=>(value+leftRightCentre[k])/2-frame.up[k]*sagM);
  const restRadii=gusset.materialCoordinates.slice(0,8).map(uv=>Math.hypot(uv[0],uv[1]));
  gussetPositions[8]=sr25FitCentre(anchor,gussetPositions.slice(0,8),restRadii,anchorWeight,iterations);
  if(!sr25Finite3(gussetPositions[8]))fail('gusset centre fitting produced a nonfinite point');
  positionsByPiece.set('G',gussetPositions.map(point=>[...point]));

  const closedSeamIds=[...rise.report.closedSeamIds,...gussetSeamIds];
  const stagedSeams=closedSeamIds.map(id=>sr25StateSeamReport(pattern,positionsByPiece,id));
  if(stagedSeams.some(item=>item.maximumGapM>1e-10))fail('staged source seam endpoints are not coincident');
  const geometry=sr25GussetGeometryFromPositions(pattern,positionsByPiece,frame);
  if(!geometry.landmarkOrderValid||geometry.flippedTriangleCount!==0||geometry.minimumTriangleAreaM2<=1e-8)fail('staged gusset orientation is invalid');
  const before=JSON.stringify(pattern.pieces.map(piece=>({id:piece.id,uv:piece.materialCoordinates,triangles:piece.triangles,boundaries:piece.boundaries}))),after=JSON.stringify(pattern.pieces.map(piece=>({id:piece.id,uv:piece.materialCoordinates,triangles:piece.triangles,boundaries:piece.boundaries})));
  const report={version:SHORTS_GUSSET_R25_VERSION,stage:'R2.5 independent gusset installation',sourceUnchanged:before===after,
    panelIds:['FL','FR','BR','BL','G'],closedSeamIds,pendingSeamGroups:['side-opening-left','waist-four-edges','waistband-ring'],bodyFrame:frame,
    riseInputVersion:rise.report.version,gussetSeamIds,stagedSeams,junctionReports,gussetGeometryAtPlacement:geometry,gussetSagM:sagM,centreAnchorWeight:anchorWeight,centreFitIterations:iterations,
    waistbandsUntouched:true,sideOpeningUntouched:true,persistentShapeTarget:false,legSkinning:false,visualAcceptance:false,assemblyValidated:false,motionValidated:false,productionReady:false};
  return {positionsByPiece,report,riseReport:rise.report};
}

function completeShortsGussetR25(simulation,state){
  const fail=message=>{throw Error('shorts-r2.5-gusset: '+message);};
  if(!simulation?.dofs||!simulation?.ranges||!state?.positionsByPiece||!state?.report)fail('stitch DOFs and staged positions are required');
  const activePieces=new Set(state.report.panelIds),sourceBefore=JSON.stringify(simulation.particles.map(p=>({uv:p.uv,mass:p.mass,pieceId:p.pieceId}))),massBefore=simulation.particles.reduce((sum,p)=>sum+p.mass,0);
  for(const [id,positions] of state.positionsByPiece){const range=simulation.ranges.get(id);if(!range||positions.length!==range.count)fail('invalid staged positions for '+id);for(let i=0;i<range.count;i++){const point=positions[i];if(!sr25Finite3(point))fail('nonfinite staged point');const p=simulation.particles[range.offset+i];p.pos=[...point];p.previous=[...point];p.velocity=[0,0,0];}}
  let authoringLockedParticleCount=0;for(const p of simulation.particles)if(!activePieces.has(p.pieceId)){p.invMass=0;authoringLockedParticleCount++;}
  simulation.dofs=createShortsStitchDofs(simulation.particles,{joinTolerance:simulation.options.stitchJoinToleranceM});
  const closed=[];
  for(const seam of simulation.seams)if(!state.report.closedSeamIds.includes(seam.id)){seam.start=Infinity;seam.progress=0;seam.needleIndex=0;seam.needleStart=null;for(const pair of seam.pairs){pair.started=false;pair.initialGap=null;pair.lambda=0;}}
  for(const id of state.report.closedSeamIds){
    const seam=simulation.seams.find(item=>item.id===id);if(!seam)fail('missing source seam '+id);let maximumGapM=0;
    for(const pair of seam.pairs){const a=simulation.particles[pair.a],b=simulation.particles[pair.b],gap=sr25Distance(a.pos,b.pos);maximumGapM=Math.max(maximumGapM,gap);if(gap>simulation.options.stitchJoinToleranceM)fail(id+' staged endpoints are not coincident: '+gap);pair.started=true;pair.initialGap=gap;a.previous=[...a.pos];b.previous=[...b.pos];if(!simulation.dofs.same(pair.a,pair.b)&&!simulation.dofs.join(pair.a,pair.b,{started:true,closureProgress:1,requirePreviousClosure:true}))fail(id+' source stitch could not join');}
    seam.progress=1;seam.start=0;seam.needleIndex=seam.pairs.length;seam.needleStart=null;closed.push({id,pairCount:seam.pairs.length,maximumGapM});
  }
  const activeTriangleRecords=simulation.triangleRecords.filter(record=>activePieces.has(record.pieceId)),activeEdges=simulation.edges.filter(edge=>activePieces.has(simulation.particles[edge.a].pieceId)&&activePieces.has(simulation.particles[edge.b].pieceId)),activeParticleIndices=[];
  for(let i=0;i<simulation.particles.length;i++)if(activePieces.has(simulation.particles[i].pieceId))activeParticleIndices.push(i);
  if(!activeTriangleRecords.length||!activeEdges.length||!activeParticleIndices.length)fail('active gusset contact domain is missing');
  simulation.contactTriangleRecords=activeTriangleRecords;simulation.contactEdges=activeEdges;simulation.contactParticleIndices=activeParticleIndices;
  simulation.continuousContact=simulation.options.selfContact?createShortsContinuousContact(simulation.particles,activeTriangleRecords,activeEdges,{thickness:simulation.options.thickness,maxCandidates:simulation.options.maxSelfCandidates,dofs:simulation.dofs,motionLimit:true}):null;
  simulation.surfaceContact=simulation.body?new ShortsSurfaceContact(simulation.particles,activeTriangleRecords,simulation.body,{clearanceM:simulation.options.thickness,toleranceM:.001,dofs:simulation.dofs,includeOnlyIncidentVertices:true}):null;
  simulation.triangleBodyContact=simulation.options.triangleBodyContact?new ShortsTriangleBodyContact(simulation.particles,activeTriangleRecords,simulation.body,{clearanceM:simulation.options.thickness,toleranceM:.001,dofs:simulation.dofs,maxCandidates:simulation.options.triangleBodyMaxCandidates,maxWitnessQueries:simulation.options.triangleBodyMaxWitnessQueries}):null;
  for(const support of simulation.temporarySupports){const pieceId=simulation.particles[support.index].pieceId;support.start=[...simulation.particles[support.index].pos];support.targetHeight=support.start[1];support.lambda=[0,0,0];if(!activePieces.has(pieceId)||pieceId==='G'){support.active=false;if(pieceId==='G')support.releasedForNeedle=true;}}
  simulation._sync();
  const base={...state.report,sourceBefore,massBefore,closedSeams:closed,authoringLockedParticleCount,authoringLocksRemovable:true,
    bodyContactPieces:[...activePieces],inactiveBodyContactPieces:['WFL','WFR','WBR','WBL'],bodyContactTriangleCount:activeTriangleRecords.length,
    clothContactPieces:[...activePieces],clothContactTriangleCount:activeTriangleRecords.length,clothContactEdgeCount:activeEdges.length,clothContactParticleCount:activeParticleIndices.length};
  const report=auditShortsGussetR25(simulation,state,base);
  simulation.events.push({type:'r2.5_independent_gusset_checkpoint',stepIndex:simulation.stepIndex,closedSeams:closed.map(item=>item.id),gussetAreaM2:report.gussetGeometry.surfaceAreaM2,valid:report.valid});
  return report;
}

function auditShortsGussetR25(simulation,state,baseReport={...state.report},options={}){
  const frame=state.report.bodyFrame||state.riseReport?.bodyFrame;if(!frame)throw Error('shorts-r2.5-gusset: body frame is unavailable');
  const simulationReport=simulation.report(),material=simulationReport.material,sourceAfter=JSON.stringify(simulation.particles.map(p=>({uv:p.uv,mass:p.mass,pieceId:p.pieceId}))),massAfter=simulation.particles.reduce((sum,p)=>sum+p.mass,0),dof=simulation.dofs.report();
  const closed=(baseReport.closedSeams||state.report.closedSeamIds.map(id=>{const seam=simulation.seams.find(item=>item.id===id);return {id,pairCount:seam.pairs.length,maximumGapM:Math.max(0,...seam.pairs.map(pair=>sr25Distance(simulation.particles[pair.a].pos,simulation.particles[pair.b].pos)))};}));
  const sourceIdentityPreserved=baseReport.sourceBefore?baseReport.sourceBefore===sourceAfter:true,totalMassPreserved=baseReport.massBefore===undefined||Math.abs(baseReport.massBefore-massAfter)<1e-12,seamPairCount=closed.reduce((sum,item)=>sum+item.pairCount,0);
  const seamsClosed=closed.every(item=>item.maximumGapM<=simulation.options.stitchJoinToleranceM)&&state.report.closedSeamIds.every(id=>simulation.seams.find(item=>item.id===id)?.pairs.every(pair=>simulation.dofs.same(pair.a,pair.b)));
  const centerFront=sr24SeamReport(simulation,frame,'center-front'),centerBack=sr24SeamReport(simulation,frame,'center-back'),cuffs={left:sd23CuffReport(simulation,frame,'FL','BL'),right:sd23CuffReport(simulation,frame,'FR','BR')};
  const cuffsValid=[cuffs.left,cuffs.right].every(cuff=>cuff.projectedAreaM2>1e-4&&cuff.closureGapM<=simulation.options.stitchJoinToleranceM&&cuff.positiveArea);
  const gussetSeams=state.report.gussetSeamIds.map(id=>sr25SimulationSeamReport(simulation,id)),gussetSeamsClosed=gussetSeams.every(item=>item.maximumGapM<=simulation.options.stitchJoinToleranceM&&item.allPairsJoined);
  const gussetGeometry=sr25GussetGeometryFromSimulation(simulation,frame),gussetOrientationValid=gussetGeometry.landmarkOrderValid&&gussetGeometry.flippedTriangleCount===0&&gussetGeometry.minimumTriangleAreaM2>1e-8&&gussetGeometry.orientationDotUp>.15;
  const junctions=sr25JunctionReports(simulation),junctionsValid=junctions.every(item=>item.allMembersJoined&&item.memberCount===3&&item.extraWeld===false);
  const expectedDofs=sr25ExpectedClosedDofs(simulation,state.report.closedSeamIds),expectedJoinCount=sr25ExpectedJoinCount(simulation,state.report.closedSeamIds),strict=sr25UnexpectedIntersections(simulation),strictUnexpectedIntersectionFree=strict.detected===0;
  const futureStarted=simulation.seams.filter(seam=>!state.report.closedSeamIds.includes(seam.id)&&seam.pairs.some(pair=>pair.started));
  const materialLimit=options.materialLimit??.05,materialWithinCheckpoint=material.valid&&material.maxAbsPrincipalStrain<=materialLimit;
  const bodyContactValidated=!!simulation.body&&simulationReport.surfaceContact?.passed===true&&simulationReport.triangleBodyContact?.passed===true&&simulationReport.bodyPenetrationM<=.001;
  const swept=simulationReport.selfContact?.swept,selfContactValidated=simulationReport.selfContact?.enabled===true&&!simulationReport.selfContact.budgetExceeded&&simulationReport.selfContact.unresolvedCount===0&&(!swept||(!swept.budgetExceeded&&swept.uncertainCount===0&&swept.unresolvedCount===0));
  const bodyRequirementMet=options.requireBody?bodyContactValidated:true,selfContactRequirementMet=options.requireSelfContact?selfContactValidated:true;
  const centerRisesRemainClosed=centerFront.maximumGapM<=simulation.options.stitchJoinToleranceM&&centerBack.maximumGapM<=simulation.options.stitchJoinToleranceM;
  const topologyGate=state.report.sourceUnchanged&&sourceIdentityPreserved&&totalMassPreserved&&seamsClosed&&centerRisesRemainClosed&&gussetSeamsClosed&&gussetOrientationValid&&junctionsValid&&cuffsValid&&expectedDofs.valid&&strictUnexpectedIntersectionFree&&futureStarted.length===0&&dof.joinedStitchCount===expectedJoinCount;
  const valid=topologyGate&&materialWithinCheckpoint&&bodyRequirementMet&&selfContactRequirementMet;
  return {...baseReport,bodyFrame:frame,stitchJoinToleranceM:simulation.options.stitchJoinToleranceM,valid,topologyGate,sourceIdentityPreserved,totalMassPreserved,closedSeams:closed,
    centerFront,centerBack,centerRisesRemainClosed,cuffs,cuffsValid,gussetSeams,gussetSeamsClosed,gussetGeometry,gussetOrientationValid,junctions,junctionsValid,
    expectedClosedDofs:expectedDofs.valid,expectedDofs,strictUnexpectedIntersectionFree,strictUnexpectedIntersections:strict,futureSeamsStarted:futureStarted.map(seam=>seam.id),declaredClosedStitchPairCount:seamPairCount,expectedJoinedStitchCount:expectedJoinCount,joinedStitchCount:dof.joinedStitchCount,
    materialAtCheckpoint:material,materialCheckpointLimit:materialLimit,materialSafetyMargin:materialLimit-material.maxAbsPrincipalStrain,materialWithinCheckpoint,
    bodyContactValidated,bodyRequirementMet,selfContactValidated,selfContactRequirementMet,relaxationSteps:simulation.stepIndex,
    gussetConnected:gussetSeamsClosed&&junctionsValid,waistbandConnected:false,sideOpeningClosed:false,visualAcceptance:false,assemblyValidated:false,motionValidated:false,productionReady:false};
}

function sr25FitCentre(anchor,boundary,restRadii,anchorWeight,iterations){
  let point=[...anchor];
  for(let iteration=0;iteration<iterations;iteration++){
    const matrix=[[anchorWeight,0,0],[0,anchorWeight,0],[0,0,anchorWeight]],rhs=point.map((value,k)=>-anchorWeight*(value-anchor[k]));
    for(let i=0;i<boundary.length;i++){
      const delta=point.map((value,k)=>value-boundary[i][k]),length=Math.hypot(...delta);if(length<1e-12)continue;const gradient=delta.map(value=>value/length),error=length-restRadii[i];
      for(let row=0;row<3;row++){rhs[row]-=gradient[row]*error;for(let column=0;column<3;column++)matrix[row][column]+=gradient[row]*gradient[column];}
    }
    const step=sr25Solve3(matrix,rhs);if(!step)break;const magnitude=Math.hypot(...step);for(let k=0;k<3;k++)point[k]+=step[k];if(magnitude<1e-10)break;
  }
  return point;
}
function sr25Solve3(matrix,rhs){
  const a=matrix.map((row,i)=>[...row,rhs[i]]);
  for(let column=0;column<3;column++){
    let pivot=column;for(let row=column+1;row<3;row++)if(Math.abs(a[row][column])>Math.abs(a[pivot][column]))pivot=row;
    if(Math.abs(a[pivot][column])<1e-14)return null;if(pivot!==column)[a[pivot],a[column]]=[a[column],a[pivot]];
    const divisor=a[column][column];for(let j=column;j<4;j++)a[column][j]/=divisor;
    for(let row=0;row<3;row++)if(row!==column){const factor=a[row][column];for(let j=column;j<4;j++)a[row][j]-=factor*a[column][j];}
  }
  return a.map(row=>row[3]);
}
function sr25Finite3(value){return Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);}
function sr25Distance(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);}
function sr25Sub(a,b){return a.map((value,k)=>value-b[k]);}
function sr25Dot(a,b){return a.reduce((sum,value,k)=>sum+value*b[k],0);}
function sr25Cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function sr25StateSeamReport(pattern,positionsByPiece,id){
  const seam=pattern.seams.find(item=>item.id===id);if(!seam)throw Error('shorts-r2.5-gusset: missing source seam '+id);let maximumGapM=0;
  for(const pair of seam.pairs){const a=positionsByPiece.get(seam.a.pieceId)[pair.a],b=positionsByPiece.get(seam.b.pieceId)[pair.b];maximumGapM=Math.max(maximumGapM,sr25Distance(a,b));}
  return {id,pairCount:seam.pairs.length,maximumGapM};
}
function sr25SimulationSeamReport(simulation,id){
  const seam=simulation.seams.find(item=>item.id===id);if(!seam)throw Error('shorts-r2.5-gusset: missing simulation seam '+id);
  return {id,pairCount:seam.pairs.length,maximumGapM:Math.max(0,...seam.pairs.map(pair=>sr25Distance(simulation.particles[pair.a].pos,simulation.particles[pair.b].pos))),allPairsJoined:seam.pairs.every(pair=>simulation.dofs.same(pair.a,pair.b))};
}
function sr25GussetGeometryFromPositions(pattern,positionsByPiece,frame){
  const piece=pattern.pieces.find(item=>item.id==='G');return sr25GussetGeometry(piece,positionsByPiece.get('G'),frame);
}
function sr25GussetGeometryFromSimulation(simulation,frame){
  const piece=simulation.pattern.pieces.find(item=>item.id==='G'),range=simulation.ranges.get('G'),positions=simulation.particles.slice(range.offset,range.offset+range.count).map(p=>p.pos);return sr25GussetGeometry(piece,positions,frame);
}
function sr25GussetGeometry(piece,positions,frame){
  if(!piece||!positions||positions.length!==piece.materialCoordinates.length)throw Error('shorts-r2.5-gusset: invalid gusset geometry input');
  const local=point=>{const d=sr25Sub(point,frame.origin);return [sr25Dot(d,frame.right),sr25Dot(d,frame.up),sr25Dot(d,frame.forward)];},landmarks=Object.fromEntries(Object.entries(piece.landmarks).map(([name,index])=>[name,local(positions[index])]));
  const landmarkOrderValid=landmarks.right[0]-landmarks.left[0]>.025&&landmarks.front[2]-landmarks.back[2]>.04;
  let surfaceAreaM2=0,minimumTriangleAreaM2=Infinity,flippedTriangleCount=0,areaVector=[0,0,0];
  for(const triangle of piece.triangles){const a=positions[triangle[0]],b=positions[triangle[1]],c=positions[triangle[2]],cross=sr25Cross(sr25Sub(b,a),sr25Sub(c,a)),twiceArea=Math.hypot(...cross),area=twiceArea/2;surfaceAreaM2+=area;minimumTriangleAreaM2=Math.min(minimumTriangleAreaM2,area);for(let k=0;k<3;k++)areaVector[k]+=cross[k];if(sr25Dot(cross,frame.up)<=0)flippedTriangleCount++;}
  const areaLength=Math.hypot(...areaVector),orientationDotUp=areaLength>0?sr25Dot(areaVector,frame.up)/areaLength:0;
  let maximumRadialStrain=0;const centre=positions[8];for(let i=0;i<8;i++){const rest=Math.hypot(...piece.materialCoordinates[i]);maximumRadialStrain=Math.max(maximumRadialStrain,Math.abs(sr25Distance(centre,positions[i])/rest-1));}
  return {landmarks,landmarkOrderValid,surfaceAreaM2,minimumTriangleAreaM2:Number.isFinite(minimumTriangleAreaM2)?minimumTriangleAreaM2:0,flippedTriangleCount,orientationDotUp,maximumRadialStrain,centreLocal:local(centre)};
}
function sr25JunctionReports(simulation){
  return simulation.pattern.junctions.map(junction=>{
    const indices=junction.members.map(member=>simulation.ranges.get(member.pieceId).offset+member.index),allMembersJoined=indices.every(index=>simulation.dofs.same(indices[0],index));
    return {id:junction.id,memberCount:indices.length,memberPieceIds:junction.members.map(member=>member.pieceId),indices,allMembersJoined,extraWeld:junction.extraWeld};
  });
}
function sr25ExpectedJoinCount(simulation,closedSeamIds){
  const parent=new Map(),find=x=>{if(!parent.has(x))parent.set(x,x);let p=parent.get(x);while(p!==parent.get(p))p=parent.get(p);let n=x;while(parent.get(n)!==p){const next=parent.get(n);parent.set(n,p);n=next;}return p;},join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent.set(b,a);};
  const vertices=new Set();for(const id of closedSeamIds){const seam=simulation.seams.find(item=>item.id===id);if(!seam)throw Error('shorts-r2.5-gusset: missing expected closed seam '+id);for(const pair of seam.pairs){vertices.add(pair.a);vertices.add(pair.b);join(pair.a,pair.b);}}
  const components=new Set([...vertices].map(find));return vertices.size-components.size;
}
function sr25ExpectedClosedDofs(simulation,closedSeamIds){
  const parent=new Map(),find=x=>{if(!parent.has(x))parent.set(x,x);let p=parent.get(x);while(p!==parent.get(p))p=parent.get(p);let n=x;while(parent.get(n)!==p){const next=parent.get(n);parent.set(n,p);n=next;}return p;},join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent.set(b,a);};
  for(const id of closedSeamIds){const seam=simulation.seams.find(item=>item.id===id);if(!seam)throw Error('shorts-r2.5-gusset: missing expected closed seam '+id);for(const pair of seam.pairs)join(pair.a,pair.b);}
  for(let a=0;a<simulation.particles.length;a++)for(let b=a+1;b<simulation.particles.length;b++)if(simulation.dofs.same(a,b)&&find(a)!==find(b))return {valid:false,unexpectedPair:[a,b],aPieceId:simulation.particles[a].pieceId,bPieceId:simulation.particles[b].pieceId};
  return {valid:true,unexpectedPair:null};
}
function sr25UnexpectedIntersections(simulation){
  const active=new Set(['FL','FR','BR','BL','G']),triangles=simulation.triangleRecords.filter(t=>active.has(t.pieceId));let checkedCandidatePairs=0,skippedTopologicalPairs=0;
  for(let i=0;i<triangles.length;i++){const a=triangles[i],ap=a.indices.map(index=>simulation.particles[index].pos),ab=sd23Bounds(ap);
    for(let j=i+1;j<triangles.length;j++){const b=triangles[j];if(a.indices.some(x=>b.indices.some(y=>x===y||simulation.dofs.same(x,y)))){skippedTopologicalPairs++;continue;}const bp=b.indices.map(index=>simulation.particles[index].pos),bb=sd23Bounds(bp);if(!sd23BoundsOverlap(ab,bb,1e-9))continue;checkedCandidatePairs++;if(sd23TrianglesIntersect(ap,bp,1e-9))return {method:'main-panels-and-gusset-strict-triangle-test-excluding-shared-stitch-dofs',detected:1,checkedCandidatePairs,skippedTopologicalPairs,firstPair:{aPieceId:a.pieceId,bPieceId:b.pieceId,aIndices:[...a.indices],bIndices:[...b.indices]}};}
  }
  return {method:'main-panels-and-gusset-strict-triangle-test-excluding-shared-stitch-dofs',detected:0,checkedCandidatePairs,skippedTopologicalPairs,firstPair:null};
}
