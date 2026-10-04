import {HUMAN_INVERSE_METHOD,inverseMethodDescriptor} from './HumanInverseMethod.mjs';
import {reverseFitSkeleton} from './SurfaceSkeletonFit.mjs';
import {fitMotorAnatomy,pathMetrics,bellyProfile} from './MotorAnatomy.mjs';
import {HUMAN_COMPARTMENTS,compositionTargets} from './HumanBodySpecies.mjs';
import {add,sub,mul,dot,length,quantile} from './AnatomyMath.mjs';

const clone=value=>JSON.parse(JSON.stringify(value));
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const M=HUMAN_INVERSE_METHOD.muscle;
function normalizeComposition(input={}){
 const limits=HUMAN_INVERSE_METHOD.composition,value={schema:'human/reference-composition@1',fatness:0,muscle:0,age:limits.referenceAge,...input};
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['schema','fatness','muscle','age'].includes(k))||value.schema!=='human/reference-composition@1')throw Error('Invalid shared inverse composition recipe');
 for(const key of ['fatness','muscle','age']){const minimum=key==='age'?limits.minimumAge:limits.minimumRelativeAmount,maximum=key==='age'?limits.maximumAge:limits.maximumRelativeAmount;if(!Number.isFinite(value[key])||value[key]<minimum||value[key]>maximum)throw Error('Invalid shared inverse composition amount');}
 return value;
}
const next={pelvis:'spineLower',spineLower:'spineMiddle',spineMiddle:'chest',chest:'neck',neck:'head'};
const groupForMuscle=id=>{
 const base=id.replace(/_[lr]$/,''),side=id.at(-1);
 if(['rectus_abdominis','oblique','erectors'].includes(base))return 'abdomen';
 if(['pectoralis','latissimus','trapezius'].includes(base))return 'thorax';
 if(/^deltoid_|^(biceps|triceps)$/.test(base))return 'upperarm_'+side;
 if(/^forearm_/.test(base))return 'lowerarm_'+side;
 if(['rectus_femoris','vastus_lateral','vastus_medial','hamstrings','adductors'].includes(base))return 'thigh_'+side;
 if(['gastrocnemius','soleus','tibialis'].includes(base))return 'calf_'+side;
 return null; // Hidden gluteal/iliopsoas anatomy must not be inferred from shorts.
};
const segmentsForRole=role=>{
 if(['pelvis','spineLower'].includes(role))return ['abdomen'];
 if(['spineMiddle','chest'].includes(role))return ['thorax','abdomen'];
 if(role==='neck')return ['neck','thorax'];
 if(role==='head')return ['head'];
 if(/^clavicle_/.test(role))return ['upperarm_'+role.at(-1),'thorax'];
 return [role];
};

function candidateProfile(profile,fit){
 const joints=profile.joints.map((j,i)=>({...j,position:[...fit.joints[i].position]}));
 const segments=profile.segments.map(s=>{
  const role=s.role,startId=profile.roles[role],side=role?.at(-1),base=role?.replace(/_[lr]$/,''),endRole=next[role]||({upperarm:'lowerarm',lowerarm:'hand',hand:'middle_1',thigh:'calf',calf:'foot',foot:'ball'})[base]+'_'+side,endId=profile.roles[endRole];
  const start=Number.isInteger(startId)?joints[startId].position:s.start,end=Number.isInteger(endId)?joints[endId].position:s.end;
  return {...s,start:[...start],end:[...end],length:length(sub(end,start)),evidence:'surface-constrained-candidate-with-explicit-prior'};
 });
 return {...profile,joints,segments,observations:{...profile.observations,shoulderDistance:length(sub(joints[profile.roles.upperarm_l].position,joints[profile.roles.upperarm_r].position)),hipDistance:length(sub(joints[profile.roles.thigh_l].position,joints[profile.roles.thigh_r].position))}};
}

function tissueBudgets(fit){
 return fit.segments.map(s=>{
  const spec=HUMAN_COMPARTMENTS.find(r=>r.id===s.id.replace(/_[lr]$/,'')),rows=s.sections.filter(r=>r.status==='fitted'),observedVolume=rows.reduce((v,r)=>v+Math.PI*r.axes[0]*r.axes[1]*s.priorLength/s.totalSections,0);
  // Independent annular budgets. The allocation is a shared species prior;
  // only the outer section is observed. These are not measured muscle/fat kg.
  const supportFraction=spec.coreFraction**2,innerFraction=(1-spec.satFraction)**2,muscleFraction=innerFraction-supportFraction,fatFraction=1-innerFraction;
  return {id:s.id,specId:spec.id,coverage:s.coverage,span:s.sectionSpan,status:s.status,observedSectionVolume:observedVolume,supportProxyVolume:observedVolume*supportFraction,muscleProxyVolume:observedVolume*muscleFraction,fatProxyVolume:observedVolume*fatFraction,allocationEvidence:'shared-species-prior-not-tissue-measurement',envelopeEvidence:'observed-skin-section-fit',supportIsBoneVolume:false,available:s.status==='surface-fitted'};
 });
}

