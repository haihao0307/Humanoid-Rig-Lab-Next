'use strict';
const fs=require('fs'),vm=require('vm'),zlib=require('zlib');
const p=JSON.parse(fs.readFileSync('data/body-function-program-r17.json')),r=zlib.gunzipSync(Buffer.from(p.gzipBase64,'base64')),h=JSON.parse(r.subarray(4,4+r.readUInt32LE(0))),program=h.tree;
vm.runInThisContext(fs.readFileSync('src/BodyControlR17.js','utf8'));
let state=structuredClone(program.baselineState),commits=0,busy=false;
const control=createBodyControlR17({catalog:program.catalog,getState:()=>state,isBusy:()=>busy,commit:p=>{state=p.state;commits++;}}),description=control.describe(),checks=[];
function check(name,ok){checks.push({name,passed:!!ok});if(!ok)throw Error(name);}
function rejects(name,request){const before=JSON.stringify(state),count=commits;let error;try{control.apply(request);}catch(e){error=e.message;}check(name,!!error&&JSON.stringify(state)===before&&commits===count);}
check('all original catalog entries retained',description.catalogRetained===1916);
check('all body degrees retained',description.bodyControls===965&&new Set(description.controls.map(c=>c.id)).size===965);
const read=(o,path)=>path.reduce((v,k)=>v?.[k],o)??0;
let covered=0;
for(const c of description.controls){const rig=c.activeRig==='both'?'A':c.activeRig,value=c.kind==='boolean'?!!read(program.baselineState,c.path):read(program.baselineState,c.path),q=control.preview({rig,set:{[c.id]:value}});check('mapped body control '+c.id,q.changes.every(change=>change.id===c.id));covered++;}
const headBefore=JSON.stringify(state.gnm),start=commits,result=control.apply({set:{'shape.weight':.63,'shape.muscle':.71},label:'two shape variables'});
check('multi-value transaction commits once',commits===start+1&&result.rebuilds===1&&result.changes.length===2&&state.anny.phenotypes.weight===.63&&state.anny.phenotypes.muscle===.71);
check('head board state untouched',JSON.stringify(state.gnm)===headBefore);
const count=commits,noChange=control.apply({set:{'shape.weight':.63}});check('identical edit does not rebuild',!noChange.changed&&commits===count);
delete state.anny.pose['wrist.L'];control.apply({set:{'pose.A.wrist.L.2':25}});check('new pose vector fills unchanged axes with zero',JSON.stringify(state.anny.pose['wrist.L'])==='[0,0,25]');
rejects('invalid later value cannot partially commit',{set:{'shape.weight':.5,'shape.muscle':NaN}});
rejects('out of range edit cannot commit',{set:{'shape.weight':2}});
rejects('head edit cannot commit',{set:{'gnm.identity:0':0}});
rejects('inactive rig control cannot silently commit',{rig:'B',set:{[description.controls.find(c=>c.activeRig==='A').id]:0}});
rejects('legacy and own aliases cannot conflict',{set:{'shape.weight':.4,'anny.phenotypes:weight':.5}});
rejects('unknown operation field cannot silently disappear',{set:{'shape.weight':.4},whatever:1});
busy=true;rejects('busy operation cannot commit',{set:{'shape.weight':.4}});busy=false;
for(const pair of description.symmetricControls){const v=Math.min(pair.bounds?.[1]??1,.17),start=commits;control.apply({rig:'A',set:{[pair.id]:v}});const left=description.controls.find(c=>c.id===pair.left),right=description.controls.find(c=>c.id===pair.right);check('bilateral macro '+pair.id,read(state,left.path)===v&&read(state,right.path)===v&&commits<=start+1);}
const groups={};for(const c of description.controls)groups[c.group]=(groups[c.group]||0)+1;
const report={checkedUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),catalog:1916,body:965,mapped:covered,groups,symmetricPairs:description.symmetricControls.length,checks,description};
fs.writeFileSync('qa/body-controls-r17.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:checks.length,catalog:1916,body:965,symmetricPairs:report.symmetricPairs,groups}));
