/* Read the existing assembled body. All integration edits are made to this
 * isolated document in memory; source anatomy and original index stay intact. */
const frame=document.getElementById('bodyFrame'),progress=document.getElementById('progress');
function replaceOnce(s,from,to){if(!s.includes(from)||s.indexOf(from)!==s.lastIndexOf(from))throw Error('人物适配锚点变化：'+from.slice(0,70));return s.replace(from,to);}
async function boot(){
 const response=await fetch(new URL('../index.html',import.meta.url));if(!response.ok)throw Error('人物入口读取失败 '+response.status);
 const html=await response.text(),match=html.match(/const BODY_PAYLOAD='([^']+)'/);if(!match)throw Error('找不到原人物的压缩身体入口');
 const bytes=Uint8Array.from(atob(match[1]),c=>c.charCodeAt(0));let body=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
 const root=new URL('../',import.meta.url).href;
 body=replaceOnce(body,'<head>','<head><base href="'+root+'">');
 body=replaceOnce(body,'<script type="module">','<script type="module">import {installTailor} from "'+new URL('fit-r1.mjs',import.meta.url).href+'";\n');
 body=replaceOnce(body,'await installCompactWorkbench(window.HumanLab,compactSurfaceReady);',`const tailorData=await compactSurfaceReady;
 renderer.compact=new CompactSurfaceRenderer(window.HumanLab,tailorData);window.HumanLab.compact=renderer.compact;
 window.HumanLab.face.refresh();window.HumanLab.hairStatus={state:'pending'};`);
 const populationStart=body.indexOf('installNPCPopulation(window.HumanLab);'),populationEnd=body.indexOf('try{human.characterTaskStatus=',populationStart);
 if(populationStart<0||populationEnd<0)throw Error('无法隔离多人初始化');
 body=body.slice(0,populationStart)+body.slice(populationEnd);
 body=replaceOnce(body,"if(isolation==='all'){renderer.studioMode=false;renderer.background=world.theme==='camp'?[...CAMP_WORLD.presentation.background]:null;items.unshift(floor,...(world.scenery||[]),...(world.showRoofs?world.roofItems||[]:[]),...world.objects);}","renderer.studioMode=true;renderer.background=[.040,.048,.052];");
 body=replaceOnce(body,"window.__humanStartup={status:'ready',stage:'ready',message:'身体已就绪'};",`auto=false;agent.paused=true;follow=false;
 await installTailor({lab:window.HumanLab,data:tailorData,deform:r2DeformTissuePoint,muscles:r2MuscleFrames,render:renderFrame});
 window.__humanStartup={status:'ready',stage:'ready',message:'身体与试穿已就绪'};`);
 body=body.replace('</head>',`<style>html,body{margin:0!important;width:100%!important;height:100%!important;overflow:hidden!important}.app{display:block!important;height:100%!important}.app>aside,header,.toolbar,.hud,.metrics,.bottom,#labels{display:none!important}.stage{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;border:0!important;border-radius:0!important}#view{width:100%!important;height:100%!important}#loading{font:13px system-ui!important}</style></head>`);
 body=replaceOnce(body,'scheduleCompactHair(window.HumanLab.population.active);','scheduleCompactHair(window.HumanLab);');
 body=replaceOnce(body,"[...(isolation==='all'?lines:[]),...rigLines]",'[]');
 frame.srcdoc=body;
 const timer=setInterval(()=>{try{const s=frame.contentWindow.__compactLoading;if(s?.message)progress.textContent=s.message;if(frame.contentWindow.__startupError){clearInterval(timer);throw Error(frame.contentWindow.__startupError)}if(window.TailorApp){clearInterval(timer);document.getElementById('loading').style.display='none';}}catch(e){progress.textContent=e.message;console.error(e);}},250);
}
boot().catch(e=>{progress.textContent='初始化失败：'+e.message;console.error(e)});
