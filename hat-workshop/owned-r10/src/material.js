/* Analytic cloth/felt shading. No downloaded or reference image bytes. */
(function(G){
'use strict';const H=G.HAT10,T=G.OwnHatThree;
const modes={felt:0,canvas:1,tweed:2,knit:3,sport:4,cotton:5,rib:6,trim:7,lining:7,thread:5,braid:3};
const functions=`
uniform float ownMode;
uniform float ownDetail;
uniform float ownSeed;
varying vec2 ownUV;
varying vec3 ownLocal;
// R102 independently expressed integer lattice mixer; not cryptographic.
// Coordinates and seed are mixed as uint32; interpolation remains ordinary trilinear noise.
uint ownMixWord(uint w){w^=w>>11u;w*=49157u;w^=w>>7u;w*=16127u;w^=w>>15u;return w;}
float ownHash(vec3 p){
 uvec3 cell=uvec3(ivec3(floor(p)));uint seed=uint(floor(ownSeed*1000.0+.5));
 uint w=ownMixWord(cell.x+211u)^ownMixWord(cell.y+571u)^ownMixWord(cell.z+1453u)^ownMixWord(seed+1747u);
 return float(ownMixWord(w)&16777215u)/16777216.0;
}
float ownNoise(vec3 p){vec3 a=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(ownHash(a),ownHash(a+vec3(1,0,0)),f.x),mix(ownHash(a+vec3(0,1,0)),ownHash(a+vec3(1,1,0)),f.x),f.y),mix(mix(ownHash(a+vec3(0,0,1)),ownHash(a+vec3(1,0,1)),f.x),mix(ownHash(a+vec3(0,1,1)),ownHash(a+vec3(1,1,1)),f.x),f.y),f.z);}
float ownFade(vec2 f){return 1.0-smoothstep(.35,1.2,max(f.x,f.y));}
vec2 ownFabric(vec2 p,vec3 q){
 float grain=ownNoise(q*2400.0),heather=ownNoise(q*330.0),meso=ownNoise(q*65.0);
 float microFade=1.0-smoothstep(.35,1.2,max(max(fwidth(q.x*2400.0),fwidth(q.y*2400.0)),fwidth(q.z*2400.0)));
 float color=.98+(heather-.5)*.14+(meso-.5)*.05+(grain-.5)*.10*microFade;
 float h=(heather-.5)*.000035+(grain-.5)*.000045*microFade;
 if(ownMode>.5&&ownMode<2.5){
  vec2 w=p*vec2(1350.0,1450.0);float fade=ownFade(fwidth(w));
  float sx=cos(6.2831853*w.x),sy=cos(6.2831853*w.y);
  float crossing=mod(floor(w.x)+floor(w.y),2.0);float weave=mix(sx,sy,crossing);
  h+=weave*.000032*fade;color+=weave*.06*fade;
  if(ownMode>1.5){
   vec2 herring=p*vec2(120.0,900.0);float flip=mod(floor(herring.x),2.0)*2.0-1.0;
   float chevron=cos(6.2831853*(herring.y+flip*fract(herring.x)*2.3));
   float f=ownFade(fwidth(herring));color+=(chevron*.13+.05*sin(herring.x*6.283))*f;
   h+=chevron*.000040*f;
  }
 }
 if(ownMode>2.5&&ownMode<3.5){
  vec2 cell=p*vec2(285.0,325.0),f=fract(cell)-.5;
  float slope=abs(f.x)*.85;float yarn=exp(-pow((f.y+slope-.10)*8.0,2.0));
  float fade=ownFade(fwidth(cell));h+=.00038*yarn*fade;color+=(yarn-.52)*.23*fade;
 }
 if(ownMode>5.5&&ownMode<6.5){
  vec2 cell=p*vec2(350.0,500.0);float rib=cos(cell.x*6.2831853),fade=ownFade(fwidth(cell));
  h+=rib*.00024*fade;color+=rib*.12*fade;
 }
 if(ownMode>3.5&&ownMode<5.5){
  vec2 cell=p*vec2(1700.0,1700.0);float fade=ownFade(fwidth(cell));float tex=cos(cell.x*6.283)*sin(cell.y*6.283);
  h+=tex*.000018*fade;color+=tex*.035*fade;
 }
 if(ownMode>6.5){float f=ownFade(fwidth(p*1800.0));float rib=sin(p.y*11000.0);h+=rib*.000018*f;color+=rib*.05*f;}
 return vec2(h*ownDetail,mix(1.0,color,ownDetail));
}
`;
H.makeMaterial=function(c,s,role){
 const family=['outer','underbrim'].includes(role)?c.family:role;
 const base=new T.Color(s.color||c.color);
 if(role==='trim')base.set(c.trim);
 if(role==='lining')base.set('#59564e');
 if(role==='thread')base.lerp(new T.Color('#c5bcab'),.28);
 if(role==='underbrim')base.multiplyScalar(.92);
 const m=new T.MeshPhysicalMaterial({color:base,roughness:role==='trim'?.74:c.roughness,metalness:0,sheen:family==='felt'||family==='knit'?.38:.18,sheenRoughness:.84,sheenColor:new T.Color('#bcb5a6'),side:T.FrontSide});
 m.name='own-'+family;m.userData={family,role,own:true,uniforms:{ownMode:{value:modes[family]??0},ownDetail:{value:s.detail},ownSeed:{value:(c.seed+s.seed)*.017}}};
 m.onBeforeCompile=sh=>{
  m.userData.shader=sh;
  Object.assign(sh.uniforms,m.userData.uniforms);
  sh.vertexShader='varying vec2 ownUV;varying vec3 ownLocal;\n'+sh.vertexShader;
  sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nownUV=uv;ownLocal=position;');
  sh.fragmentShader=functions+'\n'+sh.fragmentShader;
  sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nvec2 ownSurface=ownFabric(ownUV,ownLocal);diffuseColor.rgb*=ownSurface.y;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec3 ownDx=dFdx(-vViewPosition),ownDy=dFdy(-vViewPosition);
   vec3 ownR1=cross(ownDy,normal),ownR2=cross(normal,ownDx);
   float ownDet=dot(ownDx,ownR1);
   if(abs(ownDet)>1e-12){vec3 ownGrad=sign(ownDet)*(dFdx(ownSurface.x)*ownR1+dFdy(ownSurface.x)*ownR2);vec3 ownSlope=ownGrad/max(abs(ownDet),1e-10);
    ownSlope*=min(1.0,.60/max(length(ownSlope),1e-6));normal=normalize(normal-ownSlope);}
  `);
 };
 m.customProgramCacheKey=()=> 'hat102-fabric-u32-' +family;
 return m;
};
H.makeEnvironment=function(renderer){
 const w=256,h=128,a=new Float32Array(w*h*4),d=new T.Vector3(),lights=[{d:new T.Vector3(-.7,.7,.4).normalize(),v:6,spread:20},{d:new T.Vector3(.6,.5,-.7).normalize(),v:4,spread:36}];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=(x+.5)/w*Math.PI*2,v=(y+.5)/h*Math.PI;d.set(-Math.sin(v)*Math.cos(u),Math.cos(v),Math.sin(v)*Math.sin(u));
  let b=.25+.33*Math.max(0,d.y);for(const l of lights)b+=l.v*Math.pow(Math.max(0,d.dot(l.d)),l.spread);
  const k=(y*w+x)*4;a[k]=b*1.02;a[k+1]=b;a[k+2]=b*.96;a[k+3]=1;
 }
 const tex=new T.DataTexture(a,w,h,T.RGBAFormat,T.FloatType);tex.mapping=T.EquirectangularReflectionMapping;tex.needsUpdate=true;
 const pm=new T.PMREMGenerator(renderer),rt=pm.fromEquirectangular(tex);tex.dispose();pm.dispose();return rt;
};
})(globalThis);
