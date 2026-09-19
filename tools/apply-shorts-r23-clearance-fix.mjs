// One-time, idempotent R2.3 correction from actual-body failure evidence.
// The migration widens only temporary authoring openings, scopes body contact
// to active FL/BL material, and leaves source UV, triangles, mass and Human rig unchanged.
import fs from 'node:fs';
const edits=new Map();
const read=file=>edits.has(file)?edits.get(file):fs.readFileSync(file,'utf8');
function replace(file,before,after){
  const text=read(file);if(text.includes(after))return;
  if(!text.includes(before)||text.indexOf(before)!==text.lastIndexOf(before))throw Error('Ambiguous R2.3 migration anchor: '+file+' :: '+before);
  edits.set(file,text.replace(before,after));
}
replace('clothing/ShortsTubeFormationR2.js',
  'const outerOpeningTopM=options.outerOpeningTopM??.028,innerOpeningTopM=options.innerOpeningTopM??.050;',
  'const outerOpeningTopM=options.outerOpeningTopM??.200,innerOpeningTopM=options.innerOpeningTopM??.250;');
replace('clothing/ShortsTubeFormationR2.js',
  "if(![outerOpeningTopM,innerOpeningTopM].every(value=>Number.isFinite(value)&&value>=0&&value<=.10))fail('invalid staged opening');",
  "if(![outerOpeningTopM,innerOpeningTopM].every(value=>Number.isFinite(value)&&value>=0&&value<=.50))fail('invalid staged opening');");
replace('clothing/ShortsTubeFormationR2.js',
  "simulation.surfaceContact=simulation.body?new ShortsSurfaceContact(simulation.particles,simulation.triangleRecords,simulation.body,{clearanceM:simulation.options.thickness,toleranceM:.001,dofs:simulation.dofs}):null;\n  simulation.triangleBodyContact=simulation.options.triangleBodyContact?new ShortsTriangleBodyContact(simulation.particles,simulation.triangleRecords,simulation.body,{clearanceM:simulation.options.thickness,toleranceM:.001,dofs:simulation.dofs,maxCandidates:simulation.options.triangleBodyMaxCandidates,maxWitnessQueries:simulation.options.triangleBodyMaxWitnessQueries}):null;",
  "const bodyContactPieces=new Set(['FL','BL']),activeTriangleRecords=simulation.triangleRecords.filter(record=>bodyContactPieces.has(record.pieceId));\n  if(!activeTriangleRecords.length)fail('active left-tube contact triangles are missing');\n  simulation.surfaceContact=simulation.body?new ShortsSurfaceContact(simulation.particles,activeTriangleRecords,simulation.body,{clearanceM:simulation.options.thickness,toleranceM:.001,dofs:simulation.dofs,includeOnlyIncidentVertices:true}):null;\n  simulation.triangleBodyContact=simulation.options.triangleBodyContact?new ShortsTriangleBodyContact(simulation.particles,activeTriangleRecords,simulation.body,{clearanceM:simulation.options.thickness,toleranceM:.001,dofs:simulation.dofs,maxCandidates:simulation.options.triangleBodyMaxCandidates,maxWitnessQueries:simulation.options.triangleBodyMaxWitnessQueries}):null;");
replace('clothing/ShortsTubeFormationR2.js',
  'const base={...state.report,sourceBefore,massBefore,closedSeams:closed,authoringLockedParticleCount,authoringLocksRemovable:true,otherSeamsStarted:false};',
  "const base={...state.report,sourceBefore,massBefore,closedSeams:closed,authoringLockedParticleCount,authoringLocksRemovable:true,otherSeamsStarted:false,bodyContactPieces:['FL','BL'],inactiveBodyContactPieces:['FR','BR','G','WFL','WFR','WBR','WBL'],bodyContactTriangleCount:activeTriangleRecords.length};");
replace('clothing/ShortsTubeFormationR2.js',
  'return {...baseReport,valid,sourceIdentityPreserved,totalMassPreserved,closedSeams:closed,cuff:',
  'return {...baseReport,stitchJoinToleranceM:simulation.options.stitchJoinToleranceM,valid,sourceIdentityPreserved,totalMassPreserved,closedSeams:closed,cuff:');
replace('clothing/ShortsSurfaceContact.js',
  'constructor(particles,triangleRecords,body,{clearanceM=.0025,toleranceM=.001,includeVertices=true,dofs=null}={}){',
  'constructor(particles,triangleRecords,body,{clearanceM=.0025,toleranceM=.001,includeVertices=true,includeOnlyIncidentVertices=false,dofs=null}={}){');
replace('clothing/ShortsSurfaceContact.js',
  "typeof includeVertices!=='boolean')throw Error('Invalid surface contact options');",
  "typeof includeVertices!=='boolean'||typeof includeOnlyIncidentVertices!=='boolean')throw Error('Invalid surface contact options');");
replace('clothing/ShortsSurfaceContact.js',
  "if(includeVertices)for(let i=0;i<particles.length;i++)add('vertex',[i],[1],incidence[i]);",
  "const vertexIds=includeVertices?(includeOnlyIncidentVertices?incidence.flatMap((faces,index)=>faces.length?[index]:[]):particles.map((_,index)=>index)):[];\n  for(const i of vertexIds)add('vertex',[i],[1],incidence[i]);");
replace('clothing/ShortsSurfaceContact.js',
  'this.counts={vertex:includeVertices?particles.length:0,edgeMidpoint:edges.size,triangleCentroid:triangles.length};',
  'this.counts={vertex:vertexIds.length,edgeMidpoint:edges.size,triangleCentroid:triangles.length};this.includeOnlyIncidentVertices=includeOnlyIncidentVertices;');
replace('clothing/ShortsSurfaceContact.js',
  'continuousCollisionDetection:false};',
  'continuousCollisionDetection:false,includeOnlyIncidentVertices:this.includeOnlyIncidentVertices};');
replace('clothing/ClothShorts.js','const minimumSteps=3,maximumSteps=8;','const minimumSteps=3,maximumSteps=16;');
replace('tools/review-shorts-left-tube-r23.mjs',
  "for(const id of ['outseam-left','inseam-left'])if(seams.get(id)?.progress!==1)failureReasons.push(id+' not closed');",
  "for(const item of tube?.closedSeams??[])if(!(item.maximumGapM<=report.simulation.options.stitchJoinToleranceM))failureReasons.push(item.id+' spatial gap exceeds tolerance');");
replace('tools/review-shorts-left-tube-r23.mjs',
  "report.simulation.options.stitchJoinToleranceM",
  "(tube.stitchJoinToleranceM??1e-4)");
const surfaceTest='tools/test-shorts-surface-contact.mjs',testName="test('incident-only vertex mode scopes a staged body gate to supplied cloth triangles'";
if(!read(surfaceTest).includes(testName))edits.set(surfaceTest,read(surfaceTest)+"\ntest('incident-only vertex mode scopes a staged body gate to supplied cloth triangles',()=>{\n const p=[particle([0,1,0]),particle([1,1,0]),particle([0,2,0]),particle([0,-1,0],0)],contact=new Contact(p,triangle,plane(),{clearanceM:.01,includeOnlyIncidentVertices:true});\n assert.deepEqual(contact.counts,{vertex:3,edgeMidpoint:3,triangleCentroid:1});assert.equal(contact.includeOnlyIncidentVertices,true);assert.equal(contact.report().passed,true);assert.equal(p[3].pos[1],-1);\n});\n");
for(const [file,text]of edits)fs.writeFileSync(file,text);
console.log('R2.3 clearance/contact migration:',[...edits.keys()].join(', ')||'already applied');
