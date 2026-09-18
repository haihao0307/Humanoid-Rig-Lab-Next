/** Adaptive display sampling. Indices/vertices are created only in memory. */
import earcut from './vendor/earcut.js';
import {createCompactSurface,cranialInterfaceCollarWidth} from './surface-kernel.mjs';
import {conformTrimFaces,registerRadialBoundary} from './topology.mjs';
import {improveTrimQuality} from './trim-quality.mjs';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const mix=(a,b,t)=>a.map((x,k)=>x+(b[k]-x)*t);
// Source-chart degeneracy must be tested in parameter space. A collinear UV
// sliver can have a large 3D chord area on a curved boundary, and refining it
// registers mutually nested edge splits. Match the 1 nm canonical weld scale.
export function usableParameterTriangle(a,b,c){
  const ux=b[0]-a[0],uy=b[1]-a[1],vx=c[0]-a[0],vy=c[1]-a[1];
  return Math.abs(ux*vy-uy*vx)>1e-9*Math.max(Math.hypot(ux,uy),Math.hypot(vx,vy),Math.hypot(vx-ux,vy-uy));
}
export function longestParameterEdge(uv){
  const lengths=uv.map((p,i)=>Math.hypot(p[0]-uv[(i+1)%3][0],p[1]-uv[(i+1)%3][1]));
  return lengths.indexOf(Math.max(...lengths));
}

// Bisection preserves an earcut fan's poor aspect ratio. After this tiny
// cranial collar has acquired interior samples, improve only its interior
// diagonals. No source position, trim knot, hole or binding identity moves.
export function improveSampledCollarTriangles(indices,point,axes){
  const ids=[...new Set(indices)],local=new Map(ids.map((id,i)=>[id,i])),uv=ids.map(id=>axes.map(k=>point(id)[k]));
  let faces=[];for(let i=0;i<indices.length;i+=3)faces.push(indices.slice(i,i+3).map(id=>local.get(id)));
  faces=conformTrimFaces(uv,faces);let flips=0,rounds=0;
  for(;rounds<16;rounds++){const changed=improveTrimQuality(uv,faces);flips+=changed;if(!changed){rounds++;break;}}
  return {indices:faces.flatMap(face=>face.map(i=>ids[i])),flips,rounds};
}
export function canonicalRadialParameter(t){
  // Inverting a canonical seam point may produce 1 + one binary ULP. Snap
  // only arithmetic roundoff; real out-of-domain values still reach the
  // radial kernel's strict check. The canonical 3D point is never moved.
  return Math.abs(t)>1&&Math.abs(t)-1<=8*Number.EPSILON?Math.sign(t):t;
}
export const QUALITY={
  preview:{positionTolerance:.00025,boundaryTolerance:0,maxEdgeBody:.035,maxEdgeDetail:.012,maxEdgeFeatures:.005,normalAngleDegrees:10,normalMinimumEdge:.0007},
  interactive:{positionTolerance:.00025,boundaryTolerance:0,maxEdgeBody:.035,maxEdgeDetail:.012,maxEdgeFeatures:.005,normalAngleDegrees:10,normalMinimumEdge:.0007},
  close:{positionTolerance:.00005,boundaryTolerance:0,maxEdgeBody:.012,maxEdgeDetail:.006,maxEdgeFeatures:.003},
  balanced:{positionTolerance:.00010,boundaryTolerance:0,maxEdgeBody:.020,maxEdgeDetail:.009,maxEdgeFeatures:.004},
  small:{positionTolerance:.00020,boundaryTolerance:0,maxEdgeBody:.030,maxEdgeDetail:.013,maxEdgeFeatures:.006}
};
// Display work is finite even when local error tests never converge. Divide
// the budget across all charts so early regions cannot consume the whole body.
const REFINEMENT_BUDGET={body:24000,left:8000,detail:40000,features:16000,collar:2000};
// Height-chart silhouettes and shading need a usable first frame. Keep these
// quotas explicit: multiplying the startup repair again in close mode would
// exceed the existing allocation guards. All other groups keep their quotas.
const SKIN_REFINEMENT_BUDGET={
  // Reserve final shared-edge conformity headroom for the finer face/features.
  // Their close-view tolerances remain unchanged; global allocation guards stay on.
  body:{preview:108000,interactive:108000,balanced:90000,small:72000,close:144000},
  left:{preview:36000,interactive:36000,balanced:30000,small:24000,close:48000}
};

// Bound total work while giving a broad torso/limb chart more samples than a
// tiny trim patch. A uniform quarter keeps small anatomical patches represented;
// the remaining quota follows projected source area with a sublinear weight.
export function allocateChartRefinementBudget(domains,total){
  if(!Number.isSafeInteger(total)||total<0)throw Error('Invalid chart refinement budget');
  const count=domains.length,result=new Uint32Array(count);if(!count)return result;
  const areas=domains.map(c=>{const [lo,hi]=c.uvBoundsMetres;
    return Math.pow(Math.max(0,(hi[0]-lo[0])*(hi[1]-lo[1])),.75);});
  const sum=areas.reduce((s,x)=>s+x,0),remainders=[];let assigned=0;
  for(let i=0;i<count;i++){const exact=total*(.25/count+.75*(sum?areas[i]/sum:1/count)),whole=Math.floor(exact);
    result[i]=whole;assigned+=whole;remainders.push({i,fraction:exact-whole,id:domains[i].id});}
  remainders.sort((a,b)=>b.fraction-a.fraction||a.id-b.id);
  for(let i=0;i<total-assigned;i++)result[remainders[i].i]++;
  return result;
}

