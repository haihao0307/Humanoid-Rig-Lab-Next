/* R12.1 — actual continuous warp/weft geometry, physically sized in mm.
   Shape is an art-directed carrier, NOT a cloth dynamics solver.
   Far LOD is a prefiltered capture of this same YarnGraph, not an unrelated image. */
(()=>{'use strict';const $=s=>document.getElementById(s),C=KAOPUDenimCore,Natural=KAOPUNaturalYarn,Sampling=KAOPUDenimSampling,canvas=$('view');
const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});if(!gl){$('error').hidden=false;$('error').textContent='需要支持 WebGL2 的浏览器。';return;}
let state={experiment:null,selfCollision:true,friction:.35,pullMm:0,fold:0,tearStrengthN:.006,seamSlackMm:.12,seamStrengthN:1,seamEnabled:true,preset:'rinse',weave:0,gsm:450,autoMass:true,warpStiffness:1,weftStiffness:1,bendStiffness:1,cotton:.78,staple:.72,nap:.70,thickness:.70,slub:.55,wash:.23,abrasion:.24,backstain:.08,fuzz:.55,damage:0,fray:1,panX:0,panY:0,shape:1,light:2,exposure:1,fog:.65,scatter:.85,transmission:.55,structure:1,quality:'fidelity',motionFps:60,motionModel:'xpbd',windSpeed:.7,drive:false,seam:true,animate:false,yaw:-.23,pitch:.34,zoom:1},graph,mainMeshes=[],fuzzMesh,baked=[],pending=false,frame=0,last=0,clock=0,drawCount=0;
const presets={raw:{label:'01 · 原色靛蓝',wash:0,abrasion:.02,backstain:0,slub:.25},rinse:{label:'02 · 轻水洗',wash:.23,abrasion:.24,backstain:.08,slub:.25},vintage:{label:'03 · 复古石洗',wash:.52,abrasion:.65,backstain:.14,slub:.32},bleach:{label:'04 · 浅蓝漂洗',wash:.81,abrasion:.38,backstain:.04,slub:.20},slubby:{label:'05 · 竹节原色',wash:.16,abrasion:.36,backstain:.05,slub:.85},black:{label:'06 · 黑色水洗',wash:.28,abrasion:.45,backstain:.07,slub:.25}};
Object.assign(presets,{
 grey:{label:'07 · 烟灰洗旧',wash:.50,abrasion:.65,backstain:.08,slub:.38},
 ecru:{label:'08 · 本白牛仔',wash:.08,abrasion:.15,backstain:0,slub:.38},
 indigoBlack:{label:'09 · 蓝经黑纬',wash:.20,abrasion:.35,backstain:.06,slub:.40},
 doubleIndigo:{label:'10 · 双靛蓝',wash:.18,abrasion:.25,backstain:0,slub:.35},
 enzyme:{label:'11 · 柔化洗旧',wash:.46,abrasion:.40,backstain:.15,slub:.35},
 acid:{label:'12 · 云斑洗旧',wash:.64,abrasion:.84,backstain:.05,slub:.35}
});
const Budget=KAOPURuntimeBudget,Stitches=KAOPUStitches;let cachedAudit={},seamAudit={},viewKey='',viewCounts=[0,0],rangeData=[],rangeScratch=[],viewBuffers=[],viewBounds=[],geometrySerial=0,statusStamp=0,lastDrawTime=0,stageVisible=true,seamVisible=true,seamBounds=[-50,-25,50,-20,1];
const DistanceLOD=KAOPUDistanceLOD,detail=DistanceLOD.demand(gl,Budget,()=>{viewKey="";request();});let microGain=0,currentFar=0,renderingMip=false,looseLines=null,seamLines=null,detailReleaseTimer=0;const gpuTimer=Budget.timer(gl);const dynamics=KAOPUClothDynamics.create(gl,()=>request());let physicsShape=1,physicsConfigKey='';let frameJob=null,framePhysics=null,insideFrame=false,deferredBuild=false,batchBudget=524288,batchSubmittedAt=0,batchTrianglePeak=0,cancelledFrames=0;const physicsView=()=>framePhysics||dynamics;
const optics=KAOPUFiberOptics.integrate();const common=`
precision highp float;precision highp int;
uniform int uShadowPass;uniform vec4 uSize;uniform vec4 uParam;uniform int uDraftBits;uniform int uRepeat;uniform int uKind;uniform int uShape;uniform float uTime;uniform float uSlub;uniform float uFray;uniform int uDamage;uniform float uLongMorph;uniform float uSideMorph;uniform int uRangeBase;
// MurmurHash3 public-domain fmix tail with project XOR seed; intentionally unchanged.
float hash(float x){uint n=(uint(int(x))^0x9e3779b9u)*0x85ebca6bu;n^=n>>13;n*=0xc2b2ae35u;return float(n^(n>>16))/4294967296.;}float noise1(float x){float a=floor(x),f=fract(x);return mix(hash(a),hash(a+1.),f*f*(3.-2.*f));}
float cell(int x,int y){int xx=uRepeat==4?(x&3):((x%3+3)%3),yy=uRepeat==4?(y&3):((y%3+3)%3);return float((uDraftBits>>(yy*uRepeat+xx))&1);}
float liftAt(float t,int id,int kind){float q=t-.5;int a=int(floor(q));float f=fract(q);float x=kind==0?cell(id,a):1.-cell(a,id);float y=kind==0?cell(id,a+1):1.-cell(a+1,id);return (mix(x,y,f*f*(3.-2.*f))*2.-1.)*uParam.x;}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(dot(i,vec2(41,137))),hash(dot(i+vec2(1,0),vec2(41,137))),f.x),mix(hash(dot(i+vec2(0,1),vec2(41,137))),hash(dot(i+1.,vec2(41,137))),f.x),f.y);}
float relief(vec2 m){return .13*sin(m.x*.293+m.y*.187)*sin(m.y*.117+1.31)+.07*sin(m.x*.131-m.y*.337+.79);}
vec3 carrierRaw(vec2 m){float x=m.x,y=m.y,z=0.;if(uShape==1){float a=(x+9.+.20*y)/11.;float b=(x-24.-.08*y)/18.;z=9.*exp(-a*a)+3.*exp(-b*b)+.014*y;z+=.5*sin(y*.065+x*.032);}
if(uShape==2){float yy=y+uSize.y*.5;if(yy<10.){float t=(10.-yy)/10.*3.02;float r=10./3.02;y=-uSize.y*.5+10.-r*sin(t);z=r*(1.-cos(t));}z+=.8*exp(-pow((x+11.)/22.,2.));}
if(uShape==3){z=3.*sin(x*.073+.20)*(.55+.45*(.5-y/uSize.y));z+=1.1*sin(x*.137+1.1)*(.5-y/uSize.y);}
z+=uTime==0.?0.:sin(y*.065+x*.035+uTime)*.55*(.5-y/uSize.y);return vec3(x,y,z+relief(m));}
mat3 basisRaw(vec2 m){float x=m.x,y=m.y,zx=0.,zy=0.,yy=1.;
if(uShape==1){float a=(x+9.+.20*y)/11.,b=(x-24.-.08*y)/18.;float ea=exp(-a*a),eb=exp(-b*b),c=cos(y*.065+x*.032);zx=-18.*a*ea/11.-6.*b*eb/18.+.016*c;zy=-3.6*a*ea/11.+.48*b*eb/18.+.014+.0325*c;}
if(uShape==2){float ay=y+uSize.y*.5;if(ay<10.){float t=(10.-ay)*.302;yy=cos(t);zy=-sin(t);}float ax=(x+11.)/22.;zx=-1.6*ax*exp(-ax*ax)/22.;}
if(uShape==3){float q=.5-y/uSize.y;zx=.219*cos(x*.073+.20)*(.55+.45*q)+.1507*cos(x*.137+1.1)*q;zy=-(1.35*sin(x*.073+.20)+1.1*sin(x*.137+1.1))/uSize.y;}
if(uTime!=0.){float a=y*.065+x*.035+uTime,q=.5-y/uSize.y;zx+=.01925*cos(a)*q;zy+=.55*(.065*cos(a)*q-sin(a)/uSize.y);}
float a=m.x*.293+m.y*.187,b=m.y*.117+1.31,c=m.x*.131-m.y*.337+.79;zx+=.03809*cos(a)*sin(b)+.00917*cos(c);zy+=.02431*cos(a)*sin(b)+.01521*sin(a)*cos(b)-.02359*cos(c);vec3 dx=vec3(1,0,zx),dy=vec3(0,yy,zy);return mat3(dx,dy,normalize(cross(dx,dy)));}
${KAOPUClothStructure.glsl}
${KAOPUClothDynamics.shader(dynamics.linear)}
// Evaluate shared shape values and slopes once, instead of repeating all trigonometric fields.
void rawFrame(vec2 m,out vec3 pos,out mat3 b){float x=m.x,y=m.y,z=0.,zx=0.,zy=0.,yy=1.;
if(uShape==1){float a=(x+9.+.20*y)/11.,d=(x-24.-.08*y)/18.,ea=exp(-a*a),eb=exp(-d*d),phase=y*.065+x*.032,c=cos(phase);z=9.*ea+3.*eb+.014*y+.5*sin(phase);zx=-18.*a*ea/11.-6.*d*eb/18.+.016*c;zy=-3.6*a*ea/11.+.48*d*eb/18.+.014+.0325*c;}
if(uShape==2){float ay=y+uSize.y*.5;if(ay<10.){float t=(10.-ay)*.302,r=10./3.02;y=-uSize.y*.5+10.-r*sin(t);z=r*(1.-cos(t));yy=cos(t);zy=-sin(t);}float a=(x+11.)/22.,ea=exp(-a*a);z+=.8*ea;zx=-1.6*a*ea/22.;}
if(uShape==3){float q=.5-y/uSize.y,a=x*.073+.20,d=x*.137+1.1;z=3.*sin(a)*(.55+.45*q)+1.1*sin(d)*q;zx=.219*cos(a)*(.55+.45*q)+.1507*cos(d)*q;zy=-(1.35*sin(a)+1.1*sin(d))/uSize.y;}
if(uTime!=0.){float a=m.y*.065+x*.035+uTime,q=.5-m.y/uSize.y;z+=sin(y*.065+x*.035+uTime)*.55*(.5-y/uSize.y);zx+=.01925*cos(a)*q;zy+=.55*(.065*cos(a)*q-sin(a)/uSize.y);}
float a=m.x*.293+m.y*.187,d=m.y*.117+1.31,c=m.x*.131-m.y*.337+.79,sa=sin(a),ca=cos(a),sd=sin(d),cd=cos(d),cc=cos(c);z+=.13*sa*sd+.07*sin(c);zx+=.03809*ca*sd+.00917*cc;zy+=.02431*ca*sd+.01521*sa*cd-.02359*cc;vec3 dx=vec3(1,0,zx),dy=vec3(0,yy,zy);pos=vec3(x,y,z);b=mat3(dx,dy,normalize(cross(dx,dy)));}

// Shared evaluation used by body, fibers, stitches, loose yarn and shadow.
void materialStaticFrame(vec2 m,out vec3 base,out mat3 b){vec2 warped=clothField(m);mat3 raw;rawFrame(warped,base,raw);mat2 j=clothJacobian(m);vec3 x=raw[0]*j[0][0]+raw[1]*j[0][1],y=raw[0]*j[1][0]+raw[1]*j[1][1];b=mat3(x,y,normalize(cross(x,y)));}
void materialFrame(vec2 m,out vec3 base,out mat3 b){materialStaticFrame(m,base,b);dynamicFrame(m,base,b);}
void releasedFrame(vec3 m,vec3 localN,vec3 localT,float binding,float u,out vec3 W,out vec3 N,out vec3 T){mat3 b;vec3 base;
 if(uPhysics==1&&binding>.5){materialStaticFrame(m.xy,base,b);vec4 d=releasedDelta(binding,u);W=base+b[2]*m.z+d.xyz;T=normalize(b*localT);float e=.025;vec3 dd=releasedDelta(binding,min(1.,u+e)).xyz-releasedDelta(binding,max(0.,u-e)).xyz;T=normalize(T+dd/(max(.001,d.w)*(min(1.,u+e)-max(0.,u-e))));N=b*localN;N=normalize(N-T*dot(N,T));}
 else{materialFrame(m.xy,base,b);W=base+b[2]*m.z;N=normalize(b*localN);T=normalize(b*localT);}
}


${KAOPUCottonSurface.shapeGLSL}
`;
const vs=`#version 300 es
${common}
in vec4 aP;in vec4 aRange;uniform mat4 uVP;uniform int uFlat;out vec3 vN;out vec3 vW;out vec3 vT;out vec3 vMacro;out vec2 vM;out vec2 vLocal;out float vCrown;flat out float vId;out vec3 vWarp;flat out int vKind;
vec3 yarnSection(float t,float theta,int id,float scale){
 float pitch=uKind==0?uSize.w:uSize.z;
 float ph=float(id)+float(uKind)*79.;
 float bulge=noise1(t*.10+ph*19.31);
 float irregular=1.+uSlub*(.20*(hash(ph)*2.-1.)+.24*(bulge-.5)+.045*sin(t*.61+ph));
 float ra=(uKind==0?uSize.z*.49:uSize.w*.235)*clamp(irregular,.84,1.09);
 float rz=uParam.y*(uKind==0?1.:.68)*(1.+uSlub*.14*(bulge-.5));
 float gate=sin(3.14159265*(t-.5));float h=liftAt(t,id,uKind)-(uKind==1?uParam.y*.18:0.)+.023*uSlub*gate*gate*sin(t*.48+ph*.67);
 float deriv=(liftAt(t+.008,id,uKind)-liftAt(t-.008,id,uKind))/(.016*pitch);
 vec3 T=normalize(uKind==0?vec3(0,1,deriv):vec3(1,0,deriv));
 vec3 B=uKind==0?vec3(1,0,0):vec3(0,1,0),N=normalize(uKind==0?cross(B,T):cross(T,B));
 vec2 m=uKind==0?vec2((float(id)+.5)*uSize.z-uSize.x*.5,t*uSize.w-uSize.y*.5):vec2(t*uSize.z-uSize.x*.5,(float(id)+.5)*uSize.w-uSize.y*.5);
 float q=theta/0.785398163397,k=floor(q),f=fract(q);
 vec2 circle=vec2(cos(theta),sin(theta));vec2 poly=mix(vec2(cos(k*0.785398163397),sin(k*0.785398163397)),vec2(cos((k+1.)*0.785398163397),sin((k+1.)*0.785398163397)),f);
 vec2 cs=mix(circle,poly,uSideMorph);
 float packing=cottonPacking(theta,t*pitch,ph).x;vec3 delta=(B*ra*cs.x*scale+N*rz*cs.y*scale)*packing;
 // Moving micro-wobble vanishes exactly at every crossing center.
 float wobble=uSlub*gate*(.036*sin(t*.37+ph*.71)+.021*sin(t*.113+ph*1.9));
 m+=B.xy*wobble;
 return vec3(m,h)+delta;
}
void main(){int id=int(aRange.z+.5);if(uR13Mode>0)r13SideHint=(uKind==1?((aRange.x+aRange.y)*.5*uSize.z-uSize.x*.5):((float(id)+.5)*uSize.z-uSize.x*.5))<0.?-1.:1.;float t=clamp(aP.x+floor(aRange.x/16.)*16.,aRange.x,aRange.y);if(abs(aP.w)>.5)t=aP.w<0.?aRange.x:aRange.y;float theta=aP.y;
 float sectionScale=aP.z;int caps=int(aRange.w+.5);if(abs(aP.w)>.5&&(aP.w<0.?((caps&1)==0):((caps&2)==0)))sectionScale=0.;vec3 local=yarnSection(t,theta,id,sectionScale);
 float low=floor(t*2.)*.5;float high=min(low+.5,aRange.y);low=max(low,aRange.x);
 if(uLongMorph>.0001 && fract(t*2.)>.0001 && high>low+.00001)local=mix(local,mix(yarnSection(low,theta,id,aP.z),yarnSection(high,theta,id,aP.z),(t-low)/(high-low)),uLongMorph);
 if(uShadowPass==1){vec3 base;mat3 b;materialFrame(local.xy,base,b);gl_Position=uVP*vec4(base+b[2]*local.z,1.);return;}
 float pitch=uKind==0?uSize.w:uSize.z;float deriv=(liftAt(t+.01,id,uKind)-liftAt(t-.01,id,uKind))/(.02*pitch);vec3 tangent=normalize(uKind==0?vec3(0,1,deriv):vec3(1,0,deriv));
 vec3 B=uKind==0?vec3(1,0,0):vec3(0,1,0),N0=normalize(uKind==0?cross(B,tangent):cross(tangent,B));
 vec3 dt=yarnSection(t,theta+.004,id,1.)-yarnSection(t,theta-.004,id,1.);vec3 normal=normalize(uKind==0?cross(tangent,dt):cross(dt,tangent));if(abs(aP.w)>.5)normal=tangent*aP.w;
 vec2 m=local.xy;mat3 mat;vec3 base;if(uFlat==1){mat=mat3(1);base=vec3(m,0);}else materialFrame(m,base,mat);
 vW=base+mat[2]*local.z;vN=normalize(mat*normal);vT=normalize(mat*tangent);vMacro=normalize(mat[2]);vWarp=normalize(mat[1]);vM=m;vLocal=vec2(t,theta);vId=float(id);vKind=uKind;
 vCrown=clamp((liftAt(t,id,uKind)/uParam.x+1.)*.5,0.,1.);gl_Position=uVP*vec4(vW,1.);}


`;
const fragCommon=`precision highp float;precision highp int;
uniform vec4 uSize;uniform vec4 uParam;uniform float uTime;
// MurmurHash3 public-domain fmix tail with project XOR seed; intentionally unchanged.
float hash(float x){uint n=(uint(int(x))^0x9e3779b9u)*0x85ebca6bu;n^=n>>13;n*=0xc2b2ae35u;return float(n^(n>>16))/4294967296.;}float noise1(float x){float a=floor(x),f=fract(x);return mix(hash(a),hash(a+1.),f*f*(3.-2.*f));}
`;
const shade=`uniform vec3 uCam;uniform float uWash,uAbrasion,uBackstain,uFuzz,uExposure;
uniform int uBlack,uLight,uAA,uBake,uAudit,uDamage,uShadowPass;
uniform float uFilterScale,uNearWeight,uMicroGain;uniform int uCurveClass;
uniform sampler2D uShadowMap;uniform mat4 uLightVP;uniform float uShadowTexel;
uniform vec3 uKeyPos,uKeyColor,uFillColor;
float sat(float x){return clamp(x,0.,1.);}
vec3 tone(vec3 x){return max(x,vec3(0));}
${KAOPUDenimNoise.glsl}
float finishField(vec2 p){return .48*denimNoise2(p*vec2(.036,.027)+11.)+.30*denimNoise2(p*vec2(.097,.073)+31.)+.22*denimNoise2(p*vec2(.22,.15)+81.);}
float visibility(vec3 W,float radius){
 vec4 q=uLightVP*vec4(W,1.);vec3 v=q.xyz/q.w*.5+.5;
 if(v.x<.002||v.x>.998||v.y<.002||v.y>.998||v.z>1.)return 1.;
 float sum=0.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  float d=texture(uShadowMap,v.xy+vec2(x,y)*uShadowTexel*radius).r;
  sum+=smoothstep(v.z-.0012,v.z-.00045,d);
 }return sum/9.;
}
vec3 yarnColor(vec2 m,float kind,float id,float crown){
 vec3 blue=vec3(.022,.040,.068),core=vec3(.100,.100,.092);
 if(uBlack==1)blue=vec3(.010,.011,.013);
 if(uBlack==2)blue=core;
 float n=finishField(m),along=noise1(m.y*.041+id*.173);
 float scuff=uDamage>0?exp(-pow((m.x-4.)/26.,2.)-pow((m.y+1.)/13.,2.))*(.06+.17*n):0.;
 float fade=uWash*(.08+.30*n)+uAbrasion*(.03+.12*n*n)*crown+scuff*crown;
 if(uBlack==5)fade+=uWash*.65*smoothstep(.47,.64,n);
 vec3 warp=mix(blue*(1.+1.5*uWash),core,clamp(fade*.64,0.,.76));
 // Yarn-scale dye and slub fields are correlated along the thread, not per-pixel white noise.
 warp*=.78+.34*along+.24*noise1(id*.321+29.);
 warp*=.90+.22*noise1(m.y*.38+id*7.17);
 if(uBlack==2)warp=core*(.85+.25*n);
 vec3 weft=mix(core,vec3(.072,.103,.14),uBackstain*.9);
 weft*=.82+.22*noise1(m.x*.16+id*3.91);
 if(uBlack==3)weft=vec3(.012,.015,.020)*(1.+uWash*1.7);
 if(uBlack==4)weft=vec3(.012,.025,.055)*(1.+uWash*1.8);
 return mix(warp,weft,kind);
}
${KAOPUCottonSurface.surfaceGLSL}
// Packed reflection, local bundle diffusion and thin-fiber transmission.
// Empirical coefficients below are candidates; this is not calibrated cotton.
uniform float uScatter,uTransmit;uniform vec3 uDiffusionR,uDiffusionCenter;
float visibilityTap(vec3 W){vec4 q=uLightVP*vec4(W,1.);vec3 v=q.xyz/q.w*.5+.5;if(v.x<0.||v.x>1.||v.y<0.||v.y>1.)return 1.;return smoothstep(v.z-.0012,v.z-.00045,texture(uShadowMap,v.xy).r);}
vec3 safeUnit(vec3 v){return v*inversesqrt(max(dot(v,v),1e-10));}
float fiberPhase(float cosine){float g=.32;return (1.-g*g)/(12.5663706*pow(max(.03,1.+g*g-2.*g*cosine),1.5));}
vec3 fiberReflect(vec3 c,vec3 N,vec3 T,vec3 V,vec3 L){
 float nl=sat(dot(N,L)),nv=max(.02,sat(dot(N,V)));vec3 H=safeUnit(V+L);
 float nh=sat(dot(N,H)),sinH=sqrt(max(.0001,1.-nh*nh));
 float transverse=sqrt(max(.0001,1.-pow(dot(T,H),2.)));
 float D=2.0*pow(sinH,1.25)/3.14159265;
 float sheen=D/(4.*max(.05,nl+nv-nl*nv));
 // Broad surface reflection is separate from tinted body scattering.
 vec3 surface=vec3(.045)*(1.-.30*uCotton)*sheen*nl*(.45+.55*transverse)*(.70+.45*uFuzz);
 float ls=nl/(max(.08,nl+nv));
 return c*(.58*nl+.08*ls)+surface;
}
vec3 fiberTransmission(vec3 c,vec3 N,vec3 T,vec3 V,vec3 L,float diameter){
 float axial=sqrt(max(.08,1.-pow(dot(T,L),2.)));
 // A finite optical path: thick yarn cores attenuate much more than fine ends.
 float path=diameter/axial;
 vec3 absorption=-log(clamp(c,vec3(.025),vec3(.95)))*1.25;
 vec3 tr=exp(-(absorption+vec3(5.))*path);
 float back=sat(-dot(N,L)),phase=fiberPhase(dot(-L,V));
 return tr*sqrt(max(c,vec3(.005)))*(.20*back+.48*phase)*uTransmit;
}
vec3 layeredLighting(vec3 c,vec3 N,vec3 T,vec3 W,float fuzz,float diameter){
 vec3 V=safeUnit(uCam-W);N=safeUnit(N);T=safeUnit(T);float vis=visibility(W,1.15);
 vec3 L=safeUnit(uKeyPos-W);
 // Broad cloth lobes integrate the soft key approximately at its centroid.
 vec3 light=(fiberReflect(c,N,T,V,L)+fiberTransmission(c,N,T,V,L,diameter))*uKeyColor*(.64+.36*vis);
 vec3 E=uKeyColor*sat((dot(N,L)+.22)/1.22);
 vec3 F=safeUnit(vec3(110,22,120)-W),R=safeUnit(vec3(40,95,-110)-W);
 light+=(fiberReflect(c,N,T,V,F)+fiberTransmission(c,N,T,V,F,diameter))*uFillColor;
 vec3 rim=uLight==4?vec3(3.2,3.35,3.55):vec3(.50,.55,.65);
 light+=(fiberReflect(c,N,T,V,R)+fiberTransmission(c,N,T,V,R,diameter))*rim;
 // A finite, local quadrature of the dipole profile along the yarn direction.
 // No screen blur: holes, cloth edges and the gray backdrop are never filled.
 float nearVis=vis;
 if(uScatter>.001&&uShadowPass==0)nearVis=.5*(visibilityTap(W+T*.22)+visibilityTap(W-T*.22));
 vec3 spreadVis=uDiffusionCenter*vis+(vec3(1)-uDiffusionCenter)*nearVis;
 vec3 indirect=E*(.65+.35*spreadVis)+uFillColor*.22+rim*sat(-dot(N,R))*.16;
 light+=c*uDiffusionR*indirect*uScatter*.56;
 return light+c*(.12+.035*sat(N.y));
}
vec3 lighting(vec3 c,vec3 N,vec3 T,vec3 W,float fuzz){return layeredLighting(c,N,T,W,fuzz,uParam.y*2.);}

`;
const fs=`#version 300 es
${fragCommon}${shade}
in vec3 vN;in vec3 vW;in vec3 vT;in vec3 vMacro;in vec2 vM;in vec2 vLocal;in float vCrown;flat in float vId;in vec3 vWarp;flat in int vKind;uniform sampler2D uFrontCol;uniform sampler2D uFrontN;uniform sampler2D uBackCol;uniform sampler2D uBackN;out vec4 O;
void main(){if(uShadowPass==1){O=vec4(1);return;}if(uAudit==1){O=vKind==0?vec4(1,0,0,1):vec4(0,1,0,1);return;}
vec3 N=normalize(vN),T=normalize(vT);float variation;float pitch=vKind==0?uSize.w:uSize.z;
N=fiberSurface(N,T,vec2(vLocal.x*pitch,vLocal.y*.18),vId,variation);
float front=dot(N,vMacro),crown=mix(1.-vCrown,vCrown,step(0.,front));
vec3 col=yarnColor(vM,float(vKind),vId,crown)*variation*(.87+.13*abs(front));
// Raised finite staples carry dye variation and broad local fiber occlusion.
float footprint=max(length(dFdx(vM)),length(dFdy(vM)))*uFilterScale;
float resolved=1.-smoothstep(.026,.10,footprint);
float fleck=clamp((variation-1.)*2.7,0.,1.);
vec3 pale=vec3(.115,.110,.100);
col=mix(col,pale,clamp(uAbrasion*.32*fleck*max(.15,crown),0.,.30));
col*=mix(1.,.92+.08*abs(front),uCotton);
if(uBake==1){O=vec4(col,1);return;}if(uBake==2){O=vec4(N*.5+.5,1);return;}
// Prefilter the same graph's colour on the real yarn surface, not a substitute plane.
float averaged=smoothstep(.45,1.4,footprint/uSize.z);vec2 uv=vM/uSize.xy+.5;
vec2 dx=dFdx(uv)*uFilterScale,dy=dFdy(uv)*uFilterScale;
vec4 meanColor=dot(vMacro,uCam-vW)>=0.?textureGrad(uFrontCol,uv,dx,dy):textureGrad(uBackCol,uv,dx,dy);
col=mix(col,meanColor.rgb/max(meanColor.a,.001),averaged*.92);
vec3 diffuseN=normalize(mix(vMacro*sign(dot(vMacro,uCam-vW)),N,.40*(1.-averaged*.8)));
O=vec4(tone(lighting(col,diffuseN,T,vW,uFuzz)),1.);}



`;
const surfVS=`#version 300 es
${common}
in vec2 aM;uniform mat4 uVP;uniform float uBack;out vec3 vW;out vec3 vN;out vec3 vT;out vec2 vUV;out vec2 vM;void main(){mat3 b;vec3 base;materialFrame(aM,base,b);vN=normalize(b[2])*uBack;vT=normalize(b[1]);vW=base+normalize(b[2])*uBack*uParam.z;vM=aM;vUV=aM/uSize.xy+.5;gl_Position=uVP*vec4(vW,1.);}
`;
const surfFS=`#version 300 es
${fragCommon}${shade}
uniform sampler2D uMap;uniform sampler2D uNormalMap;uniform float uBack;in vec3 vW;in vec3 vN;in vec3 vT;in vec2 vUV;in vec2 vM;out vec4 O;
void main(){if(dot(vN,uCam-vW)<=0.)discard;
vec2 dx=dFdx(vUV)*uFilterScale,dy=dFdy(vUV)*uFilterScale;vec4 tex=textureGrad(uMap,vUV,dx,dy);if(tex.a<.0001)discard;
// Alpha-weighted normal moment: a vanishing vector must not be renormalized into a highlight.
vec4 moment=textureGrad(uNormalMap,vUV,dx,dy);
vec3 nTex=(moment.rgb-vec3(.5))*2./max(moment.a,.001);
float coherence=clamp(length(nTex),0.,1.);
vec3 N0=normalize(vN)*uBack;vec3 B=normalize(cross(vT,N0));mat3 b=mat3(B,normalize(vT),N0);
vec3 m=b*nTex;vec3 N=normalize(normalize(vN)+.40*coherence*(m-normalize(vN)*dot(m,normalize(vN))));
vec3 c=tex.rgb/max(tex.a,.001);
O=vec4(tone(lighting(c,N,normalize(vT),vW,uFuzz)),tex.a);}
`;
const seamVS=`#version 300 es
${common}
in vec3 aM,aN,aT,aInfo;uniform mat4 uVP;out vec3 vW,vN,vT,vInfo;out float vThreadVisible;void main(){mat3 b;vec3 base;vThreadVisible=1.;if(uR13Mode==3){float y=(aInfo.z/18.-.5)*uSize.y;vec3 l,r;mat3 bl,br;r13SideHint=-1.;materialFrame(vec2(-1.2,y),l,bl);r13SideHint=1.;materialFrame(vec2(1.2,y),r,br);r13SideHint=0.;vec4 st=texelFetch(uR13,ivec2(int(aInfo.z+.5),57),0);float u=(aM.x+1.2)/2.4;vec3 X=normalize(r-l),Y=normalize(mix(bl[1],br[1],clamp(u,0.,1.))),Z=normalize(cross(X,Y));float sag=sqrt(max(0.,st.z*st.z-dot(r-l,r-l)))*.22*sin(3.14159265*clamp(u,0.,1.));b=mat3(X,Y,Z);vW=mix(l,r,u)+Y*(aM.y-y)+Z*(aM.z+sign(aM.z)*sag);vThreadVisible=st.y;}else{materialFrame(aM.xy,base,b);vW=base+b[2]*aM.z;}vN=normalize(b*aN);vT=normalize(b*aT);vInfo=aInfo;gl_Position=uVP*vec4(vW,1.);}`;
const seamFS=`#version 300 es
${fragCommon}${shade}
in vec3 vW,vN,vT,vInfo;in float vThreadVisible;out vec4 O;void main(){if(vThreadVisible<.5)discard;if(uShadowPass==1){O=vec4(1);return;}vec3 N=normalize(vN);if(!gl_FrontFacing)N=-N;
 float footprint=length(vec2(dFdx(vInfo.x),dFdy(vInfo.x)))*uFilterScale;
 float fine=(1.-smoothstep(.018,.055,footprint))*.07*sin(vInfo.x*140.+vInfo.y*2.1+vInfo.z*.31);
 vec3 c=vec3(.145,.082,.022)*(1.+fine+.09*sin(vInfo.x*4.1+vInfo.z));
 O=vec4(tone(layeredLighting(c,N,normalize(vT),vW,.30,.062)),1.);}`;
