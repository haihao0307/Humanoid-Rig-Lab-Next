import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const files=['ShortsPattern.js','ShortsPlacementR2.js','ShortsStitchDofs.js','ShortsContinuousContact.js','ShortsSurfaceContact.js','ShortsTriangleBodyContact.js','ShortsTubeFormationR2.js','ShortsDualTubeR2.js','ShortsCloth.js'];
const context=vm.createContext({Float32Array,Float64Array,Uint32Array,performance});
vm.runInContext(files.map(file=>fs.readFileSync(new URL('../clothing/'+file,import.meta.url),'utf8')).join('\n')+';globalThis.Pattern=createShortsPattern;globalThis.Cloth=ShortsCloth;globalThis.State=createShortsDualTubeStateR23;globalThis.Complete=completeShortsDualTubeR23;globalThis.Audit=auditShortsDualTubeR23;',context);
const {Pattern,Cloth,State,Complete,Audit}=context;
const measurement=()=>({unit:'m',waistFrontArc:.4492584307967932,waistBackArc:.3352942303720249,hipFrontArc:.4668110048081081,hipBackArc:.44402696750885734,waistTopFrontArc:.4405409330788456,waistTopBackArc:.3306940005131152,waistToHip:.18266596147641334,crotchDepth:.2670595803293285,frontRiseLength:.3018266978079144,backRiseLength:.37977043887366446,thighCircumference:{left:.5253428479003829,right:.5254492761974193},waistCenter:[0,.9562635,.0789258],metadata:{waistY:.9562635,waistTopY:.9842635,hipY:.7735975385,crotchY:.6892039197,thighY:.6442039197,centerZ:.0789258,bounds:{minZ:-.029,maxZ:.206},waist:{minZ:.002,maxZ:.206,centerZ:.0789258},hip:{minZ:-.029,maxZ:.186,centerZ:.0789258},thighCenters:{left:{x:-.084928284,z:.08930608},right:{x:.086256903,z:.089278874}}}});
const frame=(p,q=[0,0,0,1])=>({p:[...p],q:[...q]});
function fake(){
 const m=measurement(),source=new Map([['hips',frame([0,.8112635,.0789258])],['left_femur',frame([-.088,.8112635,.0789258])],['right_femur',frame([.088,.8112635,.0789258])],['T12',frame([0,1.10,.0789258])]]),current=new Map([...source].map(([id,value])=>[id,{p:[...value.p],q:[...value.q]}])),joints=[{id:'hips'},{id:'left_femur'},{id:'right_femur'},{id:'T12'}],human={sourceBind:source,byId:new Map([...current].map(([id,world])=>[id,{id,world}])),joints,spine:[joints[3]]};
 const body={nodes:[],update(){},measure(){return m;}};return {human,body};
}
const plain=value=>JSON.parse(JSON.stringify(value));
function build({relax=24}={}){
 const pattern=Pattern(measurement(),{columns:3,rows:7,hipRow:2,crotchRow:4}),{human,body}=fake(),state=State(pattern,body,human),cloth=new Cloth(pattern,null,{stitchDofs:true,selfContact:false,triangleBodyContact:false,gravity:0,groundY:null,iterations:10,maxMaterialIterations:20,bendCompliance:40000,sewingSeconds:1000}),initial=Complete(cloth,state);
 for(const support of cloth.temporarySupports)support.active=false;
 let report=initial;
 for(let i=0;i<relax;i++){cloth.step(1);report=Audit(cloth,state,initial);if(i>=2&&report.valid)break;}
 return {pattern,state,cloth,initial,report};
}

test('R2.3b forms left and right tubes from the four original main panels only',()=>{
 const {report,cloth}=build();
 assert.equal(report.valid,true);assert.equal(report.dualTubeGate,true);assert.equal(report.leftTubeFormed,true);assert.equal(report.rightTubeFormed,true);
 assert.deepEqual(plain(report.closedSeamIds),['outseam-left','inseam-left','outseam-right','inseam-right']);
 assert.equal(report.sourceIdentityPreserved,true);assert.equal(report.totalMassPreserved,true);assert.equal(report.otherSeamsStarted,false);
 const active=new Set(report.closedSeamIds),seams=new Map(cloth.seams.map(seam=>[seam.id,seam]));
 for(const id of active)assert.ok(seams.get(id).pairs.every(pair=>cloth.dofs.same(pair.a,pair.b)),id);
 for(const seam of cloth.seams)if(!active.has(seam.id))assert.ok(seam.pairs.every(pair=>!pair.started),seam.id);
});

test('both cuffs are independent closed positive-area loops on the correct body sides',()=>{
 const {report}=build();const {left,right}=report.cuffs;
 for(const cuff of [left,right]){assert.ok(cuff.projectedAreaM2>1e-4);assert.ok(cuff.closureGapM<=1e-4);assert.equal(cuff.positiveArea,true);}
 assert.ok(left.centroidLocal[0]<0);assert.ok(right.centroidLocal[0]>0);assert.ok(right.centroidLocal[0]-left.centroidLocal[0]>.08);
 assert.equal(report.leftRightOwnership,true);assert.equal(report.independentLegDofs,true);
});

test('dual-tube gate detects no strict cross-leg triangle intersection',()=>{
 const {report}=build();assert.equal(report.strictCrossTubeIntersectionFree,true);assert.equal(report.strictCrossTube.detected,0);assert.ok(report.strictCrossTube.checkedCandidatePairs>=0);
});

test('gusset and waistbands remain at exact R2.2 rigid positions',()=>{
 const pattern=Pattern(measurement(),{columns:3,rows:7,hipRow:2,crotchRow:4}),{human,body}=fake(),state=State(pattern,body,human),before=new Map([...state.positionsByPiece].map(([id,p])=>[id,JSON.stringify(p)])),cloth=new Cloth(pattern,null,{stitchDofs:true,selfContact:false,triangleBodyContact:false,gravity:0,groundY:null});
 Complete(cloth,state);
 for(const id of ['G','WFL','WFR','WBR','WBL']){const range=cloth.ranges.get(id),positions=cloth.particles.slice(range.offset,range.offset+range.count).map(p=>p.pos);assert.equal(JSON.stringify(positions),before.get(id),id);}
});

test('R2.3b remains explicitly below rise, gusset, waistband and motion acceptance',()=>{
 const {report}=build();assert.equal(report.gussetUntouched,true);assert.equal(report.waistbandsUntouched,true);assert.equal(report.sideOpeningUntouched,true);assert.equal(report.assemblyValidated,false);assert.equal(report.visualAcceptance,false);assert.equal(report.motionValidated,false);assert.equal(report.productionReady,false);
});
