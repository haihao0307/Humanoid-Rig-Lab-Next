import assert from 'node:assert/strict';
import {BODY_DEFAULT,BODY_PRESETS,normalizeBody,bodyPoint,bodyContext,bodyMetrics,bodyCoefficients} from '../BodyParameters.mjs';
import {CharacterController,MOVEMENT} from '../CharacterController.mjs';
const cases=[],test=(name,fn)=>{fn();cases.push(name);};
test('配方紧凑、有效且非法输入拒绝',()=>{assert(JSON.stringify(BODY_DEFAULT).length<160);for(const p of [{height:1},{age:15},{fatness:NaN},{muscle:2},{vertices:[]},{schema:'bad'}])assert.throws(()=>normalizeBody(p));for(const preset of Object.values(BODY_PRESETS))normalizeBody(preset.recipe);});
test('禁止未校准的固定坐标体型查询',()=>{assert.throws(()=>bodyContext([0,1,0]),/校准/);assert.throws(()=>bodyPoint([0,1,0],BODY_DEFAULT),/校准/);});
test('同龄相对水平与有效组织量不同，年轻成人不再被扣肌肉',()=>{assert.equal(bodyCoefficients(normalizeBody({age:18}))[1],bodyCoefficients(BODY_DEFAULT)[1]);assert(bodyCoefficients(normalizeBody({age:75,muscle:.5}))[1]<bodyCoefficients(normalizeBody({age:32,muscle:.5}))[1]);});
test('组成不缩骨，身高独立改变控制器与跳跃尺度',()=>{const c=new CharacterController();for(const height of [1.60,2.05]){const p=normalizeBody({height,fatness:1}),m=bodyMetrics(p);c.setBodyMetrics(m);assert.equal(m.skeletalScaleFromComposition,1);assert.equal(c.movement.height,height);assert(c.movement.radius>.2);assert.equal(c.movement.jumpHeight,MOVEMENT.jumpHeight*m.scale);c.reset();assert.equal(c.movement.height,height);}assert.throws(()=>c.setBodyMetrics({height:2.2,radius:.2,scale:1}));});
console.log(JSON.stringify({passed:cases.length,cases}));
