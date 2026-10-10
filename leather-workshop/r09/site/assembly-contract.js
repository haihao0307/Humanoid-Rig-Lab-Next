/** Physical assembly semantics. No rest-distance-wide collision exclusions.
 * Local seam allowances are explicit bonded/cut-edge neighbourhoods only.
 */
import {PanelAssembly} from './panels.js';
const addPart=PanelAssembly.prototype.add;
PanelAssembly.prototype.add=function(input){const d={...input};
 if(/jacket-[01]-(sleeve|folded-cuff)/.test(d.name)){const map=d.map;d.map=(u,v)=>map(((u+d.w/2)%d.w+d.w)%d.w-d.w/2,v);}
 if(d.name==='bag-shaped-flap')d.simStep=12;
 if(d.name==='leather-hatband')d.simStep=12;
 if(d.name.startsWith('woven-'))d.simStep=Math.max(2,(this.config.weaveMM||8)/3);
 if(['diamond','grid','channels'].includes(this.config.craft))d.formed=true;
 if(/jacket-[01]-folded-cuff/.test(d.name))d.simStep=12;
 if(d.name==='sewn-belt'){d.simStep=12;d.formed=true;d.restCurvatureProvenance='stored roll, formed-curvature assumption; not flat leather calibration';}
 if(d.name==='folded-leather-keeper')d.simStep=3.2;
 return addPart.call(this,d);
};
const connectPart=PanelAssembly.prototype.connect;
PanelAssembly.prototype.connect=function(a,uvA,b,uvB){connectPart.call(this,a,uvA,b,uvB);
 if(!this.collisionSeams)this.collisionSeams=[];
 const pair=[a.name,b.name].sort().join('/');
 const allowance=pair.includes('bag-back')&&pair.includes('bag-shaped-flap')?18:pair.includes('tricorn-fold-fastener')?12:Math.max(3,2*(a.t+b.t));
 this.collisionSeams.push({a:a.index,b:b.index,pointA:a.map(...uvA).toArray(),pointB:b.map(...uvB).toArray(),allowanceMM:allowance,reason:'explicit sewn/bonded material connection'});
};
const finishAssembly=PanelAssembly.prototype.finish;
PanelAssembly.prototype.finish=function(){const root=finishAssembly.call(this),r=root.userData.rig,data=r.data,nodeParts=Array(r.nodeCount).fill(-1);
 for(const p of this.parts)for(const rec of p.lookup)for(const id of rec.ids)nodeParts[id]=p.index;
 data.nodeParts=nodeParts;data.partNames=this.parts.map(p=>p.name);
 data.collisionSeams=(this.collisionSeams||[]).map(q=>({...q,pointA:q.pointA.map((v,i)=>(v+(i===1?r.bindingShift:0))*.001),pointB:q.pointB.map((v,i)=>(v+(i===1?r.bindingShift:0))*.001),allowance:q.allowanceMM*.001}));
 return root;
};
