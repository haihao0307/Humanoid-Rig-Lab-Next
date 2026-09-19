/*__PHYSICS_ENGINE__*/
// MODULE math
const V=(x=0,y=0,z=0)=>[x,y,z];
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,s)=>a.map(x=>x*s);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(...a);
const norm=a=>mul(a,1/(len(a)||1));
const dist=(a,b)=>len(sub(a,b));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const smoother=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10)};
const qi=()=>[0,0,0,1];
const qnorm=q=>mul(q,1/(len(q)||1));
const inv=q=>[-q[0],-q[1],-q[2],q[3]];
function qm(a,b){const [x,y,z,w]=a,[X,Y,Z,W]=b;return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z]}
function aa(axis,a){return [...mul(norm(axis),Math.sin(a/2)),Math.cos(a/2)]}
const qx=a=>aa([1,0,0],a),qy=a=>aa([0,1,0],a),qz=a=>aa([0,0,1],a);
function rotate(q,v){const t=mul(cross(q.slice(0,3),v),2);return add(v,add(mul(t,q[3]),cross(q.slice(0,3),t)))}
function qslerp(a,b,t){let d=dot(a,b);if(d<0){b=mul(b,-1);d=-d}if(d>.9995)return qnorm(mix(a,b,t));const r=Math.acos(clamp(d,-1,1)),s=Math.sin(r);return add(mul(a,Math.sin((1-t)*r)/s),mul(b,Math.sin(t*r)/s))}
const qangle=(a,b)=>2*Math.acos(clamp(Math.abs(dot(a,b)),-1,1));
function fromTo(a,b){a=norm(a);b=norm(b);const d=dot(a,b);if(d<-.99999)return aa(norm(cross(a,Math.abs(a[0])<.7?[1,0,0]:[0,0,1])),Math.PI);return qnorm([...cross(a,b),1+d])}
function qb(x,y,z){const m00=x[0],m11=y[1],m22=z[2],tr=m00+m11+m22;let q;
if(tr>0){const s=Math.sqrt(tr+1)*2;q=[(y[2]-z[1])/s,(z[0]-x[2])/s,(x[1]-y[0])/s,s/4]}
else if(m00>m11&&m00>m22){const s=Math.sqrt(1+m00-m11-m22)*2;q=[s/4,(y[0]+x[1])/s,(z[0]+x[2])/s,(y[2]-z[1])/s]}
else if(m11>m22){const s=Math.sqrt(1+m11-m00-m22)*2;q=[(y[0]+x[1])/s,s/4,(z[1]+y[2])/s,(z[0]-x[2])/s]}
else{const s=Math.sqrt(1+m22-m00-m11)*2;q=[(z[0]+x[2])/s,(z[1]+y[2])/s,s/4,(x[1]-y[0])/s]}return qnorm(q)}
const frame=(p=V(),q=qi())=>({p:[...p],q:[...q]});
const compose=(a,b)=>frame(add(a.p,rotate(a.q,b.p)),qm(a.q,b.q));
const inverse=a=>frame(rotate(inv(a.q),mul(a.p,-1)),inv(a.q));
const point=(a,p)=>add(a.p,rotate(a.q,p));
function matrix(p,q){const x=rotate(q,[1,0,0]),y=rotate(q,[0,1,0]),z=rotate(q,[0,0,1]);return new Float32Array([...x,0,...y,0,...z,0,...p,1])}
const ident=()=>matrix(V(),qi());
function mm(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0])}
function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1])}
function lookAt(eye,target,up=[0,1,0]){const z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1])}
function project(m,p){const v=[...p,1],o=[0,0,0,0];for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[r]+=m[k*4+r]*v[k];return o.map(v=>v/o[3])}
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
function seeded(seed){let t=seed>>>0;return ()=>{t+=0x6D2B79F5;let v=Math.imul(t^t>>>15,1|t);v^=v+Math.imul(v^v>>>7,61|v);return ((v^v>>>14)>>>0)/4294967296}}
function hashFloats(a){let h=2166136261;const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);for(const x of b){h^=x;h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}

// Shared reference-frame helpers. Pose solving belongs to Motion-Lab.
const DEG=Math.PI/180,DOWN=Object.freeze([0,-1,0]);
const degrees=v=>v/DEG,radians=v=>v*DEG;
const canonical=q=>{q=qnorm(q);return q[3]<0?mul(q,-1):q;};
const relativeToBind=(joint,q)=>canonical(qm(inv(joint.bindQ||qi()),q));

// MODULE mesh
function mesh(p,i,n=null){const positions=Float32Array.from(p),indices=Uint32Array.from(i);if(!n){n=new Float32Array(p.length);for(let t=0;t<i.length;t+=3){const a=i[t],b=i[t+1],c=i[t+2],N=cross(sub(p.slice(b*3,b*3+3),p.slice(a*3,a*3+3)),sub(p.slice(c*3,c*3+3),p.slice(a*3,a*3+3)));for(const k of[a,b,c])for(let q=0;q<3;q++)n[k*3+q]+=N[q]}for(let k=0;k<n.length;k+=3){const N=norm([...n.slice(k,k+3)]);n.set(N,k)}}return {p:positions,i:indices,n:Float32Array.from(n)}}
function combine(parts){const p=[],n=[],i=[];for(const g of parts){const o=p.length/3;p.push(...g.p);n.push(...g.n);for(const k of g.i)i.push(o+k)}return mesh(p,i,n)}
function transform(g,p=[0,0,0],q=[0,0,0,1]){const P=[],N=[];for(let k=0;k<g.p.length;k+=3){P.push(...add(p,rotate(q,[...g.p.slice(k,k+3)])));N.push(...rotate(q,[...g.n.slice(k,k+3)]))}return mesh(P,[...g.i],N)}
function ellipsoid(c,r,seg=22,rings=14){const p=[],n=[],i=[];for(let a=0;a<=rings;a++){const t=Math.PI*a/rings;for(let b=0;b<=seg;b++){const f=b/seg*Math.PI*2,v=[Math.sin(t)*Math.cos(f),Math.cos(t),Math.sin(t)*Math.sin(f)];p.push(...v.map((x,k)=>c[k]+r[k]*x));n.push(...norm(v.map((x,k)=>x/r[k])))}}for(let a=0;a<rings;a++)for(let b=0;b<seg;b++){const v=a*(seg+1)+b;i.push(v,v+1,v+seg+2,v,v+seg+2,v+seg+1)}return mesh(p,i,n)}
// Sweeps metric cross sections along an original analytic centerline.
function sweep(fn,radius,segments=36,sides=12,flatten=1){
 const p=[],n=[],indices=[],tangents=[];let previousX=null;
 for(let a=0;a<=segments;a++){
  const t=a/segments,center=fn(t),T=norm(sub(fn(Math.min(1,t+.0001)),fn(Math.max(0,t-.0001))));
  let X=previousX?sub(previousX,mul(T,dot(previousX,T))):cross(T,Math.abs(T[1])<.85?[0,1,0]:[0,0,1]);
  if(len(X)<1e-6)X=cross(T,Math.abs(T[1])<.85?[0,1,0]:[0,0,1]);
  X=norm(X);previousX=X;const Y=norm(cross(T,X)),r=typeof radius==='function'?radius(t):radius;tangents.push(T);
  for(let b=0;b<sides;b++){const theta=b/sides*Math.PI*2;
   p.push(...add(center,add(mul(X,r*Math.cos(theta)),mul(Y,r*flatten*Math.sin(theta)))));
  }
 }
 // Differentiate the actual swept surface, including radius change and curvature.
 const vertex=(a,b)=>p.slice((a*sides+(b+sides)%sides)*3,(a*sides+(b+sides)%sides)*3+3);
 for(let a=0;a<=segments;a++)for(let b=0;b<sides;b++){
  const along=sub(vertex(Math.min(segments,a+1),b),vertex(Math.max(0,a-1),b)),across=sub(vertex(a,b+1),vertex(a,b-1));
  n.push(...norm(cross(across,along)));
 }
 for(let a=0;a<segments;a++)for(let b=0;b<sides;b++){const v=a*sides+b,w=a*sides+(b+1)%sides;indices.push(v,w,w+sides,v,w+sides,v+sides);}
 for(const [a,reverse] of [[0,true],[segments,false]]){
  const center=p.length/3,N=mul(tangents[a],reverse?-1:1);p.push(...fn(a/segments));n.push(...N);
  // Separate cap rims keep end-face normals from changing the side contour.
  for(let b=0;b<sides;b++){p.push(...vertex(a,b));n.push(...N);}
  for(let b=0;b<sides;b++){const v=center+1+b,w=center+1+(b+1)%sides;reverse?indices.push(center,w,v):indices.push(center,v,w);}
 }
 return mesh(p,indices,n);
}
const tube=(a,b,r,segments=10,sides=12)=>sweep(t=>mix(a,b,t),typeof r==='number'?r:t=>r[0]+(r[1]-r[0])*t,segments,sides);
function boneRod(L,r=.009){return combine([sweep(t=>[0,-L*t,0],t=>r*(.72+.3*Math.exp(-(((t-.1)/.16)**2))+.42*Math.exp(-(((t-.91)/.12)**2))),18,12,.9),ellipsoid([0,-.005,0],[r*1.13,r*.95,r],12,8),ellipsoid([0,-L+.004,0],[r*1.15,r,r],12,8)])}
const smin=(a,b,k)=>{const h=clamp(.5+.5*(b-a)/k,0,1);return b+(a-b)*h-k*h*(1-h)};
function sdEll(p,c,r){const v=sub(p,c);return (Math.hypot(v[0]/r[0],v[1]/r[1],v[2]/r[2])-1)*Math.min(...r)}
function sdCaps(p,a,b,r1,r2=r1){const d=sub(b,a),t=clamp(dot(sub(p,a),d)/dot(d,d),0,1);return len(sub(p,mix(a,b,t)))-(r1+(r2-r1)*t)}
// Shared-edge marching tetrahedra; geometry is rebuilt from functions, never external arrays.
function fieldMesh(fn,bmin,bmax,counts=[36,64,36],{normalStepM=0}={}){
 const[nx,ny,nz]=counts,dx=(bmax[0]-bmin[0])/nx,dy=(bmax[1]-bmin[1])/ny,dz=(bmax[2]-bmin[2])/nz,sx=nx+1,sy=ny+1,sz=nz+1,N=sx*sy*sz,F=new Float32Array(N),at=(x,y,z)=>x+sx*(y+sy*z);
 for(let z=0;z<=nz;z++)for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++)F[at(x,y,z)]=fn([bmin[0]+x*dx,bmin[1]+y*dy,bmin[2]+z*dz]);
 const grad=new Float32Array(N*3);for(let z=0;z<=nz;z++)for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const id=at(x,y,z);grad[id*3]=(F[at(Math.min(nx,x+1),y,z)]-F[at(Math.max(0,x-1),y,z)])/((x===0||x===nx?1:2)*dx);grad[id*3+1]=(F[at(x,Math.min(ny,y+1),z)]-F[at(x,Math.max(0,y-1),z)])/((y===0||y===ny?1:2)*dy);grad[id*3+2]=(F[at(x,y,Math.min(nz,z+1))]-F[at(x,y,Math.max(0,z-1))])/((z===0||z===nz?1:2)*dz)}
 const P=[],G=[],I=[],cache=new Map(),corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],T=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 const pos=id=>{const x=id%sx,y=Math.floor(id/sx)%sy,z=Math.floor(id/(sx*sy));return[bmin[0]+x*dx,bmin[1]+y*dy,bmin[2]+z*dz]};
 const edge=(a,b)=>{
   if(a>b)[a,b]=[b,a];const key=a*N+b;if(cache.has(key))return cache.get(key);
   const t=F[a]/(F[a]-F[b]),id=P.length/3,p=mix(pos(a),pos(b),t);P.push(...p);
   // Skin normals follow the continuous field at the actual surface vertex.
   // Grid-edge interpolation alone can leave visible shading bands at profile changes.
   let normal=mix([...grad.slice(a*3,a*3+3)],[...grad.slice(b*3,b*3+3)],t);
   if(normalStepM>0){
     const direct=[0,1,2].map(k=>{const lo=[...p],hi=[...p];lo[k]-=normalStepM;hi[k]+=normalStepM;return (fn(hi)-fn(lo))/(2*normalStepM);});
     if(direct.every(Number.isFinite)&&len(direct)>1e-8)normal=direct;
   }
   G.push(...norm(normal));cache.set(key,id);return id;
 };
 const tri=(a,b,c)=>{const A=P.slice(a*3,a*3+3),B=P.slice(b*3,b*3+3),C=P.slice(c*3,c*3+3),n=add(G.slice(a*3,a*3+3),add(G.slice(b*3,b*3+3),G.slice(c*3,c*3+3)));if(dot(cross(sub(B,A),sub(C,A)),n)<0)I.push(a,c,b);else I.push(a,b,c)};
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const ids=corners.map(c=>at(x+c[0],y+c[1],z+c[2]));let inside=0;for(const id of ids)if(F[id]<0)inside++;if(inside===0||inside===8)continue;for(const t of T){const ins=[],out=[];for(const c of t)(F[ids[c]]<0?ins:out).push(ids[c]);if(ins.length===0||ins.length===4)continue;if(ins.length===1){tri(...out.map(b=>edge(ins[0],b)))}else if(ins.length===3){tri(...ins.map(a=>edge(a,out[0])))}else{const a=edge(ins[0],out[0]),b=edge(ins[0],out[1]),c=edge(ins[1],out[0]),d=edge(ins[1],out[1]);tri(a,b,c);tri(b,d,c)}}}
 return mesh(P,I,G)
}
function flatPlate(points,thickness=.005,bulge=.004){const p=[],i=[],center=mul(points.reduce((s,v)=>add(s,v),[0,0,0]),1/points.length);for(const sign of[-1,1]){p.push(...add(center,[0,0,sign*thickness/2+bulge]));for(const v of points)p.push(...add(v,[0,0,sign*thickness/2]));}const stride=points.length+1;for(let a=0;a<points.length;a++){const b=(a+1)%points.length;i.push(0,b+1,a+1,stride,stride+a+1,stride+b+1,a+1,b+1,stride+b+1,a+1,stride+b+1,stride+a+1)}return mesh(p,i)}
function box(w,h,d){const p=[],n=[],i=[];for(const[normal,A,B]of [[[1,0,0],[0,1,0],[0,0,1]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[0,0,1],[1,0,0]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[0,1,0],[1,0,0]]]){const o=p.length/3;for(const[a,b]of[[-1,-1],[1,-1],[1,1],[-1,1]]){p.push(...add(normal,add(mul(A,a),mul(B,b))).map((v,k)=>v*[w,h,d][k]/2));n.push(...normal)}i.push(o,o+1,o+2,o,o+2,o+3)}return mesh(p,i,n)}
function cylinder(r,h,n=36,top=r){const p=[],i=[];for(let y=0;y<2;y++)for(let s=0;s<n;s++){const a=s/n*Math.PI*2;p.push(Math.cos(a)*(y?top:r),(y-.5)*h,Math.sin(a)*(y?top:r))}p.push(0,-h/2,0,0,h/2,0);for(let s=0;s<n;s++){const t=(s+1)%n;i.push(s,t,t+n,s,t+n,s+n,2*n,t,s,2*n+1,s+n,t+n)}return mesh(p,i)}

/*__SOURCE:body/ReconstructionRig.js__*/
/*__SOURCE:body/CharacterShape.js__*/
/*__SOURCE:body/CharacterAssembly.js__*/
class Human{
 constructor(input=initialCharacterPreset()){
  this.characterPreset=validateCharacterPreset(input);this.strength=StrengthModel.fromSnapshot(this.characterPreset.strength);
  this.proportionRevision=17;this.bodySex=BODY_SEX;this.joints=[];this.byId=new Map();this.bones=[];this.cartilage=[];this.records=[];
  this.spine=[];this.shoulders={};this.arms={};this.legs={};this.fingers=[];this.phase='idle';this.lastErrors=[];
  buildReconstructionRig(this);this.fk();
 }
 joint(id,parent,p){if(this.byId.has(id))throw Error('Duplicate joint '+id);const j={id,parent:typeof parent==='string'?this.byId.get(parent):parent,p:[...p],q:qi(),world:frame(),bind:[...p]};this.joints.push(j);this.byId.set(id,j);return j}
 fk(){for(const j of this.joints)j.world=j.parent?compose(j.parent.world,frame(j.p,j.q)):frame(j.p,j.q)}
 world(id){return this.byId.get(id).world}
 geometryHash(){return this.bodyMetrics.geometryKey;}
 palm(side){const arm=this.arms[side];return compose(arm.wrist.world,frame(this.bodyMetrics.palmContact))}
 // The renderer and all actions share the lab adapter's final commit.
 pose(options={}){
  if(!this.motionDriver)throw Error('动作实验室尚未连接');
  return this.motionDriver.apply(options);
 }
 refreshEffectorErrors(){
  for(const error of this.lastErrors){
   const j=this.byId.get(error.id);if(!j)continue;
   const actual=add(j.world.p,rotate(j.world.q,error.effectorLocal||[0,0,0]));
   error.error=dist(actual,error.target);if(error.targetOrientation)error.orientationErrorRad=qangle(j.world.q,error.targetOrientation);
  }
 }
 // Sampled support clearance from the current R2 skinning transform.
 // This is not an exhaustive collision or measured contact-force evaluation.
 minimumBoneY(frames=null,jointIds=null){let min=Infinity,id=null;for(const b of this.bones){if(jointIds&&!jointIds.has(b.joint.id))continue;const f=frames?frames.get(b.joint.id):b.joint.world,[x,y,z,w]=f.q;
   const a=2*(x*y+z*w),c=1-2*(x*x+z*z),d=2*(y*z-x*w),py=f.p[1],v=b.g.p;
   for(let k=0;k<v.length;k+=3){const yy=py+a*v[k]+c*v[k+1]+d*v[k+2];if(yy<min){min=yy;id=b.id}}
  }const soft=this.tissue?.minimumSupportY(frames,jointIds);return soft&&soft.y<min?soft:{y:min,boneId:id}}
  diagnostics(){let max=0;for(const b of this.bindLengths){if(/_patella$/.test(b.id))continue;const j=this.byId.get(b.id);max=Math.max(max,Math.abs(len(sub(j.world.p,j.parent.world.p))-b.length))}return{...this.evidence,maxBoneLengthErrorM:max,maxEffectorErrorM:Math.max(0,...this.lastErrors.map(e=>e.error)),maxFootTargetErrorM:Math.max(0,...this.lastErrors.filter(e=>/_foot$/.test(e.id)).map(e=>e.error)),maxHandTargetErrorM:Math.max(0,...this.lastErrors.filter(e=>/_hand$/.test(e.id)).map(e=>e.error)),maxOrientationErrorRad:Math.max(0,...this.lastErrors.map(e=>e.orientationErrorRad||0)),root:[...this.root.p],jointAngles:this.lastErrors.map(e=>({id:e.id,hingeRad:e.hinge,bendPlaneRad:e.bendPlaneRad})),poseAuthority:'MotionLabPose.commit',jointAxisValidation:'source-frames-and-fixed-length-IK',jointConstraints:this.motionDriver?.report()||null,constraintProfile:'motion-lab-frame-and-reach',fullMuscleDynamics:false,tissue:this.tissue?.report()||null}}
}

