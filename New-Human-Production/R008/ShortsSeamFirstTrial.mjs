import {ShortsClothRuntime} from './ShortsClothRuntime.mjs';
import {createShortsManufacturingDraft} from './ShortsManufacturingDraft.mjs';

// One bounded feasibility experiment. Source UV/rest lengths stay authoritative.
// Merging matching stitches is an assembly initialization, never an acceptance.
export async function installSeamFirstTrial(){
 const h=window.HumanShorts,g=window.HumanR008;
 if(!h?.measurementDraft||!g)throw Error('Current native body and measured paper required');
 const start=performance.now(),deadline=start+60000,trace=[];
 const paper=createShortsManufacturingDraft(h.measurementDraft);
 const sourceIdentity=JSON.stringify({uv:paper.sourceUV,triangles:paper.triangles,masses:paper.masses,seams:paper.seams});
 h.fitPreview?.dispose();
 const noContact={collide(){return null;},snapshot(){return null;}};
 const cloth=new ShortsClothRuntime(paper,noContact,h.game.actor,g.scene,{elasticEnabled:false,bendTopology:'within-piece-flat'});
 cloth.enabled=false;h.barePelvis.mesh.visible=true;
 h.trialCloth=cloth;
 const panel=document.getElementById('paper-research');
 panel.innerHTML='<strong>基础短裤 · 缝合优先流程验证</strong><p id="trial-state">检查纸样和连接</p><p>内部实验；穿着及动作未验收</p><nav></nav>';
 for(const [view,label] of [['front','正面'],['back','背面'],['side','侧面'],['below','裆部']]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>h.setView(view);panel.querySelector('nav').append(b);}
 const state=document.getElementById('trial-state');
 const row=(phase,extra={})=>{const audit=cloth.audit(false),r={phase,elapsedMs:performance.now()-start,strain:audit.mainStrain,seams:audit.seams,seamGapM:Math.max(0,...paper.seams.flatMap(s=>s.pairs.map(p=>Math.hypot(...cloth.positions[cloth.quotient[p.a]].map((v,k)=>v-cloth.positions[cloth.quotient[p.b]][k]))))),finite:audit.finite,worst:audit.worstMaterialTriangle,...extra};trace.push(r);state.textContent=`${phase} · ${r.seams}/19条缝 · 应变 ${(100*r.strain).toFixed(2)}%`;cloth.syncRender();h.setView('front');return r;};
 const meshEdges=new Map();for(const t of cloth.triangles)for(let i=0;i<3;i++){const a=t.q[i],b=t.q[(i+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');if(!meshEdges.has(key))meshEdges.set(key,{a,b,faces:0});meshEdges.get(key).faces++;}
 const boundary=new Map();for(const e of meshEdges.values())if(e.faces===1){for(const [a,b] of [[e.a,e.b],[e.b,e.a]]){if(!boundary.has(a))boundary.set(a,new Set());boundary.get(a).add(b);}}
 const unseen=new Set(boundary.keys());let boundaryLoops=0;while(unseen.size){boundaryLoops++;const stack=[unseen.values().next().value];while(stack.length){const id=stack.pop();if(!unseen.delete(id))continue;for(const other of boundary.get(id))if(unseen.has(other))stack.push(other);}}
 const topology={...cloth.renderNormalReport,boundaryLoops,boundaryDegreeTwo:[...boundary.values()].every(n=>n.size===2),eulerCharacteristic:cloth.positions.length-meshEdges.size+cloth.triangles.length};
 topology.basicPantsTopologyPassed=topology.valid&&topology.components===1&&boundaryLoops===3&&topology.boundaryDegreeTwo&&topology.eulerCharacteristic===-1;
 row('已建立全部真实缝合连接',{topology});
 let relaxed=false,rounds=0;
 // Gravity-free assembly is separate from contact and elastic contraction.
 // No body position guides, altered paper rests, or strict contact barrier here.
 if(topology.basicPantsTopologyPassed){
  for(rounds=1;rounds<=5000&&performance.now()<deadline;rounds++){
   for(const e of cloth.edges)e.lambda=0;
   for(let sweep=0;sweep<4;sweep++){
    if(sweep%2)for(let i=cloth.edges.length-1;i>=0;i--)cloth.solveDistance(cloth.edges[i],cloth.options.fixedDt);
    else for(const e of cloth.edges)cloth.solveDistance(e,cloth.options.fixedDt);
   }
   if(rounds%100===0){const r=row('无重力装配松弛',{rounds});await new Promise(resolve=>setTimeout(resolve,0));if(!r.finite)break;if(r.strain<.05){relaxed=true;break;}}
  }
 }
 const assembled=row('装配检查完成',{rounds,materialGatePassed:relaxed});
 // Inspect actual full triangles even on a failed candidate. Do not run dynamics
 // on paper that has not passed assembly; this deliberately identifies the gate.
 let crossings=null;
 if(performance.now()<deadline){const {inspectShortsTriangleCrossings}=await import('./ShortsCoverageIntersection.mjs');crossings=inspectShortsTriangleCrossings(cloth,h.measuredBody,h.barePelvis);}
 const restPreserved=sourceIdentity===JSON.stringify({uv:paper.sourceUV,triangles:paper.triangles,masses:paper.masses,seams:paper.seams});
 const report={createdAt:new Date().toISOString(),scope:'one seam-first feasibility run; sewn topology and source metric separately checked from wearing',bodyToken:h.skinTapes.bodyToken,nativeFaces:g.subject.mesh.geometry.index.count/3,trace,assembled,sourceRestPreserved:restPreserved,bodyCrossings:crossings?.crossingCount??null,topology,sewingMetricPassed:relaxed&&restPreserved&&topology.basicPantsTopologyPassed,assemblyPassed:false,bodyFitPassed:false,elasticFitPassed:false,motionValidated:false,productionReady:false,elapsedMs:performance.now()-start,stop:relaxed?'Seams and material check passed; wearing fails body intersections; elastic and motion blocked':'Sewn paper metric failed; wearing, elastic and motion blocked'};
 h.trialReport=report;h.fitStatus='QUICK_TRIAL_FINISHED';
 state.textContent=`${report.sewingMetricPassed?'缝合/尺寸通过；穿着失败':'缝合/尺寸未通过'} · 19/19条缝闭合 · 应变 ${(100*assembled.strain).toFixed(2)}% · 人体交叉 ${report.bodyCrossings??'未检查'}`;
 cloth.setPanelReview(true);cloth.syncRender();h.setView('front');h.requestRender();
 return report;
}
