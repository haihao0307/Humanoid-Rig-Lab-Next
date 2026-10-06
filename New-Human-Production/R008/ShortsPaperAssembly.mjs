// Original source paper -> four exact gusset hinges -> finite soft stitches.
// This authoring stage has no body, renderer, native integration or fabric
// calibration. Never turn an unresolved soft seam into a hard averaged seam.
import {formShortsPaperSurface} from './ShortsPaperForming.mjs';
import {compilePaperSurfaceModel,evaluatePaperSurface,paperTriangle} from './ShortsPaperSurfaceModel.mjs';
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
export function closeConvergedPaperSeams(draft,sourceToDof,positions){
 const n=draft.sourceUV.length/2,map=Array.from(sourceToDof);
 if(map.length!==n||map.some(q=>!Number.isInteger(q)||q<0||q>=positions.length)||positions.some(p=>p.length!==3||p.some(v=>!Number.isFinite(v)))||draft.masses.length!==n||Array.from(draft.masses).some(m=>!(Number.isFinite(m)&&m>0)))throw Error('Invalid original source seam closure input');
 const gap=Math.max(0,...draft.seams.flatMap(s=>s.pairs.map(p=>distance(positions[map[p.a]],positions[map[p.b]]))));
 if(!Number.isFinite(gap)||gap>1e-7)throw Error('Cannot eliminate unresolved source seam constraints');
 const parent=Array.from({length:n},(_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));for(const s of draft.seams)for(const p of s.pairs)parent[find(p.b)]=find(p.a);
 const groups=new Map();for(let i=0;i<n;i++){const r=find(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}const members=[...groups.values()],joined=new Uint32Array(n),xyz=members.map(g=>{let mass=0,p=[0,0,0];for(const i of g){mass+=draft.masses[i];for(let k=0;k<3;k++)p[k]+=draft.masses[i]*positions[map[i]][k];}return p.map(v=>v/mass);});members.forEach((g,q)=>g.forEach(i=>joined[i]=q));
 const maximumShiftM=Math.max(...map.map((q,i)=>distance(positions[q],xyz[joined[i]]))),model=compilePaperSurfaceModel(draft),before=evaluatePaperSurface(model,positions,map),after=evaluatePaperSurface(model,xyz,joined);
 const oldGroups=new Map();for(let i=0;i<n;i++){if(oldGroups.has(map[i])&&oldGroups.get(map[i])!==joined[i])throw Error('Exact seam closure would split an existing source group');oldGroups.set(map[i],joined[i]);}
 if(draft.seams.some(s=>s.pairs.some(p=>joined[p.a]!==joined[p.b]))||Array.from(draft.triangles).some((id,i,tri)=>i%3===0&&(joined[id]===joined[tri[i+1]]||joined[id]===joined[tri[i+2]]||joined[tri[i+1]]===joined[tri[i+2]])))throw Error('Exact source seam closure has invalid topology');
 if(maximumShiftM>1e-7||!before.finite||!after.finite||after.degenerateSurfaceTriangles!==0||after.maximumPrincipalStrain>before.maximumPrincipalStrain+1e-4)throw Error('Converged seam elimination changes material beyond its numerical bound');
 return {positions:xyz,sourceToDof:joined,receipt:{sourceSeams:draft.seams.length,sourceDofs:members.length,priorMaximumGapM:gap,maximumShiftM,beforePrincipalStrain:before.maximumPrincipalStrain,afterPrincipalStrain:after.maximumPrincipalStrain,sourceUVRestMassUnchanged:true,wearingAccepted:false}};
}
export function assembleShortsPaperSeed(seed,{wallBudgetMs=90000,onProgress=()=>{}}={}){
 if(!Number.isFinite(wallBudgetMs)||wallBudgetMs<=0||wallBudgetMs>90000)throw Error('Static paper assembly has at most90 seconds total budget');
 if(seed.activeSeamIDs?.length!==4||!seed.activeSeamIDs.every(id=>id.startsWith('gusset-')))throw Error('Expected four exact source gusset hinges');
 const began=performance.now(),model=compilePaperSurfaceModel(seed);if(model.status!=='SOURCE_METRIC_VALID')throw Error('Invalid original source paper');
 const map=Array.from(seed.quotientMap),count=Math.max(...map)+1,mass=Array(count).fill(0),positions=Array.from({length:count},()=>[0,0,0]);
 for(let i=0;i<map.length;i++){const q=map[i],m=seed.masses[i];mass[q]+=m;for(let k=0;k<3;k++)positions[q][k]+=m*seed.positions[3*i+k];}
 for(let q=0;q<count;q++){if(!(mass[q]>0))throw Error('Massless paper vertex');for(let k=0;k<3;k++)positions[q][k]/=mass[q];}
 let xyz=positions;const sourceIdentity=JSON.stringify({uv:seed.sourceUV,triangles:seed.triangles,mass:seed.masses,seams:seed.seams}),pairs=new Map();
 for(const s of seed.seams)if(!seed.activeSeamIDs.includes(s.id))for(const p of s.pairs){const a=map[p.a],b=map[p.b];if(a===b)continue;const key=[Math.min(a,b),Math.max(a,b)].join(':');if(!pairs.has(key))pairs.set(key,{a,b,sourceSeams:[s.id]});else if(!pairs.get(key).sourceSeams.includes(s.id))pairs.get(key).sourceSeams.push(s.id);}
 const diag=Array(count).fill(0);for(const t of model.triangles){const r=paperTriangle(t.reference.uv);t.ids.forEach((source,i)=>diag[map[source]]+=r.areaM2*(r.warpCoefficients[i]**2+r.weftCoefficients[i]**2));}
 const diagonalMean=diag.reduce((a,b)=>a+b,0)/count,trace=[];let reason='finite soft-stitch schedule exhausted',last=null;
 // One declared continuation schedule, not an angle/visual parameter search.
 // Stiffness belongs only to static authoring and stays out of native cloth.
 for(let stage=0;stage<4;stage++){
  if(performance.now()-began>=wallBudgetMs){reason='bounded paper assembly wall time exhausted';break;}
  const weight=diagonalMean*16**stage;
  last=formShortsPaperSurface({draft:seed,positions:xyz,sourceToDof:map,activeSeamIds:seed.activeSeamIDs,seamSprings:[...pairs.values()].map(p=>({...p,weight})),targetGapM:1e-4},{maximumIterations:80});
  xyz=last.positions;const gap=Math.max(0,...[...pairs.values()].map(p=>distance(xyz[p.a],xyz[p.b]))),entry={stage,weight,iterations:last.iterations,sourcePrincipalStrain:last.final.maximumPrincipalStrain,softGapM:gap,stop:last.stopReason,elapsedMs:performance.now()-began};trace.push(entry);onProgress(entry);
  if(last.final.maximumPrincipalStrain<=.05&&gap<=1e-4){reason='soft seam and paper gates passed; hard closure must be independently rechecked';break;}
  if(last.stopReason?.includes('Rank-deficient')||last.stopReason?.includes('linear algebra unresolved')){reason=last.stopReason;break;}
 }
 const raw=new Float64Array(map.length*3);for(let i=0;i<map.length;i++)raw.set(xyz[map[i]],3*i);
 const softGapM=Math.max(0,...seed.seams.flatMap(s=>s.pairs.map(p=>distance(xyz[map[p.a]],xyz[map[p.b]]))));
 const sourceMetric=evaluatePaperSurface(model,xyz,map,{strainLimit:.05});
 if(sourceIdentity!==JSON.stringify({uv:seed.sourceUV,triangles:seed.triangles,mass:seed.masses,seams:seed.seams}))throw Error('Paper assembly changed source rest');
 return {draft:{...seed,positions:raw},status:sourceMetric.maximumPrincipalStrain<=.05&&softGapM<=1e-4?'SOFT_SOURCE_SEAMS_READY_FOR_RECHECK':'HOLD',sourceMetric,softGapM,trace,stopReason:reason,elapsedMs:performance.now()-began,activeSourceSeams:4,remainingSourceSeams:15,sourceUVRestMassUnchanged:true,hardRemainingQuotientPerformed:false,noBody:true,nativeSteps:0,wearingAccepted:false};
}
