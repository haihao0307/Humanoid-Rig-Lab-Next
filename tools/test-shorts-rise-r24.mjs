import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const files=['ShortsPattern.js','ShortsPlacementR2.js','ShortsStitchDofs.js','ShortsContinuousContact.js','ShortsSurfaceContact.js','ShortsTriangleBodyContact.js','ShortsTubeFormationR2.js','ShortsDualTubeR2.js','ShortsRiseAssemblyR2.js','ShortsCloth.js'];
const context=vm.createContext({Float32Array,Float64Array,Uint32Array,performance});
vm.runInContext(files.map(file=>fs.readFileSync(new URL('../clothing/'+file,import.meta.url),'utf8')).join('\n')+';globalThis.Pattern=createShortsPattern;globalThis.Cloth=ShortsCloth;globalThis.State=createShortsRiseStateR24;globalThis.Complete=completeShortsRiseR24;globalThis.Audit=auditShortsRiseR24;',context);
const {Pattern,Cloth,State,Complete,Audit}=context;
const measurement=()=>({unit:'m',waistFrontArc:.4492584307967932,waistBackArc:.3352942303720249,hipFrontArc:.4668110048081081,hipBackArc:.44402696750885734,waistTopFrontArc:.4405409330788456,waistTopBackArc:.3306940005131152,waistToHip:.18266596147641334,crotchDepth:.2670595803293285,frontRiseLength:.3018266978079144,backRiseLength:.37977043887366446,thighCircumference:{left:.5253428479003829,right:.5254492761974193},waistCenter:[0,.9562635,.0789258],metadata:{waistY:.9562635,waistTopY:.9842635,hipY:.7735975385,crotchY:.6892039197,thighY:.6442039197,centerZ:.0789258,bounds:{minZ:-.029,maxZ:.206},waist:{minZ:.002,maxZ:.206,centerZ:.0789258},hip:{minZ:-.029,maxZ:.186,centerZ:.0789258},thighCenters:{left:{x:-.084928284,z:.08930608},right:{x:.086256903,z:.089278874}}}});
const frame=(p,q=[0,0,0,1])=>({p:[...p],q:[...q]});
function fake(){
 const m=measurement(),source=new Map([['hips',frame([0,.8112635,.0789258])],['left_femur',frame([-.088,.8112635,.0789258])],['right_femur',frame([.088,.8112635,.0789258])],['T12',frame([0,1.10,.0789258])]]),current=new Map([...source].map(([id,value])=>[id,{p:[...value.p],q:[...value.q]}])),joints=[{id:'hips'},{id:'left_femur'},{id:'right_femur'},{id:'T12'}],human={sourceBind:source,byId:new Map([...current].map(([id,world])=>[id,{id,world}])),joints,spine:[joints[3]]};
 const body={nodes:[],update(){},measure(){return m;}};return {human,body};
}
const plain=value=>JSON.parse(JSON.stringify(value));
function build(){
 const pattern=Pattern(measurement(),{columns:3,rows:7,hipRow:2,crotchRow:4}),{human,body}=fake(),state=State(pattern,body,human),cloth=new Cloth(pattern,null,{stitchDofs:true,selfContact:false,triangleBodyContact:false,gravity:0,groundY:null,iterations:10,maxMaterialIterations:20,bendCompliance:40000,sewingSeconds:1000}),initial=Complete(cloth,state),report=Audit(cloth,state,initial);
 return {pattern,state,cloth,initial,report};
}

test('R2.4 closes only the four leg seams and the two original centre rises',()=>{
 const {report,cloth}=build(),expected=['outseam-left','inseam-left','outseam-right','inseam-right','center-front','center-back'];
 assert.equal(report.topologyGate,true);assert.deepEqual(plain(report.closedSeamIds),expected);assert.equal(report.sourceIdentityPreserved,true);assert.equal(report.totalMassPreserved,true);
 const active=new Set(expected),seams=new Map(cloth.seams.map(seam=>[seam.id,seam])),pairKey=pair=>pair.a<pair.b?pair.a+':'+pair.b:pair.b+':'+pair.a;
 for(const id of expected)assert.ok(seams.get(id).pairs.every(pair=>pair.started&&cloth.dofs.same(pair.a,pair.b)),id);
 const leftOutseamPairs=new Set(seams.get('outseam-left').pairs.map(pairKey));
 for(const seam of cloth.seams)if(!active.has(seam.id)){
  assert.ok(seam.pairs.every(pair=>!pair.started),seam.id+' started');
  const joined=seam.pairs.map((pair,index)=>cloth.dofs.same(pair.a,pair.b)?index:-1).filter(index=>index>=0);
  if(seam.id==='side-opening-left'){
   assert.equal(joined.length,1,'left opening may share only its sewn outseam junction');
   assert.ok(joined[0]===0||joined[0]===seam.pairs.length-1,'shared opening point must be an endpoint');
   assert.ok(leftOutseamPairs.has(pairKey(seam.pairs[joined[0]])),'shared opening point must be the real outseam junction');
  }else assert.deepEqual(joined,[],seam.id+' joined before its source stitch started');
 }
 assert.deepEqual(plain(report.futureSeamsStarted),[]);
});

test('centre-front and centre-back are closed on the sagittal centre with correct depth order',()=>{
 const {report}=build();assert.equal(report.centerFrontConnected,true);assert.equal(report.centerBackConnected,true);assert.equal(report.centerlineBounded,true);assert.equal(report.frontBackOrientation,true);
 assert.ok(report.centerFront.maximumGapM<=1e-4);assert.ok(report.centerBack.maximumGapM<=1e-4);assert.ok(report.centerFront.centroidLocal[2]>report.centerBack.centroidLocal[2]);
});

test('both cuffs survive as separate positive-area openings after the rise joins',()=>{
 const {report}=build();assert.equal(report.cuffsValid,true);for(const cuff of [report.cuffs.left,report.cuffs.right]){assert.ok(cuff.projectedAreaM2>1e-4);assert.ok(cuff.closureGapM<=1e-4);assert.equal(cuff.positiveArea,true);}
 assert.equal(report.expectedCrossSideDofs,true);assert.equal(report.strictUnexpectedIntersectionFree,true);
});

test('gusset and four waistbands remain at their exact staged positions',()=>{
 const pattern=Pattern(measurement(),{columns:3,rows:7,hipRow:2,crotchRow:4}),{human,body}=fake(),state=State(pattern,body,human),before=new Map([...state.positionsByPiece].map(([id,p])=>[id,JSON.stringify(p)])),cloth=new Cloth(pattern,null,{stitchDofs:true,selfContact:false,triangleBodyContact:false,gravity:0,groundY:null});
 Complete(cloth,state);
 for(const id of ['G','WFL','WFR','WBR','WBL']){const range=cloth.ranges.get(id),positions=cloth.particles.slice(range.offset,range.offset+range.count).map(p=>p.pos);assert.equal(JSON.stringify(positions),before.get(id),id);}
});

test('R2.4 remains below gusset, waistband, side closure, visual and motion acceptance',()=>{
 const {report}=build();assert.equal(report.gussetUntouched,true);assert.equal(report.waistbandsUntouched,true);assert.equal(report.sideOpeningUntouched,true);assert.equal(report.gussetConnected,false);assert.equal(report.waistbandConnected,false);assert.equal(report.sideOpeningClosed,false);assert.equal(report.assemblyValidated,false);assert.equal(report.visualAcceptance,false);assert.equal(report.motionValidated,false);assert.equal(report.productionReady,false);
});
