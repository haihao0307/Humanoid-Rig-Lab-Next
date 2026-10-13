import * as T from 'three';
import {ShoeMaterials as Leather,CATALOGUE} from '../../r09/src/materials.mjs';
import {panelRecipe} from './Presets.mjs';
export class Materials extends Leather{
 constructor(renderer,scan){super(renderer,scan);this.woven=new Map();}
 select(id){if(!this.cache.has(id)){const c=CATALOGUE.find(c=>c.id===id);if(!c)throw Error('Unknown retained leather');this.cache.set(id,this.library.create(c,1024));}this.current=this.cache.get(id);this.id=id;return this.current;}
 forDef(d,preset,transparent=false){
  const s={leatherId:'heritage',materialSet:'uniform',partLeather:{},material:'leather',cutaway:false,wire:false};let m;
  if(d.kind==='panel'){
   const [recipe,color]=panelRecipe(preset,d.partId);const textile=['canvas','denim','twill'].includes(recipe);s.partLeather[d.partId]=textile?'nubuck':recipe;
   m=super.shell({id:d.partId,kind:d.panelKind},s,null);const base=this.current.params.color;
   if(d.partId!==29){const target=new T.Color(color),from=new T.Color(base);m[0].color.r*=target.r/Math.max(from.r,.001);m[0].color.g*=target.g/Math.max(from.g,.001);m[0].color.b*=target.b/Math.max(from.b,.001);}
   if(textile&&![19,29].includes(d.partId)){m[0].dispose();m[0]=this.fabric(recipe,color);}
   for(const a of m){a.transparent=transparent;a.opacity=transparent?.32:1;a.depthWrite=!transparent;}
  }else if(d.kind==='trim'){m=this.fabric('binding',preset.trim);m.side=T.DoubleSide;}
  else if(d.kind==='thread')m=super.yarn(s,null);
  else if(d.kind==='hardware')m=super.hardware(s,null);
  else m=super.sole(s,null);
  return m;
 }
 fabric(kind,color){
  if(!this.woven.has(kind)){
   const size=256,heights=new Float32Array(size*size),map=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),period=kind==='binding'?8:kind==='denim'?12:16;
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){const ax=x/period,ay=y/period,ix=Math.floor(ax),iy=Math.floor(ay),over=kind==='denim'?((ix+iy)%3<2):((ix+iy)%2===0),u=over?ax:ay,v=over?ay:ax;heights[y*size+x]=.5+.25*Math.cos(u*Math.PI*2)+.08*Math.cos(v*Math.PI*2)+.015*Math.sin(x*1.7+y*2.13);}
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){const k=(y*size+x)*4,h=heights[y*size+x],v=228+26*h;map.set([v,v,v,255],k);const dx=(heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size])*.65,dy=(heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x])*.65,N=new T.Vector3(-dx,-dy,1).normalize();normal.set([127.5*(N.x+1),127.5*(N.y+1),127.5*(N.z+1),255],k);}
   const make=(a,srgb=false)=>{const t=new T.DataTexture(a,size,size,T.RGBAFormat);t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.repeat.set(5,5);t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());t.needsUpdate=true;return t;};this.woven.set(kind,{map:make(map,true),normalMap:make(normal)});
  }
  const m=new T.MeshPhysicalMaterial({color,roughness:kind==='binding'?.76:.90,sheen:.28,sheenColor:new T.Color(color),metalness:0,side:T.DoubleSide,...this.woven.get(kind),normalScale:new T.Vector2(.35,.35)});m.userData={kind,source:'R10 self-authored periodic interlaced appearance, mipmapped',clothPhysics:false};return m;
 }
}
