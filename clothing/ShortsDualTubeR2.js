/* R2.3b staged authoring state: form BOTH leg tubes from the original four
 * main panels. Each row follows an arclength-parameterized oval around the
 * measured thigh. This preserves the source paper metric while keeping the
 * two independent cuffs from occupying the same space before the rise and
 * gusset are connected. No rise, gusset, side closure, waistband, Human rig,
 * UV, triangle or mass is changed. This is not a whole-garment acceptance. */
const SHORTS_DUAL_TUBE_R23_VERSION='shorts-r2.3-dual-tube-authoring-1';

function createShortsDualTubeStateR23(pattern,body,human,options={}){
  const fail=message=>{throw Error('shorts-r2.3-dual-tube: '+message);};
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
  const measurements=body.measure(),meta=measurements.metadata;
  const aspect=options.transverseToDepthRatio??.76;
  if(!(Number.isFinite(aspect)&&aspect>=.55&&aspect<=1))fail('invalid staged oval aspect ratio');
  const ellipse=sd23EllipseArcTable(aspect,2048);
  const rigidPositions=new Map(),positionsByPiece=new Map();
  for(const piece of pattern.pieces){
    const p=piece.placement,positions=piece.materialCoordinates.map(uv=>add(p.origin,add(mul(p.basisU,uv[0]),mul(p.basisV,uv[1]))));
    if(positions.some(point=>!finite3(point)))fail(piece.id+' has invalid rigid positions');
    rigidPositions.set(piece.id,positions);positionsByPiece.set(piece.id,positions.map(point=>[...point]));
  }
  const tubeReports={};
  const sideConfigs=[
    {side:'left',frontId:'FL',backId:'BL',medialSign:1,outerOpeningTopM:options.leftOuterOpeningTopM??.200,innerOpeningTopM:options.leftInnerOpeningTopM??.250},
    {side:'right',frontId:'FR',backId:'BR',medialSign:-1,outerOpeningTopM:options.rightOuterOpeningTopM??0,innerOpeningTopM:options.rightInnerOpeningTopM??.250}
  ];
  for(const config of sideConfigs){
    const front=pieces.get(config.frontId),back=pieces.get(config.backId),thigh=meta?.thighCenters?.[config.side];
    if(!front||!back||front.grid?.columns!==back.grid?.columns||front.grid?.rows!==back.grid?.rows)fail('matching '+config.side+' structured source panels are required');
    if(!thigh||![thigh.x,thigh.z,meta.thighY].every(Number.isFinite))fail('measured '+config.side+' thigh centre is required');
    if(![config.outerOpeningTopM,config.innerOpeningTopM].every(value=>Number.isFinite(value)&&value>=0&&value<=.50))fail('invalid '+config.side+' staged opening');
    const columns=front.grid.columns,rows=front.grid.rows,stride=columns+1,index=(row,column)=>row*stride+column;
    const centreLocal=local(mapSourcePoint([thigh.x,meta.thighY,thigh.z]));
    const outerSource=pattern.seams.find(seam=>seam.id==='outseam-'+config.side)?.a?.indices;
    const innerSource=pattern.seams.find(seam=>seam.id==='inseam-'+config.side)?.a?.indices;
    if(!Array.isArray(outerSource)||!Array.isArray(innerSource))fail(config.side+' leg source seam boundaries are required');
    const outerStartRow=Math.min(...outerSource.map(i=>Math.floor(i/stride))),innerStartRow=Math.min(...innerSource.map(i=>Math.floor(i/stride)));
    if(!(outerStartRow>=0&&innerStartRow>outerStartRow&&innerStartRow<=rows))fail('invalid '+config.side+' source leg seam rows');
    const rowReports=[];
    for(let row=0;row<=rows;row++){
      const frontUV=Array.from({length:stride},(_,column)=>front.materialCoordinates[index(row,column)]),backUV=Array.from({length:stride},(_,column)=>back.materialCoordinates[index(row,column)]);
      const frontDistances=[0],backDistances=[0];
      for(let column=1;column<=columns;column++){
        frontDistances.push(frontDistances.at(-1)+length2(frontUV[column],frontUV[column-1]));
        backDistances.push(backDistances.at(-1)+length2(backUV[column],backUV[column-1]));
      }
      const frontWidth=frontDistances.at(-1),backWidth=backDistances.at(-1);
      if(!(frontWidth>0&&backWidth>0))fail('zero-width '+config.side+' source row');
      const outerGap=outerStartRow===0||row>=outerStartRow?0:config.outerOpeningTopM*(1-row/outerStartRow);
      const innerGap=innerStartRow===0||row>=innerStartRow?0:config.innerOpeningTopM*(1-row/innerStartRow);
      const circumference=frontWidth+backWidth+outerGap+innerGap,scale=circumference/ellipse.perimeter;
      const transverseRadius=aspect*scale,depthRadius=scale;
      if(!(transverseRadius>.025&&transverseRadius<.30&&depthRadius>.025&&depthRadius<.35))fail('implausible '+config.side+' tube section');
      const allRigid=[...rigidPositions.get(config.frontId).slice(index(row,0),index(row,columns)+1),...rigidPositions.get(config.backId).slice(index(row,0),index(row,columns)+1)];
      const rowUp=allRigid.reduce((sum,point)=>sum+local(point)[1],0)/allRigid.length;
      const pointAt=distance=>{
        const theta=sd23EllipseAngleAtFraction(ellipse,distance/circumference);
        return world([centreLocal[0]+config.medialSign*transverseRadius*Math.cos(theta),rowUp,centreLocal[2]+depthRadius*Math.sin(theta)]);
      };
      for(let column=0;column<=columns;column++){
        positionsByPiece.get(config.frontId)[index(row,column)]=pointAt(innerGap/2+frontDistances[column]);
        positionsByPiece.get(config.backId)[index(row,column)]=pointAt(circumference-innerGap/2-backDistances[column]);
      }
      rowReports.push({row,transverseRadiusM:transverseRadius,depthRadiusM:depthRadius,circumferenceM:circumference,frontArcM:frontWidth,backArcM:backWidth,innerOpeningM:innerGap,outerOpeningM:outerGap});
    }
    tubeReports[config.side]={side:config.side,panelIds:[config.frontId,config.backId],centreLocal,outerStartRow,innerStartRow,rowReports};
  }
  const before=JSON.stringify(pattern.pieces.map(piece=>({id:piece.id,uv:piece.materialCoordinates,triangles:piece.triangles,boundaries:piece.boundaries})));
  const after=JSON.stringify(pattern.pieces.map(piece=>({id:piece.id,uv:piece.materialCoordinates,triangles:piece.triangles,boundaries:piece.boundaries})));
  const report={version:SHORTS_DUAL_TUBE_R23_VERSION,stage:'R2.3b dual leg tube authoring state',sourceUnchanged:before===after,
    panelIds:['FL','BL','FR','BR'],closedSeamIds:['outseam-left','inseam-left','outseam-right','inseam-right'],
    pendingSeamGroups:['center-rises','gusset-four-edges','side-opening-left','waist-four-edges','waistband-ring'],
    gussetUntouched:true,waistbandsUntouched:true,sideOpeningUntouched:true,bodyFrame:frame,transverseToDepthRatio:aspect,tubeReports,
    persistentShapeTarget:false,legSkinning:false,visualAcceptance:false,assemblyValidated:false,motionValidated:false};
  return {positionsByPiece,report};
}

