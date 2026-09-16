// CHICKEN_R100_PECK_ADAPTER_PATCH
(function installChickenR100PeckAdapter(){
 import('./runtime/chicken_phase1_peck_adapter.mjs').then(adapterModule=>{
  let attempts=0;
  const timer=setInterval(()=>{
   attempts++;
   const runtime=__phase1Runtime;
   if(!runtime?.skin||!runtime?.installSkin){
    if(attempts>1200)clearInterval(timer);
    return;
   }
   const wrap=()=>{
    if(!runtime.skin)return;
    if(runtime.skin.diagnostics?.().peckKinematicsRevision)return;
    runtime.skin=adapterModule.createChickenPhase1PeckAdapter(T,runtime.skin);
   };
   wrap();
   const originalInstall=runtime.installSkin.bind(runtime);
   runtime.installSkin=()=>{originalInstall();wrap();};
   window.__CHICKEN_R100_PECK_ADAPTER__=Object.freeze({
    version:'fixed-length-forward-down-s-curve-v1',
    installed:true
   });
   clearInterval(timer);
  },25);
 }).catch(error=>console.error('Chicken R10.0 peck adapter failed',error));
})();
