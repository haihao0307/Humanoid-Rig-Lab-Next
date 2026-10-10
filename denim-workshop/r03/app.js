/* R03.0 — actual continuous warp/weft geometry, physically sized in mm.
   Shape is an art-directed carrier, NOT a cloth dynamics solver.
   Far LOD is a prefiltered capture of this same YarnGraph, not an unrelated image. */
(()=>{'use strict';const $=s=>document.getElementById(s),C=KAOPUDenimCore,canvas=$('view');
const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});if(!gl){$('error').hidden=false;$('error').textContent='需要支持 WebGL2 的浏览器。';return;}
let state={preset:'rinse',weave:0,thickness:.70,slub:.38,wash:.23,abrasion:.24,backstain:.08,fuzz:.55,damage:0,fray:1,panX:0,panY:0,shape:1,light:0,seam:true,animate:false,yaw:-.23,pitch:.34,zoom:1},graph,mainMeshes=[],fuzzMesh,baked=[],pending=false,frame=0,last=0,clock=0,drawCount=0;
const presets={raw:{label:'01 · 原色靛蓝',wash:0,abrasion:.02,backstain:0,slub:.25},rinse:{label:'02 · 轻水洗',wash:.23,abrasion:.24,backstain:.08,slub:.25},vintage:{label:'03 · 复古石洗',wash:.52,abrasion:.65,backstain:.14,slub:.32},bleach:{label:'04 · 浅蓝漂洗',wash:.81,abrasion:.38,backstain:.04,slub:.20},slubby:{label:'05 · 竹节原色',wash:.16,abrasion:.36,backstain:.05,slub:.85},black:{label:'06 · 黑色水洗',wash:.28,abrasion:.45,backstain:.07,slub:.25}};
Object.assign(presets,{
 grey:{label:'07 · 烟灰洗旧',wash:.50,abrasion:.65,backstain:.08,slub:.38},
 ecru:{label:'08 · 本白牛仔',wash:.08,abrasion:.15,backstain:0,slub:.38},
 indigoBlack:{label:'09 · 蓝经黑纬',wash:.20,abrasion:.35,backstain:.06,slub:.40},
 doubleIndigo:{label:'10 · 双靛蓝',wash:.18,abrasion:.25,backstain:0,slub:.35},
 enzyme:{label:'11 · 柔化洗旧',wash:.46,abrasion:.40,backstain:.15,slub:.35},
 acid:{label:'12 · 云斑洗旧',wash:.64,abrasion:.84,backstain:.05,slub:.35}
});
const common=`
precision highp float;precision highp int;
uniform vec4 uSize;uniform vec4 uParam;uniform int uDraftBits;uniform int uRepeat;uniform int uKind;uniform int uShape;uniform float uTime;uniform float uSlub;uniform float uFray;uniform int uDamage;uniform float uLongMorph;uniform float uSideMorph;uniform int uRangeBase;
float hash(float x){return fract(sin(x*127.1+13.7)*43758.5453);}float noise1(float x){float a=floor(x),f=fract(x);return mix(hash(a),hash(a+1.),f*f*(3.-2.*f));}
float cell(int x,int y){int xx=uRepeat==4?(x&3):((x%3+3)%3),yy=uRepeat==4?(y&3):((y%3+3)%3);return float((uDraftBits>>(yy*uRepeat+xx))&1);}
float liftAt(float t,int id,int kind){float q=t-.5;int a=int(floor(q));float f=fract(q);float x=kind==0?cell(id,a):1.-cell(a,id);float y=kind==0?cell(id,a+1):1.-cell(a+1,id);return (mix(x,y,f*f*(3.-2.*f))*2.-1.)*uParam.x;}
vec3 carrier(vec2 m){float x=m.x,y=m.y,z=0.;if(uShape==1){float a=(x+9.+.20*y)/11.;float b=(x-24.-.08*y)/18.;z=9.*exp(-a*a)+3.*exp(-b*b)+.014*y;z+=.5*sin(y*.065+x*.032);}
if(uShape==2){float yy=y+uSize.y*.5;if(yy<10.){float t=(10.-yy)/10.*3.02;float r=10./3.02;y=-uSize.y*.5+10.-r*sin(t);z=r*(1.-cos(t));}z+=.8*exp(-pow((x+11.)/22.,2.));}
if(uShape==3){z=3.*sin(x*.073+.20)*(.55+.45*(.5-y/uSize.y));z+=1.1*sin(x*.137+1.1)*(.5-y/uSize.y);}
z+=uTime==0.?0.:sin(y*.065+x*.035+uTime)*.55*(.5-y/uSize.y);return vec3(x,y,z);}
mat3 basis(vec2 m){float x=m.x,y=m.y,zx=0.,zy=0.,yy=1.;
if(uShape==1){float a=(x+9.+.20*y)/11.,b=(x-24.-.08*y)/18.;float ea=exp(-a*a),eb=exp(-b*b),c=cos(y*.065+x*.032);zx=-18.*a*ea/11.-6.*b*eb/18.+.016*c;zy=-3.6*a*ea/11.+.48*b*eb/18.+.014+.0325*c;}
if(uShape==2){float ay=y+uSize.y*.5;if(ay<10.){float t=(10.-ay)*.302;yy=cos(t);zy=-sin(t);}float ax=(x+11.)/22.;zx=-1.6*ax*exp(-ax*ax)/22.;}
if(uShape==3){float q=.5-y/uSize.y;zx=.219*cos(x*.073+.20)*(.55+.45*q)+.1507*cos(x*.137+1.1)*q;zy=-(1.35*sin(x*.073+.20)+1.1*sin(x*.137+1.1))/uSize.y;}
if(uTime!=0.){float a=y*.065+x*.035+uTime,q=.5-y/uSize.y;zx+=.01925*cos(a)*q;zy+=.55*(.065*cos(a)*q-sin(a)/uSize.y);}
vec3 dx=vec3(1,0,zx),dy=vec3(0,yy,zy);return mat3(dx,dy,normalize(cross(dx,dy)));}
`;
const vs=`#version 300 es
${common}
in vec4 aP;in vec4 aRange;uniform mat4 uVP;uniform int uFlat;out vec3 vN;out vec3 vW;out vec3 vT;out vec3 vMacro;out vec2 vM;out vec2 vLocal;out float vCrown;out float vId;out vec3 vWarp;flat out int vKind;
vec3 yarnSection(float t,float theta,int id,float scale){
 float pitch=uKind==0?uSize.w:uSize.z;
 float ph=float(id)+float(uKind)*79.;
 float bulge=noise1(t*.10+ph*19.31);
 float irregular=1.+uSlub*(.13*(hash(ph)*2.-1.)+.16*(bulge-.5));
 float ra=(uKind==0?uSize.z*.49:uSize.w*.30)*clamp(irregular,.79,1.03);
 float rz=uParam.y*(uKind==0?1.:.68)*(1.+uSlub*.08*(bulge-.5));
 float h=liftAt(t,id,uKind)-(uKind==1?uParam.y*.18:0.);
 float deriv=(liftAt(t+.008,id,uKind)-liftAt(t-.008,id,uKind))/(.016*pitch);
 vec3 T=normalize(uKind==0?vec3(0,1,deriv):vec3(1,0,deriv));
 vec3 B=uKind==0?vec3(1,0,0):vec3(0,1,0),N=normalize(uKind==0?cross(B,T):cross(T,B));
 vec2 m=uKind==0?vec2((float(id)+.5)*uSize.z-uSize.x*.5,t*uSize.w-uSize.y*.5):vec2(t*uSize.z-uSize.x*.5,(float(id)+.5)*uSize.w-uSize.y*.5);
 float q=theta/1.57079632679,k=floor(q),f=fract(q);
 vec2 circle=vec2(cos(theta),sin(theta));vec2 poly=mix(vec2(cos(k*1.57079632679),sin(k*1.57079632679)),vec2(cos((k+1.)*1.57079632679),sin((k+1.)*1.57079632679)),f);
 vec2 cs=mix(circle,poly,uSideMorph);
 vec3 delta=B*ra*cs.x*scale+N*rz*cs.y*scale;
 // Moving micro-wobble vanishes exactly at every crossing center.
 float wobble=.013*uSlub*sin(6.2831853*(t-.5))*sin(t*.21+ph);
 m+=B.xy*wobble;
 return vec3(m,h)+delta;
}
void main(){int id=int(aRange.z+.5);float t=clamp(aP.x,aRange.x,aRange.y);if(abs(aP.w)>.5)t=aP.w<0.?aRange.x:aRange.y;float theta=aP.y;
 vec3 local=yarnSection(t,theta,id,aP.z);
 float low=floor(t*2.)*.5;float high=min(low+.5,aRange.y);low=max(low,aRange.x);
 if(uLongMorph>.0001 && fract(t*2.)>.0001 && high>low+.00001)local=mix(local,mix(yarnSection(low,theta,id,aP.z),yarnSection(high,theta,id,aP.z),(t-low)/(high-low)),uLongMorph);
 float full=uKind==0?uSize.y/uSize.w:uSize.x/uSize.z;
 float edge=exp(-t*1.8)+exp(-(full-t)*1.8);float ph=float(id)*1.31+float(uKind)*79.;
 float signEnd=t<full*.5?-1.:1.;float len=uFray*(.07+.75*pow(hash(ph+47.),3.));
 local.xy+=(uKind==0?vec2(.25*sin(t+ph),signEnd):vec2(signEnd,.25*sin(t+ph)))*edge*len;
 local.z+=edge*.15*uFray*sin(ph+t);
 float pitch=uKind==0?uSize.w:uSize.z;float deriv=(liftAt(t+.01,id,uKind)-liftAt(t-.01,id,uKind))/(.02*pitch);vec3 tangent=normalize(uKind==0?vec3(0,1,deriv):vec3(1,0,deriv));
 vec3 B=uKind==0?vec3(1,0,0):vec3(0,1,0),N0=normalize(uKind==0?cross(B,tangent):cross(tangent,B));
 float ra=(uKind==0?uSize.z*.49:uSize.w*.30);vec3 normal=normalize(B*(cos(theta)/ra)+N0*(sin(theta)/uParam.y));if(abs(aP.w)>.5)normal=tangent*aP.w;
 vec2 m=local.xy;mat3 mat=uFlat==1?mat3(1):basis(m);vec3 base=uFlat==1?vec3(m,0):carrier(m);
 vW=base+mat[2]*local.z;vN=normalize(mat*normal);vT=normalize(mat*tangent);vMacro=normalize(mat[2]);vWarp=normalize(mat[1]);vM=m;vLocal=vec2(t,theta);vId=float(id);vKind=uKind;
 vCrown=clamp((liftAt(t,id,uKind)/uParam.x+1.)*.5,0.,1.);gl_Position=uVP*vec4(vW,1.);}


`;
const fragCommon=`precision highp float;precision highp int;
uniform vec4 uSize;uniform vec4 uParam;uniform float uTime;
float hash(float x){return fract(sin(x*127.1+13.7)*43758.5453);}float noise1(float x){float a=floor(x),f=fract(x);return mix(hash(a),hash(a+1.),f*f*(3.-2.*f));}
`;
const shade=`
uniform vec3 uCam;uniform float uWash;uniform float uAbrasion;uniform float uBackstain;uniform float uFuzz;uniform int uBlack;uniform int uLight;uniform int uAA;uniform int uBake;uniform int uAudit;uniform float uFilterScale;uniform float uNearWeight;uniform int uDamage;
float sat(float x){return clamp(x,0.,1.);}vec3 tone(vec3 x){x=max(x,vec3(0));x=(x*(2.51*x+.03))/(x*(2.43*x+.59)+.14);return pow(clamp(x,0.,1.),vec3(1./2.2));}
float finishField(vec2 p){return noise1(p.x*.081+11.)*.27+noise1(p.y*.095+7.)*.31+noise1((p.x+p.y)*.055+41.)*.25+noise1(p.y*.023+p.x*.009+23.)*.17;}
vec3 yarnColor(vec2 m,float kind,float id,float crown){
 vec3 blue=vec3(.014,.031,.052),core=vec3(.155,.151,.139);if(uBlack==1)blue=vec3(.008,.009,.011);
 if(uBlack==2)blue=vec3(.15,.136,.11);
 float n=finishField(m);float scuff=uDamage>0?exp(-pow((m.x-4.)/25.,2.)-pow((m.y+1.)/12.,2.))*(.32+.32*n):0.;float slub=noise1(m.y*.20+id*3.1),fade=uWash*(.04+.23*n)+uAbrasion*(.015+.15*pow(n,2.))*crown;
 if(uBlack==5)fade+=uWash*.56*smoothstep(.46,.69,n);
 fade+=scuff*crown;vec3 warp=mix(blue*(1.+uWash*1.3),core,clamp(fade*.90,0.,.85));
 if(uBlack==2)warp=core*(.88+.17*n);
 warp*=.88+.18*hash(id*1.74)+.14*slub;
 vec3 weft=mix(core,vec3(.085,.112,.139),uBackstain*.7);weft*=.82+.24*noise1(m.x*.33+id*41.1);
 if(uBlack==3)weft=vec3(.009,.012,.018)*(1.+uWash*2.5);
 if(uBlack==4)weft=vec3(.01,.022,.042)*(1.+uWash*2.);
 return mix(warp,weft,kind);
}
vec3 cottonLight(vec3 c,vec3 N,vec3 T,vec3 V,vec3 L,vec3 lc,float fuzz){
 float nl=sat(dot(N,L)),nv=sat(dot(N,V));vec3 H=normalize(L+V);
 float tangentLobe=pow(sqrt(max(.0,1.-pow(dot(T,H),2.))),10.);
 float sheen=pow(1.-nv,3.)*(.012+.038*fuzz)*(.25+.75*nl);
 float roughSpec=pow(sat(dot(N,H)),9.)*.008;
 return lc*(c*(nl*.91+.035)+c*.25*sheen+vec3((roughSpec+.008*fuzz*tangentLobe)*nl));
}
vec3 lighting(vec3 c,vec3 N,vec3 T,vec3 W,float fuzz){
 vec3 V=normalize(uCam-W),L1=normalize(vec3(-.7,.58,.64)),L2=normalize(vec3(.58,.24,.40));
 vec3 c1=vec3(1.12),c2=vec3(.30);
 if(uLight==1){L1=normalize(vec3(-.96,.13,.25));L2=normalize(vec3(.28,.68,.31));c1=vec3(1.55,1.38,1.18);c2=vec3(.22,.29,.39);}
 if(uLight==2){c1=vec3(1.30,1.06,.82);c2=vec3(.29,.40,.58);L2=normalize(vec3(.8,-.3,.6));}
 if(uLight==3){L1=normalize(vec3(-.35,.75,1.2));L2=normalize(vec3(.6,-.2,1.));c1=vec3(.92,.94,1.);c2=vec3(.48,.46,.43);}
 // Hemispheric bounce remains material-colored: no white plastic coating.
 return c*(.21+.035*max(0.,N.y))+cottonLight(c,N,T,V,L1,c1,fuzz)+cottonLight(c,N,T,V,L2,c2,fuzz);
}


`;
const fs=`#version 300 es
${fragCommon}${shade}
in vec3 vN;in vec3 vW;in vec3 vT;in vec3 vMacro;in vec2 vM;in vec2 vLocal;in float vCrown;in float vId;in vec3 vWarp;flat in int vKind;uniform sampler2D uFrontCol;uniform sampler2D uFrontN;uniform sampler2D uBackCol;uniform sampler2D uBackN;out vec4 O;
void main(){if(uAudit==1){O=vKind==0?vec4(1,0,0,1):vec4(0,1,0,1);return;}vec3 N=normalize(vN),T=normalize(vT);float fp=max(length(dFdx(vM)),length(dFdy(vM)));float micro=uAA==1?1.-smoothstep(.018,.08,fp):1.;float twist=sin(vLocal.y*6.+vLocal.x*6.8+vId*.7);float fiber=sin(vLocal.y*53.+vLocal.x*29.+vId);N=normalize(N+normalize(cross(T,N))*(twist*.040+fiber*.030)*micro);float front=dot(N,vMacro);float crown=mix(1.-vCrown,vCrown,step(0.,front));crown*=.65+.35*abs(front);vec3 col=yarnColor(vM,float(vKind),vId,crown);float cavity=.56+.44*abs(front);col*=cavity*(1.+micro*(twist*.045+fiber*.015));if(uBake==1){O=vec4(col,1.);return;}if(uBake==2){O=vec4(N*.5+.5,1.);return;}vec3 diffuseN=normalize(mix(vMacro*sign(dot(N,vMacro)),N,.76));vec3 lit=lighting(col,diffuseN,T,vW,uFuzz);
O=vec4(tone(lit),1.);}


`;
const surfVS=`#version 300 es
${common}
in vec2 aM;uniform mat4 uVP;uniform float uBack;out vec3 vW;out vec3 vN;out vec3 vT;out vec2 vUV;out vec2 vM;void main(){mat3 b=basis(aM);vN=normalize(b[2])*uBack;vT=normalize(b[1]);vW=carrier(aM)+normalize(b[2])*uBack*uParam.z;vM=aM;vUV=aM/uSize.xy+.5;gl_Position=uVP*vec4(vW,1.);}
`;
const surfFS=`#version 300 es
${fragCommon}${shade}
uniform sampler2D uMap;uniform sampler2D uNormalMap;uniform float uBack;in vec3 vW;in vec3 vN;in vec3 vT;in vec2 vUV;in vec2 vM;out vec4 O;
void main(){vec2 dx=dFdx(vUV)*uFilterScale,dy=dFdy(vUV)*uFilterScale;vec4 tex=textureGrad(uMap,vUV,dx,dy);if(tex.a<.45)discard;vec3 nTex=textureGrad(uNormalMap,vUV,dx,dy).xyz*2.-1.;vec3 N0=normalize(vN)*uBack;vec3 B=normalize(cross(vT,N0));mat3 b=mat3(B,normalize(vT),N0);vec3 N=normalize(b*vec3(nTex.xy,nTex.z));vec3 c=tex.rgb;N=normalize(mix(normalize(vN),N,.76));O=vec4(tone(lighting(c,N,normalize(vT),vW,uFuzz)),1.);}
`;
const seamVS=`#version 300 es
${common}
in vec3 aM;uniform mat4 uVP;out vec3 vW;out vec3 vN;out vec3 vT;out vec2 vM;void main(){mat3 b=basis(aM.xy);vW=carrier(aM.xy)+b[2]*aM.z;vN=normalize(b[2]);vT=normalize(b[0]);vM=aM.xy;gl_Position=uVP*vec4(vW,1.);}
`;
const seamFS=`#version 300 es
${fragCommon}${shade}
uniform int uEdge;in vec3 vW;in vec3 vN;in vec3 vT;in vec2 vM;out vec4 O;void main(){O=vec4(tone(lighting(uEdge==1?vec3(.035,.065,.10):vec3(.145,.082,.022),normalize(vN),normalize(vT),vW,.2)),1.);}
`;
const hairVS=`#version 300 es
${common}
in vec4 aP;in vec2 aMeta;uniform mat4 uVP;uniform vec3 uRight;uniform float uMmPerPixel;out vec3 vW;out vec3 vN;out vec2 vM;out float vSide;out float vAlpha;flat out float vFamily;void main(){mat3 b=basis(aP.xy);vM=aP.xy;vW=carrier(aP.xy)+b[2]*aP.z;vN=normalize(b[2]);vFamily=aMeta.x;float r=.010,w=max(r,uMmPerPixel*.52);vAlpha=r/w*(1.-aMeta.y*.82);vSide=aP.w;gl_Position=uVP*vec4(vW+uRight*aP.w*w,1.);}`;
const hairFS=`#version 300 es
${fragCommon}${shade}
in vec3 vW;in vec3 vN;in vec2 vM;in float vSide;in float vAlpha;flat in float vFamily;out vec4 O;void main(){float a=(1.-smoothstep(.5,1.,abs(vSide)))*vAlpha*min(1.,uFuzz*1.7);if(a<.006)discard;vec3 c=yarnColor(vM,vFamily,23.,1.);O=vec4(tone(lighting(c,normalize(vN),vec3(0,1,0),vW,.15)),a);}`;
function program(v,f){function sh(type,s){let q=gl.createShader(type);gl.shaderSource(q,s);gl.compileShader(q);if(!gl.getShaderParameter(q,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(q));return q;}let p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
let yarnProg,surfProg,seamProg,hairProg;try{yarnProg=program(vs,fs);surfProg=program(surfVS,surfFS);seamProg=program(seamVS,seamFS);hairProg=program(hairVS,hairFS);}catch(e){$('error').hidden=false;$('error').textContent=e.message;throw e;}
let filterScale=1,nearWeight=1,longMorph=0,sideMorph=0,geomLevel=0,bakeDirty=true;const dummyTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,dummyTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,128,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);const loc=new Map();function U(p,k){let key=String(p._id||'')+k;if(!p._loc)p._loc={};return p._loc[k]??(p._loc[k]=gl.getUniformLocation(p,k));}function uf(p,k,x){gl.uniform1f(U(p,k),x);}function ui(p,k,x){gl.uniform1i(U(p,k),x);}function v3(p,k,x){gl.uniform3fv(U(p,k),x);}function mat(p,k,x){gl.uniformMatrix4fv(U(p,k),false,x);}
const norm=v=>{let l=Math.hypot(...v);return v.map(x=>x/l);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
function mul(a,b){let r=new Float32Array(16);for(let c=0;c<4;c++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)r[c*4+row]+=a[k*4+row]*b[c*4+k];return r;}
function look(eye,target=[0,0,3]){let z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
function mesh(data,indices,p,attr,size,stride=0){let vao=gl.createVertexArray();gl.bindVertexArray(vao);let vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);let at=gl.getAttribLocation(p,attr);gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,size,gl.FLOAT,false,stride*4,0);let ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);gl.bindVertexArray(null);return {vao,vb,ib,count:indices.length};}
function destroy(m){if(m){gl.deleteVertexArray(m.vao);gl.deleteBuffer(m.vb);gl.deleteBuffer(m.ib);}}
function tube(length,steps=4,sides=8){let a=[],ix=[],rings=length*steps+1;for(let j=0;j<rings;j++)for(let k=0;k<=sides;k++)a.push(j/steps,k/sides*Math.PI*2,1,0);for(let j=0;j<rings-1;j++)for(let k=0;k<sides;k++){let n=j*(sides+1)+k;ix.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}for(let end=0;end<2;end++){let start=a.length/4;for(let k=0;k<=sides;k++)a.push(end*length,k/sides*2*Math.PI,1,end?1:-1);let mid=a.length/4;a.push(end*length,0,0,end?1:-1);for(let k=0;k<sides;k++)ix.push(mid,start+k,start+k+1);}return mesh(a,ix,yarnProg,'aP',4);}
let carrierMesh,seams,edges,hairs,instances=[],instanceCounts=[0,0],brokenEnds=[],fiberCount=0;
function attachRanges(m,kind){gl.bindVertexArray(m.vao);gl.bindBuffer(gl.ARRAY_BUFFER,instances[kind]);let at=gl.getAttribLocation(yarnProg,'aRange');gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,4,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(at,1);}
function createRanges(){instances.forEach(b=>gl.deleteBuffer(b));instances=[];brokenEnds=[];graph.cuts=[];
 for(let kind=0;kind<2;kind++){let data=[],count=kind?graph.ny:graph.nx,full=kind?graph.nx:graph.ny,pitch=kind?graph.p.warpPitch:graph.p.weftPitch;
 for(let id=0;id<count;id++){
 let spans=C.cutRanges(graph,kind,id,state.damage);
 graph.cuts.push({family:kind?'weft':'warp',index:id,spans});
 for(const s of spans){data.push(s[0],s[1],id,0);for(let k=0;k<2;k++)if(s[k]>.01&&s[k]<full-.01)brokenEnds.push({kind,id,t:s[k],direction:k?1:-1});}
 }
 let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);instances.push(b);instanceCounts[kind]=data.length/4;
 }
}
function build(){mainMeshes.forEach(destroy);mainMeshes=[];destroy(carrierMesh);destroy(seams);destroy(edges);destroy(hairs);graph=C.compile({weave:state.weave,thickness:state.thickness,slub:state.slub});createRanges();
 for(const [step,sides] of [[2,8],[4,8],[2,4]]){for(let kind=0;kind<2;kind++){let m=tube(kind?graph.nx:graph.ny,step,sides);attachRanges(m,kind);mainMeshes.push(m);}}
 let a=[],ix=[],w=graph.p.width,h=graph.p.height,nx=100,ny=96;for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++)a.push((x/nx-.5)*w,(y/ny-.5)*h);for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){let k=y*(nx+1)+x;ix.push(k,k+1,k+nx+1,k+1,k+nx+2,k+nx+1);}carrierMesh=mesh(a,ix,surfProg,'aM',2);
