/* Authored calibration policy. Metres, Z up. This is an animation support
 * contract, not measured internal anatomy. Legacy files remain opt-in. */
(()=>{'use strict';
 const headLocal=k=>/cheek|chin|ear-|eyebrow|eye-|forehead|head-|mouth|nose|lip|jaw|neck/i.test(k);
 const softLocal=k=>/fat|muscle|volume|tone|pregnant|navel|nipple|breast|bulge|circ/.test(k);
 function support(input){return{phenotypes:{...input.phenotypes,weight:.5,muscle:.35,cupsize:.5,firmness:.5},localChanges:Object.fromEntries(Object.entries(input.localChanges||{}).filter(([k])=>!softLocal(k)||headLocal(k)))};}
 function preset(original,name='adult'){
  if(!['adult','lean','fuller','muscular'].includes(name))throw Error('Unknown calibration profile');
  const s=structuredClone(original);s.anny.phenotypes={...s.anny.phenotypes,age:.5,weight:.5,muscle:.35};
  s.anny.localChanges=Object.fromEntries(Object.entries(s.anny.localChanges||{}).filter(([k])=>headLocal(k)));
  // Preserve every cranial field, including inactive driver state.
  s.anny.pose=Object.fromEntries(Object.entries(s.anny.pose||{}).filter(([k])=>/^(neck\d+|head|eye\.[LR])$/.test(k)));
  s.anny.translations=Object.fromEntries(Object.entries(s.anny.translations||{}).filter(([k])=>/^(neck\d+|head|eye\.[LR])$/.test(k)));
  const headColumns=new Set([24,25,26,27,28,29]);s.mhr.pose=s.mhr.pose.map((v,i)=>headColumns.has(i)?v:0);
  s.bodyCalibration={schema:'body-support-calibration/1',enabled:true,torso:1,profile:name};
  if(name==='lean')s.anny.phenotypes.weight=.28;
  if(name==='fuller'){s.anny.phenotypes.weight=.86;s.anny.phenotypes.muscle=.15;}
  if(name==='muscular')s.anny.phenotypes.muscle=.9;
  return s;
 }
 globalThis.BodyCalibrationR18={support,preset,headLocal,softLocal};
})();
