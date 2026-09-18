import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=['ShortsStitchDofs.js','ShortsContinuousContact.js','ShortsSurfaceContact.js','ShortsTriangleBodyContact.js','ShortsCloth.js'].map(file=>readFileSync(new URL('../clothing/'+file,import.meta.url),'utf8')).join('\n');
const scope=vm.createContext({Float32Array,Float64Array,Uint32Array,performance});
vm.runInContext(source+';globalThis.Cloth=ShortsCloth;globalThis.metric=scMetricReport;globalThis.createMetric=scCreateMetric;globalThis.distanceConstraint=scSolveDistance;globalThis.rotateGrip=scRotateDirection;globalThis.makeDofs=createShortsStitchDofs;',scope);
const Cloth=scope.Cloth;
const piece=(id,z=0)=>({id,materialCoordinates:[[0,0],[.1,0],[.1,.1],[0,.1]],triangles:[[0,1,2],[0,2,3]],boundaries:{},placement:{origin:[0,1,z],basisU:[1,0,0],basisV:[0,-1,0]}});
const plain=x=>JSON.parse(JSON.stringify(x));

test('cloth starts as independent exact rigid copies of original paper and integrates gravity without UV or mass edits',()=>{
  const pattern={pieces:[piece('front'),piece('back',.1)],seams:[]},original=plain(pattern),sim=new Cloth(pattern,null,{gravity:0,selfContact:false});
  assert.equal(sim.particles.length,8);assert.equal(sim.metrics.length,4);
  assert.ok(sim.report().material.maxAbsPrincipalStrain<1e-12);
  assert.ok(Math.abs(sim.particles.reduce((s,p)=>s+p.mass,0)-.02*.22)<1e-12);
  const before=sim.snapshot();sim.step(4);assert.deepEqual(plain(pattern),original);
  assert.deepEqual(sim.snapshot().pieces.map(p=>p.materialCoordinates),before.pieces.map(p=>p.materialCoordinates));
  assert.ok(sim.report().material.maxAbsPrincipalStrain<1e-12);
  assert.equal(sim.report().legSkinning,false);assert.equal(sim.report().targetGarmentShape,false);
  const falling=new Cloth({pieces:[piece('free')],seams:[]},null,{selfContact:false});falling.step(2);
  assert.ok(falling.positions[1]<1);assert.ok(Math.abs(falling.positions[1]-falling.positions[4])<1e-7);
});

test('invalid scaled placement is rejected rather than modifying the paper rest metric',()=>{
  const p=piece('bad');p.placement.basisU=[2,0,0];assert.throws(()=>new Cloth({pieces:[p],seams:[]}),/rigid/);
});

test('unstarted source seam exerts no force and a started seam pulls separate particles without welding identities',()=>{
  const seam={id:'test',kind:'sewn',stage:4,a:{pieceId:'front'},b:{pieceId:'back'},pairs:[{a:0,b:0,t:0}]};
  const sim=new Cloth({pieces:[piece('front'),piece('back',.1)],seams:[seam]},null,{gravity:0,selfContact:false,sewingSeconds:1});
  const control=new Cloth({pieces:[piece('front'),piece('back',.1)],seams:[]},null,{gravity:0,selfContact:false,sewingSeconds:1});sim.step(3);control.step(3);assert.deepEqual(sim.particles.map(p=>p.pos),control.particles.map(p=>p.pos));assert.equal(sim.report().seams[0].startedPairCount,0);
  sim.step(70);assert.equal(sim.particles.length,8);assert.equal(sim.report().seams[0].startedPairCount,1);assert.ok(sim.report().seams[0].maxGapM<.1);
});

test('triangle principal strain reveals transverse stretch hidden by the longest edges',()=>{
  const p=[{uv:[0,0],pos:[0,0,0],invMass:1},{uv:[1,0],pos:[1,0,0],invMass:1},{uv:[1,.01],pos:[1,.012,0],invMass:1}],c=scope.createMetric([[0,1,2]],p),r=scope.metric(c,p);
  assert.ok(Math.abs(r.maxPrincipalStretch-1.2)<1e-10);assert.ok(Math.abs(r.minPrincipalStretch-1)<1e-10);
});

test('an unfinished thread may pull its cloth pair together but never pushes a slack pair apart',()=>{
  const p=[{pos:[0,0,0],invMass:1},{pos:[.02,0,0],invMass:1}],c={a:0,b:1,rest:0,lambda:0,tensionOnly:true};
  scope.distanceConstraint(c,p,1/240,0,.05);assert.deepEqual(p.map(x=>x.pos),[[0,0,0],[.02,0,0]]);
  scope.distanceConstraint(c,p,1/240,0,.01);assert.ok(Math.abs(p[1].pos[0]-p[0].pos[0]-.01)<1e-12);
});

