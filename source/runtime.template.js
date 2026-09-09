// MODULE math
const V=(x=0,y=0,z=0)=>[x,y,z];
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,s)=>a.map(x=>x*s);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(...a);
const norm=a=>mul(a,1/(len(a)||1));
const dist=(a,b)=>len(sub(a,b));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const smoother=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10)};
const qi=()=>[0,0,0,1];
const qnorm=q=>mul(q,1/(len(q)||1));
const inv=q=>[-q[0],-q[1],-q[2],q[3]];
function qm(a,b){const [x,y,z,w]=a,[X,Y,Z,W]=b;return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z]}
function aa(axis,a){return [...mul(norm(axis),Math.sin(a/2)),Math.cos(a/2)]}
const qx=a=>aa([1,0,0],a),qy=a=>aa([0,1,0],a),qz=a=>aa([0,0,1],a);
function rotate(q,v){const t=mul(cross(q.slice(0,3),v),2);return add(v,add(mul(t,q[3]),cross(q.slice(0,3),t)))}
function qslerp(a,b,t){let d=dot(a,b);if(d<0){b=mul(b,-1);d=-d}if(d>.9995)return qnorm(mix(a,b,t));const r=Math.acos(clamp(d,-1,1)),s=Math.sin(r);return add(mul(a,Math.sin((1-t)*r)/s),mul(b,Math.sin(t*r)/s))}
const qangle=(a,b)=>2*Math.acos(clamp(Math.abs(dot(a,b)),-1,1));
function fromTo(a,b){a=norm(a);b=norm(b);const d=dot(a,b);if(d<-.99999)return aa(norm(cross(a,Math.abs(a[0])<.7?[1,0,0]:[0,0,1])),Math.PI);return qnorm([...cross(a,b),1+d])}
function qb(x,y,z){const m00=x[0],m11=y[1],m22=z[2],tr=m00+m11+m22;let q;
if(tr>0){const s=Math.sqrt(tr+1)*2;q=[(y[2]-z[1])/s,(z[0]-x[2])/s,(x[1]-y[0])/s,s/4]}
else if(m00>m11&&m00>m22){const s=Math.sqrt(1+m00-m11-m22)*2;q=[s/4,(y[0]+x[1])/s,(z[0]+x[2])/s,(y[2]-z[1])/s]}
else if(m11>m22){const s=Math.sqrt(1+m11-m00-m22)*2;q=[(y[0]+x[1])/s,s/4,(z[1]+y[2])/s,(z[0]-x[2])/s]}
else{const s=Math.sqrt(1+m22-m00-m11)*2;q=[(z[0]+x[2])/s,(z[1]+y[2])/s,s/4,(x[1]-y[0])/s]}return qnorm(q)}
const frame=(p=V(),q=qi())=>({p:[...p],q:[...q]});
const compose=(a,b)=>frame(add(a.p,rotate(a.q,b.p)),qm(a.q,b.q));
const inverse=a=>frame(rotate(inv(a.q),mul(a.p,-1)),inv(a.q));
const point=(a,p)=>add(a.p,rotate(a.q,p));
function matrix(p,q){const x=rotate(q,[1,0,0]),y=rotate(q,[0,1,0]),z=rotate(q,[0,0,1]);return new Float32Array([...x,0,...y,0,...z,0,...p,1])}
const ident=()=>matrix(V(),qi());
function mm(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0])}
function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1])}
function lookAt(eye,target,up=[0,1,0]){const z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1])}
function project(m,p){const v=[...p,1],o=[0,0,0,0];for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[r]+=m[k*4+r]*v[k];return o.map(v=>v/o[3])}
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
function seeded(seed){let t=seed>>>0;return ()=>{t+=0x6D2B79F5;let v=Math.imul(t^t>>>15,1|t);v^=v+Math.imul(v^v>>>7,61|v);return ((v^v>>>14)>>>0)/4294967296}}
function hashFloats(a){let h=2166136261;const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);for(const x of b){h^=x;h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}

// Quaternion helpers used by the anatomical constraint authority. Quaternions
// are normalized and canonicalized so equivalent q and -q representations do
// not create discontinuous joint-angle readings.
const wrapPi=a=>Math.atan2(Math.sin(a),Math.cos(a));
function qcanonical(q){q=qnorm(q);return q[3]<0?mul(q,-1):q}
function qtwist(q,axis){
 q=qcanonical(q);axis=norm(axis);const v=q.slice(0,3),p=mul(axis,dot(v,axis));
 const t=qcanonical([...p,q[3]]),s=qcanonical(qm(q,inv(t)));
 return {swing:s,twist:t,angle:wrapPi(2*Math.atan2(dot(t.slice(0,3),axis),t[3]))};
}
function qrotvec(q){
 q=qcanonical(q);const s=len(q.slice(0,3));if(s<1e-12)return [0,0,0];
 const a=2*Math.atan2(s,clamp(q[3],-1,1));return mul(q.slice(0,3),a/s);
}
function qfromRotvec(v){const a=len(v);return a<1e-12?qi():aa(mul(v,1/a),a)}

// MODULE constraints
const DEG=Math.PI/180;
const EPS=1e-9;
const DOWN=Object.freeze([0,-1,0]);

// Conservative generic-adult runtime envelope. Values are intentionally kept
// inside published healthy-adult reference ranges. They are an engineering
// safety profile for animation, not an individual clinical assessment.
const HUMAN_ROM_PROFILE_V08=Object.freeze({
 schema:'knowledge_human/joint_constraint_profile@0.8',
 id:'adult-functional-conservative-v2',
 version:'0.8.0',
 units:'degrees',
 population:'generic healthy adult interactive runtime baseline',
 individualMedicalValidation:false,
 coordinatePolicy:'joint-local swing/twist decomposition; right-handed +Y up +Z forward',
 evidencePolicy:'measured active ROM for major joints; conservative engineering allocation for multi-joint chains',
 sources:Object.freeze([
  Object.freeze({id:'ROM_CDC_2011',kind:'population-reference',doi:'10.1111/j.1365-2516.2010.02399.x'}),
  Object.freeze({id:'ISB_UPPER_2005',kind:'joint-coordinate-standard',doi:'10.1016/j.jbiomech.2004.05.042'}),
  Object.freeze({id:'ISB_LOWER_2002',kind:'joint-coordinate-standard',doi:'10.1016/S0021-9290(01)00222-6'}),
  Object.freeze({id:'WRIST_COUPLING_2005',kind:'coupled-range-envelope',doi:'10.1016/j.clinbiomech.2004.10.002'}),
  Object.freeze({id:'SCAPULOHUMERAL_2012',kind:'shoulder-girdle-coupling',pmid:'22720268'}),
  Object.freeze({id:'CERVICAL_ROM_2002',kind:'healthy-adult-3d-rom',doi:'10.1016/S0736-0266(01)00079-1'}),
  Object.freeze({id:'LUMBAR_ROM_2001',kind:'asymptomatic-population-rom',pmid:'11518438'}),
  Object.freeze({id:'FINGER_ROM_2024',kind:'active-finger-rom',pmcid:'PMC11436331'}),
  Object.freeze({id:'HALLUX_GAIT_1995',kind:'walking-functional-range',doi:'10.7547/87507315-85-4-198'})
 ]),
 shoulder:Object.freeze({forwardElevation:140,backwardElevation:45,lateralElevation:140,medialElevation:30,axialTwist:80,totalShoulderElevation:170,ellipsePower:4}),
 elbow:Object.freeze({flexion:145,extension:0,reverseBendBlocked:true}),
 forearm:Object.freeze({pronation:80,supination:85}),
 wrist:Object.freeze({flexion:70,extension:65,radialDeviation:20,ulnarDeviation:30,axialTwist:2,coupledEllipse:true}),
 hip:Object.freeze({forwardElevation:130,backwardElevation:17,lateralElevation:45,medialElevation:25,axialTwist:45,ellipsePower:4}),
 knee:Object.freeze({flexion:140,extension:0,reverseBendBlocked:true}),
 ankle:Object.freeze({dorsiflexion:15,plantarflexion:55,inversion:20,eversion:12,axialRotation:12,coupledEllipsoid:true}),
 spine:Object.freeze({
  L:Object.freeze({flexion:60,extension:25,lateral:25,axial:7,segments:5}),
  T:Object.freeze({flexion:35,extension:25,lateral:30,axial:35,segments:12}),
  C:Object.freeze({flexion:52,extension:57,lateral:40,axial:72,segments:8,perSegmentCap:18})
 }),
 shoulderGirdle:Object.freeze({scElevation:12,scProtraction:15,acUpwardRotation:18,acTilt:15,totalUpwardRotation:30}),
 fingers:Object.freeze({mcpFlexion:90,mcpExtension:20,pipFlexion:100,pipExtension:10,dipFlexion:80,dipExtension:8,thumbCmcSpherical:50,thumbMcpFlexion:60,thumbIpFlexion:67}),
 toes:Object.freeze({halluxMtpExtension:65,halluxMtpFlexion:30,lesserMtpExtension:45,lesserMtpFlexion:35,ipFlexion:45,ipExtension:10}),
 jaw:Object.freeze({open:45,lateral:8,protrusionRotation:5}),
 runtimeAngularSpeed:Object.freeze({root:180,spine:180,shoulderGirdle:240,shoulder:360,elbow:480,forearm:480,wrist:420,hip:360,knee:480,ankle:420,finger:600,toe:600,jaw:300,other:360}),
 runtimeSpeedEvidence:'engineering transition caps; not presented as physiological maxima'
});

function makeConstraintRuntime(){
 return {
  frameId:0,
  dt:null,
  previous:null,
  frame:emptyConstraintFrame(),
  totalClampCount:0,
  totalRateLimitCount:0,
  maxLifetimeOvershootDeg:0
 };
}

function beginConstraintFrame(runtime,joints,dt){
 runtime.frameId++;
 runtime.dt=Number.isFinite(dt)&&dt>0?Math.min(dt,.05):null;
 runtime.previous=new Map(joints.map(j=>[j.id,[...j.q]]));
 runtime.frame=emptyConstraintFrame();
}

function resetConstraintReport(runtime){runtime.frame=emptyConstraintFrame();}

function emptyConstraintFrame(){return {clampCount:0,rateLimitCount:0,maxOvershootDeg:0,clampedJoints:[],limitsEvaluated:0,hardViolations:0};}

function canonical(q){const n=qnorm(q);return n[3]<0?mul(n,-1):n;}
function signedAngle(a){return Math.atan2(Math.sin(a),Math.cos(a));}
function degrees(v){return v/DEG;}
function radians(v){return v*DEG;}

function record(runtime,jointId,kind,overshootRad,before,after,components={}){
 runtime.frame.limitsEvaluated++;
 const overshoot=Math.max(0,degrees(Math.abs(overshootRad)));
 if(overshoot<=1e-7)return after;
 runtime.frame.clampCount++;
 runtime.totalClampCount++;
 runtime.frame.maxOvershootDeg=Math.max(runtime.frame.maxOvershootDeg,overshoot);
 runtime.maxLifetimeOvershootDeg=Math.max(runtime.maxLifetimeOvershootDeg,overshoot);
 if(runtime.frame.clampedJoints.length<24)runtime.frame.clampedJoints.push({jointId,kind,overshootDeg:overshoot,...components});
 return after;
}

function twistAngle(q,axis=DOWN){
 const n=canonical(q),projection=dot(n.slice(0,3),axis),m=Math.hypot(projection,n[3]);
 if(m<EPS)return 0;
 return signedAngle(2*Math.atan2(projection/m,n[3]/m));
}

function twistQuaternion(angle,axis=DOWN){return aa(axis,angle);}

function swingTwist(q,axis=DOWN){
 const n=canonical(q),projection=dot(n.slice(0,3),axis),t=canonical([...mul(axis,projection),n[3]]),s=canonical(qm(n,inv(t)));
 return {swing:s,twist:t,angle:twistAngle(t,axis)};
}

function quatToRotationVector(q){
 const n=canonical(q),s=Math.hypot(n[0],n[1],n[2]);
 if(s<EPS)return [0,0,0];
 const angle=2*Math.atan2(s,clamp(n[3],-1,1));
 return mul(n.slice(0,3),angle/s);
}

function rotationVectorToQuat(v){const a=len(v);return a<EPS?qi():aa(v,a);}

function cardinalEnvelope(azimuth,profile){
 const cs=Math.cos(azimuth),sn=Math.sin(azimuth);
 const sagittal=radians(cs>=0?profile.forwardElevation:profile.backwardElevation);
 const frontal=radians(sn>=0?profile.lateralElevation:profile.medialElevation);
 const power=profile.ellipsePower||4;
 const term=Math.pow(Math.abs(cs)/Math.max(EPS,sagittal),power)+Math.pow(Math.abs(sn)/Math.max(EPS,frontal),power);
 return term<EPS?Math.min(sagittal,frontal):1/Math.pow(term,1/power);
}

function constrainBallJointLocal(q,kind,side,runtime,jointId){
 const profile=kind==='arm'?HUMAN_ROM_PROFILE_V08.shoulder:HUMAN_ROM_PROFILE_V08.hip;
 const n=canonical(q),originalDirection=norm(rotate(n,DOWN));
 const elevation=Math.acos(clamp(-originalDirection[1],-1,1));
 const azimuth=Math.atan2(side*originalDirection[0],originalDirection[2]);
 const maxElevation=cardinalEnvelope(azimuth,profile);
 const clampedElevation=Math.min(elevation,maxElevation);
 const direction=[side*Math.sin(clampedElevation)*Math.sin(azimuth),-Math.cos(clampedElevation),Math.sin(clampedElevation)*Math.cos(azimuth)];
 const st=swingTwist(n,DOWN),twistMax=radians(profile.axialTwist),clampedTwist=clamp(st.angle,-twistMax,twistMax);
 const out=canonical(qm(fromTo(DOWN,direction),twistQuaternion(clampedTwist,DOWN)));
 const over=Math.max(0,elevation-maxElevation,Math.abs(st.angle)-twistMax);
 runtime.frame.limitsEvaluated++;
 if(over>1e-7){
  runtime.frame.limitsEvaluated--;
  return record(runtime,jointId,kind==='arm'?'shoulder-ball':'hip-ball',over,n,out,{elevationDeg:degrees(elevation),allowedElevationDeg:degrees(maxElevation),twistDeg:degrees(st.angle)});
 }
 return out;
}

function constrainHingeAngle(angle,kind,runtime,jointId){
 const max=radians(kind==='arm'?HUMAN_ROM_PROFILE_V08.elbow.flexion:HUMAN_ROM_PROFILE_V08.knee.flexion),out=clamp(angle,0,max),over=Math.abs(angle-out);
 runtime.frame.limitsEvaluated++;
 if(over>1e-7){runtime.frame.limitsEvaluated--;record(runtime,jointId,kind==='arm'?'elbow-hinge':'knee-hinge',over,angle,out,{requestedDeg:degrees(angle),appliedDeg:degrees(out)});}
 return out;
}

function constrainForearmTwist(angle,runtime,jointId){
 const min=-radians(HUMAN_ROM_PROFILE_V08.forearm.pronation),max=radians(HUMAN_ROM_PROFILE_V08.forearm.supination),out=clamp(signedAngle(angle),min,max),over=Math.abs(signedAngle(angle)-out);
 runtime.frame.limitsEvaluated++;
 if(over>1e-7){runtime.frame.limitsEvaluated--;record(runtime,jointId,'forearm-rotation',over,angle,out,{requestedDeg:degrees(angle),appliedDeg:degrees(out)});}
 return out;
}

function coupledScale(a,b,aNeg,aPos,bNeg,bPos){
 const an=a/(a>=0?aPos:aNeg),bn=b/(b>=0?bPos:bNeg),r=Math.hypot(an,bn);
 return r<=1?{a,b,scale:1}:{a:a/r,b:b/r,scale:1/r};
}

function constrainWristLocal(q,side,runtime,jointId){
 const n=canonical(q),st=swingTwist(n,DOWN),rv=quatToRotationVector(st.swing),p=HUMAN_ROM_PROFILE_V08.wrist;
 let flex=rv[0],deviation=side*rv[2];
 const requested={flex,deviation,twist:st.angle};
 flex=clamp(flex,-radians(p.flexion),radians(p.extension));
 deviation=clamp(deviation,-radians(p.ulnarDeviation),radians(p.radialDeviation));
 const coupled=coupledScale(flex,deviation,radians(p.flexion),radians(p.extension),radians(p.ulnarDeviation),radians(p.radialDeviation));
 flex=coupled.a;deviation=coupled.b;
 const twist=clamp(st.angle,-radians(p.axialTwist),radians(p.axialTwist));
 // Axial forearm rotation is owned by radiusRotation; the residual wrist twist
 // is only a tiny tolerance for numerical decomposition.
 const out=canonical(qm(rotationVectorToQuat([flex,0,side*deviation]),twistQuaternion(twist,DOWN)));
 const over=Math.max(Math.abs(requested.flex-flex),Math.abs(requested.deviation-deviation),Math.abs(requested.twist-twist));
 runtime.frame.limitsEvaluated++;
 if(over>1e-7){runtime.frame.limitsEvaluated--;return record(runtime,jointId,'wrist-coupled-envelope',over,n,out,{flexExtensionDeg:degrees(requested.flex),deviationDeg:degrees(requested.deviation),twistDeg:degrees(requested.twist)});}
 return out;
}

function constrainAnkleLocal(q,side,runtime,jointId){
 const n=canonical(q),rv=quatToRotationVector(n),p=HUMAN_ROM_PROFILE_V08.ankle;
 let sagittal=rv[0],axial=rv[1],frontal=side*rv[2];
 const requested={sagittal,axial,frontal};
 sagittal=clamp(sagittal,-radians(p.dorsiflexion),radians(p.plantarflexion));
 axial=clamp(axial,-radians(p.axialRotation),radians(p.axialRotation));
 frontal=clamp(frontal,-radians(p.eversion),radians(p.inversion));
 const sagittalLimit=sagittal>=0?radians(p.plantarflexion):radians(p.dorsiflexion),frontalLimit=frontal>=0?radians(p.inversion):radians(p.eversion),axialLimit=radians(p.axialRotation);
 const r=Math.sqrt((sagittal/sagittalLimit)**2+(frontal/frontalLimit)**2+(axial/axialLimit)**2);
 if(r>1){sagittal/=r;frontal/=r;axial/=r;}
 const out=canonical(rotationVectorToQuat([sagittal,axial,side*frontal]));
 const over=Math.max(Math.abs(requested.sagittal-sagittal),Math.abs(requested.axial-axial),Math.abs(requested.frontal-frontal));
 runtime.frame.limitsEvaluated++;
 if(over>1e-7){runtime.frame.limitsEvaluated--;return record(runtime,jointId,'ankle-coupled-envelope',over,n,out,{sagittalDeg:degrees(requested.sagittal),frontalDeg:degrees(requested.frontal),axialDeg:degrees(requested.axial)});}
 return out;
}

function segmentLimit(profile,key){return radians(profile[key]/profile.segments);}

function constrainSpineLocal(q,region,runtime,jointId){
 const n=canonical(q),rv=quatToRotationVector(n),p=HUMAN_ROM_PROFILE_V08.spine[region];
 if(!p)return n;
 const requested=[...rv];
 let x=clamp(rv[0],-segmentLimit(p,'extension'),segmentLimit(p,'flexion'));
 let y=clamp(rv[1],-segmentLimit(p,'axial'),segmentLimit(p,'axial'));
 let z=clamp(rv[2],-segmentLimit(p,'lateral'),segmentLimit(p,'lateral'));
 if(p.perSegmentCap){const cap=radians(p.perSegmentCap),m=Math.hypot(x,y,z);if(m>cap){const k=cap/m;x*=k;y*=k;z*=k;}}
 const out=canonical(rotationVectorToQuat([x,y,z])),over=Math.max(Math.abs(requested[0]-x),Math.abs(requested[1]-y),Math.abs(requested[2]-z));
 runtime.frame.limitsEvaluated++;
 if(over>1e-7){runtime.frame.limitsEvaluated--;return record(runtime,jointId,`${region}-spine-segment`,over,n,out,{rotationVectorDeg:requested.map(degrees)});}
 return out;
}

function constrainShoulderGirdleLocal(q,kind,side,runtime,jointId){
 const n=canonical(q),rv=quatToRotationVector(n),p=HUMAN_ROM_PROFILE_V08.shoulderGirdle,requested=[...rv];
 let x,y,z;
 if(kind==='sc'){
  x=clamp(rv[0],-radians(10),radians(10));
  y=clamp(rv[1],-radians(p.scProtraction),radians(p.scProtraction));
  z=clamp(side*rv[2],-radians(p.scElevation),radians(p.scElevation))*side;
 }else{
  x=clamp(rv[0],-radians(p.acTilt),radians(p.acTilt));
  y=clamp(rv[1],-radians(12),radians(12));
  z=clamp(side*rv[2],-radians(p.acUpwardRotation),radians(p.acUpwardRotation))*side;
 }
 const out=canonical(rotationVectorToQuat([x,y,z])),over=Math.max(Math.abs(requested[0]-x),Math.abs(requested[1]-y),Math.abs(requested[2]-z));
 runtime.frame.limitsEvaluated++;
 if(over>1e-7){runtime.frame.limitsEvaluated--;return record(runtime,jointId,'shoulder-girdle',over,n,out,{rotationVectorDeg:requested.map(degrees)});}
 return out;
}

function constrainFingerLocal(q,{type='mcp',side=1}={},runtime,jointId){
 const n=canonical(q),rv=quatToRotationVector(n),p=HUMAN_ROM_PROFILE_V08.fingers,requested=[...rv];
 let x=rv[0],y=rv[1],z=rv[2];
 if(type==='thumbCmc'){
  const cap=radians(p.thumbCmcSpherical),m=Math.hypot(x,y,z);if(m>cap){const k=cap/m;x*=k;y*=k;z*=k;}
 }else if(type==='thumbMcp'){
  x=clamp(x,-radians(p.thumbMcpFlexion),radians(10));y=clamp(y,-radians(8),radians(8));z=clamp(z,-radians(8),radians(8));
 }else if(type==='thumbIp'){
  x=clamp(x,-radians(p.thumbIpFlexion),radians(8));y=clamp(y,-radians(4),radians(4));z=clamp(z,-radians(4),radians(4));
 }else if(type==='mcp'){
  x=clamp(x,-radians(p.mcpFlexion),radians(p.mcpExtension));y=clamp(y,-radians(15),radians(15));z=clamp(z,-radians(15),radians(15));
 }else if(type==='pip'){
  x=clamp(x,-radians(p.pipFlexion),radians(p.pipExtension));y=clamp(y,-radians(4),radians(4));z=clamp(z,-radians(4),radians(4));
 }else if(type==='dip'){
  x=clamp(x,-radians(p.dipFlexion),radians(p.dipExtension));y=clamp(y,-radians(4),radians(4));z=clamp(z,-radians(4),radians(4));
 }else{
  const cap=radians(5),m=Math.hypot(x,y,z);if(m>cap){const k=cap/m;x*=k;y*=k;z*=k;}
 }
 const out=canonical(rotationVectorToQuat([x,y,z])),over=Math.max(Math.abs(requested[0]-x),Math.abs(requested[1]-y),Math.abs(requested[2]-z));
 runtime.frame.limitsEvaluated++;
 if(over>1e-7){runtime.frame.limitsEvaluated--;return record(runtime,jointId,'finger-'+type,over,n,out,{rotationVectorDeg:requested.map(degrees)});}
 return out;
}

function constrainToeDelta(q,{hallux=false,segment=0,metatarsal=false}={},runtime,jointId){
 const n=canonical(q),rv=quatToRotationVector(n),p=HUMAN_ROM_PROFILE_V08.toes,requested=[...rv];
 const flex=metatarsal?(hallux?p.halluxMtpFlexion:p.lesserMtpFlexion):p.ipFlexion;
 const extension=metatarsal?(hallux?p.halluxMtpExtension:p.lesserMtpExtension):p.ipExtension;
 const x=clamp(rv[0],-radians(flex),radians(extension)),y=clamp(rv[1],-radians(5),radians(5)),z=clamp(rv[2],-radians(5),radians(5));
 const out=canonical(rotationVectorToQuat([x,y,z])),over=Math.max(Math.abs(requested[0]-x),Math.abs(requested[1]-y),Math.abs(requested[2]-z));
 runtime.frame.limitsEvaluated++;
 if(over>1e-7){runtime.frame.limitsEvaluated--;return record(runtime,jointId,'toe-joint',over,n,out,{rotationVectorDeg:requested.map(degrees)});}
 return out;
}

function constrainJawLocal(q,runtime,jointId){
 const n=canonical(q),rv=quatToRotationVector(n),p=HUMAN_ROM_PROFILE_V08.jaw,requested=[...rv];
 const x=clamp(rv[0],0,radians(p.open)),y=clamp(rv[1],-radians(p.protrusionRotation),radians(p.protrusionRotation)),z=clamp(rv[2],-radians(p.lateral),radians(p.lateral));
 const out=canonical(rotationVectorToQuat([x,y,z])),over=Math.max(Math.abs(requested[0]-x),Math.abs(requested[1]-y),Math.abs(requested[2]-z));
 runtime.frame.limitsEvaluated++;
 if(over>1e-7){runtime.frame.limitsEvaluated--;return record(runtime,jointId,'jaw-hinge',over,n,out,{rotationVectorDeg:requested.map(degrees)});}
 return out;
}

function angularSpeedClass(jointId){
 if(jointId==='hips')return 'root';
 if(/^[LTC]\d+$/.test(jointId)||jointId==='head')return 'spine';
 if(jointId==='mandible')return 'jaw';
 if(/_(?:SC|AC)$/.test(jointId))return 'shoulderGirdle';
 if(/_upperArm$/.test(jointId))return 'shoulder';
 if(/_forearm$/.test(jointId))return 'elbow';
 if(/_radiusRotation$/.test(jointId))return 'forearm';
 if(/_hand$/.test(jointId))return 'wrist';
 if(/_femur$/.test(jointId))return 'hip';
 if(/_tibia$/.test(jointId))return 'knee';
 if(/_foot$/.test(jointId))return 'ankle';
 if(/_(?:finger|metacarpal)_/.test(jointId))return 'finger';
 if(/_(?:toe|metatarsal)_/.test(jointId))return 'toe';
 return 'other';
}

function applyAngularSpeedLimits(runtime,joints){
 if(!runtime.dt||!runtime.previous)return;
 for(const joint of joints){
  if(joint.id==='hips'||/_(femur|tibia|foot|patella|toe_|metatarsal_)/.test(joint.id))continue; // Support-chain IK must retain its planted foot.
  const previous=runtime.previous.get(joint.id);if(!previous)continue;
  const cls=angularSpeedClass(joint.id),maxStep=radians(HUMAN_ROM_PROFILE_V08.runtimeAngularSpeed[cls]||HUMAN_ROM_PROFILE_V08.runtimeAngularSpeed.other)*runtime.dt;
  const d=Math.abs(2*Math.acos(clamp(Math.abs(dot(canonical(previous),canonical(joint.q))),-1,1)));
  if(d>maxStep+1e-7){joint.q=qslerp(previous,joint.q,maxStep/d);runtime.frame.rateLimitCount++;runtime.totalRateLimitCount++;if(runtime.frame.clampedJoints.length<24)runtime.frame.clampedJoints.push({jointId:joint.id,kind:'angular-speed',requestedStepDeg:degrees(d),appliedStepDeg:degrees(maxStep)});}
 }
}

function auditConstraintProfile(human){
 const result={valid:true,hardViolations:[],checked:0,maxViolationDeg:0};
 const fail=(jointId,kind,violation)=>{const deg=degrees(violation);result.valid=false;result.maxViolationDeg=Math.max(result.maxViolationDeg,deg);if(result.hardViolations.length<32)result.hardViolations.push({jointId,kind,violationDeg:deg});};
 for(const side of ['left','right']){
  const s=side==='left'?-1:1,arm=human.arms[side],leg=human.legs[side];
  for(const [limb,kind] of [[arm,'arm'],[leg,'leg']]){
   const profile=kind==='arm'?HUMAN_ROM_PROFILE_V08.shoulder:HUMAN_ROM_PROFILE_V08.hip,q=canonical(limb.upper.q),d=norm(rotate(q,DOWN)),e=Math.acos(clamp(-d[1],-1,1)),az=Math.atan2(s*d[0],d[2]),allowed=cardinalEnvelope(az,profile),tw=Math.abs(swingTwist(q,DOWN).angle);result.checked+=2;if(e>allowed+1e-5)fail(limb.upper.id,kind+'-elevation',e-allowed);if(tw>radians(profile.axialTwist)+1e-5)fail(limb.upper.id,kind+'-twist',tw-radians(profile.axialTwist));
   const maxH=radians(kind==='arm'?HUMAN_ROM_PROFILE_V08.elbow.flexion:HUMAN_ROM_PROFILE_V08.knee.flexion),hinge=Math.abs(quatToRotationVector(limb.elbow.q)[0]);result.checked++;if(hinge>maxH+1e-5)fail(limb.elbow.id,kind+'-hinge',hinge-maxH);
  }
  const radial=Math.abs(twistAngle(arm.radial.q,DOWN));result.checked++;if(radial>radians(80)+1e-5)fail(arm.radial.id,'forearm-rotation',radial-radians(80));
  const wristBefore=runtimeFreeConstrainWrist(arm.wrist.q,s);result.checked++;if(wristBefore>1e-5)fail(arm.wrist.id,'wrist-envelope',wristBefore);
  const ankleBefore=runtimeFreeConstrainAnkle(leg.wrist.q,s);result.checked++;if(ankleBefore>1e-5)fail(leg.wrist.id,'ankle-envelope',ankleBefore);
 }
 for(const j of human.spine){const p=HUMAN_ROM_PROFILE_V08.spine[j.region],rv=quatToRotationVector(j.q),limits=[segmentLimit(p,'flexion'),segmentLimit(p,'axial'),segmentLimit(p,'lateral')];result.checked+=3;for(let k=0;k<3;k++)if(Math.abs(rv[k])>limits[k]+1e-5)fail(j.id,'spine-axis-'+k,Math.abs(rv[k])-limits[k]);}
 return result;
}

function runtimeFreeConstrainWrist(q,side){const n=canonical(q),st=swingTwist(n,DOWN),rv=quatToRotationVector(st.swing),p=HUMAN_ROM_PROFILE_V08.wrist;let x=rv[0],z=side*rv[2];const cx=clamp(x,-radians(p.flexion),radians(p.extension)),cz=clamp(z,-radians(p.ulnarDeviation),radians(p.radialDeviation)),coupled=coupledScale(cx,cz,radians(p.flexion),radians(p.extension),radians(p.ulnarDeviation),radians(p.radialDeviation));return Math.max(Math.abs(x-coupled.a),Math.abs(z-coupled.b),Math.max(0,Math.abs(st.angle)-radians(p.axialTwist)));}
function runtimeFreeConstrainAnkle(q,side){const rv=quatToRotationVector(canonical(q)),p=HUMAN_ROM_PROFILE_V08.ankle;let x=clamp(rv[0],-radians(p.dorsiflexion),radians(p.plantarflexion)),y=clamp(rv[1],-radians(p.axialRotation),radians(p.axialRotation)),z=clamp(side*rv[2],-radians(p.eversion),radians(p.inversion));const r=Math.sqrt((x/(x>=0?radians(p.plantarflexion):radians(p.dorsiflexion)))**2+(z/(z>=0?radians(p.inversion):radians(p.eversion)))**2+(y/radians(p.axialRotation))**2);if(r>1){x/=r;y/=r;z/=r;}return Math.max(Math.abs(rv[0]-x),Math.abs(rv[1]-y),Math.abs(side*rv[2]-z));}

function constraintDiagnostics(runtime,human){
 const audit=auditConstraintProfile(human);runtime.frame.hardViolations=audit.hardViolations.length;
 return {
  schema:HUMAN_ROM_PROFILE_V08.schema,
  profileVersion:HUMAN_ROM_PROFILE_V08.version,
  population:HUMAN_ROM_PROFILE_V08.population,
  hardLimitCompliance:audit.valid,
  checkedLimits:audit.checked,
  hardViolationCount:audit.hardViolations.length,
  maxHardViolationDeg:audit.maxViolationDeg,
  hardViolations:audit.hardViolations,
  frameClampCount:runtime.frame.clampCount,
  frameRateLimitCount:runtime.frame.rateLimitCount,
  frameMaxRequestedOvershootDeg:runtime.frame.maxOvershootDeg,
  frameClampedJoints:[...runtime.frame.clampedJoints],
  totalClampCount:runtime.totalClampCount,
  totalRateLimitCount:runtime.totalRateLimitCount,
  maxLifetimeRequestedOvershootDeg:runtime.maxLifetimeOvershootDeg,
  coupledConstraints:['shoulder/hip directional envelope','wrist flexion-deviation ellipse','ankle tri-axial ellipsoid','scapulohumeral shoulder-girdle contribution'],
  reverseKneeBlocked:true,
  reverseElbowBlocked:true,
  individualMedicalValidation:false
 };
}

function sideFromId(id){return String(id).startsWith('left_')?-1:String(id).startsWith('right_')?1:1;}
function finiteQuat(q){return Array.isArray(q)&&q.length===4&&q.every(Number.isFinite)?q:qi();}
function relativeToBind(joint,q){return canonical(qm(inv(joint.bindQ||qi()),finiteQuat(q)));}
function restoreBind(joint,delta){return canonical(qm(joint.bindQ||qi(),delta));}
function hingeLocal(q,kind,runtime,jointId){
 const rv=quatToRotationVector(canonical(q));
 const sign=limbFlexionSign(kind),value=sign*constrainHingeAngle(sign*rv[0],kind,runtime,jointId);
 const spill=Math.hypot(rv[1],rv[2]);
 if(spill>1e-7)record(runtime,jointId,kind==='arm'?'elbow-off-axis':'knee-off-axis',spill,q,qx(value),{offAxisDeg:degrees(spill)});
 return qx(value);
}

/**
 * Single low-level authority for all generated poses. Every command, basic
 * posture, locomotion step and manipulation target reaches this system through
 * Human.pose(). Bind lengths and hierarchy remain immutable.
 */
