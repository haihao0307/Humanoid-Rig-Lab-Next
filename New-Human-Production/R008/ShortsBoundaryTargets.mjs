/* Static authoring targets only. Original two-dimensional rest, masses and
 * source stitches remain authoritative. This is not a wearing/physics result. */
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const sequence=(a,b)=>Array.from({length:Math.abs(b-a)+1},(_,i)=>a+Math.sign(b-a)*i);
const identity=d=>JSON.stringify({uv:Array.from(d.sourceUV),mass:Array.from(d.masses),triangles:Array.from(d.triangles),seams:d.seams});
function cross(a,b,c){return(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);}
function intersections(points){const hits=[];for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){if(j===i+1||(i===0&&j===points.length-1))continue;const a=points[i],b=points[(i+1)%points.length],c=points[j],d=points[(j+1)%points.length];if(cross(a,b,c)*cross(a,b,d)<-1e-20&&cross(c,d,a)*cross(c,d,b)<-1e-20)hits.push([i,j]);}return hits;}
// Find an increasing-angle half-ellipse whose seven CHORDS equal the actual
// seven source edges. Bisection is a bounded geometric root, not a cloth run.
function halfEllipse(center,a,sign,front,lengths){
 const total=lengths.reduce((s,v)=>s+v,0),point=(b,t)=>[center[0]+sign*a*Math.cos(t),center[1],center[2]+(t===0||t===Math.PI?0:(front?1:-1)*b*Math.sin(t))];
 if(total<=2*a)throw Error('HOLD: source half-hem shorter than required exterior endpoint span');
 function evaluate(b){let t=0;const points=[point(b,0)],angles=[0];for(let k=0;k<lengths.length-1;k++){
   let previous=t,found=false,next=t;const start=points.at(-1);
   for(let j=1;j<=256;j++){next=t+(Math.PI-t)*j/256;if(distance(start,point(b,next))>=lengths[k]){found=true;break;}previous=next;}
   if(!found)return{residual:-total,points:null};
   let lo=previous,hi=next;for(let j=0;j<48;j++){const m=(lo+hi)/2;if(distance(start,point(b,m))>=lengths[k])hi=m;else lo=m;}
   t=(lo+hi)/2;if(t>=Math.PI-1e-12)return{residual:-total,points:null};points.push(point(b,t));angles.push(t);
  }const end=point(b,Math.PI);return{residual:distance(points.at(-1),end)-lengths.at(-1),points:[...points,end],angles:[...angles,Math.PI]};}
 let lo=0,hi=total,high=evaluate(hi);if(!high.points||high.residual<0)throw Error('HOLD: bounded half-ellipse source-edge root unavailable');
 for(let k=0;k<64;k++){const m=(lo+hi)/2,r=evaluate(m);if(r.points&&r.residual>=0)hi=m;else lo=m;}
 const b=(lo+hi)/2,result=evaluate(b);if(!result.points||Math.abs(result.residual)>1e-9)throw Error('HOLD: half-ellipse source-edge root did not converge');
 return{points:result.points,angles:result.angles,semiDepthM:b,sourceLengthM:total,method:'seven original source-edge chords on monotone-X asymmetric half-ellipse'};
}
export function createShortsBoundaryTargets(draft,body,{clearanceM=.004}={}){
 if(!draft||draft.receipt?.gusset?.sourceRecipeVersion!==2||draft.sourceUV?.length!==1106||draft.seams?.length!==19)throw Error('Boundary targets require the fresh measured @2 original 553/19 paper');
 if(!body?.sectionAt||!body?.closestPoint||!(clearanceM>0&&Number.isFinite(clearanceM)))throw Error('Actual source body and finite positive exterior clearance required');
 const before=identity(draft),byId=new Map(draft.ranges.map(r=>[r.pieceId,r])),read=i=>Array.from(draft.positions.subarray(3*i,3*i+3)),uv=i=>Array.from(draft.sourceUV.subarray(2*i,2*i+2)),index=(id,i)=>byId.get(id).offset+i,loops=[],reasons=[];
 const waistArcs=[['FL',sequence(7,0)],['FR',sequence(0,7)],['BR',sequence(7,0)],['BL',sequence(0,7)]].map(([id,local])=>({piece:id,indices:local.map(i=>index(id,i)),points:local.map(i=>read(index(id,i)))}));
 loops.push({name:'main-waist',arcs:waistArcs,authority:'existing measured MAIN lower-waist continuous arcs; separately audited, not an already worn garment',sectionWitness:null});
 for(const [side,f,b,parts]of[['left','FL','BL',[19,18,12]],['right','FR','BR',[9,1,26]]]){
  const ids=sequence(104,111),y=read(index(f,104))[1],section=body.sectionAt(y,{partIds:parts,toleranceM:1e-9}),raw=(section.sourceContours??[]).flatMap(c=>c.points??[]);
  if(!section.valid||raw.length<3){reasons.push('HOLD: actual independent '+side+' leg section unavailable');continue;}
  const minX=Math.min(...raw.map(p=>p[0])),maxX=Math.max(...raw.map(p=>p[0])),minZ=Math.min(...raw.map(p=>p[2])),maxZ=Math.max(...raw.map(p=>p[2])),center=[(minX+maxX)/2,y,(minZ+maxZ)/2],a=(maxX-minX)/2+clearanceM;
  const lengths=id=>ids.slice(1).map((i,j)=>distance(uv(index(id,ids[j])),uv(index(id,i))));
  try{
   const front=halfEllipse(center,a,side==='left'?1:-1,true,lengths(f)),back=halfEllipse(center,a,side==='left'?1:-1,false,lengths(b)),arcs=[{piece:f,indices:ids.map(i=>index(f,i)),points:front.points},{piece:b,indices:ids.toReversed().map(i=>index(b,i)),points:back.points.toReversed()}],polygon=[...front.points.slice(0,-1),...back.points.toReversed().slice(0,-1)],orientation=Math.sign(polygon.reduce((s,p,i)=>{const q=polygon[(i+1)%polygon.length];return s+p[0]*q[2]-q[0]*p[2];},0));
   const outsideSectionPoints=raw.filter(p=>polygon.some((a,i)=>orientation*cross(a,polygon[(i+1)%polygon.length],p)<-1e-10)).length;
   loops.push({name:side==='left'?'negative-X-hem':'positive-X-hem',arcs,authority:'loose source-edge-preserving external authoring polygon; actual per-leg section enclosed, not a tight leg tape target',sectionWitness:{y,parts,sourceSectionMethod:'actual source triangle-plane intersection chain endpoints; 1 nm endpoint key tolerance; includes all chains, not only sampled polar rays',actualPointCount:raw.length,bounds:{minX,maxX,minZ,maxZ},center,semiWidthM:a,frontSemiDepthM:front.semiDepthM,backSemiDepthM:back.semiDepthM,outsideSectionPoints},geometricMethod:front.method});
   if(outsideSectionPoints)reasons.push('HOLD: '+side+' source-length polygon does not enclose all actual section points');
  }catch(e){reasons.push(e.message);}
 }
 const targets=[];for(const loop of loops){loop.orderedSourceIndices=loop.arcs.flatMap(a=>a.indices.slice(0,-1));loop.points=loop.arcs.flatMap(a=>a.points.slice(0,-1));loop.maximumArcEndpointGapM=Math.max(...loop.arcs.map((a,j)=>distance(a.points.at(-1),loop.arcs[(j+1)%loop.arcs.length].points[0])));if(loop.maximumArcEndpointGapM>1e-12)reasons.push('HOLD: '+loop.name+' arc endpoints disagree');loop.strictXZCrossings=intersections(loop.points);loop.segments=loop.arcs.flatMap(a=>a.indices.slice(1).map((b,j)=>{const restM=distance(uv(a.indices[j]),uv(b)),targetM=distance(a.points[j],a.points[j+1]);return{a:a.indices[j],b,restM,targetM,ratio:targetM/restM};}));loop.sourceLengthM=loop.segments.reduce((s,e)=>s+e.restM,0);loop.targetLengthM=loop.segments.reduce((s,e)=>s+e.targetM,0);loop.bodyQueries=[];
  for(let i=0;i<loop.points.length;i++){const a=loop.points[i],b=loop.points[(i+1)%loop.points.length];targets.push({sourceIndex:loop.orderedSourceIndices[i],point:a.slice(),loop:loop.name});for(const[kind,p]of[['vertex',a],['edge-midpoint',a.map((v,k)=>(v+b[k])/2)]]){const q=body.closestPoint(p);loop.bodyQueries.push({kind,point:p.slice(),signedDistanceM:q.signedDistance,distanceM:q.distance,part:q.part,triangleId:q.triangleId,normal:q.normal.toArray(),surfacePoint:q.point.toArray(),indices:q.indices,weights:q.weights});}}
  loop.maximumClosestNormalPenetrationM=Math.max(0,...loop.bodyQueries.map(q=>-q.signedDistanceM));
  if(loop.strictXZCrossings.length)reasons.push('HOLD: '+loop.name+' target polygon crosses itself');
  if(loop.segments.some(e=>e.ratio<.95-1e-10||e.ratio>1.05+1e-10))reasons.push('HOLD: '+loop.name+' source-edge ratio outside five percent');
  // Existing waist chords have a recorded 0.37 mm local incursion: report it
  // explicitly; this hem-only fix does not pretend to solve the waist path.
  if(loop.name!=='main-waist'&&loop.maximumClosestNormalPenetrationM>1e-9)reasons.push('HOLD: '+loop.name+' target vertex/midpoint closest-normal negative');
 }
 if(identity(draft)!==before)throw Error('Boundary target generation mutated paper/rest/mass/stitches');
 return{schema:'r008-source-arc-boundary-targets@1',valid:reasons.length===0,reasons,targets,loops,receipt:{scope:'static authoring target construction only; no wear/native solve',sourceRecipeVersion:2,sourceGWidthM:draft.receipt.gusset.selectedPaperWidthM,sourceIdentityUnchanged:true,clearanceM,sourceUVRestMassAllNineteenPairsUnchanged:true,sourcePaperCircumferencePreserved:true,waistStatus:'retained measured MAIN lower-waist target; local chord incursion remains disclosed; not complete wearing acceptance',contactMeaning:'nearest actual triangle signed normal plus exact source horizontal-section polygon enclosure; not a watertight solid oracle',bodyFitValidated:false,motionValidated:false,productionReady:false}};
}
