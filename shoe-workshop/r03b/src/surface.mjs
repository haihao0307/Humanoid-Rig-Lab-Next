import * as T from 'three';
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
export const norm=a=>{const l=Math.hypot(...a);return a.map(v=>v/Math.max(l,1e-12));};
export class MeshRay{
 constructor(source){this.source=source;const p=source.positions,ix=source.indices;this.tris=[];for(let i=0;i<ix.length;i+=3){const ids=ix.slice(i,i+3),v=ids.map(id=>p.slice(id*3,id*3+3));this.tris.push({ids,v,min:[0,1,2].map(k=>Math.min(...v.map(q=>q[k]))),max:[0,1,2].map(k=>Math.max(...v.map(q=>q[k]))),center:[0,1,2].map(k=>(v[0][k]+v[1][k]+v[2][k])/3)});}this.bvh=this.node(this.tris);}
 node(ts){const min=[0,1,2].map(k=>Math.min(...ts.map(t=>t.min[k]))),max=[0,1,2].map(k=>Math.max(...ts.map(t=>t.max[k]))),o={min,max};if(ts.length<12){o.ts=ts;return o;}let k=0;for(let j=1;j<3;j++)if(max[j]-min[j]>max[k]-min[k])k=j;ts.sort((a,b)=>a.center[k]-b.center[k]);const m=ts.length>>1;o.a=this.node(ts.slice(0,m));o.b=this.node(ts.slice(m));return o;}
 ray(origin,dir){let best=Infinity,result=null;const box=n=>{let lo=0,hi=best;for(let k=0;k<3;k++){if(Math.abs(dir[k])<1e-12){if(origin[k]<n.min[k]||origin[k]>n.max[k])return false;continue;}let a=(n.min[k]-origin[k])/dir[k],b=(n.max[k]-origin[k])/dir[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return false;}return true;};
 const visit=node=>{if(!box(node))return;if(node.ts){for(const t of node.ts){const [a,b,c]=t.v,e1=sub(b,a),e2=sub(c,a),h=cross(dir,e2),det=dot(e1,h);if(Math.abs(det)<1e-10)continue;const inv=1/det,s=sub(origin,a),u=inv*dot(s,h);if(u< -1e-7||u>1.0000001)continue;const q=cross(s,e1),v=inv*dot(dir,q);if(v< -1e-7||u+v>1.0000001)continue;const dist=inv*dot(e2,q);if(dist>1e-7&&dist<best){best=dist;let normal=cross(e1,e2);const ns=this.source.normals;if(ns?.length===this.source.positions.length)normal=[0,1,2].map(k=>(1-u-v)*ns[t.ids[0]*3+k]+u*ns[t.ids[1]*3+k]+v*ns[t.ids[2]*3+k]);normal=norm(normal);if(dot(normal,dir)<0&&this.outwardFromInside)normal=normal.map(x=>-x);result={p:origin.map((x,k)=>x+dir[k]*dist),n:normal,distance:dist};}}}else{visit(node.a);visit(node.b);}};visit(this.bvh);return result;}
}
export class ThinPlate{
 constructor(anchors,regularization=.01){this.anchors=anchors;const n=anchors.length,m=n+3,A=Array.from({length:m},()=>Array(m+3).fill(0)),phi=r=>r<1e-16?0:r*Math.log(r);
  for(let i=0;i<n;i++){const x=anchors[i][0]/100,y=anchors[i][1]/100;for(let j=0;j<n;j++)A[i][j]=phi((x-anchors[j][0]/100)**2+(y-anchors[j][1]/100)**2)+(i===j?regularization:0);A[i][n]=A[n][i]=1;A[i][n+1]=A[n+1][i]=x;A[i][n+2]=A[n+2][i]=y;for(let k=0;k<3;k++)A[i][m+k]=anchors[i][2+k];}
  for(let i=0;i<m;i++){let pivot=i;for(let j=i+1;j<m;j++)if(Math.abs(A[j][i])>Math.abs(A[pivot][i]))pivot=j;if(Math.abs(A[pivot][i])<1e-15)throw Error('Degenerate mapping anchors');[A[i],A[pivot]]=[A[pivot],A[i]];const f=A[i][i];for(let k=i;k<m+3;k++)A[i][k]/=f;for(let j=0;j<m;j++)if(j!==i){const f=A[j][i];for(let k=i;k<m+3;k++)A[j][k]-=f*A[i][k];}}
  this.coeffs=A.map(r=>r.slice(m));
 }
 eval(x,y){x/=100;y/=100;const n=this.anchors.length,q=this.coeffs[n].map((v,k)=>v+x*this.coeffs[n+1][k]+y*this.coeffs[n+2][k]);for(let i=0;i<n;i++){const r=(x-this.anchors[i][0]/100)**2+(y-this.anchors[i][1]/100)**2,w=r<1e-16?0:r*Math.log(r);for(let k=0;k<3;k++)q[k]+=this.coeffs[i][k]*w;}return q;}
}
export function clean(loop){const out=[];for(const q of loop)if(!out.length||Math.hypot(q[0]-out.at(-1)[0],q[1]-out.at(-1)[1])>1e-5)out.push(q.slice(0,2));if(Math.hypot(out[0][0]-out.at(-1)[0],out[0][1]-out.at(-1)[1])<1e-5)out.pop();return out;}
export function inside(q,loop){let hit=false;for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[i],b=loop[j];if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
export function boundaryDistance(q,loop){let d=Infinity;for(let i=0;i<loop.length;i++){const a=loop[i],b=loop[(i+1)%loop.length],v=sub(b,a),l=dot(v,v),t=Math.min(1,Math.max(0,dot(sub(q,a),v)/Math.max(l,1e-20)));d=Math.min(d,Math.hypot(q[0]-a[0]-v[0]*t,q[1]-a[1]-v[1]*t));}return d;}
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
  const mids=new Map();for(const [a,b,c]of tris)for(const [i,j]of [[a,b],[b,c],[c,a]])if(Math.hypot(...sub(vertices[i],vertices[j]))>spacing){const k=key(i,j);if(!mids.has(k)){mids.set(k,vertices.length);vertices.push(vertices[i].map((x,k)=>(x+vertices[j][k])/2));}}
  if(!mids.size)break;const next=[];for(const t of tris){const [a,b,c]=t,m=[mids.get(key(a,b)),mids.get(key(b,c)),mids.get(key(c,a))],count=m.filter(x=>x!==undefined).length;if(!count)next.push(t);else if(count===3)next.push([a,m[0],m[2]],[m[0],b,m[1]],[m[2],m[1],c],[m[0],m[1],m[2]]);else if(count===1){const j=m.findIndex(x=>x!==undefined),u=t[j],v=t[(j+1)%3],w=t[(j+2)%3],z=m[j];next.push([u,z,w],[z,v,w]);}else{const j=m.findIndex(x=>x===undefined),u=t[j],v=t[(j+1)%3],w=t[(j+2)%3],vw=m[(j+1)%3],wu=m[(j+2)%3];next.push([w,wu,vw],[u,v,vw],[u,vw,wu]);}}tris=delaunay(vertices,next);
  if(vertices.length>90000)throw Error('Template refinement budget exceeded');
 }
 const edges=new Map();for(const t of tris)for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],k=key(a,b);if(edges.has(k))edges.delete(k);else edges.set(k,[a,b]);}
 return{vertices,triangles:tris,boundaryEdges:[...edges.values()],punchCount:punches.length,sourceHoleCount:footprints.reduce((s,f)=>s+f.holes.length,0)};
}
export function makeShell(template,mapper,thickness,offset=0){
 const points=[],normals=[],positions=[],uv=[],n=template.vertices.length;let misses=0;
 for(const [x,y]of template.vertices){const v=mapper(x,y);if(!v)throw Error('Mapping ray missed');points.push(v.p);normals.push(v.n);if(v.fallback)misses++;}
 const logicalIndices=Array.from({length:n*2},(_,i)=>i);const indices=[],sign=(t)=>{const [a,b,c]=t;return dot(cross(sub(points[b],points[a]),sub(points[c],points[a])),normals[a])>0;};
 for(let layer=0;layer<2;layer++)for(let i=0;i<n;i++){const p=points[i],nn=normals[i],d=offset+layer*thickness;positions.push(...p.map((v,k)=>v+nn[k]*d));uv.push(template.vertices[i][0]/50,template.vertices[i][1]/50);}
 const positive=template.triangles.filter(sign).length>=template.triangles.length/2;
 for(const t of template.triangles){const [a,b,c]=positive?t:[t[0],t[2],t[1]];indices.push(a+n,b+n,c+n,a,c,b);}
 const shaderNormals=[];for(let layer=0;layer<2;layer++)for(const nn of normals)shaderNormals.push(...nn.map(v=>v*(layer?1:-1)));
 const wallStart=indices.length;for(let [a,b]of template.boundaryEdges){if(!positive)[a,b]=[b,a];const pa=positions.slice(a*3,a*3+3),pb=positions.slice(b*3,b*3+3),pb2=positions.slice((b+n)*3,(b+n)*3+3),pa2=positions.slice((a+n)*3,(a+n)*3+3),wn=norm(cross(sub(pb,pa),sub(pb2,pa))),off=positions.length/3;for(const p of [pa,pb,pb2,pa2]){positions.push(...p);shaderNormals.push(...wn);uv.push(0,0);}logicalIndices.push(a,b,b+n,a+n);indices.push(off,off+1,off+2,off,off+2,off+3);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.setAttribute('normal',new T.Float32BufferAttribute(shaderNormals,3));g.addGroup(0,wallStart,0);g.addGroup(wallStart,indices.length-wallStart,1);
 const strains=[];let plus=0,minus=0,minArea=Infinity;for(const t of template.triangles){const [a,b,c]=t;const cr=cross(sub(points[b],points[a]),sub(points[c],points[a])),ar=Math.hypot(...cr)/2;minArea=Math.min(minArea,ar);if(dot(cr,normals[a])>0)plus++;else minus++;for(const [i,j]of [[a,b],[b,c],[c,a]]){const rest=Math.hypot(...sub((template.restUV||template.vertices)[i],(template.restUV||template.vertices)[j]));if(rest>.05)strains.push((Math.hypot(...sub(points[i],points[j]))/rest-1)*100);}}
 strains.sort((a,b)=>a-b);const q=p=>strains[Math.min(strains.length-1,Math.floor(strains.length*p))];
 g.userData={logicalIndices,thickness,offset,points,normals,vertexPairs:n,template,report:{thicknessMm:thickness,vertexPairs:n,triangles:indices.length/3,boundarySegments:template.boundaryEdges.length,originalHoles:template.sourceHoleCount,punchedHoles:template.punchCount,rayFallbacks:misses,normalAlignmentMinorityTriangles:Math.min(plus,minus),minTriangleAreaMm2:minArea,edgeLengthChangePercent:{min:q(0),p05:q(.05),median:q(.5),p95:q(.95),max:q(1)},physicalSolver:false}};return g;
}
