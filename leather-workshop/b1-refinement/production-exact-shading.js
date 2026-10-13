/** Preserve the pinned Three.js BRDF, PMREM atlas and bilinear sample count.
 * The atlas has roughness tiles inside level zero, not hardware mip levels.
 * Only a validated single-level, linear, anisotropy-one atlas uses explicit LOD.
 * Unknown samplers retain the upstream gradient instruction. No quality setting changes.
 */
const B1ExactShading=(()=>{
 const installed=new WeakMap();let installations=0,reconfigurations=0;
 function once(s,a,b){if(s.split(a).length!==2)throw Error('B1 shader contract drift: '+a);return s.replace(a,b);}
 let cube=T.ShaderChunk.cube_uv_reflection_fragment;
 cube=once(cube,'vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {','vec3 b1BilinearCubeUV( sampler2D envMap, vec2 faceUV, float face, float mipInt ) {');
 cube=once(cube,'float face = getFace( direction );','');
 cube=once(cube,'getUV( direction, face ) * ( faceSize - 2.0 )','faceUV * ( faceSize - 2.0 )');
 cube=once(cube,'vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );','float face = getFace( sampleDir );\n\t\tvec2 faceUV = getUV( sampleDir, face );\n\t\tvec3 color0 = b1BilinearCubeUV( envMap, faceUV, face, mipInt );');
 cube=once(cube,'vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );','vec3 color1 = b1BilinearCubeUV( envMap, faceUV, face, mipInt + 1.0 );');
 const levelZero=once(cube,'texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) )','textureLod( envMap, uv, 0.0 )');
 let lights=T.ShaderChunk.lights_physical_pars_fragment;
 lights=once(lights,'clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );','if ( dotNLcc > 0.0 ) clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );');
 lights=once(lights,'sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );','if ( dotNL > 0.0 ) sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );');
 lights=once(lights,'reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );','if ( dotNL > 0.0 ) reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );');
 lights=once(lights,'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );','if ( dotNL > 0.0 ) reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );');
 function eligible(t){return !!t&&t.mapping===T.CubeUVReflectionMapping&&t.minFilter===T.LinearFilter&&t.magFilter===T.LinearFilter&&t.anisotropy===1&&!t.generateMipmaps&&(!t.mipmaps||t.mipmaps.length===0);}
 function install(m,environment){
  if(!m?.isMeshStandardMaterial)return;const singleLevel=eligible(m.envMap||environment);let row=installed.get(m);
  if(row){if(row.singleLevel!==singleLevel){row.singleLevel=singleLevel;reconfigurations++;m.needsUpdate=true;}return;}
  row={singleLevel,prior:m.onBeforeCompile,key:m.customProgramCacheKey()};installed.set(m,row);installations++;
  m.onBeforeCompile=function(shader,r){row.prior.call(this,shader,r);shader.fragmentShader=shader.fragmentShader.replace('#include <cube_uv_reflection_fragment>',row.singleLevel?levelZero:cube).replace('#include <lights_physical_pars_fragment>',lights);};
  m.customProgramCacheKey=()=>row.key+'|B1-atlas-sharedFace-zeroIrradiance-lod'+Number(row.singleLevel)+'@1';m.needsUpdate=true;
 }
 function prepare(root){root?.traverse(o=>{if(o.isMesh)for(const m of(Array.isArray(o.material)?o.material:[o.material]))install(m,root.environment);});}
 return{prepare,install,eligible,report:()=>({installations,reconfigurations,atlasSampleCountUnchanged:true,roughnessTilesUnchanged:true,unknownSamplersUseOriginalGradients:true})};
})();
