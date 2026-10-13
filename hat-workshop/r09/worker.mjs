import {regenerate,sectionProfile} from './core.mjs';
import {sourceFitProfile,deform} from './fit.mjs';
import {checkGeometry,checkHeadRange,assertLockedSettings} from './fit-contract.mjs';
function transfers(value,out=new Set()){
 if(ArrayBuffer.isView(value))out.add(value.buffer);
 else if(value&&typeof value==='object')for(const v of Object.values(value))transfers(v,out);
 return [...out];
}
self.onmessage=async e=>{
 const {job,kind,data}=e.data,start=performance.now();
 try{
  let result;
  if(kind==='payload'){
   self.postMessage({job,stage:'在线程中读取全部帽型与原色'});
   const text=atob(data.base64),bytes=new Uint8Array(text.length);
   for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);
   const json=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
   result={payload:JSON.parse(json)};
  }else if(kind==='head'){
   const {position,index}=data;let ymax=-Infinity;
   for(let i=1;i<position.length;i+=3)ymax=Math.max(ymax,position[i]);
   result={profile:sectionProfile(position,index,{ymin:-.07,ymax,rows:112,angles:192})};
  }else{
   const {meta,settings,profile}=data;
   self.postMessage({job,stage:kind==='build'?'生成原帽型':'适配当前头形'});
   const mesh=kind==='build'?regenerate(meta.mother):data.mesh;
   assertLockedSettings(settings);checkHeadRange(profile,settings.wearBandMM);
   self.postMessage({job,stage:'按当前头形量配'});
   const source=sourceFitProfile(mesh,meta),fit=checkGeometry(deform(mesh,meta,settings,profile,source));
   result=kind==='build'?{mesh,fit}:{fit};
  }
  result.workerMS=performance.now()-start;
  self.postMessage({job,result},transfers(result));
 }catch(error){self.postMessage({job,error:{message:error.message,stack:error.stack}});}
};