let sa=[],si=[];for(let line=0;line<2;line++){let yy=-h*.5+12.+line*2.7;for(let j=0;j<Math.floor(w/2.8)-1;j++){let xx=-w/2+2.8+j*2.8,off=sa.length/3;for(let q=0;q<=10;q++){let t=q/10,x=xx+2.15*t,z=state.thickness*.55+.12*Math.sin(Math.PI*t);for(let k=0;k<6;k++){let th=k/6*6.283;sa.push(x,yy+.06*Math.cos(th),z+.06*Math.sin(th));}}for(let q=0;q<10;q++)for(let k=0;k<6;k++){let i=off+q*6+k,jj=off+q*6+(k+1)%6;si.push(i,jj,i+6,jj,jj+6,i+6);}}}seams=mesh(sa,si,seamProg,'aM',3);edges=null;
let ha=[],hi=[],seed=23451;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function fiber(px,py,pz,dx,dy,up,family){let off=ha.length/6,len=Math.hypot(dx,dy),curl=(rand()-.5)*len*.52;for(let q=0;q<=6;q++){let t=q/6,x=px+dx*t-dy/(len+.001)*curl*Math.sin(t*3.1),y=py+dy*t+dx/(len+.001)*curl*Math.sin(t*3.1),z=pz+up*Math.sin(t*2.7);ha.push(x,y,z,-1,family,t,x,y,z,1,family,t);}for(let q=0;q<6;q++){let i=off+q*2;hi.push(i,i+1,i+2,i+1,i+3,i+2);}fiberCount++;}
fiberCount=0;
for(const c of graph.curves){let family=c.family==='warp'?0:1,n=c.points.length/3;for(let end=0;end<2;end++)for(let k=0;k<3;k++){let j=end?n-1:0,px=c.points[j*3],py=c.points[j*3+1],pz=c.points[j*3+2]+graph.rz*.62,len=(.7+Math.pow(rand(),1.7)*3.7)*state.fray,drift=(rand()-.5)*1.5,sign=end?1:-1;fiber(px,py,pz,family?sign*len:drift,family?drift:sign*len,.12+rand()*.7,family);}}
for(const e of brokenEnds){const p=C.point(graph,e.kind,e.id,e.t);for(let k=0;k<8;k++){let len=.5+rand()*3.9;fiber(p[0],p[1],p[2]+graph.rz*.6,e.kind?e.direction*len:(rand()-.5)*2.1,e.kind?(rand()-.5)*2.1:e.direction*len,.25+rand()*.65,rand()<.6?1:e.kind);}}
// Sparse short, material-attached flyaways across both faces; not a shell coat.
for(let j=0;j<4600;j++){let kind=rand()<.77?0:1,id=Math.floor(rand()*(kind?graph.ny:graph.nx)),tt=rand()*(kind?graph.nx:graph.ny),spans=C.cutRanges(graph,kind,id,state.damage);if(!spans.some(s=>tt>=s[0]&&tt<=s[1]))continue;let p=C.point(graph,kind,id,tt),face=rand()<.8?1:-1,len=.16+rand()*.52;fiber(p[0],p[1],p[2]+graph.rz*face*.98,(rand()-.5)*len, (rand()-.5)*len,.07+rand()*.12,kind);}
hairs=mesh(ha,hi,hairProg,'aP',4,6);gl.bindVertexArray(hairs.vao);gl.bindBuffer(gl.ARRAY_BUFFER,hairs.vb);let am=gl.getAttribLocation(hairProg,'aMeta');gl.enableVertexAttribArray(am);gl.vertexAttribPointer(am,2,gl.FLOAT,false,24,16);gl.bindVertexArray(null);bakeDirty=true;updateText();request();}
function uniforms(p,vp,cam,flat=0,bakeMode=0){gl.useProgram(p);gl.uniform4fv(U(p,'uSize'),[graph.p.width,graph.p.height,graph.p.warpPitch,graph.p.weftPitch]);gl.uniform4fv(U(p,'uParam'),[graph.lift,graph.rz,state.thickness*.5,0]);ui(p,'uDraftBits',graph.d.cells.reduce((b,v,i)=>b|(v<<i),0));ui(p,'uRepeat',graph.d.width);ui(p,'uShape',state.shape);ui(p,'uFlat',flat);uf(p,'uSlub',state.slub);uf(p,'uFray',flat?0:state.fray);ui(p,'uDamage',state.damage);uf(p,'uLongMorph',flat?0:longMorph);uf(p,'uSideMorph',flat?0:sideMorph);uf(p,'uTime',state.animate?clock:0);uf(p,'uWash',state.wash);uf(p,'uAbrasion',state.abrasion);uf(p,'uBackstain',state.backstain);uf(p,'uFuzz',state.fuzz);ui(p,'uBlack',({black:1,grey:1,ecru:2,indigoBlack:3,doubleIndigo:4,acid:5})[state.preset]||0);ui(p,'uLight',state.light);ui(p,'uAA',state.qaDisableFilter?0:1);ui(p,'uAudit',state.qaAudit?1:0);ui(p,'uBake',bakeMode);uf(p,'uFilterScale',state.qaDisableFilter?1:filterScale*1.3);uf(p,'uNearWeight',nearWeight);v3(p,'uCam',cam);mat(p,'uVP',vp);}
function drawYarns(p,vp,cam,flat=0,bakeMode=0,high=false){uniforms(p,vp,cam,flat,bakeMode);for(let i=0;i<4;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,bakeMode?dummyTex:(baked[i]||dummyTex));ui(p,['uFrontCol','uFrontN','uBackCol','uBackN'][i],i);}gl.disable(gl.CULL_FACE);for(let kind=0;kind<2;kind++){ui(p,'uKind',kind);let m=mainMeshes[(flat?0:geomLevel*2)+kind];gl.bindVertexArray(m.vao);gl.drawElementsInstanced(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0,instanceCounts[kind]);drawCount++;}}
function texture(w,h){let t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);let ext=gl.getExtension('EXT_texture_filter_anisotropic');if(ext)gl.texParameterf(gl.TEXTURE_2D,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));return t;}
let bakeSize=innerWidth<700?512:1024;function bake(){bakeDirty=false;baked.forEach(t=>gl.deleteTexture(t));baked=[];let fbo=gl.createFramebuffer(),depth=gl.createRenderbuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,bakeSize,bakeSize);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);gl.viewport(0,0,bakeSize,bakeSize);gl.enable(gl.DEPTH_TEST);let w=graph.p.width,h=graph.p.height;
for(let back of [1,-1])for(let mode of [1,2]){gl.activeTexture(gl.TEXTURE4);let t=texture(bakeSize,bakeSize);baked.push(t);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Bake framebuffer unavailable');if(mode===2)gl.clearColor(.5,.5,back>0?1:0,1);else gl.clearColor(.017,.028,.045,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);let view=new Float32Array([1,0,0,0,0,1,0,0,0,0,back,0,0,0,-10,1]);let vp=mul(ortho(-w/2,w/2,-h/2,h/2,.1,30),view);drawYarns(yarnProg,vp,[0,0,back*100],1,mode,true);gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,t);gl.generateMipmap(gl.TEXTURE_2D);}
gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteFramebuffer(fbo);gl.deleteRenderbuffer(depth);}
// A bounded 2x supersample target is used for the final image. It is reallocated
// only on viewport change; not every frame. Texture LOD suppresses subpixel weave.
let screenFbo,screenColor,screenDepth,screenW=0,screenH=0;let blit=program(`#version 300 es\nprecision highp float;out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0,1);}`,`#version 300 es\nprecision highp float;uniform sampler2D im;in vec2 uv;out vec4 O;void main(){O=texture(im,uv);}`);let emptyVAO=gl.createVertexArray();
function target(w,h){if(w===screenW&&h===screenH)return;if(screenFbo){gl.deleteFramebuffer(screenFbo);gl.deleteTexture(screenColor);gl.deleteRenderbuffer(screenDepth);}screenW=w;screenH=h;gl.activeTexture(gl.TEXTURE4);screenFbo=gl.createFramebuffer();screenColor=texture(w,h);gl.bindTexture(gl.TEXTURE_2D,screenColor);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);screenDepth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,screenDepth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);gl.bindFramebuffer(gl.FRAMEBUFFER,screenFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,screenColor,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,screenDepth);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Render target unavailable');}
function perspective(fov,aspect,n,f){let q=1/Math.tan(fov/2);return new Float32Array([q/aspect,0,0,0,0,q,0,0,0,0,(f+n)/(n-f),-1,0,0,2*f*n/(n-f),0]);}
function camera(aspect){let span=112/state.zoom;if(aspect<1)span/=aspect;let fov=Math.PI/5,distance=span/(2*Math.tan(fov/2)),target=[state.panX||0,state.panY||0,3],direction=[Math.sin(state.yaw)*Math.cos(state.pitch),Math.sin(state.pitch),Math.cos(state.yaw)*Math.cos(state.pitch)];
 let eye=direction.map((v,i)=>v*distance+target[i]);let projection=state.qaAudit?ortho(-span*aspect/2,span*aspect/2,-span/2,span/2,1,3000):perspective(fov,aspect,.5,3000);
 let vp=mul(projection,look(eye,target));return {vp,eye,span,distance,fov,projection:state.qaAudit?'orthographic-internal-audit':'perspective'};}

