// Metres, kilograms, seconds; serialized state is independent of engine handles.
function worldPhysicsVector(value,fallback,limit,label){
 if(value==null)return [...fallback];
 if(!Array.isArray(value)||value.length!==3||value.some(v=>!Number.isFinite(v)||Math.abs(v)>limit))throw Error(label+' 必须是有限的三维向量');
 return [...value];
}
function worldPhysicsQuaternion(value,yaw=0){
 if(value==null)return qy(yaw);
 if(!Array.isArray(value)||value.length!==4||value.some(v=>!Number.isFinite(v)||Math.abs(v)>1.001)||Math.hypot(...value)<.001)throw Error('物体旋转四元数无效');
 return qnorm(value);
}
function worldPhysicsSettings(value={}){
 const result={gravityMps2:value.gravityMps2??9.81,groundFriction:value.groundFriction??.65};
 if(!Number.isFinite(result.gravityMps2)||result.gravityMps2<.1||result.gravityMps2>30)throw Error('重力加速度需要在 0.1 至 30 m/s² 之间');
 if(!Number.isFinite(result.groundFriction)||result.groundFriction<0||result.groundFriction>2)throw Error('地面摩擦系数需要在 0 至 2 之间');
 return result;
}
function objectTilted(o){return Math.abs(rotate(o.q||qy(o.yaw||0),[0,1,0])[1])<.9999;}
function objectWorldHalfExtents(o){
 if(o.shape==='sphere')return [o.r,o.r,o.r];
 const half=o.shape==='box'?[o.w/2,o.h/2,o.d/2]:[o.r,o.h/2,o.r],q=o.q||qy(o.yaw||0);
 const axes=[[1,0,0],[0,1,0],[0,0,1]].map(a=>rotate(q,a));
 return [0,1,2].map(k=>axes.reduce((v,a,i)=>v+Math.abs(a[k])*half[i],0));
}
function objectProjectedRadius(o,direction){
 if(o.shape==='sphere')return o.r;
 const local=rotate(inv(o.q||qy(o.yaw||0)),direction);
 if(o.shape==='box')return Math.abs(local[0])*o.w/2+Math.abs(local[1])*o.h/2+Math.abs(local[2])*o.d/2;
 return Math.hypot(local[0],local[2])*o.r+Math.abs(local[1])*o.h/2;
}
function objectBottomOffset(o){
 if(o.shape==='box'||o.shape==='sphere')return objectWorldHalfExtents(o)[1];
 const q=o.q||qy(o.yaw||0),count=o.shape==='prism'?3:36;let lowest=Infinity;
 for(let i=0;i<count;i++)for(const y of [-1,1]){
  const r=o.shape==='cone'&&y===1?0:o.r;
  lowest=Math.min(lowest,rotate(q,[Math.cos(i*2*Math.PI/count)*r,y*o.h/2,Math.sin(i*2*Math.PI/count)*r])[1]);
 }
 return -lowest;
}
function worldPlacementOverlap(a,b){
 if(a.collidable===false||b.collidable===false)return false;
 const axesFor=o=>[[1,0,0],[0,1,0],[0,0,1]].map(axis=>rotate(o.q||qy(o.yaw||0),axis));
 const A=axesFor(a),B=axesFor(b),axes=[...A,...B,...A.flatMap(x=>B.map(y=>cross(x,y))),sub(a.p,b.p)],delta=sub(a.p,b.p);
 // Conservative authoring envelopes; touching/supporting faces are allowed.
 // Runtime contacts use engine primitive/compound shapes instead.
 return axes.every(axis=>{if(len(axis)<1e-7)return true;const n=norm(axis);return objectProjectedRadius(a,n)+objectProjectedRadius(b,n)-Math.abs(dot(delta,n))>.015;});
}
