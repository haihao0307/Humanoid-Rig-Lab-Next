import {readFileSync,writeFileSync} from 'node:fs';

const path='body/EyeAnatomy.js';
let source=readFileSync(path,'utf8');
const angular='  float c=cos(angle),s=sin(angle),vertical=abs(s),canthus=vertical*vertical,sideSign=compactEyeSide<.5?1.:-1.,lateral=c*sideSign;\n';
const next='  float closing=blink*blink*(3.-2.*blink),rimWidth=';
const needle=angular+next;
const height=`  float height=s>=0.?\${COMPACT_EYE_ANATOMY.fissure.upperHeight.toFixed(6)}*(1.+(\${COMPACT_EYE_ANATOMY.fissure.upperTemporalBias.toFixed(6)})*lateral):\${COMPACT_EYE_ANATOMY.fissure.lowerHeight.toFixed(6)}*(1.-(\${COMPACT_EYE_ANATOMY.fissure.lowerTemporalBias.toFixed(6)})*lateral);\n`;
if(source.includes(needle)){
  const first=source.indexOf(needle);
  if(source.indexOf(needle,first+needle.length)>=0)throw Error('R25B-v6 patch-function anchor not unique');
  source=source.slice(0,first)+angular+height+next+source.slice(first+needle.length);
  writeFileSync(path,source,'utf8');
}else if(!source.includes(angular+height+next))throw Error('R25B-v6 patch-function anchor missing');
console.log(JSON.stringify({applied:true,patchFunctionHeightAnchored:true}));
