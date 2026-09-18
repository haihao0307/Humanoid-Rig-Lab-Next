// Authored plant-fibre clothing, generated from the current personal surface.
// Closed opaque underlayer provides coverage; overlapping blades add detail.
// A small contact drape keeps neighbouring fibres connected during floor poses.
// This is a kinematic clothing approximation, not measured cloth mechanics.
class GarmentClothSolver {
 constructor(point,{columns=32,rows=12,iterations=6,frequency=60,floorY=.006}={}){
  if(!Number.isInteger(columns)||columns<8||columns>128||!Number.isInteger(rows)||rows<2||rows>32||!Number.isInteger(iterations)||iterations<1||iterations>24||!Number.isFinite(frequency)||frequency<15||frequency>120||!Number.isFinite(floorY))throw Error('服装求解预算或地面参数无效');
  this.settings=Object.freeze({columns,rows,iterations,frequency,floorY});
  this.columns=columns;this.rows=rows;this.rest=new Float64Array(columns*(rows+1)*3);this.positions=this.rest.slice();this.previous=this.rest.slice();this.edges=[];this.triangles=[];
  const addEdge=(a,b,weight)=>{const at=a*3,bt=b*3,d=Math.hypot(...[0,1,2].map(k=>this.rest[at+k]-this.rest[bt+k]));this.edges.push([at,bt,d,weight]);};
  for(let y=0;y<=rows;y++)for(let x=0;x<columns;x++)this.rest.set(point(x/columns*Math.PI*2,y/rows),(y*columns+x)*3);
  for(let y=0;y<=rows;y++)for(let x=0;x<columns;x++){
   const id=y*columns+x;addEdge(id,y*columns+(x+1)%columns,1);
   if(y<rows){addEdge(id,id+columns,1);addEdge(id,(y+1)*columns+(x+1)%columns,.55);addEdge(id,(y+1)*columns+(x+columns-1)%columns,.55);const b=y*columns+(x+1)%columns,c=id+columns,d=(y+1)*columns+(x+1)%columns;this.triangles.push([id*3,b*3,c*3],[b*3,d*3,c*3]);}
   if(y+2<=rows)addEdge(id,id+2*columns,.3);
  }
  this.textureData=new Float32Array(columns*(rows+1)*8);this.initialized=false;this.lastTime=null;
 }
 separate(p,i,limbs){
  for(let c=0;c<limbs.length;c+=8){
   const ax=limbs[c],ay=limbs[c+1],az=limbs[c+2],bx=limbs[c+4],by=limbs[c+5],bz=limbs[c+6],maxR=Math.max(limbs[c+3],limbs[c+7]);
   if(p[i]<Math.min(ax,bx)-maxR||p[i]>Math.max(ax,bx)+maxR||p[i+1]<Math.min(ay,by)-maxR||p[i+1]>Math.max(ay,by)+maxR||p[i+2]<Math.min(az,bz)-maxR||p[i+2]>Math.max(az,bz)+maxR)continue;
   const vx=bx-ax,vy=by-ay,vz=bz-az,t=clamp(((p[i]-ax)*vx+(p[i+1]-ay)*vy+(p[i+2]-az)*vz)/Math.max(vx*vx+vy*vy+vz*vz,1e-9),0,1),r=limbs[c+3]*(1-t)+limbs[c+7]*t;
   const cx=ax+vx*t,cy=ay+vy*t,cz=az+vz*t,dx=p[i]-cx,dy=p[i+1]-cy,dz=p[i+2]-cz,d=Math.hypot(dx,dy,dz);
   if(d<r){const gain=r/Math.max(d,1e-9);p[i]=cx+(d>1e-9?dx*gain:r);p[i+1]=cy+dy*gain;p[i+2]=cz+dz*gain;}
  }
  p[i+1]=Math.max(p[i+1],this.settings.floorY);
 }
 update(pelvis,bind,limbs,time,anchors=null){
  if(!Number.isFinite(time)||limbs.length%8||!limbs.every(Number.isFinite)||anchors&&anchors.length!==this.columns*3)throw Error('服装姿态输入无效');
  if(this.initialized&&time===this.lastTime)return false;
  const q=qm(pelvis.q,inv(bind.q)),translation=sub(pelvis.p,rotate(q,bind.p)),p=this.positions,old=this.previous,rest=this.rest;
  const target=new Float64Array(p.length);for(let i=0;i<p.length;i+=3)target.set(add(rotate(q,Array.from(rest.subarray(i,i+3))),translation),i);
  if(anchors)for(let column=0;column<this.columns;column++)for(let k=0;k<3;k++){
   const at=column*3+k,shift=anchors[at]-target[at];for(let row=this.rows;row>=0;row--)target[(row*this.columns+column)*3+k]+=shift*(1-row/this.rows);
  }
  const reset=!this.initialized||time<this.lastTime||time-this.lastTime>.2;
  if(reset){p.set(target);old.set(target);}
  const dt=reset?1/60:Math.max(0,time-this.lastTime),steps=reset?16:Math.max(1,Math.ceil(dt*this.settings.frequency)),step=reset?1/this.settings.frequency:dt/steps;
  const activeLimbs=new Float64Array(limbs.length),virtual=new Float64Array(3);
  for(let pass=0;pass<steps;pass++){
   for(let i=0;i<limbs.length;i++)activeLimbs[i]=reset||!this.lastLimbs?limbs[i]:this.lastLimbs[i]+(limbs[i]-this.lastLimbs[i])*(pass+1)/steps;
   for(let i=this.columns*3;i<p.length;i++){
    const value=p[i],velocity=(value-old[i])*.86;old[i]=value;p[i]+=velocity+(i%3===1?-9.81*step*step:0);p[i]+=(target[i]-p[i])*(1-Math.exp(-step*3));
   }
   for(let iteration=0;iteration<this.settings.iterations;iteration++){
    for(let i=0;i<this.columns*3;i++){p[i]=reset||!this.lastTarget?target[i]:this.lastTarget[i]+(target[i]-this.lastTarget[i])*(pass+1)/steps;old[i]=p[i];}
    for(const [a,b,length,weight]of this.edges){
     const x=p[b]-p[a],y=p[b+1]-p[a+1],z=p[b+2]-p[a+2],distance=Math.hypot(x,y,z),wa=a<this.columns*3?0:1,wb=b<this.columns*3?0:1;
     if(distance<1e-9||wa+wb===0)continue;
     const correction=(distance-length)/distance*weight/(wa+wb);
     const ca=correction*wa,cb=correction*wb;p[a]+=x*ca;p[a+1]+=y*ca;p[a+2]+=z*ca;p[b]-=x*cb;p[b+1]-=y*cb;p[b+2]-=z*cb;
    }
    for(let i=this.columns*3;i<p.length;i+=3)this.separate(p,i,activeLimbs);
    // Triangle-centre samples push their connected vertices together. This
    // closes the gap between vertex-only collision and surface coverage.
    for(const tri of this.triangles){
     const [a,b,c]=tri,x=(p[a]+p[b]+p[c])/3,y=(p[a+1]+p[b+1]+p[c+1])/3,z=(p[a+2]+p[b+2]+p[c+2])/3;
     virtual[0]=x;virtual[1]=y;virtual[2]=z;this.separate(virtual,0,activeLimbs);
     const free=tri.reduce((n,id)=>n+Number(id>=this.columns*3),0);if(!free)continue;
     const gain=3/free;for(const id of tri)if(id>=this.columns*3){p[id]+=(virtual[0]-x)*gain;p[id+1]+=(virtual[1]-y)*gain;p[id+2]+=(virtual[2]-z)*gain;}
    }
   }
  }
  for(let i=0;i<p.length/3;i++){this.textureData.set(p.subarray(i*3,i*3+3),i*4);this.textureData.set(rest.subarray(i*3,i*3+3),(i+p.length/3)*4);}
  this.lastTarget=target;this.lastLimbs=Array.from(limbs);this.lastTime=time;this.initialized=true;return true;
 }
}
