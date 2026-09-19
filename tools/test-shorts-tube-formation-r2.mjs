import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const files=['ShortsPattern.js','ShortsPlacementR2.js','ShortsStitchDofs.js','ShortsContinuousContact.js','ShortsSurfaceContact.js','ShortsTriangleBodyContact.js','ShortsTubeFormationR2.js','ShortsCloth.js'];
const context=vm.createContext({Float32Array,Float64Array,Uint32Array,performance});
vm.runInContext(files.map(file=>fs.readFileSync(new URL('../clothing/'+file,import.meta.url),'utf8')).join('\n')+';globalThis.Pattern=createShortsPattern;globalThis.Cloth=ShortsCloth;globalThis.State=createShortsLeftTubeStateR23;globalThis.Complete=completeShortsLeftTubeR23;globalThis.Audit=auditShortsLeftTubeR23;',context);
const {Pattern,Cloth,State,Complete,Audit}=context;
const measurement=()=>({unit:'m',waistFrontArc:.4492584307967932,waistBackArc:.3352942303720249,hipFrontArc:.4668110048081081,hipBackArc:.44402696750885734,waistTopFrontArc:.4405409330788456,waistTopBackArc:.3306940005131152,waistToHip:.18266596147641334,crotchDepth:.2670595803293285,frontRiseLength:.3018266978079144,backRiseLength:.37977043887366446,thighCircumference:{left:.5253428479003829,right:.5254492761974193},waistCenter:[0,.9562635,.0789258],metadata:{waistY:.9562635,waistTopY:.9842635,hipY:.7735975385,crotchY:.6892039197,thighY:.6442039197,centerZ:.0789258,bounds:{minZ:-.029,maxZ:.206},waist:{minZ:.002,maxZ:.206,centerZ:.0789258},hip:{minZ:-.029,maxZ:.186,centerZ:.0789258},thighCenters:{left:{x:-.084928284,z:.08930608},right:{x:.086256903,z:.089278874}}}});
const frame=(p,q=[0,0,0,1])=>({p:[...p],q:[...q]});
function fake(){
 const m=measurement(),source=new Map([['hips',frame([0,.8112635,.0789258])],['left_femur',frame([-.088,.8112635,.0789258])],['right_femur',frame([.088,.8112635,.0789258])],['T12',frame([0,1.10,.0789258])]]),current=new Map([...source].map(([id,value])=>[id,{p:[...value.p],q:[...value.q]}])),joints=[{id:'hips'},{id:'left_femur'},{id:'right_femur'},{id:'T12'}],human={sourceBind:source,byId:new Map([...current].map(([id,world])=>[id,{id,world}])),joints,spine:[joints[3]]};
 const body={nodes:[],update(){},measure(){return m;}};return {human,body};
}
const plain=value=>JSON.parse(JSON.stringify(value));
function build({relax=0}={}){const pattern=Pattern(measurement(),{columns:3,rows:7,hipRow:2,crotchRow:4}),{human,body}=fake(),state=State(pattern,body,human),cloth=new Cloth(pattern,null,{stitchDofs:true,selfContact:false,triangleBodyContact:false,gravity:0,groundY:null,iterations:8,maxMaterialIterations:16,bendCompliance:40000,sewingSeconds:1000}),initial=Complete(cloth,state);for(const support of cloth.temporarySupports)support.active=false;for(let i=0;i<relax;i++)cloth.step(1);return {pattern,state,cloth,initial,report:relax?Audit(cloth,state,initial):initial};}

test('R2.3 forms one left tube from only FL and BL and keeps all source material identity',()=>{
 const {report,cloth,initial}=build({relax:4});assert.equal(initial.valid,false);assert.equal(report.valid,true);assert.equal(report.leftTubeFormed,true);assert.equal(report.sourceIdentityPreserved,true);assert.equal(report.totalMassPreserved,true);assert.deepEqual(plain(report.closedSeamIds),['outseam-left','inseam-left']);assert.equal(report.otherSeamsStarted,false);
 const left=new Set(report.closedSeamIds),seams=new Map(cloth.seams.map(seam=>[seam.id,seam]));for(const id of left)assert.ok(seams.get(id).pairs.every(pair=>cloth.dofs.same(pair.a,pair.b)));
 for(const seam of cloth.seams)if(!left.has(seam.id))assert.ok(seam.pairs.every(pair=>!pair.started),seam.id);
 const side=seams.get('side-opening-left');assert.ok(side.pairs.slice(0,-1).every(pair=>!cloth.dofs.same(pair.a,pair.b)));assert.ok(cloth.dofs.same(side.pairs.at(-1).a,side.pairs.at(-1).b));
});

test('left cuff is a closed positive-area loop and not a flat pair of panels',()=>{
 const {report}=build({relax:4});assert.ok(report.cuff.projectedAreaM2>1e-4);assert.ok(report.cuff.closureGapM<=1e-4);assert.equal(report.cuff.positiveArea,true);
 const lower=report.rowReports.at(-1);assert.equal(lower.innerOpeningM,0);assert.equal(lower.outerOpeningM,0);assert.ok(lower.radiusM>.08&&lower.radiusM<.12);
});

test('upper side and rise openings remain open until later source stages',()=>{
 const {report}=build(),top=report.rowReports[0],outerJoin=report.rowReports[report.outerStartRow],innerJoin=report.rowReports[report.innerStartRow];assert.ok(top.outerOpeningM>0);assert.ok(top.innerOpeningM>0);assert.equal(outerJoin.outerOpeningM,0);assert.equal(innerJoin.innerOpeningM,0);
});

test('right panels, gusset and waistbands remain at the exact R2.2 rigid positions',()=>{
 const pattern=Pattern(measurement(),{columns:3,rows:7,hipRow:2,crotchRow:4}),{human,body}=fake(),state=State(pattern,body,human),before=new Map([...state.positionsByPiece].map(([id,p])=>[id,JSON.stringify(p)])),cloth=new Cloth(pattern,null,{stitchDofs:true,selfContact:false,triangleBodyContact:false,gravity:0,groundY:null});Complete(cloth,state);
 for(const id of ['FR','BR','G','WFL','WFR','WBR','WBL']){const range=cloth.ranges.get(id),positions=cloth.particles.slice(range.offset,range.offset+range.count).map(p=>p.pos);assert.equal(JSON.stringify(positions),before.get(id),id);}
});

test('checkpoint is explicitly not a whole garment, fit or motion acceptance',()=>{
 const {report}=build();assert.equal(report.assemblyValidated,false);assert.equal(report.visualAcceptance,false);assert.equal(report.motionValidated,false);assert.equal(report.productionReady,false);assert.equal(report.bodyContactValidated,false);assert.equal(report.selfContactValidated,false);
});