test('fixed cloth substeps query continuously interpolated body frames rather than leg skinning',()=>{
  const alphas=[],body={sample:a=>alphas.push(a),projectPoint:()=>null,project:()=>({signedDistance:1,distance:1}),closest:()=>({signedDistance:1,distance:1})};
  const sim=new Cloth({pieces:[piece('free')],seams:[]},body,{gravity:0,selfContact:false});
  assert.equal(sim.advance(1/60),2);assert.deepEqual([...new Set(alphas)],[.25,.5,.75,1]);assert.equal(sim.stepIndex,2);
});

test('unclosed physical thread has a cumulative force bound in both source particle and stitch DOF paths',()=>{
  for(const enabled of [false,true])for(const h of [1/120,1/240]){
    const p=[{pos:[0,0,0],mass:.002,invMass:500,previous:[0,0,0],velocity:[0,0,0]},{pos:[.2,0,0],mass:.004,invMass:250,previous:[.2,0,0],velocity:[0,0,0]}],c={a:0,b:1,rest:0,lambda:0,tensionOnly:true,minimumLambda:-.05*h*h},dofs=enabled?scope.makeDofs(p):null;
    for(let i=0;i<32;i++)scope.distanceConstraint(c,p,h,1e-9,0,dofs);
    assert.ok(Math.abs(-c.lambda/(h*h)-.05)<1e-12);assert.ok(Math.abs(p[0].pos[0]-.05*h*h*500)<1e-12);assert.ok(Math.abs(p[1].pos[0]-(.2-.05*h*h*250))<1e-12);
    assert.ok(p[1].pos[0]-p[0].pos[0]>.19,'a finished time schedule cannot forcibly close a distant resisted stitch');
  }
  assert.throws(()=>new Cloth({pieces:[piece('a')],seams:[]},null,{maxSeamTensionN:0}),/tension/);
});

test('each actual source needle must close before the next needle can exert cloth force',()=>{
  const make=second=>new Cloth({pieces:[piece('a'),piece('b',.1)],seams:[{id:'source',stage:0,a:{pieceId:'a'},b:{pieceId:'b'},pairs:[{a:0,b:0,t:0},{a:second,b:second,t:1}]}]},null,{gravity:0,selfContact:false,stitchDofs:true,needleSchedule:'sequential',maxSeamTensionN:1e-6,stageSewingSeconds:.002,sewingSchedule:'gated'});
  const a=make(1),b=make(2);a.step(4);b.step(4);assert.deepEqual(plain(a.particles.map(p=>p.pos)),plain(b.particles.map(p=>p.pos)),'changing a future needle cannot affect the real material');
  assert.equal(a.seams[0].pairs[0].started,true);assert.equal(a.seams[0].pairs[1].started,false);assert.equal(a.seams[0].needleIndex,0);assert.equal(a.report().seams[0].activeNeedleRank,0);
  scope.distanceConstraint({a:0,b:4,rest:0,lambda:0,tensionOnly:true},a.particles,1/240,0,0,a.dofs);assert.equal(a.dofs.join(0,4,{started:true,closureProgress:1}),true);a.step();assert.ok(a.dofs.same(0,4));assert.equal(a.seams[0].needleIndex,1);assert.equal(a.events.find(e=>e.type==='original_source_needle_completed').needleRank,0);
  assert.throws(()=>new Cloth({pieces:[piece('a')],seams:[]},null,{needleSchedule:'sequential'}),/DOFs/);
});

test('one material edge between distinct contact features never excludes their real intersection',()=>{
  const a=piece('a'),b=piece('b');a.materialCoordinates=[[-.1,-.1],[.1,-.1],[.1,.1],[-.1,.1]];b.materialCoordinates=plain(a.materialCoordinates);b.placement.basisU=[0,0,1];
  const sim=new Cloth({pieces:[a,b],seams:[]},null,{gravity:0});
  // A topological connection to a different face corner is not a shared
  // primitive endpoint. It must not hide the separate intersecting face.
  for(let i=0;i<4;i++)for(let j=4;j<8;j++){sim.neighbours[i].add(j);sim.neighbours[j].add(i);}
  sim._selfContact(false);assert.ok(sim.selfState.edgeEdgeCandidateCount>0);assert.ok(sim.selfState.unresolvedCount>0);
  const near=new Cloth({pieces:[piece('near-a'),piece('near-b',.001)],seams:[]},null,{gravity:0});for(let i=0;i<4;i++)for(let j=4;j<8;j++){near.neighbours[i].add(j);near.neighbours[j].add(i);}assert.ok(near._selfCandidates().result.some(c=>c.i<4&&c.ti>=2));
});

