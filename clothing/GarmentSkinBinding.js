// A narrow garment attachment field copied from the character's own skin.
// Rest positions and weights are generated in memory, never baked assets.
class GarmentSkinBinding {
 constructor(meshes,point,{columns=96,levels=[0,.07,.22,.4],scale=1,allowedJoints=null}={}){
  this.columns=columns;this.levels=levels;this.pins=[];
  for(const t of levels)for(let c=0;c<columns;c++)this.pins.push({p:point(c/columns*Math.PI*2,t),distance:Infinity,influences:null});
  for(const mesh of meshes)if(mesh.name==='skin')for(let i=0;i<mesh.vertices;i++){
   if(allowedJoints){let weight=0;for(let k=0;k<8;k++)if(allowedJoints.has(mesh.binding.ids[i*8+k]))weight+=mesh.binding.weights[i*8+k]/65535;if(weight<.95)continue;}
   const p=[-(mesh.positions[i*3]*mesh.extent[0]+mesh.origin[0]),mesh.positions[i*3+1]*mesh.extent[1]+mesh.origin[1],mesh.positions[i*3+2]*mesh.extent[2]+mesh.origin[2]];
   for(const pin of this.pins){
    if(Math.abs(p[1]-pin.p[1])>.06*scale)continue;
    const d=(p[0]-pin.p[0])**2+(p[1]-pin.p[1])**2+(p[2]-pin.p[2])**2;if(d>=pin.distance)continue;
    pin.distance=d;pin.skin=p;pin.influences=Array.from({length:8},(_,k)=>[mesh.binding.ids[i*8+k],mesh.binding.weights[i*8+k]/65535]).filter(([,w])=>w>0);
   }
  }
  if(this.pins.some(p=>!p.influences?.length))throw Error('服装腰部缺少同源皮肤绑定');
  this.jointIndices=[...new Set(this.pins.flatMap(p=>p.influences.map(([i])=>i)))];
  this.data=new Float32Array(this.pins.length*4);
 }
 update(transforms,muscles,scale,pelvisIndex){
  let maximumDeltaM=0,maximumWaistDeltaM=0;
  for(let i=0;i<this.pins.length;i++){
   const pin=this.pins[i],bound=r2DeformTissuePoint(pin.p,pin.influences,transforms,muscles,scale,[0,0,0]),rigid=r2DeformPoint(pin.p,[[pelvisIndex,1]],transforms);
   const delta=bound.map((v,k)=>v-rigid[k]),distance=Math.hypot(...delta);this.data.set(delta,i*4);maximumDeltaM=Math.max(maximumDeltaM,distance);if(i<this.columns)maximumWaistDeltaM=Math.max(maximumWaistDeltaM,distance);
  }
  return {maximumDeltaM,maximumWaistDeltaM};
 }
}
