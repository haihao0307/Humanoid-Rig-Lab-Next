import * as THREE from 'three';
import {createBasicShortsPaper,placeBasicShortsPaper} from './ShortsBasicBlock.mjs';
import {developShortsStrips,flatShortsStrips} from './ShortsDevelopablePanels.mjs';
import {ShortsClothRuntime} from './ShortsClothRuntime.mjs';
import {inspectShortsTriangleCrossings} from './ShortsCoverageIntersection.mjs';
import {legLoops} from './ShortsFastDrapeTrial.mjs';

export async function installNativeDevelopedTrial(){
 const h=window.HumanShorts,g=window.HumanR008,old=h.measurementDraft.receipt,m=structuredClone(old.measurements),midX=m.waistCenter[0],waistY=old.upperY,delta=waistY-m.metadata.waistY;m.waistToHip+=delta;m.crotchDepth+=delta;m.frontRiseLength+=delta;m.backRiseLength+=delta;
 // Use the CURRENT contact-surface crotch and hip, not the earlier clothing
 // envelope's different centre-rise plane. Mixing these moved the bridge
 // into the body and made contact projection fold neighbouring rise rows.
 m.waistToHip=waistY-h.skinTapes.hip.y;m.crotchDepth=waistY-h.skinTapes.crotchY;m.frontRiseLength=h.skinTapes.rise.frontM+delta;m.backRiseLength=h.skinTapes.rise.backM+delta;
 const body={collide(point,margin=.004){const hit=h.body.closestSurfacePoint(point);if(hit.signAmbiguous&&!hit.bareClosedInsideObserved||hit.signedDistance>=margin)return null;return{point:hit.point.clone().addScaledVector(hit.normal,margin),normal:hit.normal,penetration:margin-hit.signedDistance};},snapshot(){return null;}};
 // Initial placement interpolates CURRENT successfully measured sections.
 // It never guesses a newly sliced ring across an ambiguous source interface.
 const section=(y,side)=>{const key=side==='left'?'negativeX':'positiveX',a=side==='hip'?h.skinTapes.hip:h.skinTapes.legs.upperThigh[key],b=side==='hip'?h.skinTapes.waist.upper:h.skinTapes.legs.hem[key],t=Math.max(0,Math.min(1,(y-a.y)/(b.y-a.y))),mix=(x,z)=>x+(z-x)*t,bounds={min:a.bounds.min.map((v,k)=>mix(v,b.bounds.min[k])),max:a.bounds.max.map((v,k)=>mix(v,b.bounds.max[k]))};return{radiusX:(bounds.max[0]-bounds.min[0])/2,radiusZ:(bounds.max[2]-bounds.min[2])/2,centerX:mix(a.centerX,b.centerX)-midX,centerZ:mix(a.centerZ,b.centerZ)};};
 const panel=document.getElementById('paper-research');panel.innerHTML='<strong>人物上的新制版方法 · 几何试验</strong><p id="native-state">测量当前人物与生成布片</p><p>衣内身体使用当前估计代理；松紧腰口、减少接缝与动作尚未验收。</p><nav id="native-views"></nav>';for(const [v,label]of[['front','正面'],['back','背面'],['side','侧面'],['below','裆部']]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>h.setView(v);document.getElementById('native-views').append(b);}
 const state=document.getElementById('native-state'),results=[],cloths=[],start=performance.now();h.fitPreview?.dispose();h.barePelvis.mesh.visible=true;
 for(const [clearance,fairing] of [[.008,true],[.008,false],[.018,true],[.028,true]]){
  const waistEase=m.hipFrontArc+m.hipBackArc-m.waistFrontArc-m.waistBackArc+.04,pattern=createBasicShortsPaper(m,{hipEase:.04,waistEase:Math.max(.025,waistEase),sideIntake:0,frontRiseEase:0,backRiseEase:0,inseamLength:old.design.inseamLength}),design=placeBasicShortsPaper(pattern,section,{waistY,crotchY:h.skinTapes.crotchY,clearance,framePoint:p=>[p[0]+midX,p[1],p[2]]}),reference=new ShortsClothRuntime(design,body,h.game.actor,g.scene,{elasticEnabled:false});reference.enabled=false;
  // Source design clearance processing precedes cutting; it is NOT permitted
  // to modify the flat source metric after a garment simulation has begun.
  const roles=reference.members.map(ids=>ids.map(i=>{const range=design.ranges.find(r=>i>=r.offset&&i<r.offset+r.count),index=i-range.offset;return{piece:range.pieceId,col:index%(pattern.options.columns+1),row:Math.floor(index/(pattern.options.columns+1))};})),directions=roles.map(rows=>{const front=rows.some(r=>r.piece[0]==='F'),back=rows.some(r=>r.piece[0]==='B'),left=rows.some(r=>r.piece[1]==='L'),right=rows.some(r=>r.piece[1]==='R');if(front!==back)return[0,0,front?1:-1];if(left!==right){const inner=rows.every(r=>r.col===0);return[(left?-1:1)*(inner?-1:1),0,0];}return[0,-1,0];}),worldDirections=directions.map(d=>new THREE.Vector3(...d).transformDirection(h.skinTapes.frame).toArray());
  const exteriorSample=(ids,weights)=>{const p=[0,1,2].map(k=>ids.reduce((s,id,i)=>s+reference.positions[id][k]*weights[i],0)),hit=body.collide(new THREE.Vector3(...p),clearance);if(!hit)return;const amount=Math.max(.001,Math.min(.025,hit.penetration*1.5)),eligible=ids.map((id,i)=>({id,w:weights[i],dir:worldDirections[id]})).filter(x=>x.w>0);for(const q of eligible)for(let k=0;k<3;k++)reference.positions[q.id][k]+=q.dir[k]*amount*q.w;};
  for(let round=0;round<30;round++){for(let id=0;id<reference.positions.length;id++)exteriorSample([id],[1]);for(const t of reference.triangles)for(const weights of[[1/3,1/3,1/3],[.5,.5,0],[.5,0,.5],[0,.5,.5]])exteriorSample(t.q,weights);if(round%10===0){state.textContent=`按布片坐标图处理身体间距 ${Math.round(clearance*1000)}毫米`;await new Promise(r=>setTimeout(r,0));}}
  // Fair the DESIGN before inverse cutting. Body clearance is reapplied after
  // every bounded Laplacian pass; existing cut-paper rest metrics are untouched.
  // Principle: Taubin, A Signal Processing Approach to Fair Surface Design.
  // https://graphics.stanford.edu/courses/cs468-01-fall/Papers/taubin-fair-surface.pdf
  const anchors=reference.positions.map(p=>[...p]),held=new Set(roles.flatMap((r,i)=>r.some(q=>q.row===0||q.row===pattern.options.rows)?[i]:[]));
  const roughness=()=>Math.max(...reference.positions.map((p,i)=>{if(held.has(i))return 0;const ns=[...reference.neighbours[i]].filter(j=>j!==i),avg=[0,1,2].map(k=>ns.reduce((s,j)=>s+reference.positions[j][k],0)/ns.length);return Math.hypot(...p.map((v,k)=>v-avg[k]));}));
  const curvatureBeforeM=roughness();
  if(fairing)for(let round=0;round<24;round++){
   const oldPositions=reference.positions.map(p=>[...p]);for(let i=0;i<reference.positions.length;i++){if(held.has(i))continue;const ns=[...reference.neighbours[i]].filter(j=>j!==i),avg=[0,1,2].map(k=>ns.reduce((s,j)=>s+oldPositions[j][k],0)/ns.length),next=oldPositions[i].map((v,k)=>v+.28*(avg[k]-v)),d=next.map((v,k)=>v-anchors[i][k]),length=Math.hypot(...d),scale=Math.min(1,.025/length);for(let k=0;k<3;k++)reference.positions[i][k]=anchors[i][k]+d[k]*scale;}
   for(let sweep=0;sweep<2;sweep++){for(let id=0;id<reference.positions.length;id++)exteriorSample([id],[1]);for(const t of reference.triangles)for(const weights of[[1/3,1/3,1/3],[.5,.5,0],[.5,0,.5],[0,.5,.5]])exteriorSample(t.q,weights);}
   if(round%8===0){state.textContent='制版前修顺曲面，并重新检查身体间距';await new Promise(r=>setTimeout(r,0));}
  }
  // Conservative side silhouette: smooth the sampled OUTER seam profile
  // outward, so a collider step is bridged rather than copied into the cloth.
  // A convex-in-radius material-coordinate blend spreads the extra ease
  // toward the side seam without changing the centre rise or inside seam.
  let maximumSilhouetteExpansionM=0;
  if(fairing){
   const local=reference.positions.map(p=>new THREE.Vector3(...p).applyMatrix4(h.skinTapes.inverseFrame).toArray()),profiles={};
   for(const side of ['L','R']){const ids=Array.from({length:pattern.options.rows+1},(_,row)=>roles.findIndex(rs=>rs.some(q=>q.piece[1]===side&&q.row===row&&q.col===pattern.options.columns))),radii=ids.map(i=>Math.abs(local[i][0]-midX)),initial=[...radii];
    for(let pass=0;pass<48;pass++){const old=[...radii];for(let row=1;row<pattern.options.rows;row++){const ya=local[ids[row-1]][1],yb=local[ids[row+1]][1],y=local[ids[row]][1],fraction=Math.max(0,Math.min(1,(y-ya)/(yb-ya))),chord=old[row-1]+(old[row+1]-old[row-1])*fraction;radii[row]=Math.max(old[row],old[row]+.65*(chord-old[row]));}}
    profiles[side]=radii.map((r,row)=>r-initial[row]);maximumSilhouetteExpansionM=Math.max(maximumSilhouetteExpansionM,...profiles[side]);
   }
   for(let id=0;id<roles.length;id++){const rs=roles[id],left=rs.some(r=>r.piece[1]==='L'),right=rs.some(r=>r.piece[1]==='R');if(left===right)continue;const r=rs[0],side=left?'L':'R';local[id][0]+=(left?-1:1)*profiles[side][r.row]*(r.col/pattern.options.columns)**2;reference.positions[id]=new THREE.Vector3(...local[id]).applyMatrix4(h.skinTapes.frame).toArray();}
   for(let pass=0;pass<4;pass++){for(let id=0;id<reference.positions.length;id++)exteriorSample([id],[1]);for(const t of reference.triangles)exteriorSample(t.q,[1/3,1/3,1/3]);}
  }
  const curvatureAfterM=roughness();
  for(let i=0;i<reference.quotient.length;i++)design.positions.set(new THREE.Vector3(...reference.positions[reference.quotient[i]]).applyMatrix4(h.skinTapes.inverseFrame).toArray(),i*3);reference.dispose();
  const draft=developShortsStrips(design),c=new ShortsClothRuntime(draft,body,h.game.actor,g.scene,{elasticEnabled:false,bendTopology:'within-piece-flat'});c.enabled=false;cloths.push(c);for(const old of cloths.slice(0,-1))old.mesh.visible=false;draft.receipt.designFairing={enabled:fairing,curvatureBeforeM,curvatureAfterM,maximumSilhouetteExpansionM,authority:'design processing before cutting; no physical draping claim'};
  const flat=flatShortsStrips(draft),flatProxy={positions:Float64Array.from(flat.positions.flat()),triangles:flat.triangles.map((t,id)=>({id,indices:t.q,part:'paper'})),snapshot:()=>({revision:0,time:0,contactExcludedParts:[]})},flatCross=inspectShortsTriangleCrossings(flat,flatProxy,{queryAPI:{positions:new Float64Array(),indices:new Uint32Array()}}).exactcrossings.filter(x=>x.clothTriangle<x.bodyTriangle&&!x.clothDOFs.some(id=>x.bodyIndices.includes(id))),flatPaperSelfOverlaps=flatCross.filter(x=>draft.ranges.find(r=>x.clothDOFs[0]>=r.offset&&x.clothDOFs[0]<r.offset+r.count)===draft.ranges.find(r=>x.bodyIndices[0]>=r.offset&&x.bodyIndices[0]<r.offset+r.count)).length;
  const audit=c.audit(false),cross=inspectShortsTriangleCrossings(c,h.measuredBody,h.barePelvis),proxy={triangles:c.triangles.map((t,id)=>({id,indices:t.q,part:'cloth'})),positions:Float64Array.from(c.positions.flat()),snapshot:()=>({revision:0,time:0,contactExcludedParts:[]})},self=inspectShortsTriangleCrossings(c,proxy,{queryAPI:{positions:new Float64Array(),indices:new Uint32Array()}}).exactcrossings.filter(x=>x.clothTriangle<x.bodyTriangle&&!x.clothDOFs.some(id=>x.bodyIndices.includes(id))),sectionResult=legLoops(c,h,(draft.receipt.hem.y+h.skinTapes.crotchY)/2),r={clearanceM:clearance,designFairing:draft.receipt.designFairing,flatPaperSelfOverlaps,maximumIndependentFoldReconstructionErrorM:draft.receipt.maximumIndependentFoldReconstructionErrorM,strain:audit.mainStrain,bodyCrossings:cross.crossingCount,selfCrossings:self.length,selfCrossingSamples:self.slice(0,8),legSection:sectionResult,panels:draft.pieces.length,seams:draft.seams.length,maximumSeamFeedMismatchM:draft.receipt.maximumSeamFeedMismatchM,passed:cross.crossingCount===0&&self.length===0&&sectionResult.passed&&audit.mainStrain<.05&&flatPaperSelfOverlaps===0&&draft.receipt.flatToCurvedKinematicConstructionValidated,geometryOnly:true,flatToDressedSewingValidated:false,elasticWearingValidated:false,motionValidated:false,productionReady:false,elapsedMs:performance.now()-start};results.push(r);state.textContent=`新曲面制版 · 应变 ${(100*r.strain).toFixed(2)}% · 身体交叉 ${r.bodyCrossings} · 自交 ${self.length} · ${r.passed?'几何检查通过':'失败候选'}`;h.setView('front');c.syncRender();await new Promise(r=>setTimeout(r,0));if(r.passed)break;
 }
 h.nativeDevelopedReport={bodyToken:h.skinTapes.bodyToken,results,anyPassed:results.some(r=>r.passed),bodyUnchanged:true,coveredBareSkinIsEstimated:true,elapsedMs:performance.now()-start,productionReady:false};h.nativeDevelopedCloths=cloths;h.fitStatus='NATIVE_DEVELOPED_FINISHED';return h.nativeDevelopedReport;
}
