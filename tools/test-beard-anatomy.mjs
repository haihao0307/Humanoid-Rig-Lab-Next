// Numerical groom checks. These do not certify naturalness or visual quality.
// --production also reconstructs the current source face, without a browser.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>mul(a,1/(Math.hypot(...a)||1));
const ctx=vm.createContext({add,sub,mul,cross,norm,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),COMPACT_INFLUENCES:8});
new vm.Script(['body/EyeAnatomy.js','body/PerioralSurface.js','body/BrowAnatomy.js','body/BeardAnatomy.js','body/FaceAnatomy.js'].map(read).join('\n')+
  '\nglobalThis.api={generate:compactBeardGeometry,field:compactBeardGroomField,create:compactCreateFaceAnatomy,outline:compactLipOutline,lip:COMPACT_PERIORAL_STRUCTURE,config:COMPACT_BEARD_ANATOMY};').runInContext(ctx);
const api=ctx.api,p=api.config,options={lipOutline:api.outline,halfWidth:api.lip.halfWidth,centreX:api.lip.centreX};
const surface=(x,y)=>.190-4*x*x-.12*(y-1.455)+.001*Math.sin((y-1.43)*40);
const first=api.generate(surface,options),repeat=api.generate(surface,options),other=api.generate(surface,{...options,seed:p.seed+1});
assert.equal(JSON.stringify(first),JSON.stringify(repeat),'same seed must reproduce identical geometry');
assert.notEqual(JSON.stringify(first.positions),JSON.stringify(other.positions),'different seed must change geometry');
assert.equal(api.generate(surface,{...options,density:0}).report.strands,0,'zero density must remove the groom');
let maximumAdjacentFieldChange=0;
for(let x=-.05;x<.05;x+=.0011)for(let y=1.432;y<1.485;y+=.0013){
  const a=api.field(x,y,p.seed,0),b=api.field(x+.0001,y,p.seed,0);
  assert(a>=0&&a<=1&&b>=0&&b<=1,'groom field must remain bounded');
  maximumAdjacentFieldChange=Math.max(maximumAdjacentFieldChange,Math.abs(a-b));
}
assert(maximumAdjacentFieldChange<.025,'nearby follicles must share a slowly varying groom field');
for(let i=-8;i<=8;i++)for(let j=0;j<9;j++){
  const x=i*p.correlationM,y=1.429+j*p.correlationM*1.32;
  assert(Math.abs(api.field(x-1e-8,y+.002,p.seed,1)-api.field(x+1e-8,y+.002,p.seed,1))<1e-5,'groom direction must not jump at lattice boundaries');
  assert(Math.abs(api.field(x+.002,y-1e-8,p.seed,1)-api.field(x+.002,y+1e-8,p.seed,1))<1e-5,'groom direction must not jump at lattice boundaries');
}
const stride=(p.segments+1)*p.sides*3,retained=new Set();
for(let i=0;i<first.positions.length;i+=stride)retained.add(JSON.stringify(first.positions.slice(i,i+stride)));
const thinned=api.generate(surface,{...options,density:.50});
assert(thinned.report.strands<first.report.strands,'density change must thin the groom');
for(let i=0;i<thinned.positions.length;i+=stride)assert(retained.has(JSON.stringify(thinned.positions.slice(i,i+stride))),'retained fibres must not change when density changes');
const failures=[],reports=[];
function inspect(label,m,report){
  const P=m.positions,N=m.normals,I=m.indices,vertices=P.length/3;
  assert(vertices<=65535&&vertices===report.vertices,'groom must fit Uint16 indices');
  assert.equal(N.length,vertices*2,'every vertex must have an octahedral normal');
  assert(P.every(Number.isFinite)&&N.every(Number.isFinite),'positions and normals must be finite');
  assert(I.every(i=>Number.isInteger(i)&&i>=0&&i<vertices),'all triangle indices must be valid');
  assert(report.strands<p.maxStrands,'default density must not reach the row-ordered cap and truncate upper hairs');
  assert(report.triangles<=85000,'default layered groom must stay close to the former 77k triangle budget');
  const regionTotal=Object.values(report.regionCounts).reduce((a,b)=>a+b,0);
  assert.equal(regionTotal,report.strands,'regional strand accounting must agree');
  for(const [region,count]of Object.entries(report.regionCounts))assert(count>report.strands*.05&&count<report.strands*.70,'missing or dominant region '+region);
  assert(report.layerCounts.fine>report.strands*.70&&report.layerCounts.fine<report.strands*.85,'short fine fibres must dominate with a smaller guide layer');
  assert.equal(report.layerCounts.fine+report.layerCounts.guide,report.strands,'layer accounting must agree');
  const decode=i=>{let x=N[i*2]/32767,y=N[i*2+1]/32767,z=1-Math.abs(x)-Math.abs(y);if(z<0){const old=x;x=(1-Math.abs(y))*(old<0?-1:1);y=(1-Math.abs(old))*(y<0?-1:1);}return norm([x,y,z]);};
  let minimumArea=Infinity,minimumNormalDot=Infinity;
  for(let k=0;k<I.length;k+=3){
    const ids=Array.from(I.slice(k,k+3)),q=ids.map(i=>Array.from(P.slice(i*3,i*3+3))),c=cross(sub(q[1],q[0]),sub(q[2],q[0])),length=Math.hypot(...c);
    minimumArea=Math.min(minimumArea,length*.5);assert(length>1e-13,'collapsed fibre triangle');
    const average=norm(ids.reduce((n,i)=>add(n,decode(i)),[0,0,0])),dot=c.reduce((sum,v,j)=>sum+v*average[j],0)/length;
    minimumNormalDot=Math.min(minimumNormalDot,dot);assert(dot>0,'fibre winding opposes encoded normals');
  }
  const verticesPerStrand=(p.segments+1)*p.sides;
  let redLipVertices=0,redLipTipVertices=0,redLipStrands=new Set(),minimumTipClearance=Infinity,lowest=Infinity,highest=-Infinity;
  const examples=[];
  for(let i=0;i<vertices;i++){
    const x=P[i*3],y=P[i*3+1],strand=Math.floor(i/verticesPerStrand),tip=i%verticesPerStrand>=p.segments*p.sides;
    lowest=Math.min(lowest,y);highest=Math.max(highest,y);
    if(Math.abs(x-api.lip.centreX)>api.lip.halfWidth)continue;
    const lip=api.outline(x),clearance=Math.max(y-lip.top,lip.bottom-y);
    if(tip)minimumTipClearance=Math.min(minimumTipClearance,clearance);
    if(clearance<0){redLipVertices++;if(tip)redLipTipVertices++;redLipStrands.add(strand);if(examples.length<4)examples.push({strand,x,y,penetrationM:-clearance,tip});}
  }
  assert(lowest>1.4275&&highest<1.500,'groom escaped its lower-face region');
  if(redLipVertices)failures.push(label+': '+redLipVertices+' vertices ('+redLipTipVertices+' tips) from '+redLipStrands.size+' fibres cross the production red-lip boundary');
  reports.push({label,...report,minimumTriangleAreaM2:minimumArea,minimumNormalDot,yRange:[lowest,highest],redLipVertices,redLipTipVertices,redLipStrands:redLipStrands.size,minimumTipClearanceM:minimumTipClearance,examples});
}
inspect('curved-fixture',first,first.report);
inspect('second-seed-fixture',other,other.report);
if(process.argv.includes('--production')){
  const [{decodeCompactHuman},{sampleCompactGroup,smoothAndQuantize},{createCompactNormalField},{CanonicalTopology}]=await Promise.all([
    import('../reconstruction/codec.mjs'),import('../reconstruction/mesher.mjs'),import('../reconstruction/normal-field.mjs'),import('../reconstruction/topology.mjs')]);
  const load=async name=>(await decodeCompactHuman(readFileSync(new URL('../reconstruction/'+name+'.chf.gz',import.meta.url)))).data;
  const [detail,normalData]=await Promise.all([load('detail'),load('normal-field')]);
  const field=createCompactNormalField(normalData),topology=new CanonicalTopology(JSON.parse(read('reconstruction/rig-reference.json')));
  const sampled=await sampleCompactGroup('detail',detail,'balanced',()=>{},field,JSON.parse(read('reconstruction/binding-schema.json')),topology);
  const settled=topology.finalize(sampled.meshes),source=smoothAndQuantize(settled.meshes.map(m=>topology.materialize(m)),field).meshes.map(m=>({...m,canonicalPositions:m.positions}));
  const face=api.create(source,{jointIds:new Map([['head',7]])},1),beard=face.meshes.find(m=>m.name==='faceBeard');
  assert(beard,'production face must include its procedural beard');
  inspect('production-neutral', {...beard,positions:beard.canonicalPositions},face.report.beard);
}
console.log(JSON.stringify({deterministic:true,distinctSeed:true,zeroDensity:true,stableThinning:true,maximumAdjacentFieldChange,reports,failures,visualAcceptance:false},null,2));
assert.equal(failures.length,0,failures.join('; '));
