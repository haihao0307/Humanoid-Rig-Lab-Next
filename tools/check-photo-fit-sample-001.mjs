import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
  measurePhotoSet,
  buildPhotoFitCandidate,
  applyCandidateToPreset,
  createPhotoFitProfile
} from '../photo-fit/PhotoFitCore.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const readJson=path=>JSON.parse(readFileSync(root+path,'utf8'));
const sample=readJson('photo-fit/samples/stylized-explorer-175-front-001.json');
const faceRecipe=readJson('body/FaceControlRecipe.json');
let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const equal=(actual,expected,message)=>{assert.equal(actual,expected,message);checks++;};

const basePreset={
  schema:'jarvis/character_preset@6',bodyPlanRevision:17,bodyArchetype:'r2-source-reference',
  id:'sample-base',label:'Sample Base',seed:26091500,bodySex:'male',
  shape:{schema:'jarvis/human_shape@2',revision:'r2-regional-shape-r2',statureScale:1,legProportion:0,shoulderWidth:0,hipWidth:0,waistWidth:0,torsoDepth:0,armFullness:0,legFullness:0},
  appearance:{skin:{baseColor:'#b78b69',undertone:0,redness:.08,sunExposure:.2},skinColor:[.43,.29,.22],skinLayers:{subcutaneousScale:1},hair:{preset:'crop',color:'#2b211d',seed:1,lengthScale:1,density:1},face:{schema:'jarvis/face_pose@1',revision:faceRecipe.revision,weights:{},offsetsMm:{}}},
  strength:{schema:'fixture'},biology:{schema:'fixture'},task:{command:'站立观察',startOnSpawn:false}
};
const shapeReport={
  schema:'jarvis/human_shape@2',method:'r2-regional-shape-r2',parameterDomain:'authored reference neighbourhood',
  parameters:basePreset.shape,
  metrics:{statureM:1.7194712,shoulderWidthM:.405,hipWidthM:.305,torsoDepthM:.34,armRadiusM:.047,legRadiusM:.069}
};

const measurement=measurePhotoSet({
  mode:'full',
  front:{landmarks:sample.frontLandmarks,width:sample.reference.width,height:sample.reference.height},
  side:null,
  knownHeightM:sample.subject.knownHeightM,
  looseClothing:true,
  perspectiveWarning:false
});
const candidate=buildPhotoFitCandidate({
  measurement,basePreset,shapeReport,faceRecipe,
  options:{
    shapeGain:sample.interpretation.shapeGain,
    faceGain:sample.interpretation.faceGain,
    manualShape:sample.interpretation.manualShape,
    manualFaceOffsetsMm:sample.interpretation.manualFaceOffsetsMm
  }
});

ok(sample.reference.storage==='not-in-repository','reference pixels must not be committed');
equal(sample.reference.sha256.length,64,'reference digest must be SHA-256');
equal(sample.subject.referenceKind,'stylized-illustration','sample must retain stylized classification');
ok(sample.captureAssessment.neutralPose===false,'non-neutral pose must remain explicit');
ok(sample.captureAssessment.bodyOcclusion.length>=5,'occlusion evidence must be retained');
equal(measurement.front.measurements.knownHeightM.value,1.75,'known height must be recorded');
ok(measurement.warnings.some(item=>item.code==='SINGLE_VIEW_DEPTH_UNKNOWN'),'front-only depth warning must remain');
ok(measurement.warnings.some(item=>item.code==='LOOSE_CLOTHING_RISK'),'garment warning must remain');
for(const [id,value] of Object.entries(sample.interpretation.manualShape))equal(candidate.shape.shape[id],value,`manual ${id} must be exact`);
for(const [id,value] of Object.entries(sample.interpretation.manualFaceOffsetsMm))assert.deepEqual(candidate.face.face.offsetsMm[id],value,`manual face node ${id} must be exact`),checks++;
ok(candidate.warnings.some(item=>item.code==='FACE_IDENTITY_CAPACITY_LIMITED'),'face capacity warning must remain');
const applied=applyCandidateToPreset(basePreset,candidate,'all');
equal(applied.schema,'jarvis/character_preset@6','current preset schema must be preserved');
equal(applied.task.command,basePreset.task.command,'task must survive sample application');
equal(applied.shape.statureScale,1.017755,'sample stature scale must be applied');
const profile=createPhotoFitProfile({
  projectId:'photo-fit-r1-2-sample',subjectId:sample.sampleId,targetInstanceId:'npc-sample',
  sourceImages:[{imageId:sample.sampleId,view:'front',fileName:sample.reference.fileName,mimeType:sample.reference.mimeType,width:sample.reference.width,height:sample.reference.height,sha256:sample.reference.sha256}],
  measurement,candidate,basePreset,shapeReport,appliedStages:[]
});
const serialized=JSON.stringify(profile);
ok(!/data:image|blob:|base64,/i.test(serialized),'profile must not contain image payload');
equal(profile.boundaries.visualAcceptance,false,'sample is not visually accepted before review');
equal(profile.boundaries.productionReady,false,'sample is not production ready');
ok(sample.unsupportedInCurrentMother.length>=6,'current mother limitations must be recorded');

console.log(JSON.stringify({
  schema:'humanoid_rig/photo_fit_sample_check@0.1',sampleId:sample.sampleId,checks,passed:true,
  classification:sample.subject.referenceKind,knownHeightM:sample.subject.knownHeightM,
  candidateShape:candidate.shape.shape,warningCodes:candidate.warnings.map(item=>item.code)
},null,2));
