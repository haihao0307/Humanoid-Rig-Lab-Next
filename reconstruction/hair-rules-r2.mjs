/** R15 display bundles derived from R2 curves. Roots evaluate the fitted scalp. */
import {sampleScalpRegion} from './hair-zones.mjs';
const add=(a,b)=>a.map((v,k)=>v+b[k]),sub=(a,b)=>a.map((v,k)=>v-b[k]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const unit=a=>{const l=Math.hypot(...a);if(l<1e-12)throw Error('Degenerate hair direction');return mul(a,1/l);};
const mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t),clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function random(key){let h=2166136261;for(const c of String(key))h=Math.imul(h^c.charCodeAt(0),16777619);return()=>{h=(Math.imul(h,1664525)+1013904223)>>>0;return h/4294967296;};}
export const DEFAULT_HAIR_RULES_R2={schema:'human-hair-bundle-rules/v2',seed:2026091102,style:'short-swept-back',
  scalpCenter:[-.000674,1.53636,.09],bundleRootsPerSquareMetre:420000,strandsPerBundle:4,
  memberSpreadMetres:.00085,minimumRootSpacingMetres:.00017,diameterMetres:.000075,
  topLengthMetres:.031,sideLengthMetres:.012,frontLengthAdditionMetres:.004,
  topLiftMetres:.0026,sideLiftMetres:.0009,clumpStrength:.12,waveAmplitudeMetres:.00013,
  clearanceMetres:.00065,tipRadiusFraction:.12};

