import {bindingGLSL} from './surface-binding.mjs';
import './native/cotton-surface.js';
import './native/noise-kernel.js';
const cotton=globalThis.KAOPUCottonSurface,noise=globalThis.KAOPUDenimNoise;
const nativeHash=`float hash(float x){uint n=(uint(int(x))^0x9e3779b9u)*0x85ebca6bu;n^=n>>13;n*=0xc2b2ae35u;return float(n^(n>>16))/4294967296.;}`;

export const yarnShader=`
attribute vec4 yarnInterval;attribute vec2 yarnEnds;attribute vec3 tubeCoordinate;attribute float tubeCap;
uniform float uKnit,uKind,uPitch,uWeftPitch,uThickness,uRadius,uPattern,uReverse,uDepth,uTwist,uOffset,uPlain,uPlies,uLOD,uPacking,uFuzz;
uniform vec2 uShift;uniform vec3 uDye,uContrast,uWeftDye;varying vec3 vSolidColour;varying vec3 vSolidCoord;varying vec3 vYarnT;varying vec3 vClothN;
const float TAU=6.28318530718,COURSE=.716197243913;
${bindingGLSL}
${cotton.shapeGLSL}
float stitchArc(float t){return 3.926862431999*t-.019512499729*sin(12.56637061436*t)+.012534954656*sin(25.13274122872*t)+.000256499088*sin(37.69911184308*t)-.000120229580*sin(50.26548245744*t)-.000009090432*sin(62.8318530718*t)+.000002920105*sin(75.39822368616*t);}
float colourAt(float col,float row){vec2 p=mod(vec2(col,row),16.);if(uPattern<.5)return 0.;if(uPattern>2.5&&uPattern<3.5)return mod(p.y,8.)<4.?0.:1.;float d=abs(p.x-7.5)+abs(p.y-7.5);return abs(d-6.)<1.1?1.:(mod(p.x+p.y,5.)<.5?1.:0.);}
float sm7(float t){t=clamp(t,0.,1.);return t*t*t*t*(35.+t*(-84.+t*(70.-20.*t)));}
float draft(float x,float y){return mod(y-x,4.)<2.999?1.:-1.;}
vec3 restYarn(float t,float lane,float carrier){if(uKnit>.5){float u=fract(t),a=TAU*u;bool working=uPattern<.5||abs(colourAt(floor(t),lane)-carrier)<.1;vec3 p=vec3(t+.238732414638*sin(2.*a),lane*COURSE+.636619772368*cos(a),-.159154943092*cos(2.*a));
 if(!working){p=vec3(t,lane*COURSE+.636619772368,-.159154943092);for(int e=0;e<2;e++){float v=e==0?u:1.-u;if(v<.3)p.y-=.785398163397*v*v*(1.-sm7(v/.3));}}
 p*=uPitch;p.xy+=uShift;p.z*=uReverse*uDepth;if(uPattern>.5&&uPattern<2.5)p.z-=(working?1.-sm7(min(u,1.-u)/.3):1.)*uRadius*1.4;return p;}
 float crossPitch=uKind<.5?uWeftPitch:uPitch,q=t/crossPitch,a=floor(q-.5),f=fract(q-.5);f=f*f*(3.-2.*f);float aa=uKind<.5?draft(lane,a):-draft(a,lane),bb=uKind<.5?draft(lane,a+1.):-draft(a+1.,lane);
 // At subpixel distance the closed tubes retain their pitch and width while
 // the crimp is low-pass filtered; microscope LOD restores the crossing wave.
 float crimpFilter=uLOD<.5?0.:1.;float z=mix(aa,bb,f)*uThickness*.265*crimpFilter; if(uKind>.5)z-=uThickness*.235*.18;
 return uKind<.5?vec3((lane+.5)*uPitch,t,z):vec3(t,(lane+.5)*uWeftPitch,z);}
void solidVertex(out vec3 P,out vec3 NN){float t=mix(yarnInterval.x,yarnInterval.y,tubeCoordinate.x),lane=yarnInterval.z,carrier=yarnInterval.w,theta=tubeCoordinate.y,ply=tubeCoordinate.z;float eps=uKnit>.5?.0005:.008;
 vec3 q=restYarn(t,lane,carrier),N,U,V;surfaceFrame(q.xy,P,N,U,V);vec3 dq=(restYarn(t+eps,lane,carrier)-restYarn(t-eps,lane,carrier))/(2.*eps),T=normalize(U*dq.x+V*dq.y+N*dq.z*.001),B=normalize(cross(T,N)+vec3(1e-12)),W=normalize(cross(B,T));P+=N*(uOffset+q.z)*.001;
 float arc=uKnit>.5?stitchArc(t)*uPitch:t,phase=TAU*arc/uTwist+lane*.31;float radius=uRadius*(1.+.035*sin(arc*.63+lane*1.3)),ra=radius,rz=radius;
 if(uKnit>.5){if(uPlies>1.5){float phi=phase+ply*TAU/3.;vec3 radialPly=cos(phi)*B+sin(phi)*W;
 P+=.001*.48*radius*radialPly;
 // Cross section must be perpendicular to the helix, not to the untwisted core.
 vec3 plyT=normalize(T+(-sin(phi)*B+cos(phi)*W)*(.48*radius*TAU/max(.3,uTwist)));
 B=normalize(B-plyT*dot(B,plyT));T=plyT;W=normalize(cross(B,T));ra=rz=radius*.55;}else{ra=rz=radius*1.02;}}
 else{ra=(uKind<.5?uPitch*.49:uWeftPitch*.235)*uPacking;rz=uThickness*.235*(uKind<.5?1.:.68);vec2 cottonShape=cottonPacking(theta,arc,lane+uKind*137.);ra*=cottonShape.x;rz*=cottonShape.x;}
 vec3 radial=B*(cos(theta)*ra)+W*(sin(theta)*rz);NN=normalize(B*cos(theta)/ra+W*sin(theta)/rz);
 if(abs(tubeCap)>.5){float enabled=tubeCap<0.?yarnEnds.x:yarnEnds.y;P+=enabled>.5?vec3(0.):radial*.001;NN=T*sign(tubeCap);}else P+=radial*.001;
 if(uLOD<.5&&uKnit<.5)NN=normalize(N*.24+NN*.76);
 vYarnT=normalize(normalMatrix*T);vClothN=normalize(normalMatrix*N);
 vSolidColour=uKnit>.5?mix(uDye,uContrast,carrier):mix(uDye,uWeftDye,uKind);vSolidColour*=1.+.028*sin(arc*.67+lane*1.47);vSolidColour=mix(vSolidColour,vec3(.52),uPlain);vSolidCoord=vec3(arc,theta,lane);
}
`;
export const yarnFragment=`
uniform float uKnit,uTwist,uLOD,uPlain;
float twistPhase=vSolidCoord.y*3.-vSolidCoord.x*6.2831853/uTwist;
float footprint=max(fwidth(twistPhase),.001),detail=1.-smoothstep(.7,3.,footprint);
float groove=.5+.5*cos(twistPhase);diffuseColor.rgb*=1.-.045*detail*groove*(1.-uPlain)*uKnit;
`;
export const yarnFragmentHead=`
varying vec3 vYarnT;varying vec3 vClothN;uniform float uFilterScale;uniform float uPitch,uWeftPitch;uniform vec3 uDye,uWeftDye;
${nativeHash}
${noise.glsl}
${cotton.surfaceGLSL}
`;
export const yarnNormalFragment=`
if(uKnit<.5){
 float variation;normal=fiberSurface(normal,normalize(vYarnT),vec2(vSolidCoord.x,vSolidCoord.y*.18),vSolidCoord.z,variation);diffuseColor.rgb*=clamp(variation,.55,1.4);
 // Integrate the unresolved 3:1 twill colours in the actual pixel footprint.
 // The closed warp and weft geometry remains; no texture or opaque backing plane.
 float mmPerPixel=1000.*max(length(dFdx(vViewPosition)),length(dFdy(vViewPosition)));
 float average=smoothstep(.35,1.25,mmPerPixel/max(.01,min(uPitch,uWeftPitch)));
 vec3 clothN=normalize(vClothN);bool outer=dot(clothN,normalize(vViewPosition))>=0.;
 vec3 meanColour=mix(uDye,uWeftDye,outer?.25:.75);meanColour=mix(meanColour,vec3(.52),uPlain);
 diffuseColor.rgb=mix(diffuseColor.rgb,meanColour,average);
 normal=normalize(mix(normal,outer?clothN:-clothN,average*.92));
}
`;
export const leatherShader=`
attribute float shellLayer,shellRim;attribute vec2 rimUV,chartUV;
uniform sampler2D uNativeHeight;uniform float uThickness,uDepth,uTile,uPlain;
varying vec3 vSolidColour;varying vec3 vSolidCoord;varying float vLeatherLayer;varying float vLeatherRim;
${bindingGLSL}
void solidVertex(out vec3 P,out vec3 NN){vec3 N,U,V;surfaceFrame(chartUV,P,N,U,V);
 vec4 encoded=texture2D(uNativeHeight,chartUV/uTile);float height=(encoded.r*65280.+encoded.g*255.)/65535.;
 float h=uThickness+(height-.5)*uDepth;P+=N*(.2+shellLayer*h)*.001;
 NN=shellLayer>.5?N:-N;if(shellRim>.5)NN=normalize(U*rimUV.x+V*rimUV.y);
 vSolidColour=mix(vec3(1.),vec3(.52),uPlain);vSolidCoord=vec3(chartUV,0.);vLeatherLayer=shellLayer;vLeatherRim=shellRim;
}
`;
export const leatherFragmentHead=`varying float vLeatherLayer;varying float vLeatherRim;uniform float uDepth,uTile,uPlain;`;
export const leatherNormalFragment=`
if(vLeatherLayer<.5||vLeatherRim>.5){roughnessFactor=.94;diffuseColor.rgb*=vec3(1.12,1.04,.92);}
`;
