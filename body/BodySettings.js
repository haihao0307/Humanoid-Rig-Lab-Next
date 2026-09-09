/* One user-invoked drawer. The existing editors keep their handlers and state. */
function installBodySettings(lab){
 lab.biology=installHumanBiology(lab);
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
 #body-settings #npc-panel,#body-settings #strength-panel,#body-settings #hair-panel,#body-settings #body-preset-control,#body-settings #whole-body-controls{position:static!important;width:100%!important;max-width:100%!important;max-height:none!important;box-sizing:border-box;margin:0!important;box-shadow:none!important;padding:10px!important}
 #body-settings #body-preset-control{display:block}#body-settings .settings-hint{font-size:12px;color:#5c7567}
 `;document.head.append(style);
 const open=document.createElement('button');open.id='body-settings-open';open.textContent='人物设置';open.setAttribute('aria-expanded','false');open.setAttribute('aria-controls','body-settings');open.hidden=window.parent!==window;
 const drawer=document.createElement('section');drawer.id='body-settings';drawer.hidden=true;drawer.setAttribute('aria-label','人物设置');
 drawer.innerHTML='<header><button id="body-settings-back" hidden>返回</button><h2 id="body-settings-title">人物设置</h2><button id="body-settings-close">关闭</button></header><div id="body-settings-home"></div><div id="body-settings-content"></div>';
 document.body.append(open,drawer);const el=id=>drawer.querySelector('#body-settings-'+id),home=el('home'),content=el('content');
 const panels=new Map(),entries=[['biology','人体知识、绑定与环境','human-biology-panel',null],['npc','母体、骨架与体型','npc-panel','npc-open'],['skin','皮肤外形、厚度与分层','skin-layer-panel',null],['strength','肌量、力量与状态','strength-panel','strength-open'],['hair','头发','hair-panel','hair-open'],['view','图层与显示','whole-body-controls',null]];
 const sex=document.getElementById('body-preset-control');if(sex){home.append(sex);sex.hidden=false;}
 for(const [key,label,id,trigger]of entries){const panel=document.getElementById(id);if(!panel)continue;panel.hidden=true;content.append(panel);panels.set(key,{panel,trigger,label});
  const button=document.createElement('button');button.textContent=label;button.onclick=()=>api.open(key);home.append(button);
 }
 const details=document.createElement('details');details.innerHTML='<summary>部位与姿态编辑</summary>';home.append(details);
 for(const [id,label]of [['hf-open','手与前臂'],['sh-open','肩带与上臂'],['tr-open','躯干'],['hn-open','头颈'],['ll-open','臀腿与足部']]){
  const button=document.createElement('button');button.textContent=label;button.onclick=()=>{api.close();document.getElementById(id)?.click();};details.append(button);
 }
 let returnFocus=null;
 const reset=()=>{for(const {panel,trigger}of panels.values()){panel.hidden=true;if(trigger)document.getElementById(trigger)?.setAttribute('aria-expanded','false');}home.hidden=false;el('back').hidden=true;el('title').textContent='人物设置';};
 const api={open(key=null){if(drawer.hidden)returnFocus=document.activeElement;reset();drawer.hidden=false;open.setAttribute('aria-expanded','true');
   const item=panels.get(key);if(item){home.hidden=true;el('back').hidden=false;el('title').textContent=item.label;if(item.trigger)document.getElementById(item.trigger)?.click();if(key==='skin')lab.skinLayers?.sync();if(key==='biology')lab.biology?.refresh();item.panel.hidden=false;}
   el('close').focus();
  },close(){reset();drawer.hidden=true;open.setAttribute('aria-expanded','false');if(returnFocus?.isConnected)returnFocus.focus();},get active(){return !drawer.hidden;}};
 open.onclick=()=>drawer.hidden?api.open():api.close();el('close').onclick=()=>api.close();el('back').onclick=reset;
 drawer.addEventListener('click',e=>{if(['npc-close','hair-close'].includes(e.target.id))reset();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!drawer.hidden){e.preventDefault();e.stopPropagation();api.close();}});
 return api;
}
