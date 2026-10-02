/* One actual native subject, source-paper manufacturing only. No body-contact,
 * native cloth steps, scans, browser input or publication. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {registerHooks} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {createShortsGarmentDraft} from '../ShortsGarmentDraft.mjs';
import {createShortsManufacturingDraft} from '../ShortsManufacturingDraft.mjs';
const base=fileURLToPath(new URL('../',import.meta.url)),hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
registerHooks({resolve(s,c,next){return s==='three'?{url:pathToFileURL(resolve(base,'vendor/three.module.js')).href,shortCircuit:true}:next(s,c);}});
const [THREE,{decodeParameters},{createSubject},{createShortsBodyAdapter}]=await Promise.all([import('three'),import('../parameter-codec.mjs'),import('../SubjectRuntime.mjs'),import('../ShortsBodyAdapter.mjs')]);
const bytes=gunzipSync(readFileSync(resolve(base,'parameters.phf.gz'))),data=decodeParameters(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),actor=new THREE.Group(),subject=createSubject(data,{edgeMetres:.012});actor.add(subject.root);actor.updateMatrixWorld(true);subject.finishPose();
const body=createShortsBodyAdapter(subject,actor,{waistDropM:.055}),beforeSubject=hash({phase:subject.phase,rig:subject.data.rig,revision:body.snapshot().revision}),existing=createShortsGarmentDraft(body.measurements,{sectionAt:body.sectionAt,sagittalAtY:body.sagittalAtY}),beforeInput=hash(existing),d=createShortsManufacturingDraft(existing);
assert.equal(hash(existing),beforeInput,'Manufacturing may not mutate the previous failed candidate');
assert.deepEqual(Array.from(d.sourceUV),Array.from(existing.sourceUV));assert.deepEqual(Array.from(d.triangles),Array.from(existing.triangles));assert.deepEqual(Array.from(d.masses),Array.from(existing.masses));assert.deepEqual(d.seams,existing.seams);
const canonicalText=readFileSync(resolve(base,'tools/source-shorts/ShortsPattern.js'),'utf8'),canonical=runInNewContext(canonicalText+'\ncreateShortsPattern(inputMeasurements,inputDesign)',{inputMeasurements:existing.receipt.measurements,inputDesign:existing.receipt.design}),sourceRecord=p=>p.pieces.map(piece=>({id:piece.id,uv:piece.materialCoordinates,triangles:piece.triangles,boundaries:piece.boundaries})),sourceDigest=hash(sourceRecord(d));
assert.equal(hash(canonicalText),d.receipt.paperSource.sha256);assert.equal(sourceDigest,hash(sourceRecord(canonical)));assert.equal(sourceDigest,hash(sourceRecord(existing)));
assert.equal(d.positions.length,553*3);assert.equal(d.seamGroups.length,553);assert.equal(d.targetSourceSeamGroups.length,451);assert(d.positions.every(Number.isFinite));assert(d.quotientMap.every((v,i)=>v===i));assert.equal(d.activeSeamIDs.length,0);assert.equal(d.activeElasticEdgeIndices.length,0);
const independentRigid={};let worstRelativeEdgeError=0,maximumPrincipalStrain=0,totalArea=0;const expectedMass=new Float64Array(553);
for(const piece of d.pieces){
 const off=d.ranges.find(r=>r.pieceId===piece.id).offset;let maximumEdgeErrorM=0,maximumRelativeEdgeError=0,principal=0;
 for(const ids of piece.triangles){
  const uv=ids.map(i=>piece.materialCoordinates[i]),xyz=ids.map(i=>Array.from(d.positions.subarray((off+i)*3,(off+i)*3+3)));
  for(let k=0;k<3;k++){const j=(k+1)%3,a=Math.hypot(...uv[k].map((v,l)=>v-uv[j][l])),b=Math.hypot(...xyz[k].map((v,l)=>v-xyz[j][l])),error=Math.abs(a-b);maximumEdgeErrorM=Math.max(maximumEdgeErrorM,error);maximumRelativeEdgeError=Math.max(maximumRelativeEdgeError,error/a);}
  const [a,b,c]=uv,u1=b[0]-a[0],v1=b[1]-a[1],u2=c[0]-a[0],v2=c[1]-a[1],det=u1*v2-u2*v1,ab=xyz[1].map((v,k)=>v-xyz[0][k]),ac=xyz[2].map((v,k)=>v-xyz[0][k]),fu=ab.map((v,k)=>(v*v2-ac[k]*v1)/det),fv=ab.map((v,k)=>(ac[k]*u1-v*u2)/det),dot=(x,y)=>x.reduce((s,v,k)=>s+v*y[k],0),x=dot(fu,fu),y=dot(fu,fv),z=dot(fv,fv),disc=Math.hypot(x-z,2*y),min=Math.sqrt(Math.max(0,(x+z-disc)/2)),max=Math.sqrt(Math.max(0,(x+z+disc)/2));
  principal=Math.max(principal,Math.abs(min-1),Math.abs(max-1));const area=Math.abs(det)/2;totalArea+=area;ids.forEach(i=>expectedMass[off+i]+=area*d.densityKgM2/3);
 }
 assert(maximumRelativeEdgeError<1e-10);assert(principal<1e-9);independentRigid[piece.id]={maximumEdgeErrorM,maximumRelativeEdgeError,maxAbsPrincipalStrain:principal};worstRelativeEdgeError=Math.max(worstRelativeEdgeError,maximumRelativeEdgeError);maximumPrincipalStrain=Math.max(maximumPrincipalStrain,principal);
}
expectedMass.forEach((v,i)=>assert(Math.abs(v-d.masses[i])<1e-15));assert(Math.abs(totalArea*d.densityKgM2-d.masses.reduce((s,m)=>s+m,0))<1e-12);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],point=i=>Array.from(d.positions.subarray(i*3,i*3+3)),lengthBetween=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k])),normals={};
for(const piece of d.pieces.filter(p=>p.kind==='leg-panel')){
 const off=d.ranges.find(r=>r.pieceId===piece.id).offset,[a,b,c]=piece.triangles[0].map(i=>point(off+i)),n=cross(b.map((v,k)=>v-a[k]),c.map((v,k)=>v-a[k])),len=Math.hypot(...n);normals[piece.id]=n.map(v=>v/len);
}
const measuredNonCoplanarity=['F','B'].map(prefix=>({sourceCenterSeamID:prefix==='F'?'center-front':'center-back',normalCrossLength:Math.hypot(...cross(normals[prefix+'L'],normals[prefix+'R']))}));
measuredNonCoplanarity.forEach(p=>assert(p.normalCrossLength>.01,'A rigid source seed must leave the common-plane invariant subspace'));
let actualGSeamGapMinM=Infinity,actualGSeamGapMaxM=0;
for(const seam of d.seams.filter(s=>s.id.startsWith('gusset-')))for(const {a,b} of seam.pairs){const gap=lengthBetween(point(a),point(b));actualGSeamGapMinM=Math.min(actualGSeamGapMinM,gap);actualGSeamGapMaxM=Math.max(actualGSeamGapMaxM,gap);assert(Math.abs(gap-d.material.fullThicknessM)<1e-12);}
const originalRigid=i=>{const range=existing.ranges.find(r=>i>=r.offset&&i<r.offset+r.count),piece=existing.pieces.find(p=>p.id===range.pieceId),uv=piece.materialCoordinates[i-range.offset],p=piece.placement;return p.origin.map((v,k)=>v+p.basisU[k]*uv[0]+p.basisV[k]*uv[1]);};
let waistbandParentGapPreservationErrorM=0;for(const seam of d.seams.filter(s=>s.id.startsWith('waist-')))for(const {a,b} of seam.pairs){const error=Math.abs(lengthBetween(point(a),point(b))-lengthBetween(originalRigid(a),originalRigid(b)));waistbandParentGapPreservationErrorM=Math.max(waistbandParentGapPreservationErrorM,error);assert(error<1e-12);}
const foldSeedProof={authority:'independent actual position normals and source-pair gap distances',measuredNonCoplanarity,actualGSeamGapMinM,actualGSeamGapMaxM,waistbandParentGapPreservationErrorM,selfContactValidated:false};
const ids=d.sewingStages.flatMap(s=>s.sourceSeamIDs);assert.equal(new Set(ids).size,19);assert.equal(ids.length,19);assert.deepEqual(new Set(ids),new Set(d.seams.map(s=>s.id)));
const stageQuotients=[];
for(const stage of d.sewingStages){
 const parent=Array.from({length:553},(_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));for(const seam of d.seams)if(stage.cumulativeSourceSeamIDs.includes(seam.id))for(const {a,b} of seam.pairs)parent[find(b)]=find(a);
 const count=new Set(parent.map((_,i)=>find(i))).size;assert.equal(count,stage.sourceQuotientDofs);stageQuotients.push({stage:stage.id,sourceSeamIDs:stage.sourceSeamIDs,actualIndependentDofs:count});
}
const badBasis=structuredClone(existing);badBasis.pieces[0].placement.basisU=[2,0,0];assert.throws(()=>createShortsManufacturingDraft(badBasis),/isometric/);
const badMass={...existing,masses:Float64Array.from(existing.masses)};badMass.masses[0]=0;assert.throws(()=>createShortsManufacturingDraft(badMass),/positive/);
const badUV={...existing,sourceUV:Float64Array.from(existing.sourceUV)};badUV.sourceUV[0]+=.001;assert.throws(()=>createShortsManufacturingDraft(badUV),/UV mismatch/);
const badSeams={...existing,seams:structuredClone(existing.seams)};badSeams.seams[18].id=badSeams.seams[0].id;assert.throws(()=>createShortsManufacturingDraft(badSeams),/nineteen canonical/);
assert.equal(hash({phase:subject.phase,rig:subject.data.rig,revision:body.snapshot().revision}),beforeSubject,'Source-only authoring must not advance the native subject');
const report={version:'r008-actual-independent-manufacturing-source-probe@1',capturedAt:new Date().toISOString(),mouseUsed:false,scope:'one actual fresh R008 generated eight-influence neutral subject; no dynamics/body contact/visual acceptance',actualNativeSubject:{surface:subject.surface.report,measurements:body.measurements,unchanged:true},sourceSHA256:{canonical:d.receipt.paperSource.sha256,freshPaper:sourceDigest,independentCanonical:hash(sourceRecord(canonical)),previousFailedCandidate:hash(sourceRecord(existing))},originalCandidateUnchanged:true,restUVTrianglesMassUnchanged:true,massKg:d.masses.reduce((s,m)=>s+m,0),areaM2:totalArea,sourceCounts:d.manufacturingReceipt.sourceCounts,independentRigid:{byPiece:independentRigid,worstRelativeEdgeError,maximumPrincipalStrain},foldSeedProof,stages:stageQuotients,negativeGuards:4,receipt:d.manufacturingReceipt,clothDynamicsValidated:false,bodyFitValidated:false,motionValidated:false,visualAcceptance:false,productionReady:false,sourceHashes:['ShortsGarmentDraft.mjs','ShortsManufacturingDraft.mjs','tools/probe-shorts-manufacturing.mjs'].map(path=>({path,sha256:hash(readFileSync(resolve(base,path),'utf8'))}))};
mkdirSync(resolve(base,'qa'),{recursive:true});writeFileSync(resolve(base,'qa/shorts-manufacturing-probe.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({sourceCounts:report.sourceCounts,sourceSHA256:report.sourceSHA256,massKg:report.massKg,independentRigid:report.independentRigid,foldSeedProof,stages:report.stages,negativeGuards:report.negativeGuards,clothDynamicsValidated:false},null,2));
