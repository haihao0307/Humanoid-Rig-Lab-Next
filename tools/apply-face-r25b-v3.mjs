import {readFileSync,writeFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const write=(path,content)=>writeFileSync(path,content,'utf8');
const replaceOnce=(source,needle,replacement,label)=>{
  const first=source.indexOf(needle);
  if(first<0)throw Error('R25B-v3 anchor missing: '+label);
  if(source.indexOf(needle,first+needle.length)>=0)throw Error('R25B-v3 anchor not unique: '+label);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
};

const eyePath='body/EyeAnatomy.js';
let eye=read(eyePath);
if(!eye.includes('float apertureY=mix(restY,closedY,compactLidSmooth01(blink))')){
  eye=replaceOnce(eye,
    `  vec2 restAperture=compactLidAperture(angle,sideSign,narrow,wide,0.,compactCanthusSlope),aperture=compactLidAperture(angle,sideSign,narrow,wide,blink,compactCanthusSlope);\n  float restY=restAperture.y,ex=aperture.x+rimDX/rimLength*rimWidth,closureU=(c+1.)*.5;\n  float ey=aperture.y+rimDY/rimLength*rimWidth;`,
    `  float restY=compactLidRestApertureY(angle,sideSign,narrow,wide),closedY=compactLidClosedApertureY(angle,sideSign,compactCanthusSlope);\n  float apertureY=mix(restY,closedY,compactLidSmooth01(blink)),ex=${'${COMPACT_EYE_ANATOMY.fissure.halfWidth.toFixed(6)}'}*c+rimDX/rimLength*rimWidth,closureU=(c+1.)*.5;\n  float ey=apertureY+rimDY/rimLength*rimWidth;`,
    'scalar-friendly GLSL aperture locals');
  write(eyePath,eye);
}

const checkPath='tools/check-eye-anatomy.mjs';
let check=read(checkPath);
if(!check.includes('scalarContext.compactLidClosedApertureY')){
  const anchor=`  const scalarContext=vm.createContext({clamp,mix:(a,b,t)=>a+(b-a)*t,sin:Math.sin,cos:Math.cos,exp:Math.exp,pow:Math.pow,sqrt:Math.sqrt,abs:Math.abs,max:Math.max,min:Math.min,uintBitsToFloat:x=>x,axillaCorrective:{x:0,y:0,z:0,w:0},eyeLidParam:{x:0,y:0},eyeOuterTangentU:{x:0,y:0,z:0}});\n`;
  const replacement=anchor+`  scalarContext.compactLidSmooth01=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};\n  scalarContext.compactLidRestApertureY=(angle,sideSign,narrow,wide)=>{\n    const p=api.anatomy.fissure,c=Math.cos(angle),s=Math.sin(angle),vertical=Math.abs(s),lateral=c*sideSign,canthus=s*s;\n    const height=s>=0?p.upperHeight*(1+p.upperTemporalBias*lateral):p.lowerHeight*(1-p.lowerTemporalBias*lateral);\n    const neutral=(s>=0?1:-1)*height*vertical*(1-p.verticalRoundness+p.verticalRoundness*vertical)+p.lateralCanthusLift*lateral*(1-canthus);\n    return neutral+((s>=0?-.0022:.0014)*narrow+(s>=0?.0019:-.0004)*wide)*canthus;\n  };\n  scalarContext.compactLidClosedApertureY=(angle,sideSign,canthusSlopes)=>{\n    const p=api.anatomy.fissure,c=Math.cos(angle),u=(c+1)*.5,u2=u*u,u3=u2*u,left=-p.lateralCanthusLift*sideSign,right=p.lateralCanthusLift*sideSign;\n    const m0=canthusSlopes.x*2*p.halfWidth,m1=canthusSlopes.y*2*p.halfWidth;\n    const base=(2*u3-3*u2+1)*left+(u3-2*u2+u)*m0+(-2*u3+3*u2)*right+(u3-u2)*m1;\n    const centreFromTangents=(m0-m1)*.125,envelope=Math.pow(Math.max(0,1-c*c),api.anatomy.closure.envelopePower);\n    return base+(api.anatomy.closure.centreY-centreFromTangents)*envelope;\n  };\n`;
  check=replaceOnce(check,anchor,replacement,'scalar aperture helpers');
  write(checkPath,check);
}

console.log(JSON.stringify({applied:true,scalarShaderFixtureAligned:true}));
