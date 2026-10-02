import {readFileSync,writeFileSync} from 'node:fs';
import {SHORTS_VERSIONS} from '../ShortsVersions.mjs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8'),write=(p,v)=>writeFileSync(new URL(p,root),v);
let app=read('app.mjs');
app=app.replace("import * as THREE from 'three';","import * as THREE from 'three';\nimport {installShortsWorkbench} from './ShortsWorkbench.mjs';");
app=app.replace('faceWorkbench?.refresh();status();}','faceWorkbench?.refresh();status();installShortsWorkbench(window.HumanGame,{renderer,camera,scene});}');
app=app.replace('function updateCamera(dt,immediate=false){','function updateCamera(dt,immediate=false){\n if(window.HumanShorts?.inspection){window.HumanShorts.updateCamera();return;}');
// One shared 240Hz clock advances controller, final posed body and cloth. There
// is no separate rendering-frame collider teleport or skipped physical time.
app=app.replace('function updateActor(dt){',`let shortsClock=0;
function tickPhysical(dt,manualPose=false){
 if(!Number.isFinite(dt)||dt<0)throw Error('Character and cloth require finite nonnegative time');
 if(!window.HumanShorts?.simulationCertified){window.HumanGame?.setPaused(true);return;}
 shortsClock+=dt;
 // Preserve pending elapsed time and stop on an unserviceable backlog. This
 // avoids both a browser hang and silently dropping physical time.
 if(shortsClock>8/240+1e-8){window.HumanGame?.setPaused(true);throw Error('Cloth physical backlog exceeds eight substeps; pending time retained');}
 let steps=0;while(shortsClock>=1/240-1e-10&&steps++<8){if(manualPose)subject.step(1/240);else{controller.update(1/240);updateActor(1/240);}window.HumanShorts?.step(1/240);shortsClock-=1/240;}
}
function updateActor(dt){`);
app=app.replace('controller.update(dt);updateActor(dt);updateCamera(dt);','tickPhysical(dt);updateCamera(dt);');
app=app.replace('if(manual)subject.step(dt);else{controller.update(dt);updateActor(dt);}','tickPhysical(dt,manual);');
app=app.replace('const now=performance.now(),dt=Math.min((now-lastTime)/1000,.1);','const now=performance.now(),dt=(now-lastTime)/1000;');
// Inspection must keep both UI and programmatic controller changes out of
// the asynchronous source sewing stage. Camera and material review stay usable.
app=app.replace('setPaused(v){paused=v;',"setPaused(v){if(v===false&&!window.HumanShorts?.simulationCertified)v=true;paused=v;");
app=app.replace('reset(){cameraFocus=',"reset(){if(window.HumanShorts&&!window.HumanShorts.simulationCertified)return;cameraFocus=");
app=app.replace("$('action').onchange=()=>{controller.clearInput();","$('action').onchange=()=>{if(!window.HumanShorts?.simulationCertified)return;controller.clearInput();");
app=app.replace("$('start').onclick=()=>{resumeGame();","$('start').onclick=()=>{if(!window.HumanShorts?.simulationCertified)return;resumeGame();");
app=app.replace("$('tryJump').onclick=()=>{resumeGame();","$('tryJump').onclick=()=>{if(!window.HumanShorts?.simulationCertified)return;resumeGame();");
app=app.replace("$('start').disabled=false;$('tryJump').disabled=false;","for(const id of ['start','tryJump','pause','action','reset'])$(id).disabled=!window.HumanShorts?.simulationCertified;");
// Static inspection freezes the subject and draws on camera/control changes.
// Redundant GPU frames and facial animation must not starve source assembly.
app=app.replace('lastTime=now;if(subject&&!paused)', 'lastTime=now;if(window.HumanShorts?.inspection&&!window.HumanShorts.simulationCertified){window.HumanShorts.updateCamera();if(window.HumanShorts.consumeRenderRequest())renderer.render(scene,camera);return;}if(subject&&!paused)');
write('shorts-app.mjs',app);
let html=read('index.html').replace('https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js','./vendor/three.module.js').replace('https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/','./vendor/').replace('src="./app.mjs"','src="./shorts-app.mjs"').replace('<title>人物世界 · 第三人称控制 R008</title>','<title>R008 · 低腰松紧亚麻短裤测试</title>').replace('<head>','<head><meta name="shorts-test-version" content="'+SHORTS_VERSIONS[1].revision+'">');
write('shorts-index.html',html);console.log('Fresh clothing entry uses the current R008 production app and shared fixed physics clock.');
