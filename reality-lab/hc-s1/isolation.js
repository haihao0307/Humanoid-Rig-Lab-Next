/* Trusted, digest-locked native pages only. This is storage separation, not a hostile-code sandbox. */
(function(root){
'use strict';
function bootstrap(){
 'use strict';
 function storage(){
  const values=new Map();const api={get length(){return values.size;},key(i){return [...values.keys()][Number(i)]??null;},getItem(k){k=String(k);return values.has(k)?values.get(k):null;},setItem(k,v){values.set(String(k),String(v));},removeItem(k){values.delete(String(k));},clear(){values.clear();}};
  return new Proxy(api,{get(target,key){if(key in target){const v=Reflect.get(target,key);return typeof v==='function'?v.bind(target):v;}return typeof key==='string'?(values.get(key)??undefined):undefined;},set(target,key,value){values.set(String(key),String(value));return true;},deleteProperty(target,key){values.delete(String(key));return true;}});
 }
 for(const name of ['localStorage','sessionStorage'])Object.defineProperty(window,name,{configurable:false,enumerable:true,value:storage()});
 Object.defineProperty(window,'__REALITY_STORAGE_ISOLATION__',{configurable:false,value:Object.freeze({version:'1',webStorage:'per-frame-volatile',parentStorageRead:false,parentStorageWritten:false,hostileCodeSandbox:false})});
}
function wrap(html){
 if(typeof html!=='string'||!/<head(?:\s[^>]*)?>/i.test(html))throw Error('固定原版缺少 head，拒绝猜测注入位置');
 const prefix='<!--REALITY_VOLATILE_STORAGE_V1-->',suffix='<!--/REALITY_VOLATILE_STORAGE_V1-->';
 if(html.includes(prefix))throw Error('原版已含存储隔离标记，拒绝重复包装');
 const insertion=prefix+'<scr'+'ipt>('+bootstrap.toString()+')();</scr'+'ipt>'+suffix;
 const result=html.replace(/<head(?:\s[^>]*)?>/i,head=>head+insertion);
 if(result.replace(insertion,'')!==html)throw Error('原版正文发生意外变化');
 return result;
}
root.RealityIsolation=Object.freeze({wrap});if(typeof module!=='undefined'&&module.exports)module.exports=root.RealityIsolation;
})(globalThis);
