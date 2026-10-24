'use strict';const fs=require('fs'),vm=require('vm');vm.runInThisContext(fs.readFileSync('src/research/r21/BodySourcePositionsR21.js','utf8'));
let source=fs.readFileSync('tools/qa-hermite-r21.cjs','utf8');
source=source.replace("vm.runInThisContext(fs.readFileSync('src/research/r21/BodyHermiteR21.js','utf8'));",'').replace("input='qa/fidelity-r21/offline/hermite-program.json'","input='qa/fidelity-r21/offline/source-position-program.json'").replace('BodyHermiteR21.create(data)','BodySourcePositionsR21.create(data)');
source=source.replaceAll('hermite-surface','source-position-surface').replaceAll('source-hermite-fidelity','source-position-fidelity').replaceAll('Direct analytic Hermite function','Direct analytic source-position interpolant with separate source shading directions');
vm.runInNewContext(source,{require,__dirname,console,BodySourcePositionsR21},{filename:'source-position-independent-diagnostic'});
