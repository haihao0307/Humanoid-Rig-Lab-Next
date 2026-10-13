/* Full wall-window completion rate. Startup and stalled tails are not excluded.
 * JS-observed GPU fences are not compositor/display captures. No physics edits.
 */
(function(root){'use strict';
function create(clock=()=>performance.now()){
 const events=[],max=4096;let pending=null,last=null,serial=0,began=clock(),baseSteps=0,baseSim=0;
 const quantile=(a,q)=>a.length?a.slice().sort((a,b)=>a-b)[Math.floor((a.length-1)*q)]:null;
 const api={submit(frame,steps,simSeconds,cpuMs){pending={frame,steps,simSeconds,cpuMs,submittedAt:clock()};},complete(){if(!pending)return;const now=clock(),e={...pending,completedAt:now};pending=null;
  if(last&&e.simSeconds<last.simSeconds){events.length=0;last=null;began=now;baseSteps=e.steps;baseSim=e.simSeconds;}
  e.intervalMs=now-(last?last.completedAt:began);e.newPhysics=e.steps!==(last?last.steps:baseSteps);e.serial=++serial;events.push(e);if(events.length>max)events.shift();last=e;
 },reset(){baseSteps=last?.steps||0;baseSim=last?.simSeconds||0;events.length=0;last=null;pending=null;began=clock();},
 report(seconds=5){const now=clock(),start=Math.max(began,now-seconds*1000),a=events.filter(e=>e.completedAt>=start),elapsed=Math.max(0,(now-start)/1000),dt=a.map(e=>e.intervalMs),previous=events.findLast(e=>e.completedAt<start),simStart=previous?.simSeconds??baseSim,active=a.length>1?(a.at(-1).completedAt-a[0].completedAt)/1000:0;
 return {metric:'full-wall-window-observed-GPU-completed-frame',completedFrames:a.length,windowSeconds:elapsed,fps:elapsed?a.length/elapsed:0,newPhysicsFps:elapsed?a.filter(e=>e.newPhysics).length/elapsed:0,activeSpanFPS:active?(a.length-1)/active:0,frameP50Ms:quantile(dt,.5),frameP95Ms:quantile(dt,.95),frameP99Ms:quantile(dt,.99),cpuSubmitP95Ms:quantile(a.map(e=>e.cpuMs),.95),over20ms:dt.filter(v=>v>20).length,currentNoFrameMs:now-(last?.completedAt??began),simulationSpeed:elapsed&&a.length?Math.max(0,a.at(-1).simSeconds-simStart)/elapsed:0,rows:a.length,includesStartupAndStalledTail:true,physicalDisplayNotMeasured:true};},all(){return events.map(e=>({...e}));}};return api;}
root.KAOPUDenimFrameMetrics={create};if(typeof module!=='undefined')module.exports=root.KAOPUDenimFrameMetrics;
})(globalThis);
