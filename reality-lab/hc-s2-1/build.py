from pathlib import Path
import json,hashlib,subprocess,re
ROOT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
source=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
source_files=['SCOPE_LOCK.json','measurement-dictionary.json','protocol.js','adapters.js','index.template.html','app.js','build.py','tests/protocol.cjs','tests/browser.py']
records={name:sha((ROOT/name).read_bytes()) for name in source_files}
lock=json.loads((ROOT/'SCOPE_LOCK.json').read_text());dictionary=json.loads((ROOT/'measurement-dictionary.json').read_text())
assert lock['version']==dictionary['version']=='0.2.0'
assert lock['allowedDomains']==['human','footwear','pattern','garment','fabric']
ids=[m['id'] for m in dictionary['measurements']];assert len(ids)==len(set(ids))
assert all(m['domain'] in lock['allowedDomains'] for m in dictionary['measurements'])
runtime_inputs=['SCOPE_LOCK.json','measurement-dictionary.json','protocol.js','adapters.js','index.template.html','app.js']
runtime_source='\n'.join((ROOT/n).read_text(errors='ignore') for n in runtime_inputs)
assert '#key=' not in json.dumps(dictionary)
assert 'PRIVATE_ACCESS.json' not in runtime_source
# A complete access key is a 43-character base64url bearer token. Public runtime source must not contain one.
credential_literals=re.findall(r'(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])',runtime_source)
assert credential_literals==[],credential_literals
build={'version':'REALITY-HC-S2.1','contractVersion':'0.2.0','sourceCommit':source,'baseCommit':lock['baseCommit'],'sourceFiles':records,'scope':lock['allowedDomains'],'activeObjects':lock['activeObjects'],'registeredOnly':lock['registeredOnly'],'sourceWorkbenchesModified':False,'automaticRepair':False,'publicBrowserVerified':False}
js='const REALITY_DICTIONARY='+json.dumps(dictionary,ensure_ascii=False,separators=(',',':'))+';\nconst REALITY_BUILD='+json.dumps(build,ensure_ascii=False,separators=(',',':'))+';\n'+'\n'.join((ROOT/name).read_text() for name in ['protocol.js','adapters.js','app.js'])
assert '</script' not in js.lower(),'Authored JavaScript unexpectedly contains a script terminator'
check=Path('/tmp/reality-foundation-s2-1.js');check.write_text(js);subprocess.run(['node','--check',str(check)],check=True)
html=(ROOT/'index.template.html').read_text();assert html.count('<!-- FOUNDATION_SCRIPTS -->')==1
html=html.replace('<!-- FOUNDATION_SCRIPTS -->','<script>\n'+js+'\n</script>')
(ROOT/'preview.html').write_text(html)
manifest={**build,'html':{'path':'preview.html','bytes':len(html.encode()),'sha256':sha(html.encode())},'federatedSources':{
 'S1':{'commit':'4b9d26b4edc6f197823d8bcebd9fd242ce99d1ff','bytes':55257,'sha256':'94939009131344eb539a6e60414d001b1619e0d33944aef84517a81354f5f836'},
 'S2':{'commit':'8890bda261784ba14a79ea277bbb14bd547376ad','bytes':66052,'sha256':'888479a0fc1070a00e161c9af937fc43bc1db871a88e8c37d87d0326e0b3fcce'}
 },'privateKeyPublished':False,'physicalCertification':False,'manufacturingCertification':False,'productionReady':False}
(ROOT/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
status={'type':'string','enum':['PASS','FAIL','WARNING','UNKNOWN','NOT_APPLICABLE']}
measurement={'type':'object','required':['id','definitionId','label','value','unit','status','basis'], 'properties':{
 'id':{'type':'string','minLength':1},'definitionId':{'type':'string','minLength':1},'label':{'type':'string','minLength':1},'value':{'type':['number','null']},'unit':{'type':'string'},'status':status,'basis':{'enum':['source_declared','runtime_computed','physical_measured','artistic','unknown']},'method':{'type':['string','null']},'context':{'type':'object'}}}
check_schema={'type':'object','required':['id','status','message'],'properties':{'id':{'type':'string','minLength':1},'status':status,'message':{'type':'string','minLength':1},'owner':{'type':['string','null']}}}
defect={'type':'object','required':['schema','id','objectId','code','severity','state','owner','repairAuthorized','verificationRequired'],'properties':{'schema':{'const':'kaopu/reality-defect@0.2'},'id':{'type':'string'},'objectId':{'type':'string'},'code':{'type':'string'},'severity':{'enum':['critical','warning','info']},'state':{'const':'OPEN'},'owner':{'type':'string'},'repairAuthorized':{'const':False},'verificationRequired':{'const':True}}}
schema={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:kaopu:reality:object:0.2','title':'KAOPU Reality Foundation common object','type':'object','required':['schema','objectId','domain','sourceMode','source','units','frames','measurements','checks','defects'],'properties':{
 'schema':{'const':'kaopu/reality-object@0.2'},'objectId':{'type':'string','pattern':'^[a-zA-Z0-9_.:-]{1,160}$'},'domain':{'enum':lock['allowedDomains']},'sourceMode':{'enum':['live_read_only','fixed_snapshot','imported_unverified','registered_only']},'source':{'type':'object','required':['repository','commit','path'],'properties':{'repository':{'type':'string'},'commit':{'type':'string','pattern':'^[0-9a-f]{40}$'},'path':{'type':'string'},'sha256':{'type':['string','null'],'pattern':'^[0-9a-f]{64}$'}}},'units':{'type':'array'},'frames':{'type':'array'},'measurements':{'type':'array','items':measurement},'checks':{'type':'array','items':check_schema},'defects':{'type':'array','items':defect}},'$comment':'Schema verifies structure. protocol.js additionally validates dictionary identity, units, statuses, duplicate IDs, source boundaries and immutable no-repair semantics.'}
(ROOT/'reality-object.schema.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2))
print(json.dumps(manifest,ensure_ascii=False,indent=2))
