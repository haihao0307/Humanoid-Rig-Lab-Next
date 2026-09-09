/* R7 shared bone envelope and anatomical tissue layers.
 * Bony bounds are sampled from this character's generated rigid geometry.
 * Skin, posterior muscle sheets and supports all query the same field.
 * The compact grids are construction caches, never rebuilt on ordinary motion. */
const AXIAL_ENVELOPE_SPEC=Object.freeze({revision:7,rows:97,sides:64,yMin:-.15,yMax:bodyAxialY(.65),
 skinM:.002,fatMaleM:.005,fatFemaleM:.008,boneMarginM:.002,
 // y, half width, anterior radius, posterior radius, centre X, centre Z.
 cavity:[[-.15,.035,.032,.032,0,-.005],[-.08,.080,.059,.049,0,-.009],
  [0,.131,.085,.080,0,-.008],[.08,.136,.087,.081,0,-.008],
  [.14,.119,.078,.061,0,-.002],[.20,.113,.078,.055,0,.002],
  [.26,.124,.092,.071,0,.004],[.33,.140,.106,.080,0,.008],
  [.40,.147,.106,.080,0,.010],[.47,.134,.096,.067,0,.012],
  [.51,.099,.068,.052,0,.014],[.55,.050,.037,.035,0,.020],
  [.60,.033,.029,.029,0,.026],[.65,.041,.038,.033,0,.031]]});
