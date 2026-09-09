/* Shoulder-girdle R2 + skin-shoulder refinement R3 (2026-09-08).
 * V1.12.1 hand, wrist and forearm geometry remains frozen.
 * V1.16.0 changes the resting shoulder-girdle binding and its local skin bridge.
 * Structural references are recorded in docs/anatomy/shoulder-girdle-v2/FRAMEWORK.md.
 */
const SHOULDER_SHAPE_DEFAULT=Object.freeze({
 deltoidFullness:1,upperArmWidth:1,bicepsVolume:1,tricepsVolume:1,
 clavicleRelief:1,axillaryFold:1,girdleSetback:1,posteriorShoulderDepth:1
});
const SHOULDER_SHAPE_LIMITS=Object.freeze({
 deltoidFullness:[.82,1.18],upperArmWidth:[.88,1.12],bicepsVolume:[.65,1.35],tricepsVolume:[.65,1.35],
 clavicleRelief:[.35,1.35],axillaryFold:[.65,1.25],girdleSetback:[.85,1.15],posteriorShoulderDepth:[.85,1.18]
});
function validateShoulderShape(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('肩臂参数必须是对象');
 const out={...SHOULDER_SHAPE_DEFAULT};
 for(const [k,v]of Object.entries(input)){const b=SHOULDER_SHAPE_LIMITS[k];if(!b||!Number.isFinite(v)||v<b[0]||v>b[1])throw Error('肩臂参数超出编辑范围：'+k);out[k]=v;}
 return out;
}
const shoulderG=(x,s)=>Math.exp(-((x/s)**2));
const shoulderShape=t=>t.human.shoulderShape||SHOULDER_SHAPE_DEFAULT;
function shoulderClavicleLine(tissue,x){
 const side=x<0?'left':'right',hy=tissue.bind.get('hips').p[1],sc=tissue.bind.get(side+'_SC').p,ac=tissue.bind.get(side+'_AC').p;
 const a=Math.abs(x),x0=Math.abs(sc[0]),x1=Math.abs(ac[0]),u=clamp((a-x0)/Math.max(.001,x1-x0),0,1);
 return sc[1]-hy+(ac[1]-sc[1])*u+.0024*Math.sin(Math.PI*u);
}
function shoulderTorsoRelief(tissue,x,t,cs){
 const authorT=bodyAuthorY(t),p=shoulderShape(tissue),a=Math.abs(x),side=tissueSmooth(.014,.032,a)*(1-tissueSmooth(.150,.190,a));
 if(cs>=0){
  const line=shoulderClavicleLine(tissue,x);
  // The clavicle is a shallow oblique ridge. The infraclavicular plane falls
  // away from it and merges into the pectoral surface without a second shelf.
  const clav=p.clavicleRelief*side*(.0054*shoulderG(t-line,.0105)-.0018*shoulderG(t-line-.020,.021));
  const notch=-.0025*shoulderG(x,.014)*shoulderG(t-(line+.004),.013);
  const pec=.0022*shoulderG(a-.103,.058)*shoulderG(authorT-.431,.045)*tissueSmooth(.328,.370,authorT);
  return (clav+notch+pec)*cs*cs;
 }
 // Posterior shoulder is a broad plane over scapula, not a spherical bead.
 return -.0018*shoulderG(a-.112,.052)*shoulderG(authorT-.448,.047)*cs*cs;
}
function shoulderArmSection(tissue,side,t,base){
 const p=shoulderShape(tissue),fade=tissueSmooth(.125,.158,t)*(1-tissueSmooth(.226,.258,t));
 // Fuller authored deltoid and proximal humerus envelope. The reference
 // establishes anatomy; these character-specific radii follow the requested
 // stronger shoulder proportions and taper back into the existing mid-arm.
 // Carry the asymmetric collar into the proximal arm, fading to the existing
 // mid-arm envelope. Metre values are character tuning, not population means.
 const proximal=1-tissueSmooth(.125,.245,t);
 if(fade===0&&proximal===0)return base;
 const b=shoulderG(t-.175,.050),tr=shoulderG(t-.163,.063);
 return [base[0]*(1+(p.upperArmWidth-1)*fade)+.0035*proximal+.0012*b*fade,
  base[1]+.0025*proximal+(.0042*p.bicepsVolume*b+(p.upperArmWidth-1)*.030)*fade,
  base[2]+(.053*p.posteriorShoulderDepth-.050)*proximal+(.0053*p.tricepsVolume*tr+(p.upperArmWidth-1)*.030)*fade];
}
function shoulderArmPoint(tissue,side,angle,t,frameValue,radii){
 const [rx,rf,rb]=shoulderArmSection(tissue,side,t,radii(t)),cs=Math.cos(angle);
 return point(frameValue,[Math.sin(angle)*rx,-t,cs*(cs>=0?rf:rb)]);
}
function shoulderArmJoinLoop(ids,frameValue,t,radii){
 // Keep the published R1 seam correspondence independent of edited radii.
 // Recomputing polar correspondence from deformed rings can add/remove
 // near-coincident seam triangles and renumber every downstream vertex.
 const p=SHOULDER_SHAPE_DEFAULT,base=radii(t),fade=tissueSmooth(.125,.158,t)*(1-tissueSmooth(.226,.258,t));
 const proximal=1-tissueSmooth(.125,.175,t),b=shoulderG(t-.175,.050),tr=shoulderG(t-.163,.063);
 const rx=base[0]*(1+(p.upperArmWidth-1)*fade)+.0012*b*fade;
 const rf=base[1]-.0015*proximal+(.0032*p.bicepsVolume*b+(p.upperArmWidth-1)*.030)*fade;
 const rb=base[2]+(.049*p.posteriorShoulderDepth-.050)*proximal+(.0043*p.tricepsVolume*tr+(p.upperArmWidth-1)*.030)*fade;
 const v=[];ids.forEach((id,k)=>{const angle=k/ids.length*Math.PI*2,cs=Math.cos(angle);v[id]={p:point(frameValue,[Math.sin(angle)*rx,-t,cs*(cs>=0?rf:rb)])};});
 return surfaceAngularLoop({v},ids,frameValue);
}
function shoulderCollarSkinWeight(side,angle,u){
 const s=side==='right'?1:-1,top=s*Math.sin(angle),cs=Math.cos(angle),superior=Math.max(0,top),inferior=Math.max(0,-top);
 // Transfer the cap and fold toward the humerus before the distal seam.
 // Inferior skin follows earlier to avoid a hanging web during elevation.
 // The thoracic endpoint stays fixed; both endpoint weights remain exact.
 const base=tissueSmooth(0,.82,u),exponent=1.02-.16*superior+.08*Math.abs(cs)-.28*inferior;
 return clamp(Math.pow(base,Math.max(.72,exponent)),0,1);
}
// Round the torso branch in its own (height, angle) chart before lofting.
// Shared rim indices and the original angular correspondence stay unchanged.
// The compact field also moves neighbouring torso rows, avoiding a new seam.
function shoulderSocketCoordinates(t,theta,socket){
 const [mid,half,center,span]=socket,du=angleDiff(theta,center),u=du/span,v=(t-mid)/half;
 const au=Math.abs(u),av=Math.abs(v);
 if(au>=1.8||av>=1.8)return [t,theta];
 const fade=(1-tissueSmooth(1,1.8,au))*(1-tissueSmooth(1,1.8,av));
 const roundU=Math.sin(Math.PI*.5*Math.min(au,1))**2,roundV=Math.sin(Math.PI*.5*Math.min(av,1))**2;
 return [mid+half*v*(1-.24*roundU*fade),center+span*u*(1-.24*roundV*fade)];
}
function shapeShoulderSockets(cage,tissue,rings,rows,holes){
 const tangents=new Map(),sides=rings[0].length;
 for(const h of holes){
  const mid=(rows[h.r0]+rows[h.r1])*.5,half=(rows[h.r1]-rows[h.r0])*.5;
  const center=(h.c0+h.width*.5)/sides*Math.PI*2,span=h.width*.5/sides*Math.PI*2;
  const socket=[mid,half,center,span];
  for(let r=0;r<rows.length;r++)for(let k=0;k<sides;k++){
   const t=rows[r],theta=k/sides*Math.PI*2,[tt,aa]=shoulderSocketCoordinates(t,theta,socket);
   if(Math.abs(tt-t)<1e-12&&Math.abs(angleDiff(aa,theta))<1e-12)continue;
   cage.v[rings[r][k]].p=surfaceTorsoPoint(tissue,tt,aa);
  }
  // One-sided outward samples follow the connected torso into the opening.
  // This supplies a descending neck-to-cap tangent and a rising axillary one.
  for(let r=h.r0;r<=h.r1;r++)for(let c=0;c<=h.width;c++){
   if(r!==h.r0&&r!==h.r1&&c!==0&&c!==h.width)continue;
   const k=(h.c0+c)%sides,id=rings[r][k],theta=k/sides*Math.PI*2;
   const outerT=mid+(rows[r]-mid)*1.025,outerA=center+angleDiff(theta,center)*1.025;
   const [tt,aa]=shoulderSocketCoordinates(outerT,outerA,socket);
   tangents.set(id,norm(sub(cage.v[id].p,surfaceTorsoPoint(tissue,tt,aa))));
  }
 }
 return tangents;
}
function shoulderCollarPoint(tissue,side,start,angle,u,frameValue,armStart,radii,torsoTangent){
 const s=side==='right'?1:-1,p=shoulderShape(tissue),cs=Math.cos(angle),top=s*Math.sin(angle),upper=Math.max(0,top),lower=Math.max(0,-top);
 // Distal shoulder is asymmetric: the anterior surface is flatter and the
 // posterior deltoid/triceps side remains deeper. The humeral joint itself has
 // already been moved posteriorly in the V1.16 bind baseline.
 // Share the arm section and its outgoing direction at the seam. Independent
 // collar radii/handles caused a cuff-like change of contour at this boundary.
 const target=shoulderArmPoint(tissue,side,angle,armStart,frameValue,radii);
 const sampleStep=.0005,next=shoulderArmPoint(tissue,side,angle,armStart+sampleStep,frameValue,radii);
 const tangent=mul(sub(next,target),1/sampleStep);
 // Derive the first handle from the actual rounded torso surface. A fixed
 // upward handle made a horizontal shelf even when the neck sloped downward.
 const handle=clamp(dist(start,target)/3,.012,.034-.010*lower);
 const b=add(start,mul(torsoTangent,handle));
 const c=sub(target,mul(tangent,.050+.014*upper-.006*lower));
 const out=surfaceBezier(start,b,c,target,u),bump=16*u*u*(1-u)*(1-u);
 // Broad anterior / lateral / posterior lobes converge toward the humerus.
 // Angular and longitudinal windows avoid a uniform spherical shoulder cap.
 const taper=1-.40*u,cap=bump*taper;
 const anterior=Math.max(0,cs),posterior=Math.max(0,-cs);
 out[0]+=s*.0040*p.deltoidFullness*cap*upper;
 out[1]+=.0030*p.deltoidFullness*cap*upper;
 out[2]+=(.0045*anterior-.0065*p.posteriorShoulderDepth*posterior)*p.deltoidFullness*cap;
 // Separate pectoral (front) and latissimus/teres (back) fold envelopes.
 // These are broad skin volumes, not cut grooves or explicit muscle meshes.
 const fold=bump*(1-u)*lower*p.axillaryFold;
 const frontFold=anterior*anterior,backFold=posterior*posterior;
 out[2]+=.008*fold*frontFold-.010*fold*backFold;
 out[1]-=.002*fold*(.35+.65*(frontFold+backFold));
 // A rounded medial web narrows the arm-to-thorax opening. Both ends retain
 // their shared vertices; no cap is inserted across the axillary recess.
 out[0]-=s*.0045*p.axillaryFold*bump*lower*(1-.35*u);
 // A shallow deltopectoral transition, fading before both collar endpoints.
 out[2]-=.0020*bump*(1-u)*anterior*shoulderG(top-.28,.38);
 const setback=(p.girdleSetback-1)*.025;
 out[2]-=setback*bump*(.55+.45*Math.abs(cs));
 return out;
}
function fairShoulderSurface(cage,tissue,torsoRings,torsoRows){
 torsoRings.forEach((ring,r)=>ring.forEach((id,k)=>{
  const v=cage.v[id],t=torsoRows[r];if(bodyAuthorY(t)<.32||bodyAuthorY(t)>.56)return;
  v.p[2]+=shoulderTorsoRelief(tissue,v.p[0],t,Math.cos(k/ring.length*Math.PI*2));
 }));
 const hip=tissue.bind.get('hips').p,adj=cage.v.map(()=>new Set());
 for(const f of cage.f)for(let i=0;i<f.length;i++){adj[f[i]].add(f[(i+1)%f.length]);adj[f[(i+1)%f.length]].add(f[i]);}
 const weights=cage.v.map(v=>{
  const a=Math.abs(v.p[0]),y=bodyAuthorY(v.p[1]-hip[1]);
  return tissueSmooth(.090,.136,a)*(1-tissueSmooth(.266,.306,a))*tissueSmooth(.350,.392,y)*(1-tissueSmooth(.514,.548,y));
 });
 // The port and tangents now define the contour before subdivision. Use only
 // two light fairing passes so averaging does not flatten the authored slope.
 for(let it=0;it<2;it++){
  const before=cage.v.map(v=>v.p.slice());
  cage.v.forEach((v,i)=>{const w=weights[i];if(w===0||!adj[i].size)return;let mean=[0,0,0];for(const j of adj[i])mean=add(mean,before[j]);mean=mul(mean,1/adj[i].size);
   const delta=sub(mean,before[i]);v.p=[before[i][0]+delta[0]*w*.28,before[i][1]+delta[1]*w*.24,before[i][2]+delta[2]*w*.35];
  });
 }
 // Small posterolateral correction keeps the shoulder centred over the thorax
 // after the arm is adducted from the A-pose bind to the neutral rest pose.
 const p=shoulderShape(tissue);
 cage.v.forEach((v,i)=>{const a=Math.abs(v.p[0]),y=bodyAuthorY(v.p[1]-hip[1]),m=tissueSmooth(.145,.178,a)*(1-tissueSmooth(.244,.286,a))*tissueSmooth(.382,.414,y)*(1-tissueSmooth(.497,.531,y));if(!m)return;
  const front=tissueSmooth(.045,.105,v.p[2]);v.p[2]-=(.0035+.0025*front)*m*p.girdleSetback;
 });
 tissue.shoulderSurfaceReport={schema:'jarvis/shoulder_surface@2',version:'1.16.0',refinement:'rounded-socket-tangent-loft-r8',parameters:{...p},bindingRevision:5,skeletonBindingRevision:4,handForearmBaseline:'1.12.1',topologyChanged:false,limbLengthsChanged:false,shoulderGirdleRaisedM:.012,method:'rounded shared torso socket + sampled torso tangent + shared arm tangent + tapered asymmetric deltoid',visualAcceptance:false};
}
const SHOULDER_GIRDLE_KNOWLEDGE_CONTRACT=Object.freeze({schema:'jarvis/shoulder_girdle_contract@2',version:'1.16.0',units:'metre',rules:[
 'Clavicle spans sternum to acromion and acts as the anterior strut of the pectoral girdle.',
 'Scapula lies on the posterior thorax; the glenoid/humeral centre must not be represented as an anterior chest ball.',
 'Resting shoulder surface keeps a shallow clavicular ridge, broad scapular plane and asymmetric deltoid envelope.',
 'The cap and axillary fold transfer smoothly to the humerus before the distal seam; the thoracic endpoint remains fixed.',
 'Hand, wrist and forearm geometry remain frozen at V1.12.1; shoulder edits may translate their world placement but do not alter their local shape or segment lengths.',
 'Pose channels never modify bind lengths. Shoulder-girdle rest-position changes increment the proportion/binding revision.'
 ],sources:['https://openstax.org/books/anatomy-and-physiology-2e/pages/8-1-the-pectoral-girdle','https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs','https://3d.nih.gov/entries/3DPX-016667','https://pubmed.ncbi.nlm.nih.gov/11264863/','https://pubmed.ncbi.nlm.nih.gov/20351522/','https://pubmed.ncbi.nlm.nih.gov/7288225/'],referenceUse:'relationship/orientation and visual QA only; no external mesh vertices are imported into the character',medicalValidation:false});

