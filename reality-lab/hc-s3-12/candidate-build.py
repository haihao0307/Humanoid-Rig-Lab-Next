from pathlib import Path
import json,hashlib,subprocess,os,re
R=Path(__file__).resolve().parent;P=R.parent/'hc-s3-11';sha=lambda b:hashlib.sha256(b).hexdigest()
def dist(v):
 v=sorted(v)
 def percentile(q):
  if not v:return 0
  x=(len(v)-1)*q;i=int(x);return v[i]+(v[min(i+1,len(v)-1)]-v[i])*(x-i)
 return {'medianMS':percentile(.5),'p95MS':percentile(.95),'maxMS':max(v,default=0),'totalMS':sum(v)}
cases=[];evidence=[];exact=None;codes=set();moduleSHA=sha((R/'local-solve.mjs').read_bytes());rawcases={}
for motion in ['static','walk']:
 q=R/'qa/native'/motion;run=json.loads((q/'RUN.json').read_text());assert run['passed'];codes.add(run['codeCommit'])
 for mode in ['reference','local']:
  base=q/mode;r=json.loads((base/'REPORT.json').read_text());raw=(base/'ENDURANCE.json').read_bytes();x=json.loads(raw);rawcases[(motion,mode)]=x
  assert r['passed'] and sha(raw)==r['dataSHA256'] and r['assembly']['localModuleSHA256']==moduleSHA and str(r['environment']['runID'])==os.environ['RF312_NATIVE_RUN']
  evidence.append({'motion':motion,'mode':mode,'dataSHA256':sha(raw),'reportSHA256':sha((base/'REPORT.json').read_bytes()),'checks':len(r['checks']),'codeCommit':r['codeCommit']})
  points=[]
  for c in x['checkpoints']:
   if c['step']<1:continue
   p={'step':c['step'],'stateSHA256':c['stateSHA256']}
   for key,ch in [('top',c['body'][0]),('bottom',c['body'][1]),('pair',c['pair'])]:p[key]={k:ch[k] for k in ['minimumM','negative','beyondMargin','count']}
   points.append(p)
  frames=[f for f in x['frames'] if f['step']>12 and f['accepted']];times=[f['adjustedStepMS']-f['jointGuard']['localObserverMS'] for f in frames];assert min(times)>=-1e-3
  cost={'step':dist([max(0,t) for t in times]),'local':dist([f['jointGuard']['localMS'] for f in frames]),'scope':'worker CPU wall time, local candidate included, reference-only shadow solve excluded; not frame FPS','samples':len(frames)}
  totals={k:sum(f[k] for f in x['jointGuard']['frames']) for k in ['calls','guideAccepted','normalAccepted','blocked','localAttempts','localAccepted','localRejected','localMS','localObserverMS','linearQueries']}
  if motion=='walk' and mode=='reference':exact=x['jointGuard']['localExact']
  cases.append({'motion':motion,'mode':mode,'plannedSteps':x['plannedSteps'],'completedSteps':x['completedSteps'],'failure':x['failure'],'dtSeconds':x['dtSeconds'],'fitGate':x['originalFitGate'],'passCap':32,'initialStateSHA256':x['checkpoints'][2]['stateSHA256'],'finalStateSHA256':x['finalState']['sha256'],'points':points,'totals':totals,'cost':cost,'attempts':[{k:a[k] for k in ['step','faceOffset','status','accepted','elapsedMS']} for a in x['jointGuard']['localAttempts']],'environment':r['environment']})
assert len(codes)==1 and exact
regressions=[]
for motion in ['static','walk']:
 a,b=[rawcases[(motion,mode)] for mode in ['reference','local']];accepted=sum(f['localAccepted'] for f in b['jointGuard']['frames']);equal=len(a['checkpoints'])==len(b['checkpoints']) and all(all(x[k]==y[k] for k in ['stage','step','stateSHA256','body','pair']) for x,y in zip(a['checkpoints'],b['checkpoints'])) and a['finalState']==b['finalState']
 if accepted==0:assert equal,'REJECTED_SEARCH_CHANGED_NATIVE_TRAJECTORY'
 regressions.append({'motion':motion,'localAccepted':accepted,'all43EndpointsAndFinalIdentical':equal})
