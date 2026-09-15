import {SHAPE_SCHEMA,SHAPE_REVISION,SHAPE_PARAMETER_SPECS,normalizeCharacterShape} from '../reconstruction/shape-contract.mjs';

export {SHAPE_PARAMETER_SPECS};
export const PHOTO_FIT_SCHEMA='humanoid_rig/photo_fit_profile@0.2';
export const PHOTO_FIT_VERSION='0.2.0-complete-base-r1';
export const PHOTO_FIT_BASE_COMMIT='2c10edaec6e8515bc64f9df8b3da78cb34c89e61';
export const FIT_STAGES=Object.freeze({
  stature:{id:'stature',label:'身高与腿身比例',kind:'shape',keys:['statureScale','legProportion']},
  widths:{id:'widths',label:'肩、髋与腰宽',kind:'shape',keys:['shoulderWidth','hipWidth','waistWidth']},
  volume:{id:'volume',label:'厚度与四肢丰满度',kind:'shape',keys:['torsoDepth','armFullness','legFullness']},
  faceFront:{id:'faceFront',label:'面部正面比例',kind:'face',axes:['x','y']},
  faceDepth:{id:'faceDepth',label:'面部侧面投影',kind:'face',axes:['z']}
});

const FRONT_FULL={
  headTop:'头顶',chin:'下巴',leftShoulder:'图左肩峰',rightShoulder:'图右肩峰',leftWaist:'图左腰侧',rightWaist:'图右腰侧',leftHip:'图左髋侧',rightHip:'图右髋侧',
  leftElbow:'图左肘',rightElbow:'图右肘',leftWrist:'图左腕',rightWrist:'图右腕',leftKnee:'图左膝',rightKnee:'图右膝',leftAnkle:'图左踝',rightAnkle:'图右踝',
  leftArmOuter:'图左上臂外缘',leftArmInner:'图左上臂内缘',rightArmInner:'图右上臂内缘',rightArmOuter:'图右上臂外缘',
  leftThighOuter:'图左大腿外缘',leftThighInner:'图左大腿内缘',rightThighInner:'图右大腿内缘',rightThighOuter:'图右大腿外缘',
  leftBrow:'图左眉心',rightBrow:'图右眉心',leftEye:'图左眼中心',rightEye:'图右眼中心',leftCheek:'图左颧颊',rightCheek:'图右颧颊',leftNose:'图左鼻翼',rightNose:'图右鼻翼',leftMouth:'图左嘴角',rightMouth:'图右嘴角'
};
const FRONT_HEAD=Object.fromEntries(Object.entries(FRONT_FULL).filter(([id])=>['headTop','chin'].includes(id)||/Brow|Eye|Cheek|Nose|Mouth/.test(id)));
const SIDE_FULL={headTop:'头顶',chin:'下巴',cheek:'面颊基准',noseTip:'鼻尖',upperLip:'上唇前缘',lowerLip:'下唇前缘',chinTip:'颏尖',chestBack:'胸背侧',chestFront:'胸前侧',waistBack:'腰背侧',waistFront:'腰腹侧',hipBack:'臀后侧',hipFront:'骨盆前侧',hipJoint:'髋关节高度',ankle:'踝部'};
const SIDE_HEAD=Object.fromEntries(Object.entries(SIDE_FULL).filter(([id])=>['headTop','chin','cheek','noseTip','upperLip','lowerLip','chinTip'].includes(id)));
const DEFS={full:{front:FRONT_FULL,side:SIDE_FULL},head:{front:FRONT_HEAD,side:SIDE_HEAD}};
const DEFAULTS={
  full:{front:{headTop:[.5,.045],chin:[.5,.145],leftShoulder:[.395,.205],rightShoulder:[.605,.205],leftWaist:[.438,.405],rightWaist:[.562,.405],leftHip:[.414,.485],rightHip:[.586,.485],leftElbow:[.345,.365],rightElbow:[.655,.365],leftWrist:[.325,.52],rightWrist:[.675,.52],leftKnee:[.445,.715],rightKnee:[.555,.715],leftAnkle:[.462,.945],rightAnkle:[.538,.945],leftArmOuter:[.365,.292],leftArmInner:[.395,.292],rightArmInner:[.605,.292],rightArmOuter:[.635,.292],leftThighOuter:[.405,.57],leftThighInner:[.458,.57],rightThighInner:[.542,.57],rightThighOuter:[.595,.57],leftBrow:[.486,.085],rightBrow:[.514,.085],leftEye:[.483,.1],rightEye:[.517,.1],leftCheek:[.468,.118],rightCheek:[.532,.118],leftNose:[.492,.118],rightNose:[.508,.118],leftMouth:[.488,.132],rightMouth:[.512,.132]},
        side:{headTop:[.5,.045],chin:[.5,.145],cheek:[.49,.115],noseTip:[.545,.112],upperLip:[.535,.128],lowerLip:[.532,.136],chinTip:[.528,.145],chestBack:[.455,.285],chestFront:[.56,.285],waistBack:[.465,.405],waistFront:[.545,.405],hipBack:[.445,.485],hipFront:[.555,.485],hipJoint:[.5,.485],ankle:[.5,.945]}},
  head:{front:{headTop:[.5,.1],chin:[.5,.88],leftBrow:[.4,.34],rightBrow:[.6,.34],leftEye:[.37,.44],rightEye:[.63,.44],leftCheek:[.25,.6],rightCheek:[.75,.6],leftNose:[.44,.59],rightNose:[.56,.59],leftMouth:[.38,.72],rightMouth:[.62,.72]},
        side:{headTop:[.48,.1],chin:[.48,.88],cheek:[.46,.58],noseTip:[.65,.56],upperLip:[.6,.7],lowerLip:[.59,.75],chinTip:[.58,.88]}}
};
export const LANDMARK_CONNECTIONS={front:[['headTop','chin'],['leftShoulder','rightShoulder'],['leftWaist','rightWaist'],['leftHip','rightHip'],['leftShoulder','leftElbow'],['leftElbow','leftWrist'],['rightShoulder','rightElbow'],['rightElbow','rightWrist'],['leftHip','leftKnee'],['leftKnee','leftAnkle'],['rightHip','rightKnee'],['rightKnee','rightAnkle'],['leftEye','rightEye'],['leftCheek','rightCheek'],['leftNose','rightNose'],['leftMouth','rightMouth']],side:[['headTop','chin'],['cheek','noseTip'],['cheek','upperLip'],['cheek','lowerLip'],['cheek','chinTip'],['chestBack','chestFront'],['waistBack','waistFront'],['hipBack','hipFront'],['hipJoint','ankle']]};