const hairVS=`#version 300 es
${common}
uniform highp sampler2D uFiberPoints,uFiberMeta;
vec4 pointRecord(int i){return texelFetch(uFiberPoints,ivec2(i%1024,i/1024),0);}
vec4 curveRecord(int i){return texelFetch(uFiberMeta,ivec2(i%1024,i/1024),0);}uniform mat4 uVP;uniform vec3 uCam;uniform float uMmPerPixel,uFocusDistance;
out vec3 vW,vN,vT;out vec2 vM;out float vSide,vAlpha,vLife;flat out float vFamily,vId,vDiameter,vRole;
void main(){int node=gl_VertexID/2;vec4 p0=pointRecord(node*2),p1=pointRecord(node*2+1),c=curveRecord(int(p0.w));
 vec4 aP=vec4(p0.xyz,(gl_VertexID&1)==0?-1.:1.),aMeta=vec4(c.y,p1.w,c.x,c.z),aTangent=vec4(p1.xyz,c.w);
 float binding=floor(aMeta.w/1024.);releasedFrame(aP.xyz,vec3(0,0,1),aTangent.xyz,binding,clamp(aMeta.y*(aTangent.w>=2.?aTangent.w-2.:1.),0.,1.),vW,vN,vT);vM=aP.xy;vFamily=aMeta.x;vId=mod(aMeta.w,1024.);vDiameter=2.*aMeta.z;vRole=aTangent.w>=2.?0.:aTangent.w;
vec3 right=normalize(cross(normalize(uCam-vW),vT)+vec3(.00001));
vec4 clip=uVP*vec4(vW,1.);float pixel=uMmPerPixel*max(.05,clip.w/uFocusDistance);
float r=aMeta.z,sigma=.55*r,filtered=sqrt(sigma*sigma+.1849*pixel*pixel),w=3.*filtered;
float taper=smoothstep(0.,.09,aMeta.y)*(1.-smoothstep(.74,1.,aMeta.y));
vLife=aMeta.y;vAlpha=sigma/filtered*taper;vSide=aP.w;gl_Position=uVP*vec4(vW+right*aP.w*w,1.);}`;
const hairFS=`#version 300 es
${fragCommon}${shade}
in vec3 vW,vN,vT;in vec2 vM;in float vSide,vAlpha,vLife;flat in float vFamily,vId,vDiameter,vRole;out vec4 O;
void main(){float a=exp(-vSide*vSide*4.5)*vAlpha*(uCurveClass>0?1.:min(1.,uFuzz*1.6))*mix(1.,uNap*1.6,step(.5,vRole));if(vRole>.5)a*=uMicroGain;if(a<.00005)discard;
vec3 c=yarnColor(vM,vFamily,vId,1.);c=mix(c,vec3(.20,.193,.178),.10+(.22*uWash+.36*uAbrasion)*(.5+.5*sin(vLife*3.14159265)));
if(uCurveClass==1)c=mix(yarnColor(vM,vFamily,vId,1.),vec3(.29,.276,.247),vFamily>.5?.50:.23);if(uCurveClass==2)c=vec3(.145,.082,.022);vec3 V=normalize(uCam-vW),L=normalize(uKeyPos-vW);float cyl=sqrt(max(.01,1.-pow(dot(normalize(vT),L),2.)));
vec3 N=normalize(mix(vN,V,.45));vec3 T=normalize(vT),R=safeUnit(vec3(40,95,-110)-vW);float shadow=visibilityTap(vW);
vec3 lit=(fiberReflect(c,N,T,V,L)+fiberTransmission(c,N,T,V,L,vDiameter))*uKeyColor*(.7+.3*shadow);
vec3 rim=uLight==4?vec3(3.2,3.35,3.55):vec3(.50,.55,.65);
lit+=(fiberReflect(c,N,T,V,R)+fiberTransmission(c,N,T,V,R,vDiameter))*rim;
lit+=c*(.32+uScatter*.25);
// Forward scatter and soft fiber coverage, not opaque metallic wire highlights.
// Transmission now comes from finite optical depth, not an added unshadowed wire highlight.
O=vec4(tone(lit),a);}`;
const looseVS=`#version 300 es
${common}
in vec3 aP;in vec3 aNormal;in vec3 aTangent;in vec3 aInfo;in vec2 aBind;uniform mat4 uVP;
out vec3 vW;out vec3 vN;out vec3 vT;out vec3 vInfo;out vec2 vM;out float vDiameter;
void main(){releasedFrame(aP,normalize(aNormal),aTangent,aBind.x,aBind.y,vW,vN,vT);vM=aP.xy;vInfo=aInfo;vDiameter=2.*length(aNormal);gl_Position=uVP*vec4(vW,1.);}`;
const looseFS=`#version 300 es
${fragCommon}${shade}
in vec3 vW;in vec3 vN;in vec3 vT;in vec3 vInfo;in vec2 vM;in float vDiameter;out vec4 O;
void main(){if(uShadowPass==1){O=vec4(1);return;}vec3 N=normalize(vN),T=normalize(vT);if(!gl_FrontFacing)N=-N;
float variation;vec3 B=normalize(cross(T,vec3(.01,.03,1)));float angle=atan(dot(N,cross(B,T)),dot(N,B));
N=fiberSurface(N,T,vec2(vInfo.z,angle*.18),floor(vInfo.y+.5),variation);
vec3 col=yarnColor(vM,floor(vInfo.x+.5),floor(vInfo.y+.5),1.);col=mix(col,vec3(.29,.276,.247),vInfo.x>.5?.50:.23)*variation;
vec3 softN=normalize(mix(normalize(uCam-vW),N,.55));
O=vec4(tone(layeredLighting(col,softN,T,vW,.9,vDiameter)),1.);}`;

