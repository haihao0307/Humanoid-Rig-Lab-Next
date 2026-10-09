import * as THREE from 'three';
// Independent orthographic PCSS adaptation, using the project's packed-depth
// Three.js renderer. Reference: official webgl_shadowmap_pcss example.
// Shadows remain geometric; light intensities and the skin shader are unchanged.
export function installSoftOcularShadows(){
 const original=THREE.ShaderChunk.shadowmap_pars_fragment;
 if(original.includes('et03ContactShadow'))return;
 const anchor='float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {';
 if(!original.includes(anchor))throw Error('Unsupported shadow shader revision');
 const functions=`
 vec2 et03Disk(float i,float n){float a=i*2.39996323;return sqrt((i+.5)/n)*vec2(cos(a),sin(a));}
 float et03ContactShadow(sampler2D depthMap,vec3 coord,vec2 mapSize){
  vec2 uv=coord.xy;float z=coord.z;
  vec2 dx=dFdx(uv),dy=dFdy(uv);float zx=dFdx(z),zy=dFdy(z),det=dx.x*dy.y-dx.y*dy.x;
  vec2 gradient=abs(det)>1e-12?vec2(dy.y*zx-dx.y*zy,dx.x*zy-dy.x*zx)/det:vec2(0.);
  gradient=clamp(gradient,vec2(-.8),vec2(.8));
  float searchRadius=.021,gap=0.,count=0.;
  for(int i=0;i<16;i++){
   vec2 offset=et03Disk(float(i),16.)*searchRadius;
   float depth=unpackRGBAToDepth(texture2D(depthMap,uv+offset));
   float localZ=z+dot(gradient,offset),delta=localZ-depth;
   if(delta>.00007){gap+=delta;count+=1.;}
  }
  if(count<.5)return 1.;
  float radius=clamp((gap/count)*1.95*.22/.44,1.25/mapSize.x,.026);
  float visibility=0.;
  for(int i=0;i<32;i++){
   vec2 offset=et03Disk(float(i),32.)*radius;
   float depth=unpackRGBAToDepth(texture2D(depthMap,uv+offset));
   float localZ=z+dot(gradient,offset);
   visibility+=smoothstep(localZ-.00007,localZ+.00002,depth);
  }
  return visibility/32.;
 }
 `;
 let shader=original.replace(anchor,functions+'\n'+anchor);
 const scope=shader.indexOf(anchor),start=shader.indexOf('if ( frustumTest ) {',scope);
 if(start<0)throw Error('Shadow frustum anchor absent');
 shader=shader.slice(0,start)+shader.slice(start).replace('if ( frustumTest ) {','if ( frustumTest ) {\nreturn mix(1.0,et03ContactShadow(shadowMap,shadowCoord.xyz,shadowMapSize),shadowIntensity);');
 THREE.ShaderChunk.shadowmap_pars_fragment=shader;
}
