// Execute the actual face resolver, editor uniform method and NPC adapter.
// No human generation, simulation, browser or WebGL context is involved.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const parserModule={exports:{}};
vm.runInNewContext(process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'],{exports:parserModule.exports,module:parserModule});
const faceSource=read('body/FaceIdentity.js')+'\n'+read('body/FaceControls.js').replace('/*__FACE_RECIPE_JSON__*/',read('body/FaceControlRecipe.json'));
const tree=parserModule.exports.parse(faceSource,{ecmaVersion:'latest',sourceType:'module'}),methods=[];
function visit(node){
 if(!node||typeof node!=='object')return;
 if(node.type==='Property'&&node.method&&node.key.name==='uniforms')methods.push(node);
 for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
}
visit(tree);assert.equal(methods.length,1,'one actual editor uniform method');
const editorMethod=faceSource.slice(methods[0].start,methods[0].end);
const scope=vm.createContext({npcCopy:structuredClone,structuredClone});
const api=vm.runInContext(faceSource+'\n'+read('control/NPCPopulation.js')+`
({NPCPopulation,resolveFaceOffsets,editorUniforms:(resolved,enabled=true,heatmap=false,selected=0)=>({${editorMethod}}).uniforms()})`,scope);
const rendererSource=read('body/CompactWorkbench.js'),upload=rendererSource.match(/gl\.uniform1f\(p\.u\.compactLipOpen,([^;]+)\);/);
assert(upload,'renderer uploads the mouth channel');
const uploadedLip=vm.runInContext('(face)=>('+upload[1]+')',scope);
const pop=Object.create(api.NPCPopulation.prototype);pop.activeId='npc-1';
let editorEnabled=true,editorPose={};
pop.lab={renderer:{},world:{},face:{uniforms:()=>api.editorUniforms(api.resolveFaceOffsets(editorPose),editorEnabled)}};
const definition={character:{id:'test',label:'test'},attachments:{hair:{enabled:false}}};
const actors=['npc-1','npc-2'].map(id=>pop.context(id,definition,{tissue:{},characterPreset:{appearance:{face:{}}}},{}));
const normal=value=>JSON.parse(JSON.stringify(value,(key,v)=>ArrayBuffer.isView(v)?Array.from(v):v));
let cases=0;
for(const activeId of ['npc-1','npc-2'])for(const amount of [0,.001,.375,1]){
 pop.activeId=activeId;editorEnabled=true;editorPose={weights:{lipPart:amount}};
 for(const actor of actors)actor.human.characterPreset.appearance.face=structuredClone(editorPose);
 const results=actors.map(actor=>actor.face.uniforms());
 assert.deepEqual(normal(results[0]),normal(results[1]),'editor selection must not alter a resident mouth');
 for(const value of results){assert.equal(value.lipOpen,amount);assert.equal(value.enabled,amount>0?1:0);assert(Number.isFinite(uploadedLip(value)));assert.equal(uploadedLip(value),amount);cases++;}
 // Editor mute affects only the active face. A dormant actor retains its recipe.
 editorEnabled=false;
 for(const actor of actors){const value=actor.face.uniforms();assert.equal(value.lipOpen,amount);assert.equal(uploadedLip(value),actor.id===activeId?0:amount);cases++;}
}
const recipe=JSON.parse(read('body/FaceControlRecipe.json'));
for(const pose of [{weights:{eyeBlinkLeft:.7}},{offsetsMm:{[recipe.nodes[0].id]:[.3,0,0]}}]){
 editorEnabled=true;editorPose=pose;
 for(const actor of actors){actor.human.characterPreset.appearance.face=structuredClone(editorPose);const value=actor.face.uniforms();assert.equal(value.lipOpen,0);assert.equal(value.enabled,1);assert.equal(uploadedLip(value),0);cases++;}
}
for(const amount of [NaN,Infinity,-.01,1.01])for(const activeId of ['npc-1','npc-2']){
 pop.activeId=activeId;editorPose={weights:{lipPart:amount}};
 for(const actor of actors){actor.human.characterPreset.appearance.face=editorPose;assert.throws(()=>actor.face.uniforms(),/lipPart/);cases++;}
}
pop.activeId='npc-1';
const resident=actors[1];resident.human.characterPreset.appearance.face={offsetsMm:{cheekLeft:[2,0,0]}};
const cached=resident.face.uniforms();
assert.strictEqual(resident.face.uniforms(),cached,'unchanged inactive face reuses resolved uniforms');
resident.human.characterPreset.appearance.face={offsetsMm:{cheekLeft:[-2,0,0]}};
const changed=resident.face.uniforms();
assert.notStrictEqual(changed,cached,'a committed replacement invalidates the face cache');
assert.notDeepEqual(normal(changed.offsets),normal(cached.offsets),'updated identity reaches the renderer');
assert.strictEqual(resident.face.uniforms(),changed);
console.log(JSON.stringify({cases,activeAndInactiveLipTransfer:true,selectionIndependent:true,residentCacheInvalidation:true,editorMuteLocal:true,invalidValuesRejected:true,rendererUploadExpressionChecked:true,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