const axialBand=(x,a,b)=>{const u=clamp((x-a)/(b-a),0,1);return Math.sin(Math.PI*u)**4;};
const axialCavityProfile=tissueProfile(AXIAL_ENVELOPE_SPEC.cavity);
function axialCavity(y){
 const t=bodyAuthorY(y),r=axialCavityProfile(t);
 if(BODY_SEX==='female'){
  r[0]*=1+.075*axialBand(bodyAuthorY(y),-.17,.25)-.055*axialBand(bodyAuthorY(y),.18,.60)-.055*axialBand(bodyAuthorY(y),.50,.69);
  r[1]*=1-.035*axialBand(bodyAuthorY(y),.18,.60);
 }
 return r;
}
function axialPolarRadius(rx,rz,theta){return 1/Math.sqrt((Math.sin(theta)/rx)**2+(Math.cos(theta)/rz)**2);}
function axialSplineWeights(t){return [(1-t)**3/6,(3*t**3-6*t*t+4)/6,(-3*t**3+3*t*t+3*t+1)/6,t**3/6];}
function axialGridValue(grid,y,theta){
 const {rows,sides,yMin,yMax}=AXIAL_ENVELOPE_SPEC;
 const fy=clamp((y-yMin)/(yMax-yMin)*(rows-1),0,rows-1),j=Math.floor(fy),wy=axialSplineWeights(fy-j);
 const f=((theta/(Math.PI*2)%1)+1)%1*sides,k=Math.floor(f),wx=axialSplineWeights(f-k);
 let result=0;
 for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++)result+=grid[clamp(j+dy-1,0,rows-1)*sides+(k+dx-1+sides)%sides]*wy[dy]*wx[dx];
 return result;
}
function buildAxialEnvelope(tissue,core){
 const spec=AXIAL_ENVELOPE_SPEC,{rows,sides,yMin,yMax}=spec,step=(yMax-yMin)/(rows-1);
 const bounds=new Float32Array(rows*sides),samples=[];
 for(let j=0;j<rows;j++){
  const y=yMin+j*step,r=axialCavity(y);
  for(let k=0;k<sides;k++){const a=k/sides*Math.PI*2;bounds[j*sides+k]=axialPolarRadius(r[0],Math.cos(a)>=0?r[1]:r[2],a);}
 }
 for(const part of core.parts){
  if(!/rigid_base_(sternum|[CTL]\d+|sacrum|coccyx|.*_rib_\d+|.*_scapula|.*_os_coxa)$/.test(part.id))continue;
  const f=core.bind.get(part.joint.id),g=part.g;
  for(let i=0;i<g.p.length;i+=3){
   const p=point(f,Array.from(g.p.subarray(i,i+3))),y=p[1]-core.hipY;
   if(y<yMin||y>yMax)continue;
   const r=axialCavity(y),dz=p[2]-r[4],a=(Math.atan2(p[0],dz)+Math.PI*2)%(Math.PI*2),rho=Math.hypot(p[0],dz)+spec.boneMarginM;
   const j=Math.round((y-yMin)/step),k=Math.round(a/(Math.PI*2)*sides)%sides;
   bounds[j*sides+k]=Math.max(bounds[j*sides+k],rho);samples.push([y,a,rho]);
  }
 }
 // A local majorant of occupied cells fills spaces between ribs and removes
 // point-sized spikes. Positive cubic B-spline sampling yields C2 continuity.
 const expanded=new Float32Array(bounds.length);
 for(let j=0;j<rows;j++)for(let k=0;k<sides;k++){
  let value=bounds[j*sides+k];
  for(let dj=-2;dj<=2;dj++)for(let dk=-2;dk<=2;dk++){
   const q=bounds[clamp(j+dj,0,rows-1)*sides+(k+dk+sides)%sides]-.0025*(Math.abs(dj)+Math.abs(dk));
   value=Math.max(value,q);
  }expanded[j*sides+k]=value;
 }
 // Raise coefficients only where the smooth field would undercut actual bone
 // samples. The positive kernel has a bounded support; no hard point clipping.
 let maxDeficit=0;
 for(let pass=0;pass<5;pass++){
  maxDeficit=0;const raise=new Float32Array(expanded.length);
  for(const [y,a,rho]of samples){
   const deficit=rho-axialGridValue(expanded,y,a);if(deficit<=.00005)continue;maxDeficit=Math.max(maxDeficit,deficit);
   const j=Math.floor((y-yMin)/step),k=Math.floor(a/(Math.PI*2)*sides);
   for(let dj=-1;dj<=2;dj++)for(let dk=-1;dk<=2;dk++){
    const id=clamp(j+dj,0,rows-1)*sides+(k+dk+sides)%sides;raise[id]=Math.max(raise[id],deficit+.0001);
   }
  }
  for(let i=0;i<expanded.length;i++)expanded[i]+=raise[i];
  if(maxDeficit<=.00005)break;
 }
 let remaining=0;for(const [y,a,rho]of samples)remaining=Math.max(remaining,rho-axialGridValue(expanded,y,a));
 return {grid:expanded,levels:Object.fromEntries(tissue.human.axialPlan.map(r=>[r.id,r.y])),report:{schema:'jarvis/axial_envelope@7',source:'generated axial bone vertices plus cavity scaffold',
  sampledBoneVertices:samples.length,remainingSampleDeficitM:Math.max(0,remaining),
  cacheBytes:expanded.byteLength,continuity:'C2 radial B-spline grid; C1 cavity centre profile; smooth tissue masks',
  fullTriangleCollision:false,anatomicalValidation:false}};
}
function axialLayerThickness(tissue,y,theta){
 const r=axialCavity(y),x=Math.abs(axialPolarRadius(r[0],Math.cos(theta)>=0?r[1]:r[2],theta)*Math.sin(theta));
 const back=tissueSmooth(-.05,.65,-Math.cos(theta)),side=Math.abs(Math.sin(theta));
 const base=AXIAL_ENVELOPE_SPEC.skinM+(BODY_SEX==='female'?AXIAL_ENVELOPE_SPEC.fatFemaleM:AXIAL_ENVELOPE_SPEC.fatMaleM);
 const p=tissue.human.torsoShape||TORSO_SHAPE_DEFAULT,neck=tissue.human.headNeckShape||HEAD_NECK_SHAPE_DEFAULT;
 // Muscle footprints use skeletal levels and regional cross-section width.
 const {T1:t1,T12:t12,C2:c2,L5:l5}=tissue.structure.axial.levels;
 const authorY=bodyAuthorY(y),chestBand=axialBand(authorY,.16,.56),neckBand=axialBand(authorY,.515,.665);
 const backScale=1+2*(p.backDepth-1)*chestBand;
 const erectorWidth=.020,erectorCentre=.027;
 const erector=.014*axialBand(y,l5-.080,t1+.055)*axialBand(x,erectorCentre-erectorWidth,erectorCentre+erectorWidth)*back*backScale;
 const trapWidth=y>t1?.015+.135*clamp((c2-y)/(c2-t1),0,1):.015+.135*clamp((y-t12)/(t1-t12),0,1);
 const scapularScale=1+.35*(p.scapularRelief-1)*axialBand(y,t1-.17,t1+.04);
 const trapezius=.009*axialBand(y,t12-.018,c2+.015)*Math.max(0,1-(x/trapWidth)**2)**2*back*backScale*scapularScale;
 const latissimus=.012*axialBand(y,.045,t1-.030)*axialBand(x/Math.max(r[0],.04),.20,1.10)*back*backScale;
 const gluteShape=lowerBodyShape(tissue);
 const gluteusMaximus=(BODY_SEX==='female'?.033:.029)*gluteShape.gluteVolume*axialBand(authorY,-.185,.170)*axialBand(x/Math.max(ADULT_RIG.pelvisHalfBreadthM,.1),.035,1.12)*back;
 const gluteusMedius=.015*gluteShape.gluteVolume*axialBand(authorY,-.075,.220)*side**4;
 // Editors alter the soft field. They cannot resize the rigid foundation or
 // put the skin beneath the muscle field used by the visible muscle sheets.
 const widthChange=r[0]*((p.chestWidth-1)*chestBand+(p.waistWidth-1)*axialBand(authorY,.06,.33))*side*side;
 const neckChange=neckBand*(.030*(neck.neckWidth-1)*side*side+(.030*(neck.backDepth-1)+.0022*(neck.napeFullness-1))*back);
 const skinFat=Math.max(.003,base+widthChange+neckChange);
 // The same ordered thickness budget places visible sheets below their skin.
 // In the overlap zone, gluteus medius lies below gluteus maximus.
 const offsets={erector:0,gluteus_medius:erector,gluteus_maximus:erector+gluteusMedius,
  latissimus:erector+gluteusMedius+gluteusMaximus,
  trapezius:erector+gluteusMedius+gluteusMaximus+latissimus};
 const muscle=erector+gluteusMedius+gluteusMaximus+latissimus+trapezius;
 return {skinFat,erector,trapezius,latissimus,gluteus_maximus:gluteusMaximus,gluteus_medius:gluteusMedius,offsets,total:skinFat+muscle};
}
function axialSurfacePoint(tissue,y,theta,layer='skin'){
 const r=axialCavity(y),hard=axialGridValue(tissue.structure.axial.grid,y,theta);
 const depth=layer==='hard'?0:axialLayerThickness(tissue,y,theta).total;
 return [Math.sin(theta)*(hard+depth),tissue.structure.hipY+y,r[4]+Math.cos(theta)*(hard+depth)];
}
function axialSurfaceMask(tissue,p,weights){
 const y=p[1]-tissue.structure.hipY,r=axialCavity(y),a=Math.atan2(p[0],p[2]-r[4]);
 let arm=0,leg=0;
 for(const[id,w]of weights){if(/_(upperArm|forearm|radiusRotation|hand)/.test(id))arm+=w;else if(/_(femur|tibia|foot)/.test(id))leg+=w;}
 return tissueSmooth(-.170,-.075,y)*(1-tissueSmooth(bodyAxialY(.610),bodyAxialY(.650),y))
  *tissueSmooth(0,.65,-Math.cos(a))*(1-tissueSmooth(.08,.70,arm))
  *(1-tissueSmooth(.45,.98,leg));
}
function rebuildAxialSurface(tissue,cage){
 let count=0,max=0;const edits=new Map();
 for(const v of cage.v){
  const mask=axialSurfaceMask(tissue,v.p,v.w);if(mask<=0)continue;
  const y=v.p[1]-tissue.structure.hipY,r=axialCavity(y),theta=Math.atan2(v.p[0],v.p[2]-r[4]);
  const target=axialSurfacePoint(tissue,y,theta),next=mix(v.p,target,mask);
  max=Math.max(max,dist(next,v.p));edits.set(v,{before:[...v.p],target:next});v.p=next;count++;
 }
 // A continuous global line search keeps newly mapped triangles oriented.
 // This is a relative orientation guard, not a self-intersection test.
 const affected=cage.f.filter(f=>f.some(id=>edits.has(cage.v[id]))),triangles=[];
 for(const f of affected)for(let k=1;k<f.length-1;k++){
  const vs=[f[0],f[k],f[k+1]].map(id=>cage.v[id]),before=vs.map(v=>edits.get(v)?.before||v.p);
  const n=cross(sub(before[1],before[0]),sub(before[2],before[0]));if(len(n)>1e-12)triangles.push({vs,n});
 }
 const flipped=()=>{let n=0;for(const t of triangles){const p=t.vs.map(v=>v.p),q=cross(sub(p[1],p[0]),sub(p[2],p[0]));if(dot(q,t.n)<=0)n++;}return n;};
 let rejected=flipped(),scale=1;const initialRejected=rejected;
 for(let pass=0;rejected&&pass<12;pass++){
  scale*=.75;for(const[v,e]of edits)v.p=mix(e.before,e.target,scale);rejected=flipped();
 }
 if(rejected){scale=0;for(const[v,e]of edits)v.p=e.before;rejected=flipped();}
 tissue.backSurfaceReport={schema:'jarvis/axial_surface@7',sex:BODY_SEX,changedVertices:count,maxDisplacementM:max*scale,targetDisplacementM:max,
  acceptedMapFraction:scale,initialOrientationReversals:initialRejected,remainingOrientationReversals:rejected,
  needsReview:scale<1,envelopeReconstructionComplete:scale===1,
  topologyChanged:false,source:'shared bone envelope + named anatomical tissue thickness',
  surfaceClearance:'sampled rest-bone envelope; transition zones and posed contact require review',visualAcceptance:false};
}
function makeAxialSupportSections(tissue,core){
 const records=tissue.human.axialPlan;
 const owners=[{id:'hips',lo:-.13,hi:bodyAxialY(.10)},...records.filter(r=>r.y<bodyAxialY(.63)).map((r,k,a)=>({id:r.id,
  lo:k?(a[k-1].y+r.y)/2:bodyAxialY(.10),hi:k<a.length-1?(r.y+a[k+1].y)/2:bodyAxialY(.65)}))];
 for(const owner of owners){
  const f=core.bind.get(owner.id),p=[],indices=[],rings=4,sides=48;
  for(let j=0;j<=rings;j++)for(let k=0;k<sides;k++){
   const q=axialSurfacePoint(tissue,owner.lo+(owner.hi-owner.lo)*j/rings,k/sides*Math.PI*2,'hard');
   p.push(...rotate(inv(f.q),sub(q,f.p)));
  }
  for(let j=0;j<rings;j++)for(let k=0;k<sides;k++){const a=j*sides+k,b=j*sides+(k+1)%sides;indices.push(a,b,b+sides,a,b+sides,a+sides);}
  for(const [j,rev]of [[0,true],[rings,false]]){const pole=p.length/3,c=[0,0,0];for(let k=0;k<sides;k++)for(let n=0;n<3;n++)c[n]+=p[(j*sides+k)*3+n]/sides;p.push(...c);
   for(let k=0;k<sides;k++){const a=j*sides+k,b=j*sides+(k+1)%sides;indices.push(...(rev?[pole,b,a]:[pole,a,b]));}}
  core.supports.push({id:'rigid_axial_envelope_'+owner.id,joint:tissue.human.byId.get(owner.id),g:mesh(p,indices),
   materialKind:0,color:[.39,.53,.57],visible:false});
 }
}