function completeShortsDualTubeR23(simulation,state){
  const fail=message=>{throw Error('shorts-r2.3-dual-tube: '+message);};
  if(!simulation?.dofs||!simulation?.ranges||!state?.positionsByPiece||!state?.report)fail('stitch DOFs and staged positions are required');
  const activePieces=new Set(state.report.panelIds);
  const sourceBefore=JSON.stringify(simulation.particles.map(p=>({uv:p.uv,mass:p.mass,pieceId:p.pieceId}))),massBefore=simulation.particles.reduce((sum,p)=>sum+p.mass,0);
  for(const [id,positions] of state.positionsByPiece){
    const range=simulation.ranges.get(id);if(!range||positions.length!==range.count)fail('invalid staged positions for '+id);
    for(let i=0;i<range.count;i++){
      const point=positions[i];if(!finiteR23(point))fail('nonfinite staged point');
      const p=simulation.particles[range.offset+i];p.pos=[...point];p.previous=[...point];p.velocity=[0,0,0];
    }
  }
  let authoringLockedParticleCount=0;
  for(const p of simulation.particles)if(!activePieces.has(p.pieceId)){p.invMass=0;authoringLockedParticleCount++;}
  simulation.dofs=createShortsStitchDofs(simulation.particles,{joinTolerance:simulation.options.stitchJoinToleranceM});
  const closed=[];
  for(const seam of simulation.seams)if(!state.report.closedSeamIds.includes(seam.id)){
    seam.start=Infinity;seam.progress=0;seam.needleIndex=0;seam.needleStart=null;
    for(const pair of seam.pairs){pair.started=false;pair.initialGap=null;pair.lambda=0;}
  }
  for(const id of state.report.closedSeamIds){
    const seam=simulation.seams.find(item=>item.id===id);if(!seam)fail('missing source seam '+id);let maximumGapM=0;
    for(const pair of seam.pairs){
      const a=simulation.particles[pair.a],b=simulation.particles[pair.b],gap=Math.hypot(...a.pos.map((v,k)=>v-b.pos[k]));maximumGapM=Math.max(maximumGapM,gap);
      if(gap>simulation.options.stitchJoinToleranceM)fail(id+' staged endpoints are not coincident: '+gap);
      pair.started=true;pair.initialGap=gap;a.previous=[...a.pos];b.previous=[...b.pos];
      if(!simulation.dofs.same(pair.a,pair.b)&&!simulation.dofs.join(pair.a,pair.b,{started:true,closureProgress:1,requirePreviousClosure:true}))fail(id+' source stitch could not join');
    }
    seam.progress=1;seam.start=0;seam.needleIndex=seam.pairs.length;seam.needleStart=null;closed.push({id,pairCount:seam.pairs.length,maximumGapM});
  }
  simulation.continuousContact=simulation.options.selfContact?createShortsContinuousContact(simulation.particles,simulation.triangleRecords,simulation.edges,{thickness:simulation.options.thickness,maxCandidates:simulation.options.maxSelfCandidates,dofs:simulation.dofs,motionLimit:true}):null;
  const activeTriangleRecords=simulation.triangleRecords.filter(record=>activePieces.has(record.pieceId));
  if(!activeTriangleRecords.length)fail('active dual-tube contact triangles are missing');
  simulation.surfaceContact=simulation.body?new ShortsSurfaceContact(simulation.particles,activeTriangleRecords,simulation.body,{clearanceM:simulation.options.thickness,toleranceM:.001,dofs:simulation.dofs,includeOnlyIncidentVertices:true}):null;
  simulation.triangleBodyContact=simulation.options.triangleBodyContact?new ShortsTriangleBodyContact(simulation.particles,activeTriangleRecords,simulation.body,{clearanceM:simulation.options.thickness,toleranceM:.001,dofs:simulation.dofs,maxCandidates:simulation.options.triangleBodyMaxCandidates,maxWitnessQueries:simulation.options.triangleBodyMaxWitnessQueries}):null;
  for(const support of simulation.temporarySupports){
    support.start=[...simulation.particles[support.index].pos];support.targetHeight=support.start[1];support.lambda=[0,0,0];
    if(!activePieces.has(simulation.particles[support.index].pieceId))support.active=false;
  }
  simulation._sync();
  const base={...state.report,sourceBefore,massBefore,closedSeams:closed,authoringLockedParticleCount,authoringLocksRemovable:true,otherSeamsStarted:false,
    bodyContactPieces:[...activePieces],inactiveBodyContactPieces:['G','WFL','WFR','WBR','WBL'],bodyContactTriangleCount:activeTriangleRecords.length};
  const report=auditShortsDualTubeR23(simulation,state,base);
  simulation.events.push({type:'r2.3_dual_leg_tube_checkpoint',stepIndex:simulation.stepIndex,closedSeams:closed.map(item=>item.id),leftCuffAreaM2:report.cuffs.left.projectedAreaM2,rightCuffAreaM2:report.cuffs.right.projectedAreaM2,valid:report.valid});
  return report;
}

