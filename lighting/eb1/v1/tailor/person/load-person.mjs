import {sha} from '../source-contract.mjs';
export async function loadPerson(onProgress=()=>{}){
 const m=await(await fetch(new URL('../assets/PERSON_MANIFEST.json',import.meta.url))).json();onProgress({fraction:.1});
 const response=await fetch(new URL('../assets/native-person.json.gz',import.meta.url));if(!response.ok)throw Error('原人物快照不可用');const bytes=await response.arrayBuffer();
 if(await sha(bytes)!==m.fileSHA256)throw Error('原人物快照哈希不符');onProgress({fraction:.55});
 const p=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
 const fields=p.skinFields;for(const k of ['rest','regions','extra','types'])fields[k]=Float32Array.from(fields[k]);
 const model={positions:Float32Array.from(p.positions),faces:Uint32Array.from(p.faces),vertexCount:p.vertexCount,bodyCount:p.bodyCount,canonical:p.canonical,state:p.state,archive:()=>p.archive,precomputedSkinRegions:fields};
 if(await sha(model.positions.buffer)!==m.geometrySHA256||await sha(model.faces.buffer)!==m.topologySHA256)throw Error('人物几何或拓扑不匹配');
 const actor={rig:p.rig,positions:model.positions.slice(),faces:model.faces,bodyCount:p.bodyCount,boneOrder:p.boneOrder,headSkinIndices:p.canonical.headSkinIndices,headSkinWeights:p.canonical.headSkinWeights};
 onProgress({fraction:1});return{model,actor,manifest:m};
}