const clone=v=>JSON.parse(JSON.stringify(v));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const avg=a=>a.reduce((s,v)=>s+v,0)/Math.max(1,a.length);
const meanFinite=a=>{const values=a.filter(Number.isFinite);return values.length?avg(values):null;};
function warn(list,code,severity,message){if(!list.some(x=>x.code===code))list.push({code,severity,message});}
function finite(v,label){if(typeof v!=='number'||!Number.isFinite(v))throw Error(label+'必须是有限数值');return v;}
export function landmarkDefinitions(mode='full',view='front'){const source=DEFS[mode]?.[view];if(!source)throw Error('照片模式或视图无效');return Object.fromEntries(Object.entries(source).map(([id,label])=>[id,{id,label,view}]));}
export function createDefaultLandmarks(mode='full',view='front'){const source=DEFAULTS[mode]?.[view];if(!source)throw Error('默认关键点模式无效');return Object.fromEntries(Object.entries(source).map(([id,[x,y]])=>[id,{x,y,confidence:1,source:'manual'}]));}
export function validateLandmarks(input,mode='full',view='front'){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('关键点集合必须为对象');const out={};
  for(const id of Object.keys(landmarkDefinitions(mode,view))){const p=input[id];if(!p)throw Error('缺少关键点 '+id);const x=finite(p.x,id+'.x'),y=finite(p.y,id+'.y'),confidence=p.confidence===undefined?1:finite(p.confidence,id+'.confidence');if(x<0||x>1||y<0||y>1||confidence<0||confidence>1)throw Error('关键点越界 '+id);out[id]={x,y,confidence,source:p.source??'manual'};}
  return out;
}
function px(p,w,h){return{x:p.x*w,y:p.y*h,c:p.confidence};}
function width(points,a,b,w,h){const A=px(points[a],w,h),B=px(points[b],w,h);return{value:Math.abs(B.x-A.x),confidence:avg([A.c,B.c]),source:[a,b]};}
function mid(points,a,b,w,h){const A=px(points[a],w,h),B=px(points[b],w,h);return{x:(A.x+B.x)/2,y:(A.y+B.y)/2,c:avg([A.c,B.c])};}
const measure=(value,confidence,source,status='observed')=>({value,confidence,source,status});
function measureView(input,{mode,view,widthPx,heightPx,knownHeightM=null}){
  const p=validateLandmarks(input,mode,view),m={},warnings=[],top=px(p.headTop,widthPx,heightPx),chin=px(p.chin,widthPx,heightPx),faceH=Math.abs(chin.y-top.y);if(faceH<heightPx*.03)throw Error('头顶与下巴距离过小');
  m.faceReferencePx=measure(faceH,avg([top.c,chin.c]),['headTop','chin']);
  if(view==='front'){
    for(const [id,a,b] of [['eyeSpan','leftEye','rightEye'],['cheekSpan','leftCheek','rightCheek'],['noseSpan','leftNose','rightNose'],['mouthSpan','leftMouth','rightMouth'],['browSpan','leftBrow','rightBrow']]){const x=width(p,a,b,widthPx,heightPx);m[id+'ByFace']=measure(x.value/faceH,x.confidence,x.source);}
    m.mouthToChinByFace=measure(Math.abs(px(p.leftMouth,widthPx,heightPx).y-chin.y)/faceH,avg([p.leftMouth.confidence,p.rightMouth.confidence,chin.c]),['leftMouth','rightMouth','chin']);
    if(mode==='full'){
      const ankles=mid(p,'leftAnkle','rightAnkle',widthPx,heightPx),bodyH=ankles.y-top.y;if(bodyH<heightPx*.45)throw Error('全身关键点高度过小');m.bodyHeightPx=measure(bodyH,avg([ankles.c,top.c]),['headTop','leftAnkle','rightAnkle']);
      for(const [id,a,b] of [['shoulder','leftShoulder','rightShoulder'],['waist','leftWaist','rightWaist'],['hip','leftHip','rightHip'],['armLeft','leftArmOuter','leftArmInner'],['armRight','rightArmInner','rightArmOuter'],['thighLeft','leftThighOuter','leftThighInner'],['thighRight','rightThighInner','rightThighOuter']]){const x=width(p,a,b,widthPx,heightPx);m[id+'WidthByHeight']=measure(x.value/bodyH,x.confidence,x.source);}
      const hips=mid(p,'leftHip','rightHip',widthPx,heightPx);m.hipToAnkleByHeight=measure((ankles.y-hips.y)/bodyH,avg([ankles.c,hips.c]),['leftHip','rightHip','leftAnkle','rightAnkle']);
      if(knownHeightM!=null&&(!Number.isFinite(Number(knownHeightM))||Number(knownHeightM)<.8||Number(knownHeightM)>2.5))throw Error('已知身高应在 0.8–2.5 米');m.knownHeightM=knownHeightM==null?measure(null,0,[],'unknown'):measure(Number(knownHeightM),1,['user:knownHeightM'],'manual');
      if(top.y/heightPx>.08||ankles.y/heightPx<.9)warn(warnings,'BODY_CROP_RISK','warning','人物接近出画，身高与比例可信度下降。');
    }
  }else{
    for(const [id,target] of [['noseProjection','noseTip'],['upperLipProjection','upperLip'],['lowerLipProjection','lowerLip'],['chinProjection','chinTip']])m[id+'ByFace']=measure(Math.abs(px(p[target],widthPx,heightPx).x-px(p.cheek,widthPx,heightPx).x)/faceH,avg([p[target].confidence,p.cheek.confidence]),[target,'cheek']);
    if(mode==='full'){
      const ankle=px(p.ankle,widthPx,heightPx),bodyH=ankle.y-top.y;if(bodyH<heightPx*.45)throw Error('侧面全身高度过小');m.bodyHeightPx=measure(bodyH,avg([ankle.c,top.c]),['headTop','ankle']);
      for(const [id,a,b] of [['chestDepth','chestBack','chestFront'],['waistDepth','waistBack','waistFront'],['hipDepth','hipBack','hipFront']]){const x=width(p,a,b,widthPx,heightPx);m[id+'ByHeight']=measure(x.value/bodyH,x.confidence,x.source);}
    }
  }
  return{schema:'humanoid_rig/photo_measurement_view@0.2',mode,view,width:widthPx,height:heightPx,landmarks:p,measurements:m,warnings};
}
export function measurePhotoSet({mode='full',front,side=null,knownHeightM=null,looseClothing=false,perspectiveWarning=false}){
  if(!front)throw Error('正面照片为必需项');const result={schema:'humanoid_rig/photo_measurement_set@0.2',mode,front:measureView(front.landmarks,{mode,view:'front',widthPx:front.width,heightPx:front.height,knownHeightM}),side:side?measureView(side.landmarks,{mode,view:'side',widthPx:side.width,heightPx:side.height,knownHeightM}):null,warnings:[]};
  for(const x of [...result.front.warnings,...(result.side?.warnings??[])])warn(result.warnings,x.code,x.severity,x.message);if(!side)warn(result.warnings,'SINGLE_VIEW_DEPTH_UNKNOWN','info','没有侧面图，身体厚度和面部前后投影保持未知。');if(looseClothing)warn(result.warnings,'LOOSE_CLOTHING_RISK','warning','宽松衣物会污染身体轮廓测量。');if(perspectiveWarning)warn(result.warnings,'PERSPECTIVE_UNCALIBRATED','warning','明显俯仰或广角会污染比例。');return result;
}

