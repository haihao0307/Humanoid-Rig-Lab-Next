// Authoritative authored surface field, assembled by build.py. No image samples.
varying vec3 vPSRest;
varying vec2 vPSUV;
varying float vPSRegion;
uniform float psKind,psDensity,psRelief,psFiber,psIrregularity,psWear,psSeed,psPitch,psDepth,psRough,psMode;
uniform vec3 psColor,psLow,psHigh;
const float PS_TAU=6.28318530718;
float psHash(vec2 p){return fract(sin(dot(p,vec2(73.1569,19.8731))+psSeed*1.61803)*4371.3127);}
float psNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(psHash(i),psHash(i+vec2(1,0)),f.x),mix(psHash(i+vec2(0,1)),psHash(i+vec2(1,1)),f.x),f.y);}
float psFbm(vec2 p){return .57*psNoise(p)+.28*psNoise(p*2.03+19.7)+.15*psNoise(p*4.11-3.4);}
float psAA(float x){return 1.-smoothstep(.18,.75,x);}
float psTube(float d,float r){float t=clamp(1.-d*d/(r*r),0.,1.);return t*t*(3.-2.*t);}
// Soft V-shaped knit legs. Smooth cross-sections avoid wire-like hole edges.
vec3 psStitch(vec2 q,float width){
 vec2 cell=floor(q);float jitter=psIrregularity*(psNoise(vec2(cell.x*.43,q.y*.21))-.5);
 vec2 f=fract(q+vec2(jitter*.10,jitter*.07));float y=f.y;
 float leg=.048+.295*y+.032*sin(y*3.141593);
 float signedDistance=abs(f.x-.5)-leg;
 float radius=(width+.045)*(1.+jitter*.18);
 float body=psTube(signedDistance,radius)*(.84+.13*sin(y*3.141593));
 float filament=.5+.5*cos((signedDistance/radius*1.3+y*2.2+cell.x*.17)*PS_TAU);
 float aa=psAA(max(length(dFdx(q)),length(dFdy(q))));
 float h=body*(.96+.045*(filament-.5)*psFiber);
 return vec3(mix(.53,h,aa),mix(.5,filament,aa),psHash(cell));
}
// 2/2 over-under twill, optionally reversing in herringbone bands.
vec3 psWeave(vec2 q,float herring){
 float flip=mix(1.,mod(floor(q.x/9.),2.)<1.?1.:-1.,herring);
 vec2 f=fract(q),c=floor(q);float over=mod(c.x+flip*c.y,4.)<2.?1.:0.;
 float warp=psTube(f.x-.5,.43),weft=psTube(f.y-.5,.43);
 float h=mix(weft,warp,over),ply=.5+.5*cos((mix(q.x,q.y,over)*3.1+mix(q.y,q.x,over)*.36)*PS_TAU);
 float aa=psAA(max(length(dFdx(q)),length(dFdy(q))));
 return vec3(mix(.7,h,aa),mix(.5,ply,aa),mix(.5,psHash(c),aa));
}
vec3 psField(out float height,out float rough){
 vec3 p=vPSRest;vec3 span=max(psHigh-psLow,vec3(.001));vec3 pn=(p-psLow)/span;
 vec2 uv=vPSUV;vec2 cloth=uv*vec2(.51,.34);float rgn=floor(vPSRegion+.1);
 float large=psFbm(cloth*27.);float micro=psNoise(cloth*3700.);
 float grainAA=psAA(max(length(dFdx(cloth*3700.)),length(dFdy(cloth*3700.))));
 micro=mix(.5,micro,grainAA);
 vec3 col=psColor;vec3 yarn=vec3(.65,.5,.5);float band=0.;height=0.;rough=psRough;
 if(psKind<.5){
  vec2 polar=uv-vec2(.5,.512);float rad=length(polar),theta=atan(polar.y,polar.x)/PS_TAU+.5;
  float repeats=floor(10.*psDensity+.5);vec2 q=vec2(theta*repeats*12.,rad*132.*psDensity);
  q+=psIrregularity*.11*vec2(psNoise(vec2(theta*24.,rad*22.)),sin(theta*PS_TAU*3.+rad*11.));
  float cuff=1.-smoothstep(.18,.25,pn.y);
  vec3 ground=psStitch(q,.15);
  float lane=mod(q.x,12.)-6.,phase=q.y*PS_TAU/13.;
  float left=-1.45*sin(phase),right=1.45*sin(phase);
  float envelopeL=psTube(lane-left,1.8),envelopeR=psTube(lane-right,1.8);
  float frontL=envelopeL*(.7+.25*cos(phase)),frontR=envelopeR*(.7-.25*cos(phase));
  float lobe=max(frontL,frontR),winner=step(frontL,frontR);
  vec3 loopsL=psStitch(vec2(lane-left+20.,q.y+.27*cos(phase)),.145);
  vec3 loopsR=psStitch(vec2(lane-right+20.,q.y-.27*cos(phase)),.145);
  vec3 cables=mix(loopsL,loopsR,winner);
  float mask=smoothstep(.02,.24,max(envelopeL,envelopeR));
  yarn=mix(ground,cables,mask);
  float ribRidge=.5+.5*cos(q.x*3.141593);
  float crownHeight=.00115*lobe+psDepth*(.48*yarn.x+.055*yarn.y*psFiber);
  float cuffHeight=.00022*ribRidge+psDepth*(.43*ground.x+.04*ground.y*psFiber);
  height=mix(crownHeight,cuffHeight,cuff);
  height=mix(.00019,height,smoothstep(.005,.023,rad));
  col*=mix(.82+.19*yarn.x+.045*lobe,.83+.18*ground.x+.025*ribRidge,cuff);
  col*=1.+psIrregularity*.12*(psNoise(vec2(theta*31.,rad*40.))-.5);
 }else if(abs(psKind-4.)<.5){
  vec2 q=cloth/(psPitch/1000.)*psDensity;yarn=psStitch(q,.14);height=psDepth*(yarn.x+.08*yarn.y*psFiber);
  float stripe=mod(floor((p.y-.69)*350.),16.);vec3 dark=vec3(.115,.15,.135),blue=vec3(.13,.21,.23),red=vec3(.31,.13,.095);
  if(stripe<2.)col=dark;else if(stripe<4.)col=blue;
  float theta=atan(p.z-.057,p.x)/PS_TAU+.5;vec2 d=abs(fract(vec2(theta*12.,(p.y-.765)*34.))-.5);
  float diamond=1.-smoothstep(.31,.38,d.x+d.y);float zone=smoothstep(.735,.755,p.y)*(1.-smoothstep(.82,.835,p.y));
  col=mix(col,mod(floor(theta*12.),2.)<1.?red:blue,diamond*zone);
  col*=.82+.22*yarn.x;
 }else if(psKind<2.5||abs(psKind-5.)<.5||abs(psKind-8.)<.5||psKind>9.5){
  yarn=psWeave(cloth/(psPitch/1000.)*psDensity,abs(psKind-2.)<.5?1.:0.);
  height=psDepth*(yarn.x+.13*yarn.y*psFiber);
  if(abs(psKind-1.)<.5&&rgn>.5){col=vec3(.105,.07,.044);rough=.83;}
  if(abs(psKind-2.)<.5)col*=.76+.42*yarn.z;
  if(abs(psKind-5.)<.5){float n=psFbm(cloth*42.+vec2(psNoise(cloth*28.)*3.));col=mix(vec3(.24,.255,.17),vec3(.36,.35,.245),smoothstep(.36,.41,n));col=mix(col,vec3(.115,.15,.112),smoothstep(.57,.60,n));col=mix(col,vec3(.38,.375,.28),smoothstep(.71,.73,n));col*=psColor/vec3(.242,.242,.147);}
  if(abs(psKind-8.)<.5){float edge=smoothstep(.85,.93,pn.y)*(1.-smoothstep(.46,.58,pn.z));col=mix(col,vec3(.58,.047,.021),edge);}
  col*=.87+.16*yarn.x;
 }else{
  vec2 fq=cloth*2100.*psDensity;float aa=psAA(max(length(dFdx(fq)),length(dFdy(fq))));
  float fibers=.5+.5*sin((fq.x+psNoise(fq*.09)*5.)*PS_TAU);
  float crossFiber=.5+.5*sin((fq.y*.7-fq.x*.6+psNoise(fq*.07)*3.)*PS_TAU);
  float felt=mix(.5,.55*fibers+.45*crossFiber,aa);height=psDepth*(felt*.75+micro*.25)*psFiber;
  yarn=vec3(felt,.5,micro);col*=.95+.06*(micro-.5);
  if(abs(psKind-3.)<.5&&rgn>3.5){band=1.;col=vec3(.11,.085,.047);vec2 dots=fract(cloth*290.);float dotMask=1.-smoothstep(.09,.16,length(dots-.5));col=mix(col,vec3(.36,.31,.18),dotMask*.55);}
  if(abs(psKind-6.)<.5&&rgn>.5){band=1.;col=psColor*.58;}
  if(abs(psKind-7.)<.5&&rgn>.5){band=1.;col=rgn>1.5?vec3(.62,.45,.05):vec3(.032,.065,.32);rough=rgn>1.5?.32:.57;}
  if(abs(psKind-9.)<.5){float n=psFbm(cloth*78.);float line=1.-smoothstep(.025,.055,abs(n-.5));col=mix(col,vec3(.05,.10,.059),line*.93);if(rgn>.5){band=1.;col=vec3(.042,.055,.036);}}
  if(band>.5){yarn=psWeave(cloth/.00042*psDensity,0.);height=psDepth*(.3*yarn.x+.1*yarn.y);col*=.89+.13*yarn.x;rough=min(rough,.65);}
 }
 float weather=psWear*(.45*large+.55*psFbm(cloth*9.+7.));
 col*=1.+psIrregularity*.09*(large-.5)+psFiber*.025*(micro-.5);
 col=mix(col,col*1.16+vec3(.018,.013,.008),weather*.35);
 height*=psRelief*(1.-psWear*.25);rough=clamp(rough+.07*(1.-yarn.x)+.035*(micro-.5)+weather*.035,.4,.98);
 return max(col,vec3(.001));
}