class HumanJointConstraintSystem{
 constructor(human){this.human=human;this.runtime=makeConstraintRuntime();this.lastSelection=[];}
 beginFrame(dt=null){beginConstraintFrame(this.runtime,this.human.joints,dt);this.lastSelection=[];}
 _project(joint,q,runtime=this.runtime){
  if(!joint)return qi();
  const id=joint.id,side=sideFromId(id),delta=relativeToBind(joint,q);
  if(id==='hips'||id==='sternum'||/_patella$/.test(id))return canonical(finiteQuat(q));
  if(/^[LT]\d+$/.test(id))return restoreBind(joint,constrainSpineLocal(delta,joint.region,runtime,id));
  if(/^C\d+$/.test(id)||id==='head')return restoreBind(joint,constrainSpineLocal(delta,'C',runtime,id));
  if(id==='mandible')return restoreBind(joint,constrainJawLocal(delta,runtime,id));
  if(/_SC$/.test(id))return restoreBind(joint,constrainShoulderGirdleLocal(delta,'sc',side,runtime,id));
  if(/_AC$/.test(id))return restoreBind(joint,constrainShoulderGirdleLocal(delta,'ac',side,runtime,id));
  if(/_upperArm$/.test(id))return restoreBind(joint,constrainBallJointLocal(delta,'arm',side,runtime,id));
  if(/_forearm$/.test(id))return restoreBind(joint,hingeLocal(delta,'arm',runtime,id));
  if(/_radiusRotation$/.test(id)){
   const angle=twistAngle(delta,[0,1,0]);return restoreBind(joint,qy(constrainForearmTwist(angle,runtime,id)));
  }
  if(/_hand$/.test(id))return restoreBind(joint,constrainWristLocal(delta,side,runtime,id));
  if(/_femur$/.test(id))return restoreBind(joint,constrainBallJointLocal(delta,'leg',side,runtime,id));
  if(/_tibia$/.test(id))return restoreBind(joint,hingeLocal(delta,'leg',runtime,id));
  if(/_foot$/.test(id))return restoreBind(joint,constrainAnkleLocal(delta,side,runtime,id));
  let m=id.match(/_(metacarpal)_(\d+)$/);
  if(m){const finger=Number(m[2]);return restoreBind(joint,constrainFingerLocal(delta,{type:finger===1?'thumbCmc':'structural',side},runtime,id));}
  m=id.match(/_finger_(\d+)_(\d+)$/);
  if(m){const finger=Number(m[1]),segment=Number(m[2]);const type=finger===1?(segment===1?'thumbMcp':'thumbIp'):(segment===1?'mcp':segment===2?'pip':'dip');return restoreBind(joint,constrainFingerLocal(delta,{type,side},runtime,id));}
  m=id.match(/_metatarsal_(\d+)$/);
  if(m)return restoreBind(joint,constrainToeDelta(delta,{hallux:Number(m[1])===1,metatarsal:false},runtime,id));
  m=id.match(/_toe_(\d+)_(\d+)$/);
  if(m)return restoreBind(joint,constrainToeDelta(delta,{hallux:Number(m[1])===1,metatarsal:Number(m[2])===1,segment:Number(m[2])-1},runtime,id));
  return canonical(finiteQuat(q));
 }
 limitCandidate(joint,q){return this._project(joint,q,this.runtime);}
 constrainJoint(joint){if(joint)joint.q=this.limitCandidate(joint,joint.q);return joint?.q;}
 _temporary(){return makeConstraintRuntime();}
 limitMotionCandidate(joint,q){
  const r=this.runtime,previous=r.previous?.get(joint.id);
  if(!r.dt||!previous||!/^.*_(upperArm|forearm|radiusRotation|hand)$/.test(joint.id))return q;
  const step=radians(HUMAN_ROM_PROFILE_V08.runtimeAngularSpeed[angularSpeedClass(joint.id)])*r.dt,d=qangle(previous,q);
  return d>step?this._project(joint,qslerp(previous,q,step/d),this._temporary()):q;
 }
 selectBendPlane(limb,target,pole,worldQ,effector=null,options={}){
  const A=limb.upper.world.p,D=sub(target,A),raw=len(D),maxReach=limb.L1+limb.L2-.00001;
  const maxH=radians(limb.kind==='arm'?HUMAN_ROM_PROFILE_V08.elbow.flexion:HUMAN_ROM_PROFILE_V08.knee.flexion);
  const minReach=Math.sqrt(Math.max(0,limb.L1**2+limb.L2**2+2*limb.L1*limb.L2*Math.cos(maxH)));
  const d=clamp(raw,minReach,maxReach),T=raw>1e-7?norm(D):rotate(limb.upper.parent.world.q,DOWN);
  let projection=sub(sub(pole,A),mul(T,dot(sub(pole,A),T)));
  if(len(projection)<1e-6)projection=cross(T,rotate(limb.upper.parent.world.q,[limb.s,0,0]));
  if(len(projection)<1e-6)projection=cross(T,[0,0,1]);
  const baseP=norm(projection),along=(limb.L1**2-limb.L2**2+d*d)/(2*Math.max(d,1e-7)),height=Math.sqrt(Math.max(0,limb.L1**2-along**2));
  const rawCos=(raw*raw-limb.L1**2-limb.L2**2)/(2*limb.L1*limb.L2),requiredHinge=Math.acos(clamp(rawCos,-1,1));
  const finalHinge=clamp(requiredHinge,0,maxH),parentQ=limb.upper.parent.world.q;
  const orientationWeight=Number.isFinite(options.orientationWeight)?options.orientationWeight:(limb.kind==='arm'?.18:.025);
  const continuityWeight=Number.isFinite(options.continuityWeight)?options.continuityWeight:(limb.kind==='arm'?.055:.025);
  const poleWeight=Number.isFinite(options.poleWeight)?options.poleWeight:(limb.kind==='leg'?.24:.10);
  const current={upper:canonical(limb.upper.q),hinge:canonical(limb.elbow.q),radial:canonical(limb.radial?.q||qi()),wrist:canonical(limb.wrist.q)};
  const evaluate=phi=>{
   const P=rotate(aa(T,phi),baseP),B=add(A,add(mul(T,along),mul(P,height))),C=add(A,mul(T,d)),U=norm(sub(B,A)),W=norm(sub(C,B));
   let X=cross(U,W);if(len(X)<1e-7)X=cross(U,P);if(len(X)<1e-7)X=cross(U,[0,0,1]);X=mul(norm(X),limbFlexionSign(limb.kind));
   const Y=mul(U,-1),Z=norm(cross(X,Y)),upperWorldRaw=qb(X,Y,Z),upperLocalRaw=canonical(qm(inv(parentQ),upperWorldRaw));
   const temp=this._temporary(),upperLocal=this.limitMotionCandidate(limb.upper,this._project(limb.upper,upperLocalRaw,temp)),upperWorld=canonical(qm(parentQ,upperLocal));
   const hingeRaw=qx(limbFlexionSign(limb.kind)*requiredHinge),hingeLocal=this.limitMotionCandidate(limb.elbow,this._project(limb.elbow,hingeRaw,temp)),elbowWorld=canonical(qm(upperWorld,hingeLocal));
   let radialLocal=qi(),radialWorld=elbowWorld,radialLocalRaw=qi();
   if(limb.radial){
    const rel=canonical(qm(inv(elbowWorld),worldQ)),rawTwist=twistAngle(rel,[0,1,0]);
    radialLocalRaw=qy(rawTwist);radialLocal=this.limitMotionCandidate(limb.radial,this._project(limb.radial,radialLocalRaw,temp));radialWorld=canonical(qm(elbowWorld,radialLocal));
   }
   const wristLocalRaw=canonical(qm(inv(radialWorld),worldQ)),wristLocal=this.limitMotionCandidate(limb.wrist,this._project(limb.wrist,wristLocalRaw,temp)),actualQ=canonical(qm(radialWorld,wristLocal));
   const actualWrist=add(A,add(rotate(upperWorld,[0,-limb.L1,0]),rotate(elbowWorld,[0,-limb.L2,0])));
   const actualEffector=effector?add(actualWrist,rotate(actualQ,effector.local)):actualWrist;
   const wantedEffector=effector?effector.target:target,positionError=len(sub(actualEffector,wantedEffector)),orientationError=qangle(actualQ,worldQ);
   const violation=Math.max(qangle(upperLocalRaw,upperLocal),qangle(hingeRaw,hingeLocal),qangle(radialLocalRaw,radialLocal),qangle(wristLocalRaw,wristLocal),Math.max(0,requiredHinge-maxH));
   const continuity=qangle(current.upper,upperLocal)+.55*qangle(current.hinge,hingeLocal)+.35*qangle(current.radial,radialLocal)+.20*qangle(current.wrist,wristLocal);
   const score=positionError*160+orientationError*orientationWeight+violation*.22+continuity*continuityWeight+Math.abs(phi)*poleWeight;
   return {score,upperLocal,hingeLocal,radialLocal,wristLocal,hinge:finalHinge,rawDistance:raw,phi,violation,positionError,orientationError,actualWrist,actualEffector,reachClamped:Math.abs(d-raw)>1e-7};
  };
  let best=null;const coarse=48,step=Math.PI*2/coarse;
  for(let i=0;i<coarse;i++){const phi=-Math.PI+i*step;if(limb.kind==='leg'&&Math.abs(phi)>Math.PI/3)continue;const candidate=evaluate(phi);if(!best||candidate.score<best.score)best=candidate;}
  let span=step;
  for(let pass=0;pass<4;pass++){
   span*=.5;
   for(const phi of [best.phi-span,best.phi-span*.5,best.phi+span*.5,best.phi+span]){if(limb.kind==='leg'&&Math.abs(phi)>Math.PI/3)continue;const candidate=evaluate(phi);if(candidate.score<best.score)best=candidate;}
  }
  this.lastSelection.push({jointId:limb.upper.id,kind:limb.kind,rawDistanceM:raw,reachClamped:best.reachClamped,bendPlaneRad:best.phi,positionErrorM:best.positionError,orientationErrorRad:best.orientationError,constraintPlaneViolationRad:best.violation});
  return best;
 }
 enforceAll(){
  // Eased targets do not guarantee continuous IK branch selection. Apply a
  // frame-time angular bound, then project back into anatomical envelopes.
  for(const j of this.human.joints)this.constrainJoint(j);
  applyAngularSpeedLimits(this.runtime,this.human.joints);
  for(const j of this.human.joints)this.constrainJoint(j);
 }
 audit(){
  const temp=this._temporary(),hardViolations=[];let checked=0,maxViolationDeg=0;
  for(const j of this.human.joints){if(j.id==='hips'||j.id==='sternum'||/_patella$/.test(j.id))continue;const projected=this._project(j,j.q,temp),difference=qangle(projected,j.q);checked++;if(difference>1e-5){const violationDeg=degrees(difference);maxViolationDeg=Math.max(maxViolationDeg,violationDeg);if(hardViolations.length<32)hardViolations.push({jointId:j.id,violationDeg});}}
  return {valid:hardViolations.length===0,checked,hardViolations,maxViolationDeg};
 }
 report(){
  const audit=this.audit();this.runtime.frame.hardViolations=audit.hardViolations.length;
  return {
   schema:HUMAN_ROM_PROFILE_V08.schema,profileId:HUMAN_ROM_PROFILE_V08.id,profileVersion:HUMAN_ROM_PROFILE_V08.version,population:HUMAN_ROM_PROFILE_V08.population,
   hardLimitCompliance:audit.valid,checkedLimits:audit.checked,hardViolationCount:audit.hardViolations.length,maxHardViolationDeg:audit.maxViolationDeg,hardViolations:audit.hardViolations,
   frameClampCount:this.runtime.frame.clampCount,frameRateLimitCount:this.runtime.frame.rateLimitCount,frameMaxRequestedOvershootDeg:this.runtime.frame.maxOvershootDeg,frameClampedJoints:[...this.runtime.frame.clampedJoints],
   totalClampCount:this.runtime.totalClampCount,totalRateLimitCount:this.runtime.totalRateLimitCount,maxLifetimeRequestedOvershootDeg:this.runtime.maxLifetimeOvershootDeg,
   coupledConstraints:['shoulder and hip directional envelopes','wrist flexion/deviation ellipse','ankle tri-axial ellipsoid','shoulder-girdle allocation','forearm rotation separated from wrist'],
   reverseKneeBlocked:true,reverseElbowBlocked:true,allPosePathsConstrained:true,individualMedicalValidation:false,lastLimbSelections:[...this.lastSelection]
  };
 }
}

const HUMAN_JOINT_CONSTRAINT_PROFILE=HUMAN_ROM_PROFILE_V08;

// MODULE mesh
function mesh(p,i,n=null){const positions=Float32Array.from(p),indices=Uint32Array.from(i);if(!n){n=new Float32Array(p.length);for(let t=0;t<i.length;t+=3){const a=i[t],b=i[t+1],c=i[t+2],N=cross(sub(p.slice(b*3,b*3+3),p.slice(a*3,a*3+3)),sub(p.slice(c*3,c*3+3),p.slice(a*3,a*3+3)));for(const k of[a,b,c])for(let q=0;q<3;q++)n[k*3+q]+=N[q]}for(let k=0;k<n.length;k+=3){const N=norm([...n.slice(k,k+3)]);n.set(N,k)}}return {p:positions,i:indices,n:Float32Array.from(n)}}
function combine(parts){const p=[],n=[],i=[];for(const g of parts){const o=p.length/3;p.push(...g.p);n.push(...g.n);for(const k of g.i)i.push(o+k)}return mesh(p,i,n)}
function transform(g,p=[0,0,0],q=[0,0,0,1]){const P=[],N=[];for(let k=0;k<g.p.length;k+=3){P.push(...add(p,rotate(q,[...g.p.slice(k,k+3)])));N.push(...rotate(q,[...g.n.slice(k,k+3)]))}return mesh(P,[...g.i],N)}
function ellipsoid(c,r,seg=22,rings=14){const p=[],n=[],i=[];for(let a=0;a<=rings;a++){const t=Math.PI*a/rings;for(let b=0;b<=seg;b++){const f=b/seg*Math.PI*2,v=[Math.sin(t)*Math.cos(f),Math.cos(t),Math.sin(t)*Math.sin(f)];p.push(...v.map((x,k)=>c[k]+r[k]*x));n.push(...norm(v.map((x,k)=>x/r[k])))}}for(let a=0;a<rings;a++)for(let b=0;b<seg;b++){const v=a*(seg+1)+b;i.push(v,v+1,v+seg+2,v,v+seg+2,v+seg+1)}return mesh(p,i,n)}
// Sweeps metric cross sections along an original analytic centerline.
function sweep(fn,radius,segments=36,sides=12,flatten=1){
 const p=[],n=[],indices=[],tangents=[];let previousX=null;
 for(let a=0;a<=segments;a++){
  const t=a/segments,center=fn(t),T=norm(sub(fn(Math.min(1,t+.0001)),fn(Math.max(0,t-.0001))));
  let X=previousX?sub(previousX,mul(T,dot(previousX,T))):cross(T,Math.abs(T[1])<.85?[0,1,0]:[0,0,1]);
  if(len(X)<1e-6)X=cross(T,Math.abs(T[1])<.85?[0,1,0]:[0,0,1]);
  X=norm(X);previousX=X;const Y=norm(cross(T,X)),r=typeof radius==='function'?radius(t):radius;tangents.push(T);
  for(let b=0;b<sides;b++){const theta=b/sides*Math.PI*2;
   p.push(...add(center,add(mul(X,r*Math.cos(theta)),mul(Y,r*flatten*Math.sin(theta)))));
  }
 }
 // Differentiate the actual swept surface, including radius change and curvature.
 const vertex=(a,b)=>p.slice((a*sides+(b+sides)%sides)*3,(a*sides+(b+sides)%sides)*3+3);
 for(let a=0;a<=segments;a++)for(let b=0;b<sides;b++){
  const along=sub(vertex(Math.min(segments,a+1),b),vertex(Math.max(0,a-1),b)),across=sub(vertex(a,b+1),vertex(a,b-1));
  n.push(...norm(cross(across,along)));
 }
 for(let a=0;a<segments;a++)for(let b=0;b<sides;b++){const v=a*sides+b,w=a*sides+(b+1)%sides;indices.push(v,w,w+sides,v,w+sides,v+sides);}
 for(const [a,reverse] of [[0,true],[segments,false]]){
  const center=p.length/3,N=mul(tangents[a],reverse?-1:1);p.push(...fn(a/segments));n.push(...N);
  // Separate cap rims keep end-face normals from changing the side contour.
  for(let b=0;b<sides;b++){p.push(...vertex(a,b));n.push(...N);}
  for(let b=0;b<sides;b++){const v=center+1+b,w=center+1+(b+1)%sides;reverse?indices.push(center,w,v):indices.push(center,v,w);}
 }
 return mesh(p,indices,n);
}
const tube=(a,b,r,segments=10,sides=12)=>sweep(t=>mix(a,b,t),typeof r==='number'?r:t=>r[0]+(r[1]-r[0])*t,segments,sides);
function boneRod(L,r=.009){return combine([sweep(t=>[0,-L*t,0],t=>r*(.72+.3*Math.exp(-(((t-.1)/.16)**2))+.42*Math.exp(-(((t-.91)/.12)**2))),18,12,.9),ellipsoid([0,-.005,0],[r*1.13,r*.95,r],12,8),ellipsoid([0,-L+.004,0],[r*1.15,r,r],12,8)])}
const smin=(a,b,k)=>{const h=clamp(.5+.5*(b-a)/k,0,1);return b+(a-b)*h-k*h*(1-h)};
function sdEll(p,c,r){const v=sub(p,c);return (Math.hypot(v[0]/r[0],v[1]/r[1],v[2]/r[2])-1)*Math.min(...r)}
function sdCaps(p,a,b,r1,r2=r1){const d=sub(b,a),t=clamp(dot(sub(p,a),d)/dot(d,d),0,1);return len(sub(p,mix(a,b,t)))-(r1+(r2-r1)*t)}
// Shared-edge marching tetrahedra; geometry is rebuilt from functions, never external arrays.
function fieldMesh(fn,bmin,bmax,counts=[36,64,36],{normalStepM=0}={}){
 const[nx,ny,nz]=counts,dx=(bmax[0]-bmin[0])/nx,dy=(bmax[1]-bmin[1])/ny,dz=(bmax[2]-bmin[2])/nz,sx=nx+1,sy=ny+1,sz=nz+1,N=sx*sy*sz,F=new Float32Array(N),at=(x,y,z)=>x+sx*(y+sy*z);
 for(let z=0;z<=nz;z++)for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++)F[at(x,y,z)]=fn([bmin[0]+x*dx,bmin[1]+y*dy,bmin[2]+z*dz]);
 const grad=new Float32Array(N*3);for(let z=0;z<=nz;z++)for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const id=at(x,y,z);grad[id*3]=(F[at(Math.min(nx,x+1),y,z)]-F[at(Math.max(0,x-1),y,z)])/((x===0||x===nx?1:2)*dx);grad[id*3+1]=(F[at(x,Math.min(ny,y+1),z)]-F[at(x,Math.max(0,y-1),z)])/((y===0||y===ny?1:2)*dy);grad[id*3+2]=(F[at(x,y,Math.min(nz,z+1))]-F[at(x,y,Math.max(0,z-1))])/((z===0||z===nz?1:2)*dz)}
 const P=[],G=[],I=[],cache=new Map(),corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],T=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 const pos=id=>{const x=id%sx,y=Math.floor(id/sx)%sy,z=Math.floor(id/(sx*sy));return[bmin[0]+x*dx,bmin[1]+y*dy,bmin[2]+z*dz]};
 const edge=(a,b)=>{
   if(a>b)[a,b]=[b,a];const key=a*N+b;if(cache.has(key))return cache.get(key);
   const t=F[a]/(F[a]-F[b]),id=P.length/3,p=mix(pos(a),pos(b),t);P.push(...p);
   // Skin normals follow the continuous field at the actual surface vertex.
   // Grid-edge interpolation alone can leave visible shading bands at profile changes.
   let normal=mix([...grad.slice(a*3,a*3+3)],[...grad.slice(b*3,b*3+3)],t);
   if(normalStepM>0){
     const direct=[0,1,2].map(k=>{const lo=[...p],hi=[...p];lo[k]-=normalStepM;hi[k]+=normalStepM;return (fn(hi)-fn(lo))/(2*normalStepM);});
     if(direct.every(Number.isFinite)&&len(direct)>1e-8)normal=direct;
   }
   G.push(...norm(normal));cache.set(key,id);return id;
 };
 const tri=(a,b,c)=>{const A=P.slice(a*3,a*3+3),B=P.slice(b*3,b*3+3),C=P.slice(c*3,c*3+3),n=add(G.slice(a*3,a*3+3),add(G.slice(b*3,b*3+3),G.slice(c*3,c*3+3)));if(dot(cross(sub(B,A),sub(C,A)),n)<0)I.push(a,c,b);else I.push(a,b,c)};
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const ids=corners.map(c=>at(x+c[0],y+c[1],z+c[2]));let inside=0;for(const id of ids)if(F[id]<0)inside++;if(inside===0||inside===8)continue;for(const t of T){const ins=[],out=[];for(const c of t)(F[ids[c]]<0?ins:out).push(ids[c]);if(ins.length===0||ins.length===4)continue;if(ins.length===1){tri(...out.map(b=>edge(ins[0],b)))}else if(ins.length===3){tri(...ins.map(a=>edge(a,out[0])))}else{const a=edge(ins[0],out[0]),b=edge(ins[0],out[1]),c=edge(ins[1],out[0]),d=edge(ins[1],out[1]);tri(a,b,c);tri(b,d,c)}}}
 return mesh(P,I,G)
}
function flatPlate(points,thickness=.005,bulge=.004){const p=[],i=[],center=mul(points.reduce((s,v)=>add(s,v),[0,0,0]),1/points.length);for(const sign of[-1,1]){p.push(...add(center,[0,0,sign*thickness/2+bulge]));for(const v of points)p.push(...add(v,[0,0,sign*thickness/2]));}const stride=points.length+1;for(let a=0;a<points.length;a++){const b=(a+1)%points.length;i.push(0,b+1,a+1,stride,stride+a+1,stride+b+1,a+1,b+1,stride+b+1,a+1,stride+b+1,stride+a+1)}return mesh(p,i)}
function box(w,h,d){const p=[],n=[],i=[];for(const[normal,A,B]of [[[1,0,0],[0,1,0],[0,0,1]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[0,0,1],[1,0,0]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[0,1,0],[1,0,0]]]){const o=p.length/3;for(const[a,b]of[[-1,-1],[1,-1],[1,1],[-1,1]]){p.push(...add(normal,add(mul(A,a),mul(B,b))).map((v,k)=>v*[w,h,d][k]/2));n.push(...normal)}i.push(o,o+1,o+2,o,o+2,o+3)}return mesh(p,i,n)}
function cylinder(r,h,n=36,top=r){const p=[],i=[];for(let y=0;y<2;y++)for(let s=0;s<n;s++){const a=s/n*Math.PI*2;p.push(Math.cos(a)*(y?top:r),(y-.5)*h,Math.sin(a)*(y?top:r))}p.push(0,-h/2,0,0,h/2,0);for(let s=0;s<n;s++){const t=(s+1)%n;i.push(s,t,t+n,s,t+n,s+n,2*n,t,s,2*n+1,s+n,t+n)}return mesh(p,i)}

// MODULE anatomy-detail
// All dimensions below are project-authored metric engineering reference values.
// Anatomy supplies the relationships, not an individual scan or a population fit.
// Assembled as literal numeric data; no network/model loader or runtime scaling.
// MODULE body archetypes
/*__SOURCE:body/BodyArchetypes.js__*/
// END MODULE body archetypes
/*__SOURCE:body/BodyPresets.js__*/
/*__SOURCE:body/AdultHumanSpec.js__*/const DETAIL_SPEC=Object.freeze({
 version:'skull-foot-reference@0.7.0',units:'m',forward:'+Z',up:'+Y',right:'+X',
 parameterStatus:'authored-adult-reference-not-measured-individual',
 skull:{vertexY:headBonePoint([0,.151,0])[1],chinY:headBonePoint([0,-.077,0])[1],orbitalCenters:[headBonePoint([-.031,.035,.080]),headBonePoint([.031,.035,.080])],
 orbitalRadii:[.022,.0195,.055].map((v,k)=>v*ADULT_SPEC.head.boneScale[k]),jawOrigin:headBonePoint([0,-.036,.028]),brow:ADULT_SPEC.head.browM,
 sourceIds:['S07','SF07_SKULL'],separateCranialBones:false},
 foot:{heelBottomY:-.074*ADULT_SPEC.foot.boneScale[1],firstMetatarsalShorterThanSecond:true,phalanges:[2,3,3,3,3],
 sourceIds:['S04','SF07_FOOT'],softTissueSole:false,subtalarMechanicsValidated:false}
});
const S=smin;
function E(p,c,r){const x=(p[0]-c[0])/r[0],y=(p[1]-c[1])/r[1],z=(p[2]-c[2])/r[2];return (Math.sqrt(x*x+y*y+z*z)-1)*Math.min(r[0],r[1],r[2])}
function C(p,a,b,r1,r2=r1){const x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y+(p[2]-a[2])*z)/(x*x+y*y+z*z)));return Math.hypot(p[0]-a[0]-x*t,p[1]-a[1]-y*t,p[2]-a[2]-z*t)-(r1+(r2-r1)*t)}
const sup=(p,c,r,k=3)=>{const x=Math.abs((p[0]-c[0])/r[0]),y=Math.abs((p[1]-c[1])/r[1]),z=Math.abs((p[2]-c[2])/r[2]);return (Math.pow(Math.pow(x,k)+Math.pow(y,k)+Math.pow(z,k),1/k)-1)*Math.min(r[0],r[1],r[2])};
function sweptEll(p,a,b,r){const x=(b[0]-a[0])/r[0],y=(b[1]-a[1])/r[1],z=(b[2]-a[2])/r[2],px=(p[0]-a[0])/r[0],py=(p[1]-a[1])/r[1],pz=(p[2]-a[2])/r[2],t=Math.max(0,Math.min(1,(px*x+py*y+pz*z)/(x*x+y*y+z*z)));return (Math.hypot(px-x*t,py-y*t,pz-z*t)-1)*Math.min(r[0],r[1],r[2])}
const cut=(a,b)=>Math.max(a,-b);

function skullFieldV07(p){
 // Low rounded calvaria, frontal plane, occipital volume and narrower temporal base.
 let d=E(p,[0,.070,-.018],[.073,.080,.091]);
 d=S(d,E(p,[0,.068,.036],[.059,.062,.042]),.007);
 d=S(d,E(p,[0,.049,-.052],[.064,.059,.052]),.008);
 d=S(d,E(p,[0,.004,-.008],[.051,.021,.057]),.007);
 // Midface buttresses, maxilla and original alveolar arch.
 d=S(d,E(p,[0,-.010,.052],[.038,.028,.027]),.006);
 for(const s of [-1,1]){
  d=S(d,E(p,[s*.021,.010,.055],[.025,.030,.027]),.006);
  d=S(d,E(p,[s*.058,.016,.043],[.013,.015,.018]),.006);
  d=S(d,E(p,[s*.057,.037,.042],[.010,.027,.017]),.005);
  d=S(d,sweptEll(p,[s*.010,.059,.064],[s*.050,.056,.057],[.008,.007,.013]),.004);
  // Zygomatic arch spans rearwards to the temporal root, separated from the ramus.
  d=S(d,C(p,[s*.059,.013,.039],[s*.071,.012,-.004],.0048,.0041),.004);
  d=S(d,C(p,[s*.071,.012,-.004],[s*.058,.014,-.032],.0041,.0052),.004);
  d=S(d,C(p,[s*.054,.002,-.044],[s*.053,-.021,-.038],.008,.0035),.005);
  // Mastoid process and ear canal have independent signs in the constructive field.
  d=cut(d,sweptEll(p,[s*.052,.006,-.028],[s*.088,.006,-.028],[.008,.006,.006]));
 }
 // The nasal bridge is distinct from the pear-shaped nasal aperture below it.
 d=S(d,E(p,[0,.037,.075],[.009,.023,.012]),.004);
 d=S(d,E(p,[0,.059,.062],[.011,.014,.015]),.005);
 // Hollow cranial vault, with a preserved bony floor above the orbits.
 const inner=Math.max(E(p,[0,.070,-.019],[.065,.073,.083]),p[2]>.007?.062-p[1]:-.005-p[1]);
 d=cut(d,inner);
 for(const s of [-1,1]){
  // Open anterior cavities extending into the face. No eyeball or dark insert mesh.
  const q=[p[0]-s*.031,p[1]-.035,p[2]-.080];
  const orbit=(Math.pow(Math.pow(Math.abs(q[0]/.022),2.45)+Math.pow(Math.abs(q[1]/.0195),2.45)+Math.pow(Math.abs(q[2]/.055),2.45),1/2.45)-1)*.0195;
  d=cut(d,orbit);
  d=cut(d,E(p,[s*.044,-.008,.001],[.017,.026,.024]));
  // Small, source-described infraorbital opening.
  d=cut(d,E(p,[s*.029,.002,.074],[.0028,.0023,.012]));
 }
 const nasal=S(E(p,[0,-.004,.082],[.012,.017,.037]),E(p,[0,.012,.083],[.0075,.019,.032]),.003);
 d=cut(d,nasal);
 // Foramen magnum through the posterior basal field.
 d=cut(d,sweptEll(p,[0,-.035,-.034],[0,.020,-.034],[.014,.010,.018]));
 // Nasal spine and thin septum; no painted cavity occlusion.
 d=S(d,C(p,[0,-.022,.071],[0,-.021,.087],.0032,.0018),.002);
 d=S(d,sup(p,[0,.001,.054],[.0012,.022,.010],3),.001);
 return d;
}

// Geometric ambient accessibility derived from the same constructive field.
// This adds depth shading to cavities without altering their geometry or painting holes.
function fieldAccessibility(g,field){
 const ao=new Float32Array(g.p.length/3);
 for(let k=0;k<ao.length;k++){
  const p=Array.from(g.p.subarray(k*3,k*3+3)),n=Array.from(g.n.subarray(k*3,k*3+3));
  let occlusion=0,weight=0;
  for(const r of [.005,.012,.024,.041]){const w=1/(1+r*28);occlusion+=Math.max(0,1-field(add(p,mul(n,r)))/r)*w;weight+=w;}
  const raw=clamp(1-occlusion/weight*1.35,.25,1),outer=clamp((p[1]-.060)/.025,0,1);ao[k]=raw+(1-raw)*outer;
 }
 g.ao=ao;return g;
}
function makeSkullV07(){return fieldAccessibility(fieldMesh(skullFieldV07,[-.090,-.043,-.114],[.090,.157,.108],[56,68,68]),skullFieldV07)}

function mandibleFieldV07(p){
 let d=1000;
 // Independent U-shaped body and broad ascending rami, not a thin jaw hoop.
 for(const s of [-1,1]){
  const path=[[0,-.062,.066],[s*.027,-.060,.059],[s*.047,-.050,.026],[s*.051,-.034,-.019]];
  for(let i=0;i<path.length-1;i++)d=S(d,sweptEll(p,path[i],path[i+1],[.008,.012,.008]),.004);
  d=S(d,sweptEll(p,[s*.051,-.035,-.019],[s*.052,.010,-.029],[.007,.010,.013]),.004);
  d=S(d,E(p,[s*.052,.016,-.032],[.010,.006,.007]),.003);
  d=S(d,sweptEll(p,[s*.047,-.012,-.012],[s*.042,.014,.002],[.005,.010,.006]),.003);
  d=cut(d,E(p,[s*.048,.017,-.013],[.014,.009,.008]));
  d=cut(d,E(p,[s*.027,-.056,.064],[.0023,.0022,.008]));
 }
 d=S(d,sup(p,[0,-.063,.068],[.017,.012,.008],2.8),.004);
 return d;
}
function makeMandibleV07(){const g=fieldMesh(mandibleFieldV07,[-.068,-.080,-.045],[.068,.025,.080],[52,44,50]);fieldAccessibility(g,mandibleFieldV07);remapBoneGeometry(g,ADULT_SPEC.head.boneScale,ADULT_SPEC.head.boneOffsetM);const out=transform(g,mul(DETAIL_SPEC.skull.jawOrigin,-1));out.ao=g.ao;return out;}
function makeToothV07(k,lower){
 const a=.065+(Math.PI-.130)*k/13,front=Math.sin(a),incisor=front>.90,canine=front>.72&&!incisor;
 const center=[.032*Math.cos(a),lower?-.043:-.034,.027+.045*Math.sin(a)];
 const r=[incisor?.0033:canine?.0032:.0041,lower?.0041:.0046,incisor?.0029:.0044];
 const fn=p=>sup(p,[0,0,0],r,3.5);
 const tooth=fieldMesh(fn,r.map(x=>-x*1.15),r.map(x=>x*1.15),[8,10,10]);
 remapBoneGeometry(tooth,ADULT_SPEC.head.boneScale);const mapped=headBonePoint(center);return transform(tooth,lower?sub(mapped,DETAIL_SPEC.skull.jawOrigin):mapped);
}

/*__SOURCE:body/FootSkeleton.js__*/function footLongBoneV07(L,r,terminal=false){
 const g=combine([
 sweep(t=>[0,-L*t,0],t=>r*(.72+.34*Math.exp(-((t/.20)**2))+.48*Math.exp(-(((t-.92)/.17)**2))),22,14,.8),
 ellipsoid([0,-.002,0],[r*1.18,r*.8,r*.95],16,10),
 ellipsoid([0,-L+.001,0],[r*(terminal?1.4:1.25),r*.83,r*(terminal?.66:1)],16,10)
 ]);return g;
}

// MODULE anatomy
// ANATOMY and all neutral landmarks come from AdultHumanSpec.
const e=sdEll,c=sdCaps,sm=smin;
/*__SOURCE:body/AnatomicalBones.js__*/
function makeFemur(side=1,L=ANATOMY.femurLength){
 const f=p=>{const t=clamp((-p[1]-.064)/(L-.105),0,1),cx=side*(.037*(1-t)+.002*t),cz=.012*Math.sin(Math.PI*t),rx=.012+.003*Math.cos(Math.PI*t)**2,rz=.013+.002*t;
 let d=(Math.hypot((p[0]-cx)/rx,(p[2]-cz)/rz)-1)*Math.min(rx,rz);d=Math.max(d,p[1]+.064,-L+.041-p[1]);
 d=sm(d,c(p,[side*.034,-.06,0],[side*.003,-L+.030,0],.012,.017),.009);
 d=sm(d,e(p,[side*.039,-.065,-.001],[.018,.033,.020]),.010);
 d=sm(d,c(p,[side*.007,-.009,0],[side*.042,-.048,-.004],.0125,.016),.006);
 d=sm(d,e(p,[0,0,0],[.0245,.0245,.0245]),.004);
 d=sm(d,e(p,[side*.054,-.035,-.005],[.017,.025,.021]),.007);
 d=sm(d,e(p,[side*.018,-.079,-.019],[.010,.014,.011]),.006);
 d=sm(d,e(p,[side*.016,-L+.012,-.004],[.024,.028,.030]),.005);
 d=sm(d,e(p,[-side*.020,-L+.010,-.002],[.022,.030,.032]),.005);
 d=sm(d,e(p,[0,-L+.045,.001],[.030,.041,.023]),.012);
 d=sm(d,e(p,[0,-L+.014,.020],[.028,.022,.014]),.006);
 const shaftRidge=c(p,[side*.027,-.11,-.013],[side*.005,-L+.08,-.015],.004,.005);d=sm(d,shaftRidge,.004);
 // Posterior intercondylar fossa and separate anterior patellar sulcus.
 d=Math.max(d,-e(p,[0,-L-.010,-.032],[.010,.034,.039]));
 d=Math.max(d,-e(p,[0,-L+.018,.038],[.007,.027,.011]));
 d=Math.max(d,-e(p,[-side*.014,.009,.018],[.006,.006,.005]));return d};
 return fieldMesh(f,[-.076,-L-.029,-.066],[.076,.031,.061],[40,132,36]);
}
function makeHumerus(side=1,L=ANATOMY.humerusLength){return fieldMesh(p=>{let d=c(p,[side*.012,-.035,0],[0,-L+.022,0],.012,.0095);d=sm(d,e(p,[-side*.003,0,0],[.023,.024,.023]),.009);d=sm(d,e(p,[side*.019,-.011,.004],[.015,.020,.016]),.007);d=sm(d,e(p,[side*.004,-L+.005,.003],[.026,.015,.018]),.008);d=sm(d,e(p,[-side*.014,-L+.003,.004],[.011,.013,.014]),.006);d=sm(d,e(p,[side*.016,-L+.008,.002],[.010,.012,.013]),.006);d=Math.max(d,-e(p,[0,-L+.032,-.012],[.010,.014,.009]));return d},[-.041,-L-.016,-.034],[.041,.03,.032],[30,88,26]);}
function makeShank(side=1,L=ANATOMY.tibiaLength){const tibia=fieldMesh(p=>{const t=clamp(-p[1]/L,0,1),r=.014-.004*Math.sin(Math.PI*t);let d=c(p,[0,-.028,0],[0,-L+.024,.003],r,r*.8);d=sm(d,e(p,[0,-.012,0],[.032,.017,.024]),.01);d=sm(d,e(p,[0,-.050,.015],[.014,.021,.010]),.006);d=sm(d,c(p,[0,-.08,.009],[0,-L+.045,.006],.007,.005),.004);d=sm(d,e(p,[-side*.009,-L+.010,.002],[.017,.020,.018]),.008);d=sm(d,e(p,[-side*.020,-L-.004,.004],[.008,.015,.009]),.004);return d},[-.039,-L-.022,-.031],[.039,.008,.037],[28,96,26]);
 const fib=combine([sweep(t=>[side*(.028-.007*t),-.026-t*(L-.008),-.008+Math.sin(t*Math.PI)*.003],t=>.005+.0025*Math.abs(2*t-1),40,12,.8),ellipsoid([side*.028,-.029,-.008],[.010,.014,.011],18,12),ellipsoid([side*.022,-L-.011,-.006],[.008,.020,.010],18,12)]);return[tibia,fib]}
function makeForearm(side=1,L=ANATOMY.forearmLength){const ulna=combine([sweep(t=>[side*(-.010+.001*t),-.005-t*(L-.01),-.004-Math.sin(Math.PI*t)*.003],t=>.0055+.003*(1-t),42,14,.9),sweep(t=>[side*-.01,-.012+.022*Math.sin(t*Math.PI),-.008-.017*Math.cos(t*Math.PI)],.007,20,12),ellipsoid([side*-.01,-L+.008,0],[.008,.009,.009],18,12)]);
 const radius=combine([sweep(t=>[side*(.010+.009*Math.sin(Math.PI*t)+.008*t),-.026-t*(L-.028),.004],t=>.0055+.004*t*t,42,14,.9),ellipsoid([side*.010,-.020,.003],[.009,.008,.009],18,10),ellipsoid([side*.019,-L+.012,.003],[.014,.017,.011],18,12)]);return[ulna,radius]}
function makeSkull(){return remapBoneGeometry(makeSkullV07(),ADULT_SPEC.head.boneScale,ADULT_SPEC.head.boneOffsetM)}
function vertebra(type){const r=type==='L'?.020:type==='T'?.015:.0115,h=type==='L'?.022:type==='T'?.017:.011;
 return combine([ellipsoid([0,0,.012],[r,h/2,r*.78],20,10),tube([-r*.65,0,.006],[-r*.72,0,-.011],.0035),tube([r*.65,0,.006],[r*.72,0,-.011],.0035),sweep(t=>[r*.78*Math.cos(Math.PI*t),0,-.010-r*.57*Math.sin(Math.PI*t)],.0035,20,10),tube([0,0,-.022],[0,type==='T'?-.013:-.004,-.045],type==='L'?[.006,.004]:[.004,.002]),tube([-r*.6,0,-.008],[-r*1.9,-.003,-.006],[.0045,.003]),tube([r*.6,0,-.008],[r*1.9,-.003,-.006],[.0045,.003])])}
