import {readFileSync,writeFileSync} from 'node:fs';

const path='body/EyeAnatomy.js';
let source=readFileSync(path,'utf8');
const replaceOnce=(needle,replacement,label)=>{
  const first=source.indexOf(needle);
  if(first<0)throw Error('R25B-v4 anchor missing: '+label);
  if(source.indexOf(needle,first+needle.length)>=0)throw Error('R25B-v4 anchor not unique: '+label);
  source=source.slice(0,first)+replacement+source.slice(first+needle.length);
};
if(!source.includes('float c=cos(angle),s=sin(angle),vertical=abs(s),canthus=vertical*vertical,sideSign=compactEyeSide<.5?1.:-1.,lateral=c*sideSign;')){
  replaceOnce(
    '  float c=cos(angle),s=sin(angle),canthus=s*s;\n',
    '  float c=cos(angle),s=sin(angle),vertical=abs(s),canthus=vertical*vertical,sideSign=compactEyeSide<.5?1.:-1.,lateral=c*sideSign;\n',
    'GLSL angular basis');
  replaceOnce(
    '  float sideSign=compactEyeSide<.5?1.:-1.;\n  float restY=',
    '  float restY=',
    'duplicate side sign');
  writeFileSync(path,source,'utf8');
}
console.log(JSON.stringify({applied:true,analyticAngularInputsRestored:true}));
