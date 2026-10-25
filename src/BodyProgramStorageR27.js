/* Consume a verified transport packet once. Preserve every typed coefficient
 * bit and the original duplicate-view identity; do not rename source arrays
 * or claim conversion of the retained source calibration. */
(()=>{'use strict';
const types=new Set(['Float64Array','Float32Array','Uint32Array','Int32Array','Uint16Array','Int16Array','Uint8Array','Uint8ClampedArray','Int8Array']);
function consume(raw,{shared=true}={}){
 if(!(raw instanceof ArrayBuffer)||raw.byteLength<4)throw Error('Invalid body coefficient buffer');
 const transportRawBytes=raw.byteLength,size=new DataView(raw).getUint32(0,true),start=4+size;if(start>raw.byteLength)throw Error('Invalid body coefficient header');
 const header=JSON.parse(new TextDecoder().decode(new Uint8Array(raw,4,size))),payloadBytes=raw.byteLength-start;if(!Array.isArray(header.arrays))throw Error('Missing body coefficient directory');
 const descriptors=header.arrays.map(a=>{if(!types.has(a.type)||!Number.isSafeInteger(a.offset)||a.offset<0||!Number.isSafeInteger(a.length)||a.length<0)throw Error('Invalid body coefficient view');const T=globalThis[a.type],bytes=a.length*T.BYTES_PER_ELEMENT;if(!Number.isSafeInteger(bytes)||a.offset+bytes>payloadBytes)throw Error('Body coefficient view outside packet');return{...a,T,bytes,key:a.type+':'+a.offset+':'+a.length};});
 let sharedReason=null;const ranges=[...new Map(descriptors.filter(a=>a.bytes).map(a=>[a.key,a])).values()].sort((a,b)=>a.offset-b.offset);
 for(let i=1;i<ranges.length;i++)if(ranges[i].offset<ranges[i-1].offset+ranges[i-1].bytes)sharedReason='distinct original views overlap';
 const relocation=new Map;let alignedBytes=0;for(const a of ranges){alignedBytes=Math.ceil(alignedBytes/8)*8;relocation.set(a.key,alignedBytes);if(alignedBytes>start+a.offset)sharedReason='in-place relocation could overwrite unread source';alignedBytes+=a.bytes;}for(const a of descriptors)if(!a.bytes)relocation.set(a.key,0);
 if(alignedBytes>raw.byteLength)sharedReason='aligned payload exceeds verified container';
 const useShared=shared&&!sharedReason;let backing=null,shrunk=false;
 if(useShared){const bytes=new Uint8Array(raw);for(const a of ranges)bytes.copyWithin(relocation.get(a.key),start+a.offset,start+a.offset+a.bytes);backing=raw;if(typeof raw.transferToFixedLength==='function'){backing=raw.transferToFixedLength(alignedBytes);shrunk=true;}}
 const cache=new Map;let allocatedCoefficientBytes=0;
 const arrays=descriptors.map(a=>{if(cache.has(a.key))return cache.get(a.key);const view=useShared?new a.T(backing,relocation.get(a.key),a.length):new a.T(new Uint8Array(raw,start+a.offset,a.bytes).slice().buffer);cache.set(a.key,view);allocatedCoefficientBytes+=view.byteLength;return view;});
 function unpack(x){if(x&&x.$array!==undefined){if(!Number.isSafeInteger(x.$array)||!arrays[x.$array])throw Error('Invalid body coefficient reference');return arrays[x.$array];}if(x&&x.$map)return new Map(x.$map.map(([k,v])=>[k,unpack(v)]));if(x&&x.$set)return new Set(x.$set);if(Array.isArray(x))return x.map(unpack);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,unpack(v)]));return x;}
 return{program:unpack(header.tree),arrays,report:{version:'BODY-PROGRAM-STORAGE-R27',transportRawBytes,payloadBytes,alignedPayloadBytes:alignedBytes,logicalArrays:arrays.length,uniqueArrays:cache.size,allocatedCoefficientBytes,sharedCoefficientBacking:useShared,coefficientBackingBuffers:useShared?1:cache.size,retainedCoefficientBackingBytes:useShared?backing.byteLength:allocatedCoefficientBytes,extraCoefficientAllocationBytes:useShared?0:allocatedCoefficientBytes,payloadRelocatedInPlace:useShared,relocatedBytes:useShared?allocatedCoefficientBytes:0,unusedHeaderTailReleased:shrunk,sharedFallbackReason:sharedReason,originalDuplicateViewsPreserved:true,distinctViewOverlapIntroduced:false,bitExactStorage:true}};
}
globalThis.BodyProgramStorageR27={consume};
})();
