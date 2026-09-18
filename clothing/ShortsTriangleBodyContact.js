// Supplemental discrete cloth/body triangle contact. Authored from geometric
// closest-feature identities, not a garment target or a body offset mesh.
// Every witness is a barycentric point of the current original cloth triangle.
const SHORTS_TRIANGLE_BODY_CONTACT_VERSION='original-triangle-body-contact-1';
const stbcSub=(a,b)=>a.map((v,k)=>v-b[k]);
const stbcDot=(a,b)=>a.reduce((sum,v,k)=>sum+v*b[k],0);
const stbcCross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const stbcNorm=a=>Math.hypot(...a);
const stbcMix=(points,weights)=>[0,1,2].map(k=>points.reduce((sum,p,i)=>sum+p[k]*weights[i],0));
const stbcClamp=x=>Math.max(0,Math.min(1,x));
const stbcBox=(points,pad=0)=>({min:[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))-pad),max:[0,1,2].map(k=>Math.max(...points.map(p=>p[k]))+pad)});
const stbcOverlap=(a,b)=>a.min.every((v,k)=>v<=b.max[k]&&a.max[k]>=b.min[k]);
function stbcContactPrism(points,pad){
 const normal=stbcCross(stbcSub(points[1],points[0]),stbcSub(points[2],points[0])),length=stbcNorm(normal),n=normal.map(v=>v/length),planes=[];
 const add=(direction,origin)=>planes.push({normal:direction,offset:stbcDot(direction,origin)-pad-1e-12});
 add(n,points[0]);add(n.map(v=>-v),points[0]);
 for(let i=0;i<3;i++){const edge=stbcSub(points[(i+1)%3],points[i]),inward=stbcCross(n,edge),length=stbcNorm(inward);add(inward.map(v=>v/length),points[i]);}
 return planes;
}
// The five half-spaces contain the triangle plus a radius-pad ball. Reject a
// body AABB only if its maximum support value lies outside one half-space.
// This also prunes skin deep inside the box of a large slanted cloth triangle.
const stbcInsidePrism=(bounds,planes)=>planes.every(p=>p.normal.reduce((sum,n,k)=>sum+n*(n>=0?bounds.max[k]:bounds.min[k]),0)>=p.offset);
const stbcTriangleInPrism=(points,planes)=>planes.every(p=>Math.max(...points.map(v=>stbcDot(p.normal,v)))>=p.offset);
function stbcSkinPlaneSeparated(cloth,skin,pad){
 const n=stbcCross(stbcSub(skin[1],skin[0]),stbcSub(skin[2],skin[0])),length=stbcNorm(n);if(length<1e-18)return false;
 const values=cloth.map(p=>stbcDot(n,stbcSub(p,skin[0]))),bound=(pad+1e-12)*length;return Math.min(...values)>bound||Math.max(...values)<-bound;
}

