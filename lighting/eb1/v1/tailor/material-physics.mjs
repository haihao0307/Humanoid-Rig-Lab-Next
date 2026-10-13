import {ClothSolver as BaseClothSolver,BodySDF,dihedral,GRAVITY} from './cloth-physics.mjs';
export {BodySDF,dihedral,GRAVITY};
/** Stabilized integration; deliberately leaves the interrupted source checkpoint intact. */
export class ClothSolver extends BaseClothSolver {
 constructor(packet,positions,options={}){super(packet,positions,{clearanceMM:4,...options});
  this.p.fill(0);const counts=new Uint32Array(this.count);for(let i=0;i<this.map.length;i++){const g=this.map[i];counts[g]++;for(let k=0;k<3;k++)this.p[g*3+k]+=positions[i*3+k];}for(let i=0;i<this.count;i++){for(let k=0;k<3;k++)this.p[i*3+k]/=counts[i];this.w[i]=1/Math.max(1e-7,this.mass[i]);}
  for(let i=0;i<8;i++)this.projectContacts(true);this.pins=[];if(this.role==='bottom'){let ymax=-Infinity;for(let i=1;i<this.p.length;i+=3)ymax=Math.max(ymax,this.p[i]);for(let i=0;i<this.count;i++)if(this.p[3*i+1]>ymax-.0035){this.w[i]=0;this.pins.push(i);}}
  this.initial=this.p.slice();this.v.fill(0);this.expand();
 }
 set(options){for(const [key,value]of Object.entries(options))if(!Number.isFinite(value))throw Error('PHYSICS_PARAMETER_NOT_FINITE');Object.assign(this.settings,options);}
 step(dt=1/30){if(!Number.isFinite(dt)||dt<0||dt>.101)throw Error('CLOTH_DT_RANGE');const sub=Math.max(1,Math.ceil(dt*240)),h=dt/sub;if(h===0)return;const p=this.p,v=this.v,w=this.w,s=this.settings;this.contacts=0;
  for(let ss=0;ss<sub;ss++){this.old.set(p);const damp=Math.exp(-s.damping*h);for(let i=0;i<this.count;i++){const j=i*3;if(!w[i])continue;for(let k=0;k<3;k++)p[j+k]+=v[j+k]*damp*h;p[j+1]-=GRAVITY*s.gravity*h*h;}
   for(const e of this.edges)e.lambda=0;for(const b of this.bends)b.lambda=0;
   for(let it=0;it<16;it++){for(const e of this.edges)this.distance(e,h);if(it%2===0)for(const b of this.bends)this.bending(b,h);this.strainGuard();this.projectContacts(it===15);}
   for(let guard=0;guard<12;guard++){this.strainGuard();this.projectContacts(guard===11);}this.projectContacts(false);
   for(let i=0;i<p.length;i++){if(!Number.isFinite(p[i])||Math.abs(p[i]-this.initial[i])>.45){this.p.set(this.old);this.v.fill(0);this.safetyTrips++;throw Error('物理超出安全范围，已暂停并保留上一帧');}v[i]=(p[i]-this.old[i])/h;}
   for(let i=0;i<this.count;i++){if(!w[i]||!this.sdf)continue;const j=i*3,q=this.sdf.sample(p[j],p[j+1],p[j+2],this.contactSample);if(q[0]<s.clearanceMM*.001+.0012){const l=Math.hypot(q[1],q[2],q[3]);if(l>.1){const nx=q[1]/l,ny=q[2]/l,nz=q[3]/l,vn=v[j]*nx+v[j+1]*ny+v[j+2]*nz,f=Math.exp(-32*h);v[j]=(v[j]-vn*nx)*f+Math.max(0,vn)*nx;v[j+1]=(v[j+1]-vn*ny)*f+Math.max(0,vn)*ny;v[j+2]=(v[j+2]-vn*nz)*f+Math.max(0,vn)*nz;}}}
   this.time+=h;this.steps++;
  }this.expand();
 }
 audit(dense=false){let min=Infinity,minInterior=Infinity,maxMove=0,minRatio=Infinity,maxRatio=0;const p=this.p,q=this.contactSample;for(let i=0;i<this.count;i++){const j=i*3;if(this.sdf)min=Math.min(min,this.sdf.sample(p[j],p[j+1],p[j+2],q)[0]);maxMove=Math.max(maxMove,Math.hypot(p[j]-this.initial[j],p[j+1]-this.initial[j+1],p[j+2]-this.initial[j+2]));}
  for(const e of this.edges){const a=e.a*3,b=e.b*3,r=Math.hypot(p[a]-p[b],p[a+1]-p[b+1],p[a+2]-p[b+2])/e.rest;minRatio=Math.min(minRatio,r);maxRatio=Math.max(maxRatio,r);if(dense&&this.sdf)minInterior=Math.min(minInterior,this.sdf.sample((p[a]+p[b])*.5,(p[a+1]+p[b+1])*.5,(p[a+2]+p[b+2])*.5,q)[0]);}
  if(dense&&this.sdf)for(let f=0;f<this.faces.length;f+=3){const a=this.faces[f]*3,b=this.faces[f+1]*3,c=this.faces[f+2]*3;minInterior=Math.min(minInterior,this.sdf.sample((p[a]+p[b]+p[c])/3,(p[a+1]+p[b+1]+p[c+1])/3,(p[a+2]+p[b+2]+p[c+2])/3,q)[0]);}
  let seamGap=0;for(const [a,b]of this.seamPairs)seamGap=Math.max(seamGap,Math.hypot(...[0,1,2].map(k=>this.output[a*3+k]-this.output[b*3+k])));
  return{type:'XPBD-distance-and-dihedral',gravityMS2:GRAVITY*this.settings.gravity,seconds:this.time,substeps:this.steps,particles:this.count,originalVertices:this.map.length,sewnPairs:this.seamPairs.length,seamGapMM:seamGap*1000,waistAnchors:this.pins.length,shoulderAnchors:0,distanceConstraints:this.edges.length,dihedralConstraints:this.bends.length,minBodyVertexDistanceMM:min*1000,minBodyInteriorSampleMM:minInterior*1000,maxMoveMM:maxMove*1000,minEdgeStretch:minRatio,maxEdgeStretch:maxRatio,contactCorrections:this.contacts,safetyTrips:this.safetyTrips,densityKgM2:this.density,materialCalibrated:false,continuousCollision:false,restMetric:'original flat paper',kinematicShapeAttraction:false,strainGuard:'engineering limits, not fabric calibration'};}
}
