function tissueBindFrames(human) {
  const frames = new Map();
  for (const j of human.joints) {
    let q = [...j.bindQ];
    if (/_upperArm$/.test(j.id)) q = qz(sideFromId(j.id) * TISSUE_SPEC.bindArmAbductionRad);
    if (/_forearm$/.test(j.id)) q = qi();
    // Build a separate neutral A-pose. Never pose or scale the live skeleton.
    frames.set(j.id, j.parent
      ? compose(frames.get(j.parent.id), frame(j.bind, q))
      : frame([0, human.rootHeight, 0], qi()));
  }
  return frames;
}

function tissueAttachmentPoint(joint,p){
  const q=[...p];
  // Segment fractions follow the new skeleton, including attachments near hinges.
  if(/_upperArm$/.test(joint))q[1]*=ANATOMY.humerusLength/.300;
  else if(/_(forearm|radiusRotation)$/.test(joint))q[1]*=ANATOMY.forearmLength/.255;
  else if(/_femur$/.test(joint))q[1]*=ANATOMY.femurLength/.435;
  else if(/_tibia$/.test(joint))q[1]*=ANATOMY.tibiaLength/.409;
  else if(/_foot$/.test(joint))return footBonePoint(q);
  if(joint==='hips'){q[0]*=ANATOMY.hipSpacing/.19;q[1]*=.92;}
  return q;
}

// Only the exposed corneal/scleral patch is built. A complete white ellipsoid
// outside the face cannot protrude through the eyelids from a side view.
function tissueEyePatch(side,radius=null,lift=0){
  const h=ADULT_SPEC.head,[cx,cy]=mirrorBodyPoint(h.eyeCenterM,side);
  const [w,v]=h.eyeOpeningM,p=[cx,cy,tissueEyeFront(side,cx,cy)+lift],indices=[],rings=8,segments=48;
  for(let ring=1;ring<=rings;ring++)for(let k=0;k<segments;k++){
    const a=k/segments*Math.PI*2,cs=Math.cos(a),sn=Math.sin(a),edge=1/Math.hypot(cs/w,sn/v);
    const r=(radius===null?edge:Math.min(radius,edge*.997))*ring/rings,x=r*cs,y=r*sn;
    p.push(cx+x,cy+y,tissueEyeFront(side,cx+x,cy+y)+lift);
  }
  for(let k=0;k<segments;k++)indices.push(0,1+k,1+(k+1)%segments);
  for(let ring=1;ring<rings;ring++)for(let k=0;k<segments;k++){
    const a=1+(ring-1)*segments+k,b=1+ring*segments+k,an=1+(ring-1)*segments+(k+1)%segments,bn=1+ring*segments+(k+1)%segments;
    indices.push(a,b,bn,a,bn,an);
  }
  return mesh(p,indices);
}

class ProceduralTissue {
  constructor(human) {
    this.human = human;
    this.bind = tissueBindFrames(human);
    this.structure=buildShoulderStructure(this);
    this.lowerLimb=buildLowerLimbFoundation(this);
    this.lowerBodySoft=buildLowerBodySoftProfiles(this);
    this.jointIds = new Map(human.joints.map((j, i) => [j.id, i]));
    this.jointPalette = new Float32Array(human.joints.length * 8);
    this.muscles = [];
    this.fields = [];
    this.view = 'skin';
    this.time = 0;
    this.lastTime = null;
    this.maxWeightError = 0;
    this.skinColor = [...(human.characterPreset?.appearance.skinColor||[.43, .29, .22])];
    this.makeMuscles();
    applyProceduralMuscleComposition(this);
    makeMuscleSheets(this);
    makeLowerLimbSupports(this);
    makeLowerLimbMuscleSheets(this);
    this.musclePalette = new Float32Array(this.muscles.length * 24);
    // Surface topology replaces the old whole-body scalar-field extraction.
    this.skin = this.makeSurface();
    this.referenceExtra=buildProceduralSystems(this);
    this.skinBoundaryItems = buildSkinLayerSurfaces(this);
    this.fascia = this.skinLayerItems?.find(i=>i.skinLayer==='hypodermis')||{...this.skin, g:{...this.skin.g,c:null}, id: 'fascia_envelope', materialKind: 3, color: [.62, .49, .37], visible: false};
    this.details = [...this.makeFace(),...makeHandNails(this),...makeToeNails(this)];
    applyProceduralFaceDetails(this);
    this.clay = {...this.skin,g:{...this.skin.g,c:null},id:'proportion_clay',materialKind:7,color:[.54,.55,.55],visible:false};
    this.clayDetails=this.details.filter(d=>!/^iris_|^pupil_|^brow_|^nostril_|^mouth_seam$/.test(d.id))
      .map(d=>({...d,id:'clay_'+d.id,materialKind:0,color:[.54,.55,.55],visible:false}));
    this.structureItems=[...this.structure.parts,...this.structure.supports,...this.lowerLimb.parts,...this.lowerLimb.supports];
    this.items = [this.skin, ...(this.skinBoundaryItems.length?this.skinBoundaryItems:[this.fascia]), this.clay, ...this.structureItems, ...anatomyMuscleItems(this), ...(this.referenceExtra||[]), ...this.details, ...this.clayDetails];
    this.ecology=new HumanEcology(this,human.characterPreset.biology);
    this.bindingKnowledge=buildHumanBindingKnowledge(this);
    this.update(0, 0);
  }

