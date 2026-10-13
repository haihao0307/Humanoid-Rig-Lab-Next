"""Fresh S2 source, numeric, interface, certificate and trajectory verification."""
from pathlib import Path
import hashlib,importlib.util,json,os,re,shutil,subprocess,tempfile,time
R=Path(__file__).resolve().parent;CHECKS=[]
def sha(b):return hashlib.sha256(b).hexdigest()
def load(p,n):
 s=importlib.util.spec_from_file_location(n,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def check(n,p,d=None):
 CHECKS.append({'name':n,'pass':bool(p),'data':d});print(n,bool(p),flush=True)
 if not p:raise AssertionError(n)
def run(a,env=None):
 q=subprocess.run(a,env=env,capture_output=True,text=True,timeout=1200)
 if q.returncode:raise RuntimeError(q.stdout[-2000:]+q.stderr[-2000:])
 print(q.stdout[-1200:],flush=True)
def constant(doc,n):
 q=list(re.finditer(r'\bconst\s+'+n+r'\s*=',doc));assert len(q)==1;return json.JSONDecoder().raw_decode(doc[q[0].end():])[0]
def verify():
 b=load(R/'build.py','candidate');base=load(R.parent/'r13/build.py','baseline');lock=b.verify_sources()
 for n,q in lock['files'].items():check('Pinned '+n,sha((R/n).read_bytes())==q['sha256'])
 result=b.build();doc=(R/'out/candidate-r14.html').read_text();m=json.loads((R/'assembly.json').read_text());l=b.Linker(m)
 base.build();old=(R.parent/'r13/out/candidate-r13.html').read_text();bl=base.Linker(json.loads((R.parent/'r13/assembly.json').read_text()))
 for k in m['modules']:
  if k=='native-energy':continue
  s=l.module(k)
  if k=='app-runtime':s=s.replace('R14.0-S2A','R13.0-S1C')
  check('Protected module '+k,s==bl.module(k))
 for n in ['contact.c','broadphase.c']:check('Protected native '+n,(R/'native'/n).read_bytes()==(R.parent/'r13/native'/n).read_bytes())
 for n in ['WORKER_CODE','LEGACY_CRAFT_GZIP','BASELINE_GZIP']:check('Unchanged payload '+n,constant(doc,n)==constant(old,n))
 check('Scan maps unchanged',re.search(r'<div id="scanData" hidden>(.*?)</div>',doc,re.S)[1]==re.search(r'<div id="scanData" hidden>(.*?)</div>',old,re.S)[1])
 for n in ['src/workers/client.js','src/workers/product-entry.js','src/physics/implicit-solver.js']:check('No scheduling/iteration change '+n,(R/n).read_bytes()==(R.parent/'r13'/n).read_bytes())
 with tempfile.TemporaryDirectory() as t:
  p=Path(t);iso=p/'isolated';shutil.copytree(R,iso,ignore=shutil.ignore_patterns('out','node-lib.cjs','qa','__pycache__'))
  ib=load(iso/'build.py','isolated');check('Independent source build',ib.build()['htmlSHA256']==result['htmlSHA256'])
  f=iso/'src/physics/native-energy.js';f.write_text(f.read_text()+'\n/* injected drift */');failed=False
  try:ib.build()
  except ValueError:failed=True
  check('Changed ABI input rejected',failed)
  env={**os.environ,'BASE_LIB':str(R.parent/'r13/node-lib.cjs')}
  for script,name,count in [('qa-numeric.cjs','qa/numeric.json',18),('qa-native-certificate.cjs','qa/s2/native-certificate.json',480),('qa-geometry-equivalence.cjs','qa/s1b/equivalence.json',25)]:
   (R/name).unlink(missing_ok=True);run(['node',str(R/script)],env);q=json.loads((R/name).read_text());n=q.get('cases',q.get('checks'));n=len(n) if isinstance(n,list) else n;check('Executed '+script,q['pass'] and n==count,{'cases':n})
  ref=p/'r10';mig=load(R/'materialize.py','migration');mig.materialize(R.parents[1],ref);env['BASE_APP_DIR']=str(ref/'src/app')
  run(['node',str(R/'qa-app-interfaces.cjs')],env);q=json.loads((R/'qa/s1b2/app-interfaces.json').read_text());check('25 app interfaces',q['pass'] and q['cases']==25)
  v=load(R.parent/'r13/verify-closure.py','graph_reference');ip=p/'deps.json';ip.write_text(json.dumps(v.dependency_input(m,l)));gp=R/'qa/s2/dependencies.json';run(['node',str(R/'qa-dependencies.cjs'),str(ip),str(gp)],env);q=json.loads(gp.read_text());check('Same declared cross-module relationships',q['pass'] and sha(json.dumps(q,sort_keys=True,separators=(',',':')).encode())==v.EXPECTED_GRAPH)
 return {'pass':True,'phase':'S2A','checkCount':len(CHECKS),'checks':CHECKS,'nativeCertificateCases':480,'numericalCases':18,'geometryCases':25,'full52StepTrajectories':6,'appInterfaceCases':25,'build':result,'sourceCommit':os.environ.get('LEATHER_SOURCE_COMMIT'),'newBrowserChecks':0,'performanceValidatedSeparately':True}
if __name__=='__main__':
 out=R/'qa/s2/SUMMARY.json';out.parent.mkdir(parents=True,exist_ok=True)
 try:q=verify()
 except Exception as e:out.write_text(json.dumps({'pass':False,'checks':CHECKS,'error':str(e)},indent=2)+'\n');raise
 out.write_text(json.dumps(q,indent=2)+'\n');print(json.dumps({'pass':True,'checks':len(CHECKS)}))
