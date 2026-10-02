/* Fixed-length surface-contact adaptation for box pushing and ledge support.
 * The atlas is a static, partly flexed hand, not a recorded grasp. Rotating
 * that hand onto a flat box face buried the distal fingers by 28--40 mm.
 * This engineering contact pose opens each measured digit along the face.
 * It changes joint rotations only; wrist, palm target and source bone lengths
 * remain authoritative. This is not a measured finger-motion recording.
 */
const CONTACT_HAND_POSE_REVISION='box-surface-support/v3';
const contactHandRecipes=new WeakMap();
function contactHandRecipe(h){
 let cached=contactHandRecipes.get(h);
 if(cached&&cached.rig===h.resolvedRig&&cached.bind===h.sourceBind&&cached.metrics===h.bodyMetrics&&cached.geometryKey===h.bodyMetrics.geometryKey&&cached.statureScale===h.bodyMetrics.statureScale)return cached;
 const sides={};
 for(const side of ['left','right']){
  const handId=side+'_hand',handBind=h.sourceBind.get(handId),handInverse=inv(handBind.q),chains=[];
  const localPoint=p=>rotate(handInverse,sub(p,handBind.p));
  for(let digit=1;digit<=5;digit++){
   const ids=[side+'_metacarpal_'+digit,...Array.from({length:digit===1?2:3},(_,k)=>side+'_finger_'+digit+'_'+(k+1))];
   const nodes=ids.map(id=>h.resolvedRig.nodes[id]),source=nodes.map(n=>localPoint(n.positionM));
   const tip=localPoint(nodes.at(-1).tipM);source.push(tip);
   const target=[[...source[0]]],outside=(digit===1?.014:.010)*h.bodyMetrics.statureScale;
   for(let i=1;i<source.length;i++){
    const delta=sub(source[i],source[i-1]),length=len(delta);let v;
    if(i===1){
     // The metacarpal root remains in the palm. Open its distal knuckle
     // toward the exterior before the finger passes below the upper edge.
     // The effector is on the palm surface, in front of the wrist bone.
     // Leave a finger-thickness gap to that plane, not to the wrist plane.
     const dz=h.bodyMetrics.palmContact[2]-outside-target[i-1][2],dx=delta[0],remaining=length*length-dx*dx-dz*dz;
     if(remaining<=0)throw Error('当前个体的手指不能保持骨长形成箱面接触');
     v=[dx,-Math.sqrt(remaining),dz];
    }else v=mul(norm([delta[0],delta[1],0]),length);
    target.push(add(target[i-1],v));
   }
   const absolute=ids.map((id,i)=>qm(fromTo(sub(source[i+1],source[i]),sub(target[i+1],target[i])),qm(handInverse,h.sourceBind.get(id).q)));
   const rows=ids.map((id,i)=>{
    const node=h.resolvedRig.nodes[id],bind=h.sourceBind.get(id),parent=h.sourceBind.get(node.parent),parentTarget=i?absolute[i-1]:qi();
    return {id,parent:node.parent,offset:rotate(inv(parent.q),sub(bind.p,parent.p)),
     restQ:qm(inv(parent.q),bind.q),contactQ:qm(inv(parentTarget),absolute[i])};
   });
   chains.push(rows);
  }
  sides[side]=chains;
 }
 cached={revision:CONTACT_HAND_POSE_REVISION,rig:h.resolvedRig,bind:h.sourceBind,metrics:h.bodyMetrics,geometryKey:h.bodyMetrics.geometryKey,statureScale:h.bodyMetrics.statureScale,sides};contactHandRecipes.set(h,cached);return cached;
}
function contactHandPose(h,frames,contact){
 if(!contact||contact.amount<=0)return frames;
 if(contact.mode!==CONTACT_HAND_POSE_REVISION)throw Error('未知的接触手形来源');
 const amount=clamp(contact.amount,0,1),recipe=contactHandRecipe(h);
 for(const chains of Object.values(recipe.sides))for(const rows of chains)for(const row of rows){
  const parent=frames.get(row.parent);if(!parent||!frames.has(row.id))throw Error('接触手形缺少完整固定指链：'+row.id);
  frames.set(row.id,compose(parent,frame(row.offset,qslerp(row.restQ,row.contactQ,amount))));
 }
 return frames;
}
// Bone-centre and bone-segment evidence includes metacarpals and distal tips.
// It complements screenshots; it is not a claim about the full skin volume.
function contactHandSegments(h,frames){
 const segments=[],get=id=>frames?.get(id)||h.byId?.get(id)?.world;
 for(const side of ['left','right'])for(let digit=1;digit<=5;digit++){
  const ids=[side+'_metacarpal_'+digit,...Array.from({length:digit===1?2:3},(_,k)=>side+'_finger_'+digit+'_'+(k+1))];
  for(let i=0;i<ids.length;i++){
   const id=ids[i],current=get(id);if(!current)throw Error('手指接触验证缺少骨段：'+id);
   const next=i+1<ids.length?get(ids[i+1]).p:add(current.p,rotate(current.q,rotate(inv(h.sourceBind.get(id).q),sub(h.resolvedRig.nodes[id].tipM,h.resolvedRig.nodes[id].positionM))));
   segments.push({id,a:current.p,b:next});
  }
 }
 return segments;
}
function contactHandObjectClearance(h,frames,physics,objectId,objectPose=null){
 const record=physics.bodies.get(objectId);if(!record)throw Error('手指接触验证缺少物体碰撞形状');
 const body=record.body,box=body.shapes.length===1&&body.shapes[0].halfExtents;
 const pose=objectPose||frame(physics.array(body.position),[body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w]);
 const inverseObject=inv(pose.q),shapeQ=body.shapeOrientations[0],inverseShape=inv([shapeQ.x,shapeQ.y,shapeQ.z,shapeQ.w]),offset=physics.array(body.shapeOffsets[0]);
 const local=p=>rotate(inverseShape,sub(rotate(inverseObject,sub(p,pose.p)),offset));
 let minimumClearanceM=Infinity,worstSegment=null,samples=0;
 for(const segment of contactHandSegments(h,frames)){
  if(box){
   const value=contactHandBoxSegmentDistance(local(segment.a),local(segment.b),[box.x,box.y,box.z]);samples++;
   if(value<minimumClearanceM){minimumClearanceM=value;worstSegment=segment.id;}continue;
  }
  const count=Math.max(1,Math.ceil(dist(segment.a,segment.b)/.002));
  for(let i=0;i<=count;i++){
   const value=physics.sphereObjectClearance(record,mix(segment.a,segment.b,i/count),0,objectPose);samples++;
   if(value<minimumClearanceM){minimumClearanceM=value;worstSegment=segment.id;}
  }
 }
 return {minimumClearanceM,worstSegment,samples,scope:box?'exact box distance for all metacarpal/finger bone segments, including distal tips; not skin volume':'metacarpal/finger bone segments, including distal tips; 2 mm point spacing; not skin volume'};
}
function contactHandBoxSegmentDistance(a,b,half){
 const d=sub(b,a),planes=[];for(let axis=0;axis<3;axis++)for(const sign of [-1,1])planes.push([sign*a[axis]-half[axis],sign*d[axis]]);
 const events=[0,1];
 for(const [origin,speed]of planes)if(Math.abs(speed)>1e-12){const t=-origin/speed;if(t>0&&t<1)events.push(t);}
 // Inside the box the signed distance is the maximum of six affine face
 // distances. Its minimum is an endpoint or an intersection of two faces.
 const candidates=[...events];
 for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){
  const divisor=planes[i][1]-planes[j][1];if(Math.abs(divisor)<1e-12)continue;
  const t=(planes[j][0]-planes[i][0])/divisor;if(t>0&&t<1)candidates.push(t);
 }
 // Between face crossings the squared exterior distance is a quadratic.
 // Include its stationary point, so thin corner crossings cannot hide
 // between discretely sampled phalanges or during an object rotation.
 events.sort((x,y)=>x-y);
 for(let i=1;i<events.length;i++){
  const lo=events[i-1],hi=events[i],middle=(lo+hi)/2;let numerator=0,denominator=0;
  for(const [origin,speed]of planes)if(origin+speed*middle>0){numerator+=origin*speed;denominator+=speed*speed;}
  if(denominator>1e-20)candidates.push(clamp(-numerator/denominator,lo,hi));
 }
 let minimum=Infinity;
 for(const t of candidates){const delta=a.map((v,i)=>Math.abs(v+d[i]*t)-half[i]);
  minimum=Math.min(minimum,Math.hypot(...delta.map(v=>Math.max(0,v)))+Math.min(0,Math.max(...delta)));
 }
 return minimum;
}
