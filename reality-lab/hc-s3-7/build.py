from pathlib import Path
import json,gzip,base64,hashlib,subprocess,os
R=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
reports={c:json.loads((R/'qa'/c/'REPORT.json').read_text()) for c in ['static','walk','walk-repeat']}
for c,r in reports.items():
 assert r['passed'],c
 assert r['assembly']['probeSHA256']==sha((R/'contact-probe.mjs').read_bytes())
 assert r['assembly']['transactionSHA256']=='db7e42558409bd93e782e96d60d2c39fb20f3dfa215879289589f99b19763a96'
 for name in ['contact-probe.mjs','instrument.py','run_native.py']:
  old=subprocess.check_output(['git','show',r['codeCommit']+':reality-lab/hc-s3-7/'+name]);assert old==(R/name).read_bytes(),('NATIVE_CODE_DRIFT',name)
cases={c:r['result'] for c,r in reports.items()}
for i in [0,1]:assert len({x['records'][i]['stateSHA256'] for x in cases.values()})==1,('INITIAL_STATE_NOT_IDENTICAL',i)
a,b=cases['walk'],cases['walk-repeat'];assert len(a['records'])==len(b['records'])
comparison=[]
for x,y in zip(a['records'],b['records']):
 assert x['stateSHA256']==y['stateSHA256'],'NONDETERMINISTIC_WALK'
 assert all(x[k]==y[k] for k in ['body','pair','stage','step','frame','motionTime','simulationSeconds']), 'NONDETERMINISTIC_MEASUREMENT'
 comparison.append({'stage':x['stage'],'step':x['step'],'sameState':True,'sameMeasurements':True})
validation={'samePostFitState':True,'samePostRegionalState':True,'repeatWalkIdentical':True,'repeatRecords':len(comparison),'comparison':comparison,'dynamicFitCertified':False,'fullSurfaceCertified':False,'sourceChanged':False}
result={'cases':cases,'validation':validation}
(R/'EVIDENCE.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
commit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();evidence={c:{'codeCommit':r['codeCommit'],'reportSHA256':sha((R/'qa'/c/'REPORT.json').read_bytes()),'checks':len(r['checks'])} for c,r in reports.items()}
manifest={'version':'REALITY-HC-S3.7','sourceCommit':commit,'nativeRun':os.environ['NATIVE_RUN'],'evidence':evidence,'sourceFiles':{n:sha((R/n).read_bytes()) for n in ['contact-probe.mjs','instrument.py','run_native.py','review.js','viewer.js','index.template.html','build.py','tests/geometry.mjs','tests/review.cjs','tests/browser.py','README.md']},'validation':validation,'sourceCommitOfHost':'c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49','transactionSHA256':'db7e42558409bd93e782e96d60d2c39fb20f3dfa215879289589f99b19763a96','productionChanged':False,'fitCertified':False,'physicalDeviceTested':False}
packed=base64.b64encode(gzip.compress(json.dumps(result,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)).decode()
js='const RF37_BUILD='+json.dumps(manifest)+';\nconst RF37_PACKED='+json.dumps(packed)+';\n'+(R/'review.js').read_text()+'\n'+(R/'viewer.js').read_text();assert '</script' not in js.lower()
html=(R/'index.template.html').read_text().replace('<!-- SCRIPTS -->','<script>'+js+'</script>');(R/'preview.html').write_text(html);manifest['html']={'bytes':len(html.encode()),'sha256':sha(html.encode())};(R/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'html':manifest['html'],'validation':validation},indent=2))
