import { quaternionFromAnatomicalChannels } from '../../animation/quaternion.js';

export const HRL_NATURAL_SKINNING_POSE_FIXTURES_V1_SCHEMA = 'humanoid_rig/hrl_natural_skinning_pose_fixtures@1.0';

export const NATURAL_SKINNING_POSE_IDS_V1 = Object.freeze([
  'reference_a_pose','reference_t_pose','arms_down','both_arms_forward','both_arms_backward','left_shoulder_90','right_shoulder_90','left_shoulder_150','right_shoulder_150','upper_arm_internal_twist','upper_arm_external_twist','elbow_flex_45','elbow_flex_90','elbow_flex_135','forearm_pronation','forearm_supination','spine_forward_bend','spine_side_bend_left','spine_side_bend_right','spine_twist_left','spine_twist_right','hip_flexion_90','hip_abduction','thigh_twist','shallow_squat','deep_squat','large_step','seated_pose','kneeling_pose','knee_flex_135','ankle_dorsiflexion','finger_curl','fist',
]);

export function createNaturalSkinningPoseFixturesV1(rigCore) {
  const definitions = new Map(NATURAL_SKINNING_POSE_IDS_V1.map((id,index)=>[id,{index:index+1,poseId:id,channels:[],intentionalContact:false}]));
  const add=(poseId,jointId,channels)=>definitions.get(poseId).channels.push({jointId,...channels});
  for(const side of ['left','right']){
    const sign=side==='left'?1:-1;
    add('reference_t_pose',`${side}UpperArm`,{side:-35*sign});add('arms_down',`${side}UpperArm`,{side:32*sign});
    add('both_arms_forward',`${side}UpperArm`,{bend:78});add('both_arms_backward',`${side}UpperArm`,{bend:-48});
    add('upper_arm_internal_twist',`${side}UpperArm`,{twist:-65*sign});add('upper_arm_external_twist',`${side}UpperArm`,{twist:82*sign});
    add('elbow_flex_45',`${side}LowerArm`,{bend:45});add('elbow_flex_90',`${side}LowerArm`,{bend:90});add('elbow_flex_135',`${side}LowerArm`,{bend:135});
    add('forearm_pronation',`${side}LowerArm`,{twist:-82*sign});add('forearm_supination',`${side}LowerArm`,{twist:82*sign});
    add('hip_flexion_90',`${side}UpperLeg`,{bend:90});add('hip_abduction',`${side}UpperLeg`,{side:38*sign});add('thigh_twist',`${side}UpperLeg`,{twist:42*sign});
    add('shallow_squat',`${side}UpperLeg`,{bend:35});add('shallow_squat',`${side}LowerLeg`,{bend:52});
    add('deep_squat',`${side}UpperLeg`,{bend:78,side:8*sign});add('deep_squat',`${side}LowerLeg`,{bend:112});add('deep_squat',`${side}Foot`,{bend:12});
    add('seated_pose',`${side}UpperLeg`,{bend:88,side:5*sign});add('seated_pose',`${side}LowerLeg`,{bend:88});
    add('kneeling_pose',`${side}UpperLeg`,{bend:28,side:4*sign});add('kneeling_pose',`${side}LowerLeg`,{bend:122});add('kneeling_pose',`${side}Foot`,{bend:-32});
    add('knee_flex_135',`${side}LowerLeg`,{bend:135});add('ankle_dorsiflexion',`${side}Foot`,{bend:15});
  }
  add('left_shoulder_90','leftUpperArm',{side:-35});add('right_shoulder_90','rightUpperArm',{side:35});add('left_shoulder_150','leftUpperArm',{side:-95});add('right_shoulder_150','rightUpperArm',{side:95});
  for(const jointId of ['spine','chest','upperChest']){add('spine_forward_bend',jointId,{bend:10});add('spine_side_bend_left',jointId,{side:7});add('spine_side_bend_right',jointId,{side:-7});add('spine_twist_left',jointId,{twist:12});add('spine_twist_right',jointId,{twist:-12});}
  add('large_step','leftUpperLeg',{bend:58,side:8});add('large_step','leftLowerLeg',{bend:68});add('large_step','rightUpperLeg',{bend:-17,side:-5});add('large_step','rightLowerLeg',{bend:24});
  for(const poseId of ['finger_curl','fist'])for(const side of ['left','right'])for(const finger of ['Thumb','Index','Middle','Ring','Little'])for(const segment of ['Metacarpal','Proximal','Intermediate','Distal']){
    const jointId=`${side}${finger}${segment}`;if(!rigCore.joints.some((joint)=>joint.jointId===jointId))continue;const bend=poseId==='fist'?(segment==='Proximal'?72:segment==='Intermediate'?86:64):(segment==='Proximal'?38:segment==='Intermediate'?52:34);add(poseId,jointId,{bend});
  }
  definitions.get('deep_squat').intentionalContact=true;definitions.get('seated_pose').intentionalContact=true;definitions.get('kneeling_pose').intentionalContact=true;
  const jointById=new Map(rigCore.joints.map((joint)=>[joint.jointId,joint]));
  const fixtures=[...definitions.values()].map((definition)=>{
    const localRotations={};for(const channel of definition.channels){const joint=jointById.get(channel.jointId);if(!joint)throw new Error(`Pose fixture references unknown HumanRigCore joint ${channel.jointId}.`);localRotations[channel.jointId]=quaternionFromAnatomicalChannels(joint.axisReference,{bend:degrees(channel.bend),twist:degrees(channel.twist),side:degrees(channel.side)});}
    return {fixtureId:String(definition.index).padStart(2,'0'),poseId:definition.poseId,poseAuthority:'finalPose.localRotations',rootTranslation:[0,0,0],localRotations,authoredChannels:definition.channels,intentionalContact:definition.intentionalContact,boneScaleChannels:0,parentRelationshipOverrides:0};
  });
  return {schema:HRL_NATURAL_SKINNING_POSE_FIXTURES_V1_SCHEMA,referencePose:'natural-a-pose',fixtureCount:fixtures.length,fixtures};
}

