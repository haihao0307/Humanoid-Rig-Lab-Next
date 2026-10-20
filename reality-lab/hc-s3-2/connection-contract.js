/* Connection evidence is separate from material PASS/UNKNOWN and from production approval. */
(function(root){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const HEX40=/^[0-9a-f]{40}$/,HEX64=/^[0-9a-f]{64}$/;
const CORE_KEYS=['schema','installationId','scope','repository','sourceBranch','sourceBaseCommit','entryPath','adapterVersion','adapterSHA256','rendererSHA256','implementationCommit','productionBranch'];
function validateCore(core){
 if(!core||core.schema!=='kaopu/reality-source-installation@1')throw Error('INSTALL_SCHEMA_UNSUPPORTED');
 if(core.scope!=='trial_branch')throw Error('PRODUCTION_PROMOTION_FORBIDDEN');
 if(core.installationId!=='RF01-S32-DENIM-R17' || core.adapterVersion!=='0.3.1-a')throw Error('ADAPTER_VERSION_MISMATCH');
 if(!HEX40.test(core.sourceBaseCommit)||!HEX40.test(core.implementationCommit)||!HEX64.test(core.adapterSHA256)||!HEX64.test(core.rendererSHA256))throw Error('INSTALL_IDENTITY_INVALID');
 if(core.repository!=='haihao0307/Humanoid-Rig-Lab-Next'||core.entryPath!=='denim-workshop/r17-scale/preview-v3.html')throw Error('INSTALL_SCOPE_INVALID');
 if(core.sourceBranch!=='feature/denim-r17-reality-s32-trial-20261020'||core.productionBranch!=='feature/denim-r17-garment-scale-20261015')throw Error('BRANCH_SCOPE_INVALID');
 if(!core.authorities||['sourceWriteAPI','mergeAuthorized','productionInstalled','physicalCertification'].some(k=>core.authorities[k]!==false))throw Error('INSTALL_AUTHORITY_ESCALATION');
 return true;
}
function sameCore(observed,expected){validateCore(observed);validateCore(expected);for(const k of CORE_KEYS)if(observed[k]!==expected[k])throw Error('INSTALLED_PROVIDER_MISMATCH:'+k);return true;}
function validateRegistry(r){
 if(!r||r.schema!=='kaopu/reality-connection-registry@1'||r.version!=='REALITY-HC-S3.2')throw Error('REGISTRY_SCHEMA_INVALID');
 if(!Array.isArray(r.entries)||r.entries.length!==3)throw Error('REGISTRY_ENTRIES_INVALID');
 const ids=r.entries.map(e=>e.family).sort();if(ids.join(',')!=='denim,knit,leather')throw Error('REGISTRY_FAMILIES_INVALID');
 for(const e of r.entries){if(!HEX40.test(e.lineage.commit)||!HEX64.test(e.lineage.sha256))throw Error('LINEAGE_INVALID');if(e.productionInstalled!==false||e.productionVerified!==false)throw Error('PRODUCTION_PROMOTION_FORBIDDEN');if(e.copyVerified!==true)throw Error('COPY_EVIDENCE_MISSING');}
 const d=r.entries.find(e=>e.family==='denim');validateCore(d.installation.core);const p=d.installation;
 if(!HEX40.test(p.commit)||!HEX64.test(p.htmlSHA256)||!Number.isInteger(p.bytes)||p.bytes<1||p.bytes>1048576)throw Error('INSTALL_ARTIFACT_INVALID');
 if(!p.sourcePublicVerification?.passed||p.sourcePublicVerification.commit!==p.commit||p.sourcePublicVerification.htmlSHA256!==p.htmlSHA256)throw Error('SOURCE_VERIFICATION_MISMATCH');
 if(d.lineage.commit!==p.core.sourceBaseCommit||d.productionHeadAtCheck!==p.core.sourceBaseCommit)throw Error('SOURCE_BASE_MISMATCH');
 for(const e of r.entries.filter(e=>e.family!=='denim'))if(e.installation!==null)throw Error('UNSCOPED_INSTALLATION');
 return true;
}
function stage(entry){
 if(entry.productionInstalled!==false||entry.productionVerified!==false)throw Error('PRODUCTION_PROMOTION_FORBIDDEN');
 if(entry.installation){const p=entry.installation;validateCore(p.core);if(p.sourcePublicVerification?.passed&&p.sourcePublicVerification.commit===p.commit&&p.sourcePublicVerification.htmlSHA256===p.htmlSHA256)return 'SOURCE_TRIAL_VERIFIED';return 'SOURCE_TRIAL_UNVERIFIED';}
 return entry.copyVerified?'COPY_VERIFIED':'HISTORICAL_ONLY';
}
function rawURL(install){if(!HEX40.test(install.commit))throw Error('UNPINNED_SOURCE');validateCore(install.core);return 'https://raw.githubusercontent.com/'+install.core.repository+'/'+install.commit+'/'+install.core.entryPath;}
function publicURL(install){return 'https://htmlpreview.github.io/?'+rawURL(install);}
function inspectProvider(provider,expected,packet){
 sameCore(provider,expected);if(!packet||packet.source.commit!==expected.sourceBaseCommit||packet.family!=='denim'||packet.exporterVersion!==expected.adapterVersion)throw Error('OBSERVATION_SOURCE_MISMATCH');
 if(packet.authorities.sourceWriteAPI!==false||packet.authorities.repairAuthorized!==false)throw Error('OBSERVATION_AUTHORITY_ESCALATION');return true;
}
const api=Object.freeze({validateCore,sameCore,validateRegistry,stage,rawURL,publicURL,inspectProvider,copy});root.RealityConnectionContract=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
