import * as THREE from 'three';
import {createShortsInitialExteriorContour,shortsInitialAnatomicalAxis} from './ShortsInitialExteriorContour.mjs';

// Material drafting measurements, never a new cloth rest state. All points
// are intersections of CURRENT source triangles. Only scalar recipes and a
// bounded set of triangle witnesses belong in a persisted measurement receipt.
// https://threejs.org/docs/pages/Plane.html
// https://threejs.org/docs/pages/Matrix4.html
const TAU=2*Math.PI,RAYS=360,TOL=1e-7;
const distance=(a,b)=>Math.hypot(...a.map((x,k)=>x-b[k]));
const mix=(a,b,t)=>a.map((x,k)=>x+(b[k]-x)*t);
const cross2=(a,b)=>a[0]*b[1]-a[1]*b[0];
function fail(code,details){const e=new Error(code);e.code=code;e.details=details;throw e;}
function fingerprint(values){let h=2166136261;for(const value of values){const text=typeof value==='string'?value:JSON.stringify(value);for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);}return (h>>>0).toString(16).padStart(8,'0');}
function geometryFingerprint(...arrays){let h=2166136261;for(const array of arrays){const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);for(const b of bytes)h=Math.imul(h^b,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
function localArray(world,inverse){const out=new Float64Array(world.length),p=new THREE.Vector3();for(let i=0;i<world.length;i+=3)p.fromArray(world,i).applyMatrix4(inverse).toArray(out,i);return out;}
function intersect(positions,triangles,axis,level,scope,accept=()=>true){
 const rows=[];
 for(let ti=0;ti<triangles.length;ti++){
  const tri=triangles[ti],ids=tri.indices??tri;if(!accept(tri))continue;
  const points=ids.map(i=>Array.from(positions.subarray(i*3,i*3+3)));
  if(level<Math.min(...points.map(p=>p[axis]))||level>Math.max(...points.map(p=>p[axis])))continue;
  const hits=[];
  for(let j=0;j<3;j++){
   const a=points[j],b=points[(j+1)%3];
   if((a[axis]<=level&&b[axis]>level)||(b[axis]<=level&&a[axis]>level)){
    const t=(level-a[axis])/(b[axis]-a[axis]),point=mix(a,b,t),weights=[0,0,0];weights[j]=1-t;weights[(j+1)%3]=t;
    if(!hits.some(h=>distance(h.point,point)<1e-11))hits.push({point,witness:{scope,triangleId:tri.id??ti,indices:Array.from(ids),weights,part:tri.part??'authored-bare-pelvis'}});
   }
  }
  if(hits.length===2&&distance(hits[0].point,hits[1].point)>1e-11)rows.push({a:hits[0],b:hits[1]});
 }
 return rows;
}
function graph(rows){
 const nodes=[],edges=[],cells=new Map(),seen=new Set();let maximumWeldDisplacementM=0;
 function node(hit){const bin=hit.point.map(v=>Math.floor(v/TOL));for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){const key=[bin[0]+x,bin[1]+y,bin[2]+z].join(':');for(const i of cells.get(key)??[]){const d=distance(hit.point,nodes[i].point);if(d<=TOL){maximumWeldDisplacementM=Math.max(maximumWeldDisplacementM,d);return i;}}}
  const i=nodes.length,key=bin.join(':');nodes.push({...hit,id:i,edges:[]});if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);return i;
 }
 for(const row of rows){const a=node(row.a),b=node(row.b),key=a<b?a+':'+b:b+':'+a;if(a===b||seen.has(key))continue;seen.add(key);const i=edges.length;edges.push({a,b,lengthM:distance(nodes[a].point,nodes[b].point),source:row});nodes[a].edges.push(i);nodes[b].edges.push(i);}
 const components=[],visited=new Set();for(let start=0;start<nodes.length;start++){if(visited.has(start))continue;const ids=[],stack=[start];visited.add(start);while(stack.length){const i=stack.pop();ids.push(i);for(const ei of nodes[i].edges){const e=edges[ei],j=e.a===i?e.b:e.a;if(!visited.has(j)){visited.add(j);stack.push(j);}}}components.push(ids);}
 return {nodes,edges,components,maximumWeldDisplacementM};
}
function closedLoops(g){
 const loops=[];for(const ids of g.components){if(ids.length<3||ids.some(i=>g.nodes[i].edges.length!==2))continue;const order=[ids[0]];let previous=-1,current=ids[0];for(let count=0;count<=ids.length;count++){const next=g.nodes[current].edges.map(ei=>{const e=g.edges[ei];return e.a===current?e.b:e.a;}).find(i=>i!==previous);if(next===order[0])break;if(next===undefined||order.includes(next)){order.length=0;break;}order.push(next);previous=current;current=next;}if(order.length===ids.length)loops.push(order.map(i=>g.nodes[i]));}return loops;
}
function chainLength(points,closed=false){let s=0;for(let i=1;i<points.length;i++)s+=distance(points[i-1],points[i]);return s+(closed?distance(points.at(-1),points[0]):0);}
function quadrantLengths(points,cx,cz){
 const sectors={frontNegativeX:0,frontPositiveX:0,backNegativeX:0,backPositiveX:0};
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],cuts=[0,1];for(const [axis,c]of [[0,cx],[2,cz]]){if(Math.abs(b[axis]-a[axis])>1e-14){const t=(c-a[axis])/(b[axis]-a[axis]);if(t>0&&t<1)cuts.push(t);}}cuts.sort((a,b)=>a-b);for(let j=1;j<cuts.length;j++){const mid=mix(a,b,(cuts[j]+cuts[j-1])/2),key=(mid[2]>=cz?'front':'back')+(mid[0]>=cx?'PositiveX':'NegativeX');sectors[key]+=distance(a,b)*(cuts[j]-cuts[j-1]);}}
 return sectors;
}
function radial(rows,y,cx,cz){
 const samples=[];for(let i=0;i<RAYS;i++){const theta=TAU*i/RAYS,d=[Math.sin(theta),Math.cos(theta)];let best=null;
  for(const row of rows){const a=[row.a.point[0]-cx,row.a.point[2]-cz],e=[row.b.point[0]-row.a.point[0],row.b.point[2]-row.a.point[2]],den=cross2(d,e);if(Math.abs(den)<1e-14)continue;const radius=cross2(a,e)/den,t=cross2(a,d)/den;if(radius>=0&&t>=-1e-10&&t<=1+1e-10&&(!best||radius>best.radius)){const parameter=Math.max(0,Math.min(1,t)),point=mix(row.a.point,row.b.point,parameter),witness={...row.a.witness,weights:mix(row.a.witness.weights,row.b.witness.weights,parameter)};best={radius,point,witness};}}
  if(!best)fail('HOLD_TAPE_MISSING_SOURCE_RAY',{y,ray:i,centerX:cx,centerZ:cz});samples.push(best);
 }
 return samples;
}
function makeSection(rows,y,scope){
 if(rows.length<3)fail('HOLD_TAPE_EMPTY_SECTION',{y,scope,segments:rows.length});
 const g=graph(rows),loops=closedLoops(g),all=rows.flatMap(r=>[r.a.point,r.b.point]),bounds={min:[Infinity,y,Infinity],max:[-Infinity,y,-Infinity]};for(const p of all)for(const k of [0,2]){bounds.min[k]=Math.min(bounds.min[k],p[k]);bounds.max[k]=Math.max(bounds.max[k],p[k]);}
 const centerX=(bounds.min[0]+bounds.max[0])/2,centerZ=(bounds.min[2]+bounds.max[2])/2;let polar;
 const ranked=loops.map(loop=>({loop,length:chainLength(loop.map(h=>h.point),true)})).sort((a,b)=>b.length-a.length);
 if(ranked.length>1)fail('HOLD_TAPE_MULTIPLE_SECTION_LOOPS',{y,scope,rawClosedLoopCount:ranked.length,loops:ranked.map(r=>({circumferenceM:r.length,points:r.loop.length,minX:Math.min(...r.loop.map(h=>h.point[0])),maxX:Math.max(...r.loop.map(h=>h.point[0])),sourceWitnesses:r.loop.map(h=>({point:h.point,...h.witness})),sourceSegments:r.loop.map((h,i)=>{const next=r.loop[(i+1)%r.loop.length],e=g.edges[h.edges.find(ei=>{const edge=g.edges[ei];return edge.a===next.id||edge.b===next.id;})];return e.a===h.id?e.source:{a:e.source.b,b:e.source.a};})})),rawComponents:g.components.length,nonDegreeTwoNodes:g.nodes.filter(n=>n.edges.length!==2).length,openEndpoints:g.nodes.filter(n=>n.edges.length===1).map(n=>({point:n.point,...n.witness}))});
 try{polar=radial(rows,y,centerX,centerZ);}catch(error){error.details={...error.details,scope,rawClosedLoops:loops.length,rawComponents:g.components.length,sourceSegments:rows.length,nonDegreeTwoNodes:g.nodes.filter(n=>n.edges.length!==2).length,bounds,openEndpoints:g.nodes.filter(n=>n.edges.length===1).slice(0,8).map(n=>({point:n.point,...n.witness}))};if(scope.startsWith('actual native')&&loops.length===0){error.details.originalFailure=error.code;error.message=error.code='HOLD_TAPE_OPEN_NATIVE_SOURCE_INTERFACE';}throw error;}
 const rawClosed=ranked.length===1,hits=rawClosed?ranked[0].loop:polar,points=hits.map(h=>h.point),circumferenceM=chainLength(points,true),sectors=quadrantLengths(points,centerX,centerZ);
 function pointAtAngle(theta){const d=[Math.sin(theta),Math.cos(theta)];let best=null;for(const row of rows){const a=[row.a.point[0]-centerX,row.a.point[2]-centerZ],e=[row.b.point[0]-row.a.point[0],row.b.point[2]-row.a.point[2]],den=cross2(d,e);if(Math.abs(den)<1e-14)continue;const radius=cross2(a,e)/den,t=cross2(a,d)/den;if(radius>=0&&t>=0&&t<=1&&(!best||radius>best.radius))best={radius,point:mix(row.a.point,row.b.point,t)};}if(!best)fail('HOLD_TAPE_MISSING_QUERY_RAY',{y,theta});return best.point;}
 const witnesses=[0,45,90,135,180,225,270,315].map(i=>({angleRadians:TAU*i/RAYS,point:polar[i].point.slice(),...polar[i].witness}));
 const frontM=sectors.frontNegativeX+sectors.frontPositiveX,backM=sectors.backNegativeX+sectors.backPositiveX,loop=polar.map(h=>h.point);
 const receipt={y,scope,centerX,centerZ,bounds,minX:bounds.min[0],maxX:bounds.max[0],minZ:bounds.min[2],maxZ:bounds.max[2],circumferenceM,sectors,frontM,backM,frontArcM:frontM,backArcM:backM,rawSourceClosed:rawClosed,sourceLoopCount:ranked.length,sourceComponents:g.components.length,nonDegreeTwoNodes:g.nodes.filter(n=>n.edges.length!==2).length,maximumWeldDisplacementM:g.maximumWeldDisplacementM,all360RaysHit:true,loopOrder:'front(+Z) -> positiveX -> back(-Z) -> negativeX; 360 actual ray-plane segment hits',loopChordLengthM:chainLength(loop,true),lengthAuthority:rawClosed?'actual triangle-plane closed-chain polyline, geometric source endpoint weld <=1e-7m':'360 actual triangle-plane ray hits; chordal radial tape estimate across source micro-cracks, not certified raw closed skin',rayWitnesses:witnesses};
 // Raw source rows stay in memory for explicitly separate INITIAL guides.
 const sourceGraphDetails={y,scope,rawClosedLoopCount:ranked.length,rawComponents:g.components.length,nonDegreeTwoNodes:g.nodes.filter(n=>n.edges.length!==2).length,openEndpoints:g.nodes.filter(n=>n.edges.length===1).map(n=>({point:n.point,...n.witness})),loops:ranked.map(r=>({circumferenceM:r.length,points:r.loop.length,sourceWitnesses:r.loop.map(h=>({point:h.point,...h.witness})),sourceSegments:r.loop.map((h,i)=>{const next=r.loop[(i+1)%r.loop.length],e=g.edges[h.edges.find(ei=>{const edge=g.edges[ei];return edge.a===next.id||edge.b===next.id;})];return e.a===h.id?e.source:{a:e.source.b,b:e.source.a};})}))};
 return {...receipt,valid:true,loop,points,contours:[{points,closed:true,rawSourceClosed:rawClosed,circumferenceM}],pointAtAngle,receipt,sourceGraphDetails};
}
// Pure plane-segment operator, shared with source-graph regression fixtures.
export const inspectShortsTapePlaneSegments=(rows,y,scope)=>makeSection(rows,y,scope);
function clippedBelow(rows,y){return rows.flatMap(row=>{const a=row.a,b=row.b;if(a.point[1]>y&&b.point[1]>y)return [];if(a.point[1]<=y&&b.point[1]<=y)return [row];const t=(y-a.point[1])/(b.point[1]-a.point[1]),hit={point:mix(a.point,b.point,t),witness:{...a.witness,weights:mix(a.witness.weights,b.witness.weights,t)}};return [{a:a.point[1]<=y?a:hit,b:b.point[1]<=y?b:hit}];});}
function riseTapes(rows,lowerY,centerZ){
 const g=graph(clippedBelow(rows,lowerY));if(!g.nodes.length)fail('HOLD_TAPE_EMPTY_SAGITTAL',{});
 let minimum=0;for(let i=1;i<g.nodes.length;i++)if(g.nodes[i].point[1]<g.nodes[minimum].point[1])minimum=i;
 const component=g.components.find(ids=>ids.includes(minimum)),ends=component.filter(i=>g.nodes[i].edges.length===1);
 if(ends.length!==2||component.some(i=>g.nodes[i].edges.length>2)||ends.some(i=>Math.abs(g.nodes[i].point[1]-lowerY)>TOL))fail('HOLD_TAPE_SAGITTAL_CHAIN',{componentNodes:component.length,endpointCount:ends.length,endpointY:ends.map(i=>g.nodes[i].point[1]),lowerY});
 const paths=g.nodes[minimum].edges.map(first=>{const nodes=[minimum];let current=minimum,edge=first;while(true){const e=g.edges[edge],next=e.a===current?e.b:e.a;nodes.push(next);if(nodes.length>component.length+1)fail('HOLD_TAPE_SAGITTAL_CYCLE',{});const nextEdge=g.nodes[next].edges.find(i=>i!==edge);if(nextEdge===undefined)break;current=next;edge=nextEdge;}return nodes;});
 if(paths.length!==2)fail('HOLD_TAPE_CROTCH_NOT_INTERNAL',{degree:g.nodes[minimum].edges.length});paths.sort((a,b)=>g.nodes[b.at(-1)].point[2]-g.nodes[a.at(-1)].point[2]);
 if(!(g.nodes[paths[0].at(-1)].point[2]>centerZ&&g.nodes[paths[1].at(-1)].point[2]<centerZ))fail('HOLD_TAPE_RISE_HEMISPHERES',{centerZ,endpoints:paths.map(p=>g.nodes[p.at(-1)].point)});
 const build=ids=>{const path=ids.map(i=>g.nodes[i]),points=path.map(h=>h.point),lengthM=chainLength(points),cumulative=[0],segments=[];for(let i=1;i<points.length;i++){cumulative.push(cumulative.at(-1)+distance(points[i-1],points[i]));const e=g.edges[g.nodes[ids[i-1]].edges.find(ei=>{const e=g.edges[ei];return e.a===ids[i]||e.b===ids[i];})];segments.push(e.a===ids[i-1]?e.source:{a:e.source.b,b:e.source.a});}
  function atDistance(s){if(!Number.isFinite(s)||s<0||s>lengthM+TOL)fail('HOLD_TAPE_PATH_DISTANCE',{distanceFromCrotchM:s,lengthM});s=Math.min(s,lengthM);let i=1;while(i<cumulative.length-1&&cumulative[i]<s)i++;const t=(s-cumulative[i-1])/(cumulative[i]-cumulative[i-1]),row=segments[i-1];return {point:mix(row.a.point,row.b.point,t),triangleWitness:{...row.a.witness,weights:mix(row.a.witness.weights,row.b.witness.weights,t)}};}
  return {lengthM,pointCount:points.length,points,pointAt:t=>atDistance(Math.max(0,Math.min(1,t))*lengthM).point,pathAtDistance:atDistance,receipt:{lengthM,sourceSegmentCount:path.length-1,start:{point:points[0].slice(),...path[0].witness},end:{point:points.at(-1).slice(),...path.at(-1).witness}}};};
 const front=build(paths[0]),back=build(paths[1]);return {front,back,frontPath:front.points,backPath:back.points,frontM:front.lengthM,backM:back.lengthM,pathAtDistance(side,s){if(!['front','back'].includes(side))fail('HOLD_TAPE_PATH_SIDE',{side});return (side==='front'?front:back).pathAtDistance(s);},crotch:{point:g.nodes[minimum].point.slice(),...g.nodes[minimum].witness},maximumWeldDisplacementM:g.maximumWeldDisplacementM};
}

