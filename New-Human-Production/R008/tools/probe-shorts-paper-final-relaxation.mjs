// One final bounded continuation of the converging, exactly sewn source paper.
// This does not regenerate cuts, turn XYZ into rest, fit a body or start motion.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {formShortsPaperSurface} from '../ShortsPaperForming.mjs';
import {evaluatePaperSurface,compilePaperSurfaceModel} from '../ShortsPaperSurfaceModel.mjs';
const base=new URL('../',import.meta.url),input=new URL('qa/shorts-paper-closed-refined-20261004.json',base),bytes=fs.readFileSync(input),p=JSON.parse(bytes);
if(p.closure.sourceSeams!==19||p.closure.sourceDofs!==1751||p.sourceToDof.length!==p.sourceUV.length/2||p.seams.some(s=>s.pairs.some(pair=>p.sourceToDof[pair.a]!==p.sourceToDof[pair.b])))throw Error('Frozen exact19-source seam authority missing');
if(p.trace.length!==80||p.trace.slice(-10).some(t=>t.acceptedFraction!==1||!(t.finalEnergyM2<t.initialEnergyM2)))throw Error('Prior bounded phase was not a converging source-only trajectory');
const draft={sourceUV:p.sourceUV,triangles:p.triangles,mass:p.sourceMass,masses:p.sourceMass,ranges:p.ranges,seams:p.seams},before=JSON.stringify(draft),result=formShortsPaperSurface({draft,positions:p.positions,sourceToDof:p.sourceToDof},{maximumIterations:80});
if(JSON.stringify(draft)!==before)throw Error('Original source authority changed');
const independent=evaluatePaperSurface(compilePaperSurfaceModel(draft),result.positions,p.sourceToDof,{strainLimit:.05});
const out=new URL('qa/shorts-paper-final-relaxation-20261004.json',base),report={...p,...result,createdAt:new Date().toISOString(),scope:'single final80-iteration continuation after exact seam elimination; overall closed-paper ceiling160; no body or motion',inputSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),sourceHash:crypto.createHash('sha256').update(fs.readFileSync(new URL('ShortsPaperForming.mjs',base))).digest('hex'),independent,closedPaperTotalIterations:p.iterations+result.iterations,wearingAccepted:false};
fs.writeFileSync(out,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({report:out.pathname,status:result.status,strain:independent.maximumPrincipalStrain,elapsedMs:result.elapsedMs,totalIterations:report.closedPaperTotalIterations,wearingAccepted:false}));
