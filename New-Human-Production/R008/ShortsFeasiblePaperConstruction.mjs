import {createShortsDevelopablePaperSeed} from './ShortsDevelopablePaperSeed.mjs';
import {formShortsPaperSurface} from './ShortsPaperForming.mjs';
import {closeConvergedPaperSeams} from './ShortsPaperAssembly.mjs';
import {compilePaperSurfaceModel,evaluatePaperSurface} from './ShortsPaperSurfaceModel.mjs';
const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
// Bounded research: start with independent isometric paper outside current body.
// Never turn still-separated source seam endpoints into averaged hard seams.
export async function constructFeasibleShortsPaper(draft,tapes,measuredBody,bare,{queryContact,onProgress=()=>{}}={}){
 if(typeof queryContact!=='function')throw Error('Actual current body query required');
 const start=performance.now(),deadline=start+150000,trace=[],seed=createShortsDevelopablePaperSeed(draft,tapes,measuredBody,bare,{queryContact}),map=seed.sourceToDof,model=compilePaperSurfaceModel(draft),ranges=new Map(draft.ranges.map(r=>[r.pieceId,r])),sourceIdentity=JSON.stringify({uv:draft.sourceUV,triangles:draft.triangles,mass:draft.masses,seams:draft.seams});
 const record=(phase,detail)=>{const row={phase,...detail,elapsedMs:performance.now()-start};trace.push(row);onProgress(row);};
 record('independent-developable-paper',{receipt:seed.receipt});await yieldUI();
 const pairs=new Map();for(const seam of draft.seams)for(const pair of seam.pairs){const a=map[pair.a],b=map[pair.b],key=[Math.min(a,b),Math.max(a,b)].join(':');if(a!==b&&!pairs.has(key))pairs.set(key,{a,b});}
 const guides=new Map();for(const piece of draft.pieces){const range=ranges.get(piece.id),chains=piece.kind==='waistband'?[piece.boundaries.upper,piece.boundaries.lower]:piece.kind==='leg-panel'?[piece.boundaries.hem]:[];for(const chain of chains)for(const i of chain){const id=range.offset+i;guides.set(id,Array.from(draft.positions.slice(3*id,3*id+3)));}}
 const samples=map.map(id=>({indices:[id],weights:[1]}));for(let i=0;i<draft.triangles.length;i+=3)samples.push({indices:Array.from(draft.triangles.slice(i,i+3)),weights:[1/3,1/3,1/3]});
 let xyz=seed.positions,last=null;
 if(!seed.receipt.sampledStrictClearancePassed)return{status:'HOLD_INITIAL_DEVELOPABLE_CONTACT',draft:seed.draft,activeSeamIDs:[],trace,sourceMetric:evaluatePaperSurface(model,xyz,map),gapM:Math.max(0,...[...pairs.values()].map(pair=>distance(xyz[pair.a],xyz[pair.b]))),elapsedMs:performance.now()-start,nativeSteps:0,sourceRestUnchanged:true,fullTriangleContactValidated:false,selfContactValidated:false,motionValidated:false,wearingAccepted:false};
 // One declared four-stage sewing schedule, no geometry/angle parameter search.
 for(const weight of [.25,1,4,16]){
  if(performance.now()>=deadline){record('bounded-construction-stop',{reason:'150 second construction ceiling'});break;}
  last=formShortsPaperSurface({draft:seed.draft,positions:xyz,sourceToDof:map,activeSeamIds:[],seamSprings:[...pairs.values()].map(pair=>({...pair,weight})),positionalGuides:[...guides].map(([id,target])=>({id,target,weight:.25})),strainBarrier:{mu:1},bending:{stiffnessNm:.0005,membraneScaleNPerM:2000,seamLaw:'free-rotation'},contact:{query:queryContact,samples,distanceAuthority:'fixed-unsigned-surface-set',geometryRevision:queryContact(xyz[0]).geometryRevision,bareGeometryRevision:queryContact(xyz[0]).bareGeometryRevision,mode:'feasible-barrier',clearanceM:.004,activationDistanceM:.03,weight:1}},{maximumIterations:80});
  xyz=last.positions;record('feasible-soft-source-seams',{weight,strain:last.final.maximumPrincipalStrain,gapM:last.softSeams.maximumGapM,guide:last.positionalGuides,contact:last.contact,iterations:last.iterations,stop:last.stopReason,bending:last.finalEnergy.bending,failureDiagnostics:last.failureDiagnostics,linearTrace:last.trace.map(t=>({iteration:t.iteration,cgIterations:t.cgIterations,cgRelativeResidual:t.cgRelativeResidual,acceptedFraction:t.acceptedFraction,sourceDomainFraction:t.sourceDomainFraction,maximumAbsoluteBendingAngleRadians:t.maximumAbsoluteBendingAngleRadians}))});await yieldUI();
  if(last.finalEnergy.status!=='ENERGY_VALID'||/ambiguous|invalid|Rank-deficient|linear algebra unresolved/.test(last.stopReason??''))break;
 }
 const raw=new Float64Array(map.length*3);map.forEach((id,i)=>raw.set(xyz[id],3*i));let resultDraft={...seed.draft,positions:raw},activeSeamIDs=[];
 const sourceMetric=evaluatePaperSurface(model,xyz,map),gapM=Math.max(0,...[...pairs.values()].map(pair=>distance(xyz[pair.a],xyz[pair.b])));
 // Exact seam elimination is conditional on convergence and a fresh post-check.
 if(gapM<=1e-7&&sourceMetric.maximumPrincipalStrain<.05){const joined=closeConvergedPaperSeams(resultDraft,map,xyz),metric=evaluatePaperSurface(model,joined.positions,joined.sourceToDof);let valid=metric.maximumPrincipalStrain<.05;for(const sample of samples){const point=[0,1,2].map(k=>sample.indices.reduce((sum,id,j)=>sum+sample.weights[j]*joined.positions[joined.sourceToDof[id]][k],0)),hit=queryContact(point);if(hit.signAmbiguous||!(hit.signedDistanceM>.004)){valid=false;break;}if(performance.now()>=deadline){valid=false;break;}}if(valid){const closed=new Float64Array(raw.length);map.forEach((id,i)=>closed.set(joined.positions[joined.sourceToDof[i]],3*i));activeSeamIDs=draft.seams.map(seam=>seam.id);resultDraft={...resultDraft,positions:closed,activeSeamIDs,quotientMap:joined.sourceToDof};record('converged-hard-source-seams',{receipt:joined.receipt});}}
 if(sourceIdentity!==JSON.stringify({uv:draft.sourceUV,triangles:draft.triangles,mass:draft.masses,seams:draft.seams}))throw Error('Original paper authority changed');
 return{status:activeSeamIDs.length===19?'HOLD_FULL_SURFACE_CONTACT':'HOLD_UNSEWN_FEASIBLE_PAPER',draft:resultDraft,activeSeamIDs,trace,last,sourceMetric,gapM,elapsedMs:performance.now()-start,nativeSteps:0,sourceRestUnchanged:true,fullTriangleContactValidated:false,selfContactValidated:false,motionValidated:false,wearingAccepted:false};
}
