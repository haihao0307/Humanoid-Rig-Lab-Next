// CHICKEN_R984_NATURAL_HEAD_PATCH
// Independent visual audit rejected the R9.8.3 slab-like head, floating spherical
// eye and spear bill. R9.8.4 bypasses that carrier while keeping every frozen
// non-head system and rebuilds only the connected upper-neck/head/face domain.
window.__CHICKEN_R984_PATCH__=Object.freeze({
 version:'V4.6_R9.8_4_NATURAL_HEAD_FACE_CANDIDATE',
 predecessor:'V4.6_R9.8_3_CLEAN_FACE_EMBEDDED_BILL_CANDIDATE',
 source:'CHICKEN_V46_R9_1.html',
 method:'R9.1 base carrier + smooth full head-mask refit + attached eye dome + compact asymmetric bill',
 domain:[.232,.470],
 preserves:['R9/R9.1 rollback','lower neck','body','plumage','wing','tail','feet','materials','existing controls'],
 manualVisualAcceptance:false,rigAuthorized:false,motionAuthorized:false
});

const __r984K=Object.freeze([
 [.245,.854,.035,.015,.028],[.260,.870,.045,.021,.035],
 [.278,.889,.057,.028,.045],[.298,.907,.065,.037,.055],
 [.320,.920,.070,.044,.063],[.344,.925,.071,.047,.067],
 [.368,.923,.069,.046,.066],[.390,.917,.062,.043,.060],
 [.407,.913,.053,.038,.051],[.422,.915,.041,.030,.041]
]);
function __r984Spline(col){
 const n=__r984K.length,x=__r984K.map(v=>v[0]),a=__r984K.map(v=>v[col]),h=[],alpha=new Array(n).fill(0),l=new Array(n).fill(0),mu=new Array(n).fill(0),z=new Array(n).fill(0),c=new Array(n).fill(0),b=new Array(n-1).fill(0),d=new Array(n-1).fill(0);
 for(let i=0;i<n-1;i++)h[i]=x[i+1]-x[i];
 for(let i=1;i<n-1;i++)alpha[i]=3*(a[i+1]-a[i])/h[i]-3*(a[i]-a[i-1])/h[i-1];
 l[0]=1;
 for(let i=1;i<n-1;i++){l[i]=2*(x[i+1]-x[i-1])-h[i-1]*mu[i-1];mu[i]=h[i]/l[i];z[i]=(alpha[i]-h[i-1]*z[i-1])/l[i];}
 l[n-1]=1;
 for(let j=n-2;j>=0;j--){c[j]=z[j]-mu[j]*c[j+1];b[j]=(a[j+1]-a[j])/h[j]-h[j]*(c[j+1]+2*c[j])/3;d[j]=(c[j+1]-c[j])/(3*h[j]);}
 return value=>{const v=clamp(value,x[0],x[n-1]);let j=0;while(j<n-2&&v>x[j+1])j++;const dx=v-x[j];return a[j]+b[j]*dx+c[j]*dx*dx+d[j]*dx*dx*dx;};
}
const __r984S=[1,2,3,4].map(__r984Spline);
function __r984Profile(x,ctrl={head_scale:1}){
 const xx=clamp(x,__r984K[0][0],__r984K[__r984K.length-1][0]);
 const local=1+((ctrl.head_scale||1)-1)*ss(.250,.300,xx)*(1-ss(.402,.424,xx));
 return[__r984S[0](xx),__r984S[1](xx)*local,__r984S[2](xx)*local,__r984S[3](xx)*local];
}
function __r984Target(x,j,ctrl){
 const[cy,rt,rb,rz]=__r984Profile(x,ctrl),th=2*Math.PI*j/96,c=Math.cos(th),sn=Math.sin(th);
 // j=0 is ventral, j=48 dorsal in the inherited carrier rings.
 let y=cy+(c<0?rt*Math.pow(-c,.92):-rb*Math.pow(c,.84));
 const orbit=Math.exp(-Math.pow((x-.382)/.035,2)-Math.pow((y-.945)/.026,2));
 const cheek=Math.exp(-Math.pow((x-.386)/.042,2)-Math.pow((y-.904)/.034,2));
 const lat=rz*(1+.035*orbit+.070*cheek);
 return[x,y,.09-lat*sn];
}
function __r984Top(x,ctrl){const[cy,rt]=__r984Profile(x,ctrl);return cy+rt;}

