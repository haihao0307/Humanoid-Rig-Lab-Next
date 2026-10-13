/* SPDX-License-Identifier: MIT
 * KAOPU coordinate-noise adapter, 2026. See HELPER_PROVENANCE.md.
 * fmix32 is adapted from Austin Appleby's public-domain MurmurHash3 finalizer:
 * aappleby/smhasher@92cf3702fcfaadc84eb7bef59825a23e0cd84f56/src/MurmurHash3.cpp
 * Coordinate encoding, fixed ASCII salts and interpolation arrangement are the
 * project adapter, not a claim to invent integer hashing or Hermite interpolation.
 * No old sine-hash values, images, tables, or fallback code are used here.
 */
(function(root){'use strict';
const SCALE=1/16777216, SX=0x4b414f50, SY=0x44454e4d;
function fmix32(v){let h=v>>>0;h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);return (h^(h>>>16))>>>0;}
function lattice(x,y){return (fmix32(fmix32((x|0)^SX)^((y|0)^SY))>>>8)*SCALE;}
function sample(x,y){
 if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>=8388608||Math.abs(y)>=8388608)throw RangeError('Noise domain: finite coordinates with magnitude below 2^23');
 const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j;
 // Cubic boundary conditions: s(0)=0, s(1)=1, s'(0)=s'(1)=0.
 // Bernstein form B_2^3+B_3^3, not an inherited shader snippet.
 const a=u*u*(3*(1-u)+u),b=v*v*(3*(1-v)+v);
 const row0=lattice(i,j)*(1-a)+lattice(i+1,j)*a;
 const row1=lattice(i,j+1)*(1-a)+lattice(i+1,j+1)*a;
 return row0*(1-b)+row1*b;
}
const glsl=`
// Austin Appleby public-domain fmix32; local adapter recorded in source notices.
uint denimFmix32(uint h){h^=h>>16;h*=0x85ebca6bu;h^=h>>13;h*=0xc2b2ae35u;return h^(h>>16);}
float denimLattice(ivec2 c){uint a=denimFmix32(uint(c.x)^0x4b414f50u);return float(denimFmix32(a^(uint(c.y)^0x44454e4du))>>8)*(1./16777216.);}
float denimNoise2(vec2 p){
 ivec2 cell=ivec2(floor(p));vec2 t=p-vec2(cell);
 vec2 s=t*t*(3.*(1.-t)+t);
 vec2 lo=vec2(denimLattice(cell),denimLattice(cell+ivec2(0,1)));
 vec2 hi=vec2(denimLattice(cell+ivec2(1,0)),denimLattice(cell+ivec2(1,1)));
 vec2 rows=lo*(1.-s.x)+hi*s.x;
 return dot(rows,vec2(1.-s.y,s.y));
}
`;
root.KAOPUDenimNoise={version:'kaopu.coordinate_noise@1',fmix32,lattice,sample,glsl};
if(typeof module!=='undefined')module.exports=root.KAOPUDenimNoise;
})(globalThis);
