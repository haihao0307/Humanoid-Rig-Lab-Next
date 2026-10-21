from pathlib import Path
import json,os,hashlib,subprocess,math
R=Path(__file__).resolve().parent;sha=lambda b:hashlib.sha256(b).hexdigest()
def pct(values,q):
 v=sorted(values)
 if not v:return 0.0
 t=(len(v)-1)*q;i=int(t);return v[i]+(v[min(i+1,len(v)-1)]-v[i])*(t-i)
def dist(v):return {'medianMS':pct(v,.5),'p95MS':pct(v,.95),'maxMS':max(v,default=0.0),'totalMS':sum(v)}
cases=[];evidence=[];regression=None;native_codes=set();guardhash=sha((R/'joint-guard.mjs').read_bytes())
for motion in ['static','walk']:
 run=json.loads((R/'qa/native'/motion/'RUN.json').read_text());assert run['passed'] and run['sameRunnerPair'];native_codes.add(run['codeCommit'])
 for mode in ['baseline','guarded']:
  q=R/'qa/native'/motion/mode;r=json.loads((q/'REPORT.json').read_text());raw=(q/'ENDURANCE.json').read_bytes();x=json.loads(raw)
  assert r['passed'] and sha(raw)==r['dataSHA256'] and r['assembly']['guardModuleSHA256']==guardhash
  assert r['codeCommit']==run['codeCommit'] and r['environment']['runID']==os.environ['RF311_NATIVE_RUN']
  evidence.append({'motion':motion,'mode':mode,'dataSHA256':sha(raw),'reportSHA256':sha((q/'REPORT.json').read_bytes()),'codeCommit':r['codeCommit'],'checks':len(r['checks'])})
  points=[]
  for c in x['checkpoints']:
   if c['step']<1:continue
   point={'step':c['step'],'stateSHA256':c['stateSHA256']}
   for key,value in [('top',c['body'][0]),('bottom',c['body'][1]),('pair',c['pair'])]:point[key]={k:value[k] for k in ['minimumM','negative','beyondMargin','count']}
   point['bottomWitness']={'nodeIds':c['body'][1]['witness']['nodeIds'],'windingInsideSupport':c['body'][1]['witness'].get('windingInsideSupport'),'strictLocalCrossing':c['body'][1]['witness']['localIntersection'] is not None}
   points.append(point)
  frames=[f for f in x['frames'] if f['step']>12 and f['accepted']]
  cost={'step':dist([max(0,f['adjustedStepMS']-f['jointGuard']['observerMS']) for f in frames]),'fine':dist([max(0,f['lower']['fineMS']-f['jointGuard']['observerMS']) for f in frames]),'guard':dist([f['jointGuard']['guardWallMS'] for f in frames]),'scope':'worker CPU wall time; source fine-observer and baseline-only guard replay overhead excluded; candidate guard remains included; not complete rendered frame time','warmupExcludedSteps':12,'sampleSteps':len(frames)}
  guard={k:sum(f[k] for f in x['jointGuard']['frames']) for k in ['calls','guideAccepted','normalAccepted','blocked','queryCount','trianglePairs','acceptedWithResidual']}
  guard['guardWallMS']=sum(f['guardWallMS'] for f in x['jointGuard']['frames']);guard['observerMS']=sum(f['observerMS'] for f in x['jointGuard']['frames'])
  if mode=='baseline' and motion=='walk':regression=x['jointGuard']['exactRegression']
  cases.append({'motion':motion,'mode':mode,'initialStateSHA256':x['checkpoints'][2]['stateSHA256'],'plannedSteps':x['plannedSteps'],'completedSteps':x['completedSteps'],'failure':x['failure'],'dtSeconds':x['dtSeconds'],'walkingClip':x['walkingClip'],'fitGate':x['originalFitGate'],'passCap':32,'points':points,'cost':cost,'guard':guard,'frameGuards':x['jointGuard']['frames'],'eventExamples':x['jointGuard']['events'][:4],'nativeChecks':len(r['checks']),'environment':r['environment']})
assert len(native_codes)==1 and regression and not regression['choices'][0]['decision']['allowed']
for motion in ['static','walk']:
 pair=[c for c in cases if c['motion']==motion];assert pair[0]['initialStateSHA256']==pair[1]['initialStateSHA256'];assert pair[0]['environment']==pair[1]['environment']
source={'nativeCommit':'c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49','coverageSHA256':'b0ac0923ff63895d14ae1f5c60f0354c521e598f8e146416a69f95f9ccd5675a','guardSHA256':guardhash,'nativeCodeCommit':next(iter(native_codes))}
data={'schema':'kaopu/joint-guard-review@1','version':'RF01-S3.11','source':source,'nativeRun':os.environ['RF311_NATIVE_RUN'],'scope':'terminal-guided-centroid-only','cases':cases,'regression':regression,'evidence':evidence,'fitCertified':False,'productionChanged':False,'continuousCollisionCertified':False,'fiveSecondABBAExecuted':False,'geometryScope':'real endpoint patch and full-body BVH strict intersection pairs, not swept/coplanar/rendered-yarn collision','nextRule':'Rejecting an unsafe proposal can leave a blocked constraint. Keep all residual contact channels visible and do not promote this conservative gate as a complete solver.'}
(R/'review-data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
script="const fs=require('node:fs'),r=require(process.argv[1]),x=JSON.parse(fs.readFileSync(process.argv[2]));r.validate(x,x.source);console.log(JSON.stringify(r.summary(x),null,2));"
summary=json.loads(subprocess.check_output(['node','-e',script,str(R/'review.js'),str(R/'review-data.json')],text=True));(R/'ANALYSIS.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
sourceCommit=subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip();files=['TASK_ANCHOR.json','joint-guard.mjs','instrument.py','run_native.py','review.js','build.py','index.template.html','app.js','tests/unit.mjs','tests/protocol.cjs','tests/browser.py','README.md']
m={'version':'REALITY-HC-S3.11','sourceCommit':sourceCommit,'source':source,'nativeRun':data['nativeRun'],'sourceFiles':{n:sha((R/n).read_bytes()) for n in files},'dataSHA256':sha((R/'review-data.json').read_bytes()),'evidence':evidence,'scope':data['scope'],'fitCertified':False,'productionChanged':False,'live':False,'fiveSecondABBAExecuted':False}
js='const RF311_BUILD='+json.dumps(m,ensure_ascii=False)+';\nconst RF311_DATA='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n'+(R/'review.js').read_text()+'\n'+(R/'app.js').read_text();assert '</script' not in js.lower()
g=R/'_generated';g.mkdir(exist_ok=True);(g/'bundle.js').write_text(js);subprocess.run(['node','--check',str(g/'bundle.js')],check=True)
html=(R/'index.template.html').read_text();assert html.count('<!-- RF311_SCRIPTS -->')==1;html=html.replace('<!-- RF311_SCRIPTS -->','<script>\n'+js+'\n</script>');(R/'preview.html').write_text(html);m['html']={'bytes':len(html.encode()),'sha256':sha(html.encode())};(R/'BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
print(json.dumps({'html':m['html'],'sourceCommit':sourceCommit,'summary':summary},ensure_ascii=False,indent=2))
