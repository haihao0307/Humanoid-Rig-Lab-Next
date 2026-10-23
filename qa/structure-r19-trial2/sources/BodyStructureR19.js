/* Authored regional form functions. Metres in the common Z-up rest frame.
 * Support locations are animation references, not recovered internal anatomy.
 * No topology, body mesh, third-party geometry, or texture assets. */
(()=>{'use strict';const M=globalThis.BodyMathR01;
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(t*(t*6-15)+10);};
 const bell=(x,c,r)=>Math.exp(-(((x-c)/r)**2));
 function masks(p,f){const a=Math.abs(p[0]-f.origin[0])/f.halfWidth,u=(p[2]-f.origin[2])/f.height;
  const vertical=smooth(-.40,-.18,u)*(1-smooth(.91,1.00,u));
  return{a,u,trunk:vertical*(1-smooth(.72,1.10,a)),shoulder:smooth(.55,.72,u)*(1-smooth(.90,.99,u))*smooth(.50,.73,a)*(1-smooth(1.17,1.48,a))};
 }
 function displacement(p,f,phenotypes,gain=1){const {a,u,trunk,shoulder}=masks(p,f);if(trunk===0&&shoulder===0)return[0,0,0];
  const x=p[0]-f.origin[0],y=p[1]-f.origin[1],fat=phenotypes.weight??.5,muscle=phenotypes.muscle??.35,gender=phenotypes.gender??0,cover=1-.95*smooth(.40,.90,fat),definition=(.25+.75*muscle)*cover,front=1-smooth(-.015,.035,y),back=1-front,side=smooth(.16,.55,a),scale=f.height/.54;
  const pectoral=bell(u,.72,.13)*bell(a,.43,.31),lowerChest=bell(u,.57-.035*a,.045)*bell(a,.44,.36),collar=bell(u,.89-.055*a,.045)*smooth(.12,.34,a)*(1-smooth(.82,1.08,a));
  const rib=bell(u,.49,.19),waist=bell(u,.23,.16),iliac=bell(u,-.035,.14),abdomen=bell(u,.23,.20)*bell(a,.22,.45),scapula=bell(u,.74,.16)*bell(a,.44,.26),lat=bell(u,.52,.22)*bell(a,.72,.30),erector=bell(u,.37,.26)*bell(a,.19,.16),sacrum=bell(u,-.06,.15)*bell(a,0,.30),glute=bell(u,-.14,.16)*bell(a,.49,.30);
  const dx=Math.sign(x)*side*(.007*definition*rib-.008*definition*waist+.004*iliac+.004*definition*lat);
  const sternum=bell(u,.68,.17)*bell(a,0,.24);
  const dy=front*((1-.80*gender)*definition*(-.008*pectoral+.004*lowerChest)-.010*(1-.75*gender)*cover*sternum-.004*definition*collar-.003*cover*abdomen)+back*(definition*(.006*scapula+.004*erector+.003*lat)+.006*glute-.002*cover*sacrum);
  const cap=bell(a,1.01,.24)*bell(u,.82,.105)*shoulder,capGain=(.45+.55*muscle)*(1-.60*smooth(.45,.95,fat)),around=Math.tanh((y-.005)/.026);
  return[(dx*trunk+Math.sign(x)*.007*cap*capGain)*gain*scale,(dy*trunk+.006*cap*capGain*around)*gain*scale,.005*cap*capGain*gain*scale];
 }
 function jacobian(p,f,phenotypes,gain=1){const J=[1,0,0,0,1,0,0,0,1],epsilon=.00025;for(let k=0;k<3;k++){const a=p.slice(),b=p.slice();a[k]-=epsilon;b[k]+=epsilon;const l=displacement(a,f,phenotypes,gain),r=displacement(b,f,phenotypes,gain);for(let j=0;j<3;j++)J[j*3+k]+=(r[j]-l[j])/(2*epsilon);}return J;}
 function cofactor(a){return[a[4]*a[8]-a[5]*a[7],a[5]*a[6]-a[3]*a[8],a[3]*a[7]-a[4]*a[6],a[2]*a[7]-a[1]*a[8],a[0]*a[8]-a[2]*a[6],a[1]*a[6]-a[0]*a[7],a[1]*a[5]-a[2]*a[4],a[2]*a[3]-a[0]*a[5],a[0]*a[4]-a[1]*a[3]];}
 function map3(a,p){return[0,1,2].map(j=>a[j*3]*p[0]+a[j*3+1]*p[1]+a[j*3+2]*p[2]);}
 function warpNormals(base,result,normalField,phenotypes){const out=normalField.slice(),c=result.calibration.structure,f=result.calibration.torsoFrame,w=result.packet.weights;if(c.gain===0)return out;for(let i=0;i<out.length/3;i++){const p=Array.from(base.sharedRestVertices.subarray(i*3,i*3+3)),mask=masks(p,f);if(!mask.trunk&&!mask.shoulder)continue;const A=Array(9).fill(0);for(let k=w.ptr[i];k<w.ptr[i+1];k++){const skin=result.rig.skinMatrices[w.joints[k]];for(let r=0;r<3;r++)for(let j=0;j<3;j++)A[r*3+j]+=w.values[k]*skin[r*4+j];}const n=[normalField[i*3],-normalField[i*3+2],normalField[i*3+1]],rest=[0,1,2].map(k=>A[k]*n[0]+A[3+k]*n[1]+A[6+k]*n[2]),moved=map3(cofactor(A),map3(cofactor(jacobian(p,f,phenotypes,c.gain)),rest)),length=Math.hypot(...moved);if(length>1e-10)out.set([moved[0]/length,moved[2]/length,-moved[1]/length],i*3);}return out;}
 function preset(original,name='adult'){if(name==='r18')return BodyCalibrationR18.preset(original,'adult');const s=BodyCalibrationR18.preset(original,name);Object.assign(s.bodyCalibration,{structureVersion:19,structureGain:1,normalMode:"warp-derivative"});return s;}
 function create(source){const d=createBodyDriverR18(source),evaluate=d.evaluate;d.evaluate=(state,options)=>{const r=evaluate(state,options),c=state.bodyCalibration;if(!c?.enabled||c.structureVersion!==19)return r;
   const gain=c.structureGain??1,normalBlend=c.fieldNormalBlend??0;if(!Number.isFinite(gain)||gain<0||gain>1.5||!Number.isFinite(normalBlend)||normalBlend<0||normalBlend>1)throw Error('Invalid R19 regional calibration');
   const f=r.calibration.torsoFrame,w=r.packet.weights,rest=r.packet.restPositionsPerInfluence;let maximum=0,changed=0;
   for(let i=0;i<source.bodyCount;i++){const p=Array.from(r.sharedRestVertices.subarray(i*3,i*3+3)),delta=displacement(p,f,state.anny.phenotypes,gain),length=Math.hypot(...delta);maximum=Math.max(maximum,length);if(length===0)continue;changed++;const posed=[0,0,0];for(let k=w.ptr[i];k<w.ptr[i+1];k++){for(let j=0;j<3;j++)rest[k*3+j]+=delta[j];const q=M.vector(r.rig.skinMatrices[w.joints[k]],delta);for(let j=0;j<3;j++)posed[j]+=w.values[k]*q[j];}for(let j=0;j<3;j++){r.vertices[i*3+j]+=posed[j];r.sharedRestVertices[i*3+j]+=delta[j];}}
   r.calibration.structure={version:19,gain,normalMode:c.normalMode||"legacy",fieldNormalBlend:normalBlend,maxAdditionalCorrectionMM:maximum*1000,correctedSamples:changed,method:'regional broad fields and shoulder cap; rest-space complete-influence transport'};return r;
  };return d;}
 globalThis.BodyStructureR19={smooth,bell,masks,displacement,jacobian,cofactor,map3,warpNormals,preset,create};globalThis.createBodyDriverR19=create;
})();
