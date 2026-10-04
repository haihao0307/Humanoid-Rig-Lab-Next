import * as THREE from 'three';
import {projectManufacturingPaper} from './ShortsManufacturingMetric.mjs';

// Temporary authoring handles unfold an already sewn source garment. They are
// never used by native fixedStep, skinning, material rest or permanent pins.
export function arrangeShortsForWear(cloth,measuredDraft,{maximumPasses=200}={}){
 if(cloth.steps!==0||cloth.activeSeams.length!==19||cloth.positions.length!==451)throw Error('Wear authoring requires the complete source garment before native motion');
 if(maximumPasses!==200)throw Error('This authoring candidate has a frozen two-hundred-pass budget');
 const identity=cloth.materialIdentity(),source=[...measuredDraft.waistIndices];
 const byId=new Map(measuredDraft.ranges.map(r=>[r.pieceId,r]));
 for(const [front,back]of [['FL','BL'],['FR','BR']]){const f=byId.get(front),b=byId.get(back);for(let c=0;c<=7;c++)source.push(f.offset+104+c);for(let c=6;c>=1;c--)source.push(b.offset+104+c);}
 const frame=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion();cloth.actor.getWorldPosition(position);cloth.actor.getWorldQuaternion(rotation);frame.compose(position,rotation,new THREE.Vector3(1,1,1));
 const seen=new Set(),handles=[];
 for(const original of source){const id=cloth.quotient[original];if(seen.has(id))continue;seen.add(id);const target=new THREE.Vector3().fromArray(measuredDraft.positions,original*3).applyMatrix4(frame).toArray();handles.push({id,original,start:[...cloth.positions[id]],target,complianceMPerN:.01,slackM:.004,lambda:0});}
 if(handles.length!==56)throw Error('Expected twenty-eight waist and two fourteen-point source leg loops');
 cloth.body.refitExact();const before=cloth.audit(true),trace=[],h=cloth.options.fixedDt,start=performance.now();
 const gap=()=>Math.max(0,...handles.map(e=>Math.hypot(...cloth.positions[e.id].map((v,k)=>v-e.target[k]))));
 for(let pass=1;pass<=maximumPasses;pass++){
  const guided=pass<=160,progress=Math.min(1,pass/80);for(const e of cloth.edges)e.lambda=0;for(const e of handles)e.lambda=0;
  for(let sweep=0;sweep<8;sweep++){
   if(guided)for(const e of handles){const p=cloth.positions[e.id],target=e.start.map((v,k)=>v+(e.target[k]-v)*progress),delta=p.map((v,k)=>v-target[k]),length=Math.hypot(...delta),C=length-e.slackM;if(C<=0||length<1e-12)continue;const alpha=e.complianceMPerN/(h*h),dl=-(C+alpha*e.lambda)/(cloth.invMass[e.id]+alpha);e.lambda+=dl;for(let k=0;k<3;k++)p[k]+=cloth.invMass[e.id]*dl*delta[k]/length;}
   for(const e of cloth.edges)cloth.solveDistance(e,h);
   for(const t of cloth.triangles)projectManufacturingPaper(cloth,t);
  }
  // Contact is measured against the actual original clothing envelope. Point
  // and centroid coverage is explicitly insufficient for whole-feature CCD.
  cloth.contacts();cloth.selfContacts();
  if(pass%10===0){const a=cloth.audit(true);trace.push({pass,temporaryHandles:guided?handles.length:0,mainStrain:a.mainStrain,bodyPointAndCentroidPenetrationM:a.bodyPenetrationM,waistAndHemTargetGapM:gap(),finite:a.finite});if(!a.finite)break;}
 }
 cloth.syncRender();if(identity!==cloth.materialIdentity())throw Error('Wear authoring changed source material');
 const after=cloth.audit(true),targetGapM=gap();
 return {version:'source-loop-wear-authoring@1',scope:'static authoring only; not native cloth physics or complete collision acceptance',before,after,trace,elapsedMs:performance.now()-start,sourceHandleIndices:handles.map(e=>e.original),temporaryHandleCount:56,permanentHandleCount:0,handlingComplianceMPerN:.01,handlingSlackM:.004,handlePathPasses:80,holdingEndPass:160,releasePasses:40,sourceRestAndMassUnchanged:true,allPhysicalDofsFree:cloth.invMass.every(v=>v>0),sourceSeams:19,actualMotionSteps:cloth.steps,waistAndHemTargetGapM:targetGapM,pointCentroidNumericPassed:after.numericValid&&targetGapM<=.008,strictBodySelfContactValidated:false,completeDressingPathValidated:false,motionValidated:false,productionReady:false};
}