// A cloth INITIAL-placement guide. This helper does not supply skin, a tape
// measurement, material UV, rest metric, mass, collision or an acceptance gate.
export function interpolateShortsInitialGuide(lower,upper,y,{side,missingSourceReason,bodyToken}={}){
 if(lower.rawSourceClosed!==true||upper.rawSourceClosed!==true||lower.loop?.length!==RAYS||upper.loop?.length!==RAYS||!(upper.y>lower.y&&y>=lower.y&&y<=upper.y))fail('HOLD_TAPE_GUIDE_BOUNDING_LOOPS',{y,side,lowerY:lower.y,upperY:upper.y,lowerRawClosed:lower.rawSourceClosed,upperRawClosed:upper.rawSourceClosed});
 const alpha=(y-lower.y)/(upper.y-lower.y),loop=lower.loop.map((p,i)=>mix(p,upper.loop[i],alpha)),centerX=lower.centerX+(upper.centerX-lower.centerX)*alpha,centerZ=lower.centerZ+(upper.centerZ-lower.centerZ)*alpha,bounds={min:[Infinity,y,Infinity],max:[-Infinity,y,-Infinity]};for(const p of loop)for(const k of [0,2]){bounds.min[k]=Math.min(bounds.min[k],p[k]);bounds.max[k]=Math.max(bounds.max[k],p[k]);}
 const sectors=quadrantLengths(loop,centerX,centerZ),circumferenceM=chainLength(loop,true),frontM=sectors.frontNegativeX+sectors.frontPositiveX,backM=sectors.backNegativeX+sectors.backPositiveX,receipt={schema:'r008-shorts-estimated-initial-interface-guide/v1',y,side,alpha,bodyToken,measured:false,rawSourceClosed:false,estimatedInterface:true,scope:'initial cloth geometry only, interpolated between neighboring complete actual-source rings; not skin/tape/material-rest or collision authority',missingSourceReason,lowerSource:{y:lower.y,scope:lower.scope,circumferenceM:lower.circumferenceM,rawSourceClosed:lower.rawSourceClosed,rayWitnesses:lower.receipt?.rayWitnesses??[]},upperSource:{y:upper.y,scope:upper.scope,circumferenceM:upper.circumferenceM,rawSourceClosed:upper.rawSourceClosed,rayWitnesses:upper.receipt?.rayWitnesses??[]},estimatedGuideCircumferenceM:circumferenceM,loopCorrespondence:'same actual source ray angle at both endpoints, front+Z -> positiveX -> back -> negativeX',paperDimensionsDerivedFromGuide:false,physicalWearingValidated:false};
 return {y,loop,points:loop,centerX,centerZ,minX:bounds.min[0],maxX:bounds.max[0],minZ:bounds.min[2],maxZ:bounds.max[2],bounds,circumferenceM,frontM,backM,frontArcM:frontM,backArcM:backM,sectors,valid:true,measured:false,rawSourceClosed:false,estimatedInterface:true,scope:receipt.scope,receipt,pointAtAngle(theta){if(!Number.isFinite(theta))fail('HOLD_TAPE_GUIDE_ANGLE',{theta});if(lower.pointAtAngle&&upper.pointAtAngle)return mix(lower.pointAtAngle(theta),upper.pointAtAngle(theta),alpha);const c=((theta%TAU+TAU)%TAU)*RAYS/TAU,i=Math.floor(c);return mix(loop[i%RAYS],loop[(i+1)%RAYS],c-i);}};
}

