// The isolated gray preview draws only positions and normals. Its source
// renderer can otherwise spend time propagating skin colors and lip-material
// fields that this preview never consumes. This gate is scoped to a single
// viewer update and must not be used for skin, eyelashes, or character export.
export function installGrayOnlyMaterialPropagationGate(viewer){
 const one=name=>{const map=viewer[name];if(!map||map.size!==1)throw Error('人物表面层级已变化：'+name);return [...map.values()][0];};
 const surface=one('surfaces'),eye=one('ocularSurfaces'),lip=one('lipSurfaces'),fold=one('foldSurfaces'),anatomy=one('anatomySurfaces'),ear=one('earSurfaces');
 const geometries=new Set([viewer.nativeGeometry,...surface.levels.map(x=>x.geometry),eye.geometry,...lip.layers.map(x=>x.geometry),...fold.layers.map(x=>x.geometry),anatomy.geometry,ear.geometry]);
 const update=viewer.update;let enabled=true,disposed=false;
 const replacement=function(){
  if(!enabled)return update.apply(this,arguments);
  const colors=[...geometries].map(g=>({g,has:Object.hasOwn(g.attributes,'color'),color:g.attributes.color})),hidden=[],foldUpdate=fold.update,anatomyUpdate=anatomy.update,skinUpdate=viewer.skin.update;
  function hide(g){for(const name of ['l19State','l19Detail']){const value=g.attributes[name];if(value){hidden.push({g,name,value});delete g.attributes[name];}}}
  try{
   viewer.skin.update=()=>{};
   for(const {g} of colors)g.attributes.color=null;
   fold.update=function(){const value=foldUpdate.apply(this,arguments);hide(this.source);for(const layer of this.layers)hide(layer.geometry);return value;};
   anatomy.update=function(){const value=anatomyUpdate.apply(this,arguments);hide(this.geometry);return value;};
   return update.apply(this,arguments);
  }finally{
   for(const {g,name,value} of hidden)g.attributes[name]=value;
   for(const {g,has,color} of colors){if(has)g.attributes.color=color;else delete g.attributes.color;}
   fold.update=foldUpdate;anatomy.update=anatomyUpdate;viewer.skin.update=skinUpdate;
  }
 };
 viewer.update=replacement;
 return Object.freeze({grayOnly:true,setEnabled(value){enabled=!!value;},dispose(){if(disposed)return;disposed=true;if(viewer.update===replacement)viewer.update=update;}});
}
