import {shoeLast} from './design-envelope.mjs';
import * as T from 'three';
const PI=Math.PI,TAU=PI*2,V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=T.MathUtils.clamp,lerp=T.MathUtils.lerp;
export const STYLES=[
 {id:'derby',name:'德比皮鞋',en:'01 / CAP-TOE DERBY',desc:'开放式系带 · 帽头 · 沿条',material:'smooth',colour:'#683920',sole:.017,collar:.072,opening:.59,lace:true,cap:true},
 {id:'loafer',name:'便士乐福鞋',en:'02 / PENNY LOAFER',desc:'围盖缝线 · 镂空鞍带 · 内衬',material:'suede',colour:'#996344',sole:.015,collar:.067,opening:.52,loafer:true},
 {id:'sneaker',name:'低帮休闲鞋',en:'03 / COURT LOW',desc:'杯形橡胶底 · 衬垫 · 编织鞋带',material:'grain',colour:'#c4bca9',sole:.027,collar:.078,opening:.60,lace:true,sneaker:true},
 {id:'chelsea',name:'切尔西短靴',en:'04 / CHELSEA BOOT',desc:'弹性侧片 · 后提环 · 独立鞋跟',material:'smooth',colour:'#191b1e',sole:.019,collar:.18,opening:.42,boot:true},
 {id:'sandal',name:'双带便凉鞋',en:'05 / TWO-STRAP SLIDE',desc:'独立厚鞋带 · 金属扣 · 软木足床',material:'grain',colour:'#4d2025',sole:.023,collar:.07,opening:.6,sandal:true},
 {id:'wholecut',name:'整片式系带鞋',en:'06 / WHOLECUT',desc:'连续鞋面 · 隐藏式收边 · 细鞋带',material:'patent',colour:'#253d4b',sole:.015,collar:.071,opening:.58,lace:true,wholecut:true}
];

