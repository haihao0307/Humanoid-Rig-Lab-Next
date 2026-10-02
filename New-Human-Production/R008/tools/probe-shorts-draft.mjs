/* Independent Node source/measurement/force-contract probe. No browser, GPU,
 * native solver scans, desktop input, garment mesh preload or publication. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {registerHooks,createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {createShortsGarmentDraft,evaluateElasticWaistEdge} from '../ShortsGarmentDraft.mjs';
const base=fileURLToPath(new URL('../',import.meta.url));
registerHooks({resolve(s,c,next){return s==='three'?{url:pathToFileURL(resolve(base,'vendor/three.module.js')).href,shortCircuit:true}:next(s,c);}});
const require=createRequire(import.meta.url),{auditSource}=require(resolve(base,'tools/source-shorts/full-shorts-contract.cjs'));
const receipts=[];
function principalInitialMaterial(d){
 const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),byPiece={};let worst=null,degenerate3D=0;
 for(const piece of d.pieces){const offset=d.ranges.find(r=>r.pieceId===piece.id).offset;let result={pieceId:piece.id,maxAbsPrincipalStrain:0,worstTriangle:null};
  piece.triangles.forEach((ids,index)=>{const p=ids.map(i=>Array.from(d.positions.subarray((offset+i)*3,(offset+i)*3+3))),uv=ids.map(i=>piece.materialCoordinates[i]),A=p[1].map((v,k)=>v-p[0][k]),B=p[2].map((v,k)=>v-p[0][k]),u1=uv[1][0]-uv[0][0],v1=uv[1][1]-uv[0][1],u2=uv[2][0]-uv[0][0],v2=uv[2][1]-uv[0][1],det=u1*v2-u2*v1,Fu=A.map((v,k)=>(v*v2-B[k]*v1)/det),Fv=B.map((v,k)=>(v*u1-A[k]*u2)/det),a=dot(Fu,Fu),b=dot(Fu,Fv),c=dot(Fv,Fv),disc=Math.hypot(a-c,2*b),minimumStretch=Math.sqrt(Math.max(0,(a+c-disc)/2)),maximumStretch=Math.sqrt(Math.max(0,(a+c+disc)/2)),strain=Math.max(Math.abs(1-minimumStretch),Math.abs(maximumStretch-1));
   if(minimumStretch<1e-8)degenerate3D++;if(strain>result.maxAbsPrincipalStrain)result={pieceId:piece.id,maxAbsPrincipalStrain:strain,worstTriangle:{localTriangleIndex:index,localIndices:ids,sourceRows:piece.grid?ids.map(i=>Math.floor(i/(piece.grid.columns+1))):null,minimumStretch,maximumStretch,sourceUV:uv,actualPositions:p}};
  });byPiece[piece.id]=result;if(!worst||result.maxAbsPrincipalStrain>worst.maxAbsPrincipalStrain)worst=result;
 }
 return {authority:'independent principal stretches of fresh source2D triangles versus one temporary authoring placement',byPiece,worst,degenerate3D,initialPlacementWithinFivePercent:worst.maxAbsPrincipalStrain<=.05,finalPhysicsValidated:false};
}
function checkDraft(d){
 assert.equal(d.positions.length,553*3);assert.equal(d.sourceUV.length,553*2);assert.equal(d.triangles.length,848*3);assert.equal(d.pieces.length,9);assert.equal(d.seams.length,19);assert(d.positions.every(Number.isFinite));assert(d.sourceUV.every(Number.isFinite));assert(d.masses.every(x=>x>0));
 const sourceAudit=auditSource(d.pattern);assert.equal(sourceAudit.valid,true);
 for(const seam of d.seams)for(const p of seam.pairs){assert.equal(d.quotientMap[p.a],d.quotientMap[p.b]);for(let k=0;k<3;k++)assert.equal(d.positions[p.a*3+k],d.positions[p.b*3+k]);}
 const expected=new Float64Array(553);let area=0;
 for(let t=0;t<d.triangles.length;t+=3){const ids=Array.from(d.triangles.subarray(t,t+3)),uv=ids.map(i=>Array.from(d.sourceUV.subarray(i*2,i*2+2))),[a,b,c]=uv,triangleArea=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;assert(triangleArea>0);area+=triangleArea;for(const i of ids)expected[i]+=triangleArea*d.densityKgM2/3;}
 expected.forEach((v,i)=>assert(Math.abs(v-d.masses[i])<1e-15));assert(Math.abs(area*d.densityKgM2-d.receipt.massKg)<1e-12);
 assert.equal(d.elasticEdges.length,28);assert.equal(new Set(d.elasticEdges.map(e=>d.quotientMap[e.a])).size,28);const rest=d.elasticEdges.reduce((s,e)=>s+e.restLengthM,0);assert(Math.abs(rest-d.receipt.elastic.restCircumferenceM)<1e-12);
 for(let i=0;i<28;i++){const e=d.elasticEdges[i],next=d.elasticEdges[(i+1)%28];assert.equal(d.quotientMap[e.b],d.quotientMap[next.a]);assert(e.compliance>0&&Number.isFinite(e.compliance));assert.equal(e.compliance,e.restLengthM/e.axialRigidityN);assert.equal(d.pieces.find(p=>d.ranges.some(r=>r.pieceId===p.id&&e.a>=r.offset&&e.a<r.offset+r.count)).kind,'waistband');}
 const e=d.elasticEdges[0],materialTest=new Float64Array(553*3);materialTest[e.b*3]=e.restLengthM*.8;assert.equal(evaluateElasticWaistEdge(e,materialTest).tensionN,0);materialTest[e.b*3]=e.restLengthM*1.1;assert(Math.abs(evaluateElasticWaistEdge(e,materialTest).tensionN-10)<1e-10);materialTest[e.b*3]=e.restLengthM*1.4;assert.equal(evaluateElasticWaistEdge(e,materialTest).withinDeclaredElasticDomain,false);
 assert.equal(d.material.linenMaximumPrincipalStrain,.05);assert.equal(d.receipt.sourceRestAuthority,'new two-dimensional paper before three-dimensional placement');assert.equal(d.receipt.bodyFitValidated,false);assert.equal(d.receipt.motionValidated,false);assert.equal(d.receipt.productionReady,false);
 const upper=Array.from(d.waistIndices,i=>d.positions[i*3+1]);assert(Math.max(...upper)-Math.min(...upper)<1e-12);assert(Math.abs(upper[0]-d.receipt.upperY)<1e-12);
 const gp=d.pieces.find(p=>p.id==='G'),go=d.ranges.find(r=>r.pieceId==='G').offset;
 for(let i=0;i<9;i++)for(let j=i+1;j<9;j++){
  const uvLength=Math.hypot(...gp.materialCoordinates[i].map((v,k)=>v-gp.materialCoordinates[j][k]));
  const xyzLength=Math.hypot(...[0,1,2].map(k=>d.positions[(go+i)*3+k]-d.positions[(go+j)*3+k]));
  assert(Math.abs(uvLength-xyzLength)<1e-12,'Rigid source G initialization must not turn source half-width into vertical separation');
 }
 return {sourceAudit,massKg:d.receipt.massKg,areaM2:area,upperY:d.receipt.upperY,lowerY:d.receipt.lowerY,dropM:d.receipt.waistDropM,casingWidthM:d.receipt.waistbandWidthM,elastic:d.receipt.elastic,quotientDofs:d.seamGroups.length};
}
function sourcePaperConstructionProof(d){
 const canonicalText=readFileSync(resolve(base,'tools/source-shorts/ShortsPattern.js'),'utf8'),canonical=createHash('sha256').update(canonicalText).digest('hex');
 assert.equal(canonical,d.receipt.paperSource.sha256);
 const generate=(measurements,design)=>runInNewContext(canonicalText+'\ncreateShortsPattern(inputMeasurements,inputDesign)',{inputMeasurements:measurements,inputDesign:design}),paperDigest=p=>createHash('sha256').update(JSON.stringify(p.pieces.map(piece=>({id:piece.id,uv:piece.materialCoordinates,triangles:piece.triangles,boundaries:piece.boundaries})))).digest('hex'),currentDigest=paperDigest({pieces:d.pieces}),expectedDigest=paperDigest(generate(d.receipt.measurements,d.receipt.design));
 assert.equal(currentDigest,expectedDigest);
 const priorPath=resolve(base,'qa/shorts-draft-v1-14mm-source-paper-failed.json');let priorSourceDigest=null,priorMassKg=null,declaredRecipeChange=null;
 if(existsSync(priorPath)){
  const prior=JSON.parse(readFileSync(priorPath,'utf8')).actualGeneratedIndividual?.draftReceipt;
  if(prior){
   const oldPaper=generate(prior.measurements,prior.design);priorSourceDigest=paperDigest(oldPaper);priorMassKg=prior.massKg;
   assert.equal(d.receipt.gusset.sourceRecipeVersion,2);assert.equal(d.receipt.gusset.gapIsCutWidthConstraint,false);
   assert.equal(d.receipt.design.gussetWidth,.060*d.receipt.actualHeightM/d.receipt.gusset.referenceStatureM);
   assert.notEqual(currentDigest,priorSourceDigest,'User-authorized new recipe must reconstruct new source paper, not reuse old 14 mm material');
   // A regenerated character can change measured stature and consequently
   // every paper piece. Isolate the width repair under the SAME current body
   // measurements and design before asserting that only G changed.
   const sameInputOldWidthPaper=generate(d.receipt.measurements,{...d.receipt.design,gussetWidth:d.receipt.gusset.derivedClearGapM});
   const changedPieces=[];for(const piece of d.pieces){const old=sameInputOldWidthPaper.pieces.find(p=>p.id===piece.id);if(JSON.stringify(piece.materialCoordinates)!==JSON.stringify(old.materialCoordinates))changedPieces.push(piece.id);assert.equal(JSON.stringify(piece.triangles),JSON.stringify(old.triangles));assert.equal(JSON.stringify(piece.boundaries),JSON.stringify(old.boundaries));}
   assert.deepEqual(changedPieces,['G']);
   for(const s of d.pattern.seams){const old=sameInputOldWidthPaper.seams.find(x=>x.id===s.id);assert.equal(JSON.stringify(s.pairs),JSON.stringify(old.pairs));assert(Math.abs(s.restLengthA-old.restLengthA)<1e-12);assert(Math.abs(s.restLengthB-old.restLengthB)<1e-12);}
   declaredRecipeChange={authority:'user keeps Original A and authorizes Version B to retain original accepted R24 design width proportion with fresh actual R008 measurements',comparisonScope:'width-only repair under identical CURRENT measurements and all other design inputs; historical character geometry is not assumed equal',historicalMeasurementsMatched:JSON.stringify(prior.measurements)===JSON.stringify(d.receipt.measurements),changedSourcePieces:changedPieces,oldVersion:prior.version,newVersion:d.receipt.version,oldWidthM:prior.design.gussetWidth,newWidthM:d.receipt.design.gussetWidth,oldFrontHeightM:oldPaper.pieces.find(p=>p.id==='G').sourceContour.frontHeight,newFrontHeightM:d.pieces.find(p=>p.id==='G').sourceContour.frontHeight,oldBackHeightM:oldPaper.pieces.find(p=>p.id==='G').sourceContour.backHeight,newBackHeightM:d.pieces.find(p=>p.id==='G').sourceContour.backHeight,mainAndWaistPaperUnchangedUnderIdenticalInputs:true,allSourceSeamPairsAndFeedUnchangedUnderIdenticalInputs:true,massRegeneratedFromNew2DArea:true,oldFailurePreservedAt:priorPath,fullSimilarityToAcceptedGClaimed:false,physicsImprovementClaimed:false};
  }
 }
 return {canonicalSourceSHA256:canonical,currentSourcePaperSHA256:currentDigest,independentCanonicalRegenerationSHA256:expectedDigest,priorFailingSourcePaperSHA256:priorSourceDigest,priorMassKg,sourceRestAndMassUnchanged:currentDigest===priorSourceDigest,sourceRestChangedDuringPlacement:false,declaredRecipeChange,formed3DFeedback:false};
}
const ellipse=(cx,y,rx,rz)=>Array.from({length:128},(_,i)=>[cx+rx*Math.sin(i*2*Math.PI/128),y,rz*Math.cos(i*2*Math.PI/128)]);
const fixture={unit:'m',heightM:1.8,referenceWaist:{y:1.054},hip:{y:.89},crotchY:.80,thighs:{y:.75},sourceSurfaceScope:'TEST_FIXTURE_ONLY; analytic clothed-envelope sections'};
const sampleFixture=y=>({closed:true,contours:y<=.79?[-1,1].map(s=>({closed:true,points:ellipse(s*.105,y,.088,.091)})):[{closed:true,points:ellipse(0,y,.155+(1-y)*.045,.105+(1-y)*.015)}],authority:fixture.sourceSurfaceScope});
for(const drop of [.045,.055,.065]){const d=createShortsGarmentDraft(fixture,{sectionAt:sampleFixture,waistDropM:drop});receipts.push({scope:'TEST_FIXTURE_ONLY',...checkDraft(d)});}
assert.throws(()=>createShortsGarmentDraft(fixture,{sectionAt:sampleFixture,waistDropM:.02}));assert.throws(()=>createShortsGarmentDraft(fixture,{sectionAt:sampleFixture,elasticAxialRigidityN:Infinity}));assert.throws(()=>createShortsGarmentDraft({...fixture,hip:{y:1.03}},{sectionAt:sampleFixture}));assert.throws(()=>createShortsGarmentDraft(fixture,{sectionAt:sampleFixture,elasticReduction:.2}));
const materialHashes=['ShortsLinenMaterial.mjs','SubjectRuntime.mjs'].map(name=>({name,sha256:createHash('sha256').update(readFileSync(resolve(base,name))).digest('hex')}));
const report={version:'r008-low-rise-draft-source-probe@1',capturedAt:new Date().toISOString(),mouseUsed:false,sourceFixtureTests:receipts,negativeInputGuards:4,materialHashes,actualGeneratedIndividual:null,actualNativeDynamicsValidated:false,visualAcceptance:false,productionReady:false};
if(process.env.DRAFT_FIXTURE_ONLY!=='1')try{
 const [THREE,{decodeParameters},{createSubject},{createShortsBodyAdapter}]=await Promise.all([import('three'),import('../parameter-codec.mjs'),import('../SubjectRuntime.mjs'),import('../ShortsBodyAdapter.mjs')]);
 const bytes=gunzipSync(readFileSync(resolve(base,'parameters.phf.gz'))),data=decodeParameters(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),actor=new THREE.Group(),subject=createSubject(data,{edgeMetres:.012});actor.add(subject.root);actor.updateMatrixWorld(true);subject.finishPose();const body=createShortsBodyAdapter(subject,actor),m=body.measurements;
 report.actualGeneratedIndividual={scope:'fresh native R008 generated eight-influence subject; actual existing-clothing envelope',surface:subject.surface.report,bodyMeasurements:m};
 const before=JSON.stringify({phase:subject.phase,revision:body.snapshot().revision,rig:subject.data.rig}),sectionTrace=[];report.actualGeneratedIndividual.sectionTrace=sectionTrace;
 const readSection=(y,options)=>{const s=body.sectionAt(y,options);sectionTrace.push({y,partIds:options?.partIds??null,valid:s.valid,closed:s.closed,distinctLegs:s.distinctLegs??false,missingRays:s.missingRays,segmentCount:s.segmentCount,contourPointCounts:s.contours?.map(c=>c.points?.length)});return s;};
 if(process.env.DRAFT_DIAGNOSE_RISE==='1'){
  const lowerY=m.lowWaist.y-.038,points=Array.from({length:13},(_,i)=>body.sagittalAtY(i===12?m.crotchY:lowerY+(m.crotchY-lowerY)*i/12)),length=side=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(...p[side].map((v,k)=>v-points[i][side][k])),0);
  report.actualGeneratedIndividual.riseDiagnosis={purpose:'ROOT_CAUSE_REVIEW only: source sagittal path and end-point identity; no candidate or solve',points,frontRawLengthM:length('front'),backRawLengthM:length('back'),crotchPoint:m.crotchPoint,endpointDifference:{front:Math.hypot(...points.at(-1).front.map((v,k)=>v-m.crotchPoint[k])),back:Math.hypot(...points.at(-1).back.map((v,k)=>v-m.crotchPoint[k]))},depthM:lowerY-m.crotchY};
 }else if(process.env.DRAFT_DIAGNOSE_DOMAINS==='1'){
  const lowerY=m.lowWaist.y-.038,arithmeticEndpoint=lowerY+(m.crotchY-lowerY)*12/12;
  for(const y of [m.crotchY,arithmeticEndpoint])for(const parts of [null,[19,18,12],[9,1,26]])readSection(y,parts?{partIds:parts}:undefined);
  report.actualGeneratedIndividual.domainDiagnosis={purpose:'ROOT_CAUSE_REVIEW only; exact critical source plane and its numerical route endpoint; no candidate solve or parameter scan',exactCrotchY:m.crotchY,arithmeticEndpoint,differenceM:arithmeticEndpoint-m.crotchY};
 }else{const d=createShortsGarmentDraft(m,{sectionAt:readSection,sagittalAtY:body.sagittalAtY});Object.assign(report.actualGeneratedIndividual,{sourceChecks:checkDraft(d),draftReceipt:d.receipt,initialMaterial:principalInitialMaterial(d),sourcePaperConstructionProof:sourcePaperConstructionProof(d)});}
 report.actualGeneratedIndividual.subjectUnchanged=before===JSON.stringify({phase:subject.phase,revision:body.snapshot().revision,rig:subject.data.rig});assert(report.actualGeneratedIndividual.subjectUnchanged);
}catch(error){report.actualGeneratedIndividual={...report.actualGeneratedIndividual,sourceDraftPassed:false,failure:error.stack||String(error)};process.exitCode=1;}
const dir=resolve(base,'qa');mkdirSync(dir,{recursive:true});const receiptName=process.env.DRAFT_DIAGNOSE_RISE==='1'?'shorts-draft-rise-review.json':process.env.DRAFT_DIAGNOSE_DOMAINS==='1'?'shorts-draft-critical-domain-review.json':'shorts-draft-probe.json';writeFileSync(resolve(dir,receiptName),JSON.stringify(report,null,2));console.log(JSON.stringify({fixtureCases:receipts.length,actualPassed:!!report.actualGeneratedIndividual?.sourceChecks,actualFailure:report.actualGeneratedIndividual?.failure??null,sourceCounts:report.actualGeneratedIndividual?.draftReceipt?.sourceCounts,referenceY:report.actualGeneratedIndividual?.draftReceipt?.referenceY,upperY:report.actualGeneratedIndividual?.draftReceipt?.upperY,elastic:report.actualGeneratedIndividual?.draftReceipt?.elastic,massKg:report.actualGeneratedIndividual?.sourceChecks?.massKg,initialMaterial:report.actualGeneratedIndividual?.initialMaterial?{maximumPrincipalStrain:report.actualGeneratedIndividual.initialMaterial.worst.maxAbsPrincipalStrain,initialPlacementWithinFivePercent:report.actualGeneratedIndividual.initialMaterial.initialPlacementWithinFivePercent,finalPhysicsValidated:false}:null,sectionDomainReview:report.actualGeneratedIndividual?.domainDiagnosis?report.actualGeneratedIndividual.sectionTrace:null,riseDiagnosis:report.actualGeneratedIndividual?.riseDiagnosis},null,2));