/*__SOURCE:body/HumanBiology.js__*/
/*__SOURCE:body/HumanDNA.js__*/
/*__SOURCE:body/SkinAppearance.js__*/
/*__SOURCE:body/HairProfiles.js__*/
/*__SOURCE:body/FaceIdentity.js__*/
/*__SOURCE:body/FaceControls.js__*/
/*__SOURCE:body/CharacterPresets.js__*/
/*__SOURCE:body/NPCDefinitions.js__*/
/*__SOURCE:body/ReconstructionState.js__*/
/*__SOURCE:body/CompactHairControls.js__*/
/*__SOURCE:body/BodySettings.js__*/
/*__SOURCE:body/TissueShaders.js__*/

// MODULE render
// Rigid matrix-palette batching. All surface vertices remain generated from the
// anatomy functions. The renderer reads finalPose and never changes the rig.
const VS=TISSUE_VERTEX_SHADER;
const FS=TISSUE_FRAGMENT_SHADER;
const DFS=`#version 300 es
precision highp float;void main(){}`;
const LVS=`#version 300 es
precision highp float;layout(location=0)in vec3 position;layout(location=1)in vec3 color;uniform mat4 viewProjection;out vec3 C;void main(){C=color;gl_Position=viewProjection*vec4(position,1.);}`;
const LFS=`#version 300 es
precision highp float;in vec3 C;out vec4 frag;void main(){frag=vec4(pow(C,vec3(1./2.2)),1.);}`;
function shader(gl,type,src){
 const label=type===gl.VERTEX_SHADER?'顶点着色器':'片元着色器',s=gl.createShader(type);
 if(!s)throw Error(label+'创建失败');
 gl.shaderSource(s,src);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
  const info=gl.getShaderInfoLog(s)||'驱动没有返回编译日志';gl.deleteShader(s);
  throw Error(label+'编译失败：\n'+info);
 }
 return s;
}
function program(gl,v,f){
 const p=gl.createProgram();if(!p)throw Error('着色程序创建失败');let a,b;
 try{
  a=shader(gl,gl.VERTEX_SHADER,v);b=shader(gl,gl.FRAGMENT_SHADER,f);
  gl.attachShader(p,a);gl.attachShader(p,b);gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('着色程序链接失败：\n'+(gl.getProgramInfoLog(p)||'驱动没有返回链接日志'));
  return{p,u:Object.fromEntries(['viewProjection','lightVP','eye','shadow','posePalette','depthPass','shadowsEnabled','jointPalette','musclePalette','anatomyTime','studioMode'].map(k=>[k,gl.getUniformLocation(p,k)]))};
 }catch(error){gl.deleteProgram(p);throw error}
 finally{if(a)gl.deleteShader(a);if(b)gl.deleteShader(b)}
}
class Renderer{
 constructor(canvas){this.canvas=canvas;const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('浏览器未提供 WebGL2，请开启硬件加速后重新打开');this.gl=gl;this.main=program(gl,VS,FS);this.depth=program(gl,VS,DFS);this.lineProgram=program(gl,LVS,LFS);this.target=[0,ADULT_SPEC.statureM/2,1.75];this.projection='perspective';this.orthoHeight=ADULT_SPEC.statureM*1.16;this.yaw=.20;this.pitch=.15;this.distance=3.12;this.eye=[0,0,5];this.frames=0;this.drawCalls=0;this.shadowDrawCalls=0;this.quality='shadow';this.lastItems=[];this.lastLines=[];this.buffers=[];this.lineBuffers=[];this.poseTexture=gl.createTexture();this.lightVP=mm(ortho(-5.2,5.2,-4.4,4.4,.1,20),lookAt([-4,8,5],[0,0,0]));this.shadowSize=Math.min(2048,gl.getParameter(gl.MAX_TEXTURE_SIZE));this.matrixUploads=0;this.tissue=null;this.compacts=[];
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,this.shadowSize,this.shadowSize,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);this.textureOptions();this.shadow=tex;this.fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,tex,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);this.shadowAvailable=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);this.installControls();}
 setTissue(tissue){this.tissue=tissue;}
 activeCompacts(){return [...new Set(this.compacts?.length?this.compacts:this.compact?[this.compact]:[])].filter(surface=>!surface.disposed);}
 tissueUniforms(p){this.gl.uniform1f(p.u.studioMode,this.studioMode?1:0);}
 tissueAttributes(items,nv){const values=new Float32Array(nv);let offset=0;for(const o of items){const n=o.g.p.length/3;values.fill(o.materialKind||0,offset,offset+n);offset+=n;}this.attr(5,values,1,this.buffers);}
 textureOptions(){const g=this.gl;g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE)}
 setQuality(value){this.quality=value==='shadow'?'shadow':'fast'}
 installControls(){
  const c=this.canvas,pointers=new Map();let drag=null,lastPinch=0;
  const zoom=factor=>{if(this.projection==='orthographic')this.orthoHeight=clamp(this.orthoHeight*factor,.12,45);else this.distance=clamp(this.distance*factor,.25,65);};
  c.style.touchAction='none';c.addEventListener('contextmenu',e=>e.preventDefault());
  c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);drag=[e.clientX,e.clientY,e.button];});
  c.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);drag=null;lastPinch=0});
  c.addEventListener('pointercancel',()=>{pointers.clear();drag=null;lastPinch=0});
  c.addEventListener('pointermove',e=>{
   if(!pointers.has(e.pointerId)||!drag)return;
   const dx=e.clientX-drag[0],dy=e.clientY-drag[1];pointers.set(e.pointerId,[e.clientX,e.clientY]);
   if(pointers.size===2){const[a,b]=[...pointers.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(lastPinch&&d>1)zoom(lastPinch/d);lastPinch=d;}
   else if(drag[2]===2||e.shiftKey){
    const right=[Math.cos(this.yaw),0,-Math.sin(this.yaw)],up=[-Math.sin(this.yaw)*Math.sin(this.pitch),Math.cos(this.pitch),-Math.cos(this.yaw)*Math.sin(this.pitch)];
    const scale=this.projection==='orthographic'?this.orthoHeight/Math.max(1,c.clientHeight):this.distance*.0015;
    follow=false;$('follow').checked=false;this.target=add(this.target,add(mul(right,-dx*scale),mul(up,dy*scale)));
   }else{this.yaw-=dx*.006;this.pitch=clamp(this.pitch+dy*.005,this.studioMode?-1.49:-.20,1.49)}
   drag=[e.clientX,e.clientY,drag[2]];
  });
  c.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(e.deltaY*.001))},{passive:false});
 }
 attr(loc,data,size,buffers){if(buffers===this.buffers)this.geometryGPUBytes=(this.geometryGPUBytes||0)+data.byteLength;else if(buffers===this.lineBuffers)this.lineGeometryGPUBytes=(this.lineGeometryGPUBytes||0)+data.byteLength;const gl=this.gl,b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0)}
 batch(items){this.geometryGPUBytes=0;const gl=this.gl;for(const b of this.buffers)gl.deleteBuffer(b);if(this.vao)gl.deleteVertexArray(this.vao);this.buffers=[];this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);let nv=0,ni=0;for(const o of items){nv+=o.g.p.length/3;ni+=o.g.i.length}const P=new Float32Array(nv*3),N=new Float32Array(nv*3),C=new Float32Array(nv*3),B=new Float32Array(nv),O=new Float32Array(nv).fill(1),I=new Uint32Array(ni);let vo=0,io=0;items.forEach((o,id)=>{const n=o.g.p.length/3;P.set(o.g.renderP||o.g.p,vo*3);N.set(o.g.renderN||o.g.n,vo*3);B.fill(id,vo,vo+n);if(o.g.ao)O.set(o.g.ao,vo);if(o.g.c)C.set(o.g.c,vo*3);else for(let k=0;k<n;k++)C.set(o.color||[.7,.7,.7],(vo+k)*3);for(let k=0;k<o.g.i.length;k++)I[io+k]=o.g.i[k]+vo;vo+=n;io+=o.g.i.length});this.attr(0,P,3,this.buffers);this.attr(1,N,3,this.buffers);this.attr(2,B,1,this.buffers);this.attr(3,C,3,this.buffers);this.attr(4,O,1,this.buffers);this.tissueAttributes(items,nv);const ib=gl.createBuffer();this.buffers.push(ib);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,I,gl.STATIC_DRAW);this.geometryGPUBytes+=I.byteLength;this.count=ni;this.vertices=nv;this.lastItems=[...items];this.palette=new Float32Array(Math.max(1,items.length)*20);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.poseTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,5,Math.max(1,items.length),0,gl.RGBA,gl.FLOAT,this.palette);this.textureOptions();this.batchBuilds=(this.batchBuilds||0)+1;}
 lineBatch(lines){this.lineGeometryGPUBytes=0;const gl=this.gl;for(const b of this.lineBuffers)gl.deleteBuffer(b);if(this.lineVAO)gl.deleteVertexArray(this.lineVAO);this.lineBuffers=[];this.lineVAO=gl.createVertexArray();gl.bindVertexArray(this.lineVAO);const n=lines.reduce((n,l)=>n+l.g.i.length,0),P=new Float32Array(n*3),C=new Float32Array(n*3);let off=0;for(const l of lines)for(const id of l.g.i){P.set(l.g.p.subarray(id*3,id*3+3),off*3);C.set(l.color,off*3);off++}this.attr(0,P,3,this.lineBuffers);this.attr(1,C,3,this.lineBuffers);this.lineCount=n;this.lastLines=[...lines];}
 render(items,lines=[]){this.compactPerformance?.begin();const drawCompacts=this.activeCompacts().filter(surface=>surface.prepare(items)),replaced=new Set(drawCompacts.flatMap(surface=>[...surface.replaced]));items=items.filter(o=>o.g&&!replaced.has(o));const gl=this.gl,c=this.canvas,dpr=Math.min(devicePixelRatio||1,this.quality==='shadow'?1.6:1),w=Math.max(1,Math.floor(c.clientWidth*dpr)),h=Math.max(1,Math.floor(c.clientHeight*dpr));if(c.width!==w||c.height!==h){c.width=w;c.height=h}if(!this.vao||items.length!==this.lastItems.length||items.some((v,i)=>v!==this.lastItems[i]))this.batch(items);if(lines.length!==this.lastLines.length||lines.some((v,i)=>v!==this.lastLines[i]))this.lineBatch(lines);
 this.eye=add(this.target,[Math.sin(this.yaw)*Math.cos(this.pitch)*this.distance,Math.sin(this.pitch)*this.distance,Math.cos(this.yaw)*Math.cos(this.pitch)*this.distance]);const halfY=this.orthoHeight/2,halfX=halfY*w/h,projection=this.projection==='orthographic'?ortho(-halfX,halfX,-halfY,halfY,.015,80):perspective(.72,w/h,.015,80);this.vp=mm(projection,lookAt(this.eye,this.target));for(let id=0;id<items.length;id++){const o=items[id];this.palette.set(o.matrix||matrix(o.joint?.world.p||o.p||[0,0,0],o.joint?.world.q||o.q||[0,0,0,1]),id*20);this.palette.set([o.visible===false?0:1,o.castShadow===false?0:1,o.unlit?1:0,0],id*20+16)}gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.poseTexture);if(items.length)gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,5,items.length,gl.RGBA,gl.FLOAT,this.palette);this.matrixUploads++;this.drawCalls=0;this.shadowDrawCalls=0;const shadows=this.quality==='shadow'&&this.shadowAvailable;
 if(shadows){gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.viewport(0,0,this.shadowSize,this.shadowSize);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.2,1.0);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(this.depth.p);this.tissueUniforms(this.depth);gl.uniformMatrix4fv(this.depth.u.viewProjection,false,this.lightVP);gl.uniform1i(this.depth.u.posePalette,0);gl.uniform1f(this.depth.u.depthPass,1);gl.bindVertexArray(this.vao);gl.disable(gl.CULL_FACE);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_INT,0);this.shadowDrawCalls=1;for(const surface of drawCompacts)surface.draw(true);gl.disable(gl.POLYGON_OFFSET_FILL); }
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.clearColor(...(this.background||[.029,.048,.063]),1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const p=this.main;gl.useProgram(p.p);this.tissueUniforms(p);gl.uniformMatrix4fv(p.u.viewProjection,false,this.vp);gl.uniformMatrix4fv(p.u.lightVP,false,this.lightVP);gl.uniform3fv(p.u.eye,this.eye);gl.uniform1i(p.u.posePalette,0);gl.uniform1f(p.u.depthPass,0);gl.uniform1f(p.u.shadowsEnabled,shadows?1:0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.shadow);gl.uniform1i(p.u.shadow,1);gl.bindVertexArray(this.vao);gl.disable(gl.CULL_FACE);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_INT,0);this.drawCalls++;
 for(const surface of drawCompacts){surface.draw(false);surface.hair?.draw();}
 if(this.lineCount){if(this.overlayLines)gl.disable(gl.DEPTH_TEST);gl.useProgram(this.lineProgram.p);gl.uniformMatrix4fv(this.lineProgram.u.viewProjection,false,this.vp);gl.bindVertexArray(this.lineVAO);gl.drawArrays(gl.LINES,0,this.lineCount);gl.enable(gl.DEPTH_TEST);this.drawCalls++}this.frames++;this.compactPerformance?.end();updateCompactRenderInfo(this);}
 screen(p){if(!this.vp)return null;const v=project(this.vp,p);return{x:(v[0]+1)*this.canvas.clientWidth/2,y:(1-v[1])*this.canvas.clientHeight/2,visible:v[2]>-1&&v[2]<1&&Math.abs(v[0])<1.05&&Math.abs(v[1])<1.1}}
}
function lineMesh(points){const p=[],n=[],i=[];for(const[a,b]of points){const k=p.length/3;p.push(...a,...b);n.push(0,1,0,0,1,0);i.push(k,k+1)}return{p:Float32Array.from(p),n:Float32Array.from(n),i:Uint32Array.from(i)}}

/*__SOURCE:world/ActivitySpace.js__*/


