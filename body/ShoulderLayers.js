/* Shoulder R4: articulated rigid foundation + compliant superficial tissue.
 * Metres, bind space. Anatomical relationships: docs/SHOULDER_LAYERS_R4.md.
 * The support envelope is an authored collision proxy, not segmented anatomy.
 * Only constructors write foundation geometry. Pose updates write palettes only.
 */
const SHOULDER_STRUCTURE_CACHE=new WeakMap();
function shoulderStructureKey(tissue){
 const h=tissue.human;
 return JSON.stringify({revision:7,sex:BODY_SEX,stature:ADULT_SPEC.statureM,rootHeight:h.rootHeight,
  neutralThoracicProfile:ADULT_SPEC.profiles.torso,
  joints:h.joints.map(j=>[j.id,j.parent?.id||null,j.bind,j.bindQ]),
  // Explicit bone-geometry edits invalidate the base, surface appearance does not.
  bones:h.bones.filter(b=>/^(sternum|[TCL]\d+|sacrum|coccyx)$|_(rib_\d+|clavicle|scapula|humerus|os_coxa)$/.test(b.id))
   .map(b=>{const g=h.torsoBoneBaseline?.get(b)||b.g;return [b.id,hashFloats(g.p),hashFloats(g.i),hashFloats(g.n)];})});
}
function shoulderCoreSection(core,y){
 const t=y-core.hipY,r=axialCavity(t);if(!core.axial)return [r[0],r[1],r[2],r[4]];
 return [axialGridValue(core.axial.grid,t,Math.PI/2),axialGridValue(core.axial.grid,t,0),axialGridValue(core.axial.grid,t,Math.PI),r[4]];
}
function buildShoulderStructure(tissue){
 const h=tissue.human,key=shoulderStructureKey(tissue),cached=SHOULDER_STRUCTURE_CACHE.get(h);
 if(cached?.key===key)return cached.core;
 const hipY=tissue.bind.get('hips').p[1],t1=tissue.bind.get('T1');
 const left=tissue.bind.get('left_AC'),right=tissue.bind.get('right_AC');
 const core={key,hipY,heightScale:Math.max(.1,(t1.p[1]-hipY)/.49),
  widthScale:Math.max(.1,Math.abs(right.p[0]-left.p[0])/.36),
  depthScale:Math.max(.1,Math.abs(tissue.bind.get('sternum').p[2]-t1.p[2])/.147),
  parts:[],supports:[],bind:new Map([...tissue.bind].map(([id,f])=>[id,{p:[...f.p],q:[...f.q]}]))};
 for(const b of h.bones){
  if(!/^(sternum|[TCL]\d+|sacrum|coccyx)$|_(rib_\d+|clavicle|scapula|humerus|os_coxa)$/.test(b.id))continue;
  const src=h.torsoBoneBaseline?.get(b)||b.g;
  const g={p:src.p.slice(),n:src.n.slice(),i:src.i.slice()};
  // Each part has exactly one frame: no weighted skinning or muscle attributes.
  core.parts.push({id:'rigid_base_'+b.id,joint:b.joint,g,color:[.68,.64,.49],materialKind:0,visible:false});
 }
 tissue.structure=core;
 core.axial=buildAxialEnvelope(tissue,core);
 makeAxialSupportSections(tissue,core);
 for(const side of ['left','right']){
  const radius=.022*core.widthScale,L=len(h.byId.get(side+'_forearm').bind);
  // Proximal humerus capsule is a conservative support proxy around the shaft.
  const g=ellipsoid([0,-L*.22,0],[radius,L*.31,radius],24,16);
  core.supports.push({id:'rigid_'+side+'_arm_support',joint:h.byId.get(side+'_upperArm'),g,color:[.39,.53,.57],materialKind:0,visible:false});
 }
 core.report=Object.freeze({schema:'jarvis/axial_shoulder_structure@7',envelope:core.axial.report,sex:BODY_SEX,parts:core.parts.length,
  supportVolumes:core.supports.length,localShapeInvariant:true,weightedBaseSkinning:false,
  rebuildOn:['skeleton bind data','bone geometry','stature'],poseRebuild:false,
  softShapeRebuild:false,proxy:'bone-sampled smooth envelope, articulated by vertebral level, with proximal humerus supports',
  anatomy:'authored approximation; not a patient-specific segmented skeleton'});
 SHOULDER_STRUCTURE_CACHE.set(h,{key,core});return core;
}
/* Continuous axial material attachment. Reuses the existing 2 vec4 channels:
 * data.y < 0 denotes a pair: (-jointB-1, -weightB), with fixed axial travel.
 * This avoids a new per-vertex channel and per-vertebra zero-strength seams. */
