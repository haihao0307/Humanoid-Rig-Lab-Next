import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {createShortsBodyAdapter} from './ShortsBodyAdapter.mjs';
import {createShortsGarmentDraft} from './ShortsGarmentDraft.mjs';
import {ShortsClothRuntime} from './ShortsClothRuntime.mjs';
import {SHORTS_VERSIONS} from './ShortsVersions.mjs';
import {createShortsManufacturingDraft} from './ShortsManufacturingDraft.mjs';
import {sewShortsSource} from './ShortsSewingAssembly.mjs';
import {measureShortsSkinTapes} from './ShortsBodyTape.mjs';
import {createShortsGarmentV9} from './ShortsGarmentV9.mjs';
import {solveShortsWearingMetric} from './ShortsWearingMetric.mjs';
import {refineShortsSurfaceDraft} from './ShortsSurfaceRefinement.mjs';
import {inspectShortsSurfaceQuality} from './ShortsSurfaceQuality.mjs';
import {compilePaperSurfaceModel,evaluatePaperSurface,garmentPipelineGate} from './ShortsPaperSurfaceModel.mjs';
import {inspectShortsTriangleCrossings} from './ShortsCoverageIntersection.mjs';
import {installShortsBarePelvis} from './ShortsBarePelvis.mjs';
import {createShortsSkinContactBody} from './ShortsSkinContactBody.mjs';
import {installShortsPaperResearch} from './ShortsPaperResearchWorkbench.mjs';

