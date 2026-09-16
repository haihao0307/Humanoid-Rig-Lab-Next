// Numerical regression of attachment, Jacobians and volume; no display mesh.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createAxillaShape} from '../reconstruction/axilla-shape.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const reference=JSON.parse(read('reconstruction/rig-reference.json')),shape=createAxillaShape(reference);
const add=(a,b)=>a.map((v,k)=>v+b[k]),sub=(a,b)=>a.map((v,k)=>v-b[k]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),length=a=>Math.hypot(...a),norm=a=>mul(a,1/length(a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const e=1e-7,axes=[[1,0,0],[0,1,0],[0,0,1]],jacobian=(fn,p)=>axes.map(a=>mul(sub(fn(add(p,mul(a,e))),fn(sub(p,mul(a,e)))),.5/e)),det=j=>dot(j[0],cross(j[1],j[2]));
let samples=0,minShape=1,minMuscle=1,maxNormalError=0,maxVolumeError=0;
const n=norm([.3,.4,.5]),tangent=norm(cross(n,[1,0,0]));
for(const side of ['left','right'])for(const x of [-.06,-.04,0,.04,.06])for(const y of [-.29,-.25,-.20,-.15,-.10,-.05,0,.02])for(const z of [-.10,-.07,0,.07,.10]){
 const p=add(shape.centres[side],[x,y,z]),mask=side==='left'?16:32,result=shape.evaluateSource(p,mask,n),J=jacobian(v=>shape.evaluateSource(v,mask).point,p),d=det(J);
 assert(d>=shape.report.determinantLowerBound-1e-7);assert(Math.abs(d-result.jacobian)<3e-6);minShape=Math.min(minShape,d);
 const transformed=norm(J[0].map((v,k)=>v*tangent[0]+J[1][k]*tangent[1]+J[2][k]*tangent[2])),error=Math.abs(dot(result.normal,transformed));assert(error<3e-6);maxNormalError=Math.max(maxNormalError,error);samples++;
 for(const excluded of [1,8,64,128,256,512,1024,2048])assert.deepEqual(shape.evaluateSource(p,excluded).point,p);
}
assert.throws(()=>createAxillaShape(reference,{liftM:.3}),/overcompress/);
const math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const api=vm.runInNewContext(math+'\n'+read('body/CompactBinding.js')+'\n'+read('body/CompactMuscles.js')+';({r2MusclePoint,r2MuscleFrames,r2ShoulderLbsWeight,r2DeformTissuePoint,r2DeformPoint,r2AxillaPoint,r2PackAxillaAttribute,qm,qx,qy,qz,rotate})',{Float32Array,Int16Array,Uint32Array});
let correctiveSamples=0,packingSamples=0,maximumCorrectiveParityM=0;
// Test the one-uvec4 wire format independently of the worker and GLSL.
// Include nonzero buffer offsets, signs, small/subnormal deltas and signed
// octahedral endpoints; numeric conversion to uint would lose these bits.
const storage=new Float32Array(24),deltas=storage.subarray(3,21);
deltas.set([0,-0,.09,-.012,.004,-.001,1e-38,-1e-38,1e-10,.2,-.3,.4,0,0,0,-.00002,.0021,.009]);
const normals=new Int16Array([-32768,32767,-1,1,0,0,18000,-23000,32767,-32767,-12345,12345]);
const mesh={vertices:6,axillaDelta:deltas,axillaNormals:normals},packed=api.r2PackAxillaAttribute(mesh),sourceBits=new Uint32Array(deltas.buffer,deltas.byteOffset,deltas.length);
const unpackedDelta=new Float32Array(3),unpackedBits=new Uint32Array(unpackedDelta.buffer);
for(let i=0;i<mesh.vertices;i++){
 for(let k=0;k<3;k++){assert.equal(packed[i*4+k],sourceBits[i*3+k],'Corrective Float32 bits survive packing');unpackedBits[k]=packed[i*4+k];packingSamples++;}
 assert.equal((packed[i*4+3]<<16)>>16,normals[i*2],'Low oct16 component is sign extended');
 assert.equal(packed[i*4+3]>>16,normals[i*2+1],'High oct16 component is sign extended');
 for(const side of [0,1])for(const weight of [0,.1,.5,1]){
  const personal=[side===0?-.16:.16,1.22,.08],cpuDelta=[-unpackedDelta[0],unpackedDelta[1],unpackedDelta[2]],muscles=[{axillaWeight:0},{axillaWeight:0}];muscles[side].axillaWeight=weight;
  const expected=personal.map((v,k)=>v+cpuDelta[k]*weight),actual=Array.from(api.r2AxillaPoint(personal,cpuDelta,muscles));
  const error=length(sub(actual,expected));maximumCorrectiveParityM=Math.max(maximumCorrectiveParityM,error);assert.equal(error,0,'CPU and shader consume opposite X conventions exactly once');correctiveSamples++;
  assert.deepEqual(personal,[side===0?-.16:.16,1.22,.08],'Corrective leaves neutral source point immutable');
 }
}
assert.throws(()=>api.r2PackAxillaAttribute({...mesh,axillaDelta:new Float32Array(2)}),/Invalid axilla/);
assert.throws(()=>api.r2PackAxillaAttribute({...mesh,axillaNormals:new Int16Array(2)}),/Invalid axilla/);
for(const side of ['left','right'])for(const offset of [[0,-.2,0],[.03,-.16,.02],[-.04,-.25,-.03]]){
 const neutral=add(shape.centres[side],offset),lifted=shape.evaluateSource(neutral,side==='left'?16:32).point,delta=sub(lifted,neutral);
 const reflect=p=>[-p[0],p[1],p[2]],personal=reflect(neutral),personalDelta=reflect(delta);
 for(const weight of [0,.25,.75,1]){
  const muscles=[{axillaWeight:weight},{axillaWeight:weight}],actual=Array.from(api.r2AxillaPoint(personal,personalDelta,muscles));
  assert(length(sub(actual,reflect(add(neutral,mul(delta,weight)))))<1e-12,'Neutral and raised endpoints preserve authored shape coordinates');correctiveSamples++;
 }
}
const still=[{axillaWeight:0},{axillaWeight:0}],zeroPoint=[-.16,1.2,.08];
assert.equal(api.r2AxillaPoint(zeroPoint,[0,.09,0],still),zeroPoint);
assert.equal(api.r2AxillaPoint(zeroPoint,null,still),zeroPoint);
assert.equal(api.r2AxillaPoint(zeroPoint,[0,0,0],[{axillaWeight:1}]),zeroPoint);
const sourceBind=new Map(Object.entries(reference.nodes).map(([id,node])=>[id,{p:node.positionM,q:[0,0,0,1]}])),byId=new Map([...sourceBind].map(([id,f])=>[id,{world:{p:f.p.slice(),q:f.q.slice()}}]));
const human={sourceBind,byId};
for(const f of api.r2MuscleFrames(human))assert(f.armStrain===0&&f.deltoidStrain===0,'Source pose has no artificial contraction');
const a=sourceBind.get('left_upperArm').p,b=sourceBind.get('left_forearm').p,u=norm(sub(b,a)),forearmLength=length(sub(sourceBind.get('left_hand').p,b));
byId.get('left_hand').world.p=add(b,mul(norm(cross(u,[0,0,1])),forearmLength));
const flexed=api.r2MuscleFrames(human);assert(flexed[0].armStrain>0&&flexed[1].armStrain===0,'One elbow drives only its own muscle');
const bodyQ=[0,Math.sin(.7),0,Math.cos(.7)],rotateY=v=>[Math.cos(1.4)*v[0]+Math.sin(1.4)*v[2],v[1],-Math.sin(1.4)*v[0]+Math.cos(1.4)*v[2]];
for(const joint of byId.values()){joint.world.p=add(rotateY(joint.world.p),[3,.8,-2]);joint.world.q=bodyQ;}
const turned=api.r2MuscleFrames(human);for(let i=0;i<2;i++){assert(Math.abs(turned[i].armStrain-flexed[i].armStrain)<1e-12);assert(Math.abs(turned[i].deltoidStrain-flexed[i].deltoidStrain)<1e-12);}
// Axilla activation follows the arm relative to the chest. A turn, lean or
// scene translation must not activate a different amount or the other arm.
const liftedFrames=new Map([...sourceBind].map(([id,f])=>[id,{p:f.p.slice(),q:f.q.slice()}]));
const upperLength=length(sub(b,a)),raisedAxis=norm([-.95,-.2,.1]),raisedElbow=add(a,mul(raisedAxis,upperLength));
liftedFrames.get('left_forearm').p=raisedElbow;liftedFrames.get('left_hand').p=add(raisedElbow,mul(raisedAxis,forearmLength));
const liftedMuscles=api.r2MuscleFrames(human,liftedFrames);assert(liftedMuscles[0].axillaWeight>.5);assert.equal(liftedMuscles[1].axillaWeight,0);
for(const rotation of [api.qx(.9),api.qz(-1.2),api.qm(api.qy(1.1),api.qm(api.qx(.8),api.qz(-.4)))]){
 const moved=new Map([...liftedFrames].map(([id,f])=>[id,{p:add(Array.from(api.rotate(rotation,f.p)),[4,-2,7]),q:api.qm(rotation,f.q)}]));
 const muscles=api.r2MuscleFrames(human,moved);
 for(let i=0;i<2;i++)for(const key of ['axillaWeight','armStrain','deltoidStrain'])assert(Math.abs(muscles[i][key]-liftedMuscles[i][key])<1e-12,'Activation remains relative to the chest: '+key);
}
// Preserve existing callers that omit the optional corrective; independently
// check that correction happens before muscle deformation and shoulder blend.
const transforms=[api.qx(.4),api.qm(api.qy(.3),api.qz(-.5))].map((q,i)=>({q,d:mul(Array.from(api.qm([.12*i,-.04*i,.03*i,0],q)),.5)})),influences=[[0,.65],[1,.35]];
const deformed=point=>{
 const weight=api.r2ShoulderLbsWeight(point),p=Array.from(api.r2MusclePoint(point,liftedMuscles)),dqs=Array.from(api.r2DeformPoint(p,influences,transforms));
 let linear=[0,0,0];for(const [id,w]of influences){const {q,d}=transforms[id],translation=mul(add(sub(mul(d.slice(0,3),q[3]),mul(q.slice(0,3),d[3])),cross(q.slice(0,3),d.slice(0,3))),2);linear=add(linear,mul(add(Array.from(api.rotate(q,p)),translation),w));}
 return add(mul(dqs,1-weight),mul(linear,weight));
};
for(const point of [[-.16,1.2,.08],[.16,1.2,.08],[0,1,0],[-.20,1.26,.09]]){
 const expected=deformed(point),omitted=Array.from(api.r2DeformTissuePoint(point,influences,transforms,liftedMuscles));
 assert(length(sub(expected,omitted))<1e-12,'Default tissue deformation remains unchanged');
 assert.deepEqual(Array.from(api.r2DeformTissuePoint(point,influences,transforms,liftedMuscles,1,null)),omitted);
 assert.deepEqual(Array.from(api.r2DeformTissuePoint(point,influences,transforms,liftedMuscles,1,[0,0,0])),omitted);
 const delta=[.002,.04,-.001],corrected=Array.from(api.r2AxillaPoint(point,delta,liftedMuscles)),actual=Array.from(api.r2DeformTissuePoint(point,influences,transforms,liftedMuscles,1,delta));
 assert(length(sub(actual,deformed(corrected)))<1e-12,'Lift precedes shoulder weight, muscle and rigid skinning');correctiveSamples++;
}
for(const scale of [.94,1,1.06])for(const side of ['left','right']){
 const origin=mul(reference.nodes[side+'_upperArm'].positionM,scale),end=mul(reference.nodes[side+'_forearm'].positionM,scale),axis=norm(sub(end,origin)),L=length(sub(end,origin)),u=norm(cross(axis,[0,0,1]));
 for(const strains of [[0,0],[.14,0],[0,.10],[.14,.10]]){
  const frames=[{origin,axis,length:L,armStrain:strains[0],deltoidStrain:strains[1]}],fn=p=>Array.from(api.r2MusclePoint(p,frames));
  for(let i=0;i<=40;i++)for(const radius of [0,.025,.06,.09,.105]){
   const p=add(add(origin,mul(axis,L*(-.15+i*.028))),mul(u,radius*scale)),J=jacobian(fn,p),d=det(J);assert(d>.5&&Number.isFinite(d),'Muscle map must not invert');minMuscle=Math.min(minMuscle,d);samples++;
   if(strains[0]===0&&strains[1]===0)assert(length(sub(fn(p),p))===0,'Bind pose must remain unchanged');
   if(radius*scale<L*.26){maxVolumeError=Math.max(maxVolumeError,Math.abs(d-1));assert(Math.abs(d-1)<2e-6,'Muscle core preserves volume');}
  }
  assert(length(sub(fn(origin),origin))<.005,'Shoulder attachment movement must remain bounded');
  assert(length(sub(fn(end),end))<1e-12,'Elbow attachment stays fixed');
 }
}
console.log(JSON.stringify({samples,correctiveSamples,packingSamples,maximumCorrectiveParityM,minimumShapeJacobian:minShape,minimumMuscleJacobian:minMuscle,maximumNormalError:maxNormalError,maximumCoreVolumeError:maxVolumeError,applicationExecuted:false,geometryGenerated:false,physicalMuscleSimulation:false}));
