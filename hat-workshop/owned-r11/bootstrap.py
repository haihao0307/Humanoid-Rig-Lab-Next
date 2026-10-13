"""Prepare readable R11 sources once. Only owned-r11 is written; old versions stay frozen."""
from pathlib import Path
import hashlib,json,shutil
R=Path(__file__).resolve().parent;B=R.parent/'owned-r10'
if (R/'SOURCE_APPLIED.json').exists():
 print('R11 already prepared; refusing to replay over newer edits');raise SystemExit(0)
expected={'src/catalog.js':'ea4016145c82858ec9b1531bd19083d04e97468e77d3f9e5a80333bc3d855157','src/shape.js':'003469e7f9974bf10e9ff3645badbfc22489f5821566da49cb86ed73eb200d2f','src/viewer.js':'12e39e523936a81b5f633208185928206276711f2b08d92f438061808a3469cd','shell.html':'043284d10a2f58f05b8b1ab77e6d964e0d17e53fd4eb457ae87aad7224f45b90','build.py':'e82993aff7e96ef54403a1ae370567afdfb023d7a9e5d8d802ab3b124234a697','package-lock.json':'6ac4c128f0e61616c2311a2df3031df1de42b60f3a532f974cd2b05a2fad9352'}
for f,h in expected.items():
 assert hashlib.sha256((B/f).read_bytes()).hexdigest()==h,'Baseline changed: '+f
for f in [*expected,'package.json','THIRD_PARTY_NOTICES.txt','PROVENANCE.md']:
 (R/f).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(B/f,R/f)

def edit(name,fn):
 p=R/name;p.write_text(fn(p.read_text()))
def geometry(s):
 s=s.replace("const cuff=c.shape==='soft',bandHeight=c.band,bandBase=cuff?-.006:-.005;","const cuff=c.shape==='soft',bandHeight=c.shape==='visor'?ht:c.band,bandBase=cuff?-.006:-.005;")
 s=s.replace('let y=-.002-(c.drop||0)*s.brim*v;','let y=.0007-(c.drop||0)*s.brim*v;').replace('return[(ax-.0005+d)*sn,y,(bz-.0005+d)*cs];','return[(ax-thick*.8+d)*sn,y,(bz-thick*.8+d)*cs];')
 s=s.replace('const low=.025,span=c.band/ht;',"const low=.006,span=c.band;\n  const bandV=(u,v)=>{const goal=low+span*v;let lo=0,hi=.6;for(let k=0;k<12;k++){const mid=(lo+hi)/2;if(crown(u,mid)[1]<goal)lo=mid;else hi=mid;}return(lo+hi)/2;};")
 s=s.replace('const belt=(u,v)=>{const p=crown(u,low+span*v),n=normal(crown,u,low+span*v);','const belt=(u,v)=>{const t=bandV(u,v),p=crown(u,t),n=normal(crown,u,t);')
 s=s.replace('t=low+span*(.12+.76*v),p=crown(ang/TAU,t)','t=bandV(ang/TAU,.12+.76*v),p=crown(ang/TAU,t)')
 return s.replace('})(globalThis);','H.geometryTools={shell,strand,normal,profile};\n})(globalThis);')
