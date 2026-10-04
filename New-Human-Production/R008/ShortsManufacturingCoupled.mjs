import {paperPrincipal} from './ShortsManufacturingMetric.mjs';
// Static cut-paper/sewing authoring only. No native integration, predictor,
// lambda, gravity, body contact or calibrated physical energy is replaced.
// The mass-weighted damped CG/backtracking construction follows the project's
// original ShortsWaistCoupledBlock static authoring mathematics.
const dot=(a,b)=>a.reduce((sum,x,k)=>sum+x*b[k],0),distance=(a,b)=>Math.hypot(...a.map((x,k)=>x-b[k]));
// Smooth source metric rows. Their common zero set is exactly F^T F = I,
// independently of principal direction ordering at equal eigenvalues. These
// rows do not define a new rest metric: t.inv is the original source2D chart.
export function manufacturingPaperGramRow(cloth,t,mode){
 const [a,b,c]=t.q.map(i=>cloth.positions[i]),m=t.inv,ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]),u=ab.map((v,k)=>v*m[0]+ac[k]*m[2]),v=ab.map((x,k)=>x*m[1]+ac[k]*m[3]),cu=[-m[0]-m[2],m[0],m[2]],cv=[-m[1]-m[3],m[1],m[3]];
 if(mode===0)return {value:dot(u,u)-1,gradients:cu.map(g=>u.map(v=>2*g*v))};
 if(mode===1)return {value:dot(v,v)-1,gradients:cv.map(g=>v.map(v=>2*g*v))};
 if(mode===2)return {value:dot(u,v),gradients:cu.map((g,i)=>u.map((x,k)=>g*v[k]+cv[i]*x))};
 throw Error('Manufacturing source Gram row must be uu, vv or uv');
}
function inspectGColumns(rows,cloth){
 const g=cloth.draft.ranges.find(r=>r.pieceId==='G'),ids=[...new Set(Array.from({length:g.count},(_,i)=>cloth.quotient[g.offset+i]))],columns=ids.flatMap(i=>[i*3,i*3+1,i*3+2]),index=new Map(columns.map((x,i)=>[x,i])),n=columns.length,local=[];
 for(const row of rows){const v=new Float64Array(n);for(const [k,a]of row.entries)if(index.has(k))v[index.get(k)]+=a;const length=Math.hypot(...v);if(length>1e-12)local.push({kind:row.kind,v:Float64Array.from(v,x=>x/length)});}
 const gram=Array.from({length:n},()=>new Float64Array(n));for(const {v}of local)for(let p=0;p<n;p++)for(let q=0;q<n;q++)gram[p][q]+=v[p]*v[q];
 for(let sweep=0;sweep<60;sweep++){let maximum=0;for(let p=0;p<n;p++)for(let q=p+1;q<n;q++){const apq=gram[p][q];maximum=Math.max(maximum,Math.abs(apq));if(Math.abs(apq)<1e-12)continue;const tau=(gram[q][q]-gram[p][p])/(2*apq),t=(tau>=0?1:-1)/(Math.abs(tau)+Math.hypot(1,tau)),c=1/Math.hypot(1,t),s=t*c;gram[p][p]-=t*apq;gram[q][q]+=t*apq;gram[p][q]=gram[q][p]=0;for(let k=0;k<n;k++)if(k!==p&&k!==q){const a=gram[k][p],b=gram[k][q];gram[k][p]=gram[p][k]=c*a-s*b;gram[k][q]=gram[q][k]=s*a+c*b;}}if(maximum<1e-12)break;}
 const eigenvalues=gram.map((row,i)=>row[i]).sort((a,b)=>b-a),threshold=eigenvalues[0]*1e-10,positive=eigenvalues.filter(x=>x>threshold);let maximumSeamMaterialCosine=0;for(const a of local.filter(r=>r.kind==='source-seam'))for(const b of local.filter(r=>r.kind==='paper'))maximumSeamMaterialCosine=Math.max(maximumSeamMaterialCosine,Math.abs(dot(a.v,b.v)));
 return {scope:'read-only normalized Jacobian restricted to actual G coordinates; external cloth columns omitted explicitly',columns:n,rows:local.length,rank:positive.length,threshold,positiveSpectrumJacobianCondition:Math.sqrt(positive[0]/positive.at(-1)),maximumSeamMaterialCosine,eigenvalues};
}
export function solveManufacturingBlock(cloth,threads,{maximumIterations=40}={}){
 if(!Number.isInteger(maximumIterations)||maximumIterations<1||maximumIterations>40)throw Error('Manufacturing joint solve is bounded to forty iterations');
 const identity=cloth.materialIdentity(),trace=[],dimension=cloth.positions.length*3,active=new Set(threads.flatMap(e=>[e.a,e.b]));let initialLocalJacobianAudit=null;
 const adjacency=cloth.neighbours;for(let ring=0;ring<2;ring++)for(const i of [...active])for(const j of adjacency[i])active.add(j);
 for(let iteration=0;iteration<maximumIterations;iteration++){
  const rows=[];
  const add=(ids,gradients,value,kind,evaluate)=>{
   if(!ids.some(id=>active.has(id)))return;
   const entries=new Map();ids.forEach((id,j)=>{if(active.has(id))gradients[j].forEach((g,k)=>{const index=id*3+k;entries.set(index,(entries.get(index)||0)+g*Math.sqrt(cloth.invMass[id]));});});
   const norm=Math.hypot(...entries.values());if(norm<1e-14)return;
   rows.push({entries:[...entries].map(([i,g])=>[i,g/norm]),rhs:-value/norm,norm,kind,evaluate});
  };
  // Gram derivatives passed independent finite differences, but the single
  // bounded production experiment reduced normalized merit while principal
  // strain increased to 452.8%. Keep that rejected experiment in QA; it is not
  // the production residual. Source principal rows retain their original gate.
  for(const t of cloth.triangles)for(const mode of [0,1]){const a=paperPrincipal(cloth,t,mode);if(!a.gradients)throw Error('Collapsed manufacturing material');add(t.q,a.gradients,a.sigma-1,'paper',()=>paperPrincipal(cloth,t,mode).sigma-1);}
  for(const e of cloth.edges){const a=cloth.positions[e.a],b=cloth.positions[e.b],l=distance(a,b);if(l<1e-12)throw Error('Collapsed manufacturing edge');const g=a.map((x,k)=>(x-b[k])/l/e.rest);add([e.a,e.b],[g,g.map(x=>-x)],l/e.rest-1,'paper-edge',()=>distance(cloth.positions[e.a],cloth.positions[e.b])/e.rest-1);}
  for(const e of threads)for(let k=0;k<3;k++){const g=[0,0,0];g[k]=1;add([e.a,e.b],[g,g.map(x=>-x)],cloth.positions[e.a][k]-cloth.positions[e.b][k],'source-seam',()=>cloth.positions[e.a][k]-cloth.positions[e.b][k]);}
  if(iteration===0)initialLocalJacobianAudit=inspectGColumns(rows,cloth);
  const components=()=>{const out={};for(const r of rows)out[r.kind]=(out[r.kind]||0)+(r.evaluate()/r.norm)**2;return out;},energy=c=>Object.values(c).reduce((sum,x)=>sum+x,0),initialComponents=components(),initialEnergy=energy(initialComponents),rhs=new Float64Array(dimension);
  for(const r of rows)for(const [k,g]of r.entries)rhs[k]+=g*r.rhs;
  const multiply=v=>{const out=Float64Array.from(v,x=>x*.01);for(const r of rows){let s=0;for(const [k,g]of r.entries)s+=g*v[k];for(const [k,g]of r.entries)out[k]+=g*s;}return out;};
  const delta=new Float64Array(dimension);let residual=Float64Array.from(rhs),direction=Float64Array.from(rhs),rr=dot(residual,residual),cgIterations=0;
  for(;cgIterations<Math.min(120,dimension)&&rr>1e-24;cgIterations++){const q=multiply(direction),den=dot(direction,q);if(!(den>0))throw Error('Nonpositive damped manufacturing system');const alpha=rr/den;for(let k=0;k<dimension;k++){delta[k]+=alpha*direction[k];residual[k]-=alpha*q[k];}const next=dot(residual,residual),beta=next/rr;for(let k=0;k<dimension;k++)direction[k]=residual[k]+beta*direction[k];rr=next;}
  const old=cloth.positions.map(p=>[...p]),proposedMoveM=Math.max(...cloth.positions.map((p,i)=>Math.hypot(...delta.subarray(i*3,i*3+3))*Math.sqrt(cloth.invMass[i])));if(!Number.isFinite(proposedMoveM))throw Error('Nonfinite manufacturing proposal');const scale=Math.min(1,.003/Math.max(1e-30,proposedMoveM));let acceptedFraction=0,finalEnergy=initialEnergy,finalComponents=initialComponents;
  // Read-only derivative observer: identical frozen row weights and direction.
  const energyAt=fraction=>{for(let i=0;i<cloth.positions.length;i++)for(let k=0;k<3;k++)cloth.positions[i][k]=old[i][k]+delta[i*3+k]*Math.sqrt(cloth.invMass[i])*scale*fraction;return energy(components());};
  const analyticDirectionalDerivative=-2*dot(rhs,delta)*scale,epsilon=1e-4,finiteDifferenceDirectionalDerivative=(energyAt(epsilon)-energyAt(-epsilon))/(2*epsilon);
  energyAt(0);
  const directionalDerivativeRelativeError=Math.abs(analyticDirectionalDerivative-finiteDifferenceDirectionalDerivative)/Math.max(1e-30,Math.abs(analyticDirectionalDerivative),Math.abs(finiteDifferenceDirectionalDerivative));
  const descentAudit={analyticDirectionalDerivative,finiteDifferenceDirectionalDerivative,directionalDerivativeRelativeError,relativeCGResidual:Math.sqrt(rr)/Math.max(1e-30,Math.hypot(...rhs)),rhsDotDelta:dot(rhs,delta),deltaADelta:dot(delta,multiply(delta)),smallerStepObservations:[]};
  // The audited direction is genuinely descending; stopping at 1/16 falsely
  // declared failure. Bounded Armijo backtracking uses the same frozen merit.
  if(!(analyticDirectionalDerivative<0)||directionalDerivativeRelativeError>1e-3){const a=cloth.audit(false);trace.push({iteration:iteration+1,rows:rows.length,cgIterations,proposedMoveM,maximumAppliedMoveM:0,acceptedFraction:0,initialEnergy,finalEnergy:initialEnergy,descentAudit,mainStrain:a.mainStrain,gapM:Math.max(0,...threads.map(e=>distance(cloth.positions[e.a],cloth.positions[e.b]))),finite:a.finite,stopReason:'Manufacturing direction failed independent finite-difference descent check'});break;}
  for(let power=0;power<=20;power++){
   const fraction=2**(-power);
   for(let i=0;i<cloth.positions.length;i++)for(let k=0;k<3;k++)cloth.positions[i][k]=old[i][k]+delta[i*3+k]*Math.sqrt(cloth.invMass[i])*scale*fraction;
   const c=components(),e=energy(c);if(Number.isFinite(e)&&e<initialEnergy&&e<=initialEnergy+1e-4*fraction*analyticDirectionalDerivative){acceptedFraction=fraction;finalEnergy=e;finalComponents=c;break;}
  }
  if(!acceptedFraction){for(let power=5;power<=20;power++){const fraction=2**(-power);descentAudit.smallerStepObservations.push({fraction,energy:energyAt(fraction)});}energyAt(0);}
  const a=cloth.audit(false),gapM=Math.max(0,...threads.map(e=>distance(cloth.positions[e.a],cloth.positions[e.b])));trace.push({iteration:iteration+1,rows:rows.length,cgIterations,proposedMoveM,maximumAppliedMoveM:proposedMoveM*scale*acceptedFraction,acceptedFraction,initialEnergy,finalEnergy,initialComponents,finalComponents,descentAudit,mainStrain:a.mainStrain,gapM,finite:a.finite});
  if((a.manufacturingMaterialValid&&gapM<=.0001)||!acceptedFraction||!a.finite)break;
 }
 if(identity!==cloth.materialIdentity())throw Error('Manufacturing block changed source material');
 return {scope:'bounded simultaneous static manufacturing residual solve only',paperResidualMechanism:'original two source principal-stretch residuals',rejectedGramExperiment:'qa/shorts-lowwaist-gram-coupled-20261002.json; smooth Gram helper is derivative-diagnostic only and not called by this solve',finalAcceptanceMechanism:'unchanged actual source principal-strain five-percent and source-seam gap gate',activeActualDofs:[...active],initialLocalJacobianAudit,trace,paperUnchanged:true,bodyContactEnabled:false,nativeIntegrationChanged:false,selfContactValidated:false};
}
