import * as THREE from 'three';
import {projectManufacturingPaper} from './ShortsManufacturingMetric.mjs';
import {scSolveBending} from './ShortsBending.mjs';

// Bounded source-paper assembly. These are authoring iterations, never native
// animation time or fixedStep calls. Temporary guides have finite compliance;
// all particles retain their source area mass and positive inverse mass.
export async function prepareShortsWearV9(cloth,{maxPasses=120,onProgress=()=>{}}={}){
 if(!Number.isInteger(maxPasses)||maxPasses<1||maxPasses>120)throw Error('V9 authoring limited to 120 passes');
 const identity=cloth.materialIdentity(),steps=cloth.steps,time=cloth.time,start=performance.now(),trace=[];
 cloth.body.refitExact();
 const actorY=cloth.actor.getWorldPosition(new THREE.Vector3()).y,receipt=cloth.draft.receipt,h=1/60;
 const waist=new Set(cloth.waist),lower=new Set((cloth.draft.casing.stitchPaths.find(p=>p.edge==='lower')?.indices??[]).map(i=>cloth.quotient[i]));
 const hem=new Set();for(const p of cloth.draft.pieces.filter(p=>p.kind==='leg-panel')){const r=cloth.draft.ranges.find(r=>r.pieceId===p.id);for(const i of p.boundaries.hem)hem.add(cloth.quotient[r.offset+i]);}
 const guides=[...[...waist].map(id=>({id,y:receipt.upperY+actorY})),...[...lower].map(id=>({id,y:receipt.lowerY+actorY})),...[...hem].map(id=>({id,y:receipt.hem.y+actorY}))];
 const guideComplianceMPerN=.002,release=Math.ceil(maxPasses*.75);
 for(let pass=1;pass<=maxPasses;pass++){
  cloth.resetMaterialMultipliers();for(const e of [...cloth.edges,...cloth.elastic,...cloth.bends])e.lambda=0;
  for(let sweep=0;sweep<6;sweep++){
   // Source principal metric removes initialization distortion, using the
   // same independent cut UVs; no posed mesh supplies new rest values.
   for(const t of cloth.triangles)projectManufacturingPaper(cloth,t);
   for(const e of cloth.bends)scSolveBending(e,cloth.bendParticles,h,cloth.options.bendCompliance);
   for(const e of cloth.elastic)cloth.solveDistance(e,h);
   if(pass<=release)for(const g of guides){const w=cloth.invMass[g.id],alpha=guideComplianceMPerN/(h*h);cloth.positions[g.id][1]-=(cloth.positions[g.id][1]-g.y)*w/(w+alpha);}
   cloth.contacts();
  }
  if(pass%5===0)cloth.selfContacts();
  if(pass%10===0||pass===maxPasses){const a=cloth.audit(false),state={pass,mainStrain:a.mainStrain,elasticStrain:a.elasticStrain,finite:a.finite,elapsedMs:performance.now()-start};trace.push(state);onProgress(state);cloth.syncRender();if(!a.finite)throw Error('HOLD_V9: nonfinite source-paper assembly');await new Promise(resolve=>setTimeout(resolve,0));}
 }
 if(cloth.materialIdentity()!==identity||cloth.steps!==steps||cloth.time!==time)throw Error('V9 authoring changed source material or native clock');
 cloth.previous=cloth.positions.map(p=>p.slice());cloth.velocity=cloth.positions.map(()=>[0,0,0]);cloth.syncRender();
 return {kind:'bounded source-metric/contact authoring, not motion validation',passes:maxPasses,trace,elapsedMs:performance.now()-start,temporaryGuideComplianceMPerN:guideComplianceMPerN,guideReleasePass:release,allDofsFree:cloth.invMass.every(w=>w>0),sourceIdentityUnchanged:true,nativeClockUnchanged:true,physicalMaterial:{...cloth.options.paperMaterial,calibrated:false},bendingLaw:cloth.bendingLaw,final:cloth.audit(true),productionReady:false};
}
