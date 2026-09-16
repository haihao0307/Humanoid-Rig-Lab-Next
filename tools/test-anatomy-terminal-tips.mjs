// Explicit rule regression; no surface generation, browser or GPU.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAnatomyRules} from '../reconstruction/anatomy-rules.mjs';
import {CanonicalTopology} from '../reconstruction/topology.mjs';

const reference=JSON.parse(readFileSync(new URL('../reconstruction/rig-reference.json',import.meta.url)));
const rules=createAnatomyRules(id=>reference.nodes[id]?.positionM,
 (side,kind)=>reference.sphereFits[side+'_'+kind].radiusM,id=>reference.nodes[id]?.tipM);
const topology=new CanonicalTopology(reference);
let terminalTips=0,nearTipSamples=0;
for(const side of ['left','right'])for(const kind of ['finger','toe'])for(let digit=1;digit<=5;digit++){
 const id=side+'_'+kind+'_'+digit+'_'+(digit===1?2:3),node=reference.nodes[id];
 const mask=kind==='finger'?(side==='left'?256:512):(side==='left'?1024:2048);
 const ownPrefix=side+'_'+kind+'_'+digit+'_';
 for(const source of [rules,topology.anatomy]){
  const row=source.resolve(node.tipM,mask),phalanges=[...row.allowed].filter(name=>/_(finger|toe)_/.test(name));
  assert(phalanges.includes(id),id+' tip must retain its terminal bone');
  assert(phalanges.every(name=>name.startsWith(ownPrefix)),id+' tip must not use another digit');
 }
 terminalTips++;
 // Sample the distal half and a 1 mm neighbourhood of the authored tip. The
 // original classifier fails the two great toes even at their exact tips.
 const samples=[.6,.8].map(t=>node.positionM.map((v,k)=>v+(node.tipM[k]-v)*t));
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1])samples.push(node.tipM.map((v,k)=>v+(k===axis?sign*.001:0)));
 for(const p of samples){
  const row=rules.resolve(p,mask),phalanges=[...row.allowed].filter(name=>/_(finger|toe)_/.test(name));
  assert(phalanges.includes(id),id+' distal neighbourhood must retain its terminal bone');
  assert(phalanges.every(name=>name.startsWith(ownPrefix)),id+' distal neighbourhood must stay on its own ray');
  nearTipSamples++;
 }
}
const missing=createAnatomyRules(id=>reference.nodes[id]?.positionM,
 (side,kind)=>reference.sphereFits[side+'_'+kind].radiusM);
assert.throws(()=>missing.resolve(reference.nodes.left_toe_1_2.tipM,1024),/Missing anatomy terminal tip/,
 'a missing endpoint must fail explicitly instead of silently truncating the ray');
console.log(JSON.stringify({schema:'human/anatomy_terminal_tips_regression@1',terminalTips,nearTipSamples,
 ruleFunctionsExecuted:true,geometryGenerated:false,browserExecuted:false,gpuExecuted:false}));
