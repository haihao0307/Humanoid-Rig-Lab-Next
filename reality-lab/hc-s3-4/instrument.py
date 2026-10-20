from pathlib import Path
import hashlib,json,subprocess
PINS={
 'wasm-cloth.mjs':'33df85592209c3ddd60224a75fe3129666028ab185f0da5eb1a9fd9e35b62de5',
 'live-cloth-worker.mjs':'7cd945c060e4206bdef1b2b1eba302d8bd4a0cd9c44d0858b6031db3cf21d3c7',
 'live-cloth-controller.mjs':'8fa9f8f444b3d6b560e811ffc9b87049b6a9b54e273daadc6be4b1468b55fbe6'
}
sha=lambda b:hashlib.sha256(b).hexdigest()
def make_responses(host:Path,root:Path,verbose:bool):
 originals={n:(host/n).read_bytes() for n in PINS}
 for n,b in originals.items():assert sha(b)==PINS[n],('SOURCE_PIN_MISMATCH',n)
 outputs={};proof=[]
 for name,b in originals.items():
  text=b.decode('utf-8');changes=[]
  def append_after(needle,addition,count=1):
   nonlocal text
   assert text.count(needle)==count,(name,needle,text.count(needle),count)
   tagged='/*RF34_START_'+str(len(changes))+'*/'+addition+'/*RF34_END_'+str(len(changes))+'*/'
   text=text.replace(needle,needle+tagged);changes.append((needle,tagged,count))
  def prepend_before(needle,addition):
   nonlocal text
   assert text.count(needle)==1,(name,needle,text.count(needle))
   tagged='/*RF34_START_'+str(len(changes))+'*/'+addition+'/*RF34_END_'+str(len(changes))+'*/'
   text=text.replace(needle,tagged+needle);changes.append((needle,tagged,1))
  if name=='live-cloth-worker.mjs':
   append_after("import {auditSeamRegions} from './seam-region-audit.mjs';","\nimport {createObserver} from './rf34-observer.mjs';\n")
   prepend_before('world.actor.evaluate({});',"try{globalThis.__RF34=createObserver(world,"+str(verbose).lower()+");}catch(e){self.postMessage({__RF34_DIAG__:{key:'observerError',data:String(e.stack||e)}});}")
   prepend_before('const fittingSteps=origin?48:8;',"globalThis.__RF34?.attach(world.acceleration);")
   append_after('for(let i=0;i<fittingSteps;i++){',"globalThis.__RF34?.fit(i,fittingSteps,!!origin);")
   prepend_before('world.initial=world.solvers.map(s=>s.p.slice());',"globalThis.__RF34?.finish();")
  elif name=='live-cloth-controller.mjs':
   prepend_before('  this.worker.onmessage=',"  this.worker.addEventListener('message',({data})=>{if(data.__RF34_DIAG__){window.__RF34_CAPTURE__??={};window.__RF34_CAPTURE__[data.__RF34_DIAG__.key]=data.__RF34_DIAG__.data;}});\n")
  else:
   prepend_before('w.pairContacts=0;',"globalThis.__RF34?.stepStart(this);")
   prepend_before(' if(this.solvers.some(a=>{'," globalThis.__RF34?.gate(this);\n")
   append_after('const r=a.s.audit(false);',"globalThis.__RF34?.audit(a,r);")
   append_after('w.safetyTrips++;this.metrics.rollbacks++;',"globalThis.__RF34?.failure(this,error.message);")
   if verbose:
    append_after('for(let ss=0;ss<sub;ss++){',"globalThis.__RF34?.mark('substep-entry',{substep:ss,iteration:null,phase:'prediction',operationSolver:null});")
    append_after('this.waist?.apply(f);',"globalThis.__RF34?.mark('after-body-interpolation-and-waist');")
    append_after('for(let it=0;it<16;it++){',"globalThis.__RF34?.mark('iteration-entry',{substep:ss,iteration:it,phase:'elastic',operationSolver:null});")
    append_after('e.distance_batch(a.p.ptr,a.w.ptr,a.edges.ptr,s.edges.length,alpha);',"globalThis.__RF34?.mark('after-distance',{operationSolver:w.solvers.indexOf(s)});")
    append_after("e.bend_batch(a.p.ptr,a.w.ptr,a.bends.ptr,s.bends.length,(s.family==='leather'?2800:s.family==='denim'?6000:12000)/(Math.max(.05,s.settings.bend)*h*h));","globalThis.__RF34?.mark('after-bend-or-skip',{operationSolver:w.solvers.indexOf(s)});")
    append_after('for(let it=0;it<12;it++){',"globalThis.__RF34?.mark('iteration-entry',{substep:ss,iteration:it,phase:'polish',operationSolver:null});")
    append_after("e.strain_batch(a.p.ptr,a.w.ptr,a.edges.ptr,s.edges.length,s.family==='knit'?.82:.90,s.family==='knit'?1.18:1.12);","globalThis.__RF34?.mark('after-strain-projection',{operationSolver:w.solvers.indexOf(s)});",2)
    append_after('w.elapsed+=h;',"globalThis.__RF34?.mark('substep-finished',{substep:ss,iteration:null,phase:'finish',operationSolver:null});")
  restored=text
  for needle,tagged,count in reversed(changes):
   assert restored.count(tagged)==count
   restored=restored.replace(tagged,'')
  assert restored.encode('utf-8')==b,('SOURCE_RESTORATION_FAILED',name)
  if name=='wasm-cloth.mjs':assert text.count('r.maxEdgeStretch>1.45')==1
  outputs[name]=text.encode('utf-8');proof.append({'path':name,'originalSHA256':sha(b),'observedSHA256':sha(outputs[name]),'insertions':len(changes),'removalExact':True,'originalStatementsRemoved':False})
 outputs['rf34-observer.mjs']=(root/'observer.mjs').read_bytes()
 return outputs,proof
if __name__=='__main__':
 import sys
 host,root=map(Path,sys.argv[1:3]);out=root/'_generated';out.mkdir(exist_ok=True)
 for verbose in [False,True]:
  files,proof=make_responses(host,root,verbose)
  for n,b in files.items():
   p=out/('trace-' if verbose else 'baseline-')
   p=Path(str(p)+n);p.write_bytes(b);subprocess.run(['node','--check',str(p)],check=True)
  (out/('trace-patches.json' if verbose else 'baseline-patches.json')).write_text(json.dumps(proof,indent=2))
 print('Pinned source and both reversible response variants syntax checked')
