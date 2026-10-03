import assert from 'node:assert/strict';
import {compactNumbers,compactBake,stringifyData} from '../src/function-data.js';
import {bakeAnimal,validateBake} from '../src/baked.js';
import {stepRoots} from '../src/root-choreography.js';
const source={animalId:'fixture',name:'TEST_FIXTURE_ONLY'};
const mesh={positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,2],uv:[0,0,1,0,0,1],material:{color:[.3,.2,.1]}};
const bake=bakeAnimal([mesh],source);assert.ok(bake.meshes[0].positions instanceof Float32Array);assert.ok(bake.meshes[0].indices instanceof Uint32Array);assert.deepEqual(JSON.parse(stringifyData(bake)).meshes[0],mesh);validateBake(structuredClone(bake));
const exact=[.1,Math.PI,Number.MIN_VALUE,1/3];assert.ok(compactNumbers(exact) instanceof Float64Array);assert.deepEqual(Array.from(compactNumbers(exact)),exact);assert.deepEqual(JSON.parse(stringifyData({values:compactNumbers(exact)})).values,exact);
for(const values of [[NaN,0,0],[Infinity,0,0]])assert.throws(()=>bakeAnimal([{...mesh,positions:values}],source));assert.throws(()=>bakeAnimal([{...mesh,indices:[0,1,3]}],source));
// No validation bypass: reject values before integer casts can hide an invalid import.
assert.throws(()=>validateBake({...bake,meshes:[{...bake.meshes[0],indices:[0,.2,2]}]}));
const texture=compactBake({...bake,meshes:[{...mesh,texture:[0,128,255],textureMime:'image/png'}]});assert.ok(texture.meshes[0].texture instanceof Uint8Array);assert.deepEqual(JSON.parse(stringifyData(texture)).meshes[0].texture,[0,128,255]);
function actor(id,x,z,mode='still',target=''){const position={x,y:0,z,clone(){return{...this};}},root={position:{copy(p){this.x=p.x;this.z=p.z;}},scale:{setScalar(){}},rotation:{y:0}};return{id,position,root,mode,target,speed:1,scale:1,yaw:0};}
const a=actor('a',-6,0,'follow','b'),b=actor('b',0,0,'follow','a');stepRoots([a,b],1,1,new Map());assert.equal(a.position.x,-5);assert.equal(b.position.x,-1,'both actors use the previous simultaneous positions');
const orbit=actor('orbit',0,0,'orbit','b');stepRoots([orbit,b],0,0,new Map());assert.equal(orbit.position.x,b._priorX+3);
assert.throws(()=>bakeAnimal([{...mesh,indices:[0,.2,2]}],source));assert.throws(()=>bakeAnimal([{...mesh,texture:[256],textureMime:'image/png'}],source));
const sparse=Array(9);sparse[0]=0;assert.throws(()=>bakeAnimal([{...mesh,positions:sparse}],source));assert.throws(()=>bakeAnimal([{...mesh,indices:[0,,2]}],source));
console.log('PASS exact compact storage, portable legacy arrays, invalid data, simultaneous mathematical roots');
