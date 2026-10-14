import assert from 'node:assert/strict';
import {createFootProfile,solveShoeFit} from '../src/HumanFitAdapter.mjs';
import {createOnBodyTransform} from '../src/OnBodyFit.mjs';

const cases=['standard','wide','highInstep'];
for(const preset of cases){
 const profile=createFootProfile(preset);
 const fit=solveShoeFit(profile);
 const transform=createOnBodyTransform({foot:profile,fit});
 assert.ok(Number.isFinite(transform.position[0]));
 assert.ok(Number.isFinite(transform.position[1]));
 assert.ok(Number.isFinite(transform.position[2]));
 assert.ok(transform.scale[0]>0);
}
console.log('R11 on-body runtime adapter passed');
