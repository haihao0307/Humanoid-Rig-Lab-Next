// Original KAOPU LeatherKernel field from R10; R12-S1A declares equivalence.
// No Adobe assets. Evaluated on real shell vertices, not a painted carrier.
export const leatherFieldGLSL = `
uniform float uSeed,uCells,uKind,uIrregular,uWrinkles,uPores,uDamage;
float h(vec2 p){vec3 a=fract(vec3(p.xyx)*.1031+uSeed*.037);a+=dot(a,a.yzx+33.33);return fract((a.x+a.y)*a.z);}
vec2 hash2(vec2 p){return vec2(h(p),h(p+vec2(19.7,41.3)));}
float n(vec2 p,vec2 period){vec2 i=floor(p),f=fract(p),w=f*f*(3.-2.*f);return mix(mix(h(mod(i,period)),h(mod(i+vec2(1,0),period)),w.x),mix(h(mod(i+vec2(0,1),period)),h(mod(i+1.,period)),w.x),w.y);}
float n(vec2 p,float period){return n(p,vec2(period));}
float fb(vec2 uv){return n(uv*4.,4.)*.53+n(uv*8.,8.)*.26+n(uv*16.,16.)*.14+n(uv*32.,32.)*.07;}
vec3 cells(vec2 p,float period){vec2 id=floor(p),f=fract(p);float a=8.,b=8.,v=0.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y)),rnd=hash2(mod(id+g,period)),d=g+.06+.88*rnd-f;float q=dot(d,d);if(q<a){b=a;a=q;v=rnd.x;}else if(q<b)b=q;}return vec3(sqrt(a),sqrt(b)-sqrt(a),v);}
vec4 leatherField(vec2 uv){float broad=fb(uv),m=n(uv*512.,512.);vec2 warp=vec2(n(uv*8.,8.),n(uv*8.+13.7,8.))-.5;
vec2 p=uv*uCells+warp*(1.+uIrregular*2.);p+=(vec2(n(p*2.,uCells*2.),n(p*2.+5.7,uCells*2.))-.5)*(.25+uIrregular*.65);
vec3 g=cells(p,uCells),fine=cells(p*4.,uCells*4.),wr=cells(uv*12.+warp*.6,12.);
float width=.18+.18*n(uv*32.,32.);float grain=smoothstep(.012,width,g.y);float islands=mix(grain,.5+.45*n(p*1.5,uCells*1.5),.22*uIrregular);
float pores=(1.-smoothstep(.018,.115,fine.x))*uPores;
float wrinkles=exp(-wr.y*wr.y*150.)*(.22+.78*n(uv*16.,16.))*uWrinkles;
float striation=pow(1.-abs(n(uv*vec2(192.,32.),vec2(192.,32.))-.5)*2.,18.);
float damage=uDamage*(.6*exp(-wr.y*wr.y*1500.)*smoothstep(.45,.65,broad)+.22*striation*smoothstep(.55,.75,n(uv*8.,8.)));
float height=.40+.24*islands+.085*n(p*3.,uCells*3.)+.04*m-.09*pores-.14*wrinkles-.21*damage;
if(uKind>.5&&uKind<1.5)height=.32+.40*pow(grain,.6)+.035*m-.09*pores-.12*wrinkles-.2*damage;
if(uKind>1.5&&uKind<2.5){height=.45+.18*m+.07*n(uv*1024.,1024.)-.06*wrinkles;grain=.7;pores=0.;}
if(uKind>2.5&&uKind<3.5){vec2 q=uv*uCells;float a=abs(sin(6.2831853*(q.x+q.y))),b=abs(sin(6.2831853*(q.x-q.y)));float rib=max(pow(a,9.),pow(b,9.));height=.34+.34*rib+.028*m-.05*wrinkles-.2*damage;grain=.3+.65*rib;}
if(uKind>3.5&&uKind<4.5){vec2 q=uv*uCells;float row=floor(q.y);q.x+=.22*h(vec2(mod(row,uCells),3.));q+=warp*.12;vec2 f=fract(q),edge=min(f,1.-f);float rib=smoothstep(.023,.14,min(edge.x,edge.y));height=.23+.50*rib+.05*n(p*5.,uCells*5.)-.05*wrinkles-.12*damage;grain=rib;}
if(uKind>4.5&&uKind<5.5){float bulge=exp(-g.x*g.x*30.)-.42*exp(-g.x*g.x*330.);height=.46+.36*bulge+.08*n(p*8.,uCells*8.)+.025*m-.10*wrinkles;grain=.6+.4*bulge;}
if(uKind>5.5){height=.42+.19*n(uv*vec2(1024.,256.),vec2(1024.,256.))+.12*m-.075*wrinkles;grain=.7;pores=0.;}
return vec4(clamp(height,.02,.98),clamp(grain,0.,1.),clamp(pores+damage+wrinkles*.3,0.,1.),broad);
}`;
