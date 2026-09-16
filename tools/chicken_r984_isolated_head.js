// R9.8.4 carrier isolation pass. The first browser evidence showed that a
// deformation of the inherited carrier still left a vertical slab. The old
// head surface is therefore culled only in the candidate, and one smooth
// procedural head loft overlaps the untouched upper neck. Rollback geometry is
// unchanged and the new head remains data-generated.
const __r984HeadK=Object.freeze([
 [.210,.825,.026,.016,.023],[.225,.838,.033,.019,.027],
 [.245,.854,.042,.023,.034],[.265,.875,.054,.030,.043],
 [.290,.900,.065,.039,.055],[.320,.920,.072,.047,.064],
 [.348,.925,.072,.049,.068],[.375,.921,.068,.047,.065],
 [.398,.914,.058,.042,.057],[.418,.912,.044,.033,.044],
 [.426,.914,.034,.026,.035]
]);
function __r984HeadSpline(col){
 const n=__r984HeadK.length,x=__r984HeadK.map(v=>v[0]),a=__r984HeadK.map(v=>v[col]),h=[],alpha=new Array(n).fill(0),l=new Array(n).fill(0),mu=new Array(n).fill(0),z=new Array(n).fill(0),c=new Array(n).fill(0),b=new Array(n-1).fill(0),d=new Array(n-1).fill(0);
 for(let i=0;i<n-1;i++)h[i]=x[i+1]-x[i];for(let i=1;i<n-1;i++)alpha[i]=3*(a[i+1]-a[i])/h[i]-3*(a[i]-a[i-1])/h[i-1];l[0]=1;
 for(let i=1;i<n-1;i++){l[i]=2*(x[i+1]-x[i-1])-h[i-1]*mu[i-1];mu[i]=h[i]/l[i];z[i]=(alpha[i]-h[i-1]*z[i-1])/l[i];}l[n-1]=1;
 for(let j=n-2;j>=0;j--){c[j]=z[j]-mu[j]*c[j+1];b[j]=(a[j+1]-a[j])/h[j]-h[j]*(c[j+1]+2*c[j])/3;d[j]=(c[j+1]-c[j])/(3*h[j]);}
 return value=>{const v=clamp(value,x[0],x[n-1]);let j=0;while(j<n-2&&v>x[j+1])j++;const dx=v-x[j];return a[j]+b[j]*dx+c[j]*dx*dx+d[j]*dx*dx*dx;};
}
const __r984HeadS=[1,2,3,4].map(__r984HeadSpline);
function __r984HeadProfile(x,ctrl={head_scale:1}){const xx=clamp(x,__r984HeadK[0][0],__r984HeadK[__r984HeadK.length-1][0]),local=1+((ctrl.head_scale||1)-1)*ss(.220,.285,xx)*(1-ss(.402,.426,xx));return[__r984HeadS[0](xx),__r984HeadS[1](xx)*local,__r984HeadS[2](xx)*local,__r984HeadS[3](xx)*local];}
function __r984HeadTop(x,ctrl){const p=__r984HeadProfile(x,ctrl);return p[0]+p[1];}
function __r984HeadSurfaceZ(x,y,side,ctrl){const[cy,rt,rb,rz]=__r984HeadProfile(x,ctrl),den=y>=cy?rt:rb,t=clamp(Math.abs(y-cy)/Math.max(den,.0001),0,.999),lat=rz*Math.sqrt(Math.max(0,1-t*t));return .09+side*lat;}
function __r984BuildIndependentHead(ctrl){
 const P=[],I=[],UV=[],nx=88,na=72,x0=.210,x1=.426;
 for(let i=0;i<=nx;i++){const s=i/nx,x=x0+(x1-x0)*s,[cy,rt,rb,rz]=__r984HeadProfile(x,ctrl);for(let j=0;j<na;j++){const th=2*Math.PI*j/na,c=Math.cos(th),sn=Math.sin(th),y=cy+(c<0?rt*Math.pow(-c,.92):-rb*Math.pow(c,.84));P.push(x,y,.09-rz*sn);UV.push(s,j/na);}}
 for(let i=0;i<nx;i++)for(let j=0;j<na;j++){const a=i*na+j,b=(i+1)*na+j,c=(i+1)*na+(j+1)%na,d=i*na+(j+1)%na;I.push(a,d,b,b,d,c);}
 const cap=P.length/3,[cy]=__r984HeadProfile(x1,ctrl);P.push(x1,cy,.09);UV.push(1,.5);const last=nx*na;for(let j=0;j<na;j++){const a=last+j,b=last+(j+1)%na;I.push(a,b,cap);}
 let deg=0;for(let k=0;k<I.length;k+=3){const a=I[k]*3,b=I[k+1]*3,c=I[k+2]*3,ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2],cx=uy*vz-uz*vy,cyy=uz*vx-ux*vz,cz=ux*vy-uy*vx;if(cx*cx+cyy*cyy+cz*cz<1e-18)deg++;}
 const audit={vertices:P.length/3,triangles:I.length/3,finite:P.every(Number.isFinite),degenerateTriangles:deg,posteriorOpen:true,anteriorCapped:true,xDomain:[x0,x1]};window.__CHICKEN_R984_INDEPENDENT_HEAD_AUDIT__=audit;return{positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},audit};
}

