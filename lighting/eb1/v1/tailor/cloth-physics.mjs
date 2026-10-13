/** MP03 compliant cloth. SI units; original paper metrics and declared seams.
 * XPBD: Macklin, Müller & Chentanez, MIG 2016, doi:10.1145/2994258.2994272.
 * Dihedral gradients are verified against central differences in test-physics.mjs.
 * Sampled body SDF is NOT continuous collision detection. Cloth is uncalibrated.
 */
export const GRAVITY=9.81;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class BodySDF {
 constructor(meta,delta,groundShift=0){
  this.meta=meta;this.shift=groundShift;this.n=meta.dimensions;this.o=meta.originMm;this.h=meta.spacingMm;this.q=meta.quantizationMm;
  if(delta.length!==meta.count)throw Error('BODY_SDF_SIZE');
  this.data=new Int16Array(delta.length);let prev=0;for(let i=0;i<delta.length;i++){prev=(prev+delta[i])<<16>>16;this.data[i]=prev;}
 }
 sample(x,y,z,out=new Float64Array(4)){
  const [nx,ny,nz]=this.n,h=this.h,o=this.o,gx=(x*1000-o[0])/h,gy=((y+this.shift)*1000-o[1])/h,gz=(z*1000-o[2])/h;
  if(gx<0||gy<0||gz<0||gx>=nx-1||gy>=ny-1||gz>=nz-1){out[0]=Infinity;out[1]=out[2]=out[3]=0;return out;}
  const ix=Math.floor(gx),iy=Math.floor(gy),iz=Math.floor(gz),fx=gx-ix,fy=gy-iy,fz=gz-iz,s=nx*ny,k=ix+nx*iy+s*iz,d=this.data;
  const a=d[k],b=d[k+1],c=d[k+nx],e=d[k+nx+1],f=d[k+s],g=d[k+s+1],j=d[k+s+nx],l=d[k+s+nx+1];
  const ab=a+(b-a)*fx,ce=c+(e-c)*fx,fg=f+(g-f)*fx,jl=j+(l-j)*fx,low=ab+(ce-ab)*fy,high=fg+(jl-fg)*fy;
  out[0]=(low+(high-low)*fz)*this.q*.001;
  out[1]=((b-a)*(1-fy)*(1-fz)+(e-c)*fy*(1-fz)+(g-f)*(1-fy)*fz+(l-j)*fy*fz)*this.q/h;
  out[2]=((ce-ab)*(1-fz)+(jl-fg)*fz)*this.q/h;out[3]=(high-low)*this.q/h;return out;
 }
}
export function dihedral(p,i0,i1,i2,i3,out=new Float64Array(13)){
 const a=3*i0,b=3*i1,c=3*i2,d=3*i3,ex=p[b]-p[a],ey=p[b+1]-p[a+1],ez=p[b+2]-p[a+2],ux=p[c]-p[a],uy=p[c+1]-p[a+1],uz=p[c+2]-p[a+2],vx=p[d]-p[a],vy=p[d+1]-p[a+1],vz=p[d+2]-p[a+2];
 const nx=ey*uz-ez*uy,ny=ez*ux-ex*uz,nz=ex*uy-ey*ux,mx=vy*ez-vz*ey,my=vz*ex-vx*ez,mz=vx*ey-vy*ex;
 const e2=ex*ex+ey*ey+ez*ez,n2=nx*nx+ny*ny+nz*nz,m2=mx*mx+my*my+mz*mz;
 if(Math.min(e2,n2,m2)<1e-18){out.fill(0);return out;}
 const len=Math.sqrt(e2),u=(ux*ex+uy*ey+uz*ez)/e2,v=(vx*ex+vy*ey+vz*ez)/e2;
 out[0]=Math.atan2((ex*(ny*mz-nz*my)+ey*(nz*mx-nx*mz)+ez*(nx*my-ny*mx))/len,nx*mx+ny*my+nz*mz);
 out[7]=-len*nx/n2;out[8]=-len*ny/n2;out[9]=-len*nz/n2;out[10]=-len*mx/m2;out[11]=-len*my/m2;out[12]=-len*mz/m2;
 for(let k=0;k<3;k++){out[4+k]=-u*out[7+k]-v*out[10+k];out[1+k]=-out[4+k]-out[7+k]-out[10+k];}return out;
}
export class ClothSolver {
 constructor(packet,positions,{family='knit',doubleLayer=true,role='top',sdf=null,clearanceMM=3.5,bend=1,softness=1,damping=7,gravity=1}={}){
  this.packet=packet;this.original=new Float64Array(positions);this.sdf=sdf;this.family=family;this.role=role;this.settings={clearanceMM,bend,softness,damping,gravity};this.time=0;this.steps=0;this.contacts=0;this.safetyTrips=0;
  const n=positions.length/3,parent=Int32Array.from({length:n},(_,i)=>i),offsets=new Map();let off=0;
  const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(const pan of packet.spec.panels){offsets.set(pan.id,off);off+=pan.uvMm.length;}
  const active=new Set(packet.record.activeSeams);this.seamPairs=[];
  for(const s of packet.spec.seams){if(!active.has(s.id))continue;const a=offsets.get(s.a.panelId),b=offsets.get(s.b.panelId);for(const [i,j]of s.stitchVertexPairs||[]){const ia=a+i,ib=b+j;parent[root(ib)]=root(ia);this.seamPairs.push([ia,ib]);}}
  const group=new Map();this.map=new Int32Array(n);for(let i=0;i<n;i++){const r=root(i);if(!group.has(r))group.set(r,group.size);this.map[i]=group.get(r);}
  this.count=group.size;this.p=new Float64Array(this.count*3);this.v=new Float64Array(this.p.length);this.old=new Float64Array(this.p.length);this.mass=new Float64Array(this.count);const counts=new Uint32Array(this.count);
  for(let i=0;i<n;i++){const g=this.map[i];counts[g]++;for(let k=0;k<3;k++)this.p[g*3+k]+=positions[i*3+k];}
  for(let i=0;i<this.count;i++)for(let k=0;k<3;k++)this.p[i*3+k]/=counts[i];
  this.faces=[];this.edges=[];this.bends=[];const bendEdges=new Map(),surfaceEdges=new Map();let density=family==='knit'?.32:family==='leather'?.65:.39;if(family==='knit'&&doubleLayer)density*=1.7;this.density=density;
  off=0;for(const pan of packet.spec.panels){const seen=new Set();for(const tri of pan.triangles){const q=tri.map(i=>this.map[off+i]);if(new Set(q).size<3)continue;this.faces.push(...q);const uv=tri.map(i=>pan.uvMm[i]),area=Math.abs((uv[1][0]-uv[0][0])*(uv[2][1]-uv[0][1])-(uv[2][0]-uv[0][0])*(uv[1][1]-uv[0][1]))*.5e-6;for(const i of q)this.mass[i]+=area*density/3;
    for(let j=0;j<3;j++){const aa=tri[j],bb=tri[(j+1)%3],a=q[j],b=q[(j+1)%3],c=q[(j+2)%3],key=a<b?a+','+b:b+','+a;if(!surfaceEdges.has(key))surfaceEdges.set(key,[a,b]);if(!seen.has(key)){seen.add(key);const u=pan.uvMm[aa],v=pan.uvMm[bb];this.edges.push({a,b,rest:Math.hypot(u[0]-v[0],u[1]-v[1])*.001,lambda:0});}
     const prior=bendEdges.get(key);if(prior){if(prior.c!==c)this.bends.push({a:prior.a,b:prior.b,c:prior.c,d:c,lambda:0,rest:0});}else bendEdges.set(key,{a,b,c});
    }
   }off+=pan.uvMm.length;}
  this.surfaceEdges=[...surfaceEdges.values()];this.faces=new Int32Array(this.faces);this.w=new Float64Array(this.count);for(let i=0;i<this.count;i++)this.w[i]=1/Math.max(1e-7,this.mass[i]);
  // Waist attachment, explicitly reported. No hidden all-body shape attraction.
  this.pins=[];if(role==='bottom'){let ymax=-Infinity;for(let i=1;i<this.p.length;i+=3)ymax=Math.max(ymax,this.p[i]);for(let i=0;i<this.count;i++)if(this.p[3*i+1]>ymax-.0035){this.w[i]=0;this.pins.push(i);}}
  this.initial=this.p.slice();this.scratch=new Float64Array(13);this.contactSample=new Float64Array(4);this.output=new Float32Array(positions.length);this.normals=new Float32Array(positions.length);this.groupNormals=new Float64Array(this.p.length);this.expand();
 }
 set(options){Object.assign(this.settings,options);}
 distance(c,h){const p=this.p,a=c.a*3,b=c.b*3,dx=p[a]-p[b],dy=p[a+1]-p[b+1],dz=p[a+2]-p[b+2],l=Math.hypot(dx,dy,dz);if(l<1e-12)return;const comp=(this.family==='knit'?.00035:this.family==='leather'?.00003:.00006)*this.settings.softness,alpha=comp/(h*h),w=this.w[c.a]+this.w[c.b],dl=(-(l-c.rest)-alpha*c.lambda)/(w+alpha);c.lambda+=dl;const f=dl/l;for(let k=0;k<3;k++){const d=k===0?dx:k===1?dy:dz;p[a+k]+=this.w[c.a]*d*f;p[b+k]-=this.w[c.b]*d*f;}}
 strainGuard(){const p=this.p,lo=this.family==='knit'?.82:.90,hi=this.family==='knit'?1.18:1.12;for(const e of this.edges){const a=e.a*3,b=e.b*3,dx=p[a]-p[b],dy=p[a+1]-p[b+1],dz=p[a+2]-p[b+2],l=Math.hypot(dx,dy,dz),target=clamp(l,e.rest*lo,e.rest*hi),w=this.w[e.a]+this.w[e.b];if(l<1e-12||!w||l===target)continue;const f=(target-l)/(l*w);for(let k=0;k<3;k++){const d=k===0?dx:k===1?dy:dz;p[a+k]+=this.w[e.a]*d*f;p[b+k]-=this.w[e.b]*d*f;}}}
 bending(c,h){const q=dihedral(this.p,c.a,c.b,c.c,c.d,this.scratch),ids=[c.a,c.b,c.c,c.d],alpha=(this.family==='leather'?2800:this.family==='denim'?6000:12000)/(Math.max(.05,this.settings.bend)*h*h);let den=alpha;for(let j=0;j<4;j++)for(let k=0;k<3;k++)den+=this.w[ids[j]]*q[1+j*3+k]**2;if(den<1e-10)return;const C=Math.atan2(Math.sin(q[0]-c.rest),Math.cos(q[0]-c.rest)),dl=(-C-alpha*c.lambda)/den;c.lambda+=dl;for(let j=0;j<4;j++)for(let k=0;k<3;k++)this.p[ids[j]*3+k]+=this.w[ids[j]]*q[1+j*3+k]*dl;}
 contact(ids,weights,margin){if(!this.sdf)return;const p=this.p;let x=0,y=0,z=0,den=0;for(let j=0;j<ids.length;j++){const i=ids[j],t=weights[j];x+=p[3*i]*t;y+=p[3*i+1]*t;z+=p[3*i+2]*t;den+=this.w[i]*t*t;}if(den===0)return;const q=this.sdf.sample(x,y,z,this.contactSample);if(q[0]>=margin)return;const g2=q[1]**2+q[2]**2+q[3]**2;if(g2<.01)return;const dl=Math.min(.008,margin-q[0])/g2/den;for(let j=0;j<ids.length;j++){const a=ids[j]*3,f=this.w[ids[j]]*weights[j]*dl;for(let k=0;k<3;k++)p[a+k]+=f*q[1+k];}this.contacts++;}
 projectContacts(dense=false){const margin=this.settings.clearanceMM*.001;for(let i=0;i<this.count;i++)this.contact([i],[1],margin);if(dense){for(const edge of this.surfaceEdges)this.contact(edge,[.5,.5],margin+.0006);for(let f=0;f<this.faces.length;f+=3)this.contact(this.faces.subarray(f,f+3),[1/3,1/3,1/3],margin+.0008);}}
 step(dt=1/30){if(!Number.isFinite(dt)||dt<0||dt>.101)throw Error('CLOTH_DT_RANGE');const sub=Math.max(1,Math.ceil(dt*240)),h=dt/sub;if(h===0)return;const p=this.p,v=this.v,w=this.w,s=this.settings;this.contacts=0;
  for(let ss=0;ss<sub;ss++){this.old.set(p);const damp=Math.exp(-s.damping*h);for(let i=0;i<this.count;i++){const j=i*3;if(!w[i])continue;for(let k=0;k<3;k++)p[j+k]+=v[j+k]*damp*h;p[j+1]-=GRAVITY*s.gravity*h*h;}
   for(const e of this.edges)e.lambda=0;for(const b of this.bends)b.lambda=0;
   for(let it=0;it<10;it++){for(const e of this.edges)this.distance(e,h);if(it%2===0)for(const b of this.bends)this.bending(b,h);this.strainGuard();this.projectContacts(it===9);}
   for(let guard=0;guard<10;guard++){this.strainGuard();this.projectContacts(guard===9);}
   this.projectContacts(false);
   for(let i=0;i<p.length;i++){if(!Number.isFinite(p[i])||Math.abs(p[i]-this.initial[i])>.45){this.p.set(this.old);this.v.fill(0);this.safetyTrips++;throw Error('物理超出本轮安全范围，已暂停并保留上一帧');}v[i]=(p[i]-this.old[i])/h;}
   // Contact friction is velocity damping, not attraction to the original pose.
   for(let i=0;i<this.count;i++){if(!w[i]||!this.sdf)continue;const j=i*3,q=this.sdf.sample(p[j],p[j+1],p[j+2],this.contactSample);if(q[0]<s.clearanceMM*.001+.0012){const l=Math.hypot(q[1],q[2],q[3]);if(l>.1){const nx=q[1]/l,ny=q[2]/l,nz=q[3]/l,vn=v[j]*nx+v[j+1]*ny+v[j+2]*nz,f=Math.exp(-32*h);v[j]=(v[j]-vn*nx)*f+Math.max(0,vn)*nx;v[j+1]=(v[j+1]-vn*ny)*f+Math.max(0,vn)*ny;v[j+2]=(v[j+2]-vn*nz)*f+Math.max(0,vn)*nz;}}}
   this.time+=h;this.steps++;
  }this.expand();
 }
 expand(){const N=this.groupNormals;N.fill(0);const p=this.p,F=this.faces;for(let f=0;f<F.length;f+=3){const a=F[f]*3,b=F[f+1]*3,c=F[f+2]*3,ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2],x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx;for(const j of [a,b,c]){N[j]+=x;N[j+1]+=y;N[j+2]+=z;}}
  for(let i=0;i<this.count;i++){const j=3*i,l=Math.hypot(N[j],N[j+1],N[j+2])||1;N[j]/=l;N[j+1]/=l;N[j+2]/=l;}
  for(let i=0;i<this.map.length;i++){const g=this.map[i]*3;for(let k=0;k<3;k++){this.output[3*i+k]=p[g+k];this.normals[3*i+k]=N[g+k];}}return this.output;
 }
 reset(){this.p.set(this.initial);this.v.fill(0);this.time=0;this.steps=0;this.safetyTrips=0;this.expand();}
 tug(){let ymin=Infinity;for(let i=1;i<this.p.length;i+=3)ymin=Math.min(ymin,this.p[i]);for(let i=0;i<this.count;i++)if(this.w[i]&&this.p[3*i+1]<ymin+.10){this.v[3*i+1]+=.32;this.v[3*i+2]+=.20;}}
 audit(){let min=Infinity,maxMove=0,minRatio=Infinity,maxRatio=0;const p=this.p,q=this.contactSample;for(let i=0;i<this.count;i++){const j=i*3;if(this.sdf)min=Math.min(min,this.sdf.sample(p[j],p[j+1],p[j+2],q)[0]);maxMove=Math.max(maxMove,Math.hypot(p[j]-this.initial[j],p[j+1]-this.initial[j+1],p[j+2]-this.initial[j+2]));}
  for(const e of this.edges){const a=e.a*3,b=e.b*3,r=Math.hypot(p[a]-p[b],p[a+1]-p[b+1],p[a+2]-p[b+2])/e.rest;minRatio=Math.min(minRatio,r);maxRatio=Math.max(maxRatio,r);}
  return{type:'XPBD-distance-and-dihedral',gravityMS2:GRAVITY*this.settings.gravity,seconds:this.time,substeps:this.steps,particles:this.count,originalVertices:this.map.length,sewnPairs:this.seamPairs.length,seamGapMM:0,waistAnchors:this.pins.length,shoulderAnchors:0,distanceConstraints:this.edges.length,dihedralConstraints:this.bends.length,minBodyVertexDistanceMM:min*1000,maxMoveMM:maxMove*1000,minEdgeStretch:minRatio,maxEdgeStretch:maxRatio,contactCorrections:this.contacts,safetyTrips:this.safetyTrips,densityKgM2:this.density,materialCalibrated:false,continuousCollision:false,restMetric:'original flat paper',kinematicShapeAttraction:false,strainGuard:'engineering extension/compression limits; not measured fabric calibration'};}
}
