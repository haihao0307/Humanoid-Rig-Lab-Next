import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const context={};
vm.createContext(context);
vm.runInContext([
  fs.readFileSync(new URL('../clothing/ShortsPattern.js',import.meta.url),'utf8'),
  fs.readFileSync(new URL('../clothing/ShortsGarmentContract.js',import.meta.url),'utf8')
].join('\n'),context);
const {createShortsPattern,createShortsGarmentContract}=context;
const plain=value=>JSON.parse(JSON.stringify(value));
const fixture=()=>({unit:'m',waistFrontArc:.34,waistBackArc:.36,hipFrontArc:.44,hipBackArc:.49,
  waistTopFrontArc:.333,waistTopBackArc:.351,waistToHip:.18,crotchDepth:.255,
  frontRiseLength:.32,backRiseLength:.37,thighCircumference:{left:.54,right:.55},
  metadata:{source:'synthetic_contract_test_only',waistY:.956,centerZ:.078,bounds:{minZ:-.065,maxZ:.22}}});
const contract=()=>createShortsGarmentContract(createShortsPattern(fixture()));

test('classifies all nine original panels without inventing formed geometry',()=>{
  const c=plain(contract()),byId=new Map(c.panels.map(panel=>[panel.id,panel]));
  assert.equal(c.panels.length,9);
  assert.deepEqual(byId.get('FL'),{...byId.get('FL'),role:'leg_panel',legOwner:'left',bodySide:'front'});
  assert.equal(byId.get('BL').legOwner,'left');assert.equal(byId.get('BL').bodySide,'back');
  assert.equal(byId.get('FR').legOwner,'right');assert.equal(byId.get('BR').legOwner,'right');
  assert.equal(byId.get('G').role,'crotch_bridge');assert.equal(byId.get('G').legOwner,'bridge');
  for(const id of ['WFL','WFR','WBR','WBL'])assert.equal(byId.get(id).role,'waistband');
  assert.equal(c.invariants.sourceUVImmutable,true);assert.equal(c.invariants.formedShapeTargets,false);
  assert.equal(c.acceptance.visualAcceptance,false);assert.equal(c.acceptance.productionReady,false);
});

test('assigns every source seam once to a leg-first assembly stage',()=>{
  const c=plain(contract()),assigned=c.assemblyStages.flatMap(stage=>stage.seams);
  assert.equal(c.directedSeams.length,19);assert.equal(assigned.length,19);assert.equal(new Set(assigned).size,19);
  const ids=c.assemblyStages.map(stage=>stage.id);
  assert.ok(ids.indexOf('FORM_LEFT_LEG_TUBE')<ids.indexOf('JOIN_FRONT_RISE'));
  assert.ok(ids.indexOf('FORM_RIGHT_LEG_TUBE')<ids.indexOf('JOIN_FRONT_RISE'));
  assert.ok(ids.indexOf('JOIN_BACK_RISE')<ids.indexOf('INSERT_GUSSET'));
  assert.ok(ids.indexOf('INSERT_GUSSET')<ids.indexOf('ATTACH_WAISTBAND'));
  assert.deepEqual(c.legTubes.left.formingSeams,['outseam-left','inseam-left']);
  assert.deepEqual(c.legTubes.right.formingSeams,['outseam-right','inseam-right']);
});

test('directed stitch maps preserve endpoints, local feed and source length',()=>{
  const c=plain(contract());
  for(const seam of c.directedSeams){
    assert.equal(seam.endpointMap[0].t,0);assert.equal(seam.endpointMap[1].t,1);
    assert.equal(seam.notchMap[0].name,'start');assert.equal(seam.notchMap.at(-1).name,'end');
    assert.ok(seam.restLengthA>0);assert.ok(Math.abs(seam.restLengthA-seam.restLengthB)<1e-10);
    assert.ok(seam.segments.length>=1);assert.ok(seam.maximumLocalFeedError<1e-8);
    let previous=-Infinity;
    for(const segment of seam.segments){
      assert.ok(segment.t0>=previous);assert.ok(segment.t1>segment.t0);previous=segment.t1;
      assert.ok(Math.abs(segment.feedRatio-1)<1e-8);
    }
  }
});

test('keeps each leg tube inside its declared material ownership',()=>{
  const c=plain(contract()),panelOwner=new Map(c.panels.map(panel=>[panel.id,panel.legOwner]));
  for(const side of ['left','right'])for(const seamId of c.legTubes[side].formingSeams){
    const seam=c.directedSeams.find(item=>item.id===seamId);
    assert.equal(panelOwner.get(seam.a.panelId),side);assert.equal(panelOwner.get(seam.b.panelId),side);
  }
  for(const [id,side] of [['gusset-FL','left'],['gusset-BL','left'],['gusset-FR','right'],['gusset-BR','right']]){
    const seam=c.directedSeams.find(item=>item.id===id);
    assert.equal(panelOwner.get(seam.a.panelId),side);assert.equal(panelOwner.get(seam.b.panelId),'bridge');
  }
});

test('rejects cross-leg, reversed and incomplete seam contracts before simulation',()=>{
  let pattern=createShortsPattern(fixture());pattern.seams.find(seam=>seam.id==='inseam-left').b.pieceId='BR';
  assert.throws(()=>createShortsGarmentContract(pattern),/cross-leg|mislabelled/);
  pattern=createShortsPattern(fixture());pattern.seams.find(seam=>seam.id==='center-front').pairs.reverse();
  assert.throws(()=>createShortsGarmentContract(pattern),/non-monotone/);
  pattern=createShortsPattern(fixture());pattern.seams=pattern.seams.filter(seam=>seam.id!=='outseam-right');
  assert.throws(()=>createShortsGarmentContract(pattern),/exactly the 19/);
  pattern=createShortsPattern(fixture());pattern.pieces.find(piece=>piece.id==='FL').side='right';
  assert.throws(()=>createShortsGarmentContract(pattern),/contradictory leg ownership/);
});

test('contract construction is deterministic and does not mutate the original pattern',()=>{
  const pattern=createShortsPattern(fixture()),before=JSON.stringify(pattern),a=plain(createShortsGarmentContract(pattern)),b=plain(createShortsGarmentContract(pattern));
  assert.equal(JSON.stringify(pattern),before);assert.deepEqual(a,b);
});

test('records the required final topology but does not promote source checks to fit acceptance',()=>{
  const c=plain(contract());
  assert.deepEqual(c.finalTopology,{waistLoops:1,legOpeningLoops:2,boundaryLoops:3,eulerCharacteristic:-1,nonManifoldEdges:0});
  assert.equal(c.acceptance.sourceContract,true);assert.equal(c.acceptance.bodyFitValidated,false);
  assert.equal(c.acceptance.assemblyValidated,false);assert.equal(c.acceptance.motionValidated,false);
});