// Stable max heap: a tiny, early trim triangle must not consume the chart's
// whole quota while centimetre-scale errors on later faces are left untouched.
export class SurfaceRefinementQueue{
  constructor(){this.items=[];this.serial=0;}
  get length(){return this.items.length;}
  before(a,b){return a.priority>b.priority||(a.priority===b.priority&&a.serial<b.serial);}
  push(value,priority){const item={value,priority,serial:this.serial++},items=this.items;let at=items.length;items.push(item);
    while(at){const parent=(at-1)>>>1;if(!this.before(item,items[parent]))break;items[at]=items[parent];at=parent;}items[at]=item;}
  pop(){const items=this.items,first=items[0],last=items.pop();if(items.length){let at=0;
      while(at*2+1<items.length){let next=at*2+1;if(next+1<items.length&&this.before(items[next+1],items[next]))next++;
        if(!this.before(items[next],last))break;items[at]=items[next];at=next;}items[at]=last;}return first.value;}
}

class Builder{
  constructor(name,topology){this.name=name;this.topology=topology;this.indices=[];this.used=new Set();}
  vertex(v){const id=v.id??=this.topology.vertex(this.name,v);this.topology.masks[id]|=v.regionMask;this.used.add(id);return id;}
  triangle(a,b,c,orientation=null){const u=b.p.map((x,k)=>x-a.p[k]),v=c.p.map((x,k)=>x-a.p[k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    // A local derivative can oppose a coarse triangle's chord normal. The
    // chart's outward axis defines winding even at a steep boundary correction.
    const outward=orientation||a.n;
    if(Math.hypot(...n)<1e-20)return;if(n.reduce((s,x,k)=>s+x*outward[k],0)<0)[b,c]=[c,b];
    const i=this.vertex(a),j=this.vertex(b),k=this.vertex(c);if(i!==j&&j!==k&&k!==i){this.topology.claimTriangle();this.indices.push(i,j,k);}}
  finish(){const result={name:this.name,indices:Uint32Array.from(this.indices),vertices:this.used.size};this.used.clear();this.indices=null;return result;}
}

function loopsArea(loops){return loops.map(loop=>{let a=0;for(let i=0;i<loop.length;i++){const p=loop[i],q=loop[(i+1)%loop.length];a+=p[0]*q[1]-q[0]*p[1];}return a/2;});}
export function properCrossings(loops){
  const all=loops.flatMap((l,li)=>l.map((a,i)=>({a,b:l[(i+1)%l.length],li,i,n:l.length}))),orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
    const p=all[i],q=all[j];if(p.li===q.li&&(Math.abs(p.i-q.i)===1||Math.abs(p.i-q.i)===p.n-1))continue;
    if(Math.max(p.a[0],p.b[0])<Math.min(q.a[0],q.b[0])||Math.max(q.a[0],q.b[0])<Math.min(p.a[0],p.b[0])||Math.max(p.a[1],p.b[1])<Math.min(q.a[1],q.b[1])||Math.max(q.a[1],q.b[1])<Math.min(p.a[1],p.b[1]))continue;
    const a=orient(p.a,p.b,q.a),b=orient(p.a,p.b,q.b),c=orient(q.a,q.b,p.a),d=orient(q.a,q.b,p.b);
    if(a*b<0&&c*d<0)return true;
  }return false;
}

export async function sampleCompactGroup(name,data,quality='balanced',progress=()=>{},normalField=null,bindingSchema,topology,surfaceCorrections=[]){
  if(!topology)throw Error('A shared canonical topology is required');
  const settings=QUALITY[quality];if(!settings)throw Error('Unknown display quality');
  const repairSkin=name==='body'||name==='left'||name==='collar';
  const surface=createCompactSurface(data,{boundaryTolerance:settings.boundaryTolerance,normalField}),builders=new Map();
  const builder=n=>{if(!builders.has(n))builders.set(n,new Builder(n,topology));return builders.get(n);};
  const stats={name,quality,domains:surface.domainIds.length,evaluations:0,acceptedTriangleProbes:0,maximumSampledInterpolationError:0,
    refinementLimitCount:0,exactBoundaryFallbacks:0,maximumBoundaryApproximation:settings.boundaryTolerance,geometryRepresentation:'function-generated in memory',unresolvedWorst:[],normalRefinementSplits:0,
    refinementOrder:'maximum-normalized-error',winding:'height-chart-outward-axis; radial-surface-derivative',
    displayRefinement:'r21-parameter-longest-edge',trimQualityFlips:0,parameterLongestEdgeSplits:0,errorDirectedEdgeSplits:0,geometricNormalRefinements:0,reusedChartBudget:0};
  const maxEdge=name==='features'?settings.maxEdgeFeatures:name==='detail'?settings.maxEdgeDetail:settings.maxEdgeBody;
  // Face/hand detail retains its startup quota, including separately reserved
  // facial animation samples. Broad skin charts use the bounded table above.
  const startupScale=['body','left'].includes(name)?.5:.125;
  const baseRefinementBudget=SKIN_REFINEMENT_BUDGET[name]?.[quality]??Math.floor(REFINEMENT_BUDGET[name]*(quality==='preview'?startupScale:quality==='close'?2:quality==='balanced'?1.5:1));
  // Reserve bounded extra work for front-facing head charts so local mouth and
  // eyelid motion does not stretch a handful of large triangles. Other charts
  // keep their existing quotas; canonical source functions remain unchanged.
  const faceDomains=name==='detail'?data.fields.domains.filter(c=>c.semanticRegion==='head_face_ears'&&c.heightAxis===2&&c.outwardSign>0):name==='features'?data.fields.domains.filter(c=>c.semanticRegion==='FJ2814'):[];
  // The dense procedural facial skin now replaces the front source patch.
  // Keep feature apertures' quota; reduce only the overlapping source-head
  // front-face reserve, preserving its remaining boundary support samples.
  const faceRefinementBudget=faceDomains.length?Math.floor((name==='features'?(quality==='preview'?1800:6000):(quality==='preview'?5000:quality==='close'?22000:15000))*(name==='detail'?.30:1)):0;
  const faceQuota=allocateChartRefinementBudget(faceDomains,faceRefinementBudget),faceBudgets=new Map(faceDomains.map((c,i)=>[c.id,faceQuota[i]]));
  // The visible pinna is FJ2811 in features. Its independent bounded quota
  // supplements the existing head-side underlay quota without reallocating
  // other features/body samples or changing the whole-source allocation guard.
  const earDomains=name==='features'?data.fields.domains.filter(c=>c.semanticRegion==='FJ2811'):name==='detail'?data.fields.domains.filter(c=>c.semanticRegion==='head_face_ears'&&c.heightAxis===0&&c.projectionAxes[0]===1&&c.projectionAxes[1]===2&&c.uvBoundsMetres[0][0]<1.529&&c.uvBoundsMetres[1][0]>1.477&&c.uvBoundsMetres[0][1]<.108&&c.uvBoundsMetres[1][1]>.072):[];
  const earRefinementBudget=earDomains.length?(name==='features'?3500:Math.floor((quality==='preview'?1400:quality==='close'?4000:2400)*.70)):0;
  const earQuota=allocateChartRefinementBudget(earDomains,earRefinementBudget),earBudgets=new Map(earDomains.map((c,i)=>[c.id,earQuota[i]]));
  const correctionAllocations=surfaceCorrections.map(correction=>{
    const domains=data.fields.domains.filter(c=>correction.affectsChart(c)),budget=domains.length?correction.parameters.refinementBudget:0;
    // A shared local pool avoids wasting a correction's quota on charts whose
    // bounding rectangle touches its support but whose trimmed faces do not.
    return {correction,domains:new Set(domains.map(c=>c.id)),budget,remaining:budget};
  });
  const refinementBudget=baseRefinementBudget+faceRefinementBudget+earRefinementBudget+correctionAllocations.reduce((sum,c)=>sum+c.budget,0);
  const chartBudget=name==='left'?Math.floor(baseRefinementBudget/2):baseRefinementBudget;
  const chartBudgets=['body','left'].includes(name)?allocateChartRefinementBudget(data.fields.domains,chartBudget):null;
  // The detail group also contains broad head skin. Giving a cranial chart
  // the same quota as a tiny fingertip left centimetre-wide head triangles
  // while unused detail quota remained. Redistribute ONLY the existing head
  // allocation by area; other anatomical regions keep their exact quotas.
  const headDomains=name==='detail'?data.fields.domains.filter(c=>c.semanticRegion==='head_face_ears'):[];
  // Shared-edge conformity costs additional final triangles. Reserve headroom
  // under the unchanged 600k whole-body guard, not just this group's sampler.
  const headBaseBudget=Math.floor(data.fields.domains.reduce((sum,c,i)=>sum+(name==='detail'&&c.semanticRegion==='head_face_ears'?Math.floor(chartBudget/surface.domainIds.length)+(i<chartBudget%surface.domainIds.length?1:0):0),0)*.70);
  const headQuota=allocateChartRefinementBudget(headDomains,headBaseBudget),headBudgets=new Map(headDomains.map((c,i)=>[c.id,headQuota[i]]));
  let unusedHeadBudget=0;
  stats.chartBudgetAllocation=chartBudgets?'source-area-weighted; uniform-quarter':'uniform';
  stats.headChartBudgetAllocation=headDomains.length?'source-area-weighted; uniform-quarter; head-only carry':null;
  stats.headBaseRefinementBudget=headBaseBudget;
  stats.refinementBudget=refinementBudget;stats.adaptiveSplits=0;stats.budgetLimitedTriangles=0;
  stats.faceRefinementBudget=faceRefinementBudget;stats.faceRefinementCharts=faceDomains.length;
  stats.earRefinementBudget=earRefinementBudget;stats.earRefinementCharts=earDomains.length;
  stats.surfaceCorrections=correctionAllocations.map(c=>({version:c.correction.parameters.version,refinementBudget:c.budget,charts:c.domains.size}));
  stats.correctionRefinementSplits=0;stats.correctionLimitedTriangles=0;stats.maximumCorrectionInterpolationError=0;stats.maximumCorrectionSourceEdge=0;stats.correctionDomains=[];
  let domainIndex=0,lastProgress=-Infinity,visitedTriangles=0,domainSplits=0,domainSplitBudget=0,unusedChartBudget=0;
  function reportProgress(force=false){const now=performance.now();if(!force&&now-lastProgress<200)return;lastProgress=now;
    progress({group:name,domain:domainIndex,total:surface.domainIds.length,domainId:stats.currentDomain,evaluations:stats.evaluations,triangles:stats.triangles??[...builders.values()].reduce((s,b)=>s+b.indices.length/3,0),canonicalVertices:topology.masks.length,adaptiveSplits:stats.adaptiveSplits,refinementBudget,budgetLimitedTriangles:stats.budgetLimitedTriangles});}
  function sampler(evaluate,b,regionMask,inverse,edgeScale=1,orientation=null,earChart=false,chartCorrections=[]){const cache=new Map(),edges=new Map(),pending=new SurfaceRefinementQueue(),correctedSamples=new WeakMap();let cachedValues=0;
    // Only height-chart parameters have two metre axes. A radial chart's
    // second parameter is dimensionless and retains its own sampling policy.
    const headChart=name==='detail'&&regionMask===bindingSchema.regions.head_face_ears;
    const heightChart=(repairSkin||headChart)&&orientation!==null;
    const shadingAngle=(heightChart?Math.min(settings.normalAngleDegrees||6,2):settings.normalAngleDegrees||6)*Math.PI/180;
    const edgeLimit=(heightChart?Math.min(maxEdge,.012):maxEdge)*edgeScale;
    const sample=uv=>{const v=evaluate(...uv);v.regionMask=regionMask;if(normalField)v.shade=normalField(b.name,v.p,v.n);stats.evaluations++;return v;};
    const val=uv=>{let row=cache.get(uv[0]),v=row?.get(uv[1]);if(v!==undefined)return v;
      v=sample(uv);if(cachedValues>=65536){cache.clear();cachedValues=0;row=undefined;}
      if(!row){row=new Map();cache.set(uv[0],row);}row.set(uv[1],v);cachedValues++;return v;};
    const midpoint=(a,c)=>topology.midpoint(b.name,a,c,val,inverse,edges);
    // Topology and inverse chart coordinates continue to use the locked source.
    // Compare the composed final geometry before deciding how finely to sample.
    const corrected=v=>{let p=correctedSamples.get(v);if(!p){p=v.p;for(const correction of surfaceCorrections)p=correction.evaluateSource(p,regionMask).point;correctedSamples.set(v,p);}return p;};
    function probe(a,bb,c,depth=0){if((++visitedTriangles&1023)===0)reportProgress();const vertices=[a,bb,c],midpoints=[midpoint(a,bb),midpoint(bb,c),midpoint(c,a)],
      centre=sample(a.uv.map((x,k)=>(x+bb.uv[k]+c.uv[k])/3)),linear=a.p.map((x,k)=>(x+bb.p[k]+c.p[k])/3),
      lengths=[distance(a.p,bb.p),distance(bb.p,c.p),distance(c.p,a.p)],errors=midpoints.map((m,i)=>distance(m.p,mix(vertices[i].p,vertices[(i+1)%3].p,m.edgeFraction??.5))),
      centroidError=distance(centre.p,linear),error=Math.max(centroidError,...errors),longest=Math.max(...lengths);
      let shadeError=0,geometricNormalError=0;const edgeShadeErrors=[0,0,0];
      if(a.shade){const angle=(x,y)=>{const den=Math.hypot(...x)*Math.hypot(...y);return den<1e-15?Math.PI:Math.acos(Math.max(-1,Math.min(1,x.reduce((s,v,k)=>s+v*y[k],0)/den)));};
        midpoints.forEach((m,i)=>{edgeShadeErrors[i]=angle(m.shade,mix(vertices[i].shade,vertices[(i+1)%3].shade,m.edgeFraction??.5));});
        shadeError=Math.max(...edgeShadeErrors,angle(centre.shade,a.shade.map((x,k)=>(x+bb.shade[k]+c.shade[k])/3)));
        const u=bb.p.map((x,k)=>x-a.p[k]),v=c.p.map((x,k)=>x-a.p[k]),face=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],size=Math.hypot(...face);
        if(size>1e-20){const direction=angle(face,centre.shade);geometricNormalError=Math.min(direction,Math.PI-direction);}
      }
      const refineShading=shadeError>shadingAngle&&longest>(settings.normalMinimumEdge||.00035);
      const geometricLimit=Math.max(20*Math.PI/180,2*shadingAngle);
      const refineGeometryNormal=(repairSkin||headChart)&&geometricNormalError>geometricLimit&&longest>(settings.normalMinimumEdge||.00035);
      const earPatch=earChart&&(name==='features'||Math.min(a.p[1],bb.p[1],c.p[1])<1.529&&Math.max(a.p[1],bb.p[1],c.p[1])>1.477&&Math.min(a.p[2],bb.p[2],c.p[2])<.108&&Math.max(a.p[2],bb.p[2],c.p[2])>.072);
      const activeCorrections=chartCorrections.filter(correction=>correction.affectsSourceTriangle(vertices.map(v=>v.p),regionMask));
      let localEdgeLimit=earPatch?Math.min(edgeLimit,quality==='close'?.0015:.002):edgeLimit,correctionError=0,correctionTolerance=Infinity;
      if(activeCorrections.length){
        localEdgeLimit=Math.min(localEdgeLimit,...activeCorrections.map(c=>c.parameters.maximumSourceEdgeM));correctionTolerance=Math.min(...activeCorrections.map(c=>c.parameters.positionToleranceM));
        const mapped=vertices.map(corrected),mappedCentre=mapped[0].map((v,k)=>(v+mapped[1][k]+mapped[2][k])/3);
        correctionError=Math.max(distance(corrected(centre),mappedCentre),...midpoints.map((m,i)=>distance(corrected(m),mix(mapped[i],mapped[(i+1)%3],m.edgeFraction??.5))));
      }
      const refineCorrection=activeCorrections.length>0&&(longest>localEdgeLimit||correctionError>correctionTolerance);
      const needsRefinement=error>settings.positionTolerance||longest>localEdgeLimit||refineShading||refineGeometryNormal||refineCorrection;
      const priority=Math.max(error/settings.positionTolerance,longest/localEdgeLimit,correctionError/correctionTolerance,refineShading?shadeError/shadingAngle:0,refineGeometryNormal?geometricNormalError/geometricLimit:0);
      return {a,bb,c,depth,vertices,midpoints,centre,lengths,errors,edgeShadeErrors,centroidError,error,longest,refineShading,refineGeometryNormal,refineCorrection,correctionError,activeCorrections,correctionActive:activeCorrections.length>0,needsRefinement,priority};
    }
    function emit(a,bb,c,depth=0){
      if(!usableParameterTriangle(a.uv,bb.uv,c.uv)){stats.parameterSliversRejected=(stats.parameterSliversRejected||0)+1;return;}
      const candidate=probe(a,bb,c,depth);pending.push(candidate,candidate.priority);}
    function flush(){while(pending.length){
      const {a,bb,c,depth}=pending.pop();
      // Other queued faces may have added a shared edge knot since enqueue.
      const {vertices,midpoints,centre,lengths,errors,edgeShadeErrors,centroidError,error,longest,refineShading,refineGeometryNormal,refineCorrection,correctionError,activeCorrections,correctionActive,needsRefinement}=probe(a,bb,c,depth);
      const correctionPool=refineCorrection&&domainSplits>=domainSplitBudget?correctionAllocations.find(c=>c.remaining>0&&activeCorrections.includes(c.correction)):null;
      if(needsRefinement&&depth<20&&(domainSplits<domainSplitBudget||correctionPool)){
        if(correctionPool)correctionPool.remaining--;else domainSplits++;stats.adaptiveSplits++;
        if(refineShading)stats.normalRefinementSplits++;
        if(refineGeometryNormal)stats.geometricNormalRefinements++;
        if(refineCorrection)stats.correctionRefinementSplits++;
        const edgeScores=errors.map((e,i)=>Math.max(e/settings.positionTolerance,edgeShadeErrors[i]/shadingAngle));
        // Error-only edge selection and repeated centre splits made nearly
        // collinear UV slivers whose curved 3D chords appeared as skin fins.
        // Longest-parameter-edge bisection reduces that aspect ratio instead.
        const useParameterEdge=heightChart||correctionActive&&orientation!==null;
        const worst=Math.max(...edgeScores),longestEdge=lengths.indexOf(longest),edge=useParameterEdge?longestParameterEdge(vertices.map(v=>v.uv)):repairSkin&&worst>1?edgeScores.indexOf(worst):longestEdge;
        if(useParameterEdge)stats.parameterLongestEdgeSplits++;
        if(edge!==longestEdge)stats.errorDirectedEdgeSplits++;
        const x=vertices[edge],y=vertices[(edge+1)%3],z=vertices[(edge+2)%3],m=midpoints[edge];
        topology.split(b.vertex(x),b.vertex(y),b.vertex(m));
        emit(x,m,z,depth+1);emit(m,y,z,depth+1);continue;}
      if(needsRefinement&&domainSplits>=domainSplitBudget)stats.budgetLimitedTriangles++;
      if(correctionActive){stats.maximumCorrectionInterpolationError=Math.max(stats.maximumCorrectionInterpolationError,correctionError);stats.maximumCorrectionSourceEdge=Math.max(stats.maximumCorrectionSourceEdge,longest);if(refineCorrection)stats.correctionLimitedTriangles++;}
      if(needsRefinement){stats.refinementLimitCount++;
        if(stats.unresolvedWorst.length<8||error>stats.unresolvedWorst.at(-1).error){stats.unresolvedWorst.push({domain:stats.currentDomain,error,longest,uv:vertices.map(v=>v.uv),p:vertices.map(v=>v.p),centre});stats.unresolvedWorst.sort((a,b)=>b.error-a.error);stats.unresolvedWorst.length=Math.min(stats.unresolvedWorst.length,8);}}
      stats.maximumSampledInterpolationError=Math.max(stats.maximumSampledInterpolationError,error);stats.acceptedTriangleProbes+=4;b.triangle(a,bb,c,orientation);
    }}return {val,emit,flush};}
  let exactSurface;
  for(let di=0;di<surface.domainIds.length;di++){
    const correctionSplitsBefore=stats.correctionRefinementSplits,correctionLimitsBefore=stats.correctionLimitedTriangles;
    domainSplits=0;domainSplitBudget=chartBudgets?chartBudgets[di]:Math.floor(chartBudget/surface.domainIds.length)+(di<chartBudget%surface.domainIds.length?1:0);
    if(headBudgets.has(data.fields.domains[di].id))domainSplitBudget=headBudgets.get(data.fields.domains[di].id)+unusedHeadBudget;
    // Carry only unused quota forward; every later chart retains its original
    // allocation. This changes neither the total budget nor allocation guards.
    domainSplitBudget+=faceBudgets.get(data.fields.domains[di].id)||0;
    domainSplitBudget+=earBudgets.get(data.fields.domains[di].id)||0;
    const baseBudget=domainSplitBudget;domainSplitBudget+=unusedChartBudget;
    const id=surface.domainIds[di];domainIndex=di;stats.currentDomain=id;reportProgress();let chart,faces,uv,trimLoops;
    function prepare(kernel){chart=kernel.makeChart(id);let loops=chart.loops();if(properCrossings(loops))throw Error('Crossing compact trim '+id);
      loops=loops.map(loop=>({loop,area:Math.abs(loopsArea([loop])[0])})).sort((a,b)=>b.area-a.area).map(x=>x.loop);
      const holes=[];let offset=loops[0].length;for(let i=1;i<loops.length;i++){holes.push(offset);offset+=loops[i].length;}
      trimLoops=loops;uv=loops.flat();const flat=earcut(uv.flat(),holes,2);faces=[];for(let i=0;i<flat.length;i+=3)faces.push(flat.slice(i,i+3));if(!faces.length)throw Error('Empty compact chart '+id);
      faces=conformTrimFaces(uv,faces);
      if(name==='body'||name==='left'||name==='collar'||name==='detail'&&chart.c.semanticRegion==='head_face_ears'||name==='features'&&chart.c.semanticRegion==='FJ2811')stats.trimQualityFlips+=improveTrimQuality(uv,faces);}
    try{prepare(surface);}catch(error){if(!/Collapsed compact|Crossing compact|Empty compact/.test(error.message))throw error;
      exactSurface??=createCompactSurface(data,{normalField});prepare(exactSurface);stats.exactBoundaryFallbacks++;}
    const regionMask=name==='features'?bindingSchema.featureMask:bindingSchema.regions[chart.c.semanticRegion];
    if(!regionMask)throw Error('Unknown source anatomy region '+chart.c.semanticRegion);
    const outward=[0,0,0];outward[chart.c.heightAxis]=chart.c.outwardSign;
    const faceChart=faceBudgets.has(chart.c.id);
    const chartCorrections=correctionAllocations.filter(c=>c.domains.has(chart.c.id)).map(c=>c.correction);
    const b=builder(name==='features'?chart.c.semanticRegion:'skin'),{val,emit,flush}=sampler(chart.evaluate,b,regionMask,p=>chart.c.projectionAxes.map(k=>p[k]),faceChart?.35:1,outward,earBudgets.has(chart.c.id),chartCorrections);
    for(const loop of trimLoops){const ids=loop.map(p=>b.vertex(val(p)));for(let k=0;k<ids.length;k++)topology.markBoundary(ids[k],ids[(k+1)%ids.length]);}
    const emittedStart=b.indices.length;
    for(const f of faces)emit(...f.map(i=>val(uv[i])));flush();
    if(cranialInterfaceCollarWidth(chart.c)!==null){
      const previous=b.indices.slice(emittedStart),settled=improveSampledCollarTriangles(previous,id=>topology.point(id),chart.c.projectionAxes);
      for(let extra=previous.length;extra<settled.indices.length;extra+=3)topology.claimTriangle();
      b.indices.length=emittedStart;b.indices.push(...settled.indices);
      stats.cranialCollarRemeshing={domain:id,trianglesBefore:previous.length/3,trianglesAfter:settled.indices.length/3,flips:settled.flips,rounds:settled.rounds,addedSampleBudget:0};
    }
    if(stats.correctionRefinementSplits!==correctionSplitsBefore||stats.correctionLimitedTriangles!==correctionLimitsBefore)stats.correctionDomains.push({id,refinementSplits:stats.correctionRefinementSplits-correctionSplitsBefore,limitedTriangles:stats.correctionLimitedTriangles-correctionLimitsBefore});
    stats.reusedChartBudget+=Math.max(0,domainSplits-baseBudget);unusedChartBudget=repairSkin?domainSplitBudget-domainSplits:0;
    if(headBudgets.has(chart.c.id))unusedHeadBudget=domainSplitBudget-domainSplits;
    domainIndex=di+1;if(di%50===0){reportProgress();await new Promise(resolve=>setTimeout(resolve,0));}
  }
  if(name==='left'){
    const [lo,hi]=data.tube.heightRangeMetres,b=builder('skin');
    const rings=new Map([lo,hi].map(y=>[y,data.boundaries.curves.filter(c=>{const [axis,value]=c.boundaryKind.split(':');return axis==='1'&&Math.abs(Number(value)-y)<1e-12;}).map(c=>surface.polyline(c.id))]));
    const chains=new Map([...rings].map(([y,lines])=>[y,lines.map(line=>topology.boundaryChain('skin',line,bindingSchema.tubeMask))]));
    for(let chart=0;chart<4;chart++){
      domainSplits=0;const baseBudget=Math.floor((baseRefinementBudget-chartBudget)/4);domainSplitBudget=baseBudget+unusedChartBudget;stats.currentDomain='left/radial/'+chart;
      const [normal,tangent]=data.tube.chartFramesXZ[chart],axis=data.tube.axisXZMetres;
      const inverse=p=>{const d=[p[0]-axis[0],p[2]-axis[1]],den=d[0]*normal[0]+d[1]*normal[1];return [p[1],canonicalRadialParameter((d[0]*tangent[0]+d[1]*tangent[1])/den)];};
      const {val,emit,flush}=sampler((y,t)=>surface.evaluateTube(chart,y,t),b,bindingSchema.tubeMask,inverse),ny=48;
      const cuts=Array.from({length:9},(_,i)=>-1+i/4);
      for(const lines of rings.values())for(const line of lines)for(const p of line){const [y,t]=inverse(p),d=[p[0]-axis[0],p[2]-axis[1]];
       if(d[0]*normal[0]+d[1]*normal[1]>0&&t>=-1-1e-11&&t<=1+1e-11)cuts.push(Math.max(-1,Math.min(1,t)));
      }
      cuts.sort((a,b)=>a-b);const ts=cuts.filter((t,i)=>!i||t-cuts[i-1]>1e-11);
      for(const y of [lo,hi])registerRadialBoundary(topology,chains.get(y),ts.map(t=>val([y,t]).p),bindingSchema.tubeMask);
      for(let i=0;i<ny;i++)for(let j=0;j<ts.length-1;j++){
        const a=val([lo+(hi-lo)*i/ny,ts[j]]),bb=val([lo+(hi-lo)*(i+1)/ny,ts[j]]),c=val([lo+(hi-lo)*i/ny,ts[j+1]]),d=val([lo+(hi-lo)*(i+1)/ny,ts[j+1]]);
        emit(a,bb,c);emit(bb,d,c);}flush();
      stats.reusedChartBudget+=Math.max(0,domainSplits-baseBudget);unusedChartBudget=domainSplitBudget-domainSplits;}
  }
  // Report while Builder still owns its indices; finish() releases them.
  if(stats.adaptiveSplits>refinementBudget)throw Error('Surface refinement exceeded its group budget');
  stats.unusedRefinementBudget=refinementBudget-stats.adaptiveSplits;
  correctionAllocations.forEach((c,i)=>{stats.surfaceCorrections[i].usedRefinementBudget=c.budget-c.remaining;stats.surfaceCorrections[i].unusedRefinementBudget=c.remaining;});
  domainIndex=surface.domainIds.length;reportProgress(true);
  const meshes=[...builders.values()].map(b=>b.finish());stats.triangles=meshes.reduce((s,m)=>s+m.indices.length/3,0);stats.vertices=meshes.reduce((s,m)=>s+m.vertices,0);
  stats.maximumCanonicalFlattenBound=surface.maximumFlattenBound;
  stats.boundaryReconstruction=surface.boundaryReport;
  if(exactSurface)stats.exactBoundaryReconstruction=exactSurface.boundaryReport;
  return {meshes,stats,surface};
}

