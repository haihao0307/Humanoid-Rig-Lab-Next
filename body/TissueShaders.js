// Rigid world geometry. Reconstructed skin uses COMPACT_VERTEX exclusively.
const TISSUE_VERTEX_SHADER=`#version 300 es
precision highp float;
layout(location=0)in vec3 position;layout(location=1)in vec3 normal;
layout(location=2)in float boneId;layout(location=3)in vec3 color;
layout(location=4)in float occlusion;layout(location=5)in float materialKind;
uniform sampler2D posePalette;uniform mat4 viewProjection,lightVP;uniform float depthPass;
out vec3 P,N,C,R;out vec4 L;out float AO,MK,activation;
void main(){int id=int(boneId+.5);mat4 m=mat4(texelFetch(posePalette,ivec2(0,id),0),texelFetch(posePalette,ivec2(1,id),0),texelFetch(posePalette,ivec2(2,id),0),texelFetch(posePalette,ivec2(3,id),0));
vec4 flags=texelFetch(posePalette,ivec2(4,id),0);P=(m*vec4(position,1.)).xyz;N=mat3(m)*normal;C=color;R=position;AO=occlusion;MK=materialKind;activation=0.;L=lightVP*vec4(P,1.);gl_Position=viewProjection*vec4(P,1.);if(flags.x<.5||(depthPass>.5&&flags.y<.5))gl_Position=vec4(2.,2.,2.,1.);}
`;
const TISSUE_FRAGMENT_SHADER=`#version 300 es
precision highp float;
in vec3 P,N,C,R;in vec4 L;in float AO,MK,activation;
uniform vec3 eye;uniform sampler2D shadow;uniform float shadowsEnabled,studioMode,inspectionShadow;uniform vec3 studioKey,studioFill;
// Only the compact body renderer enables these per-character material values.
uniform float skinControlled;uniform vec3 skinSurface,skinDetail,skinSeedOffset;
uniform vec2 skinExposure;
uniform float skinTransportEnabled;uniform vec3 skinViewForward;
layout(location=0)out vec4 frag;
layout(location=1)out vec4 skinDiffuseOut;
layout(location=2)out vec4 skinResidualOut;
${compactSkinSurfaceShader()}
vec3 skinOutputSRGB(vec3 linearColor){
  vec3 c=max(linearColor,vec3(0.));
  return mix(12.92*c,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));
}
float skinGGX(vec3 n,vec3 v,vec3 l,vec3 h,float roughness){
  float nl=max(dot(n,l),0.),nv=max(dot(n,v),0.),nh=max(dot(n,h),0.),vh=max(dot(v,h),0.);
  float a=roughness*roughness,a2=a*a,denominator=nh*nh*(a2-1.)+1.;
  float distribution=a2/(3.14159265*denominator*denominator);
  float k=(roughness+1.)*(roughness+1.)/8.;
  float geometryV=nv/(nv*(1.-k)+k),geometryL=nl/(nl*(1.-k)+k);
  // Neutral dielectric reflection: pigment does not tint the oily highlight.
  float fresnel=.028+.972*pow(1.-vh,5.);
  return distribution*geometryV*geometryL*fresnel*nl/max(4.*nv*nl,.0001);
}
vec3 skinDiffuseResponse(vec3 fineNormal,vec3 shapeNormal,vec3 light,float scatter){
  // Local wavelength-dependent normal filtering, not a diffusion solve.
  // Smoothing every colour channel to the shape normal erased all relief
  // outside the specular highlight, even with the scatter control disabled.
  vec3 retention=mix(vec3(1.),vec3(.10,.28,.46),sqrt(clamp(scatter,0.,1.)));
  vec3 ndl=vec3(dot(normalize(mix(shapeNormal,fineNormal,retention.r)),light),
    dot(normalize(mix(shapeNormal,fineNormal,retention.g)),light),
    dot(normalize(mix(shapeNormal,fineNormal,retention.b)),light));
  vec3 angularSpread=scatter*vec3(.42,.18,.08);
  return max((ndl+angularSpread)/(vec3(1.)+angularSpread),vec3(0.));
}
float skinFaceWeight(vec3 p){
  // Canonical-space support keeps the face treatment attached during posing.
  // The body and the back of the head retain their existing material response.
  return step(.5,skinControlled)*smoothstep(1.40,1.435,p.y)*(1.-smoothstep(1.63,1.67,p.y))
    *smoothstep(.075,.12,p.z)*(1.-smoothstep(.065,.09,abs(p.x)));
}
float shade(vec3 normal,vec3 light){
  if(shadowsEnabled<.5)return 1.;
  vec3 q=L.xyz/L.w*.5+.5;
  vec3 dx=dFdx(q),dy=dFdy(q);
  float determinant=dx.x*dy.y-dx.y*dy.x;
  vec2 gradient=vec2(0.);
  // Compare Jacobian conditioning, not absolute pixel area: a fixed cutoff
  // switches shadow correction across the abdomen as camera scale changes.
  float area=length(dx.xy)*length(dy.xy);
  if(abs(determinant)>max(1e-24,area*1e-6))gradient=vec2(dx.z*dy.y-dy.z*dx.y,dx.x*dy.z-dy.x*dx.z)/determinant;
  gradient*=min(1.,4./max(length(gradient),.00001));
  if(q.x<0.||q.x>1.||q.y<0.||q.y>1.||q.z<0.||q.z>1.)return 1.;
  vec2 texel=1./vec2(textureSize(shadow,0));
  float subtexel=.5*dot(abs(gradient),texel);
  float bias=inspectionShadow>.5?.000012+min(.00008,subtexel):.00006+min(.0012,subtexel);
  // Camp shadows cover 38 metres: one texel spans several curved skin faces.
  // Keep their tiny depth differences from drawing false transverse seams.
  if(MK>.5&&MK<1.5)bias=max(bias,inspectionShadow>.5?.000025:.0008);
  ivec2 size=textureSize(shadow,0),base=ivec2(floor(q.xy*vec2(size)));
  // A wider tent on the face removes quantised PCF transitions at portrait
  // scale. The receiver-plane correction remains active for every sample.
  bool faceShadow=MK>.5&&MK<1.5&&skinFaceWeight(R)>.05;
  float radius=faceShadow?2.5:1.5;
  float s=0.,sumWeight=0.;for(int x=-2;x<=2;x++)for(int y=-2;y<=2;y++){
    if(!faceShadow&&(abs(x)>1||abs(y)>1))continue;
    ivec2 sampleCell=clamp(base+ivec2(x,y),ivec2(0),size-ivec2(1));
    // NEAREST depth samples live at texel centres. Correcting the requested UV
    // instead produces a half-texel slope error and moving diagonal acne.
    vec2 sampleUV=(vec2(sampleCell)+.5)*texel,offset=sampleUV-q.xy;
    vec2 tent=max(vec2(0.),vec2(radius)-abs(offset)/texel);
    float d=texelFetch(shadow,sampleCell,0).r,weight=tent.x*tent.y;
    float receiver=q.z+dot(gradient,offset)-bias;
    s+=weight*(receiver>d?.36:1.);sumWeight+=weight;
  }return s/max(sumWeight,.0001);
}
float skinNoise(vec3 p){
 // Orthonormal domain rotation hides axis-aligned lattice rows on cheeks.
 p=mat3(2.,1.,-2.,-2.,2.,-1.,1.,2.,2.)*(p/3.);
 vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 vec4 h=vec4(dot(i,vec3(127.1,311.7,74.7)))+vec4(0.,127.1,311.7,438.8);
 vec4 a=fract(sin(h)*43758.5453),b=fract(sin(h+74.7)*43758.5453);
 vec4 z=mix(a,b,f.z);return mix(mix(z.x,z.y,f.x),mix(z.z,z.w,f.x),f.y)*2.-1.;
}
float skinRegion(vec3 p,vec3 centre,vec3 inverseRadius){
 vec3 q=(p-centre)*inverseRadius;
 return 1.-smoothstep(.15,1.,dot(q,q));
}
float skinBodyExposure(vec3 p,float variation,float footprint,vec3 seedOffset){
 // Accumulated clothing history in the canonical body, not current garments.
 // Reuse the existing low-frequency field; no extra noise or image sampling.
 float ax=abs(p.x),softness=max(.012,min(.04,footprint*1.5));
 float hemShift=(fract(dot(seedOffset,vec3(.113,.173,.197)))-.5)*.018;
 float edgeShift=hemShift+.008*variation;
 float front=smoothstep(.025,.095,p.z);
 float collarHeight=1.345-.09*front*(1.-smoothstep(.025,.105,ax));
 float collar=smoothstep(collarHeight-softness,collarHeight+softness,p.y+edgeShift)*(1.-smoothstep(.13,.19,ax));
 float shoulders=skinRegion(vec3(ax,p.yz),vec3(.153,1.33,.03),vec3(13.,14.,9.));
 float torso=smoothstep(.86,.98,p.y)*(1.-smoothstep(1.34,1.43,p.y))*(1.-smoothstep(.13,.205,ax));
 float fadedTorso=torso*(.18+.18*smoothstep(1.,1.31,p.y))*(1.+.18*variation);
 float arm=smoothstep(.135,.185,ax)*smoothstep(.58,.68,p.y)*(1.-smoothstep(1.30,1.40,p.y));
 float sleeve=1.-smoothstep(1.175-softness,1.175+softness,p.y+edgeShift);
 float armTan=arm*mix(.22,.80,sleeve);
 float leg=(1.-smoothstep(.17,.205,ax))*(1.-smoothstep(.78,.86,p.y));
 float shorts=1.-smoothstep(.665-softness,.665+softness,p.y+edgeShift+.12*ax);
 float aboveSock=smoothstep(.135-softness,.165+softness,p.y+hemShift);
 float legTan=leg*(.10+.62*shorts*aboveSock);
 // Old tanning leaves a light torso wash, with stronger collar, sleeve and
 // trouser/footwear transitions. max avoids double-dark overlap patches.
 return clamp(max(max(fadedTorso,.78*collar),max(.58*shoulders,max(armTan,legTan))),0.,1.);
}
void main(){
  skinDiffuseOut=vec4(0.);skinResidualOut=vec4(0.);
  vec3 n=normalize(N);if(!gl_FrontFacing)n=-n;
  // Blending rotations alone does not differentiate the spatial weight field.
  // Fine final triangles provide the missing deformation-normal contribution.
  vec3 geometric=cross(dFdx(P),dFdy(P));
  if(length(geometric)>1e-12){geometric=normalize(geometric);if(dot(geometric,n)<0.)geometric=-geometric;
    if((MK>.5&&MK<1.5)||(MK>2.5&&MK<3.5)||MK>6.5){float alignment=clamp(dot(n,geometric),0.,1.);float correction=((MK>.5&&MK<1.5)||(MK>6.5&&MK<7.5))?0.:.12+.50*smoothstep(.01,.20,1.-alignment);n=normalize(mix(n,geometric,correction));}}
  vec3 v=normalize(eye-P),l=normalize(vec3(-4.,8.,5.));
  vec3 viewRight=normalize(cross(vec3(0.,1.,0.),v));
  if(studioMode>.5)l=normalize(studioKey);
  vec3 h=normalize(l+v);
  // Microscopic surface normals govern reflection. Subsurface diffuse light
  // averages that relief, so it must not inherit every pore's dark gradient.
  vec3 skinDiffuseNormal=n;
  float faceWeight=skinFaceWeight(R);
  float screenScatter=skinTransportEnabled*faceWeight;
  vec3 color=C;float rough=.62,specular=.055,wrap=0.,skinStretch=1.,skinOil=0.,skinCavity=1.;
  vec3 surface=skinControlled>.5?skinSurface:vec3(.52,.25,.30);
  vec3 detail=skinControlled>.5?skinDetail:vec3(.30,.35,.15);
  if(MK>.5&&MK<1.5){
    // Area change makes microrelief relax under stretch and gather under
    // compression. This is analytic shading, not a physical tissue solver.
    float restArea=length(cross(dFdx(R),dFdy(R)));
    skinStretch=clamp(length(cross(dFdx(P),dFdy(P)))/max(restArea,1e-12),.55,1.8);
    // Soft masks use the fixed R2 source anatomy in metres, before deformation.
    // Future reference bodies must supply matching landmarks. No image maps.
    vec3 symmetricRest=vec3(abs(R.x),R.yz);
    float forehead=skinRegion(R,vec3(0.,1.558,.137),vec3(14.7,22.2,22.2));
    float nose=skinRegion(R,vec3(0.,1.492,.185),vec3(40.,20.,25.6));
    float cheek=skinRegion(symmetricRest,vec3(.046,1.486,.139),vec3(25.,21.7,22.2));
    float ear=skinRegion(symmetricRest,vec3(.083,1.508,.087),vec3(40.,19.2,21.3));
    float controlled=step(.5,skinControlled),tZone=max(.65*forehead,nose)*controlled;
    cheek*=controlled;ear*=controlled;
    // The skin recipe owns pigment, microrelief and oil separately. These are
    // material coordinates in source metres, independent of the camera/pose.
    vec3 seedOffset=skinControlled>.5?skinSeedOffset:vec3(0.);
    float footprint=max(length(dFdx(R)),length(dFdy(R)));
    float variation=skinNoise(R*18.+seedOffset)*(1.-smoothstep(.02,.08,footprint));
    vec3 restNormal=cross(dFdx(R),dFdy(R));
    restNormal=length(restNormal)>1e-12?normalize(restNormal):vec3(0.,0.,1.);
    CompactSkinSurface skinSample=compactSkinEvaluate(R,restNormal,footprint,seedOffset,surface,detail,skinStretch);
    // Face and body share one exposure history. Boundaries follow the source
    // skin through posing and scaling; they do not swim with camera or light.
    float headExposure=smoothstep(1.35,1.46,R.y)*(.80+.20*max(forehead,nose));
    float forearmExposure=smoothstep(.175,.24,abs(R.x))*smoothstep(.56,.68,R.y)*(1.-smoothstep(1.02,1.13,R.y));
    float bodyExposure=skinBodyExposure(R,variation,footprint,seedOffset);
    float sunMask=controlled*max(headExposure,max(.82*forearmExposure,bodyExposure));
    float outdoorRoughness=skinExposure.y*sunMask;
    color*=skinSample.pigment;
    color*=vec3(1.)-sunMask*skinExposure.x*vec3(.55,.66,.74);
    color*=1.-.035*outdoorRoughness*smoothstep(-.25,.55,variation);
    color=clamp(color,vec3(0.),vec3(1.));
    skinOil=skinSample.oil*(1.-.30*outdoorRoughness);
    rough=clamp(skinSample.roughness+.11*outdoorRoughness,.30,.85);
    specular=.028;wrap=.40*surface.z;
    skinCavity=skinSample.cavity;
    // The recipe already applies the microdetail control and stretch once.
    float reliefHeight=skinSample.heightM*(1.+.35*outdoorRoughness);
    vec3 dx=dFdx(P),dy=dFdy(P),rx=cross(dy,n),ry=cross(n,dx);
    float determinant=dot(dx,rx);
    float areaScale=max(length(dx)*length(dy),1e-16);
    vec3 grad=sign(determinant)*(dFdx(reliefHeight)*rx+dFdy(reliefHeight)*ry)/max(abs(determinant),areaScale*.05);
    grad*=min(1.,.25/max(length(grad),.0001));
    n=normalize(n-grad);
  }else if(MK>8.5){rough=.48;specular=.09;wrap=.06;
  }else if((MK>1.5&&MK<2.5)||MK>7.5){
    float across=MK>7.5?R.x*240.:atan(R.y,R.x)*48.;
    float phase=across+sin(R.z*20.)*.4;
    float fibers=.5+.5*sin(phase)*(1.-smoothstep(1.,3.14,fwidth(phase)));
    color*=.85+.18*fibers;color=mix(color,color*vec3(1.18,.80,.75),activation);
    rough=.4;specular=.13;wrap=.17;
    float tendon=MK>7.5?(1.-smoothstep(.018,.075,1.-R.z))*.35:1.-smoothstep(.06,.22,min(R.z,1.-R.z));
    color=mix(color,vec3(.65,.53,.39),tendon*.85);
  }else if(MK>2.5&&MK<3.5){rough=.70;wrap=.22;specular=.07;}
  else if(MK>3.5&&MK<4.5){rough=.22;specular=.27;}
  else if(MK>6.5){rough=.78;specular=.035;wrap=.08;}
  else if(MK>4.5){
    float grid=max(1.-smoothstep(.0,.018,abs(fract(P.x)-.5)),1.-smoothstep(.0,.018,abs(fract(P.z)-.5)));
    color*=1.-.06*grid;rough=.82;
  }
  vec3 diffuseNormal=normalize(mix(n,skinDiffuseNormal,faceWeight));
  float diffuse=max((dot(diffuseNormal,l)+wrap)/(1.+wrap),0.),fill=max(dot(diffuseNormal,normalize(vec3(.85,.32,-.8))),0.);
  if(studioMode>.5)fill=max(dot(diffuseNormal,normalize(studioFill)),0.);
  float s=shade(n,l),nv=max(dot(n,v),0.);
  vec3 c=color*((.28+.10*n.y)*AO+.82*diffuse*s+.26*fill*AO);
  float exponent=mix(120.,16.,rough);vec3 skinDiffuseLinear=vec3(0.);
  if(MK>.5&&MK<1.5){
    // The bounded screen-space solve owns eligible facial diffuse light.
    // Other regions retain the local response, including the lips excluded by
    // the compact renderer. Avoid changing body light when the camera zooms.
    float localScatter=surface.z*(1.-screenScatter);
    vec3 faceDiffuse=skinDiffuseResponse(n,skinDiffuseNormal,l,localScatter);
    vec3 diffuseFillDirection=studioMode>.5?normalize(studioFill):normalize(vec3(.85,.32,-.8));
    vec3 faceFill=skinDiffuseResponse(n,skinDiffuseNormal,diffuseFillDirection,localScatter);
    float faceAmbient=.235+.105*diffuseNormal.y;
    vec3 faceLit=color*(faceAmbient*AO+vec3(.87,.865,.86)*faceDiffuse*s+.22*faceFill*AO);
    c=mix(c,faceLit,faceWeight);
    // GGX surface lobes share the same F0 across every base colour.
    float broad=skinGGX(n,v,l,h,rough),tight=skinGGX(n,v,l,h,max(.28,rough*.75));
    // Diffuse above uses irradiance/pi. The GGX BRDF therefore needs the same
    // pi conversion; the previous lone .82 factor suppressed skin reflection.
    vec3 fillDirection=studioMode>.5?normalize(studioFill):normalize(vec3(.85,.32,-.8));
    vec3 fillHalf=normalize(fillDirection+v);
    float fillBroad=skinGGX(n,v,fillDirection,fillHalf,rough);
    float fillTight=skinGGX(n,v,fillDirection,fillHalf,max(.28,rough*.75));
    c*=.972;
    skinDiffuseLinear=c;
    c+=vec3(3.14159265*(.87*mix(broad,tight,skinOil*.45)*s
      +.22*mix(fillBroad,fillTight,skinOil*.45)*AO))*skinCavity;
    // Local wrapped-light approximation only. No thickness or diffusion solve.
    // Both the warm response and diffuse light follow the existing shadow.
    float scatter=pow(clamp((dot(-n,l)+.45)/1.45,0.,1.),2.);
    c+=color*vec3(.24,.075,.035)*scatter*surface.z*s*(1.-screenScatter);
  }else c+=vec3(1.,.90,.78)*pow(max(dot(n,h),0.),exponent)*specular*s;
  if(!(MK>.5&&MK<1.5))c+=vec3(.37,.55,.63)*pow(1.-nv,3.)*.045;
  c=mix(c,vec3(.06,.078,.088),1.-exp(-length(eye-P)*.009));
  skinDiffuseLinear*=exp(-length(eye-P)*.009);
  float transportMask=screenScatter*float(MK>.5&&MK<1.5)*clamp(surface.z*1.65,0.,1.);
  skinDiffuseOut=vec4(skinDiffuseLinear*transportMask,transportMask);
  skinResidualOut=vec4((c-skinDiffuseLinear)*transportMask,max(.015,dot(P-eye,skinViewForward))*transportMask);
  c=c/(vec3(1.)+c*.25);
  frag=vec4(pow(max(c,vec3(0.)),vec3(1./2.2)),1.);
}`;
