"""S2B source, native invariance, geometry, protocol and numeric gates."""
from pathlib import Path
import hashlib,importlib.util,json,os,re,shutil,subprocess,tempfile
R=Path(__file__).resolve().parent;B=R.parent/'r14';CHECKS=[]
def sha(b):return hashlib.sha256(b).hexdigest()
def load(p,n):
 s=importlib.util.spec_from_file_location(n,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def check(n,p,d=None):
 CHECKS.append({'name':n,'pass':bool(p),'data':d});print(n,bool(p),flush=True)
 if not p:raise AssertionError(n)
def run(args,env=None):
 q=subprocess.run(args,env=env,capture_output=True,text=True,timeout=1200)
 print(q.stdout[-1400:],flush=True)
 if q.returncode:raise RuntimeError(q.stderr[-3000:]+q.stdout[-1000:])
def constant(doc,n):
 i=doc.index('const '+n+'=')+len('const '+n+'=');return json.JSONDecoder().raw_decode(doc[i:])[0]
def verify():
 b=load(R/'build.py','r15build');ref=load(B/'build.py','r14build');lock=b.verify_sources()
 for n,q in lock['files'].items():check('Pinned '+n,sha((R/n).read_bytes())==q['sha256'])
 result=b.build();ref.build();doc=(R/'out/candidate-r15.html').read_text();old=(B/'out/candidate-r14.html').read_text()
 ml=json.loads((R/'assembly.json').read_text());l=b.Linker(ml);bl=ref.Linker(json.loads((B/'assembly.json').read_text()))
 changed={'product-worker-runtime','product-worker-client'}
 allowed_paths={'src/workers/client.js','src/workers/product-entry.js'}
 for k,m in ml['modules'].items():
  if m['file'] in allowed_paths:continue
  x=l.module(k)
  if m['file']=='src/app/runtime.js':x=x.replace('R15.0-S2B','R14.0-S2A')
  check('Protected module '+k,x==bl.module(k))
 for p in (B/'native').iterdir():
  if p.is_file():check('Unchanged native '+p.name,p.read_bytes()==(R/'native'/p.name).read_bytes())
 check('Recompiled native kernel still R14',json.loads((R/'qa/s2/native.json').read_text())['pass'])
 for n in ['WORKER_CODE','LEGACY_CRAFT_GZIP','BASELINE_GZIP']:check('Unchanged payload '+n,constant(doc,n)==constant(old,n))
 check('Scan maps unchanged',re.search(r'<div id="scanData" hidden>(.*?)</div>',doc,re.S)[1]==re.search(r'<div id="scanData" hidden>(.*?)</div>',old,re.S)[1])
 # The pump is unchanged byte-for-byte: presentation credits cannot pace it.
 wa=(R/'src/workers/product-entry.js').read_text();wb=(B/'src/workers/product-entry.js').read_text()
 for name,nextname in [('schedule','pump'),('pump','self.onmessage')]:
  pat='function '+name+'(';i=wa.index(pat);j=wb.index(pat);end=('function '+nextname+'(') if nextname!='self.onmessage' else nextname
  check('Unchanged simulation '+name,wa[i:wa.index(end,i)]==wb[j:wb.index(end,j)])
 (R/'out/reference-worker.js').write_text(bl.emit({'ref':'product'}));(R/'out/candidate-worker.js').write_text(l.emit({'ref':'product'}))
 env={**os.environ,'BASE_LIB':str(B/'node-lib.cjs')}
 for script,target,count in [('qa-numeric.cjs','qa/numeric.json',18),('qa-geometry-equivalence.cjs','qa/s1b/equivalence.json',25),('qa-pose-stream.cjs','qa/s2b/pose-stream.json',45)]:
  (R/target).unlink(missing_ok=True);run(['node',str(R/script)],env);q=json.loads((R/target).read_text());v=q.get('cases',q.get('checks'));v=len(v) if isinstance(v,list) else v;check('Fresh '+script,q['pass'] and v==count,{'cases':v})
 with tempfile.TemporaryDirectory() as td:
  out=Path(td)/'original-app';mig=load(B/'materialize.py','original_migration');mig.materialize(R.parents[1],out);env['BASE_APP_DIR']=str(out/'src/app');run(['node',str(R/'qa-app-interfaces.cjs')],env);q=json.loads((R/'qa/s1b2/app-interfaces.json').read_text());check('25 actual app composition cases',q['pass'] and q['cases']==25)
  iso=Path(td)/'isolated';shutil.copytree(R,iso,ignore=shutil.ignore_patterns('out','qa','node-lib.cjs','__pycache__'));ib=load(iso/'build.py','isolated');check('Isolated directory rebuild',ib.build()['htmlSHA256']==result['htmlSHA256'])
  f=iso/'src/workers/client.js';f.write_text(f.read_text()+'\n/* drift */');failed=False
  try:ib.build()
  except ValueError:failed=True
  check('Unreviewed protocol drift rejected',failed)
 return {'pass':True,'phase':'S2B','sourceCommit':os.environ.get('LEATHER_SOURCE_COMMIT'),'checkCount':len(CHECKS),'checks':CHECKS,'numericCases':18,'geometryCases':25,'full52StepTrajectories':6,'poseProtocolChecks':45,'appCases':25,'build':result,'newBrowserChecks':0}
if __name__=='__main__':
 p=R/'qa/s2b/SUMMARY.json';p.parent.mkdir(parents=True,exist_ok=True)
 try:q=verify()
 except Exception as e:p.write_text(json.dumps({'pass':False,'checks':CHECKS,'error':str(e)},indent=2)+'\n');raise
 p.write_text(json.dumps(q,indent=2)+'\n');print(json.dumps({'pass':True,'checks':len(CHECKS)}))
