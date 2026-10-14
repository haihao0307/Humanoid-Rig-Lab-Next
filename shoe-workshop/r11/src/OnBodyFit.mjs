import {measureFootProfile,solveShoeFit} from './HumanFitAdapter.mjs';

export function createOnBodyShoeFit(humanFoot={},preset='standard') {
  const profile=measureFootProfile(humanFoot);
  const fit=solveShoeFit(profile,preset);
  return {
    profile,
    fit,
    attachment:'foot-joint',
    source:'Humanoid-Rig-Lab-Next Human Core',
    limits:[
      'does not modify skeleton',
      'does not modify skin weights',
      'display and wearable adaptation only'
    ]
  };
}

export function evaluateFootFit(samples){
  return samples.map(s=>({
    preset:s.preset,
    toeClearance:s.toeClearance||'pending',
    heelContact:s.heelContact||'pending',
    instepCollision:s.instepCollision||'pending'
  }));
}
