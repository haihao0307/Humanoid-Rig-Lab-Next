// File-content inspection only. No motion module or application is evaluated.
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

function lexicalReferences(tree,globals,assert){
 const make=(parent,kind)=>({parent,kind,names:new Set()}),root=make(null,'function'),refs=[];
 const variableScope=s=>s.kind==='function'?s:variableScope(s.parent);
 function binding(n,s){
  if(!n)return;
  if(n.type==='Identifier')s.names.add(n.name);
  else if(n.type==='RestElement')binding(n.argument,s);
  else if(n.type==='AssignmentPattern'){binding(n.left,s);visit(n.right,s);}
  else if(n.type==='ArrayPattern')n.elements.forEach(v=>binding(v,s));
  else if(n.type==='ObjectPattern')for(const p of n.properties){if(p.computed)visit(p.key,s);binding(p.type==='RestElement'?p.argument:p.value,s);}
 }
 function visit(n,s){
  if(!n||typeof n!=='object')return;
  if(Array.isArray(n)){n.forEach(v=>visit(v,s));return;}
  switch(n.type){
   case 'Program':visit(n.body,s);return;
   case 'Identifier':refs.push({name:n.name,scope:s,line:n.loc.start.line});return;
   case 'VariableDeclaration':for(const d of n.declarations){binding(d.id,n.kind==='var'?variableScope(s):s);visit(d.init,s);}return;
   case 'FunctionDeclaration':case 'FunctionExpression':case 'ArrowFunctionExpression':{
    if(n.type==='FunctionDeclaration')binding(n.id,s);
    const fn=make(s,'function');binding(n.id,fn);if(n.type!=='ArrowFunctionExpression')fn.names.add('arguments');
    n.params.forEach(p=>binding(p,fn));visit(n.body,fn);return;
   }
   case 'BlockStatement':visit(n.body,make(s,'block'));return;
   case 'StaticBlock':visit(n.body,make(s,'function'));return;
   case 'ClassDeclaration':case 'ClassExpression':{
    if(n.type==='ClassDeclaration')binding(n.id,s);
    const cls=make(s,'class');binding(n.id,cls);visit(n.superClass,cls);visit(n.body,cls);return;
   }
   case 'ForStatement':{const loop=make(s,'block');for(const key of ['init','test','update','body'])visit(n[key],loop);return;}
   case 'ForInStatement':case 'ForOfStatement':{const loop=make(s,'block');for(const key of ['left','right','body'])visit(n[key],loop);return;}
   case 'CatchClause':{const block=make(s,'block');binding(n.param,block);visit(n.body,block);return;}
   case 'MemberExpression':visit(n.object,s);if(n.computed)visit(n.property,s);return;
   case 'Property':case 'MethodDefinition':case 'PropertyDefinition':if(n.computed)visit(n.key,s);visit(n.value,s);return;
   case 'ImportDeclaration':n.specifiers.forEach(x=>binding(x.local,s));return;
   case 'ExportSpecifier':visit(n.local,s);return;
   case 'LabeledStatement':visit(n.body,s);return;
   case 'BreakStatement':case 'ContinueStatement':case 'MetaProperty':return;
  }
  for(const [key,value]of Object.entries(n))if(!['type','start','end','loc'].includes(key))visit(value,s);
 }
 visit(tree,root);
 const resolves=(name,s)=>s?(s.names.has(name)||resolves(name,s.parent)):globals.has(name);
 const missing=refs.filter(r=>!resolves(r.name,r.scope)).map(({name,line})=>({name,line}));
 assert(!missing.length,'Lexically unresolved runtime names: '+JSON.stringify(missing));
 return refs.length;
}