  anchor(joint, p) {
    if (!this.bind.has(joint)) throw Error('Unknown tissue attachment: ' + joint);
    p=tissueAttachmentPoint(joint,p);
    return {joint, p, rest: point(this.bind.get(joint), p)};
  }

  muscle(id, label, origin, via, insertion, radius, flatten = .82) {
    const anchors = [origin, via, insertion].map(([joint, p]) => this.anchor(joint, p));
    const restLength = this.arcLength(anchors.map(a => a.rest));
    const index = this.muscles.length;
    const m = {id, label, anchors, radius, flatten, restLength, activation: .035,
      radiusScale: 1, exponent: 1, length: restLength, integral: this.bellyIntegral(1)};
    m.bindCenter=this.curve(anchors.map(a=>a.rest),.5);
    m.bindReach=restLength*.6+radius+.05;
    const p = [], n = [], indices = [], rings = 22, sides = 16;
    for (let y = 0; y <= rings; y++) for (let a = 0; a <= sides; a++) {
      const theta = a / sides * Math.PI * 2;
      p.push(Math.cos(theta), Math.sin(theta), y / rings);
      n.push(Math.cos(theta), Math.sin(theta), 0);
    }
    for (let y = 0; y < rings; y++) for (let a = 0; a < sides; a++) {
      const v = y * (sides + 1) + a;
      indices.push(v, v + 1, v + sides + 2, v, v + sides + 2, v + sides + 1);
    }
    for(const [ring,t] of [[0,0],[rings,1]]) {
      const pole=p.length/3;p.push(0,0,t);n.push(0,0,t?1:-1);
      for(let a=0;a<sides;a++) {
        const v=ring*(sides+1)+a;
        if(t)indices.push(pole,v,v+1);else indices.push(pole,v+1,v);
      }
    }
    const g = mesh(p, indices, n);
    g.tissueIds = new Float32Array(p.length / 3 * 2).fill(index);
    m.item = {id, g, materialKind: 2, color: [.38, .065, .042], visible: false};
    this.muscles.push(m);
  }

