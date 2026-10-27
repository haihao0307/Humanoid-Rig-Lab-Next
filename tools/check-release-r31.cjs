'use strict';
// Package and sampled-test integrity only. This cannot certify original appearance.
const fs=require('fs'),crypto=require('crypto'),zlib=require('zlib');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={startedUTC:new Date().toISOString(),scope:'R31 package and sampled-test integrity; no visual/source acceptance',sourceFidelityAccepted:false,visualAccepted:false,checks:[]};
function check(name,value){report.checks.push({name,passed:!!value});if(!value)throw Error(name);}
try{
 const b=read('BUILD.json'),w=read('BUILD-R31.json'),s=read('BUILD-TORSO-P1.json'),d=read('DELIVERY.json'),road=read('BODY-ROADMAP.json');
 check('selected R31 and fixed P1-P5 route',b.selectedVersion==='R31'&&d.version==='R31'&&road.tasks.map(t=>t.id).join(',')==='P1,P2,P3,P4,P5'&&!road.projectComplete&&!road.mainTasksAccepted);
 for(const [name,x] of [['source',b],['workbench',w],['study',s]]){const data=fs.readFileSync(x.file);check(name+' artifact hash and size',hash(data)===x.sha256&&data.length===x.bytes);}
 // Repeated inherited source entries can legitimately name older build inputs;
 // the final occurrence is the active input recorded for that path.
 for(const [name,x] of [['source',b],['workbench',w],['study',s]]){const sources=new Map(x.sources.map(i=>[i.file,i.sha256]));for(const [file,h] of sources)check(name+' input '+file,hash(fs.readFileSync(file))===h);}
 check('all body domains and dynamic neck included',s.domains===18416&&s.sourcePoseJointCount===98&&s.supportedLocalControls?.length===66&&s.neckStagesImplemented&&s.dynamicHeadSideBoundary&&s.archiveExportEnabled);
 check('inspection lighting labelled without original optical acceptance',s.sourceSkinInspection&&s.sourceEnvironmentInspection&&!s.dynamicOriginalShadows&&!s.originalDiffusion&&!s.fullOriginalOptics&&!s.sourceFidelityAccepted&&!s.visualAccepted&&!s.completedMotherConversion&&!s.characterTriangleFaces);
 for(const asset of s.assets){const compressed=fs.readFileSync(asset.file),raw=zlib.gunzipSync(compressed);check('compressed asset '+asset.file,compressed.length===asset.compressedBytes&&hash(compressed)===asset.compressedSHA256);check('decoded asset '+asset.file,raw.length===asset.rawBytes&&hash(raw)===asset.rawSHA256);}
 const q=name=>read('qa/p1-torso/'+name+'.json');
 for(const name of ['dynamic-full-body-native','dynamic-six-shape-native','dynamic-large-pose-native','dynamic-full-body-multijoint','dynamic-signed-local-native','dynamic-expanded-local-native']){const x=q(name);check(name,x.diagnosticCompleted&&x.positionsBitExact&&x.normalsBitExact&&x.programSHA256===s.assets[0].compressedSHA256);}
 const r=q('dynamic-full-view-ray-grids');check('sampled view rays',r.diagnosticCompleted&&r.noSampledRayCoverageDisagreements&&r.noSampledFirstDomainDisagreements&&r.programSHA256===s.assets[0].compressedSHA256);
 check('sampled dynamic neck boundary',q('dynamic-neck-head-native').boundaryBitExact);check('expanded local coefficient coverage',q('expanded-local-coefficient-coverage').diagnosticCompleted&&q('expanded-local-coefficient-coverage').uncompiledFields.length===0&&q('expanded-local-coefficient-coverage').programSHA256===s.assets[0].compressedSHA256);check('coefficient coverage samples',q('six-shape-coefficient-coverage').diagnosticCompleted&&q('six-shape-coefficient-coverage').uncompiledFields.length===0);
 for(const [name,h] of [['torso-study-browser',s.sha256],['full-body-archive-browser',s.sha256],['workbench-dynamic-body-browser',w.sha256],['source-environment-browser',w.sha256]]){const x=q(name);check(name,x.passed&&x.artifactSHA256===h&&x.checks.every(c=>c.passed));}
 check('historical R30 build retained',fs.existsSync(read('BUILD-R30.json').file)&&fs.existsSync('DELIVERY-R30.json'));
 report.torsoAssets=s.assets.length;report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;console.error(e.message);}finally{report.finishedUTC=new Date().toISOString();fs.writeFileSync('qa/p1-torso/release-integrity-r31.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,assets:report.torsoAssets,failure:report.failure}));}
