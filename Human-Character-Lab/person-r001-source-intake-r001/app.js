import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/controls/OrbitControls.js';

const $=s=>document.querySelector(s);
const canvas=$('#canvas'),loading=$('#loading'),loadState=$('#loadState'),selection=$('#selection');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
const scene=new THREE.Scene();scene.background=null;
const camera=new THREE.PerspectiveCamera(34,1,.01,20);camera.position.set(0,.88,3.15);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,.88,0);controls.enableDamping=true;controls.minDistance=1.2;controls.maxDistance=6;controls.maxPolarAngle=Math.PI*.92;
scene.add(new THREE.HemisphereLight(0xdde7ee,0x1a1210,1.55));
const key=new THREE.DirectionalLight(0xffe1ce,3.2);key.position.set(2.7,4.0,3.5);scene.add(key);
const fill=new THREE.DirectionalLight(0xaec9dd,1.45);fill.position.set(-3,2.1,1.8);scene.add(fill);
const rim=new THREE.DirectionalLight(0xffffff,1.25);rim.position.set(0,2.6,-3.2);scene.add(rim);
const floor=new THREE.Mesh(new THREE.CircleGeometry(2.4,96),new THREE.MeshStandardMaterial({color:0x10161a,roughness:1,metalness:0}));floor.rotation.x=-Math.PI/2;floor.position.y=-.004;scene.add(floor);
const grid=new THREE.GridHelper(2.4,24,0x273139,0x1a2228);grid.position.y=-.002;grid.material.transparent=true;grid.material.opacity=.36;scene.add(grid);
const model=new THREE.Group(),bodyGroup=new THREE.Group(),shortsGroup=new THREE.Group(),patchGroup=new THREE.Group();model.add(bodyGroup,shortsGroup,patchGroup);scene.add(model);
const DISPLAY_HEIGHT=1.80,SOURCE_HEIGHT=.978544116;model.scale.setScalar(DISPLAY_HEIGHT/SOURCE_HEIGHT);
const meshes=[];let sourceTriangleTotal=0,referenceTriangleTotal=0,currentMode='clean';

