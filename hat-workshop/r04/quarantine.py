from pathlib import Path
r=Path(__file__).resolve().parent;p=r/'app.js';s=p.read_text()
if 'flatcap-source-only' not in s:
 s=s.replace("const isReference=compare||state.repair===false,", "const isReference=compare||state.repair===false||state.id==='flatcap',")
 s=s.replace("fitModel:'layered-material/category-placement-r04'", "fitModel:state.id==='flatcap'?'flatcap-source-only/R02/quarantined':'layered-material/category-placement-r04'")
 s=s.replace('function updateQuality(){','function updateQualityBase(){',1)
 s += "\nfunction updateQuality(){updateQualityBase();const held=state.id==='flatcap';if(held){$('quality-note').textContent='鸭舌帽当前仅展示R02复刻参考：内衬与佩戴结构未通过本轮检查，新的自动贴合已隔离；不是本轮修复完成项。';$('fit-family').textContent='R02来源参考 / 自动贴合隔离';}for(const id of [...motherNumeric,'autoFit','repair','cutaway','textureMode','customColor','useCustomColor','width','depth','height','lift','tilt','roughness','detail','sheen','showClearance']){const el=$(id);if(el){if(held)el.disabled=true;else if(el.dataset.held==='true')el.disabled=false;el.dataset.held=String(held);}}document.querySelectorAll('[data-preset],[data-dye]').forEach(el=>{el.disabled=held;});if(!held){$('materialMM').disabled=!CONSTRUCTION[state.id].mode.startsWith('knit');$('bandFactor').disabled=true;}}\n"
 p.write_text(s)