/** Canonical positions are rounded ONCE to Float32 before draw chunking.
 * Only normals use octahedral quantization. A shared vertex cannot acquire
 * different coordinates from different draw-group bounding boxes. */
export function smoothAndQuantize(meshes,normalField=null,surfaceCorrections=[]){
 let maximumPositionQuantization=0,maximumNormalQuantizationRadians=0;const results=[],correctionStats=surfaceCorrections.map(c=>({version:c.parameters.version,changedVertexOccurrences:0,maximumDisplacementM:0,minimumLocalJacobian:1}));
 for(const m of meshes){
  const positions=m.positions,count=positions.length/3,normals=new Int16Array(count*2);
  if(!(positions instanceof Float32Array)||m.vertexIds.length!==count)throw Error('Canonical positions and vertex identities are required');
  maximumPositionQuantization=Math.max(maximumPositionQuantization,m.maximumFloat32ErrorM);
  for(let i=0;i<count;i++){
   const sourcePoint=Array.from(positions.subarray(3*i,3*i+3)),hint=Array.from(m.normals.subarray(3*i,3*i+3));
   let point=sourcePoint,n=normalField?normalField(m.name,sourcePoint,hint):hint;
   for(let k=0;k<surfaceCorrections.length;k++){
    const corrected=surfaceCorrections[k].evaluateSource(point,m.regionMasks[i],n),stat=correctionStats[k];
    if(corrected.changed)stat.changedVertexOccurrences++;
    stat.maximumDisplacementM=Math.max(stat.maximumDisplacementM,distance(point,corrected.point));stat.minimumLocalJacobian=Math.min(stat.minimumLocalJacobian,corrected.minimumLocalJacobian??corrected.jacobian??1);
    point=corrected.point;n=corrected.normal;
   }
   if(surfaceCorrections.length){positions.set(point,3*i);maximumPositionQuantization=Math.max(maximumPositionQuantization,distance(point,Array.from(positions.subarray(3*i,3*i+3))));}
   const l1=Math.abs(n[0])+Math.abs(n[1])+Math.abs(n[2]);
   if(!(l1>0))throw Error('Invalid canonical normal');
   let x=n[0]/l1,y=n[1]/l1;if(n[2]<0){const ox=x;x=(1-Math.abs(y))*(ox>=0?1:-1);y=(1-Math.abs(ox))*(y>=0?1:-1);}
   normals[2*i]=Math.round(x*32767);normals[2*i+1]=Math.round(y*32767);
   let dx=normals[2*i]/32767,dy=normals[2*i+1]/32767,dz=1-Math.abs(dx)-Math.abs(dy);
   if(dz<0){const ox=dx;dx=(1-Math.abs(dy))*(ox>=0?1:-1);dy=(1-Math.abs(ox))*(dy>=0?1:-1);}
   const alignment=(dx*n[0]+dy*n[1]+dz*n[2])/Math.hypot(dx,dy,dz)/Math.hypot(...n);
   maximumNormalQuantizationRadians=Math.max(maximumNormalQuantizationRadians,Math.acos(Math.max(-1,Math.min(1,alignment))));
  }
  results.push(...splitForUint16({name:m.name,sourceGroup:m.sourceGroup,positions,normals,regionMasks:m.regionMasks,vertexIds:m.vertexIds,
   normalComponents:2,normalEncoding:'octahedral-snorm16x2',positionEncoding:'canonical-float32',indices:m.indices,
   origin:[0,0,0],extent:[1,1,1],vertices:count,triangles:m.indices.length/3}));
 }
 return {meshes:results,maximumPositionQuantization,maximumNormalQuantizationRadians,correctionStats};
}

