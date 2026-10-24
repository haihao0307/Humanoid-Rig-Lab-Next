'use strict';const fs=require('fs');let s=fs.readFileSync('src/BodyRayIntervalsR21.glsl','utf8');
fs.writeFileSync('qa/fidelity-r21/offline/intervals-packed-exhaustive.glsl',s);
const a=s.indexOf('vec2 functionRange('),b=s.indexOf('vec2 blendWeightRange(',a);if(a<0||b<0)throw Error('Range markers missing');s=s.slice(0,a)+s.slice(b);
const c=s.indexOf('vec2 composedRange('),d=s.indexOf('// In the main field',c);if(c<0||d<0)throw Error('Composition markers missing');s=s.slice(0,c)+s.slice(d);
const start=s.indexOf('   float stackLo[24]'),end=s.indexOf('\n  }\n  if(next<=t)',start);if(start<0||end<0)throw Error('Isolation stack missing');
s=s.slice(0,start)+`   // A varying blend is not cubic. Retain explicit finite probes here and
   // report that these transition spans have no global first-root certificate.
   float previous=t,previousValue=scalar(p);
   for(int probe=1;probe<=8;probe++){
    float current=mix(t,next,float(probe)/8.),value=scalar(ro+rd*current);
    if(previousValue==0.){hitT=previous;return true;}
    if(previousValue*value<0.){float lo=previous,hi=current;
     for(int refine=0;refine<20;refine++){float mid=(lo+hi)*.5;if(mid<=lo||mid>=hi)break;float v=scalar(ro+rd*mid);if((v>0.)==(previousValue>0.)){lo=mid;previousValue=v;}else hi=mid;}
     hitT=(lo+hi)*.5;return true;
    }
    if(value==0.){hitT=current;return true;}previous=current;previousValue=value;
   }`+s.slice(end);
fs.writeFileSync('src/BodyRayIntervalsR21.glsl',s);
let ray=fs.readFileSync('src/BodyRayR21.js','utf8').replace('conservative sign-range cell traversal and ordered interval root isolation','conservative sign-cell traversal; cubic root isolation in constant-composition cells; finite probes in varying transitions');
fs.writeFileSync('src/BodyRayR21.js',ray);
