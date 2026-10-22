from pathlib import Path
import json,gzip,base64,hashlib,subprocess,re
R=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
raw=(R/'AUDIT.json').read_bytes();data=json.loads(raw);tests=json.loads((R/'qa/TESTS.json').read_text());exact=json.loads((R/'qa/EXACT_TESTS.json').read_text())
assert tests['passed'] and exact['passed']
assert data['schema']=='kaopu/contact-surface-audit@1' and len(data['cases'])==3
assert all(c['inputUnchanged'] and all(r['nativeMatchesStoredRow'] for r in c['rows']) and all(p['exactVerified'] for p in c['selfIntersections']) for c in data['cases'])
assert all(data[k] is False for k in ['sourceWritten','solverExecuted','newMotionExecuted','fitCertified','globalNonlinearInfeasibilityProved','live'])
assert data['exactVerification']['inputSHA256']==sha((R/'AUDIT_RAW.json').read_bytes())
assert (R/'AUDIT_RAW.json').read_bytes()==(R/'AUDIT_RAW_REPEAT.json').read_bytes(),'NONDETERMINISTIC_SOURCE_AUDIT'
source=subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip()
names=['TASK_ANCHOR.json','audit.mjs','exact.py','tests.mjs','index.html','build.py','browser.py','README.md']
m={'version':'REALITY-HC-S3.15','sourceCommit':source,'sourceFiles':{n:sha((R/n).read_bytes()) for n in names},'dataSHA256':sha(raw),'rawAuditSHA256':sha((R/'AUDIT_RAW.json').read_bytes()),'certificateSHA256':data['certificateSHA256'],'fixtureRun':data['fixtureRun'],'fixtureDigests':{c['fixture']:c['fixtureSHA256'] for c in data['cases']},'nativeHostCommit':data['nativeHostCommit'],'rulesChecks':tests['count'],'exactChecks':exact['count'],'exactRecordedPairs':exact['verifiedPairs'],'actualRows':sum(len(c['rows']) for c in data['cases']),'status':'BODY_SURFACE_SELF_INTERSECTION_REPAIR_HOLD','sourceWritten':False,'solverExecuted':False,'newMotionExecuted':False,'fitCertified':False,'live':False,'summary':[{'fixture':c['fixture'],'rows':len(c['rows']),'localExactBodyPairs':len(c['selfIntersections']),'positiveLocalInsideProbes':c['positiveLocalInsideCount'],'mainComponent':c['topology'][0]} for c in data['cases']]}
packed=gzip.compress(raw,compresslevel=9,mtime=0);assert gzip.decompress(packed)==raw
payload={'bytes':len(raw),'sha256':sha(raw),'data':base64.b64encode(packed).decode()}
html=(R/'index.html').read_text();assert html.count('<!-- DATA -->')==1
html=html.replace('<!-- DATA -->','<script>const BUILD='+json.dumps(m,ensure_ascii=False)+';const PACK='+json.dumps(payload)+';</script>')
for i,script in enumerate(re.findall(r'<script>([\s\S]*?)</script>',html)):
 p=R/'qa'/f'assembled-{i}.js';p.write_text(script);subprocess.run(['node','--check',str(p)],check=True)
(R/'preview.html').write_text(html);m['html']={'bytes':len(html.encode()),'sha256':sha(html.encode())};(R/'BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
print(json.dumps({'sourceCommit':source,'html':m['html'],'rules':tests['count'],'exact':exact['count'],'status':m['status']},indent=2))
