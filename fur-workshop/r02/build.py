from pathlib import Path
import hashlib,json,re,subprocess
P=Path(__file__).resolve().parent
source=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
three=(P/'three.module.js').read_text();eb1=(P/'eb1.js').read_text();app=(P/'app.js').read_text();html=(P/'index.source.html').read_text()
assert hashlib.sha256(eb1.encode()).hexdigest()=='39f747e36f905eaf9e760236315ae649bcab4ffd4feb62290017c7c5da650572'
# This extends the diagnostic completed-frame readback budget, not the animation timestep.
# Full production geometry, materials and framebuffer are unchanged. Cold SwiftShader is slow.
app=app.replace('performance.now()-start>15000','performance.now()-start>90000')
(P/'app.js').write_text(app)
m=re.search(r'export\s*\{([^}]+)\}\s*;?\s*$',three)
assert m
exports=[]
for entry in m.group(1).split(','):
 names=entry.strip().split(' as ')
 exports.append(names[-1]+':'+names[0] if len(names)>1 else names[0])
bundle='const T=(()=>{\n'+three[:m.start()]+'\nreturn {'+','.join(exports)+'};})();\n'+app.replace("import * as T from './three.module.js';",'',1)
meta={'version':'FUR-ATELIER-R02','sourceCommit':source,'baseline':'0058e6337ee82a7fb664fb58df94fd2406bb1c15','three':'r169','eb1':'1.1.0','referenceImageInRuntime':False,'externalModel':False,'captureTimeoutMs':90000,'hardwarePerformanceCertified':False}
html=html.replace('<script src="eb1.js"></script>','<script>'+eb1+'</script>')
html=html.replace('<script type="module" src="app.js"></script>','<script>window.FUR_BUILD='+json.dumps(meta)+';\n'+bundle+'</script>')
assert '<script src=' not in html
(P/'preview.html').write_text(html)
meta['files']={n:{'bytes':(P/n).stat().st_size,'sha256':hashlib.sha256((P/n).read_bytes()).hexdigest()} for n in ['app.js','preview.html','index.source.html','eb1.js']}
(P/'BUILD_MANIFEST.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(meta,indent=2))
