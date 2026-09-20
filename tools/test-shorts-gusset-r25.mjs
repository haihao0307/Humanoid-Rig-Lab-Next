import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const files=['ShortsPattern.js','ShortsPlacementR2.js','ShortsStitchDofs.js','ShortsContinuousContact.js','ShortsSurfaceContact.js','ShortsTriangleBodyContact.js','ShortsTubeFormationR2.js','ShortsDualTubeR2.js','ShortsRiseAssemblyR2.js','ShortsGussetAssemblyR2.js','ShortsCloth.js'];
const context=vm.createContext({Float32Array,Float64Array,Uint32Array,performance});
vm.runInContext(files.map(file=>fs.readFileSync(new URL('../clothing/'+file,import.meta.url),'utf8')).join('\n')+';globalThis.Pattern=createShortsPattern;globalThis.Cloth=ShortsCloth;globalThis.State=createShortsGussetStateR25;globalThis.Complete=completeShortsGussetR25;globalThis.Audit=auditShortsGussetR25;',context);
const {Pattern,Cloth,State,Complete,Audit}=context;
const measurement=()=>({unit:'m',waistFrontArc:.4492584307967932,waistBackArc:.3352942303720249,hipFrontArc:.4668110048081081,hipBackArc:.44402696750885734,waistTopFrontArc:.4405409330788456,waistTopBackArc:.3306940005131152,waistToHip:.18266596147641334,crotchDepth:.2670595803293285,frontRiseLength:.3018266978079144,backRiseLength:.37977043887366446,thighCircumference:{left:.5253428479003829,right:.5254492761974193},waistCenter:[0,.9562635,.0789258],metadata:{waistY:.9562635,waistTopY:.9842635,hipY:.7735975385,crotchY:.6892039197,thighY:.6442039197,centerZ:.0789258,bounds:{minZ:-.029,maxZ:.206},waist:{minZ:.002,maxZ:.206,centerZ:.0789258},hip:{minZ:-.029,maxZ:.186,centerZ:.0789258},thighCenters:{left:{x:-.084928284,z:.08930608},right:{x:.086256903,z:.089278874}}}});
const frame=(p,q=[0,0,0,1])=>({p:[...p],q:[...q]});
function fake(){
 const m=measurement(),source=new Map([['hips',frame([0,.8112635,.0789258])],['left_femur',frame([-.088,.8112635,.0789258])],['right_femur',frame([.088,.8112635,.0789258])],['T12',frame([0,1.10,.0789258])]]),current=new Map([...source].map(([id,value])=>[id,{p:[...value.p],q:[...value.q]}])),joints=[{id:'hips'},{id:'left_femur'},{id:'right_femur'},{id:'T12'}],human={sourceBind:source,byId:new Map([...current].map(([id,world])=>[id,{id,world}])),joints,spine:[joints[3]]};
 const body={nodes:[],update(){},measure(){return m;}};return {human,body};
}
const plain=value=>JSON.parse(JSON.stringify(value));
function build(){
 const pattern=Pattern(measurement(),{columns:3,rows:7,hipRow:2,crotchRow:4}),{human,body}=fake(),state=State(pattern,body,human),cloth=new Cloth(pattern,null,{stitchDofs:true,selfContact:false,triangleBodyContact:false,gravity:0,groundY:null,iterations:12,maxMaterialIterations:32,bendCompliance:40000,sewingSeconds:1000}),initial=Complete(cloth,state),report=Audit(cloth,state,initial);
 return {pattern,state,cloth,initial,report};
}

test('R2.5 closes the four real gusset seams after the six prior seams only',()=>{
 const {report,cloth}=build(),expected=['outseam-left','inseam-left','outseam-right','inseam-right','center-front','center-back','gusset-FL','gusset-FR','gusset-BL','gusset-BR'];
 assert.deepEqual(plain(report.closedSeamIds),expected);assert.equal(report.gussetSeamsClosed,true);assert.equal(report.centerRisesRemainClosed,true);
 const closed=new Set(expected);for(const seam of cloth.seams)if(closed.has(seam.id))assert.ok(seam.pairs.every(pair=>pair.started&&cloth.dofs.same(pair.a,pair.b)),seam.id);else assert.ok(seam.pairs.every(pair=>!pair.started),seam.id);
 assert.equal(report.futureSeamsStarted.length,0);
});

test('all eight original gusset boundary points use directed source seam targets',()=>{
 const {state}=build(),g=state.positionsByPiece.get('G'),patternState=state.report;
 assert.equal(g.length,9);assert.equal(patternState.junctionReports.length,8);
 for(const item of patternState.junctionReports){assert.ok(item.contributorCount===1||item.contributorCount===2);assert.ok(item.maximumContributorGapM<=1e-8);}
 for(const seam of patternState.stagedSeams)assert.ok(seam.maximumGapM<=1e-10,seam.id);
});

test('four original three-way gusset junctions close transitively without an extra weld',()=>{
 const {report}=build();assert.equal(report.junctionsValid,true);assert.equal(report.junctions.length,4);
 for(const junction of report.junctions){assert.equal(junction.memberCount,3);assert.equal(junction.allMembersJoined,true);assert.equal(junction.extraWeld,false);}
 assert.ok(report.expectedJoinedStitchCount<report.declaredClosedStitchPairCount);assert.equal(report.joinedStitchCount,report.expectedJoinedStitchCount);
});

test('the installed gusset preserves front back left right order and positive oriented triangles',()=>{
 const {report}=build(),g=report.gussetGeometry;
 assert.equal(g.landmarkOrderValid,true);assert.equal(g.flippedTriangleCount,0);assert.ok(g.orientationDotUp>.15);assert.ok(g.surfaceAreaM2>1e-4);assert.ok(g.minimumTriangleAreaM2>1e-8);
 assert.ok(g.landmarks.front[2]>g.landmarks.back[2]);assert.ok(g.landmarks.right[0]>g.landmarks.left[0]);
});

test('two independent positive-area cuffs survive gusset installation',()=>{
 const {report}=build();assert.equal(report.cuffsValid,true);for(const cuff of [report.cuffs.left,report.cuffs.right]){assert.ok(cuff.projectedAreaM2>1e-4);assert.ok(cuff.closureGapM<=1e-4);assert.equal(cuff.positiveArea,true);}
});

test('source material identity and mass stay fixed while waistbands and left opening remain untouched',()=>{
 const {report}=build();assert.equal(report.sourceIdentityPreserved,true);assert.equal(report.totalMassPreserved,true);assert.equal(report.expectedClosedDofs,true);assert.equal(report.waistbandsUntouched,true);assert.equal(report.sideOpeningUntouched,true);assert.equal(report.gussetConnected,true);assert.equal(report.waistbandConnected,false);assert.equal(report.sideOpeningClosed,false);assert.equal(report.assemblyValidated,false);assert.equal(report.visualAcceptance,false);assert.equal(report.motionValidated,false);assert.equal(report.productionReady,false);
});
