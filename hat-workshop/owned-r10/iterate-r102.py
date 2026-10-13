"""Reviewed, idempotent R10.2 iteration of the independently authored R10.1 sources."""
from pathlib import Path
import hashlib
R=Path(__file__).resolve().parent
expected={
 'src/catalog.js':'ddc173e17443d2f558f500b9e44148709cdd3aa851f24e004d54ff5cc874d3ee',
 'src/shape.js':'7dee60ed52ae3ac7f5072e7c5d439c6adde3081e5bc9c142c45dd1e2d386f673',
 'src/material.js':'5c01056c9978ded9ea39850a170fa72b8d01933f7a38081ea212eb8bce84035a',
 'src/viewer.js':'9a5591aab05a84665f57465132fbfbdc931ee25183db6fde9aff442a5f2b7213'}
if "HAT-R10.2" in (R/'src/catalog.js').read_text():
 print('R10.2 source already applied; no replay');raise SystemExit(0)
texts={name:(R/name).read_text() for name in expected}
for name,h in expected.items():
 assert hashlib.sha256(texts[name].encode()).hexdigest()==h,'Source drift: '+name

def replace(name,old,new):
 assert texts[name].count(old)==1,(name,old[:80],texts[name].count(old))
 texts[name]=texts[name].replace(old,new)
replace('src/catalog.js',"H.version='HAT-R10.1'","H.version='HAT-R10.2'")
replace('src/shape.js',' const pieces=[],N=lod?64:112,M=lod?28:48;let adjusted=0;',
''' // R102: reserve scalp clearance before deepening the center crease.
 const crownRecess=c.shape==='pinch'?Math.min(.017,Math.max(0,ht*.98-(head.top+ease+thick+.002))):0;
 const pieces=[],N=lod?64:112,M=lod?28:48;let adjusted=0;''')
replace('src/shape.js','y-=.018*bump(v,.84,.16)*(1-sn*sn)*r;cz=.004*smooth(v);',
'y-=.006*bump(v,.80,.13)*(1-sn*sn)*r+crownRecess*smooth((v-.77)/.23);cz=.004*smooth(v);')
replace('src/shape.js','effectiveCrownHeight:ht,heightFitClamped:',
'effectiveCrownHeight:ht,crownRecessMetres:crownRecess,heightFitClamped:')
replace('src/material.js','float ownHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7))+ownSeed)*43758.5453);}',
'''// R102 independently expressed integer lattice mixer; not cryptographic.
// Coordinates and seed are mixed as uint32; interpolation remains ordinary trilinear noise.
uint ownMixWord(uint w){w^=w>>11u;w*=49157u;w^=w>>7u;w*=16127u;w^=w>>15u;return w;}
float ownHash(vec3 p){
 uvec3 cell=uvec3(ivec3(floor(p)));uint seed=uint(floor(ownSeed*1000.0+.5));
 uint w=ownMixWord(cell.x+211u)^ownMixWord(cell.y+571u)^ownMixWord(cell.z+1453u)^ownMixWord(seed+1747u);
 return float(ownMixWord(w)&16777215u)/16777216.0;
}''')
replace('src/material.js','float microFade=ownFade(fwidth(q.xy*2400.0));',
'float microFade=1.0-smoothstep(.35,1.2,max(max(fwidth(q.x*2400.0),fwidth(q.y*2400.0)),fwidth(q.z*2400.0)));')
replace('src/material.js','normal=normalize(abs(ownDet)*normal-ownGrad);',
'''vec3 ownSlope=ownGrad/max(abs(ownDet),1e-10);
    ownSlope*=min(1.0,.60/max(length(ownSlope),1e-6));normal=normalize(normal-ownSlope);''')
replace('src/material.js',"'hat101-fabric-2-'","'hat102-fabric-u32-' ")
replace('src/viewer.js',"workerTimeouts:0,thumbs:0,boot:","workerTimeouts:0,thumbs:0,thumbnailOutput:'display-srgb-tone-mapped',boot:")
replace('src/viewer.js',
" const rt=new T.WebGLRenderTarget(220,146),tc=new T.PerspectiveCamera(36,220/146,.005,4),ts=new T.Scene();ts.background=new T.Color('#deded7');ts.environment=scene.environment;ts.add(new T.HemisphereLight('#fff8ed','#767b70',1.8));const light=new T.DirectionalLight('#ffffff',2);light.position.set(-.4,.5,.6);ts.add(light);",
""" // R102: the same display framebuffer applies ACES and sRGB, unlike raw linear target bytes.
 const tc=new T.PerspectiveCamera(36,220/146,.005,4),ts=new T.Scene();
 ts.background=scene.background.clone();ts.environment=scene.environment;ts.environmentIntensity=scene.environmentIntensity;
 for(const source of [scene.children.find(o=>o.isHemisphereLight),lights.key,lights.fill]){const light=source.clone();light.castShadow=false;ts.add(light);} """)
replace('src/viewer.js',
"   const was=renderer.getRenderTarget();renderer.setRenderTarget(rt);renderer.render(ts,tc);const bytes=new Uint8Array(220*146*4);renderer.readRenderTargetPixels(rt,0,0,220,146,bytes);renderer.setRenderTarget(was);\n   const cn=document.createElement('canvas');cn.width=220;cn.height=146;const ctx=cn.getContext('2d'),image=ctx.createImageData(220,146);for(let row=0;row<146;row++)image.data.set(bytes.subarray((145-row)*880,(146-row)*880),row*880);ctx.putImageData(image,0,0);",
"""   const was=renderer.getRenderTarget(),size=renderer.getSize(new T.Vector2());
   const cn=document.createElement('canvas');cn.width=220;cn.height=146;
   try{renderer.setRenderTarget(null);renderer.setSize(220,146,false);renderer.render(ts,tc);cn.getContext('2d').drawImage(renderer.domElement,0,0,220,146);}
   finally{renderer.setSize(size.x,size.y,false);renderer.setRenderTarget(was);draw();}""")
replace('src/viewer.js',' rt.dispose();',' // No extra renderer, render target or persistent thumbnail GPU geometry is retained.')
replace('src/viewer.js',"'R10.1 · '","'R10.2 · '")
for name,text in texts.items():(R/name).write_text(text)
for name in ['build.py','qa-browser.py','test-r101.cjs']:
 p=R/name;p.write_text(p.read_text().replace('HAT-R10.1','HAT-R10.2'))
p=R/'shell.html';p.write_text(p.read_text().replace('R10.1','R10.2'))
p=R/'PROVENANCE.md';p.write_text(p.read_text()+'''\n\n## R10.2 补充\n\n移除上一版来源未逐项标注的正弦散列常数组合，改写为本轮可读的整数格点混合实现。它是普通非密码用途伪随机纹理函数，不声称发明了散列或插值方法。没有引入图片、网格或外部着色器包。\n\n缩略图使用与主画布相同的显示输出变换及灯光配置；它是生成的产品预览，不是参考网站图片。色彩管线依据 Three.js 官方色彩管理文档：https://threejs.org/manual/pages/color-management.html 。引擎及其色调映射仍属于明确列出的第三方依赖。\n''')
print('R10.2: bounded crown recess, integer noise, slope filtering and display-matched thumbnails applied')
