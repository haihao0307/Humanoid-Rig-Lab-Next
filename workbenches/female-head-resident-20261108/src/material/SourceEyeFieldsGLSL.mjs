// Direct evaluation of the project's frozen R15 authored eye fields.
// This contains no eye shape, atlas pixels or anatomical coordinate guesses.
export const SOURCE_EYE_FIELDS_GLSL=`
const float seTAU=6.283185307179586;
const uint seSeed=20261022u;
float seRank(int i,uint seed){uint x=(uint(i)+seed)*1597334677u;x=(x^(x>>15u))*2246822519u;return float(x^(x>>13u))*(1./4294967296.);}
float seRank(int i){return seRank(i,seSeed);}
float seNoise(vec2 p,uint seed){ivec2 i=ivec2(floor(p));vec2 t=smoothstep(vec2(0),vec2(1),fract(p));float a=seRank((i.x*38113)^(i.y*19139),seed),b=seRank(((i.x+1)*38113)^(i.y*19139),seed),c=seRank((i.x*38113)^((i.y+1)*19139),seed),d=seRank(((i.x+1)*38113)^((i.y+1)*19139),seed);return mix(mix(a,b,t.x),mix(c,d,t.x),t.y);}
float seAngular(float a,int n,uint seed){float x=fract(a/seTAU)*float(n),i=floor(x),t=smoothstep(0.,1.,x-i);return mix(seRank(int(i)%n,seed),seRank((int(i)+1)%n,seed),t);}
float seAngleDistance(float a,float b){return atan(sin(a-b),cos(a-b));}
vec4 sourceIrisFieldGPU(float r,float a,int side,int style){
 float pupil=style==0?.405:.295,q=clamp((r-pupil)/(1.-pupil),0.,1.);int group=side+style*2;float phase=float(group)*.91;
 vec2 point=vec2(cos(a),sin(a))*(.30+.70*q);float warp=a+.010*sin(a*7.+q*5.+phase)+.005*sin(a*19.-q*8.);
 int cell=int(floor(fract(warp/seTAU)*320.));float fiber=0.,furrow=0.;
 for(int j=-3;j<=3;j++){
  int i=(cell+j+320)%320,id=group*2903+i*19;float angle=(float(i)+.12+.76*seRank(id))/320.*seTAU,width0=.0018+.0038*seRank(id+1),bp=seRank(id+2)*seTAU,frequency=4.+seRank(id+3)*7.,split0=.25+seRank(id+4)*.5,gain=.4+.6*seRank(id+5),gap=.2+seRank(id+6)*.6;
  float bend=.020*sin(q*frequency+bp)+.008*sin(q*24.-bp),width=width0*(.86+.36*sin(q*15.+bp))/(.40+.60*q),d=seAngleDistance(warp,angle+bend)/width;
  float lengthGate=.15+.85*smoothstep(.018,.075,abs(q-gap)),ridge=exp(-d*d*1.5)*gain*lengthGate;
  fiber=max(fiber,ridge);furrow=max(furrow,exp(-pow(d+1.4,2.)*1.8)*gain);
  float split=smoothstep(split0,split0+.2,q)*.025*sin((q-split0)*7.+bp*.2),branch=seAngleDistance(warp,angle+bend+split)/(width*.58);
  fiber=max(fiber,exp(-branch*branch*1.6)*gain*.66*smoothstep(split0-.03,split0+.04,q));
 }
 float cloud=.62*seNoise(point*10.1,seSeed+uint(group*111))+.26*seNoise(point*23.7,seSeed+uint(group*149))+.12*seNoise(point*47.3,seSeed+uint(group*193));
 float sectors=seAngular(a,29,seSeed+uint(group*97)),collar=.27+.055*sin(a*7.+phase)+.037*(seAngular(a,21,seSeed+uint(group*191))-.5),ridge=exp(-pow((q-collar)/.027,2.))*(.4+.6*seAngular(a,71,seSeed+uint(group*313)));
 float cavity=0.,rim=0.;
 for(int i=0;i<52;i++){
  int id=group*1907+i*13;float ca=seRank(id)*seTAU,cq=i<35?.19+seRank(id+1)*.22:.40+seRank(id+1)*.43,cw=.012+seRank(id+2)*.061,ch=.014+seRank(id+3)*.065,cd=(.10+seRank(id+4)*.32)*(i<35?1.:.35);
  float da=seAngleDistance(a,ca)/cw,dr=(q-cq)/ch,distance2=da*da+dr*dr;if(distance2<7.){cavity=max(cavity,exp(-distance2*1.45)*cd);rim=max(rim,exp(-pow((sqrt(distance2)-1.1)/.20,2.))*cd*.6);}
 }
 float outerArc=.75+.10*sin(a*4.+phase)+.035*sin(a*13.),fold=exp(-pow((q-outerArc)/.013,2.))*smoothstep(.25,.7,seAngular(a,17,seSeed+uint(group*31)));
 float grain=seNoise(point*83.1,seSeed+uint(group*29)),light=clamp(.07+.40*cloud+.15*sectors+.40*fiber-.22*furrow+.19*ridge+.29*rim-.80*cavity-.14*fold+.035*(grain-.5),.012,1.02);
 float limbus=1.-.70*smoothstep(.84,1.045,r),ruff=1.-.33*(1.-smoothstep(0.,.045,q)),amber=smoothstep(.43,.8,seNoise(point*7.7+vec2(3.,0.),seSeed+uint(group*331)))*(1.-smoothstep(.8,1.,q));
 vec3 dark=style==0?vec3(25,29,25):vec3(27,32,38),bright=style==0?vec3(213,218,186):vec3(192,211,221),rgb=clamp(mix(dark,bright,light)*limbus*ruff,vec3(0),vec3(255));
 rgb.r=mix(rgb.r,rgb.r*1.20+13.,amber*.55);rgb.g=mix(rgb.g,rgb.g*.94,amber*.45);rgb.b=mix(rgb.b,rgb.b*.63,amber*.6);
 return vec4(rgb,clamp(.43+.24*fiber+.13*ridge+.12*rim-.32*cavity-.10*fold-.08*furrow,0.,1.));
}
vec4 sourceScleraFieldGPU(vec2 q,int side){
 uint id=seSeed+uint(side*1709);float r=length(q),cloud=.66*seNoise(q*2.7,id)+.24*seNoise(q*7.1,id+29u)+.10*seNoise(q*17.3,id+59u),outer=smoothstep(1.16,2.42,r),flank=pow(abs(q.x)/max(r,.01),1.5),warm=outer*(.40+.60*flank),limbal=exp(-pow((r-1.09)/.19,2.));
 float pigmentPatch=smoothstep(.48,.8,seNoise(q*2.1+vec2(5.,0.),id+991u))*outer,blush=smoothstep(.48,.74,seNoise(q*6.3+vec2(7.,0.),id+881u))*smoothstep(1.08,1.9,r),cool=smoothstep(.4,.76,seNoise(q*4.8-vec2(3.,0.),id+713u))*(1.-smoothstep(1.2,2.1,r));
 vec3 rgb=vec3(230,226,217)+(cloud-.5)*vec3(11,12,14)-warm*vec3(10,29,36)-pigmentPatch*vec3(0,5,6)-limbal*vec3(13,9,3)-blush*vec3(1,12,13)-cool*vec3(9,4,-2);
 float collagen=.5+.5*sin(q.x*43.+q.y*22.+seNoise(q*9.,id+101u)*7.);return vec4(rgb,clamp(.5+(collagen-.5)*.09+(cloud-.5)*.20,0.,1.));
}
`;
