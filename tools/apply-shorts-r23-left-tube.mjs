// One-time canonical wiring for the source-only R2.3 left-tube module.
// It never creates geometry or changes cloth/material data.
import fs from 'node:fs';
const manifestPath='source/assembly.json',runtimePath='source/runtime.template.js';
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const module='clothing/ShortsTubeFormationR2.js';
if(!manifest.modules.includes(module))throw Error('R2.3 module is missing from source/assembly.json');
let runtime=fs.readFileSync(runtimePath,'utf8');
const marker=`/*__SOURCE:${module}__*/`,anchor='/*__SOURCE:clothing/ShortsLegAssembly.js__*/';
if(!runtime.includes(marker)){
  if(!runtime.includes(anchor)||runtime.indexOf(anchor)!==runtime.lastIndexOf(anchor))throw Error('Ambiguous R2.3 runtime source anchor');
  runtime=runtime.replace(anchor,marker+'\n'+anchor);
  fs.writeFileSync(runtimePath,runtime);
  console.log('Inserted canonical R2.3 runtime source marker.');
}else console.log('R2.3 runtime source marker is already canonical.');
