/* Lossless transport; inspectable modules remain production authority. */
(async()=>{
 const t=performance.now(),status=document.getElementById('status');
 const stats=globalThis.__hatStartupStats={runtimePackedBytes:__PACKED_BYTES__,runtimeRawBytes:__RAW_BYTES__};
 let timer;
 try{
  if(status)status.textContent='正在无损展开程序；帽形和原材质不会降级';
  const unpack=async()=>{
   const s=atob('__RUNTIME_GZIP__'),bytes=new Uint8Array(s.length);
   for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);
   const raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
   if(raw.byteLength!==__RAW_BYTES__)throw Error('程序长度校验失败');
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
   if(hash!=='__RUNTIME_HASH__')throw Error('程序完整性校验失败');
   return new TextDecoder().decode(raw);
  };
  const code=await Promise.race([unpack(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('程序展开超时，请重新打开此固定版本')),20000);})]);
  stats.runtimeDecodeMS=performance.now()-t;
  const script=document.createElement('script');script.textContent=code;document.body.appendChild(script);script.remove();
 }catch(e){
  stats.error=e.message;if(status)status.textContent='启动未完成：'+e.message;
  const el=document.getElementById('loading');if(el){el.hidden=false;el.textContent='启动未完成：'+e.message;}
 }finally{clearTimeout(timer);}
})();
