// Inspect bytes, literal data and syntax trees only. Never import or execute
// the engine, instantiate bodies, advance a clock or evaluate game functions.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

export function checkPhysicsSources({parse,read,assert,root,runtime}){
 let checks=0;const check=(ok,message)=>{assert(ok,'Physics source contract: '+message);checks++;};
 const syntax=text=>parse(text,{ecmaVersion:'latest',sourceType:'module'});
 function nodes(node,predicate,out=[]){
  if(!node||typeof node!=='object')return out;
  if(Array.isArray(node)){for(const child of node)nodes(child,predicate,out);return out;}
  if(predicate(node))out.push(node);
  for(const [key,value]of Object.entries(node))if(!['type','start','end','loc'].includes(key))nodes(value,predicate,out);
  return out;
 }
 function path(node){
  if(node?.type==='ChainExpression')return path(node.expression);
  if(node?.type==='Identifier')return node.name;
  if(node?.type==='ThisExpression')return 'this';
  if(node?.type==='MemberExpression'){
   const key=node.computed?node.property.type==='Literal'?String(node.property.value):'*':node.property.name;
   return path(node.object)+'.'+key;
  }
  return '';
 }
 const calls=(tree,name)=>nodes(tree,n=>n.type==='CallExpression'&&path(n.callee)===name);
 const methods=(tree,className)=>{
  const cls=nodes(tree,n=>n.type==='ClassDeclaration'&&n.id?.name===className)[0];
  check(!!cls,'class exists: '+className);
  return new Map(cls.body.body.filter(n=>n.type==='MethodDefinition').map(n=>[n.key.name??n.key.value,n]));
 };
 const required=(map,name)=>{const value=map.get(name);check(!!value,'method exists: '+name);return value;};
 const property=(tree,name)=>nodes(tree,n=>n.type==='Property'&&(n.key.name??n.key.value)===name);
 const returnsFalse=(tree,name)=>property(tree,name).some(n=>n.value.type==='Literal'&&n.value.value===false);
 const hasMember=(tree,name)=>nodes(tree,n=>n.type==='MemberExpression'&&path(n)===name).length>0;
 const hasName=(tree,name)=>nodes(tree,n=>n.type==='Identifier'&&n.name===name).length>0;
 // Evaluate only numeric literal arithmetic from declarations, never JavaScript.
 function number(node){
  if(node?.type==='Literal'&&typeof node.value==='number')return node.value;
  if(node?.type==='UnaryExpression'&&node.operator==='-')return -number(node.argument);
  if(node?.type==='BinaryExpression'){
   const a=number(node.left),b=number(node.right);
   if(node.operator==='/')return a/b;if(node.operator==='*')return a*b;
   if(node.operator==='+')return a+b;if(node.operator==='-')return a-b;
  }
  return NaN;
 }

 const lock=JSON.parse(read('world/physics/source-lock.json'));
 check(lock.schema==='human-workbench/physics-source-lock@1.0'&&lock.engine==='cannon-es'&&lock.version==='0.20.0','engine and source-lock version are fixed');
 check(lock.source?.url==='https://registry.npmjs.org/cannon-es/-/cannon-es-0.20.0.tgz'&&/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(lock.source?.integrity||''),'published package URL and integrity are pinned');
 check(lock.license==='MIT'&&lock.runtimeNetwork===false&&lock.runtimeWasm===false&&lock.runtimeVerified===false,'locked engine retains local-source and acceptance boundaries');
 check(Array.isArray(lock.files)&&lock.files.length>=2&&new Set(lock.files.map(f=>f.path)).size===lock.files.length,'lock has distinct engine and license entries');
 for(const file of lock.files){
  check(typeof file.path==='string'&&/^world\/physics\/[A-Za-z0-9_./-]+$/.test(file.path)&&!file.path.split('/').includes('..'),'locked file stays inside physics sources');
  check(/^[a-f0-9]{64}$/.test(file.sha256)&&createHash('sha256').update(readFileSync(join(root,file.path))).digest('hex')===file.sha256,'source bytes match locked SHA-256: '+file.path);
 }
 const engineFiles=lock.files.filter(f=>/\.m?js$/.test(f.path)),licenseFiles=lock.files.filter(f=>/LICENSE(?:\.[A-Za-z]+)?$/i.test(f.path));
 check(engineFiles.length===1&&licenseFiles.length===1,'one local JavaScript engine and one retained license');
 const vendorTree=syntax(read(engineFiles[0].path));
 check(!nodes(vendorTree,n=>n.type==='ImportDeclaration'||n.type==='ImportExpression').length,'pinned engine has no external module dependency');
 const license=read(licenseFiles[0].path);
 check(license.includes('Permission is hereby granted')&&license.includes('THE SOFTWARE IS PROVIDED "AS IS"'),'upstream permission and warranty disclaimer are retained');

 const manifest=JSON.parse(read('source/assembly.json')),template=read('source/runtime.template.js');
 const core=read('world/PhysicsWorld.js'),contract=read('world/PhysicsContract.js'),coreTree=syntax(core),contractTree=syntax(contract);
 for(const file of ['world/PhysicsContract.js','world/PhysicsWorld.js','world/PhysicsControls.js']){
  check(manifest.modules.filter(p=>p===file).length===1,'one assembly owner: '+file);
  check(template.includes('/*__SOURCE:'+file+'__*/')&&runtime.includes(read(file).trim()),'entrypoint includes current module: '+file);
 }
 const build=syntax(read('tools/build-pure.mjs')),bundler=syntax(read('tools/bundle-physics.mjs')),runtimeTree=syntax(runtime);
 check(calls(build,'bundlePhysics').length===1,'pure builder assembles the physics library once');
 check(hasName(bundler,'createHash')&&hasName(bundler,'read'),'physics linker reads and hashes local source');
 check(nodes(runtimeTree,n=>n.type==='VariableDeclarator'&&n.id?.name==='WorkbenchPhysicsEngine').length===1,'engine is scoped once in the assembled entrypoint');
 check(!nodes(bundler,n=>n.type==='ImportExpression'||n.type==='NewExpression'&&path(n.callee)==='Function').length&&!calls(bundler,'eval').length,'linker does not evaluate application source');

 const physics=methods(coreTree,'PhysicsWorld');
 for(const name of ['syncScene','step','setManipulation','clearManipulation','objectState','capture','restore','snapshot','assertFinite','configure'])required(physics,name);
 check(!nodes(coreTree,n=>n.type==='CallExpression'&&['setInterval','setTimeout','requestAnimationFrame','performance.now','Date.now','fetch'].includes(path(n.callee))).length,'physics adapter has no independent clock or network');
 check(hasName(coreTree,'WorkbenchPhysicsEngine'),'physics world uses the bundled engine');
 const physicsStep=required(physics,'step'),constructor=required(physics,'constructor'),actuator=required(physics,'applyManipulation');
 const fixedValues=nodes(constructor,n=>n.type==='AssignmentExpression'&&path(n.left)==='this.fixedDt').map(n=>number(n.right));
 const clock=methods(syntax(read('motion/vendor/clock.mjs')),'FixedClock');
 const clockDefault=required(clock,'constructor').value.params.find(n=>n.type==='AssignmentPattern'&&n.left.name==='step');
 check(fixedValues.length===1&&fixedValues[0]===number(clockDefault?.right)&&fixedValues[0]===1/120,'physics and motion share the same declared fixed timestep');
 check(calls(physicsStep,'this.engine.step').length===1&&calls(physicsStep,'this.assertFinite').length>0,'adapter advances the engine and checks solved values');
 check(hasMember(physicsStep,'this.maxMicrosteps')&&nodes(physicsStep,n=>n.type==='IfStatement'&&hasMember(n.test,'this.maxMicrosteps')&&nodes(n.consequent,v=>v.type==='ThrowStatement').length>0).length>0,'excessive requested microsteps are rejected');
 check(calls(physicsStep,'this.applyManipulation').length>0&&calls(actuator,'b.applyForce').length===1,'body manipulation is applied as force during physical stepping');
 check(hasMember(actuator,'m.maxForceN')&&hasMember(actuator,'m.maxHorizontalForceN')&&hasMember(actuator,'m.maxTorqueNm'),'actuator consumes translation, traction and rotation budgets');
 check(!calls(actuator,'b.position.copy').length&&!calls(actuator,'b.quaternion.copy').length&&!nodes(actuator,n=>n.type==='AssignmentExpression'&&/^b\.(?:position|quaternion)(?:\.|$)/.test(path(n.left))).length,'force actuator cannot overwrite the solved body transform');
 const capture=required(physics,'capture'),restore=required(physics,'restore');
 for(const name of ['p','q','v','angularVelocity','sleepState'])check(property(capture,name).length>0,'physical checkpoint preserves '+name);
 check(calls(restore,'this.applyPose').length>0&&calls(restore,'this.assertFinite').length>0,'physical restore reapplies and validates body state');
 check(property(capture,'manipulations').length>0&&hasMember(restore,'snapshot.manipulations'),'physical checkpoint preserves owned manipulation targets');
 const frozen=required(physics,'syncFrozen'),stateReport=required(physics,'objectState');
 check(calls(physicsStep,'this.syncFrozen').length===1&&calls(frozen,'this.frozen.set').length>0&&calls(frozen,'this.frozen.delete').length>0,'paused held bodies have an explicit reversible local freeze');
 check(hasMember(frozen,'this.C.Body.KINEMATIC')&&property(frozen,'v').length>0&&property(frozen,'angularVelocity').length>0&&calls(frozen,'b.velocity.copy').length>0&&calls(frozen,'b.angularVelocity.copy').length>0,'local pause preserves and restores velocity while using a stationary body');
 check(property(capture,'frozen').length>0&&hasMember(restore,'snapshot.frozen'),'rollback preserves local pause state');
 for(const name of ['supported','settled'])check(property(stateReport,name).some(p=>p.value.type==='LogicalExpression'&&p.value.operator==='&&'&&p.value.left.type==='UnaryExpression'&&p.value.left.operator==='!'&&p.value.left.argument.name==='paused'),'paused bodies cannot satisfy '+name+' acceptance');
 for(const name of ['worldPhysicsSettings','worldPhysicsVector','worldPhysicsQuaternion'])check(nodes(contractTree,n=>n.type==='FunctionDeclaration'&&n.id?.name===name).length===1,'physics input normalizer exists: '+name);
 check(calls(contractTree,'Number.isFinite').length>=3,'settings, vectors and rotations reject non-finite values');

 const agentSource=read('control/TaskAgent.js'),agentTree=syntax(agentSource),agent=methods(agentTree,'Agent');
 const tick=required(agent,'tick'),fixed=required(agent,'tickFixed'),step=required(agent,'stepPhysics');
 check(calls(tick,'this.clock.advance').length===1&&calls(tick,'this.tickFixed').length===1,'motion clock owns the fixed update callback');
 check(calls(agentTree,'this.w.physics.step').length===1&&calls(step,'this.w.physics.step').length===1,'one agent wrapper owns physics advancement');
 check(calls(fixed,'this.stepPhysics').length>=1&&!calls(tick,'this.w.physics.step').length,'physics advances from fixed ticks');
 const first=fixed.value.body.body[0];
 check(first?.type==='IfStatement'&&hasMember(first.test,'this.paused')&&nodes(first.consequent,n=>n.type==='ReturnStatement').length>0,'paused fixed ticks return before work');
 const basicBranch=nodes(fixed,n=>n.type==='IfStatement'&&hasMember(n.test,'this.basic.busy'));
 check(basicBranch.some(n=>calls(n.consequent,'this.basic.update').length&&calls(n.consequent,'this.stepPhysics').length),'basic postures advance the same physical world');
 const heldWrites=nodes(agentTree,n=>n.type==='AssignmentExpression'||n.type==='UpdateExpression').filter(n=>/^this\.held\.(?:p|q)(?:\.|$)/.test(path(n.left||n.argument)));
 check(heldWrites.length===0,'task control never assigns the held rigid-body transform');
 check(calls(fixed,'this.w.physics.setManipulation').length>=1&&calls(fixed,'strengthRuntimeAssessment').length>=1,'hand goals use strength-limited manipulation');
 check(calls(agentTree,'this.w.physics.clearManipulation').length>=1&&calls(agentTree,'this.w.physics.objectState').length>=1,'task control queries body state and can release manipulation');
 check(calls(agentTree,'this.w.physics.clearManipulation').every(n=>n.arguments.length===1),'agent release names one owned physical object');
 const stable=required(agent,'requireStableObject'),release=required(agent,'releaseObject'),placement=required(agent,'verifyPlacement');
 check(calls(required(agent,'begin'),'this.requireStableObject').length>0&&calls(stable,'this.w.physics.objectState').length>0,'task entry checks the current rigid-body state');
 check(calls(fixed,'this.releaseObject').length>0&&calls(release,'this.w.physics.objectState').length>0&&hasMember(release,'state.supported'),'release requires current physical support');
 check(calls(fixed,'this.verifyPlacement').length>0&&calls(placement,'this.w.physics.objectState').length>0&&hasMember(placement,'state.settled')&&calls(placement,'this.finish').length>0,'placement completion checks physical settling');
 const saved=required(agent,'saveSafe'),failed=required(agent,'fail');
 check(property(saved,'physics').some(p=>calls(p.value,'this.w.physics.capture').length===1),'safe checkpoint includes physical state');
 check(calls(failed,'this.w.physics.restore').some(n=>path(n.arguments[0])==='saved.physics'),'failed tick restores its physical checkpoint');
 const governor=required(agent,'governManipulation'),feedback=required(agent,'assessManipulationFeedback'),progress=required(agent,'manipulationProgress');
 check(!calls(governor,'this.w.physics.step').length&&!nodes(governor,n=>n.type==='AssignmentExpression'&&/^o\.(?:p|q)(?:\.|$)/.test(path(n.left))).length,'reference governor never advances physics or overwrites the object');
 check(nodes(governor,n=>n.type==='AssignmentExpression'&&path(n.left)==='c.intent').length===1&&hasMember(feedback,'c.intent.p')&&hasMember(feedback,'c.intent.q'),'feedback keeps uncapped position and orientation intent');
 check(hasMember(governor,'s.lastManipulationTarget')&&hasName(governor,'dt')&&calls(governor,'qslerp').length>=2,'reference slew limits use the previous target and fixed time');
 check(calls(progress,'this.manipulationPace').length===1&&hasMember(progress,'this.held'),'held phase progress alone consumes feedback pace');
 const dtWrites=(tree,field)=>nodes(tree,n=>n.type==='AssignmentExpression'&&path(n.left)==='this.'+field&&n.operator==='+='&&path(n.right)==='dt');
 const releaseWait=nodes(fixed,n=>n.type==='IfStatement'&&path(n.test)==='this.skill.releaseVerified')[0],preflightAdvance=required(agent,'advancePreflight');
 check(dtWrites(fixed,'time').length===2&&releaseWait&&dtWrites(releaseWait,'time').length===1&&releaseWait.consequent.body.at(-1)?.type==='ReturnStatement'&&dtWrites(preflightAdvance,'time').length===1,'fixed body time advances once on mutually exclusive motion, preflight and post-unfreeze support branches');
 check(dtWrites(fixed,'phaseWallT').length===1&&dtWrites(preflightAdvance,'phaseWallT').length===0&&dtWrites(releaseWait,'phaseWallT').length===0,'motion timeout does not advance during safety certification or post-unfreeze support waiting');
 check(nodes(fixed,n=>n.type==='AssignmentExpression'&&path(n.left)==='this.phaseT'&&calls(n.right,'this.manipulationProgress').length===1).length===1,'phase clock uses governed progress');
 check(property(saved,'phaseWallT').length===1&&property(saved,'skill').length===1,'rollback includes timeout and skill-owned coupling state');
 const coupledPose=nodes(fixed,n=>n.type==='IfStatement'&&calls(n.consequent,'this.governManipulation').length>0);
 check(coupledPose.length===1&&calls(coupledPose[0],'frame').some(n=>path(n.arguments[0])==='this.held.p'&&path(n.arguments[1])==='this.held.q'),'visible hand targets follow the solved body');
 check(nodes(fixed,n=>n.type==='VariableDeclarator'&&n.id.name==='candidate'&&n.init?.type==='LogicalExpression'&&path(n.init.left)==='manipulationTarget').length===1,'force target remains independent of compliant visible palms');
 check(hasMember(feedback,'state.forceUtilization')&&hasMember(feedback,'state.torqueUtilization')&&hasMember(feedback,'state.speedMps')&&hasMember(feedback,'state.angularSpeedRadS'),'feedback reads solved force and motion');
 check(hasMember(feedback,'c.braking')&&hasMember(feedback,'c.blockedS')&&nodes(feedback,n=>n.type==='ThrowStatement').length>=2,'feedback retains braking state and bounded failure paths');
 for(const field of ['forceUtilization','torqueUtilization'])check(property(stateReport,field).length===1,'physical state exposes '+field);
 check(hasMember(stateReport,'m.appliedHorizontalForceN')&&hasMember(stateReport,'m.maxHorizontalForceN'),'force feedback includes the traction budget');
 const gait=methods(syntax(read('body/NaturalLocomotion.js')),'NaturalLocomotion');
 for(const name of ['move','turnInPlace']){
  const method=required(gait,name),brake=nodes(method,n=>n.type==='IfStatement'&&calls(n.consequent,'this.stop').length>0);
  check(calls(method,name==='move'?'a.manipulationPace':'this.a.manipulationPace').length===1&&brake.length===1,'held '+name+' consumes pace and can brake');
  check(nodes(brake[0],n=>n.type==='AssignmentExpression'&&path(n.left)==='this.tempo'&&n.right.value===1).length===1&&!nodes(brake[0],n=>n.type==='AssignmentExpression'&&/routeIndex|state\.(root|feet)/.test(path(n.left))).length,'braking '+name+' preserves route and lets feet settle at real time');
 }
 const populationTree=syntax(read('control/NPCPopulation.js')),population=methods(populationTree,'NPCPopulation');
 const populationTick=required(population,'tick'),populationFixed=required(population,'tickFixed');
 const physicsAlias=nodes(populationFixed,n=>n.type==='VariableDeclarator'&&path(n.init)==='this.lab.world.physics');
 check(physicsAlias.length===1&&physicsAlias[0].id.type==='Identifier','shared fixed update names its world physics instance');
 const sharedCall=name=>physicsAlias[0].id.name+'.'+name;
 check(calls(populationTick,'this.clock.advance').length===1&&calls(populationTick,'this.tickFixed').length===1,'shared world is driven by one population fixed clock');
 check(calls(step,'this.w.population.deferPhysics').length===1&&nodes(step,n=>n.type==='IfStatement'&&hasMember(n.test,'this.w.population')&&nodes(n.consequent,v=>v.type==='ReturnStatement').length>0).length>0,'actors defer physical advancement to their population');
 const sharedStep=calls(populationFixed,sharedCall('step'));
 check(calls(populationTree,sharedCall('step')).length===1&&sharedStep.length===1,'population advances the shared solver once per fixed update');
 check(!nodes(populationFixed,n=>['ForStatement','ForOfStatement','ForInStatement','WhileStatement','DoWhileStatement'].includes(n.type)&&calls(n,sharedCall('step')).length>0).length,'shared physical step is outside per-actor loops');
 check(calls(populationFixed,sharedCall('capture')).length>0&&calls(populationFixed,sharedCall('restore')).length>0,'shared update captures and restores the whole physical world');
 check(calls(sharedStep[0].arguments[1],'this.values').length===1&&nodes(sharedStep[0].arguments[1],n=>n.type==='MemberExpression'&&n.property.name==='agent').length>0,'shared solve receives every current actor proxy');
 check(calls(populationTick,'this.hasActive').length>0,'population time pauses when every actor is paused');
 check(calls(populationTree,'this.lab.world.physics.clearManipulation').every(n=>n.arguments.length===1),'population cleanup cannot clear another actor manipulation');
 const strengthTree=syntax(read('body/StrengthBridge.js'));
 const limits=nodes(strengthTree,n=>n.type==='FunctionDeclaration'&&n.id?.name==='strengthManipulationLimits')[0];
 check(!!limits&&['maxForceN','maxHorizontalForceN','maxTorqueNm'].every(name=>property(limits,name).length),'muscle bridge provides force, traction and torque limits');
 check(returnsFalse(limits,'calibrated'),'force-capacity estimates retain their calibration boundary');

 const world=methods(syntax(template),'World'),snapshot=required(world,'objectSnapshot'),normalize=required(world,'normalizeObject'),scene=required(world,'exportScene'),importScene=required(world,'importScene');
 for(const name of ['q','v','angularVelocity','mass','friction','restitution'])check(property(snapshot,name).length>0,'object snapshots preserve '+name);
 check(calls(normalize,'worldPhysicsQuaternion').length&&calls(normalize,'worldPhysicsVector').length>=2,'scene objects normalize rotations and both velocities');
 check(!nodes(scene,n=>n.type==='UnaryExpression'&&n.operator==='delete'&&/\.(?:q|v|angularVelocity)$/.test(path(n.argument))).length,'scene export retains rotations and velocities');
 check(property(scene,'physicsSettings').length>0&&calls(importScene,'worldPhysicsSettings').length>0,'scene export and import preserve physical settings');
 const controls=syntax(read('world/PhysicsControls.js'));
 const configure=property(controls,'configure')[0];
 check(!!configure&&calls(configure,'environmentIdleGuard').length===1&&calls(configure,'worldPhysicsSettings').length===1,'world parameter UI uses idle protection and the shared normalizer');
 const editor=read('source/index.template.html');
 for(const id of ['entityElevation','entityFriction','entityRestitution'])check(editor.split('id="'+id+'"').length===2,'one environment parameter input: '+id);
 const report=required(physics,'snapshot'),diagnostics=required(agent,'diagnostics'),forecast=syntax(read('control/PlanForecast.js'));
 check(returnsFalse(report,'runtimeVerified'),'physics snapshot does not claim runtime verification');
 check(['forceDynamicsValidated','humanLocomotionDynamics','visualAcceptance','productionReady'].every(name=>returnsFalse(diagnostics,name)),'agent diagnostics retain incomplete dynamics and acceptance boundaries');
 check(returnsFalse(forecast,'fullDynamicsValidated')&&property(forecast,'kinematicForecast').some(p=>p.value.value===true),'preflight remains explicitly kinematic');
 return{checks,engine:'cannon-es@0.20.0',lockedSourceFiles:lock.files.length,applicationExecuted:false,physicsEngineExecuted:false,physicsSimulationExecuted:false,runtimeVerified:false,forceDynamicsValidated:false,visualAcceptance:false,productionReady:false};
}
