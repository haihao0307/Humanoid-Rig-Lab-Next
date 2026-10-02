import * as THREE from 'three';

// These are R008 intake part identities, not a claim that cloth is bare skin.
export const R008_SOURCE_SHORTS_PARTS = Object.freeze([9, 10, 19]);
const LOWER_BODY_PARTS = [9,10,19,15,1,18,0,17,12,26,13,16];
const SECTION_PARTS = new Set([9,10,19,15,1,18,12,26]);
const V = () => new THREE.Vector3();
const point = (a,i,v=V()) => v.fromArray(a,i*3);
const bounds = () => ({min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
function extend(b,a) { for(let k=0;k<3;k++){b.min[k]=Math.min(b.min[k],a[k]);b.max[k]=Math.max(b.max[k],a[k]);} }

/** Live, eight-influence, exact generated-triangle envelope. Call update AFTER
 * the animator's final IK/finishPose. Never advances or resets the source clock.
 * Its shorts area is the existing clothing envelope: R008 has no hidden skin.
 */
export function createShortsBodyAdapter(subject, actor=subject.root.parent, options={}) {
 if(subject.data.schema!=='parametric-human-uv-fields/v2'||subject.surface.influences!==8)throw Error('R008 eight-influence generated subject required');
 const mesh=subject.mesh,geometry=mesh.geometry,surface=subject.surface,n=geometry.attributes.position.count;
 const selected=new Set(options.parts||LOWER_BODY_PARTS),charts=new Map(subject.data.charts.map(c=>[c.id,c.part]));
 const parts=surface.chartIds.map(id=>charts.get(id)),indices=geometry.index.array;
 for(const id of R008_SOURCE_SHORTS_PARTS)if(subject.data.materials[id]?.name!==({9:'tripo_part_2',10:'tripo_part_9',19:'tripo_part_1'})[id])throw Error('R008 source part identities changed; reassess cloth/skin classification');
 const vertexIds=[],triangles=[];
 for(let i=0;i<n;i++)if(selected.has(parts[i]))vertexIds.push(i);
 for(let i=0;i<indices.length;i+=3)if(selected.has(parts[indices[i]]))triangles.push({id:i/3,indices:[indices[i],indices[i+1],indices[i+2]],part:parts[indices[i]],box:bounds()});
 const triangleById=new Map(triangles.map(t=>[t.id,t])),vertexFaces=new Map();
 for(const t of triangles)for(const i of t.indices){if(!vertexFaces.has(i))vertexFaces.set(i,[]);vertexFaces.get(i).push(t);}
 const featureNormalCache=new Map();
 const positions=new Float64Array(n*3),previous=new Float64Array(n*3),local=new Float64Array(n*3),normals=new Float64Array(n*3);
 const boneMatrices=subject.skeleton.bones.map(()=>new THREE.Matrix4()),previousBones=boneMatrices.map(()=>new THREE.Matrix4()),finalMatrix=new THREE.Matrix4(),previousFinal=new THREE.Matrix4(),frame=new THREE.Matrix4(),frameInverse=new THREE.Matrix4();
 const vertexRevision=new Uint32Array(n),previousVertexRevision=new Uint32Array(n),referencePositions=new Float32Array(geometry.attributes.position.array);
 let revision=0,lastTime=null,previousTime=null,poseDeltaTime=null,bvh=null,measurements=null,maxMoveM=0,materializedRevision=-1,previousMaterializedRevision=-1,positionVersion=geometry.attributes.position.version,maxWeightError=0,boundsMode='conservative-lazy';
 for(const i of vertexIds){let w=0;for(let k=0;k<8;k++)w+=surface.skinWeight[i*8+k];maxWeightError=Math.max(maxWeightError,Math.abs(w-1));}
 const p=V(),q=V(),out=V(),nn=V(),worldPos=V(),worldQ=new THREE.Quaternion(),worldScale=V(),unit=V().set(1,1,1);
 function owner(){if(subject.mesh!==mesh||mesh.geometry!==geometry||surface!==subject.surface)throw Error('Generated subject rebuilt: recreate ShortsBodyAdapter');}
 function frameUpdate(){const owner=actor||subject.root;owner.updateWorldMatrix(true,false);owner.updateMatrixWorld(true);owner.matrixWorld.decompose(worldPos,worldQ,worldScale);frame.compose(worldPos,worldQ,unit);frameInverse.copy(frame).invert();}
 function palette(){mesh.updateWorldMatrix(true,false);subject.skeleton.update();for(let b=0;b<boneMatrices.length;b++)boneMatrices[b].multiplyMatrices(subject.skeleton.bones[b].matrixWorld,subject.skeleton.boneInverses[b]);finalMatrix.multiplyMatrices(mesh.matrixWorld,mesh.bindMatrixInverse);}
 function skin(i,needNormal=true,old=false){
  // Same affine arithmetic/order as the source override, without allocating
  // Vector3 clones per influence. Eight contributions remain authoritative.
  const at=i*3,pa=geometry.attributes.position.array,bind=mesh.bindMatrix.elements,x0=pa[at],y0=pa[at+1],z0=pa[at+2],bw=1/(bind[3]*x0+bind[7]*y0+bind[11]*z0+bind[15]),x=(bind[0]*x0+bind[4]*y0+bind[8]*z0+bind[12])*bw,y=(bind[1]*x0+bind[5]*y0+bind[9]*z0+bind[13])*bw,z=(bind[2]*x0+bind[6]*y0+bind[10]*z0+bind[14])*bw;
  const na=geometry.attributes.normal?.array,nx=na?.[at]||0,ny=na?.[at+1]||0,nz=na?.[at+2]||0;let sx=0,sy=0,sz=0,snx=0,sny=0,snz=0;
  for(let k=0;k<8;k++){const w=surface.skinWeight[i*8+k];if(!w)continue;const e=(old?previousBones:boneMatrices)[surface.skinIndex[i*8+k]].elements,vw=1/(e[3]*x+e[7]*y+e[11]*z+e[15]);sx+=(e[0]*x+e[4]*y+e[8]*z+e[12])*vw*w;sy+=(e[1]*x+e[5]*y+e[9]*z+e[13])*vw*w;sz+=(e[2]*x+e[6]*y+e[10]*z+e[14])*vw*w;if(needNormal){snx+=(e[0]*nx+e[4]*ny+e[8]*nz)*w;sny+=(e[1]*nx+e[5]*ny+e[9]*nz)*w;snz+=(e[2]*nx+e[6]*ny+e[10]*nz)*w;}}
  const e=(old?previousFinal:finalMatrix).elements,fw=1/(e[3]*sx+e[7]*sy+e[11]*sz+e[15]),wx=(e[0]*sx+e[4]*sy+e[8]*sz+e[12])*fw,wy=(e[1]*sx+e[5]*sy+e[9]*sz+e[13])*fw,wz=(e[2]*sx+e[6]*sy+e[10]*sz+e[14])*fw;const destination=old?previous:positions;destination[at]=wx;destination[at+1]=wy;destination[at+2]=wz;
  if(old){previousVertexRevision[i]=revision;return;}vertexRevision[i]=revision;
  const f=frameInverse.elements;local[at]=f[0]*wx+f[4]*wy+f[8]*wz+f[12];local[at+1]=f[1]*wx+f[5]*wy+f[9]*wz+f[13];local[at+2]=f[2]*wx+f[6]*wy+f[10]*wz+f[14];
  if(needNormal){const a=e[0]*snx+e[4]*sny+e[8]*snz,b=e[1]*snx+e[5]*sny+e[9]*snz,c=e[2]*snx+e[6]*sny+e[10]*snz,len=Math.hypot(a,b,c)||1;normals[at]=a/len;normals[at+1]=b/len;normals[at+2]=c/len;}
 }
 function triangleBox(t){const b=t.box;for(let k=0;k<3;k++){let lo=Infinity,hi=-Infinity;for(const i of t.indices){const v=positions[i*3+k];lo=Math.min(lo,v);hi=Math.max(hi,v);}b.min[k]=lo;b.max[k]=hi;}return b;}
 function union(items){const b=bounds();for(const a of items){extend(b,a.min);extend(b,a.max);}return b;}
 function build(rows){const box=union(rows.map(t=>t.box));if(rows.length<=12)return {box,rows};let axis=0;for(let k=1;k<3;k++)if(box.max[k]-box.min[k]>box.max[axis]-box.min[axis])axis=k;rows.sort((a,b)=>(a.box.min[axis]+a.box.max[axis])-(b.box.min[axis]+b.box.max[axis]));const mid=rows.length>>1;return {box,left:build(rows.slice(0,mid)),right:build(rows.slice(mid))};}
 function bindBounds(node){node.sourceBox=bounds();node.bones=new Set();if(node.rows){for(const t of node.rows)for(const i of t.indices){p.fromBufferAttribute(geometry.attributes.position,i).applyMatrix4(mesh.bindMatrix);extend(node.sourceBox,p.toArray());for(let k=0;k<8;k++)if(surface.skinWeight[i*8+k]>0)node.bones.add(surface.skinIndex[i*8+k]);}}else{bindBounds(node.left);bindBounds(node.right);node.sourceBox=union([node.left.sourceBox,node.right.sourceBox]);node.bones=new Set([...node.left.bones,...node.right.bones]);}node.boundsRevision=-1;}
 function lazyBounds(node){if(node.boundsRevision===revision)return;const b=node.box;for(let k=0;k<3;k++){b.min[k]=Infinity;b.max[k]=-Infinity;}let maxCoordinate=0;
  // A positive-weight LBS vertex lies in the union of the affine transforms of
  // its node's bind-space box. Include finite Float32 weight-sum error explicitly.
  for(const id of node.bones){const m=boneMatrices[id];for(let corner=0;corner<8;corner++){p.set(node.sourceBox[corner&1?'max':'min'][0],node.sourceBox[corner&2?'max':'min'][1],node.sourceBox[corner&4?'max':'min'][2]).applyMatrix4(m).applyMatrix4(finalMatrix);for(let k=0;k<3;k++){const v=p.getComponent(k);b.min[k]=Math.min(b.min[k],v);b.max[k]=Math.max(b.max[k],v);maxCoordinate=Math.max(maxCoordinate,Math.abs(v));}}}
  const roundingPad=maxWeightError*(maxCoordinate+Math.abs(finalMatrix.elements[12])+Math.abs(finalMatrix.elements[13])+Math.abs(finalMatrix.elements[14]))+1e-10;for(let k=0;k<3;k++){b.min[k]-=roundingPad;b.max[k]+=roundingPad;}node.boundsRevision=revision;
 }
 function ensureVertex(i){if(vertexRevision[i]!==revision)skin(i);}
 function materialize(old=false){if((old?previousMaterializedRevision:materializedRevision)===revision)return;for(const i of vertexIds){if(old){if(previousVertexRevision[i]!==revision)skin(i,false,true);}else ensureVertex(i);}if(old)previousMaterializedRevision=revision;else materializedRevision=revision;}
 function motion(){materialize();materialize(true);maxMoveM=0;for(const i of vertexIds)maxMoveM=Math.max(maxMoveM,Math.hypot(positions[i*3]-previous[i*3],positions[i*3+1]-previous[i*3+1],positions[i*3+2]-previous[i*3+2]));return maxMoveM;}
 function refitExact(){owner();materialize();for(const t of triangles)triangleBox(t);function visit(node){if(!node.rows){visit(node.left);visit(node.right);}for(let k=0;k<3;k++){let lo=Infinity,hi=-Infinity;if(node.rows){for(const t of node.rows){lo=Math.min(lo,t.box.min[k]);hi=Math.max(hi,t.box.max[k]);}}else{lo=Math.min(node.left.box.min[k],node.right.box.min[k]);hi=Math.max(node.left.box.max[k],node.right.box.max[k]);}node.box.min[k]=lo;node.box.max[k]=hi;}node.boundsRevision=revision;}visit(bvh);boundsMode='exact-current-triangles';return {revision,boundsMode,triangles:triangles.length,time:lastTime};}
 function update({time=null,exactRefit=false}={}){
  owner();if(time!==null&&(!Number.isFinite(time)||(lastTime!==null&&time<lastTime)))throw Error('Collider time must be finite and monotonic');
  if(geometry.attributes.position.version!==positionVersion){const source=geometry.attributes.position.array;for(const i of vertexIds)for(let k=0;k<3;k++)if(source[i*3+k]!==referencePositions[i*3+k])throw Error('Generated lower-body coordinates changed: recreate adapter and garment fitting');positionVersion=geometry.attributes.position.version;}
  if(revision){for(let i=0;i<boneMatrices.length;i++)previousBones[i].copy(boneMatrices[i]);previousFinal.copy(finalMatrix);}frameUpdate();palette();
  previousTime=lastTime;poseDeltaTime=time!==null&&lastTime!==null&&time>lastTime?time-lastTime:null;revision++;lastTime=time;maxMoveM=null;boundsMode='conservative-lazy';
  if(!bvh){for(let i=0;i<boneMatrices.length;i++)previousBones[i].copy(boneMatrices[i]);previousFinal.copy(finalMatrix);materialize();for(const t of triangles)triangleBox(t);bvh=build(triangles.slice());bindBounds(bvh);}
  if(exactRefit)refitExact();return {revision,time,previousTime,poseDeltaTime,lastPhase:subject.phase,get maxMoveM(){return motion();},triangles:triangles.length,sourceSurfaceScope:'R008-generated-clothed-envelope'};
 }
 function boxDistance(b,v){let d=0;for(let k=0;k<3;k++){const x=v.getComponent(k),a=Math.max(b.min[k]-x,0,x-b.max[k]);d+=a*a;}return d;}
 const A=V(),B=V(),C=V(),near=V(),tri=new THREE.Triangle(),bary=V(),normal=V();
 function currentFace(t){
  if(t.normalRevision===revision)return t;
  const pts=t.indices.map(i=>{ensureVertex(i);return point(positions,i);}),n=V().crossVectors(pts[1].clone().sub(pts[0]),pts[2].clone().sub(pts[0])),length=n.length(),reference=V();
  for(const i of t.indices)reference.add(point(normals,i));
  t.degenerateContactFace=length<=1e-20;n.multiplyScalar(length>1e-20?1/length:0);if(n.dot(reference)<0)n.negate();
  t.contactNormal=n;t.cornerAngles=pts.map((p,i)=>{const a=pts[(i+1)%3].clone().sub(p),b=pts[(i+2)%3].clone().sub(p);return Math.atan2(V().crossVectors(a,b).length(),a.dot(b));});t.normalRevision=revision;return t;
 }
 function featureNormal(result){
  const active=result.weights.map((w,j)=>({w,i:result.indices[j]})).filter(a=>a.w>1e-10),type=active.length===1?'vertex':active.length===2?'edge':'face',ids=type==='face'?result.indices.slice():active.map(a=>a.i),key=type+':'+(type==='face'?result.triangleId:ids.slice().sort((a,b)=>a-b).join(':'));
  const cached=featureNormalCache.get(key);if(cached?.revision===revision)return cached;
  const faces=type==='face'?[triangleById.get(result.triangleId)]:type==='vertex'?vertexFaces.get(ids[0]):vertexFaces.get(ids[0]).filter(t=>t.indices.includes(ids[1])),sum=V();let degenerateFaces=0;
  for(const t of faces){currentFace(t);if(t.degenerateContactFace){degenerateFaces++;continue;}const weight=type==='vertex'?t.cornerAngles[t.indices.indexOf(ids[0])]:1;sum.addScaledVector(t.contactNormal,weight);}
  const magnitude=sum.length(),ambiguous=magnitude<1e-12||faces.length===degenerateFaces;
  const value={revision,type,indices:ids,incidentTriangleIds:faces.map(t=>t.id),normal:ambiguous?currentFace(triangleById.get(result.triangleId)).contactNormal.clone():sum.divideScalar(magnitude),ambiguous,degenerateFaces,normalMethod:type==='face'?'current-oriented-geometric-face':type==='edge'?'sum-current-incident-unit-face-normals':'angle-weighted-current-incident-unit-face-normals',orientationAuthority:'current eight-influence native normals orient geometric faces; actual indexed adjacency only, no invented seam welding',closedSolidCertified:false};featureNormalCache.set(key,value);return value;
 }
 function closestPoint(position){
  owner();const array=Array.isArray(position)||ArrayBuffer.isView(position);
  if(array?(position.length!==3||!Array.from(position).every(Number.isFinite)):(!position?.isVector3||![position.x,position.y,position.z].every(Number.isFinite)))throw Error('Finite three-dimensional contact position required');
  const input=array?V().fromArray(position):position;let best=Infinity,result=null;
  function visit(node){lazyBounds(node);if(boxDistance(node.box,input)>best)return;if(node.rows){for(const t of node.rows){for(const i of t.indices)ensureVertex(i);triangleBox(t);if(boxDistance(t.box,input)>best)continue;point(positions,t.indices[0],A);point(positions,t.indices[1],B);point(positions,t.indices[2],C);tri.set(A,B,C).closestPointToPoint(input,near);const d=near.distanceToSquared(input);if(d>=best)continue;best=d;tri.getBarycoord(near,bary);tri.getNormal(normal);nn.set(0,0,0);for(let j=0;j<3;j++)nn.addScaledVector(point(normals,t.indices[j],q),bary.getComponent(j));if(normal.dot(nn)<0)normal.negate();result={point:near.clone(),normal:normal.clone(),distance:Math.sqrt(d),signedDistance:input.clone().sub(near).dot(normal),triangleId:t.id,indices:t.indices.slice(),weights:bary.toArray(),part:t.part,surfaceKind:R008_SOURCE_SHORTS_PARTS.includes(t.part)?'existing-source-clothing':'source-skin',revision};}}else{lazyBounds(node.left);lazyBounds(node.right);const l=boxDistance(node.left.box,input),r=boxDistance(node.right.box,input);visit(l<r?node.left:node.right);visit(l<r?node.right:node.left);}}
  visit(bvh);if(result){
   const feature=featureNormal(result),delta=input.clone().sub(result.point),projection=delta.dot(feature.normal),sign=projection<0?-1:1;
   const projectionRoundoff=64*Number.EPSILON*(result.distance+input.length()+result.point.length());
   result.nearestFaceProjectionM=result.signedDistance;result.feature={...feature,normal:feature.normal.clone()};result.signAmbiguous=feature.ambiguous||(result.distance>1e-12&&Math.abs(projection)<=projectionRoundoff);result.signProjectionRoundoffM=projectionRoundoff;
   result.pseudonormalProjectionM=projection;result.signedDistance=sign*result.distance;
   // Sign belongs to the closest FEATURE; distance is Euclidean, not a
   // possibly tiny one-face projection of a far edge/vertex query. For a
   // nonzero distance, the local signed-distance gradient is radial.
   result.normal=result.distance>1e-12?delta.multiplyScalar(sign/result.distance):feature.normal.clone();
   const prior=V();for(let j=0;j<3;j++){const i=result.indices[j];if(previousVertexRevision[i]!==revision)skin(i,false,true);prior.addScaledVector(point(previous,i),result.weights[j]);}result.previousPoint=prior;result.velocity=poseDeltaTime!==null?result.point.clone().sub(prior).divideScalar(poseDeltaTime):V();result.velocityValid=poseDeltaTime!==null;result.poseDeltaTime=poseDeltaTime;result.poseTimes={previous:previousTime,current:lastTime};}return result;
 }
 function collide(position,margin=.004){if(!(margin>=0&&Number.isFinite(margin)))throw Error('Contact margin must be finite metres');const hit=closestPoint(position);if(hit?.signAmbiguous)throw Error('HOLD: degenerate closest-feature contact pseudonormal');if(!hit||hit.signedDistance>=margin)return null;return {...hit,surfacePoint:hit.point.clone(),point:hit.point.clone().addScaledVector(hit.normal,margin),penetration:margin-hit.signedDistance,marginM:margin};}
 function sectionAt(y,{partIds=null,toleranceM=.00001,angularSamples=360,center=null}={}){
  materialize();
  if(!partIds&&measurements?.crotchY!==null&&measurements?.crotchY!==undefined&&y<measurements.crotchY){const a=sectionAt(y,{partIds:[9,1,26],toleranceM,angularSamples}),b=sectionAt(y,{partIds:[19,18,12],toleranceM,angularSamples}),cs=[...a.contours,...b.contours];return {y,contours:cs,sourceContours:[...a.sourceContours,...b.sourceContours],distinctLegs:true,valid:a.valid&&b.valid,closed:a.valid&&b.valid,missingRays:a.missingRays+b.missingRays,branchNodes:a.branchNodes+b.branchNodes,angularSamples,scope:'two independent actual generated leg envelopes; gap preserved',innerThighGapM:a.bounds&&b.bounds?a.bounds.min[0]-b.bounds.max[0]:null};}
  owner();const filter=partIds?new Set(partIds):SECTION_PARTS,segments=[],nodes=new Map();
  const key=a=>`${Math.round(a[0]/toleranceM)},${Math.round(a[2]/toleranceM)}`;
  for(const t of triangles){if(!filter.has(t.part))continue;const hits=[];for(let e=0;e<3;e++){const a=local.subarray(t.indices[e]*3,t.indices[e]*3+3),b=local.subarray(t.indices[(e+1)%3]*3,t.indices[(e+1)%3]*3+3);if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y)){const u=(y-a[1])/(b[1]-a[1]);hits.push([a[0]+u*(b[0]-a[0]),y,a[2]+u*(b[2]-a[2])]);}}if(hits.length===2&&key(hits[0])!==key(hits[1]))segments.push(hits);}
  const unique=new Set(),edges=[];for(const s of segments){const a=key(s[0]),b=key(s[1]),ek=[a,b].sort().join('|');if(unique.has(ek))continue;unique.add(ek);const id=edges.length;edges.push([a,b]);for(const [k,pp]of[[a,s[0]],[b,s[1]]]){if(!nodes.has(k))nodes.set(k,{point:pp,edges:[]});nodes.get(k).edges.push(id);}}
  const used=new Set(),contours=[];for(let start=0;start<edges.length;start++){if(used.has(start))continue;let cur=edges[start][0],first=cur,pts=[],closed=false;for(let guard=0;guard<=edges.length;guard++){pts.push(nodes.get(cur).point);const e=nodes.get(cur).edges.find(id=>!used.has(id));if(e===undefined)break;used.add(e);cur=edges[e][0]===cur?edges[e][1]:edges[e][0];if(cur===first){closed=true;break;}}let length=0,front=0,back=0;const b=bounds();for(const a of pts)extend(b,a);const centerZ=(b.min[2]+b.max[2])/2;for(let j=1;j<pts.length+(closed?1:0);j++){const a=pts[j-1],c=pts[j%pts.length],len=Math.hypot(c[0]-a[0],c[2]-a[2]);length+=len;const z0=a[2]-centerZ,z1=c[2]-centerZ;let f=z0>=0&&z1>=0?1:z0<=0&&z1<=0?0:(z0>=0?Math.abs(z0):Math.abs(z1))/(Math.abs(z0)+Math.abs(z1));front+=len*f;back+=len*(1-f);}contours.push({points:pts,closed,circumferenceM:length,frontArcM:front,backArcM:back,bounds:b,centerX:(b.min[0]+b.max[0])/2,centerZ});}
  contours.sort((a,b)=>b.circumferenceM-a.circumferenceM);
  // UV-domain seam reconstruction can leave micron cracks / overlapping chains.
  // A circumference cannot be the longest OPEN chain. The measured outer polar
  // envelope uses actual triangle-plane segment intersections on every ray;
  // missing rays fail, with NO interpolation, hull, ellipse or skin invention.
  const rawBounds=bounds();for(const s of segments)for(const a of s)extend(rawBounds,a);
  const centre=center||[(rawBounds.min[0]+rawBounds.max[0])/2,(rawBounds.min[2]+rawBounds.max[2])/2],samples=[];let missingRays=0;
  for(let i=0;i<angularSamples;i++){const angle=i*2*Math.PI/angularSamples,dx=Math.sin(angle),dz=Math.cos(angle);let far=-Infinity;
   for(const [a,b]of segments){const ax=a[0]-centre[0],az=a[2]-centre[1],ex=b[0]-a[0],ez=b[2]-a[2],den=dx*ez-dz*ex;if(Math.abs(den)<1e-14)continue;const r=(ax*ez-az*ex)/den,t=(ax*dz-az*dx)/den;if(r>=0&&t>=-1e-10&&t<=1+1e-10)far=Math.max(far,r);}
   if(!Number.isFinite(far))missingRays++;else samples.push([centre[0]+dx*far,y,centre[1]+dz*far]);
  }
  let envelope=null;if(!missingRays&&samples.length===angularSamples){const b=bounds();for(const a of samples)extend(b,a);let length=0,front=0,back=0;for(let i=0;i<samples.length;i++){const a=samples[i],c=samples[(i+1)%samples.length],len=Math.hypot(c[0]-a[0],c[2]-a[2]),z0=a[2]-centre[1],z1=c[2]-centre[1],f=z0>=0&&z1>=0?1:z0<=0&&z1<=0?0:(z0>=0?Math.abs(z0):Math.abs(z1))/(Math.abs(z0)+Math.abs(z1));length+=len;front+=len*f;back+=len*(1-f);}envelope={points:samples,closed:true,sourceContourClosed:contours.length===1&&contours[0].closed,circumferenceM:length,frontArcM:front,backArcM:back,bounds:b,centerX:centre[0],centerZ:centre[1],measurementMethod:'polar envelope of actual triangle-plane intersections',angularSamples,allRaysHit:true};}
  const main=envelope;return {y,contours:envelope?[envelope]:[],sourceContours:contours,envelope,...(main?{circumferenceM:main.circumferenceM,frontArcM:main.frontArcM,backArcM:main.backArcM,centerX:main.centerX,centerZ:main.centerZ,bounds:main.bounds,closed:true,sourceContourClosed:main.sourceContourClosed}:{}),valid:!!envelope,missingRays,angularSamples,segmentCount:segments.length,branchNodes:[...nodes.values()].filter(a=>a.edges.length!==2).length,toleranceM,scope:'actual-generated-clothed-envelope',frame:'actor orientation/translation removed, actual scale retained, metres'};
 }
 function measure(){
  owner();const partBounds=subject.data.materials.map((m,i)=>({id:i,name:m.name,vertices:0,...bounds()})),full=bounds();palette();
  // Full final surface, including generated facial changes. No source mesh/cache.
  for(let i=0;i<n;i++){skin(i,false);const a=local.subarray(i*3,i*3+3);extend(full,a);extend(partBounds[parts[i]],a);partBounds[parts[i]].vertices++;}
  for(const i of vertexIds)skin(i,true);
  const landmark=name=>subject.byName.get(name).getWorldPosition(V()).applyMatrix4(frameInverse).toArray(),pelvis=landmark('pelvis'),thighL=landmark('thigh_l'),thighR=landmark('thigh_r'),calfL=landmark('calf_l'),calfR=landmark('calf_r');
  const sourceScale=full.max[1]-full.min[1],referenceY=Math.max(...R008_SOURCE_SHORTS_PARTS.map(id=>partBounds[id].max[1])),lowY=referenceY-(options.waistDropM??.055),referenceWaist=sectionAt(referenceY-.002),lowWaist=sectionAt(lowY);
  referenceWaist.y=referenceY;referenceWaist.sectionY=referenceY-.002;referenceWaist.definition='source clothing maximum upper rim; circumference measured 2mm below maximum, not anatomical waist';
  // Exact source-cloth sagittal-plane minimum, not an invented pelvis landmark.
  const sagittalX=lowWaist.centerX??pelvis[0];let crotchY=Infinity,crotchPoint=null,crotchWitness=null;for(const t of triangles){if(![9,19].includes(t.part))continue;for(let e=0;e<3;e++){const a=local.subarray(t.indices[e]*3,t.indices[e]*3+3),b=local.subarray(t.indices[(e+1)%3]*3,t.indices[(e+1)%3]*3+3);if((a[0]<=sagittalX&&b[0]>sagittalX)||(b[0]<=sagittalX&&a[0]>sagittalX)){const u=(sagittalX-a[0])/(b[0]-a[0]),v=[sagittalX,a[1]+u*(b[1]-a[1]),a[2]+u*(b[2]-a[2])];if(v[1]<crotchY){crotchY=v[1];crotchPoint=v;crotchWitness={triangleId:t.id,edge:[t.indices[e],t.indices[(e+1)%3]],edgeParameter:u,part:t.part};}}}}if(!Number.isFinite(crotchY))crotchY=null;
  // Hip measurement is explicitly a source-cloth envelope in the region around
  // the REAL thigh-joint origin, below the requested band, not two-leg hull.
  const bandHeight=options.bandHeightM??.038,hipTop=lowY-bandHeight-.001,hipBottom=Math.min(thighL[1],thighR[1])-.04*sourceScale/1.8;
  let hip=null;for(let i=0;i<=20;i++){const y=hipBottom+(hipTop-hipBottom)*i/20,s=sectionAt(y);if(s.valid&&(!hip||s.circumferenceM>hip.circumferenceM))hip=s;}
  const legY=crotchY===null?null:crotchY-.025*sourceScale/1.8,left=legY===null?null:sectionAt(legY,{partIds:[9]}).envelope,right=legY===null?null:sectionAt(legY,{partIds:[19]}).envelope,innerThighGapM=left&&right?left.bounds.min[0]-right.bounds.max[0]:null;
  measurements={schema:'r008-shorts-body-measurements/v1',heightM:sourceScale,fullBounds:full,referenceWaist,lowWaist,hip,hipSearchRangeY:[hipBottom,hipTop],hipDefinition:'largest actual outer-clothing section within 40mm below thigh-joint origin and requested lower band edge',thighs:{y:legY,left,right,innerThighGapM,scope:'existing clothing distinct-leg sections, 25mm below source-cloth sagittal crotch'},innerThighGapM,crotchY,crotchPoint,crotchWitness,crotchDefinition:'minimum sagittal-plane intersection of actual source clothing at measured waist envelope center x',landmarks:{pelvis,thighL,thighR,calfL,calfR},partBounds,source:{schema:subject.data.schema,zipSHA256:subject.data.source.zipSHA256,generated:surface.report,skinInfluences:8},missingSkin:{underSourceShorts:true,confirmedByPartBounds:true,torsoLowerY:partBounds[15].min[1],bareLegUpperY:Math.max(partBounds[1].max[1],partBounds[18].max[1]),warning:'No independently generated bare pelvis or upper-thigh skin under source shorts. Hiding cloth alone leaves a hole.'},sourceClothing:{parts:R008_SOURCE_SHORTS_PARTS,groupIndices:geometry.groups.map((g,i)=>R008_SOURCE_SHORTS_PARTS.includes(g.materialIndex)?i:null).filter(i=>i!==null),keepInColliderWhenHidden:true},pose:subject.phase,phaseScope:'current measured generated surface; use neutral rest for garment drafting'};return measurements;
 }
 function sagittalAtY(y){owner();materialize();const x=measurements.lowWaist.centerX,zMiddle=measurements.lowWaist.centerZ,corridor=.005,hits=[];let front=null,back=null,frontWitness=null,backWitness=null;
  const critical=Math.abs(y-measurements.crotchY)<1e-12;if(critical){const witness={...measurements.crotchWitness,actualPoint:measurements.crotchPoint.slice(),lateralDeviationM:0,method:'exact minimum source sagittal intersection; front/back legitimately converge at the crotch'};return {y,front:measurements.crotchPoint.slice(),back:measurements.crotchPoint.slice(),frontValid:true,backValid:true,frontWitness:witness,backWitness:witness,sourceMidlineXM:x,maxLateralDeviationM:corridor,hitCount:1,criticalCrotch:true,valid:true,authority:'actual source triangle/edge crotch point'};}
  function interval(a,b,minimum,maximum,range){const d=b-a;if(Math.abs(d)<1e-14)return a>=minimum&&a<=maximum;let lo=(minimum-a)/d,hi=(maximum-a)/d;if(lo>hi)[lo,hi]=[hi,lo];range[0]=Math.max(range[0],lo);range[1]=Math.min(range[1],hi);return range[0]<=range[1];}
  for(const t of triangles){if(!R008_SOURCE_SHORTS_PARTS.includes(t.part))continue;const line=[];for(let e=0;e<3;e++){const a=local.subarray(t.indices[e]*3,t.indices[e]*3+3),b=local.subarray(t.indices[(e+1)%3]*3,t.indices[(e+1)%3]*3+3);if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y)){const u=(y-a[1])/(b[1]-a[1]),weights=[0,0,0];weights[e]=1-u;weights[(e+1)%3]=u;line.push({p:[a[0]+u*(b[0]-a[0]),y,a[2]+u*(b[2]-a[2])],weights});}}if(line.length!==2)continue;
   const [a,b]=line,dx=b.p[0]-a.p[0];if(Math.abs(dx)>1e-14){const u=(x-a.p[0])/dx;if(u>=0&&u<=1)hits.push([x,y,a.p[2]+u*(b.p[2]-a.p[2])]);}
   for(const side of ['front','back']){const range=[0,1];if(!interval(a.p[0],b.p[0],x-corridor,x+corridor,range)||!interval(a.p[2],b.p[2],side==='front'?zMiddle:-Infinity,side==='front'?Infinity:zMiddle,range))continue;const u=Math.max(range[0],Math.min(range[1],Math.abs(dx)>1e-14?(x-a.p[0])/dx:0)),v=[a.p[0]+u*dx,y,a.p[2]+u*(b.p[2]-a.p[2])],current=side==='front'?front:back;const deviation=Math.abs(v[0]-x),oldDeviation=current?Math.abs(current[0]-x):Infinity;
    if(deviation>oldDeviation+1e-12||(Math.abs(deviation-oldDeviation)<=1e-12&&current&&(side==='front'?v[2]<=current[2]:v[2]>=current[2])))continue;
    const witness={triangleId:t.id,indices:t.indices.slice(),weights:a.weights.map((w,j)=>w+(b.weights[j]-w)*u),part:t.part,actualPoint:v.slice(),lateralDeviationM:deviation,method:'actual horizontal source-triangle intersection, nearest measured midline point in its matching anterior/posterior half, within declared 5mm tape corridor'};
    if(side==='front'){front=v;frontWitness=witness;}else{back=v;backWitness=witness;}
   }
  }
  return {y,front,back,frontValid:!!front,backValid:!!back,frontWitness,backWitness,sourceMidlineXM:x,maxLateralDeviationM:corridor,hitCount:hits.length,criticalCrotch:false,valid:!!front&&!!back&&front[2]>back[2],authority:'actual source surface tape can move laterally up to 5mm around source midline cracks; no missing surface is interpolated'};
 }
 update();measure();
 return {subject,actor,get positions(){materialize();return positions;},get previous(){materialize(true);return previous;},indices,triangles,activeVertexIds:vertexIds,get localPositions(){materialize();return local;},get measurements(){return measurements;},update,refitExact,measure,sectionAt,sagittalAtY,collide,closestPoint,
  trianglePoint(id,weights){owner();const a=indices[id*3],b=indices[id*3+1],c=indices[id*3+2];if(a===undefined||weights.length!==3||Math.abs(weights.reduce((a,b)=>a+b,0)-1)>1e-6)throw Error('Invalid source triangle binding');for(const i of [a,b,c])ensureVertex(i);return point(positions,a).multiplyScalar(weights[0]).addScaledVector(point(positions,b),weights[1]).addScaledVector(point(positions,c),weights[2]);},
  snapshot(){return {schema:'r008-shorts-collider/v1',revision,time:lastTime,previousTime,poseDeltaTime,boundsMode,phase:subject.phase,maxMoveM,vertices:vertexIds.length,triangles:triangles.length,parts:[...selected],approximation:'No decimation: exact current generated triangles. Does not claim source intake approximation is exact.',sourceSurfaceScope:'clothed-envelope, missing hidden bare skin',measurements};}
 };
}
