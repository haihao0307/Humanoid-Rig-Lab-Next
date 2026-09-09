/* V7: separate triangle surfaces for scalp attachments and body obstacles.
 * Queries are local Euclidean distances; no head-centred radial projection.
 * Geometry is in the bind-head frame. The current short groom is head-local;
 * this is not a moving whole-body or hair-hair contact solver. */
function hairRestVertex(g,vertex){
 const mapped=g.surfaceCache?.map[vertex];
 // The visible skin restores its residual onto this faired rest surface.
 // Uncorrected construction positions differ and must not be used as hair attachment points.
 if(mapped!=null&&mapped>=0)return Array.from(g.surfaceCache.rest.subarray(mapped*3,mapped*3+3));
 return Array.from(g.p.slice(vertex*3,vertex*3+3));
}
class HairSkinCollider{
 constructor(human,scalp,rootsOnly=false){
  this.center=[...scalp.center];this.triangles=[];this.rootsOnly=rootsOnly;
  const bind=human.tissue.bind.get('head'),iq=inv(bind.q),meshes=[human.tissue.skin.g,...(rootsOnly?[]:human.tissue.details.filter(item=>/ear/.test(item.id)).map(item=>transform(item.g,human.tissue.bind.get(item.joint.id).p,human.tissue.bind.get(item.joint.id).q)))];
  for(const [meshIndex,g] of meshes.entries()){const points=[];
  for(let k=0;k<g.p.length;k+=3)points.push(rotate(iq,sub(hairRestVertex(g,k/3),bind.p)));
  for(let k=0;k<g.i.length;k+=3){const a=points[g.i[k]],b=points[g.i[k+1]],c=points[g.i[k+2]];
   if(Math.max(a[1],b[1],c[1])<scalp.top-.35||Math.min(a[1],b[1],c[1])>scalp.top+.001)continue;
   if(rootsOnly&&!scalp.inGrowthRegion(a)&&!scalp.inGrowthRegion(b)&&!scalp.inGrowthRegion(c))continue;
   const e1=sub(b,a),e2=sub(c,a);let n=norm(cross(e1,e2));if(len(n)<.5)continue;
   // Preserve the source skin's normal orientation, with a head-local fallback.
   let outward=sub(mul(add(add(a,b),c),1/3),scalp.center);
   if(g.n?.length===g.p.length){const ns=[0,0,0];for(let j=0;j<3;j++)for(let axis=0;axis<3;axis++)ns[axis]+=g.n[g.i[k+j]*3+axis];outward=rotate(iq,ns);}
   if(dot(n,outward)<0)n=mul(n,-1);
   const vertexNormals=[0,1,2].map(j=>g.n?.length===g.p.length?norm(rotate(iq,Array.from(g.n.slice(g.i[k+j]*3,g.i[k+j]*3+3)))):[...n]);
   this.triangles.push({a,b,c,e1,e2,n,vertexNormals,meshIndex,sourceTriangle:k/3,vertexIds:Array.from(g.i.slice(k,k+3)),lo:a.map((v,j)=>Math.min(v,b[j],c[j])),hi:a.map((v,j)=>Math.max(v,b[j],c[j]))});
  }
  }
  const build=ids=>{
   const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const id of ids){const t=this.triangles[id];for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],t.lo[k]);hi[k]=Math.max(hi[k],t.hi[k]);}}
   if(ids.length<=12)return {lo,hi,ids};let axis=0;for(let k=1;k<3;k++)if(hi[k]-lo[k]>hi[axis]-lo[axis])axis=k;
   ids.sort((a,b)=>(this.triangles[a].lo[axis]+this.triangles[a].hi[axis])-(this.triangles[b].lo[axis]+this.triangles[b].hi[axis]));
   const mid=ids.length>>1;return {lo,hi,left:build(ids.slice(0,mid)),right:build(ids.slice(mid))};
  };
  if(!this.triangles.length)throw Error('头发碰撞：没有找到头部表皮三角形');this.tree=build(this.triangles.map((_,i)=>i));
  this.sourceSkin=human.tissue.surfaceInfo.sourcePart;
 }
 ray(origin,direction,maxDistance=.5,furthest=false){
  const stack=[this.tree],eps=1e-10;let best=furthest?-Infinity:maxDistance,result=null;
  while(stack.length){const node=stack.pop();let lo=0,hi=furthest?maxDistance:best;
   for(let k=0;k<3&&lo<=hi;k++){
    if(Math.abs(direction[k])<eps){if(origin[k]<node.lo[k]||origin[k]>node.hi[k])hi=-1;}
    else {let a=(node.lo[k]-origin[k])/direction[k],b=(node.hi[k]-origin[k])/direction[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);}
   }if(lo>hi)continue;
   if(!node.ids){stack.push(node.left,node.right);continue;}
   for(const id of node.ids){const t=this.triangles[id],p=cross(direction,t.e2),det=dot(t.e1,p);if(Math.abs(det)<eps)continue;
    const invDet=1/det,s=sub(origin,t.a),u=dot(s,p)*invDet;if(u< -1e-7||u>1.0000001)continue;
    const q=cross(s,t.e1),v=dot(direction,q)*invDet;if(v< -1e-7||u+v>1.0000001)continue;
    const distance=dot(t.e2,q)*invDet;if(distance<0||distance>maxDistance||!(furthest?distance>best:distance<best))continue;
    best=distance;result={distance,point:add(origin,mul(direction,distance)),normal:[...t.n],triangle:id,barycentric:[1-u-v,u,v]};
   }
  }return result;
 }
 // Closest point on a triangle (Voronoi-region construction).
 closestPoint(p,t){
  const ab=t.e1,ac=t.e2,ap=sub(p,t.a),d1=dot(ab,ap),d2=dot(ac,ap);
  if(d1<=0&&d2<=0)return {point:t.a,barycentric:[1,0,0]};
  const bp=sub(p,t.b),d3=dot(ab,bp),d4=dot(ac,bp);
  if(d3>=0&&d4<=d3)return {point:t.b,barycentric:[0,1,0]};
  const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return {point:add(t.a,mul(ab,v)),barycentric:[1-v,v,0]};}
  const cp=sub(p,t.c),d5=dot(ab,cp),d6=dot(ac,cp);
  if(d6>=0&&d5<=d6)return {point:t.c,barycentric:[0,0,1]};
  const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return {point:add(t.a,mul(ac,w)),barycentric:[1-w,0,w]};}
  const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return {point:add(t.b,mul(sub(t.c,t.b),w)),barycentric:[0,1-w,w]};}
  const denom=1/(va+vb+vc),v=vb*denom,w=vc*denom;
  return {point:add(t.a,add(mul(ab,v),mul(ac,w))),barycentric:[1-v-w,v,w]};
 }
 nearest(p,maxDistance=Infinity){
  let best=maxDistance*maxDistance,result=null;const stack=[this.tree];
  while(stack.length){const node=stack.pop();let bound=0;for(let k=0;k<3;k++)bound+=Math.max(node.lo[k]-p[k],0,p[k]-node.hi[k])**2;if(bound>best)continue;
   if(!node.ids){stack.push(node.left,node.right);continue;}
   for(const id of node.ids){const t=this.triangles[id],q=this.closestPoint(p,t),delta=sub(p,q.point),d2=dot(delta,delta);
    if(d2<=best){best=d2;result={...q,normal:t.n,triangle:id,distance:Math.sqrt(d2),signedDistance:dot(delta,t.n)};}}
  }return result;
 }
 segment(a,b){const delta=sub(b,a),length=len(delta);return length<1e-8?null:this.ray(a,mul(delta,1/length),Math.max(0,length-1e-7));}
 // Return an endpoint at EXACTLY restLength. Collision only changes direction.
 // A failed search is explicit; the caller rejects the strand, never stretches it.
 advance(a,desired,restLength,clearance,preferredNormal){
  let direction=norm(desired),normal=preferredNormal;
  for(let attempt=0;attempt<12;attempt++){
   const b=add(a,mul(direction,restLength)),hit=this.segment(a,b),near=this.nearest(b,clearance+.0005);
   if(!hit&&(!near||near.signedDistance>=clearance))return b;
   normal=hit?.normal||near?.normal||normal;
   const tangent=sub(direction,mul(normal,dot(direction,normal)));
   direction=norm(add(tangent,mul(normal,.12+.16*attempt)));
  }
  return null;
 }
 // Distance between two finite segments, including parallel/degenerate cases.
 edgeDistance(p,q,a,b){
  const d1=sub(q,p),d2=sub(b,a),r=sub(p,a),aa=dot(d1,d1),ee=dot(d2,d2),f=dot(d2,r);let s=0,t=0;
  if(aa<=1e-16&&ee<=1e-16)return dist(p,a);
  if(aa<=1e-16)t=clamp(f/ee,0,1);
  else {const c=dot(d1,r);if(ee<=1e-16)s=clamp(-c/aa,0,1);else {const bb=dot(d1,d2),denom=aa*ee-bb*bb;s=denom>1e-16?clamp((bb*f-c*ee)/denom,0,1):0;t=(bb*s+f)/ee;if(t<0){t=0;s=clamp(-c/aa,0,1);}else if(t>1){t=1;s=clamp((bb-c)/aa,0,1);}}}
  return dist(add(p,mul(d1,s)),add(a,mul(d2,t)));
 }
 segmentClearance(a,b,maxDistance=.02){
  if(this.segment(a,b))return 0;
  let best=maxDistance;const low=a.map((v,k)=>Math.min(v,b[k])),high=a.map((v,k)=>Math.max(v,b[k])),stack=[this.tree];
  while(stack.length){const node=stack.pop();let bound=0;for(let k=0;k<3;k++)bound+=Math.max(node.lo[k]-high[k],0,low[k]-node.hi[k])**2;if(bound>best*best)continue;
   if(!node.ids){stack.push(node.left,node.right);continue;}
   for(const id of node.ids){const t=this.triangles[id];best=Math.min(best,dist(a,this.closestPoint(a,t).point),dist(b,this.closestPoint(b,t).point),this.edgeDistance(a,b,t.a,t.b),this.edgeDistance(a,b,t.b,t.c),this.edgeDistance(a,b,t.c,t.a));}
  }return best;
 }
 front(x,y){const origin=[x,y,this.center[2]-.25],hit=this.ray(origin,[0,0,1],.6,true);if(!hit)return null;if(hit.normal[2]<0)hit.normal=mul(hit.normal,-1);return hit;}
 report(){return {source:this.rootsOnly?'skin-only-growth-triangles':'skin-and-ear-obstacle-triangles',skinPart:this.sourceSkin,triangles:this.triangles.length,radialProjection:false,wholeBodyDynamicCollision:false};}
}