function splitForUint16(m){
 if(m.vertices<=65535){const indices=Uint16Array.from(m.indices);return [{...m,indices,attributeBytes:m.positions.byteLength+m.normals.byteLength+indices.byteLength}];}
 const chunks=[];let map=new Map(),positions=[],normals=[],indices=[],regionMasks=[],vertexIds=[];
 const nc=m.normalComponents;
 function flush(){if(!indices.length)return;const p=Float32Array.from(positions),n=Int16Array.from(normals),i=Uint16Array.from(indices);
  chunks.push({...m,positions:p,normals:n,indices:i,regionMasks:Uint16Array.from(regionMasks),vertexIds:Uint32Array.from(vertexIds),
   vertices:p.length/3,triangles:i.length/3,attributeBytes:p.byteLength+n.byteLength+i.byteLength,chunk:chunks.length});
  map=new Map();positions=[];normals=[];indices=[];regionMasks=[];vertexIds=[];
 }
 for(let k=0;k<m.indices.length;k+=3){const tri=[m.indices[k],m.indices[k+1],m.indices[k+2]],fresh=tri.filter(i=>!map.has(i)).length;if(map.size+fresh>65535)flush();
  for(const id of tri){let local=map.get(id);if(local===undefined){local=map.size;map.set(id,local);
   positions.push(...m.positions.subarray(id*3,id*3+3));normals.push(...m.normals.subarray(id*nc,id*nc+nc));regionMasks.push(m.regionMasks[id]);vertexIds.push(m.vertexIds[id]);
  }indices.push(local);}
 }
 flush();return chunks;
}