test('waist support is limited to explicitly declared original waistband vertices',()=>{
  const band=piece('WTEST');band.waistSupports=[{index:0,side:'left',front:true,t:0}];
  const body={waistRestSectorPoint:()=>[0,1,.05],createWaistAttachment:p=>({point:p}),attachmentPosition:a=>a.point,sample:()=>{},projectPoint:()=>null,project:()=>({signedDistance:1,distance:1}),closest:()=>({signedDistance:1,distance:1})};
  const sim=new Cloth({pieces:[band,piece('free',.2)],seams:[]},body,{gravity:0,selfContact:false});sim.step();
  assert.equal(sim.supports.length,1);assert.equal(sim.supports[0].index,0);assert.ok(sim.particles[0].invMass>0,'waist attachment preserves physical inverse mass');
  assert.ok(sim.particles.slice(4).every(p=>p.invMass>0));assert.ok(sim.particles[0].pos[2]>0&&sim.particles[0].pos[2]<.05);
});

test('edge contact detects intersecting patches whose corner vertices are all far from the other face',()=>{
  const a=piece('a'),b=piece('b');a.materialCoordinates=[[-.1,-.1],[.1,-.1],[.1,.1],[-.1,.1]];b.materialCoordinates=plain(a.materialCoordinates);b.placement.basisU=[0,0,1];
  const sim=new Cloth({pieces:[a,b],seams:[]},null,{gravity:0});sim._selfContact(false);
  assert.equal(sim.selfState.edgeEdgeImplemented,true);assert.ok(sim.selfState.edgeEdgeCandidateCount>0);
  assert.ok(sim.selfState.unresolvedCount>0,'a pre-existing intersection is unresolved, never silently accepted');
  assert.ok(sim.selfState.ambiguousEdgeCount>0,'without a prior side the solver reports ambiguity rather than inventing a separation side');
  assert.equal(sim.report().engineeringCriteriaMet,false);
});

test('only started stitches with actual close endpoints become local contact neighbours',()=>{
  const seam={id:'sew',kind:'sewn',stage:0,a:{pieceId:'front'},b:{pieceId:'back'},pairs:[{a:0,b:0,t:0},{a:1,b:1,t:1}]};
  const sim=new Cloth({pieces:[piece('front'),piece('back',.1)],seams:[seam]},null,{gravity:0});
  sim._selfContact(false);assert.equal(sim.selfState.seamPairExclusionCount,0);
  sim.step();assert.equal(sim.selfState.seamPairExclusionCount,0);assert.equal(sim.seams[0].pairs[0].started,true);assert.equal(sim.seams[0].pairs[1].started,false);
  sim.particles[4].pos=sim.particles[0].pos.map((v,k)=>v+(k===2?.001:0));sim._selfContact(false);assert.equal(sim.selfState.seamPairExclusionCount,1);
  assert.equal(sim._contactSeamMates.has(1),false,'a future stitch has no contact exemption');
});

test('ground support is an explicit unilateral plane and residual is part of the report',()=>{
  const p=piece('ground');p.placement.origin=[0,.15,0];const sim=new Cloth({pieces:[p],seams:[]},null,{selfContact:false,groundY:.1});sim.step();
  assert.ok(sim.particles.every(p=>p.pos[1]>=.1025-1e-12));assert.equal(sim.report().ground.enabled,true);assert.equal(sim.report().ground.maxPenetrationM,0);
});

test('needle entry releases its original material handling points and neighbours before pulling the seam',()=>{
  const pieces=[piece('a'),piece('b',.1),piece('untouched',.2)];for(const p of pieces)p.boundaries.waist=[0,1];
  const seam={id:'side',kind:'sewn',stage:0,a:{pieceId:'a'},b:{pieceId:'b'},pairs:[{a:0,b:0,t:0}]};
  const sim=new Cloth({pieces,seams:[seam]},null,{gravity:0,selfContact:false});sim.step();
  assert.ok(sim.temporarySupports.filter(s=>s.index<8).every(s=>!s.active));
  assert.ok(sim.temporarySupports.filter(s=>s.index>=8).every(s=>s.active));
  assert.equal(sim.report().temporarySupportCount,2);assert.equal(sim.events.filter(e=>e.type==='release_original_handling_for_started_stitch').length,4);
  assert.ok(sim.particles.every(p=>p.invMass>0),'temporary handlers never change physical cloth mass');
});