export function createHairBundleRulesR2({surface,domains,scalpRadius,rules=DEFAULT_HAIR_RULES_R2}){
  rules=JSON.parse(JSON.stringify(rules));if(rules.schema!=='human-hair-bundle-rules/v2'||typeof scalpRadius!=='function')throw Error('R2 scalp field required');
  for(const name of ['bundleRootsPerSquareMetre','strandsPerBundle','memberSpreadMetres','minimumRootSpacingMetres','diameterMetres','topLengthMetres','sideLengthMetres'])if(!(rules[name]>0)||!Number.isFinite(rules[name]))throw Error('Invalid hair parameter');
  const eligible=domains.filter(d=>d.semanticRegion==='head_face_ears'),lookup=new Map(eligible.map(d=>[`detail_extension/${d.id}`,d]));
  function rootAt(id,u,v){const d=lookup.get(id);if(!d)return null;
    const [lo,hi]=d.uvBoundsMetres||d.boundsMetres.map(p=>d.projectionAxes.map(k=>p[k]));
    if(u<lo[0]||u>hi[0]||v<lo[1]||v>hi[1])return null;
    const q=surface.evaluateDomain(id,u,v),region=q?sampleScalpRegion(q.position,rules):null;
    if(!q||region.coverage<=0)return null;
    return {domain:id,u,v,position:q.position,normal:q.geometricNormal,coverage:region.coverage,region};}
  function groom(root){const n=unit(sub(root.position,rules.scalpCenter)),front=Math.max(0,n[2]),top=Math.max(smooth((n[1]-.12)/.78),front*front*.82),side=Math.abs(n[0])**4;
    // Front -> crown -> nape follows a continuous meridian tangent field.
    // A constant world-space guide had created an unwanted forehead vortex.
    const part=rules.part||0,partFlow=part?Math.tanh((n[0]-part)*12)*.48*top:0;
    const tuft=Math.sin(n[0]*19+n[2]*13+rules.seed%997)*Math.sin(n[1]*23-n[2]*9);
    const flow=[(rules.sweep??.20)*(1-side)+partFlow+.28*tuft*(.3+.7*top),n[2]-.48*side,-n[1]-.28*side+.12*tuft*top];
    let tangent=sub(flow,mul(n,dot(flow,n)));
    if(Math.hypot(...tangent)<1e-7)tangent=cross(n,Math.abs(n[0])<.8?[1,0,0]:[0,0,1]);
    const exit=unit(tangent);
    const regionalLength=root.region.lengthScale;
    return {normal:n,exit,tip:unit([exit[0],exit[1]-.16,exit[2]]),length:(rules.sideLengthMetres+(rules.topLengthMetres-rules.sideLengthMetres)*top+rules.frontLengthAdditionMetres*front*top)*regionalLength,
      lift:(rules.sideLiftMetres+(rules.topLiftMetres-rules.sideLiftMetres)*top)*regionalLength};}
  function controls(root,lengthScale=1){const g=groom(root),length=g.length*lengthScale;
    const tangent=unit(sub(g.exit,mul(g.normal,dot(g.exit,g.normal)))),emerge=unit(add(mul(tangent,.98),mul(g.normal,.18)));
    return [root.position,add(root.position,mul(emerge,length/3)),add(add(root.position,mul(g.exit,length*.63)),mul(g.normal,g.lift)),add(add(root.position,mul(g.exit,length*.80)),add(mul(g.tip,length*.20),mul(g.normal,g.lift)))];}
  const bezier=(c,t)=>{const s=1-t;return [0,1,2].map(k=>s*s*s*c[0][k]+3*s*s*t*c[1][k]+3*s*t*t*c[2][k]+t*t*t*c[3][k]);};
  function strand(bundle,member,root){const rng=random(`${rules.seed}/${bundle.id}/${member}`),own=controls(root,.88+.24*rng()),leader=bundle.control,offset=sub(root.position,bundle.root.position),phase=rng()*Math.PI*2;
    const axis=unit(sub(own[3],own[0])),side=unit(cross(axis,Math.abs(axis[0])<.8?[1,0,0]:[0,0,1])),up=unit(cross(axis,side));
    const initialDirection=unit(sub(root.position,rules.scalpCenter)),rootRadialOffset=Math.hypot(...sub(root.position,rules.scalpCenter))-scalpRadius(initialDirection);
    const diameter=rules.diameterMetres*(.85+.3*rng());
    function point(t){if(!Number.isFinite(t)||t<0||t>1)throw RangeError('Invalid strand parameter');if(t===0)return root.position.slice();
      let p=mix(bezier(own,t),add(bezier(leader,t),mul(offset,1-smooth(t))),rules.clumpStrength*smooth(t));
      const angle=2*Math.PI*(rules.waveCycles??.65)*t+phase,wave=rules.waveAmplitudeMetres*Math.sin(Math.PI*t)**2;
      p=add(p,add(mul(side,Math.cos(angle)*wave),mul(up,Math.sin(angle)*wave)));
      const direction=unit(sub(p,rules.scalpCenter)),radius=Math.hypot(...sub(p,rules.scalpCenter));
      const floor=scalpRadius(direction)+rootRadialOffset*Math.exp(-8*t)+rules.clearanceMetres*(1-Math.exp(-20*t));
      if(radius<floor)p=add(rules.scalpCenter,mul(direction,floor));return p;}
    return {id:`${bundle.id}/strand/${member}`,attachment:{domain:root.domain,u:root.u,v:root.v},coverage:root.coverage,region:root.region,point,
      radius:t=>diameter*.5*(1-(1-rules.tipRadiusFraction)*smooth((t-.65)/.35)),
      tangent:t=>unit(sub(point(Math.min(1,t+1e-5)),point(Math.max(0,t-1e-5)))),colourVariation:.85+.30*rng()};}
  function generate({maximumStrands,onStrand,progress=()=>{}}={}){
    if(!Number.isInteger(maximumStrands)||maximumStrands<0||maximumStrands>12000||typeof onStrand!=='function')throw Error('Bounded hair writer required');
    const limit=rules.maximumCandidates;if(!Number.isInteger(limit)||limit<1||limit>96000)throw Error('Invalid hair candidate budget');
    // A bounded max-heap selects across ALL head charts. Stopping in chart order
    // would leave later scalp regions bald when a display budget is reached.
    const heap=[],grid=new Map(),cell=rules.minimumRootSpacingMetres;let candidates=0,rejected=0,emitted=0;
    function retain(item){
      if(heap.length<maximumStrands){let i=heap.length;heap.push(item);while(i>0){const p=(i-1)>>1;if(heap[p].rank>=item.rank)break;heap[i]=heap[p];i=p;}heap[i]=item;}
      else if(item.rank<heap[0].rank){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].rank>heap[c].rank)c++;if(heap[c].rank<=item.rank)break;heap[i]=heap[c];i=c;}heap[i]=item;}
    }
    function separated(p){const base=p.map(v=>Math.floor(v/cell));for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++)for(const q of grid.get(`${base[0]+a},${base[1]+b},${base[2]+c}`)||[])if(Math.hypot(...sub(p,q))<cell)return false;
      const key=base.join(',');if(!grid.has(key))grid.set(key,[]);grid.get(key).push(p);return true;}
    const charts=eligible.filter(d=>d.boundsMetres[1][1]>1.40).map(d=>{
      const bounds=(d.uvBoundsMetres||d.boundsMetres.map(p=>d.projectionAxes.map(k=>p[k]))).map(p=>p.slice());
      const y=d.projectionAxes.indexOf(1);if(y>=0)bounds[0][y]=Math.max(bounds[0][y],1.40);
      const projectionFloor=Math.max(.08,d.minimumNormalProjection||.35),[lo,hi]=bounds;
      return {d,lo,hi,projectionFloor,area:Math.max(0,hi[0]-lo[0])*Math.max(0,hi[1]-lo[1])/projectionFloor};
    });
    const area=charts.reduce((sum,c)=>sum+c.area,0);let cumulative=0,allocated=0;
    if(maximumStrands>0&&area>0)for(const [index,c]of charts.entries()){
      const {d,lo,hi,projectionFloor}=c,id=`detail_extension/${d.id}`;cumulative+=c.area;
      const end=index===charts.length-1?limit:Math.min(limit,Math.floor(cumulative/area*limit)),count=end-allocated;allocated=end;
      for(let k=0;k<count;k++){
        candidates++;if(candidates%512===0)progress({group:'hair',phase:'roots',domain:candidates,total:limit});
        const key=`${rules.seed}/${id}/${k}`,rank=random('priority/'+key)();
        // Priority is independent of position. Skipping these evaluations does
        // not bias the retained root sample, and keeps the chart cache bounded.
        if(heap.length===maximumStrands&&rank>=heap[0].rank)continue;
        const rng=random(key),u=lo[0]+rng()*(hi[0]-lo[0]),v=lo[1]+rng()*(hi[1]-lo[1]),root=rootAt(id,u,v);
        if(!root||rng()>root.coverage*Math.min(1,projectionFloor/Math.max(.02,Math.abs(root.normal[d.heightAxis])))){rejected++;continue;}
        retain({rank,id:`hair-r15/${d.id}/${k}`,root});
      }
    }
    heap.sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id));
    for(const item of heap){if(!separated(item.root.position)){rejected++;continue;}
      const bundle={...item,control:controls(item.root)};
      onStrand(strand(bundle,0,item.root),emitted++); // no retained curve closures
      if(emitted%128===0)progress({group:'hair',phase:'curves',domain:emitted,total:heap.length});
    }
    const retainedRoots=heap.length;heap.length=0;grid.clear();
    return {report:{schema:'human-display-hair-bundles/v1',bundles:emitted,strands:emitted,candidates,rejected,retainedRoots,maximumCandidates:limit,
      rootPopulationMethod:'bounded global priority sample of Jacobian-weighted scalp roots; nested density prefixes',
      scalpClearanceMethod:'radial scalp function derived from current head; sampled validation only',
      sourceMeshRead:false,styleMeasured:false,physicalDensityMeasured:false,continuousCollisionCertified:false,dynamicsAccepted:false}};
  }
  return {generate,rootAt,groom,rules};
}
