/**
 * Emily-inspired transfer kernel. Original reference inspected 2026-10-08:
 * https://alteredqualia.com/xg/examples/emily.html, createScene2(), lines 1630-1647.
 * Original uses XG.PhongMaterial + diffuse/bump/gloss + 64x detail bump + wrapRGB.
 * This is an independent Three.js implementation of that light-response idea,
 * NOT a copy of the XG engine and NOT Emily's mesh or textures.
 * Its specular model remains Three.js physical GGX, not original XG Phong.
 * This module contains no face coordinates, mesh arrays, or asset URLs.
 */
export const EMILY_REFERENCE = Object.freeze({
  url:'https://alteredqualia.com/xg/examples/emily.html',
  originalMaterial:'XG.PhongMaterial',
  originalWrapRGB:[0.675,0.45,0.45],
  originalDetailRepeat:64,
  originalBumpScale:0.7,
  originalShininess:1.2,
  reconstruction:'RGB wrapped diffuse + current target scan + GGX specular',
  exactXGPort:false
});
export const emilyDirectDiffuse = `
  float nl=dot(geometryNormal,directLight.direction);
  vec3 extended=max(vec3(nl)+vec3(.12,.035,.015),vec3(0.))/vec3(1.2544,1.071225,1.030225);
  vec3 enhanced=mix(vec3(dotNL),extended,uScatter*.28*(1.-uBaseline));
  float halfLambert=max(nl*.5+.5,0.);
  vec3 emilyWrap=mix(vec3(dotNL),vec3(halfLambert),vec3(.675,.45,.45)*uWrapAmount);
  reflectedLight.directDiffuse+=mix(enhanced,emilyWrap,uEmilyMethod)*directLight.color*BRDF_Lambert(material.diffuseColor);
`;
/** Update the shared uniform objects without changing the character or source textures. */
export function applyTransferFeatures({uniforms,material,fuzzMaterial,values,features,method,baseline}) {
  const enabled=!baseline, advanced=method==='enhanced';
  uniforms.uBaseline.value=0; // A/B keeps albedo, pigment, AO and actual geometry invariant.
  uniforms.uEmilyMethod.value=enabled&&method==='emily'?1:0;
  uniforms.uWrapAmount.value=features.diffusion?values.wrap:0;
  uniforms.uScatter.value=enabled&&advanced&&features.diffusion?values.sss:0;
  uniforms.uMeso.value=enabled&&features.detail?values.meso:0;
  uniforms.uMicro.value=enabled&&features.detail?values.micro:0;
  uniforms.uPores.value=enabled&&features.detail?values.pores:0;
  uniforms.uTranslucency.value=enabled&&advanced&&features.transmission?values.translucency:0;
  uniforms.uOil.value=enabled&&features.reflection?values.oil:0;
  material.clearcoat=Math.max(.00001,uniforms.uOil.value*.68);
  fuzzMaterial.uniforms.uFuzz.value=enabled&&advanced&&features.fuzz?values.fuzz:0;
}
