// CHICKEN_R100_CENTERLINE_SWEEP_PATCH
(function installChickenR100SegmentedNeck(){
 import('./runtime/chicken_phase1_segmented_neck_adapter.mjs').then(adapterModule=>{
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
    if(state.weightingRevision==='segmented-rigid-head-and-buried-root-neck-v8-2')return;
    runtime.skin=adapterModule.createChickenPhase1SegmentedNeckAdapter(T,runtime.skin);
   };
   wrap();
   const previousInstall=runtime.installSkin.bind(runtime);
   runtime.installSkin=()=>{previousInstall();wrap();};
   window.__CHICKEN_R100_CENTERLINE_SWEEP__=Object.freeze({
    version:'segmented-rigid-head-and-buried-root-neck-v8-2',
    topology:'torso-buried-neck-rigid-head-v8-2',
    curve:'bone-centerline-parallel-transport-with-buried-root-v4',
    installed:true,
    groupTestAuthorized:false
   });
   clearInterval(timer);
  },25);
 }).catch(error=>console.error('Chicken R10.0 buried-root segmented neck adapter failed',error));
})();
