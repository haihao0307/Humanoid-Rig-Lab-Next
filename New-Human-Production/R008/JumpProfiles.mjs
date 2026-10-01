import {JUMP_MOTIONS} from './JumpMotionData.mjs';
export const JUMP_STYLES=Object.freeze([
 {id:'cmu-forward',label:'A · 蹬伸前跳',description:'CMU 16_05 + 全身协调：双脚蓄力蹬伸、摆臂、空中屈体与落地缓冲。'},
 {id:'cmu-athletic',label:'B · 屈体越障',description:'CMU 16_07 + 全身协调：更深蓄力、完整蹬伸摆臂、更明确的收膝屈体。'},
 {id:'cmu-running',label:'C · 协调跑跳',description:'CMU 75_01 + 全身协调：保留前后腿差异，增加髋膝踝蹬伸和空中收腿。'}
]);
export const DEFAULT_JUMP_STYLE='cmu-athletic';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smooth=v=>{v=clamp(v);return v*v*v*(10+v*(-15+6*v));};
export function sampleMotionCurve(knots,t){let i=0;while(i<knots.length-6&&t>knots[i+3])i+=3;const a=knots[i],b=knots[i+3],u=clamp((t-a)/(b-a)),u2=u*u,u3=u2*u;return (2*u3-3*u2+1)*knots[i+1]+(u3-2*u2+u)*knots[i+2]*(b-a)+(-2*u3+3*u2)*knots[i+4]+(u3-u2)*knots[i+5]*(b-a);}
export function timeToContact(c,movement,clearance){return c.vy<0?(Math.sqrt(c.vy*c.vy+2*movement.gravity*Math.max(0,clearance))+c.vy)/movement.gravity:Infinity;}
// Project-authored coordination, not an unmodified motion-capture replay or
// physical muscle-force simulation. Stage timings are C2; hip extension leads
// knee extension, then ankle/toe roll. Source curves retain bounded asymmetry.
const COORDINATION={
 'cmu-forward':{compression:.20,fold:.98,knee:1.58,torso:.50,source:.18},
 'cmu-athletic':{compression:.23,fold:1.35,knee:1.90,torso:.62,source:.16},
 'cmu-running':{compression:.18,fold:1.16,knee:1.70,torso:.54,source:.30}
};
function stage(knots,t){let i=0;while(i<knots.length-2&&t>knots[i+1][0])i++;const [a,x]=knots[i],[b,y]=knots[i+1];return x+(y-x)*smooth((t-a)/(b-a));}
function coordinateJump(id,source,t){
 const k=COORDINATION[id]||COORDINATION[DEFAULT_JUMP_STYLE],load=stage([[0,0],[.53,1],[.98,0],[4,0]],t),land=stage([[0,0],[3,0],[3.30,1],[4,0]],t),fold=stage([[0,0],[1.30,0],[1.94,1],[2.75,0],[4,0]],t),hipLoad=stage([[0,0],[.51,1],[.92,0],[4,0]],t),kneeLoad=stage([[0,0],[.57,1],[1.04,0],[4,0]],t);
 const stretch=stage([[0,0],[.57,0],[1.03,1],[1.26,1],[1.80,0],[4,0]],t),toeOff=stage([[0,0],[.75,0],[1.08,1],[1.42,0],[4,0]],t),arm=stage([[0,0],[.49,-.72],[.98,1.18],[1.27,1.24],[1.96,.52],[2.84,.62],[3.32,.34],[4,0]],t),torso=k.torso*load+.43*fold+.55*land-.055*stretch;
 const blend=stage([[0,0],[.4,0],[1.35,1],[2.66,1],[3.1,.3],[4,0]],t)*k.source,pose={...source,torso,drop:k.compression*load+k.compression*.93*land,pelvisPitch:.12*load+.10*fold+.09*land,neckPitch:-torso*.38,clavicleLift:.085*Math.max(0,arm),toeOff};
 for(const side of ['l','r']){
  const lead=side==='l'?1:-1,asymmetry=id==='cmu-running'?lead*.15*fold:0,hip=.78*hipLoad+k.fold*fold+.62*land+.16*stage([[0,0],[2.65,0],[3,.9],[3.25,0],[4,0]],t),knee=1.30*kneeLoad+k.knee*fold+1.30*land+.17*stage([[0,0],[2.68,0],[3,1],[3.30,0],[4,0]],t);
  pose['hip_'+side]=hip+blend*(source['hip_'+side]-(source.hip_l+source.hip_r)/2)+asymmetry;
  pose['knee_'+side]=knee+blend*(source['knee_'+side]-(source.knee_l+source.knee_r)/2)+asymmetry*.55;
  pose['arm_'+side]=arm+blend*(source['arm_'+side]-(source.arm_l+source.arm_r)/2);
  pose['elbow_'+side]=.18+.23*load+.20*Math.max(0,arm)+.46*fold+.30*land+blend*(source['elbow_'+side]-.8);
  pose['spread_'+side]=.035*(load+fold+land)+blend*source['spread_'+side];
  pose['foot_'+side]=.34*toeOff-.13*fold+.07*land;
 }
 return {...pose,coordination:{load,land,fold,stretch,toeOff}};
}
export function sampleJumpPose(id,c,movement,clearance){
 const motion=JUMP_MOTIONS[id]||JUMP_MOTIONS[DEFAULT_JUMP_STYLE],v0=Math.sqrt(2*movement.gravity*movement.jumpHeight),air=clamp((v0-c.vy)/(2*v0));let t=4;
 if(c.phase==='anticipation')t=clamp(c.phaseTime/movement.anticipation);
 else if(!c.grounded){let progress=air;if(c.vy<0){const prepare=smooth(1-timeToContact(c,movement,clearance)/.20);progress+=(1-progress)*prepare;}t=1+2*progress;}
 else if(c.phase==='landing')t=3+smooth(c.phaseTime/movement.landingDuration);
 const source=Object.fromEntries(Object.entries(motion.channels).map(([key,knots])=>[key,sampleMotionCurve(knots,t)])),pose=coordinateJump(id,source,t);
 if(c.phase==='landing')pose.drop*=clamp(c.landImpact/6,.45,1.05);
 return {...pose,t};
}
