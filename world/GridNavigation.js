// Expanded-world ground navigation. All edges and the final simplification
// query the same collision footprints; furniture is never removed for routing.
const navigationBatches=new WeakMap();
const navigationDirections=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function navigationSegmentHitsObject(start,end,o,padding){
 // Exact continuous footprint test, matching the locomotion sweep. Sampling
 // every 7.5 cm can miss a short chord through an expanded rounded corner.
 const tilted=objectTilted(o),yaw=tilted?0:objectYaw(o),c=Math.cos(yaw),s=Math.sin(yaw);
 const local=p=>{const x=p[0]-o.p[0],z=p[2]-o.p[2];return[c*x-s*z,s*x+c*z];};
 const a=local(start),b=local(end),delta=[b[0]-a[0],b[1]-a[1]];
 const circle=(x,z,r)=>{
  const dx=a[0]-x,dz=a[1]-z,length2=delta[0]**2+delta[1]**2;
  const t=length2?clamp(-(dx*delta[0]+dz*delta[1])/length2,0,1):0;
  return (dx+delta[0]*t)**2+(dz+delta[1]*t)**2<=r*r;
 };
 const rectangle=(rx,rz)=>{
  let enter=0,exit=1;
  for(let i=0;i<2;i++){
   const half=i?rz:rx;
   if(Math.abs(delta[i])<1e-12){if(Math.abs(a[i])>half)return false;continue;}
   const low=(-half-a[i])/delta[i],high=(half-a[i])/delta[i];
   enter=Math.max(enter,Math.min(low,high));exit=Math.min(exit,Math.max(low,high));
   if(enter>exit)return false;
  }
  return true;
 };
 if(tilted){const [rx,rz]=objectFootprint(o);return rectangle(rx+padding,rz+padding);}
 if(o.shape!=='box')return circle(0,0,o.r+padding);
 const rx=o.w/2,rz=o.d/2;
 if(rectangle(rx+padding,rz)||rectangle(rx,rz+padding))return true;
 return [-1,1].some(x=>[-1,1].some(z=>circle(x*rx,z*rz,padding)));
}
function navigationQueryBatch(world,query){
 // Only synchronous, read-only forecasts may share a snapshot. A physics
 // frame can move objects without changing world.revision, so nothing here
 // survives this call (including exceptions or a rejected task).
 if(navigationBatches.has(world))return query();
 navigationBatches.set(world,new Map());
 try{return query();}finally{navigationBatches.delete(world);}
}
function navigationGeometryKey(world){
 // revision alone misses physics motion. Include every input consumed by the
 // footprint queries, plus target zones used by a pending transport plan.
 return JSON.stringify([world.sceneId,world.bounds,world.objects.map(o=>[o.id,o.p,o.q,o.yaw,o.shape,o.w,o.h,o.d,o.r,o.collidable,o.movable,o.mass,o.friction]),(world.zones||[]).map(z=>[z.id,z.p,z.r,z.shape])]);
}
function* navigationQueryBatchSteps(world,query){
 const geometry=navigationGeometryKey(world),cache=new Map(),iterator=query();
 try{
  while(true){
   if(navigationGeometryKey(world)!==geometry){const error=Error('预检期间场景物体已改变，请重新验证');error.code='PREFLIGHT_WORLD_CHANGED';throw error;}
   // Install only for this synchronous chunk. An unrelated task querying
   // the same world between frames must never see this suspended cache.
   const previous=navigationBatches.get(world);navigationBatches.set(world,cache);
   let step;try{step=iterator.next();}finally{if(previous)navigationBatches.set(world,previous);else navigationBatches.delete(world);}
   if(step.done)return step.value;
   yield step.value;
  }
 }finally{iterator.return?.();}
}
function campGridPath(world,start,end,r=.26,ignore=[]) {
 const bounds=world.bounds,skip=new Set(ignore),batch=navigationBatches.get(world),tag=JSON.stringify([r,[...skip].sort(),bounds.xMin,bounds.xMax,bounds.zMin,bounds.zMax]);
 let context=batch?.get(tag);
 if(!context){
  const obstacles=world.objects.filter(o=>!skip.has(o.id)&&o.collidable!==false),buckets=new Map(),bucketSize=1.5;
  for(const o of obstacles){const [rx,rz]=objectFootprint(o);for(let z=Math.floor((o.p[2]-rz)/bucketSize);z<=Math.floor((o.p[2]+rz)/bucketSize);z++)for(let x=Math.floor((o.p[0]-rx)/bucketSize);x<=Math.floor((o.p[0]+rx)/bucketSize);x++){const k=x+':'+z;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(o);}}
  context={obstacles,buckets};batch?.set(tag,context);
 }
 const {obstacles,buckets}=context,bucketSize=1.5,key=(x,z)=>x+':'+z;
 const inBounds=p=>p[0]-r>=bounds.xMin&&p[0]+r<=bounds.xMax&&p[2]-r>=bounds.zMin&&p[2]+r<=bounds.zMax;
 const collision=p=>{if(!inBounds(p))return true;const seen=new Set(),padding=r+.06;for(let z=Math.floor((p[2]-padding)/bucketSize);z<=Math.floor((p[2]+padding)/bucketSize);z++)for(let x=Math.floor((p[0]-padding)/bucketSize);x<=Math.floor((p[0]+padding)/bucketSize);x++)for(const o of buckets.get(key(x,z))||[]){if(seen.has(o.id))continue;seen.add(o.id);if(pointToObjectClearance(p,o)<padding)return true;}return false;};
 const clear=(a,b)=>{
  if(!inBounds(a)||!inBounds(b))return false;
  const seen=new Set(),padding=r+.06;
  for(let z=Math.floor((Math.min(a[2],b[2])-padding)/bucketSize);z<=Math.floor((Math.max(a[2],b[2])+padding)/bucketSize);z++)for(let x=Math.floor((Math.min(a[0],b[0])-padding)/bucketSize);x<=Math.floor((Math.max(a[0],b[0])+padding)/bucketSize);x++)for(const o of buckets.get(key(x,z))||[]){
   if(seen.has(o.id))continue;seen.add(o.id);if(navigationSegmentHitsObject(a,b,o,padding))return false;
  }
  return true;
 };
 if(!inBounds(end))throw Error('目标超出当前场景边界');
 if(collision(end))throw Error('目标站位被占用');
 const overlaps=obstacles.filter(o=>pointToObjectClearance(start,o)<r+.06);
 if(overlaps.length){
  function* safeExits(){
   let away=[0,0,0];for(const o of overlaps)away=add(away,norm([start[0]-o.p[0],0,start[2]-o.p[2]]));const base=Math.atan2(away[0],away[2]);
   for(const length of [.22,.38,.60,.85,1.05])for(const turn of [0,.3,-.3,.65,-.65,1,-1,1.4,-1.4,2,-2,Math.PI]){
    const a=base+turn,p=[start[0]+Math.sin(a)*length,0,start[2]+Math.cos(a)*length];if(collision(p))continue;
    const previous=new Map(overlaps.map(o=>[o.id,pointToObjectClearance(start,o)]));let safe=true;
    for(let k=1;k<=24&&safe;k++){const q=mix(start,p,k/24);if(!inBounds(q)){safe=false;break;}for(const o of obstacles){const d=pointToObjectClearance(q,o);if(previous.has(o.id)){if(d+1e-6<previous.get(o.id)){safe=false;break;}previous.set(o.id,d);}else if(d<r+.06){safe=false;break;}}}
    if(safe)yield p;
   }
  }
  let exits=safeExits();
  if(batch){const k=JSON.stringify([start[0],start[2]]);context.exits??=new Map();if(!context.exits.has(k))context.exits.set(k,[...exits]);exits=context.exits.get(k);}
  for(const p of exits){try{return [p,...campGridPath(world,p,end,r,ignore)];}catch{}}
  throw Error('释放后的安全退出路径被阻挡');
 }
 if(!inBounds(start))throw Error('人物站位超出当前场景边界');
 if(clear(start,end))return [[...end]];
 const step=.24,x0=bounds.xMin+r,z0=bounds.zMin+r,X=Math.floor((bounds.xMax-r-x0)/step)+1,Z=Math.floor((bounds.zMax-r-z0)/step)+1;
 const ix=p=>clamp(Math.round((p[0]-x0)/step),0,X-1),iz=p=>clamp(Math.round((p[2]-z0)/step),0,Z-1),index=(x,z)=>x+z*X,S=index(ix(start),iz(start)),E=index(ix(end),iz(end));
 if(S===E)throw Error('起点和终点之间没有足够净空');
 const canonical=id=>[x0+(id%X)*step,0,z0+Math.floor(id/X)*step],pos=id=>id===S?[...start]:id===E?[...end]:canonical(id);
 const grid=batch?(context.grid||(context.grid={blocked:new Int8Array(X*Z).fill(-1),edges:new Uint8Array(X*Z*8),queries:0})):null;
 const blocked=grid?.blocked||new Int8Array(X*Z).fill(-1);
 const gridBlocked=id=>{if(blocked[id]<0)blocked[id]=collision(canonical(id))?1:0;return blocked[id];};
 const gridEdge=(id,n,k)=>{if(!grid)return clear(canonical(id),canonical(n));const slot=id*8+k;if(!grid.edges[slot])grid.edges[slot]=clear(canonical(id),canonical(n))?1:2;return grid.edges[slot]===1;};
 if(grid&&++grid.queries>=4){
  if(!grid.components){
   const labels=new Int32Array(X*Z),queue=new Int32Array(X*Z);let label=0;
   for(let seed=0;seed<labels.length;seed++){
    if(labels[seed]||gridBlocked(seed))continue;
    let read=0,write=1;queue[0]=seed;labels[seed]=++label;
    while(read<write){const id=queue[read++],x=id%X,z=Math.floor(id/X);
     for(let k=0;k<8;k++){const [dx,dz]=navigationDirections[k],xx=x+dx,zz=z+dz;if(xx<0||xx>=X||zz<0||zz>=Z)continue;const n=index(xx,zz);
      if(labels[n]||gridBlocked(n))continue;
      // An undirected superset is conservative even at floating-point
      // sampling boundaries. Exact directed edges are still used by A*.
      const reverse=navigationDirections.findIndex(([a,b])=>a===-dx&&b===-dz);
      if(!gridEdge(id,n,k)&&!gridEdge(n,id,reverse))continue;
      labels[n]=label;queue[write++]=n;
     }
    }
   }
   grid.components=labels;
  }
  const connected=(point,cell,outgoing)=>{grid.portals??=new Map();const key=JSON.stringify([point[0],point[2],outgoing]);if(grid.portals.has(key))return grid.portals.get(key);const found=new Set(),x=cell%X,z=Math.floor(cell/X);
   for(const [dx,dz]of navigationDirections){const xx=x+dx,zz=z+dz;if(xx<0||xx>=X||zz<0||zz>=Z)continue;const n=index(xx,zz),label=grid.components[n];
    if(label&&(outgoing?clear(point,canonical(n)):clear(canonical(n),point)))found.add(label);
   }grid.portals.set(key,found);return found;
  };
  const from=connected(start,S,true),to=connected(end,E,false);
  // S/E replace canonical grid points for this query. Keeping their original
  // cells in the component graph only adds paths; endpoint edges are freshly
  // checked. Disjoint sets prove that the original graph cannot connect them.
  if(![...from].some(label=>to.has(label)))throw Error('没有足够净空的可达路线');
 }
 const costs=new Float64Array(X*Z).fill(Infinity),parent=new Int32Array(X*Z).fill(-1),done=new Uint8Array(X*Z),heap=[];
 const push=(id,score)=>{let i=heap.length;heap.push({id,score});while(i){const p=(i-1)>>1;if(heap[p].score<=score)break;heap[i]=heap[p];i=p;}heap[i]={id,score};};
 const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(last.score<=heap[c].score)break;heap[i]=heap[c];i=c;}heap[i]=last;}return top.id;};
 costs[S]=0;push(S,horizontal(start,end));
 while(heap.length){const id=pop();if(done[id])continue;done[id]=1;if(id===E)break;const x=id%X,z=Math.floor(id/X),a=pos(id);
  for(let k=0;k<8;k++){const [dx,dz]=navigationDirections[k];
   const xx=x+dx,zz=z+dz;if(xx<0||xx>=X||zz<0||zz>=Z)continue;const n=index(xx,zz);if(done[n])continue;const b=pos(n),endpoint=n===S||n===E;
   if((endpoint?collision(b):gridBlocked(n))||!(grid&&id!==S&&id!==E&&!endpoint?gridEdge(id,n,k):clear(a,b)))continue;
   const score=costs[id]+horizontal(a,b);if(score<costs[n]){costs[n]=score;parent[n]=id;push(n,score+horizontal(b,end));}
  }
 }
 if(!done[E])throw Error('没有足够净空的可达路线');
 const route=[];for(let id=E;id!==S;id=parent[id]){if(id<0)throw Error('场景路线不完整');route.push(pos(id));}route.reverse();
 const result=[];let anchor=start;for(let i=0;i<route.length;i++){let j=i;while(j+1<route.length&&clear(anchor,route[j+1]))j++;result.push(route[j]);anchor=route[j];i=j;}
 return result;
}
