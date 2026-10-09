"""Idempotent R05.1 integration. Never writes frozen r01-r04 or anchor inputs."""
from pathlib import Path
import hashlib,json,base64,io,urllib.request
from PIL import Image
r=Path(__file__).resolve().parent
p=r/'site/seam.mjs';s=p.read_text()
if "SEAM_VERSION='R05.1'" not in s:
 s=s.replace("SEAM_VERSION='R05.0'","SEAM_VERSION='R05.1'")
 s=s.replace('groove:.09,rows:1,seed:27','groove:.025,rows:1,seed:27,tensionN:.8,surfaceResponse:true')
 s=s.replace("['groove',0,.14]","['groove',0,.14],['tensionN',0,2.4]")
 s=s.replace('rx:p.diameter*1.8,rz:p.diameter*.88','rx:p.diameter*(1.39-.09*p.tightness),rz:p.diameter*(.71-.09*p.tightness)')
 s=s.replace('const q=lane*h.rx*.48;','const q=lane*h.rx*.45;')
 s=s.replace('side*(p.layerThickness-p.groove+p.diameter*.51)','side*(p.layerThickness-p.groove+p.diameter*.47)')
 s=s.replace('.035*p.diameter+slack*p.pitch*.32','.016*p.diameter+slack*p.pitch*.22').replace('p.diameter*.7','p.diameter*.46')
 p.write_text(s)
p=r/'site/runtime.js';s=p.read_text()
if 'new SewingAppearance()' not in s:
 s=s.replace("import * as T from 'three';","import * as T from 'three';\nimport {buildContactField,mapSurfacePoint} from './contact-surface.mjs';\nimport {SewingAppearance} from './appearance.js';")
 s=s.replace('const fibre=fibreNormalTexture()', 'const appearance=new SewingAppearance();let responseEnabled=true,lightRig=null;\nconst fibre=fibreNormalTexture()')
 s=s.replace("look={...DEFAULT,...PRESETS.tan,preset:'tan'}", "look={...DEFAULT,...PRESETS.tan,preset:'tan',color:'#733b22',roughness:.45}")
 s=s.replace('roughness:.84,metalness:0,sheen:.23','roughness:.58,metalness:0,sheen:.25,anisotropy:.28,anisotropyRotation:0,side:T.FrontSide')
 s=s.replace('normalScale:new T.Vector2(.65,.65)','normalScale:new T.Vector2(.22,.22)')
 s=s.replace('makeThreadGeometry(r.points,params.diameter,plies)','makeThreadGeometry(r.points.map(p=>mapSurfacePoint(model,p)),params.diameter,plies)')
 s=s.replace('g.position.fromArray(e.position)', 'g.position.fromArray(mapSurfacePoint(model,e.position))')
 start=s.index('function surfaceMat(');end=s.index('function rebuild()',start)
 s=s[:start]+'''function surfaceMat(kind){
 if($('materialSource').value==='original'){
  if(kind==='grain'){const m=kernel.material.clone();m.side=T.FrontSide;return m;}
 }
 return kind==='grain'?appearance.grain(look):kind==='cut'?appearance.cut(look):appearance.flesh(look);
}
'''+s[end:]
 s=s.replace('model=buildSeam(params,process);dispose(root);','model=buildSeam(params,process);model.contact=buildContactField(model,responseEnabled);dispose(root);')
 s=s.replace("m.transparent=view==='route';","m.side=view==='route'?T.DoubleSide:T.FrontSide;m.transparent=view==='route';")
 s=s.replace("cutMesh.visible=view==='section'", "cutMat.side=T.DoubleSide;cutMesh.visible=view==='section'")
 s=s.replace("k==='tightness'?Math.round(params[k]*100)+'%':params[k].toFixed(2)+' mm'", "k==='tightness'?Math.round(params[k]*100)+'%':k==='tensionN'?params[k].toFixed(2)+' N':params[k].toFixed(2)+' mm'")
 s=s.replace("const a=auditSeam(model);$('stats')", "const a=auditSeam(model);if(model.contact)$('contactInfo').textContent=`局部皮面压陷 ${(-model.contact.stats.minDisplacementMM*1000).toFixed(1)} μm · 求解残差 ${model.contact.stats.relativeResidual.toExponential(1)} · 未标定`; $('stats')")
 s=s.replace('model=buildSeam(params,process);rebuildThreads();sync();revision++;', 'const previousContact=model.contact;model=buildSeam(params,process);model.contact=previousContact;rebuildThreads();sync();revision++;')
 s=s.replace('model=buildSeam(params);rebuildThreads();sync();revision++;', 'rebuild();')
 s=s.replace("['count','每排针孔数',5,25,1]", "['count','每排针孔数',5,25,1],['tensionN','收线张力（演示输入）',0,2.4,.1]")
 s=s.replace("$('preset').onchange=", "$('materialSource').onchange=()=>rebuild();$('raking').onclick=()=>{const on=$('raking').classList.toggle('active');lightRig.position.set(on?-65:-35,on?14:75,45);dirty=true;};\n $('noResponse').onpointerdown=e=>{e.preventDefault();responseEnabled=false;rebuild();};for(const ev of ['pointerup','pointercancel','blur'])window.addEventListener(ev,()=>{if(!responseEnabled){responseEnabled=true;rebuild();}});\n document.querySelectorAll('[data-tension]').forEach(b=>b.onclick=()=>{params.tensionN=+b.dataset.tension;params.tightness=params.tensionN===0?0:1;playing=false;process=null;rebuild();});\n $('preset').onchange=")
 s=s.replace('try{renderer=new T.WebGLRenderer', "async function boot(){try{await appearance.load(JSON.parse($('grainData').textContent));renderer=new T.WebGLRenderer")
 s=s.replace('light.position.set(-35,75,45);', 'lightRig=light;light.position.set(-35,75,45);')
 s=s.replace('get surfaces(){return leatherMeshes;}', 'get contact(){return model.contact.stats;},setResponse:v=>{responseEnabled=!!v;rebuild();},get surfaces(){return leatherMeshes;}')
 s=s.rstrip()+'}\nboot();\n';p.write_text(s)
