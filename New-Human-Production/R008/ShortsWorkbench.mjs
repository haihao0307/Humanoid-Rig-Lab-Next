import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {createShortsBodyAdapter} from './ShortsBodyAdapter.mjs';
import {createShortsGarmentDraft} from './ShortsGarmentDraft.mjs';
import {ShortsClothRuntime} from './ShortsClothRuntime.mjs';
import {SHORTS_VERSIONS} from './ShortsVersions.mjs';
import {createShortsManufacturingDraft} from './ShortsManufacturingDraft.mjs';
import {sewShortsSource} from './ShortsSewingAssembly.mjs';
import {createShortsAcceptedSeedTransfer} from './ShortsAcceptedSeedTransfer.mjs';
import {solveShortsWearingMetric} from './ShortsWearingMetric.mjs';

// Candidate integration owns clothing only; the user's original R008 app stays
// available as a separate entry while physical/skin gates are under review.
export function installShortsWorkbench(game,{renderer,camera,scene}){
 window.HumanShorts?.dispose();game.setPaused(true);
 const body=createShortsBodyAdapter(game.subject,game.actor);
 const draft=createShortsGarmentDraft(body.measurements,{sectionAt:body.sectionAt,sagittalAtY:body.sagittalAtY,waistbandWidthM:.038});
 body.update({time:0});
 // A measured style view is separate from the material-constrained assembly.
 // It may show waist/hem placement, but must never enable native cloth motion
 // or claim this contour loft has passed the source-paper strain audit.
 const liveReference=window.parent!==window?window.parent.ShortVersion?.acceptedReference:null;
 const fitSource=liveReference?createShortsAcceptedSeedTransfer(draft,liveReference):draft;
 const fitPreview=new ShortsClothRuntime(fitSource,body,game.actor,scene,{elasticEnabled:false});
 fitPreview.enabled=false;fitPreview.mesh.name='Measured waist and hem placement preview; NOT physical wearing';
 const source=createShortsManufacturingDraft(draft);let cloth=new ShortsClothRuntime(source,body,game.actor,scene,{activeSeamIDs:[],elasticEnabled:false});const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.minDistance=.65;orbit.maxDistance=6;orbit.enabled=true;
 const panel=document.createElement('div');panel.id='shorts-workbench';panel.innerHTML='<strong>R008 · 低腰松紧亚麻短裤</strong><p id="shorts-measure"></p><p id="shorts-stage">量体与初始穿着候选 · 运动未验收</p><div class="shorts-views"><button data-short-view="front">正面</button><button data-short-view="back">背面</button><button data-short-view="side">侧面</button><button data-short-view="below">裆部</button></div><button id="shorts-panels">裁片识别色</button><button id="shorts-physics-probe">执行一个真实布料子步</button><small>人物现有原裤下面缺少裸身腰胯。本候选保留原衣物作对照与碰撞包络，尚未补造裸身。</small>';
 document.getElementById('shorts-workbench')?.remove();document.body.append(panel);const style=document.createElement('style');style.textContent='#shorts-workbench{position:absolute;right:16px;top:48px;width:265px;background:#14242ded;color:#e6efe9;padding:16px;border:1px solid #69877b;border-radius:10px;font:13px/1.6 system-ui;max-height:85vh;overflow:auto}#shorts-workbench button{padding:8px}#shorts-workbench strong{font-size:16px}#shorts-workbench p{font-size:12px;margin:9px 0}.shorts-views{display:flex;gap:4px}#shorts-stage{color:#f2d28b}#shorts-workbench small{display:block;margin-top:9px}@media(max-width:700px){body>aside{display:none}#shorts-workbench{right:8px;top:8px;width:200px;padding:10px;font-size:11px}#shorts-workbench strong{font-size:13px}#shorts-workbench small{font-size:10px}#hint{display:none}}';document.head.append(style);
 const measure=body.measurements;document.getElementById('shorts-measure').textContent=`实际身高 ${measure.heightM.toFixed(3)} m · 腰线降低 ${(draft.receipt.waistDropM*1000).toFixed(0)} mm · 布套 ${(draft.receipt.waistbandWidthM*1000).toFixed(0)} mm · 量体来源：当前原衣物外包络`;
 let disposed=false;const api={version:SHORTS_VERSIONS[1].revision,versionId:'lowrise',preserveOriginalSubjectClothing:true,get cloth(){return cloth;},body,draft,source,game,fitSource,fitPreview,fitStatus:liveReference?'adjusting':'reference-missing',inspectionMode:'fit',renderRequested:true,requestRender(){api.renderRequested=true;},consumeRenderRequest(){const value=api.renderRequested;api.renderRequested=false;return value;},inspection:true,simulationCertified:false,assembly:{status:'not-started'},measuredSnapshot:()=>body.measurements,audit:()=>cloth.audit(),snapshot:()=>cloth.snapshot(),updateCamera(){orbit.update();},step(dt){if(!api.simulationCertified)throw Error('Wearing and native motion have not passed; no physical step is allowed');cloth.advance(dt);},setView(name){const target=game.actor.localToWorld(new THREE.Vector3(0,draft.receipt.middleY-.12,0)),rotation=game.actor.getWorldQuaternion(new THREE.Quaternion()),offset=new THREE.Vector3(name==='side'?1.7:0,name==='below'?-.6:.13,name==='back'?-1.7:name==='side'?0:1.7).applyQuaternion(rotation);camera.position.copy(target).add(offset);orbit.target.copy(target);camera.lookAt(target);orbit.update();renderer.render(scene,camera);},dispose(){disposed=true;fitPreview.dispose();cloth.dispose();orbit.dispose();panel.remove();style.remove();}};
 window.HumanShorts=api;for(const button of panel.querySelectorAll('[data-short-view]'))button.onclick=()=>api.setView(button.dataset.shortView);
 let panels=false;document.getElementById('shorts-panels').onclick=()=>{panels=!panels;cloth.setPanelReview(panels);fitPreview.setPanelReview(panels);renderer.render(scene,camera);};
 document.getElementById('shorts-physics-probe').onclick=()=>{const before=performance.now();game.step(1/240);const a=cloth.audit();document.getElementById('shorts-stage').textContent=`实测：布料应变 ${(a.mainStrain*100).toFixed(2)}% · 弹力 ${(a.elasticStrain*100).toFixed(1)}% · 此步 ${(performance.now()-before).toFixed(0)}ms · ${a.numericValid?'数值检查通过，完整接触仍待验收':'未通过，保留失败记录'}`;};
 const probeButton=document.getElementById('shorts-physics-probe');probeButton.disabled=true;probeButton.textContent='动作测试待穿着检查通过';
 const modeButton=document.createElement('button');modeButton.id='shorts-inspection-mode';probeButton.before(modeButton);
 const modeNote=document.createElement('p');modeNote.id='shorts-mode-note';modeButton.after(modeNote);
 api.setInspectionMode=(mode,render=true)=>{if(!['fit','sewing'].includes(mode))throw Error('Unknown garment inspection mode');api.inspectionMode=mode;const fit=mode==='fit';fitPreview.mesh.visible=fit;for(const s of fitPreview.stitches)s.line.visible=fit;cloth.mesh.visible=!fit;for(const s of cloth.stitches)s.line.visible=!fit;modeButton.textContent=fit?'查看布料缝合检查':'查看腰口和裤脚位置';modeNote.textContent=fit?(liveReference?'原版折叠方向用于新版试穿；腰口降低，裤脚目标保留。尚未通过完整布料应变、穿着与动作检查。':'量体位置预览：腰口下降，裤脚目标保留。尚未通过布料悬垂、穿着与动作检查。'):'真实纸样缝合检查：当前仍为折叠制造状态，尚未通过穿着。';if(render)renderer.render(scene,camera);else api.requestRender();};
 modeButton.onclick=()=>{const next=api.inspectionMode==='fit'?'sewing':'fit';api.setInspectionMode(next);if(next==='sewing')api.startAssembly();};
 api.setInspectionMode('fit');
 orbit.addEventListener('change',()=>api.requestRender());
 document.addEventListener('input',api.requestRender);document.addEventListener('change',api.requestRender);
 const oldDispose=api.dispose;api.dispose=()=>{document.removeEventListener('input',api.requestRender);document.removeEventListener('change',api.requestRender);oldDispose();};
 const phaseNames={'main-rise':'前后中缝','gusset':'裆片','leg-sides-and-left-closure':'裤腿和侧缝','waistband':'腰头'};
 api.startAssembly=()=>{if(api.assemblyPromise)return api.assemblyPromise;api.assembly={status:'sewing'};api.assemblyPromise=api.fitPromise.then(()=>sewShortsSource(source,body,game.actor,scene,state=>{if(disposed){state.cloth.dispose();throw Error('Superseded clothing assembly');}cloth=state.cloth;api.setInspectionMode(api.inspectionMode,false);api.assembly={status:state.status,stage:state.stage,pass:state.pass};document.getElementById('shorts-stage').textContent=`正在缝合${phaseNames[state.stage]}${state.pass?' · '+state.pass+' / 200':''}`;},cloth)).then(result=>{if(disposed){result.cloth.dispose();return result;}cloth=result.cloth;api.setInspectionMode(api.inspectionMode,false);api.assembly=result;document.getElementById('shorts-stage').textContent=result.status==='complete'?'19 条接缝已完成 · 当前为缝合后的折叠状态，穿着与动作仍待通过':'缝合检查未通过 · 已保留失败记录';return result;}).catch(error=>{api.assembly={status:'failed',error:error.message};if(!disposed)document.getElementById('shorts-stage').textContent='缝合停止：'+error.message;console.error(error);});return api.assemblyPromise;};
 api.fitPromise=(liveReference?solveShortsWearingMetric(fitPreview,{maximumIterations:40,heightToleranceM:.008,onProgress:()=>{if(disposed)throw Error('Superseded fit inspection');}}):Promise.resolve(null)).then(result=>{api.fitResult=result;api.fitStatus=result?.status??'reference-missing';if(!disposed){api.setInspectionMode(api.inspectionMode,false);modeNote.textContent=result?'原版折叠方向已用于新版试穿；腰口降低，裤脚目标保留。尚未通过完整布料应变、穿着与动作检查。':'未读到原版折叠参考，仅显示量体位置；请使用原版／新版双版本入口。尚未通过穿着。';document.getElementById('shorts-stage').textContent=result?'试穿候选 · 布料检查未通过，动作暂未开放':'量体位置预览 · 请从双版本入口打开';api.requestRender();}return result;}).catch(error=>{api.fitStatus='failed';if(!disposed)document.getElementById('shorts-stage').textContent='试穿检查停止：'+error.message;return null;});
 api.setView('front');return api;
}
