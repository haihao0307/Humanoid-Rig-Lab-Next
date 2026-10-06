import assert from 'node:assert/strict';
import {evaluatePaperContactBarrier} from '../ShortsPaperContactBarrier.mjs';
const c=.004,hat=.03,w=2.5,evaluate=(d,options={})=>evaluatePaperContactBarrier(d,{weight:w,...options}),relative=(a,b)=>Math.abs(a-b)/Math.max(Math.abs(a),Math.abs(b),1e-30);
let maximumFirstFDRelativeError=0,maximumSecondFDRelativeError=0,maximumSecondEnergyFDRelativeError=0;
for(const s of [.002,.008,.015,.024]){
 const d=c+s,h=2e-7,b=evaluate(d),plus=evaluate(d+h),minus=evaluate(d-h),first=(plus.energyM2-minus.energyM2)/(2*h),second=(plus.derivativeM-minus.derivativeM)/(2*h),secondEnergy=(plus.energyM2-2*b.energyM2+minus.energyM2)/(h*h);
 assert.equal(b.status,'ACTIVE');assert(b.energyM2>0&&b.derivativeM<0&&b.secondDerivative>0);
 const r1=relative(first,b.derivativeM),r2=relative(second,b.secondDerivative),r3=relative(secondEnergy,b.secondDerivative);maximumFirstFDRelativeError=Math.max(maximumFirstFDRelativeError,r1);maximumSecondFDRelativeError=Math.max(maximumSecondFDRelativeError,r2);maximumSecondEnergyFDRelativeError=Math.max(maximumSecondEnergyFDRelativeError,r3);assert(r1<2e-8&&r2<5e-8&&r3<1e-4,JSON.stringify({s,r1,r2,r3}));
 // Weight law, holding the exact clearance and distances fixed.
 const double=evaluate(d,{weight:2*w});for(const key of ['energyM2','derivativeM','secondDerivative'])assert(relative(double[key],2*b[key])<1e-14);
}
for(const d of [-1,0,c-1e-6,c]){const b=evaluate(d);assert.equal(b.status,'HOLD');assert.equal(b.energyM2,null);assert.equal(b.derivativeM,null);assert.equal(b.secondDerivative,null);}
for(const d of [c+hat,c+hat+.01]){const b=evaluate(d);assert.equal(b.status,'INACTIVE');assert.equal(b.energyM2,0);assert.equal(b.derivativeM,0);assert.equal(b.secondDerivative,0);}
// One-sided limits at activation: energy, first and second derivative all
// tend to the identically-zero exterior branch (C2, not C3).
const limits=[1e-3,1e-4,1e-5,1e-6].map(epsilon=>evaluate(c+hat*(1-epsilon)));
for(let i=1;i<limits.length;i++)for(const key of ['energyM2','derivativeM','secondDerivative'])assert(Math.abs(limits[i][key])<Math.abs(limits[i-1][key]));
assert(limits.at(-1).energyM2<1e-18&&Math.abs(limits.at(-1).derivativeM)<3e-12&&limits.at(-1).secondDerivative<2e-5);
// With clearance fixed4mm, scale the *clearance gap* and hat by L:
// E'=L^2 E, b'=L b', b'' unchanged. Scaling the clearance is rejected.
let maximumGapScaleLawRelativeError=0;
const base=evaluate(c+.008);for(const L of [.1,10]){const scaled=evaluate(c+L*.008,{activationDistanceM:L*hat});for(const [key,factor]of [['energyM2',L*L],['derivativeM',L],['secondDerivative',1]]){const r=relative(scaled[key],factor*base[key]);maximumGapScaleLawRelativeError=Math.max(maximumGapScaleLawRelativeError,r);assert(r<1e-13);}}
assert.throws(()=>evaluatePaperContactBarrier(c+.01,{clearanceM:.003,activationDistanceM:hat,weight:w}),/CLEARANCE_FROZEN/);
assert.throws(()=>evaluatePaperContactBarrier(c+.01,{clearanceM:.008,activationDistanceM:hat,weight:w}),/CLEARANCE_FROZEN/);
for(const value of [NaN,Infinity,-Infinity])assert.throws(()=>evaluate(value),/NONFINITE_DISTANCE/);
for(const weight of [undefined,0,-1,NaN,Infinity])assert.throws(()=>evaluatePaperContactBarrier(c+.01,{weight}),/INVALID_FINITE_POSITIVE_WEIGHT/);
for(const activationDistanceM of [0,-1,NaN,Infinity])assert.throws(()=>evaluate(c+.01,{activationDistanceM}),/INVALID_ACTIVATION/);
assert(base.pointSampledOnly&&!base.fullTriangleContactValidated&&!base.ccdValidated&&!base.wearingAccepted);
console.log(JSON.stringify({status:'PURE_CONTACT_BARRIER_CHECKS_PASSED',clearanceM:c,maximumFirstFDRelativeError,maximumSecondFDRelativeError,maximumSecondEnergyFDRelativeError,maximumGapScaleLawRelativeError,activationC2Limit:limits.at(-1),penetratingOrTouchingInitializationHeld:true,originalClearanceFrozen:true,solverIterations:0,newNativeInstances:0,fullTriangleContactValidated:false,ccdValidated:false,wearingAccepted:false}));
