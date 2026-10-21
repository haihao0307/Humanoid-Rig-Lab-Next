from pathlib import Path
import json,hashlib,gzip,base64,subprocess,os
R=Path(__file__).resolve().parent;Q=R/'qa/native';sha=lambda b:hashlib.sha256(b).hexdigest()
run=json.loads((Q/'RUN.json').read_text());assert run['passed'] and run['sameRunnerSequential']
keys=['baseline-static','coverage-static','coverage-walk','baseline-walk'];assert run['order']==keys
bundle={'schema':'kaopu/contact-endurance-bundle@1','hostCommit':'c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49','nativeCodeCommit':run['codeCommit'],'cases':{},'evidence':{},'productionChanged':False,'fitCertified':False,'continuousCollisionCertified':False,'scope':'same frozen D03, two native gait durations after 0.65s transition; checkpoint samples, not continuous or complete rendered-surface certification'}
for key in keys:
 p=Q/key;report=json.loads((p/'REPORT.json').read_text());raw=(p/'ENDURANCE.json').read_bytes();x=json.loads(raw)
 assert report['passed'] and report['codeCommit']==run['codeCommit'] and sha(raw)==report['dataSHA256']
 assert report['assembly']['enduranceSHA256']==sha((R/'endurance.mjs').read_bytes()),'NATIVE_CODE_CHANGED'
 assert report['fit']['status']=='COMMITTED' and report['fit']['committedSteps']==48
 bundle['cases'][key]=x;bundle['evidence'][key]={'codeCommit':report['codeCommit'],'reportSHA256':sha((p/'REPORT.json').read_bytes()),'dataSHA256':sha(raw),'checks':len(report['checks']),'environment':report['environment'],'assembly':report['assembly']}
for stage in [0,1]:assert len({v['checkpoints'][stage]['stateSHA256'] for v in bundle['cases'].values()})==1,'INITIAL_STATES_DIFFER'
raw=json.dumps(bundle,ensure_ascii=False,separators=(',',':')).encode();(R/'EVIDENCE.json').write_bytes(raw)
node="const fs=require('node:fs'),C=require(process.argv[1]),x=JSON.parse(fs.readFileSync(process.argv[2]));C.validate(x);console.log(JSON.stringify({cases:Object.fromEntries(Object.entries(x.cases).map(([k,v])=>[k,C.summary(v)])),comparisons:{static:C.compare(x,'static'),walk:C.compare(x,'walk')},fitCertified:false,productionChanged:false},null,2));"
summary=subprocess.check_output(['node','-e',node,str(R/'review.js'),str(R/'EVIDENCE.json')],text=True);(R/'SUMMARY.json').write_text(summary)
source=subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip()
names=['TASK_ANCHOR.json','endurance.mjs','instrument.py','run_native.py','review.js','witness.js','app.js','index.template.html','build.py','tests/review.cjs','tests/browser.py','README.md']
m={'version':'REALITY-HC-S3.9','sourceCommit':source,'nativeRun':os.environ['NATIVE_RUN_ID'],'nativeCodeCommit':run['codeCommit'],'sourceFiles':{n:sha((R/n).read_bytes()) for n in names},'bundleBytes':len(raw),'bundleSHA256':sha(raw),'sourceEvidence':bundle['evidence'],'summarySHA256':sha(summary.encode()),'productionChanged':False,'fitCertified':False,'continuousCollisionCertified':False,'physicalDeviceTested':False,'performanceBenchmarkScope':'single CI machine, sequential order; warmup excluded; instrumented CPU measurements, not independent repeated hardware benchmark'}
js='const RF39_BUILD='+json.dumps(m,ensure_ascii=False)+';\nconst RF39_PACKED='+json.dumps(base64.b64encode(gzip.compress(raw,compresslevel=9,mtime=0)).decode())+';\n'+'\n'.join((R/n).read_text() for n in ['review.js','witness.js','app.js'])
assert '</script' not in js.lower();g=R/'_generated';g.mkdir(exist_ok=True);(g/'bundle.js').write_text(js);subprocess.run(['node','--check',str(g/'bundle.js')],check=True)
t=(R/'index.template.html').read_text();assert t.count('<!-- RF39_SCRIPTS -->')==1;html=t.replace('<!-- RF39_SCRIPTS -->','<script>\n'+js+'\n</script>').encode();(R/'preview.html').write_bytes(html);m['html']={'bytes':len(html),'sha256':sha(html)};(R/'BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
print(json.dumps({'sourceCommit':source,'nativeCodeCommit':run['codeCommit'],'html':m['html'],'bundleBytes':len(raw)},indent=2))
