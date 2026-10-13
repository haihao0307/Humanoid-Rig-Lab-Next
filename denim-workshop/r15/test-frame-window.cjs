'use strict';
const A=require('node:assert/strict'),fs=require('fs'),path=require('path'),create=require('./frame-metrics.js').create;
let time=0;const m=create(()=>time);m.reset();time=29000;
for(let i=0;i<60;i++){time=29000+(i+1)*1000/60;m.submit(i+1,i+1,(i+1)/240,1);m.complete();}
let r=m.report(30);A.equal(r.windowSeconds,30);A.equal(r.completedFrames,60);A.equal(r.fps,2);A.ok(r.activeSpanFPS>59.9);A.equal(r.includesStartupAndStalledTail,true);
time=35000;r=m.report(30);A.equal(r.fps,2);A.equal(r.currentNoFrameMs,5000);m.reset();time+=10000;A.equal(m.report(30).fps,0);A.equal(m.report(30).windowSeconds,10);
fs.writeFileSync(path.join(__dirname,'FRAME_WINDOW_QA.json'),JSON.stringify({passed:true,checks:['29 second startup stall + 60 frames in final second reports 2FPS, not 60','Stalled tail included in window duration','Idle callbacks cannot create frames','Reset begins a new wall-clock interval'],notCompositorMeasurement:true},null,2));console.log('PASS full wall-window FPS includes startup and stall');
