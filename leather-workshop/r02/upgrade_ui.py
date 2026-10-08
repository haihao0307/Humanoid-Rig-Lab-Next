from pathlib import Path
import json
r=Path(__file__).parent;s=r/'site';p=s/'template.html';h=p.read_text()
h=h.replace('R01','R02').replace('GRAIN / FINISH / CRAFT','GRAIN / FINISH / STITCH / PERFORATION')
h=h.replace('原色粒面</h1>','油蜡棕革</h1>')
h=h.replace('<p class="hint">同一皮样、同一灯光。切换的是生成结构与涂饰。</p>', '<div class="field"><label for="finish">独立涂饰层</label></div><select id="finish"></select><p class="hint">皮革类别与涂饰可自由组合。旧版 R01 完整保留。</p>')
h=h.replace('<section class="section"><h2>03 / 皮样与观察</h2>', '''<section class="section"><h2>03 / 缝制 · 绗缝 · 穿孔</h2>
<div class="row combo"><button data-combo="natural">原皮</button><button data-combo="seat">绗缝</button><button data-combo="vent">透气</button><button data-combo="braid">编织</button><button data-combo="aged">老化</button></div>
<label class="field" for="craft">工艺结构</label><select id="craft"><option value="plain">无绗缝</option><option value="diamond">菱形绗缝</option><option value="grid">方格绗缝</option><option value="channels">条形绗缝</option><option value="woven">交错皮条编织</option></select>
<label class="field" for="stitch">针法</label><select id="stitch"><option value="single">单排平针</option><option value="double" selected>双排平针</option><option value="cross">交叉针</option><option value="zigzag">锯齿针</option><option value="none">不缝线</option></select>
<div class="field"><label for="threadColor">缝线颜色</label><input id="threadColor" type="color" value="#cfb38a"><label><input id="piping" type="checkbox" checked> 包边</label></div>
<label class="field" for="hole">真实贯穿孔</label><select id="hole"><option value="none">不穿孔</option><option value="round">圆孔阵列</option><option value="stripe">分区透气孔</option><option value="slot">长圆孔阵列</option></select>
<details><summary>针距 / 厚度 / 孔径 / 工艺尺度</summary><div id="craftSliders"></div></details>
<p class="note">孔口、孔壁、背面、皮条、缝线为真实几何。绗缝是参数曲面，不是皮革动力学。校验球仅查看基础材质。</p>
</section><section class="section"><h2>04 / 皮样与观察</h2>''')
h=h.replace('<span class="value">皮厚 1.4 mm</span>', '<span class="value">厚度在工艺尺度中调节</span>')
h=h.replace('<h2>04 / 保存与复用</h2>', '<h2>05 / 材质诊断与交付</h2><label class="field" for="channel">查看实际计算通道</label><select id="channel"><option value="beauty">完整皮革渲染</option><option value="baseColor">底色 / 无光照</option><option value="normal">表面法线</option><option value="roughness">粗糙度</option><option value="ao">微遮蔽</option></select><div class="row"><button id="legacy">按住查看 R01 粒面</button><button id="reset">恢复初始</button></div>')
h=h.replace('<p class="note">纹理由代码现场生成', '<div class="row"><button id="height16">16 位高度 PNG</button><button id="exportKit">完整材质包 ZIP</button></div><p class="note">贴图包包含五通道与材质谱；绗缝、穿孔、编织属于几何，不在平铺贴图内。纹理由代码现场生成')
h=h.replace('<details><summary>原文参考与实现边界', '<details id="referenceDetails"><summary>原文参考与实现边界')
h=h.replace('media_1658e85e52cbc30a4f40b9c57c9e8fe41f5dcaa26.jpeg?format=jpeg','media_1c87b0fd17bebc6924caa26f299962c26d07c87e6.jpg?format=jpg')
h=h.replace('KAOPU LEATHER @ 1', 'KAOPU LEATHER @ 2')
h=h.replace('</style>', '.combo{display:flex;flex-wrap:wrap}.combo button{padding:6px 7px;font-size:11px}.combo>*{flex:1 0 40px}#caption{background:linear-gradient(90deg,#1a1a1a88,transparent);padding:10px 20px 10px 0}#caption h1{font-size:26px}details{margin-top:12px}summary{padding:5px 0}aside::-webkit-scrollbar{width:6px}aside::-webkit-scrollbar-thumb{background:#54514b;border-radius:5px}@media(max-width:800px){aside{display:block}aside .section{margin-bottom:22px}main{height:65dvh}}\n</style>')
p.write_text(h)
old=r.parent/'r01/site/leather.js';legacy=old.read_text();m=json.loads((r.parent/'r01/BUILD_MANIFEST.json').read_text())
for x,y in m['lookdev']['leather.js']:
 assert x in legacy;legacy=legacy.replace(x,y)
legacy=legacy.replace('export class LeatherKernel','export class LegacyLeatherKernel');(s/'legacy.js').write_text(legacy)
a=(s/'app.js').read_text().replace("import {buildCraft}","import {LegacyLeatherKernel} from './legacy.js';\nimport {buildCraft}")
a=a.replace('let craftInfo={},legacyMode=false;', 'let craftInfo={},legacyMode=false,legacyKernel=null;')
a=a.replace("$('reset').onclick=", "$('legacy').onpointerdown=e=>{e.preventDefault();if(!legacyKernel)legacyKernel=new LegacyLeatherKernel(renderer);legacyKernel.bake({...params,kind:Math.min(3,params.kind)});body.material=legacyKernel.material;legacyMode=true;dirty=true;};window.addEventListener('pointerup',()=>{if(legacyMode){legacyMode=false;applyChannel();dirty=true;}});$('legacy').onpointercancel=()=>{legacyMode=false;applyChannel();dirty=true;};\n $('reset').onclick=")
a=a.replace("exportMap:n=>kernel.exportMap(n).toDataURL(),", "exportMap:n=>kernel.exportMap(n).toDataURL(),exportKit:()=>materialZIP(kernel,params),heightPNG:()=>heightPNG16(kernel),")
(s/'app.js').write_text(a)
