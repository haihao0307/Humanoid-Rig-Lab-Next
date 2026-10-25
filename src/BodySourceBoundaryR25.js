/* Fixed original display must not ignore a different saved head-side boundary.
 * Only hashes of existing reference inputs are used; no head surface is made. */
(()=>{'use strict';
function stateKey(x){if(x===null)return'z';if(typeof x==='number')return'n'+(Object.is(x,-0)?'-0':String(x));if(typeof x==='string')return's'+JSON.stringify(x);if(typeof x==='boolean')return x?'t':'f';if(x===undefined)return'u';if(Array.isArray(x)||ArrayBuffer.isView(x)&&!(x instanceof DataView))return'['+Array.from(x,stateKey).join(',')+']';if(typeof x==='object')return'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stateKey(x[k])).join(',')+'}';throw Error('Unsupported source boundary value');}
function create(profiles,records){
 async function requireCompatible(archive){const packet=archive?.person?.bodyFunctionSystem?.headBoundary;if(packet==null)return{boundary:'original implicit reference',compatible:true};const profile=profiles.find(p=>stateKey(p.state)===stateKey(archive.person.state)),record=records.profiles.find(p=>p.id===profile?.id);if(!record)throw Error('当前头侧边界尚未匹配原貌状态，请在参数页保留当前人物。');const raw=new TextEncoder().encode(stateKey(packet)),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==record.packetSHA256)throw Error('当前人物携带不同的头侧边界，原貌页不能忽略它。请继续在参数页使用或保存当前人物。');return{boundary:profile.id,compatible:true};}
 return{requireCompatible,report:()=>({referenceStates:records.profiles.length,headGenerated:false,differentBoundarySilentlyIgnored:false})};
}
globalThis.BodySourceBoundaryR25={create,stateKey};
})();
