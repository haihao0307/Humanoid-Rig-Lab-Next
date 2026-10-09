import * as T from 'three';
/** Artist-controlled surface finish over a licensed Poly Haven material. Not a material strength model. */
export class SewingAppearance{
 constructor(){this.textures={};}
 async load(data){
  await Promise.all(Object.entries(data).map(async([name,url])=>{const t=await new T.TextureLoader().loadAsync(url);t.colorSpace=name==='diff'?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.ClampToEdgeWrapping;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=8;t.repeat.set(96/150,96/75);t.offset.set(.012,.26);this.textures[name]=t;}));
 }
 grain(look){
  const m=new T.MeshPhysicalMaterial({color:new T.Color(look.color),map:this.textures.diff,normalMap:this.textures.nor_gl,normalScale:new T.Vector2(.82,.82),roughnessMap:this.textures.rough,roughness:1,metalness:0,ior:1.47,clearcoat:Math.min(.26,look.coat||.12),clearcoatRoughness:.36,side:T.FrontSide,vertexColors:true});
  const sourceAlbedoMean=[.08401343,.02765351,.00580022];m.color.r/=sourceAlbedoMean[0];m.color.g/=sourceAlbedoMean[1];m.color.b/=sourceAlbedoMean[2];m.name='OUTER_GRAIN_PBR';m.userData.surfaceRole='outer-grain';
  m.onBeforeCompile=shader=>{
   shader.uniforms.finishRoughness={value:look.roughness??.46};
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float compression; varying float vCompression;');
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCompression=compression;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float finishRoughness; varying float vCompression;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(finishRoughness*.62 + roughnessFactor*.18-vCompression*.035,.24,.85);');
  };
  m.customProgramCacheKey=()=>`grain-r051-${look.roughness}`;return m;
 }
 flesh(look){
  const m=new T.MeshPhysicalMaterial({color:new T.Color(look.color).multiplyScalar(.68),map:this.textures.diff,normalMap:this.textures.nor_gl,normalScale:new T.Vector2(.35,.35),roughness:.95,sheen:.3,sheenRoughness:.95,sheenColor:new T.Color(look.color),side:T.FrontSide,vertexColors:true});m.userData.surfaceRole='flesh';return m;
 }
 cut(look){
  const m=new T.MeshStandardMaterial({color:new T.Color(look.color).multiplyScalar(.67),roughness:.91,side:T.FrontSide});m.userData.surfaceRole='cut-fibres';
  m.onBeforeCompile=s=>{
   s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vLocalPosition;');s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLocalPosition=position;');
   s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vLocalPosition;\nfloat fibreHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}');
   s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat f=fibreHash(floor(vLocalPosition*vec3(75.,180.,75.)));diffuseColor.rgb*=.78+.32*f;');
  };m.customProgramCacheKey=()=> 'cut-fibres-r051';return m;
 }
}
