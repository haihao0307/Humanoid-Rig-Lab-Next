/* Display state for the fitted R2 body. There is no second body mesh builder. */
class ReconstructionState{
  constructor(human){
    this.human=human;this.view='skin';this.time=0;this.bind=human.sourceBind;
    this.jointIds=new Map(human.joints.map((j,i)=>[j.id,i]));this.setSkinAppearance(human.characterPreset.appearance.skin);
    this.skin={id:'r2-skin',visible:true};this.clay={id:'r2-clay',visible:false};
    this.items=[this.skin,this.clay];this.details=[];this.clayDetails=[];this.skinLayerItems=[];this.muscles=[];
    this.surfaceInfo={vertices:0,topology:'source fitted connected domains'};
    this.ecology=new HumanEcology(this,human.characterPreset.biology);
  }
  setSkinAppearance(input,material=null){this.skinAppearance=validateSkinAppearance(input);this.skinMaterial=material||resolveSkinMaterial(this.skinAppearance);this.skinColor=this.skinMaterial.color;}
  setView(view){if(!['skin','clay','regions'].includes(view))throw Error('R2 支持肤色、灰模和关节分区显示');this.view=view;this.visibility();}
  visibility(){this.skin.visible=this.view!=='clay';this.clay.visible=this.view==='clay';}
  update(time,dt=0){this.time=time;this.ecology.step(dt);}
  minimumSupportY(frames=null,jointIds=null){return this.surface?.minimumSupportY(frames,jointIds)||(jointIds?{y:Infinity,boneId:null,sampled:false}:{y:Math.min(...['left','right'].map(s=>(frames?frames.get(s+'_foot'):this.human.world(s+'_foot')).p[1]-this.human.bodyMetrics.skinSoleHeightM)),boneId:'source-foot-support',sampled:true});}
  report(){return {schema:'r2/reconstruction_state@1',view:this.view,time:this.time,
    sourceRegionsPreserved:true,jointCount:this.human.joints.length,rigReference:R2_RIG.status,
    legacyConstructor:false,fixedReferenceShape:isReferenceCharacterShape(this.human.characterPreset.shape),shape:validateCharacterShape(this.human.characterPreset.shape),geometryKey:this.human.bodyMetrics.geometryKey,geometry:this.surfaceInfo,skin:validateSkinAppearance(this.skinAppearance),
    deformation:'eight-influence dual-quaternion skinning with shared surface-graph weights and source-region priors',
    measuredSoftTissueDeformation:false,visualAcceptance:false};}
}

function hfDownload(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}

// Hair profile controls are maintained in CompactHairControls.js.

function installReconstructionViews(lab){
  const panel=document.createElement('section');panel.id='whole-body-controls';panel.hidden=true;
  panel.innerHTML='<p>R2 参考形体与 128 个骨架节点。彩色分区显示当前表皮的主要控制关节。</p><label>显示 <select id="r2-view"><option value="skin">肤色</option><option value="clay">灰模</option><option value="regions">关节分区</option></select></label><label><input id="r2-joints" type="checkbox">叠加关节链</label><label>定位关节 <select id="r2-joint"></select></label><button id="r2-focus-joint">定位</button><p>关节位置由同源解剖数据估算；分区权重与活动外观仍待验收。</p>';
  document.body.append(panel);const select=panel.querySelector('#r2-joint');
  for(const j of lab.human.joints){const option=document.createElement('option');option.value=j.id;option.textContent=j.id;select.append(option);}
  panel.querySelector('#r2-view').onchange=e=>{lab.tissue.setView(e.target.value);needsRedraw=true;};
  panel.querySelector('#r2-joints').onchange=e=>{lab.showRig=e.target.checked;needsRedraw=true;};
  panel.querySelector('#r2-focus-joint').onclick=()=>{lab.setCameraFollow(false);lab.renderer.target=lab.human.world(select.value).p.slice();lab.renderer.distance=.8;needsRedraw=true;};
}
