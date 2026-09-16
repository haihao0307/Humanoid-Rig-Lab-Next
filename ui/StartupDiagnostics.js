// Read-only startup observation. Does not restart the body or run scene actions.
function watchBodyStartup(){
 const started=Date.now(),frame=$('bodyFrame');
 const panel=document.createElement('section');panel.id='bodyStartupDiagnostics';
 panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
 panel.style.cssText='position:absolute;left:16px;right:16px;top:62px;z-index:60;padding:18px;background:#15232f;border:1px solid #728e9f;border-radius:10px;color:#e3e9ef;max-height:70%;overflow:auto';
 const title=document.createElement('b'),detail=document.createElement('pre'),retry=document.createElement('button'),close=document.createElement('button');
 title.textContent='人物场景正在启动';detail.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.7 monospace;margin:12px 0';
 retry.textContent='重新加载页面';retry.onclick=()=>location.reload();
 close.textContent='关闭诊断';close.style.marginLeft='10px';close.onclick=()=>{clearInterval(timer);panel.remove();};
 panel.append(title,detail,retry,close);panel.hidden=true;document.querySelector('.scene-main').append(panel);
 const phases={unpack:'解压人物页面',graphics:'初始化图形',anatomy:'载入全身数据',skeleton:'建立骨骼',tissue:'生成肌肉与皮肤',world:'建立场景',binding:'连接身体接口',reconstruction:'连接重建人体与训练场',ready:'身体已就绪'};
 let previous='',finishedAt=null;
 const timer=setInterval(()=>{
  try{
   const win=frame.contentWindow,doc=frame.contentDocument,body=win?.__humanStartup,lab=win?.HumanLab;
   const connected=state.bodyReady&&state.brainReady&&!state.startupFailure;
   const stage=body?.stage||state.bodyStartup?.stage||'unpack';
   const phase=phases[stage]||stage;
   const rect=frame.getBoundingClientRect(),canvas=doc?.querySelector('canvas'),canvasRect=canvas?.getBoundingClientRect();
   const scripts=[...(doc?.querySelectorAll('script[src]')||[])];
   const resource=scripts.at(-1)?.getAttribute('src');
   const error=state.startupFailure?.error||win?.__startupError;
   // Once the actual scene has drawn, leave the successful initial view clear.
   if(connected&&!error&&lab?.renderer?.frames>0&&!lab.renderer.gl.isContextLost()){
    $('cleanConnection').textContent='已连接';clearInterval(timer);panel.remove();return;
   }
   if(finishedAt===null&&(error||connected))finishedAt=Date.now();
   const seconds=Math.floor(((finishedAt??Date.now())-started)/1000);
   const lines=[`等待时间：${seconds} 秒`,`加载阶段：${phase}`,`人物状态：${body?.status||'尚未报告'}`,`页面状态：${doc?.readyState||'尚未创建'}`,`人物窗口：${Math.round(rect.width)} × ${Math.round(rect.height)}`,`画布：${canvasRect?Math.round(canvasRect.width)+' × '+Math.round(canvasRect.height):'尚未创建'}`];
   lines.push('接口连接：'+(connected?'已就绪':'等待中'));
   const reconstruction=win?.__compactLoading;
   if(reconstruction){
    lines.push('重建进度：'+(reconstruction.message||reconstruction.group));
    if(reconstruction.domainId)lines.push('当前曲面：'+reconstruction.domainId);
    if(reconstruction.group==='parameters'&&reconstruction.file)lines.push('参数文件：'+reconstruction.file);
    if(Number.isFinite(reconstruction.evaluations))lines.push('曲面求值次数：'+reconstruction.evaluations.toLocaleString());
    if(Number.isFinite(reconstruction.triangles))lines.push('已生成三角形：'+reconstruction.triangles.toLocaleString());
    if(Number.isFinite(reconstruction.canonicalVertices))lines.push('全局顶点：'+reconstruction.canonicalVertices.toLocaleString());
    if(Number.isFinite(reconstruction.adaptiveSplits))lines.push('本组细分预算：'+reconstruction.adaptiveSplits.toLocaleString()+' / '+reconstruction.refinementBudget.toLocaleString());
    if(reconstruction.budgetLimitedTriangles)lines.push('因预算保留较粗细节的三角形：'+reconstruction.budgetLimitedTriangles.toLocaleString());
    if(reconstruction.state==='failed')lines.push('重建已停止；计算耗时：'+Math.round(reconstruction.elapsedMs/1000)+' 秒');
    else if(reconstruction.state==='queued')lines.push('重建线程尚未启动，正在等待其它人物页面释放计算资源');
    else lines.push('最近进度距今：'+Math.max(0,Math.floor((win.performance.now()-reconstruction.updatedAt)/1000))+' 秒');
   }
   const memory=win?.performance?.memory;
   if(Number.isFinite(memory?.jsHeapSizeLimit))lines.push('浏览器报告的 JS 堆上限：'+(memory.jsHeapSizeLimit/1073741824).toFixed(2)+' GB（非整机内存）');
   for(const previousRun of Object.values(win?.__compactPreviousRuns||{}))if(previousRun&&['running','queued'].includes(previousRun.state)){
    lines.push('上次未完成的计算：'+previousRun.job+' / '+(previousRun.domainId||previousRun.group)+'；记录于 '+new Date(previousRun.at).toLocaleTimeString());
    if(Number.isFinite(previousRun.canonicalVertices))lines.push('上次记录顶点数：'+previousRun.canonicalVertices.toLocaleString());
   }
   if(canvas)lines.push(`画布缓冲区：${canvas.width} × ${canvas.height}`);
   if(lab?.renderer){
    const r=lab.renderer,gl=r.gl;
    lines.push(`累计渲染帧：${r.frames}；本帧绘制调用：${r.drawCalls}`);
    lines.push(`图形上下文：${gl.isContextLost()?'已丢失':'可用'}；缓冲区：${gl.drawingBufferWidth} × ${gl.drawingBufferHeight}`);
    lines.push(`渲染对象：${r.lastItems?.length??0}；三角索引：${r.count??0}`);
    lines.push('相机目标：'+JSON.stringify(r.target)+'；距离：'+r.distance);
    lines.push('相机矩阵：'+(r.vp&&Array.from(r.vp).every(Number.isFinite)?'数值有效':'缺失或包含无效数值'));
   }
   lines.push('运行模式：'+(win?.__lifeAgentLifecycle?.mode||'未报告'));
   if(canvas){const style=win.getComputedStyle(canvas);lines.push(`画布样式：display=${style.display}；visibility=${style.visibility}；opacity=${style.opacity}`);}
   const latestError=state.errors.at(-1);if(latestError&&latestError!==error)lines.push('最近运行错误：'+latestError);
   if(body?.message)lines.push(body.message);
   if(resource&&!resource.startsWith('data:'))lines.push('数据文件：'+new URL(resource,document.baseURI).pathname);
   if(error)lines.push('错误：'+String(error));
   if(!body&&frame.srcdoc)lines.push('人物页面已提交，等待初始化代码执行。');
   title.textContent=error?'人物启动失败':connected?'身体接口已就绪，请核对画面诊断':seconds>=30?'人物尚未就绪，请保留下面的诊断信息':'人物场景正在启动';
   const next=lines.join('\n');if(next!==previous){detail.textContent=next;previous=next;}
   if(seconds>=8||error)panel.hidden=false;
   if(seconds>=8)$('cleanConnection').textContent=error?'连接异常':connected?'已连接':phase;
  }catch(error){panel.hidden=false;title.textContent='无法读取人物加载状态';detail.textContent=String(error.message||error);clearInterval(timer);}
 },1000);
}
