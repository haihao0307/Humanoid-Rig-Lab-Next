function installProceduralHair(lab){
 const hair=new ProceduralHair(lab),h=lab.human,a=lab.agent;
 hair.inStudio=()=>['hands','shoulders','torso','headNeck','lowerLimb'].some(k=>lab[k]?.active);
 hair.stopDemo=()=>{
  const d=hair.demo;if(!d)return;hair.demo=null;
  for(const [j,q]of d.joints)j.q=[...q];h.fk();h.tissue.update(a.time,0);
  a.paused=d.paused;auto=d.auto;needsRedraw=true;hair.refreshControls?.();
 };
 hair.startDemo=()=>{
  if(hair.demo)hair.stopDemo();
  if(hair.inStudio())throw Error('请先关闭身体检查面板，再开始转头演示。');
  if(a.skill||a.held||a.basic.busy||a.plan)throw Error('请等当前身体任务结束，再开始转头演示。');
  hair.enabled=true;hair.reset();hair.demo={time:0,paused:a.paused,auto,joints:[...h.spine.filter(j=>j.region==='C'),h.byId.get('head')].map(j=>[j,[...j.q]])};
  a.paused=false;auto=true;needsRedraw=true;hair.refreshControls?.();return hair.report();
 };
 hair.tickDemo=dt=>{
  const d=hair.demo;if(!d||a.paused)return;
  d.time+=dt;const u=Math.min(1,d.time/10),envelope=Math.sin(Math.PI*u)**2;
  const yaw=28*DEG*Math.sin(u*Math.PI*4)*envelope,pitch=5*DEG*Math.sin(u*Math.PI*2)*envelope;
  for(const [j,q]of d.joints)j.q=qm(q,qm(qy(yaw/d.joints.length),qx(pitch/d.joints.length)));
  h.constraints.enforceAll();h.fk();h.tissue.update(a.time,dt);needsRedraw=true;
  if(u>=1)hair.stopDemo();
 };
 // Hand control back before a task, reset, or inspector changes the pose.
 for(const name of ['submit','submitPlan','reset','cancel']){const original=a[name];a[name]=function(...args){hair.stopDemo();return original.apply(this,args);};}
 for(const name of ['hands','shoulders','torso','headNeck','lowerLimb']){const w=lab[name],enter=w.enter;w.enter=function(...args){hair.stopDemo();return enter.apply(this,args);};}
 hair.closeup=(view='threequarter')=>{
  for(const name of ['lowerLimb','headNeck','torso','shoulders','hands'])if(lab[name]?.active)lab[name].leave();
  lab.focus('body');lab.setCameraFollow(false);
  h.tissue.setView('skin');const f=hair.headFrame(),r=lab.renderer;
  r.projection='perspective';r.target=point(f,add(hair.scalp.center,[0,.025,0]));r.distance=.66;r.pitch=.10;
  r.yaw=a.yaw+(view==='side'?Math.PI/2:view==='back'?Math.PI:view==='front'?0:.5);
  needsRedraw=true;lab.render();
 };
 const style=document.createElement('style');style.textContent=`
 #hair-open{position:fixed;right:150px;bottom:16px;z-index:95;padding:9px 14px;border:1px solid #719ca8;border-radius:8px;background:#142c36;color:#eef7fa;cursor:pointer}
 #hair-panel{position:fixed;right:16px;bottom:64px;z-index:96;width:290px;max-width:calc(100vw - 48px);max-height:70vh;overflow:auto;padding:16px;border:1px solid #7299a6;border-radius:12px;background:#10252ff5;color:#e7f2f5;font:13px/1.6 system-ui;box-shadow:0 8px 30px #0006}
 #hair-panel[hidden]{display:none}#hair-panel h3{margin:0 0 8px;font-size:16px}#hair-panel p{margin:7px 0;color:#bbced6}#hair-panel button{padding:7px 9px;margin:3px;border:1px solid #5f8390;border-radius:6px;background:#24434f;color:#fff;cursor:pointer}#hair-panel label{display:block;margin:10px 0}#hair-panel input[type=range]{width:175px;vertical-align:middle}#hair-status{min-height:22px;color:#a8dac5}
 `;document.head.append(style);
 const open=document.createElement('button');open.id='hair-open';open.textContent='头发预览';document.body.append(open);
 const panel=document.createElement('section');panel.id='hair-panel';panel.hidden=true;panel.setAttribute('aria-label','头发预览');
 panel.innerHTML=`<h3>轻量中短发</h3><p>密实发束，保留微风与转头惯性。</p><div><button data-view="threequarter">头部近景</button><button data-view="front">正面</button><button data-view="side">侧面</button><button data-view="back">后面</button></div><label><input id="hair-enabled" type="checkbox" checked> 显示头发（取消可对比光头）</label><label><input id="hair-wind" type="checkbox" checked> 微风</label><label>风速 <input id="hair-speed" type="range" min="0" max="2" step="0.1" value="0.8"> <output id="hair-speed-value">0.8 m/s</output></label><button id="hair-turn">转头演示 · 10 秒</button><button id="hair-reset">梳理复位</button><button id="hair-close">收起</button><p id="hair-status" role="status">点击头部近景，再开始转头演示。</p>`;
 document.body.append(panel);const el=id=>panel.querySelector('#'+id),status=t=>el('hair-status').textContent=t;
 hair.refreshControls=()=>{el('hair-enabled').checked=hair.enabled;el('hair-turn').textContent=hair.demo?'停止演示':'转头演示 · 10 秒';};
 const action=fn=>()=>{try{fn();needsRedraw=true;hair.refreshControls();}catch(e){status(e.message);}};
 open.onclick=()=>{panel.hidden=!panel.hidden;open.setAttribute('aria-expanded',String(!panel.hidden));};open.setAttribute('aria-controls',panel.id);open.setAttribute('aria-expanded','false');
 el('hair-close').onclick=()=>{panel.hidden=true;open.setAttribute('aria-expanded','false');};
 panel.querySelectorAll('[data-view]').forEach(b=>b.onclick=action(()=>hair.closeup(b.dataset.view)));
 el('hair-enabled').onchange=action(()=>{hair.enabled=el('hair-enabled').checked;if(hair.enabled)hair.reset();});
 el('hair-wind').onchange=action(()=>{hair.windEnabled=el('hair-wind').checked;});
 el('hair-speed').oninput=action(()=>{hair.windSpeed=Number(el('hair-speed').value);el('hair-speed-value').textContent=hair.windSpeed.toFixed(1)+' m/s';});
 el('hair-turn').onclick=action(()=>{if(hair.demo){hair.stopDemo();status('演示已停止，已恢复原姿态。');}else{hair.startDemo();status('左右缓慢转头，10 秒后回到原姿态。');}});
 el('hair-reset').onclick=action(()=>{hair.reset();status('头发已恢复初始梳理形态。');});
 return hair;
}
