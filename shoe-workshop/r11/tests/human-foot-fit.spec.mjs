import assert from 'node:assert/strict';
import {measureFootProfile,solveShoeFit,HUMAN_FOOT_PRESETS} from '../src/HumanFitAdapter.mjs';

const profile=measureFootProfile({lengthMm:265,forefootWidthMm:108,instepHeightMm:70});
for(const key of Object.keys(HUMAN_FOOT_PRESETS)){
 const fit=solveShoeFit(profile,key);
 assert.equal(fit.preset,key);
 assert.ok(fit.lengthScale>0);
}
console.log('Human foot fit presets validated');
