function installLinenSkirtControls(lab){
 const single=new URLSearchParams(window.parent.location.search).has('linen');
 const api={studio:single,focus(view='angle'){
  lab.setCameraFollow(false);const r=lab.renderer,h=lab.human,s=h.bodyMetrics.statureScale,hip=h.world('hips').p;
  const close=view==='cloth',detail=view==='weave';
  r.target=[hip[0],hip[1]+(close||detail?-.065:-.10)*s,hip[2]];
  r.distance=(detail?.56:close?1.5:2.9)*s;r.yaw=lab.agent.yaw+({front:0,back:Math.PI,side:Math.PI/2,angle:.46,cloth:.38,weave:.38}[view]??.46);r.pitch=close||detail?.03:.07;r.projection='perspective';
  if(detail){r.target[0]+=.07*s;r.target[2]+=.20*s;}
  needsRedraw=true;lab.render();return {view,target:[...r.target],distance:r.distance};
 },report(){return {garment:lab.compact?.skirt?.report,source:LINEN_MATERIAL_SOURCE,simulation:'inherited pelvis/thigh skinning with geometric clearance'};}};
 lab.garment=api;
 if(!single)return api;
 const panel=document.createElement('section');panel.id='linen-controls';panel.innerHTML='<b>亚麻裙</b><span>人物原生骨骼 · 程序化布面</span><div><button data-view="angle">全身</button><button data-view="front">正面</button><button data-view="side">侧面</button><button data-view="back">背面</button><button data-view="cloth">裙子近看</button><button data-view="weave">布纹近看</button><button data-action="turn">转身</button><button data-action="pause">暂停动作</button><button data-action="world">显示场景</button></div><small>拖动旋转 · 滚轮缩放 · 右键平移</small>';
 const style=document.createElement('style');style.textContent='#linen-controls{position:fixed;z-index:50;left:18px;right:18px;bottom:18px;width:max-content;max-width:calc(100% - 36px);padding:13px 17px;background:#152022ec;border:1px solid #52615b;border-radius:10px;color:#e1e6d8;font:13px/1.5 system-ui}#linen-controls b{font-size:18px;margin-right:14px}#linen-controls span,#linen-controls small{color:#9bb0a5}#linen-controls div{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0 5px}#linen-controls button{background:#263632;color:#e1e6d8;border:1px solid #53655c;border-radius:5px;padding:7px 11px;cursor:pointer}.compact-panel,.hud,.worldLabel{display:none!important}@media(max-width:600px){#linen-controls{left:10px;right:10px;bottom:10px;padding:10px;max-width:calc(100% - 20px)}#linen-controls span{font-size:11px}#linen-controls button{padding:6px 9px;font-size:12px}}';
 document.head.append(style);document.body.append(panel);
 panel.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;
  if(b.dataset.view)api.focus(b.dataset.view);
  if(b.dataset.action==='world'){api.studio=!api.studio;b.textContent=api.studio?'显示场景':'纯色背景';lab.render();}
  if(b.dataset.action==='turn'){lab.agent.paused=false;lab.setAuto(true);lab.command('向左转90度');}
  if(b.dataset.action==='pause'){lab.agent.paused=!lab.agent.paused;b.textContent=lab.agent.paused?'继续动作':'暂停动作';}
 });
 lab.settings.close();lab.setCameraFollow(false);api.focus('angle');return api;
}
