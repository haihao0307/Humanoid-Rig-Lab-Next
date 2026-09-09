/* R9 lower-body design. Relationships: docs/BODY_PLAN_R9.md.
 * Metres; authoring targets are not population means or clinical limits.
 * Per-character soft parameters do not mutate the shared rigid foundation. */
const LOWER_BODY_SHAPE_DEFAULT=Object.freeze({calfVolume:1,thighVolume:1,gluteVolume:1,softness:1});
const LOWER_BODY_SHAPE_LIMITS=Object.freeze({calfVolume:[.9,1.18],thighVolume:[.9,1.14],gluteVolume:[.85,1.18],softness:[.8,1.3]});
function validateLowerBodyShape(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('下肢参数必须为对象');
 const out={...LOWER_BODY_SHAPE_DEFAULT};
 for(const[k,v]of Object.entries(input)){const b=Object.hasOwn(LOWER_BODY_SHAPE_LIMITS,k)?LOWER_BODY_SHAPE_LIMITS[k]:null;if(!b||!Number.isFinite(v)||v<b[0]||v>b[1])throw Error('下肢参数超出设计范围：'+k);out[k]=v;}
 return out;
}
const lowerBodyShape=t=>t.human.lowerBodyShape||LOWER_BODY_SHAPE_DEFAULT;
const LOWER_BODY_PLAN=Object.freeze({revision:9,statureM:1.75,
 foot:{heelZ:-.067,forefootExitZ:.103,toeZ:.193,nominalLengthM:.260,nominalBreadthM:.104,heelBreadthM:.065},
 shankCircumference:[[0,.318],[.16,.351],[.34,.370],[.48,.359],[.63,.320],[.78,.263],[.91,.225],[1,.215],[1.09,.224]],
 thighCircumference:[[0,.478],[.15,.552],[.30,.535],[.48,.485],[.68,.418],[.85,.347],[1,.312],[1.1,.318]],
 thighMuscles:[
  {id:'vastus_intermedius',start:.07,end:1.03,angle:0,width:1.55,peak:.024},
  {id:'adductor_magnus',start:-.02,end:.98,angle:-1.67,width:1.36,peak:.035},
  {id:'biceps_femoris',start:.035,end:1.02,angle:2.39,width:1.00,peak:.035},
  {id:'semimembranosus',start:.035,end:1.02,angle:-2.68,width:.88,peak:.030},
  {id:'vastus_lateralis',start:.03,end:1.01,angle:.91,width:1.05,peak:.040},
  {id:'vastus_medialis',start:.27,end:1.13,angle:-.56,width:.77,peak:.037},
  {id:'rectus_femoris',start:-.07,end:1.06,angle:0,width:.64,peak:.027},
  {id:'adductor_longus',start:-.06,end:.79,angle:-1.19,width:.70,peak:.023},
  {id:'semitendinosus',start:.015,end:1.02,angle:-2.12,width:.53,peak:.018}]
});
function lowerThighCentre(u){const v=clamp(u,0,1);return [.034*(1-v)**1.45,.012*Math.sin(Math.PI*v)];}
function lowerTargetGirth(rows,u){
 let k=0;while(k<rows.length-2&&u>rows[k+1][0])k++;
 const[a,A]=rows[k],[b,B]=rows[k+1];return A+(B-A)*tissueSmooth(a,b,u);
}
function lowerRawLayers(tissue,kind,u,angle,side){
 const shape=lowerBodyShape(tissue),specs=kind==='thigh'?LOWER_BODY_PLAN.thighMuscles:LOWER_LIMB_SPEC.muscles;
 const ratios=proceduralComposition(tissue).ratios;
 const fields={};for(const m of specs)fields[m.id]=m.peak*Math.sqrt(clamp(ratios[proceduralMuscleGroup(side+'_'+m.id)]??1,.3,2.6))*lowerBand(u,m.start,m.end)*lowerAngular(angle,m.angle,m.width);
 // Unsegmented deep compartments bridge the named bellies, so the skin does
 // not inherit finger-width grooves between separate superficial muscles.
 const wave=Math.sin(Math.PI*clamp(u,0,1)),bulk=kind==='thigh'?.012*wave**2:.014*wave**.9;
 const gluteal=kind==='thigh'?.028*shape.gluteVolume*lowerBand(u,-.16,.56)*lowerAngular(angle,Math.PI,1.38):0;
 const achilles=kind==='shank'?.010*lowerBand(u,.51,1.18)*lowerAngular(angle,Math.PI,.56):0;
 const skinFat=(kind==='thigh'?.009:BODY_SEX==='female'?.008:.007)*shape.softness;
 return {fields,bulk,gluteal,achilles,skinFat};
}
function lowerCalibratedLayers(tissue,side,kind,u,angle){
 const raw=lowerRawLayers(tissue,kind,u,angle,side),cache=tissue.lowerBodySoft?.[side]?.[kind],spec=kind==='thigh'?LOWER_LIMB_SPEC.thighGrid:LOWER_LIMB_SPEC.shankGrid;
 let scale=1;if(cache){const f=clamp((u-spec.min)/(spec.max-spec.min)*(spec.rows-1),0,spec.rows-1),k=Math.floor(f);scale=cache.scales[k]+(cache.scales[Math.min(k+1,spec.rows-1)]-cache.scales[k])*tissueSmooth(0,1,f-k);}
 const offsets={};let depth=raw.bulk*scale;
 for(const key of Object.keys(raw.fields)){offsets[key]=depth;raw.fields[key]*=scale;depth+=raw.fields[key];}
 return {...raw,offsets,bulk:raw.bulk*scale,gluteal:raw.gluteal*scale,total:depth+raw.gluteal*scale+raw.achilles+raw.skinFat};
}
function buildLowerBodySoftProfiles(tissue){
 const result={},shape=lowerBodyShape(tissue),reports=[];
 for(const side of ['left','right']){result[side]={};const d=tissue.lowerLimb.sides[side];
  for(const kind of ['thigh','shank']){
   const grid=d[kind],spec=grid.spec,rows=kind==='thigh'?LOWER_BODY_PLAN.thighCircumference:LOWER_BODY_PLAN.shankCircumference,scales=new Float32Array(spec.rows),girths=[];
   for(let j=0;j<spec.rows;j++){
    const u=spec.min+(spec.max-spec.min)*j/(spec.rows-1),samples=Array.from({length:64},(_,k)=>{
     const a=k/64*Math.PI*2,raw=lowerRawLayers(tissue,kind,u,a,side);return {a,hard:lowerGridSample(grid,u,a)+raw.achilles+raw.skinFat,soft:raw.bulk+raw.gluteal+Object.values(raw.fields).reduce((n,v)=>n+v,0)};
    });
    const perimeter=scale=>{let sum=0;for(let k=0;k<samples.length;k++){const a=samples[k],b=samples[(k+1)%samples.length],ra=a.hard+scale*a.soft,rb=b.hard+scale*b.soft;sum+=Math.hypot(Math.sin(a.a)*ra-Math.sin(b.a)*rb,Math.cos(a.a)*ra-Math.cos(b.a)*rb);}return sum;};
    const ratios=proceduralComposition(tissue).ratios,ratio=kind==='thigh'?(ratios[side+'_hip']+ratios[side+'_knee'])/2:ratios[side+'_ankle'];
    const volume=shape[kind==='thigh'?'thighVolume':'calfVolume'],target=lowerTargetGirth(rows,u)*Math.sqrt(volume*(.35+.65*clamp(ratio,.3,2.6)));
    let lo=.55,hi=3.8;for(let k=0;k<16;k++){const mid=(lo+hi)/2;if(perimeter(mid)<target)lo=mid;else hi=mid;}
    const fitMask=tissueSmooth(.07,.18,u)*(1-tissueSmooth(.80,.98,u));
    scales[j]=1+((lo+hi)/2-1)*fitMask;girths.push({u,targetM:target,estimatedM:perimeter(scales[j]),fitMask});
   }
   result[side][kind]={scales};reports.push({side,kind,rows:girths,maxTargetErrorM:Math.max(...girths.filter(r=>r.fitMask>.999).map(r=>Math.abs(r.estimatedM-r.targetM))),scaleBounds:[.55,3.8],hingeTransitions:'girth fit fades at hip/knee/ankle; joint bounds take priority'});
  }
 }
 tissue.lowerBodyVolumeReport={schema:'jarvis/lower_body_volume@9',parameters:{...shape},sections:reports,method:'bounded circumference fit of shared tissue fields in rest space',measuredFinalSkin:false,poseVolumeConservation:false};
 return result;
}
function lowerThighLayers(tissue,side,u,angle){return lowerCalibratedLayers(tissue,side,'thigh',u,angle);}
function lowerThighSkinWeights(tissue,side,u){
 const d=tissue.lowerLimb.sides[side],moving=tissueSmooth(-.12,.20,u),leg=lowerLegSkinWeights(tissue,side,(u-1)*d.thighL/d.L);
 return surfaceWeights([['hips',1-moving],...leg.map(([id,w])=>[id,w*moving])]);
}
function lowerGlutealAttachment(tissue,side,base){
 const d=tissue.lowerLimb.sides[side],q=rotate(inv(d.hip.q),sub(base,d.hip.p)),u=-q[1]/d.thighL,[cx,cz]=lowerThighCentre(u),a=Math.atan2(d.s*q[0]-cx,q[2]-cz);
 const layers=lowerThighLayers(tissue,side,u,a),hard=lowerThighSurfacePoint(tissue,side,u,a,true),normal=rotate(d.hip.q,[d.s*Math.sin(a),0,Math.cos(a)]),half=layers.gluteal*.5;
 return {centre:add(hard,mul(normal,layers.total-layers.skinFat-half)),normal,half,blend:tissueSmooth(.018,.10,-q[1])};
}
function lowerThighSurfacePoint(tissue,side,u,angle,hardOnly=false){
 const d=tissue.lowerLimb.sides[side],[cx,cz]=lowerThighCentre(u),hard=lowerGridSample(d.thigh,u,angle),r=hard+(hardOnly?0:lowerThighLayers(tissue,side,u,angle).total);
 return point(d.hip,[d.s*(cx+Math.sin(angle)*r),-u*d.thighL,cz+Math.cos(angle)*r]);
}
function lowerWholeLegPoint(tissue,side,t,angle){
 const leg=tissue.human.legs[side],a=(side==='left'?-1:1)*angle,u=(t-leg.L1)/leg.L2;
 if(u<=-.10)return lowerThighSurfacePoint(tissue,side,t/leg.L1,a);
 if(u>=.12)return lowerLegSurfacePoint(tissue,side,u,a);
 return mix(lowerThighSurfacePoint(tissue,side,t/leg.L1,a),lowerLegSurfacePoint(tissue,side,u,a),tissueSmooth(-.10,.12,u));
}
function lowerHipBridgePoint(tissue,side,start,angle,u,legStart){
 const d=tissue.lowerLimb.sides[side],a=d.s*angle,end=lowerThighSurfacePoint(tissue,side,legStart/d.thighL,a);
 const before=lowerThighSurfacePoint(tissue,side,(legStart-.012)/d.thighL,a),length=dist(start,end),handle=Math.min(.043,length*.29);
 const tangent=mul(norm(sub(before,end)),handle),posterior=Math.max(0,-Math.cos(angle));
 const first=add(start,[d.s*.003*Math.abs(Math.sin(angle)),-handle,-.005*posterior]);
 return surfaceBezier(start,first,add(end,tangent),end,u);
}
