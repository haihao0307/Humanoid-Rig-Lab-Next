/** Closest points on actual animated original-body and garment triangles; discrete contact. */
export function closestTriangle(p,faces,f,x,y,z,out=new Float64Array(7)){
 const ia=faces[f]*3,ib=faces[f+1]*3,ic=faces[f+2]*3;
 const ax=p[ia],ay=p[ia+1],az=p[ia+2],ux=p[ib]-ax,uy=p[ib+1]-ay,uz=p[ib+2]-az,vx=p[ic]-ax,vy=p[ic+1]-ay,vz=p[ic+2]-az,wx=x-ax,wy=y-ay,wz=z-az;
 const uu=ux*ux+uy*uy+uz*uz,vv=vx*vx+vy*vy+vz*vz,uv=ux*vx+uy*vy+uz*vz,wu=wx*ux+wy*uy+wz*uz,wv=wx*vx+wy*vy+wz*vz,den=uu*vv-uv*uv;
 let b=den>1e-24?(wu*vv-wv*uv)/den:0,c=den>1e-24?(wv*uu-wu*uv)/den:0;
 if(b<0||c<0||b+c>1||den<=1e-24){let best=Infinity,B=0,C=0;
  for(let k=0;k<3;k++){let sx=0,sy=0,sz=0,ex=ux,ey=uy,ez=uz;
   if(k===1){sx=ux;sy=uy;sz=uz;ex=vx-ux;ey=vy-uy;ez=vz-uz;}else if(k===2){sx=vx;sy=vy;sz=vz;ex=-vx;ey=-vy;ez=-vz;}
   const t=Math.max(0,Math.min(1,((wx-sx)*ex+(wy-sy)*ey+(wz-sz)*ez)/Math.max(1e-24,ex*ex+ey*ey+ez*ez))),dx=sx+t*ex-wx,dy=sy+t*ey-wy,dz=sz+t*ez-wz,d=dx*dx+dy*dy+dz*dz;
   if(d<best){best=d;B=k===0?t:k===1?1-t:0;C=k===0?0:k===1?t:1-t;}
  }b=B;c=C;
 }
 const px=ax+ux*b+vx*c,py=ay+uy*b+vy*c,pz=az+uz*b+vz*c;
 out[0]=(x-px)**2+(y-py)**2+(z-pz)**2;out[1]=px;out[2]=py;out[3]=pz;out[4]=1-b-c;out[5]=b;out[6]=c;return out;
}
export function vertexNormals(p,faces,out=new Float32Array(p.length)){
 out.fill(0);for(let f=0;f<faces.length;f+=3){const a=faces[f]*3,b=faces[f+1]*3,c=faces[f+2]*3,ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;for(const i of [a,b,c]){out[i]+=nx;out[i+1]+=ny;out[i+2]+=nz;}}
 for(let i=0;i<out.length;i+=3){const h=Math.hypot(out[i],out[i+1],out[i+2])||1;out[i]/=h;out[i+1]/=h;out[i+2]/=h;}return out;
}
export class MeshContact {
 constructor(positions,faces){this.p=positions;this.faces=Int32Array.from(faces);this.normals=new Float32Array(positions.length);this.nodes=[];this.tri=Int32Array.from({length:faces.length/3},(_,i)=>i*3);this.tmp=new Float64Array(7);this.best=new Float64Array(7);this.stack=new Int32Array(128);this.build(0,this.tri.length);this.refit();this.queries=0;}
 build(lo,hi){const id=this.nodes.length,n={lo,hi,left:-1,right:-1,box:new Float64Array(6)};this.nodes.push(n);if(hi-lo>8){const p=this.p,f=this.faces;const ranges=[0,1,2].map(axis=>{let a=Infinity,b=-Infinity;for(let i=lo;i<hi;i++){const k=this.tri[i],v=(p[f[k]*3+axis]+p[f[k+1]*3+axis]+p[f[k+2]*3+axis])/3;a=Math.min(a,v);b=Math.max(b,v);}return b-a;});const axis=ranges.indexOf(Math.max(...ranges));const sorted=Array.from(this.tri.subarray(lo,hi)).sort((a,b)=>(p[f[a]*3+axis]+p[f[a+1]*3+axis]+p[f[a+2]*3+axis])-(p[f[b]*3+axis]+p[f[b+1]*3+axis]+p[f[b+2]*3+axis]));this.tri.set(sorted,lo);const mid=(lo+hi)>>1;n.left=this.build(lo,mid);n.right=this.build(mid,hi);}return id;}
 refit(positions=this.p){this.p=positions;const p=this.p,faces=this.faces;vertexNormals(p,faces,this.normals);for(let j=this.nodes.length-1;j>=0;j--){const n=this.nodes[j],b=n.box;b[0]=b[1]=b[2]=Infinity;b[3]=b[4]=b[5]=-Infinity;if(n.left>=0){const a=this.nodes[n.left].box,c=this.nodes[n.right].box;for(let k=0;k<3;k++){b[k]=Math.min(a[k],c[k]);b[k+3]=Math.max(a[k+3],c[k+3]);}}else for(let i=n.lo;i<n.hi;i++){const f=this.tri[i];for(let q=0;q<3;q++){const v=faces[f+q]*3;for(let k=0;k<3;k++){b[k]=Math.min(b[k],p[v+k]);b[k+3]=Math.max(b[k+3],p[v+k]);}}}}}
 nearest(x,y,z,maxDistance=Infinity,seed=-1){let best=maxDistance*maxDistance,winner=-1,head=1;const stack=this.stack;stack[0]=0;this.queries++;
  if(seed>=0){closestTriangle(this.p,this.faces,seed,x,y,z,this.tmp);best=Math.min(best,this.tmp[0]);winner=seed;this.best.set(this.tmp);}
  while(head){const n=this.nodes[stack[--head]],b=n.box,dx=Math.max(b[0]-x,0,x-b[3]),dy=Math.max(b[1]-y,0,y-b[4]),dz=Math.max(b[2]-z,0,z-b[5]);if(dx*dx+dy*dy+dz*dz>best)continue;
   if(n.left<0){for(let k=n.lo;k<n.hi;k++){const f=this.tri[k],q=closestTriangle(this.p,this.faces,f,x,y,z,this.tmp);if(q[0]<best){best=q[0];winner=f;this.best.set(q);}}}
   else{const a=this.nodes[n.left].box,c=this.nodes[n.right].box,da=(a[0]+a[3]-2*x)**2+(a[1]+a[4]-2*y)**2+(a[2]+a[5]-2*z)**2,dc=(c[0]+c[3]-2*x)**2+(c[1]+c[4]-2*y)**2+(c[2]+c[5]-2*z)**2;if(da<dc){stack[head++]=n.right;stack[head++]=n.left;}else{stack[head++]=n.left;stack[head++]=n.right;}}
  }return winner;
 }
 sample(x,y,z,out=new Float64Array(4),seed=-1){const f=this.nearest(x,y,z,Infinity,seed);if(f<0){out[0]=Infinity;out[1]=out[2]=out[3]=0;return out;}return this.evaluate(f,x,y,z,out);}
 evaluate(f,x,y,z,out=new Float64Array(4)){const q=closestTriangle(this.p,this.faces,f,x,y,z,this.tmp),n=this.normals,faces=this.faces;let nx=0,ny=0,nz=0;for(let j=0;j<3;j++){const k=faces[f+j]*3,w=q[4+j];nx+=n[k]*w;ny+=n[k+1]*w;nz+=n[k+2]*w;}const len=Math.hypot(nx,ny,nz)||1;nx/=len;ny/=len;nz/=len;const dx=x-q[1],dy=y-q[2],dz=z-q[3],dot=dx*nx+dy*ny+dz*nz;out[0]=Math.sqrt(q[0])*(dot<0?-1:1);if(q[0]>1e-16){const s=(dot<0?-1:1)/Math.sqrt(q[0]);out[1]=dx*s;out[2]=dy*s;out[3]=dz*s;}else{out[1]=nx;out[2]=ny;out[3]=nz;}return out;}
}
/** Face orientation belongs to garment inside/outside; never camera azimuth. */
export function outwardPacket(packet,positions,sdf){let off=0;const signs=[];const panels=packet.spec.panels.map(panel=>{let vote=0;const q=new Float64Array(4);for(const [a0,b0,c0]of panel.triangles){const a=(off+a0)*3,b=(off+b0)*3,c=(off+c0)*3,ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2],vx=positions[c]-positions[a],vy=positions[c+1]-positions[a+1],vz=positions[c+2]-positions[a+2];sdf.sample((positions[a]+positions[b]+positions[c])/3,(positions[a+1]+positions[b+1]+positions[c+1])/3,(positions[a+2]+positions[b+2]+positions[c+2])/3,q);vote+=(uy*vz-uz*vy)*q[1]+(uz*vx-ux*vz)*q[2]+(ux*vy-uy*vx)*q[3];}const sign=vote<0?-1:1;signs.push({id:panel.id,sign,vote});off+=panel.uvMm.length;return{...panel,triangles:sign<0?panel.triangles.map(([a,b,c])=>[a,c,b]):panel.triangles};});return{packet:{...packet,spec:{...packet.spec,panels}},signs};}
