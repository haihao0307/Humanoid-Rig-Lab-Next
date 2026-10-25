'use strict';
const fs=require('fs'),crypto=require('crypto'),p=require('./program-r17.cjs')(),H=b=>crypto.createHash('sha256').update(b).digest('hex');
const contract={schema:'body-source-state-identity/1',sourceDerived:true,sourceProgramSHA256:H(fs.readFileSync('data/body-function-program-r17.json')),annyBones:p.anny.boneLabels,annyLocals:p.anny.localChangeLabels,normalizations:['explicit positive-zero rotation/translation entries','equivalent rotation object and translation dictionary spelling','known local positive-zero entries'],parameterQuantization:false,headStateIgnored:false,unknownStateFieldsIgnored:false,completedMotherConversion:false};
fs.writeFileSync('data/body-state-identity-r26.json',JSON.stringify(contract)+'\n');
console.log(JSON.stringify({bones:contract.annyBones.length,locals:contract.annyLocals.length}));
