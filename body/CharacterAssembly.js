/* A shape edit stages the entire character. No live skeleton, contact state
 * or renderer changes until its replacement has been prepared successfully. */
async function prepareCharacterBody(lab,preset,previousDefinition){
 const previousHuman=lab.human,previousAgent=lab.agent,previousSurface=lab.compact,worldRevision=lab.world.revision;
 const current=()=>{
  requireCharacterIdle(previousAgent,'应用人物体型',{allowCharacterEdit:true});
  if(previousAgent.basic.posture!=='standing')throw Error('请先起身并站稳，再调整体型');
  if(lab.human!==previousHuman||lab.agent!==previousAgent||lab.compact!==previousSurface||previousHuman.characterPreset!==previousDefinition)throw Error('计算期间人物定义已更新，请重新应用');
  if(lab.world.revision!==worldRevision)throw Error('计算期间场景已更新，请重新应用');
  if(!previousSurface||previousSurface.disposed)throw Error('请等待人物身体加载完成');
  if(lab.compactQualityPending)throw Error('人物细节正在更新，请完成后再调整体型');
 };
 current();
 if(lab.hairTask)await lab.hairTask.catch(()=>{});
 current();
 const nextHuman=new Human(preset);nextHuman.tissue=new ReconstructionState(nextHuman);
 nextHuman.tissue.setView(previousHuman.tissue.view);
 const shell={human:nextHuman,tissue:nextHuman.tissue,renderer:lab.renderer,face:null};
 const data=await loadCompactSurface(previousSurface.quality,true,compactSourceRig(nextHuman),'surface',preset.appearance.hair,preset.shape);
 current();
 let nextSurface=null,committed=false;
 try{
  nextSurface=new CompactSurfaceRenderer(shell,data);
  const nextAgent=new Agent(nextHuman,lab.world,previousAgent.log,{staged:true,spawnPosition:[...previousAgent.pos],spawnYaw:previousAgent.yaw});
  nextAgent.npcId=previousAgent.npcId;
  const radius=bodyPhysicalProfile(nextHuman).bodyRadiusM+.06;
  if(lab.world.collision(previousAgent.pos,radius))throw Error('当前位置不能容纳调整后的人物，请先移到空旷处');
  if(lab.population?.collisionFor(nextAgent,previousAgent.pos,radius))throw Error('调整后的人物会与其他 NPC 重叠，请先腾出空间');
  nextAgent.pos=[previousAgent.pos[0],nextAgent.locomotion.rig.hipHeight,previousAgent.pos[2]];nextAgent.yaw=previousAgent.yaw;
  nextAgent.time=previousAgent.time;nextAgent.paused=previousAgent.paused;
  nextAgent.stats=structuredClone(previousAgent.stats);nextAgent.evidence=structuredClone(previousAgent.evidence);nextAgent.lastObject=previousAgent.lastObject;
  // Preserve the instance's body clock. Applying a shape does not create a
  // new world, rewind the simulation, or reinterpret elapsed time as growth.
  Object.assign(nextAgent.clock,{accumulator:previousAgent.clock.accumulator,ticks:previousAgent.clock.ticks,droppedSeconds:previousAgent.clock.droppedSeconds});
  nextHuman.tissue.time=previousHuman.tissue.time;
  nextAgent.locomotion.resetFromPose();nextHuman.pose();nextAgent.saveSafe();
  nextHuman.reconstructionNeutral={rootPosition:[...nextHuman.root.p],frames:new Map(nextHuman.joints.map(j=>[j.id,frame(j.world.p,j.world.q)]))};
  await nextSurface.skirt.assemble();
  if(!nextSurface.skirt.assemblyReady)throw Error('新体型的短裤尚未完成缝制检查，保留当前人物');
  current();
  return {
   commit(){
    if(committed)throw Error('人物替换已提交');current();
    // commitCharacterRuntime owns both the module variables and the public
    // lab references. All setters below are synchronous, without await.
    commitCharacterRuntime(lab,nextHuman,nextAgent,nextSurface);
    committed=true;
    try{previousSurface.dispose();}catch(error){console.error('旧人物资源清理失败',error);}
    if(previousHuman.tissue.surface===previousSurface)previousHuman.tissue.surface=null;
    // A notification failure after the swap must not dispose the live body.
    try{
     const count=document.getElementById('jointCount'),hash=document.getElementById('hash');
     if(count)count.textContent=nextHuman.joints.length;if(hash)hash.textContent=nextHuman.evidence.geometryHash;
     publishCompactProgress({group:'ready',state:'ready'});
    }catch(error){console.error('人物已替换，状态显示未刷新',error);}
    window.dispatchEvent(new CustomEvent('humanlab:character-replaced'));
   },
   dispose(){if(!committed)nextSurface.dispose();}
  };
 }catch(error){nextSurface?.dispose();throw error;}
}
function refreshCharacterControls(lab){
 lab.population?.refreshDefinition();
 for(const update of [()=>lab.face?.resetTransient(),()=>lab.biology?.refresh(),()=>lab.skin?.refresh(),()=>lab.face?.refresh(),()=>lab.hair.refreshControls(),()=>lab.shape?.refresh()]){
  try{update();}catch(error){console.error('人物定义已应用，部分控件未刷新',error);}
 }
 needsRedraw=true;
}
