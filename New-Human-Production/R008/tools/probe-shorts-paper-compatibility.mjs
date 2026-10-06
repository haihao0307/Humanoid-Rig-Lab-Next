/* Read-only intrinsic paper audit. Reconstructs recorded source2D measurements,
 * never runs a body/cloth solve and never changes production paper or poses. */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const base=fileURLToPath(new URL('../',import.meta.url)),read=p=>JSON.parse(readFileSync(p,'utf8')),hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex'),distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const currentReceipt=read(resolve(base,'qa/shorts-draft-probe.json')).actualGeneratedIndividual.draftReceipt,
 original=read('G:/Three.js/Human/Human-Work-Preparation-20260930/proof-restart-20261001/automatic-static-preview/BROWSER_QA.json').pattern,
 failure=read(resolve(base,'qa/shorts-coupled-staged-sewing-probe-20261002.json')),
 sourceText=readFileSync(resolve(base,'../../../Human-Shorts-R24-Source-20260930/clothing/ShortsPattern.js'),'utf8'),
 paper=runInNewContext(sourceText+'\ncreateShortsPattern(recordedMeasurements,recordedDesign)',{recordedMeasurements:currentReceipt.measurements,recordedDesign:currentReceipt.design});
assert.equal(hash(sourceText),currentReceipt.paperSource.sha256);
const sourceDigest=p=>hash(p.pieces.map(x=>({id:x.id,uv:x.materialCoordinates,triangles:x.triangles,boundaries:x.boundaries}))),recordedSourceHash=read(resolve(base,'qa/shorts-manufacturing-probe.json')).sourceSHA256.freshPaper;assert.equal(sourceDigest(paper),recordedSourceHash);
const activeIDs=['center-front','center-back','gusset-FL','gusset-FR','gusset-BL','gusset-BR'],pieces=new Map(paper.pieces.map(p=>[p.id,p])),offsets=new Map();let count=0;
paper.pieces.forEach(p=>{offsets.set(p.id,count);count+=p.materialCoordinates.length;});
const parent=Array.from({length:count},(_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i])),global=(id,i)=>offsets.get(id)+i,
 seamChecks=paper.seams.filter(s=>activeIDs.includes(s.id)).map(s=>{
 const a=s.pairs.map(p=>pieces.get(s.a.pieceId).materialCoordinates[p.a]),b=s.pairs.map(p=>pieces.get(s.b.pieceId).materialCoordinates[p.b]),segments=a.slice(1).map((point,i)=>({segment:i,aLengthM:distance(a[i],point),bLengthM:distance(b[i],b[i+1]),mismatchM:Math.abs(distance(a[i],point)-distance(b[i],b[i+1]))}));
 let maxMatchedSampleChordMismatchM=0;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)maxMatchedSampleChordMismatchM=Math.max(maxMatchedSampleChordMismatchM,Math.abs(distance(a[i],a[j])-distance(b[i],b[j])));
 for(const pair of s.pairs)parent[find(global(s.b.pieceId,pair.b))]=find(global(s.a.pieceId,pair.a));
 const collinearResidual=points=>{if(points.length!==3)return null;const mid=points[0].map((v,k)=>(v+points[2][k])/2);return distance(points[1],mid);};
 return {sourceSeamID:s.id,actualSourcePairs:s.pairs,aPiece:s.a.pieceId,bPiece:s.b.pieceId,sourceA:a,sourceB:b,segments,totalArcAM:segments.reduce((v,s)=>v+s.aLengthM,0),totalArcBM:segments.reduce((v,s)=>v+s.bLengthM,0),maxMatchedSampleChordMismatchM,halfChordMidpointResidualAM:collinearResidual(a),halfChordMidpointResidualBM:collinearResidual(b)};
});
const quotientIds=new Map([...new Set(parent.map((_,i)=>find(i)))].map((r,i)=>[r,i])),quotient=i=>quotientIds.get(find(i)),edges=new Map(),duplicateConflicts=[],triangles=[];
for(const piece of paper.pieces)for(const local of piece.triangles){const q=local.map(i=>quotient(global(piece.id,i))),uv=local.map(i=>piece.materialCoordinates[i]);
 const l=[distance(uv[0],uv[1]),distance(uv[1],uv[2]),distance(uv[2],uv[0])];assert(l[0]+l[1]>l[2]&&l[1]+l[2]>l[0]&&l[2]+l[0]>l[1]);assert.equal(new Set(q).size,3);
 triangles.push({q,pieceId:piece.id,local,uv});for(let k=0;k<3;k++){const a=Math.min(q[k],q[(k+1)%3]),b=Math.max(q[k],q[(k+1)%3]),key=a+':'+b,previous=edges.get(key),record={a,b,restM:l[k],pieceId:piece.id,sourceLocalEdge:[local[k],local[(k+1)%3]]};if(previous&&Math.abs(previous.restM-record.restM)>1e-10)duplicateConflicts.push({previous,current:record,mismatchM:Math.abs(previous.restM-record.restM)});if(!previous)edges.set(key,record);}
}
const graph=Array.from({length:quotientIds.size},()=>new Set());for(const e of edges.values()){graph[e.a].add(e.b);graph[e.b].add(e.a);}
const edgeRest=(a,b)=>edges.get(Math.min(a,b)+':'+Math.max(a,b)).restM;
let fourCliqueCount=0;const impossibleFourPointMetrics=[];
for(let a=0;a<graph.length;a++)for(const b of graph[a])if(b>a)for(const c of graph[b])if(c>b&&graph[a].has(c))for(const e of graph[c])if(e>c&&graph[a].has(e)&&graph[b].has(e)){
 fourCliqueCount++;const ids=[a,b,c,e],gram=ids.slice(1).map(i=>ids.slice(1).map(j=>(edgeRest(a,i)**2+edgeRest(a,j)**2-(i===j?0:edgeRest(i,j)**2))/2)),g=gram,
  det=g[0][0]*(g[1][1]*g[2][2]-g[1][2]*g[2][1])-g[0][1]*(g[1][0]*g[2][2]-g[1][2]*g[2][0])+g[0][2]*(g[1][0]*g[2][1]-g[1][1]*g[2][0]),scale=Math.max(...g.flat().map(Math.abs)),minors=[[0,1],[0,2],[1,2]].map(([i,j])=>(g[i][i]*g[j][j]-g[i][j]**2)/(scale**2));
 if(det/(scale**3)<-1e-9||Math.min(...minors)<-1e-9)impossibleFourPointMetrics.push({ids,gram,normalizedDeterminant:det/scale**3,normalizedPrincipalMinors:minors});
}
function gStats(p){const g=p.pieces.find(x=>x.id==='G');let maxTriangleBasisCondition=0,minAngleRadians=Infinity;
 for(const ids of g.triangles){const [a,b,c]=ids.map(i=>g.materialCoordinates[i]),u=b.map((v,k)=>v-a[k]),v=c.map((x,k)=>x-a[k]),x=u.reduce((s,z,k)=>s+z*u[k],0),y=u.reduce((s,z,k)=>s+z*v[k],0),z=v.reduce((s,q,k)=>s+q*v[k],0),disc=Math.hypot(x-z,2*y);maxTriangleBasisCondition=Math.max(maxTriangleBasisCondition,Math.sqrt((x+z+disc)/(x+z-disc)));
  for(let i=0;i<3;i++){const points=[a,b,c],m=points[(i+1)%3].map((z,k)=>z-points[i][k]),n=points[(i+2)%3].map((z,k)=>z-points[i][k]),cos=m.reduce((s,q,k)=>s+q*n[k],0)/(Math.hypot(...m)*Math.hypot(...n));minAngleRadians=Math.min(minAngleRadians,Math.acos(Math.max(-1,Math.min(1,cos))));}
 }
 const half=g.sourceContour.width/2;return {...g.sourceContour,sourceAreaM2:half*(g.sourceContour.frontHeight+g.sourceContour.backHeight),widthToLengthRatio:g.sourceContour.width/(g.sourceContour.frontHeight+g.sourceContour.backHeight),maxTriangleBasisCondition,minTriangleAngleDegrees:minAngleRadians*180/Math.PI};
}
const newG=gStats(paper),oldG=gStats(original),worst=failure.stages.find(s=>s.id==='gusset').after.worstMaterialTriangle,
 worstEdgeChecks=worst.sourceUV.map((uv,i)=>{const j=(i+1)%3,rest=distance(uv,worst.sourceUV[j]),actual=distance(worst.actualPositions[i],worst.actualPositions[j]);return {aSourceIndex:worst.sourceIndices[i],bSourceIndex:worst.sourceIndices[j],restLengthM:rest,actualLengthM:actual,relativeEdgeStrain:actual/rest-1};});
