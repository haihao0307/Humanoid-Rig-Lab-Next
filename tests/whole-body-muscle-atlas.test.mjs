import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../body/WholeBodyMuscleAtlas.js',import.meta.url),'utf8');
const context={module:{exports:{}},Object,Math,Set,Error};
vm.runInNewContext(source+'\nmodule.exports={WHOLE_BODY_MUSCLE_ATLAS,buildWholeBodyMuscleRuntime,deformWholeBodyMusclePoint,reportWholeBodyMuscleAtlas};',context);
const {WHOLE_BODY_MUSCLE_ATLAS,buildWholeBodyMuscleRuntime,deformWholeBodyMusclePoint,reportWholeBodyMuscleAtlas}=context.module.exports;
const bind=new Map(),byId=new Map();
const add=(id,p)=>{bind.set(id,{p:[...p]});byId.set(id,{world:{p:[...p]}});};
add('hips',[0,.9,0]);add('L5',[0,1.0,0]);add('T8',[0,1.2,0]);add('T1',[0,1.4,0]);add('C7',[0,1.48,0]);add('sternum',[0,1.3,.08]);
for(const side of ['left','right']){
 const sign=side==='left'?-1:1;
 add(side+'_AC',[sign*.18,1.38,0]);add(side+'_upperArm',[sign*.22,1.32,0]);
 add(side+'_forearm',[sign*.22,1.02,0]);add(side+'_hand',[sign*.22,.78,0]);
 add(side+'_femur',[sign*.09,.86,0]);add(side+'_tibia',[sign*.09,.45,0]);add(side+'_foot',[sign*.09,.08,.12]);
}
const human={sourceBind:bind,byId};
const neutral=buildWholeBodyMuscleRuntime(human);
assert.equal(WHOLE_BODY_MUSCLE_ATLAS.groups.length,19);
assert.equal(neutral.instances.length,37);
assert.equal(neutral.calibrated,false);
const posedFrames=new Map();
for(const [id,v] of byId)posedFrames.set(id,{p:[...v.world.p]});
posedFrames.set('left_forearm',{p:[-.34,1.08,0]});
posedFrames.set('left_hand',{p:[-.48,1.22,0]});
const posed=buildWholeBodyMuscleRuntime(human,posedFrames);
const biceps=posed.instances.find(x=>x.id==='biceps-brachii-left');
assert.ok(biceps && biceps.activation>.05,'left elbow flexion must activate left biceps');
const point=[-.17,1.17,0];
const deformed=deformWholeBodyMusclePoint(point,posed);
assert.ok(Math.hypot(...deformed.map((v,i)=>v-point[i]))>1e-7,'active muscle must displace its surface sample');
const report=reportWholeBodyMuscleAtlas(human,posedFrames);
assert.equal(report.geometryIntegrated,false);
assert.equal(report.rendererIntegrated,false);
console.log(JSON.stringify({groups:WHOLE_BODY_MUSCLE_ATLAS.groups.length,instances:posed.instances.length,active:posed.activeCount,bicepsActivation:biceps.activation,pointDisplacement:Math.hypot(...deformed.map((v,i)=>v-point[i])),calibrated:false}));
