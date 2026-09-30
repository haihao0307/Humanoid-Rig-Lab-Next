import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../body/FoundationActivitiesR1.js',import.meta.url),'utf8');
class Agent{}
Agent.prototype.reset=function(){};
Agent.prototype.submit=function(){};
Agent.prototype.moveAlong=function(){};
Agent.prototype.tickFixed=function(){};
Agent.prototype.cancel=function(){};
Agent.prototype.finish=function(){};
const sandbox={Agent,console,globalThis:null,__FOUNDATION_ACTIVITY_TEST__:true};
sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'FoundationActivitiesR1.js'});
const api=sandbox.__FOUNDATION_ACTIVITY_TEST_API__;
if(!api)throw Error('test API missing');
const assert=(condition,message)=>{if(!condition)throw Error(message)};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<=e;
let c=api.foundationParseCommand('向前跑5米');
assert(c?.type==='run'&&c.direction==='forward'&&c.distanceM===5,'forward run parse failed');
c=api.foundationParseCommand('向后奔跑2.5米');
assert(c?.type==='run'&&c.direction==='backward'&&c.distanceM===2.5,'backward run parse failed');
c=api.foundationParseCommand('原地跳');
assert(c?.type==='jump'&&c.distanceM===0,'standing jump parse failed');
c=api.foundationParseCommand('向前跳1米');
assert(c?.type==='jump'&&c.distanceM===1,'forward jump parse failed');
c=api.foundationParseCommand('捡起木箱然后搬到营地');
assert(c?.type==='carryAlias'&&c.object==='木箱'&&c.target==='营地','pickup carry alias parse failed');
const run={tempo:1};
let previous=run.tempo;
for(let i=0;i<120;i++){const now=api.foundationRunTempo(run,1/120,5);assert(now>=previous-1e-9,'run acceleration reversed');previous=now;}
assert(run.tempo>1.5&&run.tempo<=api.FOUNDATION_ACTIVITIES_R1.run.maximumTempo,'run tempo range failed');
for(let i=0;i<120;i++)api.foundationRunTempo(run,1/120,.05);
assert(run.tempo<previous,'run deceleration failed');
const cfg=api.FOUNDATION_ACTIVITIES_R1.jump;
const total=cfg.compressionS+cfg.extensionS+cfg.flightS+cfg.landingS+cfg.recoveryS;
const start=api.foundationJumpProfile(0,1),takeoff=api.foundationJumpProfile(cfg.compressionS+cfg.extensionS,1),mid=api.foundationJumpProfile(cfg.compressionS+cfg.extensionS+cfg.flightS*.5,1),end=api.foundationJumpProfile(total,1);
assert(start.phase==='compression'&&near(start.heightM,0)&&near(start.travelM,0),'jump start failed');
assert(takeoff.phase==='flight'&&takeoff.heightM>0,'jump takeoff continuity failed');
assert(mid.phase==='flight'&&mid.heightM>cfg.heightM*.8,'jump apex failed');
assert(end.complete&&near(end.heightM,0)&&near(end.travelM,1),'jump landing failed');
for(const direction of ['forward','backward','left','right']){
 const v=api.foundationDirectionVector(Math.PI/3,direction),length=Math.hypot(v[0],v[2]);assert(near(length,1),'direction vector not normalized');
}
console.log(JSON.stringify({passed:true,version:api.FOUNDATION_ACTIVITIES_R1.version,checks:16}));