function nearbySection(point,role,fit){
 let nearest=null;
 for(const id of segmentsForRole(role)){
  const segment=fit.segments.find(s=>s.id===id);if(!segment)continue;
  const t=dot(sub(point,segment.priorStart),segment.axis)/segment.priorLength;
  for(const row of segment.sections){if(row.status!=='fitted'||Math.abs(row.t-t)>M.localSectionDistance)continue;
   const distance=length(sub(point,row.centre));if(!nearest||distance<nearest.distance)nearest={segment,row,distance};
  }
 }
 return nearest;
}

function constrainPoint(point,section,radius,station){
 if(!section)return {point:[...point],constraint:'prior-only-no-local-surface',movement:0};
 const {segment:s,row:r}=section,q=sub(point,r.centre),along=dot(q,s.axis),u=dot(q,s.u),v=dot(q,s.v),ca=Math.cos(r.angle),sa=Math.sin(r.angle),x=u*ca+v*sa,y=-u*sa+v*ca;
 const margin=radius*bellyProfile(station),rx=Math.max(r.axes[0]*.10,r.axes[0]*M.envelopeInteriorFraction-margin),ry=Math.max(r.axes[1]*.10,r.axes[1]*M.envelopeInteriorFraction-margin),norm=Math.hypot(x/rx,y/ry),scale=1/Math.max(1,norm),px=x*scale,py=y*scale,nu=px*ca-py*sa,nv=px*sa+py*ca;
 const target=add(add(add(r.centre,mul(s.axis,along)),mul(s.u,nu)),mul(s.v,nv));
 return {point:target,constraint:'surface-envelope-constrained-estimated-attachment',movement:length(sub(target,point)),section:{segment:s.id,t:r.t,axes:[...r.axes],centre:[...r.centre]}};
}

function fitSurfaceMuscles(profile,fit,budgets){
 const model=fitMotorAnatomy(profile),priorVolumes=new Map(model.muscles.map(m=>[m.id,Math.PI*m.radius*m.radius*pathMetrics(m.attachments.map(a=>a.bindPoint)).weighted])),totals=new Map();
 for(const m of model.muscles){const group=groupForMuscle(m.id);if(group)totals.set(group,(totals.get(group)||0)+priorVolumes.get(m.id));}
 const muscles=model.muscles.map(m=>{
  const group=groupForMuscle(m.id),budget=budgets.find(b=>b.id===group),priorVolume=priorVolumes.get(m.id),share=group?priorVolume/totals.get(group):null,sections=m.attachments.map(a=>nearbySection(a.bindPoint,a.role,fit)),metrics=pathMetrics(m.attachments.map(a=>a.bindPoint));
  const volume=budget?.available?budget.muscleProxyVolume*M.representedVolumeFraction*share:priorVolume;
  const localRadii=sections.filter(Boolean).map(s=>Math.min(...s.row.axes)),radiusLimit=localRadii.length?quantile(localRadii,.5)*M.maximumRadiusFraction:Infinity,radius=Math.min(Math.sqrt(volume/(Math.PI*metrics.weighted)),radiusLimit),attachments=m.attachments.map((a,i)=>{
   const constrained=constrainPoint(a.bindPoint,sections[i],radius,i/(m.attachments.length-1));
   return {...a,bindPoint:constrained.point,priorBindPoint:[...a.bindPoint],constraint:constrained.constraint,constraintMovement:constrained.movement,surfaceSection:constrained.section||null,evidence:'estimated-attachment'};
  }),weighted=pathMetrics(attachments.map(a=>a.bindPoint)).weighted;
  // Keep the same allotted volume after constraining the path; an explicit cap
  // can leave part of the budget unrepresented rather than protruding through skin.
  const adjustedRadius=Math.min(Math.sqrt(volume/(Math.PI*weighted)),radiusLimit),representedVolume=Math.PI*adjustedRadius*adjustedRadius*weighted;
  return {...m,radius:adjustedRadius,attachments,region:group,sourcePriorVolume:priorVolume,baselineVolumeProxy:representedVolume,targetVolumeProxy:volume,unrepresentedVolumeProxy:Math.max(0,volume-representedVolume),budgetShare:share,surfaceConstrainedAttachments:attachments.filter(a=>a.surfaceSection).length,volumeEvidence:budget?.available?'observed-envelope-with-shared-tissue-allocation-prior':'prior-only-insufficient-region-envelope',evidence:'shared-method-estimated-muscle-route',allocationEvidence:'not-uniquely-identifiable-muscle-fat-split'};
 });
 return {...model,muscles,methodId:HUMAN_INVERSE_METHOD.id,authority:'reference-surface-and-candidate-joints; shared tissue/path priors',unknown:[...model.unknown,'true-muscle-fat-allocation','deep-and-hidden-muscle-geometry']};
}