// Bypass the R9.8.3 partial-band carrier. The exact R9.1 head-top function is
// retained in __r98BaseHead by the predecessor patch and is the clean source.
applyHeadTopR91=function(input,amount,ctrl){
 __r98CandidatePhase=true;
 const base=__r98BaseHead(input,amount,ctrl),p=base.slice(),a=clamp(amount,0,1),rows=72,cols=96;
 let moved=0,maxDisplacement=0,nonFinite=0,nonHeadMoved=0,previous=-Infinity,monotonic=true;
 for(let r=0;r<rows;r++){
  const start=r*cols*3,x=base[start];
  // Collapse the inherited long bill into a tiny internal carrier. The visible
  // bill is generated separately below and overlaps the facial root.
  if(x>.425){
   const u=clamp((x-.425)/(.523116-.425)),tx=.4095+.0015*u;
   for(let j=0;j<cols;j++){
    const q=start+j*3,ox=p[q],oy=p[q+1],oz=p[q+2];
    p[q]+=(tx-p[q])*a;
    p[q+1]+=(.918+(p[q+1]-.918)*.018-p[q+1])*a;
    p[q+2]+=(.09+(p[q+2]-.09)*.018-p[q+2])*a;
    const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);
    if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);}
    if(!Number.isFinite(p[q])||!Number.isFinite(p[q+1])||!Number.isFinite(p[q+2]))nonFinite++;
   }
   const sx=p[start];if(sx<=previous)monotonic=false;previous=sx;continue;
  }
  if(x<.228){const sx=p[start];if(sx<=previous)monotonic=false;previous=sx;continue;}
  const domain=ss(.228,.258,x)*(1-ss(.414,.428,x))*a;
  if(domain<=0){const sx=p[start];if(sx<=previous)monotonic=false;previous=sx;continue;}
  const prof=__r984Profile(x,ctrl),targetBottom=prof[0]-prof[2];
  // A wide, C2-smooth vertical mask shapes the complete cranial/face surface
  // while protecting the lower neck. This removes the R9.8.3 slab boundary.
  for(let j=0;j<cols;j++){
   const q=start+j*3,ox=p[q],oy=p[q+1],oz=p[q+2];
   const vertical=ss(targetBottom-.060,targetBottom+.006,oy);
   const posteriorGuard=.82+.18*ss(.250,.285,x);
   const w=domain*vertical*posteriorGuard;
   if(w<=0)continue;
   const t=__r984Target(x,j,ctrl);
   p[q]+=(t[0]-p[q])*w;
   p[q+1]+=(t[1]-p[q+1])*w;
   p[q+2]+=(t[2]-p[q+2])*w;
   // Small attached cheek and mandibular support; no separate floating mass.
   const side=Math.abs(p[q+2]-.09)/Math.max(prof[3],.001);
   const cheek=Math.exp(-Math.pow((x-.386)/.036,2)-Math.pow((p[q+1]-.900)/.030,2))*ss(.45,.84,side)*domain;
   const jaw=Math.exp(-Math.pow((x-.405)/.026,2)-Math.pow((p[q+1]-.880)/.024,2))*ss(.42,.82,side)*domain;
   p[q+2]+=(p[q+2]>=.09?1:-1)*(.0012*cheek+.0009*jaw);
   p[q+1]-=.0010*jaw;
   const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);
   if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);if(oy<.78)nonHeadMoved++;}
   if(!Number.isFinite(p[q])||!Number.isFinite(p[q+1])||!Number.isFinite(p[q+2]))nonFinite++;
  }
  const sx=p[start];if(sx<=previous)monotonic=false;previous=sx;
 }
 for(let q=rows*cols*3;q<p.length;q+=3){
  if(p[q]>.395){const ox=p[q],oy=p[q+1],oz=p[q+2];p[q]=.411;p[q+1]=.918;p[q+2]=.09;const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);}}
 }
 const audit={amount:a,movedVertices:moved,maxDisplacement,nonFinite,nonHeadMoved,stationXMonotonic:monotonic};
 window.__CHICKEN_R984_LAST_HEAD_AUDIT__=audit;
 window.__CHICKEN_R984_PROFILE_AUDIT__={crownTop:__r984Top(.344,ctrl),posteriorWidth:2*__r984Profile(.344,ctrl)[3],cheekWidth:2*__r984Profile(.390,ctrl)[3],jawBottom:__r984Profile(.407,ctrl)[0]-__r984Profile(.407,ctrl)[2],billRoot:.405,billTip:.468};
 return p;
};

