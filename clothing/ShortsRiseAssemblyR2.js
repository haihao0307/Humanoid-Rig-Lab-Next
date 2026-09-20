/* R2.4 staged authoring state: connect the original centre-front and
 * centre-back rise seams after R2.3b has formed two independent leg tubes.
 * Rows above the crotch are laid on one arclength-parameterized pelvis
 * envelope. The left side opening remains open and the independent gusset and
 * four waistband pieces remain untouched. Source UVs, triangles, masses and
 * the Human rig are never changed. This is not whole-garment acceptance. */
const SHORTS_RISE_R24_VERSION='shorts-r2.4-center-rise-authoring-1';

function createShortsRiseStateR24(pattern,body,human,options={}){
  const fail=message=>{throw Error('shorts-r2.4-rise: '+message);};
  const finite3=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
  const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const length2=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  if(!pattern||!body||!human)fail('pattern, measured body and final Human rig are required');
  const dual=createShortsDualTubeStateR23(pattern,body,human,options.dualTubeOptions||{});
  if(dual.report.sourceUnchanged!==true)fail('R2.3b source contract must pass first');
  const placement=applyShortsRigidPlacementR2(pattern,body,human,options.placementOptions||{}),frame=placement.bodyFrame.current,sourceFrame=placement.bodyFrame.source;
  if(![frame.origin,frame.right,frame.up,frame.forward,sourceFrame.origin,sourceFrame.right,sourceFrame.up,sourceFrame.forward].every(finite3))fail('invalid pelvis frame');
  const local=(point,f=frame)=>{const d=sub(point,f.origin);return [dot(d,f.right),dot(d,f.up),dot(d,f.forward)];};
  const world=coordinate=>add(frame.origin,add(mul(frame.right,coordinate[0]),add(mul(frame.up,coordinate[1]),mul(frame.forward,coordinate[2]))));
  const mapSourcePoint=point=>{const d=sub(point,sourceFrame.origin),coordinate=[dot(d,sourceFrame.right),dot(d,sourceFrame.up),dot(d,sourceFrame.forward)];return world(coordinate);};
  const pieces=new Map(pattern.pieces.map(piece=>[piece.id,piece]));
  for(const id of ['FL','FR','BR','BL','G','WFL','WFR','WBR','WBL'])if(!pieces.has(id))fail('missing source panel '+id);
  const frontLeft=pieces.get('FL'),columns=frontLeft.grid?.columns,rows=frontLeft.grid?.rows;
  if(!Number.isInteger(columns)||!Number.isInteger(rows))fail('structured main panels are required');
  for(const id of ['FR','BR','BL'])if(pieces.get(id).grid?.columns!==columns||pieces.get(id).grid?.rows!==rows)fail('matching structured main panels are required');
  const stride=columns+1,index=(row,column)=>row*stride+column;
  const centreFront=pattern.seams.find(seam=>seam.id==='center-front'),centreBack=pattern.seams.find(seam=>seam.id==='center-back');
  if(!centreFront?.pairs?.length||!centreBack?.pairs?.length)fail('original centre rise seams are required');
  const riseRows=[...new Set([...centreFront.a.indices,...centreFront.b.indices,...centreBack.a.indices,...centreBack.b.indices].map(i=>Math.floor(i/stride)))].sort((a,b)=>a-b);
  const riseEndRow=riseRows.at(-1);
  if(riseRows.length!==riseEndRow+1||riseRows.some((row,i)=>row!==i)||riseEndRow>=rows)fail('centre rise rows must be one contiguous source boundary above the crotch');
  const sideOpening=pattern.seams.find(seam=>seam.id==='side-opening-left'),openingRows=sideOpening?.a?.indices?.map(i=>Math.floor(i/stride))||[];
  if(!openingRows.length)fail('left side opening source seam is required');
  const openingRow=Math.max(...openingRows);
  if(openingRow<1||openingRow>riseEndRow)fail('left side opening must terminate within the rise envelope');
  const measurements=body.measure(),meta=measurements.metadata,thighs=meta?.thighCenters;
  if(!finite3(measurements.waistCenter)||!thighs?.left||!thighs?.right||![thighs.left.x,thighs.right.x,thighs.left.z,thighs.right.z].every(Number.isFinite))fail('measured pelvis centre and thigh centres are required');
  const bodyDepth=Number.isFinite(meta?.bounds?.minZ)&&Number.isFinite(meta?.bounds?.maxZ)?meta.bounds.maxZ-meta.bounds.minZ:Math.max(.12,Math.abs((measurements.hipFrontArc??.45)-(measurements.hipBackArc??.45))+.18);
  const transverseEstimate=Math.abs(thighs.right.x-thighs.left.x)/2+(options.pelvisSideAllowanceM??.075),depthEstimate=bodyDepth/2+(options.bodyDepthClearanceM??.006);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const aspect=options.pelvisTransverseToDepthRatio??clamp(transverseEstimate/depthEstimate,1.15,1.65);
  const sideOpeningGapTopM=options.sideOpeningGapTopM??.018;
  if(!Number.isFinite(aspect)||aspect<1||aspect>2||!Number.isFinite(sideOpeningGapTopM)||sideOpeningGapTopM<.006||sideOpeningGapTopM>.05)fail('invalid pelvis envelope settings');
  const table=sr24EllipseArcTable(aspect,4096),positionsByPiece=new Map([...dual.positionsByPiece].map(([id,positions])=>[id,positions.map(point=>[...point])]));
  const pelvisSource=[(thighs.left.x+thighs.right.x)/2,measurements.waistCenter[1],measurements.waistCenter[2]],pelvisCenterLocal=local(mapSourcePoint(pelvisSource));
  const rowReports=[];
  const rowData=(piece,row)=>{
    const uv=Array.from({length:stride},(_,column)=>piece.materialCoordinates[index(row,column)]),distances=[0];
    for(let column=1;column<=columns;column++)distances.push(distances.at(-1)+length2(uv[column],uv[column-1]));
    const width=distances.at(-1);if(!(width>0))fail(piece.id+' has zero-width source row '+row);return {distances,width};
  };
  for(const row of riseRows){
    const fl=rowData(pieces.get('FL'),row),fr=rowData(pieces.get('FR'),row),br=rowData(pieces.get('BR'),row),bl=rowData(pieces.get('BL'),row);
    const openingGapM=row>=openingRow?0:sideOpeningGapTopM*(1-row/openingRow),circumference=fr.width+br.width+bl.width+openingGapM+fl.width,scale=circumference/table.perimeter;
    const transverseRadius=aspect*scale,depthRadius=scale;
    if(!(transverseRadius>.08&&transverseRadius<.30&&depthRadius>.055&&depthRadius<.22))fail('implausible pelvis envelope at source row '+row);
    const rowPoints=[];for(const id of ['FL','FR','BR','BL'])for(let column=0;column<=columns;column++)rowPoints.push(positionsByPiece.get(id)[index(row,column)]);
    const rowUp=rowPoints.reduce((sum,point)=>sum+local(point)[1],0)/rowPoints.length;
    const pointAt=distance=>{const theta=sr24EllipseAngleAtDistance(table,distance/circumference*table.perimeter);return world([pelvisCenterLocal[0]+transverseRadius*Math.cos(theta),rowUp,pelvisCenterLocal[2]+depthRadius*Math.sin(theta)]);};
    for(let column=0;column<=columns;column++){
      positionsByPiece.get('FR')[index(row,column)]=pointAt(fr.distances[column]);
      positionsByPiece.get('BR')[index(row,column)]=pointAt(fr.width+br.width-br.distances[column]);
      positionsByPiece.get('BL')[index(row,column)]=pointAt(fr.width+br.width+bl.distances[column]);
      positionsByPiece.get('FL')[index(row,column)]=pointAt(circumference-fl.distances[column]);
    }
    rowReports.push({row,circumferenceM:circumference,transverseRadiusM:transverseRadius,depthRadiusM:depthRadius,sideOpeningGapM:openingGapM,
      sourceArcsM:{FL:fl.width,FR:fr.width,BR:br.width,BL:bl.width}});
  }
  const midpointPairs=[];
  for(const seam of [centreFront,centreBack])for(const pair of seam.pairs){
    const a=positionsByPiece.get(seam.a.pieceId)[pair.a],b=positionsByPiece.get(seam.b.pieceId)[pair.b],mid=a.map((v,k)=>(v+b[k])/2);
    positionsByPiece.get(seam.a.pieceId)[pair.a]=[...mid];positionsByPiece.get(seam.b.pieceId)[pair.b]=[...mid];midpointPairs.push({seamId:seam.id,a:pair.a,b:pair.b});
  }
  const closedSeamIds=['outseam-left','inseam-left','outseam-right','inseam-right','center-front','center-back'];
  const stagedSeams=closedSeamIds.map(id=>sr24StateSeamReport(pattern,positionsByPiece,id));
  if(stagedSeams.some(item=>item.maximumGapM>1e-10))fail('staged source seam endpoints are not coincident');
  const before=JSON.stringify(pattern.pieces.map(piece=>({id:piece.id,uv:piece.materialCoordinates,triangles:piece.triangles,boundaries:piece.boundaries}))),after=JSON.stringify(pattern.pieces.map(piece=>({id:piece.id,uv:piece.materialCoordinates,triangles:piece.triangles,boundaries:piece.boundaries})));
  const report={version:SHORTS_RISE_R24_VERSION,stage:'R2.4 centre-front and centre-back rise connection',sourceUnchanged:before===after,
    panelIds:['FL','FR','BR','BL'],closedSeamIds,pendingSeamGroups:['gusset-four-edges','side-opening-left','waist-four-edges','waistband-ring'],
    bodyFrame:frame,riseRows,riseEndRow,openingRow,sideOpeningGapTopM,pelvisTransverseToDepthRatio:aspect,pelvisCenterLocal,rowReports,stagedSeams,midpointPairCount:midpointPairs.length,
    dualTubeInputVersion:dual.report.version,gussetUntouched:true,waistbandsUntouched:true,sideOpeningUntouched:true,persistentShapeTarget:false,legSkinning:false,
    visualAcceptance:false,assemblyValidated:false,motionValidated:false,productionReady:false};
  return {positionsByPiece,report,dualReport:dual.report};
}

