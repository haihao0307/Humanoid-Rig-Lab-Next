/* R2.5 physical authoring route. The accepted R2.4 opening does not need to
 * have the already-sewn shape of G: real source edges are brought together by
 * a bounded sewing process. G begins as its unchanged flat source paper, then
 * its four directed edges close in order while material and contact constraints
 * remain active. No UV, mass, topology, body, rig, waistband or side opening is
 * changed. */
const SHORTS_GUSSET_SEWING_R25_VERSION='shorts-r2.5-sequential-source-gusset-1';

function createShortsGussetSewingStateR25(pattern,body,human,options={}){
  const state=createShortsGussetStateR25(pattern,body,human,options);
  const order=options.gussetSeamOrder??['gusset-FL','gusset-FR','gusset-BL','gusset-BR'];
  if(!Array.isArray(order)||order.length!==4||new Set(order).size!==4||order.some(id=>!state.report.gussetSeamIds.includes(id)))throw Error('shorts-r2.5-sewing: invalid directed gusset seam order');
  state.report={...state.report,version:SHORTS_GUSSET_SEWING_R25_VERSION,stage:'R2.5 sequential physical sewing of the independent source gusset',assemblyMethod:'unchanged_flat_G_then_directed_edge_sewing',gussetSeamOrder:[...order],instantaneousBoundaryWeld:false};
  state.sewing=null;return state;
}

