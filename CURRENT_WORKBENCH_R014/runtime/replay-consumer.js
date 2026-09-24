(()=>{
'use strict';
const H=window.__BIRD_R012_HANDOFF,P=window.__BIRD_R011_CLOCK,EXEC=window.__BIRD_R010_API;
if(!H||!P||!EXEC)throw new Error('R0.13 参考消费者缺少 R0.10—R0.12 合同链');
const controls=H.controlOrder,active=H.activeChannelOrder,locked=H.lockedChannelOrder,env=EXEC.sourceEnvelopes,D=P.clock.phaseTicksPerCycle;
const td=new TextDecoder(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fromHex=hex=>{const s=String(hex).replace(/[^0-9a-f]/gi,'');if(s.length!==H.packet.byteLength*2)throw new Error('hex length');const out=new Uint8Array(H.packet.byteLength);for(let i=0;i<out.length;i++)out[i]=parseInt(s.slice(i*2,i*2+2),16);return out};
const toHex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const fnv1a=(bytes,end=62)=>{let h=0x811c9dc5;for(let i=0;i<end;i++){h^=bytes[i];h=Math.imul(h,0x01000193)>>>0}return h>>>0};
const dq01=q=>q/65535;
const qChannel=(name,value)=>{const e=env[name];return Math.round((clamp(value,e.min,e.max)-e.min)/(e.max-e.min)*65535)};
function consume(input){
 const bytes=input instanceof Uint8Array?new Uint8Array(input):fromHex(input),dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length!==66)throw new Error('packet length');
 if(td.decode(bytes.slice(0,8))!==H.packet.magicAscii)throw new Error('magic');
 if(dv.getUint16(8,true)!==H.packet.schemaVersion)throw new Error('schema');
 const checksum=dv.getUint32(62,true);if(checksum!==fnv1a(bytes))throw new Error('checksum');
 const flags=dv.getUint16(10,true);if(flags&~7)throw new Error('flags');if(!(flags&4))throw new Error('source bounded flag');
 const cycleIndex=dv.getUint32(12,true),phaseTicks=dv.getUint16(16,true),rateHz=dv.getUint16(18,true),eventSerial=dv.getUint32(20,true);
 if(phaseTicks>=D)throw new Error('phaseTicks');if(!P.clock.supportedSampleRatesHz.includes(rateHz))throw new Error('rateHz');
 let off=24;const ctrl={};for(const name of controls){ctrl[name]=dq01(dv.getUint16(off,true));off+=2}ctrl.interpolation=(flags&1)?'linear':'smoothstep';
 const expected=EXEC.evaluateAtPhase(phaseTicks/D,ctrl);if(!expected.ok)throw new Error('re-evaluation');
 const activeQ16={},lockedQ16={};off=34;for(const name of active){const q=dv.getUint16(off,true),want=qChannel(name,expected.values[name]);if(q!==want)throw new Error('active channel '+name);activeQ16[name]=q;off+=2}
 off=56;for(const name of locked){const q=dv.getUint16(off,true),want=qChannel(name,expected.values[name]);if(q!==want)throw new Error('locked channel '+name);lockedQ16[name]=q;off+=2}
 const eventMask=dv.getUint16(60,true);if(eventMask&~0xff)throw new Error('event mask');
 return{ok:true,hex:toHex(bytes),checksum,flags,cycleIndex,phaseTicks,rateHz,eventSerial,eventMask,paused:!!(flags&2),interpolation:ctrl.interpolation,controls:ctrl,activeChannelsQ16:activeQ16,lockedChannelsQ16:lockedQ16};
}
window.__BIRD_R013_CONSUMER={consume,fromHex,toHex,fnv1a};
})();
