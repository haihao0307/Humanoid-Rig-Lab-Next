import {createFacePartition} from './FacePartition.mjs';
// Project-authored compact surface fields, metres in the neutral canonical frame.
// Landmarks calibrated on this character's regenerated surface, not clinical
// muscle measurements. FACS labels describe actions, not one-to-one muscles.
export const FACE_FRAME={part:2,centre:[0,1.635,.10],eyes:[.034,1.656,.102],mouth:[.026,1.586,.103],front:[.035,.068],lower:[1.535,1.550],upper:[1.702,1.719]};
// name, label, centre(x>=0,y,z), support radii, action associations, kind, pull.
// Left is the character's +X side. Eye/jaw fields are reservations, not fake
// eye rotations or a jaw deformation across a fused lips/teeth surface.
const PAIRS=[
 ['frontalisInner','额肌内侧',[.020,1.681,.113],[.033,.026,.036],['AU1'],'skin',[0,1,0]],
 ['frontalisOuter','额肌外侧',[.052,1.680,.100],[.033,.025,.037],['AU2'],'skin',[0,1,0]],
 ['corrugator','皱眉区域',[.020,1.671,.115],[.023,.016,.032],['AU4'],'skin',[-.5,-1,0]],
 ['lidUpper','上眼睑带',[.034,1.660,.105],[.027,.008,.024],['AU5','AU7','AU45'],'lid',[0,0,0]],
 ['lidLower','下眼睑带',[.034,1.651,.104],[.029,.009,.026],['AU7','AU45'],'lid',[0,0,0]],
 ['orbital','眼轮匝肌眶周',[.049,1.644,.096],[.034,.025,.033],['AU6'],'skin',[0,1,.15]],
 ['nasalis','鼻翼区域',[.018,1.618,.124],[.019,.015,.030],['noseFlare'],'skin',[1,0,0]],
 ['noseWrinkler','鼻唇提肌区域',[.020,1.629,.124],[.021,.025,.032],['AU9'],'skin',[0,1,0]],
 ['lipRaiser','上唇提肌区域',[.017,1.604,.117],[.023,.022,.030],['AU10'],'skin',[0,1,0]],
 ['zygomaticMinor','颧小肌区域',[.035,1.619,.110],[.028,.029,.034],['AU11'],'skin',[.3,1,0]],
 ['zygomaticMajor','颧大肌区域',[.043,1.606,.100],[.035,.030,.034],['AU12'],'skin',[1,1,0]],
 ['risorius','笑肌区域',[.047,1.587,.093],[.033,.018,.038],['AU20'],'skin',[1,0,0]],
 ['buccinator','颊肌区域',[.060,1.611,.079],[.035,.036,.040],['AU14'],'skin',[0,0,-1]],
 ['lipUpper','上唇口轮匝区',[.012,1.593,.119],[.023,.009,.026],['AU22','AU23','AU24'],'skin',[0,0,1]],
 ['lipLower','下唇口轮匝区',[.012,1.581,.116],[.023,.009,.027],['AU22','AU23','AU24'],'skin',[0,0,1]],
 ['mouthCorner','口角结点',[.026,1.586,.103],[.019,.017,.032],['AU12','AU15','AU20'],'skin',[1,.6,0]],
 ['cornerDepressor','降口角肌区域',[.034,1.571,.098],[.029,.025,.034],['AU15'],'skin',[.3,-1,0]],
 ['lowerLipDepressor','降下唇肌区域',[.016,1.573,.112],[.021,.022,.028],['AU16'],'skin',[0,-1,0]],
 ['mentalis','颏肌区域',[.012,1.558,.108],[.023,.018,.029],['AU17'],'skin',[0,1,.3]],
 ['eyeSurface','眼表保护区',[.034,1.656,.102],[.018,.0055,.020],['eyeLook'],'eye',[0,0,0]],
 ['canthusInner','内眼角约束',[.019,1.655,.110],[.009,.008,.022],['lidAnchor'],'anchor',[0,0,0]],
 ['canthusOuter','外眼角约束',[.050,1.655,.097],[.010,.009,.024],['lidAnchor'],'anchor',[0,0,0]],
];
export const FACE_REGIONS=PAIRS.flatMap(([key,label,centre,radii,actions,kind,pull])=>[1,-1].map(sign=>({id:key+(sign===1?'Left':'Right'),label:(sign===1?'左':'右')+' · '+label,centre:[centre[0]*sign,centre[1],centre[2]],radii:[...radii],actions:[...actions],kind,pull:[pull[0]*sign,pull[1],pull[2]],side:sign===1?'Left':'Right'})));
FACE_REGIONS.push({id:'procerus',label:'中央 · 鼻根降眉区',centre:[0,1.665,.123],radii:[.020,.021,.031],actions:['AU4','AU9'],kind:'skin',pull:[0,-1,0],side:'Centre'},{id:'jawSupport',label:'中央 · 下颌控制预留',centre:[0,1.560,.089],radii:[.082,.041,.057],actions:['AU26','AU27'],kind:'jaw',pull:[0,0,0],side:'Centre'});
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
const ramp=(a,b,x)=>smooth((x-a)/(b-a));
function frontGate([x,y,z],part){return part===FACE_FRAME.part?ramp(...FACE_FRAME.front,z)*ramp(...FACE_FRAME.lower,y)*(1-ramp(...FACE_FRAME.upper,y))*(1-ramp(.076,.096,Math.abs(x))):0;}
export const faceMask=(point,part=FACE_FRAME.part)=>frontGate(point,part);
// Compact C2 ellipsoidal support. No chart IDs, UV islands or material seams
// enter the field; equal canonical surface positions have equal weights.
function support(point,region){let q=0;for(let i=0;i<3;i++)q+=((point[i]-region.centre[i])/region.radii[i])**2;return q<1?(1-q)**3:0;}
function eyeProtection([x,y,z]){const q=((Math.abs(x)-FACE_FRAME.eyes[0])/.0185)**2+((y-FACE_FRAME.eyes[1])/.0055)**2,depth=ramp(.070,.082,z)*(1-ramp(.124,.134,z));return 1-(1-ramp(.75,1.35,q))*depth;}
export function faceWeight(point,region,part=FACE_FRAME.part){const r=typeof region==='string'?FACE_REGIONS.find(r=>r.id===region):region;if(!r)return 0;const g=frontGate(point,part);return g?g*support(point,r)*(r.kind==='skin'?eyeProtection(point):1):0;}
export function sampleFaceWeights(point,part=FACE_FRAME.part){return FACE_REGIONS.map(r=>faceWeight(point,r,part));}
// Public driver contract. Each bilateral input is independent [0,1]. These
// map to overlapping actuator fields; they are not normalized like bone weights.
export const FACE_ACTIONS={
 browInnerUp:['frontalisInner'],browOuterUp:['frontalisOuter'],browDown:['corrugator','procerus'],
 cheekSquint:['orbital'],noseSneer:['noseWrinkler','nasalis'],mouthUpperUp:['lipRaiser'],
 mouthSmile:['zygomaticMajor','mouthCorner'],mouthDimple:['buccinator'],mouthStretch:['risorius'],
 mouthFrown:['cornerDepressor','mouthCorner'],mouthLowerDown:['lowerLipDepressor'],
 mouthPucker:['lipUpper','lipLower'],mouthPress:['lipUpper','lipLower'],chinRaise:['mentalis'],
 eyeBlink:['lidUpper','lidLower'],eyeWide:['lidUpper'],eyeLook:['eyeSurface'],jawOpen:['jawSupport']
};
export function resolveFaceAction(action,side='Left'){if(!FACE_ACTIONS[action]||!['Left','Right','Both'].includes(side))throw Error('Unknown facial action/side');return FACE_REGIONS.filter(r=>FACE_ACTIONS[action].some(key=>r.id===key||r.id.startsWith(key))&&(side==='Both'||r.side===side||r.side==='Centre')).map(r=>({region:r.id,status:r.kind==='skin'?'field-ready':'structure-required'}));}
export function createFacialBinding(surface,data){
 const chartParts=new Map(data.charts.map(c=>[c.id,c.part])),vertices=[],offsets=[0],ids=[],weights=[],totals=FACE_REGIONS.map(r=>({id:r.id,label:r.label,kind:r.kind,samples:0,peak:0}));
 const base=[],normals=[];let maxOverlap=0;
 for(let i=0;i<surface.positions.length/3;i++){
  const p=Array.from(surface.positions.subarray(i*3,i*3+3)),part=chartParts.get(surface.chartIds[i]);if(!frontGate(p,part))continue;
  const row=sampleFaceWeights(p,part);let overlaps=0;for(let j=0;j<row.length;j++)if(row[j]>0){ids.push(j);weights.push(row[j]);totals[j].peak=Math.max(totals[j].peak,row[j]);if(row[j]>.01)totals[j].samples++;overlaps++;}
  vertices.push(i);base.push(...p);normals.push(...surface.normals.subarray(i*3,i*3+3));offsets.push(ids.length);maxOverlap=Math.max(maxOverlap,overlaps);
 }
 const rows={vertices:new Uint32Array(vertices),offsets:new Uint32Array(offsets),ids:new Uint8Array(ids),weights:new Float32Array(weights)};
 const basePositions=new Float32Array(base),baseNormals=new Float32Array(normals),report={regions:FACE_REGIONS.length,sampledVertices:vertices.length,nonzeroWeights:weights.length,maxOverlap,channels:totals,generatedCacheBytes:Object.values(rows).reduce((s,a)=>s+a.byteLength,0)+basePositions.byteLength+baseNormals.byteLength,persistedVertexWeights:0};
 const partition=createFacePartition({basePositions,baseNormals,mask:faceMask});
 let attached=null,currentRegion=null,currentAmount=0,afterDeform=null;const pullLimits=new Map();
 function gradientAt(p,region){const eps=.00002;return [0,1,2].map(j=>{const a=[...p],b=[...p];a[j]+=eps;b[j]-=eps;return (faceWeight(a,region)-faceWeight(b,region))/(2*eps);});}
 function pullLimit(region,unit){if(pullLimits.has(region.id))return pullLimits.get(region.id);let slope=0;for(let k=0;k<vertices.length;k++){const p=Array.from(basePositions.subarray(k*3,k*3+3));if(faceWeight(p,region)>0)slope=Math.min(slope,gradientAt(p,region).reduce((s,v,j)=>s+v*unit[j],0));}const limit=Math.min(.0015,slope<0?.18/-slope:.0015);pullLimits.set(region.id,limit);return limit;}
 function deform(regionId,amount=0){
  if(!attached)throw Error('Attach face binding first');const region=FACE_REGIONS.find(r=>r.id===regionId);amount=clamp(Number(amount)||0);
  if(amount&&(!region||region.kind!=='skin'))throw Error('Independent eyelid/eye/jaw structure required');
  currentRegion=region||null;currentAmount=amount;const unit=(region?.pull||[0,0,0]).map(v=>v/Math.max(1,Math.hypot(...(region?.pull||[0,0,0])))),limit=amount?pullLimit(region,unit):.0015,direction=unit.map(v=>v*amount*limit);
  const positions=attached.geometry.attributes.position,n=attached.geometry.attributes.normal;let maxDisplacement=0,minJacobian=1;
  for(let k=0;k<vertices.length;k++){
   const i=vertices[k],p=Array.from(basePositions.subarray(k*3,k*3+3)),normal=Array.from(partition.normals.subarray(k*3,k*3+3)),w=amount?faceWeight(p,region):0;
   const displacement=direction.map(v=>v*w);positions.setXYZ(i,...[0,1,2].map(j=>partition.positions[k*3+j]+displacement[j]));maxDisplacement=Math.max(maxDisplacement,Math.hypot(...displacement));
   if(amount&&w){const gradient=gradientAt(p,region),det=1+gradient.reduce((s,v,j)=>s+v*direction[j],0),dot=normal.reduce((s,v,j)=>s+v*direction[j],0);minJacobian=Math.min(minJacobian,det);const out=normal.map((v,j)=>v-gradient[j]*dot/det),length=Math.hypot(...out);n.setXYZ(i,...out.map(v=>v/length));}else n.setXYZ(i,...normal);
  }
  if(vertices.length){const first=vertices[0]*3,last=vertices.at(-1)*3+3;for(const attribute of [positions,n]){attribute.addUpdateRange(first,last-first);attribute.needsUpdate=true;}}
  afterDeform?.();return {maxDisplacement,minJacobian,amount,region:regionId,pullLimitMetres:limit};
 }
 const gradients=new Float32Array(weights.length*3);
 report.gradientCacheBytes=gradients.byteLength;report.generatedCacheBytes+=gradients.byteLength;
 for(let k=0;k<vertices.length;k++){const p=Array.from(basePositions.subarray(k*3,k*3+3));for(let j=rows.offsets[k];j<rows.offsets[k+1];j++)gradients.set(gradientAt(p,FACE_REGIONS[rows.ids[j]]),j*3);}
 // Expression supports are broader than diagnostic muscle patches. A visible
 // feature must move together, including the surrounding skin and lip corners.
 const featureRegions=FACE_REGIONS.map(r=>({...r,radii:r.radii.map((x,i)=>x*[1.4,1.55,1.8][i])}));
 const featureOffsets=[0],featureIds=[],featureWeights=[],featureGradients=[];
 function featureWeight(p,r){const q=((Math.abs(p[0])-.034)/.020)**2+((p[1]-1.656)/.010)**2,protect=ramp(1,3,q);const noseAnchor=/^(nasalis|noseWrinkler)/.test(r.id)?ramp(.007,.016,Math.abs(p[0])):1;return frontGate(p,FACE_FRAME.part)*support(p,r)*protect*noseAnchor;}
 for(let k=0;k<vertices.length;k++){const p=Array.from(basePositions.subarray(k*3,k*3+3));for(let j=0;j<featureRegions.length;j++){const r=featureRegions[j],w=featureWeight(p,r);if(r.kind!=='skin'||w<=0)continue;featureIds.push(j);featureWeights.push(w);for(let a=0;a<3;a++){const u=[...p],v=[...p];u[a]+=.00002;v[a]-=.00002;featureGradients.push((featureWeight(u,r)-featureWeight(v,r))/.00004);}}featureOffsets.push(featureIds.length);}
 const actionRows={offsets:new Uint32Array(featureOffsets),ids:new Uint8Array(featureIds),weights:new Float32Array(featureWeights)},actionGradients=new Float32Array(featureGradients);
 report.expressionCacheBytes=Object.values(actionRows).reduce((s,a)=>s+a.byteLength,0)+actionGradients.byteLength;report.generatedCacheBytes+=report.expressionCacheBytes;
 function deformActions(actions={}){
  const rows=actionRows,gradients=actionGradients;
  if(!attached)throw Error('Attach face binding first');const vectors=FACE_REGIONS.map(()=>[0,0,0]);
  for(const [action,value]of Object.entries(actions)){if(!FACE_ACTIONS[action])throw Error('Unknown face action');const amounts=Array.isArray(value)?value:[value,value];
   for(let j=0;j<FACE_REGIONS.length;j++){const r=FACE_REGIONS[j];if(r.kind!=='skin'||!FACE_ACTIONS[action].some(key=>r.id===key||r.id.startsWith(key)))continue;const amount=clamp(r.side==='Centre'?((amounts[0]||0)+(amounts[1]||0))*.5:amounts[r.side==='Right'?1:0]||0),sign=r.side==='Right'?-1:1;
    let pull=r.pull,scale=action==='browInnerUp'||action==='browOuterUp'?.006:action==='browDown'?.011:action==='mouthSmile'?(r.id.startsWith('mouthCorner')?.007:.010):action==='mouthFrown'||action==='mouthUpperUp'?.0045:action==='noseSneer'?.002:.006;
    if(action==='mouthPress'){pull=[0,r.id.startsWith('lipUpper')?-1:1,-.15];scale=.0013;}
    if(action==='mouthPucker'){pull=[-sign*.6,0,.8];scale=.005;}
    if(action==='mouthFrown'&&r.id.startsWith('mouthCorner'))pull=[sign*.15,-1,0];
    const length=Math.max(1,Math.hypot(...pull));for(let a=0;a<3;a++)vectors[j][a]+=amount*scale*pull[a]/length;
   }
  }
  // Limit sampled compression and coordinate stretch of the combined field. Continuous bisection
  // avoids discrete amplitude steps while expressions blend. This is a sample
  // safeguard, not a proof of global injectivity between generated vertices.
  const jacobians=[];for(let k=0;k<vertices.length;k++){const J=Array(9).fill(0);for(let q=rows.offsets[k];q<rows.offsets[k+1];q++){const v=vectors[rows.ids[q]];for(let a=0;a<3;a++)for(let b=0;b<3;b++)J[a*3+b]+=v[a]*gradients[q*3+b];}jacobians.push(J);}
  const valid=scale=>jacobians.every(J=>{const a=1+J[0]*scale,b=J[1]*scale,c=J[2]*scale,e=J[3]*scale,f=1+J[4]*scale,g=J[5]*scale,h=J[6]*scale,i=J[7]*scale,j=1+J[8]*scale;return a*(f*j-g*i)-b*(e*j-g*h)+c*(e*i-f*h)>.425&&Math.max(Math.hypot(a,e,h),Math.hypot(b,f,i),Math.hypot(c,g,j))<1.75;});
  let safeScale=1;if(!valid(1)){let high=1,low=.92;while(!valid(low)&&low>.05){high=low;low*=.92;}for(let i=0;i<12;i++){const mid=(low+high)/2;if(valid(mid))low=mid;else high=mid;}safeScale=low;}vectors.forEach(v=>v.forEach((x,i)=>v[i]=x*safeScale));
  const positions=attached.geometry.attributes.position,n=attached.geometry.attributes.normal;let maxDisplacement=0,minJacobian=1,maxCoordinateStretch=1;
  for(let k=0;k<vertices.length;k++){const p=Array.from(basePositions.subarray(k*3,k*3+3)),normal=Array.from(partition.normals.subarray(k*3,k*3+3)),d=[0,0,0],J=[1,0,0,0,1,0,0,0,1];
   for(let q=rows.offsets[k];q<rows.offsets[k+1];q++){const v=vectors[rows.ids[q]];for(let a=0;a<3;a++){d[a]+=v[a]*rows.weights[q];for(let b=0;b<3;b++)J[a*3+b]+=v[a]*gradients[q*3+b];}}
   const [a,b,c,e,f,g,h,i,j]=J,C=[f*j-g*i,g*h-e*j,e*i-f*h,c*i-b*j,a*j-c*h,b*h-a*i,b*g-c*f,c*e-a*g,a*f-b*e],det=a*C[0]+b*C[1]+c*C[2],out=[0,1,2].map(k=>C[k*3]*normal[0]+C[k*3+1]*normal[1]+C[k*3+2]*normal[2]),length=Math.hypot(...out);
   positions.setXYZ(vertices[k],...[0,1,2].map(a=>partition.positions[k*3+a]+d[a]));n.setXYZ(vertices[k],...out.map(x=>x/Math.max(length,1e-9)));maxDisplacement=Math.max(maxDisplacement,Math.hypot(...d));minJacobian=Math.min(minJacobian,det);maxCoordinateStretch=Math.max(maxCoordinateStretch,Math.hypot(a,e,h),Math.hypot(b,f,i),Math.hypot(c,g,j));
  }
  if(vertices.length)for(const attribute of [positions,n]){attribute.addUpdateRange(vertices[0]*3,vertices.at(-1)*3+3-vertices[0]*3);attribute.needsUpdate=true;}
  afterDeform?.();return {maxDisplacement,minJacobian,maxCoordinateStretch,safeScale,actions:{...actions}};
 }
 return {partition,set afterDeform(fn){afterDeform=fn;},setShape(input){const result=partition.apply(input);deform(null,0);return result;},regions:FACE_REGIONS,actions:FACE_ACTIONS,rows,report,sample:sampleFaceWeights,resolveAction:resolveFaceAction,attach(mesh){attached=mesh;return this},deform,deformActions,reset(){return deform(null,0)},get selectedRegion(){return currentRegion?.id},get amount(){return currentAmount}};
}

