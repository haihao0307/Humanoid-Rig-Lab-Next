// Read-only, targeted R13 diagnostic. No source, manifests, or build artifacts are written.
// Run: node /tmp/shoe-r14-bend-diagnostic.mjs /workspace/scratch/e3aba5d62e5a/shoe-project/shoe-workshop/r13 > /tmp/shoe-r14-bend-diagnostic.json
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root=path.resolve(process.argv[2]??'/workspace/scratch/e3aba5d62e5a/shoe-project/shoe-workshop/r13');
const {buildStyle}=await import(pathToFileURL(path.join(root,'src/model.mjs')));
const {bendGeometry}=await import(pathToFileURL(path.join(root,'src/kernel.mjs')));
const hash=b=>createHash('sha256').update(b).digest('hex');
const arrHash=a=>hash(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
const at=(g,key,i)=>{const a=g.attributes[key];return [a.getX(i),a.getY(i),a.getZ(i)];};
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const norm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
const angleDeg=(a,b)=>Math.acos(Math.max(-1,Math.min(1,norm(a).reduce((s,v,i)=>s+v*norm(b)[i],0))))*180/Math.PI;
const readHead=()=>{
  // Metadata only. Read Git references directly: this diagnostic spawns no subprocesses.
  try {
    const git=path.resolve(root,'../../.git'),head=fs.readFileSync(path.join(git,'HEAD'),'utf8').trim();
    if(!head.startsWith('ref: '))return head;
    const ref=head.slice(5),loose=path.join(git,ref);
    if(fs.existsSync(loose))return fs.readFileSync(loose,'utf8').trim();
    const match=fs.readFileSync(path.join(git,'packed-refs'),'utf8').split('\n').find(line=>line.endsWith(' '+ref));
    return match?.split(' ')[0]??null;
  }catch{return null;}
};

function circularRim(g,h,row,role,nominalRadiusMm){
  // eyelet() in monk-canvas.mjs: 7 profile rows, each 25 vertices, 24 segments.
  // The 25th vertex duplicates the first; it is excluded from the 12 opposite pairs.
  const pairs=Array.from({length:12},(_,i)=>{
    const indices=[row*25+i,row*25+i+12],before=indices.map(i=>at(g,'position',i)),after=indices.map(i=>at(h,'position',i));
    return {indices,anglesDeg:[i*15,i*15+180],beforeVerticesMm:before,afterVerticesMm:after,beforeChordMm:distance(...before),afterChordMm:distance(...after)};
  });
  const min=pairs.reduce((a,b)=>a.afterChordMm<b.afterChordMm?a:b);
  return {role,profileRow:row,ringStartIndex:row*25,ringUniqueVertices:24,nominalRadiusMm,nominalDiameterMm:nominalRadiusMm*2,
    measurement:'3D chord between rest-rim antipodes; minimum of 12 samples, not a fitted ellipse or calibrated clear-bore measurement',
    beforeChordRangeMm:[Math.min(...pairs.map(p=>p.beforeChordMm)),Math.max(...pairs.map(p=>p.beforeChordMm))],
    afterChordRangeMm:[Math.min(...pairs.map(p=>p.afterChordMm)),Math.max(...pairs.map(p=>p.afterChordMm))],
    minimumPair:min,oppositePairSamples:pairs};
}

function diagnose(p,last){
  const g=p.geometry,h=g.clone();bendGeometry(h,last,30);
  const L=last.L,axis=L*.13,band=L*.09,base=last.soleTop(.63),theta=Math.PI/6;
  let minEdgeRatio=Infinity,maxEdgeRatio=0,maxEdgeChange=0,worstEdge=null,maxDisplacement=0,changedVertices=0,transitionVertices=0,minDet=Infinity,maxNormalError=0,worstNormal=null;
  const edges=new Set();
  for(let k=0;k<g.index.count;k+=3)for(let j=0;j<3;j++){const a=g.index.array[k+j],b=g.index.array[k+(j+1)%3];edges.add(Math.min(a,b)+','+Math.max(a,b));}
  let measuredEdges=0;
  for(const key of edges){
    const ids=key.split(',').map(Number),before=ids.map(i=>at(g,'position',i)),after=ids.map(i=>at(h,'position',i)),d0=distance(...before),d1=distance(...after);
    if(d0<1e-4)continue;measuredEdges++;const r=d1/d0;
    if(r<minEdgeRatio){minEdgeRatio=r;worstEdge={indices:ids,beforeVerticesMm:before,afterVerticesMm:after,beforeLengthMm:d0,afterLengthMm:d1,ratio:r};}
    maxEdgeRatio=Math.max(maxEdgeRatio,r);maxEdgeChange=Math.max(maxEdgeChange,Math.abs(d1-d0));
  }
  for(let i=0;i<g.attributes.position.count;i++){
    const P=at(g,'position',i),Q=at(h,'position',i),d=distance(P,Q);if(d!==0)changedVertices++;maxDisplacement=Math.max(maxDisplacement,d);
    const u=Math.max(0,Math.min(1,(P[2]-(axis-band))/(2*band))),phi=theta*u*u*(3-2*u),dp=theta*6*u*(1-u)/(2*band),c=Math.cos(phi),s=Math.sin(phi),v=P[1]-base,w=P[2]-axis;
    const Y=v*c+w*s,Z=w*c-v*s,B=s+dp*Z,D=c-dp*Y,det=1-dp*v;
    minDet=Math.min(minDet,det);if(u>0&&u<1)transitionVertices++;
    // Exact differential J: x row [1,0,0]; yz rows [c,B],[-s,D].
    // Its inverse transpose, not rotation alone, transports a smooth surface normal.
    const n0=at(g,'normal',i),actual=norm(at(h,'normal',i)),expected=norm([n0[0],(D*n0[1]+s*n0[2])/det,(-B*n0[1]+c*n0[2])/det]);
    const error=angleDeg(expected,actual);
    if(error>maxNormalError){maxNormalError=error;worstNormal={index:i,beforeVertexMm:P,afterVertexMm:Q,beforeNormal:n0,actualAfterNormal:actual,expectedDifferentialNormal:expected,errorDeg:error,phiRadians:phi,phiDerivativeRadiansPerMm:dp,jacobian:[[1,0,0],[0,c,B],[0,-s,D]],determinant:det};}
  }
  const o={partId:p.id,kind:p.kind,vertexCount:g.attributes.position.count,restZRangeMm:[g.boundingBox.min.z,g.boundingBox.max.z],restSRange:[g.boundingBox.min.z/L+.5,g.boundingBox.max.z/L+.5],transitionVertices,
    positionsByteIdentical:arrHash(g.attributes.position.array)===arrHash(h.attributes.position.array),normalsByteIdentical:arrHash(g.attributes.normal.array)===arrHash(h.attributes.normal.array),changedVertices,maxDisplacementMm:maxDisplacement,
    edgeMetric:{uniqueIndexEdges:edges.size,measuredEdges,omittedRestEdgesShorterThanMm:1e-4,minLengthRatio:minEdgeRatio,maxLengthRatio:maxEdgeRatio,maxAbsoluteChangeMm:maxEdgeChange,minimumRatioEdge:worstEdge},
    minimumJacobianDeterminant:minDet,maxSmoothNormalTransportErrorDeg:maxNormalError,worstNormal,
    positionSha256:{before:arrHash(g.attributes.position.array),after:arrHash(h.attributes.position.array)}};
  if(p.kind==='eyelet'){
    const changed=o.changedVertices>0;
    o.boreRims=[circularRim(g,h,0,'upper inner bore lip, profile [2.15,+0.30]',2.15),circularRim(g,h,6,'lower inner sleeve rim, profile [2.15,-sleeveDepth]',2.15)];
    o.outerFlangeContrast=circularRim(g,h,2,'outer flange, profile [3.40,+0.25]; NOT bore',3.4);
    if(!changed){for(const r of [...o.boreRims,o.outerFlangeContrast])delete r.oppositePairSamples;}
  }
  h.dispose();return o;
}

const output={diagnostic:'R13 existing geometric bend / rigid hardware and normal transport',readOnly:true,fullTestSuiteRun:false,
  generatedAtUtc:new Date().toISOString(),runtime:{node:process.version,v8:process.versions.v8},sourceRoot:root,
  sourceHead:readHead(),
  sourceHashes:Object.fromEntries(['src/model.mjs','src/kernel.mjs','src/monk-canvas.mjs'].map(p=>[p,hash(fs.readFileSync(path.join(root,p)))])),
  method:'Build each default rest model once. Clone only selected real BufferGeometries and call the exact existing bendGeometry(clone,last,30). All other parameters remain at default. No renderer or physical solver is involved.',
  limits:['Only default shoe parameters and bend 0 / 30 degrees are measured.','Rigid metal treatment is a design constraint; no real material strength or wearer-fit claims.','Normal comparison is exact smooth deformation differential versus stored normal; not rendered pixels or triangle-normal fitting.','Antipodal chord samples identify geometric distortion; they do not certify a manufactured hole size.'],
  styles:[]};
for(const id of ['canvas','monk']){
  const m=buildStyle(id),parts=m.parts.filter(p=>p.kind==='eyelet'||p.kind==='buckle'||p.id==='canvas-rounded-vamp');
  output.styles.push({styleId:id,params:m.last.params,Lmm:m.last.L,transitionS:[.54,.72],transitionZMm:[m.last.L*.04,m.last.L*.22],parts:parts.map(p=>diagnose(p,m.last))});
  m.parts.forEach(p=>p.geometry.dispose());
}
console.log(JSON.stringify(output,null,2));