export function createHumanInverseSystem(profile,input,adapter){
 // Per-source tuning of solver thresholds, offsets or tissue ratios is forbidden.
 if(!adapter||adapter.sourceId!==profile.sourceId||Object.keys(adapter).some(k=>!['sourceId','materialRegions','evidence','protectedRegions','interpretation'].includes(k)))throw Error('Inverse adapter may only identify source semantics, not override the shared method');
 const fit=reverseFitSkeleton(profile,{positions:input.positions,materialIds:input.materialIds,materialRegions:adapter.materialRegions,maxSamples:HUMAN_INVERSE_METHOD.surface.maxSamples,sections:HUMAN_INVERSE_METHOD.surface.sections}),candidate=candidateProfile(profile,fit),budgets=tissueBudgets(fit),muscles=fitSurfaceMuscles(candidate,fit,budgets);
 // Snapshot the reference identity once; composition does not refit its bones.
 const reference=freeze({joints:clone(fit.joints),budgets:clone(budgets),muscles:clone(muscles)});let recipe=normalizeComposition(),state;
 function setComposition(patch={}){
  const value=normalizeComposition({...recipe,...patch}),regions=reference.budgets.map(b=>{const target=compositionTargets(value,HUMAN_COMPARTMENTS.find(s=>s.id===b.specId),HUMAN_INVERSE_METHOD.composition.referenceAge);return {...b,muscleRatio:target.muscleRatio,fatRatio:target.fatRatio,muscleProxyVolume:b.muscleProxyVolume*target.muscleRatio,fatProxyVolume:b.fatProxyVolume*target.fatRatio};});
  const activeMuscles=reference.muscles.muscles.map(m=>{const region=regions.find(b=>b.id===(m.region||'thigh_'+m.side)),ratio=region?.muscleRatio??1;return {...m,radius:m.radius*Math.sqrt(ratio),baselineVolumeProxy:m.baselineVolumeProxy*ratio};});
  recipe=value;state={recipe:{...recipe},joints:reference.joints,regions,muscles:activeMuscles,evidence:'conditional-shared-composition-prior; no skeletal refit'};return state;
 }
 setComposition();
 return {schema:'human/unified-inverse-system@1',sourceId:profile.sourceId,method:inverseMethodDescriptor(),fit,profile:candidate,reference,muscles,
  setComposition,get state(){return state;},
  report(){return {methodId:HUMAN_INVERSE_METHOD.id,stages:[...HUMAN_INVERSE_METHOD.stages],sourceId:profile.sourceId,skeleton:fit.summary,muscles:muscles.muscles.length,surfaceSizedMuscles:muscles.muscles.filter(m=>m.volumeEvidence.startsWith('observed')).length,surfaceConstrainedAttachments:muscles.muscles.reduce((n,m)=>n+m.surfaceConstrainedAttachments,0),unobservedRegions:budgets.filter(b=>!b.available).map(b=>b.id),outerSurface:'original-reference-generator-unmodified',boneIdentityFrozen:true,storedVertexBytes:0,compositionAllocation:'shared-prior-not-measured',unknown:[...fit.unknown,'true-muscle-fat-allocation']};},
  export(){return {schema:this.schema,sourceId:this.sourceId,method:this.method,frame:clone(profile.frame),joints:clone(reference.joints),surfaceSections:fit.segments.map(s=>({id:s.id,start:s.start,end:s.end,status:s.status,sections:s.sections.filter(r=>r.status==='fitted').map(r=>({t:r.t,centre:r.centre,axes:r.axes,angle:r.angle,rms:r.rms,coverage:r.coverage}))})),tissueBudgets:clone(reference.budgets),motorMuscles:clone(reference.muscles.muscles),recipe:{...recipe},report:this.report(),storedVertexBytes:0};}
 };
}
