import assert from 'node:assert/strict';
import {JUMP_STYLES,sampleJumpPose,DEFAULT_JUMP_STYLE} from '../JumpProfiles.mjs';
import {MOVEMENT} from '../CharacterController.mjs';
import {JUMP_MOTIONS} from '../JumpMotionData.mjs';
const v0=Math.sqrt(2*MOVEMENT.gravity*MOVEMENT.jumpHeight),cases=[];
for(const {id} of JUMP_STYLES){
 const compare=(a,b,limit)=>{for(const key of [...Object.keys(JUMP_MOTIONS[id].channels),'pelvisPitch','neckPitch','clavicleLift','toeOff'])assert(Math.abs(a[key]-b[key])<limit,id+' discontinuous '+key);};
 compare(sampleJumpPose(id,{phase:'anticipation',phaseTime:MOVEMENT.anticipation,grounded:true,vy:0},MOVEMENT,0),sampleJumpPose(id,{phase:'takeoff',phaseTime:0,grounded:false,vy:v0},MOVEMENT,0),1e-6);cases.push(id+' preparation and launch agree');
 compare(sampleJumpPose(id,{phase:'flight',grounded:false,vy:.0001},MOVEMENT,1),sampleJumpPose(id,{phase:'fall',grounded:false,vy:-.0001},MOVEMENT,1),.0001);cases.push(id+' apex does not jump to a landing pose');
 for(const knots of Object.values(JUMP_MOTIONS[id].channels)){assert(knots.every(Number.isFinite)&&knots.length%3===0);assert.equal(knots[0],0);assert.equal(knots.at(-3),4);for(let i=3;i<knots.length;i+=3)assert(knots[i]>knots[i-3]);}cases.push(id+' sparse curves have ordered finite coefficients');
}
assert(!JUMP_STYLES.some(s=>['original','natural','stride','compact'].includes(s.id)));assert(JUMP_MOTIONS[DEFAULT_JUMP_STYLE]);cases.push('Rejected batch is absent and default is valid');
for(const {id} of JUMP_STYLES){
 const prep=u=>sampleJumpPose(id,{phase:'anticipation',phaseTime:u*MOVEMENT.anticipation,grounded:true,vy:0},MOVEMENT,0),compressed=prep(.53),pushed=prep(1),folded=sampleJumpPose(id,{phase:'flight',grounded:false,vy:0},MOVEMENT,1);
 assert(compressed.drop>.15&&compressed.knee_l>1.1&&compressed.torso>.45,'Weak compression '+id);
 assert(pushed.drop<.001&&Math.abs((pushed.hip_l+pushed.hip_r)/2)<.03&&(pushed.knee_l+pushed.knee_r)/2<.02&&pushed.arm_l>1,'Extension/arm swing must precede flight '+id);
 assert(folded.hip_l>.8&&folded.knee_l>1.4&&folded.torso>.35,'Incomplete airborne tuck '+id);
 cases.push(id+' compresses, extends before flight, and folds at apex');
}
console.log(JSON.stringify({passed:cases.length,cases},null,2));
