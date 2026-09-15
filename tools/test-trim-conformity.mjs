// Explicit runtime regression for the screenshot-authorized startup repair.
// This is separate from the file-only audit; it does not create a browser/GPU.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeCompactHuman} from '../reconstruction/codec.mjs';
import {createCompactSurface} from '../reconstruction/surface-kernel.mjs';
import earcut from '../reconstruction/vendor/earcut.js';
import {conformTrimFaces} from '../reconstruction/topology.mjs';

const area2=(uv,[a,b,c])=>Math.abs((uv[b][0]-uv[a][0])*(uv[c][1]-uv[a][1])-(uv[b][1]-uv[a][1])*(uv[c][0]-uv[a][0]));
const total=(uv,faces)=>faces.reduce((sum,f)=>sum+area2(uv,f),0);
const boundaryEdges=faces=>{const edges=new Map();for(const f of faces)for(let i=0;i<3;i++){const key=[f[i],f[(i+1)%3]].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)||0)+1);}return [...edges].filter(([,n])=>n===1).map(([key])=>key);};

const uv=[[0,0],[1,0],[0,1],[.25,0],[.5,0],[.75,0]],faces=conformTrimFaces(uv,[[0,1,2]]);
assert.equal(faces.length,4);assert.equal(total(uv,faces),1);
for(const e of ['0,3','3,4','4,5','1,5'])assert(boundaryEdges(faces).includes(e),'missing boundary knot '+e);
assert.deepEqual(conformTrimFaces([[0,0],[1,0],[.5,1e-16],[.25,0],[.75,0]],[[0,1,2],[0,0,1]]),[]);

// Actual source chart that stalled at body domain 288/607 with >58M probes.
const {data}=await decodeCompactHuman(readFileSync(new URL('../reconstruction/body.chf.gz',import.meta.url)));
const chart=createCompactSurface(data).makeChart('body_extension/293');
const signedArea=l=>l.reduce((sum,p,i)=>{const q=l[(i+1)%l.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;
const loops=chart.loops().sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a))),holes=[];
let offset=loops[0].length;for(let i=1;i<loops.length;i++){holes.push(offset);offset+=loops[i].length;}
const points=loops.flat(),indices=earcut(points.flat(),holes,2),before=[];for(let i=0;i<indices.length;i+=3)before.push(indices.slice(i,i+3));
const start=performance.now(),after=conformTrimFaces(points,before),milliseconds=performance.now()-start;
assert(after.length>0&&after.length<points.length*4,'trim refinement must remain proportional to this boundary');
assert(after.every(f=>new Set(f).size===3&&area2(points,f)>0),'no repeated vertices or zero-area faces');
assert(Math.abs(total(points,after)-total(points,before))<1e-14,'non-degenerate source area must be preserved');
const used=new Set(after.flat());assert.equal(used.size,points.length,'all 60 original trim knots remain in the surface');
console.log(JSON.stringify({schema:'human/trim_conformity_regression@1',sourceChart:'body_extension/293',boundaryKnots:points.length,sourceTriangles:before.length,resultTriangles:after.length,areaDifference:Math.abs(total(points,after)-total(points,before)),milliseconds,applicationFunctionsExecuted:true,browserExecuted:false,gpuExecuted:false}));
