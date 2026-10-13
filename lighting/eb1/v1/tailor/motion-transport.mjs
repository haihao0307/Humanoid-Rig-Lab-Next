/** Presentation controls only. Frames remain original physically solved states. */
const bar=document.querySelector('#stage .stage-motion-controls');
if(bar){
 const resume=document.createElement('button');resume.id='motion-resume';resume.textContent='继续人物动作';resume.disabled=true;bar.append(resume);
 const row=document.createElement('label');row.className='motion-timeline';row.innerHTML='<span id="motion-time">先选择人物动作</span><input id="motion-frame" aria-label="已实算人物动作时间轴" type="range" min="0" max="180" step="1" value="0" disabled><select id="motion-speed" aria-label="动作播放速度"><option value="1">正常速度</option><option value="0.5">半速观察</option><option value="0.25">四分之一速</option></select>';bar.append(row);
 const slider=row.querySelector('input'),speed=row.querySelector('select'),time=row.querySelector('span');
 const css=document.createElement('style');css.textContent='.motion-timeline{flex-basis:100%;display:flex;align-items:center;gap:8px;font-size:11px;min-width:0}.motion-timeline input{flex:1;min-width:70px;touch-action:pan-x}.motion-timeline select{padding:4px;max-width:110px}.motion-timeline span{min-width:105px}#stage .stage-motion-controls button:disabled{opacity:.55}@media(max-width:650px){.motion-timeline{gap:4px}.motion-timeline span{min-width:85px;font-size:10px}.motion-timeline select{max-width:95px;font-size:10px}}';document.head.append(css);
 const controller=()=>window.__MP04__?.debug().physics;
 resume.onclick=()=>{const c=controller();if(!c||c.baking||!c.fromCache)return;c.setPlaybackSpeed(speed.value);c.resumeMotion();};
 speed.onchange=()=>controller()?.setPlaybackSpeed(speed.value);
 let pendingFrame=null,scheduled=0;
 slider.addEventListener('input',()=>{const c=controller();if(!c?.fromCache||c.baking)return;c.pause();pendingFrame={c,value:Number(slider.value)};if(!scheduled)scheduled=requestAnimationFrame(()=>{scheduled=0;const q=pendingFrame;pendingFrame=null;if(q?.c===controller()&&!q.c.dead&&!q.c.baking&&q.c.fromCache)q.c.seekMotionFrame(q.value);});});
 const sync=()=>{const c=controller(),valid=!!c?.activeClip&&c.fromCache&&!c.baking&&!c.dead;slider.disabled=!valid;resume.disabled=!valid||c.running;
 if(valid){const a=c.frame?.audit,h=c.activeClip.header;slider.max=String(h.frameCount-1);if(document.activeElement!==slider&&!pendingFrame)slider.value=String(a?.frameSequence||0);time.textContent=(a?.motionTime||0).toFixed(2)+' / '+((h.frameCount-1)/h.fps).toFixed(2)+' 秒';resume.textContent=c.clock?.finished?'重播人物动作':'继续人物动作';if(Number(speed.value)!==(c.playbackSpeed||1))c.setPlaybackSpeed(speed.value);}
 else time.textContent=c?.baking?'载入／实算动作…':'先选择人物动作';
 for(const b of bar.querySelectorAll('[data-motion]'))b.disabled=!!document.getElementById('top-material')?.disabled||!!c?.baking;
 };
 const timer=setInterval(sync,200);sync();window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 window.__MP04_PLAYBACK_UI__={version:'MP04.4.1',originalButtonsReused:true,physicsIntegratorChanged:false,framesInterpolated:false,maxPresentationAdvanceFrames:3};
}
