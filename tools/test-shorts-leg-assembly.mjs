import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const files=['ShortsPattern.js','ShortsStitchDofs.js','ShortsContinuousContact.js','ShortsSurfaceContact.js','ShortsTriangleBodyContact.js','ShortsLegAssembly.js','ShortsCloth.js'];
const context=vm.createContext({Float32Array,Float64Array,Uint32Array,performance});
vm.runInContext(files.map(f=>fs.readFileSync(new URL('../clothing/'+f,import.meta.url),'utf8')).join('\n')+';globalThis.Cloth=ShortsCloth;',context);
const plain=x=>JSON.parse(JSON.stringify(x));
function pattern(){return context.createShortsPattern({unit:'m',waistFrontArc:.34,waistBackArc:.36,hipFrontArc:.44,hipBackArc:.49,waistTopFrontArc:.333,waistTopBackArc:.351,waistToHip:.18,crotchDepth:.255,frontRiseLength:.32,backRiseLength:.37,thighCircumference:{left:.54,right:.55},metadata:{source:'synthetic unit-test measurements',waistY:.956,centerZ:.078,bounds:{minZ:-.065,maxZ:.22}}});}
function make(p=pattern(),extra={}){return new context.Cloth(p,null,{stitchDofs:true,gravity:0,selfContact:false,legAssemblyWorkspaces:true,...extra});}
const material=sim=>plain(sim.particles.map(p=>({uv:p.uv,mass:p.mass,invMass:p.invMass,previous:p.previous})));
test('workspaces are opt-in; old paper-only solver remains compatible',()=>{
 const sim=new context.Cloth(pattern(),null,{stitchDofs:true,selfContact:false});assert.equal(sim.legAssembly,null);assert.equal(sim.report().legAssembly.enabled,false);
 assert.throws(()=>make(pattern(),{legAssemblyWorkspaces:'yes'}),/workspace option/);
});
test('identifies both original legs, without changing placement, paper, mass or histories',()=>{
 const p=pattern(),old=plain(p),sim=make(p),before=material(sim),report=sim.legAssembly.report();
 assert.equal(report.activeConstraintCount,162);assert.deepEqual(plain(p),old);
 const left=report.groups.find(g=>g.kind==='lower-leg-workspace'&&g.side==='left'),right=report.groups.find(g=>g.kind==='lower-leg-workspace'&&g.side==='right');
 assert.equal(left.indices.length,80);assert.equal(right.indices.length,80);
 assert.ok(left.indices.every(i=>['FL','BL'].includes(sim.particles[i].pieceId)));assert.ok(right.indices.every(i=>['FR','BR'].includes(sim.particles[i].pieceId)));
 sim.legAssembly.solve(1/240);assert.deepEqual(material(sim),before);assert.equal(report.formedShapeTargets,false);
});
test('a mislabelled or cross-leg source seam is rejected rather than hidden by guides',()=>{
 let p=pattern();p.pieces.find(x=>x.id==='FL').side='right';assert.throws(()=>make(p),/ownership/);
 p=pattern();p.seams.find(s=>s.id==='inseam-left').b.pieceId='BR';assert.throws(()=>make(p),/Cross-leg/);
});
test('a right lower-panel point is corrected only across the temporary separating plane',()=>{
 const sim=make(),r=sim.legAssembly.report(),g=r.groups.find(g=>g.kind==='lower-leg-workspace'&&g.side==='right'),p=sim.particles[g.indices.at(-1)];
 p.pos[0]=r.origin[0]-.02;const before=[...p.pos],identity=material(sim);sim.legAssembly.solve(1/240);
 assert.ok(p.pos[0]>before[0]);assert.equal(p.pos[1],before[1]);assert.equal(p.pos[2],before[2]);assert.deepEqual(material(sim),identity);assert.equal(sim.dofs.report().joinedStitchCount,0);
});
test('allowed material is free within its half-space, not pulled to a cylinder or shell',()=>{
 const sim=make(),r=sim.legAssembly.report(),g=r.groups.find(g=>g.kind==='lower-leg-workspace'&&g.side==='right'),p=sim.particles[g.indices.at(-1)];
 p.pos[0]=r.origin[0]+.5;const before=[...p.pos];sim.legAssembly.solve(1/240);assert.deepEqual([...p.pos],before);
});
test('guide frame rotates and translates with rigid source placement, not world X',()=>{
 const p=pattern(),rotate=v=>[v[2],v[1],-v[0]],shift=[3,2,-4];
 for(const piece of p.pieces){piece.placement.origin=rotate(piece.placement.origin).map((v,k)=>v+shift[k]);piece.placement.basisU=rotate(piece.placement.basisU);piece.placement.basisV=rotate(piece.placement.basisV);}
 const sim=make(p),r=sim.legAssembly.report(),g=r.groups.find(g=>g.kind==='lower-leg-workspace'&&g.side==='right'),point=sim.particles[g.indices.at(-1)];
 assert.deepEqual([...r.normal],[0,0,-1]);point.pos[2]=r.origin[2]+.02;const before=[...point.pos];sim.legAssembly.solve(1/240);
 assert.equal(point.pos[0],before[0]);assert.equal(point.pos[1],before[1]);assert.ok(point.pos[2]<before[2]);
});
test('time/progress do not release guides; actual owning-leg seam equality does',()=>{
 const sim=make();sim.time=100;for(const seam of sim.seams){seam.progress=1;for(const p of seam.pairs)p.started=true;}sim.legAssembly.solve(1/240);assert.equal(sim.legAssembly.report().activeConstraintCount,162);
 // Mock only the equality predicate to isolate the release condition. This is
 // not a physically sewn garment or a force-weld procedure for the runtime.
 const own=new Set(sim.seams.filter(s=>['inseam-left','outseam-left'].includes(s.id)).flatMap(s=>s.pairs.map(p=>[p.a,p.b].sort((a,b)=>a-b).join(':'))));
 sim.dofs.same=(a,b)=>own.has([a,b].sort((x,y)=>x-y).join(':'));sim.legAssembly.solve(1/240);
 const r=sim.legAssembly.report();assert.equal(r.activeConstraintCount,82);assert.equal(r.groups.find(g=>g.kind==='lower-leg-workspace'&&g.side==='left').active,false);assert.ok(r.groups.filter(g=>g.side==='right').every(g=>g.active));
 sim.dofs.same=()=>true;sim.legAssembly.solve(1/240);assert.equal(sim.legAssembly.hasActive(),false);assert.equal(sim.legAssembly.report().activeConstraintCount,0);
 const before=sim.particles.map(p=>[...p.pos]);sim.legAssembly.solve(1/240);assert.deepEqual(sim.particles.map(p=>[...p.pos]),before);
});
test('active authoring guides are counted and cannot pass the wearing gate',()=>{
 const sim=make(),r=sim.report();assert.equal(r.temporarySupportCount,sim.temporarySupports.length+162);assert.equal(r.engineeringCriteriaMet,false);assert.equal(r.legAssembly.visualAcceptance,false);
});
