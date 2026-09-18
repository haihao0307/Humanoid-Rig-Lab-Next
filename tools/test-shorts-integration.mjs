import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { FixedClock } from '../motion/vendor/clock.mjs';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const fixture = () => ({ unit: 'm', waistFrontArc: .34, waistBackArc: .36,
  hipFrontArc: .44, hipBackArc: .49, waistTopFrontArc: .333, waistTopBackArc: .351,
  waistToHip: .18, crotchDepth: .255, frontRiseLength: .32, backRiseLength: .37,
  thighCircumference: { left: .54, right: .55 }, metadata: { waistY: .956 } });

const incompleteReport = () => ({ sewn:false, sewingStage:{complete:false}, engineeringCriteriaMet:false,
  material:{valid:true}, peakPrincipalStrain:0, selfContact:{sweptHistory:{budgetExceeded:false}} });

async function finishAssembly(pending, callbacks) {
  let settled=false, value, failure;
  pending.then(result=>{value=result;settled=true;},error=>{failure=error;settled=true;});
  for(let turn=0;turn<10000&&!settled;turn++){
    while(callbacks.length)callbacks.shift()();
    await Promise.resolve();
  }
  assert.equal(settled,true,'the bounded batch must settle after its queued yields');
  if(failure)throw failure;
  return value;
}

