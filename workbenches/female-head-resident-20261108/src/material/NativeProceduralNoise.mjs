// Authored appearance variation. These are shading functions and do not move
// the source mother surface, change openings, or replace anatomy with noise.
export const NATIVE_PROCEDURAL_NOISE_GLSL=`
vec3 nativeFaceBands(vec2 mm){float seed=uSDSeed*.013;float pores=fPores(mm*clamp(uSDPoreScale,.4,2.));float low=csNoise(vec3(mm*.082,seed+13.))-.5,mid=csNoise(vec3(mm*.53,seed+39.))-.5;return vec3(.5+clamp(pores*.10,-.36,.24),.5+low*.12+mid*.04,.5+mid*.16);}
vec3 nativeFaceChroma(vec2 mm){float seed=uSDSeed*.013;vec3 p=vec3(mm*.07,seed);return vec3(.5)+(vec3(csNoise(p+17.),csNoise(p+53.),csNoise(p+91.))-.5)*.07;}
vec4 nativeIdentityPigment(vec3 rest){vec3 p=rest*680.+uSDOffset;float spot=smoothstep(.72,.91,csNoise(p))*.0035*uSDFreckles;float warm=(csNoise(rest*147.+uSDOffset)-.5)*.003;return vec4(spot,max(0.,warm),0.,0.);}
vec4 nativeIdentityRelief(vec3 rest){float h=(csNoise(rest*420.+uSDOffset)-.5)*.0000018;return vec4(max(h,0.)/.001,max(-h,0.)/.001,0.,0.);}
float nativePigmentVariation(vec3 rest,float cheek,float forehead){vec3 mm=rest*1000.;float a=csNoise(mm/17.+uSDOffset)-.5,b=csNoise(mm/3.7+uSDOffset.yzx)-.5;return(a*.022+b*.006)*uSDVariation*(.55+.25*forehead+.20*cheek);}
float nativeVascularVariation(vec3 rest,float cheek,float thin){vec3 mm=rest*1000.;float a=csNoise(mm/11.+uSDOffset.zxy)-.5,b=csNoise(mm/2.8+uSDOffset)-.5;return(a*.030+b*.009)*uSDVariation*(.55+.35*cheek+.1*thin);}
`;