test('the integrated swept contact sees a panel crossing another between distant endpoints',()=>{
  const sim=new Cloth({pieces:[piece('still'),piece('moving',.1)],seams:[]},null,{gravity:0,damping:0,substeps:1,iterations:1});
  for(const p of sim.particles.slice(0,4))p.invMass=0;
  for(const p of sim.particles.slice(4))p.velocity=[0,0,-24];
  const uv=sim.particles.map(p=>[...p.uv]);sim.step();
  assert.ok(sim.report().selfContact.sweptHistory.detectedCrossingCount>0);
  assert.ok(sim.particles.slice(4).every(p=>p.pos[2]>=0),'a distant final position cannot bypass a swept cloth face');
  assert.deepEqual(plain(sim.particles.map(p=>p.uv)),plain(uv));
  assert.ok(sim.particles.slice(4).every(p=>p.previous[2]===.1),'the whole substep starts at its real previous positions');
});

test('a sewn four-panel junction has transitive local contact neighbours without welding material vertices',()=>{
  const pieces=['FL','FR','BL','BR'].map((id,i)=>piece(id,i*.001)),pair=(a,b)=>({id:a+'-'+b,stage:0,a:{pieceId:a},b:{pieceId:b},pairs:[{a:0,b:0,t:0}]});
  const sim=new Cloth({pieces,seams:[pair('FL','FR'),pair('BL','BR'),pair('FL','BL'),pair('FR','BR')]},null,{gravity:0});
  sim.seams[0].pairs[0].started=sim.seams[1].pairs[0].started=true;sim._selfCandidates();
  assert.equal(sim._contactSeamMates.get(0).has(12),false,'unsewn opposing components still collide');
  sim.seams[2].pairs[0].started=sim.seams[3].pairs[0].started=true;sim._selfCandidates();
  assert.equal(sim._contactSeamMates.get(0).has(12),true);assert.equal(sim._contactSeamMates.get(4).has(8),true);
  sim.particles[12].pos[2]=.02;sim._selfCandidates();assert.equal(sim._contactSeamMates.get(0).has(12),false,'transitivity cannot extend beyond the real narrow junction');
  assert.equal(sim.particles.length,16);assert.ok(sim.particles.every(p=>p.invMass>0));
});

test('height-only temporary waist handling supports gravity without pulling a closing panel back to its initial plane',()=>{
  const p=piece('held');p.boundaries.waist=[0];const sim=new Cloth({pieces:[p],seams:[]},null,{selfContact:false,handlingMode:'height'}),particle=sim.particles[0];
  particle.pos=[.025,.98,.07];const originalMass=particle.mass;sim._solveSupports(1/240);
  assert.equal(particle.pos[0],.025);assert.equal(particle.pos[2],.07);assert.ok(particle.pos[1]>.98&&particle.pos[1]<1);assert.equal(particle.mass,originalMass);
});

test('extra handling damping exists only while original material grips are active and releases for wear',()=>{
  const p=piece('held');p.boundaries.waist=[0];const sim=new Cloth({pieces:[p],seams:[]},null,{gravity:0,selfContact:false,handlingDamping:20});sim.step();assert.equal(sim.activeDampingRate,20);
  sim.time=4;for(const s of sim.temporarySupports)s.active=false;sim.step();assert.equal(sim.activeDampingRate,2.5);assert.equal(sim.events.filter(e=>e.type==='physical_handling_damping').at(-1).ratePerSecond,2.5);
  const free=new Cloth({pieces:[piece('free')],seams:[]},null,{gravity:0,selfContact:false,handlingDamping:20});free.step();assert.equal(free.activeDampingRate,2.5);
});

test('an exterior ball survives only an exactly identical versioned body pose and interpolation',()=>{
  let queries=0;const hit=()=>({depth:0,signedDistance:1,distance:1}),body={poseVersion:1,alpha:1,closest:hit,project:hit,projectPoint:()=>{queries++;return hit();}},sim=new Cloth({pieces:[piece('free')],seams:[]},body,{gravity:0,selfContact:false});
  sim.contactEpoch=1;sim._bodyContact(1);assert.equal(queries,4);sim.contactEpoch=2;sim._bodyContact(1);assert.equal(queries,4);
  body.poseVersion++;sim._bodyContact(1);assert.equal(queries,8);
  body.alpha=.5;sim._bodyContact(.5);assert.equal(queries,12);
  sim.particles[0].pos[0]+=1;sim._bodyContact(.5);assert.equal(queries,13,'leaving the certified empty ball must refresh the actual body query');
});

test('an uncertain body side never creates or retains an exterior contact certificate',()=>{
  let queries=0,uncertain=true;const hit=()=>({depth:0,signedDistance:1,distance:1,sideUncertain:uncertain}),body={poseVersion:1,alpha:1,closest:hit,project:hit,projectPoint:()=>{queries++;return hit();}},sim=new Cloth({pieces:[piece('free')],seams:[]},body,{gravity:0,selfContact:false});
  sim.contactEpoch=1;sim._bodyContact(1);sim._bodyContact(1);assert.equal(queries,8);assert.ok(sim.particles.every(p=>p.bodyFreeBall===null));
  uncertain=false;sim._bodyContact(1);assert.equal(queries,12);assert.ok(sim.particles.every(p=>p.bodyFreeBall));
  uncertain=true;body.poseVersion++;sim._bodyContact(1);assert.equal(queries,16);assert.ok(sim.particles.every(p=>p.bodyFreeBall===null));
  sim._bodyContact(1);assert.equal(queries,20,'a stale certificate cannot skip a later uncertain body query');
});