const maskFS=`#version 300 es
precision highp float;uniform vec4 uSize;uniform vec3 uCam;uniform sampler2D uMap;uniform float uFilterScale,uNearWeight;in vec3 vN,vW;in vec2 vM,vUV;out vec4 O;
void main(){if(dot(vN,uCam-vW)<=0.)discard;vec2 dx=dFdx(vM)*uFilterScale,dy=dFdy(vM)*uFilterScale;
float fx=length(vec2(dx.x,dy.x))/uSize.z,fy=length(vec2(dx.y,dy.y))/uSize.w;float p=1./max(max(fx,fy),.0001);
if(textureGrad(uMap,vUV,dx/uSize.xy,dy/uSize.xy).a<.001)discard;
O=vec4(0,0,0,max(1.-uNearWeight,1.-smoothstep(2.8,7.,p)));}`;
const macroShadowFS=`#version 300 es
precision highp float;uniform sampler2D uMap;in vec2 vUV;out vec4 O;
void main(){if(textureLod(uMap,vUV,2.).a<.05)discard;O=vec4(1);}`;
function program(v,f){function sh(type,s){let q=gl.createShader(type);gl.shaderSource(q,s);gl.compileShader(q);if(!gl.getShaderParameter(q,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(q));return q;}let p=gl.createProgram();let sv=sh(gl.VERTEX_SHADER,v),sf=sh(gl.FRAGMENT_SHADER,f);gl.attachShader(p,sv);gl.attachShader(p,sf);gl.linkProgram(p);gl.deleteShader(sv);gl.deleteShader(sf);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
let yarnProg,surfProg,seamProg,hairProg,looseProg;try{yarnProg=program(vs,fs);surfProg=program(surfVS,surfFS);seamProg=program(seamVS,seamFS);hairProg=program(hairVS,hairFS);looseProg=program(looseVS,looseFS);}catch(e){$('error').hidden=false;$('error').textContent=e.message;throw e;}
const maskProg=program(surfVS,maskFS),macroShadowProg=program(surfVS,macroShadowFS);let filterScale=1,nearWeight=1,longMorph=0,sideMorph=0,geomLevel=0,bakeDirty=true;const dummyTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,dummyTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,128,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);const loc=new Map();function U(p,k){let key=String(p._id||'')+k;if(!p._loc)p._loc={};return Object.prototype.hasOwnProperty.call(p._loc,k)?p._loc[k]:(p._loc[k]=gl.getUniformLocation(p,k));}function uf(p,k,x){gl.uniform1f(U(p,k),x);}function ui(p,k,x){gl.uniform1i(U(p,k),x);}function v3(p,k,x){gl.uniform3fv(U(p,k),x);}function mat(p,k,x){gl.uniformMatrix4fv(U(p,k),false,x);}
const norm=v=>{let l=Math.hypot(...v);return v.map(x=>x/l);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
function mul(a,b){let r=new Float32Array(16);for(let c=0;c<4;c++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)r[c*4+row]+=a[k*4+row]*b[c*4+k];return r;}
function look(eye,target=[0,0,3]){let z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
function mesh(data,indices,p,attr,size,stride=0){let vao=gl.createVertexArray();gl.bindVertexArray(vao);let vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,(data instanceof Float32Array?data:new Float32Array(data)),gl.STATIC_DRAW);let at=gl.getAttribLocation(p,attr);gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,size,gl.FLOAT,false,stride*4,0);let ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,(indices instanceof Uint32Array?indices:new Uint32Array(indices)),gl.STATIC_DRAW);gl.bindVertexArray(null);return {vao,vb,ib,count:indices.length,bufferBytes:(data.length+indices.length)*4};}
function destroy(m){if(m?.destroy){m.destroy();return;}if(m){if(m.viewVao)gl.deleteVertexArray(m.viewVao);gl.deleteVertexArray(m.vao);gl.deleteBuffer(m.vb);gl.deleteBuffer(m.ib);}}
function tube(length,steps=4,sides=8){let a=[],ix=[],rings=length*steps+1;for(let j=0;j<rings;j++)for(let k=0;k<=sides;k++)a.push(j/steps,k/sides*Math.PI*2,1,0);for(let j=0;j<rings-1;j++)for(let k=0;k<sides;k++){let n=j*(sides+1)+k;ix.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}for(let end=0;end<2;end++){let start=a.length/4;for(let k=0;k<=sides;k++)a.push(end*length,k/sides*2*Math.PI,1,end?1:-1);let mid=a.length/4;a.push(end*length,0,0,end?1:-1);for(let k=0;k<sides;k++)ix.push(mid,start+k,start+k+1);}return mesh(a,ix,yarnProg,'aP',4);}
let naturalData,looseMesh;let carrierMesh,seams,edges,hairs,instances=[],instanceCounts=[0,0],brokenEnds=[],fiberCount=0;
function attachRanges(m,kind){
 function bind(vao,buffer){gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,m.vb);let p=gl.getAttribLocation(yarnProg,'aP');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,4,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ib);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);let at=gl.getAttribLocation(yarnProg,'aRange');gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,4,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(at,1);}
 bind(m.vao,instances[kind]);m.viewVao=gl.createVertexArray();bind(m.viewVao,viewBuffers[kind]);
}
function updateView(vp,pixel){const key=[...vp,state.shape,state.structure,geometrySerial,pixel,!!state.qaNoCull,...(dynamics.active?dynamics.pad.map(v=>Math.ceil(v*2)/2):[0,0,0])].join('|');if(key===viewKey)return;viewKey=key;
 const visible=state.qaNoCull?null:Budget.visibility(vp,{...state,physicsPad:dynamics.active?dynamics.pad:null},graph.p.height,pixel);
 for(let kind=0;kind<2;kind++){let n=0;const src=rangeData[kind],out=rangeScratch[kind],b=viewBounds[kind];for(let i=0;i<src.length/4;i++){const j=i*5;if(visible&&!visible(b[j],b[j+1],b[j+2],b[j+3],b[j+4]))continue;for(let k=0;k<4;k++)out[n++]=src[i*4+k];}viewCounts[kind]=n/4;gl.bindBuffer(gl.ARRAY_BUFFER,viewBuffers[kind]);gl.bufferSubData(gl.ARRAY_BUFFER,0,out.subarray(0,n));}
 hairs.update(visible);detail.store?.update(visible);looseLines?.update(visible);seamLines?.update(visible);seamVisible=!visible||visible(...seamBounds);
}
function createRanges(){instances.forEach(b=>gl.deleteBuffer(b));viewBuffers.forEach(b=>gl.deleteBuffer(b));instances=[];viewBuffers=[];rangeData=[];rangeScratch=[];viewBounds=[];brokenEnds=[];graph.cuts=[];
 naturalData=Natural.generate(C,graph,state.damage,state.fray,{micro:false});if(state.experiment){naturalData.fibers=KAOPUDenimFailure.splitFibers(naturalData.fibers);naturalData.tubes=KAOPUDenimFailure.splitFibers(naturalData.tubes);}
 for(let kind=0;kind<2;kind++){const data=[];for(const [start,end,id] of naturalData.spans[kind])for(let base=Math.floor(start/16)*16;base<end;base+=16){let lo=Math.max(start,base),hi=Math.min(end,base+16);const mid=graph.p.width*.5/graph.p.warpPitch;if(state.experiment&&kind===1&&lo<mid&&hi>mid){data.push(lo,mid,id,(lo===start?1:0)+2,mid,hi,id,1+(hi===end?2:0));}else data.push(lo,hi,id,(lo===start?1:0)+(hi===end?2:0));}
  for(let id=0;id<(kind?graph.ny:graph.nx);id++)graph.cuts.push({family:kind?'weft':'warp',index:id,spans:naturalData.spans[kind].filter(s=>s[2]===id).map(s=>s.slice(0,2))});
  let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,(data instanceof Float32Array?data:new Float32Array(data)),gl.STATIC_DRAW);instances.push(b);instanceCounts[kind]=data.length/4;
 const typed=new Float32Array(data),scratch=new Float32Array(data.length),vb=gl.createBuffer(),bounds=new Float32Array(data.length/4*5);gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,typed.byteLength,gl.DYNAMIC_DRAW);viewBuffers.push(vb);rangeData.push(typed);rangeScratch.push(scratch);
 for(let j=0;j<data.length;j+=4){const lo=data[j],hi=data[j+1],id=data[j+2],p=graph.p,r=kind?p.weftPitch*.28:p.warpPitch*.56,wob=.075;
 const x=kind?lo*p.warpPitch-p.width/2:(id+.5)*p.warpPitch-p.width/2,y=kind?(id+.5)*p.weftPitch-p.height/2:lo*p.weftPitch-p.height/2;
 bounds.set([x-r-wob,y-r-wob,kind?hi*p.warpPitch-p.width/2+r+wob:x+r+wob,kind?y+r+wob:hi*p.weftPitch-p.height/2+r+wob,graph.lift+graph.rz*1.25+.04],j/4*5);}
 viewBounds.push(bounds);
 }
 brokenEnds=naturalData.released.filter(r=>r.type==='tail');
}
function build(){if(frameJob&&!insideFrame){deferredBuild=true;request();return;}detail.reset();destroy(looseLines);destroy(seamLines);mainMeshes.forEach(destroy);mainMeshes=[];destroy(carrierMesh);destroy(seams);destroy(edges);destroy(hairs);destroy(looseMesh);graph=C.compile({weave:state.weave,thickness:state.thickness,slub:state.slub,cotton:state.cotton});createRanges();
 for(const [step,sides] of [[2,8]]){for(let kind=0;kind<2;kind++){let m=tube(16,step,sides);attachRanges(m,kind);mainMeshes.push(m);}}
 let a=[],ix=[],w=graph.p.width,h=graph.p.height,nx=state.experiment?50:100,ny=96;for(let side=0;side<(state.experiment?2:1);side++){const offset=a.length/2;for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){let mx=state.experiment?(side*.5+x/nx*.5-.5)*w:(x/nx-.5)*w;if(state.experiment&&Math.abs(mx)<.00001)mx=side?.00001:-.00001;a.push(mx,(y/ny-.5)*h);}for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){let k=offset+y*(nx+1)+x;ix.push(k,k+1,k+nx+1,k+1,k+nx+2,k+nx+1);}}carrierMesh=mesh(a,ix,surfProg,'aM',2);
