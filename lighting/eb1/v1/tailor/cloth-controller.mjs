import {PlaybackClock} from './playback-clock.mjs';
import {NativeMotion}from './native-motion.mjs';
import {recipeKey,decodeClip,clipRows}from './motion-cache.mjs';
import {sha}from './source-contract.mjs';
let cacheIndexPromise=null;
export class ClothController{
 constructor({onFrame,onError,onProgress}){this.worker=new Worker(new URL('./cloth-worker.mjs',import.meta.url),{type:'module'});this.sequence=0;this.pending=new Map();this.running=false;this.dead=false;this.onFrame=onFrame;this.onError=onError;this.onProgress=onProgress;this.rows=[];this.clipCache=new Map();this.frame=null;this.playToken=0;
 this.worker.onmessage=({data:d})=>{if(this.dead)return;const task=this.pending.get(d.id);if(d.progress!==undefined){this.onProgress?.(d.progress,d.phase);return;}if(!task)return;this.pending.delete(d.id);if(d.error){this.running=false;task.reject(Error(d.error));return;}if(d.clip){task.resolve(d.clip);return;}this.rows=d.rows;this.frame=d;this.onFrame?.(d.rows,d);task.resolve(d.rows);};this.worker.onerror=e=>{this.running=false;for(const task of this.pending.values())task.reject(Error(e.message));this.pending.clear();onError?.(Error(e.message));};}
 command(command,data={}){if(this.dead)return Promise.reject(Error('Disposed cloth controller'));const id=++this.sequence;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({id,command,...data});});}
 async init(rows,lock,settings,actor,context={}){this.inputRows=rows;this.settings={...settings};this.recipe=recipeKey(rows,settings);this.nativeMotion=new NativeMotion(actor);this.look=context.look;return this.command('init',{rows,lock,settings,actor});}
 pause(){this.running=false;this.playToken++;if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;}
 async ensureLive(){if(this.fromCache){this.fromCache=false;await this.command('reset');}}
 play(){if(this.running||this.dead)return;this.pause();this.running=true;const token=this.playToken;const next=async()=>{if(!this.running||this.dead||token!==this.playToken)return;try{await this.ensureLive();await this.command('step');if(this.running)setTimeout(next,10);}catch(e){this.running=false;this.onError?.(e);}};void next();}
 async settle(seconds=.5){this.pause();await this.ensureLive();return this.command('settle',{seconds});}
 async tug(){this.pause();await this.ensureLive();await this.command('tug');this.play();}
 async reset(){this.pause();this.fromCache=false;this.activeClip=null;this.clock=null;this.replayRows=null;return this.command('reset');}
 async set(settings){this.pause();await this.ensureLive();this.settings={...this.settings,...settings};this.recipe=recipeKey(this.inputRows,this.settings);this.clipCache.clear();return this.command('settings',{settings});}
 async playMotion(id){if(!['raise','twist','step'].includes(id))throw Error('未知人物动作');this.pause();const token=this.playToken;this.baking=true;
 try{let clip=this.clipCache.get(id);if(!clip){cacheIndexPromise??=fetch(new URL('./clips/index.json',import.meta.url)).then(r=>r.ok?r.json():{clips:[]}).catch(()=>({clips:[]}));const index=await cacheIndexPromise,entry=index.clips.find(e=>e.look===this.look&&e.motion===id&&e.recipe===this.recipe);
 if(entry){this.onProgress?.(0,'载入已经实算的动作');const response=await fetch(new URL('./clips/'+entry.file,import.meta.url));if(!response.ok)throw Error('动作缓存加载失败');const bytes=await response.arrayBuffer();if(await sha(bytes)!==entry.sha256)throw Error('动作缓存哈希不符');const raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();clip=decodeClip(raw);}
 else{this.fromCache=false;clip=decodeClip(await this.command('bake',{motion:id}));}
 if(clip.header.recipe!==this.recipe||!clip.header.proof?.passed)throw Error('动作与当前材料参数不匹配');this.clipCache.set(id,clip);}
 if(token!==this.playToken||this.dead){this.baking=false;return false;}
 this.activeClip=clip;this.replayRows=null;this.fromCache=true;this.baking=false;
 this.clock=new PlaybackClock(clip.header.fps,clip.header.frameCount,this.playbackSpeed||1);
 this.presentMotionFrame(0);this.resumeMotion();return true;
 }catch(e){this.running=false;this.baking=false;this.onError?.(e);throw e;}}
 presentMotionFrame(frame){
 const clip=this.activeClip;if(!clip)throw Error('尚无已计算动作');
 frame=Math.min(clip.header.frameCount-1,Math.max(0,frame|0));
 const rows=clipRows(clip,frame,this.replayRows);this.replayRows=rows;
 this.nativeMotion.at(clip.header.motion,frame/clip.header.fps);this.rows=rows;this.fromCache=true;
 this.frame={rows,body:Float32Array.from(this.nativeMotion.native),audit:{motion:clip.header.motion,motionTime:frame/clip.header.fps,frameSequence:frame,bodyFrameMatchesCloth:true,nativeRig:this.nativeMotion.audit(),cachedPhysicalReplay:true,clipProof:clip.header.proof,quantisationMM:clip.header.maxQuantisationErrorMM,presentationClock:'bounded-advance, no physics interpolation',maximumFrameJump:3,presentationLimitedTicks:this.clock?.limitedTicks||0,playbackSpeed:this.playbackSpeed||1}};
 this.presentationReady=Promise.resolve(this.onFrame?.(rows,this.frame));return this.frame.audit;
 }
 resumeMotion(){
 if(!this.activeClip||!this.fromCache||this.dead||this.baking)return false;
 this.pause();const token=this.playToken,clip=this.activeClip;
 this.clock??=new PlaybackClock(clip.header.fps,clip.header.frameCount,this.playbackSpeed||1);
 if(this.clock.finished)this.clock.seek(0);
 this.clock.speed=this.playbackSpeed||1;this.clock.start(performance.now());this.running=true;
 let previous=this.frame?.audit?.frameSequence??-1;
 const tick=async now=>{if(!this.running||this.dead||token!==this.playToken)return;
 try{
 if(await this.presentationReady===false)throw Error('画面提交未完成，人物动作已暂停');
 if(!this.running||this.dead||token!==this.playToken)return;
 const frame=this.clock.advance(performance.now());if(frame!==previous){this.presentMotionFrame(frame);previous=frame;if(await this.presentationReady===false)throw Error('画面提交未完成，人物动作已暂停');}
 if(!this.running||this.dead||token!==this.playToken)return;
 if(!this.clock.finished)this.raf=requestAnimationFrame(tick);else{this.running=false;this.onProgress?.(1,'人物动作播放完成');}
 }catch(error){this.pause();this.onError?.(error);}};
 this.raf=requestAnimationFrame(tick);return true;
 }
 setPlaybackSpeed(speed){speed=Number(speed);if(![.25,.5,1].includes(speed))throw Error('Unsupported playback speed');this.playbackSpeed=speed;if(this.clock){this.clock.speed=speed;this.clock.start(performance.now());}}
 seekMotionFrame(frame){this.pause();if(!this.activeClip)throw Error('尚无已计算动作');const h=this.activeClip.header;this.clock??=new PlaybackClock(h.fps,h.frameCount);this.clock.seek(frame);return this.presentMotionFrame(this.clock.frame);}

 dispose(){this.pause();this.dead=true;this.worker.terminate();this.clipCache.clear();for(const task of this.pending.values())task.reject(new DOMException('Superseded','AbortError'));this.pending.clear();}
}
