import * as THREE from 'three';
import {ShortsClothRuntime} from './ShortsClothRuntime.mjs';
import {scSolveBending} from './ShortsBending.mjs';
import {inspectShortsTriangleCrossings} from './ShortsCoverageIntersection.mjs';

const dist=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const yieldUI=()=>new Promise(r=>setTimeout(r,0));

// An explicit second DESIGN candidate: ordinary four-panel rise continuations
// replace four gusset attachments. All retained source UVs and paper rests stay
// unchanged; removed G area/mass is not transferred to the formed surface.
function basicFourPanel(d){
 const gr=d.ranges.find(r=>r.pieceId==='G'),keep=Array.from({length:d.positions.length/3},(_,i)=>i).filter(i=>i<gr.offset||i>=gr.offset+gr.count),map=new Map(keep.map((id,i)=>[id,i]));
 const take=(values,width)=>Float64Array.from(keep.flatMap(id=>Array.from(values.slice(id*width,id*width+width))));
 const seams=d.seams.filter(s=>!s.id.startsWith('gusset-')).map(s=>({...s,pairs:s.pairs.map(p=>({...p,a:map.get(p.a),b:map.get(p.b)}))}));
 for(const prefix of ['F','B']){
  const a=d.seams.find(s=>s.id==='gusset-'+prefix+'L'),b=d.seams.find(s=>s.id==='gusset-'+prefix+'R'),byG=new Map(b.pairs.map(p=>[p.b,p.a]));
  // Mirrored halves have distinct G indices. Match arc order by the shared
  // front/back apex, rather than relying on source-array order.
  const gUV=id=>Array.from(d.sourceUV.slice(id*2,id*2+2)),apex=a.pairs.find(p=>Math.abs(gUV(p.b)[0])<1e-10),otherA=a.pairs.find(p=>p!==apex&&Math.abs(gUV(p.b)[0])>1e-10);
  const orderedA=a.pairs.slice().sort((p,q)=>dist(gUV(p.b),gUV(apex.b))-dist(gUV(q.b),gUV(apex.b)));
  const apexB=b.pairs.find(p=>Math.abs(gUV(p.b)[0])<1e-10),orderedB=b.pairs.slice().sort((p,q)=>dist(gUV(p.b),gUV(apexB.b))-dist(gUV(q.b),gUV(apexB.b)));
  if(!apex||!apexB||!otherA||orderedA.length!==orderedB.length)throw Error('Basic rise correspondence unavailable');
  const pairs=orderedA.map((p,i)=>({a:map.get(p.a),b:map.get(orderedB[i].a)}));
  for(let i=1;i<pairs.length;i++){const x=orderedA[i-1].a,y=orderedA[i].a,u=orderedB[i-1].a,v=orderedB[i].a;if(Math.abs(dist(gUV(x),gUV(y))-dist(gUV(u),gUV(v)))>1e-8)throw Error('Basic rise source feeds disagree');}
  seams.push({id:'basic-'+prefix+'-rise-continuation',pairs});
 }
 const ranges=d.ranges.filter(r=>r.pieceId!=='G').map(r=>({...r,offset:map.get(r.offset)}));
 return{...d,positions:take(d.positions,3),sourceUV:take(d.sourceUV,2),uvs:take(d.sourceUV,2),masses:take(d.masses,1),mass:take(d.masses,1),pieces:d.pieces.filter(p=>p.id!=='G'),ranges,seams,triangles:Uint32Array.from(Array.from(d.triangles).filter(id=>map.has(id)).map(id=>map.get(id))),waistIndices:Array.from(d.waistIndices,i=>map.get(i)),elasticEdges:d.elasticEdges.map(e=>({...e,a:map.get(e.a),b:map.get(e.b)})),casing:{...d.casing,stitchPaths:(d.casing.stitchPaths||[]).map(p=>({...p,indices:p.indices.map(i=>map.get(i))}))},receipt:{...d.receipt,trialDesign:'four main panels plus four waistband sectors; independent gusset omitted explicitly'}};
}