function shapeSpec(id){const s=SHAPE_PARAMETER_SPECS.find(x=>x.id===id);if(!s)throw Error('未知体型参数 '+id);return s;}
function bounded(id,value){const s=shapeSpec(id);return{value:clamp(value,s.min,s.max),clamped:value<s.min||value>s.max};}
function putShape(out,evidence,warnings,id,raw,source,confidence){const b=bounded(id,raw);out[id]=b.value;evidence[id]={status:'candidate',source,confidence,baseValue:evidence.__base[id],targetValue:b.value,unclampedValue:raw,clamped:b.clamped};if(b.clamped)warn(warnings,'SHAPE_LIMIT_'+id.toUpperCase(),'warning',id+' 达到当前 R2 参数边界。');}
export function buildShapeCandidate(measurement,shapeReport,{gain=.75,manual={}}={}){
  if(!shapeReport?.parameters||!shapeReport?.metrics)throw Error('缺少 lab.shape.report()');const base=normalizeCharacterShape(shapeReport.parameters),out={...base},evidence={__base:base},warnings=[...measurement.warnings],f=measurement.front.measurements,s=measurement.side?.measurements,metrics=shapeReport.metrics,stature=metrics.statureM;
  if(Number.isFinite(f.knownHeightM?.value))putShape(out,evidence,warnings,'statureScale',base.statureScale*(f.knownHeightM.value/stature),'front.knownHeightM',1);
  if(Number.isFinite(f.hipToAnkleByHeight?.value))putShape(out,evidence,warnings,'legProportion',base.legProportion+(f.hipToAnkleByHeight.value-.49)*gain*5,'front.hipToAnkleByHeight',f.hipToAnkleByHeight.confidence);
  const mapRatio=(id,obs,ref,scale=1)=>{if(Number.isFinite(obs?.value)&&ref>0)putShape(out,evidence,warnings,id,base[id]+Math.log(obs.value/ref)*gain*scale,'front.'+id,obs.confidence);};
  mapRatio('shoulderWidth',f.shoulderWidthByHeight,metrics.shoulderWidthM/stature,1.8);mapRatio('hipWidth',f.hipWidthByHeight,metrics.hipWidthM/stature,1.8);
  if(Number.isFinite(f.waistWidthByHeight?.value)){putShape(out,evidence,warnings,'waistWidth',base.waistWidth+Math.log(f.waistWidthByHeight.value/.17)*gain*1.2,'front.waistWidthByHeight',f.waistWidthByHeight.confidence*.45);warn(warnings,'WAIST_MAPPING_HEURISTIC','warning','当前运行时未公开腰部可逆实测指标，腰宽只是低置信度工程建议。');}
  if(Number.isFinite(s?.chestDepthByHeight?.value))putShape(out,evidence,warnings,'torsoDepth',base.torsoDepth+Math.log(s.chestDepthByHeight.value/(metrics.torsoDepthM/stature))*gain*1.4,'side.chestDepthByHeight',s.chestDepthByHeight.confidence);
  const arm=meanFinite([f.armLeftWidthByHeight?.value,f.armRightWidthByHeight?.value]),leg=meanFinite([f.thighLeftWidthByHeight?.value,f.thighRightWidthByHeight?.value]);if(Number.isFinite(arm))putShape(out,evidence,warnings,'armFullness',base.armFullness+Math.log(arm/((metrics.armRadiusM*2)/stature))*gain,'front.armWidthByHeight',.7);if(Number.isFinite(leg))putShape(out,evidence,warnings,'legFullness',base.legFullness+Math.log(leg/((metrics.legRadiusM*2)/stature))*gain,'front.thighWidthByHeight',.7);
  for(const [id,value] of Object.entries(manual)){const s=shapeSpec(id),v=finite(Number(value),'人工 '+id);if(v<s.min||v>s.max)throw Error('人工体型参数越界 '+id);out[id]=v;evidence[id]={status:'manual',source:'manual',confidence:1,baseValue:base[id],targetValue:v,clamped:false};}
  delete evidence.__base;return{schema:'humanoid_rig/photo_shape_candidate@0.2',shape:normalizeCharacterShape(out),evidence,warnings};
}

