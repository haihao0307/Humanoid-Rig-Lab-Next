'use strict';
// One-time source fork. Historical R25 sources remain byte-for-byte intact.
const fs=require('fs');
function fork(from,to,edits){if(fs.existsSync(to))return;let s=fs.readFileSync(from,'utf8');for(const[a,b]of edits){if(!s.includes(a))throw Error('Missing source edit '+a.slice(0,80));s=s.replaceAll(a,b);}fs.writeFileSync(to,s);}
fork('src/BodyImplicitWorkerR25.js','src/BodyImplicitWorkerR26.js',[
 ['let exactSourceProfiles=[];','let exactSourceProfiles=[];let stateIdentityR26;'],
 ['const key=BodyNeckSourceR22.stateKey(next),reference=neckPackage.referencePackets.find(p=>BodyNeckSourceR22.stateKey(p.state)===key);','const reference=stateIdentityR26.match(neckPackage.referencePackets,next);if(external&&stateIdentityR26.equal(external.sourceState,next))external={...structuredClone(external),sourceState:structuredClone(next)};'],
 ['selectedNeckPacket=external||reference?.packet||null;','selectedNeckPacket=external||(reference?{...structuredClone(reference.packet),sourceState:structuredClone(next)}:null);'],
 ['BodyNeckSourceR22.stateKey(external)!==BodyNeckSourceR22.stateKey(reference.packet)','BodyNeckSourceR22.stateKey({...external,sourceState:reference.packet.sourceState})!==BodyNeckSourceR22.stateKey(reference.packet)'],
 ['exactSourceProfiles.find(p=>BodyNeckSourceR22.stateKey(p.state)===BodyNeckSourceR22.stateKey(state))','stateIdentityR26.match(exactSourceProfiles,state)'],
 ['program=await decode(event.data.data);','program=await decode(event.data.data);stateIdentityR26=BodyStateIdentityR26.create(event.data.identityContract);'],
 ['BODY-EXACT-STATE-R25','BODY-EXACT-STATE-R26']
]);
fork('src/BodySourceBoundaryR25.js','src/BodySourceBoundaryR26.js',[
 ['function create(profiles,records){','function create(profiles,records,contract){const identity=BodyStateIdentityR26.create(contract);'],
 ['profiles.find(p=>stateKey(p.state)===stateKey(archive.person.state))','identity.match(profiles,archive.person.state)'],
 ['const raw=new TextEncoder().encode(stateKey(packet))','if(!identity.equal(packet.sourceState,archive.person.state))throw Error("头侧边界属于其他人物状态");const raw=new TextEncoder().encode(stateKey({...packet,sourceState:profile.state}))'],
 ['globalThis.BodySourceBoundaryR25={create,stateKey};','globalThis.BodySourceBoundaryR26={create,stateKey};']
]);
fork('src/BodyWorkbenchSurfaceR25.js','src/BodyWorkbenchSurfaceR26.js',[
 ['const bodyKeys=[','const stateIdentityR26=BodyStateIdentityR26.create(metadata.identityContract);const bodyKeys=['],
 ['metadata.profiles.find(p=>equal(p.state,next.state))','stateIdentityR26.match(metadata.profiles,next.state)'],
 ['BODY-WORKBENCH-SURFACE-R25','BODY-WORKBENCH-SURFACE-R26']
]);
fork('src/BodyImplicitAppR25.js','src/BodyImplicitAppR26.js',[
 ['R25 保留完整参数','R26 保留完整参数'],
 ['BodySourceBoundaryR25.create(window.__BODY_WORKBENCH_SOURCE_R25__.profiles,window.__BODY_WORKBENCH_SOURCE_R25__.boundaryRecords)','BodySourceBoundaryR26.create(window.__BODY_WORKBENCH_SOURCE_R25__.profiles,window.__BODY_WORKBENCH_SOURCE_R25__.boundaryRecords,window.__BODY_WORKBENCH_SOURCE_R25__.identityContract)'],
 ["worker.postMessage({type:'init',exactSourceProfiles:","worker.postMessage({type:'init',identityContract:window.__BODY_WORKBENCH_SOURCE_R25__.identityContract,exactSourceProfiles:"]
]);
