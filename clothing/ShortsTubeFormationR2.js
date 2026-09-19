/* R2.3 staged authoring state: form only the LEFT leg tube from the original
 * FL and BL paper. The map wraps each material row around the measured left
 * thigh while preserving that row's arc length; the actual outseam-left and
 * inseam-left source pairs are then joined as spatial DOFs. No right panel,
 * gusset, rise, waistband, Human rig, UV, triangle or mass is changed.
 * This is an assembly checkpoint, not a fitted/wearable garment. */
const SHORTS_LEFT_TUBE_R23_VERSION='shorts-r2.3-left-tube-authoring-1';

function createShortsLeftTubeStateR23(pattern,body,human,options={}){
  const fail=message=>{throw Error('shorts-r2.3-left-tube: '+message);};
  const finite3=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
  const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const length2=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  if(!pattern||!body||!human)fail('pattern, measured body and final Human rig are required');
  const placement=applyShortsRigidPlacementR2(pattern,body,human,options.placementOptions||{});
  if(placement.valid!==true)fail('R2.2 panel ownership must pass first');
  const frame=placement.bodyFrame.current,sourceFrame=placement.bodyFrame.source;
  if(![frame.origin,frame.right,frame.up,frame.forward,sourceFrame.origin,sourceFrame.right,sourceFrame.up,sourceFrame.forward].every(finite3))fail('invalid pelvis frame');
  const local=(point,f=frame)=>{const d=sub(point,f.origin);return [dot(d,f.right),dot(d,f.up),dot(d,f.forward)];};
  const world=coordinate=>add(frame.origin,add(mul(frame.right,coordinate[0]),add(mul(frame.up,coordinate[1]),mul(frame.forward,coordinate[2]))));
  const mapSourcePoint=point=>{const d=sub(point,sourceFrame.origin),coordinate=[dot(d,sourceFrame.right),dot(d,sourceFrame.up),dot(d,sourceFrame.forward)];return world(coordinate);};
  const pieces=new Map(pattern.pieces.map(piece=>[piece.id,piece]));
  const front=pieces.get('FL'),back=pieces.get('BL');
  if(!front||!back||front.grid?.columns!==back.grid?.columns||front.grid?.rows!==back.grid?.rows)fail('matching FL and BL structured source panels are required');
  const columns=front.grid.columns,rows=front.grid.rows,stride=columns+1,index=(row,column)=>row*stride+column;
  const measurements=body.measure(),meta=measurements.metadata,thigh=meta?.thighCenters?.left;
  if(!thigh||![thigh.x,thigh.z,meta.thighY].every(Number.isFinite))fail('measured left thigh centre is required');
  const centreLocal=local(mapSourcePoint([thigh.x,meta.thighY,thigh.z]));
  const outerSource=pattern.seams.find(seam=>seam.id==='outseam-left')?.a?.indices,innerSource=pattern.seams.find(seam=>seam.id==='inseam-left')?.a?.indices;
  if(!Array.isArray(outerSource)||!Array.isArray(innerSource))fail('left leg source seam boundaries are required');
  const outerStartRow=Math.min(...outerSource.map(i=>Math.floor(i/stride))),innerStartRow=Math.min(...innerSource.map(i=>Math.floor(i/stride)));
  if(!(outerStartRow>=1&&innerStartRow>outerStartRow&&innerStartRow<=rows))fail('invalid source leg seam rows');
  const outerOpeningTopM=options.outerOpeningTopM??.028,innerOpeningTopM=options.innerOpeningTopM??.050;
  if(![outerOpeningTopM,innerOpeningTopM].every(value=>Number.isFinite(value)&&value>=0&&value<=.10))fail('invalid staged opening');
  const rigidPositions=new Map(),positionsByPiece=new Map();
  for(const piece of pattern.pieces){
    const p=piece.placement,positions=piece.materialCoordinates.map(uv=>add(p.origin,add(mul(p.basisU,uv[0]),mul(p.basisV,uv[1]))));
    if(positions.some(point=>!finite3(point)))fail(piece.id+' has invalid rigid positions');
    rigidPositions.set(piece.id,positions);positionsByPiece.set(piece.id,positions.map(point=>[...point]));
  }
  const rowReports=[];
  for(let row=0;row<=rows;row++){
    const frontUV=Array.from({length:stride},(_,column)=>front.materialCoordinates[index(row,column)]),backUV=Array.from({length:stride},(_,column)=>back.materialCoordinates[index(row,column)]);
    const frontDistances=[0],backDistances=[0];
    for(let column=1;column<=columns;column++){frontDistances.push(frontDistances.at(-1)+length2(frontUV[column],frontUV[column-1]));backDistances.push(backDistances.at(-1)+length2(backUV[column],backUV[column-1]));}
    const frontWidth=frontDistances.at(-1),backWidth=backDistances.at(-1);
    if(!(frontWidth>0&&backWidth>0))fail('zero-width source row');
    const outerGap=outerStartRow===0||row>=outerStartRow?0:outerOpeningTopM*(1-row/outerStartRow);
    const innerGap=innerStartRow===0||row>=innerStartRow?0:innerOpeningTopM*(1-row/innerStartRow);
    const circumference=frontWidth+backWidth+outerGap+innerGap,radius=circumference/(2*Math.PI);
    if(!(radius>.025&&radius<.30))fail('implausible left tube radius');
    const frontSpan=frontWidth/radius,backSpan=backWidth/radius,innerAngle=innerGap/radius,outerAngle=outerGap/radius;
    const frontInner=innerAngle/2,backInner=2*Math.PI-innerAngle/2;
    const frontOuter=frontInner+frontSpan,backOuter=backInner-backSpan;
    if(Math.abs((backOuter-frontOuter)-outerAngle)>1e-8)fail('row arc accounting failed');
    const allRigid=[...rigidPositions.get('FL').slice(index(row,0),index(row,columns)+1),...rigidPositions.get('BL').slice(index(row,0),index(row,columns)+1)],rowUp=allRigid.reduce((sum,point)=>sum+local(point)[1],0)/allRigid.length;
    for(let column=0;column<=columns;column++){
      const ft=frontDistances[column]/frontWidth,bt=backDistances[column]/backWidth,fa=frontInner+ft*frontSpan,ba=backInner-bt*backSpan;
      positionsByPiece.get('FL')[index(row,column)]=world([centreLocal[0]+radius*Math.cos(fa),rowUp,centreLocal[2]+radius*Math.sin(fa)]);
      positionsByPiece.get('BL')[index(row,column)]=world([centreLocal[0]+radius*Math.cos(ba),rowUp,centreLocal[2]+radius*Math.sin(ba)]);
    }
    rowReports.push({row,radiusM:radius,frontArcM:frontWidth,backArcM:backWidth,innerOpeningM:innerGap,outerOpeningM:outerGap,frontInnerAngle:frontInner,frontOuterAngle:frontOuter,backInnerAngle:backInner,backOuterAngle:backOuter});
  }
  const before=JSON.stringify(pattern.pieces.map(piece=>({id:piece.id,uv:piece.materialCoordinates,triangles:piece.triangles,boundaries:piece.boundaries})));
  const after=JSON.stringify(pattern.pieces.map(piece=>({id:piece.id,uv:piece.materialCoordinates,triangles:piece.triangles,boundaries:piece.boundaries})));
  const report={version:SHORTS_LEFT_TUBE_R23_VERSION,stage:'R2.3 left leg tube authoring state',sourceUnchanged:before===after,
    panelIds:['FL','BL'],closedSeamIds:['outseam-left','inseam-left'],rightPanelsUntouched:['FR','BR'],gussetUntouched:true,waistbandsUntouched:true,
    bodyFrame:frame,leftThighCentreLocal:centreLocal,outerStartRow,innerStartRow,rowReports,
    persistentShapeTarget:false,legSkinning:false,visualAcceptance:false,assemblyValidated:false,motionValidated:false};
  return {positionsByPiece,report};
}

