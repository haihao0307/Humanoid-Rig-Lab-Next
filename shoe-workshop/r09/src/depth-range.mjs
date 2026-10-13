import * as T from 'three';
/** Allocate depth precision to the actual shoe, not an almost-zero near plane.
 * No arbitrary render order, polygon offset, or missing lower surface.
 */
export function installShoeDepthRange(A,isActive){
 const renderer=A.renderer,previous=renderer.render.bind(renderer),box=new T.Box3(),corners=Array.from({length:8},()=>new T.Vector3());let last=null;
 renderer.render=function(scene,camera){
  if(isActive()&&scene===A.scene&&camera===A.camera&&renderer.getRenderTarget()===null){
   A.root.updateWorldMatrix(true,true);camera.updateMatrixWorld(true);box.makeEmpty();for(const o of A.root.children)if(o.visible&&o.isMesh&&!o.name.startsWith('STITCH_')&&o.name!=='READ_ONLY_NATIVE_LAST')box.expandByObject(o);
   if(!box.isEmpty()){
    for(let i=0;i<8;i++)corners[i].set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).applyMatrix4(camera.matrixWorldInverse);
    const ds=corners.map(p=>-p.z),min=Math.min(...ds),max=Math.max(...ds),target=camera.position.distanceTo(A.control.target),near=Math.max(.2,Math.min(Math.max(.2,min*.6),Math.max(.2,target*.12))),far=Math.max(near+20,max+2000);
    if(camera.near!==near||camera.far!==far){camera.near=near;camera.far=far;camera.updateProjectionMatrix();}
    const precision24=z=>(far-near)*z*z/(far*near*(2**24-1));last={near,far,closestBoxDepth:min,farthestBoxDepth:max,targetDistance:target,estimated24BitDepthStepAtShoeMm:precision24(Math.max(near,max)),old04mmNearStepMm:(12000-.04)*Math.max(near,max)**2/(12000*.04*(2**24-1)),policy:'actual visible bounds; no depth offset'};
   }
  }
  return previous(scene,camera);
 };
 return()=>last;
}
