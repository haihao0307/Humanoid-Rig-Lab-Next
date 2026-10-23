/* Project-authored broad volume corrections, not an independent whole body.
 * All amplitudes are metres; smooth finite support protects neck and limbs.
 * No surface connectivity, external assets or noise-based anatomy. */
(()=>{'use strict';const M=BodyMathR01;
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(t*(t*6-15)+10);};
 const bell=(x,c,r)=>Math.exp(-(((x-c)/r)**2));
 function frame(shape,input){const a=shape.forward({...input,pose:{}}),pos=n=>Array.from(a.boneHeads.subarray(shape.boneLabels.indexOf(n)*3,shape.boneLabels.indexOf(n)*3+3)),l=pos('upperleg01.L'),r=pos('upperleg01.R'),neck=pos('neck01'),shoulder=pos('upperarm01.L');return{origin:l.map((v,k)=>(v+r[k])/2),height:neck[2]-(l[2]+r[2])/2,halfWidth:Math.abs(shoulder[0])};}
 function displacement(p,f,phenotypes,gain){const x=p[0]-f.origin[0],y=p[1]-f.origin[1],u=(p[2]-f.origin[2])/f.height,a=Math.abs(x)/f.halfWidth;
  const mask=smooth(-.42,-.20,u)*(1-smooth(.89,1,u))*(1-smooth(.72,1.02,a));
  if(mask===0)return[0,0,0];
  const fat=phenotypes.weight??.5,muscle=phenotypes.muscle??.35,definition=(.30+.70*muscle)*(1-.82*smooth(.45,.95,fat)),front=1-smooth(-.025,.025,y),back=1-front;
  const chest=bell(u,.70,.16)*bell(a,.39,.30),rib=bell(u,.53,.22),waist=bell(u,.25,.16),pelvis=bell(u,-.05,.19),scapula=bell(u,.73,.17)*bell(a,.40,.30),lumbar=bell(u,.24,.19);
  const scale=f.height/.54;
  const dx=Math.sign(x)*(.006*definition*rib-.006*definition*waist+.004*pelvis)*smooth(.10,.50,a);
  const dy=front*(-.014*definition*chest-.003*definition*rib+.003*definition*waist)+back*(.009*definition*scapula-.003*definition*lumbar+.008*pelvis);
  return[dx*mask*gain*scale,dy*mask*gain*scale,0];
 }
 function create(source){const d=createBodyDriverR01(source),rawForward=d.anny.forward,rawEvaluate=d.evaluate;let current=null;
  d.anny.forward=input=>rawForward(current?.enabled?{...input,supportReference:BodyCalibrationR18.support(input)}:input);
  d.evaluate=(state,options)=>{current=state.bodyCalibration||null;try{const result=rawEvaluate(state,options);if(!current?.enabled)return result;
   const f=frame(d.anny,{phenotypes:state.anny.phenotypes,localChanges:state.anny.localChanges}),gain=current.torso??1;
   if(!Number.isFinite(gain)||gain<0||gain>1.5)throw Error('Invalid torso calibration strength');
   const w=result.packet.weights,rest=result.packet.restPositionsPerInfluence;let maximum=0,changed=0;
   for(let i=0;i<source.bodyCount;i++){const p=Array.from(result.sharedRestVertices.subarray(i*3,i*3+3)),delta=displacement(p,f,state.anny.phenotypes,gain),length=Math.hypot(...delta);maximum=Math.max(maximum,length);if(length===0)continue;changed++;
    const posed=[0,0,0];for(let k=w.ptr[i];k<w.ptr[i+1];k++){for(let c=0;c<3;c++)rest[k*3+c]+=delta[c];const q=M.vector(result.rig.skinMatrices[w.joints[k]],delta);for(let c=0;c<3;c++)posed[c]+=w.values[k]*q[c];}
    for(let c=0;c<3;c++){result.vertices[i*3+c]+=posed[c];result.sharedRestVertices[i*3+c]+=delta[c];}
   }
   result.calibration={schema:'body-support-calibration/1',supportFixedAgainst:['weight','muscle','cupsize','firmness','soft local controls'],torsoFrame:f,torsoGain:gain,maxRestCorrectionMM:maximum*1000,correctedSamples:changed,independentWholeBody:false};return result;
  }finally{current=null;}};
  return d;
 }
 globalThis.BodyTorsoR18={frame,displacement,create};globalThis.createBodyDriverR18=create;
})();