/*__SOURCE:body/AxialSkeleton.js__*/const PALETTE={bone:[.82,.77,.63],joint:[.34,.57,.57],tooth:[.94,.91,.79]};
class Human{
 constructor(input=initialCharacterPreset()){const preset=validateCharacterPreset(input);if(preset.bodySex!==BODY_SEX)throw Error('本骨架模板与角色预设性别不一致');this.characterPreset=preset;this.strength=StrengthModel.fromSnapshot(preset.strength);this.lowerBodyShape={...preset.appearance.lowerBody};this.headNeckShape={...preset.appearance.headNeck};this.torsoShape={...preset.appearance.torso};this.shoulderShape={...preset.appearance.shoulder};this.handShape={...HAND_SHAPE_DEFAULT};this.proportionRevision=8;this.bodySex=BODY_SEX;this.joints=[];this.byId=new Map();this.bones=[];this.cartilage=[];this.records=[];this.root=this.joint('hips',null,[0,REST_HIP_HEIGHT,1.75]);this.rootHeight=REST_HIP_HEIGHT;this.spine=[];this.shoulders={};this.arms={};this.legs={};this.fingers=[];this.phase='idle';this.lastErrors=[];this.build();for(const j of this.joints)j.bindQ=[...j.q];this.constraints=new HumanJointConstraintSystem(this);this.fk();this.pose({});}
 joint(id,parent,p){if(this.byId.has(id))throw Error('Duplicate joint '+id);const j={id,parent:typeof parent==='string'?this.byId.get(parent):parent,p:[...p],q:qi(),world:frame(),bind:[...p]};this.joints.push(j);this.byId.set(id,j);return j}
 addBone(id,j,g,label=id,source=['S02'],status='parameterized-anatomical-approximation'){const b={id,joint:j,g,color:PALETTE.bone,label,source,status,visible:true};this.bones.push(b);this.records.push({id,label,jointId:j.id,source,status});return b}
 addCartilage(j,g){const m={joint:j,g,color:PALETTE.joint,visible:true};this.cartilage.push(m);return m}
 build(){
 this.axialPlan=axialSkeletonPlan();
 for(const s of[-1,1])this.addBone((s<0?'left':'right')+'_os_coxa',this.root,makeAnatomicalPelvis(s),s<0?'左髋骨':'右髋骨',['S03']);
 this.addCartilage(this.root,ellipsoid([0,-.062,.067],[.003,.016,.010],20,14));
 this.addBone('sacrum',this.root,fitSacrumToAxialInterface(this,makeAnatomicalSacrum()),'骶骨',['S05']);
 this.addBone('coccyx',this.root,sweep(t=>[0,-.016-.039*t,-.063+.017*t*t],t=>.0065*(1-.77*t),24,14),'尾骨',['S05']);
 let prev=this.root,prevY=0,prevZ=0;
 const sequence=SPINE_STATIONS;
 for(const[type,num,y]of sequence){const z=spineStationZ(type,y),record=this.axialPlan.find(r=>r.id===type+num);
 const j=this.joint(type+num,prev,[0,y-prevY,z-prevZ]);j.region=type;this.spine.push(j);
 this.addBone(type+num,j,makeAxialVertebra(record),({C:'颈椎',T:'胸椎',L:'腰椎'})[type]+num,['S05']);prev=j;prevY=y;prevZ=z;}
 installAxialDiscs(this);
 const skull=this.joint('head',prev,[0,ADULT_RIG.headAboveAtlasM,ADULT_RIG.headForwardOfAtlasM]);this.addBone('craniofacial_composite',skull,makeSkull(),'颅面复合骨体',['S07'],'composite-cranial-bones-not-individually-separated');
 const jaw=this.joint('mandible',skull,DETAIL_SPEC.skull.jawOrigin);this.addBone('mandible',jaw,makeMandibleV07(),'下颌骨',['S07','SF07_SKULL']);
 for(let row=0;row<2;row++)for(let k=0;k<14;k++)this.cartilage.push({joint:row?jaw:skull,g:makeToothV07(k,!!row),color:PALETTE.tooth,kind:'tooth',visible:true});
 const sternum=this.joint('sternum',this.byId.get('T3'),ADULT_RIG.sternumOffsetM);this.addBone('sternum',sternum,makeAnatomicalSternum(),'胸骨',['S06']);
 const restOrigin=j=>{let p=[0,0,0];for(let n=j;n;n=n.parent)p=add(p,n.bind);return p;},sternumOrigin=restOrigin(sternum),costalArch=new Map();
 for(let rib=1;rib<=12;rib++)for(const s of[-1,1]){
   const j=this.byId.get('T'+rib),shape=anatomicalRib(rib,s);
   this.addBone(`${s<0?'left':'right'}_rib_${rib}`,j,shape.geometry,`${s<0?'左':'右'}第${rib}肋骨`,['S06']);
   if(rib<=10){const tip=shape.path(1),origin=restOrigin(j);
     // True ribs meet the sternum; 8–10 join the preceding costal cartilage.
     const targetWorld=rib<=7?add(sternumOrigin,[s*.012,.107-(rib-1)*.025,.006]):costalArch.get(s)(.42);
     const target=sub(targetWorld,origin);
     const via=mix(tip,target,.5);via[2]+=.006;
     this.addCartilage(j,sweep(t=>boneCurve(tip,via,target,t),.0028,24,12,1.5));
     this.cartilage.at(-1).anatomyRegion='costal';
     costalArch.set(s,t=>add(origin,boneCurve(tip,via,target,t)));
   }
 }
 for(const s of[-1,1]){const side=s<0?'left':'right',txt=s<0?'左':'右';
 const sc=this.joint(side+'_SC',this.byId.get('T1'),mirrorBodyPoint(ADULT_RIG.scOffsetM,s));const ac=this.joint(side+'_AC',sc,mirrorBodyPoint(ADULT_RIG.clavicleVectorM,s));this.shoulders[side]={sc,ac};
 this.addBone(side+'_clavicle',sc,sweep(t=>[s*ADULT_RIG.clavicleVectorM[0]*t,ADULT_RIG.clavicleVectorM[1]*t+.003*Math.sin(Math.PI*t),ADULT_RIG.clavicleVectorM[2]*t+.008*Math.sin(t*2*Math.PI)],t=>.0055+.002*Math.cos(t*2*Math.PI)**2,40,14),txt+'锁骨',['S01']);
 this.addBone(side+'_scapula',ac,makeAnatomicalScapula(s),txt+'肩胛骨',['S01']);
 const upper=this.joint(side+'_upperArm',ac,mirrorBodyPoint(ADULT_RIG.shoulderOffsetM,s)),elbow=this.joint(side+'_forearm',upper,[0,-ANATOMY.humerusLength,0]),radial=this.joint(side+'_radiusRotation',elbow,[0,0,0]),wrist=this.joint(side+'_hand',radial,[0,-ANATOMY.forearmLength,0]);
 this.addBone(side+'_humerus',upper,makeHumerus(s),txt+'肱骨',['S02']);const[ulna,radius]=makeForearm(s);this.addBone(side+'_ulna',elbow,ulna,txt+'尺骨',['S02']);this.addBone(side+'_radius',radial,radius,txt+'桡骨',['S02']);
 this.arms[side]={kind:'arm',upper,elbow,wrist,radial,s,L1:ANATOMY.humerusLength,L2:ANATOMY.forearmLength};this.buildHand(side,wrist,s,txt);
 const hip=this.joint(side+'_femur',this.root,[s*ANATOMY.hipSpacing/2,0,0]),knee=this.joint(side+'_tibia',hip,[0,-ANATOMY.femurLength,0]),ankle=this.joint(side+'_foot',knee,[0,-ANATOMY.tibiaLength,0]);
 this.addBone(side+'_femur',hip,makeFemur(s),txt+'股骨',['S04']);const[tibia,fibula]=makeShank(s);this.addBone(side+'_tibia',knee,tibia,txt+'胫骨',['S04']);this.addBone(side+'_fibula',knee,fibula,txt+'腓骨',['S04']);const patella=this.joint(side+'_patella',hip,[0,-ANATOMY.femurLength+.012,.038]);this.addBone(side+'_patella',patella,ellipsoid([0,0,0],[.019,.024,.010],26,18),txt+'髌骨',['S04']);this.legs[side]={kind:'leg',upper:hip,elbow:knee,wrist:ankle,patella,s,L1:ANATOMY.femurLength,L2:ANATOMY.tibiaLength};this.buildFoot(side,ankle,s,txt);
 }
 this.bindLengths=this.joints.filter(j=>j.parent).map(j=>({id:j.id,length:len(j.p)}));this.evidence={boneElements:this.bones.length,kinematicNodes:this.joints.length,geometryHash:this.geometryHash(),externalMeshCount:0,runtimeBoneScaleCount:0,anatomicalValidation:false};
 }
 buildHand(side,j,s,txt){const names=['scaphoid','lunate','triquetrum','pisiform','trapezium','trapezoid','capitate','hamate'];for(let k=0;k<8;k++){this.addBone(side+'_'+names[k],j,makeAnatomicalCarpal(k,s),txt+['舟骨','月骨','三角骨','豌豆骨','大多角骨','小多角骨','头状骨','钩骨'][k],['S02'])}
 for(let f=0;f<5;f++){const hd=handRigDimensions(this,f,s),thumb=f===0,mcL=hd.mcLength,mc=this.joint(`${side}_metacarpal_${f+1}`,j,hd.base);if(thumb)mc.q=handThumbCMC(s);this.addBone(`${side}_metacarpal_${f+1}`,mc,boneRod(mcL,thumb?.006:.0045),txt+`第${f+1}掌骨`,['S02']);let parent=mc,pL=mcL;const ph=[];for(let k=0;k<(thumb?2:3);k++){const L=hd.phLengths[k];const kn=this.joint(`${side}_finger_${f+1}_${k+1}`,parent,[0,-pL,0]);this.addBone(kn.id,kn,boneRod(L,thumb?.0048:.0038-(k*.0004)),txt+`第${f+1}指第${k+1}节`,['S02']);kn.segmentLength=L;ph.push(kn);parent=kn;pL=L}this.fingers.push({side,f,mc,ph,thumb})}}
 buildFoot(side,j,s,txt){
  const labels={talus:'距骨',calcaneus:'跟骨',navicular:'足舟骨',cuboid:'骰骨',medial_cuneiform:'内侧楔骨',intermediate_cuneiform:'中间楔骨',lateral_cuneiform:'外侧楔骨'};
  for(const part of footBoneFieldsV07(s))this.addBone(side+'_'+part.id,j,remapBoneGeometry(fieldMesh(part.field,part.lo,part.hi,[32,34,40]),ADULT_SPEC.foot.boneScale),txt+labels[part.id],['S04','SF07_FOOT']);
  const rays=footRaysV07(s);this.legs[side].footRays=[];
  rays.forEach((ray,f)=>{
   const L=len(sub(ray.head,ray.base)),mc=this.joint(`${side}_metatarsal_${f+1}`,j,ray.base);
   mc.q=fromTo([0,-1,0],sub(ray.head,ray.base));this.addBone(mc.id,mc,footLongBoneV07(L,ray.radius),txt+`第${f+1}跖骨`,['S04','SF07_FOOT']);
   let parent=mc,prevL=L,previousQ=mc.q;const toes=[];
   for(let k=0;k<ray.phalanges.length;k++){
    const len=ray.phalanges[k],t=this.joint(`${side}_toe_${f+1}_${k+1}`,parent,[0,-prevL,0]);
    const desired=fromTo([0,-1,0],ray.toeDirection);t.q=qm(inv(previousQ),desired);
    this.addBone(t.id,t,footLongBoneV07(len,f===0?.0054-k*.0007:.0038-k*.0004,k===ray.phalanges.length-1),txt+`第${f+1}趾第${k+1}节`,['S04','SF07_FOOT']);
    parent=t;prevL=len;previousQ=desired;toes.push(t);
   }
   this.legs[side].footRays.push({mc,toes,metatarsalLength:L,tipLength:prevL,base:ray.base,head:ray.head});
  });
 }
 fk(){for(const j of this.joints)j.world=j.parent?compose(j.parent.world,frame(j.p,j.q)):frame(j.p,j.q)}
 world(id){return this.byId.get(id).world}
 geometryHash(){let value='';for(const b of this.bones)value+=b.id+':'+hashFloats(b.g.p)+';';let h=2166136261;for(const c of value){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
 setWorldQ(j,q){j.q=j.parent?qm(inv(j.parent.world.q),q):q}
 solveLimb(limb,target,pole,worldQ,effector=null,options={}){
  const update=j=>{j.world=compose(j.parent.world,frame(j.p,j.q))};
  worldQ=qnorm(worldQ||qi());
  const selected=this.constraints.selectBendPlane(limb,target,pole,worldQ,effector,options);
  limb.upper.q=selected.upperLocal;update(limb.upper);
  limb.elbow.q=selected.hingeLocal;update(limb.elbow);
  if(limb.radial){limb.radial.q=selected.radialLocal||qi();update(limb.radial);limb.twistAngle=2*Math.atan2(limb.radial.q[1],limb.radial.q[3]);}
  limb.wrist.q=selected.wristLocal;update(limb.wrist);
  if(limb.patella){const a=selected.hinge;limb.patella.p=[0,-limb.L1+.012-.010*Math.sin(a*.8),.038-.009*(1-Math.cos(a))];limb.patella.q=qx(a*.26);this.constraints.constrainJoint(limb.patella);update(limb.patella)}
  const actualEffector=effector?add(limb.wrist.world.p,rotate(limb.wrist.world.q,effector.local)):limb.wrist.world.p;
  return{id:limb.wrist.id,error:len(sub(actualEffector,effector?effector.target:target)),orientationErrorRad:qangle(limb.wrist.world.q,worldQ),hinge:selected.hinge,rawDistance:selected.rawDistance,bendPlaneRad:selected.phi,constraintPlaneViolation:selected.violation,target:[...(effector?effector.target:target)],effectorLocal:effector?[...effector.local]:[0,0,0],targetOrientation:[...worldQ]};
 }

 palm(side){const arm=this.arms[side];return compose(arm.wrist.world,frame(SKIN_CONTACT_PALM))}
 // All effectors share the existing fixed-length hierarchy. No geometry changes.
 pose({position=null,yaw=0,crouch=0,lean=0,feet=null,hands=null,curl=0,wave=0,time=0,walk=0,
       rootRotation=null,spineRotations=null,legPoles=null,armPoles=null,
       gaitSignal=0,gaitBlend=0,locomotion=null,gesture=null,floorMode=false,deltaTime=null}={}) {
  this.constraints.beginFrame(deltaTime);
  if(position)this.root.p=[...position];
  const base=qy(yaw),signal=clamp(gaitSignal,-1,1)*clamp(gaitBlend,0,1);
  const motion=!floorMode&&!hands&&!gesture&&!wave?locomotion:null;
  this.root.q=rootRotation?[...rootRotation]:qm(base,qm(qy(motion?.pelvisYaw||0),qm(qz((motion?.pelvisRoll||0)+(motion?.idleRoll||0)),qx(lean*.50+(motion?.lean||0)))));
  this.phase=gesture||wave?'gesture':floorMode?'floor':hands?'manipulation':walk?'locomotion':'idle';
  for(const j of this.spine){
   const a=j.region==='L'?lean*.07:j.region==='T'?lean*.0125:0;
   const breathe=!floorMode&&j.region==='T'?Math.sin(time*1.5)*.0006:0;
   const regionCount=this.spine.filter(k=>k.region===j.region).length||1;
   const counterYaw=motion?(j.region==='L'?-.45:j.region==='T'?-1.05: .15)*(motion.pelvisYaw||0)/regionCount:0;
   const counterRoll=motion&&j.region==='T'?-(motion.pelvisRoll+motion.idleRoll)*.85/regionCount:0;
   const look=motion&&j.region==='C'?((motion.idleYaw||0)+(motion.lookYaw||0))/regionCount:0;
   j.q=spineRotations?.[j.id]?[...spineRotations[j.id]]:qm(qy(counterYaw+look+(j.region==='T'?signal*.002:0)),qm(qz(counterRoll),qx(a+breathe)));
  }
  const g=gesture||(wave?{type:'greet',weight:wave,clock:time}:null),gw=clamp(g?.weight||0,0,1);
  if(g?.type==='greet')this.byId.get('C1').q=qm(this.byId.get('C1').q,qx(.045*gw*Math.sin(Math.PI*clamp((g.clock||0)/1.2,0,1))));
  // Neutral shoulder frames first, then one deterministic shoulder-girdle update.
  for(const side of ['left','right']){this.shoulders[side].sc.q=qi();this.shoulders[side].ac.q=qi()}
  this.fk();
  for(const side of ['left','right']){
   const arm=this.arms[side],sh=this.shoulders[side],s=arm.s;
   let raising=gw&&side==='right'?(g.type==='salute'?.75:.88)*gw:0;
   if(hands?.[side]){const d=rotate(inv(this.root.q),sub(hands[side].p,arm.upper.world.p));raising=Math.max(raising,clamp(Math.atan2(Math.hypot(d[0],d[2]),-d[1])/2.3,0,1))}
   sh.sc.q=qm(qz(s*raising*.14),qy(-s*raising*.08));sh.ac.q=qm(qz(s*raising*.17),qx(-raising*.06));
  }
  for(const f of this.fingers){
   const c=typeof curl==='object'?curl[f.side]||0:curl,straight=f.side==='right'?gw:0;
   const normal=f.thumb?handThumbCMC(this.arms[f.side].s,c*.72):qi();
   const tidy=f.thumb?qz(this.arms[f.side].s*(g?.type==='salute'?.08:.4)):qi();
   f.mc.q=qslerp(normal,tidy,straight);
   for(let k=0;k<f.ph.length;k++){
     const rest=f.thumb?[.13,.16][k]:[[.16,.23,.12],[.19,.29,.15],[.24,.34,.18],[.29,.40,.22]][f.f-1][k];
     const bend=(rest*(1-clamp(c,0,1))+c*(k===0?.72:k===1?1.18:.80))*(1-straight);
     const spread=!f.thumb&&k===0?[.020,0,-.013,-.026][f.f-1]*(1-clamp(c,0,1))*(1-straight):0;
     f.ph[k].q=qm(qz(this.arms[f.side].s*spread),qx(-bend));
   }
  }
  for(const j of this.spine)this.constraints.constrainJoint(j);
  this.constraints.constrainJoint(this.byId.get('head'));this.constraints.constrainJoint(this.byId.get('mandible'));
  for(const side of ['left','right']){this.constraints.constrainJoint(this.shoulders[side].sc);this.constraints.constrainJoint(this.shoulders[side].ac)}
  for(const f of this.fingers){this.constraints.constrainJoint(f.mc);for(const j of f.ph)this.constraints.constrainJoint(j)}
  this.fk();const root=this.root.p,forward=rotate(base,[0,0,1]),errs=[];
  for(const side of ['left','right']){
   const leg=this.legs[side],ankle=feet?.[side]||{p:add(root,rotate(base,[leg.s*ADULT_STANCE.footHalfSpacingM,-root[1]+SKIN_SOLE_HEIGHT,ADULT_STANCE.ankleForwardM])),yaw};
   const pole=legPoles?.[side]||add(root,add(mul(forward,.9),rotate(base,[leg.s*ANATOMY.hipSpacing/2,-.35,0])));
   errs.push(this.solveLimb(leg,ankle.p,pole,ankle.q||qy(ankle.yaw??yaw)));
  }
  this.gestureTarget=null;
  for(const side of ['left','right']){
   const arm=this.arms[side],s=arm.s;
   // Opposite-side arm/leg coordination, with soft elbow flexion. Amplitudes
   // are engineering controls. Real measured speed fades the swing in/out.
   const armSignal=motion?motion.armSignal*clamp(gaitBlend,0,1):signal;
   const angle=s*armSignal*.34,bend=radians(ADULT_STANCE.elbowFlexionDeg)+clamp(gaitBlend,0,1)*.045+Math.max(0,s*armSignal)*.065;
   const upperQ=qm(qz(s*radians(ADULT_STANCE.armAbductionDeg)),qx(-angle));
   const foreQ=qm(upperQ,qx(ADULT_RIG.elbowFlexionSign*bend));
   const U=rotate(upperQ,[0,-arm.L1,0]),W=rotate(foreQ,[0,-arm.L2,0]);
   let desired=add(arm.upper.world.p,rotate(base,add(U,W)));
   let Q=qm(base,qm(foreQ,qy(-s*radians(ADULT_STANCE.palmTurnDeg))));
   let pole=add(arm.upper.world.p,rotate(base,U));
   if(hands?.[side]){Q=hands[side].q;desired=sub(hands[side].p,rotate(Q,SKIN_CONTACT_PALM));pole=armPoles?.[side]||add(arm.upper.world.p,rotate(base,[s*.30,-.36,-.18]))}
   if(gw>0&&side==='right'){
    let target,targetQ,targetPole;
    if(g.type==='salute'){
     const brow=add(this.world('head').p,rotate(this.world('head').q,DETAIL_SPEC.skull.brow));
     // Solve the fingertip-to-brow triangle with an approximately horizontal
     // upper arm. The hand continues the forearm instead of bending sideways.
     const A=arm.upper.world.p,D=sub(brow,A),H=[D[0],0,D[2]],hd=Math.max(.001,len(H)),T=mul(H,1/hd);
     const effectiveLower=arm.L2+ADULT_SPEC.hand.carpalOffsetM+ADULT_SPEC.hand.metacarpalLengthM[1]+ADULT_SPEC.hand.phalangesM[1].reduce((a,b)=>a+b,0),along=(arm.L1**2-(effectiveLower**2-D[1]**2)+hd**2)/(2*hd);
     const u=clamp(along,-arm.L1*.95,arm.L1*.95),v=Math.sqrt(Math.max(0,arm.L1**2-u*u));
     const E=add(A,add(mul(T,u),mul(norm(cross([0,1,0],T)),v)));
     const Y=mul(norm(sub(brow,E)),-1),Z0=rotate(base,[0,-1,.12]),X=norm(cross(Y,Z0)),Z=norm(cross(X,Y));
     targetQ=qb(X,Y,Z);
     const indexTip=[ADULT_SPEC.hand.metacarpalXM[1],-(effectiveLower-arm.L2),0];
     target=sub(brow,rotate(targetQ,indexTip));targetPole=E;
     this.gestureTarget={type:'salute',brow,indexTipLocal:indexTip,horizontalElbowTarget:E};
    }else{
     const swing=Math.sin((g.clock||0)*5.2);
     target=add(arm.upper.world.p,rotate(base,[.19+.022*swing,.16,.16]));
     targetQ=qm(base,qm(qz(Math.PI+.12*swing),qx(-.10)));
     targetPole=add(arm.upper.world.p,rotate(base,[.255,-.10,.12]));
     this.gestureTarget={type:'greet',wrist:target};
    }
    desired=mix(desired,target,gw);if(g.type==='salute')desired=add(desired,rotate(base,[.18*Math.sin(Math.PI*gw),0,.08*Math.sin(Math.PI*gw)]));Q=qslerp(Q,targetQ,gw);pole=mix(pole,targetPole,gw);
   }
   // Gesture targets override captured resting hands. The same interpolated goal
   // must drive both IK construction and candidate scoring, including transitions.
   const gestureOwnsArm=gw>0&&side==='right';
   const gestureTip=gestureOwnsArm&&g.type==='salute'?this.gestureTarget?.indexTipLocal:null;
   const effector=gestureTip?{target:add(desired,rotate(Q,gestureTip)),local:gestureTip}:
     gestureOwnsArm?null:hands?.[side]?{target:hands[side].p,local:SKIN_CONTACT_PALM}:null;
   if(gestureOwnsArm&&g.armPath){
    // A feasible endpoint defines a continuous joint-space salute trajectory.
    // Re-solving each intermediate Cartesian target selected opposite IK branches.
    const chain=[arm.upper,arm.elbow,arm.radial,arm.wrist];let goalFrame=arm.upper.parent.world;
    chain.forEach((joint,k)=>{const raw=qslerp(g.armPath.from[k],g.armPath.to[k],gw);goalFrame=compose(goalFrame,frame(joint.p,raw));joint.q=this.constraints.limitCandidate(joint,raw);});
    this.fk();const local=gestureTip||[0,0,0],goal=point(goalFrame,local),actual=point(arm.wrist.world,local);
    errs.push({id:arm.wrist.id,error:dist(actual,goal),orientationErrorRad:qangle(arm.wrist.world.q,goalFrame.q),target:goal,effectorLocal:local,targetOrientation:goalFrame.q});
    continue;
   }
   errs.push(this.solveLimb(arm,desired,pole,Q,effector,gestureOwnsArm?{poleWeight:.20,continuityWeight:.085,orientationWeight:1.2}:{}));
  }
  this.constraints.enforceAll();this.fk();
  this.lastErrors=errs;this.refreshEffectorErrors();return errs;
 }
 refreshEffectorErrors(){
  for(const error of this.lastErrors){
   const j=this.byId.get(error.id);if(!j)continue;
   const actual=add(j.world.p,rotate(j.world.q,error.effectorLocal||[0,0,0]));
   error.error=dist(actual,error.target);if(error.targetOrientation)error.orientationErrorRad=qangle(j.world.q,error.targetOrientation);
  }
 }
 // Tight world-space vertex clearance for the floor-pose solver. Reads geometry
 // and final transforms only. No bounding-box corner inflation or bone scaling.
 minimumBoneY(){let min=Infinity,id=null;for(const b of this.bones){const q=b.joint.world.q,[x,y,z,w]=q;
   const a=2*(x*y+z*w),c=1-2*(x*x+z*z),d=2*(y*z-x*w),py=b.joint.world.p[1],v=b.g.p;
   for(let k=0;k<v.length;k+=3){const yy=py+a*v[k]+c*v[k+1]+d*v[k+2];if(yy<min){min=yy;id=b.id}}
  }const soft=this.tissue?.minimumSupportY();return soft&&soft.y<min?soft:{y:min,boneId:id}}
  diagnostics(){let max=0;for(const b of this.bindLengths){if(/_patella$/.test(b.id))continue;const j=this.byId.get(b.id);max=Math.max(max,Math.abs(len(sub(j.world.p,j.parent.world.p))-b.length))}return{...this.evidence,maxBoneLengthErrorM:max,maxEffectorErrorM:Math.max(0,...this.lastErrors.map(e=>e.error)),maxFootTargetErrorM:Math.max(0,...this.lastErrors.filter(e=>/_foot$/.test(e.id)).map(e=>e.error)),maxHandTargetErrorM:Math.max(0,...this.lastErrors.filter(e=>/_hand$/.test(e.id)).map(e=>e.error)),maxOrientationErrorRad:Math.max(0,...this.lastErrors.map(e=>e.orientationErrorRad||0)),root:[...this.root.p],jointAngles:this.lastErrors.map(e=>({id:e.id,hingeRad:e.hinge,bendPlaneRad:e.bendPlaneRad})),poseAuthority:'Human.finalPose',jointAxisValidation:'hard-research-grounded-rom-v08',jointConstraints:this.constraints.report(),constraintProfile:HUMAN_JOINT_CONSTRAINT_PROFILE.id,fullMuscleDynamics:false,tissue:this.tissue?.report()||null}}
}

/*__SOURCE:body/AnatomicalEnvelope.js__*/
/*__SOURCE:body/MuscleSheets.js__*/
/*__SOURCE:body/FaceDetails.js__*/
/*__SOURCE:body/HandForearm.js__*/
/*__SOURCE:body/ShoulderSurface.js__*/
/*__SOURCE:body/AxialEnvelope.js__*//*__SOURCE:body/ShoulderLayers.js__*//*__SOURCE:body/BackSurface.js__*/
/*__SOURCE:body/TorsoSurface.js__*/
/*__SOURCE:body/HeadNeckSurface.js__*/
/*__SOURCE:body/LowerBodyPlan.js__*/
/*__SOURCE:body/LowerLimbSurface.js__*/
/*__SOURCE:body/ProceduralSystems.js__*/
/*__SOURCE:body/WholeBodySurface.js__*/
/*__SOURCE:body/SkinLayers.js__*/
/*__SOURCE:body/HumanBiology.js__*/
/*__SOURCE:body/BodyComposition.js__*/
/*__SOURCE:body/CharacterMorphs.js__*/
/*__SOURCE:body/HumanDNA.js__*/
/*__SOURCE:body/BodySettings.js__*/
/*__SOURCE:body/NPCDefinitions.js__*/
/*__SOURCE:body/ConnectedSurface.js__*/
/*__SOURCE:body/SkinEnvelopeFit.js__*/
/*__SOURCE:body/SurfaceBinding.js__*/
/*__SOURCE:body/ProceduralTissue.js__*/
/*__SOURCE:body/TissueShaders.js__*/
/* Local view of the EXISTING human. One rig; shared generated skin and bind data. */
const HF_NAMES=['thumb','index','middle','ring','little'];
const HF_LABELS=['拇指','食指','中指','无名指','小指'];
function hfPoseDefaults(){return {forearmRotationDeg:0,wristFlexionDeg:0,wristDeviationDeg:0,elbowFlexionDeg:0,thumbOpposition:0,
  fingers:HF_NAMES.map((name,i)=>({name,mcp:[8,9,11,14,17][i],pip:[9,13,17,20,23][i],dip:[0,7,9,10,13][i],spread:[0,1.2,0,-.8,-1.5][i]}))};}
function hfPreset(name){
  const p=hfPoseDefaults();
  if(name==='open')for(const f of p.fingers)Object.assign(f,{mcp:0,pip:0,dip:0,spread:0});
  if(name==='spread'){for(const [i,f]of p.fingers.entries())Object.assign(f,{mcp:0,pip:0,dip:0,spread:[0,9,1,-5,-12][i]});}
  if(name==='fist'){
    p.thumbOpposition=1;
    p.fingers.forEach((f,i)=>Object.assign(f,{mcp:i===0?52:68,pip:i===0?41:93,dip:i===0?0:55,spread:0}));
  }
  if(name==='pinch'){
    p.thumbOpposition=.83;p.fingers[0].mcp=44;p.fingers[0].pip=28;
    Object.assign(p.fingers[1],{mcp:60,pip:72,dip:30,spread:1});
    for(let i=2;i<5;i++)Object.assign(p.fingers[i],{mcp:20+i*3,pip:26+i*4,dip:12});
  }
  if(name==='wrist'){p.wristFlexionDeg=42;p.wristDeviationDeg=-8;}
  if(name==='rotate')p.forearmRotationDeg=72;
  return p;
}
function hfClone(o){return JSON.parse(JSON.stringify(o));}
function hfDownload(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function hfRigJoint(h,side,id){return h.byId.get(side+'_'+id);}
function hfMakeSlice(tissue,side){
  const original=tissue.skin.g,F=tissue.bind.get(side+'_forearm'),IQ=inv(F.q),handF=tissue.bind.get(side+'_hand'),handQ=inv(handF.q),armIds=new Set();
  tissue.human.joints.forEach((j,i)=>{if(j.id.startsWith(side+'_')&&/_(forearm|radiusRotation|hand|finger_|metacarpal_)/.test(j.id))armIds.add(i)});
  const ok=new Uint8Array(original.p.length/3),used=new Set(),oldIndices=[];
  for(let v=0;v<ok.length;v++){
    let related=false;for(let k=0;k<4;k++)if(original.skinWeights[v*4+k]>.05&&armIds.has(original.skinJoints[v*4+k]))related=true;
    if(related){const p=Array.from(original.p.subarray(v*3,v*3+3)),local=rotate(IQ,sub(p,F.p));ok[v]=local[1]<=-.006?1:0;}
  }
  for(let k=0;k<original.i.length;k+=3){const a=original.i[k],b=original.i[k+1],c=original.i[k+2];if(ok[a]&&ok[b]&&ok[c]){oldIndices.push(a,b,c);used.add(a);used.add(b);used.add(c);}}
  const map=new Map(),ids=[...used],g={};ids.forEach((v,i)=>map.set(v,i));
  for(const [name,size]of [['p',3],['n',3],['skinJoints',4],['skinWeights',4],['tissueIds',2],['tissueData',4],['structureAnchor',4],['structureData',4]]){
    g[name]=new Float32Array(ids.length*size);ids.forEach((v,i)=>g[name].set(original[name].subarray(v*size,v*size+size),i*size));
  }
  attachWholeBodySlice(g,original,ids);
  g.i=Uint32Array.from(oldIndices.map(v=>map.get(v)));
  g.c=new Float32Array(ids.length*3);
  ids.forEach((v,i)=>g.c.set(original.c?original.c.subarray(v*3,v*3+3):tissue.skinColor,i*3));
  // The region is a display extraction. The main human remains one closed surface.
  return {g,id:'forearm_hand_view_'+side,materialKind:1,color:tissue.skinColor,visible:true,
    source:'continuous_skin',displayExtraction:true,vertexIds:ids};
}
class HandWorkbench{
 constructor(lab){
  this.lab=lab;this.h=lab.human;this.active=false;this.playing=false;this.side='right';this.mode='skin';this.scope='limb';this.pose=hfPoseDefaults();this.customQuaternions=null;this.cache={};this.draft={...this.h.handShape};this.busy=false;
  this.saved=null;this.lastView='threequarter';this.clock=0;this.rebuildCount=0;
  this.originalCarpals=new Map(this.h.bones.filter(b=>/_(scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate)$/.test(b.id)).map(b=>[b.id,{p:b.g.p.slice(),i:b.g.i.slice(),n:b.g.n.slice()}]));
  this.installUI();
 }
 installUI(){
  const shapeLabels={forearmLengthMm:['前臂长度','mm'],forearmGirth:['前臂粗细','倍'],wristWidthMm:['手腕宽度','mm'],wristThicknessMm:['手腕厚度','mm'],palmLengthMm:['手掌长度','mm'],palmWidthMm:['手掌宽度','mm'],palmThicknessMm:['手掌厚度','mm'],fingerLength:['手指长度','倍'],fingerWidth:['手指粗细','倍'],littleFingerLength:['小指独立长度','倍'],thumbSize:['拇指整体','倍'],thumbLength:['拇指长度','倍'],thumbWidth:['拇指粗细','倍'],softness:['软组织饱满度','']};
  const control=(key,label,unit,min,max,value,step,kind='shape')=>`<label class="hf-control" data-control="${key}"><span>${label}<small>${unit}</small></span><div><input aria-label="${label}滑块" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-${kind}="${key}"><input aria-label="${label}数值" type="number" min="${min}" max="${max}" step="${step}" value="${value}" data-${kind}="${key}"></div></label>`;
  const root=document.createElement('div');root.id='hf-root';root.hidden=true;
  root.innerHTML=`<div class="hf-topbar"><div class="hf-brand"><span>JARVIS / BODY LAB</span><strong>手掌与前臂 <em>R5 · V1.12.1</em></strong></div><div class="hf-topactions"><select id="hf-side" aria-label="编辑哪只手"><option value="right">右手</option><option value="left">左手</option></select><button id="hf-full">全身检查</button><button id="hf-close">返回原场景</button></div></div>
  <div class="hf-stage-label"><span>PROCEDURAL ANATOMY · 01</span><h1>腕背衔接 · 掌侧分区</h1><p>同一人物骨架 · 连续表皮 · 数值生成</p></div>
  <div class="hf-viewtools"><div class="hf-views"><button data-hf-view="palm">掌心</button><button data-hf-view="dorsal">手背</button><button data-hf-view="side">侧面</button><button data-hf-view="threequarter">斜视</button><button data-hf-view="closeup">手部特写</button></div><div class="hf-display"><button data-hf-mode="skin" class="is-active">肤色</button><button data-hf-mode="clay">灰模</button><button data-hf-mode="bones">骨骼</button><button data-hf-mode="overlay">骨架叠加</button></div></div>
  <div class="hf-readout"><div><b id="hf-vertices">0</b><span>局部表皮顶点</span></div><div><b id="hf-joints">0</b><span>骨架节点</span></div><div><b id="hf-error">0.000</b><span>骨长误差 / mm</span></div></div>
  <div class="hf-panel"><div class="hf-panel-title"><span>形态与姿态分开编辑</span><b>手部控制台</b></div>
  <details open><summary><b>01</b> 身体尺寸 <small>左右手同步</small></summary><div class="hf-section" id="hf-shapes">${Object.entries(shapeLabels).map(([key,[label,unit]])=>{const [min,max]=HAND_SHAPE_LIMITS[key];return control(key,label,unit,min,max,this.draft[key],key.endsWith('Mm')?1:.01)}).join('')}<div class="hf-actions"><button id="hf-apply" class="hf-primary">应用尺寸</button><button id="hf-shape-reset">恢复默认</button></div><p class="hf-note">应用时更新绑定长度、皮肤和指甲，保持当前关节角度。姿势编辑不会改变骨长。</p></div></details>
  <details open><summary><b>02</b> 骨骼活动</summary><div class="hf-section"><div class="hf-presets"><button data-hf-pose="relaxed">放松</button><button data-hf-pose="open">伸直</button><button data-hf-pose="spread">张开</button><button data-hf-pose="fist">握拳</button><button data-hf-pose="pinch">捏合姿势</button><button data-hf-pose="wrist">屈腕</button></div><button id="hf-play" class="hf-play">播放活动检查</button>
  ${control('forearmRotationDeg','前臂旋转','°',-80,85,0,1,'pose')}${control('wristFlexionDeg','手腕屈伸','°',-60,65,0,1,'pose')}${control('wristDeviationDeg','手腕侧偏','°',-25,18,0,1,'pose')}${control('grip','四指收拢','%',0,100,0,1,'pose')}${control('thumbOpposition','拇指对掌','',0,1,0,.01,'pose')}
  <div class="hf-finger-select"><span>逐指调节</span><select id="hf-finger" aria-label="选择手指">${HF_NAMES.map((name,i)=>`<option value="${i}">${HF_LABELS[i]}</option>`).join('')}</select></div>
  ${control('mcp','掌指关节','°',0,90,5,1,'finger')}${control('pip','指间关节一','°',0,100,4,1,'finger')}${control('dip','指间关节二','°',0,80,0,1,'finger')}${control('spread','手指张角','°',-18,18,0,1,'finger')}
  <p class="hf-note">拇指有两节指骨。其“指间关节二”保持为零。前臂旋转与手腕屈伸独立控制。</p></div></details>
  <details><summary><b>03</b> 数据与外部姿态</summary><div class="hf-section"><div class="hf-data-actions"><button id="hf-export-pose">导出姿势 JSON</button><button id="hf-export-shape">导出尺寸 JSON</button><button id="hf-export-bin">导出几何二进制</button><button id="hf-import">导入 JSON</button></div><input id="hf-json-file" type="file" accept=".json,application/json" hidden><p class="hf-note">外部系统可以通过稳定关节 ID 和局部四元数写入姿态。照片自动识别与接触力学未在本轮接入。</p><textarea id="hf-json-preview" readonly rows="5" aria-label="当前数据摘要"></textarea></div></details>
  <div class="hf-panel-foot">几何与变形检查版。外观仍待你的确认。</div></div><div class="hf-statusbar"><span id="hf-status">已就绪</span><span>拖动旋转 · 滚轮缩放 · Shift 拖动平移</span></div>`;
  document.body.append(root);this.root=root;
  const open=document.createElement('button');open.id='hf-open';open.textContent='手掌与前臂工作台';open.onclick=()=>this.enter();document.body.append(open);
  const sync=(kind,key,value)=>root.querySelectorAll(`[data-${kind}="${key}"]`).forEach(el=>el.value=String(value));this.syncInput=sync;
  root.querySelectorAll('[data-shape]').forEach(el=>el.addEventListener('input',()=>{const key=el.dataset.shape,value=Number(el.value);this.draft[key]=value;sync('shape',key,value);this.status('尺寸已调整，请点“应用尺寸”重建。');}));
  root.querySelectorAll('[data-pose]').forEach(el=>el.addEventListener('input',()=>{const key=el.dataset.pose,v=Number(el.value);this.stop();this.customQuaternions=null;sync('pose',key,v);if(key==='grip'){for(let i=1;i<5;i++)Object.assign(this.pose.fingers[i],{mcp:v*.68,pip:v*.93,dip:v*.55});}else this.pose[key]=v;this.applyPose();this.syncFinger();}));
  root.querySelectorAll('[data-finger]').forEach(el=>el.addEventListener('input',()=>{this.stop();this.customQuaternions=null;const f=this.pose.fingers[Number($('hf-finger').value)],k=el.dataset.finger,v=Number(el.value);f[k]=v;sync('finger',k,v);this.applyPose();}));
  $('hf-finger').onchange=()=>this.syncFinger();
  $('hf-side').onchange=()=>{this.side=$('hf-side').value;this.customQuaternions=null;this.applyPose();this.view(this.lastView);};
  root.querySelectorAll('[data-hf-view]').forEach(b=>b.onclick=()=>this.view(b.dataset.hfView));
  root.querySelectorAll('[data-hf-mode]').forEach(b=>b.onclick=()=>{this.mode=b.dataset.hfMode;root.querySelectorAll('[data-hf-mode]').forEach(x=>x.classList.toggle('is-active',x===b));needsRedraw=true;this.render();});
  root.querySelectorAll('[data-hf-pose]').forEach(b=>b.onclick=()=>this.setPreset(b.dataset.hfPose));
  $('hf-play').onclick=()=>{if(this.playing)this.stop();else{this.clock=0;this.playing=true;this.customQuaternions=null;$('hf-play').textContent='停止活动检查';needsRedraw=true;}};
  $('hf-apply').onclick=()=>this.applyShape(this.draft).catch(e=>this.status(e.message,true));
  $('hf-shape-reset').onclick=()=>{this.draft={...HAND_SHAPE_DEFAULT};for(const [k,v]of Object.entries(this.draft))sync('shape',k,v);this.applyShape(this.draft).catch(e=>this.status(e.message,true));};
  $('hf-full').onclick=()=>{this.scope=this.scope==='limb'?'body':'limb';$('hf-full').textContent=this.scope==='body'?'返回手部':'全身检查';this.view(this.scope==='body'?'body':this.lastView);};
  $('hf-close').onclick=()=>this.leave();
  $('hf-export-pose').onclick=()=>hfDownload('hand-pose-R1.json',JSON.stringify(this.exportPose(),null,2),'application/json');
  $('hf-export-shape').onclick=()=>hfDownload('hand-shape-R1.json',JSON.stringify(this.exportShape(),null,2),'application/json');
  $('hf-export-bin').onclick=()=>hfDownload('procedural-hand-R1.bin',this.exportBinary(),'application/octet-stream');
  $('hf-import').onclick=()=>$('hf-json-file').click();$('hf-json-file').onchange=async e=>{try{const f=e.target.files[0];if(f.size>1024*1024)throw Error('JSON 文件过大');const d=JSON.parse(await f.text());if(d.schema==='jarvis/hand_shape@1')await this.applyShape(d.parameters);else this.importPose(d);this.status('数据导入完成');}catch(err){this.status(err.message,true)}finally{e.target.value=''}};
  this.syncControls();
 }
 status(text,error=false){$('hf-status').textContent=text;$('hf-status').classList.toggle('hf-error',error);}
 syncFinger(){const f=this.pose.fingers[Number($('hf-finger').value)],thumb=f.name==='thumb';for(const k of ['mcp','pip','dip','spread'])this.syncInput('finger',k,f[k]);this.root.querySelectorAll('[data-finger="dip"],[data-finger="spread"]').forEach(e=>e.disabled=thumb);}
 syncControls(){for(const key of ['forearmRotationDeg','wristFlexionDeg','wristDeviationDeg','thumbOpposition'])this.syncInput('pose',key,this.pose[key]);this.syncInput('pose','grip',Math.round(this.pose.fingers[2].mcp/.68));this.syncFinger();}
 enter(){
  if(this.active)return this.report();if(agent.held||agent.skill)throw Error('请先停止当前身体任务，再打开局部编辑。');
  this.saved={q:this.h.joints.map(j=>[...j.q]),root:[...this.h.root.p],auto,paused:agent.paused,view:this.h.tissue.view};
  this.active=true;auto=true;agent.paused=true;follow=false;isolation='all';cameraMode='hand';
  document.body.classList.add('hand-studio');this.root.hidden=false;
  for(const j of this.h.joints)j.q=[...j.bindQ];this.h.root.q=qi();
  for(const side of ['left','right']){this.h.arms[side].upper.q=qi();this.h.arms[side].elbow.q=qi();this.h.arms[side].radial.q=qi();this.h.arms[side].wrist.q=qi();}
  renderer.studioMode=true;renderer.background=[.79,.82,.83];renderer.quality='fast';renderer.overlayLines=false;
  this.applyPose();this.view(this.lastView);if(window.parent!==window)window.parent.postMessage({type:'hand-studio:opened'},'*');this.status('局部工作台已打开，原人物动作已暂停。');return this.report();
 }
 leave(){
  if(!this.active)return;this.stop();this.active=false;this.root.hidden=true;document.body.classList.remove('hand-studio');
  this.h.joints.forEach((j,i)=>j.q=[...this.saved.q[i]]);this.h.root.p=[...this.saved.root];this.h.fk();this.h.tissue.update(agent.time,0);
  agent.paused=this.saved.paused;auto=this.saved.auto;renderer.studioMode=false;renderer.background=null;renderer.overlayLines=false;renderer.quality='shadow';
  this.h.tissue.setView(this.saved.view);this.lab.focus('body');needsRedraw=true;this.lab.render();
  if(window.parent!==window)window.parent.postMessage({type:'hand-studio:closed'},'*');
 }
 stop(){this.playing=false;if($('hf-play'))$('hf-play').textContent='播放活动检查';}
 setPreset(name){this.stop();this.pose=hfPreset(name);this.customQuaternions=null;this.applyPose();this.syncControls();this.status('姿势：'+({relaxed:'自然放松',open:'伸直',spread:'手指张开',fist:'握拳',pinch:'捏合检查',wrist:'手腕屈伸',rotate:'前臂旋转'}[name]||name));return this.report();}
 applyPose(renderNow=true){
  const h=this.h,side=this.side,s=side==='right'?1:-1,p=this.pose,a=h.arms[side];
  a.elbow.q=qx(-Math.max(0,p.elbowFlexionDeg||0)*DEG);a.radial.q=qy((p.forearmRotationDeg||0)*DEG);
  a.wrist.q=qfromRotvec([-(p.wristFlexionDeg||0)*DEG,0,s*(p.wristDeviationDeg||0)*DEG]);
  for(const f of h.fingers.filter(f=>f.side===side)){
    const v=p.fingers[f.f];
    f.mc.q=f.thumb?handThumbCMC(s,p.thumbOpposition):qi();
    f.ph.forEach((j,k)=>{const angle=f.thumb?(k===0?Math.min(60,v.mcp):Math.min(67,v.pip)):[v.mcp,v.pip,v.dip][k];j.q=k===0&&!f.thumb?qm(qz(s*v.spread*DEG),qx(-angle*DEG)):qx(-angle*DEG);});
  }
  if(this.customQuaternions)for(const [id,q]of Object.entries(this.customQuaternions))h.byId.get(id).q=[...q];
  // All public paths end at the existing anatomical constraint authority.
  h.constraints.enforceAll();h.fk();h.tissue.update(this.clock,0);needsRedraw=true;
  if(this.active&&renderNow)this.render();return renderNow?this.report():null;
 }
 tick(dt){
  if(!this.active||!this.playing||this.busy)return;this.clock+=dt;
  const period=10,t=this.clock%period,p=hfPoseDefaults(),grip=(1-Math.cos(t/period*Math.PI*4))*.5;
  p.forearmRotationDeg=Math.sin(t/period*Math.PI*2)*65;p.wristFlexionDeg=Math.sin(t/period*Math.PI*2+.4)*25;
  p.thumbOpposition=grip;p.fingers.forEach((f,i)=>Object.assign(f,{mcp:i===0?grip*52:grip*64,pip:i===0?grip*41:grip*87,dip:i===0?0:grip*48,spread:0}));
  this.pose=p;this.applyPose(false);
 }
 view(name){
  if(!this.active)return;const h=this.h,a=h.arms[this.side];follow=false;renderer.projection='orthographic';
  if(name==='body'||this.scope==='body'){
    renderer.target=add(h.root.p,[0,.03,0]);renderer.orthoHeight=2.0;renderer.distance=3;renderer.yaw=.18;renderer.pitch=.06;
  }else{
    this.lastView=name;const close=name==='closeup';
    const handExtent=Math.max(...h.fingers.filter(f=>f.side===this.side&&!f.thumb).map(f=>{const d=handRigDimensions(h,f.f,a.s);return -d.base[1]+d.mcLength+d.phLengths.reduce((n,x)=>n+x,0);}));
    const centerT=close?(-handExtent/2+.025):(a.L2-handExtent)/2;
    renderer.target=point(a.wrist.world,[0,centerT,0]);renderer.orthoHeight=close?Math.max(.275,handExtent*1.58):Math.max(.505,(a.L2+handExtent)*1.22);renderer.distance=1.3;
    renderer.yaw=name==='palm'?0:name==='side'?(this.side==='right'?Math.PI/2:-Math.PI/2):name==='dorsal'?Math.PI:Math.PI+.42;
    renderer.pitch=name==='threequarter'||close?.14:0;
  }
  this.root.querySelectorAll('[data-hf-view]').forEach(b=>b.classList.toggle('is-active',b.dataset.hfView===name));needsRedraw=true;this.render();
 }
 render(){
  if(!this.active)return;const tissue=this.h.tissue;
  let selected=this.scope==='body'?tissue.skin:(this.cache[this.side]||(this.cache[this.side]=hfMakeSlice(tissue,this.side)));
  const skinKey=this.scope+':'+this.side+':'+this.mode;
  if(this.cachedSkinKey!==skinKey||this.cachedGeometry!==selected.g){
    this.renderSkin={...selected,materialKind:this.mode==='clay'?7:1,color:this.mode==='clay'?[.48,.51,.52]:tissue.skinColor};
    if(this.mode==='clay')this.renderSkin.g={...selected.g,c:null};this.cachedSkinKey=skinKey;this.cachedGeometry=selected.g;
  }
  let items=[];const boneFilter=b=>this.scope==='body'||b.id.startsWith(this.side+'_')&&/^.*_(ulna|radius|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal_|finger_)/.test(b.id);
  if(this.mode==='bones'){items=this.h.bones.filter(boneFilter);for(const b of items)b.visible=true;}
  else{items=[this.renderSkin,...(this.mode==='clay'?[]:tissue.details.filter(d=>this.scope==='body'||d.handDetail&&d.id.startsWith(this.side)))];for(const d of items)d.visible=true;}
  let lineItems=[];
  if(this.mode==='overlay'){
    const pairs=[];for(const j of this.h.joints)if(j.parent&&j.id.startsWith(this.side+'_')&&/_(hand|finger_|metacarpal_)/.test(j.id))pairs.push([j.parent.world.p,j.world.p]);
    const a=this.h.arms[this.side];pairs.push([a.elbow.world.p,a.wrist.world.p]);
    lineItems=[{g:lineMesh(pairs),color:[.13,.58,.64]}];
  }
  renderer.overlayLines=this.mode==='overlay';renderer.render(items,lineItems);
  $('hf-vertices').textContent=(selected.g.p.length/3).toLocaleString();$('hf-joints').textContent=String(this.exportPose().joints.length);
  $('hf-error').textContent=(this.h.diagnostics().maxBoneLengthErrorM*1000).toFixed(4);
  $('hf-json-preview').value=JSON.stringify({side:this.side,proportionRevision:this.h.proportionRevision,shape:this.h.handShape,poseSchema:'jarvis/hand_pose@1'},null,2);
 }
 async applyShape(parameters){
  if(this.busy)throw Error('上一项尺寸重建尚未结束');const next=validateHandShape(parameters);
  if(!this.active)throw Error('请先打开手部工作台');this.stop();this.busy=true;$('hf-apply').disabled=true;this.status('正在重建尺寸、连续表皮与逆绑定数据…');
  await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,20)));
  const old={shape:this.h.handShape,tissue:this.h.tissue,positions:this.h.joints.map(j=>[j.p.slice(),j.bind.slice(),j.segmentLength]),L2:{left:this.h.arms.left.L2,right:this.h.arms.right.L2},bones:this.h.bones.map(b=>b.g),lengths:this.h.bindLengths};
  const started=performance.now();
  try{
    this.h.handShape=next;
    for(const side of ['left','right']){
      const a=this.h.arms[side],s=a.s;a.L2=next.forearmLengthMm/1000;a.wrist.p=[0,-a.L2,0];a.wrist.bind=[...a.wrist.p];
      const [ulna,radius]=makeForearm(s,a.L2);this.h.bones.find(b=>b.id===side+'_ulna').g=ulna;this.h.bones.find(b=>b.id===side+'_radius').g=radius;
      for(const f of this.h.fingers.filter(f=>f.side===side)){
        const d=handRigDimensions(this.h,f.f,s);f.mc.p=[...d.base];f.mc.bind=[...d.base];this.h.bones.find(b=>b.id===f.mc.id).g=boneRod(d.mcLength,f.thumb?.006:.0045);
        let prior=d.mcLength;f.ph.forEach((j,k)=>{j.p=[0,-prior,0];j.bind=[...j.p];j.segmentLength=d.phLengths[k];this.h.bones.find(b=>b.id===j.id).g=boneRod(j.segmentLength,f.thumb?.0048:.0038-k*.0004);prior=j.segmentLength;});
      }
      const r=handRatios(this.h);for(const [id,g]of this.originalCarpals)if(id.startsWith(side)){
        const positions=Array.from(g.p);for(let i=0;i<positions.length;i+=3){positions[i]*=r.wx;positions[i+1]*=r.py;positions[i+2]*=r.wz;}
        this.h.bones.find(b=>b.id===id).g=mesh(positions,Array.from(g.i));
      }
    }
    this.h.bindLengths=this.h.joints.filter(j=>j.parent).map(j=>({id:j.id,length:len(j.p)}));this.h.fk();
    const tissue=new ProceduralTissue(this.h);this.h.tissue=tissue;this.lab.tissue=tissue;renderer.setTissue(tissue);renderer.lastItems=[];
    this.cache={};this.cachedGeometry=null;this.h.proportionRevision++;this.rebuildCount++;this.lastRebuildMs=performance.now()-started;
    this.draft={...next};for(const [k,v]of Object.entries(next))this.syncInput('shape',k,v);
    this.h.evidence.geometryHash=this.h.geometryHash();this.applyPose();this.view(this.lastView);
    this.status('尺寸已应用 · 绑定版本 '+this.h.proportionRevision+' · '+(this.lastRebuildMs/1000).toFixed(1)+' 秒');return this.report();
  }catch(e){
    this.h.handShape=old.shape;this.h.joints.forEach((j,i)=>{[j.p,j.bind,j.segmentLength]=old.positions[i]});this.h.arms.left.L2=old.L2.left;this.h.arms.right.L2=old.L2.right;
    this.h.bones.forEach((b,i)=>b.g=old.bones[i]);this.h.bindLengths=old.lengths;this.h.tissue=old.tissue;this.lab.tissue=old.tissue;renderer.setTissue(old.tissue);this.h.fk();this.applyPose();throw e;
  }finally{this.busy=false;$('hf-apply').disabled=false;}
 }
 exportShape(){return {schema:'jarvis/hand_shape@1',proportionRevision:this.h.proportionRevision,parameters:{...this.h.handShape},units:'millimeters and explicit multipliers',sides:'bilateral'};}
 exportPose(){
  const side=this.side;return {schema:'jarvis/hand_pose@1',side,proportionRevision:this.h.proportionRevision,units:'meter',rotationSpace:'local',quaternionOrder:'xyzw',
    joints:this.h.joints.filter(j=>j.id.startsWith(side+'_')&&/_(forearm|radiusRotation|hand|finger_|metacarpal_)/.test(j.id)).map(j=>({id:j.id,rotation:j.q.slice()}))};
 }
 importPose(data){
  if(!data||data.schema!=='jarvis/hand_pose@1')throw Error('不支持的姿势 schema');if(!['left','right'].includes(data.side))throw Error('姿势必须指定左右手');
  if(data.rotationSpace!=='local'||data.quaternionOrder!=='xyzw')throw Error('姿势需要局部 xyzw 四元数');
  if(data.proportionRevision!==this.h.proportionRevision)throw Error('姿势绑定版本不同，请先重定向后再导入');
  if(!Array.isArray(data.joints)||data.joints.length>32)throw Error('关节集合无效');
  const q={},allowed=new Set(this.h.joints.filter(j=>j.id.startsWith(data.side+'_')&&/_(forearm|radiusRotation|hand|finger_|metacarpal_)/.test(j.id)).map(j=>j.id));
  for(const j of data.joints){if(!allowed.has(j.id)||q[j.id])throw Error('未知或重复手部关节：'+j.id);if(Object.keys(j).some(k=>!['id','rotation'].includes(k)))throw Error('姿势不得写入位置、比例或骨长');if(!Array.isArray(j.rotation)||j.rotation.length!==4||!j.rotation.every(Number.isFinite)||len(j.rotation)<.0001)throw Error('无效四元数：'+j.id);q[j.id]=qnorm(j.rotation);}
  this.stop();this.side=data.side;$('hf-side').value=this.side;this.customQuaternions=q;this.applyPose();return this.report();
 }
 exportBinary(){
  const roi=this.cache[this.side]||(this.cache[this.side]=hfMakeSlice(this.h.tissue,this.side)),g=roi.g;
  const arrays=[g.p,g.n,g.i,g.skinJoints,g.skinWeights];
  const metadata={schema:'jarvis/generated_hand_buffers@1',side:this.side,proportionRevision:this.h.proportionRevision,shape:this.h.handShape,
    coordinates:'right handed; world bind positions; meter',counts:{vertices:g.p.length/3,triangles:g.i.length/3},
    channels:arrays.map((a,i)=>({name:['position','normal','index','skinJoints','skinWeights'][i],type:a.constructor.name,byteLength:a.byteLength})),
    joints:this.h.joints.map(j=>({id:j.id,parent:j.parent?.id||null,bind:this.h.tissue.bind.get(j.id)}))};
  const json=new TextEncoder().encode(JSON.stringify(metadata)),padded=Math.ceil(json.length/4)*4,total=16+padded+arrays.reduce((n,a)=>n+a.byteLength,0),out=new ArrayBuffer(total),view=new DataView(out);
  new Uint8Array(out).set(new TextEncoder().encode('HRHAND01'));view.setUint32(8,json.length,true);view.setUint32(12,padded,true);new Uint8Array(out,16,json.length).set(json);let offset=16+padded;
  for(const array of arrays){new Uint8Array(out,offset,array.byteLength).set(new Uint8Array(array.buffer,array.byteOffset,array.byteLength));offset+=array.byteLength;}return out;
 }
 report(){return {schema:'jarvis/hand_workbench_report@1',version:'1.12.1',active:this.active,side:this.side,scope:this.scope,mode:this.mode,playing:this.playing,busy:this.busy,
   shape:{...this.h.handShape},proportionRevision:this.h.proportionRevision,rebuilds:this.rebuildCount,lastRebuildMs:this.lastRebuildMs||0,
   boneLengthErrorM:this.h.diagnostics().maxBoneLengthErrorM,localVertices:this.cache[this.side]?.g.p.length/3||0,
   mainSurface:this.h.tissue.surfaceInfo.topology,externalMeshes:0,rasterMaps:0,poseAuthority:'Human.finalPose',photoPoseRecognition:false,selfCollisionSolver:false,visualAcceptance:false};}
}

