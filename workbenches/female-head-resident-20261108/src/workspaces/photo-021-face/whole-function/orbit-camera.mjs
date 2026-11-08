// Rotate the camera around the unchanged native function surface. Coordinates
// are millimetres and the original perspective calibration remains the base.
export function orbitCamera(item, size, {yaw = 0, pitch = 0, zoom = 1, x = .5, y = .5} = {}) {
  if (!item?.camera || !Number.isInteger(size) || size < 64 || size > 2048 ||
      ![yaw,pitch,zoom,x,y].every(Number.isFinite) || Math.abs(pitch) > 60 ||
      zoom < 1 || zoom > 4 || x < 0 || x > 1 || y < 0 || y > 1) {
    throw Error('观察相机参数无效');
  }
  const base = item.camera, factor = size / item.size, a = yaw*Math.PI/180, b = pitch*Math.PI/180;
  const ca=Math.cos(a), sa=Math.sin(a), cb=Math.cos(b), sb=Math.sin(b);
  // Q = yaw(Y) * pitch(X): apply exactly the same rotation to eye and basis.
  const q = [[ca,sa*sb,sa*cb],[0,cb,-sb],[-sa,ca*sb,ca*cb]];
  // The front camera looks down the z axis. 20 mm is near the head volume
  // centre; pivoting around the nose surface pushes the skull off screen.
  const pivot = [0,294,20], delta = base.eyeNativeMM.map((v,i)=>v-pivot[i]);
  const eye = q.map((row,i)=>pivot[i]+row.reduce((s,v,j)=>s+v*delta[j],0));
  const rotation = base.rotationCV.map(row=>q.map(axis=>row.reduce((s,v,j)=>s+v*axis[j],0)));
  const translation = rotation.map(row=>-row.reduce((s,v,i)=>s+v*eye[i],0));
  return {...base,eyeNativeMM:eye,rotationCV:rotation,translationCVMM:translation,
    focalPX:base.focalPX*factor*zoom,
    principalPointPX:[(base.principalPointPX[0]*factor-x*size)*zoom+size*.5,
                      (base.principalPointPX[1]*factor-y*size)*zoom+size*.5],
    id:'photo021-interactive-orbit'};
}
