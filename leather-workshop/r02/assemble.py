from pathlib import Path
import re,json,hashlib,runpy,shutil,subprocess
r=Path(__file__).resolve().parent;s=r/'site';old=r.parent/'r01';s.mkdir(exist_ok=True)
m=json.loads((old/'BUILD_MANIFEST.json').read_text())
for name in ['app.js','template.html','three.module.js']:
 raw=(old/'site'/name).read_bytes()
 assert hashlib.sha256(raw).hexdigest()==m['rawSourceHashes'][name],name+' R01 differs'
 txt=raw.decode()
 for a,b in m['lookdev'].get(name,[]):
  assert a in txt;txt=txt.replace(a,b)
 (s/name).write_text(txt)
runpy.run_path(str(r/'upgrade_app.py'));runpy.run_path(str(r/'upgrade_ui.py'))
if (r/'corrections.json').exists():
 for name,pairs in json.loads((r/'corrections.json').read_text()).items():
  p=s/name;txt=p.read_text()
  for a,b in pairs:
   if a not in txt:raise RuntimeError('Correction anchor absent: '+name+' '+a[:120])
   txt=txt.replace(a,b)
  p.write_text(txt)
shutil.copyfile(old/'THIRD_PARTY.txt',r/'THIRD_PARTY.txt')
three=(s/'three.module.js').read_text();mt=re.search(r'export\s*\{([^}]+)\}\s*;?\s*$',three);assert mt
ex=[]
for part in mt[1].split(','):
 a=re.split(r'\s+as\s+',part.strip());ex.append(a[-1]+':'+a[0])
three='const T=(()=>{'+three[:mt.start()]+';return {'+','.join(ex)+'};})();'
legacy=(s/'legacy.js').read_text();legacy=re.sub(r'^import.*?;\s*','',legacy,flags=re.M);legacy=legacy.replace('export const ','const ').replace('export class ','class ')
js=[three,'const LegacyLeatherKernel=(()=>{'+legacy+';return LegacyLeatherKernel;})();']
for f in ['leather.js','craft.js','export.js','app.js']:
 t=(s/f).read_text();t=re.sub(r'^import.*?;\s*','',t,flags=re.M);t=re.sub(r'\bexport (?=(?:async )?(?:class|const|function))','',t);js.append(t)
code='(()=>{'+ '\n'.join(js)+'})();';code=re.sub(r'</script',r'<\\/script',code,flags=re.I)
(r/'bundle_check.js').write_text(code);subprocess.run(['node','--check',str(r/'bundle_check.js')],check=True)
notice=(r/'THIRD_PARTY.txt').read_text().replace('--','—')
html=(s/'template.html').read_text().replace('<!--IMPORTMAP-->','<!--\n'+notice+'\n-->').replace('<!--APP-->','<script>'+code+'</script>')
(r/'preview.html').write_text(html)
manifest={'version':'R02.0','parentBuild':'82295cb93f70adc7f8d6c6eba90fba443ea7567d','branchBase':'bfa812f6ef9a4cd2b7e4cffe20311e59dda3bd06','sourceHashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in s.iterdir() if p.suffix in ['.js','.html']},'htmlBytes':len(html.encode()),'htmlSHA256':hashlib.sha256(html.encode()).hexdigest(),'visualAcceptance':'PENDING_USER','adobeOneToOne':'NOT_VERIFIED','materialLibraryComplete':False,'physics':False,'coreNetworkRequests':0,'heightExport':'16-bit PNG, half-float generated field, not measured scan'}
(r/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(json.dumps(manifest,ensure_ascii=False))
