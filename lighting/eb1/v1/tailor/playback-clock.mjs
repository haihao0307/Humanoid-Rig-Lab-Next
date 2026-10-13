/** A presentation clock, not a physics integrator. Never changes cached states. */
export class PlaybackClock {
  constructor(fps, frameCount, speed=1) {
    if (!(fps>0) || !Number.isInteger(frameCount) || frameCount<1) throw Error('Invalid clip clock');
    this.fps=fps; this.lastFrame=frameCount-1; this.speed=speed;
    this.time=0; this.lastNow=null; this.limitedTicks=0; this.maxAdvanceFrames=3;
  }
  seek(frame) { this.time=Math.max(0,Math.min(this.lastFrame,frame))/this.fps; this.lastNow=null; }
  start(now) { this.lastNow=now; }
  advance(now) {
    if (this.lastNow===null) this.start(now);
    const elapsed=Math.max(0,(now-this.lastNow)/1000)*this.speed;
    this.lastNow=now;
    const cap=this.maxAdvanceFrames/this.fps;
    if(elapsed>cap) this.limitedTicks++;
    this.time=Math.min(this.lastFrame/this.fps,this.time+Math.min(elapsed,cap));
    return Math.min(this.lastFrame,Math.floor(this.time*this.fps+1e-7));
  }
  get frame(){return Math.min(this.lastFrame,Math.floor(this.time*this.fps+1e-7));}
  get finished(){return this.frame>=this.lastFrame;}
}
