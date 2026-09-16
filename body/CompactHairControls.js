// Profile edits use the serialized reconstruction queue. Old hair stays visible
// while the Worker runs; the character definition commits only after success.
function installReconstructionHair(lab){
 // Reproducible local visual review without pointer or keyboard interaction.
 const reviewViews=['front','side','left','back','rear-side','three-quarter'];let reviewView=null,reviewReady=false,reviewSerial=Promise.resolve();
 try{const value=new URLSearchParams(window.parent.location.search).get('hair-review');if(reviewViews.includes(value))reviewView=value;}catch{}
 const api={enabled:true,windEnabled:false,windSpeed:0,dirty:false,inStudio:()=>reviewView!==null,
  export:()=>validateHairProfile(lab.human.characterPreset.appearance.hair,lab.human.characterPreset.seed,HAIR_CATALOG),
  async prepare(input){
   const profile=validateHairProfile(input,lab.human.characterPreset.seed,HAIR_CATALOG);
   if(!lab.compact||lab.compact.disposed)throw Error('请等待人物身体加载完成');
   if(lab.compactQualityPending)throw Error('人物细节正在更新，请完成后再更换毛发');
   if(lab.hairTask)await lab.hairTask.catch(()=>{});
   if(lab.compactQualityPending)throw Error('人物细节正在更新，请完成后再更换毛发');
   const requestSurface=lab.compact,current=requestSurface.hair,shapeKey=p=>JSON.stringify([p.preset,p.seed,p.density,p.lengthScale,p.quality]);
   if(current&&current.report.shape&&sameCharacterShape(current.report.shape,lab.human.characterPreset.shape)&&shapeKey(current.report.profile)===shapeKey(profile))return ()=>{
    if(lab.compact!==requestSurface||requestSurface.disposed)throw Error('人物已更新，旧毛发设置已丢弃');
    current.setColor(profile.color);current.report.profile=profile;lab.hairStatus={state:'ready'};
   };
   const task=loadCompactSurface('preview',true,null,'hair',profile,lab.human.characterPreset.shape);lab.hairTask=task;lab.hairStatus={state:'loading'};
   try{const data=await task;return ()=>{
     if(requestSurface.disposed||lab.compact!==requestSurface)throw Error('人物已更新，旧毛发结果已丢弃');
     requestSurface.attachHair(data.hair);lab.hairStatus={state:'ready'};publishCompactProgress({group:'ready',state:'ready'});
    };
   }catch(error){lab.hairStatus={state:'failed',error:error.message};throw error;}
   finally{if(lab.hairTask===task)lab.hairTask=null;}
  },
  async apply(profile){const character=lab.character.export();return lab.character.apply({...character,appearance:{...character.appearance,hair:profile}});},
  update(dt){lab.compact?.hair?.update(dt);},reset(){if(lab.compact?.hair)lab.compact.hair.time=0;needsRedraw=true;},
  report:()=>({...lab.compact?.hair?.report,enabled:api.enabled,activeRibbons:lab.compact?.hair?.activeStrands??0,lod:lab.compact?.hair?.lod,visualAcceptance:false}),
  restoreReviewCamera(){if(reviewView){api.closeup(reviewView);reviewReady=true;applyReviewLocation();}},
  closeup(view='front'){lab.setCameraFollow(false);const r=lab.renderer;r.target=add(lab.human.world('head').p,[0,.075,.02]);r.distance=reviewView?.56:.7;r.projection='perspective';r.pitch=.04;r.yaw=lab.agent.yaw+({side:Math.PI/2,left:-Math.PI/2,back:Math.PI,'rear-side':Math.PI*.72,'three-quarter':-Math.PI*.23}[view]||0);needsRedraw=true;},
  refreshControls(){const p=api.export();el('enabled').checked=api.enabled;for(const k of ['preset','seed','color','density','lengthScale','quality'])el(k).value=p[k];}
 };
 const panel=document.createElement('section');panel.id='hair-panel';panel.hidden=true;
 panel.innerHTML=`<h3>毛发与种子</h3><p>预设、种子和发色会随角色保存。更换种子保留发型，调整发束细节。</p>
  <label><input id="hair-enabled" type="checkbox" checked>显示毛发</label>
  <label>发型 <select id="hair-preset"></select></label>
  <label>种子 <input id="hair-seed" type="number" min="0" max="4294967295" step="1"></label><button id="hair-next">下一个种子</button>
  <label>发色 <input id="hair-color" type="color"></label>
  <label>密度 <input id="hair-density" type="number" min=".45" max="1.3" step=".05"></label>
  <label>长度比例 <input id="hair-lengthScale" type="number" min=".65" max="1.35" step=".05"></label>
  <label>开销 <select id="hair-quality"></select></label><p>远景会自动减少细节。精细档适合查看头部。</p>
  <button id="hair-apply">应用毛发</button><button id="hair-defaults">恢复预设参数</button>
  <label><input id="hair-wind" type="checkbox">轻微风动</label><label>风速 <input id="hair-speed" type="range" min="0" max="8" step=".1" value="0"><span id="hair-speed-value">0.0 m/s</span></label>
  <button id="hair-head">头部近景</button><output id="hair-status" role="status" aria-live="polite"></output>`;
 document.body.append(panel);const el=id=>panel.querySelector('#hair-'+id);
 for(const group of ['短发','中长发','扎发','无头发']){const options=document.createElement('optgroup');options.label=group;
  for(const p of HAIR_CATALOG.presets.filter(p=>(p.group||(p.id==='bald'?'无头发':'短发'))===group)){const option=document.createElement('option');option.value=p.id;option.textContent=p.label;options.append(option);}el('preset').append(options);
 }
 for(const [id,p]of Object.entries(HAIR_CATALOG.qualities)){const option=document.createElement('option');option.value=id;option.textContent=p.label;el('quality').append(option);}
 const defaults=()=>{const p=HAIR_CATALOG.presets.find(p=>p.id===el('preset').value);el('seed').value=p.seed;el('color').value=p.color;el('density').value=1;el('lengthScale').value=1;};
 el('preset').onchange=defaults;el('defaults').onclick=defaults;
 el('next').onclick=()=>{el('seed').value=(Number(el('seed').value)+1)>>>0;};
 el('apply').onclick=async()=>{
  el('apply').disabled=true;el('status').textContent='正在应用毛发…';
  try{await api.apply({preset:el('preset').value,seed:Number(el('seed').value),color:el('color').value,density:Number(el('density').value),lengthScale:Number(el('lengthScale').value),quality:el('quality').value});el('status').textContent='已保存到当前角色。';}
  catch(error){el('status').textContent=error.message;}
  finally{el('apply').disabled=false;}
 };
 el('enabled').onchange=e=>{api.enabled=e.target.checked;needsRedraw=true;};
 el('wind').onchange=e=>{api.windEnabled=e.target.checked;needsRedraw=true;};
 el('speed').oninput=e=>{api.windSpeed=Number(e.target.value);el('speed-value').textContent=api.windSpeed.toFixed(1)+' m/s';needsRedraw=true;};
 const reviewStatus=reviewView?document.createElement('output'):null;
 if(reviewStatus){reviewStatus.id='hair-review-status';reviewStatus.style.cssText='position:fixed;left:12px;bottom:12px;z-index:90;background:#10232ed9;color:#e6f1fa;padding:7px 12px;border-radius:6px;font:12px sans-serif;pointer-events:none';document.body.append(reviewStatus);reviewStatus.textContent='发型审阅 · 等待人物就绪';}
 // QA changes only via an explicit review URL. Normal sessions have no listener.
 function applyReviewLocation(){
  if(!reviewReady)return;
  const params=new URLSearchParams(window.parent.location.hash.slice(1)),preset=params.get('hair-preset'),view=params.get('hair-view');
  reviewSerial=reviewSerial.then(async()=>{
   try{
    if(preset){const p=HAIR_CATALOG.presets.find(p=>p.id===preset);if(!p)throw Error('未知审阅发型');
     if(api.export().preset!==preset){reviewStatus.textContent='发型审阅 · 生成 '+p.label;await api.apply({preset:preset,seed:p.seed,color:p.color,quality:'economy'});}
    }
    if(reviewViews.includes(view))reviewView=view;api.closeup(reviewView);api.refreshControls();
    const p=api.export(),r=api.report();reviewStatus.textContent='发型审阅 · 就绪 · '+HAIR_CATALOG.presets.find(x=>x.id===p.preset).label+' · '+reviewView+' · '+r.strands+' 束 · '+r.geometryBytes+' B';
   }catch(error){reviewStatus.textContent='发型审阅 · 失败 · '+error.message;}
  });
 }
 if(reviewView)window.parent.addEventListener('hashchange',applyReviewLocation);
 el('head').onclick=()=>api.closeup();api.refreshControls();if(reviewView){auto=false;api.closeup(reviewView);}return api;
}
