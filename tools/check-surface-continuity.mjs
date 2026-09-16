// Source/metadata inspection only. Do not import or execute geometry or binding.
import {checkSurfaceRefinementSources} from './check-surface-refinement.mjs';
export function checkSurfaceContinuitySources({read,parse,headers,assert}){
 let checks=0;const check=(ok,message)=>{assert(ok,'Surface continuity file contract: '+message);checks++;};
 const topology=read('reconstruction/topology.mjs'),mesher=read('reconstruction/mesher.mjs'),assembly=read('reconstruction/assembly.mjs');
 const binding=read('reconstruction/binding.mjs'),renderer=read('body/CompactWorkbench.js'),worker=read('reconstruction/worker.mjs');
 const tree=parse(binding,{ecmaVersion:'latest',sourceType:'module'});
 const functionBody=name=>{const n=tree.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='createCompactBindingTools').body.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);check(!!n,'declared '+name);return binding.slice(n.start,n.end);};
 const field=functionBody('buildCompactBinding'),gather=functionBody('bindCompactArrays');
 check(/new CanonicalTopology\(anatomyReference\)/.test(assembly)&&assembly.includes('sampleCompactGroup(name,decoded.data,quality,progress,normalField,bindingSchema,topology,surfaceCorrections)'),'all groups receive one anatomically constrained canonical registry with the shared surface corrections');
 check(assembly.indexOf('connectInterfaces(topology')<assembly.indexOf('topology.finalize(rawMeshes)')&&assembly.indexOf('topology.finalize(rawMeshes)')<assembly.indexOf('topology.materialize(raw)'),'connect and conform before encoding');
 check(/conformTrimFaces\(uv,faces\)/.test(mesher)&&/topology\.markBoundary\(ids\[k\],ids\[\(k\+1\)%ids\.length\]\)/.test(mesher),'recover trim knots before shared adaptive splits');
 check((mesher.match(/boundaryTolerance:0/g)||[]).length===5,'all quality levels preserve canonical trim chains');
 check(/topology\.split\(b\.vertex\(x\),b\.vertex\(y\),b\.vertex\(m\)\)/.test(mesher)&&/topology\.midpoint/.test(mesher),'adaptive splits are recorded and reused');
 check(/this\.splits\.get\(edgeKey\(a,b\)\)/.test(topology)&&/stack\.push\(\[split\.id,b,c\],\[a,split\.id,c\]\)/.test(topology),'final triangles consume the global edge forest');
 check(/p\.a\.samples\(\)/.test(topology)&&/p\.b\.samples\(\)/.test(topology)&&/p\.a\.ensure\(ts\);p\.b\.ensure\(ts\)/.test(topology),'interfaces propagate both refined boundary chains');
 check(/!this\.hasNormal\[id\]&&this\.hasNormal\[a\]&&this\.hasNormal\[b\]/.test(topology)&&/this\.stats\.inheritedBoundaryNormals\+\+/.test(topology)&&/missingSourceNormals:missingNormals\.size/.test(topology),'inserted interface points inherit valid source normals and missing directions stay observable');
 check(/topology\.shareBinding\(a\[k\],b\[k\]\)/.test(topology)&&/parents\[Math\.max\(x,y\)\]=Math\.min\(x,y\)/.test(topology),'paired interfaces use one deformation identity');
 check(/registerRadialBoundary\(topology,chains\.get\(y\)/.test(mesher)&&/rings\.values\(\)/.test(mesher)&&/topology\.requirePoints\(a,b,required\)/.test(topology),'radial ends inherit and refine source trim knots');
 check(/encoded=p\.map\(Math\.fround\)/.test(topology)&&/vertexIds=new Uint32Array\(count\)/.test(topology)&&/vertexIds\[local\]=id/.test(topology),'canonical coordinates and identities materialize together in exact-sized buffers');
 check(/p=Float32Array\.from\(positions\)/.test(mesher)&&/vertexIds\.push\(m\.vertexIds\[id\]\)/.test(mesher),'draw chunks copy canonical positions and identities');
 check(!/positions=new Uint16Array|positions\[.*65535|65535\*extent/.test(mesher),'per-group position quantization is absent');
 check(/m\.vertexIds\.buffer/.test(worker)&&/transfers\.push\(result\.bindingRoots\.buffer\)/.test(worker),'worker transfers both levels of identity');
 check(/field=buildCompactBinding\(result,data\.rig,progress\)/.test(worker)&&/mesh\.binding=bindCompactArrays\(mesh,data\.rig,field\)/.test(worker)&&/const binding=m\.binding/.test(renderer),'one worker field precedes per-chunk binding and upload');
 check(!/compactInfluences|Math\.round|Math\.floor|\/65535/.test(gather)&&/field\.ids\.subarray/.test(gather)&&/field\.weights\.subarray/.test(gather),'chunks gather an already encoded common row');
 check(/roots\[roots\[id\]\]!==roots\[id\]/.test(field)&&/Object\.is\(canonical\[id\*3\+k\],mesh\.positions\[i\*3\+k\]\)/.test(field),'runtime validates roots and bit-identical shared positions');
 check(/masks\[node\]\|=mask;members\[node\]\+\+/.test(field)&&/positions\[i\*3\+k\]\/=members\[i\]/.test(field),'each binding cluster combines its source priors once');
 check(/mesh\.indices\[k\+2\]/.test(field)&&/callback\(u,v\);callback\(v,u\)/.test(field)&&/next=d\+edgeLength\[at\]/.test(field),'diffusion band follows generated surface edges');
 check(/1\/Math\.max\(\.001,length\)/.test(field)&&/fidelity=\.18\+\.82\*r2Smooth/.test(field)&&/scratch\[id\]\/kept/.test(field),'positive normalized screened field with sparse projection');
 check(/mask&8/.test(field)&&/hipHalf\*\.45/.test(field)&&/pinned\[i\]\?\[\['hips',1\]\]/.test(field),'pelvic midline remains pinned to the pelvis');
 check(/COMPACT_INFLUENCES=8,COMPACT_WEIGHT_SCALE=65535/.test(binding)&&/COMPACT_WEIGHT_SCALE-quant\.reduce/.test(field),'eight influences and exact 16-bit integer partition');
 check(/maximumPrunedMass/.test(field)&&/converged:!active\.length\|\|maximumChange<tolerance/.test(field)&&/maximumQuantizationError/.test(field),'runtime exposes approximation and convergence limits');
 check(/attr\(0,m\.positions,3,gl\.FLOAT,false\)/.test(renderer)&&/pair\(2,5,binding\.ids,false\);pair\(3,6,binding\.weights,true\)/.test(renderer),'Float32 position and paired joint attributes');
 check(/\[\[first,0\],\[second,8\]\]/.test(renderer)&&/location,4,gl\.UNSIGNED_SHORT,normalized,16,offset/.test(renderer),'eight uint16 values share one buffer with matching stride');
 for(const [location,name]of [[5,'skinJointsExtra'],[6,'skinWeightsExtra']])check(renderer.includes(`layout(location=${location})in vec4 ${name};`),'shader extra attribute '+name);
 check(/skinJointsExtra\[k\]/.test(renderer)&&/skinWeightsExtra\[k\]/.test(renderer)&&/binding\.weights\[v\*COMPACT_INFLUENCES\+i\]\/COMPACT_WEIGHT_SCALE/.test(binding),'GPU and support probes consume all eight weights');
 check(/unpairedInterfaceEdges/.test(topology)&&/closedEdgeIncidence:/.test(topology)&&/fullClosedManifold:false,vertexLinkCheck:false,selfIntersectionCheck:false/.test(topology),'edge counts are not presented as a complete manifold certificate');
 const interfaces=headers.get('interfaces'),strips=[];
 for(const s of interfaces.body)strips.push([['left',s.oldCurveId,s.oldParameterRange],['body',s.newCurveId,s.newParameterRange]]);
 for(const s of interfaces.detail)strips.push([['body',s.bodyCurveId,s.bodyParameterRange],['detail',s.detailCurveId,s.detailParameterRange]]);
 for(const s of interfaces.ankle)strips.push([[s.fromSurface,s.fromCurveId,s.fromParameterRange],[s.toSurface,s.toCurveId,s.toParameterRange]]);
 for(const strip of strips)for(let [group,id,range]of strip){
  if(group==='body'&&!id.startsWith('body_extension/'))group='left';
  const curve=headers.get(group)?.boundaries.curves.find(c=>c.id===id);
  check(!!curve,'existing interface curve '+id);
  check(range.length===2&&range.every(Number.isFinite)&&range[0]!==range[1]&&range.every(t=>t>=0&&t<=1),'nonempty forward/reversed parameter interval '+id);
 }
 const contract=JSON.parse(read('body/HumanDNAContract.json')),recipe=contract.structureRecipes.find(r=>r.id==='binding');
 check(recipe.function==='buildCompactBinding'&&contract.precisionPolicy.influences===8,'exported recipe describes the common field');
 check(contract.acceptance.runtimeVerified===false&&contract.acceptance.visualAcceptance===false,'file audit has no runtime or visual acceptance');
 const refinement=checkSurfaceRefinementSources({read,parse,assert});
 return {checks,refinement,sourceInterfaceStrips:strips.length,positionEncoding:'canonical-float32',influences:8,applicationExecuted:false,geometryGenerated:false,weightSolverExecuted:false,visualAcceptance:false};
}
