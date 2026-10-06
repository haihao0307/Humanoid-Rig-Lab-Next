import {fatTransmission} from './AnatomyMath.mjs';
export const ANATOMY_RULES=Object.freeze([
 {id:'fixed-skeleton',owner:'BodyBinding',rule:'同一身份和身高的组成变化不修改静态绑定骨长；姿态可以移动骨架'},
 {id:'fat-masks-definition',owner:'AdiposeLayer',rule:'脂肪厚度增加，肌肉尺度的曲面与明暗起伏必须衰减'},
 {id:'separate-channels',owner:'SkinMaterial',rule:'微观肤质、色素、伤疤和肌肉起伏分开处理'},
 {id:'evidence-boundary',owner:'AnatomyAnalysis',rule:'绑定骨架为输入观测；骨表面、肌肉附着、脂肪厚度未测得，不能声称精确恢复'},
 {id:'subject-analysis',owner:'BodyComposition',rule:'新人物重新分析轴向、比例、骨段，并提供独立组织校准；蒙皮不是组织分割'},
 {id:'species-core',owner:'HumanBodySpecies',rule:'成年人体共用组织关系和函数；人物坐标、材料与保护点仅属于校准档案'},
 {id:'volume-budget',owner:'BodyComposition',rule:'肌肉与皮下脂肪目标体积正值且独立，代理截面体积预算误差必须报告'},
 {id:'visual-regression',owner:'tools/anatomy-review.cjs',rule:'比较高脂肪、低脂肪、高肌肉组合的真实三维外观；数值测试不能替代外观审查'}
]);
// A design transfer function, not a measured physiological fat thickness.
export function adiposeControls(fatness,height=1.8){const thickness=Math.max(0,fatness)*.025*height/1.8;return {estimatedThickness:thickness,muscleTransmission:fatTransmission(thickness,.06),blend:1-fatTransmission(thickness,.06),evidence:'authored-appearance-transfer'};}
export function enforceAnatomy(profile){if(!profile?.canDeform)throw Error('骨架分析存在缺失或歧义，请先校准');if(profile.segments.some(s=>!Number.isFinite(s.length)||s.length<0))throw Error('无效骨段');return true;}
export function enforceComposition(profile,solution){if(profile.species!==solution.species||profile.sourceId!==solution.sourceId)throw Error('组织解算与校准档案不匹配');if(solution.areas.length!==profile.areas.length||!Number.isFinite(solution.maximumVolumeRelativeError)||solution.maximumVolumeRelativeError>1e-5)throw Error('组织体积预算未收敛');for(const a of solution.areas)if(![a.targetMuscleVolume,a.targetFatVolume,a.estimatedThickness].every(Number.isFinite)||!(a.targetMuscleVolume>0&&a.targetFatVolume>=0&&a.estimatedThickness>=0))throw Error('无效组织解算');return true;}
