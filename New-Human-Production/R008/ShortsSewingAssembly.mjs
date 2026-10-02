import * as THREE from 'three';
import {ShortsClothRuntime} from './ShortsClothRuntime.mjs';
import {projectManufacturingPaper} from './ShortsManufacturingMetric.mjs';
import {solveManufacturingBlock} from './ShortsManufacturingCoupled.mjs';

// Fresh cut paper -> progressively closed original source seams. This authoring
// process is separate from wearing, body collisions and native physics.
export async function sewShortsSource(source,body,actor,scene,onProgress=()=>{},initialCloth=null,{stopAfter=null}={}){
 if(stopAfter!==null&&!source.sewingStages.some(s=>s.id===stopAfter))throw Error('Unknown source sewing checkpoint');
 const identity=d=>JSON.stringify({uv:Array.from(d.sourceUV),triangles:Array.from(d.triangles),mass:Array.from(d.masses),seams:d.seams}),sourceIdentity=identity(source);
 const frame=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion();actor.getWorldPosition(p);actor.getWorldQuaternion(q);frame.compose(p,q,new THREE.Vector3(1,1,1));const inverse=frame.clone().invert();
 const localPositions=cloth=>{const out=new Float64Array(1659),v=new THREE.Vector3();for(let i=0;i<553;i++)out.set(v.fromArray(cloth.positions[cloth.quotient[i]]).applyMatrix4(inverse).toArray(),i*3);return out;};
 let positions=source.positions,previousSeams=[],cloth=initialCloth;const stages=[];
 for(const stage of source.sewingStages){
  if(!cloth)cloth=new ShortsClothRuntime({...source,positions},body,actor,scene,{activeSeamIDs:previousSeams,elasticEnabled:false});
  const restIdentity=cloth.materialIdentity(),before=cloth.audit(false),trace=[],pairs=source.seams.filter(s=>stage.sourceSeamIDs.includes(s.id)).flatMap(s=>s.pairs),threads=pairs.map(e=>{const a=cloth.quotient[e.a],b=cloth.quotient[e.b],initial=Math.hypot(...cloth.positions[a].map((v,k)=>v-cloth.positions[b][k]));return {a,b,initial,rest:initial,sourceArc:e.t,compliance:0,lambda:0,active:false};}),gap=()=>Math.max(0,...threads.map(e=>Math.hypot(...cloth.positions[e.a].map((v,k)=>v-cloth.positions[e.b][k]))));
  onProgress({status:'sewing',stage:stage.id,pass:0,cloth});
  for(let pass=1;pass<=200;pass++){
   for(const e of cloth.edges)e.lambda=0;for(const e of threads){e.lambda=0;const closure=Math.max(0,Math.min(1,(pass/80-e.sourceArc*.5)*2));e.rest=e.initial*(1-closure);e.active=closure>0;}
   for(let sweep=0;sweep<8;sweep++){for(const e of cloth.edges)cloth.solveDistance(e,cloth.options.fixedDt);for(const t of cloth.triangles)projectManufacturingPaper(cloth,t);for(const e of threads)if(e.active)cloth.solveDistance(e,cloth.options.fixedDt);}
   if(pass%10===0){const audit=cloth.audit(false),seamGapM=gap();trace.push({pass,mainStrain:audit.mainStrain,seamGapM,finite:audit.finite});cloth.syncRender();onProgress({status:'sewing',stage:stage.id,pass,cloth,audit});await new Promise(resolve=>setTimeout(resolve,0));if((pass>=80&&audit.manufacturingMaterialValid&&seamGapM<=.0001)||!audit.finite)break;}
  }
  let coupled=null;if(stage.id==='gusset'&&(!cloth.audit(false).manufacturingMaterialValid||gap()>.0001))coupled=solveManufacturingBlock(cloth,threads);
  const soft=cloth.audit(false),seamGapM=gap(),paperUnchanged=restIdentity===cloth.materialIdentity()&&sourceIdentity===identity(source);positions=localPositions(cloth);
  if(!soft.manufacturingMaterialValid||seamGapM>.0001||!paperUnchanged){stages.push({id:stage.id,valid:false,before,soft,seamGapM,trace,coupled,paperUnchanged});cloth.syncRender();onProgress({status:'failed',stage:stage.id,cloth,audit:soft});return {status:'failed',cloth,stages,bodyFitValidated:false,motionValidated:false};}
  cloth.dispose();cloth=new ShortsClothRuntime({...source,positions},body,actor,scene,{activeSeamIDs:stage.cumulativeSourceSeamIDs,elasticEnabled:false});const after=cloth.audit(false),valid=after.manufacturingMaterialValid&&cloth.positions.length===stage.sourceQuotientDofs;stages.push({id:stage.id,valid,before,soft,after,seamGapM,trace,coupled,paperUnchanged});onProgress({status:valid?'closed':'failed',stage:stage.id,cloth,audit:after});
  if(!valid)return {status:'failed',cloth,stages,bodyFitValidated:false,motionValidated:false};
  positions=localPositions(cloth);previousSeams=stage.cumulativeSourceSeamIDs;
  if(stage.id===stopAfter)return {status:'partial',cloth,stages,manufacturingMaterialPassed:false,completedSourceSeams:previousSeams.length,bodyFitValidated:false,motionValidated:false};
  if(stage.index<source.sewingStages.length-1){cloth.dispose();cloth=null;}
 }
 cloth.syncRender();return {status:'complete',cloth,stages,manufacturingMaterialPassed:true,sourcePaperUnchanged:sourceIdentity===identity(source),elasticEnabled:false,bodyFitValidated:false,selfContactValidated:false,motionValidated:false,productionReady:false};
}