  makeMuscles() {
    for (const side of ['left', 'right']) {
      const s = side === 'left' ? -1 : 1, a = side + '_', label = s < 0 ? '左' : '右';
      const M = (id, name, j0, p0, jv, pv, j1, p1, r, f) =>
        this.muscle(a + id, label + name, [j0, p0], [jv, pv], [j1, p1], r, f);
      M('deltoid', '三角肌', a+'AC',[0,.004,.002], a+'upperArm',[s*.030,-.050,.003], a+'upperArm',[s*.014,-.135,.002], .027, .82);
      M('biceps', '肱二头肌', a+'AC',[-s*.008,-.03,.027], a+'upperArm',[0,-.153,.030], a+'radiusRotation',[s*.014,-.042,.014], .024, .82);
      M('triceps', '肱三头肌', a+'AC',[-s*.016,-.05,-.010], a+'upperArm',[0,-.145,-.030], a+'forearm',[0,.013,-.016], .024, .82);
      M('brachialis', '肱肌', a+'upperArm',[-s*.012,-.10,.015], a+'upperArm',[-s*.014,-.215,.021], a+'forearm',[-s*.009,-.025,.009], .022);
      M('forearm_flexor', '前臂屈肌群', a+'upperArm',[-s*.017,-.286,.015], a+'forearm',[0,-.095,.020], a+'hand',[0,-.030,.008], .019);
      M('forearm_extensor', '前臂伸肌群', a+'upperArm',[s*.014,-.282,-.013], a+'forearm',[s*.007,-.102,-.020], a+'hand',[0,-.016,-.011], .018);
      M('pectoralis', '胸大肌', 'sternum',[s*.012,.065,.007], 'T4',[s*.079,-.030,.143], a+'upperArm',[-s*.012,-.053,.018], .043, .25);
      M('latissimus', '背阔肌', 'L2',[s*.035,.006,-.038], 'T8',[s*.085,.022,-.038], a+'upperArm',[-s*.012,-.075,-.01], .049, .32);
      M('trapezius', '斜方肌', 'C4',[s*.012,0,-.031], 'T2',[s*.065,.028,-.033], a+'AC',[-s*.018,-.028,-.025], .034, .44);
      M('erector_spinae', '竖脊肌群', 'hips',[s*.035,.068,-.05], 'T10',[s*.030,.005,-.042], 'T1',[s*.026,-.025,-.03], .025, .75);
      M('rectus_abdominis', '腹直肌', 'hips',[s*.028,-.027,.085], 'L3',[s*.030,.01,.102], 'sternum',[s*.027,-.033,.003], .030, .28);
      M('oblique', '腹外斜肌', 'hips',[s*.128,.07,.030], 'L1',[s*.114,.04,.063], 'T7',[s*.120,-.03,.084], .033, .40);
      M('gluteus_maximus', '臀大肌', 'hips',[s*.069,.073,-.058], a+'femur',[s*.005,-.014,-.073], a+'femur',[s*.030,-.135,-.019], .047, .72);
      M('gluteus_medius', '臀中肌', 'hips',[s*.133,.106,-.018], 'hips',[s*.140,.048,-.024], a+'femur',[s*.045,-.037,-.008], .031, .64);
      M('rectus_femoris', '股直肌', 'hips',[s*.110,.053,.042], a+'femur',[0,-.200,.053], a+'tibia',[0,-.041,.023], .038, .74);
      M('vastus_lateralis', '股外侧肌', a+'femur',[s*.043,-.055,.013], a+'femur',[s*.034,-.230,.027], a+'tibia',[s*.012,-.018,.022], .032, .83);
      M('vastus_medialis', '股内侧肌', a+'femur',[-s*.014,-.100,.019], a+'femur',[-s*.029,-.302,.042], a+'tibia',[-s*.012,-.016,.021], .035, .85);
      M('biceps_femoris', '股二头肌长头', 'hips',[s*.078,-.073,-.03], a+'femur',[s*.026,-.212,-.048], a+'tibia',[s*.027,-.030,-.016], .035, .76);
      M('semimembranosus', '半膜肌', 'hips',[s*.074,-.073,-.033], a+'femur',[-s*.019,-.205,-.047], a+'tibia',[-s*.023,-.023,-.019], .030, .77);
      M('semitendinosus', '半腱肌', 'hips',[s*.078,-.073,-.030], a+'femur',[-s*.014,-.200,-.054], a+'tibia',[-s*.024,-.055,.004], .018, .82);
      M('vastus_intermedius', '股中间肌', a+'femur',[0,-.073,.018], a+'femur',[0,-.228,.033], a+'tibia',[0,-.037,.023], .024, .80);
      M('adductor_magnus', '大收肌', 'hips',[s*.035,-.063,-.006], a+'femur',[-s*.027,-.180,-.012], a+'femur',[-s*.025,-.404,-.005], .035, .70);
      M('adductor_longus', '长收肌', 'hips',[s*.025,-.043,.039], a+'femur',[-s*.028,-.118,.020], a+'femur',[-s*.010,-.284,-.008], .023, .72);
      M('gastrocnemius_medial', '腓肠肌内侧头', a+'femur',[-s*.020,-.415,-.021], a+'tibia',[-s*.018,-.133,-.049], a+'foot',[0,-.035,-.044], .031, .78);
      M('gastrocnemius_lateral', '腓肠肌外侧头', a+'femur',[s*.024,-.413,-.019], a+'tibia',[s*.024,-.113,-.043], a+'foot',[0,-.035,-.044], .027, .78);
      M('soleus', '比目鱼肌', a+'tibia',[s*.014,-.074,-.020], a+'tibia',[s*.009,-.207,-.030], a+'foot',[0,-.035,-.044], .024, .80);
      M('tibialis_anterior', '胫骨前肌', a+'tibia',[s*.026,-.05,.01], a+'tibia',[s*.022,-.155,.025], a+'foot',[-s*.018,-.025,.069], .016, .77);
      M('fibularis', '腓骨肌群', a+'tibia',[s*.033,-.06,-.003], a+'tibia',[s*.032,-.205,-.006], a+'foot',[s*.037,-.043,.073], .012, .80);
    }
  }

