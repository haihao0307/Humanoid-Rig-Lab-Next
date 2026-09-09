const ADULT_BASE_SPEC=Object.freeze(/*__ADULT_SPEC_JSON__*/);
const ADULT_SPEC=adultPresetSpec(ADULT_BASE_SPEC);
// C1 monotone redistribution leaves pelvis and cervical/head lengths intact.
function bodyAxialY(y){const u=clamp((y-.065)/.425,0,1);return y+ADULT_SPEC.axialExtensionM*u*u*(3-2*u);}
function bodyAuthorY(y){let x=y;for(let k=0;k<5;k++){const u=clamp((x-.065)/.425,0,1),derivative=1+ADULT_SPEC.axialExtensionM*6*u*(1-u)/.425;x-=(bodyAxialY(x)-y)/derivative;}return x;}
const ADULT_RIG=ADULT_SPEC.rig,ADULT_STANCE=ADULT_SPEC.stance;
const limbFlexionSign=kind=>kind==='arm'?ADULT_RIG.elbowFlexionSign:ADULT_RIG.kneeFlexionSign;
const LEG_REST_REACH=Math.sqrt(ADULT_RIG.femurLengthM**2+ADULT_RIG.tibiaLengthM**2+
  2*ADULT_RIG.femurLengthM*ADULT_RIG.tibiaLengthM*Math.cos(ADULT_STANCE.kneeFlexionDeg*Math.PI/180));
const REST_HIP_HEIGHT=ADULT_STANCE.ankleHeightM+Math.sqrt(LEG_REST_REACH**2-
  (ADULT_STANCE.footHalfSpacingM-ADULT_RIG.hipSpacingM/2)**2-ADULT_STANCE.ankleForwardM**2);
const HEAD_ROOT_Y=ADULT_SPEC.statureM-ADULT_SPEC.head.vertexY-REST_HIP_HEIGHT;
const SPINE_STATIONS=Object.freeze([
  ...Array.from({length:5},(_,i)=>['L',5-i,ADULT_RIG.lumbarY[0]+i*(ADULT_RIG.lumbarY[1]-ADULT_RIG.lumbarY[0])/4]),
  ...Array.from({length:12},(_,i)=>['T',12-i,ADULT_RIG.thoracicY[0]+i*(ADULT_RIG.thoracicY[1]-ADULT_RIG.thoracicY[0])/11]),
  ...Array.from({length:7},(_,i)=>['C',7-i,ADULT_RIG.cervicalStartY+i*(HEAD_ROOT_Y-ADULT_RIG.headAboveAtlasM-ADULT_RIG.cervicalStartY)/6])
]);
// Shared C1 curve across regional boundaries; Z positive anterior.
// L5 body centre (joint Z + 12 mm) aligns with the sacral superior body.
const SPINE_SAGITTAL_ROWS=Object.freeze([
 [.112,-.055],[.140,-.038],[.168,-.027],[.196,-.020],[.224,-.022],
 [.250,-.026],[.294,-.034],[.359,-.036],[.425,-.028],[.490,-.014],
 [.517,-.014],[.575,.004]
].map(([y,z])=>[bodyAxialY(y),z]).concat([[HEAD_ROOT_Y-ADULT_RIG.headAboveAtlasM,.008]]));
function spineStationZ(type,y){
 const r=SPINE_SAGITTAL_ROWS;let i=0;while(i<r.length-2&&y>r[i+1][0])i++;
 const slope=k=>{if(k===0)return (r[1][1]-r[0][1])/(r[1][0]-r[0][0]);
  if(k===r.length-1)return (r[k][1]-r[k-1][1])/(r[k][0]-r[k-1][0]);
  const a=(r[k][1]-r[k-1][1])/(r[k][0]-r[k-1][0]),b=(r[k+1][1]-r[k][1])/(r[k+1][0]-r[k][0]);
  return a*b<=0?0:2*a*b/(a+b);};
 const [ya,za]=r[i],[yb,zb]=r[i+1],h=yb-ya,u=clamp((y-ya)/h,0,1);
 return (2*u**3-3*u*u+1)*za+(u**3-2*u*u+u)*h*slope(i)
  +(-2*u**3+3*u*u)*zb+(u**3-u*u)*h*slope(i+1);
}
const ANATOMY=Object.freeze({schema:'knowledge_human/anatomy@0.4',version:'1.16.0',units:'m',
  heightTarget:ADULT_SPEC.statureM,femurLength:ADULT_RIG.femurLengthM,tibiaLength:ADULT_RIG.tibiaLengthM,
  humerusLength:ADULT_RIG.humerusLengthM,forearmLength:ADULT_RIG.forearmLengthM,
  hipSpacing:ADULT_RIG.hipSpacingM,shoulderWidth:2*(ADULT_RIG.scOffsetM[0]+ADULT_RIG.clavicleVectorM[0]),
  sourceIds:['S01','S02','S03','S04','S05','S06','S07'],
  parameterStatus:ADULT_SPEC.baseline,medicalValidation:false});
const mirrorBodyPoint=(p,side)=>[side*p[0],p[1],p[2]];
const headBonePoint=p=>p.map((v,k)=>v*ADULT_SPEC.head.boneScale[k]+ADULT_SPEC.head.boneOffsetM[k]);
const footBonePoint=p=>p.map((v,k)=>v*ADULT_SPEC.foot.boneScale[k]);
// Geometry changes happen only once when constructing the new skeleton.
function remapBoneGeometry(g,scale,offset=[0,0,0]){
  for(let i=0;i<g.p.length;i+=3){for(let k=0;k<3;k++){g.p[i+k]=g.p[i+k]*scale[k]+offset[k];g.n[i+k]/=scale[k];}
    const n=Math.hypot(g.n[i],g.n[i+1],g.n[i+2]);for(let k=0;k<3;k++)g.n[i+k]/=Math.max(n,1e-9);}
  return g;
}


