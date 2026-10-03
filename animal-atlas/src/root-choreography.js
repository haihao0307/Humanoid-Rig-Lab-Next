// Allocation-free simultaneous root motion. This is authored staging, not ecology.
export function stepRoots(actors,elapsed,dt,byId){
 byId.clear();for(const a of actors){byId.set(a.id,a);a._priorX=a.position.x;a._priorZ=a.position.z;}
 for(const a of actors){const target=byId.get(a.target);if(!target||a.mode==='still')continue;
  const px=target._priorX,pz=target._priorZ,dx=px-a._priorX,dz=pz-a._priorZ,distance=Math.hypot(dx,dz);
  if(a.mode==='orbit'){a.position.x=px+Math.cos(elapsed*a.speed)*3;a.position.z=pz+Math.sin(elapsed*a.speed)*3;}
  else if(a.mode!=='face'){const desired=a.mode==='follow'?2:a.mode==='avoid'?4:1.4;let amount=0;if(a.mode==='avoid'&&distance<desired)amount=-a.speed*dt;else if(a.mode!=='avoid'&&distance>desired)amount=Math.min(a.speed*dt,distance-desired);if(amount){const inv=distance<.001&&a.mode==='avoid'?0:1/distance;a.position.x+=amount*(inv?dx*inv:1);a.position.z+=amount*(inv?dz*inv:0);}}
  a.position.x=Math.max(-14,Math.min(14,a.position.x));a.position.z=Math.max(-14,Math.min(14,a.position.z));a.root.position.copy(a.position);a.root.scale.setScalar(a.scale);if(distance>.001)a.root.rotation.y=Math.atan2(px-a.position.x,pz-a.position.z)+a.yaw*Math.PI/180;
 }
}
