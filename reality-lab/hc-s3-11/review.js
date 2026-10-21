(function(root){'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x),clone=x=>JSON.parse(JSON.stringify(x));
function validate(x,expected){
 if(!x||x.schema!=='kaopu/joint-guard-review@1'||x.version!=='RF01-S3.11')throw Error('REVIEW_SCHEMA_INVALID');
 if(!expected||['nativeCommit','coverageSHA256','guardSHA256','nativeCodeCommit'].some(k=>x.source?.[k]!==expected[k]))throw Error('SOURCE_PIN_MISMATCH');
 if(x.fitCertified!==false||x.productionChanged!==false||x.continuousCollisionCertified!==false||x.fiveSecondABBAExecuted!==false)throw Error('CERTIFICATION_ESCALATION');
 if(x.scope!=='terminal-guided-centroid-only'||x.nativeRun==null||!Array.isArray(x.cases)||x.cases.length!==4)throw Error('SCOPE_INVALID');
 const keys=new Set();for(const c of x.cases){const key=c.motion+':'+c.mode;if(!['static','walk'].includes(c.motion)||!['baseline','guarded'].includes(c.mode)||keys.has(key))throw Error('CASE_IDENTITY');keys.add(key);
  if(c.plannedSteps!==180||!Number.isInteger(c.completedSteps)||c.completedSteps<0||c.completedSteps>180||(!c.failure&&c.completedSteps!==180))throw Error('HORIZON_INVALID');
  if(c.fitGate!==1.45||c.passCap!==32||!Array.isArray(c.points)||c.points.length<1||c.points.length>43)throw Error('LIMIT_OR_POINTS');
  let previous=0;for(const p of c.points){if(!Number.isInteger(p.step)||p.step<1||p.step<previous||p.step>180)throw Error('POINT_ORDER');previous=p.step;for(const k of ['top','bottom','pair']){const m=p[k];if(!m||!finite(m.minimumM)||!Number.isInteger(m.beyondMargin)||m.beyondMargin<0)throw Error('CONTACT_NUMBER');}}
  for(const group of ['step','fine','guard'])for(const v of Object.values(c.cost[group]))if(!finite(v)||v<0)throw Error('COST_NUMBER');
  for(const k of ['calls','guideAccepted','normalAccepted','blocked'])if(!Number.isInteger(c.guard[k])||c.guard[k]<0)throw Error('GUARD_COUNTER');
  if(c.guard.calls!==c.guard.guideAccepted+c.guard.normalAccepted+c.guard.blocked)throw Error('GUARD_ACCOUNTING');
 }
 const r=x.regression;if(!r||r.step!==30||r.faceOffset!==2598||r.pass!==31||r.applied!==false||r.choices.length!==2||r.choices[0].kind!=='guide'||r.choices[1].kind!=='normal')throw Error('REGRESSION_IDENTITY');
 for(const p of [r.before,...r.choices.map(c=>c.after)]){if(!p.geometry||!Array.isArray(p.samples)||!Array.isArray(p.crossingPairs))throw Error('PATCH_MISSING');for(const s of p.samples)if(!finite(s.distanceM)||!Array.isArray(s.point)||s.point.length!==3||!s.point.every(finite))throw Error('PATCH_NUMBER');for(const kind of ['cloth','body']){const tris=p.geometry[kind];if(!Array.isArray(tris)||tris.length>2000)throw Error('GEOMETRY_SET');for(const t of tris)if(!Array.isArray(t.triangle)||t.triangle.length!==3||t.triangle.some(p=>p.length!==3||!p.every(finite)))throw Error('GEOMETRY_NUMBER');}}
 if(r.choices[0].decision.allowed!==false)throw Error('KNOWN_BAD_MOVE_NOT_REJECTED');
 return true;
}
function summary(x){
 const result={candidateVerdict:'HOLD_NOT_PRODUCTION_READY',fullyCertified:false,cases:{}};
 for(const c of x.cases){const channels={};for(const k of ['top','bottom','pair'])channels[k]={minimumMM:Math.min(...c.points.map(p=>p[k].minimumM))*1000,violatingCheckpoints:c.points.filter(p=>p[k].beyondMargin>0).length,violationSteps:c.points.filter(p=>p[k].beyondMargin>0).map(p=>p.step),checkpoints:c.points.length};result.cases[c.motion+':'+c.mode]={channels,completedSteps:c.completedSteps,guard:clone(c.guard),cost:clone(c.cost)};}
 const r=x.regression;result.regression={before448MM:r.before.samples.find(s=>s.id==='v448').distanceM*1000,guide448MM:r.choices[0].after.samples.find(s=>s.id==='v448').distanceM*1000,normal448MM:r.choices[1].after.samples.find(s=>s.id==='v448').distanceM*1000,selected:r.selected,guideRejected:!r.choices[0].decision.allowed,normalRejected:!r.choices[1].decision.allowed};
 return result;
}
function parse(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>5000000)throw Error('IMPORT_TOO_LARGE');return JSON.parse(text);}
const api=Object.freeze({validate,summary,parse});root.JointGuardReview=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
