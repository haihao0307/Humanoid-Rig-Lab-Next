const skinFunctions=`
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
 s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSkinPosition;uniform sampler2D uSurface;uniform float uRelief,uBaseline;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=normal*(texture2D(uSurface,uv).b-.5)*uRelief*.001*(1.-uBaseline);vSkinPosition=transformed;');
 s.fragmentShader=s.fragmentShader.replace('#include <packing>','#include <packing>\n'+skinFunctions);
 s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 float skinVariation=skinNoise(vSkinPosition*105.);float skinFront=smoothstep(-.025,.055,vSkinPosition.z);float skinCheeks=exp(-pow((abs(vSkinPosition.x)-.041)/.025,2.)-pow((vSkinPosition.y-.016)/.033,2.))*skinFront;float skinEar=smoothstep(.069,.092,abs(vSkinPosition.x))*(1.-smoothstep(.045,.082,abs(vSkinPosition.y-.025)));
 float skinZone=clamp(skinCheeks+.65*skinEar,0.,1.);
 if(uBaseline<.5){diffuseColor.rgb*=exp(-uPigment*vec3(1.0,1.43,1.8));diffuseColor.rgb*=1.+skinVariation*.026;diffuseColor.rgb*=vec3(1.+uBlood*skinZone*.11,1.-uBlood*skinZone*.18,1.-uBlood*skinZone*.14);}
 `);
 s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 float skinSpecMask=texture2D(uSpec,vMapUv).r;vec3 skinSurface=texture2D(uSurface,vMapUv).rgb;
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
 if(uBaseline<.5)clearcoatNormal=normal;
 `);
 s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
 material.clearcoat*=mix(1.,clamp(.35+1.2*skinSpecMask,.25,1.),1.-uBaseline);
 material.clearcoatRoughness=clamp(material.clearcoatRoughness+(skinSurface.g-.5)*.12,.19,.5);
 `);
 let physical=THREE.ShaderChunk.lights_physical_pars_fragment;
 physical=physical.replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',`
 float nl=dot(geometryNormal,directLight.direction);vec3 w=max(vec3(nl)+vec3(.12,.035,.015),vec3(0.))/vec3(1.2544,1.071225,1.030225);
 reflectedLight.directDiffuse+=mix(vec3(dotNL),w,uScatter*.28*(1.-uBaseline))*directLight.color*BRDF_Lambert(material.diffuseColor);
 `);
 s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_pars_fragment>',physical);
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
