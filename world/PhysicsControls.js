function installPhysicsControls(lab){
 const button=document.createElement('button');button.id='physics-open';button.textContent='世界物理';
 button.setAttribute('aria-haspopup','dialog');$('fieldView').after(button);
 const panel=document.createElement('dialog');panel.id='physics-panel';panel.setAttribute('aria-label','世界物理');
 panel.innerHTML='<form method="dialog"><h2>世界物理</h2><p>物品受重力、惯性、摩擦与碰撞影响。所有人物暂停时世界暂停。单独暂停人物会冻结其持物，其他人物和自由物品继续运动。</p><label>重力加速度（m/s²）<input name="gravity" type="number" min="0.1" max="30" step="0.1"></label><label>地面摩擦系数<input name="friction" type="number" min="0" max="2" step="0.05"></label><div><button type="button" data-apply>应用世界参数</button><button type="button" data-refresh>刷新状态</button><button value="close">关闭</button></div><output aria-live="polite"></output><p>在场景编辑中调整物品的离地高度、质量、摩擦和回弹；抬高后继续运行即可观察下落。人物通过有限手力搬运与推动。</p><p class="physics-limit">当前人物由动作核心驱动碰撞体；尚未加入全身失衡跌倒、软组织和毛发动力学。</p></form>';
 const style=document.createElement('style');style.textContent='#physics-panel{width:min(440px,90vw);max-height:80vh;overflow:auto;background:#f2f6f3;color:#263e35;border:1px solid #96b8a5;border-radius:12px;padding:20px;font:13px/1.65 system-ui}#physics-panel::backdrop{background:#0006}#physics-panel h2{font-size:20px;color:inherit;margin:0}#physics-panel label{display:flex;justify-content:space-between;gap:12px;margin:12px 0}#physics-panel input{width:100px;background:#fff;color:#253c31;border:1px solid #98b7a6;border-radius:5px;padding:6px}#physics-panel button{background:#deebe2;color:#254536;padding:7px 10px;margin:5px 5px 5px 0}#physics-panel output{display:block;white-space:pre-wrap;background:#e1eae4;padding:12px;margin-top:12px;border-radius:7px}#physics-panel .physics-limit{font-size:11px;color:#597367}';
 document.head.append(style);document.body.append(panel);
 const inputs=panel.querySelector('form').elements,output=panel.querySelector('output');
 const api={report:()=>lab.world.physics.snapshot(),object:id=>lab.world.physics.objectState(id),
  configure(value){environmentIdleGuard();lab.world.physicsSettings=worldPhysicsSettings({...lab.world.physicsSettings,...value});lab.world.touch('physics.configure');needsRedraw=true;return api.report();}
 };
 const refresh=()=>{
  const items=lab.world.objects.filter(o=>o.movable!==false),states=items.map(o=>({o,s:api.object(o.id)}));
  output.textContent=((lab.population?.physicsPaused()??lab.agent.paused)?'世界已暂停':'世界运行中')+' · 可动物品 '+items.length+' 件\n'+states.slice(0,12).map(({o,s})=>o.name+'：'+(!s?'等待物理同步':s.paused?'随人物暂停':s.settled?'已稳定':s.supported?'接触支撑面':'空中')+(s?' · '+s.speedMps.toFixed(2)+' m/s':'')).join('\n')+(items.length>12?'\n其余状态见导出证据。':'');
 };
 button.onclick=()=>{inputs.namedItem('gravity').value=lab.world.physicsSettings.gravityMps2;inputs.namedItem('friction').value=lab.world.physicsSettings.groundFriction;refresh();panel.showModal();};
 panel.querySelector('[data-refresh]').onclick=refresh;
 panel.querySelector('[data-apply]').onclick=()=>{try{api.configure({gravityMps2:Number(inputs.namedItem('gravity').value),groundFriction:Number(inputs.namedItem('friction').value)});refresh();}catch(error){output.textContent=error.message;}};
 return api;
}
