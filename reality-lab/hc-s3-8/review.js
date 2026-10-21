(function(root){'use strict';
const PIN='c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49',finite=x=>typeof x==='number'&&Number.isFinite(x);
const STAGES=['step-entry','after-regional-dynamics','before-coarse-contact','after-coarse-contact','after-fine-reconstruction','after-fine-vertices','after-fine-triangles','after-fine-contact','step-complete'];
function vec(p){return Array.isArray(p)&&p.length===3&&p.every(finite);}
function contact(c){return c&&finite(c.distanceM)&&vec(c.point)&&vec(c.closest)&&Array.isArray(c.triangle)&&c.triangle.length===3&&c.triangle.every(vec);}
function validate(d){
 if(!d||d.schema!=='kaopu/contact-propagation-study@1'||d.sourceCommit!==PIN||d.fitCertified!==false||d.productionChanged!==false)throw Error('SOURCE_OR_AUTHORITY_MISMATCH');
 if(!d.trace||d.trace.coverage?.node!==191||d.trace.coverage?.panel!=='pant_b_l'||d.trace.coverage.localVertex!==212||typeof d.trace.coverage.fineNodeIncluded!=='boolean')throw Error('TARGET_IDENTITY_MISMATCH');
 if(!Array.isArray(d.trace.rows)||d.trace.rows.length<16||d.trace.rows.length>500)throw Error('TRACE_SIZE_INVALID');
 for(const r of d.trace.rows){if(![7,8].includes(r.step)||!STAGES.includes(r.stage)||r.readOnlyChecked!==true||!contact(r.actualFine)||!contact(r.actualFineAgainstLowerSurface)||!contact(r.reconstructedPrediction?.contact)||!contact(r.reconstructedPrediction?.beforePlaneContact)||!vec(r.reconstructedPrediction.point))throw Error('PHASE_RECORD_INVALID');if(!Array.isArray(r.coarse)||r.coarse.length<1||r.coarse.length>8||r.coarse.some(c=>!Number.isInteger(c.id)||!finite(c.weight)||c.weight<0||!contact(c.contact)))throw Error('COARSE_BINDING_INVALID');if(Math.abs(r.coarse.reduce((a,c)=>a+c.weight,0)-1)>1e-10)throw Error('COARSE_WEIGHTS_INVALID');if(!Array.isArray(r.incidentTriangles)||r.incidentTriangles.length<1||r.incidentTriangles.some(t=>!Array.isArray(t.points)||t.points.length!==3||!t.points.every(vec)))throw Error('LOCAL_GEOMETRY_INVALID');}
 for(const step of [7,8]){const rows=d.trace.rows.filter(r=>r.step===step);if(rows[0]?.stage!=='step-entry'||rows.at(-1)?.stage!=='step-complete')throw Error('TRACE_BOUNDARIES_MISSING');}
 if(!Array.isArray(d.endpointComparison)||d.endpointComparison.length!==15||d.endpointComparison.some(c=>c.exactState!==true||c.exactMeasurements!==true))throw Error('ENDPOINT_EVIDENCE_INVALID');
 return true;
}
function summary(d){validate(d);const steps=[7,8].map(step=>{const rows=d.trace.rows.filter(r=>r.step===step),at=stage=>rows.find(r=>r.stage===stage),first=at('after-fine-reconstruction'),last=rows.at(-1),coarse=at('after-coarse-contact');return {step,coarseMinM:Math.min(...coarse.coarse.map(c=>c.contact.distanceM)),reconstructionM:first.actualFine.distanceM,finalM:last.actualFine.distanceM,correctedAfterReconstructionM:last.actualFine.distanceM-first.actualFine.distanceM,firstObservedNegativeStage:rows.find(r=>r.actualFine.distanceM<-.00005)?.stage||null,finalLocalCrossing:last.crossings.length>0};});return {coverage:d.trace.coverage,steps,sourceMutation:false,fitCertified:false,interpretation:'The trace attributes this witness only; positive coarse points do not certify the interpolated fine surface, and a local fix would not certify all garment pairs.'};}
function parse(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>5000000)throw Error('IMPORT_TOO_LARGE');const d=JSON.parse(text);validate(d);return d;}
const api=Object.freeze({PIN,STAGES,validate,summary,parse});root.ContactPropagation38=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
