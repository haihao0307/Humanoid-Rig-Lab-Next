import {controlValue} from './parameter-schema.js';
// V1: a score selects a registered instrument; imported files never supply executable code.
export const ENGINES=Object.freeze({K4:{id:'kaopu/quad',version:'K4.0.0'},K5:{id:'kaopu/mammal',version:'K5.0.0'},GLB:{id:'kaopu/gltf',version:'1.0.0'}});
export const MAX_GLB=64*1024*1024,MAX_FILE=90*1024*1024;
export const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
export function parameters(x){if(!plain(x))throw Error('乐谱 parameters 必须是参数对象');const out={};for(const [key,v]of Object.entries(x)){if(['__proto__','constructor','prototype'].includes(key)||key.length>80||!['string','number','boolean'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v)||typeof v==='string'&&v.length>200)throw Error('乐谱参数格式无效：'+key);out[key]=v;}return out;}
export function compatible(actual,expected){return plain(actual)&&actual.id===expected.id&&actual.version===expected.version&&(!expected.assetSha256||actual.assetSha256===expected.assetSha256);}
export async function sha(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
export function unbase64(s){if(typeof s!=='string'||s.length>Math.ceil(MAX_GLB/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw Error('动物包内的 GLB 数据无效或超过 64 MiB');return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
export function validateGLB(bytes){
 if(bytes.length<28||bytes.length>MAX_GLB)throw Error('GLB 文件需要在 28 字节到 64 MiB 之间');const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==bytes.length)throw Error('需要完整的 glTF 2.0 二进制 .glb 文件');let json,offset=12,binLength=0;
 while(offset<bytes.length){if(offset+8>bytes.length)throw Error('GLB 数据块截断');const n=d.getUint32(offset,true),type=d.getUint32(offset+4,true);if(n%4||offset+8+n>bytes.length)throw Error('GLB 数据块长度无效');if(offset===12&&type!==0x4e4f534a)throw Error('GLB 缺少 JSON 首块');if(type===0x4e4f534a){if(json)throw Error('GLB 存在重复 JSON 块');try{json=JSON.parse(new TextDecoder().decode(bytes.subarray(offset+8,offset+8+n)));}catch{throw Error('GLB JSON 无效');}}if(type===0x004e4942)binLength=n;offset+=8+n;}
 if(json?.asset?.version!=='2.0'||!json.meshes?.length)throw Error('GLB 缺少 glTF 2.0 动物网格');
 const blocked=['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu'];for(const x of json.extensionsUsed||[])if(blocked.includes(x))throw Error('首版不支持 '+x+'；请导出未压缩网格、PNG/JPEG 内嵌贴图');
 const supported=['KHR_lights_punctual','KHR_materials_clearcoat','KHR_materials_dispersion','KHR_materials_ior','KHR_materials_iridescence','KHR_materials_sheen','KHR_materials_specular','KHR_materials_transmission','KHR_materials_unlit','KHR_materials_volume','KHR_materials_anisotropy','KHR_texture_transform','EXT_texture_webp','EXT_mesh_gpu_instancing'];for(const x of json.extensionsRequired||[])if(!supported.includes(x))throw Error('缺少此 GLB 必需扩展的乐器：'+x);
 function uris(o){if(!o||typeof o!=='object')return;for(const [k,v]of Object.entries(o)){if(k==='uri'&&(typeof v!=='string'||!/^data:(image\/(png|jpeg|webp)|application\/octet-stream);base64,/i.test(v)))throw Error('GLB 包含外部文件引用；请把模型、骨架和贴图全部内嵌');if(v&&typeof v==='object')uris(v);}}uris(json);
 for(const b of json.buffers||[])if(!b.uri&&(!binLength||b.byteLength>binLength))throw Error('GLB 内嵌顶点数据不完整');let vertices=0;for(const m of json.meshes)for(const p of m.primitives||[])vertices+=json.accessors?.[p.attributes?.POSITION]?.count||0;if(!vertices||vertices>2000000)throw Error('首版支持 1 到 200 万个网格顶点');return json;
}
export function validateSettings(values,controls,actions){
 for(const [key,value]of Object.entries(parameters(values))){const d=controls.find(c=>c.key===key);if(!d){if(key==='action'&&actions.some(a=>a.id===value)||key==='playing'&&typeof value==='boolean'||key==='view'&&['three','front','side','top'].includes(value))continue;throw Error('当前乐器不支持乐谱参数：'+key);}
 controlValue(d,value);
 }
}
export function storeImports(){let dbPromise;const db=()=>dbPromise??=new Promise((resolve,reject)=>{const q=indexedDB.open('animal-atlas-instruments',1);q.onupgradeneeded=()=>q.result.createObjectStore('animals',{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('导入库正被其他窗口占用'));});async function run(mode,operation){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('animals',mode),q=operation(tx.objectStore('animals'));let result;q.onsuccess=()=>result=q.result;tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('导入库写入失败'));});}return{all:()=>run('readonly',s=>s.getAll()),put:r=>run('readwrite',s=>s.put(r)),remove:id=>run('readwrite',s=>s.delete(id))};}
