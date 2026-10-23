/* Project-owned body control routing. One atomic operation edits variables;
 * independent degrees of freedom and complete legacy archives are retained. */
(()=>{'use strict';
const clone=x=>structuredClone(x);
function isBody(c){if(c.group==='anny.phenotypes')return true;if(c.group==='anny.localChanges')return !/cheek|chin|ear-|eyebrow|eye-|forehead|head-|mouth|nose|lip|jaw/i.test(c.path.at(-1));if(c.group==='anny.pose'||c.group==='anny.translations')return !/^(neck\d+|head|eye\.[LR])$/.test(c.path[2]);if(c.group==='mhr.identity'||c.group==='mhr.correctives')return true;if(c.group==='mhr.pose')return !/head|neck|jaw|eye/i.test(c.label);return false;}
const primaryNames={gender:'sex',age:'age',muscle:'muscle',weight:'weight',height:'height',proportions:'proportions',cupsize:'chestVolume',firmness:'chestFirmness',african:'basisA',asian:'basisB',caucasian:'basisC'};
function createBodyControlR17({catalog,getState,isBusy,commit}){
 const byId=new Map(),legacy=new Map(),records=[],pairs=new Map();
 for(const c of catalog.filter(isBody)){let id;if(c.group==='anny.phenotypes')id='shape.'+primaryNames[c.path.at(-1)];else if(c.group==='anny.localChanges')id='local.'+c.path.at(-1);else if(c.group==='anny.pose')id='pose.A.'+c.path[2]+'.'+c.path.at(-1);else if(c.group==='anny.translations')id='translation.A.'+c.path[2]+'.'+c.path.at(-1);else if(c.group==='mhr.identity')id='identity.B.'+c.path.at(-1);else if(c.group==='mhr.pose')id='pose.B.'+c.path.at(-1);else id='correctives.B';
  if(byId.has(id))throw Error('Duplicate own control identity '+id);
  const record={id,legacyKey:c.key,label:c.label,path:clone(c.path),bounds:clone(c.bounds),unit:c.unit||'',kind:c.group==='mhr.correctives'?'boolean':'number',group:c.group,activeRig:c.group==='anny.pose'||c.group==='anny.translations'?'A':c.group==='mhr.pose'||c.group==='mhr.correctives'?'B':'both'};
  byId.set(id,record);legacy.set(c.key,record);records.push(record);
  const name=c.path.at(-1);if(c.group==='anny.localChanges'&&typeof name==='string'&&/^[lr]-/.test(name)){const key=name.slice(2);if(!pairs.has(key))pairs.set(key,{});pairs.get(key)[name[0]]=record;}
 }
 const bilateral=[...pairs].filter(([,p])=>p.l&&p.r).map(([name,p])=>({id:'symmetric.'+name,label:name,left:p.l.id,right:p.r.id,bounds:clone(p.l.bounds)})),both=new Map(bilateral.map(p=>[p.id,p]));
 const read=(state,path)=>path.reduce((v,k)=>v?.[k],state),write=(state,path,value)=>{let o=state;for(let i=0;i<path.length-1;i++){if(o[path[i]]===undefined)o[path[i]]=typeof path[i+1]==='number'?[0,0,0]:{};o=o[path[i]];}o[path.at(-1)]=value;};
 function plan(request){if(!request||typeof request!=='object'||Array.isArray(request))throw Error('Expected a body operation');for(const k of Object.keys(request))if(!['set','rig','label'].includes(k))throw Error('Unknown operation field '+k);const current=getState();if(!current)throw Error('Body is not ready');const next=clone(current),changes=[],targets=new Map();if(request.rig!==undefined&&!['A','B'].includes(request.rig))throw Error('Rig must be A or B');const rig=request.rig??(next.owners.rig==='mhr'?'B':'A');if(request.rig!==undefined)next.owners.rig=rig==='A'?'anny':'mhr';if(request.set!==undefined&&(!request.set||typeof request.set!=='object'||Array.isArray(request.set)))throw Error('set must contain named values');
  function add(id,value){const c=byId.get(id)||legacy.get(id);if(!c)throw Error('Unknown or non-body control '+id);if(c.kind==='boolean'){if(typeof value!=='boolean')throw Error('Expected boolean '+id);}else{if(typeof value!=='number'||!Number.isFinite(value))throw Error('Expected finite number '+id);if(c.bounds&&(value<c.bounds[0]||value>c.bounds[1]))throw Error('Out of range '+id);}if(targets.has(c.id)&&!Object.is(targets.get(c.id),value))throw Error('Conflicting values '+c.id);targets.set(c.id,value);if(c.activeRig!=='both'&&c.activeRig!==rig)throw Error('Control requires rig '+c.activeRig+': '+id);}
  for(const[id,value]of Object.entries(request.set||{})){const pair=both.get(id);if(pair){add(pair.left,value);add(pair.right,value);}else add(id,value);}
  for(const[id,value]of targets){const c=byId.get(id),before=read(next,c.path)??0;if(!Object.is(before,value)){changes.push({id,legacyKey:c.legacyKey,before,after:value});write(next,c.path,value);}}
  const rigChanged=current.owners.rig!==next.owners.rig;return{state:next,changes,rigChanged,changed:rigChanged||changes.length>0,label:typeof request.label==='string'?request.label.slice(0,160):'',rig};
 }
 function apply(request){if(isBusy())throw Error('Body update in progress');const p=plan(request);if(p.changed)commit(p);return{changed:p.changed,changes:clone(p.changes),rig:p.rig,rebuilds:p.changed?1:0};}
 return{schema:'body-control/1',apply,preview:request=>{const{state,...r}=plan(request);return clone(r);},describe:()=>({schema:'body-control/1',catalogRetained:catalog.length,bodyControls:records.length,controls:clone(records),symmetricControls:clone(bilateral),sourceDerivedCalibration:true,independentDegreesDeleted:0}),isBody};
}
globalThis.createBodyControlR17=createBodyControlR17;
})();