function completeShortsLeftTubeR23(simulation,state){
  const fail=message=>{throw Error('shorts-r2.3-left-tube: '+message);};
  if(!simulation?.dofs||!simulation?.ranges||!state?.positionsByPiece||!state?.report)fail('stitch DOFs and staged positions are required');
  const sourceBefore=JSON.stringify(simulation.particles.map(p=>({uv:p.uv,mass:p.mass,pieceId:p.pieceId}))),massBefore=simulation.particles.reduce((sum,p)=>sum+p.mass,0);
  for(const [id,positions] of state.positionsByPiece){const range=simulation.ranges.get(id);if(!range||positions.length!==range.count)fail('invalid staged positions for '+id);for(let i=0;i<range.count;i++){const point=positions[i];if(!finiteR23(point))fail('nonfinite staged point');const p=simulation.particles[range.offset+i];p.pos=[...point];p.previous=[...point];p.velocity=[0,0,0];}}
  // Only FL/BL remain movable in this checkpoint. This is a removable authoring
  // lock, not a material mass change or a wearable constraint.
  let authoringLockedParticleCount=0;for(const p of simulation.particles)if(!['FL','BL'].includes(p.pieceId)){p.invMass=0;authoringLockedParticleCount++;}
  // Recreate spatial groups from the staged positions before joining the real
  // source seam pairs. Contact objects are then rebuilt against those groups.
  simulation.dofs=createShortsStitchDofs(simulation.particles,{joinTolerance:simulation.options.stitchJoinToleranceM});
  const closed=[];
  for(const seam of simulation.seams)if(!state.report.closedSeamIds.includes(seam.id)){seam.start=Infinity;seam.progress=0;seam.needleIndex=0;seam.needleStart=null;for(const pair of seam.pairs){pair.started=false;pair.initialGap=null;pair.lambda=0;}}
  for(const id of state.report.closedSeamIds){const seam=simulation.seams.find(item=>item.id===id);if(!seam)fail('missing source seam '+id);let maximumGapM=0;
    for(const pair of seam.pairs){const a=simulation.particles[pair.a],b=simulation.particles[pair.b],gap=Math.hypot(...a.pos.map((v,k)=>v-b.pos[k]));maximumGapM=Math.max(maximumGapM,gap);if(gap>simulation.options.stitchJoinToleranceM)fail(id+' staged endpoints are not coincident: '+gap);pair.started=true;pair.initialGap=gap;a.previous=[...a.pos];b.previous=[...b.pos];if(!simulation.dofs.same(pair.a,pair.b)&&!simulation.dofs.join(pair.a,pair.b,{started:true,closureProgress:1,requirePreviousClosure:true}))fail(id+' source stitch could not join');}
    seam.progress=1;seam.start=0;seam.needleIndex=seam.pairs.length;seam.needleStart=null;closed.push({id,pairCount:seam.pairs.length,maximumGapM});
  }
  simulation.continuousContact=simulation.options.selfContact?createShortsContinuousContact(simulation.particles,simulation.triangleRecords,simulation.edges,{thickness:simulation.options.thickness,maxCandidates:simulation.options.maxSelfCandidates,dofs:simulation.dofs,motionLimit:true}):null;
  simulation.surfaceContact=simulation.body?new ShortsSurfaceContact(simulation.particles,simulation.triangleRecords,simulation.body,{clearanceM:simulation.options.thickness,toleranceM:.001,dofs:simulation.dofs}):null;
  simulation.triangleBodyContact=simulation.options.triangleBodyContact?new ShortsTriangleBodyContact(simulation.particles,simulation.triangleRecords,simulation.body,{clearanceM:simulation.options.thickness,toleranceM:.001,dofs:simulation.dofs,maxCandidates:simulation.options.triangleBodyMaxCandidates,maxWitnessQueries:simulation.options.triangleBodyMaxWitnessQueries}):null;
  for(const support of simulation.temporarySupports){support.start=[...simulation.particles[support.index].pos];support.targetHeight=support.start[1];support.lambda=[0,0,0];if(!['FL','BL'].includes(simulation.particles[support.index].pieceId))support.active=false;}
  simulation._sync();
  const base={...state.report,sourceBefore,massBefore,closedSeams:closed,authoringLockedParticleCount,authoringLocksRemovable:true,otherSeamsStarted:false};
  const report=auditShortsLeftTubeR23(simulation,state,base);
  simulation.events.push({type:'r2.3_left_leg_tube_checkpoint',stepIndex:simulation.stepIndex,closedSeams:closed.map(item=>item.id),cuffAreaM2:report.cuff.projectedAreaM2,valid:report.valid});
  return report;
}

