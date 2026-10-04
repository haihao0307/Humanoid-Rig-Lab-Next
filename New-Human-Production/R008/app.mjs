import * as THREE from 'three';
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
import {createAnatomyWorkbench} from './AnatomyWorkbench.mjs';
import {createMotionAnatomyWorkbench} from './MotionAnatomyWorkbench.mjs';
import {createBodyWorkbench} from './BodyWorkbench.mjs';
import {DEFAULT_SURFACE_DETAIL,normalizeSurfaceDetail,surfaceGenerationOptions,SURFACE_PRESETS} from './SurfaceQuality.mjs';
const $=id=>document.getElementById(id),scene=new THREE.Scene();
const surfaceStorage='human.r008.surface-detail.v1';let surfaceDetail=normalizeSurfaceDetail(),surfaceBusy=false,surfaceGenerationMilliseconds=0;
try{const saved=localStorage.getItem(surfaceStorage);if(saved)surfaceDetail=normalizeSurfaceDetail(JSON.parse(saved));}catch{}
const camera=new THREE.PerspectiveCamera(46,innerWidth/innerHeight,.05,70);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
function surfaceUI(){for(const key of ['density','normalStrength','microStrength','pixelScale'])$(key).value=surfaceDetail[key];$('normalStrengthValue').value=surfaceDetail.normalStrength.toFixed(2);$('microStrengthValue').value=surfaceDetail.microStrength.toFixed(2);renderer.setPixelRatio(Math.min(2,devicePixelRatio*surfaceDetail.pixelScale));}
surfaceUI();
renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','人物控制场景，WASD移动，Shift奔跑，空格跳跃');document.body.prepend(renderer.domElement);
const world=createWorld(scene),controller=new CharacterController(),actor=new THREE.Group();actor.name='PlayerWorldTransform';scene.add(actor);
let subject,data,animator,paused=false,manual=false,lastTime=performance.now(),hudTime=0,faceWorkbench=null,anatomyWorkbench=null,inspectionState=null;
let faceExpression,expressionMode='auto',faceCloseup=false,scarCloseup=false;
const skinWorkbench=createSkinWorkbench({getSubject:()=>subject,onPreview:previewScars});window.HumanSkin=skinWorkbench;
const bodyWorkbench=createBodyWorkbench({apply:applyBodyRecipe,getReport:()=>subject?.body.report});window.HumanBody=bodyWorkbench;
for(const [id,expression]of Object.entries(EXPRESSIONS)){const option=document.createElement('option');option.value=id;option.textContent=expression.label;$('expression').append(option);}
let jumpStyle=DEFAULT_JUMP_STYLE;try{const saved=localStorage.getItem('human.jumpStyle');if(JUMP_STYLES.some(s=>s.id===saved))jumpStyle=saved;}catch{}
for(const style of JUMP_STYLES){const option=document.createElement('option');option.value=style.id;option.textContent=style.label;$('jumpStyle').append(option);}$('jumpStyle').value=jumpStyle;
function jumpDescription(){$('jumpDescription').textContent=JUMP_STYLES.find(s=>s.id===jumpStyle).description;}
function makeAnimator(){const a=new GameAnimator(subject,actor);a.setJumpStyle(jumpStyle);return a;}jumpDescription();
const cameraAnchor=()=>new THREE.Vector3(controller.x,controller.y+1.05*actor.scale.y,controller.z);
const view=createViewControls({camera,element:renderer.domElement,objects:world.objects,anchor:cameraAnchor()});window.HumanView=view;
let cameraFocus='game',motionAnatomy=null;
const labels={idle:'待机',walk:'行走',run:'奔跑',anticipation:'准备起跳',takeoff:'起跳',flight:'腾空平衡',fall:'准备落地',landing:'落地恢复'};
function updateCamera(dt,immediate=false){
 const anchor=cameraAnchor(),mode=motionAnatomy?.active?'anatomy':faceWorkbench?.active?'weights':scarCloseup?'scar-'+scarCloseup:faceCloseup?'head':'game';
 if(mode==='weights'){faceWorkbench.focus();}
 else if(mode!==cameraFocus&&mode!=='anatomy'){
  if(scarCloseup){const side=scarCloseup==='right'?-1:1,target=new THREE.Vector3(side*.25,1.30,0).multiplyScalar(actor.scale.y).applyQuaternion(actor.quaternion).add(actor.position),offset=new THREE.Vector3(side*.10,.025,.88).multiplyScalar(actor.scale.y).applyQuaternion(actor.quaternion);view.frame(target,target.clone().add(offset),anchor);}
  else if(faceCloseup){const target=subject.byName.get('head').getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.035,.015).multiplyScalar(actor.scale.y).applyQuaternion(actor.quaternion)),offset=new THREE.Vector3(0,.015,.58).multiplyScalar(actor.scale.y).applyQuaternion(actor.quaternion);view.frame(target,target.clone().add(offset),anchor);}
  else view.reset(anchor);
 }
 cameraFocus=mode;view.update(anchor,dt);
}
function updateActor(dt){actor.position.set(controller.x,controller.y,controller.z);actor.rotation.y=controller.yaw;actor.updateMatrixWorld(true);animator.update(controller,dt);if(!faceWorkbench?.active)faceExpression?.update(controller,dt);const ground=supportAt(controller.x,controller.z,controller.y+.001).height;world.shadow.position.set(controller.x,ground+.015,controller.z);world.shadow.scale.setScalar(actor.scale.y*(1+Math.max(0,controller.y-ground)*.18));world.shadow.material.opacity=.32/(1+Math.max(0,controller.y-ground));}
function status(){if(!subject)return;const c=controller.snapshot();$('motion').textContent=manual?'动作检查：'+subject.phase:animator.idleBlend>.15&&c.phase==='idle'?'闲置环顾':labels[c.phase];$('speed').textContent=c.speed.toFixed(1)+' m/s';$('altitude').textContent=c.y.toFixed(2)+' m';$('contact').textContent=c.grounded?(c.support==='ground'?'地面':c.support.startsWith('step')?'台阶':c.support==='low-wall'?'矮墙顶部':'平台顶部'):'腾空';$('status').textContent=`${(data.packageBytes/1e6).toFixed(2)} MB 参数 · ${data.rig.length} 骨骼 · ${subject.surface.report.triangles.toLocaleString()} 面`;
 $('expressionLabel').textContent=faceExpression.mode==='auto'?'随动作变化':EXPRESSIONS[faceExpression.mode].label;$('expression').value=faceExpression.mode;expressionMode=faceExpression.mode;$('expressionDemo').textContent=faceExpression.demo?'暂停表情示例':'播放表情示例';
}
function applyBodyRecipe(recipe,{bind=false}={}){
 if(!subject)return;if(!bind&&!controller.grounded)throw Error('请落地后调整体型');const previousPaused=paused,previousScale=actor.scale.y,snapshot=view.snapshot();paused=true;controller.clearInput();
 try{subject.body.set(recipe);const metrics=subject.body.metrics;actor.scale.setScalar(metrics.scale);controller.setBodyMetrics(metrics);actor.updateMatrixWorld(true);subject.finishPose();
  if(metrics.scale!==previousScale){const ratio=metrics.scale/previousScale,p=new THREE.Vector3().fromArray(snapshot.position).sub(actor.position).multiplyScalar(ratio).add(actor.position),t=new THREE.Vector3().fromArray(snapshot.target).sub(actor.position).multiplyScalar(ratio).add(actor.position);view.frame(t,p,cameraAnchor());}
 }finally{paused=previousPaused;lastTime=performance.now();}
 return subject.body.metrics;
}
function disposeSubject(){if(!subject)return;subject.body?.dispose();subject.eyes?.dispose();actor.remove(subject.root);subject.mesh.geometry.dispose();for(const m of subject.mesh.material){for(const key of ['map','normalMap','roughnessMap','metalnessMap'])(m[key]||(key==='map'?m.userData.originalMap:null))?.dispose();m.dispose();}subject.helper.dispose();subject.skeleton.dispose();}
function rebuild(){motionAnatomy?.dispose();motionAnatomy?.setActive(false);anatomyWorkbench?.setActive(false);cameraFocus='reset';scarCloseup=false;faceWorkbench?.setActive(false);disposeSubject();const generationStart=performance.now();subject=createSubject(data,{...surfaceGenerationOptions(surfaceDetail.density),textureAnisotropy:Math.min(8,renderer.capabilities.getMaxAnisotropy())});surfaceGenerationMilliseconds=performance.now()-generationStart;subject.skin.setDetail(surfaceDetail);skinWorkbench.bind();faceExpression=new FacialExpression(subject.face,subject.eyes);faceExpression.setMode(expressionMode);faceExpression.intensity=Number($('expressionStrength').value);subject.eyes.setMode($('eyeMode').value);actor.add(subject.root);bodyWorkbench.bind();subject.setInPlace(true);subject.helper.visible=$('bones').checked;animator=makeAnimator();manual=false;$('action').value='game';updateActor(1/60);updateCamera(0,true);window.HumanR008={subject,data,scene,camera,renderer,rebuild};window.HumanGame={controller,actor,animator,world,camera,scene,subject,faceExpression,step(dt,render=true){if(motionAnatomy?.active)motionAnatomy.update(dt);else{controller.update(dt);updateActor(dt);}updateCamera(dt);skinWorkbench.tick(dt,!paused&&!manual&&!faceWorkbench?.active);if(render){status();renderer.render(scene,camera);}},setPaused(v){paused=v;controller.clearInput();$('pause').textContent=v?'继续游戏':'暂停游戏';},reset(){cameraFocus='reset';controller.reset();subject.setInPlace(true);subject.play('rest');animator=makeAnimator();this.animator=animator;faceExpression.reset();manual=false;$('action').value='game';updateActor(1/60);updateCamera(0,true);status();}};faceWorkbench?.refresh();anatomyWorkbench?.refresh();status();}
function setRegions(){const colors=subject.mesh.geometry.attributes.color,on=$('regions').checked;subject.skin.setInspection(on);for(let i=0;i<colors.count;i++){let r=subject.surface.colors.subarray(i*3,i*3+3);if(on){let k=0;for(let j=1;j<8;j++)if(subject.surface.skinWeight[i*8+j]>subject.surface.skinWeight[i*8+k])k=j;const col=new THREE.Color().setHSL((subject.surface.skinIndex[i*8+k]*.61803398875)%1,.65,.45);r=col.toArray();}colors.setXYZ(i,...r);}colors.needsUpdate=true;for(const m of subject.mesh.material){m.vertexColors=on;m.userData.originalMap??=m.map;m.map=on?null:m.userData.originalMap;m.needsUpdate=true;}}
function surfaceMetrics(){if(!subject)return;const p=subject.surface.report.precision;$('surfaceMetrics').textContent=`${SURFACE_PRESETS[surfaceDetail.density].label} · ${subject.surface.report.triangles.toLocaleString()} 面 · 头部间距 ${(p.headEdgeMetres*1000).toFixed(0)} mm · 生成 ${(surfaceGenerationMilliseconds/1000).toFixed(1)} 秒`;}
async function setSurfaceDetail(patch){
 if(surfaceBusy||bodyWorkbench.busy)throw Error('表面或体型正在计算，请稍候');
 const next=normalizeSurfaceDetail({...surfaceDetail,...patch}),geometryChanged=next.density!==surfaceDetail.density;
 if(geometryChanged){
  const saved={paused,manual,phase:subject.phase,mixerTime:subject.mixer.time,faceCloseup,scarCloseup,weights:faceWorkbench?.active,view:view.snapshot()};surfaceBusy=true;window.HumanGame.setPaused(true);$('density').disabled=true;$('surfaceReset').disabled=true;$('surfaceMetrics').textContent='正在按新精度生成表面，请稍候…';
  // Give the browser a paint before synchronous field evaluation. Time spent
  // rebuilding must never advance the game or the skin progression clock.
  await new Promise(resolve=>setTimeout(resolve,40));
  try{surfaceDetail=next;rebuild();faceCloseup=saved.faceCloseup;scarCloseup=saved.scarCloseup;
   if(saved.manual){manual=true;subject.play(saved.phase);subject.mixer.setTime(saved.mixerTime);subject.finishPose();$('action').value=saved.phase;}
   if(saved.weights)faceWorkbench.setActive(true);else if($('regions').checked)setRegions();
   view.frame(new THREE.Vector3().fromArray(saved.view.target),new THREE.Vector3().fromArray(saved.view.position),cameraAnchor());cameraFocus=saved.weights?'weights':scarCloseup?'scar-'+scarCloseup:faceCloseup?'head':'game';
   window.HumanGame.setPaused(saved.paused);lastTime=performance.now();
  }finally{surfaceBusy=false;$('density').disabled=false;$('surfaceReset').disabled=false;}
 }else{surfaceDetail=next;subject.skin.setDetail(surfaceDetail);}
 surfaceUI();surfaceMetrics();try{localStorage.setItem(surfaceStorage,JSON.stringify(surfaceDetail));}catch{}
 return {...surfaceDetail};
}
window.HumanSurface={set:setSurfaceDetail,restore:recipe=>setSurfaceDetail(normalizeSurfaceDetail(recipe)),export:()=>({...surfaceDetail}),get busy(){return surfaceBusy;},get report(){return {...subject?.surface.report.precision,generationMilliseconds:surfaceGenerationMilliseconds,triangles:subject?.surface.report.triangles,anisotropy:Math.min(8,renderer.capabilities.getMaxAnisotropy()),pixelRatio:renderer.getPixelRatio(),skin:subject?.skin.report.detail};}};
function previewScars(view){motionAnatomy?.setActive(false);anatomyWorkbench?.setActive(false);if(!subject)return;if(view==='game'){scarCloseup=false;updateCamera(0,true);return;}faceWorkbench?.setActive(false);window.HumanGame.reset();window.HumanGame.setPaused(true);faceCloseup=false;$('facePreview').textContent='表情近景';controller.yaw=0;actor.rotation.y=0;actor.updateMatrixWorld(true);subject.play('rest');scarCloseup=view;updateCamera(0,true);$('hint').textContent='肩臂伤疤近景 · 调整区域与阶段 · 返回游戏镜头后可继续游戏';}
function resumeGame(){motionAnatomy?.setActive(false);anatomyWorkbench?.setActive(false);scarCloseup=false;faceWorkbench?.setActive(false);if(manual){manual=false;subject.play('rest');animator=makeAnimator();window.HumanGame.animator=animator;$('action').value='game';}}
function startExpressionDemo(){motionAnatomy?.setActive(false);anatomyWorkbench?.setActive(false);scarCloseup=false;faceWorkbench?.setActive(false);window.HumanGame.reset();window.HumanGame.setPaused(true);controller.yaw=0;actor.rotation.y=0;actor.updateMatrixWorld(true);subject.play('rest');faceCloseup=true;$('facePreview').textContent='返回第三人称';$('expressionPanel').open=true;faceExpression.startDemo();document.querySelector('aside').scrollTop=$('expressionPanel').offsetTop-20;$('hint').textContent='表情示例 · 可暂停、切换上一项 / 下一项、调节强度';updateCamera(0,true);status();}
function enterFace(){scarCloseup=false;inspectionState={eyeMode:subject.eyes.report.mode,paused,manual,phase:subject.phase,action:$('action').value,yaw:controller.yaw,regions:$('regions').checked,bones:subject.helper.visible};if(inspectionState.regions){$('regions').checked=false;setRegions();}subject.eyes.setMode('centre');subject.eyes.update(0,{},{});subject.helper.visible=false;window.HumanGame.setPaused(true);controller.yaw=0;actor.rotation.y=0;actor.updateMatrixWorld(true);subject.play('rest');manual=true;for(const id of ['pause','action','tryJump','regions'])$(id).disabled=true;status();}
function exitFace(){const saved=inspectionState;inspectionState=null;if(!saved)return;faceExpression.reset();subject.eyes.setMode(saved.eyeMode);controller.yaw=saved.yaw;actor.rotation.y=saved.yaw;actor.updateMatrixWorld(true);manual=saved.manual;$('action').value=saved.action;if(manual)subject.play(saved.phase);else{subject.play('rest');animator=makeAnimator();window.HumanGame.animator=animator;updateActor(1/60);}subject.helper.visible=saved.bones;if(saved.regions){$('regions').checked=true;setRegions();}window.HumanGame.setPaused(saved.paused);for(const id of ['pause','action','tryJump','regions'])$(id).disabled=false;updateCamera(0,true);status();}
try{
 data=await loadSubjectParameters();rebuild();surfaceMetrics();
 faceWorkbench=createFacialWorkbench({getSubject:()=>subject,actor,camera,scene,frameView:(target,position)=>view.frame(target,position,cameraAnchor()),enter:()=>{motionAnatomy?.setActive(false);anatomyWorkbench?.setActive(false);enterFace();},exit:exitFace});window.HumanFace=faceWorkbench;
 anatomyWorkbench=createAnatomyWorkbench({getSubject:()=>subject,actor,enter:()=>{motionAnatomy?.setActive(false);faceWorkbench.setActive(false);faceCloseup=false;scarCloseup=false;enterFace();},exit:exitFace});window.HumanAnatomy=anatomyWorkbench;
 motionAnatomy=createMotionAnatomyWorkbench({getSubject:()=>subject,actor,getView:()=>view,enter:()=>{anatomyWorkbench.setActive(false);faceWorkbench.setActive(false);faceCloseup=false;scarCloseup=false;enterFace();},exit:exitFace});window.HumanMotorAnatomy=motionAnatomy;
 $('viewReset').onclick=()=>{motionAnatomy?.setActive(false);anatomyWorkbench?.setActive(false);faceCloseup=false;scarCloseup=false;faceWorkbench?.setActive(false);cameraFocus='reset';$('facePreview').textContent='表情近景';updateCamera(0,true);};
 $('bones').onchange=()=>subject.helper.visible=$('bones').checked;$('regions').onchange=setRegions;
 $('expression').onchange=()=>{expressionMode=$('expression').value;faceExpression.setMode(expressionMode);};$('expressionStrength').oninput=()=>{faceExpression.intensity=Number($('expressionStrength').value);};
 $('facePreview').onclick=()=>{scarCloseup=false;faceCloseup=!faceCloseup;$('facePreview').textContent=faceCloseup?'返回第三人称':'表情近景';updateCamera(0,true);};
 $('expressionDemo').onclick=()=>{if(faceExpression.demo)faceExpression.demo=false;else startExpressionDemo();status();};$('expressionPrev').onclick=()=>{faceExpression.nextDemo(-1);status();};$('expressionNext').onclick=()=>{faceExpression.nextDemo(1);status();};
 $('eyeMode').onchange=()=>subject.eyes.setMode($('eyeMode').value);$('blinkEye').onclick=()=>subject.eyes.blink();
 $('density').onchange=()=>setSurfaceDetail({density:$('density').value}).catch(e=>{$('surfaceMetrics').textContent=e.message;surfaceUI();});
 for(const key of ['normalStrength','microStrength'])$(key).oninput=()=>setSurfaceDetail({[key]:Number($(key).value)}).catch(e=>{$('surfaceMetrics').textContent=e.message;surfaceUI();});
 $('pixelScale').onchange=()=>setSurfaceDetail({pixelScale:Number($('pixelScale').value)}).catch(e=>{$('surfaceMetrics').textContent=e.message;surfaceUI();});
 $('surfaceReset').onclick=()=>setSurfaceDetail(DEFAULT_SURFACE_DETAIL).catch(e=>{$('surfaceMetrics').textContent=e.message;surfaceUI();});
 $('reset').onclick=()=>{motionAnatomy?.setActive(false);anatomyWorkbench?.setActive(false);scarCloseup=false;faceWorkbench.setActive(false);window.HumanGame.reset();};$('pause').onclick=()=>window.HumanGame.setPaused(!paused);
 $('action').onchange=()=>{controller.clearInput();if($('action').value==='game'){resumeGame();}else{manual=true;subject.play($('action').value);}status();};
 $('start').onclick=()=>{resumeGame();faceExpression.setMode('auto');faceCloseup=false;$('facePreview').textContent='表情近景';window.HumanGame.setPaused(false);renderer.domElement.focus({preventScroll:true});$('hint').textContent='WASD 移动 · Shift 奔跑 · 空格跳跃 · 拖动旋转 · 滚轮缩放';};
 const controlled=new Set(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space','KeyR']);
 addEventListener('keydown',event=>{if(!controlled.has(event.code)||event.ctrlKey||event.metaKey||event.altKey||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)||event.target.isContentEditable)return;if(event.code==='Space'&&event.target.tagName==='BUTTON')return;event.preventDefault();if(!subject||paused)return;if(event.code==='KeyR'&&!event.repeat){window.HumanGame.reset();return;}resumeGame();controller.press(event.code,event.repeat);});
 addEventListener('keyup',event=>controller.release(event.code));addEventListener('blur',()=>controller.clearInput());document.addEventListener('visibilitychange',()=>{if(document.hidden)controller.clearInput();lastTime=performance.now();});
 $('jumpStyle').onchange=()=>{jumpStyle=$('jumpStyle').value;animator.setJumpStyle(jumpStyle);jumpDescription();try{localStorage.setItem('human.jumpStyle',jumpStyle);}catch{}};
 $('tryJump').onclick=()=>{resumeGame();if(!controller.grounded)return;window.HumanGame.setPaused(false);controller.press('Space');controller.release('Space');renderer.domElement.focus({preventScroll:true});};
 $('start').disabled=false;$('tryJump').disabled=false;
 if(new URL(location.href).searchParams.get('view')==='face')startExpressionDemo();
 const anatomyView=new URL(location.href).searchParams.get('anatomy');if(['framework','muscles','inverse'].includes(anatomyView))motionAnatomy.show(anatomyView);
}catch(error){$('status').textContent=error.stack;$('status').className='error';console.error(error);window.failure=error.message;}
renderer.setAnimationLoop(()=>{const now=performance.now(),dt=Math.min((now-lastTime)/1000,.1);lastTime=now;if(subject&&!paused){if(manual)subject.step(dt);else{controller.update(dt);updateActor(dt);}}else if(subject&&!faceWorkbench?.active&&!anatomyWorkbench?.active)faceExpression?.update(controller,dt);if(motionAnatomy?.active)motionAnatomy.update(dt);if(subject)updateCamera(dt);if(subject)skinWorkbench.tick(dt,!paused&&!manual&&!faceWorkbench?.active);if(now-hudTime>100){status();hudTime=now;}renderer.render(scene,camera);});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
