import * as THREE from 'three';
import {WORLD} from './game-world.mjs';
export function createWorld(scene){
 scene.background=new THREE.Color(0x192633);scene.fog=new THREE.Fog(0x192633,16,38);
 scene.add(new THREE.HemisphereLight(0xe8f3ff,0x494337,2.4));
 const key=new THREE.DirectionalLight(0xffefd7,3);key.position.set(-3,7,5);scene.add(key);
 const rim=new THREE.DirectionalLight(0x8bc6ff,1.8);rim.position.set(4,4,-5);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:0x263943,roughness:.92}));floor.rotation.x=-Math.PI/2;floor.position.y=-.005;scene.add(floor);
 const grid=new THREE.GridHelper(24,48,0x53717a,0x344d58);grid.position.y=.003;scene.add(grid);
 const objects=[];
 for(const b of WORLD.boxes){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(b.width,b.height,b.depth),new THREE.MeshStandardMaterial({color:b.color,roughness:.8}));mesh.position.set(b.x,b.height/2,b.z);scene.add(mesh);objects.push(mesh);
  const cap=new THREE.Mesh(new THREE.BoxGeometry(b.width,.012,b.depth),new THREE.MeshStandardMaterial({color:b.accent,roughness:.8}));cap.position.set(b.x,b.height+.004,b.z);scene.add(cap);
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:0x78929b,transparent:true,opacity:.45}));edges.position.copy(mesh.position);scene.add(edges);
  // Labels are drawn from text at runtime; no downloaded image assets.
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#14212bdd';ctx.fillRect(0,0,768,96);ctx.fillStyle='#e1f4ec';ctx.font='bold 36px sans-serif';ctx.textAlign='center';ctx.fillText(b.label,384,62);
  const texture=new THREE.CanvasTexture(canvas),label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true}));label.scale.set(1.7,.2125,1);label.position.set(b.x,b.height+.32,b.z);scene.add(label);
 }
 const boundary=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-11.5,0,-11.5],[11.5,0,-11.5],[11.5,0,11.5],[-11.5,0,11.5]].map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:0x77cbb5}));boundary.position.y=.008;scene.add(boundary);
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(.30,40),new THREE.MeshBasicMaterial({color:0x07131b,transparent:true,opacity:.32,depthWrite:false}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);
 return {objects,shadow};
}
