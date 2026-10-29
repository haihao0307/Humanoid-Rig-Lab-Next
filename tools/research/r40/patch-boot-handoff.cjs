'use strict';
// An embedded dynamic page receives the actual person before its first body
// evaluation. Standalone pages and browsers without same-origin frame access
// retain the previous initialization and subsequent archive handoff.
const {replace}=require('../r32/render-integration.cjs');
function dynamic(s){
 s=replace(s,"handoffId:options.handoffId||null,camera:options.camera||null}","handoffId:options.handoffId||null,camera:options.camera||null,boot:options.boot===true}");
 s=replace(s,"if(p.camera)renderer.setCamera(p.camera);if(p.handoffId)","if(p.camera)renderer.setCamera(p.camera);if(p.boot)try{if(window.frameElement)window.frameElement.__BODY_BOOT_APPLIED_R40__=true;}catch{}if(p.handoffId)");
 const old="busy=false;sync();apply(m.state.weight,m.state.muscle,m.state.spine,m.state.arm);return;";
 const next="busy=false;sync();let boot=null;try{const owner=window.frameElement;boot=owner?.__BODY_BOOT_ARCHIVE_R40__||null;if(owner&&boot)delete owner.__BODY_BOOT_ARCHIVE_R40__;}catch{}if(boot){const failed=e=>{busy=false;error=e?.message||String(e);status.textContent=error;if(!renderer)loading.textContent=error;sync();};try{loadArchive(boot,{boot:true}).catch(failed);}catch(e){failed(e);}}else apply(m.state.weight,m.state.muscle,m.state.spine,m.state.arm);return;";
 return replace(s,old,next);
}
function workbench(s){
 s=replace(s,'frame.src=url.href;canvas.parentElement.append(frame);',"if(type==='dynamic-body-p1')frame.__BODY_BOOT_ARCHIVE_R40__=window.__BODY_ARCHIVE_FOR_DYNAMIC_P1__();frame.src=url.href;canvas.parentElement.append(frame);");
 return replace(s,"if(type==='dynamic-body-p1')await next.loadArchive(window.__BODY_ARCHIVE_FOR_DYNAMIC_P1__());","if(type==='dynamic-body-p1'){if(!frame.__BODY_BOOT_APPLIED_R40__)await next.loadArchive(window.__BODY_ARCHIVE_FOR_DYNAMIC_P1__());}");
}
module.exports={dynamic,workbench};