edit('src/shape.js',geometry)
edit('src/catalog.js',lambda s:s.replace('HAT-R10.2','HAT-R11.0').replace("color:'#586252'","color:'#596047'").replace('原野 · 圆角平冠','原野 · 软裁片便帽').replace('微斜平顶、圆角双片结构，弯曲短檐与双道压线。','低冠裁片与顶片连接，受缝线约束的松量，曲面夹层帽檐、翻折包边与三毫米锁式缝线。'))
def viewer(s):
 s=s.replace("||'pinch'","||'field'").replace('R10.2 · ','R11.0 · ')
 s=s.replace('const group=new T.Group(),c=H.categories.find(c=>c.id===s.id);','const group=new T.Group(),c=H.categories.find(c=>c.id===s.id),roleMaterials=new Map();')
 s=s.replace('const materials=p.groups.map(g=>H.makeMaterial(c,s,g.role));','const materials=p.groups.map(g=>{if(!roleMaterials.has(g.role))roleMaterials.set(g.role,H.makeMaterial(c,s,g.role));return roleMaterials.get(g.role);});')
 s=s.replace('mesh.castShadow=true;mesh.receiveShadow=true;',"mesh.castShadow=!p.groups.every(g=>['thread','fiber'].includes(g.role));mesh.receiveShadow=true;")
 a=s.index('  const role=m.userData.role,col=new T.Color');b=s.index('  m.wireframe=wire',a)
 s=s[:a]+"  const role=m.userData.role;m.color.copy(H.roleColor(c,s,role));\n  if(m.normalScale)m.normalScale.set(.72*s.detail,.72*s.detail);\n  if(m.userData.uniforms){m.userData.uniforms.ownDetail.value=s.detail;m.userData.uniforms.ownSeed.value=(c.seed+s.seed)*.017;}\n"+s[b:]
 s=s.replace("mode==='fit'?.84:Math.max(.50,w*2.00,h*2.90)","mode==='fit'?.79:Math.max(.46,w*1.72,h*2.85)")
 s=s.replace('const poses={three:[.58,.38]','const poses={macro:[.70,.18],three:[.68,.42]')
 s=s.replace('[yaw,pitch]=poses[v]||poses.three;',"[yaw,pitch]=poses[v]||poses.three;if(v==='macro'){distance=.19;target.set(.040,.075,.055);}")
 s=s.replace("if(v==='inside'){headGroup.visible=false;floor.visible=false;}","if(groundContact)groundContact.visible=v!=='inside'&&mode!=='fit';if(v==='inside'){headGroup.visible=false;floor.visible=false;}")
 s=s.replace('程序化测试头 · 静态量配','中性量配头楦 · 静态试戴，非最终人物')
 s=s.replace('.027*bump(y,-.079,.025)-.009*bump(y,-.052,.011)+.006*bump(y,-.031,.012)+.005*bump(y,-.126,.014)','.008*bump(y,-.079,.04)+.004*bump(y,-.035,.025)')
 s=s.replace("color:'#b6b0a3',roughness:.82","color:'#595950',roughness:.67")
 a=s.index(' for(const side of [-1,1]){const ear=');b=s.index(' const neck=',a);s=s[:a]+s[b:]
 s=s.replace("let floor,headKey='';","let floor,groundContact=null,headKey='';")
 s=s.replace("floor.position.y=mode==='fit'?-.265:active.data.bounds.min[1]-.011;","floor.position.y=mode==='fit'?-.265:active.data.bounds.min[1]-.006;\n if(groundContact){scene.remove(groundContact);groundContact.userData.dispose();}groundContact=H.makeContactFootprint(active.data);groundContact.position.y=floor.position.y+.0002;groundContact.visible=mode!=='fit';scene.add(groundContact);")
 s=s.replace('function syncUI(){',"function syncUI(){const category=H.categories.find(c=>c.id===form.id);$('p-brim').disabled=!category.brim;$('p-fullness').disabled=category.shape==='visor';")
 s=s.replace('lights.key,lights.fill]','lights.key,lights.fill,lights.rim]').replace('d=Math.max(.56,wide*2.2,h*3.4)','d=Math.max(.48,wide*1.85,h*3.0)')
 s=s.replace('renderer.toneMappingExposure=1.16','renderer.toneMappingExposure=1.18').replace('renderer.shadowMap.type=T.PCFSoftShadowMap','renderer.shadowMap.type=T.VSMShadowMap')
 s=s.replace("scene.background=new T.Color('#deded7')","scene.background=new T.Color('#bfc1ba')").replace('scene.environmentIntensity=.70','scene.environmentIntensity=1.1')
 s=s.replace("new T.HemisphereLight('#fff9ef','#727469',1.35)","new T.HemisphereLight('#fff9ef','#55584e',.24)")
 s=s.replace("new T.DirectionalLight('#fff4e5',3.4)","new T.DirectionalLight('#fffaf1',3.0)").replace('key.position.set(-.55,.65,.65)','key.position.set(-.20,.60,.65)')
 s=s.replace('key.shadow.mapSize.set(1024,1024)','key.shadow.mapSize.set(2048,2048);key.shadow.radius=4;key.shadow.blurSamples=8').replace('left=-.45','left=-.29').replace('right=.45','right=.29').replace('top=.5','top=.36').replace('bottom=-.45','bottom=-.32')
 s=s.replace('key.shadow.bias=-.0001;key.shadow.normalBias=.0005','key.shadow.bias=-.000015;key.shadow.normalBias=.00010')
 s=s.replace("new T.DirectionalLight('#e1ecf1',1.0)","new T.DirectionalLight('#e4edf5',.65)").replace('fill.position.set(.5,.24,-.6)','fill.position.set(.55,.25,.4)')
 s=s.replace('scene.add(fill);lights={key,fill};',"scene.add(fill);const rim=new T.DirectionalLight('#faf5ea',.85);rim.position.set(.44,.34,-.40);scene.add(rim);lights={key,fill,rim};")
 s=s.replace('new T.PlaneGeometry(4,4)','new T.PlaneGeometry(20,20)').replace("color:'#d1d0c7',roughness:.93","color:'#adb0a7',roughness:.86").replace('floor.receiveShadow=true','floor.receiveShadow=false')
 s=s.replace("const rake=$('light').value==='raking';lights.key.position.set(rake?-.6:-.55,rake?.10:.65,.65);lights.fill.intensity=rake?.35:1;dirty();","const preset=$('light').value,rake=preset==='raking';lights.key.position.set(rake?-.55:-.20,rake?.12:.60,.65);lights.key.intensity=preset==='neutral'?1.85:3.0;lights.fill.intensity=preset==='neutral'?.85:.65;lights.rim.intensity=preset==='neutral'?.35:.85;dirty();")
 s=s.replace('gpuGeometries:renderer.info.memory.geometries',"gpuGeometries:renderer.info.memory.geometries,materialTiles:H.materialStats(),lighting:'EB1-HAT-local-adapter-R01'")
 s=s.replace('thumbs:metrics.thumbs}),geometry',"thumbs:metrics.thumbs,lighting:'EB1-HAT-local-adapter-R01'}),geometry")
 return s