boundary=json.loads((R/'qa/boundary/BOUNDARY_AUDIT.json').read_text());assert boundary['passed'] and boundary['codeSHA256']==sha((R/'boundary-audit.mjs').read_bytes())
source={'nativeCommit':'c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49','nativeCodeCommit':next(iter(codes)),'localModuleSHA256':moduleSHA,'parentGuardSHA256':sha((P/'joint-guard.mjs').read_bytes())}
data={'schema':'kaopu/local-contact-solve-review@1','version':'RF01-S3.12-LOCAL','source':source,'nativeRun':os.environ['RF312_NATIVE_RUN'],'cases':cases,'exact':exact,'evidence':evidence,'boundaryAudit':boundary,'rejectedStateRegressions':regressions,'fitCertified':False,'productionChanged':False,'continuousCollisionCertified':False,'fiveSecondABBAExecuted':False,'scope':'bounded local recovery only after S3.11 terminal-guide guard rejects both native proposals; scratch results are not applied unless all local gates pass'}
(R/'candidate-data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
script="const fs=require('node:fs'),r=require(process.argv[1]),d=JSON.parse(fs.readFileSync(process.argv[2]));r.validate(d,d.source);console.log(JSON.stringify(r.summary(d)));"
summary=json.loads(subprocess.check_output(['node','-e',script,str(R/'candidate-review.js'),str(R/'candidate-data.json')],text=True));summary['rejectedStateRegressions']=regressions;summary['boundaryScopeObstruction']=[{'step':c['step'],'stages':[{'nodes':len(s['movableNodes']),'heldCrossingEdges':s['blockedEdges'],'hits':len(s['hits'])} for s in c['stages']]} for c in boundary['cases']];(R/'CANDIDATE_ANALYSIS.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
code=subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip();names=['local-solve.mjs','instrument.py','run_native.py','boundary-audit.mjs','boundary-ui.js','candidate-review.js','candidate-app.js','candidate.template.html','candidate-build.py','tests/unit.mjs','tests/candidate-protocol.cjs','tests/candidate-browser.py','CANDIDATE_README.md']
m={'version':'RF01-S3.12-LOCAL','sourceCommit':code,'source':source,'nativeRun':data['nativeRun'],'fixtureRun':boundary['fixtureRun'],'files':{n:sha((R/n).read_bytes()) for n in names},'dependencies':{'previousAppSHA256':sha((P/'app.js').read_bytes()),'previousTemplateSHA256':sha((P/'index.template.html').read_bytes())},'dataSHA256':sha((R/'candidate-data.json').read_bytes()),'evidence':evidence,'fitCertified':False,'productionChanged':False,'live':False}
parent=(P/'app.js').read_text();core=parent[parent.index("const canvas=$('view')"):parent.index('function draw()')];app=(R/'candidate-app.js').read_text();assert app.count('// RF312_GL_CORE')==1;app=app.replace('// RF312_GL_CORE',core)
js='const RF312_BUILD='+json.dumps(m,ensure_ascii=False)+';\nconst RF312_DATA='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n'+(R/'candidate-review.js').read_text()+'\n'+app+'\n'+(R/'boundary-ui.js').read_text()
assert '</script' not in js.lower();g=R/'_generated';g.mkdir(exist_ok=True);(g/'candidate-bundle.js').write_text(js);subprocess.run(['node','--check',str(g/'candidate-bundle.js')],check=True)
html=(R/'candidate.template.html').read_text();assert html.count('<!-- RF312_SCRIPTS -->')==1 and html.count('/*RF312_STYLE*/')==1;css=(P/'index.template.html').read_text().split('<style>')[1].split('</style>')[0];html=html.replace('/*RF312_STYLE*/',css).replace('<!-- RF312_SCRIPTS -->','<script>\n'+js+'\n</script>');(R/'candidate-preview.html').write_text(html);m['html']={'bytes':len(html.encode()),'sha256':sha(html.encode())};(R/'CANDIDATE_BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2));print(json.dumps({'html':m['html'],'analysis':summary},ensure_ascii=False,indent=2))
