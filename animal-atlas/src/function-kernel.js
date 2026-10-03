// Build-registered mathematical kernels only; imported files cannot supply executable code.
// A kernel maps (rest coordinate, compact fields, parameters) -> visible position/normal.
export function installFunctionKernel(material,{id,uniforms,glsl,normal=true}){
 if(!id||typeof glsl!=='string'||!glsl.includes('animalDeform'))throw Error('函数乐器缺少变形核');
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+glsl);
  if(normal)shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','vec3 animalP,animalN; animalDeform(position,normal,animalP,animalN); vec3 objectNormal=animalN;\n#ifdef USE_TANGENT\nvec3 objectTangent=vec3(tangent.xyz);\n#endif');
  else shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','vec3 animalP,animalN; animalDeform(position,normal,animalP,animalN); vec3 transformed=animalP;');
  if(normal)shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','vec3 transformed=animalP;');
 };
 material.customProgramCacheKey=()=>id+'\n'+glsl;
 material.userData.functionKernel={schema:'kaopu/function-kernel@1',id,evaluation:'gpu',normal,uniformNames:Object.keys(uniforms)};
}
