import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const createStitchDofs=new Function(readFileSync(new URL('../clothing/ShortsStitchDofs.js',import.meta.url),'utf8')+';return createShortsStitchDofs;')();
const p=(x,mass=1)=>({uv:[x,0],pos:[x,1,0],previous:[x,1,0],velocity:[0,0,0],mass,invMass:1/mass});
const close={started:true,closureProgress:1},near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
test('only completed, near original seam points can share a spatial degree of freedom',()=>{const ps=[p(0),p(.002),p(1)],d=createStitchDofs(ps);assert.throws(()=>d.join(0,1,{started:false,closureProgress:1}));assert.throws(()=>d.join(0,1,{started:true,closureProgress:.9}));assert.equal(d.join(0,2,close),false);assert.equal(d.report().spatialDofCount,3);d.join(0,1,close);assert.equal(d.report().spatialDofCount,2);assert.notEqual(ps[0],ps[1]);assert.notEqual(ps[0].uv,ps[1].uv);});
test('stitch equality projection preserves source mass, centre of mass, and material coordinates',()=>{const ps=[p(0,1),p(.004,3)],source=ps.map(p=>({uv:[...p.uv],mass:p.mass})),d=createStitchDofs(ps);d.join(0,1,close);near(ps[0].pos[0],.003);near(ps[1].pos[0],.003);near(d.report().totalMass,4);assert.deepEqual(ps.map(p=>({uv:p.uv,mass:p.mass})),source);});
test('a stitched cluster integrates gravity once, not once per material member',()=>{const ps=[p(0),p(.002,3)],d=createStitchDofs(ps);d.join(0,1,close);d.beginStep(.1);near(ps[0].pos[1],1-.0981);near(ps[1].pos[1],1-.0981);d.endStep(.1);near(ps[0].velocity[1],-.981);near(ps[1].velocity[1],-.981);});
test('joining during a substep preserves both original CCD trajectory origins and momentum',()=>{const ps=[p(0),p(.002,3)];ps[0].velocity=[.01,0,0];ps[1].velocity=[-.002,0,0];const d=createStitchDofs(ps);d.beginStep(.01,{gravity:[0,0,0]});const previous=ps.map(p=>[...p.previous]);d.join(0,1,close);assert.deepEqual(ps.map(p=>p.previous),previous);assert.notDeepEqual(previous[0],previous[1]);d.endStep(.01);near(ps[0].velocity[0],.001);near(ps[1].velocity[0],.001);});
test('repeated source gradients aggregate before the inverse-mass denominator',()=>{const ps=[p(0,1),p(.002,3),p(.1,2)],d=createStitchDofs(ps);d.join(0,1,close);const massCenter=ps.reduce((sum,p)=>sum+p.mass*p.pos[0],0)/6,value=ps[2].pos[0]-ps[0].pos[0],r=d.project([0,1,2],[[-.5,0,0],[-.5,0,0],[1,0,0]],value);near(r.denominator,.75);near(ps[0].pos[0],ps[2].pos[0]);near(ps[0].pos[0],massCenter);});
test('opposite gradients on one stitch cluster cancel instead of moving duplicated corners',()=>{const ps=[p(0),p(.002)],d=createStitchDofs(ps);d.join(0,1,close);const before=ps.map(p=>[...p.pos]),r=d.project([0,1],[[1,0,0],[-1,0,0]],.3);near(r.denominator,0);near(r.deltaLambda,0);assert.deepEqual(ps.map(p=>p.pos),before);});
test('barycentric body/contact corrections use total stitched mass and aggregated weights',()=>{const ps=[p(0,1),p(.002,3),p(.1,2)],d=createStitchDofs(ps);d.join(0,1,close);const before=ps.map(p=>p.pos[1]),r=d.project([0,1,2],[[0,.2,0],[0,.3,0],[0,.5,0]],-.01);near(r.denominator,.5*.5/4+.5*.5/2);near(.2*(ps[0].pos[1]-before[0])+.3*(ps[1].pos[1]-before[1])+.5*(ps[2].pos[1]-before[2]),.01);});
test('a four-corner stitched junction retains four UV particles and one physical mass total',()=>{const ps=[p(0,1),p(.001,2),p(.002,3),p(.003,4)],source=ps.map(p=>({uv:[...p.uv],mass:p.mass})),d=createStitchDofs(ps);d.join(0,1,close);d.join(2,3,close);d.join(0,2,close);d.beginStep(.01);d.endStep(.01);near(d.report().totalMass,10);assert.equal(d.report().spatialDofCount,1);assert.deepEqual(ps.map(p=>({uv:p.uv,mass:p.mass})),source);assert.ok(ps.every(p=>p.pos.every((v,k)=>v===ps[0].pos[k])));});
test('a rejected later gradient leaves every source point unchanged and the next valid query remains independent',()=>{const ps=[p(0),p(.002),p(.1,2)],d=createStitchDofs(ps);d.project([0,1],[[1,0,0],[-1,0,0]],-.001);const before=structuredClone(ps);assert.throws(()=>d.project([0,1],[[5,0,0],[NaN,0,0]],.1),/gradient/);assert.deepEqual(ps,before);near(d.effectiveInverseMass([2],[[0,2,0]]),2);const result=d.project([2],[[0,1,0]],-.01);near(result.denominator,.5);near(ps[2].pos[1],1.01);assert.deepEqual(ps[0],before[0]);assert.deepEqual(ps[1],before[1]);});
test('joining previously queried groups immediately changes the physical gradient denominator',()=>{const ps=[p(0,1),p(.002,3),p(.1,2)],d=createStitchDofs(ps);near(d.effectiveInverseMass([0,1],[[1,0,0],[-1,0,0]]),4/3);d.join(0,1,close);near(d.effectiveInverseMass([0,1],[[1,0,0],[-1,0,0]]),0);const before=ps.map(p=>[...p.pos]),result=d.project([1,2],[[-1,0,0],[1,0,0]],.02);near(result.denominator,.75);assert.deepEqual(ps[0].pos,ps[1].pos);near((ps[2].pos[0]-before[2][0])-(ps[1].pos[0]-before[1][0]),-.02);});
test('a finite thread multiplier bounds cumulative tension using the whole sewn mass without changing material identity',()=>{
 const ps=[p(0,.001),p(.002,.003),p(.1,.002)],d=createStitchDofs(ps),h=1/240,tensionN=.02,minimumLambda=-tensionN*h*h,source=ps.map(p=>({uv:[...p.uv],mass:p.mass}));d.join(0,1,close);
 const before=ps.map(p=>[...p.pos]),center=ps.reduce((sum,p)=>sum+p.mass*p.pos[0],0),indices=[0,1,2],gradients=[[-.5,0,0],[-.5,0,0],[1,0,0]];
 const first=d.project(indices,gradients,.09,{tensionOnly:true,minimumLambda});near(first.lambda,minimumLambda);near(first.denominator,750);near(-first.lambda/(h*h),tensionN);
 near(ps[0].pos[0]-before[0][0],-minimumLambda/.004);near(ps[2].pos[0]-before[2][0],minimumLambda/.002);near(ps.reduce((sum,p)=>sum+p.mass*p.pos[0],0),center);assert.deepEqual(ps[0].pos,ps[1].pos);
 const capped=structuredClone(ps),again=d.project(indices,gradients,.09,{lambda:first.lambda,tensionOnly:true,minimumLambda});assert.equal(again.deltaLambda,0);assert.deepEqual(ps,capped);
 const released=d.project(indices,gradients,-.001,{lambda:first.lambda,tensionOnly:true,minimumLambda});assert.equal(released.lambda,0);for(let i=0;i<ps.length;i++)near(ps[i].pos[0],before[i][0]);assert.deepEqual(ps.map(p=>({uv:p.uv,mass:p.mass})),source);
 for(const lower of [NaN,Infinity,-Infinity,.01])assert.throws(()=>d.project(indices,gradients,.1,{tensionOnly:true,minimumLambda:lower}),/lower bound/);
});

