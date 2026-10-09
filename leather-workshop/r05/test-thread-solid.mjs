import fs from 'node:fs';
import * as T from '../r02/site/three.module.js';
import {buildSeam,continuousRoutes} from './site/seam.mjs';
import {buildContactField,mapSurfacePoint} from './site/contact-surface.mjs';
let s=fs.readFileSync(new URL('./site/geometry.js',import.meta.url),'utf8').replace("from 'three'",`from '${new URL('../r02/site/three.module.js',import.meta.url).href}'`).replace("from './seam.mjs'",`from '${new URL('./site/seam.mjs',import.meta.url).href}'`).replace("from './contact-surface.mjs'",`from '${new URL('./site/contact-surface.mjs',import.meta.url).href}'`);
const {makeThreadGeometry}=await import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));
const tests=[];function check(name,pass,values={}){tests.push({name,pass,...values});console.log(pass?'PASS':'FAIL',name,JSON.stringify(values));}
function orientation(g){
 const {ringCount:n,ringStride:stride,barrelIndexCount}=g.userData,p=g.attributes.position,idx=g.index.array;
 const centers=[];for(let i=0;i<n;i++){const c=new T.Vector3();for(let j=0;j<stride-1;j++)c.add(new T.Vector3().fromBufferAttribute(p,i*stride+j));centers.push(c.multiplyScalar(1/(stride-1)));}
 let bad=0,minDot=1;const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),rad=new T.Vector3(),face=new T.Vector3();
 for(let k=0;k<barrelIndexCount;k+=3){const x=idx[k],y=idx[k+1],z=idx[k+2];a.fromBufferAttribute(p,x);b.fromBufferAttribute(p,y);c.fromBufferAttribute(p,z);rad.copy(a).add(b).add(c).sub(centers[Math.floor(x/stride)]).sub(centers[Math.floor(y/stride)]).sub(centers[Math.floor(z/stride)]).normalize();face.crossVectors(b.sub(a),c.sub(a)).normalize();const d=face.dot(rad);minDot=Math.min(minDot,d);if(d<=0)bad++;}
 return {bad,minRadialFaceDot:minDot};
}
for(const input of [{},{tightness:0},{tensionN:2.4},{diameter:.6,pitch:2.5,layerThickness:.8,holeAngle:65},{diameter:.24,pitch:5.5,holeAngle:25,rows:2}]){
 const m=buildSeam(input);m.contact=buildContactField(m);
 const routes=continuousRoutes(m);check('single physical thread per row '+JSON.stringify(input),routes.length===m.params.rows&&routes.every(r=>r.hasArtificialFirstHoleCaps===false));
 for(const route of routes){const g=makeThreadGeometry(route.points.map(p=>mapSurfacePoint(m,p)),m.params.diameter);const o=orientation(g);check('entire curved barrel faces outward '+route.id+' '+JSON.stringify(input),o.bad===0,o);}
}
const g=makeThreadGeometry([[0,0,0],[5,0,0]],.4),mat=new T.MeshBasicMaterial({side:T.FrontSide}),mesh=new T.Mesh(g,mat);mesh.updateMatrixWorld();const ray=new T.Raycaster();
for(const [origin,direction] of [[[-1,0,0],[1,0,0]],[[6,0,0],[-1,0,0]]]){ray.set(new T.Vector3(...origin),new T.Vector3(...direction));const hit=ray.intersectObject(mesh);check('closed cap viewed from '+origin[0],hit.length>0&&hit[0].distance<1.01);}
fs.mkdirSync(new URL('./qa/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('./qa/thread-solid.json',import.meta.url),JSON.stringify({tests,pass:tests.every(x=>x.pass),scope:'full curved thread orientation and first/last cap, not just straight tube'},null,2));if(tests.some(t=>!t.pass))process.exitCode=1;
