// R02 geometric craft layer. Hole walls and thread are geometry, never painted dots.
import * as T from 'three';
export function buildCraft(p,baseShape,front,back,edge,threadMaterial){
 const group=new T.Group(),W=.25,L=p.object==='roll'?.335:.25,t=p.thickness/1000;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function quilting(u,v){if(p.craft==='plain'||p.craft==='woven')return 0;let x=u*W,z=v*L,q=p.quiltMM/1000;
 let a,b;if(p.craft==='diamond'){a=(x+z)/q;b=(x-z)/q;}else{a=x/q;b=z/q;}
 let sa=Math.abs(Math.sin(Math.PI*a)),sb=p.craft==='channels'?1:Math.abs(Math.sin(Math.PI*b));return p.loft/1000*Math.pow(sa*sb,2);
 }
 function point(u,v){let q=baseShape(u,v);q.y+=quilting(u,v);return q;}
 function surface(u,v){let e=.00003,q=point(u,v),du=point(u+e,v).sub(point(u-e,v)),dv=point(u,v+e).sub(point(u,v-e));let n=new T.Vector3().crossVectors(dv,du).normalize();return {p:q,n};}
 function at(u,v,side=1,extra=0){let s=surface(u,v);return s.p.addScaledVector(s.n,side*t*.5+extra);}
 const create=()=>({pos:[],uv:[],norm:[],idx:[]}),top=create(),bottom=create(),walls=create();let holes=0;
 function vertex(buf,u,v,side){let {p:q,n}=surface(u,v);q.addScaledVector(n,side*t*.5);let i=buf.pos.length/3;buf.pos.push(...q);buf.norm.push(n.x*side,n.y*side,n.z*side);buf.uv.push(u*W/(p.tileMM/1000),v*L/(p.tileMM/1000));return i;}
 function quad(buf,a,b,c,d,side){if(side>0)buf.idx.push(a,c,b,b,c,d);else buf.idx.push(a,b,c,b,d,c);}
 function wall(ring,close=true){for(let i=0;i<(close?ring.length:ring.length-1);i++){let a=ring[i],b=ring[(i+1)%ring.length],j=walls.pos.length/3;walls.pos.push(...at(...a,1),...at(...b,1),...at(...a,-1),...at(...b,-1));walls.uv.push(i*.15,0,(i+1)*.15,0,i*.15,1,(i+1)*.15,1);walls.idx.push(j,j+1,j+2,j+1,j+3,j+2);}}
 if(p.craft==='woven'){
  // Separate ribbons, alternating over/under. No sheet hidden below the weave.
  let spacing=p.quiltMM/3000,width=spacing*.88,nu=Math.max(4,Math.round(W/spacing)),nv=Math.max(4,Math.round(L/spacing));spacing=Math.min(W/nu,L/nv);let cross=p.loft/1000*.3+t*.6;
  const ribbon=(horizontal,index,count,length)=>{
   const steps=Math.ceil(length/spacing)*8;
   for(let side of [1,-1]){let buf=side===1?top:bottom,start=buf.pos.length/3;
    for(let j=0;j<=steps;j++)for(let k=0;k<2;k++){let along=j/steps*length,across=(index+.5)*spacing+(k-.5)*width,u=horizontal?along/W:across/W,v=horizontal?across/L:along/L;
     let q=baseShape(u,v),du=baseShape(u+.0001,v).sub(baseShape(u-.0001,v)),dv=baseShape(u,v+.0001).sub(baseShape(u,v-.0001)),n=new T.Vector3().crossVectors(dv,du).normalize();
     let wave=Math.cos(Math.PI*(along/spacing-.5)+index*Math.PI)*(horizontal?1:-1);q.addScaledVector(n,wave*cross+side*t*.5+.005);buf.pos.push(...q);buf.norm.push(...n.clone().multiplyScalar(side));buf.uv.push(u*W/(p.tileMM/1000),v*L/(p.tileMM/1000));
    }
    for(let j=0;j<steps;j++){let a=start+j*2;if(horizontal)quad(buf,a,a+2,a+1,a+3,side);else quad(buf,a,a+1,a+2,a+3,side);}
   }
   for(let k of [0,1])for(let j=0;j<steps;j++){let coords=[];for(let a of [j/steps*length,(j+1)/steps*length]){let across=(index+.5)*spacing+(k-.5)*width,u=horizontal?a/W:across/W,v=horizontal?across/L:a/L,q=baseShape(u,v),n=surface(u,v).n,wave=Math.cos(Math.PI*(a/spacing-.5)+index*Math.PI)*(horizontal?1:-1);q.addScaledVector(n,wave*cross+.005);coords.push(q.clone().addScaledVector(n,t*.5),q.clone().addScaledVector(n,-t*.5));}let o=walls.pos.length/3;walls.pos.push(...coords[0],...coords[1],...coords[2],...coords[3]);walls.uv.push(j*.1,0,j*.1,1,(j+1)*.1,0,(j+1)*.1,1);walls.idx.push(o,o+2,o+1,o+1,o+2,o+3);}
  };
  for(let i=0;i<nv;i++)ribbon(true,i,nv,W);for(let i=0;i<nu;i++)ribbon(false,i,nu,L);
 }else if(p.hole!=='none'){
  const nx=Math.max(5,Math.round(W/(p.holePitch/1000))),ny=Math.max(5,Math.round(L/(p.holePitch/1000))),N=16;
  const rx=Math.min(p.holeMM/2000/W,.35/nx),ry=Math.min(p.holeMM/2000/L*(p.hole==='slot'?1.7:1),.35/ny);
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
   let x0=i/nx,x1=(i+1)/nx,y0=j/ny,y1=(j+1)/ny,cx=(x0+x1)/2,cy=(y0+y1)/2;
   const active=i>1&&i<nx-2&&j>1&&j<ny-2&&(p.hole!=='stripe'||i%6<3);
   if(!active){for(let side of [1,-1]){let buf=side===1?top:bottom,a=vertex(buf,x0,y0,side),b=vertex(buf,x1,y0,side),c=vertex(buf,x0,y1,side),d=vertex(buf,x1,y1,side);quad(buf,a,b,c,d,side);}continue;}
   holes++;const rings=[];
   for(let k=0;k<N;k++){let angle=2*Math.PI*k/N,dx=Math.cos(angle),dy=Math.sin(angle),sc=1/Math.max(Math.abs(dx),Math.abs(dy));rings.push([[cx+rx*dx,cy+ry*dy],[cx+(x1-x0)*.5*dx*sc,cy+(y1-y0)*.5*dy*sc]]);}
   for(let side of [1,-1]){let buf=side===1?top:bottom,start=buf.pos.length/3;for(let r=0;r<=2;r++)for(let k=0;k<N;k++){let a=rings[k][0],b=rings[k][1];vertex(buf,a[0]+(b[0]-a[0])*r/2,a[1]+(b[1]-a[1])*r/2,side);}for(let r=0;r<2;r++)for(let k=0;k<N;k++){let a=start+r*N+k,b=start+r*N+(k+1)%N,c=a+N,d=b+N;quad(buf,a,b,c,d,-side);}}
   wall(rings.map(a=>a[0]));
  }
 }else{
  const nu=110,nv=160;for(let side of [1,-1]){let buf=side===1?top:bottom;for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++)vertex(buf,i/nu,j/nv,side);for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){let a=j*(nu+1)+i;quad(buf,a,a+1,a+nu+1,a+nu+2,side);}}
 }
 if(p.craft!=='woven'){let boundary=[];for(let i=0;i<=110;i++)boundary.push([i/110,0]);for(let i=1;i<=160;i++)boundary.push([1,i/160]);for(let i=109;i>=0;i--)boundary.push([i/110,1]);for(let i=159;i>0;i--)boundary.push([0,i/160]);wall(boundary);}
 function mesh(buf,mat){let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(buf.pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(buf.uv,2));g.setAttribute('uv1',g.attributes.uv.clone());g.setIndex(buf.idx);if(buf.norm.length)g.setAttribute('normal',new T.Float32BufferAttribute(buf.norm,3));else g.computeVertexNormals();let m=new T.Mesh(g,mat);m.castShadow=m.receiveShadow=true;group.add(m);return m;}
 let body=mesh(top,front);mesh(bottom,back);mesh(walls,edge);
 let paths=[],margin=.005,pitch=p.pitchMM/1000;
 function path(a,b){paths.push([a,b]);}
 function border(m){path([m/W,m/L],[1-m/W,m/L]);path([1-m/W,m/L],[1-m/W,1-m/L]);path([1-m/W,1-m/L],[m/W,1-m/L]);path([m/W,1-m/L],[m/W,m/L]);}
 if(p.stitches&&p.stitch!=='none'&&p.craft!=='woven'){
  border(margin);if(p.stitch==='double')border(margin+.0023);
  let q=p.quiltMM/1000;
  if(p.craft==='grid'||p.craft==='channels'){for(let x=q;x<W;x+=q)path([x/W,.01],[x/W,.99]);if(p.craft==='grid')for(let z=q;z<L;z+=q)path([.01,z/L],[.99,z/L]);}
  if(p.craft==='diamond'){for(let sign of [-1,1])for(let d=-W-L;d<W+L;d+=q){let points=[];for(let x of [0,W]){let z=sign*(d-x);if(z>=0&&z<=L)points.push([x/W,z/L]);}for(let z of [0,L]){let x=d-sign*z;if(x>=0&&x<=W)points.push([x/W,z/L]);}if(points.length>=2)path(points[0],points[1]);}}
 }
 const segments=[];
 for(const [a,b] of paths){let dx=(b[0]-a[0])*W,dz=(b[1]-a[1])*L,length=Math.hypot(dx,dz),count=Math.max(1,Math.floor(length/pitch)),sx=-dz/(length||1)*.0008/W,sz=dx/(length||1)*.0008/L;
  for(let i=0;i<count;i++){let f=(i+.15)/count,g=(i+.81)/count,A=[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f],B=[a[0]+(b[0]-a[0])*g,a[1]+(b[1]-a[1])*g];if(p.stitch==='zigzag'){let s=i%2?1:-1;A[0]+=sx*s;A[1]+=sz*s;B[0]-=sx*s;B[1]-=sz*s;}if(p.stitch==='cross'){segments.push([[A[0]+sx,A[1]+sz],[B[0]-sx,B[1]-sz]]);A=[A[0]-sx,A[1]-sz];B=[B[0]+sx,B[1]+sz];}segments.push([A,B]);}
 }
 let threads=null;
 if(segments.length){let radius=p.threadMM/2000,g=new T.CylinderGeometry(1,1,1,6,1,true);threads=new T.InstancedMesh(g,threadMaterial,segments.length*3);let dummy=new T.Object3D(),up=new T.Vector3(0,1,0);let n=0;
  for(const [a,b] of segments){let prev=null;for(let k=0;k<=3;k++){let f=k/3,u=clamp(a[0]+(b[0]-a[0])*f,0,1),v=clamp(a[1]+(b[1]-a[1])*f,0,1),q=at(u,v,1,radius*.8+Math.sin(f*Math.PI)*radius*.5);if(prev){let dir=q.clone().sub(prev);dummy.position.copy(prev).add(q).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,dir.clone().normalize());dummy.scale.set(radius,dir.length(),radius);dummy.updateMatrix();threads.setMatrixAt(n++,dummy.matrix);}prev=q;}}
  threads.castShadow=true;group.add(threads);
 }
 if(p.piping&&p.craft!=='woven'){let ring=[];let m=.0008;for(let i=0;i<=90;i++)ring.push(at(m/W+(1-2*m/W)*i/90,m/L,1,.0004));for(let i=1;i<=110;i++)ring.push(at(1-m/W,m/L+(1-2*m/L)*i/110,1,.0004));for(let i=1;i<=90;i++)ring.push(at(1-m/W-(1-2*m/W)*i/90,1-m/L,1,.0004));for(let i=1;i<=110;i++)ring.push(at(m/W,1-m/L-(1-2*m/L)*i/110,1,.0004));let g=new T.TubeGeometry(new T.CatmullRomCurve3(ring,true,'centripetal'),430,Math.max(.00045,t*.43),8,true),msh=new T.Mesh(g,front);msh.castShadow=true;group.add(msh);}
 group.userData={holes,threadSegments:segments.length,thicknessMM:p.thickness,craft:p.craft,physics:false};return {group,body,threads,surface,info:group.userData};
}
