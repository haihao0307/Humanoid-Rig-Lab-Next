// Exact route equivalence for snapshot-scoped occupancy/edge/exit reuse.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),runtime=read('source/runtime.template.js');
const metrics={clearanceCalls:0};
const code=runtime.split('// MODULE math')[1].split('function matrix')[0]+'\n'+
 runtime.slice(runtime.indexOf('function objectYaw'),runtime.indexOf('/*__SOURCE:world/PhysicsContract.js__*/'))+'\n'+read('world/PhysicsContract.js')+'\n'+read('world/GridNavigation.js');
const api=vm.runInNewContext(code+`\nconst originalClearance=pointToObjectClearance;pointToObjectClearance=(...args)=>{metrics.clearanceCalls++;return originalClearance(...args)};
({path:campGridPath,batch:navigationQueryBatch,batchSteps:navigationQueryBatchSteps,active:world=>navigationBatches.has(world),qy});`,{metrics,horizontal:(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2])});
const box=(id,x,z,w,d,yaw=0)=>({id,p:[x,.5,z],shape:'box',w,h:1,d,q:api.qy(yaw),yaw,r:Math.hypot(w,d)/2,collidable:true});
const world=objects=>({objects,bounds:{xMin:-2.4,xMax:2.4,zMin:-2.4,zMax:2.4},revision:0});
const fixtures=[
 world([box('wall',0,0,.18,4.8)]),
 world([box('bottom',0,-1.4,.2,2),box('top',0,1.4,.2,2)]),
 world([box('skew',.2,.2,.5,2,.37),box('corner',-.9,-.5,.5,.5)])
];
const queries=[];
for(const r of [.16,.26,.260001,.38])for(let i=0;i<8;i++){
 const z=-1.65+i*.46;
 queries.push({start:[-1.7+(i%2)*.031,0,z],end:[1.7-(i%3)*.027,0,-z+.013],r,ignore:[]});
}
// Close points share rounded grid cells but retain distinct collision edges.
for(let i=0;i<6;i++)queries.push({start:[-.35+i*.009,0,-.18],end:[.35-i*.011,0,.23],r:.16,ignore:[]});
queries.push({start:[-.06,0,1.1],end:[-1.8,0,-1.1],r:.16,ignore:[]}); // overlap/escape
queries.push({start:[-1.7,0,-1.1],end:[1.7,0,1.1],r:.26,ignore:['wall','skew']});
queries.push({start:[-1.7,0,-1.1],end:[1.7,0,1.1],r:.26,ignore:['skew','wall']});
const outcome=(w,q)=>{try{return {route:api.path(w,q.start,q.end,q.r,q.ignore)}}catch(e){return {error:e.message}}};
let accepted=0,rejected=0,uncachedCalls=0,cachedCalls=0;
for(const [index,w]of fixtures.entries()){
 metrics.clearanceCalls=0;const baseline=queries.map(q=>outcome(w,q));uncachedCalls+=metrics.clearanceCalls;
 metrics.clearanceCalls=0;const cached=api.batch(w,()=>{assert(api.active(w));return queries.map(q=>outcome(w,q));});cachedCalls+=metrics.clearanceCalls;
 assert.equal(api.active(w),false);
 for(let i=0;i<queries.length;i++){
  assert.equal(JSON.stringify(cached[i]),JSON.stringify(baseline[i]),`fixture ${index}, query ${i}: cached and uncached paths must match exactly`);
  if(cached[i].error)rejected++;else accepted++;
 }
}
assert(cachedCalls<uncachedCalls,'snapshot reuse must remove repeated geometric queries');
const moving=fixtures[0],sample=queries[0];
assert.throws(()=>api.batch(moving,()=>{outcome(moving,sample);throw Error('abort forecast')}),/abort forecast/);
assert.equal(api.active(moving),false,'throwing forecasts must release snapshot caches');
moving.objects[0].p[0]=1.9;moving.objects[0].d=.3; // no revision update: same as direct physics motion
assert.equal(JSON.stringify(api.batch(moving,()=>outcome(moving,sample))),JSON.stringify(outcome(moving,sample)));
const other=world([box('wall',0,0,.18,.4)]);
const otherBaseline=JSON.stringify(outcome(other,sample));
api.batch(moving,()=>api.batch(other,()=>assert.equal(JSON.stringify(outcome(other,sample)),otherBaseline)));
assert.equal(api.active(moving)||api.active(other),false);
const steppedWorld=world([box('wall',0,0,.18,.4)]),expected=queries.slice(0,8).map(q=>outcome(steppedWorld,q));
const stepped=api.batchSteps(steppedWorld,function*(){const result=[];for(const q of queries.slice(0,8)){assert(api.active(steppedWorld));result.push(outcome(steppedWorld,q));yield null;}return result;});
for(let i=0;i<8;i++){assert.equal(stepped.next().done,false);assert.equal(api.active(steppedWorld),false);assert.equal(JSON.stringify(outcome(steppedWorld,queries[i])),JSON.stringify(expected[i]),'unrelated query between frames has its own context');}
assert.equal(JSON.stringify(stepped.next().value),JSON.stringify(expected));
let invalidations=0;
for(const mutate of [w=>w.objects[0].p[0]+=.01,w=>w.objects[0].q=api.qy(.2),w=>w.objects[0].h+=.1,w=>w.objects[0].collidable=false,w=>w.bounds.xMin-=.1,w=>w.objects.push(box('new',0,1,.2,.2)),w=>w.zones=[{id:'Z1',p:[1,0,1],r:.5,shape:'square'}]]){
 const w=world([box('wall',0,0,.18,.4)]);let closed=false;
 const it=api.batchSteps(w,function*(){try{outcome(w,sample);yield null;throw Error('stale iterator resumed');}finally{closed=true;}});
 assert.equal(it.next().done,false);mutate(w);assert.equal(w.revision,0);
 assert.throws(()=>it.next(),e=>e.code==='PREFLIGHT_WORLD_CHANGED');assert.equal(closed,true);assert.equal(api.active(w),false);invalidations++;
}
let cancelClosed=false;const cancelled=api.batchSteps(other,function*(){try{yield null;}finally{cancelClosed=true;}});cancelled.next();cancelled.return();assert(cancelClosed);assert.equal(api.active(other),false);
// A synchronous outer query must regain its own cache after a nested chunk.
api.batch(other,()=>{const nested=api.batchSteps(other,function*(){yield outcome(other,sample);return 1;});nested.next();assert(api.active(other));nested.return();assert(api.active(other));});assert.equal(api.active(other),false);
console.log(JSON.stringify({cases:queries.length*fixtures.length,accepted,rejected,uncachedClearanceCalls:uncachedCalls,cachedClearanceCalls:cachedCalls,exceptionAndPhysicsMoveInvalidation:true,cooperative:{equivalentQueries:8,geometryInvalidations:invalidations,cancellation:true,nestedAndUnrelatedTaskIsolation:true},scope:'exact production navigation, batched versus uncached, same routes and rejection reasons'},null,2));