function axialLayerAttachment(tissue,p,weights){
 const core=tissue.structure,y=p[1]-core.hipY;
 if(y<-.17||y>bodyAxialY(.65))return null;
 const r=axialCavity(y),theta=Math.atan2(p[0],p[2]-r[4]);
 const mask=axialSurfaceMask(tissue,p,weights);if(mask<=0)return null;
 const anchor=axialSurfacePoint(tissue,y,theta,'hard'),thickness=dist(p,anchor);
 const rho=Math.hypot(p[0],p[2]-r[4]),hard=axialGridValue(core.axial.grid,y,theta),outside=rho>hard;
 const clearance=outside?thickness:-thickness;
 const pair=surfaceSpineWeights(tissue,p[1]).filter(([,w])=>w>0);
 const a=pair[0],b=pair[1]||[a[0],0];
 return {owner:a[0],secondOwner:b[0],secondWeight:b[1],anchor,thickness,outside,
  mask:mask*tissueSmooth(.001,.008,clearance),requestedMask:mask,clearance,
  normalTravel:.009,tangentTravel:.024,region:'continuous_axial'};
}
function fitAxialMuscleSheets(tissue){
 let changed=0,windingCorrections=0;const degenerateSheets=[];
 for(const m of tissue.muscles){
  if(!m.sheet)continue;
  const name=m.id.replace(/^(left|right)_/,''),key=name==='erector_spinae'?'erector':name;
  if(!['erector','trapezius','latissimus','gluteus_maximus','gluteus_medius'].includes(key))continue;
  const g=m.sheet.g,chart=m.sheetChart;
  for(const node of chart.nodes){
   const y=node.base[1]-tissue.structure.hipY;
   if(y<-.15||y>bodyAxialY(.65))continue;
   const r=axialCavity(y),theta=Math.atan2(node.base[0],node.base[2]-r[4]);
   const layers=axialLayerThickness(tissue,y,theta),hard=axialSurfacePoint(tissue,y,theta,'hard');
   const normal=norm([Math.sin(theta),0,Math.cos(theta)]);
   // The same named thickness field forms the skin above this muscle. Lower
   // fibres taper to the support; no fitting of muscle back out from the skin.
   const u=g.tissueData[node.a*4+2],blend=tissueSmooth(0,.10,u)*(1-tissueSmooth(.82,1,u));
   const rim=node.a===node.b,amplitude=layers[key]||0;
   let half=rim?0:node.half+(Math.max(.0002,Math.min(node.half,amplitude*.5))-node.half)*blend;
   const under=layers.offsets[key];
   let centre=mix(node.base,add(hard,mul(normal,under+half)),blend);
   let layerNormal=normal;
   if(key==='gluteus_maximus'&&y<-.018){
    const side=m.id.startsWith('left_')?'left':'right',leg=lowerGlutealAttachment(tissue,side,node.base);
    centre=mix(centre,leg.centre,leg.blend);layerNormal=norm(mix(normal,leg.normal,leg.blend));
    half=rim?0:half+(leg.half-half)*leg.blend;
   }
   g.p.set(rim?centre:add(centre,mul(layerNormal,half)),node.a*3);
   if(!rim)g.p.set(sub(centre,mul(layerNormal,half)),node.b*3);
   node.center=centre;node.half=half;
   // Keep animation's local thickness consistent with the newly constructed sheet.
   g.tissueData[node.a*4+1]=half;if(!rim)g.tissueData[node.b*4+1]=half;
  }
  // Closed shared-rim sheets must have outward mean winding on both sides.
  // This is an orientation check, not a muscle collision/intersection solver.
  let volume=0;for(let k=0;k<g.i.length;k+=3){const [a,b,c]=Array.from(g.i.subarray(k,k+3)).map(i=>Array.from(g.p.subarray(i*3,i*3+3)));volume+=dot(a,cross(b,c))/6;}
  if(!Number.isFinite(volume)||Math.abs(volume)<1e-12)degenerateSheets.push(m.id);
  if(volume<0){for(let k=0;k<g.i.length;k+=3)[g.i[k+1],g.i[k+2]]=[g.i[k+2],g.i[k+1]];windingCorrections++;}
  g.n=mesh(Array.from(g.p),Array.from(g.i)).n;
  refreshMuscleSamples(m);changed++;
 }
 tissue.axialMuscleReport={schema:'jarvis/axial_muscles@7',sheetCount:changed,
  geometrySource:'same bone envelope and tissue fields as posterior skin',windingCorrections,degenerateSheets,fullMusclePhysics:false};
}

