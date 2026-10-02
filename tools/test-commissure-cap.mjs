// Geometry regression for the terminal oral fold. No generated mesh is saved.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=a=>Math.hypot(...a),norm=a=>mul(a,1/(length(a)||1));
const ctx=vm.createContext({add,sub,mul,cross,norm,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),COMPACT_INFLUENCES:8});
const face=read('body/FaceAnatomy.js').replace('  const mouthRings=10,mouthSegments=lipAngles.length;',
  '  globalThis.patch={annulusPoint,innerPoint,lipAngles,lipRim,facePoint};const mouthRings=10,mouthSegments=lipAngles.length;');
vm.runInContext(['body/EyeAnatomy.js','body/PerioralSurface.js','body/BrowAnatomy.js','body/BeardAnatomy.js'].map(read).join('\n')+'\n'+face+
  '\nglobalThis.api={create:compactCreateFaceAnatomy,cap:compactCommissureCap,outline:compactLipOutline,s:COMPACT_PERIORAL_STRUCTURE};',ctx);
const {api}=ctx,s=api.s,cap=s.commissureCap;
const point=(angle,r=0)=>{const c=api.cap(angle,r),x=s.centreX+s.halfWidth*Math.cos(angle)+c.x,q=api.outline(x);
  return [x,q.seam+s.neutralHalfGapM*Math.tanh(6*Math.sin(angle))+c.y,0];};
let checks=0;const check=(value,message)=>{assert(value,message);checks++;};
const radiusAt=(f,t)=>{const h=.0001,a=f(t-h),b=f(t),c=f(t+h),d=mul(sub(c,a),1/(2*h)),dd=mul(add(sub(a,mul(b,2)),c),1/(h*h));return length(d)**3/length(cross(d,dd));};
const endRadiusM=radiusAt(a=>point(a),0),oldRadiusM=(s.neutralHalfGapM*6)**2/s.halfWidth;
check(endRadiusM>oldRadiusM*6&&endRadiusM<.0005,'terminal fold must have finite tissue curvature without an oversized rounded mouth');
for(let i=0;i<=2000;i++){
  const a=i*Math.PI/1000,p=point(a),q=api.outline(p[0]);
  check(Math.abs(p[0]-s.centreX)<=s.halfWidth+1e-12,'neutral mouth width changed');
  check(Math.abs(p[1]-q.seam)<=s.neutralHalfGapM+.000001,'commissural curvature widened the neutral slit');
  for(const r of [0,.08,.29,.5,1,1.5,2.4]){
    const c=api.cap(a,r),opposite=api.cap(-a,r);
    check(Object.values(c).every(Number.isFinite),'nonfinite terminal cap');
    check(Math.abs(c.x-opposite.x)<1e-12&&Math.abs(c.y+opposite.y)<1e-12,'upper/lower cap has mismatched terminal sections');
  }
}
for(const a of [0,.05,.15,.25,.4]){
  const end=api.cap(a,s.attachmentRadius),inside=api.cap(a,s.attachmentRadius-.0001);
  check(length(Object.values(end))===0&&length(Object.values(inside))<1e-12,'cap must return C2 to the unchanged attachment');
}
const plane={name:'skin',canonicalPositions:Float32Array.from([-.09,1.40,.19,.09,1.40,.19,.09,1.62,.19,-.09,1.62,.19]),indices:Uint16Array.from([0,1,2,0,2,3])};
const generated=api.create([plane],{jointIds:new Map([['head',7]])},1),patch=ctx.patch;
const lips=generated.meshes.filter(m=>m.name==='faceLip'),outer=lips.find(m=>m.lipSurface==='vermilion'),inner=lips.find(m=>m.lipSurface==='mucosa');
const mouth=generated.meshes.find(m=>m.name==='mouthInterior');
const decode=(m,i)=>{let x=m.normals[i*2]/32767,y=m.normals[i*2+1]/32767,z=1-Math.abs(x)-Math.abs(y);if(z<0){const previous=x;x=(1-Math.abs(y))*Math.sign(previous);y=(1-Math.abs(previous))*Math.sign(y);}return norm([x,y,z]);};
let minimumArea=Infinity,inverted=0,collapsed=0;
for(const m of [...lips,mouth])for(let i=0;i<m.indices.length;i+=3){
  const ids=Array.from(m.indices.subarray(i,i+3)),p=ids.map(id=>Array.from(m.canonicalPositions.subarray(id*3,id*3+3)));
  const area=cross(sub(p[1],p[0]),sub(p[2],p[0])),average=ids.reduce((n,id)=>add(n,decode(m,id)),[0,0,0]),size=length(area);
  minimumArea=Math.min(minimumArea,size);if(size<1e-13)collapsed++;
  else if(area.reduce((sum,v,k)=>sum+v*average[k],0)<=0)inverted++;
}
check(collapsed===0,'commissural cap collapsed triangles: '+collapsed);
check(inverted===0,'commissural cap reversed triangles: '+inverted);
for(let i=0;i<patch.lipAngles.length;i++){
  const angle=patch.lipAngles[i],free=patch.annulusPoint(angle,0),returned=patch.innerPoint(angle,0);
  check(length(sub(free,returned))<1e-12,'terminal inner/outer ring separated');
  const skin=patch.facePoint(...patch.lipRim[i]),attached=patch.annulusPoint(angle,1);
  check(length(sub(skin,attached))<1e-10,'cap separated from the actual clipped face boundary');
  for(let k=0;k<3;k++)check(outer.canonicalPositions[(i*65)*3+k]===inner.canonicalPositions[(i*11)*3+k],'stored mucosa seam is not identical');
}
console.log(JSON.stringify({checks,endRadiusMm:endRadiusM*1000,oldRadiusMm:oldRadiusM*1000,
  capLengthMm:cap.lengthM*1000,minimumDoubleTriangleAreaM2:minimumArea,inverted,collapsed,visualAcceptance:false},null,2));
