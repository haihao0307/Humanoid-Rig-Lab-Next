/* R2 is the only body construction. The small source atlas correspondence is
 * stored as joint parameters; surface vertices exist only in the worker/GPU. */
const R2_RIG=/*__R2_RIG_JSON__*/;
const R2_REGIONS=/*__R2_REGIONS_JSON__*/;
const BODY_SEX='male';
const r2Position=id=>R2_RIG.nodes[id].positionM;
const r2Length=(a,b)=>dist(r2Position(a),r2Position(b));
const r2Mean=(f)=>['left','right'].reduce((n,s)=>n+f(s),0)/2;
const ADULT_RIG=Object.freeze({
  femurLengthM:r2Mean(s=>r2Length(s+'_femur',s+'_tibia')),
  tibiaLengthM:r2Mean(s=>r2Length(s+'_tibia',s+'_foot')),
  humerusLengthM:r2Mean(s=>r2Length(s+'_upperArm',s+'_forearm')),
  forearmLengthM:r2Mean(s=>r2Length(s+'_forearm',s+'_hand')),
  hipSpacingM:r2Length('left_femur','right_femur'),elbowFlexionSign:-1,kneeFlexionSign:1
});
const SKIN_SOLE_HEIGHT=r2Mean(s=>r2Position(s+'_foot')[1])-R2_RIG.sourceFloorM;
const REST_HIP_HEIGHT=r2Position('hips')[1]-R2_RIG.sourceFloorM;
const LEG_REST_REACH=r2Mean(s=>r2Length(s+'_femur',s+'_foot'));
const ADULT_STANCE=Object.freeze({ankleHeightM:SKIN_SOLE_HEIGHT,
  footHalfSpacingM:r2Mean(s=>Math.abs(r2Position(s+'_foot')[0])),
  ankleForwardM:r2Mean(s=>r2Position(s+'_foot')[2])-r2Position('hips')[2],
  kneeFlexionDeg:0,elbowFlexionDeg:0,armAbductionDeg:0,palmTurnDeg:0});
const ADULT_SPEC=Object.freeze({statureM:R2_RIG.sourceHeightM,rig:ADULT_RIG,stance:ADULT_STANCE,
  rigShapeSignature:R2_RIG.source.sourceFileSHA256,baseline:R2_RIG.status});
const ANATOMY=Object.freeze({schema:'r2/source-anatomy@1',version:'1.17.0',units:'m',
  heightTarget:ADULT_SPEC.statureM,femurLength:ADULT_RIG.femurLengthM,tibiaLength:ADULT_RIG.tibiaLengthM,
  humerusLength:ADULT_RIG.humerusLengthM,forearmLength:ADULT_RIG.forearmLengthM,
  hipSpacing:ADULT_RIG.hipSpacingM,shoulderWidth:r2Length('left_upperArm','right_upperArm'),
  sourceIds:['BodyParts3D'],parameterStatus:R2_RIG.status,medicalValidation:false});
const limbFlexionSign=kind=>kind==='arm'?-1:1;
const SKIN_CONTACT_PALM=Object.freeze([0,-r2Mean(s=>r2Length(s+'_hand',s+'_finger_3_1'))*.55,0]);

function r2SourceFrames(reference=R2_RIG){
  const r2Position=id=>reference.nodes[id].positionM;
  const frames=new Map();
  for(const [id,n]of Object.entries(reference.nodes)){
    const target=n.target?r2Position(n.target):n.tipM;
    frames.set(id,frame(n.positionM,target?fromTo(DOWN,sub(target,n.positionM)):qi()));
  }
  for(const side of ['left','right'])for(const [kind,a,b,c]of [
    ['arm','upperArm','forearm','hand'],['leg','femur','tibia','foot']]){
    const A=frames.get(side+'_'+a),B=frames.get(side+'_'+b),C=frames.get(side+'_'+c);
    const U=norm(sub(B.p,A.p)),W=norm(sub(C.p,B.p)),bend=Math.acos(clamp(dot(U,W),-1,1));
    // A nearly straight atlas knee does not define an anatomical sagittal
    // plane. Its small lateral bow previously turned both hip frames backwards.
    // Use the pelvis left-to-right axis, retaining the measured joint centres
    // and the small static alignment in the knee's bind rotation.
    if(kind==='leg'){
      const lateral=norm(sub(r2Position('right_femur'),r2Position('left_femur')));
      const anatomicalFrame=direction=>{
        const Y=mul(direction,-1),X=norm(sub(lateral,mul(Y,dot(lateral,Y)))),Z=norm(cross(X,Y));
        return qb(X,Y,Z);
      };
      A.q=anatomicalFrame(U);B.q=anatomicalFrame(W);
    }else{
      let X=cross(U,W);if(len(X)<1e-7)X=cross(U,[0,0,1]);
      X=mul(norm(X),limbFlexionSign(kind));const Y=mul(U,-1),Z=norm(cross(X,Y));
      A.q=qb(X,Y,Z);B.q=qm(A.q,qx(limbFlexionSign(kind)*bend));
    }
    if(kind==='arm')frames.get(side+'_radiusRotation').q=[...B.q];
  }
  return frames;
}

