"""One-time R15 source registration; normal build never runs this migration."""
from pathlib import Path
import hashlib,json,shutil
P=Path(__file__).resolve().parent;BASE=P.parent/'r14';R=P.parent/'r15'
def sha(b):return hashlib.sha256(b).hexdigest()
assert sha((BASE/'public-lite.html').read_bytes())=='120a3772d4384ed375311df1a856e864836ba56e88a24345d0ed72e84f9cc049'
if R.exists():
 assert (R/'S2B_TASK_ANCHOR.json').exists(),'Refuse to overwrite an unrecognized candidate'
 print('Existing canonical R15 preserved');raise SystemExit(0)
shutil.copytree(BASE,R,ignore=shutil.ignore_patterns('qa','out','__pycache__','node-lib.cjs','public-lite.html','DELIVERY.json','BUILD_RESULT.json','NEXT_TASK_S2B.md'))
def edit(path,old,new):
 p=R/path;s=p.read_text();assert s.count(old)==1,(path,old[:80],s.count(old));p.write_text(s.replace(old,new))
edit('src/workers/product-entry.js','function stopPump()', '''// Bounded delivery only: every numerical step and the autonomous timer stay unchanged.
let poseAwaiting=0,poseSerial=0,posePending=false,posePublished=0,poseCoalesced=0;
function stopPump()''')
edit('src/workers/product-entry.js',"function emit(id=0,result=null,positions=false,solved=null){const report=solved||shell.report();report.workerSolveMS=solveMS;const out={id,result,report,speed,inputSequence};if(positions){out.positions=shell.x.slice();self.postMessage(out,[out.positions.buffer]);}else self.postMessage(out);}",'''function emit(id=0,result=null,positions=false,solved=null){
 // One autonomous snapshot in flight. The latest physical state remains in shell.x.
 if(positions&&id===0){posePending=true;if(poseAwaiting){poseCoalesced++;return;}}
 // Explicit command snapshots bypass coalescing and invalidate outstanding credits.
 if(positions&&id!==0){poseAwaiting=0;posePending=false;poseSerial++;}
 const report=solved||shell.report();report.workerSolveMS=solveMS;
 const out={id,result,report,speed,inputSequence};
 if(positions){
  if(id===0){posePending=false;poseAwaiting=++poseSerial;out.poseSerial=poseAwaiting;posePublished++;}
  out.positions=shell.x.slice();self.postMessage(out,[out.positions.buffer]);
 }else self.postMessage(out);
}''')
edit('src/workers/product-entry.js',"if(!shell)throw Error('Product physics is not initialized');",'''if(!shell)throw Error('Product physics is not initialized');
 if(op==='poseAck'){
  if(d.serial===poseAwaiting&&poseAwaiting!==0){poseAwaiting=0;if(posePending)emit(0,null,true);}
  return;
 }''')
edit('src/workers/client.js','this.lastMeasuredSequence=r.inputSequence;}}',"this.lastMeasuredSequence=r.inputSequence;}if(r.poseSerial)this.worker.postMessage({op:'poseAck',serial:r.poseSerial});}")
edit('src/app/runtime.js',"const VERSION='R14.0-S2A'","const VERSION='R15.0-S2B'")
for name in ['build.py','ui/template.html']:
 p=R/name;s=p.read_text().replace('R14.0-S2A','R15.0-S2B').replace('R14-S2A','R15-S2B').replace('candidate-r14.html','candidate-r15.html');p.write_text(s)
for name in ['qa-pose-stream.cjs','verify-s2b.py']:shutil.copy2(P/name,R/name)
s=(BASE/'qa-browser-s2.py').read_text().replace("'S2A'","'S2B'").replace('R14.0-S2A','R15.0-S2B').replace('candidate-r14.html','candidate-r15.html').replace("/'s2'/","/'s2b'/")
s=s.replace("'R10.0' if label=='reference'","'R14.0-S2A' if label=='reference'").replace("ROOT.parent/'r10/public-lite.html'","ROOT.parent/'r14/public-lite.html'")
(R/'qa-browser-s2b.py').write_text(s)
lock=json.loads((R/'canonical.lock.json').read_text())
for name,q in lock['files'].items():
 p=R/name;q.update(bytes=p.stat().st_size,sha256=sha(p.read_bytes()))
(R/'canonical.lock.json').write_text(json.dumps(lock,indent=2)+'\n')
anchor={'task':'LEATHER-S2B','baselineHead':'729df578f16efc30efff6870cd1d4157ac091117','baselineBuild':'37178e800a3272575b16e30a0723b3bcf1f29c0a','primaryDefect':'Unbounded autonomous pose payloads queue behind busy main-thread rendering','method':'One outstanding autonomous payload, acknowledgement after client receipt, immediately send latest completed state on renewed credit; never pace physical stepping by rendering','changedRuntimeFiles':['src/workers/client.js','src/workers/product-entry.js'],'identityOnly':['src/app/runtime.js','ui/template.html','build.py'],'protected':['native C/WASM','all simulation steps and time','collision candidates/CCD/friction/tolerances/iterations','appearance/wear/geometry/thickness','pointer input and renderer','R01-R14','main and other workbenches','licenses'],'gates':{'boundedAutoPayloadsDuringStall':1,'numericStepDifference':0,'trajectoryPositionDifferenceMM':0,'poseProtocolCases':45,'geometryCases':25,'numericCases':18,'browserPixelGate':'original .02 mean/.0005 fraction, not relaxed','commands':'reset/manualStep immediate; stale/duplicate acknowledgements harmless; disposed client ignores messages'},'timingPolicy':'ABBA instrumented browser samples are exploratory; no universal FPS or50ms guarantee. Uninstrumented release gates separate.','sourceReview':'No probe reassigns imported const updateSkin; failed probe38355136333 preserved','status':'REGISTERED_NOT_DELIVERED'}
(R/'S2B_TASK_ANCHOR.json').write_text(json.dumps(anchor,indent=2)+'\n')
(R/'README.md').write_text('''# R15 S2B — bounded completed-pose delivery

Start from the frozen R14 recorded in S2B_TASK_ANCHOR.json. The primary change is an explicit worker/client acknowledgement protocol, not a solver or appearance change. Only one autonomous snapshot may be in transit. Every physical step continues normally even when no new snapshot may be published; shell.x remains the latest computed state. After receiving a snapshot the client acknowledges its serial and the worker may publish the latest state, not a queue of historical poses.

Command replies (reset, explicit stepping, tests) are never coalesced. They invalidate prior autonomous credits. Duplicate/stale acknowledgements are ignored; a disposed product client applies no further pose. The stable app composition root and pointer cancellation stay unchanged. Native source and WASM remain R14 byte-identical.

Normal build: python leather-workshop/r15/build.py. Verification: python leather-workshop/r15/verify-s2b.py. One-time s2b-delivery/prepare.py is not called by the build and must not overwrite edited canonical sources. The accepted compiler and Python/Node requirements remain those recorded by R14.

Profile copies instrument only mutable app functions and worker envelopes. They are not shipped. CPU render submission is not GPU completion; message transfer and event-loop wait remain grouped. Existing software-rendering slowness may remain even when message traffic is bounded. Do not claim the full S2,50ms target, real-device performance, material calibration or legal clearance from this change.

- [x] Real runtime and physics; no generated images or substitutes.
- [x] Production worker/client source changed; original material and geometry retained.
- [ ] Standalone/public browser gates: authoritative only in fresh DELIVERY.json.
- [ ] User visual acceptance remains pending.
''')
print('Canonical R15 source registered; no old webpage changed')