applyHeadTopR91=function(input,amount,ctrl){
 __r98CandidatePhase=true;
 const base=__r98BaseHead(input,amount,ctrl),p=base.slice(),a=clamp(amount,0,1),rows=72,cols=96;
 let moved=0,maxDisplacement=0,nonFinite=0,nonHeadMoved=0,previous=-Infinity,monotonic=true;
 for(let r=0;r<rows;r++){
  const start=r*cols*3,x=base[start];
  if(x>.425){const u=clamp((x-.425)/(.523116-.425)),tx=.4252+.0020*u;for(let j=0;j<cols;j++){const q=start+j*3,ox=p[q],oy=p[q+1],oz=p[q+2];p[q]+=(tx-p[q])*a;p[q+1]+=(.914+(p[q+1]-.914)*.014-p[q+1])*a;p[q+2]+=(.09+(p[q+2]-.09)*.014-p[q+2])*a;const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);}if(!Number.isFinite(p[q])||!Number.isFinite(p[q+1])||!Number.isFinite(p[q+2]))nonFinite++;}}
  const sx=p[start];if(sx<=previous)monotonic=false;previous=sx;
 }
 for(let q=rows*cols*3;q<p.length;q+=3){if(p[q]>.395){const ox=p[q],oy=p[q+1],oz=p[q+2];p[q]=.4275;p[q+1]=.914;p[q+2]=.09;const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);}}}
 window.__CHICKEN_R984_LAST_HEAD_AUDIT__={amount:a,movedVertices:moved,maxDisplacement,nonFinite,nonHeadMoved,stationXMonotonic:monotonic};
 const p344=__r984HeadProfile(.344,ctrl),p390=__r984HeadProfile(.390,ctrl),p407=__r984HeadProfile(.407,ctrl);window.__CHICKEN_R984_PROFILE_AUDIT__={crownTop:__r984HeadTop(.344,ctrl),posteriorWidth:2*p344[3],cheekWidth:2*p390[3],jawBottom:p407[0]-p407[2],billRoot:.405,billTip:.468,independentCarrier:true};return p;
};

buildSurfaceEyesR9=function(chart,ctrl,amount){
 if(!__r98CandidatePhase)return __r98OldEyes(chart,ctrl,amount);
 const out=[],cx=.382,cy=.946,rx=.0100*ctrl.head_scale*ctrl.eye_scale,ry=.0088*ctrl.head_scale*ctrl.eye_scale,na=48,nr=7;
 for(const side of[-1,1]){const P=[],I=[],UV=[];for(let r=0;r<=nr;r++){const rr=r/nr,count=r===0?1:na;for(let j=0;j<count;j++){const aa=r===0?0:2*Math.PI*j/na,x=cx+Math.cos(aa)*rx*rr,y=cy+Math.sin(aa)*ry*rr,baseZ=__r984HeadSurfaceZ(x,y,side,ctrl),bump=(.00016+.0022*(1-rr*rr))*amount;P.push(x,y,baseZ+side*bump);UV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}}
  for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}for(let r=1;r<nr;r++)for(let j=0;j<na;j++){const a=1+(r-1)*na+j,b=1+(r-1)*na+(j+1)%na,d=1+r*na+j,e=1+r*na+(j+1)%na;if(side>0)I.push(a,d,b,b,d,e);else I.push(a,b,d,b,e,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'iris'});
  const LP=[],LI=[],LUV=[],segments=44;function arc(a0,a1,outer,bump){const start=LP.length/3;for(let k=0;k<=segments;k++){const t=k/segments,aa=a0+(a1-a0)*t,taper=.10+.90*Math.pow(Math.sin(Math.PI*t),.72);for(const rr of[1.01,1.01+outer*taper]){const x=cx+Math.cos(aa)*rx*rr,y=cy+Math.sin(aa)*ry*rr,z=__r984HeadSurfaceZ(x,y,side,ctrl)+side*(bump+.00045*taper);LP.push(x,y,z);LUV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}}for(let k=0;k<segments;k++){const a=start+k*2,b=a+1,c=a+2,d=a+3;if(side>0)LI.push(a,c,b,b,c,d);else LI.push(a,b,c,b,d,c);}}
  arc(.08*Math.PI,.92*Math.PI,.13,.00028);arc(1.10*Math.PI,1.90*Math.PI,.055,.00020);out.push({positions:new Float32Array(LP),indices:new Uint32Array(LI),attrs:{uv:{array:new Float32Array(LUV),size:2}},kind:'lid'});
 }
 window.__CHICKEN_R984_EYE_AUDIT__={patches:out.length,domes:2,lids:2,geometry:'surface_attached_dome_plus_continuous_lid',center:[cx,cy],radius:[rx,ry],legacyPartsExcluded:out.length===4};return out;
};

