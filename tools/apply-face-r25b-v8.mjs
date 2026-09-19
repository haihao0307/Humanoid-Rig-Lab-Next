import {readFileSync,writeFileSync} from 'node:fs';

const path='body/EyeAnatomy.js';
let source=readFileSync(path,'utf8');
const old=`  float restY=compactLidRestApertureY(angle,sideSign,narrow,wide),closedY=compactLidClosedApertureY(angle,sideSign,compactCanthusSlope);\n  float apertureY=mix(restY,closedY,compactLidSmooth01(blink)),ex=`;
const replacement=`  float restY=compactLidRestApertureY(angle,sideSign,0.,0.),openY=compactLidRestApertureY(angle,sideSign,narrow,wide),closedY=compactLidClosedApertureY(angle,sideSign,compactCanthusSlope);\n  float apertureY=mix(openY,closedY,compactLidSmooth01(blink)),ex=`;
if(source.includes(old)){
  source=source.replace(old,replacement);
  writeFileSync(path,source,'utf8');
}else if(!source.includes('float restY=compactLidRestApertureY(angle,sideSign,0.,0.),openY='))throw Error('R25B-v8 neutral/posed aperture anchor missing');
console.log(JSON.stringify({applied:true,neutralFoldAndPosedApertureSeparated:true}));