// MODULE strength
/*__SOURCE:body/StrengthModel.js__*/
/*__SOURCE:body/StrengthBridge.js__*/
// MODULE world
const FIELD_BOUNDS=Object.freeze({xMin:-4.35,xMax:4.35,zMin:-3.30,zMax:3.30});
// MODULE camp_world
// Declarative environment, geometry and camera only. Body solvers remain owned
// by the humanoid modules. Parts use the collision dimensions in the scene data.
const CAMP_WORLD={"schema":"jarvis/camp_world@1","id":"camp","name":"军营与邻村","units":"meter","bounds":{"xMin":-13,"xMax":13,"zMin":-9.4,"zMax":9.4},"spawn":[0,0,0],"templates":{"campWall":{"templateId":"campWall","name":"营区墙体","shape":"box","category":"architecture","w":1,"h":1.25,"d":0.16,"color":[0.64,0.64,0.52],"mass":60,"movable":false,"collidable":true,"aliases":["营区墙体"]},"campFence":{"templateId":"campFence","name":"营区围栏","shape":"box","category":"architecture","w":0.12,"h":1.35,"d":3,"color":[0.3,0.37,0.29],"mass":60,"movable":false,"collidable":true,"aliases":["营区围栏"]},"bunk":{"templateId":"bunk","name":"双层床","shape":"box","category":"furniture","w":0.92,"h":1.65,"d":2,"color":[0.29,0.34,0.27],"mass":60,"movable":false,"collidable":true,"aliases":["双层床"]},"locker":{"templateId":"locker","name":"军绿色储物柜","shape":"box","category":"furniture","w":0.68,"h":1.65,"d":0.48,"color":[0.27,0.34,0.24],"mass":60,"movable":false,"collidable":true,"aliases":["军绿色储物柜"]},"supplyRack":{"templateId":"supplyRack","name":"物资货架","shape":"box","category":"furniture","w":1.9,"h":1.65,"d":0.55,"color":[0.4,0.43,0.36],"mass":60,"movable":false,"collidable":true,"aliases":["物资货架"]},"officeDesk":{"templateId":"officeDesk","name":"办公桌","shape":"box","category":"furniture","w":1.3,"h":0.76,"d":0.68,"color":[0.4,0.28,0.18],"mass":60,"movable":false,"collidable":true,"aliases":["办公桌"]},"campChair":{"templateId":"campChair","name":"办公椅","shape":"box","category":"furniture","w":0.48,"h":0.86,"d":0.5,"color":[0.28,0.34,0.29],"mass":60,"movable":false,"collidable":true,"aliases":["办公椅"]},"diningTable":{"templateId":"diningTable","name":"食堂餐桌","shape":"box","category":"furniture","w":1.25,"h":0.76,"d":0.72,"color":[0.48,0.47,0.37],"mass":60,"movable":false,"collidable":true,"aliases":["食堂餐桌"]},"kitchenCounter":{"templateId":"kitchenCounter","name":"食堂操作台","shape":"box","category":"furniture","w":2.2,"h":0.9,"d":0.65,"color":[0.55,0.59,0.56],"mass":60,"movable":false,"collidable":true,"aliases":["食堂操作台"]},"noticeboard":{"templateId":"noticeboard","name":"公告栏","shape":"box","category":"furniture","w":1.1,"h":1.65,"d":0.18,"color":[0.26,0.34,0.27],"mass":60,"movable":false,"collidable":true,"aliases":["公告栏"]},"guardBooth":{"templateId":"guardBooth","name":"门岗值班亭","shape":"box","category":"architecture","w":1.35,"h":2.25,"d":1.3,"color":[0.54,0.57,0.46],"mass":60,"movable":false,"collidable":true,"aliases":["门岗值班亭"]},"villageHouse":{"templateId":"villageHouse","name":"村舍","shape":"box","category":"architecture","w":2.4,"h":2.5,"d":2.4,"color":[0.69,0.61,0.48],"mass":60,"movable":false,"collidable":true,"aliases":["村舍"]},"marketStall":{"templateId":"marketStall","name":"村庄交货棚","shape":"box","category":"furniture","w":1.5,"h":1.9,"d":0.85,"color":[0.48,0.4,0.25],"mass":60,"movable":false,"collidable":true,"aliases":["村庄交货棚"]},"farmBed":{"templateId":"farmBed","name":"菜畦","shape":"box","category":"agriculture","w":2,"h":0.24,"d":1.05,"color":[0.3,0.23,0.14],"mass":60,"movable":false,"collidable":true,"aliases":["菜畦"]},"campTree":{"templateId":"campTree","name":"树木","shape":"box","category":"landscape","w":1,"h":2.9,"d":1,"color":[0.29,0.4,0.2],"mass":60,"movable":false,"collidable":true,"aliases":["树木"]},"campLamp":{"templateId":"campLamp","name":"路灯","shape":"box","category":"landscape","w":0.22,"h":2.4,"d":0.22,"color":[0.3,0.35,0.31],"mass":60,"movable":false,"collidable":true,"aliases":["路灯"]},"campBin":{"templateId":"campBin","name":"分类回收桶","shape":"box","category":"furniture","w":0.42,"h":0.72,"d":0.44,"color":[0.26,0.37,0.31],"mass":60,"movable":false,"collidable":true,"aliases":["分类回收桶"]},"supplyCrate":{"templateId":"supplyCrate","name":"补给箱","shape":"box","category":"cargo","w":0.38,"h":0.3,"d":0.32,"color":[0.38,0.44,0.25],"mass":3.5,"movable":true,"collidable":true,"aliases":["补给箱"]},"vegetableCrate":{"templateId":"vegetableCrate","name":"蔬菜筐","shape":"box","category":"cargo","w":0.4,"h":0.28,"d":0.34,"color":[0.55,0.39,0.19],"mass":2.5,"movable":true,"collidable":true,"aliases":["蔬菜筐"]},"campParcel":{"templateId":"campParcel","name":"文件包","shape":"box","category":"cargo","w":0.28,"h":0.1,"d":0.21,"color":[0.64,0.51,0.32],"mass":0.6,"movable":true,"collidable":true,"aliases":["文件包"]},"handcart":{"templateId":"handcart","name":"搬运手推车","shape":"box","category":"equipment","w":0.65,"h":0.82,"d":1,"color":[0.37,0.41,0.31],"mass":14,"movable":true,"collidable":true,"aliases":["搬运手推车"]}},"objects":[{"templateId":"campWall","id":"WH_B","name":"物资仓库后墙","p":[-9,0,-8],"w":6},{"templateId":"campWall","id":"WH_L","name":"物资仓库左墙","p":[-12,0,-5],"w":0.16,"d":6},{"templateId":"campWall","id":"WH_R","name":"物资仓库右墙","p":[-6,0,-5],"w":0.16,"d":6},{"templateId":"campWall","id":"WH_F1","name":"物资仓库门侧墙","p":[-11.05,0,-2],"w":1.9000000000000004},{"templateId":"campWall","id":"WH_F2","name":"物资仓库门侧墙","p":[-6.95,0,-2],"w":1.9000000000000004},{"templateId":"campWall","id":"BK_B","name":"士兵营房后墙","p":[-2.6,0,-8],"w":4.8},{"templateId":"campWall","id":"BK_L","name":"士兵营房左墙","p":[-5,0,-5],"w":0.16,"d":6},{"templateId":"campWall","id":"BK_R","name":"士兵营房右墙","p":[-0.2,0,-5],"w":0.16,"d":6},{"templateId":"campWall","id":"BK_F1","name":"士兵营房门侧墙","p":[-4.3,0,-2],"w":1.4},{"templateId":"campWall","id":"BK_F2","name":"士兵营房门侧墙","p":[-0.9,0,-2],"w":1.4000000000000001},{"templateId":"campWall","id":"HQ_B","name":"营区办公室后墙","p":[2.45,0,-8],"w":3.6},{"templateId":"campWall","id":"HQ_L","name":"营区办公室左墙","p":[0.65,0,-5],"w":0.16,"d":6},{"templateId":"campWall","id":"HQ_R","name":"营区办公室右墙","p":[4.25,0,-5],"w":0.16,"d":6},{"templateId":"campWall","id":"HQ_F1","name":"营区办公室门侧墙","p":[1.1,0,-2],"w":0.9000000000000002},{"templateId":"campWall","id":"HQ_F2","name":"营区办公室门侧墙","p":[3.8,0,-2],"w":0.8999999999999999},{"templateId":"campWall","id":"KT_B","name":"食堂后墙","p":[-9,0,8],"w":6},{"templateId":"campWall","id":"KT_L","name":"食堂左墙","p":[-12,0,5],"w":0.16,"d":6},{"templateId":"campWall","id":"KT_R","name":"食堂右墙","p":[-6,0,5],"w":0.16,"d":6},{"templateId":"campWall","id":"KT_F1","name":"食堂门侧墙","p":[-11.05,0,2],"w":1.9000000000000004},{"templateId":"campWall","id":"KT_F2","name":"食堂门侧墙","p":[-6.95,0,2],"w":1.9000000000000004},{"templateId":"supplyRack","id":"RACK_A","name":"被装物资货架","p":[-10.35,0,-7.4]},{"templateId":"supplyRack","id":"RACK_B","name":"日用物资货架","p":[-7.65,0,-7.4]},{"templateId":"supplyRack","id":"RACK_C","name":"耗材货架","p":[-11.45,0,-5.3],"w":0.55,"d":1.8},{"templateId":"bunk","id":"BED_A","name":"一号双层床","p":[-4.27,0,-6.4]},{"templateId":"bunk","id":"BED_B","name":"二号双层床","p":[-1,0,-6.4]},{"templateId":"locker","id":"LOCK_A","name":"一号储物柜","p":[-4.25,0,-2.65]},{"templateId":"locker","id":"LOCK_B","name":"二号储物柜","p":[-0.95,0,-2.65]},{"templateId":"officeDesk","id":"DESK_A","name":"值班办公桌","p":[1.6,0,-6.6]},{"templateId":"campChair","id":"CHAIR_A","name":"值班办公椅","p":[1.6,0,-5.65]},{"templateId":"locker","id":"FILE_A","name":"档案柜","p":[3.65,0,-7.2]},{"templateId":"noticeboard","id":"BOARD_A","name":"值勤公告栏","p":[3.7,0,-5.4],"w":0.18,"d":1.1},{"templateId":"kitchenCounter","id":"COOK_A","name":"食材备餐台","p":[-10.4,0,7.35]},{"templateId":"kitchenCounter","id":"COOK_B","name":"餐具清洗台","p":[-7.7,0,7.35]},{"templateId":"diningTable","id":"TABLE_A","name":"一号餐桌","p":[-10.65,0,4.6]},{"templateId":"diningTable","id":"TABLE_B","name":"二号餐桌","p":[-7.35,0,4.6]},{"templateId":"bench","id":"SEAT_11","name":"食堂长凳","p":[-10.65,0,3.85],"w":1.25,"d":0.33,"h":0.44},{"templateId":"bench","id":"SEAT_12","name":"食堂长凳","p":[-10.65,0,5.35],"w":1.25,"d":0.33,"h":0.44},{"templateId":"bench","id":"SEAT_21","name":"食堂长凳","p":[-7.35,0,3.85],"w":1.25,"d":0.33,"h":0.44},{"templateId":"bench","id":"SEAT_22","name":"食堂长凳","p":[-7.35,0,5.35],"w":1.25,"d":0.33,"h":0.44},{"templateId":"guardBooth","id":"GATE_A","name":"门岗值班亭","p":[3.25,0,2.25]},{"templateId":"noticeboard","id":"BOARD_B","name":"营区事务公告栏","p":[2.8,0,4.1]},{"templateId":"campBin","id":"BIN_A","name":"可回收物桶","p":[3.4,0,5.25]},{"templateId":"campBin","id":"BIN_B","name":"其他废弃物桶","p":[4,0,5.25]},{"templateId":"handcart","id":"CART_A","name":"物资周转手推车","p":[-5.25,0,0.2],"friction":0.08},{"templateId":"campFence","id":"FENCE_N","name":"营区与村道围栏","p":[4.65,0,-5.25],"d":7.5},{"templateId":"campFence","id":"FENCE_S","name":"营区与村道围栏","p":[4.65,0,5.25],"d":7.5},{"templateId":"campWall","id":"BACK_N","name":"营区北侧围墙","p":[-3.55,0,-8.65],"w":17,"h":1.05,"d":0.12},{"templateId":"campWall","id":"BACK_S","name":"营区南侧围墙","p":[-3.55,0,8.65],"w":17,"h":1.05,"d":0.12},{"templateId":"campFence","id":"BACK_W","name":"营区西侧围栏","p":[-12.65,0,0],"d":17.4},{"templateId":"villageHouse","id":"HOME_A","name":"村民住宅甲","p":[8.15,0,6.8],"w":2.5},{"templateId":"villageHouse","id":"HOME_B","name":"村民住宅乙","p":[11.4,0,6.8],"w":2.3,"color":[0.65,0.58,0.44]},{"templateId":"marketStall","id":"STALL_A","name":"农产品交货棚","p":[11.6,0,2.45]},{"templateId":"bench","id":"V_BENCH","name":"村口长凳","p":[8,0,3.7]},{"templateId":"farmBed","id":"BED_11","name":"蔬菜种植畦","p":[8,0,-6.65]},{"templateId":"farmBed","id":"BED_12","name":"蔬菜种植畦","p":[8,0,-4.7]},{"templateId":"farmBed","id":"BED_21","name":"蔬菜种植畦","p":[11.4,0,-6.65]},{"templateId":"farmBed","id":"BED_22","name":"蔬菜种植畦","p":[11.4,0,-4.7]},{"templateId":"campTree","id":"TREE_A","name":"院落树木","p":[7.25,0,8.55]},{"templateId":"campTree","id":"TREE_B","name":"院落树木","p":[12,0,8.5]},{"templateId":"campTree","id":"TREE_C","name":"院落树木","p":[7.15,0,-8]},{"templateId":"campTree","id":"TREE_D","name":"院落树木","p":[11.8,0,-8]},{"templateId":"campTree","id":"TREE_E","name":"院落树木","p":[0.1,0,8]},{"templateId":"campLamp","id":"LAMP_A","name":"道路照明灯","p":[-11.8,0,-1]},{"templateId":"campLamp","id":"LAMP_B","name":"道路照明灯","p":[-5.55,0,-0.9]},{"templateId":"campLamp","id":"LAMP_C","name":"道路照明灯","p":[3.9,0,-0.8]},{"templateId":"campLamp","id":"LAMP_D","name":"道路照明灯","p":[6.2,0,3]},{"templateId":"supplyCrate","id":"SUP_A","name":"被装补给箱","p":[-10.2,0,-4.65],"mass":3.5,"aliases":["被装","被装箱"]},{"templateId":"supplyCrate","id":"SUP_B","name":"食堂日用品箱","p":[-7.8,0,-4.65],"mass":4.5,"color":[0.51,0.44,0.25],"aliases":["日用品箱"]},{"templateId":"supplyCrate","id":"SUP_C","name":"保养耗材箱","p":[-10,0,-5.8],"mass":2.5,"color":[0.28,0.4,0.38],"aliases":["耗材箱"]},{"templateId":"campParcel","id":"DOC_A","name":"待移交文件包","p":[2.65,0,-6.25],"aliases":["文件包"]},{"templateId":"supplyCrate","id":"EMPTY_A","name":"食堂空周转箱","p":[-9,0,5.55],"mass":0.8,"color":[0.57,0.51,0.35],"aliases":["空箱"]},{"templateId":"vegetableCrate","id":"AGR_A","name":"青菜筐","p":[8.25,0,-2.95],"mass":2.5,"aliases":["青菜"]},{"templateId":"vegetableCrate","id":"AGR_B","name":"根菜筐","p":[11.2,0,-2.95],"mass":3.2,"aliases":["根菜"]},{"templateId":"vegetableCrate","id":"AGR_C","name":"田间收获筐","p":[9.65,0,-7.65],"mass":2,"aliases":["收获筐"]}],"zones":[{"id":"Z1","name":"门岗交接","p":[3.5,0,0],"r":0.65,"shape":"square","area":"gate","color":[0.26,0.47,0.43],"aliases":["门岗交接"],"activities":["walk","carry","greet"]},{"id":"Z2","name":"集合场","p":[-2.4,0,4.5],"r":0.8,"shape":"square","area":"parade","color":[0.26,0.47,0.43],"aliases":["集合场"],"activities":["walk","carry","greet"]},{"id":"Z3","name":"仓库收货","p":[-9,0,-3.35],"r":0.68,"shape":"square","area":"warehouse","color":[0.26,0.47,0.43],"aliases":["仓库收货"],"activities":["walk","carry","greet"]},{"id":"Z4","name":"仓库归还","p":[-9,0,-5.75],"r":0.6,"shape":"square","area":"warehouse","color":[0.26,0.47,0.43],"aliases":["仓库归还"],"activities":["walk","carry","greet"]},{"id":"Z5","name":"营房补给","p":[-2.5,0,-4],"r":0.65,"shape":"square","area":"barracks","color":[0.26,0.47,0.43],"aliases":["营房补给"],"activities":["walk","carry","greet"]},{"id":"Z6","name":"办公室报到","p":[2.15,0,-3.65],"r":0.6,"shape":"square","area":"office","color":[0.26,0.47,0.43],"aliases":["办公室报到"],"activities":["walk","carry","greet"]},{"id":"Z7","name":"事务交接","p":[1.3,0,2.4],"r":0.65,"shape":"square","area":"services","color":[0.26,0.47,0.43],"aliases":["事务交接"],"activities":["walk","carry","greet"]},{"id":"Z8","name":"食堂接货","p":[-9,0,3.25],"r":0.65,"shape":"square","area":"canteen","color":[0.26,0.47,0.43],"aliases":["食堂接货"],"activities":["walk","carry","greet"]},{"id":"Z9","name":"回收交接","p":[2,0,6.2],"r":0.65,"shape":"square","area":"services","color":[0.26,0.47,0.43],"aliases":["回收交接"],"activities":["walk","carry","greet"]},{"id":"Z10","name":"营区地面休息","p":[-0.7,0,7.1],"r":0.85,"shape":"circle","area":"rest","color":[0.39,0.49,0.61],"aliases":["营区地面休息"],"activities":["walk","sit_ground","lie_ground","stand_up"]},{"id":"Z11","name":"农产品分拣","p":[9.7,0,-1.9],"r":0.62,"shape":"square","area":"village","color":[0.69,0.53,0.27],"aliases":["农产品分拣"],"activities":["walk","carry","greet"]},{"id":"Z12","name":"村口交接","p":[7.55,0,0],"r":0.7,"shape":"square","area":"village","color":[0.69,0.53,0.27],"aliases":["村口交接"],"activities":["walk","carry","greet"]},{"id":"Z13","name":"耗材归整","p":[-7.3,0,-3.3],"r":0.6,"shape":"square","area":"warehouse","color":[0.26,0.47,0.43],"aliases":["耗材归整"],"activities":["walk","carry","greet"]},{"id":"Z14","name":"田间作业点","p":[9.65,0,-5.5],"r":0.65,"shape":"square","area":"farm","color":[0.69,0.53,0.27],"aliases":["田间作业点"],"activities":["walk","carry","greet"]},{"id":"Z15","name":"周转车停放","p":[-5.3,0,1.35],"r":0.55,"shape":"square","area":"services","color":[0.26,0.47,0.43],"aliases":["周转车停放"],"activities":["walk","carry","greet"]},{"id":"Z16","name":"村庄地面休息","p":[9.75,0,4.4],"r":0.85,"shape":"circle","area":"rest","color":[0.39,0.49,0.61],"aliases":["村庄地面休息"],"activities":["walk","sit_ground","lie_ground","stand_up"]},{"id":"Z17","name":"村口青菜交货","p":[8.5,0,1.2],"r":0.6,"shape":"square","area":"village","color":[0.69,0.53,0.27],"aliases":["青菜交货"],"activities":["walk","carry"]},{"id":"Z18","name":"村口根菜交货","p":[10,0,0.9],"r":0.6,"shape":"square","area":"village","color":[0.69,0.53,0.27],"aliases":["根菜交货"],"activities":["walk","carry"]}],"ground":[{"id":"terrain","p":[0,-0.027,0],"size":[26.3,0.025,19.1],"color":[0.34,0.4,0.26]},{"id":"main_avenue","p":[-0.6,-0.0262,0],"size":[25.1,0.025,3],"color":[0.42,0.43,0.39]},{"id":"village_road","p":[5.9,-0.0254,0],"size":[1.8,0.025,18.4],"color":[0.52,0.49,0.38]},{"id":"camp_apron","p":[-3.5,-0.0246,0.1],"size":[16.3,0.025,2.7],"color":[0.49,0.49,0.42]},{"id":"parade","p":[-2.4,-0.023799999999999998,5],"size":[5.8,0.025,6.3],"color":[0.53,0.54,0.45]},{"id":"village_yard","p":[9.7,-0.023,3.7],"size":[5.8,0.025,4.3],"color":[0.59,0.54,0.39]},{"id":"farm_track","p":[9.8,-0.022199999999999998,-3.15],"size":[5.6,0.025,1.7],"color":[0.5,0.42,0.28]},{"id":"farm_crosswalk","p":[9.7,-0.0214,-6.2],"size":[1.1,0.025,5.8],"color":[0.5,0.42,0.28]},{"id":"WH_FLOOR","p":[-9,-0.0206,-5],"size":[6,0.025,6],"color":[0.63,0.6,0.49]},{"id":"BK_FLOOR","p":[-2.6,-0.019799999999999998,-5],"size":[4.8,0.025,6],"color":[0.63,0.6,0.49]},{"id":"HQ_FLOOR","p":[2.45,-0.019,-5],"size":[3.6,0.025,6],"color":[0.63,0.6,0.49]},{"id":"KT_FLOOR","p":[-9,-0.0182,5],"size":[6,0.025,6],"color":[0.63,0.6,0.49]}],"roofs":[{"id":"WH_ROOF","p":[-9,2.45,-5],"size":[6.25,0.12,6.25],"color":[0.3,0.36,0.27]},{"id":"BK_ROOF","p":[-2.6,2.45,-5],"size":[5.05,0.12,6.25],"color":[0.3,0.36,0.27]},{"id":"HQ_ROOF","p":[2.45,2.45,-5],"size":[3.85,0.12,6.25],"color":[0.3,0.36,0.27]},{"id":"KT_ROOF","p":[-9,2.45,5],"size":[6.25,0.12,6.25],"color":[0.3,0.36,0.27]}],"rooms":[{"id":"WH","name":"物资仓库","xMin":-12,"xMax":-6,"zMin":-8,"zMax":-2,"door":{"x":-9,"z":-2,"widthM":2.2}},{"id":"BK","name":"士兵营房","xMin":-5,"xMax":-0.2,"zMin":-8,"zMax":-2,"door":{"x":-2.6,"z":-2,"widthM":2}},{"id":"HQ","name":"营区办公室","xMin":0.65,"xMax":4.25,"zMin":-8,"zMax":-2,"door":{"x":2.45,"z":-2,"widthM":1.8}},{"id":"KT","name":"食堂","xMin":-12,"xMax":-6,"zMin":2,"zMax":8,"door":{"x":-9,"z":2,"widthM":2.2}}],"presentation":{"cutaway":true,"background":[0.69,0.75,0.72],"overview":{"target":[-0.2,0.3,0],"distance":39,"pitch":1,"yaw":0.16}},"designNotes":["虚构的日常后勤场景；营区与村庄通过门岗和村道相连。","建筑使用剖切墙体；屋顶可显示，室内家具保留完整碰撞。","座椅是环境物件，当前休息动作在标出的空旷地面执行。","一个可控制身体按身份载入任务；本版不生成多名自主行走角色。"]};
function sceneBounds(world){return world?.bounds||FIELD_BOUNDS;}
function validateSceneBounds(input){
 if(input==null)return {...FIELD_BOUNDS};
 const b={};for(const k of ['xMin','xMax','zMin','zMax']){if(!Number.isFinite(input[k])||Math.abs(input[k])>40)throw Error('场景边界需要 -40 至 40 米的有限数值');b[k]=input[k];}
 if(b.xMax-b.xMin<3||b.zMax-b.zMin<3||b.xMax-b.xMin>40||b.zMax-b.zMin>40)throw Error('场景长宽需要为 3 至 40 米');return b;
}
function campColored(parts){
 const g=combine(parts.map(p=>p.g)),c=new Float32Array(g.p.length);let offset=0;
 for(const p of parts){if(p.g.c)c.set(p.g.c,offset);else for(let i=0;i<p.g.p.length;i+=3)c.set(p.color,offset+i);offset+=p.g.p.length;}g.c=c;return g;
}
function campFurniture(def){
 if(!Object.hasOwn(CAMP_WORLD.templates,def.templateId)||def.shape!=='box')return null;
 const {w,h,d}=def,parts=[],base=def.color,metal=[.27,.32,.27],wood=[.42,.29,.17],linen=[.70,.70,.57],dark=[.18,.23,.19];
 const part=(x,y,z,W,H,D,color=base,q=qi())=>parts.push({g:transform(box(W,H,D),[x,y-h/2,z],q),color});
 const post=(x,z,height=h)=>part(x,height/2,z,.04,height,.04,metal);
 const top=(y,color=base)=>part(0,y,0,w,.045,d,color);
 const kind=def.templateId;
 if(kind==='campWall'){part(0,h/2,0,w,h,d);part(0,h-.02,0,w,.04,d,[.72,.70,.59]);part(0,.09,0,w,.18,d+.006,[.43,.45,.36]);}
 else if(kind==='campFence'){
  const alongX=w>d,L=alongX?w:d,n=Math.max(2,Math.ceil(L/.38));
  for(let i=0;i<=n;i++){const v=-L/2+.025+(L-.05)*i/n;part(alongX?v:0,h/2,alongX?0:v,.035,h,.035,metal);}
  for(const y of [h*.22,h*.75])part(0,y,0,alongX?w:.025,.035,alongX?.025:d,metal);
 }
 else if(kind==='bunk'){
  for(const x of [-w*.44,w*.44])for(const z of [-d*.47,d*.47])post(x,z);
  for(const y of [.24,h*.72]){part(0,y,0,w,.075,d,metal);part(0,y+.065,0,w*.94,.09,d*.95,linen);part(0,y+.12,-d*.32,w*.7,.07,d*.20,[.79,.77,.64]);part(0,y+.12,d*.14,w*.91,.035,d*.53,base);}
  for(let i=0;i<4;i++)part(w*.47,.35+i*.29,d*.22,.035,.025,d*.34,metal);
 }
 else if(kind==='locker'){
  part(0,h/2,0,w,h,d);part(0,h/2,d/2+.001,.012,h*.93,.008,dark);
  for(const x of [-w*.11,w*.11]){part(x,h*.53,d/2+.009,.02,.12,.018,linen);for(let j=0;j<3;j++)part(x,h*.82+j*.045,d/2+.006,w*.27,.015,.01,dark);}
 }
 else if(kind==='supplyRack'){
  for(const x of [-w*.48,w*.48])for(const z of [-d*.45,d*.45])post(x,z);
  for(let i=0;i<4;i++){const y=.07+i*(h-.15)/3;part(0,y,0,w,.04,d,metal);if(i<3)for(const x of [-w*.27,w*.27])part(x,y+.13,0,w*.35,.22,d*.79,i%2?wood:[.53,.50,.33]);}
 }
 else if(['officeDesk','diningTable','kitchenCounter'].includes(kind)){
  top(h-.025,kind==='kitchenCounter'?[.67,.70,.66]:base);
  for(const x of [-w*.43,w*.43])for(const z of [-d*.4,d*.4])post(x,z,h-.045);
  if(kind==='officeDesk'){part(w*.3,h*.58,0,w*.28,h*.55,d*.9,wood);part(-w*.22,h+.018,0,w*.22,.028,d*.45,linen);}
  if(kind==='kitchenCounter'){part(0,h*.38,0,w*.95,h*.65,d*.92,metal);part(-w*.22,h+.01,0,w*.28,.018,d*.52,dark);}
 }
 else if(kind==='campChair'){
  part(0,h*.48,0,w,.065,d,base);part(0,h*.77,-d*.43,w,h*.45,.055,base);for(const x of [-w*.4,w*.4])for(const z of [-d*.38,d*.38])post(x,z,h*.45);
 }
 else if(kind==='noticeboard'){
  const side=d>w;for(const v of [-.4,.4])post(side?0:w*v,side?d*v:0);
  part(0,h*.73,0,w,h*.45,d,wood);for(const v of [-.26,.20])part(side?w*.51:w*v,h*.73,side?d*v:d*.51,side?.012:w*.3,h*.29,side?d*.3:.012,linen);
 }
 else if(['guardBooth','villageHouse'].includes(kind)){
  part(0,h*.42,0,w,h*.84,d,base);part(0,h*.44,d/2+.004,w*.25,h*.55,.014,wood);
  for(const x of [-w*.32,w*.32]){part(x,h*.56,d/2+.01,w*.18,h*.22,.018,dark);part(x,h*.56,d/2+.02,.02,h*.23,.025,linen);}
  const slope=.25,roofW=w*.53;for(const sign of [-1,1])part(sign*w*.25,h*.91,0,roofW,.09,d*.99,kind==='villageHouse'?[.46,.28,.19]:metal,qz(-sign*slope));
 }
 else if(kind==='marketStall'){
  for(const x of [-w*.46,w*.46])for(const z of [-d*.43,d*.43])post(x,z,h*.97);
  top(h*.47,wood);part(0,h*.97,0,w,.07,d,base);part(0,h*.3,0,w*.9,h*.28,d*.8,wood);
 }
 else if(kind==='farmBed'){
  part(0,h*.22,0,w,h*.44,d,[.30,.23,.14]);
  for(let i=0;i<7;i++)for(let j=0;j<3;j++){const x=(-.42+i*.14)*w,z=(-.33+j*.33)*d;part(x,h*.63,z,w*.055,h*.62,d*.1,[.27,.43,.18],qz(i%2?.18:-.18));}
 }
 else if(kind==='campTree'){
  part(0,h*.35,0,w*.15,h*.7,d*.15,wood);
  for(const [y,s] of [[.56,1],[.74,.83],[.84,.53]])parts.push({g:transform(cylinder(w*s/2,h*.32,7,w*s*.35),[0,h*y-h/2,0]),color:base});
 }
 else if(kind==='campLamp'){
  part(0,h*.48,0,w*.24,h*.96,d*.24,metal);part(0,h*.94,0,w,h*.1,d,linen);part(0,h*.997,0,w,.006,d,metal);
 }
 else if(kind==='campBin'){part(0,h*.46,0,w*.93,h*.92,d*.93);top(h*.94,metal);part(0,h*.57,d*.48,w*.45,h*.14,.014,linen);}
 else if(['supplyCrate','vegetableCrate','campParcel'].includes(kind)){
  part(0,h*.45,0,w,h*.9,d);top(h*.94,kind==='campParcel'?base:wood);
  if(kind!=='campParcel'){for(const x of [-w*.36,w*.36])part(x,h*.48,d*.502,.035,h*.92,.009,wood);part(0,h*.51,d*.508,w*.40,h*.27,.012,linen);}
  if(kind==='vegetableCrate')for(const x of [-w*.28,0,w*.28])part(x,h*.93,0,w*.2,h*.12,d*.45,[.29,.47,.20]);
 }
 else if(kind==='handcart'){
  part(0,.23,0,w,.08,d,wood);for(const x of [-w*.43,w*.43]){part(x,.56,-d*.43,.04,h-.23,.04,metal);for(const z of [-d*.33,d*.33])parts.push({g:transform(cylinder(.12,.06,12),[x,.12-h/2,z],qz(Math.PI/2)),color:dark});}part(0,h-.025,-d*.43,w,.04,.04,metal);
 }
 else return null;
 return campColored(parts);
}
function installCampPreset(world,addObject){
 world.bounds={...CAMP_WORLD.bounds};world.theme='camp';
 for(const raw of CAMP_WORLD.objects){const {templateId,id,name,p,...extra}=raw;addObject(templateId,id,name,p,extra);}
 world.zones=CAMP_WORLD.zones.map(z=>world.normalizeZone(z,z.id));installNPCRoutineWorld(world,addObject);prepareCampScenery(world);
}
function prepareCampScenery(world){
 world.scenery=[];world.roofItems=[];world.showRoofs=false;
 if(world.theme!=='camp')return;
 const item=raw=>({g:box(...raw.size),p:[...raw.p],q:qi(),color:[...raw.color],castShadow:false});
 // Ground and roofs are presentation only. All tall props are world entities.
 const ground=campColored(CAMP_WORLD.ground.map(raw=>({g:transform(box(...raw.size),raw.p),color:raw.color})));
 world.scenery=[{g:ground,p:[0,0,0],q:qi(),castShadow:false}];world.roofItems=CAMP_WORLD.roofs.map(item);
}
function configureWorldPresentation(){
 if(!world||!renderer)return;const camp=world.theme==='camp',b=sceneBounds(world);
 if(floor){floor.g=box(b.xMax-b.xMin+.3,.035,b.zMax-b.zMin+.3);floor.p=[(b.xMin+b.xMax)/2,-.04,(b.zMin+b.zMax)/2];floor.color=camp?[.34,.40,.26]:[.19,.22,.23];}
 renderer.background=camp?[...CAMP_WORLD.presentation.background]:null;
 renderer.lightVP=camp?mm(ortho(-19,19,-17,17,.1,60),lookAt([-13,24,13],[0,0,0])):mm(ortho(-5.2,5.2,-4.4,4.4,.1,20),lookAt([-4,8,5],[0,0,0]));
}
function campOverview(region='all'){
 if(world?.theme!=='camp')throw Error('当前场景不是军营与邻村');
 if(['hands','shoulders','torso','headNeck','lowerLimb'].some(k=>window.HumanLab?.[k]?.active))throw Error('请先退出部位编辑视图');
 focus('field');const view=region==='village'?{target:[9.6,.3,0],distance:24,pitch:1.05,yaw:0}:region==='camp'?{target:[-3.6,.3,0],distance:31,pitch:1.05,yaw:.12}:CAMP_WORLD.presentation.overview;
 Object.assign(renderer,{projection:'perspective',target:[...view.target],distance:view.distance,pitch:view.pitch,yaw:view.yaw});needsRedraw=true;
}

