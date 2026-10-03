// Source-owned paper -> surface mechanics. Metres, kg, seconds; no posed rest mesh.
// XPBD: Macklin et al. 2016, https://matthias-research.github.io/pages/publications/XPBD.pdf
// C = F^T F is the first fundamental form; curvature is an independent term.
export const PAPER_SURFACE_MODEL = 'paper-metric-seams-energy-gates@1';
const sub=(a,b)=>a.map((x,k)=>x-b[k]),dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
const finite=v=>Array.isArray(v)&&v.every(Number.isFinite);
const requirePositive=(v,label)=>{if(!Number.isFinite(v)||v<=0)throw Error(label+' must be positive and finite');return v;};

export function paperTriangle(uv,{grainAngleRadians=0}={}){
 if(uv.length!==3||uv.some(p=>!finite(p)||p.length!==2)||!Number.isFinite(grainAngleRadians))throw Error('Invalid source paper coordinates/grain');
 const a=sub(uv[1],uv[0]),b=sub(uv[2],uv[0]),det=a[0]*b[1]-a[1]*b[0];
 if(!Number.isFinite(det)||Math.abs(det)<=1e-14)throw Error('Degenerate/non-finite source paper triangle');
 const inv=[b[1]/det,-b[0]/det,-a[1]/det,a[0]/det],u=[-inv[0]-inv[2],inv[0],inv[2]],v=[-inv[1]-inv[3],inv[1],inv[3]];
 const c=Math.cos(grainAngleRadians),s=Math.sin(grainAngleRadians);
 return {uv:uv.map(p=>[...p]),areaM2:Math.abs(det)/2,signedAreaM2:det/2,inv,
  warpCoefficients:u.map((x,i)=>c*x+s*v[i]),weftCoefficients:u.map((x,i)=>-s*x+c*v[i]),grainAngleRadians};
}

export function evaluatePaperTriangle(reference,positions,material=null){
 if(positions.length!==3||positions.some(p=>!finite(p)||p.length!==3))throw Error('Invalid current surface triangle');
 const wc=reference.warpCoefficients,vc=reference.weftCoefficients;
 const fw=[0,1,2].map(k=>positions.reduce((n,p,i)=>n+wc[i]*p[k],0));
 const fv=[0,1,2].map(k=>positions.reduce((n,p,i)=>n+vc[i]*p[k],0));
 const g00=dot(fw,fw),g01=dot(fw,fv),g11=dot(fv,fv),disc=Math.hypot(g00-g11,2*g01);
 if(![g00,g01,g11,disc].every(Number.isFinite))throw Error('Non-finite derived material metric');
 const sigmaMin=Math.sqrt(Math.max(0,(g00+g11-disc)/2)),sigmaMax=Math.sqrt(Math.max(0,(g00+g11+disc)/2));
 // Diagonal orthotropic engineering energy; Poisson coupling is not calibrated.
 // U = A/2 * (Kw*Eww^2 + Kv*Evv^2 + Ks*Gwv^2), K in N/m.
 const rows=[
  {kind:'warp',value:.5*(g00-1),gradients:wc.map(c=>fw.map(x=>c*x))},
  {kind:'weft',value:.5*(g11-1),gradients:vc.map(c=>fv.map(x=>c*x))},
  {kind:'shear',value:g01,gradients:wc.map((c,i)=>fw.map((x,k)=>vc[i]*x+c*fv[k]))}
 ];
 let energyJ=null;
 if(material){
  const keys=['warpNPerM','weftNPerM','shearNPerM'];energyJ=0;
  rows.forEach((r,i)=>{const k=requirePositive(material[keys[i]],keys[i]);r.energyCoefficientJ=reference.areaM2*k;r.compliancePerJ=1/r.energyCoefficientJ;energyJ+=.5*r.energyCoefficientJ*r.value*r.value;});
 }
 return {firstForm:[g00,g01,g11],deformationColumns:[fw,fv],sigmaMin,sigmaMax,
  principalStrain:Math.max(Math.abs(sigmaMin-1),Math.abs(sigmaMax-1)),rows,energyJ,areaM2:reference.areaM2};
}

