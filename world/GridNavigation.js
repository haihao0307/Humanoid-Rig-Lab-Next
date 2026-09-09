// Expanded-world ground navigation. All edges and the final simplification
// query the same collision footprints; furniture is never removed for routing.
function campGridPath(world,start,end,r=.26,ignore=[]) {
 const bounds=world.bounds,skip=new Set(ignore),obstacles=world.objects.filter(o=>!skip.has(o.id)&&o.collidable!==false);
 const bucketSize=1.5,buckets=new Map(),key=(x,z)=>x+':'+z;
 for(const o of obstacles){const [rx,rz]=objectFootprint(o);for(let z=Math.floor((o.p[2]-rz)/bucketSize);z<=Math.floor((o.p[2]+rz)/bucketSize);z++)for(let x=Math.floor((o.p[0]-rx)/bucketSize);x<=Math.floor((o.p[0]+rx)/bucketSize);x++){const k=key(x,z);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(o);}}
 const inBounds=p=>p[0]-r>=bounds.xMin&&p[0]+r<=bounds.xMax&&p[2]-r>=bounds.zMin&&p[2]+r<=bounds.zMax;
 const collision=p=>{if(!inBounds(p))return true;const seen=new Set(),padding=r+.06;for(let z=Math.floor((p[2]-padding)/bucketSize);z<=Math.floor((p[2]+padding)/bucketSize);z++)for(let x=Math.floor((p[0]-padding)/bucketSize);x<=Math.floor((p[0]+padding)/bucketSize);x++)for(const o of buckets.get(key(x,z))||[]){if(seen.has(o.id))continue;seen.add(o.id);if(pointToObjectClearance(p,o)<padding)return true;}return false;};
 const clear=(a,b)=>{const n=Math.max(1,Math.ceil(horizontal(a,b)/.075));for(let k=1;k<=n;k++)if(collision(mix(a,b,k/n)))return false;return true;};
 if(!inBounds(end))throw Error('目标超出当前场景边界');
 if(collision(end))throw Error('目标站位被占用');
 const overlaps=obstacles.filter(o=>pointToObjectClearance(start,o)<r+.06);
 if(overlaps.length){
  let away=[0,0,0];for(const o of overlaps)away=add(away,norm([start[0]-o.p[0],0,start[2]-o.p[2]]));const base=Math.atan2(away[0],away[2]);
  for(const length of [.22,.38,.60,.85,1.05])for(const turn of [0,.3,-.3,.65,-.65,1,-1,1.4,-1.4,2,-2,Math.PI]){
   const a=base+turn,p=[start[0]+Math.sin(a)*length,0,start[2]+Math.cos(a)*length];if(collision(p))continue;
   const previous=new Map(overlaps.map(o=>[o.id,pointToObjectClearance(start,o)]));let safe=true;
   for(let k=1;k<=24&&safe;k++){const q=mix(start,p,k/24);if(!inBounds(q)){safe=false;break;}for(const o of obstacles){const d=pointToObjectClearance(q,o);if(previous.has(o.id)){if(d+1e-6<previous.get(o.id)){safe=false;break;}previous.set(o.id,d);}else if(d<r+.06){safe=false;break;}}}
   if(safe){try{return [p,...campGridPath(world,p,end,r,ignore)];}catch{}}
  }
  throw Error('释放后的安全退出路径被阻挡');
 }
 if(!inBounds(start))throw Error('人物站位超出当前场景边界');
 if(clear(start,end))return [[...end]];
 const step=.24,x0=bounds.xMin+r,z0=bounds.zMin+r,X=Math.floor((bounds.xMax-r-x0)/step)+1,Z=Math.floor((bounds.zMax-r-z0)/step)+1;
 const ix=p=>clamp(Math.round((p[0]-x0)/step),0,X-1),iz=p=>clamp(Math.round((p[2]-z0)/step),0,Z-1),index=(x,z)=>x+z*X,S=index(ix(start),iz(start)),E=index(ix(end),iz(end));
 if(S===E)throw Error('起点和终点之间没有足够净空');
 const pos=id=>id===S?[...start]:id===E?[...end]:[x0+(id%X)*step,0,z0+Math.floor(id/X)*step];
 const costs=new Float64Array(X*Z).fill(Infinity),parent=new Int32Array(X*Z).fill(-1),done=new Uint8Array(X*Z),blocked=new Int8Array(X*Z).fill(-1),heap=[];
 const push=(id,score)=>{let i=heap.length;heap.push({id,score});while(i){const p=(i-1)>>1;if(heap[p].score<=score)break;heap[i]=heap[p];i=p;}heap[i]={id,score};};
 const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(last.score<=heap[c].score)break;heap[i]=heap[c];i=c;}heap[i]=last;}return top.id;};
 costs[S]=0;push(S,horizontal(start,end));
 while(heap.length){const id=pop();if(done[id])continue;done[id]=1;if(id===E)break;const x=id%X,z=Math.floor(id/X),a=pos(id);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const xx=x+dx,zz=z+dz;if(xx<0||xx>=X||zz<0||zz>=Z)continue;const n=index(xx,zz);if(done[n])continue;const b=pos(n);if(blocked[n]<0)blocked[n]=collision(b)?1:0;if(blocked[n]||!clear(a,b))continue;
   const score=costs[id]+horizontal(a,b);if(score<costs[n]){costs[n]=score;parent[n]=id;push(n,score+horizontal(b,end));}
  }
 }
 if(!done[E])throw Error('没有足够净空的可达路线');
 const route=[];for(let id=E;id!==S;id=parent[id]){if(id<0)throw Error('场景路线不完整');route.push(pos(id));}route.reverse();
 const result=[];let anchor=start;for(let i=0;i<route.length;i++){let j=i;while(j+1<route.length&&clear(anchor,route[j+1]))j++;result.push(route[j]);anchor=route[j];i=j;}
 return result;
}
