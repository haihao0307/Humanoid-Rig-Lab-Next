// Read literal recipe data and inspect syntax trees. Never run game functions.
export function checkNPCRoutineSources({parse,read,runtime,body,index,assert}){
 let checks=0;const check=(ok,message)=>{assert(ok,'NPC routine source contract: '+message);checks++};
 const syntax=s=>parse(s,{ecmaVersion:'latest',sourceType:'module'});
 function nodes(n,p,out=[]){if(!n||typeof n!=='object')return out;if(Array.isArray(n)){n.forEach(x=>nodes(x,p,out));return out}if(p(n))out.push(n);for(const [k,v]of Object.entries(n))if(!['start','end','type'].includes(k))nodes(v,p,out);return out}
 function literal(n){
  if(n?.type==='Literal')return n.value;
  if(n?.type==='UnaryExpression'&&n.operator==='-')return -literal(n.argument);
  if(n?.type==='ArrayExpression')return n.elements.map(literal);
  if(n?.type==='ObjectExpression')return Object.fromEntries(n.properties.map(p=>{if(p.type!=='Property'||p.computed)throw Error('Expected plain data property');return[p.key.name??p.key.value,literal(p.value)]}));
  throw Error('Expected source literal, never an evaluated expression');
 }
 const named=(tree,name)=>nodes(tree,n=>n.type==='FunctionDeclaration'&&n.id?.name===name)[0];
 const calls=(tree,name)=>nodes(tree,n=>n.type==='CallExpression'&&(n.callee.name===name||n.callee.property?.name===name));
 const decl=(tree,name)=>nodes(tree,n=>n.type==='VariableDeclarator'&&n.id.name===name)[0];
 const slice=(s,n)=>{check(!!n,'declaration is present');return s.slice(n.start,n.end)};
 const catalog=read('control/NPCRoutineCatalog.js'),tree=syntax(catalog),data=literal(decl(tree,'data').init);
 const runTree=syntax(runtime),camp=literal(decl(runTree,'CAMP_WORLD').init);
 const world=read('world/NPCRoutineWorld.js'),wt=syntax(world),templates=literal(decl(wt,'NPC_ROUTINE_TEMPLATES').init.arguments[0]);
 const installer=named(wt,'installNPCRoutineWorld'),props=calls(installer,'addObject').map(n=>n.arguments.slice(0,4).map(literal));
 check(data.schema==='jarvis/npc_routines@1'&&data.residents.length===3&&data.routines.length===10,'three identities and ten finite recipes');
 check(data.homes.length===7&&props.length===2&&Object.keys(templates).length===2,'only two generated props and seven return zones');
 const objectIds=new Set([...camp.objects.map(o=>o.id),...props.map(p=>p[1])]),zoneIds=new Set([...camp.zones.map(z=>z.id),...data.homes.map(h=>h.zone)]);
 check(objectIds.size===camp.objects.length+props.length&&zoneIds.size===camp.zones.length+data.homes.length,'new entity ids do not collide with the camp');
 check(objectIds.size<=160&&zoneIds.size<=32,'entity counts fit import limits');
 const homes=new Map(data.homes.map(h=>[h.object,h.zone]));
 check(homes.size===7&&data.homes.every(h=>objectIds.has(h.object)),'every tool home refers to a current object');
 const roles=new Map(data.residents.map(n=>[n.role,n])),expanded=[];
 check(roles.size===3&&new Set(data.residents.map(n=>n.id)).size===3,'identity names and role ids are unique');
 for(const npc of data.residents){check(zoneIds.has(npc.home)&&zoneIds.has(npc.rest),'identity home and rest zones exist');check(npc.restSeconds>=30&&npc.restSeconds<=120,'finite post-work rest');}
 for(const r of data.routines){
  const npc=roles.get(r.role);check(!!npc,'recipe belongs to an identity');
  check(r.period>=120&&r.cooldown>=30&&r.initialNeed>=0&&r.initialNeed<=1,'needs and cooldowns have bounded numeric parameters');
  check(new Set(r.tools).size===r.tools.length&&r.tools.every(id=>homes.has(id)),'carried tools all have return homes');
  const steps=r.phases.flatMap(p=>p.actions);
  for(const a of steps){
   check(['walk','turn','carry','wait','greet','salute'].includes(a[0]),'authored phase uses a supported action');
   if(a[0]==='turn')check(Number.isFinite(a[1])&&Math.abs(a[1])<=360&&(!a[2]||a[2]==='world'),'turn tuple has a bounded angle and explicit frame');
   if(a[0]==='walk')check(zoneIds.has(a[1]),'walk references an existing zone');
   if(a[0]==='carry')check(r.tools.includes(a[1])&&zoneIds.has(a[2]),'carry uses a declared tool and destination');
   if(['wait','greet','salute'].includes(a[0]))check(Number.isFinite(a[1])&&a[1]>=1.2&&a[1]<=30,'authored action time fits the semantic contract');
  }
  // Count authored tuples plus the literal builder's prepare/return/rest/home phases.
  const count=1+steps.length+r.tools.length*2+3+Math.ceil(npc.restSeconds/30)+2;
  expanded.push({id:r.id,steps:count});check(count<=64,'expanded cycle fits one whole-plan forecast');
 }
 const builder=slice(catalog,named(tree,'build')),verify=slice(catalog,named(tree,'verify'));
 check(/r\.tools\.flatMap/.test(builder)&&/targetId:home\(id\)\.zone/.test(builder)&&/targetId:npc\.home/.test(builder),'the builder returns every tool and the actor');
 check(/if\(kind==='cycle'\)/.test(builder)&&/kind==='rest'/.test(builder)&&/waits\(npc\.restSeconds\)/.test(builder),'work, recovery and idle rest stay separate');
 check(/Math\.min\(30,left\)/.test(slice(catalog,named(tree,'waits'))),'long rest is split into supported waits');
 check(/radius/.test(verify)&&/posture!=='standing'/.test(verify)&&/actor\.heldObject/.test(verify),'completion checks full object footprints, posture and empty hands');
 const controller=read('language/NPCRoutineController.js'),ct=syntax(controller),dispatch=slice(controller,named(ct,'nrDispatch')),finish=slice(controller,named(ct,'nrFinishTask')),tick=slice(controller,named(ct,'nrTick'));
 check(calls(named(ct,'nrDispatch'),'schedule').length===1&&calls(named(ct,'nrDispatch'),'enqueueSemantic').length===1&&/modality:'npc-routine'/.test(dispatch),'routine actions use the shared serialized semantic queue');
 check(!/\.pose\(|\.tick\(|\.advance\(|\.submitPlan\(|\.p\s*=|\.pos\s*=|strength\.(?:reset|recover|advance)/.test(controller),'scheduler never writes poses, object positions or strength');
 check(/nr\.flight\|\|nr\.starting\|\|!nr\.enabled/.test(tick)&&/finally\{nr\.flight=false/.test(tick),'one asynchronous scheduling flight at a time');
 check(/nr\.identity!==nrIdentity\(\)/.test(tick)&&/lab\.routines\?\.owner!==nr\.owner/.test(tick),'identity and body ownership are rechecked');
 check(/fatigue>=\.30/.test(tick)&&/fatigue>\.16/.test(tick)&&/nrDispatch\(null,'rest'/.test(tick),'fatigue hysteresis and idle waits use ordinary checked rest plans');
 check(/Math\.min\(6,/.test(controller)&&/Math\.min\(600,30\*2\*\*/.test(controller)&&/b\.revision!==revision\|\|now>=b\.until/.test(tick),'blocked recipes have capped exponential retry delays');
 check(/kind==='cycle'/.test(finish)&&/task\.finished!==task\.preflight\.selectedNodeIds\.length/.test(finish)&&finish.indexOf("requestBody('routine.complete'")<finish.indexOf('memory.cycles='),'only a fully completed work cycle earns credit after body verification');
 check(/routineInternal:true/.test(finish)&&/stopped\.requiresRelease/.test(finish)&&/nr\.heldTaskId=task\.id/.test(finish)&&/owner:nr\.heldTaskId/.test(tick),'held failures retain contact and release the old semantic owner only after cleanup');
 check(/if\(nr\.stopAfterCycle\)await nrRelease/.test(finish)&&/nr\.stopAfterCycle=true/.test(controller),'graceful ending waits for the current cycle');
 check(/nr\.events\.length>48/.test(controller)&&/receipts\.size>32/.test(world)&&/Math\.min\(1e9,/.test(controller),'routine history and completion counters are bounded');
 const memoryKey=slice(controller,named(ct,'nrInstanceMemoryKey')),remember=slice(controller,named(ct,'nrRemember')),loadMemory=slice(controller,named(ct,'nrLoadInstanceMemory')),restoreInstance=slice(controller,named(ct,'nrRestoreInstance'));
 check(/state\.activeInstanceId\|\|EMBODIMENT_ID/.test(memoryKey)&&/localStorage\.setItem\(nrInstanceMemoryKey\(\)/.test(remember)&&/localStorage\.getItem\(nrInstanceMemoryKey\(\)/.test(loadMemory),'routine memory reads and writes use the body instance id, so equal roles do not share counters');
 check(/epoch=nr\.epoch\+1/.test(restoreInstance)&&/timer=nr\.timer/.test(restoreInstance)&&/saved\|\|nrFreshInstance\(\)/.test(restoreInstance)&&/if\(!saved\)nrLoadInstanceMemory\(\)/.test(restoreInstance),'switching routine contexts keeps one scheduler timer, invalidates prior flights, and creates fresh memory for new instances');
 const parent=read('language/JarvisLanguageController.js'),pt=syntax(parent),enqueue=slice(parent,named(pt,'enqueueSemantic')),control=slice(parent,named(pt,'controlSemantic'));
 check(enqueue.indexOf('await forecastSemantic')<enqueue.indexOf('JarvisNPCRoutines.takeover')&&/meta\.modality!=='npc-routine'/.test(enqueue),'valid manual tasks take over only after whole-plan preflight');
 check(/action==='stop'&&!routineInternal/.test(control),'internal failure handling and pause do not accidentally disarm the loop');
 check(/plan\.routine\.kind!=='rest'/.test(parent)&&/JarvisNPCRoutineCatalog\.verify\(plan\.routine/.test(parent),'forecast also verifies the complete return state');
 check(/task\.plan\.routine\.kind!=='rest'/.test(parent)&&/task\.routineVerification=verified/.test(parent)&&/task\.routineVerification\?\.ok!==true/.test(finish),'actual return state is checked for work and recovery before accepting completion');
 check(parent.indexOf('const routineCommand=')<parent.indexOf('let preliminary;try')&&/inflightInputs\.set\(inputId,result\)/.test(parent),'routine language commands are intercepted once without nesting the arbiter');
 const installerText=slice(world,named(wt,'installRoutineWorldAPI'));
 check(/__jarvisRoutineReservation!==owner/.test(installerText)&&/!a\.activity\(\)\.readyForTask/.test(installerText)&&installerText.indexOf('if(!verification.ok)')<installerText.indexOf('s.needs[routineId]=0'),'settled body verification precedes environment completion credit');
 const advance=slice(world,named(wt,'advanceRoutineEnvironment'));
 check(/s\.pendingS\+=dt/.test(advance)&&/s\.pendingS<1/.test(advance)&&!/Date\.now|performance\.now|\.touch/.test(advance),'environment needs use body time without invalidating geometry each frame');
 check(/restoreRoutineEnvironment\(this,data\.routines\)/.test(runtime)&&/routines:snap\.routines/.test(runtime),'scene import and export preserve bounded routine state');
 check(/pruneHistory\(\)/.test(runtime)&&/this\.evidence\.length>128/.test(runtime)&&/this\.basic\.phaseLog\.length>32/.test(runtime),'native diagnostic buffers are trimmed between tasks');
 const bridge=read('language/HumanoidSemanticBridge.js');
 check(/!window\.__jarvisSemanticReservation&&!open&&a\.agent\.activity\(\)\.readyForTask/.test(bridge)&&/a\.agent\.pruneHistory\(\)/.test(bridge),'trimming cannot invalidate an open semantic ticket or unsettled motion');
 for(const action of ['routine.prepare','routine.reserve','routine.release','routine.complete'])check(bridge.includes("'"+action+"'"),'routine bridge action declared');
 const template=read('source/index.template.html'),manifest=JSON.parse(read('source/assembly.json'));
 const parentSource=[...template.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function populationActivateContext(')),populationTree=syntax(parentSource),activation=slice(parentSource,named(populationTree,'populationActivateContext')),activationGuard=slice(parentSource,named(populationTree,'populationCanActivate'));
 check(/populationParentContexts\.set\(previous/.test(activation)&&/routine:\{\.\.\.nr\}/.test(activation)&&/nrRestoreInstance\(saved\.routine\)/.test(activation)&&/nrRestoreInstance\(\)/.test(activation),'the active-resident adapter stores and restores separate routine contexts for each instance');
 check(/state\.pending\.size/.test(activationGuard)&&/commandArbiter\.tokens\.size/.test(activationGuard)&&/languageState\.queue\.length/.test(activationGuard)&&/languageState\.confirmation/.test(activationGuard)&&/JarvisNPCRoutines\?\.active/.test(activationGuard)&&/nr\.flight\|\|nr\.starting/.test(activationGuard),'switching cannot strand pending requests, queued intentions, or an asynchronous routine flight');
 check(/instanceId:state\.activeInstanceId/.test(slice(controller,named(ct,'nrExport'))),'routine exports identify the instance that earned their completion history');
 for(const id of new Set([...controller.matchAll(/\$\('(npcRoutine[^']+)'\)/g)].map(m=>m[1])))check((template.match(new RegExp('id="'+id+'"','g'))||[]).length===1,'routine UI target occurs once: '+id);
 check(template.includes('setupCampTasks();setupNPCRoutines();')&&index.includes('const nrCatalog=window.JarvisNPCRoutineCatalog;'),'routine UI starts after its module is initialized');
 check(body.includes(catalog.trim())&&index.includes(catalog.trim())&&manifest.htmlModules.body.includes('control/NPCRoutineCatalog.js'),'parent and body share the same identity recipes');
 const definition=read('body/NPCDefinitions.js');check(/validateNPCBehavior/.test(definition)&&/data\.residents\.entries\(\)/.test(definition)&&/routineMemory:/.test(definition),'NPC definitions include validated roles and independent spawn memory');
 check(/filter\(nrCatalog\.motionAvailable\)/.test(controller)&&/o\.disabled=!nrCatalog\.motionAvailable\(r\)/.test(controller),'unsupported motion recipes are excluded from scheduling and disabled in the UI');
 const sourceBytes=['control/NPCRoutineCatalog.js','world/NPCRoutineWorld.js','language/NPCRoutineController.js','ui/NPCRoutines.css'].reduce((n,p)=>n+Buffer.byteLength(read(p)),0);
 check(sourceBytes<=65536,'new routine source stays below 64 KiB');
 return{checks,identities:data.residents.length,routines:data.routines.length,motionAvailableRoutines:data.routines.filter(r=>r.phases.every(p=>p.actions.every(a=>['walk','turn','carry','wait','greet','salute'].includes(a[0])))).length,newProps:props.length,homeZones:data.homes.length,sceneObjects:objectIds.size,sceneZones:zoneIds.size,expandedCycles:expanded,sourceBytes,applicationExecuted:false,repeatedExecutionVerified:false};
}
