'use strict';
// Compare the published body frames with the same current rig evaluation,
// including animation preview endpoints and intermediate finite matrices.
const fs=require('fs'),vm=require('vm'),read=require('../r28/read-functions.cjs');
for(const f of ['BodyMathR01','BodyProgramStorageR27','research/r36/BodyPoseFunctionsR36','BodyTargetBindingR01','research/r36/BodyBSupportR36','BodyCalibrationR18','BodyTorsoR18','BodyStructureR19','BodyArticulationR20','BodyAnatomyR20','research/r36/BodyLegacyShapeR36','research/r29/BodyNeckSourceR29','research/p1/BodyDisplayNormalsDynamicP1','research/p1/BodyProperRotationP1','research/p1/BodySupportRigP1','research/r36/BodySourceScopeR36','research/r36/BodyDynamicNeckHeadR36','research/r36/BodyPhenotypeExtensionR36','research/r37/BodyAttachmentFramesR37','research/r37/BodyDynamicFullR37'])vm.runInThisContext(fs.readFileSync('src/'+f+'.js','utf8'),{filename:f});
const base=JSON.parse(fs.readFileSync('data/body-torso-continuous-p1.json')),b=JSON.parse(fs.readFileSync('data/body-b-support-r36.json')),l=JSON.parse(fs.readFileSync('data/body-legacy-support-r36.json'));
const program=read(base.surface);program.displayCount=program.charts.length;program.bSupportR36=read(b);program.legacySupportR36=read(l);
const support=BodySupportRigP1.create(read(base.support)),engine=BodyDynamicFullP1.create(program,support,read(base.displayNormals),read(base.neckAdapter),read(base.headBoundary)),source=require('../../program-r17.cjs')();
const a=structuredClone(source.baselineState),bState=structuredClone(a);bState.owners.rig='mhr';bState.mhr.pose[52]=-.7;bState.mhr.pose[53]=1.1;bState.mhr.pose[35]=.85;
const poses=[{}, {'upperarm01.L':{rotation:[0,-60,0]},'lowerleg01.L':{rotation:[65,0,0]}}];
const cases=[{rig:'A',state:a,pose:poses[0]},{rig:'A',state:a,pose:poses[1]},{rig:'B',state:bState,pose:{}}],checks=[];
const diff=(a,b)=>Math.max(...Array.from(a,(v,i)=>Math.abs(v-b[i])));
for(const item of cases){
 const evaluated=engine.evaluate(item.state,item.pose).bindingSupport,isB=item.rig==='B';let names,rest,posed,skin;
 if(isB){const aState=structuredClone(item.state);aState.owners.rig='anny';aState.anny.pose={};aState.anny.translations={};const f=BodyBSupportR36.create(program.bSupportR36,support).prepare(item.state,aState);names=f.names;rest=f.binding.bind;posed=f.posed;skin=f.skin;}
 else{const f=support.original(item.state,item.pose);names=f.rig.labels;rest=support.original(item.state,{}).poseMatrices;posed=f.poseMatrices;skin=posed.map((m,j)=>BodyMathR01.mul(m,BodyMathR01.uniformInverse(rest[j])));}
 const expected=BodyAttachmentFramesR37.create({rig:item.state.owners.rig,names,restMatrices:rest,posedMatrices:posed,skinMatrices:skin});let maximumSourceDifference=0,maximumEndpointDifference=0,maximumPreviewSkinDifference=0;
 const other=engine.evaluate(item.state,isB?{}:poses[1]).bindingSupport,zero=BodyAttachmentFramesR37.interpolate(evaluated,other,0),one=BodyAttachmentFramesR37.interpolate(evaluated,other,1),middle=BodyAttachmentFramesR37.interpolate(evaluated,other,.5);
 for(const key of Object.keys(expected.frames))for(const field of ['rest','posed','skin']){maximumSourceDifference=Math.max(maximumSourceDifference,diff(evaluated.frames[key][field],expected.frames[key][field]));maximumEndpointDifference=Math.max(maximumEndpointDifference,diff(zero.frames[key][field],evaluated.frames[key][field]),diff(one.frames[key][field],other.frames[key][field]));}
 for(const key of Object.keys(middle.frames)){const f=middle.frames[key];if(![...f.posed,...f.skin].every(Number.isFinite))throw Error('Nonfinite '+key);maximumPreviewSkinDifference=Math.max(maximumPreviewSkinDifference,diff(f.skin,BodyMathR01.mul(f.posed,BodyMathR01.uniformInverse(f.rest))));}
 checks.push({name:item.rig+' '+(item.pose===poses[1]?'posed':'default'),maximumSourceDifference,maximumEndpointDifference,maximumPreviewSkinDifference,passed:maximumSourceDifference<1e-9&&maximumEndpointDifference===0&&maximumPreviewSkinDifference<1e-9});
}
const passed=checks.every(x=>x.passed);console.log(JSON.stringify({passed,checks}));if(!passed)process.exitCode=1;
