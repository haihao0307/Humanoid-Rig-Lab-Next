/* Versioned NPC authoring definitions. This adapter previews one entity; it
 * does not claim that the document-global prototype is a crowd runtime. */
const NPC_CONTRACT=Object.freeze({schema:'jarvis/npc_definition@1',bodyAssetFamily:'procedural-human@1',rigProfile:'adult175-r9',motionProfile:'humanoid@1',behaviorProfile:'task-agent@1'});
const npcCopy=v=>JSON.parse(JSON.stringify(v));
function npcFreeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(npcFreeze);Object.freeze(value);}return value;}
function validateNPCDefinition(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('NPC 定义必须是对象');
 const allowed=[...Object.keys(NPC_CONTRACT),'character','attachments'];
 if(Object.keys(input).some(k=>!allowed.includes(k)))throw Error('NPC 定义含未知字段');
 for(const [key,value]of Object.entries(NPC_CONTRACT))if(input[key]!=null&&input[key]!==value)throw Error('NPC 版本或兼容性不符：'+key);
 const character=validateCharacterPreset(input.character||{});
 // A reusable definition stores capacity, not another instance's fatigue.
 character.strength=new StrengthModel(character.strength.profile).export();
 character.biology=validateBiologySnapshot({environment:character.biology.environment});
 const slots=input.attachments??{hair:{assetId:'builtin/short-hair-v1',enabled:true},outfit:[],accessories:[]};
 if(!slots||typeof slots!=='object'||Array.isArray(slots)||Object.keys(slots).some(k=>!['hair','outfit','accessories'].includes(k)))throw Error('NPC 外观部件格式无效');
 const hair=slots.hair??{assetId:null,enabled:false};
 if(!hair||typeof hair!=='object'||Array.isArray(hair)||Object.keys(hair).some(k=>!['assetId','enabled'].includes(k))||typeof hair.enabled!=='boolean'||(hair.assetId!==null&&(typeof hair.assetId!=='string'||!/^[-a-zA-Z0-9_/.@]{1,96}$/.test(hair.assetId))))throw Error('发型引用格式无效');
 const refs=key=>{const list=slots[key]??[];if(!Array.isArray(list)||list.length>16||list.some(v=>typeof v!=='string'||!/^[-a-zA-Z0-9_/.@]{1,96}$/.test(v))||new Set(list).size!==list.length)throw Error('部件引用格式无效：'+key);return [...list];};
 return {...NPC_CONTRACT,character,attachments:{hair:{...hair},outfit:refs('outfit'),accessories:refs('accessories')}};
}
function installNPCDefinitionAPI(lab){
 const definitions=new Map();let activeDefinition=null;
 const api={
  capabilities:()=>({previewInstances:1,bodySex:['male','female'],archetypeRevision:2,compositionDrivesGeometry:true,morphs:Object.keys(CHARACTER_MORPH_LIMITS),arbitraryStature:false,crowdRuntime:false,attachmentAssets:['builtin/short-hair-v1']}),
  define(input,{replace=false}={}){const d=validateNPCDefinition(input),id=d.character.id;if(definitions.has(id)&&!replace)throw Error('NPC 定义 ID 已存在：'+id);definitions.set(id,npcFreeze(d));return npcCopy(d);},
  list:()=>[...definitions.values()].map(d=>({id:d.character.id,label:d.character.label,bodySex:d.character.bodySex,seed:d.character.seed})),
  get(id){if(!definitions.has(id))throw Error('NPC 定义不存在：'+id);return npcCopy(definitions.get(id));},
  geometryKey(id){const d=typeof id==='string'?api.get(id):validateNPCDefinition(id),p=d.character;return JSON.stringify([d.bodyAssetFamily,d.rigProfile,p.bodySex,p.statureM,BODY_ARCHETYPES[p.bodySex].id,characterCompositionKey(p),validateSkinLayerSettings(p.appearance.skinLayers),Object.keys(CHARACTER_MORPH_LIMITS).map(k=>[k,p.appearance.morphs[k]])]);},
  derive(id,seed,newId){if(typeof newId!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(newId))throw Error('派生角色需要新的有效 ID');const d=api.get(id);d.character=seededCharacterPreset(seed,d.character);d.character.id=newId;d.character.label=definitions.get(id).character.label+' · '+seed;return api.define(d);},
  export(){const p=lab.character.export(),hair=lab.hair;return validateNPCDefinition({...NPC_CONTRACT,character:p,attachments:{...(activeDefinition?.attachments||{outfit:[],accessories:[]}),hair:{assetId:hair?'builtin/short-hair-v1':null,enabled:!!hair?.enabled}}});},
  createSpawnRecord(definitionId,instanceId){
   if(typeof instanceId!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(instanceId))throw Error('NPC 实例 ID 无效');
   const definition=api.get(definitionId);
   return {schema:'jarvis/npc_spawn_record@1',instanceId,definitionId,definition,
    state:{schema:'jarvis/npc_runtime_state@1',strength:npcCopy(definition.character.strength.state),biology:npcCopy(definition.character.biology),task:{status:'idle',command:definition.character.task.command},pose:null},instantiated:false};
  },
  async preview(input){
   const d=typeof input==='string'?api.get(input):validateNPCDefinition(input),slots=d.attachments;
   if(slots.outfit.length||slots.accessories.length||(slots.hair.assetId!==null&&slots.hair.assetId!=='builtin/short-hair-v1'))throw Error('当前预览器尚未安装定义中引用的外观部件');
   if(d.character.bodySex!==lab.human.bodySex||characterRigSignature(d.character)!==ADULT_SPEC.rigShapeSignature){switchBodyPreset(d.character.bodySex,d.character,d,true);return {reloading:true};}
   const result=await lab.character.apply(d.character);if(result?.reloading)return result;activeDefinition=d;
   if(lab.hair){lab.hair.enabled=slots.hair.enabled;lab.hair.refreshControls?.();}
   api.define(d,{replace:true});needsRedraw=true;lab.render();return api.export();
  }
 };
 for(const sex of ['male','female'])api.define({character:{id:'base-'+sex,label:sex==='female'?'女性母版':'男性母版',bodySex:sex,appearance:{morphs:defaultCharacterMorphs(sex)}}});
 const initial=window.__BODY_PRESET_STATE__?.npc||window.__NPC_DEFINITION__;
 if(initial){const d=validateNPCDefinition(initial);activeDefinition=d;api.define(d,{replace:true});if(lab.hair){lab.hair.enabled=d.attachments.hair.enabled;lab.hair.refreshControls?.();}}
 installNPCDefinitionControls(lab,api);return api;
}
function installNPCDefinitionControls(lab,api){
 const style=document.createElement('style');style.textContent='#npc-open{position:fixed;right:16px;bottom:108px;z-index:94;padding:8px 14px;border:1px solid #719ca8;border-radius:8px;background:#142c36;color:#eef7fa}#npc-panel{position:fixed;right:16px;bottom:150px;z-index:97;width:310px;max-width:calc(100vw - 48px);max-height:68vh;overflow:auto;padding:16px;border:1px solid #7299a6;border-radius:12px;background:#10252ff5;color:#e7f2f5;font:13px/1.6 system-ui}#npc-panel[hidden]{display:none}#npc-panel label{display:block;margin:7px 0}#npc-panel input,#npc-panel select{max-width:160px;float:right}#npc-panel button{margin:5px 5px 5px 0;padding:7px 10px}#npc-panel h3{margin:0}#npc-panel p{color:#bbced6}#npc-status{display:block;clear:both}';document.head.append(style);
 const open=document.createElement('button');open.id='npc-open';open.textContent='NPC 母体';open.setAttribute('aria-expanded','false');open.setAttribute('aria-controls','npc-panel');document.body.append(open);
 const panel=document.createElement('section');panel.id='npc-panel';panel.hidden=true;panel.setAttribute('aria-label','NPC 母体与角色定义');
 panel.innerHTML='<h3>NPC 母体</h3><p>从男女母版派生角色，分别保存体型、外观与能力配置。</p><label>母版 <select id="npc-sex"><option value="male">男性</option><option value="female">女性</option></select></label><label>角色 ID <input id="npc-id" maxlength="64"></label><label>角色名称 <input id="npc-label" maxlength="80"></label><label>变化种子 <input id="npc-seed" type="number" min="0" max="4294967295" step="1"></label><div id="npc-morphs"></div><button id="npc-apply">应用骨架与形体</button><button id="npc-derive">按种子派生</button><button id="npc-export">导出角色</button><label>导入角色 <input id="npc-import" type="file" accept=".json,application/json"></label><p>当前预览一个 175 cm 成人。多人场景使用独立实例状态；批量运行器尚未接入。</p><button id="npc-close">收起</button><output id="npc-status" role="status"></output>';
 document.body.append(panel);const el=id=>panel.querySelector('#npc-'+id),labels={shoulderWidth:'肩部宽度',chestWidth:'胸廓宽度',waistWidth:'腰部宽度',hipWidth:'髋部宽度',neckWidth:'颈部宽度',limbVolume:'四肢覆盖厚度',softness:'软组织厚度',breastProjectionM:'胸部投影（m）',faceWidth:'面部宽度'};
 for(const [key,[min,max]]of Object.entries(CHARACTER_MORPH_LIMITS)){const label=document.createElement('label');label.textContent=labels[key];const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step=key==='breastProjectionM'?.001:.01;input.dataset.morph=key;label.append(input);el('morphs').append(label);}
 let draft=api.export();const sync=()=>{const p=draft.character;el('sex').value=p.bodySex;el('id').value=p.id;el('label').value=p.label;el('seed').value=p.seed;for(const input of panel.querySelectorAll('[data-morph]'))input.value=p.appearance.morphs[input.dataset.morph];};
 const read=()=>{const d=npcCopy(draft),p=d.character;p.bodySex=el('sex').value;p.bodyArchetype=BODY_ARCHETYPES[p.bodySex].id;p.id=el('id').value;p.label=el('label').value;p.seed=Number(el('seed').value);p.appearance.morphs=Object.fromEntries([...panel.querySelectorAll('[data-morph]')].map(i=>[i.dataset.morph,Number(i.value)]));return validateNPCDefinition(d);};
 const action=async fn=>{const controls=[...panel.querySelectorAll('button,input,select')];controls.forEach(c=>c.disabled=true);try{await fn();el('status').textContent='角色定义已更新。';}catch(e){el('status').textContent=e.message;}finally{controls.forEach(c=>c.disabled=false);}};
 open.onclick=()=>{panel.hidden=!panel.hidden;open.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){draft=api.export();sync();}};el('close').onclick=()=>{panel.hidden=true;open.setAttribute('aria-expanded','false');};
 el('sex').onchange=()=>{try{draft=read();draft.character.appearance.morphs=defaultCharacterMorphs(draft.character.bodySex);draft.character.strength=new StrengthModel(makeCharacterStrengthProfile(draft.character.bodySex)).export();draft.character.id='base-'+draft.character.bodySex;draft.character.label=draft.character.bodySex==='female'?'女性母版':'男性母版';sync();}catch(e){el('status').textContent=e.message;}};
 el('apply').onclick=()=>action(async()=>{draft=read();await api.preview(draft);sync();});
 el('derive').onclick=()=>action(async()=>{draft=read();draft.character=seededCharacterPreset(draft.character.seed,draft.character);await api.preview(draft);sync();});
 el('export').onclick=()=>action(()=>{const d=read();hfDownload(d.character.id+'.npc.json',JSON.stringify(d,null,2),'application/json');});
 el('import').onchange=()=>action(async()=>{const file=el('import').files[0];try{if(!file||file.size>262144)throw Error('角色文件为空或过大');const data=JSON.parse(await file.text());draft=data.schema==='jarvis/npc_definition@1'?validateNPCDefinition(data):validateNPCDefinition({character:data});await api.preview(draft);sync();}finally{el('import').value='';}});
 sync();
}
function restoreNPCPreview(lab){
 const state=window.__BODY_PRESET_STATE__,name=state?.studio;
 if(!['hands','shoulders','headNeck'].includes(name))return;
 const w=lab[name];w.enter();if(['skin','clay','bones','structure','support','muscle'].includes(state.mode))w.mode=state.mode;
 if(['front','back','side','threequarter','full','body','palm','dorsal'].includes(state.view))w.view(state.view);
}
