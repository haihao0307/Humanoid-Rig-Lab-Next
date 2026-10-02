/* Neutral identity parameters and shared facial landmarks.
 * Values are authored in the existing R2 canonical head frame. The model
 * compiles a small, interpretable identity vector into millimetre residuals
 * consumed by the existing bounded facial deformation field. It is not a
 * statistical face model, scan, anthropometric dataset or tissue simulation. */
const FACE_IDENTITY_SHAPE_SCHEMA='jarvis/face_identity_shape@1';
const FACE_LANDMARK_SCHEMA='jarvis/face_landmarks@1';
const FACE_IDENTITY_PARAMETERS=Object.freeze([
  {id:'headWidth',label:'整体头部宽度',nodes:{}},
  {id:'headHeight',label:'整体头部长度',nodes:{}},
  {id:'headDepth',label:'整体头部纵深',nodes:{}},
  {id:'eyeSpacing',label:'眼眶间距',nodes:{}},
  {id:'cranialWidth',label:'颞额宽度',nodes:{templeLeft:[3.8,0,0],templeRight:[-3.8,0,0],browOuterLeft:[1.2,0,0],browOuterRight:[-1.2,0,0]}},
  {id:'faceHeight',label:'面部纵向长度',nodes:{forehead:[0,2.6,0],browInnerLeft:[0,.8,0],browInnerRight:[0,.8,0],browOuterLeft:[0,.8,0],browOuterRight:[0,.8,0],jawLeft:[0,-.7,0],jawRight:[0,-.7,0],chin:[0,-1.8,0]}},
  {id:'cheekboneWidth',label:'颧部宽度',nodes:{cheekLeft:[3.6,0,0],cheekRight:[-3.6,0,0],templeLeft:[.6,0,0],templeRight:[-.6,0,0]}},
  {id:'cheekProjection',label:'面颊前突',nodes:{cheekLeft:[0,0,2.8],cheekRight:[0,0,2.8]}},
  {id:'jawWidth',label:'下颌宽度',nodes:{mouthLeft:[.4,0,0],mouthRight:[-.4,0,0]}},
  {id:'lowerFaceFullness',label:'下脸饱满度',nodes:{jawLeft:[0,0,2.4],jawRight:[0,0,2.4],cheekLeft:[0,0,.5],cheekRight:[0,0,.5],chin:[0,0,.6]}},
  {id:'chinLength',label:'下巴长度',nodes:{jawLeft:[0,-.5,0],jawRight:[0,-.5,0],chin:[0,-3.2,0]}},
  {id:'chinProjection',label:'下巴前突',nodes:{chin:[0,0,2.5]}},
  {id:'noseWidth',label:'鼻翼宽度',nodes:{noseLeft:[2.5,0,0],noseRight:[-2.5,0,0]}},
  {id:'noseLength',label:'鼻部纵向长度',nodes:{noseTip:[0,-2.4,0],noseLeft:[0,-1.1,0],noseRight:[0,-1.1,0],philtrum:[0,-.35,0]}},
  {id:'noseProjection',label:'鼻梁鼻尖前突',nodes:{noseBridge:[0,0,1.5],noseTip:[0,0,3],noseLeft:[0,0,1],noseRight:[0,0,1]}},
  {id:'mouthWidth',label:'口裂宽度',nodes:{mouthLeft:[2.8,0,0],mouthRight:[-2.8,0,0]}},
  {id:'lipFullness',label:'唇部厚度',nodes:{lipUpper:[0,.25,1.6],lipLower:[0,-.25,1.9]}}
].map(parameter=>Object.freeze({...parameter,min:-1,max:1,step:.01,defaultValue:0,nodes:Object.freeze(parameter.nodes)})));
const FACE_IDENTITY_PARAMETER_MAP=new Map(FACE_IDENTITY_PARAMETERS.map(parameter=>[parameter.id,parameter]));
const FACE_IDENTITY_REFERENCE_LANDMARKS=Object.freeze([
  {id:'forehead',label:'额部中央',node:'forehead',position:[0,1.553,.168]},
  {id:'templeLeft',label:'左颞部',node:'templeLeft',position:[.059,1.528,.153]},
  {id:'templeRight',label:'右颞部',node:'templeRight',position:[-.059,1.528,.153]},
  {id:'browInnerLeft',label:'左眉头',node:'browInnerLeft',position:[.016,1.539,.18]},
  {id:'browInnerRight',label:'右眉头',node:'browInnerRight',position:[-.017,1.539,.18]},
  {id:'browOuterLeft',label:'左眉尾',node:'browOuterLeft',position:[.0475,1.539,.17]},
  {id:'browOuterRight',label:'右眉尾',node:'browOuterRight',position:[-.0485,1.539,.17]},
  {id:'cheekLeft',label:'左颧颊',node:'cheekLeft',position:[.05,1.482,.163]},
  {id:'cheekRight',label:'右颧颊',node:'cheekRight',position:[-.051,1.482,.163]},
  {id:'jawLeft',label:'左下颌',node:'jawLeft',position:[.049,1.447,.159]},
  {id:'jawRight',label:'右下颌',node:'jawRight',position:[-.049,1.447,.159]},
  {id:'noseBridge',label:'鼻梁',node:'noseBridge',position:[0,1.518,.186]},
  {id:'noseTip',label:'鼻尖',node:'noseTip',position:[0,1.487,.201]},
  {id:'noseLeft',label:'左鼻翼',node:'noseLeft',position:[.015,1.476,.186]},
  {id:'noseRight',label:'右鼻翼',node:'noseRight',position:[-.016,1.476,.186]},
  {id:'philtrum',label:'人中',node:'philtrum',position:[0,1.47,.188]},
  {id:'mouthLeft',label:'左口角',node:'mouthLeft',position:[.022,1.459,.181]},
  {id:'mouthRight',label:'右口角',node:'mouthRight',position:[-.023,1.459,.181]},
  {id:'lipUpper',label:'上唇中央',node:'lipUpper',position:[-.0006,1.462,.19]},
  {id:'lipLower',label:'下唇中央',node:'lipLower',position:[-.0006,1.452,.189]},
  {id:'chin',label:'颏前点',node:'chin',position:[-.0006,1.432,.184]}
]);
// An authored default character, independent of the neutral deformation basis.
// Other NPC recipes keep their own identities; these are design choices, not
// an ethnic template or a universal formula for attractiveness.
const FACE_SCULPTED_MALE_SHAPE=Object.freeze({headWidth:.16,headHeight:-.40,headDepth:.10,eyeSpacing:-.72,cranialWidth:-.12,faceHeight:-.20,cheekboneWidth:.48,cheekProjection:.18,jawWidth:.68,lowerFaceFullness:-.50,chinLength:-.10,chinProjection:.52,noseWidth:-.18,noseLength:-.20,noseProjection:.08,mouthWidth:.36,lipFullness:-.10});
const FACE_IDENTITY_PRESETS=Object.freeze([
  {id:'sculpted-male',label:'立体男性',shape:FACE_SCULPTED_MALE_SHAPE,offsetsMm:{}},
  {id:'reference',label:'参考中性',shape:{},offsetsMm:{}},
  {id:'slender',label:'清瘦窄长',shape:{cranialWidth:-.25,faceHeight:.35,cheekboneWidth:-.25,jawWidth:-.45,chinLength:.25,noseProjection:.1},offsetsMm:{}},
  {id:'broad',label:'宽阔方正',shape:{cranialWidth:.35,faceHeight:-.1,cheekboneWidth:.45,jawWidth:.5,lowerFaceFullness:.2},offsetsMm:{}},
  {id:'round',label:'圆润饱满',shape:{cranialWidth:.25,faceHeight:-.25,cheekboneWidth:.3,cheekProjection:.35,jawWidth:.15,lowerFaceFullness:.45,chinLength:-.3},offsetsMm:{}},
  {id:'angular',label:'棱角清晰',shape:{cranialWidth:-.1,faceHeight:.25,cheekboneWidth:.3,jawWidth:.3,lowerFaceFullness:-.35,chinLength:.35,chinProjection:.25,noseProjection:.15},offsetsMm:{}}
]);
function faceIdentityObject(value,label){if(!value||typeof value!=='object'||Array.isArray(value))throw Error(label+'必须为对象');}
function validateFaceIdentityShape(input={}){
  faceIdentityObject(input,'结构脸型');const shape={};
  for(const [id,value]of Object.entries(input)){
    const parameter=FACE_IDENTITY_PARAMETER_MAP.get(id);if(!parameter)throw Error('未知结构脸型参数 '+id);
    if(typeof value!=='number'||!Number.isFinite(value)||value<parameter.min||value>parameter.max)throw Error(parameter.label+'超出范围 -1 至 1');
    if(Math.abs(value)>1e-9)shape[id]=value;
  }
  return shape;
}
function faceIdentityShapeKey(input={}){const shape=validateFaceIdentityShape(input);return FACE_IDENTITY_PARAMETERS.map(parameter=>parameter.id+':'+Number(shape[parameter.id]||0).toFixed(4)).join('|');}
function compileFaceIdentityShape(input={}){
  const shape=validateFaceIdentityShape(input),offsetsMm={};
  for(const parameter of FACE_IDENTITY_PARAMETERS){const weight=shape[parameter.id]||0;if(weight===0)continue;
    for(const [node,delta]of Object.entries(parameter.nodes)){const value=offsetsMm[node]||[0,0,0];offsetsMm[node]=value.map((component,axis)=>component+delta[axis]*weight);}
  }
  return offsetsMm;
}
function mergeFaceIdentityOffsets(...layers){
  const merged={};for(const layer of layers){faceIdentityObject(layer||{},'面部身份位移');for(const [node,delta]of Object.entries(layer||{})){
    if(!Array.isArray(delta)||delta.length!==3||delta.some(value=>typeof value!=='number'||!Number.isFinite(value)))throw Error('面部身份位移无效 '+node);
    const value=merged[node]||[0,0,0];merged[node]=value.map((component,axis)=>component+delta[axis]);
  }}return merged;
}
function faceIdentityLandmarks(input={}){
  const shape=validateFaceIdentityShape(input),offsetsMm=compileFaceIdentityShape(shape),proportions=faceIdentityProportions(shape),values={};
  for(const landmark of FACE_IDENTITY_REFERENCE_LANDMARKS){
    const delta=offsetsMm[landmark.node]||[0,0,0],local=landmark.position.map((value,axis)=>value+delta[axis]*.001);
    // Match the renderer's local deformation -> shared sculpt -> identity order.
    values[landmark.id]=faceIdentityWarp(compactHeadSculptPoint(local).point,proportions).point;
  }
  return {schema:FACE_LANDMARK_SCHEMA,shapeSchema:FACE_IDENTITY_SHAPE_SCHEMA,frame:'R2 source metres before X reflection and skeletal skinning; positive X is character left',shape,values,derivedFrom:'authored reference landmarks plus structural offsets, shared head sculpt, then structural identity proportions',measuredAnatomy:false,visualAcceptance:false};
}
// Independent named streams keep an existing feature stable when another
// parameter is added. Correlations are authored shape choices, not demographics.
function faceIdentityRandom(seed,name){
  if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('面部种子应为 0 至 4294967295 的整数');
  let h=(seed^0x811c9dc5)>>>0;for(let i=0;i<name.length;i++)h=Math.imul(h^name.charCodeAt(i),0x01000193)>>>0;
  h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);return ((h^(h>>>16))>>>0)/4294967296;
}
function sampleFaceIdentity(seed){
  const signed=name=>faceIdentityRandom(seed,name)*2-1,width=signed('width'),length=signed('length'),fullness=signed('fullness');
  const correlations={headWidth:width*.50,headHeight:length*.48,headDepth:fullness*.25,eyeSpacing:width*.18,cranialWidth:width*.45,cheekboneWidth:width*.4,jawWidth:width*.3,
    faceHeight:length*.45,chinLength:length*.3,noseLength:length*.2,
    lowerFaceFullness:fullness*.4,cheekProjection:fullness*.25,lipFullness:fullness*.12};
  const shape={};for(const p of FACE_IDENTITY_PARAMETERS)shape[p.id]=Math.round(((correlations[p.id]||0)+signed(p.id)*.42)*10000)/10000;
  return {schema:'jarvis/face_identity@2',seed,shape:validateFaceIdentityShape(shape),neutralOffsetsMm:{}};
}
function faceIdentityProportions(shape={}){return new Float32Array(['headWidth','headHeight','headDepth','eyeSpacing','jawWidth'].map(k=>shape[k]||0));}
// One continuous map owns head skin, eyes, lids, ears and hair. Identity does
// not stretch one component while leaving its contact partner behind.
function faceIdentityWarp(point,weights){
  const p=[...point],t=Math.max(0,Math.min(1,(p[1]-1.395)/.075)),w=t*t*t*(t*(6*t-15)+10),dw=30*t*t*(t-1)*(t-1)/.075;
  const a=[.10*weights[0],.10*weights[1],.12*weights[2]],r=[p[0],p[1]-1.46,p[2]-.13];
  const delta=r.map((v,i)=>v*a[i]*w),j=[[1+a[0]*w,a[0]*r[0]*dw,0],[0,1+a[1]*(w+r[1]*dw),0],[0,a[2]*r[2]*dw,1+a[2]*w]];
  for(const side of [-1,1]){
    const radii=[.028,.026,.040],q=[(p[0]-side*.0304)/radii[0],(p[1]-1.518)/radii[1],(p[2]-.166)/radii[2]],r2=q.reduce((s,v)=>s+v*v,0);
    if(r2>=1)continue;const u=1-r2,gain=side*.0025*weights[3];delta[0]+=gain*u*u*u;
    for(let k=0;k<3;k++)j[0][k]+=gain*(-6*u*u*q[k]/radii[k]);
  }
  // Width is centred on the rear mandibular body, with little effect on the
  // anterior mouth-side cheek. The same field moves skin, fitted beard and
  // every attached feature; its analytic derivative also owns the normals.
  for(const side of [-1,1]){
    const radii=[.039,.033,.055],q=[(p[0]-side*.050)/radii[0],(p[1]-1.449)/radii[1],(p[2]-.123)/radii[2]],r2=q.reduce((s,v)=>s+v*v,0);
    if(r2>=1)continue;const u=1-r2,gain=side*.0075*(weights[4]||0);delta[0]+=gain*u*u*u;
    for(let k=0;k<3;k++)j[0][k]+=gain*(-6*u*u*q[k]/radii[k]);
  }
  return {point:p.map((v,i)=>v+delta[i]),jacobian:j};
}
const FACE_IDENTITY_GLSL=`
uniform vec4 faceProportions;
uniform float faceJawWidth;
void compactFaceIdentity(inout vec3 p,inout vec3 n){
  float t=clamp((p.y-1.395)/.075,0.,1.),w=t*t*t*(t*(6.*t-15.)+10.),dw=30.*t*t*(t-1.)*(t-1.)/.075;
  vec3 a=faceProportions.xyz*vec3(.10,.10,.12),r=p-vec3(0.,1.46,.13),delta=r*a*w;
  vec3 jx=vec3(1.+a.x*w,0.,0.),jy=vec3(a.x*r.x*dw,1.+a.y*(w+r.y*dw),a.z*r.z*dw),jz=vec3(0.,0.,1.+a.z*w);
  for(int i=0;i<2;i++){
    float side=i==0?-1.:1.;vec3 radii=vec3(.028,.026,.040),q=(p-vec3(side*.0304,1.518,.166))/radii;
    float r2=dot(q,q);if(r2>=1.)continue;float u=1.-r2,gain=side*.0025*faceProportions.w;
    delta.x+=gain*u*u*u;vec3 gradient=-6.*gain*u*u*q/radii;jx.x+=gradient.x;jy.x+=gradient.y;jz.x+=gradient.z;
  }
  for(int i=0;i<2;i++){
    float side=i==0?-1.:1.;vec3 radii=vec3(.039,.033,.055),q=(p-vec3(side*.050,1.449,.123))/radii;
    float r2=dot(q,q);if(r2>=1.)continue;float u=1.-r2,gain=side*.0075*faceJawWidth;
    delta.x+=gain*u*u*u;vec3 gradient=-6.*gain*u*u*q/radii;jx.x+=gradient.x;jy.x+=gradient.y;jz.x+=gradient.z;
  }
  n=normalize(n.x*cross(jy,jz)+n.y*cross(jz,jx)+n.z*cross(jx,jy));p+=delta;
}`;