// MODULE npc_routine_world
/*__SOURCE:world/NPCRoutineWorld.js__*/

// MODULE camp_navigation
/*__SOURCE:world/GridNavigation.js__*/

// MODULE world_entities
const PHYSICAL_REASONING_PROFILE=Object.freeze({schema:'knowledge_human/body_physical_profile@2.0',profileId:'humanoid_muscle_capacity_v1',strengthModel:'jarvis/strength_profile@1',maxGripSpanM:.66,maxCarryRadiusM:.42,maxCarryHeightM:.95,bodyRadiusM:.26,carryClearanceM:.43,pushClearanceM:.34,nominalWalkMps:.48,nominalCarryMps:.43,nominalPushMps:.22,note:'几何通行参数；力量由当前肌群和状态计算，尚未进行真人校准'});
const SHAPE_LABELS=Object.freeze({box:'长方体',sphere:'球体',cylinder:'圆柱',cone:'圆锥',prism:'三棱柱'});
const SHAPE_ALIASES=Object.freeze({box:['长方体','方块','箱子','方盒'],sphere:['球体','球'],cylinder:['圆柱','柱体'],cone:['圆锥','锥体'],prism:['三棱柱','棱柱']});
const OBJECT_TEMPLATES=Object.freeze({
 ...CAMP_WORLD.templates,...NPC_ROUTINE_TEMPLATES,
 worktable:Object.freeze({templateId:'worktable',name:'工作台',category:'furniture',shape:'box',w:1.15,h:.75,d:.62,mass:60,movable:false,collidable:true,color:[.35,.255,.16],aliases:['工作台','桌子']}),
 shelf:Object.freeze({templateId:'shelf',name:'储物架',category:'furniture',shape:'box',w:1.15,h:1.5,d:.38,mass:90,movable:false,collidable:true,color:[.26,.22,.17],aliases:['储物架','书架']}),
 bench:Object.freeze({templateId:'bench',name:'休息长凳',category:'furniture',shape:'box',w:1.25,h:.44,d:.45,mass:50,movable:false,collidable:true,color:[.27,.32,.29],aliases:['长凳','休息长凳']}),
 box:Object.freeze({templateId:'box',name:'训练箱',category:'movable',shape:'box',color:[.63,.09,.055],w:.30,h:.28,d:.28,mass:1.2,movable:true,collidable:true,aliases:['训练箱','箱子','方块']}),
 sphere:Object.freeze({templateId:'sphere',name:'训练球',category:'movable',shape:'sphere',color:[.045,.27,.78],r:.15,mass:.7,movable:true,collidable:true,aliases:['训练球','球体','球']}),
 cylinder:Object.freeze({templateId:'cylinder',name:'训练圆柱',category:'movable',shape:'cylinder',color:[.91,.53,.04],r:.13,h:.29,mass:1,movable:true,collidable:true,aliases:['训练圆柱','圆柱','柱体']}),
 cone:Object.freeze({templateId:'cone',name:'训练圆锥',category:'movable',shape:'cone',color:[.05,.50,.24],r:.15,h:.31,mass:.8,movable:true,collidable:true,aliases:['训练圆锥','圆锥','锥体']}),
 prism:Object.freeze({templateId:'prism',name:'训练三棱柱',category:'movable',shape:'prism',color:[.46,.17,.70],r:.17,h:.27,mass:1.1,movable:true,collidable:true,aliases:['训练三棱柱','三棱柱','棱柱']}),
 wall:Object.freeze({templateId:'wall',name:'障碍墙',category:'obstacle',shape:'box',color:[.18,.25,.31],w:1.45,h:.82,d:.16,mass:80,movable:false,collidable:true,aliases:['障碍墙','墙','挡板','障碍物']}),
 pillar:Object.freeze({templateId:'pillar',name:'障碍柱',category:'obstacle',shape:'cylinder',color:[.22,.30,.35],r:.22,h:.92,mass:60,movable:false,collidable:true,aliases:['障碍柱','柱子','立柱','障碍物']}),
 platform:Object.freeze({templateId:'platform',name:'低平台',category:'obstacle',shape:'box',color:[.24,.28,.32],w:.78,h:.20,d:.62,mass:90,movable:false,collidable:true,aliases:['低平台','平台','台子','障碍物']}),
 landmark:Object.freeze({templateId:'landmark',name:'导航标记',category:'landmark',shape:'cylinder',color:[.08,.66,.74],r:.10,h:.035,mass:0,movable:false,collidable:false,aliases:['导航标记','标记点','目标点','路标']})
});
const DEFAULT_OBJECTS=Object.freeze([
 Object.freeze({id:'A',templateId:'box',name:'红色长方体',color:[.63,.075,.045],aliases:['红色','红','长方体','方块','箱子','方盒']}),
 Object.freeze({id:'B',templateId:'sphere',name:'蓝色球体',color:[.035,.23,.70],aliases:['蓝色','蓝','球体','球','蓝球']}),
 Object.freeze({id:'C',templateId:'cylinder',name:'黄色圆柱',color:[.85,.48,.025],aliases:['黄色','黄','圆柱','柱体']}),
 Object.freeze({id:'D',templateId:'cone',name:'绿色圆锥',color:[.045,.46,.22],aliases:['绿色','绿','圆锥','锥体']}),
 Object.freeze({id:'E',templateId:'prism',name:'紫色三棱柱',color:[.40,.13,.62],aliases:['紫色','紫','三棱柱','棱柱']})
]);
const DEFAULT_ZONES=Object.freeze([
 Object.freeze({id:'Z1',name:'一区 · 正方形实线',shape:'square',p:[-2.55,0,-2.2],r:.70,color:[.13,.52,.56],aliases:['Z1','一区','区域一','一号','正方形','实线']}),
 Object.freeze({id:'Z2',name:'二区 · 圆形虚线',shape:'circle',p:[0,0,-2.2],r:.72,color:[.78,.48,.14],aliases:['Z2','二区','区域二','二号','圆形','虚线']}),
 Object.freeze({id:'Z3',name:'三区 · 六边形点线',shape:'hexagon',p:[2.55,0,-2.2],r:.80,color:[.48,.36,.71],aliases:['Z3','三区','区域三','三号','六边形','点线']})
]);
const SCENE_PRESETS=Object.freeze({
 camp:Object.freeze({id:'camp',name:'军营与邻村',description:'营房、仓储、食堂、日常管理区与附近村庄；配有职业长任务'}),
 living:Object.freeze({id:'living',name:'智能生活空间',description:'工作、交流、地面休息区域与可交互物体；保留任务检查和避障'}),
 sorting:Object.freeze({id:'sorting',name:'搬运与分类',description:'五个可搬运物体与三个目标区域，适合抓取、搬运、推动和排序测试'}),
 obstacle:Object.freeze({id:'obstacle',name:'障碍绕行',description:'静态墙体、立柱与可搬运物体，适合路线规划和避障测试'}),
 corridor:Object.freeze({id:'corridor',name:'狭窄通道',description:'两组长墙构成通道，适合净空、转向和目标接近测试'}),
 mixed:Object.freeze({id:'mixed',name:'混合训练场',description:'可搬运物体、静态障碍、平台和导航标记同时存在'}),
 empty:Object.freeze({id:'empty',name:'空场地',description:'保留目标区域并清空物体，适合基础步态和手势测试'})
});
const clone=v=>JSON.parse(JSON.stringify(v));
const finite=(v,fallback,min=-Infinity,max=Infinity)=>{v=Number(v);return Number.isFinite(v)?clamp(v,min,max):fallback};
const uniqueStrings=values=>[...new Set((values||[]).flatMap(v=>String(v||'').split(/[，,;；]/)).map(v=>v.trim()).filter(Boolean))];
function normalizeColor(value,fallback=[.35,.45,.52]){if(typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value))return[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255);if(Array.isArray(value)&&value.length>=3)return value.slice(0,3).map((v,i)=>finite(v,fallback[i],0,1));return[...fallback]}
function objectYaw(o){return Number.isFinite(o?.yaw)?o.yaw:2*Math.atan2(o?.q?.[1]||0,o?.q?.[3]||1)}
function objectFootprint(o){const e=objectWorldHalfExtents(o);return [e[0],e[2]];}
function findHumanSpawn(world,h){
 const radius=bodyPhysicalProfile(h).bodyRadiusM+.06;
 const bounds=sceneBounds(world),preferred=world.theme==='camp'?[...CAMP_WORLD.spawn]:[0,0,1.75];if(!world.collision(preferred,radius))return preferred;
 const candidates=[];
 for(let z=bounds.zMin+.4;z<=bounds.zMax-.4;z+=.25)for(let x=bounds.xMin+.4;x<=bounds.xMax-.4;x+=.25)candidates.push([x,0,z]);
 candidates.sort((a,b)=>dist(a,preferred)-dist(b,preferred));
 const point=candidates.find(p=>!world.collision(p,radius));if(!point)throw Error('场景没有足够的人物站立空间');return point;
}
function objectRadius(o){if(o.shape==='sphere')return o.r;if(o.q&&objectTilted(o)){const e=objectWorldHalfExtents(o);return Math.hypot(e[0],e[2]);}return o.shape==='box'?Math.hypot(o.w,o.d)/2:o.r}
function pointToObjectClearance(p,o){const dx=p[0]-o.p[0],dz=p[2]-o.p[2];if(objectTilted(o)){const [rx,rz]=objectFootprint(o);return Math.hypot(Math.max(Math.abs(dx)-rx,0),Math.max(Math.abs(dz)-rz,0));}if(o.shape==='box'){const a=-objectYaw(o),x=Math.cos(a)*dx-Math.sin(a)*dz,z=Math.sin(a)*dx+Math.cos(a)*dz,qx=Math.max(Math.abs(x)-o.w/2,0),qz=Math.max(Math.abs(z)-o.d/2,0);return Math.hypot(qx,qz)}return Math.max(0,Math.hypot(dx,dz)-o.r)}
function circleHitsObject(p,r,o){return o.collidable!==false&&pointToObjectClearance(p,o)<r}
/*__SOURCE:world/PhysicsContract.js__*/
/*__SOURCE:world/PhysicsWorld.js__*/
/*__SOURCE:world/PhysicsControls.js__*/
class World{
 constructor(seed=260901){this.bounds={...FIELD_BOUNDS};this.theme=null;this.scenery=[];this.roofItems=[];this.geometryCache=new Map();this.sceneId='scene_training_default';this.sceneName='搬运与分类';this.presetId='sorting';this.physicsSettings=worldPhysicsSettings();this.reset(seed);this.physics=new PhysicsWorld(this)}
 geometryFor(def){const key=[def.templateId||'',def.shape,...(def.color||[]),...[def.w||0,def.h||0,def.d||0,def.r||0].map(v=>Number(v).toFixed(4))].join(':');let g=this.geometryCache.get(key);if(!g){const furniture=routineFurniture(def)||campFurniture(def)||activityFurniture(def);if(furniture)g=furniture;else if(def.shape==='box')g=box(def.w,def.h,def.d);else if(def.shape==='sphere')g=ellipsoid([0,0,0],[def.r,def.r,def.r],36,24);else if(def.shape==='cylinder')g=cylinder(def.r,def.h);else if(def.shape==='cone')g=cylinder(def.r,def.h,36,0);else g=cylinder(def.r,def.h,3);this.geometryCache.set(key,g)}return g}
 nextObjectId(){const used=new Set(this.objects.map(o=>o.id));for(let code=65;code<=90;code++){const id=String.fromCharCode(code);if(!used.has(id)&&!id.startsWith('Z'))return id}let n=1;while(used.has('O'+n))n++;return'O'+n}
 nextZoneId(){const used=new Set(this.zones.map(z=>z.id));let n=1;while(used.has('Z'+n))n++;return'Z'+n}
 normalizeObject(input={},idOverride=null){const template=OBJECT_TEMPLATES[input.templateId]||OBJECT_TEMPLATES[input.shape]||OBJECT_TEMPLATES.box,shape=['box','sphere','cylinder','cone','prism'].includes(input.shape)?input.shape:template.shape;let h=finite(input.h,template.h||((template.r||.15)*2),.03,4),w=finite(input.w,template.w||((template.r||.15)*2) ,.04,40),d=finite(input.d,template.d||((template.r||.15)*2) ,.04,40),r=finite(input.r,template.r||Math.max(w,d)/2,.025,3);if(shape==='sphere'){h=r*2;w=r*2;d=r*2}else if(shape!=='box'){w=r*2;d=r*2}const movable=input.movable==null?template.movable!==false:Boolean(input.movable),collidable=input.collidable==null?template.collidable!==false:Boolean(input.collidable),yaw=finite(input.yaw,objectYaw(input),-Math.PI*4,Math.PI*4),id=String(idOverride||input.id||this.nextObjectId()).trim().toUpperCase();if(!/^[A-Z][A-Z0-9_]{0,11}$/.test(id)||id.startsWith('Z'))throw Error('物体 ID 需要以字母开头，且不能使用 Z 区域前缀');const p0=Array.isArray(input.p)?input.p:[finite(input.x,0),0,finite(input.z,0)],p=[finite(p0[0],0,this.bounds.xMin,this.bounds.xMax),h/2,finite(p0[2],0,this.bounds.zMin,this.bounds.zMax)],name=String(input.name||template.name||`${SHAPE_LABELS[shape]} ${id}`).trim().slice(0,28)||`${SHAPE_LABELS[shape]} ${id}`,aliases=uniqueStrings([...(template.aliases||[]),...(SHAPE_ALIASES[shape]||[]),...(input.aliases||[]),name,id]);const normalized={id,templateId:input.templateId||template.templateId||shape,name,category:String(input.category||template.category||(movable?'movable':'obstacle')),color:normalizeColor(input.color,template.color),shape,r:objectRadius({shape,w,d,r}),h,w,d,mass:finite(input.mass,template.mass||1,movable?.05:0,250),friction:finite(input.friction,.4,0,2),restitution:finite(input.restitution,.08,0,.9),gripFriction:finite(input.gripFriction,.6,.05,2),movable,collidable,aliases,p,yaw,q:worldPhysicsQuaternion(input.q,yaw),g:null,v:worldPhysicsVector(input.v,[0,0,0],30,'线速度'),angularVelocity:worldPhysicsVector(input.angularVelocity,[0,0,0],80,'角速度'),held:false,moveCount:Math.max(0,Math.floor(finite(input.moveCount,0,0,1e9)))};normalized.p[1]=Number.isFinite(p0[1])&&p0[1]>0?finite(p0[1],h/2,0,12):objectBottomOffset(normalized);if(normalized.p[1]-objectBottomOffset(normalized)<-.02)throw Error('物体穿过地面，请提高离地高度或减小尺寸');normalized.yaw=2*Math.atan2(normalized.q[1],normalized.q[3]);normalized.g=this.geometryFor(normalized);return normalized}
 normalizeZone(input={},idOverride=null){const id=String(idOverride||input.id||this.nextZoneId()).trim().toUpperCase();if(!/^Z\d{1,3}$/.test(id))throw Error('区域 ID 需要使用 Z 加数字，例如 Z4');const shape=['square','circle','hexagon'].includes(input.shape)?input.shape:'circle',p0=Array.isArray(input.p)?input.p:[finite(input.x,0),0,finite(input.z,0)],name=String(input.name||`${id} 训练区域`).trim().slice(0,28)||`${id} 训练区域`;return{id,name,shape,p:[finite(p0[0],0,this.bounds.xMin,this.bounds.xMax),0,finite(p0[2],0,this.bounds.zMin,this.bounds.zMax)],r:finite(input.r,.72,.25,1.8),color:normalizeColor(input.color,[.16,.58,.65]),aliases:uniqueStrings([...(input.aliases||[]),id,name,shape==='square'?'正方形':shape==='circle'?'圆形':'六边形'])}}
 canPlace(o,ignoreId=null,avoidPoint=null){if(o.p[1]-objectBottomOffset(o)<-.02)return{ok:false,reason:'物体穿过地面'};const overlap=this.objects.find(other=>other.id!==ignoreId&&worldPlacementOverlap(o,other));if(overlap)return{ok:false,reason:'物体与 '+overlap.name+' 的放置包络重叠，请调整位置'};if(this.population&&o.collidable!==false&&[...this.population.values()].some(a=>pointToObjectClearance(a.agent.pos,o)<bodyPhysicalProfile(a.human).bodyRadiusM+.12))return{ok:false,reason:"物体位置与 NPC 站位重叠"};const [rx,rz]=objectFootprint(o);if(o.p[0]-rx<this.bounds.xMin||o.p[0]+rx>this.bounds.xMax||o.p[2]-rz<this.bounds.zMin||o.p[2]+rz>this.bounds.zMax)return{ok:false,reason:'物体超出训练场安全边界'};if(avoidPoint&&o.collidable!==false&&pointToObjectClearance(avoidPoint,o)<.48)return{ok:false,reason:'物体位置与人物当前站位重叠'};return{ok:true}}
 findOpenPosition(def,avoidPoint=[0,0,1.75]){const candidates=[],large=Object.keys(FIELD_BOUNDS).some(k=>this.bounds[k]!==FIELD_BOUNDS[k]);for(let z=large?this.bounds.zMin+.5:-1.30;z<=(large?this.bounds.zMax-.5:1.05);z+=.42)for(let x=large?this.bounds.xMin+.5:-3.1;x<=(large?this.bounds.xMax-.5:3.1);x+=.46)candidates.push([x,def.h/2,z]);candidates.sort((a,b)=>Math.hypot(a[0],a[2]) - Math.hypot(b[0],b[2]));for(const p of candidates){const candidate={...def,p};if(!this.canPlace(candidate,null,avoidPoint).ok)continue;if(this.objects.every(o=>o.collidable===false||candidate.collidable===false||pointToObjectClearance(p,o)>objectRadius(candidate)+.12))return p}throw Error('当前场景没有足够空位，请先移动或删除部分物体')}
 touch(reason='edit'){this.revision=(this.revision||0)+1;this.lastChange={reason,at:Date.now()};this.physics?.syncScene()}
 reset(seed=260901){this.bounds={...FIELD_BOUNDS};this.theme=null;this.routineState=null;prepareCampScenery(this);this.seed=Number(seed)>>>0;this.sceneId='scene_training_default';this.sceneName='搬运与分类';this.presetId='sorting';const rng=seeded(this.seed);this.objects=[];for(const raw of DEFAULT_OBJECTS){const def=this.normalizeObject({...clone(OBJECT_TEMPLATES[raw.templateId]),...clone(raw)},raw.id);let p,ok=false;for(let t=0;t<1000;t++){p=[-2.7+rng()*5.4,def.h/2,-1.02+rng()*2.40];if(this.objects.every(o=>pointToObjectClearance(p,o)>objectRadius(def)+.40)&&Math.hypot(p[0],p[2]-1.75)>.78){ok=true;break}}if(!ok)throw Error('无法找到无碰撞布局');def.p=p;this.objects.push(def)}this.zones=DEFAULT_ZONES.map(z=>this.normalizeZone(clone(z),z.id));this.touch('reset');return this.exportScene()}
 get(id){id=String(id||'').toUpperCase();return this.objects.find(o=>o.id===id)||this.zones.find(z=>z.id===id)}
 collision(p,r,ignore=[]){if(p[0]-r<this.bounds.xMin||p[0]+r>this.bounds.xMax||p[2]-r<this.bounds.zMin||p[2]+r>this.bounds.zMax)return true;return this.objects.some(o=>!ignore.includes(o.id)&&circleHitsObject(p,r+.06,o))}
 inside(o,z){const x=Math.abs(o.p[0]-z.p[0]),y=Math.abs(o.p[2]-z.p[2]),[rx,rz]=objectFootprint(o),r=objectRadius(o);if(z.shape==='square')return x+rx<=z.r&&y+rz<=z.r;if(z.shape==='circle')return Math.hypot(x,y)+r<=z.r;return Math.hypot(x,y)+r<=z.r*Math.cos(Math.PI/6)}
 objectSnapshot(o){return{id:o.id,templateId:o.templateId,name:o.name,category:o.category,shape:o.shape,color:[...o.color],p:[...o.p],yaw:objectYaw(o),q:[...o.q],r:o.r,h:o.h,w:o.w,d:o.d,mass:o.mass,friction:o.friction,restitution:o.restitution,gripFriction:o.gripFriction,v:[...(o.v||[0,0,0])],angularVelocity:[...(o.angularVelocity||[0,0,0])],physicsState:this.physics?.objectState(o.id)||null,halfExtentsM:objectWorldHalfExtents(o),movable:o.movable!==false,collidable:o.collidable!==false,aliases:[...o.aliases],held:Boolean(o.held),moveCount:o.moveCount||0}}
 zoneSnapshot(z){return{id:z.id,name:z.name,shape:z.shape,color:[...z.color],p:[...z.p],r:z.r,aliases:[...z.aliases]}}
 snapshot(){return{schema:'knowledge_human/training_scene_snapshot@1.0',sceneId:this.sceneId,sceneName:this.sceneName,presetId:this.presetId,seed:this.seed,revision:this.revision,bounds:{...this.bounds},theme:this.theme,routines:routineEnvironmentSnapshot(this),activitySpace:activitySpaceSnapshot(this),physicsSettings:{...this.physicsSettings},physics:this.physics?.snapshot()||null,objects:this.objects.map(o=>this.objectSnapshot(o)),zones:this.zones.map(z=>this.zoneSnapshot(z)),editor:{templates:Object.values(OBJECT_TEMPLATES).map(t=>({templateId:t.templateId,name:t.name,category:t.category,shape:t.shape,movable:t.movable!==false,collidable:t.collidable!==false})),presets:Object.values(SCENE_PRESETS)}}}
 exportScene(){const snap=this.snapshot();return{schema:'knowledge_human/training_scene@1.0',sceneId:snap.sceneId,sceneName:snap.sceneName,presetId:snap.presetId,seed:snap.seed,revision:snap.revision,bounds:snap.bounds,theme:snap.theme,routines:snap.routines,physicsSettings:snap.physicsSettings,objects:snap.objects.map(o=>{const c={...o};delete c.held;delete c.moveCount;delete c.physicsState;return c}),zones:snap.zones,metadata:{worldTheme:this.theme,coordinateSystem:'right-handed,+Y-up,+Z-forward',units:'meter',navigation:'geometry-aware-ground-clearance',massIsSemanticOnly:false,physicsState:'rigid-body-pose-and-velocity',editedAt:new Date().toISOString()}}}
 addObject(input={},avoidPoint=null){if(this.objects.length>=160)throw Error('训练场物体数量已达到 160 个上限');const id=input.id||this.nextObjectId();let o=this.normalizeObject(input,id);if(!input.p&&!Number.isFinite(input.x)&&!Number.isFinite(input.z))o.p=this.findOpenPosition(o,avoidPoint);const check=this.canPlace(o,null,avoidPoint);if(!check.ok)throw Error(check.reason);this.objects.push(o);this.touch('object.add');return this.objectSnapshot(o)}
 updateEntity(id,patch={},avoidPoint=null){id=String(id||'').toUpperCase();let i=this.objects.findIndex(o=>o.id===id);if(i>=0){const previous=this.objects[i];if(previous.held)throw Error('当前物体正在被人物抓握，不能编辑');const merged={...this.objectSnapshot(previous),...clone(patch),id,p:Array.isArray(patch.p)?patch.p:patch.x!=null||patch.z!=null?[patch.x??previous.p[0],0,patch.z??previous.p[2]]:previous.p,aliases:patch.aliases??previous.aliases};if(patch.yaw!=null&&patch.q==null&&Math.abs(angleDiff(patch.yaw,objectYaw(previous)))>1e-8)merged.q=null;if(patch.p||['x','z','yaw','q','w','h','d','r','shape','movable'].some(k=>Object.hasOwn(patch,k))){merged.v=patch.v||[0,0,0];merged.angularVelocity=patch.angularVelocity||[0,0,0];}const next=this.normalizeObject(merged,id),check=this.canPlace(next,id,avoidPoint);if(!check.ok)throw Error(check.reason);next.moveCount=previous.moveCount;this.objects[i]=next;this.touch('object.update');return this.objectSnapshot(next)}i=this.zones.findIndex(z=>z.id===id);if(i>=0){const previous=this.zones[i],next=this.normalizeZone({...this.zoneSnapshot(previous),...clone(patch),id,p:Array.isArray(patch.p)?patch.p:patch.x!=null||patch.z!=null?[patch.x??previous.p[0],0,patch.z??previous.p[2]]:previous.p,aliases:patch.aliases??previous.aliases},id);this.zones[i]=next;this.touch('zone.update');return this.zoneSnapshot(next)}throw Error('没有找到场景实体：'+id)}
 removeEntity(id){id=String(id||'').toUpperCase();let i=this.objects.findIndex(o=>o.id===id);if(i>=0){if(this.objects[i].held)throw Error('当前物体正在被人物抓握，不能删除');const [removed]=this.objects.splice(i,1);this.touch('object.remove');return{kind:'object',entity:this.objectSnapshot(removed)}}i=this.zones.findIndex(z=>z.id===id);if(i>=0){const [removed]=this.zones.splice(i,1);this.touch('zone.remove');return{kind:'zone',entity:this.zoneSnapshot(removed)}}throw Error('没有找到场景实体：'+id)}
 duplicateEntity(id,avoidPoint=null){if(String(id).startsWith('Z')?this.zones.length>=32:this.objects.length>=160)throw Error('场景实体数量已达到上限');const source=this.get(id);if(!source)throw Error('没有找到需要复制的实体');if(String(source.id).startsWith('Z')){const z=this.normalizeZone({...this.zoneSnapshot(source),id:this.nextZoneId(),name:source.name+' 副本',p:[source.p[0]+.45,0,source.p[2]+.35]});this.zones.push(z);this.touch('zone.duplicate');return this.zoneSnapshot(z)}const o=this.normalizeObject({...this.objectSnapshot(source),id:this.nextObjectId(),name:source.name+' 副本',held:false,moveCount:0});o.p=this.findOpenPosition(o,avoidPoint);this.objects.push(o);this.touch('object.duplicate');return this.objectSnapshot(o)}
 addZone(input={}){if(this.zones.length>=32)throw Error('训练区域数量已达到 32 个上限');const z=this.normalizeZone(input,input.id||this.nextZoneId());if(this.get(z.id))throw Error('场景中已经存在同名 ID');this.zones.push(z);this.touch('zone.add');return this.zoneSnapshot(z)}
 randomize(seed=this.seed+1,includeStatic=false,avoidPoint=[0,0,1.75]){this.seed=Number(seed)>>>0;const rng=seeded(this.seed),placed=[];for(const o of this.objects){if(!includeStatic&&o.movable===false){placed.push(o);continue}let ok=false;for(let t=0;t<900;t++){const p=[this.bounds.xMin+.45+rng()*(this.bounds.xMax-this.bounds.xMin-.9),o.h/2,-1.25+rng()*2.45];const candidate={...o,p};if(!this.canPlace(candidate,o.id,avoidPoint).ok)continue;if(placed.every(other=>other.collidable===false||o.collidable===false||pointToObjectClearance(p,other)>objectRadius(o)+.18)){o.p=p;ok=true;break}}if(!ok)throw Error('无法为所有物体找到新的安全位置');placed.push(o)}this.touch('scene.randomize');return this.exportScene()}
 applyPreset(id='sorting',seed=this.seed){if(!SCENE_PRESETS[id])throw Error('未知训练场预设：'+id);this.seed=Number(seed)>>>0;this.sceneId='scene_'+id;this.sceneName=SCENE_PRESETS[id].name;this.presetId=id;this.bounds=id==='camp'?{...CAMP_WORLD.bounds}:{...FIELD_BOUNDS};this.theme=id==='camp'?'camp':null;this.routineState=null;prepareCampScenery(this);this.objects=[];this.zones=DEFAULT_ZONES.map(z=>this.normalizeZone(clone(z),z.id));const add=(templateId,id,name,p,extra={})=>{const o=this.normalizeObject({...clone(OBJECT_TEMPLATES[templateId]),...extra,id,name,p},id);this.objects.push(o)};if(id==='sorting'){return this.reset(this.seed)}if(id==='camp'){installCampPreset(this,add)}else if(id==='living'){installLivingPreset(this,add)}else if(id==='obstacle'){add('wall','W1','左侧障碍墙',[-1.55,.41,.35],{w:1.65,h:.82,d:.16,yaw:.22,aliases:['左侧障碍墙','左墙']});add('wall','W2','右侧障碍墙',[1.55,.41,-.05],{w:1.55,h:.82,d:.16,yaw:-.28,aliases:['右侧障碍墙','右墙']});add('pillar','P1','中央障碍柱',[0,.46,.30],{aliases:['中央障碍柱','中央柱']});add('box','A','红色训练箱',[-2.55,.14,1.00],{aliases:['红色','红箱','训练箱']});add('sphere','B','蓝色训练球',[2.52,.15,.95],{aliases:['蓝色','蓝球','训练球']});add('cylinder','C','黄色训练圆柱',[0,.145,-.95],{aliases:['黄色','黄柱','训练圆柱']})}else if(id==='corridor'){add('wall','W1','左通道墙',[-1.04,.45,-.10],{w:.18,h:.90,d:3.25,yaw:0,aliases:['左通道墙','左墙']});add('wall','W2','右通道墙',[1.04,.45,-.10],{w:.18,h:.90,d:3.25,yaw:0,aliases:['右通道墙','右墙']});add('wall','W3','入口挡板',[-2.50,.38,.78],{w:1.20,h:.76,d:.16,yaw:.18,aliases:['入口挡板']});add('box','A','通道训练箱',[0,.14,.62],{aliases:['通道训练箱','红箱']});add('landmark','M1','通道终点',[0,.0175,-1.70],{aliases:['通道终点','终点','导航标记']});this.zones=[this.normalizeZone({id:'Z1',name:'终点区域',shape:'circle',p:[0,0,-2.25],r:.58,color:[.12,.62,.62],aliases:['终点区域','终点','一区']},'Z1')]}else if(id==='mixed'){add('wall','W1','斜向障碍墙',[-2.05,.40,-.30],{w:1.70,h:.80,d:.16,yaw:.48,aliases:['斜向障碍墙','障碍墙']});add('pillar','P1','高立柱',[2.25,.46,.18],{aliases:['高立柱','柱子']});add('platform','T1','低平台',[1.05,.10,-1.12],{aliases:['低平台','台子']});add('landmark','M1','观察点',[-.25,.0175,-1.45],{aliases:['观察点','导航标记']});add('box','A','红色训练箱',[-2.65,.14,1.05],{aliases:['红色','红箱','训练箱']});add('sphere','B','蓝色训练球',[2.62,.15,1.05],{aliases:['蓝色','蓝球','训练球']});add('cylinder','C','黄色训练圆柱',[.62,.145,.62],{aliases:['黄色','黄柱','训练圆柱']});add('cone','D','绿色训练圆锥',[-.68,.155,.72],{aliases:['绿色','绿锥','训练圆锥']})}else if(id==='empty'){this.objects=[]}this.touch('scene.preset');return this.exportScene()}
 importScene(data,avoidPoint=null){if(!data||typeof data!=='object'||!Array.isArray(data.objects)||!Array.isArray(data.zones))throw Error('场景 JSON 缺少 objects 或 zones');if(data.objects.length>160||data.zones.length>32)throw Error('场景实体数量超过运行上限');const context=Object.create(this);context.physics=null;context.physicsSettings=worldPhysicsSettings(data.physicsSettings||{});context.bounds=validateSceneBounds(data.bounds);const objects=[],ids=new Set();context.objects=objects;for(const raw of data.objects){const o=context.normalizeObject(raw,raw.id);if(ids.has(o.id))throw Error('场景中存在重复 ID：'+o.id);const check=context.canPlace(o,null,avoidPoint);if(!check.ok)throw Error(`${o.id}：${check.reason}`);ids.add(o.id);objects.push(o)}const zones=[];for(const raw of data.zones){const z=context.normalizeZone(raw,raw.id);if(ids.has(z.id))throw Error('场景中存在重复 ID：'+z.id);ids.add(z.id);zones.push(z)}this.bounds=context.bounds;this.physicsSettings=context.physicsSettings;this.theme=data.theme==='camp'||data.metadata?.worldTheme==='camp'?'camp':null;this.objects=objects;this.zones=zones;restoreRoutineEnvironment(this,data.routines);prepareCampScenery(this);this.sceneId=String(data.sceneId||'scene_imported').slice(0,64);this.sceneName=String(data.sceneName||'导入训练场').slice(0,40);this.presetId=String(data.presetId||'custom');this.seed=Number(data.seed)||this.seed;this.touch('scene.import');return this.exportScene()}
 path(start,end,r=.26,ignore=[]){
 if(Object.keys(FIELD_BOUNDS).some(k=>this.bounds[k]!==FIELD_BOUNDS[k]))return campGridPath(this,start,end,r,ignore);
 const overlaps=this.objects.filter(o=>!ignore.includes(o.id)&&o.collidable!==false&&pointToObjectClearance(start,o)<r+.06);
 if(overlaps.length){let away=[0,0,0];for(const o of overlaps)away=add(away,norm([start[0]-o.p[0],0,start[2]-o.p[2]]));const base=Math.atan2(away[0],away[2]);
  for(const length of[.22,.38,.60,.85])for(const turn of[0,.3,-.3,.65,-.65,1,-1,1.4,-1.4]){const a=base+turn,p=[start[0]+Math.sin(a)*length,0,start[2]+Math.cos(a)*length];if(Math.abs(p[0])>4.4||Math.abs(p[2])>3.4||this.collision(p,r,ignore))continue;let safe=true;const previous=new Map(overlaps.map(o=>[o.id,pointToObjectClearance(start,o)]));for(let k=1;k<=16&&safe;k++){const q=mix(start,p,k/16);for(const o of this.objects){if(ignore.includes(o.id)||o.collidable===false)continue;const d=pointToObjectClearance(q,o);if(previous.has(o.id)){if(d+1e-6<previous.get(o.id)){safe=false;break}previous.set(o.id,d)}else if(d<r+.06){safe=false;break}}}if(safe){try{return[p,...this.path(p,end,r,ignore)]}catch(e){}}}throw Error('释放后的安全退出路径被阻挡');}
 const step=.18,X=51,Z=40,xmin=-4.5,zmin=-3.5;const ix=p=>clamp(Math.round((p[0]-xmin)/step),0,X-1),iz=p=>clamp(Math.round((p[2]-zmin)/step),0,Z-1),idx=(x,z)=>x+z*X,pos=id=>[xmin+(id%X)*step,0,zmin+Math.floor(id/X)*step],S=idx(ix(start),iz(start)),E=idx(ix(end),iz(end)),g=new Float64Array(X*Z).fill(Infinity),parent=new Int32Array(X*Z).fill(-1),done=new Uint8Array(X*Z),open=[S];g[S]=0;const clear=(a,b)=>{const n=Math.max(1,Math.ceil(dist(a,b)/.08));for(let k=1;k<=n;k++)if(this.collision(mix(a,b,k/n),r,ignore))return false;return true};if(Math.abs(end[0])>4.4||Math.abs(end[2])>3.4)throw Error('目标超出安全场地');if(this.collision(end,r,ignore))throw Error('目标站位被占用');if(clear(start,end))return[[...end]];
 while(open.length){let bi=0,bf=Infinity;for(let k=0;k<open.length;k++){const id=open[k],f=g[id]+Math.hypot((id%X)-(E%X),Math.floor(id/X)-Math.floor(E/X));if(f<bf){bf=f;bi=k}}const id=open.splice(bi,1)[0];if(id===E)break;if(done[id])continue;done[id]=1;const x=id%X,z=Math.floor(id/X);for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const xx=x+dx,zz=z+dz;if(xx<0||xx>=X||zz<0||zz>=Z)continue;const n=idx(xx,zz);if(done[n]||this.collision(pos(n),r,ignore)||!clear(pos(id),pos(n)))continue;const ng=g[id]+Math.hypot(dx,dz);if(ng<g[n]){g[n]=ng;parent[n]=id;open.push(n)}}}
 if(parent[E]<0&&S!==E)throw Error('没有足够净空的可达路线');const route=[end];let id=E;while(id!==S&&id>=0){route.push(pos(id));id=parent[id]}route.reverse();const result=[];let anchor=start;for(let i=0;i<route.length;i++){let j=i;while(j+1<route.length&&clear(anchor,route[j+1]))j++;result.push(route[j]);anchor=route[j];i=j}return result}
 }

