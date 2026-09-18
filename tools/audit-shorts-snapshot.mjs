// Read-only finite-sample QA. No cloth simulation, no correction, no render surrogate.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {dirname,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const finiteVector=(p,n)=>Array.isArray(p)&&p.length===n&&p.every(Number.isFinite);
const average=points=>points[0].map((_,k)=>points.reduce((sum,p)=>sum+p[k],0)/points.length);
const sha256=data=>createHash('sha256').update(data).digest('hex');

export function loadAuditBody(fixture){
 const sourceFiles=['source/runtime.template.js','body/CompactBinding.js','body/CompactMuscles.js','clothing/ShortsBody.js'],texts=sourceFiles.map(file=>readFileSync(resolve(root,file),'utf8'));
 const ShortsBody=new Function(texts[0].split('// MODULE mesh')[0]+'\n'+texts.slice(1).join('\n')+'\nreturn ShortsBody;')();
 if(!Array.isArray(fixture.sourceBind)||!Array.isArray(fixture.joints)||!Array.isArray(fixture.meshes))throw Error('Body fixture must contain sourceBind, committed joint world frames and original skin meshes');
 const human={sourceBind:new Map(fixture.sourceBind),joints:fixture.joints,byId:new Map(fixture.joints.map(j=>[j.id,j])),spine:fixture.joints.filter(j=>/^[CTL]\d+$/.test(j.id)),characterPreset:{shape:fixture.shape||{}}};
 const body=new ShortsBody({boundHuman:human,statureScale:fixture.statureScale},fixture.meshes);
 return {body,measurements:body.measure(),sourceFiles:sourceFiles.map((file,i)=>({file,sha256:sha256(texts[i])}))};
}

