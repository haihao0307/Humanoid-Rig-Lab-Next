import assert from 'node:assert/strict';
import {FlatWorld} from '../../motion/vendor/world.mjs';
const cases=[];
for(let i=0;i<24;i++){
 const x=-1.15+i*.1,z0=.45+(i%4)*.12,z1=z0+.28,half=.10+(i%3)*.025;
 const obstacle={minX:x-half,maxX:x+half,minZ:z0,maxZ:z1},world=new FlatWorld([obstacle]);
 const crossing=world.sweep([x,0,0],[x,0,2],.23);
 const left=world.sweep([x-.65,0,0],[x-.65,0,2],.23);
 const right=world.sweep([x+.65,0,0],[x+.65,0,2],.23);
 assert.equal(crossing.blocked,true,JSON.stringify({i,obstacle,crossing,expected:'blocked'}));
 assert.equal(left.blocked,false,JSON.stringify({i,obstacle,left,expected:'clear'}));
 assert.equal(right.blocked,false,JSON.stringify({i,obstacle,right,expected:'clear'}));
 cases.push({i,obstacle,crossingBlocked:crossing.blocked,leftClear:!left.blocked,rightClear:!right.blocked});
}
console.log(JSON.stringify({suite:'world-obstacle-sweep-grid',barrierCases:cases.length,sweepChecks:cases.length*3,blockedCrossings:cases.filter(x=>x.crossingBlocked).length,clearSidePassages:cases.filter(x=>x.leftClear&&x.rightClear).length,passed:true,cases},null,2));