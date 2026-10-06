// IPC-shaped scalar point barrier for static authoring, with a frozen4mm
// clearance. This does not query a body or certify triangles, CCD, or wearing.
export function evaluatePaperContactBarrier(signedDistanceM,{clearanceM=.004,activationDistanceM=.03,weight}={}){
 if(!Number.isFinite(signedDistanceM))throw Error('PAPER_CONTACT_BARRIER_NONFINITE_DISTANCE');
 if(clearanceM!==.004)throw Error('PAPER_CONTACT_BARRIER_CLEARANCE_FROZEN_4MM');
 if(!(Number.isFinite(activationDistanceM)&&activationDistanceM>0))throw Error('PAPER_CONTACT_BARRIER_INVALID_ACTIVATION');
 if(!(Number.isFinite(weight)&&weight>0))throw Error('PAPER_CONTACT_BARRIER_INVALID_FINITE_POSITIVE_WEIGHT');
 const s=signedDistanceM-clearanceM,hat=activationDistanceM,scope={signedDistanceM,clearanceM,activationDistanceM,weight,gapM:s,pointSampledOnly:true,fullTriangleContactValidated:false,ccdValidated:false,wearingAccepted:false};
 if(s<=0)return{status:'HOLD',reason:'Barrier requires strictly positive clearance gap; cannot restore penetrating or touching initialization',energyM2:null,derivativeM:null,secondDerivative:null,...scope};
 if(s>=hat)return{status:'INACTIVE',energyM2:0,derivativeM:0,secondDerivative:0,...scope};
 const delta=s-hat,ratio=delta/s;
 // log1p is accurate near activation; log(s/hat) remains finite when s/hat
 // underflows, since log(s)-log(hat) avoids the quotient underflow.
 const logRatio=s>hat/2?Math.log1p(delta/hat):Math.log(s)-Math.log(hat);
 const energyM2=-weight*delta*delta*logRatio,derivativeM=-weight*(2*delta*logRatio+delta*ratio),secondDerivative=weight*(-2*logRatio-4*ratio+ratio*ratio);
 if(![energyM2,derivativeM,secondDerivative].every(Number.isFinite)||energyM2<0||secondDerivative<0)return{status:'HOLD',reason:'Barrier numerical evaluation unresolved; no overflow clamping or distance relaxation',energyM2:null,derivativeM:null,secondDerivative:null,...scope};
 return{status:'ACTIVE',energyM2,derivativeM,secondDerivative,...scope};
}