function angleReview(p){
 const offs=new Map();let n=0;p.pieces.forEach(x=>{offs.set(x.id,n);n+=x.materialCoordinates.length;});const par=Array.from({length:n},(_,i)=>i),f=i=>par[i]===i?i:(par[i]=f(par[i]));
 for(const seam of p.seams)if(activeIDs.includes(seam.id))for(const pair of seam.pairs)par[f(offs.get(seam.b.pieceId)+pair.b)]=f(offs.get(seam.a.pieceId)+pair.a);
 return [['front',0],['right',2],['back',4],['left',6]].map(([name,index])=>{const id=f(offs.get('G')+index),link=new Map();let sum=0;
  for(const piece of p.pieces)for(const ids of piece.triangles){const q=ids.map(i=>f(offs.get(piece.id)+i)),vertex=q.indexOf(id);if(vertex<0)continue;const ia=(vertex+1)%3,ib=(vertex+2)%3,a=piece.materialCoordinates[ids[vertex]],u=piece.materialCoordinates[ids[ia]].map((v,k)=>v-a[k]),v=piece.materialCoordinates[ids[ib]].map((z,k)=>z-a[k]),cos=u.reduce((s,z,k)=>s+z*v[k],0)/(Math.hypot(...u)*Math.hypot(...v));sum+=Math.acos(Math.max(-1,Math.min(1,cos)));for(const [a,b]of [[q[ia],q[ib]],[q[ib],q[ia]]]){if(!link.has(a))link.set(a,new Set());link.get(a).add(b);}}
  const linkClosed=[...link.values()].every(v=>v.size===2),degreeOneLinkVertices=[...link.values()].filter(v=>v.size===1).length;
  return {sourceGJunction:name,sumIncidentMaterialAnglesDegrees:sum*180/Math.PI,vertexLinkClosed:linkClosed,degreeOneLinkVertices,angleDeficitDegrees:linkClosed?(2*Math.PI-sum)*180/Math.PI:null,interpretation:linkClosed?'closed intrinsic sewn vertex; negative deficit requires saddle folding, not a proof of impossibility':'open source-boundary fan until later inseam closure; 360-degree deficit is not an interior-curvature constraint at this stage'};
 });
}
const junctionAngles=angleReview(paper),acceptedJunctionAngles=angleReview(original);
const report={version:'r008-readonly-stage-g-source-metric-compatibility@1',capturedAt:new Date().toISOString(),scope:'source2D only, recorded measured draft regenerated with canonical source; no cloth/body solve or production source modification',sourcePaperSHA256:sourceDigest(paper),canonicalSHA256:hash(sourceText),sourceFileHashes:['ShortsGarmentDraft.mjs','ShortsManufacturingDraft.mjs'].map(path=>({path,sha256:hash(readFileSync(resolve(base,path),'utf8'))})),activeSourceSeamIDs:activeIDs,stageGSourceQuotientDofs:quotientIds.size,seamChecks,localIntrinsicNecessaryConditions:{duplicateRestEdgeConflicts:duplicateConflicts,triangleInequalitiesPassed:true,collapsedSourceTriangles:0,fourCliqueCount,impossibleFourPointMetrics,junctionAngles,acceptedJunctionAngles,noLocalNecessaryMetricContradictionDetected:duplicateConflicts.length===0&&impossibleFourPointMetrics.length===0,globalIsometricEmbeddingProven:false,selfContactOrWearabilityProven:false},acceptedR24G:oldG,newR008G:newG,styleChange:{widthRatio:newG.width/oldG.width,frontHeightRatio:newG.frontHeight/oldG.frontHeight,backHeightRatio:newG.backHeight/oldG.backHeight,similarityTransformPreserved:false,sourceRolesAndTopologyPreserved:true,acceptedGShapeProportionsPreserved:false},newGWidthAuthority:currentReceipt.gusset,widthReview:{actualGapIsAClothedEnvelopeAirGap:true,clearanceSubtractionIsAHeuristicNotACutWidthLaw:true,bendablePaperMayBeWiderThanAirGap:true,paperWidthIsProvenCauseOfFailedSolve:false,widthChangeRecommendedByThisReadOnlyAudit:false},actualFailure:{principalStrain:failure.stages.find(s=>s.id==='gusset').after.mainStrain,softSourcePairGapM:failure.stages.find(s=>s.id==='gusset').seamGapM,worst,worstEdgeChecks},conclusion:'Exact shared source seam arclength, all matched-sample chord lengths and quotient edge rests are compatible at the checked local level. Full source metric embedding was not solved or proven. G aspect/proportions differ substantially from the accepted reference; throat-clearance sizing has no established tailoring authority. Do not substitute 60 mm, change rest to posed geometry, or claim global compatibility/acceptance.',productionReady:false};
// Reload named immutable failure evidence every time: the active staged file
// is updated by its producer and is not interchangeable with the old descent
// audit. Carry both exact file hashes to prevent mixing the two solver states.
const latestPath=resolve(base,'qa/shorts-coupled-staged-sewing-probe-20261002.json'),priorPath=resolve(base,'qa/shorts-coupled-descent-audit-20261002.json'),prior=read(priorPath),priorStage=prior.stages.find(s=>s.id==='gusset'),priorWorst=priorStage.after.worstMaterialTriangle;
report.actualFailure.provenance={path:latestPath,sha256:hash(readFileSync(latestPath,'utf8')),createdAt:failure.createdAt,sourceHashes:failure.sourceHashes,description:'latest producer staged report after Armijo repair; measured geometry reloaded, not a new solve'};
report.priorFailureComparison={provenance:{path:priorPath,sha256:hash(readFileSync(priorPath,'utf8')),createdAt:prior.createdAt,sourceHashes:prior.sourceHashes,description:'prior descent audit; retain its own actual positions and never label them latest'},principalStrain:priorStage.after.mainStrain,softSourcePairGapM:priorStage.seamGapM,worst:priorWorst,worstEdgeChecks:priorWorst.sourceUV.map((uv,i)=>{const j=(i+1)%3,rest=distance(uv,priorWorst.sourceUV[j]),actual=distance(priorWorst.actualPositions[i],priorWorst.actualPositions[j]);return {aSourceIndex:priorWorst.sourceIndices[i],bSourceIndex:priorWorst.sourceIndices[j],restLengthM:rest,actualLengthM:actual,relativeEdgeStrain:actual/rest-1};})};
function independentTriangleStrain(w){const [a,b,c]=w.sourceUV,[p,q,r]=w.actualPositions,u1=b[0]-a[0],v1=b[1]-a[1],u2=c[0]-a[0],v2=c[1]-a[1],det=u1*v2-u2*v1,ab=q.map((v,k)=>v-p[k]),ac=r.map((v,k)=>v-p[k]),fu=ab.map((v,k)=>(v*v2-ac[k]*v1)/det),fv=ab.map((v,k)=>(ac[k]*u1-v*u2)/det),dot=(u,v)=>u.reduce((s,z,k)=>s+z*v[k],0),x=dot(fu,fu),y=dot(fu,fv),z=dot(fv,fv),disc=Math.hypot(x-z,2*y);return Math.max(Math.abs(Math.sqrt(Math.max(0,(x+z+disc)/2))-1),Math.abs(Math.sqrt(Math.max(0,(x+z-disc)/2))-1));}
report.actualFailure.independentPrincipalStrainFromRecordedGeometry=independentTriangleStrain(worst);
report.priorFailureComparison.independentPrincipalStrainFromRecordedGeometry=independentTriangleStrain(priorWorst);
assert(Math.abs(report.actualFailure.principalStrain-report.actualFailure.independentPrincipalStrainFromRecordedGeometry)<1e-10);
assert(Math.abs(report.priorFailureComparison.principalStrain-report.priorFailureComparison.independentPrincipalStrainFromRecordedGeometry)<1e-10);
report.sourcePaperUnchangedBetweenFailureVersions=true;
writeFileSync(resolve(base,'qa/shorts-paper-compatibility-review.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({sourcePaperSHA256:report.sourcePaperSHA256,stageGSourceQuotientDofs:report.stageGSourceQuotientDofs,seamChecks:seamChecks.map(s=>({id:s.sourceSeamID,arcA:s.totalArcAM,arcB:s.totalArcBM,maxChordMismatch:s.maxMatchedSampleChordMismatchM,midA:s.halfChordMidpointResidualAM,midB:s.halfChordMidpointResidualBM})),localIntrinsicNecessaryConditions:report.localIntrinsicNecessaryConditions,acceptedR24G:oldG,newR008G:newG,styleChange:report.styleChange,worstEdgeChecks},null,2));
