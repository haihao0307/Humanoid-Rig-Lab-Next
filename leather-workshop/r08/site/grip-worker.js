/** A transport for the same ProductShell. Rendering never invents node poses.
 * Bounded batches keep pointer/UI responsive even when a complex shell runs
 * slower than wall-clock time. Sequence/instance boundaries reject stale poses. */
export class ProductWorkerShell {
 constructor(data,options={}){
  const base=new ProductShell(data,options);this.x=base.x.slice();this.rest=base.rest.slice();this.inv=base.inv.slice();this.cfg={...base.cfg};this._report=base.report();this._active=false;this.failed=null;this.grab=null;this.testing=false;this.busy=false;this.disposed=false;this.sequence=0;this.pending=new Map();this.speed=0;
  const url=URL.createObjectURL(new Blob([PRODUCT_WORKER_CODE],{type:'text/javascript'}));this.worker=new Worker(url);URL.revokeObjectURL(url);
  this.worker.onerror=e=>{this.failed=e.message;this._active=false;this.onError?.(Error(e.message));};
  this.worker.onmessage=e=>{const r=e.data,p=this.pending.get(r.id);if(!p||this.disposed)return;this.pending.delete(r.id);if(r.error){this.failed=r.error;this._active=false;p.reject(Error(r.error));this.onError?.(Error(r.error));return;}
   if(r.positions){this.x.set(r.positions);this._report=r.report;this.failed=r.report.failed;this.onUpdate?.();}
   p.resolve(r.result||r.report);
  };
  this.ready=this.ask('init',{data,options});
 }
 get active(){return this._active;}
 set active(value){this._active=!!value;if(this.worker&&!this.disposed)this.ask('active',{value:this._active}).catch(e=>this.onError?.(e));}
 ask(op,data={}){if(this.disposed)return Promise.reject(Error('Disposed product solver'));const id=++this.sequence;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({id,op,...data});});}
 pick(ids,weights,point){this.grab={ids:[...ids],weights:[...weights],target:point.map(v=>v*.001),goal:[...point]};this._active=true;this.ask('pick',{ids,weights,point}).catch(e=>this.onError?.(e));}
 move(point){if(this.grab&&point.every(Number.isFinite))this.grab.goal=[...point];}
 release(){this.grab=null;this._report.grabForceN=0;this.ask('release').catch(e=>this.onError?.(e));}
 reset(){this._active=false;this.grab=null;this.x.set(this.rest);this.onUpdate?.();return this.ask('reset');}
 step(count=1){if(this.busy||this.disposed||this.testing||!this._active)return null;this.busy=true;const start=performance.now(),t=this._report.timeS;return this.ask('step',{count,goal:this.grab?.goal}).then(r=>{this.speed=(r.timeS-t)/Math.max(.001,(performance.now()-start)/1000);return r;}).finally(()=>{this.busy=false;});}
 async runTest(swing=true){this.testing=true;this._active=false;this.grab=null;try{const result=await this.ask('test',{swing});this._active=false;return result;}finally{this.testing=false;}}
 report(){return{...this._report,held:!!this.grab,active:this._active,workerBusy:this.busy,calculationSpeed:this.speed,integrationThread:'dedicated worker, same deterministic ProductShell',failed:this.failed||this._report.failed};}
 dispose(){this.disposed=true;this._active=false;this.worker.terminate();for(const p of this.pending.values())p.resolve({disposed:true});this.pending.clear();}
}