// Candidate integration owns clothing only; the user's original R008 app stays
// available as a separate entry while physical/skin gates are under review.
export function installShortsWorkbench(game,{renderer,camera,scene}){
 window.HumanShorts?.dispose();game.setPaused(true);
 const measuredBody=createShortsBodyAdapter(game.subject,game.actor,{contactExcludedParts:[9,10,19]});
 const barePelvis=installShortsBarePelvis(measuredBody,game.subject,game.actor);
 if(!barePelvis.report.closedSolidTopologyCertified||barePelvis.report.initialNativeBindWorldErrorM>1e-6)throw Error('Authored bare skin geometry/binding is not ready; preserve original pants');
 const body=createShortsSkinContactBody(measuredBody,barePelvis);
 const sourcePants=[9,10,19].map(id=>({id,material:game.subject.mesh.material[id],visible:game.subject.mesh.material[id].visible}));
 const setUnderlyingVisibility=fit=>{barePelvis.mesh.visible=fit;for(const p of sourcePants)p.material.visible=fit?false:p.visible;};
 const placementReference=createShortsGarmentDraft(measuredBody.measurements,{sectionAt:measuredBody.sectionAt,sagittalAtY:measuredBody.sagittalAtY,waistbandWidthM:.038});
 const skinTapes=measureShortsSkinTapes(measuredBody,barePelvis,game.actor,placementReference.receipt);
 const draft=createShortsGarmentV9(skinTapes,placementReference,{skinBody:body});
 body.update({time:0});
 if(window.__SHORTS_PAPER_RESEARCH__===true)return installShortsPaperResearch(game,{renderer,camera,scene,body,measuredBody,barePelvis,skinTapes,draft,sourcePants});
 // A measured style view is separate from the material-constrained assembly.
 // It may show waist/hem placement, but must never enable native cloth motion
 // or claim this contour loft has passed the source-paper strain audit.
 const acceptedSeed=null;
 let fitSource=draft;
 const clothOptions={membraneModel:'orthotropic-paper',paperMaterial:{warpNPerM:2000,weftNPerM:1200,shearNPerM:300},bendTopology:'within-piece-flat'};
 let fitPreview=new ShortsClothRuntime(fitSource,body,game.actor,scene,clothOptions);
 fitPreview.enabled=false;fitPreview.mesh.name='Measured waist and hem placement preview; NOT physical wearing';
 const source=createShortsManufacturingDraft(draft);let cloth=new ShortsClothRuntime(source,body,game.actor,scene,{activeSeamIDs:[],elasticEnabled:false});const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.minDistance=.65;orbit.maxDistance=6;orbit.enabled=true;
 const panel=document.createElement('div');panel.id='shorts-workbench';panel.innerHTML='<strong>R008 · 低腰松紧亚麻短裤</strong><p id="shorts-measure"></p><p id="shorts-stage">量体与初始穿着候选 · 运动未验收</p><div class="shorts-views"><button data-short-view="front">正面</button><button data-short-view="back">背面</button><button data-short-view="side">侧面</button><button data-short-view="below">裆部</button></div><button id="shorts-panels">裁片识别色</button><button id="shorts-physics-probe">执行一个真实布料子步</button><small>缺失的腰胯表面已按当前尺寸补造，并替换新版中的旧裤显示。补体为估计形状，完整布料与动作仍待验收。</small>';
 document.getElementById('shorts-workbench')?.remove();document.body.append(panel);const style=document.createElement('style');style.textContent='#shorts-workbench{position:absolute;right:16px;top:48px;width:265px;background:#14242ded;color:#e6efe9;padding:16px;border:1px solid #69877b;border-radius:10px;font:13px/1.6 system-ui;max-height:85vh;overflow:auto}#shorts-workbench button{padding:8px}#shorts-workbench strong{font-size:16px}#shorts-workbench p{font-size:12px;margin:9px 0}.shorts-views{display:flex;gap:4px}#shorts-stage{color:#f2d28b}#shorts-workbench small{display:block;margin-top:9px}@media(max-width:700px){body>aside{display:none}#shorts-workbench{right:8px;top:8px;width:200px;padding:10px;font-size:11px}#shorts-workbench strong{font-size:13px}#shorts-workbench small{font-size:10px}#hint{display:none}}';document.head.append(style);
 const measure=body.measurements;document.getElementById('shorts-measure').textContent=`实际身高 ${measure.heightM.toFixed(3)} m · 腰线降低 ${(draft.receipt.waistDropM*1000).toFixed(0)} mm · 布套 ${(draft.receipt.waistbandWidthM*1000).toFixed(0)} mm · 贴合：当前人物皮肤截面`;
 let disposed=false;const api={version:SHORTS_VERSIONS[1].revision,versionId:'lowrise',preserveOriginalSubjectClothing:true,get cloth(){return cloth;},body,measuredBody,barePelvis,get draft(){return fitSource;},measurementDraft:draft,source,game,get fitSource(){return fitSource;},acceptedSeed,get fitPreview(){return fitPreview;},coverageSnapshot(){return{originalSourceCoordinatesUnchanged:true,originalVersionAUnchanged:true,sourcePants:sourcePants.map(p=>({part:p.id,wasVisible:p.visible,visible:p.material.visible})),bareGeometryVisible:barePelvis.mesh.visible,generatedMissingSkin:true,estimatedAnatomy:true,actualContactScope:body.snapshot().sourceSurfaceScope,motionValidated:false};},fitStatus:'adjusting',inspectionMode:'fit',renderRequested:true,requestRender(){api.renderRequested=true;},consumeRenderRequest(){const value=api.renderRequested;api.renderRequested=false;return value;},inspection:true,simulationCertified:false,assembly:{status:'not-started'},measuredSnapshot:()=>body.measurements,audit:()=>cloth.audit(),snapshot:()=>cloth.snapshot(),updateCamera(){orbit.update();},step(dt){if(!api.simulationCertified)throw Error('Wearing and native motion have not passed; no physical step is allowed');cloth.advance(dt);},setView(name){const target=game.actor.localToWorld(new THREE.Vector3(0,draft.receipt.middleY-.12,0)),rotation=game.actor.getWorldQuaternion(new THREE.Quaternion()),offset=new THREE.Vector3(name==='side'?1.7:0,name==='below'?-.6:.13,name==='back'?-1.7:name==='side'?0:1.7).applyQuaternion(rotation);camera.position.copy(target).add(offset);orbit.target.copy(target);camera.lookAt(target);orbit.update();renderer.render(scene,camera);},dispose(){disposed=true;setUnderlyingVisibility(false);barePelvis.dispose();fitPreview.dispose();cloth.dispose();orbit.dispose();panel.remove();style.remove();}};
 api.inspectSurfaceQuality=()=>inspectShortsSurfaceQuality(fitPreview,{minimumWaistClearanceM:.0005,maximumWaistDistanceM:.006});
 api.inspectPaperPipeline=()=>{
  const paper=compilePaperSurfaceModel(fitSource),surface=evaluatePaperSurface(paper,fitPreview.positions,fitPreview.quotient);
  const gate=garmentPipelineGate({paper,surface});
  return {paper:{version:paper.version,status:paper.status,areaM2:paper.areaM2,massKg:paper.massKg,triangles:paper.triangles.length,sourceVertices:paper.sourceVertices,seams:paper.seams.map(s=>({id:s.id,status:s.status,pairedIntervalsCompatible:s.pairedIntervalsCompatible})),internalPaperHinges:paper.hinges.filter(h=>h.kind==='within-piece-flat-paper').length,seamLawsCalibrated:false},surface,gate};
 };
 api.inspectTriangleCrossings=()=>inspectShortsTriangleCrossings(fitPreview,measuredBody,barePelvis);
 window.HumanShorts=api;for(const button of panel.querySelectorAll('[data-short-view]'))button.onclick=()=>api.setView(button.dataset.shortView);
 const wireButton=document.createElement('button');wireButton.textContent='布面网格';wireButton.id='shorts-surface-wireframe';document.getElementById('shorts-panels').after(wireButton);wireButton.onclick=()=>{fitPreview.mesh.material.wireframe=!fitPreview.mesh.material.wireframe;api.requestRender();};
 let panels=false;document.getElementById('shorts-panels').onclick=()=>{panels=!panels;cloth.setPanelReview(panels);fitPreview.setPanelReview(panels);renderer.render(scene,camera);};
 document.getElementById('shorts-physics-probe').onclick=()=>{const before=performance.now();game.step(1/240);const a=cloth.audit();document.getElementById('shorts-stage').textContent=`实测：布料应变 ${(a.mainStrain*100).toFixed(2)}% · 弹力 ${(a.elasticStrain*100).toFixed(1)}% · 此步 ${(performance.now()-before).toFixed(0)}ms · ${a.numericValid?'数值检查通过，完整接触仍待验收':'未通过，保留失败记录'}`;};
 const probeButton=document.getElementById('shorts-physics-probe');probeButton.disabled=true;probeButton.textContent='动作测试待穿着检查通过';
 const modeButton=document.createElement('button');modeButton.id='shorts-inspection-mode';probeButton.before(modeButton);
 const modeNote=document.createElement('p');modeNote.id='shorts-mode-note';modeButton.after(modeNote);
 api.setInspectionMode=(mode,render=true)=>{if(!['fit','sewing'].includes(mode))throw Error('Unknown garment inspection mode');api.inspectionMode=mode;const fit=mode==='fit';setUnderlyingVisibility(fit);fitPreview.mesh.visible=fit;for(const s of fitPreview.stitches)s.line.visible=fit;cloth.mesh.visible=!fit;for(const s of cloth.stitches)s.line.visible=!fit;modeButton.textContent=fit?'查看布料缝合检查':'查看腰口和裤脚位置';modeNote.textContent=fit?'失败候选保留检查：腰头间距改善，但纸样应变与裆部交叉未通过。':'真实纸样缝合检查：当前仍为折叠制造状态，尚未通过穿着。';if(render)renderer.render(scene,camera);else api.requestRender();};
 modeButton.onclick=()=>{const next=api.inspectionMode==='fit'?'sewing':'fit';api.setInspectionMode(next);if(next==='sewing')api.startAssembly();};
 api.setInspectionMode('fit');
 orbit.addEventListener('change',()=>api.requestRender());
 document.addEventListener('input',api.requestRender);document.addEventListener('change',api.requestRender);
 const oldDispose=api.dispose;api.dispose=()=>{document.removeEventListener('input',api.requestRender);document.removeEventListener('change',api.requestRender);oldDispose();};
 const phaseNames={'main-rise':'前后中缝','gusset':'裆片','leg-sides-and-left-closure':'裤腿和侧缝','waistband':'腰头'};
 api.startAssembly=()=>{if(api.assemblyPromise)return api.assemblyPromise;api.assembly={status:'sewing'};api.assemblyPromise=api.fitPromise.then(()=>sewShortsSource(source,body,game.actor,scene,state=>{if(disposed){state.cloth.dispose();throw Error('Superseded clothing assembly');}cloth=state.cloth;api.setInspectionMode(api.inspectionMode,false);api.assembly={status:state.status,stage:state.stage,pass:state.pass};document.getElementById('shorts-stage').textContent=`正在缝合${phaseNames[state.stage]}${state.pass?' · '+state.pass+' / 200':''}`;},cloth)).then(result=>{if(disposed){result.cloth.dispose();return result;}cloth=result.cloth;api.setInspectionMode(api.inspectionMode,false);api.assembly=result;document.getElementById('shorts-stage').textContent=result.status==='complete'?'19 条接缝已完成 · 当前为缝合后的折叠状态，穿着与动作仍待通过':'缝合检查未通过 · 已保留失败记录';return result;}).catch(error=>{api.assembly={status:'failed',error:error.message};if(!disposed)document.getElementById('shorts-stage').textContent='缝合停止：'+error.message;console.error(error);});return api.assemblyPromise;};
 api.skinTapes=skinTapes;api.placementReference=placementReference;
 api.fitPromise=Promise.resolve().then(async()=>{
  const result=await solveShortsWearingMetric(fitPreview,{onProgress:s=>{if(disposed)throw Error('Superseded V9 fit');document.getElementById('shorts-stage').textContent=`V9 · 纸样与接触联合检查 ${s.iteration} / 40`;api.requestRender();}});
  // Live local diagnostics only, never a stored source mesh or material rest.
  api.coarseStaticSnapshot={frame:'current WORLD metres',sourceXYZ:Array.from({length:draft.sourceUV.length/2},(_,i)=>fitPreview.positions[fitPreview.quotient[i]].slice()),quotient:Array.from(fitPreview.quotient),time:fitPreview.time,steps:fitPreview.steps,authority:'actual final coarse static authoring state immediately before true source2D refinement',restFromXYZ:false};
  const ranges=new Map(draft.ranges.map(r=>[r.pieceId,r]));fitPreview.surfaceEvaluator=(id,p)=>[0,1,2].map(k=>p.sourceIndices.reduce((sum,i,j)=>sum+p.weights[j]*fitPreview.positions[fitPreview.quotient[ranges.get(id).offset+i]][k],0));
  const fine=refineShortsSurfaceDraft(draft,fitPreview,1);fitPreview.dispose();fitSource=fine;fitPreview=new ShortsClothRuntime(fitSource,body,game.actor,scene,clothOptions);fitPreview.enabled=false;fitPreview.mesh.name='V9 actual-skin source-paper candidate';
  result.refinedAuthoring=await solveShortsWearingMetric(fitPreview,{maximumIterations:20,onProgress:s=>{if(disposed)throw Error('Superseded refined V9 fit');document.getElementById('shorts-stage').textContent=`细分布面 · 材料与真实接触 ${s.iteration} / 20`;api.requestRender();}});
  result.finalAuthoringStage='actual refined source2D mesh; current cloth audit is authoritative';
  result.refinement=fine.receipt.surfaceRefinement;result.surfaceConstructed=true;result.finalMaterialAudit=fitPreview.audit(false);result.paperPipeline=api.inspectPaperPipeline();result.status=result.paperPipeline.gate.status;return result;
 }).then(result=>{api.fitResult=result;api.fitStatus=result.status;if(!disposed){api.setInspectionMode(api.inspectionMode,false);const check=result.paperPipeline;modeNote.textContent=`V9：实际皮肤量体、前后裆长预算闭合。实际布面最大主应变 ${(check.surface.maximumPrincipalStrain*100).toFixed(2)}%，限值 ${(check.surface.strainLimit*100).toFixed(0)}%。原版保留；当前候选尚未通过穿着与动作验收。`;document.getElementById('shorts-stage').textContent=`V9 · ${check.gate.status} · ${check.gate.blockedAt??'后续验收'} · 动作锁定`;api.requestRender();}return result;}).catch(error=>{api.fitStatus='failed';api.fitFailure=error.message;if(!disposed)document.getElementById('shorts-stage').textContent='V9 检查停止：'+error.message;return null;});
 api.setView('front');return api;
}
