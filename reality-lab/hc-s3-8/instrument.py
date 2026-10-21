from pathlib import Path
import importlib.util,hashlib,json
R=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('rf37',R.parent/'hc-s3-7/instrument.py');prior=importlib.util.module_from_spec(spec);spec.loader.exec_module(prior)
sha=lambda b:hashlib.sha256(b).hexdigest()
PINS={'reduced-cloth.mjs':'a851fdee4a269c05e6cd0d8efd3479d9985a557247659235b67d6646940cf4e2','lower-body-contact.mjs':'f60b9420e22a102a510db3b9634c6e29cebe5f1887bb3b9276b18ac8c12c6df6'}
def additive(text,pairs):
 out=text
 for needle,insert in pairs:
  assert out.count(needle)==1,('ANCHOR_COUNT',needle,out.count(needle))
  out=out.replace(needle,insert+needle)
 back=out
 for needle,insert in reversed(pairs):back=back.replace(insert+needle,needle)
 assert back==text
 return out

def assemble(host,case):
 assert case=='static'
 responses,parent=prior.assemble(host,case)
 worker=responses['live-cloth-worker.mjs'].decode()
 needle="world.setMotion(__RF37_CASE==='static'?'idle':'walk');"
 assert worker.count(needle)==1
 worker=worker.replace(needle,needle+'globalThis.__RF38__=new StageProbe(world);')
 end="self.postMessage({rf37:true,kind:'complete',result:__result});"
 assert worker.count(end)==1
 worker=worker.replace(end,"__result.phaseTrace=globalThis.__RF38__.report();"+end)
 responses['live-cloth-worker.mjs']=("import {StageProbe} from './rf38-stage-probe.mjs';\n"+worker).encode()
 patches={
 'reduced-cloth.mjs':[
  ('const oldPose=w.actor.pose,','globalThis.__RF38__?.begin();'),
  ('m.previousRef.set(m.ref);m.maxOffset=0;',"globalThis.__RF38__?.at('after-regional-dynamics',{role:m.role});"),
  ('this.lowerBodyContact.refit();this.lowerBodyContact.projectCoarse(dt);',"globalThis.__RF38__?.at('before-coarse-contact');"),
  ('const dynamicsEnd=performance.now();',"globalThis.__RF38__?.at('after-coarse-contact');"),
  ('this.lowerBodyContact.projectFine();',"globalThis.__RF38__?.at('after-fine-reconstruction');"),
  ('this.metrics.lowerBodyContact={...this.lowerBodyContact.metrics};',"globalThis.__RF38__?.at('after-fine-contact');"),
  ('w.simulationMs=performance.now()-t;',"globalThis.__RF38__?.at('step-complete');")],
 'lower-body-contact.mjs':[
  ('for(let n=0;n<this.triangles.length;n++){',"globalThis.__RF38__?.at('after-fine-vertices',{pass,margin});"),
  ('if(maximum<.00005)break;',"globalThis.__RF38__?.at('after-fine-triangles',{pass,margin,maximum});")]
 }
 for name,pairs in patches.items():
  raw=(host/name).read_bytes();assert sha(raw)==PINS[name]
  output=additive(raw.decode(),pairs);responses[name]=output.encode()
 responses['rf38-stage-probe.mjs']=(R/'stage-probe.mjs').read_bytes()
 return responses,{'case':case,'parent':parent,'sourceContactFiles':parent['sourceContactFiles'],'transactionSHA256':parent['transactionSHA256'],'phaseObserverSHA256':sha(responses['rf38-stage-probe.mjs']),'responses':{n:sha(b) for n,b in responses.items()},'reversiblePhaseInsertions':True,'sourceSolverArithmeticChanged':False,'productionChanged':False}
