import * as THREE from 'three';
import {createShortsGussetFoldSeed} from './ShortsGussetFoldSeed.mjs';
import {assembleShortsPaperSeed,closeConvergedPaperSeams} from './ShortsPaperAssembly.mjs';
import {refineShortsSurfaceDraft} from './ShortsSurfaceRefinement.mjs';
import {formShortsPaperSurface} from './ShortsPaperForming.mjs';
import {alignShortsPaperRigid} from './ShortsPaperRigidPlacement.mjs';
import {compilePaperSurfaceModel,evaluatePaperSurface} from './ShortsPaperSurfaceModel.mjs';
const yieldUI=()=>new Promise(r=>setTimeout(r,0));
const scatter=(draft,positions,map)=>{const raw=new Float64Array(map.length*3);for(let i=0;i<map.length;i++)raw.set(positions[map[i]],3*i);return{...draft,positions:raw,quotientMap:Uint32Array.from(map)};};
function refineLocal(draft){const ranges=new Map(draft.ranges.map(r=>[r.pieceId,r]));return refineShortsSurfaceDraft(draft,{actor:{matrixWorld:new THREE.Matrix4()},surfaceEvaluator(id,{sourceIndices,weights}){const r=ranges.get(id);return [0,1,2].map(k=>sourceIndices.reduce((s,i,j)=>s+weights[j]*draft.positions[(r.offset+i)*3+k],0));}},1);}
// A bounded, source-only paper construction followed by explicitly finite
// authoring guides. This returns HOLD for wearing regardless of source metric.
export async function constructShortsPaper(draft,tapes,{onProgress=()=>{},queryContact=null}={}){
 const started=performance.now(),trace=[],deadline=started+180000;
 const record=(phase,detail)=>{trace.push({...detail,phase,elapsedMs:performance.now()-started});onProgress(trace.at(-1));};
 const check=()=>{if(performance.now()>deadline)throw Error('Paper research ceiling180 seconds; preserve incomplete state');};
 const seed=createShortsGussetFoldSeed(draft,tapes);record('rigid-paper-hinges',{receipt:seed.seedReceipt});await yieldUI();check();
 const assembled=assembleShortsPaperSeed(seed,{onProgress:p=>record('soft-stitches',p)});await yieldUI();check();
 if(assembled.softGapM>1e-7)return{status:'HOLD_SOURCE_SEAM_GAP',draft:assembled.draft,trace,wearingAccepted:false};
 const map=Array.from(seed.quotientMap),q=Array(Math.max(...map)+1);map.forEach((id,i)=>q[id]=Array.from(assembled.draft.positions.slice(i*3,i*3+3)));
 const joined=closeConvergedPaperSeams(assembled.draft,map,q);record('exact-seams',joined.receipt);
 let fine=refineLocal(scatter(assembled.draft,joined.positions,joined.sourceToDof));
 const fineMap=Array.from(fine.quotientMap),count=Math.max(...fineMap)+1;let xyz=Array(count);fineMap.forEach((id,i)=>xyz[id]=Array.from(fine.positions.slice(i*3,i*3+3)));
 let paper=null;for(let phase=0;phase<2;phase++){check();paper=formShortsPaperSurface({draft:fine,positions:xyz,sourceToDof:fineMap});xyz=paper.positions;record('free-paper-metric',{phase,strain:paper.final.maximumPrincipalStrain,iterations:paper.iterations,stop:paper.stopReason});await yieldUI();if(paper.status==='SOURCE_METRIC_FORMED_ONLY')break;}
 fine=scatter(fine,xyz,fineMap);
 if(!paper.final.finite||paper.final.degenerateSurfaceTriangles!==0)return{status:'HOLD_DEGENERATE_SOURCE_METRIC',draft:fine,trace,paper,wearingAccepted:false};
 // These XYZ are finite measured placement targets only, NEVER source rest.
 const target=refineLocal(draft),ranges=new Map(fine.ranges.map(r=>[r.pieceId,r])),guideMap=new Map();
 // Only measured waist/hem loops supply targets. The previous interior/rise
 // loft caused audited edge jumps and is not a fitting authority.
 for(const piece of fine.pieces){const r=ranges.get(piece.id),chains=piece.kind==='waistband'?[piece.boundaries.upper,piece.boundaries.lower]:piece.kind==='leg-panel'?[piece.boundaries.hem]:[];for(const chain of chains)for(const i of chain){const s=r.offset+i,id=fineMap[s],t=Array.from(target.positions.slice(s*3,s*3+3));if(!guideMap.has(id))guideMap.set(id,t);else if(Math.hypot(...t.map((v,k)=>v-guideMap.get(id)[k]))>1e-7)throw Error('Measured common source guide targets disagree');}}
 const waist=[...new Set(Array.from(fine.waistIndices,i=>fineMap[i]))],hem=side=>[...new Set(fine.pieces.filter(p=>p.kind==='leg-panel'&&p.side===side).flatMap(p=>p.boundaries.hem.map(i=>fineMap[ranges.get(p.id).offset+i])))],center=(ids,read)=>{if(!ids.length)throw Error('Measured placement frame is empty');return[0,1,2].map(k=>ids.reduce((s,id)=>s+read(id)[k],0)/ids.length);},frame=read=>({waist:center(waist,read),leftHem:center(hem('left'),read),rightHem:center(hem('right'),read)});
 const model=compilePaperSurfaceModel(fine),beforeRigid=evaluatePaperSurface(model,xyz,fineMap),rigid=alignShortsPaperRigid({positions:xyz,sourceFrame:frame(id=>xyz[id]),targetFrame:frame(id=>guideMap.get(id))});xyz=rigid.positions;const afterRigid=evaluatePaperSurface(model,xyz,fineMap);if(Math.abs(afterRigid.maximumPrincipalStrain-beforeRigid.maximumPrincipalStrain)>1e-9)throw Error('Rigid placement unexpectedly changed original paper metric');const {positions:unused,...rigidReceipt}=rigid;record('proper-rigid-placement',{...rigidReceipt,beforePrincipalStrain:beforeRigid.maximumPrincipalStrain,afterPrincipalStrain:afterRigid.maximumPrincipalStrain,sourceMetricUnchanged:true});
 const samples=Array.from({length:count},(_,id)=>({indices:[id],weights:[1]}));for(let t=0;t<fine.triangles.length;t+=3)samples.push({indices:Array.from(fine.triangles.slice(t,t+3),i=>fineMap[i]),weights:[1/3,1/3,1/3]});
 let guided=null;for(const [weight,contactWeight] of [[.25,1],[1,16]]){check();guided=formShortsPaperSurface({draft:fine,positions:xyz,sourceToDof:fineMap,positionalGuides:[...guideMap].map(([id,target])=>({id,target,weight})),...(queryContact?{contact:{query:queryContact,samples,clearanceM:.004,weight:contactWeight}}:{})});xyz=guided.positions;record('measured-finite-guides',{weight,contactWeight:queryContact?contactWeight:null,strain:guided.final.maximumPrincipalStrain,guide:guided.positionalGuides,contact:guided.contact,iterations:guided.iterations,stop:guided.stopReason});await yieldUI();if(/ambiguous|invalid|Rank-deficient|linear algebra unresolved/.test(guided.stopReason??''))break;}
 fine=scatter(fine,xyz,fineMap);return{status:'HOLD_REAL_BODY_CONTACT',draft:fine,trace,paper,guided,guideAuthority:'current measured source-matched boundary targets; finite authoring energy only, not a body collision law',elapsedMs:performance.now()-started,nativeSteps:0,wearingAccepted:false};
}
