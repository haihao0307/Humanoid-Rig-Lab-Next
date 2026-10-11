import * as T from 'three';
import {AtelierMaterials,CATALOGUE} from '../vendor/r06/site/catalogue.js';
export {CATALOGUE};
export class ShoeMaterials{
 constructor(renderer,scan){this.library=new AtelierMaterials(renderer,scan);this.current=null;this.cache=new Map();this.renderer=renderer;}
 async init(){await this.library.appearance.load(this.library.data);for(const t of Object.values(this.library.appearance.textures)){t.wrapS=t.wrapT=T.MirroredRepeatWrapping;t.repeat.set(96/150,96/75);t.offset.set(0,0);}this.select('heritage');}
 select(id){if(!this.cache.has(id)){const c=CATALOGUE.find(c=>c.id===id);if(!c)throw Error('Unknown R10 material');this.cache.set(id,this.library.create(c,innerWidth<761?1024:2048));}this.current=this.cache.get(id);this.id=id;while(this.cache.size>3){const oldest=[...this.cache.keys()].find(k=>k!==id);this.cache.get(oldest).dispose();this.cache.delete(oldest);}return this.current;}
 shell(part,state,plane){const clip=state.cutaway?[plane]:[];if(state.material==='clay')return ['#c6c2b7','#b1a68f','#766a59'].map(color=>new T.MeshStandardMaterial({color,roughness:.75,side:T.DoubleSide,wireframe:state.wire,clippingPlanes:clip}));
 const source=this.current.material,outer=source.clone();outer.onBeforeCompile=source.onBeforeCompile;outer.customProgramCacheKey=source.customProgramCacheKey;outer.userData={...source.userData};outer.side=T.DoubleSide;outer.wireframe=state.wire;outer.clippingPlanes=clip;outer.clipShadows=true;
 // R10's original grain remains untouched; flesh/cut finishes are inherited R05 roles.
 const look=this.current.params,inside=this.library.appearance.flesh(look),edge=this.library.appearance.cut(look);inside.vertexColors=false;inside.side=edge.side=T.DoubleSide;inside.wireframe=edge.wireframe=state.wire;inside.clippingPlanes=edge.clippingPlanes=clip;inside.clipShadows=edge.clipShadows=true;
 if(part.kind==='sole'){outer.color.multiplyScalar(.7);outer.roughness=Math.max(.5,outer.roughness);}
 return [outer,inside,edge];}
 sole(state,plane){return new T.MeshPhysicalMaterial({color:state.material==='clay'?'#625c53':'#30221c',roughness:.6,clearcoat:.08,side:T.DoubleSide,clippingPlanes:state.cutaway?[plane]:[]});}
 yarn(state,plane,lace=false){return new T.MeshPhysicalMaterial({color:lace?'#493429':'#a8875c',roughness:.82,sheen:.25,sheenColor:new T.Color(lace?'#564232':'#c9a979'),side:T.DoubleSide,clippingPlanes:state.cutaway?[plane]:[]});}
 report(){return {id:this.id,source:this.current.source,parameters:{...this.current.params},mapChannels:['map','normalMap','roughnessMap'].filter(k=>!!this.current.material[k]),cacheSize:this.cache.size,sourceGeometryScale:'rest millimetres / 96; preserve R10 repeat and mirror-normal parity',physicalCalibration:false};}
 dispose(){for(const e of this.cache.values())e.dispose();for(const t of Object.values(this.library.appearance.textures))t.dispose();this.cache.clear();}
}
