// Current reconstructed source, shared boundaries and 3D jaw deformation.
// No build, browser, mesh export, or claim of visual-quality acceptance.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const require=createRequire(import.meta.url);
const reference=read('tools/test-jaw-normal-shader.cjs').split('(async()=>')[0].replace("const {chromium}=require(process.env.HUMAN_PLAYWRIGHT_MODULE||'playwright');",'');
const cpu=vm.runInNewContext(reference+'\n({api,weight,before,transform,jacobian,add,sub,mul,unit,cross,dot,clamp,lp,j})',{require,__dirname:fileURLToPath(new URL('.',import.meta.url)),process});
const {add,sub,mul,unit,cross,dot,clamp,lp}=cpu;
const ctx=vm.createContext({add,sub,mul,cross,norm:unit,clamp,COMPACT_INFLUENCES:8});
new vm.Script(['body/EyeAnatomy.js','body/PerioralSurface.js','body/BrowAnatomy.js','body/BeardAnatomy.js','body/FaceAnatomy.js'].map(read).join('\n')+'\nglobalThis.api={create:compactCreateFaceAnatomy,outline:compactLipOutline};').runInContext(ctx);
const [{decodeCompactHuman},{sampleCompactGroup,smoothAndQuantize},{createCompactNormalField},{CanonicalTopology}]=await Promise.all([
  import('../reconstruction/codec.mjs'),import('../reconstruction/mesher.mjs'),import('../reconstruction/normal-field.mjs'),import('../reconstruction/topology.mjs')]);
const load=async name=>(await decodeCompactHuman(fs.readFileSync(new URL('reconstruction/'+name+'.chf.gz',root)))).data;
const [detail,normalData]=await Promise.all([load('detail'),load('normal-field')]);
const field=createCompactNormalField(normalData),topology=new CanonicalTopology(JSON.parse(read('reconstruction/rig-reference.json')));
const sampled=await sampleCompactGroup('detail',detail,'balanced',()=>{},field,JSON.parse(read('reconstruction/binding-schema.json')),topology);
const settled=topology.finalize(sampled.meshes),source=smoothAndQuantize(settled.meshes.map(m=>topology.materialize(m)),field).meshes.map(m=>({...m,canonicalPositions:m.positions}));
const face=ctx.api.create(source,{jointIds:new Map([['head',7]])},1);
const outer=face.meshes.find(m=>m.lipSurface==='vermilion'),inner=face.meshes.find(m=>m.lipSurface==='mucosa'),skin=face.meshes[0],mouth=face.meshes.find(m=>m.name==='mouthInterior');
const pos=(m,i)=>Array.from(m.canonicalPositions.slice(i*3,i*3+3));
const neutral={lip:0,enabled:0,offsets:cpu.api.recipe.nodes.map(()=>[0,0,0]),muscles:cpu.api.recipe.muscleFields.map(()=>0)},boundaries=[],surfaces=[],failures=[];
const tris=(m,p)=>Array.from({length:m.indices.length/3},(_,i)=>Array.from(m.indices.slice(i*3,i*3+3),id=>p[id]));
const triangleBounds=q=>[0,1,2].map(k=>[Math.min(...q.map(p=>p[k])),Math.max(...q.map(p=>p[k]))]);
function grid3(triangles){const grid=new Map(),bounds=triangles.map(triangleBounds),cell=.002;
 triangles.forEach((q,i)=>{const b=bounds[i].map(r=>r.map(v=>Math.floor(v/cell)));for(let x=b[0][0];x<=b[0][1];x++)for(let y=b[1][0];y<=b[1][1];y++)for(let z=b[2][0];z<=b[2][1];z++){const key=x+'/'+y+'/'+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);}});
 return {grid,bounds,triangles,cell};
}
function intersects(a,b){
 const ea=[sub(a[1],a[0]),sub(a[2],a[1]),sub(a[0],a[2])],eb=[sub(b[1],b[0]),sub(b[2],b[1]),sub(b[0],b[2])],na=cross(ea[0],ea[1]),nb=cross(eb[0],eb[1]);
 const axes=[na,nb,...ea.flatMap(x=>eb.map(y=>cross(x,y))),...ea.map(e=>cross(na,e)),...eb.map(e=>cross(nb,e))];
 for(const axis of axes){if(Math.hypot(...axis)<1e-14)continue;const n=unit(axis),pa=a.map(p=>dot(p,n)),pb=b.map(p=>dot(p,n));if(Math.max(...pa)<Math.min(...pb)-1e-9||Math.max(...pb)<Math.min(...pa)-1e-9)return false;}
 return true;
}
function collisions(a,index){let count=0;const examples=[];for(let ai=0;ai<a.length;ai++){const q=a[ai],bd=triangleBounds(q),b=bd.map(r=>r.map(v=>Math.floor(v/index.cell))),checked=new Set();
 for(let x=b[0][0];x<=b[0][1];x++)for(let y=b[1][0];y<=b[1][1];y++)for(let z=b[2][0];z<=b[2][1];z++)for(const bi of index.grid.get(x+'/'+y+'/'+z)||[]){if(checked.has(bi))continue;checked.add(bi);const other=index.bounds[bi];if(bd.some((r,k)=>r[1]<other[k][0]-1e-9||other[k][1]<r[0]-1e-9))continue;if(!q.some(p=>index.triangles[bi].some(r=>Math.hypot(...sub(p,r))<1e-9))&&intersects(q,index.triangles[bi])){count++;if(examples.length<3)examples.push({a:ai,b:bi});}}
 }return {pairs:count,examples};}
