from pathlib import Path
import hashlib,json,gzip,base64,subprocess
R=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha((R/'mesh-contact.mjs').read_bytes())=='0fe9b8e0840c7b35c4ee3fce9b7d648c220043783ad6166314812472ddde8ff3','NATIVE_MESH_CONTACT_CHANGED'
data=json.loads((R/'LOCALITY_AUDIT.json').read_text())
assert data['schema']=='kaopu/contact-locality-audit@1' and data['fixtureRun']=='39570430770'
assert not any(data[k] for k in ['solverExecuted','productionChanged','fitCertified','continuousCollisionCertified','live'])
assert len(data['records'])==3 and all(r['inputUnchanged'] and r['regression']['passed'] for r in data['records'])
tests=json.loads((R/'qa/TESTS.json').read_text());assert tests['passed']
source=subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip()
files=['locality-audit.mjs','run-audit.mjs','tests.mjs','index.template.html','app.js','build.py','browser.py','README.md']
m={'version':'RF01-S3.12-INDEPENDENT-LOCALITY-AUDIT','sourceCommit':source,'sourceFiles':{n:sha((R/n).read_bytes()) for n in files},'nativeGeometryPredicateSHA256':sha((R.parent/'strict-crossing.mjs').read_bytes()),'nativeMeshContactSHA256':sha((R/'mesh-contact.mjs').read_bytes()),'sourceFixtureRun':'39570430770','fixtureZIPDigest':'8113616a3f1cac18dc005781f5354b0f21b5f5c3ebfb573d8226809bf61001f9','fixtureDigests':{r['fixture']:r['fixtureSHA256'] for r in data['records']},'auditCodeExecuted':True,'solverExecuted':False,'nativeMotionCandidateChanged':False,'productionChanged':False,'fitCertified':False,'live':False,'unitAndGeometryChecks':tests['count']}
raw=json.dumps(data,ensure_ascii=False,separators=(',',':')).encode();compressed=gzip.compress(raw,compresslevel=9,mtime=0);assert gzip.decompress(compressed)==raw
payload={'bytes':len(raw),'sha256':sha(raw),'data':base64.b64encode(compressed).decode()};m['dataSHA256']=sha(raw)
js='const AUDIT_BUILD='+json.dumps(m,ensure_ascii=False)+';\nconst AUDIT_PAYLOAD='+json.dumps(payload)+';\n'+(R/'app.js').read_text()
assert '</script' not in js.lower();(R/'qa/bundle.js').write_text(js);subprocess.run(['node','--check',str(R/'qa/bundle.js')],check=True)
t=(R/'index.template.html').read_text();assert t.count('<!-- AUDIT_SCRIPTS -->')==1
html=t.replace('<!-- AUDIT_SCRIPTS -->','<script>'+js+'</script>');(R/'preview.html').write_text(html);m['html']={'bytes':len(html.encode()),'sha256':sha(html.encode())};(R/'BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
print(json.dumps({'sourceCommit':source,'html':m['html'],'checks':tests['count'],'solverExecuted':False},indent=2))
