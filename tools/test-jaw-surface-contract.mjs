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
for(const lip of [0,.3])for(let step=0;step<=10;step++){
  const jaw=step/10;let skinLipMax=0,outerInnerMax=0,innerMouthMax=0;
  const evalPoint=(m,id,feature)=>cpu.transform(pos(m,id),{...neutral,jaw,lip,feature,eligible:1});
  for(let i=0;i<outer.faceBoundaryVertexIds.length;i++){
    skinLipMax=Math.max(skinLipMax,Math.hypot(...sub(evalPoint(skin,outer.faceBoundaryVertexIds[i],0),evalPoint(outer,i*(lp.rings+1)+lp.rings,3))));
    outerInnerMax=Math.max(outerInnerMax,Math.hypot(...sub(evalPoint(outer,i*(lp.rings+1),3),evalPoint(inner,i*(inner.returnRows+1),3))));
    innerMouthMax=Math.max(innerMouthMax,Math.hypot(...sub(evalPoint(inner,i*(inner.returnRows+1)+inner.returnRows,3),evalPoint(mouth,i*((mouth.returnRows??10)+1),10))));
  }
  boundaries.push({jaw,lip,skinLipMax,outerInnerMax,innerMouthMax});
  if(skinLipMax>1e-7||outerInnerMax>1e-10||innerMouthMax>1e-10)failures.push('Shared mouth boundary opened at '+JSON.stringify({jaw,lip,skinLipMax,outerInnerMax,innerMouthMax}));
}
for(const m of [outer,inner,mouth]){
  const points=Array.from({length:m.vertices},(_,i)=>pos(m,i)),feature=m===mouth?10:3,I=m.indices;
  for(const lip of [0,.3])for(const jaw of [0,.25,.5,.75,1]){
    const c={...neutral,feature,eligible:1,jaw,lip},mapped=points.map(p=>cpu.transform(p,c));
    let xyFlips=0,negativeOrientation=0,minAreaRatio=Infinity,minAlignment=Infinity,minDeterminant=Infinity,negativeDeterminants=0,minNeighbourDot=Infinity;
    const normals=[],edgeTriangles=new Map(),examples=[];
    for(let k=0;k<I.length;k+=3){
      const ids=Array.from(I.slice(k,k+3)),q=ids.map(i=>points[i]),r=ids.map(i=>mapped[i]),old=cross(sub(q[1],q[0]),sub(q[2],q[0])),now=cross(sub(r[1],r[0]),sub(r[2],r[0]));
      const oldArea=Math.hypot(...old),area=Math.hypot(...now);minAreaRatio=Math.min(minAreaRatio,area/oldArea);normals.push(unit(now));
      if(old[2]*now[2]<0&&Math.abs(old[2])>1e-13)xyFlips++;
      if(jaw===1){
        const centre=mul(q.reduce(add,[0,0,0]),1/3),J=cpu.jacobian(p=>cpu.transform(p,c),centre),cof=[cross(J[1],J[2]),cross(J[2],J[0]),cross(J[0],J[1])],det=dot(J[0],cof[0]);
        const expected=[0,1,2].map(a=>old.reduce((s,v,b)=>s+v*cof[b][a],0)),alignment=dot(unit(now),mul(unit(expected),Math.sign(det)));
        minAlignment=Math.min(minAlignment,alignment);minDeterminant=Math.min(minDeterminant,det);if(det<0)negativeDeterminants++;
        if(alignment<=0){negativeOrientation++;if(examples.length<8)examples.push({triangle:k/3,centre,alignment,areaRatio:area/oldArea,determinant:det,rest:q,deformed:r});}
      }
      for(const [a,b]of[[0,1],[1,2],[2,0]]){const key=Math.min(ids[a],ids[b])+'/'+Math.max(ids[a],ids[b]),neighbour=edgeTriangles.get(key);if(neighbour!==undefined)minNeighbourDot=Math.min(minNeighbourDot,dot(normals[neighbour],normals[k/3]));else edgeTriangles.set(key,k/3);}
    }
    surfaces.push({mesh:m.name,surface:m.lipSurface,jaw,lip,triangles:m.triangles,xyFlips,minAreaRatio,minAlignment:jaw===1?minAlignment:null,negativeOrientation,minDeterminant:jaw===1?minDeterminant:null,negativeDeterminants,minNeighbourDot,examples});
    if(negativeOrientation||negativeDeterminants||minAreaRatio<.01)failures.push('Oral surface degeneracy at '+JSON.stringify({mesh:m.name,surface:m.lipSurface,jaw,lip,negativeOrientation,negativeDeterminants,minAreaRatio}));
  }
}
const decodeNormal=(m,i)=>{let x=m.normals[i*2]/32767,y=m.normals[i*2+1]/32767,z=1-Math.abs(x)-Math.abs(y);if(z<0){const old=x;x=(1-Math.abs(y))*(old<0?-1:1);y=(1-Math.abs(old))*(y<0?-1:1);}return unit([x,y,z]);};
let minChamberNormalAlignment=Infinity,maxCircumferenceNormalGap=0;
for(let k=0;k<mouth.indices.length;k+=3){const ids=Array.from(mouth.indices.slice(k,k+3)),q=ids.map(i=>pos(mouth,i)),g=unit(cross(sub(q[1],q[0]),sub(q[2],q[0]))),n=unit(ids.map(i=>decodeNormal(mouth,i)).reduce(add,[0,0,0]));minChamberNormalAlignment=Math.min(minChamberNormalAlignment,dot(g,n));}
for(let j=0;j<=mouth.returnRows;j++)maxCircumferenceNormalGap=Math.max(maxCircumferenceNormalGap,Math.hypot(...sub(decodeNormal(mouth,j),decodeNormal(mouth,outer.faceBoundaryVertexIds.length*(mouth.returnRows+1)+j))));
assert.equal(mouth.cavityLight.length,mouth.vertices*4,'mouth visibility and axis must share the cavity attribute format');
assert(minChamberNormalAlignment>0,'stored oral normals oppose the chamber triangles');
assert.equal(maxCircumferenceNormalGap,0,'closed oral circumference must have shared normals');
const visibility=Array.from(mouth.cavityLight).filter((_,i)=>i%4===0);
assert(Math.min(...visibility)>.04&&Math.min(...visibility)<.10&&Math.max(...visibility)===1,'oral visibility must preserve a lit entrance and shaded depth');
const oralSpace=[];
function insidePolygon(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
}return yes;}
for(const jaw of [.5,1]){
  const oralPose={...neutral,jaw,lip:0,eligible:1,feature:10};
  const wall=Array.from({length:mouth.vertices},(_,i)=>cpu.transform(pos(mouth,i),oralPose));
  const aperture=outer.faceBoundaryVertexIds.map((_,i)=>cpu.transform(pos(outer,i*(lp.rings+1)),{...oralPose,feature:3}));
  const grid=new Map(),cell=.002;
  for(let k=0;k<mouth.indices.length;k+=3){
    const q=Array.from(mouth.indices.slice(k,k+3),i=>wall[i]),xs=q.map(p=>p[0]),ys=q.map(p=>p[1]);
    for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++)for(let y=Math.floor(Math.min(...ys)/cell);y<=Math.floor(Math.max(...ys)/cell);y++){
      const key=x+'/'+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(q);
    }
  }
  for(const [name,feature]of[['upperTeeth',11],['lowerTeeth',12],['tongue',15]]){
    const m=face.meshes.find(m=>m.name===name);let samplesInAperture=0,wallOccluded=0,maxOccludingDepth=0;const examples=[];
    for(let i=0;i<m.vertices;i++){
      if(decodeNormal(m,i)[2]<.25)continue;
      const p=cpu.transform(pos(m,i),{...oralPose,feature,eligible:feature===15?1:0});if(!insidePolygon(p,aperture))continue;samplesInAperture++;
      let nearest=-Infinity;
      for(const q of grid.get(Math.floor(p[0]/cell)+'/'+Math.floor(p[1]/cell))||[]){
        const [a,b,c]=q,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-16)continue;
        const u=((b[1]-c[1])*(p[0]-c[0])+(c[0]-b[0])*(p[1]-c[1]))/den,v=((c[1]-a[1])*(p[0]-c[0])+(a[0]-c[0])*(p[1]-c[1]))/den;
        if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)nearest=Math.max(nearest,u*a[2]+v*b[2]+(1-u-v)*c[2]);
      }
      if(nearest>p[2]+.00010){wallOccluded++;maxOccludingDepth=Math.max(maxOccludingDepth,nearest-p[2]);if(examples.length<3)examples.push({vertex:i,position:p,wallDepth:nearest});}
    }
    oralSpace.push({jaw,name,samplesInAperture,wallOccluded,maxOccludingDepth,examples});
  }
}
const report={sourceSHA256:crypto.createHash('sha256').update(read('body/FaceAnatomy.js')).digest('hex'),boundaries,surfaces,mouthChamber:mouth.chamber,minChamberNormalAlignment,maxCircumferenceNormalGap,visibilityRange:[Math.min(...visibility),Math.max(...visibility)],oralSpace,failures,visualAcceptance:false};
console.log(JSON.stringify(report,null,2));
assert.equal(failures.length,0,failures.join('; '));
