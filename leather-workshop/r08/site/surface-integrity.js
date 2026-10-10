import * as T from 'three';
import {PanelAssembly} from './panels.js';
// A domain adapter, executed before any R07 product is constructed. Frozen R05
// and R06 sources are not changed. Needle apertures must not be filled by a
// contour-index shift caused by duplicated closing points.
const cleanPaperRing=points=>{
 const ring=[];for(const point of points)if(!ring.length||point.distanceTo(ring.at(-1))>1e-8)ring.push(point.clone());
 while(ring.length>1&&ring[0].distanceTo(ring.at(-1))<1e-8)ring.pop();return ring;
};
const rawPanelAdd=PanelAssembly.prototype.add;
PanelAssembly.prototype.add=function(input){
 const def={...input};
 const shape=def.shape?def.shape.clone():new T.Shape().moveTo(-def.w/2,-def.h/2).lineTo(def.w/2,-def.h/2).lineTo(def.w/2,def.h/2).lineTo(-def.w/2,def.h/2).closePath();
 const get=shape.getPoints.bind(shape);shape.getPoints=divisions=>cleanPaperRing(get(divisions));
 for(const hole of shape.holes){const getHole=hole.getPoints.bind(hole);hole.getPoints=divisions=>cleanPaperRing(getHole(divisions));}
 def.shape=shape;
 // Rounded low crown within the same tricorn crown boundary. This changes the
 // actual shell reference surface, not merely a shading or texture illusion.
 if(def.name==='obsolete-polar-crown-top'&&this.parts[0]?.name==='tricorn-crown'){
  const map=def.map;def.map=(u,v)=>{const p=map(u,v),r=v/def.h+.5;p.y+=10*(1-r*r);return p;};
 }
 def.closedU=[-.43,0,.43].every(f=>def.map(-def.w/2,def.h*f).distanceTo(def.map(def.w/2,def.h*f))<1e-5);
 def.closedV=[-.43,0,.43].every(f=>def.map(def.w*f,-def.h/2).distanceTo(def.map(def.w*f,def.h/2))<1e-5);
 return rawPanelAdd.call(this,def);
};
const rawPanelBuild=PanelAssembly.prototype.buildPanel;
PanelAssembly.prototype.buildPanel=function(part){
 rawPanelBuild.call(this,part);
 const geometry=part.mesh.geometry,uv=geometry.attributes.uv,position=geometry.attributes.position,index=geometry.index,newIndex=[],groups=[];
 let removed=0;
 for(const group of geometry.groups){const start=newIndex.length;
  for(let i=group.start;i<group.start+group.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
   if(group.materialIndex===2){
    const isU=part.closedU&&[-1,1].some(sign=>ids.every(id=>Math.abs(uv.getX(id)*96-sign*part.w/2)<.001));
    const isV=part.closedV&&[-1,1].some(sign=>ids.every(id=>Math.abs(uv.getY(id)*96-sign*part.h/2)<.001));
    const a=new T.Vector3().fromBufferAttribute(position,ids[0]),b=new T.Vector3().fromBufferAttribute(position,ids[1]),c=new T.Vector3().fromBufferAttribute(position,ids[2]);
    if(isU||isV||b.sub(a).cross(c.sub(a)).lengthSq()<1e-18){removed++;continue;}
   }
   newIndex.push(...ids);
  }
  groups.push({start,count:newIndex.length-start,materialIndex:group.materialIndex});
 }
 geometry.setIndex(newIndex);geometry.clearGroups();for(const group of groups)geometry.addGroup(group.start,group.count,group.materialIndex);
 geometry.userData.periodicFalseWallTrianglesRemoved=removed;
 geometry.userData.normalizedPaperContour=true;
};