export function auditShortsSnapshot(snapshot,body,{clearanceM=0,groundYM=0,toleranceM=1e-6,candidateLimit=24}={}){
 if(!snapshot||!Array.isArray(snapshot.pieces)||!snapshot.pieces.length)throw Error('Expected an actual ShortsCloth snapshot with pieces');
 if(!Number.isFinite(clearanceM)||clearanceM<0||!Number.isFinite(groundYM)||!Number.isFinite(toleranceM)||toleranceM<0||!Number.isInteger(candidateLimit)||candidateLimit<1||candidateLimit>1000)throw Error('Invalid audit limits');
 const started=performance.now(),counts={vertex:0,edgeMidpoint:0,triangleCentroid:0},kinds=Object.fromEntries(Object.keys(counts).map(k=>[k,{count:0,violations:0,sideUncertainCount:0,maxSkinPenetrationM:0,maxClearanceViolationM:0,worst:null}])),pieces=[],candidates=[];
 let minimumY=Infinity,groundWitness=null,triangleCount=0,invalidRestTriangles=0,degenerateCurrentTriangles=0,sideUncertainCount=0,uncertainExample=null,interiorViolationsWithClearSupportVertices=0,maxSkinPenetrationM=0,maxClearanceViolationM=0,worst=null;
 const inspect=(piece,kind,indices,localTriangles,vertexResults=null)=>{
  const point=average(indices.map(i=>piece.positions[i])),originalUV=average(indices.map(i=>piece.materialCoordinates[i])),hit=body.closest(point,1);
  if(!Number.isFinite(hit?.signedDistance)||!finiteVector(hit.point,3)||!finiteVector(hit.normal,3))throw Error('Non-finite body query result');
  const penetrationM=hit.sideUncertain?null:Math.max(0,-hit.signedDistance),clearanceViolationM=hit.sideUncertain?null:Math.max(0,clearanceM-hit.signedDistance),supportVerticesClear=vertexResults?indices.every(i=>!vertexResults[i].sideUncertain&&vertexResults[i].clearanceViolationM<=toleranceM):null;
  const sample={pieceId:piece.id,kind,localTriangles:[...localTriangles],localVertexIndices:[...indices],point,originalUV,signedBodyDistanceM:hit.sideUncertain?null:hit.signedDistance,sideUncertain:!!hit.sideUncertain,sideMethod:hit.sideMethod??null,sideEvidence:hit.sideEvidence??null,euclideanBodyDistanceM:hit.distance??Math.abs(hit.signedDistance),skinPenetrationM:penetrationM,clearanceViolationM,supportVerticesClear,bodyTriangleId:hit.triangleId,bodyClosestFeature:hit.closestFeature??null,bodyPoint:[...hit.point],bodyNormal:[...hit.normal],bodyFeatureNormal:hit.featureNormal?[...hit.featureNormal]:null,bodyBarycentric:[...hit.barycentric]};
  counts[kind]++;const stat=kinds[kind];stat.count++;if(hit.sideUncertain){sideUncertainCount++;stat.sideUncertainCount++;uncertainExample??=sample;return sample;}stat.maxSkinPenetrationM=Math.max(stat.maxSkinPenetrationM,penetrationM);stat.maxClearanceViolationM=Math.max(stat.maxClearanceViolationM,clearanceViolationM);
  if(!stat.worst||sample.signedBodyDistanceM<stat.worst.signedBodyDistanceM)stat.worst=sample;
  if(!worst||sample.signedBodyDistanceM<worst.signedBodyDistanceM)worst=sample;
  maxSkinPenetrationM=Math.max(maxSkinPenetrationM,penetrationM);maxClearanceViolationM=Math.max(maxClearanceViolationM,clearanceViolationM);
  if(clearanceViolationM>toleranceM){stat.violations++;if(kind!=='vertex'&&supportVerticesClear)interiorViolationsWithClearSupportVertices++;candidates.push(sample);candidates.sort((a,b)=>b.clearanceViolationM-a.clearanceViolationM);if(candidates.length>candidateLimit)candidates.length=candidateLimit;}
  return sample;
 };
 const pieceIds=new Set();
 for(const piece of snapshot.pieces){
  if(typeof piece.id!=='string'||pieceIds.has(piece.id)||!Array.isArray(piece.positions)||!piece.positions.length||!Array.isArray(piece.materialCoordinates)||piece.materialCoordinates.length!==piece.positions.length||!Array.isArray(piece.triangles))throw Error('Invalid or duplicate cloth piece');pieceIds.add(piece.id);
  if(piece.positions.some(p=>!finiteVector(p,3))||piece.materialCoordinates.some(p=>!finiteVector(p,2)))throw Error('Invalid current positions or original 2D material coordinates: '+piece.id);
  const edges=new Map(),vertexFaces=piece.positions.map(()=>[]);
  for(let t=0;t<piece.triangles.length;t++){
   const tri=piece.triangles[t];if(!Array.isArray(tri)||tri.length!==3||tri.some(i=>!Number.isInteger(i)||i<0||i>=piece.positions.length)||new Set(tri).size!==3)throw Error('Invalid triangle '+piece.id+':'+t);
   triangleCount++;for(const i of tri)vertexFaces[i].push(t);
   const uv=tri.map(i=>piece.materialCoordinates[i]),du=[uv[1][0]-uv[0][0],uv[1][1]-uv[0][1]],dv=[uv[2][0]-uv[0][0],uv[2][1]-uv[0][1]];if(Math.abs(du[0]*dv[1]-du[1]*dv[0])<=1e-14)invalidRestTriangles++;
   const [a,b,c]=tri.map(i=>piece.positions[i]),u=b.map((v,k)=>v-a[k]),v=c.map((x,k)=>x-a[k]);if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<=1e-14)degenerateCurrentTriangles++;
   for(let k=0;k<3;k++){const ids=[tri[k],tri[(k+1)%3]].sort((a,b)=>a-b),key=ids.join(':');if(!edges.has(key))edges.set(key,{indices:ids,triangles:[]});edges.get(key).triangles.push(t);}
  }
  const before=Object.fromEntries(Object.entries(kinds).map(([k,v])=>[k,v.violations])),vertexResults=piece.positions.map((p,i)=>{if(p[1]<minimumY){minimumY=p[1];groundWitness={pieceId:piece.id,localVertexIndex:i,point:[...p],originalUV:[...piece.materialCoordinates[i]]};}return inspect(piece,'vertex',[i],vertexFaces[i]);});
  for(const edge of edges.values())inspect(piece,'edgeMidpoint',edge.indices,edge.triangles,vertexResults);
  for(let t=0;t<piece.triangles.length;t++)inspect(piece,'triangleCentroid',piece.triangles[t],[t],vertexResults);
  pieces.push({pieceId:piece.id,vertices:piece.positions.length,triangles:piece.triangles.length,uniqueEdges:edges.size,nonmanifoldEdges:[...edges.values()].filter(e=>e.triangles.length>2).length,violations:Object.fromEntries(Object.entries(kinds).map(([k,v])=>[k,v.violations-before[k]]))});
 }
 const violationCount=Object.values(kinds).reduce((sum,k)=>sum+k.violations,0);
 return {schema:'shorts-finite-surface-audit@1',snapshotVersion:snapshot.version,stepIndex:snapshot.stepIndex,time:snapshot.time,unit:'m',method:'global actual-body triangle closest query at original cloth vertices, unique edge midpoints and face centroids',clearanceM,toleranceM,counts,triangleCount,pieces,bySampleKind:kinds,maxSkinPenetrationM,maxClearanceViolationM,violationCount,sideUncertainCount,uncertainExample,interiorViolationsWithClearSupportVertices,vertexOnlyWouldMissAllViolations:kinds.vertex.violations===0&&violationCount>0,worst,candidates,candidateLimit,candidatesTruncated:violationCount>candidates.length,
  originalMaterialCoordinates:{provided:true,modified:false,invalidRestTriangleCount:invalidRestTriangles},degenerateCurrentTriangleCount:degenerateCurrentTriangles,
  ground:{planeYM:groundYM,minimumVertexYM:minimumY,minimumClearanceM:minimumY-groundYM,maximumPenetrationM:Math.max(0,groundYM-minimumY),thicknessAdjustedMinimumClearanceM:minimumY-groundYM-clearanceM,witness:groundWitness,linearTrianglePlaneMinimumAtVertex:true},
  sampledBodyClearancePassed:violationCount===0&&sideUncertainCount===0&&invalidRestTriangles===0&&degenerateCurrentTriangles===0,groundCentreSurfacePassed:minimumY>=groundYM-toleranceM,
  limitations:{finiteSamples:true,completeTriangleSurfaceCertificate:false,continuousCollisionDetection:false,selfIntersectionChecked:false,bodyPoseMustMatchSnapshot:true,bodySurfaceScope:body.sourceReport?.sourceHeightRangeM??null,visualAcceptance:false},
  simulationContext:{sewn:snapshot.report?.sewn??null,vertexOnlyBodyPenetrationM:snapshot.report?.bodyPenetrationM??null,maxPrincipalStrain:snapshot.report?.material?.maxAbsPrincipalStrain??null,peakPrincipalStrain:snapshot.report?.peakPrincipalStrain??null},elapsedMs:performance.now()-started};
}

