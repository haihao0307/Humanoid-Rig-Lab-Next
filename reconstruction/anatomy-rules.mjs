// Authored binding/topology constraints, in the reflected anatomical bind frame.
// These ratios are engineering parameters, not measured soft-tissue limits.
export const ANATOMY_RULE_VERSION='r2/anatomical-constraints@1';
export const ANATOMY_BANDS=Object.freeze({shoulderLength:.70,hipLength:.28,jointLength:.12,
 // Cranial shell blends into the cervical column; these are authored shape
 // ratios, not measured joint limits or an anatomical calibration.
 neckCoreRadius:.30,cranialShellSlope:1.40,
 mandible:Object.freeze({frontStart:.45,frontSpan:.35,lowerStart:.80,lowerSpan:.15,halfWidth:.65,lateralSpan:.25})});

export function createAnatomyRules(position,radius,tipPosition){
 const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
 const distance=(a,b)=>Math.hypot(...sub(a,b));
 const projection=(p,a,b)=>dot(sub(p,a),sub(b,a))/Math.max(distance(a,b)**2,1e-12);
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const cache=new Map(),pos=id=>{if(!cache.has(id)){const p=position(id);if(!p?.every(Number.isFinite))throw Error('Missing anatomy landmark '+id);cache.set(id,p);}return cache.get(id);};
 const tipCache=new Map(),tip=id=>{if(!tipCache.has(id)){const p=tipPosition?.(id);if(p?.length!==3||!p.every(Number.isFinite))throw Error('Missing anatomy terminal tip '+id);tipCache.set(id,p);}return tipCache.get(id);};
 const sides=['left','right'],centre=pos('hips')[0];
 const bits=[1,2,4,8,16,32,64,128,256,512,1024,2048];
 const lengths=new Map(sides.map(s=>[s,{arm:distance(pos(s+'_upperArm'),pos(s+'_forearm')),leg:distance(pos(s+'_femur'),pos(s+'_tibia'))}]));
 function cranialWeight(p){
  const head=pos('head'),base=pos('C7'),axisLength=distance(head,base);
  // A skull/jaw shell is rigid even below the atlas height. A spherical
  // allowed-joint gate used to flip this shell from head to C2/C3 in one
  // vertex, producing torn wedges when the head tilted. Use one continuous
  // field on BOTH sides of the head/neck source-domain interface instead.
  const t=Math.max(0,Math.min(1,(p[1]-base[1])/(head[1]-base[1])));
  const x=base[0]+(head[0]-base[0])*t,z=base[2]+(head[2]-base[2])*t;
  const radial=Math.hypot(p[0]-x,p[2]-z);
  const shellHeight=p[1]+ANATOMY_BANDS.cranialShellSlope*Math.max(0,radial-axisLength*ANATOMY_BANDS.neckCoreRadius);
  const upperNeck=smooth((p[1]-pos('C5')[1])/(pos('C4')[1]-pos('C5')[1]));
  const cervical=upperNeck*smooth((shellHeight-pos('C2')[1])/(head[1]-pos('C2')[1]));
  // The source chin extends below C4 and into torso mask 4. The cervical
  // height gate must not make that anterior jaw skin bend with C4/C5. Add a
  // continuous, forward-only mandibular envelope in the same landmark scale;
  // keep the posterior neck and its existing cervical field unchanged.
  const m=ANATOMY_BANDS.mandible,L=axisLength;
  const jaw=smooth((p[2]-head[2]-m.frontStart*L)/(m.frontSpan*L))
   *smooth((p[1]-head[1]+m.lowerStart*L)/(m.lowerSpan*L))
   *(1-smooth((Math.abs(p[0]-head[0])-m.halfWidth*L)/(m.lateralSpan*L)));
  return 1-(1-cervical)*(1-jaw);
 }
 function gate(p,side,kind){
  const arm=kind==='shoulder',id=side+(arm?'_upperArm':'_femur');
  const width=lengths.get(side)[arm?'arm':'leg']*ANATOMY_BANDS[arm?'shoulderLength':'hipLength'];
  const core=radius(side,arm?'humerus':'femur')*1.5;
  return 1-smooth((distance(p,pos(id))-core)/Math.max(width-core,1e-6));
 }
 function effectiveMask(mask,p){
  // The locked proximal-thigh source uses 72 for a patch that also reaches
  // the right pelvis. Its left-leg bit must not introduce a contralateral leg.
  if((mask&8)&&(mask&64)&&p[0]>=centre)mask&=~64;
  if((mask&8)&&(mask&128)&&p[0]<centre)mask&=~128;
  if(mask===72&&p[1]<pos('left_femur')[1]&&gate(p,'left','hip')===0)mask=64;
  return mask;
 }
 function adjacent(a,b,p){
  if(a===b)return true;
  const pair=Math.min(a,b)+':'+Math.max(a,b);
  if(pair==='2:4'||pair==='4:8')return true;
  // Atlas neck/pelvic trim boundaries are real connections. Their coarse
  // region extents must not be cut by an uncalibrated skinning-band radius.
  if(pair==='1:2'||pair==='1:4')return true;
  for(const [s,arm,leg,hand,foot]of [['left',16,64,256,1024],['right',32,128,512,2048]]){
   if((a===arm&&(b===2||b===4)||b===arm&&(a===2||a===4)))return gate(p,s,'shoulder')>0;
   if(a===8&&b===leg||b===8&&a===leg)return true;
   if(a===arm&&b===hand||b===arm&&a===hand)return true;
   if(a===leg&&b===foot||b===leg&&a===foot)return true;
  }
  return false;
 }
 function canShare(maskA,maskB,p,q=p){
  if(maskA===maskB)return true; // Preserve connectivity within an authored domain.
  const a=effectiveMask(maskA,p),b=effectiveMask(maskB,q);
  for(const x of bits)if(a&x)for(const y of bits)if(b&y){
   if(!adjacent(x,y,p)||!adjacent(x,y,q))return false;
  }
  return true;
 }
 function resolve(p,sourceMask){
  const mask=effectiveMask(sourceMask,p),allowed=new Set(),caps=new Map();
  const add=(id,cap=1)=>{if(cap<=0)return;pos(id);allowed.add(id);caps.set(id,Math.max(caps.get(id)||0,cap));};
  const axial=()=>{
   const rows=['hips',...Array.from({length:5},(_,i)=>'L'+(5-i)),...Array.from({length:12},(_,i)=>'T'+(12-i)),...Array.from({length:7},(_,i)=>'C'+(7-i)),'head'];
   let i=0;while(i<rows.length-2&&p[1]>pos(rows[i+1])[1])i++;
   if(p[1]>=pos('head')[1])add('head');else{add(rows[i]);add(rows[i+1]);}
  };
  const digits=(s,kind)=>{
   const stem=kind==='finger'?'metacarpal':'metatarsal',base=s+(kind==='finger'?'_hand':'_midfoot');
   const rays=Array.from({length:5},(_,i)=>{
    const ids=[s+'_'+stem+'_'+(i+1),...Array.from({length:i===0?2:3},(_,j)=>s+'_'+kind+'_'+(i+1)+'_'+(j+1))];
    // Include the terminal phalanx through its source tip. Omitting this segment
    // assigns both great-toe tips to the adjacent second toe in the source rig.
    let score=Infinity;for(let k=1;k<ids.length;k++){
     const a=pos(ids[k]),b=k+1<ids.length?pos(ids[k+1]):tip(ids[k]),t=Math.max(0,Math.min(1,projection(p,a,b)));
     score=Math.min(score,distance(p,a.map((v,j)=>v+(b[j]-v)*t)));
    }
    return {ids,score};
   }).sort((a,b)=>a.score-b.score);
   const ray=rays[0],knuckle=pos(ray.ids[1]),root=pos(ray.ids[0]);
   const distal=projection(p,root,knuckle)>1+ANATOMY_BANDS.jointLength;
   if(!distal){add(base);for(const r of rays){add(r.ids[0]);add(r.ids[1]);}}
   else{
    let k=1;while(k<ray.ids.length-1&&projection(p,pos(ray.ids[k]),pos(ray.ids[k+1]))>1)k++;
    add(ray.ids[k]);
    if(k>1&&distance(p,pos(ray.ids[k]))<distance(pos(ray.ids[k-1]),pos(ray.ids[k]))*.3)add(ray.ids[k-1]);
    if(k<ray.ids.length-1&&projection(p,pos(ray.ids[k]),pos(ray.ids[k+1]))> .7)add(ray.ids[k+1]);
   }
  };
  const limb=(s,kind)=>{
   const arm=kind==='arm',names=arm?['upperArm','forearm','hand']:['femur','tibia','foot'];
   const a=pos(s+'_'+names[0]),b=pos(s+'_'+names[1]),c=pos(s+'_'+names[2]);
   const t=projection(p,a,b),u=projection(p,b,c),band=ANATOMY_BANDS.jointLength;
   if(t<1+band&&u<band)add(s+'_'+names[0]);
   if(t>1-band&&u<1+band){add(s+'_'+names[1]);if(arm)add(s+'_radiusRotation');}
   if(u>1-band){add(s+'_'+names[2]);if(!arm)add(s+'_midfoot');digits(s,arm?'finger':'toe');}
   if(arm){const g=gate(p,s,'shoulder');add(s+'_AC',g);if(g>0)axial();}
   else add('hips',gate(p,s,'hip'));
  };
  if(mask&1)axial();
  if(mask&(2|4)){
   axial();
   for(const s of sides){const g=gate(p,s,'shoulder');add(s+'_SC',g);add(s+'_AC',g);add(s+'_upperArm',g);}
  }
  if(mask&8){add('hips');const s=p[0]<centre?'left':'right';add(s+'_femur',gate(p,s,'hip'));}
  for(const [s,arm,leg,hand,foot]of [['left',16,64,256,1024],['right',32,128,512,2048]]){
   if(mask&(arm|hand))limb(s,'arm');
   if(mask&(leg|foot))limb(s,'leg');
  }
  if(mask&(1|2|4)){
   const cranial=cranialWeight(p);
   if(cranial===1){allowed.clear();caps.clear();add('head');}
   else if(cranial>0)add('head');
  }
  if(!allowed.size)throw Error('Empty anatomical ownership '+sourceMask);
  return {mask,allowed,caps,mode:allowed.size===1?'segment-stable':'joint-transition'};
 }
 return {version:ANATOMY_RULE_VERSION,effectiveMask,canShare,resolve,gate,cranialWeight};
}
