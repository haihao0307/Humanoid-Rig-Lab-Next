/* Local voice v1.15.1. AudioCapture isolates PCM on the audio rendering thread.
 * Native-rate PCM WAV -> same-origin binary endpoint -> local CPU decoder.
 * Manual stop defines the utterance; silence never ends it. Text shares submit().
 */
const VoiceInputPlugin=(()=>{
 const v=state.voice,settings={language:'zh-CN',engine:'local-service',autoSend:false,continuous:false,replyEnabled:false,deviceId:'',captureProfile:'raw',captureMode:'pcm',captureChannel:'auto'};
 const LIMITS=Object.freeze({maxRunMs:90000,maxBytes:20*1024*1024,requestMs:190000,permissionMs:20000});
 let run=null,generation=0,dispatchGeneration=0,sending=false,health=null,setupTimer=0,draftRevision=0;
 let saved=null,recordingURL='',lastResult=null,speaking=false,speechSequence=0,healthSequence=0;
 const events=[];
 const storeGet=(k,d)=>{try{return localStorage.getItem(k)??d}catch{return d}};
 const storeSet=(k,x)=>{try{localStorage.setItem(k,String(x))}catch{}};
 const record=(event,data={})=>{events.push({at:new Date().toISOString(),event,...data});if(events.length>80)events.shift();};
 const meaningful=t=>!!String(t||'').replace(/[\s，。！？、,.!?；;：:]+/g,'');
 const join=(a,b)=>[String(a||'').trim(),String(b||'').trim()].filter(Boolean).join('，');
 const localHost=()=>['127.0.0.1','localhost','::1'].includes(location.hostname);
 const supported=()=>!!navigator.mediaDevices?.getUserMedia&&(typeof MediaRecorder!=='undefined'||typeof AudioWorkletNode!=='undefined');
 function context(){const p=document.permissionsPolicy||document.featurePolicy;let allowed=null;try{allowed=p?.allowsFeature?.('microphone')??null}catch{}return {secureContext:window.isSecureContext||localHost(),embedded:window.top!==window.self,policyAllows:allowed,origin:location.origin};}
 function live(t,error=false){$('interimTranscript').textContent=t;$('voiceLive').classList.toggle('error',error);}
 function sync(status=v.status||'ready'){
  const capturing=run?.phase==='recording',busy=run?.phase==='transcribing'||run?.phase==='finalizing',active=!!run;
  Object.assign(v,context(),settings,{status,supported:supported(),listening:capturing,desired:active,processing:busy||sending,
   captureMode:run?.capture?.mode||saved?.meta?.mode||settings.captureMode,activeEngine:'faster-whisper-local',localAvailability:health?.status||'unchecked',
   recordedBytes:saved?.blob?.size||0,level:v.level||0,debugEvents:events.slice(-24)});
  const names={ready:'待命',checking:'检查本机服务',setup:'待安装模型',installing:'安装中',starting:'等待麦克风权限',
   listening:'正在录音',stopping:'保存录音',transcribing:'本机转写中',recorded:'录音已保留',review:'文字待确认',
   processing:'正在发送',error:'需要处理',unsupported:'无法录音'};
  $('voiceStatus').textContent=names[status]||status;$('voiceStatus').dataset.state=status;
  $('micBtn').classList.toggle('listening',capturing);$('micBtn').classList.toggle('processing',busy||sending);
  $('micBtn').setAttribute('aria-pressed',String(capturing));$('micBtn').disabled=!supported()||busy||sending;
  $('micButtonLabel').textContent=capturing?'结束并转写':busy?'本机转写中':'点击说话';
  $('voiceLive').classList.toggle('listening',capturing);$('voiceLive').classList.toggle('processing',busy||sending);
  for(const [key,id] of [['autoSend','autoSendBtn'],['replyEnabled','voiceReplyBtn']]){$(id).classList.toggle('active',settings[key]);$(id).setAttribute('aria-pressed',String(settings[key]));}
  $('voicePrivacy').querySelector('span').textContent='录音只发往本机服务，不上传云端。说完点击结束；停顿不会自动结束。默认确认文字后再执行。';
  const h=health||{},s=h.setup||{};if(h.model&&!$('voiceModel').dataset.touched)$('voiceModel').value=h.model;
  $('voiceEngineHint').textContent=h.status==='ready'?`本机引擎已安装 · ${h.model} · CPU INT8`:
   h.status==='installing'?'安装中：'+(s.stage||'准备安装')+(s.modelDirectoryBytes?' · 本地模型目录 '+(s.modelDirectoryBytes/1048576).toFixed(1)+' MiB':''):
   h.status==='unavailable'?'请用新版启动器打开本机页面。当前页面没有独立转写服务。':
   '首次使用需要安装本地语音模型。'+(s.error?' 上次未完成：'+s.error:'');
  $('voiceInstallLocal').hidden=h.status==='ready'&&$('voiceModel').value===h.model;$('voiceInstallLocal').disabled=h.status==='installing'||active;
  $('voiceSetupCancel').hidden=h.status!=='installing';$('voiceModel').disabled=h.status==='installing'||active;
  $('voiceRetry').disabled=!saved||active||sending;$('voiceDiscard').disabled=!saved||active;
  $('voiceUseTranscript').disabled=!lastResult?.text||!!lastResult?.inserted||active||sending;
  $('voiceTestRecord').disabled=active||sending;$('voiceDevice').disabled=active;
  for(const id of ['voiceCaptureProfile','voiceCaptureMode','voiceCaptureChannel'])$(id).disabled=active;
  $('voiceDownload').disabled=!saved||active;$('voiceAudioReport').disabled=!saved||active;
  $('voiceRecordingPanel').hidden=!saved;
  $('voiceEndRecord').hidden=!capturing;$('voiceEndRecord').textContent=run?.recordOnly?'结束测试录音':'结束并转写';$('voiceCancelRun').hidden=!active;$('voiceCancelInline').hidden=!active;
  $('voiceTranscriptPanel').hidden=!lastResult?.text;
  if(typeof renderCleanVoice==='function')renderCleanVoice();
 }
 async function api(path,{body,method='GET',headers={},signal,timeout=12000}={}){
  if(location.protocol==='file:'||!localHost())throw Error('请完整解压后使用启动器，从本机地址打开。此版本不通过公网转发录音。');
  const abort=new AbortController();const onAbort=()=>abort.abort();signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)abort.abort();
  const timer=setTimeout(()=>abort.abort(),timeout);
  try{
   const r=await fetch(path,{method,body,headers:{...(method==='POST'?{'X-Jarvis-Voice-Token':health?.token||''}:{}),...headers},signal:abort.signal,cache:'no-store'});
   const type=r.headers.get('content-type')||'';if(!type.includes('application/json'))throw Error('本机服务版本不匹配，请关闭旧启动器并启动新版');
   const data=await r.json();if(!r.ok){const e=Error(data.error||'本机语音请求失败');e.code=data.code;e.status=r.status;throw e;}return data;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
 }
 async function probeLocal(){
  const seq=++healthSequence;
  try{const next=await api('/api/voice/status');if(seq!==healthSequence)return health;if(next.schema!=='jarvis/local_voice_status@1')throw Error('语音接口版本不匹配');health=next;}
  catch(e){if(seq!==healthSequence)return health;health={status:'unavailable',error:e.message};}
  if(!run&&!sending)sync(health.status==='installing'?'installing':health.status==='ready'?'ready':'setup');else sync();
  clearTimeout(setupTimer);if(health.status==='installing')setupTimer=setTimeout(probeLocal,1600);return health;
 }
 async function installLocal(){
  if(run)return false;
  const model=$('voiceModel').value,mb={tiny:76,base:145,small:484}[model];
  if(!confirm(`安装本地 ${model} 语音引擎？\n模型约 ${mb} MB，另需下载CPU识别组件并占用额外磁盘。只从 PyPI 与 Hugging Face 下载；安装完成后转写在本机进行。\n这会创建独立的用户级环境，不修改系统Python。`))return false;
  try{await probeLocal();if(!health.token)throw Error('新版本机服务未连接');health=await api('/api/voice/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,consent:'download-local-model'})});sync('installing');live('正在安装本机语音组件，可在语音设置查看进度。');probeLocal();return true;}
  catch(e){sync('error');live(e.message,true);return false;}
 }
 async function cancelSetup(){try{health=await api('/api/voice/setup-cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});sync('setup');live('已取消模型安装，录音与文字不会被提交。');}catch(e){live(e.message,true);}}
 function explain(e){return ({NotAllowedError:'麦克风权限被拒绝。请在地址栏允许麦克风后重试。',NotFoundError:'没有找到麦克风，请接好输入设备。',NotReadableError:'麦克风被占用或无法读取，请关闭占用它的软件。',OverconstrainedError:'所选麦克风已经不可用，请重新选择输入设备。',AbortError:'本机转写超时或已取消。原录音仍可回放、重试。'})[e.name]||e.message||String(e);}
 function current(r){return run===r&&r.generation===generation&&!r.cancelled;}
 function cleanupCapture(r){clearInterval(r.timer);clearTimeout(r.permissionTimer);r.capture?.cancel();v.level=0;}
 function release(r,status='ready'){cleanupCapture(r);$('voiceElapsed').textContent=saved?'录音已结束 · '+saved.seconds.toFixed(1)+' 秒':'未开启麦克风';const c=$('voiceMeter').getContext('2d');c?.clearRect(0,0,520,36);if(run===r)run=null;r.resolve?.();sync(status);}
 function discardRecording(){if(run)return;URL.revokeObjectURL(recordingURL);recordingURL='';saved=null;lastResult=null;$('voicePlayback').removeAttribute('src');$('voicePlayback').load();$('voiceTranscript').value='';sync();}
 function saveRecording(r,blob,meta){
  URL.revokeObjectURL(recordingURL);saved={blob,inputId:r.inputId,language:r.language,seconds:meta.seconds,meta,interrupted:!!r.interrupted};
  recordingURL=URL.createObjectURL(blob);$('voicePlayback').src=recordingURL;$('voicePlayback').playbackRate=1;$('voicePlayback').defaultPlaybackRate=1;
  $('voiceRecordingInfo').textContent=`${meta.mode==='pcm-wav'?'PCM WAV 原声':'浏览器原生编码'} · ${saved.seconds.toFixed(2)} 秒 · ${meta.sampleRate?meta.sampleRate+' Hz · ':''}${(blob.size/1024).toFixed(1)} KiB`;
  $('voiceCaptureDetails').textContent=`实际设备：${meta.device.label}。回声消除 ${meta.device.echoCancellation??'未报告'}，降噪 ${meta.device.noiseSuppression??'未报告'}，自动增益 ${meta.device.autoGainControl??'未报告'}。${meta.mode==='pcm-wav'?'保存声道 '+(meta.selectedChannel+1)+'，连续性异常 '+(meta.missingFrames+meta.sequenceErrors+meta.channelChanges+meta.invalidSamples)+'。':''}${meta.warnings?.join('；')||'数字采样检查通过，仍需听音确认。'}`;
 }
 function meter(r){
  if(!current(r)||r.phase!=='recording')return;
  const elapsed=performance.now()-r.started;v.elapsedMs=elapsed;
  r.peak=Math.max(r.peak,v.level||0);
  const text=`录音 ${Math.floor(elapsed/1000)} 秒 · ${v.level>.004?'检测到声音':elapsed>3500&&r.peak<.004?'音量很低，请检查麦克风':'正在收音'} · 说完点击结束`;
  live(text);if($('voiceElapsed'))$('voiceElapsed').textContent=text;
  const canvas=$('voiceMeter');if(canvas.getClientRects().length){const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.fillStyle='#17303d';c.fillRect(0,10,canvas.width,14);c.fillStyle='#59c5c3';c.fillRect(0,10,canvas.width*Math.min(1,Math.sqrt(v.level||0)*3),14);}
  if(elapsed>=LIMITS.maxRunMs)finishCapture(r,{reason:'limit'});
 }
 async function start({recordOnly=false}={}){
  if(run||sending)return false;
  if(!supported()||!context().secureContext||context().policyAllows===false){sync('unsupported');live('当前页面无法取得麦克风。请使用启动器打开并允许录音。',true);return false;}
  const r={inputId:uid('voice_input'),generation:++generation,phase:'checking',cancelled:false,recordOnly,
   chunks:[],bytes:0,peak:0,language:settings.language,draftRevision,baseText:$('commandInput').value,baseId:$('commandInput').dataset.inputId||'',started:performance.now()};
  r.ended=new Promise(resolve=>r.resolve=resolve);run=r;sync('checking');
  try{
   if(!recordOnly){await probeLocal();if(!current(r))return false;if(health.status!=='ready'){release(r,'setup');live('先安装本地语音引擎。也可以用“测试麦克风”录音回放，单独检查收音。',true);if(typeof openCleanUtility==='function')openCleanUtility('voice');return false;}}
   r.phase='starting';sync('starting');live('请允许麦克风，授权完成后才开始计时。');
   $('voicePlayback').pause();speechSequence++;speaking=false;window.speechSynthesis?.cancel();window.dispatchEvent(new CustomEvent('jarvis-tts-state',{detail:{speaking:false}}));
   r.permissionTimer=setTimeout(()=>{if(current(r)&&r.phase==='starting'){cancel('麦克风授权等待超过20秒。尚未录音，可处理权限后重试。');}},LIMITS.permissionMs);
   r.capture=new JarvisAudioCapture.Capture({profile:settings.captureProfile,mode:settings.captureMode,
    channel:settings.captureChannel,deviceId:settings.deviceId,maxSeconds:LIMITS.maxRunMs/1000,maxBytes:LIMITS.maxBytes,
    onLevel:level=>{if(current(r))v.level=level;}});
   r.capture.finished.then(result=>captureEnded(r,result)).catch(e=>{if(current(r)){
    release(r,'error');v.lastError={code:e.name,message:explain(e)};live(explain(e),true);}});
   await r.capture.start();
   if(!current(r)){r.capture.cancel();return false;}clearTimeout(r.permissionTimer);
   r.phase='recording';r.started=performance.now();r.timer=setInterval(()=>meter(r),180);sync('listening');meter(r);
   $('voiceCaptureDetails').textContent=`实际设备：${r.capture.device.label} · ${r.capture.mode==='pcm-wav'?'PCM WAV 原声采集':'浏览器原生编码'}。${r.capture.fallback||''}`;
   record('recorder_started',{id:r.inputId,mode:r.capture.mode,profile:settings.captureProfile,device:r.capture.device});
   enumerateDevices();return true;
  }catch(e){if(current(r)){release(r,'error');v.lastError={code:e.name,message:explain(e)};live(explain(e),true);}return false;}
 }
 function finishCapture(r,{reason='manual'}={}){
  if(!current(r)||!['recording','starting'].includes(r.phase))return r.ended;
  if(!r.capture||r.capture.state==='starting'){cancel('已取消尚未开始的录音');return r.ended;}
  r.phase='finalizing';r.stopReason=reason;clearInterval(r.timer);sync('stopping');live('正在保存本轮录音…');
  r.capture.stop().catch(()=>{});
  return r.ended;
 }
 async function captureEnded(r,{blob,meta}){
  if(!current(r)||r.captureEnded)return;r.captureEnded=true;cleanupCapture(r);
  if(meta.reason==='limit')r.stopReason='limit';
  if(blob.size<32){release(r,'error');live('没有收到有效录音，请检查输入设备。',true);return;}
  saveRecording(r,blob,meta);record('recording_saved',{id:r.inputId,bytes:blob.size,reason:r.stopReason});
  if(blob.size>LIMITS.maxBytes){release(r,'recorded');live('本轮录音超过限制，已保留供回放。请重新录制短一些。',true);return;}
  if(meta.unsafe){release(r,'recorded');live('录音连续性检查异常，已保留供回放和导出，本轮不会转写或执行。请在无三维录音检查页对照。',true);return;}
  if(r.recordOnly||r.interrupted){release(r,'recorded');live(r.interrupted?'录音被中断，已保留供回放；不会自动执行。':'麦克风测试录音已保留，请在语音设置中回放。');return;}
  await transcribe(r,blob);
 }
 async function transcribe(r,blob){
  if(!current(r))return;r.phase='transcribing';r.abort=new AbortController();sync('transcribing');live('已结束录音，正在本机转写。可点击取消或停止全部。');
  try{
   const result=await api('/api/voice/transcribe',{method:'POST',body:blob,signal:r.abort.signal,timeout:LIMITS.requestMs,
    headers:{'Content-Type':blob.type||'application/octet-stream','X-Input-Id':r.inputId,'X-Voice-Language':r.language}});
   if(!current(r)||result.inputId!==r.inputId){if(current(r))throw Error('转写输入编号不匹配，未采用结果');return;}
   result.reviewRequired=!!result.reviewRequired||!!saved?.meta?.reviewRequired;
   const text=String(result.text||'').trim();lastResult=result;$('voiceTranscript').value=text;v.lastTranscript=text;v.lastConfidence=null;v.lastError=null;
   if(!meaningful(text)){release(r,'recorded');live('录音已完成，未识别出有效语音。请回放检查，必要时重试或切换更大模型。',true);record('empty_transcript',{id:r.inputId});return;}
   const unedited=r.draftRevision===draftRevision&&$('commandInput').value===r.baseText;
   if(unedited){result.inserted=true;const input=$('commandInput');input.value=join(r.baseText,text);input.dataset.inputModality='voice';input.dataset.inputId=r.inputId;$('voiceInputBadge').textContent='VOICE REVIEW';}
   release(r,'review');record('transcript_received',{id:r.inputId,characters:text.length,reviewRequired:!!result.reviewRequired,draftUnchanged:unedited});
   live(unedited?'转写已填入输入框，请检查后发送。':'已转写；当前文字草稿有修改，未覆盖。语音设置中可查看和插入。');
   if(settings.autoSend&&unedited&&!r.baseText.trim()&&!result.reviewRequired&&!r.retry&&!sending)dispatch();
  }catch(e){if(!current(r))return;release(r,'error');v.lastError={code:e.code||e.name,message:explain(e)};live(explain(e)+' 原录音已保留，可回放或重试。',true);record('transcription_error',{id:r.inputId,code:e.code||e.name});}
 }
 async function retry(){
  if(!saved||run||sending)return false;if(saved.meta?.unsafe){live('这段录音的连续性检查异常，请重新录音，未提交旧音频。',true);return false;}const recording=saved;
  const r={inputId:uid('voice_retry'),generation:++generation,phase:'checking',retry:true,language:recording.language,
   draftRevision,baseText:$('commandInput').value,baseId:$('commandInput').dataset.inputId||'',cancelled:false};
  r.ended=new Promise(resolve=>r.resolve=resolve);run=r;sync('checking');
  await probeLocal();if(!current(r))return false;
  if(health?.status!=='ready'){release(r,'setup');live('请先完成本地引擎安装。录音仍在本页保留。',true);return false;}
  await transcribe(r,recording.blob);return true;
 }
 function cancel(message='已取消本轮收音或转写。已有文字与已完成录音保留，不会触发旧动作。'){
  generation++;dispatchGeneration++;speechSequence++;speaking=false;window.speechSynthesis?.cancel();window.dispatchEvent(new CustomEvent('jarvis-tts-state',{detail:{speaking:false}}));const r=run;
  if(r){r.cancelled=true;r.abort?.abort();r.capture?.cancel();cleanupCapture(r);run=null;r.resolve?.();
   if(health?.token)api('/api/voice/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({inputId:r.inputId}),timeout:8000}).catch(()=>{});
   record('run_cancelled',{id:r.inputId});}
  sync('ready');live(message);return Promise.resolve();
 }
 function stop({abort=false}={}){if(abort)return cancel();if(!run)return Promise.resolve();if(run.phase==='checking'||(run.phase==='starting'))return cancel();if(run.phase==='transcribing')return cancel();return finishCapture(run)||run?.ended||Promise.resolve();}
 function toggle(){return run?stop():start();}
 async function dispatch(){
  if(sending)return false;sending=true;const token=dispatchGeneration;
  if(run){const r=run;if(r.phase==='recording')finishCapture(r);else if(r.phase==='checking'||r.phase==='starting')cancel();await r.ended;}
  if(token!==dispatchGeneration){sending=false;sync('ready');return false;}
  const input=$('commandInput'),text=input.value.trim(),inputId=input.dataset.inputId||uid('text_input'),modality=input.dataset.inputModality==='voice'?'voice':'text';
  if(!meaningful(text)){sending=false;sync('ready');live('没有可发送的文字。');return false;}
  input.dataset.inputId=inputId;sync('processing');
  try{const result=await submit(text,state.mode,{modality,inputId,recognitionConfidence:null});
   if(result?.stale||token!==dispatchGeneration){live('本轮已被停止，文字保留。');return false;}
   if(input.value.trim()===text&&input.dataset.inputId===inputId){input.value='';input.dataset.inputId='';input.dataset.inputModality='text';draftRevision++;}
   $('voiceInputBadge').textContent='TEXT INPUT';record('dispatch_complete',{inputId,modality});live('已发送。');return true;
  }catch(e){live('发送失败，文字已保留：'+e.message,true);return false;}finally{sending=false;sync('ready');}
 }
 async function enumerateDevices(){try{const list=await navigator.mediaDevices.enumerateDevices();const select=$('voiceDevice');select.replaceChildren(new Option('系统默认麦克风',''));for(const d of list.filter(d=>d.kind==='audioinput'&&d.deviceId!=='default'))select.append(new Option(d.label||'麦克风 '+(select.options.length),d.deviceId));if(settings.deviceId&&!list.some(d=>d.deviceId===settings.deviceId))select.append(new Option('此前所选设备当前不可用',settings.deviceId));select.value=settings.deviceId;}catch{}}
 function downloadRecording(){if(!saved||run)return;const a=document.createElement('a');a.href=recordingURL;
  const ext=saved.blob.type.includes('wav')?'wav':saved.blob.type.includes('mp4')?'m4a':saved.blob.type.includes('ogg')?'ogg':'webm';
  a.download='Jarvis-recording-'+saved.inputId+'.'+ext;a.click();}
 function downloadAudioReport(){if(!saved||run)return;const blob=new Blob([JSON.stringify({version:'1.15.1',...saved.meta,
  bytes:saved.blob.size,mime:saved.blob.type,realSpeechClarityVerified:false},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Jarvis-audio-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function useTranscript(){if(!lastResult?.text||lastResult.inserted||run)return;lastResult.inserted=true;const input=$('commandInput');input.value=join(input.value,lastResult.text);input.dataset.inputModality='voice';input.dataset.inputId=uid('voice_review');draftRevision++;if(typeof closeCleanUtility==='function')closeCleanUtility();input.focus();live('转写文字已插入，请检查后发送。');}
 function setLanguage(language){cancel();settings.language=['zh-CN','zh-TW','en-US'].includes(language)?language:'zh-CN';storeSet('jarvis.voice.lang',settings.language);sync();}
 function openDiagnostic(){cancel();if(typeof openCleanUtility==='function')openCleanUtility('voice');return true;}
 function openStandalone(){cancel();return !!window.open(new URL('index.html?standaloneVoice=1',location.href),'jarvis_voice_window');}
 function systemDictation(){cancel();$('commandInput').focus();live('也可以使用操作系统听写，将文字输入此处后发送。');}
 function speak(text){
  if(!settings.replyEnabled||state.lastInputModality!=='voice'||!text||!window.speechSynthesis||run)return;
  speaking=true;const token=++speechSequence;const u=new SpeechSynthesisUtterance(String(text));u.lang=settings.language;u.rate=.96;
  u.onstart=()=>{if(token===speechSequence)window.dispatchEvent(new CustomEvent('jarvis-tts-state',{detail:{speaking:true}}));};
  u.onend=u.onerror=()=>{if(token!==speechSequence)return;speaking=false;window.dispatchEvent(new CustomEvent('jarvis-tts-state',{detail:{speaking:false}}));};
  speechSynthesis.cancel();speechSynthesis.speak(u);
 }
 function init(){
  settings.autoSend=storeGet('jarvis.voice.autoSend.v1150','false')==='true';settings.replyEnabled=storeGet('jarvis.voice.reply','false')==='true';
  settings.language=storeGet('jarvis.voice.lang','zh-CN');if(!['zh-CN','zh-TW','en-US'].includes(settings.language))settings.language='zh-CN';
  settings.deviceId=storeGet('jarvis.voice.device.v1150','');$('voiceLanguage').value=settings.language;
  settings.captureProfile=storeGet('jarvis.voice.captureProfile.v1151','raw');if(!['raw','speech','browser'].includes(settings.captureProfile))settings.captureProfile='raw';
  $('voiceCaptureProfile').value=settings.captureProfile;$('voiceCaptureMode').value=settings.captureMode;$('voiceCaptureChannel').value=settings.captureChannel;
  $('voiceCaptureProfile').onchange=e=>{settings.captureProfile=e.target.value;storeSet('jarvis.voice.captureProfile.v1151',settings.captureProfile);};
  $('voiceCaptureMode').onchange=e=>settings.captureMode=e.target.value;$('voiceCaptureChannel').onchange=e=>settings.captureChannel=e.target.value;
  $('voiceDownload').onclick=downloadRecording;$('voiceAudioReport').onclick=downloadAudioReport;
  $('voiceIsolatedTest').onclick=()=>{cancel();window.open(new URL('audio-check.html',location.href),'jarvis_audio_check');};
  $('micBtn').onclick=toggle;$('voiceInstallLocal').onclick=installLocal;$('voiceSetupCancel').onclick=cancelSetup;
  $('voiceTestRecord').onclick=()=>start({recordOnly:true});$('voiceEndRecord').onclick=()=>stop();$('voiceRetry').onclick=retry;$('voiceDiscard').onclick=discardRecording;
  $('voiceUseTranscript').onclick=useTranscript;$('voiceCancelRun').onclick=()=>cancel();$('voiceCancelInline').onclick=()=>cancel();
  $('voiceLanguage').onchange=e=>setLanguage(e.target.value);
  $('voiceDevice').onchange=e=>{cancel();settings.deviceId=e.target.value;storeSet('jarvis.voice.device.v1150',settings.deviceId);};
  $('voiceRefresh').onclick=()=>{probeLocal();enumerateDevices();};
  $('autoSendBtn').onclick=()=>{settings.autoSend=!settings.autoSend;storeSet('jarvis.voice.autoSend.v1150',settings.autoSend);sync();};
  $('voiceReplyBtn').onclick=()=>{settings.replyEnabled=!settings.replyEnabled;storeSet('jarvis.voice.reply',settings.replyEnabled);sync();};
  $('voiceModel').onchange=()=>{$('voiceModel').dataset.touched='1';$('voiceInstallLocal').hidden=false;$('voiceInstallLocal').textContent='安装所选模型';};
  $('voiceDiagTopBtn')?.addEventListener('click',openDiagnostic);
  $('commandInput').addEventListener('input',()=>{draftRevision++;$('commandInput').dataset.inputModality='text';$('commandInput').dataset.inputId=uid('text_input');});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();emergencyStop().catch(()=>{});}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&run){const r=run;if(r.phase==='recording'){r.recordOnly=true;r.interrupted=true;finishCapture(r,{reason:'hidden'});}else cancel('页面进入后台，本轮已取消，旧结果不会自动执行。');}});
  addEventListener('beforeunload',()=>{cancel();URL.revokeObjectURL(recordingURL);});
  navigator.mediaDevices?.addEventListener?.('devicechange',enumerateDevices);
  navigator.permissions?.query({name:'microphone'}).then(p=>{v.permission=p.state;p.onchange=()=>{v.permission=p.state;if(p.state==='denied')cancel('麦克风权限已撤回，已停止收音。');};}).catch(()=>{});
  sync('checking');probeLocal();enumerateDevices();
 }
 speakJarvisResponse=speak;
 return {init,start,stop,toggle,dispatch,retry,installLocal,probeLocal,openDiagnostic,openStandalone,setLanguage,systemDictation,
  get state(){return {...v,debugEvents:events.slice(-24)};},diagnostics:()=>({...context(),version:'1.15.1',limits:LIMITS,
   localAvailability:health?.status||'unchecked',model:health?.model||null,hasSavedRecording:!!saved,
   recordedBytes:saved?.blob.size||0,audio:saved?.meta||null,events:events.slice(-24)})};
})();