// Linear refinement of each ORIGINAL flat source triangle, including matched
// seam midpoints. Refinement changes discretization, never the cut outline.
function refinePaper(d){
 const uv=[],xyz=[],tri=[],ranges=[],oldMap=new Map(),midMap=new Map(),waistOld=new Set(d.waistIndices),waist=[];
 const edgeKey=(a,b)=>[Math.min(a,b),Math.max(a,b)].join(':');
 for(const range of d.ranges){const begin=uv.length/2;for(let i=range.offset;i<range.offset+range.count;i++){oldMap.set(i,uv.length/2);uv.push(...d.sourceUV.slice(i*2,i*2+2));xyz.push(...d.positions.slice(i*3,i*3+3));if(waistOld.has(i))waist.push(oldMap.get(i));}
  const midpoint=(a,b)=>{const key=edgeKey(a,b);if(midMap.has(key))return midMap.get(key);const id=uv.length/2;midMap.set(key,id);for(let k=0;k<2;k++)uv.push((d.sourceUV[a*2+k]+d.sourceUV[b*2+k])/2);for(let k=0;k<3;k++)xyz.push((d.positions[a*3+k]+d.positions[b*3+k])/2);if(waistOld.has(a)&&waistOld.has(b))waist.push(id);return id;};
  for(let t=0;t<d.triangles.length;t+=3){const ids=Array.from(d.triangles.slice(t,t+3));if(ids[0]<range.offset||ids[0]>=range.offset+range.count)continue;const[a,b,c]=ids.map(i=>oldMap.get(i)),ab=midpoint(ids[0],ids[1]),bc=midpoint(ids[1],ids[2]),ca=midpoint(ids[2],ids[0]);tri.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}
  ranges.push({...range,offset:begin,count:uv.length/2-begin});
 }
 const seams=d.seams.map(s=>({...s,pairs:s.pairs.flatMap((p,i)=>{const pair={...p,a:oldMap.get(p.a),b:oldMap.get(p.b)};if(i===s.pairs.length-1)return[pair];const q=s.pairs[i+1],a=midMap.get(edgeKey(p.a,q.a)),b=midMap.get(edgeKey(p.b,q.b));if(a===undefined||b===undefined)throw Error('Refined seam is not a pair of original boundary edges');return[pair,{a,b}];})}));
 const masses=new Float64Array(uv.length/2);for(let t=0;t<tri.length;t+=3){const[a,b,c]=tri.slice(t,t+3),area=Math.abs((uv[b*2]-uv[a*2])*(uv[c*2+1]-uv[a*2+1])-(uv[b*2+1]-uv[a*2+1])*(uv[c*2]-uv[a*2]))/2;for(const i of[a,b,c])masses[i]+=area*.22/3;}
 return{...d,positions:Float64Array.from(xyz),sourceUV:Float64Array.from(uv),uvs:Float64Array.from(uv),triangles:Uint32Array.from(tri),masses,mass:masses,ranges,seams,waistIndices:waist,elasticEdges:d.elasticEdges.map(e=>({...e,a:oldMap.get(e.a),b:oldMap.get(e.b)})),casing:{...d.casing,stitchPaths:(d.casing.stitchPaths||[]).map(p=>({...p,indices:p.indices.map(i=>oldMap.get(i))}))}};
}

function selfCrossings(c){
 const proxy={triangles:c.triangles.map((t,id)=>({id,indices:t.q,part:'cloth'})),positions:Float64Array.from(c.positions.flat()),snapshot:()=>({revision:0,time:0,contactExcludedParts:[]})};
 const all=inspectShortsTriangleCrossings(c,proxy,{queryAPI:{positions:new Float64Array(),indices:new Uint32Array()}});
 return all.exactcrossings.filter(x=>x.clothTriangle<x.bodyTriangle&&!x.clothDOFs.some(id=>x.bodyIndices.includes(id))).length;
}

