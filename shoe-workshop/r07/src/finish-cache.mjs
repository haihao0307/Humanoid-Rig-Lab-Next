/** Bounded session-only cache: the generated default form plus the current form.
 * No baked geometry is shipped. Restore all contact frames, not only visible mesh buffers.
 */
const fields=['cachedParts','currentParts','seatRays','seating','quarterSeating','fittedSole','soleFinishReport','threadCache'];
export function captureDefault(model,key,defaultKey){if(key!==defaultKey)return;model.defaultSnapshot={key,values:Object.fromEntries(fields.map(k=>[k,model[k]]))};}
export function restoreDefault(model,key,state){const saved=model.defaultSnapshot;if(!saved||saved.key!==key)return null;Object.assign(model,saved.values);model.geometryKey=key;model.state=state;model.frameCache=new Map();model.cacheHits=(model.cacheHits||0)+1;model.defaultCacheHits=(model.defaultCacheHits||0)+1;return model.cachedParts;}
export function captureDefaultThread(model){if(model.defaultSnapshot?.key===model.geometryKey)model.defaultSnapshot.values.threadCache=model.threadCache;}