p=r/'site/template.html';s=p.read_text()
if 'id="noResponse"' not in s:
 s=s.replace('R05.0','R05.1').replace('让每一针真正穿过去','针、线、孔与被牵动的皮面')
 s=s.replace('<button id="hideThread">隐藏线看针孔</button>', '<button id="hideThread">隐藏线看针孔</button><button id="raking">掠射光检查</button>')
 s=s.replace('<div id="seamSliders"></div>', '<div id="seamSliders"></div><div class="row"><button data-tension="0">松线</button><button data-tension="0.8">正常收线</button><button data-tension="2.4">过紧对照</button></div><button id="noResponse" style="width:100%;margin-top:8px">按住：无牵拉形变对照</button><p id="contactInfo" class="note"></p>')
 s=s.replace('<select id="preset"></select>', '<select id="materialSource"><option value="grain">写实粒面 · 授权 PBR 数据</option><option value="original">R02 原程序材质 · 对照</option></select><div class="field">配色与涂饰配方</div><select id="preset"></select>')
 s=s.replace('直接复用 R02 的 LeatherKernel，未修改其源文件。修改外观不会改变 R04 的参数或代码。', '写实档采用 Poly Haven / Rob Tuytel 的 CC0 皮革贴图并调整涂饰；R02 原程序材质可切换对照。两者均不修改 R04。')
 s=s.replace('松紧是可检查的线形参数，不是力值。','松紧控制线形；另设收线张力驱动局部弹性皮面响应。局部刚度为未标定示例。')
 s=s.replace('尚无逐针张力、针线摩擦、孔边撕裂和自动收尾结。','新增给定张力下的局部弹性表皮响应；尚无整根线张力传播、针线摩擦、孔边撕裂和自动收尾结。')
 s=s.replace('<h2>R04 格拉姆锚点</h2>', '<h2>收线后的表皮微变化</h2><p>线在孔口转向时产生局部接触载荷。本版在独立 R05 局部模型中求解弹性表皮的压陷、周边微隆起和侧向牵动，变化写入真实顶点，跟随张力而变；不是固定皱纹贴图。模型是带弹性基底的薄皮层近似，刚度与张力为示例输入，未经过实物标定，不代表完整缝线受力仿真。大幅起皱也可能是过紧造成的缝制缺陷，不把所有高端皮具都做成皱褶。</p><a href="https://www.coats.com/en/info-hub/eliminating-seam-puckering/" target="_blank">Coats：收线过紧与起皱的区别 ↗</a><h2>线体和真实粒面参考</h2><p>AMANN 的 Serafil / Serabraid 用于理解线的细纤维、紧凑线芯、低幅捻纹和光泽；不将几何模型冒称为品牌实物复刻。Poly Haven / Rob Tuytel 的 Leather White 是本版写实粒面贴图来源，按 CC0 使用，取 4K 原图的 75 mm 区域，保持实际纹理尺度，不把整幅纹理缩到一根针脚上。</p><a href="https://www.amann.com/products/product/serafil/" target="_blank">AMANN ↗</a> · <a href="https://polyhaven.com/a/leather_white" target="_blank">Poly Haven 粒面数据 ↗</a><h2>R04 格拉姆锚点</h2>')
 p.write_text(s)