/*__SOURCE:control/PlanForecast.js__*/

function resolve(text,world,type,last){text=text.trim();if(/^(它|这个|那个|刚才的物体|该物体)$/.test(text)){if(!last)throw Error('“它”没有可确认的指代');return world.get(last)}let pool=type==='object'?world.objects:[...world.objects,...world.zones],matches=pool.filter(e=>new RegExp(`(^|[^A-Za-z0-9])${e.id}($|[^A-Za-z0-9])`,'i').test(text));if(!matches.length){const keys=pool.flatMap(e=>e.aliases.map(a=>({e,a}))).sort((a,b)=>b.a.length-a.a.length);let occupied=[];for(const{e,a}of keys){const k=text.indexOf(a);if(k>=0&&!occupied.some(([s,t])=>k>=s&&k+a.length<=t)){matches.push(e);occupied.push([k,k+a.length])}}matches=[...new Map(matches.map(e=>[e.id,e])).values()]}if(matches.length===1)return matches[0];throw Error(matches.length?'对象描述存在冲突，请指定颜色、形状或编号':'未找到对象：'+text)}

function parse(text,world,last=null){
 if(typeof text!=='string'||!text.trim())throw Error('请先输入指令');
 if(/不要|别把|不许|如果|除非|除了/.test(text))throw Error('当前本地语法尚未覆盖否定或条件句，本次没有执行');
 const input=text.replace(/请|帮我|首先|先/g,'').replace(/并且|并(?=向|朝|打|敬|挥|招|坐|躺|起|站)/g,'，');
 const chunks=input.split(/然后|接着|最后|再(?=把|将|去|走|站|向|朝|坐|躺|打|敬|挥|招|起|平)|[，,；;。]/).filter(s=>s.trim()),steps=[];
 function read(raw){let chunk=raw.trim();if(!chunk)return;
  // Peel off a final gesture so "走到一区向我敬礼" retains both intentions.
  const gesture=chunk.match(/(?:向我|朝我|给我)?(?:打个招呼|打招呼|问好|挥挥手|挥手|招手|敬个礼|敬礼|行礼)(?:\s*(\d+(?:\.\d+)?)\s*秒)?$/);
  if(gesture){read(chunk.slice(0,gesture.index));const t=/敬|行礼/.test(gesture[0])?'salute':/招呼|问好/.test(gesture[0])?'greet':'wave';steps.push({type:t,...(gesture[1]?{duration:Number(gesture[1])}:{})});return;}
  if(/椅子|床上|沙发/.test(chunk))throw Error('场内没有座椅或床，请指定坐在地上或躺在地上');
  const stand=chunk.match(/(?:起身站起来|站起来|站起身|站起|起立|起身|站好|站立|恢复站立|站着)$/);
  if(stand){const before=chunk.slice(0,stand.index).replace(/^(?:原地|在原地)$/,'');if(before)read(before);steps.push({type:'stand'});return;}
  const floor=chunk.match(/(?:坐在地上|坐到地上|在地上坐下|坐地上|坐下来|坐下|坐着|保持坐姿|躺在地上|在地上躺下|平躺下来|躺下来|躺下|平躺|仰卧|躺着|保持躺姿)$/);
  if(floor){let before=chunk.slice(0,floor.index).replace(/^(?:原地|在原地)$/,'');if(before){if(/^在/.test(before))before='走到'+before.slice(1);read(before);}steps.push({type:/坐/.test(floor[0])?'sit':'lie'});return;}
  const movement=parseMotionCommand(chunk);if(movement){steps.push(movement);return;}
  const m=chunk.match(/(?:把|将)?\s*(.+?)\s*(搬运|搬|运|拿|抱|推|移动|放)(?:动|起|起来)?(?:到|进|入|至|在)\s*(.+)/);
  if(m){const o=resolve(m[1],world,'object',last),target=resolve(m[3].replace(/旁边|边上|里面|之内|内|里|中|去|上$/g,''),world,'any',last);if(o.id===target.id)throw Error('物体与目标相同');steps.push({type:m[2]==='推'?'push':'carry',objectId:o.id,targetId:target.id,relation:/旁|边/.test(m[3])?'near':target.id.startsWith('Z')?'inside':'near'});last=o.id;return;}
  if(/^(?:去|走|站)/.test(chunk)){const t=resolve(chunk.replace(/走到|走向|站到|站在|去|旁边|边上|里面|站着|一下/g,''),world,'any',last);steps.push({type:'walk',targetId:t.id});return;}
  throw Error('未识别这段操作：'+chunk);
 }
 chunks.forEach(read);if(!steps.length)throw Error('没有可执行的动作');
 return{schema:'knowledge_human/behavior_plan@0.6',sourceText:text,worldRevision:world.revision,steps,lastObject:last,grammarMode:'local-compositional-not-open-language-model'};
}

