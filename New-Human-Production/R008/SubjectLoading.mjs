import {chartFunctions} from './surface-generator.mjs';
export function loadSubjectBuild(options,onProgress){
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./SubjectLoadingWorker.mjs',import.meta.url),{type:'module'});
  worker.onmessage=({data:message})=>{if(message.type==='progress')onProgress?.(message);else if(message.type==='complete'){worker.terminate();message.surface.functions=message.data.charts.map(chartFunctions);resolve(message);}else if(message.type==='error'){worker.terminate();reject(Error(message.message));}};
  worker.onerror=event=>{worker.terminate();reject(Error(event.message||'人物加载任务启动失败'));};
  worker.onmessageerror=()=>{worker.terminate();reject(Error('人物加载数据传递失败'));};
  worker.postMessage({url:new URL('./parameters.phf.gz',import.meta.url).href,options});
 });
}
