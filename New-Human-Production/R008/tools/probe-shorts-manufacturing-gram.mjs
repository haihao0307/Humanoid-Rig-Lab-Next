import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {manufacturingPaperGramRow} from '../ShortsManufacturingCoupled.mjs';
import {paperPrincipal} from '../ShortsManufacturingMetric.mjs';

// Independent coordinate finite differences, no CG, contact or authoring steps.
const base=new URL('../',import.meta.url),output=new URL('qa/shorts-manufacturing-gram-finite-difference-corrected-20261002.json',base);
assert(!existsSync(output),'Do not replace an existing diagnostic receipt');
const hash=url=>createHash('sha256').update(readFileSync(url)).digest('hex');
const triangle=uv=>{const du1=uv[1][0]-uv[0][0],dv1=uv[1][1]-uv[0][1],du2=uv[2][0]-uv[0][0],dv2=uv[2][1]-uv[0][1],det=du1*dv2-du2*dv1;return {q:[0,1,2],inv:[dv2/det,-du2/det,-dv1/det,du1/det]};};
const cases=[{name:'proper-rigid unit source metric',uv:[[0,0],[.08,0],[.03,.05]],xyz:[[0,0],[.08,0],[.03,.05]].map(([u,v])=>[.13+u*.8-v*.36,-.2+u*.6+v*.48,.41+v*.8])},
 {name:'actual FR triangle303 projected-coefficient cancellation from saved failed stage',sourceIndices:[180,189,188],uv:[[.11418205067029741,.22654178856685073],[.16226423058631564,.2554936013510965],[.08891936264391317,.2554936013510965]],xyz:[[-.09543593296658107,.6349896533103901,.1672405929620679],[-.1368114246988764,.6712989936781385,.15605858868481537],[-.06612631077787032,.6593525498578255,.17142318900634707]]}];
const results=cases.map(c=>{
 const cloth={positions:c.xyz.map(p=>[...p])},t=triangle(c.uv),rows=[0,1,2].map(mode=>manufacturingPaperGramRow(cloth,t,mode));
 let maximumAbsoluteError=0,maximumScaledError=0;const observations=[];
 for(let mode=0;mode<3;mode++)for(let i=0;i<3;i++)for(let k=0;k<3;k++){
  const old=cloth.positions[i][k],epsilon=1e-6;
  cloth.positions[i][k]=old+epsilon;const plus=manufacturingPaperGramRow(cloth,t,mode).value;
  cloth.positions[i][k]=old-epsilon;const minus=manufacturingPaperGramRow(cloth,t,mode).value;cloth.positions[i][k]=old;
  const finite=(plus-minus)/(2*epsilon),analytic=rows[mode].gradients[i][k],absolute=Math.abs(analytic-finite),scaled=absolute/Math.max(1,Math.abs(analytic),Math.abs(finite));
  maximumAbsoluteError=Math.max(maximumAbsoluteError,absolute);maximumScaledError=Math.max(maximumScaledError,scaled);observations.push({mode,vertex:i,axis:k,analytic,finite,absolute,scaled});
 }
 assert(maximumScaledError<1e-7,'Independent coordinate derivatives must match');
 if(c===cases[0])assert(Math.max(...rows.map(r=>Math.abs(r.value)))<1e-13,'The three rows share exact source-isometry zero set');
 let directional=null;
 if(c===cases[1]){
  // Resolve the recorded actual active quotient instead of assuming source
  // index order. q181 belongs to source189, local vertex1, not source188.
  const saved=JSON.parse(readFileSync(new URL('qa/shorts-lowwaist-all-stage-coupled-20261002.json',base))),activeLocal=c.sourceIndices.findIndex(i=>saved.actualQuotient[i]===181);
  assert.equal(activeLocal,1,'The saved actual ownership must resolve q181');
  // Exactly the problematic local-second-vertex active subset. Unit inverse mass
  // is explicit here; real production retains its existing actual mass weights.
  const projectedNorms=rows.map(r=>Math.hypot(...r.gradients[activeLocal])),principal=paperPrincipal(cloth,t,1),principalProjectedNorm=Math.hypot(...principal.gradients[activeLocal]);
  const gradient=[0,0,0];rows.forEach((r,i)=>r.gradients[activeLocal].forEach((g,k)=>gradient[k]+=2*r.value*g/projectedNorms[i]**2));
  const length=Math.hypot(...gradient),d=gradient.map(x=>-.003*x/length),old=[...cloth.positions[activeLocal]];
  const energyAt=f=>{cloth.positions[activeLocal]=old.map((x,k)=>x+d[k]*f);return [0,1,2].reduce((sum,mode)=>sum+(manufacturingPaperGramRow(cloth,t,mode).value/projectedNorms[mode])**2,0);};
  const epsilon=1e-4,finite=(energyAt(epsilon)-energyAt(-epsilon))/(2*epsilon),analytic=gradient.reduce((sum,g,k)=>sum+g*d[k],0),relativeError=Math.abs(analytic-finite)/Math.max(1e-30,Math.abs(analytic),Math.abs(finite));energyAt(0);
  assert(relativeError<=1e-3,'The unchanged production directional finite-difference gate must pass');
  assert.deepEqual(cloth.positions,c.xyz,'The observer restores every actual coordinate');
  directional={activeLocalVertices:[activeLocal],actualQuotient:181,actualSourceVertex:c.sourceIndices[activeLocal],inverseMass:1,frozenGramProjectedNorms:projectedNorms,oldPrincipalProjectedNorm:principalProjectedNorm,analytic,finite,relativeError,unchangedProductionGate:1e-3,directionM:d,epsilon};
 }
 return {...c,values:rows.map(r=>r.value),maximumAbsoluteError,maximumScaledError,observations,directional};
});
assert.throws(()=>manufacturingPaperGramRow({positions:cases[0].xyz},triangle(cases[0].uv),3),/Gram row/);
const report={scope:'pure saved-coordinate/source2D derivative observer; no solver, body, manufacturing or native steps',passed:true,coupledHash:hash(new URL('ShortsManufacturingCoupled.mjs',base)),metricHash:hash(new URL('ShortsManufacturingMetric.mjs',base)),oldDiagnosticHash:hash(new URL('qa/shorts-lowwaist-all-stage-coupled-descent-readonly-20261002.json',base)),cases:results,sourceRestChanged:false,massesChanged:false,sourceGeometryChanged:false};
writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({output:output.pathname,passed:true,cases:results.map(c=>({name:c.name,maximumScaledError:c.maximumScaledError,directional:c.directional}))}));
