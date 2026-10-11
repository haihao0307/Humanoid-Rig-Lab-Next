/* R09.0 — actual continuous warp/weft geometry, physically sized in mm.
   Shape is an art-directed carrier, NOT a cloth dynamics solver.
   Far LOD is a prefiltered capture of this same YarnGraph, not an unrelated image. */
(()=>{'use strict';const $=s=>document.getElementById(s),C=KAOPUDenimCore,Natural=KAOPUNaturalYarn,Sampling=KAOPUDenimSampling,canvas=$('view');
const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,preserveDrawingBuffer:true,powerPreference:'default'});if(!gl){$('error').hidden=false;$('error').textContent='需要支持 WebGL2 的浏览器。';return;}
let state={quality:'balanced',frameLimit:30,stitchCells:7,threadDiameter:.14,preset:'rinse',weave:0,cotton:.78,staple:.72,nap:.70,thickness:.70,slub:.55,wash:.23,abrasion:.24,backstain:.08,fuzz:.55,damage:0,fray:1,panX:0,panY:0,shape:1,light:2,exposure:1,fog:.65,scatter:.85,transmission:.55,structure:1,seam:true,animate:false,yaw:-.23,pitch:.34,zoom:1},graph,mainMeshes=[],fuzzMesh,baked=[],pending=false,frame=0,last=0,clock=0,drawCount=0;
const presets={raw:{label:'01 · 原色靛蓝',wash:0,abrasion:.02,backstain:0,slub:.25},rinse:{label:'02 · 轻水洗',wash:.23,abrasion:.24,backstain:.08,slub:.25},vintage:{label:'03 · 复古石洗',wash:.52,abrasion:.65,backstain:.14,slub:.32},bleach:{label:'04 · 浅蓝漂洗',wash:.81,abrasion:.38,backstain:.04,slub:.20},slubby:{label:'05 · 竹节原色',wash:.16,abrasion:.36,backstain:.05,slub:.85},black:{label:'06 · 黑色水洗',wash:.28,abrasion:.45,backstain:.07,slub:.25}};
Object.assign(presets,{
 grey:{label:'07 · 烟灰洗旧',wash:.50,abrasion:.65,backstain:.08,slub:.38},
 ecru:{label:'08 · 本白牛仔',wash:.08,abrasion:.15,backstain:0,slub:.38},
 indigoBlack:{label:'09 · 蓝经黑纬',wash:.20,abrasion:.35,backstain:.06,slub:.40},
 doubleIndigo:{label:'10 · 双靛蓝',wash:.18,abrasion:.25,backstain:0,slub:.35},
 enzyme:{label:'11 · 柔化洗旧',wash:.46,abrasion:.40,backstain:.15,slub:.35},
 acid:{label:'12 · 云斑洗旧',wash:.64,abrasion:.84,backstain:.05,slub:.35}
});
const Budget=KAOPURuntimeBudget,Compact=KAOPUCompactFibers,Stitch=KAOPULockstitch;let cachedNaturalAudit=null,buildSerial=0,geometryBuilds=0,stitchStats=null,renderDeadline=0,lastHud=0;const timer=new Budget.Timer(gl);const contextAttributes=gl.getContextAttributes();
const optics=KAOPUFiberOptics.integrate();const common=`
precision highp float;precision highp int;
uniform vec4 uSize;uniform vec4 uParam;uniform int uDraftBits;uniform int uRepeat;uniform int uKind;uniform int uShape;uniform float uTime;uniform float uSlub;uniform float uFray;uniform int uDamage;uniform float uLongMorph;uniform float uSideMorph;uniform int uRangeBase;
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
${KAOPUCottonSurface.shapeGLSL}
${Stitch.glsl}
`;
const yarnProfileGLSL=`struct YarnProfile{vec2 m;vec3 B,N;float h,ra,rz,pitch,ph,t;};
YarnProfile yarnProfile(float t,int id){YarnProfile p;float pitch=uKind==0?uSize.w:uSize.z;float ph=float(id)+float(uKind)*79.;float bulge=noise1(t*.10+ph*19.31);float irregular=1.+uSlub*(.20*(hash(ph)*2.-1.)+.24*(bulge-.5)+.045*sin(t*.61+ph));
p.ra=(uKind==0?uSize.z*.49:uSize.w*.235)*clamp(irregular,.84,1.09);p.rz=uParam.y*(uKind==0?1.:.68)*(1.+uSlub*.14*(bulge-.5));float gate=sin(3.14159265*(t-.5));p.h=liftAt(t,id,uKind)-(uKind==1?uParam.y*.18:0.)+.023*uSlub*gate*gate*sin(t*.48+ph*.67);float deriv=(liftAt(t+.008,id,uKind)-liftAt(t-.008,id,uKind))/(.016*pitch);vec3 T=normalize(uKind==0?vec3(0,1,deriv):vec3(1,0,deriv));p.B=uKind==0?vec3(1,0,0):vec3(0,1,0);p.N=normalize(uKind==0?cross(p.B,T):cross(T,p.B));p.m=uKind==0?vec2((float(id)+.5)*uSize.z-uSize.x*.5,t*uSize.w-uSize.y*.5):vec2(t*uSize.z-uSize.x*.5,(float(id)+.5)*uSize.w-uSize.y*.5);float wobble=uSlub*gate*(.036*sin(t*.37+ph*.71)+.021*sin(t*.113+ph*1.9));p.m+=p.B.xy*wobble;p.pitch=pitch;p.ph=ph;p.t=t;return p;}
vec3 yarnSection(YarnProfile p,float theta,float scale){float q=theta/0.785398163397,k=floor(q),f=fract(q);vec2 circle=vec2(cos(theta),sin(theta)),poly=mix(vec2(cos(k*0.785398163397),sin(k*0.785398163397)),vec2(cos((k+1.)*0.785398163397),sin((k+1.)*0.785398163397)),f),cs=mix(circle,poly,uSideMorph);float packing=cottonPacking(theta,p.t*p.pitch,p.ph).x;vec3 delta=(p.B*p.ra*cs.x*scale+p.N*p.rz*cs.y*scale)*packing;return vec3(p.m,p.h)+delta;}
`;
const vs=`#version 300 es
${common}
layout(location=0) in vec4 aP;layout(location=1) in vec4 aRange;uniform mat4 uVP;uniform int uFlat;out vec3 vN;out vec3 vW;out vec3 vT;out vec3 vMacro;out vec2 vM;out vec2 vLocal;out float vCrown;flat out float vId;out vec3 vWarp;flat out int vKind;
${yarnProfileGLSL}
void main(){int id=int(aRange.z+.5);float t=clamp(aP.x+floor(aRange.x/16.)*16.,aRange.x,aRange.y);if(abs(aP.w)>.5)t=aP.w<0.?aRange.x:aRange.y;float theta=aP.y;
 float sectionScale=aP.z;int caps=int(aRange.w+.5);if(abs(aP.w)>.5&&(aP.w<0.?((caps&1)==0):((caps&2)==0)))sectionScale=0.;YarnProfile profile=yarnProfile(t,id);vec3 local=yarnSection(profile,theta,sectionScale);
 float low=floor(t*2.)*.5;float high=min(low+.5,aRange.y);low=max(low,aRange.x);
 if(uLongMorph>.0001 && fract(t*2.)>.0001 && high>low+.00001)local=mix(local,mix(yarnSection(yarnProfile(low,id),theta,aP.z),yarnSection(yarnProfile(high,id),theta,aP.z),(t-low)/(high-low)),uLongMorph);
 float pitch=uKind==0?uSize.w:uSize.z;float deriv=(liftAt(t+.01,id,uKind)-liftAt(t-.01,id,uKind))/(.02*pitch);vec3 tangent=normalize(uKind==0?vec3(0,1,deriv):vec3(1,0,deriv));
 vec3 B=uKind==0?vec3(1,0,0):vec3(0,1,0),N0=normalize(uKind==0?cross(B,tangent):cross(tangent,B));
 vec3 dt=yarnSection(profile,theta+.004,1.)-yarnSection(profile,theta-.004,1.);vec3 normal=normalize(uKind==0?cross(tangent,dt):cross(dt,tangent));if(abs(aP.w)>.5)normal=tangent*aP.w;
 vec2 m=local.xy;mat3 mat=uFlat==1?mat3(1):basis(m);vec3 base=uFlat==1?vec3(m,0):carrier(m);
 vW=base+mat[2]*local.z;vN=normalize(mat*normal);vT=normalize(mat*tangent);vMacro=normalize(mat[2]);vWarp=normalize(mat[1]);vM=m;vLocal=vec2(t,theta);vId=float(id);vKind=uKind;
 vCrown=clamp((liftAt(t,id,uKind)/uParam.x+1.)*.5,0.,1.);gl_Position=uVP*vec4(vW,1.);}


`;
const fragCommon=`precision highp float;precision highp int;
uniform vec4 uSize;uniform vec4 uParam;uniform float uTime;
float hash(float x){uint n=(uint(int(x))^0x9e3779b9u)*0x85ebca6bu;n^=n>>13;n*=0xc2b2ae35u;return float(n^(n>>16))/4294967296.;}float noise1(float x){float a=floor(x),f=fract(x);return mix(hash(a),hash(a+1.),f*f*(3.-2.*f));}
`;
const shade=`uniform vec3 uCam;uniform float uWash,uAbrasion,uBackstain,uFuzz,uExposure;
uniform int uBlack,uLight,uAA,uBake,uAudit,uDamage,uShadowPass;
uniform float uFilterScale,uNearWeight;
uniform sampler2D uShadowMap;uniform mat4 uLightVP;uniform float uShadowTexel;
uniform vec3 uKeyPos,uKeyColor,uFillColor;
float sat(float x){return clamp(x,0.,1.);}
vec3 tone(vec3 x){return max(x,vec3(0));}
float hash2(vec2 x){return fract(sin(dot(x,vec2(127.1,311.7)))*43758.5453);}
float n2(vec2 x){vec2 a=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(hash2(a),hash2(a+vec2(1,0)),f.x),mix(hash2(a+vec2(0,1)),hash2(a+1.),f.x),f.y);}
float finishField(vec2 p){return .48*n2(p*vec2(.036,.027)+11.)+.30*n2(p*vec2(.097,.073)+31.)+.22*n2(p*vec2(.22,.15)+81.);}
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
${fragCommon}${shade}${Stitch.glsl}
in vec3 vN;in vec3 vW;in vec3 vT;in vec3 vMacro;in vec2 vM;in vec2 vLocal;in float vCrown;flat in float vId;in vec3 vWarp;flat in int vKind;uniform sampler2D uFrontCol;uniform sampler2D uFrontN;uniform sampler2D uBackCol;uniform sampler2D uBackN;out vec4 O;
void main(){if(uSeam==1&&needleDistance(vM)<.64)discard;if(uShadowPass==1){O=vec4(1);return;}if(uAudit==1){O=vKind==0?vec4(1,0,0,1):vec4(0,1,0,1);return;}
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
col*=mix(1.,.92+.08*abs(front),uCotton)*seamContact(vM);
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
in vec2 aM;uniform mat4 uVP;uniform float uBack;out vec3 vW;out vec3 vN;out vec3 vT;out vec2 vUV;out vec2 vM;void main(){mat3 b=basis(aM);vN=normalize(b[2])*uBack;vT=normalize(b[1]);vW=carrier(aM)+normalize(b[2])*uBack*uParam.z;vM=aM;vUV=aM/uSize.xy+.5;gl_Position=uVP*vec4(vW,1.);}
`;
const surfFS=`#version 300 es
${fragCommon}${shade}${Stitch.glsl}
uniform sampler2D uMap;uniform sampler2D uNormalMap;uniform float uBack;in vec3 vW;in vec3 vN;in vec3 vT;in vec2 vUV;in vec2 vM;out vec4 O;
void main(){if(dot(vN,uCam-vW)<=0.)discard;
vec2 dx=dFdx(vUV)*uFilterScale,dy=dFdy(vUV)*uFilterScale;vec4 tex=textureGrad(uMap,vUV,dx,dy);if(tex.a<.0001)discard;
vec3 nTex=textureGrad(uNormalMap,vUV,dx,dy).xyz*2.-1.;vec3 N0=normalize(vN)*uBack;vec3 B=normalize(cross(vT,N0));mat3 b=mat3(B,normalize(vT),N0);
vec3 N=normalize(mix(normalize(vN),normalize(b*nTex),.10));vec3 c=tex.rgb/max(tex.a,.001);
O=vec4(tone(lighting(c,N,normalize(vT),vW,uFuzz)),tex.a);}
`;
const seamVS=`#version 300 es
${common}
in vec3 aM,aNormal,aTangent;in vec2 aUV;uniform mat4 uVP;out vec3 vW,vN,vT;out vec2 vM,vUV;
void main(){mat3 b=basis(aM.xy);vW=carrier(aM.xy)+b[2]*aM.z;vN=normalize(b*aNormal);vT=normalize(b*aTangent);vM=aM.xy;vUV=aUV;gl_Position=uVP*vec4(vW,1.);}`;
const seamFS=`#version 300 es
${fragCommon}${shade}
uniform float uThreadRadius;in vec3 vW,vN,vT;in vec2 vM,vUV;out vec4 O;
void main(){if(uShadowPass==1){O=vec4(1);return;}vec3 N=normalize(vN),T=normalize(vT);if(!gl_FrontFacing)N=-N;float twist=vUV.y-vUV.x*8.4;float fp=length(vec2(dFdx(twist),dFdy(twist)))*uFilterScale;float detail=1.-smoothstep(.5,2.5,fp);float ply=cos(twist*3.)*detail;N=normalize(N+cross(T,N)*sin(twist*3.)*.16*detail);vec3 c=vec3(.145,.082,.022)*(1.+.13*ply+.05*sin(vUV.x*2.3));O=vec4(tone(layeredLighting(c,N,T,vW,.25,2.*uThreadRadius)),1.);}`;
const hairVS=`#version 300 es
${common}
${Compact.vertexPrelude}
uniform mat4 uVP;uniform vec3 uCam;uniform float uMmPerPixel,uFocusDistance;
out vec3 vW,vN,vT;out vec2 vM;out float vSide,vAlpha,vLife;flat out float vFamily,vId,vDiameter,vRole;
void main(){${Compact.vertexRead}mat3 b=basis(aP.xy);vM=aP.xy;vW=carrier(aP.xy)+b[2]*aP.z;vN=normalize(b[2]);vT=normalize(b*aTangent.xyz);vFamily=aMeta.x;vId=aMeta.w;vDiameter=2.*aMeta.z;vRole=aTangent.w;
vec3 right=normalize(cross(normalize(uCam-vW),vT)+vec3(.00001));
vec4 clip=uVP*vec4(vW,1.);float pixel=uMmPerPixel*max(.05,clip.w/uFocusDistance);
float r=aMeta.z,sigma=.55*r,filtered=sqrt(sigma*sigma+.1849*pixel*pixel),w=3.*filtered;
float taper=smoothstep(0.,.09,aMeta.y)*(1.-smoothstep(.74,1.,aMeta.y));
if(collapsed){w=0.;taper=0.;}vLife=aMeta.y;vAlpha=sigma/filtered*taper;vSide=aP.w;gl_Position=uVP*vec4(vW+right*aP.w*w,1.);}`;
const hairFS=`#version 300 es
${fragCommon}${shade}${Stitch.glsl}
in vec3 vW,vN,vT;in vec2 vM;in float vSide,vAlpha,vLife;flat in float vFamily,vId,vDiameter,vRole;out vec4 O;
void main(){float a=exp(-vSide*vSide*4.5)*vAlpha*min(1.,uFuzz*1.6)*mix(1.,uNap*1.6,step(.5,vRole));if(a<.00005)discard;
vec3 c=yarnColor(vM,vFamily,vId,1.);c=mix(c,vec3(.20,.193,.178),.10+(.22*uWash+.36*uAbrasion)*(.5+.5*sin(vLife*3.14159265)));
vec3 V=normalize(uCam-vW),L=normalize(uKeyPos-vW);float cyl=sqrt(max(.01,1.-pow(dot(normalize(vT),L),2.)));
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
in vec3 aP;in vec3 aNormal;in vec3 aTangent;in vec3 aInfo;uniform mat4 uVP;
out vec3 vW;out vec3 vN;out vec3 vT;out vec3 vInfo;out vec2 vM;out float vDiameter;
void main(){mat3 b=basis(aP.xy);vW=carrier(aP.xy)+b[2]*aP.z;vM=aP.xy;vN=normalize(b*aNormal);vT=normalize(b*aTangent);vInfo=aInfo;vDiameter=2.*length(aNormal);gl_Position=uVP*vec4(vW,1.);}`;
const looseFS=`#version 300 es
${fragCommon}${shade}${Stitch.glsl}
in vec3 vW;in vec3 vN;in vec3 vT;in vec3 vInfo;in vec2 vM;in float vDiameter;out vec4 O;
void main(){if(uShadowPass==1){O=vec4(1);return;}vec3 N=normalize(vN),T=normalize(vT);if(!gl_FrontFacing)N=-N;
float variation;vec3 B=normalize(cross(T,vec3(.01,.03,1)));float angle=atan(dot(N,cross(B,T)),dot(N,B));
N=fiberSurface(N,T,vec2(vInfo.z,angle*.18),floor(vInfo.y+.5),variation);
vec3 col=yarnColor(vM,floor(vInfo.x+.5),floor(vInfo.y+.5),1.);col=mix(col,vec3(.29,.276,.247),vInfo.x>.5?.50:.23)*variation;
vec3 softN=normalize(mix(normalize(uCam-vW),N,.55));
O=vec4(tone(layeredLighting(col,softN,T,vW,.9,vDiameter)),1.);}`;

