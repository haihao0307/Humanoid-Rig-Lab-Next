/* R2 binding uses the atlas domain membership and the SAME source pivots as
 * the live skeleton. Spatial blending is confined to anatomically adjacent
 * chains. DQS is an approximation, not a measured soft-tissue deformation. */
function compactSourceRig(human){
 const frames=human.canonicalSourceBind,segments=new Map(),jointIds=new Map(human.joints.map((j,i)=>[j.id,i]));
 if(!(frames instanceof Map))throw Error('缺少未缩放的同源绑定骨架');
 const pos=id=>frames.get(id).p;
 for(const side of ['left','right']){
  const rays=kind=>Array.from({length:5},(_,f)=>{
   const ids=[side+'_'+(kind==='finger'?'metacarpal_':'metatarsal_')+(f+1),...Array.from({length:f===0?2:3},(_,k)=>side+'_'+kind+'_'+(f+1)+'_'+(k+1))];
   const points=ids.map(pos);points.push(R2_RIG.nodes[ids.at(-1)].tipM);return {ids,points};
  });
  segments.set(side,{shoulder:pos(side+'_upperArm'),elbow:pos(side+'_forearm'),wrist:pos(side+'_hand'),
   hip:pos(side+'_femur'),knee:pos(side+'_tibia'),ankle:pos(side+'_foot'),fingers:rays('finger'),toes:rays('toe'),
   shoulderRadius:R2_RIG.sphereFits[side+'_humerus'].radiusM,hipRadius:R2_RIG.sphereFits[side+'_femur'].radiusM});
 }
 return {frames,personalFrames:human.sourceBind,shapeReference:{nodes:R2_RIG.nodes,sourceFloorM:R2_RIG.sourceFloorM,sourceHeightM:R2_RIG.sourceHeightM},segments,jointIds,shape:{...human.characterPreset.shape},coordinateSpace:'canonical-r2-reference-metres',jointNames:human.joints.map(j=>j.id),spine:[['hips',pos('hips')[1]],...human.spine.map(j=>[j.id,pos(j.id)[1]]),['head',pos('head')[1]]]};
}
/*__COMPACT_BINDING_CORE__*/
function r2DeformPoint(p,influences,transforms){
 // Same normalized DQS as the shader, with scalar accumulators. Support
 // queries run at the physics rate; per-influence vector arrays caused GC
 // and made a two-person gesture exceed the frame budget.
 let x=0,y=0,z=0,w=0,dx=0,dy=0,dz=0,dw=0;
 const reference=transforms[influences[0][0]].q;
 for(let k=0;k<influences.length;k++){
  const row=influences[k],t=transforms[row[0]],q=t.q,d=t.d;
  const weight=row[1]*(reference[0]*q[0]+reference[1]*q[1]+reference[2]*q[2]+reference[3]*q[3]<0?-1:1);
  x+=q[0]*weight;y+=q[1]*weight;z+=q[2]*weight;w+=q[3]*weight;
  dx+=d[0]*weight;dy+=d[1]*weight;dz+=d[2]*weight;dw+=d[3]*weight;
 }
 const scale=1/Math.hypot(x,y,z,w);x*=scale;y*=scale;z*=scale;w*=scale;dx*=scale;dy*=scale;dz*=scale;dw*=scale;
 const parallel=x*dx+y*dy+z*dz+w*dw;dx-=x*parallel;dy-=y*parallel;dz-=z*parallel;dw-=w*parallel;
 const px=p[0],py=p[1],pz=p[2],tx=2*(y*pz-z*py),ty=2*(z*px-x*pz),tz=2*(x*py-y*px);
 return [px+w*tx+y*tz-z*ty+2*(w*dx-dw*x+y*dz-z*dy),
  py+w*ty+z*tx-x*tz+2*(w*dy-dw*y+z*dx-x*dz),
  pz+w*tz+x*ty-y*tx+2*(w*dz-dw*z+x*dy-y*dx)];
}
