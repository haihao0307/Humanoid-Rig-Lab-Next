/* Basic locomotion R1. Authored controls informed by human gait references;
 * R2 refines continuity; see docs/ACTION_EXAMPLES_R2.md. Not imported mocap.
 * Owns contact targets and pose signals; Human.pose remains the only IK owner. */
const NATURAL_GAIT=Object.freeze({version:2,accelerationMps2:.8,decelerationMps2:1.1,
 speedResponseS:.20,brakeResponseS:.30,startTransferS:.16,maxTurnRadS:1.55,
 swingSlowS:.49,swingFastS:.40,doubleSupportSlowS:.12,doubleSupportFastS:.08,
 maxLandingLeadM:.31,maxFootReachM:.34,clearanceSlowM:.024,clearanceFastM:.050,
 toeOffRad:.18,heelStrikeRad:-.12,soleHeelM:LOWER_BODY_PLAN.foot.heelZ,soleToeM:LOWER_BODY_PLAN.foot.toeZ,
 pelvisYawRad:.046,pelvisRollRad:.022,swayM:.012,bobM:.008});

// Closed-form critically damped response: keep both position and velocity
// continuous when a new support leg or heading becomes the target.
function gaitResponse(state,key,target,responseS,dt){
 const velocityKey=key+'Velocity',velocity=state[velocityKey]||0;
 const omega=2/responseS,error=(state[key]||0)-target,j=velocity+omega*error,e=Math.exp(-omega*dt);
 state[key]=target+(error+j*dt)*e;state[velocityKey]=(velocity-omega*j*dt)*e;
 return state[key];
}