export function legLoops(c,h,yLocal){
 const segments=[],pointLocal=p=>new THREE.Vector3(...p).applyMatrix4(h.skinTapes.inverseFrame).toArray(),key=p=>p.map(v=>Math.round(v/1e-6)).join(':');
 for(const t of c.triangles){const p=t.q.map(id=>pointLocal(c.positions[id])),hits=[];for(let i=0;i<3;i++){const a=p[i],b=p[(i+1)%3],da=a[1]-yLocal,db=b[1]-yLocal;if(da*db<0){const f=da/(da-db);hits.push(a.map((v,k)=>v+f*(b[k]-v)));}}if(hits.length===2)segments.push(hits);}
 const graph=new Map(),points=new Map();for(const [a,b]of segments){const ka=key(a),kb=key(b);if(ka===kb)continue;for(const [i,j,p]of [[ka,kb,a],[kb,ka,b]]){if(!graph.has(i))graph.set(i,new Set());graph.get(i).add(j);points.set(i,p);}}
 const seen=new Set(),loops=[];for(const first of graph.keys()){if(seen.has(first))continue;const loop=[],stack=[first];while(stack.length){const id=stack.pop();if(seen.has(id))continue;seen.add(id);loop.push(points.get(id));for(const j of graph.get(id))if(!seen.has(j))stack.push(j);}loops.push(loop);}
 const closed=graph.size>0&&[...graph.values()].every(x=>x.size===2);
 const axes=['left','right'].map(side=>{const s=h.skinTapes.guideSectionAtY(yLocal,{side});return{side,x:s.centerX,z:s.centerZ};});
 function contains(poly,axis){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[2]>axis.z)!==(b[2]>axis.z)&&axis.x<(b[0]-a[0])*(axis.z-a[2])/(b[2]-a[2])+a[0])inside=!inside;}return inside;}
 return{yLocal,loops:loops.length,closed,containsLegAxes:axes.map(a=>({side:a.side,loopsContaining:loops.filter(p=>contains(p,a)).length})),passed:closed&&loops.length===2&&axes.every(a=>loops.filter(p=>contains(p,a)).length===1)&&loops.every(p=>axes.filter(a=>contains(p,a)).length===1)};
}

