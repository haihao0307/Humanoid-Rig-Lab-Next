/* Isolated P1.3 candidate. Keep the target source shape at rest; compose only
 * relative movement from a validated support reference. No geometry is made. */
(()=>{'use strict';
const M=BodyMathR01;
function key(v){if(v===undefined)return'u';if(v===null)return'z';if(typeof v==='number')return'n'+(Object.is(v,-0)?'-0':String(v));if(typeof v==='string')return's'+JSON.stringify(v);if(typeof v==='boolean')return v?'t':'f';if(Array.isArray(v)||ArrayBuffer.isView(v))return'['+Array.from(v,key).join(',')+']';if(typeof v==='object')return'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+key(v[k])).join(',')+'}';throw Error('Unsupported support input');}
function family(state){const s=structuredClone(state);if(s?.owners?.rig!=='anny'||!s.anny?.phenotypes)throw Error('Shared support is currently limited to original Anny profiles');delete s.anny.phenotypes.weight;delete s.anny.phenotypes.muscle;s.anny.pose={};s.anny.translations={};return key(s);}
function isZero(pose){return Object.values(pose).every(v=>{const a=Array.isArray(v)?v:[...(v.rotation||[0,0,0]),...(v.translation||[0,0,0])];return a.every(x=>x===0);});}
function evaluate(target,pose,reference){
 if(!reference||family(target.state)!==family(reference.state))throw Error('Reference changes more than the approved weight/muscle variables');
 for(const k of ['labels','parents','order'])if(key(target.rig[k])!==key(reference.rig[k]))throw Error('Reference binding identity differs: '+k);
 if(target.rig.kind||reference.rig.kind)throw Error('Only original Anny support is in this candidate');
 const targetNow=BodyPoseFunctionsR29.matrices(target,pose);
 // When the chosen reference is this very source profile, avoid an inverse /
 // multiply round trip; the opt-in operation must leave its motion bit exact.
 if(target.id===reference.id&&key(target.state)===key(reference.state)&&key(target.rig)===key(reference.rig))return{transforms:targetNow,headSkin:null,zeroPosePreserved:true,reference:reference.id,identicalReference:true};
 if(isZero(pose))return{transforms:targetNow,headSkin:null,zeroPosePreserved:true,reference:reference.id};
 const refZero=BodyPoseFunctionsR29.matrices(reference,{}),refMoved=BodyPoseFunctionsR29.matrices(reference,pose),targetZero=BodyPoseFunctionsR29.matrices(target,{}),targetHeadZero=BodySourceHeadR29.evaluate(target.headBoundaryFunctions,target.state,{}).skin;
 const delta=refMoved.map((m,j)=>M.mul(m,M.inverse(refZero[j]))),transforms=delta.map((m,j)=>M.mul(m,targetZero[j])),headSkin=delta.map((m,j)=>M.mul(m,targetHeadZero[j]));
 if([...transforms,...headSkin].some(m=>!Array.from(m).every(Number.isFinite)))throw Error('Support movement is nonfinite');
 return{transforms,headSkin,zeroPosePreserved:true,reference:reference.id};
}
globalThis.BodyLockedSupportP1={evaluate};
})();
