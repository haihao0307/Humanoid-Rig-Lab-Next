// Secondary mesoscopic crease network. Analytic Voronoi bisectors are an
// authored auxiliary model, not the optimized pore graph of Weiss et al.
function hash(x,y,seed){let a=(Math.imul(x,1597334677)^Math.imul(y,3812015801)^seed)>>>0;a=Math.imul(a^(a>>>13),1274126177)>>>0;return(a^(a>>>16))>>>0;}
function site(x,y,seed){const h=hash(x,y,seed);return[x+.2+.6*(h&65535)/65535,y+.2+.6*(h>>>16)/65535];}
function bell(p,c,e){const x=(p[0]-c[0])/e[0],y=(p[1]-c[1])/e[1],t=1-x*x-y*y;if(t<=0)return[0,0,0];return[t*t*t,-6*t*t*x/e[0],-6*t*t*y/e[1]];}
function add(...a){return a.reduce((r,v)=>r.map((x,i)=>x+v[i]),[0,0,0]);}
function scaled(a,s){return a.map(x=>x*s);}
function cap(a){const e=Math.exp(-a[0]);return[1-e,a[1]*e,a[2]*e];}
function network(p,footprint,angle,sx,sy,seed,width,depth){const c=Math.cos(angle),s=Math.sin(angle),u=(p[0]*c+p[1]*s)/sx,v=(-p[0]*s+p[1]*c)/sy,ix=Math.floor(u),iy=Math.floor(v);let near=null,minimum=Infinity;
 for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const a=site(ix+x,iy+y,seed),dx=a[0]-u,dy=a[1]-v,d=dx*dx+dy*dy;if(d<minimum){minimum=d;near=[a[0],a[1],ix+x,iy+y];}}
 let distance=Infinity,gx=0,gy=0,other=null,tangent=null;
 for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++){const a=site(near[2]+x,near[3]+y,seed),dx=a[0]-near[0],dy=a[1]-near[1],len=Math.hypot(dx,dy);if(len<1e-8)continue;const nx=dx/len,ny=dy/len,ax=c*nx/sx-s*ny/sy,ay=s*nx/sx+c*ny/sy,metric=Math.hypot(ax,ay),d=(((near[0]+a[0])*.5-u)*nx+((near[1]+a[1])*.5-v)*ny)/metric;if(d<distance){distance=d;gx=-ax/metric;gy=-ay/metric;other=[...a,near[2]+x,near[3]+y];tangent=[-ny,nx];}}
 const edge=(hash(near[2],near[3],(seed+371)>>>0)^hash(other[2],other[3],(seed+371)>>>0))>>>0,random=(edge&65535)/65535;if(random<.48)return[0,0,0];
 const mx=(near[0]+other[0])*.5,my=(near[1]+other[1])*.5;let lo=-1e9,hi=1e9;
 for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++){const a=site(near[2]+x,near[3]+y,seed),dx=a[0]-near[0],dy=a[1]-near[1],div=tangent[0]*dx+tangent[1]*dy;if(Math.abs(div)<1e-7)continue;const bound=(((near[0]+a[0])*.5-mx)*dx+((near[1]+a[1])*.5-my)*dy)/div;if(div>0)hi=Math.min(hi,bound);else lo=Math.max(lo,bound);}
 const along=(u-mx)*tangent[0]+(v-my)*tangent[1],t1=Math.max(0,Math.min(1,(along-lo)/.23)),t2=Math.max(0,Math.min(1,(hi-along)/.23)),f1=t1*t1*(3-2*t1),f2=t2*t2*(3-2*t2),fade=f1*f2,df=6*t1*(1-t1)/.23*f2-f1*6*t2*(1-t2)/.23;if(fade<=0)return[0,0,0];
 const wo=width*(.65+.8*random),w=Math.sqrt(wo*wo+.16*footprint*footprint),q=Math.max(0,distance)/w;if(q>=1)return[0,0,0];const compact=1-q*q,amplitude=depth*wo/w*(.18+.65*(edge>>>16)/65535)*(.3+.7*Math.abs(tangent[0]))*.55,h=-amplitude*compact*compact*compact,dh=amplitude*6*q*compact*compact/w,dsx=c*tangent[0]/sx-s*tangent[1]/sy,dsy=s*tangent[0]/sx+c*tangent[1]/sy;return[h*fade,dh*gx*fade+h*df*dsx,dh*gy*fade+h*df*dsy];
}
export function sampleWrinkleMicro(p,footprint,variables){if(!variables.micro||!variables.strength)return[0,0,0];
 const r=variables.regions,a=cap(add(scaled(bell(p,[0,338],[53,27]),r.forehead),scaled(bell(p,[0,318],[16,20]),r.glabella),scaled(bell(p,[-32,290],[25,17]),r.infraorbital),scaled(bell(p,[32,290],[25,17]),r.infraorbital),scaled(bell(p,[-49,299],[14,12]),r.canthus),scaled(bell(p,[49,299],[14,12]),r.canthus),scaled(bell(p,[0,210],[30,16]),r.chin),scaled(bell(p,[0,307],[10,8]),r.root))),b=cap(scaled(add(bell(p,[-40,267],[24,30]),bell(p,[40,267],[24,30])),r.cheek)),c=cap(scaled(add(bell(p,[0,246],[26,12]),bell(p,[0,219],[25,10])),r.perioral)),out=[0,0,0],gain=variables.micro*variables.strength*(.65*variables.rest+.35*variables.compression);
 for(const [mask,angle,sx,sy,seed,width,depth]of[[a,0,1.5,.7,variables.seed>>>0,.075,.022],[b,p[0]<0?-.52:.52,.85,1.7,(variables.seed+101)>>>0,.065,.018],[c,0,.65,1.45,(variables.seed+213)>>>0,.075,.024]]){if(mask[0]<=0)continue;const n=network(p,footprint,angle,sx,sy,seed,width,depth);out[0]+=n[0]*mask[0]*gain;out[1]+=(n[1]*mask[0]+n[0]*mask[1])*gain;out[2]+=(n[2]*mask[0]+n[0]*mask[2])*gain;}
 return out;
}
export const FACE_WRINKLE_MICRO_GLSL=`
uniform float u_fwMicro;uniform int u_fwMicroSeed;uniform vec4 u_fwRegions0,u_fwRegions1;
uint fwCellHash(ivec2 p,uint seed){uint a=uint(p.x)*1597334677u^uint(p.y)*3812015801u^seed;a=(a^(a>>13u))*1274126177u;return a^(a>>16u);}
vec2 fwSite(ivec2 p,uint seed){uint h=fwCellHash(p,seed);return vec2(p)+.2+.6*vec2(float(h&65535u),float(h>>16u))/65535.;}
vec3 fwBell(vec2 p,vec2 c,vec2 e){vec2 q=(p-c)/e;float t=1.-dot(q,q);return t>0.?vec3(t*t*t,-6.*t*t*q/e):vec3(0.);}
vec3 fwCap(vec3 v){float e=exp(-v.x);return vec3(1.-e,v.yz*e);}
vec3 fwNetwork(vec2 p,float footprint,float angle,vec2 scale,uint seed,float width,float depth){float c=cos(angle),s=sin(angle);vec2 q=vec2(dot(p,vec2(c,s)),dot(p,vec2(-s,c)))/scale;ivec2 cell=ivec2(floor(q)),owner=cell,otherID=cell;vec2 closest=vec2(0.),other=vec2(0.),tangent=vec2(0.);float best=1e20;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){ivec2 id=cell+ivec2(x,y);vec2 r=fwSite(id,seed);float d=dot(r-q,r-q);if(d<best){best=d;closest=r;owner=id;}}
 float distance=1e20;vec2 gradient=vec2(0.);for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){ivec2 id=owner+ivec2(x,y);vec2 r=fwSite(id,seed),delta=r-closest;float len=length(delta);if(len<1e-8)continue;vec2 n=delta/len,axis=vec2(c*n.x/scale.x-s*n.y/scale.y,s*n.x/scale.x+c*n.y/scale.y);float metric=length(axis),d=dot((closest+r)*.5-q,n)/metric;if(d<distance){distance=d;gradient=-axis/metric;other=r;otherID=id;tangent=vec2(-n.y,n.x);}}
 uint edge=fwCellHash(owner,seed+371u)^fwCellHash(otherID,seed+371u);float random=float(edge&65535u)/65535.;if(random<.48)return vec3(0.);vec2 midpoint=(closest+other)*.5;float lo=-1e9,hi=1e9;
 for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){vec2 r=fwSite(owner+ivec2(x,y),seed),delta=r-closest;float div=dot(tangent,delta);if(abs(div)<1e-7)continue;float bound=dot((closest+r)*.5-midpoint,delta)/div;if(div>0.)hi=min(hi,bound);else lo=max(lo,bound);}
 float along=dot(q-midpoint,tangent),t1=clamp((along-lo)/.23,0.,1.),t2=clamp((hi-along)/.23,0.,1.),f1=t1*t1*(3.-2.*t1),f2=t2*t2*(3.-2.*t2),fade=f1*f2,df=6.*t1*(1.-t1)/.23*f2-f1*6.*t2*(1.-t2)/.23;if(fade<=0.)return vec3(0.);
 float wo=width*(.65+.8*random),w=sqrt(wo*wo+.16*footprint*footprint),z=max(0.,distance)/w;if(z>=1.)return vec3(0.);float compact=1.-z*z,amp=depth*wo/w*(.18+.65*float(edge>>16u)/65535.)*(.3+.7*abs(tangent.x))*.55,h=-amp*compact*compact*compact,dh=amp*6.*z*compact*compact/w;vec2 ds=vec2(c*tangent.x/scale.x-s*tangent.y/scale.y,s*tangent.x/scale.x+c*tangent.y/scale.y);return vec3(h*fade,gradient*dh*fade+h*df*ds);
}
vec3 fwMicro(vec2 p,float footprint){if(u_fwMicro<=0.)return vec3(0.);vec3 a=fwCap(fwBell(p,vec2(0.,338.),vec2(53.,27.))*u_fwRegions0.x+fwBell(p,vec2(0.,318.),vec2(16.,20.))*u_fwRegions0.y+(fwBell(p,vec2(-32.,290.),vec2(25.,17.))+fwBell(p,vec2(32.,290.),vec2(25.,17.)))*u_fwRegions0.w+(fwBell(p,vec2(-49.,299.),vec2(14.,12.))+fwBell(p,vec2(49.,299.),vec2(14.,12.)))*u_fwRegions0.z+fwBell(p,vec2(0.,210.),vec2(30.,16.))*u_fwRegions1.z+fwBell(p,vec2(0.,307.),vec2(10.,8.))*u_fwRegions1.w),b=fwCap((fwBell(p,vec2(-40.,267.),vec2(24.,30.))+fwBell(p,vec2(40.,267.),vec2(24.,30.)))*u_fwRegions1.y),c=fwCap((fwBell(p,vec2(0.,246.),vec2(26.,12.))+fwBell(p,vec2(0.,219.),vec2(25.,10.)))*u_fwRegions1.x),r=vec3(0.);uint seed=uint(u_fwMicroSeed);
 if(a.x>0.){vec3 n=fwNetwork(p,footprint,0.,vec2(1.5,.7),seed,.075,.022);r+=vec3(n.x*a.x,n.yz*a.x+n.x*a.yz);}
 if(b.x>0.){vec3 n=fwNetwork(p,footprint,p.x<0.?-.52:.52,vec2(.85,1.7),seed+101u,.065,.018);r+=vec3(n.x*b.x,n.yz*b.x+n.x*b.yz);}
 if(c.x>0.){vec3 n=fwNetwork(p,footprint,0.,vec2(.65,1.45),seed+213u,.075,.024);r+=vec3(n.x*c.x,n.yz*c.x+n.x*c.yz);}return r*u_fwMicro;
}
`;