// One scalar XPBD linearisation. Pure: caller applies corrections and owns lambda.
// Coincident sewn source vertices must aggregate gradients BEFORE the denominator.
export function xpbdScalarStep({value,gradients,dofIndices,invMass,lambda=0,compliance,h}){
 requirePositive(h,'dt');if(!Number.isFinite(compliance)||compliance<0||!Number.isFinite(lambda)||!Number.isFinite(value))throw Error('Invalid XPBD scalar state');
 if(gradients.length!==dofIndices.length)throw Error('XPBD DOF/gradient count mismatch');
 const grouped=new Map();dofIndices.forEach((id,i)=>{
  if(!Number.isInteger(id)||id<0||!Number.isFinite(invMass[id])||invMass[id]<0||!finite(gradients[i])||gradients[i].length!==3)throw Error('Invalid XPBD DOF');
  if(!grouped.has(id))grouped.set(id,[0,0,0]);const g=grouped.get(id);for(let k=0;k<3;k++)g[k]+=gradients[i][k];
 });
 const alpha=compliance/(h*h),weightedGradient=[...grouped].reduce((s,[id,g])=>s+invMass[id]*dot(g,g),0),denominator=weightedGradient+alpha;
 if(!(denominator>0))return {status:'HOLD',reason:'No movable gradient and zero compliance',lambda,deltaLambda:0,corrections:[]};
 if(!Number.isFinite(alpha)||!Number.isFinite(denominator)||!Number.isFinite(weightedGradient))throw Error('Non-finite derived XPBD coefficient');
 const deltaLambda=(-value-alpha*lambda)/denominator;
 if(!Number.isFinite(deltaLambda)||!Number.isFinite(lambda+deltaLambda))throw Error('Non-finite XPBD multiplier');
 const corrections=[...grouped].map(([id,g])=>({id,delta:g.map(v=>invMass[id]*deltaLambda*v)}));
 if(corrections.some(c=>!finite(c.delta)))throw Error('Non-finite XPBD position correction');
 return {status:'LINEARISED',lambda:lambda+deltaLambda,deltaLambda,denominator,corrections};
}

export function auditSeamArc(edgeA,edgeB,{directionB='reverse',strainLimit=.05,notches=[]}={}){
 if(!['same','reverse'].includes(directionB)||!Number.isFinite(strainLimit)||strainLimit<0||strainLimit>=1)throw Error('Invalid seam direction/strain allowance');
 const arc=edge=>{
  if(edge.length<2||edge.some(p=>!finite(p)||p.length!==2))throw Error('Seam needs source 2D polyline');
  const s=[0];for(let i=1;i<edge.length;i++){const l=Math.hypot(...sub(edge[i],edge[i-1]));if(!(l>1e-12))throw Error('Zero source seam interval');s.push(s.at(-1)+l);}return s;
 };
 const b=directionB==='reverse'?[...edgeB].reverse():edgeB,aArc=arc(edgeA),bArc=arc(b),aLength=aArc.at(-1),bLength=bArc.at(-1);
 // Different vertex counts are valid. Stations are matched in normalised SOURCE
 // arc length, not by array index. Notches explicitly delimit fabric feed zones.
 const stations=[{a:0,b:0},...notches,{a:1,b:1}];
 for(let i=1;i<stations.length;i++)if(!Number.isFinite(stations[i].a)||!Number.isFinite(stations[i].b)||stations[i].a>1||stations[i].b>1||stations[i].a<=stations[i-1].a||stations[i].b<=stations[i-1].b)throw Error('Seam notches must be ordered in both source arcs');
 const intervals=stations.slice(1).map((n,i)=>{
  const la=(n.a-stations[i].a)*aLength,lb=(n.b-stations[i].b)*bLength;
  const lower=Math.max((1-strainLimit)*la,(1-strainLimit)*lb),upper=Math.min((1+strainLimit)*la,(1+strainLimit)*lb);
  return {aLengthM:la,bLengthM:lb,admissibleLengthM:[lower,upper],compatible:lower<=upper+1e-12};
 });
 const sample=(edge,s,t)=>{const target=t*s.at(-1);let i=1;while(i<s.length-1&&s[i]<target)i++;const f=(target-s[i-1])/(s[i]-s[i-1]);return edge[i-1].map((v,k)=>v+f*(edge[i][k]-v));};
 return {status:intervals.every(i=>i.compatible)?'COMPATIBLE_LENGTH_ONLY':'HOLD',directionB,aLengthM:aLength,bLengthM:bLength,intervals,
  stations:[...new Set([...aArc.map(s=>s/aLength),...bArc.map(s=>s/bLength)])].sort((a,b)=>a-b).map(t=>({t,a:sample(edgeA,aArc,t),b:sample(b,bArc,t)})),
  spatialPlacementValidated:false,feedNotchValidated:notches.length>0};
}