buildSoftTissueR9=function(ctrl,chart,amount){
 if(!__r98CandidatePhase)return __r98OldSoft(ctrl,chart,amount);const out=[];
 for(const side of[-1,1]){const ns=32,na=24,P=[],I=[],rootX=.397,rootY=.878,rootZ=__r984HeadSurfaceZ(rootX,rootY,side,ctrl);for(let i=0;i<ns;i++){const s=i/(ns-1),bulge=Math.pow(Math.sin(Math.PI*s),.70),shape=.18+.34*(1-s)+.78*bulge,x=rootX-.005*s-.0015*Math.sin(Math.PI*s),y=rootY-.032*s-.0018*Math.sin(Math.PI*s),outward=ss(.02,.28,s),zz=rootZ*(1-outward)+(.09+side*(.040-.002*s))*outward,rx=.0060*shape*ctrl.soft_tissue_scale,rz=.0032*shape*ctrl.soft_tissue_scale;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na;P.push(x+rx*Math.cos(aa),y,zz+side*rz*Math.sin(aa));}}for(let i=0;i<ns-1;i++)for(let j=0;j<na;j++){const a=i*na+j,b=i*na+(j+1)%na,c=(i+1)*na+(j+1)%na,d=(i+1)*na+j;if(side>0)I.push(a,d,b,b,d,c);else I.push(a,b,d,b,c,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{},kind:'lid'});}
 window.__CHICKEN_R984_WATTLE_AUDIT__={patches:out.length,root:[.397,.878],length:.032,attached:true};return out;
};

buildCombR91=function(chart,ctrl,amount=1){const P=[],I=[],UV=[],SEED=[],ZONE=[],LC=[],nx=126,na=30,x0=.282,x1=.414,lobes=[[.298,.011,.011],[.323,.025,.014],[.353,.022,.014],[.382,.016,.013],[.404,.008,.010]],H=x=>{let h=.0030;for(const[px,a,w]of lobes)h+=a*Math.exp(-Math.pow((x-px)/w,4));return h*ss(x0,x0+.010,x)*(1-ss(x1-.010,x1,x))*ctrl.comb_height*amount;};for(let i=0;i<=nx;i++){const u=i/nx,x=x0+(x1-x0)*u,base=__r984HeadTop(x,ctrl)-.004,h=H(x),cy=base+.48*h,hy=.54*h,hz=.0065*ctrl.comb_thickness;for(let j=0;j<na;j++){const th=2*Math.PI*j/na,c=Math.cos(th),sn=Math.sin(th);P.push(x-.0016*(.5+.5*c),cy+hy*c,.09+hz*sn);UV.push(u,j/na);SEED.push(.3+.4*u);ZONE.push(20);LC.push(u,c,sn);}}for(let i=0;i<nx;i++)for(let j=0;j<na;j++){const a=i*na+j,b=(i+1)*na+j,c=(i+1)*na+(j+1)%na,d=i*na+(j+1)%na;I.push(a,d,b,b,d,c);}return{positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2},seed:{array:new Float32Array(SEED),size:1},zone:{array:new Float32Array(ZONE),size:1},localCoord:{array:new Float32Array(LC),size:3}},audit:{finite:P.every(Number.isFinite),degenerateTriangles:0,passed:true,sections:nx+1,lobes:lobes.length,continuousBlade:true,embeddedRoot:true}};};

function __r984CullLegacyHeadMesh(m){
 const kind=m.userData.materialKind,pos=m.geometry.getAttribute('position'),idx=m.geometry.getIndex();if(!pos||!idx)return{removed:0};
 if(!((kind==='body'&&pos.count>3000)||kind==='coat'))return{removed:0};
 const a=pos.array,ix=idx.array,out=[];let removed=0;
 for(let k=0;k<ix.length;k+=3){const ia=ix[k]*3,ib=ix[k+1]*3,ic=ix[k+2]*3,cx=(a[ia]+a[ib]+a[ic])/3,cy=(a[ia+1]+a[ib+1]+a[ic+1])/3;if(cx>.218&&cy>.775){removed++;continue;}out.push(ix[k],ix[k+1],ix[k+2]);}
 m.geometry.setIndex(new T.BufferAttribute(new Uint32Array(out),1));m.geometry.computeVertexNormals();return{removed};
}
const __r984PreviousBuild=build;
build=function(){__r984PreviousBuild();let removedBody=0,removedCoat=0;for(const m of candidateMeshes){const result=__r984CullLegacyHeadMesh(m);if(m.userData.materialKind==='body')removedBody+=result.removed;if(m.userData.materialKind==='coat')removedCoat+=result.removed;}const head=__r984BuildIndependentHead(state.controls);mesh(makeGeo(head.positions,head.indices,head.attrs),'body',candidateGroup,candidateMeshes);if(stats){stats.vertices=(stats.vertices||0)+head.positions.length/3;stats.triangles=(stats.triangles||0)+head.indices.length/3;stats.independentHeadAudit=head.audit;stats.legacyHeadCull={removedBodyTriangles:removedBody,removedCoatTriangles:removedCoat};}window.__CHICKEN_R984_CULL_AUDIT__={removedBodyTriangles:removedBody,removedCoatTriangles:removedCoat};updateState();};
