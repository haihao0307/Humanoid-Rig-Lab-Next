// Frozen QA arithmetic only: no subject, browser, solver, pose or geometry update.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),qa=path.join(root,'qa');
const oldFolder=path.join(qa,'shorts-surface-independent-v9-2-boundary-20261003');
const newFolder=path.join(qa,'shorts-surface-independent-v9-3-constrained-20261003');
const inputs=[];
function read(folder,name){const filename=path.join(folder,name),bytes=fs.readFileSync(filename);inputs.push({filename,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});return JSON.parse(bytes);}
const oldQA=read(oldFolder,'QA.json'),newQA=read(newFolder,'QA.json');
const oldActual=read(oldFolder,'ACTUAL_FIT_AND_COMPONENT.json'),actual=read(newFolder,'ACTUAL_FIT_AND_COMPONENT.json');
const coarse=read(newFolder,'COARSE_STATIC_FINAL_CAPTURE.json');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const sourceIdentical=Object.fromEntries(['uv','triangles','mass','seams','actorMatrixWorld','componentWorldPositions'].map(k=>[k,equal(oldActual[k],actual[k])]));
assert.ok(Object.values(sourceIdentical).every(Boolean),'Source/rest/current body authority changed between comparisons');
function stage(r){let previous=r.initial,maximumStrainIncrease=0,maximumClearanceDeficitIncrease=0,actualMeritDecreasing=true,maximumFDRelativeError=0;for(const t of r.trace){const a=t.actualAcceptedAudit;if(a){maximumStrainIncrease=Math.max(maximumStrainIncrease,a.mainStrain-previous.mainStrain);maximumClearanceDeficitIncrease=Math.max(maximumClearanceDeficitIncrease,a.maximumSampledClearanceDeficitM-previous.maximumSampledClearanceDeficitM);previous=a;}if(t.acceptedFraction>0)actualMeritDecreasing&&=t.actualFinalEnergy<t.actualInitialEnergy;maximumFDRelativeError=Math.max(maximumFDRelativeError,t.descentAudit?.relativeError??0);}const h=r.holdWitness;return{iterations:r.iterations,initialStrain:r.initial.mainStrain,finalStrain:r.final.mainStrain,initialMinimumSignedM:r.initial.minimumFeatureSignedDistanceM,finalMinimumSignedM:r.final.minimumFeatureSignedDistanceM,finalHeightErrorM:r.final.maximumHeightGapM,finalWaist:r.final.waist&&{minimumM:r.final.waist.minimumSignedDistanceM,maximumM:r.final.waist.maximumSignedDistanceM},maximumAcceptedStrainIncrease:maximumStrainIncrease,maximumAcceptedClearanceDeficitIncreaseM:maximumClearanceDeficitIncrease,actualMeritDecreasing,maximumFDRelativeError,stopReason:r.stopReason,projectionStop:h&&{kind:h.kind,sweeps:h.sweeps,maximumHalfspaceViolationM:h.maximumHalfspaceViolationM,toleranceM:h.toleranceM,maximumMoveM:h.maximumMoveM,maximumPlaneErrorM:h.maximumPlaneErrorM,elapsedMs:h.elapsedMs,wallBudgetStopped:h.wallBudgetStopped,zeroDirectionFeasibleExact:h.zeroDirectionFeasibleExact,fallbackAttempts:h.fallbackAttempts}};}
const oldStage=stage(oldQA.fitResult),coarseStage=stage(newQA.fitResult),fineStage=stage(newQA.fitResult.refinedAuthoring);
assert.equal(oldStage.initialStrain,coarseStage.initialStrain);
assert.equal(oldStage.initialMinimumSignedM,coarseStage.initialMinimumSignedM);
assert.equal(coarseStage.maximumAcceptedStrainIncrease,0);
assert.equal(fineStage.maximumAcceptedStrainIncrease,0);
assert.equal(coarseStage.maximumAcceptedClearanceDeficitIncreaseM,0);
assert.equal(fineStage.maximumAcceptedClearanceDeficitIncreaseM,0);
assert.ok(coarseStage.actualMeritDecreasing&&fineStage.actualMeritDecreasing);
const w=newQA.fitResult.refinedAuthoring.final.worstContact;
const tri=actual.componentGeometry.indices.slice(w.triangleId*3,w.triangleId*3+3);
assert.deepEqual(tri,w.sourceIndices,'Saved witness must name the actual captured bare triangle');
const xyz=tri.map(i=>actual.componentWorldPositions.slice(i*3,i*3+3));
const baryPoint=[0,1,2].map(k=>xyz.reduce((s,p,j)=>s+p[k]*w.barycentric[j],0));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normal=cross(sub(xyz[1],xyz[0]),sub(xyz[2],xyz[0]));const length=Math.hypot(...normal);normal.forEach((v,k)=>normal[k]=v/length);
const baryErrorM=Math.hypot(...sub(baryPoint,w.surfacePoint)),signed=dot(sub(w.point,baryPoint),normal);
assert.ok(baryErrorM<1e-12);
assert.ok(Math.abs(signed-w.signedDistanceM)<1e-12);
const sourceOwners=actual.quotient.map((q,i)=>q===w.ids[0]?{sourceIndex:i,pieceId:actual.ranges.find(r=>i>=r.offset&&i<r.offset+r.count)?.pieceId}:null).filter(Boolean);
const crossings=newQA.triangleCrossingInspection.result;
const bySurface={},byPart={};for(const c of crossings.exactcrossings){bySurface[c.surface]=(bySurface[c.surface]??0)+1;byPart[c.surface+':'+c.part]=(byPart[c.surface+':'+c.part]??0)+1;}
const report={schema:'shorts-v9.3-frozen-offline-causal-review@1',inputs,sourceIdentical,initialNumericWitnessIdentical:true,oldUnconstrained:oldStage,constrainedCoarse:coarseStage,constrainedFine:fineStage,refinement:{sameInitialPrincipalWithinRoundoff:Math.abs(newQA.fitResult.final.mainStrain-newQA.fitResult.refinedAuthoring.initial.mainStrain)<1e-12,coarseWaistMinimumM:newQA.fitResult.final.waist.minimumSignedDistanceM,newFineInitialWaistMinimumM:newQA.fitResult.refinedAuthoring.initial.waist.minimumSignedDistanceM,explanation:'Exact barycentric source refinement preserves initial triangle F but exposes additional chord samples closer to the curved actual body; it is not an actual-body projection.'},worstBodyWitness:{sourceOwners,actualBareTriangle:tri,triangleWorldXYZ:xyz,barycentric:w.barycentric,baryPoint,baryErrorM,actualOrientedTriangleNormal:normal,independentSignedPlaneDistanceM:signed,reportedSignedDistanceM:w.signedDistanceM,interpretation:'Actual bare face penetration; not the retired native open-cap false-negative case. This one face arithmetic does not certify whole solid union.'},crossings:{pairCount:crossings.crossingCount,recordedWitnessCount:crossings.exactcrossings.length,distinctClothTriangles:new Set(crossings.exactcrossings.map(c=>c.clothTriangle)).size,bySurface,byPart,comparisonCaution:'Counts are cloth/body triangle pairs, not separate physical holes; old/new iteration counts and style feasible sets differ.'},causalConclusion:'Both V9.3 accepted stages monotonically improve strain and sampled worst clearance from the identical initial state. Coarse halts after15 and fine after5 on unresolved finite numerical projections, before line search. V9.2 reaches35 while drifting hem20mm; its smaller final strain/penetration is not a style-compatible baseline. No evidence establishes new constraints caused an accepted geometry regression.',minimalCorrection:'Fixed numerical interior1um target, retaining original halfspace certificate1e-10, exact style planes,3mm trust,128cycles/250ms. May avoid early numerical halt without weakening geometry gates; can remain HOLD if the tightened set conflicts or fresh contacts/principal fail. Full triangle collision constraints and initial mapping quality remain independent unresolved requirements.',scope:{geometryMutation:false,solverIterations:0,bodyConstructed:false,browser:false,nativeSteps:0,paperImpossible:false,wearingAccepted:false}};
const arg=process.argv.indexOf('--report');if(arg>=0){const out=path.resolve(process.argv[arg+1]);fs.writeFileSync(out,JSON.stringify(report,null,2),{encoding:'utf8',flag:'wx'});}
// --report writes a fresh ignored diagnostic only; full existing snapshots never mutate.
console.log(JSON.stringify({sourceIdentical,old:oldStage,coarse:coarseStage,fine:fineStage,independentWorstSignedM:signed,witnessPart:w.part,crossingPairs:crossings.crossingCount,sourceOwners,noNewSolve:true},null,2));
