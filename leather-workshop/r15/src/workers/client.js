/** R10 input is latest-wins; solver scheduling is independent of rendering.
 * Only completed physical poses are displayed. No extrapolated/rigid fallback.
 */
class ProductWorkerShell {
 constructor(data,options={}){
  const base=new ProductShell(data,options);this.x=base.x.slice();this.rest=base.rest.slice();this.inv=base.inv.slice();this.cfg={...base.cfg};this._report=base.report();this._active=false;this.failed=null;this.grab=null;this.testing=false;this.busy=false;this.disposed=false;this.sequence=0;this.pending=new Map();this.speed=0;this.pendingPose=false;this.inputSequence=0;this.inputEpoch=0;this.inputQueued=false;this.inputLatencyMS=0;this.lastInputAt=0;this.lastMeasuredSequence=-1;this.receivedPoses=0;this.appliedPoses=0;
  const url=URL.createObjectURL(new Blob([PRODUCT_WORKER_CODE],{type:'text/javascript'}));this.worker=new Worker(url);URL.revokeObjectURL(url);
  this.worker.onerror=e=>{this.failed=e.message;this._active=false;this.onError?.(Error(e.message));};
  this.worker.onmessage=e=>{if(this.disposed)return;const r=e.data,p=this.pending.get(r.id);if(p)this.pending.delete(r.id);
   if(r.error){this.failed=r.error;this._active=false;p?.reject(Error(r.error));this.onError?.(Error(r.error));return;}
   if(r.report){this._report=r.report;this.failed=r.report.failed;this.speed=r.speed??this.speed;}
   if(r.positions){this.x.set(r.positions);this.pendingPose=true;this.receivedPoses++;if(r.inputSequence===this.inputSequence&&this.lastInputAt&&this.lastMeasuredSequence!==r.inputSequence){this.inputLatencyMS=performance.now()-this.lastInputAt;this.lastMeasuredSequence=r.inputSequence;}if(r.poseSerial)this.worker.postMessage({op:'poseAck',serial:r.poseSerial});}
   p?.resolve(r.result??r.report??{ack:true});
  };this.ready=this.ask('init',{data,options});
 }
 get active(){return this._active;}
 set active(value){if(this._active===!!value)return;this._active=!!value;if(this.worker&&!this.disposed)this.ask('active',{value:this._active}).catch(e=>this.onError?.(e));}
 ask(op,data={}){if(this.disposed)return Promise.reject(Error('Disposed product solver'));const id=++this.sequence;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({id,op,...data});});}
 flushPose(){if(!this.pendingPose)return;this.pendingPose=false;this.appliedPoses++;this.onUpdate?.();}
 pick(ids,weights,point){this.inputEpoch++;this.grab={ids:[...ids],weights:[...weights],target:point.map(v=>v*.001),goal:[...point]};this._active=true;this.lastInputAt=performance.now();this.ask('pick',{ids,weights,point,epoch:this.inputEpoch,inputSequence:++this.inputSequence}).catch(e=>this.onError?.(e));}
 move(point){if(!this.grab||!point.every(Number.isFinite))return;this.grab.goal=[...point];this.lastInputAt=performance.now();this.inputSequence++;if(this.inputQueued)return;this.inputQueued=true;queueMicrotask(()=>{this.inputQueued=false;if(this.disposed||!this.grab)return;this.worker.postMessage({op:'move',point:this.grab.goal,epoch:this.inputEpoch,inputSequence:this.inputSequence});});}
 release(){this.grab=null;this.inputEpoch++;this._report.grabForceN=0;return this.ask('release',{epoch:this.inputEpoch}).catch(e=>this.onError?.(e));}
 reset(){this._active=false;this.grab=null;this.inputEpoch++;return this.ask('reset',{epoch:this.inputEpoch}).then(r=>{this.flushPose();return r;});}
 step(count=1){if(this.disposed)return;return this.ask('manualStep',{count,goal:this.grab?.goal}).then(r=>{this.flushPose();return r;});}
 async runTest(swing=true){this.testing=true;this._active=false;this.grab=null;try{const result=await this.ask('test',{swing});this.flushPose();return result;}finally{this.testing=false;}}
 report(){let cursorErrorMM=0;if(this.grab){for(let k=0;k<3;k++){let p=0;for(let j=0;j<3;j++)p+=this.grab.weights[j]*this.x[3*this.grab.ids[j]+k]*1000;cursorErrorMM+=(p-this.grab.goal[k])**2;}cursorErrorMM=Math.sqrt(cursorErrorMM);}return{...this._report,held:!!this.grab,active:this._active,workerBusy:this.busy,calculationSpeed:this.speed,integrationThread:'autonomous fixed-step worker; rendering does not pace simulation',failed:this.failed||this._report.failed,inputToPoseMS:this.inputLatencyMS,cursorErrorMM,receivedPoses:this.receivedPoses,appliedPoses:this.appliedPoses,pendingRequests:this.pending.size,inputSequence:this.inputSequence};}
 dispose(){this.disposed=true;this._active=false;this.worker.terminate();for(const p of this.pending.values())p.resolve({disposed:true});this.pending.clear();}
}