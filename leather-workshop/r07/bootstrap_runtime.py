"""One-time expansion into readable R07 runtime; never changes the R06 source."""
from pathlib import Path
R=Path(__file__).resolve().parent
if (R/'site/runtime.js').exists():
 print('Expanded runtime already exists; preserving authoritative source.')
 raise SystemExit(0)
s=(R.parent/'r06/site/runtime.js').read_text()
s=s.replace("from './catalogue.js';","from '../../r06/site/catalogue.js';")
s=s.replace("const VERSION='R06.1'","const VERSION='R07.1'")
s=s.replace("let ready=false", "let craftConfig={thicknessScale:1,tension:.8,response:true,age:0,craft:'plain'},grabMode=false,productSolver=null,gripCollider=null,grabPlane=null,grabPointer=null;\nconst raycaster=new T.Raycaster();\nlet ready=false")
s=s.replace("antialias:true,alpha:false,powerPreference", "antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference")
s=s.replace("function render(t=0){if(!ready||mode==='baseline')return;allDirty=true;", "function render(t=0){if(!ready||mode==='baseline')return;")
s=s.replace("hero=makeProduct(id,heroMats);fitGround(hero);scene.add(hero);", "hero=makeProduct(id,heroMats,craftConfig);scene.add(hero);prepareGrab();")
s=s.replace("const s=PRODUCT_SPECS[id],m=productMaterials(library.small.get(s.defaultMaterial).material),o=makeProduct(id,m);const box=fitGround(o);", "const s=PRODUCT_SPECS[id],m=productMaterials(library.small.get(s.defaultMaterial).material),o=makeProduct(id,m,{thumbnail:true});const box=new T.Box3().setFromObject(o);")
s=s.replace("makeProduct('swatch',productMaterials(library.small.get('heritage').material));fitGround(sampleThumb);", "makeProduct('swatch',productMaterials(library.small.get('heritage').material),{thumbnail:true});")
s=s.replace("['wallet','belt','bag','hat','swatch']", "['wallet','belt','bag','cowboy','pirate','swatch']")
s=s.replace("function selectProduct(id){if(!PRODUCT_SPECS[id])", "function selectProduct(id){if(productSolver)productSolver.active=false;grabPointer=null;if(!PRODUCT_SPECS[id])")
s=s.replace("physicsPlaying=false;turning=false;$('autoRotate')", "physicsPlaying=false;turning=false;if(productSolver)productSolver.active=false;$('autoRotate')")
s=s.replace("function loop(t){requestAnimationFrame(loop);", "let simulationBudget=0;\nfunction loop(t){requestAnimationFrame(loop);")
s=s.replace("if(dirty||allDirty)render(t);", "if(mode==='products'&&productSolver?.active){simulationBudget+=dt;const steps=Math.min(6,Math.floor(simulationBudget/(1/240)));if(steps){simulationBudget-=steps/240;if(simulationBudget>.08)simulationBudget=.08;productSolver.step(steps);updateSkin(hero,productSolver);syncGripCollider();updateGrabUI();renderer.shadowMap.needsUpdate=true;dirty=true;}}\n if(dirty||allDirty)render(t);")
s=s.replace("function recipe(){return{", "function recipe(){return{craft:{...craftConfig},interactivePhysics:productSolver?.report(),")
s=s.replace("['Product shapes are dimensioned constructions, not solved full-garment physics','Only belt and card-holder prototype patterns available','Material appearance is not a measured mechanical calibration','Inherited R04 has no self-collision, friction, tearing or permanent folds']", "['R07 uses actual nodal shell dynamics while grabbing; no real-material calibration','Particle self-contact is not triangle CCD; fast folds can still intersect','Sewn yarn follows the moving surface, but tension/friction along the whole thread is not solved','Weathering and craft padding are author-controlled approximations, not chronological predictions','R04 experiment remains separate and unchanged']")
a=s.index(' const pointers=new Map();');b=s.index(" window.addEventListener('resize'",a)
s=s[:a]+''' const pointers=new Map();let pinch=0;const el=$('stage');
 el.onpointerdown=e=>{el.setPointerCapture(e.pointerId);turning=false;$('autoRotate').classList.remove('active');
  if(grabMode&&mode==='products'){const hit=hitProduct(e.clientX,e.clientY);if(hit){grabPointer=e.pointerId;grabPlane=new T.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new T.Vector3()),hit.point);const ids=[hit.face.a,hit.face.b,hit.face.c],P=gripCollider.geometry.attributes.position,tri=new T.Triangle(...ids.map(i=>new T.Vector3().fromBufferAttribute(P,i))),weights=tri.getBarycoord(hit.point,new T.Vector3()).toArray();productSolver.pick(ids,weights,hit.point.toArray());$('stage').style.cursor='grabbing';$('grabState').textContent='已抓住 · 按住拖动、晃动；松手保留惯性';dirty=true;}return;}
  pointers.set(e.pointerId,[e.clientX,e.clientY]);};
 el.onpointermove=e=>{if(grabPointer===e.pointerId&&productSolver?.grab){setRay(e.clientX,e.clientY);const point=raycaster.ray.intersectPlane(grabPlane,new T.Vector3());if(point){point.y=Math.max(8,point.y);productSolver.move(point.toArray());}dirty=true;return;}
  const old=pointers.get(e.pointerId);if(!old)return;pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const[a,b]=[...pointers.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch)distance=Math.max(25,Math.min(3000,distance*pinch/d));pinch=d;}else{yaw-=(e.clientX-old[0])*.006;pitch=Math.max(-1.47,Math.min(1.47,pitch+(e.clientY-old[1])*.005));}dirty=true;};
 for(const name of['onpointerup','onpointercancel','onlostpointercapture'])el[name]=e=>{pointers.delete(e.pointerId);pinch=0;if(grabPointer===e.pointerId){productSolver.release();grabPointer=null;el.style.cursor=grabMode?'grab':'move';$('grabState').textContent='已松手 · 继续下落与接触，不冻结产品';dirty=true;}};
 el.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(25,Math.min(3000,distance*Math.exp(e.deltaY*.001)));dirty=true;},{passive:false});
 $('grabTool').onclick=()=>{grabMode=!grabMode;$('grabTool').classList.toggle('active',grabMode);el.style.cursor=grabMode?'grab':'move';productSolver?.release();grabPointer=null;$('grabState').textContent=grabMode?'抓手模式：按住皮料任意位置，再拖动；松手抛放':'观察模式：拖动旋转产品';};
 $('resetProduct').onclick=()=>{productSolver.reset();updateSkin(hero,productSolver);syncGripCollider();updateGrabUI();setView('home');$('grabState').textContent=grabMode?'已归位 · 按住皮料抓起':'已归位';};
 $('pauseProduct').onclick=()=>{productSolver.active=!productSolver.active;$('pauseProduct').textContent=productSolver.active?'暂停受力':'继续受力';};
 for(const [id,key]of[['craftChoice','craft'],['ageChoice','age'],['thicknessChoice','thicknessScale']])$(id).onchange=()=>{craftConfig[key]=key==='craft'?$(id).value:Number($(id).value);selectProduct(product);};
 const rebuildComparison=()=>{const saved={yaw,pitch,distance,target:target.clone(),view};selectProduct(product);yaw=saved.yaw;pitch=saved.pitch;distance=saved.distance;target.copy(saved.target);view=saved.view;dirty=true;};
 for(const[id,t]of[['tensionLoose',0],['tensionNormal',.8],['tensionTight',1.6]])$(id).onclick=()=>{craftConfig.tension=t;rebuildComparison();};
 $('responseCompare').onpointerdown=e=>{e.preventDefault();craftConfig.response=false;rebuildComparison();};for(const event of['onpointerup','onpointerleave','onpointercancel'])$('responseCompare')[event]=()=>{if(!craftConfig.response){craftConfig.response=true;rebuildComparison();}};
 window.addEventListener('keydown',e=>{if(e.key==='Escape'){productSolver?.release();grabPointer=null;}});
''' +s[b:]
a=s.index('function setupUI(){')
s=s[:a]+'''function prepareGrab(){productSolver=new ProductShell(hero.userData.rig.data);if(gripCollider){gripCollider.geometry.dispose();gripCollider.material.dispose();}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(hero.userData.rig.data.positions,3));g.setIndex(hero.userData.rig.data.triangles.flatMap(q=>q.slice(0,3)));gripCollider=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));syncGripCollider();updateGrabUI();}
function syncGripCollider(){const p=gripCollider.geometry.attributes.position;for(let i=0;i<productSolver.x.length;i++)p.array[i]=productSolver.x[i]*1000;p.needsUpdate=true;gripCollider.geometry.computeBoundingSphere();gripCollider.updateMatrixWorld(true);}
function setRay(x,y){const r=$('stage').getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),camera);}
function hitProduct(x,y){syncGripCollider();setRay(x,y);return raycaster.intersectObject(gripCollider,false)[0]||null;}
function updateGrabUI(){if(!productSolver)return;const p=productSolver.report();$('grabStats').textContent=`皮料与五金 ${p.massG.toFixed(1)} g · ${p.nodeCount} 个物理节点\\n物理时间 ${p.timeS.toFixed(2)} s · 最大伸长 ${(100*(p.maxStretch-1)).toFixed(2)}%\\n抓点误差 ${p.grabErrorMM.toFixed(2)} mm · 抓力 ${p.grabForceN.toFixed(2)} N`;$('thicknessInfo').textContent=`当前单层厚度 ${(PRODUCT_SPECS[product].t*craftConfig.thicknessScale).toFixed(2)} mm；厚度同时进入几何、面积质量、膜能量与 t³ 弯曲刚度。`;if(p.failed){$('grabState').textContent=p.failed;productSolver.active=false;}}
''' +s[a:]
s=s.replace('selectProduct,selectMaterial,setLight,setView,switchMode,render,recipe,frameAudit,patternSVG,audit:', '''selectProduct,selectMaterial,setLight,setView,switchMode,render,recipe,frameAudit,patternSVG,
 get productPhysics(){return productSolver?.report();},
 get config(){return {...craftConfig};},
 configure:o=>{Object.assign(craftConfig,o);selectProduct(product);},
 grabTest:async(swing=true)=>{const d=hero.userData.rig.data,q=d.triangles[Math.floor(d.triangles.length*.42)],ids=q.slice(0,3),p=[0,0,0];for(const id of ids)for(let j=0;j<3;j++)p[j]+=productSolver.x[id*3+j]*1000/3;productSolver.pick(ids,[1/3,1/3,1/3],p);const start=productSolver.x.slice();for(let k=0;k<160;k++){productSolver.move([p[0]+(swing?Math.sin(k/20)*55:0),p[1]+Math.min(220,k*2),p[2]+(swing?Math.sin(k/29)*30:0)]);productSolver.step();}const held=productSolver.report();productSolver.release();for(let k=0;k<48;k++)productSolver.step();productSolver.active=false;updateSkin(hero,productSolver);syncGripCollider();dirty=true;render();return{held,released:productSolver.report(),positionsChanged:productSolver.x.some((x,i)=>Math.abs(x-start[i])>.002)};},
 resetGrab:()=>{productSolver.reset();updateSkin(hero,productSolver);syncGripCollider();dirty=true;render();},
 audit:''')
