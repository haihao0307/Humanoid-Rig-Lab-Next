"""R16 source invariants, numeric/geometry/protocol and demand-frame gates."""
from pathlib import Path
import hashlib,importlib.util,json,os,re,shutil,subprocess,tempfile
R=Path(__file__).resolve().parent;B=R.parent/'r15';checks=[]
def sha(b):return hashlib.sha256(b).hexdigest()
def load(p,n):
 s=importlib.util.spec_from_file_location(n,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def check(n,p,d=None):
 checks.append({'name':n,'pass':bool(p),'data':d});print(n,bool(p),flush=True)
 if not p:raise AssertionError(n)
def run(a,env=None):
 q=subprocess.run(a,env=env,capture_output=True,text=True,timeout=900);print(q.stdout[-1200:],flush=True)
 if q.returncode:raise RuntimeError(q.stderr[-3000:]+q.stdout[-1500:])
def const(doc,n):
 i=doc.index('const '+n+'=')+len('const '+n+'=');return json.JSONDecoder().raw_decode(doc[i:])[0]
def verify():
 b=load(R/'build.py','r16');ref=load(B/'build.py','r15');lock=b.verify_sources();result=b.build();ref.build();m=json.loads((R/'assembly.json').read_text());l=b.Linker(m);bl=ref.Linker(json.loads((B/'assembly.json').read_text()))
 for n,q in lock['files'].items():check('Pinned '+n,sha((R/n).read_bytes())==q['sha256'])
 allowed={'src/app/runtime.js','src/app/frame-flow.js','src/app/composition.js','src/app/view-polish.js','src/app/atelier-controls.js','src/geometry/panels.js','src/workers/client.js'}
 for k,v in m['modules'].items():
  if v['file'] not in allowed:check('Protected module '+k,l.module(k)==bl.module(k))
 for p in (B/'native').iterdir():
  if p.is_file():check('Native unchanged '+p.name,p.read_bytes()==(R/'native'/p.name).read_bytes())
 doc=(R/'out/candidate-r16.html').read_text();old=(B/'out/candidate-r15.html').read_text()
 for n in ['PRODUCT_WORKER_CODE','WORKER_CODE','LEGACY_CRAFT_GZIP','BASELINE_GZIP']:check('Unchanged runtime payload '+n,const(doc,n)==const(old,n))
 check('Exact accepted grain maps',re.search(r'<div id="scanData" hidden>(.*?)</div>',doc,re.S)[1]==re.search(r'<div id="scanData" hidden>(.*?)</div>',old,re.S)[1])
 a=(R/'src/geometry/panels.js').read_text().replace('texelFetch(uProductNodes,ivec2(0,int(id)),0).xyz','texture2D(uProductNodes,vec2(1./6.,(id+.5)/uProductNodeCount)).xyz').replace('texelFetch(uProductNodes,ivec2(int(x*3.),int(id)),0).xyz','texture2D(uProductNodes,vec2(x,(id+.5)/uProductNodeCount)).xyz').replace('-R16-integer-node-fetch-','-R07-product-skin-')
 check('Geometry and material-frame arithmetic unchanged',a==(B/'src/geometry/panels.js').read_text())
 a=(R/'src/workers/client.js').read_text().replace('this.onPoseAvailable?.();','');check('Only client display notification added',a==(B/'src/workers/client.js').read_text())
 (R/'out/candidate-worker.js').write_text(l.emit({'ref':'product'}))
 ref14=load(B.parent/'r14/build.py','r14');ref14.build();r14l=ref14.Linker(json.loads((B.parent/'r14/assembly.json').read_text()));(R/'out/reference-worker.js').write_text(r14l.emit({'ref':'product'}));env={**os.environ,'BASE_LIB':str(B.parent/'r14/node-lib.cjs')}
 for script,target,count in [('qa-numeric.cjs','qa/numeric.json',18),('qa-geometry-equivalence.cjs','qa/s1b/equivalence.json',25),('qa-pose-stream.cjs','qa/s2b/pose-stream.json',45),('qa-frame-flow.cjs','qa/render-batch/frame-flow.json',22)]:
  (R/target).unlink(missing_ok=True);run(['node',str(R/script)],env);q=json.loads((R/target).read_text());v=q.get('cases',q.get('checks'));v=len(v) if isinstance(v,list) else v;check('Executed '+script,q['pass'] and v==count,{'cases':v})
 with tempfile.TemporaryDirectory() as td:
  p=Path(td);original=p/'r10';load(B/'materialize.py','migration').materialize(R.parents[1],original);env['BASE_APP_DIR']=str(original/'src/app');run(['node',str(R/'qa-app-interfaces.cjs')],env);q=json.loads((R/'qa/s1b2/app-interfaces.json').read_text());check('Existing 25 app semantics',q['pass'] and q['cases']==25)
  iso=p/'isolated';shutil.copytree(R,iso,ignore=shutil.ignore_patterns('qa','out','node-lib.cjs','__pycache__'));ib=load(iso/'build.py','isolated');check('Isolated canonical build',ib.build()['htmlSHA256']==result['htmlSHA256']);(iso/'src/app/frame-flow.js').write_text('/* injected missing frame logic */');failed=False
  try:ib.build()
  except ValueError:failed=True
  check('Source drift rejected',failed)
 return {'pass':True,'checks':checks,'checkCount':len(checks),'numericCases':18,'geometryCases':25,'full52StepTrajectories':6,'poseProtocolChecks':45,'frameFlowChecks':22,'appCases':25,'build':result,'sourceCommit':os.environ.get('LEATHER_SOURCE_COMMIT')}
if __name__=='__main__':
 out=R/'qa/render-batch/SUMMARY.json';out.parent.mkdir(parents=True,exist_ok=True)
 try:q=verify()
 except Exception as e:out.write_text(json.dumps({'pass':False,'checks':checks,'error':str(e)},indent=2));raise
 out.write_text(json.dumps(q,indent=2)+'\n')
