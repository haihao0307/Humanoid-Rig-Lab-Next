// Packed reflection, local bundle diffusion and thin-fiber transmission.
// Empirical coefficients below are candidates; this is not calibrated cotton.
uniform float uScatter,uTransmit;uniform vec3 uDiffusionR,uDiffusionCenter;
float visibilityTap(vec3 W){vec4 q=uLightVP*vec4(W,1.);vec3 v=q.xyz/q.w*.5+.5;if(v.x<0.||v.x>1.||v.y<0.||v.y>1.)return 1.;return smoothstep(v.z-.0012,v.z-.00045,texture(uShadowMap,v.xy).r);}
vec3 safeUnit(vec3 v){return v*inversesqrt(max(dot(v,v),1e-10));}
float fiberPhase(float cosine){float g=.32;return (1.-g*g)/(12.5663706*pow(max(.03,1.+g*g-2.*g*cosine),1.5));}
vec3 fiberReflect(vec3 c,vec3 N,vec3 T,vec3 V,vec3 L){
 float nl=sat(dot(N,L)),nv=max(.02,sat(dot(N,V)));vec3 H=safeUnit(V+L);
 float nh=sat(dot(N,H)),sinH=sqrt(max(.0001,1.-nh*nh));
 float transverse=sqrt(max(.0001,1.-pow(dot(T,H),2.)));
 float D=2.0*pow(sinH,1.25)/3.14159265;
 float sheen=D/(4.*max(.05,nl+nv-nl*nv));
 // Broad surface reflection is separate from tinted body scattering.
 vec3 surface=vec3(.045)*sheen*nl*(.45+.55*transverse);
 float ls=nl/(max(.08,nl+nv));
 return c*(.58*nl+.08*ls)+surface;
}
vec3 fiberTransmission(vec3 c,vec3 N,vec3 T,vec3 V,vec3 L,float diameter){
 float axial=sqrt(max(.08,1.-pow(dot(T,L),2.)));
 // A finite optical path: thick yarn cores attenuate much more than fine ends.
 float path=diameter/axial;
 vec3 absorption=-log(clamp(c,vec3(.025),vec3(.95)))*1.25;
 vec3 tr=exp(-(absorption+vec3(5.))*path);
 float back=sat(-dot(N,L)),phase=fiberPhase(dot(-L,V));
 return tr*sqrt(max(c,vec3(.005)))*(.20*back+.48*phase)*uTransmit;
}
vec3 layeredLighting(vec3 c,vec3 N,vec3 T,vec3 W,float fuzz,float diameter){
 vec3 V=safeUnit(uCam-W);N=safeUnit(N);T=safeUnit(T);float vis=visibility(W,1.15);
 vec3 L=safeUnit(uKeyPos-W);
 // Broad cloth lobes integrate the soft key approximately at its centroid.
 vec3 light=(fiberReflect(c,N,T,V,L)+fiberTransmission(c,N,T,V,L,diameter))*uKeyColor*(.64+.36*vis);
 vec3 E=uKeyColor*sat((dot(N,L)+.22)/1.22);
 vec3 F=safeUnit(vec3(110,22,120)-W),R=safeUnit(vec3(40,95,-110)-W);
 light+=(fiberReflect(c,N,T,V,F)+fiberTransmission(c,N,T,V,F,diameter))*uFillColor;
 vec3 rim=uLight==4?vec3(3.2,3.35,3.55):vec3(.50,.55,.65);
 light+=(fiberReflect(c,N,T,V,R)+fiberTransmission(c,N,T,V,R,diameter))*rim;
 // A finite, local quadrature of the dipole profile along the yarn direction.
 // No screen blur: holes, cloth edges and the gray backdrop are never filled.
 float nearVis=vis;
 if(uScatter>.001&&uShadowPass==0)nearVis=.5*(visibilityTap(W+T*.22)+visibilityTap(W-T*.22));
 vec3 spreadVis=uDiffusionCenter*vis+(vec3(1)-uDiffusionCenter)*nearVis;
 vec3 indirect=E*(.65+.35*spreadVis)+uFillColor*.22+rim*sat(-dot(N,R))*.16;
 light+=c*uDiffusionR*indirect*uScatter*.56;
 return light+c*(.12+.035*sat(N.y));
}
vec3 lighting(vec3 c,vec3 N,vec3 T,vec3 W,float fuzz){return layeredLighting(c,N,T,W,fuzz,uParam.y*2.);}
