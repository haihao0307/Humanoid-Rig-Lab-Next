import * as T from 'three';

// Millimetres throughout. These are explicit design sections, not a measured
// commercial last or a pressure/comfort model. The foot and last remain distinct.
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const mix=(a,b,t)=>a+(b-a)*t;
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export function curve(keys,x){
  let i=0;while(i<keys.length-2&&x>keys[i+1][0])i++;
  const [a,av]=keys[i],[b,bv]=keys[i+1],t=clamp((x-a)/(b-a));
  const p=keys[Math.max(0,i-1)],q=keys[Math.min(keys.length-1,i+2)];
  const m0=(bv-p[1])/(b-p[0]),m1=(q[1]-av)/(q[0]-a);
  return (2*t*t*t-3*t*t+1)*av+(t*t*t-2*t*t+t)*(b-a)*m0+(-2*t*t*t+3*t*t)*bv+(t*t*t-t*t)*(b-a)*m1;
}
export const STYLES=[
 {id:'penny',name:'便士乐福鞋',english:'PENNY LOAFER',tag:'低口 · U 形前片 · 有孔鞍带',length:280,width:101,heel:17,roof:.83,collar:[.035,.49,1.02],sole:6,colors:{upper:'#572c20',lining:'#b5966c',sole:'#292522',thread:'#ad7955',metal:'#b5a278'},reference:'https://www.crockettandjones.com/products/boston-black-calf',features:['独立前片与环绕帮面','鞍带有真实贯穿切口','低鞋口与内衬','薄前掌、独立后跟']},
 {id:'chelsea',name:'切尔西短靴',english:'CHELSEA BOOT',tag:'连续前帮 · 两侧松紧片 · 后拉环',length:286,width:100,heel:21,roof:.98,collar:[.035,.45,.97],sole:7,shaft:174,colors:{upper:'#352921',lining:'#b2936d',sole:'#242320',thread:'#66513c',metal:'#968066'},reference:'https://us.crockettandjones.com/products/chelsea-8-black-calf-city',features:['前脚背连续过渡到靴筒','两侧弹力嵌片取代皮革区域','后帮接缝与拉环','踝口内壁与后跟']},
 {id:'monk',name:'双搭扣皮鞋',english:'DOUBLE MONK',tag:'一体前帮鞋舌 · 覆盖片 · 双扣带',length:289,width:99,heel:19,roof:.88,collar:[.035,.45,.99],sole:6,colors:{upper:'#693622',lining:'#b69a73',sole:'#2c2522',thread:'#97724f',metal:'#b4a184'},reference:'https://row.crockettandjones.com/collections/mens-monk-strap-collection/products/lowndes-black-calf',features:['前帮与鞋舌连成一片','跨脚背覆盖片','两条穿过扣框的皮带','外侧扣座、扣针与带孔']},
 {id:'canvas',name:'帆布网球鞋',english:'CANVAS COURT',tag:'棉帆布 · 金属鞋眼 · 硫化橡胶包边',length:279,width:104,heel:0,roof:.87,collar:[.045,.47,.95],sole:14,colors:{upper:'#53645c',lining:'#d9d5c8',sole:'#ded9c8',thread:'#c2c9bb',metal:'#b8b9b3'},reference:'https://www.superga.com/products/le-superga-unisex-2750-cotu-classic-black-s000010-999',features:['帆布前帮和独立鞋舌','金属鞋眼与棉鞋带','连续橡胶包边盖住帮底接合','连续外底、没有皮鞋跟块']}
];
export const DEFAULTS={length:1,width:1,instep:0,thickness:1.35,bend:0};
export function validateParams(p={}){
  const out={...DEFAULTS,...p};
  for(const [k,a,b] of [['length',.90,1.10],['width',.88,1.15],['instep',-5,8],['thickness',.9,2.1],['bend',0,30]]){
    if(!Number.isFinite(out[k])||out[k]<a||out[k]>b)throw Error('参数越界：'+k);
  }return out;
}
export function makeLast(style,params={}){
 const p=validateParams(params),L=style.length*p.length,W=style.width;
 const widthKeys=[[0,.006],[.018,.34],[.055,.57],[.13,.65],[.23,.64],[.35,.69],[.48,.86],[.62,1],[.73,1],[.83,.94],[.91,.78],[.965,.48],[.99,.20],[1,.006]];
 const roofKeys=[[0,45],[.04,64],[.14,76],[.28,81],[.40,79],[.52,64],[.65,47],[.79,37],[.90,30],[.96,22],[.99,10],[1,1.2]];
 const width=s=>Math.max(.25,curve(widthKeys,clamp(s))*W*.5*(1+(p.width-1)*smooth(.18,.57,s)));
 const center=s=>3.0*Math.sin(Math.PI*s)*smooth(.28,.7,s); // restrained medial/lateral asymmetry
 const soleTop=s=>style.sole+style.heel*(1-smooth(.18,.61,s))+8*smooth(.81,1,s)**2;
 const height=s=>Math.max(1,curve(roofKeys,clamp(s))*style.roof+p.instep*Math.exp(-(((s-.38)/.19)**2)));
 const [a,b,angle]=style.collar;
 const collarAngle=s=>s<=a||s>=b?0:angle*Math.pow(Math.max(0,Math.sin(Math.PI*(s-a)/(b-a))),.58);
 function point(s,theta){
   s=clamp(s);const side=theta<0?-1:1,asym=1+(side<0?.028:-.016)*smooth(.28,.65,s);
   return V(center(s)+width(s)*Math.sin(theta)*asym,soleTop(s)+height(s)*Math.pow(Math.max(0,Math.cos(theta)),.72),L*(s-.5));
 }
 function normal(s,t){const e=1e-4,ds=point(clamp(s+e),t).sub(point(clamp(s-e),t)),dt=point(s,clamp(t+e,-Math.PI/2,Math.PI/2)).sub(point(s,clamp(t-e,-Math.PI/2,Math.PI/2)));return ds.cross(dt).normalize();}
 const at=(s,t,offset=0)=>point(s,t).addScaledVector(normal(s,t),offset);
 function ring(u){const s=mix(a,b,(1+Math.cos(u))*.5),t=Math.sign(Math.sin(u))*collarAngle(s);return at(s,t);}
 return {style,params:p,L,W,width,center,soleTop,height,collarAngle,point,normal,at,ring};
}

