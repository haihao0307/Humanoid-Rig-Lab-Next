/* Source-only garment contract for the original nine-piece shorts pattern.
 * This module classifies material panels, boundaries, directed seams and the
 * permitted assembly order. It does not move cloth, change paper coordinates,
 * provide a formed garment shell, or claim body/visual acceptance. */
const SHORTS_GARMENT_CONTRACT_VERSION='shorts-two-leg-garment-contract-1';

function createShortsGarmentContract(pattern){
  const fail=message=>{throw Error('shorts-garment-contract: '+message);};
  if(!pattern||!Array.isArray(pattern.pieces)||!Array.isArray(pattern.seams))fail('pattern pieces and seams are required');
  if(pattern.unit!=='m')fail('source pattern must explicitly use metres');
  const finite2=value=>Array.isArray(value)&&value.length===2&&value.every(Number.isFinite);
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const sameArray=(a,b)=>a.length===b.length&&a.every((value,index)=>value===b[index]);
  const panelSpec={
    FL:{role:'leg_panel',legOwner:'left',bodySide:'front',kind:'leg-panel',side:'left'},
    BL:{role:'leg_panel',legOwner:'left',bodySide:'back',kind:'leg-panel',side:'left'},
    FR:{role:'leg_panel',legOwner:'right',bodySide:'front',kind:'leg-panel',side:'right'},
    BR:{role:'leg_panel',legOwner:'right',bodySide:'back',kind:'leg-panel',side:'right'},
    G:{role:'crotch_bridge',legOwner:'bridge',bodySide:'center',kind:'gusset'},
    WFL:{role:'waistband',legOwner:'waist',bodySide:'front',kind:'waistband',parentPanel:'FL'},
    WFR:{role:'waistband',legOwner:'waist',bodySide:'front',kind:'waistband',parentPanel:'FR'},
    WBR:{role:'waistband',legOwner:'waist',bodySide:'back',kind:'waistband',parentPanel:'BR'},
    WBL:{role:'waistband',legOwner:'waist',bodySide:'back',kind:'waistband',parentPanel:'BL'}
  };
  const expectedPanelIds=Object.keys(panelSpec),pieceById=new Map();
  for(const piece of pattern.pieces){
    if(!piece||typeof piece.id!=='string'||pieceById.has(piece.id))fail('duplicate or invalid panel id');
    pieceById.set(piece.id,piece);
  }
  if(pieceById.size!==expectedPanelIds.length||expectedPanelIds.some(id=>!pieceById.has(id)))
    fail('the contract requires exactly FL, BL, FR, BR, G and four waistband panels');
  const panels=[];
  for(const id of expectedPanelIds){
    const piece=pieceById.get(id),spec=panelSpec[id];
    if(piece.kind!==spec.kind)fail(id+' has the wrong material role');
    if(spec.side!==undefined&&piece.side!==spec.side)fail(id+' has contradictory leg ownership');
    if(spec.role==='leg_panel'&&piece.bodySide!==spec.bodySide)fail(id+' has contradictory front/back ownership');
    if(spec.parentPanel!==undefined&&piece.parentPanel!==spec.parentPanel)fail(id+' has the wrong parent waist sector');
    if(!Array.isArray(piece.materialCoordinates)||!piece.materialCoordinates.length||piece.materialCoordinates.some(uv=>!finite2(uv)))
      fail(id+' has invalid original material coordinates');
    if(!Array.isArray(piece.triangles)||!piece.triangles.length)fail(id+' has no original material triangles');
    const boundaries={};
    for(const [name,indices] of Object.entries(piece.boundaries||{})){
      if(!Array.isArray(indices)||indices.length<2||indices.some(index=>!Number.isInteger(index)||index<0||index>=piece.materialCoordinates.length))
        fail(id+'.'+name+' has an invalid material boundary');
      boundaries[name]=indices.slice();
    }
    const required=spec.role==='leg_panel'?['waist','outseam','hem','inseam','rise','gusset']:
      spec.role==='crotch_bridge'?['frontLeft','frontRight','backLeft','backRight']:['lower','upper','start','end'];
    if(required.some(name=>!boundaries[name]))fail(id+' is missing a required boundary');
    panels.push({id,role:spec.role,legOwner:spec.legOwner,bodySide:spec.bodySide,parentPanel:spec.parentPanel??null,
      sourceVertexCount:piece.materialCoordinates.length,sourceTriangleCount:piece.triangles.length,
      grainWarp:Array.isArray(piece.grainDirection)?piece.grainDirection.slice():null,
      grainWeft:Array.isArray(piece.grainDirection)?[-piece.grainDirection[1],piece.grainDirection[0]]:null,
      rightSide:piece.placement?.rightSide??null,boundaries});
  }

  const seamSpec={
    'center-front':{a:'FL',ae:'rise',b:'FR',be:'rise',stage:'JOIN_FRONT_RISE'},
    'center-back':{a:'BL',ae:'rise',b:'BR',be:'rise',stage:'JOIN_BACK_RISE'},
    'gusset-FL':{a:'FL',ae:'gusset',b:'G',be:'frontLeft',stage:'INSERT_GUSSET'},
    'gusset-FR':{a:'FR',ae:'gusset',b:'G',be:'frontRight',stage:'INSERT_GUSSET'},
    'gusset-BL':{a:'BL',ae:'gusset',b:'G',be:'backLeft',stage:'INSERT_GUSSET'},
    'gusset-BR':{a:'BR',ae:'gusset',b:'G',be:'backRight',stage:'INSERT_GUSSET'},
    'inseam-left':{a:'FL',ae:'inseam',b:'BL',be:'inseam',stage:'FORM_LEFT_LEG_TUBE'},
    'inseam-right':{a:'FR',ae:'inseam',b:'BR',be:'inseam',stage:'FORM_RIGHT_LEG_TUBE'},
    'outseam-left':{a:'FL',ae:'outseam',b:'BL',be:'outseam',stage:'FORM_LEFT_LEG_TUBE'},
    'outseam-right':{a:'FR',ae:'outseam',b:'BR',be:'outseam',stage:'FORM_RIGHT_LEG_TUBE'},
    'side-opening-left':{a:'FL',ae:'outseam',b:'BL',be:'outseam',stage:'CLOSE_SIDE_OPENING'},
    'waist-FL':{a:'FL',ae:'waist',b:'WFL',be:'lower',stage:'ATTACH_WAISTBAND'},
    'waist-FR':{a:'FR',ae:'waist',b:'WFR',be:'lower',stage:'ATTACH_WAISTBAND'},
    'waist-BR':{a:'BR',ae:'waist',b:'WBR',be:'lower',stage:'ATTACH_WAISTBAND'},
    'waist-BL':{a:'BL',ae:'waist',b:'WBL',be:'lower',stage:'ATTACH_WAISTBAND'},
    'waistband-FL-FR':{a:'WFL',ae:'end',b:'WFR',be:'start',stage:'ATTACH_WAISTBAND'},
    'waistband-FR-BR':{a:'WFR',ae:'end',b:'WBR',be:'start',stage:'ATTACH_WAISTBAND'},
    'waistband-BR-BL':{a:'WBR',ae:'end',b:'WBL',be:'start',stage:'ATTACH_WAISTBAND'},
    'waistband-BL-FL':{a:'WBL',ae:'end',b:'WFL',be:'start',stage:'CLOSE_SIDE_OPENING'}
  };
  const expectedSeamIds=Object.keys(seamSpec),seamById=new Map();
  for(const seam of pattern.seams){
    if(!seam||typeof seam.id!=='string'||seamById.has(seam.id))fail('duplicate or invalid seam id');
    seamById.set(seam.id,seam);
  }
  if(seamById.size!==expectedSeamIds.length||expectedSeamIds.some(id=>!seamById.has(id)))
    fail('the source pattern must contain exactly the 19 declared shorts seams');

  const directedSeams=[];
  for(const id of expectedSeamIds){
    const seam=seamById.get(id),spec=seamSpec[id];
    if(seam.a?.pieceId!==spec.a||seam.a?.edge!==spec.ae||seam.b?.pieceId!==spec.b||seam.b?.edge!==spec.be)
      fail(id+' has a reversed, cross-leg or mislabelled source boundary');
    if(!Array.isArray(seam.pairs)||seam.pairs.length<2)fail(id+' has no directed stitch samples');
    const aPiece=pieceById.get(spec.a),bPiece=pieceById.get(spec.b),segments=[];
    let totalA=0,totalB=0,previousT=-Infinity;
    for(let i=0;i<seam.pairs.length;i++){
      const pair=seam.pairs[i];
      if(!Number.isInteger(pair.a)||pair.a<0||pair.a>=aPiece.materialCoordinates.length||
         !Number.isInteger(pair.b)||pair.b<0||pair.b>=bPiece.materialCoordinates.length||
         !Number.isFinite(pair.t)||pair.t<0||pair.t>1||pair.t<=previousT)
        fail(id+' has an invalid or non-monotone directed stitch map');
      previousT=pair.t;
      if(i===0)continue;
      const before=seam.pairs[i-1],lengthA=distance(aPiece.materialCoordinates[before.a],aPiece.materialCoordinates[pair.a]),
        lengthB=distance(bPiece.materialCoordinates[before.b],bPiece.materialCoordinates[pair.b]);
      if(!(lengthA>0&&lengthB>0))fail(id+' contains a zero-length stitch interval');
      const feedRatio=lengthA/lengthB;
      if(!Number.isFinite(feedRatio)||Math.abs(feedRatio-1)>1e-8)fail(id+' changes local material feed without an explicit gathering contract');
      totalA+=lengthA;totalB+=lengthB;
      segments.push({t0:before.t,t1:pair.t,a0:before.a,a1:pair.a,b0:before.b,b1:pair.b,lengthA,lengthB,feedRatio});
    }
    if(Math.abs(seam.pairs[0].t)>1e-12||Math.abs(seam.pairs.at(-1).t-1)>1e-12)fail(id+' must map both seam endpoints');
    if(Math.abs(totalA-totalB)>1e-10||Math.abs(totalA-seam.restLengthA)>1e-10||Math.abs(totalB-seam.restLengthB)>1e-10)
      fail(id+' does not preserve original edge length');
    const middle=seam.pairs.reduce((best,pair,index)=>Math.abs(pair.t-.5)<Math.abs(seam.pairs[best].t-.5)?index:best,0);
    directedSeams.push({id,kind:seam.kind,stageId:spec.stage,direction:'declared_a_to_b_pair_order',
      a:{panelId:spec.a,boundary:spec.ae,indices:seam.a.indices.slice()},
      b:{panelId:spec.b,boundary:spec.be,indices:seam.b.indices.slice()},
      endpointMap:[{t:0,a:seam.pairs[0].a,b:seam.pairs[0].b},{t:1,a:seam.pairs.at(-1).a,b:seam.pairs.at(-1).b}],
      notchMap:[{name:'start',pairIndex:0,t:0},{name:'balance',pairIndex:middle,t:seam.pairs[middle].t},{name:'end',pairIndex:seam.pairs.length-1,t:1}],
      segments,restLengthA:totalA,restLengthB:totalB,maximumLocalFeedError:Math.max(0,...segments.map(segment=>Math.abs(segment.feedRatio-1))),
      activation:'only_after_preceding_stage_gate',closure:'sustained_spatial_dof_join_not_elapsed_time'});
  }

  const requireOwners=(seamId,owners)=>{
    const seam=directedSeams.find(candidate=>candidate.id===seamId),actual=[panelSpec[seam.a.panelId].legOwner,panelSpec[seam.b.panelId].legOwner];
    if(!sameArray(actual,owners))fail(seamId+' violates material ownership');
  };
  requireOwners('inseam-left',['left','left']);requireOwners('outseam-left',['left','left']);requireOwners('side-opening-left',['left','left']);
  requireOwners('inseam-right',['right','right']);requireOwners('outseam-right',['right','right']);
  requireOwners('center-front',['left','right']);requireOwners('center-back',['left','right']);
  for(const [id,owner] of [['gusset-FL','left'],['gusset-BL','left'],['gusset-FR','right'],['gusset-BR','right']])requireOwners(id,[owner,'bridge']);

  const stageDefs=[
    {id:'SOURCE_AUDIT',seams:[],requires:[]},
    {id:'PLACE_LEFT_AND_RIGHT_PANEL_SETS',seams:[],requires:['SOURCE_AUDIT']},
    {id:'FORM_LEFT_LEG_TUBE',seams:['outseam-left','inseam-left'],requires:['PLACE_LEFT_AND_RIGHT_PANEL_SETS']},
    {id:'FORM_RIGHT_LEG_TUBE',seams:['outseam-right','inseam-right'],requires:['PLACE_LEFT_AND_RIGHT_PANEL_SETS']},
    {id:'VERIFY_TWO_LEG_TUBES',seams:[],requires:['FORM_LEFT_LEG_TUBE','FORM_RIGHT_LEG_TUBE']},
    {id:'JOIN_FRONT_RISE',seams:['center-front'],requires:['VERIFY_TWO_LEG_TUBES']},
    {id:'JOIN_BACK_RISE',seams:['center-back'],requires:['JOIN_FRONT_RISE']},
    {id:'INSERT_GUSSET',seams:['gusset-FL','gusset-FR','gusset-BL','gusset-BR'],requires:['JOIN_BACK_RISE']},
    {id:'ATTACH_WAISTBAND',seams:['waist-FL','waist-FR','waist-BR','waist-BL','waistband-FL-FR','waistband-FR-BR','waistband-BR-BL'],requires:['INSERT_GUSSET']},
    {id:'CLOSE_SIDE_OPENING',seams:['side-opening-left','waistband-BL-FL'],requires:['ATTACH_WAISTBAND']},
    {id:'QUASI_STATIC_SETTLE',seams:[],requires:['CLOSE_SIDE_OPENING']},
    {id:'STATIC_VISUAL_GATE',seams:[],requires:['QUASI_STATIC_SETTLE']},
    {id:'MOTION_GATE',seams:[],requires:['STATIC_VISUAL_GATE']}
  ];
  const assigned=stageDefs.flatMap(stage=>stage.seams);
  if(assigned.length!==expectedSeamIds.length||new Set(assigned).size!==expectedSeamIds.length||expectedSeamIds.some(id=>!assigned.includes(id)))
    fail('every source seam must belong to exactly one assembly stage');
  for(const stage of stageDefs)for(const seamId of stage.seams)
    if(directedSeams.find(seam=>seam.id===seamId).stageId!==stage.id)fail(seamId+' has contradictory stage metadata');

  const topology=typeof auditShortsPatternTopology==='function'?auditShortsPatternTopology(pattern,true):pattern.checks?.topologyAfterAllClosures;
  if(!topology||topology.valid!==true||topology.boundaryLoops!==3||topology.eulerCharacteristic!==-1||topology.nonManifoldEdges!==0)
    fail('closed source seam quotient must have one waist and two leg openings');

  const legTubes={
    left:{panels:['FL','BL'],formingSeams:['outseam-left','inseam-left'],cuffBoundaries:[{panelId:'FL',boundary:'hem'},{panelId:'BL',boundary:'hem'}],
      bodyRegion:'left_leg',mustRemainDisjointFrom:'right'},
    right:{panels:['FR','BR'],formingSeams:['outseam-right','inseam-right'],cuffBoundaries:[{panelId:'FR',boundary:'hem'},{panelId:'BR',boundary:'hem'}],
      bodyRegion:'right_leg',mustRemainDisjointFrom:'left'}
  };
  return {schema:SHORTS_GARMENT_CONTRACT_VERSION,unit:'m',sourcePatternVersion:pattern.version,
    status:'source_contract_only_not_assembled_or_visually_accepted',panels,directedSeams,legTubes,
    crotchBridge:{panelId:'G',frontLeft:'gusset-FL',frontRight:'gusset-FR',backLeft:'gusset-BL',backRight:'gusset-BR',
      activationAfter:['FORM_LEFT_LEG_TUBE','FORM_RIGHT_LEG_TUBE','JOIN_FRONT_RISE','JOIN_BACK_RISE']},
    assemblyStages:stageDefs.map((stage,index)=>({...stage,index,advanceWhen:'explicit_stage_gate_passes'})),
    finalTopology:{waistLoops:1,legOpeningLoops:2,boundaryLoops:3,eulerCharacteristic:-1,nonManifoldEdges:0},
    invariants:{sourceUVImmutable:true,sourceTrianglesImmutable:true,sourceMassImmutable:true,permanentLegAnchors:false,
      formedShapeTargets:false,bodySegmentationRequired:true,continuousCollisionRequired:true,rollbackOnGateFailure:true},
    acceptance:{sourceContract:true,bodyFitValidated:false,assemblyValidated:false,visualAcceptance:false,motionValidated:false,productionReady:false}};
}
