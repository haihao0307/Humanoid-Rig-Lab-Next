/* Workbench control view; all joint data comes from the body's constrained pose. */
function controlEvidence(){return{schema:'jarvis/voice_to_joint_evidence@1.0',version:VERSION,bodyVersion:'1.10.0',bodyConstructionModified:false,voice:VoiceInputPlugin.state,inputs:languageState.history.slice(-20),arbiterRevision:commandArbiter.revision,contract:state.capabilities?.jointControl||null,current:state.heartbeat?.jointControl||state.snapshot?.jointControl||null,tasks:safe(languageState.tasks.slice(-30)),visualAcceptance:false,realMicrophoneVerified:false};}
function renderControlMonitor(){const dialog=$('controlMonitorDialog');if(!dialog?.open)return;
 const task=languageState.current||languageState.tasks.at(-1),joint=state.heartbeat?.jointControl||state.snapshot?.jointControl,voice=state.voice;
 const values=[['收音',voice.listening?'active':voice.lastTranscript?'done':''],['文字',languageState.history.length?'done':''],['理解',languageState.preview?'done':''],['动作',task?.status==='completed'?'done':task?.status==='running'?'active':''],['关节反馈',joint?.allFinite?'done':'']];
 $('controlPipeline').replaceChildren(...values.map(([label,c])=>{const e=document.createElement('span');e.textContent=label;e.className=c;return e}));
 $('controlInputStatus').textContent=task?`指令：${task.plan.sourceText}。输入编号：${task.inputId||'未记录'}。任务：${task.status}，完成 ${task.finished} 步。`:`语音状态：${voice.status}。没有下发身体动作。`;
 $('controlMotionStatus').textContent=joint?`${joint.phase} · ${joint.poseAuthority} · ${joint.totalJoints} 个关节。最近步骤采样 ${joint.sampleCount} 次，${joint.movedJointCount} 个关节相对起始姿态的采样旋转差超过 0.25°；骨链：${joint.activeChains.join('、')||'暂未检测到'}。骨长误差 ${(joint.maxBoneLengthErrorM*1000).toFixed(5)} mm，硬约束越界 ${joint.hardViolationCount??'未报告'}。`:'等待身体的实际姿态反馈。';
 const rows=(joint?.joints||[]).slice(0,16).map(j=>{const tr=document.createElement('tr');for(const value of [j.id,j.chain,`${j.peakFromStepStartDeg.toFixed(2)}°`,j.localRotation.map(v=>v.toFixed(4)).join(', ')]){const td=document.createElement('td');td.textContent=value;tr.append(td)}return tr});$('controlJointRows').replaceChildren(...rows);
 $('controlContractStatus').textContent=state.capabilities?.jointControl?`接口 ${state.capabilities.jointControl.schema} · 身体构造只读`:'等待接口';
}
async function emergencyStop(){await VoiceInputPlugin.stop({abort:true});window.speechSynthesis?.cancel();return await bodyAction('stop');}
function setupControlMonitor(){
 $('controlDialogStopBtn').onclick=()=>emergencyStop().catch(()=>{});
 $('controlMonitorBtn').onclick=()=>{$('controlMonitorDialog').showModal();renderControlMonitor()};$('controlMonitorClose').onclick=()=>$('controlMonitorDialog').close();
 $('controlPauseBtn').onclick=()=>bodyAction('pause').catch(()=>{});$('controlResumeBtn').onclick=()=>bodyAction('resume').catch(()=>{});$('controlStopBtn').onclick=()=>emergencyStop().catch(()=>{});
 $('controlMonitorDialog').addEventListener('cancel',()=>emergencyStop().catch(()=>{}));
 $('controlExportBtn').onclick=async()=>{const value=controlEvidence();try{value.fullJointSnapshot=await requestBody('control.snapshot')}catch(e){value.snapshotError=e.message}const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='jarvis-voice-joint-control-v1110.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
}
