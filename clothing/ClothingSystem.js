// Per-character clothing ownership. Motion supplies a committed skeleton;
// garments return display deformation only and never write body/task state.
class ClothingSystem {
 constructor(surface){this.surface=surface;this.garments=new Map();this.disposed=false;this.updates=0;}
 add(id,garment){
  if(this.disposed||this.garments.has(id))throw Error('服装实例已释放或重复：'+id);
  this.garments.set(id,garment);return garment;
 }
 update(){
  if(this.disposed)return;
  const surface=this.surface,human=surface.boundHuman,time=surface.lab.agent?.time||0;
  const signature=['hips','left_foot','right_foot','left_hand','right_hand'].map(id=>{const f=human.byId.get(id).world;return [...f.p,...f.q].join(',');}).join('|');
  if(time===this.lastTime&&signature===this.lastSignature)return;
  if(time===this.lastTime&&signature!==this.lastSignature)this.reset();
  this.lastTime=time;this.lastSignature=signature;
  const frame={human,time,statureScale:surface.statureScale,poseAuthority:'committed-body-fk'};
  for(const garment of this.garments.values())if(garment.update(frame))this.updates++;
 }
 draw(depth){if(!this.disposed)for(const garment of this.garments.values())garment.draw(depth);}
 setSimulation(enabled){if(this.disposed)throw Error('服装实例已释放');for(const garment of this.garments.values())garment.setSimulation?.(enabled);this.reset();}
 reset(){this.lastTime=null;this.lastSignature=null;for(const garment of this.garments.values())garment.reset();}
 report(){return{revision:'clothing-system/v1',garments:[...this.garments].map(([id,g])=>({id,...g.report})),updates:this.updates,bodyFeedback:false,taskAuthority:false,visualAcceptance:false};}
 dispose(){if(this.disposed)return;this.disposed=true;for(const garment of this.garments.values())garment.dispose();this.garments.clear();}
}
