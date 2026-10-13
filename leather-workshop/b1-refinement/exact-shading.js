/** Algebra-preserving fragment specialization for the pinned Three.js shaders.
 * No light, material, texture lookup, BRDF approximation or sample count is removed.
 * Share face/UV preparation for the two PMREM mip samples. A zero irradiance
 * contribution needs no BRDF evaluation; retain each nonzero term in its old order.
 */
const B1ExactShading=(()=>{
 const installed=new WeakSet();let materials=0;
 function once(s,a,b){if(s.split(a).length!==2)throw Error('B1 shader contract drift: '+a);return s.replace(a,b);}
 let cube=T.ShaderChunk.cube_uv_reflection_fragment;
 cube=once(cube,'vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {','vec3 b1BilinearCubeUV( sampler2D envMap, vec2 faceUV, float face, float mipInt ) {');
 cube=once(cube,'float face = getFace( direction );','');
 cube=once(cube,'getUV( direction, face ) * ( faceSize - 2.0 )','faceUV * ( faceSize - 2.0 )');
 cube=once(cube,'vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );','float face = getFace( sampleDir );\n\t\tvec2 faceUV = getUV( sampleDir, face );\n\t\tvec3 color0 = b1BilinearCubeUV( envMap, faceUV, face, mipInt );');
 cube=once(cube,'vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );','vec3 color1 = b1BilinearCubeUV( envMap, faceUV, face, mipInt + 1.0 );');
 let lights=T.ShaderChunk.lights_physical_pars_fragment;
 lights=once(lights,'clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );','if ( dotNLcc > 0.0 ) clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );');
 lights=once(lights,'sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );','if ( dotNL > 0.0 ) sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );');
 lights=once(lights,'reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );','if ( dotNL > 0.0 ) reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );');
 lights=once(lights,'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );','if ( dotNL > 0.0 ) reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );');
 function install(m){
  if(!m?.isMeshStandardMaterial||installed.has(m))return;installed.add(m);materials++;
  const prior=m.onBeforeCompile,key=m.customProgramCacheKey.bind(m);
  m.onBeforeCompile=function(shader,r){prior.call(this,shader,r);shader.fragmentShader=shader.fragmentShader.replace('#include <cube_uv_reflection_fragment>',cube).replace('#include <lights_physical_pars_fragment>',lights);};
  m.customProgramCacheKey=()=>key()+'|B1-sharedPMREM-zeroIrradiance-v1';m.needsUpdate=true;
 }
 function prepare(root){root?.traverse(o=>{if(o.isMesh)for(const m of(Array.isArray(o.material)?o.material:[o.material]))install(m);});}
 return {prepare,install,report:()=>({materials,pmremSamplesUnchanged:true,lightContributionsUnchanged:true})};
})();