/*__SOURCE:body/ShoulderWorkbench.js__*/

/*__SOURCE:body/TorsoWorkbench.js__*//*__SOURCE:body/HeadNeckWorkbench.js__*/
/*__SOURCE:body/CharacterPresets.js__*/
/*__SOURCE:body/LowerLimbWorkbench.js__*/
// MODULE hair
/*__SOURCE:body/ProceduralHair.js__*/
/*__SOURCE:body/HairGroom.js__*/
/*__SOURCE:body/HairCollision.js__*/
/*__SOURCE:body/HairFollicles.js__*/
/*__SOURCE:body/HairRenderer.js__*/
/*__SOURCE:body/HairControls.js__*/
// END MODULE hair

// MODULE render
// Rigid matrix-palette batching. All surface vertices remain generated from the
// anatomy functions. The renderer reads finalPose and never changes the rig.
const VS=TISSUE_VERTEX_SHADER;
const FS=TISSUE_FRAGMENT_SHADER;
const DFS=`#version 300 es
precision highp float;void main(){}`;
const LVS=`#version 300 es
precision highp float;layout(location=0)in vec3 position;layout(location=1)in vec3 color;uniform mat4 viewProjection;out vec3 C;void main(){C=color;gl_Position=viewProjection*vec4(position,1.);}`;
const LFS=`#version 300 es
precision highp float;in vec3 C;out vec4 frag;void main(){frag=vec4(pow(C,vec3(1./2.2)),1.);}`;
function shader(gl,type,src){
 const label=type===gl.VERTEX_SHADER?'顶点着色器':'片元着色器',s=gl.createShader(type);
 if(!s)throw Error(label+'创建失败');
 gl.shaderSource(s,src);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
  const info=gl.getShaderInfoLog(s)||'驱动没有返回编译日志';gl.deleteShader(s);
  throw Error(label+'编译失败：\n'+info);
 }
 return s;
}
function program(gl,v,f){
 const p=gl.createProgram();if(!p)throw Error('着色程序创建失败');let a,b;
 try{
  a=shader(gl,gl.VERTEX_SHADER,v);b=shader(gl,gl.FRAGMENT_SHADER,f);
  gl.attachShader(p,a);gl.attachShader(p,b);gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('着色程序链接失败：\n'+(gl.getProgramInfoLog(p)||'驱动没有返回链接日志'));
  return{p,u:Object.fromEntries(['viewProjection','lightVP','eye','shadow','posePalette','depthPass','shadowsEnabled','jointPalette','musclePalette','anatomyTime','studioMode'].map(k=>[k,gl.getUniformLocation(p,k)]))};
 }catch(error){gl.deleteProgram(p);throw error}
 finally{if(a)gl.deleteShader(a);if(b)gl.deleteShader(b)}
}
class Renderer{
 constructor(canvas){this.canvas=canvas;const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('浏览器未提供 WebGL2，请开启硬件加速后重新打开');this.gl=gl;this.main=program(gl,VS,FS);this.depth=program(gl,VS,DFS);this.lineProgram=program(gl,LVS,LFS);this.target=[0,ADULT_SPEC.statureM/2,1.75];this.projection='perspective';this.orthoHeight=ADULT_SPEC.statureM*1.16;this.yaw=.20;this.pitch=.15;this.distance=3.12;this.eye=[0,0,5];this.frames=0;this.drawCalls=0;this.shadowDrawCalls=0;this.quality='shadow';this.lastItems=[];this.lastLines=[];this.buffers=[];this.lineBuffers=[];this.poseTexture=gl.createTexture();this.lightVP=mm(ortho(-5.2,5.2,-4.4,4.4,.1,20),lookAt([-4,8,5],[0,0,0]));this.shadowSize=Math.min(2048,gl.getParameter(gl.MAX_TEXTURE_SIZE));this.matrixUploads=0;this.tissue=null;this.jointTexture=gl.createTexture();this.muscleTexture=gl.createTexture();
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,this.shadowSize,this.shadowSize,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);this.textureOptions();this.shadow=tex;this.fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,tex,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);this.shadowAvailable=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);this.installControls();}
 setTissue(tissue){
 this.tissue=tissue;const gl=this.gl;
 for(const [unit,texture,width,data] of [[2,this.jointTexture,2,tissue.jointPalette],[3,this.muscleTexture,6,tissue.musclePalette]]){
  gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,width,data.length/(width*4),0,gl.RGBA,gl.FLOAT,data);this.textureOptions();
 }gl.activeTexture(gl.TEXTURE0);
 }
 uploadTissue(){
 if(!this.tissue)return;const gl=this.gl;
 for(const [unit,texture,width,data] of [[2,this.jointTexture,2,this.tissue.jointPalette],[3,this.muscleTexture,6,this.tissue.musclePalette]]){
  gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,width,data.length/(width*4),gl.RGBA,gl.FLOAT,data);
 }gl.activeTexture(gl.TEXTURE0);
 }
 tissueUniforms(program){const gl=this.gl;gl.uniform1i(program.u.jointPalette,2);gl.uniform1i(program.u.musclePalette,3);gl.uniform1f(program.u.anatomyTime,this.tissue?.time||0);gl.uniform1f(program.u.studioMode,this.studioMode?1:0);}
 tissueAttributes(items,nv){
 const channels=[[5,1,'materialKind'],[6,4,'skinJoints'],[7,4,'skinWeights'],[8,2,'tissueIds'],[9,4,'tissueData'],[10,4,'structureAnchor'],[11,4,'structureData'],[12,3,'surfaceRest']];
 for(const [location,size,key] of channels){const values=new Float32Array(nv*size);let offset=0;
  for(const o of items){const n=o.g.p.length/3;if(key==='materialKind')values.fill(o.materialKind||0,offset,offset+n);else if(o.g[key])values.set(o.g[key],offset);offset+=n*size;}
  this.attr(location,values,size,this.buffers);
 }
 }
 textureOptions(){const g=this.gl;g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE)}
 setQuality(value){this.quality=value==='shadow'?'shadow':'fast'}
 installControls(){
  const c=this.canvas,pointers=new Map();let drag=null,lastPinch=0;
  const zoom=factor=>{if(this.projection==='orthographic')this.orthoHeight=clamp(this.orthoHeight*factor,.12,45);else this.distance=clamp(this.distance*factor,.25,65);};
  c.style.touchAction='none';c.addEventListener('contextmenu',e=>e.preventDefault());
  c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);drag=[e.clientX,e.clientY,e.button];});
  c.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);drag=null;lastPinch=0});
  c.addEventListener('pointercancel',()=>{pointers.clear();drag=null;lastPinch=0});
  c.addEventListener('pointermove',e=>{
   if(!pointers.has(e.pointerId)||!drag)return;
   const dx=e.clientX-drag[0],dy=e.clientY-drag[1];pointers.set(e.pointerId,[e.clientX,e.clientY]);
   if(pointers.size===2){const[a,b]=[...pointers.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(lastPinch&&d>1)zoom(lastPinch/d);lastPinch=d;}
   else if(drag[2]===2||e.shiftKey){
    const right=[Math.cos(this.yaw),0,-Math.sin(this.yaw)],up=[-Math.sin(this.yaw)*Math.sin(this.pitch),Math.cos(this.pitch),-Math.cos(this.yaw)*Math.sin(this.pitch)];
    const scale=this.projection==='orthographic'?this.orthoHeight/Math.max(1,c.clientHeight):this.distance*.0015;
    follow=false;$('follow').checked=false;this.target=add(this.target,add(mul(right,-dx*scale),mul(up,dy*scale)));
   }else{this.yaw-=dx*.006;this.pitch=clamp(this.pitch+dy*.005,this.studioMode?-1.49:-.20,1.49)}
   drag=[e.clientX,e.clientY,drag[2]];
  });
  c.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(e.deltaY*.001))},{passive:false});
 }
 attr(loc,data,size,buffers){const gl=this.gl,b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0)}
 batch(items){const gl=this.gl;for(const b of this.buffers)gl.deleteBuffer(b);if(this.vao)gl.deleteVertexArray(this.vao);this.buffers=[];this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);let nv=0,ni=0;for(const o of items){nv+=o.g.p.length/3;ni+=o.g.i.length}const P=new Float32Array(nv*3),N=new Float32Array(nv*3),C=new Float32Array(nv*3),B=new Float32Array(nv),O=new Float32Array(nv).fill(1),I=new Uint32Array(ni);let vo=0,io=0;items.forEach((o,id)=>{const n=o.g.p.length/3;refreshWholeBodySlice(o.g);P.set(o.g.renderP||o.g.p,vo*3);N.set(o.g.renderN||o.g.n,vo*3);B.fill(id,vo,vo+n);if(o.g.ao)O.set(o.g.ao,vo);if(o.g.c)C.set(o.g.c,vo*3);else for(let k=0;k<n;k++)C.set(o.color||[.7,.7,.7],(vo+k)*3);for(let k=0;k<o.g.i.length;k++)I[io+k]=o.g.i[k]+vo;vo+=n;io+=o.g.i.length});this.attr(0,P,3,this.buffers);this.attr(1,N,3,this.buffers);this.attr(2,B,1,this.buffers);this.attr(3,C,3,this.buffers);this.attr(4,O,1,this.buffers);this.tissueAttributes(items,nv);const ib=gl.createBuffer();this.buffers.push(ib);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,I,gl.STATIC_DRAW);this.count=ni;this.vertices=nv;this.lastItems=[...items];this.palette=new Float32Array(items.length*20);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.poseTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,5,items.length,0,gl.RGBA,gl.FLOAT,this.palette);this.textureOptions();this.batchBuilds=(this.batchBuilds||0)+1;}
 lineBatch(lines){const gl=this.gl;for(const b of this.lineBuffers)gl.deleteBuffer(b);if(this.lineVAO)gl.deleteVertexArray(this.lineVAO);this.lineBuffers=[];this.lineVAO=gl.createVertexArray();gl.bindVertexArray(this.lineVAO);const n=lines.reduce((n,l)=>n+l.g.i.length,0),P=new Float32Array(n*3),C=new Float32Array(n*3);let off=0;for(const l of lines)for(const id of l.g.i){P.set(l.g.p.subarray(id*3,id*3+3),off*3);C.set(l.color,off*3);off++}this.attr(0,P,3,this.lineBuffers);this.attr(1,C,3,this.lineBuffers);this.lineCount=n;this.lastLines=[...lines];}
 render(items,lines=[]){const surfaceChanged=updateWholeBodySurface(this.tissue);if(this.hair?.tissue!==this.tissue&&this.hair)this.hair.build();const drawHair=this.hair?.visibleFor(items);const gl=this.gl,c=this.canvas,dpr=Math.min(devicePixelRatio||1,this.quality==='shadow'?1.6:1),w=Math.max(1,Math.floor(c.clientWidth*dpr)),h=Math.max(1,Math.floor(c.clientHeight*dpr));if(c.width!==w||c.height!==h){c.width=w;c.height=h}if(items.length!==this.lastItems.length||items.some((v,i)=>v!==this.lastItems[i]))this.batch(items);if(lines.length!==this.lastLines.length||lines.some((v,i)=>v!==this.lastLines[i]))this.lineBatch(lines);
 this.eye=add(this.target,[Math.sin(this.yaw)*Math.cos(this.pitch)*this.distance,Math.sin(this.pitch)*this.distance,Math.cos(this.yaw)*Math.cos(this.pitch)*this.distance]);const halfY=this.orthoHeight/2,halfX=halfY*w/h,projection=this.projection==='orthographic'?ortho(-halfX,halfX,-halfY,halfY,.015,80):perspective(.72,w/h,.015,80);this.vp=mm(projection,lookAt(this.eye,this.target));for(let id=0;id<items.length;id++){const o=items[id];this.palette.set(o.matrix||matrix(o.joint?.world.p||o.p||[0,0,0],o.joint?.world.q||o.q||[0,0,0,1]),id*20);this.palette.set([o.visible===false?0:1,o.castShadow===false?0:1,o.unlit?1:0,0],id*20+16)}gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.poseTexture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,5,items.length,gl.RGBA,gl.FLOAT,this.palette);this.matrixUploads++;this.uploadTissue();if(surfaceChanged)uploadWholeBodySurface(this);this.drawCalls=0;this.shadowDrawCalls=0;const shadows=this.quality==='shadow'&&this.shadowAvailable;
 if(shadows){gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.viewport(0,0,this.shadowSize,this.shadowSize);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.2,1.0);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(this.depth.p);this.tissueUniforms(this.depth);gl.uniformMatrix4fv(this.depth.u.viewProjection,false,this.lightVP);gl.uniform1i(this.depth.u.posePalette,0);gl.uniform1f(this.depth.u.depthPass,1);gl.bindVertexArray(this.vao);gl.disable(gl.CULL_FACE);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_INT,0);this.shadowDrawCalls=1;gl.disable(gl.POLYGON_OFFSET_FILL); }
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.clearColor(...(this.background||[.029,.048,.063]),1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const p=this.main;gl.useProgram(p.p);this.tissueUniforms(p);gl.uniformMatrix4fv(p.u.viewProjection,false,this.vp);gl.uniformMatrix4fv(p.u.lightVP,false,this.lightVP);gl.uniform3fv(p.u.eye,this.eye);gl.uniform1i(p.u.posePalette,0);gl.uniform1f(p.u.depthPass,0);gl.uniform1f(p.u.shadowsEnabled,shadows?1:0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.shadow);gl.uniform1i(p.u.shadow,1);gl.bindVertexArray(this.vao);gl.disable(gl.CULL_FACE);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_INT,0);this.drawCalls++;
 if(drawHair)this.hair.gpu.draw(this,false);
 if(this.lineCount){if(this.overlayLines)gl.disable(gl.DEPTH_TEST);gl.useProgram(this.lineProgram.p);gl.uniformMatrix4fv(this.lineProgram.u.viewProjection,false,this.vp);gl.bindVertexArray(this.lineVAO);gl.drawArrays(gl.LINES,0,this.lineCount);gl.enable(gl.DEPTH_TEST);this.drawCalls++}this.frames++;}
 screen(p){if(!this.vp)return null;const v=project(this.vp,p);return{x:(v[0]+1)*this.canvas.clientWidth/2,y:(1-v[1])*this.canvas.clientHeight/2,visible:v[2]>-1&&v[2]<1&&Math.abs(v[0])<1.05&&Math.abs(v[1])<1.1}}
}
function lineMesh(points){const p=[],n=[],i=[];for(const[a,b]of points){const k=p.length/3;p.push(...a,...b);n.push(0,1,0,0,1,0);i.push(k,k+1)}return{p:Float32Array.from(p),n:Float32Array.from(n),i:Uint32Array.from(i)}}

/*__SOURCE:world/ActivitySpace.js__*/


