// Inspect parameter containers and module wiring. Never import a generator.
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,dirname,resolve,relative} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {checkSurfaceContinuitySources} from './check-surface-continuity.mjs';

export function checkReconstructionSources({root,parse,read,runtime,assert}){
 let checks=0;
 const check=(ok,message)=>{assert(ok,'Reconstruction file contract: '+message);checks++;};
 const manifest=JSON.parse(read('reconstruction/parameters.json'));
 const names=['body','left','detail','features','collar','interfaces','normal-field'];
 check(manifest.schema==='fast-human-functions/v1'&&manifest.groups.length===names.length,'parameter manifest');
 check(manifest.containsDisplayVertices===false&&manifest.containsTriangleIndices===false&&manifest.visualAcceptance===false,'parameter and acceptance scope');
 check(new Set(manifest.groups.map(g=>g.name)).size===names.length,'unique groups');
 let parameterBytes=0,coefficientArrays=0;
 const parameterPaths=[],headers=new Map();
 for(const group of manifest.groups){
  check(names.includes(group.name)&&group.file===group.name+'.chf.gz','known parameter file');
  const path='reconstruction/'+group.file,packed=readFileSync(join(root,path));
  parameterPaths.push(path);parameterBytes+=packed.length;
  check(packed.length===group.bytes&&createHash('sha256').update(packed).digest('hex')===group.sha256,'exact parameter hash: '+path);
  check(packed[0]===31&&packed[1]===139,'gzip signature');
  const raw=gunzipSync(packed),magic=raw.toString('ascii',0,8);
  check(['CHFN0001','CHFN0002'].includes(magic)&&raw.length>=16,'coefficient signature');
  const size=raw.readUInt32LE(8),count=raw.readUInt32LE(12);
  check(size>0&&16+size<=raw.length,'JSON header extent');
  const header=JSON.parse(raw.toString('utf8',16,16+size));
  headers.set(group.name,header.data);
  check(header.schema==='compact-human-functions/v1'&&header.arrays.length===count,'coefficient schema');
  let offset=16+size,allExtents=true;
  for(const a of header.arrays){
   const bytes=a.byteLength??4*a.count,encoding=a.encoding??'byte-planes';
   allExtents&&=Number.isSafeInteger(a.count)&&a.count>=0&&[0,1,2].includes(a.order)&&Number.isSafeInteger(bytes)&&bytes>=0;
   allExtents&&=['byte-planes','zigzag-varint'].includes(encoding)&&(encoding!=='byte-planes'||bytes===4*a.count);
   allExtents&&=encoding!=='zigzag-varint'||bytes>=a.count&&bytes<=5*a.count;
   offset+=bytes;
  }
  check(allExtents&&offset===raw.length,'all coefficient extents cover payload');
  const used=new Set();let validReferences=true,geometryKeys=false,finiteValues=true;
  function inspect(value){
   if(typeof value==='number')finiteValues&&=Number.isFinite(value);
   if(!value||typeof value!=='object')return;
   if(Object.hasOwn(value,'$array')){
    const id=value.$array;validReferences&&=Number.isInteger(id)&&id>=0&&id<count&&Object.keys(value).length===1;used.add(id);return;
   }
   for(const [key,child]of Object.entries(value)){
    geometryKeys||=/^(positions|vertices|triangles|indices|vertexPositions|triangleIndices)$/i.test(key);inspect(child);
   }
  }
  inspect(header.data);
  check(validReferences&&used.size===count,'all packed arrays have valid coefficient references');
  check(!geometryKeys&&finiteValues,'no stored display mesh channels');
  coefficientArrays+=count;
 }
 check(parameterBytes===manifest.totalBytes,'parameter byte total');
 const appearance=JSON.parse(read('reconstruction/appearance.json')),hairSettings=appearance.hair;
 check(manifest.appearanceFile==='appearance.json'&&appearance.schema==='human-reconstruction-appearance/v1','body and appearance manifest relationship');
 check(appearance.applicationExecuted===false&&appearance.visualAcceptance===false,'appearance acceptance scope');
 check(appearance.sourceFloorM===-.0781112&&appearance.sourceHipZM===.075,'R2 source-to-stage reference');
 const hairCatalog=JSON.parse(read('reconstruction/'+hairSettings.catalogFile)),defaultHairBudget=hairCatalog.qualities[hairCatalog.defaultQuality];
 check(hairSettings.enabledByDefault===true&&defaultHairBudget&&hairSettings.segmentsPerStrand===defaultHairBudget.segmentsPerStrand&&hairSettings.maximumStrands===defaultHairBudget.maximumStrands&&hairSettings.segmentsPerStrand<=6&&hairSettings.maximumStrands<=6000&&hairCatalog.qualities.balanced.segmentsPerStrand===6&&hairCatalog.qualities.balanced.maximumStrands===6000,'catalog-selected default stays within the original R15 balanced hair budget');
 check(hairSettings.referenceScreenshotStrands===87391,'historical screenshot count is explicitly a reference');
 const hairFiles=[hairSettings.ruleModule,hairSettings.rulesFile,hairSettings.scalpFile,hairSettings.domainsFile,hairSettings.catalogFile,hairSettings.profileModule,hairSettings.regionModule,hairSettings.styleModule];
 check(new Set(hairFiles).size===8&&hairFiles.every(f=>/^hair-[a-z0-9-]+\.(mjs|json)$/.test(f)),'local hair inputs');
 check(appearance.inputLocks.length===hairFiles.length&&new Set(appearance.inputLocks.map(x=>x.file)).size===8,'one lock per active hair input');
 let hairInputBytes=0;
 for(const lock of appearance.inputLocks){
  check(hairFiles.includes(lock.file),'known hair input');
  const bytes=readFileSync(join(root,'reconstruction',lock.file));hairInputBytes+=bytes.length;
  check(bytes.length===lock.bytes&&createHash('sha256').update(bytes).digest('hex')===lock.sha256,'exact R2 input hash: '+lock.file);
 }
 const rules=JSON.parse(read('reconstruction/'+hairSettings.rulesFile)),scalp=JSON.parse(read('reconstruction/'+hairSettings.scalpFile)),domains=JSON.parse(read('reconstruction/'+hairSettings.domainsFile));
 check(rules.schema==='human-hair-bundle-rules/v2'&&rules.seed===2026091102&&rules.style==='short-swept-back','original R2 grooming rules');
 check(rules.scalpCenter.length===3&&rules.scalpCenter.every((x,k)=>x===scalp.centre[k]),'hair rules and scalp share their coordinate centre');
 check(scalp.schema==='function-derived-scalp-radius/v1'&&scalp.nt===76&&scalp.np===128&&scalp.thetaMax===76*(2.22/64),'R2 scalar radius grid extended to the lower occiput from head functions');
 check(scalp.lowerBandSource?.sourceSHA256===manifest.groups.find(g=>g.name==='detail').sha256&&scalp.lowerBandSource.firstExtendedRow===65,'lower scalp extension belongs to the currently locked head functions');
 check(scalp.lowerBandSource.intersections+scalp.lowerBandSource.nearestPreviousRowFallbacks.length===12*scalp.np&&scalp.lowerBandSource.maximumIntersectionResidualM<1e-7,'lower scalp samples record direct intersections and explicit fallback directions');
 check(scalp.radii.length===(scalp.nt+1)*scalp.np&&scalp.radii.every(r=>Number.isFinite(r)&&r>0&&r<.3),'scalar grid extents and values');
 check(scalp.extendedDirections.every(p=>p.length===2&&p.every(Number.isInteger)&&p[0]>=0&&p[0]<=scalp.nt&&p[1]>=0&&p[1]<scalp.np),'scalar grid extension directions');
 check(domains.schema==='reconstruction-hair-domains/v1'&&/^[a-f0-9]{64}$/.test(domains.sourceAtlasSHA256),'domain metadata provenance');
 const detailFields=headers.get('detail').fields,headDomains=detailFields.domains.filter(d=>d.semanticRegion==='head_face_ears'),headById=new Map(headDomains.map(d=>[d.id,d]));
 check(detailFields.region==='detail_extension'&&headDomains.length===419&&domains.domains.length===headDomains.length&&new Set(domains.domains.map(d=>d.id)).size===headDomains.length,'every fitted head domain has one hair metadata record');
 const allowedKeys=['id','semanticRegion','heightAxis','projectionAxes','boundsMetres','minimumNormalProjection'];
 for(const d of domains.domains){
  const fitted=headById.get(d.id);
  check(!!fitted&&Object.keys(d).length===allowedKeys.length&&Object.keys(d).every(k=>allowedKeys.includes(k)),'metadata-only domain '+d.id);
  check(d.semanticRegion==='head_face_ears'&&d.heightAxis===fitted.heightAxis&&d.projectionAxes.every((x,k)=>x===fitted.projectionAxes[k]),'matching fitted chart axes '+d.id);
  check(d.boundsMetres.length===2&&d.boundsMetres.every(p=>p.length===3&&p.every(Number.isFinite))&&d.boundsMetres[0].every((x,k)=>x<=d.boundsMetres[1][k])&&d.minimumNormalProjection>0&&d.minimumNormalProjection<=1,'finite domain bounds '+d.id);
  check(d.projectionAxes.every((axis,k)=>d.boundsMetres[0][axis]>=fitted.uvBoundsMetres[0][k]&&d.boundsMetres[1][axis]<=fitted.uvBoundsMetres[1][k]),'R2 sampling domain lies inside fitted parameter bounds '+d.id);
 }
 const modules=[];
 function scan(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())scan(path);else if(/\.(mjs|js)$/.test(item.name))modules.push(path);}}
 scan(join(root,'reconstruction'));
 let importEdges=0;
 for(const path of modules){
  const tree=parse(readFileSync(path,'utf8'),{ecmaVersion:'latest',sourceType:'module'});
  for(const node of tree.body){
   if(!node.source)continue;
   const spec=node.source.value,target=resolve(dirname(path),spec),rel=relative(join(root,'reconstruction'),target);
   check(spec.startsWith('./')&&!rel.startsWith('..')&&statSync(target).isFile(),'local module dependency '+spec);importEdges++;
  }
 }
 const bridge=read('body/CompactWorkbench.js'),worker=read('reconstruction/worker.mjs'),assembly=read('reconstruction/assembly.mjs'),hair=read('reconstruction/hair.mjs'),hairRenderer=read('body/CompactHairRenderer.js');
 check(/new URL\('reconstruction\/worker\.mjs',document\.baseURI\)/.test(bridge)&&/new window\.Worker\(url,\{type:'module'\}\)/.test(bridge),'same-origin module worker');
 check(/interfaces\.chf\.gz/.test(assembly)&&/normal-field\.chf\.gz/.test(assembly)&&/\['body','left','detail','features','collar'\]/.test(assembly),'all seven parameter inputs are reachable');
 check(/const transfers=result\.meshes\.flatMap\(m=>\[m\.positions\.buffer,m\.canonicalPositions\.buffer,m\.normals\.buffer,m\.indices\.buffer,m\.regionMasks\.buffer,m\.vertexIds\.buffer,m\.binding\.ids\.buffer,m\.binding\.weights\.buffer,m\.binding\.colors\.buffer\]\)/.test(worker)&&/transfers\.push\(result\.hair\.segments\.buffer\)/.test(worker)&&/postMessage\(\{type:'complete',\.\.\.result\},\[\.\.\.new Set\(transfers\)\]\)/.test(worker),'personal positions, canonical coordinates, binding and hair buffers transfer once through a deduplicated worker list');
 check(/for\(const mesh of result\.meshes\)if\(mesh\.axillaDelta\)transfers\.push\(mesh\.axillaDelta\.buffer,mesh\.axillaNormals\.buffer\)/.test(worker),'both optional axilla endpoint attributes join the same deduplicated transfer list');
 check(/includeHair:data\.includeHair===true/.test(worker)&&/function loadCompactSurfaceJob\(quality='preview',includeHair=false,rig=null,job='surface',hairProfile=null,shape=rig\?\.shape\)/.test(bridge)&&/function loadCompactSurface\(\.\.\.args\)/.test(bridge)&&/return loadCompactSurfaceJob\(\.\.\.args\)/.test(bridge)&&/if\(reviewMode!=='face'\)scheduleCompactHair\(window\.HumanLab\.population\?\.active\|\|window\.HumanLab\)/.test(runtime),'queued startup schedules profile hair after the body and carries every personal shape');
 check(/generateReconstructionHair\(result\.surface,hairInputs,progress,hairProfile\)/.test(assembly)&&/name==='detail'&&hairInputs/.test(assembly),'optional combined generation still samples the current body head surface');
 check(/loadHairInputs\(load\)/.test(assembly)&&/json\('appearance\.json'\)/.test(hair)&&['rulesFile','scalpFile','domainsFile','catalogFile'].every(k=>hair.includes('json(appearance.hair.'+k+')')),'all locked hair parameters are reachable');
 check(/surface\.makeChart\(id\)/.test(hair)&&/if\(!chart\.inside\(u,v\)\)return null/.test(hair)&&/position:q\.p,geometricNormal:q\.n/.test(hair),'R2 curve evaluator maps to fitted chart API');
 check(/from '\.\/hair-rules-r2\.mjs'/.test(hair)&&/referenceScreenshotStrands:settings\.referenceScreenshotStrands/.test(hair)&&/\.\.\.hair\.report/.test(hair),'derived R2 rules distinguish display population and historical reference');
 check(/new Float32Array\(maximumStrands\*count\*9\)/.test(hair)&&/storage\.set\(\[\.\.\.previous,\.\.\.next,radius,nextRadius,tone\]/.test(hair),'bounded nine-float segment writer');
 check(/\[\[1,3,0\],\[2,3,3\],\[3,2,6\],\[4,1,8\]\]/.test(hairRenderer)&&/false,36,offset\*4/.test(hairRenderer)&&/vertexAttribDivisor\(location,1\)/.test(hairRenderer)&&/data\.segments\.length\/9/.test(hairRenderer),'renderer reads the same instanced segment layout');
 check(/drawElementsInstanced\(gl\.TRIANGLES,6,gl\.UNSIGNED_SHORT,0,this\.drawSegmentCount\)/.test(hairRenderer)&&/this\.triangles=this\.drawSegmentCount\*2/.test(hairRenderer),'two triangles per active hair segment');
 check(/j=>j\.id==='head'/.test(hairRenderer)&&/texelFetch\(compactPalette,ivec2\(0,hairJoint\),0\)/.test(hairRenderer)&&/vec3\(-segmentStart\.x,segmentStart\.yz\)/.test(hairRenderer),'hair and body share reflected source coordinates and head motion');
 check(/COMPACT_PALETTE_UNIT=5/.test(bridge)&&/TEXTURE0\+COMPACT_PALETTE_UNIT/.test(bridge)&&[bridge,hairRenderer].every(s=>/uniform1i\(p\.u\.compactPalette,COMPACT_PALETTE_UNIT\)/.test(s)),'body and hair use the same palette without clobbering procedural hair unit 4');
 check(/await installCompactWorkbench\(window\.HumanLab,compactSurfaceReady\)/.test(runtime),'workbench waits for reconstruction');
 check(runtime.indexOf('await installCompactWorkbench(')<runtime.indexOf("status:'ready',stage:'ready'"),'ready follows reconstruction binding');
 check(runtime.includes('drawCompacts=this.activeCompacts().filter(surface=>surface.prepare(items))')&&runtime.includes('replaced=new Set(drawCompacts.flatMap(surface=>[...surface.replaced]))')&&runtime.includes('items=items.filter(o=>o.g&&!replaced.has(o))')&&runtime.includes('for(const surface of drawCompacts)surface.draw(true)')&&runtime.includes('for(const surface of drawCompacts){surface.draw(false);'),'every active reconstructed surface replaces its skin in both rendering passes');
 check(/pair\(2,5,binding\.ids,false\)/.test(bridge)&&/pair\(3,6,binding\.weights,true\)/.test(bridge),'joint attribute encoding');
 check(!/id=["']compact-model["']|procedural-comparison/.test(bridge),'old body selector is absent');
 const bridgeTree=parse(bridge,{ecmaVersion:'latest',sourceType:'module'}),surfaceClass=bridgeTree.body.find(n=>n.type==='ClassDeclaration'&&n.id.name==='CompactSurfaceRenderer');
 const method=name=>{const n=surfaceClass.body.body.find(n=>n.key.name===name);check(!!n,'surface method '+name);return bridge.slice(n.start,n.end);};
 const prepare=method('prepare'),palette=method('updatePalette');
 check(!/enabled\s*=|inStudio/.test(prepare),'visibility checks cannot disable the selected reconstruction');
 check(/this\.view=items\.includes\(t\.skin\)\?t\.view:items\.includes\(t\.clay\)\?'clay':null/.test(prepare)&&/this\.surface\.view==='skin'/.test(hairRenderer),'inspector surface requests determine body material and hair visibility');
 check(/h\.canonicalSourceBind=r2SourceFrames\(\);h\.sourceBind=r2SourceFrames\(reference\)/.test(read('body/ReconstructionRig.js')),'same-source canonical and personal neutral frames are constructed');
 check(/this\.controlBind=lab\.human\.sourceBind/.test(bridge),'display binds to actual atlas rig frames');
 check(/qm\(j\.world\.q,inv\(source\.q\)\)/.test(palette)&&/sub\(j\.world\.p,rotate\(q,source\.p\)\)/.test(palette),'palette uses one source-to-current transform');
 check(runtime.includes('for(const surface of drawCompacts){surface.draw(false);surface.hair?.draw();}')&&!/const drawHair=/.test(runtime),'each active R2 surface draws only its own generated hair');
 check(/loadCompactSurface\(select\.value,false,requestSurface\.rig\)/.test(bridge)&&/lab\.compact!==requestSurface\|\|requestSurface\.disposed/.test(bridge)&&/!data\.hair&&this\.hair\?\{hair:this\.hair\.report,hairEnabled:true\}/.test(bridge)&&/if\(stage\.hair\)this\.hair=stage\.hair/.test(bridge),'quality changes retain the same generated hair and reject a replaced character');
 check(/lab\.hairStatus=\{state:lab\.compact\.hair\?'ready':'pending'\}/.test(bridge)&&/compact-hair-retry/.test(bridge)&&/enabled:true/.test(read('body/CompactHairControls.js')),'default hair is deferred explicitly and has local retry on failure');
 check(/lab\.hair\.closeup\('front'\)/.test(bridge)&&/installReconstructionHair/.test(read('body/CompactHairControls.js')),'head camera and profile controls are installed');
 check(/const COMPACT_EYES=/.test(bridge)&&/compactEyeUV\(R\)/.test(bridge)&&['compactEyeCentre','compactEyeU','compactEyeV'].every(s=>bridge.includes('gl.uniform3fv(p.u.'+s)),'R2 eye frame is used by material and shadow shaders');
 check(/updateCompactRenderInfo\(this\)/.test(runtime)&&bridge.includes('.filter(c=>c.visible&&!c.disposed)')&&bridge.includes('compacts.reduce((total,c)=>total+c.report.vertices,0)')&&bridge.includes('compacts.reduce((total,c)=>total+(c.hair?.visible?c.hair.report.strands:0),0)')&&bridge.includes('vertices.toLocaleString()')&&bridge.includes('strands.toLocaleString()'),'display statistics total only currently visible bodies and actual visible hair');
 check(/appearance:copy\(COMPACT_APPEARANCE\),parameterManifest:copy\(COMPACT_PARAMETERS\)/.test(read('body/HumanDNA.js')),'exported character recipe identifies fitted display inputs');
 check(/compactPerformance\?\.begin\(\)/.test(runtime)&&/compactPerformance\?\.end\(\)/.test(runtime),'performance sample brackets renderer');
 check(/\.mjs['"]:\s*['"]text\/javascript/.test(read('server/start_server.py')),'server module MIME type');
 check(/data-utility=tasks/.test(bridge)&&/sceneBtn/.test(bridge),'existing task and scene entries');
 check(/compactPendingWorker\?\.terminate\(\)/.test(bridge)&&/lab\.compact\.dispose\(\)/.test(bridge),'iframe unload releases worker and buffers');
 const surfaceContinuity=checkSurfaceContinuitySources({read,parse,headers,assert});
 return {checks,surfaceContinuity,parameterFiles:parameterPaths.length,parameterBytes,coefficientArrays,hairInputFiles:hairFiles.length,hairInputBytes,headDomainMetadata:headDomains.length,scalpRadiusCoefficients:scalp.radii.length,defaultAppearance:appearance.version,modulesParsed:modules.length,importEdges,parameterPaths,applicationExecuted:false,visualAcceptance:false};
}
