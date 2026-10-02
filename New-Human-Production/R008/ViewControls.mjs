import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
// User orbit/pan/zoom remains authoritative; actor motion only translates it.
export function createViewControls({camera,element,objects,anchor}){
 const controls=new OrbitControls(camera,element),lastAnchor=anchor.clone(),ray=new THREE.Raycaster();
 controls.enableDamping=true;controls.dampingFactor=.12;controls.rotateSpeed=.7;controls.zoomSpeed=.8;controls.panSpeed=.8;
 controls.minDistance=.18;controls.maxDistance=24;controls.minPolarAngle=.06;controls.maxPolarAngle=Math.PI-.06;
 controls.screenSpacePanning=true;controls.cursorStyle='grab';
 function frame(target,position,currentAnchor=lastAnchor){
  // Reset pending damping without installing any keyboard listeners.
  controls.enableDamping=false;controls.update();camera.position.copy(position);controls.target.copy(target);lastAnchor.copy(currentAnchor);controls.update();controls.enableDamping=true;
 }
 function reset(currentAnchor=lastAnchor){frame(currentAnchor,currentAnchor.clone().add(new THREE.Vector3(0,2.45,4.5)),currentAnchor);}
 function update(currentAnchor,seconds=1/60){const delta=currentAnchor.clone().sub(lastAnchor);camera.position.add(delta);controls.target.add(delta);lastAnchor.copy(currentAnchor);controls.update(seconds);
  // Keep the viewing boom outside scene obstacles without constraining orbit.
  const boom=camera.position.clone().sub(controls.target),distance=boom.length();if(distance>.18){ray.set(controls.target,boom.normalize());ray.far=distance;const hit=ray.intersectObjects(objects,false)[0];if(hit&&hit.distance>.20)camera.position.copy(controls.target).addScaledVector(ray.ray.direction,Math.max(.18,hit.distance-.12));}
  camera.position.y=Math.max(.06,camera.position.y);camera.lookAt(controls.target);
 }
 reset(anchor);return {controls,frame,reset,update,snapshot:()=>({position:camera.position.toArray(),target:controls.target.toArray(),distance:camera.position.distanceTo(controls.target)}),dispose:()=>controls.dispose()};
}