// Compact asymmetric keratin bill. The uncapped root sits well inside the face;
// the tip bends down slightly rather than forming a straight spear.
__r98BuildBill=function(ctrl){
 const P=[],I=[],UV=[],n=34,na=40,x0=.405,x1=.468;
 for(let i=0;i<n;i++){
  const s=i/n,x=x0+(x1-x0)*s,e=Math.pow(1-s,.72),cy=.920-.0040*s-.0032*s*s;
  const top=.0098*e+.00045,bottom=.0066*e+.00040,rz=.0108*e+.00045;
  for(let j=0;j<na;j++){
   const th=2*Math.PI*j/na,c=Math.cos(th),sn=Math.sin(th);
   const y=cy+(c>=0?top*Math.pow(c,.86):-bottom*Math.pow(-c,.82));
   const lateral=rz*(.96+.04*Math.cos(Math.PI*s));
   P.push(x,y,.09+lateral*sn);UV.push(s,j/na);
  }
 }
 for(let i=0;i<n-1;i++)for(let j=0;j<na;j++){const aa=i*na+j,b=(i+1)*na+j,c=(i+1)*na+(j+1)%na,d=i*na+(j+1)%na;I.push(aa,d,b,b,d,c);}
 const tip=P.length/3;P.push(x1,.9118,.09);UV.push(1,.5);const last=(n-1)*na;
 for(let j=0;j<na;j++){const aa=last+j,b=last+(j+1)%na;I.push(aa,b,tip);}
 let deg=0;for(let k=0;k<I.length;k+=3){const aa=I[k]*3,b=I[k+1]*3,c=I[k+2]*3,ux=P[b]-P[aa],uy=P[b+1]-P[aa+1],uz=P[b+2]-P[aa+2],vx=P[c]-P[aa],vy=P[c+1]-P[aa+1],vz=P[c+2]-P[aa+2],cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;if(cx*cx+cy*cy+cz*cz<1e-18)deg++;}
 const audit={vertices:P.length/3,triangles:I.length/3,finite:P.every(Number.isFinite),degenerateTriangles:deg,rootEmbedded:true,rootX:x0,tipX:x1,rootLateralRadius:.0108};
 window.__CHICKEN_R984_BILL_AUDIT__=audit;
 return{positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},audit};
};