// MODULE basic
const BASIC_SKILLS=Object.freeze(['sit','lie','stand','greet','wave','salute']);
const sides=['left','right'];
const copyFrame=f=>frame(f.p,f.q);
const copyFeet=feet=>Object.fromEntries(sides.map(s=>[s,{p:[...feet[s].p],q:[...(feet[s].q||qy(feet[s].yaw||0))],yaw:feet[s].yaw||0}]));

/*__SOURCE:control/CharacterActivity.js__*/
/*__SOURCE:control/BasicController.js__*/

// MODULE behavior
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
function rayBoundary(o,d,y=0){const r=o.shape==='cone'?o.r*(.5-y/o.h):o.r;if(o.shape==='sphere'||o.shape==='cylinder'||o.shape==='cone')return r/Math.hypot(d[0],d[2]);if(o.shape==='box')return 1/Math.max(Math.abs(d[0])/(o.w/2),Math.abs(d[2])/(o.d/2));let best=Infinity;const vertices=Array.from({length:3},(_,i)=>[Math.cos(i*Math.PI*2/3)*o.r,Math.sin(i*Math.PI*2/3)*o.r]);for(let i=0;i<3;i++){const a=vertices[i],b=vertices[(i+1)%3],ex=b[0]-a[0],ez=b[1]-a[1],den=d[0]*ez-d[2]*ex;if(Math.abs(den)<1e-8)continue;const t=(a[0]*ez-a[1]*ex)/den,u=(a[0]*d[2]-a[1]*d[0])/den;if(t>0&&u>=-1e-6&&u<=1+1e-6)best=Math.min(best,t)}return best}
function graspFrames(o,yaw,push=false){const base=qy(yaw),out={};for(const[side,s]of[['left',-1],['right',1]]){
 const D=rotate(inv(o.q),rotate(base,push?norm([s*.34,0,-1]):[s,0,0])),t=rayBoundary(o,D),P=mul(D,t);let Q=qm(inv(o.q),push?base:qm(base,qy(-s*Math.PI/2)));
 if(o.shape==='box'){
  // Side contact at the upper edge leaves the wrist and forearm outside the
  // box while the fingers descend along its side. Mid-height palms forced
  // the crouched torso/knees into tall boxes and buried the distal forearm.
  P[1]=o.h/2;const xFace=Math.abs(D[0])/(o.w/2)>=Math.abs(D[2])/(o.d/2),normal=xFace?[Math.sign(D[0]),0,0]:[0,0,Math.sign(D[2])];
  const inward=rotate(o.q,mul(normal,-1));Q=qm(inv(o.q),qy(Math.atan2(inward[0],inward[2])));
 }
 out[side]=frame(P,Q);
}return out}
function graspResidual(human,o,grips){return Object.fromEntries(['left','right'].map(side=>{const want=compose(frame(o.p,o.q),grips[side]),actual=human.palm(side);return[side,{positionM:dist(want.p,actual.p),angleRad:qangle(want.q,actual.q)}]}))}
function inferHeldFrame(human,grips){const a=compose(human.palm('left'),inverse(grips.left)),b=compose(human.palm('right'),inverse(grips.right));return{p:mix(a.p,b.p,.5),q:qslerp(a.q,b.q,.5),positionDisagreement:dist(a.p,b.p),angleDisagreement:qangle(a.q,b.q)}}
/*__SOURCE:body/ReferenceMotion.js__*/
/*__SOURCE:body/StandardsMotion.js__*/
/*__MOTION_LAB_CORE__*/
/*__SOURCE:body/ContactHandPose.js__*/
/*__SOURCE:body/MotionLabPose.js__*/
/*__SOURCE:body/MotionLabActions.js__*/
/*__SOURCE:body/BoxHandling.js__*/
/*__SOURCE:body/NaturalLocomotion.js__*/
/*__SOURCE:body/LightBalanceFeedback.js__*/
/*__SOURCE:control/TaskAgent.js__*/