const sewn=state.experiment==='seam'?KAOPUDenimFailure.stitches(graph):Stitches.make(C,Natural,graph,state.damage);seamAudit=sewn.audit;seamBounds=sewn.bounds;seams=mesh(sewn.vertices,sewn.indices,seamProg,'aM',3,12);gl.bindVertexArray(seams.vao);gl.bindBuffer(gl.ARRAY_BUFFER,seams.vb);for(const [name,off] of [['aN',3],['aT',6],['aInfo',9]]){let at=gl.getAttribLocation(seamProg,name);if(at>=0){gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,3,gl.FLOAT,false,48,off*4);}}edges=null;
fiberCount=naturalData.fibers.length;hairs=Budget.makeFiberStore(gl,naturalData.fibers);
 seamLines=Budget.makeFiberStore(gl,sewn.guides);looseLines=Budget.makeFiberStore(gl,naturalData.tubes.map(c=>({...c,parentId:c.id,role:"released"})));cachedAudit=Natural.audit(naturalData);naturalData.fibers=null; // Reconstruct on explicit diagnostic request only.
 geometrySerial++;viewKey='';
 const ld=Natural.tubeMesh(naturalData.tubes);looseMesh=mesh(ld.vertices,ld.indices,looseProg,'aP',3,14);
 gl.bindVertexArray(looseMesh.vao);gl.bindBuffer(gl.ARRAY_BUFFER,looseMesh.vb);for(const [name,size,off] of [['aNormal',3,3],['aTangent',3,6],['aInfo',3,9],['aBind',2,12]]){let at=gl.getAttribLocation(looseProg,name);if(at>=0){gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,size,gl.FLOAT,false,56,off*4);}}
 gl.bindVertexArray(null);bakeDirty=true;updateText();request();}
function uniforms(p,vp,cam,flat=0,bakeMode=0){gl.useProgram(p);gl.uniform4fv(U(p,'uSize'),[graph.p.width,graph.p.height,graph.p.warpPitch,graph.p.weftPitch]);gl.uniform4fv(U(p,'uParam'),[graph.lift,graph.rz,state.thickness*.5,0]);ui(p,'uDraftBits',graph.d.cells.reduce((b,v,i)=>b|(v<<i),0));ui(p,'uRepeat',graph.d.width);ui(p,'uShape',state.shape);ui(p,'uFlat',flat);uf(p,'uCotton',state.cotton);uf(p,'uStaple',state.staple);uf(p,'uNap',state.nap);uf(p,'uSlub',state.slub);uf(p,'uFray',flat?0:state.fray);ui(p,'uDamage',state.damage);uf(p,'uLongMorph',flat?0:longMorph);uf(p,'uSideMorph',flat?0:sideMorph);uf(p,'uTime',state.qaClock??(physicsView().active?0:(state.animate?clock:0)));ui(p,'uPhysics',physicsView().active&&physicsView().ready&&!flat&&!bakeMode&&!state.qaAudit?1:0);gl.activeTexture(gl.TEXTURE10);gl.bindTexture(gl.TEXTURE_2D,dynamics.texture);ui(p,'uClothDelta',10);gl.activeTexture(gl.TEXTURE11);gl.bindTexture(gl.TEXTURE_2D,dynamics.curveTexture);ui(p,'uReleasedDelta',11);gl.uniform2f(U(p,'uPhysicsSize'),graph.p.width,graph.p.height);ui(p,'uR13Mode',flat||bakeMode?0:({fold:1,tear:2,seam:3})[state.experiment]||0);gl.activeTexture(gl.TEXTURE12);gl.bindTexture(gl.TEXTURE_2D,dynamics.labTexture);ui(p,'uR13',12);uf(p,'uWash',state.wash);uf(p,'uAbrasion',state.abrasion);uf(p,'uBackstain',state.backstain);uf(p,'uFuzz',state.fuzz);ui(p,'uBlack',({black:1,grey:1,ecru:2,indigoBlack:3,doubleIndigo:4,acid:5})[state.preset]||0);ui(p,'uLight',state.light);ui(p,'uAA',state.qaDisableFilter?0:1);ui(p,'uAudit',state.qaAudit?1:0);ui(p,'uBake',bakeMode);uf(p,'uFilterScale',state.qaDisableFilter?1:filterScale);uf(p,'uNearWeight',nearWeight);uf(p,'uMicroGain',microGain);ui(p,'uCurveClass',0);v3(p,'uCam',cam);mat(p,'uVP',vp);uf(p,'uScatter',state.scatter);uf(p,'uTransmit',state.transmission);uf(p,'uStructure',flat?0:state.structure);v3(p,'uDiffusionR',optics.reflectance);v3(p,'uDiffusionCenter',optics.weights[0]);shadowUniforms(p);}
function drawYarns(p,vp,cam,flat=0,bakeMode=0,high=false){uniforms(p,vp,cam,flat,bakeMode);for(let i=0;i<4;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,bakeMode?dummyTex:(baked[i]||dummyTex));ui(p,['uFrontCol','uFrontN','uBackCol','uBackN'][i],i);}gl.disable(gl.CULL_FACE);for(let kind=0;kind<2;kind++){ui(p,'uKind',kind);let m=mainMeshes[(flat?0:geomLevel*2)+kind],full=flat||shadowDrawing;gl.bindVertexArray(full?m.vao:m.viewVao);gl.drawElementsInstanced(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0,full?instanceCounts[kind]:viewCounts[kind]);drawCount++;}}
function texture(w,h){let t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);let ext=gl.getExtension('EXT_texture_filter_anisotropic');if(ext)gl.texParameterf(gl.TEXTURE_2D,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));return t;}
let gpuFence=null,gpuWaits=0,bakeJob=null,bakeSize=1024;
function gpuAvailable(){if(!gpuFence)return true;const status=gl.clientWaitSync(gpuFence,0,0);
 if(status===gl.TIMEOUT_EXPIRED){gpuWaits++;return false;}
 gl.deleteSync(gpuFence);gpuFence=null;if(status===gl.WAIT_FAILED)throw Error('GPU completion fence failed');return true;}
function submitGpu(){if(gpuFence)gl.deleteSync(gpuFence);gpuFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();}
function bakeStep(){
 const key=[state.weave,state.thickness,state.slub,state.cotton,state.staple,state.damage,state.fray,state.wash,state.abrasion,state.backstain,state.preset].join('|');
 if(bakeJob&&bakeJob.key!==key){bakeJob.maps.forEach(t=>gl.deleteTexture(t));Sampling.destroy(gl,bakeJob.target);bakeJob=null;}
 if(!bakeJob)bakeJob={key,index:0,maps:[],target:Sampling.target(gl,bakeSize,bakeSize,false,null,4)};
 const j=bakeJob,back=j.index<2?1:-1,mode=j.index%2+1,oldFilter=filterScale;filterScale=1;
 gl.bindFramebuffer(gl.FRAMEBUFFER,j.target.draw);gl.viewport(0,0,bakeSize,bakeSize);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);
 if(mode===2)gl.clearColor(.5,.5,.5,0);else gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const w=graph.p.width,h=graph.p.height,view=new Float32Array([1,0,0,0,0,1,0,0,0,0,back,0,0,0,-10,1]);
 const vp=mul(ortho(-w/2,w/2,-h/2,h/2,.1,30),view);drawYarns(yarnProg,vp,[0,0,back*100],1,mode,true);
 Sampling.resolve(gl,j.target);gl.bindFramebuffer(gl.FRAMEBUFFER,j.target.read);gl.activeTexture(gl.TEXTURE4);
 const t=texture(bakeSize,bakeSize);j.maps.push(t);gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,bakeSize,bakeSize);gl.generateMipmap(gl.TEXTURE_2D);
 filterScale=oldFilter;gl.bindFramebuffer(gl.FRAMEBUFFER,null);j.index++;
 $('status').textContent=`同源材质采样 ${j.index}/4 · 保留真实纱线结构`;
 if(j.index===4){baked.forEach(t=>gl.deleteTexture(t));baked=j.maps;Sampling.destroy(gl,j.target);bakeJob=null;bakeDirty=false;}
 submitGpu();request();
}
// A bounded 2x supersample target is used for the final image. It is reallocated
// only on viewport change; not every frame. Texture LOD suppresses subpixel weave.
const hdr=!!gl.getExtension('EXT_color_buffer_float');let screen,screenFbo,screenColor,screenW=0,screenH=0,farTexture=null;
let blit=program(`#version 300 es
precision highp float;out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0,1);}`,Sampling.finalShader);let emptyVAO=gl.createVertexArray();
function target(w,h){if(w===screenW&&h===screenH)return;screenW=w;screenH=h;
 if(farTexture){gl.deleteTexture(farTexture);farTexture=null;}screen=Sampling.target(gl,w,h,hdr,screen,4);screenFbo=screen.draw;screenColor=screen.color;}
function saveFarFrame(){Sampling.resolve(gl,screen);gl.bindFramebuffer(gl.FRAMEBUFFER,screen.read);gl.activeTexture(gl.TEXTURE6);
 if(!farTexture){farTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,farTexture);gl.texImage2D(gl.TEXTURE_2D,0,hdr?gl.RGBA16F:gl.RGBA8,screenW,screenH,0,gl.RGBA,hdr?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
 gl.bindTexture(gl.TEXTURE_2D,farTexture);gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,screenW,screenH);
}
function perspective(fov,aspect,n,f){let q=1/Math.tan(fov/2);return new Float32Array([q/aspect,0,0,0,0,q,0,0,0,0,(f+n)/(n-f),-1,0,0,2*f*n/(n-f),0]);}
function camera(aspect){let span=112/state.zoom;if(aspect<1)span/=aspect;let fov=Math.PI/5,distance=span/(2*Math.tan(fov/2)),target=[state.panX||0,state.panY||0,3],direction=[Math.sin(state.yaw)*Math.cos(state.pitch),Math.sin(state.pitch),Math.cos(state.yaw)*Math.cos(state.pitch)];
 let eye=direction.map((v,i)=>v*distance+target[i]);let projection=state.qaAudit?ortho(-span*aspect/2,span*aspect/2,-span/2,span/2,1,3000):perspective(fov,aspect,.5,3000);
 let vp=mul(projection,look(eye,target));return {vp,eye,span,distance,fov,projection:state.qaAudit?'orthographic-internal-audit':'perspective'};}