function beginShortsGussetSewingR25(simulation,state,riseReport,options={}){
  const fail=message=>{throw Error('shorts-r2.5-sewing: '+message);};
  if(!simulation?.ranges||!state?.report||!state?.riseState)fail('simulation and R2.5 sewing state are required');
  if(riseReport?.valid!==true)fail('an accepted actual R2.4 checkpoint is required');
  const activePieces=new Set(state.report.panelIds),g=simulation.pattern.pieces.find(piece=>piece.id==='G'),range=simulation.ranges.get('G'),frame=state.report.bodyFrame;
  if(!g||!range||range.count!==9||![frame?.origin,frame?.right,frame?.up,frame?.forward].every(sr25Finite3))fail('original gusset and pelvis frame are required');
  const sourceBefore=JSON.stringify(simulation.particles.map(p=>({uv:p.uv,mass:p.mass,pieceId:p.pieceId}))),massBefore=simulation.particles.reduce((sum,p)=>sum+p.mass,0),opening=[];
  for(const id of state.report.gussetSeamIds){const seam=simulation.seams.find(item=>item.id===id);if(!seam)fail('missing source seam '+id);for(const pair of seam.pairs)opening.push(simulation.particles[pair.a].pos);}
  const openingCentroid=[0,1,2].map(k=>opening.reduce((sum,p)=>sum+p[k],0)/opening.length),offsetM=options.initialGussetOffsetM??.006;
  if(!Number.isFinite(offsetM)||offsetM<0||offsetM>.03)fail('invalid initial gusset offset');
  const origin=openingCentroid.map((value,k)=>value-frame.up[k]*offsetM),initialPositions=g.materialCoordinates.map(uv=>origin.map((value,k)=>value+frame.right[k]*uv[0]-frame.forward[k]*uv[1]));
  const initialGeometry=sr25GussetGeometry(g,initialPositions,frame);
  if(!initialGeometry.landmarkOrderValid||!initialGeometry.boundarySelfIntersectionFree||initialGeometry.minimumTriangleAreaM2<=1e-8||initialGeometry.maximumBoundaryEdgeStrain>1e-8||initialGeometry.maximumRadialStrain>1e-8)fail('initial G must remain an undeformed source piece');
  for(const p of simulation.particles){const active=activePieces.has(p.pieceId);p.invMass=active?p.freeInvMass:0;p.previous=[...p.pos];p.velocity=[0,0,0];}
  for(let i=0;i<range.count;i++){const p=simulation.particles[range.offset+i];p.pos=[...initialPositions[i]];p.previous=[...p.pos];p.velocity=[0,0,0];p.invMass=p.freeInvMass;}
  simulation.dofs=createShortsStitchDofs(simulation.particles,{joinTolerance:simulation.options.stitchJoinToleranceM});
  for(const seam of simulation.seams){seam.start=Infinity;seam.progress=0;seam.needleIndex=0;seam.needleStart=null;for(const pair of seam.pairs){pair.started=false;pair.initialGap=null;pair.lambda=0;}}
  const closed=[];
  for(const id of state.report.priorClosedSeamIds){const seam=simulation.seams.find(item=>item.id===id);if(!seam)fail('missing accepted R2.4 seam '+id);let maximumGapM=0;for(const pair of seam.pairs){const gap=sr25Distance(simulation.particles[pair.a].pos,simulation.particles[pair.b].pos);maximumGapM=Math.max(maximumGapM,gap);if(gap>simulation.options.stitchJoinToleranceM)fail(id+' reopened before R2.5: '+gap);pair.started=true;pair.initialGap=gap;if(!simulation.dofs.same(pair.a,pair.b)&&!simulation.dofs.join(pair.a,pair.b,{started:true,closureProgress:1,requirePreviousClosure:true}))fail(id+' could not restore accepted spatial equality');}seam.progress=1;seam.start=0;seam.needleIndex=seam.pairs.length;closed.push({id,pairCount:seam.pairs.length,maximumGapM});}
  const activeTriangles=simulation.triangleRecords.filter(record=>activePieces.has(record.pieceId)),activeEdges=simulation.edges.filter(edge=>activePieces.has(simulation.particles[edge.a].pieceId)&&activePieces.has(simulation.particles[edge.b].pieceId)),activeParticleIndices=[];
  for(let i=0;i<simulation.particles.length;i++)if(activePieces.has(simulation.particles[i].pieceId))activeParticleIndices.push(i);
  simulation.contactTriangleRecords=activeTriangles;simulation.contactEdges=activeEdges;simulation.contactParticleIndices=activeParticleIndices;
  simulation.continuousContact=simulation.options.selfContact?createShortsContinuousContact(simulation.particles,activeTriangles,activeEdges,{thickness:simulation.options.thickness,maxCandidates:simulation.options.maxSelfCandidates,dofs:simulation.dofs,motionLimit:true}):null;
  simulation.surfaceContact=simulation.body?new ShortsSurfaceContact(simulation.particles,activeTriangles,simulation.body,{clearanceM:simulation.options.thickness,toleranceM:.001,dofs:simulation.dofs,includeOnlyIncidentVertices:true}):null;
  simulation.triangleBodyContact=simulation.options.triangleBodyContact?new ShortsTriangleBodyContact(simulation.particles,activeTriangles,simulation.body,{clearanceM:simulation.options.thickness,toleranceM:.001,dofs:simulation.dofs,maxCandidates:simulation.options.triangleBodyMaxCandidates,maxWitnessQueries:simulation.options.triangleBodyMaxWitnessQueries}):null;
  for(const support of simulation.temporarySupports){const pieceId=simulation.particles[support.index].pieceId;support.start=[...simulation.particles[support.index].pos];support.targetHeight=support.start[1];support.lambda=[0,0,0];if(!activePieces.has(pieceId)||pieceId==='G'){support.active=false;if(pieceId==='G')support.releasedForNeedle=true;}}
  const edgeSewingSeconds=options.edgeSewingSeconds??.30,maximumStepsPerEdge=options.maximumStepsPerEdge??78,materialLimit=options.materialLimit??.05;
  if(!Number.isFinite(edgeSewingSeconds)||edgeSewingSeconds<=0||edgeSewingSeconds>1||!Number.isInteger(maximumStepsPerEdge)||maximumStepsPerEdge<24||maximumStepsPerEdge>160||!Number.isFinite(materialLimit)||materialLimit<=0||materialLimit>.05)fail('invalid bounded sewing controls');
  const risePeak=riseReport.materialAtCheckpoint?.maxAbsPrincipalStrain??scMetricReport(simulation.metrics,simulation.particles).maxAbsPrincipalStrain;
  state.sewing={order:[...state.report.gussetSeamOrder],index:0,edgeSewingSeconds,maximumStepsPerEdge,materialLimit,startStep:simulation.stepIndex,edgeStartStep:simulation.stepIndex,completedEdges:[],failed:false,failureReason:null,complete:false,peakPrincipalStrain:risePeak,initialGussetOrigin:[...origin],initialGussetGeometry:initialGeometry};
  sr25ActivateSewingEdge(simulation,state.sewing,state.sewing.order[0]);
  simulation.continuousHistory={detectedCrossingCount:0,uncertainCount:0,budgetExceeded:false};simulation._sync();
  return {...state.report,sourceBefore,massBefore,closedSeams:closed,openingCentroid,initialGussetOrigin:origin,initialGussetGeometry:initialGeometry,edgeSewingSeconds,maximumStepsPerEdge,materialLimit,sewingProgress:sr25SewingProgress(simulation,state),valid:false,topologyGate:false,gussetConnected:false};
}

