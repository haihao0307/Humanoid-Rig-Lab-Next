// R101_VISUAL_2
/* Mathematical shell generation and static fit, authored for KAOPU HAT10. */
(function(G){
'use strict';const H=G.HAT10;const PI=Math.PI,TAU=2*PI;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const length=v=>Math.hypot(...v);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{const l=length(v)||1;return v.map(x=>x/l);};
const bump=(v,c,w)=>Math.exp(-(((v-c)/w)**2));
function axes(c,ratio){let p=0,x=1,z=0;for(let i=1;i<=512;i++){const t=i*TAU/512,nx=Math.cos(t),nz=ratio*Math.sin(t);p+=Math.hypot(nx-x,nz-z);x=nx;z=nz;}return[c/p,ratio*c/p];}
// Height zero is the measured wear plane. No scanned/anatomical coordinates are used.
function headRadius(y){return Math.sqrt(Math.max(0,1-((y+.025)/.125)**2)/.96);}
H.headShape=(s)=>{const h=H.heads.find(h=>h.id===s.head),[a,b]=axes(s.circumference/100,h.ratio);return{a,b,top:.100,radius:headRadius,id:h.id};};
H.headRadius=headRadius;
function profile(points,t){
 const q=clamp(t)*(points.length-1),i=Math.min(points.length-2,Math.floor(q)),f=q-i;
 const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
 const out=[];for(let k=0;k<2;k++){
  const d=p2[k]-p1[k],l=p1[k]-p0[k],r=p3[k]-p2[k];
  const m1=l*d<=0?0:2*l*d/(l+d),m2=r*d<=0?0:2*r*d/(r+d);
  out[k]=(2*f**3-3*f*f+1)*p1[k]+(f**3-2*f*f+f)*m1+(-2*f**3+3*f*f)*p2[k]+(f**3-f*f)*m2;
 }return out;
}
function normal(fn,u,v,sign=1){
 const e=.000015,du=sub(fn(u+e,v),fn(u-e,v)),dv=sub(fn(u,clamp(v+e)),fn(u,clamp(v-e)));
 let n=cross(du,dv);if(length(n)<1e-13)n=[0,1,0];else n=unit(n).map(x=>x*sign);return n;
}
// A closed volume: distinct exterior, interior and joined boundary edges.
function shell(name,fn,cols,rows,thick,options={}){
 const sign=options.sign||1,closed=options.closed!==false,cap=!!options.cap;
 const position=[],normalArray=[],uv=[],index=[],groups=[];const stride=cols+1,N=(rows+1)*stride;
 const centers=[],normals=[];
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++)centers.push(fn(i/cols,j/rows));
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const il=closed?(i===0||i===cols?cols-1:i-1):Math.max(0,i-1),ir=closed?(i===0||i===cols?1:i+1):Math.min(cols,i+1);
  const du=sub(centers[j*stride+ir],centers[j*stride+il]);
  const dv=sub(centers[Math.min(rows,j+1)*stride+i],centers[Math.max(0,j-1)*stride+i]);
  let nn=cap&&j===rows?[0,1,0]:unit(cross(du,dv)).map(x=>x*sign);normals.push(nn);
 }
 for(let side=0;side<2;side++)for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const p=centers[j*stride+i],n=normals[j*stride+i],offset=side?-thick:0;
  position.push(...p.map((x,k)=>x+offset*n[k]));normalArray.push(...n.map(x=>side?-x:x));
  uv.push(i/cols*(options.uvWidth||.59),j/rows*(options.uvHeight||.18));
 }
 function tri(a,b,c,flip){if(flip)[b,c]=[c,b];const ab=[0,1,2].map(k=>position[3*b+k]-position[3*a+k]),ac=[0,1,2].map(k=>position[3*c+k]-position[3*a+k]);if(length(cross(ab,ac))>1e-13)index.push(a,b,c);}
 for(let side=0;side<2;side++){
  const start=index.length,off=side*N,flip=(sign<0)!==!!side;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
   const a=off+j*stride+i,b=a+1,c=a+stride,d=c+1;tri(a,b,d,flip);tri(a,d,c,flip);
  }groups.push({start,count:index.length-start,role:side?(options.innerRole||'lining'):(options.role||'outer')});
 }
 const start=index.length;
 const bridge=(a,b)=>{tri(a,b,b+N,sign<0);tri(a,b+N,a+N,sign<0);};
 for(let i=0;i<cols;i++)bridge(i+1,i);
 if(!cap)for(let i=0;i<cols;i++)bridge(rows*stride+i,rows*stride+i+1);
 if(!closed)for(let j=0;j<rows;j++){bridge(j*stride,(j+1)*stride);bridge((j+1)*stride+cols,j*stride+cols);}
 groups.push({start,count:index.length-start,role:options.edgeRole||options.role||'outer'});
 return{name,position:new Float32Array(position),normal:new Float32Array(normalArray),uv:new Float32Array(uv),index:new Uint32Array(index),groups,thickness:thick,closedVolume:true};
}
function strand(name,fn,steps,radius,role='thread',sides=5){
 const p=[],n=[],uv=[],idx=[];
 for(let j=0;j<=steps;j++){
  const t=j/steps,c=fn(t),d=unit(sub(fn(Math.min(1,t+.0001)),fn(Math.max(0,t-.0001))));
  let up=unit(cross(d,Math.abs(d[1])<.9?[0,1,0]:[1,0,0])),v=unit(cross(d,up));
  for(let i=0;i<=sides;i++){const a=i*TAU/sides,nn=up.map((x,k)=>x*Math.cos(a)+v[k]*Math.sin(a));p.push(...c.map((x,k)=>x+radius*nn[k]));n.push(...nn);uv.push(t*.4,i/sides*.002);}
 }
 for(let j=0;j<steps;j++)for(let i=0;i<sides;i++){let a=j*(sides+1)+i,b=a+1,c=a+sides+1;idx.push(a,b,c+1,a,c+1,c);}
 for(const end of [0,1]){let off=end*steps*(sides+1);for(let i=1;i<sides-1;i++)idx.push(off,off+(end?i:i+1),off+(end?i+1:i));}
 return{name,position:new Float32Array(p),normal:new Float32Array(n),uv:new Float32Array(uv),index:new Uint32Array(idx),groups:[{start:0,count:idx.length,role}],closedVolume:true,thickness:radius*2};
}
function combine(pieces){
 if(!pieces.length)return null;const p=[],n=[],uv=[],idx=[];
 for(const a of pieces){const o=p.length/3;p.push(...a.position);n.push(...a.normal);uv.push(...a.uv);idx.push(...Array.from(a.index,i=>i+o));}
 return{name:'stitchwork',position:new Float32Array(p),normal:new Float32Array(n),uv:new Float32Array(uv),index:new Uint32Array(idx),groups:[{start:0,count:idx.length,role:'thread'}],closedVolume:true,thickness:.00044};
}
H.generate=function(input,lod=0){
 const began=performance.now(),s=H.sanitize(input),c=H.categories.find(c=>c.id===s.id),head=H.headShape(s);
 const thick=c.thickness*s.thickness,ease=s.ease/1000,ax=head.a+ease+thick,bz=head.b+ease+thick,ht=Math.max(c.height*s.height,c.shape==='visor'?0:.114+thick+ease);
 const pieces=[],N=lod?64:112,M=lod?28:48;let adjusted=0;
 const tables={
  soft:[[1,0],[1.03,.25],[1.04,.48],[.96,.72],[.72,.89],[0,1]],
  bucket:[[1,0],[1,.25],[.98,.66],[.88,.91],[.77,1],[0,1]],
  flat:[[1,0],[1.11,.16],[1.14,.44],[.92,.77],[.54,.96],[0,1]],
  pinch:[[1,0],[.98,.3],[.92,.62],[.85,.85],[.67,1],[0,.98]],
  ear:[[1,0],[1.00,.26],[.94,.55],[.82,.78],[.52,.94],[0,1]],
  field:[[1,0],[1.01,.3],[.98,.65],[.91,.92],[.72,.98],[0,1]],
  round:[[1,0],[1.02,.28],[.95,.58],[.77,.83],[.46,.96],[0,1]],
  high:[[1,0],[.94,.27],[.97,.60],[1.05,.91],[.91,1],[0,1]],
  bell:[[1,0],[1.01,.25],[.96,.51],[.78,.77],[.49,.94],[0,1]],
  pleat:[[1,0],[1.03,.22],[1.26,.50],[1.38,.76],[1.06,.95],[0,1]]
 };
 function crown(u,v,offset=0){
  const th=u*TAU,cs=Math.cos(th),sn=Math.sin(th);let[r,y]=profile(tables[c.shape]||tables.soft,v);y*=ht;
  const fullness=1+(s.fullness-1)*Math.sin(v*PI),flared=fullness;
  let rr=r*flared,cx=0,cz=0;
  if(c.shape==='soft')cz=-(c.slouch||0)*smooth((v-.25)/.75);
  if(c.shape==='flat'){cz=.028*Math.sin(v*PI/2);y-=.022*Math.max(cs,0)*Math.sin(v*PI);rr*=1+.10*Math.max(cs,0)*Math.sin(v*PI);}
  if(c.shape==='pinch'){
   rr*=1-.095*(bump(th,.72,.30)+bump(th,TAU-.72,.30))*Math.sin(v*PI)**2;
   y-=.018*bump(v,.84,.16)*(1-sn*sn)*r;cz=.004*smooth(v);
  }
  if(c.shape==='pleat'){
   const f=(.0038*Math.sin(20*th+.21*Math.sin(v*PI))+.0012*Math.sin(40*th))*Math.sin(v*PI)**.65;
   rr+=f/Math.sqrt(ax*bz);cz=-.011*Math.sin(v*PI);y+=.003*Math.sin(3*th)*Math.sin(v*PI);
  }
  if(c.shape==='ear'){const ear=bump(th,PI/2,.43)+bump(th,3*PI/2,.43);y-=.096*ear*(1-smooth(v/.36));rr+=.18*ear*(1-smooth(v/.4));}
  if(c.shape==='bell')y+=.005*sn*Math.sin(v*PI);
  if(c.shape==='field')y-=.007*cs*smooth(v)*r;
  // Static envelope projection only; not a dynamics/pressure solver.
  let x=(ax*rr+offset)*sn,z=(bz*rr+offset)*cs+cz;
  if(v<.999&&y<head.top&&y>=0){
   const target=headRadius(Math.max(0,y-thick))+((ease+thick)/Math.min(head.a,head.b));
   const actual=Math.hypot(x/head.a,z/head.b);
   if(actual<target){const q=target/Math.max(.000001,actual);x*=q;z*=q;adjusted++;}
  }
  if(v>=.999999){x=0;z=cz;}
  return[x,y,z];
 }
 if(c.shape!=='visor')pieces.push(shell('crown',crown,N,M,thick,{cap:true,uvHeight:ht*1.45}));
 const cuff=c.shape==='soft',bandHeight=c.shape==='visor'?ht:c.band,bandBase=cuff?-.006:-.005;
 const ring=(u,v)=>{const t=u*TAU,rise=bandBase+v*bandHeight,r=1+(cuff?.025:0)+.006*Math.sin(v*PI);return[(ax*r+.00065)*Math.sin(t),rise,(bz*r+.00065)*Math.cos(t)];};
 if(cuff||c.shape==='visor'||c.shape==='pleat')pieces.push(shell('wear-band',ring,N,lod?6:12,cuff?thick*.9:thick,{role:cuff?'rib':'outer',uvHeight:bandHeight}));
 else{
  const inside=(u,v)=>{const t=u*TAU;return[(head.a+ease+.0007)*Math.sin(t),-.001+v*.019,(head.b+ease+.0007)*Math.cos(t)];};
  pieces.push(shell('inner-sweatband',inside,N,4,.00065,{role:'lining',innerRole:'lining',edgeRole:'lining',uvHeight:.019}));
 }
 const hasPeak=['flat','field','visor'].includes(c.shape),fullBrim=c.brim>0&&!hasPeak;
 let brimFn=null;
 if(c.brim>0){
  const width=c.brim*s.brim;
  brimFn=(u,v)=>{
   const t=hasPeak?(u-.5)*PI*1.04:u*TAU,cs=Math.cos(t),sn=Math.sin(t);
   const d=width*v*(hasPeak?(Math.max(0,Math.cos(t))**.65):1+.13*cs+.04*sn);
   let y=.0007-(c.drop||0)*s.brim*v;
   if(['round','high','pinch'].includes(c.shape))y+=.012*v**3*(.7+.3*Math.abs(sn))-.008*Math.max(cs,0)*v;
   if(c.shape==='bucket')y+=.003*Math.sin(5*t+.4)*v*v;
   if(c.shape==='bell')y+=.012*sn*v-.014*v*v;
   if(hasPeak)y-=.009*sn*sn*v;y+=.0015*Math.sin(v*PI);
   return[(ax-thick*.8+d)*sn,y,(bz-thick*.8+d)*cs];
  };
  pieces.push(shell('brim-core',brimFn,hasPeak?(lod?48:80):N,lod?10:20,Math.max(.0012,thick*.85),{closed:!hasPeak,sign:-1,role:'outer',innerRole:'underbrim',uvWidth:hasPeak?.33:.59,uvHeight:width}));
 }
 if(['pinch','round','high','bell'].includes(c.shape)){
  const low=.006,span=c.band;
  const bandV=(u,v)=>{const goal=low+span*v;let lo=0,hi=.6;for(let k=0;k<12;k++){const mid=(lo+hi)/2;if(crown(u,mid)[1]<goal)lo=mid;else hi=mid;}return(lo+hi)/2;};
  const belt=(u,v)=>{const t=bandV(u,v),p=crown(u,t),n=normal(crown,u,t);return p.map((x,k)=>x+n[k]*.0012);};
  pieces.push(shell('ribbon',belt,N,6,.0008,{role:'trim',innerRole:'trim',edgeRole:'trim',uvHeight:c.band}));
  const bow=(u,v)=>{const ang=(.72+(u-.5)*.11)*TAU,t=bandV(ang/TAU,.12+.76*v),p=crown(ang/TAU,t),n=normal(crown,ang/TAU,t),bulge=.0028+.0045*Math.sin(u*PI)**2*Math.sin(v*PI);return p.map((x,k)=>x+n[k]*bulge);};
  pieces.push(shell('side-fold',bow,20,8,.0008,{closed:false,role:'trim',innerRole:'trim',edgeRole:'trim',uvWidth:.060,uvHeight:c.band*.75}));
 }
 const stitches=[];
 function sew(fn,loops=120){
  const count=lod?Math.ceil(loops*.65):loops;
  for(let i=0;i<count;i++){
   const from=i/count,to=(i+.62)/count;
   stitches.push(strand('stitch',t=>fn(mix(from,to,t)),2,.00023,'thread',4));
  }
 }
 if(brimFn){
  const rows=c.shape==='bucket'?[.23,.45,.67,.87]:[.82];
  for(const v of rows)sew(u=>{const p=brimFn(u,v);return[p[0],p[1]+.0007,p[2]];},hasPeak?75:190);
 }
 if(['flat','field','pleat'].includes(c.shape)){
  const seams=c.shape==='flat'?6:c.shape==='field'?4:0;
  for(let k=0;k<seams;k++){
   const u=k/seams;sew(v=>{const t=.035+.92*v,p=crown(u,t),n=normal(crown,u,t);return p.map((x,j)=>x+n[j]*.0007);},50);
  }
 }
 if(c.shape==='soft'){
  for(let k=0;k<c.braids;k++)for(let side=0;side<2;side++){
   const fn=t=>{const v=.24+.65*t,u=k/c.braids+(side?1:-1)*.010*Math.sin(4*PI*t),p=crown(u,v),n=normal(crown,u,v),d=.0012+.0007*Math.cos(4*PI*t+(side?PI:0));return p.map((x,j)=>x+n[j]*d);};
   pieces.push(strand('braid-'+k+'-'+side,fn,lod?24:52,.0018,'braid',6));
  }
 }
 if(c.shape==='ear'){
  const edge=t=>{const p=crown(t,.005),n=normal(crown,t,.005);return p.map((x,k)=>x+n[k]*.001);};
  pieces.push(strand('ear-binding',edge,N,.002,'trim',6));
 }
 if(stitches.length)pieces.push(combine(stitches));
 let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],vertices=0,triangles=0,bytes=0;
 for(const p of pieces){vertices+=p.position.length/3;triangles+=p.index.length/3;bytes+=p.position.byteLength+p.normal.byteLength+p.uv.byteLength+p.index.byteLength;for(let i=0;i<p.position.length;i++) {let k=i%3;min[k]=Math.min(min[k],p.position[i]);max[k]=Math.max(max[k],p.position[i]);}}
 return{schema:H.schema,id:s.id,spec:s,head:{a:head.a,b:head.b,top:head.top},pieces,bounds:{min,max},stats:{vertices,triangles,bytes,requestedCrownHeight:c.height*s.height,effectiveCrownHeight:ht,heightFitClamped:ht>c.height*s.height+1e-8,generationMS:performance.now()-began,fit:'static analytic envelope; not IPC',projectionEvaluations:adjusted},origin:'equations-and-new-category-spectrum'};
};
})(globalThis);
