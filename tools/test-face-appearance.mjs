// Parameter round-trip and identity/expression separation are necessary, but
// deliberately do not certify visual quality or arbitrary anatomical validity.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const face=read('body/FaceControls.js').replace('/*__FACE_RECIPE_JSON__*/',read('body/FaceControlRecipe.json'));
const source=read('body/SkinAppearance.js')+'\n'+read('body/HeadSculpt.js')+'\n'+read('body/FaceIdentity.js')+'\n'+face+'\n'+read('body/FaceAppearance.js');
const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,{append(){},querySelector:key=>element(key),value:''});return elements.get(id);};
const revision='a'.repeat(64);
const api=vm.runInNewContext(source+'\n({sampleFaceAppearance,validateFaceAppearance,resolveFaceOffsets,validateFacePose,installFaceAppearance,FACE_IDENTITY_PARAMETERS})',{
 HUMAN_GENERATOR_REVISION:revision,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),document:{createElement:()=>element('section'),getElementById:element}
});
const plain=x=>JSON.parse(JSON.stringify(x));
const distinct=new Set();
for(let seed=0;seed<256;seed++){
 const look=api.sampleFaceAppearance(seed),roundtrip=api.validateFaceAppearance(JSON.parse(JSON.stringify(look)));
 assert.deepEqual(plain(roundtrip),plain(look));assert.deepEqual(plain(api.sampleFaceAppearance(seed)),plain(look));
 assert(!('expression' in look));assert(!('positions' in look));
 const resolved=api.resolveFaceOffsets({identity:look.identity});assert.equal(resolved.limited.length,0,'sampled neutral identities must not silently hit the offset clamp');
 distinct.add(JSON.stringify(look.identity.shape));
 const neutral=api.validateFacePose({identity:look.identity}),smile=api.validateFacePose({identity:look.identity,expression:{weights:{mouthSmileLeft:.6,mouthSmileRight:.6}}});
 assert.deepEqual(plain(smile.identity),plain(neutral.identity));
}
assert.equal(distinct.size,256,'different seeds must change face shape, not just skin');
for(const seed of [-1,1.5,4294967296,NaN])assert.throws(()=>api.sampleFaceAppearance(seed));
api.sampleFaceAppearance(4294967295);api.sampleFaceAppearance(0);
const reference=api.sampleFaceAppearance(4101),look=api.sampleFaceAppearance(8202);
for(const bad of [{...look,expression:{}},{...look,generatorRevision:'unknown'},{...look,identity:{shape:{jawWidth:Infinity}}}])assert.throws(()=>api.validateFaceAppearance(bad));
let current={id:'keeper',seed:4101,task:{command:'keep task'},shape:{statureScale:1},appearance:{face:api.validateFacePose({identity:reference.identity,expression:{weights:{jawOpen:.25}}}),skin:reference.skin,hair:{preset:'crop'}}};
const lab={character:{export:()=>structuredClone(current),apply:async next=>{current=structuredClone(next);}},face:{shapeParameters:()=>[]}};
const lookAPI=api.installFaceAppearance(lab),before=structuredClone(current);
await lookAPI.apply(look);
assert.deepEqual(plain(lookAPI.export()),plain(look));
assert.deepEqual(plain(current.appearance.face.expression),plain(before.appearance.face.expression));
assert.deepEqual(current.task,before.task);assert.deepEqual(current.shape,before.shape);assert.deepEqual(current.appearance.hair,before.appearance.hair);assert.equal(current.id,before.id);assert.equal(current.seed,before.seed,'appearance edits must preserve the character seed used by other modules');
const accepted=structuredClone(current);
await assert.rejects(()=>lookAPI.apply({...look,generatorRevision:'b'.repeat(64)}),/生成器版本不同/);
assert.deepEqual(current,accepted,'version mismatch rejects before any character write');
const upgraded=await lookAPI.apply({...look,generatorRevision:'b'.repeat(64)},{allowGeneratorUpgrade:true});assert(upgraded.upgraded);assert.equal(upgraded.appearance.generatorRevision,revision);
await lookAPI.apply(reference);assert.deepEqual(plain(lookAPI.export()),plain(reference));
console.log(JSON.stringify({sampledIdentities:256,uniqueShapes:distinct.size,roundTrip:true,neutralClampFree:true,expressionAndTaskPreserved:true,versionMismatchRejected:true,visualAcceptance:false}));
