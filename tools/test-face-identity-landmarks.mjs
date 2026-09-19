// Execute the structural identity compiler, profile migration and landmark map.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const face=read('body/FaceControls.js').replace('/*__FACE_RECIPE_JSON__*/',read('body/FaceControlRecipe.json'));
const source=read('body/HeadSculpt.js')+'\n'+read('body/FaceIdentity.js')+'\n'+face.slice(0,face.indexOf('function faceChunkEligible'));
const api=vm.runInNewContext(source+'\n({FACE_SCHEMA,FACE_IDENTITY_SCHEMA,FACE_IDENTITY_SHAPE_SCHEMA,FACE_EXPRESSION_SCHEMA,FACE_IDENTITY_PARAMETERS,FACE_IDENTITY_PRESETS,FACE_IDENTITY_REFERENCE_LANDMARKS,validateFacePose,resolveFaceOffsets,interpolateFacePose,faceIdentityLandmarks,compileFaceIdentityShape,compactHeadSculptPoint,faceIdentityWarp,faceIdentityProportions,sampleFaceIdentity})');
const normal=value=>JSON.parse(JSON.stringify(value,(key,v)=>ArrayBuffer.isView(v)?Array.from(v):v));
const recipe=JSON.parse(read('body/FaceControlRecipe.json'));
assert.equal(api.FACE_SCHEMA,'jarvis/face_profile@3');
assert.equal(api.FACE_IDENTITY_SCHEMA,'jarvis/face_identity@2');
assert.equal(api.FACE_IDENTITY_SHAPE_SCHEMA,'jarvis/face_identity_shape@1');
assert.equal(api.FACE_IDENTITY_PARAMETERS.length,19);
assert.equal(api.FACE_IDENTITY_PRESETS.length,6);
const legacy=api.validateFacePose({schema:'jarvis/face_pose@1',offsetsMm:{cheekLeft:[2,0,0],chin:[0,-1,1]},weights:{mouthSmileLeft:.7}});
assert.equal(legacy.schema,'jarvis/face_profile@3');
assert.equal(legacy.identity.schema,'jarvis/face_identity@2');
assert.deepEqual(normal(legacy.identity.shape),{});
assert.deepEqual(normal(legacy.identity.neutralOffsetsMm),{cheekLeft:[2,0,0],chin:[0,-1,1]});
assert.deepEqual(normal(legacy.expression.weights),{mouthSmileLeft:.7});
const profileV2=api.validateFacePose({schema:'jarvis/face_profile@2',identity:{schema:'jarvis/face_identity@1',neutralOffsetsMm:{jawLeft:[1,0,0]}},expression:{schema:'jarvis/face_expression@1',weights:{}}});
assert.equal(profileV2.schema,'jarvis/face_profile@3');
assert.equal(profileV2.identity.schema,'jarvis/face_identity@2');
assert.deepEqual(normal(profileV2.identity.shape),{});
const shaped=api.validateFacePose({identity:{shape:{jawWidth:1,noseProjection:.5,faceHeight:.25,eyeFissureHeight:.5,upperLidFullness:.25},neutralOffsetsMm:{chin:[0,0,.4]}},expression:{weights:{}}});
const resolved=api.resolveFaceOffsets(shaped);
const jaw=recipe.nodes.findIndex(node=>node.id==='jawLeft')*3,noseTip=recipe.nodes.findIndex(node=>node.id==='noseTip')*3,chin=recipe.nodes.findIndex(node=>node.id==='chin')*3;
const lidUpper=recipe.nodes.findIndex(node=>node.id==='lidUpperLeft')*3,lidLower=recipe.nodes.findIndex(node=>node.id==='lidLowerLeft')*3;
assert(jaw>=0&&noseTip>=0&&chin>=0&&lidUpper>=0&&lidLower>=0);
assert.equal(resolved.proportions[4],1,'jaw width reaches the shared mandible field');
assert.equal(resolved.values[jaw],0,'jaw width no longer stacks a local swelling over the broad jaw field');
assert(Math.abs(resolved.values[noseTip+2]-.0015)<1e-7,'nose projection reaches the shared nose-tip node');
assert(resolved.values[chin+2]>.00039,'manual residual composes after structural identity');
assert(Math.abs(resolved.values[lidUpper+1]-.000575)<1e-9,'eye-fissure height lifts the upper lid owner');
assert(Math.abs(resolved.values[lidLower+1]+.000525)<1e-9,'eye-fissure height lowers the lower lid owner');
assert(Math.abs(resolved.values[lidUpper+2]-.0002125)<1e-9,'upper-lid fullness projects only the upper lid owner');
assert.equal(resolved.landmarks.schema,'jarvis/face_landmarks@1');
const sculptedJaw=api.faceIdentityLandmarks({...shaped.identity.shape,jawWidth:0}).values.jawLeft;
assert(resolved.landmarks.values.jawLeft[0]>sculptedJaw[0]&&resolved.landmarks.values.jawLeft[0]<sculptedJaw[0]+.003,'anterior jaw landmark follows the weaker front of the rear-focused mandible field after head sculpt');
assert(Math.abs(resolved.landmarks.values.noseTip[2]-.2025)<1e-9,'landmark map follows structural nose projection');
let composedLandmarks=0,sculptAffectedLandmarks=0;
for(const shape of [{},shaped.identity.shape,...api.FACE_IDENTITY_PRESETS.map(p=>p.shape)]){
  const landmarks=api.faceIdentityLandmarks(shape),offsets=api.compileFaceIdentityShape(shape),weights=api.faceIdentityProportions(shape);
  for(const reference of api.FACE_IDENTITY_REFERENCE_LANDMARKS){
    const delta=offsets[reference.node]||[0,0,0],local=reference.position.map((v,k)=>v+delta[k]*.001),sculpted=api.compactHeadSculptPoint(local).point,expected=api.faceIdentityWarp(sculpted,weights).point;
    assert.deepEqual(normal(landmarks.values[reference.id]),normal(expected),'landmark must use the same sculpt-before-identity composition as the renderer');
    if(Math.hypot(...sculpted.map((v,k)=>v-local[k]))>.0001)sculptAffectedLandmarks++;
    composedLandmarks++;
  }
}
assert(sculptAffectedLandmarks>10,'composition test must cover landmarks actually moved by the current head sculpt');
const smile=api.validateFacePose({identity:shaped.identity,expression:{weights:{mouthSmileLeft:1,mouthSmileRight:1}}});
const neutral=api.interpolateFacePose(smile,api.validateFacePose({identity:shaped.identity,expression:{weights:{}}}),1);
assert.deepEqual(normal(neutral.identity),normal(shaped.identity),'expression interpolation must preserve structural identity and residuals');
for(const preset of api.FACE_IDENTITY_PRESETS){const profile=api.validateFacePose({identity:{shape:preset.shape,neutralOffsetsMm:preset.offsetsMm}});assert.equal(profile.schema,api.FACE_SCHEMA);api.resolveFaceOffsets(profile);}
const sampled=api.sampleFaceIdentity(4101);
assert(!Object.hasOwn(sampled.shape,'eyeFissureHeight'),'unvalidated eye-fissure control must not change existing seeded identities');
assert(!Object.hasOwn(sampled.shape,'upperLidFullness'),'unvalidated upper-lid control must not change existing seeded identities');
assert.throws(()=>api.validateFacePose({identity:{shape:{unknown:1}}}),/未知结构脸型参数/);
assert.throws(()=>api.validateFacePose({identity:{shape:{jawWidth:1.1}}}),/超出范围/);
assert.throws(()=>api.validateFacePose({schema:'jarvis/face_profile@3',identity:{shape:{}},weights:{}}),/字段不匹配|未知字段/);
console.log(JSON.stringify({profileV1Migrated:true,profileV2Migrated:true,structuralParameters:api.FACE_IDENTITY_PARAMETERS.length,identityPresets:api.FACE_IDENTITY_PRESETS.length,landmarks:Object.keys(resolved.landmarks.values).length,composedLandmarks,sculptAffectedLandmarks,structuralAndResidualComposition:true,identityPreservedAcrossExpression:true,seededEyeControlsFrozen:true,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));