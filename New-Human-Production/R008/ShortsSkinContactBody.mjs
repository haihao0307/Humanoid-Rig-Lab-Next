import * as THREE from 'three';
// The visible authored skin participates in cloth contact. Retired source
// pants remain measurement evidence, never an invisible second worn garment.
export function createShortsSkinContactBody(nativeBody, barePelvis) {
 const sourceSnapshot=nativeBody.snapshot(),excluded=sourceSnapshot.contactExcludedParts;
 if(![9,10,19].every(id=>excluded.includes(id)))throw Error('Explicitly exclude replaced source pants from native contact');
 if(!barePelvis?.mesh?.isSkinnedMesh||!barePelvis.queryAPI?.closestPoint)throw Error('Actual generated and skinned pelvis surface required');
 const sourceTriangles=nativeBody.triangles,partVertexIds=new Map();
 for(const t of sourceTriangles){if(excluded.includes(t.part))continue;if(!partVertexIds.has(t.part))partVertexIds.set(t.part,new Set());for(const id of t.indices)partVertexIds.get(t.part).add(id);}
 if(!partVertexIds.size)throw Error('Actual remaining native contact part vertices required');
 let boundsRevision=-1,partWorldBoxes=new Map(),boundsBuilds=0,outsideCorrections=0,bareInsideSelections=0;
 const signedDistanceAuthority='current-native-part-world-aabb-outside-proof-plus-closed-bare-inside-priority';
 function inputPoint(p){if(p?.isVector3){if(![p.x,p.y,p.z].every(Number.isFinite))throw Error('Finite current-world contact position required');return p;}if((!Array.isArray(p)&&!ArrayBuffer.isView(p))||p.length!==3||!Array.from(p).every(Number.isFinite))throw Error('Finite current-world contact position required');return new THREE.Vector3().fromArray(p);}
 function currentWorldBoxes(revision){
  if(nativeBody.triangles!==sourceTriangles)throw Error('Native contact geometry rebuilt: recreate visible-skin contact body');
  if(revision===boundsRevision)return partWorldBoxes;
  // This getter evaluates ALL eight native skin influences at the actual
  // current pose. Static measurement boxes are deliberately not reused.
  const positions=nativeBody.positions,next=new Map();
  for(const [part,ids]of partVertexIds){const box=new THREE.Box3(),point=new THREE.Vector3();for(const id of ids){point.fromArray(positions,id*3);if(![point.x,point.y,point.z].every(Number.isFinite))throw Error('Nonfinite current native contact part vertex');box.expandByPoint(point);}if(box.isEmpty())throw Error('Actual native contact part cannot have empty bounds');next.set(part,box);}
  partWorldBoxes=next;boundsRevision=revision;boundsBuilds++;return partWorldBoxes;
 }
 function closestPoint(p){
  const query=inputPoint(p),added=barePelvis.queryAPI.closestPoint(query);
  if(!added||!Number.isFinite(added.distance)||!Number.isFinite(added.signedDistance))throw Error('Authored skin query is invalid');
  if(typeof added.feature==='string')added.feature={type:added.feature,indices:added.indices,normal:added.normal.clone(),closedSolidTopologyCertified:added.closedSolidTopologyCertified};
  added.pseudonormalProjectionM=query.clone().sub(added.point).dot(added.normal);
  if(added.distance>1e-12)added.normal=query.clone().sub(added.point).multiplyScalar(Math.sign(added.signedDistance)/added.distance);
  let native=nativeBody.closestPoint(query,added.distance),outsideProof=false,originalSigned=null,nativeBounds=null;
  if(native){
   originalSigned=native.signedDistance;
   if(!Number.isInteger(native.revision))throw Error('Current native contact revision required');
   if(native.signedDistance<0){
    const box=currentWorldBoxes(native.revision).get(native.part);if(!box)throw Error('Closest native contact part is outside actual part ownership');nativeBounds={revision:boundsRevision,part:native.part,min:box.min.toArray(),max:box.max.toArray(),authority:'exact current WORLD vertices of original native contact triangles; eight influences, no decimation'};
    if(!box.containsPoint(query)){
     outsideProof=true;outsideCorrections++;
     // The query lies outside a support interval containing every actual
     // vertex of this part. A negative open-edge pseudonormal is therefore
     // not an inside certificate for this bounded part. Keep its exact
     // closest point and distance, and change both sign and radial gradient.
     native={...native,signedDistance:native.distance,normal:native.distance>1e-12?query.clone().sub(native.point).divideScalar(native.distance):native.normal.clone(),nativeOriginalSignedDistanceM:originalSigned,nativeOutsideActualPartAABBProof:true,closedSolidCertified:false};
    }
   }
  }
  const bareInside=added.signedDistance<0&&!added.signAmbiguous&&added.closedSolidTopologyCertified===true,
   bareInsidePriority=bareInside&&!!native&&native.signedDistance>=0&&native.distance<added.distance;
  // A nearer positive candidate cannot hide the actual closed bare skin's
  // negative candidate. This preserves membership evidence, without claiming
  // that min unsigned distance computes the boundary of a certified union.
  const hit=bareInsidePriority?added:native&&native.distance<added.distance?native:added;
  if(bareInsidePriority)bareInsideSelections++;
  return {...hit,signedDistanceAuthority,guard:{schema:'visible-skin-contact-sign-selection@1',nativeOutsideActualPartAABBProof:outsideProof,nativeOriginalSignedDistanceM:originalSigned,nativePartWorldBounds:nativeBounds,nativePartWorldBoundsRevision:nativeBounds?.revision??null,bareInsidePriority,bareClosedInsideObserved:bareInside,nearestPositiveCandidatePreserved:!bareInsidePriority,fullSolidUnionCertified:false}};
 }
 function closestSurfacePoint(p){
  if(nativeBody.triangles!==sourceTriangles)throw Error('Actual surface geometry rebuilt');
  const nativeRevision=nativeBody.snapshot().revision,bareRevision=barePelvis.queryAPI.revision,query=inputPoint(p),added=barePelvis.queryAPI.closestPoint(query);
  if(!Number.isInteger(nativeRevision)||!Number.isInteger(bareRevision)||!added||!Number.isFinite(added.distance)||added.distance<0||!Number.isFinite(added.signedDistance)||added.revision!==bareRevision)throw Error('Actual bare surface distance or revision missing');
  const bareInside=added.signedDistance<0&&!added.signAmbiguous&&added.closedSolidTopologyCertified===true;
  const native=nativeBody.closestPoint(query,added.distance);
  if(native&&(native.revision!==nativeRevision||!Number.isFinite(native.distance)||native.distance<0||!native.point||!native.normal))throw Error('Actual native distance or hit revision invalid');
  if(nativeBody.snapshot().revision!==nativeRevision||barePelvis.queryAPI.revision!==bareRevision)throw Error('Actual surface revision changed during query');
  const nearest=native&&native.distance<added.distance?native:added;
  const hit=bareInside?added:nearest,sign=bareInside?-1:1;
  const normal=hit.distance>1e-12?query.clone().sub(hit.point).multiplyScalar(sign/hit.distance):hit.normal.clone();
  return {...hit,normal,signedDistance:sign*hit.distance,signAmbiguous:!!added.signAmbiguous||hit.distance<=1e-12,
   geometryRevision:nativeRevision,bareGeometryRevision:bareRevision,contactMode:'fixed-unsigned-surface-obstacle-with-independent-closed-bare-membership',
   unsignedSurfaceDistanceM:nearest.distance,bareClosedInsideObserved:bareInside,
   scope:'exact nearest actual triangle surface distance; open native part is not an inside certificate; supplied sample path bound required',
   fullSolidUnionCertified:false,fullTriangleCCD:false,motionValidated:false};
 }
 function collide(p,margin=.004){if(!Number.isFinite(margin)||margin<0)throw Error('Finite skin contact clearance required');const h=closestPoint(p);if(h.signAmbiguous)throw Error('HOLD: ambiguous actual skin feature');if(h.signedDistance>=margin)return null;return{...h,surfacePoint:h.point.clone(),point:h.point.clone().addScaledVector(h.normal,margin),penetration:margin-h.signedDistance,marginM:margin};}
 return {subject:nativeBody.subject,actor:nativeBody.actor,get measurements(){return nativeBody.measurements;},get positions(){return nativeBody.positions;},triangles:nativeBody.triangles,closestPoint,closestSurfacePoint,collide,sectionAt:nativeBody.sectionAt,sagittalAtY:nativeBody.sagittalAtY,
  update(options={}){const state=nativeBody.update(options);barePelvis.queryAPI.update?.();return state;},
  refitExact(){nativeBody.refitExact();barePelvis.queryAPI.update?.();return{scope:'actual native skin plus authored missing pelvis; original clothed-envelope retained only for measurement'};},
  snapshot(){return{...nativeBody.snapshot(),schema:'r008-shorts-visible-skin-contact/v2',signedDistanceAuthority,sourceSurfaceScope:'native skin plus authored missing bare pelvis; replaced source shorts excluded',authoredBareSkin:barePelvis.report,nativePartWorldBounds:{cachedRevision:boundsRevision,partIds:[...partVertexIds.keys()],builds:boundsBuilds,authority:'exact current WORLD vertices of remaining original native contact triangles; eight influences, no decimation'},nativeOutsideCorrections:outsideCorrections,bareInsidePrioritySelections:bareInsideSelections,fullSolidUnionCertified:false,motionValidated:false};}
 };
}