// MODULE app
const $=id=>document.getElementById(id),logLines=[];
function logMessage(t){logLines.unshift(t);if(logLines.length>16)logLines.pop();$('log').replaceChildren(...logLines.map((s,i)=>{const p=document.createElement('div');p.textContent=s;p.className=i===0?'latest':'';return p}));$('stateLine').textContent=t}
const runtimeQuery=(()=>{try{return new URLSearchParams(window.parent.location.search)}catch{return new URLSearchParams(location.search)}})(),reviewMode=runtimeQuery.get('review');
let human,world,agent,renderer,auto=!runtimeQuery.has('qa')&&!reviewMode,follow=false,isolation='all',cameraMode='body',floor,lines,labels=[],environmentPlacementId=null,environmentPointerStart=null,needsRedraw=true;
function buildLines(){const grid=[];const camp=world.theme==='camp';for(let x=-5;x<=5;x+=.5)grid.push([[x,.003,-4],[x,.003,4]]);for(let z=-4;z<=4;z+=.5)grid.push([[-5,.003,z],[5,.003,z]]);lines=camp?[]:[{g:lineMesh(grid),color:[.075,.105,.12]}];for(const z of world.zones){let segments=[];if(z.shape==='square'){const p=[[-z.r,-z.r],[z.r,-z.r],[z.r,z.r],[-z.r,z.r]];segments=p.map((a,i)=>[[z.p[0]+a[0],.009,z.p[2]+a[1]],[z.p[0]+p[(i+1)%4][0],.009,z.p[2]+p[(i+1)%4][1]]])}else{for(let k=0;k<120;k++){if(z.shape==='circle'&&Math.floor(k/5)%2)continue;if(z.shape==='hexagon'&&k%4!==0)continue;const fn=t=>{if(z.shape==='circle')return[z.p[0]+z.r*Math.cos(t*Math.PI*2),.009,z.p[2]+z.r*Math.sin(t*Math.PI*2)];const segment=t*6,a=Math.floor(segment),v=segment-a,A=[Math.cos(a*Math.PI/3)*z.r,Math.sin(a*Math.PI/3)*z.r],B=[Math.cos((a+1)*Math.PI/3)*z.r,Math.sin((a+1)*Math.PI/3)*z.r];return[z.p[0]+A[0]+(B[0]-A[0])*v,.009,z.p[2]+A[1]+(B[1]-A[1])*v]};segments.push([fn(k/120),fn((k+1)/120)])}}lines.push({g:lineMesh(segments),color:z.color})}}
function buildLabels(){for(const l of labels)l.el.remove();labels=[];for(const o of[...world.objects.filter(o=>world.theme!=='camp'||!['architecture','landscape'].includes(o.category)),...world.zones]){const el=document.createElement('div');el.className='worldLabel'+(o.id.startsWith('Z')?' zoneLabel':'');el.textContent=o.id.startsWith('Z')?o.name:o.id+' '+o.name;$('labels').append(el);labels.push({el,o})}$('objectList').replaceChildren(...world.objects.map(o=>{const row=document.createElement('div');row.className='object';const dot=document.createElement('span');dot.style.background=`rgb(${o.color.map(x=>Math.round(x*255)).join(',')})`;const name=document.createElement('span');name.textContent=o.id+' · '+o.name+(o.movable===false?' · 固定':'');row.append(dot,name);return row}))}

function environmentIdleGuard(){if(window.HumanLab?.population)window.HumanLab.population.requireWorldIdle();else if(agent)requireCharacterIdle(agent,'修改训练场景');}
function environmentActorPoint(){return agent?.pos||[0,0,1.75]}
function environmentResponse(selected=null){return{schema:'knowledge_human/environment_editor_state@1.0',scene:world.exportScene(),selected,templates:Object.values(OBJECT_TEMPLATES).map(t=>({templateId:t.templateId,name:t.name,category:t.category,shape:t.shape,color:t.color,movable:t.movable!==false,collidable:t.collidable!==false,dimensions:{w:t.w||null,h:t.h||null,d:t.d||null,r:t.r||null}})),presets:Object.values(SCENE_PRESETS),placement:{active:Boolean(environmentPlacementId),entityId:environmentPlacementId},runtime:{taskActive:Boolean(agent?.plan||agent?.skill||agent?.held||agent?.basic?.busy),bodyPosition:agent?.pos||null}}}
function environmentChanged(reason,selected=null){world.physics?.syncScene();configureWorldPresentation();buildLines();buildLabels();if(renderer){renderer.lastItems=[];renderer.lastLines=[]}needsRedraw=true;window.dispatchEvent(new CustomEvent('humanlab:environment-change',{detail:{reason,selected,sceneRevision:world.revision,sceneName:world.sceneName}}));return environmentResponse(selected)}
function groundPointFromPointer(event){
 const rect=renderer.canvas.getBoundingClientRect(),nx=(event.clientX-rect.left)/Math.max(1,rect.width)*2-1,ny=1-(event.clientY-rect.top)/Math.max(1,rect.height)*2;
 const forward=norm(sub(renderer.target,renderer.eye)),right=norm(cross(forward,[0,1,0])),up=norm(cross(right,forward)),aspect=rect.width/Math.max(1,rect.height);
 let origin=renderer.eye,dir=forward;
 if(renderer.projection==='orthographic')origin=add(origin,add(mul(right,nx*renderer.orthoHeight*.5*aspect),mul(up,ny*renderer.orthoHeight*.5)));
 else{const tan=Math.tan(.72/2);dir=norm(add(forward,add(mul(right,nx*tan*aspect),mul(up,ny*tan))));}
 if(Math.abs(dir[1])<1e-6)throw Error('当前视角无法与地面求交，请切换到场景视图');
 const t=-origin[1]/dir[1];if(t<=0)throw Error('请点击人物脚下可见的训练场地面');
 const p=add(origin,mul(dir,t));return[clamp(p[0],world.bounds.xMin,world.bounds.xMax),0,clamp(p[2],world.bounds.zMin,world.bounds.zMax)];
}
const EnvironmentAPI={
 list:()=>environmentResponse(),
 templates:()=>environmentResponse().templates,
 presets:()=>environmentResponse().presets,
 add:payload=>{environmentIdleGuard();const entity=payload?.kind==='zone'?world.addZone(payload):world.addObject(payload||{},environmentActorPoint());return environmentChanged('add',entity)},
 update:payload=>{environmentIdleGuard();const entity=world.updateEntity(payload?.id,payload?.patch||{},environmentActorPoint());return environmentChanged('update',entity)},
 remove:payload=>{environmentIdleGuard();const result=world.removeEntity(payload?.id);if(environmentPlacementId===String(payload?.id||'').toUpperCase())environmentPlacementId=null;return environmentChanged('remove',result.entity)},
 duplicate:payload=>{environmentIdleGuard();const entity=world.duplicateEntity(payload?.id,environmentActorPoint());return environmentChanged('duplicate',entity)},
 preset:payload=>{environmentIdleGuard();window.HumanLab?.population?.guardWorldReplacement();world.applyPreset(payload?.presetId||'sorting',payload?.seed??world.seed);agent.reset();return environmentChanged('preset')},
 randomize:payload=>{environmentIdleGuard();window.HumanLab?.population?.guardWorldReplacement();world.randomize(payload?.seed??world.seed+1,Boolean(payload?.includeStatic),environmentActorPoint());agent.reset();return environmentChanged('randomize')},
 export:()=>world.exportScene(),
 import:payload=>{environmentIdleGuard();window.HumanLab?.population?.guardWorldReplacement();world.importScene(payload?.scene||payload,environmentActorPoint());agent.reset();return environmentChanged('import')},
 placement:payload=>{environmentIdleGuard();const id=String(payload?.id||'').toUpperCase(),entity=world.get(id);if(!entity)throw Error('没有找到需要定位的实体');environmentPlacementId=id;renderer.canvas.style.cursor='crosshair';window.dispatchEvent(new CustomEvent('humanlab:environment-placement',{detail:{active:true,entityId:id}}));return environmentResponse(entity)},
 cancelPlacement:()=>{environmentPlacementId=null;if(renderer)renderer.canvas.style.cursor='';window.dispatchEvent(new CustomEvent('humanlab:environment-placement',{detail:{active:false,entityId:null}}));return environmentResponse()}
};
function installEnvironmentPlacement(){const c=$('view');c.addEventListener('pointerdown',event=>{if(!environmentPlacementId)return;environmentPointerStart=[event.clientX,event.clientY];event.preventDefault();event.stopImmediatePropagation()},{capture:true});c.addEventListener('pointermove',event=>{if(!environmentPlacementId)return;event.preventDefault();event.stopImmediatePropagation()},{capture:true});c.addEventListener('pointerup',event=>{if(!environmentPlacementId)return;event.preventDefault();event.stopImmediatePropagation();const id=environmentPlacementId,start=environmentPointerStart;environmentPointerStart=null;try{environmentIdleGuard();if(start&&Math.hypot(event.clientX-start[0],event.clientY-start[1])>8)throw Error('定位模式请单击地面，拖动不会改变实体位置');const p=groundPointFromPointer(event),entity=world.updateEntity(id,{p},environmentActorPoint());environmentPlacementId=null;c.style.cursor='';environmentChanged('place',entity);window.dispatchEvent(new CustomEvent('humanlab:environment-placement',{detail:{active:false,entityId:id,placed:true,p:entity.p}}))}catch(error){logMessage('场景定位失败：'+error.message);window.dispatchEvent(new CustomEvent('humanlab:environment-placement',{detail:{active:true,entityId:id,error:error.message}}))}},{capture:true});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&environmentPlacementId){EnvironmentAPI.cancelPlacement();logMessage('已取消场景点选定位')}})}

