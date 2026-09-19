/* R2.2 authoring placement for the original nine-piece shorts paper.
 * The routine computes an orthonormal pelvis frame from the final Human rig,
 * rigidly maps every source panel into that frame, and lays the independent
 * gusset horizontally below the measured crotch. It changes placement only:
 * source UVs, triangles, masses, seam maps and the Human rig remain untouched.
 * This is a review stage, not a formed garment or a wearable result. */
const SHORTS_PLACEMENT_R2_VERSION='shorts-r2.2-final-pose-rigid-placement-1';

function applyShortsRigidPlacementR2(pattern,body,human,options={}){
  if(pattern?.r2PlacementReport)return pattern.r2PlacementReport;
  const fail=message=>{throw Error('shorts-r2-placement: '+message);};
  const finite3=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
  const sub3=(a,b)=>a.map((value,index)=>value-b[index]);
  const add3=(a,b)=>a.map((value,index)=>value+b[index]);
  const mul3=(a,scale)=>a.map(value=>value*scale);
  const dot3=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);
  const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const length3=value=>Math.hypot(...value);
  const unit=value=>{const length=length3(value);if(!(length>1e-10))fail('degenerate body frame axis');return value.map(x=>x/length);};
  const rotateQ=(q,p)=>{const v=[q[0],q[1],q[2]],t=mul3(cross3(v,p),2);return add3(p,add3(mul3(t,q[3]),cross3(v,t)));};
  if(!pattern||!Array.isArray(pattern.pieces)||pattern.pieces.length!==9)fail('the original nine-piece pattern is required');
  if(!body||typeof body.measure!=='function'||!human?.sourceBind||!human?.byId)fail('actual body and final Human rig are required');
  body.update?.();
  const measurements=body.measure(),sourceBind=human.sourceBind;
  const frameAt=source=>{
    const get=id=>source?sourceBind.get(id):human.byId.get(id)?.world;
    const hips=get('hips'),left=get('left_femur'),right=get('right_femur');
    const anchorId=['T12','T8','L1','C7','head'].find(id=>get(id));
    const anchor=anchorId&&get(anchorId);
    if(!hips||!left||!right||!anchor||![hips.p,left.p,right.p,anchor.p].every(finite3))fail('hips, both femurs and a torso anchor are required');
    const axisRight=unit(sub3(right.p,left.p));
    let upRaw=sub3(anchor.p,hips.p);upRaw=sub3(upRaw,mul3(axisRight,dot3(upRaw,axisRight)));
    let axisUp=unit(upRaw),axisForward=unit(cross3(axisRight,axisUp));
    const poseForward=finite3(hips.q)&&hips.q.length===4?rotateQ(hips.q,[0,0,1]):axisForward;
    if(dot3(axisForward,poseForward)<0)axisForward=mul3(axisForward,-1);
    axisUp=unit(cross3(axisForward,axisRight));
    return {origin:[...hips.p],right:axisRight,up:axisUp,forward:axisForward,anchorId};
  };
  const source=frameAt(true),current=frameAt(false);
  const local=(point,frame)=>{const d=sub3(point,frame.origin);return [dot3(d,frame.right),dot3(d,frame.up),dot3(d,frame.forward)];};
  const world=(coordinate,frame)=>add3(frame.origin,add3(mul3(frame.right,coordinate[0]),add3(mul3(frame.up,coordinate[1]),mul3(frame.forward,coordinate[2]))));
  const mapPoint=point=>world(local(point,source),current);
  const mapVector=vector=>world([dot3(vector,source.right),dot3(vector,source.up),dot3(vector,source.forward)],{...current,origin:[0,0,0]});
  const sideGap=options.sideGapM??.008,gussetDrop=options.gussetDropM??Math.max(.025,(pattern.options?.gussetWidth??.06)*.55);
  if(!Number.isFinite(sideGap)||sideGap<0||sideGap>.04||!Number.isFinite(gussetDrop)||gussetDrop<=0||gussetDrop>.10)fail('invalid R2.2 review clearances');
  const sourceIdentity=JSON.stringify(pattern.pieces.map(piece=>({id:piece.id,uv:piece.materialCoordinates,triangles:piece.triangles,boundaries:piece.boundaries})));
  const pieces=new Map(pattern.pieces.map(piece=>[piece.id,piece]));
  for(const id of ['FL','BL','FR','BR','G','WFL','WFR','WBR','WBL'])if(!pieces.has(id))fail('missing source panel '+id);
  for(const piece of pattern.pieces){
    const placement=piece.placement;if(!placement||![placement.origin,placement.basisU,placement.basisV].every(finite3))fail(piece.id+' has no rigid source placement');
    placement.origin=mapPoint(placement.origin);placement.basisU=unit(mapVector(placement.basisU));placement.basisV=unit(mapVector(placement.basisV));
    if(Math.abs(dot3(placement.basisU,placement.basisV))>1e-8)fail(piece.id+' rigid basis lost orthogonality');
    if(piece.kind==='leg-panel')placement.origin=add3(placement.origin,mul3(current.right,piece.side==='left'?-sideGap:sideGap));
    placement.method='r2.2_final_pose_pelvis_frame_rigid_review';placement.sourceShapeUnchanged=true;placement.reviewOnly=true;
  }
  const gusset=pieces.get('G'),centre=measurements.waistCenter,meta=measurements.metadata;
  if(!finite3(centre)||!Number.isFinite(meta?.crotchY))fail('measured crotch and waist centre are required');
  const crotchWorld=mapPoint([centre[0],meta.crotchY,centre[2]]);
  gusset.placement.origin=add3(crotchWorld,mul3(current.up,-gussetDrop));
  gusset.placement.basisU=[...current.right];gusset.placement.basisV=mul3(current.forward,-1);
  gusset.placement.method='r2.2_horizontal_crotch_bridge_review_workspace';
  gusset.placement.gussetDropM=gussetDrop;gusset.placement.reviewOnly=true;

  const pieceReports=[];
  for(const piece of pattern.pieces){
    const p=piece.placement,positions=piece.materialCoordinates.map(uv=>add3(p.origin,add3(mul3(p.basisU,uv[0]),mul3(p.basisV,uv[1])))),
      coordinates=positions.map(point=>local(point,current)),centroid=[0,1,2].map(axis=>coordinates.reduce((sum,value)=>sum+value[axis],0)/coordinates.length),
      bounds={right:[Math.min(...coordinates.map(v=>v[0])),Math.max(...coordinates.map(v=>v[0]))],up:[Math.min(...coordinates.map(v=>v[1])),Math.max(...coordinates.map(v=>v[1]))],front:[Math.min(...coordinates.map(v=>v[2])),Math.max(...coordinates.map(v=>v[2]))]};
    let ownership=true;
    if(piece.kind==='leg-panel')ownership=(piece.side==='left'?centroid[0]<0:centroid[0]>0)&&(piece.bodySide==='front'?centroid[2]>0:centroid[2]<0);
    if(piece.kind==='waistband'){
      const parent=pieces.get(piece.parentPanel),side=parent?.side,front=parent?.bodySide==='front';
      ownership=!!parent&&(side==='left'?centroid[0]<0:centroid[0]>0)&&(front?centroid[2]>0:centroid[2]<0);
    }
    pieceReports.push({id:piece.id,role:piece.kind,side:piece.side??null,bodySide:piece.bodySide??null,centroid,bounds,ownershipCorrect:ownership,
      basisDot:dot3(p.basisU,p.basisV),basisULength:length3(p.basisU),basisVLength:length3(p.basisV)});
  }
  const gRange=pattern.pieces.reduce((sum,piece)=>sum+piece.materialCoordinates.length,0),gPositions=index=>{
    const uv=gusset.materialCoordinates[index],p=gusset.placement;return local(add3(p.origin,add3(mul3(p.basisU,uv[0]),mul3(p.basisV,uv[1]))),current);
  },gLandmarks=Object.fromEntries(Object.entries(gusset.landmarks).map(([name,index])=>[name,gPositions(index)]));
  const gussetOrder=gLandmarks.left[0]<0&&gLandmarks.right[0]>0&&gLandmarks.front[2]>0&&gLandmarks.back[2]<0;
  const sourceUnchanged=sourceIdentity===JSON.stringify(pattern.pieces.map(piece=>({id:piece.id,uv:piece.materialCoordinates,triangles:piece.triangles,boundaries:piece.boundaries})));
  const bodyRegionCounts={left_leg:0,right_leg:0,pelvis_front:0,pelvis_back:0,crotch_bridge:0,unassigned:0};
  const crotchLocal=local(crotchWorld,current),hipHalf=Math.max(.04,(Math.abs(local(human.byId.get('right_femur').world.p,current)[0]-local(human.byId.get('left_femur').world.p,current)[0]))/2);
  for(const node of body.nodes||[]){
    const point=finite3(node.current)?node.current:node.rest;if(!finite3(point)){bodyRegionCounts.unassigned++;continue;}
    const c=local(point,current),weights={left:0,right:0,pelvis:0};
    for(const [jointIndex,weight]of node.influences||[]){const id=human.joints[jointIndex]?.id||'';if(/^left_(?:femur|tibia|foot)/.test(id))weights.left+=weight;else if(/^right_(?:femur|tibia|foot)/.test(id))weights.right+=weight;else if(id==='hips'||human.spine?.some(joint=>joint.id===id))weights.pelvis+=weight;}
    if(Math.abs(c[0])<hipHalf*.34&&Math.abs(c[1]-crotchLocal[1])<.075&&weights.left+weights.right>.25)bodyRegionCounts.crotch_bridge++;
    else if(weights.left>Math.max(weights.right,weights.pelvis*.55))bodyRegionCounts.left_leg++;
    else if(weights.right>Math.max(weights.left,weights.pelvis*.55))bodyRegionCounts.right_leg++;
    else if(weights.pelvis>.1)bodyRegionCounts[c[2]>=0?'pelvis_front':'pelvis_back']++;
    else bodyRegionCounts.unassigned++;
  }
  const valid=sourceUnchanged&&gussetOrder&&pieceReports.every(report=>report.ownershipCorrect&&Math.abs(report.basisDot)<1e-8&&Math.abs(report.basisULength-1)<1e-8&&Math.abs(report.basisVLength-1)<1e-8);
  const report={version:SHORTS_PLACEMENT_R2_VERSION,stage:'R2.2 rigid source-panel placement only',valid,sourceUnchanged,
    visualAcceptance:false,assemblyValidated:false,motionValidated:false,sewingActivated:false,bodyFrame:{source,current},clearances:{sideGapM:sideGap,gussetDropM:gussetDrop},
    pieces:pieceReports,gussetLandmarks:gLandmarks,gussetOrderCorrect:gussetOrder,bodyRegions:bodyRegionCounts,
    sourceVertexCount:gRange,formedShapeTargets:false,permanentLegAnchors:false};
  pattern.r2PlacementReport=report;return report;
}