function shoulderLayerAttachment(tissue,p,armOwnership,weights){
 const core=tissue.structure;if(!core)return null;
 const x=Math.abs(p[0]),y=bodyAuthorY(p[1]-core.hipY),side=p[0]<0?'left':'right';
 const section=axialCavity(p[1]-core.hipY),cosine=(p[2]-section[4])/Math.max(.01,Math.hypot(p[0],p[2]-section[4]));
 if(cosine<0&&armOwnership<.70)return axialLayerAttachment(tissue,p,weights);
 const mask=tissueSmooth(.270,.340,y)*(1-tissueSmooth(.520,.580,y))
  *tissueSmooth(.065,.105,x/core.widthScale)*(1-tissueSmooth(.295,.345,x/core.widthScale));
 if(mask===0)return null;
 const [rx,rf,rb,cz]=shoulderCoreSection(core,p[1]),z=p[2]-cz,rz=z>=0?rf:rb;
 const radius=Math.hypot(p[0]/rx,z/rz),thorax=[p[0]/Math.max(radius,1e-6),p[1],cz+z/Math.max(radius,1e-6)];
 const arm=tissue.bind.get(side+'_upperArm'),local=rotate(inv(arm.q),sub(p,arm.p));
 const L=len(tissue.human.byId.get(side+'_forearm').bind),r=.022*core.widthScale;
 const d=[local[0]/r,(local[1]+L*.22)/(L*.31),local[2]/r],m=Math.max(1e-6,len(d));
 const armPoint=point(arm,[local[0]/m,-L*.22+(local[1]+L*.22)/m,local[2]/m]);
 // Use the material's skeletal ownership, not a world-X cut through the tube.
 // At 50% arm ownership both supports have zero strength, so switching owner
 // is continuous even when the medial upper arm overlaps the chest in X.
 const armSide=armOwnership>.50;
 // Upper chest over clavicle and scapula needs more glide with the shoulder
 // girdle. Keep the lower lateral thorax firmly attached to its support.
 const glide=1-.75*tissueSmooth(.420,.510,y);
 const gate=Math.max(tissueSmooth(0,.30,cosine),tissueSmooth(.70,.85,armOwnership));
 const strength=(armSide?tissueSmooth(.50,.85,armOwnership):(1-tissueSmooth(.15,.50,armOwnership))*glide)*gate;
 const anchor=armSide?armPoint:thorax,offset=sub(p,anchor),thickness=len(offset);
 const outside=armSide?m>=1:radius>=1;
 // Fade before support contact. R4's binary inside/1-mm test switched a full
 // constraint on in one triangle, creating jagged surface shelves.
 const clearance=outside?thickness:-thickness,eligibility=tissueSmooth(.001,.012,clearance);
 return {owner:armSide?side+'_upperArm':'T1',anchor,mask:mask*strength*eligibility,
  requestedMask:mask*strength,clearance,
  normalTravel:armSide?.006:.004,tangentTravel:armSide?.014:.008,
  thickness,outside,region:armSide?'deltoid_upper_arm':'thoracic_soft_tissue'};
}
// The authored rest shell is never cut to the simplified support ellipsoid.
// Supports bound pose deltas; deltoid/fold/neck fields own the resting anatomy.
function bindShoulderSoftLayer(tissue,g){
 const count=g.p.length/3;g.structureAnchor=new Float32Array(count*4);g.structureData=new Float32Array(count*4);
 let attached=0,unsupported=0,min=Infinity,max=0;
 for(let v=0;v<count;v++){
  const p=Array.from(g.p.subarray(v*3,v*3+3)),side=p[0]<0?'left':'right',armId=tissue.jointIds.get(side+'_upperArm');
  let armOwnership=0;for(let k=0;k<4;k++)if(g.skinJoints[v*4+k]===armId)armOwnership+=g.skinWeights[v*4+k];
  const weights=[];for(let k=0;k<4;k++)if(g.skinWeights[v*4+k]>0)weights.push([tissue.human.joints[g.skinJoints[v*4+k]].id,g.skinWeights[v*4+k]]);
  const a=shoulderLayerAttachment(tissue,p,armOwnership,weights);
  if(!a||a.requestedMask===0)continue;
  // Never conceal a bad bind by forcing an inside point across the support.
  if(!a.outside||a.thickness<.001){unsupported++;continue;}
  if(a.mask===0)continue;
  g.structureAnchor.set([...a.anchor,tissue.jointIds.get(a.owner)],v*4);
  g.structureData.set(a.secondOwner?[a.mask,-tissue.jointIds.get(a.secondOwner)-1,-a.secondWeight,a.thickness]:[a.mask,a.normalTravel,a.tangentTravel,a.thickness],v*4);
  attached++;min=Math.min(min,a.thickness);max=Math.max(max,a.thickness);
 }
 tissue.shoulderLayerReport={schema:'jarvis/axial_shoulder_soft_layer@7',sex:BODY_SEX,attachedVertices:attached,
  unsupportedVertices:unsupported,restThicknessM:attached?[min,max]:null,
  strata:['skin','subcutaneous fat','muscle envelope'],continuousSurface:true,
  algorithm:'continuous two-joint axial attachment; bone-sampled support; bounded soft travel',
  restShellClippedToProxy:false,
  fullVolumePhysics:false,fullCollisionSolver:false,visualAcceptance:false};
}
function shoulderSupportSample(tissue,sample,candidate,transform){
 // Same primary shoulder blend and support limit as the vertex shader. Sparse
 // floor samples still omit respiration and the <=3 mm muscle surface offset.
 const rigid=(id,p)=>{const f=transform(id),r=f.q,d=f.d;
  const t=mul(add(sub(mul(d.slice(0,3),r[3]),mul(r.slice(0,3),d[3])),cross(r.slice(0,3),d.slice(0,3))),2);
  return add(rotate(r,p),t);};
 const x=Math.abs(sample.p[0]),y=sample.p[1]-REST_HIP_HEIGHT;
 const blend=.65*tissueSmooth(.105,.145,x)*(1-tissueSmooth(.255,.305,x))
  *tissueSmooth(bodyAxialY(.310),bodyAxialY(.360),y)*(1-tissueSmooth(bodyAxialY(.465),bodyAxialY(.505),y));
 let p=candidate;
 if(blend>=.00001&&sample.weights[0]<=.99999){
  let linear=[0,0,0];for(let k=0;k<4;k++)linear=add(linear,mul(rigid(sample.joints[k],sample.p),sample.weights[k]));
  p=add(mul(p,1-blend),mul(linear,blend));
 }
 const data=sample.structureData,anchor=sample.structureAnchor;
 if(!data||data[0]<=0)return p;
 const id=Math.round(anchor[3]);let base=transform(id),normalLimit=data[1],tangentLimit=data[2];
 if(data[1]<0){const other=transform(Math.round(-data[1]-1)),w=-data[2],sign=dot(base.q,other.q)<0?-1:1;
  let r=base.q.map((v,k)=>v*(1-w)+other.q[k]*w*sign),d=base.d.map((v,k)=>v*(1-w)+other.d[k]*w*sign);
  const length=Math.max(.00001,Math.hypot(...r));r=r.map(v=>v/length);d=d.map(v=>v/length);const orth=dot(r,d);d=d.map((v,k)=>v-r[k]*orth);
  base={q:r,d};normalLimit=.009;tangentLimit=.024;
 }
 const r=base.q,d=base.d,translation=mul(add(sub(mul(d.slice(0,3),r[3]),mul(r.slice(0,3),d[3])),cross(r.slice(0,3),d.slice(0,3))),2);
 const baseline=add(rotate(r,sample.p),translation),axis=norm(rotate(r,sub(sample.p,anchor.slice(0,3))));
 const delta=sub(p,baseline),n=dot(delta,axis),tangent=sub(delta,mul(axis,n));
 const slide=mul(tangent,1/Math.sqrt(1+(len(tangent)/Math.max(tangentLimit,.0001))**2));
 const limit=Math.min(normalLimit,data[3]*.45),compression=n/Math.sqrt(1+(n/Math.max(limit,.0001))**2);
 return add(mul(p,1-data[0]),mul(add(baseline,add(mul(axis,compression),slide)),data[0]));
}
const SHOULDER_LAYER_GLSL=`
void constrainShoulderLayer(inout vec3 p,inout vec3 n){
  float amount=structureData.x;if(amount<=0.)return;
  int id=int(structureAnchor.w+.5);
  vec4 r=texelFetch(jointPalette,ivec2(0,id),0),d=texelFetch(jointPalette,ivec2(1,id),0);
  float normalLimit=structureData.y,tangentLimit=structureData.z;
  if(structureData.y<0.){
    int other=int(-structureData.y-1.+.5);float w=-structureData.z;
    vec4 rb=texelFetch(jointPalette,ivec2(0,other),0),db=texelFetch(jointPalette,ivec2(1,other),0);
    float signQ=dot(r,rb)<0.?-1.:1.;r=r*(1.-w)+rb*w*signQ;d=d*(1.-w)+db*w*signQ;
    float lenQ=max(length(r),.00001);r/=lenQ;d/=lenQ;d-=r*dot(r,d);
    normalLimit=.009;tangentLimit=.024;
  }
  vec3 t=2.*(r.w*d.xyz-d.w*r.xyz+cross(r.xyz,d.xyz));
  vec3 baseline=qrotate(r,position)+t;
  vec3 axis=normalize(qrotate(r,position-structureAnchor.xyz));
  vec3 delta=p-baseline;float normalDelta=dot(delta,axis);
  vec3 tangent=delta-axis*normalDelta;float travel=length(tangent);
  // Smooth bounded travel, derivative 1 at zero. Bind pose is reproduced exactly.
  tangent/=sqrt(1.+pow(travel/max(tangentLimit,.0001),2.));
  float limit=min(normalLimit,structureData.w*.45);
  normalDelta/=sqrt(1.+pow(normalDelta/max(limit,.0001),2.));
  p=mix(p,baseline+axis*normalDelta+tangent,amount);
  n=normalize(mix(n,qrotate(r,normal),amount*.45));
}
`;
