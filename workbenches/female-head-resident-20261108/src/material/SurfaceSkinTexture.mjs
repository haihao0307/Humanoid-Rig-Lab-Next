// Authored analytic morphology informed by USC regional measurements.
// Statistical adaptation, not Image Analogies or exact exemplar reconstruction.
import{SKIN_MORPHOLOGY}from'./SkinMorphologyPrototypes.mjs';
export const TEXTURE_REVISION='human.skin-surface-texture/20261030-1';
export const TEXTURE_DEFAULTS=Object.freeze({enabled:false,pores:.65,furrows:.55,grain:.35,scale:1,oil:.12,colour:.5,seed:731,view:0});
export const TEXTURE_PRESETS=Object.freeze({
 fine:{label:'细腻哑光',pores:.35,furrows:.32,grain:.28,scale:.85,oil:.03,colour:.35},
 natural:{label:'自然混合',pores:.65,furrows:.52,grain:.3,scale:1,oil:.12,colour:.5},
 pores:{label:'毛孔清晰',pores:1.15,furrows:.40,grain:.25,scale:1.1,oil:.14,colour:.48},
 dry:{label:'干燥细纹',pores:.5,furrows:1.05,grain:.65,scale:1.1,oil:0,colour:.52},
 rosy:{label:'红润细肤',pores:.48,furrows:.40,grain:.32,scale:.95,oil:.08,colour:.85},
 freckles:{label:'暖调雀斑',pores:.7,furrows:.55,grain:.32,scale:1,oil:.1,colour:.75}
});
export function validateTexture(v){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==Object.keys(TEXTURE_DEFAULTS).length||Object.keys(TEXTURE_DEFAULTS).some(k=>!Object.hasOwn(v,k))||typeof v.enabled!=='boolean')throw Error('皮肤纹理配方不完整');for(const k of ['pores','furrows','grain'])if(!Number.isFinite(v[k])||v[k]<0||v[k]>1.5)throw Error('皮肤纹理参数无效');for(const k of ['oil','colour'])if(!Number.isFinite(v[k])||v[k]<0||v[k]>1)throw Error('皮肤质感参数无效');if(!Number.isFinite(v.scale)||v.scale<.65||v.scale>1.5||!Number.isInteger(v.seed)||v.seed<1||v.seed>99999||![0,1,2,3].includes(v.view))throw Error('皮肤纹理尺度或种子无效');return{...v};}
export function textureUniforms(v){return Object.fromEntries(Object.entries(validateTexture(v)).map(([k,x])=>['tx'+k[0].toUpperCase()+k.slice(1),typeof x==='boolean'?Number(x):x]));}
const fmt=x=>Number(x).toExponential(7);
const prototypeGLSL=`const vec4 txPrototypes[40]=vec4[40](${SKIN_MORPHOLOGY.samples.flatMap(r=>r.prototypes.map(p=>'vec4('+p.slice(0,4).map(fmt).join(',')+')')).join(',')});\nconst vec3 txRegionLines[5]=vec3[5](${SKIN_MORPHOLOGY.samples.map(r=>'vec3('+[r.furrowWidthMM,r.furrowAngle,r.highPassHeightStdMM].map(fmt).join(',')+')').join(',')});`;
const glsl=`
uniform float txEnabled,txPores,txFurrows,txGrain,txScale,txOil,txColour,txSeed,txView;
float txGate=0.,txPoreMask=0.,txGrooveMask=0.,txMicroColour=0.,txNose=0.,txForehead=0.,txFoot=0.;vec3 txN=vec3(0,0,1);
${prototypeGLSL}
vec4 txRegionWeights=vec4(0);float txChinWeight=0.,txLineWidth=.03,txLineDepth=.004;
vec4 txShapeAt(int i){return txRegionWeights.x*txPrototypes[i]+txRegionWeights.y*txPrototypes[8+i]+txRegionWeights.z*txPrototypes[16+i]+txRegionWeights.w*txPrototypes[24+i]+txChinWeight*txPrototypes[32+i];}
uint txHash(uint x){x^=uint(txSeed)*2246822519u;x^=x>>16;x*=2246822519u;x^=x>>13;x*=3266489917u;return x^(x>>16);}
float txRand(ivec2 p,int salt){return float(txHash(uint(p.x)*1597334677u^uint(p.y)*3812015801u^uint(salt))>>8)*(1./16777216.);}
vec2 txNoiseGradient(vec2 p){ivec2 c=ivec2(floor(p));vec2 t=fract(p),w=t*t*t*(t*(t*6.-15.)+10.),dw=30.*t*t*(t-1.)*(t-1.);float a=txRand(c,977),b=txRand(c+ivec2(1,0),977),d=txRand(c+ivec2(0,1),977),e=txRand(c+ivec2(1,1),977);return vec2(mix(b-a,e-d,w.y)*dw.x,mix(d-a,e-b,w.x)*dw.y);}
// Height derivatives and correlated feature masks, evaluated in rest millimetres.
struct TxSample{vec2 grad;float pore;float groove;};
TxSample txPlane(vec2 p,float foot,float poreRegion,float lineRegion,float angle,int salt){
 TxSample o;o.grad=vec2(0);o.pore=0.;o.groove=0.;p/=txScale;foot/=txScale;
 float cell=.58;ivec2 c=ivec2(floor(p/cell));
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  ivec2 q=c+ivec2(x,y);float h=txRand(q,salt+11),occupancy=smoothstep(.12,.35,poreRegion+h*.6);
  vec2 centre=(vec2(q)+.05+.90*vec2(txRand(q,salt+17),txRand(q,salt+23)))*cell;
  vec4 shape=txShapeAt(min(7,int(h*8.)));float theta=angle+(txRand(q,salt+31)-.5)*2.2;vec2 axis=vec2(cos(theta),sin(theta)),crossAxis=vec2(-axis.y,axis.x),delta=p-centre;
  vec2 local=vec2(dot(delta,axis),dot(delta,crossAxis));
  float radius=shape.x*mix(.85,1.15,txRand(q,salt+37)),stretch=shape.y;
  vec2 r2=vec2(radius*radius,radius*radius*stretch*stretch),filtered=r2+foot*foot/6.,rimR2=r2/.30,rimFiltered=rimR2+foot*foot/6.;float coverage=sqrt(r2.x*r2.y/(filtered.x*filtered.y)),rimCoverage=sqrt(rimR2.x*rimR2.y/(rimFiltered.x*rimFiltered.y));
  float e=exp(-dot(local*local,1./filtered)),rim=exp(-dot(local*local,1./rimFiltered)),amplitude=shape.z*txPores*occupancy;
  vec2 localGrad=2.*amplitude*local*(coverage*e/filtered-shape.w*rimCoverage*rim/rimFiltered);
  o.grad+=axis*localGrad.x+crossAxis*localGrad.y;o.pore+=e*occupancy*coverage*txPores;
 }
 // A shallow, irregular connected microrelief under the longer furrows.
 // A fixed domain avoids phase twisting between regions. Secondary links
 // stay shallower than primary creases, with irregular pairwise strength.
 // Keep domain orientation fixed. Rotating absolute coordinates by a varying
 // region angle twists the field and creates distorted grids at transitions.
 float cs=cos(.77),sn=sin(.77);mat2 rot=mat2(cs,sn,-sn,cs);
 vec2 stretch=vec2(.72,1.28),u=rot*p*stretch/.49;ivec2 base=ivec2(floor(u));
 float first=1e9,second=1e9;vec2 a=vec2(0),b=vec2(0);ivec2 owner=base,otherOwner=base;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  ivec2 q=base+ivec2(x,y);vec2 site=vec2(q)+.08+.84*vec2(txRand(q,salt+151),txRand(q,salt+157));float d=dot(u-site,u-site);
  if(d<first){second=first;b=a;otherOwner=owner;first=d;a=site;owner=q;}else if(d<second){second=d;b=site;otherOwner=q;}
 }
 float separation=max(length(b-a),.001),edge=(second-first)/(2.*separation);vec2 edgeGrad=(a-b)/separation;
 float width=.039,filterWidth=sqrt(width*width+foot*foot/(12.*.49*.49));float e=exp(-.5*edge*edge/(filterWidth*filterWidth));
 float broken=.35+.35*txRand(owner+otherOwner,salt+163);float amp=.0020*txFurrows*lineRegion*broken*width/filterWidth;
 o.grad+=transpose(rot)*(stretch/.49*edgeGrad)*(amp*e*edge/(filterWidth*filterWidth));o.groove+=e*broken*.35*txFurrows;
 // Sparse longer primary furrows are gently curved and fade at both ends.
 cell=1.22;c=ivec2(floor(p/cell));
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  ivec2 q=c+ivec2(x,y);vec2 centre=(vec2(q)+vec2(txRand(q,salt+71),txRand(q,salt+73)))*cell;
  float a=angle+(txRand(q,salt+79)-.5)*1.55;vec2 axis=vec2(cos(a),sin(a)),crossAxis=vec2(-axis.y,axis.x),delta=p-centre;
  float u=dot(delta,axis),v=dot(delta,crossAxis),len=mix(.35,.95,txRand(q,salt+83));
  // Odd curvature preserves the same curve under a pi orientation wrap.
  float curve=(txRand(q,salt+87)-.5)*.38;v-=curve*u*u*u/(len*len);
  float width=txLineWidth*mix(.6,1.25,txRand(q,salt+89)),w2=width*width+foot*foot/12.;
  float end=exp(-pow(u/len,4.)),across=exp(-.5*v*v/w2),coverage=width/sqrt(w2),e=end*across;
  float amp=txLineDepth*lineRegion*txFurrows*mix(.45,1.2,txRand(q,salt+97))*coverage;
  o.grad+=amp*e*(crossAxis*v/w2+axis*(4.*u*u*u/pow(len,4.)-v/w2*3.*curve*u*u/(len*len)));o.groove+=e*coverage*txFurrows;
 }
 return o;
}
void txSurface(vec3 p,vec3 restN,vec3 sourceN,vec3 geomN,float foot,float cheek,float nose,float forehead,float chin,float gate){
 txGate=gate;txNose=nose;txForehead=forehead;txFoot=foot;
 float poreRegion=clamp(.28+.48*cheek+.72*nose+.18*forehead+.25*chin,0.,1.);
 float lineRegion=.55+.36*forehead+.28*cheek+.30*chin;
 float wr[5];wr[0]=forehead;wr[1]=max(0.,1.-max(max(cheek,nose),max(forehead,chin)));wr[2]=cheek;wr[3]=nose*1.6;wr[4]=chin;
 float sum=0.;for(int r=0;r<5;r++)sum+=wr[r];for(int r=0;r<5;r++)wr[r]/=max(sum,.00001);
 txRegionWeights=vec4(wr[0],wr[1],wr[2],wr[3]);txChinWeight=wr[4];float cs=0.,sn=0.;txLineWidth=0.;txLineDepth=0.;
 for(int r=0;r<5;r++){vec3 line=txRegionLines[r];txLineWidth+=wr[r]*line.x;txLineDepth+=wr[r]*line.z;cs+=wr[r]*cos(2.*line.y);sn+=wr[r]*sin(2.*line.y);}
 float angle=.5*atan(sn,cs)+p.x/sqrt(p.x*p.x+64.)*cheek*.24;
 vec3 w=pow(abs(restN),vec3(8));w/=max(dot(w,vec3(1)),.000001);vec3 gradient=vec3(0);txPoreMask=0.;txGrooveMask=0.;
 if(w.x>.001){TxSample s=txPlane(p.yz,foot,poreRegion,lineRegion,angle,101);gradient+=w.x*vec3(0,s.grad);txPoreMask+=w.x*s.pore;txGrooveMask+=w.x*s.groove;}
 if(w.y>.001){TxSample s=txPlane(p.xz,foot,poreRegion,lineRegion,angle,211);gradient+=w.y*vec3(s.grad.x,0,s.grad.y);txPoreMask+=w.y*s.pore;txGrooveMask+=w.y*s.groove;}
 if(w.z>.001){TxSample s=txPlane(p.xy,foot,poreRegion,lineRegion,angle,307);gradient+=w.z*vec3(s.grad,0);txPoreMask+=w.z*s.pore;txGrooveMask+=w.z*s.groove;}
 // Subpixel grain is filtered instead of enlarging it into visible wrinkles.
 float grainFilter=exp(-min(80.,foot*foot/(.055*.055)));
 vec2 grain=txNoiseGradient(p.xy/.055)*.032*txGrain*grainFilter;
 gradient+=vec3(grain,0);gradient-=restN*dot(gradient,restN);
 vec3 baseN=normalize(mix(geomN,sourceN,.10));txN=normalize(baseN-nativeToView(gradient));
 // Albedo variation does not paint highlights/shadows. Follicle colour is
 // subtle and separate from broad independent blood and melanin fields.
 txMicroColour=clamp(txPoreMask,0.,1.);
}
vec3 txBRDF(vec3 L,vec3 V,vec3 N){
 float nl=max(dot(N,L),.0001),nv=max(dot(N,V),.0001);vec3 H=normalize(L+V);float nh=max(dot(N,H),0.),vh=max(dot(V,H),0.);
 // The measured narrow lobes are kept as a partial oil coverage layer.
 // Bare skin uses broader unresolved roughness, preventing a continuous film.
 float oil=txOil*(.38+.62*max(txNose,txForehead));float m1=mix(.34,.17,oil),m2=mix(.22,.075,oil);
 float unresolved=.018*txGrain*txGrain*(1.-exp(-txFoot*txFoot/.006));m1=sqrt(m1*m1+unresolved);m2=sqrt(m2*m2+unresolved);
 float d1=mgD(nh,m1)/(1.+mgLambda(nl,m1)+mgLambda(nv,m1)),d2=mgD(nh,m2)/(1.+mgLambda(nl,m2)+mgLambda(nv,m2));
 float f0=.02006,f=f0+(1.-f0)*pow(1.-vh,5.);
 // Measured local height/specular correlations are weak (-.02 to -.12).
 // This is an authored conservative feature coupling, not recovered albedo.
 float correlation=1.+.08*clamp(txPoreMask,0.,1.)-.04*clamp(txGrooveMask,0.,1.);
 return vec3(f*mix(d1,d2,.08+.25*oil)*correlation/(4.*nl*nv));
}
void txSkinDirect(const in IncidentLight light,const in vec3 pos,const in vec3 N,const in vec3 V,const in vec3 CN,const in PhysicalMaterial material,inout ReflectedLight reflectedLight){vec3 before=reflectedLight.directSpecular;mgSkinDirect(light,pos,N,V,CN,material,reflectedLight);if(txEnabled>.5&&txGate>0.){vec3 spec=light.color*hcEarVisibility(light.direction)*max(dot(txN,light.direction),0.)*txBRDF(light.direction,V,txN);reflectedLight.directSpecular=mix(reflectedLight.directSpecular,before+spec,txGate);}}
#undef RE_Direct
#define RE_Direct txSkinDirect
`;
export function surfaceTextureFragment(source){
 const declaration='#define RE_Direct mgSkinDirect',entry='if(u_nativeMode==1){',output='vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;';
 for(const key of [declaration,entry,output])if(source.split(key).length!==2)throw Error('皮肤纹理挂接点改变：'+key);
 const hook=`if(txEnabled>.5&&(u_nativeMode==0||u_nativeMode==1)){
 float facial=smoothstep(-8.,30.,psMM.z)*smoothstep(205.,232.,psMM.y)*(1.-smoothstep(356.,380.,psMM.y));float gate=facial*fbHead*(1.-psLipFeather)*(1.-psE)*(1.-clamp(lidGate,0.,1.));
 txSurface(psMM,normalize(psRestN),normal,normalize(fbGeomN),psFoot,fbCheek,fbNose,r7Forehead,r7Jaw,gate);
 float vascular=bcNoise(psMM/1.45+vec3(17.,float(txSeed)*.013,31.),1049u)-.5;
 float pigment=bcNoise(psMM/.65+vec3(7.,39.,float(txSeed)*.021),1061u)-.5;
 vec3 colourDepth=vec3(.055,.080,.095)*txMicroColour+vec3(.015,.12,.077)*vascular*(.3+.7*fbCheek)+vec3(.045,.07,.10)*pigment;
 material.diffuseColor*=exp(-colourDepth*txColour*gate);
 if(u_nativeMode==0){normal=normalize(mix(normal,txN,gate));material.clearcoat*=1.-gate;material.roughness=mix(material.roughness,mix(.64,.40,txOil),gate);}
 }
 `;
 return source.replace(declaration,declaration+'\n'+glsl).replace(entry,hook+entry).replace(output,output+'\nif(txEnabled>.5&&txView>.5&&txView<1.5)outgoingLight=txN*.5+.5;\nif(txEnabled>.5&&txView>1.5&&txView<2.5)outgoingLight=vec3(clamp(txPoreMask*.6,0.,1.));\nif(txEnabled>.5&&txView>2.5)outgoingLight=vec3(clamp(txGrooveMask*.7,0.,1.));');
}
