// R2 recipe closure: validated input, undo/redo, and visible errors.
const history=[JSON.stringify(C)],future=[];let restoring=false;
function syncR2(){
 for(const k of ['density','flatten','disorder','fuzzAmount','roughness','exposure'])if($(k)){$(k).value=C[k];if($(k+'Out'))$(k+'Out').textContent=['exposure','roughness'].includes(k)?C[k].toFixed(2):Math.round(C[k]*100)+'%';}
 for(const k of ['warp','weft'])$(k+'Color').value=C[k];
 for(const k of ['fibers','curved','dof'])$(k).checked=C[k];
 $('undo').disabled=history.length<2;$('redo').disabled=!future.length;
 $('regionNote').textContent='全样布使用同一组独立纤维。可改变微观结构并保存配方，无局部细节拼接边界。';
}
function rememberR2(){if(restoring)return;const s=JSON.stringify(C);if(s!==history[history.length-1]){history.push(s);if(history.length>30)history.shift();future.length=0;}syncR2();}
async function applyR2(p){
 if(!p||typeof p!=='object')throw Error('配方内容不是对象');
 const ranges={density:[.8,.98],flatten:[.25,.95],disorder:[0,1],fuzzAmount:[0,1],roughness:[.4,.9],exposure:[.55,1.8],seed:[0,2147483647],geometryDetail:[0,2]};
 const next={...C};for(const [k,[a,b]] of Object.entries(ranges)){if(p[k]!==undefined){if(!Number.isFinite(p[k])||p[k]<a||p[k]>b)throw Error('参数超出范围：'+k);next[k]=p[k];}}
 if(!Number.isSafeInteger(next.seed)||!Number.isInteger(next.geometryDetail))throw Error('种子或细分档位不是整数');
 for(const k of ['warp','weft'])if(p[k]!==undefined){if(!/^#[0-9a-f]{6}$/i.test(p[k]))throw Error('无效颜色：'+k);next[k]=p[k];}
 for(const k of ['fibers','curved','dof'])if(p[k]!==undefined){if(typeof p[k]!=='boolean')throw Error('无效布尔值：'+k);next[k]=p[k];}
 if(p.view!==undefined){if(!['hero','macro','edge'].includes(p.view))throw Error('无效镜头');next.view=p.view;}
 if(p.light!==undefined){if(!['studio','grazing','back'].includes(p.light))throw Error('无效光照');next.light=p.light;}
 if(p.quality!==undefined){if(![.65,1].includes(p.quality))throw Error('无效画质');next.quality=p.quality;}
 Object.assign(C,next);await rebuild();lighting(C.light);await setView(C.view);renderer.toneMappingExposure=C.exposure;camera.bokehSize=C.dof?90:0;
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)*C.quality);if(pt){pt.renderScale=C.quality;pt.updateCamera();pt.reset();}
 document.querySelectorAll('[data-quality]').forEach(b=>b.classList.toggle('active',+b.dataset.quality===C.quality));syncR2();rememberR2();dirty=true;return {...C};
}
for(const k of ['disorder','fuzzAmount']){
 $(k).oninput=e=>$(k+'Out').textContent=Math.round(+e.target.value*100)+'%';
 $(k).onchange=async e=>{C[k]=+e.target.value;try{await rebuild();rememberR2();}catch(err){fail(err);}};
}
$('roughness').oninput=e=>{C.roughness=+e.target.value;$('roughnessOut').textContent=C.roughness.toFixed(2);model.g.traverse(o=>{if(o.isMesh)o.material.roughness=o.name.startsWith('envelope')?Math.min(.94,C.roughness+.08):Math.max(.4,C.roughness-.15);});if(pt){pt.updateMaterials();pt.reset();}dirty=true;};
$('newSeed').onclick=()=>applyR2({seed:(C.seed+1)%2147483647}).catch(fail);
$('regular').onclick=()=>applyR2({disorder:C.disorder>.01?0:.68}).catch(fail);
const palettes={oat:['#bcb19a','#a99f8b'],ivory:['#dbd5c5','#c8c2b1'],charcoal:['#4a4c4c','#777a75']};
for(const b of document.querySelectorAll('[data-palette]'))b.onclick=()=>{const [w,f]=palettes[b.dataset.palette];$('warpColor').value=w;$('weftColor').value=f;for(const k of ['warp','weft'])$(k+'Color').dispatchEvent(new Event('input',{bubbles:true}));document.querySelectorAll('[data-palette]').forEach(k=>k.classList.toggle('active',k===b));rememberR2();};
$('undo').onclick=async()=>{if(history.length<2||busy)return;future.push(history.pop());restoring=true;try{await applyR2(JSON.parse(history[history.length-1]));}finally{restoring=false;syncR2();}};
$('redo').onclick=async()=>{if(!future.length||busy)return;const s=future.pop();history.push(s);restoring=true;try{await applyR2(JSON.parse(s));}finally{restoring=false;syncR2();}};
$('loadRecipe').onclick=()=>$('recipeInput').click();
$('recipeInput').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>64000)throw Error('配方超过 64 KB');const p=JSON.parse(await file.text());if(!['kaopu/dense_yarn_look@1','kaopu/dense_yarn_look@2'].includes(p.schema))throw Error('不是可识别的织物配方');await applyR2(p.parameters);$('recipeStatus').textContent=(p.schema.endsWith('@1')?'R1 参数已迁移至 R2，非原版像素还原：':'已还原：')+file.name;}catch(err){$('recipeStatus').textContent='导入已拒绝：'+err.message;}finally{e.target.value='';}};
$('save').onclick=()=>saveFile('Yarn_Atelier_R2_recipe.json',JSON.stringify({schema:'kaopu/dense_yarn_look@2',version:C.version,units:'millimeter_for_rendering_meter_for_kernel',parameters:C,authority:'independent_study_not_official_fibric',visualAcceptance:false},null,2),'application/json');
document.querySelector('aside').addEventListener('change',()=>setTimeout(rememberR2,50));
for(const b of document.querySelectorAll('[data-view]'))b.onclick=async()=>{try{await setView(b.dataset.view);syncR2();rememberR2();}catch(e){fail(e);}};
window.__YARN_TEST__.applyRecipe=applyR2;window.__YARN_TEST__.readData=()=>geoData;
window.__YARN_TEST__.renderStatus=()=>({trace,ptDirty,busy,samples:pt?.samples||0});
syncR2();
