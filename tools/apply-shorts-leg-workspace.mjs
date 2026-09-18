// One-time, idempotent canonical-source migration. No generated vertices.
// Rejected default experiment is rolled back; workspaces remain opt-in.
import fs from 'node:fs';
const edits = new Map();
const read = file => edits.has(file) ? edits.get(file) : fs.readFileSync(file,'utf8');
function replace(file,before,after) {
  const text=read(file);if(text.includes(after))return;
  if(!text.includes(before)||text.indexOf(before)!==text.lastIndexOf(before))throw Error('Ambiguous source anchor: '+file+' '+before);
  edits.set(file,text.replace(before,after));
}
const pattern='clothing/ShortsPattern.js';
if(read(pattern).includes('side_identified_flat_gusset_two_axis_grips_candidate')) {
  replace(pattern,'handlingPoints: [0, 4].map(index => ({ index, releaseWhenStitched: true }))','handlingPoints: [0, 2, 4, 6].map(index => ({ index, releaseWhenStitched: true }))');
  replace(pattern,'basisU: [Math.sin(Math.PI / 18), Math.cos(Math.PI / 18), 0], basisV: [0, 0, -1]','basisU: [0, 1, 0], basisV: [0, 0, -1]');
  replace(pattern,"method: 'side_identified_flat_gusset_two_axis_grips_candidate', topBelowMeasuredCrotchM: .010 + halfWidth * (1 - Math.cos(Math.PI / 18))","method: 'sagittal_hand_held_paper_below_measured_crotch', topBelowMeasuredCrotchM: .010");
  replace(pattern,'// Preserve one flat rigid paper, opening its transverse direction by 10 degrees\n    // to distinguish left/right notches without turning the paper across both thighs.\n    // Only front/back boundary tips are held, leaving transverse roll free.\n    // This is an assembly candidate, not a universal body-clearance certificate.','// This source-frame sagittal placement remains flat and rigid. Its top is\n    // 10 mm below the measured crotch; all pieces subsequently receive the\n    // same hips rigid transform. Clearance is checked on the actual body, not\n    // inferred for every future body shape from this placement rule alone.');
  replace('clothing/ClothShorts.js','maxMaterialIterations:128','maxMaterialIterations:32');
  replace('clothing/ClothShorts.js',"handlingPolicy:'until-waist-stitched'","handlingPolicy:'needle-and-time'");
  const t='tools/test-shorts-pattern.mjs';
  replace(t,'assert.deepEqual([...g.handlingPoints].map(p => p.index), [g.landmarks.front, g.landmarks.back]);','assert.equal(g.handlingPoints.length, 4);');
  replace(t,'gusset rigid opening identifies left/right and leaves source paper unchanged','near gusset placement is a rigid sagittal hold below measured crotch without changing any source paper');
  replace(t,'close(Math.max(...positions.map(x => x[1])), m.metadata.crotchY - g.placement.topBelowMeasuredCrotchM);\n  assert.ok(positions[g.landmarks.left][0] < m.waistCenter[0]);\n  assert.ok(positions[g.landmarks.right][0] > m.waistCenter[0]);\n  close(Math.hypot(...g.placement.basisU), 1);\n  close(g.placement.basisU.reduce((s,v,k) => s + v*g.placement.basisV[k], 0), 0);','close(Math.max(...positions.map(x => x[1])), m.metadata.crotchY - .010);\n  for (const x of positions) close(x[0], m.waistCenter[0]);');
  replace('tools/test-shorts-integration.mjs',"handlingPolicy:'until-waist-stitched',triangleBodyContact:true,iterations:32,maxMaterialIterations:128","handlingPolicy:'needle-and-time',triangleBodyContact:true,iterations:32,maxMaterialIterations:32");
}
const c='clothing/ShortsCloth.js';
replace(c,'    this.options.handlingDamping=options.handlingDamping??null;',"    this.options.legAssemblyWorkspaces=options.legAssemblyWorkspaces??false;if(typeof this.options.legAssemblyWorkspaces!=='boolean')throw Error('invalid leg assembly workspace option');\n    this.options.handlingDamping=options.handlingDamping??null;");
replace(c,'    this.continuousContact=this.options.selfContact?','    this.legAssembly=this.options.legAssemblyWorkspaces?createShortsLegAssembly(this):null;\n    this.continuousContact=this.options.selfContact?');
// Guides follow ordinary handling in the source solver. Never alter rest UV.
if(read(c).includes('    this.legAssembly?.solve(h);\n    const handlingAlpha'))edits.set(c,read(c).replace('    this.legAssembly?.solve(h);\n    const handlingAlpha','    const handlingAlpha'));
replace(c,'  }\n  _bodyContact(alpha){','    this.legAssembly?.solve(h);\n  }\n  _bodyContact(alpha){');
replace(c,'this.options.handlingDamping!==null&&this.temporarySupports.some(s=>s.active)?','this.options.handlingDamping!==null&&(this.temporarySupports.some(s=>s.active)||this.legAssembly?.hasActive())?');
replace(c,'temporarySupportCount:this.temporarySupports.filter(s=>s.active).length,engineeringCriteriaMet:','temporarySupportCount:this.temporarySupports.filter(s=>s.active).length+(this.legAssembly?.report().activeConstraintCount??0),legAssembly:this.legAssembly?.report()??{enabled:false},engineeringCriteriaMet:(!this.legAssembly||!this.legAssembly.hasActive())&&');
const manifest='source/assembly.json',m=JSON.parse(read(manifest));
if(!m.modules.includes('clothing/ShortsLegAssembly.js')){
 const i=m.modules.indexOf('clothing/ShortsCloth.js');if(i<0)throw Error('Missing cloth module in source manifest');
 m.modules.splice(i,0,'clothing/ShortsLegAssembly.js');edits.set(manifest,JSON.stringify(m,null,2)+'\n');
}
replace('source/runtime.template.js','/*__SOURCE:clothing/ShortsCloth.js__*/','/*__SOURCE:clothing/ShortsLegAssembly.js__*/\n/*__SOURCE:clothing/ShortsCloth.js__*/');
for(const [file,text]of edits)fs.writeFileSync(file,text);
console.log('Canonical source migration:',[...edits.keys()].join(', ')||'already applied');