async function main(){
 const positional=[],options={};for(let i=2;i<process.argv.length;i++){const token=process.argv[i];if(token==='--help'){console.log('node tools/audit-shorts-snapshot.mjs BODY_FIXTURE SNAPSHOT OUTPUT_JSON [--clearance M] [--ground-y M] [--top N]');return;}if(token.startsWith('--')){if(!['--clearance','--ground-y','--top'].includes(token))throw Error('Unknown option '+token);const value=Number(process.argv[++i]);if(!Number.isFinite(value))throw Error('Missing numeric option '+token);options[token]=value;}else positional.push(token);}
 if(positional.length!==3)throw Error('Expected BODY_FIXTURE SNAPSHOT OUTPUT_JSON; use --help');
 const [bodyPath,snapshotPath,outputPath]=positional.map(p=>resolve(p)),outputRelative=relative(root,outputPath);if(!outputRelative.startsWith('..')&&!isAbsolute(outputRelative))throw Error('Generated audit reports must be outside the source worktree');
 const bodyBytes=readFileSync(bodyPath),snapshotBytes=readFileSync(snapshotPath),fixture=JSON.parse(bodyBytes),snapshot=JSON.parse(snapshotBytes),sourcePath=resolve(dirname(snapshotPath),'source.json');let source=null;if(existsSync(sourcePath))source=JSON.parse(readFileSync(sourcePath,'utf8'));
 const clearanceM=options['--clearance']??source?.options?.thickness??0,{body,measurements,sourceFiles}=loadAuditBody(fixture),report=auditShortsSnapshot(snapshot,body,{clearanceM,groundYM:options['--ground-y']??0,candidateLimit:options['--top']??24});
 report.inputs={body:{path:bodyPath,sha256:sha256(bodyBytes),generatedAt:fixture.generatedAt??null,poseAuthority:'supplied committed world frames; caller must match capture to snapshot'},snapshot:{path:snapshotPath,sha256:sha256(snapshotBytes)},clearanceSource:options['--clearance']!==undefined?'explicit option':source?.options?.thickness!==undefined?'simulation source.json options.thickness':'zero surface clearance',sourceFiles};report.measurements=measurements;report.body=body.report();
 mkdirSync(dirname(outputPath),{recursive:true});writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output:outputPath,stepIndex:report.stepIndex,counts:report.counts,maxSkinPenetrationM:report.maxSkinPenetrationM,maxClearanceViolationM:report.maxClearanceViolationM,violationCount:report.violationCount,sideUncertainCount:report.sideUncertainCount,interiorViolationsWithClearSupportVertices:report.interiorViolationsWithClearSupportVertices,minimumYM:report.ground.minimumVertexYM,sampledBodyClearancePassed:report.sampledBodyClearancePassed,completeTriangleCertificate:false}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
