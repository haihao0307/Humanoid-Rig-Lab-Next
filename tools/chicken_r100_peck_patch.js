// CHICKEN_R100_PECK_ADAPTER_PATCH
(function installChickenR100PeckAdapter(){
 import('./runtime/chicken_phase1_ring_coherent_adapter.mjs').then(adapterModule=>{
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
    if(runtime.skin.diagnostics?.().weightingRevision==='sector-gated-carrier-and-root-rigid-coat-v6')return;
    runtime.skin=adapterModule.createChickenPhase1RingCoherentAdapter(T,runtime.skin);
   };
   wrap();
   const originalInstall=runtime.installSkin.bind(runtime);
   runtime.installSkin=()=>{originalInstall();wrap();};
   window.__CHICKEN_R100_MESH_DEBUG__=Object.freeze({
    inventory(){
     return (runtime.skin?.meshes||[]).map((mesh,index)=>({
      index,
      kind:mesh.userData?.materialKind||'unknown',
      name:mesh.name||'',
      component:mesh.userData?.component||null,
      generatedBy:mesh.userData?.generatedBy||null,
      vertices:mesh.geometry?.attributes?.position?.count||0,
      triangles:mesh.geometry?.index?.count?mesh.geometry.index.count/3:0,
      visible:mesh.visible!==false
     }));
    },
    setVisible(indices){
     const visible=new Set(indices||[]),meshes=runtime.skin?.meshes||[];
     meshes.forEach((mesh,index)=>{mesh.visible=visible.has(index);});
     requestRender();
     return meshes.map((mesh,index)=>({index,visible:mesh.visible!==false}));
    },
    restore(){
     const meshes=runtime.skin?.meshes||[];
     meshes.forEach(mesh=>{mesh.visible=true;});
     requestRender();
     return meshes.length;
    }
   });
   window.__CHICKEN_R100_PECK_ADAPTER__=Object.freeze({
    version:'six-link-sector-gated-s-curve-v4',
    weightingRevision:'sector-gated-carrier-and-root-rigid-coat-v6',
    installed:true
   });
   clearInterval(timer);
  },25);
 }).catch(error=>console.error('Chicken R10.0 peck adapter failed',error));
})();
