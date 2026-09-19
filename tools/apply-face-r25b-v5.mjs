import {readFileSync,writeFileSync} from 'node:fs';

const path='body/EyeAnatomy.js';
let source=readFileSync(path,'utf8');
const needle='  float c=cos(angle),s=sin(angle),vertical=abs(s),canthus=vertical*vertical,sideSign=compactEyeSide<.5?1.:-1.,lateral=c*sideSign;\n';
const replacement=needle+`  float height=s>=0.?\${COMPACT_EYE_ANATOMY.fissure.upperHeight.toFixed(6)}*(1.+(\${COMPACT_EYE_ANATOMY.fissure.upperTemporalBias.toFixed(6)})*lateral):\${COMPACT_EYE_ANATOMY.fissure.lowerHeight.toFixed(6)}*(1.-(\${COMPACT_EYE_ANATOMY.fissure.lowerTemporalBias.toFixed(6)})*lateral);\n`;
if(!source.includes('float height=s>=0.?${COMPACT_EYE_ANATOMY.fissure.upperHeight.toFixed(6)}')){
  const first=source.indexOf(needle);
  if(first<0)throw Error('R25B-v5 angular basis missing');
  if(source.indexOf(needle,first+needle.length)>=0)throw Error('R25B-v5 angular basis not unique');
  source=source.slice(0,first)+replacement+source.slice(first+needle.length);
  writeFileSync(path,source,'utf8');
}
console.log(JSON.stringify({applied:true,restApertureHeightRestored:true}));
