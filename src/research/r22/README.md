# R22 未采用的 GPU 分页实验

BodyRaySparsePagesR22.js 和 BodyFieldPagesR22.glsl 是隔离研究，不是构建入口。GPU 间接分页的真实首启检查分别超过 30 秒及 180 秒，未采用。证据见 qa/fidelity-r22/field-pages-gpu-startup-rejected.json。

正式 R22 仅在 CPU 常驻、Worker 传输和会话缓存中采用逐位无损分页；上传时恢复原 Float32 数组，并保留 R21 GPU 着色器原文。没有以降低精度或换场核来加速。

Float64 辅助表面试验见 BodyOriginalSkinHelpersR22.js / BodyAtlasRayHelpersR22.js。增加四层辅助纹理后，整幅局部峰值仍未改善，未采用；证据为 qa/fidelity-r22/active-skin-helpers-trial.json。它们不进入当前构建。