function rendererHarness({ reportFor = incompleteReport } = {}) {
  const uploads = [], callbacks = [], simulations=[];
  const gl = { ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, DYNAMIC_DRAW: 3, STATIC_DRAW: 4, FLOAT: 5,
    createVertexArray: () => ({}), createBuffer: () => ({}), bindVertexArray() {}, bindBuffer() {},
    enableVertexAttribArray() {}, vertexAttribPointer() {}, getUniformLocation: () => ({}),
    bufferData(target, array) { uploads.push({ target, array: Array.from(array) }); },
    bufferSubData() {}, deleteBuffer() {}, deleteVertexArray() {}, deleteProgram() {} };
  class Body {
    constructor() { this.updates = 0; }
    measure() { return fixture(); }
    update() { this.updates++; }
    report() { return {}; }
  }
  // Stubs isolate GL/lifecycle integration. No GPU, body simulation, cloth
  // projection or acceptance result is manufactured by this test harness.
  class Cloth {
    constructor(pattern,body,options) {
      this.pattern = pattern; this.particles = []; this.pieceRanges = []; this.steps = 0; this.stepIndex = 0;
      this.options=options;this.reportCalls=0;simulations.push(this);
      const positions = [], triangles = [], uv = [];
      for (const p of pattern.pieces) {
        const offset = uv.length / 2;
        this.pieceRanges.push({ id: p.id, offset, count: p.materialCoordinates.length, triangleOffset: triangles.length / 3, triangleCount: p.triangles.length });
        for (const point of p.materialCoordinates) {
          const pos = p.placement.origin.map((x, k) => x + p.placement.basisU[k] * point[0] + p.placement.basisV[k] * point[1]);
          positions.push(...pos); uv.push(...point); this.particles.push({ pos });
        }
        for (const tri of p.triangles) triangles.push(...tri.map(i => offset + i));
      }
      this.positions = new Float32Array(positions); this.triangles = new Uint32Array(triangles); this.materialCoordinates = new Float32Array(uv);
    }
    step(n) { this.steps += n; this.stepIndex += n; return this; }
    advance(dt) { this.advanced = (this.advanced || 0) + dt; }
    report() { this.reportCalls++;return reportFor(this); }
  }
  const mul = (a, b) => [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
  const inverse = q => [-q[0],-q[1],-q[2],q[3]];
  const c = { ShortsBody: Body, ShortsCloth: Cloth, program: () => ({ p: {}, u: {} }), LINEN_MATERIAL_FRAGMENT: '',
    add: (a,b) => a.map((x,k)=>x+b[k]), sub: (a,b) => a.map((x,k)=>x-b[k]), qm: mul, inv: inverse,
    qnorm: q => q.map(v => v / Math.hypot(...q)), rotate: (q,p) => mul(mul(q,[...p,0]),inverse(q)).slice(0,3),
    performance: { now: () => 0 }, setTimeout: fn => { callbacks.push(fn); return callbacks.length; } };
  vm.createContext(c);
  vm.runInContext(read('clothing/ShortsPattern.js') + '\n' + read('clothing/ClothShorts.js') + '\nthis.ClothShorts = ClothShorts;', c);
  const sourceHip = {p:[0,.8,0],q:[0,0,0,1]}, currentHip = {p:[2,.9,3],q:[0,Math.SQRT1_2,0,Math.SQRT1_2]};
  const boundHuman = { sourceBind: new Map([['hips',sourceHip]]), byId: new Map([['hips',{world:currentHip}]]) };
  const garment = new c.ClothShorts({ gl, visible: true, renderer: {}, statureScale: 1, boundHuman }, []);
  return { garment, gl, uploads, callbacks, sourceHip, currentHip, simulations };
}

function populationHarness() {
  const log = [], actors = new Map();
  const makeActor = (id, flags = {}) => ({ id, disposed: false, agent: { time: 0, paused: false, characterEditInProgress: false, ...flags },
    compact: { skirt: { update(dt) { log.push({ phase: 'cloth', id, dt }); } } } });
  const p = { values: () => actors.values(), tickFixed(step) {
    log.push({ phase: 'body-begin' });
    for (const a of actors.values()) if (!a.disposed && !a.agent.paused && !a.agent.characterEditInProgress) a.agent.time += step;
    log.push({ phase: 'shared-physics-end' });
  } };
  const c = { window: { parent: { location: { search: '' } } }, URLSearchParams, needsRedraw: false };
  vm.createContext(c); vm.runInContext(read('clothing/ShortsControls.js'), c);
  const lab = { population: p };
  c.installShortsControls(lab);
  return { actors, makeActor, population: p, log, lab };
}

test('population cloth advances exactly once after each authoritative shared fixed tick', () => {
  const h = populationHarness(); h.actors.set('a', h.makeActor('a'));
  for (let i = 0; i < 3; i++) h.population.tickFixed(1 / 120);
  assert.equal(h.log.filter(x => x.phase === 'cloth').length, 3);
  for (let i = 0; i < 3; i++) assert.deepEqual(h.log.slice(i * 3, i * 3 + 3).map(x => x.phase), ['body-begin', 'shared-physics-end', 'cloth']);
  for (const x of h.log.filter(x => x.phase === 'cloth')) assert.equal(x.dt, 1 / 120);
});

test('paused, disposed and shape-editing actors consume no cloth time', () => {
  const h = populationHarness();
  h.actors.set('paused', h.makeActor('paused', { paused: true }));
  h.actors.set('editing', h.makeActor('editing', { characterEditInProgress: true }));
  const disposed = h.makeActor('disposed'); disposed.disposed = true; h.actors.set('disposed', disposed);
  h.population.tickFixed(1 / 120);
  assert.equal(h.log.filter(x => x.phase === 'cloth').length, 0);
});

test('late NPC and replacement garment use current population references', () => {
  const h = populationHarness(), actor = h.makeActor('late'); h.actors.set(actor.id, actor);
  h.population.tickFixed(1 / 120);
  actor.compact = { skirt: { update(dt) { h.log.push({ phase: 'replacement-cloth', dt }); } } };
  h.population.tickFixed(1 / 120);
  assert.equal(h.log.filter(x => x.phase === 'cloth').length, 1);
  assert.equal(h.log.filter(x => x.phase === 'replacement-cloth').length, 1);
});

test('drawing index winding honors each original cloth right-side assignment without mutating solver topology', () => {
  const { garment, uploads, gl } = rendererHarness();
  const drawing = uploads.find(x => x.target === gl.ELEMENT_ARRAY_BUFFER).array;
  let offset = 0, triangleOffset = 0;
  for (const p of garment.pattern.pieces) {
    const t = p.triangles[0], expected = p.placement.rightSide === 'opposite_uv_normal' ? [t[0], t[2], t[1]] : t;
    assert.deepEqual(drawing.slice(triangleOffset * 3, triangleOffset * 3 + 3), Array.from(expected, i => offset + i), p.id + ' right-side winding');
    assert.deepEqual(Array.from(garment.simulation.triangles.slice(triangleOffset * 3, triangleOffset * 3 + 3)), Array.from(t, i => offset + i), 'solver source topology remains unchanged');
    offset += p.materialCoordinates.length; triangleOffset += p.triangles.length;
  }
});

test('disposing during the last asynchronous assembly yield cannot publish ready', async () => {
  const { garment, callbacks } = rendererHarness();
  const pending = garment.assemble(1);
  const rejected = assert.rejects(pending, /disposed/);
  garment.dispose();
  while (callbacks.length) callbacks.shift()();
  await rejected;
  assert.equal(garment.disposed, true);
  assert.equal(garment.assemblyReady, false);
});

test('assembly applies exactly one rigid world placement and concurrent calls share one task', async () => {
  const { garment, callbacks, sourceHip, currentHip, simulations } = rendererHarness();
  const source = garment.pattern.pieces.map(p => ({ id:p.id, uv:JSON.stringify(p.materialCoordinates), origin:[...p.placement.origin] }));
  const pending = garment.assemble(1), same = garment.assemble(1);
  assert.equal(pending, same);
  await finishAssembly(pending,callbacks);
  assert.equal(garment.simulation.stepIndex, 1);
  for (let i=0;i<source.length;i++) {
    const p=garment.pattern.pieces[i], before=source[i].origin, shifted=before.map((x,k)=>x-sourceHip.p[k]);
    // The test uses a known +90-degree Y rotation, independently of runtime's quaternion functions.
    const expected=[currentHip.p[0]+shifted[2], currentHip.p[1]+shifted[1], currentHip.p[2]-shifted[0]];
    assert.ok(p.placement.origin.every((x,k)=>Math.abs(x-expected[k])<1e-12));
    assert.equal(JSON.stringify(p.materialCoordinates),source[i].uv);
  }
  const placed=JSON.stringify(garment.pattern.pieces.map(p=>p.placement));
  const simulation=garment.simulation, marker={originalState:true};simulation.retainedState=marker;
  await finishAssembly(garment.assemble(2),callbacks);
  assert.equal(garment.simulation,simulation);
  assert.equal(garment.simulation.retainedState,marker);
  assert.equal(garment.simulation.stepIndex,3);
  assert.equal(simulations.length,2,'only construction and the one initial rigid placement may create solvers');
  assert.equal(garment.assemblyTask,null,'a finished budget must permit another batch');
  assert.equal(JSON.stringify(garment.pattern.pieces.map(p=>p.placement)),placed);
});

test('zero steps display actual flat pieces without publishing a wearable result',async()=>{
  const {garment,callbacks}=rendererHarness();
  const report=await finishAssembly(garment.assemble(0),callbacks);
  assert.equal(garment.displayReady,true);assert.equal(garment.assemblyReady,false);
  assert.equal(garment.assemblyState,'incomplete');assert.equal(report.assemblySteps,0);
  const simulation=garment.simulation;garment.update(1/120);
  assert.equal(simulation.advanced,undefined,'an incomplete preview cannot be put into the body motion loop');
  await finishAssembly(garment.assemble(1),callbacks);
  assert.equal(garment.simulation,simulation);assert.equal(simulation.stepIndex,1);
});

test('one immutable candidate option set survives the initial actor placement',async()=>{
  const {garment,callbacks,simulations}=rendererHarness();
  await finishAssembly(garment.assemble(0),callbacks);
  const initial=simulations[0].options,placed=simulations[1].options;
  assert.equal(placed,initial);assert.equal(Object.isFrozen(initial),true);
  for(const [key,value]of Object.entries({stitchDofs:true,needleSchedule:'sequential',sewingSchedule:'gated',
    handlingPolicy:'until-waist-stitched',triangleBodyContact:true,iterations:32,maxMaterialIterations:512,
    maxSeamTensionN:.05,stitchJoinToleranceM:.0001,waistSupportSlackM:.004}))assert.equal(placed[key],value,key);
});

test('wearable readiness requires real closed seams, completed stages and the engineering gate together',async()=>{
  for(let mask=0;mask<8;mask++){
    const {garment,callbacks}=rendererHarness({reportFor:()=>({...incompleteReport(),sewn:!!(mask&1),
      sewingStage:{complete:!!(mask&2)},engineeringCriteriaMet:!!(mask&4)})});
    await finishAssembly(garment.assemble(1),callbacks);
    assert.equal(garment.assemblyReady,mask===7,'gate combination '+mask);
    assert.equal(garment.assemblyState,mask===7?'ready':'incomplete');
    garment.update(1/120);assert.equal(garment.simulation.advanced,mask===7?1/120:undefined);
  }
});

test('bounded checks stop a failed trial and reports are not requested on every fixed step',async()=>{
  const failed=rendererHarness({reportFor:sim=>({...incompleteReport(),peakPrincipalStrain:sim.stepIndex>=30?.06:0})});
  await finishAssembly(failed.garment.assemble(100),failed.callbacks);
  assert.equal(failed.garment.simulation.stepIndex,30);assert.equal(failed.garment.assemblyState,'failed');
  assert.equal(failed.garment.displayReady,true);assert.equal(failed.garment.assemblyReady,false);
  assert.equal(failed.garment.simulation.reportCalls,2);
  const uncertain=rendererHarness({reportFor:()=>({...incompleteReport(),selfContact:{
    swept:{uncertainCount:0,unresolvedCount:0},sweptHistory:{budgetExceeded:false,uncertainCount:1}}})});
  await finishAssembly(uncertain.garment.assemble(100),uncertain.callbacks);
  assert.equal(uncertain.garment.simulation.stepIndex,30,'historical CCD uncertainty cannot be repaired by running forever');
  assert.equal(uncertain.garment.assemblyState,'failed');assert.equal(uncertain.garment.assemblyReady,false);
  assert.equal(uncertain.garment.displayReady,true,'retain the actual failed result for inspection');
  const partial=rendererHarness();await finishAssembly(partial.garment.assemble(61),partial.callbacks);
  assert.equal(partial.garment.simulation.reportCalls,3,'only step 30, 60 and the final batch report');
  assert.equal(partial.garment.assemblyState,'incomplete');
});

test('a disposed garment cannot place new material or return an old ready report',async()=>{
  for(const ready of [false,true]){
    const {garment,callbacks,simulations}=rendererHarness();
    garment.assemblyReady=ready;garment.assemblyReport={old:true};garment.dispose();
    await assert.rejects(finishAssembly(garment.assemble(0),callbacks),/disposed/);
    assert.equal(simulations.length,1);assert.equal(garment.body.updates,0);
    assert.equal(garment.displayReady,false);
  }
});

function controlsHarness(state='incomplete',single=true){
  const buttons=[{dataset:{view:'front'}},{dataset:{command:'走路'}},{dataset:{action:'pause'}},{dataset:{action:'sew'}}],status={textContent:''},events=[];
  let click,resolveBatch;
  const panel={querySelector:q=>q==='[data-status]'?status:buttons[3],querySelectorAll:()=>buttons.slice(1,3),
    addEventListener:(type,fn)=>{if(type==='click')click=fn;}};
  const garment={assemblyState:state,assemblyReady:state==='ready',assemblyReport:{state},calls:0,
    simulation:{sewingStage:{index:1,stages:[0,1,2,3,4,5]}},
    diagnostics(){throw Error('UI status must not run a full contact report');},
    assemble(){this.calls++;this.assemblyState='sewing';return new Promise(resolve=>{resolveBatch=resolve;});}};
  const c={window:{parent:{location:{search:single?'?shorts':''}}},URLSearchParams,needsRedraw:false,
    SHORTS_ASSEMBLY_STEP_LIMIT:1600,console,document:{createElement:type=>type==='section'?panel:{},head:{append(){}},body:{append(){}}}};
  vm.createContext(c);vm.runInContext(read('clothing/ShortsControls.js'),c);
  const lab={compact:{skirt:garment},renderer:{},human:{bodyMetrics:{statureScale:1},world:()=>({p:[0,.9,0]})},
    agent:{yaw:0,paused:false},settings:{close(){}},setCameraFollow(){},setAuto:value=>events.push(['auto',value]),
    render:()=>events.push(['render']),command:value=>events.push(['command',value])};
  const api=c.installShortsControls(lab);
  return {garment,buttons,status,events,lab,api,click:button=>click({target:{closest:()=>button}}),
    finish(next='incomplete'){garment.assemblyState=next;garment.assemblyReady=next==='ready';resolveBatch(garment.assemblyReport);}};
}

test('incomplete and failed studio garments reject movement even if a stale button looks enabled',()=>{
  for(const state of ['incomplete','failed','sewing']){
    const h=controlsHarness(state);
    assert.equal(h.buttons[1].disabled,true);assert.equal(h.buttons[2].disabled,true);
    h.buttons[1].disabled=false;h.buttons[2].disabled=false;h.click(h.buttons[1]);h.click(h.buttons[2]);
    assert.equal(h.events.some(e=>e[0]==='command'),false);assert.equal(h.lab.agent.paused,false);
    h.click(h.buttons[0]);assert.ok(h.events.some(e=>e[0]==='render'),'viewing actual unfinished cloth remains possible');
  }
  const ready=controlsHarness('ready');ready.click(ready.buttons[1]);
  assert.deepEqual(ready.events.find(e=>e[0]==='command'),['command','走路']);
});

test('continue sewing refreshes only light status and unlocks movement only after actual readiness',async()=>{
  const h=controlsHarness(),pending=h.api.continueSewing();
  assert.equal(h.garment.calls,1);assert.equal(h.buttons[3].disabled,true);
  assert.match(h.status.textContent,/缝制中/);assert.equal(h.buttons[1].disabled,true);
  h.finish('ready');await pending;
  assert.equal(h.buttons[1].disabled,false);assert.equal(h.buttons[3].hidden,true);
  const failed=controlsHarness('failed');await failed.api.continueSewing();assert.equal(failed.garment.calls,0);
});

test('non-studio continuation has no uninitialized panel dependency',async()=>{
  const h=controlsHarness('incomplete',false),pending=h.api.continueSewing();
  h.finish();await pending;assert.equal(h.garment.calls,1);
});

test('single actor integrates all 24 actual body ticks during a 200ms frame and rebinds new agents', () => {
  const c={};vm.createContext(c);vm.runInContext(read('clothing/ShortsControls.js'),c);
  const events=[], makeAgent=()=>({time:0,paused:false,clock:new FixedClock(),tickFixed(dt){if(!this.paused)this.time+=dt;},tick(dt){this.clock.advance(dt,step=>this.tickFixed(step),this.paused);}});
  const lab={agent:makeAgent(),human:{tissue:{update(time,dt){events.push({kind:'body',time,dt});}}},compact:{skirt:{update(dt){events.push({kind:'cloth',dt});}}}};
  c.advanceShortsSingleActor(lab,.2);
  assert.equal(events.filter(e=>e.kind==='cloth').length,24);
  assert.ok(events.filter(e=>e.kind==='cloth').every(e=>e.dt===1/120));
  for(let i=0;i<24;i++)assert.deepEqual(events.slice(i*2,i*2+2).map(e=>e.kind),['body','cloth']);
  lab.agent.paused=true;c.advanceShortsSingleActor(lab,.2);assert.equal(events.length,48);
  lab.agent=makeAgent();c.advanceShortsSingleActor(lab,1/120);assert.equal(events.length,50);
  c.advanceShortsSingleActor(lab,1/120);assert.equal(events.length,52);
});