// MODULE strength
/*__SOURCE:body/StrengthModel.js__*/
/*__SOURCE:body/StrengthBridge.js__*/
// MODULE world
const FIELD_BOUNDS=Object.freeze({xMin:-4.35,xMax:4.35,zMin:-3.30,zMax:3.30});
// MODULE camp_world
// Declarative environment, geometry and camera only. Body solvers remain owned
// by the humanoid modules. Parts use the collision dimensions in the scene data.
const CAMP_WORLD={"schema":"jarvis/camp_world@1","id":"camp","name":"军营与邻村","units":"meter","bounds":{"xMin":-13,"xMax":13,"zMin":-9.4,"zMax":9.4},"spawn":[0,0,0],"templates":{"campWall":{"templateId":"campWall","name":"营区墙体","shape":"box","category":"architecture","w":1,"h":1.25,"d":0.16,"color":[0.64,0.64,0.52],"mass":60,"movable":false,"collidable":true,"aliases":["营区墙体"]},"campFence":{"templateId":"campFence","name":"营区围栏","shape":"box","category":"architecture","w":0.12,"h":1.35,"d":3,"color":[0.3,0.37,0.29],"mass":60,"movable":false,"collidable":true,"aliases":["营区围栏"]},"bunk":{"templateId":"bunk","name":"双层床","shape":"box","category":"furniture","w":0.92,"h":1.65,"d":2,"color":[0.29,0.34,0.27],"mass":60,"movable":false,"collidable":true,"aliases":["双层床"]},"locker":{"templateId":"locker","name":"军绿色储物柜","shape":"box","category":"furniture","w":0.68,"h":1.65,"d":0.48,"color":[0.27,0.34,0.24],"mass":60,"movable":false,"collidable":true,"aliases":["军绿色储物柜"]},"supplyRack":{"templateId":"supplyRack","name":"物资货架","shape":"box","category":"furniture","w":1.9,"h":1.65,"d":0.55,"color":[0.4,0.43,0.36],"mass":60,"movable":false,"collidable":true,"aliases":["物资货架"]},"officeDesk":{"templateId":"officeDesk","name":"办公桌","shape":"box","category":"furniture","w":1.3,"h":0.76,"d":0.68,"color":[0.4,0.28,0.18],"mass":60,"movable":false,"collidable":true,"aliases":["办公桌"]},"campChair":{"templateId":"campChair","name":"办公椅","shape":"box","category":"furniture","w":0.48,"h":0.86,"d":0.5,"color":[0.28,0.34,0.29],"mass":60,"movable":false,"collidable":true,"aliases":["办公椅"]},"diningTable":{"templateId":"diningTable","name":"食堂餐桌","shape":"box","category":"furniture","w":1.25,"h":0.76,"d":0.72,"color":[0.48,0.47,0.37],"mass":60,"movable":false,"collidable":true,"aliases":["食堂餐桌"]},"kitchenCounter":{"templateId":"kitchenCounter","name":"食堂操作台","shape":"box","category":"furniture","w":2.2,"h":0.9,"d":0.65,"color":[0.55,0.59,0.56],"mass":60,"movable":false,"collidable":true,"aliases":["食堂操作台"]},"noticeboard":{"templateId":"noticeboard","name":"公告栏","shape":"box","category":"furniture","w":1.1,"h":1.65,"d":0.18,"color":[0.26,0.34,0.27],"mass":60,"movable":false,"collidable":true,"aliases":["公告栏"]},"guardBooth":{"templateId":"guardBooth","name":"门岗值班亭","shape":"box","category":"architecture","w":1.35,"h":2.25,"d":1.3,"color":[0.54,0.57,0.46],"mass":60,"movable":false,"collidable":true,"aliases":["门岗值班亭"]},"villageHouse":{"templateId":"villageHouse","name":"村舍","shape":"box","category":"architecture","w":2.4,"h":2.5,"d":2.4,"color":[0.69,0.61,0.48],"mass":60,"movable":false,"collidable":true,"aliases":["村舍"]},"marketStall":{"templateId":"marketStall","name":"村庄交货棚","shape":"box","category":"furniture","w":1.5,"h":1.9,"d":0.85,"color":[0.48,0.4,0.25],"mass":60,"movable":false,"collidable":true,"aliases":["村庄交货棚"]},"farmBed":{"templateId":"farmBed","name":"菜畦","shape":"box","category":"agriculture","w":2,"h":0.24,"d":1.05,"color":[0.3,0.23,0.14],"mass":60,"movable":false,"collidable":true,"aliases":["菜畦"]},"campTree":{"templateId":"campTree","name":"树木","shape":"box","category":"landscape","w":1,"h":2.9,"d":1,"color":[0.29,0.4,0.2],"mass":60,"movable":false,"collidable":true,"aliases":["树木"]},"campLamp":{"templateId":"campLamp","name":"路灯","shape":"box","category":"landscape","w":0.22,"h":2.4,"d":0.22,"color":[0.3,0.35,0.31],"mass":60,"movable":false,"collidable":true,"aliases":["路灯"]},"campBin":{"templateId":"campBin","name":"分类回收桶","shape":"box","category":"furniture","w":0.42,"h":0.72,"d":0.44,"color":[0.26,0.37,0.31],"mass":60,"movable":false,"collidable":true,"aliases":["分类回收桶"]},"supplyCrate":{"templateId":"supplyCrate","name":"补给箱","shape":"box","category":"cargo","w":0.38,"h":0.3,"d":0.32,"color":[0.38,0.44,0.25],"mass":3.5,"movable":true,"collidable":true,"aliases":["补给箱"]},"vegetableCrate":{"templateId":"vegetableCrate","name":"蔬菜筐","shape":"box","category":"cargo","w":0.4,"h":0.28,"d":0.34,"color":[0.55,0.39,0.19],"mass":2.5,"movable":true,"collidable":true,"aliases":["蔬菜筐"]},"campParcel":{"templateId":"campParcel","name":"文件包","shape":"box","category":"cargo","w":0.28,"h":0.1,"d":0.21,"color":[0.64,0.51,0.32],"mass":0.6,"movable":true,"collidable":true,"aliases":["文件包"]},"handcart":{"templateId":"handcart","name":"搬运手推车","shape":"box","category":"equipment","w":0.65,"h":0.82,"d":1,"color":[0.37,0.41,0.31],"mass":14,"movable":true,"collidable":true,"aliases":["搬运手推车"]}},"objects":[{"templateId":"campWall","id":"WH_B","name":"物资仓库后墙","p":[-9,0,-8],"w":6},{"templateId":"campWall","id":"WH_L","name":"物资仓库左墙","p":[-12,0,-5],"w":0.16,"d":6},{"templateId":"campWall","id":"WH_R","name":"物资仓库右墙","p":[-6,0,-5],"w":0.16,"d":6},{"templateId":"campWall","id":"WH_F1","name":"物资仓库门侧墙","p":[-11.05,0,-2],"w":1.9000000000000004},{"templateId":"campWall","id":"WH_F2","name":"物资仓库门侧墙","p":[-6.95,0,-2],"w":1.9000000000000004},{"templateId":"campWall","id":"BK_B","name":"士兵营房后墙","p":[-2.6,0,-8],"w":4.8},{"templateId":"campWall","id":"BK_L","name":"士兵营房左墙","p":[-5,0,-5],"w":0.16,"d":6},{"templateId":"campWall","id":"BK_R","name":"士兵营房右墙","p":[-0.2,0,-5],"w":0.16,"d":6},{"templateId":"campWall","id":"BK_F1","name":"士兵营房门侧墙","p":[-4.3,0,-2],"w":1.4},{"templateId":"campWall","id":"BK_F2","name":"士兵营房门侧墙","p":[-0.9,0,-2],"w":1.4000000000000001},{"templateId":"campWall","id":"HQ_B","name":"营区办公室后墙","p":[2.45,0,-8],"w":3.6},{"templateId":"campWall","id":"HQ_L","name":"营区办公室左墙","p":[0.65,0,-5],"w":0.16,"d":6},{"templateId":"campWall","id":"HQ_R","name":"营区办公室右墙","p":[4.25,0,-5],"w":0.16,"d":6},{"templateId":"campWall","id":"HQ_F1","name":"营区办公室门侧墙","p":[1.1,0,-2],"w":0.9000000000000002},{"templateId":"campWall","id":"HQ_F2","name":"营区办公室门侧墙","p":[3.8,0,-2],"w":0.8999999999999999},{"templateId":"campWall","id":"KT_B","name":"食堂后墙","p":[-9,0,8],"w":6},{"templateId":"campWall","id":"KT_L","name":"食堂左墙","p":[-12,0,5],"w":0.16,"d":6},{"templateId":"campWall","id":"KT_R","name":"食堂右墙","p":[-6,0,5],"w":0.16,"d":6},{"templateId":"campWall","id":"KT_F1","name":"食堂门侧墙","p":[-11.05,0,2],"w":1.9000000000000004},{"templateId":"campWall","id":"KT_F2","name":"食堂门侧墙","p":[-6.95,0,2],"w":1.9000000000000004},{"templateId":"supplyRack","id":"RACK_A","name":"被装物资货架","p":[-10.35,0,-7.4]},{"templateId":"supplyRack","id":"RACK_B","name":"日用物资货架","p":[-7.65,0,-7.4]},{"templateId":"supplyRack","id":"RACK_C","name":"耗材货架","p":[-11.45,0,-5.3],"w":0.55,"d":1.8},{"templateId":"bunk","id":"BED_A","name":"一号双层床","p":[-4.27,0,-6.4]},{"templateId":"bunk","id":"BED_B","name":"二号双层床","p":[-1,0,-6.4]},{"templateId":"locker","id":"LOCK_A","name":"一号储物柜","p":[-4.25,0,-2.65]},{"templateId":"locker","id":"LOCK_B","name":"二号储物柜","p":[-0.95,0,-2.65]},{"templateId":"officeDesk","id":"DESK_A","name":"值班办公桌","p":[1.6,0,-6.6]},{"templateId":"campChair","id":"CHAIR_A","name":"值班办公椅","p":[1.6,0,-5.65]},{"templateId":"locker","id":"FILE_A","name":"档案柜","p":[3.65,0,-7.2]},{"templateId":"noticeboard","id":"BOARD_A","name":"值勤公告栏","p":[3.7,0,-5.4],"w":0.18,"d":1.1},{"templateId":"kitchenCounter","id":"COOK_A","name":"食材备餐台","p":[-10.4,0,7.35]},{"templateId":"kitchenCounter","id":"COOK_B","name":"餐具清洗台","p":[-7.7,0,7.35]},{"templateId":"diningTable","id":"TABLE_A","name":"一号餐桌","p":[-10.65,0,4.6]},{"templateId":"diningTable","id":"TABLE_B","name":"二号餐桌","p":[-7.35,0,4.6]},{"templateId":"bench","id":"SEAT_11","name":"食堂长凳","p":[-10.65,0,3.85],"w":1.25,"d":0.33,"h":0.44},{"templateId":"bench","id":"SEAT_12","name":"食堂长凳","p":[-10.65,0,5.35],"w":1.25,"d":0.33,"h":0.44},{"templateId":"bench","id":"SEAT_21","name":"食堂长凳","p":[-7.35,0,3.85],"w":1.25,"d":0.33,"h":0.44},{"templateId":"bench","id":"SEAT_22","name":"食堂长凳","p":[-7.35,0,5.35],"w":1.25,"d":0.33,"h":0.44},{"templateId":"guardBooth","id":"GATE_A","name":"门岗值班亭","p":[3.25,0,2.25]},{"templateId":"noticeboard","id":"BOARD_B","name":"营区事务公告栏","p":[2.8,0,4.1]},{"templateId":"campBin","id":"BIN_A","name":"可回收物桶","p":[3.4,0,5.25]},{"templateId":"campBin","id":"BIN_B","name":"其他废弃物桶","p":[4,0,5.25]},{"templateId":"handcart","id":"CART_A","name":"物资周转手推车","p":[-5.25,0,0.2],"friction":0.08},{"templateId":"campFence","id":"FENCE_N","name":"营区与村道围栏","p":[4.65,0,-5.25],"d":7.5},{"templateId":"campFence","id":"FENCE_S","name":"营区与村道围栏","p":[4.65,0,5.25],"d":7.5},{"templateId":"campWall","id":"BACK_N","name":"营区北侧围墙","p":[-3.55,0,-8.65],"w":17,"h":1.05,"d":0.12},{"templateId":"campWall","id":"BACK_S","name":"营区南侧围墙","p":[-3.55,0,8.65],"w":17,"h":1.05,"d":0.12},{"templateId":"campFence","id":"BACK_W","name":"营区西侧围栏","p":[-12.65,0,0],"d":17.4},{"templateId":"villageHouse","id":"HOME_A","name":"村民住宅甲","p":[8.15,0,6.8],"w":2.5},{"templateId":"villageHouse","id":"HOME_B","name":"村民住宅乙","p":[11.4,0,6.8],"w":2.3,"color":[0.65,0.58,0.44]},{"templateId":"marketStall","id":"STALL_A","name":"农产品交货棚","p":[11.6,0,2.45]},{"templateId":"bench","id":"V_BENCH","name":"村口长凳","p":[8,0,3.7]},{"templateId":"farmBed","id":"BED_11","name":"蔬菜种植畦","p":[8,0,-6.65]},{"templateId":"farmBed","id":"BED_12","name":"蔬菜种植畦","p":[8,0,-4.7]},{"templateId":"farmBed","id":"BED_21","name":"蔬菜种植畦","p":[11.4,0,-6.65]},{"templateId":"farmBed","id":"BED_22","name":"蔬菜种植畦","p":[11.4,0,-4.7]},{"templateId":"campTree","id":"TREE_A","name":"院落树木","p":[7.25,0,8.55]},{"templateId":"campTree","id":"TREE_B","name":"院落树木","p":[12,0,8.5]},{"templateId":"campTree","id":"TREE_C","name":"院落树木","p":[7.15,0,-8]},{"templateId":"campTree","id":"TREE_D","name":"院落树木","p":[11.8,0,-8]},{"templateId":"campTree","id":"TREE_E","name":"院落树木","p":[0.1,0,8]},{"templateId":"campLamp","id":"LAMP_A","name":"道路照明灯","p":[-11.8,0,-1]},{"templateId":"campLamp","id":"LAMP_B","name":"道路照明灯","p":[-5.55,0,-0.9]},{"templateId":"campLamp","id":"LAMP_C","name":"道路照明灯","p":[3.9,0,-0.8]},{"templateId":"campLamp","id":"LAMP_D","name":"道路照明灯","p":[6.2,0,3]},{"templateId":"supplyCrate","id":"SUP_A","name":"被装补给箱","p":[-10.2,0,-4.65],"mass":3.5,"aliases":["被装","被装箱"]},{"templateId":"supplyCrate","id":"SUP_B","name":"食堂日用品箱","p":[-7.8,0,-4.65],"mass":4.5,"color":[0.51,0.44,0.25],"aliases":["日用品箱"]},{"templateId":"supplyCrate","id":"SUP_C","name":"保养耗材箱","p":[-10,0,-5.8],"mass":2.5,"color":[0.28,0.4,0.38],"aliases":["耗材箱"]},{"templateId":"campParcel","id":"DOC_A","name":"待移交文件包","p":[2.65,0,-6.25],"aliases":["文件包"]},{"templateId":"supplyCrate","id":"EMPTY_A","name":"食堂空周转箱","p":[-9,0,5.55],"mass":0.8,"color":[0.57,0.51,0.35],"aliases":["空箱"]},{"templateId":"vegetableCrate","id":"AGR_A","name":"青菜筐","p":[8.25,0,-2.95],"mass":2.5,"aliases":["青菜"]},{"templateId":"vegetableCrate","id":"AGR_B","name":"根菜筐","p":[11.2,0,-2.95],"mass":3.2,"aliases":["根菜"]},{"templateId":"vegetableCrate","id":"AGR_C","name":"田间收获筐","p":[9.65,0,-7.65],"mass":2,"aliases":["收获筐"]}],"zones":[{"id":"Z1","name":"门岗交接","p":[3.5,0,0],"r":0.65,"shape":"square","area":"gate","color":[0.26,0.47,0.43],"aliases":["门岗交接"],"activities":["walk","carry","greet"]},{"id":"Z2","name":"集合场","p":[-2.4,0,4.5],"r":0.8,"shape":"square","area":"parade","color":[0.26,0.47,0.43],"aliases":["集合场"],"activities":["walk","carry","greet"]},{"id":"Z3","name":"仓库收货","p":[-9,0,-3.35],"r":0.68,"shape":"square","area":"warehouse","color":[0.26,0.47,0.43],"aliases":["仓库收货"],"activities":["walk","carry","greet"]},{"id":"Z4","name":"仓库归还","p":[-9,0,-5.75],"r":0.6,"shape":"square","area":"warehouse","color":[0.26,0.47,0.43],"aliases":["仓库归还"],"activities":["walk","carry","greet"]},{"id":"Z5","name":"营房补给","p":[-2.5,0,-4],"r":0.65,"shape":"square","area":"barracks","color":[0.26,0.47,0.43],"aliases":["营房补给"],"activities":["walk","carry","greet"]},{"id":"Z6","name":"办公室报到","p":[2.15,0,-3.65],"r":0.6,"shape":"square","area":"office","color":[0.26,0.47,0.43],"aliases":["办公室报到"],"activities":["walk","carry","greet"]},{"id":"Z7","name":"事务交接","p":[1.3,0,2.4],"r":0.65,"shape":"square","area":"services","color":[0.26,0.47,0.43],"aliases":["事务交接"],"activities":["walk","carry","greet"]},{"id":"Z8","name":"食堂接货","p":[-9,0,3.25],"r":0.65,"shape":"square","area":"canteen","color":[0.26,0.47,0.43],"aliases":["食堂接货"],"activities":["walk","carry","greet"]},{"id":"Z9","name":"回收交接","p":[2,0,6.2],"r":0.65,"shape":"square","area":"services","color":[0.26,0.47,0.43],"aliases":["回收交接"],"activities":["walk","carry","greet"]},{"id":"Z10","name":"营区地面休息","p":[-0.7,0,7.1],"r":0.85,"shape":"circle","area":"rest","color":[0.39,0.49,0.61],"aliases":["营区地面休息"],"activities":["walk","sit_ground","lie_ground","stand_up"]},{"id":"Z11","name":"农产品分拣","p":[9.7,0,-1.9],"r":0.62,"shape":"square","area":"village","color":[0.69,0.53,0.27],"aliases":["农产品分拣"],"activities":["walk","carry","greet"]},{"id":"Z12","name":"村口交接","p":[7.55,0,0],"r":0.7,"shape":"square","area":"village","color":[0.69,0.53,0.27],"aliases":["村口交接"],"activities":["walk","carry","greet"]},{"id":"Z13","name":"耗材归整","p":[-7.3,0,-3.3],"r":0.6,"shape":"square","area":"warehouse","color":[0.26,0.47,0.43],"aliases":["耗材归整"],"activities":["walk","carry","greet"]},{"id":"Z14","name":"田间作业点","p":[9.65,0,-5.5],"r":0.65,"shape":"square","area":"farm","color":[0.69,0.53,0.27],"aliases":["田间作业点"],"activities":["walk","carry","greet"]},{"id":"Z15","name":"周转车停放","p":[-5.3,0,1.35],"r":0.55,"shape":"square","area":"services","color":[0.26,0.47,0.43],"aliases":["周转车停放"],"activities":["walk","carry","greet"]},{"id":"Z16","name":"村庄地面休息","p":[9.75,0,4.4],"r":0.85,"shape":"circle","area":"rest","color":[0.39,0.49,0.61],"aliases":["村庄地面休息"],"activities":["walk","sit_ground","lie_ground","stand_up"]},{"id":"Z17","name":"村口青菜交货","p":[8.5,0,1.2],"r":0.6,"shape":"square","area":"village","color":[0.69,0.53,0.27],"aliases":["青菜交货"],"activities":["walk","carry"]},{"id":"Z18","name":"村口根菜交货","p":[10,0,0.9],"r":0.6,"shape":"square","area":"village","color":[0.69,0.53,0.27],"aliases":["根菜交货"],"activities":["walk","carry"]}],"ground":[{"id":"terrain","p":[0,-0.027,0],"size":[26.3,0.025,19.1],"color":[0.34,0.4,0.26]},{"id":"main_avenue","p":[-0.6,-0.0262,0],"size":[25.1,0.025,3],"color":[0.42,0.43,0.39]},{"id":"village_road","p":[5.9,-0.0254,0],"size":[1.8,0.025,18.4],"color":[0.52,0.49,0.38]},{"id":"camp_apron","p":[-3.5,-0.0246,0.1],"size":[16.3,0.025,2.7],"color":[0.49,0.49,0.42]},{"id":"parade","p":[-2.4,-0.023799999999999998,5],"size":[5.8,0.025,6.3],"color":[0.53,0.54,0.45]},{"id":"village_yard","p":[9.7,-0.023,3.7],"size":[5.8,0.025,4.3],"color":[0.59,0.54,0.39]},{"id":"farm_track","p":[9.8,-0.022199999999999998,-3.15],"size":[5.6,0.025,1.7],"color":[0.5,0.42,0.28]},{"id":"farm_crosswalk","p":[9.7,-0.0214,-6.2],"size":[1.1,0.025,5.8],"color":[0.5,0.42,0.28]},{"id":"WH_FLOOR","p":[-9,-0.0206,-5],"size":[6,0.025,6],"color":[0.63,0.6,0.49]},{"id":"BK_FLOOR","p":[-2.6,-0.019799999999999998,-5],"size":[4.8,0.025,6],"color":[0.63,0.6,0.49]},{"id":"HQ_FLOOR","p":[2.45,-0.019,-5],"size":[3.6,0.025,6],"color":[0.63,0.6,0.49]},{"id":"KT_FLOOR","p":[-9,-0.0182,5],"size":[6,0.025,6],"color":[0.63,0.6,0.49]}],"roofs":[{"id":"WH_ROOF","p":[-9,2.45,-5],"size":[6.25,0.12,6.25],"color":[0.3,0.36,0.27]},{"id":"BK_ROOF","p":[-2.6,2.45,-5],"size":[5.05,0.12,6.25],"color":[0.3,0.36,0.27]},{"id":"HQ_ROOF","p":[2.45,2.45,-5],"size":[3.85,0.12,6.25],"color":[0.3,0.36,0.27]},{"id":"KT_ROOF","p":[-9,2.45,5],"size":[6.25,0.12,6.25],"color":[0.3,0.36,0.27]}],"rooms":[{"id":"WH","name":"物资仓库","xMin":-12,"xMax":-6,"zMin":-8,"zMax":-2,"door":{"x":-9,"z":-2,"widthM":2.2}},{"id":"BK","name":"士兵营房","xMin":-5,"xMax":-0.2,"zMin":-8,"zMax":-2,"door":{"x":-2.6,"z":-2,"widthM":2}},{"id":"HQ","name":"营区办公室","xMin":0.65,"xMax":4.25,"zMin":-8,"zMax":-2,"door":{"x":2.45,"z":-2,"widthM":1.8}},{"id":"KT","name":"食堂","xMin":-12,"xMax":-6,"zMin":2,"zMax":8,"door":{"x":-9,"z":2,"widthM":2.2}}],"presentation":{"cutaway":true,"background":[0.69,0.75,0.72],"overview":{"target":[-0.2,0.3,0],"distance":39,"pitch":1,"yaw":0.16}},"designNotes":["虚构的日常后勤场景；营区与村庄通过门岗和村道相连。","建筑使用剖切墙体；屋顶可显示，室内家具保留完整碰撞。","座椅是环境物件，当前休息动作在标出的空旷地面执行。","一个可控制身体按身份载入任务；本版不生成多名自主行走角色。"]};
function sceneBounds(world){return world?.bounds||FIELD_BOUNDS;}
function validateSceneBounds(input){
 if(input==null)return {...FIELD_BOUNDS};
 const b={};for(const k of ['xMin','xMax','zMin','zMax']){if(!Number.isFinite(input[k])||Math.abs(input[k])>40)throw Error('场景边界需要 -40 至 40 米的有限数值');b[k]=input[k];}
 if(b.xMax-b.xMin<3||b.zMax-b.zMin<3||b.xMax-b.xMin>40||b.zMax-b.zMin>40)throw Error('场景长宽需要为 3 至 40 米');return b;
}
function campColored(parts){
 const g=combine(parts.map(p=>p.g)),c=new Float32Array(g.p.length);let offset=0;
 for(const p of parts){if(p.g.c)c.set(p.g.c,offset);else for(let i=0;i<p.g.p.length;i+=3)c.set(p.color,offset+i);offset+=p.g.p.length;}g.c=c;return g;
}
function campFurniture(def){
 if(!Object.hasOwn(CAMP_WORLD.templates,def.templateId)||def.shape!=='box')return null;
 const {w,h,d}=def,parts=[],base=def.color,metal=[.27,.32,.27],wood=[.42,.29,.17],linen=[.70,.70,.57],dark=[.18,.23,.19];
 const part=(x,y,z,W,H,D,color=base,q=qi())=>parts.push({g:transform(box(W,H,D),[x,y-h/2,z],q),color});
 const post=(x,z,height=h)=>part(x,height/2,z,.04,height,.04,metal);
 const top=(y,color=base)=>part(0,y,0,w,.045,d,color);
 const kind=def.templateId;
 if(kind==='campWall'){part(0,h/2,0,w,h,d);part(0,h-.02,0,w,.04,d,[.72,.70,.59]);part(0,.09,0,w,.18,d+.006,[.43,.45,.36]);}
 else if(kind==='campFence'){
  const alongX=w>d,L=alongX?w:d,n=Math.max(2,Math.ceil(L/.38));
  for(let i=0;i<=n;i++){const v=-L/2+.025+(L-.05)*i/n;part(alongX?v:0,h/2,alongX?0:v,.035,h,.035,metal);}
  for(const y of [h*.22,h*.75])part(0,y,0,alongX?w:.025,.035,alongX?.025:d,metal);
 }
 else if(kind==='bunk'){
  for(const x of [-w*.44,w*.44])for(const z of [-d*.47,d*.47])post(x,z);
  for(const y of [.24,h*.72]){part(0,y,0,w,.075,d,metal);part(0,y+.065,0,w*.94,.09,d*.95,linen);part(0,y+.12,-d*.32,w*.7,.07,d*.20,[.79,.77,.64]);part(0,y+.12,d*.14,w*.91,.035,d*.53,base);}
  for(let i=0;i<4;i++)part(w*.47,.35+i*.29,d*.22,.035,.025,d*.34,metal);
 }
 else if(kind==='locker'){
  part(0,h/2,0,w,h,d);part(0,h/2,d/2+.001,.012,h*.93,.008,dark);
  for(const x of [-w*.11,w*.11]){part(x,h*.53,d/2+.009,.02,.12,.018,linen);for(let j=0;j<3;j++)part(x,h*.82+j*.045,d/2+.006,w*.27,.015,.01,dark);}
 }
 else if(kind==='supplyRack'){
  for(const x of [-w*.48,w*.48])for(const z of [-d*.45,d*.45])post(x,z);
  for(let i=0;i<4;i++){const y=.07+i*(h-.15)/3;part(0,y,0,w,.04,d,metal);if(i<3)for(const x of [-w*.27,w*.27])part(x,y+.13,0,w*.35,.22,d*.79,i%2?wood:[.53,.50,.33]);}
 }
 else if(['officeDesk','diningTable','kitchenCounter'].includes(kind)){
  top(h-.025,kind==='kitchenCounter'?[.67,.70,.66]:base);
  for(const x of [-w*.43,w*.43])for(const z of [-d*.4,d*.4])post(x,z,h-.045);
  if(kind==='officeDesk'){part(w*.3,h*.58,0,w*.28,h*.55,d*.9,wood);part(-w*.22,h+.018,0,w*.22,.028,d*.45,linen);}
  if(kind==='kitchenCounter'){part(0,h*.38,0,w*.95,h*.65,d*.92,metal);part(-w*.22,h+.01,0,w*.28,.018,d*.52,dark);}
 }
 else if(kind==='campChair'){
  part(0,h*.48,0,w,.065,d,base);part(0,h*.77,-d*.43,w,h*.45,.055,base);for(const x of [-w*.4,w*.4])for(const z of [-d*.38,d*.38])post(x,z,h*.45);
 }
 else if(kind==='noticeboard'){
  const side=d>w;for(const v of [-.4,.4])post(side?0:w*v,side?d*v:0);
  part(0,h*.73,0,w,h*.45,d,wood);for(const v of [-.26,.20])part(side?w*.51:w*v,h*.73,side?d*v:d*.51,side?.012:w*.3,h*.29,side?d*.3:.012,linen);
 }
 else if(['guardBooth','villageHouse'].includes(kind)){
  part(0,h*.42,0,w,h*.84,d,base);part(0,h*.44,d/2+.004,w*.25,h*.55,.014,wood);
  for(const x of [-w*.32,w*.32]){part(x,h*.56,d/2+.01,w*.18,h*.22,.018,dark);part(x,h*.56,d/2+.02,.02,h*.23,.025,linen);}
  const slope=.25,roofW=w*.53;for(const sign of [-1,1])part(sign*w*.25,h*.91,0,roofW,.09,d*.99,kind==='villageHouse'?[.46,.28,.19]:metal,qz(-sign*slope));
 }
 else if(kind==='marketStall'){
  for(const x of [-w*.46,w*.46])for(const z of [-d*.43,d*.43])post(x,z,h*.97);
  top(h*.47,wood);part(0,h*.97,0,w,.07,d,base);part(0,h*.3,0,w*.9,h*.28,d*.8,wood);
 }
 else if(kind==='farmBed'){
  part(0,h*.22,0,w,h*.44,d,[.30,.23,.14]);
  for(let i=0;i<7;i++)for(let j=0;j<3;j++){const x=(-.42+i*.14)*w,z=(-.33+j*.33)*d;part(x,h*.63,z,w*.055,h*.62,d*.1,[.27,.43,.18],qz(i%2?.18:-.18));}
 }
 else if(kind==='campTree'){
  part(0,h*.35,0,w*.15,h*.7,d*.15,wood);
  for(const [y,s] of [[.56,1],[.74,.83],[.84,.53]])parts.push({g:transform(cylinder(w*s/2,h*.32,7,w*s*.35),[0,h*y-h/2,0]),color:base});
 }
 else if(kind==='campLamp'){
  part(0,h*.48,0,w*.24,h*.96,d*.24,metal);part(0,h*.94,0,w,h*.1,d,linen);part(0,h*.997,0,w,.006,d,metal);
 }
 else if(kind==='campBin'){part(0,h*.46,0,w*.93,h*.92,d*.93);top(h*.94,metal);part(0,h*.57,d*.48,w*.45,h*.14,.014,linen);}
 else if(['supplyCrate','vegetableCrate','campParcel'].includes(kind)){
  part(0,h*.45,0,w,h*.9,d);top(h*.94,kind==='campParcel'?base:wood);
  if(kind!=='campParcel'){for(const x of [-w*.36,w*.36])part(x,h*.48,d*.502,.035,h*.92,.009,wood);part(0,h*.51,d*.508,w*.40,h*.27,.012,linen);}
  if(kind==='vegetableCrate')for(const x of [-w*.28,0,w*.28])part(x,h*.93,0,w*.2,h*.12,d*.45,[.29,.47,.20]);
 }
 else if(kind==='handcart'){
  part(0,.23,0,w,.08,d,wood);for(const x of [-w*.43,w*.43]){part(x,.56,-d*.43,.04,h-.23,.04,metal);for(const z of [-d*.33,d*.33])parts.push({g:transform(cylinder(.12,.06,12),[x,.12-h/2,z],qz(Math.PI/2)),color:dark});}part(0,h-.025,-d*.43,w,.04,.04,metal);
 }
 else return null;
 return campColored(parts);
}
function installCampPreset(world,addObject){
 world.bounds={...CAMP_WORLD.bounds};world.theme='camp';
 for(const raw of CAMP_WORLD.objects){const {templateId,id,name,p,...extra}=raw;addObject(templateId,id,name,p,extra);}
 world.zones=CAMP_WORLD.zones.map(z=>world.normalizeZone(z,z.id));prepareCampScenery(world);
}
function prepareCampScenery(world){
 world.scenery=[];world.roofItems=[];world.showRoofs=false;
 if(world.theme!=='camp')return;
 const item=raw=>({g:box(...raw.size),p:[...raw.p],q:qi(),color:[...raw.color],castShadow:false});
 // Ground and roofs are presentation only. All tall props are world entities.
 const ground=campColored(CAMP_WORLD.ground.map(raw=>({g:transform(box(...raw.size),raw.p),color:raw.color})));
 world.scenery=[{g:ground,p:[0,0,0],q:qi(),castShadow:false}];world.roofItems=CAMP_WORLD.roofs.map(item);
}
function configureWorldPresentation(){
 if(!world||!renderer)return;const camp=world.theme==='camp',b=sceneBounds(world);
 if(floor){floor.g=box(b.xMax-b.xMin+.3,.035,b.zMax-b.zMin+.3);floor.p=[(b.xMin+b.xMax)/2,-.04,(b.zMin+b.zMax)/2];floor.color=camp?[.34,.40,.26]:[.19,.22,.23];}
 renderer.background=camp?[...CAMP_WORLD.presentation.background]:null;
 renderer.lightVP=camp?mm(ortho(-19,19,-17,17,.1,60),lookAt([-13,24,13],[0,0,0])):mm(ortho(-5.2,5.2,-4.4,4.4,.1,20),lookAt([-4,8,5],[0,0,0]));
}
function campOverview(region='all'){
 if(world?.theme!=='camp')throw Error('当前场景不是军营与邻村');
 if(['hands','shoulders','torso','headNeck','lowerLimb'].some(k=>window.HumanLab?.[k]?.active))throw Error('请先退出部位编辑视图');
 focus('field');const view=region==='village'?{target:[9.6,.3,0],distance:24,pitch:1.05,yaw:0}:region==='camp'?{target:[-3.6,.3,0],distance:31,pitch:1.05,yaw:.12}:CAMP_WORLD.presentation.overview;
 Object.assign(renderer,{projection:'perspective',target:[...view.target],distance:view.distance,pitch:view.pitch,yaw:view.yaw});needsRedraw=true;
}

// MODULE camp_navigation
/*__SOURCE:world/GridNavigation.js__*/

