/* Dedicated numeric sampler only. No person archives, head program, original
 * coefficient package, DOM, rendering or surface connectivity are transferred. */
'use strict';let samplerR27=null;
self.onmessage=e=>{try{if(e.data.type==='init'){samplerR27=BodyFieldSamplerR27.create(e.data.input);self.postMessage({type:'ready'});}else if(e.data.type==='slab'){if(!samplerR27)throw Error('Sampler not initialized');const j=e.data.job,result=samplerR27.region(j.bounds,j.spacing,j.maximum,j.local,j.first,j.last);self.postMessage({type:'slab',id:j.id,result},[result.field.buffer,...(result.normalField?[result.normalField.buffer]:[])]);}else throw Error('Unknown sampler request');}catch(error){self.postMessage({type:'error',error:error.stack});}};
