import {decodeParameters} from './parameter-codec.mjs';
import {generateSurface} from './surface-generator.mjs';
const progress=(percent,stage,detail='')=>postMessage({type:'progress',percent,stage,detail});
self.onmessage=async({data:{url,options}})=>{
 try{
  progress(2,'读取人物参数','连接本机参数文件…');
  const response=await fetch(url);if(!response.ok)throw Error(`参数读取失败：HTTP ${response.status}`);
  const total=Number(response.headers.get('content-length'))||0,chunks=[];let loaded=0;
  if(response.body){const reader=response.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;progress(total?2+18*Math.min(1,loaded/total):2,'读取人物参数',`${(loaded/1e6).toFixed(2)}${total?' / '+(total/1e6).toFixed(2):''} MB`);}}
  else{const bytes=new Uint8Array(await response.arrayBuffer());chunks.push(bytes);loaded=bytes.length;}
  const compressed=new Uint8Array(loaded);let at=0;for(const chunk of chunks){compressed.set(chunk,at);at+=chunk.length;}
  progress(21,'解压人物参数',`${(loaded/1e6).toFixed(2)} MB 参数已读取`);
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  progress(25,'解码人物参数','解析曲面、材质和骨架生成参数');
  const data=decodeParameters(raw);if(data.schema!=='parametric-human-uv-fields/v2')throw Error('人物参数格式不匹配');data.packageBytes=loaded;
  progress(30,'生成真实人物曲面',`0 / ${data.charts.length} 个曲面域`);
  const surface=generateSurface(data,{...options,onProgress:({completed,total,stage})=>progress(30+37*completed/total,stage||'生成真实人物曲面',`${completed} / ${total} 个曲面域`)});
  // Functions cannot be cloned; recompile the same chart functions on the main thread.
  delete surface.functions;progress(68,'传递已生成的曲面',`${surface.report.vertices.toLocaleString()} 顶点 · ${surface.report.triangles.toLocaleString()} 三角面`);
  const buffers=[...new Set(Object.values(surface).filter(v=>ArrayBuffer.isView(v)).map(v=>v.buffer))];postMessage({type:'complete',data,surface},buffers);
 }catch(error){postMessage({type:'error',message:error.message,stack:error.stack});}
};