export function classifyShortsDistinctLegSections(negative,positive,midX){
 const witness={negative:{rawSourceClosed:negative.rawSourceClosed,centerX:negative.centerX,minX:negative.minX,maxX:negative.maxX,y:negative.y},positive:{rawSourceClosed:positive.rawSourceClosed,centerX:positive.centerX,minX:positive.minX,maxX:positive.maxX,y:positive.y},midX};
 if(negative.rawSourceClosed!==true||positive.rawSourceClosed!==true||negative.sourceLoopCount!==1||positive.sourceLoopCount!==1||negative.sourceComponents!==1||positive.sourceComponents!==1||negative.nonDegreeTwoNodes!==0||positive.nonDegreeTwoNodes!==0||Math.abs(negative.y-positive.y)>TOL||!(negative.centerX<midX&&positive.centerX>midX&&negative.maxX<positive.minX))fail('HOLD_TAPE_DISTINCT_LEG_TOPOLOGY',witness);
 return {y:negative.y,valid:true,distinctLegs:true,contours:[negative.contours[0],positive.contours[0]],negativeX:negative,positiveX:positive,authority:'two independently raw-closed actual source leg loops with disjoint actor-X bounds; no global hull or bridge',topologyWitness:witness};
}
export function supportsShortsInitialInterfaceGuide(error,y,bareMinimumY){
 return ['HOLD_TAPE_OPEN_NATIVE_SOURCE_INTERFACE','HOLD_TAPE_MISSING_SOURCE_RAY','HOLD_TAPE_MULTIPLE_SECTION_LOOPS'].includes(error.code)&&typeof error.details?.scope==='string'&&error.details.scope.startsWith('actual native visible ')&&y>=bareMinimumY-.010&&y<=bareMinimumY+.002;
}
function polygonMembership(point,points){
 let winding=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[2]-a[2],l2=dx*dx+dz*dz,t=l2?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[2]-a[2])*dz)/l2)):0;if(Math.hypot(point[0]-a[0]-t*dx,point[2]-a[2]-t*dz)<=1e-9)return 'boundary';const orientation=dx*(point[2]-a[2])-dz*(point[0]-a[0]);if(a[2]<=point[2]&&b[2]>point[2]&&orientation>0)winding++;if(a[2]>point[2]&&b[2]<=point[2]&&orientation<0)winding--;}
 return winding===0?'outside':'inside';
}
function polygonsIntersect(a,b){
 const sign=(p,q,r)=>(q[0]-p[0])*(r[2]-p[2])-(q[2]-p[2])*(r[0]-p[0]);
 for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){const p=a[i],q=a[(i+1)%a.length],r=b[j],s=b[(j+1)%b.length];if(Math.max(p[0],q[0])+1e-9<Math.min(r[0],s[0])||Math.max(r[0],s[0])+1e-9<Math.min(p[0],q[0])||Math.max(p[2],q[2])+1e-9<Math.min(r[2],s[2])||Math.max(r[2],s[2])+1e-9<Math.min(p[2],q[2]))continue;const boundary=(v,x,y)=>polygonMembership(v,[x,y])==='boundary';if(boundary(p,r,s)||boundary(q,r,s)||boundary(r,p,q)||boundary(s,p,q)||sign(p,q,r)*sign(p,q,s)<0&&sign(r,s,p)*sign(r,s,q)<0)return true;}
 return false;
}
// Historical single-loop diagnostic retained for old failure comparison only.
// Production guideSectionAtY uses the connected-source exterior operator.
export function selectShortsInitialAxisLoop(details,landmarks,y,side,midX){
 const audit={y,side,midX,currentAllLoops:details?.loops??[],originalSourceDetails:details,axisPoint:null,memberships:[],pairPredicates:[]},reject=(code,extra={})=>fail(code,{...audit,...extra});
 if(!details?.scope?.startsWith('actual native visible ')||details.rawClosedLoopCount<2||details.rawComponents!==details.rawClosedLoopCount||details.nonDegreeTwoNodes!==0||details.openEndpoints?.length)reject('HOLD_TAPE_INITIAL_AXIS_SOURCE_COMPONENTS');
 const negative=['left','negativeX'].includes(side);if(!negative&&!['right','positiveX'].includes(side))reject('HOLD_TAPE_INITIAL_AXIS_SIDE');
 const pairs=[['thighL','calfL'],['thighR','calfR']].filter(([a])=>Array.isArray(landmarks[a])&&(negative?landmarks[a][0]<midX:landmarks[a][0]>midX));if(pairs.length!==1)reject('HOLD_TAPE_INITIAL_AXIS_OWNERSHIP',{pairs});
 const [thighName,calfName]=pairs[0],thigh=landmarks[thighName],calf=landmarks[calfName];if(!Array.isArray(calf)||![...thigh,...calf,y].every(Number.isFinite)||Math.abs(calf[1]-thigh[1])<1e-12||y<Math.min(thigh[1],calf[1])||y>Math.max(thigh[1],calf[1]))reject('HOLD_TAPE_INITIAL_AXIS_JOINT_RANGE',{thigh,calf});
 const alpha=(y-thigh[1])/(calf[1]-thigh[1]),axisPoint=mix(thigh,calf,alpha),loops=details.loops.map(loop=>loop.sourceWitnesses.map(w=>w.point));audit.axisPoint=axisPoint;if(negative?axisPoint[0]>=midX:axisPoint[0]<=midX)reject('HOLD_TAPE_INITIAL_AXIS_CROSSES_MIDLINE');
 const memberships=loops.map(points=>polygonMembership(axisPoint,points));audit.memberships=memberships;
 const pairPredicate=(a,b)=>({selected:a,other:b,intersectsOrTouchesSelected:polygonsIntersect(loops[a],loops[b]),otherVertexMemberships:loops[b].map(p=>polygonMembership(p,loops[a])),selectedVertexMemberships:loops[a].map(p=>polygonMembership(p,loops[b])),axisInOther:memberships[b]});
 const fillAmbiguousPairs=()=>{for(let a=0;a<loops.length;a++)for(let b=a+1;b<loops.length;b++)audit.pairPredicates.push(pairPredicate(a,b));audit.pairPredicateScope='all unordered source-loop pairs because no unique admissible axis contour exists';};
 if(memberships.includes('boundary')){fillAmbiguousPairs();reject('HOLD_TAPE_INITIAL_AXIS_ON_SOURCE_BOUNDARY');}const selected=memberships.map((m,i)=>m==='inside'?i:-1).filter(i=>i>=0);if(selected.length!==1){fillAmbiguousPairs();reject('HOLD_TAPE_INITIAL_AXIS_NOT_UNIQUE',{candidateAxisContainingLoops:selected});}
 const index=selected[0],points=loops[index],internalSourceHoleContours=[],excludedOutsideSourceContours=[];
 audit.pairPredicates=loops.map((_,i)=>i===index?null:pairPredicate(index,i)).filter(Boolean);
 for(const predicate of audit.pairPredicates){const i=predicate.other;
  const internal=predicate.otherVertexMemberships.every(m=>m==='inside'),outside=predicate.otherVertexMemberships.every(m=>m==='outside')&&predicate.selectedVertexMemberships.every(m=>m==='outside');
  if(predicate.intersectsOrTouchesSelected||predicate.axisInOther!=='outside'||!internal&&!outside)reject('HOLD_TAPE_INITIAL_AXIS_NESTED_OR_OVERLAPPING',{selected:index,other:i});
  predicate.classification=internal?'internal-source-hole-contour ignored for INITIAL exterior only':'fully disjoint outside source contour';(internal?internalSourceHoleContours:excludedOutsideSourceContours).push({sourceLoopIndex:i,sourceLoop:details.loops[i],predicate});
 }
 return {selectedIndex:index,selectedLoop:details.loops[index],excludedLoops:details.loops.filter((_,i)=>i!==index),internalSourceHoleContours,excludedOutsideSourceContours,pairPredicates:audit.pairPredicates,currentAllLoops:details.loops,axis:{point:axisPoint,thighName,calfName,thigh:thigh.slice(),calf:calf.slice(),alpha,authority:'intersection of actual same-leg thigh/calf joint segment with requested actor-local Y, no extrapolation'},selection:'unique non-boundary axis-containing INITIAL exterior; strictly interior holes may be ignored only here, all source triangles remain in body/collision; no circumference/area cutoff',strictMeasurementOrBodyChanged:false};
}
export function classifyShortsInitialLegGuides(negative,positive,midX,{missingSourceReason}={}){
 const endpointAuthority=s=>s.rawSourceClosed===true&&s.sourceLoopCount===1&&s.sourceComponents===1&&s.nonDegreeTwoNodes===0||s.estimatedInterface===true&&s.receipt?.lowerSource?.rawSourceClosed===true&&s.receipt?.upperSource?.rawSourceClosed===true||s.initialGuide===true&&s.sourceSelectedLoopRawClosed===true&&s.receipt?.axisSelection?.selectedLoop?.sourceWitnesses?.length>=3||s.initialGuide===true&&s.sourceConnectedComponentRawClosed===true&&s.receipt?.schema==='r008-shorts-connected-source-radial-initial-guide/v1'&&s.receipt.rayWitnesses?.length===RAYS;
 const witness={negative:{centerX:negative.centerX,minX:negative.minX,maxX:negative.maxX},positive:{centerX:positive.centerX,minX:positive.minX,maxX:positive.maxX},midX};
 if(!endpointAuthority(negative)||!endpointAuthority(positive)||Math.abs(negative.y-positive.y)>TOL||!(negative.centerX<midX&&positive.centerX>midX&&negative.maxX<positive.minX))fail('HOLD_TAPE_INITIAL_GUIDE_LEG_TOPOLOGY',witness);
 const scope='estimated INITIAL cloth interface guides with independently complete actual endpoint rings; not measured skin or collision authority',receipt={schema:'r008-shorts-estimated-initial-two-leg-guide/v1',y:negative.y,scope,measured:false,rawSourceClosed:false,estimatedInterface:true,missingSourceReason,topologyWitness:witness,negativeSource:negative.receipt,positiveSource:positive.receipt,paperDimensionsDerivedFromGuide:false,physicalWearingValidated:false};
 return {y:negative.y,valid:true,distinctLegs:true,negativeX:negative,positiveX:positive,contours:[negative,positive].map(s=>({points:s.loop,closed:true,rawSourceClosed:s.rawSourceClosed,estimatedInterface:s.estimatedInterface===true})),scope,authority:scope,measured:false,rawSourceClosed:false,estimatedInterface:true,receipt};
}

