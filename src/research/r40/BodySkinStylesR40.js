/* Body-only skin styles: no shape, pose, lighting or head data in the file. */
(()=>{'use strict';
const keys=['originalTone','originalWarmth','originalRedness','originalVariation','originalFreckles','regionalColor','bodyVariation','jointTone','originalRoughness','originalOil','originalOilFilm','originalDetail','originalPores','bodyPores','originalGraphPores','originalWrinkles','originalMeso','originalCavity','neckCreases','originalScatter','originalDiffusion','originalFuzz'];
const panel=document.querySelector('#body-skin-panel-r40'),status=panel.querySelector('#body-skin-style-status-r40'),file=panel.querySelector('#body-skin-style-file-r40'),undo=panel.querySelector('#body-skin-style-undo-r40');
const inputs=Object.fromEntries(keys.map(k=>[k,panel.querySelector('[data-appearance="'+k+'"]')]));
if(Object.values(inputs).some(x=>!x))throw Error('身体皮肤控制不完整');
const outputs=Object.fromEntries(keys.map(k=>{const input=inputs[k],out=document.createElement('output');out.className='body-skin-value-r40';out.setAttribute('for',input.id||(input.id='body-skin-value-'+k+'-r40'));input.parentElement.insertBefore(out,input);input.addEventListener('input',refreshValues);return[k,out];}));
function refreshValues(){const a=window.bodyImplicitR02?.report?.().renderer?.appearance||{};for(const k of keys){const n=Number.isFinite(a[k])?a[k]:Number(inputs[k].value),raw=n.toFixed(6).replace(/0+$/,'').replace(/\.$/,'');outputs[k].textContent=raw.includes('.')?(raw.split('.')[1].length<2?raw+'0':raw):raw+'.00';}}
window.__BODY_SKIN_REFRESH_VALUES_R40__=refreshValues;refreshValues();
let beforeApply=null;
const presets={matte:{originalRoughness:.78,originalOil:.08,originalOilFilm:.12},balanced:{originalRoughness:.55,originalOil:.25,originalOilFilm:.35},dewy:{originalRoughness:.38,originalOil:.55,originalOilFilm:.65}};
function canApply(){const r=window.bodyImplicitR02?.report(),m=window.bodyMotionR37?.report().mode;return !!r?.ready&&!r.busy&&(!document.body.classList.contains('body-motion-active-r37')||m==='playing')&&!inputs.originalTone.disabled;}
function snapshot(){const a=window.bodyImplicitR02?.report().renderer.appearance;if(!a)throw Error('身体皮肤尚未准备好');const values={};for(const k of keys){const v=a[k];if(typeof v!=='number'||!Number.isFinite(v))throw Error('当前皮肤数值不完整：'+k);values[k]=v;}return values;}
function valid(values){if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).length!==keys.length)throw Error('皮肤样式字段不完整或包含额外数据');for(const k of keys){const v=values[k],i=inputs[k];if(!Object.hasOwn(values,k)||typeof v!=='number'||!Number.isFinite(v)||v<Number(i.min)||v>Number(i.max))throw Error('皮肤数值超出范围：'+k);}return values;}
function apply(values,message){if(!canApply())throw Error('请等待身体显示就绪，或在动作播放后调整');valid(values);const prior=snapshot();window.bodyImplicitR02.renderer.appearance(values);for(const k of keys)inputs[k].value=String(values[k]);refreshValues();beforeApply=prior;undo.disabled=false;status.textContent=message;}
function documentForCurrent(){return{schema:'body-skin-style-r40/1',values:snapshot()};}
function importDocument(doc){if(!doc||doc.schema!=='body-skin-style-r40/1'||Object.keys(doc).some(k=>!['schema','values'].includes(k)))throw Error('不是支持的身体皮肤样式文件');apply(valid(doc.values),'皮肤样式已载入；身体和姿势保持不变。');}
function onClick(fn){return()=>{try{fn();}catch(e){status.textContent=e.message;}};}
panel.querySelectorAll('[data-skin-preset-r40]').forEach(button=>button.addEventListener('click',onClick(()=>{const preset=presets[button.dataset.skinPresetR40];if(!preset)throw Error('皮肤质感选项不可用');apply({...snapshot(),...preset},'已调整粗糙度和油光；其他皮肤设置保持不变。');})));
panel.querySelector('#body-skin-style-export-r40').addEventListener('click',onClick(()=>{const doc=documentForCurrent(),url=URL.createObjectURL(new Blob([JSON.stringify(doc,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='身体皮肤样式.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='已导出身体皮肤样式；人物档案需另行保存。';}));
panel.querySelector('#body-skin-style-import-r40').addEventListener('click',()=>{file.value='';file.click();});
file.addEventListener('change',async()=>{try{const f=file.files?.[0];file.value='';if(!f)return;if(f.size>65536)throw Error('皮肤样式文件超过 64 KB');importDocument(JSON.parse(await f.text()));}catch(e){status.textContent='导入失败：'+e.message;}});
undo.addEventListener('click',onClick(()=>{if(!beforeApply)throw Error('没有可恢复的皮肤样式');const previous=beforeApply;apply(previous,'已恢复套用前的皮肤样式。');beforeApply=null;undo.disabled=true;}));
window.bodySkinStylesR40={snapshot:documentForCurrent,importDocument,canApply,keys:[...keys]};
})();
