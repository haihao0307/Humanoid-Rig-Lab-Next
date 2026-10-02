import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createShortsAcceptedSeedTransfer} from '../ShortsAcceptedSeedTransfer.mjs';
// Small explicit material-coordinate test only, never a cached human garment.
const base=new URL('../',import.meta.url),out=new URL('qa/shorts-accepted-seed-transfer-small-proof-20261002.json',base);
assert(!existsSync(out),'Preserve earlier test evidence');
const uv=[[0,0],[.08,0],[0,.12],[.08,.12]],current=uv.map(([u,v])=>[u*1.4,v*.8]),ranges=[{pieceId:'A',offset:0,count:4},{pieceId:'B',offset:4,count:4}],sourceUV=Float64Array.from([...current.flat(),...current.flat()]),
 pieces=['A','B'].map(id=>({id,kind:'test-material',materialCoordinates:current.map(x=>x.slice()),triangles:[[0,1,3],[0,3,2]],boundaries:{}})),triangles=Uint32Array.from([0,1,3,0,3,2,4,5,7,4,7,6]),masses=new Float64Array(8).fill(.01),
 draft={positions:new Float64Array(24),sourceUV,triangles,masses,pieces,ranges,seams:[{id:'test-fold',pairs:[{a:0,b:4},{a:2,b:6}]}],elasticEdges:[{a:1,b:3,restLengthM:.07,compliance:.01}],receipt:{version:'PURE_SMALL_TEST_SOURCE',areaM2:.021504,massKg:.08}},
 reference={positions:Float64Array.from([...uv.flatMap(([u,v])=>[2*u,3*v,0]),...uv.flatMap(([u,v])=>[0,3*v,-2*u])]),sourceUV:Float64Array.from([...uv.flat(),...uv.flat()]),ranges:structuredClone(ranges),coordinateFrame:'actor-local-metres',authority:'small two-sheet 90 degree fold; old actual metric deliberately non-unit',triangles:[0,1,2,1,3,2,4,5,6,5,7,6]};
const before=JSON.stringify({draft,reference},(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v),seed=createShortsAcceptedSeedTransfer(draft,reference,{centroid:[.3,1,.2],heightGuides:false});
assert.equal(seed.seamGroups.length,6);assert.deepEqual(seed.sourceUV,draft.sourceUV);assert.deepEqual(seed.triangles,draft.triangles);assert.deepEqual(seed.masses,draft.masses);assert.deepEqual(seed.elasticEdges,draft.elasticEdges);
assert.equal(JSON.stringify({draft,reference},(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v),before,'Both runtime source inputs remain unchanged');
let maximumPrincipalStrain=0;
for(let i=0;i<triangles.length;i+=3){const ids=Array.from(triangles.slice(i,i+3)),p=ids.map(j=>Array.from(seed.positions.slice(j*3,j*3+3))),uvs=ids.map(j=>Array.from(sourceUV.slice(j*2,j*2+2))),du=uvs[1].map((v,k)=>v-uvs[0][k]),dv=uvs[2].map((v,k)=>v-uvs[0][k]),det=du[0]*dv[1]-du[1]*dv[0],ab=p[1].map((v,k)=>v-p[0][k]),ac=p[2].map((v,k)=>v-p[0][k]),u=ab.map((x,k)=>(x*dv[1]-ac[k]*du[1])/det),v=ab.map((x,k)=>(ac[k]*du[0]-x*dv[0])/det),dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),A=dot(u,u),B=dot(u,v),D=dot(v,v),disc=Math.hypot(A-D,2*B);
 maximumPrincipalStrain=Math.max(maximumPrincipalStrain,Math.abs(Math.sqrt((A+D+disc)/2)-1),Math.abs(Math.sqrt((A+D-disc)/2)-1));}
assert(maximumPrincipalStrain<1e-8,'Changed source dimensions use old polar directions, not old rest lengths');
for(const s of draft.seams)for(const p of s.pairs)assert.deepEqual(Array.from(seed.positions.slice(p.a*3,p.a*3+3)),Array.from(seed.positions.slice(p.b*3,p.b*3+3)));
assert.throws(()=>createShortsAcceptedSeedTransfer(draft,{...reference,coordinateFrame:'world'}),/actor-local-metres/);
assert.throws(()=>createShortsAcceptedSeedTransfer(draft,{...reference,ranges:[{...ranges[0],count:3},ranges[1]]}),/correspondence/);
const report={scope:'one small non-human connected source Laplacian construction; no actual garment/body/contact/native simulation',passed:true,moduleSHA256:createHash('sha256').update(readFileSync(new URL('ShortsAcceptedSeedTransfer.mjs',base))).digest('hex'),sourceUV:Array.from(sourceUV),oldSourceUV:Array.from(reference.sourceUV),oldMetricDeliberatelyScaled:[2,3],currentPaperScales:[1.4,.8],diagonalsDiffer:true,maximumPrincipalStrain,sourceRestMassElasticIdentity:true,seamsExact:true,independentSourceAndReferenceUnchanged:true,seedPositions:Array.from(seed.positions),receipt:seed.acceptedSeedReceipt,actualAcceptedReferenceValidated:false};
writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,maximumPrincipalStrain,linear:seed.acceptedSeedReceipt.linear,output:out.pathname}));
