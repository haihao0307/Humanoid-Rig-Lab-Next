import{MATERIAL_GGX_GLSL}from'./LightingKernels.mjs';
import{SOURCE_SCENE_GLSL}from'./SourceSceneGLSL.mjs';
import{SOURCE_VISIBILITY_GLSL}from'./SourceVisibility.mjs';
import{EYE_OPTICS_GLSL}from'./EyeOptics.mjs';
import{eyeUniformData,defaultEyeVariables,validateEyeVariables}from'./EyeVariables.mjs';
import{createEyeVesselFunctions}from'./EyeVesselFunctions.mjs';
const EYE_PASS_VERTEX=`#version 300 es
precision highp float;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0,1);}`;
const EYE_PASS_FRAGMENT=`#version 300 es
precision highp float;precision highp int;
uniform highp sampler2D u_position,u_normal;uniform vec3 u_eye,u_forward,u_right,u_up;uniform int u_materialMode;out vec4 color;
${SOURCE_SCENE_GLSL}
${SOURCE_VISIBILITY_GLSL}
${MATERIAL_GGX_GLSL}
${EYE_OPTICS_GLSL}
void main(){ivec2 pixel=ivec2(gl_FragCoord.xy);vec4 position=texelFetch(u_position,pixel,0);int component=int(round(position.a))-1;if(component<1||component>4||u_eyeEnabled==0)discard;vec3 p=position.xyz,n0=normalize(texelFetch(u_normal,pixel,0).xyz*2.-1.);vec2 eyeQ;int side;if(!eyeCoordinates(p,component,eyeQ,side))discard;EyeMaterial m=eyeMaterial(p,n0,normalize(u_eye-p),eyeQ,side);vec3 result=u_materialMode==1?m.albedo:u_materialMode==2?vec3(clamp(.5+m.height/.09,0.,1.)):u_materialMode==3?vec3(m.roughness):u_materialMode==4?m.normal*.5+.5:u_materialMode==5?(side==0?vec3(.22,.58,.69):vec3(.56,.39,.72)):illuminateEye(m,normalize(u_eye-p),p,n0,pixel);color=vec4(u_materialMode==0?sceneDisplay(result):sceneEncode(result),1);}
`;
export function createEyeMaterialPass(gl,coordinates,scene){
 const vessels=createEyeVesselFunctions(gl),compile=(kind,text)=>{const shader=gl.createShader(kind);gl.shaderSource(shader,text);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;},program=gl.createProgram(),vs=compile(gl.VERTEX_SHADER,EYE_PASS_VERTEX),fs=compile(gl.FRAGMENT_SHADER,EYE_PASS_FRAGMENT);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.deleteShader(vs);gl.deleteShader(fs);
 const U=Object.fromEntries(['position','normal','eye','forward','right','up','materialMode','eyeIris[0]','eyeTint[0]','eyeInner[0]','eyeSclera[0]','eyeMisc[0]','eyeSurface[0]','eyeEnabled','eyeReference','eyeFieldSamples'].map(k=>[k,gl.getUniformLocation(program,'u_'+k)]));let draws=0;
 return{draw(target,camera,width,height,mode,eyes,sceneSettings){gl.useProgram(program);gl.disable(gl.DEPTH_TEST);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.BLEND);gl.viewport(0,0,width,height);for(const[unit,name]of[[0,'position'],[1,'normal']]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,target.textures[unit]);gl.uniform1i(U[name],unit);}for(const key of['eye','forward','right','up'])gl.uniform3fv(U[key],camera[key]);scene.bind(program,camera,sceneSettings);coordinates.bind(program);vessels.bind(program);const d=eyeUniformData(eyes);gl.uniform1i(U.eyeEnabled,d.enabled);gl.uniform1i(U.eyeReference,d.reference);gl.uniform1i(U.eyeFieldSamples,4);for(const key of['iris','tint','inner','sclera','misc','surface'])gl.uniform4fv(U['eye'+key[0].toUpperCase()+key.slice(1)+'[0]'],d[key]);gl.uniform1i(U.materialMode,mode);gl.drawArrays(gl.TRIANGLES,0,3);draws++;},report:()=>({draws,coordinates:coordinates.report(),vessels:vessels.report(),source:'R15 continuous source-owned iris, sclera, refraction and wet-coat rules; shared original scene',fullOpticalVolume:false}),dispose(){vessels.dispose();gl.deleteProgram(program);}};
}