function buildReconstructionRig(h){
  h.resolvedRig=resolveCharacterRig(h.characterPreset.shape);h.bodyMetrics=resolveCharacterMetrics(h.resolvedRig);
  const reference=h.resolvedRig,r2Position=id=>reference.nodes[id].positionM,r2Length=(a,b)=>dist(r2Position(a),r2Position(b));
  h.canonicalSourceBind=r2SourceFrames();h.sourceBind=r2SourceFrames(reference);
  const stage=[0,-reference.sourceFloorM,1.75-r2Position('hips')[2]];
  h.reconstructionStage=stage;
  for(const [id,n]of Object.entries(reference.nodes)){
    const source=h.sourceBind.get(id),parent=n.parent&&h.sourceBind.get(n.parent);
    const p=parent?rotate(inv(parent.q),sub(source.p,parent.p)):add(source.p,stage);
    const j=h.joint(id,n.parent,p);j.q=parent?qm(inv(parent.q),source.q):source.q.slice();
    j.sourceRestQ=j.q.slice();j.bindQ=j.q.slice();j.region=n.region;
    // These hinge angles are measured relative to a straight segment pair.
    if(/_(forearm|radiusRotation)$/.test(id))j.bindQ=qi();
    if(n.target)j.segmentLength=r2Length(id,n.target);else if(n.tipM)j.segmentLength=dist(n.positionM,n.tipM);
    if(n.region)h.spine.push(j);
    h.records.push({id,jointId:id,parent:n.parent,source:n.sourcePartIds,status:n.method});
  }
  h.root=h.byId.get('hips');h.rootHeight=h.bodyMetrics.restHipHeightM;
  for(const side of ['left','right']){
    const get=x=>h.byId.get(side+'_'+x),s=side==='left'?-1:1;
    h.shoulders[side]={sc:get('SC'),ac:get('AC')};
    h.arms[side]={kind:'arm',s,upper:get('upperArm'),elbow:get('forearm'),radial:get('radiusRotation'),wrist:get('hand'),
      L1:r2Length(side+'_upperArm',side+'_forearm'),L2:r2Length(side+'_forearm',side+'_hand')};
    h.legs[side]={kind:'leg',s,upper:get('femur'),elbow:get('tibia'),wrist:get('foot'),
      L1:r2Length(side+'_femur',side+'_tibia'),L2:r2Length(side+'_tibia',side+'_foot'),footRays:[]};
    for(let f=0;f<5;f++){
      const thumb=f===0,ph=Array.from({length:thumb?2:3},(_,k)=>get('finger_'+(f+1)+'_'+(k+1)));
      h.fingers.push({side,f,thumb,mc:get('metacarpal_'+(f+1)),ph});
      h.legs[side].footRays.push({mc:get('metatarsal_'+(f+1)),toes:Array.from({length:thumb?2:3},(_,k)=>get('toe_'+(f+1)+'_'+(k+1)))});
    }
  }
  h.bindLengths=h.joints.filter(j=>j.parent).map(j=>({id:j.id,length:len(j.p)}));
  h.evidence={boneElements:0,kinematicNodes:h.joints.length,geometryHash:h.bodyMetrics.geometryKey,sourceGeometryHash:R2_RIG.source.sourceFileSHA256,shape:structuredClone(reference.shape),
    externalMeshCount:0,runtimeBoneScaleCount:0,anatomicalValidation:false,source:R2_RIG.source,
    jointCentreBasis:R2_RIG.status,softTissueMotionMeasured:false};
  h.fk();h.reconstructionNeutral={frames:new Map(h.joints.map(j=>[j.id,frame(j.world.p,j.world.q)])),rootPosition:h.root.p.slice()};
}
