/** GPU submission backpressure. Same geometry, shadows and material resolution.
 * Uses WebGL2 zero-timeout sync polling, never gl.finish or a busy wait.
 */
export function installRenderBackpressure(viewer){
 const draw=viewer.render.bind(viewer),gl=viewer.renderer.getContext();
 let pending=false,inFlight=false,sync=null,raf=0,timer=0,disposed=false,requested=0,submitted=0;
 let waiters=[];
 const stats={submitted:0,completed:0,coalesced:0,maxInFlight:0,pollCount:0,lastCompletionMS:0,failed:false};
 const settle=(upto,value)=>{const rest=[];for(const w of waiters){if(w.id<=upto)w.resolve(value);else rest.push(w);}waiters=rest;};
 function schedule(){if(!disposed&&!inFlight&&!raf&&pending)raf=requestAnimationFrame(run);}
 function clearSync(){if(sync){gl.deleteSync(sync);sync=null;}}
 function finish(ok,start){clearSync();inFlight=false;stats.lastCompletionMS=performance.now()-start;if(ok)stats.completed++;else stats.failed=true;settle(submitted,ok);schedule();}
 function poll(start){
  timer=0;if(disposed)return;
  if(gl.isContextLost()){finish(false,start);return;}
  const state=gl.clientWaitSync(sync,0,0);stats.pollCount++;
  if(state===gl.TIMEOUT_EXPIRED){timer=setTimeout(()=>poll(start),8);return;}
  finish(state!==gl.WAIT_FAILED,start);
 }
 function run(){
  raf=0;if(disposed||inFlight||!pending)return;
  pending=false;submitted=requested;
  if(!viewer.active||viewer.lost||gl.isContextLost()){settle(submitted,false);return;}
  const start=performance.now();inFlight=true;stats.maxInFlight=Math.max(stats.maxInFlight,1);
  try{draw();stats.submitted++;sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)throw Error('GPU frame sync unavailable');gl.flush();timer=setTimeout(()=>poll(start),0);}
  catch(error){stats.error=String(error);finish(false,start);viewer.onStatus?.('画面提交失败，已保留人物与配方');}
 }
 viewer.render=()=>{
  if(disposed)return Promise.resolve(false);
  const id=++requested;if(pending||inFlight)stats.coalesced++;
  pending=true;const result=new Promise(resolve=>waiters.push({id,resolve}));schedule();return result;
 };
 const idle=()=>{if(disposed||(!pending&&!inFlight))return Promise.resolve(!stats.failed);return new Promise(resolve=>waiters.push({id:requested,resolve}));};
 const stop=()=>{disposed=true;if(raf)cancelAnimationFrame(raf);if(timer)clearTimeout(timer);clearSync();inFlight=false;pending=false;settle(Infinity,false);};
 viewer.canvas.addEventListener('webglcontextlost',()=>{if(timer)clearTimeout(timer);if(raf)cancelAnimationFrame(raf);timer=raf=0;sync=null;inFlight=pending=false;settle(Infinity,false);});
 const priorDispose=viewer.dispose.bind(viewer);viewer.dispose=()=>{stop();priorDispose();};
 viewer.frameGate={idle,audit:()=>({...stats,inFlight:inFlight?1:0,pending:pending?1:0,queuedSnapshots:pending?1:0,unloweredQuality:true}),dispose:stop};
 return viewer.frameGate;
}
