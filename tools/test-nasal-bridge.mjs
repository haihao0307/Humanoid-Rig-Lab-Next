// Bounded source-free fixtures: bridge attachments and transverse shape.
// These verify geometry constraints, not anatomical or visual acceptance.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const context=vm.createContext({clamp:(x,a,b)=>Math.max(a,Math.min(b,x))});
new vm.Script(['body/PerioralSurface.js','body/BrowAnatomy.js','body/BeardAnatomy.js','body/FaceAnatomy.js'].map(read).join('\n')+'\nglobalThis.bridge=compactNasalBridgeDepth;').runInContext(context);
let checks=0,maxEndSlopeError=0;
for(const half of [.025,.031,.037])for(const slope of [-.65,-.40,-.1,0])for(const projection of [.008,.015,.024]){
  const cheek=.17,centre=cheek-slope*half*.5+projection,at=x=>context.bridge(x,half,cheek,slope,centre),eps=1e-7;
  assert(Math.abs(at(0)-centre)<1e-12,'bridge peak must retain the authored centreline');
  assert(Math.abs(at(half)-cheek)<1e-12,'bridge attachment must retain the cheek depth');
  const error=Math.abs((at(half)-at(half-eps))/eps-slope);maxEndSlopeError=Math.max(maxEndSlopeError,error);
  assert(error<2e-6,'bridge side must retain the incoming cheek slope');
  checks+=3;
  let previous=at(0),previousSlope=0,turns=0;
  for(let i=1;i<=1000;i++){
    const x=half*i/1000,z=at(x),d=(z-previous)/(half/1000);
    assert(Number.isFinite(z)&&z<=previous+1e-12,'nasal flank must not grow a second height peak');
    assert(Math.abs(z-at(-x))<1e-12,'symmetric authored inputs must stay symmetric');
    const direction=Math.sign(d-previousSlope);if(i>1&&direction>0&&previousSlope<0)turns++;
    previous=z;previousSlope=d;checks+=2;
  }
  assert(turns>0,'flank slope must relax toward its cheek attachment');checks++;
}
console.log(JSON.stringify({checks,maxEndSlopeError,visualAcceptance:false}));
