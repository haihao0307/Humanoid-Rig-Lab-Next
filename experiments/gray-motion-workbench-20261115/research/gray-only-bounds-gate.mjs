// The isolated gray workbench draws with its own camera and never uses the
// legacy renderer's per-stage bounding volumes. Do not apply this to the
// original renderer, skin views or character archives.
export function installGrayOnlyBoundsGate(viewer){
 const one=name=>{const m=viewer[name];if(!m||m.size!==1)throw Error('人物表面层级已变化');return [...m.values()][0];},surface=one('surfaces'),eye=one('ocularSurfaces'),lip=one('lipSurfaces'),fold=one('foldSurfaces'),anatomy=one('anatomySurfaces'),ear=one('earSurfaces');
 const all=new Set([viewer.nativeGeometry,...surface.levels.map(x=>x.geometry),eye.geometry,...lip.layers.map(x=>x.geometry),...fold.layers.map(x=>x.geometry),anatomy.geometry,ear.geometry]),saved=[];
 for(const g of all){const sphere=g.computeBoundingSphere,box=g.computeBoundingBox,skip=()=>{};g.computeBoundingSphere=skip;g.computeBoundingBox=skip;saved.push({g,sphere,box,skip});}
 let disposed=false;return Object.freeze({grayOnly:true,dispose(){if(disposed)return;disposed=true;for(const x of saved){if(x.g.computeBoundingSphere===x.skip)x.g.computeBoundingSphere=x.sphere;if(x.g.computeBoundingBox===x.skip)x.g.computeBoundingBox=x.box;}}});
}
