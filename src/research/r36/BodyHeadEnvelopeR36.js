/* Known complete-person head inputs outside person.state also affect neck
 * normals. Unknown archive data are retained; known unmatched inputs cannot be
 * silently certified against a fixed source template. */
(()=>{'use strict';
function key(x){if(x===null)return'z';if(x===undefined)return'u';if(typeof x==='number')return'n'+(Object.is(x,-0)?'-0':String(x));if(typeof x==='string')return's'+JSON.stringify(x);if(typeof x==='boolean')return x?'t':'f';if(Array.isArray(x)||ArrayBuffer.isView(x)&&!(x instanceof DataView))return'['+Array.from(x,key).join(',')+']';if(typeof x==='object')return'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+key(x[k])).join(',')+'}';throw Error('Unknown complete-person head value');}
function create(reference){const omitted=new Set(['state','proceduralBodySurface','restoredLighting','bodyFunctionSystem','bodyReconstruction']),fields=Object.keys(reference).filter(k=>!omitted.has(k)),value=(p,k)=>{const v=p?.[k];if(k!=='skinInspection'||!v)return v;const copy={...v};delete copy.camera;delete copy.view;return copy;};
 function check(archive){const person=archive?.person;if(!person)return{compatible:false,field:null};for(const field of fields)if(key(value(reference,field))!==key(value(person,field)))return{compatible:false,field};return{compatible:true,field:null};}
 return{check,compatible:archive=>check(archive).compatible};
}
globalThis.BodyHeadEnvelopeR29={create};
})();
