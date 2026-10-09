from pathlib import Path
from PIL import Image
import base64, hashlib, io, json, re, subprocess

r=Path(__file__).resolve().parent
old=r.parent/'r02'

def source(p):
    s=p.read_text()
    s=re.sub(r'^import[^\n]*\n','',s,flags=re.M)
    return re.sub(r'\bexport (?=(?:async )?(?:class|const|function))','',s)

t=(old/'site/three.module.js').read_text()
e=re.search(r'export\s*\{([^}]+)\}\s*;?\s*$',t)
assert e
names=[]
for part in e[1].split(','):
    a=re.split(r'\s+as\s+',part.strip())
    names.append(a[-1]+':'+a[0])
js=['const T=(()=>{'+t[:e.start()]+';return {'+','.join(names)+'};})();']
for p,n in [
    (old/'site/leather.js','LeatherKernel,PRESETS,DEFAULT,FINISHES'),
    (r/'site/seam.mjs','SEAM_VERSION,SEAM_DEFAULT,SEAM_SOURCES,buildSeam,validateSeam,auditSeam,insideHole,continuousRoutes'),
    (r/'site/contact-surface.mjs','buildContactField,mapSurfacePoint'),
    (r/'site/appearance.js','SewingAppearance'),
    (r/'site/geometry.js','makeLeatherGeometry,cutFaceGeometry,makeThreadGeometry,fibreNormalTexture')]:
    js.append('const {'+n+'}=(()=>{'+source(p)+';return {'+n+'};})();')
js.append(source(r/'site/runtime.js'))
code='(()=>{\n'+'\n'.join(js)+'\n})();'
code=re.sub(r'</script',r'<\\/script',code,flags=re.I)
check=r/'bundle-lite-check.js'
check.write_text(code)
subprocess.run(['node','--check',str(check)],check=True)
check.unlink()

# Preserve the actual 150 x 75 mm source crop but make a compact browser-delivery mip.
# Full-resolution data remains in preview.html and assets-grain/.
maps={}
map_info={}
for name in ['diff','nor_gl','rough']:
    im=Image.open(r/'assets-grain'/f'{name}.webp').convert('RGB')
    original=im.size
    im.thumbnail((768,384),Image.Resampling.LANCZOS)
    buf=io.BytesIO()
    im.save(buf,'WEBP',quality=82,method=6)
    raw=buf.getvalue()
    maps[name]='data:image/webp;base64,'+base64.b64encode(raw).decode()
    map_info[name]={'sourcePixels':original,'publicPixels':im.size,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}

legacy_html='''<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1c2221;color:#ddd;font:14px system-ui;display:grid;place-items:center;height:100vh;text-align:center}a{color:#d8bc8a}</style><div>轻量公网入口不内嵌历史 R02，以避免再次形成超大页面。<br><a target="_blank" href="https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/07b36be4163c6cc0013326a07272136e1ff34a74/leather-workshop/r02/preview.html">单独打开历史 R02 材质工坊</a></div>'''
legacy=base64.b64encode(legacy_html.encode()).decode()
template=(r/'site/template.html').read_text()
template=template.replace('<!--LEGACY-->','<div hidden id="grainData">'+json.dumps(maps)+'</div><!--LEGACY-->',1)
notice='R05.1 compact public build. R04 frozen. Full-resolution offline build is preview.html. Poly Haven Brown Leather by Rob Tuytel, CC0-1.0.'
html=template.replace('<!--LEGACY-->','<div hidden id="legacyData">'+legacy+'</div>',1).replace('<!--APP-->','<!--\n'+notice+'\n--><script>'+code+'</script>')
assert len(re.findall(r'<script[ >]',html))==1
out=r/'public-lite.html'
out.write_text(html)
manifest={'version':'R05.1-public-lite','sourceBuild':'7ec1f5372073357bfa3ca3f5df763267d5e471b2','bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'maps':map_info,'fullResolutionOffline':'preview.html','legacyR02Embedded':False,'r04Modified':False}
(r/'PUBLIC_LITE_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
if out.stat().st_size>1_500_000: raise RuntimeError('compact public build unexpectedly too large')
print(json.dumps(manifest,ensure_ascii=False))