function auditShortsDualTubeR23(simulation,state,baseReport={...state.report},options={}){
  const frame=state.report.bodyFrame,left=sd23CuffReport(simulation,frame,'FL','BL'),right=sd23CuffReport(simulation,frame,'FR','BR');
  const simulationReport=simulation.report(),material=simulationReport.material;
  const sourceAfter=JSON.stringify(simulation.particles.map(p=>({uv:p.uv,mass:p.mass,pieceId:p.pieceId}))),massAfter=simulation.particles.reduce((sum,p)=>sum+p.mass,0),dof=simulation.dofs.report();
  const closed=(baseReport.closedSeams||state.report.closedSeamIds.map(id=>{
    const seam=simulation.seams.find(item=>item.id===id);return {id,pairCount:seam.pairs.length,maximumGapM:Math.max(0,...seam.pairs.map(pair=>Math.hypot(...simulation.particles[pair.a].pos.map((v,k)=>v-simulation.particles[pair.b].pos[k]))))};
  }));
  const sourceIdentityPreserved=baseReport.sourceBefore?baseReport.sourceBefore===sourceAfter:true,totalMassPreserved=baseReport.massBefore===undefined||Math.abs(baseReport.massBefore-massAfter)<1e-12;
  const seamPairCount=closed.reduce((sum,item)=>sum+item.pairCount,0);
  const seamsClosed=closed.every(item=>item.maximumGapM<=simulation.options.stitchJoinToleranceM)&&state.report.closedSeamIds.every(id=>{
    const seam=simulation.seams.find(item=>item.id===id);return seam?.pairs.every(pair=>simulation.dofs.same(pair.a,pair.b));
  });
  const materialWithinCheckpoint=material.valid&&material.maxAbsPrincipalStrain<=.05;
  const bodyContactValidated=!!simulation.body&&simulationReport.surfaceContact?.passed===true&&simulationReport.triangleBodyContact?.passed===true&&simulationReport.bodyPenetrationM<=.001;
  const bodyRequirementMet=options.requireBody?bodyContactValidated:true;
  const strictCrossTube=sd23StrictCrossTubeIntersections(simulation),independentLegDofs=sd23IndependentLegDofs(simulation);
  const leftTubeFormed=left.projectedAreaM2>1e-4&&left.closureGapM<=simulation.options.stitchJoinToleranceM&&left.centroidLocal[0]<0;
  const rightTubeFormed=right.projectedAreaM2>1e-4&&right.closureGapM<=simulation.options.stitchJoinToleranceM&&right.centroidLocal[0]>0;
  const leftRightOwnership=left.centroidLocal[0]<0&&right.centroidLocal[0]>0&&right.centroidLocal[0]-left.centroidLocal[0]>.08;
  const cuffsValid=leftTubeFormed&&rightTubeFormed;
  const strictCrossTubeIntersectionFree=strictCrossTube.detected===0;
  const valid=state.report.sourceUnchanged&&sourceIdentityPreserved&&totalMassPreserved&&seamsClosed&&cuffsValid&&leftRightOwnership&&independentLegDofs&&strictCrossTubeIntersectionFree&&materialWithinCheckpoint&&bodyRequirementMet&&dof.joinedStitchCount===seamPairCount;
  return {...baseReport,stitchJoinToleranceM:simulation.options.stitchJoinToleranceM,valid,sourceIdentityPreserved,totalMassPreserved,closedSeams:closed,cuffs:{left,right},cuffsValid,leftRightOwnership,
    independentLegDofs,strictCrossTubeIntersectionFree,strictCrossTube,materialAtCheckpoint:material,materialCheckpointLimit:.05,materialWithinCheckpoint,
    joinedStitchCount:dof.joinedStitchCount,leftTubeFormed,rightTubeFormed,dualTubeGate:valid,relaxationSteps:simulation.stepIndex,
    bodyContactValidated,bodyRequirementMet,continuousSelfContactValidated:false,visualAcceptance:false,assemblyValidated:false,motionValidated:false,productionReady:false};
}