export async function installFastDrapeTrial(){
 const h=window.HumanShorts,g=window.HumanR008;if(!h?.measurementDraft)throw Error('Measured current paper required');
 const start=performance.now(),deadline=start+240000,results=[],candidates=[];h.fitPreview?.dispose();h.barePelvis.mesh.visible=true;
 const panel=document.getElementById('paper-research');panel.innerHTML='<strong>基础短裤 · 快速方法比较</strong><p id="fast-state">定位与缝合</p><nav id="fast-methods"></nav><nav id="fast-views"></nav><p>静态实验，布料参数未标定，动作未验收</p>';
 const state=document.getElementById('fast-state');for(const [v,label]of [['front','正面'],['back','背面'],['side','侧面'],['below','裆部']]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>h.setView(v);document.getElementById('fast-views').append(b);}
 function select(i){candidates.forEach((c,j)=>{c.mesh.visible=j===i;for(const s of c.stitches)s.line.visible=j===i;});h.selectedFastCandidate=i;h.fastCloth=candidates[i];const r=results[i];state.textContent=`${r.name} · 应变 ${(100*r.strain).toFixed(1)}% · 人体交叉 ${r.bodyCrossings} · 自交 ${r.selfCrossings} · ${r.passed?'静态检查通过':'失败候选'}`;h.setView('front');h.requestRender();}
 const initialBodyRevision=h.measuredBody.snapshot().revision;
 for(let method=0;method<3&&performance.now()<deadline;method++){
  const basic=method>0?basicFourPanel(h.measurementDraft):null,d=method===0?h.measurementDraft:method===1?basic:refinePaper(basic),name=method===0?'保留裆片，按人物定位':method===1?'四片式基础短裤':'细分纸样与面内应变';
  // The initial dressed chart is only a position seed. UV/rest lengths remain
  // the ORIGINAL two-dimensional cut paper; no posed lengths become material.
  const identity=JSON.stringify({uv:d.sourceUV,tri:d.triangles,mass:d.masses,seams:d.seams});
  const collisionBody={collide(point,margin=.004){const hit=h.body.closestSurfacePoint(point);if(hit.signAmbiguous&&!hit.bareClosedInsideObserved)return null;if(hit.signedDistance>=margin)return null;return{...hit,point:hit.point.clone().addScaledVector(hit.normal,margin),penetration:margin-hit.signedDistance};},snapshot(){return null;}};
  const c=new ShortsClothRuntime(d,collisionBody,h.game.actor,g.scene,{elasticEnabled:false,bendTopology:'within-piece-flat',...(method===2?{membraneModel:'orthotropic-paper',paperMaterial:{warpNPerM:2000,weftNPerM:1200,shearNPerM:300}}:{})});c.enabled=false;candidates.push(c);if(method>0)for(const older of candidates.slice(0,-1))older.mesh.visible=false;
  const targets=new Map(c.waist.map(id=>[id,c.positions[id].slice()])),trace=[],roundLimit=80,trialEnd=Math.min(deadline,performance.now()+90000);let prior=c.positions.map(p=>p.slice()),maxMove=Infinity;
  state.textContent=name+'：缝合、弯曲、身体接触';await yieldUI();
  for(let round=0;round<roundLimit&&performance.now()<trialEnd;round++){
   for(const e of [...c.edges,...c.bends])e.lambda=0;
   // Temporary waist holding decays during assembly; no full-surface pinning.
   const hold=round<20?.35:round<40?.12:0;
   if(hold)for(const[id,t]of targets)for(let k=0;k<3;k++)c.positions[id][k]+=(t[k]-c.positions[id][k])*hold;
   for(let sweep=0;sweep<12;sweep++){
    if(method===2)c.solveMainMaterial(1/60);else for(const e of c.edges)c.solveDistance(e,1/60);
    for(const e of c.bends)scSolveBending(e,c.bendParticles,1/60,2000);
   }
   c.contacts();c.selfContacts();
   maxMove=Math.max(...c.positions.map((p,i)=>dist(p,prior[i])));prior=c.positions.map(p=>p.slice());
   if(round%10===0||round===roundLimit-1){const a=c.audit(false);trace.push({round,strain:a.mainStrain,maxMoveM:maxMove,elapsedMs:performance.now()-start});state.textContent=`${name} · 第${round+1}轮 · 应变 ${(100*a.mainStrain).toFixed(1)}%`;c.syncRender();h.setView('front');await yieldUI();if(!a.finite)break;}
  }
  c.syncRender();const a=c.audit(false),cross=inspectShortsTriangleCrossings(c,h.measuredBody,h.barePelvis),self=selfCrossings(c),section=legLoops(c,h,(d.receipt.hem.y+h.skinTapes.crotchY)/2),restPreserved=identity===JSON.stringify({uv:d.sourceUV,tri:d.triangles,mass:d.masses,seams:d.seams});
  const worldUp=new THREE.Vector3(0,1,0).transformDirection(h.skinTapes.frame),waistErrors=c.waist.map(id=>Math.abs(new THREE.Vector3(...c.positions[id]).applyMatrix4(h.skinTapes.inverseFrame).y-d.receipt.upperY));
  const r={method,name,strain:a.mainStrain,worst:a.worstMaterialTriangle,seams:c.activeSeams.length,seamGapM:0,bodyCrossings:cross.crossingCount,selfCrossings:self,legSection:section,maximumWaistHeightErrorM:Math.max(...waistErrors),sourceRestPreserved:restPreserved,finite:a.finite,maxMoveM:maxMove,stable:maxMove<.0005,trace,passed:a.finite&&a.mainStrain<.05&&cross.crossingCount===0&&self===0&&section.passed&&Math.max(...waistErrors)<.01&&maxMove<.0005,elapsedMs:performance.now()-start,elasticTested:false,motionValidated:false,productionReady:false};results.push(r);
  const b=document.createElement('button');b.textContent=name;b.onclick=()=>select(method);document.getElementById('fast-methods').append(b);select(method);await yieldUI();
  if(r.passed)break;
 }
 if(initialBodyRevision!==h.measuredBody.snapshot().revision)throw Error('Native body moved during static comparison');
 const best=results.reduce((i,r,j)=>r.bodyCrossings<results[i].bodyCrossings?j:i,0);select(best);
 h.fastReport={createdAt:new Date().toISOString(),bodyToken:h.skinTapes.bodyToken,nativeFaces:g.subject.mesh.geometry.index.count/3,methods:results,selected:best,anyPassed:results.some(r=>r.passed),elapsedMs:performance.now()-start,originalPreserved:true,bodyUnchanged:true,motionValidated:false,productionReady:false};h.fitStatus='FAST_DRAPE_FINISHED';return h.fastReport;
}
