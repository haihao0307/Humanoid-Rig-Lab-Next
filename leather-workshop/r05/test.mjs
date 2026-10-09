import fs from 'node:fs';
import {buildSeam,auditSeam,validateSeam,insideHole,routeLength} from './site/seam.mjs';
const tests=[];
function check(name,pass,extra={}){tests.push({name,pass:!!pass,...extra});if(!pass)throw Error(name);}
const base=buildSeam(),audit=auditSeam(base);
check('single thread, two needle ends, not bobbin thread',base.topology.threadCount===1&&base.topology.needleEndsPerThread===2&&!base.topology.lockstitch);
check('saddle: both directions through each subsequent hole',audit.passages===25);
check('saddle: connected full front and back spans',audit.frontSpans===12&&audit.backSpans===12);
check('same thread joins at first hole',audit.threadJoinErrorMM===0);
check('thread passes through the entire two-layer assembly',audit.minCompleteThroughSpanMM>2.6);
check('all passage centerline samples in their designated hole',audit.pointsOutsideHole===0);
check('finite original coordinates',audit.finite);
const running=buildSeam({type:'running'}),r=auditSeam(running);
check('running: a single route with alternating faces',running.routes.length===1&&r.frontSpans===6&&r.backSpans===6&&r.passages===12);
const dbl=buildSeam({rows:2}),d=auditSeam(dbl);
check('two rows use two independent continuous threads',dbl.topology.threadCount===2&&d.passages===50&&dbl.holes.length===26);
const loose=auditSeam(buildSeam({tightness:0}));check('loose thread length exceeds tightened thread without detaching holes',loose.totalThreadMM>audit.totalThreadMM&&loose.pointsOutsideHole===0);
for(const t of ['saddle','running'])for(const phase of [0,.2,.4,.55,.75,1]){const a=auditSeam(buildSeam({type:t},{hole:6,phase}));check(`${t} sewing phase ${phase}: no nonfinite or displaced passage`,a.finite&&a.pointsOutsideHole===0&&a.threadJoinErrorMM===0);}
for(const input of [{pitch:1},{diameter:1.2},{layerThickness:.2},{type:'lockstitch'},{rows:3},{count:5.2}]){let ok=false;try{validateSeam(input);}catch(e){ok=true;}check('invalid seam setting rejected '+JSON.stringify(input),ok);}
const T=await import(new URL('../r02/site/three.module.js',import.meta.url));
const geometryURL=new URL('./site/geometry.js',import.meta.url),text=fs.readFileSync(geometryURL,'utf8').replace("from 'three'",`from '${new URL('../r02/site/three.module.js',import.meta.url).href}'`).replace("from './seam.mjs'",`from '${new URL('./site/seam.mjs',import.meta.url).href}'`);
const {makeLeatherGeometry,makeThreadGeometry,cutFaceGeometry}=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
for(const inp of [{},{diameter:.6,pitch:2.5,layerThickness:.8,holeAngle:65},{rows:2,count:25}]){
 const m=buildSeam(inp),geo=makeLeatherGeometry(m),mat=new T.MeshBasicMaterial({side:T.DoubleSide});const meshes=[...geo.surfaces,...geo.walls].map(g=>new T.Mesh(g.geometry,mat));meshes.forEach(x=>x.updateMatrixWorld());
 for(const h of m.holes){const ray=new T.Raycaster(new T.Vector3(h.x,10,h.z),new T.Vector3(0,-1,0));check('actual through-hole ray '+h.id+' '+JSON.stringify(inp),ray.intersectObjects(meshes,false).length===0);}
 const h=m.holes[0],ray=new T.Raycaster(new T.Vector3(h.x+m.params.pitch/2,10,h.z),new T.Vector3(0,-1,0));check('solid leather hit between holes '+JSON.stringify(inp),ray.intersectObjects(meshes,false).length>=4);
 for(const route of m.routes){const g=makeThreadGeometry(route.points,m.params.diameter,true);check('thread index is an actual BufferAttribute '+route.id+' '+JSON.stringify(inp),g.index?.isBufferAttribute&&g.attributes.position.array.every(Number.isFinite));const vertices=g.attributes.position.array;let outside=0;for(let i=0;i<vertices.length;i+=3){const p=[vertices[i],vertices[i+1],vertices[i+2]];if(Math.abs(p[1])<m.params.layerThickness-.15&&!m.holes.some(h=>insideHole(p,h)))outside++;}check('thread solid volume only crosses leather within actual holes '+route.id+' '+JSON.stringify(inp),outside===0,{outside});}
}
fs.mkdirSync(new URL('./qa/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('./qa/topology.json',import.meta.url),JSON.stringify({version:'R05.0',tests,pass:tests.every(x=>x.pass),scope:'geometric/topological checks, not sewing dynamics calibration'},null,2));console.log('PASS',tests.length);
