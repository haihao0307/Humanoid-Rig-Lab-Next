// Original generated skin is the measurement/collision source. Metres throughout.
// This is a discrete triangle surface query, not continuous collision detection.
// It never changes the skeleton, garment material coordinates, or garment rest lengths.
class ShortsBody {
 constructor(surface,meshes,options={}){
  this.surface=surface;this.human=surface.boundHuman;this.scale=surface.statureScale;
  if(!(this.scale>0)||!this.human?.sourceBind)throw Error('ShortsBody requires the individual source skeleton');
  const h=this.human,s=this.scale,hips=h.sourceBind.get('hips').p;
  this.waistY=options.waistY??hips[1]+.145*s;this.bandHeight=options.waistbandHeight??.028;
  if(!Number.isFinite(this.waistY)||!Number.isFinite(this.bandHeight)||this.bandHeight<=0)throw Error('Invalid waist measurement heights');
  this.nodes=[];this.triangles=[];this.updates=0;this.alpha=1;this.contactHints=new WeakMap();
  const allowed=new Set(['hips',...(h.spine||[]).map(j=>j.id),'left_femur','right_femur','left_tibia','right_tibia']);
  const low=Math.min(...['left_tibia','right_tibia'].map(id=>h.sourceBind.get(id).p[1]))-.06*s,high=this.waistY+.08*s;
  let excludedArmTriangles=0,flippedTriangles=0,degenerateTriangles=0;
  for(const mesh of meshes){if(mesh.name!=='skin')continue;
   const local=new Map(),read=i=>{
    if(local.has(i))return local.get(i);
    const p=[-(mesh.positions[3*i]*mesh.extent[0]+mesh.origin[0]),mesh.positions[3*i+1]*mesh.extent[1]+mesh.origin[1],mesh.positions[3*i+2]*mesh.extent[2]+mesh.origin[2]],influences=[];
    let bodyWeight=0;for(let k=0;k<8;k++){const id=mesh.binding.ids[i*8+k],w=mesh.binding.weights[i*8+k]/65535;if(w){influences.push([id,w]);if(allowed.has(h.joints[id]?.id))bodyWeight+=w;}}
    if(!influences.length||p.some(v=>!Number.isFinite(v)))throw Error('Invalid ShortsBody source vertex');
    const n=ShortsBody.decodeNormal(mesh.normals[2*i]/32767,mesh.normals[2*i+1]/32767);n[0]*=-1;
    const node={rest:p,current:[...p],previous:[...p],point:[...p],normal:n,influences,bodyWeight};
    if(mesh.axillaDelta)node.axillaDelta=Array.from(mesh.axillaDelta.subarray(i*3,i*3+3));
    if(mesh.axillaNormals){node.axillaNormal=ShortsBody.decodeNormal(mesh.axillaNormals[2*i]/32767,mesh.axillaNormals[2*i+1]/32767);node.axillaNormal[0]*=-1;}
    local.set(i,node);return node;
   };
   for(let t=0;t<mesh.indices.length;t+=3){let vertices=[0,1,2].map(k=>read(mesh.indices[t+k]));
    if(Math.max(...vertices.map(v=>v.rest[1]))<low||Math.min(...vertices.map(v=>v.rest[1]))>high)continue;
    if(vertices.some(v=>v.bodyWeight<.5)){excludedArmTriangles++;continue;}
    let n=ShortsBody.cross(ShortsBody.sub(vertices[1].rest,vertices[0].rest),ShortsBody.sub(vertices[2].rest,vertices[0].rest));
    if(Math.hypot(...n)<1e-14*s*s){degenerateTriangles++;continue;}
    const hint=vertices[0].normal.map((v,k)=>v+vertices[1].normal[k]+vertices[2].normal[k]);
    if(ShortsBody.dot(n,hint)<0){[vertices[1],vertices[2]]=[vertices[2],vertices[1]];flippedTriangles++;}
    for(const v of vertices)if(v.index===undefined){v.index=this.nodes.length;this.nodes.push(v);}
    this.triangles.push({ids:vertices.map(v=>v.index),id:this.triangles.length});
   }
  }
  if(!this.triangles.length)throw Error('ShortsBody has no lower-body skin triangles');
  this.sourceReport={source:'individual-generated-skin-triangles',unit:'m',vertices:this.nodes.length,triangles:this.triangles.length,sourceHeightRangeM:[low,high],excludedArmTriangles,orientationFlips:flippedTriangles,sourceDegenerateTriangles:degenerateTriangles,continuousCollision:false,bodyFeedback:false};
  this.buildFeatureAdjacency();
  this.prepareAcceleration();
  this.measurements=null;this.waistSamples=[];this.update();
 }
 static sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
 static dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
 static cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
 static mix(a,b,t){return a.map((v,k)=>v+(b[k]-v)*t);}
 static decodeNormal(x,y){let z=1-Math.abs(x)-Math.abs(y);if(z<0){const old=x;x=(1-Math.abs(y))*(old<0?-1:1);y=(1-Math.abs(old))*(y<0?-1:1);}const l=Math.hypot(x,y,z);return [x/l,y/l,z/l];}
 static quaternion(a,b){return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];}
 static rotate(q,p){const a=ShortsBody.cross(q,p).map(v=>2*v),b=ShortsBody.cross(q,a);return p.map((v,k)=>v+q[3]*a[k]+b[k]);}
 static identicalFrame(a,b){if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&ShortsBody.identicalFrame(a[k],b[k]));}
 buildFeatureAdjacency(){
  // Only the orientation topology joins numerical source seams. Every actual
  // source triangle/position remains in the distance query without snapping.
  const cells=new Map(),canonical=[],tolerance=2e-6*this.scale;this.vertexFaces=[];this.edgeFaces=new Map();this.featureNormals=new Map();let maximumWeldM=0,collapsedSourceStrips=0;
  for(const v of this.nodes){const weights=v.influences.map(([id,w])=>[id,Math.round(w*65535)]).sort((a,b)=>a[0]-b[0]),binding=weights.map(r=>r.join(':')).join(',')+'|'+(v.axillaDelta||[]).join(':'),cell=v.rest.map(p=>Math.floor(p/tolerance));let match=null,best2=tolerance*tolerance;
   for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){const ids=cells.get([cell[0]+x,cell[1]+y,cell[2]+z].join(':')+'|'+binding)||[];for(const id of ids){const other=canonical[id];if(ShortsBody.dot(v.normal,other.normal)<=.5)continue;const d2=v.rest.reduce((sum,p,k)=>sum+(p-other.rest[k])**2,0);if(d2<=best2){best2=d2;match=id;}}}
   if(match===null){match=canonical.length;canonical.push(v);this.vertexFaces.push([]);const key=cell.join(':')+'|'+binding;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(match);}else maximumWeldM=Math.max(maximumWeldM,Math.sqrt(best2));v.canonical=match;
  }
  for(const tri of this.triangles){tri.canonical=tri.ids.map(i=>this.nodes[i].canonical);tri.signFeatures=[...new Set(tri.canonical)];if(tri.signFeatures.length<3){collapsedSourceStrips++;continue;}for(let k=0;k<3;k++){this.vertexFaces[tri.canonical[k]].push([tri.id,k]);const a=tri.canonical[k],b=tri.canonical[(k+1)%3],key=a<b?a+':'+b:b+':'+a;if(!this.edgeFaces.has(key))this.edgeFaces.set(key,[]);this.edgeFaces.get(key).push(tri.id);}}
  this.buildSideGuards();
  this.sourceReport.featureNormals={method:'incident-edge-and-angle-weighted-vertex-pseudonormals',canonicalVertices:this.vertexFaces.length,coincidentVertexWeldM:tolerance,maximumActualWeldM:maximumWeldM,matchingInfluencesRequired:true,matchingTissueDeltaRequired:true,sourceNormalDotMinimum:.5,collapsedSourceStrips,sourceGeometryModified:false,distanceTrianglesDiscarded:0,posedOrientation:'geometric face aligned to deformed original outward vertex normals',insideCertificate:false,ambiguousNormalCosine:.2,ambiguousFallback:'actual-triangle-line-parity; two independent agreeing directions; both half-lines agree; open-edge and seam guards avoided',sideGuardCount:this.sideGuards.length,unknownSide:'no projection, no outside certificate, contact acceptance fails'};
 }
 buildSideGuards(){
  // A cropped/open component can be capped inside its vertex convex hull.
  // Lines crossing its AABB cannot distinguish that unknown cap from a hole.
  // Numerical sign-topology welds are NOT physical welds: guard the complete
  // four-endpoint ribbon between the two original source edges as well.
  const open=new Map(),seams=[],parents=this.triangles.map(t=>t.id),find=id=>{while(parents[id]!==id){parents[id]=parents[parents[id]];id=parents[id];}return id;};
  for(const [key,faces]of this.edgeFaces){const pair=key.split(':').map(Number),edges=faces.map(id=>{const t=this.triangles[id],a=t.canonical.indexOf(pair[0]),b=t.canonical.indexOf(pair[1]);return [t.ids[a],t.ids[b]];});
   const parent=find(faces[0]);for(const id of faces)parents[find(id)]=parent;
   if(faces.length!==2){for(const a of pair){if(!open.has(a))open.set(a,new Set());open.get(a).add(pair[a===pair[0]?1:0]);}continue;}
   const equivalent=(a,b)=>{const x=this.nodes[a],y=this.nodes[b];return x.rest.every((v,k)=>v===y.rest[k])&&ShortsBody.identicalFrame(x.influences,y.influences)&&ShortsBody.identicalFrame(x.axillaDelta,y.axillaDelta);};
   if(!equivalent(edges[0][0],edges[1][0])||!equivalent(edges[0][1],edges[1][1]))seams.push([...new Set(edges.flat())]);
  }
  for(const triangle of this.triangles)triangle.sideComponent=find(triangle.id);
  const members=new Map();for(const n of this.nodes)if(open.has(n.canonical)){if(!members.has(n.canonical))members.set(n.canonical,[]);members.get(n.canonical).push(n.index);}
  const seen=new Set(),components=[];for(const id of open.keys()){if(seen.has(id))continue;const stack=[id],ids=[];seen.add(id);while(stack.length){const a=stack.pop();ids.push(...members.get(a));for(const b of open.get(a))if(!seen.has(b)){seen.add(b);stack.push(b);}}components.push(ids);}
  this.sideGuards=[...components,...seams].map(ids=>({ids,min:[0,0,0],max:[0,0,0]}));this.sideGuardStamp=null;
 }
 featureNormal(hit,alpha=this.alpha){
  const tri=this.triangles[hit.triangleId],zeros=hit.barycentric.map((v,i)=>v<=1e-10?i:-1).filter(i=>i>=0),features=tri.signFeatures;if(features.length===3&&!zeros.length){const face=this.faceOrientation(tri,hit.normal,alpha);return {...face,kind:'face'};}
  let key,faces,kind;if(features.length===1||(features.length===3&&zeros.length>=2)){const id=features.length===1?features[0]:tri.canonical[hit.barycentric.indexOf(Math.max(...hit.barycentric))];key='v:'+id;faces=this.vertexFaces[id];kind='vertex';}else{const ids=(features.length===2?[...features]:tri.canonical.filter((_,i)=>i!==zeros[0])).sort((a,b)=>a-b);key='e:'+ids.join(':');faces=(this.edgeFaces.get(ids.join(':'))||[]).map(id=>[id,null]);kind='edge';}
  const stamp=this.poseVersion+':'+alpha,cached=this.featureNormals.get(key);if(cached?.stamp===stamp)return {normal:cached.normal,ambiguous:cached.ambiguous,kind};
  let ambiguous=!faces.length;const sum=[0,0,0];for(const [id,localCorner]of faces){const t=this.triangles[id],p=t.ids.map(i=>this.poseNode(i,alpha)),a=ShortsBody.sub(p[1],p[0]),b=ShortsBody.sub(p[2],p[0]),cross=ShortsBody.cross(a,b),length=Math.hypot(...cross);if(!(length>1e-14*this.scale*this.scale)){ambiguous=true;continue;}let weight=1;
   if(localCorner!==null){const u=ShortsBody.sub(p[(localCorner+1)%3],p[localCorner]),v=ShortsBody.sub(p[(localCorner+2)%3],p[localCorner]);weight=Math.atan2(Math.hypot(...ShortsBody.cross(u,v)),ShortsBody.dot(u,v));}
   const face=this.faceOrientation(t,cross.map(v=>v/length),alpha);ambiguous||=face.ambiguous;for(let k=0;k<3;k++)sum[k]+=face.normal[k]*weight;
  }
  const length=Math.hypot(...sum);if(!(length>1e-10))ambiguous=true;const normal=length>1e-10?sum.map(v=>v/length):this.outwardFaceNormal(tri,hit.normal,alpha);this.featureNormals.set(key,{stamp,normal,ambiguous});return {normal,kind,ambiguous};
 }
 deformSourceNormal(node,transforms,muscles){
  let point=r2AxillaPoint(node.rest,node.axillaDelta,muscles),normal=[...node.normal];if(node.axillaNormal){const weight=muscles[node.rest[0]<0?0:1]?.axillaWeight||0;normal=ShortsBody.mix(normal,node.axillaNormal,weight);const length=Math.hypot(...normal);normal=normal.map(v=>v/length);}
  const shoulderWeight=r2ShoulderLbsWeight(point,this.scale),musclePoint=r2MusclePoint(point,muscles);if(Math.hypot(...ShortsBody.sub(musclePoint,point))>=1e-10){const epsilon=.00002*this.scale,columns=[0,1,2].map(k=>{const lo=[...point],hi=[...point];lo[k]-=epsilon;hi[k]+=epsilon;return ShortsBody.sub(r2MusclePoint(hi,muscles),r2MusclePoint(lo,muscles)).map(v=>v/(2*epsilon));}),cofactors=[ShortsBody.cross(columns[1],columns[2]),ShortsBody.cross(columns[2],columns[0]),ShortsBody.cross(columns[0],columns[1])];normal=[0,1,2].map(k=>cofactors.reduce((sum,c,j)=>sum+c[k]*normal[j],0));const length=Math.hypot(...normal);normal=normal.map(v=>v/length);}
  const reference=transforms[node.influences[0][0]].q,q=[0,0,0,0];for(const [id,w]of node.influences){const r=transforms[id].q,sign=r.reduce((sum,v,k)=>sum+v*reference[k],0)<0?-1:1;for(let k=0;k<4;k++)q[k]+=r[k]*w*sign;}const length=Math.hypot(...q);let result=ShortsBody.rotate(q.map(v=>v/length),normal);
  if(shoulderWeight>0){const linear=[0,0,0];for(const [id,w]of node.influences){const n=ShortsBody.rotate(transforms[id].q,normal);for(let k=0;k<3;k++)linear[k]+=n[k]*w;}result=ShortsBody.mix(result,linear,shoulderWeight);}const norm=Math.hypot(...result);if(!(norm>1e-12))throw Error('Invalid deformed source outward normal');return result.map(v=>v/norm);
 }
 poseNormal(id,alpha=this.alpha){const node=this.nodes[id];if(node.normalPoseVersion!==this.poseVersion){node.previousNormal=node.normalPoseVersion===this.poseVersion-1?node.currentNormal:this.deformSourceNormal(node,this.previousTransforms,this.previousMuscles);node.currentNormal=this.stationary?node.previousNormal:this.deformSourceNormal(node,this.transforms,this.muscles);node.normalPoseVersion=this.poseVersion;node.normalAlpha=NaN;}if(node.normalAlpha!==alpha){const normal=ShortsBody.mix(node.previousNormal,node.currentNormal,alpha),length=Math.hypot(...normal);if(!(length>1e-12))throw Error('Ambiguous interpolated source outward normal');node.posedNormal=normal.map(v=>v/length);node.normalAlpha=alpha;}return node.posedNormal;}
 outwardFaceNormal(tri,normal,alpha){const hint=[0,0,0];for(const id of tri.ids){const n=this.poseNormal(id,alpha);for(let k=0;k<3;k++)hint[k]+=n[k];}return ShortsBody.dot(normal,hint)<0?normal.map(v=>-v):normal;}
 // Reversing a posed face to match its transported authored normal does not
 // restore a locally folded surface's inside/outside topology. Such a face,
 // including every edge/vertex contribution, needs independent side evidence.
 faceOrientation(tri,normal,alpha){const hint=[0,0,0];for(const id of tri.ids){const n=this.poseNormal(id,alpha);for(let k=0;k<3;k++)hint[k]+=n[k];}const dot=ShortsBody.dot(normal,hint),length=Math.hypot(...hint);return {normal:dot<0?normal.map(v=>-v):normal,ambiguous:!(length>1e-12)||dot/length<.2};}
 static lineBox(point,direction,box,pad=0){let lo=-Infinity,hi=Infinity;for(let k=0;k<3;k++){if(Math.abs(direction[k])<1e-15){if(point[k]<box.min[k]-pad||point[k]>box.max[k]+pad)return false;}else{let a=(box.min[k]-pad-point[k])/direction[k],b=(box.max[k]+pad-point[k])/direction[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return false;}}return true;}
 paritySide(point,alpha=this.alpha){
  const stamp=this.poseVersion+':'+alpha,epsilon=1e-10*this.scale;
  if(this.sideGuardStamp!==stamp){for(const guard of this.sideGuards){guard.min.fill(Infinity);guard.max.fill(-Infinity);for(const id of guard.ids){const p=this.poseNode(id,alpha);for(let k=0;k<3;k++){guard.min[k]=Math.min(guard.min[k],p[k]);guard.max[k]=Math.max(guard.max[k],p[k]);}}}this.sideGuardStamp=stamp;}
  const directions=[[1,0,0],[0,0,1],[Math.SQRT1_2,0,Math.SQRT1_2],[Math.SQRT1_2,0,-Math.SQRT1_2]],evidence=[];let agreed=null,valid=0;
  for(const direction of directions){
   if(this.sideGuards.some(guard=>ShortsBody.lineBox(point,direction,guard,epsilon))){evidence.push({reason:'open-or-numerical-seam-guard'});continue;}
   const stack=[this.tree],crossings=[];let uncertain=false;
   while(stack.length&&!uncertain){const node=stack.pop();if(!ShortsBody.lineBox(point,direction,node,epsilon))continue;if(node.blocks){for(const id of node.blocks){const block=this.blocks[id];if(ShortsBody.lineBox(point,direction,block,epsilon)){this.prepareBlock(block);stack.push(block.tree);}}}else if(node.ids){for(const id of node.ids){const tri=this.triangles[id],a=this.nodes[tri.ids[0]].point,b=this.nodes[tri.ids[1]].point,c=this.nodes[tri.ids[2]].point,box={min:[0,1,2].map(k=>Math.min(a[k],b[k],c[k])),max:[0,1,2].map(k=>Math.max(a[k],b[k],c[k]))};if(!ShortsBody.lineBox(point,direction,box,epsilon))continue;
     const u=ShortsBody.sub(b,a),v=ShortsBody.sub(c,a),n=ShortsBody.cross(u,v),area=Math.hypot(...n),h=ShortsBody.cross(direction,v),det=ShortsBody.dot(u,h),s=ShortsBody.sub(point,a);
     if(!(area>1e-14*this.scale*this.scale)){uncertain=true;break;}
     if(Math.abs(det)<=area*1e-12){if(Math.abs(ShortsBody.dot(s,n))<=epsilon*area){uncertain=true;break;}continue;}
     const bu=ShortsBody.dot(s,h)/det,q=ShortsBody.cross(s,u),bv=ShortsBody.dot(direction,q)/det;if(bu<-1e-10||bv<-1e-10||bu+bv>1+1e-10)continue;
     const t=ShortsBody.dot(v,q)/det;if(Math.min(bu,bv,1-bu-bv)<=1e-10||Math.abs(t)<=epsilon||tri.signFeatures.length<3){uncertain=true;break;}crossings.push({t,component:tri.sideComponent});
    }}else stack.push(node.left,node.right);}
   if(uncertain){evidence.push({reason:'edge-tangent-degenerate-or-near-surface-hit'});continue;}
   crossings.sort((a,b)=>a.t-b.t);if(crossings.some((row,i)=>i&&row.t-crossings[i-1].t<=epsilon)){evidence.push({reason:'coincident-crossings'});continue;}
   const components=new Map();for(const row of crossings){if(!components.has(row.component))components.set(row.component,[0,0]);components.get(row.component)[row.t<0?0:1]++;}
   if([...components.values()].some(([a,b])=>a%2!==b%2)){evidence.push({reason:'inconsistent-half-lines'});continue;}
   const interiors=[...components].filter(([,counts])=>counts[0]%2).map(([id])=>id);if(interiors.length>1){evidence.push({reason:'overlapping-or-nested-components'});continue;}
   const negative=crossings.filter(row=>row.t<0).length,positive=crossings.length-negative,inside=interiors.length===1,component=inside?interiors[0]:-1;evidence.push({inside,negative,positive});if(agreed!==null&&agreed!==component)return {certain:false,reason:'directions-disagree',evidence};agreed=component;valid++;
  }
  return {certain:valid>=2,inside:valid>=2?agreed!==-1:null,reason:valid>=2?'guarded-multiple-lines':'insufficient-unambiguous-lines',evidence};
 }
 signedHit(point,hit,alpha=this.alpha){
  const {normal:pseudo,kind,ambiguous}=this.featureNormal(hit,alpha),delta=ShortsBody.sub(point,hit.point),distance=Math.sqrt(hit.distance2),dot=ShortsBody.dot(delta,pseudo),side=ambiguous?this.paritySide(point,alpha):null,sideUncertain=!!side&&!side.certain,sign=side?(side.certain&&side.inside?-1:1):(dot<0?-1:1);
  // The pseudonormal classifies the side. Projection uses the actual nearest
  // feature distance/direction, not a tangential component of one incident face.
  return {...hit,distance,signedDistance:sign*distance,normal:distance>1e-14*this.scale?delta.map(v=>v*sign/distance):pseudo,featureNormal:[...pseudo],closestFeature:kind,sideUncertain,sideMethod:side?'guarded-actual-triangle-line-parity':'source-oriented-feature-normal',...(side?{sideEvidence:side}:{} )};
 }
 update(){
  const h=this.human,transforms=h.joints.map(j=>{const source=h.sourceBind.get(j.id),inv=[-source.q[0],-source.q[1],-source.q[2],source.q[3]],raw=ShortsBody.quaternion(j.world.q,inv),l=Math.hypot(...raw),q=raw.map(v=>v/l),p=ShortsBody.rotate(q,source.p),t=j.world.p.map((v,k)=>v-p[k]);return {q,d:ShortsBody.quaternion([...t,0],q).map(v=>v*.5)};});
  if(transforms.some(t=>t.q.some(v=>!Number.isFinite(v))||t.d.some(v=>!Number.isFinite(v))))throw Error('Non-finite committed body surface');
  const muscles=r2MuscleFrames(h),unchanged=!!this.transforms&&ShortsBody.identicalFrame(this.transforms,transforms)&&ShortsBody.identicalFrame(this.muscles,muscles);
  // Identical consecutive committed frames have one surface for every alpha.
  // Keep the geometry version/certificates only if the previous interval was
  // already stationary; the first held frame after motion must collapse it.
  if(unchanged&&this.stationary){this.updates++;this.sample(1);return this;}
  this.stationary=!this.transforms||unchanged;this.previousTransforms=this.transforms||transforms;this.previousMuscles=this.muscles||muscles;this.transforms=transforms;this.muscles=muscles;this.poseVersion=(this.poseVersion||0)+1;
  for(const block of this.blocks){const bound=unchanged?block.bound:this.blockPoseBound(block,transforms,muscles);block.previousBound=block.bound||bound;block.bound=bound;block.exactStamp=null;}
  this.alpha=NaN;this.updates++;this.sample(1);return this;
 }
 sample(alpha=1){if(!Number.isFinite(alpha)||alpha<0||alpha>1)throw Error('Body interpolation must be in [0,1]');if(this.stationary)alpha=1;if(alpha!==this.alpha){this.alpha=alpha;for(const block of this.blocks){block.min=ShortsBody.mix(block.previousBound.min,block.bound.min,alpha);block.max=ShortsBody.mix(block.previousBound.max,block.bound.max,alpha);}this.refitBlocks(this.tree);}return this;}
 prepareAcceleration(){
  // Broadphase blocks preserve every source triangle. Their conservative pose
  // spheres only defer DQS work; final queries still use the actual triangles.
  const bindings=new Map();for(const node of this.nodes){const key=node.influences.map(([id,w])=>id+':'+w).join('|');let group=bindings.get(key);if(!group){group={influences:node.influences,nodeCount:0,current:null,previous:null};bindings.set(key,group);}group.nodeCount++;node.sharedBinding=group;}this.sharedBindingCount=bindings.size;
  const groups=new Map(),cell=.018*this.scale;
  for(const tri of this.triangles){const p=tri.ids.map(i=>this.nodes[i].rest),c=p[0].map((v,k)=>(v+p[1][k]+p[2][k])/3),key=c.map(v=>Math.floor(v/cell)).join(':');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(tri.id);}
  this.blocks=[...groups.values()].map(ids=>{const nodeIds=[...new Set(ids.flatMap(i=>this.triangles[i].ids))],points=nodeIds.map(i=>this.nodes[i].rest),min=[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))),max=[0,1,2].map(k=>Math.max(...points.map(p=>p[k]))),c=min.map((v,k)=>(v+max[k])/2),rep=nodeIds.reduce((best,i)=>Math.hypot(...ShortsBody.sub(this.nodes[i].rest,c))<Math.hypot(...ShortsBody.sub(this.nodes[best].rest,c))?i:best,nodeIds[0]),influences=this.nodes[rep].influences,normalise=a=>{const sum=a.reduce((n,r)=>n+r[1],0);return new Map(a.map(([id,w])=>[id,w/sum]));},base=normalise(influences),joints=[...new Set(nodeIds.flatMap(i=>this.nodes[i].influences.map(r=>r[0])))];let weightDifference=0;
   for(const i of nodeIds){const weights=normalise(this.nodes[i].influences);weightDifference=Math.max(weightDifference,joints.reduce((sum,j)=>sum+Math.abs((weights.get(j)||0)-(base.get(j)||0)),0));}
   return {ids,nodeIds,c,influences,joints,weightDifference,restExtent:max.map((v,k)=>(v-min[k])/2),restRadius:Math.max(...points.map(p=>Math.hypot(...ShortsBody.sub(p,c)))),min,max,tree:this.buildTree(ids.slice()),exactStamp:null};
  });
  const build=ids=>{const node={min:[0,0,0],max:[0,0,0]};if(ids.length<=4){node.blocks=ids;return node;}const min=[0,1,2].map(k=>Math.min(...ids.map(i=>this.blocks[i].min[k]))),max=[0,1,2].map(k=>Math.max(...ids.map(i=>this.blocks[i].max[k]))),axis=max.map((v,k)=>v-min[k]).indexOf(Math.max(...max.map((v,k)=>v-min[k])));ids.sort((a,b)=>this.blocks[a].c[axis]-this.blocks[b].c[axis]);const half=ids.length>>1;node.left=build(ids.slice(0,half));node.right=build(ids.slice(half));return node;};
  this.tree=build(this.blocks.map((_,i)=>i));this.sourceReport.acceleration={method:'conservative-DQS-block-bounds-with-lazy-exact-triangles',blocks:this.blocks.length,cellSizeM:cell,discardedSourceTriangles:0,collisionApproximationM:0};
 }
 blockPoseBound(block,transforms,muscles){
  // All weights are nonnegative. In a common quaternion hemisphere their
  // normalized blend has norm >= min cosine. The bound below is the triangle
  // inequality for T=2*d*conjugate(q)/|q|^2 in a frame centred on this block.
  const qref=transforms[block.influences[0][0]].q,inv=[-qref[0],-qref[1],-qref[2],qref[3]],refPoint=r2DeformPoint(block.c,[[block.influences[0][0],1]],transforms);let cosine=1,maxQ=0,maxD=0,unsafe=false;
  for(const id of block.joints){const q=transforms[id].q,dot=q.reduce((n,v,k)=>n+v*qref[k],0);cosine=Math.min(cosine,Math.abs(dot));const rel=ShortsBody.quaternion(inv,dot<0?q.map(v=>-v):q);maxQ=Math.max(maxQ,Math.hypot(rel[0],rel[1],rel[2],rel[3]-1));maxD=Math.max(maxD,Math.hypot(...ShortsBody.sub(r2DeformPoint(block.c,[[id,1]],transforms),refPoint)));for(const other of block.joints)if(transforms[other].q.reduce((n,v,k)=>n+v*q[k],0)<0)unsafe=true;}
  if(block.tissueFree===undefined){block.tissueFree=block.nodeIds.every(i=>{const v=this.nodes[i],p=v.rest;if(v.axillaDelta?.some(x=>x!==0)||r2ShoulderLbsWeight(p,this.scale)!==0)return false;return muscles.every(f=>{const delta=ShortsBody.sub(p,f.origin),along=ShortsBody.dot(delta,f.axis),radial=delta.map((x,k)=>x-f.axis[k]*along),capY=p[1]-f.origin[1];return (capY<=-.18*f.length||capY>=.36*f.length)&&(Math.hypot(...delta)>f.length*1.12||Math.hypot(...radial)>=f.length*.36);});});if(block.tissueFree)for(const id of block.nodeIds)this.nodes[id].tissueFree=true;}const tissueFree=block.tissueFree;
  if(unsafe||cosine<.1||!tissueFree){const points=block.nodeIds.map(i=>{const v=this.nodes[i];return r2DeformTissuePoint(v.rest,v.influences,transforms,muscles,this.scale,v.axillaDelta);});return {min:[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))-1e-9*this.scale),max:[0,1,2].map(k=>Math.max(...points.map(p=>p[k]))+1e-9*this.scale),eagerFallback:true};}
  const dw=block.weightDifference,error=dw*maxD/cosine+3*maxD*dw*maxQ/(cosine*cosine)+4*dw*maxQ/cosine*block.restRadius+1e-9*this.scale,c=r2DeformPoint(block.c,block.influences,transforms),r=[0,0,0,0];
  for(const [id,w]of block.influences){const q=transforms[id].q,sign=q.reduce((n,v,k)=>n+v*qref[k],0)<0?-1:1;for(let k=0;k<4;k++)r[k]+=q[k]*w*sign;}const length=Math.hypot(...r),[x,y,z,w]=r.map(v=>v/length),e=block.restExtent,m=[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)],extent=[0,1,2].map(i=>Math.abs(m[3*i])*e[0]+Math.abs(m[3*i+1])*e[1]+Math.abs(m[3*i+2])*e[2]+error);
  return {min:c.map((v,k)=>v-extent[k]),max:c.map((v,k)=>v+extent[k])};
 }
 refitBlocks(node){node.min.fill(Infinity);node.max.fill(-Infinity);if(node.blocks){for(const id of node.blocks){const b=this.blocks[id];for(let k=0;k<3;k++){node.min[k]=Math.min(node.min[k],b.min[k]);node.max[k]=Math.max(node.max[k],b.max[k]);}}}else{this.refitBlocks(node.left);this.refitBlocks(node.right);for(let k=0;k<3;k++){node.min[k]=Math.min(node.left.min[k],node.right.min[k]);node.max[k]=Math.max(node.left.max[k],node.right.max[k]);}}}
 sharedBindingTransform(group,transforms){
  if(group.current?.transforms===transforms)return group.current;if(group.previous?.transforms===transforms)return group.previous;
  // Exactly the scalar accumulation/normalization order in r2DeformPoint.
  // Only repeated evaluations of identical ordered weights are removed.
  let x=0,y=0,z=0,w=0,dx=0,dy=0,dz=0,dw=0;const reference=transforms[group.influences[0][0]].q;
  for(let k=0;k<group.influences.length;k++){const row=group.influences[k],t=transforms[row[0]],q=t.q,d=t.d,weight=row[1]*(reference[0]*q[0]+reference[1]*q[1]+reference[2]*q[2]+reference[3]*q[3]<0?-1:1);x+=q[0]*weight;y+=q[1]*weight;z+=q[2]*weight;w+=q[3]*weight;dx+=d[0]*weight;dy+=d[1]*weight;dz+=d[2]*weight;dw+=d[3]*weight;}
  const scale=1/Math.hypot(x,y,z,w);x*=scale;y*=scale;z*=scale;w*=scale;dx*=scale;dy*=scale;dz*=scale;dw*=scale;const parallel=x*dx+y*dy+z*dz+w*dw;dx-=x*parallel;dy-=y*parallel;dz-=z*parallel;dw-=w*parallel;
  const result={transforms,x,y,z,w,tx:2*(w*dx-dw*x+y*dz-z*dy),ty:2*(w*dy-dw*y+z*dx-x*dz),tz:2*(w*dz-dw*z+x*dy-y*dx)};group.previous=group.current;group.current=result;return result;
 }
 deformSkinPoint(v,transforms,muscles){
  if(!v.tissueFree||v.sharedBinding.nodeCount<2)return r2DeformTissuePoint(v.rest,v.influences,transforms,muscles,this.scale,v.axillaDelta);
  const q=this.sharedBindingTransform(v.sharedBinding,transforms),p=v.rest,px=p[0],py=p[1],pz=p[2],tx=2*(q.y*pz-q.z*py),ty=2*(q.z*px-q.x*pz),tz=2*(q.x*py-q.y*px);
  return [px+q.w*tx+q.y*tz-q.z*ty+q.tx,py+q.w*ty+q.z*tx-q.x*tz+q.ty,pz+q.w*tz+q.x*ty-q.y*tx+q.tz];
 }
 poseNode(id,alpha=this.alpha){const v=this.nodes[id];if(v.poseVersion!==this.poseVersion){v.previous=v.poseVersion===this.poseVersion-1?v.current:this.deformSkinPoint(v,this.previousTransforms,this.previousMuscles);v.current=this.stationary?v.previous:this.deformSkinPoint(v,this.transforms,this.muscles);v.poseVersion=this.poseVersion;v.alpha=NaN;}if(alpha!==this.alpha)return ShortsBody.mix(v.previous,v.current,alpha);if(v.alpha!==alpha){v.point=ShortsBody.mix(v.previous,v.current,alpha);v.alpha=alpha;}return v.point;}
 prepareBlock(block){const stamp=this.poseVersion+':'+this.alpha;if(block.exactStamp!==stamp){for(const id of block.nodeIds)this.poseNode(id);this.refit(block.tree);block.exactStamp=stamp;}}
 buildTree(ids){
  const node={min:[0,0,0],max:[0,0,0]};if(ids.length<=8){node.ids=ids;return node;}
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const id of ids)for(const i of this.triangles[id].ids)for(let k=0;k<3;k++){const v=this.nodes[i].rest[k];min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);}
  const axis=max.map((v,k)=>v-min[k]).indexOf(Math.max(...max.map((v,k)=>v-min[k]))),centre=id=>this.triangles[id].ids.reduce((sum,i)=>sum+this.nodes[i].rest[axis],0);
  ids.sort((a,b)=>centre(a)-centre(b));const half=ids.length>>1;node.left=this.buildTree(ids.slice(0,half));node.right=this.buildTree(ids.slice(half));return node;
 }
 refit(node){node.min.fill(Infinity);node.max.fill(-Infinity);if(node.ids){for(const id of node.ids)for(const i of this.triangles[id].ids)for(let k=0;k<3;k++){const v=this.nodes[i].point[k];node.min[k]=Math.min(node.min[k],v);node.max[k]=Math.max(node.max[k],v);}}else{this.refit(node.left);this.refit(node.right);for(let k=0;k<3;k++){node.min[k]=Math.min(node.left.min[k],node.right.min[k]);node.max[k]=Math.max(node.left.max[k],node.right.max[k]);}}}
 static closestTriangle(p,a,b,c,limit=Infinity){
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],ax=p[0]-a[0],ay=p[1]-a[1],az=p[2]-a[2],d1=ux*ax+uy*ay+uz*az,d2=vx*ax+vy*ay+vz*az;let u=1,v=0,w=0;
  if(!(d1<=0&&d2<=0)){
   const bx=p[0]-b[0],by=p[1]-b[1],bz=p[2]-b[2],d3=ux*bx+uy*by+uz*bz,d4=vx*bx+vy*by+vz*bz;
   if(d3>=0&&d4<=d3){u=0;v=1;}else{const vc=d1*d4-d3*d2;
    if(vc<=0&&d1>=0&&d3<=0){v=d1/(d1-d3);u=1-v;}else{
     const cx=p[0]-c[0],cy=p[1]-c[1],cz=p[2]-c[2],d5=ux*cx+uy*cy+uz*cz,d6=vx*cx+vy*cy+vz*cz;
     if(d6>=0&&d5<=d6){u=0;w=1;}else{const vb=d5*d2-d1*d6;
      if(vb<=0&&d2>=0&&d6<=0){w=d2/(d2-d6);u=1-w;}else{const va=d3*d6-d5*d4;
       if(va<=0&&d4-d3>=0&&d5-d6>=0){w=(d4-d3)/(d4-d3+d5-d6);u=0;v=1-w;}else{const den=1/(va+vb+vc);v=vb*den;w=vc*den;u=1-v-w;}
      }
     }
    }
   }
  }
  const x=a[0]*u+b[0]*v+c[0]*w,y=a[1]*u+b[1]*v+c[1]*w,z=a[2]*u+b[2]*v+c[2]*w,dx=p[0]-x,dy=p[1]-y,dz=p[2]-z,distance2=dx*dx+dy*dy+dz*dz;
  return distance2<limit?{point:[x,y,z],barycentric:[u,v,w],distance2}:null;
 }
 triangleHit(point,id,alpha=this.alpha){const tri=this.triangles[id];if(!tri)return null;const p=tri.ids.map(i=>this.poseNode(i,alpha)),hit=ShortsBody.closestTriangle(point,...p),n=ShortsBody.cross(ShortsBody.sub(p[1],p[0]),ShortsBody.sub(p[2],p[0])),length=Math.hypot(...n);if(!hit||!(length>1e-14*this.scale*this.scale))return null;return {...hit,triangleId:id,normal:n.map(v=>v/length)};}
 closest(point,alpha=1,constraint=null){
  if(point.length!==3||point.some(v=>!Number.isFinite(v)))throw Error('Invalid cloth query point');this.sample(alpha);alpha=this.alpha;
  let best=constraint?this.triangleHit(point,constraint.triangleId,alpha):null,best2=best?.distance2??Infinity;
  const local=best&&constraint.poseVersion===this.poseVersion&&constraint.alpha===alpha&&Math.hypot(...ShortsBody.sub(point,constraint.origin))+Math.sqrt(best2)<constraint.radius;
  const distance=node=>{let d=0;for(let k=0;k<3;k++){const gap=Math.max(node.min[k]-point[k],0,point[k]-node.max[k]);d+=gap*gap;}return d;},stack=local?[{blocks:constraint.blocks,min:this.tree.min,max:this.tree.max}]:[this.tree];
  while(stack.length){const node=stack.pop();if(distance(node)>best2)continue;if(node.blocks){for(const id of node.blocks){const block=this.blocks[id];if(distance(block)>best2)continue;this.prepareBlock(block);stack.push(block.tree);}}else if(node.ids){for(const id of node.ids){const tri=this.triangles[id],a=this.nodes[tri.ids[0]].point,b=this.nodes[tri.ids[1]].point,c=this.nodes[tri.ids[2]].point,hit=ShortsBody.closestTriangle(point,a,b,c,best2);if(hit){const cross=ShortsBody.cross(ShortsBody.sub(b,a),ShortsBody.sub(c,a)),length=Math.hypot(...cross);if(!(length>1e-14*this.scale*this.scale))continue;best2=hit.distance2;best={...hit,triangleId:id,normal:cross.map(v=>v/length)};}}}else{if(distance(node.left)<distance(node.right))stack.push(node.right,node.left);else stack.push(node.left,node.right);}}
  if(!best)throw Error('No non-degenerate current body triangle');return {...this.signedHit(point,best,alpha),localCertificateUsed:!!local};
 }
 makeContactConstraint(point,hit,alpha){alpha=this.alpha;const radius=hit.distance+.006*this.scale,r2=radius*radius,blocks=[],stack=[this.tree],distance=node=>{let d=0;for(let k=0;k<3;k++){const gap=Math.max(node.min[k]-point[k],0,point[k]-node.max[k]);d+=gap*gap;}return d;};while(stack.length){const node=stack.pop();if(distance(node)>r2)continue;if(node.blocks){for(const id of node.blocks)if(distance(this.blocks[id])<=r2)blocks.push(id);}else stack.push(node.left,node.right);}return {triangleId:hit.triangleId,origin:[...point],radius,blocks,poseVersion:this.poseVersion,alpha};}
 contactConstraint(point,alpha=1){const hit=this.closest(point,alpha);return {...hit,constraint:this.makeContactConstraint(point,hit,alpha)};}
 projectConstraint(point,constraint,clearanceM=0,alpha=1){if(!Number.isFinite(clearanceM)||clearanceM<0)throw Error('Invalid body clearance');const hit=this.closest(point,alpha,constraint),next=hit.localCertificateUsed?constraint:this.makeContactConstraint(point,hit,alpha),depth=hit.sideUncertain?0:Math.max(0,clearanceM-hit.signedDistance);next.triangleId=hit.triangleId;if(depth>0)for(let k=0;k<3;k++)point[k]+=hit.normal[k]*depth;return {...hit,depth,penetration:depth,corrected:depth>0,constraint:next};}
 project(point,clearanceM=0,alpha=1){const hit=this.projectConstraint(point,this.contactHints.get(point),clearanceM,alpha);this.contactHints.set(point,hit.constraint);return hit;}
 projectTriangle(point,triangleId,clearanceM=0,alpha=1){if(!Number.isFinite(clearanceM)||clearanceM<0)throw Error('Invalid body clearance');this.sample(alpha);alpha=this.alpha;const raw=this.triangleHit(point,triangleId,alpha);if(!raw)throw Error('Invalid local body triangle');const hit=this.signedHit(point,raw,alpha),depth=hit.sideUncertain?0:Math.max(0,clearanceM-hit.signedDistance);if(depth)for(let k=0;k<3;k++)point[k]+=hit.normal[k]*depth;return {...hit,depth,localOnly:true};}
 projectPoint(current,previous,radius,alpha=1){return this.project(current,radius,alpha);}
 createWaistAttachment(restPoint){
  if(Math.abs(restPoint[1]-this.waistY)>this.bandHeight+.005*this.scale)throw Error('Body attachments are limited to the narrow waistband');
  let best=null;for(const tri of this.triangles){const p=tri.ids.map(i=>this.nodes[i].rest),hit=ShortsBody.closestTriangle(restPoint,...p);if(!best||hit.distance2<best.distance2)best={...hit,triangleId:tri.id};}
  if(Math.sqrt(best.distance2)>.03*this.scale)throw Error('Waist attachment is not on the actual waist surface');return {triangleId:best.triangleId,barycentric:[...best.barycentric],source:'actual-skin-triangle',restPoint:[...best.point]};
 }
 attachmentPosition(anchor,clearanceM=0,alpha=1){
  if(!Number.isFinite(alpha)||alpha<0||alpha>1||!Number.isFinite(clearanceM)||clearanceM<0)throw Error('Invalid waist attachment query');
  const tri=this.triangles[anchor.triangleId];if(!tri||anchor.barycentric?.length!==3)throw Error('Invalid waist triangle anchor');
  const p=tri.ids.map(i=>this.poseNode(i,alpha)),n=ShortsBody.cross(ShortsBody.sub(p[1],p[0]),ShortsBody.sub(p[2],p[0])),length=Math.hypot(...n);if(!(length>1e-14))throw Error('Degenerate waist triangle');
  return p[0].map((v,k)=>v*anchor.barycentric[0]+p[1][k]*anchor.barycentric[1]+p[2][k]*anchor.barycentric[2]+clearanceM*n[k]/length);
 }
 // Intersect source triangles, weld only numerical coincidences, then trace real edges.
 section(axis,value,ceiling=Infinity){
  const tolerance=2e-7*this.scale,vertices=[],lookup=new Map(),edges=[],seen=new Set();
  const vertex=p=>{const key=p.map(v=>Math.round(v/tolerance)).join(',');if(lookup.has(key))return lookup.get(key);const i=vertices.length;lookup.set(key,i);vertices.push({point:p,links:[]});return i;};
  for(const tri of this.triangles){const ps=tri.ids.map(i=>this.nodes[i].rest),hits=[];
   for(let k=0;k<3;k++){const a=ps[k],b=ps[(k+1)%3],da=a[axis]-value,db=b[axis]-value;if(da===0)hits.push([...a]);if(da*db<0)hits.push(ShortsBody.mix(a,b,da/(da-db)));}
   const unique=hits.filter((p,i)=>hits.slice(0,i).every(q=>Math.hypot(...ShortsBody.sub(p,q))>1e-10*this.scale));if(unique.length!==2)continue;let [a,b]=unique;
   if(a[1]>ceiling&&b[1]>ceiling)continue;if(a[1]>ceiling)a=ShortsBody.mix(a,b,(ceiling-a[1])/(b[1]-a[1]));if(b[1]>ceiling)b=ShortsBody.mix(b,a,(ceiling-b[1])/(a[1]-b[1]));
   const i=vertex(a),j=vertex(b),key=i<j?i+':'+j:j+':'+i;if(i===j||seen.has(key))continue;seen.add(key);const id=edges.length;edges.push([i,j]);vertices[i].links.push(id);vertices[j].links.push(id);
  }
  const used=new Set(),curves=[];
  for(let edge=0;edge<edges.length;edge++){if(used.has(edge))continue;const component=new Set(),todo=[edges[edge][0]];while(todo.length){const i=todo.pop();if(component.has(i))continue;component.add(i);for(const e of vertices[i].links)for(const n of edges[e])if(!component.has(n))todo.push(n);}
   const ends=[...component].filter(i=>vertices[i].links.length===1),start=ends[0]??edges[edge][0],points=[],ids=[];let at=start;
   while(true){points.push([...vertices[at].point]);ids.push(at);const next=vertices[at].links.find(i=>!used.has(i));if(next===undefined)break;used.add(next);at=edges[next][0]===at?edges[next][1]:edges[next][0];if(at===start){points.push([...vertices[at].point]);break;}}
   const closed=at===start&&points.length>3&&!ends.length&&[...component].every(i=>vertices[i].links.length===2),length=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(...ShortsBody.sub(p,points[i])),0);
   curves.push({points,length,closed,branched:[...component].some(i=>vertices[i].links.length>2)});
   // A malformed branch is diagnostic, never repaired by an invented silhouette.
   if([...component].some(i=>vertices[i].links.length>2))for(const i of component)for(const e of vertices[i].links)used.add(e);
  }
  return curves;
 }
 static bounds(curve){const p=curve.points;return {minX:Math.min(...p.map(v=>v[0])),maxX:Math.max(...p.map(v=>v[0])),minZ:Math.min(...p.map(v=>v[2])),maxZ:Math.max(...p.map(v=>v[2]))};}
 static tapeEnvelope(curve,axes=[0,2]){
  const sorted=curve.points.slice().sort((a,b)=>a[axes[0]]-b[axes[0]]||a[axes[1]]-b[axes[1]]),cross=(a,b,c)=>(b[axes[0]]-a[axes[0]])*(c[axes[1]]-a[axes[1]])-(b[axes[1]]-a[axes[1]])*(c[axes[0]]-a[axes[0]]),lower=[],upper=[];
  for(const p of sorted){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
  for(let i=sorted.length-1;i>=0;i--){const p=sorted[i];while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
  lower.pop();upper.pop();const points=[...lower,...upper];if(points.length<3)throw Error('Degenerate source tape section');points.push(points[0]);return {points,closed:true,length:points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(...ShortsBody.sub(p,points[i])),0)};
 }
 static arcs(curve,centerZ){let front=0,back=0;for(let i=1;i<curve.points.length;i++){const a=curve.points[i-1],b=curve.points[i],length=Math.hypot(...ShortsBody.sub(a,b));if(a[2]>=centerZ&&b[2]>=centerZ)front+=length;else if(a[2]<=centerZ&&b[2]<=centerZ)back+=length;else{const f=(centerZ-a[2])/(b[2]-a[2]);if(a[2]>centerZ){front+=length*f;back+=length*(1-f);}else{back+=length*f;front+=length*(1-f);}}}return {front,back};}
 measure(options={}){
  if(options.waistY!==undefined&&options.waistY!==this.waistY)throw Error('Set waistY before constructing ShortsBody');
  if(options.waistbandHeight!==undefined&&options.waistbandHeight!==this.bandHeight)throw Error('Set waistbandHeight before constructing ShortsBody');
  if(this.measurements)return this.measurements;const h=this.human,s=this.scale,hips=h.sourceBind.get('hips').p;
  const ringAt=y=>{const rings=this.section(1,y).filter(c=>c.closed&&!c.branched);if(!rings.length)throw Error('Actual skin section is not closed at y='+y);return rings.sort((a,b)=>b.length-a.length)[0];};
  const waist=ringAt(this.waistY),top=ringAt(this.waistY+this.bandHeight);
  const sagittal=this.section(0,hips[0]+3.17e-8*s,this.waistY).filter(c=>!c.branched&&c.points.length>2&&Math.abs(c.points[0][1]-this.waistY)<1e-5*s&&Math.abs(c.points.at(-1)[1]-this.waistY)<1e-5*s).sort((a,b)=>b.length-a.length)[0];
  if(!sagittal)throw Error('Actual central crotch skin section is not continuous');
  if(sagittal.points[0][2]<sagittal.points.at(-1)[2])sagittal.points.reverse();const ys=sagittal.points.map(p=>p[1]),crotchIndex=ys.indexOf(Math.min(...ys)),crotchY=ys[crotchIndex];
  let rawFrontRiseLength=0,rawBackRiseLength=0;for(let i=1;i<sagittal.points.length;i++){const length=Math.hypot(...ShortsBody.sub(sagittal.points[i],sagittal.points[i-1]));if(i<=crotchIndex)rawFrontRiseLength+=length;else rawBackRiseLength+=length;}
  // A real tensioned tape bridges concavities; following every skin groove is
  // not a tailoring circumference. Keep both measurements, never alter skin.
  const sagHull=ShortsBody.tapeEnvelope(sagittal,[2,1]).points.slice(0,-1),frontIndex=sagHull.findIndex(p=>Math.hypot(...ShortsBody.sub(p,sagittal.points[0]))<1e-8*s),backIndex=sagHull.findIndex(p=>Math.hypot(...ShortsBody.sub(p,sagittal.points.at(-1)))<1e-8*s);
  if(frontIndex<0||backIndex<0)throw Error('Waist endpoints are missing from the tape envelope');
  const route=direction=>{const p=[];let i=frontIndex;while(true){p.push(sagHull[i]);if(i===backIndex)break;i=(i+direction+sagHull.length)%sagHull.length;}return p;},aRoute=route(1),bRoute=route(-1),rise=Math.min(...aRoute.map(p=>p[1]))<Math.min(...bRoute.map(p=>p[1]))?aRoute:bRoute,riseSplit=rise.findIndex(p=>p[1]===Math.min(...rise.map(q=>q[1])));
  let frontRiseLength=0,backRiseLength=0;for(let i=1;i<rise.length;i++){const length=Math.hypot(...ShortsBody.sub(rise[i],rise[i-1]));if(i<=riseSplit)frontRiseLength+=length;else backRiseLength+=length;}
  let hip=null,hipTape=null,hipY=null;for(let i=0;i<17;i++){const y=crotchY+.015*s+(this.waistY-.045*s-crotchY)*i/16;const rings=this.section(1,y).filter(c=>c.closed&&!c.branched);for(const ring of rings){const b=ShortsBody.bounds(ring),tape=ShortsBody.tapeEnvelope(ring);if(b.minX<hips[0]&&b.maxX>hips[0]&&(!hip||tape.length>hipTape.length)){hip=ring;hipTape=tape;hipY=y;}}}
  if(!hip)throw Error('Actual hip circumference was not found');
  const thighY=crotchY-.045*s,thighs=this.section(1,thighY).filter(c=>c.closed&&!c.branched),left=thighs.filter(c=>ShortsBody.bounds(c).maxX<hips[0]).sort((a,b)=>b.length-a.length)[0],right=thighs.filter(c=>ShortsBody.bounds(c).minX>hips[0]).sort((a,b)=>b.length-a.length)[0];
  if(!left||!right)throw Error('Both actual thigh sections must remain distinct');
  const wa=ShortsBody.arcs(ShortsBody.tapeEnvelope(waist),hips[2]),ha=ShortsBody.arcs(hipTape,hips[2]),ta=ShortsBody.arcs(ShortsBody.tapeEnvelope(top),hips[2]);this.waistCurve=waist;this.waistTopCurve=top;this.sectorCache=new Map();
  this.measurements={unit:'m',waistFrontArc:wa.front,waistBackArc:wa.back,hipFrontArc:ha.front,hipBackArc:ha.back,waistTopFrontArc:ta.front,waistTopBackArc:ta.back,waistToHip:this.waistY-hipY,crotchDepth:this.waistY-crotchY,frontRiseLength,backRiseLength,thighCircumference:{left:left.length,right:right.length},waistCenter:[hips[0],this.waistY,hips[2]],metadata:{source:'actual generated skin triangle plane intersections',bodyShapeKey:JSON.stringify(h.characterPreset?.shape||{}),referencePose:'individual-source-bind',waistY:this.waistY,waistTopY:this.waistY+this.bandHeight,hipY,crotchY,thighY,waist:{...ShortsBody.bounds(waist),centerZ:hips[2]},hip:{...ShortsBody.bounds(hip),centerZ:hips[2]},thighCenters:Object.fromEntries([['left',left],['right',right]].map(([side,c])=>{const b=ShortsBody.bounds(c);return [side,{x:(b.minX+b.maxX)/2,z:(b.minZ+b.maxZ)/2}];})),closedSections:true,hipScanPlanes:17,sectionWeldToleranceM:2e-7*s}};
  this.measurements.metadata.measurementMethod='tensioned planar tape envelope of actual skin sections; separate lower sagittal route';
  this.measurements.metadata.rawSurfacePaths={waist:waist.length,waistTop:top.length,hip:hip.length,frontRiseLength:rawFrontRiseLength,backRiseLength:rawBackRiseLength};
  return this.measurements;
 }
 waistRestPoint(fraction){this.measure();if(!Number.isFinite(fraction))throw Error('Invalid waist fraction');const curve=this.waistCurve;let distance=((fraction%1)+1)%1*curve.length;for(let i=1;i<curve.points.length;i++){const a=curve.points[i-1],b=curve.points[i],length=Math.hypot(...ShortsBody.sub(a,b));if(distance<=length)return ShortsBody.mix(a,b,length?distance/length:0);distance-=length;}return [...curve.points[0]];}
 waistPoint(fraction,alpha=1){return this.attachmentPosition(this.createWaistAttachment(this.waistRestPoint(fraction)),0,alpha);}
 // A named sector has no arbitrary loop seam: centre front/back -> same-side side seam.
 waistRestSectorPoint(side,front,t,top=true){
  this.measure();if(!['left','right'].includes(side)||typeof front!=='boolean'||!Number.isFinite(t)||t<0||t>1)throw Error('Invalid named waist sector');
  const key=[side,front,top].join(':');let sector=this.sectorCache.get(key);
  if(!sector){const curve=top?this.waistTopCurve:this.waistCurve,centre=this.measurements.waistCenter,segments=[];
   for(let i=1;i<curve.points.length;i++){let a=[...curve.points[i-1]],b=[...curve.points[i]],valid=true;
    for(const [axis,sign]of [[0,side==='left'?-1:1],[2,front?1:-1]]){let da=(a[axis]-centre[axis])*sign,db=(b[axis]-centre[axis])*sign;if(da<0&&db<0){valid=false;break;}if(da<0)a=ShortsBody.mix(a,b,da/(da-db));else if(db<0)b=ShortsBody.mix(a,b,da/(da-db));}
    if(valid&&Math.hypot(...ShortsBody.sub(a,b))>1e-10*this.scale)segments.push([a,b]);
   }
   if(!segments.length)throw Error('Missing actual waist sector');let start=segments.flat().reduce((best,p)=>Math.abs(p[0]-centre[0])<Math.abs(best[0]-centre[0])?p:best),points=[[...start]],length=0;
   while(segments.length){const i=segments.findIndex(pair=>pair.some(p=>Math.hypot(...ShortsBody.sub(p,start))<1e-9*this.scale));if(i<0)throw Error('Actual waist sector is disconnected');const pair=segments.splice(i,1)[0],next=Math.hypot(...ShortsBody.sub(pair[0],start))<1e-9*this.scale?pair[1]:pair[0];length+=Math.hypot(...ShortsBody.sub(next,start));points.push([...next]);start=next;}
   sector={points,length};this.sectorCache.set(key,sector);
  }
  let distance=t*sector.length;for(let i=1;i<sector.points.length;i++){const a=sector.points[i-1],b=sector.points[i],length=Math.hypot(...ShortsBody.sub(a,b));if(distance<=length)return ShortsBody.mix(a,b,length?distance/length:0);distance-=length;}return [...sector.points.at(-1)];
 }
 createWaistAttachmentFromSector(side,front,t,{top=true}={}){return this.createWaistAttachment(this.waistRestSectorPoint(side,front,t,top));}
 report(){return {...this.sourceReport,updates:this.updates,interpolationAlpha:this.alpha,stationaryFrames:this.stationary,measurements:this.measurements,collisionMethod:'oriented-current-skin-triangle-BVH',attachmentDomain:'waistband-only',visualAcceptance:false};}
}
