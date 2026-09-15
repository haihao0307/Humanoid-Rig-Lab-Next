/* Authored R2 variants: one shared map for surface and personal rest joints. */
/*__CHARACTER_SHAPE_CORE__*/
const CHARACTER_SHAPE_SCHEMA=SHAPE_SCHEMA;
const CHARACTER_SHAPE_REVISION=SHAPE_REVISION;
const CHARACTER_STATURE_RANGE=Object.freeze({min:.94,max:1.06,neutral:1});
const CHARACTER_STATURE_PRESETS=Object.freeze([
 Object.freeze({id:'short',label:'较矮',statureScale:.94}),Object.freeze({id:'reference',label:'参考',statureScale:1}),Object.freeze({id:'tall',label:'较高',statureScale:1.06})
]);
const CHARACTER_FORM_PRESETS=Object.freeze([
 Object.freeze({id:'reference',label:'参考体型',shape:Object.freeze({})}),
 Object.freeze({id:'long-legged',label:'修长腿型',shape:Object.freeze({legProportion:.7,waistWidth:-.2})}),
 Object.freeze({id:'compact',label:'紧凑体型',shape:Object.freeze({legProportion:-.6,hipWidth:.25})}),
 Object.freeze({id:'broad',label:'宽肩体型',shape:Object.freeze({shoulderWidth:.75,waistWidth:.2,torsoDepth:.3,armFullness:.5,legFullness:.3})}),
 Object.freeze({id:'slender',label:'纤细体型',shape:Object.freeze({shoulderWidth:-.35,hipWidth:-.2,waistWidth:-.65,torsoDepth:-.45,armFullness:-.55,legFullness:-.45})}),
 Object.freeze({id:'fuller',label:'丰满体型',shape:Object.freeze({shoulderWidth:.15,hipWidth:.35,waistWidth:.65,torsoDepth:.65,armFullness:.35,legFullness:.5})})
]);
function validateCharacterShape(input={}){return normalizeCharacterShape(input);}
function characterShapeKey(input={}){
 // Exact full recipe plus source/generator identities; no rounded labels/IDs.
 return [R2_RIG.source.sourceFileSHA256,HUMAN_GENERATOR_REVISION,characterShapeParameterKey(input)].join(':');
}
function freezeCharacterShape(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freezeCharacterShape(child);Object.freeze(value);}return value;}
function resolveCharacterRig(input={}){
 const shape=validateCharacterShape(input),scale=shape.statureScale,reference=structuredClone(R2_RIG),field=createCharacterShapeField(R2_RIG,shape);
 reference.sourceFloorM*=scale;reference.sourceHeightM*=scale;
 for(const node of Object.values(reference.nodes)){node.positionM=field.point(node.positionM);if(node.tipM)node.tipM=field.point(node.tipM);}
 // Regional edits do not recalibrate the original fitted spheres/residuals.
 for(const fit of Object.values(reference.sphereFits))fit.radiusM*=scale;
 reference.shape=shape;reference.shapeKey=characterShapeKey(shape);
 reference.derivation={reference:reference.derivation,method:CHARACTER_SHAPE_REVISION,scaleOriginM:[0,0,0],authored:true,sharedField:'reconstruction/shape-deform.mjs',sourceFitsRecalibrated:false,globalSurfaceCertificate:false};
 reference.functionalCalibration=false;reference.subjectSpecificMotionAvailable=false;return freezeCharacterShape(reference);
}
function resolveCharacterMetrics(reference){
 const p=id=>reference.nodes[id].positionM,r=id=>R2_RIG.nodes[id].positionM;
 const length=(a,b)=>dist(p(a),p(b)),sourceLength=(a,b)=>dist(r(a),r(b)),mean=fn=>(fn('left')+fn('right'))/2;
 const shape=reference.shape,s=shape.statureScale,positive=value=>Math.max(0,value);
 const skinSoleHeightM=mean(side=>p(side+'_foot')[1])-reference.sourceFloorM;
 const rig={femurLengthM:mean(side=>length(side+'_femur',side+'_tibia')),tibiaLengthM:mean(side=>length(side+'_tibia',side+'_foot')),humerusLengthM:mean(side=>length(side+'_upperArm',side+'_forearm')),forearmLengthM:mean(side=>length(side+'_forearm',side+'_hand')),hipSpacingM:length('left_femur','right_femur'),elbowFlexionSign:-1,kneeFlexionSign:1};
 const stance={ankleHeightM:skinSoleHeightM,footHalfSpacingM:mean(side=>Math.abs(p(side+'_foot')[0])),ankleForwardM:mean(side=>p(side+'_foot')[2])-p('hips')[2],kneeFlexionDeg:0,elbowFlexionDeg:0,armAbductionDeg:0,palmTurnDeg:0};
 const restHipHeightM=p('hips')[1]-reference.sourceFloorM,referenceHipM=r('hips')[1]-R2_RIG.sourceFloorM,proxyScale=referenceHipM/.95;
 const referenceLegReachM=Math.min(...['left','right'].map(side=>sourceLength(side+'_femur',side+'_tibia')+sourceLength(side+'_tibia',side+'_foot'))),referenceAnkleM=Math.max(...['left','right'].map(side=>r(side+'_foot')[1]-R2_RIG.sourceFloorM));
 const referenceStandingHipM=.997*referenceLegReachM+referenceAnkleM,referenceWalkingHipM=.94*referenceLegReachM+referenceAnkleM;
 const referenceMetrics={restHipHeightM:referenceHipM,standingHipHeightM:referenceStandingHipM,walkingHipHeightM:referenceWalkingHipM,shoulderWidthM:sourceLength('left_upperArm','right_upperArm'),hipWidthM:sourceLength('left_femur','right_femur'),
  armReachM:Object.fromEntries(['left','right'].map(side=>[side,sourceLength(side+'_upperArm',side+'_forearm')+sourceLength(side+'_forearm',side+'_hand')])),torsoRadiusM:.17*proxyScale,torsoDepthM:.34*proxyScale,bodyRadiusM:.26,armRadiusM:.047*proxyScale,legRadiusM:.069*proxyScale,headRadiusM:.105*proxyScale,shoulderHeightM:referenceStandingHipM+mean(side=>r(side+'_upperArm')[1]-r('hips')[1]),crouchLowHipM:.325};
 // The gait scheduler needs flexed knees for swing reach. Idle standing uses
 // almost the full leg reach, with a small reserve for unequal source legs.
 // Both targets derive from this person's fixed lengths and ankle plane.
 const personalLegReachM=Math.min(...['left','right'].map(side=>length(side+'_femur',side+'_tibia')+length(side+'_tibia',side+'_foot'))),anklePlaneM=Math.max(...['left','right'].map(side=>p(side+'_foot')[1]-reference.sourceFloorM));
 const standingHipHeightM=.997*personalLegReachM+anklePlaneM,walkingHipHeightM=.94*personalLegReachM+anklePlaneM;
 // Authored collision allowances, not measured surface bounds. Slimming keeps
 // neutral clearance; expanded transverse regions add motion proxy allowance.
 const shoulderAllowanceM=CHARACTER_DEFORMATION_RULES.shoulderShiftM*positive(shape.shoulderWidth)*s;
 const widthGain=Math.max(CHARACTER_DEFORMATION_RULES.hipRadialGain*positive(shape.hipWidth),CHARACTER_DEFORMATION_RULES.waistRadialGain*positive(shape.waistWidth)),depthGain=CHARACTER_DEFORMATION_RULES.torsoDepthGain*positive(shape.torsoDepth);
 const torsoRadiusM=referenceMetrics.torsoRadiusM*s*(1+widthGain+depthGain)+shoulderAllowanceM;
 const armRadiusM=referenceMetrics.armRadiusM*s*(1+CHARACTER_DEFORMATION_RULES.limbRadialGain*positive(shape.armFullness));
 const legRadiusM=referenceMetrics.legRadiusM*s*(1+CHARACTER_DEFORMATION_RULES.limbRadialGain*positive(shape.legFullness)+widthGain);
 return freezeCharacterShape({statureScale:s,statureM:reference.sourceHeightM,rig,stance,reference:referenceMetrics,restHipHeightM,standingHipHeightM,walkingHipHeightM,skinSoleHeightM,legRestReachM:mean(side=>length(side+'_femur',side+'_foot')),
  shoulderWidthM:length('left_upperArm','right_upperArm'),hipWidthM:length('left_femur','right_femur'),armReachM:Object.fromEntries(['left','right'].map(side=>[side,length(side+'_upperArm',side+'_forearm')+length(side+'_forearm',side+'_hand')])),shoulderHeightM:standingHipHeightM+mean(side=>p(side+'_upperArm')[1]-p('hips')[1]),crouchLowHipM:.325*restHipHeightM/referenceHipM,
  torsoRadiusM,torsoDepthM:referenceMetrics.torsoDepthM*s*(1+depthGain),armRadiusM,legRadiusM,headRadiusM:referenceMetrics.headRadiusM*s,
  bodyRadiusM:referenceMetrics.bodyRadiusM*s+shoulderAllowanceM+referenceMetrics.torsoRadiusM*s*widthGain+Math.max(0,armRadiusM-referenceMetrics.armRadiusM*s),proxyBasis:'authored regional clearances; not measured surface bounds',palmContact:[0,-mean(side=>length(side+'_hand',side+'_finger_3_1'))*.55,0],geometryKey:reference.shapeKey});
}
function installCharacterShapeControls(lab){
 const panel=document.createElement('section');panel.id='character-shape-panel';panel.hidden=true;
 panel.innerHTML='<p>选择体型，或分别调整比例与丰满度。滑杆 0 为参考值，向左减小、向右增大。应用前请先起身站稳。</p><div id="shape-forms"></div><div id="shape-presets"></div><label>身高（厘米） <input id="shape-height" type="number" step="0.1"></label><div id="shape-regional"></div><output id="shape-current"></output><button id="shape-apply">应用体型</button><output id="shape-status" role="status" aria-live="polite"></output>';
 document.body.append(panel);const el=id=>panel.querySelector('#shape-'+id),baseM=R2_RIG.sourceHeightM,sliders=new Map();
 el('height').min=(baseM*CHARACTER_STATURE_RANGE.min*100).toFixed(4);el('height').max=(baseM*CHARACTER_STATURE_RANGE.max*100).toFixed(4);
 let selectedShape=validateCharacterShape(),heightEdited=false;
 const select=input=>{selectedShape=validateCharacterShape(input);heightEdited=false;el('height').value=(baseM*selectedShape.statureScale*100).toFixed(1);for(const [id,{input,output}]of sliders){input.value=selectedShape[id];output.textContent=selectedShape[id].toFixed(2);}};
 const api={
  export:()=>validateCharacterShape(lab.human.characterPreset.shape),
  async apply(input){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('体型参数必须为对象');const shape=validateCharacterShape(input.schema!==undefined||input.revision!==undefined?input:{...api.export(),...input}),character=lab.character.export();return lab.character.apply({...character,shape,statureM:undefined});},
  presets:()=>CHARACTER_FORM_PRESETS.map(preset=>({id:preset.id,label:preset.label,shape:validateCharacterShape(preset.shape)})),
  refresh(){select(api.export());el('current').textContent='当前身高 '+(lab.human.bodyMetrics.statureM*100).toFixed(1)+' cm';},
  report:()=>({schema:CHARACTER_SHAPE_SCHEMA,parameters:api.export(),metrics:structuredClone(lab.human.bodyMetrics),method:CHARACTER_SHAPE_REVISION,rules:structuredClone(CHARACTER_DEFORMATION_RULES),parameterDomain:'authored reference neighbourhood',populationModel:false,runtimeVerified:false,visualAcceptance:false})
 };
 for(const spec of SHAPE_PARAMETER_SPECS.filter(spec=>spec.id!=='statureScale')){
  const label=document.createElement('label');label.className='shape-slider';label.textContent=spec.label+' ';const output=document.createElement('output'),input=document.createElement('input');input.type='range';input.min=spec.min;input.max=spec.max;input.step=.05;input.setAttribute('aria-label',spec.label);
  input.oninput=()=>{selectedShape={...selectedShape,[spec.id]:Number(input.value)};output.textContent=Number(input.value).toFixed(2);};label.append(output,input);el('regional').append(label);sliders.set(spec.id,{input,output});
 }
 for(const preset of CHARACTER_FORM_PRESETS){const button=document.createElement('button');button.textContent=preset.label;button.onclick=()=>{const statureScale=heightEdited?Number(el('height').value)/(baseM*100):selectedShape.statureScale;try{select({...preset.shape,statureScale});el('status').textContent='已选择'+preset.label+'，点击应用体型生效。';}catch(error){el('status').textContent=error.message;}};el('forms').append(button);}
 for(const preset of CHARACTER_STATURE_PRESETS){const button=document.createElement('button');button.textContent=preset.label+' '+(baseM*preset.statureScale*100).toFixed(1)+' cm';button.onclick=()=>select({...selectedShape,statureScale:preset.statureScale});el('presets').append(button);}
 el('height').oninput=()=>{heightEdited=true;};
 el('apply').onclick=async()=>{
  const shape={...selectedShape,statureScale:heightEdited?Number(el('height').value)/(baseM*100):selectedShape.statureScale};for(const control of panel.querySelectorAll('button,input'))control.disabled=true;el('status').textContent='正在生成当前体型的人物…';
  try{await api.apply(shape);api.refresh();el('status').textContent='体型已应用，可随角色导出保存。';}catch(error){el('status').textContent=error.message;}finally{for(const control of panel.querySelectorAll('button,input'))control.disabled=false;}
 };
 api.refresh();return api;
}
