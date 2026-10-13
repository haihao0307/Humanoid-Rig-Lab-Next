"""Source-locked measurement correction. Never changes solver or quality gates."""
from pathlib import Path
import hashlib
p=Path(__file__).resolve().parent
def sha(s):return hashlib.sha256(s.encode()).hexdigest()
m=p/"frame-metrics.js";s=m.read_text()
assert sha(s) in ['97ffecc55304ef20419dfddbfd0a065d880f6a444d42e063883cbfc4a5af428d', 'f1b592277b8e55ba8acf1b0f1c924f8a4c32509527e3bf1d44b0fafdde37c0eb']
m.write_text("/* Full wall-window completion rate. Startup and stalled tails are not excluded.\n * JS-observed GPU fences are not compositor/display captures. No physics edits.\n */\n(function(root){'use strict';\nfunction create(clock=()=>performance.now()){\n const events=[],max=4096;let pending=null,last=null,serial=0,began=clock(),baseSteps=0,baseSim=0;\n const quantile=(a,q)=>a.length?a.slice().sort((a,b)=>a-b)[Math.floor((a.length-1)*q)]:null;\n const api={submit(frame,steps,simSeconds,cpuMs){pending={frame,steps,simSeconds,cpuMs,submittedAt:clock()};},complete(){if(!pending)return;const now=clock(),e={...pending,completedAt:now};pending=null;\n  if(last&&e.simSeconds<last.simSeconds){events.length=0;last=null;began=now;baseSteps=e.steps;baseSim=e.simSeconds;}\n  e.intervalMs=now-(last?last.completedAt:began);e.newPhysics=e.steps!==(last?last.steps:baseSteps);e.serial=++serial;events.push(e);if(events.length>max)events.shift();last=e;\n },reset(){baseSteps=last?.steps||0;baseSim=last?.simSeconds||0;events.length=0;last=null;pending=null;began=clock();},\n report(seconds=5){const now=clock(),start=Math.max(began,now-seconds*1000),a=events.filter(e=>e.completedAt>=start),elapsed=Math.max(0,(now-start)/1000),dt=a.map(e=>e.intervalMs),previous=events.findLast(e=>e.completedAt<start),simStart=previous?.simSeconds??baseSim,active=a.length>1?(a.at(-1).completedAt-a[0].completedAt)/1000:0;\n return {metric:'full-wall-window-observed-GPU-completed-frame',completedFrames:a.length,windowSeconds:elapsed,fps:elapsed?a.length/elapsed:0,newPhysicsFps:elapsed?a.filter(e=>e.newPhysics).length/elapsed:0,activeSpanFPS:active?(a.length-1)/active:0,frameP50Ms:quantile(dt,.5),frameP95Ms:quantile(dt,.95),frameP99Ms:quantile(dt,.99),cpuSubmitP95Ms:quantile(a.map(e=>e.cpuMs),.95),over20ms:dt.filter(v=>v>20).length,currentNoFrameMs:now-(last?.completedAt??began),simulationSpeed:elapsed&&a.length?Math.max(0,a.at(-1).simSeconds-simStart)/elapsed:0,rows:a.length,includesStartupAndStalledTail:true,physicalDisplayNotMeasured:true};},all(){return events.map(e=>({...e}));}};return api;}\nroot.KAOPUDenimFrameMetrics={create};if(typeof module!=='undefined')module.exports=root.KAOPUDenimFrameMetrics;\n})(globalThis);\n")
f=p/"app.js";s=f.read_text()
if sha(s)=='624ff1f1c4857a1003fd5a020acc12ceacc44aab98767bd494123261c997e682':
    assert s.count("$('r15-benchmark').onclick=startPerformanceTest;")==1
    s=s.replace("$('r15-benchmark').onclick=startPerformanceTest;","for(const id of ['r13-restart','physicsReset']){const before=$(id).onclick;$(id).onclick=e=>{if(perfRun)stopPerformanceTest();before?.(e);};}\n$('r15-benchmark').onclick=startPerformanceTest;")
assert sha(s)=='e95f53de8b33ab8d4dd4e4e7f0b0443cfe51a398fe8ba0946329255feae6ae49'
f.write_text(s)
f=p/"qa-performance.py";s=f.read_text()
if sha(s)=='a76e258e21030541baf70156cc362d4b3f243f72da5078f9a3c11c8888c88b1a':
    s=s.replace('let live=true,lastFrame=-1;const start=performance.now();','let live=true,lastFrame=A.lastFrame.frame;const initialSim=A.lastFrame.physics.simulationSeconds??A.lastFrame.physics.steps/240;const start=performance.now();')
    s=s.replace('observedDistinctFPS:span?(rows.length-1)/span:0,','observedDistinctFPS:rows.length/((performance.now()-start)/1000),activeSpanFPS:span?(rows.length-1)/span:0,')
    s=s.replace('physicsSpeed:span?(rows.at(-1).simulationSeconds-rows[0].simulationSeconds)/span:0,','physicsSpeed:rows.length?(rows.at(-1).simulationSeconds-initialSim)/((performance.now()-start)/1000):0,')
if sha(s)=='e9de360ff0185f4ef1a86363ebc5908555857828084367382cab71eacbb93ac2':
    s=s.replace("p.locator('#r15-benchmark').click();p.wait_for_timeout(2000);p.locator('#r15-benchmark').click();idle(p);r['benchmarkButtonWorks']=True", 'p.locator(\'#r15-benchmark\').click();p.wait_for_timeout(2000);p.locator(\'#r15-benchmark\').click();idle(p);r[\'benchmarkButtonWorks\']=True\n  p.locator(\'#r15-benchmark\').click();p.wait_for_function(\'document.querySelector("#r15-result").textContent.startsWith("已完成：")\',timeout=90000);idle(p);r[\'automaticThirtySecondBenchmark\']=True')
    s=s.replace("r['performanceExport']=True", "assert pr['benchmark']['completedFullDuration'] and pr['benchmark']['statistics']['includesStartupAndStalledTail'];r['performanceExport']=True;r['userBenchmarkReport']=pr")
assert sha(s)=='3af853d0ae10fd1c197520a380ae39cca8cb7afc5357062f4a8223b93698f0e2'
f.write_text(s)
print("Full wall-window metrics verified; simulation untouched.")