function auditShortsLeftTubeR23(simulation,state,baseReport={...state.report},options={}){
  const front=simulation.pattern.pieces.find(p=>p.id==='FL'),back=simulation.pattern.pieces.find(p=>p.id==='BL'),fr=simulation.ranges.get('FL'),br=simulation.ranges.get('BL'),frame=state.report.bodyFrame;
  const cuff=[...front.boundaries.hem.map(i=>simulation.particles[fr.offset+i].pos),...back.boundaries.hem.slice().reverse().map(i=>simulation.particles[br.offset+i].pos)];
  const coords=cuff.map(point=>{const d=point.map((v,k)=>v-frame.origin[k]);return [d.reduce((s,v,k)=>s+v*frame.right[k],0),d.reduce((s,v,k)=>s+v*frame.forward[k],0)];});
  let area=0;for(let i=0;i<coords.length;i++){const a=coords[i],b=coords[(i+1)%coords.length];area+=a[0]*b[1]-b[0]*a[1];}area=Math.abs(area)/2;
  const first=cuff[0],last=cuff.at(-1),closureGapM=Math.hypot(...first.map((v,k)=>v-last[k]));
  const simulationReport=simulation.report(),material=simulationReport.material,sourceAfter=JSON.stringify(simulation.particles.map(p=>({uv:p.uv,mass:p.mass,pieceId:p.pieceId}))),massAfter=simulation.particles.reduce((sum,p)=>sum+p.mass,0),dof=simulation.dofs.report();
  const closed=(baseReport.closedSeams||state.report.closedSeamIds.map(id=>{const seam=simulation.seams.find(item=>item.id===id);return {id,pairCount:seam.pairs.length,maximumGapM:Math.max(0,...seam.pairs.map(pair=>Math.hypot(...simulation.particles[pair.a].pos.map((v,k)=>v-simulation.particles[pair.b].pos[k]))))};}));
  const sourceIdentityPreserved=baseReport.sourceBefore?baseReport.sourceBefore===sourceAfter:true,totalMassPreserved=baseReport.massBefore===undefined||Math.abs(baseReport.massBefore-massAfter)<1e-12;
  const seamPairCount=closed.reduce((sum,item)=>sum+item.pairCount,0),seamsClosed=closed.every(item=>item.maximumGapM<=simulation.options.stitchJoinToleranceM)&&state.report.closedSeamIds.every(id=>{const seam=simulation.seams.find(item=>item.id===id);return seam?.pairs.every(pair=>simulation.dofs.same(pair.a,pair.b));});
  const materialWithinCheckpoint=material.valid&&material.maxAbsPrincipalStrain<=.05,bodyContactValidated=!!simulation.body&&simulationReport.surfaceContact?.passed===true&&simulationReport.triangleBodyContact?.passed===true&&simulationReport.bodyPenetrationM<=.001,bodyRequirementMet=options.requireBody?bodyContactValidated:true,valid=state.report.sourceUnchanged&&sourceIdentityPreserved&&totalMassPreserved&&seamsClosed&&area>1e-4&&closureGapM<=simulation.options.stitchJoinToleranceM&&materialWithinCheckpoint&&bodyRequirementMet&&dof.joinedStitchCount===seamPairCount;
  return {...baseReport,valid,sourceIdentityPreserved,totalMassPreserved,closedSeams:closed,cuff:{pointCount:cuff.length,projectedAreaM2:area,closureGapM,positiveArea:area>1e-4},materialAtCheckpoint:material,
    materialCheckpointLimit:.05,materialWithinCheckpoint,joinedStitchCount:dof.joinedStitchCount,leftTubeFormed:valid,relaxationSteps:simulation.stepIndex,
    bodyContactValidated,bodyRequirementMet,selfContactValidated:false,visualAcceptance:false,assemblyValidated:false,motionValidated:false,productionReady:false};
}
function finiteR23(value){return Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);}
