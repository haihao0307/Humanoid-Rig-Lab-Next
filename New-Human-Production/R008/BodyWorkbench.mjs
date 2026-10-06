import {BODY_DEFAULT,BODY_CONTROLS,BODY_PRESETS,normalizeBody,bodyCoefficients} from './BodyParameters.mjs';
export function createBodyWorkbench({apply,getReport}){
 const storage='human.r008.body.v1',panel=document.createElement('details');panel.id='bodyPanel';panel.open=true;let recipe=normalizeBody(),desired,pending=null,scheduled=false,busy=false,waiters=[];
 try{const raw=localStorage.getItem(storage);if(raw)recipe=normalizeBody(JSON.parse(raw));}catch{}desired={...recipe};
 panel.innerHTML=`<summary>全身组织量与年龄 · 实时</summary><label>体型示例<select id="bodyPreset"><option value="custom">自定义</option>${Object.entries(BODY_PRESETS).map(([id,p])=>`<option value="${id}">${p.label}</option>`).join('')}</select></label>${BODY_CONTROLS.map(c=>`<label>${c.label} <output id="body-${c.key}-value"></output><input id="body-${c.key}" aria-label="${c.label}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" style="width:100%"></label>`).join('')}<button id="bodyReset">恢复原人物</button><small>拖动即预览。脂肪与肌肉分别改变全身组织量，手足与头面响应较小；同一人物骨长保持不变。肌肉滑块表示同龄相对水平，年龄可改变有效组织量。当前为成人造型估计，不是实测体脂率或肌肉重量。请落地后调整。</small><p id="bodyMessage" role="status"></p>`;
 document.querySelector('#surfacePanel').before(panel);const $=id=>panel.querySelector('#'+id);
 function refresh(){for(const c of BODY_CONTROLS){$('body-'+c.key).value=desired[c.key];$('body-'+c.key+'-value').value=c.key==='height'?(desired[c.key]*100).toFixed(0)+' cm':c.key==='age'?desired[c.key].toFixed(0)+' 岁':desired[c.key].toFixed(2);}}
 function schedule(){if(scheduled||busy||!pending)return;scheduled=true;requestAnimationFrame(flush);}
 async function flush(){scheduled=false;if(!pending)return;const next=pending,list=waiters;pending=null;waiters=[];busy=true;
  try{await apply(next);recipe=next;try{localStorage.setItem(storage,JSON.stringify(recipe));}catch{}$('bodyMessage').textContent=`实时预览 · ${Math.round(recipe.height*100)} cm · ${recipe.age} 岁 · 上臂肌肉约为基准 ${Math.exp(bodyCoefficients(recipe)[1]).toFixed(2)} 倍${Math.abs(recipe.fatness)>.8||Math.abs(recipe.muscle)>.8?' · 极端体型为候选，肩臂及衣物接触尚未验收':''}`;for(const w of list)w.resolve({...recipe});}
  catch(e){if(!pending){desired={...recipe};refresh();}$('bodyMessage').textContent=e.message;for(const w of list)w.reject(e);}
  finally{busy=false;schedule();}
 }
 function set(patch){let next;try{next=normalizeBody({...desired,...patch});}catch(e){return Promise.reject(e);}desired=next;pending=next;refresh();const result=new Promise((resolve,reject)=>waiters.push({resolve,reject}));schedule();return result;}
 for(const c of BODY_CONTROLS)$('body-'+c.key).oninput=()=>{const value=Number($('body-'+c.key).value);$('bodyPreset').value='custom';set({[c.key]:value}).catch(()=>{});};
 $('bodyReset').onclick=()=>{$('bodyPreset').value='reference';set(BODY_DEFAULT).catch(()=>{});};$('bodyPreset').onchange=()=>{if($('bodyPreset').value==='custom')return;set({...BODY_DEFAULT,...BODY_PRESETS[$('bodyPreset').value].recipe}).catch(()=>{});};refresh();
 return {set,restore:r=>set(normalizeBody(r)),export:()=>({...recipe}),preset:id=>{if(!Object.hasOwn(BODY_PRESETS,id))throw Error('未知体型示例');return set({...BODY_DEFAULT,...BODY_PRESETS[id].recipe});},bind:()=>apply(recipe,{bind:true}),get busy(){return busy||scheduled;},get report(){return getReport();}};
}
