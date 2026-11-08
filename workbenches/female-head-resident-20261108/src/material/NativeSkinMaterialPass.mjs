import{NATIVE_SKIN_SOURCE_PREFIX,NATIVE_SKIN_SOURCE_BODY}from'./NativeSkinSourceProgram.mjs';
import{NATIVE_PROCEDURAL_NOISE_GLSL}from'./NativeProceduralNoise.mjs';
import{SOURCE_SCENE_GLSL}from'./SourceSceneGLSL.mjs';
import{SOURCE_SCENE_PROFILE}from'./SourceSceneProfile.mjs';
import{createSourceScene}from'./SourceScene.mjs';
import{createSourceGaussianNoiseFunctions}from'./SourceGaussianNoiseFunctions.mjs';
import{createNativeLipCurveCache}from'./NativeLipCurveCache.mjs';
const vertex='#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0,1.);}';
function sceneLibrary(){let s=SOURCE_SCENE_GLSL.replace(/#ifdef texture2DGradEXT[\s\S]*?#else([\s\S]*?)#endif/,'$1');for(const name of['getFace','getUV','bilinearCubeUV','roughnessToMip','textureCubeUV'])s=s.replaceAll(new RegExp('\\b'+name+'\\b','g'),'nsScene_'+name);for(const name of[...new Set(s.match(/\b(?:CUBEUV_[A-Z_]+|cubeUV_minMipLevel|cubeUV_minTileSize|ENVMAP_TYPE_CUBE_UV)\b/g)||[])])s=s.replaceAll(new RegExp('\\b'+name+'\\b','g'),'NS_'+name);return s;}
const inputGLSL=`
uniform highp sampler2DArray u_nativeGeometry,u_nativeInputs;uniform vec3 u_nativeEye,u_nativeRight,u_nativeUp,u_nativeForward;uniform int u_nativeMode,u_nativePreserve;
float ni(int channel){vec4 v=texelFetch(u_nativeInputs,ivec3(ivec2(gl_FragCoord.xy),channel/4),0);return v[channel%4];}
vec3 ni3(int channel){return vec3(ni(channel),ni(channel+1),ni(channel+2));}vec4 ni4(int channel){return vec4(ni3(channel),ni(channel+3));}
vec3 toHead(vec3 v){return u_nativeRight*v.x+u_nativeUp*v.y-u_nativeForward*v.z;}
vec3 toView(vec3 v){return vec3(dot(v,u_nativeRight),dot(v,u_nativeUp),-dot(v,u_nativeForward));}
`;
function fragmentSource(){
 let prefix=NATIVE_SKIN_SOURCE_PREFIX.replace('varying float vCSType;','').replaceAll(/\bvCSType\b/g,'0.');
 let body=NATIVE_SKIN_SOURCE_BODY.replace('void main() {',`void main() {
 ivec2 pixel=ivec2(gl_FragCoord.xy);vec4 hit=texelFetch(u_nativeGeometry,ivec3(pixel,0),0);if(hit.a<.5){if(u_nativePreserve>0)discard;pc_fragColor=vec4(sceneEncode(u_sceneBackground),1);return;}if(hit.a>1.5){pc_fragColor=vec4(1,0,1,1);return;}
 vec4 normalField=texelFetch(u_nativeGeometry,ivec3(pixel,1),0);vec3 nativePoint=hit.xyz;float nativeFaceDirection=normalField.w;
 vETPosition=ni3(0);vFRest=ni3(3);vCSRest=ni3(6);vCSRegion=ni4(9);vCSExtra=ni4(13);vL19State=ni4(17);vL19Detail=ni4(21);vETissue=ni4(25);vFA=ni4(29);vFB=ni4(33);vFEye=ni4(37);vColor=ni3(41);vE6Direct=ni3(44);vE6Deep=ni3(47);vE6Weight=vETissue.z;vEWeight=vETissue.z;
 vNormal=toView(normalField.xyz);vViewPosition=-toView((nativePoint-u_nativeEye)*.001);
 `).replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;','float faceDirection = nativeFaceDirection;');
 // The fullscreen display pass has no geometric depth attachment.
 body=body.replace(/#if defined\( USE_LOGDEPTHBUF \)[\s\S]*?#endif/,'');
 const lighting=`
 vec3 nativeN=normalize(toHead(normal)),nativeCC=normalize(toHead(clearcoatNormal)),nativeView=normalize(u_nativeEye-nativePoint);vec3 nativeV=normalize(vViewPosition);
 if(u_nativeMode==5){pc_fragColor=vec4(normalize(normalField.xyz)*.5+.5,1);return;}if(u_nativeMode==1){pc_fragColor=vec4(sceneEncode(material.diffuseColor),1);return;}if(u_nativeMode==2){pc_fragColor=vec4(sceneEncode(vec3(clamp(.5+lpHeight*2000.,0.,1.))),1);return;}if(u_nativeMode==3){pc_fragColor=vec4(sceneEncode(vec3(material.roughness)),1);return;}if(u_nativeMode==4){pc_fragColor=vec4(nativeN*.5+.5,1);return;}
 for(int i=0;i<2;i++){IncidentLight light;light.direction=toView(u_sceneLightDirections[i]);light.color=u_sceneLightRadiance[i]*sceneShadow(nativePoint,normalize(normalField.xyz),i);light.visible=true;RE_Direct_Physical(light,-vViewPosition,normal,nativeV,clearcoatNormal,material,reflectedLight);}
 vec3 envIrradiance=sceneIrradiance(nativeN);RE_IndirectDiffuse_Physical(ambientLightColor,-vViewPosition,normal,nativeV,clearcoatNormal,material,reflectedLight);
 RE_IndirectSpecular_Physical(sceneRadiance(nativeN,nativeView,material.roughness),envIrradiance,sceneRadiance(nativeCC,nativeView,material.clearcoatRoughness),-vViewPosition,normal,nativeV,clearcoatNormal,material,reflectedLight);
 if(u_nativeMode==6){pc_fragColor=vec4(sceneDisplay(reflectedLight.directDiffuse),1);return;}if(u_nativeMode==7){pc_fragColor=vec4(sceneDisplay(reflectedLight.indirectDiffuse),1);return;}if(u_nativeMode==8){pc_fragColor=vec4(sceneDisplay(reflectedLight.directSpecular+reflectedLight.indirectSpecular),1);return;}vec3 outgoing=reflectedLight.directDiffuse+reflectedLight.indirectDiffuse+reflectedLight.directSpecular+reflectedLight.indirectSpecular+totalEmissiveRadiance;
 #ifdef USE_SHEEN
 outgoing=outgoing*(1.-.157*max3(material.sheenColor))+sheenSpecularDirect+sheenSpecularIndirect;
 #endif
 #ifdef USE_CLEARCOAT
 vec3 coatF=F_Schlick(material.clearcoatF0,material.clearcoatF90,saturate(dot(clearcoatNormal,nativeV)));outgoing=outgoing*(1.-material.clearcoat*coatF)+(clearcoatSpecularDirect+clearcoatSpecularIndirect)*material.clearcoat;
 #endif
 pc_fragColor=vec4(sceneDisplay(outgoing),1);
}
`;
 return prefix+'\n'+inputGLSL+'\n'+sceneLibrary()+'\n'+NATIVE_PROCEDURAL_NOISE_GLSL+'\n'+body+lighting;
}
export async function createNativeSkinMaterialPass(gl,{recipeURL='/material/native-procedural-skin-recipe.json',sceneFunctions=null}={}){
 const recipe=await(await fetch(recipeURL)).json(),scene=sceneFunctions||await createSourceScene(gl),noise=await createSourceGaussianNoiseFunctions(gl,{firstTextureUnit:8}),curve=await createNativeLipCurveCache(gl,recipe.curve,{unit:6,expectedSHA256:recipe.curveSHA256,anisotropy:recipe.curveAnisotropy});
 const pigmentBytes=await(await fetch(recipe.pigment.url)).arrayBuffer(),pigmentSHA=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pigmentBytes)),x=>x.toString(16).padStart(2,'0')).join('');if(pigmentBytes.byteLength!==recipe.pigment.bytes||pigmentSHA!==recipe.pigment.sha256)throw Error('原光学响应函数完整性失败');
 const pigment=gl.createTexture();gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,pigment);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,33,17,0,gl.RGBA,gl.FLOAT,new Float32Array(pigmentBytes));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 const compile=(type,text)=>{const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;},program=gl.createProgram(),v=compile(gl.VERTEX_SHADER,vertex),f=compile(gl.FRAGMENT_SHADER,fragmentSource());gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 const uniforms=new Map();for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const info=gl.getActiveUniform(program,i),name=info.name.replace(/\[0\]$/,'');uniforms.set(name,{type:info.type,size:info.size,location:gl.getUniformLocation(program,info.name)});}
 const geometry=gl.createTexture(),inputs=gl.createTexture(),dummy2D=gl.createTexture(),dummyArray=gl.createTexture();gl.activeTexture(gl.TEXTURE12);gl.bindTexture(gl.TEXTURE_2D,dummy2D);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D_ARRAY,dummyArray);gl.texImage3D(gl.TEXTURE_2D_ARRAY,0,gl.RGBA8,1,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.NEAREST);let width=0,height=0,draws=0;
 function uniform(name,value){const u=uniforms.get(name);if(!u||value===null||value===undefined)return;const a=Array.isArray(value)?value.flat(Infinity):value;switch(u.type){case gl.FLOAT:if(u.size>1)gl.uniform1fv(u.location,a);else gl.uniform1f(u.location,Number(a));break;case gl.INT:case gl.BOOL:gl.uniform1i(u.location,Number(a));break;case gl.FLOAT_VEC2:gl.uniform2fv(u.location,a);break;case gl.FLOAT_VEC3:gl.uniform3fv(u.location,a);break;case gl.FLOAT_VEC4:gl.uniform4fv(u.location,a);break;case gl.FLOAT_MAT3:gl.uniformMatrix3fv(u.location,false,a);break;case gl.FLOAT_MAT4:gl.uniformMatrix4fv(u.location,false,a);break;}}
 function upload(geo,values,w,h,layers=13){width=w;height=h;for(const[unit,texture,data,depth]of[[0,geometry,geo,3],[1,inputs,values,layers]]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D_ARRAY,texture);gl.texImage3D(gl.TEXTURE_2D_ARRAY,0,gl.RGBA32F,w,h,depth,0,gl.RGBA,gl.FLOAT,data);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}}
 function draw(camera,{mode=0,preserve=false,variables={},sceneSettings={lighting:'original',reverse:false,exposure:.7,contact:1}}={}){
  gl.useProgram(program);gl.disable(gl.DEPTH_TEST);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.BLEND);gl.viewport(0,0,width,height);for(const u of uniforms.values()){if(u.type===gl.SAMPLER_2D){if(u.size>1)gl.uniform1iv(u.location,new Int32Array(u.size).fill(12));else gl.uniform1i(u.location,12);}else if(u.type===gl.SAMPLER_2D_ARRAY)gl.uniform1i(u.location,5);}gl.activeTexture(gl.TEXTURE12);gl.bindTexture(gl.TEXTURE_2D,dummy2D);gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D_ARRAY,dummyArray);for(const[name,value]of Object.entries({...recipe.uniforms,...variables}))uniform(name,value);
  for(const[unit,texture,name]of[[0,geometry,'u_nativeGeometry'],[1,inputs,'u_nativeInputs']]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D_ARRAY,texture);gl.uniform1i(gl.getUniformLocation(program,name),unit);}
  gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,pigment);gl.uniform1i(gl.getUniformLocation(program,'u_nativePigmentNodes'),7);curve.bind(program,'uLAtlas');noise.bind(program);scene.bind(program,camera,sceneSettings);
  for(const[key,name]of[['eye','u_nativeEye'],['right','u_nativeRight'],['up','u_nativeUp'],['forward','u_nativeForward']])gl.uniform3fv(gl.getUniformLocation(program,name),camera[key]);gl.uniform1i(gl.getUniformLocation(program,'u_nativeMode'),mode);gl.uniform1i(gl.getUniformLocation(program,'u_nativePreserve'),preserve?1:0);
  const f=SOURCE_SCENE_PROFILE.headFrame,toWorld=d=>[0,1,2].map(k=>f.x[k]*d[0]+f.up[k]*d[1]+f.front[k]*d[2]),r=toWorld(camera.right),u=toWorld(camera.up),fw=toWorld(camera.forward),offset=toWorld([camera.eye[0]*.001,camera.eye[1]*.001-.301,camera.eye[2]*.001-.105]),eye=offset.map((v,k)=>v+f.origin[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
  uniform('viewMatrix',[r[0],u[0],-fw[0],0,r[1],u[1],-fw[1],0,r[2],u[2],-fw[2],0,-dot(r,eye),-dot(u,eye),dot(fw,eye),1]);uniform('cameraPosition',eye);gl.drawArrays(gl.TRIANGLES,0,3);draws++;
 }
 return{upload,draw,fragmentSource,report:()=>({draws,width,height,sourceTriangles:0,importedCharacterImages:0,curve:curve.report(),noise:noise.report(),scene:scene.report(),sourceFidelityAccepted:false,fullOpticsAccepted:false,lightState:'Captured original EB1 transfer coefficients; other lighting states need a transfer update'}),dispose(){if(!sceneFunctions)scene.dispose();noise.dispose();curve.dispose();gl.deleteTexture(pigment);gl.deleteTexture(geometry);gl.deleteTexture(inputs);gl.deleteTexture(dummy2D);gl.deleteTexture(dummyArray);gl.deleteProgram(program);}};
}
