import * as T from 'three';
// One host allocation per source geometry, never cache numeric IDs across realms.
export function geometryCopier(){
 const geometries=new WeakMap(),interleaved=new WeakMap();
 function attribute(a){
  let out;
  if(a.isInterleavedBufferAttribute){let data=interleaved.get(a.data);if(!data){const Type=globalThis[Object.prototype.toString.call(a.data.array).slice(8,-1)];data=a.data.isInstancedInterleavedBuffer?new T.InstancedInterleavedBuffer(new Type(a.data.array),a.data.stride,a.data.meshPerAttribute):new T.InterleavedBuffer(new Type(a.data.array),a.data.stride);data.setUsage(a.data.usage);interleaved.set(a.data,data);}out=new T.InterleavedBufferAttribute(data,a.itemSize,a.offset,a.normalized);}
  else{const Type=globalThis[Object.prototype.toString.call(a.array).slice(8,-1)],array=new Type(a.array);out=a.isInstancedBufferAttribute?new T.InstancedBufferAttribute(array,a.itemSize,a.normalized,a.meshPerAttribute):new T.BufferAttribute(array,a.itemSize,a.normalized);out.setUsage(a.usage);out.gpuType=a.gpuType;}
  out.name=a.name;return out;
 }
 return source=>{
  if(geometries.has(source))return geometries.get(source);
  const g=source.isInstancedBufferGeometry?new T.InstancedBufferGeometry():new T.BufferGeometry();geometries.set(source,g);
  for(const [name,a]of Object.entries(source.attributes))g.setAttribute(name,attribute(a));
  if(source.index)g.setIndex(attribute(source.index));
  for(const [name,list]of Object.entries(source.morphAttributes))g.morphAttributes[name]=list.map(attribute);
  g.morphTargetsRelative=source.morphTargetsRelative;g.groups=source.groups.map(x=>({...x}));g.setDrawRange(source.drawRange.start,source.drawRange.count);g.name=source.name;
  if(source.boundingBox)g.boundingBox=new T.Box3().copy(source.boundingBox);
  if(source.boundingSphere)g.boundingSphere=new T.Sphere().copy(source.boundingSphere);
  if(source.isInstancedBufferGeometry)g.instanceCount=source.instanceCount;return g;
 };
}
export function disposeTree(root,textures=[]){
 const geometries=new Set(),materials=new Set(),skeletons=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);});
 for(const s of skeletons)s.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of new Set(textures))t.dispose();
}