  ell(joint, center, radii, blend = .012) {
    const f = this.bind.get(joint), worldCenter = point(f, center);
    const axes = [[1,0,0],[0,1,0],[0,0,1]].map(v => rotate(f.q, v));
    const extent = [0,1,2].map(k => Math.sqrt(axes.reduce((sum, a, i) => sum + (a[k]*radii[i])**2, 0)) + .045);
    this.fields.push({joint, localCenter:[...center], center: worldCenter, radii, axes, blend, minRadius: Math.min(...radii),
      lo: worldCenter.map((v,k) => v-extent[k]), hi: worldCenter.map((v,k) => v+extent[k])});
  }

  makeEnvelope() { makeAnatomicalEnvelope(this); }

  fieldDistance(p, f) {
    if(f.kind==='loft')return f.distance(p);
    const x=p[0]-f.center[0], y=p[1]-f.center[1], z=p[2]-f.center[2], [a,b,c]=f.axes;
    const q=[x*a[0]+y*a[1]+z*a[2],x*b[0]+y*b[1]+z*b[2],x*c[0]+y*c[1]+z*c[2]];
    const level=Math.hypot(...q.map((v,k)=>v/f.radii[k]));
    const gradient=Math.hypot(...q.map((v,k)=>v/(f.radii[k]*f.radii[k])));
    return gradient>1e-9?level*(level-1)/gradient:-f.minRadius;
  }

  makeSurface() { return bindConnectedTissueSurface(this); }

  makeFace() {
    return makeAnatomicalFace(this);
  }

  curve([a,v,b],t){return add(add(mul(a,(1-t)**2),mul(v,2*t*(1-t))),mul(b,t*t));}
  arcLength(points){let L=0,prev=points[0];for(let k=1;k<=12;k++){const p=this.curve(points,k/12);L+=dist(prev,p);prev=p;}return L;}
  bellyIntegral(exponent){let sum=0;for(let k=0;k<32;k++){const t=(k+.5)/32;sum+=(.10+.90*Math.sin(Math.PI*t)**exponent)**2;}return sum/32;}

  update(time, dt, load=0) {
    this.time=time;
    this.ecology?.step(dt);
    for(let i=0;i<this.human.joints.length;i++) {
      const j=this.human.joints[i], b=this.bind.get(j.id);
      const q=qnorm(qm(j.world.q,inv(b.q))), t=sub(j.world.p,rotate(q,b.p));
      this.jointPalette.set(q,i*8);this.jointPalette.set(mul(qm([...t,0],q),.5),i*8+4);
    }
    for(let i=0;i<this.muscles.length;i++) {
      const m=this.muscles[i],liveAnchors=(m.sheetAnchors||m.anchors).map(a=>point(this.human.byId.get(a.joint).world,a.p));
      const positions=m.sheet?[0,2,4].map(k=>mix(liveAnchors[k],liveAnchors[k+1],.5)):liveAnchors;
      const rest=m.controlRest||m.anchors.map(a=>a.rest);
      const L=Math.max(.015,this.arcLength(positions)), ratio=clamp(L/m.restLength,.52,1.8);
      const shortening=clamp((1-ratio)*3.0,0,1);
      const modeled=this.human.strength?.activationForMuscle(m.id);
      // Loaded isometric and eccentric effort now comes from the capability
      // state, independently of geometric shortening. Unmodeled gait/inspection
      // retains a small geometric cue. Neither cue changes base muscle mass.
      const excitation=modeled==null?clamp(.035+shortening*.8,.01,1):clamp(.025+Math.max(modeled,shortening*.12),.01,1);
      const tau=excitation>m.activation?TISSUE_SPEC.activationTimeS:TISSUE_SPEC.relaxationTimeS;
      m.activation+=(excitation-m.activation)*(1-Math.exp(-Math.max(0,dt)/tau));
      m.exponent=1+m.activation*.7;
      m.radiusScale=Math.sqrt(m.restLength/L*m.integral/this.bellyIntegral(m.exponent));
      m.length=L;
      const offset=i*24;
      this.musclePalette.set([...positions[0],m.radius],offset);
      this.musclePalette.set([...positions[1],m.flatten],offset+4);
      this.musclePalette.set([...positions[2],m.radiusScale],offset+8);
      this.musclePalette.set([...rest[0],m.exponent],offset+12);
      this.musclePalette.set([...rest[2],m.activation],offset+16);
      // Transport a rest-space transverse axis with the origin bone, then project it.
      // This avoids the old tangent.y threshold changing an entire muscle's orientation.
      const tangent=norm(sub(rest[2],rest[0]));
      const reference=Math.abs(tangent[2])<.85?[0,0,1]:[1,0,0];
      const restX=norm(cross(tangent,reference)),origin=m.anchors[0].joint;
      const orientation=qm(this.human.byId.get(origin).world.q,inv(this.bind.get(origin).q));
      this.musclePalette.set([...rotate(orientation,restX),0],offset+20);
    }
  }