test('contact corrections are fed back into later original-material iterations in the same substep',()=>{
  const sim=new Cloth({pieces:[piece('free')],seams:[]},null,{selfContact:false,gravity:0,substeps:1,iterations:5,contactInterleaveEvery:2}),order=[];
  const solve=sim._solveSupports.bind(sim),contact=sim._coupledContact.bind(sim);sim._solveSupports=h=>{order.push('material');solve(h);};sim._coupledContact=a=>{order.push('contact');contact(a);};sim.step();
  assert.deepEqual(order,['material','material','contact','material','material','contact','material','contact']);
  assert.ok(sim.report().material.maxAbsPrincipalStrain<1e-12);
});

test('interleaving a real interior cloth/body contact reduces the material damage caused by a final-only projection',()=>{
  const center=[.05,.95,-.045],radius=.06,closest=p=>{const delta=p.map((v,k)=>v-center[k]),distance=Math.hypot(...delta),normal=delta.map(v=>v/distance);return {signedDistance:distance-radius,distance:Math.abs(distance-radius),normal};};
  const body={poseVersion:1,alpha:1,sample:()=>{},closest,project(p,clearance){const hit=closest(p),depth=Math.max(0,clearance-hit.signedDistance);for(let k=0;k<3;k++)p[k]+=depth*hit.normal[k];return {...hit,depth};}};
  body.projectPoint=(p,previous,clearance)=>body.project(p,clearance);
  const options={gravity:0,substeps:1,iterations:32,selfContact:false},coupled=new Cloth({pieces:[piece('cloth')],seams:[]},body,{...options,contactInterleaveEvery:4}),separated=new Cloth({pieces:[piece('cloth')],seams:[]},body,{...options,contactInterleaveEvery:0});
  coupled.step();separated.step();
  assert.ok(coupled.report().material.maxAbsPrincipalStrain<separated.report().material.maxAbsPrincipalStrain*.6);
  assert.ok(coupled.report().surfaceContact.maxResidualM<=.001);
  assert.deepEqual(plain(coupled.materialCoordinates),plain(separated.materialCoordinates));
});

test('a separately cut gusset is held at its own source edge height until its actual needle arrives',()=>{
  const gusset=piece('gusset'),leg=piece('leg',.05);gusset.handlingPoints=[{index:0,releaseOnNeedleOnly:true}];
  const sim=new Cloth({pieces:[gusset,leg],seams:[{id:'gusset-leg',stage:3,a:{pieceId:'gusset'},b:{pieceId:'leg'},pairs:[{a:0,b:0,t:0}]}]},null,{gravity:0,selfContact:false});
  sim._applySupports(1,1);assert.equal(sim.temporarySupports[0].active,true,'the unrelated bodice/waist holding timeout cannot drop a waiting gusset');
  sim._applySupports(1,1.1);assert.equal(sim.temporarySupports[0].active,false);assert.equal(sim.temporarySupports[0].releasedForNeedle,true);
  assert.equal(sim.events.filter(e=>e.type==='release_original_handling_for_started_stitch').length,1);assert.ok(sim.particles[0].invMass>0);
});

test('gusset holding survives a started long thread and releases only a fully drawn close stitch',()=>{
  const gusset=piece('gusset'),leg=piece('leg',.05);gusset.handlingPoints=[{index:0,releaseWhenStitched:true}];
  const sim=new Cloth({pieces:[gusset,leg],seams:[{id:'gusset-leg',stage:0,a:{pieceId:'gusset'},b:{pieceId:'leg'},pairs:[{a:0,b:0,t:0}]}]},null,{gravity:0,selfContact:false});sim.seams[0].pairs[0].started=true;
  sim._applySupports(1,2);assert.equal(sim.temporarySupports[0].active,true,'a long thread and elapsed timeout cannot release the patch');
  sim.particles[4].pos[2]=.003;sim._applySupports(1,.2);assert.equal(sim.temporarySupports[0].active,true,'proximity alone before the stitch is drawn is insufficient');
  sim._applySupports(1,2);assert.equal(sim.temporarySupports[0].active,false);const event=sim.events.find(e=>e.type==='release_original_handling_for_closed_stitch');assert.equal(event.closureProgress,1);assert.equal(event.gapM,.003);
});

