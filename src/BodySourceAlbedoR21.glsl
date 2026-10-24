// Frozen R15 body sdAlbedo block / OwnSkinReflectance-generated RGB table.
// Original body observations prove csCover=1, csT=0, fRest=0, fA=fB=0,
// earWeight=0, band=0 in all nine fixed source states. Palm is retained.
// This restores albedo only; no full-skin or optical-parity claim.
uniform sampler2D pigmentTable,sourcePalms;
uniform vec4 sourceDna;uniform float sourceFlush;
vec3 sourcePigmentRGB(vec2 uv){vec2 p=clamp(uv,0.,1.)*vec2(32.,16.);ivec2 a=ivec2(floor(p)),b=min(a+ivec2(1),ivec2(32,16));vec2 f=fract(p);return mix(mix(texelFetch(pigmentTable,a,0).rgb,texelFetch(pigmentTable,ivec2(b.x,a.y),0).rgb,f.x),mix(texelFetch(pigmentTable,ivec2(a.x,b.y),0).rgb,texelFetch(pigmentTable,b,0).rgb,f.x),f.y);}
vec3 sourceBodyAlbedo(float csPalm){
 float csT=0.,rfNose=0.,rfForehead=0.;vec3 cheekQ=(vec3(0.)-vec3(.036,.277,.055))/vec3(.032,.028,.055);float rfCheek=exp(-dot(cheekQ,cheekQ)*1.5);
 float sdExposure=clamp(.26+.49*csT+.29*rfCheek+.13*rfForehead-.35*csPalm,0.,1.);
 float sdPigment=clamp(sourceDna.x+sourceDna.w*sdExposure*.04,0.,1.)*(1.-csPalm*.18);
 float sdVascular=clamp(sourceDna.y+sourceDna.z*(.04*rfCheek+.02*rfNose-.012*csPalm)+sourceFlush*(.05+.18*rfCheek+.06*rfNose),0.,1.);
 return sourcePigmentRGB(vec2(sdPigment,sdVascular));
}
vec3 sourceToSRGB(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
