uniform vec3 uCam;uniform float uWash,uAbrasion,uBackstain,uFuzz,uExposure;
uniform int uBlack,uLight,uAA,uBake,uAudit,uDamage,uShadowPass;
uniform float uFilterScale,uNearWeight;
uniform sampler2D uShadowMap;uniform mat4 uLightVP;uniform float uShadowTexel;
uniform vec3 uKeyPos,uKeyColor,uFillColor;
float sat(float x){return clamp(x,0.,1.);}
vec3 tone(vec3 x){x=max(x*uExposure,vec3(0));x=(x*(2.51*x+.03))/(x*(2.43*x+.59)+.14);return pow(clamp(x,0.,1.),vec3(1./2.2));}
float hash2(vec2 x){return fract(sin(dot(x,vec2(127.1,311.7)))*43758.5453);}
float n2(vec2 x){vec2 a=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(hash2(a),hash2(a+vec2(1,0)),f.x),mix(hash2(a+vec2(0,1)),hash2(a+1.),f.x),f.y);}
float finishField(vec2 p){return .48*n2(p*vec2(.036,.027)+11.)+.30*n2(p*vec2(.097,.073)+31.)+.22*n2(p*vec2(.22,.15)+81.);}
float visibility(vec3 W,float radius){
 vec4 q=uLightVP*vec4(W,1.);vec3 v=q.xyz/q.w*.5+.5;
 if(v.x<.002||v.x>.998||v.y<.002||v.y>.998||v.z>1.)return 1.;
 float sum=0.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  float d=texture(uShadowMap,v.xy+vec2(x,y)*uShadowTexel*radius).r;
  sum+=smoothstep(v.z-.0012,v.z-.00045,d);
 }return sum/9.;
}
vec3 yarnColor(vec2 m,float kind,float id,float crown){
 vec3 blue=vec3(.019,.041,.071),core=vec3(.115,.110,.098);
 if(uBlack==1)blue=vec3(.010,.011,.013);
 if(uBlack==2)blue=core;
 float n=finishField(m),along=noise1(m.y*.041+id*.173);
 float scuff=uDamage>0?exp(-pow((m.x-4.)/26.,2.)-pow((m.y+1.)/13.,2.))*(.06+.17*n):0.;
 float fade=uWash*(.08+.30*n)+uAbrasion*(.03+.12*n*n)*crown+scuff*crown;
 if(uBlack==5)fade+=uWash*.65*smoothstep(.47,.64,n);
 vec3 warp=mix(blue*(1.+1.5*uWash),core,clamp(fade*.64,0.,.76));
 // Yarn-scale dye and slub fields are correlated along the thread, not per-pixel white noise.
 warp*=.84+.25*along+.16*noise1(id*.321+29.);
 warp*=.94+.12*noise1(m.y*.38+id*7.17);
 if(uBlack==2)warp=core*(.85+.25*n);
 vec3 weft=mix(core,vec3(.072,.103,.14),uBackstain*.9);
 weft*=.82+.22*noise1(m.x*.16+id*3.91);
 if(uBlack==3)weft=vec3(.012,.015,.020)*(1.+uWash*1.7);
 if(uBlack==4)weft=vec3(.012,.025,.055)*(1.+uWash*1.8);
 return mix(warp,weft,kind);
}
// Band-limited fiber lanes on actual yarn surfaces. This is normal/color detail,
// never a replacement cloth carrier. Unresolved lanes integrate to a mean response.
vec3 fiberSurface(vec3 N,vec3 T,vec2 q,float seed,out float variation){
 float bundle=q.y*4.8-q.x*.32;
 float bfp=max(abs(dFdx(bundle)),abs(dFdy(bundle)));
 float bw=1.-smoothstep(.5,1.4,bfp);
 float broad=n2(vec2(bundle,q.x*.38)+seed);
 N=normalize(N+normalize(cross(T,N))*(broad-.5)*.55*bw);
 float lane=q.y*34.-q.x*1.6;
 float footprint=max(abs(dFdx(lane)),abs(dFdy(lane)));
 float resolve=uAA==1?1.-smoothstep(.24,1.1,footprint):1.;
 float a=floor(lane),f=fract(lane),w=.32+.28*hash(a+seed);
 float groove=exp(-pow((f-.5)/w,2.));
 float segment=noise1(q.x*3.+a*13.7+seed);
 float ridge=(groove-.55)*(0.65+.5*segment);
 vec3 B=normalize(cross(T,N));
 N=normalize(N+B*ridge*.24*resolve);
 variation=(1.+bw*(broad-.5)*.25)*(1.+resolve*((segment-.5)*.15+ridge*.08));
 return N;
}
vec3 cottonLight(vec3 c,vec3 N,vec3 T,vec3 V,vec3 L,float fuzz){
 float nl=sat(dot(N,L)),nv=max(.015,sat(dot(N,V)));
 vec3 H=normalize(L+V);float nh=sat(dot(N,H));
 float transverse=sqrt(max(.001,1.-pow(dot(T,H),2.)));
 // Broad rough diffuse + fiber-direction sheen. Multiple-scattering term is
 // a bounded real-time approximation, not Animal Logic's Jensen dipole.
 float wrap=sat((dot(N,L)+.28)/1.28);
 float diffuse=nl*(.85+.15*(1.-nv))*.85;
 float roughness=.72, invR=1./roughness;
 float sinH=sqrt(max(.001,1.-nh*nh));
 float charlie=(2.+invR)*pow(sinH,invR)/6.2831853;
 float sheen=charlie/(4.*max(.04,nl+nv-nl*nv));
 vec3 fiberTint=mix(vec3(.32),sqrt(max(c,vec3(.001))),.65);
 vec3 scatter=pow(max(c,vec3(.001)),vec3(.82))*(.025+.042*fuzz)*wrap;
 vec3 spec=fiberTint*sheen*nl*(.025+.07*fuzz)*( .35+.65*transverse);
 return c*diffuse+scatter+spec;
}
vec3 lighting(vec3 c,vec3 N,vec3 T,vec3 W,float fuzz){
 vec3 V=normalize(uCam-W);float vis=visibility(W,1.15);
 vec3 light=vec3(0);float wide=uLight==1?18.:46.;
 // Four positions integrate a rectangular softbox. The cached shadow map is
 // PCF-softened at its center, not an exact area-light visibility integral.
 for(int i=0;i<4;i++){
  vec3 P=uKeyPos+vec3((i%2==0?-1.:1.)*wide,(i<2?-1.:1.)*wide*.7,0.);
  vec3 L=normalize(P-W);light+=cottonLight(c,N,T,V,L,fuzz)*uKeyColor*.25*(.48+.52*vis);
 }
 vec3 F=normalize(vec3(110,22,120)-W);
 light+=cottonLight(c,N,T,V,F,fuzz)*uFillColor;
 vec3 R=normalize(vec3(40,95,-110)-W);
 light+=cottonLight(c,N,T,V,R,fuzz)*vec3(.38,.43,.51);
 return light+c*(.105+.04*sat(N.y));
}
