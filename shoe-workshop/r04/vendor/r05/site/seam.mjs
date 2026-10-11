/** Sewing topology in mm. A/B are two ends of ONE thread, not needle/bobbin threads.
 * Based on Weaver Leather Supply hand-sewing teaching. Prescribed routes, not force simulation.
 */
export const SEAM_VERSION='R05.1';
export const SEAM_DEFAULT={type:'saddle',count:13,pitch:3.8,diameter:.40,layerThickness:1.4,holeAngle:50,tightness:1,groove:.025,rows:1,seed:27,tensionN:.8,surfaceResponse:true};
export const SEAM_SOURCES={saddle:'https://www.weaverleathersupply.com/pages/how-to-hand-sew-leather',preparation:'https://www.weaverleathersupply.com/pages/hand-sewing-leather',lockstitch:'https://www.coats.com/en-us/info-hub/basic-stitch-types/',needles:'https://www.groz-beckert.de/en/news/newsletter/sewing/2015/'};
const mix=(a,b,t)=>a+(b-a)*t;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export function validateSeam(input={}){
 const p={...SEAM_DEFAULT,...input};
 if(!['saddle','running'].includes(p.type))throw Error('仅支持已实现的双针马鞍缝与单针平针');
 for(const[k,a,b]of [['count',5,25],['pitch',2.5,5.5],['diameter',.24,.60],['layerThickness',.8,2.5],['holeAngle',25,65],['tightness',0,1],['groove',0,.14],['tensionN',0,2.4]])if(!Number.isFinite(p[k])||p[k]<a||p[k]>b)throw Error('缝制参数超界：'+k);
 if(!Number.isInteger(p.count)||![1,2].includes(p.rows))throw Error('针数或排数无效');
 return p;
}
export function holeAt(p,j,row=0){
 const th=p.holeAngle*Math.PI/180;
 return {id:`r${row}-h${j}`,index:j,row,x:(j-(p.count-1)/2)*p.pitch,z:row===0?-5:5,rx:p.diameter*(1.39-.09*p.tightness),rz:p.diameter*(.71-.09*p.tightness),angle:th,axis:[Math.cos(th),Math.sin(th)]};
}
function sidePoint(p,h,side,lane){
 const q=lane*h.rx*.45;
 return [h.x+h.axis[0]*q,side*(p.layerThickness-p.diameter*.65),h.z+h.axis[1]*q];
}
function bridge(a,b,side,slack,p){
 const dx=b[0]-a[0],dz=b[2]-a[2],L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L;
 const rx=Math.min(p.diameter*.95,L*.24),ry=p.diameter*(.65+.47)-p.groove;
 const out=[],steps=24;
 const add=(u,y)=>out.push([a[0]+ux*u,y,a[2]+uz*u]);
 for(let i=0;i<=steps;i++){const f=i/steps*Math.PI/2;add(rx*(1-Math.cos(f)),a[1]+side*ry*Math.sin(f));}
 const span=L-2*rx,amp=slack*Math.min(p.pitch*.18,span*span/(25*p.diameter)),N=Math.max(16,Math.ceil(span/.05));
 for(let i=1;i<=N;i++){const f=i/N;add(rx+span*f,a[1]+side*(ry+amp*Math.sin(Math.PI*f)**2));}
 for(let i=1;i<=steps;i++){const f=i/steps*Math.PI/2;add(L-rx+rx*Math.sin(f),b[1]+side*ry*Math.cos(f));}
 return out;
}
function passage(a,b,p){
 const out=[],N=Math.max(32,Math.ceil(dist(a,b)/.05));
 for(let i=0;i<=N;i++){const t=i/N,s=t*t*(3-2*t);out.push([mix(a[0],b[0],s),mix(a[1],b[1],t),mix(a[2],b[2],s)]);}
 return out;
}
function join(a,b){if(!a.length)a.push(...b);else a.push(...b.slice(1));}
function cut(points,f){const x=Math.max(0,Math.min(1,f))*(points.length-1),i=Math.floor(x);return [...points.slice(0,i+1),...(i<points.length-1?[[mix(points[i][0],points[i+1][0],x-i),mix(points[i][1],points[i+1][1],x-i),mix(points[i][2],points[i+1][2],x-i)]]:[])];}

/** Bounded fillets at entry/exit remove artificial 90-degree tube joints.
 * Topological segment endpoints remain in parts; points is the final rendered/exported route.
 */
