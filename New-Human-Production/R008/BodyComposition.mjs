import {HUMAN_BODY_SCHEMA,HUMAN_SPECIES_ID,HUMAN_COMPARTMENTS,compositionTargets} from './HumanBodySpecies.mjs';
import {sub,add,mul,dot,length,projection,segmentPoint,quantile} from './AnatomyMath.mjs';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const bell=(spec,t)=>.10+.90*spec.muscles.reduce((n,m)=>n+m.share*Math.exp(-(((t-m.peak)/m.width)**2)),0);
const central=new Set(['abdomen','thorax','neck','head']);
const role=(r,s)=>s?r+'_'+s:r;
export function validateCompositionCalibration(a,c){
 if(!a?.canDeform)throw Error('人体骨架缺失或歧义，先完成语义校准');
 if(c?.species!==HUMAN_SPECIES_ID||c.schema!=='human/composition-calibration@1')throw Error('缺少成人体型校准档案');
 if(c.sourceId!==a.sourceId)throw Error('人物校准来源不匹配');
 if(!Number.isFinite(c.referenceAge)||c.referenceAge<18||c.referenceAge>65)throw Error('无效基准年龄');
 if(!['candidate','reviewed'].includes(c.status))throw Error('校准状态不允许生成');
 for(const [id,r]of Object.entries(c.regions||{})){if(!HUMAN_COMPARTMENTS.some(s=>s.id===id))throw Error('未知组织区域 '+id);for(const [k,v]of Object.entries(r)){if(!['coreFraction','satFraction'].includes(k)||!Number.isFinite(v)||v<=0||v>=.95)throw Error('无效区域校准 '+id);}}
 for(const s of HUMAN_COMPARTMENTS){const r={...s,...c.regions?.[s.id]};if(r.coreFraction+r.satFraction>=.98)throw Error('校准未保留正值肌肉空间 '+s.id);}
 for(const f of [...c.protectedFeatures||[],...c.reliefProtectedFeatures||[]])if(f.centre?.length!==3||f.radii?.length!==3||!f.centre.every(Number.isFinite)||!f.radii.every(v=>Number.isFinite(v)&&v>0))throw Error('无效保护特征');
 return c;
}
export function createCompositionProfile(anatomy,calibration){
 validateCompositionCalibration(anatomy,calibration);const {roles,joints,frame}=anatomy,areas=[];
 const point=r=>Number.isInteger(roles[r])?joints[roles[r]].position:null;
 const pelvis=point('pelvis'),chest=point('chest'),neck=point('neck')||add(chest,mul(sub(point('head'),chest),.50));
 const fallback={spineMiddle:add(pelvis,mul(sub(chest,pelvis),.65)),neck};
 for(const spec of HUMAN_COMPARTMENTS)for(const side of central.has(spec.id)?['']:['l','r']){
  const start=point(role(spec.start,side))||fallback[spec.start];let end=point(role(spec.end,side))||fallback[spec.end];
  if(spec.end==='$top')end=add(frame.origin,mul(frame.up,frame.top));
  if(spec.end==='$handEnd')end=point('middle_1_'+side)||add(start,mul(sub(start,point('lowerarm_'+side)),.24));
  if(spec.end==='$footEnd')end=point('ball_'+side)||add(start,mul(frame.front,frame.height*.065));
  if(!start||!end||length(sub(end,start))<frame.height*.004)throw Error('组织锚点需要校准 '+spec.id+' '+side);
  const observed=anatomy.segments[roles[role(spec.start,side)]],override=calibration.regions?.[spec.id]||{};
  areas.push({id:spec.id+(side?'_'+side:''),spec:{...spec,...override},start:[...start],end:[...end],length:length(sub(end,start)),radius:observed?.surfaceRadius||frame.height*(central.has(spec.id)?.065:spec.id==='hand'||spec.id==='foot'?.018:.035),
   sourceRole:role(spec.start,side),side,sections:[],evidence:'surface-fitted-authored-compartments',internalBoundary:'NotObserved'});
 }
 return {schema:HUMAN_BODY_SCHEMA,species:HUMAN_SPECIES_ID,sourceId:anatomy.sourceId,status:calibration.status,frame,referenceAge:calibration.referenceAge,areas,calibration,unknown:['actual-muscle-boundaries','actual-sat-thickness','visceral-fat','hidden-unclothed-surface'],persistedVertexBytes:0};
}