function faceNodes(recipe){return new Map(recipe.nodes.map(n=>[n.id,n]));}
function validFace(input,recipe){const weights={},offsetsMm={};for(const [id,v] of Object.entries(input?.weights??{})){if(!recipe.channels.some(c=>c.id===id)||!Number.isFinite(v)||v<0||v>1)throw Error('面部权重无效 '+id);weights[id]=v;}for(const [id,v] of Object.entries(input?.offsetsMm??{})){if(!recipe.nodes.some(n=>n.id===id)||!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))throw Error('面部位移无效 '+id);offsetsMm[id]=v.slice();}return{schema:'jarvis/face_pose@1',revision:recipe.revision,weights,offsetsMm};}
function limitVector(v,max){const l=Math.hypot(...v),k=l>max?max/l:1;return{value:v.map(x=>x*k),clamped:k<1};}
function addOffset(face,id,axis,delta,recipe,evidence,source,confidence,gain,warnings){const i={x:0,y:1,z:2}[axis],base=face.offsetsMm[id]?.slice()??[0,0,0],raw=base.slice();raw[i]+=delta*gain;const limited=limitVector(raw,recipe.maximumOffsetMm);face.offsetsMm[id]=limited.value;evidence[id]??={};evidence[id][axis]={status:'candidate',source,confidence,baseValue:base[i],targetValue:limited.value[i],clamped:limited.clamped};if(limited.clamped)warn(warnings,'FACE_LIMIT_'+id.toUpperCase(),'warning',id+' 达到 '+recipe.maximumOffsetMm+' mm 位移上限。');}
export function buildFaceCandidate(measurement,baseFace,recipe,{gain=.75,manualOffsetsMm={}}={}){
  const nodes=faceNodes(recipe),face=validFace(baseFace,recipe),evidence={},warnings=[...measurement.warnings],f=measurement.front.measurements;const ref=Math.abs(((nodes.get('browInnerLeft').centre[1]+nodes.get('browInnerRight').centre[1])/2)-nodes.get('chin').centre[1]);
  const pair=(measureId,left,right)=>{const o=f[measureId];if(!Number.isFinite(o?.value))return;const span=Math.abs(nodes.get(left).centre[0]-nodes.get(right).centre[0]),d=(o.value*ref-span)*500;addOffset(face,left,'x',d,recipe,evidence,'front.'+measureId,o.confidence,gain,warnings);addOffset(face,right,'x',-d,recipe,evidence,'front.'+measureId,o.confidence,gain,warnings);};
  pair('cheekSpanByFace','cheekLeft','cheekRight');pair('noseSpanByFace','noseLeft','noseRight');pair('mouthSpanByFace','mouthLeft','mouthRight');pair('browSpanByFace','browInnerLeft','browInnerRight');pair('eyeSpanByFace','lidUpperLeft','lidUpperRight');
  const side=measurement.side?.measurements,cheekZ=(nodes.get('cheekLeft').centre[2]+nodes.get('cheekRight').centre[2])/2;for(const [measureId,ids] of [['noseProjectionByFace',['noseLeft','noseRight']],['upperLipProjectionByFace',['lipUpper']],['lowerLipProjectionByFace',['lipLower']],['chinProjectionByFace',['chin']]]){const o=side?.[measureId];if(!Number.isFinite(o?.value))continue;for(const id of ids)addOffset(face,id,'z',(o.value*ref-Math.abs(nodes.get(id).centre[2]-cheekZ))*1000,recipe,evidence,'side.'+measureId,o.confidence*.8,gain,warnings);}
  if(!side)warn(warnings,'FACE_DEPTH_UNKNOWN','info','没有侧面图，鼻、唇和颏部深度保持当前值。');for(const [id,v] of Object.entries(manualOffsetsMm)){if(!nodes.has(id)||!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))throw Error('人工面部位移无效 '+id);const x=limitVector(v,recipe.maximumOffsetMm);face.offsetsMm[id]=x.value;evidence[id]={manual:{status:'manual',source:'manual',confidence:1,targetValue:x.value,clamped:x.clamped}};}
  if(Object.values(face.weights).some(v=>v!==0))warn(warnings,'BASE_EXPRESSION_PRESERVED','info','当前 NPC 存在表情权重；拟合保留它们，但视觉核对应切回中性。');warn(warnings,'FACE_IDENTITY_CAPACITY_LIMITED','warning','当前源码尚未开放独立颅骨、眼眶、下颌角与鼻梁身份参数。');return{schema:'humanoid_rig/photo_face_candidate@0.2',face:validFace(face,recipe),evidence,warnings,maximumOffsetMm:recipe.maximumOffsetMm};
}
export function buildPhotoFitCandidate({measurement,basePreset,shapeReport,faceRecipe,options={}}){const shape=buildShapeCandidate(measurement,shapeReport,{gain:options.shapeGain,manual:options.manualShape});const face=buildFaceCandidate(measurement,basePreset.appearance.face,faceRecipe,{gain:options.faceGain,manualOffsetsMm:options.manualFaceOffsetsMm});const warnings=[];for(const x of [...shape.warnings,...face.warnings])warn(warnings,x.code,x.severity,x.message);return{schema:'humanoid_rig/photo_fit_candidate@0.2',shape,face,warnings};}
function stageList(input){const list=input==='all'?Object.keys(FIT_STAGES):Array.isArray(input)?input:[input];for(const id of list)if(!FIT_STAGES[id])throw Error('未知拟合阶段 '+id);return[...new Set(list)];}
export function applyCandidateToPreset(basePreset,candidate,stages='all'){
  if(basePreset?.schema!=='jarvis/character_preset@6')throw Error('需要完整源码 character_preset@6 基线');const selected=stageList(stages),out=clone(basePreset),shape=normalizeCharacterShape(out.shape);for(const id of selected){const s=FIT_STAGES[id];if(s.kind==='shape')for(const key of s.keys)shape[key]=candidate.shape.shape[key];}out.shape=normalizeCharacterShape(shape);delete out.statureM;
  const face=clone(out.appearance.face);face.offsetsMm??={};for(const id of selected){const s=FIT_STAGES[id];if(s.kind!=='face')continue;for(const [node,target] of Object.entries(candidate.face.face.offsetsMm)){const v=face.offsetsMm[node]?.slice()??[0,0,0];for(const axis of s.axes)v[{x:0,y:1,z:2}[axis]]=target[{x:0,y:1,z:2}[axis]];if(v.some(x=>x!==0))face.offsetsMm[node]=v;else delete face.offsetsMm[node];}}out.appearance.face=face;return out;
}
function cleanSource(s={}){for(const key of ['data','bytes','blob','dataUrl','objectUrl','base64','pixels'])if(Object.hasOwn(s,key))throw Error('拟合档案禁止保存图片字段 '+key);return{imageId:String(s.imageId??'local-photo'),view:String(s.view??'unknown'),fileName:String(s.fileName??''),mimeType:String(s.mimeType??''),width:Number.isInteger(s.width)?s.width:null,height:Number.isInteger(s.height)?s.height:null,sha256:s.sha256?String(s.sha256):null,storage:'local-session-only'};}
export function createPhotoFitProfile({projectId='local-photo-fit-test',subjectId='npc-test',targetInstanceId='unknown',sourceImages=[],measurement,candidate,basePreset,shapeReport,appliedStages=[]}){
  if(!measurement||!candidate||!basePreset||!shapeReport)throw Error('拟合档案输入不完整');const p={schema:PHOTO_FIT_SCHEMA,version:PHOTO_FIT_VERSION,baseCommit:PHOTO_FIT_BASE_COMMIT,projectId:String(projectId),subjectId:String(subjectId),targetInstanceId:String(targetInstanceId),revision:1,createdAt:new Date().toISOString(),policy:{sourceImagePersistence:'not-embedded',automaticIdentityClaim:false,depthInference:measurement.side?'manual-two-view-candidate':'unknown-without-side-view',poseMutation:false,animationMutation:false,sharedMotherMutation:false},coordinateSystem:{image:'normalized-top-left',rig:'right-handed-Y-up-Z-forward'},sourceImages:sourceImages.map(cleanSource),measurement:clone(measurement),candidate:clone(candidate),appliedStages:stageList(appliedStages),base:{characterSchema:basePreset.schema,bodyPlanRevision:basePreset.bodyPlanRevision,bodyArchetype:basePreset.bodyArchetype,characterId:basePreset.id,label:basePreset.label,shape:clone(basePreset.shape),face:clone(basePreset.appearance.face),shapeReport:{schema:shapeReport.schema,method:shapeReport.method,parameterDomain:shapeReport.parameterDomain,metrics:clone(shapeReport.metrics)}},boundaries:{proportionProfileCommitted:false,projectRevisionIntegrated:false,runtimeVerified:false,visualAcceptance:false,productionReady:false}};if(/data:image|blob:|base64,/i.test(JSON.stringify(p)))throw Error('拟合档案检测到图片载荷');return p;
}
export function candidateDiff(basePreset,candidate){const shape=Object.fromEntries(SHAPE_PARAMETER_SPECS.map(s=>[s.id,{before:basePreset.shape[s.id],after:candidate.shape.shape[s.id],delta:candidate.shape.shape[s.id]-basePreset.shape[s.id]}])),ids=new Set([...Object.keys(basePreset.appearance.face.offsetsMm??{}),...Object.keys(candidate.face.face.offsetsMm??{})]),face={};for(const id of ids){const before=basePreset.appearance.face.offsetsMm?.[id]??[0,0,0],after=candidate.face.face.offsetsMm?.[id]??[0,0,0];face[id]={before:[...before],after:[...after],delta:after.map((v,i)=>v-before[i])};}return{shape,face};}
