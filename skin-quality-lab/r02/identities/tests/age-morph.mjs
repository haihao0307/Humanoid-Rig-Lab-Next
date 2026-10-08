/** Run from any cwd: node identities/tests/age-morph.mjs */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as THREE from '../../../r01/vendor/three.module.js';
import {createScanAgeMorph,sampleAgeDisplacement} from '../AgeMorph.js';
const root=new URL('../../',import.meta.url);
const file=name=>fs.readFileSync(new URL(name,root));
const hash=a=>crypto.createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
export function makeGeometry(){
 const bytes=file('../r01/assets/head.glb'),jsonLen=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsonLen)),bin=bytes.subarray(28+jsonLen);
 function array(i){const a=doc.accessors[i],v=doc.bufferViews[a.bufferView],dim={SCALAR:1,VEC2:2,VEC3:3}[a.type],Type={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType],out=new Type(a.count*dim);for(let j=0;j<a.count;j++)for(let k=0;k<dim;k++){const off=(v.byteOffset||0)+(a.byteOffset||0)+j*(v.byteStride||dim*Type.BYTES_PER_ELEMENT)+k*Type.BYTES_PER_ELEMENT;out[j*dim+k]=a.componentType===5126?bin.readFloatLE(off):a.componentType===5125?bin.readUInt32LE(off):bin.readUInt16LE(off);}return out;}
 const prim=doc.meshes[0].primitives[0],g=new THREE.BufferGeometry();
 for(const [name,dim,key]of [['position',3,'POSITION'],['normal',3,'NORMAL'],['uv',2,'TEXCOORD_0']])g.setAttribute(name,new THREE.BufferAttribute(array(prim.attributes[key]),dim));g.setIndex(new THREE.BufferAttribute(array(prim.indices),1));
 const app=file('app.js').toString(),start=app.indexOf('function subdivide('),end=app.indexOf('\nconst skinFunctions',start);assert.ok(start>=0&&end>start,'original subdivision function located');
 const subdivide=new Function('THREE',app.slice(start,end)+';return subdivide;')(THREE);const one=subdivide(g),two=subdivide(one);g.dispose();one.dispose();two.scale(.04,.04,.04);return two;
}
const g=makeGeometry(),p=g.attributes.position.array,n=g.attributes.normal.array,p0=p.slice(),n0=n.slice(),uvHash=hash(g.attributes.uv.array),indexHash=hash(g.index.array),positionHash=hash(p),normalHash=hash(n);
const checks=[];function check(name,yes){checks.push({name,pass:!!yes});assert.ok(yes,name);}
const t=performance.now(),age=createScanAgeMorph(g),captureMilliseconds=performance.now()-t;age.apply(1);const applyMilliseconds=performance.now()-t-captureMilliseconds;
check('expected subdivided scan',p.length/3===143196&&g.index.count/3===282944);
check('finite positions and normals',p.every(Number.isFinite)&&n.every(Number.isFinite));
check('UV unchanged',hash(g.attributes.uv.array)===uvHash);check('topology unchanged',hash(g.index.array)===indexHash);
check('neutral attributes unchanged',hash(age.neutralPosition.array)===positionHash&&hash(age.neutralNormal.array)===normalHash);
let minNorm=Infinity,maxNorm=0,changed=0,maxD=0,triFlips=0,minFaceDot=1,minAreaRatio=Infinity,maxAreaRatio=0,duplicates=0,seamMax=0;const seams=new Map();
for(let v=0;v<p.length/3;v++){const k=v*3,l=Math.hypot(...n.subarray(k,k+3));minNorm=Math.min(minNorm,l);maxNorm=Math.max(maxNorm,l);const d=Math.hypot(p[k]-p0[k],p[k+1]-p0[k+1],p[k+2]-p0[k+2]);if(d>1e-8)changed++;maxD=Math.max(maxD,d);const key=p0.slice(k,k+3).join(','),other=seams.get(key);if(other!==undefined){duplicates++;seamMax=Math.max(seamMax,Math.hypot(p[k]-p[other],p[k+1]-p[other+1],p[k+2]-p[other+2]));}else seams.set(key,k);}
const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),d=new THREE.Vector3(),e=new THREE.Vector3(),f=new THREE.Vector3();
for(let t=0;t<g.index.count;t+=3){const ia=g.index.array[t]*3,ib=g.index.array[t+1]*3,ic=g.index.array[t+2]*3;a.fromArray(p0,ia);b.fromArray(p0,ib).sub(a);c.fromArray(p0,ic).sub(a);d.fromArray(p,ia);e.fromArray(p,ib).sub(d);f.fromArray(p,ic).sub(d);b.cross(c);e.cross(f);const ab=b.length(),ae=e.length();if(ab<1e-13)continue;const dot=b.dot(e)/(ab*ae);minFaceDot=Math.min(minFaceDot,dot);if(dot<=0)triFlips++;minAreaRatio=Math.min(minAreaRatio,ae/ab);maxAreaRatio=Math.max(maxAreaRatio,ae/ab);}
check('unit normals remain normalized',minNorm>.99999&&maxNorm<1.00001);check('visible but bounded volume change',maxD>.003&&maxD<.008);check('UV seam duplicates remain coincident',duplicates>0&&seamMax===0);check('no triangle direction reversal',triFlips===0);check('local area not collapsed',minAreaRatio>.35);check('analytic field orientation preserved',age.diagnostics().unitJacobianDeterminantRange[0]>.4);
const agedPositionHash=hash(p),agedNormalHash=hash(n);age.apply(.35);age.apply(1);check('reapply is independent of history',hash(p)===agedPositionHash&&hash(n)===agedNormalHash);
for(let i=0;i<20;i++){age.apply((i%4+1)/4);age.restore();assert.equal(hash(p),positionHash);assert.equal(hash(n),normalHash);}check('20 switching cycles restore every position and normal byte',true);
age.apply(1);age.apply(0);check('strength zero is exact neutral',hash(p)===positionHash&&hash(n)===normalHash);
age.apply(1);const samples=[['mid-cheek',[-.040,.032,.070]],['under-eye',[-.0332,.0585,.0723]],['upper-lid',[-.0332,.073,.0778]],['temple',[-.057,.083,.043]],['mouth-corner',[-.026,.0175,.085]],['jowl',[-.035,-.005,.068]],['neck',[-.0034,-.049,.036]],['nose-tip',[-.004,.044,.103]],['back',[0,.03,-.08]]].map(([name,referencePoint])=>{let vertex=0,best=Infinity;for(let k=0;k<p0.length;k+=3){const distance=(p0[k]-referencePoint[0])**2+(p0[k+1]-referencePoint[1])**2+(p0[k+2]-referencePoint[2])**2;if(distance<best){best=distance;vertex=k/3;}}const k=vertex*3;return {name,referencePoint,vertex,neutralPosition:Array.from(p0.subarray(k,k+3)),distanceToReferenceMeters:Math.sqrt(best),deltaMillimeters:[(p[k]-p0[k])*1000,(p[k+1]-p0[k+1])*1000,(p[k+2]-p0[k+2])*1000]};});
// Spot-check analytic normal transport against independent finite differences.
let maxNormalError=0;const h=1e-5;for(let v=0;v<p.length/3;v+=149){const k=v*3,pos=Array.from(p0.subarray(k,k+3)),columns=[];for(let axis=0;axis<3;axis++){const q=pos.slice(),r=pos.slice();q[axis]+=h;r[axis]-=h;const dq=sampleAgeDisplacement(...q),dr=sampleAgeDisplacement(...r);columns.push(dq.map((value,i)=>(value-dr[i])/(2*h)+(axis===i?1:0)));}const m=new THREE.Matrix3().set(columns[0][0],columns[1][0],columns[2][0],columns[0][1],columns[1][1],columns[2][1],columns[0][2],columns[1][2],columns[2][2]).invert().transpose();a.fromArray(n0,k).applyMatrix3(m).normalize();b.fromArray(n,k);maxNormalError=Math.max(maxNormalError,a.distanceTo(b));}
check('normal transport agrees with independent finite differences',maxNormalError<.0001);
const report={schema:'kaopu/r02-artistic-age-test@1',success:true,sourceMeshSHA256:crypto.createHash('sha256').update(file('../r01/assets/head.glb')).digest('hex'),captureMilliseconds,applyMilliseconds,checks,geometry:age.diagnostics(),unitNormalLengthRange:[minNorm,maxNorm],changedVertices:changed,maximumMeasuredDisplacementMeters:maxD,UVSeamDuplicateVertices:duplicates,maxSeamGapMeters:seamMax,triangleFlips:triFlips,minFaceDirectionDot:minFaceDot,triangleAreaRatioRange:[minAreaRatio,maxAreaRatio],maximumNormalTransportError:maxNormalError,baselineHashes:{positionHash,normalHash,uvHash,indexHash},samples,limitations:'Pure geometry and invariance tests; clay-render visual inspection is separate. Artistic age study, not medical validation.'};
fs.writeFileSync(new URL('./age-morph-report.json',import.meta.url),JSON.stringify(report,null,2));
// Binary outputs are optional for independent rendering; never runtime assets.
if(process.env.AGE_MORPH_BIN_DIR){const dir=process.env.AGE_MORPH_BIN_DIR;fs.mkdirSync(dir,{recursive:true});for(const[name,data]of [['neutral-position',p0],['neutral-normal',n0],['aged-position',p],['aged-normal',n],['index',g.index.array]])fs.writeFileSync(`${dir}/${name}.bin`,Buffer.from(data.buffer,data.byteOffset,data.byteLength));}
age.restore();console.log(JSON.stringify(report,null,2));