// Gray studio: ray-intersected floor and back plane with distance haze.
// The fog is background-only so it cannot hide yarn/edge defects.
const studioVS=`#version 300 es
precision highp float;out vec2 vUv;void main(){vec2 q=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUv=q;gl_Position=vec4(q*2.-1.,.9999,1.);}`;
const studioFS=`#version 300 es
${fragCommon}${shade}
in vec2 vUv;out vec4 O;uniform vec3 uForward,uRight,uUp;uniform float uAspect,uTanHalf,uFog;
void main(){
 vec2 uv=vUv*2.-1.;vec3 rd=normalize(uForward+uRight*uv.x*uAspect*uTanHalf+uUp*uv.y*uTanHalf);
 float t=800.;vec3 N=vec3(0,0,1);bool hit=false;
 if(rd.z<-.0001){float tWall=(-140.-uCam.z)/rd.z;if(tWall>0.){t=tWall;hit=true;}}
 if(rd.y<-.0001){float tFloor=(-56.-uCam.y)/rd.y;if(tFloor>0.&&tFloor<t){t=tFloor;N=vec3(0,1,0);hit=true;}}
 vec3 P=uCam+rd*t;vec3 c=vec3(.21,.217,.224);
 if(hit){float softPool=exp(-dot((P.xy-vec2(-35,20))*vec2(.007,.006),(P.xy-vec2(-35,20))*vec2(.007,.006)));
  c*=.65+.18*max(0.,dot(N,normalize(uKeyPos-P)))+.23*softPool;
  c*=.76+.24*visibility(P,8.);
 }
 float haze=(1.-exp(-max(0.,t-160.)*.008))*uFog;
 c=mix(c,vec3(.30,.315,.332),haze);
 float cloud=denimNoise2(uv*vec2(1.6,1.1)+12.)*.6+denimNoise2(uv*3.+31.)*.4;
 c+=uFog*.018*(cloud-.5);
 c*=1.-.10*dot(uv*.55,uv*.55);
 O=vec4(tone(c),1.);
}`;
const studioProg=program(studioVS,studioFS);
let shadowFbo=null,shadowTex=null,shadowSize=0,shadowKey='',shadowDrawing=false,shadowDrawCalls=0,shadowTriangles=0;
let lightVP=new Float32Array(16),keyPos=[-90,115,125],keyColor=[2.4,2.34,2.22],fillColor=[.55,.64,.79];
function configureLights(){
 keyPos=[-90,115,125];keyColor=[2.4,2.34,2.22];fillColor=[.55,.64,.79];
 if(state.light===1){keyPos=[-135,55,35];keyColor=[3.0,2.64,2.20];fillColor=[.46,.56,.73];}
 if(state.light===2){keyPos=[-85,100,105];keyColor=[2.7,2.23,1.76];fillColor=[.48,.73,1.08];}
 if(state.light===4){keyPos=[-95,95,140];keyColor=[.55,.58,.65];fillColor=[.22,.23,.26];}
 if(state.light===3){keyPos=[-40,120,160];keyColor=[2.45,2.48,2.50];fillColor=[.82,.79,.72];}
 lightVP=mul(ortho(-130,130,-125,125,1,600),look(keyPos,[0,-8,0]));
}
function shadowUniforms(p){
 mat(p,'uLightVP',lightVP);v3(p,'uKeyPos',keyPos);v3(p,'uKeyColor',keyColor);v3(p,'uFillColor',fillColor);
 uf(p,'uExposure',state.exposure);ui(p,'uShadowPass',shadowDrawing?1:0);uf(p,'uShadowTexel',1/Math.max(1,renderingMip?macroShadowSize:shadowSize));
 gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,shadowDrawing?dummyTex:((renderingMip?macroShadowTex:shadowTex)||dummyTex));ui(p,'uShadowMap',7);
}
let macroShadowTex=null,macroShadowFbo=null,macroShadowKey='',macroShadowSize=512;
function makeMacroShadow(){
 if(!macroShadowFbo){macroShadowTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,macroShadowTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,macroShadowSize,macroShadowSize,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);macroShadowFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,macroShadowFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,macroShadowTex,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Coarse shadow incomplete');}
 const key=[geometrySerial,state.shape,state.structure,state.light,state.qaClock,state.animate?clock:0,physicsView().active?physicsView().revision:0].join('|');if(key===macroShadowKey)return;
 shadowDrawing=true;gl.bindFramebuffer(gl.FRAMEBUFFER,macroShadowFbo);gl.viewport(0,0,macroShadowSize,macroShadowSize);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.clear(gl.DEPTH_BUFFER_BIT);
 for(let side=0;side<2;side++){uniforms(macroShadowProg,lightVP,keyPos);uf(macroShadowProg,'uBack',side? -1:1);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,baked[side*2]);ui(macroShadowProg,'uMap',0);gl.bindVertexArray(carrierMesh.vao);gl.drawElements(gl.TRIANGLES,carrierMesh.count,gl.UNSIGNED_INT,0);}
 shadowDrawing=false;macroShadowKey=key;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
}
function detailMeshes(pixels){if((pixels>8||state.qaAudit)&&!mainMeshes[2])for(let kind=0;kind<2;kind++){const m=tube(16,4,16);attachRanges(m,kind);mainMeshes[2+kind]=m;}
 if(!state.qaAudit&&pixels<2.7&&!detail.store&&mainMeshes[2]){destroy(mainMeshes[2]);destroy(mainMeshes[3]);mainMeshes.length=2;}}
function drawFiberStore(store,vp,eye,span,ch,distance,klass=0){if(!store)return;uniforms(hairProg,vp,eye);ui(hairProg,'uCurveClass',klass);uf(hairProg,'uMmPerPixel',span/ch);uf(hairProg,'uFocusDistance',distance);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.activeTexture(gl.TEXTURE8);gl.bindTexture(gl.TEXTURE_2D,store.pointTex);ui(hairProg,'uFiberPoints',8);gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_2D,store.metaTex);ui(hairProg,'uFiberMeta',9);gl.bindVertexArray(store.vao);gl.drawElements(gl.TRIANGLE_STRIP,store.indexCount,gl.UNSIGNED_INT,0);gl.depthMask(true);gl.disable(gl.BLEND);drawCount++;}
function makeShadow(){
 configureLights();const size=innerWidth<750?768:1024;
 if(!shadowFbo||shadowSize!==size){if(shadowFbo)gl.deleteFramebuffer(shadowFbo);if(shadowTex)gl.deleteTexture(shadowTex);shadowKey='';shadowSize=size;shadowFbo=gl.createFramebuffer();shadowTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,shadowTex);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,size,size,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,shadowTex,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
 if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Shadow FBO incomplete');}
 let key=[state.weave,state.thickness,state.slub,state.cotton,state.damage,state.fray,state.shape,state.light,state.seam,state.structure,state.qaClock,physicsView().active?physicsView().revision:0,state.animate?(state.quality==='efficient'?Math.floor(clock*10)/10:clock):0].join('|');
 shadowDrawCalls=0;shadowTriangles=0;
 if(shadowKey===key){gl.bindFramebuffer(gl.FRAMEBUFFER,null);return;}
 shadowDrawing=true;const old=[geomLevel,longMorph,sideMorph,drawCount];geomLevel=0;longMorph=0;sideMorph=0;
 gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFbo);gl.viewport(0,0,shadowSize,shadowSize);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.clear(gl.DEPTH_BUFFER_BIT);
 drawYarns(yarnProg,lightVP,keyPos);
 for(const [prog,m] of [[looseProg,looseMesh],...(state.seam?[[seamProg,seams]]:[])]){uniforms(prog,lightVP,keyPos);gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0);drawCount++;shadowTriangles+=m.count/3;}
 shadowTriangles+=(mainMeshes[0].count*instanceCounts[0]+mainMeshes[1].count*instanceCounts[1])/3;
 shadowDrawCalls=drawCount-old[3];[geomLevel,longMorph,sideMorph,drawCount]=old;shadowDrawing=false;shadowKey=key;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
}
function drawStudio(eye,aspect){
 gl.disable(gl.DEPTH_TEST);gl.depthMask(false);uniforms(studioProg,new Float32Array(16),eye);
 let target=[state.panX||0,state.panY||0,3],forward=norm(target.map((v,i)=>v-eye[i])),right=norm(cross(forward,[0,1,0])),up=cross(right,forward);
 v3(studioProg,'uForward',forward);v3(studioProg,'uRight',right);v3(studioProg,'uUp',up);uf(studioProg,'uAspect',aspect);uf(studioProg,'uTanHalf',Math.tan(36*Math.PI/360));uf(studioProg,'uFog',state.fog);
 gl.bindVertexArray(emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3);drawCount++;gl.depthMask(true);gl.enable(gl.DEPTH_TEST);
}

function physicsParameters(){return state.experiment?{wind:state.windSpeed,gravity:0,damping:5,selfCollision:state.selfCollision,friction:state.friction,pullMm:state.pullMm,fold:state.fold,tearStrengthN:state.tearStrengthN,seamSlackMm:state.seamSlackMm,seamStrengthN:state.seamStrengthN,seamEnabled:state.seamEnabled}:{wind:state.windSpeed,drive:state.drive};}
function configurePhysics(){const key=[state.experiment,state.shape,state.structure,state.weave,state.thickness,state.gsm,state.autoMass,state.warpStiffness,state.weftStiffness,state.bendStiffness,state.damage,state.slub,state.cotton,state.fray].join('|');if(physicsConfigKey===key)return;physicsConfigKey=key;const contract=KAOPUClothTopology.input(Natural,graph,naturalData,state);contract.experiment=state.experiment;if(state.experiment)contract.released=[];dynamics.configure(contract,physicsParameters());}
let lod='';function renderStatic(time=0){pending=false;let start=performance.now();if(document.hidden||!stageVisible||gl.isContextLost())return;if(!state.qaAudit&&!gpuAvailable()){request(8);return;}if(bakeDirty&&!state.qaAudit){bakeStep();return;}if(state.animate){if(last)clock+=Math.min((time-last)/1000,2);last=time;}else last=0;
 let rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5),cw=Math.max(1,Math.round(rect.width*ratio)),ch=Math.max(1,Math.round(rect.height*ratio));if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
 if(dynamics.error){$('error').hidden=false;$('error').textContent='物理工作线程错误：'+dynamics.error;state.animate=false;}configurePhysics();dynamics.upload();gpuTimer.start();
 let ss=state.quality==='efficient'?1:Math.max(1,Math.min(2,Math.sqrt((rect.width<700?1100000:2000000)/(cw*ch))));target(Math.round(cw*ss),Math.round(ch*ss));
 let {vp,eye,span,distance,projection}=camera(cw/ch),pixelsPerYarn=ch/span*graph.p.warpPitch,bodyPixels=ch/span*Math.max(graph.p.width,graph.p.height);
 const demand=DistanceLOD.plan(pixelsPerYarn);let far=state.qaForceYarns||state.qaAudit?0:demand.filtered,useMip=far===1,wantFiltered=!state.qaForceYarns&&!state.qaAudit&&demand.localPass;
 currentFar=far;microGain=detail.update(pixelsPerYarn,{...graph.p,r13Split:!!state.experiment},state.damage,state.fray);detailMeshes(pixelsPerYarn);
 if(detail.stats.error)throw Error('近景资源生成失败：'+detail.stats.error);
 if(pixelsPerYarn<2.7&&!detailReleaseTimer&&(detail.store||detail.stats.pending)){detailReleaseTimer=setTimeout(()=>{detailReleaseTimer=0;request();},950);}
 if(!state.qaAudit){configureLights();if(!useMip)makeShadow();if(wantFiltered)makeMacroShadow();}
filterScale=ss;nearWeight=1-far;
 longMorph=1.-Sampling.smooth(8,12,pixelsPerYarn);sideMorph=1.-Sampling.smooth(8,12,pixelsPerYarn);geomLevel=pixelsPerYarn>8?1:0;
 if(state.qaAudit){longMorph=0;sideMorph=0;geomLevel=1;}
 updateView(vp,span/ch);
 lod=useMip?'中远景 · 同源预过滤 / 物理保持':wantFiltered?'连续像素足迹过渡':detail.stats.pending?'近景细节按需生成中':'近景 · 实体纱线与棉纤维';drawCount=0;
 function scene(mip){renderingMip=mip;gl.bindFramebuffer(gl.FRAMEBUFFER,screenFbo);gl.viewport(0,0,screenW,screenH);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.clearColor(.071,.077,.084,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  if(!state.qaAudit)drawStudio(eye,cw/ch);
  if(mip){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   for(let side=0;side<2;side++){uniforms(surfProg,vp,eye);uf(surfProg,'uBack',side===0?1:-1);
    for(let i=0;i<2;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,baked[side*2+i]);ui(surfProg,i?'uNormalMap':'uMap',i);}
    gl.bindVertexArray(carrierMesh.vao);gl.drawElements(gl.TRIANGLES,carrierMesh.count,gl.UNSIGNED_INT,0);drawCount++;
   }gl.disable(gl.BLEND);
  }else drawYarns(yarnProg,vp,eye);
  if(!mip&&!state.qaAudit&&looseMesh){uniforms(looseProg,vp,eye);gl.bindVertexArray(looseMesh.vao);gl.drawElements(gl.TRIANGLES,looseMesh.count,gl.UNSIGNED_INT,0);drawCount++;}
  if((!mip||state.experiment==='seam')&&state.seam&&(seamVisible||state.experiment==='seam')){uniforms(seamProg,vp,eye);ui(seamProg,'uEdge',0);gl.bindVertexArray(seams.vao);gl.drawElements(gl.TRIANGLES,seams.count,gl.UNSIGNED_INT,0);drawCount++;}
  if(mip){drawFiberStore(looseLines,vp,eye,span,ch,distance,1);if(state.seam&&seamVisible)drawFiberStore(seamLines,vp,eye,span,ch,distance,2);}
  if(state.fuzz>.01){drawFiberStore(hairs,vp,eye,span,ch,distance);if(!mip&&microGain>0)drawFiberStore(detail.store,vp,eye,span,ch,distance);}

 }
 if(wantFiltered&&!useMip){scene(true);
  // The already allocated far image alpha stores a local, derivative-based mix weight.
  gl.colorMask(false,false,false,true);gl.clearColor(0,0,0,far);gl.clear(gl.COLOR_BUFFER_BIT);gl.depthMask(false);gl.disable(gl.BLEND);
  for(let side=0;side<2;side++){uniforms(maskProg,vp,eye);uf(maskProg,'uBack',side? -1:1);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,baked[side*2]);ui(maskProg,'uMap',0);gl.bindVertexArray(carrierMesh.vao);gl.drawElements(gl.TRIANGLES,carrierMesh.count,gl.UNSIGNED_INT,0);}
  gl.colorMask(true,true,true,true);gl.depthMask(true);saveFarFrame();}else if(farTexture){gl.deleteTexture(farTexture);farTexture=null;}
 scene(useMip);Sampling.resolve(gl,screen);
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,cw,ch);gl.disable(gl.DEPTH_TEST);gl.useProgram(blit);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,screenColor);ui(blit,'im',0);gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,farTexture||dummyTex);ui(blit,'farIm',6);uf(blit,'farBlend',farTexture?Math.max(.000001,far):0);gl.uniform2f(U(blit,'outputSize'),cw,ch);uf(blit,'exposure',state.exposure);ui(blit,'audit',state.qaAudit?1:0);gl.bindVertexArray(emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3);drawCount++;frame++;
 if(performance.now()-statusStamp>250||!state.animate){statusStamp=performance.now();$('status').textContent=`${graph.curves.length} 根纱线 · ${state.thickness.toFixed(2)} mm · ${lod}`;updateBudgetPanel();}
 window.__DENIM_WORKBENCH__.lastFrame={frame,drawCalls:drawCount,lod,pixelsPerYarn,nearWeight,farWeight:far,bodyPixels,bakeSize,sparseEdgeFibers:fiberCount,projection,distanceMm:distance,studio:{background:'gray-studio-planes',fog:state.fog,exposure:state.exposure,shadowSize,shadowDrawCalls,shadowTriangles,backgroundOnlyFog:true},colorPipeline:hdr?'linear-RGBA16F-single-tonemap':'linear-RGBA8-single-tonemap',sampling:{msaaSamples:screen.samples,supersampleRatio:ss,outputIntegration:'4x4 linear pixel footprint',temporalHistory:false,gpuQueueLimit:1,gpuWaitPolls:gpuWaits,attributeCapturePassesPerBatch:1,attachmentBytes:screen.attachmentBytes+(farTexture?screenW*screenH*(hdr?8:4):0),note:'attachments only; excludes geometry, mipmaps, driver and browser memory'},scatter:{strength:state.scatter,transmission:state.transmission,kernel:optics.reflectance},distanceLOD:{...demand,microGain,detail:detail.report(),dynamicShadow:true,localFootprintMask:wantFiltered&&!useMip},geometryBufferBytes:[...mainMeshes,carrierMesh,seams,looseMesh,hairs,looseLines,seamLines,detail.store].reduce((a,m)=>a+(m?.bufferBytes||0),0)+instanceCounts.reduce((a,n)=>a+n*32,0)+hairs.textureBytes+(detail.store?.textureBytes||0)+(looseLines?.textureBytes||0)+(seamLines?.textureBytes||0),closeSurface:{cotton:state.cotton,staple:state.staple,nap:state.nap,angularLanes:64,finiteStaples:true},structureWarp:state.structure,solidEdgeDrawn:false,geometryOnly:far===0&&!wantFiltered,longMorph,sideMorph,geomLevel,natural:cachedAudit,looseTriangles:looseMesh.count/3,brokenEnds:brokenEnds.length,instanceCounts:[...instanceCounts],visibleInstanceCounts:[...viewCounts],visibleFiberCurves:hairs.visibleCurves+(microGain>0?(detail.store?.visibleCurves||0):0),sewing:seamAudit,physics:{active:dynamics.active,...dynamics.report,damageProxy:state.damage>=2?'hole-aware sheet plus two-way released-yarn chains':'intact directional cloth'},performance:performanceReport(),renderTarget:[screenW,screenH],cpuSubmitMs:performance.now()-start,triangles:(useMip?(carrierMesh.count*2)/3:(mainMeshes[geomLevel*2].count*viewCounts[0]+mainMeshes[geomLevel*2+1].count*viewCounts[1])/3)+(!state.qaAudit&&looseMesh?(useMip?looseLines.visibleTriangles:looseMesh.count/3):0)+(state.seam&&seamVisible?(useMip?seamLines.visibleTriangles:seams.count/3):0)+(state.fuzz>.01?hairs.visibleTriangles+(!useMip&&microGain>0?(detail.store?.visibleTriangles||0):0):0),transitionDoublePass:wantFiltered&&!useMip};gpuTimer.end();submitGpu();if(detail.fading)request();lastDrawTime=performance.now();if(dynamics.active&&state.animate)dynamics.sample();if(state.animate)request(Math.max(0,1000/state.motionFps-(lastDrawTime-start)));
}

