// Metric rigid bodies. Only step() advances time; paused callers leave all state frozen.
// MotionLab retains pose authority. Actor spheres are moving collision proxies,
// not an articulated dynamics model or proof of muscle/visual validation.
class PhysicsWorld{
 constructor(world){
  this.world=world;this.C=WorkbenchPhysicsEngine;this.fixedDt=1/120;this.maxMicrosteps=8;
  this.bodies=new Map();this.terrain=[];this.actors=new Map();this.manipulations=new Map();this.frozen=new Map();
  this.states=new Map();this.stepCount=0;this.microstepCount=0;this.lastMicrosteps=0;
  this.contacts=[];this.maxPenetrationM=0;this.actorHumans=new Map();this.actorRoots=new Map();this.actorGroups=new Map();
  this.engine=new this.C.World({gravity:new this.C.Vec3(0,-9.81,0),allowSleep:true});
  this.engine.broadphase=new this.C.SAPBroadphase(this.engine);
  // cannon-es 0.20.0's averaged-contact path swaps the two body-local
  // friction anchors. Away from the origin this creates metre-long lever
  // arms and persistent sliding. Keep each original contact and its owner.
  this.engine.narrowphase.enableFrictionReduction=false;
  // The pinned solver clamps lambda (impulse), although narrowphase names its
  // gravity-based limits maxForce. Adapt only this world instance, once after
  // contact generation and before the solver consumes the equations.
  const narrowphase=this.engine.narrowphase,getContacts=narrowphase.getContacts;
  narrowphase.getContacts=(...args)=>{getContacts.apply(narrowphase,args);this.prepareFrictionImpulses(args[5],args[2].dt);};
  this.engine.solver.iterations=24;this.engine.solver.tolerance=1e-7;
  Object.assign(this.engine.defaultContactMaterial,{friction:.4,restitution:.08,
   contactEquationStiffness:1e7,contactEquationRelaxation:4,frictionEquationStiffness:1e7,frictionEquationRelaxation:4});
  this.settingsKey='';this.boundsKey='';this.syncScene();
 }
 vector(a){return new this.C.Vec3(a[0],a[1],a[2]);}
 array(v){return [v.x,v.y,v.z];}
 quaternion(a){return new this.C.Quaternion(a[0],a[1],a[2],a[3]);}
 clamp(n,a,b){return Math.min(b,Math.max(a,n));}
 ownerKey(value){return value==null?'main':String(value);}
 prepareFrictionImpulses(equations,dt){
  if(!Number.isFinite(dt)||dt<=0)throw Error('摩擦求解步长无效');
  const patches=new Map();
  // Keep the original body-local anchors. Multiple points on one body-pair
  // contact plane share its load; four box corners do not each carry m*g.
  for(let i=0;i<equations.length;i+=2){
   const a=equations[i],b=equations[i+1];
   if(!b||a.bi!==b.bi||a.bj!==b.bj)throw Error('摩擦接触切线配对无效');
   const n=[a.t.y*b.t.z-a.t.z*b.t.y,a.t.z*b.t.x-a.t.x*b.t.z,a.t.x*b.t.y-a.t.y*b.t.x],sign=a.bi.id<a.bj.id?1:-1;
   const key=[Math.min(a.bi.id,a.bj.id),Math.max(a.bi.id,a.bj.id),...n.map(v=>Math.round(v*sign*1000))].join(':');
   let patch=patches.get(key);if(!patch){patch=[];patches.set(key,patch);}patch.push([a,b]);
  }
  const velocity=(body,r)=>{
   const v=body.velocity,w=body.angularVelocity,f=body.force,k=body.invMass*dt;
   return[v.x+w.y*r.z-w.z*r.y+f.x*k,v.y+w.z*r.x-w.x*r.z+f.y*k,v.z+w.x*r.y-w.y*r.x+f.z*k];
  };
  for(const patch of patches.values())for(const [a,b] of patch){
   const impulse=Math.min(a.maxForce,b.maxForce)*dt/patch.length;
   const va=velocity(a.bi,a.ri),vb=velocity(a.bj,a.rj),v=vb.map((value,i)=>value-va[i]);
   const u=a.t.x*v[0]+a.t.y*v[1]+a.t.z*v[2],w=b.t.x*v[0]+b.t.y*v[1]+b.t.z*v[2],speed=Math.hypot(u,w);
   // A sliding contact spends one circular Coulomb budget along its predicted
   // slip direction. A diagonal must not receive sqrt(2) times the friction.
   const limits=speed>1e-6?[Math.abs(u)/speed,Math.abs(w)/speed]:[Math.SQRT1_2,Math.SQRT1_2];
   for(const [i,e] of [a,b].entries()){e.maxForce=impulse*limits[i];e.minForce=-e.maxForce;}
  }
 }
 finiteArray(a,n,label){if(!Array.isArray(a)||a.length!==n||a.some(v=>!Number.isFinite(v)||Math.abs(v)>1e5))throw Error('物理状态无效：'+label);}
 configure(input={}){
  const settings=worldPhysicsSettings({...this.world.physicsSettings,...input});
  this.world.physicsSettings=settings;this.syncScene();return {...settings};
 }
 signature(o){return JSON.stringify([o.templateId,o.shape,o.w,o.h,o.d,o.r,o.mass,o.movable,o.collidable,o.friction,o.restitution]);}
 material(friction,restitution){return new this.C.Material({friction,restitution});}
 resetContacts(){
  this.contacts=[];this.maxPenetrationM=0;this.engine.contacts.length=0;this.engine.frictionEquations.length=0;
  this.engine.collisionMatrix.reset();this.engine.collisionMatrixPrevious.reset();
  for(const keeper of [this.engine.bodyOverlapKeeper,this.engine.shapeOverlapKeeper]){keeper.current.length=0;keeper.previous.length=0;}
  this.engine.broadphase.dirty=true;
 }
 syncScene(){
  const settings=worldPhysicsSettings(this.world.physicsSettings||{}),key=JSON.stringify(settings);
  let reset=false;
  if(key!==this.settingsKey){
   this.settingsKey=key;this.settings=settings;this.engine.gravity.set(0,-settings.gravityMps2,0);
   this.groundMaterial=this.material(settings.groundFriction,1);this.boundsKey='';
   for(const record of this.bodies.values())if(record.body.mass>0)record.body.wakeUp();
  }
  const bounds=this.world.bounds,boundsKey=JSON.stringify([bounds.xMin,bounds.xMax,bounds.zMin,bounds.zMax]);
  if(boundsKey!==this.boundsKey){
   for(const body of this.terrain)this.engine.removeBody(body);this.terrain=[];
   const dx=bounds.xMax-bounds.xMin,dz=bounds.zMax-bounds.zMin,cx=(bounds.xMax+bounds.xMin)/2,cz=(bounds.zMax+bounds.zMin)/2;
   if(![dx,dz,cx,cz].every(Number.isFinite)||dx<=0||dz<=0)throw Error('物理世界边界无效');
   const add=(id,p,half)=>{const body=new this.C.Body({mass:0,material:this.groundMaterial,
    shape:new this.C.Box(this.vector(half)),position:this.vector(p),collisionFilterGroup:1,collisionFilterMask:2|4});
    body.workbenchId=id;this.engine.addBody(body);this.terrain.push(body);};
   add('ground',[cx,-.15,cz],[dx/2+.3,.15,dz/2+.3]);
   add('boundary:xMin',[bounds.xMin-.15,4,cz],[.15,4,dz/2+.3]);
   add('boundary:xMax',[bounds.xMax+.15,4,cz],[.15,4,dz/2+.3]);
   add('boundary:zMin',[cx,4,bounds.zMin-.15],[dx/2+.3,4,.15]);
   add('boundary:zMax',[cx,4,bounds.zMax+.15],[dx/2+.3,4,.15]);
   this.boundsKey=boundsKey;reset=true;
  }
  const ids=new Set();
  for(const o of this.world.objects){
   if(ids.has(o.id))throw Error('重复物理物体 ID：'+o.id);ids.add(o.id);
   this.finiteArray(o.p,3,o.id+' position');this.finiteArray(o.q,4,o.id+' quaternion');
   let record=this.bodies.get(o.id),signature=this.signature(o);
   if(!record||record.object!==o||record.signature!==signature){
    if(record)this.engine.removeBody(record.body);
    this.frozen.delete(o.id);
    record=this.createBody(o,signature);this.bodies.set(o.id,record);this.states.delete(o.id);reset=true;
   }else{
    const qError=Math.min(Math.hypot(...o.q.map((v,i)=>v-record.written.q[i])),Math.hypot(...o.q.map((v,i)=>v+record.written.q[i])));
    const edited=Math.hypot(...o.p.map((v,i)=>v-record.written.p[i]))>1e-8||qError>1e-8||
     (o.v||[0,0,0]).some((v,i)=>Math.abs(v-record.written.v[i])>1e-8)||
     (o.angularVelocity||[0,0,0]).some((v,i)=>Math.abs(v-record.written.angularVelocity[i])>1e-8);
    if(edited){this.applyPose(record,{p:o.p,q:o.q,v:o.v||[0,0,0],angularVelocity:o.angularVelocity||[0,0,0]});this.states.delete(o.id);reset=true;}
   }
   this.setCollisionFilter(record);
  }
  for(const [id,record]of this.bodies)if(!ids.has(id)){this.engine.removeBody(record.body);this.bodies.delete(id);this.states.delete(id);this.frozen.delete(id);reset=true;}
  for(const id of this.manipulations.keys())if(!ids.has(id))this.clearManipulation(id);
  if(reset){this.resetContacts();this.states.clear();for(const record of this.bodies.values())if(record.body.mass>0)record.body.wakeUp();}
 }
 createBody(o,signature){
  const C=this.C,mass=o.movable===false?0:Math.max(.05,o.mass);
  if(!Number.isFinite(mass))throw Error('物理物体质量无效：'+o.id);
  const body=new C.Body({mass,material:this.material(o.friction??.4,o.restitution??.08),
   allowSleep:true,sleepSpeedLimit:.055,sleepTimeLimit:.65,linearDamping:.015,angularDamping:.04});
  body.workbenchId=o.id;let minFeature=Infinity,approximation='exact-primitive';
  const box=(x,y,z,w,h,d)=>{if([w,h,d].some(v=>!Number.isFinite(v)||v<=0))throw Error('物理形状尺寸无效：'+o.id);
   body.addShape(new C.Box(new C.Vec3(w/2,h/2,d/2)),new C.Vec3(x,y,z));minFeature=Math.min(minFeature,w,h,d);};
  if(o.shape==='box'&&o.templateId==='worktable'){
   box(0,o.h/2-.025,0,o.w,.05,o.d);
   for(const x of [-1,1])for(const z of [-1,1])box(x*(o.w/2-.055),-.025,z*(o.d/2-.055),.045,o.h-.05,.045);
   approximation='activity-furniture-compound';
  }else if(o.shape==='box'&&o.templateId==='bench'){
   box(0,o.h/2-.028,0,o.w,.056,o.d);
   for(const x of [-1,1])box(x*o.w*.36,-.028,0,.07,o.h-.056,o.d*.8);
   approximation='activity-furniture-compound';
  }else if(o.shape==='box'&&o.templateId==='shelf'){
   for(const x of [-1,1])box(x*(o.w/2-.025),0,0,.05,o.h,o.d);
   box(0,0,-o.d/2+.018,o.w,o.h,.036);
   for(let i=0;i<4;i++)box(0,-o.h/2+.025+i*(o.h-.05)/3,0,o.w,.05,o.d);
   approximation='activity-furniture-compound';
  }else if(o.shape==='sphere'){body.addShape(new C.Sphere(o.r));minFeature=o.r*2;
  }else if(o.shape==='cylinder'||o.shape==='prism'){
   // cannon-es 0.20.0 cylinders use Y as height, with the first rim point at +Z.
   // Rotate +pi/2 about Y to match cylinder()'s +X start, especially the prism.
   body.addShape(new C.Cylinder(o.r,o.r,o.h,o.shape==='prism'?3:36),new C.Vec3(),new C.Quaternion().setFromAxisAngle(new C.Vec3(0,1,0),Math.PI/2));
   minFeature=Math.min(o.h,o.r*(o.shape==='prism'?1.5:2));
  }else if(o.shape==='cone'){
   // A single apex avoids the degenerate, duplicate top ring of Cylinder(0,...).
   const n=36,vertices=Array.from({length:n},(_,i)=>new C.Vec3(Math.cos(i*2*Math.PI/n)*o.r,-o.h/2,Math.sin(i*2*Math.PI/n)*o.r));
   vertices.push(new C.Vec3(0,o.h/2,0));
   const faces=[Array.from({length:n},(_,i)=>i),...Array.from({length:n},(_,i)=>[i,n,(i+1)%n])];
   body.addShape(new C.ConvexPolyhedron({vertices,faces}));minFeature=Math.min(o.h,o.r*2);
  }else{box(0,0,0,o.w,o.h,o.d);if(o.templateId&&!['box','wall','barrier'].includes(o.templateId))approximation='conservative-furniture-box';}
  const record={object:o,body,signature,minFeature,approximation,written:null};
  this.engine.addBody(body);this.applyPose(record,{p:o.p,q:o.q,v:o.v||[0,0,0],angularVelocity:o.angularVelocity||[0,0,0]});return record;
 }
 applyPose(record,state){
  for(const [key,n]of [['p',3],['q',4],['v',3],['angularVelocity',3]])this.finiteArray(state[key],n,record.object.id+' '+key);
  if(Math.hypot(...state.q)<1e-8)throw Error('物理旋转四元数不可为零');
  const b=record.body;b.position.copy(this.vector(state.p));b.quaternion.copy(this.quaternion(state.q));b.quaternion.normalize();
  b.velocity.copy(this.vector(state.v));b.angularVelocity.copy(this.vector(state.angularVelocity));
  if(b.mass===0){b.velocity.setZero();b.angularVelocity.setZero();}
  b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);b.previousQuaternion.copy(b.quaternion);b.interpolatedQuaternion.copy(b.quaternion);
  b.force.setZero();b.torque.setZero();b.aabbNeedsUpdate=true;b.updateInertiaWorld(true);b.wakeUp();this.writePose(record,false);
 }
 setCollisionFilter(record){
  const b=record.body,o=record.object,m=this.manipulations.get(o.id);
  const actorMask=[...this.actorGroups.values()].reduce((mask,group)=>mask|group,0);
  // Active carry AND push use the bounded manipulation force as the owner's
  // only contact drive; a kinematic forearm must not bypass the muscle limit.
  const ownerMask=m?(this.actorGroups.get(m.ownerId)||0):0;
  b.collisionFilterGroup=o.collidable===false?4:2;
  b.collisionFilterMask=o.collidable===false?1:(1|2|(actorMask&~ownerMask));
 }
 writePose(record,revision=true){
  const b=record.body,o=record.object,p=this.array(b.position),q=[b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w],v=this.array(b.velocity),angularVelocity=this.array(b.angularVelocity);
  const moved=record.written&&(Math.hypot(...p.map((n,i)=>n-record.written.p[i]))>1e-6||Math.hypot(...q.map((n,i)=>n-record.written.q[i]))>1e-6);
  o.p=p;o.q=q;o.v=v;o.angularVelocity=angularVelocity;
  o.yaw=Math.atan2(2*(q[3]*q[1]+q[0]*q[2]),1-2*(q[1]*q[1]+q[0]*q[0]));
  record.written={p:[...p],q:[...q],v:[...v],angularVelocity:[...angularVelocity]};
  if(revision&&moved){this.world.revision++;o.moveCount=(o.moveCount||0)+1;}
 }
 setManipulation(object,candidate,type,limits={}){
  if(!['carry','push'].includes(type))throw Error('未知物理操作类型');
  const record=this.bodies.get(object.id);if(!record||record.object!==object||record.body.mass<=0)throw Error('操作物体不是可移动刚体');
  this.finiteArray(candidate.p,3,'grip target');this.finiteArray(candidate.q,4,'grip rotation');
  if(Math.hypot(...candidate.q)<1e-8)throw Error('物理抓握旋转四元数不可为零');
  const maxForceN=limits.maxForceN??0,maxTorqueNm=limits.maxTorqueNm??0,maxHorizontalForceN=limits.maxHorizontalForceN??maxForceN;
  if([maxForceN,maxTorqueNm,maxHorizontalForceN].some(v=>!Number.isFinite(v)||v<0))throw Error('物理力量上限无效');
  const ownerId=this.ownerKey(limits.ownerId),existing=this.manipulations.get(object.id);
  if(object.heldOwner!=null&&this.ownerKey(object.heldOwner)!==ownerId)throw Error('物体已由其他人物持有');
  if(existing&&existing.ownerId!==ownerId)throw Error('物体已有其他人物的物理接触所有权');
  const supportPivotLocal=limits.supportPivotLocal||null;
  if(supportPivotLocal)this.finiteArray(supportPivotLocal,3,'supported box pivot');
  const previous=existing?.type===type?existing:null;
  const targetVelocity=previous?candidate.p.map((v,i)=>(v-previous.p[i])/this.fixedDt):[0,0,0];
  const targetSpeed=Math.hypot(...targetVelocity);if(targetSpeed>4)for(let i=0;i<3;i++)targetVelocity[i]*=4/targetSpeed;
  const actorRoot=this.actorRoots.get(ownerId);
  const direction=actorRoot?[object.p[0]-actorRoot[0],0,object.p[2]-actorRoot[2]]:candidate.p.map((v,i)=>i===1?0:v-object.p[i]);
  const d=Math.hypot(...direction);if(d>1e-6)for(let i=0;i<3;i++)direction[i]/=d;
  else if(previous)direction.splice(0,3,...previous.direction);else direction.splice(0,3,0,0,1);
  this.manipulations.set(object.id,{id:object.id,ownerId,type,p:[...candidate.p],q:[...candidate.q],targetVelocity,direction,
   maxForceN,maxTorqueNm,maxHorizontalForceN,supportPivotLocal:supportPivotLocal?[...supportPivotLocal]:null,appliedForceN:0,appliedHorizontalForceN:0,appliedTorqueNm:0});
  record.body.wakeUp();for(const r of this.bodies.values())this.setCollisionFilter(r);
 }
 clearManipulation(objectId){
  if(objectId==null)return;
  const old=this.manipulations.get(objectId);this.manipulations.delete(objectId);
  if(old){const record=this.bodies.get(old.id);if(record){this.setCollisionFilter(record);record.body.wakeUp();}}
 }
 beginRelease(objectId,ownerId){
  const m=this.manipulations.get(objectId);
  if(!m||m.ownerId!==this.ownerKey(ownerId))throw Error('松手缺少本人物的接触所有权');
  // Keep only the existing owner pair excluded while its contacting arm
  // withdraws. The object stays dynamic with zero manipulation force. Other
  // actors, objects and ground retain their normal collision response.
  m.separating=true;m.targetVelocity=[0,0,0];m.maxForceN=0;m.maxHorizontalForceN=0;m.maxTorqueNm=0;
  m.appliedForceN=0;m.appliedHorizontalForceN=0;m.appliedTorqueNm=0;
 }
 actorSpheres(human,frames=null){
  const point=id=>frames?.get(id)?.p||human.byId.get(id)?.world?.p,metrics=human.bodyMetrics,out=[];
  const sphere=(id,p,r)=>{if(p)out.push({id,p:[...p],r});};
  const segment=(id,a,b,r,count)=>{if(a&&b)for(let i=0;i<count;i++){const t=(i+.5)/count;sphere(id+':'+i,a.map((v,k)=>v+(b[k]-v)*t),r);}};
  const hips=point('hips'),neck=point('neck')||point(human.spine?.at(-1)?.id),head=point('head');
  segment('torso',hips,neck,metrics.torsoRadiusM,3);
  if(head)sphere('head',[head[0],head[1]+metrics.headRadiusM*(.07/.105),head[2]],metrics.headRadiusM);
  for(const side of ['left','right']){
   segment(side+':upperArm',point(side+'_upperArm'),point(side+'_forearm'),metrics.armRadiusM,4);
   segment(side+':forearm',point(side+'_forearm'),point(side+'_hand'),metrics.armRadiusM*(.037/.047),4);
   segment(side+':thigh',point(side+'_femur'),point(side+'_tibia'),metrics.legRadiusM,4);
   segment(side+':shin',point(side+'_tibia'),point(side+'_foot'),metrics.legRadiusM*(.052/.069),4);
  }
  return out;
 }
 sphereObjectClearance(record,p,r,objectPose=null){
  const body=record.body,local=objectPose?this.quaternion(objectPose.q).conjugate().vmult(this.vector(p).vsub(this.vector(objectPose.p))):body.pointToLocalFrame(this.vector(p));let clearance=Infinity;
  for(let i=0;i<body.shapes.length;i++){
   const shape=body.shapes[i],q=body.shapeOrientations[i].conjugate(),v=q.vmult(local.vsub(body.shapeOffsets[i]));let d;
   if(shape.radius!=null)d=v.length()-shape.radius;
   else if(shape.halfExtents){const e=shape.halfExtents,x=Math.abs(v.x)-e.x,y=Math.abs(v.y)-e.y,z=Math.abs(v.z)-e.z;
    d=Math.hypot(Math.max(0,x),Math.max(0,y),Math.max(0,z))+Math.min(0,Math.max(x,y,z));
   }else if(shape.faceNormals&&shape.faces&&shape.vertices){
    // For convex primitives, the maximum supporting-plane distance is a
    // conservative lower bound outside edges/corners: positive clearance is
    // sufficient for separation, never an optimistic non-collision guess.
    d=-Infinity;for(let f=0;f<shape.faces.length;f++)d=Math.max(d,shape.faceNormals[f].dot(v.vsub(shape.vertices[shape.faces[f][0]])));
   }else throw Error('松手净空检查不支持此刚体形状');
   clearance=Math.min(clearance,d-r);
  }
  return clearance;
 }
 bodyObjectClearance(objectId,human,frames=null,objectPose=null){
  const record=this.bodies.get(objectId);if(!record)throw Error('身体净空检查物体缺少刚体');
  const rows=this.actorSpheres(human,frames).map(s=>({id:s.id,clearanceM:this.sphereObjectClearance(record,s.p,s.r,objectPose)}));
  if(!rows.length)throw Error('身体净空检查缺少人物碰撞代理');
  return{minimumClearanceM:Math.min(...rows.map(r=>r.clearanceM)),rows};
 }
 ownerClearance(objectId,agent,frames=null,includePhysical=false){
  const record=this.bodies.get(objectId);if(!record)throw Error('松手检查物体缺少刚体');
  const owner=this.ownerKey(agent.npcId),rows=this.actorSpheres(agent.h,frames).map(s=>{
   let clearanceM=this.sphereObjectClearance(record,s.p,s.r);
   const actual=includePhysical?this.actors.get(owner+':'+s.id):null;
   if(actual)clearanceM=Math.min(clearanceM,this.sphereObjectClearance(record,this.array(actual.body.position),s.r));
   return {id:s.id,clearanceM};
  });
  if(!rows.length)throw Error('松手检查缺少人物碰撞代理');
  return {minimumClearanceM:Math.min(...rows.map(r=>r.clearanceM)),rows};
 }
 syncFrozen(agents){
  const pausedIds=new Set(agents.filter(a=>(a?.paused||a?.error||a?.characterEditInProgress||a?.preflightWaiting)&&a?.held).map(a=>a.held.id));
  for(const [id,state]of this.frozen)if(!pausedIds.has(id)){
   const record=this.bodies.get(id);if(record){const b=record.body;b.type=state.type;b.mass=state.mass;b.updateMassProperties();
    b.velocity.copy(this.vector(state.v));b.angularVelocity.copy(this.vector(state.angularVelocity));
    b.force.setZero();b.torque.setZero();b.aabbNeedsUpdate=true;b.wakeUp();this.writePose(record,false);this.states.delete(id);}
   this.frozen.delete(id);
  }
  for(const id of pausedIds){const record=this.bodies.get(id);if(!record||this.frozen.has(id))continue;const b=record.body;
   this.frozen.set(id,{type:b.type,mass:b.mass,v:this.array(b.velocity),angularVelocity:this.array(b.angularVelocity),sleepState:b.sleepState,timeLastSleepy:b.timeLastSleepy});
   b.type=this.C.Body.KINEMATIC;b.velocity.setZero();b.angularVelocity.setZero();b.force.setZero();b.torque.setZero();
   b.updateMassProperties();b.wakeUp();b.aabbNeedsUpdate=true;this.writePose(record,false);
  }
 }
 applyManipulation(m,apply=true){
  const record=this.bodies.get(m.id),b=record?.body;if(!b)return;
  if(this.frozen.has(m.id)||m.separating){m.appliedForceN=0;m.appliedHorizontalForceN=0;m.appliedTorqueNm=0;return {force:[0,0,0],torque:[0,0,0]};}
  const error=m.p.map((v,i)=>v-this.array(b.position)[i]),velocity=this.array(b.velocity),omega=18;
  const k=b.mass*omega*omega,c=2*b.mass*omega;
  let force,torque=[0,0,0];
  if(m.type==='push'){
   const compression=error.reduce((v,e,i)=>v+e*m.direction[i],0),speed=velocity.reduce((v,e,i)=>v+e*m.direction[i],0);
   const targetSpeed=Math.max(0,m.targetVelocity.reduce((v,e,i)=>v+e*m.direction[i],0));
   const support=this.states.get(m.id),palmContact=compression>=-.004&&compression<=.08&&Math.hypot(...error)<=.10;
   let frictionFeedForwardN=0;
   if(palmContact&&support?.supported&&targetSpeed>1e-4){
    const supportFriction=Math.max(0,...support.supportIds.map(id=>id==='ground'?this.settings.groundFriction:this.bodies.get(id)?.object.friction||0));
    frictionFeedForwardN=(record.object.friction??.4)*supportFriction*b.mass*this.settings.gravityMps2;
   }
   // A palm may compress but never attract a separated object. Feed-forward is
   // gated by the established near-palm constraint, support and forward intent.
   const command=palmContact?k*compression+c*(targetSpeed-speed)+frictionFeedForwardN:0;
   const f=this.clamp(command,0,Math.min(m.maxForceN,m.maxHorizontalForceN));
   force=m.direction.map(v=>v*f);force[1]=0;m.appliedTorqueNm=0;
  }else{
   force=error.map((v,i)=>k*v+c*(m.targetVelocity[i]-velocity[i]));
   const target={...record.object,p:m.p,q:m.q},clearance=m.p[1]-objectWorldHalfExtents(target)[1];
   force[1]+=b.mass*this.settings.gravityMps2*this.clamp(clearance/.08,0,1);
   const horizontal=Math.hypot(force[0],force[2]);if(horizontal>m.maxHorizontalForceN){force[0]*=m.maxHorizontalForceN/horizontal;force[2]*=m.maxHorizontalForceN/horizontal;}
   const forceMagnitude=Math.hypot(...force);if(forceMagnitude>m.maxForceN)force=force.map(v=>v*m.maxForceN/forceMagnitude);
   const inverse=b.quaternion.conjugate(),rotation=this.quaternion(m.q).mult(inverse);rotation.normalize();
   if(rotation.w<0){rotation.x*=-1;rotation.y*=-1;rotation.z*=-1;rotation.w*=-1;}
   const halfSin=Math.hypot(rotation.x,rotation.y,rotation.z),angle=2*Math.atan2(halfSin,rotation.w);
   const inertia=Math.max(b.inertia.x,b.inertia.y,b.inertia.z,.0001),angular=this.array(b.angularVelocity);
   torque=[rotation.x,rotation.y,rotation.z].map((v,i)=>inertia*(100*(halfSin>1e-8?v/halfSin*angle:0)-20*angular[i]));
   if(m.supportPivotLocal&&this.states.get(m.id)?.supported&&Math.abs(clearance)<.015){
    const local=this.vector(m.supportPivotLocal),offset=b.quaternion.vmult(local),pivotY=b.position.y+offset.y;
    if(Math.abs(pivotY)<.015){
     // The ground reaction acts at the supported edge. Compensate the
     // moment of gravity plus the bounded translational actuator there;
     // retain the same muscle torque cap and no feed-forward in free flight.
     const r=[-offset.x,-offset.y,-offset.z],net=[force[0],force[1]-b.mass*this.settings.gravityMps2,force[2]];
     const moment=[r[1]*net[2]-r[2]*net[1],r[2]*net[0]-r[0]*net[2],r[0]*net[1]-r[1]*net[0]];
     torque=torque.map((v,i)=>v-moment[i]);
    }
   }
   const torqueMagnitude=Math.hypot(...torque);if(torqueMagnitude>m.maxTorqueNm)torque=torque.map(v=>v*m.maxTorqueNm/torqueMagnitude);
   if(apply)b.torque.vadd(this.vector(torque),b.torque);m.appliedTorqueNm=Math.hypot(...torque);
  }
  if(apply)b.applyForce(this.vector(force));m.appliedForceN=Math.hypot(...force);m.appliedHorizontalForceN=Math.hypot(force[0],force[2]);return {force,torque};
 }
 prepareActors(agentOrAgents,dt){
  const agents=Array.isArray(agentOrAgents)?agentOrAgents:[agentOrAgents],targets=[],owners=new Set();
  const presentOwners=new Set(agents.filter(a=>a?.h?.byId).map(a=>this.ownerKey(a.npcId)));
  for(const owner of this.actorGroups.keys())if(!presentOwners.has(owner)){this.actorGroups.delete(owner);this.actorRoots.delete(owner);this.actorHumans.delete(owner);}
  for(const agent of agents){
   const human=agent?.h;if(!human?.byId)continue;const ownerId=this.ownerKey(agent.npcId);owners.add(ownerId);
   if(human!==this.actorHumans.get(ownerId)){
    for(const [id,record]of this.actors)if(record.ownerId===ownerId){this.engine.removeBody(record.body);this.actors.delete(id);}
    this.actorHumans.set(ownerId,human);
   }
   if(!this.actorGroups.has(ownerId)){
    const used=new Set(this.actorGroups.values()),group=Array.from({length:8},(_,i)=>8<<i).find(bit=>!used.has(bit));
    if(!group)throw Error('物理碰撞代理最多支持八位人物');this.actorGroups.set(ownerId,group);
   }
   const group=this.actorGroups.get(ownerId);this.actorRoots.set(ownerId,agent.pos?[...agent.pos]:null);
   for(const s of this.actorSpheres(human))targets.push({...s,id:ownerId+':'+s.id,ownerId,group});
  }
  const active=new Set();
  for(const target of targets){
   active.add(target.id);this.finiteArray(target.p,3,'actor proxy');let record=this.actors.get(target.id);
   if(!record){const body=new this.C.Body({type:this.C.Body.KINEMATIC,mass:0,shape:new this.C.Sphere(target.r),
    material:this.material(.45,.02),collisionFilterGroup:target.group,collisionFilterMask:2});body.position.copy(this.vector(target.p));body.workbenchId='actor:'+target.id;
    record={body,ownerId:target.ownerId,target:[...target.p]};this.engine.addBody(body);this.actors.set(target.id,record);}
   const velocity=target.p.map((v,i)=>(v-record.target[i])/dt);
   // Edits/reset are discontinuities, not physical impacts generated by walking.
   if(Math.hypot(...velocity)>6){record.body.position.copy(this.vector(target.p));record.body.velocity.setZero();}
   else record.body.velocity.copy(this.vector(velocity));
   record.target=[...target.p];record.body.aabbNeedsUpdate=true;
  }
  for(const [id,record]of this.actors)if(!active.has(id)){this.engine.removeBody(record.body);this.actors.delete(id);}
  for(const owner of this.actorGroups.keys())if(!owners.has(owner)){this.actorGroups.delete(owner);this.actorRoots.delete(owner);this.actorHumans.delete(owner);}
  for(const manipulation of this.manipulations.values())if(!owners.has(manipulation.ownerId))this.clearManipulation(manipulation.id);
  for(const record of this.bodies.values())this.setCollisionFilter(record);
  this.engine.broadphase.dirty=true;
 }
 step(dt,agent){
  const agents=Array.isArray(agent)?agent:[agent];
  if(!Number.isFinite(dt)||Math.abs(dt-this.fixedDt)>1e-7)throw Error('物理系统必须以 1/120 秒固定步推进');
  this.syncScene();this.syncFrozen(agents);
  if(agents.length&&agents.every(a=>a&&(a.paused||a.error||a.characterEditInProgress)))return;
  this.prepareActors(agent,dt);let required=1;
  const actorSpeed=Math.max(0,...[...this.actors.values()].map(r=>r.body.velocity.length()));
  for(const record of this.bodies.values())if(record.body.type===this.C.Body.DYNAMIC){
   const b=record.body,speed=b.velocity.length()+b.angularVelocity.length()*b.boundingRadius+actorSpeed;
   const manipulation=this.manipulations.get(record.object.id),wrench=manipulation?this.applyManipulation(manipulation,false):null;
   const minInertia=Math.max(1e-8,Math.min(b.inertia.x,b.inertia.y,b.inertia.z));
   const acceleration=this.settings.gravityMps2+(wrench?Math.hypot(...wrench.force)/b.mass+Math.hypot(...wrench.torque)/minInertia*b.boundingRadius:0);
   required=Math.max(required,Math.ceil((speed*dt+acceleration*dt*dt/2)/(record.minFeature*.35)));
  }
  if(required>this.maxMicrosteps)throw Error('物理速度超过当前薄物体的安全步进范围，已拒绝本步');
  this.lastMicrosteps=required;this.maxPenetrationM=0;
  for(let i=0;i<required;i++){for(const manipulation of this.manipulations.values())this.applyManipulation(manipulation);this.engine.step(dt/required);this.microstepCount++;this.assertFinite();this.collectContacts();}
  for(const record of this.actors.values()){record.body.position.copy(this.vector(record.target));record.body.velocity.setZero();record.body.aabbNeedsUpdate=true;}
  for(const record of this.bodies.values())this.writePose(record);
  this.stepCount++;
 }
 collectContacts(){
  const next=new Map(),report=[];
  for(const [id,record]of this.bodies){const old=this.states.get(id),asleep=record.body.sleepState===this.C.Body.SLEEPING;
   next.set(id,{supportIds:new Set(asleep&&old?.supported?old.supportIds:[]),contactIds:new Set(asleep?old?.contactIds||[]:[])});}
  for(const contact of this.engine.contacts){
   if(!contact.enabled)continue;
   const a=contact.bi,b=contact.bj,aid=a.workbenchId,bid=b.workbenchId,normal=contact.ni;
   const pa=a.position.vadd(contact.ri),pb=b.position.vadd(contact.rj),penetration=Math.max(0,-pb.vsub(pa).dot(normal));
   this.maxPenetrationM=Math.max(this.maxPenetrationM,penetration);
   if(next.has(aid)){next.get(aid).contactIds.add(bid);if(normal.y<-.45&&!String(bid).startsWith('actor:'))next.get(aid).supportIds.add(bid);}
   if(next.has(bid)){next.get(bid).contactIds.add(aid);if(normal.y>.45&&!String(aid).startsWith('actor:'))next.get(bid).supportIds.add(aid);}
   if(report.length<64)report.push({a:aid,b:bid,penetrationM:penetration,normal:this.array(normal)});
   const features=[this.bodies.get(aid)?.minFeature,this.bodies.get(bid)?.minFeature].filter(Number.isFinite);
   const severe=Math.max(.05,Math.min(.15,(features.length?Math.min(...features):.2)*.3));
   if(penetration>severe)throw Error('物理碰撞穿透超过容差：'+aid+' / '+bid);
  }
  for(const [id,state]of next){const body=this.bodies.get(id).body,speedMps=body.velocity.length(),angularSpeedRadS=body.angularVelocity.length();
   this.states.set(id,{supported:state.supportIds.size>0,supportIds:[...state.supportIds],contactIds:[...state.contactIds],speedMps,angularSpeedRadS,
    settled:state.supportIds.size>0&&speedMps<.055&&angularSpeedRadS<.15,sleeping:body.sleepState===this.C.Body.SLEEPING});}
  this.contacts=report;
 }
 objectState(id){
  const record=this.bodies.get(id);if(!record)return null;
  const state=this.states.get(id)||{supported:false,supportIds:[],contactIds:[],settled:false,sleeping:false};
  const m=this.manipulations.get(id);
  const paused=this.frozen.has(id);
  return {...state,paused,supported:!paused&&state.supported,settled:!paused&&state.settled,supportIds:[...state.supportIds],contactIds:[...state.contactIds],speedMps:record.body.velocity.length(),angularSpeedRadS:record.body.angularVelocity.length(),
   gripErrorM:m?Math.hypot(...m.p.map((v,i)=>v-this.array(record.body.position)[i])):0,appliedForceN:paused?0:m?.appliedForceN||0,appliedTorqueNm:paused?0:m?.appliedTorqueNm||0,
   forceUtilization:!paused&&m?Math.max(m.appliedForceN/Math.max(1e-9,m.maxForceN),(m.appliedHorizontalForceN||0)/Math.max(1e-9,m.maxHorizontalForceN)):0,
   torqueUtilization:!paused&&m?m.appliedTorqueNm/Math.max(1e-9,m.maxTorqueNm):0};
 }
 assertFinite(){
  for(const record of this.bodies.values()){
   const b=record.body,values=[...this.array(b.position),...this.array(b.velocity),...this.array(b.angularVelocity),b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w];
   if(values.some(v=>!Number.isFinite(v))||b.position.length()>1e4)throw Error('物理状态出现非有限值：'+record.object.id);
  }
 }
 capture(){
  return {schema:'human-workbench/physics-checkpoint@1.0',stepCount:this.stepCount,microstepCount:this.microstepCount,time:this.engine.time,
   engineStepNumber:this.engine.stepnumber,lastMicrosteps:this.lastMicrosteps,revision:this.world.revision,
   manipulations:[...this.manipulations.values()].map(m=>structuredClone(m)),
   frozen:[...this.frozen].map(([id,state])=>[id,structuredClone(state)]),
   actorGroups:[...this.actorGroups],actorRoots:[...this.actorRoots].map(([id,p])=>[id,p&&[...p]]),
   bodies:[...this.bodies].map(([id,r])=>({id,p:this.array(r.body.position),q:[r.body.quaternion.x,r.body.quaternion.y,r.body.quaternion.z,r.body.quaternion.w],
    v:this.array(r.body.velocity),angularVelocity:this.array(r.body.angularVelocity),sleepState:r.body.sleepState,timeLastSleepy:r.body.timeLastSleepy,
    type:r.body.type,moveCount:r.object.moveCount,state:this.objectState(id)})),actors:[...this.actors].map(([id,r])=>({id,p:this.array(r.body.position),target:[...r.target]}))};
 }
 restore(snapshot){
  if(snapshot?.schema!=='human-workbench/physics-checkpoint@1.0')throw Error('物理回滚快照无效');
  this.syncScene();this.manipulations=new Map(snapshot.manipulations.map(m=>[m.id,structuredClone(m)]));this.states.clear();
  this.frozen=new Map(snapshot.frozen.map(([id,state])=>[id,structuredClone(state)]));
  this.actorGroups=new Map(snapshot.actorGroups);this.actorRoots=new Map(snapshot.actorRoots);
  for(const state of snapshot.bodies){const record=this.bodies.get(state.id);if(!record)continue;record.body.type=state.type;record.body.updateMassProperties();this.applyPose(record,state);
   record.body.sleepState=state.sleepState;record.body.timeLastSleepy=state.timeLastSleepy;record.object.moveCount=state.moveCount;
   this.states.set(state.id,{...state.state,supportIds:[...state.state.supportIds],contactIds:[...state.state.contactIds]});this.setCollisionFilter(record);}
  const actorStates=new Map(snapshot.actors.map(s=>[s.id,s]));
  for(const [id,record]of this.actors){const state=actorStates.get(id);if(!state){this.engine.removeBody(record.body);this.actors.delete(id);continue;}
   record.body.position.copy(this.vector(state.p));record.target=[...state.target];record.body.velocity.setZero();record.body.force.setZero();record.body.aabbNeedsUpdate=true;}
  this.stepCount=snapshot.stepCount;this.microstepCount=snapshot.microstepCount;this.engine.time=snapshot.time;this.world.revision=snapshot.revision;
  this.engine.stepnumber=snapshot.engineStepNumber;this.lastMicrosteps=snapshot.lastMicrosteps;
  this.resetContacts();this.assertFinite();
 }
 captureObjects(ids,ownerId=null){
  const selected=new Set(ids),owner=this.ownerKey(ownerId);
  return{schema:'human-workbench/physics-object-checkpoint@1.0',ownerId,
   manipulations:[...this.manipulations.values()].filter(m=>selected.has(m.id)&&m.ownerId===owner).map(m=>structuredClone(m)),
   frozen:[...this.frozen].filter(([id])=>selected.has(id)).map(([id,state])=>[id,structuredClone(state)]),
   bodies:[...this.bodies].filter(([id])=>selected.has(id)).map(([id,r])=>({id,p:this.array(r.body.position),
    q:[r.body.quaternion.x,r.body.quaternion.y,r.body.quaternion.z,r.body.quaternion.w],v:this.array(r.body.velocity),
    angularVelocity:this.array(r.body.angularVelocity),sleepState:r.body.sleepState,timeLastSleepy:r.body.timeLastSleepy,type:r.body.type,moveCount:r.object.moveCount,state:this.objectState(id)}))};
 }
 restoreObjects(snapshot,ids,ownerId=null){
  const selected=new Set(ids);if(!selected.size)return[];
  if(snapshot?.schema!=='human-workbench/physics-object-checkpoint@1.0'||snapshot.ownerId!==ownerId||!Array.isArray(snapshot.bodies)||!Array.isArray(snapshot.manipulations))throw Error('人物物体回滚快照无效');
  const population=this.world.population,restored=new Set(),owner=this.ownerKey(ownerId);
  // Actor rollback never rewinds the shared clock, other bodies or actor proxies.
  // An ownership change makes this old checkpoint ineligible for restoration.
  if(population?.physicsOwner&&population.physicsOwner!==ownerId)return[];
  const states=snapshot.bodies.filter(s=>{const record=this.bodies.get(s.id),manipulation=this.manipulations.get(s.id);return selected.has(s.id)&&record&&(!record.object.heldOwner||record.object.heldOwner===ownerId)&&(!manipulation||manipulation.ownerId===owner);});
  for(const state of states)for(const [key,n]of [['p',3],['q',4],['v',3],['angularVelocity',3]])this.finiteArray(state[key],n,state.id+' '+key);
  for(const state of states){const record=this.bodies.get(state.id);record.body.type=state.type;record.body.updateMassProperties();this.applyPose(record,state);
   record.body.sleepState=state.sleepState;record.body.timeLastSleepy=state.timeLastSleepy;record.object.moveCount=state.moveCount;
   if(state.state)this.states.set(state.id,structuredClone(state.state));else this.states.delete(state.id);restored.add(state.id);
  }
  const owns=m=>m&&restored.has(m.id)&&m.ownerId===this.ownerKey(ownerId);
  for(const m of this.manipulations.values())if(owns(m))this.manipulations.delete(m.id);
  for(const m of snapshot.manipulations)if(owns(m))this.manipulations.set(m.id,structuredClone(m));
  for(const id of restored)this.frozen.delete(id);
  for(const [id,state]of snapshot.frozen)if(restored.has(id))this.frozen.set(id,structuredClone(state));
  for(const id of restored)this.setCollisionFilter(this.bodies.get(id));
  this.contacts=this.contacts.filter(c=>!restored.has(c.a)&&!restored.has(c.b));
  this.engine.contacts=this.engine.contacts.filter(c=>!restored.has(c.bi.workbenchId)&&!restored.has(c.bj.workbenchId));
  this.engine.frictionEquations=this.engine.frictionEquations.filter(c=>!restored.has(c.bi.workbenchId)&&!restored.has(c.bj.workbenchId));
  this.engine.broadphase.dirty=true;
  return [...restored];
 }
 snapshot(){
  const manipulations=[...this.manipulations.values()].map(m=>({id:m.id,ownerId:m.ownerId,type:m.type,
   separating:!!m.separating,maxForceN:m.maxForceN,maxTorqueNm:m.maxTorqueNm,maxHorizontalForceN:m.maxHorizontalForceN,...this.objectState(m.id)}));
  return {schema:'human-workbench/rigid-body-physics@1.0',engine:'cannon-es',version:'0.20.0',units:'m,kg,s,N,Nm',
   fixedDtS:this.fixedDt,maxMicrosteps:this.maxMicrosteps,lastMicrosteps:this.lastMicrosteps,stepCount:this.stepCount,microstepCount:this.microstepCount,
   settings:{...this.settings},solver:{type:'Gauss-Seidel',iterations:this.engine.solver.iterations,tolerance:this.engine.solver.tolerance,frictionReduction:this.engine.narrowphase.enableFrictionReduction},
   bodies:this.bodies.size,dynamicBodies:[...this.bodies.values()].filter(r=>r.body.type===this.C.Body.DYNAMIC).length,actorProxies:this.actors.size,
   contacts:this.contacts.map(c=>({...c,normal:[...c.normal]})),maxPenetrationM:this.maxPenetrationM,
   manipulation:manipulations[0]||null,manipulations,frozenObjectIds:[...this.frozen.keys()],
   collisionGeometry:[...this.bodies].map(([id,r])=>({id,mode:r.approximation,shapes:r.body.shapes.length})),runtimeVerified:false,
   limitations:['Rigid objects only; MotionLab actor remains kinematic and cannot fall or balance through this solver.',
    'Sphere actor proxies exclude hands; active manipulation and its bounded zero-force withdrawal exclude only the contact owner until physical separation is verified. Other body impacts remain kinematic; actor-to-actor contact remains navigation driven.',
    'Paused held objects are temporarily kinematic; their saved velocities resume with their owner. This is an editor time pause, not physical support.',
    'Bounded adaptive substeps reduce tunnelling; continuous collision detection is not implemented.',
    'worktable, bench and shelf use matching compounds; other furniture uses declared conservative boxes. Inertia uses the engine bounding-box approximation.',
    'Finite floor and 8 m boundary walls; no deformable contact, fluid, fracture or runtime acceptance.']};
 }
}