/** A surface patch. Optional keep() cuts real holes before closed cut walls are
 * built. UVs are rest-surface millimetres /100, NOT production pattern coordinates. */
export function patch(point,nu=64,nv=24,{normal=null,uv=null,keep=null}={}){return{point,nu,nv,normal,uv,keep};}
export function upperPatches(last,s0=0,s1=1,{inner=null,outer=null,offset=0,nu=76,nv=22}={}){
 return [-1,1].map(side=>{
  const angle=(s,v)=>side*mix(Math.max(last.collarAngle(s),inner?.(s)??0),Math.max(last.collarAngle(s),outer?.(s)??Math.PI/2),v);
  return patch((u,v)=>last.at(mix(s0,s1,u),angle(mix(s0,s1,u),v),offset),nu,nv,{normal:(u,v)=>last.normal(mix(s0,s1,u),angle(mix(s0,s1,u),v)),uv:(u,v)=>[mix(s0,s1,u)*last.L/100,angle(mix(s0,s1,u),v)*52/100]});
 });
}
export function shell(patches,thickness=1.35){
 const pts=[],norm=[],uvs=[],tri=[],map=new Map();
 const add=(p,n,uv)=>{const key=p.toArray().map(x=>Math.round(x*1e5)).join(',');if(map.has(key))return map.get(key);const i=pts.length;pts.push(p);norm.push(n);uvs.push(uv);map.set(key,i);return i;};
 for(const q of patches){const ids=[];for(let i=0;i<=q.nu;i++){ids[i]=[];for(let j=0;j<=q.nv;j++){
   const u=i/q.nu,v=j/q.nv,pt=q.point(u,v),e=1e-4;
   let n=q.normal?.(u,v);if(!n){const du=q.point(clamp(u+e),v).sub(q.point(clamp(u-e),v)),dv=q.point(u,clamp(v+e)).sub(q.point(u,clamp(v-e)));n=du.cross(dv).normalize();}
   if(n.lengthSq()<.01)n=V(0,1,0);ids[i][j]=add(pt,n,q.uv?.(u,v)??[pt.x/100,pt.z/100]);
  }}
  const push=(a,b,c)=>{if(a===b||b===c||a===c)return;const cross=pts[b].clone().sub(pts[a]).cross(pts[c].clone().sub(pts[a]));if(cross.lengthSq()<1e-16)return;if(cross.dot(norm[a])<0)[b,c]=[c,b];tri.push(a,b,c);};
  for(let i=0;i<q.nu;i++)for(let j=0;j<q.nv;j++){if(q.keep&&!q.keep((i+.5)/q.nu,(j+.5)/q.nv))continue;push(ids[i][j],ids[i+1][j],ids[i][j+1]);push(ids[i+1][j],ids[i+1][j+1],ids[i][j+1]);}
 }
 const edges=new Map();for(let i=0;i<tri.length;i+=3)for(const [a,b]of[[tri[i],tri[i+1]],[tri[i+1],tri[i+2]],[tri[i+2],tri[i]]]){const key=Math.min(a,b)+','+Math.max(a,b);const e=edges.get(key);if(e)e.count++;else edges.set(key,{a,b,count:1});}
 const boundary=[...edges.values()].filter(e=>e.count===1),N=pts.length,position=[],normal=[],uv=[],edge=[],indices=[];
 const boundaryIds=new Set(boundary.flatMap(e=>[e.a,e.b]));
 for(let layer=0;layer<2;layer++)for(let i=0;i<N;i++){position.push(...pts[i].clone().addScaledVector(norm[i],-thickness*layer).toArray());normal.push(...norm[i].clone().multiplyScalar(layer?-1:1).toArray());uv.push(...uvs[i]);edge.push(boundaryIds.has(i)?1:0);}
 indices.push(...tri);const outerCount=indices.length;for(let i=0;i<tri.length;i+=3)indices.push(tri[i]+N,tri[i+2]+N,tri[i+1]+N);const innerCount=tri.length;
 for(const {a,b}of boundary){const k=position.length/3,A=pts[a],B=pts[b],Ai=A.clone().addScaledVector(norm[a],-thickness),Bi=B.clone().addScaledVector(norm[b],-thickness),n=B.clone().sub(A).cross(Ai.clone().sub(A)).normalize();for(const P of[A,B,Bi,Ai]){position.push(...P.toArray());normal.push(...n.toArray());edge.push(1);}uv.push(0,0,A.distanceTo(B)/100,0,A.distanceTo(B)/100,thickness/100,0,thickness/100);indices.push(k,k+1,k+3,k+1,k+2,k+3);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(position,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('craftEdge',new T.Float32BufferAttribute(edge,1));g.setAttribute('compression',new T.Float32BufferAttribute(new Float32Array(edge.length),1));g.setIndex(indices);g.addGroup(0,outerCount,0);g.addGroup(outerCount,innerCount,1);g.addGroup(outerCount+innerCount,indices.length-outerCount-innerCount,2);g.computeBoundingBox();
 g.userData={thicknessMm:thickness,closedCutWalls:true,boundaryEdges:boundary.length,surfaceVertices:N,parameterization:'appearance millimetres /100',manufacturingPattern:false};return g;
}
export function descriptor(id,geometry,role='leather',extra={}){return{id,geometry,role,kind:'panel',explode:[0,20,0],...extra};}
export function panel(id,patches,thickness=1.35,role='leather',extra={}){return descriptor(id,shell(patches,thickness),role,{thicknessMm:thickness,...extra});}
export function pathGeometry(points,width=.40,depth=.17,closed=false){
 const P=points.map(p=>p.clone());if(closed)P.push(P[0].clone());
 const pos=[],nor=[],uv=[],idx=[],N=P.length,R=7,section=[],crossLength=[0],arc=[0];
 for(let j=0;j<R;j++){const a=j/6*Math.PI*2;section.push(new T.Vector2(Math.cos(a)*width/2,Math.sin(a)*depth/2));if(j)crossLength.push(crossLength[j-1]+section[j].distanceTo(section[j-1]));}
 for(let i=1;i<N;i++)arc.push(arc[i-1]+P[i].distanceTo(P[i-1]));
 for(let i=0;i<N;i++){const prev=P[Math.max(0,i-1)],next=P[Math.min(N-1,i+1)],t=next.clone().sub(prev).normalize(),up=Math.abs(t.y)<.92?V(0,1,0):V(1,0,0),side=up.clone().cross(t).normalize(),n=t.clone().cross(side).normalize();for(let j=0;j<R;j++){const off=side.clone().multiplyScalar(section[j].x).addScaledVector(n,section[j].y);pos.push(...P[i].clone().add(off).toArray());nor.push(...off.normalize().toArray());uv.push(arc[i]/100,crossLength[j]/100);}}
 for(let i=0;i<N-1;i++)for(let j=0;j<6;j++){const a=i*R+j,b=a+1,c=(i+1)*R+j,d=c+1;idx.push(a,b,c,b,d,c);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeBoundingBox();return g;
}
export function mergeGeometry(geometries){
 const pos=[],normal=[],uv=[],index=[];let count=0;
 for(const g of geometries){pos.push(...g.attributes.position.array);normal.push(...g.attributes.normal.array);if(g.attributes.uv)uv.push(...g.attributes.uv.array);else uv.push(...new Float32Array(g.attributes.position.count*2));for(const i of g.index?.array??Array.from({length:g.attributes.position.count},(_,i)=>i))index.push(i+count);count+=g.attributes.position.count;}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeBoundingBox();for(const old of geometries)old.dispose();return g;
}
/** One continuous stitch path alternates visible and buried runs; the width is
 * 0.42 mm and the thread section is flattened, not a giant cylindrical seam. */
export function seam(id,curveFn,{pitch=3.2,width=.42,depth=.18,normalFn=null,role='thread'}={}){
 const samples=Array.from({length:241},(_,i)=>curveFn(i/240)),lens=[0];for(let i=1;i<samples.length;i++)lens.push(lens[i-1]+samples[i].distanceTo(samples[i-1]));const length=lens.at(-1),steps=Math.max(12,Math.ceil(length/.42)),pts=[];
 for(let i=0;i<=steps;i++){const d=length*i/steps;let k=1;while(k<lens.length-1&&lens[k]<d)k++;const t=(k-1+(d-lens[k-1])/Math.max(.001,lens[k]-lens[k-1]))/240,p=curveFn(t),phase=d/pitch%1,buried=phase>.74;const n=normalFn?.(t)??V(0,1,0);p.addScaledVector(n,buried?-.26:.22);pts.push(p);}
 return descriptor(id,pathGeometry(pts,width,depth),role,{kind:'seam',lengthMm:length,pitchMm:pitch,continuous:true,forceSolved:false,explode:[0,20,0]});
}
export function bendGeometry(g,last,angleDeg){
 if(!angleDeg)return;const a=g.attributes.position,n=g.attributes.normal,axisZ=last.L*(.63-.5),band=last.L*.09,angle=angleDeg*Math.PI/180;
 for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),t=smooth(axisZ-band,axisZ+band,z),ang=angle*t,c=Math.cos(ang),s=Math.sin(ang),dz=z-axisZ,base=last.soleTop(.63);a.setXYZ(i,x,base+(y-base)*c+dz*s,axisZ+dz*c-(y-base)*s);const ny=n.getY(i),nz=n.getZ(i);n.setXYZ(i,n.getX(i),ny*c+nz*s,nz*c-ny*s);}
 a.needsUpdate=n.needsUpdate=true;g.computeBoundingBox();g.userData.flexMode='geometric inspection; design axis, not calibrated anatomy';
}
