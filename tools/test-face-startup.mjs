// Screenshot-authorized source-chart regression. No browser or GPU.
import assert from 'node:assert/strict';
import {usableParameterTriangle} from '../reconstruction/mesher.mjs';
// Runtime-observed balanced-quality cycle: curved 3D boundary has nonzero
// chord area, but all three points occupy the same source-chart line.
const a=[-0.051254682,0.701598762],b=[-0.05773859263486736,0.6879906362739869],c=[-0.07070641300000001,0.6607743850000001];
assert.equal(usableParameterTriangle(a,b,c),false);
assert.equal(usableParameterTriangle([0,0],[.001,0],[.0005,5e-10]),false);
assert.equal(usableParameterTriangle([0,0],[.001,0],[.0005,1e-7]),true);
assert.equal(usableParameterTriangle([0,0],[.001,0],[0,.001]),true);
assert.equal(usableParameterTriangle([0,0],[0,.001],[.001,0]),true);
assert.equal(usableParameterTriangle([0,0],[0,0],[0,.001]),false);
console.log(JSON.stringify({sourceCycleRejected:true,micrometreDetailPreserved:true,windingIndependent:true,applicationFunctionsExecuted:true,browserExecuted:false,gpuExecuted:false}));