s=s.replace("thumbs:{materials:materialCards.length,products:productCards.length}","thumbs:{materials:materialCards.length,products:productCards.length},config:{...craftConfig},productPhysics:productSolver?.report()")
s=s.replace("function destroyGeometry(root){if(!root)return;", "function destroyGeometry(root){if(!root)return;root.userData.rig?.texture.dispose();")
s=s.replace("'三维结构候选 · 待你验收'", "'连续穿线 + 局部皮面响应 · 抓手可验'")
s=s.replace("s.size;", "s.size+' · 厚度倍率 '+craftConfig.thicknessScale.toFixed(2);",1)
s=s.replace("'本款可旋转检查材料与结构；尚未提供可用纸样或整件产品的物理求解。'", "'可抓取检查独立 R07 壳体受力。材料未实测标定；自接触为粒子级，不保证极端甩动不穿透。帽子尚无实物打样纸样。'")
s=s.replace("'提供尺寸与孔位一致的试作纸样，仍需废皮打样。成品造型不冒称整衣物理。'", "'提供当前裁片尺寸与孔位的试作纸样。抓手是 R07 壳体求解；完整缝线张力传播、摩擦及针孔损伤未求解。'")
s=s.replace("'CONSTRUCTED IN MILLIMETRES'", "'R05 SEWING / R07 SHELL / MILLIMETRES'")
s=s.replace("function selectProduct(id){if(productSolver)","function selectProduct(id){if(['belt','cowboy','pirate'].includes(id))craftConfig.craft='plain';if(productSolver)")
s=s.replace("const c=CATALOGUE.find(c=>c.id===material),s=PRODUCT_SPECS[product];", "const c=CATALOGUE.find(c=>c.id===material),s=PRODUCT_SPECS[product];$('craftChoice').disabled=['belt','cowboy','pirate'].includes(product);$('craftChoice').value=craftConfig.craft;")
(R/'site/runtime.js').write_text(s)
t=(R.parent/'r06/site/template.html').read_text().replace('R06.1','R07.1').replace('R06 产品','R07 产品').replace('R06 中','R07 中')
t=t.replace('grid-template-columns:repeat(5,minmax(0,1fr))','grid-template-columns:repeat(6,minmax(0,1fr))')
t=t.replace('touch-action:none;cursor:grab','touch-action:none;cursor:move')
t=t.replace('<button id="autoRotate">转台</button>','<button id="autoRotate">转台</button><button id="grabTool">抓手</button><button id="resetProduct">归位</button><button id="pauseProduct">暂停受力</button>')
t=t.replace('<div id="productControls">','''<div id="productControls"><p class="eyebrow">SEWING / MATERIAL HISTORY</p>
<label for="craftChoice">皮革工艺（卡包 / 肩包 / 皮样）</label><select id="craftChoice"><option value="plain">原皮 · 手工缝线</option><option value="diamond">菱形绗缝</option><option value="grid">方格绗缝</option><option value="channels">条形绗缝</option><option value="perforated">透气贯穿孔</option><option value="woven">交错编织层</option></select>
<label for="ageChoice">使用与自然风化</label><select id="ageChoice"><option value="0">新制 · 轻蜡封边</option><option value="0.55">使用磨亮 · 边角磨损</option><option value="1">风化旧物 · 褪色与细划痕</option></select>
<label for="thicknessChoice">同一配方下的厚薄对照</label><select id="thicknessChoice"><option value="0.65">薄软 · 0.65×</option><option value="1" selected>常规 · 1.00×</option><option value="1.65">厚挺 · 1.65×</option></select><p class="state" id="thicknessInfo"></p>
<div class="sewTests"><button id="tensionLoose">松线</button><button id="tensionNormal">正常收线</button><button id="tensionTight">较紧</button><button id="responseCompare">按住：无牵拉对照</button></div>
<div class="line"></div><p class="eyebrow">DIRECT GRAB / SHELL DYNAMICS</p><p id="grabState">点「抓手」，按住产品任意位置抓起，再拖动、晃动或松手。</p><div id="grabStats"></div>
''')
t=t.replace('原 R01–R05 与旧入口保持不变。此处是独立 R07 产品与材料适配层。','原 R01–R06 与旧入口保持不变。针孔、连续针路及局部牵动来自 R05；抓手使用独立 R07 壳体积分。')
t=t.replace('程序化三维产品 · 无生成图片替代','工艺、薄厚与风化由配方控制 · 未实物标定')
t=t.replace('</style>', '''.details .sewTests{display:flex;flex-wrap:wrap;gap:4px}.sewTests button{font-size:9px;padding:5px 7px}#grabStats{font:9px/1.8 monospace;white-space:pre-line;color:#50614e}#grabState{font-size:10px}.details .state{font-size:9px}.details select{padding:5px;font-size:10px;margin:6px 0 10px}@media(max-width:760px){.product-card b{font-size:8px}.product-card span.note{font-size:6px}.tools{gap:3px}.tools button{font-size:8px;padding:5px}.collection{gap:4px}.product-card .thumb{height:50px}}
</style>''')
(R/'site/template.html').write_text(t)
print('Expanded actual R07 runtime and UI; immutable R06 sources preserved.')