// A bounded regional LBS/DQS blend reduces DQS bulging in the axillary web.
// Candidate deformation; R4 support constraints are applied after all soft offsets.
function refineShoulderSkinWeights(tissue,cage){
 const hip=tissue.bind.get('hips').p[1];
 for(const v of cage.v){
  const x=Math.abs(v.p[0]),y=bodyAuthorY(v.p[1]-hip),side=v.p[0]<0?'left':'right';
  const blend=tissueSmooth(.27,.36,y)*(1-tissueSmooth(.50,.59,y));
  if(x<.09||x>.34||blend===0)continue;
  if(v.w.some(([id,w])=>w>0&&/_(forearm|radiusRotation|hand)/.test(id)))continue;
  // The thoracic wall stays with the thorax. Transfer starts outside its edge;
  // ordinary arm elevation must not drag the whole lateral rib cage upward.
  const edge=tissue.structure?shoulderCoreSection(tissue.structure,v.p[1])[0]+.018:torsoEnvelope(y,tissue.human.torsoShape||TORSO_SHAPE_DEFAULT)[0];
  const total=v.w.reduce((n,[id,w])=>n+w,0);
  const nativeArm=v.w.reduce((n,[id,w])=>n+(id===side+'_upperArm'?w:0),0)/Math.max(total,1e-8);
  // Tube vertices stay on the humerus even on the medial half of the arm.
  // Only low-arm-influence thoracic/collar vertices receive the spatial field.
  const spatial=tissueSmooth(edge-.004,edge+.100,x);
  const arm=nativeArm+(spatial-nativeArm)*(1-tissueSmooth(.25,.80,nativeArm)),girdle=.14*4*arm*(1-arm);
  const out=new Map([['T1',(1-arm-girdle)*blend],[side+'_AC',girdle*blend],[side+'_upperArm',arm*blend]]);
  for(const [id,w]of v.w){const key=/^[TC]\d+$/.test(id)?'T1':id;out.set(key,(out.get(key)||0)+w*(1-blend));}
  v.w=[...out].filter(([,w])=>w>1e-10);
 }
}
function refineCervicoscapularContour(tissue,cage){
 const hy=tissue.bind.get('hips').p[1];
 for(const v of cage.v){
  const a=Math.abs(v.p[0]),t=bodyAuthorY(v.p[1]-hy);
  if(a<=.045||a>=.190||t<=.460||t>=.620)continue;
  // Broad superior trapezius transition between the neck base and acromion.
  // A small vertical relief avoids turning this into a spherical shoulder cap.
  const u=tissueSmooth(.055,.175,a),ridge=.580+(.520-.580)*u;
  const lateral=tissueSmooth(.045,.070,a)*(1-tissueSmooth(.160,.190,a));
  const vertical=tissueSmooth(.460,.490,t)*(1-tissueSmooth(.590,.620,t));
  const w=lateral*vertical*shoulderG(t-ridge,.038)*tissueSmooth(0,.045,v.p[2]);
  v.p[1]+=.006*w;
  v.p[2]-=.002*w*(1-tissueSmooth(-.025,.065,v.p[2]));
 }
}
const SHOULDER_SKIN_BLEND_GLSL=`
void shoulderSkinBlend(inout vec3 p,inout vec3 n,vec3 restP,vec3 restN){
  float x=abs(restP.x),y=restP.y-${REST_HIP_HEIGHT.toFixed(8)};
  float amount=.65*smoothstep(.105,.145,x)*(1.-smoothstep(.255,.305,x))
    *smoothstep(${bodyAxialY(.310).toFixed(8)},${bodyAxialY(.360).toFixed(8)},y)*(1.-smoothstep(${bodyAxialY(.465).toFixed(8)},${bodyAxialY(.505).toFixed(8)},y));
  if(amount<.00001||skinWeights.x>.99999)return;
  vec3 lp=vec3(0.),ln=vec3(0.);
  for(int k=0;k<4;k++){
    int id=int(skinJoints[k]+.5);
    vec4 r=texelFetch(jointPalette,ivec2(0,id),0),d=texelFetch(jointPalette,ivec2(1,id),0);
    vec3 t=2.*(r.w*d.xyz-d.w*r.xyz+cross(r.xyz,d.xyz));
    lp+=skinWeights[k]*(qrotate(r,restP)+t);
    ln+=skinWeights[k]*qrotate(r,restN);
  }
  p=mix(p,lp,amount);n=normalize(mix(n,ln,amount));
}
`;