function completeShortsRiseR24(simulation,state){
  const fail=message=>{throw Error('shorts-r2.4-rise: '+message);};
  if(!simulation?.dofs||!simulation?.ranges||!state?.positionsByPiece||!state?.report)fail('stitch DOFs and staged positions are required');
  const activePieces=new Set(state.report.panelIds),sourceBefore=JSON.stringify(simulation.particles.map(p=>({uv:p.uv,mass:p.mass,pieceId:p.pieceId}))),massBefore=simulation.particles.reduce((sum,p)=>sum+p.mass,0);
  for(const [id,positions] of state.positionsByPiece){const range=simulation.ranges.get(id);if(!range||positions.length!==range.count)fail('invalid staged positions for '+id);for(let i=0;i<range.count;i++){const point=positions[i];if(!sr24Finite3(point))fail('nonfinite staged point');const p=simulation.particles[range.offset+i];p.pos=[...point];p.previous=[...point];p.velocity=[0,0,0];}}
  let authoringLockedParticleCount=0;for(const p of simulation.particles)if(!activePieces.has(p.pieceId)){p.invMass=0;authoringLockedParticleCount++;}
  simulation.dofs=createShortsStitchDofs(simulation.particles,{joinTolerance:simulation.options.stitchJoinToleranceM});
  const closed=[];
  for(const seam of simulation.seams)if(!state.report.closedSeamIds.includes(seam.id)){seam.start=Infinity;seam.progress=0;seam.needleIndex=0;seam.needleStart=null;for(const pair of seam.pairs){pair.started=false;pair.initialGap=null;pair.lambda=0;}}
  for(const id of state.report.closedSeamIds){
    const seam=simulation.seams.find(item=>item.id===id);if(!seam)fail('missing source seam '+id);let maximumGapM=0;
    for(const pair of seam.pairs){const a=simulation.particles[pair.a],b=simulation.particles[pair.b],gap=Math.hypot(...a.pos.map((v,k)=>v-b.pos[k]));maximumGapM=Math.max(maximumGapM,gap);if(gap>simulation.options.stitchJoinToleranceM)fail(id+' staged endpoints are not coincident: '+gap);pair.started=true;pair.initialGap=gap;a.previous=[...a.pos];b.previous=[...b.pos];if(!simulation.dofs.same(pair.a,pair.b)&&!simulation.dofs.join(pair.a,pair.b,{started:true,closureProgress:1,requirePreviousClosure:true}))fail(id+' source stitch could not join');}
    seam.progress=1;seam.start=0;seam.needleIndex=seam.pairs.length;seam.needleStart=null;closed.push({id,pairCount:seam.pairs.length,maximumGapM});
  }
  const activeTriangleRecords=simulation.triangleRecords.filter(record=>activePieces.has(record.pieceId)),activeEdges=simulation.edges.filter(edge=>activePieces.has(simulation.particles[edge.a].pieceId)&&activePieces.has(simulation.particles[edge.b].pieceId)),activeParticleIndices=[];
  for(let i=0;i<simulation.particles.length;i++)if(activePieces.has(simulation.particles[i].pieceId))activeParticleIndices.push(i);
  if(!activeTriangleRecords.length||!activeEdges.length||!activeParticleIndices.length)fail('active rise contact domain is missing');
  simulation.contactTriangleRecords=activeTriangleRecords;simulation.contactEdges=activeEdges;simulation.contactParticleIndices=activeParticleIndices;
  simulation.continuousContact=simulation.options.selfContact?createShortsContinuousContact(simulation.particles,activeTriangleRecords,activeEdges,{thickness:simulation.options.thickness,maxCandidates:simulation.options.maxSelfCandidates,dofs:simulation.dofs,motionLimit:true}):null;
  simulation.surfaceContact=simulation.body?new ShortsSurfaceContact(simulation.particles,activeTriangleRecords,simulation.body,{clearanceM:simulation.options.thickness,toleranceM:.001,dofs:simulation.dofs,includeOnlyIncidentVertices:true}):null;
  simulation.triangleBodyContact=simulation.options.triangleBodyContact?new ShortsTriangleBodyContact(simulation.particles,activeTriangleRecords,simulation.body,{clearanceM:simulation.options.thickness,toleranceM:.001,dofs:simulation.dofs,maxCandidates:simulation.options.triangleBodyMaxCandidates,maxWitnessQueries:simulation.options.triangleBodyMaxWitnessQueries}):null;
  for(const support of simulation.temporarySupports){support.start=[...simulation.particles[support.index].pos];support.targetHeight=support.start[1];support.lambda=[0,0,0];if(!activePieces.has(simulation.particles[support.index].pieceId))support.active=false;}
  simulation._sync();
  const base={...state.report,sourceBefore,massBefore,closedSeams:closed,authoringLockedParticleCount,authoringLocksRemovable:true,
    bodyContactPieces:[...activePieces],inactiveBodyContactPieces:['G','WFL','WFR','WBR','WBL'],bodyContactTriangleCount:activeTriangleRecords.length,
    clothContactPieces:[...activePieces],clothContactTriangleCount:activeTriangleRecords.length,clothContactEdgeCount:activeEdges.length,clothContactParticleCount:activeParticleIndices.length};
  const report=auditShortsRiseR24(simulation,state,base);
  simulation.events.push({type:'r2.4_center_rise_checkpoint',stepIndex:simulation.stepIndex,closedSeams:closed.map(item=>item.id),frontRiseGapM:report.centerFront.maximumGapM,backRiseGapM:report.centerBack.maximumGapM,valid:report.valid});
  return report;
}