function advanceShortsGussetSewingR25(simulation,state,baseReport){
  const sewing=state?.sewing;if(!sewing||sewing.complete||sewing.failed)return baseReport;
  const material=scMetricReport(simulation.metrics,simulation.particles);sewing.peakPrincipalStrain=Math.max(sewing.peakPrincipalStrain,material.maxAbsPrincipalStrain);
  if(!material.valid||material.maxAbsPrincipalStrain>sewing.materialLimit){sewing.failed=true;sewing.failureReason='material_strain_exceeded_during_sewing';return {...baseReport,sewingProgress:sr25SewingProgress(simulation,state),materialAtCheckpoint:material,valid:false};}
  const id=sewing.order[sewing.index],seam=simulation.seams.find(item=>item.id===id);
  if(!seam){sewing.failed=true;sewing.failureReason='missing_active_gusset_seam';return baseReport;}
  if(seam.pairs.every(pair=>simulation.dofs.same(pair.a,pair.b))){sewing.completedEdges.push({id,completedStep:simulation.stepIndex,elapsedSteps:simulation.stepIndex-sewing.edgeStartStep});sewing.index++;
    if(sewing.index>=sewing.order.length)sewing.complete=true;else{sewing.edgeStartStep=simulation.stepIndex;sr25ActivateSewingEdge(simulation,sewing,sewing.order[sewing.index]);}}
  else if(simulation.stepIndex-sewing.edgeStartStep>sewing.maximumStepsPerEdge){sewing.failed=true;sewing.failureReason='gusset_edge_step_budget_exceeded:'+id;}
  return {...baseReport,sewingProgress:sr25SewingProgress(simulation,state),materialAtCheckpoint:material,valid:false};
}

function auditShortsGussetSewingR25(simulation,state,baseReport,options={}){
  const sewing=state?.sewing,progress=sr25SewingProgress(simulation,state),material=scMetricReport(simulation.metrics,simulation.particles);
  if(!sewing?.complete){return {...baseReport,sewingProgress:progress,materialAtCheckpoint:material,materialWithinCheckpoint:material.valid&&material.maxAbsPrincipalStrain<=(sewing?.materialLimit??.05),topologyGate:false,valid:false,gussetConnected:false,visualAcceptance:false,assemblyValidated:false,motionValidated:false,productionReady:false};}
  const closed=state.report.closedSeamIds.map(id=>sr25SimulationSeamReport(simulation,id)),finalBase={...baseReport,closedSeams:closed,sewingProgress:progress,sewingHistoryPeakPrincipalStrain:sewing.peakPrincipalStrain};
  const report=auditShortsGussetR25(simulation,state,finalBase,options),historyWithin=sewing.peakPrincipalStrain<=sewing.materialLimit;
  return {...report,sewingProgress:progress,sewingHistoryPeakPrincipalStrain:sewing.peakPrincipalStrain,sewingHistoryWithinCheckpoint:historyWithin,valid:report.valid&&historyWithin,topologyGate:report.topologyGate&&historyWithin};
}

function sr25ActivateSewingEdge(simulation,sewing,id){const seam=simulation.seams.find(item=>item.id===id);if(!seam)throw Error('shorts-r2.5-sewing: missing source seam '+id);seam.start=simulation.time;seam.duration=sewing.edgeSewingSeconds;seam.progress=0;seam.needleIndex=0;seam.needleStart=null;for(const pair of seam.pairs){pair.started=false;pair.initialGap=null;pair.lambda=0;}}
function sr25SewingProgress(simulation,state){const sewing=state?.sewing;if(!sewing)return null;const activeId=sewing.complete?null:sewing.order[sewing.index],seams=sewing.order.map(id=>sr25SimulationSeamReport(simulation,id));return {method:'sequential_directed_source_edge_sewing',order:[...sewing.order],activeIndex:sewing.index,activeSeamId:activeId,completedEdges:sewing.completedEdges.map(item=>({...item})),complete:sewing.complete,failed:sewing.failed,failureReason:sewing.failureReason,startStep:sewing.startStep,currentStep:simulation.stepIndex,totalSewingSteps:simulation.stepIndex-sewing.startStep,edgeStartStep:sewing.edgeStartStep,maximumStepsPerEdge:sewing.maximumStepsPerEdge,edgeSewingSeconds:sewing.edgeSewingSeconds,peakPrincipalStrain:sewing.peakPrincipalStrain,seams};}