const yarnRangeAttribute=gl.getAttribLocation(yarnProg,'aRange');
function* yarnBatches(p,vp,cam){
 for(let kind=0;kind<2;kind++){const m=mainMeshes[geomLevel*2+kind],full=shadowDrawing,count=full?instanceCounts[kind]:viewCounts[kind],buffer=full?instances[kind]:viewBuffers[kind],vao=full?m.vao:m.viewVao;
  for(let first=0;first<count;first+=96){const n=Math.min(96,count-first);uniforms(p,vp,cam);for(let i=0;i<4;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,baked[i]||dummyTex);ui(p,['uFrontCol','uFrontN','uBackCol','uBackN'][i],i);}gl.disable(gl.CULL_FACE);ui(p,'uKind',kind);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);const at=yarnRangeAttribute;gl.vertexAttribPointer(at,4,gl.FLOAT,false,0,first*16);gl.drawElementsInstanced(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0,n);gl.vertexAttribPointer(at,4,gl.FLOAT,false,0,0);drawCount++;yield m.count*n/3;}
 }
}
function* triangleBatches(p,m,vp,eye){for(let offset=0;offset<m.count;offset+=196608){const count=Math.min(196608,m.count-offset);uniforms(p,vp,eye);gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,count,gl.UNSIGNED_INT,offset*4);drawCount++;yield count/3;}}
function* fiberBatches(store,vp,eye,span,ch,distance,klass=0){if(!store)return;const ranges=store.drawRanges||[{start:0,count:store.indexCount,triangles:store.visibleTriangles}];for(const range of ranges){uniforms(hairProg,vp,eye);ui(hairProg,'uCurveClass',klass);uf(hairProg,'uMmPerPixel',span/ch);uf(hairProg,'uFocusDistance',distance);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.activeTexture(gl.TEXTURE8);gl.bindTexture(gl.TEXTURE_2D,store.pointTex);ui(hairProg,'uFiberPoints',8);gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_2D,store.metaTex);ui(hairProg,'uFiberMeta',9);gl.bindVertexArray(store.vao);gl.drawElements(gl.TRIANGLE_STRIP,range.count,gl.UNSIGNED_INT,range.start*4);drawCount++;gl.depthMask(true);gl.disable(gl.BLEND);yield range.triangles;}}

function* makeShadowBatches(){
 configureLights();const size=innerWidth<750?768:1024;
 if(!shadowFbo||shadowSize!==size){if(shadowFbo)gl.deleteFramebuffer(shadowFbo);if(shadowTex)gl.deleteTexture(shadowTex);shadowKey='';shadowSize=size;shadowFbo=gl.createFramebuffer();shadowTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,shadowTex);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,size,size,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,shadowTex,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
 if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Shadow FBO incomplete');}
 let key=[state.weave,state.thickness,state.slub,state.cotton,state.damage,state.fray,state.shape,state.light,state.seam,state.structure,state.qaClock,physicsView().active?physicsView().revision:0,state.animate?(state.quality==='efficient'?Math.floor(clock*10)/10:clock):0].join('|');
 shadowDrawCalls=0;shadowTriangles=0;
 if(shadowKey===key){gl.bindFramebuffer(gl.FRAMEBUFFER,null);return;}
 shadowDrawing=true;const old=[geomLevel,longMorph,sideMorph,drawCount];geomLevel=0;longMorph=0;sideMorph=0;
 try{gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFbo);gl.viewport(0,0,shadowSize,shadowSize);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.clear(gl.DEPTH_BUFFER_BIT);
 yield* yarnBatches(yarnProg,lightVP,keyPos);
 for(const [prog,m] of [[looseProg,looseMesh],...(state.seam?[[seamProg,seams]]:[])]){yield* triangleBatches(prog,m,lightVP,keyPos);shadowTriangles+=m.count/3;}
 shadowTriangles+=(mainMeshes[0].count*instanceCounts[0]+mainMeshes[1].count*instanceCounts[1])/3;
 shadowDrawCalls=drawCount-old[3];shadowKey=key;}finally{[geomLevel,longMorph,sideMorph,drawCount]=old;shadowDrawing=false;gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
}
function* physicalFrameBatches(time=0){pending=false;let start=performance.now();if(document.hidden||!stageVisible||gl.isContextLost())return;if(!state.qaAudit&&!gpuAvailable()){request(8);return;}if(bakeDirty&&!state.qaAudit){bakeStep();return;}if(state.animate){if(last)clock+=Math.min((time-last)/1000,2);last=time;}else last=0;
 let rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5),cw=Math.max(1,Math.round(rect.width*ratio)),ch=Math.max(1,Math.round(rect.height*ratio));if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
 if(dynamics.error){$('error').hidden=false;$('error').textContent='物理工作线程错误：'+dynamics.error;state.animate=false;}configurePhysics();dynamics.upload();framePhysics={active:dynamics.active,ready:dynamics.ready,revision:dynamics.revision,report:dynamics.report};frameJob.physics=framePhysics;frameJob.generation=dynamics.generation;gpuTimer.start();
 let ss=state.quality==='efficient'?1:Math.max(1,Math.min(2,Math.sqrt((rect.width<700?1100000:2000000)/(cw*ch))));target(Math.round(cw*ss),Math.round(ch*ss));
 let {vp,eye,span,distance,projection}=camera(cw/ch),pixelsPerYarn=ch/span*graph.p.warpPitch,bodyPixels=ch/span*Math.max(graph.p.width,graph.p.height);
 const demand=DistanceLOD.plan(pixelsPerYarn);let far=state.qaForceYarns||state.qaAudit?0:demand.filtered,useMip=far===1,wantFiltered=!state.qaForceYarns&&!state.qaAudit&&demand.localPass;
 currentFar=far;microGain=detail.update(pixelsPerYarn,{...graph.p,r13Split:!!state.experiment},state.damage,state.fray);detailMeshes(pixelsPerYarn);
 if(detail.stats.error)throw Error('近景资源生成失败：'+detail.stats.error);
 if(pixelsPerYarn<2.7&&!detailReleaseTimer&&(detail.store||detail.stats.pending)){detailReleaseTimer=setTimeout(()=>{detailReleaseTimer=0;request();},950);}
 if(!state.qaAudit){configureLights();if(!useMip)yield* makeShadowBatches();if(wantFiltered){makeMacroShadow();yield 65536;}}
filterScale=ss;nearWeight=1-far;
 longMorph=1.-Sampling.smooth(8,12,pixelsPerYarn);sideMorph=1.-Sampling.smooth(8,12,pixelsPerYarn);geomLevel=pixelsPerYarn>8?1:0;
 if(state.qaAudit){longMorph=0;sideMorph=0;geomLevel=1;}
 updateView(vp,span/ch);
 lod=useMip?'中远景 · 同源预过滤 / 物理保持':wantFiltered?'连续像素足迹过渡':detail.stats.pending?'近景细节按需生成中':'近景 · 实体纱线与棉纤维';drawCount=0;
 function* scene(mip){renderingMip=mip;gl.bindFramebuffer(gl.FRAMEBUFFER,screenFbo);gl.viewport(0,0,screenW,screenH);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.clearColor(.071,.077,.084,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  if(!state.qaAudit){drawStudio(eye,cw/ch);yield 131072;}
  if(mip){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   for(let side=0;side<2;side++){uniforms(surfProg,vp,eye);uf(surfProg,'uBack',side===0?1:-1);
    for(let i=0;i<2;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,baked[side*2+i]);ui(surfProg,i?'uNormalMap':'uMap',i);}
    gl.bindVertexArray(carrierMesh.vao);gl.drawElements(gl.TRIANGLES,carrierMesh.count,gl.UNSIGNED_INT,0);drawCount++;
   }gl.disable(gl.BLEND);
  }else yield* yarnBatches(yarnProg,vp,eye);
  if(!mip&&!state.qaAudit&&looseMesh)yield* triangleBatches(looseProg,looseMesh,vp,eye);
  if((!mip||state.experiment==='seam')&&state.seam&&(seamVisible||state.experiment==='seam'))yield* triangleBatches(seamProg,seams,vp,eye);
  if(mip){yield* fiberBatches(looseLines,vp,eye,span,ch,distance,1);if(state.seam&&seamVisible)yield* fiberBatches(seamLines,vp,eye,span,ch,distance,2);}
  if(state.fuzz>.01){yield* fiberBatches(hairs,vp,eye,span,ch,distance);if(!mip&&microGain>0)yield* fiberBatches(detail.store,vp,eye,span,ch,distance);}

 }
 if(wantFiltered&&!useMip){yield* scene(true);
  // The already allocated far image alpha stores a local, derivative-based mix weight.
  gl.colorMask(false,false,false,true);gl.clearColor(0,0,0,far);gl.clear(gl.COLOR_BUFFER_BIT);gl.depthMask(false);gl.disable(gl.BLEND);
  for(let side=0;side<2;side++){uniforms(maskProg,vp,eye);uf(maskProg,'uBack',side? -1:1);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,baked[side*2]);ui(maskProg,'uMap',0);gl.bindVertexArray(carrierMesh.vao);gl.drawElements(gl.TRIANGLES,carrierMesh.count,gl.UNSIGNED_INT,0);}
  gl.colorMask(true,true,true,true);gl.depthMask(true);saveFarFrame();}else if(farTexture){gl.deleteTexture(farTexture);farTexture=null;}
 yield* scene(useMip);Sampling.resolve(gl,screen);
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,cw,ch);gl.disable(gl.DEPTH_TEST);gl.useProgram(blit);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,screenColor);ui(blit,'im',0);gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,farTexture||dummyTex);ui(blit,'farIm',6);uf(blit,'farBlend',farTexture?Math.max(.000001,far):0);gl.uniform2f(U(blit,'outputSize'),cw,ch);uf(blit,'exposure',state.exposure);ui(blit,'audit',state.qaAudit?1:0);gl.bindVertexArray(emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3);drawCount++;frame++;
 if(performance.now()-statusStamp>250||!state.animate){statusStamp=performance.now();$('status').textContent=`${graph.curves.length} 根纱线 · ${state.thickness.toFixed(2)} mm · ${lod}`;updateBudgetPanel();}
 window.__DENIM_WORKBENCH__.lastFrame={frame,drawCalls:drawCount,lod,pixelsPerYarn,nearWeight,farWeight:far,bodyPixels,bakeSize,sparseEdgeFibers:fiberCount,projection,distanceMm:distance,studio:{background:'gray-studio-planes',fog:state.fog,exposure:state.exposure,shadowSize,shadowDrawCalls,shadowTriangles,backgroundOnlyFog:true},colorPipeline:hdr?'linear-RGBA16F-single-tonemap':'linear-RGBA8-single-tonemap',sampling:{msaaSamples:screen.samples,supersampleRatio:ss,outputIntegration:'4x4 linear pixel footprint',temporalHistory:false,gpuQueueLimit:1,gpuWaitPolls:gpuWaits,attributeCapturePassesPerBatch:1,attachmentBytes:screen.attachmentBytes+(farTexture?screenW*screenH*(hdr?8:4):0),note:'attachments only; excludes geometry, mipmaps, driver and browser memory'},scatter:{strength:state.scatter,transmission:state.transmission,kernel:optics.reflectance},distanceLOD:{...demand,microGain,detail:detail.report(),dynamicShadow:true,localFootprintMask:wantFiltered&&!useMip},geometryBufferBytes:[...mainMeshes,carrierMesh,seams,looseMesh,hairs,looseLines,seamLines,detail.store].reduce((a,m)=>a+(m?.bufferBytes||0),0)+instanceCounts.reduce((a,n)=>a+n*32,0)+hairs.textureBytes+(detail.store?.textureBytes||0)+(looseLines?.textureBytes||0)+(seamLines?.textureBytes||0),closeSurface:{cotton:state.cotton,staple:state.staple,nap:state.nap,angularLanes:64,finiteStaples:true},structureWarp:state.structure,solidEdgeDrawn:false,geometryOnly:far===0&&!wantFiltered,longMorph,sideMorph,geomLevel,natural:cachedAudit,looseTriangles:looseMesh.count/3,brokenEnds:brokenEnds.length,instanceCounts:[...instanceCounts],visibleInstanceCounts:[...viewCounts],visibleFiberCurves:hairs.visibleCurves+(microGain>0?(detail.store?.visibleCurves||0):0),sewing:seamAudit,physics:{active:framePhysics.active,...framePhysics.report,damageProxy:state.damage>=2?'hole-aware sheet plus two-way released-yarn chains':'intact directional cloth'},performance:performanceReport(),renderTarget:[screenW,screenH],cpuSubmitMs:frameJob.cpuMs+performance.now()-frameJob.resumeStart,cooperativeRender:{batches:frameJob.batches+1,maximumBatchTriangles:Math.max(batchTrianglePeak,frameJob.currentCost),cancelledFrames,onePhysicsSnapshot:true,qualityReduced:false,gpuElapsedIncludesSchedulingWait:true},triangles:(useMip?(carrierMesh.count*2)/3:(mainMeshes[geomLevel*2].count*viewCounts[0]+mainMeshes[geomLevel*2+1].count*viewCounts[1])/3)+(!state.qaAudit&&looseMesh?(useMip?looseLines.visibleTriangles:looseMesh.count/3):0)+(state.seam&&seamVisible?(useMip?seamLines.visibleTriangles:seams.count/3):0)+(state.fuzz>.01?hairs.visibleTriangles+(!useMip&&microGain>0?(detail.store?.visibleTriangles||0):0):0),transitionDoublePass:wantFiltered&&!useMip};gpuTimer.end();submitGpu();if(detail.fading)request();lastDrawTime=performance.now();if(dynamics.active&&state.animate)dynamics.sample();if(state.animate)request(Math.max(0,1000/state.motionFps-(lastDrawTime-start)));
}

