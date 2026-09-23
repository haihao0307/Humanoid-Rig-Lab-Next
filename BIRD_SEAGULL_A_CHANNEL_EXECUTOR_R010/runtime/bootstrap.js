(async()=>{
'use strict';
try{
 if(!('DecompressionStream' in window))throw new Error('浏览器不支持本地 gzip 解码');
 let s=String(window.__BIRD_R007_VIEWER||'').replace(/[\t\n\r ]+/g,'');while(s.length%4)s+='=';
 const text=atob(s),bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
 const source=await new Response(stream).text();
 (0,eval)(source);
}catch(error){
 const status=document.getElementById('status'),fatal=document.getElementById('fatal');
 if(status){status.textContent='打开失败：'+error.message;status.className='status error'}
 if(fatal){fatal.hidden=false;const span=fatal.querySelector('span');if(span)span.textContent=error.message}
 window.__BIRD_QA={ready:false,error:error.message};console.error(error);
}
})();
