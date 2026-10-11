// Adaptive variant of the inherited R03-B constrained triangulator. Original file unchanged.
import * as T from 'three';
import {clean,inside} from '../../r03b/src/surface.mjs';
import {sub,dot} from './geometry.mjs';
function delaunay(vertices,triangles){
 const edgeKey=(a,b)=>a<b?a+','+b:b+','+a,edges=new Map(),queue=[];
 const add=(id)=>{const t=triangles[id];for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],c=t[(k+2)%3],key=edgeKey(a,b);let e=edges.get(key);if(!e){e={a,b,ts:new Map()};edges.set(key,e);}e.ts.set(id,c);if(e.ts.size===2)queue.push(key);}};
 const remove=(id)=>{const t=triangles[id];for(let k=0;k<3;k++){const key=edgeKey(t[k],t[(k+1)%3]),e=edges.get(key);if(e){e.ts.delete(id);if(!e.ts.size)edges.delete(key);}}};
 const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const ccw=t=>orient(...t.map(i=>vertices[i]))>=0?t:[t[0],t[2],t[1]];
 const cot=(a,b,c)=>{const u=sub(a,c),v=sub(b,c);return dot(u,v)/Math.max(1e-16,Math.abs(u[0]*v[1]-u[1]*v[0]));};
 triangles.forEach((t,i)=>add(i));let flips=0;
 for(let q=0;q<queue.length&&q<3000000;q++){const e=edges.get(queue[q]);if(!e||e.ts.size!==2)continue;const[[i,c],[j,d]]=[...e.ts],a=e.a,b=e.b;if(c===d)continue;const A=vertices[a],B=vertices[b],C=vertices[c],D=vertices[d];if(orient(C,D,A)*orient(C,D,B)>=-1e-16)continue;if(cot(A,B,C)+cot(A,B,D)>=-1e-8)continue;if(edges.has(edgeKey(c,d)))continue;remove(i);remove(j);triangles[i]=ccw([c,d,a]);triangles[j]=ccw([d,c,b]);add(i);add(j);flips++;}
 return triangles;
}
export function makeTemplate(footprints,punches=[],spacing=5){
 const vertices=[],triangles=[],loops=[];
 for(const f of footprints){const outer=clean(f.outer),holes=[...f.holes.map(clean),...punches.filter(q=>inside(q,f.outer)).map(q=>Array.from({length:8},(_,j)=>[q[0]+.5*Math.cos(j*Math.PI/4),q[1]+.5*Math.sin(j*Math.PI/4)]))];const off=vertices.length;let contour=outer.map(p=>new T.Vector2(...p)),hs=holes.map(l=>l.map(p=>new T.Vector2(...p)));const flat=[outer,...holes].flat();vertices.push(...flat);let cur=off;for(const l of [outer,...holes]){loops.push(Array.from({length:l.length},(_,i)=>cur+i));cur+=l.length;}triangles.push(...T.ShapeUtils.triangulateShape(contour,hs).map(t=>t.map(i=>off+i)));}
 let tris=triangles.map(t=>{const [a,b,c]=t.map(i=>vertices[i]);return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<0?[t[0],t[2],t[1]]:t;});
 tris=delaunay(vertices,tris);
 const key=(a,b)=>a<b?a+','+b:b+','+a;
 for(let pass=0;pass<10;pass++){
  const mids=new Map();for(const [a,b,c]of tris)for(const [i,j]of [[a,b],[b,c],[c,a]])if((typeof spacing==='function'?spacing(vertices[i],vertices[j]):Math.hypot(...sub(vertices[i],vertices[j]))>spacing)){const k=key(i,j);if(!mids.has(k)){mids.set(k,vertices.length);vertices.push(vertices[i].map((x,k)=>(x+vertices[j][k])/2));}}
  if(!mids.size)break;const next=[];for(const t of tris){const [a,b,c]=t,m=[mids.get(key(a,b)),mids.get(key(b,c)),mids.get(key(c,a))],count=m.filter(x=>x!==undefined).length;if(!count)next.push(t);else if(count===3)next.push([a,m[0],m[2]],[m[0],b,m[1]],[m[2],m[1],c],[m[0],m[1],m[2]]);else if(count===1){const j=m.findIndex(x=>x!==undefined),u=t[j],v=t[(j+1)%3],w=t[(j+2)%3],z=m[j];next.push([u,z,w],[z,v,w]);}else{const j=m.findIndex(x=>x===undefined),u=t[j],v=t[(j+1)%3],w=t[(j+2)%3],vw=m[(j+1)%3],wu=m[(j+2)%3];next.push([w,wu,vw],[u,v,vw],[u,vw,wu]);}}tris=delaunay(vertices,next);
  if(vertices.length>90000)throw Error('Template refinement budget exceeded');
 }
 const edges=new Map();for(const t of tris)for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],k=key(a,b);if(edges.has(k))edges.delete(k);else edges.set(k,[a,b]);}
 return{vertices,triangles:tris,boundaryEdges:[...edges.values()],punchCount:punches.length,sourceHoleCount:footprints.reduce((s,f)=>s+f.holes.length,0)};
}
