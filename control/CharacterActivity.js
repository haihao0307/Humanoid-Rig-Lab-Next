/* Read one activity view from the existing task, posture and motion owners.
 * This module never advances motion, changes a pose or keeps a second FSM. */
function characterActivity(agent){
 const basic=agent.basic,locomotion=agent.locomotion;
 const transition=!!basic?.transition,gesture=!!basic?.gesture,pending=!!basic?.pending;
 const heldObject=agent.held?.id||null,taskActive=!!(agent.plan||agent.skill||pending||agent.preflightWaiting);
 const characterEditing=agent.characterEditInProgress===true;
 const motionSettled=locomotion?.isSettled()===true;
 const motionActive=transition||gesture||!motionSettled;
 const physicalBusy=taskActive||motionActive||!!heldObject;
 const error=agent.error||locomotion?.engine.state.fault||null;
 const phase=error?'failed':characterEditing?'editing':transition?'transitioning':gesture?'gesturing':heldObject?'manipulating':
  agent.preflightWaiting?'checking':agent.skill?'executing':agent.plan||pending?'queued':!motionSettled?'settling':basic?.posture==='standing'?'idle':'floor-hold';
 return {schema:'human/character_activity@1',phase,status:error?'failed':agent.paused?'paused':physicalBusy||characterEditing?'running':'idle',
  bodyPhase:agent.phase,posture:basic?.posture||'standing',taskActive,motionActive,motionSettled,physicalBusy,
  heldObject,characterEditing,paused:!!agent.paused,timeS:agent.time,error,readyForTask:!physicalBusy&&!error&&!characterEditing,
  canEdit:!physicalBusy&&!error&&!characterEditing,poseAuthority:'MotionLabPose.commit'};
}
function requireCharacterIdle(agent,operation,{reservations=true,allowCharacterEdit=false}={}){
 const population=agent.w?.population;
 if(reservations&&population?.isReserved(agent))throw Error('请先完成或停止该人物的当前任务，再'+operation);
 if(reservations&&!population&&window.__jarvisRoutineReservation)throw Error('请先结束持续日常，再'+operation);
 if(reservations&&!population&&window.__jarvisSemanticReservation)throw Error('请先完成或停止当前任务，再'+operation);
 const activity=characterActivity(agent);
 if(activity.characterEditing&&!allowCharacterEdit)throw Error('人物定义正在应用，请稍后再'+operation);
 if(activity.heldObject)throw Error('当前仍保持物体抓握，请先完成放置，再'+operation);
 if(activity.error)throw Error('请先停止并处理当前身体错误，再'+operation);
 if(activity.physicalBusy)throw Error('请等待当前动作和收脚完成，再'+operation);
 return activity;
}
