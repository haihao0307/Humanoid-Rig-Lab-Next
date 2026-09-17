// CHICKEN_R100_CENTERLINE_SWEEP_PATCH
(function installChickenR100CenterlineSweep(){
 import('./runtime/chicken_phase1_centerline_sweep_v71_adapter.mjs').then(adapterModule=>{
  let attempts=0;
  const timer=setInterval(()=>{
   attempts++;
   const runtime=__phase1Runtime;
   const current=runtime?.skin;
   const diagnostic=current?.diagnostics?.()||null;
   if(!runtime?.installSkin||!current||!diagnostic?.peckKinematicsRevision){
    if(attempts>1600)clearInterval(timer);
    return;
   }
   const wrap=()=>{
    if(!runtime.skin)return;
    const state=runtime.skin.diagnostics?.()||{};
    if(state.centerlineCurveRevision)return;
    runtime.skin=adapterModule.createChickenPhase1CenterlineSweepAdapter(T,runtime.skin);
   };
   wrap();
   const previousInstall=runtime.installSkin.bind(runtime);
   runtime.installSkin=()=>{previousInstall();wrap();};
   window.__CHICKEN_R100_CENTERLINE_SWEEP__=Object.freeze({
    version:'anatomical-neck-root-preserving-centerline-sweep-v7.1',
    curve:'rotation-minimizing-frame-centerline-v2',
    installed:true,
    groupTestAuthorized:false
   });
   clearInterval(timer);
  },25);
 }).catch(error=>console.error('Chicken R10.0 centerline sweep adapter failed',error));
})();
