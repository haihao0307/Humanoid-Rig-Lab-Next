// Source-specific labels of observed outer parts; not internal tissue labels.
export function r008InverseCalibration(profile,materials){
 if(profile.sourceId!=='new-human-r008')throw Error('Different source needs its own material semantics');
 const parts={0:'torso',1:'clothing',2:'clothing',3:'head',4:'calf_r',5:'foot_l',6:'lowerarm_r',7:'foot_r',8:'lowerarm_l',9:'clothing',10:'upperarm_r',11:'upperarm_l',12:'upperarm_l',13:'thigh_r',14:'upperarm_r',15:'hand_r',16:'thigh_l',17:'hand_l',18:'hand_r',19:'calf_l',20:'hand_l',21:'neck',22:'knee_r',23:'knee_l',24:'hand_r',25:'hand_l',26:'hand_l',27:'hand_l',28:'hand_r',29:'hand_r',30:'hand_l'};
 return {sourceId:profile.sourceId,evidence:'authored-observed-surface-part-semantics',materialRegions:Object.fromEntries(materials.map((m,i)=>[i,parts[Number(m.name.match(/tripo_part_(\d+)/)?.[1])]||null])),protectedRegions:['clothing'],interpretation:'observed skin/head outline; no hidden-body measurements'};
}