export function checkMotionLabIntegration({root,parse,read,runtime,globals,assert}){
 let checks=0;const check=(ok,message)=>{assert(ok,'Motion-Lab integration: '+message);checks++;};
 const sha=value=>createHash('sha256').update(value).digest('hex'),lock=JSON.parse(read('motion/source-lock.json'));
 const expected=['math','world','rig','clock','walk-data','full-body','controller','camp-routines'];
 check(lock.revision==='R2.2'&&lock.files.length===expected.length,'pinned R2.2 module inventory');
 let originalFilesCompared=0;
 for(const name of expected){
  const path='motion/vendor/'+name+'.mjs',entry=lock.files.find(f=>f.path===path);
  check(!!entry&&sha(read(path))===entry.sha256,'vendor hash: '+name);
  const original=join(root,'..',entry.source);
  if(existsSync(original)){check(sha(readFileSync(original))===entry.sha256,'independent lab source unchanged: '+name);originalFilesCompared++;}
  parse(read(path),{ecmaVersion:'latest',sourceType:'module'});
 }
 check(sha(read('reconstruction/rig-reference.json'))===lock.rigSHA256,'adapter uses the pinned source skeleton');
 const originalRig=join(root,'..','Human-Motion-Lab','data','rig-reference.json');
 if(existsSync(originalRig))check(sha(readFileSync(originalRig))===lock.rigSHA256,'independent lab uses the same skeleton');
 const runTree=parse(runtime,{ecmaVersion:'latest',sourceType:'module',locations:true});
 const referenceCount=lexicalReferences(runTree,globals,assert);checks++;
 const source=runtime,pose=read('body/MotionLabPose.js'),gait=read('body/NaturalLocomotion.js'),actions=read('body/MotionLabActions.js');
 check(!/HumanJointConstraintSystem|solveLimb\(|class NaturalGait/.test(runtime),'old joint and gait solvers are absent');
 check(/return this\.motionDriver\.apply\(options\)/.test(source),'Human.pose delegates to the new adapter');
 check(/this\.h\.pose\(\);this\.basic=new BasicController/.test(source)&&/new MotionLab\.MotionController/.test(gait),'initial pose comes from the tuned lab');
 check(/new MotionLab\.FixedClock/.test(source)&&/this\.clock\.advance\(dt,step=>this\.tickFixed\(step\),this\.paused\)/.test(source),'one fixed body clock');
 check(/const dt=Math\.max\(0,\(now-previous\)\/1000\)/.test(source)&&!/Math\.min\(\.1,\(now-previous\)/.test(source),'frame elapsed time reaches the fixed clock');
 check(/candidate=this\.build\(options\);this\.validate\(candidate\)/.test(pose)&&/this\.measureEffectors\(candidate\);const report=this\.validate\(candidate\)/.test(pose)&&/boneErrorM>\.0001/.test(pose)&&/handErrorM>\.012/.test(pose),'whole candidate validated after clearance and before pose commit');
 check(/pose\.snapshot\(\)/.test(source)&&/pose\.restore\(saved\.pose\)/.test(source)&&/this\.w\.physics\.syncScene\(\);this\.saveSafe\(\);this\.time\+=dt;this\.phaseWallT\+=dt/.test(source),'motion transaction begins before phase mutation and restores through pose authority');
 check(/if\(this\.preflightWaiting\)\{try\{this\.w\.physics\.syncScene\(\);this\.advancePreflight\(dt\);this\.stepPhysics\(dt\);\}catch\(error\)\{this\.fail\(error\.message\);\}return;\}/.test(source),'waiting preflight preserves the pose and routes physics exceptions through rollback');
 for(const field of ['heldId','grips','worldRevision','evidenceLength','kernel','strength','basic'])check(source.includes(field),'rollback includes '+field);
 check(/this\.held=saved\.heldId/.test(source)&&/held:before\.held/.test(source)&&/this\.evidence\.length=saved\.evidenceLength/.test(source),'object ownership and completion evidence roll back together');
 check(/lockedFrames:new Map/.test(source)&&/if\(options\.lockedFrames\)/.test(pose),'floor holds retain complete accepted frames');
 check(/t\.returnToLab/.test(source)&&/blendAmount:smoother\(t\.elapsed\/\.4\)/.test(source),'standing return blends into lab stance');
 check(/g\.type==='salute'\?\(!hand/.test(source)&&/:!this\.lastMotionTracking\?\.passed/.test(source),'wave tracking is distinct from salute contact validation');
 check(/motionChooseContact/.test(actions)&&/motionValidateTransferContacts/.test(actions),'shared contact and transfer candidate rules');
 check((read('control/PlanForecast.js').match(/motionChooseContact(?:Steps)?\(/g)||[]).length===2,'forecast pickup and placement retain shared generic contact selection');
 check((read('control/TaskAgent.js').match(/this\.prepareManipulationContactSteps\(/g)||[]).length===2&&/motionPlanBoxHandlingSteps/.test(read('control/TaskAgent.js')),'live pickup and placement share the checked box and generic contact adapter');
 check(/if\(options\.grips\)(?:yield\* )?motionValidateTransferContacts(?:Steps)?\([^;\n]*,252\)/.test(actions)&&/if\(checked&&!options\.contactOnly\)(?:yield\* )?motionValidateContactReach(?:Steps)?\([^;\n]*,204,objectPose\)/.test(actions),'the selector retains dense transfer and reach certification before accepting a contact');
 check(/motionTurnPlan/.test(source)&&/turnIndex\+\+/.test(source),'relative full turns preserve their segmented progress');
 for(const path of ['language/JarvisSemanticPlanner.js','control/TaskAgent.js'])check(read(path).includes('headingDeg')&&read(path).includes('angleDeg'),'turn protocol in '+path);
 const page=read('source/index.template.html');
 check((page.match(/data-basic-command=/g)||[]).length===8&&/runBasicMotion\(button\.dataset\.basicCommand\)/.test(page),'eight basic buttons use the common command pipeline');
 check(/window\.parent!==window\)return/.test(read('body/CompactWorkbench.js')),'embedded surface panel does not dispatch commands twice');
 check(/walk:\{/.test(actions)&&/turn:\{/.test(actions)&&/carry:\{/.test(actions)&&/push:\{/.test(actions)&&/salute:\{/.test(actions),'new kernel and declared task extensions are exposed');
 check(/supportsDirectGoals:false/.test(read('control/HumanJointControlAdapter.js')),'unimplemented individual joint goals remain explicit');
 check(lock.runtimeVerified===false&&lock.visualAcceptance===false,'source checks do not imply runtime acceptance');
 return {checks,pinnedModules:expected.length,originalFilesCompared,lexicalReferences:referenceCount,unresolvedLexicalReferences:0,applicationExecuted:false,visualAcceptance:false};
}
