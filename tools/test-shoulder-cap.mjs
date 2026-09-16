// Local shoulder-cap deformation and generated weight regression. Numerical
// geometry is transient; this is not a browser or full-character acceptance.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {buildCompactBinding} from '../reconstruction/binding.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const reference=JSON.parse(read('reconstruction/rig-reference.json'));
const math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const api=vm.runInNewContext(math+'\n'+read('body/CompactMuscles.js')+'\n({r2MusclePoint,sub,mul,add,norm,len,dot,cross})');
const frames=new Map(Object.entries(reference.nodes).map(([id,n])=>[id,{p:n.positionM,q:[0,0,0,1]}]));
const names=[...frames.keys()],pos=id=>frames.get(id).p,segments=new Map();
for(const side of ['left','right']){
 const rays=kind=>Array.from({length:5},(_,digit)=>{const ids=[side+'_'+(kind==='finger'?'metacarpal_':'metatarsal_')+(digit+1),...Array.from({length:digit===0?2:3},(_,k)=>side+'_'+kind+'_'+(digit+1)+'_'+(k+1))];return {ids,points:[...ids.map(pos),reference.nodes[ids.at(-1)].tipM]};});
 segments.set(side,{shoulder:pos(side+'_upperArm'),elbow:pos(side+'_forearm'),wrist:pos(side+'_hand'),hip:pos(side+'_femur'),knee:pos(side+'_tibia'),ankle:pos(side+'_foot'),fingers:rays('finger'),toes:rays('toe'),shoulderRadius:reference.sphereFits[side+'_humerus'].radiusM,hipRadius:reference.sphereFits[side+'_femur'].radiusM});
}
const rig={frames,segments,jointNames:names,jointIds:new Map(names.map((id,i)=>[id,i])),spine:names.filter(id=>id==='hips'||id==='head'||/^[LTC]\d+$/.test(id)).map(id=>[id,pos(id)[1]]).sort((a,b)=>a[1]-b[1])};
const points=[],masks=[],checks=[];
for(const side of ['left','right']){
 const s=side==='left'?-1:1,d=segments.get(side),r=d.shoulderRadius;
 for(const fraction of [.5,1,1.5,2]){
  const p=[d.shoulder[0]+s*r*fraction,d.shoulder[1]+r*1.4,d.shoulder[2]],first=points.length;
  for(const dx of [-.00005,.00005]){points.push([p[0]+s*dx,p[1],p[2]]);masks.push(side==='left'?16:32);}
  checks.push({side,first});
 }
}
const n=points.length,vertexIds=Uint32Array.from(points,(_,i)=>i),mesh={name:'skin',vertices:n,vertexIds,positions:Float32Array.from(points.flatMap(p=>[-p[0],p[1],p[2]])),regionMasks:Uint16Array.from(masks),indices:new Uint32Array()};
const field=buildCompactBinding({bindingRoots:vertexIds,meshes:[mesh]},rig);
const armWeight=(id,side)=>{const node=field.vertexNodes[id]*8;let sum=0;for(let k=0;k<8;k++)if(names[field.ids[node+k]]===side+'_upperArm')sum+=field.weights[node+k]/65535;return sum;};
let minimumCapArmWeight=1,maximumAdjacentWeightJump=0;
for(const {side,first}of checks){
 const a=armWeight(first,side),b=armWeight(first+1,side);minimumCapArmWeight=Math.min(minimumCapArmWeight,a,b);maximumAdjacentWeightJump=Math.max(maximumAdjacentWeightJump,Math.abs(a-b));
 assert(a>.12&&b>.12,'The lateral superior cap must not remain almost entirely on the fixed torso');
 assert(Math.abs(a-b)<.004,'A 0.1 mm cap step must not cross a hard weight boundary');
}
for(let i=0;i<n;i++)assert.equal(field.weights.subarray(i*8,i*8+8).reduce((a,b)=>a+b,0),65535);
const base=['left','right'].map(side=>{const origin=pos(side+'_upperArm'),end=pos(side+'_forearm');return {origin,axis:api.norm(api.sub(end,origin)),length:api.len(api.sub(end,origin)),axillaWeight:0,armStrain:0,deltoidStrain:0};});
let samples=0,minDet=Infinity,maxDet=-Infinity;const epsilon=1e-7,axes=[[1,0,0],[0,1,0],[0,0,1]];
for(const f of base)for(const raised of [.1,.3,.6,1])for(const bend of [0,.14]){
 const muscles=base.map(v=>({...v,axillaWeight:v===f?raised:0,armStrain:v===f?bend:0,deltoidStrain:v===f?.1*raised:0}));
 for(let x=-.11;x<=.41;x+=.025)for(let y=-.21;y<=.39;y+=.025)for(let z=-.42;z<=.42;z+=.04){
  const p=[f.origin[0]+Math.sign(f.origin[0])*x*f.length,f.origin[1]+y*f.length,f.origin[2]+z*f.length];
  const columns=axes.map(a=>api.mul(api.sub(api.r2MusclePoint(api.add(p,api.mul(a,epsilon)),muscles),api.r2MusclePoint(api.add(p,api.mul(a,-epsilon)),muscles)),.5/epsilon));
  const determinant=api.dot(columns[0],api.cross(columns[1],columns[2]));
  assert(Number.isFinite(determinant)&&determinant>.2,'Combined cap and muscle map must remain locally orientation-preserving');
  minDet=Math.min(minDet,determinant);maxDet=Math.max(maxDet,determinant);samples++;
 }
 const peak=[f.origin[0]+Math.sign(f.origin[0])*.15*f.length,f.origin[1]+.11*f.length,f.origin[2]];
 assert.deepEqual(Array.from(api.r2MusclePoint(peak,base)),peak,'Rest surface must be exactly unchanged');
 const opposite=base.map(v=>({...v,axillaWeight:v===f?0:1}));
 assert.deepEqual(Array.from(api.r2MusclePoint(peak,opposite)),peak,'Other shoulder activation must not move this cap');
}
console.log(JSON.stringify({schema:'human/shoulder_cap_regression@1',weightSamples:n,minimumCapArmWeight,maximumAdjacentWeightJump,jacobianSamples:samples,minDet,maxDet,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
