const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('./core.js');let crossings=0,spans=0,splitYarns=0;
for(let weave=0;weave<4;weave++){
 const g=C.compile({weave});const a=C.audit(g);assert.equal(a.wrongCrossingOrder,0);assert.equal(a.finite,true);assert(a.crossingCenterClearanceMm>0);crossings+=a.crossings;
 for(let damage=0;damage<5;damage++)for(let kind=0;kind<2;kind++)for(let id=0;id<(kind?g.ny:g.nx);id++){
  const r=C.cutRanges(g,kind,id,damage);const full=kind?g.nx:g.ny;assert(r.length>0);if(r.length>1)splitYarns++;
  let previous=-1;for(const [lo,hi] of r){assert(Number.isFinite(lo)&&Number.isFinite(hi));assert(lo>=0&&lo<hi&&hi<=full);assert(lo>previous);previous=hi;spans++;}
  if(kind&&damage===2)assert.deepEqual(r,[[0,full]]);
 }
 const ix=Math.floor((4+g.p.width/2)/g.p.warpPitch),iy=Math.floor((-1+g.p.height/2)/g.p.weftPitch);
 const tcw=(-1+g.p.height/2)/g.p.weftPitch,tcf=(4+g.p.width/2)/g.p.warpPitch;
 assert(!C.cutRanges(g,0,ix,3).some(([a,b])=>a<=tcw&&tcw<=b));
 assert(!C.cutRanges(g,1,iy,3).some(([a,b])=>a<=tcf&&tcf<=b));
 assert(C.cutRanges(g,1,iy,2).some(([a,b])=>a<=tcf&&tcf<=b));
}
for(const input of [{thickness:NaN},{thickness:0},{warpPitch:.01},{weave:7},{slub:-1}])assert.throws(()=>C.compile(input));
let src=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');assert(!src.includes("ui(seamProg,'uEdge',1)"));assert(!src.includes('lit=mix(filtered,lit'));
const result={passed:true,drafts:4,crossings,spansChecked:spans,splitYarns,scope:'Draft centers, generated cut-interval topology and source regressions; not global collision or film-grade proof'};
fs.writeFileSync(path.join(__dirname,'core-qa.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
