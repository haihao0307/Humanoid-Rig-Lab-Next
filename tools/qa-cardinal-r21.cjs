'use strict';const fs=require('fs'),vm=require('vm');
vm.runInThisContext(fs.readFileSync('src/research/r21/BodyCardinalR21.js','utf8'));
// Reuse only the independent comparison harness, never the fitted coefficients.
let source=fs.readFileSync('tools/qa-hermite-r21.cjs','utf8');
source=source.replace("vm.runInThisContext(fs.readFileSync('src/research/r21/BodyHermiteR21.js','utf8'));",'');
source=source.replace("data=JSON.parse(fs.readFileSync(input))","data={positions:JSON.parse(fs.readFileSync('qa/fidelity-r21/offline/original.json')).positionsYUp,normals:JSON.parse(fs.readFileSync('qa/fidelity-r21/offline/original.json')).normalsYUp,radius:.05}");
source=source.replace('BodyHermiteR21.create(data)','BodyCardinalR21.create(data)');
source=source.replaceAll('hermite-surface','cardinal-surface').replaceAll('source-hermite-fidelity','source-cardinal-fidelity').replaceAll('Direct analytic Hermite function','Direct analytic cardinal Hermite function');
vm.runInNewContext(source,{require,__dirname:__dirname,console,BodyCardinalR21},{filename:'cardinal-independent-diagnostic'});
