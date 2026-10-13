/** One demand-driven display clock. Never controls the autonomous physics clock. */
let viewFrame=null,inViewFrame=false;
const thumbnailDirty=new Set();
const presentationStats={callbacks:0,sceneDraws:0,thumbnailDraws:0,fullDraws:0,visibilityResumes:0};
function requestViewFrame(){
 if(!ready||document.hidden||mode==='baseline'||inViewFrame||viewFrame!==null)return;
 viewFrame=requestAnimationFrame(loop);
}
function invalidateView(full=false){dirty=true;if(full)allDirty=true;requestViewFrame();}
function invalidateThumbnail(entry){if(entry)thumbnailDirty.add(entry);requestViewFrame();}
function presentationDiagnostics(){return {...presentationStats,frameQueued:viewFrame!==null,queuedThumbnails:thumbnailDirty.size,hidden:document.hidden,mode,pendingPose:!!productSolver?.pendingPose};}
function initFrameLifecycle(){
 function suspend(){if(viewFrame!==null){cancelAnimationFrame(viewFrame);viewFrame=null;}last=0;}
 function restore(){suspend();presentationStats.visibilityResumes++;invalidateView(true);}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else restore();});
 window.addEventListener('pagehide',suspend);window.addEventListener('pageshow',restore);
 window.addEventListener('focus',()=>{if(!document.hidden)invalidateView();});
}