const depthVS=`#version 300 es
${common}
layout(location=0) in vec4 aP;layout(location=1) in vec4 aRange;uniform mat4 uVP;out vec2 vM;
${yarnProfileGLSL}
void main(){int id=int(aRange.z+.5);float t=clamp(aP.x+floor(aRange.x/16.)*16.,aRange.x,aRange.y);if(abs(aP.w)>.5)t=aP.w<0.?aRange.x:aRange.y;float scale=aP.z;int caps=int(aRange.w+.5);if(abs(aP.w)>.5&&(aP.w<0.?((caps&1)==0):((caps&2)==0)))scale=0.;vec3 p=yarnSection(yarnProfile(t,id),aP.y,scale);vM=p.xy;gl_Position=uVP*vec4(carrier(p.xy)+basis(p.xy)[2]*p.z,1.);}`;
const depthFS=`#version 300 es
${fragCommon}${Stitch.glsl}
in vec2 vM;out vec4 O;void main(){if(uSeam==1&&needleDistance(vM)<.64)discard;O=vec4(1);}`;

function program(v,f){function sh(type,s){let q=gl.createShader(type);gl.shaderSource(q,s);gl.compileShader(q);if(!gl.getShaderParameter(q,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(q));return q;}let p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
let yarnProg,surfProg,seamProg,hairProg,looseProg,depthProg;try{yarnProg=program(vs,fs);depthProg=program(depthVS,depthFS);surfProg=program(surfVS,surfFS);seamProg=program(seamVS,seamFS);hairProg=program(hairVS,hairFS);looseProg=program(looseVS,looseFS);}catch(e){$('error').hidden=false;$('error').textContent=e.message;throw e;}
let filterScale=1,nearWeight=1,longMorph=0,sideMorph=0,geomLevel=0,bakeDirty=true;const dummyTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,dummyTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,128,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);const loc=new Map();function U(p,k){let key=String(p._id||'')+k;if(!p._loc)p._loc={};return Object.prototype.hasOwnProperty.call(p._loc,k)?p._loc[k]:(p._loc[k]=gl.getUniformLocation(p,k));}function uf(p,k,x){gl.uniform1f(U(p,k),x);}function ui(p,k,x){gl.uniform1i(U(p,k),x);}function v3(p,k,x){gl.uniform3fv(U(p,k),x);}function mat(p,k,x){gl.uniformMatrix4fv(U(p,k),false,x);}
const norm=v=>{let l=Math.hypot(...v);return v.map(x=>x/l);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
function mul(a,b){let r=new Float32Array(16);for(let c=0;c<4;c++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)r[c*4+row]+=a[k*4+row]*b[c*4+k];return r;}
function look(eye,target=[0,0,3]){let z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
function mesh(data,indices,p,attr,size,stride=0){let vao=gl.createVertexArray();gl.bindVertexArray(vao);let vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,(data instanceof Float32Array?data:new Float32Array(data)),gl.STATIC_DRAW);let at=gl.getAttribLocation(p,attr);gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,size,gl.FLOAT,false,stride*4,0);let ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,(indices instanceof Uint32Array?indices:new Uint32Array(indices)),gl.STATIC_DRAW);gl.bindVertexArray(null);return {vao,vb,ib,count:indices.length,bufferBytes:(data.length+indices.length)*4};}
function destroy(m){if(m){if(m.indexBuffer)gl.deleteBuffer(m.indexBuffer);if(m.textures)m.textures.forEach(t=>gl.deleteTexture(t));if(m.fullVAO)gl.deleteVertexArray(m.fullVAO);gl.deleteVertexArray(m.vao);gl.deleteBuffer(m.vb);gl.deleteBuffer(m.ib);}}
function tube(length,steps=4,sides=8){let a=[],ix=[],rings=length*steps+1;for(let j=0;j<rings;j++)for(let k=0;k<=sides;k++)a.push(j/steps,k/sides*Math.PI*2,1,0);for(let j=0;j<rings-1;j++)for(let k=0;k<sides;k++){let n=j*(sides+1)+k;ix.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}for(let end=0;end<2;end++){let start=a.length/4;for(let k=0;k<=sides;k++)a.push(end*length,k/sides*2*Math.PI,1,end?1:-1);let mid=a.length/4;a.push(end*length,0,0,end?1:-1);for(let k=0;k<sides;k++)ix.push(mid,start+k,start+k+1);}return mesh(a,ix,yarnProg,'aP',4);}
let naturalData,looseMesh;let carrierMesh,seams,edges,hairs,instances=[],fullInstances=[],rangeData=[[],[]],boundsCache=[[],[]],activeCounts=[0,0],cullKey='',instanceCounts=[0,0],brokenEnds=[],fiberCount=0;
function bindRangeVAO(m,buf,full=false){const vao=full?gl.createVertexArray():m.vao;if(full)m.fullVAO=vao;gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,m.vb);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,4,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ib);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(1,1);}
function attachRanges(m,kind){bindRangeVAO(m,instances[kind]);bindRangeVAO(m,fullInstances[kind],true);}
function createRanges(){for(const b of [...instances,...fullInstances])gl.deleteBuffer(b);instances=[];fullInstances=[];brokenEnds=[];graph.cuts=[];cullKey='';const writer=new Compact.Builder();
 naturalData=Natural.generate(C,graph,state.damage,state.fray,{onFiber:c=>writer.add(c)});fiberCount=writer.curves;hairs=writer.upload(gl);cachedNaturalAudit=Natural.audit(naturalData);naturalData.fibers=[];
 for(let kind=0;kind<2;kind++){const data=[],byId=new Map();for(const [start,end,id] of naturalData.spans[kind]){if(!byId.has(id))byId.set(id,[]);byId.get(id).push([start,end]);for(let base=Math.floor(start/16)*16;base<end;base+=16){const lo=Math.max(start,base),hi=Math.min(end,base+16);data.push(lo,hi,id,(lo===start?1:0)+(hi===end?2:0));}}
  for(let id=0;id<(kind?graph.ny:graph.nx);id++)graph.cuts.push({family:kind?'weft':'warp',index:id,spans:byId.get(id)||[]});
  rangeData[kind]=new Float32Array(data);instanceCounts[kind]=data.length/4;activeCounts[kind]=instanceCounts[kind];
  for(const list of [instances,fullInstances]){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,rangeData[kind],gl.DYNAMIC_DRAW);list.push(b);}
 }
 brokenEnds=naturalData.released.filter(r=>r.type==='tail');
}
function selectVisible(vp){const key=[buildSerial,state.shape,state.structure,...vp,state.qaNoCull].join('|');if(key===cullKey)return;cullKey=key;Compact.selectVisible(gl,hairs,graph,state,vp,Budget);
 for(let kind=0;kind<2;kind++){const all=rangeData[kind],out=new Float32Array(all.length);let n=0;for(let i=0;i<all.length;i+=4){const r=all.subarray(i,i+4),b=Budget.bounds(r,kind,graph,state);if(state.qaNoCull||Budget.sphereVisible(vp,b.center,b.radius)){out.set(r,n);n+=4;}}activeCounts[kind]=n/4;gl.bindBuffer(gl.ARRAY_BUFFER,instances[kind]);gl.bufferSubData(gl.ARRAY_BUFFER,0,out.subarray(0,n));}
}
function build(){mainMeshes.forEach(destroy);mainMeshes=[];destroy(carrierMesh);destroy(seams);destroy(edges);destroy(hairs);destroy(looseMesh);buildSerial++;geometryBuilds++;graph=C.compile({compact:true,weave:state.weave,thickness:state.thickness,slub:state.slub,cotton:state.cotton});createRanges();
 for(const [step,sides] of [[2,8],[4,16],[2,4]]){for(let kind=0;kind<2;kind++){let m=tube(16,step,sides);attachRanges(m,kind);mainMeshes.push(m);}}
 let a=[],ix=[],w=graph.p.width,h=graph.p.height,nx=100,ny=96;for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++)a.push((x/nx-.5)*w,(y/ny-.5)*h);for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){let k=y*(nx+1)+x;ix.push(k,k+1,k+nx+1,k+1,k+nx+2,k+nx+1);}carrierMesh=mesh(a,ix,surfProg,'aM',2);
