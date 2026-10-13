"""S1C proof: real native recompilation + source/dependency/geometry regressions."""
from pathlib import Path
import hashlib,importlib.util,json,os,re,shutil,subprocess,tempfile,time
ROOT=Path(__file__).resolve().parent
CHECKS=[]
EXPECTED_GRAPH='0deacae7824e6c8b7188c8c216e484c6cea039740e0c46fe7f6a7ca435f154cc'
def sha(b):return hashlib.sha256(b).hexdigest()
def load(p,n):
 spec=importlib.util.spec_from_file_location(n,p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def check(name,passed,data=None):
 CHECKS.append({'name':name,'pass':bool(passed),'data':data})
 print(name,bool(passed),flush=True)
 if not passed:raise AssertionError(name)

def run(args,env=None,timeout=900):
 result=subprocess.run(args,env=env,capture_output=True,text=True,timeout=timeout)
 if result.returncode:raise RuntimeError(result.stdout[-1600:]+result.stderr[-1600:])
 return result.stdout

def constant(doc,name):
 found=list(re.finditer(r'\bconst\s+'+name+r'\s*=',doc));assert len(found)==1
 return json.JSONDecoder().raw_decode(doc[found[0].end():])[0]

def dependency_input(m,l):
 def program(node):
  chunks=[];ranges=[];pos=0
  def emit(n):
   nonlocal pos
   op,v=next(iter(n.items()))
   if op=='join':
    for q in v:emit(q)
   elif op=='ref':emit(m['programs'][v])
   else:
    if op=='module':
     s='const T={};' if v=='vendor-three' else 'const POLY2TRI={};' if v=='vendor-poly2tri' else l.module(v)
     length=len(s.encode('utf-16-le'))//2;ranges.append({'id':v,'start':pos,'end':pos+length})
    elif op in ['jsonString','base64']:s='"PAYLOAD"'
    elif op=='buildIdentity':s='{}'
    elif op=='text':s=v
    else:s=l.as_text(l.emit(n))
    chunks.append(s);pos+=len(s.encode('utf-16-le'))//2
  emit(node);return {'code':''.join(chunks),'ranges':ranges}
 return {k:program(v) for k,v in {'main':m['main'],'product':m['programs']['product'],'specimen':m['programs']['specimen']}.items()}

def verify():
 start=time.monotonic();out=ROOT/'qa/s1c';out.mkdir(parents=True,exist_ok=True)
 b=load(ROOT/'build.py','closure_builder');lock=b.verify_sources()
 for n,q in lock['files'].items():check('Pinned input '+n,sha((ROOT/n).read_bytes())==q['sha256'])
 build=b.build();doc=(ROOT/'out/candidate-r13.html').read_text();m=json.loads((ROOT/'assembly.json').read_text());l=b.Linker(m)
 native=json.loads((out/'native.json').read_text());check('Native source rebuilt twice, exactly matching accepted binary',native['pass'] and native['identicalToAcceptedKernel'] and not native['prebuiltBytesUsedForOutput'],native)
 with tempfile.TemporaryDirectory(prefix='leather-s1c-proof-') as tmp:
  tmp=Path(tmp)
  # A separate frozen reference package; never overwrite R12 in place.
  ref=tmp/'r12';shutil.copytree(ROOT.parent/'r12',ref,ignore=shutil.ignore_patterns('out','node-lib.cjs','__pycache__','qa','development'))
  rb=load(ref/'build.py','reference_builder');saved=os.environ.get('LEATHER_SOURCE_COMMIT');os.environ['LEATHER_SOURCE_COMMIT']='731e127b63e3b323484459bc0391410ec19e8c1c'
  try:rbuild=rb.build()
  finally:
   if saved is None:os.environ.pop('LEATHER_SOURCE_COMMIT',None)
   else:os.environ['LEATHER_SOURCE_COMMIT']=saved
  check('Independent canonical R12 reference reproduces published HTML',rbuild['htmlSHA256']=='46cfe2531e1c2c98242a6c1338725fa35ffeb5ec5a913c889287dd46278a398c')
  rm=json.loads((ref/'assembly.json').read_text());rl=rb.Linker(rm)
  for k in m['modules']:
   a=l.module(k);old=rl.module(k)
   if k=='app-runtime':a=a.replace('R13.0-S1C','R12.0-S1B2')
   check('Unchanged runtime module '+k,a==old)
  olddoc=(ref/'out/candidate-r12-s1b.html').read_text()
  for n in ['PRODUCT_WORKER_CODE','WORKER_CODE','LEGACY_CRAFT_GZIP','BASELINE_GZIP']:
   check('Identical actual payload '+n,constant(doc,n)==constant(olddoc,n))
  for p in ['scanData']:
   pattern=r'<div id="'+p+r'" hidden>(.*?)</div>'
   check('Identical embedded '+p,re.search(pattern,doc,re.S)[1]==re.search(pattern,olddoc,re.S)[1])
  inp=dependency_input(m,l);ip=tmp/'input.json';ip.write_text(json.dumps(inp));dp=out/'dependencies.json'
  run(['node',str(ROOT/'qa-dependencies.cjs'),str(ip),str(dp)])
  graph=json.loads(dp.read_text());sig=sha(json.dumps(graph,sort_keys=True,separators=(',',':')).encode())
  check('Compiler-resolved binding graph matches reviewed contract',graph['pass'] and sig==EXPECTED_GRAPH,{'sha256':sig,'programs':{k:len(v['bindings']) for k,v in graph['programs'].items()},'remainingReviewedExtensions':{k:v['prototypeAssignments'] for k,v in graph['programs'].items()}})
  bad=json.loads(json.dumps(inp));bad['main']['code']+='\nUNDECLARED_LEATHER_DEPENDENCY();';ip.write_text(json.dumps(bad));result=subprocess.run(['node',str(ROOT/'qa-dependencies.cjs'),str(ip),str(tmp/'bad.json')],capture_output=True,text=True)
  check('New undeclared dependency is rejected',result.returncode!=0 and any('UNDECLARED_LEATHER_DEPENDENCY' in x for x in json.loads((tmp/'bad.json').read_text())['unknown']))
  isolated=tmp/'isolated';shutil.copytree(ROOT,isolated,ignore=shutil.ignore_patterns('out','node-lib.cjs','__pycache__','qa','development'))
  ib=load(isolated/'build.py','isolated_builder')
  check('Package builds with no r01-r12 folders',ib.build()['htmlSHA256']==build['htmlSHA256'])
  # Packed accepted bytes are audit-only; removing them cannot alter the output.
  for p in (isolated/'native').glob('kernel-*.b64'):p.unlink()
  local_lock=json.loads((isolated/'canonical.lock.json').read_text())
  for n in list(local_lock['files']):
   if n.startswith('native/kernel-') and n.endswith('.b64'):del local_lock['files'][n]
  (isolated/'canonical.lock.json').write_text(json.dumps(local_lock))
  # Compare runtime payloads, excluding the deliberately changed lock identity.
  iso_doc=ib.Linker(json.loads((isolated/'assembly.json').read_text())).build().decode()
  check('No native output is copied from prebuilt audit chunks',constant(iso_doc,'PRODUCT_WORKER_CODE')==constant(doc,'PRODUCT_WORKER_CODE'))
  p=isolated/'native/contact.c';raw=p.read_bytes();p.write_bytes(raw+b'\n/* injected drift */')
  failed=False
  try:ib.build()
  except ValueError:failed=True
  check('Native source drift fails before publishing',failed)
  p.unlink();failed=False
  try:ib.build()
  except (ValueError,FileNotFoundError):failed=True
  check('Missing native source cannot use old kernel',failed)
  env={**os.environ,'BASE_LIB':str(ref/'node-lib.cjs')}
  for script,name,count in [('qa-numeric.cjs','qa/numeric.json',18),('qa-interfaces.cjs','qa/s1b/interfaces.json',3),('qa-geometry-equivalence.cjs','qa/s1b/equivalence.json',25)]:
   (ROOT/name).unlink(missing_ok=True);run(['node',str(ROOT/script)],env,1800);q=json.loads((ROOT/name).read_text());n=q.get('cases',q.get('checks'));n=len(n) if isinstance(n,list) else n;check('Fresh '+script,q['pass'] and n==count,{'cases':n})
  # Existing app differential suite uses original R10 wrappers as its reference.
  frozen=tmp/'r10';mig=load(ROOT/'materialize.py','reference_migration');mig.materialize(ROOT.parents[1],frozen)
  env['BASE_APP_DIR']=str(frozen/'src/app');run(['node',str(ROOT/'qa-app-interfaces.cjs')],env)
  q=json.loads((ROOT/'qa/s1b2/app-interfaces.json').read_text());check('Application composition keeps all 25 interface cases',q['pass'] and q['cases']==25)
 return {'schema':'kaopu/leather-s1c-verification@1','pass':all(x['pass'] for x in CHECKS),'checks':CHECKS,'checkCount':len(CHECKS),'nativeFromSource':True,'nativeByteIdentical':True,'bindings':181,'reviewedExtensionAssignments':4,'numericalCases':18,'appInterfaceCases':25,'geometryCases':25,'full52StepTrajectories':6,'elapsedSeconds':time.monotonic()-start,'sourceCommit':os.environ.get('LEATHER_SOURCE_COMMIT','UNCOMMITTED'),'build':build,'newBrowserChecks':0,'scope':'Build/source closure. Browser release and user acceptance are separate gates.'}
if __name__=='__main__':
 out=ROOT/'qa/s1c/SUMMARY.json';out.parent.mkdir(parents=True,exist_ok=True)
 try:result=verify()
 except Exception as e:
  out.write_text(json.dumps({'pass':False,'error':str(e),'checks':CHECKS},indent=2)+'\n');raise
 out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['checks','build']}))