// MODULE world_entities
const PHYSICAL_REASONING_PROFILE=Object.freeze({schema:'knowledge_human/body_physical_profile@2.0',profileId:'humanoid_muscle_capacity_v1',strengthModel:'jarvis/strength_profile@1',maxGripSpanM:.66,maxCarryRadiusM:.42,maxCarryHeightM:.95,bodyRadiusM:.26,carryClearanceM:.43,pushClearanceM:.34,nominalWalkMps:.50,nominalCarryMps:.43,nominalPushMps:.22,note:'几何通行参数；力量由当前肌群和状态计算，尚未进行真人校准'});
const SHAPE_LABELS=Object.freeze({box:'长方体',sphere:'球体',cylinder:'圆柱',cone:'圆锥',prism:'三棱柱'});
const SHAPE_ALIASES=Object.freeze({box:['长方体','方块','箱子','方盒'],sphere:['球体','球'],cylinder:['圆柱','柱体'],cone:['圆锥','锥体'],prism:['三棱柱','棱柱']});
const OBJECT_TEMPLATES=Object.freeze({
 ...CAMP_WORLD.templates,
 worktable:Object.freeze({templateId:'worktable',name:'工作台',category:'furniture',shape:'box',w:1.15,h:.75,d:.62,mass:60,movable:false,collidable:true,color:[.35,.255,.16],aliases:['工作台','桌子']}),
 shelf:Object.freeze({templateId:'shelf',name:'储物架',category:'furniture',shape:'box',w:1.15,h:1.5,d:.38,mass:90,movable:false,collidable:true,color:[.26,.22,.17],aliases:['储物架','书架']}),
 bench:Object.freeze({templateId:'bench',name:'休息长凳',category:'furniture',shape:'box',w:1.25,h:.44,d:.45,mass:50,movable:false,collidable:true,color:[.27,.32,.29],aliases:['长凳','休息长凳']}),
 box:Object.freeze({templateId:'box',name:'训练箱',category:'movable',shape:'box',color:[.63,.09,.055],w:.30,h:.28,d:.28,mass:1.2,movable:true,collidable:true,aliases:['训练箱','箱子','方块']}),
 sphere:Object.freeze({templateId:'sphere',name:'训练球',category:'movable',shape:'sphere',color:[.045,.27,.78],r:.15,mass:.7,movable:true,collidable:true,aliases:['训练球','球体','球']}),
 cylinder:Object.freeze({templateId:'cylinder',name:'训练圆柱',category:'movable',shape:'cylinder',color:[.91,.53,.04],r:.13,h:.29,mass:1,movable:true,collidable:true,aliases:['训练圆柱','圆柱','柱体']}),
 cone:Object.freeze({templateId:'cone',name:'训练圆锥',category:'movable',shape:'cone',color:[.05,.50,.24],r:.15,h:.31,mass:.8,movable:true,collidable:true,aliases:['训练圆锥','圆锥','锥体']}),
 prism:Object.freeze({templateId:'prism',name:'训练三棱柱',category:'movable',shape:'prism',color:[.46,.17,.70],r:.17,h:.27,mass:1.1,movable:true,collidable:true,aliases:['训练三棱柱','三棱柱','棱柱']}),
 wall:Object.freeze({templateId:'wall',name:'障碍墙',category:'obstacle',shape:'box',color:[.18,.25,.31],w:1.45,h:.82,d:.16,mass:80,movable:false,collidable:true,aliases:['障碍墙','墙','挡板','障碍物']}),
 pillar:Object.freeze({templateId:'pillar',name:'障碍柱',category:'obstacle',shape:'cylinder',color:[.22,.30,.35],r:.22,h:.92,mass:60,movable:false,collidable:true,aliases:['障碍柱','柱子','立柱','障碍物']}),
 platform:Object.freeze({templateId:'platform',name:'低平台',category:'obstacle',shape:'box',color:[.24,.28,.32],w:.78,h:.20,d:.62,mass:90,movable:false,collidable:true,aliases:['低平台','平台','台子','障碍物']}),
 landmark:Object.freeze({templateId:'landmark',name:'导航标记',category:'landmark',shape:'cylinder',color:[.08,.66,.74],r:.10,h:.035,mass:0,movable:false,collidable:false,aliases:['导航标记','标记点','目标点','路标']})
});
const DEFAULT_OBJECTS=Object.freeze([
 Object.freeze({id:'A',templateId:'box',name:'红色长方体',color:[.63,.075,.045],aliases:['红色','红','长方体','方块','箱子','方盒']}),
 Object.freeze({id:'B',templateId:'sphere',name:'蓝色球体',color:[.035,.23,.70],aliases:['蓝色','蓝','球体','球','蓝球']}),
 Object.freeze({id:'C',templateId:'cylinder',name:'黄色圆柱',color:[.85,.48,.025],aliases:['黄色','黄','圆柱','柱体']}),
 Object.freeze({id:'D',templateId:'cone',name:'绿色圆锥',color:[.045,.46,.22],aliases:['绿色','绿','圆锥','锥体']}),
 Object.freeze({id:'E',templateId:'prism',name:'紫色三棱柱',color:[.40,.13,.62],aliases:['紫色','紫','三棱柱','棱柱']})
]);
const DEFAULT_ZONES=Object.freeze([
 Object.freeze({id:'Z1',name:'一区 · 正方形实线',shape:'square',p:[-2.55,0,-2.2],r:.70,color:[.13,.52,.56],aliases:['Z1','一区','区域一','一号','正方形','实线']}),
 Object.freeze({id:'Z2',name:'二区 · 圆形虚线',shape:'circle',p:[0,0,-2.2],r:.72,color:[.78,.48,.14],aliases:['Z2','二区','区域二','二号','圆形','虚线']}),
 Object.freeze({id:'Z3',name:'三区 · 六边形点线',shape:'hexagon',p:[2.55,0,-2.2],r:.80,color:[.48,.36,.71],aliases:['Z3','三区','区域三','三号','六边形','点线']})
]);
const SCENE_PRESETS=Object.freeze({
 camp:Object.freeze({id:'camp',name:'军营与邻村',description:'营房、仓储、食堂、日常管理区与附近村庄；配有职业长任务'}),
 living:Object.freeze({id:'living',name:'智能生活空间',description:'工作、交流、地面休息区域与可交互物体；保留任务检查和避障'}),
 sorting:Object.freeze({id:'sorting',name:'搬运与分类',description:'五个可搬运物体与三个目标区域，适合抓取、搬运、推动和排序测试'}),
 obstacle:Object.freeze({id:'obstacle',name:'障碍绕行',description:'静态墙体、立柱与可搬运物体，适合路线规划和避障测试'}),
 corridor:Object.freeze({id:'corridor',name:'狭窄通道',description:'两组长墙构成通道，适合净空、转向和目标接近测试'}),
 mixed:Object.freeze({id:'mixed',name:'混合训练场',description:'可搬运物体、静态障碍、平台和导航标记同时存在'}),
 empty:Object.freeze({id:'empty',name:'空场地',description:'保留目标区域并清空物体，适合基础步态和手势测试'})
});
const clone=v=>JSON.parse(JSON.stringify(v));
const finite=(v,fallback,min=-Infinity,max=Infinity)=>{v=Number(v);return Number.isFinite(v)?clamp(v,min,max):fallback};
const uniqueStrings=values=>[...new Set((values||[]).flatMap(v=>String(v||'').split(/[，,;；]/)).map(v=>v.trim()).filter(Boolean))];
function normalizeColor(value,fallback=[.35,.45,.52]){if(typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value))return[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255);if(Array.isArray(value)&&value.length>=3)return value.slice(0,3).map((v,i)=>finite(v,fallback[i],0,1));return[...fallback]}
function objectYaw(o){return Number.isFinite(o?.yaw)?o.yaw:2*Math.atan2(o?.q?.[1]||0,o?.q?.[3]||1)}
function objectFootprint(o){const yaw=objectYaw(o);return o.shape==='box'?[Math.abs(Math.cos(yaw))*o.w/2+Math.abs(Math.sin(yaw))*o.d/2,Math.abs(Math.sin(yaw))*o.w/2+Math.abs(Math.cos(yaw))*o.d/2]:[o.r,o.r];}
function findHumanSpawn(world){
 const bounds=sceneBounds(world),preferred=world.theme==='camp'?[...CAMP_WORLD.spawn]:[0,0,1.75];if(!world.collision(preferred,.32))return preferred;
 const candidates=[];
 for(let z=bounds.zMin+.4;z<=bounds.zMax-.4;z+=.25)for(let x=bounds.xMin+.4;x<=bounds.xMax-.4;x+=.25)candidates.push([x,0,z]);
 candidates.sort((a,b)=>dist(a,preferred)-dist(b,preferred));
 const point=candidates.find(p=>!world.collision(p,.32));if(!point)throw Error('场景没有足够的人物站立空间');return point;
}
function objectRadius(o){return o.shape==='box'?Math.hypot(o.w,o.d)/2:o.r}
function pointToObjectClearance(p,o){const dx=p[0]-o.p[0],dz=p[2]-o.p[2];if(o.shape==='box'){const a=-objectYaw(o),x=Math.cos(a)*dx-Math.sin(a)*dz,z=Math.sin(a)*dx+Math.cos(a)*dz,qx=Math.max(Math.abs(x)-o.w/2,0),qz=Math.max(Math.abs(z)-o.d/2,0);return Math.hypot(qx,qz)}return Math.max(0,Math.hypot(dx,dz)-o.r)}
function circleHitsObject(p,r,o){return o.collidable!==false&&pointToObjectClearance(p,o)<r}
class World{
 constructor(seed=260901){this.bounds={...FIELD_BOUNDS};this.theme=null;this.scenery=[];this.roofItems=[];this.geometryCache=new Map();this.sceneId='scene_training_default';this.sceneName='搬运与分类';this.presetId='sorting';this.reset(seed)}
 geometryFor(def){const key=[def.templateId||'',def.shape,...(def.color||[]),...[def.w||0,def.h||0,def.d||0,def.r||0].map(v=>Number(v).toFixed(4))].join(':');let g=this.geometryCache.get(key);if(!g){const furniture=campFurniture(def)||activityFurniture(def);if(furniture)g=furniture;else if(def.shape==='box')g=box(def.w,def.h,def.d);else if(def.shape==='sphere')g=ellipsoid([0,0,0],[def.r,def.r,def.r],36,24);else if(def.shape==='cylinder')g=cylinder(def.r,def.h);else if(def.shape==='cone')g=cylinder(def.r,def.h,36,0);else g=cylinder(def.r,def.h,3);this.geometryCache.set(key,g)}return g}
 nextObjectId(){const used=new Set(this.objects.map(o=>o.id));for(let code=65;code<=90;code++){const id=String.fromCharCode(code);if(!used.has(id)&&!id.startsWith('Z'))return id}let n=1;while(used.has('O'+n))n++;return'O'+n}
 nextZoneId(){const used=new Set(this.zones.map(z=>z.id));let n=1;while(used.has('Z'+n))n++;return'Z'+n}
 normalizeObject(input={},idOverride=null){const template=OBJECT_TEMPLATES[input.templateId]||OBJECT_TEMPLATES[input.shape]||OBJECT_TEMPLATES.box,shape=['box','sphere','cylinder','cone','prism'].includes(input.shape)?input.shape:template.shape;let h=finite(input.h,template.h||((template.r||.15)*2),.03,4),w=finite(input.w,template.w||((template.r||.15)*2) ,.04,40),d=finite(input.d,template.d||((template.r||.15)*2) ,.04,40),r=finite(input.r,template.r||Math.max(w,d)/2,.025,3);if(shape==='sphere'){h=r*2;w=r*2;d=r*2}else if(shape!=='box'){w=r*2;d=r*2}const movable=input.movable==null?template.movable!==false:Boolean(input.movable),collidable=input.collidable==null?template.collidable!==false:Boolean(input.collidable),yaw=finite(input.yaw,objectYaw(input),-Math.PI*4,Math.PI*4),id=String(idOverride||input.id||this.nextObjectId()).trim().toUpperCase();if(!/^[A-Z][A-Z0-9_]{0,11}$/.test(id)||id.startsWith('Z'))throw Error('物体 ID 需要以字母开头，且不能使用 Z 区域前缀');const p0=Array.isArray(input.p)?input.p:[finite(input.x,0),0,finite(input.z,0)],p=[finite(p0[0],0,this.bounds.xMin,this.bounds.xMax),h/2,finite(p0[2],0,this.bounds.zMin,this.bounds.zMax)],name=String(input.name||template.name||`${SHAPE_LABELS[shape]} ${id}`).trim().slice(0,28)||`${SHAPE_LABELS[shape]} ${id}`,aliases=uniqueStrings([...(template.aliases||[]),...(SHAPE_ALIASES[shape]||[]),...(input.aliases||[]),name,id]);const normalized={id,templateId:input.templateId||template.templateId||shape,name,category:String(input.category||template.category||(movable?'movable':'obstacle')),color:normalizeColor(input.color,template.color),shape,r:objectRadius({shape,w,d,r}),h,w,d,mass:finite(input.mass,template.mass||1,0,250),friction:finite(input.friction,.4,0,2),gripFriction:finite(input.gripFriction,.6,.05,2),movable,collidable,aliases,p,yaw,q:qy(yaw),g:null,v:[0,0,0],held:Boolean(input.held),moveCount:Math.max(0,Math.floor(finite(input.moveCount,0,0,1e9)))};normalized.g=this.geometryFor(normalized);return normalized}
 normalizeZone(input={},idOverride=null){const id=String(idOverride||input.id||this.nextZoneId()).trim().toUpperCase();if(!/^Z\d{1,3}$/.test(id))throw Error('区域 ID 需要使用 Z 加数字，例如 Z4');const shape=['square','circle','hexagon'].includes(input.shape)?input.shape:'circle',p0=Array.isArray(input.p)?input.p:[finite(input.x,0),0,finite(input.z,0)],name=String(input.name||`${id} 训练区域`).trim().slice(0,28)||`${id} 训练区域`;return{id,name,shape,p:[finite(p0[0],0,this.bounds.xMin,this.bounds.xMax),0,finite(p0[2],0,this.bounds.zMin,this.bounds.zMax)],r:finite(input.r,.72,.25,1.8),color:normalizeColor(input.color,[.16,.58,.65]),aliases:uniqueStrings([...(input.aliases||[]),id,name,shape==='square'?'正方形':shape==='circle'?'圆形':'六边形'])}}
 canPlace(o,ignoreId=null,avoidPoint=null){const [rx,rz]=objectFootprint(o);if(o.p[0]-rx<this.bounds.xMin||o.p[0]+rx>this.bounds.xMax||o.p[2]-rz<this.bounds.zMin||o.p[2]+rz>this.bounds.zMax)return{ok:false,reason:'物体超出训练场安全边界'};if(avoidPoint&&o.collidable!==false&&pointToObjectClearance(avoidPoint,o)<.48)return{ok:false,reason:'物体位置与人物当前站位重叠'};return{ok:true}}
 findOpenPosition(def,avoidPoint=[0,0,1.75]){const candidates=[],large=Object.keys(FIELD_BOUNDS).some(k=>this.bounds[k]!==FIELD_BOUNDS[k]);for(let z=large?this.bounds.zMin+.5:-1.30;z<=(large?this.bounds.zMax-.5:1.05);z+=.42)for(let x=large?this.bounds.xMin+.5:-3.1;x<=(large?this.bounds.xMax-.5:3.1);x+=.46)candidates.push([x,def.h/2,z]);candidates.sort((a,b)=>Math.hypot(a[0],a[2]) - Math.hypot(b[0],b[2]));for(const p of candidates){const candidate={...def,p};if(!this.canPlace(candidate,null,avoidPoint).ok)continue;if(this.objects.every(o=>o.collidable===false||candidate.collidable===false||pointToObjectClearance(p,o)>objectRadius(candidate)+.12))return p}throw Error('当前场景没有足够空位，请先移动或删除部分物体')}
 touch(reason='edit'){this.revision=(this.revision||0)+1;this.lastChange={reason,at:Date.now()}}
 reset(seed=260901){this.bounds={...FIELD_BOUNDS};this.theme=null;prepareCampScenery(this);this.seed=Number(seed)>>>0;this.sceneId='scene_training_default';this.sceneName='搬运与分类';this.presetId='sorting';const rng=seeded(this.seed);this.objects=[];for(const raw of DEFAULT_OBJECTS){const def=this.normalizeObject({...clone(OBJECT_TEMPLATES[raw.templateId]),...clone(raw)},raw.id);let p,ok=false;for(let t=0;t<1000;t++){p=[-2.7+rng()*5.4,def.h/2,-1.02+rng()*2.40];if(this.objects.every(o=>pointToObjectClearance(p,o)>objectRadius(def)+.40)&&Math.hypot(p[0],p[2]-1.75)>.78){ok=true;break}}if(!ok)throw Error('无法找到无碰撞布局');def.p=p;this.objects.push(def)}this.zones=DEFAULT_ZONES.map(z=>this.normalizeZone(clone(z),z.id));this.touch('reset');return this.exportScene()}
 get(id){id=String(id||'').toUpperCase();return this.objects.find(o=>o.id===id)||this.zones.find(z=>z.id===id)}
 collision(p,r,ignore=[]){if(p[0]-r<this.bounds.xMin||p[0]+r>this.bounds.xMax||p[2]-r<this.bounds.zMin||p[2]+r>this.bounds.zMax)return true;return this.objects.some(o=>!ignore.includes(o.id)&&circleHitsObject(p,r+.06,o))}
 inside(o,z){const x=Math.abs(o.p[0]-z.p[0]),y=Math.abs(o.p[2]-z.p[2]);if(z.shape==='square')return x+o.r<=z.r&&y+o.r<=z.r;if(z.shape==='circle')return Math.hypot(x,y)+o.r<=z.r;return Math.hypot(x,y)+o.r<=z.r*Math.cos(Math.PI/6)}
 objectSnapshot(o){return{id:o.id,templateId:o.templateId,name:o.name,category:o.category,shape:o.shape,color:[...o.color],p:[...o.p],yaw:objectYaw(o),q:[...o.q],r:o.r,h:o.h,w:o.w,d:o.d,mass:o.mass,friction:o.friction,gripFriction:o.gripFriction,movable:o.movable!==false,collidable:o.collidable!==false,aliases:[...o.aliases],held:Boolean(o.held),moveCount:o.moveCount||0}}
 zoneSnapshot(z){return{id:z.id,name:z.name,shape:z.shape,color:[...z.color],p:[...z.p],r:z.r,aliases:[...z.aliases]}}
 snapshot(){return{schema:'knowledge_human/training_scene_snapshot@1.0',sceneId:this.sceneId,sceneName:this.sceneName,presetId:this.presetId,seed:this.seed,revision:this.revision,bounds:{...this.bounds},theme:this.theme,activitySpace:activitySpaceSnapshot(this),objects:this.objects.map(o=>this.objectSnapshot(o)),zones:this.zones.map(z=>this.zoneSnapshot(z)),editor:{templates:Object.values(OBJECT_TEMPLATES).map(t=>({templateId:t.templateId,name:t.name,category:t.category,shape:t.shape,movable:t.movable!==false,collidable:t.collidable!==false})),presets:Object.values(SCENE_PRESETS)}}}
 exportScene(){const snap=this.snapshot();return{schema:'knowledge_human/training_scene@1.0',sceneId:snap.sceneId,sceneName:snap.sceneName,presetId:snap.presetId,seed:snap.seed,revision:snap.revision,bounds:snap.bounds,theme:snap.theme,objects:snap.objects.map(o=>{const c={...o};delete c.held;delete c.moveCount;delete c.q;return c}),zones:snap.zones,metadata:{worldTheme:this.theme,coordinateSystem:'right-handed,+Y-up,+Z-forward',units:'meter',navigation:'geometry-aware-ground-clearance',massIsSemanticOnly:false,editedAt:new Date().toISOString()}}}
 addObject(input={},avoidPoint=null){if(this.objects.length>=160)throw Error('训练场物体数量已达到 160 个上限');const id=input.id||this.nextObjectId();let o=this.normalizeObject(input,id);if(!input.p&&!Number.isFinite(input.x)&&!Number.isFinite(input.z))o.p=this.findOpenPosition(o,avoidPoint);const check=this.canPlace(o,null,avoidPoint);if(!check.ok)throw Error(check.reason);this.objects.push(o);this.touch('object.add');return this.objectSnapshot(o)}
 updateEntity(id,patch={},avoidPoint=null){id=String(id||'').toUpperCase();let i=this.objects.findIndex(o=>o.id===id);if(i>=0){const previous=this.objects[i];if(previous.held)throw Error('当前物体正在被人物抓握，不能编辑');const merged={...this.objectSnapshot(previous),...clone(patch),id,p:Array.isArray(patch.p)?patch.p:patch.x!=null||patch.z!=null?[patch.x??previous.p[0],0,patch.z??previous.p[2]]:previous.p,aliases:patch.aliases??previous.aliases};const next=this.normalizeObject(merged,id),check=this.canPlace(next,id,avoidPoint);if(!check.ok)throw Error(check.reason);next.moveCount=previous.moveCount;this.objects[i]=next;this.touch('object.update');return this.objectSnapshot(next)}i=this.zones.findIndex(z=>z.id===id);if(i>=0){const previous=this.zones[i],next=this.normalizeZone({...this.zoneSnapshot(previous),...clone(patch),id,p:Array.isArray(patch.p)?patch.p:patch.x!=null||patch.z!=null?[patch.x??previous.p[0],0,patch.z??previous.p[2]]:previous.p,aliases:patch.aliases??previous.aliases},id);this.zones[i]=next;this.touch('zone.update');return this.zoneSnapshot(next)}throw Error('没有找到场景实体：'+id)}
 removeEntity(id){id=String(id||'').toUpperCase();let i=this.objects.findIndex(o=>o.id===id);if(i>=0){if(this.objects[i].held)throw Error('当前物体正在被人物抓握，不能删除');const [removed]=this.objects.splice(i,1);this.touch('object.remove');return{kind:'object',entity:this.objectSnapshot(removed)}}i=this.zones.findIndex(z=>z.id===id);if(i>=0){const [removed]=this.zones.splice(i,1);this.touch('zone.remove');return{kind:'zone',entity:this.zoneSnapshot(removed)}}throw Error('没有找到场景实体：'+id)}
 duplicateEntity(id,avoidPoint=null){if(String(id).startsWith('Z')?this.zones.length>=32:this.objects.length>=160)throw Error('场景实体数量已达到上限');const source=this.get(id);if(!source)throw Error('没有找到需要复制的实体');if(String(source.id).startsWith('Z')){const z=this.normalizeZone({...this.zoneSnapshot(source),id:this.nextZoneId(),name:source.name+' 副本',p:[source.p[0]+.45,0,source.p[2]+.35]});this.zones.push(z);this.touch('zone.duplicate');return this.zoneSnapshot(z)}const o=this.normalizeObject({...this.objectSnapshot(source),id:this.nextObjectId(),name:source.name+' 副本',held:false,moveCount:0});o.p=this.findOpenPosition(o,avoidPoint);this.objects.push(o);this.touch('object.duplicate');return this.objectSnapshot(o)}
 addZone(input={}){if(this.zones.length>=32)throw Error('训练区域数量已达到 32 个上限');const z=this.normalizeZone(input,input.id||this.nextZoneId());if(this.get(z.id))throw Error('场景中已经存在同名 ID');this.zones.push(z);this.touch('zone.add');return this.zoneSnapshot(z)}
 randomize(seed=this.seed+1,includeStatic=false,avoidPoint=[0,0,1.75]){this.seed=Number(seed)>>>0;const rng=seeded(this.seed),placed=[];for(const o of this.objects){if(!includeStatic&&o.movable===false){placed.push(o);continue}let ok=false;for(let t=0;t<900;t++){const p=[this.bounds.xMin+.45+rng()*(this.bounds.xMax-this.bounds.xMin-.9),o.h/2,-1.25+rng()*2.45];const candidate={...o,p};if(!this.canPlace(candidate,o.id,avoidPoint).ok)continue;if(placed.every(other=>other.collidable===false||o.collidable===false||pointToObjectClearance(p,other)>objectRadius(o)+.18)){o.p=p;ok=true;break}}if(!ok)throw Error('无法为所有物体找到新的安全位置');placed.push(o)}this.touch('scene.randomize');return this.exportScene()}
 applyPreset(id='sorting',seed=this.seed){if(!SCENE_PRESETS[id])throw Error('未知训练场预设：'+id);this.seed=Number(seed)>>>0;this.sceneId='scene_'+id;this.sceneName=SCENE_PRESETS[id].name;this.presetId=id;this.bounds=id==='camp'?{...CAMP_WORLD.bounds}:{...FIELD_BOUNDS};this.theme=id==='camp'?'camp':null;prepareCampScenery(this);this.objects=[];this.zones=DEFAULT_ZONES.map(z=>this.normalizeZone(clone(z),z.id));const add=(templateId,id,name,p,extra={})=>{const o=this.normalizeObject({...clone(OBJECT_TEMPLATES[templateId]),...extra,id,name,p},id);this.objects.push(o)};if(id==='sorting'){return this.reset(this.seed)}if(id==='camp'){installCampPreset(this,add)}else if(id==='living'){installLivingPreset(this,add)}else if(id==='obstacle'){add('wall','W1','左侧障碍墙',[-1.55,.41,.35],{w:1.65,h:.82,d:.16,yaw:.22,aliases:['左侧障碍墙','左墙']});add('wall','W2','右侧障碍墙',[1.55,.41,-.05],{w:1.55,h:.82,d:.16,yaw:-.28,aliases:['右侧障碍墙','右墙']});add('pillar','P1','中央障碍柱',[0,.46,.30],{aliases:['中央障碍柱','中央柱']});add('box','A','红色训练箱',[-2.55,.14,1.00],{aliases:['红色','红箱','训练箱']});add('sphere','B','蓝色训练球',[2.52,.15,.95],{aliases:['蓝色','蓝球','训练球']});add('cylinder','C','黄色训练圆柱',[0,.145,-.95],{aliases:['黄色','黄柱','训练圆柱']})}else if(id==='corridor'){add('wall','W1','左通道墙',[-1.04,.45,-.10],{w:.18,h:.90,d:3.25,yaw:0,aliases:['左通道墙','左墙']});add('wall','W2','右通道墙',[1.04,.45,-.10],{w:.18,h:.90,d:3.25,yaw:0,aliases:['右通道墙','右墙']});add('wall','W3','入口挡板',[-2.50,.38,.78],{w:1.20,h:.76,d:.16,yaw:.18,aliases:['入口挡板']});add('box','A','通道训练箱',[0,.14,.62],{aliases:['通道训练箱','红箱']});add('landmark','M1','通道终点',[0,.0175,-1.70],{aliases:['通道终点','终点','导航标记']});this.zones=[this.normalizeZone({id:'Z1',name:'终点区域',shape:'circle',p:[0,0,-2.25],r:.58,color:[.12,.62,.62],aliases:['终点区域','终点','一区']},'Z1')]}else if(id==='mixed'){add('wall','W1','斜向障碍墙',[-2.05,.40,-.30],{w:1.70,h:.80,d:.16,yaw:.48,aliases:['斜向障碍墙','障碍墙']});add('pillar','P1','高立柱',[2.25,.46,.18],{aliases:['高立柱','柱子']});add('platform','T1','低平台',[1.05,.10,-1.12],{aliases:['低平台','台子']});add('landmark','M1','观察点',[-.25,.0175,-1.45],{aliases:['观察点','导航标记']});add('box','A','红色训练箱',[-2.65,.14,1.05],{aliases:['红色','红箱','训练箱']});add('sphere','B','蓝色训练球',[2.62,.15,1.05],{aliases:['蓝色','蓝球','训练球']});add('cylinder','C','黄色训练圆柱',[.62,.145,.62],{aliases:['黄色','黄柱','训练圆柱']});add('cone','D','绿色训练圆锥',[-.68,.155,.72],{aliases:['绿色','绿锥','训练圆锥']})}else if(id==='empty'){this.objects=[]}this.touch('scene.preset');return this.exportScene()}
 importScene(data,avoidPoint=null){if(!data||typeof data!=='object'||!Array.isArray(data.objects)||!Array.isArray(data.zones))throw Error('场景 JSON 缺少 objects 或 zones');if(data.objects.length>160||data.zones.length>32)throw Error('场景实体数量超过运行上限');const context=Object.create(this);context.bounds=validateSceneBounds(data.bounds);const objects=[],ids=new Set();for(const raw of data.objects){const o=context.normalizeObject(raw,raw.id);if(ids.has(o.id))throw Error('场景中存在重复 ID：'+o.id);const check=context.canPlace(o,null,avoidPoint);if(!check.ok)throw Error(`${o.id}：${check.reason}`);ids.add(o.id);objects.push(o)}const zones=[];for(const raw of data.zones){const z=context.normalizeZone(raw,raw.id);if(ids.has(z.id))throw Error('场景中存在重复 ID：'+z.id);ids.add(z.id);zones.push(z)}this.bounds=context.bounds;this.theme=data.theme==='camp'||data.metadata?.worldTheme==='camp'?'camp':null;this.objects=objects;this.zones=zones;prepareCampScenery(this);this.sceneId=String(data.sceneId||'scene_imported').slice(0,64);this.sceneName=String(data.sceneName||'导入训练场').slice(0,40);this.presetId=String(data.presetId||'custom');this.seed=Number(data.seed)||this.seed;this.touch('scene.import');return this.exportScene()}
 path(start,end,r=.26,ignore=[]){
 if(Object.keys(FIELD_BOUNDS).some(k=>this.bounds[k]!==FIELD_BOUNDS[k]))return campGridPath(this,start,end,r,ignore);
 const overlaps=this.objects.filter(o=>!ignore.includes(o.id)&&o.collidable!==false&&pointToObjectClearance(start,o)<r+.06);
 if(overlaps.length){let away=[0,0,0];for(const o of overlaps)away=add(away,norm([start[0]-o.p[0],0,start[2]-o.p[2]]));const base=Math.atan2(away[0],away[2]);
  for(const length of[.22,.38,.60,.85])for(const turn of[0,.3,-.3,.65,-.65,1,-1,1.4,-1.4]){const a=base+turn,p=[start[0]+Math.sin(a)*length,0,start[2]+Math.cos(a)*length];if(Math.abs(p[0])>4.4||Math.abs(p[2])>3.4||this.collision(p,r,ignore))continue;let safe=true;const previous=new Map(overlaps.map(o=>[o.id,pointToObjectClearance(start,o)]));for(let k=1;k<=16&&safe;k++){const q=mix(start,p,k/16);for(const o of this.objects){if(ignore.includes(o.id)||o.collidable===false)continue;const d=pointToObjectClearance(q,o);if(previous.has(o.id)){if(d+1e-6<previous.get(o.id)){safe=false;break}previous.set(o.id,d)}else if(d<r+.06){safe=false;break}}}if(safe){try{return[p,...this.path(p,end,r,ignore)]}catch(e){}}}throw Error('释放后的安全退出路径被阻挡');}
 const step=.18,X=51,Z=40,xmin=-4.5,zmin=-3.5;const ix=p=>clamp(Math.round((p[0]-xmin)/step),0,X-1),iz=p=>clamp(Math.round((p[2]-zmin)/step),0,Z-1),idx=(x,z)=>x+z*X,pos=id=>[xmin+(id%X)*step,0,zmin+Math.floor(id/X)*step],S=idx(ix(start),iz(start)),E=idx(ix(end),iz(end)),g=new Float64Array(X*Z).fill(Infinity),parent=new Int32Array(X*Z).fill(-1),done=new Uint8Array(X*Z),open=[S];g[S]=0;const clear=(a,b)=>{const n=Math.max(1,Math.ceil(dist(a,b)/.08));for(let k=1;k<=n;k++)if(this.collision(mix(a,b,k/n),r,ignore))return false;return true};if(Math.abs(end[0])>4.4||Math.abs(end[2])>3.4)throw Error('目标超出安全场地');if(this.collision(end,r,ignore))throw Error('目标站位被占用');if(clear(start,end))return[[...end]];
 while(open.length){let bi=0,bf=Infinity;for(let k=0;k<open.length;k++){const id=open[k],f=g[id]+Math.hypot((id%X)-(E%X),Math.floor(id/X)-Math.floor(E/X));if(f<bf){bf=f;bi=k}}const id=open.splice(bi,1)[0];if(id===E)break;if(done[id])continue;done[id]=1;const x=id%X,z=Math.floor(id/X);for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const xx=x+dx,zz=z+dz;if(xx<0||xx>=X||zz<0||zz>=Z)continue;const n=idx(xx,zz);if(done[n]||this.collision(pos(n),r,ignore)||!clear(pos(id),pos(n)))continue;const ng=g[id]+Math.hypot(dx,dz);if(ng<g[n]){g[n]=ng;parent[n]=id;open.push(n)}}}
 if(parent[E]<0&&S!==E)throw Error('没有足够净空的可达路线');const route=[end];let id=E;while(id!==S&&id>=0){route.push(pos(id));id=parent[id]}route.reverse();const result=[];let anchor=start;for(let i=0;i<route.length;i++){let j=i;while(j+1<route.length&&clear(anchor,route[j+1]))j++;result.push(route[j]);anchor=route[j];i=j}return result}
 }

function routeDistance(start,route){let total=0,prev=start;for(const p of route||[]){total+=horizontal(prev,p);prev=p}return total}
function objectSpan(o){return Math.max(Number(o.w)||Number(o.r)*2||0,Number(o.d)||Number(o.r)*2||0,Number(o.h)||0)}
function actorForReasoning(agent,override={}){return{pos:[...(override.pos||override.position||agent.pos||[0,REST_HIP_HEIGHT,1.75])],yaw:Number.isFinite(override.yaw)?override.yaw:agent.yaw||0,posture:override.posture||agent.basic?.posture||'standing',heldObject:override.heldObject??agent.held?.id??null,strength:override.strength??agent.strength.export()}}
function relationDirectionForActor(step,actor){const d={left:[-1,0,0],right:[1,0,0],front:[0,0,1],behind:[0,0,-1]}[step?.relation];return d?(step.referenceFrame==='self'?rotate(qy(actor.yaw||0),d):d):null}
function reasoningDestination(world,actor,step,o,t){const candidates=[],directional=relationDirectionForActor(step,actor);if(directional){for(const gap of[.28,.42,.58]){const p=add(t.p,mul(directional,(t.r||.25)+o.r+gap));p[1]=o.h/2;if(Math.abs(p[0])>4.1||Math.abs(p[2])>3.1||world.collision(p,o.r+.045,[o.id]))continue;return p}throw Error('指定侧面没有容纳物体的安全空位')}
 if(t.id.startsWith('Z')){for(const dx of[0,-.38,.38,-.2,.2])for(const dz of[0,-.38,.38,-.2,.2])candidates.push([t.p[0]+dx,o.h/2,t.p[2]+dz])}else{for(const a of[0,Math.PI/2,Math.PI,-Math.PI/2,Math.PI/4,-Math.PI/4])candidates.push([t.p[0]+Math.sin(a)*(o.r+(t.r||.2)+.25),o.h/2,t.p[2]+Math.cos(a)*(o.r+(t.r||.2)+.25)])}
 for(const p of candidates){if(world.collision(p,o.r+.045,[o.id]))continue;if(t.id.startsWith('Z')&&!world.inside({...o,p},t))continue;return p}throw Error('目标附近没有容纳完整物体的空位')}
function walkDestination(world,actor,step,t){let d=norm(sub(t.p,actor.pos));d[1]=0;d=len(d)<1e-6?[0,0,-1]:norm(d);const standOff=t.id.startsWith('Z')?.35:Math.max(.52,(t.r||.2)+.38),dir=relationDirectionForActor(step,actor),end=dir?add(t.p,mul(dir,(t.r||.25)+.48)):add(t.p,mul(d,-standOff));end[1]=0;return end}
function routeClearance(world,start,route,r,ignore=[]){let min=Infinity,prev=start;for(const end of route||[]){const n=Math.max(1,Math.ceil(horizontal(prev,end)/.07));for(let k=0;k<=n;k++){const p=mix(prev,end,k/n);for(const o of world.objects){if(ignore.includes(o.id)||o.collidable===false)continue;min=Math.min(min,pointToObjectClearance(p,o)-r-.06)}}prev=end}return Number.isFinite(min)?min:9}
function blockingObjects(world,start,end,r,ignore=[]){const ids=new Set(),n=Math.max(2,Math.ceil(horizontal(start,end)/.06));for(let k=0;k<=n;k++){const p=mix(start,end,k/n);for(const o of world.objects){if(ignore.includes(o.id)||o.collidable===false)continue;if(pointToObjectClearance(p,o)<r+.06)ids.add(o.id)}}return[...ids]}
function physicalAnalyzeStep(world,actorInput,step,profile=PHYSICAL_REASONING_PROFILE,strengthModel=null){const capacity=strengthModel||(actorInput.strength?StrengthModel.fromSnapshot(actorInput.strength):new StrengthModel());let strengthAssessment=null;const actor={...actorInput,pos:[...(actorInput.pos||actorInput.position||[0,REST_HIP_HEIGHT,1.75])]},facts=[],reasons=[],alternatives=[],est={routeLengthM:0,predictedDurationS:0,minClearanceM:null,effortScore:0},effects={bodyPosition:[...actor.pos],bodyYaw:actor.yaw,posture:actor.posture,objectUpdates:[]};const fail=reason=>{reasons.push(reason);return false};let feasible=true;
 const result=()=>({schema:'knowledge_human/physical_reasoning@1.0',profile,strength:strengthAssessment,step:JSON.parse(JSON.stringify(step)),feasible:feasible&&reasons.length===0,reasons,facts,alternatives,estimates:est,predictedEffects:effects});
 if(['sit','lie','stand','greet','wave','salute'].includes(step.type)){const duration=step.duration||({sit:3.2,lie:4.4,stand:3.2,greet:3,wave:3,salute:3}[step.type]||2);est.predictedDurationS=duration;effects.posture=step.type==='sit'?'sitting':step.type==='lie'?'lying':step.type==='stand'?'standing':actor.posture;facts.push('动作由身体姿势与约束求解器完成');return result()}
 if(step.type==='wait'||step.type==='observe'){est.predictedDurationS=step.type==='wait'?step.duration||0:.1;return result()}
 const target=world.get(step.targetId);if(!target){feasible=fail('目标不存在：'+step.targetId);return result()}
 if(step.type==='walk'){if(actor.posture!=='standing')facts.push('身体需先恢复站立，身体控制器会自动处理姿势前置条件');let end;try{end=walkDestination(world,actor,step,target);const route=world.path(actor.pos,end,profile.bodyRadiusM);est.routeLengthM=routeDistance(actor.pos,route);est.minClearanceM=routeClearance(world,actor.pos,route,profile.bodyRadiusM);est.predictedDurationS=est.routeLengthM/profile.nominalWalkMps+Math.max(0,route.length-1)*.35;effects.bodyPosition=[...end];facts.push(`找到 ${route.length} 段可达路线`);facts.push(`预计最小净空 ${Math.max(0,est.minClearanceM).toFixed(2)} 米`)}catch(e){feasible=fail(e.message);alternatives.push({type:'clear_path',blockerIds:blockingObjects(world,actor.pos,target.p,profile.bodyRadiusM),reason:'直达或搜索路径不可行，需要移开可动物体或更换目标'})}return result()}
 if(!['carry','push'].includes(step.type)){feasible=fail('物理推演器不认识该语义步骤：'+step.type);return result()}
 const o=world.objects.find(x=>x.id===step.objectId);if(!o){feasible=fail('操作物体不存在：'+step.objectId);return result()}if(o.movable===false)feasible=fail(o.name+'被定义为固定环境');if(actor.heldObject&&actor.heldObject!==o.id)feasible=fail('身体当前持有另一个物体：'+actor.heldObject);
 const span=objectSpan(o),mass=o.mass,carryStrength=capacity.assess(strengthTaskRequest('carry',o)),pushStrength=capacity.assess(strengthTaskRequest('push',o)),carryable=o.movable!==false&&carryStrength.feasible&&span<=profile.maxGripSpanM&&o.r<=profile.maxCarryRadiusM&&o.h<=profile.maxCarryHeightM,pushable=o.movable!==false&&pushStrength.feasible&&o.h<=1.35;strengthAssessment=step.type==='carry'?carryStrength:pushStrength;
 facts.push(`物体质量 ${mass.toFixed(1)} kg，最大包络 ${span.toFixed(2)} m`);facts.push(`双手搬运可行性 ${carryable?'通过':'未通过'}，地面推动可行性 ${pushable?'通过':'未通过'}`);
 if(step.type==='carry'&&!carryable){feasible=fail(!carryStrength.feasible?strengthReason(carryStrength):span>profile.maxGripSpanM||o.r>profile.maxCarryRadiusM?'尺寸超过双手抓握或携带净空':'物体高度超出当前搬运姿态范围');if(pushable)alternatives.push({type:'push',step:{...step,type:'push'},reason:'搬运不可行，推动通过瞬时能力检查；仍需校验持续时间'})}
 if(step.type==='push'&&!pushable){feasible=fail(!pushStrength.feasible?strengthReason(pushStrength):'物体形态不适合当前地面推动');if(carryable)alternatives.push({type:'carry',step:{...step,type:'carry'},reason:'推动不可行，搬运通过瞬时能力检查；仍需校验持续时间'})}
 let dest;try{dest=reasoningDestination(world,actor,step,o,target);effects.objectUpdates=[{id:o.id,p:[...dest]}]}catch(e){feasible=fail(e.message);return result()}
 const approachDir=step.type==='push'?norm([dest[0]-o.p[0],0,dest[2]-o.p[2]]):norm([o.p[0]-actor.pos[0],0,o.p[2]-actor.pos[2]]),safeDir=len(approachDir)<1e-6?[0,0,-1]:approachDir,approachEnd=add(o.p,mul(safeDir,-.46));approachEnd[1]=0;
 try{const approach=world.path(actor.pos,approachEnd,.25,[o.id]);const approachD=routeDistance(actor.pos,approach);let transfer=[],transferD=0;if(step.type==='carry'){const finalDir=norm([dest[0]-approachEnd[0],0,dest[2]-approachEnd[2]]),fd=len(finalDir)<1e-6?[0,0,-1]:finalDir,bodyEnd=add(dest,mul(fd,-.34));bodyEnd[1]=0;transfer=world.path(approachEnd,bodyEnd,profile.carryClearanceM,[o.id]);transferD=routeDistance(approachEnd,transfer);effects.bodyPosition=[...bodyEnd];est.minClearanceM=Math.min(routeClearance(world,actor.pos,approach,.25,[o.id]),routeClearance(world,approachEnd,transfer,profile.carryClearanceM,[o.id]));est.predictedDurationS=approachD/profile.nominalWalkMps+transferD/profile.nominalCarryMps+7.2}else{const objectRoute=world.path(o.p,dest,o.r+.05,[o.id]);transferD=routeDistance(o.p,objectRoute);effects.bodyPosition=[actor.pos[0]+dest[0]-o.p[0],actor.pos[1],actor.pos[2]+dest[2]-o.p[2]];est.minClearanceM=Math.min(routeClearance(world,actor.pos,approach,.25,[o.id]),routeClearance(world,o.p,objectRoute,o.r+.05,[o.id]));est.predictedDurationS=approachD/profile.nominalWalkMps+transferD/profile.nominalPushMps+4.5}est.routeLengthM=approachD+transferD;est.effortScore=mass*Math.max(.25,transferD)*(step.type==='carry'?1:.35);facts.push(`目标落点通过几何容纳检查`);facts.push(`预计总路径 ${est.routeLengthM.toFixed(2)} 米，耗时约 ${est.predictedDurationS.toFixed(1)} 秒`)}catch(e){feasible=fail(e.message);alternatives.push({type:'clear_path',blockerIds:blockingObjects(world,actor.pos,o.p,.25,[o.id]),reason:'接近或运输路径缺少净空'})}
 if(feasible){strengthAssessment=capacity.assess(strengthTaskRequest(step.type,o,{durationS:est.predictedDurationS}));facts.push('力量估算限制项：'+strengthGroupLabel(strengthAssessment.limitingGroup));if(!strengthAssessment.feasible)feasible=fail(strengthReason(strengthAssessment));}
 return result()}
