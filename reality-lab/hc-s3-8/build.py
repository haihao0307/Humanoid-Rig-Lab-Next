from pathlib import Path
import json,hashlib,gzip,base64,subprocess,os
R=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
r=json.loads((R/'qa/static/CONTACT.json').read_text());p=json.loads((R/'qa/static/REPORT.json').read_text());v=json.loads((R/'qa/static/TRACE_VERIFICATION.json').read_text())
assert p['passed'] and v['passed'] and p['codeCommit']==v['codeCommit']
assert p['assembly']['phaseObserverSHA256']==sha((R/'stage-probe.mjs').read_bytes())
assert p['contactSHA256']==sha((R/'qa/static/CONTACT.json').read_bytes())
assert r['completedSteps']==12 and r['motionFailure'] is None
study={'schema':'kaopu/contact-propagation-study@1','sourceCommit':r['sourceCommit'],'nativeRun':os.environ['NATIVE_RUN_ID'],'nativeCodeCommit':p['codeCommit'],'trace':r['phaseTrace'],'endpointComparison':v['comparison'],'baselineSteps':[{'stage':x['stage'],'step':x['step'],'bodyMinimumM':[b['minimumM'] for b in x['body']],'pairMinimumM':x['pair']['minimumM'],'stateSHA256':x['stateSHA256']} for x in r['records']],'fitCertified':False,'productionChanged':False,'semantics':'Frozen native phase observations. Prediction is not committed fine geometry. Complete coarse clearance does not certify fine surface contact.'}
(R/'STUDY.json').write_text(json.dumps(study,ensure_ascii=False,indent=2))
source=subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip()
names=['TASK_ANCHOR.json','stage-probe.mjs','instrument.py','run_native.py','review.js','app.js','index.template.html','build.py','tests/protocol.cjs','tests/browser.py','README.md']
m={'version':'REALITY-HC-S3.8','sourceCommit':source,'nativeRun':study['nativeRun'],'nativeCodeCommit':p['codeCommit'],'studySHA256':sha((R/'STUDY.json').read_bytes()),'sourceFiles':{n:sha((R/n).read_bytes()) for n in names},'endpointEvidenceSHA256':sha((R/'qa/static/TRACE_VERIFICATION.json').read_bytes()),'phaseRows':len(study['trace']['rows']),'fitCertified':False,'productionChanged':False,'sourceSolverArithmeticChanged':False,'physicalDeviceTested':False}
compact=json.dumps(study,ensure_ascii=False,separators=(',',':')).encode();packed=base64.b64encode(gzip.compress(compact,9,mtime=0)).decode()
js='const RF38_BUILD='+json.dumps(m,ensure_ascii=False)+';\nconst RF38_PACKED='+json.dumps(packed)+';\n'+(R/'review.js').read_text()+'\n'+(R/'app.js').read_text();assert '</script' not in js.lower()
g=R/'_generated';g.mkdir(exist_ok=True);(g/'bundle.js').write_text(js);subprocess.run(['node','--check',str(g/'bundle.js')],check=True)
html=(R/'index.template.html').read_text();assert html.count('<!-- RF38_SCRIPTS -->')==1;html=html.replace('<!-- RF38_SCRIPTS -->','<script>\n'+js+'\n</script>');(R/'preview.html').write_text(html);m['html']={'bytes':len(html.encode()),'sha256':sha(html.encode())};(R/'BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2));print(json.dumps(m,ensure_ascii=False,indent=2))
