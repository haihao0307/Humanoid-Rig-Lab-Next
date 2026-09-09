/* Original regional shape fields in the generated bind frame. Parameters are
 * authored examples, not population averages or measured individual anatomy. */
function proceduralComposition(tissue){
 if(tissue.composition)return tissue.composition;
 const h=tissue.human,base=makeStrengthProfile(),ratios={};
 for(const [id,g]of Object.entries(h.strength.profile.groups))ratios[id]=g.volumeCm3/base.groups[id].volumeCm3;
 return tissue.composition={ratios,archetype:BODY_ARCHETYPES[h.bodySex],source:'analytic regional radius and thickness fields'};
}
function proceduralMuscleGroup(id){
 const side=id.startsWith('left_')?'left':id.startsWith('right_')?'right':null;
 if(/rectus_abdominis|oblique|erector/.test(id))return 'center_trunk';
 const group=/glute|adductor|biceps_femoris|semimembranosus|semitendinosus/.test(id)?'hip':/vastus|rectus_femoris/.test(id)?'knee':/gastrocnemius|soleus|tibialis|fibularis/.test(id)?'ankle':/biceps|brachialis/.test(id)?'elbowFlexors':/triceps/.test(id)?'elbowExtensors':/forearm/.test(id)?'grip':'shoulder';
 return side?side+'_'+group:'center_trunk';
}
function applyProceduralMuscleComposition(tissue){
 const c=proceduralComposition(tissue);
 for(const m of tissue.muscles){m.compositionGroup=proceduralMuscleGroup(m.id);m.radius*=Math.sqrt(clamp(c.ratios[m.compositionGroup]??1,.3,2.6));m.bindReach=m.restLength*.6+m.radius+.05;}
}
function applyProceduralBodyShape(tissue,g){
 const h=tissue.human,m=h.characterPreset.appearance.morphs,c=proceduralComposition(tissue),base=defaultCharacterMorphs(h.bodySex),hy=tissue.bind.get('hips').p[1];
 for(let v=0;v<g.p.length/3;v++){
  const k=v*3,p=Array.from(g.p.subarray(k,k+3)),out=[...p],y=bodyAuthorY(p[1]-hy),bell=(a,b)=>Math.exp(-(((y-a)/b)**2));
  let arm=0,leg=0,hand=0,foot=0;
  const memberships=[];
  for(let n=0;n<4;n++){const id=h.joints[g.skinJoints[v*4+n]].id,w=g.skinWeights[v*4+n];memberships.push([id,w]);if(/_(upperArm|forearm|radiusRotation)$/.test(id))arm+=w;if(/_(femur|tibia|patella)$/.test(id))leg+=w;if(/_(hand|metacarpal_|finger_)/.test(id))hand+=w;if(/_(foot|metatarsal_|toe_)/.test(id))foot+=w;}
  const trunk=Math.max(0,1-arm-leg-hand-foot),chest=bell(.40,.11),waist=bell(.20,.095),hip=bell(.01,.12),neck=bell(.62,.065),head=bell(.74,.08);
  // Shoulder and hip widths already change the rig and base torso profile.
  out[0]*=1+trunk*((m.chestWidth-1)*chest+(m.waistWidth-1)*waist+(m.neckWidth-base.neckWidth)*neck)/(Math.max(1,chest+waist+neck));
  out[0]*=1+(m.faceWidth-1)*head*trunk;
  const front=tissueSmooth(.005,.09,p[2]),back=1-front,fat=c.archetype.fat;
  out[0]+=Math.sign(p[0])*fat.hipM*m.softness*hip*trunk;
  out[2]+=(fat.abdomenM*m.softness*waist*front-fat.gluteM*m.softness*hip*back)*trunk;
  out[2]+=(m.softness-1)*.02*(hip+.6*waist)*(front-back)*trunk;
  const breast=(m.breastProjectionM-base.breastProjectionM)*Math.exp(-(((Math.abs(p[0])-.067)/.058)**2)-((y-.395)/.065)**2)*front*trunk;
  out[2]+=breast;
  for(const [id,w]of memberships){
   if(!/_(upperArm|forearm|radiusRotation|femur|tibia)$/.test(id)||w<=0)continue;
   const side=id.startsWith('left_')?'left':'right',upper=/_upperArm$/.test(id),lower=/(forearm|radiusRotation)$/.test(id),thigh=/_femur$/.test(id);
   const a=tissue.bind.get(id).p,b=tissue.bind.get(side+'_'+(upper?'forearm':lower?'hand':thigh?'tibia':'foot')).p,axis=sub(b,a),length2=dot(axis,axis);
   const t=clamp(dot(sub(p,a),axis)/Math.max(length2,1e-8),0,1),r=sub(p,mix(a,b,t)),radius=len(r),belly=Math.sin(Math.PI*t)**2;
   // The shared lower-body fields already apply the leg volume ratios.
   const ratio=upper?(c.ratios[side+'_elbowFlexors']+c.ratios[side+'_elbowExtensors'])/2:lower?c.ratios[side+'_grip']:1;
   const delta=(radius*(Math.sqrt(.35+.65*clamp(ratio,.3,2.6))-1)+.015*(m.limbVolume-1)+(thigh?fat.thighM*m.softness:0))*w*belly;
   if(radius>1e-8)for(let n=0;n<3;n++)out[n]+=r[n]/radius*delta;
  }
  const volume=(Math.sqrt(.35+.65*clamp(c.ratios.center_trunk,.3,2.6))-1)*.035*(chest+waist)*trunk;
  out[0]+=Math.sign(p[0])*volume;out[2]+=Math.sign(p[2]-.025)*volume;
  g.p.set(out,k);
 }
 g.n=wholeBodyNormals(g.p,g.i);
}
function applyProceduralFaceDetails(tissue){
 const bind=tissue.bind.get('head'),joint=tissue.jointIds.get('head');
 for(const item of tissue.details){
  if(item.joint?.id!=='head')continue;
  const g=transform(item.g,bind.p,bind.q),count=g.p.length/3;
  g.skinJoints=new Float32Array(count*4);g.skinWeights=new Float32Array(count*4);
  for(let v=0;v<count;v++){g.skinJoints[v*4]=joint;g.skinWeights[v*4]=1;}
  applyProceduralBodyShape(tissue,g);
  item.g=transform(g,rotate(inv(bind.q),mul(bind.p,-1)),inv(bind.q));
 }
}
