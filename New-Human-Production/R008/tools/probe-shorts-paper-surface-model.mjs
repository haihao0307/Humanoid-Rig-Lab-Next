// Independent finite mathematical tests, never a character/cloth simulation.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {paperTriangle,evaluatePaperTriangle,xpbdScalarStep,auditSeamArc,compilePaperSurfaceModel,evaluatePaperSurface,garmentPipelineGate,allocateDiamondRise,auditRiseBudget,auditSourcePathBound,rotateAboutMaterialHinge} from '../ShortsPaperSurfaceModel.mjs';
const results=[],evidence={},requireSavedEvidence=process.argv.includes('--require-saved-evidence');
class SavedEvidenceUnavailable extends Error{}
async function readSavedEvidence(path){try{return await fs.readFile(path);}catch(error){if(error.code==='ENOENT'&&!requireSavedEvidence)throw new SavedEvidenceUnavailable('SKIPPED: ignored saved actual geometry unavailable at '+fileURLToPath(path)+'; use --require-saved-evidence to require local evidence');throw error;}}
const close=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);
async function test(name,fn){try{await fn();results.push({name,passed:true,skipped:false});}catch(error){if(error instanceof SavedEvidenceUnavailable)results.push({name,passed:false,skipped:true,reason:error.message});else results.push({name,passed:false,skipped:false,error:error.message});}}
const material={warpNPerM:100,weftNPerM:70,shearNPerM:25};
const uv=[[0,0],[.017,.002],[.004,.013]],p=[[.01,.03,-.02],[.028,.027,-.011],[.012,.045,-.025]];
const ref=paperTriangle(uv,{grainAngleRadians:.37});
await test('all analytic metric rows match finite differences with rotated grain',()=>{
 const initial=evaluatePaperTriangle(ref,p,material),epsilon=1e-8;let maximumRelative=0;
 for(let mode=0;mode<3;mode++)for(let i=0;i<3;i++)for(let k=0;k<3;k++){
  const plus=structuredClone(p),minus=structuredClone(p);plus[i][k]+=epsilon;minus[i][k]-=epsilon;
  const fd=(evaluatePaperTriangle(ref,plus).rows[mode].value-evaluatePaperTriangle(ref,minus).rows[mode].value)/(2*epsilon),analytic=initial.rows[mode].gradients[i][k],relative=Math.abs(fd-analytic)/Math.max(1,Math.abs(fd),Math.abs(analytic));maximumRelative=Math.max(maximumRelative,relative);assert.ok(relative<1e-6);
 }evidence.metricGradientMaximumRelativeError=maximumRelative;
});
await test('metric energy derivative and translation/rotation invariance',()=>{
 const a=evaluatePaperTriangle(ref,p,material),angle=.73,q=p.map(([x,y,z])=>[x*Math.cos(angle)-y*Math.sin(angle)+.8,x*Math.sin(angle)+y*Math.cos(angle)-.4,z+1.7]),b=evaluatePaperTriangle(ref,q,material);
 a.firstForm.forEach((v,i)=>close(v,b.firstForm[i],1e-11));close(a.energyJ,b.energyJ,1e-11);
 for(const row of a.rows)for(let k=0;k<3;k++)close(row.gradients.reduce((s,g)=>s+g[k],0),0,1e-11);
 const epsilon=1e-8;for(let i=0;i<3;i++)for(let k=0;k<3;k++){const plus=structuredClone(p),minus=structuredClone(p);plus[i][k]+=epsilon;minus[i][k]-=epsilon;const fd=(evaluatePaperTriangle(ref,plus,material).energyJ-evaluatePaperTriangle(ref,minus,material).energyJ)/(2*epsilon),g=a.rows.reduce((s,r)=>s+r.energyCoefficientJ*r.value*r.gradients[i][k],0);close(fd,g,1e-8);}
});
await test('area-integrated orthotropic energy has explicit reciprocal-joule compliance',()=>{
 const r=evaluatePaperTriangle(ref,p,material);for(const row of r.rows){close(row.compliancePerJ*row.energyCoefficientJ,1);close(row.energyCoefficientJ,ref.areaM2*material[{warp:'warpNPerM',weft:'weftNPerM',shear:'shearNPerM'}[row.kind]]);}
 const bigRef=paperTriangle(uv.map(v=>v.map(x=>x*2)),{grainAngleRadians:.37}),big=evaluatePaperTriangle(bigRef,p.map(v=>v.map(x=>x*2)),material);close(big.energyJ,r.energyJ*4,1e-11);big.rows.forEach((row,i)=>close(row.compliancePerJ,r.rows[i].compliancePerJ/4,1e-8));
});
await test('linear triangle membrane energy is conserved under exact planar paper subdivision',()=>{
 const u=[[0,0],[1,0],[0,1]],x=u.map(([a,b])=>[1.1*a+.15*b,.9*b,.2*a]),coarse=evaluatePaperTriangle(paperTriangle(u),x,material),m=(a,b)=>a.map((v,k)=>(v+b[k])/2),u6=[...u,m(u[0],u[1]),m(u[1],u[2]),m(u[2],u[0])],x6=[...x,m(x[0],x[1]),m(x[1],x[2]),m(x[2],x[0])];
 const fine=[[0,3,5],[3,1,4],[5,4,2],[3,4,5]].map(ids=>evaluatePaperTriangle(paperTriangle(ids.map(i=>u6[i])),ids.map(i=>x6[i]),material));close(fine.reduce((s,r)=>s+r.energyJ,0),coarse.energyJ,1e-10);
});
await test('cylinder is developable in the finite triangle refinement limit',()=>{
 const radius=.2,levels=[2,4,8],strains=levels.map(n=>{const h=.16/n,u=[[0,0],[h,0],[0,h]],x=u.map(([a,b])=>[radius*Math.sin(a/radius),b,radius*(1-Math.cos(a/radius))]),r=evaluatePaperTriangle(paperTriangle(u),x);close(r.sigmaMin,2*radius*Math.sin(h/(2*radius))/h,1e-11);close(r.sigmaMax,1);return r.principalStrain;});
 assert.ok(strains[0]>strains[1]&&strains[1]>strains[2]);assert.ok(strains[0]/strains[1]>3.9&&strains[1]/strains[2]>3.9);evidence.cylinder={radiusM:radius,meshLevels:levels,principalStrains:strains,scope:'analytical isometric cylinder sampled with straight triangle chords; no physical parameter scan'};
});
await test('sphere latitude mapping has actual nonzero intrinsic metric distortion',()=>{
 const R=.2,v=.1,h=.002,u=[[0,v],[h,v],[0,v+h]],x=u.map(([a,b])=>[R*Math.sin(a/R)*Math.cos(b/R),R*Math.sin(b/R),R*Math.cos(a/R)*Math.cos(b/R)]),r=evaluatePaperTriangle(paperTriangle(u),x);assert.ok(r.principalStrain>.1);evidence.sphere={radiusM:R,latitudeRadians:v/R,principalStrain:r.principalStrain,scope:'specific plane-to-sphere latitude chart; not an impossibility certificate for every cut/fold layout'};
});
await test('XPBD aggregates sewn DOF gradients before mass denominator and preserves scalar update',()=>{
 const s=xpbdScalarStep({value:.3,gradients:[[1,0,0],[2,0,0],[0,1,0]],dofIndices:[0,0,1],invMass:[.5,2],lambda:.02,compliance:.008,h:.1}),alpha=.8,den=.5*9+2+alpha,dl=(-.3-alpha*.02)/den;close(s.denominator,den);close(s.deltaLambda,dl);close(s.lambda,.02+dl);assert.equal(s.corrections.length,2);close(s.corrections[0].delta[0],.5*3*dl);close(s.corrections[1].delta[1],2*dl);
});
await test('cancelled sewn gradients and fixed groups do not falsely move material',()=>{
 const cancelled=xpbdScalarStep({value:.3,gradients:[[1,0,0],[-1,0,0]],dofIndices:[0,0],invMass:[1],lambda:0,compliance:0,h:.1});assert.equal(cancelled.status,'HOLD');assert.deepEqual(cancelled.corrections,[]);
 const fixed=xpbdScalarStep({value:.3,gradients:[[1,0,0],[0,1,0]],dofIndices:[0,1],invMass:[0,1],lambda:0,compliance:0,h:.1});assert.ok(fixed.corrections[0].delta.every(x=>x===0));close(fixed.corrections[1].delta[1],-.3);
 const dual=xpbdScalarStep({value:.3,gradients:[[1,0,0],[-1,0,0]],dofIndices:[0,0],invMass:[1],lambda:0,compliance:.008,h:.1});close(dual.lambda,-.375);assert.ok(dual.corrections.every(c=>c.delta.every(v=>v===0)));
});
await test('XPBD rejects nonfinite derived timestep arithmetic atomically',()=>assert.throws(()=>xpbdScalarStep({value:1,gradients:[[1,0,0]],dofIndices:[0],invMass:[1],compliance:1,h:1e-200})));
await test('source arc sampling handles unequal vertex counts and explicit reverse direction',()=>{
 const r=auditSeamArc([[0,0],[1,0]],[[3,0],[3,.25],[3,1]],{directionB:'reverse'});assert.equal(r.status,'COMPATIBLE_LENGTH_ONLY');assert.deepEqual(r.stations[0].b,[3,1]);assert.deepEqual(r.stations.at(-1).b,[3,0]);assert.equal(r.stations.length,3);assert.equal(r.spatialPlacementValidated,false);
});
await test('seam total mismatch and notch-local feed mismatch are rejected',()=>{
 assert.equal(auditSeamArc([[0,0],[1,0]],[[0,0],[1.15,0]]).status,'HOLD');assert.equal(auditSeamArc([[0,0],[1,0]],[[0,0],[1,0]],{directionB:'same',notches:[{a:.5,b:.8}]}).status,'HOLD');assert.throws(()=>auditSeamArc([[0,0],[1,0]],[[0,0],[1,0]],{notches:[{a:.5,b:-.1}]}));
});
const draft={sourceUV:[0,0,1,0,1,1,0,1,2,0,3,0,3,1,2,1],triangles:[0,1,2,0,2,3,4,5,6,4,6,7],ranges:[{pieceId:'A',offset:0,count:4},{pieceId:'B',offset:4,count:4}],seams:[{id:'AB',a:{pieceId:'A'},b:{pieceId:'B'},pairs:[{a:1,b:4},{a:2,b:7}]}]};
await test('compile derives only source area mass and separates paper hinges from unspecified seam law',()=>{
 const before=JSON.stringify(draft),model=compilePaperSurfaceModel(draft);assert.equal(model.status,'SOURCE_METRIC_VALID');close(model.areaM2,2);close(model.massKg,.44);close(model.sourceMass.reduce((s,x)=>s+x,0),.44);assert.ok([...model.sourceMass].every(x=>x>0));assert.equal(model.hinges.filter(h=>h.kind==='within-piece-flat-paper').length,2);assert.equal(model.hinges.filter(h=>h.kind==='across-piece-seam').length,1);assert.equal(model.hinges.at(-1).restAngleRadians,null);assert.equal(model.hinges.at(-1).law,'UNSPECIFIED');assert.equal(JSON.stringify(draft),before);
});
await test('owned but unused source vertices cannot pass positive material mass stage',()=>{
 const d=structuredClone(draft);d.sourceUV.push(8,8);d.ranges.push({pieceId:'UNUSED',offset:8,count:1});let held=false;try{const r=compilePaperSurfaceModel(d);held=r.status==='HOLD';}catch{held=true;}assert.ok(held,'zero-mass owned source vertex was accepted');
});
await test('declared seam ownership mismatch cannot pass source gluing validation',()=>{
 const d=structuredClone(draft);d.seams[0].pairs=[{a:0,b:1},{a:3,b:2}];let held=false;try{const r=compilePaperSurfaceModel(d);held=r.status==='HOLD';}catch{held=true;}assert.ok(held,'declared A/B seam uses A/A source endpoints but was accepted');
});
await test('surface metric and stage gate cannot promote clean geometry to native motion',()=>{
 const model=compilePaperSurfaceModel(draft),positions=Array.from({length:8},(_,i)=>[draft.sourceUV[i*2],draft.sourceUV[i*2+1],0]),before=JSON.stringify(positions),r=evaluatePaperSurface(model,positions);assert.equal(r.status,'METRIC_VALID_ONLY');close(r.maximumPrincipalStrain,0);const gate=garmentPipelineGate({paper:model,surface:r});assert.equal(gate.status,'HOLD');assert.equal(gate.blockedAt,'sewing');assert.equal(gate.canRunMotion,false);assert.equal(gate.productionReady,false);assert.equal(JSON.stringify(positions),before);
});
await test('actual saved failed source state remains HOLD under independent paper evaluator',async()=>{
 const path=new URL('../qa/shorts-covering-independent-v4-20261002/ACTUAL_FIT_AND_COMPONENT.json',import.meta.url),bytes=await readSavedEvidence(path),r=JSON.parse(bytes),d={sourceUV:r.uv,triangles:r.triangles,ranges:r.ranges,seams:r.seams},before=JSON.stringify(d),model=compilePaperSurfaceModel(d),positions=Array.from({length:r.positions.length/3},(_,i)=>r.positions.slice(i*3,i*3+3)),evaluated=evaluatePaperSurface(model,positions);
 assert.equal(evaluated.status,'HOLD');close(evaluated.maximumPrincipalStrain,r.fitResult.final.mainStrain,1e-9);assert.equal(JSON.stringify(d),before);assert.equal(r.step,0);evidence.actualSavedFailureReplay={path:fileURLToPath(path),sha256:createHash('sha256').update(bytes).digest('hex'),maximumPrincipalStrain:evaluated.maximumPrincipalStrain,reportedPrincipalStrain:r.fitResult.final.mainStrain,sourceTriangles:model.triangles.length,sourceVertices:model.sourceVertices,status:evaluated.status,sourceStage:model.status,geometryReplayedOnly:true,actualBodyRegenerated:false,physicalStep:false};
});
await test('latest actual v8 failed fine geometry retains browser principal strain',async()=>{
 const path=new URL('../qa/shorts-surface-independent-v8-20261003/ACTUAL_FIT_AND_COMPONENT.json',import.meta.url),bytes=await readSavedEvidence(path),r=JSON.parse(bytes),d={sourceUV:r.uv,triangles:r.triangles,ranges:r.ranges,seams:r.seams},before=JSON.stringify(d),model=compilePaperSurfaceModel(d),positions=Array.from({length:r.positions.length/3},(_,i)=>r.positions.slice(i*3,i*3+3)),evaluated=evaluatePaperSurface(model,positions);assert.equal(evaluated.status,'HOLD');close(evaluated.maximumPrincipalStrain,r.clothAudit.mainStrain,1e-8);assert.equal(JSON.stringify(d),before);evidence.actualV8SavedFailureReplay={path:fileURLToPath(path),sha256:createHash('sha256').update(bytes).digest('hex'),sourceTriangles:model.triangles.length,sourceVertices:model.sourceVertices,maximumPrincipalStrain:evaluated.maximumPrincipalStrain,browserPrincipalStrain:r.clothAudit.mainStrain,status:evaluated.status,sourceStage:model.status,noNewBody:true,noPhysicalStep:true};
});
await test('diamond rise is a closed independent source tape budget',()=>{
 const input={bodyTapeM:.45,easeM:.02,mainFraction:.68,gussetWidthM:.063},before=JSON.stringify(input),r=allocateDiamondRise(input);close(r.remainingMainRiseM+r.gussetHeightM,.47);close(r.budgetResidualM,0);close(r.gussetCutEdgeM,Math.hypot(r.gussetHeightM,.0315));assert.equal(r.hemMayMove,false);assert.equal(auditRiseBudget({...input,...r}).status,'BUDGET_VALID_ONLY');assert.equal(auditRiseBudget({...input,...r,gussetHeightM:r.gussetHeightM+.001}).status,'HOLD');assert.equal(JSON.stringify(input),before);
});
await test('source path bound proves only a necessary endpoint-distance condition',()=>{
 const base={sourcePath2D:[[0,0],[.3,0],[.3,.1]],targetA:[0,0,0],targetB:[.45,0,0]},bad=auditSourcePathBound(base);assert.equal(bad.status,'GUIDE_SOURCE_LENGTH_CONTRADICTION');close(bad.sourceLengthM,.4);close(bad.maximumDistanceM,.42);assert.equal(auditSourcePathBound({...base,endpointSlackM:.04}).status,'NECESSARY_BOUND_ONLY');assert.equal(bad.sufficient,false);
});
await test('proper material hinge rotation preserves paper metric and endpoints without creating rest',()=>{
 const points=[[0,0,0],[.02,0,0],[0,.01,0]],a=points[0],b=points[1],original=JSON.stringify(points),rotated=rotateAboutMaterialHinge(points,a,b,Math.PI/3);assert.deepEqual(rotated[0],points[0]);rotated[1].forEach((x,k)=>close(x,points[1][k]));const r=evaluatePaperTriangle(paperTriangle(points.map(p=>p.slice(0,2))),rotated);close(r.principalStrain,0,1e-12);assert.ok(rotated[2][2]>0);close(rotated[2][1],.005);assert.equal(JSON.stringify(points),original);
});
const failed=results.filter(r=>!r.passed&&!r.skipped),skipped=results.filter(r=>r.skipped),source=await fs.readFile(new URL('../ShortsPaperSurfaceModel.mjs',import.meta.url)),report={schema:'shorts-paper-surface-independent-math-probe/v2',moduleSHA256:createHash('sha256').update(source).digest('hex'),passed:!failed.length,status:failed.length?'FAILED':skipped.length?'PASSED_AVAILABLE_TESTS_SAVED_EVIDENCE_SKIPPED':'ALL_TESTS_PASSED',savedEvidenceRequired:requireSavedEvidence,counts:{total:results.length,passed:results.filter(r=>r.passed).length,skipped:skipped.length,failed:failed.length},results,evidence,noNewBody:true,noSolverOrParameterScan:true,noBrowserOrMouse:true,productionSourceModified:false};
if(process.argv.includes('--report')){const target=new URL('../qa/shorts-paper-surface-independent-20261003-'+report.moduleSHA256.slice(0,12)+'.json',import.meta.url);await fs.mkdir(new URL('../qa/',import.meta.url),{recursive:true});await fs.writeFile(target,JSON.stringify(report,null,2),{flag:'wx'});}
console.log(JSON.stringify({moduleSHA256:report.moduleSHA256,status:report.status,savedEvidenceRequired:requireSavedEvidence,counts:report.counts,failed,skipped,evidence},null,2));if(failed.length)process.exitCode=1;