const AXIAL_KNOWLEDGE_CONTRACT=Object.freeze({schema:'jarvis/axial_generation_contract@7',units:'metre',
 scope:'cervical spine, thoracic back, lumbar-sacral interface and gluteal coverage',
 constructionOrder:['oriented individual vertebrae and shared disc endplates','thorax/scapula/pelvis bone envelope','named posterior muscle thickness','skin and bounded two-joint attachment'],
 sources:[
  {url:'https://humananatomy.host.dartmouth.edu/BHA/public_html/part_7/chapter_39.html',supports:'spinal curves, vertebrae, discs and surface landmarks'},
  {url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-3-axial-muscles-of-the-head-neck-and-back',supports:'posterior neck and erector spinae relationships'},
  {url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs',supports:'trapezius and latissimus attachment relationships'},
  {url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs',supports:'gluteus maximus and gluteus medius coverage'}],
 authoredParameters:'All cavity dimensions, clearances, muscle thicknesses, blend zones and motion travel limits are character design values, not clinical thresholds.',
 limits:['no scan-derived anatomy','no full triangle self-collision or force-based tissue solver','bind-construction checks do not establish posed clearance or visual acceptance'],
 documentation:'docs/AXIAL_SYSTEM_R7.md'});
function axialInspectionSummary(human){
 const t=human.tissue,skeleton=human.axialReport,envelope=t.structure.axial.report,surface=t.backSurfaceReport,muscles=t.axialMuscleReport,warnings=[];
 if(skeleton.vertebrae!==24||skeleton.discs!==23)warnings.push('椎骨或椎间盘数量异常');
 if(skeleton.negativeInterfaceCount||!Number.isFinite(skeleton.minEndplateGapM))warnings.push('存在无效或非正的静止椎间隙');
 if(!envelope.sampledBoneVertices||!Number.isFinite(envelope.remainingSampleDeficitM)||envelope.remainingSampleDeficitM>.0001)warnings.push('骨性包络尚未覆盖全部采样点');
 if(!surface.changedVertices||!surface.envelopeReconstructionComplete||surface.remainingOrientationReversals)warnings.push('表皮重建未完整通过方向保护检查');
 if(muscles.sheetCount!==10||muscles.degenerateSheets.length)warnings.push('后侧肌肉薄片构建需要检查');
 return {schema:'jarvis/axial_construction_summary@7',sex:BODY_SEX,warnings,
  scope:'rest construction and sampled bounds only; not posed collision or anatomical acceptance',
  anatomicalValidation:false,visualAcceptance:false};
}
