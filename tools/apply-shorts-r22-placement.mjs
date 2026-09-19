// R2.2 is already canonical on this isolated branch. This retained command is
// now a read-only compatibility verifier so it cannot overwrite later stages.
import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync('source/assembly.json','utf8'));
const runtime=fs.readFileSync('source/runtime.template.js','utf8');
const cloth=fs.readFileSync('clothing/ClothShorts.js','utf8');
for(const file of ['clothing/ShortsPlacementR2.js','clothing/ShortsLegAssembly.js']){
  if(!manifest.modules.includes(file))throw Error('Missing canonical source module: '+file);
  if(!runtime.includes(`/*__SOURCE:${file}__*/`))throw Error('Missing canonical runtime source marker: '+file);
}
if(!cloth.includes('applyShortsRigidPlacementR2'))throw Error('R2.2 placement is not wired into the canonical garment source');
console.log('R2.2 placement is already canonical; no migration was applied.');
