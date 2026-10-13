/** Coalesce synchronous camera/UI redraws and keep at most one main-canvas GPU
 * submission in flight. Same real mesh, material, resolution and shadows.
 * WebGL2 zero-timeout fence polling never blocks the UI with gl.finish().
 * Offscreen environment/utility passes retain the renderer's original behavior.
 */
export function installRenderGate(A,onDraw=()=>{}){
 if(A.renderGate)return A.renderGate;
 const renderer=A.renderer,gl=renderer.getContext(),raw=renderer.render.bind(renderer);
 let requested=0,submitted=0,completed=0,draws=0,coalesced=0,pending=false,raf=0,fence=null,fenceSerial=0,error=null,maxInFlight=0;
 const supported=typeof gl.fenceSync==='function'&&typeof gl.clientWaitSync==='function';
 const stats=()=>({requested,submitted,completed,draws,coalesced,pending,inFlight:fence?1:0,maxInFlight,gpuFence:supported,error:error?.message||null});
 const schedule=()=>{if(!raf)raf=requestAnimationFrame(tick);};
 function fail(e){error=e instanceof Error?e:new Error(String(e));if(fence){gl.deleteSync(fence);fence=null;}pending=false;console.error(error);}
 function tick(){
  raf=0;
  try{
   if(gl.isContextLost())throw Error('Shoe WebGL context lost; render is not complete');
   if(fence){const status=gl.clientWaitSync(fence,0,0);if(status===gl.TIMEOUT_EXPIRED){schedule();return;}if(status===gl.WAIT_FAILED)throw Error('Shoe GPU fence wait failed');gl.deleteSync(fence);fence=null;completed=fenceSerial;}
   if(!pending)return;
   pending=false;submitted=requested;raw(A.scene,A.camera);draws++;onDraw(renderer.info.render);
   if(supported){fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!fence)throw Error('Shoe GPU completion fence unavailable');fenceSerial=submitted;maxInFlight=Math.max(maxInFlight,1);gl.flush();schedule();}
   else completed=submitted;
  }catch(e){fail(e);}
 }
 renderer.render=function(scene,camera){
  if(scene!==A.scene||camera!==A.camera||renderer.getRenderTarget()!==null)return raw(scene,camera);
  requested++;if(pending)coalesced++;pending=true;schedule();
 };
 function idle(timeoutMs=30000){
  const deadline=performance.now()+timeoutMs;
  return new Promise((resolve,reject)=>{const check=()=>{
   if(error){reject(error);return;}
   if(!pending&&!fence&&completed>=requested){resolve(stats());return;}
   if(performance.now()>deadline){reject(Error('Shoe render completion exceeded '+timeoutMs+'ms: '+JSON.stringify(stats())));return;}
   schedule();setTimeout(check,16);
  };check();});
 }
 A.renderGate={stats,idle};return A.renderGate;
}