let lod='';function render(time=0){pending=false;let start=performance.now();if(document.hidden)return;if(state.animate){if(last)clock+=Math.min((time-last)/1000,.05);last=time;}else last=0;
let rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5),cw=Math.max(1,Math.round(rect.width*ratio)),ch=Math.max(1,Math.round(rect.height*ratio));if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
let preCam=camera(cw/ch),desiredMip=!state.qaForceYarns&&ch/preCam.span*graph.p.warpPitch<.58&&Math.max(ch/preCam.span*graph.p.width,ch/preCam.span*graph.p.height)<180&&state.damage===0;if(desiredMip&&bakeDirty)bake();
let ss=Math.min(2,Math.sqrt(2400000/(cw*ch)));target(Math.max(1,Math.round(cw*ss)),Math.max(1,Math.round(ch*ss)));gl.bindFramebuffer(gl.FRAMEBUFFER,screenFbo);gl.viewport(0,0,screenW,screenH);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(.071,.077,.084,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);drawCount=0;
let {vp,eye,span,distance,projection}=camera(cw/ch),pixelsPerYarn=ch/span*graph.p.warpPitch;
let useMip=desiredMip;filterScale=ss;nearWeight=1;
// Geomorph high -> medium -> low. Endpoints stay attached to the same graph.
const smooth=(lo,hi,v)=>{let t=Math.max(0,Math.min(1,(v-lo)/(hi-lo)));return t*t*(3-2*t);};
longMorph=1.-smooth(1.4,2.4,pixelsPerYarn);sideMorph=1.-smooth(.7,1.2,pixelsPerYarn);geomLevel=pixelsPerYarn>1.4?1:pixelsPerYarn>.7?0:2;
if(state.qaAudit){longMorph=0;sideMorph=0;geomLevel=1;}
let high=geomLevel===1;lod=useMip?'极远景 · 同源过滤':geomLevel===1?'实体纱线 · 近景':geomLevel===0?'实体纱线 · 中景':'实体纱线 · 低细分';
if(useMip){for(let side=0;side<2;side++){uniforms(surfProg,vp,eye);uf(surfProg,'uBack',side===0?1:-1);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,baked[side*2]);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,state.qaDisableFilter?gl.NEAREST:gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,state.qaDisableFilter?gl.NEAREST:gl.LINEAR);ui(surfProg,'uMap',0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,baked[side*2+1]);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,state.qaDisableFilter?gl.NEAREST:gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,state.qaDisableFilter?gl.NEAREST:gl.LINEAR);ui(surfProg,'uNormalMap',1);gl.bindVertexArray(carrierMesh.vao);gl.drawElements(gl.TRIANGLES,carrierMesh.count,gl.UNSIGNED_INT,0);drawCount++;}}else drawYarns(yarnProg,vp,eye,0,0,high);
if(state.seam){uniforms(seamProg,vp,eye);ui(seamProg,'uEdge',0);gl.bindVertexArray(seams.vao);gl.drawElements(gl.TRIANGLES,seams.count,gl.UNSIGNED_INT,0);drawCount++;}
if(state.fuzz>.01){uniforms(hairProg,vp,eye);v3(hairProg,'uRight',norm(cross([0,1,0],norm(eye))));uf(hairProg,'uMmPerPixel',span/ch);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.bindVertexArray(hairs.vao);gl.drawElements(gl.TRIANGLES,hairs.count,gl.UNSIGNED_INT,0);gl.depthMask(true);gl.disable(gl.BLEND);drawCount++;}
gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,cw,ch);gl.disable(gl.DEPTH_TEST);gl.useProgram(blit);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,screenColor);ui(blit,'im',0);gl.bindVertexArray(emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3);drawCount++;frame++;
$('status').textContent=`${graph.curves.length} 根纱线 · ${state.thickness.toFixed(2)} mm · ${lod}`;window.__DENIM_WORKBENCH__.lastFrame={frame,drawCalls:drawCount,lod,pixelsPerYarn,nearWeight,bakeSize,sparseEdgeFibers:fiberCount,projection,distanceMm:distance,solidEdgeDrawn:false,geometryOnly:!useMip,longMorph,sideMorph,geomLevel,brokenEnds:brokenEnds.length,instanceCounts:[...instanceCounts],renderTarget:[screenW,screenH],cpuSubmitMs:performance.now()-start,triangles:(useMip?(carrierMesh.count*2)/3:(mainMeshes[geomLevel*2].count*instanceCounts[0]+mainMeshes[geomLevel*2+1].count*instanceCounts[1])/3)+(state.seam?seams.count/3:0)+(state.fuzz>.01?hairs.count/3:0)};if(state.animate)request();}
function request(){if(!pending&&!document.hidden){pending=true;requestAnimationFrame(render);}}
function profile(){return {schema:'kaopu.denim_material_profile@2.1',version:'R03.1',graph:{...graph.p,slub:state.slub,units:'millimeter',draft:graph.d,warpCount:graph.nx,weftCount:graph.ny},finish:{recipe:state.preset,wash:state.wash,abrasion:state.abrasion,backstain:state.backstain},surface:{fuzz:state.fuzz,fray:state.fray},damage:{kind:state.damage,cuts:graph.cuts,physicalSimulation:false},display:{shape:state.shape,light:state.light,seam:state.seam},limits:{physicalCalibration:false,clothSolver:false,individualCottonFibers:false,filmGradeValidated:false},sources:{r01:'f64eb3aaaedec738ae3d73661ea967713ede8e39',weaveCompiler:'49b9c0aae2c74f41b0444e5c5449b3c339608a4a'}};}
function updateText(){for(let k of ['wash','abrasion','backstain','slub','thickness','fuzz']){$(k).value=state[k];$(k+'Val').textContent=k==='thickness'?state[k].toFixed(2)+' mm':Math.round(state[k]*100)+'%';}document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===state.preset));$('selected').textContent=presets[state.preset].label;$('weave').value=state.weave;$('shape').value=state.shape;$('light').value=state.light;$('damage').value=state.damage;$('fray').value=state.fray;$('frayVal').textContent=state.fray.toFixed(1)+'×';}
let bakeTimer;for(let k of ['wash','abrasion','backstain','slub','thickness','fuzz'])$(k).oninput=e=>{state[k]=Number(e.target.value);updateText();clearTimeout(bakeTimer);if(k==='thickness'){bakeTimer=setTimeout(build,120);}else if(k==='fuzz'){request();}else{request();bakeTimer=setTimeout(()=>{bakeDirty=true;request();},100);}};
for(let k of ['weave','shape','light'])$(k).onchange=e=>{state[k]=+e.target.value;if(k==='weave')build();else request();};document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{Object.assign(state,presets[b.dataset.preset],{preset:b.dataset.preset});updateText();bakeDirty=true;request();});$('seam').onchange=e=>{state.seam=e.target.checked;request();};$('wind').onclick=()=>{state.animate=!state.animate;$('wind').textContent=state.animate?'暂停形变预览':'轻微形变预览';request();};
$('front').onclick=()=>{state.yaw=0;state.pitch=.08;state.zoom=1;state.panX=0;state.panY=0;request();};$('back').onclick=()=>{state.yaw=Math.PI;state.pitch=.10;state.zoom=1;state.panX=0;state.panY=0;request();};$('angle').onclick=()=>{state.yaw=-.50;state.pitch=.64;state.zoom=1.30;state.panY=-12;request();};$('reset').onclick=()=>{state.yaw=-.23;state.pitch=.34;state.zoom=1;state.panX=0;state.panY=0;request();};$('detail').onclick=()=>{state.zoom=2.35;state.panX=3;state.panY=-4;request();};$('full').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else $('stage').requestFullscreen?.();};
$('save').onclick=()=>{let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(profile(),null,2)],{type:'application/json'}));a.download='KAOPU_Denim_R03_Profile.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);};
let dragging=false,oldX=0,oldY=0;canvas.onpointerdown=e=>{dragging=true;oldX=e.clientX;oldY=e.clientY;canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!dragging)return;if(e.shiftKey||e.buttons===2){state.panX-=(e.clientX-oldX)*.10/state.zoom;state.panY+=(e.clientY-oldY)*.10/state.zoom;}else{state.yaw+=(e.clientX-oldX)*.007;state.pitch=Math.max(-1.35,Math.min(1.35,state.pitch+(e.clientY-oldY)*.006));}oldX=e.clientX;oldY=e.clientY;request();};canvas.oncontextmenu=e=>e.preventDefault();canvas.onpointerup=canvas.onpointercancel=()=>dragging=false;canvas.onwheel=e=>{e.preventDefault();state.zoom=Math.max(.10,Math.min(4.5,state.zoom*Math.exp(-e.deltaY*.001)));request();};
function auditGPU(){const saved={...state};Object.assign(state,{qaAudit:true,qaForceYarns:true,shape:0,yaw:0,pitch:0,zoom:1,panX:0,panY:0,seam:false,fuzz:0,animate:false,qaPanX:0});render(0);gl.finish();const w=canvas.width,h=canvas.height,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const {vp}=camera(w/h);let checked=0,wrong=0,ambiguous=0,examples=[];for(let y=0;y<graph.ny;y++)for(let x=0;x<graph.nx;x++){const mx=(x+.5)*graph.p.warpPitch-graph.p.width/2,my=(y+.5)*graph.p.weftPitch-graph.p.height/2,px=Math.floor((vp[0]*mx+vp[4]*my+vp[12]+1)*w*.5),py=Math.floor((vp[1]*mx+vp[5]*my+vp[13]+1)*h*.5);if(px<0||px>=w||py<0||py>=h)continue;const i=(py*w+px)*4,red=pixels[i],green=pixels[i+1],expected=graph.d.cells[(y%graph.d.height)*graph.d.width+x%graph.d.width];checked++;if(Math.abs(red-green)<12)ambiguous++;if((red>green)!==!!expected){wrong++;if(examples.length<12)examples.push({x,y,red,green,expected});}}
Object.assign(state,saved);state.qaAudit=!!saved.qaAudit;state.qaForceYarns=!!saved.qaForceYarns;request();return {checked,wrong,ambiguous,examples,method:'actual depth-tested warp/weft raster at crossing centers, flat carrier; not a global self-collision proof'};}
$('damage').onchange=e=>{state.damage=+e.target.value;build();};$('fray').oninput=e=>{state.fray=+e.target.value;$('frayVal').textContent=state.fray.toFixed(1)+'×';clearTimeout(bakeTimer);bakeTimer=setTimeout(build,120);};new ResizeObserver(request).observe(canvas);document.addEventListener('visibilitychange',()=>{if(!document.hidden){pending=false;last=0;request();}});window.__DENIM_WORKBENCH__={ready:false,version:'R03.1',renderer:'WebGL2',profile,audit:()=>C.audit(graph),state,setState:patch=>{const geom=['weave','thickness','damage','fray'].some(k=>k in patch),finish=['wash','abrasion','backstain','slub','preset'].some(k=>k in patch);Object.assign(state,patch);updateText();if(geom)build();else if(finish){bakeDirty=true;request();}else request();},renderNow:()=>render(0),lastFrame:null,networkAssets:0,getGLError:()=>gl.getError(),benchmark:()=>{gl.finish();let t=performance.now();render(0);gl.finish();return performance.now()-t;},getGraph:()=>graph,projectPoint:p=>{let v=camera(canvas.width/canvas.height).vp,q=[0,0,0,0];for(let r=0;r<4;r++)q[r]=v[r]*p[0]+v[r+4]*p[1]+v[r+8]*p[2]+v[r+12];return [(q[0]/q[3]*.5+.5)*canvas.width,(q[1]/q[3]*.5+.5)*canvas.height];},auditGPU,samplePatch:()=>{gl.finish();let w=160,h=160,p=new Uint8Array(w*h*4);gl.readPixels(Math.floor((canvas.width-w)/2),Math.floor((canvas.height-h)/2),w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p);}};build();window.__DENIM_WORKBENCH__.ready=true;
})();
