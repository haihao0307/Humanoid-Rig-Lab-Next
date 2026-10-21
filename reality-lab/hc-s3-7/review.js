(function(root){
'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x),HASH=/^[a-f0-9]{64}$/;
function validate(x){
 if(!x||x.schema!=='kaopu/contact-origin@1'||!['static','walk','walk-repeat'].includes(x.case)||x.sourceCommit!=='c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49')throw Error('SOURCE_OR_SCHEMA_MISMATCH');
 if(x.dt!==1/60||x.plannedSteps!==12||x.epsilonM!==.00005||x.originalGate!==1.45||x.dynamicFitCertified!==false||x.productionChanged!==false||x.automaticAppFramesBeforeMeasurement!==0)throw Error('SCOPE_OR_AUTHORITY_MISMATCH');
 if(!Array.isArray(x.records)||x.records.length<3||x.records.length>15||x.completedSteps!==x.records.length-3)throw Error('RECORD_COUNT_MISMATCH');
 for(let i=0;i<x.records.length;i++){const r=x.records[i],step=Math.max(0,i-2),stage=i===0?'fit-committed':i===1?'regional-created':i===2?'motion-selected':'fixed-step';
  if(r.stage!==stage||r.step!==step||r.frame!==48+step||!HASH.test(r.stateSHA256)||r.readOnlyVerified!==true||r.continuousCollision!==false||r.fullRenderedYarnCollision!==false||!finite(r.simulationSeconds)||Math.abs(r.simulationSeconds-(.8+step/60))>1e-10)throw Error('TIMELINE_MISMATCH');
  if(!Array.isArray(r.body)||r.body.length!==2)throw Error('BODY_SET_INVALID');
  for(const q of [...r.body,r.pair]){
   if(!q||!Number.isInteger(q.count)||q.count<=0||!Number.isInteger(q.eligible)||q.eligible<0||q.eligible>q.count||!Number.isInteger(q.negative)||q.negative<0||q.negative>q.eligible||q.beyondMargin<0||q.beyondMargin>q.negative)throw Error('SAMPLE_COUNTS_INVALID');
   if(q.minimumM!==null&&!finite(q.minimumM))throw Error('DISTANCE_INVALID');
   if(q.witness){const w=q.witness;if(w.orientedDistanceM!==q.minimumM||![w.point,w.closest,...(w.sourceTriangle||[]),...w.targetTriangle].every(v=>Array.isArray(v)&&v.length===3&&v.every(finite)))throw Error('WITNESS_INVALID');if(Math.abs(Math.hypot(...w.point.map((v,k)=>v-w.closest[k]))-Math.abs(w.orientedDistanceM))>1e-8)throw Error('WITNESS_DISTANCE_MISMATCH');}
  }
 }
 return true;
}
function channel(r,key){return key==='pair'?r.pair:r.body[key==='top'?0:1];}
function findings(x){validate(x);return ['top','bottom','pair'].map(key=>{const first=x.records.find(r=>channel(r,key).beyondMargin>0);return {key,firstStage:first?.stage||null,firstStep:first?.step??null,initialResidual:channel(x.records[0],key).beyondMargin>0,minimumOverSequenceM:Math.min(...x.records.map(r=>channel(r,key).minimumM).filter(finite)),firstWitness:first?channel(first,key).witness:null};});}
const api=Object.freeze({validate,channel,findings});root.ContactReview37=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