function focus(mode='body'){renderer.projection='perspective';cameraMode=mode;follow=false;isolation='all';$('isolate').value='all';renderer.yaw=mode==='field'?.22:.2;renderer.pitch=mode==='field'?.78:.15;renderer.distance=mode==='field'?(world?.theme==='camp'?39:9.7):3.05;renderer.target=mode==='field'?(world?.theme==='camp'?[-.2,.3,0]:[0,.2,-.10]):add(agent.pos,[0,.03,0]);$('follow').checked=follow;needsRedraw=true;updateVisibility()}
function setCameraFollow(value){follow=value===true;$('follow').checked=follow;needsRedraw=true;return{follow,mode:cameraMode};}
function commitCharacterRuntime(lab,nextHuman,nextAgent,nextSurface){
 if(lab!==window.HumanLab||lab.human!==human||lab.agent!==agent)throw Error('人物运行实例已变化');
 const previousSurface=lab.compact,nextCompacts=Array.isArray(renderer.compacts)?renderer.compacts.map(surface=>surface===previousSurface?nextSurface:surface):null;
 if(nextCompacts&&!nextCompacts.includes(nextSurface))nextCompacts.unshift(nextSurface);
 human=nextHuman;agent=nextAgent;
 lab.human=human;lab.agent=agent;lab.tissue=human.tissue;lab.compact=nextSurface;
 nextSurface.lab=lab;if(nextSurface.hair)nextSurface.hair.lab=lab;
 if(lab.population)lab.population.replaceActive(nextHuman,nextAgent,nextSurface);
 renderer.compact=nextSurface;renderer.tissue=human.tissue;renderer.lastItems=[];renderer.lastLines=[];
 if(nextCompacts)renderer.compacts=nextCompacts;
 renderer.orthoHeight=human.bodyMetrics.statureM*1.16;
 lab.hairStatus={state:nextSurface.hair?'ready':'pending'};
 needsRedraw=true;
}
function inspectBody(view='front'){
 if(!['front','side','back'].includes(view))throw Error('Unknown inspection view');
 focus('body');renderer.projection='perspective';renderer.distance=human.bodyMetrics.statureM*1.16/(2*Math.tan(.72/2));renderer.orthoHeight=human.bodyMetrics.statureM*1.16;
 renderer.yaw=agent.yaw+(view==='side'?Math.PI/2:view==='back'?Math.PI:0);renderer.pitch=0;
 cameraMode='inspection';needsRedraw=true;renderFrame();
}
function updateVisibility(){const actors=window.HumanLab?.population?.values();if(actors){for(const actor of actors)actor.human.tissue?.visibility();}else human?.tissue?.visibility();}
function isolate(value){isolation='all';focus('body');if(value!=='all')logMessage('旧构造已移除；请在人物设置中查看 R2 关节分区。');}
function renderFrame(){
 if(!renderer||!world)return;updateVisibility();const lab=window.HumanLab,actors=lab?.population?Array.from(lab.population.values()):human?[{human,showRig:lab?.showRig}]:[];
 if(human&&agent&&follow&&isolation==='all'){const seated=agent.basic.posture==='sitting';renderer.target=add(agent.pos,[seated?Math.sin(agent.yaw)*.23:0,seated?.27:renderer.projection==='orthographic'?human.bodyMetrics.statureM/2-agent.pos[1]:human.bodyMetrics.restHipHeightM-agent.pos[1]+.04,seated?Math.cos(agent.yaw)*.23:0]);}
 const items=actors.flatMap(actor=>[...actor.human.bones,...actor.human.cartilage,...actor.human.tissue.items]);
 if(isolation==='all'){renderer.studioMode=false;renderer.background=world.theme==='camp'?[...CAMP_WORLD.presentation.background]:null;items.unshift(floor,...(world.scenery||[]),...(world.showRoofs?world.roofItems||[]:[]),...world.objects);}
 const rigLines=actors.filter(actor=>actor.showRig||(actor.human===human&&lab?.showRig)).map(actor=>({g:lineMesh(actor.human.joints.filter(j=>j.parent).map(j=>[j.parent.world.p,j.world.p])),color:[.2,.95,.7]}));
 renderer.render(items.filter(item=>item.visible!==false),[...(isolation==='all'?lines:[]),...rigLines]);
 for(const l of labels){const s=renderer.screen(add(l.o.p,[0,l.o.id.startsWith('Z')?.04:l.o.h/2+.10,0]));l.el.style.display=isolation==='all'&&s?.visible?'block':'none';if(s)l.el.style.transform=`translate(${s.x}px,${s.y}px) translate(-50%,-100%)`;}
}
function panel(){window.HumanLab?.strength?.refresh();const d=agent.diagnostics(),st=d.stats;$('phase').textContent=d.error?'已阻断':d.paused?'已暂停':d.activity.phase==='settling'?'减速收脚':({groundSit:'坐在地上',groundLie:'躺在地上',floorAlign:'调整坐躺朝向',sitDown:'缓慢坐下',lieDown:'躺下',standUp:'起身',greet:'打招呼',salute:'敬礼',idle:'等待指令',approach:'寻路接近',settle:'调整站位',reach:'全身趋近',close:'建立接触',lift:'约束抬起',travel:'负载步行',placeSettle:'对齐放置站位',lower:'下蹲放置',release:'解除抓握',rise:'恢复站立',wave:'挥手',walk:'步行',turn:'换脚转向',pushTravel:'接触推动'})[d.phase]||d.phase;$('held').textContent=d.heldObject||'无';$('posture').textContent=({standing:'站立',sitting:'坐姿',lying:'躺姿'})[d.basic.posture];$('swingState').textContent=d.heldObject?'保持抓握':d.basic.gesture?'手势优先':d.armSwing.blend>.1?'随步态交替摆动':'自然放松';$('boneError').textContent=(d.body.maxBoneLengthErrorM*1000).toFixed(5)+' mm';$('gripError').textContent=(st.maxPalmResidualM*1000).toFixed(2)+' mm';$('footError').textContent=(st.maxFootPositionErrorM*1000).toFixed(2)+' mm';$('done').textContent=String(st.completed);$('plan').replaceChildren(...(agent.plan?.steps||[]).map((s,i)=>{const e=document.createElement('div');e.className='planStep'+(i===agent.index?' current':i<agent.index?' finished':'');e.textContent=`${i+1}. ${{carry:'搬运',push:'推动',walk:'走到',turn:'转向',wave:'挥手',sit:'坐地',lie:'躺下',stand:'起身',greet:'打招呼',salute:'敬礼'}[s.type]} ${s.objectId||''} ${s.targetId?'→ '+s.targetId:''}`;return e}));$('pause').textContent=agent.paused?'继续':'暂停';}
function submit(){try{agent.submit($('command').value);if(isolation!=='all')focus('body');panel()}catch(e){logMessage(e.message)}}
function exportReport(){const report={build:'character-system-r11',constraintRelease:'candidate-before-commit-r11',time:new Date().toISOString(),...agent.diagnostics(),runtimeNetworkRequests:performance.getEntriesByType("resource").filter(r=>/^https?:/.test(r.name)).length};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));a.download='r2-runtime-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function startupStage(stage,message){
 window.__humanStartup={status:'initializing',stage,message};
 $('loading').textContent=message;
 window.dispatchEvent(new CustomEvent('humanlab:startup-progress',{detail:window.__humanStartup}));
 await new Promise(resolve=>setTimeout(resolve,0));
}
/*__SOURCE:body/CompactBinding.js__*/
/*__SOURCE:body/CompactMuscles.js__*/
/*__SOURCE:body/CompactHairRenderer.js__*/
/*__SOURCE:body/ProceduralGrassSkirt.js__*/
/*__SOURCE:body/FaceAnatomy.js__*/
/*__SOURCE:body/EyeAnatomy.js__*/
/*__SOURCE:body/CompactWorkbench.js__*/
/*__SOURCE:control/NPCObservation.js__*/
/*__SOURCE:control/NPCPopulation.js__*/
/*__SOURCE:ui/NPCPopulationControls.js__*/
/*__SOURCE:ui/NPCTaskSelectionBridge.js__*/
async function init(){try{
 await startupStage('graphics','正在初始化 WebGL2 与皮肤着色器');
 renderer=new Renderer($('view'));
 await startupStage('skeleton','正在建立骨骼与关节');
 human=new Human();
 const compactSurfaceReady=loadCompactSurface('preview',false,compactSourceRig(human));compactSurfaceReady.catch(()=>{});
 await startupStage('tissue','正在准备 R2 解剖分区与绑定状态');
 human.tissue=new ReconstructionState(human);renderer.setTissue(human.tissue);
 await startupStage('world','正在生成智能生活空间与身体控制器');
 world=new World(260901);world.applyPreset('camp',260901);agent=new Agent(human,world,logMessage);
 await startupStage('binding','正在准备首帧与大脑身体接口');
 floor={g:box(10,.035,8),p:[0,-.020,0],q:qi(),materialKind:5,color:[.19,.22,.23],castShadow:false};configureWorldPresentation();buildLines();buildLabels();installEnvironmentPlacement();$('boneCount').textContent='参考关节链';$('jointCount').textContent=human.joints.length;$('hash').textContent=human.evidence.geometryHash;focus('field');$('send').onclick=submit;for(const btn of document.querySelectorAll('[data-command]'))btn.onclick=()=>{$('command').value=btn.dataset.command;submit()};$('command').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')submit()});$('pause').onclick=()=>{agent.paused=!agent.paused;panel()};$('bodyView').onclick=()=>focus('body');$('fieldView').onclick=()=>focus('field');$('front').onclick=()=>inspectBody('front');$('side').onclick=()=>inspectBody('side');$('top').onclick=()=>{renderer.projection='perspective';renderer.yaw=0;renderer.pitch=1.49};$('back').onclick=()=>inspectBody('back');$('isolate').onchange=e=>isolate(e.target.value);$('follow').onchange=e=>setCameraFollow(e.target.checked);$('quality').onchange=e=>{renderer.setQuality(e.target.value);renderFrame()};$('report').onclick=exportReport;$('reshuffle').onclick=()=>{try{environmentIdleGuard();window.HumanLab?.population?.guardWorldReplacement();world.reset(Number($('seed').value));agent.reset();buildLines();buildLabels();logMessage('场景已按种子 '+world.seed+' 重新生成');focus('field')}catch(error){logMessage(error.message)}};$('reset').onclick=()=>{try{agent.reset();logMessage('已恢复人物站姿');focus('body')}catch(error){logMessage(error.message)}};
window.HumanLab={version:'1.24.0-staged-startup-r15',human,world,agent,renderer,environment:EnvironmentAPI,get physicalProfile(){return bodyPhysicalProfile(human)},tissue:human.tissue,inspectBody,setCameraFollow,get camera(){return{follow,mode:cameraMode}},setAnatomyView:mode=>{human.tissue.setView(mode);needsRedraw=true;renderFrame();return human.tissue.report()},get status(){return agent.diagnostics()},activity:()=>agent.activity(),command:text=>agent.submit(text),validatePlan:p=>agent.validateSemanticPlan(p),submitPlan:p=>agent.submitPlan(p),analyzeStep:(step,actor={})=>physicalAnalyzeStep(world,actorForReasoning(agent,actor),step),simulatePlan:(plan,actor={})=>simulateSemanticPlan(world,agent,plan,actor),advance:seconds=>{auto=false;for(let i=0;i<Math.ceil(seconds*60);i++)advanceBody(1/60);panel();renderFrame();return agent.diagnostics()},render:renderFrame,focus,isolate:value=>{$('isolate').value=value;isolate(value);renderFrame()},setAuto:value=>auto=value,reset:seed=>{environmentIdleGuard();window.HumanLab?.population?.guardWorldReplacement();world.reset(seed??260901);agent.reset();buildLines();buildLabels();renderer.lastItems=[];renderer.lastLines=[];focus('body')},report:()=>agent.diagnostics()};
window.HumanLab.motion={report:()=>({...r2MotionReport(),kernel:agent.locomotion.report(),clock:{stepS:agent.clock.step,ticks:agent.clock.ticks,droppedSeconds:agent.clock.droppedSeconds}}),unsupportedActions:R2_UNSOURCED_ACTIONS};
window.HumanLab.character=installCharacterPresetAPI(window.HumanLab);
window.HumanLab.strength=installStrengthAPI(window.HumanLab);
window.HumanLab.physics=installPhysicsControls(window.HumanLab);
window.HumanLab.camp={overview:campOverview,get roofsVisible(){return world.showRoofs===true;},setRoofs(value){if(world.theme!=='camp')throw Error('当前不是军营场景');world.showRoofs=value===true;needsRedraw=true;return world.showRoofs;},get layout(){return {schema:CAMP_WORLD.schema,bounds:{...world.bounds},rooms:clone(CAMP_WORLD.rooms)};}};
window.HumanLab.bodySex=BODY_SEX;
window.HumanLab.hair=installReconstructionHair(window.HumanLab);
window.HumanLab.npc=installNPCDefinitionAPI(window.HumanLab);
window.HumanLab.routines=installRoutineWorldAPI(window.HumanLab);
installReconstructionViews(window.HumanLab);
window.HumanLab.settings=installBodySettings(window.HumanLab);
await startupStage("reconstruction","正在连接重建人体与训练场动作系统");
await installCompactWorkbench(window.HumanLab,compactSurfaceReady);
if(reviewMode==='face'){
 auto=false;window.HumanLab.hair.enabled=false;
 window.HumanLab.review={mode:'face',singleActor:true,populationSkipped:true,hairSkipped:true};
 window.HumanLab.face.clearExpression();window.HumanLab.face.closeup('front');
 logMessage('面部审阅模式：仅加载当前人物，未启动额外 NPC。');
}else{
 installNPCPopulation(window.HumanLab);
 await startupStage('population','正在从同一母体生成第二个人物');
 try{await window.HumanLab.population.installMotherPair();}catch(error){logMessage('母体复制体未生成：'+error.message);}
 await window.HumanLab.population.installReviewCast();
}
try{human.characterTaskStatus=window.HumanLab.character.startOnSpawn();}catch(error){human.characterTaskStatus={started:false,error:error.message};logMessage('角色预设任务未开始：'+error.message);}
let previous=performance.now(),lastPanel=0;needsRedraw=true;
for(const name of ['click','change','input','pointermove','wheel'])document.addEventListener(name,()=>needsRedraw=true,{passive:true});
window.addEventListener('resize',()=>needsRedraw=true);
function advanceBodyWithoutHair(dt){if(agent.characterEditInProgress)return;const before=agent.time;agent.tick(dt);human.tissue.update(agent.time,agent.time-before,agent.held?.mass||0);}
function advanceBody(dt){if(window.HumanLab?.population){window.HumanLab.population.tick(dt);return;}const hair=window.HumanLab?.hair;if(hair?.demo)hair.tickDemo(dt);else advanceBodyWithoutHair(dt);if(hair){const hairDt=agent.paused&&!hair.inStudio()?0:dt;if(window.HumanLab.compact?.visible)window.HumanLab.compact.hair?.update(hairDt);else hair.update(hairDt);if(hair.dirty&&hair.enabled)needsRedraw=true;}}
function loop(now){const dt=Math.max(0,(now-previous)/1000);previous=now;const loopStarted=performance.now();
 window.HumanLab.face?.tick(dt);
 const active=window.HumanLab.population?.hasActive()??!agent.paused;
 if(auto)advanceBody(dt)
 if(needsRedraw||(auto&&active)){renderFrame();needsRedraw=false}
 if(now-lastPanel>160){panel();lastPanel=now}window.HumanLab.population?.observation?.frame(dt,performance.now()-loopStarted);requestAnimationFrame(loop)}
window.HumanLab.hair.restoreReviewCamera();
logMessage('R2 人体与同源骨架已连接。生活空间就绪。');panel();renderFrame();
window.__humanStartup={status:'ready',stage:'ready',message:'身体已就绪'};
$('loading').hidden=true;needsRedraw=false;requestAnimationFrame(loop);
if(reviewMode!=='face')scheduleCompactHair(window.HumanLab.population?.active||window.HumanLab);
}catch(e){
 const error=String(e?.message||e);
 window.__startupError=String(e?.stack||error);
 cancelCompactSurface('人物初始化失败：'+error);
 window.__humanStartup={status:'failed',stage:window.__humanStartup?.stage||'startup',message:'身体启动失败',error};
 delete window.HumanLab;
 $('loading').hidden=false;$('loading').textContent='启动失败：'+error;
 window.dispatchEvent(new CustomEvent('humanlab:startup-failed',{detail:window.__humanStartup}));
 console.error(e);
}}
init();