function roundRoute(points,radius){
 const distanceToSegment=(p,a,b)=>{const v=b.map((x,i)=>x-a[i]),l=v.reduce((s,x)=>s+x*x,0),t=Math.max(0,Math.min(1,p.reduce((s,x,i)=>s+(x-a[i])*v[i],0)/Math.max(l,1e-20)));return Math.hypot(...p.map((x,i)=>x-a[i]-t*v[i]));};
 function simplify(p){if(p.length<3)return p;let max=0,index=0;for(let i=1;i<p.length-1;i++){const d=distanceToSegment(p[i],p[0],p.at(-1));if(d>max){max=d;index=i;}}if(max<radius*.024)return [p[0],p.at(-1)];return [...simplify(p.slice(0,index+1)).slice(0,-1),...simplify(p.slice(index))];}
 const raw=points.filter((p,i)=>i===0||dist(points[i-1],p)>1e-8),a=simplify(raw);if(a.length<3)return a;
 const out=[a[0]];
 for(let i=1;i<a.length-1;i++){
  const x=a[i-1],p=a[i],y=a[i+1],l=dist(x,p),m=dist(p,y),rr=Math.min(radius,l*.40,m*.40);
  const u=p.map((q,k)=>mix(q,x[k],rr/l)),v=p.map((q,k)=>mix(q,y[k],rr/m));out.push(u);
  for(let j=1;j<=20;j++){const f=j/20;out.push(p.map((q,k)=>(1-f)*(1-f)*u[k]+2*(1-f)*f*q+f*f*v[k]));}
 }
 out.push(a.at(-1));return out;
}
export function buildSeam(input={},process=null){
 const p=validateSeam(input),holes=[],routes=[],needleEnds=[],segments=[];
 let stage='已收紧的完整针路',jActive=null;
 if(process){jActive=Math.max(1,Math.min(p.count-1,Math.floor(process.hole||1)));stage=process.phase<.20?'第一端针就位':process.phase<.40?'第一端针穿过两层皮革':process.phase<.55?'另一端针反向就位':process.phase<.75?'另一端针从同一孔反穿':'两端收线，针脚贴住孔口';if(p.type==='running')stage=process.phase<.60?'单针穿孔，换到另一面':'收紧当前针脚';}
 for(let row=0;row<p.rows;row++){
  const hs=Array.from({length:p.count},(_,j)=>holeAt(p,j,row));holes.push(...hs);
  const strands=p.type==='saddle'?2:1;
  const halfRoutes=[];
  for(let strand=0;strand<strands;strand++){
   const half=strand===0?'A':'B';let points=[],parts=[];
   const initialSide=strand===0?1:-1;
   let last=sidePoint(p,hs[0],initialSide,0);
   points.push(last);let endSide=initialSide;
   const end=process?jActive:p.count-1;
   for(let j=1;j<=end;j++){
    const side=initialSide*(j%2===1?1:-1),lane=-side;
    const a=sidePoint(p,hs[j],side,lane),b=sidePoint(p,hs[j],-side,lane);
    let slack=1-p.tightness;
    let bridgeFrac=1,passFrac=1;
    if(process&&j===end){
      const f=Math.max(0,Math.min(1,process.phase));
      if(p.type==='running'){bridgeFrac=Math.min(1,f/.15);passFrac=Math.max(0,Math.min(1,(f-.15)/.45));slack=Math.max(0,(1-f)/.40);}
      else if(strand===0){bridgeFrac=Math.min(1,f/.20);passFrac=Math.max(0,Math.min(1,(f-.20)/.20));slack=Math.max(0,(1-f)/.25);}
      else{bridgeFrac=Math.max(0,Math.min(1,(f-.40)/.15));passFrac=Math.max(0,Math.min(1,(f-.55)/.20));slack=Math.max(0,(1-f)/.25);}
      slack=Math.min(1,slack);
    }
    const br=bridge(last,a,side,slack,p),brPart=cut(br,bridgeFrac);
    if(bridgeFrac>0){join(points,brPart);parts.push({kind:side===1?'front':'back',from:j-1,to:j,side,points:brPart});}
    if(bridgeFrac===1&&passFrac>0){const pp=cut(passage(a,b,p),passFrac);join(points,pp);parts.push({kind:'through',holeId:hs[j].id,fromSide:side,toSide:-side,lane,points:pp,complete:passFrac===1});}
    last=b;endSide=-side;
   }
   if(process){const v=points.at(-1);const n=points.at(-2)||[v[0],v[1]-endSide,v[2]];const fromSide=initialSide*(end%2===1?1:-1),started=p.type==='running'||strand===0||process.phase>=.40;needleEnds.push({half,row,position:v,direction:[0,started?-fromSide:fromSide,0]});}
   const route={id:`r${row}-${half}`,threadId:`thread-${row}`,half,points,parts};halfRoutes.push(route);routes.push(route);segments.push(...parts);
  }
  if(p.type==='saddle'){
    const seed=passage(halfRoutes[0].points[0],halfRoutes[1].points[0],p);
    routes.push({id:`r${row}-seed`,threadId:`thread-${row}`,half:'seed',points:seed,parts:[{kind:'through',holeId:hs[0].id,fromSide:1,toSide:-1,lane:0,points:seed,complete:true}]});
    segments.push(...routes.at(-1).parts);
  }
 }
 // Analytic skin-entry turns are already tangent continuous.
 return {schema:'kaopu/leather_sewing@1',version:SEAM_VERSION,params:p,units:'millimetres',width:(p.count-1)*p.pitch+14,depth:26,totalThickness:p.layerThickness*2,holes,routes,segments,needleEnds,stage,process,topology:{threadCount:p.rows,needleEndsPerThread:p.type==='saddle'?2:1,continuousThread:true,throughBothLayers:true,curvedEntrySpansIncluded:true,lockstitch:false},mechanics:'prescribed sewing path, no stitch-force/friction solver',frozenPhysics:'LEATHER_R04_USER_ACCEPTED_20261009'};
}
export function continuousRoutes(model){
 if(model.process||model.params.type!=='saddle')return model.routes;
 const raw=r=>{const a=[r.points[0]];for(const s of r.parts)join(a,s.points);return a;};
 const routes=[];
 for(let row=0;row<model.params.rows;row++){
  const a=model.routes.find(r=>r.id===`r${row}-A`),b=model.routes.find(r=>r.id===`r${row}-B`),seed=model.routes.find(r=>r.id===`r${row}-seed`);
  const points=raw(a).reverse().concat(raw(seed).slice(1),raw(b).slice(1));
  routes.push({id:`r${row}-continuous`,threadId:`thread-${row}`,half:'whole',points,hasArtificialFirstHoleCaps:false});
 }
 return routes;
}

