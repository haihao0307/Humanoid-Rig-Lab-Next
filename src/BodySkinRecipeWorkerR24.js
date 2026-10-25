/* Rebuild original material fields from the frozen authored functions and seed.
 * This worker creates no character geometry and changes no person controls. */
(()=>{'use strict';
function buildFields(recipe,onProgress=()=>{}){
 onProgress('graph');
 const graph=SkinGraphKernel.build(recipe.options),maps={gmMesoMap:graph.mesoMap,gmPoreMap:graph.poreMap,gmWrinkleMap:graph.wrinkleMap};
 onProgress('contents');const contents=AppendageAtlas.build(SkinGraphKernel,recipe.options);
 maps.gmCavityMap={mips:graph.cavityMap.mips.map((m,level)=>{const own=contents.mips[level];if(!own||own.width!==m.width||own.height!==m.height)throw Error('Original pore field level mismatch');const data=new Uint16Array(m.width*m.height*4);for(let i=0;i<m.data.length;i++){data[i*4]=m.data[i];for(let c=0;c<3;c++)data[i*4+1+c]=SkinGraphKernel.half(own.data[i*3+c]/255);}return{width:m.width,height:m.height,data};})};
 const fields={};for(const entry of recipe.fields){const mips=maps[entry.name]?.mips;if(!mips||mips.length!==entry.levels)throw Error('Original field recipe mismatch');const bytes=mips.reduce((n,m)=>n+m.data.byteLength,0),raw=new Uint8Array(bytes);let at=0;for(const m of mips){raw.set(new Uint8Array(m.data.buffer,m.data.byteOffset,m.data.byteLength),at);at+=m.data.byteLength;}fields[entry.name]=raw.buffer;}
 return fields;
}
globalThis.BodySkinRecipeWorkerR24={buildFields};
if(typeof WorkerGlobalScope!=='undefined'&&self instanceof WorkerGlobalScope)self.onmessage=event=>{if(event.data.type!=='build')return;const started=performance.now();try{const fields=buildFields(event.data.recipe,stage=>self.postMessage({type:'progress',stage}));self.postMessage({type:'fields',fields,generationMS:performance.now()-started},Object.values(fields));}catch(error){self.postMessage({type:'error',error:error.stack||String(error)});}};
})();
