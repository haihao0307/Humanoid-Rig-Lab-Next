from pathlib import Path
r=Path(__file__).resolve().parents[1]
extra=r'''
/* MP04.2 interior garment contact, not just vertex-versus-surface distances. */
__attribute__((export_name("pair_surface"))) int pair_surface(double*p,double*w,int*faces,int nf,double*edges,int ne,double*P,double*W,double*N,int*F,double*B,int*O,int*cache,double gap,int refresh,int oneWay){
 int count=0;double q[7];
 for(int mode=0;mode<2;mode++)for(int i=0;i<(mode?nf:ne);i++){
  int ids[3],m=mode?3:2;if(mode){ids[0]=faces[i*3];ids[1]=faces[i*3+1];ids[2]=faces[i*3+2];}else{ids[0]=(int)edges[i*4];ids[1]=(int)edges[i*4+1];}
  double x=0,y=0,z=0,wa=0;for(int k=0;k<m;k++){x+=p[ids[k]*3]/m;y+=p[ids[k]*3+1]/m;z+=p[ids[k]*3+2]/m;wa+=w[ids[k]]/m/m;}
  if(!wa||x<B[4]-.04||x>B[7]+.04||y<B[5]-.04||y>B[8]+.04||z<B[6]-.04||z>B[9]+.04)continue;
  int ci=(mode?ne:0)+i,f=cache[ci];if(refresh||f<0)f=cache[ci]=nearest(P,F,B,O,x,y,z,.045,f,q);else closest(P,F,f,x,y,z,q);
  if(f<0||q[0]>.045*.045)continue;
  int a=F[f]*3,b=F[f+1]*3,c=F[f+2]*3;double ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,L=len3(nx,ny,nz);if(L<1e-12)continue;
  nx/=L;ny/=L;nz/=L;double d=(x-q[1])*nx+(y-q[2])*ny+(z-q[3])*nz;if(d>=gap||d<-.035||q[0]-d*d>gap*gap)continue;
  double ws=wa;if(!oneWay)for(int k=0;k<3;k++)ws+=sq(q[k+4])*W[F[f+k]];
  double dl=mn(.012,gap-d)/ws;for(int k=0;k<m;k++){double t=w[ids[k]]*dl/m;p[ids[k]*3]+=nx*t;p[ids[k]*3+1]+=ny*t;p[ids[k]*3+2]+=nz*t;}
  if(!oneWay)for(int k=0;k<3;k++){int id=F[f+k];double t=dl*q[k+4]*W[id];P[id*3]-=nx*t;P[id*3+1]-=ny*t;P[id*3+2]-=nz*t;}count++;
 }
 return count;
}
'''
p=r/'cloth-kernel.c';s=p.read_text().split('/* MP04.2 interior garment contact')[0];p.write_text(s+'\n'+extra)
p=r/'wasm-cloth.mjs';s=p.read_text()
if 'pairInteriorCache' not in s:
 s=s.replace('this.actorPrevious=world.actor?.positions.slice();','this.pairInteriorCache=allocate(Int32Array,new Int32Array(world.solvers[0].edges.length+world.solvers[0].faces.length/3).fill(-1));this.actorPrevious=world.actor?.positions.slice();')
 at=s.index(' step(dt=');s=s[:at]+''' pairDense(){const [a,b]=this.solvers,m=this.bottom;return this.e.pair_surface(a.p.ptr,a.w.ptr,a.faces.ptr,a.s.faces.length/3,a.edges.ptr,a.s.edges.length,b.p.ptr,b.w.ptr,m.normal.ptr,m.faces.ptr,m.nodes.ptr,m.order.ptr,this.pairInteriorCache.ptr,this.world.contactGap,1,1);}
'''+s[at:]
 s=s.replace('w.pairContacts+=this.pair(it===11,it>=10);','w.pairContacts+=this.pair(it===11,it>=10);if(it>=10)w.pairContacts+=this.pairDense();')
 s=s.replace('w.pairContacts+=this.pair(true,true);','w.pairContacts+=this.pair(true,true);for(let j=0;j<3;j++){w.pairContacts+=this.pairDense();w.pairContacts+=this.pair(false,true);}')
p.write_text(s)
p=r/'coupled-cloth.mjs';s=p.read_text()
if 'pairEdgeSamples' not in s:
 s=s.replace('if(dense){for(let f=0;f<a.faces.length;f+=3)', '''if(dense){/* pairEdgeSamples */for(const e of a.edges){const p=a.p,pt=[0,1,2].map(k=>(p[e.a*3+k]+p[e.b*3+k])*.5),face=this.bottomSurface.nearest(...pt,.025);if(face<0)continue;this.bottomSurface.evaluate(face,...pt,q);if(this.bottomSurface.tmp[4]>.001&&this.bottomSurface.tmp[5]>.001&&this.bottomSurface.tmp[6]>.001){minPair=Math.min(minPair,q[0]);pairSamples++;}}for(let f=0;f<a.faces.length;f+=3)''')
p.write_text(s)
p=r/'motion-cache.mjs';s=p.read_text().replace("version:'MP04.1'","version:'MP04.2'")
s=s.replace('physics:settings});}','physics:settings},(_,v)=>typeof v===\'number\'?Math.round(v*1e9)/1e9:v);}')
s=s.replace('a.pairMinimumSampleMM<-.1','a.pairMinimumSampleMM<world.contactGap*1000-.1')
p.write_text(s)
p=r/'material-geometry.mjs';s=p.read_text()
if "import {layerLayout}" not in s:s="import {layerLayout} from './material-settings.mjs';\n"+s
s=s.replace('(ty+1)*tile+2*pitch,.09)', '(ty+1)*tile+2*pitch,(layerLayout(info).thickness+2)*.001)')
p.write_text(s)
for name in ['app.mjs','index.html']:
 p=r/name;s=p.read_text().replace('MP04.1','MP04.2');p.write_text(s)
p=r/'solid-textiles.mjs';s=p.read_text().replace('appearanceImageMaps:0,opaqueBackingSheets:0','appearanceImageMaps:leather?5:0,externalAppearanceImages:0,opaqueBackingSheets:0');p.write_text(s)
print('MP04.2: surface-interior contact, thickness-aware acceptance, recipe-normalized cache and metric visibility bounds')
