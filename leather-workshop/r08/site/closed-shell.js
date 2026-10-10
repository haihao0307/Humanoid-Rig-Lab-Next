import * as T from 'three';
import {PanelAssembly} from './panels.js';
import {SeamPath,seamRelief} from './sewing.js';
// R08: one constrained paper mesh defines both skins AND every cut/needle wall.
// No separate coarse polygon may stand in for a subdivided curved boundary.
const V=(...v)=>new T.Vector3(...v),P=(x,y)=>new T.Vector2(x,y);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function clean(points){const out=[];for(const p of points)if(!out.length||out.at(-1).distanceTo(p)>1e-7)out.push(p.clone());if(out.length>1&&out[0].distanceTo(out.at(-1))<1e-7)out.pop();return out;}
function signed(r){let a=0;for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];a+=p.x*q.y-p.y*q.x;}return a*.5;}
function inside(p,ring){let odd=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)odd=!odd;}return odd;}
function distSeg(p,a,b){const d=b.clone().sub(a);return p.distanceTo(a.clone().addScaledVector(d,clamp(p.clone().sub(a).dot(d)/Math.max(1e-20,d.lengthSq()),0,1)));}
function hull(input){const s=input.map(p=>p.clone()).sort((a,b)=>a.x-b.x||a.y-b.y),cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);const lower=[],upper=[];for(const p of s){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=1e-10)lower.pop();lower.push(p);}for(const p of s.slice().reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=1e-10)upper.pop();upper.push(p);}lower.pop();upper.pop();return lower.concat(upper);}
const oldFrame=SeamPath.prototype.frame;
SeamPath.prototype.frame=function(s,offset=0){const S=clamp(s,0,this.length),f=oldFrame.call(this,S,offset);if(s!==S)f.uv.addScaledVector(f.tangent,(s-S)/f.metric.u);return f;};
function response(part,u,v,sign){let best=part.seamIndex.nearest(u,v),U=u,W=v;for(const a of(part.closedU?[-1,1]:[])){const q=part.seamIndex.nearest(u+a*part.w,v);if(q&&(!best||q.distance<best.distance)){best=q;U=u+a*part.w;}}for(const a of(part.closedV?[-1,1]:[])){const q=part.seamIndex.nearest(u,v+a*part.h);if(q&&(!best||q.distance<best.distance)){best=q;W=v+a*part.h;}}return seamRelief(part.seamIndex,U,W,sign);}
function sampleOutline(r,step,part){
 const out=[],limit=.004;
 const at=p=>{const d=response(part,p.x,p.y,1);return part.map(p.x+d.u,p.y+d.v).addScaledVector(part.normal(p.x+d.u,p.y+d.v),part.t/2+d.w);};
 function span(a,b,depth=0){const m=a.clone().lerp(b,.5),A=at(a),B=at(b),M=at(m);if(depth<12&&(a.distanceTo(b)>step||M.distanceTo(A.clone().add(B).multiplyScalar(.5))>limit)){span(a,m,depth+1);span(m,b,depth+1);}else out.push(a.clone());}
 for(let i=0;i<r.length;i++)span(r[i],r[(i+1)%r.length]);return clean(out);
}
function paperMesh(part,config){
 const shape=part.shape,coarse=clean(shape.getPoints(20));if(signed(coarse)<0)coarse.reverse();const outer=sampleOutline(coarse,(part.name.includes("keeper")?.42:config.thumbnail?2:1.0),part),raw=[];
 for(const path of part.paths)for(let i=0;i<path.holes.length;i++){
  const h=path.holes[i],original=path.model.holes[i],ring=[];
  for(let j=0;j<16;j++){const a=j*Math.PI/8,x=Math.cos(a)*original.rx,y=Math.sin(a)*original.rz,dx=x*Math.cos(original.angle)-y*Math.sin(original.angle),dy=x*Math.sin(original.angle)+y*Math.cos(original.angle);const f=path.frame(h.s,0);ring.push(f.uv.clone().addScaledVector(f.tangent,dx/f.metric.u).addScaledVector(f.perp,dy/f.metric.v));}
  if(ring.every(p=>inside(p,coarse)))raw.push(ring);else throw Error('针孔越出裁片边界: '+path.id+'/'+i);
 }
 for(const h of part.extraHoles||[]){const ring=[];for(let j=0;j<24;j++){const a=j*Math.PI/12;ring.push(P(h.x+Math.cos(a)*h.r,h.y+Math.sin(a)*(h.ry||h.r)));}if(ring.every(p=>inside(p,coarse)))raw.push(ring);}
 for(const h of shape.holes)raw.push(clean(h.getPoints(32)));
 // Crossing stitch families share one convex aperture only where their actual
 // hole polygons overlap. It is not a random larger hole or a painted mask.
 let merged=0;const rings=[];const bb=r=>({x0:Math.min(...r.map(p=>p.x)),x1:Math.max(...r.map(p=>p.x)),y0:Math.min(...r.map(p=>p.y)),y1:Math.max(...r.map(p=>p.y))});
 for(let ring of raw){let box=bb(ring),i=0;while(i<rings.length){const q=rings[i];if(!(box.x1<q.box.x0-.01||box.x0>q.box.x1+.01||box.y1<q.box.y0-.01||box.y0>q.box.y1+.01)&&(ring.some(p=>inside(p,q.ring))||q.ring.some(p=>inside(p,ring))||ring.some(p=>q.ring.some(q=>p.distanceTo(q)<.015)))){ring=hull(ring.concat(q.ring));box=bb(ring);rings.splice(i,1);i=0;merged++;}else i++;}rings.push({ring,box});}
 const cell=4,holesGrid=new Map();for(const q of rings)for(let x=Math.floor((q.box.x0-.3)/cell);x<=Math.floor((q.box.x1+.3)/cell);x++)for(let y=Math.floor((q.box.y0-.3)/cell);y<=Math.floor((q.box.y1+.3)/cell);y++){const k=x+','+y;if(!holesGrid.has(k))holesGrid.set(k,[]);holesGrid.get(k).push(q);}
 const allowed=p=>{if(!inside(p,coarse))return false;for(let i=0;i<coarse.length;i++)if(distSeg(p,coarse[i],coarse[(i+1)%coarse.length])<.07)return false;for(const q of holesGrid.get(Math.floor(p.x/cell)+','+Math.floor(p.y/cell))||[]){if(inside(p,q.ring))return false;for(let i=0;i<q.ring.length;i++)if(distSeg(p,q.ring[i],q.ring[(i+1)%q.ring.length])<.075)return false;}return true;};
 const points=[],nearGrid=new Map();function push(p,checkNear=false){const key=Math.floor(p.x*10)+','+Math.floor(p.y*10);if(checkNear){for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(const q of nearGrid.get((Math.floor(p.x*10)+x)+','+(Math.floor(p.y*10)+y))||[])if(p.distanceTo(q)<.075)return null;}const point={x:p.x,y:p.y,id:points.length};points.push(point);if(!nearGrid.has(key))nearGrid.set(key,[]);nearGrid.get(key).push(p);return point;}
 const contours=outer.map(p=>{const q=push(p);q.loop=0;return q;}),holes=rings.map((q,i)=>q.ring.map(p=>{const q=push(p);q.loop=i+1;return q;}));const context=new POLY2TRI.SweepContext(contours,{cloneArrays:true});context.addHoles(holes);
 const step=config.thumbnail?7:4;for(let y=-part.h/2+step*.49;y<part.h/2;y+=step)for(let x=-part.w/2+step*.53;x<part.w/2;x+=step){const p=P(x+.019*Math.sin(x*7+y),y+.023*Math.cos(x+y*3));if(allowed(p)){const q=push(p,true);if(q)context.addPoint(q);}}
 // Fine surface samples around each seam retain the R05 pressure field without
 // turning the complete object into millions of skinny Earcut fan triangles.
 if(!config.thumbnail)for(const path of part.paths)for(let s=0.3;s<path.length;s+=.85)for(const d of[-2.5,-1.2,-.55,0,.55,1.2,2.5]){const p=path.frame(s,d).uv;if(allowed(p)){const q=push(p,true);if(q)context.addPoint(q);}}
 try{context.triangulate();}catch(e){throw Error('约束剖分失败 '+part.name+': '+e.message);}
 const tris=context.getTriangles().map(t=>t.getPoints().map(p=>p.id));for(const t of tris){const a=points[t[0]],b=points[t[1]],c=points[t[2]];if((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)<0)[t[1],t[2]]=[t[2],t[1]];}
 return{points,tris,holes:rings,merged,coarse};
}
PanelAssembly.prototype.buildPanel=function(part){
 const now=Date.now(),{points,tris,holes,merged,coarse}=paperMesh(part,this.config),P=[],N=[],UV=[],I=[],bindings=[],count=points.length;
 const at=(u,v,sign)=>{const r=response(part,u,v,sign),x=u+r.u,y=v+r.v,n=part.normal(x,y);return part.map(x,y).addScaledVector(n,sign*part.t/2+r.w);};part.surfacePoint=at;
 const add=(p,n,u,v)=>{const id=P.length/3;P.push(...p);N.push(...n);UV.push(u/96,v/96);bindings.push(this.binding(part,u,v,p,n));return id;};
 for(const sign of[1,-1])for(const q of points){const p=at(q.x,q.y,sign),a=at(q.x+.025,q.y,sign).sub(at(q.x-.025,q.y,sign)),b=at(q.x,q.y+.025,sign).sub(at(q.x,q.y-.025,sign));let n=a.cross(b).normalize().multiplyScalar(sign*(part.flip?-1:1));if(n.lengthSq()<.1)n=part.normal(q.x,q.y).multiplyScalar(sign);add(p,n,q.x,q.y);}
 const edges=new Map(),key=(a,b)=>Math.min(a,b)+':'+Math.max(a,b);
 for(const t0 of tris){const t=[...t0];if(part.flip)[t[1],t[2]]=[t[2],t[1]];I.push(...t);for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],k=key(a,b);if(edges.has(k))edges.get(k).count++;else edges.set(k,{a,b,count:1});}}
 const faceCount=I.length;for(let i=0;i<faceCount;i+=3)I.push(I[i]+count,I[i+2]+count,I[i+1]+count);
 const wallStart=I.length,boundary=[...edges.values()].filter(e=>e.count===1),outgoing=new Map(),incoming=new Map();for(const e of boundary){outgoing.set(e.a,e.b);incoming.set(e.b,e.a);}
 const edgeVertices=new Map();let skipped=0,wallEdges=0,maxChordError=0,maxChordLocation=null;
 const isPeriodic=e=>{const a=points[e.a],b=points[e.b];return(part.closedU&&[-1,1].some(s=>Math.abs(a.x-s*part.w/2)<1e-5&&Math.abs(b.x-s*part.w/2)<1e-5))||(part.closedV&&[-1,1].some(s=>Math.abs(a.y-s*part.h/2)<1e-5&&Math.abs(b.y-s*part.h/2)<1e-5));};
 const isCollapsed=e=>{const a=V(...P.slice(e.a*3,e.a*3+3)),b=V(...P.slice(e.b*3,e.b*3+3));return a.distanceTo(b)<1e-6;};
 const physicalKey=id=>P.slice(id*3,id*3+3).map(v=>Math.round(v*1e6)).join(',');
 const alongMap=new Map();for(const e of boundary){if(isPeriodic(e)||isCollapsed(e))continue;const a=points[e.a],b=points[e.b],v=part.map(b.x,b.y).sub(part.map(a.x,a.y)).normalize();for(const id of[e.a,e.b]){const key=physicalKey(id);if(!alongMap.has(key))alongMap.set(key,V());alongMap.get(key).add(v);}}
 function edgeProfile(id){if(edgeVertices.has(id))return edgeVertices.get(id);const q=points[id],top=V(...P.slice(id*3,id*3+3)),bot=V(...P.slice((id+count)*3,(id+count)*3+3)),n=part.normal(q.x,q.y),along=(alongMap.get(physicalKey(id))||V(1,0,0)).clone().normalize(),out=along.clone().cross(n).normalize();const arr=[],lip=Math.min(.14,part.t*.06);for(let j=0;j<=4;j++){const f=j/4,normal=n.clone().multiplyScalar(Math.cos(Math.PI*f)).addScaledVector(out,Math.sin(Math.PI*f)).normalize(),p=top.clone().lerp(bot,f).addScaledVector(out,lip*Math.sin(Math.PI*f));arr.push(add(p,normal,q.x,q.y));}edgeVertices.set(id,arr);return arr;}

 for(const e of boundary){if(isPeriodic(e)||isCollapsed(e)){skipped++;continue;}const a=edgeProfile(e.a),b=edgeProfile(e.b);for(let j=0;j<4;j++)I.push(b[j],a[j],a[j+1],b[j],a[j+1],b[j+1]);wallEdges++;const p=points[e.a],q=points[e.b],mid=at((p.x+q.x)/2,(p.y+q.y)/2,1),linear=at(p.x,p.y,1).add(at(q.x,q.y,1)).multiplyScalar(.5);if(mid.distanceTo(linear)>maxChordError){maxChordError=mid.distanceTo(linear);maxChordLocation=[[p.x,p.y],[q.x,q.y],mid.toArray(),linear.toArray()];}}
 const g=this.geometry(P,N,UV,I,bindings);g.addGroup(0,faceCount,0);g.addGroup(faceCount,faceCount,1);g.addGroup(wallStart,I.length-wallStart,2);
 g.userData={punchedHoles:holes.length,stitchHoles:part.paths.reduce((n,p)=>n+p.holes.length,0),mergedCrossingApertures:merged,contactFromR05:true,wallSource:'exact constrained surface boundary',boundaryEdges:boundary.length,closedWallEdges:wallEdges,periodicOrCollapsedEdges:skipped,maxBoundaryChordErrorMM:maxChordError,maxChordLocation,paperVertices:count,tessellationMS:Date.now()-now};
 const mesh=new T.Mesh(g,this.mats.shell);mesh.name=part.name;mesh.userData.leather=true;mesh.userData.panel=part.index;mesh.castShadow=mesh.receiveShadow=true;this.root.add(mesh);this.skinMeshes.push(mesh);part.mesh=mesh;part.punchCount=holes.length;part.paperLoops={outer:coarse,holes:holes.map(h=>h.ring)};
 if(this.config.edgeFinish==='bound')addBinding(this,part,points,boundary.filter(e=>points[e.a].loop===0&&points[e.b].loop===0&&!isPeriodic(e)&&!isCollapsed(e)),P,physicalKey);
};

