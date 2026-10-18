from pathlib import Path
import json,hashlib,subprocess,os,re
ROOT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
source=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
files=['SCOPE_LOCK.json','catalog.json','core.js','adapters.js','isolation.js','lab.html','lab.js','tests/core.cjs','tests/browser.py','build.py']
records={name:sha((ROOT/name).read_bytes()) for name in files}
lock=json.loads((ROOT/'SCOPE_LOCK.json').read_text());catalog=json.loads((ROOT/'catalog.json').read_text())
assert lock['allowedDomains']==catalog['scope']
assert len(catalog['entries'])==5 and all(e['domain'] in lock['allowedDomains'] for e in catalog['entries'])
assert all(re.fullmatch('[0-9a-f]{40}',e['commit']) for e in catalog['entries'])
assert '#key=' not in json.dumps(catalog)
header={'version':'REALITY-HC-S1','sourceCommit':source,'coreVersion':'0.1.0','sourceFiles':records,'scope':lock['allowedDomains'],'nativeRuntimeModified':False,'physicalCertification':False,'productionReady':False}
js='const REALITY_CATALOG='+json.dumps(catalog,ensure_ascii=False)+';\nconst REALITY_BUILD='+json.dumps(header)+';\n'+'\n'.join((ROOT/n).read_text() for n in ['core.js','adapters.js','isolation.js','lab.js'])
assert '</script' not in js.lower(),'Do not silently rewrite authored JavaScript'
check=Path('/tmp/reality-hc-s1-assembled.js');check.write_text(js)
subprocess.run(['node','--check',str(check)],check=True)
html=(ROOT/'lab.html').read_text();assert html.count('<!-- REALITY_SCRIPTS -->')==1
html=html.replace('<!-- REALITY_SCRIPTS -->','<script>\n'+js+'\n</script>')
(ROOT/'preview.html').write_text(html)
manifest={**header,'html':{'path':'preview.html','bytes':len(html.encode()),'sha256':sha(html.encode())},'nativeSources':[{'id':e['id'],'commit':e['commit'],'sha256':e['sha256']} for e in catalog['entries'] if e['status']!='registered-only'],'deliveryScope':'Core and WebGL calibration self-contained. Exact published native workbenches are optional on-demand network loads, not embedded new asset copies.','publicVerified':False}
(ROOT/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
unit={'type':'string','enum':['m','cm','mm','in','ft']}
number3={'type':'array','items':{'type':'number'},'minItems':3,'maxItems':3}
nullable=lambda item:{'anyOf':[item,{'type':'null'}]}
schema={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:kaopu:reality:observation:1','title':'KAOPU human and clothing read-only observation','type':'object','required':['schema','assetId','domain'],'properties':{'schema':{'const':'kaopu/reality-observation@1'},'assetId':{'type':'string','pattern':'^[a-zA-Z0-9_.:-]{1,128}$'},'domain':{'enum':lock['allowedDomains']},'source':nullable({'type':'object','required':['repository','commit','path'],'properties':{'repository':{'type':'string','pattern':'^[\\w.-]+/[\\w.-]+$'},'commit':{'type':'string','pattern':'^[0-9a-f]{40}$'},'path':{'type':'string','minLength':1},'sha256':nullable({'type':'string','pattern':'^[0-9a-f]{64}$'})}}),'units':nullable({'type':'object','properties':{'geometry':nullable(unit),'scene':nullable(unit),'geometryToScene':nullable({'type':'number','exclusiveMinimum':0})}}),'dimensions':nullable({'type':'object','required':['xyz','unit','basis','method'],'properties':{'xyz':{**number3,'items':{'type':'number','exclusiveMinimum':0}},'unit':unit,'basis':{'enum':['source_declared','runtime_computed','physical_measured','artistic','unknown','test_fixture']},'method':{'type':'string','minLength':1}}}),'frame':nullable({'type':'object','required':['up','forward','handedness'],'properties':{'up':{'enum':['+X','-X','+Y','-Y','+Z','-Z']},'forward':{'enum':['+X','-X','+Y','-Y','+Z','-Z']},'handedness':{'enum':['left','right']},'toCanonicalBasis':nullable({'type':'array','items':{'type':'number'},'minItems':9,'maxItems':9})}}),'camera':nullable({'type':'object','properties':{'projection':{'enum':['perspective','orthographic','unknown']},'bufferPx':{'type':'array','items':{'type':'integer','minimum':1},'minItems':2,'maxItems':2}}}),'color':nullable({'type':'object'}),'evidence':nullable({'type':'object'}),'preservation':{'type':'object','properties':{k:{'type':'boolean'} for k in ['geometry','camera','settings']}}},'$comment':'Structure only. core.js adds dimensional consistency, scope, basis orthogonality, camera aspect, source safety and evidence semantics. Validation never grants physical, aesthetic or manufacturing approval.'}
(ROOT/'reality-observation.schema.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2))
print(json.dumps(manifest,ensure_ascii=False,indent=2))
