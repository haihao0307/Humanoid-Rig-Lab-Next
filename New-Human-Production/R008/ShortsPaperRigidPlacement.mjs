// One proper rigid placement of already formed paper. No sewing, body query,
// rest construction, scaling, permanent pin, simulation, or wearing acceptance.
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const multiply=(R,p)=>R.map(row=>dot(row,p));
function xyz(value,label){
 if(!(Array.isArray(value)||ArrayBuffer.isView(value))||value.length!==3||!Array.from(value).every(Number.isFinite))throw Error('RIGID_PLACEMENT_INVALID_XYZ:'+label);
 return Array.from(value);
}
function basis(frame,label){
 if(!frame)throw Error('RIGID_PLACEMENT_INVALID_FRAME:'+label);
 const waist=xyz(frame.waist,label+'.waist'),leftHem=xyz(frame.leftHem,label+'.leftHem'),rightHem=xyz(frame.rightHem,label+'.rightHem');
 const transverse=sub(rightHem,leftHem),width=Math.hypot(...transverse);
 if(!(width>0&&Number.isFinite(width)))throw Error('RIGID_PLACEMENT_DEGENERATE_HEM_AXIS:'+label);
 const u=transverse.map(v=>v/width),hemMid=leftHem.map((v,k)=>v/2+rightHem[k]/2),rise=sub(waist,hemMid),riseLength=Math.hypot(...rise),projection=dot(rise,u),orthogonal=rise.map((v,k)=>v-projection*u[k]),height=Math.hypot(...orthogonal);
 // Relative rank check, so changing metre units cannot change classification.
 if(!(riseLength>0&&Number.isFinite(riseLength)&&height>1e-10*riseLength&&Number.isFinite(height)))throw Error('RIGID_PLACEMENT_DEGENERATE_WAIST_AXIS:'+label);
 const v=orthogonal.map(x=>x/height),n=cross(u,v),columns=[u,v,n],orthogonalityError=Math.max(...columns.flatMap((a,i)=>columns.map((b,j)=>Math.abs(dot(a,b)-(i===j?1:0)))));
 if(orthogonalityError>1e-9)throw Error('RIGID_PLACEMENT_UNRESOLVED_FRAME:'+label);
 return{waist,leftHem,rightHem,u,v,n,widthM:width,orthogonalRiseM:height,orthogonalityError};
}
export function alignShortsPaperRigid({positions,sourceFrame,targetFrame}){
 if(!Array.isArray(positions)||positions.length===0)throw Error('RIGID_PLACEMENT_EXPECTED_NESTED_POSITIONS');
 const identity=JSON.stringify({positions,sourceFrame,targetFrame}),input=positions.map((p,i)=>xyz(p,'positions['+i+']')),s=basis(sourceFrame,'source'),tgt=basis(targetFrame,'target'),S=[s.u,s.v,s.n],T=[tgt.u,tgt.v,tgt.n];
 // Matrix is row-major nested 3x3: R = targetBasis * sourceBasis^T.
 const R=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>S.reduce((sum,column,k)=>sum+T[k][i]*column[j],0)));
 const determinant=dot(R[0],cross(R[1],R[2])),orthogonalityError=Math.max(...R.flatMap((a,i)=>R.map((b,j)=>Math.abs(dot(a,b)-(i===j?1:0)))));
 if(!Number.isFinite(determinant)||Math.abs(determinant-1)>1e-9||orthogonalityError>1e-9)throw Error('RIGID_PLACEMENT_NOT_PROPER_ORTHONORMAL');
 const rotatedWaist=multiply(R,s.waist),t=tgt.waist.map((v,k)=>v-rotatedWaist[k]),place=p=>multiply(R,p).map((v,k)=>v+t[k]),output=input.map(place);
 if(output.some(p=>!p.every(Number.isFinite)))throw Error('RIGID_PLACEMENT_NONFINITE_RESULT');
 const frameResiduals=Object.fromEntries(['waist','leftHem','rightHem'].map(key=>[key,Math.hypot(...sub(place(s[key]),tgt[key]))]));
 const unchanged=identity===JSON.stringify({positions,sourceFrame,targetFrame});if(!unchanged)throw Error('RIGID_PLACEMENT_INPUT_MUTATED');
 return{positions:output,R,t,determinant,error:Math.max(orthogonalityError,Math.abs(determinant-1)),orthogonalityError,frameResidualsM:frameResiduals,sourceInputUnchanged:unchanged,scale:1,sourceFrameDimensions:{hemWidthM:s.widthM,orthogonalRiseM:s.orthogonalRiseM},targetFrameDimensions:{hemWidthM:tgt.widthM,orthogonalRiseM:tgt.orthogonalRiseM},receipt:{schema:'shorts-paper-proper-rigid-placement@1',coordinateFrame:'same metre frame as supplied centers; no implicit actor/world conversion',authority:'proper frame-to-frame rigid alignment only; waist anchored exactly; unequal hem width/rise remain residuals rather than garment scaling',sourceRestFromXYZ:false,sourceMetricPreservedByRigidMap:true,bodyContactValidated:false,selfContactValidated:false,wearingAccepted:false,nativeSteps:0}};
}
