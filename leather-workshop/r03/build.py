from pathlib import Path
import re,json,hashlib,base64,subprocess
r=Path(__file__).resolve().parent;old=r.parent/'r02';m=json.loads((old/'BUILD_MANIFEST.json').read_text());H=lambda b:hashlib.sha256(b).hexdigest()
for n in ['three.module.js','leather.js']:
 assert H((old/'site'/n).read_bytes())==m['sourceHashes'][n],n+' parent differs'
assert H((old/'preview.html').read_bytes())==m['htmlSHA256'],'R02 HTML differs'
t=(old/'site/three.module.js').read_text();e=re.search(r'export\s*\{([^}]+)\}\s*;?\s*$',t);assert e
names=[]
for p in e[1].split(','):
 a=re.split(r'\s+as\s+',p.strip());names.append(a[-1]+':'+a[0])
js=['const T=(()=>{'+t[:e.start()]+';return {'+','.join(names)+'};})();']
def source(p):
 s=p.read_text();s=re.sub(r'^import.*?;\s*','',s,flags=re.M);return re.sub(r'\bexport (?=(?:async )?(?:class|const|function))','',s)
for p,names in [(old/'site/leather.js','LeatherKernel,PRESETS,DEFAULT'),(r/'site/physics.mjs','LeatherMaterial,PROFILES,materialPoint,makeSpecimen,MembraneSolver,RelaxationProbe,SOURCES')]:
 js.append('const {'+names+'}=(()=>{'+source(p)+';return {'+names+'};})();')
js.append(source(r/'site/runtime.js'));code='(()=>{'+ '\n'.join(js)+'})();';code=re.sub(r'</script',r'<\\/script',code,flags=re.I)
(r/'bundle_check.js').write_text(code);subprocess.run(['node','--check',str(r/'bundle_check.js')],check=True)
legacy=base64.b64encode((old/'preview.html').read_bytes()).decode();notice=(old/'THIRD_PARTY.txt').read_text().replace('--','—')
html=(r/'site/template.html').read_text().replace('<!--LEGACY-->','<script id="legacyData" type="application/octet-stream">'+legacy+'</script>').replace('<!--APP-->','<!--\n'+notice+'\n--><script>'+code+'</script>')
(r/'preview.html').write_text(html)
manifest={'version':'R03.1','sourceBase':'ffcfea8bae4cda68cc0a6f528daccca212fba4f3','parentBuild':'07b36be4163c6cc0013326a07272136e1ff34a74','parentHTMLSHA256':m['htmlSHA256'],'sourceHashes':{p.name:H(p.read_bytes()) for p in (r/'site').iterdir() if p.is_file()},'htmlBytes':len(html.encode()),'htmlSHA256':H(html.encode()),'physicsScope':'quasi-static in-plane FE plus separate scalar relaxation/creep','fullClothPhysics':False,'experimentalCalibration':False,'sourceFigureReproduction':False,'sourcePagesChecked':'Nakahara PDF pp8-10 visually checked; printed Eq16 squared strain. Compression branch not independently validated.','deliveryEvidence':'qa/browser-local.json and qa/browser-public.json must pass independently'}
(r/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(manifest['htmlBytes'],manifest['htmlSHA256'])
