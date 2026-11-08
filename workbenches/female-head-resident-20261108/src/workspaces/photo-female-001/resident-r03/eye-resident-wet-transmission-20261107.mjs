import {SOURCE_SCENE_GLSL} from '/src/material/SourceSceneGLSL.mjs';
import {SOURCE_VISIBILITY_GLSL} from '/src/material/SourceVisibility.mjs';
import {MATERIAL_GGX_GLSL} from '/src/material/LightingKernels.mjs';
import {EYE_OPTICS_GLSL} from '/src/material/EyeOptics.mjs';
import {EYE_COORDINATE_GLSL} from '/src/material/EyeCoordinateFunctions.mjs';
import {eyeUniformData} from '/src/material/EyeVariables.mjs';
import {createEyeVesselFunctions} from '/src/material/EyeVesselFunctions.mjs';
const projectionAnchor='uv=ndc*.5+.5';
if(SOURCE_VISIBILITY_GLSL.split(projectionAnchor).length!==2)throw Error('眼部遮挡投影接口已改变');
const principalVisibility=SOURCE_VISIBILITY_GLSL.replace(projectionAnchor,'uv=ndc*.5+u_eyePrincipal');
const vertex=`#version 300 es
precision highp float;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0,1);}`;
const first='vec2 eyeRefractCoordinates(vec2 q,vec3 p,vec3 normal,vec3 view,int side){',last='\n}\nstruct EyeMaterial';
function replaceOnce(source,before,after){const at=source.indexOf(before);if(at<0||source.indexOf(before,at+before.length)>=0)throw Error('眼部材质研究接口发生变化');return source.slice(0,at)+after+source.slice(at+before.length);}
function ownEyeFunctions(){let s=EYE_OPTICS_GLSL.replace(EYE_COORDINATE_GLSL,'');const a=s.indexOf(first),b=s.indexOf(last,a);if(a<0||b<a)throw Error('自有眼部材质接口变化');s=s.slice(0,a)+first+'return q;'+s.slice(b);
 s=replaceOnce(s,'EyeMaterial eyeMaterial(vec3 p,vec3 n0,vec3 view,vec2 raw,int side){','EyeMaterial eyeMaterial(vec3 p,vec3 n0,vec3 view,vec2 raw,int side,bool scleraOnly){');
 s=replaceOnce(s,'vec3 illuminateEye(EyeMaterial m,vec3 view,vec3 point,vec3 sourceNormal,ivec2 pixel){','vec3 illuminateEye(EyeMaterial m,vec3 view,vec3 point,vec3 sourceNormal,ivec2 pixel,int layer){');
 s=replaceOnce(s,'eyeDirectionalVisibility(point,sourceNormal,u_sceneLightDirections[i],pixelMM)','eyeExactLightVisibility(pixel,layer,i,point,sourceNormal,u_sceneLightDirections[i],pixelMM)');
 s=replaceOnce(s,'colour*=1.-misc.y*.32*smoothstep(.83,1.015,r);','colour*=(1.-misc.y*.32*smoothstep(.83,1.015,r))*u_irisClarity;');
 s=replaceOnce(s,'}return m;\n}',`}if(scleraOnly){if(u_eyeReference>0){vec4 sourceWhite=sourceScleraFieldGPU(raw*(int(iris.w)==0?1.:.1215/.1185),side);m.albedo=eyeSRGBToLinear(clamp(sourceWhite.rgb/255.,vec3(0),vec3(1)));}else m.albedo=white;}return m;\n}`);
 return s;
}
const fragment=`#version 300 es
precision highp float;precision highp int;
uniform sampler2D u_position,u_innerPosition,u_innerNormal,u_innerUV,u_direction,u_entryNormal,u_entryPosition,u_entryUV;
uniform vec3 u_eye,u_forward,u_right,u_up;
uniform vec4 u_transmissionOptics,u_transmissionInterior;uniform vec2 u_wetFilm;uniform float u_irisClarity,u_eyeExactVisibilityOn;uniform sampler2D u_eyeExactVisibility;
out vec4 color;
${SOURCE_SCENE_GLSL}
uniform vec2 u_eyePrincipal;
${principalVisibility}
${MATERIAL_GGX_GLSL}
float eyeExactLightVisibility(ivec2 pixel,int layer,int light,vec3 point,vec3 normal,vec3 direction,float pixelMM){if(u_eyeExactVisibilityOn>.5)return texelFetch(u_eyeExactVisibility,pixel,0)[layer*2+light];return eyeDirectionalVisibility(point,normal,direction,pixelMM);}
${ownEyeFunctions()}
float dielectricFresnel(float cosine,float ior){
 float ci=clamp(cosine,0.,1.),sin2=max(0.,1.-ci*ci)/(ior*ior),ct=sqrt(max(0.,1.-sin2));
 float rs=(ci-ior*ct)/max(ci+ior*ct,1e-6),rp=(ior*ci-ct)/max(ior*ci+ct,1e-6);
 return clamp(.5*(rs*rs+rp*rp),0.,1.);
}
// R08 thin-water-film model adapted to this candidate's exact eye visibility.
// The film shares the eye's existing normal and introduces no new surface.
float wetInterfaceFresnel(float cosine,float fromIOR,float toIOR){
 float ci=clamp(cosine,0.,1.),sin2=(fromIOR*fromIOR)/(toIOR*toIOR)*max(0.,1.-ci*ci);if(sin2>=1.)return 1.;float ct=sqrt(max(0.,1.-sin2));
 float rs=(fromIOR*ci-toIOR*ct)/max(fromIOR*ci+toIOR*ct,1e-6),rp=(toIOR*ci-fromIOR*ct)/max(toIOR*ci+fromIOR*ct,1e-6);return clamp(.5*(rs*rs+rp*rp),0.,1.);
}
vec2 wetFilmReflection(float cosine,float corneaIOR){const float waterIOR=1.336;float c=clamp(cosine,0.,1.),waterCos=sqrt(max(0.,1.-(1.-c*c)/(waterIOR*waterIOR)));float top=wetInterfaceFresnel(c,1.,waterIOR),below=wetInterfaceFresnel(waterCos,waterIOR,corneaIOR);return vec2(top,(1.-top)*(1.-top)*below/max(1.-top*below,1e-6));}
void main(){
 ivec2 pixel=ivec2(gl_FragCoord.xy);vec4 inside=texelFetch(u_innerPosition,pixel,0);
 if(inside.a<2.5)discard;int side=(int(round(inside.a))-1)%2;
 vec3 innerNormal=normalize(texelFetch(u_innerNormal,pixel,0).xyz),incoming=normalize(texelFetch(u_direction,pixel,0).xyz);
 vec2 q=texelFetch(u_innerUV,pixel,0).xy;vec3 innerView=-incoming;
 EyeMaterial tissue=eyeMaterial(inside.xyz,innerNormal,innerView,q,side,false);
 tissue.coat=0.;tissue.roughness=max(.0525,u_transmissionInterior.x);
 tissue.normal=normalize(mix(innerNormal,tissue.normal,clamp(u_transmissionInterior.y,0.,2.)));
 float pathMM=texelFetch(u_direction,pixel,0).w;
 vec3 surface=texelFetch(u_position,pixel,0).xyz,N=normalize(texelFetch(u_entryNormal,pixel,0).xyz),V=normalize(u_eye-surface);
 vec2 outerQ=texelFetch(u_entryUV,pixel,0).xy;
 // The inherited outer surface carries the original visible sclera; the
 // separate inner surface supplies the refracted iris. Keep both positions,
 // source normals and material coordinates, using the existing iris mask as
 // the tissue coverage. Absorption applies only to the traversed inner path.
 EyeMaterial sclera=eyeMaterial(surface,N,V,outerQ,side,true);
 sclera.coat=0.;sclera.roughness=max(.0525,u_transmissionInterior.x);
 sclera.normal=normalize(mix(N,sclera.normal,clamp(u_transmissionInterior.y,0.,2.)));
 float r=length(q)/u_eyeIris[side].x,aa=max(fwidth(r),.0025);
 float irisCoverage=u_eyeReference>0?1.-smoothstep(.99,1.065,length(q)):1.-smoothstep(.985-aa,1.055+aa,r);
 vec3 scleraLight=illuminateEye(sclera,V,surface,N,pixel,0);
 vec3 irisLight=illuminateEye(tissue,innerView,inside.xyz,innerNormal,pixel,1)*exp(-u_transmissionInterior.z*pathMM);
 vec3 transmitted=mix(scleraLight,irisLight,irisCoverage);
 float ior=u_transmissionOptics.x,coat=u_transmissionOptics.z,rough=max(.0525,u_transmissionOptics.w);
 float F=dielectricFresnel(max(dot(N,V),0.),ior)*coat;
 float f0=pow((ior-1.)/(ior+1.),2.);
 vec3 reflected=sceneRadiance(N,V,rough)*sceneEnvironmentBRDF(N,V,vec3(f0),1.,rough)*coat*u_transmissionOptics.y;
 float wet=clamp(u_wetFilm.x,0.,1.),wetRough=max(.0525,u_wetFilm.y);
 if(wet>0.){vec2 fw=wetFilmReflection(max(dot(N,V),0.),ior),fw0=wetFilmReflection(1.,ior);F=mix(F,min(1.,fw.x+fw.y)*coat,wet);vec3 waterEnvironment=sceneRadiance(N,V,wetRough)*sceneEnvironmentBRDF(N,V,vec3(fw0.x),1.,wetRough)+sceneRadiance(N,V,rough)*sceneEnvironmentBRDF(N,V,vec3(fw0.y),0.,rough);reflected=mix(reflected,waterEnvironment*coat*u_transmissionOptics.y,wet);}
 for(int i=0;i<2;i++){
  vec3 L=normalize(u_sceneLightDirections[i]),H=normalize(V+L);float nl=max(dot(N,L),0.),nv=max(dot(N,V),.001);
  float Fh=dielectricFresnel(max(dot(V,H),0.),ior)*coat;
  float directWeight=skinGGX(max(dot(N,H),0.),nv,nl,rough)*nl*Fh;
  if(wet>0.){vec2 fwh=wetFilmReflection(max(dot(V,H),0.),ior);float originalLobe=skinGGX(max(dot(N,H),0.),nv,nl,rough)*Fh,waterLobe=(skinGGX(max(dot(N,H),0.),nv,nl,wetRough)*fwh.x+skinGGX(max(dot(N,H),0.),nv,nl,rough)*fwh.y)*coat;directWeight=mix(originalLobe,waterLobe,wet)*nl;}
  reflected+=u_sceneLightRadiance[i]*directWeight*sceneShadow(surface,N,i)*(u_eyeExactVisibilityOn>.5?texelFetch(u_eyeExactVisibility,pixel,0)[i]:1.);
 }
 color=vec4(sceneDisplay(transmitted*(1.-F)+reflected),1.);
}`;
function sampleFragment(){
 let s=fragment.replace('#version 300 es\n','#version 300 es\n#extension GL_OES_sample_variables : require\n');
 s=s.replace('ivec2 pixel=ivec2(gl_FragCoord.xy);vec4 inside=texelFetch(u_innerPosition,pixel,0);','ivec2 pixel=ivec2(gl_FragCoord.xy);ivec2 eyePixel=pixel*2+ivec2(gl_SampleID&1,gl_SampleID>>1);vec4 inside=texelFetch(u_innerPosition,eyePixel,0);');
 for(const name of ['u_innerNormal','u_innerUV','u_direction','u_entryNormal','u_entryUV'])s=s.replaceAll(`texelFetch(${name},pixel,0)`,`texelFetch(${name},eyePixel,0)`);
 s=s.replace('vec3 surface=texelFetch(u_position,pixel,0).xyz','vec3 surface=texelFetch(u_entryPosition,eyePixel,0).xyz');
 return s;
}
export function createEyeTransmissionPass(gl,scene){
 const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('眼内透射着色编译失败：'+gl.getShaderInfoLog(shader));return shader;};
 const makeProgram=source=>{const p=gl.createProgram(),vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,source);gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('眼内透射着色连接失败：'+gl.getProgramInfoLog(p));gl.deleteShader(vs);gl.deleteShader(fs);return p;};
 const standardProgram=makeProgram(fragment),sampleProgram=null,vessels=createEyeVesselFunctions(gl),names=['position','innerPosition','innerNormal','innerUV','direction','entryNormal','entryPosition','entryUV'],keys=['position','normal','uv','direction','entryNormal','entryPosition','entryUV'],textures=keys.map(()=>gl.createTexture()),sampleTextures=keys.map(()=>gl.createTexture()),visibilityTexture=gl.createTexture(),locations=new WeakMap();let width=0,height=0,active=false,sampleActive=false,visibilityActive=false,statistics=null,draws=0,sampledDraws=0;
 gl.activeTexture(gl.TEXTURE8);gl.bindTexture(gl.TEXTURE_2D,visibilityTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,1,1,0,gl.RGBA,gl.FLOAT,new Float32Array([1,1,1,1]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 function uploadSet(data,w,h,bank){if(data.width!==w||data.height!==h)throw Error('透射与首交画面尺寸不同');const count=w*h;for(const k of keys)if(!(data[k] instanceof Float32Array)||data[k].length!==count*4)throw Error('透射缓冲无效：'+k);
  for(const [i,key]of keys.entries()){gl.activeTexture(gl.TEXTURE1+i);gl.bindTexture(gl.TEXTURE_2D,bank[i]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,data[key]);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
 }
 function upload(data,w,h){uploadSet(data,w,h,textures);visibilityActive=false;if(data.studyVisibility){if(!(data.studyVisibility instanceof Float32Array)||data.studyVisibility.length!==w*h*4)throw Error('眼部光线可见度尺寸错误');gl.activeTexture(gl.TEXTURE8);gl.bindTexture(gl.TEXTURE_2D,visibilityTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,data.studyVisibility);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);visibilityActive=true;}sampleActive=false;if(data.samples){if(!sampleProgram||w*2>gl.getParameter(gl.MAX_TEXTURE_SIZE)||h*2>gl.getParameter(gl.MAX_TEXTURE_SIZE))throw Error('当前设备不支持逐采样眼内透射');uploadSet(data.samples,w*2,h*2,sampleTextures);sampleActive=true;}
  const error=gl.getError();if(error)throw Error('透射数据上传失败：'+error);width=w;height=h;statistics=data.statistics;active=true;
 }
 function draw(target,camera,w,h,eyes,settings,samplePatches=false){if(!active||w!==width||h!==height)return;const sampled=samplePatches&&sampleActive,program=sampled?sampleProgram:standardProgram,bank=sampled?sampleTextures:textures;let cache=locations.get(program);if(!cache){cache=new Map();locations.set(program,cache);}const U=name=>{if(!cache.has(name))cache.set(name,gl.getUniformLocation(program,'u_'+name));return cache.get(name);};gl.useProgram(program);gl.disable(gl.DEPTH_TEST);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.BLEND);gl.viewport(0,0,w,h);
  for(const [unit,name]of names.entries()){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,unit===0?target.textures[0]:bank[unit-1]);gl.uniform1i(U(name),unit);}
  for(const name of ['eye','forward','right','up'])gl.uniform3fv(U(name),camera[name]);gl.uniform2fv(U('eyePrincipal'),camera.principalUV||[.5,.5]);scene.bind(program,camera,settings);vessels.bind(program);gl.activeTexture(gl.TEXTURE8);gl.bindTexture(gl.TEXTURE_2D,visibilityTexture);gl.uniform1i(U('eyeExactVisibility'),8);gl.uniform1f(U('eyeExactVisibilityOn'),visibilityActive&&!sampled?1:0);
  const d=eyeUniformData(eyes),p=globalThis.__EYE_STUDY_OPTICS__||{};gl.uniform1i(U('eyeEnabled'),d.enabled);gl.uniform1i(U('eyeReference'),d.reference);gl.uniform1i(U('eyeFieldSamples'),4);
  for(const key of ['iris','tint','inner','sclera','misc','surface'])gl.uniform4fv(U('eye'+key[0].toUpperCase()+key.slice(1)+'[0]'),d[key]);
  gl.uniform4fv(U('transmissionOptics'),[p.ior??1.376,p.environment??2,p.coat??1,p.outerRoughness??0]);gl.uniform4fv(U('transmissionInterior'),[p.innerRoughness??.3,p.relief??1,p.absorption??0,0]);gl.uniform2fv(U('wetFilm'),[p.wetness??0,p.wetRoughness??.08]);gl.uniform1f(U('irisClarity'),p.irisClarity??1.22);gl.drawArrays(gl.TRIANGLES,0,3);const error=gl.getError();if(error)throw Error('眼内透射绘制失败：'+error);draws++;if(sampled)sampledDraws++;
 }
 return{adoptResident(data,w,h){for(const [i,key]of keys.entries()){if(!data[key])throw Error('Resident eye texture missing: '+key);textures[i]=data[key];}width=w;height=h;active=true;sampleActive=false;visibilityActive=false;statistics={residentGPU:true,cpuRayQueries:0};},upload,draw,coverage(samplePatches){if(!active)return null;const packed=!!samplePatches&&sampleActive;return{texture:(packed?sampleTextures:textures)[0],packed};},clear(){active=false;sampleActive=false;},ready:()=>active,report:()=>({active,sampleActive,width,height,draws,sampledDraws,statistics,secondaryIntersection:'source-derived eye inner surface; occluders checked',outerGeometry:'source-derived existing outer eye',tissueLighting:'source outer sclera and refracted source inner iris at existing iris coverage',trueVolumeScattering:false}),dispose(){vessels.dispose();for(const t of [...textures,...sampleTextures,visibilityTexture])gl.deleteTexture(t);gl.deleteProgram(standardProgram);if(sampleProgram)gl.deleteProgram(sampleProgram);}};
}
