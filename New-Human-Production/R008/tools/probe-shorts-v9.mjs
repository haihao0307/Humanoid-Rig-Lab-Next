import {registerHooks} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const base=new URL('../',import.meta.url);
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('vendor/three.module.js',base).href,shortCircuit:true}:next(s,c);}});
const [THREE,{decodeParameters},{createSubject},{createShortsBodyAdapter},{installShortsBarePelvis},{createShortsGarmentDraft},{measureShortsSkinTapes},{createShortsGarmentV9},{ShortsClothRuntime},{createShortsSkinContactBody}]=await Promise.all([import('three'),import('../parameter-codec.mjs'),import('../SubjectRuntime.mjs'),import('../ShortsBodyAdapter.mjs'),import('../ShortsBarePelvis.mjs'),import('../ShortsGarmentDraft.mjs'),import('../ShortsBodyTape.mjs'),import('../ShortsGarmentV9.mjs'),import('../ShortsClothRuntime.mjs'),import('../ShortsSkinContactBody.mjs')]);
console.log('V9 actual native body construction');
const bytes=gunzipSync(readFileSync(new URL('parameters.phf.gz',base))),data=decodeParameters(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),actor=new THREE.Group(),scene=new THREE.Scene(),subject=createSubject(data,{edgeMetres:.012});
actor.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI);actor.position.z=3.51;scene.add(actor);actor.add(subject.root);actor.updateMatrixWorld(true);subject.finishPose();
const measured=createShortsBodyAdapter(subject,actor,{contactExcludedParts:[9,10,19]}),bare=installShortsBarePelvis(measured,subject,actor),body=createShortsSkinContactBody(measured,bare),old=createShortsGarmentDraft(measured.measurements,{sectionAt:measured.sectionAt,sagittalAtY:measured.sagittalAtY,waistbandWidthM:.038});
const sourceNames=['ShortsGarmentV9.mjs','ShortsGarmentDraft.mjs','ShortsBodyTape.mjs','ShortsInitialExteriorContour.mjs','ShortsSurfaceTransport.mjs','ShortsClothRuntime.mjs','ShortsWearingMetric.mjs','ShortsBarePelvis.mjs','ShortsBodyAdapter.mjs'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const report={schema:'r008-shorts-v9-actual/v1',createdAt:new Date().toISOString(),sourceSHA256:Object.fromEntries(sourceNames.map(n=>[n,hash(readFileSync(new URL(n,base)))])),parametersSHA256:hash(readFileSync(new URL('parameters.phf.gz',base))),passed:false,productionReady:false},start=performance.now();let cloth;
try{
 const tapes=measureShortsSkinTapes(measured,bare,actor,old.receipt),draft=createShortsGarmentV9(tapes,old,{skinBody:body});report.draft=draft.receipt;
 cloth=new ShortsClothRuntime(draft,body,actor,scene,{membraneModel:'orthotropic-paper',paperMaterial:{warpNPerM:2000,weftNPerM:1200,shearNPerM:300},bendTopology:'within-piece-flat'});cloth.enabled=false;
 report.initial=cloth.audit(false);console.log(JSON.stringify({initialStrain:report.initial.mainStrain,counts:draft.receipt.sourceCounts,seamTargetGapM:draft.receipt.maximumInitialSeamTargetGapM}));
 report.initialSourceReference={sourceUV:Array.from(draft.sourceUV),triangles:Array.from(draft.triangles),mass:Array.from(draft.masses),ranges:draft.ranges,seams:draft.seams,sourceXYZ:Array.from({length:draft.sourceUV.length/2},(_,i)=>cloth.positions[cloth.quotient[i]].slice()),frame:'runtime WORLD, one common actor fixture',restFromXYZ:false};
 if(process.argv.includes('--coupled')){const {solveShortsWearingMetric}=await import('../ShortsWearingMetric.mjs');report.assembly=await solveShortsWearingMetric(cloth,{onProgress:s=>console.log(JSON.stringify({iteration:s.iteration,fraction:s.acceptedFraction,strain:s.actualAcceptedAudit?.mainStrain,contact:s.actualAcceptedAudit?.maximumSampledClearanceDeficitM}))});}
 else if(!process.argv.includes('--initial-only')){const {prepareShortsWearV9}=await import('../ShortsWearV9.mjs');report.assembly=await prepareShortsWearV9(cloth,{onProgress:s=>console.log(JSON.stringify(s))});}
 report.final=cloth.audit(true);report.passed=report.final.numericValid;
}catch(e){report.failure={message:e.message,stack:e.stack,details:e.details};console.log(JSON.stringify(report.failure));process.exitCode=1;}
report.elapsedMs=performance.now()-start;mkdirSync(new URL('qa/',base),{recursive:true});const mode=process.argv.includes('--initial-only')?'initial':process.argv.includes('--coupled')?'coupled':'wear',file='shorts-v9-'+mode+'-'+Date.now()+'.json';writeFileSync(new URL('qa/'+file,base),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({reportFile:file,passed:report.passed,elapsedMs:report.elapsedMs,failure:report.failure?.message,finalStrain:report.final?.mainStrain,stop:report.assembly?.stopReason}));cloth?.dispose();bare.dispose();