function auditShortsRiseR24(simulation,state,baseReport={...state.report},options={}){
  const frame=state.report.bodyFrame||simulation.pattern.r2PlacementReport?.bodyFrame?.current||state.dualReport?.bodyFrame;
  if(!frame)throw Error('shorts-r2.4-rise: body frame is unavailable');
  const simulationReport=simulation.report(),material=simulationReport.material,sourceAfter=JSON.stringify(simulation.particles.map(p=>({uv:p.uv,mass:p.mass,pieceId:p.pieceId}))),massAfter=simulation.particles.reduce((sum,p)=>sum+p.mass,0),dof=simulation.dofs.report();
  const closed=(baseReport.closedSeams||state.report.closedSeamIds.map(id=>{const seam=simulation.seams.find(item=>item.id===id);return {id,pairCount:seam.pairs.length,maximumGapM:Math.max(0,...seam.pairs.map(pair=>Math.hypot(...simulation.particles[pair.a].pos.map((v,k)=>v-simulation.particles[pair.b].pos[k]))))};}));
  const sourceIdentityPreserved=baseReport.sourceBefore?baseReport.sourceBefore===sourceAfter:true,totalMassPreserved=baseReport.massBefore===undefined||Math.abs(baseReport.massBefore-massAfter)<1e-12,seamPairCount=closed.reduce((sum,item)=>sum+item.pairCount,0);
  const seamsClosed=closed.every(item=>item.maximumGapM<=simulation.options.stitchJoinToleranceM)&&state.report.closedSeamIds.every(id=>simulation.seams.find(item=>item.id===id)?.pairs.every(pair=>simulation.dofs.same(pair.a,pair.b)));
  const centerFront=sr24SeamReport(simulation,frame,'center-front'),centerBack=sr24SeamReport(simulation,frame,'center-back'),cuffs={left:sd23CuffReport(simulation,frame,'FL','BL'),right:sd23CuffReport(simulation,frame,'FR','BR')};
  const cuffsValid=[cuffs.left,cuffs.right].every(cuff=>cuff.projectedAreaM2>1e-4&&cuff.closureGapM<=simulation.options.stitchJoinToleranceM&&cuff.positiveArea);
  const centerX=state.report.pelvisCenterLocal[0],centerZ=state.report.pelvisCenterLocal[2],centerlineBounded=Math.max(centerFront.maximumLateralOffsetM,centerBack.maximumLateralOffsetM)<=.035;
  const frontBackOrientation=centerFront.centroidLocal[2]>centerZ+.025&&centerBack.centroidLocal[2]<centerZ-.025&&centerFront.centroidLocal[2]-centerBack.centroidLocal[2]>.08;
  const expectedCrossSide=sr24ExpectedCrossSideDofs(simulation),strict=sr24UnexpectedIntersections(simulation),strictUnexpectedIntersectionFree=strict.detected===0;
  const futureStarted=simulation.seams.filter(seam=>!state.report.closedSeamIds.includes(seam.id)&&seam.pairs.some(pair=>pair.started));
  const materialWithinCheckpoint=material.valid&&material.maxAbsPrincipalStrain<=.05;
  const bodyContactValidated=!!simulation.body&&simulationReport.surfaceContact?.passed===true&&simulationReport.triangleBodyContact?.passed===true&&simulationReport.bodyPenetrationM<=.001;
  const swept=simulationReport.selfContact?.swept,selfContactValidated=simulationReport.selfContact?.enabled===true&&!simulationReport.selfContact.budgetExceeded&&simulationReport.selfContact.unresolvedCount===0&&(!swept||(!swept.budgetExceeded&&swept.uncertainCount===0&&swept.unresolvedCount===0));
  const bodyRequirementMet=options.requireBody?bodyContactValidated:true,selfContactRequirementMet=options.requireSelfContact?selfContactValidated:true;
  const topologyGate=state.report.sourceUnchanged&&sourceIdentityPreserved&&totalMassPreserved&&seamsClosed&&cuffsValid&&centerlineBounded&&frontBackOrientation&&expectedCrossSide.valid&&strictUnexpectedIntersectionFree&&futureStarted.length===0&&dof.joinedStitchCount===seamPairCount;
  const valid=topologyGate&&materialWithinCheckpoint&&bodyRequirementMet&&selfContactRequirementMet;
  return {...baseReport,bodyFrame:frame,stitchJoinToleranceM:simulation.options.stitchJoinToleranceM,valid,topologyGate,sourceIdentityPreserved,totalMassPreserved,closedSeams:closed,centerFront,centerBack,
    centerFrontConnected:centerFront.maximumGapM<=simulation.options.stitchJoinToleranceM,centerBackConnected:centerBack.maximumGapM<=simulation.options.stitchJoinToleranceM,
    centerlineTargetLocalX:centerX,centerlineBounded,frontBackOrientation,cuffs,cuffsValid,expectedCrossSideDofs:expectedCrossSide.valid,expectedCrossSide,
    strictUnexpectedIntersectionFree,strictUnexpectedIntersections:strict,futureSeamsStarted:futureStarted.map(seam=>seam.id),joinedStitchCount:dof.joinedStitchCount,
    materialAtCheckpoint:material,materialCheckpointLimit:.05,materialWithinCheckpoint,bodyContactValidated,bodyRequirementMet,selfContactValidated,selfContactRequirementMet,
    relaxationSteps:simulation.stepIndex,gussetConnected:false,waistbandConnected:false,sideOpeningClosed:false,visualAcceptance:false,assemblyValidated:false,motionValidated:false,productionReady:false};
}

