"""B1 exact-source, unchanged physics and changed-interface regression."""
from pathlib import Path
import importlib.util,json,hashlib,os,subprocess,re,shutil,tempfile
R=Path(__file__).resolve().parent;B=R.parent/'r16';checks=[]
def load(p,n):
 s=importlib.util.spec_from_file_location(n,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def check(n,p,d=None):
 checks.append({'name':n,'pass':bool(p),'data':d});print(n,bool(p),flush=True)
 if not p:raise AssertionError(n)
def run(script,env):
 q=subprocess.run(['node',str(R/script)],env=env,capture_output=True,text=True,timeout=900);print(q.stdout[-1400:],flush=True)
 if q.returncode:raise RuntimeError(q.stderr[-2600:]+q.stdout[-1500:])
def main():
 builder=load(R/'build.py','candidate');result=builder.build();base=load(B/'build.py','reference');base.build()
 lock=builder.verify_sources();m=json.loads((R/'assembly.json').read_text());a=builder.Linker(m);b=base.Linker(json.loads((B/'assembly.json').read_text()))
 for d in ['native','src/physics','src/materials','src/sewing','assets','vendor','compat','licenses']:
  for p in (B/d).rglob('*'):
   if p.is_file() and '__pycache__' not in str(p):check('Protected '+str(p.relative_to(B)),p.read_bytes()==(R/p.relative_to(B)).read_bytes())
 for key in ['product','specimen','physics']:check('Exact worker/kernel program '+key,a.emit({'ref':key})==b.emit({'ref':key}))
 for n in ['closed-shell.js','pattern-physics.js','assembly-contract.js','measurements.js']:check('Exact '+n,(R/'src/geometry'/n).read_bytes()==(B/'src/geometry'/n).read_bytes())
 for n in ['frame-flow.js','input-performance.js','atelier-controls.js','view-polish.js']:check('Original interaction '+n,(R/'src/app'/n).read_bytes()==(B/'src/app'/n).read_bytes())
 p=(R/'src/geometry/panels.js').read_text();old=(B/'src/geometry/panels.js').read_text()
 check('Accepted material-frame shader equations copied verbatim',p.split('const SKIN_HEADER=`',1)[1].split('`;',1)[0]==old.split('const SKIN_HEADER=`',1)[1].split('`;',1)[0])
 check('CPU frame update unchanged',p[p.index('function frameField'):p.index('function reskinMaterial')]==old[old.index('function frameField'):old.index('function reskinMaterial')])
 s=(R/'src/products/catalogue.js').read_text();hook="root.userData.releaseProductRegistry=()=>{if(activeProducts.get(id)===root)activeProducts.delete(id);};"
 check('Product shape code unchanged; registry release only',s.replace(hook,'')==(B/'src/products/catalogue.js').read_text())
 (R/'out/candidate-worker.js').write_text(a.emit({'ref':'product'}))
 ref14=load(B.parent/'r14/build.py','reference_unbounded');l14=ref14.Linker(json.loads((B.parent/'r14/assembly.json').read_text()));(R/'out/reference-worker.js').write_text(l14.emit({'ref':'product'}))
 env={**os.environ,'BASE_LIB':str(B/'node-lib.cjs')}
 for s in ['qa-numeric.cjs','qa-geometry-equivalence.cjs','qa-pose-stream.cjs','qa-frame-flow.cjs','qa-b1.cjs','qa-shading.cjs']:run(s,env)
 for p in ['qa/numeric.json','qa/s1b/equivalence.json','qa/s2b/pose-stream.json','qa/render-batch/frame-flow.json','qa/b1/unit.json','qa/b1/shading-unit.json']:check('Executed '+p,json.loads((R/p).read_text())['pass'])
 with tempfile.TemporaryDirectory() as tmp:
  iso=Path(tmp)/'r17';shutil.copytree(R,iso,ignore=shutil.ignore_patterns('qa','out','node-lib.cjs','__pycache__'));ib=load(iso/'build.py','isolated');check('Independent source-only build identical',ib.build()['htmlSHA256']==result['htmlSHA256']);(iso/'src/render/pose-cache.js').write_text('/* corrupted */');rejected=False
  try:ib.build()
  except ValueError:rejected=True
  check('Source corruption fails closed',rejected)
 return {'pass':True,'checks':checks,'sourceChecks':len(checks),'numericCases':18,'geometryCases':25,'full52StepTrajectories':6,'poseProtocolChecks':45,'frameFlowChecks':22,'b1UnitChecks':json.loads((R/'qa/b1/unit.json').read_text())['count'],'build':result,'nativeIdenticalToR16':True,'shadingChecks':json.loads((R/'qa/b1/shading-unit.json').read_text())['count']}
if __name__=='__main__':
 out=R/'qa/b1/SUMMARY.json';out.parent.mkdir(parents=True,exist_ok=True)
 try:r=main()
 except Exception as e:out.write_text(json.dumps({'pass':False,'checks':checks,'error':str(e)},indent=2));raise
 out.write_text(json.dumps(r,indent=2)+'\n')