function render(time=0){
 pending=false;if(document.hidden||!stageVisible||gl.isContextLost())return;
 if(!state.qaAudit&&!gpuAvailable()){request(frameJob?4:8,true);return;}
 if(frameJob&&batchSubmittedAt){const elapsed=performance.now()-batchSubmittedAt;if(elapsed<16)batchBudget=Math.min(2097152,batchBudget*2);else if(elapsed>250)batchBudget=Math.max(131072,batchBudget/2);batchSubmittedAt=0;}
 const rect=canvas.getBoundingClientRect(),viewKeyNow=[rect.width,rect.height,devicePixelRatio||1].join('|');const stateKey=JSON.stringify(state);
 if(frameJob&&(deferredBuild||bakeDirty||stateKey!==frameJob.key||viewKeyNow!==frameJob.viewKey||dynamics.generation!==frameJob.generation)){
  // Discard an unfinished OFFSCREEN frame, never a partially displayed image.
  frameJob.iterator.return();gpuTimer.end();frameJob=null;framePhysics=null;cancelledFrames++;gl.colorMask(true,true,true,true);gl.depthMask(true);shadowDrawing=false;shadowKey='';macroShadowKey='';
 }
 if(deferredBuild){deferredBuild=false;build();}
 if(!frameJob&&(!dynamics.active||state.qaAudit||state.qaSingleBatch||bakeDirty)){renderStatic(time);return;}
 if(!frameJob){frameJob={key:JSON.stringify(state),viewKey:viewKeyNow,followup:false,state:{...state},generation:dynamics.generation,physics:null,batches:0,cpuMs:0,currentCost:0,resumeStart:0};frameJob.iterator=physicalFrameBatches(time);}
 const job=frameJob,live=state;state=job.state;framePhysics=job.physics;insideFrame=true;job.resumeStart=performance.now();let result,cost=0;
 try{do{result=job.iterator.next();if(result.done)break;cost+=Number(result.value)||0;job.currentCost=cost;}while(cost<batchBudget);}
 catch(e){job.iterator.return();frameJob=null;framePhysics=null;gpuTimer.end();throw e;}
 finally{job.cpuMs+=performance.now()-job.resumeStart;state=live;insideFrame=false;}
 if(result.done){frameJob=null;framePhysics=null;if(job.followup)request();return;}
 job.batches++;batchTrianglePeak=Math.max(batchTrianglePeak,cost);job.physics=framePhysics;submitGpu();batchSubmittedAt=performance.now();request(1,true);
}

function request(delay=0,internal=false){if(frameJob&&!insideFrame&&!internal)frameJob.followup=true;if(!pending&&!document.hidden&&stageVisible){pending=true;if(frameJob)setTimeout(()=>render(performance.now()),Math.max(1,delay));else if(delay>0)setTimeout(()=>requestAnimationFrame(render),delay);else requestAnimationFrame(render);}}
function recipe(){return {schema:'kaopu.denim_recipe@1',generator:'R13.0',lookBaseline:'R08.0',seed:'fixed-r08',mechanics:{model:'damage-xpbd@1',gsm:state.gsm,autoMass:state.autoMass,warpStiffness:state.warpStiffness,weftStiffness:state.weftStiffness,bendStiffness:state.bendStiffness},noiseKernel:KAOPUDenimNoise.version,units:'millimeter',construction:{weave:state.weave,thickness:state.thickness,slub:state.slub,cotton:state.cotton},finish:{preset:state.preset,wash:state.wash,abrasion:state.abrasion,backstain:state.backstain},surface:{staple:state.staple,nap:state.nap,fuzz:state.fuzz,scatter:state.scatter,transmission:state.transmission},damage:{kind:state.damage,fray:state.fray},sewing:{enabled:state.seam,type:'301-visual-three-ply',...Stitches.settings(graph)},display:{shape:state.shape,light:state.light,exposure:state.exposure,fog:state.fog,structure:state.structure},limits:{containsPhysicsState:false,physicalNeedlePiercing:false}};}
function loadRecipe(r){
 if(!r||r.schema!=='kaopu.denim_recipe@1'||!['R12.0','R12.1','R13.0'].includes(r.generator)||r.units!=='millimeter'||r.seed!=='fixed-r08'||r.noiseKernel!==KAOPUDenimNoise.version)throw Error('本版噪声内核已更换；请使用 R12 配方。旧配方应在对应历史版本打开，不静默改变花纹。');
 const patch={},parts={construction:['weave','thickness','slub','cotton'],finish:['wash','abrasion','backstain'],surface:['staple','nap','fuzz','scatter','transmission'],display:['shape','light','exposure','fog','structure'],mechanics:['gsm','warpStiffness','weftStiffness','bendStiffness']};
 const limits={gsm:[100,900],warpStiffness:[.2,3],weftStiffness:[.2,3],bendStiffness:[.2,3],weave:[0,3],thickness:[.45,1.05],shape:[0,3],light:[0,4],exposure:[.55,1.65],fray:[.3,2.5],damage:[0,4]};
 function number(k,v){const [lo,hi]=limits[k]||[0,1];if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi||(['weave','shape','light','damage'].includes(k)&&!Number.isInteger(v)))throw Error('配方参数无效：'+k);patch[k]=v;}
 for(const [name,keys] of Object.entries(parts))for(const k of keys)number(k,r[name]?.[k]);
 number('damage',r.damage?.kind);number('fray',r.damage?.fray);
 if(!Object.hasOwn(presets,r.finish?.preset)||typeof r.sewing?.enabled!=='boolean'||r.sewing.type!=='301-visual-three-ply')throw Error('配方整理或针脚类型不受支持');
 if(r.mechanics?.model!=='damage-xpbd@1'||typeof r.mechanics.autoMass!=='boolean')throw Error('本版需要 R12 结构物理配方');patch.autoMass=r.mechanics.autoMass;patch.preset=r.finish.preset;patch.seam=r.sewing.enabled;
 // Validation is complete before any state changes; generated geometry is rebuilt, not loaded.
 if(state.experiment)enterExperiment(null,false);Object.assign(state,patch);build();return true;
}
function performanceReport(){const geom=[...mainMeshes,carrierMesh,seams,looseMesh,hairs,looseLines,seamLines,detail.store].reduce((a,m)=>a+(m?.bufferBytes||0),0)+instanceCounts.reduce((a,n)=>a+n*32,0),point=(hairs?.textureBytes||0)+(detail.store?.textureBytes||0)+(looseLines?.textureBytes||0)+(seamLines?.textureBytes||0),mips=baked.length*4*(1024*1024*4-1)/3,attachments=screen?.attachmentBytes||0,transition=farTexture?screenW*screenH*(hdr?8:4):0,shadow=(shadowSize*shadowSize+(macroShadowTex?macroShadowSize*macroShadowSize:0))*4;return {geometryBufferBytes:geom,fiberPointTextureBytes:point,materialMipBytes:mips,shadowBytes:shadow,attachmentBytes:attachments,transitionBytes:transition,trackedGpuBytes:geom+point+mips+shadow+attachments+transition+dynamics.gpuBytes,physicsGpuBytes:dynamics.gpuBytes,physicsWorkerBytes:dynamics.report?.workerArrayBytes??null,physicsCpuMs:dynamics.report?.solverMs??null,detailResidency:detail.report(),retainedFiberCpuBytes:(hairs?.cpuBytes||0)+(detail.store?.cpuBytes||0)+(looseLines?.cpuBytes||0)+(seamLines?.cpuBytes||0),recipeBytes:new TextEncoder().encode(JSON.stringify(recipe())).length,geometryBuilds:geometrySerial,visibilityUpdates:hairs?.updates||0,visibilityChecks:hairs?.visibilityChecks||0,motionFpsCap:state.motionFps,quality:state.quality,gpuTimerSupported:gpuTimer.supported,gpuElapsedMs:gpuTimer.lastMs,gpuSamples:gpuTimer.samples,notTotalProcessMemory:true,clothSolver:state.experiment?'R13 contact/cohesive/cable swatch experiment':'R12.1 legacy damaged-sheet and released-yarn XPBD'};}
function updateBudgetPanel(){if(!$('budgetStats'))return;const p=performanceReport(),mb=x=>(x/1048576).toFixed(1);$('budgetStats').textContent=`已计 GPU 资源 ${mb(p.trackedGpuBytes)} MiB\n纤维点 ${mb(p.fiberPointTextureBytes)} / 几何 ${mb(p.geometryBufferBytes)} MiB\n渲染附件 ${mb(p.attachmentBytes)} / 材质 ${mb(p.materialMipBytes)} MiB\n物理点 ${dynamics.report?.nodes||475} · ${dynamics.report?.stepHz||240} Hz 子步\n有效面点 ${dynamics.report?.topology?.activeSheetNodes??'等待'} / 空洞点 ${dynamics.report?.topology?.inactiveHoleNodes??'等待'}\n移除面约束 ${dynamics.report?.topology?.removedSheetConstraints??'等待'} · 残桥 ${dynamics.report?.topology?.retainedBridgeCount??0}\n结构质量 ${dynamics.report?.topology?(dynamics.report.topology.totalMassKg*1000).toFixed(3)+' g':'等待'} · 面密度 ${dynamics.report?.topology?((dynamics.report.topology.material?.arealDensityKgM2??state.gsm/1000)*1000).toFixed(0)+' g/m²':'等待'}\n近景按需 ${p.detailResidency.resident?'已驻留':p.detailResidency.pending?'生成中':'未驻留'} · 生成 ${p.detailResidency.requests} / 释放 ${p.detailResidency.releases} 次\n轻量配方 ${p.recipeBytes} B · 动画上限 ${state.motionFps} 帧/秒\nGPU计时 ${p.gpuElapsedMs==null?'未获得有效样本':p.gpuElapsedMs.toFixed(2)+' ms'}\n不是浏览器总内存，也不是整机占用率。`;}
function profile(){return {schema:'kaopu.denim_material_profile@2.6',version:'R13.0',noiseKernel:KAOPUDenimNoise.version,graph:{...graph.p,slub:state.slub,units:'millimeter',draft:graph.d,warpCount:graph.nx,weftCount:graph.ny},finish:{recipe:state.preset,wash:state.wash,abrasion:state.abrasion,backstain:state.backstain},surface:{fuzz:state.fuzz,fray:state.fray,cotton:state.cotton,staple:state.staple,nap:state.nap},damage:{kind:state.damage,cuts:graph.cuts,released:naturalData.tubes.filter(c=>c.type!=='edge').map(c=>({type:c.type,family:c.kind?'weft':'warp',id:c.id,parents:c.parents,group:c.group,radiusMm:c.radius,points:c.points})),clumps:naturalData.groups,topologyCoupled:true,adaptiveTearing:false},display:{shape:state.shape,light:state.light,seam:state.seam,studio:{background:'gray-studio-planes',fog:state.fog,exposure:state.exposure}},fiberModel:{structureWarp:state.structure,diffusion:optics,scatterStrength:state.scatter,transmissionStrength:state.transmission,body:'finite staggered staples in periodic angular yarn coordinates; differential cross-section normal',cottonModel:'art-directed candidate, not CT-fitted',sheen:'broad cloth lobe',scatter:'Jensen radial kernel quadrature plus finite-depth single transmission; local real-time approximation, not full calibrated BSSRDF',ribbons:'perspective-correct Gaussian pixel convolution; integral-preserving opacity',sampling:'offscreen MSAA + linear pixel integration + continuous extreme-distance same-graph LOD; no temporal accumulation'},simulation:{active:dynamics.active,...dynamics.report},limits:{physicalCalibration:false,clothSolver:'xpbd-proxy',individualCottonFibers:false,filmGradeValidated:false},sources:{r01:'f64eb3aaaedec738ae3d73661ea967713ede8e39',weaveCompiler:'49b9c0aae2c74f41b0444e5c5449b3c339608a4a'}};}
function updateText(){for(const key of ['gsm','warpStiffness','weftStiffness','bendStiffness']){$(key).value=state[key];$(key+'Val').textContent=state[key].toFixed(key==='gsm'?0:2);}$('autoMass').checked=state.autoMass;$('motionModel').value=state.motionModel;$('motionFps').value=state.motionFps;for(let k of ['wash','abrasion','backstain','slub','thickness','fuzz']){$(k).value=state[k];$(k+'Val').textContent=k==='thickness'?state[k].toFixed(2)+' mm':Math.round(state[k]*100)+'%';}document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===state.preset));$('selected').textContent=presets[state.preset].label;$('weave').value=state.weave;$('shape').value=state.shape;$('light').value=state.light;$('damage').value=state.damage;$('fray').value=state.fray;$('frayVal').textContent=state.fray.toFixed(1)+'×';$('seam').checked=state.seam;for(const key of ['exposure','fog','scatter','transmission','cotton','staple','nap']){$(key).value=state[key];$(key+'Val').textContent=state[key].toFixed(2);}}
for(const key of ['cotton','staple','nap'])$(key).oninput=e=>{
 state[key]=+e.target.value;$(key+'Val').textContent=state[key].toFixed(2);clearTimeout(bakeTimer);
 if(key==='cotton')bakeTimer=setTimeout(build,120);
 else if(key==='staple'){bakeDirty=true;request();}else request();
};
let bakeTimer;for(let k of ['wash','abrasion','backstain','slub','thickness','fuzz'])$(k).oninput=e=>{state[k]=Number(e.target.value);updateText();clearTimeout(bakeTimer);if(k==='thickness'||k==='slub'){bakeTimer=setTimeout(build,120);}else if(k==='fuzz'){request();}else{request();bakeTimer=setTimeout(()=>{bakeDirty=true;request();},100);}};
for(let k of ['weave','shape','light'])$(k).onchange=e=>{state[k]=+e.target.value;if(k==='weave')build();else request();};document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{Object.assign(state,presets[b.dataset.preset],{preset:b.dataset.preset});updateText();build();});$('seam').onchange=e=>{state.seam=e.target.checked;request();};function syncMotion(){dynamics.active=state.motionModel==='xpbd'&&(state.animate||dynamics.active);dynamics.send('controls',{options:physicsParameters()});dynamics.play(state.animate&&state.motionModel==='xpbd'&&!document.hidden&&stageVisible);$('wind').textContent=state.animate?'暂停当前运动':'开启风吹 / 摆动';$('drive').textContent=state.drive?'停止锚点牵引':'动作锚点牵引';if(!state.animate&&dynamics.active)dynamics.sample();request();}
$('wind').onclick=()=>{state.animate=!state.animate;syncMotion();};
$('motionModel').onchange=e=>{dynamics.play(false);dynamics.active=false;state.motionModel=e.target.value;viewKey='';syncMotion();};
$('windSpeed').oninput=e=>{state.windSpeed=+e.target.value;$('windVal').textContent=state.windSpeed.toFixed(1)+' m/s';syncMotion();};
$('drive').onclick=()=>{state.drive=!state.drive;state.animate=true;state.motionModel='xpbd';updateText();syncMotion();};
$('impulse').onclick=()=>{state.motionModel='xpbd';state.animate=true;dynamics.send('kick');updateText();syncMotion();};
$('physicsReset').onclick=()=>{state.animate=false;state.drive=false;dynamics.active=!!state.experiment;dynamics.play(false);dynamics.reset({shape:state.shape});viewKey='';syncMotion();};

