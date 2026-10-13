/* R11 material layers. Maps are generated in memory, not downloaded.
   Shared bounded tile cache, metre-based grain coordinates, GPU mip filtering. */
(function(G){
'use strict';const H=G.HAT10,T=G.OwnHatThree,TAU=Math.PI*2,cache=new Map();
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
function hash(x,y,z=0){let a=(Math.imul(x+71,92837111)^Math.imul(y+29,689287499)^Math.imul(z+11,283923481))>>>0;a=Math.imul(a^(a>>>13),1597334677)>>>0;return ((a^(a>>>16))>>>0)/4294967296;}
function toSRGB(v){v=clamp(v);return Math.round(255*(v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055));}
function tile(family){
 if(cache.has(family))return cache.get(family);
 const felt=family==='felt',knit=family==='knit'||family==='braid',rib=family==='rib',trim=['trim','lining','binding','band','thread'].includes(family);
 const size=felt||trim?256:512,metres=knit||rib?.0256:.016,threads=knit?12:32;
 const height=new Float32Array(size*size),albedo=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size*threads,v=y/size*threads,ix=Math.floor(u),iy=Math.floor(v),fx=u-ix-.5,fy=v-iy-.5;
  const ax=Math.max(0,Math.cos(Math.PI*fx*1.12)),ay=Math.max(0,Math.cos(Math.PI*fy*1.12));
  const warp=Math.pow(ax,1.0),weft=Math.pow(ay,1.0),over=(ix-iy+threads*10)%4<2;
  const n=hash(x,y,19),yarn=hash(ix,iy,7);let h=0,value=1,r=.8;
  if(felt){
   const fiber=Math.pow(Math.max(0,Math.sin((x+y*.39)*2.4+hash(iy,0)*6.28)),7);
   h=(n-.5)*.000014+fiber*.000014;value=.81+.13*n+.04*fiber;r=.91+.07*n;
  }else if(knit||rib){
   const lane=knit?Math.abs(fx)*.84:0,y0=fy+lane-.13;
   const loop=Math.exp(-((y0*7.0)**2)),inside=Math.exp(-(((fy-.34)*9)**2))*Math.exp(-((fx*3.0)**2)),wave=rib?.5+.5*Math.cos(TAU*u):loop;
   h=.00023*wave+.000015*n;value=.69+.27*wave-.13*inside+.035*(n-.5);r=.84+.12*n;
  }else{
   const upper=over?warp:weft,lower=over?weft:warp,longitudinal=over?v:u,twist=Math.cos(TAU*(longitudinal*3.0+(over?fx:fy)*.65));
   h=(.000055*upper+.000011*lower+.000005*twist*upper)*(trim?.68:1);
   value=.80+.11*upper+.045*lower+.028*(hash(over?ix:iy,17)-.5)+.018*twist+.026*(n-.5);
   if(family==='tweed'){const flip=Math.floor(u/8)%2?1:-1,chevron=Math.cos(TAU*(v+flip*u)*.25);value+=.09*chevron+.045*(yarn-.5);h+=.000010*chevron;}
   if(trim){value=.76+.16*weft+.04*(n-.5);h=.000032*weft+.000010*warp;}
   r=.70+.20*(1-upper)+.05*n;
  }
  const i=y*size+x,k=i*4;height[i]=h;const rgb=toSRGB(value);
  albedo[k]=rgb;albedo[k+1]=rgb;albedo[k+2]=rgb;albedo[k+3]=255;
  rough[k]=255;rough[k+1]=Math.round(clamp(r)*255);rough[k+2]=255;rough[k+3]=255;
 }
 const step=metres/size;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size])/(2*step),dy=(height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x])/(2*step);
  const nx=-dx,ny=-dy,nz=1,d=Math.hypot(nx,ny,nz),k=(y*size+x)*4;
  normal[k]=Math.round((nx/d*.5+.5)*255);normal[k+1]=Math.round((ny/d*.5+.5)*255);normal[k+2]=Math.round((nz/d*.5+.5)*255);normal[k+3]=255;
 }
 function texture(bytes,color=false){const tx=new T.DataTexture(bytes,size,size,T.RGBAFormat);tx.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;tx.wrapS=tx.wrapT=T.RepeatWrapping;tx.repeat.set(1/metres,1/metres);tx.generateMipmaps=true;tx.minFilter=T.LinearMipmapLinearFilter;tx.magFilter=T.LinearFilter;tx.anisotropy=8;tx.needsUpdate=true;return tx;}
 const result={map:texture(albedo,true),normalMap:texture(normal),roughnessMap:texture(rough),metres,size,bytes:albedo.byteLength+normal.byteLength+rough.byteLength};cache.set(family,result);return result;
}
H.materialStats=()=>({families:cache.size,tileBytes:[...cache.values()].reduce((s,t)=>s+t.bytes,0),method:'generated yarn cross-sections + mipmapped tangent normals + sheen',downloadedImages:0});
H.roleColor=function(c,s,role){
 const col=new T.Color(s.color||c.color);if(role==='trim')col.set(c.trim);
 if(role==='binding'||role==='band')col.multiplyScalar(role==='band'?.91:.80);
 if(role==='lining')col.set('#34362c');if(role==='thread')col.lerp(new T.Color('#a4a082'),.16);
 if(role==='fiber')col.lerp(new T.Color('#c1bda6'),.28);if(role==='recess')col.set('#181b14');if(role==='underbrim')col.multiplyScalar(.74);return col;
};
const GLSL=`
uniform float ownDetail;uniform float ownSeed;varying vec3 ownLocal;
float h11(vec3 p){uvec3 q=uvec3(ivec3(floor(p)));uint x=(q.x+37u)*91771u^(q.y+83u)*73129u^(q.z+19u)*31793u;x^=uint(ownSeed*1000.0);x^=x>>11u;x*=49157u;x^=x>>15u;return float(x&65535u)/65535.0;}
float n11(vec3 p){vec3 b=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(h11(b),h11(b+vec3(1,0,0)),f.x),mix(h11(b+vec3(0,1,0)),h11(b+vec3(1,1,0)),f.x),f.y),mix(mix(h11(b+vec3(0,0,1)),h11(b+vec3(1,0,1)),f.x),mix(h11(b+vec3(0,1,1)),h11(b+vec3(1,1,1)),f.x),f.y),f.z);}
`;
H.makeMaterial=function(c,s,role){
 const family=['outer','underbrim','band'].includes(role)?c.family:role==='binding'?'trim':role==='braid'?'knit':role;
 const textile=family!=='recess'&&family!=='fiber',maps=textile?tile(family):{};
 const m=new T.MeshPhysicalMaterial({color:H.roleColor(c,s,role),roughness:1,metalness:0,map:maps.map||null,normalMap:maps.normalMap||null,roughnessMap:maps.roughnessMap||null,normalScale:new T.Vector2(.72*s.detail,.72*s.detail),sheen:family==='felt'?.55:family==='knit'?.45:.25,sheenRoughness:.86,sheenColor:new T.Color(c.color).lerp(new T.Color('#ddd8c8'),.3),specularIntensity:.36,side:T.FrontSide});
 m.name='R11-'+family;m.userData={family,role,own:true,normalAmplitude:.72,uniforms:{ownDetail:{value:s.detail},ownSeed:{value:(s.seed+c.seed)*.017}}};
 m.onBeforeCompile=sh=>{m.userData.shader=sh;Object.assign(sh.uniforms,m.userData.uniforms);
  sh.vertexShader='varying vec3 ownLocal;\n'+sh.vertexShader;sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nownLocal=position;');
  sh.fragmentShader=GLSL+'\n'+sh.fragmentShader;sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=1.0+ownDetail*.022*(n11(ownLocal*240.0)-.5);');
 };
 m.customProgramCacheKey=()=> 'R11-generated-weave-shared-v1';return m;
};
// Hat-local EB1-oriented adapter: procedural softboxes and controlled fill.
// This does not claim that other workbenches have been migrated to this code.
H.makeEnvironment=function(renderer){
 const w=512,h=256,data=new Float32Array(w*h*4),d=new T.Vector3();
 const sources=[{dir:new T.Vector3(-.60,.75,.75).normalize(),w:.31,h:.57,power:4.8},{dir:new T.Vector3(.72,.35,-.70).normalize(),w:.10,h:.48,power:3.2}];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=(x+.5)/w*TAU,v=(y+.5)/h*Math.PI;d.set(-Math.sin(v)*Math.cos(u),Math.cos(v),Math.sin(v)*Math.sin(u));let power=.025+.045*Math.max(0,d.y);
  for(const l of sources){const up=new T.Vector3(0,1,0),right=new T.Vector3().crossVectors(up,l.dir).normalize(),vertical=new T.Vector3().crossVectors(l.dir,right).normalize(),z=d.dot(l.dir);if(z>0){const dx=Math.abs(d.dot(right)/z),dy=Math.abs(d.dot(vertical)/z),mask=(1-clamp((dx-l.w+.03)/.06))*(1-clamp((dy-l.h+.03)/.06));power+=mask*l.power;}}
  const k=(y*w+x)*4;data[k]=power*1.025;data[k+1]=power;data[k+2]=power*.965;data[k+3]=1;
 }
 const texture=new T.DataTexture(data,w,h,T.RGBAFormat,T.FloatType);texture.mapping=T.EquirectangularReflectionMapping;texture.needsUpdate=true;
 const pm=new T.PMREMGenerator(renderer),rt=pm.fromEquirectangular(texture);texture.dispose();pm.dispose();return rt;
};
})(globalThis);