// Skin weights disambiguate which articulated region owns the point. They do
// not supply fat thickness, muscle shares, or muscle volume.
function candidateAreas(profile,anatomy,skinIndex,skinWeight,i){
 const ownership=new Map();let sum=0;for(let k=0;k<8;k++){const w=skinWeight[i*8+k],id=skinIndex[i*8+k];if(!Number.isFinite(w)||w<0||!Number.isInteger(id)||id<0||id>=anatomy.joints.length)throw Error('无效表面绑定权重');sum+=w;if(w<=0)continue;const r=anatomy.roleByIndex[id];if(r)ownership.set(r,(ownership.get(r)||0)+w);}if(Math.abs(sum-1)>.02)throw Error('表面权重未归一化');
 const compatible=a=>{const base=a.spec.id;if(base==='abdomen')return ['pelvis','spineLower','spineMiddle'].reduce((s,r)=>s+(ownership.get(r)||0),0);if(base==='thorax')return ['chest','spineMiddle','clavicle_l','clavicle_r'].reduce((s,r)=>s+(ownership.get(r)||0),0);if(base==='neck')return ownership.get('neck')||0;if(base==='head')return ownership.get('head')||0;if(base==='hand')return [...ownership].reduce((s,[r,w])=>s+((/^(hand|thumb|index|middle|ring|pinky)_/.test(r)&&r.endsWith('_'+a.side))?w:0),0);if(base==='foot')return (ownership.get('foot_'+a.side)||0)+(ownership.get('ball_'+a.side)||0);return ownership.get(a.sourceRole)||0;};
 return profile.areas.map((a,id)=>({a,id,ownership:compatible(a)})).filter(c=>c.ownership>0);
}
function pointContext(p,profile,anatomy,ids,weights,i){
 const candidates=candidateAreas(profile,anatomy,ids,weights,i);if(!candidates.length)throw Error('表面绑定没有可识别人体组织角色，请先校准');
 for(const c of candidates){c.t=projection(p,c.a.start,c.a.end);c.anchor=segmentPoint(p,c.a.start,c.a.end);c.r=length(sub(p,c.anchor));const distance=c.r/Math.max(c.a.radius,profile.frame.height*.005);c.score=c.ownership/(.5+distance*distance);}
 candidates.sort((a,b)=>b.score-a.score);const a=candidates[0],b=candidates[1]||a,w=a===b?0:b.score/(a.score+b.score),total=candidates.reduce((n,c)=>n+c.score,0);
 // All overlapping anatomical supports contribute continuously. Selecting
 // only the nearest two anchors produces visible cuts at three-way joints.
 const mix=fn=>candidates.reduce((n,c)=>n+fn(c)*c.score,0)/total,anchor=[0,1,2].map(k=>mix(c=>c.anchor[k])),r=length(sub(p,anchor));
 const core=r*mix(c=>c.a.spec.coreFraction),sat=Math.min(r-core,r*mix(c=>c.a.spec.satFraction));
 const h=dot(sub(p,profile.frame.origin),profile.frame.up),sole=smooth(profile.frame.floor+profile.frame.height*.0003,profile.frame.floor+profile.frame.height*.015,h);
 let gate=1;for(const f of profile.calibration.protectedFeatures||[]){const d=Math.hypot(...p.map((v,k)=>(v-f.centre[k])/f.radii[k]));gate*=smooth(.75,1.25,d);}if(a.a.spec.id==='foot'||b.a.spec.id==='foot')gate*=sole;
 return {anchor,core,sat,bell:mix(c=>bell(c.a.spec,c.t)),gate,first:a.id,second:b.id,blend:w,candidates:[a,b],radius:r};
}

