// Replay scalar measurements and unchanged source paper only. No character,
// body collision query, GPU, native clock or website build.
import {registerHooks} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {createShortsPattern}=await import('../ShortsGarmentDraft.mjs');
const {createShortsGussetFoldSeed}=await import('../ShortsGussetFoldSeed.mjs');
const {assembleShortsPaperSeed,closeConvergedPaperSeams}=await import('../ShortsPaperAssembly.mjs');
const {refineShortsSurfaceDraft}=await import('../ShortsSurfaceRefinement.mjs');
const {formShortsPaperSurface}=await import('../ShortsPaperForming.mjs');
const THREE=await import('three');
const base=new URL('../',import.meta.url),bytes=readFileSync(new URL('qa/shorts-v9-initial-1791024576835.json',base)),saved=JSON.parse(bytes),ref=saved.initialSourceReference,pattern=createShortsPattern(saved.draft.measurements,saved.draft.design);
const canonical=pattern.pieces.flatMap(p=>p.materialCoordinates.flat());if(canonical.length!==ref.sourceUV.length||canonical.some((x,i)=>x!==ref.sourceUV[i]))throw Error('Recorded scalar recipe does not reproduce original source paper');
const draft={sourceUV:Float64Array.from(ref.sourceUV),uvs:Float64Array.from(ref.sourceUV),triangles:Uint32Array.from(ref.triangles),positions:new Float64Array(ref.sourceUV.length/2*3),masses:Float64Array.from(ref.mass),mass:Float64Array.from(ref.mass),pieces:pattern.pieces,pattern,ranges:ref.ranges,seams:ref.seams,receipt:saved.draft},token=saved.draft.measurementsAuthority.bodyToken;
const witness=saved.draft.measurementsAuthority.sectionWitnesses.find(w=>Math.abs(w.y-saved.draft.lowerY)<1e-10&&w.rayWitnesses?.length===8);
const tapes={unit:'m',bodyToken:token,waist:{lower:{pointAtAngle(theta){const a=(theta%(2*Math.PI)+2*Math.PI)%(2*Math.PI),w=witness.rayWitnesses.find(w=>Math.abs(w.angleRadians-a)<1e-10);if(!w)throw Error('Recorded current-body waist ray missing');return w.point.slice();}}}};
const seed=createShortsGussetFoldSeed(draft,tapes,{tipAnchors:{left:saved.draft.initialG.corners[3].slice(),right:saved.draft.initialG.corners[1].slice(),bodyToken:token,authority:'frozen actual source tape initial tip rays; not newly measured body'}});
if(process.argv.includes('--refine-saved')||process.argv.includes('--close-saved')){
 const prior=JSON.parse(readFileSync(new URL('qa/shorts-paper-assembly-20261004.json',base)));
 for(const name of ['ShortsGussetFoldSeed.mjs','ShortsPaperForming.mjs'])if(prior.sourceHashes[name]!==createHash('sha256').update(readFileSync(new URL(name,base))).digest('hex'))throw Error('Saved assembly source drift: '+name);
 if(prior.diagnosticSourceXYZ.length!==seed.positions.length||prior.softGapM>1e-7)throw Error('Actual saved soft boundaries are not precise enough for subdivision');
 seed.positions=Float64Array.from(prior.diagnosticSourceXYZ);seed.densityKgM2=.22;
 const rangeMap=new Map(seed.ranges.map(r=>[r.pieceId,r])),bands=['WFL','WFR','WBR','WBL'],middle=bands.flatMap(id=>Array.from({length:7},(_,c)=>rangeMap.get(id).offset+8+c));
 const lengths=bands.flatMap(id=>{const p=seed.pieces.find(p=>p.id===id);return Array.from({length:7},(_,c)=>Math.hypot(...p.materialCoordinates[9+c].map((v,k)=>v-p.materialCoordinates[8+c][k])));}),total=lengths.reduce((s,x)=>s+x,0),elasticRest=saved.draft.measurementsAuthority.waist.middle.circumferenceM*.90;
 seed.elasticEdges=middle.map((a,i)=>{const restLengthM=elasticRest*lengths[i]/total;return{a,b:middle[(i+1)%middle.length],restLengthM,compliance:restLengthM/100,axialRigidityN:100,tensionOnly:true};});seed.casing={middleIndices:Uint32Array.from(middle)};
 const coarse={actor:{matrixWorld:new THREE.Matrix4()},surfaceEvaluator(id,{sourceIndices,weights}){const r=rangeMap.get(id);return [0,1,2].map(k=>sourceIndices.reduce((s,i,j)=>s+weights[j]*seed.positions[(r.offset+i)*3+k],0));}};
 const fine=refineShortsSurfaceDraft(seed,coarse,1),n=fine.sourceUV.length/2,parent=Array.from({length:n},(_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
 for(const seam of fine.seams)if(seed.activeSeamIDs.includes(seam.id))for(const p of seam.pairs)parent[find(p.b)]=find(p.a);
 const groups=new Map();for(let i=0;i<n;i++){const r=find(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}const partial=[...groups.values()],map=new Uint32Array(n),xyz=partial.map(g=>{let m=0,x=[0,0,0];for(const i of g){m+=fine.masses[i];for(let k=0;k<3;k++)x[k]+=fine.masses[i]*fine.positions[3*i+k];}return x.map(v=>v/m);});partial.forEach((g,q)=>g.forEach(i=>map[i]=q));
 const pairs=new Map();for(const s of fine.seams)if(!seed.activeSeamIDs.includes(s.id))for(const p of s.pairs){const a=map[p.a],b=map[p.b];if(a!==b)pairs.set([Math.min(a,b),Math.max(a,b)].join(':'),{a,b});}
 if(process.argv.includes('--close-saved')){
  const priorFine=JSON.parse(readFileSync(new URL('qa/shorts-paper-refined-assembly-20261004.json',base)));
  if(priorFine.sourceUV.some((v,i)=>v!==fine.sourceUV[i])||priorFine.triangles.some((v,i)=>v!==fine.triangles[i])||priorFine.sourceToDof.some((v,i)=>v!==map[i]))throw Error('Saved refined source or partial seam map differs');
  const closed=closeConvergedPaperSeams(fine,map,priorFine.positions),result=formShortsPaperSurface({draft:fine,positions:closed.positions,sourceToDof:closed.sourceToDof},{maximumIterations:80});
  const report={createdAt:new Date().toISOString(),scope:'eliminate only numerically converged soft source seams then relax original refined paper; no body or native clock',closure:closed.receipt,sourceUV:Array.from(fine.sourceUV),triangles:Array.from(fine.triangles),sourceMass:Array.from(fine.masses),seams:fine.seams,ranges:fine.ranges,sourceToDof:Array.from(closed.sourceToDof),refinement:fine.receipt.surfaceRefinement,...result,wearingAccepted:false};
  const path=new URL('qa/shorts-paper-closed-refined-20261004.json',base);writeFileSync(path,JSON.stringify(report,null,2));console.log(JSON.stringify({report:path.pathname,status:result.status,strain:result.final.maximumPrincipalStrain,iterations:result.iterations,elapsedMs:result.elapsedMs,closure:closed.receipt,wearingAccepted:false}));process.exit(0);
 }
 const result=formShortsPaperSurface({draft:fine,positions:xyz,sourceToDof:map,activeSeamIds:seed.activeSeamIDs,seamSprings:[...pairs.values()].map(p=>({...p,weight:prior.trace.at(-1).weight})),targetGapM:1e-4},{maximumIterations:80});
 const report={createdAt:new Date().toISOString(),scope:'one true source2D refinement of frozen coarse assembly; no native body/contact/dynamics',sourceHashes:prior.sourceHashes,coarseSourceMetric:prior.sourceMetric.maximumPrincipalStrain,refinement:fine.receipt.surfaceRefinement,...result,sourceUV:Array.from(fine.sourceUV),triangles:Array.from(fine.triangles),sourceMass:Array.from(fine.masses),seams:fine.seams,ranges:fine.ranges,sourceToDof:Array.from(map),nativeSteps:0,wearingAccepted:false};
 const path=new URL('qa/shorts-paper-refined-assembly-20261004.json',base);writeFileSync(path,JSON.stringify(report,null,2));console.log(JSON.stringify({report:path.pathname,status:result.status,strain:result.final.maximumPrincipalStrain,gap:result.finalEnergy.softSeams?.maximumGapM??result.softSeams?.maximumGapM,iterations:result.iterations,elapsedMs:result.elapsedMs,wearingAccepted:false}));process.exit(0);
}
const result=assembleShortsPaperSeed(seed,{wallBudgetMs:90000,onProgress:p=>console.log(JSON.stringify(p))});
const hashes=Object.fromEntries(['ShortsGussetFoldSeed.mjs','ShortsPaperForming.mjs','ShortsPaperAssembly.mjs'].map(n=>[n,createHash('sha256').update(readFileSync(new URL(n,base))).digest('hex')]));
const {draft:formed,...receipt}=result;const report={createdAt:new Date().toISOString(),sourceHashes:hashes,fixtureSHA256:createHash('sha256').update(bytes).digest('hex'),measurementScope:'frozen prior CPU body scalars; not current native browser wearing',seed:seed.seedReceipt,...receipt,diagnosticSourceXYZ:Array.from(formed.positions),frame:'actor-local metres',wearingAccepted:false};
const out=new URL('qa/shorts-paper-assembly-20261004.json',base);writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({report:out.pathname,status:result.status,gap:result.softGapM,strain:result.sourceMetric.maximumPrincipalStrain,elapsedMs:result.elapsedMs,wearingAccepted:false}));
