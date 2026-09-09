/* Authored NPC archetypes, not measured sex averages. One structure/composition
 * contract feeds joint construction, generated shape and muscle capacity.
 * See README.md for references and approximation boundaries. */
const BODY_ARCHETYPES=Object.freeze({
 male:Object.freeze({id:'adult-male@2',ribDepth:1,pelvicDepth:1,jawWidth:1,boneRadius:1,nonModeledMassKg:60,
  rig:{humerusLengthM:.298,forearmLengthM:.247,femurLengthM:.412,tibiaLengthM:.404,pelvisHalfBreadthM:.151},
  muscle:{shoulder:1,elbowFlexors:1,elbowExtensors:1,grip:1,hip:1,knee:1,ankle:1,trunk:1},
  fat:{hipM:0,thighM:0,gluteM:0,abdomenM:0},
  morphs:{shoulderWidth:1,chestWidth:1,waistWidth:1,hipWidth:1,neckWidth:1,limbVolume:1,softness:1,breastProjectionM:0,faceWidth:1}}),
 female:Object.freeze({id:'adult-female@2',ribDepth:.88,pelvicDepth:1.055,jawWidth:.91,boneRadius:.94,nonModeledMassKg:55,
  rig:{humerusLengthM:.285,forearmLengthM:.238,femurLengthM:.418,tibiaLengthM:.401,pelvisHalfBreadthM:.174},
  muscle:{shoulder:.68,elbowFlexors:.65,elbowExtensors:.67,grip:.76,hip:.86,knee:.82,ankle:.86,trunk:.76},
  fat:{hipM:.014,thighM:.008,gluteM:.020,abdomenM:.003},
  morphs:{shoulderWidth:.87,chestWidth:.90,waistWidth:.86,hipWidth:1.15,neckWidth:.89,limbVolume:1,softness:1,breastProjectionM:.064,faceWidth:.95}})
});
for(const archetype of Object.values(BODY_ARCHETYPES))for(const value of Object.values(archetype))if(value&&typeof value==='object')Object.freeze(value);
const BODY_RIG_SHAPE_KEYS=Object.freeze(['shoulderWidth','hipWidth']);
function bodyRigShape(input,sex){
 const out={};for(const key of BODY_RIG_SHAPE_KEYS){const v=input?.[key]??BODY_ARCHETYPES[sex].morphs[key];
  const lo=key==='shoulderWidth'?.80:.86,hi=key==='shoulderWidth'?1.18:1.25;
  if(!Number.isFinite(v)||v<lo||v>hi)throw Error('骨架比例越界：'+key);out[key]=v;
 }return out;
}
function characterRigSignature(character){return JSON.stringify([character.bodySex,bodyRigShape(character.appearance?.morphs,character.bodySex)]);}
function initialBodyRigShape(){
 const initial=window.__BODY_PRESET_STATE__?.character||window.__NPC_DEFINITION__?.character||window.__CHARACTER_PRESET__;
 return bodyRigShape(initial?.appearance?.morphs,BODY_SEX);
}
function makeCharacterStrengthProfile(sex,id='balanced'){
 const a=BODY_ARCHETYPES[sex],p=makeStrengthProfile(id);p.nonModeledMassKg=a.nonModeledMassKg;
 for(const [key,g]of Object.entries(p.groups)){
  const name=key.replace(/^(left|right|center)_/,''),arm=['shoulder','elbowFlexors','elbowExtensors','grip'].includes(name);
  const length=arm?(a.rig.humerusLengthM+a.rig.forearmLengthM)/(.298+.247):(a.rig.femurLengthM+a.rig.tibiaLengthM)/(.412+.404);
  g.volumeCm3*=a.muscle[name];g.fiberLengthCm*=length;g.momentArmM*=arm?a.boneRadius:Math.sqrt(a.boneRadius);
 }return p;
}
function characterCompositionKey(character){return Object.entries(character.strength.profile.groups).sort(([a],[b])=>a.localeCompare(b)).map(([id,g])=>[id,g.volumeCm3]);}
