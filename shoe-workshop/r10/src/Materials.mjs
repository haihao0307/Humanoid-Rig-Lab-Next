import * as T from 'three';
import {ShoeMaterials as Retained} from '../../r09/src/materials.mjs';
import {recipe} from './Presets.mjs';
/** Leather kernels are retained. Woven cloth is a separate surface shader,
 * not a leather colour preset or a calibrated cloth force model. */
export class Materials extends Retained{
 constructor(renderer,data){super(renderer,data);this.fabrics=new Map();}
 textile(kind){if(this.fabrics.has(kind))return this.fabrics.get(kind);const N=256,c=document.createElement('canvas');c.width=c.height=N;const a=c.getContext('2d').createImageData(N,N),normal=document.createElement('canvas');normal.width=normal.height=N;const b=normal.getContext('2d').createImageData(N,N),height=(x,y)=>{const X=(x+N)%N,Y=(y+N)%N,rx=X%8,ry=Y%8,diagonal=kind==='herringbone'?(Math.floor(Y/32)%2?X-Y:X+Y):X+Y;return kind==='canvas'?.5*Math.cos(rx/8*Math.PI*2)+.5*Math.cos(ry/8*Math.PI*2):.65*Math.cos(diagonal/16*Math.PI*2)+.22*Math.cos(rx/8*Math.PI*2);};for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=(y*N+x)*4,v=height(x,y),h=Math.round(211+v*28);a.data.set([h,h,h,255],i);const nx=-(height(x+1,y)-height(x-1,y))*.45,ny=-(height(x,y+1)-height(x,y-1))*.45,len=Math.hypot(nx,ny,1);b.data.set([Math.round(128+127*nx/len),Math.round(128+127*ny/len),Math.round(128+127/len),255],i);}c.getContext('2d').putImageData(a,0,0);normal.getContext('2d').putImageData(b,0,0);const map=new T.CanvasTexture(c),nm=new T.CanvasTexture(normal);map.colorSpace=T.SRGBColorSpace;for(const t of [map,nm]){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(12,12);t.anisotropy=4;}const out={map,normalMap:nm};this.fabrics.set(kind,out);return out;}
 part(d,p){const [id,color]=recipe(d.partId,p),cloth=['canvas','denim','herringbone'].includes(id);const s={leatherId:cloth?'heritage':id,materialSet:'uniform',partLeather:{[d.partId]:cloth?'heritage':id},material:'leather',wire:false,cutaway:false};const mats=super.shell({id:d.partId,kind:d.partKind},s,null);
  if(cloth){mats[0].dispose();mats[0]=new T.MeshPhysicalMaterial({color,roughness:.91,sheen:.3,sheenColor:'#ded6c9',normalScale:new T.Vector2(.36,.36),side:T.DoubleSide,...this.textile(id)});}
  else if(![19,29].includes(d.partId)){const source=new T.Color(this.current.params.color),target=new T.Color(color);mats[0].color.r*=target.r/Math.max(1e-5,source.r);mats[0].color.g*=target.g/Math.max(1e-5,source.g);mats[0].color.b*=target.b/Math.max(1e-5,source.b);}
  for(const m of mats)m.userData={...m.userData,r10Role:'part',partId:d.partId,recipe:id};return mats;
 }
 get(d,p){const s={material:'leather',wire:false,cutaway:false,threadDiameter:.38};if(d.kind==='part')return this.part(d,p);if(d.kind==='sole')return super.sole(s,null);if(d.kind==='hardware')return super.hardware(s,null);if(d.kind==='thread'){const m=super.yarn(s,null);m.color.set(p.thread);return m;}
  const tx=this.textile('binding'),map=tx.map.clone(),nm=tx.normalMap.clone();map.repeat.set(1,1);nm.repeat.set(1,1);return new T.MeshPhysicalMaterial({color:p.trim,map,normalMap:nm,normalScale:new T.Vector2(.19,.19),roughness:.83,sheen:.3,sheenColor:'#d1c3a9',side:T.DoubleSide,userData:{r10Role:'binding',wrapsCutWall:true,r10PrivateMaps:true}});
 }
}
