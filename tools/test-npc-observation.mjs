import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
let now=0,stored=null;
const sandbox={performance:{now:()=>now},document:{visibilityState:'visible'},localStorage:{getItem:()=>null,setItem:(k,v)=>stored=JSON.parse(v)}};vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../control/NPCObservation.js',import.meta.url),'utf8')+'\nglobalThis.Observer=NPCObservation;',sandbox);
const actor={id:'a',label:'A',behavior:{title:'patrol',status:'running',stepIndex:0,cycles:0,elapsedS:0},agent:{time:0,phase:'walk',pos:[0,0,0],stats:{completed:0},paused:false,error:null},compact:{geometryBytes:100,report:{triangles:20},hair:{geometryBytes:30,triangles:5},skirt:{report:{triangles:10}}}};
const p={elapsedS:0,values:()=>[actor],exportScene:()=>({instances:[]}),lab:{world:{exportScene:()=>({objects:[]})},renderer:{quality:'shadow',compactPerformance:{stats:{fps:60,gpuMs:null,jsHeapBytes:null}}}}};
const recorder=new sandbox.Observer(p);recorder.start();
recorder.actorTick(actor,2);recorder.actorTick(actor,4);assert.equal(recorder.events.filter(e=>e.type==='phase').length,1);
now=1000;recorder.frame(1/60,8);assert.equal(recorder.latest.actors[0].meanTickMs,3);assert.equal(recorder.latest.actors[0].cpuMsPerWallSecond,6);assert.equal(recorder.latest.gpuMs,null);assert.equal(recorder.latest.jsHeapBytes,null);assert.equal(recorder.latest.actors[0].geometryBytes,130);assert.equal(recorder.latest.actors[0].triangles,35);
assert.equal(recorder.latest.fps,null);p.lab.renderer.compactPerformance.stats.lastFrameTime=now;recorder.sample(now,true);assert.equal(recorder.latest.fps,60);now+=2000;recorder.sample(now,true);assert.equal(recorder.latest.fps,null);
actor.agent.error='blocked';recorder.actorTick(actor,1);assert.equal(stored.events.at(-1).type,'error');assert.equal(stored.events.at(-1).error,'blocked');
for(let i=0;i<1810;i++){now+=1000;recorder.frame(1/60,5);recorder.event('test',actor);}
assert.equal(recorder.samples.length,1800);assert.equal(recorder.events.length,1200);assert(recorder.droppedSamples>0&&recorder.droppedEvents>0);
recorder.persist();assert.equal(stored.samples.length,120);assert.equal(stored.events.length,240);assert(stored.sceneAtStart&&stored.taskRecipes);
recorder.stop();const count=recorder.samples.length;now+=1000;recorder.frame(1/60,5);assert.equal(recorder.samples.length,count);assert.equal(recorder.recording,false);
sandbox.localStorage.setItem=()=>{throw Error('quota');};recorder.persist();assert.equal(recorder.storageError,'quota');
sandbox.environmentChanged=()=>{};
function station(){const w={theme:'camp',objects:[],zones:[],get(id){return [...this.objects,...this.zones].find(o=>o.id===id);},normalizeObject:o=>({...o}),normalizeZone:o=>({...o}),canPlace:()=>({ok:true}),touch(){}};const population={...p,requireWorldIdle(){},lab:{...p.lab,world:w}};return{w,recorder:new sandbox.Observer(population)};}
const added=station();added.recorder.prepareCarryStation();assert.equal(added.w.objects.length,1);assert.equal(added.w.zones.length,2);added.recorder.prepareCarryStation();assert.equal(added.w.objects.length+added.w.zones.length,3);
const blocked=station();blocked.w.canPlace=()=>({ok:false,reason:'occupied'});assert.throws(()=>blocked.recorder.prepareCarryStation(),/occupied/);assert.equal(blocked.w.objects.length+blocked.w.zones.length,0);
const conflict=station();conflict.w.zones.push({id:'Z26',name:'user area'});assert.throws(()=>conflict.recorder.prepareCarryStation(),/编号/);assert.equal(conflict.w.objects.length,0);
console.log(JSON.stringify({checks:28,boundedRecording:true,realGPUExecuted:false}));
