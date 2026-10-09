import * as T from 'three';
import {insideHole} from './seam.mjs';
import {mapSurfacePoint} from './contact-surface.mjs';
const V=p=>new T.Vector3(...p);
function outline(h,angle){
 const c=Math.cos(angle),s=Math.sin(angle),variation=1+.018*Math.sin(angle*5+h.index*1.73)+.009*Math.sin(angle*9+h.index*.71);
 // Needle opening is occupied by thread, not a machined grommet. Small deterministic cut variation.
 const u=c*h.rx*variation,v=s*h.rz*variation;
 return [h.x+u*h.axis[0]-v*h.axis[1],h.z+u*h.axis[1]+v*h.axis[0]];
}
function relief(m,x,z,side){
 if(!side)return 0;
 let g=0;for(let row=0;row<m.params.rows;row++){const zh=row===0?-5:5;g+=m.params.groove*Math.exp(-(((z-zh)/.55)**2));}
 for(const h of m.holes){const dx=x-h.x,dz=z-h.z;if(Math.abs(dx)>1.5||Math.abs(dz)>1.5)continue;const u=dx*h.axis[0]+dz*h.axis[1],v=-dx*h.axis[1]+dz*h.axis[0],r=Math.hypot(u/h.rx,v/h.rz);g+=.022*Math.exp(-(((r-1)/.20)**2));}
 return -side*g;
}
function surfacePoint(m,x,z,y,side){return mapSurfacePoint(m,[x,y+relief(m,x,z,side),z]);}
function surfaceNormal(m,x,z,y,side,sign){
 const e=.022,a=surfacePoint(m,x-e,z,y,side),b=surfacePoint(m,x+e,z,y,side),c=surfacePoint(m,x,z-e,y,side),d=surfacePoint(m,x,z+e,y,side);
 const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=d[0]-c[0],vy=d[1]-c[1],vz=d[2]-c[2];
 const nx=vy*uz-vz*uy,ny=vz*ux-vx*uz,nz=vx*uy-vy*ux,L=Math.hypot(nx,ny,nz);return [nx/L*sign,ny/L*sign,nz/L*sign];
}
export function makeLeatherGeometry(m){
 const base=[],indices=[];
 function vertex(x,z){const i=base.length/2;base.push(x,z);return i;}
 function quad(a,b,c,d){indices.push(a,c,b,b,c,d);}
 function rect(x0,x1,z0,z1){if(x1-x0<1e-6||z1-z0<1e-6)return;const nx=Math.ceil((x1-x0)/.26),nz=Math.ceil((z1-z0)/.26),start=base.length/2;for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++)vertex(x0+(x1-x0)*i/nx,z0+(z1-z0)*j/nz);for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=start+j*(nx+1)+i;quad(a,a+1,a+nx+1,a+nx+2);}}
 const perHole=[];
 function cell(h,x0,x1,z0,z1){
  const nx=Math.ceil((x1-x0)/.22),nz=Math.ceil((z1-z0)/.22),edge=[];
  for(let i=0;i<nx;i++)edge.push([x0+(x1-x0)*i/nx,z0]);
  for(let i=0;i<nz;i++)edge.push([x1,z0+(z1-z0)*i/nz]);
  for(let i=0;i<nx;i++)edge.push([x1-(x1-x0)*i/nx,z1]);
  for(let i=0;i<nz;i++)edge.push([x0,z1-(z1-z0)*i/nz]);
  const N=edge.length,nr=11,start=base.length/2,inner=[];
  for(const p of edge){const dx=p[0]-h.x,dz=p[1]-h.z,uu=dx*h.axis[0]+dz*h.axis[1],vv=-dx*h.axis[1]+dz*h.axis[0];inner.push(outline(h,Math.atan2(vv/h.rz,uu/h.rx)));}
  for(let ring=0;ring<=nr;ring++)for(let i=0;i<N;i++){const a=inner[i],b=edge[i],f=(ring/nr)**1.45;vertex(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f);}
  for(let ring=0;ring<nr;ring++)for(let i=0;i<N;i++){const a=start+ring*N+i,b=start+ring*N+(i+1)%N,c=a+N,d=b+N;indices.push(a,b,c,b,d,c);}
  perHole.push({h,ring:inner});
 }
 const zs=m.params.rows===1?[-5]:[-5,5];let zstart=-m.depth/2;
 for(let row=0;row<m.params.rows;row++){
  const z=zs[row],z0=z-1.6,z1=z+1.6;rect(-m.width/2,m.width/2,zstart,z0);
  const hs=m.holes.filter(h=>h.row===row),p=m.params.pitch;
  rect(-m.width/2,hs[0].x-p/2,z0,z1);
  for(const h of hs)cell(h,h.x-p/2,h.x+p/2,z0,z1);
  rect(hs.at(-1).x+p/2,m.width/2,z0,z1);zstart=z1;
 }
 rect(-m.width/2,m.width/2,zstart,m.depth/2);
 const surfaces=[],walls=[];
 for(let layer=0;layer<2;layer++){
  const y0=layer===0?0:-m.params.layerThickness,y1=layer===0?m.params.layerThickness:0;
  for(const sign of [-1,1]){
   const exposed=(layer===0&&sign===1)||(layer===1&&sign===-1),side=exposed?sign:0,y=sign===1?y1:y0;
   const pos=[],uv=[],norm=[],color=[],compression=[];
   for(let i=0;i<base.length;i+=2){const x=base[i],z=base[i+1],q=surfacePoint(m,x,z,y,side);pos.push(...q);uv.push((x+m.width/2)/96,(z+m.depth/2)/96);norm.push(...surfaceNormal(m,x,z,y,side,sign));const w=m.contact?.sample(x,z)[1]||0,d=Math.min(1,Math.max(0,-w/.16));compression.push(d);const shade=1-.08*d;color.push(shade,shade,shade);}
   const ix=indices.slice();if(sign<0)for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('uv1',g.attributes.uv.clone());g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.setAttribute('compression',new T.Float32BufferAttribute(compression,1));g.setIndex(ix);g.userData={layer,side:sign,exposed,normalConvention:'outward',hasContactDeformation:true};surfaces.push({geometry:g,layer,side:sign,exposed});
  }
  const pos=[],uv=[],ix=[];
  const makeWall=(ring,inward)=>{
   const N=ring.length,levels=8,start=pos.length/3;
   for(let j=0;j<=levels;j++){const f=j/levels,y=y0+(y1-y0)*f;for(let i=0;i<N;i++){const [x,z]=ring[i],side=layer===0?f:f-1;const q=surfacePoint(m,x,z,y,side);pos.push(...q);uv.push(i/N*4,f);}}
   for(let j=0;j<levels;j++)for(let i=0;i<N;i++){const a=start+j*N+i,b=start+j*N+(i+1)%N,c=a+N,d=b+N;if(inward)ix.push(a,b,c,b,d,c);else ix.push(a,c,b,b,c,d);}
  };
  for(const {ring} of perHole)makeWall(ring,true);
  const outer=[];const nx=Math.ceil(m.width/.3),nz=Math.ceil(m.depth/.3);for(let i=0;i<nx;i++)outer.push([-m.width/2+m.width*i/nx,-m.depth/2]);for(let i=0;i<nz;i++)outer.push([m.width/2,-m.depth/2+m.depth*i/nz]);for(let i=0;i<nx;i++)outer.push([m.width/2-m.width*i/nx,m.depth/2]);for(let i=0;i<nz;i++)outer.push([-m.width/2,m.depth/2-m.depth*i/nz]);makeWall(outer,false);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();g.userData.normalConvention='outward';walls.push({geometry:g,layer});
 }
 return {surfaces,walls};
}
export function cutFaceGeometry(m,z=-5){
 const holes=m.holes.filter(h=>Math.abs(h.z-z)<.001),intervals=[];
 for(const h of holes){const rx=1/Math.sqrt((h.axis[0]/h.rx)**2+(h.axis[1]/h.rz)**2);intervals.push([h.x-rx,h.x+rx]);}
 const ranges=[];let start=-m.width/2;for(const [a,b]of intervals){ranges.push([start,a]);start=b;}ranges.push([start,m.width/2]);const p=[],uv=[],idx=[];
 for(const [a,b]of ranges)for(let layer=0;layer<2;layer++){const lo=layer===0?0:-m.params.layerThickness,hi=layer===0?m.params.layerThickness:0,n=p.length/3;
 const points=[[a,lo,z],[b,lo,z],[a,hi,z],[b,hi,z]].map(q=>surfacePoint(m,q[0],q[2],q[1],q[1]===0?0:q[1]>0?1:-1));for(const q of points)p.push(...q);uv.push(a/4,0,b/4,0,a/4,1,b/4,1);idx.push(n,n+1,n+2,n+1,n+3,n+2);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function resample(points,step){const out=[V(points[0])];let last=V(points[0]),total=0;const lengths=[0];for(const p of points.slice(1)){const next=V(p),L=next.distanceTo(last);if(L<1e-8)continue;const n=Math.max(1,Math.ceil(L/step));for(let k=1;k<=n;k++){out.push(last.clone().lerp(next,k/n));lengths.push(total+L*k/n);}total+=L;last=next;}return {out,lengths,total};}
export function makeThreadGeometry(points,diameter,detail=true){
 const {out,lengths,total}=resample(points,diameter*.12),n=out.length;
 if(n<2)return new T.BufferGeometry();
 const normals=[],bins=[];let N=new T.Vector3(0,0,1),prev;
 for(let i=0;i<n;i++){
  const t=out[Math.min(n-1,i+1)].clone().sub(out[Math.max(0,i-1)]).normalize();if(t.lengthSq()<.1)t.set(0,1,0);
  if(i===0){N.addScaledVector(t,-N.dot(t));if(N.lengthSq()<.01)N.set(0,1,0).addScaledVector(t,-t.y);N.normalize();}
  else N.applyQuaternion(new T.Quaternion().setFromUnitVectors(prev,t)).normalize();
  const B=new T.Vector3().crossVectors(t,N).normalize();N=new T.Vector3().crossVectors(B,t).normalize();normals.push(N.clone());bins.push(B);prev=t;
 }
 const pos=[],uv=[],idx=[],color=[],sides=detail?32:16;
 for(let i=0;i<n;i++){
  const phase=lengths[i]/(diameter*2.7)*Math.PI*2;
  for(let j=0;j<=sides;j++){
   const a=j/sides*Math.PI*2,rr=diameter*.48*(detail?1+.040*Math.cos(3*a-phase):1);
   const q=out[i].clone().addScaledVector(normals[i],Math.cos(a)*rr).addScaledVector(bins[i],Math.sin(a)*rr);
   pos.push(...q);uv.push(lengths[i]/(diameter*2.7),j/sides);
   const tone=detail?.985+.015*Math.cos(3*a-phase):1;color.push(tone,tone,tone);
   if(i<n-1&&j<sides){const k=i*(sides+1)+j;idx.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}
  }
 }
 for(const [ringIndex,reverse]of [[0,true],[n-1,false]]){
  const cidx=pos.length/3;pos.push(...out[ringIndex]);uv.push(0,0);color.push(1,1,1);
  for(let j=0;j<sides;j++){const a=ringIndex*(sides+1)+j,b=a+1;if(reverse)idx.push(cidx,a,b);else idx.push(cidx,b,a);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.setIndex(idx);g.computeVertexNormals();
 const nn=g.attributes.normal;for(let i=0;i<n;i++){const a=i*(sides+1),b=a+sides,v=new T.Vector3(nn.getX(a)+nn.getX(b),nn.getY(a)+nn.getY(b),nn.getZ(a)+nn.getZ(b)).normalize();nn.setXYZ(a,...v);nn.setXYZ(b,...v);}
 g.userData={routeLengthMM:total,plies:detail?3:1,structure:'outward closed continuous fibre thread',normalOrientation:'OUTWARD_VERIFIED',hasEndCaps:true};return g;
}
export function fibreNormalTexture(){
 const w=256,h=128,a=new Uint8Array(w*h*4),colour=new Uint8Array(w*h*4);
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){
  const u=i/w,v=j/h,phase=2*Math.PI*(12*v-4*u),fine=2*Math.PI*(36*v-12*u),c=Math.cos(phase),f=Math.cos(fine),k=(j*w+i)*4;
  const x=-.10*c-.025*f,y=.32*c+.08*f,z=1,inv=1/Math.hypot(x,y,z);
  a[k]=Math.round((x*inv*.5+.5)*255);a[k+1]=Math.round((y*inv*.5+.5)*255);a[k+2]=Math.round((z*inv*.5+.5)*255);a[k+3]=255;
  const shade=Math.round(238+12*Math.sin(phase)+4*Math.sin(fine));colour[k]=colour[k+1]=colour[k+2]=shade;colour[k+3]=255;
 }
 const make=data=>{const t=new T.DataTexture(data,w,h,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
 const t=make(a);t.userData.albedo=make(colour);t.userData.albedo.colorSpace=T.SRGBColorSpace;return t;
}
