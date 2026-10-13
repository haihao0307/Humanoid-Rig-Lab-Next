/** The original R04 renderer is in its own window. Its WebGLAttributes uses
 * instanceof Float32Array, which rejects parent-realm arrays even at the same
 * Three version. Preserve every numeric value but adopt the target realm before
 * first upload. This also covers offscreen leather-baking quad geometry. */
export function adoptRendererRealm(scene,realm,seen,stats){
 const allowed=new Set(['Float32Array','Float64Array','Uint32Array','Uint16Array','Uint8Array','Int32Array','Int16Array','Int8Array','Uint8ClampedArray']);
 scene.traverse?.(o=>{const g=o.geometry;if(!g||seen.has(g))return;const attrs=[...Object.values(g.attributes),g.index,...Object.values(g.morphAttributes||{}).flat()].filter(Boolean);for(const a of attrs){const target=a.isInterleavedBufferAttribute?a.data:a,name=target.array?.constructor?.name;if(!allowed.has(name))continue;const C=realm[name];if(typeof C!=='function')throw Error('Target typed-array constructor missing');if(!(target.array instanceof C)){const old=target.array,next=new C(old);if(next.length!==old.length)throw Error('Realm transfer length changed');for(let i=0;i<old.length;i++)if(!Object.is(old[i],next[i]))throw Error('Realm transfer changed geometry values');target.array=next;target.needsUpdate=true;stats.transferredArrays++;stats.transferredBytes+=next.byteLength;}}seen.add(g);});
}
