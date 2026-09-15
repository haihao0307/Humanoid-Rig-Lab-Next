/* Bridge the fitted function surface to the existing world, camera and actions.
 * This module is assembled into the body iframe. It never creates a second rig.
 * Joint transforms come from the Motion-Lab pose adapter used by Agent.
 */
const COMPACT_PARAMETERS=Object.freeze(/*__COMPACT_PARAMETERS_JSON__*/);
const COMPACT_APPEARANCE=Object.freeze(/*__COMPACT_APPEARANCE_JSON__*/);
const COMPACT_BUILD='r27-continuous-mandible-neck-shoulder-cap-contact-standing-'+COMPACT_APPEARANCE.version+'-'+COMPACT_PARAMETERS.groups.map(g=>g.sha256.slice(0,12)).join('-');
const COMPACT_PALETTE_UNIT=5;
const COMPACT_EYES={
  left:{centre:[.02975,1.51784,.16130],normal:[.0624,-.0278,.9977]},
  right:{centre:[-.03094,1.51784,.16131],normal:[-.0641,-.0354,.9973]}
};
const COMPACT_EYE_COORDINATES=`uniform vec3 compactEyeCentre,compactEyeU,compactEyeV;
vec2 compactEyeUV(vec3 p){vec3 relativeEye=p-compactEyeCentre;return vec2(dot(relativeEye,compactEyeU),dot(relativeEye,compactEyeV))/.0064;}`;
const COMPACT_SCLERA_APERTURE=`if(compactFeature>4.5&&compactFeature<5.5&&length(compactEyeUV(R))<${(COMPACT_EYE_ANATOMY.iris.outerRadius/.0064*.985).toFixed(6)}&&dot(R-compactEyeCentre,cross(compactEyeU,compactEyeV))>${(-COMPACT_EYE_ANATOMY.recess-.001).toFixed(6)})discard;`;
const COMPACT_START=performance.now();
let compactPendingWorker=null,compactPendingCancel=null,compactSurfaceQueue=Promise.resolve(),compactQueueEpoch=0,compactQueueCancelReason='人体计算已取消';
let compactProgressSavedAt=-Infinity,compactProgressSavedGroup='';
const compactRunLog=(()=>{try{const value=JSON.parse(sessionStorage.getItem('human-reconstruction-last-runs')||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}})();
window.__compactPreviousRuns={...compactRunLog};
function recordCompactProgress(value){
  const now=performance.now();if(value.state==='running'&&now-compactProgressSavedAt<1000&&compactProgressSavedGroup===value.group)return;
  compactProgressSavedAt=now;compactProgressSavedGroup=value.group;
  const record={revision:'r15',job:value.job,quality:value.quality,state:value.state,group:value.group,phase:value.phase,domainId:value.domainId,domain:value.domain,total:value.total,evaluations:value.evaluations,triangles:value.triangles,canonicalVertices:value.canonicalVertices,adaptiveSplits:value.adaptiveSplits,refinementBudget:value.refinementBudget,error:value.error,elapsedMs:value.elapsedMs??now-value.startedAt,at:Date.now()};
  compactRunLog[value.job||'surface']=record;
  try{sessionStorage.setItem('human-reconstruction-last-runs',JSON.stringify(compactRunLog));}catch{}
}
function publishCompactProgress(progress){
  const previous=window.__compactLoading||{},now=performance.now();
  const value=window.__compactLoading={...(progress.state==='failed'?previous:{quality:previous.quality,job:previous.job,startedAt:previous.startedAt}),...progress,updatedAt:progress.state==='failed'?previous.updatedAt:now};
  const group=({queue:'等待另一个人物页面完成计算',parameters:'读取重建参数',body:'生成身体',left:'生成左腿',detail:'生成头面手足',features:'生成五官',collar:'生成脚踝',hair:'生成毛发',connections:'连接曲面边界',normals:'整理表面法线',binding:'计算蒙皮绑定',upload:'上传显示资源',ready:'人物重建完成'})[value.group]||'准备人物重建';
  const phase=({graph:'建立表面邻接',priors:'生成初始权重',diffusion:'平滑接口权重',encode:'编码权重',chunks:'绑定分块','personal-shape':'生成个人体型与支撑点',conform:'统一边细分',roots:'生成发根',strands:'生成发丝'})[value.phase];
  const message=value.error||group+(phase?' · '+phase:'')+(Number.isFinite(value.domain)&&Number.isFinite(value.total)?` ${value.domain}/${value.total}`:'');
  value.message=message;
  recordCompactProgress(value);
  const panel=window.parent.document.querySelector('#compact-progress');if(panel)panel.textContent=message;
  if(window.__humanStartup?.status==='initializing'&&window.__humanStartup.stage==='reconstruction'){
    window.__humanStartup={status:'initializing',stage:'reconstruction',message};document.getElementById('loading').textContent=message;
    window.dispatchEvent(new CustomEvent('humanlab:startup-progress',{detail:window.__humanStartup}));
  }
}
function cancelCompactSurface(reason='人体计算已取消'){
  compactQueueEpoch++;compactQueueCancelReason=reason;
  if(compactPendingCancel)compactPendingCancel(reason);
  else{compactPendingWorker?.terminate();compactPendingWorker=null;}
}
window.addEventListener('pagehide',event=>{if(!event.persisted)cancelCompactSurface('人物页面已关闭');});
function loadCompactSurface(...args){
  // A body and its hair share the same generation lane with all other actors.
  // Keep only one live worker; a failed actor must not poison the queue.
  const epoch=compactQueueEpoch,task=compactSurfaceQueue.then(()=>{
    if(epoch!==compactQueueEpoch){const error=Error(compactQueueCancelReason);error.name='AbortError';throw error;}
    return loadCompactSurfaceJob(...args);
  });
  compactSurfaceQueue=task.catch(()=>{});return task;
}
async function loadCompactSurfaceJob(quality='preview',includeHair=false,rig=null,job='surface',hairProfile=null,shape=rig?.shape){
  if(job!=='hair'&&!rig)throw Error('重建需要同源骨架信息');
  window.__compactLoading={quality,job,startedAt:performance.now()};publishCompactProgress({group:'queue',state:'queued'});
  const queueController=new AbortController(),cancelQueued=reason=>queueController.abort(reason);compactPendingCancel=cancelQueued;
  const run=()=>new Promise((resolve,reject)=>{
    const url=new URL('reconstruction/worker.mjs',document.baseURI);url.searchParams.set('v',COMPACT_BUILD);const worker=new window.Worker(url,{type:'module'});compactPendingWorker=worker;
    publishCompactProgress({group:'parameters',state:'running'});
    let finished=false,lastProgressAt=performance.now();const startedAt=lastProgressAt;
    // Active work can legitimately exceed a wall-clock deadline on a slower
    // machine. Only a lack of reported work is treated as a stalled worker.
    const watchdog=setInterval(()=>{const now=performance.now();if(now-lastProgressAt>45000){const last=window.__compactLoading?.message||'未知阶段';finish(Error('人物重建已 45 秒无进度，已停止计算。最后阶段：'+last));}},1000);
    const finish=(error,data)=>{if(finished)return;finished=true;clearInterval(watchdog);worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();
      if(compactPendingWorker===worker){compactPendingWorker=null;compactPendingCancel=null;}
      publishCompactProgress({group:error?'failed':'upload',state:error?'failed':'running',error:error?.message,elapsedMs:performance.now()-startedAt});
      if(error)reject(error);else resolve(data);
    };
    compactPendingCancel=reason=>{const error=Error(reason);error.name='AbortError';finish(error);};
    worker.onmessage=({data})=>{
      if(finished||compactPendingWorker!==worker)return;
      if(data.type==='progress'){lastProgressAt=performance.now();publishCompactProgress({...data.progress,state:'running'});return;}
      if(data.type==='error'){finish(Error(data.message));return;}
      if(data.type==='complete')finish(null,data);
    };
    worker.onerror=event=>finish(Error(event.message||'人体计算线程失败'));
    worker.onmessageerror=()=>finish(Error('人体计算数据传递失败'));
    try{worker.postMessage({quality,revision:COMPACT_BUILD,includeHair,rig,job,hairProfile:hairProfile??{},shape});}catch(error){finish(error);}
  });
  try{
    // Do not create a worker, allocate its data, or start its stall timer while
    // waiting. The browser releases this lock if a tab or worker owner closes.
    return navigator.locks?.request?await navigator.locks.request('human-reconstruction-v1',{signal:queueController.signal},run):await run();
  }catch(error){
    if(queueController.signal.aborted){const cancelled=Error(String(queueController.signal.reason||'计算已取消'));cancelled.name='AbortError';throw cancelled;}
    if(compactPendingCancel===cancelQueued)publishCompactProgress({state:'failed',error:error.message});
    throw error;
  }finally{if(compactPendingCancel===cancelQueued)compactPendingCancel=null;}
}
const COMPACT_VERTEX=`#version 300 es
precision highp float;
precision highp int;
layout(location=0)in vec3 position;
layout(location=1)in vec2 normal;
layout(location=2)in vec4 skinJoints;
layout(location=3)in vec4 skinWeights;
layout(location=4)in vec3 regionColor;
layout(location=5)in vec4 skinJointsExtra;
layout(location=6)in vec4 skinWeightsExtra;
layout(location=7)in vec3 canonicalPosition;
layout(location=15)in uvec4 axillaCorrective;
uniform sampler2D compactPalette;
uniform vec3 compactOrigin,compactExtent,compactColor;
uniform mat4 viewProjection,lightVP;
uniform float compactKind,compactRegions,compactStatureScale;
uniform float compactEarClearance;
out vec3 P,N,C,R;out vec4 L;out float AO,MK,activation;
out vec3 personalRestPosition;
vec3 compactRotate(vec4 q,vec3 p){return p+2.*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
vec3 compactNormal(vec2 e){vec3 n=vec3(e,1.-abs(e.x)-abs(e.y));if(n.z<0.)n.xy=(1.-abs(n.yx))*mix(vec2(-1.),vec2(1.),step(vec2(0.),n.xy));return normalize(n);}
${COMPACT_MUSCLE_GLSL}
${COMPACT_FACE_GLSL}
${COMPACT_EYE_LID_GLSL}
${compactLipMotionShader()}
// The external ear includes its own concha and tragus. The head envelope
// otherwise covers them with a flat side wall. Recess only the underlying
// cranial skin; keep the ear, canal backing and all triangle connectivity.
void compactClearEar(inout vec3 p,inout vec3 n){
  if(compactEarClearance<.5||p.y<1.484||p.y>1.529||p.z<.072||p.z>.108)return;
  vec2 q=(p.yz-vec2(1.5065,.090))/vec2(.0225,.018);
  float radius2=dot(q,q);if(radius2>=1.)return;
  float t=clamp((radius2-.35)/.65,0.,1.),falloff=1.-t*t*(3.-2.*t);
  float side=sign(p.x),u=clamp((abs(p.x)-.020)/.045,0.,1.);
  float gate=u*u*(3.-2.*u),gateDerivative=6.*u*(1.-u)/.045;
  float weightDerivative=-6.*t*(1.-t)/.65;
  vec2 slope=weightDerivative*2.*q/vec2(.0225,.018);
  // Jacobian determinant stays above 0.73: 8 mm * max slope 1.5/45 mm.
  // Transform the shading normal by the inverse transpose of this recess.
  float nx=n.x/(1.-.008*falloff*gateDerivative);
  n=normalize(vec3(nx,n.yz+side*.008*gate*slope*nx));
  p.x-=side*.008*gate*falloff;
}
void main(){
  vec3 source=canonicalPosition;R=canonicalPosition;
  vec3 personal=position*compactExtent+compactOrigin;personalRestPosition=vec3(-personal.x,personal.yz);
  vec3 n=compactNormal(normal);if(compactSourceEye>.5){
    if(compactSourceEye<1.5)source-=compactEyeNormal*${COMPACT_EYE_ANATOMY.recess.toFixed(6)};
    int sideOffset=compactEyeSide<.5?0:3;float blinkQ=clamp((compactLidState[sideOffset+2]-.35)/.65,0.,1.);
    source-=compactEyeNormal*${COMPACT_EYE_ANATOMY.blinkRetractionM}*blinkQ*blinkQ*(3.-2.*blinkQ);
  }compactLipMotion(source,n);compactLid(source,n);vec3 lidAttached=source,lidNormal=n;float faceHeat;compactFace(source,n,faceHeat);
  if(compactEyeLid>.5){float attachment=smoothstep(0.,.35,eyeLidParam.y);source=mix(lidAttached,source,attachment);n=normalize(mix(lidNormal,n,attachment));}
  compactClearEar(source,n);
  // Head F is exactly uniform stature; face/ear offsets stay in their authored
  // canonical head frame and are added to the already shaped rest surface.
  vec3 delta=source-canonicalPosition;
  vec3 p=personalRestPosition+vec3(-delta.x,delta.yz)*compactStatureScale;n.x=-n.x;
  if(compactMuscleEnabled>.5&&any(notEqual(axillaCorrective.xyz,uvec3(0)))){
    float weight=compactAxillaWeight[p.x<0.?0:1];
    vec3 lift=uintBitsToFloat(axillaCorrective.xyz);p+=vec3(-lift.x,lift.yz)*weight;
    vec2 encoded=vec2(int(axillaCorrective.w<<16)>>16,int(axillaCorrective.w)>>16)/32767.;
    vec3 liftedNormal=compactNormal(encoded);liftedNormal.x=-liftedNormal.x;
    n=normalize(mix(n,liftedNormal,weight));
  }
  float shoulderLbs=compactShoulderLbsWeight(p);compactMuscles(p,n);
  vec4 reference=texelFetch(compactPalette,ivec2(0,int(skinJoints.x+.5)),0),qr=vec4(0.),qd=vec4(0.);
  for(int k=0;k<4;k++){int id=int(skinJoints[k]+.5);vec4 r=texelFetch(compactPalette,ivec2(0,id),0),d=texelFetch(compactPalette,ivec2(1,id),0);float w=skinWeights[k]*(dot(reference,r)<0.?-1.:1.);qr+=w*r;qd+=w*d;}
  for(int k=0;k<4;k++){int id=int(skinJointsExtra[k]+.5);vec4 r=texelFetch(compactPalette,ivec2(0,id),0),d=texelFetch(compactPalette,ivec2(1,id),0);float w=skinWeightsExtra[k]*(dot(reference,r)<0.?-1.:1.);qr+=w*r;qd+=w*d;}
  float lengthR=max(length(qr),1e-8);qr/=lengthR;qd/=lengthR;qd-=qr*dot(qr,qd);
  vec3 translation=2.*(qr.w*qd.xyz-qd.w*qr.xyz+cross(qr.xyz,qd.xyz));
  P=compactRotate(qr,p)+translation;N=compactRotate(qr,n);
  // Reduce DQS bulging only in the shoulder/chest transition. Pure limb
  // rotations retain their rigid skinning; muscle volume is handled above.
  if(shoulderLbs>0.){
    vec3 linearP=vec3(0.),linearN=vec3(0.);
    for(int k=0;k<8;k++){
      int id=k<4?int(skinJoints[k]+.5):int(skinJointsExtra[k-4]+.5);float weight=k<4?skinWeights[k]:skinWeightsExtra[k-4];
      vec4 r=texelFetch(compactPalette,ivec2(0,id),0),d=texelFetch(compactPalette,ivec2(1,id),0);
      vec3 t=2.*(r.w*d.xyz-d.w*r.xyz+cross(r.xyz,d.xyz));
      linearP+=weight*(compactRotate(r,p)+t);linearN+=weight*compactRotate(r,n);
    }
    P=mix(P,linearP,shoulderLbs);N=normalize(mix(N,linearN,shoulderLbs));
  }
  C=compactRegions>.5?regionColor:compactColor;MK=compactKind;AO=1.;activation=0.;L=lightVP*vec4(P,1.);gl_Position=viewProjection*vec4(P,1.);
  if(faceHeatmap>.5&&faceEligible>.5&&faceHeat>.001)C=mix(C,mix(vec3(.04,.38,.85),vec3(1.,.18,.025),faceHeat),min(1.,faceHeat*3.));
}`;
function compactFragmentSource(){
  return FS.replace('uniform vec3 eye;',COMPACT_EYE_COORDINATES+' uniform float compactFeature,compactStatureScale; uniform vec3 eye;')
    .replace('void main(){',compactEyeSocketSource()+compactFaceSurfaceShader()+'\nin vec3 personalRestPosition;\nvoid main(){compactEyeSocket(R);compactFaceSurfaceMask(R);'+COMPACT_SCLERA_APERTURE)
    .replace('float restArea=length(cross(dFdx(R),dFdy(R)));','float restArea=length(cross(dFdx(personalRestPosition),dFdy(personalRestPosition)));')
    .replace('vec3 dx=dFdx(P),dy=dFdy(P),rx=cross(dy,n),ry=cross(n,dx);',`if(compactFeature>2.5&&compactFeature<3.5){
      float lipWeight=compactLipPigment(R);reliefHeight=mix(reliefHeight,compactLipMicrorelief(R)/sqrt(skinStretch),lipWeight);
      float lipMoisture=compactLipMoisture(R);rough=mix(rough,mix(.46,.31,lipMoisture),lipWeight);skinOil=mix(skinOil,mix(.30,.65,lipMoisture),lipWeight);skinCavity=mix(skinCavity,1.,lipWeight);
    }
    vec3 dx=dFdx(P),dy=dFdy(P),rx=cross(dy,n),ry=cross(n,dx);`)
    .replace('vec3 color=C;float rough=',`vec3 color=C;
      if(compactFeature>2.5&&compactFeature<3.5){float lipPigment=compactLipPigment(R);color*=mix(vec3(1.),compactLipTint(R),lipPigment);color*=1.-.22*compactLipContactShadow(R);}
      if(compactFeature>.5&&compactFeature<2.5){
        vec2 uv=compactEyeUV(R);float radius=length(uv),angle=atan(uv.y,uv.x);
        if(compactFeature<1.5){color=vec3(.015,.02,.024);}
        else{float radialFilter=1.-smoothstep(.012,.04,length(fwidth(uv)));float fibres=.5+radialFilter*(.19*sin(angle*61.+radius*23.)+.12*sin(angle*113.-radius*31.)+.06*sin(angle*197.+radius*73.));color=mix(vec3(.026,.012,.006),vec3(.095,.047,.017),clamp(fibres,0.,1.))*(1.-.65*smoothstep(.82,1.03,radius));color=mix(vec3(.006,.003,.002),color,smoothstep(.31,.39,radius));}
      }
      float rough=`)
    .replace('else if(MK>3.5&&MK<4.5){rough=.22;specular=.27;}','else if(MK>3.5&&MK<4.5){rough=compactFeature<1.5?.035:compactFeature<2.5?.38:compactFeature<3.5?.42:compactFeature>5.5&&compactFeature<6.5?.13:.24;specular=compactFeature<1.5?.42:compactFeature>6.5&&compactFeature<7.5?0.:.085;}')
    .replace('frag=vec4(pow(max(c,vec3(0.)),vec3(1./2.2)),1.);',`float alpha=1.;
      if(compactFeature>.5&&compactFeature<1.5){
        // Only the outward shell contributes. The pupil stays behind the iris.
        if(!gl_FrontFacing)discard;
        vec3 reflected=reflect(-v,n);float key=pow(max(dot(reflected,normalize(vec3(-.45,.65,.8))),0.),180.);
        float soft=pow(max(dot(reflected,normalize(vec3(.8,.25,.65))),0.),45.);
        alpha=clamp(.018+.11*pow(1.-max(dot(n,v),0.),5.)+.82*key+.12*soft,.018,.9);
        c=mix(vec3(.055,.065,.072),vec3(1.4,1.35,1.24),clamp(key+soft*.35,0.,1.));
      }
      frag=vec4(skinOutputSRGB(c),alpha);`);
}
class CompactSurfaceRenderer{
  constructor(lab,data){
    this.lab=lab;this.boundHuman=lab.human;this.renderer=lab.renderer;this.gl=lab.renderer.gl;this.rig=compactSourceRig(lab.human,lab.tissue);this.enabled=true;this.chunks=[];this.quality=data.report.quality;this.report=data.report;
    this.controlBind=lab.human.sourceBind;this.supportProbes=[];this.shape={...lab.human.characterPreset.shape};this.statureScale=lab.human.bodyMetrics.statureScale;
    try{
    this.main=program(this.gl,COMPACT_VERTEX,compactFragmentSource());
    // Transparent cornea does not cast an opaque pupil-shaped shadow.
    this.depth=program(this.gl,COMPACT_VERTEX,`#version 300 es\nprecision highp float;in vec3 R;uniform float compactFeature;${COMPACT_EYE_COORDINATES}\n${compactEyeSocketSource()}\n${compactFaceSurfaceShader()}\nvoid main(){compactEyeSocket(R);compactFaceSurfaceMask(R);${COMPACT_SCLERA_APERTURE}if(compactFeature>.5&&compactFeature<1.5)discard;}`);
    for(const p of [this.main,this.depth])for(const key of ['compactMuscleOrigin[0]','compactMuscleAxis[0]','compactMuscleStrain[0]','compactMuscleEnabled','compactAxillaWeight'])p.u[key]=this.gl.getUniformLocation(p.p,key);
    for(const p of [this.main,this.depth])for(const key of ['compactEarClearance','compactPalette','compactOrigin','compactExtent','compactColor','compactKind','compactRegions','compactStatureScale','compactEyeCentre','compactEyeU','compactEyeV','compactFeature','skinControlled','skinSurface','skinDetail','skinSeedOffset','skinExposure'])p.u[key]=this.gl.getUniformLocation(p.p,key);
    for(const p of [this.main,this.depth])for(const key of ['faceOffsets[0]','faceEnabled','faceEligible','faceHeatmap','faceSelected','compactLipOpen'])p.u[key]=this.gl.getUniformLocation(p.p,key);
    for(const p of [this.main,this.depth])for(const key of ['faceMuscles[0]','compactCanthusDepth','compactFaceSkinMode','compactSkinSocket','compactSocketRadii[0]','compactEyeGlobe','compactSourceEye','compactEyeNormal','compactEyeLid','compactEyeSide','compactLidState[0]'])p.u[key]=this.gl.getUniformLocation(p.p,key);
    this.eyeFrames=Object.fromEntries(Object.entries(COMPACT_EYES).map(([side,f])=>{const n=norm(f.normal),u=norm(cross([0,1,0],n));return [side,{centre:f.centre,n,u,v:norm(cross(n,u))}];}));
    this.palette=new Float32Array(lab.human.joints.length*8);this.texture=this.gl.createTexture();if(!this.texture)throw Error('无法创建人体关节纹理');this.gl.activeTexture(this.gl.TEXTURE0+COMPACT_PALETTE_UNIT);this.gl.bindTexture(this.gl.TEXTURE_2D,this.texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA32F,2,lab.human.joints.length,0,this.gl.RGBA,this.gl.FLOAT,this.palette);lab.renderer.textureOptions();this.gl.activeTexture(this.gl.TEXTURE0);
    this.replace(data);lab.tissue.surface=this;
    }catch(error){this.gl.activeTexture(this.gl.TEXTURE0);this.dispose();throw error;}
  }
  releaseChunks(chunks){const gl=this.gl;for(const c of chunks){for(const b of c.buffers)gl.deleteBuffer(b);if(c.vao)gl.deleteVertexArray(c.vao);}}
  checkUpload(){const gl=this.gl,code=gl.getError();if(gl.isContextLost()||code!==gl.NO_ERROR)throw Error('人体资源上传失败（WebGL '+code+'）');}
  replace(data){
    if(this.disposed)throw Error('人物显示资源已释放');
    if(!data.shape||!sameCharacterShape(data.shape,this.shape))throw Error('重建曲面与当前人物体型不匹配');
    const gl=this.gl,started=performance.now(),field={report:data.report.binding};
    if(!field.report||data.bindingJointNames?.length!==this.rig.jointNames.length||data.bindingJointNames.some((id,i)=>id!==this.rig.jointNames[i]))throw Error('重建绑定与当前骨架不匹配');
    if(!Array.isArray(data.supportProbes)||!data.supportProbes.length)throw Error('缺少重建支撑点');
    // Stage all new resources and metadata. Keep the accepted surface until
    // every upload succeeds; failed quality changes dispose only the staging.
    this.checkUpload();
    const stage={chunks:[],geometryBytes:0,maximumWeightError:0,bindingGroups:{},hair:null};
    const faceTissue=compactCreateFaceAnatomy(data.meshes,this.rig,this.statureScale);stage.faceAnatomy=faceTissue.report;
    const eyeTissue=compactCreateEyeLids(faceTissue.meshes.filter(m=>m.name==='faceSkin'),this.eyeFrames,this.rig,this.statureScale);stage.eyeAnatomy=eyeTissue.report;stage.eyeSocketRadii=eyeTissue.socketRadii;stage.canthusDepths=eyeTissue.canthusDepths;
    const replacedSclera=data.meshes.filter(m=>['FJ1297','FJ1348','FJ1317','FJ1368','FJ2812','FJ2814'].includes(m.name));
    const displayMeshes=data.meshes.filter(m=>!replacedSclera.includes(m)).concat(faceTissue.meshes,eyeTissue.meshes);stage.faceSampling=sampleFaceSurface(displayMeshes,data.report.quality,this.statureScale);
    try{
    for(const m of displayMeshes){
      const binding=m.binding;
      if(!(m.canonicalPositions instanceof Float32Array)||m.canonicalPositions.length!==m.vertices*3)throw Error('重建分块缺少参考坐标');
      if(!(binding?.ids instanceof Uint16Array)||!(binding.weights instanceof Uint16Array)||!(binding.colors instanceof Uint8Array)||binding.ids.length!==m.vertices*COMPACT_INFLUENCES||binding.weights.length!==binding.ids.length||binding.colors.length!==m.vertices*3)throw Error('重建分块缺少完整绑定');
      const buffers=[],vao=gl.createVertexArray();
      const chunk={vao,buffers,count:m.indices.length,name:m.name,eyeSide:m.eyeSide,eyeLid:m.eyeLid,sourceGroup:m.sourceGroup,origin:m.origin,extent:m.extent,triangles:m.triangles};stage.chunks.push(chunk);
      if(!vao)throw Error('无法创建人体绘制数组');gl.bindVertexArray(vao);
      const buffer=(target,array)=>{const b=gl.createBuffer();if(!b)throw Error('无法创建人体几何缓冲');buffers.push(b);gl.bindBuffer(target,b);gl.bufferData(target,array,gl.STATIC_DRAW);stage.geometryBytes+=array.byteLength;};
      const attr=(location,array,size,type,normalized)=>{buffer(gl.ARRAY_BUFFER,array);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,type,normalized,0,0);};
      const pair=(first,second,array,normalized)=>{buffer(gl.ARRAY_BUFFER,array);
        for(const [location,offset]of [[first,0],[second,8]]){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,4,gl.UNSIGNED_SHORT,normalized,16,offset);}};
      attr(0,m.positions,3,gl.FLOAT,false);attr(1,m.normals,2,gl.SHORT,true);pair(2,5,binding.ids,false);pair(3,6,binding.weights,true);attr(4,binding.colors,3,gl.UNSIGNED_BYTE,true);attr(7,m.canonicalPositions,3,gl.FLOAT,false);
      if(m.axillaDelta){buffer(gl.ARRAY_BUFFER,r2PackAxillaAttribute(m));gl.enableVertexAttribArray(15);gl.vertexAttribIPointer(15,4,gl.UNSIGNED_INT,0,0);}
      else{gl.disableVertexAttribArray(15);gl.vertexAttribI4ui(15,0,0,0,0);}
      if(m.eyeParams){attr(8,m.eyeParams,2,gl.FLOAT,false);attr(9,m.eyeTangentU,3,gl.FLOAT,false);attr(10,m.eyeTangentV,3,gl.FLOAT,false);}
      if(m.eyeOuterPosition){attr(11,m.eyeOuterPosition,3,gl.FLOAT,false);attr(12,m.eyeOuterTangentU,3,gl.FLOAT,false);attr(13,m.eyeOuterGradient,2,gl.FLOAT,false);attr(14,m.eyeOuterGradientU,2,gl.FLOAT,false);}
      for(const [k,v]of Object.entries(binding.groupCounts))stage.bindingGroups[k]=(stage.bindingGroups[k]||0)+v;
      buffer(gl.ELEMENT_ARRAY_BUFFER,m.indices);
      stage.maximumWeightError=Math.max(stage.maximumWeightError,binding.maximumWeightError);
      // Release transferred CPU display arrays after upload; no persistent mesh cache.
    }
    stage.chunks.sort((a,b)=>Number(['FJ1289','FJ1340'].includes(a.name))-Number(['FJ1289','FJ1340'].includes(b.name)));
    if(data.hair)stage.hair=new CompactHairRenderer(this,data.hair);
    stage.skirt=new ProceduralGrassSkirt(this,data.meshes);stage.geometryBytes+=stage.skirt.geometryBytes;
    stage.supportProbes=data.supportProbes;
    stage.report={...data.report,eyeAnatomy:stage.eyeAnatomy,faceAnatomy:stage.faceAnatomy,vertices:data.report.vertices-replacedSclera.reduce((sum,m)=>sum+m.vertices,0)+faceTissue.meshes.reduce((sum,m)=>sum+m.vertices,0)+eyeTissue.meshes.reduce((sum,m)=>sum+m.vertices,0),triangles:data.report.triangles-replacedSclera.reduce((sum,m)=>sum+m.triangles,0)+faceTissue.report.triangles+eyeTissue.report.triangles,...(!data.hair&&this.hair?{hair:this.hair.report,hairEnabled:true}:{}),binding:{...field.report,sourceRegionsPreserved:true,groups:stage.bindingGroups,joints:this.lab.human.joints.length,maximumWeightError:stage.maximumWeightError,calibrated:false}};
    this.checkUpload();
    }catch(error){this.releaseChunks(stage.chunks);stage.hair?.dispose();stage.skirt?.dispose();throw error;}finally{gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);}
    const oldChunks=this.chunks,oldHair=this.hair,oldSkirt=this.skirt;this.skirt=stage.skirt;
    this.chunks=stage.chunks;this.eyeSocketRadii=stage.eyeSocketRadii;this.canthusDepths=stage.canthusDepths;this.geometryBytes=stage.geometryBytes;this.maximumWeightError=stage.maximumWeightError;this.bindingGroups=stage.bindingGroups;this.supportProbes=stage.supportProbes;
    if(stage.hair)this.hair=stage.hair;
    this.lab.tissue.surfaceInfo={vertices:stage.report.vertices,triangles:stage.report.triangles,topology:'source fitted connected domains with fitted procedural eyelids'};
    this.report=stage.report;this.quality=data.report.quality;this.bindingMilliseconds=data.report.bindingMilliseconds;this.uploadMilliseconds=performance.now()-started;
    if(this.renderer.compact===this||this.renderer.compacts?.includes(this))this.renderer.lastItems=[];
    this.faceSampling=stage.faceSampling;this.lab.face?.refresh();
    this.releaseChunks(oldChunks);if(stage.hair)oldHair?.dispose();oldSkirt?.dispose();
  }
  attachHair(data){
    if(this.disposed)throw Error('人物显示资源已释放');
    let stage;this.checkUpload();
    try{stage=new CompactHairRenderer(this,data);this.checkUpload();}
    catch(error){stage?.dispose();throw error;}
    finally{this.gl.bindVertexArray(null);this.gl.bindBuffer(this.gl.ARRAY_BUFFER,null);}
    const previous=this.hair;this.hair=stage;this.report={...this.report,hair:stage.report,hairEnabled:true};previous?.dispose();needsRedraw=true;
  }
  minimumSupportY(frames=null){
    const transforms=this.lab.human.joints.map(j=>{const f=frames?frames.get(j.id):j.world,source=this.controlBind.get(j.id),q=qnorm(qm(f.q,inv(source.q))),t=sub(f.p,rotate(q,source.p));return {q,d:mul(qm([...t,0],q),.5)};});
    const muscles=r2MuscleFrames(this.lab.human,frames);
    let y=Infinity,boneId=null;for(const probe of this.supportProbes){const p=r2DeformTissuePoint(probe.p,probe.influences,transforms,muscles,this.statureScale,probe.axillaDelta);if(p[1]<y){y=p[1];boneId=this.lab.human.joints[probe.influences[0][0]].id;}}
    return {y,boneId,sampled:true,sampleCount:this.supportProbes.length,fullCollisionCertificate:false};
  }
  prepare(items){
    if(this.disposed){this.visible=false;return false;}
    const t=this.lab.human.tissue;this.tissue=t;if(this.hair)this.hair.visible=false;
    this.view=items.includes(t.skin)?t.view:items.includes(t.clay)?'clay':null;
    this.visible=this.enabled&&this.lab.human===this.boundHuman&&this.view!==null;
    if(this.visible){this.replaced=new Set([t.skin,t.clay,...t.details,...t.clayDetails,...(t.skinLayerItems||[])]);this.updatePalette();}
    return this.visible;
  }
  updatePalette(){
    const h=this.lab.human;
    this.muscleFrames=r2MuscleFrames(h);
    for(let i=0;i<h.joints.length;i++){const j=h.joints[i],source=this.controlBind.get(j.id),q=qnorm(qm(j.world.q,inv(source.q))),t=sub(j.world.p,rotate(q,source.p));if(j.id==='head')this.headTransform={p:t,q};this.palette.set(q,i*8);this.palette.set(mul(qm([...t,0],q),.5),i*8+4);}
    const gl=this.gl;gl.activeTexture(gl.TEXTURE0+COMPACT_PALETTE_UNIT);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,2,h.joints.length,gl.RGBA,gl.FLOAT,this.palette);gl.activeTexture(gl.TEXTURE0);
  }
  draw(depth){
    if(!this.visible)return;const gl=this.gl,r=this.renderer,p=depth?this.depth:this.main;gl.useProgram(p.p);
    // prepare() uploads every actor before drawing. Rebind the owner here so
    // this body and its immediately following hair draw use their own rig.
    gl.activeTexture(gl.TEXTURE0+COMPACT_PALETTE_UNIT);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.activeTexture(gl.TEXTURE0);
    gl.uniformMatrix4fv(p.u.viewProjection,false,depth?r.lightVP:r.vp);gl.uniformMatrix4fv(p.u.lightVP,false,r.lightVP);gl.uniform1i(p.u.compactPalette,COMPACT_PALETTE_UNIT);gl.uniform1f(p.u.compactStatureScale,this.statureScale);
    gl.uniform4fv(p.u['compactMuscleOrigin[0]'],this.muscleFrames.flatMap(f=>[...f.origin,f.length]));gl.uniform4fv(p.u['compactMuscleAxis[0]'],this.muscleFrames.flatMap(f=>[...f.axis,0]));gl.uniform2fv(p.u['compactMuscleStrain[0]'],this.muscleFrames.flatMap(f=>[f.armStrain,f.deltoidStrain]));
    gl.uniform2fv(p.u.compactAxillaWeight,this.muscleFrames.map(f=>f.axillaWeight));
    if(!depth){gl.uniform3fv(p.u.eye,r.eye);gl.uniform1i(p.u.shadow,1);gl.uniform1f(p.u.shadowsEnabled,r.quality==='shadow'&&r.shadowAvailable?1:0);gl.uniform1f(p.u.studioMode,r.studioMode?1:0);}
    const skin=this.lab.human.tissue.skinMaterial;
    // Face recipe offsets retain their authored physical millimetres. Its
    // landmarks and support radii remain attached to the scaled neutral head.
    const face=this.lab.face.uniforms();gl.uniform3fv(p.u['faceOffsets[0]'],face.offsets.map(v=>v/this.statureScale));gl.uniform1f(p.u.faceEnabled,face.enabled);gl.uniform1f(p.u.faceHeatmap,depth?0:face.heatmap);gl.uniform1i(p.u.faceSelected,face.selected);
    gl.uniform1fv(p.u['faceMuscles[0]'],face.muscles);gl.uniform1fv(p.u['compactLidState[0]'],face.eyelids.map(v=>v*face.enabled));
    gl.uniform1f(p.u.compactLipOpen,face.lipOpen*face.enabled);
    gl.uniform4fv(p.u['compactSocketRadii[0]'],this.eyeSocketRadii);
    if(!depth){gl.uniform1f(p.u.skinControlled,1);gl.uniform3fv(p.u.skinSurface,skin.surface);gl.uniform3fv(p.u.skinDetail,skin.detail);gl.uniform3fv(p.u.skinSeedOffset,skin.seedOffset);gl.uniform2fv(p.u.skinExposure,skin.exposure);}
    gl.frontFace(gl.CW);gl.disable(gl.CULL_FACE);
    for(const c of this.chunks){
      const eyeSide=c.eyeSide||(['FJ1289','FJ1297','FJ1317'].includes(c.name)?'left':'right');
      gl.uniform1f(p.u.compactMuscleEnabled,c.name==='skin'?1:0);
      gl.uniform1f(p.u.compactEyeLid,c.eyeLid?(c.name==='eyeLidMargin'?2:1):0);gl.uniform1f(p.u.compactEyeSide,eyeSide==='left'?0:1);
      gl.uniform1f(p.u.compactSkinSocket,c.name==='skin'||c.name==='faceSkin'?1:0);
      gl.uniform1f(p.u.compactFaceSkinMode,c.name==='skin'?1:c.name==='faceSkin'?2:0);
      gl.uniform1f(p.u.compactSourceEye,['FJ1289','FJ1340','FJ1297','FJ1348','FJ1317','FJ1368'].includes(c.name)?1:['eyeSclera','eyeIris','eyePupil'].includes(c.name)?2:0);
      gl.uniform1f(p.u.compactEarClearance,c.name==='skin'?1:0);
      gl.uniform1f(p.u.faceEligible,faceChunkEligible(c.name)?1:0);
      const eye=c.name==='FJ1289'||c.name==='FJ1340'?1:c.name==='FJ1297'||c.name==='FJ1348'||c.name==='eyeIris'?2:0;
      if(!depth&&eye===1&&this.view==='skin'){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}else{gl.disable(gl.BLEND);gl.depthMask(true);}
      // BodyParts3D: FJ2811 external ear, FJ2812 eyebrow, FJ2814 lip;
      // FJ1317/FJ1368 are sclerae. Ears share the body's pigment and microdetail.
      const isSkin=c.name==='skin'||c.name==='FJ2811'||c.name==='eyeLidSkin'||c.name==='faceSkin'||c.name==='faceLip',lip=c.name==='FJ2814'||c.name==='faceLip',brow=c.name==='FJ2812'||c.name==='faceBrow',sclera=['FJ1317','FJ1368','eyeSclera'].includes(c.name),margin=c.name==='eyeLidMargin',pupil=c.name==='eyePupil',tear=c.name==='eyeTearDuct',nose=c.name==='noseInterior',mouth=c.name==='mouthInterior';
      const feature=eye||(lip?3:sclera?5:margin?6:pupil?7:tear?8:nose?9:mouth?10:0);
      const color=this.view==='clay'?[.54,.55,.55]:lip?skin.color:brow?[.105,.067,.047]:sclera?[.52,.50,.44]:margin?skin.lipColor.map((v,i)=>v*.55+skin.color[i]*.45):pupil?[.0007,.0005,.0003]:tear?skin.lipColor:nose?[.085,.035,.024]:mouth?[.055,.016,.013]:isSkin?skin.color:[.497,.391,.296];
      gl.uniform3fv(p.u.compactOrigin,c.origin);gl.uniform3fv(p.u.compactExtent,c.extent);gl.uniform3fv(p.u.compactColor,color);gl.uniform1f(p.u.compactKind,this.view==='clay'||this.view==='regions'?7:isSkin?1:feature?4:0);gl.uniform1f(p.u.compactRegions,this.view==='regions'?1:0);
      const f=this.eyeFrames[c.eyeSide||(['FJ1289','FJ1297','FJ1317'].includes(c.name)?'left':'right')];
      const globe=COMPACT_EYE_ANATOMY[c.eyeSide||(['FJ1289','FJ1297','FJ1317'].includes(c.name)?'left':'right')],eyeRelative=sub(globe.centre,f.centre);
      gl.uniform4fv(p.u.compactEyeGlobe,[dot(eyeRelative,f.u),dot(eyeRelative,f.v),dot(eyeRelative,f.n)-COMPACT_EYE_ANATOMY.recess,globe.radius]);
      gl.uniform2fv(p.u.compactCanthusDepth,this.canthusDepths[c.eyeSide||'right']);
      gl.uniform1f(p.u.compactFeature,this.view==='clay'||this.view==='regions'?0:feature);gl.uniform3fv(p.u.compactEyeCentre,f.centre);gl.uniform3fv(p.u.compactEyeU,f.u);gl.uniform3fv(p.u.compactEyeV,f.v);gl.uniform3fv(p.u.compactEyeNormal,f.n);
      gl.bindVertexArray(c.vao);gl.drawElements(gl.TRIANGLES,c.count,gl.UNSIGNED_SHORT,0);if(depth)r.shadowDrawCalls++;else r.drawCalls++;
    }
    gl.depthMask(true);gl.disable(gl.BLEND);gl.frontFace(gl.CCW);
    this.skirt?.draw(depth);
  }
  performance(){return {...this.lab.renderer.compactPerformance?.stats,quality:this.quality,model:'reconstructed-r2',parameterBytes:this.report.parameterBytes,generationMilliseconds:this.report.generationMilliseconds,startupMilliseconds:this.startupMilliseconds??null,poseBindingAccepted:false};}
  dispose(){if(this.disposed)return;const wasActive=this.renderer.compact===this||this.renderer.compacts?.includes(this);this.disposed=true;this.enabled=false;this.visible=false;this.hair?.dispose();this.skirt?.dispose();const gl=this.gl;this.releaseChunks(this.chunks);if(this.texture)gl.deleteTexture(this.texture);if(this.main)gl.deleteProgram(this.main.p);if(this.depth)gl.deleteProgram(this.depth.p);this.chunks=[];this.supportProbes=[];this.palette=null;this.geometryBytes=0;this.hair=null;this.texture=null;this.main=null;this.depth=null;if(this.boundHuman?.tissue?.surface===this)this.boundHuman.tissue.surface=null;if(this.renderer.compacts)this.renderer.compacts=this.renderer.compacts.filter(surface=>surface!==this);if(this.renderer.compact===this)this.renderer.compact=null;if(wasActive){this.renderer.lastItems=[];needsRedraw=true;}}
}
function installCompactPerformance(lab){
  const gl=lab.renderer.gl,ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[];
  const stats={fps:null,cpuFrameMs:null,gpuMs:null,gpuTimerAvailable:!!ext,jsHeapBytes:null,renderedFrames:0,lastFrameTime:null,geometryGPUBytes:null,trianglesPerFrame:null,drawCalls:null};
  let query=null,lastQuery=-Infinity,windowStart=performance.now(),frames=0,cpu=0,lastDraw=null;
  return {stats,
    begin(){const now=performance.now();this.started=now;
      if(ext){if(gl.getParameter(ext.GPU_DISJOINT_EXT)){for(const q of pending)gl.deleteQuery(q);pending.length=0;stats.gpuMs=null;}
        else while(pending.length&&gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE)){const q=pending.shift(),ns=gl.getQueryParameter(q,gl.QUERY_RESULT);gl.deleteQuery(q);stats.gpuMs=ns/1e6;}
        if(now-lastQuery>250&&pending.length<4){query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);lastQuery=now;}}
    },
    end(){const now=performance.now();if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(query);query=null;}const elapsed=now-this.started;
      if(lastDraw!==null&&now-lastDraw>1000){windowStart=now;frames=0;cpu=0;stats.fps=null;}lastDraw=now;frames++;cpu+=elapsed;stats.renderedFrames++;stats.lastFrameTime=now;
      if(now-windowStart>=500){stats.fps=frames*1000/(now-windowStart);stats.cpuFrameMs=cpu/frames;windowStart=now;frames=0;cpu=0;}
      const r=lab.renderer,compacts=[...new Set(r.compacts?.length?r.compacts:r.compact?[r.compact]:[])].filter(surface=>!surface.disposed),passes=1+(r.shadowDrawCalls>0?1:0);
      stats.geometryGPUBytes=(r.geometryGPUBytes||0)+(r.lineGeometryGPUBytes||0)+compacts.reduce((total,c)=>total+(c.geometryBytes||0)+(c.hair?.geometryBytes||0),0);
      stats.trianglesPerFrame=(r.count||0)/3*passes+compacts.reduce((total,c)=>total+(c.visible?(c.report.triangles+(c.skirt?.report.triangles||0))*passes:0)+(c.hair?.visible?c.hair.triangles:0),0);stats.actorCount=compacts.length;stats.visibleActorCount=compacts.filter(c=>c.visible).length;
      stats.drawCalls=r.drawCalls+r.shadowDrawCalls;stats.jsHeapBytes=performance.memory?.usedJSHeapSize??null;
    },
    dispose(){if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);gl.deleteQuery(query);query=null;}for(const q of pending)gl.deleteQuery(q);pending.length=0;}
  };
}
function updateCompactRenderInfo(renderer){
  const info=document.getElementById('renderInfo');if(!info)return;
  const compacts=[...new Set(renderer.compacts?.length?renderer.compacts:renderer.compact?[renderer.compact]:[])].filter(c=>c.visible&&!c.disposed);
  if(compacts.length){const vertices=compacts.reduce((total,c)=>total+c.report.vertices,0),strands=compacts.reduce((total,c)=>total+(c.hair?.visible?c.hair.report.strands:0),0);info.textContent=`重建人物 R2 · ${compacts.length} 人 · ${vertices.toLocaleString()} 曲面顶点 · ${strands?strands.toLocaleString()+' 条显示发束':'毛发隐藏'}`;return;}
  if(renderer.tissue)info.textContent='R2 人体等待数据';
}
function startCompactHair(lab){
  if(lab.character?.busy||!lab.compact||lab.compact.disposed||lab.compact.hair)return Promise.resolve();
  if(lab.hairTask)return lab.hairTask;
  if(lab.compactQualityPending)return Promise.resolve();
  const requestSurface=lab.compact;
  lab.hairStatus={state:'loading'};
  const task=(async()=>{
    try{const data=await loadCompactSurface('preview',true,null,'hair',lab.human.characterPreset.appearance.hair,lab.human.characterPreset.shape);if(requestSurface.disposed||lab.compact!==requestSurface)return;
      requestSurface.attachHair(data.hair);lab.hairStatus={state:'ready'};publishCompactProgress({group:'ready',state:'ready'});
    }catch(error){if(lab.compact===requestSurface)lab.hairStatus={state:error.name==='AbortError'?'cancelled':'failed',error:error.message};throw error;}
    finally{if(lab.hairTask===task)lab.hairTask=null;}
  })();lab.hairTask=task;return task;
}
function scheduleCompactHair(lab){
  // Give the body a paint opportunity before starting a fresh worker. Hair
  // failure remains local to hair; the body, camera and actions stay usable.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!lab.compact?.disposed)startCompactHair(lab).catch(()=>{});}));
}
async function installCompactWorkbench(lab,pending){
  if(window.__compactLoading)publishCompactProgress(window.__compactLoading);
  const data=await pending;lab.renderer.compact=new CompactSurfaceRenderer(lab,data);lab.compact=lab.renderer.compact;
  lab.face.refresh();
  lab.hairStatus={state:lab.compact.hair?'ready':'pending'};

  lab.renderer.compactPerformance=installCompactPerformance(lab);
  lab.compact.startupMilliseconds=performance.now()-COMPACT_START;
  const doc=window.parent.document,host=doc.querySelector('.body-pane')||doc.body;
  const style=doc.createElement('style');style.textContent=`.compact-panel{position:absolute;z-index:35;left:12px;bottom:36px;width:min(430px,calc(100% - 24px));font:12px/1.55 system-ui;color:#dceaf0;background:#0d1c25ee;border:1px solid #526d79;border-radius:10px;padding:10px 12px;backdrop-filter:blur(8px)}.compact-panel summary{cursor:pointer;font-size:13px;font-weight:600}.compact-panel label{display:inline-flex;gap:5px;align-items:center;margin:7px 8px 4px 0}.compact-panel button,.compact-panel select{background:#1b3441;color:#e6f3f3;border:1px solid #567885;border-radius:5px;padding:5px 7px;font:inherit}.compact-panel p{margin:5px 0;color:#b9cdd3}.compact-values{display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;font-variant-numeric:tabular-nums}.compact-values b{font-weight:600;color:#91e3be}.compact-panel[open]{max-height:55vh;overflow:auto}`;doc.head.append(style);
  const onBasicCommand=event=>{const button=event.target.closest('.compact-panel [data-basic-command]');if(!button||window.parent!==window)return;try{lab.command(button.dataset.basicCommand);}catch(error){console.error(error);}};
  doc.addEventListener('click',onBasicCommand);
  const panel=doc.createElement('details');panel.className='compact-panel';panel.open=true;panel.innerHTML=`<summary>重建人物 R2 · 空间与性能</summary><p>左键旋转 · 滚轮缩放 · 右键平移</p><div><button data-basic-command="向前走1米">前走 1 米</button><button data-basic-command="向左转90度">左转</button><button data-basic-command="坐下">坐下</button><button data-basic-command="躺下">躺下</button><button data-basic-command="起身">起身</button></div><label>细节 <select id="compact-quality"><option value="preview">启动档</option><option value="interactive">活动档</option><option value="balanced">近看档</option></select></label><label><input id="compact-shadow" type="checkbox">阴影</label><div><button id="compact-focus">人物全身</button><button id="compact-head">头面近景</button><button id="compact-field">训练场全景</button><button id="compact-actions">任务与动作</button><button id="compact-scene">场景编辑</button></div><p>R2 参考形体 · 同源关节绑定 · 可在人物设置中查看关节分区。</p><p id="compact-progress">重建参数已就绪</p><button id="compact-hair-retry" hidden>重试头发</button><div class="compact-values"><span>FPS <b id="compact-fps">等待采样</b></span><span>GPU <b id="compact-gpu">等待采样</b></span><span>渲染 CPU <b id="compact-cpu">等待采样</b></span><span>绘制调用 <b id="compact-draw">—</b></span><span>含阴影三角形 <b id="compact-tri">—</b></span><span>几何缓冲 <b id="compact-memory">—</b></span><span>JS 堆 <b id="compact-heap">不支持</b></span><span>曲面生成 <b id="compact-load">—</b></span></div><p id="compact-model-label">已接入动作实验室 R2.2。动作按钮与长任务共用执行系统；效果待验收。</p>`;
  host.append(panel);let disposed=false;const el=id=>panel.querySelector('#'+id),status=text=>el('compact-progress').textContent=text;
  el('compact-shadow').onchange=()=>{lab.renderer.setQuality(el('compact-shadow').checked?'shadow':'fast');needsRedraw=true;};
  el('compact-focus').onclick=()=>{lab.focus('body');needsRedraw=true;};
  el('compact-head').onclick=()=>lab.hair.closeup('front');
  const skinButton=doc.createElement('button');skinButton.id='compact-skin';skinButton.type='button';skinButton.textContent='皮肤与肤色';el('compact-head').after(skinButton);
  skinButton.onclick=()=>{panel.open=false;lab.settings.open('skin');};
  const faceButton=doc.createElement('button');faceButton.id='compact-face';faceButton.type='button';faceButton.textContent='面部微控与表情';skinButton.after(faceButton);
  faceButton.onclick=()=>{panel.open=false;lab.settings.open('face');lab.face.refresh();};
  el('compact-field').onclick=()=>{lab.focus('field');needsRedraw=true;};
  el('compact-actions').onclick=()=>doc.querySelector('[data-utility=tasks]')?.click();
  el('compact-scene').onclick=()=>doc.querySelector('#sceneBtn')?.click();
  el('compact-quality').value=lab.compact.quality;
  el('compact-hair-retry').onclick=()=>startCompactHair(lab).catch(()=>{});
  el('compact-quality').onchange=async()=>{
    const select=el('compact-quality'),requestSurface=lab.compact;
    if(lab.character?.busy){select.value=requestSurface.quality;status('人物正在更新，请完成后再调整细节');return;}
    select.disabled=true;lab.compactQualityPending=true;status(lab.hairTask?'等待头发计算结束后更新细节…':'正在计算所选细节，当前人物可继续查看…');
    try{
      if(lab.hairTask)await lab.hairTask.catch(()=>{});if(disposed)return;
      if(lab.compact!==requestSurface||requestSurface.disposed||lab.character?.busy)throw Error('人物已更新，请重新选择细节');
      const replacement=await loadCompactSurface(select.value,false,requestSurface.rig);if(disposed)return;
      if(lab.compact!==requestSurface||requestSurface.disposed||lab.character?.busy)throw Error('人物已更新，旧细节结果已丢弃');
      requestSurface.replace(replacement);publishCompactProgress({group:'ready',state:'ready'});status(requestSurface.report.precisionLimited?'细节已更新，部分区域尚未满足目标精度':'细节已更新');needsRedraw=true;
    }catch(error){if(disposed)return;status(error.name==='AbortError'?'计算已取消':'计算失败：'+error.message);select.value=lab.compact.quality;}
    finally{select.disabled=false;lab.compactQualityPending=false;if(!disposed&&lab.hairStatus?.state==='pending')startCompactHair(lab).catch(()=>{});}
  };
  const timer=setInterval(()=>{const r=lab.renderer,s=r.compactPerformance.stats,stale=s.lastFrameTime===null||performance.now()-s.lastFrameTime>1200;
    el('compact-shadow').checked=r.quality==='shadow';
    el('compact-fps').textContent=stale?'暂停':s.fps===null?'采样中':s.fps.toFixed(1);
    el('compact-cpu').textContent=stale?'—':s.cpuFrameMs===null?'采样中':s.cpuFrameMs.toFixed(2)+' ms';
    el('compact-gpu').textContent=!s.gpuTimerAvailable?'不支持':stale?'—':s.gpuMs===null?'采样中':s.gpuMs.toFixed(2)+' ms';
    el('compact-draw').textContent=s.drawCalls??'—';el('compact-tri').textContent=s.trianglesPerFrame===null?'—':Math.round(s.trianglesPerFrame).toLocaleString();
    el('compact-memory').textContent=s.geometryGPUBytes===null?'—':(s.geometryGPUBytes/1e6).toFixed(2)+' MB';el('compact-heap').textContent=s.jsHeapBytes===null?'不支持':(s.jsHeapBytes/1e6).toFixed(1)+' MB';
    el('compact-load').textContent=(lab.compact.report.generationMilliseconds/1000).toFixed(2)+' s';
    const hairStatus=lab.hairStatus||{state:'pending'},hair=lab.compact.hair;
    el('compact-hair-retry').hidden=!['failed','cancelled'].includes(hairStatus.state);el('compact-hair-retry').disabled=lab.compactQualityPending===true||lab.character?.busy===true;
    const hairText=hair?hair.report.strands.toLocaleString()+' 条显示发束':hairStatus.state==='failed'?'头发未完成，可重试':hairStatus.state==='cancelled'?'头发计算已取消':'头发稍后显示';
    el('compact-model-label').textContent='重建人物 R2 · '+hairText+(lab.compact.report.precisionLimited?' · 部分区域采用较粗细节，尚未满足目标精度。':'')+' · 几何缓冲不是显卡总占用；JS 堆不是进程总内存。';
  },500);
  window.addEventListener('pagehide',event=>{if(event.persisted||disposed)return;disposed=true;clearInterval(timer);doc.removeEventListener('click',onBasicCommand);panel.remove();style.remove();cancelCompactSurface('人物页面已关闭');lab.compact.dispose();lab.renderer.compactPerformance.dispose();});
  lab.renderer.setQuality('shadow');if(!lab.hair?.inStudio())lab.focus('body');
  const review=new URLSearchParams(window.parent.location.search);if(review.get('review')==='face')requestAnimationFrame(()=>{if(disposed)return;panel.open=false;lab.settings.open('face');lab.face.refresh();lab.face.closeup(review.get('faceView')==='lips'?'lips':'front');});
  publishCompactProgress({group:'ready',state:'ready'});needsRedraw=true;
}
