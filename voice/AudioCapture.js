/* Jarvis audio capture 1.15.1. No speech recognition or scene vocabulary here.
 * PCM16 WAV uses the AudioContext's actual rate. No JS resampling, DSP, live
 * microphone monitoring, ScriptProcessorNode, or per-frame DOM work.
 * Native recorder is a separately labelled fallback, never relabelled as WAV.
 */
(function (root) {
 'use strict';
 function processorDefinition() {
  class JarvisPCM extends AudioWorkletProcessor {
   constructor(options) {
    super();
    const o=options.processorOptions||{};
    this.maxFrames=Math.max(1,Math.floor(o.maxFrames||sampleRate*90));
    this.capacity=4096;this.offset=0;this.frames=0;this.sequence=0;this.channels=0;
    this.blockStart=0;this.expectedFrame=null;this.gaps=0;this.channelChanges=0;this.invalid=0;
    this.sums=[0,0];this.peaks=[0,0];this.clips=[0,0];this.active=true;this.started=false;
    this.port.onmessage=e=>{if(e.data?.type==='stop')this.finish('manual');if(e.data?.type==='cancel'){this.active=false;this.buffer=null;}};
   }
   flush() {
    if(!this.offset)return;
    const pcm=this.offset===this.capacity?this.buffer:this.buffer.slice(0,this.offset*this.channels);
    this.port.postMessage({type:'chunk',sequence:this.sequence++,startFrame:this.frames-this.offset,
      frames:this.offset,channels:this.channels,pcm:pcm.buffer},[pcm.buffer]);
    this.buffer=new Int16Array(this.capacity*this.channels);this.offset=0;
   }
   finish(reason) {
    if(!this.active)return;this.active=false;this.flush();
    this.port.postMessage({type:'done',reason,frames:this.frames,sampleRate,channels:this.channels,
      chunks:this.sequence,missingFrames:this.gaps,channelChanges:this.channelChanges,invalidSamples:this.invalid,
      sums:this.sums,peaks:this.peaks,clips:this.clips});
   }
   process(inputs,outputs) {
    // Output silence even when connected to the destination to keep the graph alive.
    for(const output of outputs)for(const channel of output)channel.fill(0);
    if(!this.active)return false;
    const input=inputs[0]||[];
    const n=input[0]?.length||outputs[0]?.[0]?.length||128;
    if(!this.started){
     if(!input.length)return true;
     this.started=true;this.channels=Math.min(2,input.length);this.buffer=new Int16Array(this.capacity*this.channels);
     this.port.postMessage({type:'started',sampleRate,channels:this.channels,availableChannels:input.length});
    }
    if(this.expectedFrame!==null&&currentFrame!==this.expectedFrame)this.gaps+=Math.abs(currentFrame-this.expectedFrame);
    this.expectedFrame=currentFrame+n;
    if(input.length<this.channels)this.channelChanges++;
    for(let i=0;i<n&&this.frames<this.maxFrames;i++){
     for(let ch=0;ch<this.channels;ch++){
      let value=input[ch]?.[i]??0;
      if(!Number.isFinite(value)){this.invalid++;value=0;}
      this.sums[ch]+=value*value;this.peaks[ch]=Math.max(this.peaks[ch],Math.abs(value));
      if(Math.abs(value)>=.999)this.clips[ch]++;
      value=Math.max(-1,Math.min(1,value));
      this.buffer[this.offset*this.channels+ch]=Math.round(value<0?value*32768:value*32767);
     }
     this.offset++;this.frames++;
     if(this.offset===this.capacity)this.flush();
    }
    if(this.frames>=this.maxFrames)this.finish('limit');
    return this.active;
   }
  }
  registerProcessor('jarvis-pcm-v1151',JarvisPCM);
 }
 const workletSource='('+processorDefinition.toString()+')();';
 const VERSION='1.15.1';
 function constraints({deviceId='',profile='raw'}={}) {
  const audio={};
  if(deviceId)audio.deviceId={exact:deviceId};
  if(profile!=='browser')Object.assign(audio,{echoCancellation:profile==='speech',noiseSuppression:profile==='speech',autoGainControl:false});
  // Deliberately do not request sampleRate or channelCount. Inspect the result.
  return {audio:Object.keys(audio).length?audio:true,video:false};
 }
 function trackInfo(stream) {
  const t=stream.getAudioTracks()[0];if(!t)throw Error('没有音频输入轨道');
  const s=t.getSettings?.()||{};
  return {label:t.label||'浏览器未提供设备名称',sampleRate:s.sampleRate??null,channelCount:s.channelCount??null,
   echoCancellation:s.echoCancellation??null,noiseSuppression:s.noiseSuppression??null,
   autoGainControl:s.autoGainControl??null,readyState:t.readyState};
 }
 function wavHeader(frames,sampleRate) {
  if(!Number.isInteger(frames)||frames<0||!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>384000)throw Error('无效的PCM帧数或采样率');
  const b=new ArrayBuffer(44),d=new DataView(b),write=(p,s)=>{for(let i=0;i<s.length;i++)d.setUint8(p+i,s.charCodeAt(i));};
  write(0,'RIFF');d.setUint32(4,36+frames*2,true);write(8,'WAVE');write(12,'fmt ');d.setUint32(16,16,true);
  d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,sampleRate,true);d.setUint32(28,sampleRate*2,true);
  d.setUint16(32,2,true);d.setUint16(34,16,true);write(36,'data');d.setUint32(40,frames*2,true);return b;
 }
 function encodeWav(chunks,summary,{channel='auto'}={}) {
  const channels=summary.channels||1;
  let chosen=channel==='right'?1:channel==='left'?0:(channels>1&&summary.sums[1]>summary.sums[0]?1:0);
  if(chosen>=channels)chosen=0;
  const header=wavHeader(summary.frames,summary.sampleRate),parts=[header];let frames=0;
  // Explicit little-endian output. No sample-rate guess and no stereo downmix:
  // opposite-phase stereo inputs must not cancel each other.
  for(const item of chunks){const src=new Int16Array(item);const count=src.length/channels;
   if(!Number.isInteger(count))throw Error('PCM声道边界错误');
   const out=new ArrayBuffer(count*2),view=new DataView(out);
   for(let i=0;i<count;i++)view.setInt16(i*2,src[i*channels+chosen],true);
   parts.push(out);frames+=count;
  }
  if(frames!==summary.frames)throw Error('PCM样本总数与录音记录不一致，已阻止提交');
  return {blob:new Blob(parts,{type:'audio/wav'}),selectedChannel:chosen,frames};
 }
 function assess(meta) {
  const warnings=[];const ch=meta.selectedChannel||0,n=meta.frames||0;
  const rms=n&&meta.sums?Math.sqrt(meta.sums[ch]/n):null;
  const clippedFraction=n&&meta.clips?meta.clips[ch]/n:null;
  if(meta.missingFrames||meta.sequenceErrors||meta.invalidSamples||meta.channelChanges)warnings.push('音频连续性检查异常');
  if(meta.contextInterruptions)warnings.push('音频设备或时钟曾中断');
  if(rms!==null&&rms<.00012)warnings.push('录音接近静音');
  if(clippedFraction!==null&&clippedFraction>.01)warnings.push('录音存在削波，输入音量可能过大');
  if(meta.wallSeconds>.75&&Math.abs(meta.seconds-meta.wallSeconds)>Math.max(.3,meta.wallSeconds*.12))warnings.push('录音样本时长与计时时长存在较大差异');
  const unsafe=!!(meta.missingFrames||meta.sequenceErrors||meta.invalidSamples||meta.channelChanges||meta.contextInterruptions);
  return {...meta,rms,clippedFraction,warnings,unsafe,reviewRequired:warnings.length>0,
   qualityMeaning:'仅检查数字采样连续性、时长与幅度；不能据此判断是否为清晰的人声。'};
 }
 class Capture {
  constructor(options={}) {
   this.options={profile:'raw',mode:'pcm',channel:'auto',maxSeconds:90,maxBytes:20*1024*1024,...options};
   this.state='new';this.chunks=[];this.expected=0;this.sequence=0;this.sequenceErrors=0;this.contextInterruptions=0;
   this.finished=new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});
   // Lifecycle errors may happen while the UI still awaits permission.
   this.finished.catch(()=>{});
  }
  async start() {
   this.state='starting';const opts=this.options;
   try{
    this.stream=opts.stream||await navigator.mediaDevices.getUserMedia(constraints(opts));
    if(this.state==='cancelled'){this.close();throw new DOMException('已取消','AbortError');}
    this.device=trackInfo(this.stream);
    this.stream.getAudioTracks()[0].addEventListener('ended',()=>{if(this.state==='recording'){this.contextInterruptions++;this.stop().catch(()=>{});}});
    const AC=root.AudioContext||root.webkitAudioContext;
    this.ctx=null;this.outputRoute='none';
    if(AC){
     // A silent sink avoids opening a speaker output for microphone analysis.
     // This is optional; unsupported browsers retain an explicitly silent graph.
     if('setSinkId' in AC.prototype){try{this.ctx=new AC({latencyHint:'playback',sinkId:{type:'none'}});}catch{}}
     if(!this.ctx)this.ctx=new AC({latencyHint:'playback'});
     this.outputRoute=this.ctx.sinkId?.type==='none'?'silent-sink':'zero-output-graph';
    }
    if(this.ctx){await this.ctx.resume();if(this.state==='cancelled'){this.close();throw new DOMException('已取消','AbortError');}}
    this.startedAt=performance.now();
    if(opts.mode==='pcm'&&this.ctx?.audioWorklet&&typeof root.AudioWorkletNode==='function')await this.startPCM();
    else {this.fallback=opts.mode==='pcm'?'当前环境未开放AudioWorklet，已明确切换浏览器原生编码':null;this.startNative();}
    if(this.state==='cancelled'){this.close();throw new DOMException('已取消','AbortError');}
    this.wallTimer=setTimeout(()=>this.stop().catch(()=>{}),opts.maxSeconds*1000+500);
    return this;
   }catch(e){this.close();if(this.state!=='cancelled')this.state='error';this.reject(e);throw e;}
  }
  async startPCM() {
   const url=URL.createObjectURL(new Blob([workletSource],{type:'application/javascript'}));
   try{await this.ctx.audioWorklet.addModule(url);}finally{URL.revokeObjectURL(url);}
   if(this.state==='cancelled')throw new DOMException('已取消','AbortError');
   this.mode='pcm-wav';this.ctx.onstatechange=()=>{if(this.state==='recording'&&this.ctx.state!=='running'){
    this.contextInterruptions++;this.fail(Error('音频时钟中断，已停止本轮录音，请重新录制'));}};
   const maxFrames=Math.min(Math.floor(this.ctx.sampleRate*this.options.maxSeconds),Math.floor((this.options.maxBytes-44)/2));
   this.node=new AudioWorkletNode(this.ctx,'jarvis-pcm-v1151',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],
    channelCountMode:'max',channelInterpretation:'discrete',processorOptions:{maxFrames}});
   this.node.onprocessorerror=()=>this.fail(Error('录音处理线程异常，未提交损坏音频'));
   let readyResolve,readyReject;const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
   const timer=setTimeout(()=>readyReject(Error('音频线程未收到输入样本，请检查所选设备')),5000);
   this.node.port.onmessage=({data:d})=>{
    if(['cancelled','error','done'].includes(this.state))return;
    if(d.type==='started'){this.startedAt=performance.now();this.state='recording';this.availableChannels=d.availableChannels;clearTimeout(timer);readyResolve();}
    if(d.type==='chunk'){
     if(d.sequence!==this.sequence++||d.startFrame!==this.expected)this.sequenceErrors++;
     this.expected+=d.frames;this.chunks.push(d.pcm);
     const x=new Int16Array(d.pcm);let sum=0;for(let i=0;i<x.length;i++)sum+=(x[i]/32768)**2;
     this.options.onLevel?.(Math.sqrt(sum/Math.max(1,x.length)),this.expected/this.ctx.sampleRate);
    }
    if(d.type==='done'){
     clearTimeout(timer);clearTimeout(this.stopTimer);readyResolve();
     try{
      if(d.chunks!==this.sequence||d.frames!==this.expected)this.sequenceErrors++;
      const encoded=encodeWav(this.chunks,d,this.options);
      const meta=assess({...d,mode:this.mode,version:VERSION,profile:this.options.profile,device:this.device,
       selectedChannel:encoded.selectedChannel,availableChannels:this.availableChannels,
       sequenceErrors:this.sequenceErrors,contextInterruptions:this.contextInterruptions,outputRoute:this.outputRoute,
       seconds:d.frames/d.sampleRate,wallSeconds:(performance.now()-this.startedAt)/1000});
      this.complete(encoded.blob,meta);
     }catch(e){this.fail(e);}
    }
   };
   this.source=this.ctx.createMediaStreamSource(this.stream);this.source.connect(this.node);this.node.connect(this.ctx.destination);
   try{await ready;}finally{clearTimeout(timer);}
  }
  startNative() {
   if(typeof root.MediaRecorder!=='function')throw Error('当前浏览器不支持录音，请使用启动器打开支持录音的浏览器');
   this.mode='native-recorder';this.bytes=0;
   const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4','audio/webm'].find(x=>MediaRecorder.isTypeSupported(x));
   this.recorder=new MediaRecorder(this.stream,{...(mime?{mimeType:mime}:{}),audioBitsPerSecond:128000});
   this.recorder.ondataavailable=({data})=>{if(this.state==='cancelled'||!data.size)return;this.chunks.push(data);this.bytes+=data.size;if(this.bytes>this.options.maxBytes)this.stop().catch(()=>{});};
   this.recorder.onerror=()=>this.fail(Error('浏览器原生编码异常，请切换PCM录音'));
   this.recorder.onstop=()=>{
    if(this.state==='cancelled'||this.state==='error')return;clearTimeout(this.stopTimer);
    const seconds=(performance.now()-this.startedAt)/1000;
    const blob=new Blob(this.chunks,{type:this.recorder.mimeType||mime||'application/octet-stream'});
    this.complete(blob,{version:VERSION,mode:this.mode,profile:this.options.profile,device:this.device,seconds,
     wallSeconds:seconds,sampleRate:null,encodedMime:blob.type,frames:null,fallback:this.fallback,outputRoute:this.outputRoute,
     contextInterruptions:this.contextInterruptions,unsafe:!!this.contextInterruptions,reviewRequired:!!this.contextInterruptions,
     warnings:['浏览器原生编码模式，未进行逐样本连续性校验'],qualityMeaning:'回放原始编码，需人工听音确认；未伪装为PCM结果。'});
   };
   if(this.ctx){
    this.source=this.ctx.createMediaStreamSource(this.stream);this.analyser=this.ctx.createAnalyser();this.analyser.fftSize=512;
    this.source.connect(this.analyser);this.samples=new Float32Array(512);
    this.meterTimer=setInterval(()=>{this.analyser.getFloatTimeDomainData(this.samples);let sum=0;for(const x of this.samples)sum+=x*x;
     this.options.onLevel?.(Math.sqrt(sum/512),(performance.now()-this.startedAt)/1000);},150);
   }
   this.recorder.start(1000);this.state='recording';
  }
  stop() {
   if(this.state==='recording'){
    this.state='stopping';clearTimeout(this.wallTimer);
    this.stopTimer=setTimeout(()=>this.fail(Error('录音尾部保存超时，未将不完整音频提交为指令')),5000);
    if(this.mode==='pcm-wav')this.node.port.postMessage({type:'stop'});
    else if(this.recorder.state!=='inactive')this.recorder.stop();
   }else if(this.state==='starting')this.cancel();
   return this.finished;
  }
  complete(blob,meta) {
   if(['cancelled','error','done'].includes(this.state))return;
   this.state='done';this.result={blob,meta};this.chunks=[];this.close();this.resolve(this.result);
  }
  fail(error) {if(['cancelled','error','done'].includes(this.state))return;this.state='error';this.close();this.reject(error);}
  cancel() {
   if(['cancelled','done','error'].includes(this.state))return;
   this.state='cancelled';try{this.node?.port.postMessage({type:'cancel'});if(this.recorder?.state==='recording')this.recorder.stop();}catch{}
   this.chunks=[];this.close();this.reject(new DOMException('已取消本轮录音','AbortError'));
  }
  close() {
   clearTimeout(this.wallTimer);clearTimeout(this.stopTimer);clearInterval(this.meterTimer);
   if(this.ctx)this.ctx.onstatechange=null;
   try{this.source?.disconnect();this.node?.disconnect();this.analyser?.disconnect();}catch{}
   this.stream?.getTracks().forEach(t=>t.stop());
   if(this.ctx&&this.ctx.state!=='closed')this.ctx.close().catch(()=>{});
  }
 }
 root.JarvisAudioCapture=Object.freeze({VERSION,Capture,constraints,workletSource,encodeWav,wavHeader,assess,trackInfo});
})(typeof window!=='undefined'?window:globalThis);
