const preparedHeads=new Map();
async function prepareHead(index,ctx){
 if(preparedHeads.has(index))return preparedHeads.get(index);
 phase(ctx,'读取内置头形');const h=await readHead(index),g=await waitWithSignal(decodeGeometry(h).then(g=>{if(ctx.signal.aborted){g.dispose();throw ctx.signal.reason||aborted();}return g;}),ctx.signal);
 try{
  guard(ctx.signal);phase(ctx,'在线程中测量头形');
  const {profile}=await compute('head',{position:g.attributes.position.array,index:g.index.array},{signal:ctx.signal});guard(ctx.signal);
  const value={geometry:g,profile};preparedHeads.set(index,value);headProfiles.set(index,profile);
  while(preparedHeads.size>4){const k=[...preparedHeads.keys()].find(k=>k!==index&&preparedHeads.get(k).geometry!==person?.geometry);if(k===undefined)break;preparedHeads.get(k).geometry.dispose();preparedHeads.delete(k);headProfiles.delete(k);}
  return value;
 }catch(e){g.dispose();throw e;}
}
function commitHead(index,prepared,view){
 if(person)person.geometry=prepared.geometry;
 else{person=new T.Mesh(prepared.geometry,new T.MeshStandardMaterial({color:0xc8bdae,roughness:.72}));person.castShadow=true;person.receiveShadow=true;person.name='Unmodified target head in declared measurement frame';stage.add(person);}
 person.visible=view==='wear';
}
async function headGeometry(index=state.head,fitState={...state,head:index},candidateAsset=asset){
 const ctx={signal:new AbortController().signal,title:D.native.heads[index]?.title||'头形'};
 if(activeSelection)activeSelection.controller.abort(aborted());
 const p=await prepareHead(index,ctx);if(candidateAsset)await prepareAssetFit(candidateAsset,fitState,p.profile,ctx);
 commitHead(index,p,fitState.view);state.head=index;return true;
}
function cancelSelection(){
 const ctx=activeSelection;if(!ctx)return;ctx.controller.abort(aborted());activeSelection=null;busy=false;
 document.querySelectorAll('.hat-card').forEach(b=>b.removeAttribute('data-pending'));$('cancel-load').hidden=true;
 message('已取消待切换任务；当前帽子保留，可继续选择');event('cancel',ctx.id);
}
function select(id,settings=null){
 const meta=D.hats.find(x=>x.id===id);if(!meta)return Promise.reject(Error('未知帽型；保留当前对象'));
 const signature=JSON.stringify([id,settings]);
 if(activeSelection?.signature===signature){event('deduplicated-click',id);return activeSelection.promise;}
 if(activeSelection){activeSelection.controller.abort(aborted());event('superseded',activeSelection.id,{next:id});}
 stopDetail();
 const controller=new AbortController(),ctx={controller,signal:controller.signal,signature,id,title:meta.title,started:performance.now(),stage:'准备切换',promise:null};
 activeSelection=ctx;lastRequested={id,settings};busy=true;compare=false;$('compare').classList.remove('holding');
 document.querySelectorAll('.hat-card').forEach(b=>b.toggleAttribute('data-pending',b.dataset.id===id));$('cancel-load').hidden=false;
 event('request',id);phase(ctx,'准备切换');
 const timeout=setTimeout(()=>controller.abort(new Error('本次准备超过25秒，已停止；请重试或直接选择其他帽子')),25000);
 ctx.promise=(async()=>{
  let a=null;const switchStart=ctx.started,t=++token;let fromCache=false,loadEnd=switchStart;
  if(asset)recipesByHat.set(state.id,{...state});
  const candidate=settings||{...DEFAULT,...subtypeDefaults(id),...(recipesByHat.get(id)||{}),id,view:state.view,head:state.head,light:state.light};
  try{
   await waitWithSignal(new Promise(r=>setTimeout(r,0)),ctx.signal);guard(ctx.signal);
   const prepared=await prepareHead(candidate.head,ctx);guard(ctx.signal);
   a=acquireCached(id);fromCache=!!a;
   if(!a)a=await loadAsset(meta,candidate,prepared.profile,ctx);else await prepareAssetFit(a,candidate,prepared.profile,ctx);
   guard(ctx.signal);loadEnd=performance.now();phase(ctx,'提交新帽子');
   const old=asset,oldHat=hat;commitHead(candidate.head,prepared,candidate.view);asset=a;state=candidate;
   hat=a.object||new T.Mesh(a.geometry,a.material);a.object=hat;hat.name=id;hat.castShadow=true;hat.receiveShadow=true;
   stage.add(hat);if(oldHat&&oldHat!==hat)stage.remove(oldHat);if(old&&old!==a)retainAsset(old);
   apply();frame();ready=true;$('loading').hidden=true;$('title').textContent=meta.title;$('eyebrow').textContent=`${meta.category} / ${id.toUpperCase()}`;
   $('source-note').textContent=`原帽型 / 贴图：${meta.author} · ${meta.licence}。控制网驱动程序生成与量配；原色内置，高清表面独立加载。`;
   $('teacher-image').src=meta.teacherThumbnail;$('teacher-link').href=meta.referenceURL;updateQuality();
   document.querySelectorAll('.hat-card').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));
   const url=new URL(location.href);if(url.search.startsWith('?https://'))url.hash='hat='+id;else url.searchParams.set('hat',id);try{history.replaceState(null,'',url);}catch{}
   persist();render();const preparedMS=performance.now()-switchStart;
   lastSwitch={id,cacheHit:fromCache,loadMS:loadEnd-switchStart,prepareMS:preparedMS,firstFrameMS:preparedMS,workerMS:a.workerMS||0,originalColorReady:true,detailReady:!!a.maps.normal};
   switchHistory.push(lastSwitch);if(switchHistory.length>64)switchHistory.shift();event('shown',id,{wallMS:preparedMS});
   message(saveWarning||`${meta.title}已显示 · ${fromCache?'缓存复用':'程序生成'} ${Math.round(preparedMS)} ms · 拖动旋转 / 滚轮拉近`);
   queueDetail(a);return metrics();
  }catch(e){
   if(a&&a!==asset&&!a.disposed)retainAsset(a);
   if(ctx.signal.aborted&&ctx.signal.reason?.name==='AbortError')return null;
   if(activeSelection===ctx){event('failed',id,{message:e.message});message(e.message+'；旧帽子保留，可重试或直接换帽。',true);}
   throw e;
  }finally{
   clearTimeout(timeout);
   if(activeSelection===ctx){activeSelection=null;busy=false;document.querySelectorAll('.hat-card').forEach(b=>b.removeAttribute('data-pending'));$('cancel-load').hidden=true;}
  }
 })();return ctx.promise;
}
