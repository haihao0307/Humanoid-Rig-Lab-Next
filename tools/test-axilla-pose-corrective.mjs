// Worker endpoint regressions; no generated human surface or browser required.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAxillaShape} from '../reconstruction/axilla-shape.mjs';
import {createCharacterShapeField} from '../reconstruction/shape-deform.mjs';
import {applyCompactStature} from '../reconstruction/stature-transform.mjs';
const reference=JSON.parse(readFileSync(new URL('../reconstruction/rig-reference.json',import.meta.url),'utf8')),axilla=createAxillaShape(reference);
const add=(a,b)=>a.map((v,k)=>v+b[k]),sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((sum,v,k)=>sum+v*b[k],0),norm=a=>a.map(v=>v/Math.hypot(...a)),distance=(a,b)=>Math.hypot(...sub(a,b)),reflect=p=>[-p[0],p[1],p[2]];
function encode(n){n=norm(n);const l1=n.reduce((sum,v)=>sum+Math.abs(v),0);let x=n[0]/l1,y=n[1]/l1;if(n[2]<0){const ox=x;x=(1-Math.abs(y))*(ox<0?-1:1);y=(1-Math.abs(ox))*(y<0?-1:1);}return [Math.round(x*32767),Math.round(y*32767)];}
function decode(a){let x=a[0]/32767,y=a[1]/32767,z=1-Math.abs(x)-Math.abs(y);if(z<0){const ox=x;x=(1-Math.abs(y))*(ox<0?-1:1);y=(1-Math.abs(ox))*(y<0?-1:1);}return norm([x,y,z]);}
let inverseSamples=0,maximumInverseErrorM=0,maximumNormalError=0;
for(const side of ['left','right'])for(const x of [-.07,-.04,0,.04,.07])for(const y of [-.31,-.30,-.26,-.20,-.13,-.05,.014,.015,.02])for(const z of [-.12,-.06,0,.06,.12])for(const n of [norm([.2,.9,.3]),norm([-.4,.3,-.7])]){
 const p=add(axilla.centres[side],[x,y,z]),mask=side==='left'?16:32,f=axilla.evaluateSource(p,mask,n),back=axilla.inverseSource(f.point,mask,f.normal),error=distance(back.point,p),normalError=distance(back.normal,n);
 assert(error<1e-12,'Inverse recovers the neutral reference point');assert(normalError<1e-10,'J transpose recovers the neutral normal');
 maximumInverseErrorM=Math.max(maximumInverseErrorM,error);maximumNormalError=Math.max(maximumNormalError,normalError);inverseSamples++;
 assert(Math.abs(f.jacobian*back.jacobian-1)<1e-10);
 if(!f.changed){assert.deepEqual(back.point,p);assert.equal(back.changed,false);}
}
for(const mask of [0,1,8,64,128,256,512,1024,2048,54|1]){
 const p=add(axilla.centres.left,[0,-.2,0]),n=norm([1,2,3]);assert.deepEqual(axilla.inverseSource(p,mask,n),{point:p,normal:n,jacobian:1,minimumLocalJacobian:1,changed:false});
}
// Compare corresponding local points rather than assuming the source skeleton
// is exactly mirrored; its left/right measured centres differ slightly.
for(const offset of [[.03,-.2,.04],[.06,-.1,-.07],[0,-.28,0]]){
 const a=axilla.evaluateSource(add(axilla.centres.left,offset),16),b=axilla.evaluateSource(add(axilla.centres.right,[-offset[0],offset[1],offset[2]]),32);
 assert(Math.abs((a.point[1]-axilla.centres.left[1])-(b.point[1]-axilla.centres.right[1]))<1e-12);
}
const rows=[];
for(const side of ['left','right'])for(const offset of [[0,-.20,0],[.055,-.17,.01],[-.04,-.25,.07],[.02,-.06,-.045],[.07,-.18,0],[0,.03,0]]){
 const neutral=add(axilla.centres[side],offset),normal=norm([side==='left'?-.4:.4,.6,.5]),mask=side==='left'?16:32;
 const lifted=axilla.evaluateSource(neutral,mask,normal);rows.push({side,mask,neutral,normal,lifted});
}
function fixture(reportStatic=true){
 const vertices=rows.length,positions=Float32Array.from(rows.flatMap(r=>r.lifted.point)),normals=Int16Array.from(rows.flatMap(r=>encode(r.lifted.normal))),ids=new Uint16Array(vertices*8),weights=new Uint16Array(vertices*8);
 rows.forEach((r,i)=>{ids[i*8]=r.side==='left'?0:1;weights[i*8]=65535;});
 const mesh={name:'skin',vertices,positions,normals,origin:[0,0,0],extent:[1,1,1],regionMasks:Uint16Array.from(rows.map(r=>r.mask)),binding:{ids,weights},indices:new Uint16Array([0,1,2])};
 return {meshes:[mesh],report:{attributeBytes:positions.byteLength+normals.byteLength+mesh.indices.byteLength,maximumPositionQuantizationMm:.0001,groups:[],...(reportStatic?{surfaceCorrections:[axilla.report]}:{})}};
}
const directions=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)directions.push([x,y,z]);
let endpointSamples=0,probeExtrema=0;
for(const shape of [{statureScale:.94},{statureScale:1},{statureScale:1.06,shoulderWidth:1,torsoDepth:-.6,armFullness:.8}]){
 const field=createCharacterShapeField(reference,shape),jointNames=['left_upperArm','right_upperArm'],personalFrames=new Map(jointNames.map(id=>[id,{p:field.point(reference.nodes[id].positionM),q:[0,0,0,1]}])),rig={shapeReference:reference,jointNames,personalFrames};
 const result=fixture(),source=structuredClone(result.meshes[0]),oldBinding=result.meshes[0].binding,oldIndices=result.meshes[0].indices,bytes=result.report.attributeBytes;
 applyCompactStature(result,shape,rig);const m=result.meshes[0];
 assert.equal(m.binding,oldBinding);assert.equal(m.indices,oldIndices);assert.deepEqual(m.canonicalPositions,source.positions);
 assert(m.axillaDelta instanceof Float32Array&&m.axillaNormals instanceof Int16Array);assert.notEqual(m.normals.buffer,m.axillaNormals.buffer);
 assert.equal(result.report.attributeBytes,bytes+m.canonicalPositions.byteLength+m.axillaDelta.byteLength+m.axillaNormals.byteLength);
 assert.equal(result.report.axillaPoseCorrective.anatomicalCalibration,false);
 assert.equal(result.report.statureTransform.derivedErrors,null,'Inverse-map endpoints do not inherit source interpolation certificates');
 for(let i=0;i<m.vertices;i++){
  const liftedSource=Array.from(source.positions.subarray(i*3,i*3+3)),liftedNormal=decode(source.normals.subarray(i*2,i*2+2)),neutral=axilla.inverseSource(liftedSource,rows[i].mask,liftedNormal);
  const a=field.pointNormal(reflect(neutral.point),reflect(neutral.normal)),b=field.pointNormal(reflect(liftedSource),reflect(liftedNormal)),p=Array.from(m.positions.subarray(i*3,i*3+3)),delta=Array.from(m.axillaDelta.subarray(i*3,i*3+3));
  assert(distance(reflect(p),a.point)<2e-7);assert(distance(reflect(add(p,delta)),b.point)<2e-7);
  assert(distance(reflect(decode(m.normals.subarray(i*2,i*2+2))),a.normal)<.00015);
  assert(distance(reflect(decode(m.axillaNormals.subarray(i*2,i*2+2))),b.normal)<.00015);endpointSamples++;
 }
 for(let joint=0;joint<2;joint++)for(const endpoint of [0,1])for(const direction of directions){
  const scores=rows.map((row,i)=>row.side===(joint===0?'left':'right')?dot(reflect(Array.from(m.positions.subarray(i*3,i*3+3))).map((v,k)=>v+endpoint*reflect(Array.from(m.axillaDelta.subarray(i*3,i*3+3)))[k]),direction):-Infinity);
  const expected=Math.max(...scores),actual=Math.max(...result.supportProbes.filter(p=>p.influences[0][0]===joint).map(p=>dot(p.p.map((v,k)=>v+endpoint*p.axillaDelta[k]),direction)));
  assert(Math.abs(expected-actual)<1e-10,'Probe union contains both endpoint extrema');probeExtrema++;
 }
 const synthetic=fixture(false);applyCompactStature(synthetic,shape,rig);
 assert.equal(synthetic.meshes[0].axillaDelta,undefined);assert.equal(synthetic.meshes[0].axillaNormals,undefined);assert.equal(synthetic.report.axillaPoseCorrective.enabled,false);
 for(let i=0;i<rows.length;i++)assert(distance(reflect(Array.from(synthetic.meshes[0].positions.subarray(i*3,i*3+3))),field.point(reflect(Array.from(source.positions.subarray(i*3,i*3+3)))))<2e-7,'Missing static provenance must not inverse-map synthetic geometry');
 const feature=fixture();feature.meshes[0].name='faceSkin';applyCompactStature(feature,shape,rig);assert.equal(feature.meshes[0].axillaDelta,undefined);
}
console.log(JSON.stringify({inverseSamples,endpointSamples,probeExtrema,maximumInverseErrorM,maximumNormalError,geometryGenerated:false,visualAcceptance:false}));
