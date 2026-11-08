// Rounded-operation barriers retain the error terms under GPU fast math.
// Finite tests are required on each renderer; this is not a portability proof.
export const DS_ARITHMETIC_GLSL=`
uniform uint u_bdRoundMask;
float bdRound(float x){return uintBitsToFloat(floatBitsToUint(x)^u_bdRoundMask);}
vec2 bdSumDS(vec2 a,vec2 b){
 float s=bdRound(a.x+b.x),v=bdRound(s-a.x);
 float e=bdRound(bdRound(a.x-bdRound(s-v))+bdRound(b.x-v));
 e=bdRound(e+bdRound(a.y+b.y));float h=bdRound(s+e);
 return vec2(h,bdRound(e-bdRound(h-s)));
}
vec2 bdProductDS(vec2 a,vec2 b){
 float ac=bdRound(4097.*a.x),bc=bdRound(4097.*b.x);
 float ah=bdRound(ac-bdRound(ac-a.x)),bh=bdRound(bc-bdRound(bc-b.x));
 float al=bdRound(a.x-ah),bl=bdRound(b.x-bh),p=bdRound(a.x*b.x);
 float e=bdRound(bdRound(ah*bh)-p);e=bdRound(e+bdRound(ah*bl));
 e=bdRound(e+bdRound(al*bh));e=bdRound(e+bdRound(al*bl));
 e=bdRound(e+bdRound(a.x*b.y));e=bdRound(e+bdRound(a.y*b.x));
 e=bdRound(e+bdRound(a.y*b.y));float h=bdRound(p+e);
 return vec2(h,bdRound(e-bdRound(h-p)));
}
`;
