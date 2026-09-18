const shortsActorClocks=new WeakSet();
function advanceShortsSingleActor(lab,dt){
 const agent=lab.agent;
 if(!shortsActorClocks.has(agent)){const original=agent.tickFixed;agent.tickFixed=function(step){const before=this.time;original.call(this,step);if(this.time>before){lab.human.tissue.update(this.time,this.time-before,this.held?.mass||0);lab.compact?.skirt?.update(step);}};shortsActorClocks.add(agent);}
 return agent.tick(dt);
}
function installShortsControls(lab){
 const query=new URLSearchParams(window.parent.location.search),single=query.has('shorts')||query.has('linen');
 const api={studio:single,focus(view='angle'){
  lab.setCameraFollow(false);const r=lab.renderer,h=lab.human,s=h.bodyMetrics.statureScale,hip=h.world('hips').p,close=view==='cloth';
  r.target=[hip[0],hip[1]-.10*s,hip[2]];r.distance=(close?1.35:2.9)*s;r.yaw=lab.agent.yaw+({front:0,back:Math.PI,side:Math.PI/2,angle:.46,cloth:.38}[view]??.46);r.pitch=close?.03:.07;r.projection='perspective';needsRedraw=true;lab.render();return {view,target:[...r.target],distance:r.distance};
 },report:()=>lab.compact?.skirt?.diagnostics(),snapshot:()=>lab.compact?.skirt?.simulation.snapshot(),async continueSewing(){
  const garment=lab.compact?.skirt;if(!garment||garment.assemblyReady||garment.assemblyState==='failed')return garment?.assemblyReport;
  lab.setAuto(false);const pending=garment.assemble(SHORTS_ASSEMBLY_STEP_LIMIT,()=>{refreshStatus();needsRedraw=true;lab.render();});refreshStatus();
  try{return await pending;}finally{refreshStatus();needsRedraw=true;lab.render();}
 }};
 lab.garment=api;
 if(single)lab.setAuto(false);
 // Execute after the authoritative population physics/FK step, including all
 // substeps of HumanLab.advance(). Rendering itself never advances cloth time.
 if(lab.population){const population=lab.population,original=population.tickFixed;population.tickFixed=function(step){const times=new Map([...this.values()].map(actor=>[actor.id,actor.agent.time]));original.call(this,step);for(const actor of this.values())if(!actor.disposed&&!actor.agent.paused&&actor.agent.time!==times.get(actor.id))actor.compact?.skirt?.update(step);};}
 if(!single)return api;
 const panel=document.createElement('section');panel.id='shorts-controls';panel.innerHTML='<b>布片短裤</b><span data-status style="margin-left:12px"></span><div><button data-view="angle">全身</button><button data-view="front">正面</button><button data-view="side">侧面</button><button data-view="back">背面</button><button data-view="cloth">近看</button><button data-action="sew">继续缝制</button><button data-command="向前走0.6米">走路</button><button data-command="坐在地上">坐下</button><button data-command="站起来">站起</button><button data-action="pause">暂停</button></div>';
 const style=document.createElement('style');style.textContent='#shorts-controls{position:fixed;z-index:50;left:18px;bottom:18px;max-width:calc(100% - 36px);padding:12px 16px;background:#152022ee;border:1px solid #52615b;border-radius:10px;color:#e1e6d8;font:13px/1.5 system-ui}#shorts-controls b{font-size:17px}#shorts-controls div{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}#shorts-controls button{background:#263632;color:#e1e6d8;border:1px solid #53655c;border-radius:5px;padding:6px 10px;cursor:pointer}.compact-panel,.hud,.worldLabel,.npc-population{display:none!important}';document.head.append(style);document.body.append(panel);
 function refreshStatus(){
  if(!single)return;
  const garment=lab.compact?.skirt,ready=garment?.assemblyReady===true,busy=garment?.assemblyState==='sewing',failed=garment?.assemblyState==='failed',stage=garment?.simulation.sewingStage;
  panel.querySelector('[data-status]').textContent=ready?'已缝合 · 待试穿检查':failed?'布片检查未通过':busy?'缝制中 · 第 '+Math.min(stage.index+1,stage.stages.length)+' / '+stage.stages.length+' 道工序':'尚未缝完';
  for(const b of panel.querySelectorAll('[data-command],[data-action="pause"]'))b.disabled=!ready;
  const sew=panel.querySelector('[data-action="sew"]');sew.hidden=ready||failed;sew.disabled=busy;
 }
 panel.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||b.disabled)return;if(b.dataset.view)api.focus(b.dataset.view);if(b.dataset.command&&lab.compact?.skirt?.assemblyReady){lab.agent.paused=false;lab.command(b.dataset.command);lab.setAuto(true);}if(b.dataset.action==='sew')api.continueSewing().catch(error=>{panel.querySelector('[data-status]').textContent='缝制中断';console.error(error);});if(b.dataset.action==='pause'&&lab.compact?.skirt?.assemblyReady){lab.agent.paused=!lab.agent.paused;b.textContent=lab.agent.paused?'继续':'暂停';}});
 lab.settings.close();lab.setCameraFollow(false);refreshStatus();api.focus();return api;
}
