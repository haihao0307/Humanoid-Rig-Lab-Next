/* Conservative identity of equivalent source input spellings. This does not
 * round parameters, match nearby poses or ignore head/unknown state fields.
 * The original state is never modified or replaced in the person's archive. */
(()=>{'use strict';
const key=x=>{if(x===null)return'z';if(typeof x==='number')return'n'+(Object.is(x,-0)?'-0':String(x));if(typeof x==='string')return's'+JSON.stringify(x);if(typeof x==='boolean')return x?'t':'f';if(x===undefined)return'u';if(Array.isArray(x)||ArrayBuffer.isView(x)&&!(x instanceof DataView))return'['+Array.from(x,key).join(',')+']';if(typeof x==='object')return'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+key(x[k])).join(',')+'}';throw Error('Unsupported person state value');};
function create(contract){
 if(contract?.schema!=='body-source-state-identity/1')throw Error('Body state identity contract missing');
 const bones=new Set(contract.annyBones),locals=new Set(contract.annyLocals),list=x=>(Array.isArray(x)||ArrayBuffer.isView(x)&&!(x instanceof DataView))&&x.length===3&&Array.from(x).every(v=>typeof v==='number'&&Number.isFinite(v)),zero=x=>x.every(v=>Object.is(v,0));
 function canonical(state){
  const out=structuredClone(state),a=out?.anny;if(!a||typeof a!=='object')return out;
  // Do not make unknown or malformed inputs eligible for a fixed source state.
  const rotations=a.pose||{},translations=a.translations||{};
  if(Array.isArray(rotations)||Array.isArray(translations)||typeof rotations!=='object'||typeof translations!=='object')return out;
  const pose={},offset={};
  for(const name of new Set([...Object.keys(rotations),...Object.keys(translations)])){
   if(!bones.has(name))return out;
   const raw=rotations[name];
   if(raw&&typeof raw==='object'&&!Array.isArray(raw)&&!ArrayBuffer.isView(raw)&&Object.keys(raw).some(k=>!['rotation','translation'].includes(k)))return out;
   const r=(raw?.rotation||raw)??[0,0,0],t=translations[name]||raw?.translation||[0,0,0];
   if(!list(r)||!list(t))return out;
   if(!zero(r))pose[name]=Array.from(r);
   if(!zero(t))offset[name]=Array.from(t);
  }
  a.pose=pose;a.translations=offset;
  if(a.localChanges&&typeof a.localChanges==='object'&&!Array.isArray(a.localChanges))for(const[name,value]of Object.entries(a.localChanges))if(locals.has(name)&&Object.is(value,0))delete a.localChanges[name];
  return out;
 }
 const stateKey=state=>key(canonical(state));
 return{canonical,key:stateKey,equal:(a,b)=>stateKey(a)===stateKey(b),match:(profiles,state)=>profiles.find(p=>stateKey(p.state)===stateKey(state))||null,report:()=>({schema:contract.schema,parameterQuantization:false,nearbyStateMatching:false,headStateIgnored:false,unknownStateFieldsIgnored:false,originalArchiveMutated:false})};
}
globalThis.BodyStateIdentityR26={create};
})();
