// CHICKEN_R97_HEAD_BILL_PATCH
// R9.7 keeps the connected dorsal cranium proven by the R9.4 route but removes
// the unstable legacy bill triangles. A compact closed bill is inserted inside
// the face root, eliminating the black front cavity without reopening the body.
window.__CHICKEN_R97_PATCH__=Object.freeze({
 version:'V4.6_R9.7_CONNECTED_HEAD_SHORT_BILL_CANDIDATE',
 source:'CHICKEN_V46_R9_1.html',
 method:'connected dorsal cranium + lateral cheek/jaw support + candidate-only compact closed bill',
 preserves:['R9/R9.1 rollback','lower neck','body','plumage','wing','tail','feet','materials','existing controls'],
 manualVisualAcceptance:false,rigAuthorized:false,motionAuthorized:false
});
let __r97CandidatePhase=false;
const __r97K=Object.freeze([
 [.252,.858,.045,.018,.034],[.268,.875,.054,.024,.040],
 [.284,.894,.063,.032,.049],[.302,.910,.070,.041,.060],
 [.323,.921,.074,.048,.068],[.347,.926,.075,.051,.072],
 [.372,.925,.073,.051,.073],[.397,.922,.066,.047,.069],
 [.418,.920,.055,.039,.061],[.438,.925,.040,.030,.050]
]);
function __r97Spline(col){const n=__r97K.length,x=__r97K.map(v=>v[0]),a=__r97K.map(v=>v[col]),h=[],alpha=new Array(n).fill(0),l=new Array(n).fill(0),mu=new Array(n).fill(0),z=new Array(n).fill(0),c=new Array(n).fill(0),b=new Array(n-1).fill(0),d=new Array(n-1).fill(0);for(let i=0;i<n-1;i++)h[i]=x[i+1]-x[i];for(let i=1;i<n-1;i++)alpha[i]=3*(a[i+1]-a[i])/h[i]-3*(a[i]-a[i-1])/h[i-1];l[0]=1;for(let i=1;i<n-1;i++){l[i]=2*(x[i+1]-x[i-1])-h[i-1]*mu[i-1];mu[i]=h[i]/l[i];z[i]=(alpha[i]-h[i-1]*z[i-1])/l[i];}l[n-1]=1;for(let j=n-2;j>=0;j--){c[j]=z[j]-mu[j]*c[j+1];b[j]=(a[j+1]-a[j])/h[j]-h[j]*(c[j+1]+2*c[j])/3;d[j]=(c[j+1]-c[j])/(3*h[j]);}return value=>{const v=clamp(value,x[0],x[n-1]);let j=0;while(j<n-2&&v>x[j+1])j++;const dx=v-x[j];return a[j]+b[j]*dx+c[j]*dx*dx+d[j]*dx*dx*dx;};}
const __r97S=[1,2,3,4].map(__r97Spline);
function __r97Profile(x,ctrl={head_scale:1}){const xx=clamp(x,__r97K[0][0],__r97K[__r97K.length-1][0]),local=1+((ctrl.head_scale||1)-1)*ss(.258,.314,xx)*(1-ss(.420,.438,xx));return[__r97S[0](xx),__r97S[1](xx)*local,__r97S[2](xx)*local,__r97S[3](xx)*local];}
function __r97Target(x,j,ctrl){const[cy,rt,rb,rz]=__r97Profile(x,ctrl),th=2*Math.PI*j/96,c=Math.cos(th),sn=Math.sin(th);let y=cy+(c<0?rt*Math.pow(-c,.94):-rb*Math.pow(c,.86));const cheek=Math.exp(-Math.pow((x-.386)/.044,2)-Math.pow((y-.906)/.038,2)),lat=rz*(1+.055*cheek);return[x,y,.09-lat*sn];}
function __r97Top(x,ctrl){const[cy,rt]=__r97Profile(x,ctrl);return cy+rt;}
const __r97BaseHead=applyHeadTopR91;
applyHeadTopR91=function(input,amount,ctrl){
 __r97CandidatePhase=true;
 const base=__r97BaseHead(input,amount,ctrl),p=base.slice(),a=clamp(amount,0,1),rows=72,cols=96;
 let moved=0,maxDisplacement=0,nonFinite=0,nonHeadMoved=0,previous=-Infinity,monotonic=true;
 for(let r=0;r<rows;r++){
  const start=r*cols*3,x=base[start];if(x<.248||x>.438)continue;
  let zlo=Infinity,zhi=-Infinity;for(let j=0;j<cols;j++){const z=base[start+j*3+2];zlo=Math.min(zlo,z);zhi=Math.max(zhi,z);}const half=Math.max((zhi-zlo)*.5,.001);
  const posterior=ss(.248,.286,x),faceX=ss(.345,.382,x)*(1-ss(.416,.435,x));
  for(let j=0;j<cols;j++){
   const q=start+j*3,ox=p[q],oy=p[q+1],oz=p[q+2],c=Math.cos(2*Math.PI*j/cols),arc=(1-c)*.5,upper=ss(.040,.34,arc),sideFrac=Math.abs(oz-.09)/half,sideBand=ss(.58,.88,sideFrac),jawY=Math.exp(-Math.pow((oy-.885)/.040,2));
   const w=a*posterior*Math.max(upper,faceX*sideBand*jawY*.68);
   if(w<=0)continue;const t=__r97Target(x,j,ctrl);p[q]+=(t[0]-p[q])*w;p[q+1]+=(t[1]-p[q+1])*w;p[q+2]+=(t[2]-p[q+2])*w;
   const jaw=faceX*sideBand*jawY*a;p[q+1]-=.0035*jaw;p[q+2]+=(oz>=.09?1:-1)*.0024*jaw;
   const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);if(oy<.76)nonHeadMoved++;}if(!Number.isFinite(p[q])||!Number.isFinite(p[q+1])||!Number.isFinite(p[q+2]))nonFinite++;
  }
  const sx=p[start];if(sx<=previous)monotonic=false;previous=sx;
 }
 window.__CHICKEN_R97_LAST_HEAD_AUDIT__={amount:a,movedVertices:moved,maxDisplacement,nonFinite,nonHeadMoved,stationXMonotonic:monotonic};
 window.__CHICKEN_R97_PROFILE_AUDIT__={crownTop:__r97Top(.347,ctrl),posteriorWidth:2*__r97Profile(.347,ctrl)[3],cheekWidth:2*__r97Profile(.397,ctrl)[3],billRoot:.424,billTip:.486};
 return p;
};
const __r97OldClean=cleanIndexR8;
cleanIndexR8=function(pos,index){const cleaned=__r97OldClean(pos,index);if(!__r97CandidatePhase)return cleaned;const out=[];for(let k=0;k<cleaned.length;k+=3){const a=cleaned[k]*3,b=cleaned[k+1]*3,c=cleaned[k+2]*3,cx=(pos[a]+pos[b]+pos[c])/3;if(cx>.432)continue;out.push(cleaned[k],cleaned[k+1],cleaned[k+2]);}return new Uint32Array(out);};
function __r97BuildBill(ctrl){
 const P=[],I=[],UV=[],n=34,na=36,x0=.424,x1=.486;
 for(let i=0;i<n;i++){const s=i/n,x=x0+(x1-x0)*s,e=Math.pow(1-s,.72),cy=.929-.004*s,top=.024*e+.001,bottom=.020*e+.001,rz=.032*e+.001;for(let j=0;j<na;j++){const th=2*Math.PI*j/na,c=Math.cos(th),sn=Math.sin(th),y=cy+(c>=0?top*c:-bottom*(-c));P.push(x,y,.09+rz*sn);UV.push(s,j/na);}}
 const tip=P.length/3;P.push(x1,.925,.09);UV.push(1,.5);
 for(let i=0;i<n-1;i++)for(let j=0;j<na;j++){const a=i*na+j,b=(i+1)*na+j,c=(i+1)*na+(j+1)%na,d=i*na+(j+1)%na;I.push(a,d,b,b,d,c);}const last=(n-1)*na;for(let j=0;j<na;j++){const a=last+j,b=last+(j+1)%na;I.push(a,b,tip);}
 let deg=0;for(let k=0;k<I.length;k+=3){const a=I[k]*3,b=I[k+1]*3,c=I[k+2]*3,ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2],cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;if(cx*cx+cy*cy+cz*cz<1e-18)deg++;}
 const audit={vertices:P.length/3,triangles:I.length/3,finite:P.every(Number.isFinite),degenerateTriangles:deg};window.__CHICKEN_R97_BILL_AUDIT__=audit;return{positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},audit};
}
const __r97OldEyes=buildSurfaceEyesR9;
buildSurfaceEyesR9=function(chart,ctrl,amount){if(!__r97CandidatePhase)return __r97OldEyes(chart,ctrl,amount);const out=[];for(const side of[-1,1]){const cx=.386,cy=.940,rx=.0085*ctrl.eye_scale,ry=.0078*ctrl.eye_scale,map=(aa,r,b)=>chart.at(cx+rx*r*Math.cos(aa),cy+ry*r*Math.sin(aa),side,b*amount),P=[],I=[],UV=[],na=52,nr=7,c=map(0,0,.00175);if(!c)continue;P.push(...c.p.toArray());UV.push(0,0);for(let ri=1;ri<=nr;ri++){const rr=ri/nr;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na,q=map(aa,rr,.00025+.0014*(1-rr*rr));if(!q){P.length=0;break;}P.push(...q.p.toArray());UV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}if(!P.length)break;}if(!P.length)continue;for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}for(let ri=1;ri<nr;ri++)for(let j=0;j<na;j++){const a=1+(ri-1)*na+j,b=1+(ri-1)*na+(j+1)%na,d=1+ri*na+j,e=1+ri*na+(j+1)%na;if(side>0)I.push(a,d,b,b,d,e);else I.push(a,b,d,b,e,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'iris'});}
 return out;
};
const __r97OldEars=buildEarLobesR9;
buildEarLobesR9=function(chart,ctrl,amount){if(!__r97CandidatePhase)return __r97OldEars(chart,ctrl,amount);return[];};
const __r97OldNostrils=buildNostrilsR9;
buildNostrilsR9=function(chart,ctrl,amount){if(!__r97CandidatePhase)return __r97OldNostrils(chart,ctrl,amount);const out=[];for(const side of[-1,1]){const cx=.448,cy=.940,cz=.09+side*.0235,rx=.0027,ry=.00125,na=28,P=[cx,cy,cz+side*.00035],I=[],UV=[0,0];for(let j=0;j<na;j++){const a=2*Math.PI*j/na;P.push(cx+rx*Math.cos(a),cy+ry*Math.sin(a),cz+side*.00025);UV.push(Math.cos(a),Math.sin(a));}for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'nostril'});}return out;};
const __r97OldSoft=buildSoftTissueR9;
buildSoftTissueR9=function(ctrl,chart,amount){if(!__r97CandidatePhase)return __r97OldSoft(ctrl,chart,amount);const out=[];for(const side of[-1,1]){const ns=32,na=26,P=[],I=[],root=chart.at(.405,.892,side,.00015);if(!root)continue;for(let i=0;i<ns;i++){const s=i/(ns-1),shape=.05+.95*Math.pow(Math.sin(Math.PI*s),.66),x=.405-.012*s-.0035*Math.sin(Math.PI*s),y=.892-.040*s-.003*Math.sin(Math.PI*s),outward=ss(.02,.30,s),zz=root.p.z*(1-outward)+(.09+side*(.052-.004*s))*outward,rx=.0092*shape*ctrl.soft_tissue_scale,rz=.0048*shape*ctrl.soft_tissue_scale;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na;P.push(x+rx*Math.cos(aa),y,zz+side*rz*Math.sin(aa));}}for(let i=0;i<ns-1;i++)for(let j=0;j<na;j++){const a=i*na+j,b=i*na+(j+1)%na,c=(i+1)*na+(j+1)%na,d=(i+1)*na+j;if(side>0)I.push(a,d,b,b,d,c);else I.push(a,b,d,b,c,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{},kind:'lid'});}return out;};
buildCombR91=function(chart,ctrl,amount=1){const P=[],I=[],UV=[],SEED=[],ZONE=[],LC=[],nx=132,na=30,x0=.296,x1=.427,lobes=[[.309,.016,.012],[.335,.032,.014],[.365,.028,.014],[.394,.019,.013],[.416,.010,.010]],H=x=>{let h=.0038;for(const[px,a,w]of lobes)h+=a*Math.exp(-Math.pow((x-px)/w,4));return h*ss(x0,x0+.009,x)*(1-ss(x1-.009,x1,x))*ctrl.comb_height*amount;};for(let i=0;i<=nx;i++){const u=i/nx,x=x0+(x1-x0)*u,base=__r97Top(x,ctrl)-.004,h=H(x),cy=base+.48*h,hy=.54*h,hz=.0082*ctrl.comb_thickness;for(let j=0;j<na;j++){const th=2*Math.PI*j/na,c=Math.cos(th),sn=Math.sin(th);P.push(x-.002*(.5+.5*c),cy+hy*c,.09+hz*sn);UV.push(u,j/na);SEED.push(.3+.4*u);ZONE.push(20);LC.push(u,c,sn);}}for(let i=0;i<nx;i++)for(let j=0;j<na;j++){const a=i*na+j,b=(i+1)*na+j,c=(i+1)*na+(j+1)%na,d=i*na+(j+1)%na;I.push(a,d,b,b,d,c);}return{positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2},seed:{array:new Float32Array(SEED),size:1},zone:{array:new Float32Array(ZONE),size:1},localCoord:{array:new Float32Array(LC),size:3}},audit:{finite:P.every(Number.isFinite),degenerateTriangles:0,passed:true,sections:nx+1,lobes:lobes.length,continuousBlade:true,embeddedRoot:true}};};
const __r97OriginalBuild=build;
build=function(){__r97CandidatePhase=false;__r97OriginalBuild();const bill=__r97BuildBill(state.controls);mesh(makeGeo(bill.positions,bill.indices,bill.attrs),'body',candidateGroup,candidateMeshes);if(stats){stats.vertices=(stats.vertices||0)+bill.positions.length/3;stats.triangles=(stats.triangles||0)+bill.indices.length/3;stats.billAudit=bill.audit;}__r97CandidatePhase=false;updateState();};
const __r97BaseUpdateState=updateState;
updateState=function(){__r97BaseUpdateState();if($('status'))$('status').textContent=`R9.7 · 连续头部与闭合短喙候选 · ${stats.eyePatches||0} 个眼部片`;if($('notes'))$('notes').innerHTML='R9.7 保留 R9.4 较稳定的连续后脑与颅顶路线，只增加有界的侧颊/下颌支撑，并在候选路径替换旧喙为闭合短喙，消除正面黑色空腔。眼、鼻孔、肉垂和单冠缩小后重新贴合。<br>视觉门未通过前，Rig 与 Motion 保持关闭。';};
