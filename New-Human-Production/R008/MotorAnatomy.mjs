import {add,sub,mul,length} from './AnatomyMath.mjs';

// Species-level path hypotheses in anatomical axes, never character coordinates.
// An attachment is [owning role, position along its segment, lateral, up, front].
const A=(role,t,x=0,y=0,z=0)=>[role,t,x,y,z];
const C=(id,label,action,antagonist,radius,points)=>({id,label,action,antagonist,radius,points});
export const MOTOR_MUSCLES=[
 C('deltoid_front','三角肌前束','肩屈曲','deltoid_back',.018,[A('clavicle',.78,0,0,.020),A('upperarm',.18,.019,0,.024),A('upperarm',.56,0,0,.006)]),
 C('deltoid_middle','三角肌中束','肩外展','latissimus',.020,[A('clavicle',.92,0,.008,0),A('upperarm',.18,.029,0,0),A('upperarm',.58,.007,0,0)]),
 C('deltoid_back','三角肌后束','肩伸展','deltoid_front',.018,[A('chest',.60,.070,0,-.028),A('upperarm',.18,.018,0,-.024),A('upperarm',.56,0,0,-.006)]),
 C('pectoralis','胸大肌','肩内收 / 屈曲','latissimus',.025,[A('chest',.25,.010,-.005,.038),A('chest',.35,.050,-.005,.046),A('upperarm',.25,-.006,0,.013)]),
 C('latissimus','背阔肌','肩伸展 / 内收','deltoid_front',.025,[A('spineLower',.25,.028,0,-.031),A('chest',-.18,.065,0,-.036),A('upperarm',.22,-.006,0,-.010)]),
 C('trapezius','斜方肌上束','肩胛上提 / 稳定','pectoralis',.014,[A('neck',.24,0,0,-.018),A('chest',.78,.035,0,-.025),A('clavicle',.88,0,0,-.010)]),
 C('biceps','肱二头肌','屈肘 / 前臂旋后','triceps',.020,[A('upperarm',.06,-.004,0,.020),A('upperarm',.58,0,0,.026),A('lowerarm',.23,-.004,0,.010)]),
 // Shared posterior elbow routing prior prevents the tendon taking a shortcut
 // through the joint at deep flexion. It is not a measured muscle attachment.
 C('triceps','肱三头肌','伸肘','biceps',.023,[A('upperarm',.08,0,0,-.018),A('upperarm',.56,0,0,-.028),A('upperarm',1,0,0,-.012),A('lowerarm',.07,0,0,-.009)]),
 C('forearm_flexors','前臂屈肌群','屈腕 / 握持','forearm_extensors',.014,[A('lowerarm',.06,-.007,0,.014),A('lowerarm',.45,0,0,.019),A('hand',.28,0,0,.005)]),
 C('forearm_extensors','前臂伸肌群','伸腕 / 稳定手掌','forearm_flexors',.013,[A('lowerarm',.07,.004,0,-.014),A('lowerarm',.44,0,0,-.017),A('hand',.25,0,0,-.004)]),
 C('erectors','竖脊肌群','躯干伸展 / 稳定','rectus_abdominis',.016,[A('pelvis',.14,.018,0,-.031),A('spineMiddle',0,.019,0,-.035),A('chest',.42,.020,0,-.030)]),
 C('rectus_abdominis','腹直肌','躯干屈曲 / 腹压','erectors',.017,[A('pelvis',0,.017,0,.038),A('spineLower',.58,.018,0,.044),A('chest',-.20,.020,0,.041)]),
 C('oblique','腹外斜肌','躯干旋转 / 稳定','erectors',.021,[A('pelvis',.15,.047,0,.020),A('spineMiddle',-.12,.059,0,.027),A('chest',-.05,.063,0,.020)]),
 C('gluteus_maximus','臀大肌','伸髋','hip_flexors',.035,[A('pelvis',.03,.035,0,-.027),A('thigh',.15,.012,0,-.044),A('thigh',.42,.016,0,-.008)]),
 C('gluteus_medius','臀中肌','髋外展 / 骨盆稳定','adductors',.023,[A('pelvis',.10,.059,0,-.009),A('thigh',.04,.019,0,-.014),A('thigh',.20,.017,0,0)]),
 C('hip_flexors','髂腰肌作用束','屈髋','gluteus_maximus',.013,[A('spineLower',.35,.018,0,.010),A('pelvis',.02,.026,0,.022),A('thigh',.18,-.009,0,.007)]),
 C('rectus_femoris','股直肌','伸膝 / 屈髋','hamstrings',.024,[A('pelvis',0,.049,0,.031),A('thigh',.44,0,0,.034),A('thigh',.98,0,0,.016),A('calf',.16,0,0,.012)]),
 C('vastus_lateral','股外侧肌','伸膝','hamstrings',.025,[A('thigh',.09,.018,0,.007),A('thigh',.52,.025,0,.018),A('thigh',.98,.004,0,.017),A('calf',.12,0,0,.009)]),
 C('vastus_medial','股内侧肌','伸膝 / 髌骨稳定','hamstrings',.021,[A('thigh',.17,-.016,0,.009),A('thigh',.68,-.021,0,.021),A('thigh',.98,-.002,0,.018),A('calf',.12,0,0,.009)]),
 C('hamstrings','腘绳肌群','屈膝 / 伸髋','rectus_femoris',.027,[A('pelvis',0,.034,0,-.025),A('thigh',.50,0,0,-.034),A('calf',.16,.008,0,-.016)]),
 C('adductors','大腿内收肌群','髋内收 / 稳定','gluteus_medius',.021,[A('pelvis',0,.016,0,.004),A('thigh',.30,-.025,0,.002),A('thigh',.75,-.012,0,.005)]),
 C('gastrocnemius','腓肠肌','踝跖屈 / 辅助屈膝','tibialis',.023,[A('thigh',.92,0,0,-.012),A('calf',.30,0,0,-.031),A('calf',.75,0,0,-.013),A('foot',0,0,-.009,-.015)]),
 C('soleus','比目鱼肌','踝跖屈 / 支撑','tibialis',.020,[A('calf',.23,.010,0,-.016),A('calf',.58,.010,0,-.025),A('foot',0,0,-.010,-.014)]),
 C('tibialis','胫骨前肌','踝背屈 / 落脚控制','gastrocnemius',.013,[A('calf',.09,.008,0,.013),A('calf',.45,.011,0,.018),A('foot',.66,-.005,0,.004)])
];
const NEXT={pelvis:'spineLower',spineLower:'spineMiddle',spineMiddle:'chest',chest:'neck',neck:'head',clavicle:'upperarm',upperarm:'lowerarm',lowerarm:'hand',hand:'middle_1',thigh:'calf',calf:'foot',foot:'ball'};
export function fitMotorAnatomy(profile){
 if(!profile.canDeform||!profile.frame)throw Error('Motor anatomy requires a reviewed, unambiguous bind rig');
 const h=profile.frame.height,{right,up,front}=profile.frame,central=new Set(['pelvis','spineLower','spineMiddle','chest','neck','head']);
 const resolve=(r,side)=>central.has(r)?r:r+'_'+side;
 const muscles=[];
 for(const side of ['l','r'])for(const spec of MOTOR_MUSCLES){
  const attachments=spec.points.map(([r,t,x,y,z])=>{const role=resolve(r,side),id=profile.roles[role],next=profile.roles[resolve(NEXT[r],side)];if(!Number.isInteger(id)||!Number.isInteger(next))return null;
   const p=profile.joints[id].position,b=profile.joints[next].position,offset=add(add(mul(right,x*h*(side==='l'?1:-1)),mul(up,y*h)),mul(front,z*h));
   return {bone:id,role,bindPoint:add(add(p,mul(sub(b,p),t)),offset),evidence:'estimated-attachment'};
  });
  if(attachments.some(a=>!a)){continue;}
  muscles.push({...spec,id:spec.id+'_'+side,side,antagonist:spec.antagonist+'_'+side,radius:spec.radius*h,attachments,evidence:'authored-motion-path-hypothesis'});
 }
 return {schema:'human/motor-anatomy@1',sourceId:profile.sourceId,scale:h,muscles,unknown:['internal-bone-surfaces','individual-muscle-attachments','physiological-activation','force'],authority:'bind-rig-kinematics; estimated muscle geometry'};
}

