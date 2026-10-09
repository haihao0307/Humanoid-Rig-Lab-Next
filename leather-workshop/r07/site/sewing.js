// R07: R05 saddle topology + contact field mapped to product paper coordinates.
// R05_SEW is the exact frozen source with validation ranges widened at build time only.
// No disconnected cylinder/InstancedMesh stitches. Flat waxed fibre cross-section.
import * as T from 'three';
const V=(...p)=>new T.Vector3(...p),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const contactCache=new Map();
export class SeamPath{
 constructor(points,mapper,options={}){
  this.points=points.map(p=>new T.Vector2(...p));this.map=mapper;this.closed=!!options.closed;
  if(this.closed&&this.points[0].distanceTo(this.points.at(-1))>.001)this.points.push(this.points[0].clone());
  this.samples=[];this.lengths=[0];let prev=null,total=0;
  for(let j=1;j<this.points.length;j++){const a=this.points[j-1],b=this.points[j],steps=Math.max(1,Math.ceil(a.distanceTo(b)/.8));for(let i=j===1?0:1;i<=steps;i++){const uv=a.clone().lerp(b,i/steps),p=mapper(uv.x,uv.y);if(prev)total+=prev.distanceTo(p);this.samples.push(uv);if(prev)this.lengths.push(total);prev=p;}}
  this.length=total;this.count=Math.max(5,Math.round(total/(options.pitch||3.4))+1);this.pitch=total/(this.count-1);this.diameter=options.diameter||.32;this.t=options.totalThickness||1.4;this.center=options.center||0;this.tension=options.tension??.8;this.response=options.response!==false;this.id=options.id||'seam';
  if(this.pitch<2.5||this.pitch>5.5)throw Error('Unsupported seam pitch for '+this.id);
  this.model=R05_SEW.buildSeam({count:this.count,pitch:this.pitch,diameter:this.diameter,layerThickness:this.t/2,tensionN:this.tension,tightness:this.tension?1:.82,holeAngle:48,groove:.026});
  this.holes=this.model.holes.map(h=>{const s=h.x+(this.count-1)*this.pitch/2,fr=this.frame(s,0),metric=fr.metric;return{...h,id:this.id+'/'+h.id,uv:fr.uv,s,angle:Math.atan2(fr.tangent.y,fr.tangent.x)+h.angle,rx:h.rx/metric.u,rz:h.rz/metric.v,path:this};});
  const key=[this.pitch.toFixed(6),this.t,this.diameter,this.tension,this.response].join('/');if(!contactCache.has(key)){const m=R05_SEW.buildSeam({count:9,pitch:this.pitch,diameter:this.diameter,layerThickness:this.t/2,tensionN:this.tension,tightness:this.tension?1:.82});contactCache.set(key,R05_CONTACT.buildContactField(m,this.response));}this.contact=contactCache.get(key);
 }
 frame(s,offset=0){s=clamp(s,0,this.length);let a=0,b=this.samples.length-1;while(b-a>1){const m=(a+b)>>1;if(this.lengths[m]<s)a=m;else b=m;}const A=this.samples[a],B=this.samples[b],uv=A.clone().lerp(B,(s-this.lengths[a])/Math.max(1e-10,this.lengths[b]-this.lengths[a])),tan=B.clone().sub(A).normalize(),perp=new T.Vector2(-tan.y,tan.x);const p=this.map(uv.x,uv.y),mu=this.map(uv.x+tan.x*.05,uv.y+tan.y*.05).distanceTo(p)/.05,mv=this.map(uv.x+perp.x*.05,uv.y+perp.y*.05).distanceTo(p)/.05;uv.addScaledVector(perp,offset/Math.max(.05,mv));return{uv,tangent:tan,perp,metric:{u:Math.max(.05,mu),v:Math.max(.05,mv)}};}
 field(s,d){if(Math.abs(d)>5.8)return[0,0,0];const f=Math.min(1,Math.max(0,(5.8-Math.abs(d))/1.4));let x=((s+this.pitch/2)%this.pitch+this.pitch)%this.pitch-this.pitch/2;const v=this.contact.sample(x,-5+d);return v.map(v=>v*f);}
}
export class SeamIndex{
 constructor(paths){this.paths=paths;this.cells=new Map();this.cell=8;
  for(const path of paths)for(let j=1;j<path.samples.length;j++){const a=path.samples[j-1],b=path.samples[j],x0=Math.floor((Math.min(a.x,b.x)-6)/8),x1=Math.floor((Math.max(a.x,b.x)+6)/8),z0=Math.floor((Math.min(a.y,b.y)-6)/8),z1=Math.floor((Math.max(a.y,b.y)+6)/8);for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const key=x+','+z;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push({path,j,a,b});}}
 }
 nearest(x,z){const list=this.cells.get(Math.floor(x/8)+','+Math.floor(z/8));if(!list)return null;let best=null,D=1e30;for(const q of list){const dx=q.b.x-q.a.x,dz=q.b.y-q.a.y,l=dx*dx+dz*dz,f=clamp(((x-q.a.x)*dx+(z-q.a.y)*dz)/l,0,1),cx=q.a.x+dx*f,cz=q.a.y+dz*f,d2=(x-cx)**2+(z-cz)**2;if(d2<D){D=d2;const inv=1/Math.sqrt(l);best={path:q.path,s:q.path.lengths[q.j-1]+f*(q.path.lengths[q.j]-q.path.lengths[q.j-1]),d:((z-cz)*dx-(x-cx)*dz)*inv,tangent:[dx*inv,dz*inv],distance:Math.sqrt(d2)};}}return best;}
}
export function seamRelief(index,x,z,side=1){const q=index.nearest(x,z);if(!q||q.distance>5.8)return{u:0,v:0,w:0,compress:0};const d=q.path.field(q.s,q.d),groove=.024*Math.exp(-((q.d/.48)**2));return{u:d[0]*q.tangent[0]-d[2]*q.tangent[1],v:d[0]*q.tangent[1]+d[2]*q.tangent[0],w:side*(d[1]-groove),compress:Math.max(0,-d[1]/.12)};}
export function makeSewnYarn(path,panel,builder,material){
 const routes=R05_SEW.continuousRoutes(path.model),half=path.t/2,shift=(path.count-1)*path.pitch/2;
 const vertices=[],normals=[],uvs=[],indices=[],bind=[];const sides=builder.config.thumbnail?6:10;let length=0;
 const simplify=(pts)=>{if(pts.length<3)return pts;const a=pts[0],b=pts.at(-1),d=b.map((x,i)=>x-a[i]),ll=d.reduce((s,x)=>s+x*x,0);let max=0,at=0;for(let i=1;i<pts.length-1;i++){const p=pts[i],f=clamp(p.reduce((s,x,j)=>s+(x-a[j])*d[j],0)/Math.max(1e-20,ll),0,1),e=p.reduce((s,x,j)=>s+(x-a[j]-f*d[j])**2,0);if(e>max){max=e;at=i;}}if(max<(builder.config.thumbnail?.012:.004)**2)return[a,b];return [...simplify(pts.slice(0,at+1)).slice(0,-1),...simplify(pts.slice(at))];};
 for(const route of routes){const compressed=simplify(route.points),samples=[compressed[0]];for(let j=1;j<compressed.length;j++){const a=compressed[j-1],b=compressed[j],n=Math.max(1,Math.ceil(Math.hypot(...b.map((x,i)=>x-a[i]))/(builder.config.thumbnail?1.4:.7)));for(let i=1;i<=n;i++)samples.push(a.map((x,k)=>x+(b[k]-x)*i/n));}
  const mapped=samples.map(p=>{const s=p[0]+shift,v=p[2]+5,fr=path.frame(s,v),field=path.field(s,v);fr.uv.addScaledVector(fr.tangent,field[0]/fr.metric.u).addScaledVector(fr.perp,field[2]/fr.metric.v);let y=p[1];const a=Math.abs(y),f=clamp((a-(half-.12))/.12,0,1);y+=Math.sign(y)*f*(-.35*(a-half)-.019);y+=field[1]*clamp(y/half,-1,1);const normal=panel.normal(fr.uv.x,fr.uv.y),p3=panel.map(fr.uv.x,fr.uv.y).addScaledVector(normal,y+path.center);return{p:p3,n:normal,uv:fr.uv};});
  const start=vertices.length/3;
  for(let i=0;i<mapped.length;i++){const q=mapped[i],t=mapped[Math.min(i+1,mapped.length-1)].p.clone().sub(mapped[Math.max(0,i-1)].p).normalize(),N=q.n.clone().addScaledVector(t,-q.n.dot(t)).normalize(),B=new T.Vector3().crossVectors(t,N).normalize();if(i)length+=q.p.distanceTo(mapped[i-1].p);
   for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,twist=1+.035*Math.cos(3*a-length/path.diameter*2.4),n=N.clone().multiplyScalar(Math.cos(a)).addScaledVector(B,Math.sin(a)),p=q.p.clone().addScaledVector(N,Math.cos(a)*path.diameter*.215*twist).addScaledVector(B,Math.sin(a)*path.diameter*.52*twist);vertices.push(...p);normals.push(...n);uvs.push(length/(path.diameter*2.7),j/sides);bind.push(builder.binding(panel,q.uv.x,q.uv.y,p,n));if(i<mapped.length-1&&j<sides){const k=start+i*(sides+1)+j;indices.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}}
  }
 }
 const g=builder.geometry(vertices,normals,uvs,indices,bind);g.userData.sewing={threadIdentity:'one continuous thread, two saddle ends',holes:path.holes.length,frontBackPassages:true,r05Audit:R05_SEW.auditSeam(path.model),contact:path.contact.stats,flattenedWaxedYarn:true,displayCylinderCount:0};const mesh=new T.Mesh(g,material);mesh.name='R05_CONTINUOUS_SEWN_YARN/'+path.id;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.thread=true;return mesh;
}
