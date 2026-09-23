/* Settings for the single R2 reconstruction. */
function installBodySettings(lab){
 lab.biology=installHumanBiology(lab);
 lab.skin=installSkinAppearance(lab);
 lab.face=installFaceControls(lab);
 lab.appearance=installFaceAppearance(lab);
 lab.shape=installCharacterShapeControls(lab);
 lab.dna=installHumanDNA(lab);
 const style=document.createElement('style');style.id='body-settings-style';style.textContent=`
 #strength-open,#npc-open,#hair-open,#ll-open,#tr-open,#hn-open,#sh-open,#hf-open{display:none!important}
 #body-settings-open{position:fixed;right:16px;bottom:16px;z-index:98;padding:9px 15px}
 #body-settings{position:fixed;right:12px;top:12px;bottom:12px;z-index:120;width:min(370px,calc(100vw - 24px));box-sizing:border-box;overflow:auto;background:#f5f8f6;color:#28483f;border:1px solid #9db5ab;border-radius:12px;padding:15px;font:13px/1.65 system-ui;box-shadow:0 8px 35px #0004}
 #body-settings-open[hidden],#body-settings[hidden],#body-settings [hidden]{display:none!important}
 #body-settings header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
 #body-settings h2{font-size:17px;color:inherit;margin:0}
 #body-settings button{padding:7px 10px;margin:4px;background:#e3eee8;color:#24483a;border:1px solid #a4bbb0;border-radius:6px}
 #body-settings-home{display:grid;gap:9px}#body-settings-home>button{text-align:left;margin:0;padding:12px}
 #body-settings #npc-panel,#body-settings #strength-panel,#body-settings #hair-panel,#body-settings #whole-body-controls{position:static!important;width:100%!important;max-width:100%!important;max-height:none!important;box-sizing:border-box;margin:0!important;box-shadow:none!important;padding:10px!important}
#body-settings #hair-panel label{display:block;margin:8px 0}#body-settings #hair-panel input[type=number]{width:145px}#body-settings #hair-panel output{display:block;margin-top:8px}
 #body-settings .settings-hint{font-size:12px;color:#5c7567}
 #character-shape-panel .shape-slider{display:block;margin:12px 0}#character-shape-panel input[type=range]{display:block;width:100%;accent-color:#41745e}#character-shape-panel output{font-variant-numeric:tabular-nums}#shape-current,#shape-status{display:block;margin:8px 0}
 #skin-panel .skin-swatches{display:grid;grid-template-columns:1fr 1fr;gap:5px}
 #skin-panel .skin-exposure-presets{display:grid;grid-template-columns:1fr 1fr;gap:5px}
 #body-settings .skin-exposure-presets button{margin:0;font:inherit}
 #body-settings [data-skin-exposure][aria-pressed=true]{border-color:#315c48;background:#d3e7dc;box-shadow:inset 0 0 0 1px #315c48}
 #body-settings .skin-swatch{display:flex;align-items:center;gap:6px;text-align:left;margin:0;padding:6px;font:inherit}
 #body-settings .skin-swatch[aria-pressed=true]{border-color:#315c48;box-shadow:inset 0 0 0 1px #315c48;background:#d3e7dc}
 #skin-panel .skin-palette-row{display:grid;gap:5px;margin:10px 0}#skin-palette{width:100%;box-sizing:border-box;padding:6px}
 .skin-swatch>span{width:24px;height:24px;border-radius:50%;border:1px solid #0003;flex:none}
 #skin-panel .skin-slider{display:grid;grid-template-columns:1fr auto;gap:2px 8px;margin:12px 0}
 .skin-slider input,.skin-slider small{grid-column:1/-1;width:100%;box-sizing:border-box}.skin-slider small{color:#5c7567}.skin-slider output{font-variant-numeric:tabular-nums}
 #skin-panel .skin-color-row,#skin-panel .skin-seed-row{display:flex;align-items:center;gap:8px;margin:12px 0}
 #skin-color{width:44px;height:32px;padding:0}#skin-hex{width:80px}#skin-seed{min-width:0;width:140px}
 #skin-panel input{accent-color:#41745e}#skin-import{display:block;max-width:100%;margin:6px 0}#skin-status{display:block;overflow-wrap:anywhere}
 `;document.head.append(style);
 const open=document.createElement('button');open.id='body-settings-open';open.textContent='人物设置';open.setAttribute('aria-expanded','false');open.setAttribute('aria-controls','body-settings');open.hidden=window.parent!==window;
 const drawer=document.createElement('section');drawer.id='body-settings';drawer.hidden=true;drawer.setAttribute('aria-label','人物设置');
 drawer.innerHTML='<header><button id="body-settings-back" hidden>返回</button><h2 id="body-settings-title">人物设置</h2><button id="body-settings-close">关闭</button></header><div id="body-settings-home"></div><div id="body-settings-content"></div>';
 document.body.append(open,drawer);const el=id=>drawer.querySelector('#body-settings-'+id),home=el('home'),content=el('content');
 const panels=new Map(),entries=[['shape','体型与身高','character-shape-panel',null],['face','面部微控与表情','face-panel',null],['skin','皮肤与肤色','skin-panel',null],['biology','人体知识、绑定与环境','human-biology-panel',null],['npc','角色与任务定义','npc-panel',null],['strength','能力估算与状态','strength-panel','strength-open'],['hair','头发','hair-panel','hair-open'],['view','人体、分区与关节显示','whole-body-controls',null]];
 for(const [key,label,id,trigger]of entries){const panel=document.getElementById(id);if(!panel)continue;panel.hidden=true;content.append(panel);panels.set(key,{panel,trigger,label});
  const button=document.createElement('button');button.textContent=label;button.onclick=()=>api.open(key);home.append(button);
 }
 let returnFocus=null;
 const reset=()=>{for(const {panel,trigger}of panels.values()){panel.hidden=true;if(trigger)document.getElementById(trigger)?.setAttribute('aria-expanded','false');}home.hidden=false;el('back').hidden=true;el('title').textContent='人物设置';};
 const api={open(key=null){if(drawer.hidden)returnFocus=document.activeElement;reset();drawer.hidden=false;open.setAttribute('aria-expanded','true');
   const item=panels.get(key);if(item){home.hidden=true;el('back').hidden=false;el('title').textContent=item.label;if(item.trigger)document.getElementById(item.trigger)?.click();if(key==='biology')lab.biology?.refresh();item.panel.hidden=false;}
   el('close').focus();
  },close(){reset();drawer.hidden=true;open.setAttribute('aria-expanded','false');if(returnFocus?.isConnected)returnFocus.focus();},get active(){return !drawer.hidden;}};
 open.onclick=()=>drawer.hidden?api.open():api.close();el('close').onclick=()=>api.close();el('back').onclick=reset;
 drawer.addEventListener('click',e=>{if(['npc-close','hair-close'].includes(e.target.id))reset();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!drawer.hidden){e.preventDefault();e.stopPropagation();api.close();}});
 return api;
}
