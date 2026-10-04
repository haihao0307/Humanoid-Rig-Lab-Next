// INITIAL placement only. Source polygons are interpreted by nonzero winding
// as filled planar sets, then the axis-containing connected union is sampled
// by its OUTERMOST ray exit. This is not solid skin or a measurement operator.
// Winding-number reference: https://www.engr.colostate.edu/~dga/documents/papers/point_in_polygon.pdf
// In particular, a non-star-shaped union gets a declared radial envelope,
// NOT a claim that the filled radial gaps were observed body surface.
const EPS=1e-9,TAU=2*Math.PI,RAYS=360;
const mix=(a,b,t)=>a.map((x,k)=>x+(b[k]-x)*t);
const distance=(a,b)=>Math.hypot(...a.map((x,k)=>x-b[k]));
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
function fail(code,details){const e=new Error(code);e.code=code;e.details=details;throw e;}
export function shortsInitialPolygonMembership(p,points){
 let winding=0;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[2]-a[2],l2=dx*dx+dz*dz,t=l2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/l2)):0;
  if(Math.hypot(p[0]-a[0]-t*dx,p[2]-a[2]-t*dz)<=EPS)return 'boundary';
  const o=dx*(p[2]-a[2])-dz*(p[0]-a[0]);
  if(a[2]<=p[2]&&b[2]>p[2]&&o>0)winding++;
  if(a[2]>p[2]&&b[2]<=p[2]&&o<0)winding--;
 }
 return winding?'inside':'outside';
}
function pairPredicate(a,b,i,j){
 const aInB=a.map(p=>shortsInitialPolygonMembership(p,b)),bInA=b.map(p=>shortsInitialPolygonMembership(p,a)),intersections=[];
 for(let ai=0;ai<a.length;ai++)for(let bi=0;bi<b.length;bi++){
  const p=a[ai],q=a[(ai+1)%a.length],r=b[bi],s=b[(bi+1)%b.length];
  if(Math.max(p[0],q[0])+EPS<Math.min(r[0],s[0])||Math.max(r[0],s[0])+EPS<Math.min(p[0],q[0])||Math.max(p[2],q[2])+EPS<Math.min(r[2],s[2])||Math.max(r[2],s[2])+EPS<Math.min(p[2],q[2]))continue;
  const e=[q[0]-p[0],q[2]-p[2]],f=[s[0]-r[0],s[2]-r[2]],delta=[r[0]-p[0],r[2]-p[2]],den=cross(e,f);
  if(Math.abs(den)>1e-20){const ta=cross(delta,f)/den,tb=cross(delta,e)/den;if(ta>=-1e-10&&ta<=1+1e-10&&tb>=-1e-10&&tb<=1+1e-10)intersections.push({aEdge:ai,bEdge:bi,aParameter:ta,bParameter:tb,point:mix(p,q,Math.max(0,Math.min(1,ta))),kind:ta>1e-10&&ta<1-1e-10&&tb>1e-10&&tb<1-1e-10?'proper-crossing':'touch'});}
  else if(shortsInitialPolygonMembership(p,[r,s])==='boundary'||shortsInitialPolygonMembership(q,[r,s])==='boundary'||shortsInitialPolygonMembership(r,[p,q])==='boundary'||shortsInitialPolygonMembership(s,[p,q])==='boundary')intersections.push({aEdge:ai,bEdge:bi,kind:'collinear-touch-or-overlap'});
 }
 return {aIndex:i,bIndex:j,aVertexMembershipInB:aInB,bVertexMembershipInA:bInA,intersections,properCrossingCount:intersections.filter(x=>x.kind==='proper-crossing').length,touchOrOverlapCount:intersections.filter(x=>x.kind!=='proper-crossing').length,connected:intersections.length>0||aInB.some(x=>x!=='outside')||bInA.some(x=>x!=='outside')};
}
export function shortsInitialAnatomicalAxis(landmarks,y,side,midX){
 const negative=['left','negativeX'].includes(side),audit={y,side,midX};
 if(!negative&&!['right','positiveX'].includes(side))fail('HOLD_TAPE_INITIAL_AXIS_SIDE',audit);
 const pairs=[['thighL','calfL'],['thighR','calfR']].filter(([a])=>Array.isArray(landmarks?.[a])&&(negative?landmarks[a][0]<midX:landmarks[a][0]>midX));
 if(pairs.length!==1)fail('HOLD_TAPE_INITIAL_AXIS_OWNERSHIP',{...audit,pairs});
 const [thighName,calfName]=pairs[0],thigh=landmarks[thighName],calf=landmarks[calfName];
 if(!Array.isArray(calf)||![...thigh,...calf,y].every(Number.isFinite)||Math.abs(calf[1]-thigh[1])<1e-12||y<Math.min(thigh[1],calf[1])||y>Math.max(thigh[1],calf[1]))fail('HOLD_TAPE_INITIAL_AXIS_JOINT_RANGE',{...audit,thigh,calf});
 const alpha=(y-thigh[1])/(calf[1]-thigh[1]);return {point:mix(thigh,calf,alpha),thighName,calfName,thigh:thigh.slice(),calf:calf.slice(),alpha,authority:'requested plane intersection with actual same-leg thigh/calf joint segment, no extrapolation'};
}
export function createShortsInitialExteriorContour(details,axis,{side,bodyToken}={}){
 const audit={y:details?.y,side,currentAllLoops:details?.loops??[],originalSourceDetails:details,axis,pairPredicates:[],components:[],axisMemberships:[]},reject=(code,extra={})=>fail(code,{...audit,...extra});
 if(!details?.scope?.startsWith('actual native visible ')||details.rawClosedLoopCount<1||details.rawComponents!==details.rawClosedLoopCount||details.nonDegreeTwoNodes!==0||details.openEndpoints?.length||details.loops?.length!==details.rawClosedLoopCount)reject('HOLD_TAPE_INITIAL_EXTERIOR_SOURCE_COMPONENTS');
 const y=details.y,pole=axis?.point;
 if(!Array.isArray(pole)||pole.length!==3||!pole.every(Number.isFinite)||Math.abs(pole[1]-y)>1e-9)reject('HOLD_TAPE_INITIAL_EXTERIOR_AXIS');
 const loops=details.loops,polygons=loops.map(l=>l.sourceWitnesses?.map(w=>w.point));
 if(polygons.some((p,i)=>!p||p.length<3||p.some(v=>v.length!==3||!v.every(Number.isFinite)||Math.abs(v[1]-y)>1e-7)||loops[i].sourceSegments?.length!==p.length))reject('HOLD_TAPE_INITIAL_EXTERIOR_SOURCE_WITNESSES');
 // Require actual triangle segment provenance before mixing its barycentrics.
 for(const loop of loops)for(const row of loop.sourceSegments){const a=row.a?.witness,b=row.b?.witness;if(!a||!b||a.triangleId!==b.triangleId||JSON.stringify(a.indices)!==JSON.stringify(b.indices)||a.weights?.length!==3||b.weights?.length!==3)reject('HOLD_TAPE_INITIAL_EXTERIOR_SEGMENT_PROVENANCE');}
 const adjacency=loops.map(()=>[]);
 for(let i=0;i<loops.length;i++)for(let j=i+1;j<loops.length;j++){const p=pairPredicate(polygons[i],polygons[j],i,j);audit.pairPredicates.push(p);if(p.connected){adjacency[i].push(j);adjacency[j].push(i);}}
 const visited=new Set();for(let i=0;i<loops.length;i++)if(!visited.has(i)){const component=[],stack=[i];visited.add(i);while(stack.length){const j=stack.pop();component.push(j);for(const k of adjacency[j])if(!visited.has(k)){visited.add(k);stack.push(k);}}audit.components.push(component);}
 audit.axisMemberships=polygons.map(p=>shortsInitialPolygonMembership(pole,p));
 const candidates=audit.components.filter(c=>c.some(i=>audit.axisMemberships[i]==='inside'));
 if(candidates.length!==1)reject('HOLD_TAPE_INITIAL_EXTERIOR_AXIS_UNION_INTERIOR',{candidateComponents:candidates});
 const selected=candidates[0],rows=selected.flatMap(loopIndex=>loops[loopIndex].sourceSegments.map((row,segmentIndex)=>({row,loopIndex,segmentIndex})));
 function ray(theta){
  const direction=[Math.sin(theta),Math.cos(theta)],hits=[];
  const add=(row,loopIndex,segmentIndex,t,radius)=>{if(radius<-EPS||t<-1e-10||t>1+1e-10)return;t=Math.max(0,Math.min(1,t));hits.push({radius:Math.max(0,radius),point:mix(row.a.point,row.b.point,t),witness:{...row.a.witness,weights:mix(row.a.witness.weights,row.b.witness.weights,t)},loopIndex,segmentIndex,segmentParameter:t});};
  for(const {row,loopIndex,segmentIndex}of rows){const a=[row.a.point[0]-pole[0],row.a.point[2]-pole[2]],e=[row.b.point[0]-row.a.point[0],row.b.point[2]-row.a.point[2]],den=cross(direction,e);
   if(Math.abs(den)>1e-20)add(row,loopIndex,segmentIndex,cross(a,direction)/den,cross(a,e)/den);
   else if(Math.abs(cross(a,direction))<=1e-12){add(row,loopIndex,segmentIndex,0,a[0]*direction[0]+a[1]*direction[1]);const b=[row.b.point[0]-pole[0],row.b.point[2]-pole[2]];add(row,loopIndex,segmentIndex,1,b[0]*direction[0]+b[1]*direction[1]);}
  }
  hits.sort((a,b)=>a.radius-b.radius);const cuts=[{radius:0}];for(const hit of hits)if(hit.radius>cuts.at(-1).radius+1e-10)cuts.push(hit);else if(cuts.at(-1).radius>0)cuts[cuts.length-1]=hit;
  const intervals=[];
  for(let i=1;i<cuts.length;i++){const lower=cuts[i-1].radius,upper=cuts[i].radius,mid=(lower+upper)/2,p=[pole[0]+direction[0]*mid,y,pole[2]+direction[1]*mid];if(selected.some(k=>shortsInitialPolygonMembership(p,polygons[k])!=='outside')){if(intervals.length&&Math.abs(intervals.at(-1).upperM-lower)<1e-9){intervals.at(-1).upperM=upper;intervals.at(-1).exit=cuts[i];}else intervals.push({lowerM:lower,upperM:upper,exit:cuts[i]});}}
  if(!intervals.length||intervals[0].lowerM>EPS)reject('HOLD_TAPE_INITIAL_EXTERIOR_MISSING_AXIS_RAY',{theta,intervals,cuts});
  const exit=intervals.at(-1).exit,filledGaps=[];for(let i=1;i<intervals.length;i++)if(intervals[i].lowerM>intervals[i-1].upperM+EPS)filledGaps.push({lowerM:intervals[i-1].upperM,upperM:intervals[i].lowerM,lengthM:intervals[i].lowerM-intervals[i-1].upperM});
  if(!exit.witness||exit.radius<=EPS)reject('HOLD_TAPE_INITIAL_EXTERIOR_EXIT',{theta,exit});
  return {theta,...exit,unionIntervals:intervals.map(({lowerM,upperM})=>({lowerM,upperM})),filledGaps};
 }
 const samples=Array.from({length:RAYS},(_,i)=>ray(TAU*i/RAYS)),loop=samples.map(s=>s.point),bounds={min:[Infinity,y,Infinity],max:[-Infinity,y,-Infinity]},sectors={frontNegativeX:0,frontPositiveX:0,backNegativeX:0,backPositiveX:0};let circumferenceM=0;
 for(let i=0;i<RAYS;i++){const a=loop[i],b=loop[(i+1)%RAYS],length=distance(a,b);circumferenceM+=length;for(const k of [0,2]){bounds.min[k]=Math.min(bounds.min[k],a[k]);bounds.max[k]=Math.max(bounds.max[k],a[k]);}const mid=mix(a,b,.5);sectors[(mid[2]>=pole[2]?'front':'back')+(mid[0]>=pole[0]?'PositiveX':'NegativeX')]+=length;}
 const frontM=sectors.frontNegativeX+sectors.frontPositiveX,backM=sectors.backNegativeX+sectors.backPositiveX,filledRays=samples.filter(s=>s.filledGaps.length),filledLengths=filledRays.flatMap(s=>s.filledGaps.map(g=>g.lengthM));
 const scope='INITIAL anatomical-axis radial exterior envelope of connected actual closed source polygon winding sets; not measured skin, exact polygon union, rest or collision authority';
 const receipt={schema:'r008-shorts-connected-source-radial-initial-guide/v1',y,side,scope,bodyToken,measured:false,rawSourceClosed:false,initialGuide:true,estimatedInterface:true,sourceConnectedComponentRawClosed:true,axis,centerX:pole[0],centerZ:pole[2],currentAllLoops:loops,originalSourceDetails:details,pairPredicates:audit.pairPredicates,components:audit.components,axisMemberships:audit.axisMemberships,selectedComponentLoopIndices:selected,excludedDisconnectedLoopIndices:loops.map((_,i)=>i).filter(i=>!selected.includes(i)),noAreaOrCircumferenceFiltering:true,filledGapRayCount:filledRays.length,maximumFilledRadialGapM:filledLengths.length?Math.max(...filledLengths):0,totalSampledFilledRadialGapM:filledLengths.reduce((a,b)=>a+b,0),rayWitnesses:samples,exactUnionClaimed:false,betweenRayEnvelopeCertified:false,sourceWindingInterpretation:'each raw closed source polygon is a nonzero-winding filled set for INITIAL exterior only, holes are not negative body/collision domains',loopOrder:'360 rays front(+Z) -> positiveX -> back(-Z) -> negativeX about the actual same-leg joint axis',guideCircumferenceM:circumferenceM,strictMeasurementOrBodyChanged:false,paperDimensionsDerivedFromGuide:false,physicalWearingValidated:false};
 return {y,scope,valid:true,loop,points:loop,centerX:pole[0],centerZ:pole[2],bounds,minX:bounds.min[0],maxX:bounds.max[0],minZ:bounds.min[2],maxZ:bounds.max[2],circumferenceM,sectors,frontM,backM,frontArcM:frontM,backArcM:backM,measured:false,rawSourceClosed:false,initialGuide:true,estimatedInterface:true,sourceConnectedComponentRawClosed:true,contours:[{points:loop,closed:true,rawSourceClosed:false}],receipt,pointAtAngle(theta){if(!Number.isFinite(theta))reject('HOLD_TAPE_INITIAL_EXTERIOR_ANGLE',{theta});return ray(theta).point;}};
}
