'use strict';
// Compare the R37 shape-cache results with the exact R36 function evaluator.
// Both paths run from the same immutable source-derived packets.
const fs=require('fs'),vm=require('vm'),read=require('../r28/read-functions.cjs');
for(const f of ['BodyMathR01','BodyProgramStorageR27','research/r36/BodyPoseFunctionsR36','BodyTargetBindingR01','research/r36/BodyBSupportR36','BodyCalibrationR18','BodyTorsoR18','BodyStructureR19','BodyArticulationR20','BodyAnatomyR20','research/r36/BodyLegacyShapeR36','research/r29/BodyNeckSourceR29','research/p1/BodyDisplayNormalsDynamicP1','research/p1/BodyProperRotationP1','research/p1/BodySupportRigP1','research/r36/BodySourceScopeR36','research/r36/BodyDynamicNeckHeadR36','research/r36/BodyPhenotypeExtensionR36','research/r37/BodyAttachmentFramesR37'])vm.runInThisContext(fs.readFileSync('src/'+f+'.js','utf8'),{filename:f});
vm.runInThisContext(fs.readFileSync('src/research/r36/BodyDynamicFullR36.js','utf8'));const old=BodyDynamicFullP1;
vm.runInThisContext(fs.readFileSync('src/research/r37/BodyDynamicFullR37.js','utf8'));const current=BodyDynamicFullP1;
const base=JSON.parse(fs.readFileSync('data/body-torso-continuous-p1.json')),extension=JSON.parse(fs.readFileSync('data/body-phenotype-extension-r36.json')),b=JSON.parse(fs.readFileSync('data/body-b-support-r36.json')),l=JSON.parse(fs.readFileSync('data/body-legacy-support-r36.json'));
const program=read(base.surface);program.displayCount=program.charts.length;program.bSupportR36=read(b);program.legacySupportR36=read(l);
const support=BodySupportRigP1.create(read(base.support)),normal=read(base.displayNormals),neck=read(base.neckAdapter),head=read(base.headBoundary),source=require('../../program-r17.cjs')();
const a=structuredClone(source.baselineState),mixed=structuredClone(a),legacy=structuredClone(require('../../../qa/anatomy-r20/final-person.json').person.state);
mixed.anny.phenotypes.age=.4;mixed.anny.phenotypes.gender=.5;mixed.anny.phenotypes.weight=.6;mixed.anny.localChanges['measure-shoulder-dist-incr']=.2;
legacy.owners.rig='mhr';for(const [i,v] of [[52,-.7],[61,-.7],[53,1.1],[62,1.1],[11,.25]])legacy.mhr.pose[i]=v;
const needed=new Set();for(const state of [a,mixed,legacy]){const w=support.coefficients(state);extension.chunks.forEach((c,i)=>{if(c.fields.some(k=>w[k]!==0))needed.add(i);});}program.phenotypeExtensions=[...needed].sort((x,y)=>x-y).map(i=>read(extension.chunks[i]));
const original=old.create(program,support,normal,neck,head),candidate=current.create(program,support,normal,neck,head);
const poses=[{}, {'upperarm01.L':{rotation:[0,-35,0]},spine03:{rotation:[12,0,0]}},{'upperarm01.L':{rotation:[0,-55,0]},spine03:{rotation:[8,5,0]}}],tests=[...poses.map((pose,i)=>({name:'A pose '+i,state:a,pose})),{name:'age sex and local',state:mixed,pose:poses[1]},{name:'legacy B bend',state:legacy,pose:{}}],checks=[];
for(const test of tests){const x=original.evaluate(test.state,test.pose),y=candidate.evaluate(test.state,test.pose);let different=0,max=0;
for(const k of ['coefficients','inverse','inverseAxes','geometric','normals']){if(x[k].length!==y[k].length)throw Error('Length differs for '+k);for(let i=0;i<x[k].length;i++){const a=x[k][i],b=y[k][i];if(!Object.is(a,b)){different++;max=Math.max(max,Math.abs(a-b));}}}
const boundary=BodyNeckSourceR29.stateKey(x.headBoundary)===BodyNeckSourceR29.stateKey(y.headBoundary);checks.push({name:test.name,differentValues:different,maximumDifference:max,headBoundaryEqual:boundary,passed:different===0&&boundary});}
const report=candidate.report(),passed=checks.every(x=>x.passed)&&report.shapeCache.hits>=2;console.log(JSON.stringify({passed,checks,shapeCache:report.shapeCache,sourceDerived:true,characterTriangleFaces:0}));if(!passed)process.exitCode=1;
