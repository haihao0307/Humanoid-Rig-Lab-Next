// Read-only static surface intersection evidence, using current WORLD triangles.
// Bounded-triangle interiors and coplanar overlap count as intersection:
// https://doc.cgal.org/latest/Kernel_23/group__intersection__linear__grp.html
// This implements double-precision predicates, NOT CGAL's exact arithmetic.
const CELL_M=.04,EPS_M=1e-9,MAX_CELLS=512;
const sub=(a,b)=>a.map((x,k)=>x-b[k]),dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const size=a=>Math.hypot(...a),lerp=(a,b,t)=>a.map((x,k)=>x+(b[k]-x)*t);
const box=p=>({min:[0,1,2].map(k=>Math.min(...p.map(v=>v[k]))-EPS_M),max:[0,1,2].map(k=>Math.max(...p.map(v=>v[k]))+EPS_M)});
const overlaps=(a,b)=>[0,1,2].every(k=>a.min[k]<=b.max[k]&&b.min[k]<=a.max[k]);
function normal(p){const n=cross(sub(p[1],p[0]),sub(p[2],p[0])),l=size(n);return {n:l?n.map(x=>x/l):n,area2:l};}
function dominant(n){return Math.abs(n[0])>=Math.abs(n[1])&&Math.abs(n[0])>=Math.abs(n[2])?0:Math.abs(n[1])>=Math.abs(n[2])?1:2;}
function projected(p,axis){return p.filter((_,k)=>k!==axis);}
const orient=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function clipPolygon(points,triangle,axis){
 const t=triangle.map(p=>projected(p,axis)),sign=Math.sign(orient(t[0],t[1],t[2]));let out=points.map(p=>p.slice());
 for(let e=0;e<3&&out.length;e++){
  const a=t[e],b=t[(e+1)%3],tolerance=EPS_M*Math.hypot(b[0]-a[0],b[1]-a[1]),input=out;out=[];
  let previous=input[input.length-1],dp=sign*orient(a,b,projected(previous,axis));
  for(const current of input){const dc=sign*orient(a,b,projected(current,axis)),pin=dp>=-tolerance,cin=dc>=-tolerance;
   if(pin!==cin){const denominator=dp-dc;if(denominator!==0)out.push(lerp(previous,current,Math.max(0,Math.min(1,dp/denominator))));}
   if(cin)out.push(current.slice());previous=current;dp=dc;
  }
 }
 return out;
}
function pointInTriangle(point,t,n){const axis=dominant(n),p=projected(point,axis),q=t.map(v=>projected(v,axis)),sign=Math.sign(orient(q[0],q[1],q[2]));return [0,1,2].every(e=>sign*orient(q[e],q[(e+1)%3],p)>=-EPS_M*Math.hypot(q[(e+1)%3][0]-q[e][0],q[(e+1)%3][1]-q[e][1]));}
function segmentTriangle(a,b,t,n){
 const da=dot(sub(a,t[0]),n),db=dot(sub(b,t[0]),n);
 if((da>EPS_M&&db>EPS_M)||(da< -EPS_M&&db< -EPS_M))return [];
 if(Math.abs(da)<=EPS_M&&Math.abs(db)<=EPS_M)return clipPolygon([a,b],t,dominant(n));
 const denominator=da-db;if(denominator===0)return [];
 const f=da/denominator;if(f<0||f>1){const end=Math.abs(da)<=EPS_M?a:Math.abs(db)<=EPS_M?b:null;return end&&pointInTriangle(end,t,n)?[end.slice()]:[];}
 const p=lerp(a,b,f);return pointInTriangle(p,t,n)?[p]:[];
}
function intersections(a,b){
 const da=a.p.map(p=>dot(sub(p,b.p[0]),b.n)),db=b.p.map(p=>dot(sub(p,a.p[0]),a.n));
 if(da.every(x=>x>EPS_M)||da.every(x=>x< -EPS_M)||db.every(x=>x>EPS_M)||db.every(x=>x< -EPS_M))return null;
 const coplanar=da.every(x=>Math.abs(x)<=EPS_M)&&db.every(x=>Math.abs(x)<=EPS_M),points=[];
 if(coplanar)points.push(...clipPolygon(a.p,b.p,dominant(b.n)));
 else for(let e=0;e<3;e++){points.push(...segmentTriangle(a.p[e],a.p[(e+1)%3],b.p,b.n));points.push(...segmentTriangle(b.p[e],b.p[(e+1)%3],a.p,a.n));}
 const unique=[];for(const p of points)if(!unique.some(q=>size(sub(p,q))<=EPS_M))unique.push(p);
 if(!unique.length)return null;
 // A within-epsilon contact is retained conservatively and prevents a PASS.
 // It is not labeled an exact algebraic crossing when coplanarity is uncertain.
 const exactlyCoplanar=coplanar&&da.every(x=>x===0)&&db.every(x=>x===0);
 return {kind:coplanar?'coplanar-overlap-or-touch':unique.length>1?'intersection-segment':'point-touch',points:unique,coplanar,numericalBoundary:coplanar&&!exactlyCoplanar};
}
function gridRange(b){const min=b.min.map(x=>Math.floor(x/CELL_M)),max=b.max.map(x=>Math.floor(x/CELL_M));return {min,max,count:(max[0]-min[0]+1)*(max[1]-min[1]+1)*(max[2]-min[2]+1)};}
function cells(range,fn){for(let x=range.min[0];x<=range.max[0];x++)for(let y=range.min[1];y<=range.max[1];y++)for(let z=range.min[2];z<=range.max[2];z++)fn(x+','+y+','+z);}
function flatPoint(positions,i){if(!Number.isInteger(i)||i<0||i*3+2>=positions.length)throw Error('Static intersection source index is invalid');const p=[positions[i*3],positions[i*3+1],positions[i*3+2]];if(!p.every(Number.isFinite))throw Error('Static intersection requires finite current WORLD positions');return p;}
function makeRow(p,metadata){const n=normal(p);return {...metadata,p,n:n.n,area2:n.area2,box:box(p)};}