function stbcClosestSegments(a,b,c,d){
 const u=stbcSub(b,a),v=stbcSub(d,c),w=stbcSub(a,c),uu=stbcDot(u,u),vv=stbcDot(v,v),uv=stbcDot(u,v),uw=stbcDot(u,w),vw=stbcDot(v,w);let s=0,t=0;
 if(uu<=1e-30&&vv<=1e-30)return {s,t,a:[...a],b:[...c]};
 if(uu<=1e-30)t=stbcClamp(vw/vv);else if(vv<=1e-30)s=stbcClamp(-uw/uu);else{const den=uu*vv-uv*uv;s=den>1e-14*uu*vv?stbcClamp((uv*vw-uw*vv)/den):0;t=(uv*s+vw)/vv;if(t<0){t=0;s=stbcClamp(-uw/uu);}else if(t>1){t=1;s=stbcClamp((uv-uw)/uu);}}
 return {s,t,a:a.map((x,k)=>x+s*u[k]),b:c.map((x,k)=>x+t*v[k])};
}
function stbcClosestTriangle(point,triangle){
 const [a,b,c]=triangle,ab=stbcSub(b,a),ac=stbcSub(c,a),normal=stbcCross(ab,ac),normal2=stbcDot(normal,normal);
 // Degenerate skin primitives still contribute their real edges and points.
 // A degenerate cloth face is separately an explicit uncertainty, never pass.
 if(normal2<=1e-28*Math.max(stbcDot(ab,ab),stbcDot(ac,ac))**2){let best=null;for(let i=0;i<3;i++){const j=(i+1)%3,pair=stbcClosestSegments(point,point,triangle[i],triangle[j]),weights=[0,0,0];weights[i]=1-pair.t;weights[j]=pair.t;const distance=stbcNorm(stbcSub(point,pair.b));if(!best||distance<best.distance)best={point:pair.b,barycentric:weights,distance};}return best;}
 const ap=stbcSub(point,a),d1=stbcDot(ab,ap),d2=stbcDot(ac,ap);let bary;
 if(d1<=0&&d2<=0)bary=[1,0,0];else{const bp=stbcSub(point,b),d3=stbcDot(ab,bp),d4=stbcDot(ac,bp);if(d3>=0&&d4<=d3)bary=[0,1,0];else{const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);bary=[1-v,v,0];}else{const cp=stbcSub(point,c),d5=stbcDot(ab,cp),d6=stbcDot(ac,cp);if(d6>=0&&d5<=d6)bary=[0,0,1];else{const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);bary=[1-w,0,w];}else{const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/(d4-d3+d5-d6);bary=[0,1-w,w];}else{const den=1/(va+vb+vc),v=vb*den,w=vc*den;bary=[1-v-w,v,w];}}}}}}
 const closest=stbcMix(triangle,bary);return {point:closest,barycentric:bary,distance:stbcNorm(stbcSub(point,closest))};
}
function stbcSegmentTriangle(a,b,triangle){
 const e1=stbcSub(triangle[1],triangle[0]),e2=stbcSub(triangle[2],triangle[0]),d=stbcSub(b,a),p=stbcCross(d,e2),det=stbcDot(e1,p),scale=stbcNorm(e1)*stbcNorm(e2)*stbcNorm(d);
 // Coplanar proximity is covered by vertex/face and edge/edge distances below.
 if(!scale||Math.abs(det)<=1e-12*scale)return null;
 const q0=stbcSub(a,triangle[0]),u=stbcDot(q0,p)/det,q=stbcCross(q0,e1),v=stbcDot(d,q)/det,t=stbcDot(e2,q)/det,epsilon=1e-10;
 if(t< -epsilon||t>1+epsilon||u< -epsilon||v< -epsilon||u+v>1+epsilon)return null;
 const strict=t>1e-8&&t<1-1e-8&&u>1e-8&&v>1e-8&&u+v<1-1e-8;
 return {t:stbcClamp(t),barycentric:[1-u-v,u,v],strict};
}

// Exact feature enumeration in real arithmetic; implementation uses doubles and
// the documented relative parallel tolerance above. Not an interval certificate.
function shortsTriangleBodyFeatures(cloth,skin,clearanceM){
 const witnesses=[];let minimumDistanceM=Infinity,strictCrossing=false;
 const add=(clothBarycentric,bodyBarycentric,distanceM,kind,strict=false)=>{minimumDistanceM=Math.min(minimumDistanceM,distanceM);strictCrossing||=strict;if(distanceM<=clearanceM+1e-12)witnesses.push({clothBarycentric,bodyBarycentric,distanceM,kind,strictCrossing:strict});};
 for(let i=0;i<3;i++){const unit=[0,0,0];unit[i]=1;const a=stbcClosestTriangle(cloth[i],skin),b=stbcClosestTriangle(skin[i],cloth);add(unit,a.barycentric,a.distance,'cloth_vertex_body_face');add(b.barycentric,unit,b.distance,'body_vertex_cloth_face');}
 for(let i=0;i<3;i++)for(let j=0;j<3;j++){const a=(i+1)%3,b=(j+1)%3,c=stbcClosestSegments(cloth[i],cloth[a],skin[j],skin[b]),wa=[0,0,0],wb=[0,0,0];wa[i]=1-c.s;wa[a]=c.s;wb[j]=1-c.t;wb[b]=c.t;add(wa,wb,stbcNorm(stbcSub(c.a,c.b)),'edge_edge');}
 for(let i=0;i<3;i++){const j=(i+1)%3,a=stbcSegmentTriangle(cloth[i],cloth[j],skin),b=stbcSegmentTriangle(skin[i],skin[j],cloth);if(a){const w=[0,0,0];w[i]=1-a.t;w[j]=a.t;add(w,a.barycentric,0,'cloth_edge_body_face',a.strict);}if(b){const w=[0,0,0];w[i]=1-b.t;w[j]=b.t;add(b.barycentric,w,0,'body_edge_cloth_face',b.strict);}}
 return {minimumDistanceM,strictCrossing,witnesses};
}