export function routeLength(points){return points.slice(1).reduce((s,p,i)=>s+dist(points[i],p),0);}
export function insideHole(point,h,margin=0){const dx=point[0]-h.x,dz=point[2]-h.z,u=dx*h.axis[0]+dz*h.axis[1],v=-dx*h.axis[1]+dz*h.axis[0];return (u/(h.rx-margin))**2+(v/(h.rz-margin))**2<=1.000001;}
export function auditSeam(m){
 let passages=0,front=0,back=0,outside=0,minThroughSpan=Infinity;
 for(const s of m.segments){
  if(s.kind==='front')front++;else if(s.kind==='back')back++;else if(s.kind==='through'){
   passages++;const h=m.holes.find(h=>h.id===s.holeId);for(const pt of s.points)if(!insideHole(pt,h))outside++;
   if(s.complete)minThroughSpan=Math.min(minThroughSpan,Math.max(...s.points.map(p=>p[1]))-Math.min(...s.points.map(p=>p[1])));
  }
 }
 const seedErrors=[];
 for(let row=0;row<m.params.rows;row++)if(m.params.type==='saddle'){
  const a=m.routes.find(r=>r.id===`r${row}-A`),b=m.routes.find(r=>r.id===`r${row}-B`),c=m.routes.find(r=>r.id===`r${row}-seed`);
  seedErrors.push(dist(a.points[0],c.points[0]),dist(b.points[0],c.points.at(-1)));
 }
 return {finite:m.routes.every(r=>r.points.every(p=>p.every(Number.isFinite))),passages,frontSpans:front,backSpans:back,pointsOutsideHole:outside,minCompleteThroughSpanMM:minThroughSpan===Infinity?0:minThroughSpan,threadJoinErrorMM:Math.max(0,...seedErrors),totalThreadMM:m.routes.reduce((s,r)=>s+routeLength(r.points),0),totalThicknessMM:m.totalThickness,threadCount:m.topology.threadCount,physicalSolver:false};
}