export function createCompositionFields({positions,skinIndex,skinWeight,anatomy,profile,seamGroups=[],materialIds,protectedMaterials=[],samplingExcludedMaterials=[]}){
 if(!positions?.length||positions.length%3||skinIndex?.length!==positions.length/3*8||skinWeight?.length!==skinIndex.length)throw Error('组织拟合需要完整表面与八绑定影响');
 if(profile.areas.length>32)throw Error('组织区域超过当前渲染容量');
 const N=positions.length/3,region=new Float32Array(N*4),anchor=new Float32Array(N*4),exclude=new Set(protectedMaterials),sampleExclude=new Set(samplingExcludedMaterials),sections=profile.areas.map(()=>Array.from({length:12},()=>[])),coverage={};
 for(let i=0;i<N;i++){
  const p=Array.from(positions.subarray(i*3,i*3+3));if(!p.every(Number.isFinite))throw Error('无效表面位置');const c=pointContext(p,profile,anatomy,skinIndex,skinWeight,i),gate=exclude.has(materialIds?.[i])?0:c.gate;
  region.set([c.core,c.sat,c.bell,gate],i*4);anchor.set([...c.anchor,c.first*32+c.second+c.blend*.999],i*4);
  coverage[profile.areas[c.first].id]=(coverage[profile.areas[c.first].id]||0)+1;
  if(gate>.5&&!sampleExclude.has(materialIds?.[i])){const a=c.candidates[0];sections[a.id][Math.min(11,Math.floor(a.t*12))].push(a.r);}
 }
 // A shared generated seam is one physical point, including its controls.
 for(const g of seamGroups){const a=[0,0,0,0],r=[0,0,0,0];for(const i of g)for(let k=0;k<4;k++){a[k]+=anchor[i*4+k]/g.length;r[k]+=region[i*4+k]/g.length;}a[3]=anchor[g[0]*4+3];if(g.some(i=>exclude.has(materialIds?.[i])))r[3]=0;for(const i of g){anchor.set(a,i*4);region.set(r,i*4);}}
 for(let i=0;i<profile.areas.length;i++){
  const a=profile.areas[i],fallback=a.radius;a.sections=sections[i].map((values,k)=>{const radius=values.length>=6?quantile(values,.55):fallback,core=radius*a.spec.coreFraction,sat=radius*a.spec.satFraction,inner=Math.max(core,radius-sat),muscleArea=Math.PI*(inner*inner-core*core),fatArea=Math.PI*(radius*radius-inner*inner),ds=a.length/12;return {t:(k+.5)/12,radius,samples:values.length,bell:bell(a.spec,(k+.5)/12),muscleVolume:muscleArea*ds,fatVolume:fatArea*ds};});
  a.baselineMuscleVolume=a.sections.reduce((s,v)=>s+v.muscleVolume,0);a.baselineFatVolume=a.sections.reduce((s,v)=>s+v.fatVolume,0);
  a.muscles=a.spec.muscles.map(m=>({id:m.id+(a.side?'_'+a.side:''),baselineVolume:a.baselineMuscleVolume*m.share,share:m.share,evidence:'authored-volume-partition-not-individually-observed'}));
 }
 return {region,anchor,coverage,bytes:region.byteLength+anchor.byteLength,context:i=>({region:Array.from(region.subarray(i*4,i*4+4)),anchor:Array.from(anchor.subarray(i*4,i*4+4))})};
}

