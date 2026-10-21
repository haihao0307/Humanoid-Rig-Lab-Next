from pathlib import Path
import importlib.util, hashlib, json
R=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('rf36',R.parent/'hc-s3-6/instrument.py');previous=importlib.util.module_from_spec(spec);spec.loader.exec_module(previous)
sha=lambda b:hashlib.sha256(b).hexdigest()
def assemble(host,case):
 assert case in ['static','walk','walk-repeat']
 module=(R.parent/'hc-s3-6/fitting-transaction.mjs').read_bytes();assert sha(module)=='db7e42558409bd93e782e96d60d2c39fb20f3dfa215879289589f99b19763a96'
 response,prior=previous.assemble(host,'progressive',module)
 original=response['live-cloth-worker.mjs'].decode()
 anchor='  world.initial=world.solvers.map(s=>s.p.slice());world.initialTime=world.elapsed;world.acceleration.dispose?.();new ReducedCloth(world);world.initial=world.solvers.map(s=>s.p.slice());resetClock();pool=Array.from({length:3},(_,i)=>newSlot(i));send(d.id,{dense:true,initial:true});return;'
 assert original.count(anchor)==1
 replacement=r'''
 const __cp=new ContactProbe(world),__result={schema:'kaopu/contact-origin@1',case:__RF37_CASE,records:[],motionFailure:null,dt:1/60,plannedSteps:12,sourceCommit:__RF36_PIN,probeSurface:'original physics control triangles; not rendered yarn',epsilonM:EPS_M};
 __result.records.push(await __cp.capture('fit-committed',0));
 world.initial=world.solvers.map(s=>s.p.slice());world.initialTime=world.elapsed;world.acceleration.dispose?.();new ReducedCloth(world);world.initial=world.solvers.map(s=>s.p.slice());resetClock();
 __result.records.push(await __cp.capture('regional-created',0));
 world.setMotion(__RF37_CASE==='static'?'idle':'walk');
 __result.records.push(await __cp.capture('motion-selected',0));
 for(let i=1;i<=12;i++){try{await world.step(1/60);__result.records.push(await __cp.capture('fixed-step',i));}catch(e){__result.motionFailure={step:i,message:String(e.message||e)};break;}self.postMessage({rf37:true,kind:'progress',case:__RF37_CASE,step:i});}
 __result.completedSteps=__result.records.filter(r=>r.stage==='fixed-step').length;
 __result.originalGate=1.45;__result.dynamicFitCertified=false;__result.productionChanged=false;__result.automaticAppFramesBeforeMeasurement=0;
 self.postMessage({rf37:true,kind:'complete',result:__result});
 pool=Array.from({length:3},(_,i)=>newSlot(i));send(d.id,{dense:true,initial:true});return;
'''
 changed=original.replace(anchor,replacement);assert changed.replace(replacement,anchor)==original
 prefix="import {ContactProbe,EPS_M} from './rf37-contact-probe.mjs';\nconst __RF37_CASE="+json.dumps(case)+";\n"
 response['live-cloth-worker.mjs']=(prefix+changed).encode();response['rf37-contact-probe.mjs']=(R/'contact-probe.mjs').read_bytes()
 sources={n:sha((host/n).read_bytes()) for n in ['mesh-contact.mjs','native-motion.mjs','reduced-cloth.mjs','lower-body-contact.mjs']}
 return response,{'case':case,'prior':prior,'sourceContactFiles':sources,'transactionSHA256':sha(module),'probeSHA256':sha(response['rf37-contact-probe.mjs']),'workerSHA256':sha(response['live-cloth-worker.mjs']),'removableToS36':True,'sourceSolverChanged':False,'automaticMotionBeforeCapture':False}
