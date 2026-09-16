/** Stream parameter groups, build a temporary display mesh, then release worker. */
import {decodeCompactHuman} from './codec.mjs';
import {sampleCompactGroup,smoothAndQuantize,QUALITY} from './mesher.mjs';
import {createCompactNormalField} from './normal-field.mjs';
import {generateReconstructionHair,loadHairInputs} from './hair.mjs';
import {createCompactSurface} from './surface-kernel.mjs';
import {CanonicalTopology,boundaryTrack,connectInterfaces} from './topology.mjs';
import {createToeSeparation} from './toe-separation.mjs';
import {createAxillaShape} from './axilla-shape.mjs';
function interfaceStrips(data){
  const strips=[];
  for(const b of data.body)strips.push({id:b.id,a:['left',b.oldCurveId,b.oldParameterRange],b:['body',b.newCurveId,b.newParameterRange]});
  for(const b of data.detail)strips.push({id:b.id,a:['body',b.bodyCurveId,b.bodyParameterRange],b:['detail',b.detailCurveId,b.detailParameterRange]});
  for(const b of data.ankle)strips.push({id:b.id,a:[b.fromSurface,b.fromCurveId,b.fromParameterRange],b:[b.toSurface,b.toCurveId,b.toParameterRange]});
  for(const s of strips)for(const key of ['a','b'])if(s[key][0]==='body'&&!s[key][1].startsWith('body_extension/'))s[key][0]='left';
  return strips;
}
// Hair is a separate request after the body is usable. It evaluates the same
// locked head functions without rebuilding display triangles or binding.
export async function generateCompactHair({load,progress=()=>{},hairProfile={}}){
  const inputs=await loadHairInputs(load);
  if(hairProfile?.preset==='bald')return generateReconstructionHair(null,inputs,progress,hairProfile);
  const decoded=await decodeCompactHuman(await load('detail.chf.gz')),surface=createCompactSurface(decoded.data);
  try{return generateReconstructionHair(surface,inputs,progress,hairProfile);}
  finally{surface.clearBoundaryCache();}
}
export async function generateCompactHuman({load,quality='balanced',progress=()=>{},onGroup=()=>{},onMeshes=null,includeHair=true,hairProfile={}}){
  if(!QUALITY[quality])throw Error('Unknown quality');const start=performance.now();
  const bindingSchema=JSON.parse(new TextDecoder().decode(await load('binding-schema.json')));
  const anatomyReference=JSON.parse(new TextDecoder().decode(await load('rig-reference.json')));
  const surfaceCorrections=[createToeSeparation(anatomyReference),createAxillaShape(anatomyReference)],correctionReports=surfaceCorrections.map(c=>({...c.report,changedVertexOccurrences:0,maximumDisplacementM:0,minimumLocalJacobian:1}));
  let hair=null,hairInputs=null;
  if(includeHair){
    hairInputs=await loadHairInputs(load);
  }
  const interfaces=await decodeCompactHuman(await load('interfaces.chf.gz')),strips=interfaceStrips(interfaces.data),tracks=new Map(),meshes=[],rawMeshes=[],groups=[],topology=new CanonicalTopology(anatomyReference),normalData=await decodeCompactHuman(await load('normal-field.chf.gz')),normalField=createCompactNormalField(normalData.data);
  let peakDecodedGroupBytes=0,maximumPositionQuantization=0,maximumNormalQuantizationRadians=0,normalMilliseconds=0,triangles=0,vertices=0,attributeBytes=0;
  function finish(raw){const t=performance.now(),packed=smoothAndQuantize(raw,normalField,surfaceCorrections);normalMilliseconds+=performance.now()-t;
    for(let i=0;i<packed.correctionStats.length;i++){const stat=packed.correctionStats[i],total=correctionReports[i];total.changedVertexOccurrences+=stat.changedVertexOccurrences;total.maximumDisplacementM=Math.max(total.maximumDisplacementM,stat.maximumDisplacementM);total.minimumLocalJacobian=Math.min(total.minimumLocalJacobian,stat.minimumLocalJacobian);}
    maximumPositionQuantization=Math.max(maximumPositionQuantization,packed.maximumPositionQuantization);maximumNormalQuantizationRadians=Math.max(maximumNormalQuantizationRadians,packed.maximumNormalQuantizationRadians);
    for(const m of packed.meshes){triangles+=m.triangles;vertices+=m.vertices;attributeBytes+=m.attributeBytes;}
    if(onMeshes)onMeshes(packed.meshes);else meshes.push(...packed.meshes);}
  for(const name of ['body','left','detail','features','collar']){
    const t=performance.now(),decoded=await decodeCompactHuman(await load(name+'.chf.gz')),loaded=performance.now();peakDecodedGroupBytes=Math.max(peakDecodedGroupBytes,decoded.statistics.decodedBytes+decoded.statistics.coefficientArrayBytes);
    const result=await sampleCompactGroup(name,decoded.data,quality,progress,normalField,bindingSchema,topology,surfaceCorrections);
    if(name==='detail'&&hairInputs){
      progress({group:'hair',domain:0,total:hairInputs.domains.domains.length});
      await new Promise(resolve=>setTimeout(resolve,0));
      hair=generateReconstructionHair(result.surface,hairInputs,progress,hairProfile);hairInputs=null;
      progress({group:'hair',domain:hair.report.strands,total:hair.report.strands});
    }
    for(const s of strips)for(const side of ['a','b']){const [tag,id,range]=s[side];if(tag!==name)continue;
      const curve=decoded.data.boundaries.curves.find(c=>c.id===id);
      const domains=decoded.data.fields.domains;
      const masks=curve.region!==decoded.data.fields.region&&name==='left'?[bindingSchema.tubeMask]:curve.owners.filter(i=>i>=0).map(i=>bindingSchema.regions[domains.find(d=>d.id===i)?.semanticRegion]);
      const regionMask=masks.reduce((a,b)=>a|b,0);
      if(!regionMask)throw Error('Interface lost source region '+id);
      tracks.set(s.id+'/'+side,boundaryTrack(topology,result.surface.polyline(id),range,regionMask));}
    for(const m of result.meshes)m.sourceGroup=name;
    const stat={...result.stats,decodeMilliseconds:loaded-t,samplingMilliseconds:performance.now()-loaded};groups.push(stat);onGroup(stat);
    result.surface.clearBoundaryCache();rawMeshes.push(...result.meshes);
  }
  progress({group:'connections',domain:0,total:1});await new Promise(resolve=>setTimeout(resolve,0));
  const connected=connectInterfaces(topology,strips,tracks);rawMeshes.push(connected.mesh);
  progress({group:'connections',phase:'conform',domain:0,total:rawMeshes.length});
  const settled=topology.finalize(rawMeshes);rawMeshes.length=0;tracks.clear();
  // Encoding and GPU chunking happen only after shared edge connectivity and
  // binding identities have been finalized across ALL parameter groups.
  for(let i=0;i<settled.meshes.length;i++){const raw=settled.meshes[i];progress({group:'normals',domain:i,total:settled.meshes.length});finish([topology.materialize(raw)]);raw.indices=null;settled.meshes[i]=null;}
  topology.releaseGeometry();
  progress({group:'connections',domain:1,total:1});
  return {meshes,hair,bindingRoots:settled.roots,report:{schema:'compact-human-display/v2',quality,groups,hairEnabled:!!hair,hair:hair?.report||null,
    triangles,vertices,attributeBytes,precisionLimited:groups.some(g=>g.refinementLimitCount>0),budgetLimitedTriangles:groups.reduce((n,g)=>n+g.budgetLimitedTriangles,0),maximumPositionQuantizationMm:maximumPositionQuantization*1000,
    maximumNormalQuantizationDegrees:maximumNormalQuantizationRadians*180/Math.PI,
    bridgeCount:strips.length,bridgeSampling:'shared refined source edge chains',interfaceKnotPasses:connected.passes,topology:settled.report,peakDecodedGroupPayloadBytes:peakDecodedGroupBytes,
    normalMilliseconds,generationMilliseconds:performance.now()-start,streamedToCaller:!!onMeshes,
    sourceRegionsPreserved:true,surfaceCorrections:correctionReports,bindingSchema:bindingSchema.schema,meshFilesLoaded:false,parameterOnlyInputs:true,positionEncoding:'canonical-float32',normalEncoding:'octahedral-snorm16x2',indexEncoding:'uint16-per-chunk',fullPositionCertificateExtendedToDisplay:false}};
}
