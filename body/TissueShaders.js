// WebGL2 numeric palettes are generated buffers, not authored texture assets.
const TISSUE_VERTEX_SHADER=`#version 300 es
precision highp float;
layout(location=0)in vec3 position;
layout(location=1)in vec3 normal;
layout(location=2)in float transformIndex;
layout(location=3)in vec3 baseColor;
layout(location=4)in float accessibility;
layout(location=5)in float materialKind;
layout(location=6)in vec4 skinJoints;
layout(location=7)in vec4 skinWeights;
layout(location=8)in vec2 tissueIds;
layout(location=9)in vec4 tissueData;
layout(location=10)in vec4 structureAnchor;
layout(location=11)in vec4 structureData;
layout(location=12)in vec3 surfaceRest;
uniform sampler2D posePalette,jointPalette,musclePalette;
uniform mat4 viewProjection,lightVP;
uniform float depthPass,anatomyTime;
out vec3 P,N,C,R;
out vec4 L;
out float AO,MK,activation;
vec3 qrotate(vec4 q,vec3 v){return v+2.*cross(q.xyz,cross(q.xyz,v)+q.w*v);}
vec3 bezier(vec3 a,vec3 v,vec3 b,float t){return mix(mix(a,v,t),mix(v,b,t),t);}
vec4 muscle(int x,int id){return texelFetch(musclePalette,ivec2(x,id),0);}
${SHOULDER_SKIN_BLEND_GLSL}
${SHOULDER_LAYER_GLSL}
void skinTransform(inout vec3 p,inout vec3 n){
  if(structureData.w<-.5)return; // Already skinned and smoothed on the welded exterior.
  vec3 restP=p,restN=n;
  vec4 reference=texelFetch(jointPalette,ivec2(0,int(skinJoints.x+.5)),0);
  vec4 qr=vec4(0.),qd=vec4(0.);
  for(int k=0;k<4;k++){
    int id=int(skinJoints[k]+.5);
    vec4 r=texelFetch(jointPalette,ivec2(0,id),0),d=texelFetch(jointPalette,ivec2(1,id),0);
    float w=skinWeights[k]*(dot(reference,r)<0.?-1.:1.);
    qr+=w*r;qd+=w*d;
  }
  float m=max(length(qr),.00001);qr/=m;qd/=m;qd-=qr*dot(qr,qd);
  vec3 t=2.*(qr.w*qd.xyz-qd.w*qr.xyz+cross(qr.xyz,qd.xyz));
  p=qrotate(qr,p)+t;n=qrotate(qr,n);
  shoulderSkinBlend(p,n,restP,restN);
}
void main(){
  int id=int(transformIndex+.5);
  vec4 flags=texelFetch(posePalette,ivec2(4,id),0);
  mat4 model=mat4(texelFetch(posePalette,ivec2(0,id),0),texelFetch(posePalette,ivec2(1,id),0),texelFetch(posePalette,ivec2(2,id),0),texelFetch(posePalette,ivec2(3,id),0));
  vec3 p=position,n=normal;R=structureData.w<-.5?surfaceRest:position;activation=0.;MK=materialKind;
  if((materialKind>.5&&materialKind<3.5)||materialKind>6.5){
    if(materialKind>1.5&&materialKind<2.5){
      int mid=int(tissueIds.x+.5);
      vec4 a=muscle(0,mid),v=muscle(1,mid),b=muscle(2,mid);
      float t=clamp(position.z,0.,1.),power=muscle(3,mid).w;
      float st=max(.0001,sin(3.14159265*t));
      float belly=.10+.90*pow(st,power);
      float radius=a.w*b.w*belly;
      vec3 tangent=normalize(2.*mix(v.xyz-a.xyz,b.xyz-v.xyz,t));
      vec3 reference=muscle(5,mid).xyz;
      vec3 transverse=reference-tangent*dot(reference,tangent);
      if(length(transverse)<.001)transverse=cross(tangent,abs(tangent.z)<.85?vec3(0.,0.,1.):vec3(1.,0.,0.));
      vec3 x=normalize(transverse),y=normalize(cross(tangent,x));
      vec3 radial=x*position.x+y*position.y*v.w;
      p=bezier(a.xyz,v.xyz,b.xyz,t)+radial*radius;
      float slope=a.w*b.w*.90*power*pow(st,power-1.)*cos(3.14159265*t)*3.14159265/max(length(b.xyz-a.xyz),.015);
      n=normalize(x*position.x+y*position.y/v.w-tangent*slope);
      if(length(position.xy)<.001)n=tangent*(t>.5?1.:-1.);
      activation=muscle(4,mid).w;
    }else if(materialKind>8.5&&materialKind<9.5){
      skinTransform(p,n);
    }else if(materialKind>7.5){
      int mid=int(tissueIds.x+.5);
      float t=tissueData.z,st=max(.0001,sin(3.14159265*t));
      float relaxed=.22+.78*pow(st,.65);
      float contracted=.22+.78*pow(st,.65*muscle(3,mid).w);
      float delta=tissueData.y*(muscle(2,mid).w*contracted-relaxed);
      p+=n*clamp(delta,-.004,.006);
      skinTransform(p,n);activation=muscle(4,mid).w;
      R=vec3(tissueData.w,0.,t);
    }else if(structureData.w<-.5){
      // The CPU generates exterior and layer boundaries together.
    }else{
      float displacement=0.;vec3 gradient=vec3(0.);
      for(int k=0;k<2;k++){
        int mid=int(tissueIds[k]+.5);float weight=tissueData[k],t=tissueData[k+2];
        vec4 a=muscle(0,mid),b=muscle(2,mid),restA=muscle(3,mid),restB=muscle(4,mid);
        float st=max(.0001,sin(3.14159265*t));
        float relaxed=.10+.90*st,contracted=.10+.90*pow(st,restA.w);
        float delta=a.w*(b.w*contracted-relaxed);
        float fatFilter=.42;
        displacement+=delta*weight*fatFilter;
        vec3 axis=restB.xyz-restA.xyz;
        float deriv=a.w*.90*(b.w*restA.w*pow(st,restA.w-1.)-1.)*cos(3.14159265*t)*3.14159265;
        gradient+=axis/max(dot(axis,axis),.0001)*deriv*weight*fatFilter;
        activation+=restB.w*weight;
      }
      // Submillimetre to millimetre respiration, fixed in material coordinates.
      float chest=exp(-pow(abs(position.y-1.31)/.15,2.))*exp(-pow(abs(position.x)/.18,4.));
      // CPU exterior and its inset layers share one posed surface. Extra
      // shader-only breathing would move only the outer boundary across them.
      float breath=structureData.w<-.5?0.:sin(anatomyTime*1.45)*.0016*chest;
      float limited=clamp(displacement,-.002,.003);
      gradient*=min(1.,.12/max(length(gradient),.00001));
      if(abs(displacement)>.00001)gradient*=min(1.,abs(limited/displacement));
      displacement=limited;
      if(materialKind>2.5&&materialKind<3.5)displacement-=.0016;
      p+=n*displacement;p.z+=breath;
      n=normalize(n-gradient+n*dot(n,gradient));
      n.y+=breath*2.*(position.y-1.31)/(.15*.15);
      n=normalize(n);skinTransform(p,n);
      constrainShoulderLayer(p,n);
    }
  }else{p=(model*vec4(position,1.)).xyz;n=mat3(model)*normal;}
  P=p;N=n;C=baseColor;AO=accessibility;L=lightVP*vec4(p,1.);
  gl_Position=viewProjection*vec4(p,1.);
  if(flags.x<.5||(depthPass>.5&&flags.y<.5))gl_Position=vec4(2.,2.,2.,1.);
}`;

