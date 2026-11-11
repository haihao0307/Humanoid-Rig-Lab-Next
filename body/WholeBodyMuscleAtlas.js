/* Whole-body procedural muscle atlas R01.
 * Pose-driven soft-tissue approximation. It is not a physiological FEM solver.
 * Reads the existing R2 source rig and live pose; never writes joints or finalPose.
 * Units: metres. Muscle fields are analytic envelopes evaluated before skinning.
 */
const WHOLE_BODY_MUSCLE_ATLAS = Object.freeze({
  schema: 'human/whole_body_muscle_atlas@1',
  revision: 'R01',
  calibrated: false,
  groups: Object.freeze([
    {id:'pectoralis-major',label:'胸大肌',region:'chest',pair:true,from:'sternum',to:'AC',radius:.075,strain:.12,driver:'shoulderAdduction'},
    {id:'deltoid',label:'三角肌',region:'shoulder',pair:true,from:'AC',to:'upperArm',radius:.070,strain:.10,driver:'shoulderElevation'},
    {id:'trapezius',label:'斜方肌',region:'back',pair:true,from:'C7',to:'AC',radius:.060,strain:.08,driver:'shoulderElevation'},
    {id:'latissimus-dorsi',label:'背阔肌',region:'back',pair:true,from:'T8',to:'upperArm',radius:.070,strain:.10,driver:'shoulderExtension'},
    {id:'biceps-brachii',label:'肱二头肌',region:'upper-arm',pair:true,from:'upperArm',to:'forearm',radius:.050,strain:.14,driver:'elbowFlexion'},
    {id:'triceps-brachii',label:'肱三头肌',region:'upper-arm',pair:true,from:'upperArm',to:'forearm',radius:.052,strain:.12,driver:'elbowExtension'},
    {id:'forearm-flexors',label:'前臂屈肌群',region:'forearm',pair:true,from:'forearm',to:'hand',radius:.038,strain:.08,driver:'wristFlexion'},
    {id:'forearm-extensors',label:'前臂伸肌群',region:'forearm',pair:true,from:'forearm',to:'hand',radius:.036,strain:.07,driver:'wristExtension'},
    {id:'rectus-abdominis',label:'腹直肌',region:'abdomen',pair:false,from:'L5',to:'sternum',radius:.060,strain:.08,driver:'trunkFlexion'},
    {id:'external-oblique',label:'腹外斜肌',region:'abdomen',pair:true,from:'L5',to:'T8',radius:.055,strain:.07,driver:'trunkRotation'},
    {id:'erector-spinae',label:'竖脊肌',region:'back',pair:true,from:'L5',to:'T8',radius:.060,strain:.08,driver:'trunkExtension'},
    {id:'gluteus-maximus',label:'臀大肌',region:'glute',pair:true,from:'hips',to:'femur',radius:.080,strain:.12,driver:'hipExtension'},
    {id:'gluteus-medius',label:'臀中肌',region:'glute',pair:true,from:'hips',to:'femur',radius:.060,strain:.08,driver:'hipAbduction'},
    {id:'quadriceps',label:'股四头肌',region:'thigh',pair:true,from:'femur',to:'tibia',radius:.075,strain:.13,driver:'kneeExtension'},
    {id:'hamstrings',label:'腘绳肌群',region:'thigh',pair:true,from:'femur',to:'tibia',radius:.065,strain:.11,driver:'kneeFlexion'},
    {id:'adductors',label:'大腿内收肌群',region:'thigh',pair:true,from:'hips',to:'femur',radius:.055,strain:.08,driver:'hipAdduction'},
    {id:'gastrocnemius',label:'腓肠肌',region:'calf',pair:true,from:'tibia',to:'foot',radius:.055,strain:.11,driver:'anklePlantarFlexion'},
    {id:'soleus',label:'比目鱼肌',region:'calf',pair:true,from:'tibia',to:'foot',radius:.050,strain:.08,driver:'anklePlantarFlexion'},
    {id:'tibialis-anterior',label:'胫骨前肌',region:'calf',pair:true,from:'tibia',to:'foot',radius:.034,strain:.07,driver:'ankleDorsiflexion'}
  ])
});
const wbmaClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wbmaDot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const wbmaSub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const wbmaAdd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const wbmaMul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const wbmaLength=a=>Math.hypot(a[0],a[1],a[2]);
const wbmaNorm=a=>{const n=wbmaLength(a)||1;return wbmaMul(a,1/n);};
const wbmaSmooth=(a,b,x)=>{const t=wbmaClamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function wbmaWorldFrame(human,id,frames){return frames?.get(id)||human.byId.get(id)?.world||null;}
function wbmaAngle(a,b){return Math.acos(wbmaClamp(wbmaDot(wbmaNorm(a),wbmaNorm(b)),-1,1));}
function wbmaPoseDrivers(human,side,frames){
 const get=id=>wbmaWorldFrame(human,id,frames)?.p;
 const arm=get(side+'_upperArm'),elbow=get(side+'_forearm'),hand=get(side+'_hand');
 const hip=get(side+'_femur'),knee=get(side+'_tibia'),ankle=get(side+'_foot');
 const rest=id=>human.sourceBind.get(id)?.p;
 const required=[arm,elbow,hand,hip,knee,ankle,rest(side+'_upperArm'),rest(side+'_forearm'),rest(side+'_hand'),rest(side+'_femur'),rest(side+'_tibia'),rest(side+'_foot')];
 if(required.some(v=>!v))return null;
 const armDir=wbmaNorm(wbmaSub(elbow,arm)),foreDir=wbmaNorm(wbmaSub(hand,elbow));
 const legDir=wbmaNorm(wbmaSub(knee,hip)),shinDir=wbmaNorm(wbmaSub(ankle,knee));
 const restArm=wbmaNorm(wbmaSub(rest(side+'_forearm'),rest(side+'_upperArm')));
 const restFore=wbmaNorm(wbmaSub(rest(side+'_hand'),rest(side+'_forearm')));
 const restLeg=wbmaNorm(wbmaSub(rest(side+'_tibia'),rest(side+'_femur')));
 const restShin=wbmaNorm(wbmaSub(rest(side+'_foot'),rest(side+'_tibia')));
 const elbowFlex=wbmaClamp((wbmaAngle(armDir,foreDir)-wbmaAngle(restArm,restFore))/1.9,0,1);
 const kneeFlex=wbmaClamp((wbmaAngle(legDir,shinDir)-wbmaAngle(restLeg,restShin))/1.9,0,1);
 const chest= get('T1')||get('T3'),pelvis=get('L5')||get('hips');
 const restChest=rest('T1'),restPelvis=rest('L5');
 const trunkFlex=chest&&pelvis&&restChest&&restPelvis?wbmaClamp(Math.abs((chest[2]-pelvis[2])-(restChest[2]-restPelvis[2]))/.12,0,1):0;
 const shoulderElevation=wbmaClamp((Math.abs(restArm[1])-Math.abs(armDir[1]))/.9,0,1);
 const hipFlex=wbmaClamp(wbmaAngle(legDir,restLeg)/1.2,0,1),hipAbduction=wbmaClamp(Math.abs(legDir[0]-restLeg[0])/.8,0,1);
 const wristFlex=wbmaClamp(wbmaAngle(foreDir,restFore)/1.2,0,1);
 const ankleFlex=wbmaClamp(wbmaAngle(shinDir,restShin)/1.0,0,1);
 return {elbowFlex,kneeFlex,trunkFlex,shoulderElevation,wristFlex,ankleFlex,hipFlex,hipAbduction};
}
function wbmaDriverValue(driver,d){
 switch(driver){
  case 'elbowFlexion': case 'kneeFlexion': return driver==='elbowFlexion'?d.elbowFlex:d.kneeFlex;
  case 'elbowExtension': case 'kneeExtension': return 1-(driver==='elbowExtension'?d.elbowFlex:d.kneeFlex);
  case 'shoulderElevation': case 'shoulderAdduction': case 'shoulderExtension': return d.shoulderElevation;
  case 'trunkFlexion': case 'trunkRotation': return d.trunkFlex;
  case 'trunkExtension': return 1-d.trunkFlex;
  case 'wristFlexion': case 'wristExtension': return d.wristFlex;
  case 'anklePlantarFlexion': case 'ankleDorsiflexion': return d.ankleFlex;
  case 'hipExtension': case 'hipAdduction': return d.hipFlex||0;
  case 'hipAbduction': return d.hipAbduction||0;
  default: return 0;
 }
}
function buildWholeBodyMuscleRuntime(human,frames=null){
 if(!human?.byId||!human?.sourceBind)throw Error('Whole-body muscle atlas requires the existing HumanRig runtime');
 const instances=[];
 for(const group of WHOLE_BODY_MUSCLE_ATLAS.groups){
  const sides=group.pair?['left','right']:[''];
  for(const side of sides){
   const resolveAnchor=id=>side&&human.sourceBind.has(side+'_'+id)?side+'_'+id:id;
   const from=resolveAnchor(group.from),to=resolveAnchor(group.to);
   const a=human.sourceBind.get(from)?.p,b=human.sourceBind.get(to)?.p;
   const currentA=wbmaWorldFrame(human,from,frames)?.p,currentB=wbmaWorldFrame(human,to,frames)?.p;
   if(!a||!b||!currentA||!currentB)continue;
   const axis=wbmaNorm(wbmaSub(b,a)),length=wbmaLength(wbmaSub(b,a));
   const drivers=side?wbmaPoseDrivers(human,side,frames):wbmaPoseDrivers(human,'left',frames);
   const activation=wbmaDriverValue(group.driver,drivers||{elbowFlex:0,kneeFlex:0,trunkFlex:0,shoulderElevation:0,wristFlex:0,ankleFlex:0,hipFlex:0,hipAbduction:0});
   instances.push({id:group.id+(side?'-'+side:''),group:group.id,label:group.label,region:group.region,side:side||'center',
    origin:a.slice(),axis,length,radius:group.radius,strain:group.strain,activation,
    currentOrigin:currentA.slice(),currentInsertion:currentB.slice(),
    calibrated:false,source:'R2 BodyParts3D-derived rig + pose proxy'});
  }
 }
 return {schema:'human/whole_body_muscle_runtime@1',revision:WHOLE_BODY_MUSCLE_ATLAS.revision,
  instances,activeCount:instances.filter(x=>x.activation>.01).length,
  coverage:{chest:true,back:true,shoulder:true,upperArm:true,forearm:true,abdomen:true,glute:true,thigh:true,calf:true},
  calibrated:false,limitations:['Muscle activation is pose-proxy driven, not EMG or subject calibrated.','Muscle geometry is an analytic envelope, not a volumetric FEM simulation.','Skin collision and fascia sliding require separate carrier integration.']};
}
function deformWholeBodyMusclePoint(point,runtime){
 if(!runtime?.instances?.length)return point;
 let p=point;
 for(const m of runtime.instances){
  const activation=wbmaClamp(m.activation,0,1);
  if(activation<.005)continue;
  const rel=wbmaSub(p,m.origin),along=wbmaDot(rel,m.axis),t=along/m.length;
  if(t<.08||t>.92)continue;
  const radial=wbmaSub(rel,wbmaMul(m.axis,along)),r=wbmaLength(radial);
  if(r>m.radius)continue;
  const endFade=wbmaSmooth(.08,.22,t)*(1-wbmaSmooth(.78,.92,t));
  const radialFade=1-wbmaSmooth(m.radius*.68,m.radius,r);
  const bell=16*t*t*(1-t)*(1-t);
  const compression=wbmaClamp(m.strain*activation*bell*endFade*radialFade,0,.18);
  const expansion=1/Math.sqrt(1-compression)-1;
  p=wbmaAdd(p,wbmaMul(radial,expansion));
 }
 return p;
}
function reportWholeBodyMuscleAtlas(human,frames=null){
 const runtime=buildWholeBodyMuscleRuntime(human,frames);
 return {...runtime,groupCount:WHOLE_BODY_MUSCLE_ATLAS.groups.length,
  regionCount:new Set(WHOLE_BODY_MUSCLE_ATLAS.groups.map(x=>x.region)).size,
  bilateralInstanceCount:runtime.instances.filter(x=>x.side!=='center').length,
  geometryIntegrated:false,rendererIntegrated:false,visualAcceptance:false,productionReady:false};
}
