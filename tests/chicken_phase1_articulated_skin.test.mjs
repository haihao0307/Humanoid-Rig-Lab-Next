import assert from 'node:assert/strict';
import {
  CHICKEN_PHASE1_BONE_ORDER,
  computeChickenPhase1VertexWeights,
  computeChickenPhase1SkinAttributes
} from '../runtime/chicken_phase1_articulated_skin.mjs';

const sum=(values)=>values.reduce((total,value)=>total+value,0);

for(const [position,kind] of [
  [[.39,.95,.12],'body'],
  [[-.32,.53,.09],'feather'],
  [[0,.55,.20],'feather'],
  [[0,.08,.14],'parts'],
  [[.40,.95,.12],'iris'],
  [[0,.52,.09],'body']
]){
  const result=computeChickenPhase1VertexWeights(...position,kind);
  assert.equal(result.indices.length,4);
  assert.equal(result.weights.length,4);
  assert.ok(Math.abs(sum(result.weights)-1)<1e-6);
  assert.ok(result.indices.every(index=>index>=0&&index<CHICKEN_PHASE1_BONE_ORDER.length));
  assert.ok(result.weights.every(weight=>weight>=0&&Number.isFinite(weight)));
}

let result=computeChickenPhase1VertexWeights(.39,.95,.12,'body');
assert.equal(result.indices[0],CHICKEN_PHASE1_BONE_ORDER.indexOf('head'));

result=computeChickenPhase1VertexWeights(-.34,.52,.12,'feather');
assert.equal(result.indices[0],CHICKEN_PHASE1_BONE_ORDER.indexOf('tail'));

result=computeChickenPhase1VertexWeights(0,.56,.20,'feather');
assert.equal(result.indices[0],CHICKEN_PHASE1_BONE_ORDER.indexOf('wing_l'));

result=computeChickenPhase1VertexWeights(0,.06,.14,'parts');
assert.ok(
  result.indices.includes(CHICKEN_PHASE1_BONE_ORDER.indexOf('ankle_l'))||
  result.indices.includes(CHICKEN_PHASE1_BONE_ORDER.indexOf('toe_l'))
);

const attributes=computeChickenPhase1SkinAttributes(
  new Float32Array([.39,.95,.12,-.34,.52,.12,0,.06,.04]),
  'body'
);
assert.equal(attributes.count,3);
assert.equal(attributes.indices.length,12);
assert.equal(attributes.weights.length,12);
for(let vertex=0;vertex<3;vertex++){
  assert.ok(Math.abs(sum([...attributes.weights.slice(vertex*4,vertex*4+4)])-1)<1e-6);
}
assert.throws(()=>computeChickenPhase1SkinAttributes(new Float32Array([1,2]),'body'));

console.log('Chicken Phase 1 articulated skin weight tests passed.');