test('completed original stitches share all later material corrections without changing UV, mass, or swept origins',()=>{
  const a=piece('a'),b=piece('b',.003),seam={id:'paired',stage:0,a:{pieceId:'a'},b:{pieceId:'b'},pairs:[0,1].map(i=>({a:i,b:i,t:0}))};
  const sim=new Cloth({pieces:[a,b],seams:[seam]},null,{stitchDofs:true,gravity:0,selfContact:false,iterations:8,substeps:1});sim.time=2;
  const uv=plain(sim.particles.map(p=>p.uv)),mass=sim.particles.map(p=>p.mass);sim.step();
  assert.equal(sim.report().stitchDofs.joinedStitchCount,0,'transient first-step closure stays collision-correctable');
  const previous=plain(sim.particles.map(p=>p.pos));sim.step();
  assert.equal(sim.report().stitchDofs.joinedStitchCount,2);assert.equal(sim.report().stitchDofs.spatialDofCount,6);
  assert.deepEqual(plain(sim.particles[0].pos),plain(sim.particles[4].pos));assert.deepEqual(plain(sim.particles[1].pos),plain(sim.particles[5].pos));
  assert.notEqual(sim.particles[0].pos,sim.particles[4].pos,'spatial equality does not alias original material arrays');
  assert.deepEqual(plain(sim.particles.map(p=>p.previous)),previous);assert.deepEqual(plain(sim.particles.map(p=>p.uv)),uv);assert.deepEqual(sim.particles.map(p=>p.mass),mass);
  assert.ok(sim.events.filter(e=>e.type==='complete_source_stitch_spatial_equality').length===2);
});

test('body and floor corrections of a sewn source endpoint propagate through its physical cluster',()=>{
  const sim=new Cloth({pieces:[piece('a'),piece('b',.00005)],seams:[]},null,{stitchDofs:true,gravity:0,selfContact:false,groundY:1.01});
  sim.dofs.join(0,4,{started:true,closureProgress:1});sim._bodyContact(1);
  assert.deepEqual(plain(sim.particles[0].pos),plain(sim.particles[4].pos));assert.equal(sim.particles[0].pos[1],1.0125);
  sim.body={projectPoint(point){const depth=.02;point[2]+=depth;return {depth,signedDistance:0,distance:0};}};sim._bodyContact(1);
  assert.deepEqual(plain(sim.particles[0].pos),plain(sim.particles[4].pos));assert.ok(sim.particles[0].pos[2]>.02);
});

test('finished timing does not weld or release a retained source grip across an unclosed millimetre gap',()=>{
  const a=piece('G'),b=piece('leg',.003);a.handlingPoints=[{index:0,releaseWhenStitched:true}];const seam={id:'gusset',stage:0,a:{pieceId:'G'},b:{pieceId:'leg'},pairs:[{a:0,b:0,t:0}]},sim=new Cloth({pieces:[a,b],seams:[seam]},null,{stitchDofs:true,selfContact:false,gravity:0});
  sim.seams[0].pairs[0].started=true;sim._applySupports(1,4);assert.equal(sim.temporarySupports[0].active,true);assert.equal(sim.dofs.join(0,4,{started:true,closureProgress:1}),false);sim.seams[0].progress=1;assert.equal(sim.report().sewn,false);
  scope.distanceConstraint({a:0,b:4,rest:0,lambda:0,tensionOnly:true},sim.particles,1/240,0,0,sim.dofs);assert.equal(sim.dofs.join(0,4,{started:true,closureProgress:1}),true);sim._applySupports(1,4);assert.equal(sim.temporarySupports[0].active,false);
  assert.throws(()=>new Cloth({pieces:[a,b],seams:[seam]},null,{stitchJoinToleranceM:.005}),/0.1 mm/);
});

test('the optional source DOF path leaves an unstitched gravity-only material sheet equivalent',()=>{
  const pattern={pieces:[piece('a')],seams:[]},a=new Cloth(pattern,null,{stitchDofs:false,selfContact:false}),b=new Cloth(pattern,null,{stitchDofs:true,selfContact:false});a.step(5);b.step(5);
  for(let i=0;i<a.particles.length;i++)for(let k=0;k<3;k++)assert.ok(Math.abs(a.particles[i].pos[k]-b.particles[i].pos[k])<1e-10);
  assert.equal(b.report().stitchDofs.joinedStitchCount,0);assert.equal(a.report().stitchDofs.enabled,false);
});

