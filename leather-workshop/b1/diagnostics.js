/** B1 state reporting is descriptive only; it cannot change solver tolerances. */
const B1Status=(()=>{
 function describe(p){
  const residual=Number.isFinite(p?.residualN)?p.residualN:null,steps=p?.steps||0;
  if(!p)return{state:'INITIALIZING',label:'正在初始化',converged:false,residualN:null};
  if(p.failed||p.finite===false)return{state:'FAILED',label:'求解异常',converged:false,residualN:residual};
  if(steps===0||residual===null)return{state:'NOT_SOLVED',label:'尚未求解',converged:false,residualN:residual};
  const converged=residual<.0002&&p.convergedToR04Residual===true;
  return{state:converged?'STEP_CONVERGED':p.held?'INTERACTIVE_UNCONVERGED':p.active?'ADVANCING_UNCONVERGED':'PAUSED_UNCONVERGED',label:converged?'本步达到残差门槛':p.held?'交互预算解 · 未收敛':p.active?'推进中 · 未收敛':'已暂停 · 未收敛',converged,residualN:residual,thresholdN:.0002,steps,calibrated:false,manufacturingCertified:false};
 }
 return{describe};
})();
let b1DiagnosticMode=false,b1ContextLost=false;
function b1Report(){const p=productSolver?.report();return{schema:'kaopu/leather-b1-diagnostics@1',version:VERSION,source:BUILD_INFO.sourceCommit,product,mode,solver:B1Status.describe(p),physics:p||null,presentation:presentationDiagnostics(),inputToSubmission:productSolver?.presentationTiming?.()||null,resources:{...renderer?.info.memory,programs:renderer?.info.programs?.length||0,poseCache:hero?.userData.rig?.poseCache?.report()||null,allPoseCaches:B1PoseCache.totals()},contextLost:b1ContextLost,claims:{mouseToScreenMeasured:false,realMaterialCalibrated:false,deviceCertified:false},errors:errors.slice(-20)};}
function updateB1Status(){if(!$('b1Status')||!productSolver)return;const q=B1Status.describe(productSolver.report());$('b1Status').textContent=q.label;$('b1Status').dataset.state=q.state;if(b1DiagnosticMode){const d=b1Report(),r=d.solver,p=d.physics,t=d.inputToSubmission;$('b1Details').textContent=`残差 ${r.residualN===null?'未知':r.residualN.toExponential(3)} N / 门槛 2e-4 N\n当前迭代 ${p.solverIterations??'未知'} · 增量势 ${Number.isFinite(p.incrementalPotentialJ)?p.incrementalPotentialJ.toExponential(3):'未知'} J\n未实物标定；本步收敛不等于制造级认证。\n输入→收到 ${t?.last?.receiveMS?.toFixed(1)??'暂无'} ms\n输入→应用 ${t?.last?.applyMS?.toFixed(1)??'暂无'} ms\n输入→绘制提交 ${t?.last?.submitMS?.toFixed(1)??'暂无'} ms\n上述不含显示器呈现；已采样 ${t?.sampleCount||0}。\n几何 ${d.resources.geometries||0} / 纹理 ${d.resources.textures||0}\n姿势缓存 ${(d.resources.allPoseCaches.bytes/1048576).toFixed(1)} MiB / ${d.resources.allPoseCaches.live} 件\n缓存计算 ${d.resources.poseCache?.updates||0} / 重用 ${d.resources.poseCache?.reusedDraws||0}`;}}
function setB1Diagnostics(value){b1DiagnosticMode=!!value;document.body.classList.toggle('b1-diagnostics',b1DiagnosticMode);$('b1Diagnostics').setAttribute('aria-pressed',String(b1DiagnosticMode));$('b1Diagnostics').textContent=b1DiagnosticMode?'返回展示':'打开诊断';updateB1Status();}
function initB1Controls(){
 $('b1Diagnostics').onclick=()=>setB1Diagnostics(!b1DiagnosticMode);$('b1Export').onclick=()=>saveText(JSON.stringify(b1Report(),null,2),'leather-B1-diagnostics.json','application/json');
 $('b1Recover').onclick=()=>{if(mode==='products'){selectProduct(product);$('error').hidden=true;errors.length=0;}else if(mode==='physics')resetPhysics().catch(fail);};
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();b1ContextLost=true;productSolver?.release();if(productSolver)productSolver.active=false;physicsPlaying=false;fail('图形上下文已丢失，物理已暂停；恢复后可重新建立当前测试。');});
 renderer.domElement.addEventListener('webglcontextrestored',()=>{b1ContextLost=false;B1PoseCache.contextRestored(renderer);selectProduct(product);$('error').hidden=true;invalidateView(true);});
 setB1Diagnostics(false);
}