export function compilePaperSurfaceModel(draft,{densityKgM2=.22,strainLimit=.05}={}){
 requirePositive(densityKgM2,'source area density');
 const uv=draft.sourceUV||draft.uvs,idx=draft.triangles,count=uv?.length/2;
 if(!Number.isInteger(count)||count<3||!idx||idx.length%3)throw Error('Malformed paper domain');
 const pieceOf=new Array(count).fill(null);for(const r of draft.ranges||[])for(let i=r.offset;i<r.offset+r.count;i++){if(i<0||i>=count||pieceOf[i]!==null)throw Error('Invalid/overlapping source piece range');pieceOf[i]=r.pieceId;}
 if(pieceOf.some(p=>p===null))throw Error('Unowned source paper vertex');
 const sourceMass=new Float64Array(count),triangles=[],sourceEdges=new Map();let areaM2=0;
 for(let t=0;t<idx.length;t+=3){
  const ids=Array.from(idx.slice(t,t+3));if(ids.some(i=>!Number.isInteger(i)||i<0||i>=count)||new Set(ids).size!==3||ids.some(i=>pieceOf[i]!==pieceOf[ids[0]]))throw Error('Invalid cross-piece paper triangle');
  const ref=paperTriangle(ids.map(i=>[uv[i*2],uv[i*2+1]]));areaM2+=ref.areaM2;ids.forEach(i=>sourceMass[i]+=densityKgM2*ref.areaM2/3);
  const triangle={ids,pieceId:pieceOf[ids[0]],reference:ref};triangles.push(triangle);
  for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');if(!sourceEdges.has(key))sourceEdges.set(key,[]);sourceEdges.get(key).push({triangle:t/3,a,b,opposite:ids[(k+2)%3],pieceId:triangle.pieceId});}
 }
 const seams=[];
 for(const s of draft.seams||[]){
  const pairs=s.pairs.map(p=>[p.a??p[0],p.b??p[1]]);if(pairs.length<2||pairs.some(p=>p.some(i=>!Number.isInteger(i)||i<0||i>=count)))throw Error('Invalid source seam '+s.id);
  if(pairs.some(p=>pieceOf[p[0]]!==pieceOf[pairs[0][0]]||pieceOf[p[1]]!==pieceOf[pairs[0][1]]||p[0]===p[1]))throw Error('Inconsistent source seam ownership '+s.id);
  if((s.a?.pieceId&&s.a.pieceId!==pieceOf[pairs[0][0]])||(s.b?.pieceId&&s.b.pieceId!==pieceOf[pairs[0][1]]))throw Error('Declared seam owner disagrees with source pairs: '+s.id);
  for(let i=1;i<pairs.length;i++)for(let side=0;side<2;side++){
   const key=[pairs[i-1][side],pairs[i][side]].sort((a,b)=>a-b).join(':');
   if(sourceEdges.get(key)?.length!==1)throw Error('Seam must reference a source boundary edge: '+s.id+' '+key);
  }
  const a=pairs.map(p=>[uv[p[0]*2],uv[p[0]*2+1]]),b=pairs.map(p=>[uv[p[1]*2],uv[p[1]*2+1]]);
  const audit=auditSeamArc(a,b,{directionB:'same',strainLimit});
  // These pairs already specify source direction. Audit every paired interval too;
  // equal total length alone cannot license a mismatched notch correspondence.
  const pairedIntervals=pairs.slice(1).map((p,i)=>auditSeamArc([a[i],a[i+1]],[b[i],b[i+1]],{directionB:'same',strainLimit}));
  seams.push({id:s.id,...audit,pairDirection:'explicit source pair order',pairedIntervalsCompatible:pairedIntervals.every(r=>r.status!=='HOLD'),pairedIntervalLengthsM:pairedIntervals.map(r=>[r.aLengthM,r.bLengthM])});
 }
 const hinges=[];let nonManifoldEdges=0;
 for(const [sourceEdge,faces] of sourceEdges){if(faces.length>2)nonManifoldEdges++;if(faces.length===2)hinges.push({sourceEdge,kind:'within-piece-flat-paper',restAngleRadians:0,faces,calibrated:false});}
 // Across seams is NOT an internal flat-paper hinge. The sewn quotient needs
 // consistent orientation plus an explicit seam constitutive law before bending.
 for(const s of seams)hinges.push({seamId:s.id,kind:'across-piece-seam',restAngleRadians:null,law:'UNSPECIFIED',calibrated:false});
 if(sourceMass.some(m=>!Number.isFinite(m)||m<=0))throw Error('Massless/unreferenced source paper vertex');
 return {version:PAPER_SURFACE_MODEL,status:nonManifoldEdges||seams.some(s=>s.status==='HOLD'||!s.pairedIntervalsCompatible)?'HOLD':'SOURCE_METRIC_VALID',
  triangles,seams,hinges,sourceMass,areaM2,massKg:areaM2*densityKgM2,sourceVertices:count,nonManifoldEdges,
  materialCalibrated:false,placementValidated:false,productionReady:false};
}