class ShortsTriangleBodyContact {
 constructor(particles,triangleRecords,body,{clearanceM=.0025,toleranceM=.001,searchMarginM=.001,dofs=null,maxCandidates=200000,maxWitnessQueries=60000}={}){
  if(!Array.isArray(particles)||!particles.length||!Array.isArray(triangleRecords)||!triangleRecords.length)throw Error('Original cloth triangles are required');
  if(!Number.isFinite(clearanceM)||clearanceM<0||!Number.isFinite(toleranceM)||toleranceM<0||!Number.isFinite(searchMarginM)||searchMarginM<0||!Number.isInteger(maxCandidates)||maxCandidates<1||!Number.isInteger(maxWitnessQueries)||maxWitnessQueries<1)throw Error('Invalid triangle body contact options');
  if(!body?.tree||!Array.isArray(body.triangles)||!Array.isArray(body.blocks)||typeof body.prepareBlock!=='function'||typeof body.poseNode!=='function'||typeof body.closest!=='function')throw Error('Actual body triangle BVH and global closest queries are required');
  if(dofs!==null&&typeof dofs.project!=='function')throw Error('Invalid original stitch projector');
  this.particles=particles;this.body=body;this.dofs=dofs;this.clearanceM=clearanceM;this.toleranceM=toleranceM;this.searchMarginM=searchMarginM;this.maxCandidates=maxCandidates;this.maxWitnessQueries=maxWitnessQueries;this.knownWitnesses=new Map();this.knownReplacementCount=0;
  const counts=new Map();this.triangles=triangleRecords.map((record,triangleIndex)=>{const indices=record.indices;if(!Array.isArray(indices)||indices.length!==3||new Set(indices).size!==3||indices.some(i=>!Number.isInteger(i)||!particles[i]))throw Error('Invalid original cloth triangle');const pieceId=record.pieceId??particles[indices[0]].pieceId??null,localTriangle=counts.get(pieceId)||0;counts.set(pieceId,localTriangle+1);return {indices:[...indices],triangleIndex,pieceId,localTriangle,freeBall:null};});
 }
 _positions(t){return t.indices.map(i=>{const p=this.particles[i];if(!Array.isArray(p.pos)||p.pos.length!==3||p.pos.some(v=>!Number.isFinite(v))||!Number.isFinite(p.invMass)||p.invMass<0)throw Error('Invalid original cloth position/mass');return p.pos;});}
 _outsideBall(t,points,alpha){const b=t.freeBall;return !!b&&b.poseVersion===this.body.poseVersion&&b.alpha===alpha&&points.every(p=>stbcNorm(stbcSub(p,b.center))+this.clearanceM<b.radius-1e-12);}
 _outsideCertificate(t,points,alpha){const c=t.clearanceCertificate;return !!c&&c.poseVersion===this.body.poseVersion&&c.alpha===alpha&&Math.max(...points.map((p,i)=>stbcNorm(stbcSub(p,c.positions[i]))))+this.clearanceM<c.distanceM-1e-12;}
 _project(tri,barycentric,normal,residualM){
  const gradients=barycentric.map(w=>normal.map(v=>w*v));if(this.dofs)return !!this.dofs.project(tri.indices,gradients,-residualM,{alpha:0,lambda:0,tensionOnly:false}).applied;
  const denominator=tri.indices.reduce((sum,i,j)=>sum+this.particles[i].invMass*stbcDot(gradients[j],gradients[j]),0);if(!(denominator>0))return false;
  for(let j=0;j<3;j++){const p=this.particles[tri.indices[j]],factor=p.invMass*residualM/denominator;for(let k=0;k<3;k++)p.pos[k]+=factor*gradients[j][k];}return true;
 }
 _remember(tri,witness){
  // Called only after the full current face scan. This is its current deepest
  // contact, not an ever-growing history of moving material points. The full
  // scan still checks every feature; this single middle-sweep witness cannot
  // issue a complete pass, and does not replace the next full scan.
  const previous=this.knownWitnesses.get(tri.triangleIndex)?.[0];
  if(previous&&previous.barycentric.every((v,i)=>Math.abs(v-witness.barycentric[i])<1e-12))return;
  if(previous)this.knownReplacementCount++;
  this.knownWitnesses.set(tri.triangleIndex,[{barycentric:witness.barycentric.slice(),sourceKind:witness.kind}]);
 }
 projectKnown(alpha=1){
  if(!Number.isFinite(alpha)||alpha<0||alpha>1)throw Error('Invalid known-contact interpolation');this.body.sample?.(alpha);alpha=Number.isFinite(this.body.alpha)?this.body.alpha:alpha;
  const state={enabled:true,method:'persistent_original_cloth_barycentric_witnesses_fresh_global_body_query',knownOnly:true,completeContactCheck:false,passed:null,witnessCount:0,queryCount:0,projectionCount:0,blockedProjectionCount:0,sideUncertainCount:0,maxRequestedCorrectionM:0,replacedWitnessCount:this.knownReplacementCount,originalPreviousUnchanged:true};
  for(const [index,witnesses]of this.knownWitnesses){const tri=this.triangles[index];for(const w of witnesses){state.witnessCount++;const point=stbcMix(this._positions(tri),w.barycentric),hit=this.body.closest(point,alpha);state.queryCount++;if(!Number.isFinite(hit?.signedDistance)||!Array.isArray(hit.normal)||hit.normal.some(v=>!Number.isFinite(v)))throw Error('Nonfinite known body witness');if(hit.sideUncertain){state.sideUncertainCount++;continue;}const residual=Math.max(0,this.clearanceM-hit.signedDistance);state.maxRequestedCorrectionM=Math.max(state.maxRequestedCorrectionM,residual);if(residual>0){if(this._project(tri,w.barycentric,hit.normal,residual))state.projectionCount++;else state.blockedProjectionCount++;tri.freeBall=null;tri.clearanceCertificate=null;}}}
  return state;
 }
 _candidates(bounds,planes,state){const ids=[],stack=[this.body.tree];while(stack.length){const node=stack.pop();if(!stbcOverlap(bounds,node)||!stbcInsidePrism(node,planes))continue;if(node.blocks){for(const id of node.blocks){const block=this.body.blocks[id];if(stbcOverlap(bounds,block)&&stbcInsidePrism(block,planes)){this.body.prepareBlock(block);stack.push(block.tree);}}}else if(node.ids){for(const id of node.ids){if(++state.bvhCandidateCount>this.maxCandidates){state.budgetExceeded=true;return ids;}ids.push(id);}}else stack.push(node.left,node.right);}return ids;}
 _scan(project,alpha){
  if(!Number.isFinite(alpha)||alpha<0||alpha>1)throw Error('Invalid body interpolation');this.body.sample?.(alpha);alpha=Number.isFinite(this.body.alpha)?this.body.alpha:alpha;
  const state={enabled:true,version:SHORTS_TRIANGLE_BODY_CONTACT_VERSION,method:'actual_body_bvh_triangle_features_original_cloth_barycentric_projection',triangleCount:this.triangles.length,bvhCandidateCount:0,narrowPhasePairCount:0,witnessQueryCount:0,strictCrossingTrianglePairs:0,crossingClothTriangleCount:0,nearContactPairCount:0,unresolvedWitnessCount:0,sideUncertainCount:0,degenerateClothTriangleCount:0,budgetExceeded:false,outsideBallTriangleCount:0,clearanceCertificateTriangleCount:0,projectionCount:0,blockedProjectionCount:0,maxResidualM:0,maxSkinPenetrationM:0,worst:null,crossingExamples:[],unknownExample:null,clearanceM:this.clearanceM,toleranceM:this.toleranceM,originalUVAndMassUnchanged:true,originalPreviousUnchanged:true,completeTriangleCertificate:false,continuousCollisionDetection:false,wholeBodyInsideCertificate:false};
  for(const tri of this.triangles){
   const points=this._positions(tri);if(this._outsideBall(tri,points,alpha)){state.outsideBallTriangleCount++;continue;}if(this._outsideCertificate(tri,points,alpha)){state.clearanceCertificateTriangleCount++;continue;}tri.clearanceCertificate=null;
   const normal=stbcCross(stbcSub(points[1],points[0]),stbcSub(points[2],points[0]));if(stbcNorm(normal)<1e-18){state.degenerateClothTriangleCount++;continue;}
   const centroid=stbcMix(points,[1/3,1/3,1/3]),centroidHit=this.body.closest(centroid,alpha),radius=Math.max(...points.map(p=>stbcNorm(stbcSub(p,centroid))));
   if(!Number.isFinite(centroidHit?.signedDistance))throw Error('Nonfinite body centroid query');
   if(centroidHit.sideUncertain){state.sideUncertainCount++;state.unknownExample??={triangleIndex:tri.triangleIndex,point:centroid,bodyTriangleId:centroidHit.triangleId};tri.freeBall=null;}
   else if(centroidHit.signedDistance>0&&Number.isFinite(centroidHit.distance)&&Number.isFinite(this.body.poseVersion)){tri.freeBall={poseVersion:this.body.poseVersion,alpha,center:centroid,radius:centroidHit.distance};if(centroidHit.distance>radius+this.clearanceM+1e-12){state.outsideBallTriangleCount++;continue;}}
   else tri.freeBall=null;
   const searchRadius=this.clearanceM+this.searchMarginM,bounds=stbcBox(points,searchRadius),planes=stbcContactPrism(points,searchRadius),candidates=this._candidates(bounds,planes,state),witnesses=new Map();let crossed=false,minDistanceM=searchRadius;
   // Also retain the already queried centroid. In particular a whole face
   // deep inside a body must not pass merely because no skin AABB is nearby.
   witnesses.set('centroid',{clothBarycentric:[1/3,1/3,1/3],bodyTriangleId:centroidHit.triangleId,kind:'triangle_centroid'});
   for(const id of candidates){const bodyTri=this.body.triangles[id],skin=bodyTri.ids.map(i=>this.body.poseNode(i,alpha)),skinBounds=stbcBox(skin);if(!stbcOverlap(bounds,skinBounds)||!stbcInsidePrism(skinBounds,planes)||!stbcTriangleInPrism(skin,planes)||stbcSkinPlaneSeparated(points,skin,searchRadius))continue;state.narrowPhasePairCount++;const pair=shortsTriangleBodyFeatures(points,skin,this.clearanceM);minDistanceM=Math.min(minDistanceM,pair.minimumDistanceM);if(pair.witnesses.length)state.nearContactPairCount++;
    if(pair.strictCrossing){state.strictCrossingTrianglePairs++;crossed=true;if(state.crossingExamples.length<8)state.crossingExamples.push({triangleIndex:tri.triangleIndex,pieceId:tri.pieceId,localTriangle:tri.localTriangle,bodyTriangleId:id});}
    for(const w of pair.witnesses){const key=w.clothBarycentric.map(v=>v.toPrecision(14)).join(':');if(!witnesses.has(key))witnesses.set(key,{...w,bodyTriangleId:id});}
   }
   if(crossed)state.crossingClothTriangleCount++;
   // For an unchanged body, distance between triangle and skin is 1-Lipschitz
   // under the maximum displacement of its three corners (Hausdorff bound).
   // An exhaustive search to searchRadius supplies a lower bound even when
   // every skin primitive was farther away. Never cache an exhausted search.
   if(!state.budgetExceeded&&!crossed&&!centroidHit.sideUncertain&&centroidHit.signedDistance>0&&minDistanceM>this.clearanceM+1e-12&&Number.isFinite(this.body.poseVersion))tri.clearanceCertificate={positions:points.map(p=>[...p]),distanceM:minDistanceM,poseVersion:this.body.poseVersion,alpha};
   let deepest=null,faceSideUncertain=centroidHit.sideUncertain===true;
   for(const w of witnesses.values()){
    if(++state.witnessQueryCount>this.maxWitnessQueries){state.budgetExceeded=true;break;}
    const point=stbcMix(points,w.clothBarycentric),hit=this.body.closest(point,alpha);if(!Number.isFinite(hit?.signedDistance)||!Array.isArray(hit.normal)||hit.normal.some(v=>!Number.isFinite(v)))throw Error('Nonfinite body contact witness');
    if(hit.sideUncertain){state.sideUncertainCount++;faceSideUncertain=true;state.unknownExample??={triangleIndex:tri.triangleIndex,point,bodyTriangleId:hit.triangleId};continue;}
    const residual=Math.max(0,this.clearanceM-hit.signedDistance),penetration=Math.max(0,-hit.signedDistance);if(residual>this.toleranceM)state.unresolvedWitnessCount++;state.maxSkinPenetrationM=Math.max(state.maxSkinPenetrationM,penetration);
    const record={triangleIndex:tri.triangleIndex,pieceId:tri.pieceId,localTriangle:tri.localTriangle,indices:tri.indices.slice(),barycentric:w.clothBarycentric.slice(),point,normal:hit.normal.slice(),bodyTriangleId:hit.triangleId,witnessBodyTriangleId:w.bodyTriangleId,kind:w.kind,residualM:residual,skinPenetrationM:penetration};
    if(residual>state.maxResidualM){state.maxResidualM=residual;state.worst=record;}if(residual>0&&(!deepest||residual>deepest.residualM))deepest=record;
   }
   // The deepest verified witness supplies one current scalar constraint for
   // this cloth face. Future sweeps regenerate all features after it moves.
   if(project&&!state.budgetExceeded){if(deepest&&(!faceSideUncertain||!this.knownWitnesses.has(tri.triangleIndex)))this._remember(tri,deepest);else if(!deepest&&!faceSideUncertain)this.knownWitnesses.delete(tri.triangleIndex);}
   if(project&&deepest){if(this._project(tri,deepest.barycentric,deepest.normal,deepest.residualM))state.projectionCount++;else state.blockedProjectionCount++;tri.freeBall=null;tri.clearanceCertificate=null;}
   if(state.budgetExceeded)break;
  }
  state.passed=!state.budgetExceeded&&state.strictCrossingTrianglePairs===0&&state.unresolvedWitnessCount===0&&state.sideUncertainCount===0&&state.degenerateClothTriangleCount===0;state.knownWitnessCount=this.knownWitnesses.size;state.replacedKnownWitnessCount=this.knownReplacementCount;state.evaluation=project?'before_each_face_projection_not_final_acceptance':'current_geometry_read_only';return state;
 }
 solve(alpha=1){return this._scan(true,alpha);}
 report(alpha=1){return this._scan(false,alpha);}
}
