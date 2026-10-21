from pathlib import Path
import os,json,hashlib
os.environ['CONTACT_CASE']='static'
ROOT=Path(__file__).resolve().parent
# The reviewed previous browser harness runs with this file's directory and this
# task's instrument module. It still exercises the unchanged actual host and S3.6 fit.
prior=(ROOT.parent/'hc-s3-7/run_native.py').read_text()
exec(compile(prior,str(ROOT.parent/'hc-s3-7/run_native.py'),'exec'),globals())
current=json.loads((ROOT/'qa/static/CONTACT.json').read_text())
expected=json.loads((ROOT.parent/'hc-s3-7/qa/static/CONTACT.json').read_text())
assert len(current['records'])==len(expected['records'])==15
comparison=[]
for a,b in zip(current['records'],expected['records']):
 assert (a['stage'],a['step'])==(b['stage'],b['step'])
 assert a['stateSHA256']==b['stateSHA256'],('OBSERVER_CHANGED_STATE',a['stage'],a['step'])
 assert a['body']==b['body'] and a['pair']==b['pair'],('OBSERVATION_CHANGED_MEASUREMENTS',a['step'])
 comparison.append({'stage':a['stage'],'step':a['step'],'exactState':True,'exactMeasurements':True})
t=current['phaseTrace'];assert t['rows'] and all(x['readOnlyChecked'] for x in t['rows'])
for step in [7,8]:
 names={x['stage'] for x in t['rows'] if x['step']==step}
 assert {'step-entry','after-regional-dynamics','before-coarse-contact','after-coarse-contact','after-fine-reconstruction','after-fine-vertices','after-fine-triangles','after-fine-contact','step-complete'}<=names,names
out={'passed':True,'codeCommit':report['codeCommit'],'comparison':comparison,'phaseRows':len(t['rows']),'coverage':t['coverage'],'phaseMeasurementMS':t['measurementMS'],'fitCertified':False,'sourceSolverArithmeticChanged':False,'productionChanged':False}
(ROOT/'qa/static/TRACE_VERIFICATION.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print('PHASE_TRACE_VERIFIED',json.dumps(out,ensure_ascii=False),flush=True)
