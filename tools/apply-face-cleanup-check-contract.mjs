import {readFileSync,writeFileSync} from 'node:fs';

const path='tools/check-skin-appearance.mjs';
let source=readFileSync(path,'utf8');
const obsolete=" check(defaults.redness>0&&eastAsian.every(p=>p.redness>0)&&/const redness=palette==='east-asian'/.test(skin),'reusable skin palettes retain bounded redness variation');\n";
if(source.includes(obsolete)){
  source=source.replace(obsolete,'');
  writeFileSync(path,source,'utf8');
}else if(!source.includes('default and generated faces are neutral without authored cheek blush')){
  throw Error('R25C neutral-redness source contract missing');
}
console.log(JSON.stringify({applied:true,obsoletePositiveRednessContractRemoved:true}));
