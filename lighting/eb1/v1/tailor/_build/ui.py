from pathlib import Path
r=Path(__file__).resolve().parents[1];s=(r/'app.mjs').read_text()
a=s.index('import {loadCommon}');b=s.index('import {LOOKS}',a)
s=s[:a]+"import {loadPerson} from './person/load-person.mjs';\nimport {CommonViewer} from './person/Viewer.mjs';\nimport {MaterialLighting} from './lighting.mjs';\n"+s[b:]
s=s.replace("leather:'皮革 R12 / R10核',denim:'牛仔 R09 / R08棉纤维'", "leather:'皮革 R13 原生粒面',denim:'牛仔 R11 原生棉纤维'")
s=s.replace('error=null,env=null;', 'error=null,env=null,actor=null,lighting=null;')
s=s.replace("['gauge','diameter','depth','gap']", "['gauge','diameter','depth']")
a=s.index("+(m.family==='knit'?`<label class=");b=s.index(";\n $('parameter-description')",a)
s=s[:a]+";\n $('knit-side-note')?.remove()"+s[b:]
s=s.replace('两层均是实体纱线；线径与针距独立。过粗、过密的组合仍可能出现纱线互相挤入。','单层体积针织，外面统一正针、里面自然反针。线径、针距与线圈深度联动影响厚度；不再生成第二套针织，也不使用遮洞背板。')
a=s.index('function updatePhysics(');b=s.index('function controls()',a)
s=s[:a]+'''function syncBody(body){if(!body||!viewer)return;model.positions.set(body);const p=viewer.displayPositions;for(let i=0;i<body.length;i+=3){p[i]=body[i];p[i+1]=body[i+2];p[i+2]=-body[i+1];}viewer.geometry.attributes.position.needsUpdate=true;viewer.geometry.computeVertexNormals();viewer.geometry.computeBoundingSphere();viewer.skin?.update();}
function updatePhysics(rows,list=items,data=null){for(let i=0;i<Math.min(list.length,rows.length);i++){const it=list[i],g=it.mesh.geometry;if(rows[i].indices&&!it.orientationApplied){g.setIndex(rows[i].indices);it.orientationApplied=true;it.orientation=rows[i].orientation;}g.attributes.position.array.set(rows[i].positions);g.attributes.normal.array.set(rows[i].normals);g.attributes.position.needsUpdate=g.attributes.normal.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();it.solid?.motion(!!data?.audit?.cachedPhysicalReplay);it.solid?.deform();it.physicsAudit=rows[i].audit;}
 if(list===items){syncBody(data?.body);const t=data?.audit?.motionTime||rows[0]?.audit.seconds||0;const cached=data?.audit?.cachedPhysicalReplay;$('physics-status').textContent=cached?`原人物动作 ${t.toFixed(2)} 秒 · 已实算布料帧回放 · 上衣／裤装互碰撞参与求解`:`实际模拟 ${t.toFixed(2)} 秒 · ${physics?.running?'正在求解':'已暂停'} · 重力 ${physicsSettings.gravity?'开启':'关闭'} · 上衣／裤装接触已启用`;lighting?.dirty();viewer?.render();}}
''' +s[b:]
s=s.replace("for(const n of ['top-material'", "for(const b of document.querySelectorAll('[data-motion]'))b.disabled=!ready||!!pending;for(const n of ['top-material'")
s=s.replace('onFrame:rows=>updatePhysics(rows,next.length?next:items)', 'onFrame:(rows,data)=>updatePhysics(rows,next.length?next:items,data)')
s=s.replace("onProgress:p=>{if(token===request)message('原人物碰撞与重力松弛 · '+Math.round(p*100)+'%');}", "onProgress:(p,phase)=>{if(token===request)message((phase||'原人物及上下装碰撞')+' · '+Math.round(p*100)+'%');}")
s=s.replace('source.person,physicsSettings);', 'source.person,physicsSettings,actor,{look:id});')
s=s.replace('{signal,onProgress:(progress,panel)', '{signal,renderer:viewer.renderer,onProgress:(progress,panel)')
s=s.replace("updatePhysics(physics.rows);message('MP03：实体材料、真实重力与缝边约束已接入。可播放物理、抬起衣摆后松手；面料参数尚未实测标定。');", "updatePhysics(physics.rows,items,physics.frame);message('MP04：原生材料、单层针织与衣物互碰撞。点击人物动作观看身体与衣服一起变化；点击单灯环扫检查材质阴影。');")
s=s.replace("version:'MP03'", "version:'MP04'").replace("version:'MP03-R1'", "version:'MP04.1'")
s=s.replace('jointClothCollisionCertified:false', 'motionAndContact:physics?.frame?.audit||null,lighting:lighting?.audit(),jointClothCollisionCertified:false,interGarmentCollisionEnabled:true,knitDuplicateLayers:0')
s=s.replace("const loaded=await loadCommon({onProgress:p=>message('连接同一个原共同人物 · '+Math.round(p.fraction*100)+'%')});model=loaded.model;model.compute(defaultState());", "const loaded=await loadPerson(p=>message('连接同一个原共同人物 · '+Math.round(p.fraction*100)+'%'));model=loaded.model;actor=loaded.actor;")
s=s.replace('});studio();const originalRender', '});studio();lighting=new MaterialLighting(viewer);const originalRender')
s=s.replace("document.addEventListener('visibilitychange',()=>{if(document.hidden)physics?.pause();});", "document.addEventListener('visibilitychange',()=>{if(document.hidden){physics?.pause();lighting?.pause();}});\n for(const b of document.querySelectorAll('[data-motion]'))b.onclick=()=>{lighting?.pause();frame('whole','three');void physics?.playMotion(b.dataset.motion).catch(e=>message(e.message,true));};\n $('motion-pause').onclick=()=>physics?.pause();\n $('light-orbit').onclick=()=>{physics?.pause();macro('top');lighting.single();lighting.play();};$('light-pause').onclick=()=>lighting?.pause();$('light-studio').onclick=()=>lighting?.studio();$('light-angle').oninput=()=>{lighting.pause();if(lighting.mode!=='single')lighting.single();lighting.setAngle(Number($('light-angle').value));};\n $('body-visible').onchange=()=>{viewer.mesh.visible=$('body-visible').checked;lighting.dirty();viewer.render();};")
s=s.replace('window.__MP03__=window.__MP02__=', 'window.__MP04__=window.__MP03__=window.__MP02__=')
s=s.replace('debug:()=>({viewer,items})', 'playMotion:id=>physics?.playMotion(id),seekMotionFrame:i=>physics?.seekMotionFrame(i),orbitLight:angle=>{lighting.single();lighting.setAngle(angle);return lighting.audit();},studioLight:()=>lighting?.studio(),debug:()=>({viewer,items,physics,model,lighting})')
s=s.replace('KAOPU_MP03', 'KAOPU_MP04')
a=s.index('function macro(');b=s.index('function studio()',a)
s=s[:a]+'''function macro(role='top',point=null){const mesh=items[role==='bottom'?1:0]?.mesh;if(!mesh)return;const box=new THREE.Box3().setFromObject(mesh),center=box.getCenter(new THREE.Vector3()),dir=new THREE.Vector3().subVectors(viewer.camera.position,viewer.orbit.target).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),dir).normalize();if(!point){let hit=null;for(const dx of(role==='bottom'?[.11,-.11,0]:[0,.06,-.06])){const from=center.clone().addScaledVector(right,dx).addScaledVector(dir,2),ray=new THREE.Raycaster(from,dir.clone().negate());hit=ray.intersectObject(mesh,false)[0];if(hit)break;}if(!hit){message('没有命中衣物，请双击具体表面。',true);return;}point=hit.point;}
 viewer.orbit.target.copy(point);const family=items[role==='bottom'?1:0].info.family,d=family==='knit'?.18:family==='leather'?.11:.085;viewer.camera.position.copy(point).addScaledVector(dir,d);viewer.orbit.minDistance=.025;viewer.camera.updateProjectionMatrix();viewer.orbit.update();lighting?.dirty();viewer.render();}
''' +s[b:]
(r/'app.mjs').write_text(s)
s=(r/'index.html').read_text().replace('双层针织与皮革成衣 / MP03','原生材料与动作成衣 / MP04').replace('MP03-R1 · 双层结构 / 重力试验','MP04.1 · 原生材料 / 单层体积 / 人物动作').replace('SOLID TEXTILE EDIT / 03','SOLID TEXTILE EDIT / 04').replace('原共同人物、双层针织和皮革成衣','原共同人物、单层实体针织和皮革成衣')
s=s.replace('<p id="status"', '''<section class="light-box"><h2>材质特写 · 单灯环扫</h2><nav><button id="light-orbit">特写 · 单灯环扫</button><button id="light-pause">暂停灯光</button><button id="light-studio">恢复棚拍</button></nav><label>单灯角度 <input id="light-angle" type="range" min="0" max="360" value="35" step="1"></label><label><input id="body-visible" type="checkbox" checked> 显示原人物</label><p class="boundary">特写镜头固定，一盏灯沿表面观察点环行；关闭其他灯与环境照明。用背面视角检查毛衣外侧，再隐藏人物检查内侧与真实断面。</p></section><p id="status"''')
s=s.replace('<section class="physics-box"><h2>重力与服装接触</h2>','''<section class="physics-box"><h2>人物动作 · 上衣／裤装接触</h2><nav><button data-motion="raise">抬臂／放下</button><button data-motion="twist">躯干转动</button><button data-motion="step">抬腿／缓步</button><button id="motion-pause">暂停人物动作</button></nav><p class="boundary">默认动作回放真实求解的布料帧，不是把衣服蒙皮到人物。修改配方后，首次播放会重新实算并显示进度。动作前恢复初始衣形，不自动拼接未验证的循环。</p>''')
s=s.replace('双层针织共用布料求解面并保留层厚。','单层针织保留真实纱线与层厚，上衣和裤装联合求解。')
s=s.replace('改变针距、双层或厚度','改变针距、线径或厚度').replace('针织两层均为闭合纱线，内层错开半针，领口与下摆有包边连接，没有用不透明布片遮住孔隙。','针织只有一套闭合纱线；厚度来自原生线圈与真实截面，不是粗厚平板。外侧全为正针面，内侧自然为反面，不以人物前后决定。')
s=s.replace('按原裁片毫米坐标计算粒面和微观反光，不使用外观图片。','采用皮革 R13 原生程序生成的粒面、高度、法线、粗糙度与涂层，不载入外部外观照片。牛仔使用 R11 原生棉纤维与经纬截面。')
s=s.replace('MP03 · 原共同人物 × 实体材料 × 重力实验 · 毛衣双层、皮革粒面与缝边分别验收','MP04 · 原共同人物 × 原生材料 × 实算动作 · 单层针织 / 原生皮革针路 / 上下装碰撞')
a=s.index('<script type="importmap">');b=s.index('</script>',a)
s=s[:a]+'<script type="importmap">{"imports":{"three":"./vendor/three.module.js"}}</script>'+s[b+9:]
(r/'index.html').write_text(s)
s=(r/'style.css').read_text()+"\n.light-box{margin:18px 0;padding:16px;border:1px solid #aab4ae;border-radius:12px;background:#e6ebe5}.light-box h2{font-size:16px;margin:0 0 10px}.light-box nav,.physics-box nav{display:flex;gap:7px;flex-wrap:wrap}.light-box label{display:inline-flex;align-items:center;gap:8px;font-size:13px;margin:12px 12px 0 0}.light-box input[type=range]{width:180px} [data-motion]{font-weight:600;background:#d4e2d3}\n"
(r/'style.css').write_text(s)
s=(r/'looks.mjs').read_text().replace('反针条纹 · 针织短裤','正针条纹 · 针织短裤');(r/'looks.mjs').write_text(s)
