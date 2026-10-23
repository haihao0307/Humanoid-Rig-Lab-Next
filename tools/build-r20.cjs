'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const output='delivery/人物身体_R20_结构细节与动作调整.html',temporary=output+'.building',pending='BUILD-R20.pending.json';
Object.assign(process.env,{BODY_PROGRAM_PACKAGE:'data/body-function-program-r17.json',BODY_NUMERIC_SOURCES:'BodyMathR01,BodyShapeR18,BodyMHRFieldsR01,BodyTargetBindingR01,BodyMHRAdapterR01,BodyDriverR01,BodyCalibrationR18,BodyTorsoR18,BodyStructureR19,BodyAnatomyR20,BodyArticulationR20,BodyLocalFieldR20,BodyLocalCompositionR20,BodyInteriorR20,BodyContactFieldR20,BodyNeckClosureR20,BodyDigitsR20,BodyFeetR20',BODY_IMPLICIT_WORKER:'src/BodyImplicitWorkerR20.js',BODY_RAY_SOURCE:'src/BodyRayR20.js',BODY_APP_SOURCE:'src/BodyImplicitAppR20.js',BODY_HTML_POSTPROCESS:'tools/body-ui-r20.cjs',BODY_EXTRA_SOURCES:'src/BodyControlR17.js',BODY_OUTPUT_FILE:'delivery/人物身体_R20_结构细节与动作调整.html',BODY_BUILD_MANIFEST:'BUILD-R20.json',BODY_VISIBLE_VERSION:'R20'});
Object.assign(process.env,{BODY_OUTPUT_FILE:temporary,BODY_BUILD_MANIFEST:pending});
require('./build-implicit.cjs');
const build=JSON.parse(fs.readFileSync(pending,'utf8'));
// Publish only complete files while the interactive working viewer is open.
fs.renameSync(temporary,output);build.file=path.resolve(output);
build.buildDependencies=['tools/build-r20.cjs','tools/build-implicit.cjs','tools/body-ui-r17.cjs','tools/body-ui-r18.cjs','tools/body-ui-r19.cjs','tools/body-ui-r20.cjs'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
fs.writeFileSync(pending,JSON.stringify(build,null,2));fs.renameSync(pending,'BUILD-R20.json');
console.log(JSON.stringify({file:build.file,sha256:build.sha256,bytes:build.bytes}));
