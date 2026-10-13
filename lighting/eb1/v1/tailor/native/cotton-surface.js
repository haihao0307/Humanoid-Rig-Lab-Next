/* R08: compact finite-staple surface model. Millimeter-scale art candidates.
 * Not CT fitted, not an implementation of an author's proprietary renderer.
 * Shape and its angular derivative are shared by CPU roots and GPU envelopes. */
(function initializeCotton(root){'use strict';
const TAU=2*Math.PI;
function packing(theta,arc,seed,amount=.78){
 const old=.060*Math.cos(theta*3+arc*1.3+seed)+.025*Math.cos(theta*7-arc*.8+seed*.33);
 const phase=.38*Math.sin(arc*1.11+seed*.47);
 const cotton=.020*Math.cos(theta*2+arc*.57+seed)+.012*Math.cos(theta*5-arc*.43+seed*.33)+.008*Math.cos(theta*11-arc*2.1+phase+seed);
 return 1+old*(1-amount)+cotton*amount;
}
const shapeGLSL=`
uniform float uCotton,uStaple,uNap;
vec2 cottonPacking(float theta,float arc,float seed){
 float a=theta*3.+arc*1.3+seed,b=theta*7.-arc*.8+seed*.33;
 float c=theta*2.+arc*.57+seed,d=theta*5.-arc*.43+seed*.33;
 float e=theta*11.-arc*2.1+.38*sin(arc*1.11+seed*.47)+seed;
 return vec2(1.+mix(.060*cos(a)+.025*cos(b),.020*cos(c)+.012*cos(d)+.008*cos(e),uCotton),
 mix(-.180*sin(a)-.175*sin(b),-.040*sin(c)-.060*sin(d)-.088*sin(e),uCotton));
}
`;
const surfaceGLSL=`
uniform float uCotton,uStaple,uNap;
// Width follows projected surface derivatives, not a camera-distance threshold.
// Angular identity is wrapped before hashing; no discontinuity at +/-pi.
vec3 cottonSignal(float arc,float theta,float seed){
 const float lanes=64.,tau=6.28318530718;
 float twist=.66+.32*hash(seed+51.);
 float angle=theta-arc*twist-.13*sin(arc*.71+seed);
 float q=angle*lanes/tau;
 float footprint=length(vec2(dFdx(q),dFdy(q)))*uFilterScale;
 float resolved=1.-smoothstep(.7,2.8,footprint);
 // The continuous mean is used only when individual transverse fibers are unresolved.
 if(resolved<.0001)return vec3(0.,0.,0.);
 float base=floor(q),height=0.,slope=0.,pigment=0.;
 for(int k=-2;k<=2;k++){
  float lane=base+float(k),id=mod(lane,lanes),s=seed*137.+id*19.;
  float phase=hash(s+23.),z=arc/(.65+1.35*hash(s+8.))+phase;
  float cell=floor(z),u=fract(z);
  // Neighboring finite staples overlap; birth/death tapers are C1 continuous.
  float e0=smoothstep(0.,.24,u)*(1.-smoothstep(.68,1.,u));
  float e1=smoothstep(0.,.24,fract(z+.5))*(1.-smoothstep(.68,1.,fract(z+.5)));
  float env=e0*(.35+.65*hash(s+cell*73.+3.))+e1*(.28+.54*hash(s+floor(z+.5)*73.+29.));
  float drift=.20*sin(arc*(.9+.6*hash(s+1.))+hash(s+7.)*tau);
  float dx=q-(lane+.5+(hash(s+4.)-.5)*.40+drift);
  float sigma=.19+.095*hash(s+9.);
  // Gaussian convolution, with amplitude reduced to preserve the transverse integral.
  float width=sqrt(sigma*sigma+.12*footprint*footprint);
  float g=exp(-.5*dx*dx/(width*width))*sigma/width;
  float p0=hash(s+cell*73.+43.)*2.-1.,p1=hash(s+floor(z+.5)*73.+61.)*2.-1.;
  height+=g*env;
  slope+=(-dx/(width*width))*g*env;
  pigment+=g*(e0*(.35+.65*hash(s+cell*73.+3.))*p0+e1*(.28+.54*hash(s+floor(z+.5)*73.+29.))*p1);
 }
 return vec3(height-.48,slope*.12,pigment)*resolved;
}
vec3 fiberSurface(vec3 N,vec3 T,vec2 q,float seed,out float variation){
 float arc=q.x,theta=q.y/.18;
 vec3 sig=cottonSignal(arc,theta,seed);
 vec3 B=normalize(cross(T,N));
 // Eliminate coarse 7-lane cable bands. The raised fibers are small and finite.
 // A correlated aggregate for unresolved short fiber groups, not broad helical grooves.
 // Cylindrical sine/cosine coordinates keep the aggregate periodic at the UV seam.
 vec2 uv=vec2(arc*5.2+.21*sin(theta),sin(theta)*18.+cos(theta)*11.)+vec2(seed*3.17,seed*7.13);
 float footprint=length(vec2(dFdx(arc),dFdy(arc)))*uFilterScale;
 float aggregate=1.-smoothstep(.055,.17,footprint);
 float tufts=denimNoise2(uv+vec2(.21*denimNoise2(uv*.27),.32*denimNoise2(uv*.31+11.)))-.5;
 float broken=denimNoise2(vec2(arc*10.3,cos(theta)*31.+sin(theta)*23.)+seed*1.73)-.5;
 float grain=aggregate*(.75*tufts+.25*broken);
 N=normalize(N+B*(sig.y*(.30+.65*uStaple)+grain*.42*uCotton)+T*grain*.18*uCotton);
 variation=1.+uStaple*(.74*sig.x+.40*sig.z+1.30*grain);

 return N;
}
`;
root.KAOPUCottonSurface={version:'1.0',packing,shapeGLSL,surfaceGLSL,TAU};
root.KAOPUCottonSurface.workerModule='('+initializeCotton.toString()+')(globalThis);';if(typeof module!=='undefined')module.exports=root.KAOPUCottonSurface;
})(globalThis);
