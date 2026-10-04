// Project-owned adult-human rules. These are graphical priors, not MRI data.
// Coordinates and material names belong in a subject calibration, never here.
export const HUMAN_BODY_SCHEMA='human/species-composition@1';
export const HUMAN_SPECIES_ID='homo-sapiens/adult@1';
const rule=(id,label,start,end,core,sat,growth,ageLoss,muscles)=>Object.freeze({id,label,start,end,coreFraction:core,satFraction:sat,muscleGrowth:growth,ageLoss,muscles:Object.freeze(muscles.map(([id,share,peak,width])=>Object.freeze({id,share,peak,width})))});
export const HUMAN_FAT_DISTRIBUTION=Object.freeze({abdomen:1,thorax:.85,neck:.50,head:.28,upperarm:.85,lowerarm:.70,hand:.38,thigh:1,calf:.70,foot:.38});
export const HUMAN_COMPARTMENTS=Object.freeze([
 rule('abdomen','腹腰','pelvis','spineMiddle',.61,.13,.45,.22,[['abdominal_wall',1,.54,.35]]),
 rule('thorax','胸背','spineMiddle','neck',.64,.09,1,.20,[['pectoralis_major',.35,.58,.30],['latissimus_dorsi',.40,.42,.38],['scapular_trunk',.25,.70,.35]]),
 rule('neck','颈','neck','head',.48,.09,.25,.15,[['neck_muscles',1,.50,.30]]),
 rule('head','头面','head','$top',.83,.09,.08,.08,[['facial_soft_tissue',1,.30,.32]]),
 rule('upperarm','上臂','upperarm','lowerarm',.30,.09,1,.24,[['biceps_brachii',.34,.48,.24],['triceps_brachii',.48,.44,.30],['brachialis',.18,.68,.23]]),
 rule('lowerarm','前臂','lowerarm','hand',.34,.07,.65,.21,[['forearm_flexors',.55,.34,.27],['forearm_extensors',.45,.38,.28]]),
 rule('hand','手掌','hand','$handEnd',.69,.10,.18,.13,[['hand_intrinsics',1,.48,.30]]),
 rule('thigh','大腿臀部','thigh','calf',.26,.12,1,.28,[['quadriceps',.48,.49,.31],['hamstrings',.32,.45,.32],['adductors',.20,.33,.27]]),
 rule('calf','小腿','calf','foot',.35,.07,.82,.25,[['gastrocnemius',.54,.28,.23],['soleus',.30,.49,.27],['tibialis_group',.16,.42,.31]]),
 rule('foot','足','foot','$footEnd',.69,.11,.15,.12,[['foot_intrinsics',1,.44,.32]])
]);
export const HUMAN_COMPOSITION_POLICY=Object.freeze({species:HUMAN_SPECIES_ID,adultAgeRange:[18,75],referenceAge:32,referenceHeight:1.8,
 muscleRatioRange:[.38,2.35],fatRatioRange:[.16,7.5],
 evidence:'authored-human-graphics-priors-not-population-measurements',
 invariants:Object.freeze(['identity-bone-lengths-independent-of-composition','muscle-and-sat-volumes-independent','skinning-not-tissue-segmentation','age-is-conditional-prior','subject-calibration-required','no-persisted-surface-fields'])});

export function compositionTargets(recipe,spec,referenceAge=32){
 const old=Math.max(0,Math.min(1,(recipe.age-referenceAge)/(75-referenceAge))),age=old*old*(3-2*old);
 // The muscle slider means relative level within the chosen age, not kg.
 const muscleRatio=Math.exp(recipe.muscle*Math.log(recipe.muscle>=0?2.35:1/.38)*spec.muscleGrowth)*(1-spec.ageLoss*age);
 const fatRatio=Math.exp(recipe.fatness*Math.log(recipe.fatness>=0?7.5:1/.16)*HUMAN_FAT_DISTRIBUTION[spec.id]);
 return {muscleRatio,fatRatio,ageAmount:age,muscleQualityPrior:1-.24*age,evidence:HUMAN_COMPOSITION_POLICY.evidence};
}
