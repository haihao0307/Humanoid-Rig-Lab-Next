/* Serial interpretation with immediate invalidation. No body or rig writes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JarvisCommandArbiter=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 class StaleCommandError extends Error{constructor(reason='输入已被更新或停止'){super(reason);this.name='StaleCommandError';}}
 class Arbiter{
  constructor(){this.revision=0;this.sequence=0;this.tokens=new Set();this.tail=Promise.resolve();}
  invalidate(reason='输入已失效'){
   this.revision++;
   for(const token of this.tokens){token.reason=reason;token.controller.abort();}
   this.tokens.clear();return this.revision;
  }
  schedule(mode,execute){
   if(mode==='replace')this.invalidate('后续指令已接管');
   const controller=new AbortController(),self=this;
   const token={id:++this.sequence,revision:this.revision,controller,signal:controller.signal,reason:null,
    assert(){if(this.signal.aborted||this.revision!==self.revision)throw new StaleCommandError(this.reason||undefined);},
    async wait(promise){this.assert();let listener;const aborted=new Promise((_,reject)=>{listener=()=>reject(new StaleCommandError(this.reason||undefined));this.signal.addEventListener('abort',listener,{once:true});});
     try{const value=await Promise.race([promise,aborted]);this.assert();return value;}finally{this.signal.removeEventListener('abort',listener);}}
   };
   this.tokens.add(token);
   const work=this.tail.catch(()=>{}).then(async()=>{token.assert();return await token.wait(Promise.resolve().then(()=>execute(token)));});
   const result=work.catch(error=>{if(error.name==='StaleCommandError'||controller.signal.aborted)return{stale:true,dispatched:false,reason:token.reason||error.message};throw error;}).finally(()=>this.tokens.delete(token));
   this.tail=result.catch(()=>{});return result;
  }
 }
 return{Arbiter,StaleCommandError};
});