edit('src/viewer.js',viewer)
def ui(s):
 s=s.replace('R10.2','R11.0').replace('自有帽型系统','帽型精修工作台').replace('ORIGINAL SPECTRUM','TAILORED SHAPE / WOVEN SURFACE').replace('十一类 · 新造型 · 参数化生成','R11 · 裁片与表面精修')
 s=s.replace('value="fit">头形试戴','value="fit">中性头楦试戴').replace('柔和影棚','EB1 · 帽子影棚').replace('<option value="raking">','<option value="neutral">中性检视白光</option><option value="raking">').replace('<button data-view="inside">','<button data-view="macro">近景工艺</button><button data-view="inside">')
 s=s.replace('无参考网格 / 无原贴图下载。','独立生成，不输入旧帽包。<br>便帽为本轮重点重做款。').replace('三种头形为新建程序测试头，不是原扫描人物。','三种头形为中性量配头楦，不是原扫描人物；不可作为影视人物展示。').replace('background:#deded7','background:#bfc1ba')
 return s
edit('shell.html',ui)
edit('build.py',lambda s:s.replace("'src/shape.js','src/material.js'","'src/shape.js','src/field.js','src/material.js'").replace("'src/material.js','src/viewer.js'","'src/material.js','src/studio.js','src/viewer.js'").replace("(R/files[1]).read_text()+","(R/files[1]).read_text()+'\\n'+(R/files[2]).read_text()+").replace('HAT-R10.2','HAT-R11.0'))
(R/'.gitignore').write_text('node_modules/\nqa/**/*.png\nqa/**/*.webm\n__pycache__/\n')
(R/'SOURCE_APPLIED.json').write_text(json.dumps({'parent':'2a21c583f982bb0d75d23bf642be8bafd450dcdc','version':'HAT-R11.0','userVisualAcceptance':False,'oldVersionsWritten':False,'borrowedHatAssets':False},indent=2))
(R/'README.md').write_text('''# R11 帽型精修候选\n\n用户明确否定R10.2影视级画质。本轮以截图中的便帽为重点重做，不把功能测试通过等同影视级验收。新目录owned-r11，旧R10.2和更早版本不写入。\n\n便帽重建低冠戴位、独立侧壁与顶片、缝合松量、夹层曲檐、翻折包边、锁式缝线与细小棉纤维。其余十类保留，并吸收已在R10.1验证的冠檐搭接和帽带真实高度修正。材质改为实时生成的纱线截面贴图、法线、粗糙度、绒光和逐级过滤，不下载旧帽包。\n\n帽子影棚是EB1方向的本地适配，不冒充已经统一六个工作台。地面接触阴影为轮廓投影近似，自阴影仍由Three.js处理；不是离线路径追踪。试戴头改为中性头楦，明确不冒充影视人物。\n\n保留十一类、三头形、参数、配方、取消和有限缓存。Three.js 0.179.1 MIT仍是第三方依赖。静态量配不等于动力学或任意参数全曲面无相交，眼圈为凹入绣圈并非贯通气孔。微观棉纤维非逐纱线物理。手机只做视口测试。\n\n实际发布事实看DELIVERY.json、qa/core.json、qa/browser/report.json与qa/public/report.json及Actions。不得用检查数量宣布影视级；最终用户视觉认可单独保留false。\n''')
with (R/'PROVENANCE.md').open('a') as f:f.write('''\n\n## R11 材质和灯光方法\n\n继续保留上面的老师与许可，不复制其帽型资产。新材料实现采用自编纱线截面/交织采样和实际米制坐标；不声称发明织物反射方法。方法核对：Three.js官方MeshPhysicalMaterial的sheen和性能边界 https://threejs.org/docs/pages/MeshPhysicalMaterial.html ，官方色彩管理 https://threejs.org/manual/pages/color-management.html ，PBRT关于织物微几何反射的说明 https://pbr-book.org/4ed/Reflection_Models/Measured_BSDFs 。lo-th/head仍为EB1观察老师，未将其模型、贴图或bundle输入此目录。此处光箱由自编数学函数生成。地面柔接触为明确的投影近似，不是实测光场或路径追踪认证。\n''')
print('R11 source preparation complete; no old runtime was overwritten')