buildSeam();edges=null;
 const ld=Natural.tubeMesh(naturalData.tubes);looseMesh=mesh(ld.vertices,ld.indices,looseProg,'aP',3,12);
 gl.bindVertexArray(looseMesh.vao);gl.bindBuffer(gl.ARRAY_BUFFER,looseMesh.vb);for(const [name,off] of [['aNormal',3],['aTangent',6],['aInfo',9]]){let at=gl.getAttribLocation(looseProg,name);if(at>=0){gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,3,gl.FLOAT,false,48,off*4);}}
 gl.bindVertexArray(null);bakeDirty=true;updateText();request();}
function buildSeam(){destroy(seams);const d=Stitch.generate(graph,state,Natural);stitchStats=d.stats;seams=mesh(d.vertices,d.indices,seamProg,'aM',3,11);gl.bindVertexArray(seams.vao);gl.bindBuffer(gl.ARRAY_BUFFER,seams.vb);for(const [name,size,offset] of [['aNormal',3,3],['aTangent',3,6],['aUV',2,9]]){const a=gl.getAttribLocation(seamProg,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,44,offset*4);}gl.bindVertexArray(null);}
function uniforms(p,vp,cam,flat=0,bakeMode=0){gl.useProgram(p);gl.uniform4fv(U(p,'uSize'),[graph.p.width,graph.p.height,graph.p.warpPitch,graph.p.weftPitch]);gl.uniform4fv(U(p,'uParam'),[graph.lift,graph.rz,state.thickness*.5,0]);ui(p,'uDraftBits',graph.d.cells.reduce((b,v,i)=>b|(v<<i),0));ui(p,'uRepeat',graph.d.width);ui(p,'uShape',state.shape);ui(p,'uFlat',flat);ui(p,'uSeam',state.seam?1:0);uf(p,'uStitchPitch',graph.p.warpPitch*state.stitchCells);uf(p,'uThreadRadius',state.threadDiameter*.5);uf(p,'uCotton',state.cotton);uf(p,'uStaple',state.staple);uf(p,'uNap',state.nap);uf(p,'uSlub',state.slub);uf(p,'uFray',flat?0:state.fray);ui(p,'uDamage',state.damage);uf(p,'uLongMorph',flat?0:longMorph);uf(p,'uSideMorph',flat?0:sideMorph);uf(p,'uTime',state.qaTime??clock);uf(p,'uWash',state.wash);uf(p,'uAbrasion',state.abrasion);uf(p,'uBackstain',state.backstain);uf(p,'uFuzz',state.fuzz);ui(p,'uBlack',({black:1,grey:1,ecru:2,indigoBlack:3,doubleIndigo:4,acid:5})[state.preset]||0);ui(p,'uLight',state.light);ui(p,'uAA',state.qaDisableFilter?0:1);ui(p,'uAudit',state.qaAudit?1:0);ui(p,'uBake',bakeMode);uf(p,'uFilterScale',state.qaDisableFilter?1:filterScale);uf(p,'uNearWeight',nearWeight);v3(p,'uCam',cam);mat(p,'uVP',vp);uf(p,'uScatter',state.scatter);uf(p,'uTransmit',state.transmission);uf(p,'uStructure',flat?0:state.structure);v3(p,'uDiffusionR',optics.reflectance);v3(p,'uDiffusionCenter',optics.weights[0]);shadowUniforms(p);}
function drawYarns(p,vp,cam,flat=0,bakeMode=0,high=false){uniforms(p,vp,cam,flat,bakeMode);for(let i=0;i<4;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,bakeMode?dummyTex:(baked[i]||dummyTex));ui(p,['uFrontCol','uFrontN','uBackCol','uBackN'][i],i);}gl.disable(gl.CULL_FACE);for(let kind=0;kind<2;kind++){ui(p,'uKind',kind);let m=mainMeshes[(flat?0:geomLevel*2)+kind];gl.bindVertexArray((flat||shadowDrawing)?m.fullVAO:m.vao);gl.drawElementsInstanced(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0,(flat||shadowDrawing)?instanceCounts[kind]:activeCounts[kind]);drawCount++;}}
function texture(w,h){let t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);let ext=gl.getExtension('EXT_texture_filter_anisotropic');if(ext)gl.texParameterf(gl.TEXTURE_2D,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));return t;}
let gpuFence=null,gpuWaits=0,bakeJob=null,bakeSize=1024;
function gpuAvailable(){if(!gpuFence)return true;const status=gl.clientWaitSync(gpuFence,0,0);
 if(status===gl.TIMEOUT_EXPIRED){gpuWaits++;return false;}
 gl.deleteSync(gpuFence);gpuFence=null;if(status===gl.WAIT_FAILED)throw Error('GPU completion fence failed');return true;}
