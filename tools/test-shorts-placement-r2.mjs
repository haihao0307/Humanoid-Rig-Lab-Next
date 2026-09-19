import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const context={};vm.createContext(context);
vm.runInContext([
  fs.readFileSync(new URL('../clothing/ShortsPattern.js',import.meta.url),'utf8'),
  fs.readFileSync(new URL('../clothing/ShortsPlacementR2.js',import.meta.url),'utf8')
].join('\n'),context);
const {createShortsPattern,applyShortsRigidPlacementR2}=context;
const measurement=()=>({unit:'m',waistFrontArc:.34,waistBackArc:.36,hipFrontArc:.44,hipBackArc:.49,waistTopFrontArc:.333,waistTopBackArc:.351,
  waistToHip:.18,crotchDepth:.255,frontRiseLength:.32,backRiseLength:.37,thighCircumference:{left:.54,right:.55},waistCenter:[0,.956,.079],
  metadata:{waistY:.956,waistTopY:.984,hipY:.83,crotchY:.701,thighY:.656,centerZ:.079,bounds:{minZ:-.08,maxZ:.24},
    waist:{minZ:-.05,maxZ:.20,centerZ:.079},hip:{minZ:-.08,maxZ:.24,centerZ:.079},thighCenters:{left:{x:-.087,z:.08},right:{x:.087,z:.08}}}});
const frame=(p,q=[0,0,0,1])=>({p:[...p],q:[...q]});
function fake(){
  const source=new Map([['hips',frame([0,.811,.079])],['left_femur',frame([-.088,.811,.079])],['right_femur',frame([.088,.811,.079])],['T12',frame([0,1.10,.079])]]);
  const angle=.62,q=[0,Math.sin(angle/2),0,Math.cos(angle/2)],rot=p=>{const v=[q[0],q[1],q[2]],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],add=(a,b)=>a.map((x,i)=>x+b[i]),mul=(a,s)=>a.map(x=>x*s),t=mul(cross(v,p),2);return add(p,add(mul(t,q[3]),cross(v,t)));},origin=[2,.2,-3],map=p=>add(origin,rot(p));
  function add(a,b){return a.map((x,i)=>x+b[i]);}
  const current=new Map([...source].map(([id,value])=>[id,{p:map(value.p),q}]));
  const joints=[{id:'hips'},{id:'left_femur'},{id:'right_femur'},{id:'T12'}],human={sourceBind:source,byId:new Map([...current].map(([id,world])=>[id,{id,world}])),joints,spine:[joints[3]]};
  const body={nodes:[{current:map([-.10,.72,.08]),rest:[-.10,.72,.08],influences:[[1,1]]},{current:map([.10,.72,.08]),rest:[.10,.72,.08],influences:[[2,1]]},{current:map([0,.82,.15]),rest:[0,.82,.15],influences:[[0,1]]},{current:map([0,.82,0]),rest:[0,.82,0],influences:[[0,1]]}],update(){},measure(){return measurement();}};
  return {human,body};
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('R2.2 rigid placement preserves all source material data and is deterministic',()=>{
  const pattern=createShortsPattern(measurement()),before=JSON.stringify(pattern.pieces.map(p=>({uv:p.materialCoordinates,triangles:p.triangles,boundaries:p.boundaries}))),{human,body}=fake();
  const report=applyShortsRigidPlacementR2(pattern,body,human),again=applyShortsRigidPlacementR2(pattern,body,human);
  assert.equal(report,again);assert.equal(report.valid,true);assert.equal(report.sourceUnchanged,true);
  assert.equal(JSON.stringify(pattern.pieces.map(p=>({uv:p.materialCoordinates,triangles:p.triangles,boundaries:p.boundaries}))),before);
  assert.equal(report.sewingActivated,false);assert.equal(report.visualAcceptance,false);
});
test('main panels and waist sectors keep correct left/right and front/back ownership',()=>{
  const pattern=createShortsPattern(measurement()),{human,body}=fake(),report=plain(applyShortsRigidPlacementR2(pattern,body,human)),byId=new Map(report.pieces.map(piece=>[piece.id,piece]));
  for(const id of ['FL','BL','WFL','WBL'])assert.ok(byId.get(id).centroid[0]<0,id);
  for(const id of ['FR','BR','WFR','WBR'])assert.ok(byId.get(id).centroid[0]>0,id);
  for(const id of ['FL','FR','WFL','WFR'])assert.ok(byId.get(id).centroid[2]>0,id);
  for(const id of ['BL','BR','WBL','WBR'])assert.ok(byId.get(id).centroid[2]<0,id);
  assert.ok(report.pieces.every(piece=>piece.ownershipCorrect));
});
test('gusset is a horizontal bridge with four correctly ordered material notches',()=>{
  const pattern=createShortsPattern(measurement()),{human,body}=fake(),report=plain(applyShortsRigidPlacementR2(pattern,body,human)),g=pattern.pieces.find(piece=>piece.id==='G');
  assert.equal(report.gussetOrderCorrect,true);assert.ok(report.gussetLandmarks.left[0]<0);assert.ok(report.gussetLandmarks.right[0]>0);
  assert.ok(report.gussetLandmarks.front[2]>0);assert.ok(report.gussetLandmarks.back[2]<0);
  const normal=[g.placement.basisU[1]*g.placement.basisV[2]-g.placement.basisU[2]*g.placement.basisV[1],g.placement.basisU[2]*g.placement.basisV[0]-g.placement.basisU[0]*g.placement.basisV[2],g.placement.basisU[0]*g.placement.basisV[1]-g.placement.basisU[1]*g.placement.basisV[0]];
  assert.ok(normal[1]>.5);assert.equal(g.placement.method,'r2.2_horizontal_crotch_bridge_review_workspace');
});
test('pelvis frame follows translated and rotated final pose rather than world axes',()=>{
  const pattern=createShortsPattern(measurement()),{human,body}=fake(),report=plain(applyShortsRigidPlacementR2(pattern,body,human)),f=report.bodyFrame.current;
  const expected=human.byId.get('hips').world.p;for(let i=0;i<3;i++)assert.ok(Math.abs(f.origin[i]-expected[i])<1e-8);
  assert.ok(Math.abs(f.right[2])>.4);assert.ok(Math.abs(f.forward[0])>.4);
  assert.ok(Math.abs(f.right.reduce((s,v,i)=>s+v*f.up[i],0))<1e-8);
});
test('rejects a collapsed hip axis before any paper mutation',()=>{
  const pattern=createShortsPattern(measurement()),{human,body}=fake();human.byId.get('right_femur').world.p=[...human.byId.get('left_femur').world.p];
  const before=JSON.stringify(pattern);assert.throws(()=>applyShortsRigidPlacementR2(pattern,body,human),/degenerate body frame axis/);assert.equal(JSON.stringify(pattern),before);
});
