import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const api=vm.runInNewContext(math+read('body/CompactBinding.js')+read('body/CompactMuscles.js')+read('clothing/GarmentSkinBinding.js')+';({GarmentSkinBinding,r2DeformPoint,qx,qm,mul,rotate})');
const columns=16,levels=[0,.07,.22,.4],point=(a,t)=>[.2*Math.sin(a),.96-.405*t,.16*Math.cos(a)],positions=[],ids=[],weights=[];
for(const t of levels)for(let c=0;c<columns;c++){
 const p=point(c/columns*Math.PI*2,t);positions.push(-p[0],p[1],p[2]);ids.push(1,0,0,0,0,0,0,0);weights.push(65535,0,0,0,0,0,0,0);
}
const mesh={name:'skin',vertices:positions.length/3,positions,origin:[0,0,0],extent:[1,1,1],binding:{ids,weights}};
const binding=new api.GarmentSkinBinding([mesh],point,{columns,levels});
assert.deepEqual(Array.from(binding.jointIndices),[1]);
const identity={q:[0,0,0,1],d:[0,0,0,0]},muscles=[];
// The muscle helper expects two disabled arm frames; these waist samples
// are outside shoulder blending and never receive muscle displacement.
for(let i=0;i<2;i++)muscles.push({origin:[0,2,0],axis:[0,1,0],length:0,armStrain:0,deltoidStrain:0,axillaWeight:0});
let samples=0,maxError=0,oldRigidError=0;
for(const angle of [-.6,0,.4,.8])for(const translation of [[0,0,0],[2,.3,-4]]){
 const q=api.qx(angle),pivot=[0,.8,0],rotated=api.rotate(q,pivot),shift=translation.map((v,k)=>v+pivot[k]-rotated[k]),d=api.mul(api.qm([...shift,0],q),.5),transforms=[{q:identity.q,d:[...translation.map(v=>v*.5),0]},{q,d}];
 binding.update(transforms,muscles,1,0);
 for(let i=0;i<binding.pins.length;i++){
  const p=binding.pins[i].p,expected=api.r2DeformPoint(p,[[1,1]],transforms),rigid=api.r2DeformPoint(p,[[0,1]],transforms),actual=rigid.map((v,k)=>v+binding.data[i*4+k]);
  maxError=Math.max(maxError,Math.hypot(...actual.map((v,k)=>v-expected[k])));oldRigidError=Math.max(oldRigidError,Math.hypot(...rigid.map((v,k)=>v-expected[k])));samples++;
 }
}
assert(maxError<3e-7,'The garment attachment follows the skin dual quaternion, including translation');assert(oldRigidError>.1,'The fixture reproduces pelvis-only waist drift');
const encoded={...mesh,positions:positions.map((v,k)=>(v-[.01,.02,.03][k%3])/[2,3,4][k%3]),origin:[.01,.02,.03],extent:[2,3,4]};
const packed=new api.GarmentSkinBinding([encoded],point,{columns,levels});assert(packed.pins.every(p=>p.distance<1e-20),'Binding decodes position origin and extent');
assert.throws(()=>new api.GarmentSkinBinding([],point,{columns,levels}),/皮肤绑定/);
const handMesh={...mesh,binding:{ids:ids.map((v,i)=>i%8===0?2:0),weights}};
const filtered=new api.GarmentSkinBinding([handMesh,mesh],point,{columns,levels,allowedJoints:new Set([1])});assert.deepEqual(Array.from(filtered.jointIndices),[1],'Waist attachments cannot bind to nearby resting hands');
console.log(JSON.stringify({attachmentSamples:samples,maximumFloatTextureErrorM:maxError,oldPelvisOnlyErrorM:oldRigidError,exactCollisionMeasured:false}));
