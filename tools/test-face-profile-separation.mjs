// Execute the versioned face-profile migration and identity/expression invariant.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('body/FaceControls.js').replace('/*__FACE_RECIPE_JSON__*/',read('body/FaceControlRecipe.json'));
const prefix=source.slice(0,source.indexOf('function faceChunkEligible'));
const api=vm.runInNewContext(prefix+'\n({FACE_SCHEMA,FACE_IDENTITY_SCHEMA,FACE_EXPRESSION_SCHEMA,FACE_IDENTITY_PRESETS,validateFacePose,resolveFaceOffsets,interpolateFacePose})');
const normal=value=>JSON.parse(JSON.stringify(value,(key,v)=>ArrayBuffer.isView(v)?Array.from(v):v));
const legacy=api.validateFacePose({schema:'jarvis/face_pose@1',offsetsMm:{cheekLeft:[2,0,0],chin:[0,-1,1]},weights:{mouthSmileLeft:.7}});
assert.equal(legacy.schema,'jarvis/face_profile@2');
assert.equal(legacy.identity.schema,'jarvis/face_identity@1');
assert.equal(legacy.expression.schema,'jarvis/face_expression@1');
assert.deepEqual(normal(legacy.identity.neutralOffsetsMm),{cheekLeft:[2,0,0],chin:[0,-1,1]});
assert.deepEqual(normal(legacy.expression.weights),{mouthSmileLeft:.7});
const smile=api.validateFacePose({identity:legacy.identity,expression:{weights:{mouthSmileLeft:1,mouthSmileRight:1,cheekRaiseLeft:.8,cheekRaiseRight:.8}}});
const halfway=api.interpolateFacePose(legacy,smile,.5),neutral=api.interpolateFacePose(smile,api.validateFacePose({identity:legacy.identity,expression:{weights:{}}}),1);
assert.deepEqual(normal(halfway.identity),normal(legacy.identity),'expression interpolation must preserve identity');
assert.deepEqual(normal(neutral.identity),normal(legacy.identity),'return to neutral must restore the same identity');
assert.deepEqual(normal(neutral.expression.weights),{});
const resolved=api.resolveFaceOffsets(neutral),cheekIndex=JSON.parse(read('body/FaceControlRecipe.json')).nodes.findIndex(n=>n.id==='cheekLeft')*3;
assert(Math.abs(resolved.values[cheekIndex]-.002)<1e-7,'neutral identity offset reaches renderer uniforms');
for(const preset of api.FACE_IDENTITY_PRESETS){const profile=api.validateFacePose({identity:{neutralOffsetsMm:preset.offsetsMm}});assert.equal(profile.schema,api.FACE_SCHEMA);for(const delta of Object.values(profile.identity.neutralOffsetsMm))assert(Math.hypot(...delta)<=6);}
assert.throws(()=>api.validateFacePose({schema:'jarvis/face_profile@2',identity:{neutralOffsetsMm:{}},weights:{}}),/schema|未知字段/);
assert.throws(()=>api.validateFacePose({identity:{neutralOffsetsMm:{unknown:[0,0,0]}}}),/局部控制点/);
console.log(JSON.stringify({legacyMigrated:true,identityPreservedAcrossExpression:true,identityPresetCount:api.FACE_IDENTITY_PRESETS.length,rendererNeutralOffsetChecked:true,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
