import * as THREE from 'three';
import {SECTION_BASELINE} from './SectionField.js';
/** Adds controls to the SAME workbench. One renderer and one animation clock.
 * Cross-section lines are copied from the actual deformed vertex positions. */
export function createSectionReview(host,gray){
 const {rig,scene,camera,controls,requestRender,state}=host;
 const oldPanel=document.querySelector('.s1-panel'),parent=oldPanel.parentElement,keep=document.createElement('details');
 keep.className='s1-legacy';keep.innerHTML='<summary>第一阶段闭眼与轮廓检查（全部保留）</summary>';oldPanel.replaceWith(keep);keep.appendChild(oldPanel);
 const panel=document.createElement('section');panel.className='s1-panel';panel.id='s2Panel';
 panel.innerHTML=`<div class="s1-kicker">ET09 / STAGE 02</div><h2>眼角与眼睑分层</h2><span class="s1-tag">灰模 · 保留 S1.1 闭眼修复</span><p class="s1-copy">上睑：自由缘 → 睑板区 → 褶皱 → 眉下过渡。下睑：短隆起 → 柔和主体 → 鼻侧泪沟。眼角使用连接曲面。</p><button id="s2Neutral" class="s1-primary">中性睁眼 / 双眼</button><button id="s2Compare" class="s1-primary">按住：第二阶段修改前</button><div class="s1-pose"><button data-s2-close=".25">¼ 闭眼</button><button data-s2-close=".5">半闭眼</button><button data-s2-close=".75">¾ 闭眼</button><button data-s2-close="1">完全闭眼</button></div><div class="s1-grid"><button data-s2-view="right">人物右眼 · 特写</button><button data-s2-view="left">人物左眼 · 特写</button><button data-s2-view="medialR">右内眼角 · 近景</button><button data-s2-view="medialL">左内眼角 · 近景</button><button data-s2-view="obliqueR">右侧斜视角</button><button data-s2-view="obliqueL">左侧斜视角</button><button data-s2-view="under">深仰视检查</button><button data-s2-view="portrait">原头模全貌</button></div><label class="s1-check"><input id="s2Section" type="checkbox">显示实际网格截面线</label><label class="s1-check"><input id="s2Iris" type="checkbox" checked>灰色虹膜参照</label><div class="s1-grid"><button data-s2-light="left">左侧柔光</button><button data-s2-light="right">右侧柔光</button></div><p id="s2Status" class="s1-fine"></p><details><summary>截面与连接检查数据</summary><pre id="s2Report"></pre></details><p class="s1-fine">本页不加皮肤、湿润、睫毛或角膜光学。新结构是约束拟合，不是这个人物的真实睁眼扫描。动态仍沿用第一阶段，不宣称组织物理完成。</p><a class="s1-original" target="_blank" rel="noopener" href="https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/${SECTION_BASELINE}/skin-quality-lab/emily-transfer/preview.html">保留的 ET08-S1.1 ↗</a>`;
 parent.prepend(panel);
 document.title='眼角与眼睑分层 · ET09 第二阶段';document.querySelector('.version').textContent='ET09 · S2 / SECTION & CANTHUS';document.querySelector('.caption-title').textContent='第二阶段 / 眼角与眼睑分层';document.querySelector('.caption-small').textContent='灰模 · 可按住对照 · 闭眼修复保留';
 const lines=new THREE.Group();lines.name='ET09-actual-cross-section-lines';rig.group.add(lines);let selected='right',lastKey='';
 const refreshLines=()=>{
  const on=document.getElementById('s2Section').checked;lines.visible=on;if(!on)return;
  while(lines.children.length){const o=lines.children[0];lines.remove(o);o.geometry.dispose();o.material.dispose();}
  const data=rig.sections(selected);
  for(const k of ['upper','lower','upperMargin','lowerMargin','upperMucosa','lowerMucosa']){
   const points=data[k].map(p=>new THREE.Vector3(...p));const m=new THREE.LineBasicMaterial({color:k.includes('Mucosa')?0x8d9298:0xffffff,depthTest:false,transparent:true,opacity:.9});const o=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),m);o.renderOrder=10;lines.add(o);
  }
 };
 const refresh=()=>{const r=rig.sectionReport();document.getElementById('s2Report').textContent=JSON.stringify(r,null,2);document.getElementById('s2Status').textContent=(r.enabled?'ET09 第二阶段':'ET08-S1.1 修改前')+' · 闭合 '+Math.round(rig.config.manualBlink*100)+'% · 原眼裂与眼球标定保留';refreshLines();requestRender();return r;};
 const compare=on=>{rig.compareStage1(on);document.getElementById('s2Compare').classList.toggle('active',!!on);return refresh();};
 const pose=(b,angles={})=>{rig.closedRestEnabled=true;rig.contourBaseline=false;rig.setInspectionPose(b,angles);gray.refresh();return refresh();};
 const view=v=>{
  if(v==='medialR'||v==='medialL'){
   selected=v==='medialR'?'right':'left';const x=selected==='right'?-.019:.011,dist=camera.aspect<.9?.058:.040;
   controls.target.set(x,.068,.071);camera.position.set(x,.070,.071+dist);controls.update();state.camera='s2-'+v;
  }else if(v==='under'){window.__STAGE1__.underView();}
  else{if(v==='right'||v==='left')selected=v;gray.view(v);}
  refreshLines();requestRender();
 };
 const btn=document.getElementById('s2Compare');btn.onpointerdown=e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);compare(true);};for(const n of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(n,()=>compare(false));btn.onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();compare(true);}};btn.onkeyup=()=>compare(false);window.addEventListener('blur',()=>{if(rig.sectionEnabled===false)compare(false);});
 document.getElementById('s2Neutral').onclick=()=>{compare(false);pose(0);view('front');};
 for(const b of panel.querySelectorAll('[data-s2-close]'))b.onclick=()=>pose(+b.dataset.s2Close);
 for(const b of panel.querySelectorAll('[data-s2-view]'))b.onclick=()=>view(b.dataset.s2View);
 for(const b of panel.querySelectorAll('[data-s2-light]'))b.onclick=()=>gray.setLight(b.dataset.s2Light);
 document.getElementById('s2Section').onchange=refresh;
 document.getElementById('s2Iris').onchange=e=>window.__STAGE1__.iris(e.target.checked);
 document.getElementById('s1QuickCompare').onclick=()=>compare(rig.sectionEnabled!==false);
 document.getElementById('reset').addEventListener('click',()=>{compare(false);pose(0);view('front');});
 const originalRender=gray.render;gray.render=()=>{const k=rig.config.manualBlink+':'+rig.sectionEnabled;if(k!==lastKey){lastKey=k;refreshLines();}originalRender();document.getElementById('s1Status').textContent=(rig.sectionEnabled===false?'ET08-S1.1 对照':'ET09-S2 分层结构')+' · 闭合 '+Math.round(rig.config.manualBlink*100)+'% · 灰模';};
 window.__STAGE2__={version:'ET09-S2',baseline:SECTION_BASELINE,pose,compare,view,report:()=>rig.sectionReport(),sections:n=>rig.sections(n),audit:d=>rig.audit(d),globePixels:()=>window.__STAGE1__.globePixels(),sectionLines:on=>{document.getElementById('s2Section').checked=!!on;refresh();}};
 pose(0);view('front');state.stage='ET09-S2';return gray;
}
