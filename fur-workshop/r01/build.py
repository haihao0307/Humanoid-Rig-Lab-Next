from pathlib import Path
import hashlib, json, re, subprocess, urllib.request, time
P=Path(__file__).resolve().parent
SOURCE=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
EB1_REF='beb3dda0a28f732e1e387dd68cc0d90f27ce8b7b'
EB1_HASH='39f747e36f905eaf9e760236315ae649bcab4ffd4feb62290017c7c5da650572'
def get(url):
    last=None
    for attempt in range(3):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'KAOPU-Fur-R01-Builder'})
            with urllib.request.urlopen(req,timeout=40) as r:return r.read()
        except Exception as e:last=e;time.sleep(2)
    raise RuntimeError(str(last))
three=get('https://raw.githubusercontent.com/mrdoob/three.js/r169/build/three.module.js')
eb1=get(f'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/{EB1_REF}/lighting/eb1/eb1.js')
assert hashlib.sha256(eb1).hexdigest()==EB1_HASH,'EB1 authoritative core hash mismatch'
(P/'three.module.js').write_bytes(three);(P/'eb1.js').write_bytes(eb1)
(P/'THREE-LICENSE.txt').write_bytes(get('https://raw.githubusercontent.com/mrdoob/three.js/r169/LICENSE'))
(P/'EB1-THIRD_PARTY_NOTICES.md').write_bytes(get(f'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/{EB1_REF}/lighting/eb1/THIRD_PARTY_NOTICES.md'))
s=three.decode();m=re.search(r'export\s*\{([^}]+)\}\s*;?\s*$',s);assert m,'Unrecognized pinned Three export shape'
exports=[]
for entry in m.group(1).split(','):
    names=entry.strip().split(' as ');exports.append(names[-1]+':'+names[0] if len(names)>1 else names[0])
app=(P/'app.js').read_text()
assert app.startswith("import * as T from './three.module.js';")
assert 'localInspectionAdapter' not in eb1.decode()
bundle='const T=(()=>{\n'+s[:m.start()]+'\nreturn {'+','.join(exports)+'};})();\n'+app.replace("import * as T from './three.module.js';",'',1)
meta={'version':'FUR-ATELIER-R01','sourceCommit':SOURCE,'three':'r169','eb1Ref':EB1_REF,'eb1SHA256':EB1_HASH,'videoVerified':False}
bundle='window.FUR_BUILD='+json.dumps(meta)+';\n'+bundle
escape=lambda text:text.replace('</script','<\\/script')
html=(P/'index.source.html').read_text().replace('<script src="eb1.js"></script>','<script>'+escape(eb1.decode())+'</script>').replace('<script type="module" src="app.js"></script>','<script>'+escape(bundle)+'</script>')
assert '<script src=' not in html and 'type="module" src=' not in html
(P/'preview.html').write_text(html)
meta['runtimeFiles']={name:{'bytes':(P/name).stat().st_size,'sha256':hashlib.sha256((P/name).read_bytes()).hexdigest()} for name in ['app.js','index.source.html','eb1.js','three.module.js','preview.html']}
meta['deliveryStatus']='BUILD_ONLY_NOT_PUBLICLY_VERIFIED';meta['physics']='Bounded guide-tip springs, analytic resting fibers; no garment or per-strand collision'
(P/'BUILD_MANIFEST.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(meta,indent=2),flush=True)
