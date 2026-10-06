import {createScarWorkbench} from './ScarWorkbench.mjs';
import {SkinExposure,SKIN_CONTROLS,SKIN_PRESETS} from './SkinAppearance.mjs';
const STORAGE='human.r008.skin.v1';
export function createSkinWorkbench({getSubject,onPreview}){
 const model=new SkinExposure(),$=id=>document.getElementById(id);model.preset('arrival');
 let scarWorkbench;let automatic=false,daySeconds=60,outdoorHours=6,dirty=false,saveClock=0,lastFlush=0;
 const panel=document.createElement('details');panel.id='skinPanel';panel.open=true;
 panel.innerHTML=`<summary>肤色与海岛日晒</summary><label>肤色阶段<select id="skinPreset"><option value="custom">自定义</option>${Object.entries(SKIN_PRESETS).map(([id,p])=>`<option value="${id}">${p.label}</option>`).join('')}</select></label><label>基础肤色 <input id="skinBaseColor" type="color" aria-label="基础肤色"></label>${SKIN_CONTROLS.map(c=>`<label>${c.label} <output id="skin-${c.key}-value"></output><input id="skin-${c.key}" aria-label="${c.label}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" style="width:100%"></label>`).join('')}<label><input id="skinAuto" type="checkbox"> 自动累积日晒（游戏运行时）</label><label>预览一天用时（秒）<input id="skinDaySeconds" type="number" min="10" max="3600" value="60" style="width:100%"></label><label>每天有效户外小时<input id="skinOutdoorHours" type="number" min="0" max="24" step=".5" value="6" style="width:100%"></label><label>晒黑速度：达到一半的日晒小时<input id="skinHalfHours" type="number" min=".1" max="10000" value="48" style="width:100%"></label><div class="row"><button id="skinAdvanceDay">推进一天</button><button id="skinArrival">重新到岛</button></div><p id="skinProgress" aria-live="polite"></p><small>推进一天按当前户外时长累积。自动预览在暂停、动作检查、面部检查和后台标签页时停止。实际游戏可接入时间、日晒强度与遮阴。</small><div class="row"><button id="skinExport">导出皮肤存档</button><button id="skinImportButton">导入皮肤存档</button></div><input id="skinImport" type="file" accept=".json,application/json" hidden><p id="skinMessage" role="status"></p>`;
 $('expressionPanel').before(panel);
 function refresh(){const a=model.appearance;for(const c of SKIN_CONTROLS){$('skin-'+c.key).value=a[c.key];$('skin-'+c.key+'-value').value=a[c.key].toFixed(2);}$('skinBaseColor').value=a.baseColor;$('skinHalfHours').value=model.progression.halfTanSunHours;$('skinAuto').checked=automatic;$('skinDaySeconds').value=daySeconds;$('skinOutdoorHours').value=outdoorHours;$('skinProgress').textContent=`已过 ${(model.progression.elapsedHours/24).toFixed(1)} 天 · 有效日晒 ${model.progression.equivalentSunHours.toFixed(1)} 小时 · 变深 ${Math.round(a.sunExposure*100)}%`;}
 function save(){lastFlush=performance.now();try{localStorage.setItem(STORAGE,JSON.stringify({recipe:model.export(),preview:{automatic,daySeconds,outdoorHours}}));dirty=false;}catch{$('skinMessage').textContent='本地保存不可用；仍可导出皮肤存档。';dirty=false;}}
 function apply({persist=true,ui=true}={}){getSubject()?.skin?.set(model.appearance);getSubject()?.scars?.set(model.scars);if(ui){refresh();scarWorkbench?.refresh();}if(persist){dirty=true;save();}return model.export();}
 function guarded(action){try{action();$('skinMessage').textContent='';}catch(e){$('skinMessage').textContent=e.message;refresh();}}
 for(const c of SKIN_CONTROLS)$('skin-'+c.key).oninput=()=>guarded(()=>{model.setAppearance({[c.key]:Number($('skin-'+c.key).value)});$('skinPreset').value='custom';apply();});
 $('skinBaseColor').oninput=()=>guarded(()=>{model.setAppearance({baseColor:$('skinBaseColor').value});$('skinPreset').value='custom';apply();});
 $('skinPreset').onchange=()=>guarded(()=>{if($('skinPreset').value!=='custom'){model.preset($('skinPreset').value);apply();}});
 $('skinAuto').onchange=()=>{automatic=$('skinAuto').checked;save();};
 function previewNumber(id,min,max,set){$(id).onchange=()=>guarded(()=>{const v=Number($(id).value);if(!Number.isFinite(v)||v<min||v>max)throw Error('预览参数超出范围');set(v);save();});}
 previewNumber('skinDaySeconds',10,3600,v=>daySeconds=v);previewNumber('skinOutdoorHours',0,24,v=>outdoorHours=v);
 $('skinHalfHours').onchange=()=>guarded(()=>{const r=model.export();r.progression.halfTanSunHours=Number($('skinHalfHours').value);model.restore(r);apply();});
 function advanceDay(){model.advance(outdoorHours);model.advance(24-outdoorHours,{uv:0});$('skinPreset').value='custom';return apply();}
 $('skinAdvanceDay').onclick=()=>guarded(advanceDay);
 $('skinArrival').onclick=()=>guarded(()=>{model.preset('arrival');automatic=false;$('skinPreset').value='arrival';apply();});
 $('skinExport').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(model.export(),null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='island-skin.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('skinImportButton').onclick=()=>$('skinImport').click();
 $('skinImport').onchange=async()=>{try{const file=$('skinImport').files[0];if(!file)return;if(file.size>16384)throw Error('肤色配方超过 16 KiB');model.restore(JSON.parse(await file.text()));$('skinPreset').value='custom';apply();$('skinMessage').textContent='肤色与日晒进度已恢复';}catch(e){$('skinMessage').textContent=e.message;}finally{$('skinImport').value='';}};
 try{const raw=localStorage.getItem(STORAGE);if(raw){const saved=JSON.parse(raw),p=saved.preview;if(p&&typeof p.automatic==='boolean'&&Number.isFinite(p.daySeconds)&&p.daySeconds>=10&&p.daySeconds<=3600&&Number.isFinite(p.outdoorHours)&&p.outdoorHours>=0&&p.outdoorHours<=24){model.restore(saved.recipe);automatic=p.automatic;daySeconds=p.daySeconds;outdoorHours=p.outdoorHours;}else throw Error('旧预览设置无效');$('skinPreset').value='custom';}else $('skinPreset').value='arrival';}catch{$('skinMessage').textContent='旧肤色存档不可用，已使用初到岛上设置。';$('skinPreset').value='arrival';}
 scarWorkbench=createScarWorkbench({getState:()=>model.scars,apply,onPreview});refresh();
 const api={
  export:()=>model.export(),restore(recipe){model.restore(recipe);$('skinPreset').value='custom';return apply();},
  set(patch){model.setAppearance(patch);$('skinPreset').value='custom';return apply();},
  preset(id){model.preset(id);$('skinPreset').value=id;return apply();},
  advance(gameHours,environment={}){model.advance(gameHours,environment);getSubject()?.skin?.set(model.appearance);getSubject()?.scars?.set(model.scars);dirty=true;if(performance.now()-lastFlush>=1000){$('skinPreset').value='custom';refresh();scarWorkbench.refresh();save();}return model.export();},
  advanceDay,bind(){return apply({persist:false});},
  setAutomatic(enabled){if(typeof enabled!=='boolean')throw Error('自动日晒开关应为布尔值');automatic=enabled;$('skinAuto').checked=enabled;save();},
  tick(seconds,running){if(!running||document.hidden||(!automatic&&!model.scars.automaticHealing))return;if(automatic)model.advance(seconds/daySeconds*24,{uv:outdoorHours/24});else model.scars.advance(seconds/daySeconds*24);getSubject()?.skin?.set(model.appearance);getSubject()?.scars?.set(model.scars);dirty=true;saveClock+=seconds;if(saveClock>=1){saveClock=0;refresh();scarWorkbench.refresh();save();}},
  get automatic(){return automatic;},get appearance(){return {...model.appearance};}
 };
 addEventListener('pagehide',()=>{if(dirty)save();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty)save();});return api;
}
