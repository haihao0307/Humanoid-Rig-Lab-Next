import {add,mul,lerp,sub,length,projection,segmentPoint,wendland,contractionRadius}from './AnatomyMath.mjs';
// Authored anatomical relationships, not individually observed muscle meshes.
// Each path is expressed relative to this subject's measured bind landmarks.
const CATALOG=[
 ['pectoralis_major','胸大肌','torso','chest','upperarm',.0,.20,.40,'肩内收/前屈','deltoid_posterior'],
 ['pectoralis_minor','胸小肌（深层）','torso','chest','clavicle',.25,.70,.25,'肩胛前引','rhomboid_major'],
 ['rectus_abdominis','腹直肌','torso','chest','pelvis',.10,.85,.45,'躯干屈曲','erector_spinae'],
 ['external_oblique','腹外斜肌','torso','chest','pelvis',.12,.90,.25,'躯干旋转/侧屈','external_oblique'],
 ['internal_oblique','腹内斜肌（深层）','torso','pelvis','chest',.15,.80,.16,'躯干旋转/侧屈','internal_oblique'],
 ['transversus_abdominis','腹横肌（深层）','torso','pelvis','chest',.20,.70,.05,'腹部稳定',''],
 ['serratus_anterior','前锯肌','torso','chest','clavicle',.10,.80,.20,'肩胛前伸','rhomboid_major'],
 ['latissimus_dorsi','背阔肌','torso','pelvis','upperarm',.20,.10,-.35,'肩伸展/内收','pectoralis_major'],
 ['trapezius_upper','斜方肌上束','torso','neck','clavicle',.20,.65,-.28,'肩胛上提','trapezius_lower'],
 ['trapezius_middle','斜方肌中束','torso','chest','clavicle',.25,.70,-.35,'肩胛后缩','serratus_anterior'],
 ['trapezius_lower','斜方肌下束','torso','spineMiddle','clavicle',.0,.70,-.35,'肩胛下压','trapezius_upper'],
 ['rhomboid_major','菱形肌','torso','chest','clavicle',.15,.60,-.28,'肩胛后缩','serratus_anterior'],
 ['erector_spinae','竖脊肌群','torso','pelvis','neck',.15,.80,-.40,'躯干伸展','rectus_abdominis'],
 ['sternocleidomastoid','胸锁乳突肌','neck','clavicle','head',.10,.10,.20,'颈部旋转/屈曲','sternocleidomastoid'],
 ['deltoid_anterior','三角肌前束','arm','clavicle','upperarm',.70,.36,.55,'肩前屈','deltoid_posterior'],
 ['deltoid_middle','三角肌中束','arm','clavicle','upperarm',.80,.42,.0,'肩外展','pectoralis_major'],
 ['deltoid_posterior','三角肌后束','arm','clavicle','upperarm',.70,.36,-.55,'肩伸展','deltoid_anterior'],
 ['biceps_brachii','肱二头肌','arm','upperarm','lowerarm',.10,.90,.65,'肘屈曲/前臂旋后','triceps_brachii'],
 ['brachialis','肱肌','arm','upperarm','lowerarm',.35,.98,.22,'肘屈曲','triceps_brachii'],
 ['triceps_brachii','肱三头肌','arm','upperarm','lowerarm',.05,.96,-.70,'肘伸展','biceps_brachii'],
 ['brachioradialis','肱桡肌','arm','lowerarm','hand',.0,.80,.40,'肘屈曲','triceps_brachii'],
 ['pronator_teres','旋前圆肌','arm','lowerarm','hand',.02,.50,.32,'前臂旋前','supinator'],
 ['supinator','旋后肌（深层）','arm','lowerarm','hand',.02,.36,-.25,'前臂旋后','pronator_teres'],
 ['flexor_carpi_radialis','桡侧腕屈肌','arm','lowerarm','hand',.06,.95,.45,'腕屈曲/桡偏','extensor_carpi_radialis'],
 ['flexor_carpi_ulnaris','尺侧腕屈肌','arm','lowerarm','hand',.06,.95,.38,'腕屈曲/尺偏','extensor_carpi_ulnaris'],
 ['extensor_carpi_radialis','桡侧腕伸肌群','arm','lowerarm','hand',.05,.96,-.40,'腕伸展/桡偏','flexor_carpi_radialis'],
 ['extensor_carpi_ulnaris','尺侧腕伸肌','arm','lowerarm','hand',.05,.96,-.32,'腕伸展/尺偏','flexor_carpi_ulnaris'],
 ['finger_flexors','指屈肌群','arm','lowerarm','hand',.10,.99,.20,'手指屈曲','finger_extensors'],
 ['finger_extensors','指伸肌群','arm','lowerarm','hand',.12,.99,-.20,'手指伸展','finger_flexors'],
 ['thenar','鱼际肌群','hand','hand','thumb_1',.16,.85,.10,'拇指对掌',''],
 ['hypothenar','小鱼际肌群','hand','hand','pinky_1',.18,.85,.10,'小指活动',''],
 ['interossei_hand','手骨间肌群','hand','hand','middle_1',.20,.80,.0,'手指内收/外展',''],
 ['gluteus_maximus','臀大肌','leg','pelvis','thigh',.35,.24,-.62,'髋伸展','iliopsoas'],
 ['gluteus_medius','臀中肌','leg','pelvis','thigh',.45,.18,-.15,'髋外展/骨盆稳定','adductor_longus'],
 ['gluteus_minimus','臀小肌（深层）','leg','pelvis','thigh',.48,.20,-.10,'髋外展/内旋','adductor_longus'],
 ['iliopsoas','髂腰肌（深层）','leg','pelvis','thigh',.0,.15,.18,'髋屈曲','gluteus_maximus'],
 ['rectus_femoris','股直肌','leg','thigh','calf',.04,.94,.65,'膝伸展/髋屈曲','biceps_femoris'],
 ['vastus_lateralis','股外侧肌','leg','thigh','calf',.12,.98,.35,'膝伸展','biceps_femoris'],
 ['vastus_medialis','股内侧肌','leg','thigh','calf',.18,.98,.38,'膝伸展','semitendinosus'],
 ['vastus_intermedius','股中间肌（深层）','leg','thigh','calf',.12,.96,.16,'膝伸展','semimembranosus'],
 ['biceps_femoris','股二头肌','leg','thigh','calf',.03,.95,-.55,'膝屈曲/髋伸展','rectus_femoris'],
 ['semitendinosus','半腱肌','leg','thigh','calf',.04,.96,-.42,'膝屈曲/髋伸展','vastus_medialis'],
 ['semimembranosus','半膜肌','leg','thigh','calf',.04,.94,-.35,'膝屈曲/髋伸展','vastus_intermedius'],
 ['adductor_longus','长收肌','leg','pelvis','thigh',.25,.60,.16,'髋内收','gluteus_medius'],
 ['adductor_magnus','大收肌','leg','pelvis','thigh',.20,.90,-.10,'髋内收','gluteus_medius'],
 ['gracilis','股薄肌','leg','pelvis','calf',.40,.03,.05,'髋内收/膝屈曲','gluteus_medius'],
 ['sartorius','缝匠肌','leg','thigh','calf',.0,.99,.25,'髋屈曲/膝屈曲','gluteus_maximus'],
 ['gastrocnemius_medial','腓肠肌内侧头','leg','calf','foot',.0,.77,-.60,'踝跖屈/膝屈曲','tibialis_anterior'],
 ['gastrocnemius_lateral','腓肠肌外侧头','leg','calf','foot',.0,.74,-.54,'踝跖屈/膝屈曲','tibialis_anterior'],
 ['soleus','比目鱼肌','leg','calf','foot',.17,.96,-.40,'踝跖屈','tibialis_anterior'],
 ['tibialis_anterior','胫骨前肌','leg','calf','foot',.10,.95,.38,'踝背屈','soleus'],
 ['fibularis_longus','腓骨长肌','leg','calf','foot',.14,.95,.02,'足外翻/跖屈','tibialis_anterior'],
 ['toe_extensors','趾伸肌群','leg','calf','ball',.20,.94,.18,'伸趾/背屈','toe_flexors'],
 ['toe_flexors','趾屈肌群','leg','calf','ball',.20,.94,-.16,'屈趾/跖屈','toe_extensors'],
 ['intrinsic_foot','足内在肌群','foot','foot','ball',.05,.95,.0,'足弓稳定/趾部活动','']
];
const central=new Set(['pelvis','spineLower','spineMiddle','chest','neck','head']);
export const MUSCLE_CATALOG=Object.freeze(CATALOG.map(([id,label,group,a,b,start,end,front,actions,antagonist])=>Object.freeze({id,label,group,a,b,start,end,front,actions:actions.split('/'),antagonist})));
export function buildMuscleAtlas(profile){const {roles,joints,segments,frame}=profile,role=(r,s)=>central.has(r)?r:r+'_'+s,rows=[];
 for(const spec of MUSCLE_CATALOG)for(const side of ['l','r']){const ar=role(spec.a,side),br=role(spec.b,side),ai=roles[ar],bi=roles[br],available=Number.isInteger(ai)&&Number.isInteger(bi),attachments=[{role:ar,fraction:spec.start},{role:br,fraction:spec.end}],row={id:spec.id+'_'+side,label:spec.label+' · '+(side==='l'?'左':'右'),group:spec.group,side,actions:spec.actions,antagonists:spec.antagonist?[spec.antagonist+'_'+side]:[],attachments,evidence:'authored-anatomical-hypothesis',available,internalBoundary:'NotObserved',attachmentAccuracy:'NotObserved'};
  if(available){const a=joints[ai].position,b=joints[bi].position,L=length(sub(b,a)),radius=Math.max(frame.height*.006,(segments[ai].surfaceRadius||L*.20)*.55),spread=central.has(spec.a)?frame.height*.045*(side==='l'?1:-1):0,offset=add(mul(frame.front,radius*spec.front),mul(frame.right,spread));row.path=[add(lerp(a,b,spec.start),offset),add(lerp(a,b,(spec.start+spec.end)*.5),offset),add(lerp(a,b,spec.end),offset)];row.radius=radius*1.8;row.restLength=length(sub(row.path[1],row.path[0]))+length(sub(row.path[2],row.path[1]));row.boneIds=[ai,ai,bi];row.surfaceSupportEvidence=segments[ai].surfaceRadius?'sampled-skin-radius-plus-authored-ratios':'template-only';}
  rows.push(row);
 }return rows;
}
export function muscleWeight(p,m){if(!m.available)return 0;let d=Infinity;for(let i=0;i<m.path.length-1;i++)d=Math.min(d,length(sub(p,segmentPoint(p,m.path[i],m.path[i+1]))));return wendland(d/m.radius);}
export function muscleState(m,path){const currentLength=path.slice(1).reduce((s,p,i)=>s+length(sub(p,path[i])),0);return {length:currentLength,radius:contractionRadius(m.restLength,Math.max(currentLength,m.restLength*.25),m.radius),evidence:'constant-volume-art-approximation'};}