export function evaluatePaperSurface(model,positions,sourceToDof=null,{strainLimit=.05}={}){
 let maximumPrincipalStrain=0,worst=null,finiteState=true,degenerateSurfaceTriangles=0;
 for(const [i,t]of model.triangles.entries()){
  const p=t.ids.map(id=>positions[sourceToDof?sourceToDof[id]:id]);
  if(p.some(p=>!finite(p)||p.length!==3)){finiteState=false;continue;}
  const r=evaluatePaperTriangle(t.reference,p);if(r.sigmaMin<=1e-10)degenerateSurfaceTriangles++;
  if(r.principalStrain>maximumPrincipalStrain){maximumPrincipalStrain=r.principalStrain;worst={triangle:i,pieceId:t.pieceId,sourceIndices:t.ids,sigmaMin:r.sigmaMin,sigmaMax:r.sigmaMax};}
 }
 return {status:finiteState&&!degenerateSurfaceTriangles&&maximumPrincipalStrain<=strainLimit?'METRIC_VALID_ONLY':'HOLD',maximumPrincipalStrain,worst,finite:finiteState,degenerateSurfaceTriangles,strainLimit,curvatureValidated:false,contactValidated:false};
}

// A diamond gusset is allocated BEFORE cutting, from independent body tapes and
// design ease. It does not infer rest dimensions from the current 3D garment.
export function allocateDiamondRise({bodyTapeM,easeM,mainFraction,gussetWidthM}){
 requirePositive(bodyTapeM,'body tape');requirePositive(gussetWidthM,'gusset width');
 if(!Number.isFinite(easeM)||easeM<0||!Number.isFinite(mainFraction)||mainFraction<=0||mainFraction>=1)throw Error('Invalid source rise allocation');
 const totalRiseM=bodyTapeM+easeM,remainingMainRiseM=mainFraction*totalRiseM,gussetHeightM=(1-mainFraction)*totalRiseM;
 return {totalRiseM,remainingMainRiseM,gussetHeightM,gussetCutEdgeM:Math.hypot(gussetHeightM,gussetWidthM/2),
  budgetResidualM:remainingMainRiseM+gussetHeightM-totalRiseM,source:'independent body tape + declared 2D style allocation',hemMayMove:false};
}

