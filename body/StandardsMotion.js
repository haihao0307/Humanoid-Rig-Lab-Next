/* Public drill specification -> anatomical contact targets. This is a
 * standards-guided IK gesture, not a measured motion-capture sequence. */
const R2_SALUTE_STANDARD=Object.freeze({
 id:'pla-drill-2025-uncovered-salute',kind:'published-action-standard',
 source:'https://tyjr.sh.gov.cn/shtyjrswj/sjxx/20250303/47c374e6242e45ef86a585cd3e63792f.html',
 section:'第十七条：敬礼、礼毕和单个军人敬礼',palmOutwardDegrees:20,
 targets:['upright torso','right upper arm near shoulder height','middle fingertip near the uncovered temple','palm down with an outward turn'],
 landmark:{sourcePartIds:['FJ3386','FJ1376'],
  sourceSurfaceManifestSHA256:'80333a490df6a3685a686330114af7b8fcd1aac704e67d41891313e4ea660264',
  positionM:[.0739894,1.54974,.133736],surfaceClearanceM:.006,
  method:'right temporal lateral/anterior bounds and supraorbital height; static landmark proxy, not a measured skin contact'},
 defaultDurationS:3,transition:'smooth approach and release; timing is an engineering choice',
 fingers:'atlas finger shape retained; no independently measured finger-adduction recording',
 motionCaptured:false,visualAcceptance:false
});
function r2SaluteGoal(h,yaw){
 const side='right',arm=h.arms[side],sourceHand=h.sourceBind.get('right_hand'),sourceHead=h.sourceBind.get('head');
 const fingerNode=h.resolvedRig.nodes.right_finger_3_3;
 const tipLocal=rotate(inv(sourceHand.q),sub(fingerNode.tipM,sourceHand.p));
 const landmark=mul(add(R2_SALUTE_STANDARD.landmark.positionM,[R2_SALUTE_STANDARD.landmark.surfaceClearanceM,0,0]),h.bodyMetrics.statureScale);
 const headLocal=rotate(inv(sourceHead.q),sub(landmark,sourceHead.p)),temple=point(h.world('head'),headLocal);
 const S=arm.upper.world.p,axis=norm(sub(temple,S)),distance=dist(temple,S),handLength=len(tipLocal),distal=arm.L2+handLength;
 const along=clamp((arm.L1*arm.L1-distal*distal+distance*distance)/(2*Math.max(distance,1e-6)),-arm.L1,arm.L1);
 const out=rotate(qy(yaw),[1,0,0]),pole=norm(sub(out,mul(axis,dot(out,axis))));
 const elbow=add(S,add(mul(axis,along),mul(pole,Math.sqrt(Math.max(0,arm.L1*arm.L1-along*along)))));
 const fingerDirection=norm(sub(temple,elbow)),wrist=sub(temple,mul(fingerDirection,handLength));
 const sourceAcross=rotate(inv(sourceHand.q),sub(h.resolvedRig.nodes.right_metacarpal_5.positionM,h.resolvedRig.nodes.right_metacarpal_2.positionM));
 const sourceFinger=norm(tipLocal);let sourceNormal=norm(cross(sourceAcross,sourceFinger));
 if(dot(rotate(sourceHand.q,sourceNormal),[0,0,1])<0)sourceNormal=mul(sourceNormal,-1);
 const sourceBasis=qb(norm(cross(sourceFinger,sourceNormal)),sourceFinger,sourceNormal);
 let palmNormal=norm(sub([0,-1,0],mul(fingerDirection,dot([0,-1,0],fingerDirection))));
 palmNormal=rotate(aa(fingerDirection,radians(R2_SALUTE_STANDARD.palmOutwardDegrees)),palmNormal);
 const targetBasis=qb(norm(cross(fingerDirection,palmNormal)),fingerDirection,palmNormal),q=qm(targetBasis,inv(sourceBasis));
 return {p: add(wrist,rotate(q,h.bodyMetrics.palmContact)),q,elbow,temple,tipLocal};
}
function r2SaluteDescriptor(h,g,weight){
 const base=g.base,goal=g.goal;
 return {...base,reference:g.fromMotion,
  hands:Object.fromEntries(Object.entries({...base.hands,right:frame(mix(base.hands.right.p,goal.p,weight),qslerp(base.hands.right.q,goal.q,weight))}).map(([side,f])=>[side,{...f,space:'body'}])),
  armPoles:{...base.armPoles,right:mix(base.armPoles.right,goal.elbow,weight)},kind:'salute',
  motionSource:{kind:'standard',id:R2_SALUTE_STANDARD.id,source:R2_SALUTE_STANDARD.source,motionCaptured:false}};
}