class NaturalLocomotion{
 constructor(agent){this.a=agent;this.velocity=0;this.speed=0;this.acceleration=0;
  this.startTime=0;this.state='standing';this.support=0;this.bob=0;this.armSignal=0;
  this.wait=NATURAL_GAIT.doubleSupportSlowS;this.elapsed=0;this.lastSpeed=0;
  this.turnTarget=0;this.lookYaw=0;this.turnLean=0;
  this.settled=true;this.sample={};this.contacts={left:'flat',right:'flat'};}
 remainingDistance(){const a=this.a;let distance=0,prev=a.pos;for(let i=a.routeIndex;i<a.route.length;i++){distance+=horizontal(prev,a.route[i]);prev=a.route[i];}return distance;}
 // Navigation stays on the collision-checked route. Brake before the destination;
 // preserve the positional endpoint and let the contact scheduler finish landing.
 move(dt,speed){
  const a=this.a,c=NATURAL_GAIT;
  while(a.routeIndex<a.route.length&&horizontal(a.pos,a.route[a.routeIndex])<.001)a.routeIndex++;
  if(a.routeIndex>=a.route.length){this.velocity=0;this.startTime=0;this.turnTarget=0;return false;}
  const end=a.route[a.routeIndex],d=[end[0]-a.pos[0],0,end[2]-a.pos[2]],distance=len(d);
  const wanted=Math.atan2(d[0],d[2]),turn=angleDiff(wanted,a.yaw);
  const next=a.route[a.routeIndex+1],corner=next?angleDiff(Math.atan2(next[0]-end[0],next[2]-end[2]),wanted):0;
  const cornerWeight=next?1-smoother(distance/.55):0;
  this.turnTarget=clamp(turn+corner*cornerWeight*.65,-.32,.32);
  // Do not twist a planted leg through a large turn: first take a placement step.
  const supportSide=a.swing?(a.swing.side==='left'?'right':'left'):null;
  let delta=clamp(turn*(1-Math.exp(-dt*8)),-c.maxTurnRadS*dt,c.maxTurnRadS*dt);
  if(supportSide){const twist=angleDiff(a.yaw+delta,a.feet[supportSide].yaw);if(Math.abs(twist)>.55&&Math.sign(delta)===Math.sign(twist))delta=0;}
  a.yaw+=delta;
  this.startTime+=dt;
  const readiness=smoother((this.startTime-c.startTransferS)/.22);
  const heading=smoother(clamp(1-Math.abs(turn)/1.25,0,1));
  const cornerSpeed=1-cornerWeight*(1-Math.max(.12,Math.cos(Math.abs(corner)*.5)**2));
  speed*=a.strength?.movementFactor()??1;
  const desired=Math.min(speed*cornerSpeed,this.remainingDistance()/c.brakeResponseS)*heading*readiness;
  const dv=(desired-this.velocity)*(1-Math.exp(-dt/c.speedResponseS));
  this.velocity=Math.max(0,this.velocity+clamp(dv,-c.decelerationMps2*dt,c.accelerationMps2*dt));
  const step=Math.min(distance,this.velocity*dt);
  a.pos[0]+=d[0]/distance*step;a.pos[2]+=d[2]/distance*step;
  this.state=readiness<1?'starting':desired<speed*.8?'braking':'walking';
  return true;
 }
 expected(side,moving,duration){
  const a=this.a,c=NATURAL_GAIT,s=side==='left'?-1:1;
  let lead=ADULT_STANCE.ankleForwardM;
  if(moving&&this.speed>.025){
   // Predict landing plus half of the following step's travel. Scale by actual
   // speed; facing-only turns use short placement steps and no walking arm pump.
   lead+=Math.min(c.maxLandingLeadM,this.speed*(duration+.5*(duration+this.wait)));
   if(a.routeIndex<a.route.length)lead=Math.min(lead,this.remainingDistance()+ADULT_STANCE.ankleForwardM);
  }
  return add([a.pos[0],SKIN_SOLE_HEIGHT,a.pos[2]],rotate(qy(a.yaw),[s*ADULT_STANCE.footHalfSpacingM,0,lead]));
 }
 needs(side){const a=this.a;return horizontal(a.feet[side].p,this.expected(side,false,0))>.018||Math.abs(angleDiff(a.yaw,a.feet[side].yaw))>.06;}
 isSettled(){return !this.a.swing&&!this.needs('left')&&!this.needs('right')&&this.speed<.018;}
 update(dt,moving,measuredSpeed=null){
  const a=this.a,c=NATURAL_GAIT;this.elapsed+=dt;
  const measured=measuredSpeed===null?0:measuredSpeed;
  this.speed+=(measured-this.speed)*(1-Math.exp(-dt*10));
  const rawAcceleration=(this.speed-this.lastSpeed)/Math.max(dt,.00001);this.lastSpeed=this.speed;
  this.acceleration+=(clamp(rawAcceleration,-1.1,.8)-this.acceleration)*(1-Math.exp(-dt*6));
  const pace=clamp(this.speed/.8,0,1),duration=c.swingSlowS+(c.swingFastS-c.swingSlowS)*pace;
  this.wait=c.doubleSupportSlowS+(c.doubleSupportFastS-c.doubleSupportSlowS)*pace;
  for(const side of ['left','right']){delete a.feet[side].q;this.contacts[side]='flat';}
  a.sinceStep+=dt;
  if(a.swing){
   const sw=a.swing,ft=a.feet[sw.side];sw.t+=dt;const t=clamp(sw.t/sw.duration,0,1);
   const u=clamp((t-.08)/.84,0,1),air=smooth(u);
   const pitch=t<.08?c.toeOffRad*smoother(t/.08):t>.92?c.heelStrikeRad*(1-smoother((t-.92)/.08)):c.toeOffRad+(c.heelStrikeRad-c.toeOffRad)*air;
   // Peak clearance arrives in early swing, then the leg extends toward contact.
   // Cubic travel avoids the concentrated mid-swing speed of the old quintic.
   const lift=sw.clearance*(u/.4)**2*((1-u)/.6)**3;
   const flat=mix(sw.from,sw.to,air);ft.yaw=sw.fromYaw+angleDiff(sw.toYaw,sw.fromYaw)*air;
   // Roll about a fixed sole edge. Its conservative support proxy also keeps
   // the swinging sole above the floor while the ankle changes orientation.
   const pivotZ=c.soleToeM+(c.soleHeelM-c.soleToeM)*smoother((u-.2)/.6);
   const pivot=[0,-SKIN_SOLE_HEIGHT,pivotZ];
   const offset=rotate(qy(ft.yaw),sub(pivot,rotate(qx(pitch),pivot)));
   // During flight the pivot shifts smoothly rather than switching at pitch=0.
   // Account for the lowest end of the sole proxy while it is off the ground.
   const floorLift=Math.max(0,Math.sin(pitch)*((pitch>=0?c.soleToeM:c.soleHeelM)-pivotZ));
   ft.p=add(flat,offset);ft.p[1]+=lift+floorLift;ft.q=qm(qy(ft.yaw),qx(pitch));
   this.contacts[sw.side]=t<.08?'toe':t>.92?'heel':'swing';
   if(t>=1){ft.p=[...sw.to];ft.yaw=sw.toYaw;delete ft.q;this.contacts[sw.side]='flat';a.swing=null;a.nextFoot=sw.side==='left'?'right':'left';a.sinceStep=0;}
  }
  if(!a.swing&&a.sinceStep>=this.wait){
   let side=a.nextFoot;if(!moving&&!this.needs(side))side=side==='left'?'right':'left';
   const turning=Math.abs(angleDiff(a.yaw,a.feet[side].yaw))>.06;
   if((moving&&(this.speed>.035||turning))||this.needs(side)){
    const from=[...a.feet[side].p],to=this.expected(side,moving,duration),travel=horizontal(from,to);
    // Bound relative to the current pelvis, not the previous foot position:
    // limiting each foot's travel would accumulate lag over a long route.
    const reach=horizontal(a.pos,to);
    if(reach>c.maxFootReachM){const d=sub(to,a.pos);to[0]=a.pos[0]+d[0]*c.maxFootReachM/reach;to[2]=a.pos[2]+d[2]*c.maxFootReachM/reach;}
    a.swing={side,from,to,fromYaw:a.feet[side].yaw,toYaw:a.yaw,t:0,duration,
     clearance:(c.clearanceSlowM+(c.clearanceFastM-c.clearanceSlowM)*pace)*clamp(travel/.12,.35,1)};
   }
  }
  const localL=rotate(inv(qy(a.yaw)),sub(a.feet.left.p,a.pos)),localR=rotate(inv(qy(a.yaw)),sub(a.feet.right.p,a.pos));
  a.gaitSignal+=(clamp((localL[2]-localR[2])/.30,-1,1)-a.gaitSignal)*(1-Math.exp(-dt*14));
  a.gaitBlend+=(clamp(this.speed/.5,0,1)-a.gaitBlend)*(1-Math.exp(-dt*8));
  gaitResponse(this,'armSignal',a.gaitSignal,.13,dt);
  const swingSide=a.swing?.side||a.nextFoot,weight=swingSide==='left'?1:-1;
  const activity=moving||a.swing||this.needs('left')||this.needs('right');
  gaitResponse(this,'support',activity?weight:0,.14,dt);
  const progress=a.swing?clamp(a.swing.t/a.swing.duration,0,1):0;
  gaitResponse(this,'bob',a.swing?Math.sin(Math.PI*progress)**2:0,.10,dt);
  gaitResponse(this,'lookYaw',moving?this.turnTarget:0,.16,dt);
  gaitResponse(this,'turnLean',moving?-this.turnTarget*this.speed*.055:0,.20,dt);
  this.settled=this.isSettled();
  if(!moving){this.velocity=0;this.startTime=0;this.state=this.settled?'standing':'settling';}
  const blend=a.gaitBlend,signal=a.gaitSignal*blend;
  this.sample={pelvisYaw:signal*c.pelvisYawRad,pelvisRoll:this.support*c.pelvisRollRad*blend+this.turnLean,
   sway:this.support*c.swayM,bob:this.bob*c.bobM*blend,
   lean:clamp(this.acceleration*.028,-.02,.025),armSignal:this.armSignal,lookYaw:this.lookYaw,
   idleRoll:Math.sin(a.time*.63)*.0018*(1-blend),idleYaw:Math.sin(a.time*.41)*.002*(1-blend)};
  a.walkSpeed=this.speed;
 }
 report(){return{version:NATURAL_GAIT.version,state:this.state,speedMps:this.speed,accelerationMps2:this.acceleration,
  contacts:{...this.contacts},doubleSupport:!this.a.swing,settled:this.settled,
  source:'authored contact controller informed by published gait research',mocapRetargeted:false};}
}
