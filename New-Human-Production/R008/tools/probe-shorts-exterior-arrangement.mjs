import {registerHooks} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const base=new URL('../',import.meta.url);
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('vendor/three.module.js',base).href,shortCircuit:true}:next(s,c);}});
const [THREE,{decodeParameters},{createSubject},{createShortsBodyAdapter},{createShortsGarmentDraft},{createShortsManufacturingDraft},{sewShortsSource},{projectManufacturingPaper}]=await Promise.all([import('three'),import('../parameter-codec.mjs'),import('../SubjectRuntime.mjs'),import('../ShortsBodyAdapter.mjs'),import('../ShortsGarmentDraft.mjs'),import('../ShortsManufacturingDraft.mjs'),import('../ShortsSewingAssembly.mjs'),import('../ShortsManufacturingMetric.mjs')]);
const bytes=gunzipSync(readFileSync(new URL('parameters.phf.gz',base))),data=decodeParameters(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),actor=new THREE.Group(),scene=new THREE.Scene(),subject=createSubject(data,{edgeMetres:.012});scene.add(actor);actor.add(subject.root);actor.updateMatrixWorld(true);subject.finishPose();
const body=createShortsBodyAdapter(subject,actor),draft=createShortsGarmentDraft(body.measurements,{sectionAt:body.sectionAt,sagittalAtY:body.sagittalAtY}),source=createShortsManufacturingDraft(draft),partial=await sewShortsSource(source,body,actor,scene,()=>{},null,{stopAfter:'leg-sides-and-left-closure'}),cloth=partial.cloth;
if(partial.status!=='partial'||cloth.positions.length!==491||cloth.activeSeams.length!==11)throw Error('The eleven-source-seam parent must pass before exterior arrangement');
body.update({time:0,exactRefit:true});const identity=cloth.materialIdentity(),range=new Map(draft.ranges.map(r=>[r.pieceId,r]));
// Pants waist is the MAIN r0 loop. At this stage the independent W panels
// have no attachment, so their upper edges cannot pull the pants waist.
const selected=[];for(const id of ['FL','FR','BR','BL'])for(let c=0;c<=7;c++)selected.push(range.get(id).offset+c);
for(const[f,b]of [['FL','BL'],['FR','BR']]){for(let c=0;c<=7;c++)selected.push(range.get(f).offset+104+c);for(let c=6;c>=1;c--)selected.push(range.get(b).offset+104+c);}
const seen=new Set(),handles=[];for(const original of selected){const id=cloth.quotient[original];if(seen.has(id))continue;seen.add(id);handles.push({id,original,start:[...cloth.positions[id]],target:Array.from(draft.positions.subarray(original*3,original*3+3)),lambda:0});}
if(handles.length!==56)throw Error('The pants main waist and leg loops must contain fifty-six unique shared DOFs; actual '+handles.length);
const trace=[],before=cloth.audit(true),h=cloth.options.fixedDt,start=performance.now(),gap=()=>Math.max(0,...handles.map(e=>Math.hypot(...cloth.positions[e.id].map((v,k)=>v-e.target[k]))));
for(let pass=1;pass<=200;pass++){
 const progress=Math.min(1,pass/80);for(const e of handles)e.lambda=0;for(const e of cloth.edges)e.lambda=0;
 for(let sweep=0;sweep<8;sweep++){
  for(const e of handles){const p=cloth.positions[e.id],target=e.start.map((v,k)=>v+(e.target[k]-v)*progress),delta=p.map((v,k)=>v-target[k]),length=Math.hypot(...delta),C=length-.004;if(C<=0||length<1e-12)continue;const alpha=.01/(h*h),dl=-(C+alpha*e.lambda)/(cloth.invMass[e.id]+alpha);e.lambda+=dl;for(let k=0;k<3;k++)p[k]+=cloth.invMass[e.id]*dl*delta[k]/length;}
  for(const e of cloth.edges)cloth.solveDistance(e,h);for(const t of cloth.triangles)projectManufacturingPaper(cloth,t);
 }
 // Body is ONLY a read-only exterior measurement. No deep projection,
 // native time, self-contact teleport or final waist quotient is performed.
 if(pass%10===0){const a=cloth.audit(true);trace.push({pass,mainStrain:a.mainStrain,bodyPointAndCentroidPenetrationM:a.bodyPenetrationM,sourceLoopTargetGapM:gap(),finite:a.finite});if(!a.finite||(pass>=80&&a.manufacturingMaterialValid&&a.bodyPenetrationM<=.001&&gap()<=.008))break;}
}
const after=cloth.audit(true);if(identity!==cloth.materialIdentity())throw Error('Exterior arrangement changed paper/rest/mass');
const report={createdAt:new Date().toISOString(),scope:'second bounded wearing authoring: legal eleven-seam parent, actual MAIN waist/hem boundary targets, read-only body exterior; no final waist closure or native dynamics',sourceHashes:Object.fromEntries(['ShortsGarmentDraft.mjs','ShortsSewingAssembly.mjs','ShortsClothRuntime.mjs'].map(n=>[n,createHash('sha256').update(readFileSync(new URL(n,base))).digest('hex')])),before,trace,after,elapsedMs:performance.now()-start,actualParentDofs:491,actualSourceSeams:11,sourceHandleIndices:handles.map(e=>e.original),sourceRestMassUnchanged:true,bodyProjectionEnabled:false,bodyAuditScope:'points and centroids; full triangle exterior/self/path not certified',waistStagePerformed:false,motionSteps:0,positions:cloth.positions.map(p=>[...p]),sourceLoopTargetGapM:gap(),numericExteriorPassed:after.manufacturingMaterialValid&&after.bodyPenetrationM<=.001&&gap()<=.008,strictContactValidated:false,motionValidated:false,productionReady:false};
writeFileSync(new URL('qa/shorts-v2-exterior-arrangement-20261002.json',base),JSON.stringify(report,null,2));console.log(JSON.stringify({numericExteriorPassed:report.numericExteriorPassed,trace,after:{strain:after.mainStrain,penetrationM:after.bodyPenetrationM},targetGapM:gap(),finalWaistPerformed:false,motionValidated:false}));cloth.dispose();
