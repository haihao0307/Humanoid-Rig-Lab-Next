from pathlib import Path
import hashlib,json,re,base64,subprocess
from verify_anchor import verify
r=Path(__file__).resolve().parent;old=r.parent/'r02'
anchor=verify();sourceHashes={}
def H(b):return hashlib.sha256(b).hexdigest()
def source(p):
    raw=p.read_bytes();sourceHashes[str(p.relative_to(r.parent))]=H(raw)
    s=raw.decode();s=re.sub(r'^import[^\n]*\n','',s,flags=re.M)
    return re.sub(r'\bexport (?=(?:async )?(?:class|const|function))','',s)
t=(old/'site/three.module.js').read_text();e=re.search(r'export\s*\{([^}]+)\}\s*;?\s*$',t);assert e
names=[]
for p in e[1].split(','):
    a=re.split(r'\s+as\s+',p.strip());names.append(a[-1]+':'+a[0])
js=['const T=(()=>{'+t[:e.start()]+';return {'+','.join(names)+'};})();']
for p,n in [(old/'site/leather.js','LeatherKernel,PRESETS,DEFAULT,FINISHES'),(r/'site/seam.mjs','SEAM_VERSION,SEAM_DEFAULT,SEAM_SOURCES,buildSeam,validateSeam,auditSeam,insideHole'),(r/'site/geometry.js','makeLeatherGeometry,cutFaceGeometry,makeThreadGeometry,fibreNormalTexture')]:
    js.append('const {'+n+'}=(()=>{'+source(p)+';return {'+n+'};})();')
js.append(source(r/'site/runtime.js'))
code='(()=>{\n'+'\n'.join(js)+'\n})();';code=re.sub('</script',r'<\\/script',code,flags=re.I)
check=r/'bundle-check.js';check.write_text(code);subprocess.run(['node','--check',str(check)],check=True);check.unlink()
legacy=base64.b64encode((old/'preview.html').read_bytes()).decode()
template=(r/'site/template.html').read_text();sourceHashes['r05/site/template.html']=H(template.encode())
notice=(old/'THIRD_PARTY.txt').read_text().replace('--','—')
html=template.replace('<!--LEGACY-->','<div hidden id="legacyData">'+legacy+'</div>').replace('<!--APP-->','<!--\n'+notice+'\n--><script>'+code+'</script>')
assert len(re.findall(r'<script[ >]',html))==1
(r/'preview.html').write_text(html)
m={'version':'R05.0','anchor':anchor,'sourceBase':'d3f584e393d0489e3b8a3b6d9fe66929741b33db','sourceHashes':sourceHashes,'htmlBytes':len(html.encode()),'htmlSHA256':H(html.encode()),'changes':'sewing geometry/topology only; R01-R04 untouched','seamTypes':['saddle: one thread two needle ends','running: one thread one needle'],'notImplemented':['301 lockstitch','sewing friction or tension force solver','backstitch termination and knot','full scene dynamics integration'],'visualAcceptance':'PENDING_USER'}
(r/'BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');print(m['htmlBytes'],m['htmlSHA256'])
