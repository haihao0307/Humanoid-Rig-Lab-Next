/* Authored muscle-inspired strain fields and independent manual controls.
 * Only parameters persist. This is a geometric deformation model, not a
 * physical muscle/tissue simulation or measured anatomy. */
const FACE_RECIPE=/*__FACE_RECIPE_JSON__*/;
const FACE_SCHEMA='jarvis/face_profile@3';
const FACE_LEGACY_PROFILE_SCHEMA='jarvis/face_profile@2';
const FACE_IDENTITY_SCHEMA='jarvis/face_identity@2';
const FACE_IDENTITY_LEGACY_SCHEMA='jarvis/face_identity@1';
const FACE_EXPRESSION_SCHEMA='jarvis/face_expression@1';
const FACE_LEGACY_SCHEMA='jarvis/face_pose@1';
const FACE_NODE_INDEX=new Map(FACE_RECIPE.nodes.map((node,index)=>[node.id,index]));
const faceHas=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
function faceObject(value,label){if(!value||typeof value!=='object'||Array.isArray(value))throw Error(label+'必须为对象');}
function faceNumber(value,min,max,label){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(label+'超出范围 '+min+' 至 '+max);return value;}
function validateFaceRevision(input){if(input.revision!==undefined&&input.revision!==FACE_RECIPE.revision&&!FACE_RECIPE.legacyRevisions.includes(input.revision))throw Error('面部配方版本不匹配');}
function validateFaceWeights(input={}){
  faceObject(input,'表情权重');const weights={},channels=new Set(FACE_RECIPE.channels.map(c=>c.id));
  for(const [key,value]of Object.entries(input)){if(!channels.has(key))throw Error('未知表情通道 '+key);weights[key]=faceNumber(value,0,1,key);}
  return weights;
}
function validateFaceOffsets(input={}){
  faceObject(input,'固定身份局部残差');const offsetsMm={};
  for(const [key,value]of Object.entries(input)){
    if(!FACE_NODE_INDEX.has(key)||!Array.isArray(value)||value.length!==3)throw Error('局部控制点或位移无效 '+key);
    offsetsMm[key]=value.map(v=>faceNumber(v,-FACE_RECIPE.maximumOffsetMm,FACE_RECIPE.maximumOffsetMm,key));
  }
  return offsetsMm;
}
function validateFacePose(input={}){
  faceObject(input,'面部配方');validateFaceRevision(input);
  const directLegacy=input.schema===FACE_LEGACY_SCHEMA||faceHas(input,'weights')||faceHas(input,'offsetsMm');
  if(directLegacy){
    if(input.schema!==undefined&&input.schema!==FACE_LEGACY_SCHEMA)throw Error('面部配方 schema 与字段不匹配');
    if(Object.keys(input).some(key=>!['schema','revision','weights','offsetsMm'].includes(key)))throw Error('面部配方含未知字段');
    const neutralOffsetsMm=validateFaceOffsets(input.offsetsMm??{}),weights=validateFaceWeights(input.weights??{});
    return {schema:FACE_SCHEMA,revision:FACE_RECIPE.revision,identity:{schema:FACE_IDENTITY_SCHEMA,shape:{},neutralOffsetsMm},expression:{schema:FACE_EXPRESSION_SCHEMA,weights}};
  }
  const profileSchema=input.schema??FACE_SCHEMA;
  if(profileSchema!==FACE_SCHEMA&&profileSchema!==FACE_LEGACY_PROFILE_SCHEMA)throw Error('不支持的面部配方 schema');
  if(Object.keys(input).some(key=>!['schema','revision','identity','expression'].includes(key)))throw Error('面部配方含未知字段');
  const identity=input.identity??{},expression=input.expression??{};faceObject(identity,'固定身份');faceObject(expression,'临时表情');
  if(Object.keys(identity).some(key=>!['schema','shape','neutralOffsetsMm'].includes(key)))throw Error('固定身份格式无效');
  if(identity.schema!==undefined&&identity.schema!==FACE_IDENTITY_SCHEMA&&identity.schema!==FACE_IDENTITY_LEGACY_SCHEMA)throw Error('固定身份 schema 无效');
  if(Object.keys(expression).some(key=>!['schema','weights'].includes(key))||expression.schema!==undefined&&expression.schema!==FACE_EXPRESSION_SCHEMA)throw Error('临时表情格式无效');
  const shape=validateFaceIdentityShape(identity.shape??{}),neutralOffsetsMm=validateFaceOffsets(identity.neutralOffsetsMm??{}),weights=validateFaceWeights(expression.weights??{});
  return {schema:FACE_SCHEMA,revision:FACE_RECIPE.revision,identity:{schema:FACE_IDENTITY_SCHEMA,shape,neutralOffsetsMm},expression:{schema:FACE_EXPRESSION_SCHEMA,weights}};
}
function faceOffsetKey(offsetsMm={}){return FACE_RECIPE.nodes.map(node=>node.id+':'+(offsetsMm[node.id]||[0,0,0]).map(v=>Number(v).toFixed(4)).join(',')).join('|');}
function faceIdentityKey(identity){return faceIdentityShapeKey(identity.shape)+'|'+faceOffsetKey(identity.neutralOffsetsMm);}
function faceWeightKey(weights={}){return FACE_RECIPE.channels.map(channel=>channel.id+':'+Number(weights[channel.id]||0).toFixed(4)).join('|');}
function faceIdentityPreset(identity){const key=faceIdentityKey(identity);return FACE_IDENTITY_PRESETS.find(preset=>faceIdentityKey({shape:validateFaceIdentityShape(preset.shape),neutralOffsetsMm:validateFaceOffsets(preset.offsetsMm)})===key)||null;}
function faceExpressionPreset(expression){const key=faceWeightKey(expression.weights);return FACE_RECIPE.presets.find(preset=>faceWeightKey(preset.weights)===key)||null;}
function resolveFaceOffsets(input){
  const pose=validateFacePose(input),weights=pose.expression.weights,structuralOffsetsMm=compileFaceIdentityShape(pose.identity.shape),offsetsMm=mergeFaceIdentityOffsets(structuralOffsetsMm,pose.identity.neutralOffsetsMm),values=new Float32Array(FACE_RECIPE.nodes.length*3),limited=[];
  for(const [key,value]of Object.entries(offsetsMm))values.set(value,FACE_NODE_INDEX.get(key)*3);
  for(const channel of FACE_RECIPE.channels){const weight=weights[channel.id]||0;
    for(const [key,delta]of Object.entries(channel.offsets)){const offset=FACE_NODE_INDEX.get(key)*3;for(let axis=0;axis<3;axis++)values[offset+axis]+=weight*delta[axis];}
  }
  for(let i=0;i<FACE_RECIPE.nodes.length;i++){
    const at=i*3,length=Math.hypot(values[at],values[at+1],values[at+2]),scale=Math.min(1,FACE_RECIPE.maximumOffsetMm/Math.max(length,1e-12));
    if(scale<1)limited.push(FACE_RECIPE.nodes[i].id);
    for(let axis=0;axis<3;axis++)values[at+axis]*=scale*.001;
  }
  const muscles=new Float32Array(FACE_RECIPE.muscleFields.map(field=>Math.min(1,Object.entries(field.activation).reduce((sum,[id,gain])=>sum+(weights[id]||0)*gain,0))));
  const eyelids=new Float32Array(['Left','Right'].flatMap(side=>['eyeNarrow','eyeWide','eyeBlink'].map(id=>weights[id+side]||0)));
  return {profile:pose,identityOffsetsMm:offsetsMm,landmarks:faceIdentityLandmarks(pose.identity.shape),values,muscles,eyelids,lipOpen:weights.lipPart||0,limited};
}
function interpolateFacePose(from,to,weight){
  const a=validateFacePose(from),b=validateFacePose(to);faceNumber(weight,0,1,'表情过渡');
  const mix=(x=0,y=0)=>x+(y-x)*weight,weights={};
  for(const channel of FACE_RECIPE.channels){const value=mix(a.expression.weights[channel.id],b.expression.weights[channel.id]);if(value!==0)weights[channel.id]=value;}
  return validateFacePose({identity:a.identity,expression:{weights}});
}
function faceChunkEligible(name){return name==='faceLip'||name==='mouthInterior'||name==='faceSkin'||name==='faceBrow'||name==='noseInterior'||name==='skin'||name==='FJ2812'||name==='FJ2814'||name==='eyeLidSkin'||name==='eyeLidMargin'||name==='eyeTearDuct';}
function faceKernel(point,node){
  const r=Math.hypot(...point.map((v,axis)=>(v-node.centre[axis])/node.radius[axis]));
  return r>=1?0:(1-r)**4*(4*r+1);
}
function sampleFaceSurface(meshes,quality,statureScale=1){
  if(!Number.isFinite(statureScale)||statureScale<.94||statureScale>1.06)throw Error('面部采样体型比例无效');
  const nodes=FACE_RECIPE.nodes.map(node=>({id:node.id,label:node.label,coveredVertices:0,peakWeight:0,nearestDistanceMm:null}));
  let faceVertices=0;
  for(const mesh of meshes){if(!faceChunkEligible(mesh.name))continue;
    for(let i=0;i<mesh.vertices;i++){
      const point=mesh.canonicalPositions?Array.from(mesh.canonicalPositions.subarray(i*3,i*3+3)):[0,1,2].map(axis=>(mesh.positions[i*3+axis]*mesh.extent[axis]+mesh.origin[axis])/statureScale);
      if(point[1]<1.39||point[1]>1.58||point[2]<.10||Math.abs(point[0])>.09)continue;
      const personalPoint=[0,1,2].map(axis=>mesh.positions[i*3+axis]*mesh.extent[axis]+mesh.origin[axis]);
      faceVertices++;
      FACE_RECIPE.nodes.forEach((node,index)=>{const weight=faceKernel(point,node),sample=nodes[index];
        if(weight>.05)sample.coveredVertices++;
        sample.peakWeight=Math.max(sample.peakWeight,weight);
        const distance=Math.hypot(...personalPoint.map((v,axis)=>v-node.centre[axis]*statureScale))*1000;
        sample.nearestDistanceMm=Math.min(sample.nearestDistanceMm??Infinity,distance);
      });
    }
  }
  return {schema:'jarvis/face_sampling@1',revision:FACE_RECIPE.revision,quality,statureScale,faceVertices,nodes,
    samplingCoordinateSpace:'canonical-r2-reference-metres',reportedDistanceSpace:'personal-body-millimetres',
    state:'SampledGeneratedSurface',counting:'display vertices including duplicated chunk boundaries',threshold:.05,
    source:'canonical coverage and decoded personal neutral positions; authored centres are not auto-fitted',generatedGeometryIncluded:false,measuredAnatomy:false,visualAcceptance:false};
}
// A core fiber shortens along its axis and expands transversely with unit
// determinant. Spatial taper and overlapping fields make the complete model
// only volume-conscious, not volume preserving. Normals include the full
// analytic derivative of the affine field and its C2 support envelope.
function faceMuscleAffine(field){
  const matrix=field.diagonal?field.diagonal.map((v,row)=>[0,1,2].map(col=>row===col?v:0)):
    [0,1,2].map(row=>[0,1,2].map(col=>(row===col?field.transverseExpansion:0)+(-field.contraction-field.transverseExpansion)*field.axis[row]*field.axis[col]));
  const bias=field.liftMm.map((v,i)=>(v+(field.axis?field.axis[i]*field.contraction*field.anchorMm:0))*.001);
  return {matrix,bias};
}
const FACE_MUSCLE_AFFINES=FACE_RECIPE.muscleFields.map(faceMuscleAffine);
const faceGlslVec=values=>'vec3('+values.map(v=>v.toFixed(9)).join(',')+')';
const COMPACT_FACE_GLSL=`
uniform vec3 faceOffsets[${FACE_RECIPE.nodes.length}];
uniform float faceMuscles[${FACE_RECIPE.muscleFields.length}];
uniform float faceEnabled,faceEligible,faceHeatmap;
uniform int faceSelected;
const vec3 faceCentres[${FACE_RECIPE.nodes.length}]=vec3[](${FACE_RECIPE.nodes.map(n=>'vec3('+n.centre.map(v=>v.toFixed(6)).join(',')+')').join(',')});
const vec3 faceRadii[${FACE_RECIPE.nodes.length}]=vec3[](${FACE_RECIPE.nodes.map(n=>'vec3('+n.radius.map(v=>v.toFixed(6)).join(',')+')').join(',')});
const vec3 faceMuscleCentres[${FACE_RECIPE.muscleFields.length}]=vec3[](${FACE_RECIPE.muscleFields.map(f=>faceGlslVec(f.centre)).join(',')});
const vec3 faceMuscleRadii[${FACE_RECIPE.muscleFields.length}]=vec3[](${FACE_RECIPE.muscleFields.map(f=>faceGlslVec(f.radius)).join(',')});
const vec3 faceMuscleBias[${FACE_RECIPE.muscleFields.length}]=vec3[](${FACE_MUSCLE_AFFINES.map(f=>faceGlslVec(f.bias)).join(',')});
const mat3 faceMuscleStrain[${FACE_RECIPE.muscleFields.length}]=mat3[](${FACE_MUSCLE_AFFINES.map(f=>'mat3('+[0,1,2].map(col=>faceGlslVec(f.matrix.map(row=>row[col]))).join(',')+')').join(',')});
void compactFace(inout vec3 source,inout vec3 normalSource,out float heat){
  heat=0.;
  if(faceEligible<.5||source.y<1.39||source.y>1.585||source.z<.10||abs(source.x)>.092)return;
  if(faceEnabled<.5&&faceHeatmap<.5)return;
  vec3 delta=vec3(0.),jx=vec3(1.,0.,0.),jy=vec3(0.,1.,0.),jz=vec3(0.,0.,1.);
  for(int i=0;i<${FACE_RECIPE.nodes.length};i++){
    vec3 q=(source-faceCentres[i])/faceRadii[i];float radius=length(q);
    if(radius>=1.)continue;
    float t=1.-radius,w=t*t*t*t*(4.*radius+1.);
    if(i==faceSelected)heat=w;
    vec3 d=faceOffsets[i]*faceEnabled;
    delta+=w*d;
    vec3 gradient=-20.*t*t*t*q/faceRadii[i];
    jx+=d*gradient.x;jy+=d*gradient.y;jz+=d*gradient.z;
  }
  for(int i=0;i<${FACE_RECIPE.muscleFields.length};i++){
    float activation=faceMuscles[i]*faceEnabled;if(activation<.00001)continue;
    vec3 relative=source-faceMuscleCentres[i],q=relative/faceMuscleRadii[i];
    float radiusSquared=dot(q,q);if(radiusSquared>=1.)continue;
    float t=1.-radiusSquared,w=t*t*t;
    mat3 strain=faceMuscleStrain[i];vec3 d=faceMuscleBias[i]+strain*relative;
    vec3 gradient=-6.*t*t*q/faceMuscleRadii[i];
    delta+=activation*w*d;
    jx+=activation*(w*strain[0]+d*gradient.x);
    jy+=activation*(w*strain[1]+d*gradient.y);
    jz+=activation*(w*strain[2]+d*gradient.z);
  }
  float determinant=dot(jx,cross(jy,jz));
  vec3 corrected=normalSource.x*cross(jy,jz)+normalSource.y*cross(jz,jx)+normalSource.z*cross(jx,jy);
  if(abs(determinant)>.0001&&dot(corrected,corrected)>.00000001)normalSource=normalize(corrected)*sign(determinant);
  source+=delta;
}`;
function installFaceControls(lab){
  const panel=document.createElement('section');panel.id='face-panel';panel.hidden=true;
  panel.innerHTML=`<p>人物长期中性脸、局部残差与临时表情分层保存。先调结构比例，再做局部收尾；微笑、眨眼和皱眉不会覆盖人物长相。</p>
    <button id="face-closeup">面部近景</button><button id="face-lip-closeup">嘴唇近景</button><button id="face-neutral">清除表情（回到本人的中性脸）</button>
    <label><input id="face-enabled" type="checkbox" checked>显示形变</label>
    <h3>1 · 固定身份起点</h3><div id="face-identities"></div>
    <button id="face-reset-identity">重置身份为参考脸</button><button id="face-verify-separation">检查身份/表情分层</button>
    <h3>2 · 结构脸型参数</h3><div id="face-shape"></div><output id="face-landmark-summary"></output>
    <h3>3 · 固定身份局部残差</h3><label>控制点 <select id="face-node"></select></label>
    <label><input id="face-mirror" type="checkbox">左右联动</label>
    <label><input id="face-heat" type="checkbox">显示所选点影响范围</label>
    <div id="face-axes"></div><button id="face-reset-node">清零所选点残差</button>
    <label>采样步幅（毫米）<input id="face-step" type="number" value="0.5" min="0.1" max="1" step="0.1"></label>
    <button id="face-prev">上一采样</button><button id="face-next">下一采样</button><button id="face-exit-sample">结束采样并还原</button>
    <p id="face-sample-label">逐点、逐轴、正负位移；开始时暂存当前身份与表情。</p><output id="face-coverage"></output>
    <button id="face-export-samples">导出采样读数与步骤</button>
    <h3>4 · 临时表情示例</h3><div id="face-presets"></div>
    <label>示例强度 <input id="face-intensity" type="range" min="0" max="1" step="0.01" value="1"><output id="face-intensity-value">100%</output></label>
    <button id="face-demo">依次演示</button><button id="face-stop">停止并还原</button>
    <details><summary>单独调整 ${FACE_RECIPE.channels.length} 项表情通道</summary><div id="face-channels"></div></details>
    <button id="face-export">导出身份与表情配方</button><label>导入面部配方<input id="face-import" type="file" accept=".json,application/json"></label>
    <p class="settings-hint">十三项结构参数编译为中性脸位移，局部控制点只保存残差。当前仍未包含真实下颌关节、牙齿和舌头。</p>
    <output id="face-status" role="status" aria-live="polite"></output>`;
  const style=document.createElement('style');style.textContent=`#face-panel label{display:block;margin:10px 0}#face-panel select{max-width:100%}#face-panel input[type=range]{width:100%;accent-color:#41745e}#face-panel input[type=number]{width:90px}#face-panel output{font-variant-numeric:tabular-nums;overflow-wrap:anywhere}#face-panel button{font:inherit}#face-coverage{display:block;font-size:12px}#face-panel details{margin:12px 0}#face-panel summary{color:inherit}#face-panel .face-slider{display:grid;grid-template-columns:1fr auto}#face-panel .face-slider input{grid-column:1/-1}`;
  document.head.append(style);document.body.append(panel);const el=id=>panel.querySelector('#face-'+id);
  const initialFace=validateFacePose(lab.human.characterPreset.appearance.face);
  let enabled=true,heatmap=false,selected=0,resolved=resolveFaceOffsets(initialFace),demo=null,sampling=null,transition=null,presetId=null,identityPresetId=faceIdentityPreset(initialFace.identity)?.id||null;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const api={
  export:()=>validateFacePose(lab.human.characterPreset.appearance.face),
  identity:()=>copy(api.export().identity),
  expression:()=>copy(api.export().expression),
  identityPresets:()=>copy(FACE_IDENTITY_PRESETS),
  shapeParameters:()=>copy(FACE_IDENTITY_PARAMETERS),
  landmarks:()=>copy(resolved.landmarks),
  resetTransient(){demo=null;sampling=null;transition=null;presetId=null;},
  apply(input){
    faceObject(input,'面部配方');const previous=api.export(),normalised=validateFacePose(input);
    const ownsIdentity=faceHas(input,'identity')||faceHas(input,'offsetsMm'),pose=ownsIdentity?normalised:{...normalised,identity:copy(previous.identity)};
    const next=resolveFaceOffsets(pose);api.stop();sampling=null;presetId=null;commit(pose,next);api.refresh();return api.export();
  },
  preset(id,intensity=1){faceNumber(intensity,0,1,'示例强度');const preset=FACE_RECIPE.presets.find(p=>p.id===id);if(!preset)throw Error('未知表情示例');
    const result=api.apply({weights:Object.fromEntries(Object.entries(preset.weights).map(([key,value])=>[key,value*intensity]))});presetId=id;api.refresh();return result;},
  setWeight(id,value){const pose=api.export();return api.apply({...pose,expression:{...pose.expression,weights:{...pose.expression.weights,[id]:value}}});},
  setOffset(id,offset,mirror=false){if(!FACE_NODE_INDEX.has(id))throw Error('未知面部控制点');
    const pose=api.export(),offsetsMm={...pose.identity.neutralOffsetsMm,[id]:offset};
    const other=FACE_RECIPE.nodes[FACE_NODE_INDEX.get(id)].mirror;if(mirror&&other)offsetsMm[other]=[-offset[0],offset[1],offset[2]];
    return api.apply({...pose,identity:{...pose.identity,neutralOffsetsMm:offsetsMm}});},
  setShapeParameter(id,value){const parameter=FACE_IDENTITY_PARAMETER_MAP.get(id);if(!parameter)throw Error('未知结构脸型参数');
    const pose=api.export(),shape=validateFaceIdentityShape({...pose.identity.shape,[id]:value});identityPresetId=null;return api.apply({...pose,identity:{...pose.identity,shape}});},
  setIdentityPreset(id){const preset=FACE_IDENTITY_PRESETS.find(p=>p.id===id);if(!preset)throw Error('未知身份脸型起点');
    const pose=api.export();identityPresetId=id;return api.apply({...pose,identity:{schema:FACE_IDENTITY_SCHEMA,shape:copy(preset.shape),neutralOffsetsMm:copy(preset.offsetsMm)}});},
  resetIdentity(){return api.setIdentityPreset('reference');},
  clearExpression(){return api.apply({weights:{}});},
  verifySeparation(){
    const before=api.export(),smile=FACE_RECIPE.presets.find(p=>p.id==='smile'),withExpression=validateFacePose({identity:before.identity,expression:{weights:smile.weights}}),neutral=interpolateFacePose(withExpression,validateFacePose({identity:before.identity,expression:{weights:{}}}),1);
    const ok=faceIdentityKey(before.identity)===faceIdentityKey(neutral.identity);
    return {schema:'jarvis/face_separation_check@1',ok,identitySchema:before.identity.schema,expressionSchema:before.expression.schema,legacySchemaAccepted:FACE_LEGACY_SCHEMA,legacyOffsetsInterpretation:'neutral identity',visualAcceptance:false};
  },
  refresh(){resolved=resolveFaceOffsets(api.export());const pose=api.export(),node=FACE_RECIPE.nodes[selected],offset=pose.identity.neutralOffsetsMm[node.id]||[0,0,0],shape=pose.identity.shape;
  identityPresetId=faceIdentityPreset(pose.identity)?.id||null;
  el('node').value=node.id;el('enabled').checked=enabled;el('heat').checked=heatmap;
  for(const parameter of FACE_IDENTITY_PARAMETERS){const value=shape[parameter.id]||0;el('shape-'+parameter.id).value=value;el('shape-value-'+parameter.id).textContent=(value>=0?'+':'')+value.toFixed(2);}
  ['x','y','z'].forEach((axis,i)=>{el(axis).value=offset[i];el(axis+'-value').textContent=offset[i].toFixed(2)+' mm';});
  for(const c of FACE_RECIPE.channels){el('channel-'+c.id).value=pose.expression.weights[c.id]||0;el('value-'+c.id).textContent=Math.round((pose.expression.weights[c.id]||0)*100)+'%';}
  for(const button of el('identities').children)button.setAttribute('aria-pressed',String(button.dataset.identity===identityPresetId));
  for(const button of el('presets').children)button.setAttribute('aria-pressed',String(button.dataset.preset===presetId));
  const sample=lab.compact?.faceSampling?.nodes[selected];
  el('coverage').textContent=sample?`${node.label} · 覆盖 ${sample.coveredVertices} 个显示顶点 · 峰值权重 ${sample.peakWeight.toFixed(3)} · 最近距离 ${sample.nearestDistanceMm===null?'未知':sample.nearestDistanceMm.toFixed(2)+' mm'} · ${lab.compact.quality}${sample.peakWeight<.2?' · 覆盖偏弱，请复查控制点范围':''}`:'人物就绪后生成采样读数。';
  const landmarks=resolved.landmarks.values,jawWidth=Math.abs(landmarks.jawLeft[0]-landmarks.jawRight[0])*1000,noseProjection=landmarks.noseTip[2]*1000;
  el('landmark-summary').textContent=`共享标志点 ${Object.keys(landmarks).length} 个 · 下颌点间距 ${jawWidth.toFixed(1)} mm · 鼻尖参考深度 ${noseProjection.toFixed(1)} mm。`;
  const identity=faceIdentityPreset(pose.identity),expression=faceExpressionPreset(pose.expression),limit=resolved.limited.length?'组合位移已限制到每点 '+FACE_RECIPE.maximumOffsetMm+' mm：'+resolved.limited.join('、')+'。':'';
  el('status').textContent=limit+'固定身份：'+(identity?.label||'自定义身份')+'；结构参数 '+Object.keys(shape).length+'/'+FACE_IDENTITY_PARAMETERS.length+'；临时表情：'+(expression?.label||(Object.keys(pose.expression.weights).length?'自定义表情':'中性'))+'。';
  needsRedraw=true;
},
uniforms(){return {offsets:resolved.values,muscles:resolved.muscles,eyelids:resolved.eyelids,lipOpen:resolved.lipOpen,enabled:enabled&&(resolved.lipOpen>0||[resolved.values,resolved.muscles,resolved.eyelids].some(values=>values.some(value=>value!==0)))?1:0,heatmap:heatmap?1:0,selected};},
  closeup(view='front'){
    lab.setCameraFollow(false);lab.tissue.setView('skin');
    const reference=lab.human.sourceBind.get('head'),current=lab.human.world('head'),s=lab.human.bodyMetrics.statureScale;
    const q=qnorm(qm(current.q,inv(reference.q))),translation=sub(current.p,rotate(q,reference.p)),r=lab.renderer;
    const landmarks=resolved.landmarks.values,lips=view==='lips',local=lips?[0,1,2].map(axis=>(landmarks.lipUpper[axis]+landmarks.lipLower[axis])*.5):[(landmarks.noseBridge[0]+landmarks.chin[0])*.5,(landmarks.forehead[1]+landmarks.chin[1])*.5,(landmarks.cheekLeft[2]+landmarks.cheekRight[2])*.5];
    r.target=add(rotate(q,local.map(v=>v*s)),translation);r.distance=(lips?.125:.50)*s;r.projection='perspective';r.pitch=0;
    r.yaw=lab.agent.yaw+(view==='side'?Math.PI/3:0);needsRedraw=true;
  },
  samples:()=>lab.compact?.faceSampling?copy(lab.compact.faceSampling):{state:'NotObserved'},
  samplePlan(stepMm=.5){faceNumber(stepMm,.1,1,'采样步幅');return FACE_RECIPE.nodes.flatMap(node=>[0,1,2].flatMap(axis=>[-1,1].map(sign=>({node:node.id,axis:['x','y','z'][axis],offsetsMm:{[node.id]:[0,1,2].map(i=>i===axis?sign*stepMm:0)}}))));},
  sampleStep(direction=1,stepMm=.5){if(direction!==1&&direction!==-1)throw Error('采样方向无效');const plan=api.samplePlan(stepMm);api.stop();
    if(!sampling)sampling={saved:api.export(),index:direction===1?-1:0};
    sampling.index=(sampling.index+direction+plan.length)%plan.length;const entry=plan[sampling.index];selected=FACE_NODE_INDEX.get(entry.node);
    commit(validateFacePose({offsetsMm:entry.offsetsMm}));identityPresetId=null;presetId=null;enabled=true;api.refresh();
    el('sample-label').textContent=`${sampling.index+1}/${plan.length} · ${FACE_RECIPE.nodes[selected].label} · ${entry.axis.toUpperCase()} ${entry.offsetsMm[entry.node][['x','y','z'].indexOf(entry.axis)]} mm（单侧隔离）`;return copy(entry);},
  endSample(){if(sampling){const saved=sampling.saved;sampling=null;commit(saved);api.refresh();}el('sample-label').textContent='采样已结束。';},
  play(){api.stop();api.endSample();demo={saved:api.export(),elapsed:0};enabled=true;heatmap=false;api.refresh();},
  stop(){if(demo||transition){const saved=(demo||transition).saved;demo=null;transition=null;presetId=null;commit(saved);api.refresh();}},
  tick(dt){
    if(transition){if(document.hidden)return;transition.elapsed+=Math.min(Math.max(dt,0),.1);
      const t=Math.min(1,transition.elapsed/transition.duration),weight=t*t*(3-2*t),label=transition.label;
      if(t===1){const target=transition.target;transition=null;commit(target);api.refresh();}
      else{commit(interpolateFacePose(transition.saved,transition.target,weight));el('status').textContent='正在切换：'+label;}
      return;
    }
    if(!demo||document.hidden)return;demo.elapsed+=Math.min(Math.max(dt,0),.1);
    const presets=FACE_RECIPE.presets.filter(p=>p.id!=='neutral'),index=Math.floor(demo.elapsed/3);
    if(index>=presets.length){api.stop();return;}
    const phase=demo.elapsed%3,ramp=phase<.8?phase/.8:phase<1.9?1:Math.max(0,(2.7-phase)/.8),weight=ramp*ramp*(3-2*ramp)*Number(el('intensity').value),preset=presets[index];
    commit(validateFacePose({identity:demo.saved.identity,expression:{weights:Object.fromEntries(Object.entries(preset.weights).map(([key,value])=>[key,value*weight]))}}));
    el('status').textContent='正在演示：'+preset.label;needsRedraw=true;
  },
  report:()=>{const profile=api.export();return {schema:FACE_SCHEMA,recipe:copy(FACE_RECIPE),parameters:profile,identity:copy(profile.identity),expression:copy(profile.expression),identityModel:{shapeSchema:FACE_IDENTITY_SHAPE_SCHEMA,landmarkSchema:FACE_LANDMARK_SCHEMA,parameters:copy(FACE_IDENTITY_PARAMETERS),landmarks:copy(resolved.landmarks)},separation:api.verifySeparation(),sampling:api.samples(),limitedNodes:resolved.limited.slice(),enabled,generatedGeometryIncluded:false,runtimeVerified:false,visualAcceptance:false};}
};
function commit(pose,next=resolveFaceOffsets(pose)){const profile=validateFacePose(pose);lab.human.characterPreset={...lab.human.characterPreset,appearance:{...lab.human.characterPreset.appearance,face:profile}};resolved=next;identityPresetId=faceIdentityPreset(profile.identity)?.id||null;needsRedraw=true;}
function transitionPreset(id,intensity=1){
  const preset=FACE_RECIPE.presets.find(p=>p.id===id);if(!preset)throw Error('未知表情示例');faceNumber(intensity,0,1,'示例强度');
  const saved=api.export(),target=validateFacePose({identity:saved.identity,expression:{weights:Object.fromEntries(Object.entries(preset.weights).map(([key,value])=>[key,value*intensity]))}});
  api.stop();sampling=null;commit(saved);transition={saved,target,elapsed:0,duration:.45,label:preset.label};presetId=id;api.refresh();
}
const edit=operation=>{try{operation();}catch(error){el('status').textContent=error.message;}};
  for(const parameter of FACE_IDENTITY_PARAMETERS){const row=document.createElement('label');row.className='face-slider';row.innerHTML=`<span>${parameter.label}</span><output id="face-shape-value-${parameter.id}">0.00</output><input id="face-shape-${parameter.id}" aria-label="${parameter.label}" type="range" min="${parameter.min}" max="${parameter.max}" step="${parameter.step}" value="0">`;el('shape').append(row);el('shape-'+parameter.id).oninput=e=>edit(()=>api.setShapeParameter(parameter.id,Number(e.target.value)));}
  for(const node of FACE_RECIPE.nodes){const option=document.createElement('option');option.value=node.id;option.textContent=node.label;el('node').append(option);}
  for(const [i,axis]of ['x','y','z'].entries()){
    const row=document.createElement('label');row.className='face-slider';row.innerHTML=`<span>${['X 横向（正值向人物左）','Y 上下（正值向上）','Z 前后（正值向前）'][i]}</span><output id="face-${axis}-value"></output><input id="face-${axis}" aria-label="${axis.toUpperCase()} 局部位移，毫米" type="range" min="-${FACE_RECIPE.maximumOffsetMm}" max="${FACE_RECIPE.maximumOffsetMm}" step="0.1" value="0">`;el('axes').append(row);
    el(axis).oninput=()=>edit(()=>api.setOffset(FACE_RECIPE.nodes[selected].id,['x','y','z'].map(a=>Number(el(a).value)),el('mirror').checked));
  }
  for(const channel of FACE_RECIPE.channels){const row=document.createElement('label');row.className='face-slider';
    row.innerHTML=`<span>${channel.label}</span><output id="face-value-${channel.id}">0%</output><input id="face-channel-${channel.id}" aria-label="${channel.label}" type="range" min="0" max="1" step="0.01" value="0">`;el('channels').append(row);
    el('channel-'+channel.id).oninput=e=>edit(()=>api.setWeight(channel.id,Number(e.target.value)));
  }
  for(const preset of FACE_IDENTITY_PRESETS){const button=document.createElement('button');button.textContent=preset.label;button.dataset.identity=preset.id;
  button.onclick=()=>edit(()=>api.setIdentityPreset(preset.id));el('identities').append(button);}
for(const preset of FACE_RECIPE.presets){const button=document.createElement('button');button.textContent=preset.label;button.dataset.preset=preset.id;
  button.onclick=()=>edit(()=>{enabled=true;heatmap=false;transitionPreset(preset.id,Number(el('intensity').value));});el('presets').append(button);}
el('node').onchange=()=>{selected=FACE_NODE_INDEX.get(el('node').value);api.refresh();};
  el('heat').onchange=()=>{heatmap=el('heat').checked;needsRedraw=true;};el('enabled').onchange=()=>{enabled=el('enabled').checked;needsRedraw=true;};
  el('neutral').onclick=()=>edit(()=>transitionPreset('neutral'));
  el('reset-identity').onclick=()=>edit(()=>api.resetIdentity());
  el('verify-separation').onclick=()=>{const result=api.verifySeparation();el('status').textContent=result.ok?'通过：微笑、眨眼等表情不会改写固定身份中性脸。':'失败：固定身份数据发生变化。';};
  el('closeup').onclick=()=>api.closeup('front');
  el('lip-closeup').onclick=()=>api.closeup('lips');
  el('reset-node').onclick=()=>edit(()=>api.setOffset(FACE_RECIPE.nodes[selected].id,[0,0,0],el('mirror').checked));
  el('next').onclick=()=>edit(()=>api.sampleStep(1,Number(el('step').value)));el('prev').onclick=()=>edit(()=>api.sampleStep(-1,Number(el('step').value)));el('exit-sample').onclick=()=>api.endSample();
  el('intensity').oninput=()=>{el('intensity-value').textContent=Math.round(Number(el('intensity').value)*100)+'%';if(presetId)edit(()=>api.preset(presetId,Number(el('intensity').value)));};
  el('demo').onclick=()=>api.play();el('stop').onclick=()=>{api.stop();api.endSample();};
  el('export').onclick=()=>hfDownload('face-profile.json',JSON.stringify(api.export(),null,2),'application/json');
  el('export-samples').onclick=()=>edit(()=>hfDownload('face-sampling.json',JSON.stringify({recipeRevision:FACE_RECIPE.revision,samples:api.samples(),plan:api.samplePlan(Number(el('step').value)),visualAcceptance:false},null,2),'application/json'));
  el('import').onchange=async()=>{try{const file=el('import').files[0];if(!file)return;if(file.size>65536)throw Error('面部配方超过 64 KiB');api.apply(JSON.parse(await file.text()));}catch(error){el('status').textContent=error.message;}finally{el('import').value='';}};
  window.addEventListener('pagehide',event=>{if(!event.persisted){demo=null;sampling=null;transition=null;panel.remove();style.remove();}});
  api.refresh();return api;
}
