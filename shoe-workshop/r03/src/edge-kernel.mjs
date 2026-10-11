/** R03-A. Millimetre-space edge registration; not an assembly or material solver. */
export const SCHEMA='kaopu/shoe-edge-calibration@1';
const eps=1e-8;
const mod=(x,n)=>((x%n)+n)%n;
const finite=(x)=>typeof x==='number'&&Number.isFinite(x);
export function boundary(points){
  if(!Array.isArray(points)||points.length<3)throw Error('边界至少需要三个点');
  const p=[];
  for(const q of points){
    if(!Array.isArray(q)||q.length<2||!q.slice(0,2).every(finite))throw Error('边界含非法坐标');
    if(!p.length||Math.hypot(q[0]-p.at(-1)[0],q[1]-p.at(-1)[1])>eps)p.push(q.slice(0,2));
  }
  if(p.length>1&&Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<eps)p.pop();
  if(p.length<3)throw Error('退化边界');
  const s=[0];let area=0;
  for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s.push(s.at(-1)+Math.hypot(b[0]-a[0],b[1]-a[1]));area+=a[0]*b[1]-a[1]*b[0];}
  if(s.at(-1)<eps||Math.abs(area)<eps)throw Error('零面积或零周长边界');
  return {points:p,s,length:s.at(-1),signedArea:area/2};
}
export function pointAt(b,d){
  d=mod(d,b.length);let lo=0,hi=b.points.length;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(b.s[mid]<=d)lo=mid;else hi=mid;}
  const a=b.points[lo],c=b.points[(lo+1)%b.points.length],t=(d-b.s[lo])/(b.s[lo+1]-b.s[lo]);
  return [a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t];
}
export function closest(b,q){
  if(!Array.isArray(q)||!q.slice(0,2).every(finite))throw Error('拾取点非法');
  let best={distance:Infinity};
  for(let i=0;i<b.points.length;i++){
    const a=b.points[i],c=b.points[(i+1)%b.points.length],dx=c[0]-a[0],dy=c[1]-a[1],l2=dx*dx+dy*dy;
    const t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/l2));
    const p=[a[0]+t*dx,a[1]+t*dy],distance=Math.hypot(p[0]-q[0],p[1]-q[1]);
    if(distance<best.distance)best={distance,point:p,arcMm:b.s[i]+t*Math.sqrt(l2),segment:i};
  }return best;
}
export function edgeLength(b,e){
  if(![e.start,e.end].every(v=>finite(v)&&v>=0&&v<1)||typeof e.forward!=='boolean')throw Error('边段参数非法');
  const span=mod((e.forward?1:-1)*(e.end-e.start),1);
  if(span<1e-6)throw Error('起止点重合；请明确选择一段，不自动视为整圈');
  return span*b.length;
}
export function edgePoint(b,e,t){
  if(!finite(t)||t<0||t>1)throw Error('沿边参数非法');
  return pointAt(b,e.start*b.length+(e.forward?1:-1)*edgeLength(b,e)*t);
}
export function edgePolyline(b,e){
  const total=edgeLength(b,e),dir=e.forward?1:-1,knots=[0,total];
  for(const d of b.s.slice(0,-1)){const u=mod(dir*(d-e.start*b.length),b.length);if(u>eps&&u<total-eps)knots.push(u);}
  knots.sort((a,c)=>a-c);return knots.map(d=>pointAt(b,e.start*b.length+dir*d));
}
export function reverseEdge(e){return {...e,start:e.end,end:e.start,forward:!e.forward};}
/** Locate a long approximately straight run. A geometric suggestion, never a verified seam. */
export function suggestEdge(b){
  const n=b.points.length;let best={start:0,length:0};
  for(let i=0;i<n;i++){
    const a=b.points[i];let length=0;
    for(let steps=1;steps<n;steps++){
      const j=(i+steps)%n,p=b.points[j],prev=b.points[(j+n-1)%n];
      length+=Math.hypot(p[0]-prev[0],p[1]-prev[1]);
      if(length>b.length*.45)break;
      const dx=p[0]-a[0],dy=p[1]-a[1],chord=Math.hypot(dx,dy);if(chord<eps)break;
      let deviation=0;
      for(let k=1;k<steps;k++){const q=b.points[(i+k)%n];deviation=Math.max(deviation,Math.abs(dx*(q[1]-a[1])-dy*(q[0]-a[0]))/chord);}
      if(deviation>.75)break;
      if(length>best.length)best={start:b.s[i],length};
    }
  }
  const length=best.length>eps?best.length:b.length*.2;
  return {start:mod(best.start/b.length,1),end:mod((best.start+length)/b.length,1),forward:true};
}
export function sourceKey(data){
  let h=2166136261;const text=JSON.stringify(data.panels.map(p=>[p.objectIndex,p.positionsSha256,p.bbox,p.footprints]));
  for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);
  return data.sourceCommit+':boundary-fnv1a-'+(h>>>0).toString(16);
}
export function getBoundary(data,e){
  const p=data.panels.find(p=>p.objectIndex===e.panelId);if(!p)throw Error('原裁片不存在');
  if(!Number.isInteger(e.component)||!p.footprints[e.component])throw Error('边界分量不存在');
  return boundary(p.footprints[e.component].outer);
}
export function validate(data,state){
  if(!state||state.schema!==SCHEMA||state.sourceKey!==sourceKey(data))throw Error('来源或协议不匹配，拒绝替换当前校准');
  if(state.units!=='mm')throw Error('单位必须为毫米');
  for(const name of ['a','b'])edgeLength(getBoundary(data,state[name]),state[name]);
  if(state.a.panelId===state.b.panelId)throw Error('本阶段要求两个不同原裁片');
  if(!finite(state.pitchMm)||state.pitchMm<1||state.pitchMm>12)throw Error('研究针距超出 1–12 mm');
  if(!state.lastDeltaPercent||Object.keys(state.lastDeltaPercent).sort().join(',')!==['toe','ball','waist','instep','ankle','sole'].sort().join(',')||!Object.values(state.lastDeltaPercent).every(v=>finite(v)&&Math.abs(v)<=8))throw Error('鞋楦版本指纹缺失或非法');
  const side=e=>({panelId:e.panelId,component:e.component,start:e.start,end:e.end,forward:e.forward});
  return {schema:SCHEMA,units:'mm',sourceKey:sourceKey(data),a:side(state.a),b:side(state.b),pitchMm:state.pitchMm,lastDeltaPercent:structuredClone(state.lastDeltaPercent),semantics:'UNCONFIRMED',allowance:'UNKNOWN',materialDirection:'UNKNOWN',assembly:'NOT_IMPLEMENTED'};
}
export function propose(data,lastDeltaPercent){
  const uppers=data.panels.filter(p=>/upper/i.test(p.layer||''));
  const panels=uppers.length>=2?uppers:data.panels; // Source order; no inferred shoe-part semantics.
  if(panels.length<2)throw Error('至少需要两个真实裁片');
  const sides=panels.slice(0,2).map(p=>{let c=0;p.footprints.forEach((f,i)=>{if(f.areaMm2>p.footprints[c].areaMm2)c=i;});return {panelId:p.objectIndex,component:c,...suggestEdge(boundary(p.footprints[c].outer))};});
  return {schema:SCHEMA,units:'mm',sourceKey:sourceKey(data),a:sides[0],b:reverseEdge(sides[1]),pitchMm:3.5,lastDeltaPercent:structuredClone(lastDeltaPercent),semantics:'UNCONFIRMED',allowance:'UNKNOWN',materialDirection:'UNKNOWN',assembly:'NOT_IMPLEMENTED'};
}
export function audit(data,input,currentLast){
  const s=validate(data,input),a=getBoundary(data,s.a),b=getBoundary(data,s.b),la=edgeLength(a,s.a),lb=edgeLength(b,s.b),intervals=Math.max(1,Math.min(1000,Math.round((la+lb)/2/s.pitchMm)));
  const keys=Object.keys(s.lastDeltaPercent).sort(),lastStale=keys.length!==Object.keys(currentLast).length||keys.some(k=>currentLast[k]!==s.lastDeltaPercent[k]);
  const marks=Array.from({length:intervals+1},(_,i)=>({id:i,t:i/intervals,a:edgePoint(a,s.a,i/intervals),b:edgePoint(b,s.b,i/intervals)}));
  const lastDeformed=Object.values(currentLast).some(v=>v!==0);
  return {status:(lastStale||lastDeformed)?'LAST_CHANGED_REVIEW_REQUIRED':'UNCONFIRMED_EDGE_PAIR',aLengthMm:la,bLengthMm:lb,differenceMm:lb-la,relativeDifferencePercent:100*(lb-la)/Math.max(la,lb),intervals,marks,pitchAmm:la/intervals,pitchBmm:lb/intervals,lastStale,lastDeformed,manufacturable:false,assemblyReady:false,unknowns:['原鞋面到楦面区域对应','真实缝边语义与正反面','缝份与削薄','材料方向与伸缩标定','绷楦与接触求解'],note:'等定位点数量不代表等针距；长度相等也不能证明这两条边应该缝在一起。'};
}