function submitGpu(){if(gpuFence)gl.deleteSync(gpuFence);gpuFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();}
function bakeStep(){
 const key=[state.weave,state.thickness,state.slub,state.cotton,state.staple,state.damage,state.fray,state.wash,state.abrasion,state.backstain,state.preset,state.seam,state.stitchCells].join('|');
 if(bakeJob&&bakeJob.key!==key){bakeJob.maps.forEach(t=>gl.deleteTexture(t));Sampling.destroy(gl,bakeJob.target);bakeJob=null;}
 if(!bakeJob)bakeJob={key,index:0,maps:[],target:Sampling.target(gl,bakeSize,bakeSize,false,null,0)};
 const j=bakeJob,back=j.index<2?1:-1,mode=j.index%2+1,oldFilter=filterScale;filterScale=1;
 gl.bindFramebuffer(gl.FRAMEBUFFER,j.target.draw);gl.viewport(0,0,bakeSize,bakeSize);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);
 if(mode===2)gl.clearColor(.5,.5,back>0?1:0,1);else gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
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
${fragCommon}${shade}${Stitch.glsl}
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
 float cloud=n2(uv*vec2(1.6,1.1)+12.)*.6+n2(uv*3.+31.)*.4;
 c+=uFog*.018*(cloud-.5);
 c*=1.-.10*dot(uv*.55,uv*.55);
 O=vec4(tone(c),1.);
}`;
const studioProg=program(studioVS,studioFS);
let shadowFbo=null,shadowTex=null,shadowSize=0,shadowKey='',shadowDrawing=false,shadowDrawCalls=0,shadowTriangles=0;
let lightVP=new Float32Array(16),keyPos=[-90,115,125],keyColor=[2.4,2.34,2.22],fillColor=[.55,.64,.79];
let configuredLight=-1;function configureLights(){if(configuredLight===state.light)return;configuredLight=state.light;
 keyPos=[-90,115,125];keyColor=[2.4,2.34,2.22];fillColor=[.55,.64,.79];
 if(state.light===1){keyPos=[-135,55,35];keyColor=[3.0,2.64,2.20];fillColor=[.46,.56,.73];}
 if(state.light===2){keyPos=[-85,100,105];keyColor=[2.7,2.23,1.76];fillColor=[.48,.73,1.08];}
 if(state.light===4){keyPos=[-95,95,140];keyColor=[.55,.58,.65];fillColor=[.22,.23,.26];}
 if(state.light===3){keyPos=[-40,120,160];keyColor=[2.45,2.48,2.50];fillColor=[.82,.79,.72];}
 lightVP=mul(ortho(-130,130,-125,125,1,600),look(keyPos,[0,-8,0]));
}
function shadowUniforms(p){
 mat(p,'uLightVP',lightVP);v3(p,'uKeyPos',keyPos);v3(p,'uKeyColor',keyColor);v3(p,'uFillColor',fillColor);
 uf(p,'uExposure',state.exposure);ui(p,'uShadowPass',shadowDrawing?1:0);uf(p,'uShadowTexel',1/Math.max(1,shadowSize));
 gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,shadowDrawing?dummyTex:(shadowTex||dummyTex));ui(p,'uShadowMap',7);
}
function makeShadow(){
 configureLights();const size=innerWidth<750?768:1024;
 if(!shadowFbo){shadowSize=size;shadowFbo=gl.createFramebuffer();shadowTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,shadowTex);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,size,size,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,shadowTex,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
 if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Shadow FBO incomplete');}
 let key=[state.weave,state.thickness,state.slub,state.cotton,state.staple,state.damage,state.fray,state.shape,state.light,state.seam,state.stitchCells,state.threadDiameter,state.structure,state.quality==='reference'?(state.qaTime??clock):Math.floor((state.qaTime??clock)*15)/15].join('|');
 shadowDrawCalls=0;shadowTriangles=0;
 if(shadowKey===key){gl.bindFramebuffer(gl.FRAMEBUFFER,null);return;}
 shadowDrawing=true;const old=[geomLevel,longMorph,sideMorph,drawCount];geomLevel=0;longMorph=0;sideMorph=0;
 gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFbo);gl.viewport(0,0,shadowSize,shadowSize);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.clear(gl.DEPTH_BUFFER_BIT);
 drawYarns(depthProg,lightVP,keyPos);
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

let lod='';function render(time=0){pending=false;let start=performance.now();if(document.hidden||gl.isContextLost())return;if(!state.qaAudit&&!gpuAvailable()){request();return;}if(bakeDirty&&!state.qaAudit){bakeStep();return;}if(state.animate){if(last)clock+=Math.min((time-last)/1000,.20);last=time;}else last=0;timer.poll();timer.begin();
 let rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5),cw=Math.max(1,Math.round(rect.width*ratio)),ch=Math.max(1,Math.round(rect.height*ratio));if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
 if(!state.qaAudit)makeShadow();
 let {vp,eye,span,distance,projection}=camera(cw/ch),pixelsPerYarn=ch/span*graph.p.warpPitch,bodyPixels=ch/span*Math.max(graph.p.width,graph.p.height);
 let maxSS=state.quality==='reference'?2:2-.75*Sampling.smooth(1.5,3,pixelsPerYarn),ss=Math.max(1,Math.min(maxSS,Math.sqrt((rect.width<700?1100000:2000000)/(cw*ch))));target(Math.round(cw*ss),Math.round(ch*ss));selectVisible(vp);
 let far=Sampling.farWeight(pixelsPerYarn,bodyPixels,state.qaForceYarns||state.qaAudit),useMip=far===1;filterScale=ss;nearWeight=1-far;
 longMorph=1.-Sampling.smooth(4,6,pixelsPerYarn);sideMorph=pixelsPerYarn>4?1.-Sampling.smooth(4,8,pixelsPerYarn):0.;geomLevel=pixelsPerYarn>4?1:0;
 if(state.qaAudit){longMorph=0;geomLevel=1;}
 lod=useMip?'远景 · 同源像素积分':far>0?'远近连续过渡':geomLevel===1?'实体纱线 · 近景':'实体纱线 · 稳定采样';drawCount=0;
 function scene(mip){gl.bindFramebuffer(gl.FRAMEBUFFER,screenFbo);gl.viewport(0,0,screenW,screenH);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.clearColor(.071,.077,.084,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  if(!state.qaAudit)drawStudio(eye,cw/ch);
  if(mip){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   for(let side=0;side<2;side++){uniforms(surfProg,vp,eye);uf(surfProg,'uBack',side===0?1:-1);
    for(let i=0;i<2;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,baked[side*2+i]);ui(surfProg,i?'uNormalMap':'uMap',i);}
    gl.bindVertexArray(carrierMesh.vao);gl.drawElements(gl.TRIANGLES,carrierMesh.count,gl.UNSIGNED_INT,0);drawCount++;
   }gl.disable(gl.BLEND);
  }else drawYarns(yarnProg,vp,eye);
  if(!state.qaAudit&&looseMesh){uniforms(looseProg,vp,eye);gl.bindVertexArray(looseMesh.vao);gl.drawElements(gl.TRIANGLES,looseMesh.count,gl.UNSIGNED_INT,0);drawCount++;}
  if(state.seam){uniforms(seamProg,vp,eye);ui(seamProg,'uEdge',0);gl.bindVertexArray(seams.vao);gl.drawElements(gl.TRIANGLES,seams.count,gl.UNSIGNED_INT,0);drawCount++;}
  if(state.fuzz>.01){uniforms(hairProg,vp,eye);uf(hairProg,'uMmPerPixel',span/ch);uf(hairProg,'uFocusDistance',distance);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.activeTexture(gl.TEXTURE8);gl.bindTexture(gl.TEXTURE_2D,hairs.textures[0]);ui(hairProg,'uFiberPosition',8);gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_2D,hairs.textures[1]);ui(hairProg,'uFiberMeta',9);gl.bindVertexArray(hairs.vao);if(hairs.indexBuffer)gl.drawElements(gl.TRIANGLE_STRIP,hairs.indexCount,gl.UNSIGNED_INT,0);else gl.drawArrays(gl.TRIANGLE_STRIP,0,hairs.drawVertices);gl.depthMask(true);gl.disable(gl.BLEND);drawCount++;}
 }
 if(far>0&&far<1){scene(true);saveFarFrame();}else if(farTexture){gl.deleteTexture(farTexture);farTexture=null;}
 scene(useMip);Sampling.resolve(gl,screen);
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,cw,ch);gl.disable(gl.DEPTH_TEST);gl.useProgram(blit);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,screenColor);ui(blit,'im',0);gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,farTexture||dummyTex);ui(blit,'farIm',6);uf(blit,'farBlend',farTexture?far:0);gl.uniform2f(U(blit,'outputSize'),cw,ch);uf(blit,'exposure',state.exposure);ui(blit,'audit',state.qaAudit?1:0);gl.bindVertexArray(emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3);drawCount++;frame++;
 if(performance.now()-lastHud>250){$('status').textContent=`${graph.curves.length} 根纱线 · ${state.thickness.toFixed(2)} mm · ${lod}`;lastHud=performance.now();updateBudgetHUD();}
 window.__DENIM_WORKBENCH__.lastFrame={frame,drawCalls:drawCount,lod,pixelsPerYarn,nearWeight,farWeight:far,bodyPixels,bakeSize,sparseEdgeFibers:fiberCount,projection,distanceMm:distance,studio:{background:'gray-studio-planes',fog:state.fog,exposure:state.exposure,shadowSize,shadowDrawCalls,shadowTriangles,backgroundOnlyFog:true},colorPipeline:hdr?'linear-RGBA16F-single-tonemap':'linear-RGBA8-single-tonemap',sampling:{msaaSamples:screen.samples,supersampleRatio:ss,outputIntegration:'4x4 linear pixel footprint',temporalHistory:false,gpuQueueLimit:1,gpuWaitPolls:gpuWaits,attributeCapturePassesPerBatch:1,attachmentBytes:screen.attachmentBytes+(farTexture?screenW*screenH*(hdr?8:4):0),note:'attachments only; excludes geometry, mipmaps, driver and browser memory'},scatter:{strength:state.scatter,transmission:state.transmission,kernel:optics.reflectance},geometryBufferBytes:[...mainMeshes,carrierMesh,seams,looseMesh,hairs].reduce((a,m)=>a+(m?.bufferBytes||0),0)+instanceCounts.reduce((a,n)=>a+n*16,0),closeSurface:{cotton:state.cotton,staple:state.staple,nap:state.nap,angularLanes:64,finiteStaples:true},structureWarp:state.structure,solidEdgeDrawn:false,geometryOnly:far===0,longMorph,sideMorph,geomLevel,natural:cachedNaturalAudit,looseTriangles:looseMesh.count/3,brokenEnds:brokenEnds.length,instanceCounts:[...instanceCounts],activeInstances:[...activeCounts],renderTarget:[screenW,screenH],cpuSubmitMs:performance.now()-start,triangles:(useMip?(carrierMesh.count*2)/3:(mainMeshes[geomLevel*2].count*activeCounts[0]+mainMeshes[geomLevel*2+1].count*activeCounts[1])/3)+(!state.qaAudit&&looseMesh?looseMesh.count/3:0)+(state.seam?seams.count/3:0)+(state.fuzz>.01?hairs.visibleSegments*2:0),transitionDoublePass:far>0&&far<1};window.__DENIM_WORKBENCH__.lastFrame.budget=budget();timer.end();submitGpu();renderDeadline=start+(state.animate?1000/state.frameLimit:0);if(state.animate)request();
}
let scheduledTimer=null,scheduledFrame=null;function request(){if(!pending&&!document.hidden){pending=true;const delay=state.animate?Math.max(0,renderDeadline-performance.now()):0;const next=()=>{scheduledTimer=null;scheduledFrame=requestAnimationFrame(render);};if(delay>1)scheduledTimer=setTimeout(next,delay);else next();}}
function recipe(){const keys=['preset','weave','cotton','staple','nap','thickness','slub','wash','abrasion','backstain','fuzz','damage','fray','scatter','transmission','structure','seam','stitchCells','threadDiameter'];return {schema:'kaopu.denim_recipe@1.0',generator:'R09.0',units:'mm',seed:23,parameters:Object.fromEntries(keys.map(k=>[k,state[k]])),engineShared:true,physics:'analytic-view-deformation-not-cloth-solver'};}
function restoreRecipe(r){if(r?.schema!=='kaopu.denim_recipe@1.0'||r.generator!=='R09.0')throw Error('Unsupported recipe');const p=r.parameters,limits={weave:[0,3],cotton:[0,1],staple:[0,1],nap:[0,1],thickness:[.45,1.05],slub:[0,1],wash:[0,1],abrasion:[0,1],backstain:[0,1],fuzz:[0,1],damage:[0,4],fray:[.3,2.5],scatter:[0,1],transmission:[0,1],structure:[0,1],stitchCells:[4,10],threadDiameter:[.06,.18]};if(!p||!presets[p.preset]||typeof p.seam!=='boolean')throw Error('Invalid recipe fields');for(const [k,[a,b]] of Object.entries(limits))if(!Number.isFinite(p[k])||p[k]<a||p[k]>b||(['weave','damage','stitchCells'].includes(k)&&!Number.isInteger(p[k])))throw Error('Invalid '+k);Object.assign(state,Object.fromEntries(Object.keys(recipe().parameters).map(k=>[k,p[k]])));build();}
function budget(){const geom=(hairs?.indexBytes||0)+[...mainMeshes,carrierMesh,seams,looseMesh].reduce((n,m)=>n+(m?.bufferBytes||0),0)+instanceCounts.reduce((a,n)=>a+n*32,0),fiber=hairs?.textureBytes||0,maps=baked.length*bakeSize*bakeSize*4*4/3,shadow=shadowSize*shadowSize*4,screenBytes=(screen?.attachmentBytes||0)+(farTexture?screenW*screenH*(hdr?8:4):0);return {geometryBuffers:geom,compactFiberTextures:fiber,derivedMaterialMaps:Math.round(maps),shadowTexture:shadow,renderTargets:screenBytes,trackedGpuBytes:geom+fiber+Math.round(maps)+shadow+screenBytes,transientBakeBytes:bakeJob?bakeJob.target.attachmentBytes+bakeJob.maps.length*bakeSize*bakeSize*4*4/3:0,jsHeapUsed:performance.memory?.usedJSHeapSize??null,jsHeapMeaning:'browser estimate; not exclusive application ownership',fiberStagingPeak:hairs?.peakTypedStagingBytes||0,retainedDenseFiberPoints:0,fiberVisibilityMetadataBytes:(hairs?.records?.byteLength||0)+(hairs?.worldBounds?.byteLength||0),visibleFiberCurves:hairs?.visibleCurves,retainedYarnPoints:0,frameLimit:state.frameLimit,shadowHz:state.quality==='reference'?'per frame':15,quality:state.quality,contextAttributes,cpuSubmitMs:window.__DENIM_WORKBENCH__?.lastFrame?.cpuSubmitMs??null,gpuTimerMs:timer.lastMs,gpuTimerSamples:timer.samples,gpuTimerAvailable:!!timer.ext,gpuDisjoint:timer.disjoint,geometryBuilds,recipeBytes:new TextEncoder().encode(JSON.stringify(recipe())).length,stitch:stitchStats,fiberEncoding:{curves:hairs?.curves,points:hairs?.storedPoints,maxTangentVectorError:hairs?.maxTangentError,maxLifeError:hairs?.maxLifeError},notIncluded:'driver/browser backing stores, framebuffer padding, other tabs and temporary JS allocations; no OS percentage claim',motion:'analytic shader deformation; no physical cloth solver'};}
function updateBudgetHUD(){if(!$('budgetReadout'))return;const b=budget(),mb=n=>(n/1048576).toFixed(1);$('budgetReadout').textContent=`已登记 GPU 资源 ${mb(b.trackedGpuBytes)} MiB\n几何 ${mb(b.geometryBuffers)} · 纤维 ${mb(b.compactFiberTextures)}\n材质 ${mb(b.derivedMaterialMaps)} · 阴影 ${mb(b.shadowTexture)}\n渲染目标 ${mb(b.renderTargets)} MiB\n材质配方 ${b.recipeBytes} B · 摆动上限 ${b.frameLimit} 帧/秒\nCPU提交 ${b.cpuSubmitMs?.toFixed(2)??'—'} ms · GPU计时 ${b.gpuTimerMs?.toFixed(2)??'不可用'} ms`;}
function profile(){return {schema:'kaopu.denim_material_profile@2.6',version:'R09.0',graph:{...graph.p,slub:state.slub,units:'millimeter',draft:graph.d,warpCount:graph.nx,weftCount:graph.ny},finish:{recipe:state.preset,wash:state.wash,abrasion:state.abrasion,backstain:state.backstain},surface:{fuzz:state.fuzz,fray:state.fray,cotton:state.cotton,staple:state.staple,nap:state.nap},damage:{kind:state.damage,cuts:graph.cuts,released:naturalData.tubes.filter(c=>c.type!=='edge').map(c=>({type:c.type,family:c.kind?'weft':'warp',id:c.id,parents:c.parents,group:c.group,radiusMm:c.radius,points:c.points})),clumps:naturalData.groups,physicalSimulation:false},display:{shape:state.shape,light:state.light,seam:state.seam,studio:{background:'gray-studio-planes',fog:state.fog,exposure:state.exposure}},fiberModel:{structureWarp:state.structure,diffusion:optics,scatterStrength:state.scatter,transmissionStrength:state.transmission,body:'finite staggered staples in periodic angular yarn coordinates; differential cross-section normal',cottonModel:'art-directed candidate, not CT-fitted',sheen:'broad cloth lobe',scatter:'Jensen radial kernel quadrature plus finite-depth single transmission; local real-time approximation, not full calibrated BSSRDF',ribbons:'perspective-correct Gaussian pixel convolution; integral-preserving opacity',sampling:'offscreen MSAA + linear pixel integration + continuous extreme-distance same-graph LOD; no temporal accumulation'},limits:{physicalCalibration:false,clothSolver:false,individualCottonFibers:false,filmGradeValidated:false},sources:{r01:'f64eb3aaaedec738ae3d73661ea967713ede8e39',weaveCompiler:'49b9c0aae2c74f41b0444e5c5449b3c339608a4a'}};}
function updateText(){$('quality').value=state.quality;$('frameLimit').value=state.frameLimit;for(const k of ['stitchCells','threadDiameter']){$(k).value=state[k];$(k+'Val').textContent=k==='stitchCells'?(state[k]*.42).toFixed(2)+' mm':state[k].toFixed(3)+' mm';}for(let k of ['wash','abrasion','backstain','slub','thickness','fuzz']){$(k).value=state[k];$(k+'Val').textContent=k==='thickness'?state[k].toFixed(2)+' mm':Math.round(state[k]*100)+'%';}document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===state.preset));$('selected').textContent=presets[state.preset].label;$('weave').value=state.weave;$('shape').value=state.shape;$('light').value=state.light;$('damage').value=state.damage;$('fray').value=state.fray;$('frayVal').textContent=state.fray.toFixed(1)+'×';$('seam').checked=state.seam;for(const key of ['exposure','fog','scatter','transmission','cotton','staple','nap']){$(key).value=state[key];$(key+'Val').textContent=state[key].toFixed(2);}}
for(const key of ['cotton','staple','nap'])$(key).oninput=e=>{
 state[key]=+e.target.value;$(key+'Val').textContent=state[key].toFixed(2);clearTimeout(bakeTimer);
 if(key==='cotton')bakeTimer=setTimeout(build,120);
 else if(key==='staple'){bakeDirty=true;request();}else request();
};
let bakeTimer;for(let k of ['wash','abrasion','backstain','slub','thickness','fuzz'])$(k).oninput=e=>{state[k]=Number(e.target.value);updateText();clearTimeout(bakeTimer);if(k==='thickness'||k==='slub'){bakeTimer=setTimeout(build,120);}else if(k==='fuzz'){request();}else{request();bakeTimer=setTimeout(()=>{bakeDirty=true;request();},100);}};
for(let k of ['weave','shape','light'])$(k).onchange=e=>{state[k]=+e.target.value;if(k==='weave')build();else request();};document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const previousSlub=state.slub;Object.assign(state,presets[b.dataset.preset],{preset:b.dataset.preset});updateText();if(previousSlub!==state.slub)build();else{bakeDirty=true;request();}});$('seam').onchange=e=>{state.seam=e.target.checked;bakeDirty=true;request();};$('wind').onclick=()=>{state.animate=!state.animate;$('wind').textContent=state.animate?'暂停形变预览':'轻微形变预览';request();};
$('front').onclick=()=>{state.yaw=0;state.pitch=.08;state.zoom=1;state.panX=0;state.panY=0;request();};$('back').onclick=()=>{state.yaw=Math.PI;state.pitch=.10;state.zoom=1;state.panX=0;state.panY=0;request();};$('angle').onclick=()=>{state.yaw=-.50;state.pitch=.64;state.zoom=1.30;state.panY=-12;request();};$('reset').onclick=()=>{state.yaw=-.23;state.pitch=.34;state.zoom=1;state.panX=0;state.panY=0;request();};$('detail').onclick=()=>{state.zoom=5.2;state.panX=3;state.panY=-4;request();};$('full').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else $('stage').requestFullscreen?.();};
$('save').onclick=()=>{let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(profile(),null,2)],{type:'application/json'}));a.download='KAOPU_Denim_R09_Profile.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);};
let dragging=false,oldX=0,oldY=0;canvas.onpointerdown=e=>{dragging=true;oldX=e.clientX;oldY=e.clientY;canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!dragging)return;if(e.shiftKey||e.buttons===2){state.panX-=(e.clientX-oldX)*.10/state.zoom;state.panY+=(e.clientY-oldY)*.10/state.zoom;}else{state.yaw+=(e.clientX-oldX)*.007;state.pitch=Math.max(-1.35,Math.min(1.35,state.pitch+(e.clientY-oldY)*.006));}oldX=e.clientX;oldY=e.clientY;request();};canvas.oncontextmenu=e=>e.preventDefault();canvas.onpointerup=canvas.onpointercancel=()=>dragging=false;canvas.onwheel=e=>{e.preventDefault();state.zoom=Math.max(.10,Math.min(6.,state.zoom*Math.exp(-e.deltaY*.001)));request();};
function auditGPU(){const saved={...state};Object.assign(state,{qaAudit:true,structure:0,qaForceYarns:true,shape:0,yaw:0,pitch:0,zoom:1,panX:0,panY:0,seam:false,fuzz:0,animate:false,qaPanX:0});render(0);gl.finish();const w=canvas.width,h=canvas.height,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const {vp}=camera(w/h);let checked=0,wrong=0,ambiguous=0,examples=[];for(let y=0;y<graph.ny;y++)for(let x=0;x<graph.nx;x++){const mx=(x+.5)*graph.p.warpPitch-graph.p.width/2,my=(y+.5)*graph.p.weftPitch-graph.p.height/2,px=Math.floor((vp[0]*mx+vp[4]*my+vp[12]+1)*w*.5),py=Math.floor((vp[1]*mx+vp[5]*my+vp[13]+1)*h*.5);if(px<0||px>=w||py<0||py>=h)continue;const i=(py*w+px)*4,red=pixels[i],green=pixels[i+1],expected=graph.d.cells[(y%graph.d.height)*graph.d.width+x%graph.d.width];checked++;if(Math.abs(red-green)<12)ambiguous++;if((red>green)!==!!expected){wrong++;if(examples.length<12)examples.push({x,y,red,green,expected});}}
Object.assign(state,saved);state.qaAudit=!!saved.qaAudit;state.qaForceYarns=!!saved.qaForceYarns;request();return {checked,wrong,ambiguous,examples,method:'actual depth-tested warp/weft raster at crossing centers, flat carrier; not a global self-collision proof'};}
$('farReview').onclick=()=>{state.zoom=.22;state.panX=0;state.panY=0;request();};
$('rimReview').onclick=()=>{state.light=4;state.zoom=1.45;state.yaw=-.3;state.pitch=.18;state.panX=4;state.panY=-1;updateText();request();};
$('showFray').onclick=()=>{Object.assign(state,presets.vintage,{preset:'vintage',damage:4,shape:1,seam:false,zoom:1.4,yaw:-.17,pitch:.20,panX:4,panY:-1});build();};
$('damage').onchange=e=>{state.damage=+e.target.value;build();};$('fray').oninput=e=>{state.fray=+e.target.value;$('frayVal').textContent=state.fray.toFixed(1)+'×';clearTimeout(bakeTimer);bakeTimer=setTimeout(build,120);};new ResizeObserver(request).observe(canvas);document.addEventListener('visibilitychange',()=>{clearTimeout(scheduledTimer);cancelAnimationFrame(scheduledFrame);scheduledTimer=scheduledFrame=null;pending=false;last=0;if(!document.hidden)request();});for(const key of ['exposure','fog','scatter','transmission'])$(key).oninput=e=>{state[key]=+e.target.value;$(key+'Val').textContent=state[key].toFixed(2);request();};
$('quality').onchange=e=>{state.quality=e.target.value;request();};$('frameLimit').onchange=e=>{state.frameLimit=+e.target.value;request();};
for(const key of ['stitchCells','threadDiameter'])$(key).oninput=e=>{state[key]=+e.target.value;$(key+'Val').textContent=key==='stitchCells'?(state[key]*graph.p.warpPitch).toFixed(2)+' mm':state[key].toFixed(3)+' mm';clearTimeout(bakeTimer);bakeTimer=setTimeout(()=>{buildSeam();bakeDirty=true;request();},100);};
$('seamNear').onclick=()=>{state.seam=true;state.zoom=5.2;state.panX=0;state.panY=-graph.p.height/2+13.4;state.yaw=-.14;state.pitch=.22;bakeDirty=true;updateText();request();};$('seamBack').onclick=()=>{state.seam=true;state.zoom=5.2;state.panX=0;state.panY=-graph.p.height/2+13.4;state.yaw=Math.PI;state.pitch=.10;bakeDirty=true;updateText();request();};
$('saveRecipe').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(recipe())],{type:'application/json'}));a.href=url;a.download='KAOPU_Denim_R09_Recipe.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};$('loadRecipe').onchange=async e=>{try{restoreRecipe(JSON.parse(await e.target.files[0].text()));}catch(err){$('recipeError').textContent=err.message;}e.target.value='';};
window.__DENIM_WORKBENCH__={ready:false,version:'R09.0',renderer:'WebGL2',profile,naturalAudit:()=>cachedNaturalAudit,getNatural:()=>Natural.generate(C,graph,state.damage,state.fray),audit:()=>C.audit(graph),state,setState:patch=>{const geom=['weave','thickness','slub','cotton','damage','fray'].some(k=>k in patch&&patch[k]!==state[k]),finish=['wash','abrasion','backstain','slub','cotton','staple','preset','seam','stitchCells'].some(k=>k in patch&&patch[k]!==state[k]);Object.assign(state,patch);if('stitchCells' in patch||'threadDiameter' in patch)buildSeam();updateText();if(geom)build();else if(finish){bakeDirty=true;request();}else request();},renderNow:()=>render(0),lastFrame:null,networkAssets:0,getGLError:()=>gl.isContextLost()?37442:gl.getError(),benchmark:()=>{gl.finish();let t=performance.now();render(0);gl.finish();return performance.now()-t;},getOptics:()=>optics,getBudget:budget,recipe,restoreRecipe,getGraph:()=>graph,projectPoint:p=>{let v=camera(canvas.width/canvas.height).vp,q=[0,0,0,0];for(let r=0;r<4;r++)q[r]=v[r]*p[0]+v[r+4]*p[1]+v[r+8]*p[2]+v[r+12];return [(q[0]/q[3]*.5+.5)*canvas.width,(q[1]/q[3]*.5+.5)*canvas.height];},auditGPU,samplePatch:()=>{gl.finish();let w=160,h=160,p=new Uint8Array(w*h*4);gl.readPixels(Math.floor((canvas.width-w)/2),Math.floor((canvas.height-h)/2),w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p);}};build();window.__DENIM_WORKBENCH__.ready=true;
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();state.animate=false;window.__DENIM_WORKBENCH__.ready=false;window.__DENIM_WORKBENCH__.contextLost=true;$('error').hidden=false;$('error').textContent='图形上下文已丢失，请重新载入页面。此状态不属于有效渲染。';});
})();
