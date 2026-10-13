/** Pinned-shader unit checks. Actual shading pixels and timings run in Chrome separately. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const R=__dirname,T=require('./node-lib.cjs').T,checks=[];
function ok(name,value){checks.push({name,pass:!!value});assert(value,name);}
const context=vm.createContext({T});vm.runInContext(fs.readFileSync(path.join(R,'src/render/exact-shading.js'),'utf8')+';globalThis.service=B1ExactShading;',context);const api=context.service;
function texture(p={}){return{mapping:T.CubeUVReflectionMapping,minFilter:T.LinearFilter,magFilter:T.LinearFilter,anisotropy:1,generateMipmaps:false,mipmaps:[],...p};}
function compile(m){const s={vertexShader:'#include <common>',fragmentShader:'#include <cube_uv_reflection_fragment>\n#include <lights_physical_pars_fragment>',uniforms:{}};m.onBeforeCompile(s,{});return s;}
let calls=0;const m=new T.MeshPhysicalMaterial();m.onBeforeCompile=s=>{calls++;s.uniforms.retained={value:7};};m.customProgramCacheKey=()=> 'original-program';
api.install(m,texture());let s=compile(m);ok('Validated atlas uses one explicit level without reducing texture sample count',s.fragmentShader.includes('textureLod( envMap, uv, 0.0 )')&&s.fragmentShader.includes('mipInt + 1.0')&&s.fragmentShader.includes('mix( color0, color1, mipF )'));
ok('Original material compile hook preserved',calls===1&&s.uniforms.retained.value===7);const key=m.customProgramCacheKey(),version=m.version;api.install(m,texture());ok('Repeated prepare neither recompiles nor wraps twice',m.version===version&&m.customProgramCacheKey()===key);compile(m);ok('Material hook remains a single call per compile',calls===2);
for(const [label,settings]of Object.entries({anisotropic:{anisotropy:2},generatedMips:{generateMipmaps:true},providedMips:{mipmaps:[{}]},differentFilter:{magFilter:T.NearestFilter},mipFilter:{minFilter:T.LinearMipmapLinearFilter},differentMapping:{mapping:T.EquirectangularReflectionMapping}})){
 api.install(m,texture(settings));s=compile(m);ok('Unknown sampler retains upstream gradients: '+label,!s.fragmentShader.includes('textureLod( envMap, uv, 0.0 )')&&s.fragmentShader.includes('texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) )'));
}
api.install(m,null);ok('No environment stays on generic path',!compile(m).fragmentShader.includes('textureLod( envMap, uv, 0.0 )'));
api.install(m,texture());ok('Validated environment can re-enable specialization with a distinct cache key',compile(m).fragmentShader.includes('textureLod( envMap, uv, 0.0 )')&&m.customProgramCacheKey()===key);
m.envMap=texture({anisotropy:4});api.install(m,texture());ok('Material-specific environment overrides the scene sampler contract',!compile(m).fragmentShader.includes('textureLod( envMap, uv, 0.0 )'));
const original=T.ShaderChunk.cube_uv_reflection_fragment;ok('Global Three.js shader chunks unchanged',original.includes('vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {')&&!original.includes('b1BilinearCubeUV'));
const basic=new T.MeshBasicMaterial(),hook=basic.onBeforeCompile;api.install(basic,texture());ok('Nonphysical materials untouched',basic.onBeforeCompile===hook);
const depth=new T.MeshDepthMaterial(),dh=depth.onBeforeCompile;api.install(depth,texture());ok('Shadow depth materials untouched',depth.onBeforeCompile===dh);
for(const p of ['wallet','swatch','bag'])ok('Source never branches on product identity '+p,!fs.readFileSync(path.join(R,'src/render/exact-shading.js'),'utf8').includes("'"+p+"'"));
const out=path.join(R,'qa/b1/shading-unit.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({pass:true,count:checks.length,checks,scope:'CPU shader source and sampler contract tests; not a GPU or pixel test'},null,2)+'\n');console.log('Shading contracts',checks.length);
