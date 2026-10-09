import * as THREE from 'three';
import {BASELINE,SPECS} from './Contours.mjs';
const ORIGINAL='https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+BASELINE+'/skin-quality-lab/emily-transfer/preview.html';
const css=`
.s1-panel{padding:20px 18px 18px;background:#212429;border-bottom:1px solid #494d53}.s1-kicker{font-size:10px;letter-spacing:1.8px;color:#b2b6bc}.s1-panel h2{margin:9px 0 9px;font-size:20px;font-weight:500;color:#eee;line-height:1.3}.s1-copy{font-size:11px;line-height:1.8;color:#a8adb5;margin:8px 0 15px}.s1-tag{display:inline-block;padding:3px 7px;border:1px solid #62666d;border-radius:4px;font-size:10px;color:#ddd}.s1-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:9px 0}.s1-grid button{font-size:11px;text-align:left;padding:8px;min-height:35px}.s1-pose{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:8px 0 12px}.s1-pose button{padding:7px 2px;font-size:10px}.s1-subhead{font-size:11px;color:#ddd;margin-top:18px}.s1-primary{width:100%;margin:2px 0 8px;background:#393d43;border-color:#8d9198;font-size:12px}.s1-check{display:flex;gap:7px;align-items:center;font-size:11px;color:#bfc2c7;margin:9px 0}.s1-readout{border-top:1px solid #4b4f55;margin-top:15px;padding-top:12px;font-size:11px}.s1-readout table{width:100%;border-collapse:collapse}.s1-readout th{text-align:right;font-weight:400;color:#ddd;padding:5px 0}.s1-readout th:first-child{text-align:left;color:#999}.s1-readout td{padding:5px 0;text-align:right;font-variant-numeric:tabular-nums;color:#bbb}.s1-readout td:first-child{text-align:left;color:#999}.s1-fine{font-size:10px;color:#969ca5;line-height:1.7}.s1-panel summary{font-size:11px;color:#a8adb5;cursor:pointer;padding:10px 0}.s1-panel pre{max-height:230px;overflow:auto;font-size:9px;white-space:pre-wrap;word-break:break-word;color:#acb1b8;background:#1b1e23;padding:10px}.s1-original{display:block;color:#c6c9cd;text-decoration:none;border-top:1px solid #444950;margin-top:14px;padding-top:14px;font-size:11px}.s1-legacy>summary{padding:16px 18px;cursor:pointer;color:#979da7;font-size:11px}.s1-legacy .hint{line-height:1.8}.s1-status{position:absolute;left:25px;bottom:82px;font-size:11px;color:#bbc0c8;pointer-events:none;background:#1e2229dc;border:1px solid #454a53;border-radius:4px;padding:6px 10px;z-index:2}.s1-quick{display:none}body.clean .s1-status,body.clean .s1-quick{display:none}.s1-panel button.active{border-color:#b9bfc7;color:#fff;background:#41464d}.s1-panel input{accent-color:#b6bdc7}@media(max-width:760px){.s1-status{left:12px;bottom:93px;right:12px;font-size:10px;max-width:max-content}.s1-quick{display:flex;position:absolute;left:12px;bottom:132px;gap:5px;z-index:2}.s1-quick button{font-size:10px;min-height:31px;background:#252a31e8}.caption-title{font-size:13px}.top-tools{max-height:72px;overflow:hidden}.method-badge{display:none!important}}
`;
const panel=`<div class="s1-kicker">ET08 / S1.1 · CLOSED SURFACE</div><h2>先看轮廓<br>不靠皮肤遮掩</h2><span class="s1-tag">灰模 · 独立左右眼曲线</span><p class="s1-copy">毛孔、修复贴图、皮脂、睫毛与泪膜均不参与本页画面。保留原扫描头和眼球尺寸，只检查轮廓与接触。</p><button class="s1-primary" id="s1Neutral">中性睁眼 / 回到正面</button><button class="s1-primary" id="s1ClosedCheck">完全闭眼 / 检查修复</button><button class="s1-primary" id="s1ClosureBefore">按住：修复前的 U 形</button><div class="s1-subhead">闭眼检查</div><div class="s1-pose"><button data-s1-closure=".25">¼ 闭眼</button><button data-s1-closure=".5">半闭眼</button><button data-s1-closure=".75">¾ 闭眼</button><button data-s1-closure="1">完全闭眼</button></div><button class="s1-primary" id="s1Compare">按住：原版轮廓（同一灰模）</button><div class="s1-grid"><button data-s1-view="right">人物右眼 · 特写</button><button data-s1-view="left">人物左眼 · 特写</button><button data-s1-view="obliqueR">右侧斜视角</button><button data-s1-view="obliqueL">左侧斜视角</button><button data-s1-view="below">略低视角</button><button data-s1-view="portrait">原头模全貌</button></div><label class="s1-check"><input id="s1Iris" type="checkbox" checked>灰色虹膜参照（不含光学效果）</label><label class="s1-check"><input id="s1Anchors" type="checkbox">显示轮廓控制点与闭合线</label><div class="s1-subhead">轮廓检验光</div><div class="s1-grid"><button data-s1-light="left" class="active">左侧柔光</button><button data-s1-light="right">右侧柔光</button></div><div id="s1Readout" class="s1-readout"></div><details><summary>查看固定坐标与拟合边界</summary><pre id="s1Coordinates"></pre></details><p class="s1-fine">本轮修复闭眼整片表面，并把眼角深度固定在原闭眼扫描上；不增加皮肤材质。闭眼扫描不能提供这个人真实睁眼后的隐藏结构；这些曲线是约束拟合。</p><a class="s1-original" href="${ORIGINAL}" target="_blank" rel="noopener">打开保留的 ET07.3 原版 ↗</a>`;
function greyMaterial(clip='',ocular=null){
 const m=new THREE.MeshStandardMaterial({color:0xb0b0b0,roughness:1,metalness:0,envMapIntensity:0});
 m.userData.stage1=true;m.userData.stage1Clip=clip;
 m.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 vS1Position;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvS1Position=position;');
  s.fragmentShader='varying vec3 vS1Position;\n'+s.fragmentShader;
  if(clip)s.fragmentShader=s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n'+clip);
  if(ocular){s.uniforms.uS1Iris=ocular.guide;s.fragmentShader='uniform float uS1Iris;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float r=length(vS1Position.xy);float f=step(0.,vS1Position.z)*uS1Iris;
    float iris=(1.-smoothstep(${ocular.radius*.435-.00002},${ocular.radius*.435+.00002},r))*f;
    float pupil=1.-smoothstep(.00168,.00172,r);
    diffuseColor.rgb*=mix(1.,.43,iris);diffuseColor.rgb*=mix(1.,.22,iris*pupil);
   `);
  }
 };
 m.customProgramCacheKey=()=>`ET08-grey-${clip}-${ocular?.radius||0}`;return m;
}
function greyDepth(clip){
 const m=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
 m.onBeforeCompile=s=>{s.vertexShader='varying vec3 vS1Position;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvS1Position=position;');s.fragmentShader='varying vec3 vS1Position;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n'+clip);};
 m.customProgramCacheKey=()=>`ET08-grey-depth-${clip}`;return m;
}
export function createGrayReview(host){
 const {rig,mesh,fuzz,renderer,scene,camera,controls,key,fill,rim,state,requestRender,setCamera}=host;
 const api={active:true,guide:{value:1},materials:[],light:'left',closure:0,anchors:false};
 const own=(o,m)=>{o.userData.et08OriginalMaterial=o.material;o.material=m;api.materials.push(m);};
 const bodyCut=`if(vS1Position.z>.045){${rig.eyes.map(e=>`{vec2 q=(vS1Position.xy-vec2(${e.c.x},${e.c.y}))/vec2(${e.c.rx},${e.c.ry});if(dot(q,q)<1.)discard;}`).join('')}}`;
 own(mesh,greyMaterial(bodyCut));mesh.customDepthMaterial=greyDepth(bodyCut);
 for(const e of rig.eyes){
  const c=e.c,clip=`vec2 q=(vS1Position.xy-vec2(${c.x},${c.y}))/vec2(${c.rx},${c.ry});if(dot(q,q)>1.000001)discard;`;
  own(e.lid.mesh,greyMaterial(clip));e.lid.mesh.material.side=THREE.DoubleSide;e.lid.mesh.customDepthMaterial=greyDepth(clip);
  own(e.lid.edge,greyMaterial());e.lid.edge.material.side=THREE.DoubleSide;
  own(e.lid.inside,greyMaterial());e.lid.inside.material.side=THREE.FrontSide;
  if(e.canthus){own(e.canthus.mesh,greyMaterial());e.canthus.mesh.material.side=THREE.DoubleSide;}
  own(e.ball,greyMaterial('',{radius:c.radius,guide:api.guide}));e.ball.receiveShadow=true;
  e.lid.mesh.castShadow=true;e.lid.edge.castShadow=true;e.lid.inside.castShadow=false;
 }
 if(rig.scanRepair)rig.scanRepair.uniforms.uRepairEnabled.value=0;
 api.originalEnvironment=scene.environment;scene.environment=null;scene.background=new THREE.Color(0x191c20);
 // A contour inspection is unshadowed diffuse look-development. PCF self-shadow
 // acne on thin contact sheets must not masquerade as tissue or extra folds.
 const grayFill=new THREE.AmbientLight(0xffffff,.35);grayFill.name='ET08-gray-diffuse-fill';scene.add(grayFill);renderer.shadowMap.enabled=false;
 key.shadow.camera.left=-.13;key.shadow.camera.right=.13;key.shadow.camera.top=.14;key.shadow.camera.bottom=-.14;key.shadow.camera.updateProjectionMatrix();key.shadow.normalBias=.00006;key.shadow.bias=-.000015;key.shadow.radius=4;
 const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
 const side=document.querySelector('.side'),legacy=document.createElement('details');legacy.className='s1-legacy';legacy.innerHTML='<summary>原工作台参数与行为控制（保留）</summary>';
 while(side.firstChild)legacy.appendChild(side.firstChild);side.appendChild(legacy);
 const ui=document.createElement('section');ui.className='s1-panel';ui.innerHTML=panel;side.prepend(ui);
 const status=document.createElement('div');status.className='s1-status';status.id='s1Status';document.getElementById('viewport').appendChild(status);
 const quick=document.createElement('div');quick.className='s1-quick';quick.innerHTML='<button data-quick="0">睁眼</button><button data-quick=".5">半闭</button><button data-quick="1">全闭</button><button id="s1QuickCompare">前后对照</button>';document.getElementById('viewport').appendChild(quick);
 for(const id of ['scanRepairCompare','compare','currentMethod','splitLine','splitLabels']){const el=document.getElementById(id);if(el)el.style.display='none';}
 document.title='闭眼表面修复 · ET08-S1.1';document.querySelector('.version').textContent='ET08 · S1.1 / CLOSED SURFACE';document.querySelector('.caption-title').textContent='第一阶段 / 闭眼表面修复';document.querySelector('.caption-small').textContent='拖动旋转 · 滚轮缩放 · 原头模与眼球尺寸保留';document.getElementById('layerLabel').textContent='无贴图灰模 · 非最终皮肤';
 const anchors=new THREE.Group();anchors.name='ET08-contour-diagnostics';rig.group.add(anchors);anchors.visible=false;
 api.refreshAnchors=()=>{
  while(anchors.children.length){const o=anchors.children[0];anchors.remove(o);o.geometry?.dispose();o.material?.dispose();}
  if(!api.anchors)return;
  for(const e of rig.eyes){
   rig._fittingEye=e;
   for(const upper of [true,false]){
    const pts=[];for(let i=0;i<=128;i++){const a=Math.acos((i/64-1)*e.c.sign);const p=rig.margin(e.c,upper?a:Math.PI*2-a,rig.config.manualBlink);p.z+=.00018;pts.push(p);}
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xf0f0f0,depthTest:false,transparent:true,opacity:.8}));anchors.add(line);
   }
   const pts=[];for(let i=0;i<=128;i++){const a=Math.acos((i/64-1)*e.c.sign),p=rig.margin(e.c,a,1);p.z+=.00025;pts.push(p);}
   anchors.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color:0x82888f,dashSize:.0007,gapSize:.0004,depthTest:false})));anchors.children.at(-1).computeLineDistances();
   for(const upper of [true,false])for(const [s] of SPECS[e.c.name][upper?'upper':'lower']){const a=Math.acos((s*2-1)*e.c.sign),p=rig.margin(e.c,upper?a:Math.PI*2-a,rig.config.manualBlink);p.z+=.0003;const dot=new THREE.Mesh(new THREE.SphereGeometry(.00016,10,8),new THREE.MeshBasicMaterial({color:upper?0xffffff:0x949aa2,depthTest:false}));dot.position.copy(p);anchors.add(dot);}
  }
  rig._fittingEye=null;
 };
 api.refresh=()=>{
  const report=rig.contourReport(),r=report.eyes[0],l=report.eyes[1],fmt=v=>v.toFixed(2);
  document.getElementById('s1Readout').innerHTML='<div class="s1-fine">中性轮廓锁定 · 单位 mm</div><table><thead><tr><th></th><th>人物右眼</th><th>人物左眼</th></tr></thead><tbody>'+[['眼裂宽度',r.widthMM,l.widthMM],['眼轴处高度',r.heightAtAxisMM,l.heightAtAxisMM],['上虹膜遮挡¹',r.upperIrisCoverProjectedMM,l.upperIrisCoverProjectedMM],['下虹膜遮挡¹',r.lowerIrisCoverProjectedMM,l.lowerIrisCoverProjectedMM]].map(([n,a,b])=>`<tr><td>${n}</td><td>${fmt(a)}</td><td>${fmt(b)}</td></tr>`).join('')+`<tr><td>外眼角倾斜</td><td>${fmt(r.canthalTiltDegrees)}°</td><td>${fmt(l.canthalTiltDegrees)}°</td></tr></tbody></table><div class="s1-fine">¹ 灰色投影参照，不含角膜折射。<br>左右眼球半径均保留 12.20 mm。</div>`;
  document.getElementById('s1Coordinates').textContent=JSON.stringify({baseline:BASELINE,calibration:rig.lockedCalibration,closedSurface:rig.closureSurfaceReport(),contour:report.eyes.map(e=>({name:e.name,nasalMM:e.nasalMM,temporalMM:e.temporalMM,upperPeakMM:e.upperPeakMM,lowerLowMM:e.lowerLowMM,closureCurveGapMM:e.closureCurveGapMM,actualClosedMarginGapMM:e.actualClosedMarginGapMM}))},null,2);
  status.textContent=(rig.contourBaseline?'原版 ET07.3':rig.closedRestEnabled===false?'修复前 ET08-S1':'ET08-S1.1 闭眼表面修复')+' · 闭合 '+Math.round(rig.config.manualBlink*100)+'% · '+(api.guide.value?'灰色虹膜参照':'纯灰几何');
  ui.querySelectorAll('[data-s1-closure]').forEach(b=>b.classList.toggle('active',Number(b.dataset.s1Closure)===rig.config.manualBlink));
  api.refreshAnchors();requestRender();return report;
 };
 api.pose=(closure=0,angles={})=>{api.closure=closure;rig.setInspectionPose(closure,angles);return api.refresh();};
 api.beforeRepair=on=>{rig.compareClosureBefore(on);document.getElementById('s1ClosureBefore').classList.toggle('active',!!on);return api.refresh();};
 api.compare=on=>{rig.compareOriginal(on);document.getElementById('s1Compare').classList.toggle('active',!!on);return api.refresh();};
 api.view=name=>{
  if(name==='portrait'){setCamera('portrait');requestRender();return;}
  const narrow=camera.aspect<.9,views={front:{p:[-.004,.074,narrow?.44:.265],t:[-.004,.069,.072]},right:{p:[-.030,.071,narrow?.185:.151],t:[-.030,.069,.066]},left:{p:[.0217,.071,narrow?.185:.151],t:[.0217,.069,.066]},obliqueR:{p:[-.102,.077,.206],t:[-.004,.069,.069]},obliqueL:{p:[.094,.077,.206],t:[-.004,.069,.069]},below:{p:[-.004,.026,.232],t:[-.004,.069,.069]}};
  const v=views[name]||views.front;camera.position.set(...v.p);controls.target.set(...v.t);controls.update();state.camera='s1-'+name;requestRender();
 };
 api.setLight=name=>{api.light=name;ui.querySelectorAll('[data-s1-light]').forEach(b=>b.classList.toggle('active',b.dataset.s1Light===name));renderer.shadowMap.needsUpdate=true;requestRender();};
 api.render=()=>{
  renderer.shadowMap.enabled=false;fuzz.visible=false;
  for(const e of rig.eyes){e.rim.mesh.visible=false;e.lashes.mesh.visible=false;e.ball.visible=true;}
  for(const m of api.materials){m.roughness=1;m.metalness=0;m.envMapIntensity=0;m.clearcoat=0;}
  key.color.set(0xffffff);fill.color.set(0xffffff);rim.color.set(0xffffff);key.intensity=2.4;fill.intensity=1.1;rim.intensity=.25;
  key.position.set(api.light==='right'?.32:-.32,.30,.42);fill.position.set(api.light==='right'?-.35:.35,.08,.40);key.target.position.set(-.004,.060,.060);scene.environment=null;
  anchors.visible=api.anchors;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.shadowMap.autoUpdate=false;renderer.setRenderTarget(null);renderer.clear();renderer.render(scene,camera);renderer.shadowMap.needsUpdate=false;
  const size=renderer.getDrawingBufferSize(new THREE.Vector2());document.getElementById('stats').textContent=size.x+' × '+size.y+' / '+Math.round(mesh.geometry.index.count/3000)+'K HEAD TRI';
 };
 api.diagnostics=()=>({stage:'ET08-S1',active:true,shadowMapsEnabled:renderer.shadowMap.enabled,inspectionLighting:'unshadowed diffuse / no screen-space occlusion',texturedVisibleMaterials:api.materials.filter(m=>m.map||m.normalMap||m.bumpMap||m.roughnessMap).length,clearcoatMax:Math.max(...api.materials.map(m=>m.clearcoat||0)),wetRimsVisible:rig.eyes.some(e=>e.rim.mesh.visible),eyelashesVisible:rig.eyes.some(e=>e.lashes.mesh.visible),fuzzVisible:fuzz.visible,originalHeadGeometryUUID:mesh.geometry.uuid,headVertices:mesh.geometry.attributes.position.count,headTriangles:mesh.geometry.index.count/3,sourceHeadReplaced:false,irisReference:!!api.guide.value,renderers:1,realMobileDeviceTested:false});
 document.getElementById('s1Neutral').onclick=()=>{api.beforeRepair(false);api.compare(false);api.pose(0);api.view('front');};
 document.getElementById('s1ClosedCheck').onclick=()=>{api.beforeRepair(false);api.compare(false);api.pose(1);api.view('front');};
 const before=document.getElementById('s1ClosureBefore');before.onpointerdown=e=>{e.preventDefault();before.setPointerCapture(e.pointerId);api.beforeRepair(true);};
 for(const n of ['pointerup','pointercancel','lostpointercapture'])before.addEventListener(n,()=>api.beforeRepair(false));
 before.onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();api.beforeRepair(true);}};before.onkeyup=()=>api.beforeRepair(false);window.addEventListener('blur',()=>{if(rig.closedRestEnabled===false)api.beforeRepair(false);});
 for(const b of ui.querySelectorAll('[data-s1-closure]'))b.onclick=()=>api.pose(Number(b.dataset.s1Closure));
 for(const b of ui.querySelectorAll('[data-s1-view]'))b.onclick=()=>api.view(b.dataset.s1View);
 for(const b of ui.querySelectorAll('[data-s1-light]'))b.onclick=()=>api.setLight(b.dataset.s1Light);
 for(const b of quick.querySelectorAll('[data-quick]'))b.onclick=()=>api.pose(Number(b.dataset.quick));
 document.getElementById('s1QuickCompare').onclick=()=>api.compare(!rig.contourBaseline);
 const compare=document.getElementById('s1Compare');compare.onpointerdown=e=>{e.preventDefault();compare.setPointerCapture(e.pointerId);api.compare(true);};
 for(const n of ['pointerup','pointercancel','lostpointercapture'])compare.addEventListener(n,()=>api.compare(false));
 compare.onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();api.compare(true);}};compare.onkeyup=()=>api.compare(false);window.addEventListener('blur',()=>{if(rig.contourBaseline)api.compare(false);});
 document.getElementById('s1Iris').onchange=e=>{api.guide.value=e.target.checked?1:0;api.refresh();};document.getElementById('s1Anchors').onchange=e=>{api.anchors=e.target.checked;api.refresh();};
 document.getElementById('reset').addEventListener('click',()=>{api.beforeRepair(false);api.compare(false);api.pose(0);api.view('front');});
 window.__STAGE1__={version:'ET08-S1.1',baseline:BASELINE,beforeRepair:api.beforeRepair,closedSurface:()=>rig.closureSurfaceReport(),globePixels:()=>probeGlobePixels(host),capturedReferenceFrame:()=>capturedReferenceFrame(host),pose:api.pose,compare:api.compare,view:api.view,setLight:api.setLight,report:()=>rig.contourReport(),audit:detailed=>rig.audit(detailed),diagnostics:api.diagnostics,iris:on=>{api.guide.value=on?1:0;document.getElementById('s1Iris').checked=!!on;api.refresh();},anchors:on=>{api.anchors=!!on;document.getElementById('s1Anchors').checked=!!on;api.refresh();}};
 api.pose(0);api.view('front');state.stage='ET08-S1';renderer.shadowMap.needsUpdate=true;return api;
}

// Actual occlusion test using a temporary object-ID pass, not a claim inferred
// from intersecting two contour curves. Respects the same head patch clipping.
function probeGlobePixels({rig,scene,camera,renderer}){
 const original=[],made=[],saved={target:renderer.getRenderTarget(),background:scene.background,environment:scene.environment,tone:renderer.toneMapping,space:renderer.outputColorSpace};
 const size=renderer.getDrawingBufferSize(new THREE.Vector2()),target=new THREE.WebGLRenderTarget(size.x,size.y),eyeSet=new Set(rig.eyes.map(e=>e.ball));
 let visible=0;const visibleLocations=[];
 try{
  scene.traverse(o=>{
   if(!o.isMesh||!o.material)return;original.push([o,o.material]);
   const material=new THREE.MeshBasicMaterial({color:eyeSet.has(o)?0xffffff:0x000000,side:o.material.side});
   const clip=o.material.userData?.stage1Clip;
   if(clip){material.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 vS1Position;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvS1Position=position;');shader.fragmentShader='varying vec3 vS1Position;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n'+clip);};material.customProgramCacheKey=()=>clip;}
   o.material=material;made.push(material);
  });
  scene.background=new THREE.Color(0);scene.environment=null;renderer.toneMapping=THREE.NoToneMapping;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);const pixels=new Uint8Array(size.x*size.y*4);renderer.readRenderTargetPixels(target,0,0,size.x,size.y,pixels);
  for(let i=0;i<pixels.length;i+=4)if(pixels[i]>128){visible++;if(visibleLocations.length<200)visibleLocations.push([i/4%size.x,size.y-1-Math.floor(i/4/size.x)]);}
  return {width:size.x,height:size.y,visibleGlobePixels:visible,visibleLocations,eyeObjectsHidden:rig.eyes.some(e=>!e.ball.visible)};
 }finally{for(const [o,m] of original)o.material=m;made.forEach(m=>m.dispose());target.dispose();scene.background=saved.background;scene.environment=saved.environment;renderer.toneMapping=saved.tone;renderer.outputColorSpace=saved.space;renderer.setRenderTarget(saved.target);}
}

// One diagnostic frame of the actual captured closed head for error attribution.
// Not the delivered rendering route. Original materials/visibility are restored
// immediately; the next normal render always uses the corrected live eyelids.
function capturedReferenceFrame({mesh,rig,fuzz,renderer,scene,camera}){
 const mat=mesh.material,visible=rig.group.visible,fv=fuzz.visible;
 const gray=new THREE.MeshStandardMaterial({color:0xb0b0b0,roughness:1,metalness:0,envMapIntensity:0});
 try{mesh.material=gray;rig.group.visible=false;fuzz.visible=false;renderer.setRenderTarget(null);renderer.clear();renderer.render(scene,camera);}
 finally{mesh.material=mat;rig.group.visible=visible;fuzz.visible=fv;gray.dispose();}
}