async function ungzipBase64(text){const binary=atob(text);const input=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)input[i]=binary.charCodeAt(i);const stream=new Blob([input]).stream().pipeThrough(new DecompressionStream('gzip'));return new Uint8Array(await new Response(stream).arrayBuffer());}
async function decodePart(part){
  const raw=await ungzipBase64(part.data),v=part.vertices,pBytes=v*3*2,nBytes=v*3;
  const qpos=new Uint16Array(raw.slice(0,pBytes).buffer),qnorm=new Int8Array(raw.slice(pBytes,pBytes+nBytes).buffer),idx=new Uint16Array(raw.slice(pBytes+nBytes).buffer);
  const pos=new Float32Array(v*3),norm=new Float32Array(v*3),min=part.min,max=part.max;
  for(let i=0;i<v;i++)for(let a=0;a<3;a++){const k=i*3+a;pos[k]=min[a]+qpos[k]/65535*(max[a]-min[a]);norm[k]=qnorm[k]/127;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(norm,3));g.setIndex(new THREE.BufferAttribute(idx,1));g.computeBoundingSphere();
  const mat=new THREE.MeshStandardMaterial({color:new THREE.Color(...part.color),roughness:part.roughness,metalness:0,side:THREE.FrontSide});
  const mesh=new THREE.Mesh(g,mat);mesh.userData.part=part;(part.shorts?shortsGroup:bodyGroup).add(mesh);meshes.push(mesh);
  sourceTriangleTotal+=part.sourceTriangles;referenceTriangleTotal+=part.triangles;
}
function loftGeometry(sections,segments=64){
  const p=[],ind=[];for(const s of sections){for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,sa=Math.sin(a),ca=Math.cos(a),rz=sa>=0?s.front:s.back;p.push(s.cx+s.rx*ca,s.y,s.cz+rz*sa);}}
  for(let j=0;j<sections.length-1;j++)for(let i=0;i<segments;i++){const a=j*segments+i,b=j*segments+(i+1)%segments,c=(j+1)*segments+(i+1)%segments,d=(j+1)*segments+i;ind.push(a,b,d,b,c,d);}
  const top=p.length/3;p.push(sections[0].cx,sections[0].y,sections[0].cz);const bottom=top+1;p.push(sections.at(-1).cx,sections.at(-1).y,sections.at(-1).cz);
  for(let i=0;i<segments;i++){ind.push(top,(i+1)%segments,i);const a=(sections.length-1)*segments+i,b=(sections.length-1)*segments+(i+1)%segments;ind.push(bottom,a,b);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ind);g.computeVertexNormals();return g;
}
function createPatch(){
  const mat=new THREE.MeshStandardMaterial({color:new THREE.Color(.64,.46,.36),roughness:.64,metalness:0});
  const pelvis=loftGeometry([
    {y:.572,cx:0,cz:.008,rx:.078,front:.052,back:.046},{y:.555,cx:0,cz:.005,rx:.085,front:.060,back:.054},{y:.525,cx:0,cz:0,rx:.090,front:.061,back:.063},{y:.490,cx:0,cz:-.006,rx:.094,front:.057,back:.071},{y:.455,cx:0,cz:-.010,rx:.090,front:.050,back:.073},{y:.425,cx:0,cz:-.006,rx:.076,front:.043,back:.064}
  ],72);patchGroup.add(new THREE.Mesh(pelvis,mat));
  for(const side of [-1,1]){const thigh=loftGeometry([
    {y:.475,cx:side*.054,cz:-.005,rx:.048,front:.049,back:.057},{y:.445,cx:side*.057,cz:-.004,rx:.050,front:.050,back:.055},{y:.405,cx:side*.059,cz:0,rx:.047,front:.049,back:.050},{y:.365,cx:side*.061,cz:.001,rx:.043,front:.046,back:.046},{y:.340,cx:side*.062,cz:.001,rx:.041,front:.044,back:.044}
  ],56);patchGroup.add(new THREE.Mesh(thigh,mat));}
  patchGroup.traverse(o=>{if(o.isMesh){o.userData.part={id:'P',role:'procedural-neutral-pelvis-and-proximal-thigh',triangles:o.geometry.index.count/3,sourceTriangles:0,shorts:false};meshes.push(o);}});
}
function applyMode(mode){currentMode=mode;document.querySelectorAll('.mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));shortsGroup.visible=mode==='original';patchGroup.visible=mode!=='original'&&$('#patchToggle').checked;$('#modeLabel').textContent=mode==='original'?'原始短裤对照':mode==='gap'?'短裤移除后的源缺口':'清理后人物';if(mode==='gap')patchGroup.visible=false;}
function updateMaterials(){const wire=$('#wireToggle').checked,clay=$('#clayToggle').checked;for(const m of meshes){m.material.wireframe=wire;if(!m.userData.originalColor)m.userData.originalColor=m.material.color.clone();m.material.color.copy(clay?new THREE.Color(0x9b887b):m.userData.originalColor);}}
function setView(v){const d=3.15,target=new THREE.Vector3(0,.88,0);controls.target.copy(target);if(v==='front')camera.position.set(0,.88,d);if(v==='back')camera.position.set(0,.88,-d);if(v==='left')camera.position.set(-d,.88,0);if(v==='right')camera.position.set(d,.88,0);if(v==='three')camera.position.set(2.15,1.25,2.45);camera.lookAt(target);controls.update();}
function resize(){const r=canvas.getBoundingClientRect(),w=Math.max(1,Math.floor(r.width)),h=Math.max(1,Math.floor(r.height));if(canvas.width!==w*renderer.getPixelRatio()||canvas.height!==h*renderer.getPixelRatio()){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}}
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect();pointer.x=(e.clientX-r.left)/r.width*2-1;pointer.y=-(e.clientY-r.top)/r.height*2+1;ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(meshes.filter(m=>m.visible&&m.parent?.visible),false)[0];if(!hit)return;const p=hit.object.userData.part;selection.innerHTML=`<b>${p.id==='P'?'PROCEDURAL PATCH':'part_'+p.id}</b><br>role: ${p.role}<br>reference triangles: ${Number(p.triangles).toLocaleString()}<br>source triangles: ${Number(p.sourceTriangles||0).toLocaleString()}<br>shorts: ${p.shorts?'YES — excluded by default':'NO'}`;});

document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>applyMode(b.dataset.mode));$('#patchToggle').onchange=()=>applyMode(currentMode);$('#wireToggle').onchange=updateMaterials;$('#clayToggle').onchange=updateMaterials;

async function init(){try{const payloadBytes=await ungzipBase64(window.HUMAN_R001_PAYLOAD_B64||'');const payload=JSON.parse(new TextDecoder().decode(payloadBytes));const parts=payload.parts.sort((a,b)=>a.id-b.id);let done=0;for(const p of parts){await decodePart(p);done++;loadState.textContent=`表面 ${done}/${parts.length}`;await new Promise(requestAnimationFrame);}createPatch();$('#triangles').textContent=referenceTriangleTotal.toLocaleString();applyMode('clean');updateMaterials();loading.classList.add('hidden');loadState.textContent='READY · 31 PARTS';setView('front');}catch(err){console.error(err);loadState.textContent='LOAD ERROR';loadState.classList.add('error');loading.innerHTML=`<b>读取失败</b><span>${err.message}</span>`;}}
function animate(){resize();controls.update();renderer.render(scene,camera);requestAnimationFrame(animate);}init();animate();
