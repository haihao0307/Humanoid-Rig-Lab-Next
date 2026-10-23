/* Project-authored anatomical surface fields. These are estimated exterior
 * forms, not observations of internal muscles. Bone heads only locate the
 * fields; source-derived shape, weights and complete archive remain explicit.
 * Units: metres, common Z-up. No topology or polygon construction. */
(()=>{'use strict';const M=globalThis.BodyMathR01,S=BodyStructureR19,smooth=S.smooth,bell=S.bell;
const add=(a,b)=>a.map((x,k)=>x+b[k]),sub=(a,b)=>a.map((x,k)=>x-b[k]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
function segment(a,b,side,kind){const axis=M.unit(sub(b,a)),frontSeed=[0,-1,0],front=M.unit(sub(frontSeed,mul(axis,dot(frontSeed,axis)))),lateral=M.unit(M.cross(axis,front));return{a,b,axis,front,lateral,length:M.norm(sub(b,a)),side,kind};}
function frame(driver,state,result){const f={...result.calibration.torsoFrame,segments:[]},shape=driver.anny,q=shape.forward({phenotypes:state.anny.phenotypes,localChanges:state.anny.localChanges,pose:{},supportReference:BodyCalibrationR18.support({phenotypes:state.anny.phenotypes,localChanges:state.anny.localChanges})}),pos=n=>{const j=shape.boneLabels.indexOf(n);if(j<0)throw Error('Anatomy anchor missing: '+n);return Array.from(q.boneHeads.subarray(j*3,j*3+3));};
 for(const side of['L','R']){const sign=side==='L'?1:-1;for(const [kind,a,b]of[['upperarm','upperarm01','lowerarm01'],['forearm','lowerarm01','wrist'],['thigh','upperleg01','lowerleg01'],['calf','lowerleg01','foot']])f.segments.push(segment(pos(a+'.'+side),pos(b+'.'+side),sign,kind));}
 const isA=result.owners.rig==='anny',names=result.rig.names,rest=result.rig.restMatrices,posed=result.rig.posedMatrices,skins=result.rig.skinMatrices,position=(name,matrices)=>M.position(matrices[names.indexOf(name)]),angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,M.dot(a,b))));
 f.motion={};
 for(const side of['L','R']){const prefix=side==='L'?'l':'r',label=(a,b)=>isA?a+'.'+side:prefix+'_'+b,upper=label('upperarm01','uparm'),elbow=label('lowerarm01','lowarm'),wrist=label('wrist','wrist'),hip=label('upperleg01','upleg'),knee=label('lowerleg01','lowleg'),ankle=label('foot','foot'),direction=(a,b,matrices)=>M.unit(M.sub(position(b,matrices),position(a,matrices))),chest=names.indexOf(isA?'spine01':'c_spine3'),pelvis=names.indexOf(isA?'spine05':'c_spine0'),armLocal=M.unit(M.vector(M.inverse(skins[chest]),direction(upper,elbow,posed))),legLocal=M.unit(M.vector(M.inverse(skins[pelvis]),direction(hip,knee,posed))),armRest=direction(upper,elbow,rest),legRest=direction(hip,knee,rest),elbowFlex=Math.max(0,(angle(direction(upper,elbow,posed),direction(elbow,wrist,posed))-angle(armRest,direction(elbow,wrist,rest)))/1.5),kneeFlex=Math.max(0,(angle(direction(hip,knee,posed),direction(knee,ankle,posed))-angle(legRest,direction(knee,ankle,rest)))/1.5);
  f.motion[side]={raise:Math.max(0,Math.min(1,(armLocal[2]-armRest[2])/1.1)),hipFlex:Math.max(0,Math.min(1,(legRest[1]-legLocal[1])/.9)),elbowFlex:Math.min(1,elbowFlex),kneeFlex:Math.min(1,kneeFlex)};
 }
 for(const s of f.segments){const m=f.motion[s.side===1?'L':'R'];s.contraction=s.kind==='upperarm'||s.kind==='forearm'?m.elbowFlex:m.kneeFlex;}
 return f;
}
function composition(ph){const fat=ph.weight??.5,muscle=ph.muscle??.35,sex=ph.gender??0,age=ph.age??.5,maturity=smooth(.16,.44,age),cover=1-.98*smooth(.31,.87,fat);return{fat,muscle,sex,age,maturity,cover,definition:(.45+.70*muscle)*cover*(.15+.85*maturity),volume:.48+.65*muscle,scaleSex:1-.42*sex};}
function displacement(p,f,ph,gain=1){if(!gain)return[0,0,0];const c=composition(ph),x=p[0]-f.origin[0],y=p[1]-f.origin[1],u=(p[2]-f.origin[2])/f.height,a=Math.abs(x)/f.halfWidth,sign=Math.sign(x),scale=f.height/.54,d=[0,0,0],front=1-smooth(-.025,.035,y),back=1-front;
 const trunk=smooth(-.40,-.23,u)*(1-smooth(.95,1.015,u))*(1-smooth(.80,1.13,a));
 if(trunk){
  // Chest masses sweep into the humerus; costal edge and abdomen are broader
  // than their separating grooves. Fat cover changes geometry, not just light.
  const pec=bell(u,.725-.040*a,.105)*bell(a,.43,.32),pecEdge=bell(u,.593-.055*a,.037)*bell(a,.46,.36),sternal=bell(u,.73,.18)*bell(a,0,.14),costal=bell(u,.48-.12*a,.043)*smooth(.23,.42,a)*(1-smooth(.77,.99,a));
  const rectus=bell(a,.175,.14)*(bell(u,.43,.075)+.85*bell(u,.285,.073)+.60*bell(u,.145,.080)),linea=bell(a,0,.045)*bell(u,.285,.26),umbilicus=bell(a,0,.07)*bell(u,.14,.025),oblique=bell(a,.55-.16*u,.18)*bell(u,.24,.23);
  let serratus=0;for(let i=0;i<3;i++)serratus+=bell(u,.66-i*.075-.12*(a-.66),.032)*bell(a,.76,.17);
  const clavicle=bell(u,.91-.065*a,.026)*smooth(.09,.28,a)*(1-smooth(.82,1.02,a)),neckBand=bell(a,.16+.32*(1-u),.105)*bell(u,.97,.17),groin=bell(u,-.16+.22*a,.035)*smooth(.18,.40,a)*(1-smooth(.78,.98,a));
  d[1]-=front*trunk*(c.definition*c.scaleSex*(.015*pec-.0040*pecEdge-.0014*sternal+.0050*rectus-.0015*linea-.0018*umbilicus+.0035*serratus+.0032*oblique+.0037*costal)+c.cover*(.0042*clavicle+.0024*neckBand-.0022*groin));
  // Fill the excessively hollow inherited central chest, while keeping the
  // lower costal transition distinct from the upper abdominal volume.
  d[1]-=front*trunk*c.cover*c.scaleSex*.010*bell(u,.73,.17)*bell(a,0,.32);
  d[1]+=front*trunk*c.definition*.003*bell(u,.51,.12)*bell(a,.25,.45);
  const scapular=bell(a,.46,.27)*bell(u,.755,.15),scapularSpine=bell(u,.80-.12*a,.037)*bell(a,.44,.30),lat=bell(a,.70,.24)*bell(u,.48,.25),erector=bell(a,.17+.045*u,.105)*bell(u,.40,.35),spine=bell(a,0,.055)*bell(u,.54,.38),trap=bell(a,.16+.40*(.97-u),.24)*bell(u,.87,.15),lumbar=bell(a,.38,.27)*bell(u,.13,.17);
  const glute=bell(a,.48,.31)*bell(u,-.20,.19),gluteFold=bell(u,-.365+.055*a,.030)*bell(a,.50,.28),iliac=bell(u,-.025+.055*a,.040)*bell(a,.71,.20);
  d[1]+=back*trunk*(c.definition*(.008*scapular+.004*scapularSpine+.008*lat+.0055*erector-.0028*spine+.005*trap-.002*lumbar)+(.007+.005*c.muscle)*glute-.0025*c.cover*gluteFold);
  d[0]+=sign*trunk*smooth(.20,.55,a)*(c.definition*(.005*lat-.004*bell(u,.28,.17))+.0045*c.cover*iliac);
  const motion=f.motion?.[sign>=0?'L':'R'],raise=motion?.raise||0,hipFlex=motion?.hipFlex||0,pectoralSweep=bell(u,.72,.13)*bell(a,.68,.25),scapularSweep=bell(u,.77,.17)*bell(a,.50,.30),hipFold=bell(u,-.11,.12)*bell(a,.50,.27);
  d[1]+=trunk*(-front*.004*c.definition*raise*pectoralSweep+back*.003*c.definition*raise*scapularSweep-front*.0035*hipFlex*hipFold);
  d[2]+=trunk*(.008*raise*pectoralSweep*front+.005*raise*scapularSweep*back+.004*hipFlex*hipFold*front);
 }
 // Deltoid wraps the shoulder cap rather than a screen-facing circle.
 const shoulder=smooth(.58,.72,u)*(1-smooth(.90,1.00,u))*smooth(.64,.82,a)*(1-smooth(1.20,1.48,a));
 if(shoulder){const cap=bell(a,1.025,.22)*bell(u,.805,.11),heads=1+.15*Math.cos(Math.atan2(y,.07)*3);d[0]+=sign*.009*cap*shoulder*c.volume*heads;d[1]+=.006*Math.tanh(y/.035)*cap*shoulder*c.volume;d[2]+=.003*cap*shoulder*c.volume;}
 // Long-bone coordinates retain proportions and left/right asymmetry. Fields
 // have finite radial/axial support, so nearby fingers and neck are protected.
 for(const s of f.segments){const v=sub(p,s.a),t=dot(v,s.axis)/s.length;if(t<-.20||t>1.15)continue;const radial=sub(v,mul(s.axis,t*s.length)),r=M.norm(radial),radius=s.kind==='thigh'?.13:s.kind==='calf'?.095:s.kind==='upperarm'?.09:.07;
  const mask=(1-smooth(radius*.78,radius*1.25,r))*smooth(-.16,.04,t)*(1-smooth(.94,1.13,t));if(mask<1e-7||r<.003)continue;
  const n=mul(radial,1/r),facing=dot(n,s.front),lateral=dot(n,s.lateral)*s.side,F=smooth(-.25,.75,facing),B=smooth(-.25,.75,-facing);let amount=0;
  if(s.kind==='upperarm'){const contract=s.contraction||0;amount=c.definition*(.0085/(1-.25*contract)*bell(t,.48-.07*contract,.24*(1-.25*contract))*F+.0100*(1-.18*contract)*bell(t,.48,.27)*B+.003*bell(t,.78,.16)*Math.abs(lateral));}
  if(s.kind==='forearm')amount=c.definition*(.0065*bell(t,.25,.22)*( .45+.55*Math.abs(lateral))+.0035*bell(t,.49,.27)*B-.0018*bell(t,.78,.19)*F);
  if(s.kind==='thigh'){const medial=smooth(.05,.75,-lateral);amount=c.definition*(.011*bell(t,.45,.29)*F+.007*bell(t,.75,.14)*medial*F+.008*bell(t,.38,.29)*B+.0045*bell(t,.50,.30)*Math.max(0,lateral));}
  if(s.kind==='calf')amount=c.definition*(.012*bell(t,.28,.19)*B*(.82+.18*Math.cos(lateral*3))+.005*bell(t,.50,.26)*B+.0045*bell(t,.34,.32)*F*Math.abs(lateral)-.002*bell(t,.79,.16)*B);
  const q=mul(n,amount*mask);for(let k=0;k<3;k++)d[k]+=q[k];
 }
 return mul(d,gain*scale);
}
function jacobian(p,f,ph,gain=1){const J=[1,0,0,0,1,0,0,0,1],e=.0002;for(let k=0;k<3;k++){const l=p.slice(),r=p.slice();l[k]-=e;r[k]+=e;const a=displacement(l,f,ph,gain),b=displacement(r,f,ph,gain);for(let j=0;j<3;j++)J[j*3+k]+=(b[j]-a[j])/(2*e);}return J;}
function warpNormals(base,result,input,ph){const c=result.calibration.anatomy;if(!c?.gain)return input;const out=input.slice(),w=result.packet.weights,f=c.frame;for(let i=0;i<out.length/3;i++){const p=Array.from(base.sharedRestVertices.subarray(i*3,i*3+3));if(M.norm(displacement(p,f,ph,c.gain))<1e-9)continue;const A=Array(9).fill(0);for(let k=w.ptr[i];k<w.ptr[i+1];k++){const m=result.rig.skinMatrices[w.joints[k]];for(let r=0;r<3;r++)for(let j=0;j<3;j++)A[r*3+j]+=w.values[k]*m[r*4+j];}const n=[input[i*3],-input[i*3+2],input[i*3+1]],rest=[0,1,2].map(k=>A[k]*n[0]+A[3+k]*n[1]+A[6+k]*n[2]),v=S.map3(S.cofactor(A),S.map3(S.cofactor(jacobian(p,f,ph,c.gain)),rest)),length=M.norm(v);if(length>1e-10)out.set([v[0]/length,v[2]/length,-v[1]/length],i*3);}return out;}
function preset(original,name='adult'){if(name==='r19')return S.preset(original,'adult');const s=S.preset(original,name);if(name!=='r18')Object.assign(s.bodyCalibration,{anatomyVersion:20,anatomyGain:1,articulation:1,digitFunctions:true,footFunctions:true});return s;}
function create(source){const d=createBodyDriverR19(source),evaluate=d.evaluate;d.evaluate=(state,options)=>{const r=evaluate(state,options),c=state.bodyCalibration;if(!c?.enabled||c.anatomyVersion!==20)return r;const gain=c.anatomyGain??1;if(!Number.isFinite(gain)||gain<0||gain>1.5)throw Error('Invalid anatomy field strength');const f=frame(d,state,r),w=r.packet.weights,rest=r.packet.restPositionsPerInfluence;let maximum=0,changed=0;for(let i=0;i<source.bodyCount;i++){const p=Array.from(r.sharedRestVertices.subarray(i*3,i*3+3)),delta=displacement(p,f,state.anny.phenotypes,gain),length=M.norm(delta);maximum=Math.max(maximum,length);if(length<1e-12)continue;changed++;const posed=[0,0,0];for(let k=w.ptr[i];k<w.ptr[i+1];k++){for(let j=0;j<3;j++)rest[k*3+j]+=delta[j];const q=M.vector(r.rig.skinMatrices[w.joints[k]],delta);for(let j=0;j<3;j++)posed[j]+=w.values[k]*q[j];}for(let j=0;j<3;j++){r.vertices[i*3+j]+=posed[j];r.sharedRestVertices[i*3+j]+=delta[j];}}r.calibration.anatomy={version:20,gain,...composition(state.anny.phenotypes),frame:f,maxAdditionalCorrectionMM:maximum*1000,correctedSamples:changed,independentWholeBody:false,estimatedSurfaceAnatomy:true,method:'authored trunk, scapular, deltoid and long-bone regional volume fields; complete influence transport'};return globalThis.BodyArticulationR20?BodyArticulationR20.apply(r,state):r;};return d;}
globalThis.BodyAnatomyR20={composition,frame,displacement,jacobian,warpNormals,preset,create};globalThis.createBodyDriverR20=create;
})();
