/** Sewing topology in mm. A/B are two ends of ONE thread, not needle/bobbin threads.
 * Based on Weaver Leather Supply hand-sewing teaching. Prescribed routes, not force simulation.
 */
export const SEAM_VERSION='R05.0';
export const SEAM_DEFAULT={type:'saddle',count:13,pitch:3.8,diameter:.40,layerThickness:1.4,holeAngle:50,tightness:1,groove:.09,rows:1,seed:27};
export const SEAM_SOURCES={saddle:'https://www.weaverleathersupply.com/pages/how-to-hand-sew-leather',preparation:'https://www.weaverleathersupply.com/pages/hand-sewing-leather',lockstitch:'https://www.coats.com/en-us/info-hub/basic-stitch-types/',needles:'https://www.groz-beckert.de/en/news/newsletter/sewing/2015/'};
const mix=(a,b,t)=>a+(b-a)*t;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export function validateSeam(input={}){
 const p={...SEAM_DEFAULT,...input};
 if(!['saddle','running'].includes(p.type))throw Error('仅支持已实现的双针马鞍缝与单针平针');
 for(const[k,a,b]of [['count',5,25],['pitch',2.5,5.5],['diameter',.24,.60],['layerThickness',.8,2.5],['holeAngle',25,65],['tightness',0,1],['groove',0,.14]])if(!Number.isFinite(p[k])||p[k]<a||p[k]>b)throw Error('缝制参数超界：'+k);
 if(!Number.isInteger(p.count)||![1,2].includes(p.rows))throw Error('针数或排数无效');
 return p;
}
export function holeAt(p,j,row=0){
 const th=p.holeAngle*Math.PI/180;
 return {id:`r${row}-h${j}`,index:j,row,x:(j-(p.count-1)/2)*p.pitch,z:row===0?-5:5,rx:p.diameter*1.8,rz:p.diameter*.88,angle:th,axis:[Math.cos(th),Math.sin(th)]};
}
function sidePoint(p,h,side,lane){
 const q=lane*h.rx*.48;
 return [h.x+h.axis[0]*q,side*(p.layerThickness-p.groove+p.diameter*.51),h.z+h.axis[1]*q];
}
function bridge(a,b,side,slack,p){
 const out=[],L=dist(a,b),N=Math.max(12,Math.ceil(L/.10));
 for(let i=0;i<=N;i++){
  const t=i/N,arc=Math.sin(Math.PI*t);out.push([mix(a[0],b[0],t),mix(a[1],b[1],t)+side*(.035*p.diameter+slack*p.pitch*.32)*arc*arc,mix(a[2],b[2],t)]);
 }
 return out;
}
function passage(a,b,p){
 const out=[],N=Math.max(24,Math.ceil(dist(a,b)/.07));
 for(let i=0;i<=N;i++){const t=i/N;out.push([mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)]);}
 return out;
}
function join(a,b){if(!a.length)a.push(...b);else a.push(...b.slice(1));}
function cut(points,f){const x=Math.max(0,Math.min(1,f))*(points.length-1),i=Math.floor(x);return [...points.slice(0,i+1),...(i<points.length-1?[[mix(points[i][0],points[i+1][0],x-i),mix(points[i][1],points[i+1][1],x-i),mix(points[i][2],points[i+1][2],x-i)]]:[])];}
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
   let last=sidePoint(p,hs[0],initialSide,initialSide);
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
   if(process){const v=points.at(-1);const n=points.at(-2)||[v[0],v[1]-endSide,v[2]];needleEnds.push({half,row,position:v,direction:[v[0]-n[0],v[1]-n[1],v[2]-n[2]]});}
   const route={id:`r${row}-${half}`,threadId:`thread-${row}`,half,points,parts};halfRoutes.push(route);routes.push(route);segments.push(...parts);
  }
  if(p.type==='saddle'){
    const seed=passage(halfRoutes[0].points[0],halfRoutes[1].points[0],p);
    routes.push({id:`r${row}-seed`,threadId:`thread-${row}`,half:'seed',points:seed,parts:[{kind:'through',holeId:hs[0].id,fromSide:1,toSide:-1,lane:0,points:seed,complete:true}]});
    segments.push(...routes.at(-1).parts);
  }
 }
 return {schema:'kaopu/leather_sewing@1',version:SEAM_VERSION,params:p,units:'millimetres',width:(p.count-1)*p.pitch+14,depth:26,totalThickness:p.layerThickness*2,holes,routes,segments,needleEnds,stage,process,topology:{threadCount:p.rows,needleEndsPerThread:p.type==='saddle'?2:1,continuousThread:true,throughBothLayers:true,lockstitch:false},mechanics:'prescribed sewing path, no stitch-force/friction solver',frozenPhysics:'LEATHER_R04_USER_ACCEPTED_20261009'};
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