function weldAngularNormals(g,nu,nv,layers=1){
 const pos=g.attributes.position,n=g.attributes.normal,N=(nu+1)*(nv+1);
 for(let layer=0;layer<layers;layer++)for(let j=0;j<=nv;j++){
  const a=layer*N+j*(nu+1),b=a+nu,pa=V().fromBufferAttribute(pos,a),pb=V().fromBufferAttribute(pos,b);
  if(pa.distanceTo(pb)<1e-7){const v=V().fromBufferAttribute(n,a).add(V().fromBufferAttribute(n,b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}
 }
 return g;
}
function cappedLast(S,material){
 const nu=120,nv=36,g=paramGeometry((u,v)=>S.surf(u*TAU,v),nu,nv,[.7,.15]);
 const p=Array.from(g.attributes.position.array),uv=Array.from(g.attributes.uv.array),idx=Array.from(g.index.array);
 for(const ring of [0,nv]){const points=Array.from({length:nu+1},(_,i)=>S.surf(i/nu*TAU,ring/nv)),c=points.slice(0,nu).reduce((a,b)=>a.add(b),V()).multiplyScalar(1/nu),base=p.length/3;p.push(...c.toArray());uv.push(.5,.5);for(const v of points){p.push(...v.toArray());uv.push(v.x/S.W+.5,v.z/S.L);}for(let i=0;i<nu;i++){if(ring===0)idx.push(base,base+i+2,base+i+1);else idx.push(base,base+i+1,base+i+2);}}
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.deleteAttribute('normal');g.computeVertexNormals();weldAngularNormals(g,nu,nv);return makeMesh(g,material,'封口的视觉设计鞋楦');
}

function interp(knots,s){s=clamp(s,0,1);for(let i=1;i<knots.length;i++)if(s<=knots[i][0]){const[a,x]=knots[i-1],[b,y]=knots[i],t=(s-a)/(b-a);return lerp(x,y,t*t*(3-2*t));}return knots.at(-1)[1];}
function paramGeometry(fn,nu,nv,uvScale=[.65,.12]){
 const p=[],uv=[],idx=[];for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){p.push(...fn(i/nu,j/nv).toArray());uv.push(i/nu*uvScale[0],j/nv*uvScale[1]);}
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;idx.push(a,b,c,b,d,c);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();weldAngularNormals(g,nu,nv);return g;
}
function volumize(g,nu,nv,thickness){
 const a=g.attributes.position.array,n=g.attributes.normal.array,uv=g.attributes.uv.array,N=a.length/3,p=Array.from(a),u=Array.from(uv),idx=Array.from(g.index.array),outside=idx.length;
 for(let i=0;i<a.length;i++)p.push(a[i]-n[i]*thickness);u.push(...uv);
 const inn=[];for(let i=0;i<outside;i+=3)inn.push(idx[i]+N,idx[i+2]+N,idx[i+1]+N);idx.push(...inn);
 const ring=[];for(let i=0;i<nu;i++)ring.push([i,i+1]);for(let i=0;i<nu;i++)ring.push([nv*(nu+1)+i+1,nv*(nu+1)+i]);
 // The duplicated angular seam is position-identical. The two collar/base rings
 // join outer/inner surfaces; no Paper-thin DoubleSide substitute is used.
 for(const[a,b]of ring)idx.push(a,a+N,b,b,a+N,b+N);
 const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(p,3));out.setAttribute('uv',new T.Float32BufferAttribute(u,2));out.setIndex(idx);out.clearGroups();out.addGroup(0,outside,0);out.addGroup(outside,idx.length-outside,1);out.computeVertexNormals();weldAngularNormals(out,nu,nv,2);g.dispose();return out;
}
function solidPatch(fn,nu,nv,thickness=.0018){const g=paramGeometry(fn,nu,nv,[.1,.07]);const a=g.attributes.position.array,n=g.attributes.normal.array,N=a.length/3,p=Array.from(a),uv=Array.from(g.attributes.uv.array),idx=Array.from(g.index.array),outside=idx.length;for(let i=0;i<a.length;i++)p.push(a[i]-n[i]*thickness);uv.push(...g.attributes.uv.array);for(let i=0;i<outside;i+=3)idx.push(idx[i]+N,idx[i+2]+N,idx[i+1]+N);const edges=[];for(let i=0;i<nu;i++){edges.push([i,i+1],[nv*(nu+1)+i+1,nv*(nu+1)+i]);}for(let j=0;j<nv;j++){edges.push([(j+1)*(nu+1),j*(nu+1)],[j*(nu+1)+nu,(j+1)*(nu+1)+nu]);}for(const[a,b]of edges)idx.push(a,a+N,b,b,a+N,b+N);const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(p,3));out.setAttribute('uv',new T.Float32BufferAttribute(uv,2));out.setIndex(idx);out.computeVertexNormals();g.dispose();return out;}
function makeMesh(geo,mat,name){const m=new T.Mesh(geo,mat);m.name=name;m.castShadow=true;m.receiveShadow=true;return m;}
function curve(points,closed=false){return new T.CatmullRomCurve3(points,closed,'centripetal');}
function tube(points,r,mat,name,closed=false,flat=1){const c=curve(points,closed),segments=Math.max(16,points.length*6),g=new T.TubeGeometry(c,segments,r,8,closed);if(flat!==1){const frames=c.computeFrenetFrames(segments,closed),a=g.attributes.position;for(let i=0;i<=segments;i++){const center=c.getPointAt(i/segments);for(let j=0;j<=8;j++){const angle=j/8*TAU,p=center.clone().addScaledVector(frames.normals[i],r*Math.cos(angle)).addScaledVector(frames.binormals[i],r*Math.sin(angle)*flat);a.setXYZ(i*9+j,p.x,p.y,p.z);}}g.computeVertexNormals();}return makeMesh(g,mat,name);}
function stitches(points,material,spacing=.0032,r=.00022){
 const c=curve(points),length=c.getLength(),count=Math.max(2,Math.floor(length/spacing));const inst=new T.InstancedMesh(new T.CylinderGeometry(r,r,1,6,1),material,count),q=new T.Quaternion(),mat=new T.Matrix4(),up=V(0,1,0);
 for(let i=0;i<count;i++){const a=c.getPointAt((i+.1)/count),b=c.getPointAt((i+.78)/count),dir=b.clone().sub(a),mid=a.clone().add(b).multiplyScalar(.5);q.setFromUnitVectors(up,dir.clone().normalize());mat.compose(mid,q,V(1,dir.length(),1));inst.setMatrixAt(i,mat);}inst.instanceMatrix.needsUpdate=true;inst.name='等距实体缝线';inst.castShadow=true;inst.receiveShadow=true;return inst;
}
export {shoeLast} from './design-envelope.mjs';
export function createShoe(foot,style,pal,fit={}){
 const S=shoeLast(foot,style,fit),{L,W,scale,bottom,boundary,surf}=S,root=new T.Group();root.name=style.id+'_'+foot.side;
 const components={};function part(key,label){const g=new T.Group();g.name=label;g.userData.component=key;root.add(g);components[key]=g;return g;}
 const outsole=part('outsole','外底与跟'),welt=part('welt','沿条与底线'),upper=part('upper','鞋面与分片'),lining=part('lining','内衬与足床'),hardware=part('hardware','鞋带与五金'),seams=part('seams','针脚与收边');
 function pathOn(t0,t1,v,off=.00065){return Array.from({length:90},(_,i)=>{const p=surf(lerp(t0,t1,i/89),v);p.y+=off;return p;});}
 // Bevelled sole: real multi-ring sidewall, sole/heel separation and shank relief.
 const levels=[[0,.0000,.00],[.10,.0009,.01],[.24,.0020,.06],[.8,.0025,.90],[1,.0010,1]];
 const soleGeo=paramGeometry((u,v)=>{const t=u*TAU,si=(Math.cos(t)+1)/2,a=v*(levels.length-1),i=Math.min(levels.length-2,Math.floor(a)),k=a-i;const extra=lerp(levels[i][1],levels[i+1][1],k)*scale,p=boundary(t,extra);
 const cut=style.sneaker||style.sandal?0:.008*scale*Math.exp(-Math.pow((si-.32)/.17,6));p.y=lerp(cut+.001*scale,bottom-.002*scale,v);return p;},180,12,[.72,bottom]);
 outsole.add(makeMesh(soleGeo,style.sneaker?pal.cupsole:style.sandal?pal.leatherSole:pal.sole,'倒角外底侧墙'));
 // Planar insole/sole faces use a triangle fan over the same parametric outline.
 function footprint(y,extra,mat,name){const points=[V(0,y,.47*L)];for(let i=0;i<=180;i++){const p=boundary(i/180*TAU,extra);p.y=y;points.push(p);}const p=points.flatMap(v=>v.toArray()),uv=points.flatMap(v=>[(v.x+W/2)/W,v.z/L]),idx=[];for(let i=1;i<=180;i++){if(name==='完整足床')idx.push(0,i,i+1);else idx.push(0,i+1,i);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return makeMesh(g,mat,name);}
 outsole.add(footprint(.001*scale,.001*scale,style.sneaker?pal.sole:pal.leatherSole,'外底底面'));
 lining.add(footprint(bottom+.0005,-.002*scale,pal.lining,'完整足床'));
 const weltPath=Array.from({length:181},(_,i)=>{const p=boundary(i/180*TAU,.002*scale);p.y=bottom-.001*scale;return p;});
 welt.add(tube(weltPath,.0014*scale,style.sneaker?pal.cupsole:pal.leatherSole,'立体沿条',true,.75));
 const needle=weltPath.map(p=>p.clone().add(V(0,.0013*scale,0)));welt.add(stitches(needle,pal.thread,.0033*scale,.00022*scale));
 const sideLine=Array.from({length:181},(_,i)=>{const p=boundary(i/180*TAU,.0028*scale);p.y=bottom*(style.sneaker?.43:.55);return p;});welt.add(tube(sideLine,.00032*scale,style.sneaker?pal.thread:pal.edge,'外底分层线',true));
 // Undersole traction remains geometry rather than a flat painted sole.
 const treadMat=style.sneaker?pal.sole:pal.dark;
 for(let j=0;j<18;j++){const z=L*(.08+j*.047),w=S.width(z/L)*1.62;if(w<.01)continue;const g=new T.BoxGeometry(w,.0007*scale,.0011*scale),m=makeMesh(g,treadMat,'底面防滑沟');m.position.set(S.center(z/L),.0001*scale,z);m.rotation.y=(j%2?1:-1)*.08;outsole.add(m);}
 if(!style.sneaker&&!style.sandal){
  const heel=footprint(.0002*scale,.001*scale,pal.dark,'后跟接地面');
  const idx=[];const pos=heel.geometry.attributes.position;for(let i=0;i<heel.geometry.index.count;i+=3){const vs=[0,1,2].map(k=>heel.geometry.index.array[i+k]);if(vs.slice(1).every(k=>pos.getZ(k)<L*.26))idx.push(...vs);}heel.geometry.setIndex(idx);outsole.add(heel);
 }
 if(!style.sandal){
  const shell=volumize(paramGeometry((u,v)=>surf(u*TAU,v),180,40,[2*L+2*W,.14*scale]),180,40,.0018*scale);
  const colors=[];const pa=shell.attributes.position;for(let k=0;k<pa.count;k++){const z=pa.getZ(k)/L,amount=style.sneaker?1:(1-.25*Math.exp(-Math.pow((z-.95)/.18,2))-.10*Math.exp(-Math.pow((z-.04)/.16,2)));colors.push(amount,amount,amount);}shell.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const shellMat=pal.skin.clone();shellMat.vertexColors=true;root.userData.extraMaterials=[shellMat];upper.add(makeMesh(shell,[shellMat,pal.lining],'有厚度的连续鞋面'));
  const rim=pathOn(0,TAU,1,.0002*scale);seams.add(tube(rim,(style.sneaker?.0024:.0011)*scale,style.sneaker?pal.skin:pal.edge,'鞋口包边',true));
  seams.add(stitches(pathOn(0,TAU,.965,.0007*scale),pal.thread,.0032*scale,.00019*scale));
  if(!style.wholecut){
   for(const t of [1.95,TAU-1.95]){
    const p=Array.from({length:45},(_,i)=>{const v=i/44*.95;const q=surf(t+.13*Math.sin(v*PI),v);q.y+=.00065*scale;return q;});seams.add(tube(p,.00045*scale,pal.edge,'分片压边'));seams.add(stitches(p.map(p=>p.clone().add(V(.0015*(t<PI?1:-1)*scale,.00035*scale,0))),pal.thread,.0031*scale));
   }
  }
  const back=Array.from({length:35},(_,i)=>{const p=surf(PI,i/34);p.z-=.0007*scale;return p;});seams.add(stitches(back,pal.thread,.0032*scale));
  if(style.cap){
   const contour=offset=>Array.from({length:100},(_,i)=>{const u=i/99*2-1,z=L*.79+offset+.0028*scale*(1-u*u),x=S.center(z/L)+S.width(z/L)*u*.985;return V(x,S.upperAt(x,z)+.0007*scale,z);});
   seams.add(tube(contour(0),.00042*scale,pal.edge,'帽头拼接边'));
   for(const off of [-.0018,-.0043])seams.add(stitches(contour(off*scale),pal.thread,.0031*scale,.00017*scale));
  }
 }
 if(style.lace){
  const z0=L*.71,z1=L*.46,tw=.018*scale;
  const tongueFn=(u,v)=>{const z=lerp(z0,z1,v),x=(u-.5)*tw*2.04+S.center(z/L);return V(x,S.upperAt(x,z)+.0032*scale,z);};
  upper.add(makeMesh(solidPatch(tongueFn,24,36,.0025*scale),pal.skin,'独立厚鞋舌'));
  seams.add(stitches(Array.from({length:32},(_,i)=>tongueFn(i/31,.97).add(V(0,.0004*scale,0))),pal.thread,.003*scale));
  const endpoints=[[],[]];
  for(const [sid,sign]of [[0,-1],[1,1]]){
   const panel=(u,v)=>{const z=lerp(L*.72,L*.47,v),xin=sign*tw,xout=sign*(tw+.013*scale+.006*scale*Math.sin(v*PI)),x=lerp(xout,xin,u)+S.center(z/L),y=S.upperAt(x,z)+.0050*scale;return V(x,y,z);};
   upper.add(makeMesh(solidPatch(panel,8,40,.0018*scale),pal.skin,'系带耳片'));
   const seam=Array.from({length:48},(_,i)=>panel(.1,i/47).add(V(0,.00065*scale,0)));seams.add(stitches(seam,pal.thread,.0032*scale));
   const n=style.sneaker?6:5;
   for(let j=0;j<n;j++){
    const p=panel(.72,.09+j/(n-1)*.79).add(V(0,.0009*scale,0));endpoints[sid].push(p);
    const eye=makeMesh(new T.TorusGeometry(.0018*scale,.00043*scale,8,16),style.wholecut?pal.edge:pal.metal,'金属鞋眼');eye.rotation.x=-PI/2;eye.position.copy(p);hardware.add(eye);
    const socket=makeMesh(new T.CylinderGeometry(.00136*scale,.00136*scale,.0008*scale,16),pal.dark,'鞋眼内侧');socket.position.copy(p).add(V(0,-.0003*scale,0));hardware.add(socket);
   }
  }
  const radius=(style.sneaker?.0019:.00105)*scale;
  for(let i=0;i<endpoints[0].length-1;i++)for(let sid=0;sid<2;sid++){
   const a=endpoints[sid][i].clone(),b=endpoints[1-sid][i+1].clone();const mid=a.clone().lerp(b,.5);mid.y=Math.max(a.y,b.y)+(.0032+(sid?.0013:0))*scale;hardware.add(tube([a,a.clone().lerp(mid,.4).add(V(0,.001*scale,0)),mid,b.clone().lerp(mid,.4).add(V(0,.001*scale,0)),b],radius,pal.lace,'交叉编织鞋带',false,style.sneaker?.33:.65));
  }
  const end=endpoints[0].at(-1).clone().lerp(endpoints[1].at(-1),.5);end.y+=.005*scale;
  for(const side of [-1,1]){
   const loop=[end.clone(),end.clone().add(V(side*.010*scale,.004*scale,-.002*scale)),end.clone().add(V(side*.025*scale,.007*scale,.004*scale)),end.clone().add(V(side*.021*scale,.005*scale,.013*scale)),end.clone().add(V(side*.008*scale,.001*scale,.008*scale)),end.clone()];hardware.add(tube(loop,radius,pal.lace,'系结鞋带环',false,style.sneaker?.38:.7));
   const tail=[end.clone(),end.clone().add(V(side*.008*scale,.002*scale,.009*scale)),end.clone().add(V(side*.014*scale,-.005*scale,.027*scale))];hardware.add(tube(tail,radius,pal.lace,'鞋带自由端',false,style.sneaker?.38:.7));
  }
  hardware.add(tube([end.clone().add(V(-.002*scale,0,-.002*scale)),end.clone().add(V(0,.002*scale,0)),end.clone().add(V(.002*scale,0,.002*scale))],radius*1.4,pal.lace,'鞋带结'));
 }
 if(style.loafer){
  const p=pathOn(-1.73,1.73,.69,.0015*scale);seams.add(tube(p,.0010*scale,pal.edge,'围盖凸起缝'));seams.add(stitches(pathOn(-1.73,1.73,.72,.0016*scale),pal.thread,.0031*scale,.00025*scale));
  const saddle=(u,v)=>{const z=L*(.59+(v-.5)*.09),x=S.center(z/L)+(u-.5)*S.width(z/L)*1.82;return V(x,S.upperAt(x,z)+.003*scale,z);};
  const patches=[[0,.34,0,1],[.66,1,0,1],[.34,.66,0,.35],[.34,.66,.65,1]];
  for(const[a,b,c,d]of patches)upper.add(makeMesh(solidPatch((u,v)=>saddle(lerp(a,b,u),lerp(c,d,v)),12,5,.002*scale),pal.skin,'镂空便士鞍带'));
  for(const v of [.05,.95])seams.add(stitches(Array.from({length:55},(_,i)=>saddle(i/54,v).add(V(0,.0005*scale,0))),pal.thread,.0032*scale));
 }
 if(style.boot){
  for(const c of [PI/2,PI*1.5]){
   const gore=(u,v)=>{const theta=c+(u-.5)*.80*(1-.18*v),vv=.51+v*.42,p=surf(theta,vv);p.x+=Math.sign(Math.sin(c))*.0013*scale;return p;};
   upper.add(makeMesh(solidPatch(gore,22,28,.0015*scale),pal.elastic,'弹性侧嵌片'));
   const border=[...Array.from({length:24},(_,i)=>gore(i/23,0)),...Array.from({length:24},(_,i)=>gore(1,i/23)),...Array.from({length:24},(_,i)=>gore(1-i/23,1)),...Array.from({length:24},(_,i)=>gore(0,1-i/23))];seams.add(stitches(border,pal.thread,.0032*scale));
  }
  const a=surf(PI,.90),b=surf(PI,1);hardware.add(tube([a,b.clone().add(V(0,.017*scale,0)),b.clone().add(V(0,.014*scale,-.010*scale)),a.clone().add(V(0,0,-.006*scale))],.0035*scale,pal.edge,'后提环',false,.45));
 }
 if(style.sneaker){
  const collar=Array.from({length:130},(_,i)=>{const p=surf(lerp(.85,TAU-.85,i/129),.97);p.y+=.001*scale;return p;});lining.add(tube(collar,.0032*scale,pal.lining,'鞋口柔软衬垫'));
  const backPatch=(u,v)=>{const p=surf(PI+(u-.5)*.75,.57+v*.39);p.z-=.0012*scale;return p;};upper.add(makeMesh(solidPatch(backPatch,22,16,.0016*scale),pal.edge,'后跟补强片'));
 }
 if(style.sandal){
  for(const [z,span]of [[L*.73,.040*scale],[L*.49,.038*scale]]){
   const strap=(u,v)=>{const zz=z+(v-.5)*span,s=zz/L,x=S.center(s)+(u-.5)*S.width(s)*2.08,y=S.upperAt(x,zz)+.0055*scale;return V(x,y,zz);};
   upper.add(makeMesh(solidPatch(strap,44,12,.0032*scale),pal.skin,'独立厚鞋带'));
   for(const v of [.06,.94])seams.add(stitches(Array.from({length:55},(_,i)=>strap(i/54,v).add(V(0,.0008*scale,0))),pal.thread,.0032*scale));
   const on=(u,v)=>strap(u,v).add(V(0,.0023*scale,0));
   const pts=[on(.68,.2),on(.84,.2),on(.84,.8),on(.68,.8)];hardware.add(tube(pts,.0010*scale,pal.metal,'贴合鞋带的闭合金属扣',true));hardware.add(tube([on(.76,.2),on(.76,.8)],.0006*scale,pal.metal,'带扣针'));
  }
  const lip=weltPath.map(p=>p.clone().add(V(0,.004*scale,0)));lining.add(tube(lip,.0023*scale,pal.lining,'足床包边',true,.8));
 }
 const lastGroup=part('last','设计鞋楦');const last=cappedLast(S,pal.wood);lastGroup.add(last);lastGroup.visible=false;
 root.userData={extraMaterials:root.userData.extraMaterials||[],style:style.id,side:foot.side,sourceRevision:'shoe-r01-native',dimensions:{length:L,width:W,upperThickness:.0018*scale,soleHeight:bottom,minimumSampleClearance:S.minimumSampleClearance,roofRange:S.roofRange},components,S};
 return root;
}
export function explodeShoe(shoe,amount=1){const {components:c}=shoe.userData,S=shoe.userData.S;c.outsole.position.y=-.018*amount*S.scale;c.welt.position.y=.009*amount*S.scale;c.lining.position.y=.034*amount*S.scale;c.upper.position.y=.067*amount*S.scale;c.hardware.position.y=.103*amount*S.scale;c.seams.position.y=.067*amount*S.scale;}
export function disposeShoe(group){group.traverse(o=>o.geometry?.dispose());for(const m of group.userData.extraMaterials||[])m.dispose();group.clear();}
