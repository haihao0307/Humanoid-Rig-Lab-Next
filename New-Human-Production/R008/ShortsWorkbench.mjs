import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {createShortsBodyAdapter} from './ShortsBodyAdapter.mjs';
import {createShortsGarmentDraft} from './ShortsGarmentDraft.mjs';
import {ShortsClothRuntime} from './ShortsClothRuntime.mjs';
import {SHORTS_VERSIONS} from './ShortsVersions.mjs';
import {createShortsManufacturingDraft} from './ShortsManufacturingDraft.mjs';
import {sewShortsSource} from './ShortsSewingAssembly.mjs';

// Candidate integration owns clothing only; the user's original R008 app stays
// available as a separate entry while physical/skin gates are under review.
export function installShortsWorkbench(game,{renderer,camera,scene}){
 window.HumanShorts?.dispose();game.setPaused(true);
 const body=createShortsBodyAdapter(game.subject,game.actor,{waistDropM:.055});
 const draft=createShortsGarmentDraft(body.measurements,{sectionAt:body.sectionAt,sagittalAtY:body.sagittalAtY,waistDropM:.055,waistbandWidthM:.038});
 body.update({time:0});
 const source=createShortsManufacturingDraft(draft);let cloth=new ShortsClothRuntime(source,body,game.actor,scene,{activeSeamIDs:[],elasticEnabled:false});const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.minDistance=.65;orbit.maxDistance=6;orbit.enabled=true;
 const panel=document.createElement('div');panel.id='shorts-workbench';panel.innerHTML='<strong>R008 · 低腰松紧亚麻短裤</strong><p id="shorts-measure"></p><p id="shorts-stage">量体与初始穿着候选 · 运动未验收</p><div class="shorts-views"><button data-short-view="front">正面</button><button data-short-view="back">背面</button><button data-short-view="side">侧面</button><button data-short-view="below">裆部</button></div><button id="shorts-panels">裁片识别色</button><button id="shorts-physics-probe">执行一个真实布料子步</button><small>人物现有原裤下面缺少裸身腰胯。本候选保留原衣物作对照与碰撞包络，尚未补造裸身。</small>';
 document.getElementById('shorts-workbench')?.remove();document.body.append(panel);const style=document.createElement('style');style.textContent='#shorts-workbench{position:absolute;right:16px;top:48px;width:265px;background:#14242ded;color:#e6efe9;padding:16px;border:1px solid #69877b;border-radius:10px;font:13px/1.6 system-ui;max-height:85vh;overflow:auto}#shorts-workbench button{padding:8px}#shorts-workbench strong{font-size:16px}#shorts-workbench p{font-size:12px;margin:9px 0}.shorts-views{display:flex;gap:4px}#shorts-stage{color:#f2d28b}#shorts-workbench small{display:block;margin-top:9px}@media(max-width:700px){body>aside{display:none}#shorts-workbench{right:8px;top:8px;width:200px;padding:10px;font-size:11px}#shorts-workbench strong{font-size:13px}#shorts-workbench small{font-size:10px}#hint{display:none}}';document.head.append(style);
 const measure=body.measurements;document.getElementById('shorts-measure').textContent=`实际身高 ${measure.heightM.toFixed(3)} m · 腰线降低 ${(draft.receipt.waistDropM*1000).toFixed(0)} mm · 布套 ${(draft.receipt.waistbandWidthM*1000).toFixed(0)} mm · 量体来源：当前原衣物外包络`;
 let disposed=false;const api={version:SHORTS_VERSIONS[1].revision,versionId:'lowrise',preserveOriginalSubjectClothing:true,get cloth(){return cloth;},body,draft,source,game,inspection:true,simulationCertified:false,assembly:{status:'sewing'},measuredSnapshot:()=>body.measurements,audit:()=>cloth.audit(),snapshot:()=>cloth.snapshot(),updateCamera(){orbit.update();},step(dt){if(!api.simulationCertified)throw Error('Wearing and native motion have not passed; no physical step is allowed');cloth.advance(dt);},setView(name){const target=game.actor.localToWorld(new THREE.Vector3(0,draft.receipt.middleY-.12,0)),rotation=game.actor.getWorldQuaternion(new THREE.Quaternion()),offset=new THREE.Vector3(name==='side'?1.7:0,name==='below'?-.6:.13,name==='back'?-1.7:name==='side'?0:1.7).applyQuaternion(rotation);camera.position.copy(target).add(offset);orbit.target.copy(target);camera.lookAt(target);orbit.update();renderer.render(scene,camera);},dispose(){disposed=true;cloth.dispose();orbit.dispose();panel.remove();style.remove();}};
 window.HumanShorts=api;for(const button of panel.querySelectorAll('[data-short-view]'))button.onclick=()=>api.setView(button.dataset.shortView);
 let panels=false;document.getElementById('shorts-panels').onclick=()=>{panels=!panels;cloth.setPanelReview(panels);renderer.render(scene,camera);};
 document.getElementById('shorts-physics-probe').onclick=()=>{const before=performance.now();game.step(1/240);const a=cloth.audit();document.getElementById('shorts-stage').textContent=`实测：布料应变 ${(a.mainStrain*100).toFixed(2)}% · 弹力 ${(a.elasticStrain*100).toFixed(1)}% · 此步 ${(performance.now()-before).toFixed(0)}ms · ${a.numericValid?'数值检查通过，完整接触仍待验收':'未通过，保留失败记录'}`;};
 const probeButton=document.getElementById('shorts-physics-probe');probeButton.disabled=true;probeButton.textContent='动作测试待穿着检查通过';
 const phaseNames={'main-rise':'前后中缝','gusset':'裆片','leg-sides-and-left-closure':'裤腿和侧缝','waistband':'腰头'};
 api.assemblyPromise=sewShortsSource(source,body,game.actor,scene,state=>{if(disposed){state.cloth.dispose();throw Error('Superseded clothing assembly');}cloth=state.cloth;api.assembly={status:state.status,stage:state.stage,pass:state.pass};document.getElementById('shorts-stage').textContent=`正在缝合${phaseNames[state.stage]}${state.pass?' · '+state.pass+' / 200':''}`;},cloth).then(result=>{if(disposed){result.cloth.dispose();return result;}cloth=result.cloth;api.assembly=result;document.getElementById('shorts-stage').textContent=result.status==='complete'?'19 条接缝已完成 · 当前为缝合后的折叠状态，穿着与动作仍待通过':'缝合检查未通过 · 已保留失败记录';return result;}).catch(error=>{api.assembly={status:'failed',error:error.message};if(!disposed)document.getElementById('shorts-stage').textContent='缝合停止：'+error.message;console.error(error);});
 api.setView('front');return api;
}
