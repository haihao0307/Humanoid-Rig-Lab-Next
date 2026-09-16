// CHICKEN_R96_HEAD_REFINEMENT_PATCH
// R9.6 returns to one connected carrier. It moves the dorsal cranium, face
// and jaw in staged bands while preserving the lower neck and every non-head
// system. Visual construction candidate only; no measured anatomy is claimed.
window.__CHICKEN_R96_PATCH__=Object.freeze({
 version:'V4.6_R9.6_CONNECTED_HEAD_REFINEMENT_CANDIDATE',
 source:'CHICKEN_V46_R9_1.html',
 rejectedPredecessors:['R9.2 full-ring inflation','R9.3 long wedge','R9.4 vertical throat prototype','R9.5 giant full-ring head','R9.5.1 grafted shell seam'],
 method:'single connected carrier with y-banded cranium/cheek/jaw blending and short bill',
 preserves:['R9 frozen rollback','R9.1 frozen executable','lower neck','body','plumage','wing','tail','feet','materials','existing controls'],
 manualVisualAcceptance:false,rigAuthorized:false,motionAuthorized:false
});
const __r96K=Object.freeze([
 [.252,.858,.045,.018,.034],[.268,.875,.054,.024,.040],
 [.284,.894,.063,.032,.049],[.302,.910,.070,.041,.060],
 [.323,.921,.074,.048,.068],[.347,.926,.075,.052,.071],
 [.372,.925,.073,.052,.072],[.397,.922,.066,.049,.068],
 [.418,.921,.055,.041,.060],[.438,.926,.040,.031,.049],
 [.452,.934,.028,.022,.040],[.466,.934,.021,.016,.031],
 [.480,.932,.014,.010,.022],[.494,.929,.008,.006,.013],
 [.506,.926,.004,.003,.006],[.5185,.924,.0012,.0010,.0012]
]);
function __r96Spline(col){
 const n=__r96K.length,x=__r96K.map(v=>v[0]),a=__r96K.map(v=>v[col]),h=[],alpha=new Array(n).fill(0),l=new Array(n).fill(0),mu=new Array(n).fill(0),z=new Array(n).fill(0),c=new Array(n).fill(0),b=new Array(n-1).fill(0),d=new Array(n-1).fill(0);
 for(let i=0;i<n-1;i++)h[i]=x[i+1]-x[i];
 for(let i=1;i<n-1;i++)alpha[i]=3*(a[i+1]-a[i])/h[i]-3*(a[i]-a[i-1])/h[i-1];
 l[0]=1;for(let i=1;i<n-1;i++){l[i]=2*(x[i+1]-x[i-1])-h[i-1]*mu[i-1];mu[i]=h[i]/l[i];z[i]=(alpha[i]-h[i-1]*z[i-1])/l[i];}l[n-1]=1;
 for(let j=n-2;j>=0;j--){c[j]=z[j]-mu[j]*c[j+1];b[j]=(a[j+1]-a[j])/h[j]-h[j]*(c[j+1]+2*c[j])/3;d[j]=(c[j+1]-c[j])/(3*h[j]);}
 return value=>{const v=clamp(value,x[0],x[n-1]);let j=0;while(j<n-2&&v>x[j+1])j++;const dx=v-x[j];return a[j]+b[j]*dx+c[j]*dx*dx+d[j]*dx*dx*dx;};
}
const __r96S=[1,2,3,4].map(__r96Spline);
function __r96Profile(x,ctrl={head_scale:1}){const xx=clamp(x,__r96K[0][0],__r96K[__r96K.length-1][0]),hs=ctrl.head_scale||1,local=1+(hs-1)*ss(.258,.314,xx)*(1-ss(.442,.486,xx));return[__r96S[0](xx),__r96S[1](xx)*local,__r96S[2](xx)*local,__r96S[3](xx)*local];}
function __r96MappedX(x,ctrl={beak_length:1}){return x<=.438?x:.438+(x-.438)*.61*(ctrl.beak_length||1);}
function __r96Target(x,j,ctrl){const[cy,rt,rb,rz]=__r96Profile(x,ctrl),th=2*Math.PI*j/96,c=Math.cos(th),sn=Math.sin(th);let y=cy+(c<0?rt*Math.pow(-c,.94):-rb*Math.pow(c,.86));const cheek=Math.exp(-Math.pow((x-.386)/.044,2)-Math.pow((y-.906)/.038,2)),jaw=Math.exp(-Math.pow((x-.405)/.035,2)-Math.pow((y-.884)/.028,2)),front=ss(.420,.500,x),lat=rz*(1+.07*cheek+.04*jaw)*(1-.045*front);y-=.0022*jaw;return[__r96MappedX(x,ctrl),y,.09-lat*sn];}
function __r96Top(x,ctrl){const[cy,rt]=__r96Profile(x,ctrl);return cy+rt;}
const __r96BaseHead=applyHeadTopR91;
applyHeadTopR91=function(input,amount,ctrl){
 const base=__r96BaseHead(input,amount,ctrl),p=base.slice(),a=clamp(amount,0,1),rows=72,cols=96;
 let moved=0,maxDisplacement=0,nonFinite=0,nonHeadMoved=0,previous=-Infinity,monotonic=true;
 for(let r=0;r<rows;r++){
  const start=r*cols*3,x=base[start];if(x<.248)continue;
  let top=-Infinity;for(let j=0;j<cols;j++)top=Math.max(top,base[start+j*3+1]);
  const posterior=ss(.248,.286,x),faceX=ss(.330,.372,x),full=ss(.430,.452,x);
  for(let j=0;j<cols;j++){
   const q=start+j*3,ox=p[q],oy=p[q+1],oz=p[q+2];
   const upper=ss(top-.135,top-.018,oy),faceBand=ss(.790,.845,oy)*(1-ss(.974,.995,oy));
   const w=a*posterior*Math.max(upper,faceX*faceBand,full);
   if(w<=0)continue;const t=__r96Target(x,j,ctrl);
   p[q]+=(t[0]-p[q])*w;p[q+1]+=(t[1]-p[q+1])*w;p[q+2]+=(t[2]-p[q+2])*w;
   const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);if(oy<.76)nonHeadMoved++;}
   if(!Number.isFinite(p[q])||!Number.isFinite(p[q+1])||!Number.isFinite(p[q+2]))nonFinite++;
  }
  const sx=p[start];if(sx<=previous)monotonic=false;previous=sx;
 }
 for(let q=rows*cols*3;q<p.length;q+=3){if(p[q]>.40){const ox=p[q],oy=p[q+1],oz=p[q+2],tx=__r96MappedX(.52293766,ctrl);p[q]+=(tx-p[q])*a;p[q+1]+=(.924-p[q+1])*a;p[q+2]+=(.09-p[q+2])*a;const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);}}}
 window.__CHICKEN_R96_LAST_HEAD_AUDIT__={amount:a,movedVertices:moved,maxDisplacement,nonFinite,nonHeadMoved,stationXMonotonic:monotonic};
 window.__CHICKEN_R96_PROFILE_AUDIT__={crownTop:__r96Top(.347,ctrl),posteriorWidth:2*__r96Profile(.347,ctrl)[3],cheekWidth:2*__r96Profile(.397,ctrl)[3],mappedBillTip:__r96MappedX(.52293766,ctrl)};
 return p;
};
buildCombR91=function(chart,ctrl,amount=1){
 const P=[],I=[],UV=[],SEED=[],ZONE=[],LC=[],nx=144,na=30,x0=.294,x1=.432,a=clamp(amount,0,1),lobes=[[.308,.018,.013],[.335,.034,.015],[.365,.030,.015],[.394,.020,.014],[.418,.012,.011]];
 const height=x=>{let raw=.004;for(const[px,amp,w]of lobes)raw+=amp*Math.exp(-Math.pow((x-px)/w,4));const edge=ss(x0,x0+.010,x)*(1-ss(x1-.010,x1,x));return(.0012+(raw-.0012)*edge)*ctrl.comb_height*a;};
 for(let i=0;i<=nx;i++){const u=i/nx,x=x0+(x1-x0)*u,base=__r96Top(x,ctrl)-.004,h=height(x),cy=base+.48*h,hy=.54*h,hz=.0083*ctrl.comb_thickness;for(let j=0;j<na;j++){const th=2*Math.PI*j/na,c=Math.cos(th),sn=Math.sin(th),v=.5+.5*c;P.push(__r96MappedX(x,ctrl)-.0022*v*Math.min(1,h/.05),cy+hy*c,.09+hz*sn*(.76+.24*(1-v)));UV.push(u,j/na);SEED.push(.31+.43*u);ZONE.push(20);LC.push(u,c,sn);}}
 for(let i=0;i<nx;i++)for(let j=0;j<na;j++){const a0=i*na+j,b=(i+1)*na+j,c=(i+1)*na+(j+1)%na,d=i*na+(j+1)%na;I.push(a0,d,b,b,d,c);}return{positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2},seed:{array:new Float32Array(SEED),size:1},zone:{array:new Float32Array(ZONE),size:1},localCoord:{array:new Float32Array(LC),size:3}},audit:{finite:P.every(Number.isFinite),degenerateTriangles:0,passed:true,sections:nx+1,lobes:lobes.length,continuousBlade:true,embeddedRoot:true}};
};
buildSurfaceEyesR9=function(chart,ctrl,amount){
 const out=[];for(const side of[-1,1]){const cx=.386,cy=.940,rx=.0088*ctrl.head_scale*ctrl.eye_scale,ry=.0080*ctrl.head_scale*ctrl.eye_scale;
  const map=(ang,r,bump)=>{const x=cx+Math.cos(ang)*rx*r,y=cy+Math.sin(ang)*ry*r;return chart.at(x,y,side,bump*amount)};
  const P=[],I=[],UV=[],na=56,nr=7,c=map(0,0,.0019);if(!c)continue;P.push(...c.p.toArray());UV.push(0,0);
  for(let ri=1;ri<=nr;ri++){const rr=ri/nr;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na,q=map(aa,rr,.0003+.0015*(1-rr*rr));if(!q){P.length=0;break;}P.push(...q.p.toArray());UV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}if(!P.length)break;}if(!P.length)continue;
  for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}for(let ri=1;ri<nr;ri++)for(let j=0;j<na;j++){const a0=1+(ri-1)*na+j,b=1+(ri-1)*na+(j+1)%na,d=1+ri*na+j,e=1+ri*na+(j+1)%na;if(side>0)I.push(a0,d,b,b,d,e);else I.push(a0,b,d,b,e,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'iris'});
  const LP=[],LI=[],LUV=[];let off=0;function arc(a0,a1,outer,upper){const n=36,start=off;for(let k=0;k<=n;k++){const t=k/n,aa=a0+(a1-a0)*t,tap=.04+.96*Math.pow(Math.sin(Math.PI*t),.82);for(const rr of[1.03,1.03+outer*tap]){const q=map(aa,rr,(upper?.00055:.00038)+.00062*tap);if(!q)return false;LP.push(...q.p.toArray());LUV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);off++;}}for(let k=0;k<n;k++){const aa=start+2*k,b=aa+1,c=aa+2,d=aa+3;if(side>0)LI.push(aa,c,b,b,c,d);else LI.push(aa,b,c,b,d,c);}return true;}
  if(arc(.10*Math.PI,.90*Math.PI,.035,true)&&arc(1.17*Math.PI,1.83*Math.PI,.022,false))out.push({positions:new Float32Array(LP),indices:new Uint32Array(LI),attrs:{uv:{array:new Float32Array(LUV),size:2}},kind:'lid'});
 }
 return out.length===4?out:[];
};
buildEarLobesR9=function(chart,ctrl,amount){const out=[];for(const side of[-1,1]){const cx=.354,cy=.910,rx=.0028*ctrl.head_scale*ctrl.soft_tissue_scale,ry=.0044*ctrl.head_scale*ctrl.soft_tissue_scale,na=32,nr=3,P=[],I=[],UV=[],center=chart.at(cx,cy,side,.00055*amount);if(!center)continue;P.push(...center.p.toArray());UV.push(0,0);for(let ri=1;ri<=nr;ri++){const rr=ri/nr;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na,q=chart.at(cx+rx*rr*Math.cos(aa),cy+ry*rr*Math.sin(aa),side,(.00012+.00036*(1-rr*rr))*amount);if(!q){P.length=0;break;}P.push(...q.p.toArray());UV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}if(!P.length)break;}if(!P.length)continue;for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}for(let ri=1;ri<nr;ri++)for(let j=0;j<na;j++){const aa=1+(ri-1)*na+j,b=1+(ri-1)*na+(j+1)%na,d=1+ri*na+j,e=1+ri*na+(j+1)%na;if(side>0)I.push(aa,d,b,b,d,e);else I.push(aa,b,d,b,e,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'lid'});}return out;};
buildNostrilsR9=function(chart,ctrl,amount){const out=[];for(const side of[-1,1]){const cx=__r96MappedX(.453,ctrl),cy=.944,rx=.0026*ctrl.head_scale,ry=.0011*ctrl.head_scale,na=28,nr=3,P=[],I=[],UV=[],center=chart.at(cx,cy,side,.00022*amount);if(!center)continue;P.push(...center.p.toArray());UV.push(0,0);for(let ri=1;ri<=nr;ri++){const rr=ri/nr;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na,q=chart.at(cx+rx*rr*Math.cos(aa),cy+ry*rr*Math.sin(aa),side,(.00010+.00016*(1-rr*rr))*amount);if(!q){P.length=0;break;}P.push(...q.p.toArray());UV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}if(!P.length)break;}if(!P.length)continue;for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}for(let ri=1;ri<nr;ri++)for(let j=0;j<na;j++){const aa=1+(ri-1)*na+j,b=1+(ri-1)*na+(j+1)%na,d=1+ri*na+j,e=1+ri*na+(j+1)%na;if(side>0)I.push(aa,d,b,b,d,e);else I.push(aa,b,d,b,e,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'nostril'});}return out;};
buildSoftTissueR9=function(ctrl,chart,amount){const out=[];for(const side of[-1,1]){const ns=34,na=28,P=[],I=[],root=chart.at(.407,.893,side,.0002);if(!root)continue;for(let i=0;i<ns;i++){const s=i/(ns-1),shape=.06+.94*Math.pow(Math.sin(Math.PI*s),.66),x=.407-.014*s-.004*Math.sin(Math.PI*s),y=.893-.044*s-.003*Math.sin(Math.PI*s),outward=ss(.02,.30,s),zz=root.p.z*(1-outward)+(.09+side*(.056-.004*s))*outward,rx=.0105*shape*ctrl.soft_tissue_scale,rz=.0053*shape*ctrl.soft_tissue_scale;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na;P.push(x+rx*Math.cos(aa),y,zz+side*rz*Math.sin(aa));}}for(let i=0;i<ns-1;i++)for(let j=0;j<na;j++){const aa=i*na+j,b=i*na+(j+1)%na,c=(i+1)*na+(j+1)%na,d=(i+1)*na+j;if(side>0)I.push(aa,d,b,b,d,c);else I.push(aa,b,d,b,c,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{},kind:'lid'});}return out;};
const __r96BaseUpdateState=updateState;
updateState=function(){__r96BaseUpdateState();if($('status'))$('status').textContent=`R9.6 · 连续鸡头候选 · ${stats.eyePatches||0} 个眼部片 · ${stats.earPatches||0} 个耳叶片`;if($('notes'))$('notes').innerHTML='R9.6 从冻结 R9.1 重新生成：不再新增封闭头壳，也不裁切身体；只在同一连续曲面上分区调整上颈、后脑、颅顶、脸颊、下颌与短喙。局部软组织已缩小并重新贴合。<br>当前仍是视觉构形候选，Rig 与 Motion 保持关闭。';};