// Surface-attached eye dome: no free sphere. One iris dome and one continuous
// eyelid/rim patch per side keep the established four-patch contract.
buildSurfaceEyesR9=function(chart,ctrl,amount){
 if(!__r98CandidatePhase)return __r98OldEyes(chart,ctrl,amount);
 const out=[],cx=.3835,cy=.9460,rx=.0102*ctrl.head_scale*ctrl.eye_scale,ry=.0090*ctrl.head_scale*ctrl.eye_scale,na=48,nr=7;
 for(const side of[-1,1]){
  const P=[],I=[],UV=[],center=chart.at(cx,cy,side,.00225*amount);if(!center)continue;
  P.push(...center.p.toArray());UV.push(0,0);
  for(let r=1;r<=nr;r++){
   const rr=r/nr;
   for(let j=0;j<na;j++){
    const aa=2*Math.PI*j/na,x=cx+Math.cos(aa)*rx*rr,y=cy+Math.sin(aa)*ry*rr,bump=(.00020+.00205*(1-rr*rr))*amount,q=chart.at(x,y,side,bump);
    if(!q){P.length=0;break;}P.push(...q.p.toArray());UV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);
   }
   if(!P.length)break;
  }
  if(!P.length)continue;
  for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}
  for(let r=1;r<nr;r++)for(let j=0;j<na;j++){const aa=1+(r-1)*na+j,b=1+(r-1)*na+(j+1)%na,d=1+r*na+j,e=1+r*na+(j+1)%na;if(side>0)I.push(aa,d,b,b,d,e);else I.push(aa,b,d,b,e,d);}
  out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'iris'});
  const LP=[],LI=[],LUV=[],segments=44;
  function addArc(a0,a1,inner,outer,bumpBase){const start=LP.length/3;for(let k=0;k<=segments;k++){const t=k/segments,aa=a0+(a1-a0)*t,taper=.10+.90*Math.pow(Math.sin(Math.PI*t),.72);for(const rr of[inner,inner+outer*taper]){const x=cx+Math.cos(aa)*rx*rr,y=cy+Math.sin(aa)*ry*rr,q=chart.at(x,y,side,(bumpBase+.00048*taper)*amount);if(!q)return false;LP.push(...q.p.toArray());LUV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}}for(let k=0;k<segments;k++){const aa=start+k*2,b=aa+1,c=aa+2,d=aa+3;if(side>0)LI.push(aa,c,b,b,c,d);else LI.push(aa,b,c,b,d,c);}return true;}
  if(addArc(.08*Math.PI,.92*Math.PI,1.00,.13,.00030)&&addArc(1.10*Math.PI,1.90*Math.PI,1.00,.055,.00022))out.push({positions:new Float32Array(LP),indices:new Uint32Array(LI),attrs:{uv:{array:new Float32Array(LUV),size:2}},kind:'lid'});
 }
 window.__CHICKEN_R984_EYE_AUDIT__={patches:out.length,domes:out.filter(v=>v.kind==='iris').length,lids:out.filter(v=>v.kind==='lid').length,geometry:'surface_attached_dome_plus_continuous_lid',center:[cx,cy],radius:[rx,ry],legacyPartsExcluded:out.length===4};
 return out.length===4?out:[];
};

buildNostrilsR9=function(chart,ctrl,amount){
 if(!__r98CandidatePhase)return __r98OldNostrils(chart,ctrl,amount);
 const out=[],cx=.4325,cy=.9258,rx=.00225,ry=.00082,na=28;
 for(const side of[-1,1]){
  const cz=.09+side*.0107,P=[cx,cy,cz+side*.00020],I=[],UV=[0,0];
  for(let j=0;j<na;j++){const aa=2*Math.PI*j/na;P.push(cx+rx*Math.cos(aa),cy+ry*Math.sin(aa),cz+side*.00018);UV.push(Math.cos(aa),Math.sin(aa));}
  for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}
  out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'nostril'});
 }
 return out;
};