function sd23EllipseArcTable(aspect,segments){
  const cumulative=[0];let previous=[aspect,0],perimeter=0;
  for(let i=1;i<=segments;i++){
    const angle=2*Math.PI*i/segments,current=[aspect*Math.cos(angle),Math.sin(angle)];
    perimeter+=Math.hypot(current[0]-previous[0],current[1]-previous[1]);cumulative.push(perimeter);previous=current;
  }
  return {aspect,segments,cumulative,perimeter};
}
function sd23EllipseAngleAtFraction(table,fraction){
  let f=fraction%1;if(f<0)f+=1;if(Math.abs(fraction-1)<1e-12)f=1;
  const target=f*table.perimeter,c=table.cumulative;
  if(target<=0)return 0;if(target>=table.perimeter)return 2*Math.PI;
  let lo=0,hi=table.segments;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(c[mid]<target)lo=mid;else hi=mid;}
  const span=c[hi]-c[lo],t=span>0?(target-c[lo])/span:0;
  return 2*Math.PI*(lo+t)/table.segments;
}
function sd23CuffReport(simulation,frame,frontId,backId){
  const front=simulation.pattern.pieces.find(p=>p.id===frontId),back=simulation.pattern.pieces.find(p=>p.id===backId),fr=simulation.ranges.get(frontId),br=simulation.ranges.get(backId);
  const cuff=[...front.boundaries.hem.map(i=>simulation.particles[fr.offset+i].pos),...back.boundaries.hem.slice().reverse().map(i=>simulation.particles[br.offset+i].pos)];
  const local=point=>{const d=point.map((v,k)=>v-frame.origin[k]);return [d.reduce((s,v,k)=>s+v*frame.right[k],0),d.reduce((s,v,k)=>s+v*frame.up[k],0),d.reduce((s,v,k)=>s+v*frame.forward[k],0)];};
  const coordinates=cuff.map(local);let area=0;
  for(let i=0;i<coordinates.length;i++){const a=coordinates[i],b=coordinates[(i+1)%coordinates.length];area+=a[0]*b[2]-b[0]*a[2];}
  area=Math.abs(area)/2;
  const first=cuff[0],last=cuff.at(-1),closureGapM=Math.hypot(...first.map((v,k)=>v-last[k]));
  const centroidLocal=[0,1,2].map(k=>coordinates.reduce((sum,p)=>sum+p[k],0)/coordinates.length);
  return {panelIds:[frontId,backId],pointCount:cuff.length,projectedAreaM2:area,closureGapM,positiveArea:area>1e-4,centroidLocal};
}
function sd23IndependentLegDofs(simulation){
  const left=[],right=[];
  for(let i=0;i<simulation.particles.length;i++){
    const id=simulation.particles[i].pieceId;if(id==='FL'||id==='BL')left.push(i);else if(id==='FR'||id==='BR')right.push(i);
  }
  for(const a of left)for(const b of right)if(simulation.dofs.same(a,b))return false;
  return true;
}
function sd23StrictCrossTubeIntersections(simulation){
  const left=simulation.triangleRecords.filter(t=>t.pieceId==='FL'||t.pieceId==='BL'),right=simulation.triangleRecords.filter(t=>t.pieceId==='FR'||t.pieceId==='BR');
  let checkedCandidatePairs=0;
  for(const a of left){const ap=a.indices.map(i=>simulation.particles[i].pos),ab=sd23Bounds(ap);
    for(const b of right){const bp=b.indices.map(i=>simulation.particles[i].pos),bb=sd23Bounds(bp);if(!sd23BoundsOverlap(ab,bb,1e-9))continue;checkedCandidatePairs++;
      if(sd23TrianglesIntersect(ap,bp,1e-9))return {method:'cross-leg-triangle-edge-and-coplanar-test',detected:1,checkedCandidatePairs,firstPair:{leftPieceId:a.pieceId,rightPieceId:b.pieceId,leftIndices:[...a.indices],rightIndices:[...b.indices]}};
    }
  }
  return {method:'cross-leg-triangle-edge-and-coplanar-test',detected:0,checkedCandidatePairs,firstPair:null};
}
function sd23Bounds(points){return {min:[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...points.map(p=>p[k])))};}
function sd23BoundsOverlap(a,b,e){return a.min.every((v,k)=>v<=b.max[k]+e&&a.max[k]+e>=b.min[k]);}
function sd23Sub(a,b){return a.map((v,k)=>v-b[k]);}
function sd23Dot(a,b){return a.reduce((s,v,k)=>s+v*b[k],0);}
function sd23Cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function sd23SegmentTriangle(p0,p1,a,b,c,e){
  const direction=sd23Sub(p1,p0),edge1=sd23Sub(b,a),edge2=sd23Sub(c,a),h=sd23Cross(direction,edge2),det=sd23Dot(edge1,h);
  if(Math.abs(det)<=e)return false;const inv=1/det,s=sd23Sub(p0,a),u=inv*sd23Dot(s,h);if(u<-e||u>1+e)return false;
  const q=sd23Cross(s,edge1),v=inv*sd23Dot(direction,q);if(v<-e||u+v>1+e)return false;const t=inv*sd23Dot(edge2,q);return t>=-e&&t<=1+e;
}
function sd23TrianglesIntersect(a,b,e){
  const na=sd23Cross(sd23Sub(a[1],a[0]),sd23Sub(a[2],a[0])),nb=sd23Cross(sd23Sub(b[1],b[0]),sd23Sub(b[2],b[0]));
  const la=Math.hypot(...na),lb=Math.hypot(...nb);if(la<=e||lb<=e)return true;
  const da=b.map(p=>sd23Dot(na,sd23Sub(p,a[0]))/la),db=a.map(p=>sd23Dot(nb,sd23Sub(p,b[0]))/lb);
  if(da.every(v=>v>e)||da.every(v=>v<-e)||db.every(v=>v>e)||db.every(v=>v<-e))return false;
  const parallel=Math.hypot(...sd23Cross(na,nb))<=e*la*lb;
  if(parallel&&da.every(v=>Math.abs(v)<=e))return sd23CoplanarTrianglesIntersect(a,b,na,e);
  for(let i=0;i<3;i++)if(sd23SegmentTriangle(a[i],a[(i+1)%3],...b,e)||sd23SegmentTriangle(b[i],b[(i+1)%3],...a,e))return true;
  return false;
}
function sd23CoplanarTrianglesIntersect(a,b,normal,e){
  const axis=Math.abs(normal[0])>Math.abs(normal[1])?(Math.abs(normal[0])>Math.abs(normal[2])?0:2):(Math.abs(normal[1])>Math.abs(normal[2])?1:2),project=p=>axis===0?[p[1],p[2]]:axis===1?[p[0],p[2]]:[p[0],p[1]],aa=a.map(project),bb=b.map(project);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(sd23Segments2D(aa[i],aa[(i+1)%3],bb[j],bb[(j+1)%3],e))return true;
  return sd23PointInTriangle2D(aa[0],bb,e)||sd23PointInTriangle2D(bb[0],aa,e);
}
function sd23Orient2D(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function sd23Segments2D(a,b,c,d,e){
  const o1=sd23Orient2D(a,b,c),o2=sd23Orient2D(a,b,d),o3=sd23Orient2D(c,d,a),o4=sd23Orient2D(c,d,b);
  if(((o1>e&&o2<-e)||(o1<-e&&o2>e))&&((o3>e&&o4<-e)||(o3<-e&&o4>e)))return true;
  const on=(p,q,r)=>Math.abs(sd23Orient2D(p,q,r))<=e&&r[0]>=Math.min(p[0],q[0])-e&&r[0]<=Math.max(p[0],q[0])+e&&r[1]>=Math.min(p[1],q[1])-e&&r[1]<=Math.max(p[1],q[1])+e;
  return on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
}
function sd23PointInTriangle2D(p,t,e){
  const a=sd23Orient2D(t[0],t[1],p),b=sd23Orient2D(t[1],t[2],p),c=sd23Orient2D(t[2],t[0],p),negative=a<-e||b<-e||c<-e,positive=a>e||b>e||c>e;return !(negative&&positive);
}
