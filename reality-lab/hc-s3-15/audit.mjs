/** Read-only source-surface audit. No solver, normal edits or source writes. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {MeshContact} from './_runtime/mesh-contact.mjs';
import {triangleCrossing} from './_runtime/contact-probe.mjs';
export const PIN={
 'baseline-step30.json':'bf574d265e7a53b7de69accd5722f35d622b7f6e170f14797f888e451f7b9a7b',
 'guarded-step30.json':'602056e688b040b58d99d103422031bf3bc44907e37e1dbf636e08a3939622a3',
 'guarded-step102.json':'8c5a9a04693d2e864cdd1913bd45bd37bec5d485dc6d9a9bfb7d48a1af24de7f'};
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
export const sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const point=(p,i)=>Array.from(p.subarray(i*3,i*3+3));
const triangle=(p,F,f)=>[point(p,F[f]),point(p,F[f+1]),point(p,F[f+2])];
const unit=a=>{const n=Math.hypot(...a);return n>1e-15?a.map(x=>x/n):[0,0,0];};
function segment(p,a,b){const e=sub(b,a),den=dot(e,e),t=den>0?Math.max(0,Math.min(1,dot(sub(p,a),e)/den)):0;return a.map((v,k)=>v+t*e[k]);}
/** Independent Voronoi-region closest point (not the source projection/clamp routine). */
export function closestIndependent(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
 if(dot(cross(ab,ac),cross(ab,ac))<1e-30){const q=[segment(p,a,b),segment(p,b,c),segment(p,c,a)];return q.sort((x,y)=>dot(sub(p,x),sub(p,x))-dot(sub(p,y),sub(p,y)))[0];}
 if(d1<=0&&d2<=0)return [...a];
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return [...b];
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const t=d1/(d1-d3);return a.map((v,k)=>v+t*ab[k]);}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return [...c];
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const t=d2/(d2-d6);return a.map((v,k)=>v+t*ac[k]);}
 const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const t=(d4-d3)/((d4-d3)+(d5-d6));return b.map((v,k)=>v+t*(c[k]-b[k]));}
 const den=1/(va+vb+vc),v=vb*den,w=vc*den;return a.map((x,k)=>x+v*ab[k]+w*ac[k]);
}
export function winding(query,p,F){let sum=0,comp=0;for(let off=0;off<F.length;off+=3){const [a,b,c]=triangle(p,F,off).map(x=>sub(x,query)),la=Math.hypot(...a),lb=Math.hypot(...b),lc=Math.hypot(...c);if(Math.min(la,lb,lc)<1e-14)return null;const term=2*Math.atan2(dot(a,cross(b,c)),la*lb*lc+dot(a,b)*lc+dot(b,c)*la+dot(c,a)*lb),y=term-comp,t=sum+y;comp=(t-sum)-y;sum=t;}return sum/(4*Math.PI);}
export function topology(p,F){
 const N=p.length/3,parents=Int32Array.from({length:N},(_,i)=>i),rank=new Uint8Array(N),find=x=>{while(parents[x]!==x){parents[x]=parents[parents[x]];x=parents[x];}return x;},join=(a,b)=>{a=find(a);b=find(b);if(a===b)return;if(rank[a]<rank[b])[a,b]=[b,a];parents[b]=a;if(rank[a]===rank[b])rank[a]++;},edges=new Map();
 for(let f=0;f<F.length;f+=3)for(let k=0;k<3;k++){const a=F[f+k],b=F[f+(k+1)%3];join(a,b);const key=Math.min(a,b)+':'+Math.max(a,b);if(!edges.has(key))edges.set(key,[]);edges.get(key).push({face:f,direction:a<b?1:-1});}
 const groups=new Map();for(let f=0;f<F.length;f+=3){const root=find(F[f]);if(!groups.has(root))groups.set(root,{root,faceOffsets:[],boundaryEdges:0,nonmanifoldEdges:0,inconsistentEdges:0});groups.get(root).faceOffsets.push(f);}
 for(const [key,uses] of edges){const g=groups.get(find(Number(key.split(':')[0])));if(uses.length===1)g.boundaryEdges++;if(uses.length>2)g.nonmanifoldEdges++;if(uses.length===2&&uses[0].direction===uses[1].direction)g.inconsistentEdges++;}
 const sorted=[...groups.values()].sort((a,b)=>b.faceOffsets.length-a.faceOffsets.length),faceComponent=new Map();const summaries=sorted.map((g,i)=>{for(const f of g.faceOffsets)faceComponent.set(f,i);return{id:i,triangles:g.faceOffsets.length,boundaryEdges:g.boundaryEdges,nonmanifoldEdges:g.nonmanifoldEdges,inconsistentEdges:g.inconsistentEdges,indexClosed:g.boundaryEdges===0&&g.nonmanifoldEdges===0,consistentlyOriented:g.inconsistentEdges===0};});
 return{summaries,faceComponent,mainFaces:Int32Array.from(sorted[0].faceOffsets.flatMap(f=>[F[f],F[f+1],F[f+2]]))};
}
function candidates(surface,t){const lo=[0,1,2].map(k=>Math.min(...t.map(p=>p[k]))-1e-10),hi=[0,1,2].map(k=>Math.max(...t.map(p=>p[k]))+1e-10),out=[],stack=[0];while(stack.length){const n=surface.nodes[stack.pop()];if(lo.some((v,k)=>n.box[k]>hi[k]||n.box[k+3]<v))continue;if(n.left>=0)stack.push(n.left,n.right);else for(let i=n.lo;i<n.hi;i++)out.push(surface.tri[i]);}return out;}
function bodyCrossings(surface,selectedFaces,topo){const pairs=new Map();for(const f of selectedFaces){const ids=Array.from(surface.faces.subarray(f,f+3)),t=triangle(surface.p,surface.faces,f);for(const other of candidates(surface,t)){if(other===f||Array.from(surface.faces.subarray(other,other+3)).some(x=>ids.includes(x)))continue;const a=Math.min(f,other),b=Math.max(f,other),key=a+':'+b;if(pairs.has(key))continue;const ta=triangle(surface.p,surface.faces,a),tb=triangle(surface.p,surface.faces,b),hit=triangleCrossing(ta,tb);if(hit)pairs.set(key,{key,a,b,aIds:Array.from(surface.faces.subarray(a,a+3)),bIds:Array.from(surface.faces.subarray(b,b+3)),sameComponent:topo.faceComponent.get(a)===topo.faceComponent.get(b),component:topo.faceComponent.get(a),aTriangle:ta,bTriangle:tb,hit,exactVerified:false});}}return [...pairs.values()].sort((a,b)=>a.a-b.a||a.b-b.b);}
export function modelGate({nearestVerified,exactCrossings,positiveLocalInsideCount}){if(!nearestVerified)return{status:'QUERY_UNVERIFIED',solveAllowed:false,contactCertified:false};if(exactCrossings>0)return{status:'BODY_SURFACE_SELF_INTERSECTION',solveAllowed:false,contactCertified:false};if(positiveLocalInsideCount>0)return{status:'LOCAL_SIGN_UNRESOLVED',solveAllowed:false,contactCertified:false};return{status:'NO_LOCAL_FAILURE_FOUND_NOT_CERTIFIED',solveAllowed:false,contactCertified:false};}
export function auditOne(f,c){
 const original=JSON.stringify(f),P=Float64Array.from(f.body.positions),F=Int32Array.from(f.body.faces),surface=new MeshContact(P,F),topo=topology(P,F),rows=[],selectedFaces=new Set();
 for(const row of c.rows){
  const face=surface.nearest(...row.point),nearest=Array.from(surface.best),native=Array.from(surface.evaluate(face,...row.point)),t=triangle(P,F,face),normal=unit(cross(sub(t[1],t[0]),sub(t[2],t[0]))),smooth=unit([0,1,2].map(k=>[0,1,2].reduce((s,j)=>s+surface.normals[F[face+j]*3+k]*nearest[4+j],0)));
  let bruteD=Infinity,bruteFace=-1,brutePoint;for(let off=0;off<F.length;off+=3){const q=closestIndependent(row.point,...triangle(P,F,off)),d=dot(sub(row.point,q),sub(row.point,q));if(d<bruteD){bruteD=d;bruteFace=off;brutePoint=q;}}
  selectedFaces.add(face);const witnessFace=row.id.startsWith('x')?Number(row.id.split(':')[1]):null;if(witnessFace!==null)selectedFaces.add(witnessFace);
  const reconstructed=[0,1,2].map(k=>row.ids.reduce((s,id,i)=>s+f.cloth.positions[id*3+k]*row.weights[i],0)),originError=Math.hypot(...sub(reconstructed,row.point));
  const offsets=[-.005,-.001,-.0001,-.00001,0,.00001,.0001,.001,.005];
  const probes=offsets.map(offset=>{const q=row.point.map((x,k)=>x+normal[k]*offset),v=Array.from(surface.sample(...q)),nf=surface.nearest(...q),dist=Math.sqrt(surface.best[0]);const w=dist>1e-9?winding(q,P,topo.mainFaces):null;return{offsetM:offset,point:q,distanceM:v[0],queryNormal:v.slice(1),nearestFace:nf,mainWinding:w,side:w===null?'ON_SURFACE_UNCLASSIFIED':Math.abs(w)<1e-5?'OUTSIDE_MAIN_WINDING':Math.abs(w-1)<1e-5?'ONE_LAYER':Math.abs(w-2)<1e-5?'TWO_LAYERS':'NONINTEGER_UNRESOLVED',positiveLocalInside:w!==null&&v[0]>1e-9&&w>.5};});
  const nativeMatch=Math.abs(native[0]-row.distanceM)<1e-10&&Math.hypot(...sub(native.slice(1),row.normal))<1e-6;
  rows.push({id:row.id,ids:row.ids,weights:row.weights,point:row.point,certificateNormal:row.normal,certificateDistanceM:row.distanceM,witnessFace,nativeFace:face,nearestPoint:nearest.slice(1,4),barycentric:nearest.slice(4),unsignedDistanceM:Math.sqrt(nearest[0]),nativeDistanceM:native[0],nativeNormal:native.slice(1),faceNormal:normal,smoothNormal:smooth,faceSmoothDot:dot(normal,smooth),originErrorM:originError,nativeMatchesStoredRow:nativeMatch,independent:{face:bruteFace,point:brutePoint,distanceM:Math.sqrt(bruteD),distanceErrorM:Math.abs(Math.sqrt(bruteD)-Math.sqrt(nearest[0]))},component:topo.faceComponent.get(face),probes});
 }
 const selfIntersections=bodyCrossings(surface,selectedFaces,topo),show=new Set(selectedFaces);for(const r of selfIntersections){show.add(r.a);show.add(r.b);}
 for(const off of [...selectedFaces])for(let j=0;j<F.length;j+=3)if([F[j],F[j+1],F[j+2]].some(n=>[F[off],F[off+1],F[off+2]].includes(n)))show.add(j);
 const clothFaces=[...new Set(c.rows.filter(r=>r.id.startsWith('x')).map(r=>Number(r.id.slice(1).split(':')[0])))];
 const out={fixture:c.fixture,step:f.step,bodyVertices:P.length/3,bodyTriangles:F.length/3,topology:topo.summaries,rows,selfIntersections,intersectionCoverage:'nonadjacent body pairs touching selected nearest or source-witness faces only; not exhaustive body self-intersection count',geometry:{body:[...show].sort((a,b)=>a-b).map(off=>({faceOffset:off,component:topo.faceComponent.get(off),ids:Array.from(F.subarray(off,off+3)),triangle:triangle(P,F,off)})),cloth:clothFaces.map(off=>({faceOffset:off,ids:f.cloth.faces.slice(off,off+3),triangle:f.cloth.faces.slice(off,off+3).map(id=>f.cloth.positions.slice(id*3,id*3+3))}))},inputUnchanged:JSON.stringify(f)===original,solverExecuted:false,sourceWritten:false};
 if(!out.inputUnchanged)throw Error('SOURCE_MUTATED');return out;
}
export function run(fixtureDir,certPath,destination){
 const certBytes=fs.readFileSync(certPath);if(sha(certBytes)!=='cd5b506b7cd34b8662f8af463531284dd41d57d4f5262a11f699d328ab3668d9')throw Error('CERTIFICATE_PIN');const certs=JSON.parse(certBytes).certificates.filter(c=>!c.includesLinearizedShape);
 const output={schema:'kaopu/contact-surface-audit@1',version:'RF01-S3.15',baseCommit:'79bb242cdf460ccf8fcd17b742041737a114e872',fixtureRun:'39570430770',nativeHostCommit:'c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49',meshContactSHA256:sha(fs.readFileSync(new URL('./_runtime/mesh-contact.mjs',import.meta.url))),certificateSHA256:sha(certBytes),cases:[],sourceWritten:false,solverExecuted:false,newMotionExecuted:false,fitCertified:false,globalNonlinearInfeasibilityProved:false,live:false};
 if(output.meshContactSHA256!=='0fe9b8e0840c7b35c4ee3fce9b7d648c220043783ad6166314812472ddde8ff3')throw Error('QUERY_SOURCE_PIN');
 for(const c of certs){const bytes=fs.readFileSync(fixtureDir+'/'+c.fixture);if(sha(bytes)!==PIN[c.fixture])throw Error('FIXTURE_PIN');const f=JSON.parse(bytes),result=auditOne(f,c);result.fixtureSHA256=sha(bytes);output.cases.push(result);console.log(c.fixture,'rows',result.rows.length,'bodyCrossings',result.selfIntersections.length,'positive-local-inside',result.rows.reduce((n,r)=>n+r.probes.filter(p=>p.positiveLocalInside).length,0));}
 fs.writeFileSync(destination,JSON.stringify(output,null,2));return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run(...process.argv.slice(2));
