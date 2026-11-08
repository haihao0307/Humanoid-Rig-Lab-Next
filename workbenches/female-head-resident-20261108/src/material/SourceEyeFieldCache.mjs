// Rebuild transient eye samples from project-owned functions. The samples are
// an evaluation cache for the original filtering behavior, never reference
// photographs or authoritative eye shape/identity data.
const EXPECTED=Object.freeze([
 '8499c75ca1a16385daf24361381e3cd7117459b429a0c92502947861fe709ae6',
 'e79735f2339b3df4ecb7ea331a45aa083ba4adfc218b286f4f5113eb05e25195',
 '816af1903384d17f3ace997dd4d9b8df1b9eb5b405b0915ddd543fcca176c6b2',
 'bf8f5af5d94a227318c681735d51a83b16113d28be7c9bac09c06123327977c6'
]);
export async function generateSourceEyeSamples({onProgress=()=>{}}={}){
 const size=2048,workerCount=4,colors=Array.from({length:3},()=>new Uint8Array(size*size*4)),workers=[],results=[];let vessels=null,segments=0;
 try{await Promise.all(Array.from({length:workerCount},(_,index)=>new Promise((resolve,reject)=>{
  const w=new Worker(new URL('./SourceEyeFieldCacheWorker.mjs',import.meta.url),{type:'module'});workers.push(w);const timer=setTimeout(()=>reject(Error('眼部函数采样超时')),120000);
  w.onmessage=({data})=>{clearTimeout(timer);if(data.error){reject(Error(data.error));return;}try{for(const p of data.parts){if(p.kind==='vessels'){vessels=p.bytes;segments=p.segments;}else{if(!Number.isInteger(p.kind)||p.kind<0||p.kind>2||p.start!==index*size/workerCount||p.bytes.length!==size*size/workerCount*4)throw Error('眼部函数采样分区不符');colors[p.kind].set(p.bytes,p.start*size*4);}}results.push(index);onProgress(results.length,workerCount);resolve();}catch(e){reject(e);}};
  w.onerror=e=>{clearTimeout(timer);reject(Error(e.message||'眼部函数工作器失败'));};w.postMessage({index,start:index*size/workerCount,end:(index+1)*size/workerCount});
 })));}finally{workers.forEach(w=>w.terminate());}
 if(!vessels||vessels.length!==size*size*4||segments!==6240)throw Error('眼部血管函数采样不完整');
 const all=[...colors,vessels],sha=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),v=>v.toString(16).padStart(2,'0')).join(''),hashes=[];
 for(let i=0;i<all.length;i++){const actual=await sha(all[i]);hashes.push(actual);if(actual!==EXPECTED[i])throw Error('眼部函数采样与原项目不一致：'+i);}
 return{colors,vessels,hashes,segments,width:size,height:size};
}
export async function createSourceEyeFieldCache(gl,{onProgress=()=>{}}={}){
 const started=performance.now(),data=await generateSourceEyeSamples({onProgress}),textures=[];try{
  const packed=new Uint8Array(3*data.width*data.height*4);for(let i=0;i<3;i++)packed.set(data.colors[i],i*data.width*data.height*4);
  const colors=gl.createTexture();textures.push(colors);gl.activeTexture(gl.TEXTURE8);gl.bindTexture(gl.TEXTURE_2D_ARRAY,colors);gl.texImage3D(gl.TEXTURE_2D_ARRAY,0,gl.SRGB8_ALPHA8,data.width,data.height,3,0,gl.RGBA,gl.UNSIGNED_BYTE,packed);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  const vessels=gl.createTexture();textures.push(vessels);gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_2D,vessels);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,data.width,data.height,0,gl.RGBA,gl.UNSIGNED_BYTE,data.vessels);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.generateMipmap(gl.TEXTURE_2D);const error=gl.getError();if(error)throw Error('眼部函数采样缓存上传失败：'+error);
  const hashes=data.hashes,segments=data.segments,buildMS=performance.now()-started;return{bind(program){gl.activeTexture(gl.TEXTURE8);gl.bindTexture(gl.TEXTURE_2D_ARRAY,colors);gl.uniform1i(gl.getUniformLocation(program,'neColorLayers'),8);gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_2D,vessels);gl.uniform1i(gl.getUniformLocation(program,'neVessels'),9);},report:()=>({kind:'temporary-function-samples',width:2048,height:2048,hashes,segments,buildMS,externalImages:0,sourceFidelityAccepted:false}),dispose(){textures.forEach(t=>gl.deleteTexture(t));}};
 }catch(e){textures.forEach(t=>gl.deleteTexture(t));throw e;}
}
