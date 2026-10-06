import {registerHooks} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const base=new URL('../',import.meta.url);
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('vendor/three.module.js',base).href,shortCircuit:true}:next(s,c);}});
const [THREE,{decodeParameters},{createSubject},{createShortsBodyAdapter},{createShortsGarmentDraft},{createShortsManufacturingDraft},{ShortsClothRuntime}]=await Promise.all([import('three'),import('../parameter-codec.mjs'),import('../SubjectRuntime.mjs'),import('../ShortsBodyAdapter.mjs'),import('../ShortsGarmentDraft.mjs'),import('../ShortsManufacturingDraft.mjs'),import('../ShortsClothRuntime.mjs')]);
const bytes=gunzipSync(readFileSync(new URL('parameters.phf.gz',base))),data=decodeParameters(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),actor=new THREE.Group(),scene=new THREE.Scene(),subject=createSubject(data,{edgeMetres:.012});scene.add(actor);actor.add(subject.root);actor.updateMatrixWorld(true);subject.finishPose();
const body=createShortsBodyAdapter(subject,actor),draft=createShortsGarmentDraft(body.measurements,{sectionAt:body.sectionAt,sagittalAtY:body.sagittalAtY}),source=createShortsManufacturingDraft(draft),stages=[];
const immutable=d=>JSON.stringify({uv:Array.from(d.sourceUV),triangles:Array.from(d.triangles),mass:Array.from(d.masses),seams:d.seams});const sourceIdentity=immutable(source);let positions=source.positions;
for(const stage of source.sewingStages){
 const cloth=new ShortsClothRuntime({...source,positions},body,actor,scene,{activeSeamIDs:stage.cumulativeSourceSeamIDs,elasticEnabled:false}),start=performance.now(),before=cloth.audit(false),identity=cloth.materialIdentity(),trace=[];
 for(let pass=1;pass<=200;pass++){
  for(const e of cloth.edges)e.lambda=0;
  for(let sweep=0;sweep<2;sweep++)for(const e of cloth.edges)cloth.solveDistance(e,cloth.options.fixedDt);
  if(pass%10===0){const a=cloth.audit(false);trace.push({pass,mainStrain:a.mainStrain,finite:a.finite});if(a.manufacturingMaterialValid||!a.finite)break;}
 }
 const after=cloth.audit(false),paperUnchanged=identity===cloth.materialIdentity()&&sourceIdentity===immutable(source),seamGapM=Math.max(0,...cloth.activeSeams.flatMap(s=>s.pairs.map(p=>{const a=cloth.positions[cloth.quotient[p.a]],b=cloth.positions[cloth.quotient[p.b]];return Math.hypot(...a.map((v,k)=>v-b[k]));}))),valid=after.manufacturingMaterialValid&&paperUnchanged&&seamGapM<=.0001&&cloth.positions.length===stage.sourceQuotientDofs;
 stages.push({id:stage.id,seams:stage.cumulativeSourceSeamIDs,dofs:cloth.positions.length,before,trace,after,seamGapM,paperUnchanged,bodyContactEnabled:false,elasticActivated:false,actualMotionSteps:cloth.steps,elapsedMs:performance.now()-start,valid});
 positions=new Float64Array(553*3);for(let i=0;i<553;i++)positions.set(cloth.positions[cloth.quotient[i]],i*3);cloth.dispose();if(!valid)break;
}
const sourceHashes=Object.fromEntries(['ShortsManufacturingDraft.mjs','ShortsClothRuntime.mjs'].map(n=>[n,createHash('sha256').update(readFileSync(new URL(n,base))).digest('hex')])),report={createdAt:new Date().toISOString(),scope:'real source-paper manufacture with progressively activated original seams; no body contacts/tape/native dynamics; not a wearing acceptance',sourceHashes,initial:source.manufacturingReceipt,stages,manufacturingMaterialPassed:stages.length===4&&stages.every(s=>s.valid),selfContactValidated:false,bodyFitValidated:false,motionValidated:false,productionReady:false};mkdirSync(new URL('qa/',base),{recursive:true});writeFileSync(new URL('qa/shorts-staged-sewing-probe-20261002.json',base),JSON.stringify(report,null,2));console.log(JSON.stringify({manufacturingMaterialPassed:report.manufacturingMaterialPassed,stages:stages.map(s=>({id:s.id,dofs:s.dofs,valid:s.valid,before:s.before.mainStrain,after:s.after.mainStrain,seamGapM:s.seamGapM,trace:s.trace,elapsedMs:s.elapsedMs,worst:s.after.worstMaterialTriangle})),bodyFitValidated:false},null,2));
