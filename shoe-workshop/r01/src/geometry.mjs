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
function interp(knots,s){s=clamp(s,0,1);for(let i=1;i<knots.length;i++)if(s<=knots[i][0]){const[a,x]=knots[i-1],[b,y]=knots[i],t=(s-a)/(b-a);return lerp(x,y,t*t*(3-2*t));}return knots.at(-1)[1];}
function paramGeometry(fn,nu,nv,uvScale=[.65,.12]){
 const p=[],uv=[],idx=[];for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){p.push(...fn(i/nu,j/nv).toArray());uv.push(i/nu*uvScale[0],j/nv*uvScale[1]);}
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;idx.push(a,b,c,b,d,c);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function volumize(g,nu,nv,thickness){
 const a=g.attributes.position.array,n=g.attributes.normal.array,uv=g.attributes.uv.array,N=a.length/3,p=Array.from(a),u=Array.from(uv),idx=Array.from(g.index.array),outside=idx.length;
 for(let i=0;i<a.length;i++)p.push(a[i]-n[i]*thickness);u.push(...uv);
 const inn=[];for(let i=0;i<outside;i+=3)inn.push(idx[i]+N,idx[i+2]+N,idx[i+1]+N);idx.push(...inn);
 const ring=[];for(let i=0;i<nu;i++)ring.push([i,i+1]);for(let i=0;i<nu;i++)ring.push([nv*(nu+1)+i+1,nv*(nu+1)+i]);
 // The duplicated angular seam is position-identical. The two collar/base rings
 // join outer/inner surfaces; no Paper-thin DoubleSide substitute is used.
 for(const[a,b]of ring)idx.push(a,a+N,b,b,a+N,b+N);
 const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(p,3));out.setAttribute('uv',new T.Float32BufferAttribute(u,2));out.setIndex(idx);out.clearGroups();out.addGroup(0,outside,0);out.addGroup(outside,idx.length-outside,1);out.computeVertexNormals();g.dispose();return out;
}
function solidPatch(fn,nu,nv,thickness=.0018){const g=paramGeometry(fn,nu,nv,[.1,.07]);const a=g.attributes.position.array,n=g.attributes.normal.array,N=a.length/3,p=Array.from(a),uv=Array.from(g.attributes.uv.array),idx=Array.from(g.index.array),outside=idx.length;for(let i=0;i<a.length;i++)p.push(a[i]-n[i]*thickness);uv.push(...g.attributes.uv.array);for(let i=0;i<outside;i+=3)idx.push(idx[i]+N,idx[i+2]+N,idx[i+1]+N);const edges=[];for(let i=0;i<nu;i++){edges.push([i,i+1],[nv*(nu+1)+i+1,nv*(nu+1)+i]);}for(let j=0;j<nv;j++){edges.push([(j+1)*(nu+1),j*(nu+1)],[j*(nu+1)+nu,(j+1)*(nu+1)+nu]);}for(const[a,b]of edges)idx.push(a,a+N,b,b,a+N,b+N);const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(p,3));out.setAttribute('uv',new T.Float32BufferAttribute(uv,2));out.setIndex(idx);out.computeVertexNormals();g.dispose();return out;}
function makeMesh(geo,mat,name){const m=new T.Mesh(geo,mat);m.name=name;m.castShadow=true;m.receiveShadow=true;return m;}
function curve(points,closed=false){return new T.CatmullRomCurve3(points,closed,'centripetal');}
function tube(points,r,mat,name,closed=false,flat=1){const c=curve(points,closed),segments=Math.max(16,points.length*6),g=new T.TubeGeometry(c,segments,r,8,closed);if(flat!==1){const frames=c.computeFrenetFrames(segments,closed),a=g.attributes.position;for(let i=0;i<=segments;i++){const center=c.getPointAt(i/segments);for(let j=0;j<=8;j++){const angle=j/8*TAU,p=center.clone().addScaledVector(frames.normals[i],r*Math.cos(angle)).addScaledVector(frames.binormals[i],r*Math.sin(angle)*flat);a.setXYZ(i*9+j,p.x,p.y,p.z);}}g.computeVertexNormals();}return makeMesh(g,mat,name);}
function stitches(points,material,spacing=.0032,r=.00022){
 const c=curve(points),length=c.getLength(),count=Math.max(2,Math.floor(length/spacing));const inst=new T.InstancedMesh(new T.CylinderGeometry(r,r,1,6,1),material,count),q=new T.Quaternion(),mat=new T.Matrix4(),up=V(0,1,0);
 for(let i=0;i<count;i++){const a=c.getPointAt((i+.1)/count),b=c.getPointAt((i+.78)/count),dir=b.clone().sub(a),mid=a.clone().add(b).multiplyScalar(.5);q.setFromUnitVectors(up,dir.clone().normalize());mat.compose(mid,q,V(1,dir.length(),1));inst.setMatrixAt(i,mat);}inst.instanceMatrix.needsUpdate=true;inst.name='等距实体缝线';inst.castShadow=true;inst.receiveShadow=true;return inst;
}
export function shoeLast(foot,style,fit={}){
 const toe=clamp((fit.toe??12)/1000,.005,.025),ease=clamp((fit.ease??3.8)/1000,.001,.009),instep=clamp((fit.instep??3)/1000,.001,.012);
 const L=foot.length+toe+.004,W=foot.width+2*ease,scale=foot.length/.261,bottom=style.sole*scale;
 const knots=[[0,0],[.025,.36],[.075,.60],[.15,.68],[.27,.66],[.40,.75],[.58,.95],[.71,1],[.81,.93],[.90,.79],[.96,.48],[1,0]];
 function width(s){return .5*W*interp(knots,s);}
 function center(s){return-foot.sign*.0055*scale*Math.exp(-Math.pow((s-.85)/.24,2));}
 function boundary(theta,extra=0){const s=(Math.cos(theta)+1)/2,w=width(s),sg=Math.sin(theta)>=0?1:-1;return V(center(s)+sg*(w+Math.abs(Math.sin(theta))*extra),bottom,s*L);}
 const ankleZ=foot.ankleLocal[2]+.004;
 const openFront=style.opening*L,openBack=Math.max(.004,ankleZ-.050*scale),openCentre=(openFront+openBack)/2,openR=(openFront-openBack)/2;
 const openingW=(style.boot?.041:style.sneaker?.033:.031)*scale+ease*.35;
 // A smoothed lower-foot height envelope is used only under the vamp/tongue.
 const bins=Array.from({length:65},(_,i)=>{const z=i/64*L;const q=foot.samples.filter(p=>Math.abs(p[2]+.004-z)<.007&&p[1]<.12*scale);return q.length?Math.max(...q.map(p=>p[1])):0;});
 function height(s){const k=clamp(s*64,0,63),i=Math.floor(k);return lerp(bins[i],bins[i+1],k-i);}
 function surf(theta,v){
  const b=boundary(theta),front=(Math.cos(theta)+1)/2;
  const o=V(-foot.sign*.0015*scale+openingW*Math.sin(theta),bottom+(style.collar+(style.boot?0:.009*(1-front)))*scale,openCentre+openR*Math.cos(theta));
  const blend=Math.pow(Math.sin(v*PI/2),style.boot?.90:1.15);
  const p=b.clone().lerp(o,blend),exponent=style.boot?lerp(.86,2.28,front):.86;
  p.y=bottom+(o.y-bottom)*Math.pow(Math.sin(v*PI/2),exponent);
  // Statically shaped toe spring and rounded vamp, not dynamic wrinkles.
  p.y+=.004*scale*Math.pow(front,6)*Math.sin(PI*v);
  const s=p.z/L,ax=Math.abs(p.x-center(s));
  if(s>.48&&s<.94&&ax<W*.35&&v>.16&&v<.98){const required=bottom+height(s)+instep;const weight=clamp((W*.40-ax)/(W*.14),0,1);p.y=Math.max(p.y,required*weight+p.y*(1-weight));}
  return p;
 }
 function upperAt(x,z){const s=clamp(z/L,0,1);return bottom+Math.max(.028*scale+.048*scale*Math.exp(-Math.pow((s-.40)/.30,2)),height(s)+instep)+.001;}
 return {L,W,bottom,scale,foot,toe,ease,instep,boundary,surf,width,center,upperAt,ankleZ,openingW};
}
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
 function footprint(y,extra,mat,name){const points=[V(0,y,.47*L)];for(let i=0;i<=180;i++){const p=boundary(i/180*TAU,extra);p.y=y;points.push(p);}const p=points.flatMap(v=>v.toArray()),uv=points.flatMap(v=>[(v.x+W/2)/W,v.z/L]),idx=[];for(let i=1;i<=180;i++)idx.push(0,i+1,i);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return makeMesh(g,mat,name);}
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
  upper.add(makeMesh(shell,[pal.skin,pal.lining],'有厚度的连续鞋面'));
  const rim=pathOn(0,TAU,1,.0002*scale);seams.add(tube(rim,(style.sneaker?.0024:.0011)*scale,style.sneaker?pal.skin:pal.edge,'鞋口包边',true));
  seams.add(stitches(pathOn(0,TAU,.965,.0007*scale),pal.thread,.0032*scale,.00019*scale));
  if(!style.wholecut){
   for(const t of [1.95,TAU-1.95]){
    const p=Array.from({length:45},(_,i)=>{const v=i/44*.95;const q=surf(t+.13*Math.sin(v*PI),v);q.y+=.00065*scale;return q;});seams.add(tube(p,.00045*scale,pal.edge,'分片压边'));seams.add(stitches(p.map(p=>p.clone().add(V(.0015*(t<PI?1:-1)*scale,.00035*scale,0))),pal.thread,.0031*scale));
   }
  }
  const back=Array.from({length:35},(_,i)=>{const p=surf(PI,i/34);p.z-=.0007*scale;return p;});seams.add(stitches(back,pal.thread,.0032*scale));
  if(style.cap){
   const p=pathOn(-1.57,1.57,.50,.0008*scale);seams.add(tube(p,.0005*scale,pal.edge,'帽头拼接边'));seams.add(stitches(pathOn(-1.57,1.57,.515,.0011*scale),pal.thread,.0031*scale));seams.add(stitches(pathOn(-1.57,1.57,.545,.0011*scale),pal.thread,.0031*scale));
  }
 }
 if(style.lace){
  const z0=L*.69,z1=L*.355,tw=.021*scale,throat=(z)=>S.upperAt(0,z)+.002*scale;
  const tongueFn=(u,v)=>{const z=lerp(z0,z1,v),x=(u-.5)*tw*2.04;return V(x,throat(z)+.0022*scale*Math.cos((u-.5)*PI),z);};
  upper.add(makeMesh(solidPatch(tongueFn,24,36,.0025*scale),pal.skin,'独立厚鞋舌'));
  seams.add(stitches(Array.from({length:32},(_,i)=>tongueFn(i/31,.97).add(V(0,.0004*scale,0))),pal.thread,.003*scale));
  const endpoints=[[],[]];
  for(const [sid,sign]of [[0,-1],[1,1]]){
   const panel=(u,v)=>{const z=lerp(L*.70,L*.38,v),xin=sign*tw,xout=sign*(tw+.013*scale+.006*scale*Math.sin(v*PI)),x=lerp(xout,xin,u),y=throat(z)+.0015*scale-.009*scale*Math.pow(1-u,1.5);return V(x,y,z);};
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
  const saddle=(u,v)=>{const x=(u-.5)*W*.89,z=L*(.59+(v-.5)*.09);return V(x,S.upperAt(x,z)-.020*scale*Math.pow(Math.abs(x)/(W*.46),2)+.003*scale,z);};
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
  for(const [z,span]of [[L*.69,.040*scale],[L*.39,.038*scale]]){
   const strap=(u,v)=>{const x=(u-.5)*W*.98,s=z/L,w=S.width(s);const y=bottom+.005*scale+(S.upperAt(0,z)-bottom+.003*scale)*Math.pow(Math.max(0,1-Math.pow(x/(w+.004*scale),2)),.52);return V(x,y,z+(v-.5)*span);};
   upper.add(makeMesh(solidPatch(strap,44,12,.0032*scale),pal.skin,'独立厚鞋带'));
   for(const v of [.06,.94])seams.add(stitches(Array.from({length:55},(_,i)=>strap(i/54,v).add(V(0,.0008*scale,0))),pal.thread,.0032*scale));
   const buckle=strap(.78,.5).add(V(0,.002*scale,0)),w=.018*scale,h=.021*scale;
   const pts=[V(-w/2,0,-h/2),V(w/2,0,-h/2),V(w/2,0,h/2),V(-w/2,0,h/2)].map(p=>p.add(buckle));hardware.add(tube(pts,.0010*scale,pal.metal,'闭合金属带扣',true));hardware.add(tube([buckle.clone().add(V(0,.001*scale,-h/2)),buckle.clone().add(V(0,.002*scale,h/2))],.0006*scale,pal.metal,'带扣针'));
  }
  const lip=weltPath.map(p=>p.clone().add(V(0,.004*scale,0)));lining.add(tube(lip,.0023*scale,pal.lining,'足床包边',true,.8));
 }
 const lastGroup=part('last','设计鞋楦');const last=makeMesh(volumize(paramGeometry((u,v)=>surf(u*TAU,v),120,26,[.7,.13]),120,26,.0018*scale),pal.wood,'参数化鞋楦包络');lastGroup.add(last);lastGroup.visible=false;
 root.userData={style:style.id,side:foot.side,sourceRevision:'shoe-r01-native',dimensions:{length:L,width:W,upperThickness:.0018*scale,soleHeight:bottom},components,S};
 return root;
}
export function explodeShoe(shoe,amount=1){const {components:c}=shoe.userData,S=shoe.userData.S;c.outsole.position.y=-.018*amount*S.scale;c.welt.position.y=.009*amount*S.scale;c.lining.position.y=.034*amount*S.scale;c.upper.position.y=.067*amount*S.scale;c.hardware.position.y=.103*amount*S.scale;c.seams.position.y=.067*amount*S.scale;}
export function disposeShoe(group){group.traverse(o=>o.geometry?.dispose());group.clear();}