test('rotating the original waist grip edges avoids the intermediate collapse caused by endpoint interpolation',()=>{
  const p=piece('W');p.waistSupports=[{index:0,t:0},{index:1,t:1}];const body={waistRestSectorPoint:(side,front,t)=>[-t*.1,1,0],createWaistAttachment:point=>({point}),attachmentPosition:anchor=>anchor.point,closest:()=>({signedDistance:1,distance:1}),project:()=>({signedDistance:1,distance:1})};
  const linear=new Cloth({pieces:[p],seams:[]},body,{waistSupportPath:'linear'}),rotated=new Cloth({pieces:[p],seams:[]},body,{waistSupportPath:'edge-rotation'}),distance=sim=>Math.hypot(...sim.supports[1].target.map((v,k)=>v-sim.supports[0].target[k]));
  linear._applySupports(1,1.2);rotated._applySupports(1,1.2);assert.ok(distance(linear)<1e-12);assert.ok(Math.abs(distance(rotated)-.1)<1e-12);
  rotated._applySupports(1,2.4);assert.deepEqual(plain(rotated.supports[1].target),plain(rotated.supports[1].bodyTarget));assert.deepEqual(plain(rotated.particles.map(v=>v.uv)),plain(p.materialCoordinates));
  assert.equal(rotated.events.find(e=>e.type==='waist_edge_handling_path').domain,'only_declared_original_upper_waistband_material_points');
});

test('half-turn waist grip paths use the source plane and preserve material mirror symmetry',()=>{
  const source=scope.rotateGrip([1,0,0],[-1,0,0],.5,[0,0,1]),mirrored=scope.rotateGrip([-1,0,0],[1,0,0],.5,[0,0,-1]);
  assert.ok(Math.abs(source[0]+mirrored[0])<1e-12);assert.ok(Math.abs(source[1]-mirrored[1])<1e-12);assert.ok(Math.abs(source[2]-mirrored[2])<1e-12);
  assert.throws(()=>scope.rotateGrip([1,0,0],[-1,0,0],.5),/original material plane/);
});

test('waist grip paths preserve the same material trajectory when the source edge traversal is reversed',()=>{
  const make=reversed=>{const p=piece('W');p.waistSupports=[{index:0,t:0},{index:1,t:1},{index:2,t:2}];if(reversed)p.waistSupports.reverse();const targets=[[.03,1.1,.04],[.10,1.12,.11],[.17,1.07,.06]],body={waistRestSectorPoint:(side,front,t)=>targets[t],createWaistAttachment:point=>({point}),attachmentPosition:a=>a.point,closest:()=>({signedDistance:1,distance:1}),project:()=>({signedDistance:1,distance:1})};return new Cloth({pieces:[p],seams:[]},body,{waistSupportPath:'edge-rotation'});};
  const a=make(false),b=make(true);for(const time of [.3,.9,1.2,2,2.4]){a._applySupports(1,time);b._applySupports(1,time);for(const s of a.supports){const opposite=b.supports.find(p=>p.index===s.index);for(let k=0;k<3;k++)assert.ok(Math.abs(s.target[k]-opposite.target[k])<1e-12);}}
});

test('a narrow waist attachment permits material motion inside its explicit slack ball and restrains only outside it',()=>{
  const p=piece('W');p.waistSupports=[{index:0,t:0}];const body={waistRestSectorPoint:()=>[0,1,0],createWaistAttachment:point=>({point}),attachmentPosition:a=>a.point,closest:()=>({signedDistance:1,distance:1}),project:()=>({signedDistance:1,distance:1})},sim=new Cloth({pieces:[p],seams:[]},body,{waistSupportSlackM:.004});sim._applySupports(1,2.4);
  sim.particles[0].pos[0]=.003;sim._solveSupports(1/240);assert.equal(sim.particles[0].pos[0],.003);
  sim.particles[0].pos[0]=.01;sim._solveSupports(1/240);assert.ok(sim.particles[0].pos[0]>.004&&sim.particles[0].pos[0]<.00401);assert.throws(()=>new Cloth({pieces:[p],seams:[]},body,{waistSupportSlackM:.009}),/slack/);
});

test('retained panel grips ignore other needles and follow only the actual matching waistband cloth height until closed',()=>{
  const panel=piece('leg'),band=piece('W',.05),other=piece('other',.003);panel.kind='leg-panel';panel.boundaries.waist=[0];
  const seam=(id,stage,b)=>({id,stage,a:{pieceId:'leg'},b:{pieceId:b},pairs:[{a:0,b:0,t:0}]});
  const sim=new Cloth({pieces:[panel,band,other],seams:[seam('side',0,'other'),seam('waist-leg',4,'W')]},null,{selfContact:false,gravity:0,handlingPolicy:'until-waist-stitched'});sim.seams[0].pairs[0].started=true;sim._applySupports(1,1);assert.equal(sim.temporarySupports[0].active,true);
  sim.seams[1].pairs[0].started=true;sim.particles[4].pos[1]=1.05;sim._applySupports(1,4);assert.equal(sim.temporarySupports[0].active,true);assert.equal(sim.temporarySupports[0].targetHeight,1.05);const xz=[sim.particles[0].pos[0],sim.particles[0].pos[2]];sim._solveSupports(1/240);assert.ok(sim.particles[0].pos[1]>1);assert.deepEqual([sim.particles[0].pos[0],sim.particles[0].pos[2]],xz);
  sim.particles[4].pos=sim.particles[0].pos.map((v,k)=>v+(k===2?.003:0));sim._applySupports(1,4);assert.equal(sim.temporarySupports[0].active,false);assert.equal(sim.events.find(e=>e.type==='release_original_handling_for_closed_stitch').seamId,'waist-leg');
});

