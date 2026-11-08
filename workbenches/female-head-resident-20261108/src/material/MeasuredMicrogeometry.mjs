import{USC_MICRO_STATISTICS as stats}from'./USCMicrogeometryStatistics.mjs';
export const MICRO_DEFAULTS=Object.freeze({enabled:false,detail:1,reflectance:1,scale:1,retainMeso:1,seed:731,subject:1,view:0});
export function validateMicro(v){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length<7||Object.keys(v).length>8||Object.keys(v).some(k=>!Object.hasOwn(MICRO_DEFAULTS,k))||Object.keys(MICRO_DEFAULTS).some(k=>k!=='retainMeso'&&!Object.hasOwn(v,k)))throw Error('微结构配方不完整');v={retainMeso:1,...v};if(typeof v.enabled!=='boolean'||!Number.isFinite(v.retainMeso)||v.retainMeso<0||v.retainMeso>1||!Number.isFinite(v.detail)||v.detail<0||v.detail>2||!Number.isFinite(v.reflectance)||v.reflectance<0||v.reflectance>1||!Number.isFinite(v.scale)||v.scale<.5||v.scale>2||!Number.isInteger(v.seed)||v.seed<1||v.seed>99999||![1,2].includes(v.subject)||![0,1,2].includes(v.view))throw Error('微结构变量无效');return{...v};}
export function microUniforms(v){v=validateMicro(v);return Object.fromEntries(Object.entries(v).map(([k,x])=>['mg'+k[0].toUpperCase()+k.slice(1),typeof x==='boolean'?Number(x):x]));}
const f=x=>Number(x).toExponential(8),array=(name,a)=>`const float ${name}[${a.length}]=float[${a.length}](${a.map(f).join(',')});\n`;
const powers=[],angles=[];for(const subject of [1,2])for(const region of stats.regions){const sample=stats.samples.find(x=>x.subject===subject&&x.region===region);powers.push(...sample.bandSlopeVariance);angles.push(sample.principalAngle);}
const glsl=`
uniform float mgEnabled,mgDetail,mgReflectance,mgScale,mgRetainMeso,mgSeed,mgSubject,mgView;
float mgWeight=0.,mgUnresolved=0.;vec3 mgSpecN=vec3(0,0,1),mgLobes=vec3(.15,.05,.6);vec3 nativeToView(vec3 v);
${array('mgPeriods',stats.periodsMM)}${array('mgPower',powers)}${array('mgAngles',angles)}
${array('mgMicroLobes',stats.table1MicroBeckmann.flat(2))}${array('mgMesoLobes',stats.table2MesoBeckmann.flat(2))}
uint mgHash(uint x){x^=uint(mgSeed)*2246822519u;x^=x>>16;x*=2246822519u;x^=x>>13;x*=3266489917u;return x^(x>>16);}
float mgRandom(int i){return float(mgHash(uint(i))>>8)*(1./16777216.);}
float mgCell(ivec2 p,int salt){return float(mgHash(uint(p.x)*1597334677u^uint(p.y)*3812015801u^uint(salt))>>8)*(1./16777216.);}
vec2 mgNoiseGradient(vec2 p,int salt){ivec2 c=ivec2(floor(p));vec2 t=fract(p),w=t*t*t*(t*(t*6.-15.)+10.),dw=30.*t*t*(t-1.)*(t-1.);float a=mgCell(c,salt),b=mgCell(c+ivec2(1,0),salt),d=mgCell(c+ivec2(0,1),salt),e=mgCell(c+ivec2(1,1),salt);return vec2(mix(b-a,e-d,w.y)*dw.x,mix(d-a,e-b,w.x)*dw.y);}
vec2 mgPlaneGradient(vec2 p,float grid,float angle,int salt){float c=cos(angle),s=sin(angle);mat2 rotation=mat2(c,s,-s,c);vec2 q=rotation*p/grid+vec2(mgRandom(salt+701),mgRandom(salt+809))*31.;return transpose(rotation)*mgNoiseGradient(q,salt);}
void mgSurface(vec3 p,vec3 restN,vec3 baseN,float foot,float cheek,float nose,float forehead,float chin,float protect){
 float wr[5];wr[0]=forehead;wr[1]=max(0.,1.-max(max(cheek,nose),max(forehead,chin)));wr[2]=cheek;wr[3]=nose*1.6;wr[4]=chin;
 float sum=0.;for(int r=0;r<5;r++)sum+=wr[r];for(int r=0;r<5;r++)wr[r]/=max(sum,.00001);
 int subject=int(mgSubject+.5)-1;mgLobes=vec3(0);float cs=0.,sn=0.;
 for(int r=0;r<5;r++){int offset=(subject*5+r)*3;vec3 micro=vec3(mgMicroLobes[offset],mgMicroLobes[offset+1],mgMicroLobes[offset+2]),meso=vec3(mgMesoLobes[offset],mgMesoLobes[offset+1],mgMesoLobes[offset+2]);mgLobes+=wr[r]*mix(meso,micro,mgReflectance);float angle=mgAngles[subject*5+r];cs+=wr[r]*cos(2.*angle);sn+=wr[r]*sin(2.*angle);}
 float orientation=.5*atan(sn,cs);vec3 weights=pow(abs(restN),vec3(8.));weights/=max(length(weights),.000001);float tangentVariance=.5*dot(weights*weights,vec3(1.)+restN*restN);vec3 gradient=vec3(0);mgUnresolved=0.;
 for(int b=0;b<7;b++){
  float power=0.;for(int r=0;r<5;r++)power+=wr[r]*mgPower[(subject*5+r)*7+b];
  float period=mgPeriods[b]*mgScale,k=6.28318530718/period;
  float attenuation=exp(-min(80.,k*k*foot*foot/24.));mgUnresolved+=power*(1.-attenuation*attenuation)*mgDetail*mgDetail;
  // Analytic variance of a 2D quintic value-noise gradient with U[0,1]
  // corner values is 0.3731189445. Rotated independent bands avoid wave grids.
  float amplitude=sqrt(power/(.3731189445*max(tangentVariance,.001)))*attenuation*mgDetail;
  float angle=orientation+6.28318530718*mgRandom(b+1201),grid=period*.65;
  if(weights.x>.001){vec2 g=mgPlaneGradient(p.yz,grid,angle,b*13+1);gradient+=weights.x*vec3(0.,g)*amplitude;}
  if(weights.y>.001){vec2 g=mgPlaneGradient(p.xz,grid,angle+1.7,b*13+3);gradient+=weights.y*vec3(g.x,0.,g.y)*amplitude;}
  if(weights.z>.001){vec2 g=mgPlaneGradient(p.xy,grid,angle+3.9,b*13+5);gradient+=weights.z*vec3(g,0.)*amplitude;}
 }
 gradient-=restN*dot(gradient,restN);mgSpecN=normalize(baseN-nativeToView(gradient));mgWeight=protect;
}
float mgD(float nh,float m){float c2=max(nh*nh,.000001),a2=max(m*m,.000001);return exp((c2-1.)/(a2*c2))/(3.14159265359*a2*c2*c2);}
float mgLambda(float cosine,float m){float t=sqrt(max(0.,1.-cosine*cosine))/max(cosine,.0001),a=1./max(m*t,.00001);if(a>=1.6)return 0.;return (1.-1.259*a+.396*a*a)/(3.535*a+2.181*a*a);}
vec3 mgBRDF(vec3 L,vec3 V,vec3 N){float nl=max(dot(N,L),.00001),nv=max(dot(N,V),.00001);vec3 H=normalize(L+V);float nh=max(dot(N,H),0.),vh=max(dot(V,H),0.);float m1=sqrt(mgLobes.x*mgLobes.x+mgUnresolved),m2=sqrt(mgLobes.y*mgLobes.y+mgUnresolved);float d1=mgD(nh,m1),d2=mgD(nh,m2),g1=1./(1.+mgLambda(nl,m1)+mgLambda(nv,m1)),g2=1./(1.+mgLambda(nl,m2)+mgLambda(nv,m2));float f0=pow((1.33-1.)/(1.33+1.),2.),f=f0+(1.-f0)*pow(1.-vh,5.);return vec3(f*mix(d2*g2,d1*g1,mgLobes.z)/(4.*nl*nv));}
void mgSkinDirect(const in IncidentLight light,const in vec3 pos,const in vec3 N,const in vec3 V,const in vec3 CN,const in PhysicalMaterial material,inout ReflectedLight reflectedLight){vec3 before=reflectedLight.directSpecular;personSkinDirect(light,pos,N,V,CN,material,reflectedLight);if(mgEnabled>.5&&mgWeight>0.){vec3 spec=light.color*hcEarVisibility(light.direction)*max(dot(mgSpecN,light.direction),0.)*mgBRDF(light.direction,V,mgSpecN);reflectedLight.directSpecular=mix(reflectedLight.directSpecular,before+spec,mgWeight);}}
#undef RE_Direct
#define RE_Direct mgSkinDirect
`;
export function measuredMicroFragment(source){
 const declaration='#define RE_Direct personSkinDirect',entry='if(u_nativeMode==1){',output='vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;';
 for(const key of [declaration,entry,output])if(source.split(key).length!==2)throw Error('实测微结构挂接点改变：'+key);
 const hook=`if(mgEnabled>.5&&u_nativeMode!=1&&u_nativeMode!=2&&u_nativeMode!=3&&u_nativeMode!=4){float facialGate=smoothstep(0.,30.,psMM.z)*smoothstep(205.,230.,psMM.y)*(1.-smoothstep(354.,375.,psMM.y));float protection=facialGate*fbHead*(1.-psLipFeather)*(1.-psE)*(1.-clamp(lidGate,0.,1.));vec3 microBase=normalize(mix(normalize(fbGeomN),normal,mgRetainMeso));mgSurface(psMM,normalize(psRestN),microBase,psFoot,fbCheek,fbNose,r7Forehead,r7Jaw,protection);material.clearcoat*=1.-mgWeight;}
 `;
 return source.replace(declaration,declaration+'\n'+glsl).replace(entry,hook+entry).replace(output,output+'\nif(mgEnabled>.5&&mgView>.5&&mgView<1.5)outgoingLight=mgSpecN*.5+.5;\nif(mgEnabled>.5&&mgView>1.5)outgoingLight=totalSpecular;');
}