export function bellyProfile(t){return t<.13||t>.87?.10:.10+.90*Math.sin(Math.PI*(t-.13)/.74)**.70;}
export function pathMetrics(points){
 let lengthSum=0,weighted=0;for(let i=1;i<points.length;i++){const d=length(sub(points[i],points[i-1])),a=bellyProfile((i-1)/(points.length-1)),b=bellyProfile(i/(points.length-1));lengthSum+=d;weighted+=d*(a*a+a*b+b*b)/3;}
 if(!(lengthSum>1e-9&&weighted>0))throw Error('Degenerate muscle path');return {length:lengthSum,weighted};
}
export function muscleKinematics(rest,current,radius,previousLength=current.length,dt=0){
 if(!(radius>0&&Number.isFinite(radius))||!Number.isFinite(current.weighted)||current.weighted<=0)throw Error('Invalid muscle geometry');
 const radialScale=Math.sqrt(rest.weighted/current.weighted),ratio=current.length/rest.length;
 return {length:current.length,lengthRatio:ratio,radialScale,shortening:Math.max(0,1-ratio),lengthening:Math.max(0,ratio-1),velocity:dt>0?(current.length-previousLength)/dt:0,volumeProxy:Math.PI*radius*radius*radialScale*radialScale*current.weighted,activation:'NotObserved'};
}