function grid2(triangles){const grid=new Map(),cell=.002;for(const q of triangles){const b=triangleBounds(q).slice(0,2).map(r=>r.map(v=>Math.floor(v/cell)));for(let x=b[0][0];x<=b[0][1];x++)for(let y=b[1][0];y<=b[1][1];y++){const key=x+'/'+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(q);}}return {grid,cell};}
function rayDepths(p,index){const hits=[];for(const [a,b,c]of index.grid.get(Math.floor(p[0]/index.cell)+'/'+Math.floor(p[1]/index.cell))||[]){
 const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-16)continue;
 const u=((b[1]-c[1])*(p[0]-c[0])+(c[0]-b[0])*(p[1]-c[1]))/den,v=((c[1]-a[1])*(p[0]-c[0])+(a[0]-c[0])*(p[1]-c[1]))/den;
 if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)hits.push(u*a[2]+v*b[2]+(1-u-v)*c[2]);
 }return hits.sort((a,b)=>a-b).filter((z,i,a)=>i===0||Math.abs(z-a[i-1])>1e-7);}
function apertureEdges(x,aperture){const ys=[];for(let i=0;i<aperture.length;i++){const a=aperture[i],b=aperture[(i+1)%aperture.length];if((a[0]<=x&&b[0]>x)||(b[0]<=x&&a[0]>x)){const t=(x-a[0])/(b[0]-a[0]);ys.push(a[1]+(b[1]-a[1])*t);}}return ys.length?[Math.min(...ys),Math.max(...ys)]:null;}
const tongue=face.meshes.find(m=>m.name==='tongue'),upperTeeth=face.meshes.find(m=>m.name==='upperTeeth'),lowerTeeth=face.meshes.find(m=>m.name==='lowerTeeth'),beard=face.meshes.find(m=>m.name==='faceBeard');
const decodeNormal=(m,i)=>{let x=m.normals[i*2]/32767,y=m.normals[i*2+1]/32767,z=1-Math.abs(x)-Math.abs(y);if(z<0){const old=x;x=(1-Math.abs(y))*(old<0?-1:1);y=(1-Math.abs(old))*(y<0?-1:1);}return unit([x,y,z]);};
const normalAt=(m,id,c)=>{const J=cpu.jacobian(p=>cpu.transform(p,c),pos(m,id)),cof=[cross(J[1],J[2]),cross(J[2],J[0]),cross(J[0],J[1])],n=decodeNormal(m,id);return unit([0,1,2].map(k=>n.reduce((s,v,a)=>s+v*cof[a][k],0)));};
assert(cpu.api.eligible('tongue')&&cpu.api.eligible('mouthInterior')&&cpu.api.eligible('faceBeard'),'renderer registration must enable the complete incoming face chain');
assert(tongue.mouthBoundaryVertexIds.length>100&&tongue.oralFloor.replacedFloorTriangles===tongue.triangles,'tongue must replace explicit floor triangles');
assert.equal(tongue.cavityLight.length,tongue.vertices*4);
for(const [ti,mi]of tongue.mouthBoundaryVertexIds){
 for(let k=0;k<3;k++)assert.equal(tongue.canonicalPositions[ti*3+k],mouth.canonicalPositions[mi*3+k],'rest floor position mismatch');
 for(let k=0;k<2;k++)assert.equal(tongue.normals[ti*2+k],mouth.normals[mi*2+k],'rest floor normal mismatch');
 for(let k=0;k<4;k++)assert.equal(tongue.cavityLight[ti*4+k],mouth.cavityLight[mi*4+k],'cavity visibility/axis must remain continuous at floor attachment');
}
const offsets=cpu.api.recipe.nodes.map((node,i)=>[.0012*Math.sin(i*1.7),.0009*Math.cos(i*.9),.0014*Math.sin(i*.63)]),muscles=cpu.api.recipe.muscleFields.map((f,i)=>i%5===0?.3:0);
const connection=[],geometry=[],beardReports=[];
for(const mode of ['neutral','lip','combined'])for(let step=0;step<=10;step++){
 const jaw=step/10,c={...neutral,jaw,lip:mode==='neutral'?0:.3,enabled:mode==='combined'?1:0,offsets:mode==='combined'?offsets:neutral.offsets,muscles:mode==='combined'?muscles:neutral.muscles,eligible:1};
 let positionGap=0,normalGap=0;
 for(const [ti,mi]of tongue.mouthBoundaryVertexIds){positionGap=Math.max(positionGap,Math.hypot(...sub(cpu.transform(pos(tongue,ti),{...c,feature:15}),cpu.transform(pos(mouth,mi),{...c,feature:10}))));normalGap=Math.max(normalGap,Math.hypot(...sub(normalAt(tongue,ti,{...c,feature:15}),normalAt(mouth,mi,{...c,feature:10}))));}
 assert.equal(positionGap,0,'lip/face/jaw must not split the attached oral floor');assert.equal(normalGap,0,'composite inverse-transpose normals must remain shared');connection.push({mode,jaw,positionGap,normalGap});
 if(step%5===0){let apronRoots=0,maxRootDrift=0,outsideRoots=0,maxOutsideWeightError=0;
 for(let id=0;id<beard.vertices;id+=12){const p=mul([pos(beard,id),pos(beard,id+1),pos(beard,id+2)].reduce(add,[0,0,0]),1/3),q=((p[0]-lp.centreX)/.033)**2+((p[1]-lp.seamY)/.0145)**2;
  if(q<1){apronRoots++;maxRootDrift=Math.max(maxRootDrift,Math.hypot(...sub(cpu.transform(p,{...c,feature:17}),cpu.transform(p,{...c,feature:3}))));}
  else{outsideRoots++;maxOutsideWeightError=Math.max(maxOutsideWeightError,Math.abs(cpu.weight(p,17,1)-cpu.weight(p,0,1)));}}
 assert(apronRoots>500&&outsideRoots>500);assert.equal(maxRootDrift,0,'oral beard roots leave their actual skin host');assert.equal(maxOutsideWeightError,0,'beard outside the oral apron must retain skin weights');beardReports.push({mode,jaw,apronRoots,outsideRoots,maxRootDrift,maxOutsideWeightError});}
 if((mode==='neutral'&&step%5!==0)||(mode!=='neutral'&&step%5!==0))continue;
 const pose=(m,feature,eligible)=>Array.from({length:m.vertices},(_,i)=>cpu.transform(pos(m,i),{...c,feature,eligible}));
 const tp=pose(tongue,15,1),wp=pose(mouth,10,1),up=pose(upperTeeth,11,0),down=pose(lowerTeeth,12,0),lipP=pose(outer,3,1),aperture=outer.faceBoundaryVertexIds.map((_,i)=>lipP[i*(lp.rings+1)]),tt=tris(tongue,tp),wt=tris(mouth,wp),wallIndex=grid2(wt);
 const collision={tongueTeeth:collisions(tt,grid3([...tris(upperTeeth,up),...tris(lowerTeeth,down)])),tongueLip:collisions(tt,grid3(tris(outer,lipP))),tongueWall:collisions(tt,grid3(wt)),upperLower:collisions(tris(lowerTeeth,down),grid3(tris(upperTeeth,up)))};
 for(const [name,result]of Object.entries(collision))assert.equal(result.pairs,0,name+' intersects at '+mode+'/'+jaw+': '+JSON.stringify(result.examples));
 let minDeterminant=Infinity,minAlignment=Infinity,minAreaRatio=Infinity,minStoredNormalDot=Infinity;
 for(let k=0;k<tongue.indices.length;k+=3){const ids=Array.from(tongue.indices.slice(k,k+3)),q=ids.map(i=>pos(tongue,i)),r=ids.map(i=>tp[i]),old=cross(sub(q[1],q[0]),sub(q[2],q[0])),now=cross(sub(r[1],r[0]),sub(r[2],r[0])),centre=mul(q.reduce(add,[0,0,0]),1/3),J=cpu.jacobian(p=>cpu.transform(p,{...c,feature:15}),centre),cof=[cross(J[1],J[2]),cross(J[2],J[0]),cross(J[0],J[1])],det=dot(J[0],cof[0]),expected=[0,1,2].map(a=>old.reduce((s,v,b)=>s+v*cof[b][a],0));minDeterminant=Math.min(minDeterminant,det);minAlignment=Math.min(minAlignment,dot(unit(now),unit(expected)));minAreaRatio=Math.min(minAreaRatio,Math.hypot(...now)/Math.hypot(...old));minStoredNormalDot=Math.min(minStoredNormalDot,dot(unit(old),unit(ids.map(id=>decodeNormal(tongue,id)).reduce(add,[0,0,0]))));}
 assert(minDeterminant>0&&minAlignment>0&&minAreaRatio>.1&&minStoredNormalDot>0,'tongue surface degenerate/inverted');
 const visibility=[];for(const [name,p]of[['lowerTeeth',down],['tongue',tp]]){let inAperture=0,wallOccluded=0,clearance=-Infinity;for(const v of p){const edges=apertureEdges(v[0],aperture);if(!edges)continue;clearance=Math.max(clearance,v[1]-edges[0]);if(v[1]>edges[0]&&v[1]<edges[1]){inAperture++;if(rayDepths(v,wallIndex).some(z=>z>v[2]+.0001))wallOccluded++;}}visibility.push({name,inAperture,wallOccluded,clearance});if(jaw>=.5&&mode==='lip')assert(inAperture>0&&wallOccluded<inAperture,'requested mouth pose must expose '+name);}
 geometry.push({mode,jaw,visibility,collision,minDeterminant,minAlignment,minAreaRatio,minStoredNormalDot});
}
const report={sourceSHA256:crypto.createHash('sha256').update(read('body/FaceAnatomy.js')).digest('hex'),tongue: tongue.oralFloor,connection,geometry,beard:beardReports,visualAcceptance:false};
console.log(JSON.stringify(report,null,2));