const TISSUE_FRAGMENT_SHADER=`#version 300 es
precision highp float;
in vec3 P,N,C,R;in vec4 L;in float AO,MK,activation;
uniform vec3 eye;uniform sampler2D shadow;uniform float shadowsEnabled,studioMode;
out vec4 frag;
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
  float bias=.00006+min(.0012,subtexel);
  // Camp shadows cover 38 metres: one texel spans several curved skin faces.
  // Keep their tiny depth differences from drawing false transverse seams.
  if(MK>.5&&MK<1.5)bias=max(bias,.0008);
  ivec2 size=textureSize(shadow,0),base=ivec2(floor(q.xy*vec2(size)));
  float s=0.,sumWeight=0.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
    ivec2 sampleCell=clamp(base+ivec2(x,y),ivec2(0),size-ivec2(1));
    // NEAREST depth samples live at texel centres. Correcting the requested UV
    // instead produces a half-texel slope error and moving diagonal acne.
    vec2 sampleUV=(vec2(sampleCell)+.5)*texel,offset=sampleUV-q.xy;
    vec2 tent=max(vec2(0.),vec2(1.5)-abs(offset)/texel);
    float d=texelFetch(shadow,sampleCell,0).r,weight=tent.x*tent.y;
    float receiver=q.z+dot(gradient,offset)-bias;
    s+=weight*(receiver>d?.36:1.);sumWeight+=weight;
  }return s/max(sumWeight,.0001);
}
float skinNoise(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 vec4 h=vec4(dot(i,vec3(127.1,311.7,74.7)))+vec4(0.,127.1,311.7,438.8);
 vec4 a=fract(sin(h)*43758.5453),b=fract(sin(h+74.7)*43758.5453);
 vec4 z=mix(a,b,f.z);return mix(mix(z.x,z.y,f.x),mix(z.z,z.w,f.x),f.y)*2.-1.;
}
void main(){
  vec3 n=normalize(N);if(!gl_FrontFacing)n=-n;
  // Blending rotations alone does not differentiate the spatial weight field.
  // Fine final triangles provide the missing deformation-normal contribution.
  vec3 geometric=cross(dFdx(P),dFdy(P));
  if(length(geometric)>1e-12){geometric=normalize(geometric);if(dot(geometric,n)<0.)geometric=-geometric;
    if((MK>.5&&MK<1.5)||(MK>2.5&&MK<3.5)||MK>6.5){float alignment=clamp(dot(n,geometric),0.,1.);float correction=((MK>.5&&MK<1.5)||(MK>6.5&&MK<7.5))?0.:.12+.50*smoothstep(.01,.20,1.-alignment);n=normalize(mix(n,geometric,correction));}}
  vec3 v=normalize(eye-P),l=normalize(vec3(-4.,8.,5.));
  vec3 viewRight=normalize(cross(vec3(0.,1.,0.),v));
  if(studioMode>.5)l=normalize(v+viewRight*-.70+vec3(0.,.65,0.));
  vec3 h=normalize(l+v);
  vec3 color=C;float rough=.62,specular=.055,wrap=0.,skinStretch=1.;
  if(MK>.5&&MK<1.5){
    // Area change makes microrelief relax under stretch and gather under
    // compression. This is analytic shading, not a physical tissue solver.
    float restArea=length(cross(dFdx(R),dFdy(R)));
    skinStretch=clamp(length(cross(dFdx(P),dFdy(P)))/max(restArea,1e-12),.55,1.8);
    // Analytic material-space colour variation and pores. No UV image sampling.
    float variation=skinNoise(R*18.);
    float poreAttenuation=(1.-smoothstep(.0006,.0025,length(fwidth(R))))/sqrt(skinStretch);
    float pore=skinNoise(R*1050.);
    color*=1.+.018*variation+.006*pore*poreAttenuation;
    color+=vec3(.006,-.001,-.002)*variation;
    color+=vec3(.022,-.004,-.004)*activation;
    rough=clamp(.52+.035*variation-.035*(skinStretch-1.),.46,.62);specular=.055;wrap=.30;
    // Derivatives use rest coordinates, so the microdetail follows the skin.
    vec3 dx=dFdx(P),dy=dFdy(P),rx=cross(dy,n),ry=cross(n,dx);
    float determinant=dot(dx,rx);
    vec3 grad=sign(determinant)*(dFdx(pore)*rx+dFdy(pore)*ry)/max(abs(determinant),1e-8);
    n=normalize(n-grad*.000004*poreAttenuation);
  }else if(MK>8.5&&MK<9.5){rough=.48;specular=.09;wrap=.06;
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
  float diffuse=max((dot(n,l)+wrap)/(1.+wrap),0.),fill=max(dot(n,normalize(vec3(.85,.32,-.8))),0.);
  if(studioMode>.5)fill=max(dot(n,normalize(v+viewRight*.9+vec3(0.,-.05,0.))),0.);
  float s=shade(n,l),nv=max(dot(n,v),0.);
  vec3 c=color*((.28+.10*n.y)*AO+.82*diffuse*s+.26*fill*AO);
  float exponent=mix(120.,16.,rough);
  if(MK>.5&&MK<1.5){
    // Two dielectric lobes: a broad epidermal response and a restrained
    // oily highlight. Warm wrapped light approximates shallow scattering.
    float nh=max(dot(n,h),0.),vh=max(dot(v,h),0.);
    float fresnel=.028+.972*pow(1.-vh,5.);
    float broad=pow(nh,mix(44.,14.,rough)),tight=pow(nh,110.);
    c+=vec3(1.,.96,.92)*(broad*.85+tight*.40)*fresnel*s;
    float scatter=pow(clamp((dot(-n,l)+.45)/1.45,0.,1.),2.);
    c+=color*vec3(.24,.075,.035)*scatter*(.35+.65*s);
  }else c+=vec3(1.,.90,.78)*pow(max(dot(n,h),0.),exponent)*specular*s;
  c+=vec3(.37,.55,.63)*pow(1.-nv,3.)*.045;
  c=mix(c,vec3(.06,.078,.088),1.-exp(-length(eye-P)*.009));
  c=c/(vec3(1.)+c*.25);
  frag=vec4(pow(max(c,vec3(0.)),vec3(1./2.2)),1.);
}`;
