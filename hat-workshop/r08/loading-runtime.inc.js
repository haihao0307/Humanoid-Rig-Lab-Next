function solveAsset(a,s,hp){const key=fitSignature(s,hp),result=a.fitResults?.get(key);if(!result)throw Error('当前头形尚未在线程中完成适配，请重新选择本款');return result;}
function cacheReport(){return {idleAssets:assetCache.size,maxIdleAssets:CACHE_LIMIT,estimatedIdleBytes:[...assetCache.values()].reduce((n,a)=>n+estimateAsset(a),0),byteLimit:CACHE_BYTES,packageEntries:dataCache.size,lastSwitch,history:[...switchHistory],worker:workerStats(),activeSelection:activeSelection?{id:activeSelection.id,stage:activeSelection.stage,elapsedMS:performance.now()-activeSelection.started}:null,selectionEvents:[...selectionEvents],networkRequiredForSwitch:false,detailState:asset?.detailState||'none'};}
function lightMeta(meta){const {textures,renderedThumbnail,teacherThumbnail,...rest}=meta;return rest;}
function event(kind,id,extra={}){selectionEvents.push({kind,id,at:performance.now(),...extra});if(selectionEvents.length>64)selectionEvents.shift();}
function phase(ctx,text){guard(ctx.signal);ctx.stage=text;if(activeSelection===ctx){message(text+' · '+ctx.title);const el=$('load-stage');if(el)el.textContent=text;}}
function detailMessage(text){if($('detail-status'))$('detail-status').textContent=text;}
function stopDetail(){if(detailJob){detailJob.abort();detailJob=null;}}
function queueDetail(a){
 stopDetail();
 if(a.maps.normal){a.detailState='ready';detailMessage('原始高清表面已就绪');return;}
 if(!a.meta.normalSource){a.detailState='not-required';detailMessage('本款原色与材质已完整显示');return;}
 const controller=new AbortController();detailJob=controller;a.detailState='waiting';
 detailMessage('帽形与原色已显示；高清表面独立准备，不影响换帽');
 setTimeout(async()=>{
  let url=null,t=null;
  try{
   guard(controller.signal);a.detailState='loading';
   const bytes=await fetchDetail(a.meta.normalSource,{signal:controller.signal,onProgress:(done,total,stage)=>{if(asset===a&&!controller.signal.aborted)detailMessage(`${stage} ${Math.round(done/1024)} / ${Math.round(total/1024)} KB · 可随时换帽`);}});
   guard(controller.signal);url=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));
   t=await localTexture(url,'normal',controller.signal);guard(controller.signal);
   if(a.disposed||asset!==a){t.dispose();return;}
   a.maps.normal=t;a.material.normalMap=t;a.material.needsUpdate=true;a.detailState='ready';syncUI();requestRender();detailMessage('原始高清表面已就绪');
  }catch(e){if(t&&a.maps.normal!==t)t.dispose();if(!controller.signal.aborted&&asset===a){a.detailState='retry';detailMessage('高清表面暂未载入；帽形与原色可用，可点击“重试高清表面”');event('detail-failed',a.meta.id,{message:e.message});}}
  finally{if(url)URL.revokeObjectURL(url);if(detailJob===controller)detailJob=null;}
 },80);
}
async function localTexture(url,key,signal){
 guard(signal);let timer,abandoned=false;const p=new T.TextureLoader().loadAsync(url).then(t=>{
  if(abandoned||signal?.aborted){t.dispose();throw signal?.reason||aborted();}
  t.colorSpace=key==='color'?T.SRGBColorSpace:T.NoColorSpace;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);return t;
 });
 try{return await waitWithSignal(Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('本地材质解码超时')),12000);})]),signal);}catch(e){abandoned=true;throw e;}finally{clearTimeout(timer);}
}
async function prepareAssetFit(a,s,hp,ctx){
 const key=fitSignature(s,hp);a.fitResults??=new Map();if(a.fitResults.has(key))return;
 phase(ctx,'按当前头形量配');const {fit}=await compute('fit',{mesh:a.mesh,meta:lightMeta(a.meta),settings:s,profile:hp},{signal:ctx.signal,onStage:t=>phase(ctx,t)});guard(ctx.signal);
 a.fitResults.set(key,fit);while(a.fitResults.size>4)a.fitResults.delete(a.fitResults.keys().next().value);
}
