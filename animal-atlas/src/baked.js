// The warehouse's portable output is data, not an animal generator.
import {validateBasic,meshBounds} from './basic-data.js';
import {LIVE_BAKE_SCHEMA,validateLiveRuntime} from './live-package.js';
export const BAKE_SCHEMA='kaopu/bake@1',REHEARSAL_SCHEMA='kaopu/rehearsal@1';
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function bakeAnimal(items,source){
 const bake={schema:BAKE_SCHEMA,animal:{id:source.animalId,name:source.name,category:source.category||'land'},source,representation:{kind:'static-current-pose',upAxis:'Y',units:'source-units',materialScope:'base-PBR; custom shaders stay in original runtime'},meshes:items.map(m=>({...m,material:{...m.material,...(m.material?.color?{color:m.material.color.map(v=>Math.max(0,Math.min(1,v)))}:{})},positions:Array.from(m.positions),indices:Array.from(m.indices),...(m.colors?{colors:Array.from(m.colors)}:{}),...(m.uv?{uv:Array.from(m.uv)}:{}),...(m.texture?{texture:Array.from(m.texture)}:{})}))};validateBake(bake);if(source.basicData)bake.representation.boundsMetres=meshBounds(bake.meshes).size.map(v=>v*source.basicData.metersPerUnit);return bake;
}
export function validateBake(bake){
 if(bake?.source?.basicData!==undefined&&bake.source.basicData!==null)validateBasic(bake.source.basicData);
 if(![BAKE_SCHEMA,LIVE_BAKE_SCHEMA].includes(bake?.schema)||typeof bake.animal?.name!=='string'||!bake.animal.name.trim()||bake.animal.name.length>60||!Array.isArray(bake.meshes)||!bake.meshes.length||bake.meshes.length>2000)throw Error('不是有效的靠谱烘焙对象');if(bake.schema===LIVE_BAKE_SCHEMA)validateLiveRuntime(bake.runtime);
 let vertices=0;for(const m of bake.meshes){if(!Array.isArray(m.positions)||!m.positions.length||m.positions.length%3||m.positions.some(v=>!finite(v,-1e6,1e6)))throw Error('烘焙对象顶点无效');const n=m.positions.length/3;vertices+=n;if(vertices>2e6)throw Error('烘焙对象超过 200 万顶点');if(!Array.isArray(m.indices)||!m.indices.length||m.indices.length>12e6||m.indices.length%3||m.indices.some(v=>!Number.isInteger(v)||v<0||v>=n))throw Error('烘焙对象索引无效');for(const [key,stride]of [['colors',3],['uv',2]])if(m[key]&&( !Array.isArray(m[key])||m[key].length!==n*stride||m[key].some(v=>!finite(v,-1e6,1e6))))throw Error('烘焙对象 '+key+' 无效');if(m.texture&&(!Array.isArray(m.texture)||m.texture.length>20*1048576||m.texture.some(v=>!Number.isInteger(v)||v<0||v>255)||!['image/png','image/jpeg','image/webp'].includes(m.textureMime)))throw Error('烘焙对象贴图无效');const a=m.material;if(a){if(a.color&&(!Array.isArray(a.color)||a.color.length!==3||a.color.some(v=>!finite(v,0,1))))throw Error('材质颜色无效');for(const k of ['roughness','metalness','opacity'])if(a[k]!==undefined&&!finite(a[k],0,1))throw Error('材质参数无效');}}
 return bake;
}
export function validateRehearsal(doc){
 if(doc?.units!==undefined&&!['meters','display-units'].includes(doc.units))throw Error('排练单位无效');
 if(doc?.playing!==undefined&&typeof doc.playing!=='boolean')throw Error('排练播放状态需为布尔值');
 if(doc?.schema!==REHEARSAL_SCHEMA||!Array.isArray(doc.assets)||!Array.isArray(doc.actors)||!doc.actors.length||doc.actors.length>24||doc.assets.length>24)throw Error('排练谱需包含 1–24 个对象');
 const assets=new Set(),ids=new Set();let total=0;for(const b of doc.assets){validateBake(b);if(typeof b.assetId!=='string'||assets.has(b.assetId))throw Error('烘焙资源 ID 重复或缺失');assets.add(b.assetId);total+=b.meshes.reduce((n,m)=>n+m.positions.length/3,0);}if(total>4e6)throw Error('排练谱总顶点超过 400 万');
 for(const a of doc.actors){if(typeof a.id!=='string'||ids.has(a.id)||!assets.has(a.assetId)||typeof a.name!=='string'||a.name.length>60)throw Error('排练对象引用无效');ids.add(a.id);for(const k of ['x','y','z'])if(!finite(a[k],-30,30))throw Error('排练位置越界');if(!finite(a.scale,.1,5)||!finite(a.yaw,-360,360)||!finite(a.speed,0,3)||!['still','approach','follow','avoid','orbit','face'].includes(a.mode))throw Error('排练参数无效');}
 for(const a of doc.actors){if(a.target&&(!ids.has(a.target)||a.target===a.id))throw Error('排练关系对象无效');if(a.lifePlaying!==undefined&&typeof a.lifePlaying!=='boolean'||a.action!==undefined&&(typeof a.action!=='string'||a.action.length>200))throw Error('排练生命活动参数无效');}
 const s=doc.environment||{};if(!finite(s.ambient,0,3)||!finite(s.key,0,5)||!finite(s.exposure,.2,2)||!finite(s.angle,-180,180)||!/^#[0-9a-f]{6}$/i.test(s.background))throw Error('排练光线参数无效');return doc;
}
