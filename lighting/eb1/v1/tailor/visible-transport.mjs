/** UI-only repair: move the original controls, without duplicate handlers or solver changes. */
const stage=document.getElementById('stage');
const firstMotion=document.querySelector('[data-motion]');
if(stage&&firstMotion){
 const bar=firstMotion.closest('nav');
 bar.classList.add('stage-motion-controls');
 bar.setAttribute('aria-label','画面内的人物动作播放控制');
 stage.appendChild(bar);
 const status=document.getElementById('physics-status');
 if(status){status.classList.add('stage-physics-status');stage.appendChild(status);}
 const style=document.createElement('style');
 style.textContent=`
 #stage .stage-motion-controls{position:absolute;z-index:3;top:10px;left:10px;right:10px;display:flex;flex-wrap:wrap;gap:6px;width:fit-content;max-width:calc(100% - 20px);padding:7px;background:rgba(243,247,242,.92);border:1px solid rgba(100,126,110,.35);border-radius:9px}
 #stage .stage-motion-controls button{font-size:12px;padding:7px 10px;white-space:nowrap;border-radius:6px;touch-action:manipulation}
 #stage .stage-motion-controls #motion-pause{background:#f6f4ec}
 #stage #physics-status.stage-physics-status{position:absolute;z-index:2;bottom:33px;left:10px;right:10px;margin:0;padding:5px 7px;background:rgba(246,248,244,.88);font-size:11px;color:#355242;pointer-events:none;max-width:calc(100% - 20px);border-radius:5px}
 @media(max-width:650px){#stage .stage-motion-controls{gap:4px;padding:5px}#stage .stage-motion-controls button{font-size:10px;padding:6px 7px}#stage #physics-status.stage-physics-status{font-size:10px}}
 `;
 document.head.appendChild(style);
 const focus=()=>{const r=stage.getBoundingClientRect();if(r.bottom<80||r.top>innerHeight-80)stage.scrollIntoView({behavior:'instant',block:'center'});};
 for(const button of bar.querySelectorAll('button'))button.addEventListener('click',focus,{capture:true});
 for(const id of ['light-orbit','light-studio','inspect-inside','physics-play','physics-tug','physics-reset'])document.getElementById(id)?.addEventListener('click',focus,{capture:true});
 window.__MP04_TRANSPORT__={version:'visible-transport-1',originalButtonsMoved:true,duplicateMotionButtons:0,solverChanged:false};
}
