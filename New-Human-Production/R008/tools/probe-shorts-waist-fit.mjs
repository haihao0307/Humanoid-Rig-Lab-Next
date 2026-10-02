import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {registerHooks} from 'node:module';
import {createHash} from 'node:crypto';
import {resolveShortsWaistFit,SHORTS_WAIST_REFERENCE} from '../ShortsWaistFit.mjs';
import {createShortsGarmentDraft} from '../ShortsGarmentDraft.mjs';
const base=new URL('../',import.meta.url);
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('vendor/three.module.js',base).href,shortCircuit:true}:next(s,c);}});
const [THREE,{decodeParameters},{createSubject},{createShortsBodyAdapter},{GameAnimator},{CharacterController}]=await Promise.all([import('three'),import('../parameter-codec.mjs'),import('../SubjectRuntime.mjs'),import('../ShortsBodyAdapter.mjs'),import('../GameAnimator.mjs'),import('../CharacterController.mjs')]);
const bytes=gunzipSync(readFileSync(new URL('parameters.phf.gz',base))),data=decodeParameters(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const subject=createSubject(data,{edgeMetres:.012}),actor=new THREE.Group();actor.add(subject.root);actor.updateMatrixWorld(true);subject.finishPose();
const animator=new GameAnimator(subject,actor),controller=new CharacterController();animator.update(controller,1/240);actor.updateMatrixWorld(true);
const state=()=>JSON.stringify({rig:subject.data.rig,phase:subject.phase,pose:[...subject.byName.values()].map(b=>[b.position.toArray(),b.quaternion.toArray()])}),before=state();
const legacyBody=createShortsBodyAdapter(subject,actor,{waistDropM:.055}),body=createShortsBodyAdapter(subject,actor);
const legacy=createShortsGarmentDraft(legacyBody.measurements,{sectionAt:legacyBody.sectionAt,sagittalAtY:legacyBody.sagittalAtY,waistDropM:.055}),draft=createShortsGarmentDraft(body.measurements,{sectionAt:body.sectionAt,sagittalAtY:body.sagittalAtY});
const reference=SHORTS_WAIST_REFERENCE,expectedRatio=(reference.upperWaistSourceY-reference.forearmMidpointSourceY)/reference.statureM;
assert(Math.abs(draft.receipt.waistDropM/body.measurements.heightM-expectedRatio)<1e-14);
assert(draft.receipt.upperY<legacy.receipt.upperY,'New waist must go down relative to the earlier 55mm candidate');
assert(Math.abs(body.measurements.lowWaist.y-draft.receipt.upperY)<1e-12,'Body measurement and paper must use the same waist target');
assert(Math.abs(draft.receipt.hem.y-legacy.receipt.hem.y)<1e-7,'Waist edit must preserve leg hem position');
assert.equal(draft.receipt.design.inseamLength,legacy.receipt.design.inseamLength);
let maxHemMovementM=0;
for(const piece of draft.pieces.filter(p=>p.kind==='leg-panel')){
 const range=draft.ranges.find(r=>r.pieceId===piece.id),old=legacy.ranges.find(r=>r.pieceId===piece.id);
 for(const i of piece.boundaries.hem)for(let k=0;k<3;k++)maxHemMovementM=Math.max(maxHemMovementM,Math.abs(draft.positions[(range.offset+i)*3+k]-legacy.positions[(old.offset+i)*3+k]));
}
assert(maxHemMovementM<1e-7,'All actual hem vertices must stay fixed under this waist-only edit');
assert.deepEqual(draft.receipt.sourceCounts,{pieces:9,particles:553,triangles:848,seams:19,quotientDofs:451});
assert.equal(draft.casing.finishedWidthM,.038);assert.equal(draft.elasticEdges.length,28);assert(draft.elasticEdges.every(e=>e.compliance>0));
assert.equal(state(),before,'Measuring and drafting must not move the subject or change its rig');
const referenceDrop=reference.upperWaistSourceY-reference.forearmMidpointSourceY;
assert(Math.abs(resolveShortsWaistFit({heightM:reference.statureM}).waistDropM-referenceDrop)<1e-14);
for(const factor of [.9,1.1])assert(Math.abs(resolveShortsWaistFit({heightM:body.measurements.heightM*factor}).waistDropM-draft.receipt.waistDropM*factor)<1e-14);
assert.throws(()=>resolveShortsWaistFit({heightM:body.measurements.heightM},{waistDropM:NaN}));assert.throws(()=>resolveShortsWaistFit({heightM:Infinity}));
const sha=p=>createHash('sha256').update(readFileSync(new URL(p,base))).digest('hex');
const report={version:'original-reference-waist-only-source-check@1',createdAt:new Date().toISOString(),valid:true,
 scope:'actual current generated subject and waist-only measured source-paper construction; NOT final drape or motion acceptance',
 heightM:body.measurements.heightM,referenceY:draft.receipt.referenceY,oldDropM:.055,newDropM:draft.receipt.waistDropM,
 upperY:draft.receipt.upperY,lowerY:draft.receipt.lowerY,hipY:body.measurements.hip.y,crotchY:body.measurements.crotchY,
 maxHemMovementM,inseamLengthM:draft.receipt.design.inseamLength,hemY:draft.receipt.hem.y,
 waistFit:draft.receipt.waistFit,sourceCounts:draft.receipt.sourceCounts,subjectUnchanged:state()===before,
 sources:Object.fromEntries(['ShortsWaistFit.mjs','ShortsBodyAdapter.mjs','ShortsGarmentDraft.mjs','SubjectRuntime.mjs','surface-generator.mjs'].map(p=>[p,sha(p)])),
 physicsValidated:false,productionReady:false};
mkdirSync(new URL('qa/',base),{recursive:true});writeFileSync(new URL('qa/shorts-waist-fit-20261002.json',base),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
