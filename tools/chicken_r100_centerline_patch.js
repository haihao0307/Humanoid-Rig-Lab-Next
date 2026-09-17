// CHICKEN_R100_CENTERLINE_SWEEP_PATCH
(function installChickenR100CenterlineSweep(){
 import('./runtime/chicken_phase1_centerline_sweep_v71_adapter.mjs').then(adapterModule=>{
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const sat=v=>clamp(v,0,1);
  const ss=(a,b,v)=>{const t=sat((v-a)/(b-a||1));return t*t*(3-2*t);};
  const quantile=(sorted,q)=>{
   if(!sorted.length)return 1;
   const index=(sorted.length-1)*q,lo=Math.floor(index),hi=Math.ceil(index);
   return lo===hi?sorted[lo]:sorted[lo]+(sorted[hi]-sorted[lo])*(index-lo);
  };
  const area3=(attribute,start,count)=>{
   let ax=0,ay=0,az=0;
   for(let i=0;i<count;i++){
    const a=start+i,b=start+((i+1)%count);
    const x0=attribute.getX(a),y0=attribute.getY(a),z0=attribute.getZ(a);
    const x1=attribute.getX(b),y1=attribute.getY(b),z1=attribute.getZ(b);
    ax+=y0*z1-z0*y1;ay+=z0*x1-x0*z1;az+=x0*y1-y0*x1;
   }
   return .5*Math.hypot(ax,ay,az);
  };
  function createVisibleShellAdapter(baseSkin){
   // The V7.1 wrapper needs the legacy shell to start before the first fixed
   // cervical station. We keep that hidden construction domain, then render
   // only the anatomical upper-neck/head rings from x >= 0.255.
   const wrapped=adapterModule.createChickenPhase1CenterlineSweepAdapter(T,baseSkin,{
    shell:{startX:.075}
   });
   const {bones,skeleton,neckMesh,shell}=wrapped;
   const geometry=neckMesh.geometry;
   const position=geometry.getAttribute('position');
   const firstRing=shell.stationXs.findIndex(value=>value>=.255);
   if(firstRing<0){wrapped.detach();throw new Error('V7.1 visible neck shell start was not found');}
   const ringSize=shell.ringSize;
   const ringCount=shell.ringCount-firstRing;
   if(ringCount<2){wrapped.detach();throw new Error('V7.1 visible neck shell needs at least two rings');}
   const indices=new Uint32Array((ringCount-1)*ringSize*6);
   let cursor=0;
   for(let ring=firstRing;ring<shell.ringCount-1;ring++){
    for(let sample=0;sample<ringSize;sample++){
     const next=(sample+1)%ringSize;
     const a=ring*ringSize+sample,b=ring*ringSize+next;
     const c=(ring+1)*ringSize+sample,d=(ring+1)*ringSize+next;
     indices[cursor++]=a;indices[cursor++]=c;indices[cursor++]=b;
     indices[cursor++]=b;indices[cursor++]=c;indices[cursor++]=d;
    }
   }
   geometry.setIndex(new T.Uint32BufferAttribute(indices,1));
   neckMesh.name='ChickenPhase1AnatomicalNeckRootPreservingShellV71';
   neckMesh.userData={...(neckMesh.userData||{}),component:'anatomical_neck_root_preserving_shell_v7_1',topologyRevision:'torso-preserving-neck-root-split-v7.1'};

   const parent=neckMesh.parent;
   parent.updateMatrixWorld(true);
   const bindParentInverse=parent.matrixWorld.clone().invert();
   const bindChestMatrix=bindParentInverse.clone().multiply(bones.chest.matrixWorld);
   const bindChestInverse=bindChestMatrix.clone().invert();
   const bindPositions=new Float32Array(position.array);
   const visibleVertexStart=firstRing*ringSize;
   const visibleVertexCount=ringCount*ringSize;
   const chestLocal=new Float32Array(visibleVertexCount*3);
   const temp=new T.Vector3();
   for(let i=0;i<visibleVertexCount;i++){
    const source=visibleVertexStart+i,q=source*3;
    temp.set(bindPositions[q],bindPositions[q+1],bindPositions[q+2]).applyMatrix4(bindChestInverse);
    chestLocal[i*3]=temp.x;chestLocal[i*3+1]=temp.y;chestLocal[i*3+2]=temp.z;
   }
   const bindAreas=new Float64Array(ringCount);
   const bindLongitudinal=new Float64Array((ringCount-1)*ringSize);
   for(let ring=0;ring<ringCount;ring++)bindAreas[ring]=area3(position,(firstRing+ring)*ringSize,ringSize);
   for(let ring=1;ring<ringCount;ring++)for(let sample=0;sample<ringSize;sample++){
    const a=(firstRing+ring-1)*ringSize+sample,b=(firstRing+ring)*ringSize+sample;
    bindLongitudinal[(ring-1)*ringSize+sample]=Math.hypot(position.getX(b)-position.getX(a),position.getY(b)-position.getY(a),position.getZ(b)-position.getZ(a));
   }
   const transitionRings=Math.min(6,ringCount);
   let lastFrameAudit=null;
   const updateVisibleRootAndAudit=()=>{
    parent.updateMatrixWorld(true);
    const parentInverse=parent.matrixWorld.clone().invert();
    const currentChest=parentInverse.multiply(bones.chest.matrixWorld);
    for(let ring=0;ring<transitionRings;ring++){
     const sweepWeight=ss(0,1,transitionRings<=1?1:ring/(transitionRings-1));
     for(let sample=0;sample<ringSize;sample++){
      const local=ring*ringSize+sample,vertex=visibleVertexStart+local;
      temp.set(chestLocal[local*3],chestLocal[local*3+1],chestLocal[local*3+2]).applyMatrix4(currentChest);
      position.setXYZ(vertex,
       temp.x+(position.getX(vertex)-temp.x)*sweepWeight,
       temp.y+(position.getY(vertex)-temp.y)*sweepWeight,
       temp.z+(position.getZ(vertex)-temp.z)*sweepWeight
      );
     }
    }
    let areaMin=Infinity,areaMax=0;
    for(let ring=0;ring<ringCount;ring++){
     const ratio=area3(position,(firstRing+ring)*ringSize,ringSize)/(bindAreas[ring]||1);
     areaMin=Math.min(areaMin,ratio);areaMax=Math.max(areaMax,ratio);
    }
    const longitudinal=[];
    for(let ring=1;ring<ringCount;ring++)for(let sample=0;sample<ringSize;sample++){
     const a=(firstRing+ring-1)*ringSize+sample,b=(firstRing+ring)*ringSize+sample;
     const current=Math.hypot(position.getX(b)-position.getX(a),position.getY(b)-position.getY(a),position.getZ(b)-position.getZ(a));
     longitudinal.push(current/(bindLongitudinal[(ring-1)*ringSize+sample]||1));
    }
    longitudinal.sort((a,b)=>a-b);
    position.needsUpdate=true;geometry.computeVertexNormals();geometry.getAttribute('normal').needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const base=wrapped.diagnostics().lastFrameAudit||{};
    lastFrameAudit=Object.freeze({...base,ringCount,ringSize,ringAreaRatioMin:areaMin,ringAreaRatioMax:areaMax,longitudinalRatioMedian:quantile(longitudinal,.5),longitudinalRatioP95:quantile(longitudinal,.95),longitudinalRatioMax:longitudinal.at(-1)??1,seamSweepStartFraction:0,seamSweepEndFraction:transitionRings/ringCount});
   };
   const applyPose=pose=>{const result=wrapped.applyPose(pose);updateVisibleRootAndAudit();skeleton.update();return{...result,centerlineFrameAudit:lastFrameAudit};};
   const diagnostics=()=>{
    const base=wrapped.diagnostics();
    return{...base,topologyRevision:'torso-preserving-neck-root-split-v7.1',centerlineCurveRevision:'rotation-minimizing-frame-centerline-v2',weightingRevision:'anatomical-neck-root-preserving-centerline-sweep-v7.1',neckShell:{ringCount,ringSize,vertexCount:ringCount*ringSize,triangleCount:(ringCount-1)*ringSize*2,xRange:[shell.stationXs[firstRing],shell.stationXs.at(-1)],centerlineDomain:[.075,shell.stationXs.at(-1)]},lastFrameAudit};
   };
   return Object.freeze({bones,skeleton,meshes:wrapped.meshes,applyPose,verifyInvariants:wrapped.verifyInvariants,detach:wrapped.detach,diagnostics,rootOrigin:wrapped.rootOrigin,neckMesh,shell});
  }
  let attempts=0;
  const timer=setInterval(()=>{
   attempts++;
   const runtime=__phase1Runtime;
   const current=runtime?.skin;
   const diagnostic=current?.diagnostics?.()||null;
   if(!runtime?.installSkin||!current||!diagnostic?.peckKinematicsRevision){if(attempts>1600)clearInterval(timer);return;}
   const wrap=()=>{
    if(!runtime.skin)return;
    const state=runtime.skin.diagnostics?.()||{};
    if(state.centerlineCurveRevision)return;
    runtime.skin=createVisibleShellAdapter(runtime.skin);
   };
   wrap();
   const previousInstall=runtime.installSkin.bind(runtime);
   runtime.installSkin=()=>{previousInstall();wrap();};
   window.__CHICKEN_R100_CENTERLINE_SWEEP__=Object.freeze({version:'anatomical-neck-root-preserving-centerline-sweep-v7.1',curve:'rotation-minimizing-frame-centerline-v2',installed:true,groupTestAuthorized:false});
   clearInterval(timer);
  },25);
 }).catch(error=>console.error('Chicken R10.0 centerline sweep adapter failed',error));
})();
