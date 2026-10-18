from pathlib import Path
import json,hashlib,subprocess,re
ROOT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
source=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
source_files=['SCOPE_LOCK.json','BUILD_REQUEST.json','README.md','material-snapshots.json','contract.js','app.js','index.template.html','build.py','tests/protocol.cjs','tests/browser.py']
records={name:sha((ROOT/name).read_bytes()) for name in source_files}
data=json.loads((ROOT/'material-snapshots.json').read_text())
assert data['schema']=='kaopu/reality-material-snapshot-set@1'
assert [o['family'] for o in sorted(data['objects'],key=lambda o:o['priority'])]==['denim','knit','leather','silk','cotton','acrylic','linen']
joined='\n'.join((ROOT/n).read_text() for n in ['material-snapshots.json','contract.js','app.js','index.template.html'])
assert 'PRIVATE_ACCESS.json' not in joined and '#key=' not in joined
build={'version':'REALITY-HC-S3','contractVersion':'0.3.0','sourceCommit':source,'publicCommit':None,'sourceFiles':records,'scope':['human','garment','pattern','fabric','footwear'],'activeDomain':'fabric','activeObjects':[o['id'] for o in data['objects']],'registeredOnly':[x['id'] for x in data['registeredOnly']],'previousFoundation':data['previousFoundation'],'sourceWorkbenchesModified':False,'shadersChanged':False,'lightingChanged':False,'geometryChanged':False,'physicsChanged':False,'automaticRepair':False,'privateCredentialPublished':False,'physicalCertification':False,'manufacturingCertification':False,'productionReady':False,'publicBrowserVerified':False}
js='const REALITY_S3_DATA='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\nconst REALITY_S3_BUILD='+json.dumps(build,ensure_ascii=False,separators=(',',':'))+';\n'+(ROOT/'contract.js').read_text()+'\n'+(ROOT/'app.js').read_text()
assert '</script' not in js.lower()
check=Path('/tmp/reality-hc-s3.js');check.write_text(js)
subprocess.run(['node','--check',str(check)],check=True)
template=(ROOT/'index.template.html').read_text();marker='<!-- REALITY_S3_SCRIPTS -->';assert template.count(marker)==1
html=template.replace(marker,'<script>\n'+js+'\n</script>')
(ROOT/'preview.html').write_text(html)
build['html']={'path':'preview.html','bytes':len(html.encode()),'sha256':sha(html.encode())}
(ROOT/'BUILD_MANIFEST.json').write_text(json.dumps(build,ensure_ascii=False,indent=2))
status={'type':'string','enum':['PASS','FAIL','WARNING','UNKNOWN','NOT_APPLICABLE']}
measurement={'type':'object','required':['definitionId','label','value','unit','status','basis','note'],'properties':{'definitionId':{'type':'string','minLength':1},'label':{'type':'string','minLength':1},'value':{'anyOf':[{'type':'number'},{'type':'string'},{'type':'null'}]},'unit':{'type':'string','minLength':1},'status':status,'basis':{'type':'string','minLength':1},'sourceRef':{'anyOf':[{'type':'string'},{'type':'null'}]},'note':{'type':'string','minLength':1}}}
defect={'type':'object','required':['id','code','status','owner','expected','observed','repairAuthorized','verificationRequired'],'properties':{'id':{'type':'string'},'code':{'type':'string'},'status':{'enum':['FAIL','WARNING','UNKNOWN']},'owner':{'type':'string'},'expected':{'type':'string'},'observed':{'type':'string'},'repairAuthorized':{'const':False},'verificationRequired':{'const':True}}}
schema={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:kaopu:reality:material-snapshot-set:1','title':'KAOPU Reality HC S3 fixed material evidence set','type':'object','required':['schema','version','objects','registeredOnly'],'properties':{'schema':{'const':'kaopu/reality-material-snapshot-set@1'},'version':{'const':'REALITY-HC-S3'},'objects':{'type':'array','minItems':7,'maxItems':7,'items':{'type':'object','required':['id','family','name','priority','mode','summary','source','measurements','checks','defects'],'properties':{'id':{'type':'string'},'family':{'enum':['denim','knit','leather','silk','cotton','acrylic','linen']},'name':{'type':'string'},'priority':{'type':'integer','minimum':1,'maximum':7},'mode':{'type':'string'},'summary':{'type':'string'},'source':{'type':'object'},'measurements':{'type':'array','minItems':1,'items':measurement},'checks':{'type':'array'},'defects':{'type':'array','items':defect}}}},'registeredOnly':{'type':'array'}},'$comment':'Schema validates structure. contract.js additionally validates units, statuses, family coverage, dimensional semantics and non-repair authority.'}
(ROOT/'material-snapshot.schema.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2))
print(json.dumps(build,ensure_ascii=False,indent=2))
