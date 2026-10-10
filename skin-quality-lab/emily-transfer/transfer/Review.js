export function installTransferReview(rig){
 const root=document.getElementById('s3Panel'),p=document.createElement('section');p.className='s1-panel';p.id='et11Panel';
 p.innerHTML='<div class="s1-kicker">ET11 / MEDIAL RECESS</div><h2>内眼角收回<br>共享边界一起调整</h2><p class="s1-copy">调整上睑、下睑与眼角共同连接的前后深度，不再只压平中间的小片。眼球、眉弓与闭眼终点保留。</p><button id="et11Before" class="s1-primary">按住：内眼角调整前</button><div class="s1-grid"><button id="et11Right">右内眼角</button><button id="et11Left">左内眼角</button><button id="et11Under">低角度检查</button><button id="et11Closed">完全闭眼</button><button id="et11Open">中性睁眼</button></div><pre id="et11Report" class="s1-fine"></pre>';
 root.before(p);
 const refresh=()=>{const r=rig.medialReport();document.getElementById('et11Report').textContent=r.eyes.map(e=>`${e.name==='right'?'人物右眼':'人物左眼'}：当前鼻侧最大回收 ${Math.max(...e.points.map(p=>p.recessMM)).toFixed(2)} mm`).join('\n');window.__SKIN_LAB__?.render?.();return r;};
 const compare=on=>{rig.medialBefore(on);refresh();};const button=document.getElementById('et11Before');
 button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);compare(true);};for(const n of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(n,()=>compare(false));
 button.onkeydown=e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();compare(true);}};button.onkeyup=()=>compare(false);window.addEventListener('blur',()=>compare(false));
 const pose=b=>{rig.medialFix=true;window.__STAGE3__.pose(b);refresh();};
 document.getElementById('et11Right').onclick=()=>__STAGE3__.view('medialR');document.getElementById('et11Left').onclick=()=>__STAGE3__.view('medialL');document.getElementById('et11Under').onclick=()=>__STAGE3__.view('under');document.getElementById('et11Closed').onclick=()=>pose(1);document.getElementById('et11Open').onclick=()=>{pose(0);__STAGE3__.view('front');};
 window.__MEDIAL_TRANSFER__={version:'ET11-M1',report:()=>rig.medialReport(),before:compare,pose,audit:d=>rig.audit(d)};
 document.title='内眼角回收 · ET11';document.querySelector('.version').textContent='ET11 · MEDIAL / PARAMETRIC TRANSFER';refresh();
}
