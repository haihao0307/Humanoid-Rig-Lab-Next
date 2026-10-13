/* Exact triangle cuts, cached per immutable position array/index/height.
 * A writer MUST invalidate after mutating positions. No angular quantization,
 * no reduced mesh, no change to the nearest-crossing rule. Weak ownership.
 */
const cache = new WeakMap();
export function invalidateCavity(position) { cache.delete(position); }
function section(position,index,y) {
 let byIndex=cache.get(position);if(!byIndex){byIndex=new WeakMap();cache.set(position,byIndex);}
 let byY=byIndex.get(index);if(!byY){byY=new Map();byIndex.set(index,byY);}
 if(byY.has(y))return byY.get(y);
 const segs=[];
 for(let t=0;t<index.length;t+=3){
  const a=index[t]*3,b=index[t+1]*3,c=index[t+2]*3;
  if(y<Math.min(position[a+1],position[b+1],position[c+1])||y>Math.max(position[a+1],position[b+1],position[c+1]))continue;
  const ids=[a,b,c],hit=[];
  for(let j=0;j<3;j++){const u=ids[j],v=ids[(j+1)%3],dy=position[v+1]-position[u+1];if(Math.abs(dy)<1e-12)continue;const w=(y-position[u+1])/dy;if(w>=0&&w<1)hit.push(position[u]+w*(position[v]-position[u]),position[u+2]+w*(position[v+2]-position[u+2]));}
  if(hit.length===4)segs.push(...hit);
 }
 const out=Float64Array.from(segs);byY.set(y,out);return out;
}
export function cavityRadius(position,index,y,c,a) {
 const dx=Math.cos(a),dz=Math.sin(a),segs=section(position,index,y);let best=Infinity;
 for(let j=0;j<segs.length;j+=4){const px=segs[j]-c[0],pz=segs[j+1]-c[1],qx=segs[j+2]-c[0],qz=segs[j+3]-c[1],ex=qx-px,ez=qz-pz,den=dx*ez-dz*ex;if(Math.abs(den)<1e-12)continue;const r=(px*ez-pz*ex)/den,w=(px*dz-pz*dx)/den;if(r>0&&w>=0&&w<=1)best=Math.min(best,r);}
 return best;
}