export function solveMuscleLambda(sections,ratio){
 if(!(ratio>0&&Number.isFinite(ratio))||!sections.length)throw Error('无效组织体积目标');
 const base=sections.reduce((s,v)=>s+v.muscleVolume,0);if(!(base>0))throw Error('肌肉基准体积缺失');
 let lo=-20,hi=20;for(let k=0;k<55;k++){const x=(lo+hi)/2,v=sections.reduce((s,r)=>s+r.muscleVolume*Math.exp(x*r.bell),0)/base;if(v<ratio)lo=x;else hi=x;}return (lo+hi)/2;
}
export function solveComposition(profile,recipe){
 const controls=new Float32Array(32*4),areas=profile.areas.map((a,i)=>{
  const target=compositionTargets(recipe,a.spec,profile.referenceAge),lambda=solveMuscleLambda(a.sections,target.muscleRatio),actual=a.sections.reduce((s,r)=>s+r.muscleVolume*Math.exp(lambda*r.bell),0),targetV=a.baselineMuscleVolume*target.muscleRatio;
  const mean=a.sections.reduce((s,r)=>s+r.radius,0)/a.sections.length,inner=mean*(1-a.spec.satFraction),core=mean*a.spec.coreFraction,newInner=Math.sqrt(core*core+(inner*inner-core*core)*target.muscleRatio),outer=Math.sqrt(newInner*newInner+(mean*mean-inner*inner)*target.fatRatio),thickness=outer-newInner;
  const referenceTransmission=Math.exp(-a.spec.satFraction*mean/(profile.frame.height*.018)),transmission=Math.exp(-thickness/(profile.frame.height*.018)),definition=Math.min(1,Math.min(1,Math.pow(target.muscleRatio,.65))*transmission/referenceTransmission),relief=clamp(1-definition);
  controls.set([lambda,target.fatRatio,relief,0],i*4);
  return {id:a.id,label:a.spec.label,...target,muscleLambda:lambda,baselineMuscleVolume:a.baselineMuscleVolume,targetMuscleVolume:targetV,estimatedMuscleVolume:actual,volumeRelativeError:Math.abs(actual-targetV)/targetV,baselineFatVolume:a.baselineFatVolume,targetFatVolume:a.baselineFatVolume*target.fatRatio,estimatedThickness:thickness,muscleTransmission:definition,reliefBlend:relief,muscles:a.muscles.map(m=>({...m,targetVolume:m.baselineVolume*target.muscleRatio}))};
 });
 return {controls,areas,species:profile.species,sourceId:profile.sourceId,calibrationStatus:profile.status,volumeEvidence:'estimated-local-cross-section-proxy-not-measured-anatomy',visceralFat:'NotObserved',maximumVolumeRelativeError:Math.max(...areas.map(a=>a.volumeRelativeError)),persistedVertexBytes:0};
}

export function decodeCompositionControl(code,controls){const first=Math.floor(code/32),second=Math.floor(code-first*32),w=(code-first*32-second)/.999;return [0,1,2,3].map(k=>controls[first*4+k]*(1-w)+controls[second*4+k]*w);}
export function compactComposition(profile,solution){return {schema:profile.schema,species:profile.species,sourceId:profile.sourceId,status:profile.status,referenceAge:profile.referenceAge,calibration:profile.calibration,unknown:profile.unknown,persistedVertexBytes:0,areas:profile.areas.map(a=>({id:a.id,start:a.start,end:a.end,length:a.length,sections:a.sections,muscles:a.muscles,evidence:a.evidence})),solution:solution?{areas:solution.areas,maximumVolumeRelativeError:solution.maximumVolumeRelativeError,volumeEvidence:solution.volumeEvidence}:null};}
// Same radial annulus equation on CPU and GPU: bone/support is fixed, muscle
// area and SAT area have separate positive budgets. No world-y body bands.
export function compositionPoint(point,context,controls){
 const {region:r,anchor:a}=context,c=decodeCompositionControl(a[3],controls),v=point.map((p,k)=>p-a[k]),radius=Math.hypot(...v);
 if(radius<=r[0]||radius<1e-9||r[3]<=0)return [...point];
 const inner=Math.max(r[0],radius-r[1]),muscle=Math.max(0,inner*inner-r[0]*r[0]),fat=Math.max(0,radius*radius-inner*inner),next=Math.sqrt(r[0]*r[0]+muscle*Math.exp(c[0]*r[2])+fat*c[1]),gain=(next-radius)/radius*r[3];
 return point.map((p,k)=>p+v[k]*gain);
}
export const COMPOSITION_GLSL=`
uniform vec4 bodyCompartments[32];
vec4 compositionControl(float code){int a=int(floor(code/32.));float f=code-float(a)*32.;int b=int(floor(f));return mix(bodyCompartments[a],bodyCompartments[b],fract(f)/.999);}
vec3 bodyPointGPU(vec3 p,vec4 r,vec4 a){vec3 v=p-a.xyz;float radius=length(v);if(radius<=r.x||radius<1e-9||r.w<=0.)return p;vec4 c=compositionControl(a.w);float inner=max(r.x,radius-r.y),muscle=max(0.,inner*inner-r.x*r.x),fat=max(0.,radius*radius-inner*inner);float next=sqrt(r.x*r.x+muscle*exp(c.x*r.z)+fat*c.y);return p+v*((next-radius)/radius*r.w);}
`;
