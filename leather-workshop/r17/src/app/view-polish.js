function applyMacroView(id){
 if(mode!=='products'||id!=='macro'||!hero?.userData.rig)return;
 const rig=hero.userData.rig;
 const panel=['cowboy','pirate'].includes(product)?rig.parts.find(p=>p.name==='leather-hatband'):product==='wallet'?rig.parts.find(p=>p.name==='wallet-panel-2'):product==='bag'?rig.parts.find(p=>p.name==='bag-front'):rig.parts[0];
 const path=panel?.paths[0];if(!path)return;
 const frame=path.frame(path.length*.5),u=frame.uv.x,v=frame.uv.y,normal=panel.normal(u,v);
 target.copy(panel.map(u,v)).addScaledVector(normal,panel.t/2).add(V(0,rig.bindingShift,0));
 yaw=Math.atan2(normal.x,normal.z);pitch=Math.max(.18,Math.min(.9,Math.asin(Math.max(-1,Math.min(1,normal.y)))));
 distance=product==='wallet'?26:product==='swatch'?32:product==='bag'?62:42;
 renderer.shadowMap.needsUpdate=true;invalidateView();revision++;
}