export function auditRiseBudget({bodyTapeM,easeM,remainingMainRiseM,gussetHeightM,toleranceM=1e-8}){
 [bodyTapeM,remainingMainRiseM,gussetHeightM].forEach((x,i)=>requirePositive(x,'rise budget '+i));
 if(!Number.isFinite(easeM)||easeM<0||!Number.isFinite(toleranceM)||toleranceM<0)throw Error('Invalid rise budget allowance');
 const targetM=bodyTapeM+easeM,actualM=remainingMainRiseM+gussetHeightM,errorM=actualM-targetM;
 return {status:Math.abs(errorM)<=toleranceM?'BUDGET_VALID_ONLY':'HOLD',targetM,actualM,errorM,toleranceM};
}

export function auditSourcePathBound({sourcePath2D,targetA,targetB,strainLimit=.05,endpointSlackM=0}){
 if(sourcePath2D.length<2||sourcePath2D.some(p=>!finite(p)||p.length!==2)||!finite(targetA)||!finite(targetB)||targetA.length!==3||targetB.length!==3||!Number.isFinite(strainLimit)||strainLimit<0||!Number.isFinite(endpointSlackM)||endpointSlackM<0)throw Error('Invalid source path witness');
 const sourceLengthM=sourcePath2D.slice(1).reduce((s,p,i)=>s+Math.hypot(...sub(p,sourcePath2D[i])),0);requirePositive(sourceLengthM,'source path length');
 const targetDistanceM=Math.hypot(...sub(targetA,targetB)),requiredDistanceM=Math.max(0,targetDistanceM-endpointSlackM),maximumDistanceM=(1+strainLimit)*sourceLengthM;
 return {status:requiredDistanceM>maximumDistanceM+1e-12?'GUIDE_SOURCE_LENGTH_CONTRADICTION':'NECESSARY_BOUND_ONLY',sourceLengthM,targetDistanceM,requiredDistanceM,maximumDistanceM,ratio:requiredDistanceM/sourceLengthM,sufficient:false};
}

// Proper rigid hinge rotation; this sets an INITIAL manufacturing angle, not
// rest curvature. Caller owns the selected incident triangles and cycle closure.
export function rotateAboutMaterialHinge(points,edgeA,edgeB,angleRadians){
 if(!Number.isFinite(angleRadians)||[...points,edgeA,edgeB].some(p=>!finite(p)||p.length!==3))throw Error('Invalid hinge embedding');
 const e=sub(edgeB,edgeA),l=requirePositive(Math.hypot(...e),'material hinge length'),n=e.map(v=>v/l),c=Math.cos(angleRadians),s=Math.sin(angleRadians);
 return points.map(p=>{const v=sub(p,edgeA),cross=[n[1]*v[2]-n[2]*v[1],n[2]*v[0]-n[0]*v[2],n[0]*v[1]-n[1]*v[0]],along=dot(n,v);return v.map((x,k)=>edgeA[k]+c*x+s*cross[k]+(1-c)*along*n[k]);});
}

export function garmentPipelineGate({paper,surface=null,contact=null,appearance=null,material=null,sewing=null,motion=null}){
 const stages=[
  {id:'paper',pass:paper?.status==='SOURCE_METRIC_VALID',reason:'source domains / directed seam arc lengths'},
  {id:'surface-metric',pass:surface?.status==='METRIC_VALID_ONLY',reason:'3D deformation against unchanged 2D metric'},
  {id:'sewing',pass:sewing?.validated===true,reason:'directed seams / topology / hinge laws'},
  {id:'material',pass:material?.calibrated===true,reason:'area-integrated warp / weft / shear and bending'},
  {id:'contact',pass:contact?.validated===true,reason:'whole triangle body / self-contact'},
  {id:'shape',pass:appearance?.validated===true,reason:'waist / hem / crotch and silhouette'},
  {id:'motion',pass:motion?.validated===true,reason:'native motion with cloth forces and swept contact'}
 ];
 const firstFailure=stages.find(s=>!s.pass);return {version:PAPER_SURFACE_MODEL,status:firstFailure?'HOLD':'VERIFIED',blockedAt:firstFailure?.id??null,stages,productionReady:!firstFailure,canRunMotion:stages.slice(0,-1).every(s=>s.pass),restMetricMayChangeFromPose:false};
}