/** Explicit QA only. No pose update, simulation step, geometry write or sign
 * oracle is used. nativeBody must already be updated at the same current pose
 * as bare.queryAPI. This checks surface intersections, not enclosed membership,
 * clearance, self-contact, swept CCD, or the topology of the surface union. */
export function inspectShortsTriangleCrossings(cloth,nativeBody,bare){
 const started=performance.now(),snapshot=nativeBody.snapshot(),bareAPI=bare?.queryAPI;
 if(!Array.isArray(cloth?.positions)||!Array.isArray(cloth?.triangles)||!Array.isArray(nativeBody?.triangles)||!bareAPI?.positions||!bareAPI.indices)throw Error('Actual current cloth/native/bare triangle sources required');
 const nativePositions=nativeBody.positions,barePositions=bareAPI.positions,bareIndices=bareAPI.indices,excluded=new Set([9,10,19,...(snapshot.contactExcludedParts||[])]),clothRows=[],bodyRows=[];
 const counts={clothTriangles:cloth.triangles.length,nativeSourceTriangles:nativeBody.triangles.length,bareSourceTriangles:bareIndices.length/3,nativeExcluded:0,bodyOutsideClothBounds:0,broadphaseCandidates:0,aabbOverlappingPairs:0,tested:0,skippedZeroAreas:{cloth:0,native:0,bare:0},largeBodyBoxFallback:0,largeClothBoxFallback:0,coplanar:0,numericalBoundary:0};
 if(!Number.isInteger(counts.bareSourceTriangles))throw Error('Bare source triangles must be complete');
 for(let id=0;id<cloth.triangles.length;id++){
  const t=cloth.triangles[id];if(!Array.isArray(t.q)||t.q.length!==3)throw Error('Actual cloth quotient triangle required');
  const p=t.q.map(i=>{const point=cloth.positions[i];if(!point||point.length!==3||!point.every(Number.isFinite))throw Error('Finite current WORLD cloth DOF required');return point.slice();});clothRows.push(makeRow(p,{id,indices:t.q.slice(),sourceIndices:t.original?.slice()??null}));
 }
 if(!clothRows.length)throw Error('Nonempty actual cloth required');
 const allClothBox={min:[0,1,2].map(k=>Math.min(...clothRows.map(r=>r.box.min[k]))),max:[0,1,2].map(k=>Math.max(...clothRows.map(r=>r.box.max[k])))};
 function addBody(row){if(!overlaps(row.box,allClothBox)){counts.bodyOutsideClothBounds++;return;}if(row.area2<=1e-20){counts.skippedZeroAreas[row.surface]++;return;}bodyRows.push(row);}
 for(const t of nativeBody.triangles){if(excluded.has(t.part)){counts.nativeExcluded++;continue;}if(t.indices?.length!==3)throw Error('Actual native triangle required');addBody(makeRow(t.indices.map(i=>flatPoint(nativePositions,i)),{id:t.id,indices:t.indices.slice(),part:t.part,surface:'native'}));}
 for(let i=0;i<bareIndices.length;i+=3){const indices=Array.from(bareIndices.slice(i,i+3));addBody(makeRow(indices.map(j=>flatPoint(barePositions,j)),{id:i/3,indices,part:'authored-bare-pelvis',surface:'bare'}));}
 const grid=new Map(),large=[];for(let id=0;id<bodyRows.length;id++){const r=gridRange(bodyRows[id].box);if(r.count>MAX_CELLS){large.push(id);counts.largeBodyBoxFallback++;continue;}cells(r,key=>{if(!grid.has(key))grid.set(key,[]);grid.get(key).push(id);});}
 const exactcrossings=[];for(const c of clothRows){if(c.area2<=1e-20){counts.skippedZeroAreas.cloth++;continue;}const range=gridRange(c.box);let candidates;
  if(range.count>MAX_CELLS){candidates=bodyRows.map((_,i)=>i);counts.largeClothBoxFallback++;}
  else{const set=new Set(large);cells(range,key=>{for(const id of grid.get(key)||[])set.add(id);});candidates=set;}
  for(const id of candidates){counts.broadphaseCandidates++;const b=bodyRows[id];if(!overlaps(c.box,b.box))continue;counts.aabbOverlappingPairs++;counts.tested++;const hit=intersections(c,b);if(!hit)continue;if(hit.coplanar)counts.coplanar++;if(hit.numericalBoundary)counts.numericalBoundary++;
   exactcrossings.push({clothTriangle:c.id,clothDOFs:c.indices,clothSourceIndices:c.sourceIndices,bodyTriangle:b.id,bodyIndices:b.indices,part:b.part,surface:b.surface,clothWorldXYZ:c.p,bodyWorldXYZ:b.p,...hit});
  }
 }
 const after=nativeBody.snapshot();if(snapshot.revision!==after.revision||snapshot.time!==after.time)throw Error('HOLD: native pose changed during static triangle inspection');
 const degenerate=Object.values(counts.skippedZeroAreas).reduce((s,n)=>s+n,0),valid=exactcrossings.length===0&&degenerate===0;
 return {schema:'r008-shorts-static-triangle-intersections/v1',valid,status:valid?'NO_STATIC_SURFACE_INTERSECTIONS_OBSERVED':'HOLD',coordinateFrame:'current WORLD metres',nativeRevision:snapshot.revision,nativeTime:snapshot.time,excludedParts:[...excluded],clothDOFs:cloth.positions.length,counts,exactcrossings,crossingCount:exactcrossings.length,elapsedMs:performance.now()-started,
  broadphase:{method:'conservative padded AABB spatial grid; oversized body or cloth boxes use exhaustive fallback',cellSizeM:CELL_M,gridCells:grid.size,maxCellsPerBox:MAX_CELLS},
  predicate:{authority:'double precision six closed-edge/triangle tests plus dominant-plane coplanar polygon clipping; actual current source XYZ',toleranceM:EPS_M,exactArithmetic:false,coplanarSupported:true,numericalBoundaryCount:counts.numericalBoundary,zeroAreaSquaredMetresThreshold:1e-20},
  limitations:{wholeSolidUnionCertified:false,closedMembershipCertified:false,clearanceCertified:false,selfContactChecked:false,continuousCCDChecked:false,nativeMotionValidated:false,physicalWearingValidated:false},mutations:0};
}