  setView(mode) {
    if(!['skin','clay','dermis','hypodermis','subcutaneousBase','skinThickness','muscle','fascia','skeleton','structure','support','organs','vessels','nerves'].includes(mode))throw Error('Unknown anatomy view');
    this.view=mode;return this.report();
  }

  minimumSupportY() { return connectedSurfaceSupport(this); }

  visibility(isolated=false) {
    for(const item of [...this.structure.parts,...this.lowerLimb.parts])item.visible=!isolated&&this.view==='structure';
    for(const item of [...this.structure.supports,...this.lowerLimb.supports])item.visible=!isolated&&this.view==='support';
    this.skin.visible=!isolated&&this.view==='skin';
    this.fascia.visible=!isolated&&this.view==='fascia';
    for(const item of this.skinLayerItems||[])item.visible=!isolated&&(this.view===item.skinLayer||this.view==='fascia'&&item===this.fascia);
    if(this.skinThicknessMap)this.skinThicknessMap.visible=!isolated&&this.view==='skinThickness';
    this.clay.visible=!isolated&&this.view==='clay';
    for(const m of anatomyMuscleItems(this))m.visible=!isolated&&this.view==='muscle';
    for(const item of this.referenceExtra||[])item.visible=!isolated&&({organs:['organs'],vessels:['arteries','veins'],nerves:['nerves']}[this.view]||[]).includes(item.sourceGroup);
    for(const d of this.details)d.visible=!isolated&&(this.view==='skin'||d.featureRole==='ocular'&&this.view==='muscle');
    for(const d of this.clayDetails)d.visible=!isolated&&this.view==='clay';
  }

  report() {
    return {schema:'jarvis/procedural_tissue@1.0',version:TISSUE_SPEC.version,view:this.view,
      layers:['articulated_rigid_foundation','deformable_soft_tissue'],
      localLayers:{scope:'cervical / thoracic / lumbar / pelvis / shoulder',foundation:this.structure.report,soft:this.shoulderLayerReport,skeleton:this.human.axialReport,posterior:this.backSurfaceReport,muscles:this.axialMuscleReport},
      lowerLimb:lowerLimbInspectionSummary(this),
      muscleCount:this.muscles.length,broadSheetCount:this.sheetItems.length,surface:this.surfaceInfo,geometryHash:this.geometryHash,
      maxNormalizedWeightError:this.maxWeightError,externalMeshes:0,proceduralSystems:proceduralSystemsReport(this),imageMaps:0,
      skinning:TISSUE_SPEC.skinning,forceDynamics:false,visualAcceptance:false,
      adultBaseline:{statureM:ADULT_SPEC.statureM,headHeightM:ADULT_SPEC.head.vertexY-ADULT_SPEC.head.chinY,standingHipHeightM:REST_HIP_HEIGHT,neutralKneeFlexionDeg:ADULT_STANCE.kneeFlexionDeg,source:'body/AdultHumanSpec.json'},
      floorContact:'generated surface vertex support samples; 0.8 mm clearance; not a complete contact solver',
      fullSkinSelfCollision:false,
      muscles:this.muscles.map(m=>({id:m.id,label:m.label,activation:m.activation,lengthM:m.length,
        restLengthM:m.restLength,radiusScale:m.radiusScale,geometry:m.sheet?'closed_anatomical_contour_volume':'fusiform',referenceVolumes:m.referenceVolumes||null,
        attachments:(m.sheetAnchors||m.anchors).map(a=>a.joint)}))};
  }
}
