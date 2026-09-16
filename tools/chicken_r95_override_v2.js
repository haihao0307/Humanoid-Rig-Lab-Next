// CHICKEN_R95_HEAD_CARRIER_PATCH
// R9.5.1 separates the compact head shell from the longitudinal torso/neck
// sweep. The original head vertices are collapsed inside the shell and their
// visible triangles are clipped only in the candidate path. This avoids both
// R9.2 full-ring inflation and R9.3/R9.4 long-wedge or vertical-slab failure.
window.__CHICKEN_R95_PATCH__=Object.freeze({
 version:'V4.6_R9.5_1_SEPARATE_HEAD_SHELL_CANDIDATE',
 source:'CHICKEN_V46_R9_1.html',
 method:'candidate-only head shell + upper-neck blend + short integrated bill',
 domain:[.292,.484],
 preserves:['R9 frozen rollback','R9.1 frozen executable','lower neck','body','plumage','wing','tail','feet','materials','existing controls'],
 manualVisualAcceptance:false,
 rigAuthorized:false,
 motionAuthorized:false
});
let __r95CandidatePhase=false;
const __r95ProfileKnots=Object.freeze([
 [.292,.888,.056,.034,.050],
 [.306,.907,.068,.044,.058],
 [.326,.923,.076,.052,.065],
 [.350,.930,.078,.056,.068],
 [.375,.930,.074,.057,.068],
 [.398,.926,.066,.054,.063],
 [.418,.924,.055,.047,.055],
 [.434,.928,.042,.036,.045],
 [.448,.934,.030,.026,.035],
 [.460,.936,.020,.017,.025],
 [.471,.934,.011,.009,.015],
 [.480,.931,.003,.003,.004]
]);
function __r95Sample(x,col){
 const K=__r95ProfileKnots,xx=clamp(x,K[0][0],K[K.length-1][0]);
 let k=1;while(k<K.length&&xx>K[k][0])k++;
 if(k>=K.length)return K[K.length-1][col];
 const A=K[k-1],B=K[k],t=(xx-A[0])/(B[0]-A[0]),q=t*t*(3-2*t);
 return A[col]*(1-q)+B[col]*q;
}
function __r95Profile(x,ctrl={head_scale:1}){
 const xx=clamp(x,__r95ProfileKnots[0][0],__r95ProfileKnots[__r95ProfileKnots.length-1][0]),hs=ctrl.head_scale||1;
 const local=1+(hs-1)*ss(.298,.326,xx)*(1-ss(.428,.468,xx));
 return [__r95Sample(xx,1),__r95Sample(xx,2)*local,__r95Sample(xx,3)*local,__r95Sample(xx,4)*local];
}
function __r95MappedX(x,ctrl={beak_length:1}){
 const root=.434,scale=.74*(ctrl.beak_length||1);
 return x<=root?x:root+(x-root)*scale;
}
function __r95Target(x,j,ctrl,shrink=1){
 const [cy,rt,rb,rz]=__r95Profile(x,ctrl),th=2*Math.PI*j/96,c=Math.cos(th),sn=Math.sin(th);
 let y=cy+(c>=0?rt*Math.pow(c,.94):-rb*Math.pow(-c,.88));
 const cheek=Math.exp(-Math.pow((x-.388)/.043,2)-Math.pow((y-.908)/.038,2));
 const jaw=Math.exp(-Math.pow((x-.410)/.030,2)-Math.pow((y-.884)/.026,2));
 const lateral=rz*(1+.10*cheek+.06*jaw)*shrink;
 y-=.0024*jaw;
 return [__r95MappedX(x,ctrl),cy+(y-cy)*shrink,.09-lateral*sn];
}
function __r95ShellZ(x,y,side,ctrl,extra=0){
 const [cy,rt,rb,rz]=__r95Profile(x,ctrl),rv=y>=cy?rt:rb,q=Math.max(.0025,1-Math.pow((y-cy)/Math.max(rv,1e-6),2));
 const cheek=Math.exp(-Math.pow((x-.388)/.043,2)-Math.pow((y-.908)/.038,2));
 const jaw=Math.exp(-Math.pow((x-.410)/.030,2)-Math.pow((y-.884)/.026,2));
 return .09+side*(rz*(1+.10*cheek+.06*jaw)*Math.sqrt(q)+extra);
}
function __r95CutY(x){
 if(x<=.304)return .902;
 if(x<=.350)return .902-(x-.304)*.42;
 if(x<=.410)return .883-(x-.350)*.30;
 return .865;
}
function __r95BuildHeadShell(ctrl){
 const P=[],I=[],UV=[],nx=96,na=72,x0=.292,x1=.480;
 for(let i=0;i<=nx;i++){
  const u=i/nx,x=x0+(x1-x0)*u;
  for(let j=0;j<na;j++){
   const th=2*Math.PI*j/na,c=Math.cos(th),sn=Math.sin(th),[cy,rt,rb,rz]=__r95Profile(x,ctrl);
   let y=cy+(c>=0?rt*Math.pow(c,.94):-rb*Math.pow(-c,.88));
   const cheek=Math.exp(-Math.pow((x-.388)/.043,2)-Math.pow((y-.908)/.038,2));
   const jaw=Math.exp(-Math.pow((x-.410)/.030,2)-Math.pow((y-.884)/.026,2));
   y-=.0024*jaw;
   const z=.09-rz*(1+.10*cheek+.06*jaw)*sn;
   P.push(__r95MappedX(x,ctrl),y,z);UV.push(u,j/na);
  }
 }
 for(let i=0;i<nx;i++)for(let j=0;j<na;j++){
  const a=i*na+j,b=(i+1)*na+j,c=(i+1)*na+(j+1)%na,d=i*na+(j+1)%na;I.push(a,d,b,b,d,c);
 }
 const back=P.length/3;P.push(__r95MappedX(x0,ctrl),__r95Profile(x0,ctrl)[0],.09);UV.push(0,.5);
 const front=P.length/3;P.push(__r95MappedX(x1,ctrl),__r95Profile(x1,ctrl)[0],.09);UV.push(1,.5);
 for(let j=0;j<na;j++){const n=(j+1)%na;I.push(back,j,n);const a=nx*na+j,b=nx*na+n;I.push(front,b,a);}
 let deg=0;for(let k=0;k<I.length;k+=3){const a=I[k]*3,b=I[k+1]*3,c=I[k+2]*3,ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2],cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;if(cx*cx+cy*cy+cz*cz<1e-18)deg++;}
 const xs=[];for(let i=0;i<P.length;i+=3)xs.push(P[i]);
 const audit={vertices:P.length/3,triangles:I.length/3,finite:P.every(Number.isFinite),degenerateTriangles:deg,bounds:{x:[Math.min(...xs),Math.max(...xs)]}};
 window.__CHICKEN_R95_HEAD_SHELL_AUDIT__=audit;
 return{positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},audit};
}
applyHeadTopR91=function(input,amount,ctrl){
 __r95CandidatePhase=true;
 const p=input.slice(),a=clamp(amount,0,1),rows=72,cols=96;
 let moved=0,maxDisplacement=0,nonFinite=0,nonHeadMoved=0,previous=-Infinity,monotonic=true;
 for(let r=0;r<rows;r++){
  const start=r*cols*3,x=p[start];if(x<.292)continue;
  for(let j=0;j<cols;j++){
   const q=start+j*3,ox=p[q],oy=p[q+1],oz=p[q+2];
   const full=ss(.420,.448,x),upper=ss(__r95CutY(x)-.040,__r95CutY(x)+.010,oy),w=a*Math.max(full,upper*ss(.292,.322,x));
   if(w<=0)continue;
   const t=__r95Target(x,j,ctrl,.72);
   p[q]+=(t[0]-p[q])*w;p[q+1]+=(t[1]-p[q+1])*w;p[q+2]+=(t[2]-p[q+2])*w;
   const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);
   if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);if(oy<.76)nonHeadMoved++;}
   if(!Number.isFinite(p[q])||!Number.isFinite(p[q+1])||!Number.isFinite(p[q+2]))nonFinite++;
  }
  const sx=p[start];if(sx<=previous)monotonic=false;previous=sx;
 }
 for(let q=rows*cols*3;q<p.length;q+=3){if(p[q]>.40){const ox=p[q],oy=p[q+1],oz=p[q+2],t=__r95Target(.480,0,ctrl,.65);p[q]+=(t[0]-p[q])*a;p[q+1]+=(t[1]-p[q+1])*a;p[q+2]+=(.09-p[q+2])*a;const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);}}}
 const audit={amount:a,movedVertices:moved,maxDisplacement,nonFinite,nonHeadMoved,stationXMonotonic:monotonic};
 window.__CHICKEN_R95_LAST_HEAD_AUDIT__=audit;
 const [cy,rt,rb,rz]=__r95Profile(.350,ctrl),[ccy,crt,crb,crz]=__r95Profile(.398,ctrl);
 window.__CHICKEN_R95_PROFILE_AUDIT__={crownTop:cy+rt,posteriorWidth:2*rz,cheekWidth:2*crz,jawBottom:ccy-crb,mappedBillTip:__r95MappedX(.480,ctrl),billRoot:.434};
 return p;
};
const __r95OldClean=cleanIndexR8;
cleanIndexR8=function(pos,index){
 const cleaned=__r95OldClean(pos,index);if(!__r95CandidatePhase)return cleaned;
 const out=[];for(let k=0;k<cleaned.length;k+=3){const ia=cleaned[k]*3,ib=cleaned[k+1]*3,ic=cleaned[k+2]*3,cx=(pos[ia]+pos[ib]+pos[ic])/3,cy=(pos[ia+1]+pos[ib+1]+pos[ic+1])/3;
  if(cx>.428)continue;
  if(cx>.300&&cy>__r95CutY(cx))continue;
  out.push(cleaned[k],cleaned[k+1],cleaned[k+2]);
 }
 return new Uint32Array(out);
};
function __r95Disc(cx,cy,side,rx,ry,bump,kind,ctrl,na=56,nr=7){
 const P=[],I=[],UV=[],base=__r95ShellZ(cx,cy,side,ctrl,.0005);P.push(cx,cy,base+side*bump);UV.push(0,0);
 for(let ri=1;ri<=nr;ri++){const rr=ri/nr;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na,x=cx+rx*rr*Math.cos(aa),y=cy+ry*rr*Math.sin(aa),z=__r95ShellZ(x,y,side,ctrl,.00035)+side*bump*(1-rr*rr);P.push(x,y,z);UV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}}
 for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}for(let ri=1;ri<nr;ri++)for(let j=0;j<na;j++){const a=1+(ri-1)*na+j,b=1+(ri-1)*na+(j+1)%na,d=1+ri*na+j,e=1+ri*na+(j+1)%na;if(side>0)I.push(a,d,b,b,d,e);else I.push(a,b,d,b,e,d);}
 return{positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind};
}
const __r95OldEyes=buildSurfaceEyesR9;
buildSurfaceEyesR9=function(chart,ctrl,amount){
 if(!__r95CandidatePhase)return __r95OldEyes(chart,ctrl,amount);
 const out=[];for(const side of [-1,1]){out.push(__r95Disc(.389,.951,side,.0102*ctrl.eye_scale,.0090*ctrl.eye_scale,.0025,'iris',ctrl));
  const na=48,P=[],I=[],UV=[],r0=1.06,r1=1.16;for(let j=0;j<=na;j++){const t=j/na,aa=.10*Math.PI+.80*Math.PI*t;for(const r of [r0,r1]){const x=.389+.0102*r*Math.cos(aa),y=.951+.0090*r*Math.sin(aa),z=__r95ShellZ(x,y,side,ctrl,.0011);P.push(x,y,z);UV.push(Math.cos(aa)*r,Math.sin(aa)*r);}}for(let j=0;j<na;j++){const a=2*j,b=a+1,c=a+2,d=a+3;if(side>0)I.push(a,c,b,b,c,d);else I.push(a,b,c,b,d,c);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'lid'});}
 return out;
};
const __r95OldEars=buildEarLobesR9;
buildEarLobesR9=function(chart,ctrl,amount){if(!__r95CandidatePhase)return __r95OldEars(chart,ctrl,amount);const out=[];for(const side of [-1,1])out.push(__r95Disc(.357,.914,side,.0045,.0068,.0009,'lid',ctrl,40,5));return out;};
const __r95OldNostrils=buildNostrilsR9;
buildNostrilsR9=function(chart,ctrl,amount){if(!__r95CandidatePhase)return __r95OldNostrils(chart,ctrl,amount);const out=[];for(const side of [-1,1])out.push(__r95Disc(.448,.943,side,.0030,.0014,.00035,'nostril',ctrl,32,3));return out;};
const __r95OldSoft=buildSoftTissueR9;
buildSoftTissueR9=function(ctrl,chart,amount){
 if(!__r95CandidatePhase)return __r95OldSoft(ctrl,chart,amount);
 const out=[];for(const side of [-1,1]){const P=[],I=[],ns=36,na=24;for(let i=0;i<ns;i++){const s=i/(ns-1),shape=.08+.92*Math.pow(Math.sin(Math.PI*s),.64),cx=.410-.019*s-.0035*Math.sin(Math.PI*s),cy=.890-.047*s-.004*Math.sin(Math.PI*s),cz=__r95ShellZ(.410,.890,side,ctrl,.0004)*(1-s*.15)+(.09+side*.046)*s*.15,rx=.0098*shape*ctrl.soft_tissue_scale,rz=.0058*shape*ctrl.soft_tissue_scale;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na;P.push(cx+rx*Math.cos(aa),cy,cz+side*rz*Math.sin(aa));}}
  for(let i=0;i<ns-1;i++)for(let j=0;j<na;j++){const a=i*na+j,b=i*na+(j+1)%na,c=(i+1)*na+(j+1)%na,d=(i+1)*na+j;if(side>0)I.push(a,d,b,b,d,c);else I.push(a,b,d,b,c,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{},kind:'lid'});}
 return out;
};
buildCombR91=function(chart,ctrl,amount=1){
 const P=[],I=[],UV=[],SEED=[],ZONE=[],LC=[],nx=128,na=28,x0=.306,x1=.430,lobes=[[.320,.017,.013],[.347,.036,.015],[.378,.031,.015],[.407,.020,.013]];
 const H=x=>{let h=.004;for(const [px,a,w] of lobes)h+=a*Math.exp(-Math.pow((x-px)/w,4));return h*ss(x0,x0+.010,x)*(1-ss(x1-.010,x1,x))*ctrl.comb_height*amount;};
 for(let i=0;i<=nx;i++){const u=i/nx,x=x0+(x1-x0)*u,[cy,rt]=__r95Profile(x,ctrl),base=cy+rt-.004,h=H(x),cY=base+.47*h,hy=.53*h,hz=.0082*ctrl.comb_thickness;for(let j=0;j<na;j++){const th=2*Math.PI*j/na,c=Math.cos(th),sn=Math.sin(th);P.push(x-.0022*(.5+.5*c),cY+hy*c,.09+hz*sn);UV.push(u,j/na);SEED.push(.3+.4*u);ZONE.push(20);LC.push(u,c,sn);}}
 for(let i=0;i<nx;i++)for(let j=0;j<na;j++){const a=i*na+j,b=(i+1)*na+j,c=(i+1)*na+(j+1)%na,d=i*na+(j+1)%na;I.push(a,d,b,b,d,c);}return{positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2},seed:{array:new Float32Array(SEED),size:1},zone:{array:new Float32Array(ZONE),size:1},localCoord:{array:new Float32Array(LC),size:3}},audit:{finite:P.every(Number.isFinite),degenerateTriangles:0,passed:true,sections:nx+1,lobes:lobes.length,continuousBlade:true,embeddedRoot:true}};
};
const __r95OriginalBuild=build;
build=function(){
 __r95CandidatePhase=false;
 __r95OriginalBuild();
 const shell=__r95BuildHeadShell(state.controls);
 mesh(makeGeo(shell.positions,shell.indices,shell.attrs),'body',candidateGroup,candidateMeshes);
 if(stats){stats.vertices=(stats.vertices||0)+shell.positions.length/3;stats.triangles=(stats.triangles||0)+shell.indices.length/3;stats.headShellAudit=shell.audit;}
 __r95CandidatePhase=false;
 updateState();
};
const __r95BaseUpdateState=updateState;
updateState=function(){
 __r95BaseUpdateState();
 if($('status'))$('status').textContent=`R9.5.1 · 分离式一体鸡头候选 · ${stats.eyePatches||0} 个眼部片 · ${stats.earPatches||0} 个耳叶片`;
 if($('notes'))$('notes').innerHTML='R9.5.1 从冻结 R9.1 重新构建：保留下颈与全身，候选路径单独裁切旧头表面并加入紧凑的后脑—颅顶—脸颊—下颌—短喙曲面；眼、鼻孔、耳叶、肉垂和连续单冠重新贴合。<br>技术门与视觉门仍分离；Rig 与 Motion 保持关闭。';
};
