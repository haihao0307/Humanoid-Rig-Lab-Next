import {WORLD,bounds,circleOverlaps,supportAt} from './game-world.mjs';
export const MOVEMENT=Object.freeze({walkSpeed:1.65,runSpeed:4.2,gravity:20,jumpHeight:1.02,radius:.25,height:1.8,stepHeight:.2,anticipation:.30,landingDuration:.36,coyoteTime:.09,jumpBuffer:.14});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export class CharacterController {
 constructor(world=WORLD){this.world=world;this.movement={...MOVEMENT};this.keys=new Set();this.reset();}
 setBodyMetrics({height,radius,scale}){if(![height,radius,scale].every(Number.isFinite)||height<1.6||height>2.05||radius<=0||scale<=0)throw Error('Invalid body collision metrics');this.movement={...MOVEMENT,height,radius,jumpHeight:MOVEMENT.jumpHeight*scale};}
 reset(){Object.assign(this,this.world.spawn,{vx:0,vz:0,vy:0,speed:0,grounded:true,support:'ground',phase:'idle',phaseTime:0,turnRate:0,turnError:0,buffer:0,coyote:0,landImpact:0,accumulator:0,time:0,jumpCount:0,landings:[],blocked:false});this.keys.clear();}
 press(code,repeat=false){if(code==='Space'){if(!repeat&&!this.keys.has(code))this.buffer=MOVEMENT.jumpBuffer;}this.keys.add(code);}
 release(code){this.keys.delete(code);}
 clearInput(){this.keys.clear();this.buffer=0;}
 launchJump(){this.vy=Math.sqrt(2*this.movement.gravity*this.movement.jumpHeight);this.grounded=false;this.phase='takeoff';this.phaseTime=0;this.jumpCount++;}
 update(dt){this.accumulator+=clamp(dt,0,.1);while(this.accumulator>=1/120){this.tick(1/120);this.accumulator-=1/120;}}
 tick(dt){
  const m=this.movement,p=this;this.time+=dt;this.phaseTime+=dt;this.buffer=Math.max(0,this.buffer-dt);this.coyote=this.grounded?m.coyoteTime:Math.max(0,this.coyote-dt);
  let dx=Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA')),dz=Number(this.keys.has('KeyS'))-Number(this.keys.has('KeyW'));const inputLength=Math.hypot(dx,dz);if(inputLength){dx/=inputLength;dz/=inputLength;}
  const targetSpeed=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?m.runSpeed:m.walkSpeed;
  const requestedYaw=inputLength?Math.atan2(dx,dz):this.yaw,pivotScale=1-.65*clamp((Math.abs(angleDelta(this.yaw,requestedYaw))-.6*Math.PI)/(.4*Math.PI),0,1);
  const acceleration=this.grounded?(targetSpeed>2?8:10):12,blend=1-Math.exp(-acceleration*dt);
  this.vx+=(dx*targetSpeed*pivotScale-this.vx)*blend;this.vz+=(dz*targetSpeed*pivotScale-this.vz)*blend;
  // Face the requested direction first, including a sudden 180-degree pivot.
  const oldYaw=this.yaw;if(inputLength){const target=Math.atan2(dx,dz);this.turnError=angleDelta(this.yaw,target);const desiredRate=clamp(this.turnError*10,-(targetSpeed>2?6:5),(targetSpeed>2?6:5)),rate=this.turnRate+(desiredRate-this.turnRate)*(1-Math.exp(-dt*18)),step=rate*dt;this.yaw+=Math.abs(step)>Math.abs(this.turnError)?this.turnError:step;}else{this.turnError=0;this.yaw+=this.turnRate*Math.exp(-dt*20)*dt;}
  this.turnRate=(this.yaw-oldYaw)/dt;
  if(this.buffer>0&&(this.grounded||this.coyote>0)&&this.phase!=='anticipation'){
   this.buffer=0;this.coyote=0;this.phase='anticipation';this.phaseTime=0;
   if(!this.grounded)this.launchJump();
  }
  if(this.phase==='anticipation'&&this.phaseTime>=m.anticipation)this.launchJump();
  const oldX=this.x,oldZ=this.z,oldY=this.y;this.x+=this.vx*dt;this.z+=this.vz*dt;
  this.blocked=false;
  // Small fixed substeps prevent tunnelling; the horizontal footprint is round.
  for(let pass=0;pass<3;pass++)for(const b of this.world.boxes){
   if(this.y>=b.height-1e-5||this.y+m.height<=0||!circleOverlaps(this.x,this.z,m.radius,b))continue;
   if(this.grounded&&b.height-this.y<=m.stepHeight+1e-5){this.y=b.height;continue;}
   const a=bounds(b),cx=clamp(this.x,a.minX,a.maxX),cz=clamp(this.z,a.minZ,a.maxZ);let nx=this.x-cx,nz=this.z-cz,d=Math.hypot(nx,nz);
   if(d<1e-8){const distances=[this.x-a.minX,a.maxX-this.x,this.z-a.minZ,a.maxZ-this.z],k=distances.indexOf(Math.min(...distances));[nx,nz]=[[-1,0],[1,0],[0,-1],[0,1]][k];d=-distances[k];}else{nx/=d;nz/=d;}
   this.x+=nx*(m.radius-d+1e-6);this.z+=nz*(m.radius-d+1e-6);const into=this.vx*nx+this.vz*nz;if(into<0){this.vx-=into*nx;this.vz-=into*nz;}this.blocked=true;
  }
  const limit=this.world.limit-m.radius;this.x=clamp(this.x,-limit,limit);this.z=clamp(this.z,-limit,limit);
  if(this.grounded){const s=supportAt(this.x,this.z,this.y+m.stepHeight,this.world);if(this.y-s.height<=m.stepHeight+1e-5){this.y=s.height;this.support=s.id;}else{if(this.phase==='anticipation')this.launchJump();else{this.grounded=false;this.phase='fall';this.phaseTime=0;}}}
  if(!this.grounded){
   this.vy-=m.gravity*dt;const nextY=this.y+this.vy*dt;
   // A descending feet plane may land only on a top it actually crosses.
   const s=supportAt(this.x,this.z,this.y+1e-5,this.world);
   if(this.vy<=0&&nextY<=s.height){this.landImpact=-this.vy;this.y=s.height;this.vy=0;this.grounded=true;this.support=s.id;this.phase='landing';this.phaseTime=0;this.landings.push({time:this.time,height:s.height,id:s.id,impact:this.landImpact});if(this.landings.length>20)this.landings.shift();}
   else{this.y=nextY;if(this.phase==='takeoff'&&this.phaseTime>.09){this.phase='flight';this.phaseTime=0;}if(this.vy<0&&this.phase!=='fall'){this.phase='fall';this.phaseTime=0;}}
  }
  this.speed=Math.hypot(this.x-oldX,this.z-oldZ)/dt;
  if(this.grounded&&this.phase!=='anticipation'&&(this.phase!=='landing'||this.phaseTime>m.landingDuration)){this.phase=this.speed>.12?(this.speed>2.6?'run':'walk'):'idle';}
  if(this.y<-5||![this.x,this.y,this.z,this.yaw].every(Number.isFinite))this.reset();
 }
 snapshot(){return Object.fromEntries(['x','y','z','yaw','vx','vz','vy','speed','grounded','support','phase','phaseTime','turnRate','turnError','landImpact','jumpCount','blocked'].map(k=>[k,this[k]]));}
}
