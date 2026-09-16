import assert from 'node:assert/strict';
import { computeChickenPhase1CarrierStationBlend } from '../runtime/chicken_phase1_ring_coherent_adapter.mjs';

const sampleXs=[-.50,-.20,.06,.09,.15,.21,.27,.325,.366,.40,.50];
for(const x of sampleXs){
 const blend=computeChickenPhase1CarrierStationBlend(x);
 assert.ok(blend.length>=1&&blend.length<=2,`unexpected carrier influence count at ${x}`);
 assert.ok(blend.every(item=>Number.isFinite(item.weight)&&item.weight>=0&&item.weight<=1));
 const total=blend.reduce((sum,item)=>sum+item.weight,0);
 assert.ok(Math.abs(total-1)<1e-9,`carrier weights must normalize at ${x}`);
}

assert.deepEqual(
 computeChickenPhase1CarrierStationBlend(-.50).map(item=>item.boneId),
 ['pelvis']
);
assert.deepEqual(
 computeChickenPhase1CarrierStationBlend(.27).map(item=>item.boneId),
 ['neck_c1','neck_c2']
);
assert.deepEqual(
 computeChickenPhase1CarrierStationBlend(.50).map(item=>item.boneId),
 ['head']
);

const repeated=computeChickenPhase1CarrierStationBlend(.325);
assert.deepEqual(repeated,computeChickenPhase1CarrierStationBlend(.325));
console.log('Chicken Phase 1 ring-coherent carrier tests passed.');