// A folded leather edge strip with its own front/back/cut shell, not a thread tube.
function addBinding(builder,part,points,edges,skinPositions,physicalKey){
 const from=new Map();for(const e of edges)from.set(physicalKey(e.a),e);const used=new Set(),loops=[];
 for(const e of edges){if(used.has(e))continue;const loop=[];let next=e;while(next&&!used.has(next)){used.add(next);loop.push(next.a);next=from.get(physicalKey(next.b));}if(loop.length>3)loops.push(loop);}
 for(const loop of loops){const P=[],N=[],UV=[],indices=[],bindings=[],bt=.36,h=part.t/2;
  const cross=[[-3,h+.23],[-.25,h+.23],[.17,h+.13],[.24,h-.15],[.24,-h+.15],[.17,-h-.13],[-.25,-h-.23],[-3,-h-.23]],columns=cross.length;
  for(const sign of[1,-1])for(let i=0;i<loop.length;i++){const q=points[loop[i]],before=points[loop[(i-1+loop.length)%loop.length]],after=points[loop[(i+1)%loop.length]],base=part.map(q.x,q.y),n=part.normal(q.x,q.y),along=part.map(after.x,after.y).sub(part.map(before.x,before.y)).normalize(),out=along.clone().cross(n).normalize();
   for(let j=0;j<columns;j++){const a=cross[Math.max(0,j-1)],b=cross[Math.min(columns-1,j+1)],d=[b[0]-a[0],b[1]-a[1]],l=Math.hypot(...d),nx=-d[1]/l,ny=d[0]/l,nor=out.clone().multiplyScalar(nx).addScaledVector(n,ny),coord=cross[j],p=base.clone().addScaledVector(out,coord[0]+sign*nx*bt/2).addScaledVector(n,coord[1]+sign*ny*bt/2);P.push(...p);N.push(...nor.multiplyScalar(sign));UV.push(i*.9/96,j*.7/96);bindings.push(builder.binding(part,q.x,q.y,p,nor));}
  }
  const count=loop.length*columns;for(let side=0;side<2;side++)for(let i=0;i<loop.length;i++)for(let j=0;j<columns-1;j++){const a=side*count+i*columns+j,b=side*count+((i+1)%loop.length)*columns+j,c=a+1,d=b+1;if(side)indices.push(a,c,b,c,d,b);else indices.push(a,b,c,c,b,d);}
  for(let i=0;i<loop.length;i++){const a=i*columns,b=((i+1)%loop.length)*columns,c=a+columns-1,d=b+columns-1;indices.push(b,a,a+count,b,a+count,b+count,c,d,c+count,d,d+count,c+count);}
  const g=builder.geometry(P,N,UV,indices,bindings);g.userData={edgeBinding:true,thicknessMM:bt,closed:true,stitchedToParentField:true};const mesh=new T.Mesh(g,builder.mats.shell[0]);mesh.name=part.name+'/folded-edge-binding';mesh.userData.leather=true;mesh.userData.binding=true;mesh.castShadow=mesh.receiveShadow=true;builder.root.add(mesh);builder.skinMeshes.push(mesh);
  const width=cross.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-cross[i][0],p[1]-cross[i][1]),0);for(let i=0;i<loop.length;i++){const q=points[loop[i]],next=points[loop[(i+1)%loop.length]],L=part.map(q.x,q.y).distanceTo(part.map(next.x,next.y)),mass=L*width*bt*700e-9,bind=builder.idsAt(part,q.x,q.y);for(let j=0;j<4;j++)builder.extraMass.push([bind.ids[j],mass*bind.weights[j]]);}
 }
}
