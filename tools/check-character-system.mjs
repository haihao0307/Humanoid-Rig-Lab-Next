// Inspect source structure and ownership contracts. Never evaluate controllers,
// candidate poses, geometry, workers or WebGL during this file-only audit.
export function checkCharacterSystemSources({parse,read,assert}){
 let checks=0;const check=(ok,message)=>{assert(ok,'Character system: '+message);checks++;};
 const syntax=text=>parse(text,{ecmaVersion:'latest',sourceType:'module'});
 const method=(text,className,name)=>{
  const cls=syntax(text).body.find(n=>n.type==='ClassDeclaration'&&n.id.name===className);
  const value=cls?.body.body.find(n=>n.key.name===name);check(!!value,className+'.'+name);return text.slice(value.start,value.end);
 };
 const ordered=(text,parts)=>{let at=-1;return parts.every(part=>{const next=text.indexOf(part,at+1);if(next<0)return false;at=next;return true;});};
 const manifest=JSON.parse(read('source/assembly.json')),template=read('source/runtime.template.js');
 for(const path of ['control/CharacterActivity.js','control/BasicController.js','control/TaskAgent.js']){
  check(manifest.modules.filter(p=>p===path).length===1,'one module owner: '+path);
  check(template.includes('/*__SOURCE:'+path+'__*/'),'assembled module: '+path);
 }
 check(!/class (?:BasicController|Agent)\b/.test(template),'controllers are independently maintained source modules');
 const activity=read('control/CharacterActivity.js');syntax(activity);
 check(!/agent\.[\w.]+\s*=(?!=)|\.pose\(|\.update\(|\.tick\(|new (?:Map|Set)/.test(activity),'activity is derived without another state machine or motion writes');
 check(/locomotion\?\.isSettled\(\)===true/.test(activity)&&/transition\|\|gesture\|\|!motionSettled/.test(activity),'settling is physical activity after cancellation');
 check(/taskActive\|\|motionActive\|\|!!heldObject/.test(activity)&&/readyForTask:!physicalBusy&&!error/.test(activity),'held objects and errors prevent readiness');
 check(activity.includes('__jarvisRoutineReservation')&&activity.includes('__jarvisSemanticReservation'),'mutations respect both task reservations');
 const agent=read('control/TaskAgent.js'),basic=read('control/BasicController.js');
 check(ordered(method(agent,'Agent','reset'),["requireCharacterIdle(this,'重置人物')",'this.pos=']),'reset guard precedes body mutation');
 check(/this\.pending=plan;this\.cancelRequested=false/.test(method(basic,'BasicController','replacePending')),'a replacement after stop survives transition completion');
 for(const [path,marker,write]of [
  ['body/CharacterPresets.js',"requireCharacterIdle(lab.agent,'切换角色定义')",'human.characterPreset='],
  ['body/StrengthBridge.js','requireCharacterIdle(lab.agent',null],
  ['body/HumanBiology.js','requireCharacterIdle(lab.agent',null]]){
  const text=read(path);check(text.includes(marker),path+' uses the shared guard');if(write)check(ordered(text,[marker,write]),'identity guard precedes assignment');
 }
 check(/reset:seed=>\{environmentIdleGuard\(\);window\.HumanLab\?\.population\?\.guardWorldReplacement\(\);world\.reset\(seed\?\?260901\)/.test(template),'public world reset validates idle before mutation and preserves seed zero');
 check(/\$\('reshuffle'\)\.onclick=\(\)=>\{try\{environmentIdleGuard\(\);window\.HumanLab\?\.population\?\.guardWorldReplacement\(\);world\.reset/.test(template),'shuffle button cannot bypass world edit ownership');
 check(/environmentPointerStart=null;try\{environmentIdleGuard\(\)/.test(template),'point placement rechecks ownership when committing the location');
 check(/d\.activity\.phase==='settling'\?'减速收脚'/.test(template),'body panel distinguishes settling from idle');
 const bridge=read('language/HumanoidSemanticBridge.js'),language=read('language/JarvisLanguageController.js');
 check(/status:activity\.status,activity/.test(bridge)&&/action==='activity'\)return a\.agent\.activity\(\)/.test(bridge),'bridge exposes the same derived state');
 check(/count>=open\.stepCount&&agent\.activity\(\)\.readyForTask/.test(bridge),'native completion waits for physical readiness');
 check(/open\|\|a\.agent\.held\|\|!a\.agent\.activity\(\)\.readyForTask/.test(bridge),'waiting cannot begin during settling');
 check(ordered(language.slice(language.indexOf('async function drainSemanticQueue')),["requestBody('semantic.reserve'",'await waitForBodySettled(task)','await forecastSemantic(task.plan)']),'dispatch forecasts from the settled body');
 check(ordered(language.slice(language.indexOf('async function runNativeSemantic')),['await waitForBodySettled(task)','await freshWorld']),'native batches refresh the scene after settling');
 check(/activity\.readyForTask&&!activity\.paused/.test(language)&&/waitingS\+=Math\.max\(0,activity\.timeS-previousTime\)/.test(language),'settlement wait uses body time and respects body pause');
 const pose=read('body/MotionLabPose.js'),apply=method(pose,'MotionLabPose','apply'),validate=method(pose,'MotionLabPose','validate');
 check(/this\.h\.joints\.some\(j=>!candidate\.frames\.has\(j\.id\)\)/.test(validate)&&/f\.p\?\.length!==3\|\|f\.q\?\.length!==4/.test(validate),'candidate has the exact joint identities and transform dimensions');
 check(ordered(apply,['this.build(options)','this.validate(candidate)','h.minimumBoneY(candidate.frames)','this.measureEffectors(candidate)','const report=this.validate(candidate)','const localFrames=','j.p=f.p','h.fk()']),'floor and final effector validation precede every live joint write');
 check(!/h\.root\.p\[1\]|h\.refreshEffectorErrors/.test(apply)&&/error\.targetSpace==='body'/.test(apply),'floor translation preserves fixed world contact targets');
 check(/targetSpace:'world'/.test(pose)&&/targetSpace:goal\.space\|\|'world'/.test(pose)&&/space:'body'/.test(read('body/StandardsMotion.js')),'world contacts and body-relative salute landmarks are explicit');
 check(/minimumBoneY\(frames=null\)/.test(template)&&/minimumSupportY\(frames\)/.test(read('body/ReconstructionState.js')),'candidate support frames reach the skin query');
 const surface=read('body/CompactWorkbench.js'),replace=method(surface,'CompactSurfaceRenderer','replace');
 const support=method(surface,'CompactSurfaceRenderer','minimumSupportY');
 check(/frames\?frames\.get\(j\.id\):j\.world/.test(support)&&!/\.fk\(|\.pose\(|\.world\s*=/.test(support),'support query is read-only for candidate and live poses');
 check(ordered(replace,['const stage=','stage.chunks.push(chunk)','gl.bindVertexArray(vao)','stage.supportProbes=data.supportProbes','stage.report=','this.checkUpload();','this.chunks=stage.chunks','this.releaseChunks(oldChunks)']),'replacement stages geometry, support and report before releasing the old surface');
 check(/catch\(error\)\{this\.releaseChunks\(stage\.chunks\);stage\.hair\?\.dispose\(\);stage\.skirt\?\.dispose\(\);throw error;\}/.test(replace),'failed replacement frees only staged body, hair and skirt resources');
 check(/gl\.isContextLost\(\)\|\|code!==gl\.NO_ERROR/.test(surface)&&/if\(!vao\)throw/.test(replace)&&/if\(!b\)throw/.test(replace),'allocation and upload failures are checked');
 check(/if\(this\.disposed\)return/.test(method(surface,'CompactSurfaceRenderer','dispose'))&&/this\.supportProbes=\[\]/.test(surface),'surface disposal is idempotent and drops CPU probes');
 const hair=read('body/CompactHairRenderer.js');
 check(/catch\(error\)\{gl\.bindVertexArray\(null\);this\.dispose\(\);throw error;\}/.test(hair)&&/if\(this\.disposed\)return/.test(hair),'partially built hair frees its owned resources once');
 check(/compactPendingCancel=reason=>\{const error=Error\(reason\);error\.name='AbortError';finish\(error\);\}/.test(surface)&&/if\(error\)reject\(error\);else resolve\(data\)/.test(surface),'worker cancellation settles the pending promise');
 check(/if\(finished\|\|compactPendingWorker!==worker\)return/.test(surface)&&/worker\.onmessageerror=/.test(surface),'stale worker messages and transport errors have explicit paths');
 check(surface.includes("doc.removeEventListener('click',onBasicCommand)")&&/if\(event\.persisted\|\|disposed\)return/.test(surface),'unload removes parent listener while bfcache retains live resources');
 return {checks,controllerModules:3,applicationExecuted:false,poseSolverExecuted:false,workerExecuted:false,gpuExecuted:false,visualAcceptance:false};
}
