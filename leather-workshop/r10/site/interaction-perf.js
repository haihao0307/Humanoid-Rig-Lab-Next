// Diagnostics/UI update at 5 Hz; completed skin poses still apply once per RAF.
const oldGrabUI=updateGrabUI;let lastStats=0;
updateGrabUI=function(){const now=performance.now();if(productSolver?.active&&!productSolver?.failed&&now-lastStats<200)return;lastStats=now;oldGrabUI();const q=productSolver?.report();if(q)$('inputMetrics').textContent=`求解耗时 ${Number(q.workerSolveMS||0).toFixed(1)} ms / 步\n鼠标目标距离 ${Number(q.cursorErrorMM||0).toFixed(2)} mm\n输入至物理回传 ${Number(q.inputToPoseMS||0).toFixed(0)} ms · 队列 ${q.pendingRequests||0}\n保持原时间步 / 迭代数 / 有厚度碰撞`;
};
const stage=$('stage'),cursor=document.createElement('span');cursor.id='grabCursor';cursor.title='鼠标输入目标，不代表物理已到达';stage.append(cursor);let activePointer=null;
function cursorAt(e){const r=stage.getBoundingClientRect();cursor.style.left=(e.clientX-r.left)+'px';cursor.style.top=(e.clientY-r.top)+'px';cursor.style.visibility=grabMode&&grabPointer!==null?'visible':'hidden';}
stage.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button===0){activePointer=e.pointerId;cursorAt(e);}});
stage.addEventListener('pointermove',cursorAt,{passive:true});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(ev,()=>{activePointer=null;cursor.style.visibility='hidden';document.body.classList.remove('leather-dragging');});
stage.addEventListener('selectstart',e=>e.preventDefault());stage.addEventListener('dragstart',e=>e.preventDefault());
function cancelInput(){if(activePointer!==null){const id=activePointer;stage.dispatchEvent(new PointerEvent('pointercancel',{pointerId:id}));if(stage.hasPointerCapture(id))stage.releasePointerCapture(id);}productSolver?.release();grabPointer=null;document.body.classList.remove('leather-dragging');cursor.style.visibility='hidden';}
window.addEventListener('blur',cancelInput);window.addEventListener('keydown',e=>{if(e.key==='Escape')cancelInput();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelInput();if(productSolver)productSolver.active=false;}});
// Stable public diagnostics for regression and future integration.
const previousPreparePerf=prepareGrab;
prepareGrab=function(){previousPreparePerf();if(window.LEATHER_ATELIER){window.LEATHER_ATELIER.stepProduct=n=>productSolver.step(n||1);window.LEATHER_ATELIER.performance=()=>productSolver.report();}};
const oldRecipePerf=recipe;recipe=function(){const r=oldRecipePerf();r.acceptedBaseline={version:'R09.1',buildCommit:'416d2b7a7d7214865fa47b82973450c700a65da9',userAccepted:['appearance','physical response','thickness'],performanceAccepted:false};r.removedProduct='jacket';return r;};
