// Same material-frame embedding as R09; reusable scalar buffers replace
// per-node/per-face Vector3, slice and closure allocations. Geometry is unchanged.
function frameField(r,x){const N=r.nodeCount,pool=r._framePool||(r._framePool={t:new Float64Array(3*N),n:new Float64Array(3*N),out:new Float64Array(9*N)}),T=pool.t,Z=pool.n,O=pool.out;T.fill(0);Z.fill(0);
 for(const f of r.frameTriangles){const a=f.ids[0]*3,b=f.ids[1]*3,c=f.ids[2]*3,ex=x[b]-x[a],ey=x[b+1]-x[a+1],ez=x[b+2]-x[a+2],wx=x[c]-x[a],wy=x[c+1]-x[a+1],wz=x[c+2]-x[a+2],D=f.inv;
  let ux=ex*D[0]+wx*D[2],uy=ey*D[0]+wy*D[2],uz=ez*D[0]+wz*D[2],vx=ex*D[1]+wx*D[3],vy=ey*D[1]+wy*D[3],vz=ez*D[1]+wz*D[3];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const il=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1),area=f.flip?-f.area:f.area,iu=1/(Math.sqrt(ux*ux+uy*uy+uz*uz)||1);nx=nx*il*area;ny=ny*il*area;nz=nz*il*area;ux=ux*iu*f.area;uy=uy*iu*f.area;uz=uz*iu*f.area;
  for(const id of f.ids){const i=3*id;T[i]+=ux;T[i+1]+=uy;T[i+2]+=uz;Z[i]+=nx;Z[i+1]+=ny;Z[i+2]+=nz;}}
 for(let i=0;i<N;i++){const j=3*i,o=9*i,f=r.referenceFrames[i];let nx=Z[j],ny=Z[j+1],nz=Z[j+2],inv=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1);nx*=inv;ny*=inv;nz*=inv;if(nx*nx+ny*ny+nz*nz<.1){nx=f.n.x;ny=f.n.y;nz=f.n.z;}let tx=T[j],ty=T[j+1],tz=T[j+2],d=-(tx*nx+ty*ny+tz*nz);tx+=nx*d;ty+=ny*d;tz+=nz*d;inv=1/(Math.sqrt(tx*tx+ty*ty+tz*tz)||1);tx*=inv;ty*=inv;tz*=inv;if(tx*tx+ty*ty+tz*tz<.1){tx=f.t.x;ty=f.t.y;tz=f.t.z;}O[o]=tx;O[o+1]=ty;O[o+2]=tz;O[o+3]=ny*tz-nz*ty;O[o+4]=nz*tx-nx*tz;O[o+5]=nx*ty-ny*tx;O[o+6]=nx;O[o+7]=ny;O[o+8]=nz;}
 return O;
}
export function updateSkin(root,solver){const r=root.userData.rig;if(!r.nodeCount)throw Error('Physical skin contract missing');if(!r._r10Rest)r._r10Rest=frameField(r,solver.rest).slice();const A=r._r10Rest,B=frameField(r,solver.x),P=r.pixels;
 for(let i=0;i<r.nodeCount;i++){const o=9*i,f=r.referenceFrames[i];for(let k=0;k<3;k++)P[12*i+k]=solver.x[3*i+k]*1000;for(let side=0;side<2;side++){const v=side?f.n:f.t,da=v.x*A[o]+v.y*A[o+1]+v.z*A[o+2],db=v.x*A[o+3]+v.y*A[o+4]+v.z*A[o+5],dc=v.x*A[o+6]+v.y*A[o+7]+v.z*A[o+8];let x=B[o]*da+B[o+3]*db+B[o+6]*dc,y=B[o+1]*da+B[o+4]*db+B[o+7]*dc,z=B[o+2]*da+B[o+5]*db+B[o+8]*dc;const inv=1/(Math.sqrt(x*x+y*y+z*z)||1),at=12*i+(side?8:4);P[at]=x*inv;P[at+1]=y*inv;P[at+2]=z*inv;}}r.texture.needsUpdate=true;
}
