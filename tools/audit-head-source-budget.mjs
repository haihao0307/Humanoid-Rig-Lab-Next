// Full balanced source assembly, including interfaces/conform, with the same
// 600k topology guard used by the workbench. No GPU or stored display mesh.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateCompactHuman} from '../reconstruction/assembly.mjs';
const {report}=await generateCompactHuman({load:async name=>readFileSync(new URL('../reconstruction/'+name,import.meta.url)),quality:'balanced',includeHair:false});
assert(report.triangles<600000,'full-source topology exceeded the existing triangle guard');
assert(report.sourceRegionsPreserved&&report.parameterOnlyInputs&&!report.meshFilesLoaded,'source-only anatomy contract changed');
const detail=report.groups.find(g=>g.name==='detail');
console.log(JSON.stringify({schema:'human/head_source_budget_audit@1',quality:report.quality,triangles:report.triangles,headroom:600000-report.triangles,vertices:report.vertices,
  generationMilliseconds:report.generationMilliseconds,detailTriangles:detail.triangles,detailAdaptiveSplits:detail.adaptiveSplits,
  headBaseRefinementBudget:detail.headBaseRefinementBudget,frontReserve:detail.faceRefinementBudget,earReserve:detail.earRefinementBudget,
  sharedTopology:report.topology,corrections:report.surfaceCorrections.map(c=>({version:c.version,changedVertexOccurrences:c.changedVertexOccurrences})),
  bindingSchema:report.bindingSchema,browserExecuted:false,visualAcceptance:false},null,2));
