import * as THREE from 'three';
import {createSkinMaterialBinding} from './SkinMaterial.mjs';
import {SKIN_REFERENCE_COLOR} from './SkinAppearance.mjs';
// Estimated anatomy generated from scalar measurements, not recovered hidden
// skin, recoloured shorts, copied garment vertices or a stored body mesh.
const mix=(a,b,t)=>a+(b-a)*t,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const V=()=>new THREE.Vector3();
function ellipse(section,inset=0){
 const b=section?.bounds;
 if(!b||![...b.min,...b.max].every(Number.isFinite))throw Error('Actual scalar section bounds required');
 const out={y:section.y,centerX:section.centerX??(b.min[0]+b.max[0])/2,centerZ:section.centerZ??(b.min[2]+b.max[2])/2,rx:(b.max[0]-b.min[0])/2-inset,rz:(b.max[2]-b.min[2])/2-inset};
 if(!(out.rx>.02&&out.rz>.02))throw Error('Estimated anatomy section must retain positive radii');return out;
}
function blend(a,b,t){return Object.fromEntries(['y','centerX','centerZ','rx','rz'].map(k=>[k,mix(a[k],b[k],t)]));}
function softUnion(a,b,k){const h=clamp(.5+.5*(b-a)/k,0,1);return mix(b,a,h)-k*h*(1-h);}
function createRecipe(body,subject,options){
 const m=body.measurements;if(!m?.missingSkin?.underSourceShorts||subject.phase!=='rest')throw Error('Measure the native neutral R008 with the confirmed missing covered skin before supplementation');
 const inset=options.estimatedClothingInsetM??.005,overlapTop=options.torsoOverlapM??.020,overlapBottom=options.thighOverlapM??.015;
 if(!(inset>=0&&inset<=.015&&overlapTop>=.01&&overlapTop<=.025&&overlapBottom>=.01&&overlapBottom<=.025))throw Error('Estimated skin inset/overlap outside declared anatomical authoring range');
 const scale=m.heightM/1.8,torsoAcquisition=[];let nativeTorso=null,fullTorsoSupport=false;
 // The source's lowest abdomen is only an anterior patch. Acquire the real
 // circumferential torso domain above it, bounded to twelve scalar planes.
 for(let i=0;i<12;i++){const y=m.partBounds[15].min[1]+mix(.020,.140,i/11)*scale,s=body.sectionAt(y,{partIds:[15]});torsoAcquisition.push({y,valid:s.valid,allRaysHit:s.envelope?.allRaysHit??false,missingRays:s.missingRays,sourceChainCount:s.sourceContours?.length??0});if(s.sourceContours?.length)nativeTorso=s;if(s.valid&&s.envelope?.allRaysHit){fullTorsoSupport=true;break;}}
 if(!nativeTorso)throw Error('Native torso scalar domain unavailable in bounded twelve-plane acquisition');
 const upperY=nativeTorso.y+.010*scale,lowerY=Math.min(m.partBounds[1].max[1],m.partBounds[18].max[1])-overlapBottom,
  nativePositive=body.sectionAt(lowerY,{partIds:[1]}),nativeNegative=body.sectionAt(lowerY,{partIds:[18]});
 // The native source has microcracked part boundaries. Estimation can use
 // actual section-chain scalar extents, but must not claim those chains are
 // a recovered closed skin loop or copy their points into the new geometry.
 const nativeScalar=s=>{if(s.bounds)return s;const rows=s.sourceContours??[],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const r of rows)for(let k=0;k<3;k++){min[k]=Math.min(min[k],r.bounds.min[k]);max[k]=Math.max(max[k],r.bounds.max[k]);}if(![...min,...max].every(Number.isFinite))throw Error('Native overlap source section has no actual scalar extent at '+s.y);return {y:s.y,bounds:{min,max},centerX:(min[0]+max[0])/2,centerZ:(min[2]+max[2])/2};};
 const top={...ellipse(nativeScalar(nativeTorso)),y:upperY},hip=ellipse(m.hip,inset),waist=ellipse(m.lowWaist,inset),
  positiveLower=ellipse(nativeScalar(nativePositive)),negativeLower=ellipse(nativeScalar(nativeNegative)),
  sourceLegs=[m.thighs.left,m.thighs.right].map(s=>ellipse({...s,y:m.thighs.y},inset)).sort((a,b)=>a.centerX-b.centerX),
  positiveUpper=sourceLegs[1],negativeUpper=sourceLegs[0],splitY=m.crotchY+.035;
 if(!fullTorsoSupport){top.centerZ=m.lowWaist.centerZ??m.landmarks.pelvis[2];const b=nativeScalar(nativeTorso).bounds;top.rz=Math.max(top.rz,Math.abs(b.max[2]-top.centerZ),Math.abs(b.min[2]-top.centerZ));}
 if(!(lowerY<m.crotchY&&splitY<hip.y&&hip.y<upperY))throw Error('Measured thigh, crotch, hip and torso ordering required');
 const midX=(negativeLower.centerX+positiveLower.centerX)/2,minimumGapM=.015;
 // Clothing cross sections bound the estimate but do not prove leg anatomy.
 // Clip only the authored radii to retain a declared real interleg air gap.
 for(const r of [positiveLower,positiveUpper])r.rx=Math.min(r.rx,r.centerX-midX-minimumGapM/2);
 for(const r of [negativeLower,negativeUpper])r.rx=Math.min(r.rx,midX-r.centerX-minimumGapM/2);
 if([positiveLower,positiveUpper,negativeLower,negativeUpper].some(r=>r.rx<=.025))throw Error('Scalar sections cannot support the declared two-leg gap');
 const charts=new Map(subject.data.charts.map(c=>[c.id,c.part])),colors=subject.surface.colors,local=body.localPositions;let n=0,rgb=[0,0,0];
 for(let i=0;i<subject.surface.chartIds.length;i++)if(charts.get(subject.surface.chartIds[i])===15&&local[i*3+1]>=m.partBounds[15].min[1]&&local[i*3+1]<upperY+.015){for(let k=0;k<3;k++)rgb[k]+=colors[i*3+k];n++;}
 if(!n)throw Error('Current native torso boundary colour scalar required');rgb=rgb.map(x=>x/n);
 // The source vertex colour may only be a white gain over its original map.
 // Do not call it measured skin pigment or acquire pixels from that map.
 const vertexColorCarriesPigment=rgb.some(x=>x<.95),baseColor=options.baseColorRGB??(vertexColorCarriesPigment?rgb:new THREE.Color(SKIN_REFERENCE_COLOR).toArray());if(baseColor.length!==3||!baseColor.every(x=>Number.isFinite(x)&&x>0&&x<=1))throw Error('Finite linear skin boundary colour scalar required');
 return {version:'r008-estimated-bare-pelvis@1',unit:'m',authority:'authored estimated hidden anatomy from current native scalar sections and skeleton; not recovery of exact concealed skin',upperY,lowerY,splitY,crotchClothingWitnessY:m.crotchY,top,waist,hip,positiveLower,negativeLower,positiveUpper,negativeUpper,minimumGapM,estimatedClothingInsetM:inset,overlap:{torsoM:upperY-m.partBounds[15].min[1],nativeFullTorsoSupportOverlapM:.010*scale,thighM:overlapBottom},torsoAcquisition,fullTorsoSupport,topRadiusAuthority:fullTorsoSupport?'first actual native torso all-rays-hit section, extended ten millimetres into native skin':'estimated closure from acquired partial native scalar extents about measured low-waist centre; posterior coverage unresolved',nativeOverlapSections:[nativeTorso,nativePositive,nativeNegative].map(s=>({y:s.y,validPolarEnvelope:s.valid,sourceChainCount:s.sourceContours?.length??0,missingRays:s.missingRays,scalarBounds:nativeScalar(s).bounds,authority:'actual native plane-chain extents; generated ellipse closure estimated when native loop invalid'})),nativeOverlapPartIds:[15,1,18],oldClothingPartIds:[9,10,19],landmarks:structuredClone(m.landmarks),baseColorRGB:baseColor,colourAuthority:vertexColorCarriesPigment?'mean actual native boundary vertex pigment scalar; no texture copying':'public SkinAppearance reference pigment scalar; native white vertex colours are map gains, not measured pigment',nativeBoundaryVertexGainRGB:rgb,torsoColourSamples:n,source:m.source,skinChannels:options.skinChannels??{},voxelM:options.voxelM??.009};
}
function implicit(recipe){
 const r=recipe,profile=y=>y>=r.waist.y?blend(r.waist,r.top,smooth((y-r.waist.y)/(r.top.y-r.waist.y))):y>=r.hip.y?blend(r.hip,r.waist,smooth((y-r.hip.y)/(r.waist.y-r.hip.y))):{...r.hip,rx:r.hip.rx*mix(.80,1,smooth((y-r.splitY)/(r.hip.y-r.splitY))),rz:r.hip.rz*mix(.70,1,smooth((y-r.splitY)/(r.hip.y-r.splitY)))},
  tube=(x,y,z,a,b)=>{const s=blend(a,b,smooth((y-r.lowerY)/(r.splitY-r.lowerY)));return (Math.hypot((x-s.centerX)/s.rx,(z-s.centerZ)/s.rz)-1)*Math.min(s.rx,s.rz);};
 return (x,y,z)=>{const s=profile(y),body=Math.max((Math.hypot((x-s.centerX)/s.rx,(z-s.centerZ)/s.rz)-1)*Math.min(s.rx,s.rz),r.splitY-y),left=tube(x,y,z,r.negativeLower,r.negativeUpper),right=tube(x,y,z,r.positiveLower,r.positiveUpper),legs=Math.max(Math.min(left,right),y-(r.splitY+.055)),combined=softUnion(body,legs,.008);return Math.max(combined,r.lowerY-y,y-r.upperY);};
}
function polygonise(recipe,field){
 const r=recipe,h=r.voxelM;if(!(h>=.005&&h<=.015))throw Error('Estimated anatomy resolution must be 5–15mm');
 const all=[r.top,r.waist,r.hip,r.positiveLower,r.negativeLower,r.positiveUpper,r.negativeUpper],minimum=[Math.min(...all.map(s=>s.centerX-s.rx))-.025,r.lowerY-.025,Math.min(...all.map(s=>s.centerZ-s.rz))-.025],maximum=[Math.max(...all.map(s=>s.centerX+s.rx))+.025,r.upperY+.025,Math.max(...all.map(s=>s.centerZ+s.rz))+.025],dims=minimum.map((x,k)=>Math.ceil((maximum[k]-x)/h)+1),[nx,ny,nz]=dims;
 if(nx*ny*nz>500000)throw Error('Bounded procedural skin grid exceeded');
 const id=(x,y,z)=>x+nx*(y+ny*z),at=i=>[minimum[0]+(i%nx)*h,minimum[1]+(Math.floor(i/nx)%ny)*h,minimum[2]+Math.floor(i/(nx*ny))*h],values=new Float64Array(nx*ny*nz);
 for(let i=0;i<values.length;i++){const p=at(i),v=field(...p);if(!Number.isFinite(v))throw Error('Nonfinite anatomy field');values[i]=Math.abs(v)<1e-12?1e-12:v;}
 const tetra=[[0,1,3,7],[0,3,2,7],[0,2,6,7],[0,6,4,7],[0,4,5,7],[0,5,1,7]],edgeMap=new Map(),vertices=[],indices=[];
 const crossing=(a,b)=>{const key=a<b?a+':'+b:b+':'+a;if(edgeMap.has(key))return edgeMap.get(key);const p=at(a),q=at(b),t=values[a]/(values[a]-values[b]),v=p.map((x,k)=>mix(x,q[k],t)),index=vertices.length/3;vertices.push(...v);edgeMap.set(key,index);return index;};
 const tri=(a,b,c)=>{const p=V().fromArray(vertices,a*3),q=V().fromArray(vertices,b*3),s=V().fromArray(vertices,c*3),n=V().crossVectors(q.clone().sub(p),s.clone().sub(p)),center=p.add(q).add(s).multiplyScalar(1/3),e=.0001,grad=V();grad.set(field(center.x+e,center.y,center.z)-field(center.x-e,center.y,center.z),field(center.x,center.y+e,center.z)-field(center.x,center.y-e,center.z),field(center.x,center.y,center.z+e)-field(center.x,center.y,center.z-e));if(n.dot(grad)<0)indices.push(a,c,b);else indices.push(a,b,c);};
 for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
  const corners=Array.from({length:8},(_,i)=>id(x+(i&1?1:0),y+(i&2?1:0),z+(i&4?1:0)));
  for(const t of tetra){const ids=t.map(i=>corners[i]),inside=ids.filter(i=>values[i]<0),outside=ids.filter(i=>values[i]>0);if(!inside.length||!outside.length)continue;
   if(inside.length===1){const p=outside.map(i=>crossing(inside[0],i));tri(...p);}else if(inside.length===3){const p=inside.map(i=>crossing(outside[0],i));tri(...p);}else{const [a,b]=inside,[c,d]=outside,p=[crossing(a,c),crossing(a,d),crossing(b,d),crossing(b,c)];tri(p[0],p[1],p[2]);tri(p[0],p[2],p[3]);}
  }
 }
 // Isosurface passing exactly through a grid vertex creates coincident edge
 // crossings. Weld only 1-micrometre numerical coincidences before checking
 // the closed oriented topology; no contact/cloth criterion is changed.
 const weld=new Map(),remap=[],welded=[],clean=[],weldToleranceM=.000001;
 for(let i=0;i<vertices.length;i+=3){const key=vertices.slice(i,i+3).map(x=>Math.round(x/weldToleranceM)).join(':');if(!weld.has(key)){weld.set(key,welded.length/3);welded.push(...vertices.slice(i,i+3));}remap[i/3]=weld.get(key);}
 for(let i=0;i<indices.length;i+=3){const ids=indices.slice(i,i+3).map(j=>remap[j]);if(new Set(ids).size===3)clean.push(...ids);}
 const removedCoincidentTriangles=indices.length/3-clean.length/3;vertices.length=0;for(const x of welded)vertices.push(x);indices.length=0;for(const x of clean)indices.push(x);
 // Face orientation is propagated from indexed tetra adjacency rather than
 // trusting a finite-difference field gradient at a branch/cap crease.
 const incidence=new Map(),faceCount=indices.length/3;
 for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){const a=indices[i+k],b=indices[i+(k+1)%3],key=a<b?a+':'+b:b+':'+a;if(!incidence.has(key))incidence.set(key,[]);incidence.get(key).push({face:i/3,sign:a<b?1:-1});}
 const open=[...incidence.values()].filter(x=>x.length!==2).length;if(open)throw Error('Estimated skin has '+open+' non-two-face indexed edges');
 const neighbours=Array.from({length:faceCount},()=>[]);for(const [a,b] of incidence.values()){neighbours[a.face].push({face:b.face,factor:-a.sign*b.sign});neighbours[b.face].push({face:a.face,factor:-a.sign*b.sign});}
 const parity=new Int8Array(faceCount);let components=0;
 for(let first=0;first<faceCount;first++)if(!parity[first]){components++;parity[first]=1;const queue=[first];for(let j=0;j<queue.length;j++){const a=queue[j];for(const b of neighbours[a]){const sign=parity[a]*b.factor;if(parity[b.face]&&parity[b.face]!==sign)throw Error('Generated skin is non-orientable');if(!parity[b.face]){parity[b.face]=sign;queue.push(b.face);}}}}
 for(let f=0;f<faceCount;f++)if(parity[f]===-1)[indices[f*3+1],indices[f*3+2]]=[indices[f*3+2],indices[f*3+1]];
 let orientedVolume=0;for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3).map(j=>V().fromArray(vertices,j*3));orientedVolume+=a.dot(V().crossVectors(b,c))/6;}if(orientedVolume<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 const edges=new Map();let area=0,volume=0;
 for(let i=0;i<indices.length;i+=3){const ids=indices.slice(i,i+3),p=ids.map(j=>V().fromArray(vertices,j*3)),doubleArea=V().crossVectors(p[1].clone().sub(p[0]),p[2].clone().sub(p[0])).length();if(!(doubleArea>1e-16))throw Error('Generated skin contains a geometrically collapsed triangle after coincidence cleanup');area+=doubleArea/2;volume+=p[0].dot(V().crossVectors(p[1],p[2]))/6;for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=a<b?a+':'+b:b+':'+a,row=edges.get(key)??{count:0,orientation:0};row.count++;row.orientation+=a<b?1:-1;edges.set(key,row);}}
 const nonManifold=[...edges.values()].filter(e=>e.count!==2||e.orientation!==0).length;
 if(nonManifold||!(area>0&&volume>0))throw Error('Estimated closed oriented skin topology failed: '+nonManifold);
 return {positions:new Float32Array(vertices),indices:new Uint32Array(indices),report:{vertices:vertices.length/3,triangles:indices.length/3,edges:edges.size,nonManifoldEdges:nonManifold,components,euler:vertices.length/3-edges.size+indices.length/3,signedVolumeM3:volume,areaM2:area,grid:dims,weldToleranceM,removedCoincidentTriangles,orientationAuthority:'indexed face adjacency parity followed by positive signed enclosed volume'}};
}
export function installShortsBarePelvis(body,subject,actor,options={}){
 if(!actor||body.subject!==subject||body.actor!==actor)throw Error('Owned current subject/body/actor required');
 const recipe=createRecipe(body,subject,options),field=implicit(recipe),raw=polygonise(recipe,field),geometry=new THREE.BufferGeometry(),count=raw.positions.length/3,ids=new Uint16Array(count*4),weights=new Float32Array(count*4),bones=subject.skeleton.bones,
  boneIndex=name=>{const i=bones.findIndex(b=>b.name===name);if(i<0)throw Error('Native skeleton bone missing: '+name);return i;},pelvis=boneIndex('pelvis'),thighL=boneIndex('thigh_l'),thighR=boneIndex('thigh_r'),spine=bones.findIndex(b=>b.name==='spine_01');
 actor.updateWorldMatrix(true,false);subject.skeleton.update();const actorFrame=new THREE.Matrix4().compose(actor.getWorldPosition(V()),actor.getWorldQuaternion(new THREE.Quaternion()),V().set(1,1,1)),actorInverse=actorFrame.clone().invert(),palettes=bones.map((bone,i)=>new THREE.Matrix4().multiplyMatrices(actorInverse,bone.matrixWorld).multiply(subject.skeleton.boneInverses[i])),bindPositions=raw.positions.slice();
 for(let i=0;i<count;i++){
  const p=V().fromArray(raw.positions,i*3),leg=smooth((recipe.splitY+.055-p.y)/.10),side=p.x>=recipe.hip.centerX?(recipe.landmarks.thighL[0]>recipe.landmarks.thighR[0]?thighL:thighR):(recipe.landmarks.thighL[0]<recipe.landmarks.thighR[0]?thighL:thighR),upper=spine>=0?smooth((p.y-recipe.waist.y)/(recipe.upperY-recipe.waist.y))*.4:0;
  ids.set([pelvis,side,spine>=0?spine:pelvis,pelvis],i*4);weights.set([(1-leg)*(1-upper),leg,(1-leg)*upper,0],i*4);
  const M=new THREE.Matrix4();M.elements.fill(0);for(let j=0;j<4;j++)for(let k=0;k<16;k++)M.elements[k]+=palettes[ids[i*4+j]].elements[k]*weights[i*4+j];p.applyMatrix4(M.invert()).toArray(bindPositions,i*3);
 }
 geometry.setAttribute('position',new THREE.BufferAttribute(bindPositions,3));geometry.setAttribute('skinIndex',new THREE.BufferAttribute(ids,4));geometry.setAttribute('skinWeight',new THREE.BufferAttribute(weights,4));geometry.setIndex(new THREE.BufferAttribute(raw.indices,1));geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({name:'AuthoredEstimatedBarePelvisSkin',color:new THREE.Color().fromArray(recipe.baseColorRGB),roughness:.52,metalness:0}),mesh=new THREE.SkinnedMesh(geometry,material);mesh.name='ProceduralEstimatedBarePelvis';mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;actor.add(mesh);mesh.bind(subject.skeleton,new THREE.Matrix4());
 const skin=createSkinMaterialBinding({mesh:{geometry,material:[material]},eyes:{eyes:[]}});skin.set(recipe.skinChannels);
 const world=new Float64Array(count*3),faces=[],vertexFaces=new Map(),edgeFaces=new Map(),usedBones=[...new Set([pelvis,thighL,thighR,spine>=0?spine:pelvis])];let disposed=false,revision=0,bvh=null,lastPalette=null;
 for(let i=0;i<raw.indices.length;i+=3){const abc=Array.from(raw.indices.slice(i,i+3)),f={id:i/3,indices:abc};faces.push(f);for(let j=0;j<3;j++){const a=abc[j],b=abc[(j+1)%3];if(!vertexFaces.has(a))vertexFaces.set(a,[]);vertexFaces.get(a).push(f);const key=a<b?a+':'+b:b+':'+a;if(!edgeFaces.has(key))edgeFaces.set(key,[]);edgeFaces.get(key).push(f);}}
 const bounds=rows=>{const box=new THREE.Box3();for(const f of rows)for(const i of f.indices)box.expandByPoint(V().fromArray(world,i*3));return box;},build=rows=>{const box=bounds(rows);if(rows.length<=12)return {box,rows};const size=box.getSize(V()),axis=size.x>=size.y&&size.x>=size.z?0:size.y>=size.z?1:2;rows.sort((a,b)=>a.indices.reduce((s,i)=>s+world[i*3+axis],0)-b.indices.reduce((s,i)=>s+world[i*3+axis],0));const mid=rows.length>>1;return {box,left:build(rows.slice(0,mid)),right:build(rows.slice(mid))};},refit=node=>{if(node.rows)node.box=bounds(node.rows);else{refit(node.left);refit(node.right);node.box.copy(node.left.box).union(node.right.box);}};
 function update(){if(disposed)throw Error('Estimated skin disposed');actor.updateWorldMatrix(true,false);mesh.updateMatrixWorld(true);subject.skeleton.update();const current=[...mesh.matrixWorld.elements,...usedBones.flatMap(i=>Array.from(subject.skeleton.boneMatrices.slice(i*16,i*16+16)))];if(lastPalette&&current.every((x,i)=>x===lastPalette[i]))return {changed:false,revision};lastPalette=current;for(let i=0;i<count;i++)mesh.applyBoneTransform(i,V().fromBufferAttribute(geometry.attributes.position,i)).applyMatrix4(mesh.matrixWorld).toArray(world,i*3);for(const f of faces){const p=f.indices.map(i=>V().fromArray(world,i*3));f.normal=V().crossVectors(p[1].clone().sub(p[0]),p[2].clone().sub(p[0])).normalize();}if(!bvh)bvh=build(faces.slice());else refit(bvh);revision++;return {changed:true,revision};}
 function closestPoint(input){if(disposed)throw Error('Estimated skin disposed');let best=Infinity,hit=null;const p=input.isVector3?input:V().fromArray(input),triangle=new THREE.Triangle(),near=V(),bary=V();
  const visit=node=>{if(node.box.distanceToPoint(p)**2>best)return;if(node.rows)for(const f of node.rows){triangle.set(...f.indices.map(i=>V().fromArray(world,i*3)));triangle.closestPointToPoint(p,near);const d=p.distanceToSquared(near);if(d<best){best=d;triangle.getBarycoord(near,bary);hit={f,point:near.clone(),weights:bary.toArray()};}}else{const l=node.left.box.distanceToPoint(p),r=node.right.box.distanceToPoint(p);visit(l<r?node.left:node.right);visit(l<r?node.right:node.left);}};visit(bvh);
  if(!hit)return null;const zeros=hit.weights.map((w,i)=>w<1e-8?i:-1).filter(i=>i>=0),normal=V();let incidents,feature;
  if(zeros.length===0){incidents=[hit.f];feature='face';}else if(zeros.length===1){const edge=hit.f.indices.filter((_,i)=>i!==zeros[0]),key=edge[0]<edge[1]?edge.join(':'):edge.reverse().join(':');incidents=edgeFaces.get(key);feature='edge';}else{const index=hit.f.indices[hit.weights.indexOf(Math.max(...hit.weights))];incidents=vertexFaces.get(index);feature='vertex';}
  for(const f of incidents){let weight=1;if(feature==='vertex'){const index=hit.f.indices[hit.weights.indexOf(Math.max(...hit.weights))],j=f.indices.indexOf(index),a=V().fromArray(world,f.indices[j]*3),b=V().fromArray(world,f.indices[(j+1)%3]*3).sub(a),c=V().fromArray(world,f.indices[(j+2)%3]*3).sub(a);weight=Math.atan2(V().crossVectors(b,c).length(),b.dot(c));}normal.addScaledVector(f.normal,weight);}const signAmbiguous=normal.length()<1e-10;normal.normalize();const distance=Math.sqrt(best),sign=p.clone().sub(hit.point).dot(normal)<0?-1:1;
  return {point:hit.point,normal,distance,signedDistance:sign*distance,triangleId:hit.f.id,indices:hit.f.indices,weights:hit.weights,feature,signAmbiguous,revision,part:'authored-bare-pelvis',surfaceKind:'estimated-generated-skin',normalAuthority:'oriented current incident face normals; angle weighted at source vertex',closedSolidTopologyCertified:true,closedSolidMotionCertified:false};
 }
 update();let initialNativeBindWorldErrorM=0;for(let i=0;i<count;i++)initialNativeBindWorldErrorM=Math.max(initialNativeBindWorldErrorM,V().fromArray(raw.positions,i*3).applyMatrix4(actorFrame).distanceTo(V().fromArray(world,i*3)));if(initialNativeBindWorldErrorM>3e-6)throw Error('Render/CPU native skin does not recover generated field in the actual actor frame');
 const report={version:recipe.version,recipe,topology:raw.report,authority:recipe.authority,coordinatesStoredInSource:0,oldClothingCopied:false,oldClothingHidden:false,nativeSkeletonBinding:true,influences:4,initialNativeBindWorldErrorM,worldFrame:'actual skeleton WORLD metres; render mesh and CPU query use the same four native influences',queryUpdateUnchangedPaletteCachedInMemory:true,closedSolidTopologyCertified:true,skinMaterialAuthority:'scalar SkinAppearance pigment authority + shared SkinMaterial procedural channels; no copied image maps',queryAuthority:'current generated estimated skin triangles; exact BVH, current angle-weighted closest-feature normals',overlapVisuallyValidated:false,selfIntersectionMotionValidated:false,coveredSkinExactRecovery:false,productionReady:false};
 return {mesh,report,skin,queryAPI:{get positions(){return world;},indices:raw.indices,update,closestPoint,collide(p,margin=.004){const h=closestPoint(p);if(h?.signAmbiguous)throw Error('Estimated skin contact feature is ambiguous');return h&&h.signedDistance<margin?{...h,surfacePoint:h.point.clone(),point:h.point.clone().addScaledVector(h.normal,margin),penetration:margin-h.signedDistance}:null;}},dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();geometry.dispose();material.dispose();}};
}
