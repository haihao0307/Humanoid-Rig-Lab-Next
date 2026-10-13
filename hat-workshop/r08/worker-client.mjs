export function aborted(){return new DOMException('已取消旧选择','AbortError');}
export function guard(signal){if(signal?.aborted)throw signal.reason||aborted();}
export function waitWithSignal(promise,signal){
 guard(signal);return new Promise((resolve,reject)=>{
  const cancel=()=>{cleanup();reject(signal.reason||aborted());};
  const cleanup=()=>signal?.removeEventListener('abort',cancel);
  signal?.addEventListener('abort',cancel,{once:true});
  Promise.resolve(promise).then(v=>{cleanup();resolve(v);},e=>{cleanup();reject(e);});
 });
}
let worker=null,url=null,serial=0,pending=null;
const stats={started:0,completed:0,terminated:0,timeouts:0,active:0};
export function workerStats(){return {...stats};}
function getWorker(){
 if(worker)return worker;
 if(!globalThis.Worker)throw Error('此浏览器未允许计算线程，不能安全生成帽子');
 if(!url)url=URL.createObjectURL(new Blob([document.getElementById('hat-worker-source').textContent],{type:'application/javascript'}));
 worker=new Worker(url);return worker;
}
export function compute(kind,data,{signal,onStage,timeout=20000}={}){
 guard(signal);
 if(pending)throw Error('计算任务冲突：旧任务尚未释放');
 return new Promise((resolve,reject)=>{
  const w=getWorker(),job=++serial;let done=false;
  stats.started++;stats.active=1;
  const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);w.onmessage=null;w.onerror=null;pending=null;stats.active=0;};
  const finish=(fn,value,terminate=false)=>{
   if(done)return;done=true;cleanup();
   if(terminate){w.terminate();worker=null;stats.terminated++;}
   fn(value);
  };
  const cancel=()=>finish(reject,signal.reason||aborted(),true);
  const timer=setTimeout(()=>{stats.timeouts++;finish(reject,new Error('生成超过20秒，已停止，可重试或选择其他帽子'),true);},timeout);
  pending={job};signal?.addEventListener('abort',cancel,{once:true});
  w.onerror=e=>finish(reject,new Error('计算线程失败：'+e.message),true);
  w.onmessage=e=>{if(e.data.job!==job)return;if(e.data.stage){onStage?.(e.data.stage);return;}if(e.data.error){finish(reject,new Error(e.data.error.message));return;}stats.completed++;finish(resolve,e.data.result);};
  try{w.postMessage({job,kind,data});}catch(e){finish(reject,e,true);}
 });
}