$('midReview').onclick=()=>{state.zoom=.85;state.panX=0;state.panY=0;request();};$('lodBack').onclick=()=>{state.zoom=2.0;state.panX=0;state.panY=0;request();};
$('front').onclick=()=>{state.yaw=0;state.pitch=.08;state.zoom=1;state.panX=0;state.panY=0;request();};$('back').onclick=()=>{state.yaw=Math.PI;state.pitch=.10;state.zoom=1;state.panX=0;state.panY=0;request();};$('angle').onclick=()=>{state.yaw=-.50;state.pitch=.64;state.zoom=1.30;state.panY=-12;request();};$('reset').onclick=()=>{state.yaw=-.23;state.pitch=.34;state.zoom=1;state.panX=0;state.panY=0;request();};$('detail').onclick=()=>{state.zoom=5.2;state.panX=3;state.panY=-4;request();};$('full').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else $('stage').requestFullscreen?.();};
$('saveFull').onclick=()=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(profile(),null,2)],{type:'application/json'}));a.href=u;a.download='KAOPU_Denim_R12_Full_Diagnostic.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);};
$('loadRecipe').onclick=()=>$('recipeFile').click();$('recipeFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>65536)throw Error('轻量配方超过 64 KiB，请检查文件');loadRecipe(JSON.parse(await f.text()));$('status').textContent='已恢复轻量配方';}catch(err){$('error').hidden=false;$('error').textContent=String(err.message||err);}finally{e.target.value='';}};
$('save').onclick=()=>{let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(recipe(),null,2)],{type:'application/json'}));a.download='KAOPU_Denim_R12_Profile.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);};
let dragging=false,oldX=0,oldY=0;canvas.onpointerdown=e=>{dragging=true;oldX=e.clientX;oldY=e.clientY;canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!dragging)return;if(e.shiftKey||e.buttons===2){state.panX-=(e.clientX-oldX)*.10/state.zoom;state.panY+=(e.clientY-oldY)*.10/state.zoom;}else{state.yaw+=(e.clientX-oldX)*.007;state.pitch=Math.max(-1.35,Math.min(1.35,state.pitch+(e.clientY-oldY)*.006));}oldX=e.clientX;oldY=e.clientY;request();};canvas.oncontextmenu=e=>e.preventDefault();canvas.onpointerup=canvas.onpointercancel=()=>dragging=false;canvas.onwheel=e=>{e.preventDefault();state.zoom=Math.max(.10,Math.min(6.,state.zoom*Math.exp(-e.deltaY*.001)));request();};
function auditGPU(){if(frameJob)throw Error('Await the current physical frame before synchronous depth audit');const saved={...state};Object.assign(state,{qaAudit:true,structure:0,qaForceYarns:true,shape:0,yaw:0,pitch:0,zoom:1,panX:0,panY:0,seam:false,fuzz:0,animate:false,qaPanX:0});render(0);gl.finish();const w=canvas.width,h=canvas.height,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const {vp}=camera(w/h);let checked=0,wrong=0,ambiguous=0,examples=[];for(let y=0;y<graph.ny;y++)for(let x=0;x<graph.nx;x++){const mx=(x+.5)*graph.p.warpPitch-graph.p.width/2,my=(y+.5)*graph.p.weftPitch-graph.p.height/2,px=Math.floor((vp[0]*mx+vp[4]*my+vp[12]+1)*w*.5),py=Math.floor((vp[1]*mx+vp[5]*my+vp[13]+1)*h*.5);if(px<0||px>=w||py<0||py>=h)continue;const i=(py*w+px)*4,red=pixels[i],green=pixels[i+1],expected=graph.d.cells[(y%graph.d.height)*graph.d.width+x%graph.d.width];checked++;if(Math.abs(red-green)<12)ambiguous++;if((red>green)!==!!expected){wrong++;if(examples.length<12)examples.push({x,y,red,green,expected});}}
Object.assign(state,saved);state.qaAudit=!!saved.qaAudit;state.qaForceYarns=!!saved.qaForceYarns;request();return {checked,wrong,ambiguous,examples,method:'actual depth-tested warp/weft raster at crossing centers, flat carrier; not a global self-collision proof'};}
$('quality').onchange=e=>{state.quality=e.target.value;viewKey='';request();};$('motionFps').onchange=e=>{state.motionFps=+e.target.value;request();};$('stitchReview').onclick=()=>{state.seam=true;state.zoom=5.2;state.panX=3;state.panY=Stitches.settings(graph).rows[0]+1.35;state.yaw=-.20;state.pitch=.25;updateText();request();};
$('farReview').onclick=()=>{state.zoom=.22;state.panX=0;state.panY=0;request();};
$('rimReview').onclick=()=>{state.light=4;state.zoom=1.45;state.yaw=-.3;state.pitch=.18;state.panX=4;state.panY=-1;updateText();request();};
$('showFray').onclick=()=>{Object.assign(state,presets.vintage,{preset:'vintage',damage:4,shape:1,seam:false,zoom:1.4,yaw:-.17,pitch:.20,panX:4,panY:-1});build();};
$('damage').onchange=e=>{state.damage=+e.target.value;build();};$('fray').oninput=e=>{state.fray=+e.target.value;$('frayVal').textContent=state.fray.toFixed(1)+'×';clearTimeout(bakeTimer);bakeTimer=setTimeout(build,120);};new ResizeObserver(()=>{viewKey='';request();}).observe(canvas);new IntersectionObserver(e=>{stageVisible=e[0].isIntersecting;dynamics.play(stageVisible&&!document.hidden&&state.animate&&state.motionModel==='xpbd');if(stageVisible){pending=false;last=0;request();}}).observe(canvas);document.addEventListener('visibilitychange',()=>{dynamics.play(!document.hidden&&stageVisible&&state.animate&&state.motionModel==='xpbd');if(!document.hidden){pending=false;last=0;request();}});for(const key of ['exposure','fog','scatter','transmission'])$(key).oninput=e=>{state[key]=+e.target.value;$(key+'Val').textContent=state[key].toFixed(2);request();};
for(const key of ['gsm','warpStiffness','weftStiffness','bendStiffness'])$(key).oninput=e=>{state[key]=Number(e.target.value);$(key+'Val').textContent=state[key].toFixed(key==='gsm'?0:2);request();};
$('autoMass').onchange=e=>{state.autoMass=e.target.checked;request();};
$('materialThin').onclick=()=>window.__DENIM_WORKBENCH__.setState({thickness:.45,autoMass:true});
$('materialThick').onclick=()=>window.__DENIM_WORKBENCH__.setState({thickness:1.05,autoMass:true});
$('damageLoad').onclick=()=>window.__DENIM_WORKBENCH__.setState({damage:4,zoom:1.5,panX:4,panY:-1,animate:true,motionModel:'xpbd',windSpeed:1.1});

let savedMaterialState=null;
function enterExperiment(mode,play=true){if(!['fold','tear','seam',null].includes(mode))throw Error('Unknown experiment');dynamics.play(false);if(!mode){if(savedMaterialState)Object.assign(state,savedMaterialState);state.experiment=null;state.animate=false;savedMaterialState=null;dynamics.active=false;}else{if(!state.experiment)savedMaterialState={...state};Object.assign(state,{experiment:mode,damage:0,shape:0,structure:.4,windSpeed:0,drive:false,animate:play,motionModel:'xpbd',selfCollision:true,seam:mode==='seam',seamEnabled:true,pullMm:mode==='tear'?12:mode==='seam'?2:0,fold:mode==='fold'?1:0,tearStrengthN:.006,panX:mode==='fold'?-12:0,panY:0,zoom:mode==='seam'?1.35:.95,yaw:mode==='fold'?-.7:-.18,pitch:mode==='fold'?.95:.24});dynamics.active=true;}
 for(const id of ['damage','showFray','damageLoad','shape','motionModel','drive'])$(id).disabled=!!mode;physicsConfigKey='';build();syncMotion();updateExperimentPanel();}
function mechanicsControls(patch){if(!state.experiment)throw Error('Open one of the three R13 experiments first');const allowed=['selfCollision','friction','pullMm','fold','tearStrengthN','seamSlackMm','seamStrengthN','seamEnabled'];const ranges={friction:[0,1],pullMm:[0,22],fold:[0,1],tearStrengthN:[.005,2],seamSlackMm:[-.5,2],seamStrengthN:[.01,5]};for(const [k,v] of Object.entries(patch)){if(!allowed.includes(k))throw Error('Unknown mechanics control '+k);if(ranges[k]&&(!Number.isFinite(v)||v<ranges[k][0]||v>ranges[k][1]))throw Error('Invalid mechanics value '+k);if(!ranges[k]&&typeof v!=='boolean')throw Error('Boolean mechanics control required');}Object.assign(state,patch);dynamics.send('controls',{options:physicsParameters()});dynamics.sample();request();updateExperimentPanel();}
function updateExperimentPanel(){const r=dynamics.report;const mode=state.experiment;for(const k of ['pullMm','tearStrengthN','seamSlackMm','friction']){$('r13-'+k).value=state[k];$('r13-'+k+'-value').textContent=Number(state[k]).toFixed(k==='tearStrengthN'?3:2);}$('r13-self').checked=state.selfCollision;document.querySelectorAll('[data-experiment]').forEach(b=>b.classList.toggle('active',b.dataset.experiment===mode));$('r13-stats').textContent=mode&&r?.experiment?`${({fold:'折叠接触',tear:'受力裂口',seam:'缝线张力'})[mode]} · 已求解 ${r.steps} 子步\n接触修正累计 ${r.contacts} · 当前 VF ${r.contactDetail.vertexFace} / EE ${r.contactDetail.edgeEdge}\n断裂连接 ${r.brokenBonds}/19 · 最大开口 ${r.maxCrackGapMm.toFixed(2)} mm\n最大针脚拉力 ${(r.maxStitchForceN*1000).toFixed(2)} mN · ${r.stitchEnabled?'针脚连接中':'已拆线'}\n质量 ${(r.massKg*1000).toFixed(4)} g · 未删除布料\n${r.simulationSeconds.toFixed(2)} s 物理时间 / 非实机帧率`:'选择一项开始试验；原材质与旧功能保留。';}
for(const b of document.querySelectorAll('[data-experiment]'))b.onclick=()=>enterExperiment(b.dataset.experiment);
$('r13-original').onclick=()=>enterExperiment(null);$('r13-self').onchange=e=>mechanicsControls({selfCollision:e.target.checked});
for(const k of ['pullMm','tearStrengthN','seamSlackMm','friction'])$('r13-'+k).oninput=e=>mechanicsControls({[k]:Number(e.target.value)});
$('r13-remove').onclick=()=>mechanicsControls({seamEnabled:!state.seamEnabled});
$('r13-run').onclick=()=>{if(!state.experiment)return;state.animate=!state.animate;syncMotion();};
$('r13-restart').onclick=()=>{if(!state.experiment)return;state.animate=false;dynamics.play(false);dynamics.active=true;dynamics.reset();request();};
$('r13-step').onclick=()=>window.__DENIM_WORKBENCH__.physicsStep(.1);
$('r13-save').onclick=()=>{const data={schema:'kaopu.denim_mechanics_experiment@1',generator:'R13.0',experiment:state.experiment,options:physicsParameters(),material:{thickness:state.thickness,gsm:state.gsm},state:r13FrameReport(),note:'Report/settings, not a restartable full state snapshot'},a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download='Denim_R13_Experiment.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);};
function advanceExperiment(seconds){if(!state.experiment||!Number.isFinite(seconds)||seconds<=0||seconds>3.2)throw Error('Experiment batch must be 0..3.2 seconds');state.animate=false;dynamics.active=true;dynamics.play(false);const full=Math.floor((seconds+1e-8)/.1);for(let k=0;k<full;k++)dynamics.send('step',{seconds:.1});const tail=seconds-full*.1;if(tail>1e-8)dynamics.send('step',{seconds:tail});dynamics.sample();request();}
function r13FrameReport(){return {displayedPhysics:window.__DENIM_WORKBENCH__.lastFrame?.physics,latestReceivedPhysics:dynamics.report};}
setInterval(updateExperimentPanel,700);
window.__DENIM_WORKBENCH__={ready:false,enterExperiment,mechanicsControls,advanceExperiment,r13FrameReport,renderIdle:()=>!frameJob&&gpuAvailable(),renderBatchState:()=>({inFlight:!!frameJob,batches:frameJob?.batches||0,cancelledFrames,batchBudget}),version:'R13.0',renderer:'WebGL2',physicsReport:()=>dynamics.report,physicsReady:()=>dynamics.ready,physicsGeneration:()=>dynamics.generation,physicsSnapshot:()=>{dynamics.sample();return dynamics.revision;},physicsStep:seconds=>{if(!Number.isFinite(seconds)||seconds<=0||seconds>.1)throw Error('step range 0..0.1s');configurePhysics();state.animate=false;state.motionModel='xpbd';dynamics.active=true;dynamics.play(false);dynamics.send('step',{seconds});dynamics.sample();},setAnchorOffsets:values=>{if(!Array.isArray(values)||values.length!==75||!values.every(v=>Number.isFinite(v)&&Math.abs(v)<=.015))throw Error('75 finite metre offsets required');dynamics.send('anchors',{value:values});},setCollisionSpheres:values=>dynamics.send('colliders',{value:values}),profile,recipe,loadRecipe,performanceReport,seamAudit:()=>seamAudit,naturalAudit:()=>cachedAudit,getNatural:()=>Natural.generate(C,graph,state.damage,state.fray),audit:()=>C.audit(graph),state,setState:patch=>{const geom=['experiment','weave','thickness','slub','cotton','damage','fray'].some(k=>k in patch),finish=['wash','abrasion','backstain','slub','cotton','staple','preset'].some(k=>k in patch);Object.assign(state,patch);if('animate' in patch||'motionModel' in patch||'windSpeed' in patch||'drive' in patch){if(state.motionModel!=='xpbd')dynamics.active=false;syncMotion();}updateText();if(geom)build();else if(finish){bakeDirty=true;request();}else request();},renderNow:()=>render(0),lastFrame:null,networkAssets:0,getGLError:()=>gl.isContextLost()?37442:gl.getError(),benchmark:()=>{const before=frame;gl.finish();let t=performance.now();render(0);gl.finish();return {rendered:frame>before,completionMs:frame>before?performance.now()-t:null,note:'Synchronous diagnostic only; not hardware FPS'};},getOptics:()=>optics,getGraph:()=>graph,projectPoint:p=>{let v=camera(canvas.width/canvas.height).vp,q=[0,0,0,0];for(let r=0;r<4;r++)q[r]=v[r]*p[0]+v[r+4]*p[1]+v[r+8]*p[2]+v[r+12];return [(q[0]/q[3]*.5+.5)*canvas.width,(q[1]/q[3]*.5+.5)*canvas.height];},auditGPU,samplePatch:()=>{gl.finish();let w=160,h=160,p=new Uint8Array(w*h*4);gl.readPixels(Math.floor((canvas.width-w)/2),Math.floor((canvas.height-h)/2),w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p);}};build();window.__DENIM_WORKBENCH__.ready=true;
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();state.animate=false;dynamics.play(false);window.__DENIM_WORKBENCH__.ready=false;window.__DENIM_WORKBENCH__.contextLost=true;$('error').hidden=false;$('error').textContent='图形上下文已丢失，请重新载入页面。此状态不属于有效渲染。';});
})();
