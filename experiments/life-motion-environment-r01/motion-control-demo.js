import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import {MotionController} from 'https://cdn.jsdelivr.net/gh/haihao0307/Humanoid-Rig-Lab-Next@c4c35ae6ad062602d64c3fad20b8a90f01da62ee/experiments/life-motion-environment-r01/vendor/controller.mjs';
import {rigFromSource} from 'https://cdn.jsdelivr.net/gh/haihao0307/Humanoid-Rig-Lab-Next@c4c35ae6ad062602d64c3fad20b8a90f01da62ee/motion/vendor/rig.mjs';
import {FlatWorld} from 'https://cdn.jsdelivr.net/gh/haihao0307/Humanoid-Rig-Lab-Next@c4c35ae6ad062602d64c3fad20b8a90f01da62ee/motion/vendor/world.mjs';
const $=id=>document.getElementById(id),stage=$('stage');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(stage.clientWidth,stage.clientHeight);renderer.setClearColor(0x091019);renderer.outputColorSpace=THREE.SRGBColorSpace;stage.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x091019,10,32);const camera=new THREE.PerspectiveCamera(42,stage.clientWidth/stage.clientHeight,.02,100);
let orbit={theta:.7,phi:1.15,r:6,target:new THREE.Vector3(0,1,0)};
function cam(){camera.position.set(orbit.target.x+orbit.r*Math.sin(orbit.phi)*Math.sin(orbit.theta),orbit.target.y+orbit.r*Math.cos(orbit.phi),orbit.target.z+orbit.r*Math.sin(orbit.phi)*Math.cos(orbit.theta));camera.lookAt(orbit.target)}cam();
scene.add(new THREE.HemisphereLight(0xbfe8ff,0x182431,2));const light=new THREE.DirectionalLight(0xffddb6,2.4);light.position.set(-3,6,4);scene.add(light);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0x101e2b,roughness:.92}));floor.rotation.x=-Math.PI/2;floor.position.y=-.006;scene.add(floor);const grid=new THREE.GridHelper(40,80,0x33546a,0x1b3040);grid.position.y=.001;scene.add(grid);
let rig,controller,nodeIds,boneIndex,boneGeometry,jointGeometry,boneLines,jointPoints,pathLine,pathPoints,trail=[],prevRoot=null,prevVel=[0,0,0],prevYaw=null,prevYawRate=0,sequence=[],sequenceIndex=0,paused=false,last=performance.now(),accumulator=0;
const boneMat=new THREE.LineBasicMaterial({color:0x7fdcff}),pointMat=new THREE.PointsMaterial({color:0xeaf8ff,size:.045,sizeAttenuation:true}),pathMat=new THREE.LineBasicMaterial({color:0xffb36e});
function makeVisual(){nodeIds=Object.keys(rig.nodes);boneIndex=nodeIds.filter(id=>rig.nodes[id].parent).map(id=>[rig.nodes[id].parent,id]);boneGeometry=new THREE.BufferGeometry();boneGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(boneIndex.length*6),3));boneLines=new THREE.LineSegments(boneGeometry,boneMat);jointGeometry=new THREE.BufferGeometry();jointGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(nodeIds.length*3),3));jointPoints=new THREE.Points(jointGeometry,pointMat);pathLine=new THREE.Line(new THREE.BufferGeometry(),pathMat);pathPoints=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0xffc98c,size:.04}));scene.add(boneLines,jointPoints,pathLine,pathPoints)}
function reset(){if(!rig)return;controller=new MotionController(rig,new FlatWorld(),{maxLinearAccelerationMps2:+$('linear').value,maxYawAccelerationRadS2:+$('angular').value,maxYawSpeedRadS:+$('yawSpeed').value});trail=[];prevRoot=null;prevVel=[0,0,0];prevYaw=null;prevYawRate=0;sequence=[];sequenceIndex=0;paused=false;last=performance.now();accumulator=0;orbit.target.set(0,rig.hipHeight*.8,0);cam();$('status').textContent='就绪。选择动作，观察骨架、轨迹和实测加速度。';$('engineState').textContent='运行中 · 120 Hz fixed step'}
function issue(a){if(!controller)return;const s=controller.state;let cmd;
if(a==='forward')cmd={type:'walk',target:[s.root[0],0,s.root[2]+2]};
else if(a==='diag')cmd={type:'walk',target:[s.root[0]+1.4,0,s.root[2]+1.4]};
else if(['left90','right90','left180','right180'].includes(a)){const ang=a.endsWith('90')?Math.PI/2:Math.PI;cmd={type:'turn',yaw:s.yaw+(a.startsWith('left')?1:-1)*ang}}
else if(a==='stop')cmd={type:'stop'};
else if(a==='pause'){paused=!paused;controller.command({type:'pause',value:paused});$('status').textContent=paused?'暂停，当前状态保留。':'继续执行。';return}
else if(a==='reset'){reset();return}
else if(a==='sequence'){sequence=[{type:'walk',target:[s.root[0],0,s.root[2]+1.5]},{type:'turn',yaw:s.yaw+Math.PI/2},{type:'walk',target:[s.root[0]+1.4,0,s.root[2]+1.5]},{type:'stop'}];sequenceIndex=0;cmd=sequence[sequenceIndex++]}
if(!cmd)return;const result=controller.command(cmd);$('status').textContent=result.accepted?'已接收指令：'+a:'指令被拒绝：'+result.reason;$('status').style.color=result.accepted?'#a7e8c2':'#ffb66e'}
document.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',()=>issue(b.dataset.a)));
function params(){ $('linearV').textContent=(+$('linear').value).toFixed(2)+' m/s²';$('angularV').textContent=(+$('angular').value).toFixed(2)+' rad/s²';$('yawSpeedV').textContent=(+$('yawSpeed').value).toFixed(2)+' rad/s';reset()}
['linear','angular','yawSpeed'].forEach(id=>$(id).addEventListener('change',params));
function wrap(a){return Math.atan2(Math.sin(a),Math.cos(a))}
function updateVisual(){const positions=controller.motion.positions(controller.state);controller.motion.applyControlledLegs(positions,controller.state);const p=boneGeometry.attributes.position.array,j=jointGeometry.attributes.position.array;
nodeIds.forEach((id,i)=>{const v=positions.get(id)||controller.state.root;j.set(v,i*3)});
boneIndex.forEach(([parent,id],i)=>{const a=positions.get(parent)||controller.state.root,b=positions.get(id)||controller.state.root;p.set(a,i*6);p.set(b,i*6+3)});
boneGeometry.attributes.position.needsUpdate=true;jointGeometry.attributes.position.needsUpdate=true;boneGeometry.computeBoundingSphere();jointGeometry.computeBoundingSphere();
const root=controller.state.root;if(!prevRoot||Math.hypot(root[0]-prevRoot[0],root[2]-prevRoot[2])>.012){trail.push([root[0],.012,root[2]]);if(trail.length>1400)trail.shift()}pathLine.geometry.dispose();pathLine.geometry=new THREE.BufferGeometry().setFromPoints(trail.map(v=>new THREE.Vector3(...v)));pathPoints.geometry.dispose();pathPoints.geometry=new THREE.BufferGeometry().setFromPoints(trail.filter((v,i)=>i%8===0).map(v=>new THREE.Vector3(...v)));
orbit.target.lerp(new THREE.Vector3(root[0],root[1]*.72,root[2]),.025);cam()}
function step(dt){controller.update(dt);const s=controller.state,vel=s.velocity||[0,0,0],speed=Math.hypot(vel[0],vel[2]),a=prevRoot?Math.hypot((vel[0]-prevVel[0])/dt,(vel[2]-prevVel[2])/dt):0,rate=Number(s.yawRate||0),aa=prevYawRate==null?0:Math.abs(rate-prevYawRate)/dt;
$('speed').textContent=speed.toFixed(3);$('accel').textContent=a.toFixed(3);$('yawRate').textContent=rate.toFixed(3);$('yawAccel').textContent=aa.toFixed(2);
if(s.fault){$('status').textContent='控制器已阻断：'+s.fault;$('status').style.color='#ffb66e'}
if(!s.command&&sequenceIndex<sequence.length){const cmd=sequence[sequenceIndex++];controller.command(cmd);$('status').textContent='组合任务步骤 '+sequenceIndex+' / '+sequence.length}
if(!s.command&&sequenceIndex>=sequence.length&&sequence.length){sequence=[];sequenceIndex=0;$('status').textContent='组合动作执行完毕；检查轨迹与制动曲线。'}
prevRoot=[...s.root];prevVel=[...vel];prevYaw=s.yaw;prevYawRate=rate}
function animate(now){requestAnimationFrame(animate);const frameDt=Math.min(.05,(now-last)/1000);last=now;if(!paused&&controller){accumulator+=frameDt;let n=0;while(accumulator>=1/120&&n<6){step(1/120);accumulator-=1/120;n++}updateVisual();renderer.render(scene,camera)}}
let drag=null;renderer.domElement.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,id:e.pointerId};renderer.domElement.setPointerCapture(e.pointerId)});renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;orbit.theta-=(e.clientX-drag.x)*.008;orbit.phi=Math.max(.25,Math.min(2.85,orbit.phi+(e.clientY-drag.y)*.008));drag.x=e.clientX;drag.y=e.clientY;cam()});renderer.domElement.addEventListener('pointerup',()=>drag=null);renderer.domElement.addEventListener('wheel',e=>{orbit.r=Math.max(2.2,Math.min(16,orbit.r+e.deltaY*.008));cam()},{passive:true});addEventListener('resize',()=>{renderer.setSize(stage.clientWidth,stage.clientHeight);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix()});
try{const url='https://cdn.jsdelivr.net/gh/haihao0307/Humanoid-Rig-Lab-Next@c4c35ae6ad062602d64c3fad20b8a90f01da62ee/reconstruction/rig-reference.json';const doc=await fetch(url).then(r=>{if(!r.ok)throw Error('人体地标载入失败 '+r.status);return r.json()});rig=rigFromSource(doc);makeVisual();reset();updateVisual();$('status').textContent='人体地标已载入。控制器、双腿 IK 与上身步态已启动。'}catch(e){$('status').textContent='初始化失败：'+e.message;$('status').style.color='#ffb66e';$('engineState').textContent='加载失败';console.error(e)}
requestAnimationFrame(animate);
