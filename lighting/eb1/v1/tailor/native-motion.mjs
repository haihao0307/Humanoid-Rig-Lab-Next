/** Fixed-shape fast path of the inherited Anny local-ref FK and UNPRUNED native weights.
 * Only local rotations are changed. Parent hierarchy, bone lengths, body topology,
 * common head and proportional identity remain the original frozen ones.
 */
export const MOTIONS={raise:'双臂抬起／放下',twist:'躯干左右转动',step:'缓步抬腿',idle:'静止'};
const I=()=>new Float64Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
export function mul(a,b,out=new Float64Array(16)){for(let i=0;i<4;i++)for(let j=0;j<4;j++)out[i*4+j]=a[i*4]*b[j]+a[i*4+1]*b[4+j]+a[i*4+2]*b[8+j]+a[i*4+3]*b[12+j];return out;}
export function rotvec(v){const x=v[0]*Math.PI/180,y=v[1]*Math.PI/180,z=v[2]*Math.PI/180,t=Math.hypot(x,y,z),R=I();if(t<1e-12)return R;const a=x/t,b=y/t,c=z/t,s=Math.sin(t),co=Math.cos(t),k=1-co;R[0]=co+a*a*k;R[1]=a*b*k-c*s;R[2]=a*c*k+b*s;R[4]=b*a*k+c*s;R[5]=co+b*b*k;R[6]=b*c*k-a*s;R[8]=c*a*k-b*s;R[9]=c*b*k+a*s;R[10]=co+c*c*k;return R;}
function apply(m,x,y,z,out,k){out[k]=m[0]*x+m[1]*y+m[2]*z+m[3];out[k+1]=m[4]*x+m[5]*y+m[6]*z+m[7];out[k+2]=m[8]*x+m[9]*y+m[10]*z+m[11];}
export function motionPose(id,time,amplitude=1){const t=Math.max(0,time),ramp=Math.min(1,t/1.2),q=Math.sin(t*Math.PI*2/5)*ramp,a=amplitude,pose={};
 if(id==='raise'){const lift=(1-Math.cos(t*Math.PI*2/6))*.5*a;pose['upperarm01.L']=[0,-28*lift,0];pose['upperarm01.R']=[0,28*lift,0];pose['lowerarm01.L']=[0,0,-12*lift];pose['lowerarm01.R']=[0,0,12*lift];}
 if(id==='twist'){pose.spine03=[0,0,9*q*a];pose.spine02=[0,0,5*q*a];pose['upperarm01.L']=[0,0,-4*q*a];pose['upperarm01.R']=[0,0,-4*q*a];}
 if(id==='step'){const u=Math.sin(t*Math.PI*2/3)*ramp*a;pose['upperleg01.L']=[-10*u,0,0];pose['upperleg01.R']=[10*u,0,0];pose['lowerleg01.L']=[13*Math.max(0,u),0,0];pose['lowerleg01.R']=[13*Math.max(0,-u),0,0];pose['upperarm01.L']=[5*u,0,0];pose['upperarm01.R']=[-5*u,0,0];}
 return pose;
}
export class NativeMotion {
 constructor({rig,positions,bodyCount,headSkinIndices,headSkinWeights,boneOrder}){if(rig.source!=='anny')throw Error('MP04 only supports this frozen native Anny owner');this.rig=rig;this.base=Float64Array.from(positions);this.bodyCount=bodyCount;this.headIndices=headSkinIndices;this.headWeights=headSkinWeights;this.order=boneOrder||rig.names.map((_,i)=>i);this.weights=rig.weights;this.influence=Float64Array.from(rig.restPositionsPerInfluence);this.skin=rig.names.map(I);this.world=rig.names.map(I);this.positions=new Float32Array(positions.length);this.native=new Float64Array(positions.length);this.correction=new Float64Array(bodyCount*3);this.anchors=new Float32Array(rig.names.length*3);
  const w=this.weights,one=new Float64Array(3),initial=new Float64Array(bodyCount*3);for(let i=0;i<bodyCount;i++)for(let k=w.ptr[i];k<w.ptr[i+1];k++){const j=w.joints[k],n=k*3;apply(rig.skinMatrices[j],this.influence[n],this.influence[n+1],this.influence[n+2],one,0);this.influence.set(one,n);for(let d=0;d<3;d++)initial[i*3+d]+=w.values[k]*one[d];}for(let i=0;i<this.correction.length;i++)this.correction[i]=this.base[i]-initial[i];this.evaluate({});
 }
 evaluate(pose={}){const r=this.rig;for(const j of this.order){const delta=pose[r.names[j]],rest=r.restMatrices[j],R=delta?rotvec(delta):I();if(delta){const x=rest[3],y=rest[7],z=rest[11];R[3]=x-R[0]*x-R[1]*y-R[2]*z;R[7]=y-R[4]*x-R[5]*y-R[6]*z;R[11]=z-R[8]*x-R[9]*y-R[10]*z;}
  if(r.parents[j]>=0)mul(this.skin[r.parents[j]],R,this.skin[j]);else this.skin[j].set(R);mul(this.skin[j],rest,this.world[j]);const m=this.world[j];this.anchors[j*3]=m[3];this.anchors[j*3+1]=m[11];this.anchors[j*3+2]=-m[7];}
  const out=this.native,w=this.weights,inf=this.influence;out.fill(0);for(let i=0;i<this.bodyCount;i++){const a=i*3,dx=this.correction[a],dy=this.correction[a+1],dz=this.correction[a+2];for(let k=w.ptr[i];k<w.ptr[i+1];k++){const m=this.skin[w.joints[k]],b=k*3,x=inf[b]+dx,y=inf[b+1]+dy,z=inf[b+2]+dz,weight=w.values[k];out[a]+=weight*(m[0]*x+m[1]*y+m[2]*z+m[3]);out[a+1]+=weight*(m[4]*x+m[5]*y+m[6]*z+m[7]);out[a+2]+=weight*(m[8]*x+m[9]*y+m[10]*z+m[11]);}}
  for(let i=this.bodyCount;i<out.length/3;i++){const a=i*3,h=i-this.bodyCount,x=this.base[a],y=this.base[a+1],z=this.base[a+2],ids=this.headIndices[h],weights=this.headWeights[h];for(let k=0;k<ids.length;k++){const m=this.skin[ids[k]],weight=weights[k];out[a]+=weight*(m[0]*x+m[1]*y+m[2]*z+m[3]);out[a+1]+=weight*(m[4]*x+m[5]*y+m[6]*z+m[7]);out[a+2]+=weight*(m[8]*x+m[9]*y+m[10]*z+m[11]);}}
  for(let i=0;i<out.length;i+=3){this.positions[i]=out[i];this.positions[i+1]=out[i+2];this.positions[i+2]=-out[i+1];}this.pose=pose;return this.positions;
 }
 at(id,time){return this.evaluate(motionPose(id,time));}
 point(index,p,out=new Float64Array(3)){
  const m=this.skin[index],x=p[0],y=-p[2],z=p[1];out[0]=m[0]*x+m[1]*y+m[2]*z+m[3];out[1]=m[8]*x+m[9]*y+m[10]*z+m[11];out[2]=-(m[4]*x+m[5]*y+m[6]*z+m[7]);return out;
 }
 audit(){let maxBoneError=0;for(let j=0;j<this.rig.names.length;j++){const parent=this.rig.parents[j];if(parent<0)continue;const a=this.world[j],b=this.world[parent],c=this.rig.restMatrices[j],d=this.rig.restMatrices[parent];maxBoneError=Math.max(maxBoneError,Math.abs(Math.hypot(a[3]-b[3],a[7]-b[7],a[11]-b[11])-Math.hypot(c[3]-d[3],c[7]-d[7],c[11]-d[11])));}return{source:'original Anny local-ref FK',bones:this.rig.names.length,weights:'unpruned original joint-conditioned influences',maxBoneLengthErrorMM:maxBoneError*1000,topologyChanged:false,pose:this.pose};}
}
