import * as THREE from 'three';
import {installShortsWorkbench} from './ShortsWorkbench.mjs';
import {createSubject,loadSubjectParameters} from './SubjectRuntime.mjs';
import {CharacterController} from './CharacterController.mjs';
import {GameAnimator} from './GameAnimator.mjs';
import {createWorld} from './game-scene.mjs';
import {supportAt} from './game-world.mjs';
import {JUMP_STYLES,DEFAULT_JUMP_STYLE} from './JumpProfiles.mjs';
import {createFacialWorkbench} from './FacialWorkbench.mjs';
import {FacialExpression,EXPRESSIONS} from './FacialExpression.mjs';
import {createViewControls} from './ViewControls.mjs';
import {createSkinWorkbench} from './SkinWorkbench.mjs';
const $=id=>document.getElementById(id),scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(46,innerWidth/innerHeight,.05,70);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','人物控制场景，WASD移动，Shift奔跑，空格跳跃');document.body.prepend(renderer.domElement);
const world=createWorld(scene),controller=new CharacterController(),actor=new THREE.Group();actor.name='PlayerWorldTransform';scene.add(actor);
let subject,data,animator,paused=false,manual=false,lastTime=performance.now(),hudTime=0,faceWorkbench=null,inspectionState=null;
let faceExpression,expressionMode='auto',faceCloseup=false,scarCloseup=false;
const skinWorkbench=createSkinWorkbench({getSubject:()=>subject,onPreview:previewScars});window.HumanSkin=skinWorkbench;
for(const [id,expression]of Object.entries(EXPRESSIONS)){const option=document.createElement('option');option.value=id;option.textContent=expression.label;$('expression').append(option);}
let jumpStyle=DEFAULT_JUMP_STYLE;try{const saved=localStorage.getItem('human.jumpStyle');if(JUMP_STYLES.some(s=>s.id===saved))jumpStyle=saved;}catch{}
for(const style of JUMP_STYLES){const option=document.createElement('option');option.value=style.id;option.textContent=style.label;$('jumpStyle').append(option);}$('jumpStyle').value=jumpStyle;
function jumpDescription(){$('jumpDescription').textContent=JUMP_STYLES.find(s=>s.id===jumpStyle).description;}
function makeAnimator(){const a=new GameAnimator(subject,actor);a.setJumpStyle(jumpStyle);return a;}jumpDescription();
const cameraAnchor=()=>new THREE.Vector3(controller.x,controller.y+1.05,controller.z);
const view=createViewControls({camera,element:renderer.domElement,objects:world.objects,anchor:cameraAnchor()});window.HumanView=view;
let cameraFocus='game';
const labels={idle:'待机',walk:'行走',run:'奔跑',anticipation:'准备起跳',takeoff:'起跳',flight:'腾空平衡',fall:'准备落地',landing:'落地恢复'};
function updateCamera(dt,immediate=false){
 if(window.HumanShorts?.inspection){window.HumanShorts.updateCamera();return;}
 const anchor=cameraAnchor(),mode=faceWorkbench?.active?'weights':scarCloseup?'scar-'+scarCloseup:faceCloseup?'head':'game';
 if(mode==='weights'){faceWorkbench.focus();}
 else if(mode!==cameraFocus){
  if(scarCloseup){const side=scarCloseup==='right'?-1:1,target=new THREE.Vector3(side*.25,1.30,0).applyQuaternion(actor.quaternion).add(actor.position),offset=new THREE.Vector3(side*.10,.025,.88).applyQuaternion(actor.quaternion);view.frame(target,target.clone().add(offset),anchor);}
  else if(faceCloseup){const target=subject.byName.get('head').getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.035,.015).applyQuaternion(actor.quaternion)),offset=new THREE.Vector3(0,.015,.58).applyQuaternion(actor.quaternion);view.frame(target,target.clone().add(offset),anchor);}
  else view.reset(anchor);
 }
 cameraFocus=mode;view.update(anchor,dt);
}
let shortsClock=0;
function tickPhysical(dt,manualPose=false){
 if(!Number.isFinite(dt)||dt<0)throw Error('Character and cloth require finite nonnegative time');
 if(!window.HumanShorts?.simulationCertified){window.HumanGame?.setPaused(true);return;}
 shortsClock+=dt;
 // Preserve pending elapsed time and stop on an unserviceable backlog. This
 // avoids both a browser hang and silently dropping physical time.
 if(shortsClock>8/240+1e-8){window.HumanGame?.setPaused(true);throw Error('Cloth physical backlog exceeds eight substeps; pending time retained');}
 let steps=0;while(shortsClock>=1/240-1e-10&&steps++<8){if(manualPose)subject.step(1/240);else{controller.update(1/240);updateActor(1/240);}window.HumanShorts?.step(1/240);shortsClock-=1/240;}
}
function updateActor(dt){actor.position.set(controller.x,controller.y,controller.z);actor.rotation.y=controller.yaw;actor.updateMatrixWorld(true);animator.update(controller,dt);if(!faceWorkbench?.active)faceExpression?.update(controller,dt);const ground=supportAt(controller.x,controller.z,controller.y+.001).height;world.shadow.position.set(controller.x,ground+.015,controller.z);world.shadow.scale.setScalar(1+Math.max(0,controller.y-ground)*.18);world.shadow.material.opacity=.32/(1+Math.max(0,controller.y-ground));}
function status(){if(!subject)return;const c=controller.snapshot();$('motion').textContent=manual?'动作检查：'+subject.phase:animator.idleBlend>.15&&c.phase==='idle'?'闲置环顾':labels[c.phase];$('speed').textContent=c.speed.toFixed(1)+' m/s';$('altitude').textContent=c.y.toFixed(2)+' m';$('contact').textContent=c.grounded?(c.support==='ground'?'地面':c.support.startsWith('step')?'台阶':c.support==='low-wall'?'矮墙顶部':'平台顶部'):'腾空';$('status').textContent=`${(data.packageBytes/1e6).toFixed(2)} MB 参数 · ${data.rig.length} 骨骼 · ${subject.surface.report.triangles.toLocaleString()} 面`;
 $('expressionLabel').textContent=faceExpression.mode==='auto'?'随动作变化':EXPRESSIONS[faceExpression.mode].label;$('expression').value=faceExpression.mode;expressionMode=faceExpression.mode;$('expressionDemo').textContent=faceExpression.demo?'暂停表情示例':'播放表情示例';
}
function disposeSubject(){if(!subject)return;subject.eyes?.dispose();actor.remove(subject.root);subject.mesh.geometry.dispose();for(const m of subject.mesh.material){for(const key of ['map','normalMap','roughnessMap','metalnessMap'])(m[key]||(key==='map'?m.userData.originalMap:null))?.dispose();m.dispose();}subject.helper.dispose();subject.skeleton.dispose();}
function rebuild(){cameraFocus='reset';scarCloseup=false;faceWorkbench?.setActive(false);disposeSubject();subject=createSubject(data,{edgeMetres:Number($('density').value)});skinWorkbench.bind();faceExpression=new FacialExpression(subject.face,subject.eyes);faceExpression.setMode(expressionMode);faceExpression.intensity=Number($('expressionStrength').value);subject.eyes.setMode($('eyeMode').value);actor.add(subject.root);subject.setInPlace(true);subject.helper.visible=$('bones').checked;animator=makeAnimator();manual=false;$('action').value='game';updateActor(1/60);updateCamera(0,true);window.HumanR008={subject,data,scene,camera,renderer,rebuild};window.HumanGame={controller,actor,animator,world,camera,scene,subject,faceExpression,step(dt,render=true){tickPhysical(dt);updateCamera(dt);skinWorkbench.tick(dt,!paused&&!manual&&!faceWorkbench?.active);if(render){status();renderer.render(scene,camera);}},setPaused(v){if(v===false&&!window.HumanShorts?.simulationCertified)v=true;paused=v;controller.clearInput();$('pause').textContent=v?'继续游戏':'暂停游戏';},reset(){if(window.HumanShorts&&!window.HumanShorts.simulationCertified)return;cameraFocus='reset';controller.reset();subject.setInPlace(true);subject.play('rest');animator=makeAnimator();this.animator=animator;faceExpression.reset();manual=false;$('action').value='game';updateActor(1/60);updateCamera(0,true);status();}};faceWorkbench?.refresh();status();installShortsWorkbench(window.HumanGame,{renderer,camera,scene});}
function setRegions(){const colors=subject.mesh.geometry.attributes.color,on=$('regions').checked;subject.skin.setInspection(on);for(let i=0;i<colors.count;i++){let r=subject.surface.colors.subarray(i*3,i*3+3);if(on){let k=0;for(let j=1;j<8;j++)if(subject.surface.skinWeight[i*8+j]>subject.surface.skinWeight[i*8+k])k=j;const col=new THREE.Color().setHSL((subject.surface.skinIndex[i*8+k]*.61803398875)%1,.65,.45);r=col.toArray();}colors.setXYZ(i,...r);}colors.needsUpdate=true;for(const m of subject.mesh.material){m.vertexColors=on;m.userData.originalMap??=m.map;m.map=on?null:m.userData.originalMap;m.needsUpdate=true;}}
function previewScars(view){if(!subject)return;if(view==='game'){scarCloseup=false;updateCamera(0,true);return;}faceWorkbench?.setActive(false);window.HumanGame.reset();window.HumanGame.setPaused(true);faceCloseup=false;$('facePreview').textContent='表情近景';controller.yaw=0;actor.rotation.y=0;actor.updateMatrixWorld(true);subject.play('rest');scarCloseup=view;updateCamera(0,true);$('hint').textContent='肩臂伤疤近景 · 调整区域与阶段 · 返回游戏镜头后可继续游戏';}
function resumeGame(){scarCloseup=false;faceWorkbench?.setActive(false);if(manual){manual=false;subject.play('rest');animator=makeAnimator();window.HumanGame.animator=animator;$('action').value='game';}}
function startExpressionDemo(){scarCloseup=false;faceWorkbench?.setActive(false);window.HumanGame.reset();window.HumanGame.setPaused(true);controller.yaw=0;actor.rotation.y=0;actor.updateMatrixWorld(true);subject.play('rest');faceCloseup=true;$('facePreview').textContent='返回第三人称';$('expressionPanel').open=true;faceExpression.startDemo();document.querySelector('aside').scrollTop=$('expressionPanel').offsetTop-20;$('hint').textContent='表情示例 · 可暂停、切换上一项 / 下一项、调节强度';updateCamera(0,true);status();}
function enterFace(){scarCloseup=false;inspectionState={eyeMode:subject.eyes.report.mode,paused,manual,phase:subject.phase,action:$('action').value,yaw:controller.yaw,regions:$('regions').checked,bones:subject.helper.visible};if(inspectionState.regions){$('regions').checked=false;setRegions();}subject.eyes.setMode('centre');subject.eyes.update(0,{},{});subject.helper.visible=false;window.HumanGame.setPaused(true);controller.yaw=0;actor.rotation.y=0;actor.updateMatrixWorld(true);subject.play('rest');manual=true;for(const id of ['pause','action','tryJump','regions'])$(id).disabled=true;status();}
function exitFace(){const saved=inspectionState;inspectionState=null;if(!saved)return;faceExpression.reset();subject.eyes.setMode(saved.eyeMode);controller.yaw=saved.yaw;actor.rotation.y=saved.yaw;actor.updateMatrixWorld(true);manual=saved.manual;$('action').value=saved.action;if(manual)subject.play(saved.phase);else{subject.play('rest');animator=makeAnimator();window.HumanGame.animator=animator;updateActor(1/60);}subject.helper.visible=saved.bones;if(saved.regions){$('regions').checked=true;setRegions();}window.HumanGame.setPaused(saved.paused);for(const id of ['pause','action','tryJump','regions'])$(id).disabled=false;updateCamera(0,true);status();}
try{
 data=await loadSubjectParameters();rebuild();
 faceWorkbench=createFacialWorkbench({getSubject:()=>subject,actor,camera,scene,frameView:(target,position)=>view.frame(target,position,cameraAnchor()),enter:enterFace,exit:exitFace});window.HumanFace=faceWorkbench;
 $('viewReset').onclick=()=>{faceCloseup=false;scarCloseup=false;faceWorkbench?.setActive(false);cameraFocus='reset';$('facePreview').textContent='表情近景';updateCamera(0,true);};
 $('bones').onchange=()=>subject.helper.visible=$('bones').checked;$('regions').onchange=setRegions;
 $('expression').onchange=()=>{expressionMode=$('expression').value;faceExpression.setMode(expressionMode);};$('expressionStrength').oninput=()=>{faceExpression.intensity=Number($('expressionStrength').value);};
 $('facePreview').onclick=()=>{scarCloseup=false;faceCloseup=!faceCloseup;$('facePreview').textContent=faceCloseup?'返回第三人称':'表情近景';updateCamera(0,true);};
 $('expressionDemo').onclick=()=>{if(faceExpression.demo)faceExpression.demo=false;else startExpressionDemo();status();};$('expressionPrev').onclick=()=>{faceExpression.nextDemo(-1);status();};$('expressionNext').onclick=()=>{faceExpression.nextDemo(1);status();};
 $('eyeMode').onchange=()=>subject.eyes.setMode($('eyeMode').value);$('blinkEye').onclick=()=>subject.eyes.blink();
 $('density').onchange=()=>{rebuild();if($('regions').checked)setRegions();};
 $('reset').onclick=()=>{scarCloseup=false;faceWorkbench.setActive(false);window.HumanGame.reset();};$('pause').onclick=()=>window.HumanGame.setPaused(!paused);
 $('action').onchange=()=>{if(!window.HumanShorts?.simulationCertified)return;controller.clearInput();if($('action').value==='game'){resumeGame();}else{manual=true;subject.play($('action').value);}status();};
 $('start').onclick=()=>{if(!window.HumanShorts?.simulationCertified)return;resumeGame();faceExpression.setMode('auto');faceCloseup=false;$('facePreview').textContent='表情近景';window.HumanGame.setPaused(false);renderer.domElement.focus({preventScroll:true});$('hint').textContent='WASD 移动 · Shift 奔跑 · 空格跳跃 · 拖动旋转 · 滚轮缩放';};
 const controlled=new Set(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space','KeyR']);
 addEventListener('keydown',event=>{if(!controlled.has(event.code)||event.ctrlKey||event.metaKey||event.altKey||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)||event.target.isContentEditable)return;if(event.code==='Space'&&event.target.tagName==='BUTTON')return;event.preventDefault();if(!subject||paused)return;if(event.code==='KeyR'&&!event.repeat){window.HumanGame.reset();return;}resumeGame();controller.press(event.code,event.repeat);});
 addEventListener('keyup',event=>controller.release(event.code));addEventListener('blur',()=>controller.clearInput());document.addEventListener('visibilitychange',()=>{if(document.hidden)controller.clearInput();lastTime=performance.now();});
 $('jumpStyle').onchange=()=>{jumpStyle=$('jumpStyle').value;animator.setJumpStyle(jumpStyle);jumpDescription();try{localStorage.setItem('human.jumpStyle',jumpStyle);}catch{}};
 $('tryJump').onclick=()=>{if(!window.HumanShorts?.simulationCertified)return;resumeGame();if(!controller.grounded)return;window.HumanGame.setPaused(false);controller.press('Space');controller.release('Space');renderer.domElement.focus({preventScroll:true});};
 for(const id of ['start','tryJump','pause','action','reset'])$(id).disabled=!window.HumanShorts?.simulationCertified;
 if(new URL(location.href).searchParams.get('view')==='face')startExpressionDemo();
}catch(error){$('status').textContent=error.stack;$('status').className='error';console.error(error);window.failure=error.message;}
renderer.setAnimationLoop(()=>{const now=performance.now(),dt=(now-lastTime)/1000;lastTime=now;if(subject&&!paused){tickPhysical(dt,manual);}else if(subject&&!faceWorkbench?.active)faceExpression?.update(controller,dt);if(subject)updateCamera(dt);if(subject)skinWorkbench.tick(dt,!paused&&!manual&&!faceWorkbench?.active);if(now-hudTime>100){status();hudTime=now;}renderer.render(scene,camera);});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
