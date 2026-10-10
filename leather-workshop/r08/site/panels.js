import * as T from 'three';
import {SeamPath,SeamIndex,seamRelief,makeSewnYarn} from './sewing.js';
const V=(...a)=>new T.Vector3(...a),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function improve(points,faces){
 const orient=(a,b,c)=>(points[b].x-points[a].x)*(points[c].y-points[a].y)-(points[b].y-points[a].y)*(points[c].x-points[a].x);
 const tris=faces.map(([a,b,c])=>orient(a,b,c)>=0?[a,b,c]:[a,c,b]),map=new Map(),queue=[];
 const key=(a,b)=>Math.min(a,b)+':'+Math.max(a,b);
 const add=(ti)=>{const t=tris[ti];for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],k=key(a,b);if(!map.has(k))map.set(k,{a,b,f:new Set()});map.get(k).f.add(ti);queue.push(k);}};
 const remove=(ti)=>{const t=tris[ti];for(let j=0;j<3;j++)map.get(key(t[j],t[(j+1)%3]))?.f.delete(ti);};
 for(let i=0;i<tris.length;i++)add(i);
 const cot=(a,b,c)=>{const u=points[a].clone().sub(points[c]),v=points[b].clone().sub(points[c]);return u.dot(v)/Math.max(1e-18,Math.abs(u.x*v.y-u.y*v.x));};
 let qi=0,flips=0;while(qi<queue.length&&flips<tris.length*12){const e=map.get(queue[qi++]);if(!e||e.f.size!==2)continue;const [i,j]=[...e.f],a=e.a,b=e.b,c=tris[i].find(x=>x!==a&&x!==b),d=tris[j].find(x=>x!==a&&x!==b);if(c===d||orient(c,d,a)*orient(c,d,b)>=-1e-12)continue;if(cot(a,b,c)+cot(a,b,d)>=-1e-6)continue;remove(i);remove(j);tris[i]=orient(c,d,a)>0?[c,d,a]:[d,c,a];tris[j]=orient(d,c,b)>0?[d,c,b]:[c,d,b];add(i);add(j);flips++;}
 return tris;
}
function refine(points,faces,index,thumbnail=false){
 let tris=improve(points,faces);
 for(let pass=0;pass<13;pass++){
  const marked=new Map();
  for(const t of tris)for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],p=points[a],q=points[b],x=(p.x+q.x)*.5,z=(p.y+q.y)*.5,L=p.distanceTo(q);if(L<.4)continue;const near=index.nearest(x,z);const max=thumbnail?(near?(near.distance<1.5?1.4:5):9):(near?(near.distance<1.5?.7:near.distance<3?1.7:4.8):5.5);if(L>max){const key=Math.min(a,b)+':'+Math.max(a,b);if(!marked.has(key)){marked.set(key,points.length);points.push(p.clone().lerp(q,.5));}}}
  if(!marked.size)break;
  const result=[];for(const[a,b,c]of tris){const ab=marked.get(Math.min(a,b)+':'+Math.max(a,b)),bc=marked.get(Math.min(b,c)+':'+Math.max(b,c)),ca=marked.get(Math.min(c,a)+':'+Math.max(c,a));const mask=(ab!==undefined?1:0)+(bc!==undefined?2:0)+(ca!==undefined?4:0);switch(mask){case 0:result.push([a,b,c]);break;case 1:result.push([a,ab,c],[ab,b,c]);break;case 2:result.push([a,b,bc],[a,bc,c]);break;case 4:result.push([a,b,ca],[b,c,ca]);break;case 3:result.push([a,ab,c],[ab,bc,c],[ab,b,bc]);break;case 6:result.push([b,bc,a],[bc,ca,a],[bc,c,ca]);break;case 5:result.push([c,ca,b],[ca,ab,b],[ca,a,ab]);break;case 7:result.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]);break;}}
  tris=improve(points,result);if(points.length>450000)throw Error('Panel tessellation budget exceeded. No silent quality fallback.');
 }
 return tris;
}
// Tile boundaries are placed between complete apertures. They do not introduce
// extra leather cut walls. Both sides evaluate the same surface/normal field.
function triangulatePaper(outer,holes,index,thumbnail){
 const xs=outer.map(p=>p.x),lo=Math.min(...xs),hi=Math.max(...xs);
 if(hi-lo<330){const points=outer.concat(...holes),faces=T.ShapeUtils.triangulateShape(outer,holes);return{points,tris:refine(points,faces,index,thumbnail)};}
 const bounds=holes.map(r=>({min:Math.min(...r.map(p=>p.x)),max:Math.max(...r.map(p=>p.x)),ring:r})),cuts=[lo];
 for(let base=lo+24;base<hi-12;base+=24){let best=null;for(let k=0;k<=40&&best===null;k++)for(const sign of[k===0?0:-1,1]){const x=base+sign*k*.15;if(!bounds.some(b=>x>b.min-.06&&x<b.max+.06)){best=x;break;}}if(best!==null&&best-cuts.at(-1)>8&&hi-best>8)cuts.push(best);}
 cuts.push(hi);const points=[],tris=[];
 const clip=(poly,x,lower)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],A=lower?a.x>=x-1e-9:a.x<=x+1e-9,B=lower?b.x>=x-1e-9:b.x<=x+1e-9;if(A)out.push(a.clone());if(A!==B)out.push(a.clone().lerp(b,(x-a.x)/(b.x-a.x)));}return out.filter((p,i)=>!i||p.distanceTo(out[i-1])>1e-8);};
 for(let i=1;i<cuts.length;i++){const left=cuts[i-1],right=cuts[i],contour=clip(clip(outer,left,true),right,false);if(contour.length<3)continue;const localHoles=bounds.filter(b=>b.min>=left-.0001&&b.max<=right+.0001).map(b=>b.ring.map(p=>p.clone()));const p=contour.concat(...localHoles),faces=T.ShapeUtils.triangulateShape(contour,localHoles),t=refine(p,faces,index,thumbnail),offset=points.length;for(const q of p)points.push(q);for(const q of t)tris.push(q.map(v=>v+offset));}
 return{points,tris};
}
export function rectangle(w,h,r=4){const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
export function borderPoints(w,h,r=5,margin=3.2){return rectangle(w-2*margin,h-2*margin,Math.max(.5,r-margin)).getPoints(12).map(p=>[p.x,p.y]);}
export class PanelAssembly{
 constructor(mats,config={}){this.root=new T.Group();this.parts=[];this.mats=mats;this.config={thicknessScale:1,tension:.8,response:true,age:0,craft:'plain',...config};this.positions=[];this.triangles=[];this.links=[];this.surfaceLinks=[];this.extraMass=[];this.skinMeshes=[];this.seams=[];this.nextId=0;this.weld=new Map();}
 add(def){
  const t=def.t*this.config.thicknessScale,part={...def,t,index:this.parts.length,nu:Math.max(2,Math.ceil(def.w/(def.simStep||13))),nv:Math.max(2,Math.ceil(def.h/(def.simStep||13))),normal:(x,y)=>{if(def.name==='formed-crown-top'){x=clamp(x,-def.w/2+.08,def.w/2-.08);y=clamp(y,-def.h/2+.08,def.h/2-.08);}const a=def.map(x+.02,y).sub(def.map(x-.02,y)),b=def.map(x,y+.02).sub(def.map(x,y-.02));let n=a.cross(b);if(n.lengthSq()<1e-12)n.set(0,def.flip?-1:1,0);return n.normalize().multiplyScalar(def.flip?-1:1);}};
  const ids=[];for(let j=0;j<=part.nv;j++)for(let i=0;i<=part.nu;i++){const u=(i/part.nu-.5)*def.w,v=(j/part.nv-.5)*def.h,p=def.map(u,v),key=part.index+':'+p.toArray().map(v=>Math.round(v*10000)).join(',');let id=this.weld.get(key);if(id===undefined){id=this.positions.length/3;this.positions.push(...p);this.weld.set(key,id);}ids.push(id);}
  part.grid=ids;for(let j=0;j<part.nv;j++)for(let i=0;i<part.nu;i++){const a=ids[j*(part.nu+1)+i],b=ids[j*(part.nu+1)+i+1],c=ids[(j+1)*(part.nu+1)+i],d=ids[(j+1)*(part.nu+1)+i+1];const ts=def.flip?[[a,c,b],[b,c,d]]:[[a,b,c],[b,d,c]];for(const q of ts)if(new Set(q).size===3)this.triangles.push([...q,t,def.formed===false?0:1]);}
  part.paths=(def.paths||[]).map((p,i)=>new SeamPath(p.points,def.map,{pitch:3.4,diameter:Math.min(.4,.28+t*.025),totalThickness:t,center:0,tension:this.config.tension,response:this.config.response,id:def.name+'-'+i,...p.options}));part.seamIndex=new SeamIndex(part.paths);this.parts.push(part);this.seams.push(...part.paths);
  this.buildPanel(part);for(let pathIndex=0;pathIndex<part.paths.length;pathIndex++){const path=part.paths[pathIndex];if(def.paths?.[pathIndex]?.options?.threadVisible===false)continue;const yarn=makeSewnYarn(path,part,this,this.mats.thread);this.root.add(yarn);this.skinMeshes.push(yarn);}return part;
 }
 idsAt(part,u,v){const x=clamp((u/part.w+.5)*part.nu,0,part.nu-.000001),y=clamp((v/part.h+.5)*part.nv,0,part.nv-.000001),i=Math.floor(x),j=Math.floor(y),s=x-i,t=y-j,k=j*(part.nu+1)+i;return{ids:[part.grid[k],part.grid[k+1],part.grid[k+part.nu+1],part.grid[k+part.nu+2]],weights:[(1-s)*(1-t),s*(1-t),(1-s)*t,s*t]};}
 binding(part,u,v,p,n){if(this.config.thumbnail)return null;const q=this.idsAt(part,u,v),P=q.ids.map(id=>V(...this.positions.slice(id*3,id*3+3))),Q=V();for(let j=0;j<4;j++)Q.addScaledVector(P[j],q.weights[j]);const X=P[1].clone().sub(P[0]).add(P[3].clone().sub(P[2])).normalize(),B=P[2].clone().sub(P[0]).add(P[3].clone().sub(P[1])),N=X.clone().cross(B).normalize();if(N.lengthSq()<.1)N.copy(part.normal(u,v));const Y=N.clone().cross(X).normalize(),d=p.clone().sub(Q);return{...q,delta:[d.dot(X),d.dot(Y),d.dot(N)],normal:[n.dot(X),n.dot(Y),n.dot(N)],age:[Math.exp(-Math.min(part.w/2-Math.abs(u),part.h/2-Math.abs(v))/5),Math.pow(Math.sin(u*.049+v*.034),14),clamp(n.y*.65+.35,0,1)]};}
 geometry(pos,nor,uv,idx,bindings){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('uv1',g.attributes.uv.clone());g.setAttribute('compression',new T.Float32BufferAttribute(new Float32Array(pos.length/3),1));if(!this.config.thumbnail)for(const[name,key,size]of[['simIDs','ids',4],['simWeights','weights',4],['simDelta','delta',3],['simNormal','normal',3],['ageMask','age',3]])g.setAttribute(name,new T.Float32BufferAttribute(bindings.flatMap(v=>v[key]),size));g.setIndex(idx);g.computeBoundingSphere();return g;}
 buildPanel(part){
  const shape=part.shape||rectangle(part.w,part.h,0),outer=shape.getPoints(12).map(p=>p.clone());if(outer[0].distanceTo(outer.at(-1))<1e-8)outer.pop();
  const holes=[];const pool=[];for(const path of part.paths)for(const h of path.holes){if(h.uv.x< -part.w/2+.8||h.uv.x>part.w/2-.8||h.uv.y< -part.h/2+.8||h.uv.y>part.h/2-.8)continue;let near=pool.find(q=>q.uv.distanceTo(h.uv)<.80);if(near){near.rx=Math.max(near.rx,near.uv.distanceTo(h.uv)+h.rx);near.rz=near.rx;near.merged=true;}else pool.push({...h,uv:h.uv.clone()});}
  for(const h of pool){const ring=[];for(let j=0;j<16;j++){const a=j/16*Math.PI*2,f=1+.012*Math.sin(a*5+h.index*1.73),x=Math.cos(a)*h.rx*f,y=Math.sin(a)*h.rz*f;ring.push(new T.Vector2(h.uv.x+x*Math.cos(h.angle)-y*Math.sin(h.angle),h.uv.y+x*Math.sin(h.angle)+y*Math.cos(h.angle)));}holes.push(ring);}
  for(const h of part.extraHoles||[]){const ring=[];for(let j=0;j<24;j++){const a=j/24*Math.PI*2;ring.push(new T.Vector2(h.x+Math.cos(a)*h.r,h.y+Math.sin(a)*(h.ry||h.r)));}holes.push(ring);}
  for(const path of shape.holes){const ring=path.getPoints(32);if(ring[0].distanceTo(ring.at(-1))<1e-8)ring.pop();holes.push(ring);}
  const {points,tris}=triangulatePaper(outer,holes,part.seamIndex,this.config.thumbnail),P=[],N=[],UV=[],I=[],bindings=[];
  const at=(u,v,sign)=>{const r=seamRelief(part.seamIndex,u,v,sign),x=u+r.u,y=v+r.v,n=part.normal(x,y);return part.map(x,y).addScaledVector(n,sign*part.t/2+r.w);};
  const add=(p,n,u,v)=>{P.push(...p);N.push(...n);UV.push(u/96,v/96);bindings.push(this.binding(part,u,v,p,n));};
  for(const sign of[1,-1])for(const q of points){const p=at(q.x,q.y,sign),a=at(q.x+.035,q.y,sign).sub(at(q.x-.035,q.y,sign)),b=at(q.x,q.y+.035,sign).sub(at(q.x,q.y-.035,sign)),n=a.cross(b).normalize().multiplyScalar(sign*(part.flip?-1:1));add(p,n,q.x,q.y);}
  for(let side=0;side<2;side++)for(const t of tris){const q=t.map(i=>i+side*points.length);if(Boolean(side)!==!!part.flip)[q[1],q[2]]=[q[2],q[1]];I.push(...q);}
  const surfaceCount=tris.length*3,edgeStart=I.length;
  for(const[ri,ring]of[outer,...holes].entries())for(let j=0;j<ring.length;j++){const a=ring[j],b=ring[(j+1)%ring.length],ta=at(a.x,a.y,1),tb=at(b.x,b.y,1),ba=at(a.x,a.y,-1),bb=at(b.x,b.y,-1),start=P.length/3;
   let norm=tb.clone().sub(ta).cross(ba.clone().sub(ta)).normalize();const edge=b.clone().sub(a),mid=a.clone().add(b).multiplyScalar(.5),desired=part.map(mid.x+edge.y*.01,mid.y-edge.x*.01).sub(part.map(mid.x,mid.y)).normalize();const cw=T.ShapeUtils.isClockWise(ring);if((ri===0&&cw)||(ri>0&&!cw))desired.negate();if(norm.dot(desired)<0)norm.negate();
   for(const [p,q]of[[ta,a],[tb,b],[ba,a],[bb,b]])add(p,norm,q.x,q.y);const f=tb.clone().sub(ta).cross(ba.clone().sub(ta));if(f.dot(norm)>0)I.push(start,start+1,start+2,start+1,start+3,start+2);else I.push(start,start+2,start+1,start+1,start+2,start+3);
  }
  const g=this.geometry(P,N,UV,I,bindings);g.addGroup(0,surfaceCount,0);g.addGroup(surfaceCount,surfaceCount,1);g.addGroup(edgeStart,I.length-edgeStart,2);g.userData={punchedHoles:holes.length,stitchHoles:pool.length,mergedCrossingApertures:pool.filter(p=>p.merged).length,contactFromR05:true};const mesh=new T.Mesh(g,this.mats.shell);mesh.name=part.name;mesh.userData.leather=true;mesh.userData.panel=part.index;mesh.castShadow=mesh.receiveShadow=true;this.root.add(mesh);this.skinMeshes.push(mesh);part.mesh=mesh;part.punchCount=holes.length;
 }
 connect(a,uvA,b,uvB){
  const A=this.idsAt(a,...uvA),B=this.idsAt(b,...uvB),weights=new Map();
  for(let i=0;i<4;i++){weights.set(A.ids[i],(weights.get(A.ids[i])||0)+A.weights[i]);weights.set(B.ids[i],(weights.get(B.ids[i])||0)-B.weights[i]);}
  const entries=[...weights].filter(([,w])=>Math.abs(w)>1e-10);if(!entries.length)return;
  const delta=V();for(const[id,w]of entries)delta.addScaledVector(V(...this.positions.slice(id*3,id*3+3)),w);
  this.surfaceLinks.push({ids:entries.map(e=>e[0]),weights:entries.map(e=>e[1]),length:delta.length()*.001,stiffness:100000});
 }
 attachRigid(object,part,u,v,massKg=0){object.updateMatrixWorld(true);const source=[];object.traverse(m=>{if(!m.isMesh)return;let g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrixWorld);const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,bindings=[];for(let i=0;i<p.count;i++)bindings.push(this.binding(part,u,v,V().fromBufferAttribute(p,i),V().fromBufferAttribute(n,i)));const ng=this.geometry(Array.from(p.array),Array.from(n.array),uv?Array.from(uv.array):Array(p.count*2).fill(0),Array.from({length:p.count},(_,i)=>i),bindings);const nm=new T.Mesh(ng,m.material);nm.name='RIGID_FITTING/'+(m.name||'metal');nm.castShadow=nm.receiveShadow=true;nm.userData.hardware=true;this.root.add(nm);this.skinMeshes.push(nm);source.push(nm);});const ids=this.idsAt(part,u,v);for(let i=0;i<4;i++)this.extraMass.push([ids.ids[i],massKg*ids.weights[i]]);return source;}
 finish(){this.root.updateMatrixWorld(true);const b=new T.Box3().setFromObject(this.root),shift=.8-b.min.y;for(const m of this.skinMeshes){m.geometry.translate(0,shift,0);}for(let i=1;i<this.positions.length;i+=3)this.positions[i]+=shift;
  const data={positions:this.positions,triangles:this.triangles,links:this.links,surfaceLinks:this.surfaceLinks,extraMass:this.extraMass};const pixels=new Float32Array(this.positions.length/3*4);for(let i=0;i<this.positions.length/3;i++){pixels[i*4]=this.positions[i*3];pixels[i*4+1]=this.positions[i*3+1];pixels[i*4+2]=this.positions[i*3+2];pixels[i*4+3]=1;}const texture=new T.DataTexture(pixels,1,pixels.length/4,T.RGBAFormat,T.FloatType);texture.needsUpdate=true;
  const rig={staticPreview:!!this.config.thumbnail,data,texture,pixels,meshes:this.skinMeshes,parts:this.parts,seams:this.seams,age:this.config.age,bindingShift:shift};this.root.userData.rig=rig;this.root.userData.center=new T.Box3().setFromObject(this.root).getCenter(V());this.root.userData.patternReady=false;return this.root;
 }
}
const SKIN_HEADER=`uniform sampler2D uProductNodes;uniform float uProductNodeCount;
attribute vec4 simIDs;attribute vec4 simWeights;attribute vec3 simDelta;attribute vec3 simNormal;attribute vec3 ageMask;
varying vec3 vAgeMask;varying vec3 vRestMM;
vec3 nodePos(float id){return texture2D(uProductNodes,vec2(1./6.,(id+.5)/uProductNodeCount)).xyz;}
vec3 nodeFrame(float id,float x){return texture2D(uProductNodes,vec2(x,(id+.5)/uProductNodeCount)).xyz;}
mat3 productBasis(){vec3 x=nodeFrame(simIDs.x,.5)*simWeights.x+nodeFrame(simIDs.y,.5)*simWeights.y+nodeFrame(simIDs.z,.5)*simWeights.z+nodeFrame(simIDs.w,.5)*simWeights.w;vec3 n=nodeFrame(simIDs.x,5./6.)*simWeights.x+nodeFrame(simIDs.y,5./6.)*simWeights.y+nodeFrame(simIDs.z,5./6.)*simWeights.z+nodeFrame(simIDs.w,5./6.)*simWeights.w;vec3 z=normalize(n+vec3(0.,1e-15,0.));x=normalize(x-z*dot(x,z)+vec3(1e-15,0.,0.));return mat3(x,cross(z,x),z);}
vec3 productPoint(mat3 basis){return nodePos(simIDs.x)*simWeights.x+nodePos(simIDs.y)*simWeights.y+nodePos(simIDs.z)*simWeights.z+nodePos(simIDs.w)*simWeights.w+basis*simDelta;}`;
export function skinMaterial(source,rig,ageEnabled=true){
 const m=source.clone(),prior=source.onBeforeCompile;const previousKey=source.customProgramCacheKey?.()||'';m.onBeforeCompile=s=>{prior?.call(m,s);s.uniforms.uProductNodes={value:rig.texture};s.uniforms.uProductNodeCount={value:rig.nodeCount||rig.pixels.length/4};s.uniforms.uPatina={value:rig.age};m.userData.shader=s;
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\n'+SKIN_HEADER).replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nmat3 skinBasis=productBasis();objectNormal=normalize(skinBasis*simNormal);').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=productPoint(productBasis());vAgeMask=ageMask;vRestMM=position;');
  if(ageEnabled){s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>\nuniform float uPatina;varying vec3 vAgeMask;varying vec3 vRestMM;
float ageNoise(vec3 p){return fract(sin(dot(p,vec3(12.989,78.231,31.117)))*43758.5453);}`);
   s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float largeWear=.5+.5*sin(vRestMM.x*.039+sin(vRestMM.z*.081)*1.8+vRestMM.y*.043);
float fineWear=ageNoise(floor(vRestMM*vec3(7.,14.,5.)));
float rimWear=clamp(vAgeMask.x,0.,1.)*(.4+.6*largeWear);
float polish=uPatina*(rimWear*.48+vAgeMask.y*.20);
float sunFade=uPatina*vAgeMask.z*(.035+.065*largeWear);
diffuseColor.rgb*=1.+sunFade-rimWear*uPatina*.12;
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.42+vec3(.027,.012,.004),uPatina*rimWear*.36);
float scratches=pow(fineWear,48.)*smoothstep(.42,.7,largeWear)*rimWear*uPatina;
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.8+vec3(.028,.020,.01),scratches*.48);`);
   s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor-polish*.16+sunFade*.18,.14,.98);');
  }
 };m.customProgramCacheKey=()=>previousKey+'-R07-product-skin-'+ageEnabled;return m;
}
export function installSkin(root){const rig=root.userData.rig;if(rig.staticPreview)return;const cache=new Map();const mat=(m,age)=>{const key=m.uuid+age;if(!cache.has(key))cache.set(key,skinMaterial(m,rig,age));return cache.get(key);};for(const mesh of rig.meshes){mesh.material=Array.isArray(mesh.material)?mesh.material.map((m,i)=>mat(m,true)):mat(mesh.material,!mesh.userData.thread);const depth=skinMaterial(new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking}),rig,false);mesh.customDepthMaterial=depth;mesh.frustumCulled=false;}rig.materialCache=cache;}
function frameField(r,x){const tangent=new Float64Array(r.nodeCount*3),normal=new Float64Array(r.nodeCount*3),out=[];
 for(const f of r.frameTriangles){const[a,b,c]=f.ids,A=V(...x.slice(a*3,a*3+3)),U=V(...x.slice(b*3,b*3+3)).sub(A),W=V(...x.slice(c*3,c*3+3)).sub(A),du=U.clone().multiplyScalar(f.inv[0]).addScaledVector(W,f.inv[2]),dv=U.clone().multiplyScalar(f.inv[1]).addScaledVector(W,f.inv[3]),n=du.clone().cross(dv).normalize().multiplyScalar(f.flip?-f.area:f.area);du.normalize().multiplyScalar(f.area);for(const id of f.ids)for(let j=0;j<3;j++){tangent[id*3+j]+=du.getComponent(j);normal[id*3+j]+=n.getComponent(j);}}
 for(let i=0;i<r.nodeCount;i++){const n=V(...normal.slice(i*3,i*3+3)).normalize(),t=V(...tangent.slice(i*3,i*3+3));if(n.lengthSq()<.1)n.copy(r.referenceFrames[i].n);t.addScaledVector(n,-t.dot(n)).normalize();if(t.lengthSq()<.1)t.copy(r.referenceFrames[i].t);out.push({t,n,y:n.clone().cross(t)});}return out;
}
export function updateSkin(root,solver){const r=root.userData.rig;if(!r.nodeCount)throw Error('R08 physical skin contract missing');if(!r.restFrameField)r.restFrameField=frameField(r,solver.rest);const field=frameField(r,solver.x);
 for(let i=0;i<r.nodeCount;i++){const a=r.restFrameField[i],b=field[i],f=r.referenceFrames[i],rotate=v=>b.t.clone().multiplyScalar(v.dot(a.t)).addScaledVector(b.y,v.dot(a.y)).addScaledVector(b.n,v.dot(a.n)).normalize(),t=rotate(f.t),n=rotate(f.n);for(let j=0;j<3;j++){r.pixels[i*12+j]=solver.x[i*3+j]*1000;r.pixels[i*12+4+j]=t.getComponent(j);r.pixels[i*12+8+j]=n.getComponent(j);}}r.texture.needsUpdate=true;}
export function reskinMaterial(root,top){const rig=root.userData.rig;if(rig.staticPreview){for(const mesh of rig.meshes)if(mesh.userData.leather){if(Array.isArray(mesh.material))mesh.material[0]=top;else if(mesh.userData.binding)mesh.material=top;}return;}if(!rig.topVariants)rig.topVariants=new Map();if(!rig.topVariants.has(top.uuid)){for(const mat of rig.topVariants.values())mat.dispose();rig.topVariants.clear();rig.topVariants.set(top.uuid,skinMaterial(top,rig,true));}const m=rig.topVariants.get(top.uuid);for(const mesh of rig.meshes)if(mesh.userData.leather){if(Array.isArray(mesh.material))mesh.material[0]=m;else if(mesh.userData.binding)mesh.material=m;}}
