// Idempotent, source-only candidate migration. Does not claim visual acceptance.
import fs from 'node:fs';
const edits = new Map();
function edit(file, before, after) {
  let text = edits.has(file) ? edits.get(file) : fs.readFileSync(file, 'utf8');
  if (text.includes(after)) return;
  if (!text.includes(before) || text.indexOf(before) !== text.lastIndexOf(before)) throw Error('Ambiguous source anchor: '+file+' '+before);
  edits.set(file,text.replace(before,after));
}
const p='clothing/ShortsPattern.js';
edit(p,'handlingPoints: [0, 2, 4, 6].map(index => ({ index, releaseWhenStitched: true }))','handlingPoints: [0, 4].map(index => ({ index, releaseWhenStitched: true }))');
edit(p,'basisU: [0, 1, 0], basisV: [0, 0, -1]','basisU: [Math.sin(Math.PI / 18), Math.cos(Math.PI / 18), 0], basisV: [0, 0, -1]');
edit(p,"method: 'sagittal_hand_held_paper_below_measured_crotch', topBelowMeasuredCrotchM: .010", "method: 'side_identified_flat_gusset_two_axis_grips_candidate', topBelowMeasuredCrotchM: .010 + halfWidth * (1 - Math.cos(Math.PI / 18))");
edit(p,'// This source-frame sagittal placement remains flat and rigid. Its top is\n    // 10 mm below the measured crotch; all pieces subsequently receive the\n    // same hips rigid transform. Clearance is checked on the actual body, not\n    // inferred for every future body shape from this placement rule alone.', '// Preserve one flat rigid paper, opening its transverse direction by 10 degrees\n    // to distinguish left/right notches without turning the paper across both thighs.\n    // Only front/back boundary tips are held, leaving transverse roll free.\n    // This is an assembly candidate, not a universal body-clearance certificate.');
const c='clothing/ClothShorts.js';
edit(c,'maxMaterialIterations:32','maxMaterialIterations:128');
edit(c,"handlingPolicy:'needle-and-time'","handlingPolicy:'until-waist-stitched'");
const t='tools/test-shorts-pattern.mjs';
edit(t,'assert.equal(g.handlingPoints.length, 4);','assert.deepEqual([...g.handlingPoints].map(p => p.index), [g.landmarks.front, g.landmarks.back]);');
edit(t,'near gusset placement is a rigid sagittal hold below measured crotch without changing any source paper','gusset rigid opening identifies left/right and leaves source paper unchanged');
edit(t,'close(Math.max(...positions.map(x => x[1])), m.metadata.crotchY - .010);\n  for (const x of positions) close(x[0], m.waistCenter[0]);', 'close(Math.max(...positions.map(x => x[1])), m.metadata.crotchY - g.placement.topBelowMeasuredCrotchM);\n  assert.ok(positions[g.landmarks.left][0] < m.waistCenter[0]);\n  assert.ok(positions[g.landmarks.right][0] > m.waistCenter[0]);\n  close(Math.hypot(...g.placement.basisU), 1);\n  close(g.placement.basisU.reduce((s,v,k) => s + v*g.placement.basisV[k], 0), 0);');
const i='tools/test-shorts-integration.mjs';
edit(i,"handlingPolicy:'needle-and-time',triangleBodyContact:true,iterations:32,maxMaterialIterations:32", "handlingPolicy:'until-waist-stitched',triangleBodyContact:true,iterations:32,maxMaterialIterations:128");
for(const [file,text] of edits)fs.writeFileSync(file,text);
console.log('Updated canonical candidate sources:',[...edits.keys()].join(', ')||'already applied');
