import * as T from 'three';
/* R06: original dimensioned leather goods. Units are millimetres.
 * These are constructed product geometries, NOT a solved garment simulation.
 * Belt/card-holder patterns and 3D geometry share the same specifications.
 */
export const PRODUCT_SPECS = Object.freeze({
 wallet:{name:'三层卡包',en:'THE CARD HOLDER',w:108,h:76,t:1.2,r:6,pitch:3.4,edge:4.2,defaultMaterial:'heritage',subtitle:'真实开口 · 三层裁片 · 贯穿针孔',size:'108 × 76 mm · 1.2 mm 皮厚'},
 belt:{name:'黄铜扣腰带',en:'THE BRASS BELT',w:35,l:1100,t:3.2,r:7,pitch:4.0,defaultMaterial:'wax',subtitle:'弧形皮带 · 实体扣具 · 五档贯穿孔',size:'1100 × 35 mm · 3.2 mm 皮厚'},
 bag:{name:'翻盖肩包',en:'THE SADDLE BAG',w:240,h:185,d:72,t:2.0,defaultMaterial:'cross',subtitle:'前后裁片 · 侧围 · 翻盖 · 提带',size:'240 × 185 × 72 mm · 2.0 mm 皮厚'},
 hat:{name:'六片皮帽',en:'THE FIELD CAP',rx:88,rz:102,h:75,t:1.4,defaultMaterial:'nubuck',subtitle:'开放帽腔 · 六片帽冠 · 弧形帽檐',size:'椭圆帽口 176 × 204 mm · 1.4 mm 皮厚'},
 swatch:{name:'皮料近观',en:'THE MATERIAL STUDY',w:105,h:84,t:1.4,defaultMaterial:'heritage',subtitle:'粒面、背面与切边，同一块三维皮样',size:'105 × 84 mm · 1.4 mm 皮厚'}
});
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const TAU=Math.PI*2;
export function roundShape(w,h,r=5){
 const s=new T.Shape(),x=-w/2,y=-h/2;
 s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
}
function circleHole(s,x,y,r){const h=new T.Path();h.absarc(x,y,r,0,TAU,true);s.holes.push(h);}
function tube(points,r,mat,parent,closed=false,segments=null){
 const curve=new T.CatmullRomCurve3(points.map(p=>p.isVector3?p:V(...p)),closed,'centripetal');
 const mesh=new T.Mesh(new T.TubeGeometry(curve,segments??Math.max(20,points.length*5),r,8,closed),mat);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function cube(w,h,d,mat,parent,x=0,y=0,z=0,bevel=.4){
 const s=roundShape(w,h,Math.min(bevel,w/4,h/4));const g=panelGeometry(s,d);const m=new T.Mesh(g,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;
}
/** Closed, bevelled panel with distinct grain/flesh/cut material groups. */
export function panelGeometry(shape,t,bevel=.16){
 const b=Math.min(t*.18,bevel),depth=t-2*b;const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSegments:2,steps:1,bevelThickness:b,bevelSize:b,bevelOffset:-b,curveSegments:10});
 g.translate(0,0,-depth/2);const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;g.clearGroups();
 let last=-1,begin=0;for(let i=0;i<p.count;i+=3){const nz=(n.getZ(i)+n.getZ(i+1)+n.getZ(i+2))/3;const k=nz>.98?0:nz<-.98?1:2;if(k!==last){if(last!==-1)g.addGroup(begin,i-begin,last);begin=i;last=k;}for(let j=0;j<3;j++)u.setXY(i+j,p.getX(i+j)/96,p.getY(i+j)/96);}g.addGroup(begin,p.count-begin,last);g.computeBoundingSphere();return g;
}
/** Subdivide long panel triangles before a curved isometric placement. */
function bendPanel(geometry,map,maxEdge=9,reverse=false){
 const P=geometry.attributes.position,N=geometry.attributes.normal,UV=geometry.attributes.uv;
 const outP=[],outN=[],outUV=[],outG=[];
 function emit(a,b,c,material,depth){
  const mix=(a,b,t)=>({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),uv:a.uv.clone().lerp(b.uv,t)});
  const clip=(poly,x,lower)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ina=lower?a.p.x>=x-1e-8:a.p.x<=x+1e-8,inb=lower?b.p.x>=x-1e-8:b.p.x<=x+1e-8;if(ina)out.push(a);if(ina!==inb)out.push(mix(a,b,(x-a.p.x)/(b.p.x-a.p.x)));}return out;};
  const min=Math.min(a.p.x,b.p.x,c.p.x),max=Math.max(a.p.x,b.p.x,c.p.x),first=Math.floor(min/maxEdge),last=Math.floor(max/maxEdge);
  for(let bin=first;bin<=last;bin++){let poly=clip(clip([a,b,c],bin*maxEdge,true),(bin+1)*maxEdge,false);for(let i=1;i<poly.length-1;i++){const tri=reverse?[poly[0],poly[i+1],poly[i]]:[poly[0],poly[i],poly[i+1]];const q=tri.map(v=>map(v.p,v.n));const area=q[1].p.clone().sub(q[0].p).cross(q[2].p.clone().sub(q[0].p)).lengthSq();if(area<1e-14)continue;for(let j=0;j<3;j++){outP.push(...q[j].p);outN.push(...q[j].n);outUV.push(tri[j].uv.x,tri[j].uv.y);}outG.push(material);}}
 }
 for(const group of geometry.groups)for(let i=group.start;i<group.start+group.count;i+=3){const v=[];for(let j=0;j<3;j++)v.push({p:V(P.getX(i+j),P.getY(i+j),P.getZ(i+j)),n:V(N.getX(i+j),N.getY(i+j),N.getZ(i+j)),uv:new T.Vector2(UV.getX(i+j),UV.getY(i+j))});emit(...v,group.materialIndex,0);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(outP,3));g.setAttribute('normal',new T.Float32BufferAttribute(outN,3));g.setAttribute('uv',new T.Float32BufferAttribute(outUV,2));
 let start=0,last=outG[0];for(let i=1;i<=outG.length;i++)if(i===outG.length||outG[i]!==last){g.addGroup(start*3,(i-start)*3,last);start=i;last=outG[i];}g.computeBoundingSphere();geometry.dispose();return g;
}
/** Two-sided shell; back/edge are real surfaces, not DoubleSide masking. */
export function shell(fn,nu,nv,thickness,physicalU,physicalV,flip=false){
 const P=[],N=[],U=[],I=[];const norm=(u,v)=>{let a=fn(Math.min(1,u+.0001),v).sub(fn(Math.max(0,u-.0001),v)),b=fn(u,Math.min(1,v+.0001)).sub(fn(u,Math.max(0,v-.0001)));const n=a.cross(b).normalize();if(n.lengthSq()<.2)n.set(0,1,0);return n.multiplyScalar(flip?-1:1);};
 for(let side=0;side<2;side++)for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const u=i/nu,v=j/nv,n=norm(u,v),p=fn(u,v).addScaledVector(n,(side?-1:1)*thickness/2);P.push(...p);N.push(...n.clone().multiplyScalar(side?-1:1));U.push(u*physicalU/96,v*physicalV/96);}
 const count=(nu+1)*(nv+1);let start=0;const g=new T.BufferGeometry();
 for(let side=0;side<2;side++){start=I.length;for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=side*count+j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;if(Boolean(side)!==flip)I.push(a,c,b,b,c,d);else I.push(a,b,c,b,d,c);}g.addGroup(start,I.length-start,side);}
 const perimeter=[];for(let i=0;i<=nu;i++)perimeter.push(i);for(let j=1;j<=nv;j++)perimeter.push(j*(nu+1)+nu);for(let i=nu-1;i>=0;i--)perimeter.push(nv*(nu+1)+i);for(let j=nv-1;j>0;j--)perimeter.push(j*(nu+1));
 start=I.length;for(let j=0;j<perimeter.length;j++){const a=perimeter[j],b=perimeter[(j+1)%perimeter.length],q=[a,b,b+count,a+count],k=P.length/3;let ps=q.map(id=>V(...P.slice(id*3,id*3+3)));if(flip)ps.reverse();let normal=ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0])).normalize();for(let v of ps){P.push(...v);N.push(...normal);U.push(v.x/96,v.y/96);}I.push(k,k+2,k+1,k,k+3,k+2);for(let h=k*3;h<N.length;h++)N[h]*=-1;}
 g.addGroup(start,I.length-start,2);g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setIndex(I);g.computeBoundingSphere();return g;
}
function surface(g,mats,parent,name='leather'){const o=new T.Mesh(g,mats);o.name=name;o.castShadow=o.receiveShadow=true;o.userData.leather=true;parent.add(o);return o;}
function stitchSegments(points,mat,parent,pitch=3.4,r=.18,closed=false){
 const curve=new T.CatmullRomCurve3(points.map(p=>p.isVector3?p:V(...p)),closed,'centripetal');const L=curve.getLength(),count=Math.max(2,Math.floor(L/pitch));
 const g=new T.CylinderGeometry(r,r,1,6),m=new T.InstancedMesh(g,mat,count);const dummy=new T.Object3D(),axis=V(0,1,0);
 for(let i=0;i<count;i++){const a=curve.getPointAt(i/count),b=curve.getPointAt(Math.min(1,(i+.70)/count)),dir=b.clone().sub(a);dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(axis,dir.clone().normalize());dummy.scale.set(1,dir.length(),1);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);}m.instanceMatrix.needsUpdate=true;m.castShadow=true;m.name='PRODUCT_STITCH_VISUAL_NOT_THREAD_FORCE_SOLVE';parent.add(m);return m;
}
function logo(parent,mat,w=25,pos=V(),rotation=V()){
 const c=document.createElement('canvas');c.width=512;c.height=160;const x=c.getContext('2d');x.clearRect(0,0,512,160);x.fillStyle='#c6aa75';x.textAlign='center';x.font='500 72px Georgia';x.fillText('KAOPU',256,83);x.font='24px sans-serif';x.fillText('A T E L I E R',256,128);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
 const m=new T.MeshStandardMaterial({map:tex,transparent:true,metalness:.68,roughness:.43,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});const o=new T.Mesh(new T.PlaneGeometry(w,w*160/512),m);o.position.copy(pos);o.rotation.set(rotation.x,rotation.y,rotation.z);parent.add(o);o.userData.logo=true;
}
export function productMaterials(top){
 const back=new T.MeshPhysicalMaterial({color:new T.Color('#503627'),roughness:.93,sheen:.45,sheenColor:new T.Color('#977454'),sheenRoughness:1});
 const edge=new T.MeshStandardMaterial({color:'#30201a',roughness:.52});
 edge.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vEdgePos;').replace('#include <begin_vertex>','#include <begin_vertex>\nvEdgePos=position;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vEdgePos;').replace('#include <color_fragment>','#include <color_fragment>\nfloat f=fract(sin(dot(floor(vEdgePos*vec3(11.,24.,15.)),vec3(12.9,78.2,35.6)))*43758.54);diffuseColor.rgb*=.9+.16*f;');};
 const thread=new T.MeshPhysicalMaterial({color:'#c5b18c',roughness:.76,sheen:.4,sheenRoughness:.85});const brass=new T.MeshStandardMaterial({color:'#bca273',metalness:1,roughness:.26});return{shell:[top,back,edge],back,edge,thread,brass};
}
function wallet(m){
 const root=new T.Group(),s=PRODUCT_SPECS.wallet,holes=[];const y0=-s.h/2+s.edge,x=s.w/2-s.edge;
 const perimeter=[V(-x,29,0),V(-x,y0+5,0),V(-x+5,y0,0),V(x-5,y0,0),V(x,y0+5,0),V(x,29,0)];const path=new T.CatmullRomCurve3(perimeter,false,'centripetal');const n=Math.floor(path.getLength()/s.pitch);
 for(let i=0;i<=n;i++){let p=path.getPointAt(i/n);holes.push([p.x,p.y]);}
 const parts=[{h:76,cy:0,z:0},{h:59,cy:-8.5,z:2.0},{h:42,cy:-17,z:4.0}];
 for(let k=0;k<parts.length;k++){const p=parts[k],shape=roundShape(108,p.h,6);for(const [hx,hy]of holes)if(hy-p.cy<p.h/2-1.8)circleHole(shape,hx,hy-p.cy,.27);const o=surface(panelGeometry(shape,s.t),m.shell,root,'wallet-panel-'+k);o.position.set(0,p.cy,p.z);}
 // Two continuous running paths in opposite phase. Together front/back are filled;
 // needle-hole locations are shared with the actual panel holes and SVG pattern.
 const height=y=>y<=2.2?4.0:y<=19.2?2.0:0;
 for(let phase=0;phase<2;phase++){
  const pts=[];for(let i=0;i<holes.length;i++){const [x,y]=holes[i],side=(i+phase)%2===0?1:-1,z=side>0?height(y)+.78:-.82;
   pts.push(V(x+(phase?-.09:.09),y,z));pts.push(V(x+(phase?-.09:.09),y,side>0?-.82:height(y)+.78));}
  // Corner paths remain explicitly piecewise to keep them inside real holes.
  const path=new T.CurvePath();for(let i=1;i<pts.length;i++)path.add(new T.LineCurve3(pts[i-1],pts[i]));const thread=new T.Mesh(new T.TubeGeometry(path,Math.max(300,pts.length*5),.105,6,false),m.thread);thread.castShadow=true;thread.name='two-phase-through-hole-route';root.add(thread);
 }
 // Cards are separate, thin objects inside the open pockets, not painted rectangles.
 const paper=new T.MeshStandardMaterial({color:'#d3c9b5',roughness:.82});for(const [w,h,z,cy]of[[86,49,1.0,9],[85,45,3.0,-2]]){const o=cube(w,h,.32,[paper,paper,paper],root,0,cy,z,2);o.name='removable-card';}
 logo(root,m.brass,25,V(0,-16,4.81));
 root.rotation.x=-.23;root.rotation.y=-.14;root.position.y=43;
 root.userData={kind:'wallet',holes,parts,patternReady:true,dimensions:s,center:V(0,43,0),radius:85};return root;
}
function belt(m){
 const s=PRODUCT_SPECS.belt,root=new T.Group(),shape=roundShape(s.l,s.w,s.r);
 for(let i=0;i<5;i++)circleHole(shape,s.l/2-34-i*25,0,2.25);
 // Arc-length lookup preserves the 1100 mm strip length; no arbitrary texture stretch.
 let theta=0;const step=.001,arc=[0],angles=[0];let len=0;while(len<s.l){const r=75+theta*2.2;len+=Math.hypot(r,2.2)*step;theta+=step;arc.push(len);angles.push(theta);}
 function frame(u){let distance=Math.max(0,Math.min(s.l,u*s.l)),extra=u*s.l-distance,lo=0,hi=arc.length-1;while(hi-lo>1){let mid=(hi+lo)>>1;if(arc[mid]<distance)lo=mid;else hi=mid;}let t=angles[lo]+(angles[hi]-angles[lo])*(distance-arc[lo])/(arc[hi]-arc[lo]);t-=.5;const r=75+(t+.5)*2.2,rad=V(Math.cos(t),0,Math.sin(t)),tan=V(2.2*Math.cos(t)-r*Math.sin(t),0,2.2*Math.sin(t)+r*Math.cos(t)).normalize();return{p:rad.clone().multiplyScalar(r).add(V(0,20,0)).addScaledVector(tan,extra),rad:V(tan.z,0,-tan.x),tan};}
 const g=bendPanel(panelGeometry(shape,s.t,.25),(p,n)=>{const f=frame((p.x+s.l/2)/s.l);return{p:f.p.add(V(0,p.y,0)).addScaledVector(f.rad,p.z),n:f.tan.multiplyScalar(n.x).add(V(0,n.y,0)).addScaledVector(f.rad,n.z).normalize()};},6,true);
 surface(g,m.shell,root,'1100mm-curved-punched-belt');
 for(const side of[-1,1]){const pts=[];for(let i=0;i<=180;i++){const f=frame(i/180);pts.push(f.p.add(V(0,side*(s.w/2-3),0)).addScaledVector(f.rad,s.t/2+.14));}stitchSegments(pts,m.thread,root,4,.18);}
 const f=frame(0),base=f.p.clone().addScaledVector(f.tan,-18);const to=(x,y,z=0)=>base.clone().addScaledVector(f.tan,x).add(V(0,y,0)).addScaledVector(f.rad,z);
 const ring=[];const rs=roundShape(35,43,5).getPoints(10);for(const p of rs)ring.push(to(p.x,p.y,1.4));tube(ring,2.05,m.brass,root,true,200);tube([to(-17,0,1.4),to(17,0,1.4)],1.7,m.brass,root,false,10);tube([to(-17,0,2),to(3,0,3.6),to(19,0,1.4)],1.05,m.brass,root,false,30);
 // A leather keeper encloses the full cross section, rather than floating on the face.
 const keeperFrame=frame(.028),keeperPath=new T.CatmullRomCurve3(roundShape(s.t+3,s.w+3,1.6).getPoints(16).map(p=>V(p.x,p.y,0)),true,'centripetal');
 const keeperSurface=(u,v)=>{const p=keeperPath.getPointAt(u);return keeperFrame.p.clone().addScaledVector(keeperFrame.rad,p.x).add(V(0,p.y,0)).addScaledVector(keeperFrame.tan,(v-.5)*10);};surface(shell(keeperSurface,84,6,1,keeperPath.getLength(),10,false),m.shell,root,'closed-leather-keeper');
 root.rotation.y=.25;root.userData={kind:'belt',patternReady:true,dimensions:s,center:V(0,22,0),radius:145,frame,lengthErrorMM:Math.abs(arc.at(-1)-s.l)};return root;
}
function swatch(m,small=false){
 const s=PRODUCT_SPECS.swatch,root=new T.Group();
 const fun=(u,v)=>{const x=(u-.5)*s.w,z=(v-.5)*s.h;const curl=Math.exp(-(((u-.90)/.20)**2))*(4+v*15);return V(x,13+7*Math.sin(u*Math.PI)*Math.cos((v-.4)*1.8)+curl,z);};
 surface(shell(fun,60,42,1.4,s.w,s.h,true),m.shell,root,'folded-leather-sample');
 const path=[];for(let i=0;i<=40;i++)path.push(fun(.04+i/40*.92,.06).add(V(0,.83,0)));stitchSegments(path,m.thread,root,3.4,.16);
 root.userData={kind:'swatch',patternReady:false,center:V(0,22,0),radius:86,dimensions:s};return root;
}
function hat(m){
 const s=PRODUCT_SPECS.hat,root=new T.Group();
 const crown=(u,v)=>{const th=u*TAU,ph=.005+(Math.PI/2-.005)*v,r=Math.sin(ph),x=88*r*Math.sin(th),z=102*r*Math.cos(th)-12*(1-r);const y=24+73*Math.cos(ph)-13*Math.max(0,Math.cos(th))*r*r;return V(x,y,z);};
 surface(shell(crown,128,40,s.t,580,120,true),m.shell,root,'six-panel-open-crown');
 const band=(u,v)=>{const th=u*TAU;return V(88*Math.sin(th),10+v*14-13*Math.max(0,Math.cos(th)),102*Math.cos(th));};surface(shell(band,128,6,1.8,580,14,false),m.shell,root,'open-sweatband');
 const brim=(u,v)=>{const th=(u-.5)*2.6,rx=88+v*17*Math.cos(th*.6),rz=103+v*58*Math.cos(th*.6);return V(rx*Math.sin(th),9-13*Math.max(0,Math.cos(th))-v*8+5*Math.sin(th)**2,rz*Math.cos(th));};surface(shell(brim,72,18,2.4,255,58,true),m.shell,root,'shaped-leather-brim');
 for(let k=0;k<6;k++)for(const offset of[-.003,.003]){const p=[];for(let j=1;j<=38;j++)p.push(crown(k/6+offset,j/38).add(V(0,.83,0)));stitchSegments(p,m.thread,root,3.4,.17);}
 for(const vv of[.08,.90]){const p=[];for(let j=0;j<=60;j++)p.push(brim(j/60,vv).add(V(0,1.35,0)));stitchSegments(p,m.thread,root,3.4,.16);}
 const button=new T.Mesh(new T.SphereGeometry(4.5,24,12),m.shell[0]);button.scale.y=.4;button.position.set(0,98,-12);root.add(button);
 root.rotation.y=-.23;root.position.y=14;root.userData={kind:'hat',patternReady:false,dimensions:s,center:V(0,53,10),radius:180};return root;
}
function bag(m){
 const s=PRODUCT_SPECS.bag,root=new T.Group();
 for(const z of[-36,36]){const o=surface(panelGeometry(roundShape(s.w,s.h,17),s.t),m.shell,root,z>0?'bag-front':'bag-back');o.position.set(0,s.h/2+10,z);if(z<0)o.rotation.y=Math.PI;}
 const sidePath=new T.CatmullRomCurve3([V(-120,191,0),V(-120,35,0),V(-104,10,0),V(104,10,0),V(120,35,0),V(120,191,0)],false,'centripetal');
 const gusset=(u,v)=>{let p=sidePath.getPointAt(u);p.z=(v-.5)*72;return p;};surface(shell(gusset,144,18,2,sidePath.getLength(),72,false),m.shell,root,'continuous-side-bottom-gusset');
 for(const z of[-37.2,37.2]){const path=[];for(let i=0;i<=120;i++){const p=sidePath.getPointAt(i/120);p.z=z;path.push(p);}tube(path,.8,m.edge,root,false,360);const st=path.map(p=>V(p.x*.962,p.y+3.2,p.z+(z>0?.45:-.45)));stitchSegments(st,m.thread,root,4,.18);}
 const flapCurve=new T.CatmullRomCurve3([V(0,181,-38),V(0,207,-31),V(0,214,5),V(0,200,34),V(0,166,41),V(0,121,43)],false,'centripetal');
 const flap=(u,v)=>{let p=flapCurve.getPointAt(v);let w=226-12*Math.pow(Math.max(0,(v-.8)/.2),2);p.x=(u-.5)*w;p.z+=2*Math.cos((u-.5)*Math.PI);return p;};surface(shell(flap,72,64,2.2,226,flapCurve.getLength(),true),m.shell,root,'continuous-folded-flap');
 const edge=[];for(let i=0;i<=70;i++)edge.push(flap(.024,i/70).add(V(0,0,1.3)));for(let i=1;i<=60;i++)edge.push(flap(.024+.952*i/60,1).add(V(0,0,1.3)));for(let i=69;i>=0;i--)edge.push(flap(.976,i/70).add(V(0,0,1.3)));stitchSegments(edge,m.thread,root,3.6,.19);
 cube(27,17,2,[m.brass,m.brass,m.brass],root,0,128,46,3);cube(15,5,4,[m.brass,m.brass,m.brass],root,0,128,49,2);
 logo(root,m.brass,33,V(0,153,46.05));
 // Strap anchors and metal D-rings touch the gusset, rather than floating.
 for(const sign of[-1,1]){const tab=surface(panelGeometry(roundShape(17,36,5),2),m.shell,root,'strap-tab');tab.rotation.y=sign*Math.PI/2;tab.position.set(sign*121,170,0);const ring=[];for(const p of roundShape(15,22,6).getPoints(12))ring.push(V(sign*(123+p.x*.05),190+p.y,p.x));tube(ring,1.6,m.brass,root,true,120);const stud=new T.Mesh(new T.SphereGeometry(2.6,16,10),m.brass);stud.scale.z=.35;stud.rotation.y=sign*Math.PI/2;stud.position.set(sign*123,165,0);root.add(stud);}
 const curve=new T.CatmullRomCurve3([V(-124,198,0),V(-153,273,-12),V(-121,376,-30),V(0,429,-35),V(121,376,-30),V(153,273,-12),V(124,198,0)],false,'centripetal');
 const strap=(u,v)=>{let p=curve.getPointAt(u),d=curve.getTangentAt(u),l=V(d.y,-d.x,0).normalize();return p.addScaledVector(l,(v-.5)*16);};surface(shell(strap,160,8,2.3,curve.getLength(),16,true),m.shell,root,'attached-shoulder-strap');
 for(const side of[.13,.87]){const p=[];for(let i=0;i<=140;i++)p.push(strap(i/140,side).add(V(0,0,1.35)));stitchSegments(p,m.thread,root,4,.16);}
 root.rotation.y=-.26;root.userData={kind:'bag',patternReady:false,dimensions:s,center:V(0,209,0),radius:280};return root;
}
export function makeProduct(id,m){if(!PRODUCT_SPECS[id])throw Error('Unknown product '+id);return({wallet,belt,swatch,hat,bag})[id](m);}
export function setProductMaterial(root,material){root.traverse(o=>{if(o.userData.leather&&Array.isArray(o.material))o.material[0]=material;});}
export function productAudit(root){let meshes=0,triangles=0,finite=true,leatherMeshes=0;root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh)return;meshes++;if(o.userData.leather)leatherMeshes++;const a=o.geometry?.attributes.position;if(a){triangles+=(o.geometry.index?o.geometry.index.count:a.count)/3;for(let i=0;i<a.count;i++){if(!Number.isFinite(a.getX(i))||!Number.isFinite(a.getY(i))||!Number.isFinite(a.getZ(i))){finite=false;break;}}}});const box=new T.Box3().setFromObject(root);return{kind:root.userData.kind,meshes,leatherMeshes,triangles,finite,boundsMM:{min:box.min.toArray(),max:box.max.toArray()},patternReady:!!root.userData.patternReady,forceSolved:false};}
export function patternSVG(id){
 if(!['wallet','belt'].includes(id))throw Error('本款尚未完成可用纸样；不导出占位纸样。');
 const s=PRODUCT_SPECS[id],parts=[];let W,H;
 const pathOf=(shape,dx,dy)=>{const p=shape.getPoints(80);return'M '+p.map(v=>(v.x+dx).toFixed(3)+','+(dy-v.y).toFixed(3)).join(' L ')+' Z';};
 if(id==='belt'){W=1160;H=160;const shape=roundShape(s.l,s.w,s.r);parts.push(`<path d="${pathOf(shape,580,50)}"/>`);for(let i=0;i<5;i++)parts.push(`<circle cx="${580+s.l/2-34-i*25}" cy="50" r="2.25"/>`);parts.push('<text x="30" y="89">BELT 1100 x 35 mm / 3.2 mm leather. Buckle fold and keeper require a separate test fit.</text>');}
 else{W=385;H=160;const heights=[76,59,42],cys=[0,-8.5,-17];
  const y0=-s.h/2+s.edge,x=s.w/2-s.edge;const curve=new T.CatmullRomCurve3([V(-x,29),V(-x,y0+5),V(-x+5,y0),V(x-5,y0),V(x,y0+5),V(x,29)],false,'centripetal');const n=Math.floor(curve.getLength()/s.pitch);
  for(let k=0;k<3;k++){const dx=69+k*123,dy=62;parts.push(`<path d="${pathOf(roundShape(108,heights[k],6),dx,dy)}"/>`);for(let i=0;i<=n;i++){const p=curve.getPointAt(i/n);if(p.y-cys[k]<heights[k]/2-1.8)parts.push(`<circle cx="${(dx+p.x).toFixed(3)}" cy="${(dy-p.y+cys[k]).toFixed(3)}" r="0.27"/>`);}parts.push(`<text x="${dx-48}" y="112">PANEL ${k+1}: 108 x ${heights[k]} mm</text>`);}
 }
 return`<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}"><metadata>KAOPU R06 / millimetres / same spec and needle positions as displayed 3D / prototype, NOT production certified</metadata><style>path,circle,line{fill:none;stroke:#151515;stroke-width:.16}text{font:3px sans-serif;fill:#222}</style><text x="15" y="12">KAOPU ATELIER / ${s.en} / 1:1 mm / PRINT AT 100% / PROTOTYPE PATTERN</text>${parts.join('')}<path d="M15,135h100m-100,-3v6m100,-6v6"/><text x="15" y="144">100 mm calibration / Cutting outline, no added seam allowance. Punch centres included.</text><text x="15" y="151">Test on scrap first. Leather stretch, skiving, assembly clearance and hardware fit need physical sampling.</text></svg>`;
}
