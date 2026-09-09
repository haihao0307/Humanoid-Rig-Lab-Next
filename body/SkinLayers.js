/* Regional skin boundaries. The source exterior already contains skin and fat:
 * apply only parameter deltas outside it, and place layer boundaries inward.
 * These are visual reconstruction surfaces, not segmented tissue volumes. */
const SKIN_LAYER_PROFILES=/*__SKIN_LAYER_PROFILE_JSON__*/;
function validateSkinLayerSettings(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('皮肤参数必须为对象');
 if(Object.keys(input).some(k=>!Object.hasOwn(SKIN_LAYER_PROFILES.limits,k)))throw Error('未知皮肤参数');
 const out={};for(const [key,[a,b]]of Object.entries(SKIN_LAYER_PROFILES.limits)){
  const value=input[key]??SKIN_LAYER_PROFILES.defaults[key];
  if(typeof value!=='number'||!Number.isFinite(value)||value<a||value>b)throw Error('皮肤参数超出范围：'+key);
  out[key]=value;
 }return out;
}
function skinLayerRegionWeights(tissue,g,v,source){
 const regions=SKIN_LAYER_PROFILES.regions,weights={},normal=Array.from(g.n.subarray(v*3,v*3+3));
 const add=(key,w)=>{if(w>0)weights[key]=(weights[key]||0)+w;};
 let limb=0;
 for(let k=0;k<4;k++){
  const id=tissue.human.joints[g.skinJoints[v*4+k]]?.id||'',w=g.skinWeights[v*4+k];if(w<=0)continue;
  if(/_(hand|metacarpal_\d+|finger_\d+_\d+)$/.test(id)){
   const bind=tissue.bind.get(id.startsWith('left_')?'left_hand':'right_hand');
   const local=bind?rotate(inv(bind.q),normal):normal,palm=tissueSmooth(.15,.8,local[2]);
   add('hand',w*(1-palm));add('palm',w*palm);limb+=w;
  }else if(/_(foot|metatarsal_\d+|toe_\d+_\d+)$/.test(id)){
   const sole=tissueSmooth(.2,.8,-normal[1]);add('foot',w*(1-sole));add('sole',w*sole);limb+=w;
  }else{
   const key=/_(forearm|radiusRotation)$/.test(id)?'forearm':/_upperArm$/.test(id)?'upperArm':/_(tibia|patella)$/.test(id)?'lowerLeg':/_femur$/.test(id)?'thigh':null;
   if(key){add(key,w);limb+=w;}
  }
 }
 const axial=Math.max(0,1-limb),y=source[1],face=tissueSmooth(1.44,1.51,y),neck=tissueSmooth(1.34,1.43,y)*(1-face);
 const torso=1-face-neck,chest=tissueSmooth(1.01,1.19,y),back=tissueSmooth(.1,.7,-normal[2]);
 add('face',axial*face);add('neck',axial*neck);add('back',axial*torso*back);
 add('chest',axial*torso*(1-back)*chest);add('abdomen',axial*torso*(1-back)*(1-chest));
 const sum=Object.values(weights).reduce((a,b)=>a+b,0)||1;
 for(const key of Object.keys(weights))weights[key]/=sum;
 return {weights,epidermisMm:Object.entries(weights).reduce((s,[k,w])=>s+regions[k].epidermisMm*w,0),dermisMm:Object.entries(weights).reduce((s,[k,w])=>s+regions[k].dermisMm*w,0),subcutaneousMm:Object.entries(weights).reduce((s,[k,w])=>s+regions[k].subcutaneousMm*w,0)};
}
function applySkinLayerShape(tissue,g,raw){
 const settings=validateSkinLayerSettings(tissue.human.characterPreset.appearance.skinLayers),count=g.p.length/3;
 const field={epidermis:new Float32Array(count),dermis:new Float32Array(count),subcutaneous:new Float32Array(count),fairing:new Float32Array(count),settings};
 const ranges={epidermis:[Infinity,0],dermis:[Infinity,0],subcutaneous:[Infinity,0]},regionCounts={};let maxAdjustment=0;
 for(let v=0;v<count;v++){
  const k=v*3,sample=skinLayerRegionWeights(tissue,g,v,raw?[-raw[k],raw[k+1],raw[k+2]]:Array.from(g.p.subarray(k,k+3))),w=sample.weights;
  field.epidermis[v]=sample.epidermisMm*settings.thicknessScale/1000;
  field.dermis[v]=sample.dermisMm*settings.thicknessScale/1000;
  field.subcutaneous[v]=sample.subcutaneousMm*settings.subcutaneousScale/1000;
  const delicate=(w.face||0)+(w.hand||0)+(w.palm||0)+(w.foot||0)+(w.sole||0);
  field.fairing[v]=clamp((sample.epidermisMm+sample.dermisMm)*.35,SKIN_LAYER_PROFILES.geometry.minFairingMm,SKIN_LAYER_PROFILES.geometry.maxFairingMm)/1000*(1-.65*delicate)*settings.surfaceSmoothing;
  // Keep the contact sole at the existing floor. Thin features receive a
  // smaller silhouette change; no baseline thickness is added a second time.
  const change=((sample.epidermisMm+sample.dermisMm)*(settings.thicknessScale-1)+sample.subcutaneousMm*(settings.subcutaneousScale-1))*(1-.75*delicate)*(1-(w.sole||0));
  const offset=clamp(change,-SKIN_LAYER_PROFILES.geometry.maxInwardAdjustmentMm,SKIN_LAYER_PROFILES.geometry.maxOutwardAdjustmentMm)/1000;
  for(let c=0;c<3;c++)g.p[k+c]+=g.n[k+c]*offset;
  maxAdjustment=Math.max(maxAdjustment,Math.abs(offset));
  for(const name of Object.keys(ranges)){ranges[name][0]=Math.min(ranges[name][0],field[name][v]*1000);ranges[name][1]=Math.max(ranges[name][1],field[name][v]*1000);}
  const region=Object.keys(w).reduce((a,b)=>w[a]>w[b]?a:b);regionCounts[region]=(regionCounts[region]||0)+1;
 }
 g.n=wholeBodyNormals(g.p,g.i);g.skinLayerField=field;
 tissue.skinLayerReport={schema:'jarvis/skin_layers@1',settings:{...settings},requestedThicknessMm:ranges,regionalVertexCounts:regionCounts,maxExteriorAdjustmentMm:maxAdjustment*1000,
  sourceExteriorIncludesTissue:true,measuredOnThisSubject:false,subcutaneousValues:'authored estimates',boundaries:'inward offset surfaces; not closed tissue volumes',source:SKIN_LAYER_PROFILES.sources};
 return field;
}
function skinLayerInsetLimits(g){
 const count=g.p.length/3,cap=new Float32Array(count).fill(.025),p=g.p.slice(),cache=g.surfaceCache;
 // Curvature bounds use the stable rest surface, never the first inspected pose.
 for(let v=0;v<count;v++){const id=cache.map[v];if(id>=0)p.set(cache.rest.subarray(id*3,id*3+3),v*3);}
 const n=wholeBodyNormals(p,g.i);
 // Local curvature bounds the offset radius. This reduces local foldovers;
 // it does not prove absence of intersections between distant surface parts.
 for(let e=0;e<g.i.length;e+=3)for(let k=0;k<3;k++){
  const a=g.i[e+k],b=g.i[e+(k+1)%3],i=a*3,j=b*3;
  const distance=Math.hypot(p[i]-p[j],p[i+1]-p[j+1],p[i+2]-p[j+2]);
  const turn=Math.hypot(n[i]-n[j],n[i+1]-n[j+1],n[i+2]-n[j+2]);
  if(turn>1e-4&&distance>1e-8){const value=distance/turn*SKIN_LAYER_PROFILES.geometry.curvatureRadiusFraction;cap[a]=Math.min(cap[a],value);cap[b]=Math.min(cap[b],value);}
 }
 return cap;
}
function buildSkinLayerSurfaces(tissue){
 const source=tissue.skin.g,field=source.skinLayerField;if(!field)return [];
 const count=source.p.length/3;
 tissue.skinLayerItems=['dermis','hypodermis','subcutaneousBase'].map((name,level)=>{
  const depth=new Float32Array(count);
  for(let v=0;v<count;v++)depth[v]=field.epidermis[v]+(level>0?field.dermis[v]:0)+(level>1?field.subcutaneous[v]:0);
  const g={...source,p:source.p.slice(),n:source.n.slice(),renderP:source.p.slice(),renderN:source.n.slice(),c:null,skinLayerParent:source,skinLayerDepth:depth,skinLayerLevel:level,skinLayerRevision:-1};
  delete g.surfaceCache;
  return {id:'skin_boundary_'+name,g,materialKind:9,color:[[.64,.32,.28],[.78,.60,.31],[.56,.47,.32]][level],visible:false,skinLayer:name};
 });
 const colors=new Float32Array(count*3);for(let v=0;v<count;v++){const t=clamp((field.epidermis[v]+field.dermis[v]-.0008)/.0028,0,1);colors.set([.12+.72*t,.48+.12*Math.sin(Math.PI*t),.82-.58*t],v*3);}
 tissue.skinThicknessMap={...tissue.skin,id:'skin_thickness_map',g:{...source,c:colors},materialKind:9,visible:false};
 return [...tissue.skinLayerItems,tissue.skinThicknessMap];
}
function refreshSkinLayerGeometry(g){
 const source=g.skinLayerParent;if(!source||g.skinLayerRevision===source.surfaceCache.revision)return;
 if(!source.skinLayerInsetCap)source.skinLayerInsetCap=skinLayerInsetLimits(source);
 const p=source.renderP,n=source.renderN,cap=source.skinLayerInsetCap;
 let limited=0,min=Infinity,max=0;
 for(let v=0;v<g.skinLayerDepth.length;v++){
  // One cap ratio is shared by all three boundaries: layer order is retained.
  const field=source.skinLayerField,total=field.epidermis[v]+field.dermis[v]+field.subcutaneous[v];
  const ratio=Math.min(1,cap[v]/Math.max(total,1e-8)),depth=g.skinLayerDepth[v]*ratio;
  if(ratio<.999)limited++;min=Math.min(min,depth);max=Math.max(max,depth);
  for(let c=0;c<3;c++)g.renderP[v*3+c]=p[v*3+c]-n[v*3+c]*depth;
 }
 g.renderN=wholeBodyNormals(g.renderP,g.i);g.skinLayerRevision=source.surfaceCache.revision;
 g.skinLayerDiagnostics={curvatureLimitedVertices:limited,appliedDepthMm:[min*1000,max*1000]};
}
function installSkinLayerControls(lab){
 const panel=document.createElement('section');panel.id='skin-layer-panel';panel.hidden=true;
 panel.innerHTML='<p>外皮由人体截面函数生成；表皮、真皮与皮下组织按部位设置厚度。</p><div data-skin-controls></div><button data-skin-apply>应用皮肤形体</button><button data-skin-reset>恢复皮肤默认值</button><p data-skin-status role="status"></p><label>观察 <select data-skin-view><option value="skin">皮肤外表</option><option value="clay">静止外形白模</option><option value="dermis">真皮外界</option><option value="hypodermis">皮下组织外界</option><option value="subcutaneousBase">皮下组织内界（估计）</option><option value="skinThickness">表皮＋真皮厚度图</option></select></label><p>厚度图：蓝色较薄（约 0.8 mm），橙色较厚（约 3.6 mm）。内层为估计边界，不是人体扫描得到的分层体积。</p><details><summary>区域厚度参考（mm）</summary><div data-skin-reference></div></details>';
 const controls=panel.querySelector('[data-skin-controls]'),status=panel.querySelector('[data-skin-status]');
 for(const [key,label]of [['thicknessScale','表皮与真皮厚度'],['subcutaneousScale','皮下覆盖厚度'],['surfaceSmoothing','表面平整度']]){
  const row=document.createElement('label');row.style.cssText='display:grid;grid-template-columns:1fr 90px;gap:8px;margin:12px 0';row.textContent=label;
  const input=document.createElement('input');input.type='number';input.dataset.skinParameter=key;input.min=SKIN_LAYER_PROFILES.limits[key][0];input.max=SKIN_LAYER_PROFILES.limits[key][1];input.step=.05;row.append(input);controls.append(row);
 }
 const table=document.createElement('table');table.style.cssText='width:100%;font-size:11px;border-collapse:collapse';table.innerHTML='<thead><tr><th>部位</th><th>表皮</th><th>真皮</th><th>皮下估计</th></tr></thead>';
 for(const r of Object.values(SKIN_LAYER_PROFILES.regions)){const tr=table.insertRow();for(const value of [r.label,r.epidermisMm,r.dermisMm,r.subcutaneousMm])tr.insertCell().textContent=String(value);}
 panel.querySelector('[data-skin-reference]').append(table);document.body.append(panel);
 const inputs=[...panel.querySelectorAll('[data-skin-parameter]')];
 const sync=()=>{const settings=validateSkinLayerSettings(lab.character.export().appearance.skinLayers);for(const input of inputs)input.value=settings[input.dataset.skinParameter];};
 const apply=async(reset=false)=>{
  const buttons=[...panel.querySelectorAll('button,input,select')];buttons.forEach(b=>b.disabled=true);
  try{const p=lab.character.export();p.appearance.skinLayers=reset?{...SKIN_LAYER_PROFILES.defaults}:validateSkinLayerSettings(Object.fromEntries(inputs.map(i=>[i.dataset.skinParameter,Number(i.value)])));status.textContent='正在重建皮肤与内层边界…';await lab.character.apply(p);sync();status.textContent='皮肤参数已应用。';}
  catch(e){status.textContent=e.message;}finally{buttons.forEach(b=>b.disabled=false);}
 };
 panel.querySelector('[data-skin-apply]').onclick=()=>apply();panel.querySelector('[data-skin-reset]').onclick=()=>apply(true);
 panel.querySelector('[data-skin-view]').onchange=e=>lab.wholeBody.setLayer(e.target.value).catch(err=>status.textContent=err.message);
 sync();return {sync,report:()=>({...lab.human.tissue.skinLayerReport,layers:(lab.human.tissue.skinLayerItems||[]).map(i=>({id:i.skinLayer,...i.g.skinLayerDiagnostics}))})};
}