p=r/'build.py';s=p.read_text()
if 'grainData' not in s:
 s=s.replace("(r/'site/geometry.js','makeLeatherGeometry", "(r/'site/contact-surface.mjs','buildContactField,mapSurfacePoint'),(r/'site/appearance.js','SewingAppearance'),(r/'site/geometry.js','makeLeatherGeometry")
 s=s.replace("notice=(old/'THIRD_PARTY.txt').read_text().replace('--','—')", "notice=(old/'THIRD_PARTY.txt').read_text().replace('--','—')+'\\nPoly Haven Leather White by Rob Tuytel, CC0-1.0. https://polyhaven.com/a/leather_white'\ngrain={name:'data:image/png;base64,'+base64.b64encode((r/'assets'/f'{name}.png').read_bytes()).decode() for name in ['diff','nor_gl','rough']}\ntemplate=template.replace('<!--LEGACY-->','<div hidden id=\"grainData\">'+json.dumps(grain)+'</div><!--LEGACY-->')")
 s=s.replace("'version':'R05.0'", "'version':'R05.1'")
 s=s.replace("'visualAcceptance':'PENDING_USER'", "'localSurfaceResponse':'linear plate-on-elastic-foundation, prescribed thread-turn contact loads, uncalibrated','visualAcceptance':'PENDING_USER'")
 p.write_text(s)
# One explicitly licensed CC0 asset set, with source integrity recorded.
assets=r/'assets';assets.mkdir(exist_ok=True)
expected={'diff':'96732ff766b1347acf2f02a110c619234bce97e9847c2b01a5d69e45b353b10e','nor_gl':'a7effe884016e447e797920fd49f24cb4b8de7880905fb3753fa0190bcc425d3','rough':'80f5a97894cedcceda01588cb9a877093572db7bd1618d46d10c0cd53c257eed'}
manifest={'asset':'leather_white','author':'Rob Tuytel','source':'https://polyhaven.com/a/leather_white','license':'CC0-1.0','licenseURL':'https://polyhaven.com/license','originalTileMM':300,'cropMM':75,'files':{}}
for name,sha in expected.items():
 path=assets/(name+'.png');url=f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/leather_white/leather_white_{name}_4k.jpg'
 if not path.exists():
  data=urllib.request.urlopen(url,timeout=90).read();assert hashlib.sha256(data).hexdigest()==sha,'source map changed'
  im=Image.open(io.BytesIO(data)).convert('RGB');assert im.size==(4096,4096);im.crop((1536,1536,2560,2560)).save(path)
 manifest['files'][name]={'url':url,'rawSHA256':sha,'processedSHA256':hashlib.sha256(path.read_bytes()).hexdigest()}
(assets/'PROVENANCE.json').write_text(json.dumps(manifest,indent=2))
print('R05.1 integrated; normals, contact field and licensed material. No frozen files written.')
