import assert from 'node:assert/strict';
import {tissueRegion,nearestSegment,createTissueFields}from '../BodyTissue.mjs';

const cases=[],test=(name,fn)=>{fn();cases.push(name);};
test('手、脚、四肢与躯干独立拥有组织权重',()=>{for(const name of ['hand_l','index_03_r','ball_r','foot_l'])assert.deepEqual(tissueRegion(name),[0,0,0,1]);assert.deepEqual(tissueRegion('upperarm_twist_01_l'),[0,1,0,0]);assert.deepEqual(tissueRegion('calf_r'),[0,0,1,0]);assert.deepEqual(tissueRegion('spine_03'),[1,0,0,0]);assert.deepEqual(tissueRegion('head'),[0,0,0,0]);});
test('第八个蒙皮权重参与采样，骨架输入未被修改',()=>{const bones=[{name:'upperarm_l',children:[{name:'lowerarm_l',isBone:true}]},{name:'lowerarm_l',children:[]},{name:'hand_l',children:[]}],pts=[[.2,1.4,0],[.28,1.16,0],[.34,.94,0]],inverses=pts.map(p=>({clone(){return this},invert(){return {elements:[0,0,0,0,0,0,0,0,0,0,0,0,...p,1]}}})),before=JSON.stringify(bones),ids=new Uint16Array(8);ids[7]=2;const weights=new Float32Array(8);weights[0]=.25;weights[7]=.75;const t=createTissueFields({position:new Float32Array([.34,.9,.03]),skinIndex:ids,skinWeight:weights,bones,inverses});assert.deepEqual(t.context(0).region,[0,.25,0,.75]);assert.equal(JSON.stringify(bones),before);assert.equal(t.bytes,28);});
test('骨段采样保留实际斜率，末端不外推无限长骨',()=>{assert.deepEqual(nearestSegment([0,3,0],[0,0,0],[0,1,0]),[0,1,0]);assert.deepEqual(nearestSegment([.2,.5,0],[0,0,0],[.2,1,0]).map(v=>Math.round(v*1e4)/1e4),[.1038,.5192,0]);});
console.log(JSON.stringify({passed:cases.length,cases,scope:'motion-region-proxy-only; composition covered by test-body-composition'}));
