'use strict';
// Offline original-surface measurements only. Never bundled in a runtime.
const sub=(a,b)=>a.map((v,k)=>v-b[k]),add=(a,b)=>a.map((v,k)=>v+b[k]),mul=(a,b)=>a.map(v=>v*b),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/(Math.hypot(...a)||1));
const point=(a,i)=>a.slice(i*3,i*3+3);
function closestTriangle(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
 if(d1<=0&&d2<=0)return{p:a,bary:[1,0,0]};
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return{p:b,bary:[0,1,0]};
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return{p:add(a,mul(ab,v)),bary:[1-v,v,0]};}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return{p:c,bary:[0,0,1]};
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return{p:add(a,mul(ac,w)),bary:[1-w,0,w]};}
 const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return{p:add(b,mul(sub(c,b),w)),bary:[0,1-w,w]};}
 const den=va+vb+vc;if(Math.abs(den)<1e-35){const q=[a,b,c].map((v,i)=>({p:v,bary:[+(i===0),+(i===1),+(i===2)]}));return q.sort((u,v)=>dot(sub(p,u.p),sub(p,u.p))-dot(sub(p,v.p),sub(p,v.p)))[0];}
 const v=vb/den,w=vc/den;return{p:add(a,add(mul(ab,v),mul(ac,w))),bary:[1-v-w,v,w]};
}
function create(reference){
 const positions=reference.positionsYUp,faces=reference.faces,normals=reference.normalsYUp;
 const tris=Array.from({length:faces.length/3},(_,i)=>{const ids=faces.slice(i*3,i*3+3),p=ids.map(j=>point(positions,j));return{i,ids,p,bounds:[0,1,2].map(k=>[Math.min(...p.map(q=>q[k])),Math.max(...p.map(q=>q[k]))]),centre:[0,1,2].map(k=>p.reduce((s,q)=>s+q[k]/3,0))};});
 function build(list){const bounds=[0,1,2].map(k=>[Math.min(...list.map(t=>t.bounds[k][0])),Math.max(...list.map(t=>t.bounds[k][1]))]);if(list.length<=12)return{bounds,list};const axis=[0,1,2].sort((a,b)=>(bounds[b][1]-bounds[b][0])-(bounds[a][1]-bounds[a][0]))[0];list.sort((a,b)=>a.centre[axis]-b.centre[axis]);const mid=list.length>>1;return{bounds,left:build(list.slice(0,mid)),right:build(list.slice(mid))};}
 const root=build(tris.slice());
 const boxDistance=(p,b)=>p.reduce((s,v,k)=>s+Math.max(b[k][0]-v,v-b[k][1],0)**2,0);
 function normal(t,bary){return unit([0,1,2].map(k=>t.ids.reduce((s,j,i)=>s+normals[j*3+k]*bary[i],0)));}
 function closest(p){let best=Infinity,hit=null;function visit(n){if(boxDistance(p,n.bounds)>best)return;if(n.list){for(const t of n.list){const q=closestTriangle(p,...t.p),d=dot(sub(p,q.p),sub(p,q.p));if(d<best){best=d;hit={...q,triangle:t.i,ids:t.ids,normal:normal(t,q.bary),geometricNormal:unit(cross(sub(t.p[1],t.p[0]),sub(t.p[2],t.p[0])))};}}}else{const order=boxDistance(p,n.left.bounds)<boxDistance(p,n.right.bounds)?[n.left,n.right]:[n.right,n.left];visit(order[0]);visit(order[1]);}}visit(root);return{...hit,distance:Math.sqrt(best)};}
 function rayBox(ro,rd,b,limit){let lo=0,hi=limit;for(let k=0;k<3;k++){if(Math.abs(rd[k])<1e-15){if(ro[k]<b[k][0]||ro[k]>b[k][1])return false;continue;}let a=(b[k][0]-ro[k])/rd[k],c=(b[k][1]-ro[k])/rd[k];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)return false;}return true;}
 function ray(ro,rd,limit=Infinity,frontOnly=false){const hits=[];function visit(n){if(!rayBox(ro,rd,n.bounds,limit))return;if(n.list){for(const t of n.list){const[a,b,c]=t.p,e1=sub(b,a),e2=sub(c,a),h=cross(rd,e2),det=dot(e1,h);if(Math.abs(det)<1e-14||(frontOnly&&det<=0))continue;const inv=1/det,s=sub(ro,a),u=inv*dot(s,h);if(u<0||u>1)continue;const q=cross(s,e1),v=inv*dot(rd,q);if(v<0||u+v>1)continue;const distance=inv*dot(e2,q);if(distance>=0&&distance<=limit)hits.push({t:distance,p:add(ro,mul(rd,distance)),triangle:t.i,ids:t.ids,normal:normal(t,[1-u-v,u,v])});}}else{visit(n.left);visit(n.right);}}visit(root);hits.sort((a,b)=>a.t-b.t);return hits.filter((h,i)=>!i||Math.abs(h.t-hits[i-1].t)>1e-9);}
 return{closest,ray,triangles:tris,bounds:root.bounds};
}
function boundary(reference){const edges=new Map(),duplicates=new Map();for(let k=0;k<reference.faces.length;k+=3){const ids=reference.faces.slice(k,k+3),tri=ids.slice().sort((a,b)=>a-b).join(',');duplicates.set(tri,(duplicates.get(tri)||0)+1);for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=Math.min(a,b)+','+Math.max(a,b);if(!edges.has(key))edges.set(key,{ids:[a,b],count:0});edges.get(key).count++;}}const open=[...edges.values()].filter(e=>e.count===1),nonManifold=[...edges.values()].filter(e=>e.count>2),adj=new Map();for(const e of open)for(let j=0;j<2;j++){const a=e.ids[j],b=e.ids[1-j];if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b);}const visited=new Set(),components=[];for(const id of adj.keys()){if(visited.has(id))continue;const ids=[],stack=[id];visited.add(id);while(stack.length){const a=stack.pop();ids.push(a);for(const b of adj.get(a)){if(!visited.has(b)){visited.add(b);stack.push(b);}}}components.push({vertices:ids.length,closedLoop:ids.every(j=>adj.get(j).length===2),ids});}return{openEdges:open.length,nonManifoldEdges:nonManifold.length,duplicateTriangles:[...duplicates.values()].filter(n=>n>1).length,components};}
function summary(values){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);return{count:values.length,finite:a.length,rms:a.length?Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length):null,median:a[Math.floor(a.length*.5)]??null,p95:a[Math.min(a.length-1,Math.floor(a.length*.95))]??null,max:a.at(-1)??null};}
module.exports={create,boundary,summary,closestTriangle,point,sub,add,mul,dot,cross,unit};
