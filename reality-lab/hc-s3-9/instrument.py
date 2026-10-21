from pathlib import Path
import importlib.util,hashlib,json
R=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('rf36_endurance',R.parent/'hc-s3-6/instrument.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
sha=lambda b:hashlib.sha256(b).hexdigest()
def assemble(host,variant,motion):
 assert variant in ['baseline','coverage'] and motion in ['static','walk']
 transaction=(R.parent/'hc-s3-6/fitting-transaction.mjs').read_bytes();assert sha(transaction)=='db7e42558409bd93e782e96d60d2c39fb20f3dfa215879289589f99b19763a96'
 response,meta=base.assemble(host,'progressive',transaction)
 original=response['live-cloth-worker.mjs'].decode()
 anchor='  world.initial=world.solvers.map(s=>s.p.slice());world.initialTime=world.elapsed;world.acceleration.dispose?.();new ReducedCloth(world);world.initial=world.solvers.map(s=>s.p.slice());resetClock();pool=Array.from({length:3},(_,i)=>newSlot(i));send(d.id,{dense:true,initial:true});return;'
 assert original.count(anchor)==1
 replacement='''
 const __study=await runEndurance(world,()=>{world.initial=world.solvers.map(s=>s.p.slice());world.initialTime=world.elapsed;world.acceleration.dispose?.();new ReducedCloth(world);world.initial=world.solvers.map(s=>s.p.slice());resetClock();},__RF39_CONFIG);
 self.postMessage({rf39:true,kind:'complete',result:__study});
 pool=Array.from({length:3},(_,i)=>newSlot(i));send(d.id,{dense:true,initial:true});return;
'''
 changed=original.replace(anchor,replacement);assert changed.replace(replacement,anchor)==original
 prefix="import {runEndurance} from './rf39-endurance.mjs';\nconst __RF39_CONFIG="+json.dumps({'variant':variant,'motion':motion})+';\n'
 response['live-cloth-worker.mjs']=(prefix+changed).encode();response['rf39-endurance.mjs']=(R/'endurance.mjs').read_bytes()
 probe=(R.parent/'hc-s3-7/contact-probe.mjs').read_bytes();assert sha(probe)=='55349ab8a0d09cad19ae6e9155794e83223ce72077326c7102392a49b24de2ec';response['rf37-contact-probe.mjs']=probe
 lower=(host/'lower-body-contact.mjs').read_bytes();assert sha(lower)=='f60b9420e22a102a510db3b9634c6e29cebe5f1887bb3b9276b18ac8c12c6df6'
 if variant=='coverage':
  needle='  this.vertices=Int32Array.from(vertices);'
  addition='  /*RF38 coverage candidate: retain original order, then include omitted physical nodes/faces.*/\n  const __rf38faces=new Set(triangles);for(let i=0;i<solver.count;i++)vertices.add(i);for(let f=0;f<F.length;f+=3)if(!__rf38faces.has(f))triangles.push(f);\n'
  text=lower.decode();assert text.count(needle)==1;modified=text.replace(needle,addition+needle);assert modified.replace(addition,'').encode()==lower
  lower=modified.encode();assert sha(lower)=='b0ac0923ff63895d14ae1f5c60f0354c521e598f8e146416a69f95f9ccd5675a'
  response['lower-body-contact.mjs']=lower
 return response,{'variant':variant,'motion':motion,'priorFitting':meta,'transactionSHA256':sha(transaction),'probeSHA256':sha(probe),'enduranceSHA256':sha(response['rf39-endurance.mjs']),'lowerBodySHA256':sha(lower),'sourceFiles':{n:sha((host/n).read_bytes()) for n in ['native-motion.mjs','reduced-cloth.mjs','lower-body-contact.mjs','mesh-contact.mjs']},'productionChanged':False,'coverageAlgorithmChangedSinceS38':False,'fittingThresholdChanged':False,'motionBeforeCapture':False}
