import * as T from 'three';
import {insideHole} from './seam.mjs';
const V=p=>new T.Vector3(...p);
function roundRect(w,d,r){
 const s=new T.Shape();s.moveTo(-w/2+r,-d/2);s.lineTo(w/2-r,-d/2);s.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);s.lineTo(w/2,d/2-r);s.quadraticCurveTo(w/2,d/2,w/2-r,d/2);s.lineTo(-w/2+r,d/2);s.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);s.lineTo(-w/2,-d/2+r);s.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);return s;
}
function ring(h,N=32){const p=[];for(let i=0;i<N;i++){const a=i*2*Math.PI/N,u=Math.cos(a)*h.rx,v=Math.sin(a)*h.rz;p.push([h.x+u*h.axis[0]-v*h.axis[1],h.z+u*h.axis[1]+v*h.axis[0]]);}return p;}
function relief(m,x,z,side){
 if(!side)return 0;let dip=0;
 for(let row=0;row<m.params.rows;row++){const zh=row===0?-5:5;dip+=m.params.groove*Math.exp(-(((z-zh)/.75)**2));}
 let edgeDip=0;for(const h of m.holes){if(Math.abs(x-h.x)>2||Math.abs(z-h.z)>2)continue;const dx=x-h.x,dz=z-h.z,u=dx*h.axis[0]+dz*h.axis[1],v=-dx*h.axis[1]+dz*h.axis[0],r=Math.hypot(u/h.rx,v/h.rz);edgeDip=Math.max(edgeDip,.035*m.params.tightness*Math.exp(-(((r-1)/.38)**2)));}
 return -side*(dip+edgeDip);
}
function subdivide(g,levels){
 let pos=Array.from(g.attributes.position.array),idx=Array.from(g.index.array);
 for(let pass=0;pass<levels;pass++){const mid=new Map(),next=[];const get=(a,b)=>{const k=a<b?a+','+b:b+','+a;if(mid.has(k))return mid.get(k);const id=pos.length/3;pos.push((pos[a*3]+pos[b*3])/2,(pos[a*3+1]+pos[b*3+1])/2,0);mid.set(k,id);return id;};for(let k=0;k<idx.length;k+=3){const[a,b,c]=idx.slice(k,k+3),ab=get(a,b),bc=get(b,c),ca=get(c,a);next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}idx=next;}
 return {pos,idx};
}
export function makeLeatherGeometry(m){
 const shape=roundRect(m.width,m.depth,2);
 for(const h of m.holes){const pts=ring(h).reverse(),p=new T.Path();p.moveTo(...pts[0]);for(const pt of pts.slice(1))p.lineTo(...pt);p.closePath();shape.holes.push(p);}
 const planar=new T.ShapeGeometry(shape,6),data=subdivide(planar,2);planar.dispose();
 const surfaces=[],walls=[];
 for(let layer=0;layer<2;layer++){
  const y0=layer===0?0:-m.params.layerThickness,y1=layer===0?m.params.layerThickness:0;
  for(const side of [-1,1]){
   const exposed=(layer===0&&side===1)||(layer===1&&side===-1),g=new T.BufferGeometry(),p=[],uv=[];for(let i=0;i<data.pos.length;i+=3){const x=data.pos[i],z=data.pos[i+1];p.push(x,(side===1?y1:y0)+relief(m,x,z,exposed?side:0),z);uv.push((x+m.width/2)/96,(z+m.depth/2)/96);}
   const ix=data.idx.slice();if(side===1)for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];
   g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('uv1',g.attributes.uv.clone());g.setIndex(ix);g.computeVertexNormals();surfaces.push({geometry:g,layer,side,exposed});
  }
  const pos=[],uv=[],idx=[];
  const addWall=(pts,inward)=>{for(let j=0;j<pts.length;j++){const a=pts[j],b=pts[(j+1)%pts.length],k=pos.length/3;pos.push(a[0],y0+relief(m,...a,layer===1?-1:0),a[1],b[0],y0+relief(m,...b,layer===1?-1:0),b[1],a[0],y1+relief(m,...a,layer===0?1:0),a[1],b[0],y1+relief(m,...b,layer===0?1:0),b[1]);uv.push(j*.2,0,(j+1)*.2,0,j*.2,1,(j+1)*.2,1);if(inward)idx.push(k,k+2,k+1,k+1,k+2,k+3);else idx.push(k,k+1,k+2,k+1,k+3,k+2);}};
  for(const h of m.holes)addWall(ring(h),true);addWall(shape.getPoints(6).slice(0,-1).map(p=>[p.x,p.y]),false);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();walls.push({geometry:g,layer});
 }
 return {surfaces,walls};
}
export function cutFaceGeometry(m,z=-5){
 const holes=m.holes.filter(h=>Math.abs(h.z-z)<.001),intervals=[];
 for(const h of holes){const rx=1/Math.sqrt((h.axis[0]/h.rx)**2+(h.axis[1]/h.rz)**2);intervals.push([h.x-rx,h.x+rx]);}
 const ranges=[];let start=-m.width/2;for(const [a,b]of intervals){ranges.push([start,a]);start=b;}ranges.push([start,m.width/2]);const p=[],uv=[],idx=[];
 for(const [a,b]of ranges)for(let layer=0;layer<2;layer++){const lo=layer===0?0:-m.params.layerThickness,hi=layer===0?m.params.layerThickness:0,n=p.length/3;const low=lo+(layer===1?m.params.groove:0),high=hi-(layer===0?m.params.groove:0);p.push(a,low,z,b,low,z,a,high,z,b,high,z);uv.push(a/4,0,b/4,0,a/4,1,b/4,1);idx.push(n,n+1,n+2,n+1,n+3,n+2);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function resample(points,step){const out=[V(points[0])];let last=V(points[0]),total=0;const lengths=[0];for(const p of points.slice(1)){const next=V(p),L=next.distanceTo(last);if(L<1e-8)continue;const n=Math.max(1,Math.ceil(L/step));for(let k=1;k<=n;k++){out.push(last.clone().lerp(next,k/n));lengths.push(total+L*k/n);}total+=L;last=next;}return {out,lengths,total};}
export function makeThreadGeometry(points,diameter,detail=true){
 const {out,lengths,total}=resample(points,diameter*.28),n=out.length;
 if(n<2)return new T.BufferGeometry();
 const tangents=[],normals=[],bins=[];let N=new T.Vector3(0,0,1),prev;
 for(let i=0;i<n;i++){const t=out[Math.min(n-1,i+1)].clone().sub(out[Math.max(0,i-1)]).normalize();if(t.lengthSq()<.1)t.set(0,1,0);if(i===0){N.addScaledVector(t,-N.dot(t));if(N.lengthSq()<.01)N.set(0,1,0).addScaledVector(t,-t.y);N.normalize();}else N.applyQuaternion(new T.Quaternion().setFromUnitVectors(prev,t)).normalize();const B=new T.Vector3().crossVectors(t,N).normalize();N=new T.Vector3().crossVectors(B,t).normalize();tangents.push(t);normals.push(N.clone());bins.push(B);prev=t;}
 const pos=[],uv=[],idx=[],color=[],sides=detail?7:6,plies=detail?3:1;
 for(let ply=0;ply<plies;ply++){
  const start=pos.length/3,rad=detail?diameter*.222:diameter*.48;
  for(let i=0;i<n;i++){
   const phase=lengths[i]/(diameter*3.2)*Math.PI*2+ply*Math.PI*2/3;
   const c=out[i].clone();if(detail)c.addScaledVector(normals[i],Math.cos(phase)*diameter*.27).addScaledVector(bins[i],Math.sin(phase)*diameter*.27);
   for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,q=c.clone().addScaledVector(normals[i],Math.cos(a)*rad).addScaledVector(bins[i],Math.sin(a)*rad);pos.push(...q);uv.push(lengths[i]/diameter/3.2,j/sides);const tone=.93+.07*Math.sin(ply*2.3+lengths[i]*1.2);color.push(tone,tone,tone);if(i<n-1&&j<sides){const k=start+i*(sides+1)+j;idx.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}}
  }
  for(const [ringIndex,reverse]of [[0,true],[n-1,false]]){const cidx=pos.length/3;const ids=Array.from({length:sides},(_,j)=>start+ringIndex*(sides+1)+j),c=new T.Vector3();for(const id of ids)c.add(new T.Vector3(pos[id*3],pos[id*3+1],pos[id*3+2]));c.multiplyScalar(1/sides);pos.push(...c);uv.push(0,0);color.push(.94,.94,.94);for(let j=0;j<sides;j++){const a=ids[j],b=ids[(j+1)%sides];if(reverse)idx.push(cidx,b,a);else idx.push(cidx,a,b);}}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.setIndex(idx);g.computeVertexNormals();g.userData={routeLengthMM:total,plies,hasEndCaps:true};return g;
}
export function fibreNormalTexture(){
 const w=256,h=64,a=new Uint8Array(w*h*4);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const phase=2*Math.PI*(i/w*18+j/h*8),noise=Math.sin(i*27.61+j*41.32),k=(j*w+i)*4;a[k]=128+12*Math.cos(phase)+3*noise;a[k+1]=128+9*Math.cos(phase);a[k+2]=254;a[k+3]=255;}
 const t=new T.DataTexture(a,w,h,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}
