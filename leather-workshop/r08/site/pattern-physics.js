import * as T from 'three';
import {PanelAssembly,rectangle} from './panels.js';
import {SeamPath,SeamIndex,makeSewnYarn} from './sewing.js';
// The simulation topology is cut from the real pattern outline. Reference mesh
// and fine shell share material coordinates, not the nearest unrelated vertex.
const V=(...v)=>new T.Vector3(...v),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function clean(r){const a=[];for(const p of r)if(!a.length||p.distanceTo(a.at(-1))>1e-7)a.push(p.clone());if(a[0].distanceTo(a.at(-1))<1e-7)a.pop();return a;}
function inside(x,y,r){let v=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)v=!v;}return v;}
function simplifyPhysical(r,tolerance=.35){let ring=clean(r),changed=true;while(changed&&ring.length>4){changed=false;for(let i=0;i<ring.length;i++){const a=ring[(i-1+ring.length)%ring.length],p=ring[i],b=ring[(i+1)%ring.length],d=b.clone().sub(a),u=clamp(p.clone().sub(a).dot(d)/d.lengthSq(),0,1);if(p.distanceTo(a.clone().addScaledVector(d,u))<tolerance&&a.distanceTo(b)<25){ring.splice(i,1);changed=true;break;}}}return ring;}
function coarse(part){const poly=simplifyPhysical(part.shape.getPoints(12)),ring=[],step=part.simStep||18;
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],L=a.distanceTo(b),n=Math.max(1,Math.ceil(L/step));for(let j=0;j<n;j++)ring.push(a.clone().lerp(b,j/n));}
 const points=[],push=p=>{const q={x:p.x,y:p.y,id:points.length};points.push(q);return q;};const boundary=ring.map(push),ctx=new POLY2TRI.SweepContext(boundary,{cloneArrays:true});const holes=part.shape.holes.map(h=>clean(h.getPoints(18)));ctx.addHoles(holes.map(h=>h.map(push)));
 for(let y=-part.h/2+step*.48;y<part.h/2;y+=step)for(let x=-part.w/2+step*.54;x<part.w/2;x+=step)if(inside(x,y,poly)&&!holes.some(h=>inside(x,y,h))){let min=Infinity;for(const loop of[ring,...holes])for(let i=0;i<loop.length;i++){const a=loop[i],b=loop[(i+1)%loop.length],dx=b.x-a.x,dy=b.y-a.y,f=clamp(((x-a.x)*dx+(y-a.y)*dy)/Math.max(1e-12,dx*dx+dy*dy),0,1);min=Math.min(min,Math.hypot(x-a.x-f*dx,y-a.y-f*dy));}if(min>Math.min(step*.25,part.h*.15))ctx.addPoint(push({x:x+.007*Math.sin(y),y:y+.009*Math.cos(x)}));}
 ctx.triangulate();return{points,faces:ctx.getTriangles().map(t=>t.getPoints().map(p=>p.id))};
}
function offsetPath(points,offset,shape){const ps=points.map(p=>new T.Vector2(...p)),closed=ps[0].distanceTo(ps.at(-1))<1e-6,outer=clean(shape.getPoints(20)),holes=shape.holes.map(h=>clean(h.getPoints(20)));
 const clearance=p=>{if(!inside(p.x,p.y,outer)||holes.some(h=>inside(p.x,p.y,h)))return -1e10;let d=Infinity;for(const ring of[outer,...holes])for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],v=b.clone().sub(a),t=clamp(p.clone().sub(a).dot(v)/Math.max(1e-12,v.lengthSq()),0,1);d=Math.min(d,p.distanceTo(a.clone().addScaledVector(v,t)));}return d;};
 return ps.map((p,i)=>{const a=ps[i===0&&closed?ps.length-2:Math.max(0,i-1)],b=ps[i>=ps.length-2&&closed?1:Math.min(ps.length-1,i+1)],t=b.clone().sub(a).normalize(),n=new T.Vector2(-t.y,t.x),A=p.clone().addScaledVector(n,offset),B=p.clone().addScaledVector(n,-offset);return(clearance(A)>=clearance(B)?A:B).toArray();});
}
PanelAssembly.prototype.add=function(input){
 const config=this.config,def={...input},shape=def.shape?def.shape.clone():rectangle(def.w,def.h,0),get=shape.getPoints.bind(shape);shape.getPoints=n=>clean(get(n));def.shape=shape;
 def.closedU=[-.43,0,.43].every(v=>def.map(-def.w/2,v*def.h).distanceTo(def.map(def.w/2,v*def.h))<1e-5);def.closedV=[-.43,0,.43].every(u=>def.map(u*def.w,-def.h/2).distanceTo(def.map(u*def.w,def.h/2))<1e-5);
 const part={...def,index:this.parts.length,t:def.t*config.thicknessScale};
 part.normal=(u,v)=>{if(def.name==='formed-crown-top'){u=clamp(u,-def.w/2+.08,def.w/2-.08);v=clamp(v,-def.h/2+.08,def.h/2-.08);}const a=def.map(u+.02,v).sub(def.map(u-.02,v)),b=def.map(u,v+.02).sub(def.map(u,v-.02)),n=a.cross(b);if(n.lengthSq()<1e-12)n.set(0,def.flip?-1:1,0);return n.normalize().multiplyScalar(def.flip?-1:1);};
 const m=coarse(part),grid=[];if(!this.refFrames)this.refFrames=[];if(!this.frameTriangles)this.frameTriangles=[];
 for(const q of m.points){const p=def.map(q.x,q.y),key=part.index+':'+p.toArray().map(v=>Math.round(v*1e6)).join(',');let id=this.weld.get(key);if(id===undefined){id=this.positions.length/3;this.positions.push(...p);this.weld.set(key,id);const n=part.normal(q.x,q.y),u=clamp(q.x,-part.w/2+.08,part.w/2-.08),v=clamp(q.y,-part.h/2+.08,part.h/2-.08),t=def.map(u+.02,v).sub(def.map(u-.02,v)).normalize();t.addScaledVector(n,-t.dot(n)).normalize();this.refFrames[id]={t,n};}grid.push(id);}
 part.lookup=[];part.lookupGrid=new Map();const cell=20;
 for(const f0 of m.faces){let f=f0.slice();const a=m.points[f[0]],b=m.points[f[1]],c=m.points[f[2]],det=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(Math.abs(det)<1e-12)continue;
  const ids=f.map(i=>grid[i]),A=V(...this.positions.slice(ids[0]*3,ids[0]*3+3)),B=V(...this.positions.slice(ids[1]*3,ids[1]*3+3)),C=V(...this.positions.slice(ids[2]*3,ids[2]*3+3));if(new Set(ids).size<3||B.clone().sub(A).cross(C.clone().sub(A)).length()<1e-8)continue;
  const rec={ids,uv:[a,b,c],inv:[(c.y-a.y)/det,-(c.x-a.x)/det,-(b.y-a.y)/det,(b.x-a.x)/det]};part.lookup.push(rec);for(let x=Math.floor(Math.min(a.x,b.x,c.x)/cell);x<=Math.floor(Math.max(a.x,b.x,c.x)/cell);x++)for(let y=Math.floor(Math.min(a.y,b.y,c.y)/cell);y<=Math.floor(Math.max(a.y,b.y,c.y)/cell);y++){const k=x+','+y;if(!part.lookupGrid.has(k))part.lookupGrid.set(k,[]);part.lookupGrid.get(k).push(rec);}
  const out=ids.slice();if((det<0)!==!!def.flip)[out[1],out[2]]=[out[2],out[1]];this.triangles.push([...out,part.t,def.formed===false?0:1]);
  this.frameTriangles.push({ids,inv:rec.inv,flip:!!def.flip,area:B.sub(A).cross(C.sub(A)).length()*.5});
 }
 let paths=(def.paths||[]).map(p=>({points:p.points.map(q=>q.slice()),options:{...p.options}}));
 if(config.stitchStyle==='double'){const next=[];for(const p of paths){next.push(p,{points:offsetPath(p.points,1.9,shape),options:{...p.options}});}paths=next;}
 if(config.stitchStyle==='running')for(const p of paths)p.options.type='running';
 if(['zigzag','cross'].includes(config.stitchStyle)){const crossed=[];for(const p of paths){const model=new SeamPath(p.points,def.map,{pitch:config.pitch||3.4,totalThickness:part.t,tension:config.tension,response:config.response}),n=Math.max(4,Math.round(model.length/(config.pitch||3.4)));for(let lane=0;lane<(config.stitchStyle==='cross'?2:1);lane++){const points=[];for(let i=0;i<=n;i++)points.push(model.frame(i/n*model.length,((i+lane)%2?1:-1)*.65).uv.toArray());crossed.push({points,options:{...p.options,type:'running',knotHoles:true}});}}paths=crossed;}

 part.paths=paths.map((p,i)=>new SeamPath(p.points,def.map,{pitch:config.pitch||3.4,diameter:config.threadDiameter||Math.min(.4,.28+part.t*.025),totalThickness:part.t,center:0,tension:config.tension,response:config.response,id:def.name+'-'+i,...p.options}));
 part.seamIndex=new SeamIndex(part.paths);this.parts.push(part);this.seams.push(...part.paths);this.buildPanel(part);
 for(let i=0;i<part.paths.length;i++)if(paths[i].options.threadVisible!==false){const yarn=makeSewnYarn(part.paths[i],part,this,this.mats.thread);this.root.add(yarn);this.skinMeshes.push(yarn);}return part;
};
PanelAssembly.prototype.idsAt=function(part,u,v){let best=null,bestScore=Infinity;const list=part.lookupGrid.get(Math.floor(u/20)+','+Math.floor(v/20))||part.lookup;
 for(const t of list){const a=t.uv[0],x=u-a.x,y=v-a.y,w1=t.inv[0]*x+t.inv[1]*y,w2=t.inv[2]*x+t.inv[3]*y,w0=1-w1-w2,score=Math.max(0,-w0)+Math.max(0,-w1)+Math.max(0,-w2);if(score<bestScore){best=t;bestScore=score;best.weights=[w0,w1,w2,0];if(score<1e-9)break;}}
 if(!best)throw Error('物理纸样不含有效三角形 '+part.name);return{ids:[...best.ids,best.ids[2]],weights:best.weights.slice()};
};
PanelAssembly.prototype.binding=function(part,u,v,p,n){if(this.config.thumbnail)return null;const q=this.idsAt(part,u,v),base=V(),X=V(),Z=V();for(let i=0;i<4;i++){base.addScaledVector(V(...this.positions.slice(q.ids[i]*3,q.ids[i]*3+3)),q.weights[i]);X.addScaledVector(this.refFrames[q.ids[i]].t,q.weights[i]);Z.addScaledVector(this.refFrames[q.ids[i]].n,q.weights[i]);}Z.normalize();X.addScaledVector(Z,-X.dot(Z)).normalize();const Y=Z.clone().cross(X),d=p.clone().sub(base);return{...q,delta:[d.dot(X),d.dot(Y),d.dot(Z)],normal:[n.dot(X),n.dot(Y),n.dot(Z)],age:[Math.exp(-Math.max(0,Math.min(part.w/2-Math.abs(u),part.h/2-Math.abs(v)))/5),Math.pow(Math.sin(u*.049+v*.034),14),clamp(n.y*.65+.35,0,1)]};};
const oldFinish=PanelAssembly.prototype.finish;
PanelAssembly.prototype.finish=function(){const root=oldFinish.call(this),rig=root.userData.rig,old=rig.texture;const count=this.positions.length/3,pixels=new Float32Array(count*12);for(let i=0;i<count;i++){pixels.set(this.positions.slice(i*3,i*3+3),i*12);pixels[i*12+3]=1;pixels.set(this.refFrames[i].t.toArray(),i*12+4);pixels.set(this.refFrames[i].n.toArray(),i*12+8);}rig.pixels=pixels;rig.texture=new T.DataTexture(pixels,3,count,T.RGBAFormat,T.FloatType);rig.texture.needsUpdate=true;rig.nodeCount=count;rig.frameTriangles=this.frameTriangles;rig.referenceFrames=this.refFrames;rig.data.referenceFrames=this.refFrames.map(f=>({t:f.t.toArray(),n:f.n.toArray()}));rig.data.frameTriangles=this.frameTriangles;old.dispose();return root;};
