import assert from 'node:assert/strict';
import {segmentTriangle,triangleCrossing,windingNumber,EPS_M} from '../contact-probe.mjs';
const checks=[];function test(name,f){f();checks.push({name,passed:true});}
const t=[[-1,-1,0],[1,-1,0],[0,1,0]];
test('interior crossing finds exact plane hit',()=>{const r=segmentTriangle([0,0,-1],[0,0,1],t);assert(r);assert.deepEqual(r.point,[0,0,0]);});
test('separated segment does not intersect',()=>assert.equal(segmentTriangle([0,0,1],[0,0,2],t),null));
test('outside triangle projection rejected',()=>assert.equal(segmentTriangle([3,0,-1],[3,0,1],t),null));
test('coplanar unhandled case is not certified',()=>assert.equal(segmentTriangle([0,0,0],[.1,0,0],t),null));
test('end point touching is not strict crossing',()=>assert.equal(segmentTriangle([0,0,0],[0,0,1],t),null));
test('triangle crossing witness exists',()=>assert(triangleCrossing(t,[[-.4,0,-1],[.4,0,1],[.4,.5,1]])));
test('parallel triangles are not crossing',()=>assert.equal(triangleCrossing(t,t.map(p=>[p[0],p[1],p[2]+1])),null));
const p=Float64Array.from([0,0,0,1,0,0,0,1,0,0,0,1]),f=Int32Array.from([0,2,1,0,1,3,0,3,2,1,2,3]);
test('closed tetra inside winding is one',()=>assert(Math.abs(Math.abs(windingNumber([.1,.1,.1],p,f))-1)<1e-12));
test('closed tetra outside winding is zero',()=>assert(Math.abs(windingNumber([2,2,2],p,f))<1e-12));
test('reversed orientation has reversed winding',()=>{const r=Int32Array.from([0,1,2,0,3,1,0,2,3,1,3,2]);assert(Math.abs(windingNumber([.1,.1,.1],p,f)+windingNumber([.1,.1,.1],p,r))<1e-12);});
test('numeric report margin is fixed not fitted',()=>assert.equal(EPS_M,.00005));
console.log(JSON.stringify({passed:true,count:checks.length,checks,syntheticFixtures:true},null,2));
