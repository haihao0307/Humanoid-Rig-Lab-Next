(()=>{
'use strict';
async function inflateBase64Gzip(text){
  const raw=atob(String(text||''));
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}
(async()=>{
  const anatomyText=await inflateBase64Gzip(window.__BIRD_ANATOMY_GZ);
  window.__BIRD_ANATOMY=JSON.parse(anatomyText);
  const viewerSource=await inflateBase64Gzip(window.__BIRD_VIEWER_GZ);
  (0,eval)(viewerSource);
})().catch(error=>{
  console.error(error);
  document.body.dataset.ready='false';
  document.body.dataset.error=error.message||String(error);
  const status=document.getElementById('status');
  const fatal=document.getElementById('fatal');
  if(status){status.textContent='打开失败：'+(error.message||String(error));status.classList.add('error')}
  if(fatal){fatal.hidden=false;const span=fatal.querySelector('span');if(span)span.textContent=error.message||String(error)}
  window.__BIRD_QA={ready:false,error:error.message||String(error)};
});
})();