test('collision motion limiting keeps stitched groups coincident and retains original trajectories',()=>{
 const ps=[p(0,1),p(.002,3),p(.1,2)],d=createStitchDofs(ps);d.join(0,1,close);
 d.beginStep(.01,{gravity:[0,0,0]});const previous=ps.map(p=>p.previous.slice()),source=ps.map(p=>({uv:p.uv.slice(),mass:p.mass}));
 d.project([0],[[0,1,0]],-.04);d.project([2],[[0,1,0]],-.02);d.limitStep(.25);
 assert.deepEqual(ps[0].pos,ps[1].pos);near(ps[0].pos[1],1.01);near(ps[2].pos[1],1.005);
 assert.deepEqual(ps.map(p=>p.previous),previous);assert.deepEqual(ps.map(p=>({uv:p.uv,mass:p.mass})),source);
 d.endStep(.01);near(ps[0].velocity[1],1);assert.throws(()=>d.limitStep(-.1),/fraction/);assert.throws(()=>d.limitStep(NaN),/fraction/);
});

test('sewing does not commit a stitch that only closes transiently inside a solver iteration',()=>{
 const ps=[p(0),p(.009)],d=createStitchDofs(ps,{joinTolerance:.0001}),source=structuredClone(ps);
 d.project([0,1],[[-1,0,0],[1,0,0]],.009);
 assert.ok(Math.abs(ps[0].pos[0]-ps[1].pos[0])<1e-12);
 const before=structuredClone(ps);assert.equal(d.join(0,1,{...close,requirePreviousClosure:true}),false);assert.deepEqual(ps,before);assert.equal(d.report().spatialDofCount,2);
 d.limitStep(.5);near(ps[1].pos[0]-ps[0].pos[0],.0045);
 d.project([0,1],[[-1,0,0],[1,0,0]],.0045);d.endStep(.01);d.beginStep(.01,{gravity:[0,0,0]});
 // Remove the inherited approach velocity to model an accepted resting seam.
 d.project([0,1],[[-1,0,0],[1,0,0]],ps[1].pos[0]-ps[0].pos[0]);
 assert.equal(d.join(0,1,{...close,requirePreviousClosure:true}),true);assert.equal(d.report().spatialDofCount,1);assert.deepEqual(ps[0].pos,ps[1].pos);
 assert.deepEqual(ps.map(p=>({uv:p.uv,mass:p.mass})),source.map(p=>({uv:p.uv,mass:p.mass})));
});