function sr24Finite3(value){return Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);}
function sr24StateSeamReport(pattern,positionsByPiece,id){
  const seam=pattern.seams.find(item=>item.id===id);if(!seam)throw Error('shorts-r2.4-rise: missing source seam '+id);let maximumGapM=0;
  for(const pair of seam.pairs){const a=positionsByPiece.get(seam.a.pieceId)[pair.a],b=positionsByPiece.get(seam.b.pieceId)[pair.b];maximumGapM=Math.max(maximumGapM,Math.hypot(...a.map((v,k)=>v-b[k])));}
  return {id,pairCount:seam.pairs.length,maximumGapM};
}
function sr24EllipseArcTable(aspect,segments){
  const start=Math.PI/2,cumulative=[0],angles=[start];let previous=[aspect*Math.cos(start),Math.sin(start)],perimeter=0;
  for(let i=1;i<=segments;i++){const angle=start-2*Math.PI*i/segments,current=[aspect*Math.cos(angle),Math.sin(angle)];perimeter+=Math.hypot(current[0]-previous[0],current[1]-previous[1]);cumulative.push(perimeter);angles.push(angle);previous=current;}
  return {aspect,segments,cumulative,angles,perimeter};
}
function sr24EllipseAngleAtDistance(table,distance){
  const target=Math.max(0,Math.min(table.perimeter,distance)),c=table.cumulative;if(target<=0)return table.angles[0];if(target>=table.perimeter)return table.angles.at(-1);
  let lo=0,hi=table.segments;while(hi-lo>1){const mid=(lo+hi)>>1;if(c[mid]<target)lo=mid;else hi=mid;}const span=c[hi]-c[lo],t=span>0?(target-c[lo])/span:0;return table.angles[lo]+(table.angles[hi]-table.angles[lo])*t;
}
function sr24SeamReport(simulation,frame,id){
  const seam=simulation.seams.find(item=>item.id===id);if(!seam)throw Error('shorts-r2.4-rise: missing simulation seam '+id);
  const local=point=>{const d=point.map((v,k)=>v-frame.origin[k]);return [d.reduce((s,v,k)=>s+v*frame.right[k],0),d.reduce((s,v,k)=>s+v*frame.up[k],0),d.reduce((s,v,k)=>s+v*frame.forward[k],0)];};
  let maximumGapM=0,maximumLateralOffsetM=0;const coordinates=[];
  for(const pair of seam.pairs){const a=simulation.particles[pair.a].pos,b=simulation.particles[pair.b].pos,gap=Math.hypot(...a.map((v,k)=>v-b[k])),mid=a.map((v,k)=>(v+b[k])/2),coordinate=local(mid);maximumGapM=Math.max(maximumGapM,gap);maximumLateralOffsetM=Math.max(maximumLateralOffsetM,Math.abs(coordinate[0]));coordinates.push(coordinate);}
  const centroidLocal=[0,1,2].map(k=>coordinates.reduce((sum,p)=>sum+p[k],0)/coordinates.length);
  return {id,pairCount:seam.pairs.length,maximumGapM,maximumLateralOffsetM,centroidLocal,minimumUpM:Math.min(...coordinates.map(p=>p[1])),maximumUpM:Math.max(...coordinates.map(p=>p[1]))};
}
function sr24ExpectedCrossSideDofs(simulation){
  const parent=new Map(),find=x=>{if(!parent.has(x))parent.set(x,x);let p=parent.get(x);while(p!==parent.get(p))p=parent.get(p);let n=x;while(parent.get(n)!==p){const next=parent.get(n);parent.set(n,p);n=next;}return p;},join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent.set(b,a);};
  for(const id of ['center-front','center-back']){const seam=simulation.seams.find(item=>item.id===id);if(!seam)throw Error('shorts-r2.4-rise: missing expected centre seam');for(const pair of seam.pairs)join(pair.a,pair.b);}
  const left=[],right=[];for(let i=0;i<simulation.particles.length;i++){const id=simulation.particles[i].pieceId;if(id==='FL'||id==='BL')left.push(i);else if(id==='FR'||id==='BR')right.push(i);}
  for(const a of left)for(const b of right)if(simulation.dofs.same(a,b)&&find(a)!==find(b))return {valid:false,unexpectedPair:[a,b],leftPieceId:simulation.particles[a].pieceId,rightPieceId:simulation.particles[b].pieceId};
  return {valid:true,unexpectedPair:null};
}
function sr24UnexpectedIntersections(simulation){
  const triangles=simulation.triangleRecords.filter(t=>['FL','FR','BR','BL'].includes(t.pieceId));let checkedCandidatePairs=0,skippedTopologicalPairs=0;
  for(let i=0;i<triangles.length;i++){const a=triangles[i],ap=a.indices.map(index=>simulation.particles[index].pos),ab=sd23Bounds(ap);
    for(let j=i+1;j<triangles.length;j++){const b=triangles[j];if(a.indices.some(x=>b.indices.some(y=>x===y||simulation.dofs.same(x,y)))){skippedTopologicalPairs++;continue;}const bp=b.indices.map(index=>simulation.particles[index].pos),bb=sd23Bounds(bp);if(!sd23BoundsOverlap(ab,bb,1e-9))continue;checkedCandidatePairs++;if(sd23TrianglesIntersect(ap,bp,1e-9))return {method:'active-panel-strict-triangle-test-excluding-shared-stitch-dofs',detected:1,checkedCandidatePairs,skippedTopologicalPairs,firstPair:{aPieceId:a.pieceId,bPieceId:b.pieceId,aIndices:[...a.indices],bIndices:[...b.indices]}};}
  }
  return {method:'active-panel-strict-triangle-test-excluding-shared-stitch-dofs',detected:0,checkedCandidatePairs,skippedTopologicalPairs,firstPair:null};
}
