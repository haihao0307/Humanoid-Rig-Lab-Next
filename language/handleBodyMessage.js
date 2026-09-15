function handleBodyMessage(event){if(event.source!==$('bodyFrame').contentWindow)return;const d=event.data;if(!d||d.protocol!==BODY_PROTOCOL||d.id!==BODY_ID)return;
 if(d.type==='LIFE_AGENT_EVENT'&&d.event==='population_active_changed'){populationActivateContext(d.detail);return;}
 if(d.type==='LIFE_AGENT_READY'){if(state.startupFailure)return;state.bodyReady=true;state.bodyStartup={status:'ready',stage:'ready',message:'身体已就绪'};$('loadingText').textContent='身体已就绪，等待认知核心连接';state.capabilities=mergeCapabilities(d.capabilities);reasoner.setProfile(physicalProfile());renderCapabilities();updateBinding();(async()=>{await restoreAutosavedScene();state.capabilities=mergeCapabilities(await requestBody('capabilities'));reasoner.setProfile(physicalProfile());renderCapabilities();await loadEnvironmentEditor();await refreshBodyEvidence()})().catch(e=>state.errors.push(e.message));return}
 if(d.type==='LIFE_AGENT_RESPONSE'){const p=state.pending.get(d.requestId);if(!p)return;clearTimeout(p.timer);state.pending.delete(d.requestId);if(p.instanceId&&p.instanceId!==state.activeInstanceId||d.instanceId&&p.instanceId&&d.instanceId!==p.instanceId){p.reject(Error('身体响应来自其他人物，已忽略'));return;}d.ok?p.resolve(d.result):p.reject(Error(d.error||'身体请求失败'));return}
 if(d.instanceId&&state.activeInstanceId&&d.instanceId!==state.activeInstanceId)return;
 if(d.type==='LIFE_AGENT_HEARTBEAT'){state.heartbeat=d.state;renderSnapshot();renderControlMonitor();if(languageState.current)renderLanguage();return}
 if(d.type!=='LIFE_AGENT_EVENT')return;state.events.push(d);if(state.events.length>300)state.events.shift();
 if(d.event==='startup_progress'){updateBodyStartup(d.detail);return}
 if(d.event==='startup_failed'){showStartupFailure(d.detail);return}
 if(d.event==='character_changed'){
  commandArbiter.invalidate('人物体型已改变');languageState.inputEpoch++;languageState.modelAbort?.abort();
  languageState.confirmation=null;languageState.pending=null;languageState.reasoningStatus='character_changed';languageState.reasoningTrace=null;
  (async()=>{state.capabilities=mergeCapabilities(await requestBody('capabilities'));reasoner.setProfile(physicalProfile());renderCapabilities();updateBinding();await refreshBodyEvidence();renderControlMonitor();renderLanguage()})().catch(e=>state.errors.push(e.message));return;
 }
 if(d.event==='environment_changed'){languageState.confirmation=null;languageState.pending=null;languageState.reasoningStatus='world_changed';languageState.reasoningTrace=null;planner.context.lastObject=null;planner.context.lastTarget=null;loadEnvironmentEditor().then(async()=>{sceneStorageSet(SCENE_AUTOSAVE_KEY,state.environment.scene);state.capabilities=mergeCapabilities(await requestBody('capabilities'));reasoner.setProfile(physicalProfile());renderCapabilities();await refreshBodyEvidence();renderLanguage()}).catch(e=>state.errors.push(e.message));return}
 if(d.event==='environment_placement'){state.environment.placementId=d.detail?.active?d.detail.entityId:null;$('placementHint').classList.toggle('show',Boolean(d.detail?.active));if(d.detail?.placed)loadEnvironmentEditor().then(()=>sceneStorageSet(SCENE_AUTOSAVE_KEY,state.environment.scene)).catch(()=>{});if(d.detail?.error)toast(d.detail.error,'error');return}
 if(d.event==='runtime_error'){state.errors.push(d.detail.error);return}
 semanticFeedback(d);
}
