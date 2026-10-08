import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const $=id=>document.getElementById(id),VERSION='skin-quality-lab/r02.2-identities';
const defaults={roughness:.5,oil:.25,detail:.75,pores:.24,poreSize:.32,fuzz:.32,pigment:.22,blood:.25,sss:.85,radius:1.2,azimuth:-46,exposure:1.03,meso:1.1,micro:1.25,relief:.7,translucency:.65,occlusion:.9};
const values={...defaults};
const presets={natural:{...defaults},dry:{...defaults,roughness:.66,oil:.04,detail:.94,pores:.48,sss:.48},oily:{...defaults,roughness:.32,oil:.78,detail:.72,pores:.32,sss:.72},warm:{...defaults,pigment:.62,blood:.42,roughness:.46,oil:.3,sss:.72}};
const state={ready:false,version:VERSION,errors:[],layer:'beauty',light:'studio',camera:'portrait',baseline:false,frames:0,quality:'high',fps:0};
window.__SKIN_LAB__={state,values,defaults};
document.title='皮肤质感实验室 · R02.2 三套表皮';document.querySelector('.version').textContent='R02.2 · 3 SKINS';document.querySelector('.caption-title').textContent='皮肤 / 近景与微结构';
const viewport=$('viewport');let albedoRT,entryRT,entryCamera,entryMaterial,entryDirty=true;
let renderer,scene,camera,controls,mesh,skin,fuzz,fullRT,diffRT,blurA,blurB,blurMaterial,composeMaterial,quad,postScene,postCamera,key,fill,rim,pmremTarget,dirty=true,shader,compareHeld=false,last=performance.now(),frameCount=0,lastStat=last;
const U={uPass:{value:0},uDetail:{value:values.detail},uPores:{value:values.pores},uPoreFrequency:{value:450/values.poreSize},uPigment:{value:values.pigment},uBlood:{value:values.blood},uScatter:{value:values.sss},uOil:{value:values.oil},uHeight:{value:null},uSpec:{value:null},uBaseline:{value:0},uLayer:{value:0}};
const E={uOcclusion:{value:.9},uMeso:{value:.7},uMicro:{value:.8},uRelief:{value:.7},uTranslucency:{value:.65},uMesoMap:{value:null},uMicroMap:{value:null},uSurface:{value:null},uKeyDepth:{value:null},uKeyVP:{value:new THREE.Matrix4()},uKeyDirection:{value:new THREE.Vector3()},uKeyEnergy:{value:new THREE.Color()},uKeyRange:{value:1.99}};
Object.assign(U,E);Object.assign(U,{uIdentityEnabled:{value:0},uIdentityRoughness:{value:null},uIdentityFeatures:{value:null},uIdentityRoughnessBase:{value:.5}});
function toast(s){$('toast').textContent=s;$('toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.display='none',2200)}
function fail(e){const message=e?.message||String(e);state.errors.push(message);$('loading').style.display='flex';$('loadingText').textContent='场景未完成载入：'+message;$('status').textContent='载入失败';console.error(e)}
window.addEventListener('error',e=>state.errors.push(e.message));window.addEventListener('unhandledrejection',e=>state.errors.push(String(e.reason)));
function subdivide(g){const oldP=g.attributes.position,oldN=g.attributes.normal,oldUV=g.attributes.uv,idx=g.index.array;const ao=g.attributes.skinOcclusion?Array.from(g.attributes.skinOcclusion.array):Array(oldP.count).fill(1);const p=Array.from(oldP.array),n=Array.from(oldN.array),uv=Array.from(oldUV.array),out=[],edges=new Map();
 function mid(a,b){const k=a<b?a+':'+b:b+':'+a;if(edges.has(k))return edges.get(k);const i=p.length/3;ao.push((ao[a]+ao[b])*.5);let x=(p[a*3]+p[b*3])/2,y=(p[a*3+1]+p[b*3+1])/2,z=(p[a*3+2]+p[b*3+2])/2;const da=(x-p[a*3])*n[a*3]+(y-p[a*3+1])*n[a*3+1]+(z-p[a*3+2])*n[a*3+2];const db=(x-p[b*3])*n[b*3]+(y-p[b*3+1])*n[b*3+1]+(z-p[b*3+2])*n[b*3+2];x-=.32*(da*n[a*3]+db*n[b*3]);y-=.32*(da*n[a*3+1]+db*n[b*3+1]);z-=.32*(da*n[a*3+2]+db*n[b*3+2]);p.push(x,y,z);let nx=n[a*3]+n[b*3],ny=n[a*3+1]+n[b*3+1],nz=n[a*3+2]+n[b*3+2],l=Math.hypot(nx,ny,nz)||1;n.push(nx/l,ny/l,nz/l);uv.push((uv[a*2]+uv[b*2])/2,(uv[a*2+1]+uv[b*2+1])/2);edges.set(k,i);return i}
 for(let t=0;t<idx.length;t+=3){const a=idx[t],b=idx[t+1],c=idx[t+2],ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);out.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca)}const q=new THREE.BufferGeometry();q.setAttribute('position',new THREE.Float32BufferAttribute(p,3));q.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));q.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));q.setIndex(out);q.setAttribute("skinOcclusion",new THREE.Float32BufferAttribute(ao,1));return q}

