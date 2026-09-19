import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../body/EyeAnatomy.js',import.meta.url),'utf8');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>mul(a,1/(Math.hypot(...a)||1));
const context=vm.createContext({Math,clamp,add,sub,mul,dot,cross,norm,COMPACT_INFLUENCES:8});
new vm.Script(source+'\n;globalThis.eyeApertureAPI={anatomy:COMPACT_EYE_ANATOMY,neutral:compactEyeNeutralFissure,aperture:compactEyeAperturePoint,restY:compactEyeRestApertureY,closedY:compactEyeClosedApertureY,shader:COMPACT_EYE_LID_GLSL};').runInContext(context,{timeout:1000});
const api=context.eyeApertureAPI;
assert.equal(api.anatomy.revision,'r25b-canthus-owned-aperture-family');
assert.equal(api.anatomy.baselineRevision,'r24-span-aware-lid-return');

let checks=0;
const check=(value,message)=>{assert(value,message);checks++;};
for(const side of ['left','right']){
  const temporal=side==='left'?0:Math.PI,medial=side==='left'?Math.PI:0;
  for(const angle of [temporal,medial]){
    const neutral=api.aperture(angle,side,[0,0,0]);
    for(const blink of [.25,.5,.75,1]){
      const posed=api.aperture(angle,side,[0,0,blink]);
      check(Math.hypot(posed[0]-neutral[0],posed[1]-neutral[1])<1e-12,'blink moved an owned canthus endpoint');
    }
  }
  for(const c of [-.8,-.4,0,.4,.8]){
    const upperAngle=Math.acos(c),lowerAngle=2*Math.PI-upperAngle;
    let previous=Infinity;
    for(const blink of [0,.25,.5,.75,1]){
      const upper=api.aperture(upperAngle,side,[0,0,blink]),lower=api.aperture(lowerAngle,side,[0,0,blink]),gap=upper[1]-lower[1];
      check(gap<=previous+1e-12,'eyelid gap is not monotone during closure');
      check(gap>=-1e-12,'upper and lower margins crossed during closure');
      if(blink<1)check(gap>1e-5,'eye closed before the requested full blink');
      else check(Math.abs(gap)<1e-12,'full blink did not share one closure seam');
      previous=gap;
    }
  }
  for(let i=0;i<=128;i++){
    const angle=i/128*2*Math.PI;
    check(Math.hypot(...api.neutral(angle,side).map((v,k)=>v-api.aperture(angle,side,[0,0,0])[k]))<1e-12,'neutral wrapper diverged from the shared aperture family');
  }
}
const leftTemporal=api.aperture(0,'left',[0,0,1]),rightTemporal=api.aperture(Math.PI,'right',[0,0,1]);
const leftMedial=api.aperture(Math.PI,'left',[0,0,1]),rightMedial=api.aperture(0,'right',[0,0,1]);
check(Math.abs(leftTemporal[1]-rightTemporal[1])<1e-12&&Math.abs(leftMedial[1]-rightMedial[1])<1e-12,'paired canthus ownership is not mirrored');
const slopes=[.18,-.11],epsilon=.000001;
for(const side of ['left','right']){
  const left0=api.aperture(Math.PI,side,[0,0,1],slopes),left1=api.aperture(Math.acos(-1+epsilon),side,[0,0,1],slopes);
  const right0=api.aperture(0,side,[0,0,1],slopes),right1=api.aperture(Math.acos(1-epsilon),side,[0,0,1],slopes);
  check(Math.abs((left1[1]-left0[1])/(left1[0]-left0[0])-slopes[0])<2e-4,'left canthus attachment tangent changed');
  check(Math.abs((right1[1]-right0[1])/(right1[0]-right0[0])-slopes[1])<2e-4,'right canthus attachment tangent changed');
}
check(api.shader.includes('compactLidAperture')&&api.shader.includes('mix(restY,closedY,closing)')&&api.shader.includes('compactCanthusSlope'),'GLSL path does not use the shared slope-aware aperture family');
check(source.includes('Source-skin slopes are confined to canthus endpoint tangents and depth attachments'),'source-skin slopes are not confined to the owned canthus boundary condition');
console.log(JSON.stringify({checks,revision:api.anatomy.revision,canthiInvariant:true,closureMonotone:true,fullBlinkSharedSeam:true,cpuAndGlslFamilyDeclared:true,canthalTangentsPreserved:true,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
