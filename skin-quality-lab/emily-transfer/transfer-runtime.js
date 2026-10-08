// Included in the inherited renderer's module scope by build.cjs.
let compareLeft,compareRight,compareScene,compareMaterial;
function syncTransfer(){
  if(!skin||!fuzz||!composeMaterial)return;
  applyTransferFeatures({uniforms:U,material:skin,fuzzMaterial:fuzz.material,values,features:transfer.features,method:transfer.method,baseline:compareHeld});
  composeMaterial.uniforms.strength.value=compareHeld||transfer.method!=='enhanced'||!transfer.features.diffusion?0:values.sss;
}
function ensureCompareTargets(){
  if(!compareLeft){
    const options={type:THREE.UnsignedByteType,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false};
    compareLeft=new THREE.WebGLRenderTarget(1,1,options);compareRight=new THREE.WebGLRenderTarget(1,1,options);
    compareMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,vertexShader:quadVertex,fragmentShader:'precision highp float;varying vec2 vUv;uniform sampler2D tLeft,tRight;uniform float split;void main(){gl_FragColor=vUv.x<split?texture2D(tLeft,vUv):texture2D(tRight,vUv);}',uniforms:{tLeft:{value:compareLeft.texture},tRight:{value:compareRight.texture},split:{value:.5}}});
    compareScene=new THREE.Scene();compareScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),compareMaterial));
  }
  if(compareLeft.width!==fullRT.width||compareLeft.height!==fullRT.height){compareLeft.setSize(fullRT.width,fullRT.height);compareRight.setSize(fullRT.width,fullRT.height);}
}
function render(){
  if(!state.ready)return;
  const held=compareHeld;
  try{
    if(transfer.mode==='split'&&!held){
      ensureCompareTargets();
      compareHeld=true;syncTransfer();renderOne(compareLeft);
      compareHeld=false;syncTransfer();renderOne(compareRight);
      compareMaterial.uniforms.split.value=transfer.split;
      renderer.setRenderTarget(null);renderer.render(compareScene,postCamera);
    }else{
      compareHeld=held||transfer.mode==='base';syncTransfer();renderOne();
    }
    state.frames++;state.method=transfer.method;state.viewMode=transfer.mode;
  }finally{compareHeld=held;syncTransfer();dirty=false;}
}
function updateTransferUI(){
  document.querySelectorAll('[data-method]').forEach(b=>{const a=b.dataset.method===transfer.method;b.classList.toggle('active',a);b.setAttribute('aria-pressed',String(a));});
  $('transferMode').value=transfer.mode;
  for(const [key,on] of Object.entries(transfer.features)){const el=$('feature-'+key);if(el)el.checked=on;}
  $('wipeControl').hidden=transfer.mode!=='split';
  $('splitLine').hidden=transfer.mode!=='split';$('splitLabels').hidden=transfer.mode!=='split';
  $('splitLine').style.left=(transfer.split*100)+'%';
  $('wipe').value=transfer.split*100;$('wipeOut').textContent=Math.round(transfer.split*100)+'%';
  $('methodNote').textContent=transfer.method==='emily'?'参考核心：当前头模的扫描贴图 + 微凹凸 + RGB 包裹光。GGX 反射重实现；未照搬 XG。':'增强版：在参考思路之外加入屏幕空间 RGB 扩散、几何厚度透光与绒毛。';
  $('currentMethod').textContent=transfer.method==='emily'?'EMILY 思路 / 迁移到 LEE':'增强皮肤 / 迁移到 LEE';
  document.querySelectorAll('[data-advanced]').forEach(el=>el.classList.toggle('inactive',transfer.method!=='enhanced'));
  dirty=true;
}
function setTransferMethod(method){if(!['emily','enhanced'].includes(method))throw Error('Unknown shading method');transfer.method=method;syncTransfer();updateTransferUI();}
function setTransferMode(mode){if(!['full','split','base'].includes(mode))throw Error('Unknown view mode');transfer.mode=mode;updateTransferUI();}
function transferSnapshot(){return {method:transfer.method,mode:transfer.mode,split:transfer.split,features:{...transfer.features}};}
function restoreTransfer(o){
  if(o&&['emily','enhanced'].includes(o.method))transfer.method=o.method;
  if(o&&['full','split','base'].includes(o.mode))transfer.mode=o.mode;
  if(Number.isFinite(o?.split))transfer.split=Math.max(.02,Math.min(.98,o.split));
  for(const key in transfer.features)if(typeof o?.features?.[key]==='boolean')transfer.features[key]=o.features[key];
  syncTransfer();updateTransferUI();
}
window.__EMILY_TRANSFER__={
  reference:EMILY_REFERENCE,transfer,
  setMethod:setTransferMethod,setMode:setTransferMode,
  setFeature:(key,on)=>{if(!(key in transfer.features))throw Error('Unknown feature');transfer.features[key]=!!on;syncTransfer();updateTransferUI();},
  snapshot:transferSnapshot,
  invariants:()=>({target:'Lee Perry-Smith',emilyAssetsLoaded:false,meshCount:1,geometryUUID:mesh?.geometry.uuid,colorPigment:values.pigment,relief:values.relief,baseColorPreserved:true}),
  uniforms:()=>({method:U.uEmilyMethod.value,scatter:U.uScatter.value,micro:U.uMicro.value,oil:U.uOil.value,transmission:U.uTranslucency.value}),
  exportRecipe:()=>recipe(),loadRecipe:(o)=>loadRecipe(o)
};
for(const b of document.querySelectorAll('[data-method]'))b.onclick=()=>setTransferMethod(b.dataset.method);
$('transferMode').onchange=()=>setTransferMode($('transferMode').value);
for(const key in transfer.features)$('feature-'+key).onchange=e=>{transfer.features[key]=e.target.checked;syncTransfer();updateTransferUI();};
$('wipe').oninput=()=>{transfer.split=+$('wipe').value/100;updateTransferUI();};
$('splitLine').onpointerdown=e=>{e.stopPropagation();e.preventDefault();$('splitLine').setPointerCapture(e.pointerId);};
$('splitLine').onpointermove=e=>{if(!$('splitLine').hasPointerCapture(e.pointerId))return;e.stopPropagation();const r=viewport.getBoundingClientRect();transfer.split=Math.max(.02,Math.min(.98,(e.clientX-r.left)/r.width));updateTransferUI();};
$('splitLine').onpointerup=e=>{if($('splitLine').hasPointerCapture(e.pointerId))$('splitLine').releasePointerCapture(e.pointerId);};
const oldReset=$('reset').onclick;$('reset').onclick=()=>{Object.assign(transfer,{method:'emily',mode:'full',split:.5,features:{diffusion:true,reflection:true,detail:true,transmission:true,fuzz:true}});oldReset();updateTransferUI();};
// Keep all controls inert until the renderer is ready; unlike the inherited page,
// an early click must not access uninitialized render targets or cameras.
for(const el of document.querySelectorAll('button,input,select'))if(el.id!=='mobileToggle')el.disabled=true;
function unlockTransfer(){if(!state.ready)return;for(const el of document.querySelectorAll('button,input,select'))el.disabled=false;updateTransferUI();syncTransfer();dirty=true;}
updateTransferUI();
