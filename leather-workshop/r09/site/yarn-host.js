/** Semantic front/rear carriers for the wallet's shared three-layer saddle seam.
 * Hole passages blend two material frames; no camera/world-nearest reassignment.
 */
const originalBinding=PanelAssembly.prototype.binding;
PanelAssembly.prototype.yarnBinding=function(path,panel,u,v,p,n){
 const front=originalBinding.call(this,panel,u,v,p,n);
 if(!front||panel.name!=='wallet-panel-2'||path!==panel.paths[0])return front;
 const rear=this.parts.find(q=>q.name==='wallet-panel-0');
 if(!rear)throw Error('Wallet shared seam rear carrier missing');
 const back=originalBinding.call(this,rear,u,v-17,p,n);
 const z=p.clone().sub(panel.map(u,v)).dot(panel.normal(u,v));
 const blend=Math.max(0,Math.min(1,(panel.t/2-z)/path.t));
 return{...front,idsB:back.ids,weightsB:back.weights,deltaB:back.delta,normalB:back.normal,blend:[blend]};
};