function reasoningWorldClone(world){const w=new World(world.seed);w.importScene(world.exportScene());w.revision=world.revision;return w}
function simulateSemanticPlan(world,agent,plan,actorOverride={}){const sim=reasoningWorldClone(world),actor=actorForReasoning(agent,actorOverride),capacity=StrengthModel.fromSnapshot(actor.strength),analyses=[],reasons=[];let totalCost=0,totalDuration=0,minClearance=Infinity;for(const step of plan?.steps||[]){const a=physicalAnalyzeStep(sim,actor,step,PHYSICAL_REASONING_PROFILE,capacity);analyses.push(a);if(!a.feasible){reasons.push(...a.reasons);break}if(a.strength)capacity.project(a.strength,a.estimates.predictedDurationS);else capacity.recover(a.estimates.predictedDurationS);actor.strength=capacity.export();totalCost+=a.estimates.routeLengthM+a.estimates.effortScore*.04;totalDuration+=a.estimates.predictedDurationS;minClearance=Math.min(minClearance,a.estimates.minClearanceM??Infinity);actor.pos=[...a.predictedEffects.bodyPosition];actor.yaw=a.predictedEffects.bodyYaw;actor.posture=a.predictedEffects.posture;for(const u of a.predictedEffects.objectUpdates||[]){const o=sim.get(u.id);if(o)o.p=[...u.p]}}
 return{schema:'knowledge_human/physical_plan_simulation@1.0',profile:PHYSICAL_REASONING_PROFILE,feasible:reasons.length===0,reasons,analyses,score:totalCost,totalDurationS:totalDuration,minClearanceM:Number.isFinite(minClearance)?minClearance:null,predictedWorld:sim.snapshot(),predictedActor:actor,predictedStrength:capacity.export(),plan:JSON.parse(JSON.stringify(plan||{}))}}

function resolve(text,world,type,last){text=text.trim();if(/^(它|这个|那个|刚才的物体|该物体)$/.test(text)){if(!last)throw Error('“它”没有可确认的指代');return world.get(last)}let pool=type==='object'?world.objects:[...world.objects,...world.zones],matches=pool.filter(e=>new RegExp(`(^|[^A-Za-z0-9])${e.id}($|[^A-Za-z0-9])`,'i').test(text));if(!matches.length){const keys=pool.flatMap(e=>e.aliases.map(a=>({e,a}))).sort((a,b)=>b.a.length-a.a.length);let occupied=[];for(const{e,a}of keys){const k=text.indexOf(a);if(k>=0&&!occupied.some(([s,t])=>k>=s&&k+a.length<=t)){matches.push(e);occupied.push([k,k+a.length])}}matches=[...new Map(matches.map(e=>[e.id,e])).values()]}if(matches.length===1)return matches[0];throw Error(matches.length?'对象描述存在冲突，请指定颜色、形状或编号':'未找到对象：'+text)}

function parse(text,world,last=null){
 if(typeof text!=='string'||!text.trim())throw Error('请先输入指令');
 if(/不要|别把|不许|如果|除非|除了/.test(text))throw Error('当前本地语法尚未覆盖否定或条件句，本次没有执行');
 const input=text.replace(/请|帮我|首先|先/g,'').replace(/并且|并(?=向|朝|打|敬|挥|招|坐|躺|起|站)/g,'，');
 const chunks=input.split(/然后|接着|最后|再(?=把|将|去|走|站|向|朝|坐|躺|打|敬|挥|招|起|平)|[，,；;。]/).filter(s=>s.trim()),steps=[];
 function read(raw){let chunk=raw.trim();if(!chunk)return;
  // Peel off a final gesture so "走到一区向我敬礼" retains both intentions.
  const gesture=chunk.match(/(?:向我|朝我|给我)?(?:打个招呼|打招呼|问好|挥挥手|挥手|招手|敬个礼|敬礼|行礼)(?:\s*(\d+(?:\.\d+)?)\s*秒)?$/);
  if(gesture){read(chunk.slice(0,gesture.index));const t=/敬|行礼/.test(gesture[0])?'salute':/招呼|问好/.test(gesture[0])?'greet':'wave';steps.push({type:t,...(gesture[1]?{duration:Number(gesture[1])}:{})});return;}
  if(/椅子|床上|沙发/.test(chunk))throw Error('场内没有座椅或床，请指定坐在地上或躺在地上');
  const stand=chunk.match(/(?:起身站起来|站起来|站起身|站起|起立|起身|站好|站立|恢复站立|站着)$/);
  if(stand){const before=chunk.slice(0,stand.index).replace(/^(?:原地|在原地)$/,'');if(before)read(before);steps.push({type:'stand'});return;}
  const floor=chunk.match(/(?:坐在地上|坐到地上|在地上坐下|坐地上|坐下来|坐下|坐着|保持坐姿|躺在地上|在地上躺下|平躺下来|躺下来|躺下|平躺|仰卧|躺着|保持躺姿)$/);
  if(floor){let before=chunk.slice(0,floor.index).replace(/^(?:原地|在原地)$/,'');if(before){if(/^在/.test(before))before='走到'+before.slice(1);read(before);}steps.push({type:/坐/.test(floor[0])?'sit':'lie'});return;}
  const m=chunk.match(/(?:把|将)?\s*(.+?)\s*(搬运|搬|运|拿|抱|推|移动|放)(?:动|起|起来)?(?:到|进|入|至|在)\s*(.+)/);
  if(m){const o=resolve(m[1],world,'object',last),target=resolve(m[3].replace(/旁边|边上|里面|之内|内|里|中|去|上$/g,''),world,'any',last);if(o.id===target.id)throw Error('物体与目标相同');steps.push({type:m[2]==='推'?'push':'carry',objectId:o.id,targetId:target.id,relation:/旁|边/.test(m[3])?'near':target.id.startsWith('Z')?'inside':'near'});last=o.id;return;}
  if(/^(?:去|走|站)/.test(chunk)){const t=resolve(chunk.replace(/走到|走向|站到|站在|去|旁边|边上|里面|站着|一下/g,''),world,'any',last);steps.push({type:'walk',targetId:t.id});return;}
  throw Error('未识别这段操作：'+chunk);
 }
 chunks.forEach(read);if(!steps.length)throw Error('没有可执行的动作');
 return{schema:'knowledge_human/behavior_plan@0.6',sourceText:text,worldRevision:world.revision,steps,lastObject:last,grammarMode:'local-compositional-not-open-language-model'};
}

// MODULE basic
const BASIC_SKILLS=Object.freeze(['sit','lie','stand','greet','wave','salute']);
const sides=['left','right'];
const copyFrame=f=>frame(f.p,f.q);
const copyFeet=feet=>Object.fromEntries(sides.map(s=>[s,{p:[...feet[s].p],q:[...(feet[s].q||qy(feet[s].yaw||0))],yaw:feet[s].yaw||0}]));

// This controller specifies contact goals and transitions, never a cached
// animation or external pose array. All final joint rotations use Human.pose.
class BasicController {
 constructor(agent){this.a=agent;this.posture='standing';this.transition=null;this.gesture=null;this.hold=null;this.pending=null;this.lastGround={y:0,boneId:null};this.automaticStandUps=0;this.floorMin=Infinity;this.maxFloorCorrection=0;this.samples=0;this.phaseLog=[];this.reachProjectionCount=0;this.maxProjectedResidualM=0;this.reachProjectionLog=[];}
 get busy(){return !!(this.transition||this.gesture)}
 capture(){const a=this.a,h=a.h;return {position:[...h.root.p],rootRotation:[...h.root.q],
  spineRotations:Object.fromEntries(h.spine.map(j=>[j.id,[...j.q]])),
  feet:Object.fromEntries(sides.map(s=>[s,{p:[...h.legs[s].wrist.world.p],q:[...h.legs[s].wrist.world.q],yaw:a.yaw}])),
  hands:Object.fromEntries(sides.map(s=>[s,copyFrame(h.palm(s))])),
  legPoles:Object.fromEntries(sides.map(s=>[s,[...h.legs[s].elbow.world.p]])),
  armPoles:Object.fromEntries(sides.map(s=>[s,[...h.arms[s].elbow.world.p]])),floorMode:this.posture!=='standing'};}
 makeState(kind,seat,yaw){
  const a=this.a,base=qy(yaw),at=(x,y,z)=>add([seat[0],y,seat[2]],rotate(base,[x,0,z]));
  const reachScale=(ANATOMY.femurLength+ANATOMY.tibiaLength)/(.435+.409);
  const lyingReach=Math.sqrt(LEG_REST_REACH**2-(.122-.084)**2-(.118-ANATOMY.hipSpacing/2)**2);
  const spec={standing:[REST_HIP_HEIGHT,0,0,.34,.34+ADULT_STANCE.ankleForwardM,SKIN_SOLE_HEIGHT,0],squat:[.36,.35,.14,.18,.355,SKIN_SOLE_HEIGHT,0],
   tucked:[.129,-.22,.07,0,.355,SKIN_SOLE_HEIGHT,0],sitting:[.129,-.055,.055,0,.755*reachScale,.083,-.13],
   recline:[.130,-.78,.025,0,.790*reachScale,.087,-.62],lying:[.122,-Math.PI/2,0,0,lyingReach,.084,-Math.PI/2+.12]}[kind];
  const [height,pitch,bend,rz,fz,fy,fa]=spec,position=at(0,height,rz);
  const desc={position,rootRotation:qm(base,qx(pitch)),spineRotations:{},feet:{},hands:{},legPoles:{},armPoles:{},floorMode:kind!=='standing',kind};
  for(const j of a.h.spine)desc.spineRotations[j.id]=qx(j.region==='L'?bend*.07:j.region==='T'?bend*.0125:0);
  for(const side of sides){const s=side==='left'?-1:1;
   desc.feet[side]={p:at(s*(kind==='standing'||kind==='squat'?ADULT_STANCE.footHalfSpacingM:.118),fy,fz),q:qm(base,qx(fa)),yaw};
   desc.legPoles[side]=at(s*.13,height+.60,rz+.40);
   let p,Q;
   if(kind==='standing'){p=null;} // Evaluated through the same relaxed arm solver.
   else if(kind==='squat'){p=at(s*.22,.47,.50);Q=qm(base,qx(.40));}
   else if(kind==='tucked'){p=at(s*.265,.035,-.05);Q=qm(base,qx(1.17));}
   else if(kind==='sitting'){p=at(s*.155,.235,.295);Q=qm(base,qx(Math.PI/2));}
   else if(kind==='recline'){p=at(s*.285,.035,-.19);Q=qm(base,qx(1.17));}
   else{p=at(s*.285,.034,.043);Q=qm(base,qx(-Math.PI/2));}
   if(p)desc.hands[side]=frame(p,Q);
   desc.armPoles[side]=kind==='lying'?at(s*.34,.10,-.20):at(s*.38,height+.15,rz-.10);
  }
  // Neutral targets are evaluated on the existing rig, then the current pose
  // is restored. No second pose authority, new rig, or bind change is created.
  if(kind==='standing'){
   const h=a.h,saved=h.joints.map(j=>({p:[...j.p],q:[...j.q]})),err=h.lastErrors;
   h.pose({...desc,hands:null,yaw,time:a.time});
   desc.hands=Object.fromEntries(sides.map(s=>[s,copyFrame(h.palm(s))]));
   desc.armPoles=Object.fromEntries(sides.map(s=>[s,[...h.arms[s].elbow.world.p]]));
   h.joints.forEach((j,i)=>{j.p=saved[i].p;j.q=saved[i].q});h.fk();h.lastErrors=err;
  }
  return desc;
 }
 hasFloorRoom(seat,yaw){const base=qy(yaw);for(let z=-.88;z<=1.0;z+=.12){const p=add(seat,rotate(base,[0,0,z]));if(Math.abs(p[0])>4.60||Math.abs(p[2])>3.60||this.a.w.collision(p,.29))return false}return true;}
 chooseSeat(){const a=this.a;for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI]){const yaw=a.yaw+angle,seat=add(a.pos,rotate(qy(yaw),[0,0,-.34]));seat[1]=0;if(this.hasFloorRoom(seat,yaw))return {seat,yaw}}throw Error('周围没有容纳坐躺姿势的净空，请先走到空地；场内物体保持原位');}
 begin(skill){
  if(skill.type==='sit'||skill.type==='lie'||skill.type==='stand'){
   this.startTransition({sit:'sitting',lie:'lying',stand:'standing'}[skill.type],false);return true;
  }
  if(skill.type==='greet'||skill.type==='wave'||skill.type==='salute'){
   if(this.posture==='lying'){this.startTransition('sitting',true);return true;}
   this.startGesture(skill.type==='wave'?'greet':skill.type,skill.duration);return true;
  }
  if(this.posture!=='standing'){this.automaticStandUps++;this.startTransition('standing',true);return true;}
  return false;
 }
 startTransition(target,resume){const a=this.a;
  if(target===this.posture){if(resume){a.skill=null;a.begin()}else a.finish();return;}
  if(a.held)throw Error('双手持物时不能坐躺，请先完成放置');
  let seat=this.seat,yaw=a.yaw;
  if(this.posture==='standing'){const choice=this.chooseSeat();seat=choice.seat;yaw=choice.yaw;this.seat=[...seat];}
  else if(target==='lying'&&!this.hasFloorRoom(seat,yaw))throw Error('身后躺卧范围被占用，请先起身走到空地');
  const t={target,resume,seat,yaw,elapsed:0,stage:0,from:null,points:[],align:Math.abs(angleDiff(yaw,a.yaw))>.015};
  this.transition=t;this.gesture=null;
  if(t.align){a.enter('floorAlign');return;}
  this.preparePoints(t);
 }
 preparePoints(t){const a=this.a;t.align=false;t.from=this.capture();
  const addPoint=(kind,duration)=>t.points.push({pose:this.makeState(kind,t.seat,t.yaw),duration,kind});
  if(this.posture==='standing'){addPoint('squat',1.05);addPoint('tucked',.95);addPoint('sitting',.95);if(t.target==='lying'){addPoint('recline',.90);addPoint('lying',1.25)}}
  else if(this.posture==='lying'){addPoint('recline',1.1);addPoint('sitting',1.0);if(t.target==='standing'){addPoint('tucked',.85);addPoint('squat',1.05);addPoint('standing',1.1)}}
  else if(t.target==='lying'){addPoint('recline',1.0);addPoint('lying',1.25)}
  else{addPoint('tucked',.90);addPoint('squat',1.0);addPoint('standing',1.1)}
  a.swing=null;a.gaitSignal=0;a.gaitBlend=0;t.elapsed=0;a.enter(t.target==='standing'?'standUp':t.target==='lying'?'lieDown':'sitDown');
 }
 startGesture(type,duration){const a=this.a;this.gesture={type,time:0,duration:clamp(Number(duration)|| (type==='salute'?4.2:3.2),1.2,20),base:this.hold||this.capture(),releasing:false,quality:{samples:0,outsideTolerance:0,maxHandErrorM:0,maxFootErrorM:0,maxHandOrientationRad:0}};if(type==='salute'){
   const h=a.h,g=this.gesture,chain=[h.arms.right.upper,h.arms.right.elbow,h.arms.right.radial,h.arms.right.wrist];
   const saved=h.joints.map(j=>({q:j.q.slice(),p:j.p.slice()})),errors=h.lastErrors,phase=h.phase,target=h.gestureTarget;
   const from=chain.map(j=>j.q.slice());
   try{h.pose({...g.base,yaw:a.yaw,time:a.time,gesture:{type:'salute',weight:1,clock:0},deltaTime:null});
    g.armPath={from,to:chain.map(j=>j.q.slice())};
   }finally{h.joints.forEach((j,k)=>{j.q=saved[k].q;j.p=saved[k].p;});h.fk();h.lastErrors=errors;h.phase=phase;h.gestureTarget=target;}
  }a.enter(type==='salute'?'salute':'greet');}
 interpolate(A,B,t){const feet={},hands={},legPoles={},armPoles={},spineRotations={};
  for(const s of sides){feet[s]={p:mix(A.feet[s].p,B.feet[s].p,t),q:qslerp(A.feet[s].q,B.feet[s].q,t),yaw:this.a.yaw};
   hands[s]=frame(mix(A.hands[s].p,B.hands[s].p,t),qslerp(A.hands[s].q,B.hands[s].q,t));
   legPoles[s]=mix(A.legPoles[s],B.legPoles[s],t);armPoles[s]=mix(A.armPoles[s],B.armPoles[s],t);}
  for(const j of this.a.h.spine)spineRotations[j.id]=qslerp(A.spineRotations[j.id],B.spineRotations[j.id],t);
  return {position:mix(A.position,B.position,t),rootRotation:qslerp(A.rootRotation,B.rootRotation,t),spineRotations,feet,hands,legPoles,armPoles,floorMode:A.floorMode||B.floorMode};
 }
 apply(desc,gesture=null,deltaTime=null){const a=this.a,h=a.h;
  h.pose({...desc,yaw:a.yaw,time:a.time,gesture,deltaTime});
  const projectedResidual=Math.max(0,...h.lastErrors.map(e=>e.error));
  if(projectedResidual>.018){
   const hard=h.constraints.audit();
   if(!hard.valid)throw Error('人体关节硬约束审计失败，已保持上一安全姿态');
   this.reachProjectionCount++;this.maxProjectedResidualM=Math.max(this.maxProjectedResidualM,projectedResidual);
   this.reachProjectionLog.push({time:a.time,phase:gesture?.type||desc.kind||a.phase,residualM:projectedResidual,policy:'project-target-into-hard-rom'});
   if(this.reachProjectionLog.length>48)this.reachProjectionLog.shift();
  }
  let ground=h.minimumBoneY(),correction=Math.max(0,.0005-ground.y);
  if(correction>0){h.root.p[1]+=correction;h.fk();ground={y:ground.y+correction,boneId:ground.boneId};}
  h.refreshEffectorErrors();
  const feetResidual=Math.max(0,...h.lastErrors.filter(e=>/_foot$/.test(e.id)).map(e=>e.error));
  a.stats.maxFootPositionErrorM=Math.max(a.stats.maxFootPositionErrorM,feetResidual);
  this.lastGround=ground;this.floorMin=Math.min(this.floorMin,ground.y);this.maxFloorCorrection=Math.max(this.maxFloorCorrection,correction);this.samples++;
  a.pos=[...h.root.p];a.feet=Object.fromEntries(sides.map(s=>[s,{p:[...h.legs[s].wrist.world.p],q:[...h.legs[s].wrist.world.q],yaw:a.yaw}]));
  const d=h.diagnostics();a.stats.maxBoneLengthErrorM=Math.max(a.stats.maxBoneLengthErrorM,d.maxBoneLengthErrorM);
  a.lastSafe={pos:[...a.pos],yaw:a.yaw,joints:h.joints.map(j=>({p:[...j.p],q:[...j.q]}))};
 }
 commitPending(){if(!this.pending)return false;const a=this.a,p=this.pending;this.pending=null;a.plan=p;a.index=0;a.skill=null;a.lastObject=p.lastObject;a.phase=this.posture==='standing'?'idle':this.posture==='sitting'?'groundSit':'groundLie';a.phaseT=0;return true;}
 update(dt){const a=this.a;
  if(this.transition){const t=this.transition;
   if(t.align){const d=angleDiff(t.yaw,a.yaw);a.yaw+=clamp(d,-1.6*dt,1.6*dt);a.gait(dt,false);a.h.pose({position:a.pos,yaw:a.yaw,feet:a.feet,time:a.time,deltaTime:dt});if(Math.abs(d)<.01&&!a.swing)this.preparePoints(t);return;}
   const current=t.points[t.stage];t.elapsed+=dt;const u=smoother(t.elapsed/current.duration);
   this.apply(this.interpolate(t.from,current.pose,u),null,dt);
   if(t.elapsed>=current.duration){
    this.phaseLog.push({time:a.time,kind:current.kind,minBoneY:this.lastGround.y});
    t.from=this.capture();t.stage++;t.elapsed=0;
    if(t.stage>=t.points.length){this.posture=t.target;this.hold=this.posture==='standing'?null:this.capture();this.transition=null;a.swing=null;
     if(this.posture==='standing'){for(const s of sides)delete a.feet[s].q;}
     if(t.resume){a.skill=null;if(!this.commitPending())a.begin();}
     else{a.finish();this.commitPending();}
     if(!a.skill)a.phase=this.posture==='standing'?'idle':this.posture==='sitting'?'groundSit':'groundLie';
    }
   }return;
  }
  if(this.gesture){const g=this.gesture;g.time+=dt;const ramp=Math.min(g.type==='salute'?1.5:1.,g.duration*.36);let weight=smoother(Math.min(g.time/ramp,(g.duration-g.time)/ramp));
   if(g.releasing){g.releaseTime+=dt;weight=g.releaseWeight*(1-smoother(g.releaseTime/.32));}
   g.weight=weight;this.apply(g.base,{type:g.type,weight,clock:Math.max(0,g.time-.45),armPath:g.armPath},dt);
   if(!g.releasing&&weight>.90){
    const hand=a.h.lastErrors.find(e=>e.id==='right_hand'),feet=Math.max(0,...a.h.lastErrors.filter(e=>/_foot$/.test(e.id)).map(e=>e.error));
    const q=g.quality;q.samples++;q.maxHandErrorM=Math.max(q.maxHandErrorM,hand?.error||0);q.maxFootErrorM=Math.max(q.maxFootErrorM,feet);
    q.maxHandOrientationRad=Math.max(q.maxHandOrientationRad,hand?.orientationErrorRad||0);
    if(!hand||hand.error>.04||feet>.012||hand.orientationErrorRad>.65)q.outsideTolerance++;
   }
   if(!g.releasing&&g.time>=g.duration){
    const q=g.quality;this.lastGestureValidation={...q,type:g.type,passed:q.samples>0&&q.outsideTolerance/q.samples<=.20,
      tolerance:{handM:.04,footM:.012,handOrientationRad:.65},scope:'kinematic target tracking, not visual acceptance'};
    if(!this.lastGestureValidation.passed){this.gesture=null;a.fail('手势未达到手掌或脚部目标，已停止；请查看身体诊断中的目标误差');return;}
   }
   if((!g.releasing&&g.time>=g.duration)||(g.releasing&&g.releaseTime>=.32)){this.gesture=null;if(a.skill){if(g.releasing){a.evidence.push({step:a.index,type:a.skill.type,completion:'cancelled',reason:'replaced-by-new-command',time:a.time});a.stats.cancelled=(a.stats.cancelled||0)+1;a.skill=null;}else a.finish();}this.commitPending();a.phase=this.posture==='standing'?'idle':this.posture==='sitting'?'groundSit':'groundLie';}
   return;
  }
  if(this.hold){this.apply(this.hold,null,dt);a.phase=this.posture==='sitting'?'groundSit':'groundLie';}
 }
 replacePending(plan){this.pending=plan;
  if(this.gesture&&!this.gesture.releasing){Object.assign(this.gesture,{releasing:true,releaseTime:0,releaseWeight:this.gesture.weight||0});}
  this.a.log(this.gesture?'收回当前手势后执行新指令':'完成当前支撑转换后执行新指令，尚未开始的旧任务已取消');
 }
 report(){return {posture:this.posture,transition:this.transition?{target:this.transition.target,stage:this.transition.stage,align:this.transition.align}:null,
  gesture:this.gesture?{type:this.gesture.type,weight:this.gesture.weight||0}:null,lastGestureValidation:this.lastGestureValidation||null,pendingReplacement:!!this.pending,
  minimumBoneYM:this.lastGround.y,lowestBone:this.lastGround.boneId,minFloorSampleYM:Number.isFinite(this.floorMin)?this.floorMin:null,
  maxVerticalClearanceCorrectionM:this.maxFloorCorrection,floorSamples:this.samples,automaticStandUps:this.automaticStandUps,
  reachability:{policy:'hard-ROM projection for non-contact pose goals',projectionCount:this.reachProjectionCount,maxProjectedResidualM:this.maxProjectedResidualM,recent:this.reachProjectionLog.slice(-12)},
  contactModel:'kinematic support targets, bone vertices and skin support proxies; force/friction not simulated',phaseLog:[...this.phaseLog]};}
}

// MODULE behavior
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
function rayBoundary(o,d,y=0){const r=o.shape==='cone'?o.r*(.5-y/o.h):o.r;if(o.shape==='sphere'||o.shape==='cylinder'||o.shape==='cone')return r/Math.hypot(d[0],d[2]);if(o.shape==='box')return 1/Math.max(Math.abs(d[0])/(o.w/2),Math.abs(d[2])/(o.d/2));let best=Infinity;const vertices=Array.from({length:3},(_,i)=>[Math.cos(i*Math.PI*2/3)*o.r,Math.sin(i*Math.PI*2/3)*o.r]);for(let i=0;i<3;i++){const a=vertices[i],b=vertices[(i+1)%3],ex=b[0]-a[0],ez=b[1]-a[1],den=d[0]*ez-d[2]*ex;if(Math.abs(den)<1e-8)continue;const t=(a[0]*ez-a[1]*ex)/den,u=(a[0]*d[2]-a[1]*d[0])/den;if(t>0&&u>=-1e-6&&u<=1+1e-6)best=Math.min(best,t)}return best}
function graspFrames(o,yaw,push=false){const base=qy(yaw),out={};for(const[side,s]of[['left',-1],['right',1]]){const D=rotate(inv(o.q),rotate(base,push?norm([s*.34,0,-1]):[s,0,0])),t=rayBoundary(o,D),P=mul(D,t),Q=qm(inv(o.q),push?base:qm(base,qy(-s*Math.PI/2)));out[side]=frame(P,Q)}return out}
function graspResidual(human,o,grips){return Object.fromEntries(['left','right'].map(side=>{const want=compose(frame(o.p,o.q),grips[side]),actual=human.palm(side);return[side,{positionM:dist(want.p,actual.p),angleRad:qangle(want.q,actual.q)}]}))}
function inferHeldFrame(human,grips){const a=compose(human.palm('left'),inverse(grips.left)),b=compose(human.palm('right'),inverse(grips.right));return{p:mix(a.p,b.p,.5),q:qslerp(a.q,b.q,.5),positionDisagreement:dist(a.p,b.p),angleDisagreement:qangle(a.q,b.q)}}
/*__SOURCE:body/NaturalLocomotion.js__*/
class Agent{
 constructor(human,world,log=()=>{}){this.h=human;this.w=world;this.log=log;this.strength=human.strength;this.reset()}
 reset(){this.strengthLastLengths=null;const spawn=findHumanSpawn(this.w);this.pos=[spawn[0],REST_HIP_HEIGHT,spawn[2]];this.yaw=0;this.time=0;this.plan=null;this.index=0;this.skill=null;this.phase='idle';this.phaseT=0;this.paused=false;this.held=null;this.grips=null;this.lastObject=null;this.error=null;this.route=[];this.routeIndex=0;this.feet={left:{p:[spawn[0]-ADULT_STANCE.footHalfSpacingM,SKIN_SOLE_HEIGHT,spawn[2]+ADULT_STANCE.ankleForwardM],yaw:0},right:{p:[spawn[0]+ADULT_STANCE.footHalfSpacingM,SKIN_SOLE_HEIGHT,spawn[2]+ADULT_STANCE.ankleForwardM],yaw:0}};this.swing=null;this.nextFoot='left';this.sinceStep=0;this.evidence=[];this.stats={completed:0,failed:0,graspEstablished:0,heldFrames:0,maxGripDisagreementM:0,maxPalmResidualM:0,maxBoneLengthErrorM:0,maxFootPositionErrorM:0,objectMovesWithoutContact:0};this.lastSafe=null;this.gaitSignal=0;this.gaitBlend=0;this.walkSpeed=0;this.pelvisDrop=0;this.locomotion=new NaturalLocomotion(this);this.h.pose({position:this.pos,feet:this.feet});this.basic=new BasicController(this);}
 cancel(){if(this.held){this.paused=true;this.log('当前仍保持物体抓握。请先完成放置，再编辑训练场景');return{stopped:false,paused:true,heldObject:this.held.id,requiresRelease:true}}this.plan=null;this.index=0;this.skill=null;this.route=[];this.routeIndex=0;this.error=null;this.paused=false;this.locomotion.velocity=0;this.locomotion.startTime=0;if(this.basic){this.basic.pending=null;this.basic.transition=null;this.basic.gesture=null}this.phase=this.basic?.posture==='sitting'?'groundSit':this.basic?.posture==='lying'?'groundLie':'idle';this.phaseT=0;this.log('当前身体任务已停止，训练场景可以继续编辑');return{stopped:true,paused:false,heldObject:null}}
 submit(text){
  if(/^暂停$/.test(text.trim())){this.paused=true;this.log('已暂停，现有接触与身体姿态保留');return{paused:true};}
  if(/^(停止|停下)$/.test(text.trim()))return this.cancel();
  if(/^(继续|恢复)$/.test(text.trim())){this.paused=false;this.log('继续执行');return;}
  const p=parse(text,this.w,this.lastObject);
  if(this.basic.busy){this.basic.replacePending(p);this.paused=false;return p;}
  if(this.skill||this.held)throw Error('当前移动或持物任务尚未结束，请等待完成或暂停检查；现有抓握保持不变');
  this.plan=p;this.index=0;this.lastObject=p.lastObject;this.error=null;this.paused=false;
  this.log('已解析 '+p.steps.length+' 项任务');return p;
 }