const skinFunctions=`
uniform float uIdentityEnabled,uIdentityRoughnessBase;uniform sampler2D uIdentityRoughness,uIdentityFeatures;
uniform float uPass,uDetail,uPores,uPoreFrequency,uPigment,uBlood,uScatter,uOil,uBaseline,uLayer;
uniform sampler2D uHeight,uSpec,uMesoMap,uMicroMap,uSurface,uKeyDepth;
uniform float uMeso,uMicro,uRelief,uTranslucency,uKeyRange;
uniform mat4 uKeyVP;uniform vec3 uKeyDirection,uKeyEnergy;
varying vec3 vSkinPosition;
float skinNoise(vec3 p){p=mat3(2.,1.,-2.,-2.,2.,-1.,1.,2.,2.)*(p/3.);vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);vec4 h=vec4(dot(i,vec3(127.1,311.7,74.7)))+vec4(0.,127.1,311.7,438.8);vec4 a=fract(sin(h)*43758.5453),b=fract(sin(h+74.7)*43758.5453);vec4 z=mix(a,b,f.z);return mix(mix(z.x,z.y,f.x),mix(z.z,z.w,f.x),f.y)*2.-1.;}
vec2 skinHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
float poresAt(vec2 uv){vec2 p=uv*uPoreFrequency;p+=vec2(.13*sin(p.y*.036),.1*sin(p.x*.041));vec2 cell=floor(p),f=fract(p);float h=0.;for(int y=-1;y<=1;y++){for(int x=-1;x<=1;x++){vec2 c=vec2(float(x),float(y)),rnd=skinHash(cell+c),d=c+.2+.6*rnd-f;float angle=6.28*rnd.x+.5*sin(uv.y*20.);d=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*d;d*=vec2(1.35,.8+.35*rnd.y);float r=dot(d,d);h+=(-exp(-r*75.)+.2*exp(-r*22.))*(.65+.5*rnd.x);}}return h;}
float skinThickness(vec3 p){vec4 q=uKeyVP*vec4(p,1.);q.xyz=q.xyz/q.w*.5+.5;if(q.x<.002||q.x>.998||q.y<.002||q.y>.998)return 1.;float frontDepth=unpackRGBAToDepth(texture2D(uKeyDepth,q.xy));return max(0.,(q.z-frontDepth)*uKeyRange);}
`;
function configureSkin(albedo,normal,height,spec){
 U.uHeight.value=height;U.uSpec.value=spec;
 skin=new THREE.MeshPhysicalMaterial({map:albedo,normalMap:normal,normalScale:new THREE.Vector2(.72,.72),roughness:values.roughness,metalness:0,ior:1.42,specularIntensity:.85,clearcoat:values.oil*.6,clearcoatRoughness:.24,clearcoatNormalMap:normal,clearcoatNormalScale:new THREE.Vector2(.45,.45),envMapIntensity:.55});
 skin.customProgramCacheKey=()=>VERSION;
 skin.onBeforeCompile=s=>{shader=s;Object.assign(s.uniforms,U);
 s.vertexShader='attribute float skinOcclusion;varying float vSkinAO;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSkinPosition;uniform sampler2D uSurface,uIdentityFeatures;uniform float uRelief,uBaseline,uIdentityEnabled;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=normal*((texture2D(uSurface,uv).b-.5)+uIdentityEnabled*(texture2D(uIdentityFeatures,uv).b-.5))*uRelief*.001*(1.-uBaseline);vSkinPosition=transformed;vSkinAO=skinOcclusion;');
 s.fragmentShader='varying float vSkinAO;uniform float uOcclusion;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <packing>','#include <packing>\n'+skinFunctions);
 s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 float skinVariation=skinNoise(vSkinPosition*105.);float skinFront=smoothstep(-.025,.055,vSkinPosition.z);float skinCheeks=exp(-pow((abs(vSkinPosition.x)-.041)/.025,2.)-pow((vSkinPosition.y-.016)/.033,2.))*skinFront;float skinEar=smoothstep(.069,.092,abs(vSkinPosition.x))*(1.-smoothstep(.045,.082,abs(vSkinPosition.y-.025)));
 float skinZone=clamp(skinCheeks+.65*skinEar,0.,1.);
 if(uBaseline<.5){diffuseColor.rgb*=exp(-uPigment*vec3(1.0,1.43,1.8));diffuseColor.rgb*=1.+skinVariation*.026;diffuseColor.rgb*=vec3(1.+uBlood*skinZone*.11,1.-uBlood*skinZone*.18,1.-uBlood*skinZone*.14);}
 `);
 s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 if(uPass>1.5){gl_FragColor=vec4(diffuseColor.rgb,1.);return;}
 float skinSpecMask=texture2D(uSpec,vMapUv).r;vec3 skinSurface=texture2D(uSurface,vMapUv).rgb;
 if(uIdentityEnabled>.5)roughnessFactor=clamp(texture2D(uIdentityRoughness,vMapUv).g+roughnessFactor-uIdentityRoughnessBase,.24,.85);
 if(uBaseline<.5){roughnessFactor=clamp(roughnessFactor+(.45-skinSpecMask)*.24+(skinSurface.g-.5)*.12+skinVariation*.012-uOil*skinSpecMask*.06,.24,.85);}
 `);
 s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`
 vec3 mapN=texture2D(normalMap,vNormalMapUv).xyz*2.-1.;mapN.xy*=normalScale*(uBaseline>.5?1.:uDetail);
 if(uBaseline<.5){vec3 mesoN=texture2D(uMesoMap,vNormalMapUv).rgb*2.-1.;vec3 microN=texture2D(uMicroMap,vNormalMapUv).rgb*2.-1.;
 vec2 slopes=mapN.xy/max(mapN.z,.2)+mesoN.xy/max(mesoN.z,.3)*uMeso+microN.xy/max(microN.z,.3)*uMicro;
 float pore=poresAt(vNormalMapUv);vec2 ux=dFdx(vNormalMapUv),uy=dFdy(vNormalMapUv);float det=ux.x*uy.y-ux.y*uy.x;
 vec2 grad=vec2(dFdx(pore)*uy.y-dFdy(pore)*ux.y,dFdy(pore)*ux.x-dFdx(pore)*uy.x)/max(abs(det),1e-14)*sign(det);
 float aa=1.-smoothstep(.6,1.6,max(length(ux),length(uy))*uPoreFrequency);float faceZone=.55+.45*skinCheeks;
 slopes-=clamp(grad,vec2(-7000.),vec2(7000.))*uPores*.00012*aa*faceZone;mapN=normalize(vec3(slopes,1.));}
 normal=normalize(tbn*mapN);
 `);
 s.fragmentShader=s.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>
 #ifdef USE_CLEARCOAT
 if(uBaseline<.5)clearcoatNormal=normal;
 #endif
 `);
 s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
 #ifdef USE_CLEARCOAT
 material.clearcoat*=uBaseline>.5||uOil<.00001?0.:clamp(.35+1.2*skinSpecMask,.25,1.);
 material.clearcoatRoughness=clamp(material.clearcoatRoughness+(skinSurface.g-.5)*.12,.19,.5);
 #endif
 `);
 let physical=THREE.ShaderChunk.lights_physical_pars_fragment;
 physical=physical.replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',`
 float nl=dot(geometryNormal,directLight.direction);vec3 w=max(vec3(nl)+vec3(.12,.035,.015),vec3(0.))/vec3(1.2544,1.071225,1.030225);
 reflectedLight.directDiffuse+=mix(vec3(dotNL),w,uScatter*.28*(1.-uBaseline))*directLight.color*BRDF_Lambert(material.diffuseColor);
 `);
 s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_pars_fragment>',physical);
 s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>\n float skinVisibility=mix(1.,clamp(vSkinAO,.12,1.),uOcclusion*(1.-uBaseline));reflectedLight.indirectDiffuse*=skinVisibility;reflectedLight.indirectSpecular*=sqrt(skinVisibility);`);
 s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',`
 vec3 skinDiffuseOnly=totalDiffuse;
 #ifdef USE_CLEARCOAT
 skinDiffuseOnly*=1.-material.clearcoat*Fcc;
 #endif
 vec3 worldN=inverseTransformDirection(nonPerturbedNormal,viewMatrix);float thickness=skinThickness(vSkinPosition-worldN*.00012);float backFacing=max(dot(-worldN,uKeyDirection),0.);
 float forward=max(dot(normalize(vViewPosition),normalize((viewMatrix*vec4(-uKeyDirection,0.)).xyz)),0.);float distanceMM=max(thickness*1000.,.2);
 vec3 trans=exp(-distanceMM/vec3(2.8,.7,.35))*backFacing*(.3+.7*pow(forward,2.))*uTranslucency*(1.-uBaseline)*uKeyEnergy*diffuseColor.rgb*.8;
 skinDiffuseOnly+=trans;outgoingLight+=trans;float microCavity=mix(1.,clamp(.93+.14*skinSurface.r,.86,1.07),1.-uBaseline);
 outgoingLight+=skinDiffuseOnly*(microCavity-1.);skinDiffuseOnly*=microCavity;
 if(uPass>.5&&uPass<1.5)outgoingLight=skinDiffuseOnly;if(uPass>1.5)outgoingLight=diffuseColor.rgb;
 if(uLayer>.5&&uLayer<1.5)outgoingLight=diffuseColor.rgb;
 if(uLayer>1.5&&uLayer<2.5)outgoingLight=normal*.5+.5;
 if(uLayer>2.5&&uLayer<3.5)outgoingLight=vec3(roughnessFactor);
 #include <opaque_fragment>
 `);
 };
}

function makeEnvironment(){const envScene=new THREE.Scene();envScene.background=new THREE.Color(.12,.13,.15);function card(w,h,pos,color){let m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(...color),side:THREE.DoubleSide}));m.position.set(...pos);m.lookAt(0,0,0);envScene.add(m)}card(2.2,3.5,[-3,2,3],[7,6.7,6.3]);card(1.5,3,[3,1,1],[1.8,2.1,2.6]);card(3,1,[0,4,-2],[3.8,4.1,4.6]);card(1,3,[2,1,-4],[2.2,2.7,3.4]);const p=new THREE.PMREMGenerator(renderer);pmremTarget=p.fromScene(envScene,.035,.1,30);scene.environment=pmremTarget.texture;p.dispose();envScene.traverse(o=>{o.geometry?.dispose();o.material?.dispose()})}

function makeFuzz(geo){
 let seed=20261007;const rand=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296};
 const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv,idx=geo.index.array;
 const area=new Float64Array(idx.length/3);let sum=0;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),tmp=new THREE.Vector3(),edge=new THREE.Vector3();
 for(let i=0;i<idx.length;i+=3){a.fromBufferAttribute(p,idx[i]);b.fromBufferAttribute(p,idx[i+1]);c.fromBufferAttribute(p,idx[i+2]);sum+=tmp.subVectors(b,a).cross(edge.subVectors(c,a)).length()*.5;area[i/3]=sum;}
 const ps=[],ns=[],tans=[],uvs=[],st=[],sides=[],ix=[];let count=0;
 const nn=new THREE.Vector3(),tangent=new THREE.Vector3(),q=new THREE.Vector3(),v=new THREE.Vector3(),flow=new THREE.Vector3(.12,-1,.06);
 for(let k=0;k<60000&&count<14000;k++){
  const pick=rand()*sum;let lo=0,hi=area.length-1;while(lo<hi){let mid=(lo+hi)>>>1;if(area[mid]<pick)lo=mid+1;else hi=mid;}
  const f=lo*3,ia=idx[f],ib=idx[f+1],ic=idx[f+2];let u=rand(),w=rand();if(u+w>1){u=1-u;w=1-w}
  a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);q.copy(a).multiplyScalar(1-u-w).addScaledVector(b,u).addScaledVector(c,w);
  if(q.y<-.105||q.y>.155||q.z<-.055)continue;
  const ax=Math.abs(q.x);if(ax<.027&&q.y>-.081&&q.y<-.016&&q.z>.055)continue;
  if(ax<.019&&q.y>-.012&&q.y<.095&&q.z>.08)continue;
  if(q.y>.08&&rand()>.42)continue;
  nn.set(n.getX(ia)*(1-u-w)+n.getX(ib)*u+n.getX(ic)*w,n.getY(ia)*(1-u-w)+n.getY(ib)*u+n.getY(ic)*w,n.getZ(ia)*(1-u-w)+n.getZ(ib)*u+n.getZ(ic)*w).normalize();
  flow.set(.12*Math.sign(q.x),-1,.07);tangent.copy(flow).addScaledVector(nn,-nn.dot(flow)).normalize();
  const length=.00035+rand()*.0011,uu=uv.getX(ia)*(1-u-w)+uv.getX(ib)*u+uv.getX(ic)*w,vv=uv.getY(ia)*(1-u-w)+uv.getY(ib)*u+uv.getY(ic)*w;
  const offset=ps.length/3;
  for(let j=0;j<=3;j++){let t=j/3;v.copy(q).addScaledVector(nn,.000012+length*t*.55).addScaledVector(tangent,length*t*t*.75);
   for(const side of [-1,1]){ps.push(v.x,v.y,v.z);ns.push(nn.x,nn.y,nn.z);tans.push(nn.x*.55+tangent.x*t*1.5,nn.y*.55+tangent.y*t*1.5,nn.z*.55+tangent.z*t*1.5);uvs.push(uu,vv);st.push(t);sides.push(side);}
   if(j<3){let j0=offset+j*2;ix.push(j0,j0+1,j0+2,j0+1,j0+3,j0+2);}}
  count++;
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(ns,3));g.setAttribute('tangentHair',new THREE.Float32BufferAttribute(tans,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('strandT',new THREE.Float32BufferAttribute(st,1));g.setAttribute('strandSide',new THREE.Float32BufferAttribute(sides,1));g.setIndex(ix);
 const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uFuzz:{value:values.fuzz},uRelief:E.uRelief,uSurface:E.uSurface,uPixelHeight:{value:1000},uLightDir:{value:new THREE.Vector3(-.5,.5,.6)},uLightPower:{value:2.45}},
 vertexShader:`attribute vec3 tangentHair;attribute float strandT,strandSide;uniform sampler2D uSurface;uniform float uRelief,uPixelHeight;varying float vt,vs,coverage;varying vec3 vn,vv,vHair;
 void main(){vt=strandT;vs=strandSide;vec3 pp=position+normal*(texture2D(uSurface,uv).b-.5)*uRelief*.001;vec4 p=modelViewMatrix*vec4(pp,1.);vv=-p.xyz;vn=normalize(normalMatrix*normal);vHair=normalize(mat3(modelViewMatrix)*tangentHair);vec3 across=normalize(cross(vHair,normalize(vv)));float width=.000008*(1.-.8*vt);float pixel=-p.z/(projectionMatrix[1][1]*uPixelHeight*.5);float halfwidth=max(width,pixel*.48);coverage=width/halfwidth;p.xyz+=across*strandSide*halfwidth;gl_Position=projectionMatrix*p;}`,
 fragmentShader:`uniform float uFuzz,uLightPower;uniform vec3 uLightDir;varying float vt,vs,coverage;varying vec3 vn,vv,vHair;
 void main(){vec3 N=normalize(vn),V=normalize(vv),L=normalize(uLightDir),T=normalize(vHair);float edge=pow(1.-abs(dot(N,V)),1.8);float lam=max(dot(N,L),0.);float longitudinal=sqrt(max(1.-pow(dot(T,normalize(L+V)),2.),0.));float sheen=pow(longitudinal,22.)*(.1+.9*edge);float alpha=uFuzz*coverage*(1.-smoothstep(.25,1.,abs(vs)))*(.6+.4*edge)*smoothstep(0.,.09,vt)*(1.-smoothstep(.82,1.,vt));vec3 col=vec3(.34,.24,.16)*(.22+lam*uLightPower*.4)+vec3(.6,.48,.32)*sheen*uLightPower*.22;gl_FragColor=vec4(col,alpha);}`});
 fuzz=new THREE.Mesh(g,mat);fuzz.frustumCulled=false;scene.add(fuzz);state.fuzzStrands=count;state.fuzzTriangles=g.index.count/3;
}

// Uses Separable SSS. Copyright (C) 2012 Jorge Jimenez and Diego Gutierrez.
// Modified GLSL pipeline; see THIRD_PARTY.txt for the required license.
function diffusionKernel(){
 const center=[.530605,.613514,.739601,0];
 const half=[[.000973794,.0000111862,.000000943437,3],[.00333804,.0000785443,.000012945,2.52083],[.00500364,.00020094,.0000528848,2.08333],[.00700976,.00049366,.000151938,1.6875],[.0094389,.00139119,.000416598,1.33333],[.0128496,.00356329,.00132016,1.02083],[.017924,.00711691,.00347194,.75],[.0263642,.0119715,.00684598,.520833],[.0410172,.0199899,.0118481,.333333],[.0493588,.0367726,.0219485,.1875],[.0402784,.0657244,.04631,.0833333],[.0211412,.0459286,.0378196,.0208333]];
 return [new THREE.Vector4(...center),...half.map(v=>new THREE.Vector4(v[0],v[1],v[2],-v[3])),...half.map(v=>new THREE.Vector4(...v))];
}
function initEntry(){
 entryRT=new THREE.WebGLRenderTarget(2048,2048,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
 entryCamera=new THREE.OrthographicCamera(-.23,.23,.23,-.23,.01,2);
 entryMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
 entryMaterial.onBeforeCompile=s=>{
  Object.assign(s.uniforms,{uSurface:E.uSurface,uRelief:E.uRelief,uBaseline:U.uBaseline,uIdentityFeatures:U.uIdentityFeatures,uIdentityEnabled:U.uIdentityEnabled});
  s.vertexShader='attribute float skinOcclusion;varying float vSkinAO;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform sampler2D uSurface,uIdentityFeatures;uniform float uRelief,uBaseline,uIdentityEnabled;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=normal*((texture2D(uSurface,uv).b-.5)+uIdentityEnabled*(texture2D(uIdentityFeatures,uv).b-.5))*uRelief*.001*(1.-uBaseline);');
 };
 mesh.customDepthMaterial=entryMaterial;E.uKeyDepth.value=entryRT.texture;
}
function renderEntry(){
 if(!entryDirty)return;
 entryCamera.position.copy(key.position);entryCamera.lookAt(key.target.position);entryCamera.updateMatrixWorld();entryCamera.updateProjectionMatrix();
 E.uKeyVP.value.multiplyMatrices(entryCamera.projectionMatrix,entryCamera.matrixWorldInverse);
 E.uKeyDirection.value.copy(key.position).sub(key.target.position).normalize();
 E.uKeyEnergy.value.copy(key.color).multiplyScalar(key.intensity);
 const bg=scene.background,cc=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha(),fv=fuzz.visible,ss=renderer.shadowMap.enabled;
 scene.background=null;fuzz.visible=false;scene.overrideMaterial=entryMaterial;renderer.shadowMap.enabled=false;
 renderer.setClearColor(0xffffff,1);renderer.setRenderTarget(entryRT);renderer.clear();renderer.render(scene,entryCamera);
 scene.overrideMaterial=null;scene.background=bg;fuzz.visible=fv;renderer.setClearColor(cc,alpha);renderer.shadowMap.enabled=ss;entryDirty=false;
}

const quadVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;

const blurFragment=`precision highp float;
 varying vec2 vUv;uniform sampler2D tColor,tDepth,tAlbedo;uniform vec2 direction;
 uniform float radius,projectionScale,nearPlane,farPlane,firstPass;uniform vec4 kernel[25];
 float vz(float d){return nearPlane*farPlane/(farPlane-d*(farPlane-nearPlane));}
 vec3 splitColor(vec2 p){vec3 c=texture2D(tColor,p).rgb;if(firstPass>.5)c/=sqrt(max(texture2D(tAlbedo,p).rgb,vec3(.025)));return c;}
 void main(){vec4 center=texture2D(tColor,vUv);if(center.a<.5){gl_FragColor=center;return;}
 vec3 albedo=texture2D(tAlbedo,vUv).rgb;float z=vz(texture2D(tDepth,vUv).r);float absorb=mix(.62,1.,smoothstep(.04,.45,dot(albedo,vec3(.2126,.7152,.0722))));float pixels=clamp(radius*.001*projectionScale/z*absorb,.1,35.);
 vec3 middle=splitColor(vUv),sum=middle*kernel[0].rgb;
 for(int i=1;i<25;i++){vec2 p=vUv+direction*pixels*kernel[i].w;float nz=vz(texture2D(tDepth,p).r);float visible=step(.5,texture2D(tColor,p).a);float distance=abs(nz-z);float sameSurface=exp(-distance/max(.0004,radius*.0015))*visible;sum+=mix(middle,splitColor(p),sameSurface)*kernel[i].rgb;}
 gl_FragColor=vec4(sum,center.a);
}`;
const composeFragment=`precision highp float;varying vec2 vUv;uniform sampler2D tFull,tDiffuse,tBlur,tAlbedo;uniform float strength,exposure,mode;
 vec3 srgb(vec3 c){return mix(12.92*c,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
 vec3 film(vec3 x){x=max(x,vec3(0.));return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
 void main(){vec4 f=texture2D(tFull,vUv);vec3 d=texture2D(tDiffuse,vUv).rgb,b=texture2D(tBlur,vUv).rgb;b*=sqrt(max(texture2D(tAlbedo,vUv).rgb,vec3(.025)));vec3 diff=mix(d,b,strength);vec3 c=max(vec3(0.),f.rgb+diff-d);if(mode>3.5&&mode<4.5)c=max(vec3(0.),f.rgb-d);if(mode>4.5)c=diff;vec2 p=(vUv-.5)*vec2(1.2,1.);float halo=exp(-dot(p,p)*4.5);vec3 bg=mix(vec3(.008,.0095,.013),vec3(.026,.03,.038),halo);if(mode>.5&&mode<3.5){gl_FragColor=vec4(mix(srgb(bg),mode>1.5&&mode<2.5?f.rgb:srgb(max(f.rgb,0.)),f.a),1.);}else{gl_FragColor=vec4(srgb(film(mix(bg,c,f.a)*exposure)),1.);}}
`;

function target(depth=false){const t=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:depth,stencilBuffer:false});if(depth)t.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);t.samples=depth?4:0;return t}
function initPost(){albedoRT=target(true);fullRT=target(true);diffRT=target(true);blurA=target();blurB=target();blurMaterial=new THREE.ShaderMaterial({vertexShader:quadVertex,fragmentShader:blurFragment,depthTest:false,depthWrite:false,uniforms:{tColor:{value:null},tAlbedo:{value:albedoRT.texture},firstPass:{value:1},kernel:{value:diffusionKernel()},tDepth:{value:diffRT.depthTexture},direction:{value:new THREE.Vector2()},radius:{value:values.radius},projectionScale:{value:1},nearPlane:{value:camera.near},farPlane:{value:camera.far}}});composeMaterial=new THREE.ShaderMaterial({vertexShader:quadVertex,fragmentShader:composeFragment,depthTest:false,depthWrite:false,uniforms:{tAlbedo:{value:albedoRT.texture},tFull:{value:fullRT.texture},tDiffuse:{value:diffRT.texture},tBlur:{value:blurB.texture},strength:{value:values.sss},exposure:{value:values.exposure},mode:{value:0}}});quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),composeMaterial);postScene=new THREE.Scene();postScene.add(quad);postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1)}
function resize(){if(!renderer)return;const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;const scale={high:Math.min(devicePixelRatio,1.5),medium:1,low:.7}[state.quality];renderer.setPixelRatio(scale);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();const W=Math.round(w*scale),H=Math.round(h*scale);for(const t of [fullRT,diffRT,blurA,blurB,albedoRT])t.setSize(W,H);blurMaterial.uniforms.projectionScale.value=camera.projectionMatrix.elements[5]*H*.5;state.resolution=[W,H];dirty=true;}
function lighting(){entryDirty=true;let a=THREE.MathUtils.degToRad(values.azimuth),e=.28,keyI=2.4,fillI=.12,rimI=.45,env=.3;if(state.light==='raking'){e=.12;keyI=3.15;fillI=.055;rimI=.3;env=.24}if(state.light==='back'){e=.3;keyI=4.3;fillI=.48;rimI=.25;env=.25}if(state.light==='daylight'){e=.65;keyI=1.65;fillI=.5;rimI=.35;env=.95}key.position.set(Math.sin(a)*.65,e,Math.cos(a)*.65);key.intensity=keyI;fill.intensity=fillI;rim.intensity=rimI;skin.envMapIntensity=env;scene.environmentRotation.y=a+.66;renderer.shadowMap.needsUpdate=true;dirty=true;}
function setCamera(which){state.camera=which;const narrow=viewport.clientWidth/viewport.clientHeight<.9;const views={portrait:{p:[.105,.047,narrow?.76:.59],t:[0,.044,.016]},front:{p:[0,.042,narrow?.78:.62],t:[0,.035,.008]},cheek:{p:[.144,.061,.255],t:[.039,.023,.057]},ear:{p:[.32,.054,.16],t:[.075,.025,0]}};let v=views[which]||views.portrait;camera.position.set(...v.p);controls.target.set(...v.t);controls.update();document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===which));dirty=true;}
function apply(){E.uOcclusion.value=values.occlusion;E.uMeso.value=values.meso;E.uMicro.value=values.micro;E.uRelief.value=values.relief;E.uTranslucency.value=values.translucency;entryDirty=true;Object.assign(U.uDetail,{value:values.detail});U.uPores.value=values.pores;U.uPoreFrequency.value=450/values.poreSize;U.uPigment.value=values.pigment;U.uBlood.value=values.blood;U.uScatter.value=values.sss;U.uOil.value=values.oil;if(skin){skin.roughness=values.roughness;skin.clearcoat=Math.max(.00001,compareHeld?0:values.oil*.68);skin.clearcoatRoughness=.36-values.oil*.14;fuzz.material.uniforms.uFuzz.value=values.fuzz;composeMaterial.uniforms.strength.value=compareHeld?0:values.sss;composeMaterial.uniforms.exposure.value=values.exposure;blurMaterial.uniforms.radius.value=values.radius;lighting()}for(const id of Object.keys(defaults)){const el=$(id);el.value=values[id];$(id+'Out').textContent=id==='poreSize'||id==='radius'?values[id].toFixed(2)+' mm':id==='azimuth'?values[id].toFixed(0)+'°':values[id].toFixed(2)}dirty=true;}
function updateLayer(){state.layer=$('layer').value;const num={beauty:0,albedo:1,normal:2,roughness:3,specular:4,diffuse:5}[state.layer];U.uLayer.value=num<4?num:0;composeMaterial.uniforms.mode.value=num;$('layerLabel').textContent=$('layer').selectedOptions[0].text+' · '+$('lightPreset').selectedOptions[0].text.split(' · ')[0];dirty=true;}
function baseline(on){compareHeld=on;state.baseline=on;U.uBaseline.value=on?1:0;$('baselineBadge').style.display=on?'block':'none';$('compare').classList.toggle('active',on);apply()}
function render(){if(!state.ready)return;renderEntry();renderer.shadowMap.autoUpdate=false;fuzz.material.uniforms.uLightDir.value.copy(E.uKeyDirection.value).transformDirection(camera.matrixWorldInverse);fuzz.material.uniforms.uLightPower.value=key.intensity;fuzz.material.uniforms.uPixelHeight.value=fullRT.height;U.uPass.value=0;fuzz.visible=(values.fuzz>0||identityRuntime?.hasHair())&&!compareHeld&&state.layer==='beauty';renderer.setRenderTarget(fullRT);renderer.clear();renderer.render(scene,camera);renderer.shadowMap.needsUpdate=false;U.uPass.value=1;fuzz.visible=false;renderer.setRenderTarget(diffRT);renderer.clear();renderer.render(scene,camera);U.uPass.value=2;renderer.setRenderTarget(albedoRT);renderer.clear();renderer.render(scene,camera);U.uPass.value=0;const sssActive=values.sss>0&&!compareHeld&&['beauty','diffuse'].includes(state.layer);quad.material=blurMaterial;blurMaterial.uniforms.firstPass.value=1;blurMaterial.uniforms.tColor.value=diffRT.texture;blurMaterial.uniforms.direction.value.set(1/fullRT.width,0);renderer.setRenderTarget(blurA);renderer.render(postScene,postCamera);blurMaterial.uniforms.firstPass.value=0;blurMaterial.uniforms.tColor.value=blurA.texture;blurMaterial.uniforms.direction.value.set(0,1/fullRT.height);renderer.setRenderTarget(blurB);renderer.render(postScene,postCamera);quad.material=composeMaterial;composeMaterial.uniforms.strength.value=sssActive?values.sss:0;renderer.setRenderTarget(null);renderer.render(postScene,postCamera);state.frames++;dirty=false;}
function tick(now){requestAnimationFrame(tick);const dt=Math.min(.08,(now-last)/1000);last=now;const moving=controls.update();if($('rotateLight').checked){values.azimuth+=dt*8;if(values.azimuth>160)values.azimuth=-160;$('azimuth').value=values.azimuth;$('azimuthOut').textContent=values.azimuth.toFixed(0)+'°';lighting()}if(dirty||moving){render();frameCount++}if(now-lastStat>1500){state.fps=frameCount*1000/(now-lastStat);frameCount=0;lastStat=now;$('stats').textContent=state.resolution.join(' × ')+' / '+Math.round(mesh.geometry.index.count/3/1000)+'K TRI';$('status').textContent=state.frames+' 帧 · '+(dirty?'更新中':'就绪 · 静止时节能')}}
async function init(){renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;renderer.domElement.setAttribute('aria-label','皮肤三维画面');viewport.prepend(renderer.domElement);renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();state.ready=false;fail(new Error('显卡上下文丢失，请重新载入或使用轻量模式'))});scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(28,1,.01,5);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.085;controls.minDistance=.10;controls.maxDistance=1.5;controls.maxPolarAngle=Math.PI*.84;controls.minPolarAngle=.15;controls.addEventListener('change',()=>dirty=true);
 key=new THREE.DirectionalLight(0xfff1e2,2.65);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.radius=14;key.shadow.blurSamples=12;Object.assign(key.shadow.camera,{left:-.22,right:.22,top:.22,bottom:-.22,near:.05,far:2});key.shadow.bias=-.000035;key.shadow.normalBias=.00022;key.target.position.set(0,.025,0);scene.add(key,key.target);fill=new THREE.DirectionalLight(0xdbe6fa,.18);fill.position.set(.4,.15,.5);scene.add(fill);rim=new THREE.DirectionalLight(0xcadff8,.8);rim.position.set(.4,.35,-.35);scene.add(rim);makeEnvironment();
 const manager=new THREE.LoadingManager();manager.onProgress=(url,n,total)=>{$('loadingText').textContent='读取皮肤资源 '+n+' / '+total};const loader=new THREE.TextureLoader(manager);const load=(url,color=false)=>loader.loadAsync(url).then(t=>{t.flipY=true;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t});
 const [gltf,albedo,normal,height,spec,mesoMap,microMap,surfaceMap]=await Promise.all([new GLTFLoader(manager).loadAsync('../r01/assets/head.glb'),load('../r01/assets/hires/albedo-4k.jpg',true),load('../r01/assets/normal.jpg'),load('../r01/assets/hires/microheight-4k.png'),load('../r01/assets/specular.jpg'),load('./assets/meso.webp'),load('./assets/micro.webp'),load('./assets/surface.webp')]);E.uMesoMap.value=mesoMap;E.uMicroMap.value=microMap;E.uSurface.value=surfaceMap;
 $('loadingText').textContent='编译双层反射与 RGB 皮下扩散';let source;gltf.scene.traverse(o=>{if(o.isMesh&&!source)source=o});const aoResponse=await fetch("./assets/occlusion.bin");if(!aoResponse.ok)throw new Error("AO resource unavailable");const ao=new Float32Array(await aoResponse.arrayBuffer());if(ao.length!==source.geometry.attributes.position.count)throw new Error("AO vertex count mismatch");source.geometry.setAttribute("skinOcclusion",new THREE.BufferAttribute(ao,1));const intermediate=subdivide(source.geometry);let geo=subdivide(intermediate);intermediate.dispose();geo.scale(.04,.04,.04);configureSkin(albedo,normal,height,spec);mesh=new THREE.Mesh(geo,skin);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);makeFuzz(geo);initEntry();initPost();resize();setCamera('portrait');await installSkinIdentities({albedo,normal,spec,surfaceMap},load);apply();updateLayer();state.ready=true;render();$('loading').style.display='none';$('status').textContent='场景就绪';state.triangles=geo.index.count/3;state.assets={albedo:[albedo.image.width,albedo.image.height],baseNormal:[normal.image.width,normal.image.height],mesostructure:[mesoMap.image.width,mesoMap.image.height],microstructure:[microMap.image.width,microMap.image.height],surface:[surfaceMap.image.width,surfaceMap.image.height]};state.renderer=renderer.getContext().getParameter(renderer.getContext().RENDERER);window.__SKIN_LAB__.render=render;window.__SKIN_LAB__.setCamera=setCamera;window.__SKIN_LAB__.set=(v)=>{for(const k in defaults)if(Number.isFinite(v[k])){const el=$(k);values[k]=Math.max(+el.min,Math.min(+el.max,v[k]))}apply();render()};window.__SKIN_LAB__.setLighting=(v)=>{if(Number.isFinite(v.key))key.intensity=v.key;if(Number.isFinite(v.fill))fill.intensity=v.fill;if(Number.isFinite(v.rim))rim.intensity=v.rim;if(Number.isFinite(v.env))skin.envMapIntensity=v.env;if(Number.isFinite(v.height))key.position.y=v.height;entryDirty=true;renderer.shadowMap.needsUpdate=true;dirty=true;};window.__SKIN_LAB__.setView=(p,t)=>{camera.position.set(...p);controls.target.set(...t);controls.update();dirty=true;};window.__SKIN_LAB__.camera=()=>({position:camera.position.toArray(),target:controls.target.toArray()});window.__SKIN_LAB__.geometryInfo=()=>({box:new THREE.Box3().setFromObject(mesh),triangles:geo.index.count/3});requestAnimationFrame(tick);
 const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();renderer.domElement.addEventListener('dblclick',e=>{let rect=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(mouse,camera);let hit=ray.intersectObject(mesh)[0];if(hit){let dir=camera.position.clone().sub(controls.target).normalize();controls.target.copy(hit.point);camera.position.copy(hit.point).addScaledVector(dir,.23);controls.update();dirty=true;toast('已对焦局部，可滚轮继续放大')}});
}
const aoControl=document.createElement('div');aoControl.className='control';aoControl.innerHTML='<label for="occlusion">凹处环境遮光<output id="occlusionOut"></output></label><input id="occlusion" type="range" min="0" max="1" step="0.01" value=".9">';$('fuzz').closest('.section').appendChild(aoControl);
for(const id in defaults)$(id).addEventListener('input',()=>{values[id]=Number($(id).value);apply();document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('active'))});document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{Object.assign(values,presets[b.dataset.preset]);apply();document.querySelectorAll('[data-preset]').forEach(x=>x.classList.toggle('active',x===b))});document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>setCamera(b.dataset.camera));$('lightPreset').onchange=()=>{state.light=$('lightPreset').value;values.azimuth={studio:-46,raking:-78,back:135,daylight:-28}[state.light];apply();updateLayer()};$('layer').onchange=()=>updateLayer();$('quality').onchange=()=>{state.quality=$('quality').value;resize()};$('compare').onpointerdown=e=>{e.preventDefault();$('compare').setPointerCapture(e.pointerId);baseline(true)};for(const e of ['pointerup','pointercancel','lostpointercapture'])$('compare').addEventListener(e,()=>{if(compareHeld)baseline(false)});window.addEventListener('blur',()=>{if(compareHeld)baseline(false)});$('compare').onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();baseline(true)}};$('compare').onkeyup=()=>baseline(false);$('mobileToggle').onclick=()=>document.body.classList.toggle('panel-open');
function recipe(){return {identity:identityRuntime?.report(),schema:'kaopu/skin-lookdev@1',version:VERSION,values:{...values},light:state.light,layer:state.layer,camera:state.camera,source:'Lee Perry-Smith CC BY 3.0 scan; hybrid procedural shading',calibratedBiology:false}}
async function loadRecipe(o){await identityRuntime.restore(o.identity);if(o.schema!=='kaopu/skin-lookdev@1'||!o.values)throw new Error('不是本实验台的参数文件');for(const k in defaults){let v=Number(o.values[k]??defaults[k]),el=$(k);if(!Number.isFinite(v))throw new Error('无效参数 '+k);values[k]=Math.max(+el.min,Math.min(+el.max,v))}if(['studio','raking','back','daylight'].includes(o.light)){state.light=o.light;$('lightPreset').value=o.light}apply();updateLayer()}
$('save').onclick=()=>{try{localStorage.setItem('skin-quality-lab-r02-identities',JSON.stringify(recipe()));toast('已保存在当前浏览器')}catch(e){toast('浏览器禁止本地保存，请导出 JSON')}};$('restore').onclick=async()=>{try{const v=localStorage.getItem('skin-quality-lab-r02-identities');if(!v){toast('尚无保存的参数');return}await loadRecipe(JSON.parse(v));toast('已恢复参数')}catch(e){toast(e.message)}};$('reset').onclick=async()=>{await identityRuntime.set('original');document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset==='natural'));Object.assign(values,defaults);state.light='studio';$('lightPreset').value='studio';$('layer').value='beauty';$('rotateLight').checked=false;apply();updateLayer();setCamera('portrait');toast('已恢复自然皮肤基线')};
function download(blob,name){let u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000)}$('export').onclick=()=>download(new Blob([JSON.stringify(recipe(),null,2)],{type:'application/json'}),'skin-lookdev-r02.json');$('import').onclick=()=>$('fileInput').click();$('fileInput').onchange=async()=>{try{let f=$('fileInput').files[0];if(!f)return;if(f.size>50000)throw new Error('参数文件过大');await loadRecipe(JSON.parse(await f.text()));toast('参数已导入')}catch(e){toast(e.message)}finally{$('fileInput').value=''}};$('shot').onclick=()=>{render();renderer.domElement.toBlob(b=>{if(b)download(b,'skin-lab-r02-'+state.camera+'.png')},'image/png')};window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(!document.hidden)dirty=true});apply();init().catch(fail);

// This file is assembled into the existing R02 module scope, not a second app.
// It changes mesh materials and mesh-rooted fibres. No portrait planes exist.
let identityRuntime=null;
const IDENTITY_DEFINITIONS={
 original:{label:'原 R02',description:'原始扫描颜色、法线和材质参数；保留作回退对照。',seed:0,beard:0,brow:0,params:{}},
 porcelain:{label:'01 · 冷白雀斑',description:'无须、铜棕细弧眉；鼻颊雀斑、细孔、偏哑光。独立色素 / 凹凸 / 粗糙度贴图。',seed:218,beard:0,brow:1450,params:{roughness:.60,oil:.12,detail:.56,meso:.75,micro:1.10,pores:.18,fuzz:.34,pigment:0,blood:.23,sss:.84,radius:1.20,relief:.62}},
 umber:{label:'02 · 深褐短须',description:'深褐色素、短硬胡茬、宽浓断眉；局部痘印、眉侧浅疤，T 区偏油。',seed:734,beard:11000,brow:1950,params:{roughness:.55,oil:.20,detail:.77,meso:1.08,micro:1.40,pores:.38,fuzz:.24,pigment:0,blood:.15,sss:.74,radius:.90,relief:.75}},
 weathered:{label:'03 · 风化熟龄',description:'暖褐晒斑、额纹和眼角细纹；灰白混色胡须、疏密眉束、干燥粗糙分区。',seed:159,beard:15000,brow:2250,params:{roughness:.64,oil:.10,detail:.90,meso:1.55,micro:1.20,pores:.29,fuzz:.32,pigment:0,blood:.30,sss:.76,radius:1.15,relief:.88}}
};
function identityRandom(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function identityHairGeometry(geometry,profile){
 const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,ix=geometry.index.array,areas=[],triangles=[];
 let total=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
 for(let i=0;i<ix.length;i+=3){a.fromBufferAttribute(p,ix[i]);b.fromBufferAttribute(p,ix[i+1]);c.fromBufferAttribute(p,ix[i+2]);const x=(a.x+b.x+c.x)/3,y=(a.y+b.y+c.y)/3,z=(a.z+b.z+c.z)/3;if(Math.abs(x)>.078||y<-.035||y>.098||z<.025)continue;let ar=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()*.5;if(ar<1e-13)continue;total+=ar;areas.push(total);triangles.push(i);}
 const output={brow:[],beard:[]},rand=identityRandom(profile.seed),q=new THREE.Vector3(),nn=new THREE.Vector3();
 for(let tries=0;tries<380000&&(output.brow.length<profile.brow||output.beard.length<profile.beard);tries++){
  let lo=0,hi=areas.length-1,r=rand()*total;while(lo<hi){let m=(lo+hi)>>1;if(areas[m]<r)lo=m+1;else hi=m;}
  const i=triangles[lo],ia=ix[i],ib=ix[i+1],ic=ix[i+2];let u=rand(),v=rand();if(u+v>1){u=1-u;v=1-v;}
  a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);q.copy(a).multiplyScalar(1-u-v).addScaledVector(b,u).addScaledVector(c,v);
  const ax=Math.abs(q.x),side=q.x<0?-1:1,t=(ax-.010)/.048;
  const arch=.0795+.0033*Math.sin(Math.PI*t)-.004*t+(profile.seed===218?.0015:0);
  const width=profile.seed===218?.00165:profile.seed===734?.0031:.0027;
  const brow=t>0&&t<1&&Math.abs(q.y-arch)<width*Math.pow(Math.sin(Math.PI*t),.40);
  const notch=profile.seed===734&&q.x>.039&&q.x<.046&&q.y>.074;
  const lower=q.y<.010&&q.y>-.029,sideburn=ax>.026&&ax<.067&&q.y<.048&&q.y>-.022;
  const moustache=ax<.026&&q.y>.023&&q.y<.029&&q.z>.071;
  const lip=ax<.028&&Math.abs(q.y-.0185)<.006;
  const beard=(lower||sideburn||moustache)&&!lip;
  let kind=brow&&!notch?'brow':beard?'beard':null;
  if(!kind||output[kind].length>=profile[kind])continue;
  if(kind==='beard'&&q.y<-.015&&rand()>.65)continue;
  if(kind==='brow'&&profile.seed===159&&Math.sin(ax*970+q.y*1760)>.65&&rand()>.27)continue;
  nn.set(n.getX(ia)*(1-u-v)+n.getX(ib)*u+n.getX(ic)*v,n.getY(ia)*(1-u-v)+n.getY(ib)*u+n.getY(ic)*v,n.getZ(ia)*(1-u-v)+n.getZ(ib)*u+n.getZ(ic)*v).normalize();
  const flow=kind==='brow'?new THREE.Vector3(side*(.7+.2*rand()),.3-.55*t,0):new THREE.Vector3(side*(moustache?.38:.12),-1,.10);
  flow.x+=(rand()-.5)*.50;flow.y+=(rand()-.5)*.20;flow.addScaledVector(nn,-flow.dot(nn)).normalize();
  const length=kind==='brow'?(profile.seed===218?.0018+rand()*.0020:profile.seed===159?.0030+rand()*.0045:.0024+rand()*.0032):(profile.seed===159?.003+rand()*.006:.00045+rand()*.0011);
  let col=profile.seed===218?new THREE.Color(.105,.047,.022):profile.seed===159&&rand()<.40?new THREE.Color(.20,.195,.185):new THREE.Color(.014,.009,.006);
  col.multiplyScalar(.65+rand()*.85);
  output[kind].push({p:q.clone(),n:nn.clone(),flow,length,col,random:rand(),uv:[uv.getX(ia)*(1-u-v)+uv.getX(ib)*u+uv.getX(ic)*v,uv.getY(ia)*(1-u-v)+uv.getY(ib)*u+uv.getY(ic)*v]});
 }
 const group=new THREE.Group();group.name='identity-mesh-rooted-fibres';
 for(const kind of ['brow','beard']){
  const positions=[],normals=[],roots=[],colors=[],tangents=[],uvs=[],ts=[],sides=[],ids=[],randoms=[],widths=[];
  for(const strand of output[kind]){let start=positions.length/3;
   for(let j=0;j<4;j++){let t=j/3;const bend=t*t,tip=strand.p.clone().addScaledVector(strand.n,.000025+strand.length*t*.30).addScaledVector(strand.flow,strand.length*(t*.50+bend*.38));
    tip.addScaledVector(new THREE.Vector3().crossVectors(strand.n,strand.flow),Math.sin(strand.random*6.28+t*4.)*strand.length*t*t*.12);const tangent=strand.n.clone().multiplyScalar(.3).addScaledVector(strand.flow,.5+.76*t).normalize();
    for(const side of [-1,1]){positions.push(...tip.toArray());roots.push(...strand.p.toArray());normals.push(...strand.n.toArray());colors.push(...strand.col.toArray());tangents.push(...tangent.toArray());uvs.push(...strand.uv);ts.push(t);sides.push(side);randoms.push(strand.random);widths.push(kind==='brow'?.000023:.000026);}
    if(j<3){let k=start+j*2;ids.push(k,k+1,k+2,k+1,k+3,k+2);}
   }
  }
  const g=new THREE.BufferGeometry();for(const [key,arr,size] of [['position',positions,3],['normal',normals,3],['rootPosition',roots,3],['color',colors,3],['tangentHair',tangents,3],['uv',uvs,2],['strandT',ts,1],['strandSide',sides,1],['strandRandom',randoms,1],['strandWidth',widths,1]])g.setAttribute(key,new THREE.Float32BufferAttribute(arr,size));g.setIndex(ids);
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uDensity:{value:1},uLength:{value:1},uSurface:E.uSurface,uRelief:E.uRelief,uPixelHeight:fuzz.material.uniforms.uPixelHeight,uLightDir:fuzz.material.uniforms.uLightDir,uLightPower:fuzz.material.uniforms.uLightPower},
   vertexShader:`attribute vec3 rootPosition,color,tangentHair;attribute float strandT,strandSide,strandRandom,strandWidth;uniform float uLength,uRelief,uPixelHeight;uniform sampler2D uSurface;varying float vt,vs,coverage,vr;varying vec3 vc,vn,vv,vHair;void main(){vt=strandT;vs=strandSide;vr=strandRandom;vc=color;vec3 pp=rootPosition+(position-rootPosition)*uLength+normal*(texture2D(uSurface,uv).b-.5)*uRelief*.001;vec4 p=modelViewMatrix*vec4(pp,1.);vv=-p.xyz;vn=normalize(normalMatrix*normal);vHair=normalize(mat3(modelViewMatrix)*tangentHair);vec3 across=normalize(cross(vHair,normalize(vv)));float width=strandWidth*(1.-.88*vt);float pixel=max(.0000001,-p.z/(projectionMatrix[1][1]*uPixelHeight*.5));float halfwidth=max(width,pixel*.50);coverage=width/halfwidth;p.xyz+=across*strandSide*halfwidth;gl_Position=projectionMatrix*p;}`,
   fragmentShader:`uniform float uDensity,uLightPower;uniform vec3 uLightDir;varying float vt,vs,coverage,vr;varying vec3 vc,vn,vv,vHair;void main(){if(vr>uDensity)discard;vec3 N=normalize(vn),V=normalize(vv),L=normalize(uLightDir),T=normalize(vHair);float lam=max(dot(N,L),0.);float longitudinal=sqrt(max(1.-pow(dot(T,normalize(L+V)),2.),0.));float sheen=pow(longitudinal,44.);float alpha=coverage*(1.-smoothstep(.1,1.,abs(vs)))*(1.-smoothstep(.85,1.,vt));vec3 col=vc*(.48+lam*uLightPower*.75)+vec3(.24,.20,.15)*sheen*uLightPower*.06;gl_FragColor=vec4(col,alpha);}`});
  const obj=new THREE.Mesh(g,mat);obj.frustumCulled=false;obj.name=kind;group.add(obj);
 }
 group.userData.counts={brow:output.brow.length,beard:output.beard.length};return group;
}
async function installSkinIdentities(original,load){
 const cache=new Map(),originalMaps={...original};let sequence=0,group=null,current='original';
 const hairValues={browDensity:1,beardDensity:1,beardLength:1};
 const updateHair=()=>{if(group)for(const obj of group.children){obj.material.uniforms.uDensity.value=obj.name==='brow'?hairValues.browDensity:hairValues.beardDensity;obj.material.uniforms.uLength.value=obj.name==='brow'?1:hairValues.beardLength;}
  for(const k in hairValues){$(k).value=hairValues[k];$(k+'Out').textContent=hairValues[k].toFixed(2);}dirty=true;};
 function releaseHair(){if(!group)return;fuzz.remove(group);for(const child of group.children){child.geometry.dispose();child.material.dispose();}group=null;}
 async function mapsFor(id){if(id==='original')return originalMaps;if(cache.has(id)){const a=cache.get(id);cache.delete(id);cache.set(id,a);return a;}
  const root='./assets/identities/'+id+'/';const [albedo,normal,roughness,features]=await Promise.all([load(root+'albedo.webp',true),load(root+'normal.webp'),load(root+'roughness.webp'),load(root+'features.webp')]);const result={albedo,normal,roughness,features};cache.set(id,result);return result;
 }
 async function setIdentity(id,{keepValues=false}={}){
  if(!IDENTITY_DEFINITIONS[id])throw new Error('未知表皮配方');const request=++sequence;$('identityStatus').textContent='正在载入 '+IDENTITY_DEFINITIONS[id].label+'…';state.identityLoading=true;
  try{
   const maps=await mapsFor(id);if(request!==sequence)return;
   releaseHair();skin.map=maps.albedo;skin.color.setRGB(...(id==='umber'?[.95,1.23,1.52]:[1,1,1]));skin.normalMap=maps.normal;skin.clearcoatNormalMap=maps.normal;
   U.uIdentityEnabled.value=id==='original'?0:1;U.uIdentityRoughnessBase.value=id==='umber'?.42:(IDENTITY_DEFINITIONS[id].params.roughness??defaults.roughness);U.uIdentityRoughness.value=maps.roughness||originalMaps.spec;U.uIdentityFeatures.value=maps.features||originalMaps.surfaceMap;
   if(!keepValues)Object.assign(values,defaults,IDENTITY_DEFINITIONS[id].params);
   if(id!=='original'){group=identityHairGeometry(mesh.geometry,IDENTITY_DEFINITIONS[id]);fuzz.add(group);}
   current=id;state.identity=id;state.identityMaps=id==='original'?'original-4k-scan':['albedo','normal','roughness','features'].map(k=>({kind:k,width:maps[k].image.width,height:maps[k].image.height}));state.identityHair=group?.userData.counts||{brow:0,beard:0};
   document.querySelectorAll('[data-identity]').forEach(b=>{b.classList.toggle('active',b.dataset.identity===id);b.setAttribute('aria-pressed',String(b.dataset.identity===id));});
   $('identityDescription').textContent=IDENTITY_DEFINITIONS[id].description;$('identityStatus').textContent=id==='original'?'已恢复原始 R02':'2K 独立身份图 + 原 R02 4K 扫描微结构';
   document.querySelector('.caption-title').textContent=IDENTITY_DEFINITIONS[id].label;
   for(const k in hairValues)$(k).disabled=id==='original'||(id==='porcelain'&&k.startsWith('beard'));
   for(const key of [...cache.keys()])if(cache.size>2&&key!==id){const item=cache.get(key);for(const tex of Object.values(item))tex.dispose();cache.delete(key);}
   updateHair();skin.needsUpdate=true;apply();dirty=true;if(state.ready)render();
  }finally{if(request===sequence)state.identityLoading=false;}
 }
 const report=()=>({schema:'kaopu/skin-identity@1',id:current,hair:{...hairValues},geometryBasis:'R02.1 original scan; topology unchanged',maps:state.identityMaps});
 async function restore(o){if(!o)return setIdentity('original');if(o.schema!=='kaopu/skin-identity@1')throw Error('表皮配方版本不兼容');await setIdentity(o.id);for(const k in hairValues)if(Number.isFinite(o.hair?.[k]))hairValues[k]=Math.max(0,Math.min(k==='beardLength'?2:1,o.hair[k]));updateHair();}
 const api={set:setIdentity,report,restore,hasHair:()=>!!group&&current!=='original',current:()=>current,definitions:IDENTITY_DEFINITIONS};identityRuntime=api;window.__SKIN_LAB__.identity=api;
 for(const b of document.querySelectorAll('[data-identity]'))b.onclick=()=>setIdentity(b.dataset.identity).catch(e=>{toast(e.message);state.errors.push(e.message);});
 for(const k in hairValues)$(k).oninput=()=>{hairValues[k]=Number($(k).value);updateHair();};
 $('identityMaps').onclick=()=>{
  const host=$('mapGallery');host.replaceChildren();if(current==='original'){host.textContent='原版扫描贴图保留在 r01/assets。';}else for(const [id,label]of [['albedo','颜色 / 色素'],['normal','法线 / 凹凸'],['roughness','粗糙度'],['features','色斑 / 毛囊 / 起伏']]){const card=document.createElement('figure'),caption=document.createElement('figcaption'),img=document.createElement('img');caption.textContent=label+' · 2048 × 2048';img.src='./assets/identities/'+current+'/'+id+'.webp';img.alt=label;card.append(caption,img);host.append(card);}
  $('mapsDialog').showModal();
 };
 $('mapsClose').onclick=()=>$('mapsDialog').close();
 await setIdentity('porcelain');return api;
}
