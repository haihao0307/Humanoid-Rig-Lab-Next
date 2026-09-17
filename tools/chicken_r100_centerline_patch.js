// CHICKEN_R100_CENTERLINE_SWEEP_PATCH
(function installChickenR100CenterlineSweep(){
 import('./runtime/chicken_phase1_centerline_sweep_v71_adapter.mjs').then(adapterModule=>{
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const sat=v=>clamp(v,0,1);
  const ss=(a,b,v)=>{const t=sat((v-a)/(b-a||1));return t*t*(3-2*t);};
  const NECK_BONES=['neck_base','neck_c0','neck_c1','neck_c2','neck_c3','head_base','head'];
  const NECK_X=[.120,.180,.240,.300,.350,.382,.420];
  const CURVE_MIN=.075,CURVE_MAX=.445,VISIBLE_START=.255;
  const quantile=(sorted,q)=>{if(!sorted.length)return 1;const k=(sorted.length-1)*q,a=Math.floor(k),b=Math.ceil(k);return a===b?sorted[a]:sorted[a]+(sorted[b]-sorted[a])*(k-a);};
  const extrapolate=(a,b,s)=>[a[0]+(a[0]-b[0])*s,a[1]+(a[1]-b[1])*s,a[2]+(a[2]-b[2])*s];
  const controls=points=>{
   const s=(NECK_X[0]-CURVE_MIN)/(NECK_X[1]-NECK_X[0]);
   const e=(CURVE_MAX-NECK_X.at(-1))/(NECK_X.at(-1)-NECK_X.at(-2));
   return{xs:[CURVE_MIN,...NECK_X,CURVE_MAX],points:[extrapolate(points[0],points[1],s),...points.map(p=>[...p]),extrapolate(points.at(-1),points.at(-2),e)]};
  };
  const sampleQ=(x,qs)=>{
   if(x<=NECK_X[0])return qs[0].clone();
   if(x>=NECK_X.at(-1))return qs.at(-1).clone();
   for(let i=0;i<NECK_X.length-1;i++)if(x<=NECK_X[i+1])return qs[i].clone().slerp(qs[i+1],ss(NECK_X[i],NECK_X[i+1],x)).normalize();
   return qs.at(-1).clone();
  };
  const localPoint=(bone,parentInverse)=>new T.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(parentInverse);
  const localQ=(bone,parentQInverse)=>{const q=new T.Quaternion();bone.getWorldQuaternion(q);return parentQInverse.clone().multiply(q).normalize();};
  const frameToLocal=(f,v)=>[v.dot(f.tangent),v.dot(f.normal),v.dot(f.lateral)];
  const frameFromLocal=(f,v)=>new T.Vector3().addScaledVector(f.tangent,v[0]).addScaledVector(f.normal,v[1]).addScaledVector(f.lateral,v[2]);
  const makeFrame=(curve,x,orientation,previous=null)=>{
   const tangent=new T.Vector3(...curve.derivative(x)).normalize();
   const anatomical=new T.Vector3(0,0,1).applyQuaternion(orientation).addScaledVector(tangent,-new T.Vector3(0,0,1).applyQuaternion(orientation).dot(tangent));
   let lateral;
   if(previous){
    lateral=previous.lateral.clone().addScaledVector(tangent,-previous.lateral.dot(tangent));
    if(lateral.lengthSq()<1e-10)lateral.copy(previous.normal).cross(tangent);
    lateral.normalize();
    if(anatomical.lengthSq()>1e-10){anatomical.normalize();if(anatomical.dot(lateral)<0)anatomical.negate();lateral.lerp(anatomical,.10).normalize();}
   }else{
    lateral=anatomical.lengthSq()>1e-10?anatomical.normalize():new T.Vector3(0,0,1).addScaledVector(tangent,-tangent.z).normalize();
   }
   const normal=new T.Vector3().crossVectors(lateral,tangent).normalize();
   lateral=new T.Vector3().crossVectors(tangent,normal).normalize();
   if(previous&&lateral.dot(previous.lateral)<0){lateral.negate();normal.negate();}
   return{tangent,normal,lateral};
  };
  const area3=(attr,start,count)=>{
   let x=0,y=0,z=0;
   for(let i=0;i<count;i++){
    const a=start+i,b=start+(i+1)%count,ax=attr.getX(a),ay=attr.getY(a),az=attr.getZ(a),bx=attr.getX(b),by=attr.getY(b),bz=attr.getZ(b);
    x+=ay*bz-az*by;y+=az*bx-ax*bz;z+=ax*by-ay*bx;
   }
   return .5*Math.hypot(x,y,z);
  };
  const targetRadius=(x,raw)=>{
   if(x>=.424)return raw;
   const t=ss(VISIBLE_START,.424,x);
   return Math.min(raw,.105+(.073-.105)*t);
  };
  function createVisibleShellAdapter(baseSkin){
   const wrapped=adapterModule.createChickenPhase1CenterlineSweepAdapter(T,baseSkin,{shell:{startX:CURVE_MIN}});
   const {bones,skeleton,neckMesh,shell}=wrapped;
   const parent=neckMesh?.parent,geometry=neckMesh?.geometry,position=geometry?.getAttribute('position');
   if(!parent||!position)throw new Error('V7.2 requires the centerline shell mesh');
   for(const id of NECK_BONES)if(!bones[id])throw new Error(`V7.2 missing ${id}`);
   const firstRing=shell.stationXs.findIndex(x=>x>=VISIBLE_START);
   const ringSize=shell.ringSize,ringCount=shell.ringCount-firstRing;
   if(firstRing<0||ringCount<8)throw new Error('V7.2 visible neck shell is incomplete');
   const index=new Uint32Array((ringCount-1)*ringSize*6);let io=0;
   for(let r=firstRing;r<shell.ringCount-1;r++)for(let s=0;s<ringSize;s++){
    const n=(s+1)%ringSize,a=r*ringSize+s,b=r*ringSize+n,c=(r+1)*ringSize+s,d=(r+1)*ringSize+n;
    index[io++]=a;index[io++]=c;index[io++]=b;index[io++]=b;index[io++]=c;index[io++]=d;
   }
   geometry.setIndex(new T.Uint32BufferAttribute(index,1));
   neckMesh.name='ChickenPhase1MappedCervicalShellV72';
   neckMesh.userData={...(neckMesh.userData||{}),component:'anatomical_neck_root_preserving_shell_v7_1',topologyRevision:'torso-preserving-neck-root-split-v7.1'};
   const readState=()=>{
    parent.updateMatrixWorld(true);
    const inv=parent.matrixWorld.clone().invert(),pq=new T.Quaternion();parent.getWorldQuaternion(pq);const qi=pq.invert();
    return{points:NECK_BONES.map(id=>localPoint(bones[id],inv).toArray()),quaternions:NECK_BONES.map(id=>localQ(bones[id],qi))};
   };
   const bindState=readState(),bc=controls(bindState.points),bindCurve=adapterModule.createChickenPhase1Pchip(bc.xs,bc.points),bindArc=adapterModule.createChickenPhase1ArcLengthMap(bindCurve,CURVE_MIN,CURVE_MAX,384);
   const sourceMax=shell.stationXs.at(-1),cache=[],bindTarget=new Float32Array(ringCount*ringSize*3);
   let previous=null;
   for(let vr=0;vr<ringCount;vr++){
    const sr=firstRing+vr,sourceX=shell.stationXs[sr],t=sat((sourceX-VISIBLE_START)/(sourceMax-VISIBLE_START||1)),mappedX=.120+(CURVE_MAX-.120)*t;
    const orientation=sampleQ(mappedX,bindState.quaternions),frame=makeFrame(bindCurve,mappedX,orientation,previous);previous=frame;
    const curvePoint=new T.Vector3(...bindCurve.evaluate(mappedX)),sourceCenter=new T.Vector3(...shell.ringCenters[sr]);
    const rawCenter=frameToLocal(frame,sourceCenter.clone().sub(curvePoint)),centerLocal=[0,rawCenter[1],rawCenter[2]],locals=[];
    let rawRadius=0;
    for(let s=0;s<ringSize;s++){
     const q=(sr*ringSize+s)*3,p=new T.Vector3(shell.positions[q],shell.positions[q+1],shell.positions[q+2]),local=frameToLocal(frame,p.sub(sourceCenter));
     local[0]=0;rawRadius+=Math.hypot(local[1],local[2]);locals.push(local);
    }
    rawRadius/=ringSize;const scale=rawRadius>1e-9?targetRadius(sourceX,rawRadius)/rawRadius:1;
    for(const local of locals){local[1]*=scale;local[2]*=scale;}
    const center=curvePoint.clone().add(frameFromLocal(frame,centerLocal));
    for(let s=0;s<ringSize;s++){
     const p=center.clone().add(frameFromLocal(frame,locals[s])),q=(vr*ringSize+s)*3,vertex=sr*ringSize+s;
     bindTarget[q]=p.x;bindTarget[q+1]=p.y;bindTarget[q+2]=p.z;position.setXYZ(vertex,p.x,p.y,p.z);
    }
    cache.push({arcFraction:bindArc.fractionAtX(mappedX),mappedX,sourceX,centerLocal,locals,scale});
   }
   position.needsUpdate=true;geometry.computeVertexNormals();geometry.getAttribute('normal').needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const bindAreas=new Float64Array(ringCount),bindLong=new Float64Array((ringCount-1)*ringSize);
   for(let r=0;r<ringCount;r++)bindAreas[r]=area3(position,(firstRing+r)*ringSize,ringSize);
   for(let r=1;r<ringCount;r++)for(let s=0;s<ringSize;s++){
    const a=((r-1)*ringSize+s)*3,b=(r*ringSize+s)*3;bindLong[(r-1)*ringSize+s]=Math.hypot(bindTarget[b]-bindTarget[a],bindTarget[b+1]-bindTarget[a+1],bindTarget[b+2]-bindTarget[a+2]);
   }
   let lastAudit=null;
   const update=()=>{
    const state=readState(),cc=controls(state.points),curve=adapterModule.createChickenPhase1Pchip(cc.xs,cc.points),arc=adapterModule.createChickenPhase1ArcLengthMap(curve,CURVE_MIN,CURVE_MAX,384);
    let prev=null,areaMin=Infinity,areaMax=0;
    for(let r=0;r<ringCount;r++){
     const c=cache[r],x=arc.xAtFraction(c.arcFraction),frame=makeFrame(curve,x,sampleQ(x,state.quaternions),prev);prev=frame;
     const center=new T.Vector3(...curve.evaluate(x)).add(frameFromLocal(frame,c.centerLocal));
     for(let s=0;s<ringSize;s++){
      const p=center.clone().add(frameFromLocal(frame,c.locals[s])),vertex=(firstRing+r)*ringSize+s;position.setXYZ(vertex,p.x,p.y,p.z);
     }
     const ratio=area3(position,(firstRing+r)*ringSize,ringSize)/(bindAreas[r]||1);areaMin=Math.min(areaMin,ratio);areaMax=Math.max(areaMax,ratio);
    }
    const ratios=[];
    for(let r=1;r<ringCount;r++)for(let s=0;s<ringSize;s++){
     const a=(firstRing+r-1)*ringSize+s,b=(firstRing+r)*ringSize+s,current=Math.hypot(position.getX(b)-position.getX(a),position.getY(b)-position.getY(a),position.getZ(b)-position.getZ(a));
     ratios.push(current/(bindLong[(r-1)*ringSize+s]||1));
    }
    ratios.sort((a,b)=>a-b);position.needsUpdate=true;geometry.computeVertexNormals();geometry.getAttribute('normal').needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
    lastAudit=Object.freeze({ringCount,ringSize,ringAreaRatioMin:areaMin,ringAreaRatioMax:areaMax,longitudinalRatioMedian:quantile(ratios,.5),longitudinalRatioP95:quantile(ratios,.95),longitudinalRatioMax:ratios.at(-1)??1,curvePointCount:cc.points.length,bindCurveLength:bindArc.totalLength,poseCurveLength:arc.totalLength,curveLengthRatio:arc.totalLength/(bindArc.totalLength||1),mappingRevision:'source-ring-to-cervical-arc-v2',radiusRegularization:'root-neck-envelope-v1'});
   };
   const applyPose=pose=>{const result=wrapped.applyPose(pose);update();skeleton.update();return{...result,centerlineFrameAudit:lastAudit};};
   const diagnostics=()=>{const base=wrapped.diagnostics();return{...base,schema:'life_ecosystem/chicken_phase1_articulated_skin_diagnostics@1.6',topologyRevision:'torso-preserving-neck-root-split-v7.1',centerlineCurveRevision:'rotation-minimizing-frame-centerline-v2',weightingRevision:'anatomical-neck-root-preserving-centerline-sweep-v7.1',candidateAlgorithmRevision:'mapped-cervical-shell-v7.2-experimental',neckShell:{ringCount,ringSize,vertexCount:ringCount*ringSize,triangleCount:(ringCount-1)*ringSize*2,allocatedVertexCount:position.count,xRange:[shell.stationXs[firstRing],sourceMax],mappedCurveRange:[.120,CURVE_MAX]},lastFrameAudit:lastAudit};};
   return Object.freeze({bones,skeleton,meshes:wrapped.meshes,applyPose,verifyInvariants:wrapped.verifyInvariants,detach:wrapped.detach,diagnostics,rootOrigin:wrapped.rootOrigin,neckMesh,shell});
  }
  let attempts=0;
  const timer=setInterval(()=>{
   attempts++;const runtime=__phase1Runtime,current=runtime?.skin,state=current?.diagnostics?.()||{};
   if(!runtime?.installSkin||!current||!state.peckKinematicsRevision){if(attempts>1600)clearInterval(timer);return;}
   const wrap=()=>{if(!runtime.skin)return;if(runtime.skin.diagnostics?.().candidateAlgorithmRevision==='mapped-cervical-shell-v7.2-experimental')return;runtime.skin=createVisibleShellAdapter(runtime.skin);};
   wrap();const previous=runtime.installSkin.bind(runtime);runtime.installSkin=()=>{previous();wrap();};
   window.__CHICKEN_R100_CENTERLINE_SWEEP__=Object.freeze({version:'anatomical-neck-root-preserving-centerline-sweep-v7.1',topology:'torso-preserving-neck-root-split-v7.1',curve:'rotation-minimizing-frame-centerline-v2',candidateAlgorithmRevision:'mapped-cervical-shell-v7.2-experimental',installed:true,groupTestAuthorized:false});
   clearInterval(timer);
  },25);
 }).catch(error=>console.error('Chicken R10.0 mapped centerline adapter failed',error));
})();
