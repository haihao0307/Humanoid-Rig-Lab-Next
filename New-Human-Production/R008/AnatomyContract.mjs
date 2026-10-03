import {fatTransmission} from './AnatomyMath.mjs';
export const ANATOMY_RULES=Object.freeze([
 {id:'fixed-skeleton',owner:'BodyBinding',rule:'同一身高的胖瘦/肌肉/年龄变化不修改绑定骨长和关节中心'},
 {id:'fat-masks-definition',owner:'AdiposeLayer',rule:'脂肪厚度增加，肌肉尺度的曲面与明暗起伏必须衰减'},
 {id:'separate-channels',owner:'SkinMaterial',rule:'微观肤质、色素、伤疤和肌肉起伏分开处理'},
 {id:'evidence-boundary',owner:'AnatomyAnalysis',rule:'绑定骨架为输入观测；骨表面、肌肉附着、脂肪厚度未测得，不能声称精确恢复'},
 {id:'subject-analysis',owner:'BodyTissue',rule:'新人物重新分析轴向、比例、骨段、八权重；缺失/歧义时禁止自动体型变形'},
 {id:'visual-regression',owner:'tools/anatomy-review.cjs',rule:'比较高脂肪、低脂肪、高肌肉组合的真实三维外观；数值测试不能替代外观审查'}
]);
// A design transfer function, not a measured physiological fat thickness.
export function adiposeControls(fatness,height=1.8){const thickness=Math.max(0,fatness)*.025*height/1.8;return {estimatedThickness:thickness,muscleTransmission:fatTransmission(thickness,.06),blend:1-fatTransmission(thickness,.06),evidence:'authored-appearance-transfer'};}
export function enforceAnatomy(profile){if(!profile?.canDeform)throw Error('骨架分析存在缺失或歧义，请先校准');if(profile.segments.some(s=>!Number.isFinite(s.length)||s.length<0))throw Error('无效骨段');return true;}