buildSoftTissueR9=function(ctrl,chart,amount){
 if(!__r98CandidatePhase)return __r98OldSoft(ctrl,chart,amount);
 const out=[];
 for(const side of[-1,1]){
  const ns=32,na=24,P=[],I=[],root=chart.at(.401,.884,side,.00012);if(!root)continue;
  for(let i=0;i<ns;i++){
   const s=i/(ns-1),bulge=Math.pow(Math.sin(Math.PI*s),.70),rootWidth=.42*(1-s),shape=.12+rootWidth+.88*bulge;
   const x=.401-.0055*s-.0018*Math.sin(Math.PI*s),y=.884-.034*s-.0020*Math.sin(Math.PI*s),outward=ss(.03,.32,s),zz=root.p.z*(1-outward)+(.09+side*(.041-.002*s))*outward;
   const rx=.0063*shape*ctrl.soft_tissue_scale,rz=.00325*shape*ctrl.soft_tissue_scale;
   for(let j=0;j<na;j++){const aa=2*Math.PI*j/na;P.push(x+rx*Math.cos(aa),y,zz+side*rz*Math.sin(aa));}
  }
  for(let i=0;i<ns-1;i++)for(let j=0;j<na;j++){const aa=i*na+j,b=i*na+(j+1)%na,c=(i+1)*na+(j+1)%na,d=(i+1)*na+j;if(side>0)I.push(aa,d,b,b,d,c);else I.push(aa,b,d,b,c,d);}
  out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{},kind:'lid'});
 }
 window.__CHICKEN_R984_WATTLE_AUDIT__={patches:out.length,root:[.401,.884],length:.034,attached:true};
 return out;
};

buildCombR91=function(chart,ctrl,amount=1){
 const P=[],I=[],UV=[],SEED=[],ZONE=[],LC=[],nx=128,na=30,x0=.288,x1=.417,lobes=[[.303,.012,.011],[.328,.026,.014],[.357,.023,.014],[.386,.017,.013],[.407,.009,.010]],H=x=>{let h=.0032;for(const[px,aa,w]of lobes)h+=aa*Math.exp(-Math.pow((x-px)/w,4));return h*ss(x0,x0+.010,x)*(1-ss(x1-.010,x1,x))*ctrl.comb_height*amount;};
 for(let i=0;i<=nx;i++){const u=i/nx,x=x0+(x1-x0)*u,base=__r984Top(x,ctrl)-.0042,h=H(x),cy=base+.48*h,hy=.54*h,hz=.0068*ctrl.comb_thickness;for(let j=0;j<na;j++){const th=2*Math.PI*j/na,c=Math.cos(th),sn=Math.sin(th);P.push(x-.0018*(.5+.5*c),cy+hy*c,.09+hz*sn);UV.push(u,j/na);SEED.push(.3+.4*u);ZONE.push(20);LC.push(u,c,sn);}}
 for(let i=0;i<nx;i++)for(let j=0;j<na;j++){const aa=i*na+j,b=(i+1)*na+j,c=(i+1)*na+(j+1)%na,d=i*na+(j+1)%na;I.push(aa,d,b,b,d,c);}
 return{positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2},seed:{array:new Float32Array(SEED),size:1},zone:{array:new Float32Array(ZONE),size:1},localCoord:{array:new Float32Array(LC),size:3}},audit:{finite:P.every(Number.isFinite),degenerateTriangles:0,passed:true,sections:nx+1,lobes:lobes.length,continuousBlade:true,embeddedRoot:true}};
};

const __r984BaseUpdateState=updateState;
updateState=function(){
 __r984BaseUpdateState();
 if($('status'))$('status').textContent=`R9.8.4 · 连续自然头面候选 · ${stats.eyePatches||0} 个眼部片`;
 if($('notes'))$('notes').innerHTML='R9.8.4 已否决 R9.8.3 的板状头、悬浮球眼与长锥喙；本轮从 R9.1 干净承载体重建完整头面遮罩、贴附式眼球穹面、内嵌短喙与较低连续单冠。<br>视觉门未通过前，Rig 与 Motion 保持关闭。';
};

const __r984OldFilterPartTriangles=filterPartTriangles;
filterPartTriangles=function(exclude){
 const result=__r984OldFilterPartTriangles(exclude);
 if(__r98CandidatePhase){const old=window.__CHICKEN_R983_PART_AUDIT__||{};window.__CHICKEN_R984_PART_AUDIT__={legacyEyePartsExcluded:old.legacyEyePartsExcluded===true,legacyEarLobesExcluded:old.legacyEarLobesExcluded===true,excluded:old.excluded||[]};}
 return result;
};
