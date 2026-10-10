const assert = require('node:assert/strict');
const C = require('./core.js');
let checks = 0;
const results=[];
for(let weave=0;weave<4;weave++){
 const g=C.compile({weave}), a=C.audit(g);
 assert.equal(a.yarns,350);assert.equal(a.crossings,26656);assert.equal(a.wrongCrossingOrder,0);assert.ok(a.finite);assert.ok(a.crossingCenterClearanceMm>0);checks+=5;
 for(let x=0;x<g.d.width;x++){let sum=0;for(let y=0;y<g.d.height;y++)sum+=g.d.cells[y*g.d.width+x];assert.equal(sum,weave===1?2:3);checks++;}
 for(const c of g.curves){assert.ok(Math.abs(c.points[0]-(c.family==='warp'?c.points[c.points.length-3]:-g.p.width/2))<1e-4);assert.ok(Math.abs(c.points[1]-(c.family==='weft'?c.points[c.points.length-2]:-g.p.height/2))<1e-4);checks+=2;}
 results.push({weave,...a});
}
const thin=C.compile({thickness:.45}),thick=C.compile({thickness:1.05});assert.ok(thick.rz>thin.rz&&thick.lift>thin.lift);checks++;
for(const options of [{width:0},{thickness:-1},{warpPitch:.01},{width:.1},{weave:5},{weave:1.2},{slub:4}]){assert.throws(()=>C.compile(options));checks++;}
const fs=require('node:fs');fs.writeFileSync('core-qa.json',JSON.stringify({checks,results,status:'passed'},null,2));console.log(JSON.stringify({checks,results,status:'passed'}));
