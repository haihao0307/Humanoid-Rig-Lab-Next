// Discrete original-cloth barycentric probes. No garment shell/target, no CCD.
// A sample correction is distributed to its real corners with their physical
// inverse masses; this neither changes source UVs nor welds particle identities.
class ShortsSurfaceContact {
 constructor(particles,triangleRecords,body,{clearanceM=.0025,toleranceM=.001,includeVertices=true,dofs=null}={}){
  if(!Array.isArray(particles)||!particles.length||!Array.isArray(triangleRecords)||!triangleRecords.length)throw Error('Surface contact requires original cloth particles and triangles');
  if(!Number.isFinite(clearanceM)||clearanceM<0||!Number.isFinite(toleranceM)||toleranceM<0||typeof includeVertices!=='boolean')throw Error('Invalid surface contact options');
  if(body!==null&&body!==undefined&&(typeof body.closest!=='function'||typeof body.project!=='function'))throw Error('Surface contact requires actual body project and global closest queries');
  if(dofs!==null&&(typeof dofs.project!=='function'||typeof dofs.effectiveInverseMass!=='function'))throw Error('Invalid surface stitch degrees of freedom');
  this.particles=particles;this.body=body;this.dofs=dofs;this.clearanceM=clearanceM;this.toleranceM=toleranceM;this.probes=[];this.triangleCount=triangleRecords.length;this.solveCount=0;this.projectionCount=0;this.outsideSkipCount=0;this.blockedProjectionCount=0;this.peakRequestedCorrectionM=0;
  this.validateParticles();const edges=new Map(),incidence=particles.map(()=>[]),pieceTriangleCounts=new Map(),triangles=[];
  for(let index=0;index<triangleRecords.length;index++){
   const record=triangleRecords[index],indices=record.indices;if(!Array.isArray(indices)||indices.length!==3||new Set(indices).size!==3||indices.some(i=>!Number.isInteger(i)||i<0||i>=particles.length))throw Error('Invalid original cloth surface triangle');
   const pieceId=record.pieceId??particles[indices[0]].pieceId??null,localTriangle=pieceTriangleCounts.get(pieceId)||0;pieceTriangleCounts.set(pieceId,localTriangle+1);const face={triangleIndex:index,pieceId,localTriangle};triangles.push({indices:[...indices],face});
   for(const i of indices)incidence[i].push(face);
   for(let k=0;k<3;k++){const pair=[indices[k],indices[(k+1)%3]].sort((a,b)=>a-b),key=pair.join(':');if(!edges.has(key))edges.set(key,{indices:pair,faces:[]});edges.get(key).faces.push(face);}
  }
  const add=(kind,indices,weights,faces)=>this.probes.push({kind,indices,weights,faces,pos:[0,0,0],previous:[0,0,0],gradients:indices.map(()=>[0,0,0]),freeBall:null});
  if(includeVertices)for(let i=0;i<particles.length;i++)add('vertex',[i],[1],incidence[i]);
  for(const edge of edges.values())add('edgeMidpoint',edge.indices,[.5,.5],edge.faces);
  for(const triangle of triangles)add('triangleCentroid',triangle.indices,[1/3,1/3,1/3],[triangle.face]);
  this.counts={vertex:includeVertices?particles.length:0,edgeMidpoint:edges.size,triangleCentroid:triangles.length};
 }
 validateParticles(){for(const p of this.particles){if(!p||!Array.isArray(p.pos)||p.pos.length!==3||p.pos.some(v=>!Number.isFinite(v))||!Number.isFinite(p.invMass)||p.invMass<0)throw Error('Invalid cloth position or physical inverse mass');if(p.previous!==undefined&&(!Array.isArray(p.previous)||p.previous.length!==3||p.previous.some(v=>!Number.isFinite(v))))throw Error('Invalid cloth previous position');}}
 sample(probe,current,previous=null){current.fill(0);if(previous)previous.fill(0);let inverseMass=0;
  for(let j=0;j<probe.indices.length;j++){const p=this.particles[probe.indices[j]],w=probe.weights[j];inverseMass+=p.invMass*w*w;for(let k=0;k<3;k++){current[k]+=p.pos[k]*w;if(previous)previous[k]+=(p.previous||p.pos)[k]*w;}}
  return inverseMass;
 }
 outsideKnownBall(probe,alpha){const ball=probe.freeBall;if(!ball||ball.poseVersion!==this.body.poseVersion||ball.alpha!==alpha)return false;return Math.hypot(probe.pos[0]-ball.centre[0],probe.pos[1]-ball.centre[1],probe.pos[2]-ball.centre[2])<ball.radius-1e-12;}
 solve(alpha=1){
  if(!Number.isFinite(alpha)||alpha<0||alpha>1)throw Error('Invalid surface contact interpolation');this.validateParticles();this.solveCount++;
  if(!this.body)return {enabled:false,projections:0,blockedCount:0,outsideSkipCount:0,maxRequestedCorrectionM:0};
  this.body.sample?.(alpha);const canonicalAlpha=Number.isFinite(this.body.alpha)?this.body.alpha:alpha;let projections=0,blockedCount=0,outsideSkipCount=0,sideUncertainCount=0,maxRequestedCorrectionM=0;
  for(const probe of this.probes){const inverseMass=this.sample(probe,probe.pos,probe.previous);if(this.outsideKnownBall(probe,canonicalAlpha)){outsideSkipCount++;continue;}
   const x=probe.pos[0],y=probe.pos[1],z=probe.pos[2],hit=this.body.project(probe.pos,this.clearanceM,alpha);
   if(!Number.isFinite(hit?.signedDistance)||probe.pos.some(v=>!Number.isFinite(v)))throw Error('Non-finite body surface projection');
   if(hit.sideUncertain){probe.freeBall=null;sideUncertainCount++;continue;}
   const depth=Math.max(0,this.clearanceM-hit.signedDistance),dx=probe.pos[0]-x,dy=probe.pos[1]-y,dz=probe.pos[2]-z;maxRequestedCorrectionM=Math.max(maxRequestedCorrectionM,depth);probe.freeBall=null;
   if(depth>0){if(this.dofs){const length=Math.hypot(dx,dy,dz);if(length>0){for(let j=0;j<probe.indices.length;j++){const g=probe.gradients[j],w=probe.weights[j];g[0]=w*dx/length;g[1]=w*dy/length;g[2]=w*dz/length;}const result=this.dofs.project(probe.indices,probe.gradients,-length,{alpha:0,lambda:0,tensionOnly:false});if(result?.applied)projections++;else blockedCount++;}else blockedCount++;}else if(inverseMass>0){for(let j=0;j<probe.indices.length;j++){const p=this.particles[probe.indices[j]],factor=p.invMass*probe.weights[j]/inverseMass;if(!factor)continue;p.pos[0]+=dx*factor;p.pos[1]+=dy*factor;p.pos[2]+=dz*factor;}projections++;}else blockedCount++;}
   else if(Number.isFinite(this.body.poseVersion)&&Number.isFinite(this.body.alpha)){
    // Positive exact signed distance gives an empty ball of this radius. It
    // remains a proof only while the body geometry/interpolation is unchanged.
    const distance=Number.isFinite(hit.distance)?hit.distance:hit.signedDistance,radius=distance-this.clearanceM;if(radius>0)probe.freeBall={centre:[x,y,z],radius,poseVersion:this.body.poseVersion,alpha:canonicalAlpha};
   }
  }
  this.projectionCount+=projections;this.blockedProjectionCount+=blockedCount;this.outsideSkipCount+=outsideSkipCount;this.peakRequestedCorrectionM=Math.max(this.peakRequestedCorrectionM,maxRequestedCorrectionM);
  return {enabled:true,projections,blockedCount,outsideSkipCount,sideUncertainCount,maxRequestedCorrectionM,sampleCount:this.probes.length,completeTriangleCertificate:false};
 }
 report(alpha=1){
  if(!Number.isFinite(alpha)||alpha<0||alpha>1)throw Error('Invalid surface report interpolation');this.validateParticles();
  const byKind=Object.fromEntries(Object.keys(this.counts).map(kind=>[kind,{count:this.counts[kind],unresolvedCount:0,sideUncertainCount:0,maxResidualM:0,maxSkinPenetrationM:0}])),point=[0,0,0];let unresolvedCount=0,sideUncertainCount=0,uncertainExample=null,fixedBlockedCount=0,maxResidualM=0,maxSkinPenetrationM=0,worst=null;
  if(this.body)for(const probe of this.probes){const inverseMass=this.sample(probe,point),hit=this.body.closest(point,alpha);if(!Number.isFinite(hit?.signedDistance))throw Error('Non-finite global surface contact report');const stat=byKind[probe.kind];if(hit.sideUncertain){sideUncertainCount++;stat.sideUncertainCount++;if(!uncertainExample)uncertainExample={kind:probe.kind,indices:[...probe.indices],point:[...point],bodyTriangleId:hit.triangleId??null,sideEvidence:hit.sideEvidence??null};continue;}const residual=Math.max(0,this.clearanceM-hit.signedDistance),penetration=Math.max(0,-hit.signedDistance);stat.maxResidualM=Math.max(stat.maxResidualM,residual);stat.maxSkinPenetrationM=Math.max(stat.maxSkinPenetrationM,penetration);maxSkinPenetrationM=Math.max(maxSkinPenetrationM,penetration);
   if(residual>this.toleranceM){unresolvedCount++;stat.unresolvedCount++;let movable=inverseMass;if(this.dofs){const gradients=probe.weights.map(w=>hit.normal.map(v=>w*v));movable=this.dofs.effectiveInverseMass(probe.indices,gradients);}if(movable===0)fixedBlockedCount++;}
   if(residual>maxResidualM){maxResidualM=residual;worst={kind:probe.kind,indices:[...probe.indices],barycentric:[...probe.weights],faces:probe.faces.map(f=>({...f})),point:[...point],residualM:residual,skinPenetrationM:penetration,bodyTriangleId:hit.triangleId??null,bodyClosestFeature:hit.closestFeature??null};}
  }
  return {enabled:!!this.body,method:'original-cloth-vertex-edge-midpoint-face-centroid-inverse-mass-projection',sampleCount:this.probes.length,triangleCount:this.triangleCount,counts:{...this.counts},clearanceM:this.clearanceM,toleranceM:this.toleranceM,unresolvedCount,sideUncertainCount,uncertainExample,fixedBlockedCount,maxResidualM,maxPenetrationM:maxResidualM,maxSkinPenetrationM,worst,byKind,discreteContactChecksMet:!!this.body&&unresolvedCount===0&&sideUncertainCount===0,passed:!!this.body&&unresolvedCount===0&&sideUncertainCount===0,solveCount:this.solveCount,projectionCount:this.projectionCount,outsideSkipCount:this.outsideSkipCount,blockedProjectionCount:this.blockedProjectionCount,peakRequestedCorrectionM:this.peakRequestedCorrectionM,originalUVAndMassUnchanged:true,reportMutatesCloth:false,reportQueries:'global closest for every current sample; no cached pass',finiteSampling:true,completeTriangleCertificate:false,continuousCollisionDetection:false};
 }
}
