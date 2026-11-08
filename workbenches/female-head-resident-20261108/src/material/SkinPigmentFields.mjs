// Authored functions informed by direct visual inspection of real face photos.
// Reference images stay offline: no photo pixels or copied spot layouts here.
export const SKIN_PIGMENT_GLSL=`
uint pgHash(uint x,float seed){x^=uint(seed)*2246822519u;x^=x>>16;x*=2246822519u;x^=x>>13;x*=3266489917u;return x^(x>>16);}
float pgRandom(ivec3 p,uint salt,float seed){return float(pgHash(uint(p.x)*1597334677u^uint(p.y)*3812015801u^uint(p.z)*2798796415u^salt,seed)>>8)*(1./16777216.);}
float pgNoise(vec3 p,uint salt,float seed){ivec3 c=ivec3(floor(p));vec3 t=fract(p);t=t*t*t*(t*(t*6.-15.)+10.);float a=mix(pgRandom(c,salt,seed),pgRandom(c+ivec3(1,0,0),salt,seed),t.x),b=mix(pgRandom(c+ivec3(0,1,0),salt,seed),pgRandom(c+ivec3(1,1,0),salt,seed),t.x),d=mix(pgRandom(c+ivec3(0,0,1),salt,seed),pgRandom(c+ivec3(1,0,1),salt,seed),t.x),e=mix(pgRandom(c+ivec3(0,1,1),salt,seed),pgRandom(c+ivec3(1,1,1),salt,seed),t.x);return mix(mix(a,b,t.y),mix(d,e,t.y),t.z);}
float pgPigmentPlane(vec2 p,float foot,int plane,float seed,bool broad,float sizeScale){
 float cell=broad?15.:3.0;ivec2 c=ivec2(floor(p/cell));float value=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  ivec3 q=ivec3(c+ivec2(x,y),plane);float h=pgRandom(q,131u,seed),cluster=pgNoise(vec3(vec2(q.xy)*.19,float(plane)),137u,seed);
  float probability=broad?.12:mix(.12,.65,cluster);if(h>probability)continue;
  vec2 centre=(vec2(q.xy)+vec2(pgRandom(q,139u,seed),pgRandom(q,149u,seed)))*cell;
  float size=pgRandom(q,151u,seed),radius=(broad?mix(.7,2.0,size):mix(.14,.70,pow(size,2.7)))*sizeScale;
  float rotation=6.2831853*pgRandom(q,157u,seed),cs=cos(rotation),sn=sin(rotation);vec2 d=mat2(cs,sn,-sn,cs)*(p-centre);d.y/=mix(.73,1.35,pgRandom(q,163u,seed));
  float r2=radius*radius,filter2=foot*foot/6.,effective=sqrt(r2+filter2),angle=atan(d.y+1e-7,d.x+2e-7);
  float phase=6.2831853*pgRandom(q,167u,seed),outline=1.+.15*sin(3.*angle+phase)+.09*sin(5.*angle+phase*1.7)+.04*sin(9.*angle-phase*2.3);
  float r=length(d)/(effective*outline),edge=1.-smoothstep(.64,1.04,r);
  float internal=.73+.15*sin(d.x/max(radius,.01)*4.3+phase)*sin(d.y/max(radius,.01)*5.1-phase);
  float strength=(broad?.11:mix(.09,.62,pow(pgRandom(q,173u,seed),2.5)));
  value+=edge*internal*strength*r2/(r2+filter2);
 }
 return value;
}
`;