/**
 * Measure the current visible generated skin in metres. Native input may be
 * the original adapter or visible-skin wrapper (both expose source triangles).
 * sourceReceipt fixes the user-approved upper/middle/lower/hem planes. Returned
 * closures contain live-derived polylines only in memory; persist receipt only.
 */
export function measureShortsSkinTapes(measuredBody,barePelvis,actor,sourceReceipt){
 if(!measuredBody?.positions||!measuredBody.triangles||!measuredBody.measurements||!barePelvis?.queryAPI?.positions||!barePelvis.queryAPI.indices||barePelvis.report?.closedSolidTopologyCertified!==true||!actor?.isObject3D)fail('HOLD_TAPE_SOURCE_AUTHORITY',{});
 const m=measuredBody.measurements,nativeSnapshot=measuredBody.snapshot?.()??{};if(m.pose&&m.pose!=='rest'||nativeSnapshot.phase&&nativeSnapshot.phase!=='rest')fail('HOLD_TAPE_NEUTRAL_BODY_REQUIRED',{pose:m.pose,phase:nativeSnapshot.phase});
 const heights={upperY:sourceReceipt?.upperY,middleY:sourceReceipt?.middleY,lowerY:sourceReceipt?.lowerY,hemY:sourceReceipt?.hem?.y,hipY:barePelvis.report.recipe?.hip?.y??m.hip?.y};
 if(!Object.values(heights).every(Number.isFinite)||!(heights.upperY>heights.middleY&&heights.middleY>heights.lowerY&&heights.lowerY>heights.hipY&&heights.hipY>heights.hemY))fail('HOLD_TAPE_FIXED_HEIGHT_CONTRACT',heights);
 actor.updateWorldMatrix(true,false);const actorScale=actor.getWorldScale(new THREE.Vector3());if(actorScale.toArray().some(s=>Math.abs(s-1)>1e-8))fail('HOLD_TAPE_ACTOR_SCALE_DUPLICATION',{actorScale:actorScale.toArray(),reason:'native actual subject scale is already present in WORLD metres'});
 const frame=new THREE.Matrix4().compose(actor.getWorldPosition(new THREE.Vector3()),actor.getWorldQuaternion(new THREE.Quaternion()),new THREE.Vector3(1,1,1)),inverse=frame.clone().invert(),bareUpdate=barePelvis.queryAPI.update?.(),bareWorld=barePelvis.queryAPI.positions,nativeWorld=measuredBody.positions,bareLocal=localArray(bareWorld,inverse),nativeLocal=localArray(nativeWorld,inverse),bareTriangles=Array.from({length:barePelvis.queryAPI.indices.length/3},(_,i)=>({id:i,indices:Array.from(barePelvis.queryAPI.indices.subarray(i*3,i*3+3))}));
 const midX=m.referenceWaist?.centerX??m.landmarks?.pelvis?.[0],midZ=m.referenceWaist?.centerZ??m.landmarks?.pelvis?.[2];if(![midX,midZ].every(Number.isFinite))fail('HOLD_TAPE_FIXED_REFERENCE_AXIS',{});
 let bareLowerY=Infinity;for(let i=1;i<bareLocal.length;i+=3)bareLowerY=Math.min(bareLowerY,bareLocal[i]);
 const sagittal=intersect(bareLocal,bareTriangles,0,midX,'authored-estimated-bare'),rise=riseTapes(sagittal,heights.lowerY,midZ),crotchY=rise.crotch.point[1],scale=m.heightM/1.8,upperThighY=crotchY-.025*scale;
 if(!(heights.hipY>crotchY&&crotchY>upperThighY&&upperThighY>heights.hemY))fail('HOLD_TAPE_BODY_DOMAINS',{...heights,crotchY,upperThighY});
 const nativeParts={negativeX:[18,12],positiveX:[1,26]},cache=new Map(),sectionReceipts=[],guideCache=new Map(),sourceGuideReceipts=[];
 function sectionAtY(y,{side=null}={}){
  if(!Number.isFinite(y)||side!==null&&!['negativeX','positiveX','left','right'].includes(side))fail('HOLD_TAPE_SECTION_REQUEST',{y,side});
  // Source garment side names retain the original paper chart convention;
  // native anatomical bone labels are reported separately, never guessed.
  if(side==='left')side='negativeX';if(side==='right')side='positiveX';
  if(side===null&&y<crotchY-TOL){const negative=sectionAtY(y,{side:'negativeX'}),positive=sectionAtY(y,{side:'positiveX'});return classifyShortsDistinctLegSections(negative,positive,midX);}
  const key=(side??'pelvis')+':'+y.toPrecision(15);if(cache.has(key))return cache.get(key);
  const useNative=side&&y<bareLowerY+TOL,positions=useNative?nativeLocal:bareLocal,triangles=useNative?measuredBody.triangles:bareTriangles,scope=useNative?'actual native visible '+side+' leg':'actual generated estimated bare '+(side??'pelvis'),rows=intersect(positions,triangles,1,y,useNative?'native-visible-skin':'authored-estimated-bare',tri=>!useNative||nativeParts[side].includes(tri.part));
  const own=side?rows.filter(row=>(row.a.point[0]+row.b.point[0])/2*(side==='negativeX'?-1:1)>midX*(side==='negativeX'?-1:1)):rows;let section;
  try{section=makeSection(own,y,scope);}catch(error){if(side!==null||error.code!=='HOLD_TAPE_MULTIPLE_SECTION_LOOPS'||error.details.rawClosedLoopCount!==2||error.details.rawComponents!==2||error.details.nonDegreeTwoNodes!==0)throw error;
   const negative=sectionAtY(y,{side:'negativeX'}),positive=sectionAtY(y,{side:'positiveX'});section=classifyShortsDistinctLegSections(negative,positive,midX);sectionReceipts.push({y,scope,classification:'actual two disjoint raw-closed leg loops above sagittal-minimum threshold',topologyWitness:section.topologyWitness,originalWholeFailure:error.details});cache.set(key,section);return section;
  }cache.set(key,section);sectionReceipts.push(section.receipt);return section;
 }
 function guideSectionAtY(y,{side=null}={}){
  if(!Number.isFinite(y)||side!==null&&!['negativeX','positiveX','left','right'].includes(side))fail('HOLD_TAPE_SECTION_REQUEST',{y,side});
  const key=(side??'whole')+':'+y.toPrecision(15);if(guideCache.has(key))return guideCache.get(key);
  const exterior=(details)=>{let axis;try{axis=shortsInitialAnatomicalAxis(m.landmarks,y,side,midX);}catch(error){error.details={...error.details,currentAllLoops:details.loops,originalSourceDetails:details};throw error;}const guide=createShortsInitialExteriorContour(details,axis,{side,bodyToken});guideCache.set(key,guide);sourceGuideReceipts.push(guide.receipt);return guide;};
  // All INITIAL native rings use the same anatomical pole, including single
  // strict loops. Measured sectionAtY keeps its original bounds-centre tape.
  if(side===null&&y<crotchY-TOL){const negative=guideSectionAtY(y,{side:'left'}),positive=guideSectionAtY(y,{side:'right'}),whole=classifyShortsInitialLegGuides(negative,positive,midX);guideCache.set(key,whole);sourceGuideReceipts.push(whole.receipt);return whole;}
  try{const strict=sectionAtY(y,{side});if(side!==null&&strict.scope?.startsWith('actual native visible '))return exterior(strict.sourceGraphDetails);return strict;}catch(error){
   const axisCandidate=error.code==='HOLD_TAPE_MULTIPLE_SECTION_LOOPS'&&error.details?.scope?.startsWith('actual native visible ')&&error.details.rawComponents===error.details.rawClosedLoopCount&&error.details.nonDegreeTwoNodes===0&&!(error.details.openEndpoints?.length);
   if(!supportsShortsInitialInterfaceGuide(error,y,bareLowerY)&&!axisCandidate)throw error;
   if(side===null){if(y>=crotchY)throw error;const negative=guideSectionAtY(y,{side:'left'}),positive=guideSectionAtY(y,{side:'right'}),whole=classifyShortsInitialLegGuides(negative,positive,midX,{missingSourceReason:{code:error.code,details:error.details}});guideCache.set(key,whole);sourceGuideReceipts.push(whole.receipt);return whole;}
   if(!['left','right','negativeX','positiveX'].includes(side))throw error;
   if(axisCandidate)return exterior(error.details);
   const lowerY=bareLowerY-.010,upperY=bareLowerY+.002;
   const lower=sectionAtY(lowerY,{side}),upper=sectionAtY(upperY,{side}),guide=interpolateShortsInitialGuide(lower,upper,y,{side,bodyToken,missingSourceReason:{code:error.code,details:error.details}});guideCache.set(key,guide);sourceGuideReceipts.push(guide.receipt);return guide;
  }
 }
 const waist={upper:sectionAtY(heights.upperY),middle:sectionAtY(heights.middleY),lower:sectionAtY(heights.lowerY)},hip=sectionAtY(heights.hipY),pair=y=>{const negativeX=sectionAtY(y,{side:'negativeX'}),positiveX=sectionAtY(y,{side:'positiveX'}),leftPositive=m.landmarks.thighL[0]>m.landmarks.thighR[0];return {y,negativeX,positiveX,left:negativeX,right:positiveX,innerGapM:positiveX.bounds.min[0]-negativeX.bounds.max[0],anatomicalLeftActorXSign:leftPositive?1:-1};},legs={upperThigh:pair(upperThighY),hem:pair(heights.hemY)};
 const scalarSection=s=>({y:s.y,circumferenceM:s.circumferenceM,frontArcM:s.frontArcM,backArcM:s.backArcM,sectors:{...s.sectors},centerX:s.centerX,centerZ:s.centerZ,bounds:structuredClone(s.bounds),rawSourceClosed:s.rawSourceClosed});
 const bareRecipeFingerprint=fingerprint([barePelvis.report.recipe]),nativeSurfaceFingerprint=geometryFingerprint(nativeLocal,measuredBody.indices),bareSurfaceFingerprint=geometryFingerprint(bareLocal,barePelvis.queryAPI.indices),bodyToken=fingerprint([m.source,nativeSnapshot.revision,bareUpdate?.revision,frame.toArray(),bareRecipeFingerprint,nativeSurfaceFingerprint,bareSurfaceFingerprint]),receipt={schema:'r008-shorts-actual-skin-tapes/v1',unit:'m',coordinateFrame:'actor translation/rotation removed, unit scale; actual stature retained in metres',bodyToken,tokenAlgorithm:'fnv1a32 full current local triangle-array fingerprints plus metadata identity; not a cryptographic hash',source:{native:m.source,nativeRevision:nativeSnapshot.revision,nativePhase:nativeSnapshot.phase??m.pose,bareRevision:bareUpdate?.revision,bareRecipeFingerprint,nativeSurfaceFingerprint,bareSurfaceFingerprint,bareAuthority:barePelvis.report.authority,coveredSkinExactRecovery:false,oldClothingTrianglesUsed:false,nativePartIds:nativeParts},actorFrame:{translation:actor.getWorldPosition(new THREE.Vector3()).toArray(),quaternion:actor.getWorldQuaternion(new THREE.Quaternion()).toArray(),scale:[1,1,1]},fixedPlanes:{...heights,source:'existing explicit user waist/hem receipt; measured sections do not move these planes'},sagittalAxis:{x:midX,zReference:midZ,authority:'fixed source reference-waist scalar axis, independent of requested low-waist plane'},actualHeightM:m.heightM,waist:Object.fromEntries(Object.entries(waist).map(([k,s])=>[k,scalarSection(s)])),hip:scalarSection(hip),legs:Object.fromEntries(Object.entries(legs).map(([k,p])=>[k,{y:p.y,negativeX:scalarSection(p.negativeX),positiveX:scalarSection(p.positiveX),innerGapM:p.innerGapM,anatomicalLeftActorXSign:p.anatomicalLeftActorXSign}])),rise:{frontM:rise.frontM,backM:rise.backM,front:rise.front.receipt,back:rise.back.receipt,maximumWeldDisplacementM:rise.maximumWeldDisplacementM,authority:'actual authored bare sagittal triangle-plane chain from fixed lower-waist intersections to actual minimum bridge point; no height-slice interpolation'},crotch:rise.crotch,sectionWitnesses:sectionReceipts,storedMeshCoordinates:0,paperBuilt:false,restFromXYZ:false,physicalWearingValidated:false,productionReady:false};
 receipt.bareNativeInterface={actualBareMinimumY:bareLowerY,bareLegSectionMinimumY:bareLowerY+TOL,nativeSectionBelowY:bareLowerY+TOL,nativeBareOverlapBounds:{positiveNativeMaximumY:m.partBounds?.[1]?.max[1],negativeNativeMaximumY:m.partBounds?.[18]?.max[1]},authority:'actual generated bare triangle minimum plus 1e-7m endpoint tolerance; native below this support is allowed only with actual complete source-ray coverage; native maximumY alone does not certify full circumference',unsupportedSectionPolicy:'HOLD_TAPE_OPEN_NATIVE_SOURCE_INTERFACE with actual triangle/bary endpoints; no interpolation across absent skin and no estimated guide disguised as measurement'};
 waist.mid=waist.middle;receipt.garmentSideConvention='left=negative actor X, right=positive actor X, matching original paper; anatomical thigh_l sign reported separately';
 receipt.scope=receipt.sourceSurfaceScope='actual native visible leg triangle sections plus current authored estimated hidden bare pelvis; not exact recovery of covered skin; optional initial guides are explicitly separate from measured sections';
 receipt.sourceGuides=sourceGuideReceipts;receipt.initialGuidePolicy={query:'guideSectionAtY only',maximumDomainY:[bareLowerY-.010,bareLowerY+.002],maximumDomainYAppliesTo:'gap interpolation only; not anatomical-axis localization',axisSelectionDomain:'all INITIAL native single/multiple closed source polygons use actual same-leg thigh/calf axis, no extrapolation; select unique axis-interior connected winding-set union and sample outermost exits; all connected polygons contribute with no size cutoff; radial filled gaps explicitly reported, not exact union or measured skin',strictSectionAtYUnchanged:true,needsRawClosedEndpointLoops:true,bodyMeshAndCollisionUnchanged:true,notMeasurementOrPaperRest:true};
 return {unit:'m',waist,hip,legs,rise,crotch:rise.crotch.point.slice(),crotchWitness:rise.crotch,crotchY,originalHemY:heights.hemY,lowWaistY:heights.upperY,lowerWaistY:heights.lowerY,bodyToken,receipt,sectionAtY,guideSectionAtY,pathAtDistance:rise.pathAtDistance,frame:frame.clone(),inverseFrame:inverse.clone(),toWorld:p=>new THREE.Vector3(...p).applyMatrix4(frame).toArray(),closestPointWorld(point){barePelvis.queryAPI.update?.();return barePelvis.queryAPI.closestPoint(point);}};
}
