import {compositionPoint} from './BodyComposition.mjs';
import {compositionTargets,HUMAN_COMPARTMENTS} from './HumanBodySpecies.mjs';
export const BODY_DEFAULT=Object.freeze({schema:'human-r008/body@1',height:1.8,fatness:0,muscle:0,age:32});
export const BODY_CONTROLS=Object.freeze([
 {key:'height',label:'身高（米）',min:1.60,max:2.05,step:.01},
 {key:'fatness',label:'脂肪量 · 0 为基准',min:-1,max:1,step:.01},
 {key:'muscle',label:'同龄肌肉水平 · 0 为基准',min:-1,max:1,step:.01},
 {key:'age',label:'年龄外观（成人）',min:18,max:75,step:1}
]);
export const BODY_PRESETS=Object.freeze({reference:{label:'原人物',recipe:{}},young:{label:'年轻成人',recipe:{age:20}},lean:{label:'清瘦',recipe:{height:1.8,fatness:-.65,muscle:-.35,age:25}},athletic:{label:'健壮',recipe:{height:1.88,fatness:-.25,muscle:.85,age:32}},fuller:{label:'丰满',recipe:{height:1.75,fatness:.80,muscle:-.15,age:45}},older:{label:'年长',recipe:{height:1.8,fatness:.15,muscle:-.30,age:68}}});
export function normalizeBody(input={}){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(BODY_DEFAULT,k)))throw Error('体型配方无效');const p={...BODY_DEFAULT,...input};if(p.schema!==BODY_DEFAULT.schema)throw Error('体型配方版本无效');for(const c of BODY_CONTROLS)if(!Number.isFinite(p[c.key])||p[c.key]<c.min||p[c.key]>c.max)throw Error(c.label+'超出范围');return p;}
export const bodyScale=p=>p.height/1.8;
export function bodyAge(p){const t=Math.max(0,Math.min(1,(p.age-32)/43));return t*t*(3-2*t);}
export function bodyYouth(p){const t=Math.max(0,Math.min(1,(32-p.age)/14));return t*t*(3-2*t);}
// UI-only summary. Production obtains per-region volume controls from a profile.
export function bodyCoefficients(p){const c=compositionTargets(p,HUMAN_COMPARTMENTS.find(s=>s.id==='upperarm'));return [p.fatness,Math.log(c.muscleRatio),bodyAge(p),bodyYouth(p)];}
export function bodyContext(){throw Error('禁止固定坐标猜测组织，请提供已校准 composition.context(index)');}
export function bodyPoint(point,p,context){if(!context?.controls)throw Error('体型查询需要已校准组织字段与控制量');return compositionPoint(point,context,context.controls);}
export function bodyNormalMatrix(point,p,h=.00035,context){
 const J=new Array(9);for(let k=0;k<3;k++){const a=[...point],b=[...point];a[k]+=h;b[k]-=h;const u=bodyPoint(a,p,context),v=bodyPoint(b,p,context);for(let j=0;j<3;j++)J[j*3+k]=(u[j]-v[j])/(2*h);}
 const [a,b,c,d,e,f,g,i,j]=J,C=[e*j-f*i,f*g-d*j,d*i-e*g,c*i-b*j,a*j-c*g,b*g-a*i,b*f-c*e,c*d-a*f,a*e-b*d],det=a*C[0]+b*C[1]+c*C[2];return {cofactor:C,determinant:det};
}
export function bodyMetrics(p){const scale=bodyScale(p);return {scale,height:p.height,radius:.25*scale,armClearance:0,ageAmount:bodyAge(p),effectiveMuscle:bodyCoefficients(p)[1],variationVersion:5,skeletalScaleFromComposition:1};}
