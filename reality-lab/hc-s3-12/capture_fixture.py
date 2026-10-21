"""Run the existing S3.11 reference and guard unchanged; add copied local-solver fixtures.
Never apply a new movement or rewrite original host files. Timing is not a new benchmark.
"""
from pathlib import Path
import os,sys,runpy,importlib.util,json,hashlib,shutil
R=Path(__file__).resolve().parent;P=R.parent/'hc-s3-11';H=Path(os.environ['GARMENT_HOST']).resolve()
spec=importlib.util.spec_from_file_location('instrument',P/'instrument.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);original=module.assemble

def assemble(host,mode,motion):
 responses,proof=original(host,mode,motion)
 text=responses['rf311-joint-guard.mjs'].decode()
 needle='this.scratch.set(p);const before=this.patch(p,movable,faces,exact),choices=[];'
 hook="""if((exact||(this.mode==='guarded'&&this.step===102))&&!(this.localFixtures||[]).some(x=>x.step===this.step)){
    (this.localFixtures??=[]).push({schema:'kaopu/native-contact-fixture@1',sourceMode:this.mode,step:this.step,pass,faceOffset,ids:Array.from(ids),movable:Array.from(movable),scale,margin,guide:Array.from(guide),normal:Array.from(normal),cloth:{positions:Array.from(p),faces:Array.from(this.s.faces),weights:Array.from(this.s.w)},body:{positions:Array.from(this.surface.p),faces:Array.from(this.surface.faces)},limits:{globalFitGate:1.45,contactPasses:32,productionChanged:false},nativeGuardSource:'f8a7b82c53618ebf8fc9d52ace6f89de4385e7ba17b28b49b6031650ae9da963'});
   }
   """
 assert text.count(needle)==1
 text=text.replace(needle,hook+needle)
 target='return {mode:this.mode,frames:this.frames,events:this.events'
 assert text.count(target)==1
 text=text.replace(target,'return {localFixtures:this.localFixtures||[],mode:this.mode,frames:this.frames,events:this.events')
 responses['rf311-joint-guard.mjs']=text.encode()
 proof['copiedFixtureOnly']=True;proof['newProposalApplied']=False
 return responses,proof

module.assemble=assemble;sys.modules['instrument']=module;os.environ['RF311_MOTION']='walk';sys.path.insert(0,str(P))
runpy.run_path(str(P/'run_native.py'),run_name='__main__')
Q=R/'qa/fixtures';Q.mkdir(parents=True,exist_ok=True)
records=[]
for mode in ['baseline','guarded']:
 d=json.loads((P/'qa/native/walk'/mode/'ENDURANCE.json').read_text());rep=json.loads((P/'qa/native/walk'/mode/'REPORT.json').read_text())
 assert rep['passed'] and d['completedSteps']==180
 for fixture in d['jointGuard']['localFixtures']:
  name=f"{mode}-step{fixture['step']}.json";raw=json.dumps(fixture,separators=(',',':')).encode();(Q/name).write_bytes(raw)
  records.append({'path':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'mode':mode,'step':fixture['step'],'pass':fixture['pass'],'faceOffset':fixture['faceOffset']})
 # Read the immutable previous report via git, not the just-written working file.
 import subprocess
 old=json.loads(subprocess.check_output(['git','show','7c3483d72d224d1e51d9e7d0088af87f94554616:reality-lab/hc-s3-11/qa/native/walk/'+mode+'/ENDURANCE.json'],text=True))
 assert len(d['checkpoints'])==len(old['checkpoints'])==43
 assert all(all(a[k]==b[k] for k in ['stage','step','stateSHA256','body','pair']) for a,b in zip(d['checkpoints'],old['checkpoints']))
 assert d['finalState']==old['finalState']
 (Q/(mode+'-REGRESSION.json')).write_text(json.dumps({'passed':True,'all43EndpointsIdentical':True,'finalStateIdentical':True,'completedSteps':180,'sourceCommit':rep['codeCommit'],'newProposalApplied':False},indent=2))
assert {x['path'] for x in records}>={'baseline-step30.json','guarded-step102.json'}
(Q/'MANIFEST.json').write_text(json.dumps({'passed':True,'version':'RF01-S3.12-FIXTURES','nativeHostCommit':'c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49','referenceCommit':'7c3483d72d224d1e51d9e7d0088af87f94554616','records':records,'productionChanged':False,'copyOnly':True,'allTrajectoryChecksPassed':True},indent=2))
T=R/'_toolkit';T.mkdir(exist_ok=True)
for filename in ['mesh-contact.mjs','lower-body-contact.mjs']:(T/filename).write_bytes((H/filename).read_bytes())
for folder in ['hc-s3-7','hc-s3-9','hc-s3-10','hc-s3-11']:
 for f in (R.parent/folder).glob('*'):
  if f.suffix in ['.mjs','.js','.py','.html','.md','.json'] and f.is_file() and f.stat().st_size<500000:
   dest=T/folder/f.name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(f.read_bytes())
print('FIXTURE_CAPTURE_PASSED',json.dumps(records),flush=True)