export const PROGRESSIVE_SWEEPS_V1 = Object.freeze([
  {sweepId:'shoulder_abduction',jointIds:['leftUpperArm','rightUpperArm'],channel:'side',degrees:[0,30,60,90,120,150]},
  {sweepId:'elbow_flexion',jointIds:['leftLowerArm','rightLowerArm'],channel:'bend',degrees:[0,45,90,120,135]},
  {sweepId:'forearm_rotation',jointIds:['leftLowerArm','rightLowerArm'],channel:'twist',degrees:[-90,-60,-30,0,30,60,90]},
  {sweepId:'hip_flexion',jointIds:['leftUpperLeg','rightUpperLeg'],channel:'bend',degrees:[0,30,60,90,120]},
  {sweepId:'knee_flexion',jointIds:['leftLowerLeg','rightLowerLeg'],channel:'bend',degrees:[0,45,90,120,135]},
  {sweepId:'spine_twist',jointIds:['spine','chest','upperChest'],channel:'twist',degrees:[-45,-30,0,30,45]},
]);

export function createSweepPoseV1(rigCore,sweep,degreesValue){const jointById=new Map(rigCore.joints.map((joint)=>[joint.jointId,joint]));const localRotations={};for(const jointId of sweep.jointIds){const joint=jointById.get(jointId);const perJoint=sweep.sweepId==='spine_twist'?degreesValue/sweep.jointIds.length:degreesValue;const signed=(jointId.startsWith('right')&&(sweep.channel==='side'||sweep.channel==='twist'))?-perJoint:perJoint;localRotations[jointId]=quaternionFromAnatomicalChannels(joint.axisReference,{bend:sweep.channel==='bend'?degrees(signed):0,twist:sweep.channel==='twist'?degrees(signed):0,side:sweep.channel==='side'?degrees(signed):0});}return{poseId:`${sweep.sweepId}_${degreesValue}`,poseAuthority:'finalPose.localRotations',rootTranslation:[0,0,0],localRotations,intentionalContact:false};}

export function createDeterministicRandomPoseV1(rigCore,random,index){const supported=rigCore.joints.filter((joint)=>['spine','shoulder-ball','elbow-forearm','hip-ball','knee-hinge','ankle-foot','neck','head'].includes(joint.mobilityProfile.kind));const localRotations={};const samples=[];for(const joint of supported){const scale=0.7;const values=randomChannels(joint,random,scale);if(Math.abs(values.bend)+Math.abs(values.twist)+Math.abs(values.side)<1e-9)continue;localRotations[joint.jointId]=quaternionFromAnatomicalChannels(joint.axisReference,{bend:degrees(values.bend),twist:degrees(values.twist),side:degrees(values.side)});samples.push({jointId:joint.jointId,...values});}return{poseId:`random_legal_${String(index).padStart(3,'0')}`,poseAuthority:'finalPose.localRotations',rootTranslation:[0,0,0],localRotations,samples,intentionalContact:false};}

function randomChannels(joint,random,scale){const ranges=joint.limitProfile.ranges;const bipolar=(negativeName,positiveName)=>{const negative=ranges[negativeName]?.[1]??0;const positive=ranges[positiveName]?.[1]??0;return(random()*2-1)*(random()<0.5?negative:positive)*scale;};switch(joint.mobilityProfile.kind){case'spine':return{bend:bipolar('extension','flexion'),twist:bipolar('axial_rotation','axial_rotation'),side:bipolar('lateral_flexion','lateral_flexion')};case'shoulder-ball':return{bend:bipolar('extension','flexion'),twist:bipolar('internal_rotation','external_rotation'),side:bipolar('adduction','abduction')};case'elbow-forearm':return{bend:(ranges.flexion?.[1]??0)*random()*scale,twist:bipolar('pronation','supination'),side:0};case'hip-ball':return{bend:bipolar('extension','flexion'),twist:bipolar('internal_rotation','external_rotation'),side:bipolar('adduction','abduction')};case'knee-hinge':return{bend:(ranges.flexion?.[1]??0)*random()*scale,twist:0,side:0};case'ankle-foot':return{bend:bipolar('plantarflexion','dorsiflexion'),twist:0,side:bipolar('inversion','eversion')};default:return{bend:(random()*2-1)*15*scale,twist:(random()*2-1)*20*scale,side:(random()*2-1)*15*scale};}}
function degrees(value=0){return Number(value||0)*Math.PI/180;}