 validateSemanticPlan(p){
  const errors=[],allowed=new Set(['walk','carry','push','sit','lie','stand','greet','wave','salute']);
  if(!p||p.schema!=='knowledge_human/checked_semantic_plan@1.0')errors.push('计划 schema 无效');
  if(!Array.isArray(p?.steps)||p.steps.length<1||p.steps.length>64)errors.push('步骤列表无效');
  for(const st of p?.steps||[]){
   if(!st||typeof st!=='object'){errors.push('步骤无效');continue}
   for(const k of Object.keys(st))if(!['type','objectId','targetId','relation','referenceFrame','duration'].includes(k))errors.push('禁止协议外字段：'+k);
   if(!allowed.has(st.type))errors.push('不支持的语义技能：'+st.type);
   if(['walk','carry','push'].includes(st.type)&&!this.w.get(st.targetId))errors.push('目标不存在：'+st.targetId);
   if(['carry','push'].includes(st.type)){const o=this.w.objects.find(o=>o.id===st.objectId);if(!o||o.movable===false)errors.push('物体不可移动：'+st.objectId);if(st.objectId===st.targetId)errors.push('目标与物体相同')}
   if(st.relation&&!['inside','near','left','right','front','behind'].includes(st.relation))errors.push('位置关系无效');
   if(st.referenceFrame&&!['world','self'].includes(st.referenceFrame))errors.push('坐标系无效');
   if(st.duration!=null&&(!Number.isFinite(st.duration)||st.duration<.1||st.duration>30||!['greet','wave','salute'].includes(st.type)))errors.push('时间参数无效');
  }
  return{ok:errors.length===0,errors};
 }
 submitPlan(p){const check=this.validateSemanticPlan(p);if(!check.ok)throw Error(check.errors.join('；'));if(this.skill||this.held||this.basic.busy||this.plan)throw Error('身体仍在执行任务');this.plan=JSON.parse(JSON.stringify(p));this.index=0;this.lastObject=p.steps.filter(s=>s.objectId).at(-1)?.objectId||this.lastObject;this.error=null;this.paused=false;this.log('收到大脑结构化计划：'+p.steps.length+' 项');return this.plan;}
 relationDirection(step){return relationDirectionForActor(step,{yaw:this.yaw})}
 enter(p){this.phase=p;this.phaseT=0;this.log(({floorAlign:'检查空地并转身调整站位',sitDown:'屈髋屈膝，降到地面坐姿',lieDown:'手臂辅助，逐步躺到地面',standUp:'收腿并起身站稳',greet:'抬臂打招呼',salute:'右手抬至眉侧敬礼',approach:'根据当前物体位置寻路',settle:'站稳并调整朝向',reach:'屈髋屈膝，肩臂腕联合趋近',close:'双掌到位，闭合指骨链',lift:'双掌约束成立，起身抬起',travel:'携物步行，支撑脚锁定',placeSettle:'保持双掌抓握并对齐放置站位',lower:'目标区内下蹲放置',release:'检查落地后解除抓握',rise:'松手并恢复站立',pushTravel:'持续掌面接触推动',wave:'肩带、手臂和手掌联合挥手',walk:'按实时位置走向目标'})[p]||p)}
 destination(o,t){return reasoningDestination(this.w,actorForReasoning(this),this.skill,o,t)}
 begin(){if(!this.plan||this.index>=this.plan.steps.length){this.plan=null;this.phase='idle';return}this.skill={...this.plan.steps[this.index]};const s=this.skill;if(this.basic.begin(s))return;if(s.type==='wave'){this.enter('wave');return}const t=this.w.get(s.targetId);if(!t)throw Error('目标已不存在');if(s.type==='walk'){let d=norm(sub(t.p,this.pos));d[1]=0;d=norm(d);const standOff=t.id.startsWith('Z')?.35:Math.max(.52,(t.r||.2)+.38);const dir=this.relationDirection(s);const end=dir?add(t.p,mul(dir,(t.r||.25)+.48)):add(t.p,mul(d,-standOff));end[1]=0;this.route=this.w.path(this.pos,end,.26);this.routeIndex=0;this.enter('walk');return}const o=this.w.get(s.objectId);if(!o||o.held)throw Error('操作物体不可用');if(o.movable===false)throw Error(`${o.name} 是固定环境物体，只能作为导航或避障目标`);s.o=o;s.target=t;s.dest=this.destination(o,t);const capability=physicalAnalyzeStep(this.w,actorForReasoning(this),this.plan.steps[this.index]);s.strengthPreflight=capability.strength;if(!capability.feasible)throw Error(capability.reasons.join('；'));let dir=norm([o.p[0]-this.pos[0],0,o.p[2]-this.pos[2]]);if(s.type==='push')dir=norm([s.dest[0]-o.p[0],0,s.dest[2]-o.p[2]]);s.approachYaw=Math.atan2(dir[0],dir[2]);const end=add(o.p,mul(dir,-.46));end[1]=0;this.route=this.w.path(this.pos,end,.25,[o.id]);this.routeIndex=0;this.enter('approach')}
 finish(){const s=this.skill;this.evidence.push({step:this.index,type:s.type,objectId:s.objectId||null,targetId:s.targetId||null,completion:'verified',time:this.time,objectPosition:s.o?[...s.o.p]:null});this.stats.completed++;this.log('完成：'+({carry:'搬运并放置',push:'推动',walk:'到达目标',wave:'挥手',greet:'打招呼',salute:'敬礼',sit:'坐在地上',lie:'躺在地上',stand:'起身站立'})[s.type]);this.index++;this.skill=null;this.phase='idle';this.phaseT=0;if(this.plan&&this.index>=this.plan.steps.length){this.log('全部任务已验证完成');this.plan=null}}
 fail(message){this.error=message;this.stats.failed++;this.paused=true;if(this.lastSafe){for(let i=0;i<this.h.joints.length;i++){this.h.joints[i].p=[...this.lastSafe.joints[i].p];this.h.joints[i].q=[...this.lastSafe.joints[i].q]}this.h.fk();this.pos=[...this.lastSafe.pos];this.yaw=this.lastSafe.yaw}this.log('执行已阻断：'+message);this.evidence.push({step:this.index,completion:'failed',reason:message,time:this.time});}
 moveAlong(dt,speed=.50){return this.locomotion.move(dt,speed);}
 gait(dt,moving,measuredSpeed=null){this.locomotion.update(dt,moving,measuredSpeed);}
 handsFor(goal){return Object.fromEntries(['left','right'].map(side=>[side,compose(goal,this.grips[side])]))}
 carryingGoal(){return frame(add([this.pos[0],.92,this.pos[2]],rotate(qy(this.yaw),[0,0,.34])),qm(qy(this.yaw),this.skill.qRel))}
 tick(dt){if(this.paused)return;dt=clamp(dt,0,.035);const beforeRoot=[...this.pos];const beforeObjects=this.w.objects.map(o=>({id:o.id,p:[...o.p],held:o.held}));this.time+=dt;this.phaseT+=dt;if(!this.skill&&this.plan&&(this.basic.posture!=='standing'||this.locomotion.isSettled())){try{this.begin()}catch(e){this.fail(e.message);return}}if(this.basic.busy||this.basic.posture!=='standing'){try{this.basic.update(dt);this.strength.advance(dt,strengthFreeActivity(this));}catch(e){this.fail(e.message)}return;}let moving=false,crouch=0,lean=.015,hands=null,curl=0,wave=0;const s=this.skill;try{
 if(s){if(this.phase==='walk'||this.phase==='approach'){moving=this.moveAlong(dt);if(!moving&&this.routeIndex>=this.route.length){if(s.type==='walk'){if(this.locomotion.isSettled())this.finish()}else this.enter('settle')}}
 if(this.phase==='settle'){const d=angleDiff(s.approachYaw,this.yaw);this.yaw+=clamp(d,-1.4*dt,1.4*dt);if(Math.abs(d)<.015&&!this.swing&&this.phaseT>.35){this.grips=graspFrames(s.o,this.yaw,s.type==='push');s.initialPalms={left:frame(this.h.palm('left').p,this.h.palm('left').q),right:frame(this.h.palm('right').p,this.h.palm('right').q)};s.startObject=frame(s.o.p,s.o.q);s.qRel=qm(inv(qy(this.yaw)),s.o.q);this.enter('reach')}}
 if(this.phase==='reach'){const t=smoother(this.phaseT/1.7);crouch=t;lean=.91*t;const goal=this.handsFor(s.startObject);hands=Object.fromEntries(['left','right'].map(side=>[side,frame(mix(s.initialPalms[side].p,goal[side].p,t),qslerp(s.initialPalms[side].q,goal[side].q,t))]));if(this.phaseT>=1.7){s.contactWait=0;this.enter('close')}}
 if(this.phase==='close'){crouch=1;lean=.91;hands=this.handsFor(s.startObject);curl=s.type==='push'?0:clamp(this.phaseT/.50,0,1);}
 if(this.phase==='lift'){const t=smoother(this.phaseT/2.1);crouch=1-t;lean=.91*crouch+.035*t;const carry=this.carryingGoal(),goal=frame(mix(s.startObject.p,carry.p,t),qslerp(s.startObject.q,carry.q,t));hands=this.handsFor(goal);curl=1;if(this.phaseT>=2.1){const dir=norm([s.dest[0]-this.pos[0],0,s.dest[2]-this.pos[2]]);s.finalYaw=Math.atan2(dir[0],dir[2]);const end=add(s.dest,mul(dir,-.34));end[1]=0;this.route=this.w.path(this.pos,end,.43,[s.o.id]);this.routeIndex=0;this.enter('travel')}}
 if(this.phase==='travel'){moving=this.moveAlong(dt,.43);hands=this.handsFor(this.carryingGoal());curl=1;lean=.035;if(!moving&&this.routeIndex>=this.route.length&&!this.swing){this.enter('placeSettle')}}
 if(this.phase==='placeSettle'){const d=angleDiff(s.finalYaw,this.yaw);this.yaw+=clamp(d,-1.1*dt,1.1*dt);hands=this.handsFor(this.carryingGoal());curl=1;lean=.035;if(Math.abs(d)<.01&&!this.swing&&this.phaseT>.35){s.lowerStart=frame(s.o.p,s.o.q);this.enter('lower')}}
 if(this.phase==='lower'){const t=smoother(this.phaseT/2.1);crouch=t;lean=.035*(1-t)+.91*t;const dest=frame(s.dest,s.lowerStart.q);hands=this.handsFor(frame(mix(s.lowerStart.p,dest.p,t),s.lowerStart.q));curl=1;if(this.phaseT>=2.1)this.enter('release')}
 if(this.phase==='release'){crouch=1;lean=.91;hands=this.handsFor(frame(s.dest,s.lowerStart.q));curl=1-clamp(this.phaseT/.5,0,1);}
 if(this.phase==='rise'){const t=smoother(this.phaseT/1.7);crouch=1-t;lean=.91*crouch;hands=Object.fromEntries(['left','right'].map(side=>{const arm=this.h.arms[side],rest=frame(add(arm.upper.world.p,rotate(qy(this.yaw),[arm.s*.044,-.548,.029])),qm(qy(this.yaw),qy(-arm.s*Math.PI/2)));return [side,frame(mix(s.releasePalms[side].p,rest.p,t),qslerp(s.releasePalms[side].q,rest.q,t))]}));curl=0;if(this.phaseT>=1.7&&!this.swing){const directional=this.relationDirection(s);const good=directional?horizontal(s.o.p,s.dest)<.06:s.target.id.startsWith('Z')?this.w.inside(s.o,s.target):horizontal(s.o.p,s.target.p)<1.1&&!this.w.collision(s.o.p,s.o.r,[s.o.id]);if(!good)throw Error('物体实际位置未通过目标区域验证');this.finish()}}
 if(this.phase==='pushTravel'){crouch=1;lean=.91;const d=[s.dest[0]-s.o.p[0],0,s.dest[2]-s.o.p[2]],distance=len(d),v=mul(norm(d),Math.min(distance,.22*dt));s.pushGoal=frame(add(s.o.p,v),s.o.q);this.pos=add(this.pos,v);moving=distance>.012;hands=this.handsFor(s.pushGoal);if(distance<=.012&&!this.swing){s.lowerStart=frame(s.o.p,s.o.q);s.dest=[...s.o.p];this.enter('release')}}
 if(this.phase==='wave'){wave=smoother(Math.min(this.phaseT/.6,(3.0-this.phaseT)/.6));if(this.phaseT>3.0){wave=0;this.finish()}}
 }
 // Contact motion follows measured route displacement, including pushing.
 const speed=horizontal(beforeRoot,this.pos)/Math.max(dt,.00001);
 this.gait(dt,moving,speed);
 const natural=!hands&&!wave&&crouch<.01?this.locomotion.sample:null;
 const activity=clamp(this.walkSpeed/.5,0,1);
 this.pelvisDrop+=((activity*ADULT_STANCE.walkingPelvisDropM)-this.pelvisDrop)*(1-Math.exp(-dt*6));
 const posePosition=add(this.pos,rotate(qy(this.yaw),[natural?.sway||0,0,0]));
 let y=(REST_HIP_HEIGHT-this.pelvisDrop+(natural?.bob||0))*(1-crouch)+.325*crouch;
 // Leave headroom for pelvic tilt and use the actual lateral pose offset in
 // the fixed-length reach bound. The root path itself remains on the route.
 for(const side of ['left','right']){const f=this.feet[side].p,hip=add([posePosition[0],0,posePosition[2]],rotate(qy(this.yaw),[(side==='left'?-1:1)*ANATOMY.hipSpacing/2,0,0])),dx=horizontal(hip,f);const reach=LEG_REST_REACH-(natural?.006*activity:0),limit=Math.sqrt(Math.max(.08,reach**2-dx**2))+SKIN_SOLE_HEIGHT-(natural?.pelvisRoll?Math.abs(natural.pelvisRoll)*ANATOMY.hipSpacing/2:0);y=natural?Math.min(y,limit)-.004*Math.log1p(Math.exp(-Math.abs(y-limit)/.004)):Math.min(y,limit);}
 this.pos[1]=y;posePosition[1]=y;
 this.h.pose({position:posePosition,yaw:this.yaw,crouch,lean,feet:this.feet,hands,curl,wave,time:this.time,walk:moving?1:0,gaitSignal:this.gaitSignal,gaitBlend:this.gaitBlend,locomotion:natural,deltaTime:dt});
 if(s&&this.phase==='close'&&this.phaseT>.55){const r=graspResidual(this.h,s.o,this.grips),ok=Object.values(r).every(v=>v.positionM<.012&&v.angleRad<.07);if(ok){this.stats.graspEstablished++;this.held=s.o;s.o.held=true;this.grips=Object.fromEntries(['left','right'].map(side=>[side,compose(inverse(frame(s.o.p,s.o.q)),this.h.palm(side))]));this.enter(s.type==='push'?'pushTravel':'lift')}else if(this.phaseT>1.0)throw Error('双掌接触未成立：'+Math.round(Math.max(...Object.values(r).map(v=>v.positionM))*1000)+' mm')}
 if(this.held){const candidate=inferHeldFrame(this.h,this.grips);if(candidate.positionDisagreement>.025||candidate.angleDisagreement>.11)throw Error('左右掌约束不一致，已保持上一有效姿势');if(dist(candidate.p,this.held.p)>Math.max(.032,dt*1.3))throw Error('物体移动超过接触约束速度上限');if(this.w.collision(candidate.p,this.held.r+.025,[this.held.id])&&candidate.p[1]-this.held.h/2<.3)throw Error('搬运物体与场内物体发生碰撞');if(this.skill.type==='push')candidate.p[1]=this.held.h/2;const effort=strengthRuntimeAssessment(this,candidate,dt);this.strength.lastAssessment=effort;if(!effort.feasible)throw Error('力量限制：'+strengthReason(effort));this.strength.advance(dt,effort);this.strengthLastLengths=effort.request.lengthRatios;this.held.p=[...candidate.p];this.held.q=[...candidate.q];this.held.moveCount++;this.stats.heldFrames++;this.stats.maxGripDisagreementM=Math.max(this.stats.maxGripDisagreementM,candidate.positionDisagreement);const r=graspResidual(this.h,this.held,this.grips);this.stats.maxPalmResidualM=Math.max(this.stats.maxPalmResidualM,...Object.values(r).map(v=>v.positionM));}
 if(!this.held){this.strength.advance(dt,strengthFreeActivity(this));this.strengthLastLengths=null;}
 if(s&&this.phase==='release'&&this.phaseT>.52){if(Math.abs(s.o.p[1]-s.o.h/2)>.012)throw Error('物体未接触地面，禁止释放');s.o.held=false;this.held=null;s.releasePalms={left:frame(this.h.palm('left').p,this.h.palm('left').q),right:frame(this.h.palm('right').p,this.h.palm('right').q)};this.grips=null;this.w.revision++;this.enter('rise')}
 for(const before of beforeObjects){const now=this.w.get(before.id);if(dist(before.p,now.p)>1e-8&&!before.held&&!now.held)this.stats.objectMovesWithoutContact++;}const d=this.h.diagnostics();this.stats.maxBoneLengthErrorM=Math.max(this.stats.maxBoneLengthErrorM,d.maxBoneLengthErrorM);for(const side of['left','right'])if(this.swing?.side!==side)this.stats.maxFootPositionErrorM=Math.max(this.stats.maxFootPositionErrorM,dist(this.h.legs[side].wrist.world.p,this.feet[side].p));
 this.lastSafe={pos:[...this.pos],yaw:this.yaw,joints:this.h.joints.map(j=>({p:[...j.p],q:[...j.q]}))};
 }catch(e){this.fail(e.message)}}
 diagnostics(){return{strength:this.strength.report(),basic:this.basic.report(),locomotion:this.locomotion.report(),armSwing:{signal:this.gaitSignal,blend:this.gaitBlend,speedMPS:this.walkSpeed,mode:this.held?'grasp-priority':'contralateral-gait-coupling'},phase:this.phase,paused:this.paused,error:this.error,activeStep:this.skill?{type:this.skill.type,objectId:this.skill.objectId,targetId:this.skill.targetId}:null,plan:this.plan?{steps:this.plan.steps,index:this.index}:null,heldObject:this.held?.id||null,stats:{...this.stats},completionEvidence:[...this.evidence],world:this.w.snapshot(),body:this.h.diagnostics(),interactionMode:'two-hand-kinematic-constraints',forceDynamicsValidated:false,physicalFeasibilityReasoning:true,physicalProfile:PHYSICAL_REASONING_PROFILE,openLanguageUnderstanding:false,visualAcceptance:false,productionReady:false}}
}

// MODULE app
const $=id=>document.getElementById(id),logLines=[];
function logMessage(t){logLines.unshift(t);if(logLines.length>16)logLines.pop();$('log').replaceChildren(...logLines.map((s,i)=>{const p=document.createElement('div');p.textContent=s;p.className=i===0?'latest':'';return p}));$('stateLine').textContent=t}
let human,world,agent,renderer,auto=!new URLSearchParams(location.search).has('qa'),follow=false,isolation='all',cameraMode='body',floor,lines,labels=[],environmentPlacementId=null,environmentPointerStart=null,needsRedraw=true;
function buildLines(){const grid=[];const camp=world.theme==='camp';for(let x=-5;x<=5;x+=.5)grid.push([[x,.003,-4],[x,.003,4]]);for(let z=-4;z<=4;z+=.5)grid.push([[-5,.003,z],[5,.003,z]]);lines=camp?[]:[{g:lineMesh(grid),color:[.075,.105,.12]}];for(const z of world.zones){let segments=[];if(z.shape==='square'){const p=[[-z.r,-z.r],[z.r,-z.r],[z.r,z.r],[-z.r,z.r]];segments=p.map((a,i)=>[[z.p[0]+a[0],.009,z.p[2]+a[1]],[z.p[0]+p[(i+1)%4][0],.009,z.p[2]+p[(i+1)%4][1]]])}else{for(let k=0;k<120;k++){if(z.shape==='circle'&&Math.floor(k/5)%2)continue;if(z.shape==='hexagon'&&k%4!==0)continue;const fn=t=>{if(z.shape==='circle')return[z.p[0]+z.r*Math.cos(t*Math.PI*2),.009,z.p[2]+z.r*Math.sin(t*Math.PI*2)];const segment=t*6,a=Math.floor(segment),v=segment-a,A=[Math.cos(a*Math.PI/3)*z.r,Math.sin(a*Math.PI/3)*z.r],B=[Math.cos((a+1)*Math.PI/3)*z.r,Math.sin((a+1)*Math.PI/3)*z.r];return[z.p[0]+A[0]+(B[0]-A[0])*v,.009,z.p[2]+A[1]+(B[1]-A[1])*v]};segments.push([fn(k/120),fn((k+1)/120)])}}lines.push({g:lineMesh(segments),color:z.color})}}
function buildLabels(){for(const l of labels)l.el.remove();labels=[];for(const o of[...world.objects.filter(o=>world.theme!=='camp'||!['architecture','landscape'].includes(o.category)),...world.zones]){const el=document.createElement('div');el.className='worldLabel'+(o.id.startsWith('Z')?' zoneLabel':'');el.textContent=o.id.startsWith('Z')?o.name:o.id+' '+o.name;$('labels').append(el);labels.push({el,o})}$('objectList').replaceChildren(...world.objects.map(o=>{const row=document.createElement('div');row.className='object';const dot=document.createElement('span');dot.style.background=`rgb(${o.color.map(x=>Math.round(x*255)).join(',')})`;const name=document.createElement('span');name.textContent=o.id+' · '+o.name+(o.movable===false?' · 固定':'');row.append(dot,name);return row}))}

function environmentIdleGuard(){if(window.__jarvisSemanticReservation)throw Error('认知计划执行期间场景已锁定，请先停止任务');if(!agent)return;if(agent.plan||agent.skill||agent.held||agent.basic?.busy)throw Error('请先完成或停止当前身体任务，再修改训练场景')}
function environmentActorPoint(){return agent?.pos||[0,0,1.75]}
function environmentResponse(selected=null){return{schema:'knowledge_human/environment_editor_state@1.0',scene:world.exportScene(),selected,templates:Object.values(OBJECT_TEMPLATES).map(t=>({templateId:t.templateId,name:t.name,category:t.category,shape:t.shape,color:t.color,movable:t.movable!==false,collidable:t.collidable!==false,dimensions:{w:t.w||null,h:t.h||null,d:t.d||null,r:t.r||null}})),presets:Object.values(SCENE_PRESETS),placement:{active:Boolean(environmentPlacementId),entityId:environmentPlacementId},runtime:{taskActive:Boolean(agent?.plan||agent?.skill||agent?.held||agent?.basic?.busy),bodyPosition:agent?.pos||null}}}
function environmentChanged(reason,selected=null){configureWorldPresentation();buildLines();buildLabels();if(renderer){renderer.lastItems=[];renderer.lastLines=[]}needsRedraw=true;window.dispatchEvent(new CustomEvent('humanlab:environment-change',{detail:{reason,selected,sceneRevision:world.revision,sceneName:world.sceneName}}));return environmentResponse(selected)}
function groundPointFromPointer(event){
 const rect=renderer.canvas.getBoundingClientRect(),nx=(event.clientX-rect.left)/Math.max(1,rect.width)*2-1,ny=1-(event.clientY-rect.top)/Math.max(1,rect.height)*2;
 const forward=norm(sub(renderer.target,renderer.eye)),right=norm(cross(forward,[0,1,0])),up=norm(cross(right,forward)),aspect=rect.width/Math.max(1,rect.height);
 let origin=renderer.eye,dir=forward;
 if(renderer.projection==='orthographic')origin=add(origin,add(mul(right,nx*renderer.orthoHeight*.5*aspect),mul(up,ny*renderer.orthoHeight*.5)));
 else{const tan=Math.tan(.72/2);dir=norm(add(forward,add(mul(right,nx*tan*aspect),mul(up,ny*tan))));}
 if(Math.abs(dir[1])<1e-6)throw Error('当前视角无法与地面求交，请切换到场景视图');
 const t=-origin[1]/dir[1];if(t<=0)throw Error('请点击人物脚下可见的训练场地面');
 const p=add(origin,mul(dir,t));return[clamp(p[0],world.bounds.xMin,world.bounds.xMax),0,clamp(p[2],world.bounds.zMin,world.bounds.zMax)];
}
const EnvironmentAPI={
 list:()=>environmentResponse(),
 templates:()=>environmentResponse().templates,
 presets:()=>environmentResponse().presets,
 add:payload=>{environmentIdleGuard();const entity=payload?.kind==='zone'?world.addZone(payload):world.addObject(payload||{},environmentActorPoint());return environmentChanged('add',entity)},
 update:payload=>{environmentIdleGuard();const entity=world.updateEntity(payload?.id,payload?.patch||{},environmentActorPoint());return environmentChanged('update',entity)},
 remove:payload=>{environmentIdleGuard();const result=world.removeEntity(payload?.id);if(environmentPlacementId===String(payload?.id||'').toUpperCase())environmentPlacementId=null;return environmentChanged('remove',result.entity)},
 duplicate:payload=>{environmentIdleGuard();const entity=world.duplicateEntity(payload?.id,environmentActorPoint());return environmentChanged('duplicate',entity)},
 preset:payload=>{environmentIdleGuard();world.applyPreset(payload?.presetId||'sorting',payload?.seed??world.seed);agent.reset();return environmentChanged('preset')},
 randomize:payload=>{environmentIdleGuard();world.randomize(payload?.seed??world.seed+1,Boolean(payload?.includeStatic),environmentActorPoint());agent.reset();return environmentChanged('randomize')},
 export:()=>world.exportScene(),
 import:payload=>{environmentIdleGuard();world.importScene(payload?.scene||payload,environmentActorPoint());agent.reset();return environmentChanged('import')},
 placement:payload=>{environmentIdleGuard();const id=String(payload?.id||'').toUpperCase(),entity=world.get(id);if(!entity)throw Error('没有找到需要定位的实体');environmentPlacementId=id;renderer.canvas.style.cursor='crosshair';window.dispatchEvent(new CustomEvent('humanlab:environment-placement',{detail:{active:true,entityId:id}}));return environmentResponse(entity)},
 cancelPlacement:()=>{environmentPlacementId=null;if(renderer)renderer.canvas.style.cursor='';window.dispatchEvent(new CustomEvent('humanlab:environment-placement',{detail:{active:false,entityId:null}}));return environmentResponse()}
};
function installEnvironmentPlacement(){const c=$('view');c.addEventListener('pointerdown',event=>{if(!environmentPlacementId)return;environmentPointerStart=[event.clientX,event.clientY];event.preventDefault();event.stopImmediatePropagation()},{capture:true});c.addEventListener('pointermove',event=>{if(!environmentPlacementId)return;event.preventDefault();event.stopImmediatePropagation()},{capture:true});c.addEventListener('pointerup',event=>{if(!environmentPlacementId)return;event.preventDefault();event.stopImmediatePropagation();const id=environmentPlacementId,start=environmentPointerStart;environmentPointerStart=null;try{if(start&&Math.hypot(event.clientX-start[0],event.clientY-start[1])>8)throw Error('定位模式请单击地面，拖动不会改变实体位置');const p=groundPointFromPointer(event),entity=world.updateEntity(id,{p},environmentActorPoint());environmentPlacementId=null;c.style.cursor='';environmentChanged('place',entity);window.dispatchEvent(new CustomEvent('humanlab:environment-placement',{detail:{active:false,entityId:id,placed:true,p:entity.p}}))}catch(error){logMessage('场景定位失败：'+error.message);window.dispatchEvent(new CustomEvent('humanlab:environment-placement',{detail:{active:true,entityId:id,error:error.message}}))}},{capture:true});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&environmentPlacementId){EnvironmentAPI.cancelPlacement();logMessage('已取消场景点选定位')}})}

const filters={all:b=>true,femur:b=>b.id==='right_femur',upper:b=>/^right_(humerus|ulna|radius|clavicle|scapula)$/.test(b.id),pelvis:b=>/os_coxa|sacrum|coccyx/.test(b.id),thorax:b=>/rib_|^T\d|sternum|clavicle|scapula/.test(b.id),hand:b=>/^right_(metacarpal|finger_|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate)/.test(b.id),foot:b=>/^right_(talus|calcaneus|navicular|cuboid|.*cuneiform|metatarsal|toe_)/.test(b.id),feet:b=>/^(left|right)_(talus|calcaneus|navicular|cuboid|.*cuneiform|metatarsal|toe_)/.test(b.id),head:b=>/craniofacial|mandible/.test(b.id),spine:b=>/^[CLT]\d|sacrum|coccyx/.test(b.id)};
function focus(mode='body'){renderer.projection='perspective';cameraMode=mode;follow=false;isolation='all';$('isolate').value='all';renderer.yaw=mode==='field'?.22:.2;renderer.pitch=mode==='field'?.78:.15;renderer.distance=mode==='field'?(world?.theme==='camp'?39:9.7):3.05;renderer.target=mode==='field'?(world?.theme==='camp'?[-.2,.3,0]:[0,.2,-.10]):add(agent.pos,[0,.03,0]);$('follow').checked=follow;needsRedraw=true;updateVisibility()}
function setCameraFollow(value){follow=value===true;$('follow').checked=follow;needsRedraw=true;return{follow,mode:cameraMode};}
function inspectBody(view='front'){
 if(!['front','side','back'].includes(view))throw Error('Unknown inspection view');
 focus('body');renderer.projection='orthographic';renderer.orthoHeight=ADULT_SPEC.statureM*1.16;
 renderer.yaw=agent.yaw+(view==='side'?Math.PI/2:view==='back'?Math.PI:0);renderer.pitch=0;
 cameraMode='inspection';needsRedraw=true;renderFrame();
}
function updateVisibility(){const showBones=isolation!=='all'||human.tissue?.view==='skeleton'||human.tissue?.view==='muscle';human.tissue?.visibility(isolation!=='all');for(const b of human.bones)b.visible=showBones&&filters[isolation](b);for(const c of human.cartilage)c.visible=showBones&&(c.kind==='tooth'?(isolation==='all'||isolation==='head'):(isolation==='all'&&$('cartilage').checked))}
function isolate(value){isolation=value;if(value==='all'){focus('body');return}renderer.projection='perspective';follow=false;$('follow').checked=false;updateVisibility();const selected=human.bones.filter(b=>b.visible),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const b of selected){for(let i=0;i<b.g.p.length;i+=18){const p=add(b.joint.world.p,rotate(b.joint.world.q,[b.g.p[i],b.g.p[i+1],b.g.p[i+2]]));for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k])}}}renderer.target=min.map((v,i)=>(v+max[i])/2);renderer.distance=Math.max(.32,Math.max(...min.map((v,i)=>max[i]-v))*2.05);renderer.pitch=.04;renderer.yaw=.12;}
function renderFrame(){if(!human)return;if(window.HumanLab?.lowerLimb?.active){window.HumanLab.lowerLimb.render();return;}if(window.HumanLab?.headNeck?.active){window.HumanLab.headNeck.render();return;}if(window.HumanLab?.torso?.active){window.HumanLab.torso.render();return;}if(window.HumanLab?.shoulders?.active){window.HumanLab.shoulders.render();return;}if(window.HumanLab?.hands?.active){window.HumanLab.hands.render();return;}updateVisibility();if(follow&&isolation==='all'){const seated=agent.basic.posture==='sitting';renderer.target=add(agent.pos,[seated?Math.sin(agent.yaw)*.23:0,seated?.27:renderer.projection==='orthographic'?ADULT_SPEC.statureM/2-agent.pos[1]:REST_HIP_HEIGHT-agent.pos[1]+.04,seated?Math.cos(agent.yaw)*.23:0]);}const items=[...human.bones,...human.cartilage,...human.tissue.items];if(isolation==='all'){renderer.studioMode=false;renderer.background=world.theme==='camp'?[...CAMP_WORLD.presentation.background]:null;items.unshift(floor,...(world.scenery||[]),...(world.showRoofs?world.roofItems||[]:[]),...world.objects);}renderer.render(items.filter(item=>item.visible!==false),isolation==='all'?lines:[]);for(const l of labels){const s=renderer.screen(add(l.o.p,[0,l.o.id.startsWith('Z')?.04:l.o.h/2+.10,0]));l.el.style.display=isolation==='all'&&s?.visible?'block':'none';if(s)l.el.style.transform=`translate(${s.x}px,${s.y}px) translate(-50%,-100%)`;}$('renderInfo').textContent=`WebGL2 · ${human.bones.length} 骨元素 · ${human.tissue.muscles.length} 肌群 · ${human.tissue.surfaceInfo.vertices} 皮肤顶点`;}
function panel(){window.HumanLab?.strength?.refresh();const d=agent.diagnostics(),st=d.stats;$('phase').textContent=d.error?'已阻断':d.paused?'已暂停':({groundSit:'坐在地上',groundLie:'躺在地上',floorAlign:'调整坐躺朝向',sitDown:'缓慢坐下',lieDown:'躺下',standUp:'起身',greet:'打招呼',salute:'敬礼',idle:'等待指令',approach:'寻路接近',settle:'调整站位',reach:'全身趋近',close:'建立接触',lift:'约束抬起',travel:'负载步行',placeSettle:'对齐放置站位',lower:'下蹲放置',release:'解除抓握',rise:'恢复站立',wave:'挥手',walk:'步行',pushTravel:'接触推动'})[d.phase]||d.phase;$('held').textContent=d.heldObject||'无';$('posture').textContent=({standing:'站立',sitting:'坐姿',lying:'躺姿'})[d.basic.posture];$('swingState').textContent=d.heldObject?'保持抓握':d.basic.gesture?'手势优先':d.armSwing.blend>.1?'随步态交替摆动':'自然放松';$('boneError').textContent=(d.body.maxBoneLengthErrorM*1000).toFixed(5)+' mm';$('gripError').textContent=(st.maxPalmResidualM*1000).toFixed(2)+' mm';$('footError').textContent=(st.maxFootPositionErrorM*1000).toFixed(2)+' mm';$('done').textContent=String(st.completed);$('plan').replaceChildren(...(agent.plan?.steps||[]).map((s,i)=>{const e=document.createElement('div');e.className='planStep'+(i===agent.index?' current':i<agent.index?' finished':'');e.textContent=`${i+1}. ${{carry:'搬运',push:'推动',walk:'走到',wave:'挥手',sit:'坐地',lie:'躺下',stand:'起身',greet:'打招呼',salute:'敬礼'}[s.type]} ${s.objectId||''} ${s.targetId?'→ '+s.targetId:''}`;return e}));$('pause').textContent=agent.paused?'继续':'暂停';}
function submit(){try{agent.submit($('command').value);if(isolation!=='all')focus('body');panel()}catch(e){logMessage(e.message)}}
function exportReport(){const report={build:'jarvis-procedural-human-v1.11.2',constraintRelease:'research-grounded-rom-v08',time:new Date().toISOString(),...agent.diagnostics(),runtimeNetworkRequests:performance.getEntriesByType("resource").filter(r=>/^https?:/.test(r.name)).length};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));a.download='human-v1112-runtime-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function startupStage(stage,message){
 window.__humanStartup={status:'initializing',stage,message};
 $('loading').textContent=message;
 window.dispatchEvent(new CustomEvent('humanlab:startup-progress',{detail:window.__humanStartup}));
 await new Promise(resolve=>setTimeout(resolve,0));
}
async function init(){try{
 await startupStage('graphics','正在初始化 WebGL2 与皮肤着色器');
 renderer=new Renderer($('view'));
 await startupStage('skeleton','正在建立骨骼与关节');
 human=new Human();
 await startupStage('tissue','正在生成肌肉和连续皮肤，首次生成需要一些时间');
 human.tissue=new ProceduralTissue(human);renderer.setTissue(human.tissue);
 await startupStage('world','正在生成智能生活空间与身体控制器');
 world=new World(260901);world.applyPreset('camp',260901);agent=new Agent(human,world,logMessage);
 await startupStage('binding','正在准备首帧与大脑身体接口');
 floor={g:box(10,.035,8),p:[0,-.020,0],q:qi(),materialKind:5,color:[.19,.22,.23],castShadow:false};configureWorldPresentation();buildLines();buildLabels();installEnvironmentPlacement();$('boneCount').textContent=human.bones.length;$('jointCount').textContent=human.joints.length;$('hash').textContent=human.evidence.geometryHash;focus('field');$('send').onclick=submit;for(const btn of document.querySelectorAll('[data-command]'))btn.onclick=()=>{$('command').value=btn.dataset.command;submit()};$('command').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')submit()});$('pause').onclick=()=>{agent.paused=!agent.paused;panel()};$('bodyView').onclick=()=>focus('body');$('fieldView').onclick=()=>focus('field');$('front').onclick=()=>inspectBody('front');$('side').onclick=()=>inspectBody('side');$('top').onclick=()=>{renderer.projection='perspective';renderer.yaw=0;renderer.pitch=1.49};$('back').onclick=()=>inspectBody('back');$('isolate').onchange=e=>isolate(e.target.value);$('follow').onchange=e=>setCameraFollow(e.target.checked);$('cartilage').onchange=updateVisibility;$('quality').onchange=e=>{renderer.setQuality(e.target.value);renderFrame()};$('report').onclick=exportReport;$('reshuffle').onclick=()=>{if(agent.skill||agent.held){logMessage('任务期间保留场景位置，请先完成当前任务');return}world.reset(Number($('seed').value));agent.reset();buildLines();buildLabels();logMessage('场景已按种子 '+world.seed+' 重新生成');focus('field')};$('reset').onclick=()=>{if(agent.held){logMessage('持物期间禁止重置，保持物体与手掌约束');return}agent.reset();logMessage('已恢复人物站姿');focus('body')};
window.HumanLab={version:'1.16.0-body-plan-r9',human,world,agent,renderer,environment:EnvironmentAPI,physicalProfile:PHYSICAL_REASONING_PROFILE,tissue:human.tissue,inspectBody,setCameraFollow,get camera(){return{follow,mode:cameraMode}},setAnatomyView:mode=>{human.tissue.setView(mode);needsRedraw=true;renderFrame();return human.tissue.report()},get status(){return agent.diagnostics()},command:text=>agent.submit(text),validatePlan:p=>agent.validateSemanticPlan(p),submitPlan:p=>agent.submitPlan(p),analyzeStep:(step,actor={})=>physicalAnalyzeStep(world,actorForReasoning(agent,actor),step),simulatePlan:(plan,actor={})=>simulateSemanticPlan(world,agent,plan,actor),advance:seconds=>{auto=false;for(let i=0;i<Math.ceil(seconds*60);i++)advanceBody(1/60);panel();renderFrame();return agent.diagnostics()},render:renderFrame,focus,isolate:value=>{$('isolate').value=value;isolate(value);renderFrame()},setAuto:value=>auto=value,reset:seed=>{world.reset(seed||260901);agent.reset();buildLines();buildLabels();renderer.lastItems=[];renderer.lastLines=[];focus('body')},report:()=>agent.diagnostics()};
window.HumanLab.hands=new HandWorkbench(window.HumanLab);
window.HumanLab.shoulders=new ShoulderWorkbench(window.HumanLab);
window.HumanLab.torso=new TorsoWorkbench(window.HumanLab);
window.HumanLab.headNeck=new HeadNeckWorkbench(window.HumanLab);
window.HumanLab.lowerLimb=new LowerLimbWorkbench(window.HumanLab);
window.HumanLab.character=installCharacterPresetAPI(window.HumanLab);
window.HumanLab.strength=installStrengthAPI(window.HumanLab);
window.HumanLab.camp={overview:campOverview,get roofsVisible(){return world.showRoofs===true;},setRoofs(value){if(world.theme!=='camp')throw Error('当前不是军营场景');world.showRoofs=value===true;needsRedraw=true;return world.showRoofs;},get layout(){return {schema:CAMP_WORLD.schema,bounds:{...world.bounds},rooms:clone(CAMP_WORLD.rooms)};}};
window.HumanLab.bodySex=BODY_SEX;window.HumanLab.switchBodyPreset=switchBodyPreset;
installBodyPresetControls();
installWholeBodyControls(window.HumanLab);
window.HumanLab.hair=installProceduralHair(window.HumanLab);
window.HumanLab.npc=installNPCDefinitionAPI(window.HumanLab);
window.HumanLab.settings=installBodySettings(window.HumanLab);
if(window.__HEAD_NECK_STUDIO_DEFAULT__)window.HumanLab.headNeck.enter();
if(window.__TORSO_STUDIO_DEFAULT__)window.HumanLab.torso.enter();
if(window.__SHOULDER_STUDIO_DEFAULT__)window.HumanLab.shoulders.enter();
if(window.__HAND_STUDIO_DEFAULT__)window.HumanLab.hands.enter();
const bodyQuery=new URLSearchParams(window.location.search),presetState=window.__BODY_PRESET_STATE__;
if(presetState?.torso||bodyQuery.get('bodyStudio')==='torso'){
 const tr=window.HumanLab.torso;tr.enter();
 const mode=presetState?.mode||bodyQuery.get('bodyLayer'),view=presetState?.view||bodyQuery.get('bodyView');
 if(['clay','skin','bones','structure','support','muscle'].includes(mode))tr.mode=mode;
 if(['front','side','back','threequarter','full'].includes(view))tr.view(view);
}
if(presetState?.lowerLimb||bodyQuery.get('bodyStudio')==='lowerLimb'){
 const ll=window.HumanLab.lowerLimb;ll.enter();
 if(['lower','hips','full'].includes(presetState?.lowerScope))ll.scope=presetState.lowerScope;
 const mode=presetState?.mode||bodyQuery.get('bodyLayer'),view=presetState?.view||bodyQuery.get('bodyView');
 if(['clay','skin','bones','structure','support','muscle'].includes(mode))ll.mode=mode;
 if(['front','side','medial','back','top','threequarter'].includes(view))ll.view(view);
}
restoreNPCPreview(window.HumanLab);
try{human.characterTaskStatus=window.HumanLab.character.startOnSpawn();}catch(error){human.characterTaskStatus={started:false,error:error.message};logMessage('角色预设任务未开始：'+error.message);}
let previous=performance.now(),lastPanel=0;needsRedraw=true;
for(const name of ['click','change','input','pointermove','wheel'])document.addEventListener(name,()=>needsRedraw=true,{passive:true});
window.addEventListener('resize',()=>needsRedraw=true);
function advanceBodyWithoutHair(dt){if(window.HumanLab?.lowerLimb?.active){window.HumanLab.lowerLimb.tick(dt);return;}if(window.HumanLab?.headNeck?.active){window.HumanLab.headNeck.tick(dt);return;}if(window.HumanLab?.torso?.active){window.HumanLab.torso.tick(dt);return;}if(window.HumanLab?.shoulders?.active){window.HumanLab.shoulders.tick(dt);return;}if(window.HumanLab?.hands?.active){window.HumanLab.hands.tick(dt);return;}agent.tick(dt);human.tissue.update(agent.time,agent.paused?0:dt,agent.held?.mass||0);}
function advanceBody(dt){const hair=window.HumanLab?.hair;if(hair?.demo)hair.tickDemo(dt);else advanceBodyWithoutHair(dt);if(hair){hair.update(agent.paused&&!hair.inStudio()?0:dt);if(hair.dirty&&hair.enabled)needsRedraw=true;}}
function loop(now){const dt=Math.min(.1,(now-previous)/1000);previous=now;
 const active=window.HumanLab?.headNeck?.active?window.HumanLab.headNeck.playing:window.HumanLab?.torso?.active?window.HumanLab.torso.playing:window.HumanLab?.shoulders?.active?window.HumanLab.shoulders.playing:window.HumanLab?.hands?.active?window.HumanLab.hands.playing:!agent.paused; // Keep respiration visible while idle.
 if(auto){let left=dt;while(left>0){const t=Math.min(left,1/60);advanceBody(t);left-=t}}
 if(needsRedraw||(auto&&active)){renderFrame();needsRedraw=false}
 if(now-lastPanel>160){panel();lastPanel=now}requestAnimationFrame(loop)}
logMessage('骨骼、肌肉与连续皮肤已生成。智能生活空间就绪，等待你的指令。');panel();renderFrame();
window.__humanStartup={status:'ready',stage:'ready',message:'身体已就绪'};
$('loading').hidden=true;needsRedraw=false;requestAnimationFrame(loop);
}catch(e){
 const error=String(e?.message||e);
 window.__startupError=String(e?.stack||error);
 window.__humanStartup={status:'failed',stage:window.__humanStartup?.stage||'startup',message:'身体启动失败',error};
 delete window.HumanLab;
 $('loading').hidden=false;$('loading').textContent='启动失败：'+error;
 window.dispatchEvent(new CustomEvent('humanlab:startup-failed',{detail:window.__humanStartup}));
 console.error(e);
}}
init();
