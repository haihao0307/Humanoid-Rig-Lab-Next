(function(root){'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x),hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
function validate(d,source){
 if(!d||d.schema!=='kaopu/local-contact-solve-review@1'||d.version!=='RF01-S3.12-LOCAL')throw Error('SCHEMA_MISMATCH');
 if(!d.source||!sha(d.source.nativeCommit)||!sha(d.source.nativeCodeCommit)||!hash(d.source.localModuleSHA256)||JSON.stringify(d.source)!==JSON.stringify(source))throw Error('SOURCE_MISMATCH');
 for(const k of ['fitCertified','productionChanged','continuousCollisionCertified','fiveSecondABBAExecuted'])if(d[k]!==false)throw Error('AUTHORITY_ESCALATION');
 if(!Array.isArray(d.cases)||d.cases.length!==4)throw Error('CASE_SET');const seen=new Set();
 for(const c of d.cases){const key=c.motion+':'+c.mode;if(!['static:reference','static:local','walk:reference','walk:local'].includes(key)||seen.has(key))throw Error('CASE_ID');seen.add(key);
  if(c.plannedSteps!==180||!Number.isInteger(c.completedSteps)||c.completedSteps<0||c.completedSteps>180||c.dtSeconds!==1/60||c.fitGate!==1.45||c.passCap!==32)throw Error('SOURCE_LIMITS');
  if(!Array.isArray(c.points)||c.points.length>40||!hash(c.initialStateSHA256))throw Error('POINT_SET');let step=0;
  for(const p of c.points){if(!Number.isInteger(p.step)||p.step<=step||p.step>180||!hash(p.stateSHA256))throw Error('POINT_STEP');step=p.step;
   for(const k of ['top','bottom','pair']){const ch=p[k];if(!ch||!finite(ch.minimumM)||!['negative','beyondMargin','count'].every(n=>Number.isInteger(ch[n])&&ch[n]>=0)||ch.beyondMargin>ch.negative||ch.negative>ch.count)throw Error('CONTACT_VALUE');}
  }
  for(const k of ['calls','guideAccepted','normalAccepted','blocked','localAttempts','localAccepted','localRejected'])if(!Number.isInteger(c.totals[k])||c.totals[k]<0)throw Error('COUNTER');
  if(c.totals.calls!==c.totals.guideAccepted+c.totals.normalAccepted+c.totals.blocked+c.totals.localAccepted||c.totals.localAttempts!==c.totals.localAccepted+c.totals.localRejected)throw Error('COUNTER_BALANCE');
  for(const t of Object.values(c.cost))if(typeof t==='object')for(const n of ['medianMS','p95MS','maxMS','totalMS'])if(!finite(t[n])||t[n]<0)throw Error('TIMING');
 }
 for(const motion of ['static','walk']){const pair=d.cases.filter(c=>c.motion===motion);if(pair[0].initialStateSHA256!==pair[1].initialStateSHA256)throw Error('START_MISMATCH');}
 const e=d.exact;if(!e||e.step!==30||e.faceOffset!==2598||!finite(e.budgetM)||e.budgetM<=0||!Array.isArray(e.scopes)||e.scopes.length<1||e.scopes.length>6)throw Error('EXACT_CASE');
 for(const s of e.scopes){if(!Array.isArray(s.nodes)||s.nodes.length>24||!['zero','guide','normal'].includes(s.seed)||!Array.isArray(s.iterations)||s.iterations.length>12)throw Error('LOCAL_SCOPE');
  for(const p of [s.before,s.after]){if(!p?.geometry||!Array.isArray(p.samples)||!Array.isArray(p.crossingPairs))throw Error('GEOMETRY_REQUIRED');
   for(const sample of p.samples)if(!finite(sample.distanceM)||!Array.isArray(sample.point)||sample.point.length!==3||!sample.point.every(finite))throw Error('SAMPLE_VALUE');
   for(const group of [p.geometry.cloth,p.geometry.body]){if(!Array.isArray(group)||group.length>4000)throw Error('GEOMETRY_SIZE');for(const f of group)if(!Array.isArray(f.triangle)||f.triangle.length!==3||f.triangle.some(p=>p.length!==3||!p.every(finite)))throw Error('GEOMETRY_VALUE');}
  }
  if(s.status==='LOCAL_FEASIBLE'&&(!s.decision.allowed||s.after.crossingPairs.length!==0))throw Error('FALSE_LOCAL_SUCCESS');
 }
 return true;
}
function summary(d){const out={verdict:'HOLD_NOT_PRODUCTION_READY',cases:{},exact:{status:d.exact.status,accepted:d.exact.accepted,scopeCount:d.exact.scopes.length}};
 for(const c of d.cases){const channels={};for(const key of ['top','bottom','pair'])channels[key]={minimumMM:Math.min(...c.points.map(p=>p[key].minimumM))*1000,violatingCheckpoints:c.points.filter(p=>p[key].beyondMargin>0).length,checkpoints:c.points.length};out.cases[c.motion+':'+c.mode]={channels,totals:c.totals,cost:c.cost,completedSteps:c.completedSteps,failure:c.failure};}return out;}
function parse(s){if(typeof s!=='string'||new TextEncoder().encode(s).length>10000000)throw Error('IMPORT_TOO_LARGE');return JSON.parse(s);}
const api=Object.freeze({validate,summary,parse});root.LocalSolveReview=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
