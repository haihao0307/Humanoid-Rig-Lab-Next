import * as T from 'three';
import {STYLES,makeLast} from './kernel.mjs';
import {createFlexContext,flexPart} from './deformation.mjs';
import {buildPenny,buildChelsea} from './penny-chelsea.mjs';
import {buildMonk,buildCanvas} from './monk-canvas.mjs';
import {buildSoles} from './soles.mjs';
export {STYLES};
export function buildStyle(id,params={}){
 const style=STYLES.find(s=>s.id===id);if(!style)throw Error('未知鞋款 '+id);
 const last=makeLast(style,params),t=performance.now(),builders={penny:buildPenny,chelsea:buildChelsea,monk:buildMonk,canvas:buildCanvas};
 const parts=[...builders[id](last),...buildSoles(last)],ids=new Set();
 const flex=createFlexContext(last,last.params.bend,parts.flatMap(d=>d.attachment?.frame?[d.attachment]:[]));
 for(const d of parts){
  if(ids.has(d.id))throw Error('重复部件 '+d.id);ids.add(d.id);
  const g=d.geometry,count=g.attributes.position.count;
  for(const attribute of['craftEdge','compression'])if(!g.hasAttribute(attribute))g.setAttribute(attribute,new T.Float32BufferAttribute(new Float32Array(count),1));
  if(!g.attributes.position.array.every(Number.isFinite))throw Error('非有限几何 '+d.id);
  flexPart(d,flex);
 }
 const bounds=new T.Box3();for(const d of parts)bounds.union(d.geometry.boundingBox);
 return {style,last,parts,report:{id,generated:true,externalMeshImport:false,units:'mm',designParameters:last.params,measuredBoundsMm:bounds.getSize(new T.Vector3()).toArray(),parts:parts.map(({geometry,...d})=>({...d,vertices:geometry.attributes.position.count,triangles:geometry.index.count/3})),triangles:parts.reduce((n,d)=>n+d.geometry.index.count/3,0),generationMs:performance.now()-t,materialCalibrated:false,manufacturingValidated:false,wearerFitValidated:false,forceSolved:false,flexAxis:'design location 0.63L; anatomical calibration pending'}};
}