test('a gated sewing stage cannot start future cloth forces until actual closure, material history, and contact pass',()=>{
  const body={closest:()=>({signedDistance:1,distance:1}),project:()=>({signedDistance:1,distance:1})},pair=(id,stage,a,b)=>({id,stage,a:{pieceId:a},b:{pieceId:b},pairs:[{a:0,b:0,t:0}]}),make=()=>new Cloth({pieces:[piece('a'),piece('b',.003),piece('c',.2),piece('d',.3)],seams:[pair('first',0,'a','b'),pair('second',1,'c','d')]},body,{sewingSchedule:'gated',gravity:0});
  const sim=make(),future=sim.particles.slice(8).map(p=>[...p.pos]);sim.step(4);for(let i=0;i<future.length;i++)for(let k=0;k<3;k++)assert.ok(Math.abs(sim.particles[8+i].pos[k]-future[i][k])<1e-12,'a waiting original seam must exert no force');sim._applySupports(1,100);assert.equal(sim.seams[1].start,Infinity);sim._advanceSewingStage(sim.report().material);assert.equal(sim.sewingStage.activeStage,0);
  sim.time=1.5;sim.seams[0].progress=1;sim.seams[0].pairs[0].started=true;sim._selfContact(false);sim._advanceSewingStage(sim.report().material);assert.equal(sim.sewingStage.activeStage,1);assert.equal(sim.seams[1].start,1.5);
  const damaged=make();damaged.seams[0].progress=1;damaged.seams[0].pairs[0].started=true;damaged.peakPrincipalStrain=.06;damaged._advanceSewingStage(damaged.report().material);assert.equal(damaged.seams[1].start,Infinity);assert.equal(damaged.sewingStage.blockedReason,'original_material_or_history_failed');
});

test('whole-triangle body discovery runs once per substep and its current failure blocks stage advancement',()=>{
  for(const interval of [0,2,3]){const sim=new Cloth({pieces:[piece('a')],seams:[]},null,{gravity:0,substeps:2,iterations:4,contactInterleaveEvery:interval}),calls=[];sim.triangleBodyContact={solve:alpha=>calls.push(['full',alpha]),projectKnown:alpha=>{calls.push(['known',alpha]);return {passed:null};},report:()=>({passed:false})};sim.step();assert.equal(calls.filter(c=>c[0]==='full').length,2);assert.equal(calls.filter(c=>c[0]==='known').length,2);assert.equal(sim.triangleBodyScanCount,2);assert.equal(sim.report().triangleBodyContact.passed,false);}
  const sim=new Cloth({pieces:[piece('a')],seams:[]},null,{gravity:0,sewingSchedule:'gated'});sim.sewingStage={enabled:true,complete:false,activeStage:0,index:0,stages:[0,1],blockedReason:null};sim.surfaceContact={report:()=>({passed:true})};sim.triangleBodyContact={report:()=>({passed:false,budgetExceeded:true})};sim._advanceSewingStage(sim.report().material);assert.equal(sim.sewingStage.blockedReason,'actual_body_triangle_contact_failed');assert.equal(sim.sewingStage.activeStage,0);
});

test('an actual metric residual after full discovery extends the same substep without resetting source histories',()=>{
  const sim=new Cloth({pieces:[piece('a')],seams:[]},null,{gravity:0,substeps:1,iterations:2,maxMaterialIterations:26,contactInterleaveEvery:1,materialConvergenceStrain:.02,selfContact:false}),before=plain(sim.particles.map(p=>p.pos)),uv=plain(sim.particles.map(p=>p.uv));let fullCalls=0;
  sim.triangleBodyContact={solve(){fullCalls++;sim.particles[2].pos[0]+=.008;},projectKnown:()=>({passed:null}),report:()=>({passed:true,maxResidualM:0})};sim.step();
  const r=sim.report();assert.equal(fullCalls,1);assert.ok(r.materialIterationStats.lastIterations>2);assert.ok(r.materialIterationStats.lastIterations<=26);assert.ok(r.material.maxAbsPrincipalStrain<.02);assert.deepEqual(plain(sim.particles.map(p=>p.previous)),before);assert.deepEqual(plain(sim.particles.map(p=>p.uv)),uv);
});
