"""One-time repair of the interrupted S2 timing test, not a production adapter.
The original failing predicate optional-chained an undeclared identifier. Check
window's property during asynchronous boot instead; preserve all timing gates.
Only the test and its exact source-lock entry may change. No runtime changes.
"""
from pathlib import Path
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parent.parent/'r14'
EXPECTED_BLOB='2b44dd190a7a78c57c908b6ae70a7e2740a85bef'
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def repair():
 p=ROOT/'qa-browser-performance.py';raw=p.read_bytes();s=raw.decode()
 marker='# S2_TIMING_BOOT_RECOVERY_20261013'
 if marker in s:
  lock=json.loads((ROOT/'canonical.lock.json').read_text())
  assert lock['files']['qa-browser-performance.py']['sha256']==hashlib.sha256(raw).hexdigest()
  print('Timing boot recovery already registered');return
 if blob(raw)!=EXPECTED_BLOB:raise ValueError('Unexpected timing-test source; do not overwrite')
 before='p.wait_for_function(\'LEATHER_ATELIER?.ready\',timeout=180000)'
 after='p.wait_for_function(\'window.LEATHER_ATELIER?.ready\',timeout=180000)'
 assert s.count(before)==1;s=s.replace(before,after)
 # Preserve partial evidence on every failure, rather than losing the run.
 before='rows=[]\nwith sync_playwright() as pw:'
 after='''rows=[]
# S2_TIMING_BOOT_RECOVERY_20261013
import atexit,sys,traceback
failure_details={}
def retain_failure():
 if not (O/'browser-performance.json').exists():
  (O/'browser-performance.json').write_text(json.dumps({'pass':False,'sourceCommit':os.environ.get('LEATHER_SOURCE_COMMIT'),'rows':rows,'failure':failure_details,'pageErrors':globals().get('errors',[]),'note':'Incomplete timing samples never count as passing evidence.'},indent=2)+'\\n')
def record_exception(kind,value,tb):
 failure_details.update(type=kind.__name__,message=str(value),traceback=''.join(traceback.format_exception(kind,value,tb)))
 sys.__excepthook__(kind,value,tb)
(O/'browser-performance.json').unlink(missing_ok=True)
atexit.register(retain_failure)
sys.excepthook=record_exception
with sync_playwright() as pw:'''
 assert s.count(before)==1;s=s.replace(before,after)
 compile(s,str(p),'exec')
 unit="""const vm=require('node:vm'),assert=require('node:assert/strict');
let failed=false;try{vm.runInNewContext('LEATHER_ATELIER?.ready',{window:{}});}catch(e){failed=e.name==='ReferenceError';}assert(failed);
assert.equal(vm.runInNewContext('window.LEATHER_ATELIER?.ready',{window:{}}),undefined);
assert.equal(vm.runInNewContext('window.LEATHER_ATELIER?.ready',{window:{LEATHER_ATELIER:{ready:false}}}),false);
assert.equal(vm.runInNewContext('window.LEATHER_ATELIER?.ready',{window:{LEATHER_ATELIER:{ready:true}}}),true);
console.log('Four startup-predicate regression assertions passed');"""
 subprocess.run(['node','-e',unit],check=True)
 p.write_text(s)
 lockpath=ROOT/'canonical.lock.json';lock=json.loads(lockpath.read_text());data=p.read_bytes()
 lock['files']['qa-browser-performance.py']={**lock['files']['qa-browser-performance.py'],'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'gitBlob':blob(data)}
 lockpath.write_text(json.dumps(lock,indent=2)+'\n')
 (ROOT/'TIMING_RECOVERY.md').write_text('''# S2 timing-test recovery — 2026-10-13

Previous run 38342383451 passed CPU/native/trajectory/performance and 45 ordinary browser checks, but the separate timing test failed at startup. `LEATHER_ATELIER?.ready` throws ReferenceError before that global is declared. The corrected predicate reads `window.LEATHER_ATELIER?.ready` and waits for the real existing boot signal. No timeout or numerical/visual threshold was relaxed; no application source, shader, native code, collision, geometry, thickness, render loop or Worker scheduling was changed by this recovery.

Four executable Node VM assertions cover the original failure and absent/not-ready/ready states. Failures now retain partial timing evidence and traceback as pass=false. The old successful suites are evidence of the interrupted attempt only; delivery requires a fresh complete workflow, then the immutable public URL check. The regular production build never imports this one-time recovery script.
''')
 print('Registered timing-test startup repair; production runtime unchanged')
if __name__=='__main__':repair()
